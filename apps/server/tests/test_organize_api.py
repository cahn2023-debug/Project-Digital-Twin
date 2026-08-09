from hashlib import sha256
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient

from app.domain import Camera, SourceLocator
from app.main import app, store


def setup_function() -> None:
    store.projects.clear()
    store.project_roots.clear()
    store.cameras.clear()
    store.camera_codes.clear()
    store.revisions.clear()
    store.changesets.clear()
    store.file_import_results.clear()
    store.audit_events.clear()
    store.outbox.clear()
    store.file_versions.clear()
    store.write_jobs.clear()
    store.writeback_plans.clear()
    store.file_locks.clear()
    store.source_assets.clear()
    store.self_write_hashes.clear()
    store.organize_groups.clear()
    store.organize_tags.clear()
    store.organize_group_parents.clear()
    store.organize_group_memberships.clear()
    store.organize_tag_memberships.clear()
    store.organize_item_lifecycle.clear()
    store._correlation_by_aggregate.clear()
    store._last_event_by_aggregate.clear()
    store._idempotency.clear()
    store._changeset_idempotency.clear()
    store._file_import_idempotency.clear()


def create_project(client: TestClient, tmp_path) -> dict:
    root = tmp_path / "organize-api"
    root.mkdir()
    response = client.post("/api/v1/projects", json={"name": "Organize API", "root_path": str(root)})
    assert response.status_code == 201, response.text
    return response.json()


def editor_headers() -> dict[str, str]:
    return {"X-Actor": "organize-editor", "X-Role": "ProjectEngineer"}


