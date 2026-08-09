from __future__ import annotations

import csv
import io
import json
import logging
import os
from contextvars import ContextVar
from time import perf_counter
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from .authorization import AuthorizationError, Principal, Role, authorize
from .auth import AuthenticationError, authenticate_bearer
from .documents import parse_document
from .domain import (
    CameraStore,
    FileImportConflict,
    FileWriteConflict,
    OrganizeConflictError,
    OrganizeValidationError,
    ProjectConflictError,
    ProjectValidationError,
    RevisionConflict,
    normalize_coordinate,
)
from .importer import parse_camera_rows
from .persistence import PostgresCameraStore


logger = logging.getLogger("project_digital_twin.api")
request_metrics = {
    "requests_total": 0,
    "requests_errors_total": 0,
    "request_duration_seconds_total": 0.0,
}
current_principal: ContextVar[Principal | None] = ContextVar("current_principal", default=None)


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
    source_hash: str | None = Field(default=None, min_length=64, max_length=64)


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


class OrganizeGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_ids: list[UUID] = Field(default_factory=list)


class OrganizeGroupPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_ids: list[UUID] | None = None
    status: str | None = None


class OrganizeTagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class OrganizeMembershipRequest(BaseModel):
    operation: str = "add"
    item_type: str
    item_ids: list[UUID] = Field(min_length=1)
    group_ids: list[UUID] = Field(default_factory=list)
    tag_ids: list[UUID] = Field(default_factory=list)
    replace_groups: bool = False
    replace_tags: bool = False


class OrganizeLifecycleRequest(BaseModel):
    item_type: str
    item_ids: list[UUID] = Field(min_length=1)
    status: str


class OrganizeWriteBackPreviewRequest(BaseModel):
    item_type: str
    item_ids: list[UUID] = Field(min_length=1)
    file_ids: list[UUID] = Field(default_factory=list)
    format: str = "EXCEL"
    destination_mode: str = "IN_PLACE"
    batch_strategy: str = "PER_FILE"
    destination_paths: dict[str, str] = Field(default_factory=dict)
    expected_file_revisions: dict[str, int] = Field(default_factory=dict)
    expected_file_hashes: dict[str, str] = Field(default_factory=dict)
    manual_mapping: dict[str, dict[str, Any]] = Field(default_factory=dict)


class OrganizeWriteBackExecuteRequest(BaseModel):
    plan_id: UUID
    confirmed: bool = False


class WriteJobFailureRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


def _build_store() -> CameraStore:
    database_url = os.getenv("DATABASE_URL")
    is_production = os.getenv("APP_ENV", "development").casefold() == "production"
    if is_production and os.getenv("AUTH_MODE", "oidc").casefold() != "oidc":
        raise RuntimeError("AUTH_MODE=oidc is required when APP_ENV=production")
    if database_url:
        return PostgresCameraStore(database_url)
    if is_production:
        raise RuntimeError("DATABASE_URL is required when APP_ENV=production")
    return CameraStore()


store = _build_store()
app = FastAPI(title="Project Digital Twin API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_observability_and_transaction(request: Request, call_next: Any) -> Any:
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    started = perf_counter()
    request_metrics["requests_total"] += 1
    response = None
    principal_token = None
    try:
        if os.getenv("APP_ENV", "development").casefold() == "production" and request.url.path.startswith("/api"):
            try:
                principal_token = current_principal.set(authenticate_bearer(request.headers.get("Authorization")))
            except AuthenticationError as exc:
                request_metrics["requests_errors_total"] += 1
                logger.info(
                    json.dumps(
                        {
                            "event": "request_unauthenticated",
                            "request_id": request_id,
                            "method": request.method,
                            "path": request.url.path,
                        },
                        ensure_ascii=False,
                    )
                )
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication required"},
                    headers={"X-Request-ID": request_id},
                )
        use_transaction = isinstance(store, PostgresCameraStore) and not request.url.path.startswith("/health")
        if use_transaction:
            with store.request_context():
                response = await call_next(request)
        else:
            response = await call_next(request)
    except Exception:
        request_metrics["requests_errors_total"] += 1
        logger.exception(
            json.dumps(
                {
                    "event": "request_failed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                },
                ensure_ascii=False,
            )
        )
        raise
    finally:
        if principal_token is not None:
            current_principal.reset(principal_token)
        request_metrics["request_duration_seconds_total"] += perf_counter() - started
    response.headers["X-Request-ID"] = request_id
    logger.info(
        json.dumps(
            {
                "event": "request_completed",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((perf_counter() - started) * 1000, 3),
            },
            ensure_ascii=False,
        )
    )
    return response


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, Any]:
    if isinstance(store, PostgresCameraStore):
        try:
            return store.health()
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Canonical store is unavailable") from exc
    return {"status": "ok", "canonical_store": "in-memory-development"}


