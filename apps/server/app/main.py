from __future__ import annotations

import csv
import io
import json
from time import perf_counter
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .authorization import AuthorizationError, Principal, Role, authorize
from .documents import parse_document
from .domain import (
    CameraStore,
    FileImportConflict,
    FileWriteConflict,
    ProjectConflictError,
    ProjectValidationError,
    RevisionConflict,
    normalize_coordinate,
)
from .importer import parse_camera_rows


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    root_path: str = Field(min_length=1)


class ProjectDelete(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class ImportRequest(BaseModel):
    rows: list[dict[str, Any]]
    file_id: UUID
    file_revision: int = Field(ge=1)
    sheet: str = "CAMERA"
    created_by: str = Field(default="import", min_length=1)


class FileImportRequest(ImportRequest):
    idempotency_key: str = Field(min_length=1, max_length=200)
    source_hash: str | None = Field(default=None, min_length=64, max_length=64)


class GeometryRequest(BaseModel):
    latitude: float
    longitude: float
    base_revision: int = Field(ge=1)
    created_by: str = Field(default="designer", min_length=1)


class ContractorCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)


class WorkPackageCreate(BaseModel):
    contractor_id: UUID
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    entity_ids: list[UUID]


class FieldPackageCreate(BaseModel):
    work_package_id: UUID


class ObservationCreate(BaseModel):
    field_package_id: UUID
    entity_id: UUID
    base_revision: int = Field(ge=1)
    operator_id: str = Field(min_length=1)
    gps: dict[str, Any] | None = None
    form_data: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=1, max_length=200)


class ApprovalRequest(BaseModel):
    approved_by: str = Field(min_length=1)


class WriteJobCreate(BaseModel):
    file_id: UUID
    expected_file_revision: int = Field(ge=1)
    entity_revision: UUID
    expected_file_hash: str | None = Field(default=None, min_length=64, max_length=64)
    source_path: str | None = None


class WriteJobComplete(BaseModel):
    source_hash: str = Field(min_length=64, max_length=64)
    result_hash: str = Field(min_length=64, max_length=64)
    size: int = Field(ge=0)
    actor: str = Field(min_length=1)
    backup_path: str | None = None


class RestoreJobCreate(BaseModel):
    file_id: UUID
    target_file_revision: int = Field(ge=1)
    expected_file_revision: int = Field(ge=1)
    source_path: str = Field(min_length=1)
    created_by: str = Field(default="restore", min_length=1)


class DocumentImportRequest(BaseModel):
    path: str = Field(min_length=1)
    file_id: UUID
    file_revision: int = Field(ge=1)
    created_by: str = Field(default="document-import", min_length=1)
    canonical_entities: list[dict[str, Any]] = Field(default_factory=list)


