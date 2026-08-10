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


@router.post("/api/v1/projects/{project_id}/field-packages", status_code=201)
def create_field_package(project_id: UUID, request: FieldPackageCreate) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.create_field_package(project_id, request.work_package_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/observations", status_code=201)
def submit_observation(project_id: UUID, request: ObservationCreate) -> dict[str, Any]:
    try:
        observation = store.submit_observation(
            project_id, request.field_package_id, request.entity_id, request.base_revision,
            request.operator_id, request.gps, request.form_data, request.idempotency_key,
        )
        return jsonable_encoder(observation)
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/changesets/{changeset_id}/approve")
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


@router.get("/api/v1/projects/{project_id}/sync/changes")
def get_changes(project_id: UUID, after: int = 0) -> list[dict[str, Any]]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return jsonable_encoder(store.changes_after(project_id, after))
