from __future__ import annotations

import csv
import io
import json
from time import perf_counter
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response

from ... import main as main_module
from ...authorization import Role
from ...domain import (
    FileImportConflict,
    FileWriteConflict,
    OrganizeConflictError,
    OrganizeValidationError,
    ProjectConflictError,
    ProjectValidationError,
    RevisionConflict,
    normalize_coordinate,
)
from ...adapters.files.importers.documents import parse_document
from ...adapters.files.importers.excel import parse_camera_rows

from ...main import (
    ApprovalRequest,
    ContractorCreate,
    DocumentImportRequest,
    FileImportRequest,
    FieldPackageCreate,
    GeometryRequest,
    ImportRequest,
    OrganizeGroupCreate,
    OrganizeGroupPatch,
    OrganizeLifecycleRequest,
    OrganizeMembershipRequest,
    OrganizeTagCreate,
    OrganizeWriteBackExecuteRequest,
    OrganizeWriteBackPreviewRequest,
    ObservationCreate,
    ProjectCreate,
    ProjectDelete,
    RestoreJobCreate,
    WorkPackageCreate,
    WriteJobComplete,
    WriteJobCreate,
    WriteJobFailureRequest,
)


router = APIRouter()


class _StoreProxy:
    def __getattr__(self, name: str) -> Any:
        return getattr(main_module.store, name)


store = _StoreProxy()


def _authorize_header(project_id: UUID, action: str, actor: str, role: str) -> None:
    main_module._authorize_header(project_id, action, actor, role)


def _organize_group_state(group: Any) -> dict[str, Any]:
    return main_module._organize_group_state(group)


def _organize_membership_state(project_id: UUID, item_type: str, item_ids: list[UUID]) -> dict[str, list[str]]:
    return main_module._organize_membership_state(project_id, item_type, item_ids)


@router.get("/api/v1/projects/{project_id}/cameras")
def list_cameras(project_id: UUID) -> list[dict[str, Any]]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return [camera.__dict__ for camera in store.list_cameras(project_id)]


@router.post("/api/v1/projects/{project_id}/cameras/import")
def import_cameras(project_id: UUID, request: ImportRequest) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if request.source_hash and store.is_self_write(request.file_id, request.source_hash):
        store.record_self_write_suppression(project_id, request.file_id, request.source_hash, request.created_by)
        return {"inserted": [], "changed": [], "unchanged": [], "invalid": [], "conflict": [], "unmapped": [], "suppressed": True}
    cameras, issues = parse_camera_rows(
        request.rows,
        file_id=request.file_id,
        file_revision=request.file_revision,
        sheet=request.sheet,
    )
    result = {"inserted": [], "changed": [], "unchanged": [], "invalid": issues, "conflict": [], "unmapped": []}
    for camera in cameras:
        camera.project_id = project_id
        category = store.import_camera(project_id, camera, request.created_by)
        result[category].append(camera)
    return result


@router.post("/api/v1/projects/{project_id}/file-imports", status_code=202)
def create_file_import_changeset(project_id: UUID, request: FileImportRequest) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if request.source_hash and store.is_self_write(request.file_id, request.source_hash):
        store.record_self_write_suppression(project_id, request.file_id, request.source_hash, request.created_by)
        return jsonable_encoder({
            "changeset": None,
            "result": {"inserted": [], "changed": [], "unchanged": [], "invalid": [], "conflict": [], "unmapped": []},
            "notice": "Self-write suppressed; no duplicate import was enqueued.",
            "suppressed": True,
            "processing_duration_ms": 0,
        })
    started_at = perf_counter()
    cameras, issues = parse_camera_rows(
        request.rows,
        file_id=request.file_id,
        file_revision=request.file_revision,
        sheet=request.sheet,
    )
    changeset, result = store.create_file_import_changeset(
        project_id,
        request.file_id,
        request.file_revision,
        cameras,
        issues,
        request.rows,
        request.created_by,
        request.idempotency_key,
        request.source_hash,
        round((perf_counter() - started_at) * 1000),
    )
    return jsonable_encoder({
        "changeset": changeset,
        "result": result,
        "notice": "Unmapped and invalid source values are retained in Raw.",
        "processing_duration_ms": round((perf_counter() - started_at) * 1000),
    })


