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
from ...documents import parse_document
from ...importer import parse_camera_rows

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


@router.get("/api/v1/projects")
def list_projects(status: str = "ACTIVE") -> list[dict[str, Any]]:
    try:
        return jsonable_encoder(store.list_projects(status))
    except ProjectValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/api/v1/projects", status_code=201)
def create_project(request: ProjectCreate) -> dict[str, Any]:
    try:
        project = store.create_project(request.name, request.root_path)
    except ProjectValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return jsonable_encoder(project)


@router.post("/api/v1/projects/{project_id}/archive")
def archive_project(project_id: UUID) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.archive_project(project_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileWriteConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/restore")
def restore_project(project_id: UUID) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.restore_project(project_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/api/v1/projects/{project_id}")
def delete_project(project_id: UUID, request: ProjectDelete) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.delete_project(project_id, request.name))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/api/v1/projects/{project_id}")
def get_project(project_id: UUID) -> dict[str, Any]:
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.__dict__
