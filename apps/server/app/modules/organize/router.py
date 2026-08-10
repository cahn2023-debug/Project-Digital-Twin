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


@router.get("/api/v1/projects/{project_id}/organize")
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


@router.post("/api/v1/projects/{project_id}/organize/groups", status_code=201)
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


@router.patch("/api/v1/projects/{project_id}/organize/groups/{group_id}")
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


@router.delete("/api/v1/projects/{project_id}/organize/groups/{group_id}")
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


@router.post("/api/v1/projects/{project_id}/organize/tags", status_code=201)
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


@router.post("/api/v1/projects/{project_id}/organize/memberships")
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


@router.post("/api/v1/projects/{project_id}/organize/lifecycle")
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


@router.post("/api/v1/projects/{project_id}/organize/write-back/preview")
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


@router.post("/api/v1/projects/{project_id}/organize/write-back/execute", status_code=202)
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


@router.post("/api/v1/projects/{project_id}/contractors", status_code=201)
def create_contractor(project_id: UUID, request: ContractorCreate) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.create_contractor(project_id, request.code.strip(), request.name.strip()))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/work-packages", status_code=201)
def create_work_package(project_id: UUID, request: WorkPackageCreate) -> dict[str, Any]:
    try:
        return jsonable_encoder(store.create_work_package(
            project_id, request.contractor_id, request.code.strip(), request.name.strip(), request.entity_ids
        ))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