def test_snapshot_unifies_canonical_source_and_import_records_with_filters(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    project_id = UUID(project["id"])
    file_id = UUID("11111111-1111-1111-1111-111111111111")
    camera_id = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    store.cameras[camera_id] = Camera(
        entity_id=camera_id,
        project_id=project_id,
        code="CAM-001",
        name="Main Camera",
        source=SourceLocator(file_id, 2, "CAMERA", 3, "A"),
    )

    created_group = client.post(
        f"/api/v1/projects/{project['id']}/organize/groups",
        json={"name": "Infrastructure"},
        headers=editor_headers(),
    )
    assert created_group.status_code == 201, created_group.text
    group_id = created_group.json()["id"]
    created_tag = client.post(
        f"/api/v1/projects/{project['id']}/organize/tags",
        json={"name": "priority"},
        headers=editor_headers(),
    )
    assert created_tag.status_code == 201, created_tag.text

    membership = client.post(
        f"/api/v1/projects/{project['id']}/organize/memberships",
        json={
            "item_type": "ENTITY",
            "item_ids": [str(camera_id)],
            "group_ids": [group_id],
            "tag_ids": [created_tag.json()["id"]],
        },
        headers=editor_headers(),
    )
    assert membership.status_code == 200, membership.text

    imported = client.post(
        f"/api/v1/projects/{project['id']}/file-imports",
        json={
            "rows": [{"CameraCode": "CAM-002", "Name": "Field Camera"}],
            "file_id": "22222222-2222-2222-2222-222222222222",
            "file_revision": 1,
            "idempotency_key": "organize-import-1",
            "source_hash": "a" * 64,
        },
    )
    assert imported.status_code == 202, imported.text

    snapshot = client.get(f"/api/v1/projects/{project['id']}/organize", headers={"X-Role": "Viewer"})
    assert snapshot.status_code == 200, snapshot.text
    items = snapshot.json()["items"]
    assert {item["type"] for item in items} == {"ENTITY", "SOURCE_FILE", "IMPORT"}
    camera_item = next(item for item in items if item["type"] == "ENTITY")
    assert camera_item["source"]["file_id"] == str(file_id)
    assert group_id in camera_item["group_ids"]

    filtered = client.get(
        f"/api/v1/projects/{project['id']}/organize?group_id={group_id}",
        headers={"X-Role": "Viewer"},
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["items"]] == [str(camera_id)]

    audit = client.get(
        f"/api/v1/projects/{project['id']}/audit?actor=organize-editor",
        headers={"X-Role": "Viewer"},
    )
    assert audit.status_code == 200
    membership_events = [event for event in audit.json() if event["event_type"] == "OrganizeMembershipChanged"]
    assert membership_events
    assert membership_events[-1]["field_changes"]
    assert membership_events[-1]["correlation_id"]


def test_organize_mutations_require_editor_and_lifecycle_is_reversible(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    unauthorized = client.post(
        f"/api/v1/projects/{project['id']}/organize/groups",
        json={"name": "Blocked"},
        headers={"X-Actor": "viewer", "X-Role": "Viewer"},
    )
    assert unauthorized.status_code == 403

    created = client.post(
        f"/api/v1/projects/{project['id']}/organize/groups",
        json={"name": "Managed"},
        headers=editor_headers(),
    )
    item_id = "33333333-3333-3333-3333-333333333333"
    lifecycle = client.post(
        f"/api/v1/projects/{project['id']}/organize/lifecycle",
        json={"item_type": "SOURCE_FILE", "item_ids": [item_id], "status": "DELETED"},
        headers=editor_headers(),
    )
    assert created.status_code == 201
    assert lifecycle.status_code == 200, lifecycle.text
    assert lifecycle.json()["lifecycle"][0]["status"] == "DELETED"

    restored = client.post(
        f"/api/v1/projects/{project['id']}/organize/lifecycle",
        json={"item_type": "SOURCE_FILE", "item_ids": [item_id], "status": "ACTIVE"},
        headers=editor_headers(),
    )
    assert restored.status_code == 200
    assert restored.json()["lifecycle"][0]["status"] == "ACTIVE"


def test_excel_writeback_preview_supports_destination_modes_and_never_writes(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    project_id = UUID(project["id"])
    file_id = UUID("44444444-4444-4444-4444-444444444444")
    camera_id = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    store.cameras[camera_id] = Camera(
        entity_id=camera_id,
        project_id=project_id,
        code="CAM-004",
        name="Preview Camera",
        source=SourceLocator(file_id, 1, "CAMERA", 4, "A"),
    )
    store.register_file_version(project_id, file_id, "b" * 64, 128, "importer", "FILE_IMPORT", "source.xlsx")

    preview = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "item_type": "ENTITY",
            "item_ids": [str(camera_id)],
            "destination_mode": "IN_PLACE",
            "batch_strategy": "PER_FILE",
            "expected_file_revisions": {str(file_id): 1},
            "expected_file_hashes": {str(file_id): "b" * 64},
        },
        headers=editor_headers(),
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["format"] == "EXCEL"
    assert body["confirmation_required"] is True
    assert body["can_confirm"] is True
    assert body["write_performed"] is False
    assert body["files"][0]["destination_path"] == "source.xlsx"
    assert {change["kind"] for change in body["files"][0]["changes"]} == {"METADATA", "CONTENT"}
    assert store.write_jobs == {}
    assert len(store.file_versions[file_id]) == 1

    new_file = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "item_type": "ENTITY",
            "item_ids": [str(camera_id)],
            "file_ids": [str(file_id)],
            "destination_mode": "NEW_FILE",
            "batch_strategy": "ALL_OR_NOTHING",
            "destination_paths": {str(file_id): "organized.xlsx"},
            "expected_file_revisions": {str(file_id): 1},
            "expected_file_hashes": {str(file_id): "b" * 64},
        },
        headers=editor_headers(),
    )
    assert new_file.status_code == 200
    assert new_file.json()["destination_mode"] == "NEW_FILE"
    assert new_file.json()["batch_strategy"] == "ALL_OR_NOTHING"
    assert new_file.json()["files"][0]["destination_path"] == "organized.xlsx"