@app.get("/metrics")
def metrics() -> Response:
    lines = [
        "# TYPE project_digital_twin_requests_total counter",
        f"project_digital_twin_requests_total {request_metrics['requests_total']}",
        "# TYPE project_digital_twin_requests_errors_total counter",
        f"project_digital_twin_requests_errors_total {request_metrics['requests_errors_total']}",
        "# TYPE project_digital_twin_request_duration_seconds_total counter",
        f"project_digital_twin_request_duration_seconds_total {request_metrics['request_duration_seconds_total']}",
    ]
    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


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
    except FileWriteConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
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


def _organize_group_state(group: Any) -> dict[str, Any]:
    return {
        "id": str(group.id),
        "project_id": str(group.project_id),
        "name": group.name,
        "parent_ids": [str(parent_id) for parent_id in group.parent_ids],
        "status": group.status,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


def _organize_membership_state(project_id: UUID, item_type: str, item_ids: list[UUID]) -> dict[str, list[str]]:
    return {
        "group_ids": [
            str(membership.group_id)
            for membership in store.list_organize_group_memberships(project_id, item_type, set(item_ids))
        ],
        "tag_ids": [
            str(membership.tag_id)
            for membership in store.list_organize_tag_memberships(project_id, item_type, set(item_ids))
        ],
    }


@app.get("/api/v1/projects/{project_id}/organize")
def get_organize_snapshot(
    project_id: UUID,
    query: str | None = None,
    item_type: str | None = None,
    group_id: UUID | None = None,
    tag_id: UUID | None = None,
    status: str | None = None,
    source_file_id: UUID | None = None,
    x_actor: str = Header(default="organize-viewer"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    _authorize_header(project_id, "read", x_actor, x_role)
    try:
        return jsonable_encoder(store.organize_snapshot(
            project_id,
            query=query,
            item_type=item_type,
            group_id=group_id,
            tag_id=tag_id,
            status=status,
            source_file_id=source_file_id,
        ))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/organize/groups", status_code=201)
def create_organize_group(
    project_id: UUID,
    request: OrganizeGroupCreate,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    try:
        group = store.create_organize_group(project_id, request.name, request.parent_ids)
        after = _organize_group_state(group)
        store.record_organize_event(
            project_id,
            "OrganizeGroupCreated",
            group.id,
            x_actor,
            {"group_id": str(group.id), "parent_ids": after["parent_ids"]},
            after=after,
        )
        return jsonable_encoder(group)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.patch("/api/v1/projects/{project_id}/organize/groups/{group_id}")
def update_organize_group(
    project_id: UUID,
    group_id: UUID,
    request: OrganizeGroupPatch,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    try:
        group = store.organize_groups.get(group_id)
        if group is None or group.project_id != project_id:
            raise KeyError("Organize group not found")
        before = _organize_group_state(group)
        updated = store.update_organize_group(
            project_id,
            group_id,
            name=request.name,
            parent_ids=request.parent_ids,
            status=request.status,
        )
        after = _organize_group_state(updated)
        store.record_organize_event(
            project_id,
            "OrganizeGroupUpdated",
            group_id,
            x_actor,
            {"group_id": str(group_id)},
            before=before,
            after=after,
        )
        return jsonable_encoder(updated)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.delete("/api/v1/projects/{project_id}/organize/groups/{group_id}")
def delete_organize_group(
    project_id: UUID,
    group_id: UUID,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, str]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    try:
        group = store.organize_groups.get(group_id)
        if group is None or group.project_id != project_id:
            raise KeyError("Organize group not found")
        before = _organize_group_state(group)
        store.delete_organize_group(project_id, group_id)
        store.record_organize_event(
            project_id,
            "OrganizeGroupDeleted",
            group_id,
            x_actor,
            {"group_id": str(group_id), "membership_links_removed": True},
            before=before,
            after={},
        )
        return {"group_id": str(group_id), "status": "DELETED"}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/organize/tags", status_code=201)
def create_organize_tag(
    project_id: UUID,
    request: OrganizeTagCreate,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    try:
        tag = store.create_organize_tag(project_id, request.name)
        store.record_organize_event(
            project_id,
            "OrganizeTagCreated",
            tag.id,
            x_actor,
            {"tag_id": str(tag.id)},
            after={"id": str(tag.id), "name": tag.name},
        )
        return jsonable_encoder(tag)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/organize/memberships")
def mutate_organize_memberships(
    project_id: UUID,
    request: OrganizeMembershipRequest,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    operation = request.operation.strip().lower()
    if operation not in {"add", "remove"}:
        raise HTTPException(status_code=422, detail="operation must be add or remove")
    if not request.group_ids and not request.tag_ids:
        raise HTTPException(status_code=422, detail="At least one group or tag is required")
    if request.replace_groups and not request.group_ids:
        raise HTTPException(status_code=422, detail="replace_groups requires group_ids")
    if request.replace_tags and not request.tag_ids:
        raise HTTPException(status_code=422, detail="replace_tags requires tag_ids")
    try:
        store.validate_organize_membership_targets(project_id, request.group_ids, request.tag_ids)
        before = _organize_membership_state(project_id, request.item_type, request.item_ids)
        if operation == "add":
            if request.group_ids:
                store.assign_organize_groups(
                    project_id, request.item_type, request.item_ids, request.group_ids, request.replace_groups
                )
            if request.tag_ids:
                store.assign_organize_tags(
                    project_id, request.item_type, request.item_ids, request.tag_ids, request.replace_tags
                )
        else:
            if request.group_ids:
                store.remove_organize_groups(project_id, request.item_type, request.item_ids, request.group_ids)
            if request.tag_ids:
                store.remove_organize_tags(project_id, request.item_type, request.item_ids, request.tag_ids)
        after = _organize_membership_state(project_id, request.item_type, request.item_ids)
        store.record_organize_event(
            project_id,
            "OrganizeMembershipChanged",
            request.item_ids[0],
            x_actor,
            {
                "operation": operation,
                "item_type": request.item_type,
                "item_ids": [str(item_id) for item_id in request.item_ids],
                "group_ids": [str(group_id) for group_id in request.group_ids],
                "tag_ids": [str(tag_id) for tag_id in request.tag_ids],
            },
            before=before,
            after=after,
        )
        return jsonable_encoder(store.organize_snapshot(project_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/organize/lifecycle")
def mutate_organize_lifecycle(
    project_id: UUID,
    request: OrganizeLifecycleRequest,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    try:
        before = {
            str(item_id): store.organize_item_lifecycle.get((project_id, request.item_type.strip().upper(), item_id), "ACTIVE")
            for item_id in request.item_ids
        }
        lifecycle = store.set_organize_item_status(project_id, request.item_type, request.item_ids, request.status)
        after = {str(item.item_id): item.status for item in lifecycle}
        store.record_organize_event(
            project_id,
            "OrganizeLifecycleChanged",
            request.item_ids[0],
            x_actor,
            {
                "item_type": request.item_type,
                "item_ids": [str(item_id) for item_id in request.item_ids],
                "status": request.status,
            },
            before=before,
            after=after,
        )
        return jsonable_encoder({"lifecycle": lifecycle, "snapshot": store.organize_snapshot(project_id)})
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/organize/write-back/preview")
def preview_organize_write_back(
    project_id: UUID,
    request: OrganizeWriteBackPreviewRequest,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    try:
        return jsonable_encoder(store.create_organize_excel_preview(
            project_id,
            request.item_type,
            request.item_ids,
            file_ids=request.file_ids,
            format_name=request.format,
            destination_mode=request.destination_mode,
            batch_strategy=request.batch_strategy,
            destination_paths=request.destination_paths,
            expected_file_revisions=request.expected_file_revisions,
            expected_file_hashes=request.expected_file_hashes,
            manual_mapping=request.manual_mapping,
            created_by=x_actor,
        ))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/organize/write-back/execute", status_code=202)
def execute_organize_write_back(
    project_id: UUID,
    request: OrganizeWriteBackExecuteRequest,
    x_actor: str = Header(default="organize-editor"),
    x_role: str = Header(default=Role.PROJECT_ENGINEER.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "organize.edit", x_actor, x_role)
    try:
        return jsonable_encoder(store.execute_organize_writeback(
            project_id,
            request.plan_id,
            confirmed=request.confirmed,
            actor=x_actor,
        ))
    except FileWriteConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OrganizeConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OrganizeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/projects/{project_id}/cameras/import")
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


@app.post("/api/v1/projects/{project_id}/file-imports", status_code=202)
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
        principal = current_principal.get()
        if principal is None:
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
def approve_changeset(
    project_id: UUID,
    changeset_id: UUID,
    request: ApprovalRequest,
    x_actor: str = Header(default="changeset-approver"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "approval.apply", x_actor, x_role)
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


@app.post("/api/v1/projects/{project_id}/file-write-jobs/{job_id}/fail")
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
    except FileWriteConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
