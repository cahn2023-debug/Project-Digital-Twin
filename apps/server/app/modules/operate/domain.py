from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

@dataclass
class Contractor:
    id: UUID
    project_id: UUID
    code: str
    name: str
    status: str = "ACTIVE"


@dataclass
class WorkPackage:
    id: UUID
    project_id: UUID
    contractor_id: UUID
    code: str
    name: str
    entity_ids: list[UUID] = field(default_factory=list)
    status: str = "DRAFT"


@dataclass
class FieldPackage:
    id: UUID
    project_id: UUID
    work_package_id: UUID
    entity_ids: list[UUID]
    status: str = "PUBLISHED"


@dataclass
class Observation:
    id: UUID
    project_id: UUID
    field_package_id: UUID
    entity_id: UUID
    base_revision: int
    observed_at: datetime
    operator_id: str
    gps: dict[str, Any] | None
    form_data: dict[str, Any]
    status: str
    changeset_id: UUID
    idempotency_key: str