store = CameraStore()
app = FastAPI(title="Project Digital Twin API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, str]:
    return {"status": "ok", "canonical_store": "in-memory-foundation"}


@app.get("/api/v1/projects")
def list_projects(status: str = "ACTIVE") -> list[dict[str, Any]]:
    try:
        return jsonable_encoder(store.list_projects(status))
    except ProjectValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects", status_code=201)
def create_project(request: ProjectCreate) -> dict[str, Any]:
    try:
        project = store.create_project(request.name, request.root_path)
    except ProjectValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return jsonable_encoder(project)


@app.post("/api/v1/projects/{project_id}/archive")
def archive_project(project_id: UUID) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.archive_project(project_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/restore")
def restore_project(project_id: UUID) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.restore_project(project_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.delete("/api/v1/projects/{project_id}")
def delete_project(project_id: UUID, request: ProjectDelete) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.delete_project(project_id, request.name))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/v1/projects/{project_id}")
def get_project(project_id: UUID) -> dict[str, Any]:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.__dict__


@app.get("/api/v1/projects/{project_id}/cameras")
def list_cameras(project_id: UUID) -> list[dict[str, Any]]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return [camera.__dict__ for camera in store.list_cameras(project_id)]


@app.post("/api/v1/projects/{project_id}/cameras/import")
def import_cameras(project_id: UUID, request: ImportRequest) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
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


@app.post("/api/v1/projects/{project_id}/file-imports", status_code=202)
def create_file_import_changeset(project_id: UUID, request: FileImportRequest) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
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


@app.post("/api/v1/projects/{project_id}/document-imports", status_code=202)
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


def _authorize_header(project_id: UUID, action: str, actor: str, role: str) -> None:
    try:
        principal = Principal(actor, frozenset({Role(role)}), frozenset({project_id}))
        authorize(principal, action, project_id)
    except (AuthorizationError, ValueError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@app.get("/api/v1/projects/{project_id}/audit")
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


@app.get("/api/v1/projects/{project_id}/audit/export")
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


@app.post("/api/v1/projects/{project_id}/file-imports/{changeset_id}/approve")
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


@app.post("/api/v1/projects/{project_id}/cameras/{entity_id}/designed-geometry")
def update_designed_geometry(
    project_id: UUID,
    entity_id: UUID,
    request: GeometryRequest,
) -> dict[str, Any]:
    try:
        latitude = normalize_coordinate(request.latitude, -90, 90, "latitude")
        longitude = normalize_coordinate(request.longitude, -180, 180, "longitude")
        assert latitude is not None and longitude is not None
        revision = store.update_geometry(
            project_id,
            entity_id,
            latitude,
            longitude,
            request.base_revision,
            request.created_by,
        )
    except RevisionConflict as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CONFLICT",
                "entity_id": str(exc.entity_id),
                "base_revision": exc.base_revision,
                "current_revision": exc.current_revision,
            },
        ) from exc
    except (AssertionError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "changeset_id": str(revision.changeset_id),
        "status": "APPLIED",
        "revision": revision.__dict__,
    }


@app.post("/api/v1/projects/{project_id}/contractors", status_code=201)
def create_contractor(project_id: UUID, request: ContractorCreate) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.create_contractor(project_id, request.code.strip(), request.name.strip()))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/work-packages", status_code=201)
def create_work_package(project_id: UUID, request: WorkPackageCreate) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.create_work_package(
            project_id, request.contractor_id, request.code.strip(), request.name.strip(), request.entity_ids
        ))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/field-packages", status_code=201)
def create_field_package(project_id: UUID, request: FieldPackageCreate) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.create_field_package(project_id, request.work_package_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/observations", status_code=201)
def submit_observation(project_id: UUID, request: ObservationCreate) -> dict[str, Any]:
    try:
        observation = store.submit_observation(
            project_id, request.field_package_id, request.entity_id, request.base_revision,
            request.operator_id, request.gps, request.form_data, request.idempotency_key,
        )
        return jsonable_encoder(observation)
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/changesets/{changeset_id}/approve")
def approve_changeset(project_id: UUID, changeset_id: UUID, request: ApprovalRequest) -> dict[str, Any]:
    try:
        changeset, revision = store.approve_changeset(project_id, changeset_id, request.approved_by)
        return jsonable_encoder({"changeset": changeset, "revision": revision})
    except RevisionConflict as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "CONFLICT", "entity_id": str(exc.entity_id), "base_revision": exc.base_revision, "current_revision": exc.current_revision},
        ) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/v1/projects/{project_id}/sync/changes")
def get_changes(project_id: UUID, after: int = 0) -> list[dict[str, Any]]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return jsonable_encoder(store.changes_after(project_id, after))


@app.get("/api/v1/projects/{project_id}/dashboard")
def get_dashboard(project_id: UUID) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return store.dashboard(project_id)


@app.post("/api/v1/projects/{project_id}/file-write-jobs", status_code=202)
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


@app.post("/api/v1/projects/{project_id}/file-write-jobs/{job_id}/complete")
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


@app.post("/api/v1/projects/{project_id}/file-restore-jobs", status_code=202)
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
