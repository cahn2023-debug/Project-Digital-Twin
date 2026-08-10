import base64
import hashlib
from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.main import app, store


def setup_function() -> None:
    store.__init__()


def create_project(client: TestClient, tmp_path) -> dict:
    root = tmp_path / "desktop-import-project"
    root.mkdir()
    response = client.post(
        "/api/v1/projects",
        json={"name": "Desktop Import", "root_path": str(root)},
    )
    assert response.status_code == 201, response.text
    return response.json()


def xlsx_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "CAMERA"
    sheet.append(["CameraCode", "Name"])
    sheet.append(["CAM-RAW", "Fallback camera"])
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_normalized_desktop_import_never_requires_source_path_and_is_idempotent(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path)["id"]
    request = {
        "file_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "file_revision": 1,
        "idempotency_key": "desktop-normalized-1",
        "format": "CSV",
        "source_hash": "a" * 64,
        "parser_version": "desktop-parser-v1",
        "profile_id": "camera-csv",
        "profile_version": 1,
        "parsed_at": 1,
        "records": [{
            "fields": {"code": "CAM-LOCAL", "name": "Local camera"},
            "unmapped": {"extra": "preserve"},
            "source": {"sheet": "CSV", "row": 2, "column": "A"},
        }],
        "parse_report": {"valid_records": 1, "invalid_records": 0},
    }
    first = client.post(f"/api/v1/projects/{project_id}/desktop-imports/normalized", json=request)
    duplicate = client.post(f"/api/v1/projects/{project_id}/desktop-imports/normalized", json=request)

    assert first.status_code == 202, first.text
    assert first.json()["status"] == "NORMALIZED_ACCEPTED"
    assert first.json()["raw_deleted"] is True
    assert duplicate.json()["changeset"]["id"] == first.json()["changeset"]["id"]
    assert len(store.changesets) == 1
    assert store.changesets[next(iter(store.changesets))].raw_rows[0]["extra"] == "preserve"


def test_raw_fallback_returns_server_parsed_and_deletes_temporary_raw(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path)["id"]
    payload = xlsx_bytes()
    source_hash = hashlib.sha256(payload).hexdigest()
    request = {
        "file_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "file_revision": 1,
        "idempotency_key": "desktop-raw-1",
        "format": "XLSX",
        "filename": "cameras.xlsx",
        "source_hash": source_hash,
        "content_base64": base64.b64encode(payload).decode("ascii"),
        "fallback_reason": "desktop parser unavailable",
        "parse_report": {"issues": [{"code": "PARSER_FAILED"}]},
    }
    response = client.post(f"/api/v1/projects/{project_id}/desktop-imports/raw-fallback", json=request)

    assert response.status_code == 202, response.text
    assert response.json()["status"] == "SERVER_PARSED"
    assert response.json()["raw_deleted"] is True
    assert response.json()["changeset"]["raw_rows"] == [{"CameraCode": "CAM-RAW", "Name": "Fallback camera"}]


def test_raw_fallback_metadata_mismatch_is_staged_for_review(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path)["id"]
    payload = xlsx_bytes()
    source_hash = hashlib.sha256(payload).hexdigest()
    response = client.post(
        f"/api/v1/projects/{project_id}/desktop-imports/raw-fallback",
        json={
            "file_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "file_revision": 1,
            "idempotency_key": "desktop-raw-profile-mismatch",
            "format": "XLSX",
            "filename": "cameras.xlsx",
            "source_hash": source_hash,
            "content_base64": base64.b64encode(payload).decode("ascii"),
            "fallback_reason": "desktop parser unavailable",
            "expected_profile_id": "desktop-camera-v2",
        },
    )

    assert response.status_code == 202, response.text
    assert response.json()["status"] == "CONFLICT_REVIEW"
    assert response.json()["changeset"]["status"] == "CONFLICT_REVIEW"
    assert response.json()["changeset"]["conflicts"][0]["field"] == "profile_id"
    assert store.cameras == {}


def test_raw_fallback_hash_mismatch_is_conflict_review_without_canonical_change(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path)["id"]
    payload = xlsx_bytes()
    response = client.post(
        f"/api/v1/projects/{project_id}/desktop-imports/raw-fallback",
        json={
            "file_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
            "file_revision": 1,
            "idempotency_key": "desktop-raw-mismatch",
            "format": "XLSX",
            "filename": "cameras.xlsx",
            "source_hash": "d" * 64,
            "content_base64": base64.b64encode(payload).decode("ascii"),
            "fallback_reason": "desktop parser failed",
        },
    )

    assert response.status_code == 202
    assert response.json()["status"] == "CONFLICT_REVIEW"
    assert response.json()["raw_deleted"] is True
    assert response.json()["changeset"] is None
    assert store.cameras == {}


