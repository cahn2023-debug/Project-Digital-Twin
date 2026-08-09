from fastapi.testclient import TestClient
from uuid import UUID

from app.domain import Camera
from app.main import app, store


def setup_function() -> None:
    store.projects.clear()
    store.project_roots.clear()
    store.cameras.clear()
    store.camera_codes.clear()
    store.revisions.clear()
    store.contractors.clear()
    store.work_packages.clear()
    store.field_packages.clear()
    store.observations.clear()
    store.changesets.clear()
    store.file_import_results.clear()
    store.outbox.clear()
    store.audit_events.clear()
    store._correlation_by_aggregate.clear()
    store._last_event_by_aggregate.clear()
    store.write_jobs.clear()
    store.writeback_plans.clear()
    store.file_locks.clear()
    store.file_versions.clear()
    store.self_write_hashes.clear()
    store.source_assets.clear()
    store.organize_groups.clear()
    store.organize_tags.clear()
    store.organize_group_parents.clear()
    store.organize_group_memberships.clear()
    store.organize_tag_memberships.clear()
    store.organize_item_lifecycle.clear()
    store._idempotency.clear()
    store._changeset_idempotency.clear()


def create_project(client: TestClient, tmp_path, name: str) -> dict:
    root = tmp_path / name.lower().replace(" ", "-")
    root.mkdir()
    response = client.post(
        "/api/v1/projects",
        json={"name": name, "root_path": str(root)},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_project_lifecycle_validates_roots_and_preserves_data(tmp_path) -> None:
    client = TestClient(app)
    root = tmp_path / "project-root"
    root.mkdir()
    marker = root / "source.txt"
    marker.write_text("do not delete", encoding="utf-8")

    created = client.post(
        "/api/v1/projects",
        json={"name": "  Pilot  ", "root_path": str(root)},
    )
    assert created.status_code == 201
    project = created.json()
    project_id = UUID(project["id"])
    assert project["name"] == "Pilot"
    assert project["code"] == "P-001"
    assert project["status"] == "ACTIVE"

    blank_name = client.post(
        "/api/v1/projects",
        json={"name": "   ", "root_path": str(tmp_path / "blank-name")},
    )
    assert blank_name.status_code == 422

    duplicate_root = client.post(
        "/api/v1/projects",
        json={"name": "Duplicate", "root_path": str(root)},
    )
    assert duplicate_root.status_code == 409

    second_root = tmp_path / "second-root"
    second_root.mkdir()
    second = client.post(
        "/api/v1/projects",
        json={"name": "Second", "root_path": str(second_root)},
    )
    assert second.status_code == 201
    assert [item["id"] for item in client.get("/api/v1/projects").json()] == [
        project["id"],
        second.json()["id"],
    ]

    archived = client.post(f"/api/v1/projects/{project['id']}/archive")
    assert archived.status_code == 200
    assert archived.json()["status"] == "ARCHIVED"
    archived_second = client.post(f"/api/v1/projects/{second.json()['id']}/archive")
    assert archived_second.status_code == 200
    assert client.get("/api/v1/projects").json() == []
    assert client.get("/api/v1/projects?status=archived").json()[0]["id"] == project["id"]

    restored = client.post(f"/api/v1/projects/{project['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["status"] == "ACTIVE"

    camera_id = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    store.cameras[camera_id] = Camera(entity_id=camera_id, project_id=project_id, code="CAM-001")
    before = marker.read_bytes()
    deleted = client.request(
        "DELETE",
        f"/api/v1/projects/{project['id']}",
        json={"name": "Pilot"},
    )
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "DELETED"
    assert store.cameras[camera_id].project_id == project_id
    assert marker.read_bytes() == before
    assert client.get("/api/v1/projects").json() == []
    assert client.get("/api/v1/projects?status=deleted").json()[0]["id"] == project["id"]


def test_project_delete_requires_exact_name_and_allows_new_identity_from_root(tmp_path) -> None:
    client = TestClient(app)
    root = tmp_path / "reusable-root"
    root.mkdir()
    marker = root / "source.txt"
    marker.write_text("keep", encoding="utf-8")
    created = client.post(
        "/api/v1/projects",
        json={"name": "Reusable", "root_path": str(root)},
    ).json()

    wrong_name = client.request(
        "DELETE",
        f"/api/v1/projects/{created['id']}",
        json={"name": "Other"},
    )
    assert wrong_name.status_code == 409
    assert client.get(f"/api/v1/projects/{created['id']}").json()["status"] == "ACTIVE"

    deleted = client.request(
        "DELETE",
        f"/api/v1/projects/{created['id']}",
        json={"name": "Reusable"},
    )
    assert deleted.status_code == 200

    recreated = client.post(
        "/api/v1/projects",
        json={"name": "Recreated", "root_path": str(root)},
    )
    assert recreated.status_code == 201
    assert recreated.json()["id"] != created["id"]
    assert recreated.json()["code"] == "P-002"
    assert marker.read_text(encoding="utf-8") == "keep"


def test_import_and_geometry_revision_flow(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path, "Pilot")["id"]

    import_response = client.post(
        f"/api/v1/projects/{project_id}/cameras/import",
        json={
            "file_id": "11111111-1111-1111-1111-111111111111",
            "file_revision": 1,
            "rows": [{"CameraCode": "CAM-001", "Name": "Main"}],
        },
    )
    assert import_response.status_code == 200
    camera = import_response.json()["inserted"][0]

    geometry_response = client.post(
        f"/api/v1/projects/{project_id}/cameras/{camera['entity_id']}/designed-geometry",
        json={"latitude": 13.7563, "longitude": 100.5018, "base_revision": 1},
    )
    assert geometry_response.status_code == 200
    assert geometry_response.json()["status"] == "APPLIED"

    conflict_response = client.post(
        f"/api/v1/projects/{project_id}/cameras/{camera['entity_id']}/designed-geometry",
        json={"latitude": 13.7, "longitude": 100.5, "base_revision": 1},
    )
    assert conflict_response.status_code == 409
    assert conflict_response.json()["detail"]["code"] == "CONFLICT"


def test_assignment_field_sync_approval_dashboard_and_write_job(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path, "Field Pilot")
    project_id = project["id"]
    imported = client.post(
        f"/api/v1/projects/{project_id}/cameras/import",
        json={
            "file_id": "22222222-2222-2222-2222-222222222222",
            "file_revision": 3,
            "rows": [{"CameraCode": "CAM-002", "Name": "Field Camera"}],
        },
    ).json()["inserted"][0]
    camera_id = imported["entity_id"]

    contractor = client.post(
        f"/api/v1/projects/{project_id}/contractors",
        json={"code": "CON-01", "name": "Pilot Contractor"},
    ).json()
    work_package = client.post(
        f"/api/v1/projects/{project_id}/work-packages",
        json={
            "contractor_id": contractor["id"],
            "code": "WP-CAM-01",
            "name": "Camera Field Work",
            "entity_ids": [camera_id],
        },
    ).json()
    field_package = client.post(
        f"/api/v1/projects/{project_id}/field-packages",
        json={"work_package_id": work_package["id"]},
    ).json()
    observation = client.post(
        f"/api/v1/projects/{project_id}/observations",
        json={
            "field_package_id": field_package["id"],
            "entity_id": camera_id,
            "base_revision": 1,
            "operator_id": "operator-1",
            "gps": {"latitude": 13.7563, "longitude": 100.5018, "accuracy": 4.2},
            "form_data": {"verified": True},
            "idempotency_key": "obs-001",
        },
    ).json()
    duplicate = client.post(
        f"/api/v1/projects/{project_id}/observations",
        json={
            "field_package_id": field_package["id"],
            "entity_id": camera_id,
            "base_revision": 1,
            "operator_id": "operator-1",
            "form_data": {"verified": True},
            "idempotency_key": "obs-001",
        },
    ).json()
    assert duplicate["id"] == observation["id"]

    approved = client.post(
        f"/api/v1/projects/{project_id}/changesets/{observation['changeset_id']}/approve",
        json={"approved_by": "approver-1"},
    )
    assert approved.status_code == 200
    assert approved.json()["changeset"]["status"] == "APPLIED"

    dashboard = client.get(f"/api/v1/projects/{project_id}/dashboard").json()
    assert dashboard == {
        "total_camera": 1,
        "assigned": 1,
        "field_verified": 1,
        "pending_approval": 0,
        "approved_as_built": 1,
        "conflict": 0,
        "projection_cursor": 2,
    }
    changes = client.get(f"/api/v1/projects/{project_id}/sync/changes?after=0").json()
    assert [event["event_type"] for event in changes] == ["ObservationSubmitted", "AsBuiltRevisionCreated"]

    write_job = client.post(
        f"/api/v1/projects/{project_id}/file-write-jobs",
        json={
            "file_id": "22222222-2222-2222-2222-222222222222",
            "expected_file_revision": 3,
            "entity_revision": approved.json()["revision"]["id"],
        },
    )
    assert write_job.status_code == 202
    assert write_job.json()["status"] == "PENDING"


def test_file_import_creates_changeset_before_apply_and_is_idempotent(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path, "Import Pilot")["id"]
    request = {
        "file_id": "33333333-3333-3333-3333-333333333333",
        "file_revision": 4,
        "rows": [{"CameraCode": "CAM-003", "Name": "Raw Camera", "Unmapped": "keep"}],
        "idempotency_key": "file-import-003-r4",
    }

    created = client.post(f"/api/v1/projects/{project_id}/file-imports", json=request)
    assert created.status_code == 202
    payload = created.json()
    assert payload["changeset"]["status"] == "PENDING_APPROVAL"
    assert payload["notice"]
    assert payload["result"]["inserted"][0]["code"] == "CAM-003"
    assert payload["changeset"]["raw_rows"][0]["Unmapped"] == "keep"
    assert client.get(f"/api/v1/projects/{project_id}/cameras").json() == []

    duplicate_request = {**request, "idempotency_key": "retry-with-a-new-key"}
    duplicate = client.post(f"/api/v1/projects/{project_id}/file-imports", json=duplicate_request)
    assert duplicate.json()["changeset"]["id"] == payload["changeset"]["id"]

    approved = client.post(
        f"/api/v1/projects/{project_id}/file-imports/{payload['changeset']['id']}/approve",
        json={"approved_by": "approver-1"},
    )
    assert approved.status_code == 200
    assert approved.json()["changeset"]["status"] == "APPLIED"
    assert len(client.get(f"/api/v1/projects/{project_id}/cameras").json()) == 1


def test_file_import_reports_field_conflict_without_mutation(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path, "Conflict Pilot")["id"]
    first = client.post(
        f"/api/v1/projects/{project_id}/file-imports",
        json={
            "file_id": "44444444-4444-4444-4444-444444444444",
            "file_revision": 1,
            "rows": [{"CameraCode": "CAM-004", "Name": "Base"}],
            "idempotency_key": "file-import-004-r1",
        },
    ).json()
    approved = client.post(
        f"/api/v1/projects/{project_id}/file-imports/{first['changeset']['id']}/approve",
        json={"approved_by": "approver-1"},
    )
    camera_id = approved.json()["revisions"][0]["entity_id"]
    current_revision = approved.json()["revisions"][0]["revision"]

    pending = client.post(
        f"/api/v1/projects/{project_id}/file-imports",
        json={
            "file_id": "44444444-4444-4444-4444-444444444444",
            "file_revision": 2,
            "rows": [{"CameraCode": "CAM-004", "Name": "File Value"}],
            "idempotency_key": "file-import-004-r2",
        },
    ).json()
    store.cameras[UUID(camera_id)].name = "Server Value"
    store._append_revision(store.cameras[UUID(camera_id)], "DESIGNED", "server", None)
    server_revision = store.current_revision(UUID(camera_id), "DESIGNED").revision
    response = client.post(
        f"/api/v1/projects/{project_id}/file-imports/{pending['changeset']['id']}/approve",
        json={"approved_by": "approver-1"},
    )
    assert response.status_code == 409
    conflict = response.json()["detail"]["conflicts"][0]["fields"][0]
    assert conflict["field"] == "name"
    assert conflict["base"] == "Base"
    assert conflict["server"] == "Server Value"
    assert conflict["local"] == "File Value"
    assert store.current_revision(UUID(camera_id), "DESIGNED").revision == server_revision


def test_file_write_registers_version_self_write_and_restore_job(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path, "Write Pilot")["id"]
    file_id = "55555555-5555-5555-5555-555555555555"
    entity_revision = "66666666-6666-6666-6666-666666666666"
    source_hash = "a" * 64
    result_hash = "b" * 64
    write_job = client.post(
        f"/api/v1/projects/{project_id}/file-write-jobs",
        json={
            "file_id": file_id,
            "expected_file_revision": 1,
            "entity_revision": entity_revision,
            "expected_file_hash": source_hash,
            "source_path": "C:/Data/Camera.xlsx",
        },
    )
    assert write_job.status_code == 202
    job_id = write_job.json()["id"]

    completed = client.post(
        f"/api/v1/projects/{project_id}/file-write-jobs/{job_id}/complete",
        json={
            "source_hash": source_hash,
            "result_hash": result_hash,
            "size": 42,
            "actor": "software",
            "backup_path": "C:/Data/Camera.xlsx.bak",
        },
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "APPLIED"
    assert completed.json()["result_file_revision"] == 1
    assert store.is_self_write(UUID(file_id), result_hash)

    restore = client.post(
        f"/api/v1/projects/{project_id}/file-restore-jobs",
        json={
            "file_id": file_id,
            "target_file_revision": 1,
            "expected_file_revision": 1,
            "source_path": "C:/Data/Camera.xlsx",
        },
    )
    assert restore.status_code == 202
    restore_payload = restore.json()
    assert restore_payload["operation"] == "RESTORE"
    assert restore_payload["source_file_revision"] == 1
    changeset_id = restore_payload["changeset_id"]
    assert store.changesets[UUID(changeset_id)].status == "PENDING_APPROVAL"

    restored = client.post(
        f"/api/v1/projects/{project_id}/file-write-jobs/{restore_payload['id']}/complete",
        json={
            "source_hash": result_hash,
            "result_hash": "c" * 64,
            "size": 42,
            "actor": "restore-user",
            "backup_path": "C:/Data/Camera.xlsx.restore.bak",
        },
    )
    assert restored.status_code == 200
    assert restored.json()["result_file_revision"] == 2
    assert store.changesets[UUID(changeset_id)].status == "APPLIED"
    assert [version["revision"] for version in store.file_versions[UUID(file_id)]] == [1, 2]


def test_document_import_creates_read_only_changeset_with_evidence(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path, "Document Pilot")["id"]
    source = tmp_path / "wiki.md"
    source.write_text("# Notes\nSee [[CAM-001]]\n", encoding="utf-8")
    response = client.post(
        f"/api/v1/projects/{project_id}/document-imports",
        json={
            "path": str(source),
            "file_id": "77777777-7777-7777-7777-777777777777",
            "file_revision": 1,
            "canonical_entities": [{"id": "entity-1", "code": "CAM-001", "name": "Main"}],
        },
    )
    assert response.status_code == 202
    changeset = response.json()["changeset"]
    assert changeset["origin"] == "DOCUMENT_IMPORT"
    assert changeset["status"] == "PENDING_APPROVAL"
    assert changeset["relationship_proposals"][0]["target_entity_id"] == "entity-1"
    assert changeset["relationship_proposals"][0]["status"] == "PENDING_CONFIRMATION"
    assert changeset["file_hash"]
    assert changeset["document_mapped_tables"] == []
    assert response.json()["processing_duration_ms"] >= 0
    assert all(UUID(asset["id"]) in store.source_assets for asset in changeset["document_assets"])
    assert "read-only" in response.json()["notice"]
    assert client.get(f"/api/v1/projects/{project_id}/cameras").json() == []


def test_audit_is_project_scoped_filterable_exportable_and_permissioned(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path, "Audit Pilot")["id"]
    request = {
        "file_id": "88888888-8888-8888-8888-888888888888",
        "file_revision": 1,
        "rows": [{"CameraCode": "CAM-007", "Name": "Audit Camera"}],
        "idempotency_key": "audit-file-1",
        "created_by": "importer-1",
    }
    created = client.post(f"/api/v1/projects/{project_id}/file-imports", json=request).json()
    approve_headers = {"X-Actor": "approver-1", "X-Role": "Approver"}
    approved = client.post(
        f"/api/v1/projects/{project_id}/file-imports/{created['changeset']['id']}/approve",
        json={"approved_by": "approver-1"},
        headers=approve_headers,
    )
    assert approved.status_code == 200

    viewer = client.get(
        f"/api/v1/projects/{project_id}/audit?actor=importer-1",
        headers={"X-Actor": "viewer-1", "X-Role": "Viewer"},
    )
    assert viewer.status_code == 200
    events = viewer.json()
    assert events
    assert all(event["project_id"] == project_id for event in events)
    submitted = next(event for event in events if event["event_type"] == "FileImportSubmitted")
    assert submitted["actor"] == "importer-1"

    all_events = client.get(
        f"/api/v1/projects/{project_id}/audit",
        headers={"X-Actor": "viewer-1", "X-Role": "Viewer"},
    ).json()
    applied = next(event for event in all_events if event["event_type"] == "FileImportApplied")
    assert applied["correlation_id"] == submitted["correlation_id"]
    assert applied["causation_id"] == submitted["event_id"]
    assert any(change["field"] == "name" for change in applied["field_changes"])

    forbidden = client.get(
        f"/api/v1/projects/{project_id}/audit/export",
        headers={"X-Actor": "viewer-1", "X-Role": "Viewer"},
    )
    assert forbidden.status_code == 403
    exported = client.get(
        f"/api/v1/projects/{project_id}/audit/export?format=csv",
        headers={"X-Actor": "engineer-1", "X-Role": "ProjectEngineer"},
    )
    assert exported.status_code == 200
    assert "FileImportApplied" in exported.text
