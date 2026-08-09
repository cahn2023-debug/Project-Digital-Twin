from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field

from .domain import CameraStore, RevisionConflict, normalize_coordinate
from .importer import parse_camera_rows


class ProjectCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)


class ImportRequest(BaseModel):
    rows: list[dict[str, Any]]
    file_id: UUID
    file_revision: int = Field(ge=1)
    sheet: str = "CAMERA"
    created_by: str = Field(default="import", min_length=1)


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


@app.post("/api/v1/projects", status_code=201)
def create_project(request: ProjectCreate) -> dict[str, Any]:
    try:
        project = store.create_project(request.code.strip(), request.name.strip())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return project.__dict__


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
        project_id, request.file_id, request.expected_file_revision, request.entity_revision
    ))