def test_excel_writeback_preview_blocks_stale_or_unsupported_targets(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    project_id = UUID(project["id"])
    file_id = UUID("55555555-5555-5555-5555-555555555555")
    camera_id = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
    store.cameras[camera_id] = Camera(
        entity_id=camera_id,
        project_id=project_id,
        code="CAM-005",
        source=SourceLocator(file_id, 2, "CAMERA", 5, "A"),
    )
    store.register_file_version(project_id, file_id, "d" * 64, 128, "importer", "FILE_IMPORT", "source.xlsx")

    response = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "item_type": "ENTITY",
            "item_ids": [str(camera_id)],
            "file_ids": [str(file_id)],
            "destination_mode": "NEW_FILE",
            "destination_paths": {str(file_id): "organized.txt"},
            "expected_file_revisions": {str(file_id): 2},
            "expected_file_hashes": {str(file_id): "e" * 64},
        },
        headers=editor_headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["can_confirm"] is False
    assert {"STALE_SOURCE_REVISION", "STALE_SOURCE_HASH", "UNSUPPORTED_FORMAT_DESTINATION"}.issubset(body["warnings"])
    assert body["files"][0]["blocked"] is True

    unauthorized = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={"item_type": "ENTITY", "item_ids": [str(camera_id)]},
        headers={"X-Actor": "viewer", "X-Role": "Viewer"},
    )
    assert unauthorized.status_code == 403


def test_document_writeback_adapters_detect_structure_and_require_mapping_for_ambiguous_text(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    project_id = UUID(project["id"])

    markdown_path = tmp_path / "source.md"
    markdown_path.write_text("# Camera group\n\nOwner: Team A\n", encoding="utf-8")
    markdown_file_id = UUID("66666666-6666-6666-6666-666666666666")
    markdown_camera_id = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    store.cameras[markdown_camera_id] = Camera(
        entity_id=markdown_camera_id,
        project_id=project_id,
        code="CAM-006",
        source=SourceLocator(markdown_file_id, 1, "document", 1, "A"),
    )
    markdown_hash = sha256(markdown_path.read_bytes()).hexdigest()
    store.register_file_version(project_id, markdown_file_id, markdown_hash, markdown_path.stat().st_size, "importer", "DOCUMENT_IMPORT", str(markdown_path))

    markdown_preview = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "format": "MARKDOWN",
            "item_type": "ENTITY",
            "item_ids": [str(markdown_camera_id)],
            "destination_mode": "NEW_FILE",
            "destination_paths": {str(markdown_file_id): "organized.md"},
            "expected_file_revisions": {str(markdown_file_id): 1},
            "expected_file_hashes": {str(markdown_file_id): markdown_hash},
        },
        headers=editor_headers(),
    )
    assert markdown_preview.status_code == 200, markdown_preview.text
    markdown_body = markdown_preview.json()
    assert markdown_body["format"] == "MARKDOWN"
    assert markdown_body["files"][0]["adapter"] == "markdown"
    assert markdown_body["files"][0]["structure_detected"] is True
    assert markdown_body["files"][0]["manual_mapping_required"] is False
    assert markdown_body["can_confirm"] is True

    text_path = tmp_path / "ambiguous.txt"
    text_path.write_text("first unmanaged paragraph\nsecond unmanaged paragraph\n", encoding="utf-8")
    text_file_id = UUID("77777777-7777-7777-7777-777777777777")
    text_camera_id = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
    store.cameras[text_camera_id] = Camera(
        entity_id=text_camera_id,
        project_id=project_id,
        code="CAM-007",
        source=SourceLocator(text_file_id, 1, "text", 1, "A"),
    )
    text_hash = sha256(text_path.read_bytes()).hexdigest()
    store.register_file_version(project_id, text_file_id, text_hash, text_path.stat().st_size, "importer", "DOCUMENT_IMPORT", str(text_path))

    ambiguous = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "format": "TXT",
            "item_type": "ENTITY",
            "item_ids": [str(text_camera_id)],
            "destination_mode": "NEW_FILE",
            "destination_paths": {str(text_file_id): "organized.txt"},
            "expected_file_revisions": {str(text_file_id): 1},
            "expected_file_hashes": {str(text_file_id): text_hash},
        },
        headers=editor_headers(),
    )
    assert ambiguous.status_code == 200
    ambiguous_body = ambiguous.json()
    assert "MANUAL_MAPPING_REQUIRED" in ambiguous_body["warnings"]
    assert ambiguous_body["files"][0]["manual_mapping_required"] is True
    assert ambiguous_body["can_confirm"] is False

    mapped = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "format": "TXT",
            "item_type": "ENTITY",
            "item_ids": [str(text_camera_id)],
            "destination_mode": "NEW_FILE",
            "destination_paths": {str(text_file_id): "organized.txt"},
            "expected_file_revisions": {str(text_file_id): 1},
            "expected_file_hashes": {str(text_file_id): text_hash},
            "manual_mapping": {str(text_file_id): {"record_boundary": "paragraph"}},
        },
        headers=editor_headers(),
    )
    assert mapped.status_code == 200
    assert mapped.json()["files"][0]["mapping_status"] == "MANUAL"
    assert mapped.json()["files"][0]["manual_mapping_required"] is False
    assert mapped.json()["can_confirm"] is True


