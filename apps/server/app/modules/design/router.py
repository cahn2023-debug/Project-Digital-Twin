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

from ...main_core import dependencies as main_core
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

from ...shared.schemas import (
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
from ...shared.basemap_manifest import get_basemap_manifest as load_basemap_manifest
from ...shared.basemap_manifest import manifest_etag, manifest_json, manifest_last_modified


router = APIRouter()


@router.get("/api/v1/basemap/manifest")
def basemap_manifest(
    if_none_match: str | None = Header(default=None, alias="If-None-Match"),
    if_modified_since: str | None = Header(default=None, alias="If-Modified-Since"),
) -> Response:
    manifest = load_basemap_manifest()
    etag = manifest_etag(manifest)
    last_modified = manifest_last_modified(manifest)
    headers = {
        "Cache-Control": "no-cache",
        "ETag": etag,
        "Last-Modified": last_modified,
    }
    if if_none_match == etag or (if_none_match is None and if_modified_since == last_modified):
        return Response(status_code=304, headers=headers)
    return Response(content=manifest_json(manifest), media_type="application/json", headers=headers)


class _StoreProxy:
    def __getattr__(self, name: str) -> Any:
        return getattr(main_core.get_store(), name)


store = _StoreProxy()


def _authorize_header(project_id: UUID, action: str, actor: str, role: str) -> None:
    main_core.authorize_header(project_id, action, actor, role)


def _organize_group_state(group: Any) -> dict[str, Any]:
    return main_core.organize_group_state(group)


def _organize_membership_state(project_id: UUID, item_type: str, item_ids: list[UUID]) -> dict[str, list[str]]:
    return main_core.organize_membership_state(project_id, item_type, item_ids)


@router.post("/api/v1/projects/{project_id}/cameras/{entity_id}/designed-geometry")
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
