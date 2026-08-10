from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from ...shared.contracts import SourceLocator
from ...shared.clock import utc_now

@dataclass
class Camera:
    entity_id: UUID
    project_id: UUID
    code: str
    name: str | None = None
    intersection_id: UUID | None = None
    manufacturer: str | None = None
    model: str | None = None
    ip_address: str | None = None
    status: str | None = None
    properties: dict[str, Any] = field(default_factory=dict)
    source: SourceLocator | None = None


@dataclass(frozen=True)
class ImportIssue:
    code: str
    message: str
    row: int
    column: str | None = None


@dataclass
class ImportResult:
    inserted: list[Camera] = field(default_factory=list)
    changed: list[Camera] = field(default_factory=list)
    unchanged: list[Camera] = field(default_factory=list)
    invalid: list[ImportIssue] = field(default_factory=list)
    conflict: list[ImportIssue] = field(default_factory=list)
    unmapped: list[ImportIssue] = field(default_factory=list)
