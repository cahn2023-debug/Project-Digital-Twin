from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import io
import json
import tempfile
from dataclasses import replace
from time import perf_counter
from typing import Any
from uuid import UUID
from pathlib import Path
from zipfile import BadZipFile

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
from ...adapters.files.importers.documents import (
    DocumentLocator,
    DocumentNode,
    DocumentParseResult,
    parse_document,
)
from ...adapters.files.importers.excel import (
    CameraWorkbookProfile,
    WorkbookProfile,
    parse_camera_rows,
    parse_camera_workbook_for_import,
)

from ...shared.schemas import (
    ApprovalRequest,
    AssetSyncRequest,
    ChangeSetEditRequest,
    ChangeSetRejectRequest,
    ContractorCreate,
    DocumentImportRequest,
    DesktopNormalizedImportRequest,
    DesktopRawFallbackRequest,
    FileImportProfileRequest,
    FileImportFromPathRequest,
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
        return getattr(main_core.get_store(), name)


store = _StoreProxy()


@router.post("/api/v1/projects/{project_id}/file-assets/sync", status_code=202)
def sync_file_assets(
    project_id: UUID,
    request: AssetSyncRequest,
    x_actor: str = Header(default="desktop-asset-sync"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "changeset.sync", x_actor, x_role)
    try:
        return jsonable_encoder(store.sync_file_assets(
            project_id,
            [asset.model_dump() for asset in request.assets],
            request.actor,
            request.idempotency_key,
        ))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _workbook_profile(request: FileImportProfileRequest | None) -> WorkbookProfile | None:
    if request is None:
        return None
    aliases = dict(CameraWorkbookProfile.aliases)
    aliases.update({key: tuple(values) for key, values in request.aliases.items() if values})
    return WorkbookProfile(
        profile_id=request.profile_id,
        version=request.version,
        sheet=request.sheet,
        header_rows=tuple(request.header_rows),
        data_start_row=request.data_start_row,
        table_start_row=request.table_start_row,
        skip_row_patterns=tuple(request.skip_row_patterns),
        aliases=aliases,
    )


def _preview_regions(scan: Any) -> list[dict[str, Any]]:
    previews: list[dict[str, Any]] = []
    for region in scan.regions:
        headers = [
            {
                "row": cell.row,
                "column": cell.column,
                "value": cell.value,
            }
            for cell in scan.cells
            if cell.sheet == region.sheet and cell.row in region.header_candidates
        ]
        previews.append({**region.__dict__, "headers": headers})
    return previews


def _preview_rows(scan: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for region in scan.regions:
        header_row = region.header_candidates[0]
        headers = {
            cell.column: str(cell.value)
            for cell in scan.cells
            if cell.sheet == region.sheet and cell.row == header_row
        }
        for row_number in range(header_row + 1, region.end_row + 1):
            values = {
                headers[cell.column]: cell.value
                for cell in scan.cells
                if cell.sheet == region.sheet and cell.row == row_number and cell.column in headers
            }
            if values:
                rows.append(values)
    return rows


def _desktop_record_rows(request: DesktopNormalizedImportRequest) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for record in request.records:
        row = dict(record.raw)
        row.update(record.fields)
        row.update(record.unmapped)
        if record.identity:
            row["__record_identity"] = record.identity
        if record.source:
            row["__source_locator"] = record.source
        rows.append(row)
    return rows


def _desktop_document_result(
    project_id: UUID,
    request: DesktopNormalizedImportRequest,
) -> DocumentParseResult:
    nodes: list[DocumentNode] = []
    for record in request.records:
        source = record.source
        content = record.fields.get("content")
        if content is None:
            content = json.dumps(record.fields, ensure_ascii=False, sort_keys=True)
        locator = DocumentLocator(
            file_id=request.file_id,
            file_revision=request.file_revision,
            source_path=f"desktop://normalized/{project_id}/{request.file_id}",
            line=source.get("line") if isinstance(source.get("line"), int) else None,
            column=source.get("column") if isinstance(source.get("column"), int) else None,
            part=source.get("sheet") if isinstance(source.get("sheet"), str) else None,
        )
        nodes.append(
            DocumentNode(
                kind="paragraph",
                text=str(content),
                locator=locator,
                attributes={
                    "fields": record.fields,
                    "unmapped": record.unmapped,
                    "source": source,
                },
            )
        )
    return DocumentParseResult(
        file_id=request.file_id,
        file_revision=request.file_revision,
        format=request.format.lower(),
        source_hash=request.source_hash,
        nodes=nodes,
        tables=[],
        links=[],
        assets=[],
        references=[],
        relationship_proposals=[],
        mapped_tables=[],
    )


def _document_result_source_name(parsed: DocumentParseResult, source_name: str) -> DocumentParseResult:
    nodes = [
        replace(node, locator=replace(node.locator, source_path=source_name))
        for node in parsed.nodes
    ]
    tables = [
        replace(table, locator=replace(table.locator, source_path=source_name))
        for table in parsed.tables
    ]
    assets = [
        replace(
            asset,
            source_path=source_name,
            locator=replace(asset.locator, source_path=source_name),
        )
        for asset in parsed.assets
    ]
    return replace(parsed, nodes=nodes, tables=tables, assets=assets)


def _fallback_suffix(request: DesktopRawFallbackRequest) -> str:
    suffix = Path(request.filename).suffix.lower()
    if suffix:
        return suffix
    return {
        "XLSX": ".xlsx",
        "XLS": ".xls",
        "CSV": ".csv",
        "TXT": ".txt",
        "MARKDOWN": ".md",
        "WORD": ".docx",
        "UNSUPPORTED": ".bin",
    }[request.format]


def _raw_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _authorize_header(project_id: UUID, action: str, actor: str, role: str) -> None:
    main_core.authorize_header(project_id, action, actor, role)


def _organize_group_state(group: Any) -> dict[str, Any]:
    return main_core.organize_group_state(group)


def _organize_membership_state(project_id: UUID, item_type: str, item_ids: list[UUID]) -> dict[str, list[str]]:
    return main_core.organize_membership_state(project_id, item_type, item_ids)


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


@router.post("/api/v1/projects/{project_id}/desktop-imports/normalized", status_code=202)
def create_desktop_normalized_import(
    project_id: UUID,
    request: DesktopNormalizedImportRequest,
) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if store.is_self_write(request.file_id, request.source_hash):
        store.record_self_write_suppression(project_id, request.file_id, request.source_hash, request.created_by)
        return {
            "status": "SUPPRESSED",
            "changeset": None,
            "result": None,
            "parse_report": request.parse_report,
            "raw_deleted": True,
            "retry_history": [{"attempt": request.retry_attempt, "status": "SUPPRESSED"}],
        }

    started_at = perf_counter()
    if request.format in {"TXT", "MARKDOWN", "WORD"}:
        parsed = _desktop_document_result(project_id, request)
        changeset = store.create_document_import_changeset(
            project_id,
            parsed,
            request.created_by,
            round((perf_counter() - started_at) * 1000),
            request.idempotency_key,
            request.parse_report,
        )
        return jsonable_encoder({
            "status": "NORMALIZED_ACCEPTED",
            "changeset": changeset,
            "result": None,
            "parse_report": request.parse_report,
            "raw_deleted": True,
            "processing_duration_ms": round((perf_counter() - started_at) * 1000),
            "retry_history": [{"attempt": request.retry_attempt, "status": "NORMALIZED_ACCEPTED"}],
        })

    rows = _desktop_record_rows(request)
    cameras, issues = parse_camera_rows(
        rows,
        file_id=request.file_id,
        file_revision=request.file_revision,
        sheet="CAMERA" if request.format == "XLSX" else "CSV",
    )
    changeset, result = store.create_file_import_changeset(
        project_id,
        request.file_id,
        request.file_revision,
        cameras,
        issues,
        rows,
        request.created_by,
        request.idempotency_key,
        request.source_hash,
        round((perf_counter() - started_at) * 1000),
        request.parse_report,
    )
    return jsonable_encoder({
        "status": "NORMALIZED_ACCEPTED",
        "changeset": changeset,
        "result": result,
        "parse_report": request.parse_report,
        "raw_deleted": True,
        "processing_duration_ms": round((perf_counter() - started_at) * 1000),
        "retry_history": [{"attempt": request.retry_attempt, "status": "NORMALIZED_ACCEPTED"}],
    })


@router.post("/api/v1/projects/{project_id}/desktop-imports/raw-fallback", status_code=202)
def create_desktop_raw_fallback(
    project_id: UUID,
    request: DesktopRawFallbackRequest,
) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        raw_bytes = base64.b64decode(request.content_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="content_base64 is invalid") from exc

    actual_hash = _raw_hash(raw_bytes)
    if actual_hash != request.source_hash:
        return {
            "status": "CONFLICT_REVIEW",
            "changeset": None,
            "result": None,
            "parse_report": {
                **request.parse_report,
                "issues": [{
                    "code": "SOURCE_HASH_MISMATCH",
                    "message": "Received raw content does not match the desktop fingerprint",
                    "severity": "ERROR",
                }],
            },
            "raw_deleted": True,
            "conflicts": [{"field": "source_hash", "expected": request.source_hash, "actual": actual_hash}],
        }

    started_at = perf_counter()
    server_profile_id = "document-default" if request.format in {"TXT", "MARKDOWN", "WORD"} else "camera-default"
    metadata_conflicts: list[dict[str, Any]] = []
    if request.expected_profile_id and request.expected_profile_id != server_profile_id:
        metadata_conflicts.append({
            "field": "profile_id",
            "expected": request.expected_profile_id,
            "server": server_profile_id,
        })

    try:
        with tempfile.TemporaryDirectory(prefix="desktop-import-") as temp_dir:
            path = Path(temp_dir) / f"source{_fallback_suffix(request)}"
            path.write_bytes(raw_bytes)
            if request.format in {"XLSX", "XLS"}:
                raw_rows, cameras, issues, _scan = parse_camera_workbook_for_import(
                    path,
                    file_id=request.file_id,
                    file_revision=request.file_revision,
                    profile=WorkbookProfile(
                        profile_id=server_profile_id,
                        version=1,
                        sheet="CAMERA",
                        header_rows=(1,),
                        data_start_row=2,
                        table_start_row=1,
                    ),
                )
                if not cameras:
                    return {
                        "status": "FAILED",
                        "changeset": None,
                        "result": {"invalid": issues, "inserted": [], "changed": [], "unchanged": [], "conflict": [], "unmapped": []},
                        "parse_report": {**request.parse_report, "server_issues": issues},
                        "raw_deleted": True,
                    }
                changeset, result = store.create_file_import_changeset(
                    project_id,
                    request.file_id,
                    request.file_revision,
                    cameras,
                    issues,
                    raw_rows,
                    request.created_by,
                    request.idempotency_key,
                    request.source_hash,
                    round((perf_counter() - started_at) * 1000),
                    request.parse_report,
                )
            elif request.format == "CSV":
                rows = list(csv.DictReader(io.StringIO(raw_bytes.decode("utf-8-sig"))))
                cameras, issues = parse_camera_rows(
                    rows,
                    file_id=request.file_id,
                    file_revision=request.file_revision,
                    sheet="CSV",
                )
                if not cameras:
                    return {
                        "status": "FAILED",
                        "changeset": None,
                        "result": {"invalid": issues, "inserted": [], "changed": [], "unchanged": [], "conflict": [], "unmapped": []},
                        "parse_report": {**request.parse_report, "server_issues": issues},
                        "raw_deleted": True,
                    }
                changeset, result = store.create_file_import_changeset(
                    project_id,
                    request.file_id,
                    request.file_revision,
                    cameras,
                    issues,
                    rows,
                    request.created_by,
                    request.idempotency_key,
                    request.source_hash,
                    round((perf_counter() - started_at) * 1000),
                    request.parse_report,
                )
            else:
                parsed = parse_document(
                    path,
                    file_id=request.file_id,
                    file_revision=request.file_revision,
                    canonical_entities=[],
                )
                parsed = _document_result_source_name(parsed, request.filename)
                changeset = store.create_document_import_changeset(
                    project_id,
                    parsed,
                    request.created_by,
                    round((perf_counter() - started_at) * 1000),
                    request.idempotency_key,
                    request.parse_report,
                )
                result = None
    except (OSError, ValueError, UnicodeDecodeError, BadZipFile) as exc:
        return {
            "status": "FAILED",
            "changeset": None,
            "result": None,
            "parse_report": {**request.parse_report, "server_error": str(exc)},
            "raw_deleted": True,
        }

    if metadata_conflicts:
        changeset = store.mark_changeset_conflict_review(
            project_id,
            changeset.id,
            metadata_conflicts,
            request.created_by,
        )
        status = "CONFLICT_REVIEW"
    else:
        status = "SERVER_PARSED"
    return jsonable_encoder({
        "status": status,
        "changeset": changeset,
        "result": result,
        "parse_report": request.parse_report,
        "raw_deleted": True,
        "processing_duration_ms": round((perf_counter() - started_at) * 1000),
        "server_profile_id": server_profile_id,
        "retry_history": [{"attempt": request.retry_attempt, "status": status}],
    })


@router.post("/api/v1/projects/{project_id}/file-imports/from-path", status_code=202)
def create_file_import_from_path(project_id: UUID, request: FileImportFromPathRequest) -> dict[str, Any]:
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if request.source_hash and store.is_self_write(request.file_id, request.source_hash):
        store.record_self_write_suppression(project_id, request.file_id, request.source_hash, request.created_by)
        return {
            "changeset": None,
            "result": {"inserted": [], "changed": [], "unchanged": [], "invalid": [], "conflict": [], "unmapped": []},
            "notice": "Self-write suppressed; no duplicate import was enqueued.",
            "suppressed": True,
            "processing_duration_ms": 0,
        }
    started_at = perf_counter()
    try:
        raw_rows, cameras, issues, scan = parse_camera_workbook_for_import(
            request.path,
            file_id=request.file_id,
            file_revision=request.file_revision,
            profile=_workbook_profile(request.profile)
            or WorkbookProfile(
                profile_id="camera-default",
                version=1,
                sheet=request.sheet,
                header_rows=(1,),
                data_start_row=2,
                table_start_row=1,
            ),
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Workbook source not found") from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not raw_rows and not cameras and issues and all(issue.code.startswith("UNMAPPED_") or issue.code == "UNSUPPORTED_ROW" for issue in issues):
        return jsonable_encoder({
            "changeset": None,
            "preview": {
                "file_id": request.file_id,
                "file_revision": request.file_revision,
                "regions": _preview_regions(scan),
                "skipped_sheets": scan.skipped_sheets,
                "rows": _preview_rows(scan),
                "issues": issues,
            },
            "result": {"inserted": [], "changed": [], "unchanged": [], "invalid": issues, "conflict": [], "unmapped": issues},
            "notice": "Workbook structure requires preview and mapping confirmation before a ChangeSet is created.",
            "processing_duration_ms": round((perf_counter() - started_at) * 1000),
        })

    changeset, result = store.create_file_import_changeset(
        project_id,
        request.file_id,
        request.file_revision,
        cameras,
        issues,
        raw_rows,
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
        idempotency_key = request.idempotency_key or f"DOCUMENT_IMPORT:{request.file_id}:{request.file_revision}:{parsed.source_hash}"
        changeset = store.create_document_import_changeset(
            project_id,
            parsed,
            request.created_by,
            duration_ms,
            idempotency_key,
        )
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


@router.post("/api/v1/projects/{project_id}/file-imports/{changeset_id}/edit")
def edit_file_import_changeset(
    project_id: UUID,
    changeset_id: UUID,
    request: ChangeSetEditRequest,
    x_actor: str = Header(default="changeset-editor"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "changeset.edit", x_actor, x_role)
    try:
        changeset = store.edit_file_import_changeset(
            project_id,
            changeset_id,
            request.record_identity,
            request.field,
            request.value,
            request.edited_by,
        )
        return jsonable_encoder({"changeset": changeset})
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/v1/projects/{project_id}/file-imports/{changeset_id}/reject")
def reject_file_import_changeset(
    project_id: UUID,
    changeset_id: UUID,
    request: ChangeSetRejectRequest,
    x_actor: str = Header(default="changeset-reviewer"),
    x_role: str = Header(default=Role.PROJECT_ADMIN.value),
) -> dict[str, Any]:
    _authorize_header(project_id, "changeset.reject", x_actor, x_role)
    try:
        changeset = store.reject_file_import_changeset(
            project_id,
            changeset_id,
            request.rejected_by,
            request.reason,
        )
        return jsonable_encoder({"changeset": changeset})
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