def test_normalized_document_import_creates_read_only_changeset(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path)["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/desktop-imports/normalized",
        json={
            "file_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
            "file_revision": 2,
            "idempotency_key": "desktop-document-1",
            "format": "MARKDOWN",
            "source_hash": "e" * 64,
            "parser_version": "desktop-parser-v1",
            "profile_id": "document-default",
            "profile_version": 1,
            "parsed_at": 1,
            "records": [{
                "fields": {"section": "Notes", "content": "CAM-001 is online"},
                "unmapped": {},
                "source": {"sheet": "DOCUMENT", "line": 2},
            }],
        },
    )

    assert response.status_code == 202, response.text
    assert response.json()["status"] == "NORMALIZED_ACCEPTED"
    assert response.json()["changeset"]["representation"] == "DOCUMENT"
    assert response.json()["changeset"]["raw_rows"][0]["text"] == "CAM-001 is online"


def test_changeset_review_edits_are_audited_and_approval_is_explicit(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path)["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/desktop-imports/normalized",
        json={
            "file_id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
            "file_revision": 1,
            "idempotency_key": "desktop-review-1",
            "format": "CSV",
            "source_hash": "f" * 64,
            "parser_version": "desktop-parser-v1",
            "profile_id": "camera-csv",
            "profile_version": 1,
            "parsed_at": 1,
            "records": [{
                "identity": "record-stable-1",
                "fields": {"code": "CAM-REVIEW", "name": "Before"},
                "raw": {"Code": "CAM-REVIEW", "Name": "Before"},
                "source": {"sheet": "CSV", "row": 2, "column": "A"},
            }],
        },
    )
    assert response.status_code == 202, response.text
    changeset_id = response.json()["changeset"]["id"]
    assert response.json()["changeset"]["items"][0]["record_identity"] == "record-stable-1"

    edited = client.post(
        f"/api/v1/projects/{project_id}/file-imports/{changeset_id}/edit",
        json={"record_identity": "record-stable-1", "field": "name", "value": "After", "edited_by": "reviewer"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["changeset"]["items"][0]["patch"]["name"] == "After"
    assert store.cameras == {}

    approved = client.post(
        f"/api/v1/projects/{project_id}/file-imports/{changeset_id}/approve",
        json={"approved_by": "approver"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["changeset"]["status"] == "APPLIED"
    assert next(iter(store.cameras.values())).name == "After"
    audit = client.get(f"/api/v1/projects/{project_id}/audit?changeset_id={changeset_id}")
    assert audit.status_code == 200, audit.text
    assert any(event["operation"] == "FileImportNormalizedValueEdited" for event in audit.json())


def test_asset_sync_is_idempotent_and_conflicts_without_overwrite(tmp_path) -> None:
    client = TestClient(app)
    project_id = create_project(client, tmp_path)["id"]
    asset = {
        "asset_id": "asset-local-1",
        "asset_version": 1,
        "source_hash": "1" * 64,
        "source_path": "C:/Data/plan.png",
        "source_locator": {"line": 3},
        "payload": {"name": "plan.png", "bytes": 10},
    }
    first = client.post(
        f"/api/v1/projects/{project_id}/file-assets/sync",
        json={"idempotency_key": "asset-sync-1", "assets": [asset]},
    )
    duplicate = client.post(
        f"/api/v1/projects/{project_id}/file-assets/sync",
        json={"idempotency_key": "asset-sync-1", "assets": [asset]},
    )
    conflict = client.post(
        f"/api/v1/projects/{project_id}/file-assets/sync",
        json={"idempotency_key": "asset-sync-2", "assets": [{**asset, "payload": {"name": "changed.png"}}]},
    )

    assert first.status_code == 202, first.text
    assert first.json()["inserted"] == [{"asset_id": "asset-local-1", "asset_version": 1}]
    assert duplicate.json()["unchanged"] == [{"asset_id": "asset-local-1", "asset_version": 1}]
    assert conflict.json()["conflicts"][0]["asset_id"] == "asset-local-1"
    assert len(store.file_asset_payloads) == 1