@router.post("/api/v1/projects/{project_id}/document-imports", status_code=202)
def create_document_import_changeset(project_id: UUID, request: DocumentImportRequest) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        started_at = perf_counter()
        parsed = parse_document(
            request.path,
            file_id=request.file_id,
            file_revision=request.file_revision,
            canonical_entities=request.canonical_entities,
        )
        duration_ms = round((perf_counter() - started_at) * 1000)
        changeset = store.create_document_import_changeset(project_id, parsed, request.created_by, duration_ms)
        return jsonable_encoder({
            "changeset": changeset,
            "notice": "Document source is read-only; relationship proposals require confirmation before canonical apply.",
            "processing_duration_ms": duration_ms,
        })
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Document source not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/v1/projects/{project_id}/audit")
def query_audit(
    project_id: UUID,
    file_id: UUID | None = None,
    object_id: UUID | None = None,
    actor: str | None = None,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    profile_id: str | None = None,
    changeset_id: UUID | None = None,
    status: str | None = None,
    x_actor: str = Header(default="audit-viewer"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> list[dict[str, Any]]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    _authorize_header(project_id, "audit.view", x_actor, x_role)
    return jsonable_encoder(store.query_audit(
        project_id,
        file_id=file_id,
        object_id=object_id,
        actor=actor,
        from_time=from_time,
        to_time=to_time,
        profile_id=profile_id,
        changeset_id=changeset_id,
        status=status,
    ))


@router.get("/api/v1/projects/{project_id}/audit/export")
def export_audit(
    project_id: UUID,
    format: str = "csv",
    file_id: UUID | None = None,
    object_id: UUID | None = None,
    actor: str | None = None,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    profile_id: str | None = None,
    changeset_id: UUID | None = None,
    status: str | None = None,
    x_actor: str = Header(default="audit-exporter"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> Response:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    _authorize_header(project_id, "audit.export", x_actor, x_role)
    rows = jsonable_encoder(store.query_audit(
        project_id,
        file_id=file_id,
        object_id=object_id,
        actor=actor,
        from_time=from_time,
        to_time=to_time,
        profile_id=profile_id,
        changeset_id=changeset_id,
        status=status,
    ))
    if format.casefold() == "json":
        return Response(json.dumps(rows, ensure_ascii=False), media_type="application/json")
    if format.casefold() != "csv":
        raise HTTPException(status_code=400, detail="format must be csv or json")
    output = io.StringIO()
    fields = [
        "id", "project_id", "event_id", "event_type", "operation", "actor", "occurred_at",
        "file_id", "object_id", "profile_id", "changeset_id", "status", "correlation_id",
        "causation_id", "field_changes", "duration_ms",
    ]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        row["field_changes"] = json.dumps(row["field_changes"], ensure_ascii=False)
        writer.writerow({field: row.get(field) for field in fields})
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit.csv"},
    )


@router.post("/api/v1/projects/{project_id}/file-imports/{changeset_id}/approve")
def approve_file_import_changeset(
    project_id: UUID,
    changeset_id: UUID,
    request: ApprovalRequest,
    x_actor: str = Header(default="changeset-approver"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "changeset.approve", x_actor, x_role)
    try:
        changeset, revisions = store.approve_file_import_changeset(project_id, changeset_id, request.approved_by)
        return jsonable_encoder({"changeset": changeset, "revisions": revisions})
    except FileImportConflict as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "CONFLICT", "changeset_id": str(exc.changeset_id), "conflicts": exc.conflicts},
        ) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/file-write-jobs", status_code=202)
def create_file_write_job(project_id: UUID, request: WriteJobCreate) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return jsonable_encoder(store.create_write_job(
        project_id,
        request.file_id,
        request.expected_file_revision,
        request.entity_revision,
        request.expected_file_hash,
        request.source_path,
    ))


@router.post("/api/v1/projects/{project_id}/file-write-jobs/{job_id}/complete")
def complete_file_write_job(
    project_id: UUID,
    job_id: UUID,
    request: WriteJobComplete,
    x_actor: str = Header(default="write-worker"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    try:
        job = store.write_jobs.get(job_id)
        if job is not None and job.operation == "RESTORE":
            _authorize_header(project_id, "file.restore", x_actor, x_role)
        return jsonable_encoder(store.complete_write_job(
            project_id,
            job_id,
            request.source_hash,
            request.result_hash,
            request.size,
            request.actor,
            request.backup_path,
        ))
    except FileWriteConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/file-write-jobs/{job_id}/fail")
def fail_file_write_job(
    project_id: UUID,
    job_id: UUID,
    request: WriteJobFailureRequest,
    x_actor: str = Header(default="write-worker"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    try:
        job = store.write_jobs.get(job_id)
        if job is not None and job.operation == "RESTORE":
            _authorize_header(project_id, "file.restore", x_actor, x_role)
        return jsonable_encoder(store.fail_write_job(project_id, job_id, x_actor, request.reason))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/file-restore-jobs", status_code=202)
def create_file_restore_job(
    project_id: UUID,
    request: RestoreJobCreate,
    x_actor: str = Header(default="restore-user"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "file.restore", x_actor, x_role)
    try:
        return jsonable_encoder(store.create_restore_job(
            project_id,
            request.file_id,
            request.target_file_revision,
            request.expected_file_revision,
            request.source_path,
            request.created_by,
        ))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileWriteConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
