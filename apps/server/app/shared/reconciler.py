from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from .schemas import SyncBatchRequest, SyncBatchResponse, SyncMutationAck, SyncMutationItem


@dataclass
class StagedConflictRecord:
    conflict_id: str
    mutation_id: str
    client_id: str
    workspace_id: str
    user_id: str
    entity_type: str
    entity_id: str
    timestamp: int
    conflicting_fields: dict[str, Any]
    server_fields: dict[str, Any]
    status: str = "PENDING_REVIEW"
    created_at: str = ""


class ReconciliationEngine:
    def __init__(self) -> None:
        self.processed_mutations: set[str] = set()
        self.entity_states: dict[str, dict[str, Any]] = {}
        self.entity_field_timestamps: dict[str, dict[str, tuple[str, int, Any]]] = {}
        self.staged_conflicts: dict[str, StagedConflictRecord] = {}

    def reconcile_batch(self, request: SyncBatchRequest) -> SyncBatchResponse:
        results: list[SyncMutationAck] = []
        synced_count = 0
        conflict_count = 0
        failed_count = 0

        for item in request.mutations:
            if item.mutation_id in self.processed_mutations:
                results.append(
                    SyncMutationAck(
                        mutation_id=item.mutation_id,
                        status="IGNORED_DUPLICATE",
                        entity_id=item.entity_id,
                        applied_fields=[],
                        conflicting_fields=[],
                        message="Mutation already processed",
                    )
                )
                continue

            entity_key = f"{item.entity_type}:{item.entity_id}"
            current_entity_state = self.entity_states.setdefault(entity_key, {})
            current_field_timestamps = self.entity_field_timestamps.setdefault(entity_key, {})

            applied_fields: list[str] = []
            conflicting_fields: list[str] = []
            conflict_dict: dict[str, Any] = {}
            server_conflict_dict: dict[str, Any] = {}

            for f_name, f_val in item.field_changes.items():
                if f_name in current_field_timestamps:
                    prev_client_id, _prev_time, prev_val = current_field_timestamps[f_name]
                    if prev_client_id != item.client_id and prev_val != f_val:
                        conflicting_fields.append(f_name)
                        conflict_dict[f_name] = f_val
                        server_conflict_dict[f_name] = prev_val
                        continue

                current_entity_state[f_name] = f_val
                current_field_timestamps[f_name] = (item.client_id, item.timestamp, f_val)
                applied_fields.append(f_name)

            self.processed_mutations.add(item.mutation_id)

            if conflicting_fields:
                conflict_id = f"conflict-{item.mutation_id}"
                staged = StagedConflictRecord(
                    conflict_id=conflict_id,
                    mutation_id=item.mutation_id,
                    client_id=item.client_id,
                    workspace_id=item.workspace_id,
                    user_id=item.user_id,
                    entity_type=item.entity_type,
                    entity_id=item.entity_id,
                    timestamp=item.timestamp,
                    conflicting_fields=conflict_dict,
                    server_fields=server_conflict_dict,
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
                self.staged_conflicts[conflict_id] = staged
                conflict_count += 1
                results.append(
                    SyncMutationAck(
                        mutation_id=item.mutation_id,
                        status="STAGED_FOR_REVIEW",
                        entity_id=item.entity_id,
                        applied_fields=applied_fields,
                        conflicting_fields=conflicting_fields,
                        message=f"Field conflict detected on {conflicting_fields}. Staged for review.",
                    )
                )
            else:
                synced_count += 1
                results.append(
                    SyncMutationAck(
                        mutation_id=item.mutation_id,
                        status="SYNCED",
                        entity_id=item.entity_id,
                        applied_fields=applied_fields,
                        conflicting_fields=[],
                        message="Successfully auto-merged non-conflicting fields",
                    )
                )

        return SyncBatchResponse(
            processed_count=len(request.mutations),
            synced_count=synced_count,
            conflict_count=conflict_count,
            failed_count=failed_count,
            results=results,
        )

    def list_conflicts(self, status_filter: str | None = None) -> list[StagedConflictRecord]:
        if status_filter:
            return [c for c in self.staged_conflicts.values() if c.status == status_filter]
        return list(self.staged_conflicts.values())

    def get_conflict(self, conflict_id: str) -> StagedConflictRecord | None:
        return self.staged_conflicts.get(conflict_id)

    def resolve_conflict(
        self,
        conflict_id: str,
        chosen_client_id: str | None = None,
        custom_values: dict[str, Any] | None = None,
        resolved_by: str = "admin",
    ) -> StagedConflictRecord:
        staged = self.staged_conflicts.get(conflict_id)
        if staged is None:
            raise KeyError(f"Conflict ID {conflict_id} not found")

        entity_key = f"{staged.entity_type}:{staged.entity_id}"
        current_entity_state = self.entity_states.setdefault(entity_key, {})
        current_field_timestamps = self.entity_field_timestamps.setdefault(entity_key, {})

        now_ts = int(datetime.now(timezone.utc).timestamp())

        target_values: dict[str, Any] = {}
        if custom_values is not None:
            target_values = custom_values
        elif chosen_client_id and chosen_client_id == staged.client_id:
            target_values = staged.conflicting_fields
        elif chosen_client_id is not None:
            raise ValueError(f"Client {chosen_client_id} is not part of conflict {conflict_id}")

        for f_name, f_val in target_values.items():
            current_entity_state[f_name] = f_val
            current_field_timestamps[f_name] = (
                chosen_client_id or staged.client_id,
                now_ts,
                f_val,
            )

        staged.status = "RESOLVED"
        return staged


GLOBAL_RECONCILER = ReconciliationEngine()
