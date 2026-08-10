from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from ...shared.clock import utc_now

@dataclass
class OrganizeGroup:
    id: UUID
    project_id: UUID
    name: str
    parent_ids: list[UUID] = field(default_factory=list)
    status: str = "ACTIVE"
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class OrganizeTag:
    id: UUID
    project_id: UUID
    name: str
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class OrganizeGroupMembership:
    project_id: UUID
    item_type: str
    item_id: UUID
    group_id: UUID
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class OrganizeTagMembership:
    project_id: UUID
    item_type: str
    item_id: UUID
    tag_id: UUID
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class OrganizeItemLifecycle:
    project_id: UUID
    item_type: str
    item_id: UUID
    status: str
    updated_at: datetime = field(default_factory=utc_now)
