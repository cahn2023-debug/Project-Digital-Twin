from fastapi.testclient import TestClient

from app.main import app, store


def setup_function() -> None:
    store.projects.clear()
    store.cameras.clear()
    store.camera_codes.clear()
    store.revisions.clear()
    store.contractors.clear()
    store.work_packages.clear()
    store.field_packages.clear()
    store.observations.clear()
    store.changesets.clear()
    store.outbox.clear()
    store.write_jobs.clear()
    store._idempotency.clear()


def test_import_and_geometry_revision_flow() -> None:
    client = TestClient(app)
    project_response = client.post("/api/v1/projects", json={"code": "P-001", "name": "Pilot"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

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


def test_assignment_field_sync_approval_dashboard_and_write_job() -> None:
    client = TestClient(app)
    project = client.post("/api/v1/projects", json={"code": "P-002", "name": "Field Pilot"}).json()
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
