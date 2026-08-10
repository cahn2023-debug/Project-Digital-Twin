from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from ...shared.clock import utc_now

@dataclass
class Project:
    id: UUID
    code: str
    name: str
    root_path: str
    status: str = "ACTIVE"
    schema_version: int = 1
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
