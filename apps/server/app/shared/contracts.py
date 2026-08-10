from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from .clock import utc_now

@dataclass(frozen=True)
class SourceLocator:
    file_id: UUID
    file_revision: int
    sheet: str
    row: int
    column: str


@dataclass(frozen=True)
class EntityRevision:
    id: UUID
    entity_id: UUID
    representation: str
    revision: int
    data: dict[str, Any]
    geometry: dict[str, float] | None
    created_at: datetime
    created_by: str
    changeset_id: UUID | None


@dataclass
class ChangeSet:
    id: UUID
    project_id: UUID
    origin: str
    submitted_by: str
    submitted_at: datetime
    status: str
    entity_id: UUID
    representation: str
    base_revision: int
    patch: dict[str, Any]
    file_id: UUID | None = None
    file_revision: int | None = None
    file_hash: str | None = None
    items: list[dict[str, Any]] = field(default_factory=list)
    raw_rows: list[dict[str, Any]] = field(default_factory=list)
    conflicts: list[dict[str, Any]] = field(default_factory=list)
    document_assets: list[dict[str, Any]] = field(default_factory=list)
    relationship_proposals: list[dict[str, Any]] = field(default_factory=list)
    document_tables: list[dict[str, Any]] = field(default_factory=list)
    document_mapped_tables: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class OutboxEvent:
    cursor: int
    event_id: UUID
    event_type: str
    aggregate_id: UUID
    aggregate_version: int
    project_id: UUID
    payload: dict[str, Any]
    occurred_at: datetime


@dataclass(frozen=True)
class AuditEvent:
    id: UUID
    project_id: UUID
    event_id: UUID
    event_type: str
    operation: str
    actor: str
    occurred_at: datetime
    file_id: UUID | None
    object_id: UUID | None
    profile_id: str | None
    changeset_id: UUID | None
    status: str | None
    correlation_id: UUID
    causation_id: UUID | None
    field_changes: list[dict[str, Any]]
    duration_ms: int | None


@dataclass
class FileWriteJob:
    id: UUID
    project_id: UUID
    file_id: UUID
    expected_file_revision: int
    entity_revision: UUID
    status: str = "PENDING"
    operation: str = "WRITE_BACK"
    expected_file_hash: str | None = None
    source_path: str | None = None
    source_file_revision: int | None = None
    changeset_id: UUID | None = None
    result_file_revision: int | None = None
    result_file_hash: str | None = None
    backup_path: str | None = None
    plan_id: UUID | None = None
    destination_mode: str = "IN_PLACE"
    destination_path: str | None = None
    batch_strategy: str = "PER_FILE"
    confirmed: bool = False
    safety_enforced: bool = False


@dataclass
class WriteBackPreviewPlan:
    id: UUID
    project_id: UUID
    created_by: str
    created_at: datetime
    item_type: str
    item_ids: list[UUID]
    format: str
    destination_mode: str
    batch_strategy: str
    status: str
    confirmation_required: bool
    can_confirm: bool
    write_performed: bool
    files: list[dict[str, Any]]
    warnings: list[str]