def test_word_writeback_adapter_preserves_unmanaged_document_structure(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    project_id = UUID(project["id"])
    word_path = tmp_path / "source.docx"
    document_xml = """<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Camera group</w:t></w:r></w:p><w:p><w:r><w:t>Unmanaged note</w:t></w:r></w:p><w:sectPr/></w:body></w:document>"""
    with ZipFile(word_path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", document_xml)
    file_id = UUID("88888888-8888-8888-8888-888888888888")
    camera_id = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
    store.cameras[camera_id] = Camera(
        entity_id=camera_id,
        project_id=project_id,
        code="CAM-008",
        source=SourceLocator(file_id, 1, "word", 1, "A"),
    )
    file_hash = sha256(word_path.read_bytes()).hexdigest()
    store.register_file_version(project_id, file_id, file_hash, word_path.stat().st_size, "importer", "DOCUMENT_IMPORT", str(word_path))

    response = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "format": "WORD",
            "item_type": "ENTITY",
            "item_ids": [str(camera_id)],
            "destination_mode": "NEW_FILE",
            "destination_paths": {str(file_id): "organized.docx"},
            "expected_file_revisions": {str(file_id): 1},
            "expected_file_hashes": {str(file_id): file_hash},
        },
        headers=editor_headers(),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["files"][0]["adapter"] == "word"
    assert body["files"][0]["structure_detected"] is True
    assert body["files"][0]["source_summary"]["unmanaged_content"] == "preserved"
    assert body["write_performed"] is False


def test_confirmed_writeback_rechecks_safety_releases_lock_and_suppresses_self_import(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    project_id = UUID(project["id"])
    source_path = tmp_path / "source.xlsx"
    source_path.write_bytes(b"source-before-write")
    file_id = UUID("99999999-9999-9999-9999-999999999999")
    camera_id = UUID("abababab-abab-abab-abab-abababababab")
    store.cameras[camera_id] = Camera(
        entity_id=camera_id,
        project_id=project_id,
        code="CAM-009",
        source=SourceLocator(file_id, 1, "CAMERA", 9, "A"),
    )
    source_hash = sha256(source_path.read_bytes()).hexdigest()
    store.register_file_version(project_id, file_id, source_hash, source_path.stat().st_size, "importer", "FILE_IMPORT", str(source_path))

    preview = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "item_type": "ENTITY",
            "item_ids": [str(camera_id)],
            "destination_mode": "IN_PLACE",
            "expected_file_revisions": {str(file_id): 1},
            "expected_file_hashes": {str(file_id): source_hash},
        },
        headers=editor_headers(),
    ).json()
    plan_id = preview["id"]
    not_confirmed = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/execute",
        json={"plan_id": plan_id, "confirmed": False},
        headers=editor_headers(),
    )
    assert not_confirmed.status_code == 422

    unauthorized = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/execute",
        json={"plan_id": plan_id, "confirmed": True},
        headers={"X-Actor": "viewer", "X-Role": "Viewer"},
    )
    assert unauthorized.status_code == 403

    queued = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/execute",
        json={"plan_id": plan_id, "confirmed": True},
        headers=editor_headers(),
    )
    assert queued.status_code == 202, queued.text
    job = queued.json()["jobs"][0]
    assert job["confirmed"] is True
    assert job["safety_enforced"] is True
    assert UUID(job["file_id"]) in store.file_locks

    duplicate = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/execute",
        json={"plan_id": plan_id, "confirmed": True},
        headers=editor_headers(),
    )
    assert duplicate.status_code == 409

    result_hash = "f" * 64
    completed = client.post(
        f"/api/v1/projects/{project['id']}/file-write-jobs/{job['id']}/complete",
        json={"source_hash": source_hash, "result_hash": result_hash, "size": 22, "actor": "write-worker", "backup_path": str(source_path) + ".bak"},
    )
    assert completed.status_code == 200, completed.text
    assert UUID(job["file_id"]) not in store.file_locks
    assert store.is_self_write(file_id, result_hash)

    suppressed = client.post(
        f"/api/v1/projects/{project['id']}/file-imports",
        json={
            "rows": [{"CameraCode": "CAM-009", "Name": "Duplicate"}],
            "file_id": str(file_id),
            "file_revision": 2,
            "idempotency_key": "self-write-suppressed-1",
            "source_hash": result_hash,
        },
    )
    assert suppressed.status_code == 202
    assert suppressed.json()["suppressed"] is True
    assert suppressed.json()["changeset"] is None
    audit = client.get(f"/api/v1/projects/{project['id']}/audit").json()
    audit_types = {event["event_type"] for event in audit}
    assert {"FileWriteBackPreviewCreated", "FileWriteBackConfirmed", "FileWriteApplied", "SelfWriteSuppressed"}.issubset(audit_types)
    traced = [event for event in audit if event["event_type"] in audit_types]
    assert all(event["correlation_id"] and event["field_changes"] is not None for event in traced)
    assert any(event["event_type"] == "SelfWriteSuppressed" and event["file_id"] == str(file_id) for event in audit)


