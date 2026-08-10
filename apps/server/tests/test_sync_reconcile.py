from fastapi.testclient import TestClient

from app.main import app
from app.persistence import PostgresCameraStore, decode_store_state, encode_store_state
from app.shared.reconciler import GLOBAL_RECONCILER, ReconciliationEngine, ReconciliationState
from app.shared.schemas import SyncBatchRequest


def setup_function() -> None:
    GLOBAL_RECONCILER.processed_mutations.clear()
    GLOBAL_RECONCILER.entity_states.clear()
    GLOBAL_RECONCILER.entity_field_timestamps.clear()
    GLOBAL_RECONCILER.staged_conflicts.clear()


def test_field_level_auto_merge_success() -> None:
    client = TestClient(app)

    # Client A modifies name (offline/online)
    batch_a = {
        "mutations": [
            {
                "mutation_id": "mut-a-1",
                "client_id": "client-uuid-A",
                "workspace_id": "ws-1",
                "user_id": "user-a",
                "entity_type": "PROJECT",
                "entity_id": "p-100",
                "action": "UPDATE",
                "timestamp": 1000,
                "field_changes": {"name": "Project Alpha"},
            }
        ]
    }

    res_a = client.post("/api/v1/sync/reconcile-batch", json=batch_a)
    assert res_a.status_code == 200, res_a.text
    data_a = res_a.json()
    assert data_a["synced_count"] == 1
    assert data_a["conflict_count"] == 0
    assert data_a["results"][0]["status"] == "SYNCED"
    assert data_a["results"][0]["applied_fields"] == ["name"]

    # Client B modifies status (different field, non-overlapping) on the same entity
    batch_b = {
        "mutations": [
            {
                "mutation_id": "mut-b-1",
                "client_id": "client-uuid-B",
                "workspace_id": "ws-1",
                "user_id": "user-b",
                "entity_type": "PROJECT",
                "entity_id": "p-100",
                "action": "UPDATE",
                "timestamp": 1001,
                "field_changes": {"status": "MAINTENANCE"},
            }
        ]
    }

    res_b = client.post("/api/v1/sync/reconcile-batch", json=batch_b)
    assert res_b.status_code == 200, res_b.text
    data_b = res_b.json()
    assert data_b["synced_count"] == 1
    assert data_b["conflict_count"] == 0
    assert data_b["results"][0]["status"] == "SYNCED"
    assert data_b["results"][0]["applied_fields"] == ["status"]

    # Verify merged entity state on Server
    entity_key = "PROJECT:p-100"
    merged_state = GLOBAL_RECONCILER.entity_states[entity_key]
    assert merged_state["name"] == "Project Alpha"
    assert merged_state["status"] == "MAINTENANCE"


def test_idempotency_ignores_duplicate_mutation() -> None:
    client = TestClient(app)

    batch = {
        "mutations": [
            {
                "mutation_id": "mut-idempotent-1",
                "client_id": "client-uuid-A",
                "workspace_id": "ws-1",
                "user_id": "user-a",
                "entity_type": "CAMERA",
                "entity_id": "cam-10",
                "action": "UPDATE",
                "timestamp": 2000,
                "field_changes": {"sampling_rate": 100},
            }
        ]
    }

    res1 = client.post("/api/v1/sync/reconcile-batch", json=batch)
    assert res1.status_code == 200
    assert res1.json()["results"][0]["status"] == "SYNCED"

    # Resend identical batch
    res2 = client.post("/api/v1/sync/reconcile-batch", json=batch)
    assert res2.status_code == 200
    assert res2.json()["results"][0]["status"] == "IGNORED_DUPLICATE"
    assert res2.json()["synced_count"] == 0


