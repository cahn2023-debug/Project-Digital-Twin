from __future__ import annotations

from fastapi import APIRouter, HTTPException
from ...main_core.dependencies import get_store
from ...shared.schemas import (
    ConflictResolveRequest,
    StagedConflictListResponse,
    StagedConflictResponse,
    SyncBatchRequest,
    SyncBatchResponse,
)
from ...shared.reconciler import GLOBAL_RECONCILER, ReconciliationEngine

router = APIRouter()


def _reconciliation_engine() -> ReconciliationEngine:
    state = getattr(get_store(), "reconciliation_state", None)
    return ReconciliationEngine(state) if state is not None else GLOBAL_RECONCILER


@router.post("/api/v1/sync/reconcile-batch", response_model=SyncBatchResponse)
def reconcile_batch(request: SyncBatchRequest) -> SyncBatchResponse:
    return _reconciliation_engine().reconcile_batch(request)


@router.get("/api/v1/sync/conflicts", response_model=StagedConflictListResponse)
def list_conflicts(status: str | None = "PENDING_REVIEW") -> StagedConflictListResponse:
    conflicts = _reconciliation_engine().list_conflicts(status_filter=status)
    items = [
        StagedConflictResponse(
            conflict_id=c.conflict_id,
            mutation_id=c.mutation_id,
            client_id=c.client_id,
            workspace_id=c.workspace_id,
            user_id=c.user_id,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            timestamp=c.timestamp,
            conflicting_fields=c.conflicting_fields,
            server_fields=c.server_fields,
            status=c.status,
            created_at=c.created_at,
        )
        for c in conflicts
    ]
    return StagedConflictListResponse(total=len(items), conflicts=items)


@router.get("/api/v1/sync/conflicts/{conflict_id}", response_model=StagedConflictResponse)
def get_conflict(conflict_id: str) -> StagedConflictResponse:
    c = _reconciliation_engine().get_conflict(conflict_id)
    if c is None:
        raise HTTPException(status_code=404, detail=f"Conflict {conflict_id} not found")
    return StagedConflictResponse(
        conflict_id=c.conflict_id,
        mutation_id=c.mutation_id,
        client_id=c.client_id,
        workspace_id=c.workspace_id,
        user_id=c.user_id,
        entity_type=c.entity_type,
        entity_id=c.entity_id,
        timestamp=c.timestamp,
        conflicting_fields=c.conflicting_fields,
        server_fields=c.server_fields,
        status=c.status,
        created_at=c.created_at,
    )


@router.post("/api/v1/sync/conflicts/{conflict_id}/resolve", response_model=StagedConflictResponse)
def resolve_conflict(conflict_id: str, request: ConflictResolveRequest) -> StagedConflictResponse:
    try:
        c = _reconciliation_engine().resolve_conflict(
            conflict_id,
            chosen_client_id=request.chosen_client_id,
            custom_values=request.custom_values,
            resolved_by=request.resolved_by,
        )
        return StagedConflictResponse(
            conflict_id=c.conflict_id,
            mutation_id=c.mutation_id,
            client_id=c.client_id,
            workspace_id=c.workspace_id,
            user_id=c.user_id,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            timestamp=c.timestamp,
            conflicting_fields=c.conflicting_fields,
            server_fields=c.server_fields,
            status=c.status,
            created_at=c.created_at,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