def test_all_or_nothing_execute_blocks_before_creating_any_job_when_one_file_is_locked(tmp_path) -> None:
    client = TestClient(app)
    project = create_project(client, tmp_path)
    project_id = UUID(project["id"])
    file_ids = [UUID("aaaaaaaa-1111-1111-1111-111111111111"), UUID("bbbbbbbb-2222-2222-2222-222222222222")]
    item_ids = [UUID("12121212-1212-1212-1212-121212121212"), UUID("34343434-3434-3434-3434-343434343434")]
    hashes = {}
    for index, (file_id, item_id) in enumerate(zip(file_ids, item_ids), start=1):
        path = tmp_path / f"source-{index}.xlsx"
        path.write_bytes(f"source-{index}".encode())
        file_hash = sha256(path.read_bytes()).hexdigest()
        hashes[str(file_id)] = file_hash
        store.cameras[item_id] = Camera(entity_id=item_id, project_id=project_id, code=f"CAM-{index + 10:03d}", source=SourceLocator(file_id, 1, "CAMERA", index, "A"))
        store.register_file_version(project_id, file_id, file_hash, path.stat().st_size, "importer", "FILE_IMPORT", str(path))

    preview = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/preview",
        json={
            "item_type": "ENTITY",
            "item_ids": [str(item_id) for item_id in item_ids],
            "file_ids": [str(file_id) for file_id in file_ids],
            "destination_mode": "NEW_FILE",
            "batch_strategy": "ALL_OR_NOTHING",
            "destination_paths": {str(file_ids[0]): "one.xlsx", str(file_ids[1]): "two.xlsx"},
            "expected_file_revisions": {str(file_id): 1 for file_id in file_ids},
            "expected_file_hashes": hashes,
        },
        headers=editor_headers(),
    ).json()
    store.file_locks[file_ids[1]] = UUID("eeeeeeee-1111-1111-1111-111111111111")
    response = client.post(
        f"/api/v1/projects/{project['id']}/organize/write-back/execute",
        json={"plan_id": preview["id"], "confirmed": True},
        headers=editor_headers(),
    )
    assert response.status_code == 409
    assert store.write_jobs == {}
    assert store.writeback_plans[UUID(preview["id"])].status == "CONFLICT"