def test_conflict_detection_staging_and_resolution() -> None:
    client = TestClient(app)

    # Client A sets sampling_rate = 50
    batch_a = {
        "mutations": [
            {
                "mutation_id": "mut-dev-a",
                "client_id": "client-uuid-A",
                "workspace_id": "ws-1",
                "user_id": "user-a",
                "entity_type": "DEVICE",
                "entity_id": "dev-100",
                "action": "UPDATE",
                "timestamp": 1000,
                "field_changes": {"sampling_rate": 50},
            }
        ]
    }
    res_a = client.post("/api/v1/sync/reconcile-batch", json=batch_a)
    assert res_a.status_code == 200
    assert res_a.json()["results"][0]["status"] == "SYNCED"

    # Client B sets sampling_rate = 200 on SAME entity and SAME field
    batch_b = {
        "mutations": [
            {
                "mutation_id": "mut-dev-b",
                "client_id": "client-uuid-B",
                "workspace_id": "ws-1",
                "user_id": "user-b",
                "entity_type": "DEVICE",
                "entity_id": "dev-100",
                "action": "UPDATE",
                "timestamp": 1001,
                "field_changes": {"sampling_rate": 200},
            }
        ]
    }
    res_b = client.post("/api/v1/sync/reconcile-batch", json=batch_b)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["conflict_count"] == 1
    assert data_b["results"][0]["status"] == "STAGED_FOR_REVIEW"
    assert data_b["results"][0]["conflicting_fields"] == ["sampling_rate"]

    # List staged conflicts
    list_res = client.get("/api/v1/sync/conflicts")
    assert list_res.status_code == 200
    conflicts_data = list_res.json()
    assert conflicts_data["total"] == 1
    conflict_item = conflicts_data["conflicts"][0]
    conflict_id = conflict_item["conflict_id"]
    assert conflict_item["client_id"] == "client-uuid-B"
    assert conflict_item["conflicting_fields"] == {"sampling_rate": 200}
    assert conflict_item["server_fields"] == {"sampling_rate": 50}

    # Resolve conflict choosing Client B
    resolve_res = client.post(
        f"/api/v1/sync/conflicts/{conflict_id}/resolve",
        json={"chosen_client_id": "client-uuid-B", "resolved_by": "admin-1"},
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"

    # Verify server entity state updated to Client B value
    entity_key = "DEVICE:dev-100"
    assert GLOBAL_RECONCILER.entity_states[entity_key]["sampling_rate"] == 200


def test_conflict_resolution_can_keep_server_value() -> None:
    client = TestClient(app)
    for mutation_id, client_id, value, timestamp in [
        ("mut-keep-a", "client-uuid-A", 50, 1000),
        ("mut-keep-b", "client-uuid-B", 200, 1001),
    ]:
        response = client.post(
            "/api/v1/sync/reconcile-batch",
            json={
                "mutations": [
                    {
                        "mutation_id": mutation_id,
                        "client_id": client_id,
                        "workspace_id": "ws-1",
                        "user_id": client_id,
                        "entity_type": "DEVICE",
                        "entity_id": "dev-keep",
                        "action": "UPDATE",
                        "timestamp": timestamp,
                        "field_changes": {"sampling_rate": value},
                    }
                ]
            },
        )
        assert response.status_code == 200

    conflicts = client.get("/api/v1/sync/conflicts").json()
    conflict_id = conflicts["conflicts"][0]["conflict_id"]
    response = client.post(f"/api/v1/sync/conflicts/{conflict_id}/resolve", json={})

    assert response.status_code == 200
    assert response.json()["status"] == "RESOLVED"
    assert GLOBAL_RECONCILER.entity_states["DEVICE:dev-keep"]["sampling_rate"] == 50
    assert client.get("/api/v1/sync/conflicts").json()["total"] == 0


def test_reconciliation_state_survives_postgres_snapshot_restart() -> None:
    request = SyncBatchRequest.model_validate(
        {
            "mutations": [
                {
                    "mutation_id": "mut-restart-base",
                    "client_id": "client-uuid-A",
                    "workspace_id": "ws-restart",
                    "user_id": "user-a",
                    "entity_type": "DEVICE",
                    "entity_id": "dev-restart",
                    "action": "UPDATE",
                    "timestamp": 1000,
                    "field_changes": {"sampling_rate": 50},
                }
            ]
        }
    )
    conflict_request = SyncBatchRequest.model_validate(
        {
            "mutations": [
                {
                    "mutation_id": "mut-restart-conflict",
                    "client_id": "client-uuid-B",
                    "workspace_id": "ws-restart",
                    "user_id": "user-b",
                    "entity_type": "DEVICE",
                    "entity_id": "dev-restart",
                    "action": "UPDATE",
                    "timestamp": 1001,
                    "field_changes": {"sampling_rate": 200},
                }
            ]
        }
    )

    running_store = PostgresCameraStore("postgresql://snapshot-test")
    running_engine = ReconciliationEngine(running_store.reconciliation_state)
    assert running_engine.reconcile_batch(request).results[0].status == "SYNCED"
    assert running_engine.reconcile_batch(conflict_request).results[0].status == "STAGED_FOR_REVIEW"

    persisted_state = decode_store_state(encode_store_state(running_store))
    restarted_store = PostgresCameraStore("postgresql://snapshot-test")
    restarted_store.__dict__.update(persisted_state)
    restarted_engine = ReconciliationEngine(restarted_store.reconciliation_state)

    assert restarted_engine.reconcile_batch(request).results[0].status == "IGNORED_DUPLICATE"
    conflicts = restarted_engine.list_conflicts()
    assert len(conflicts) == 1
    assert conflicts[0].conflict_id == "conflict-mut-restart-conflict"

    resolved = restarted_engine.resolve_conflict(conflicts[0].conflict_id, chosen_client_id="client-uuid-B")
    assert resolved.status == "RESOLVED"
    assert restarted_engine.entity_states["DEVICE:dev-restart"]["sampling_rate"] == 200


def test_multiple_workers_share_reconciliation_state_for_conflict_resolution() -> None:
    shared_state = ReconciliationState()
    worker_a = ReconciliationEngine(shared_state)
    worker_b = ReconciliationEngine(shared_state)

    worker_a.reconcile_batch(
        SyncBatchRequest.model_validate(
            {
                "mutations": [
                    {
                        "mutation_id": "mut-worker-a",
                        "client_id": "client-uuid-A",
                        "workspace_id": "ws-workers",
                        "user_id": "user-a",
                        "entity_type": "PROJECT",
                        "entity_id": "project-workers",
                        "action": "UPDATE",
                        "timestamp": 1000,
                        "field_changes": {"status": "ACTIVE"},
                    }
                ]
            }
        )
    )
    staged = worker_a.reconcile_batch(
        SyncBatchRequest.model_validate(
            {
                "mutations": [
                    {
                        "mutation_id": "mut-worker-b",
                        "client_id": "client-uuid-B",
                        "workspace_id": "ws-workers",
                        "user_id": "user-b",
                        "entity_type": "PROJECT",
                        "entity_id": "project-workers",
                        "action": "UPDATE",
                        "timestamp": 1001,
                        "field_changes": {"status": "ARCHIVED"},
                    }
                ]
            }
        )
    )

    assert staged.results[0].status == "STAGED_FOR_REVIEW"
    conflicts = worker_b.list_conflicts()
    assert len(conflicts) == 1
    worker_b.resolve_conflict(conflicts[0].conflict_id, chosen_client_id="client-uuid-B")

    assert worker_a.entity_states["PROJECT:project-workers"]["status"] == "ARCHIVED"
    assert worker_a.list_conflicts(status_filter="PENDING_REVIEW") == []


def test_sync_routes_use_postgres_store_reconciliation_state() -> None:
    from app.main_core import dependencies
    from app.modules.sync.router import reconcile_batch

    original_store = dependencies.get_store()
    persistent_store = PostgresCameraStore("postgresql://route-test")
    dependencies.set_store(persistent_store)
    try:
        response = reconcile_batch(
            SyncBatchRequest.model_validate(
                {
                    "mutations": [
                        {
                            "mutation_id": "mut-route-persistent",
                            "client_id": "client-uuid-route",
                            "workspace_id": "ws-route",
                            "user_id": "user-route",
                            "entity_type": "PROJECT",
                            "entity_id": "project-route",
                            "action": "UPDATE",
                            "timestamp": 1000,
                            "field_changes": {"status": "ACTIVE"},
                        }
                    ]
                }
            )
        )
    finally:
        dependencies.set_store(original_store)

    assert response.results[0].status == "SYNCED"
    assert "mut-route-persistent" in persistent_store.reconciliation_state.processed_mutations
    assert "mut-route-persistent" not in GLOBAL_RECONCILER.processed_mutations
