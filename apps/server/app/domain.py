from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from ipaddress import ip_address
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4
from zipfile import BadZipFile


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).strip().split())
    return text or None


def normalize_ip(value: Any) -> str | None:
    text = normalize_text(value)
    if text is None:
        return None
    if text.count(".") == 3:
        parts = text.split(".")
        try:
            octets = [int(part, 10) for part in parts]
        except ValueError as exc:
            raise ValueError("Invalid IP address") from exc
        if any(octet < 0 or octet > 255 for octet in octets):
            raise ValueError("Invalid IP address")
        return ".".join(str(octet) for octet in octets)
    try:
        return str(ip_address(text))
    except ValueError as exc:
        raise ValueError("Invalid IP address") from exc


def normalize_coordinate(value: Any, minimum: float, maximum: float, name: str) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {name}") from exc
    if not minimum <= number <= maximum:
        raise ValueError(f"Invalid {name}")
    return number


@dataclass(frozen=True)
class SourceLocator:
    file_id: UUID
    file_revision: int
    sheet: str
    row: int
    column: str


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


class RevisionConflict(Exception):
    def __init__(self, entity_id: UUID, base_revision: int, current_revision: int):
        self.entity_id = entity_id
        self.base_revision = base_revision
        self.current_revision = current_revision
        super().__init__(
            f"Revision conflict for {entity_id}: base={base_revision}, current={current_revision}"
        )


class FileImportConflict(Exception):
    def __init__(self, changeset_id: UUID, conflicts: list[dict[str, Any]]):
        self.changeset_id = changeset_id
        self.conflicts = conflicts
        super().__init__(f"File import conflict for {changeset_id}")


class FileWriteConflict(Exception):
    pass


class OrganizeValidationError(ValueError):
    pass


class OrganizeConflictError(ValueError):
    pass


class ProjectValidationError(ValueError):
    pass


class ProjectConflictError(ValueError):
    pass


class CameraStore:
    """In-memory canonical repository used until the PostgreSQL adapter is added."""

    def __init__(self) -> None:
        self.projects: dict[UUID, Project] = {}
        self.project_roots: dict[str, UUID] = {}
        self.cameras: dict[UUID, Camera] = {}
        self.camera_codes: dict[tuple[UUID, str], UUID] = {}
        self.revisions: dict[tuple[UUID, str], list[EntityRevision]] = {}
        self.contractors: dict[UUID, Contractor] = {}
        self.work_packages: dict[UUID, WorkPackage] = {}
        self.field_packages: dict[UUID, FieldPackage] = {}
        self.observations: dict[UUID, Observation] = {}
        self.changesets: dict[UUID, ChangeSet] = {}
        self.file_import_results: dict[UUID, ImportResult] = {}
        self.outbox: list[OutboxEvent] = []
        self.audit_events: list[AuditEvent] = []
        self.write_jobs: dict[UUID, FileWriteJob] = {}
        self.writeback_plans: dict[UUID, WriteBackPreviewPlan] = {}
        self.file_locks: dict[UUID, UUID] = {}
        self.file_versions: dict[UUID, list[dict[str, Any]]] = {}
        self.self_write_hashes: set[tuple[UUID, str]] = set()
        self.source_assets: dict[UUID, dict[str, Any]] = {}
        self.organize_groups: dict[UUID, OrganizeGroup] = {}
        self.organize_tags: dict[UUID, OrganizeTag] = {}
        self.organize_group_parents: set[tuple[UUID, UUID]] = set()
        self.organize_group_memberships: dict[tuple[UUID, str, UUID, UUID], datetime] = {}
        self.organize_tag_memberships: dict[tuple[UUID, str, UUID, UUID], datetime] = {}
        self.organize_item_lifecycle: dict[tuple[UUID, str, UUID], str] = {}
        self._idempotency: dict[str, UUID] = {}
        self._changeset_idempotency: dict[str, UUID] = {}
        self._file_import_idempotency: dict[tuple[UUID, int, str], UUID] = {}
        self._correlation_by_aggregate: dict[UUID, UUID] = {}
        self._last_event_by_aggregate: dict[UUID, UUID] = {}

    @staticmethod
    def _normalize_root_path(root_path: str) -> str:
        candidate = root_path.strip()
        if not candidate:
            raise ProjectValidationError("Project root directory is required")
        try:
            resolved = Path(candidate).expanduser().resolve(strict=True)
        except (OSError, RuntimeError) as exc:
            raise ProjectValidationError("Project root directory does not exist") from exc
        if not resolved.is_dir():
            raise ProjectValidationError("Project root path must be a directory")
        return str(resolved)

    @staticmethod
    def _root_key(root_path: str) -> str:
        return root_path.casefold()

    def _next_project_code(self) -> str:
        used_codes = {project.code for project in self.projects.values()}
        sequence = 1
        while f"P-{sequence:03d}" in used_codes:
            sequence += 1
        return f"P-{sequence:03d}"

    def create_project(self, name: str, root_path: str) -> Project:
        project_name = name.strip()
        if not project_name:
            raise ProjectValidationError("Project name is required")
        normalized_root = self._normalize_root_path(root_path)
        root_key = self._root_key(normalized_root)
        if root_key in self.project_roots:
            raise ProjectConflictError("Project root directory is already in use")
        project = Project(
            id=uuid4(),
            code=self._next_project_code(),
            name=project_name,
            root_path=normalized_root,
        )
        self.projects[project.id] = project
        self.project_roots[root_key] = project.id
        return project

    def get_project(self, project_id: UUID) -> Project | None:
        return self.projects.get(project_id)

    def list_projects(self, status: str = "ACTIVE") -> list[Project]:
        normalized_status = status.strip().upper()
        if normalized_status not in {"ACTIVE", "ARCHIVED", "DELETED"}:
            raise ProjectValidationError(f"Unsupported project status: {status}")
        return sorted(
            (project for project in self.projects.values() if project.status == normalized_status),
            key=lambda project: (project.created_at, str(project.id)),
        )

    def archive_project(self, project_id: UUID) -> Project:
        project = self.get_project(project_id)
        if project is None:
            raise KeyError("Project not found")
        if project.status != "ACTIVE":
            raise ProjectConflictError(f"Project cannot be archived from {project.status}")
        project.status = "ARCHIVED"
        project.updated_at = utc_now()
        return project

    def restore_project(self, project_id: UUID) -> Project:
        project = self.get_project(project_id)
        if project is None:
            raise KeyError("Project not found")
        if project.status != "ARCHIVED":
            raise ProjectConflictError(f"Project cannot be restored from {project.status}")
        project.status = "ACTIVE"
        project.updated_at = utc_now()
        return project

    def delete_project(self, project_id: UUID, name_confirmation: str) -> Project:
        project = self.get_project(project_id)
        if project is None:
            raise KeyError("Project not found")
        if project.status == "DELETED":
            raise ProjectConflictError("Project is already deleted")
        if project.name != name_confirmation.strip():
            raise ProjectConflictError("Project name confirmation does not match")
        project.status = "DELETED"
        project.updated_at = utc_now()
        self.project_roots.pop(self._root_key(project.root_path), None)
        return project

    def list_cameras(self, project_id: UUID) -> list[Camera]:
        return sorted(
            (camera for camera in self.cameras.values() if camera.project_id == project_id),
            key=lambda camera: camera.code,
        )

    @staticmethod
    def _organize_name(value: str, kind: str) -> str:
        normalized = normalize_text(value)
        if normalized is None:
            raise OrganizeValidationError(f"Organize {kind} name is required")
        return normalized

    @staticmethod
    def _organize_item_type(item_type: str) -> str:
        normalized = item_type.strip().upper()
        if normalized not in {"ENTITY", "SOURCE_FILE", "IMPORT"}:
            raise OrganizeValidationError(f"Unsupported Organize item type: {item_type}")
        return normalized

    def _organize_items(self, project_id: UUID, item_type: str, item_ids: set[UUID]) -> None:
        if item_type != "ENTITY":
            return
        for item_id in item_ids:
            camera = self.cameras.get(item_id)
            if camera is not None and camera.project_id != project_id:
                raise OrganizeConflictError("Organize item belongs to another project")

    def _require_organize_project(self, project_id: UUID) -> Project:
        project = self.get_project(project_id)
        if project is None:
            raise KeyError("Project not found")
        if project.status == "DELETED":
            raise OrganizeConflictError("Deleted projects cannot be organized")
        return project

    def _organize_group(self, project_id: UUID, group_id: UUID) -> OrganizeGroup:
        group = self.organize_groups.get(group_id)
        if group is None:
            raise KeyError("Organize group not found")
        if group.project_id != project_id:
            raise OrganizeConflictError("Organize group belongs to another project")
        return group

    def _organize_tag(self, project_id: UUID, tag_id: UUID) -> OrganizeTag:
        tag = self.organize_tags.get(tag_id)
        if tag is None:
            raise KeyError("Organize tag not found")
        if tag.project_id != project_id:
            raise OrganizeConflictError("Organize tag belongs to another project")
        return tag

    def _organize_parent_ids(self, group_id: UUID) -> set[UUID]:
        return {
            parent_id
            for child_id, parent_id in self.organize_group_parents
            if child_id == group_id
        }

    def _would_create_organize_cycle(self, group_id: UUID, parent_ids: set[UUID]) -> bool:
        pending = list(parent_ids)
        visited: set[UUID] = set()
        while pending:
            current = pending.pop()
            if current == group_id:
                return True
            if current in visited:
                continue
            visited.add(current)
            pending.extend(self._organize_parent_ids(current))
        return False

    def create_organize_group(
        self,
        project_id: UUID,
        name: str,
        parent_ids: list[UUID] | None = None,
    ) -> OrganizeGroup:
        self._require_organize_project(project_id)
        group_name = self._organize_name(name, "group")
        if any(
            group.project_id == project_id and group.name.casefold() == group_name.casefold()
            for group in self.organize_groups.values()
        ):
            raise OrganizeConflictError("Organize group name is already in use")
        normalized_parents = set(parent_ids or [])
        for parent_id in normalized_parents:
            self._organize_group(project_id, parent_id)
        group_id = uuid4()
        group = OrganizeGroup(
            id=group_id,
            project_id=project_id,
            name=group_name,
            parent_ids=sorted(normalized_parents, key=str),
        )
        self.organize_groups[group_id] = group
        self.organize_group_parents.update((group_id, parent_id) for parent_id in normalized_parents)
        return group

    def rename_organize_group(self, project_id: UUID, group_id: UUID, name: str) -> OrganizeGroup:
        group = self._organize_group(project_id, group_id)
        group_name = self._organize_name(name, "group")
        if any(
            candidate.project_id == project_id
            and candidate.id != group_id
            and candidate.name.casefold() == group_name.casefold()
            for candidate in self.organize_groups.values()
        ):
            raise OrganizeConflictError("Organize group name is already in use")
        group.name = group_name
        group.updated_at = utc_now()
        return group

    def update_organize_group(
        self,
        project_id: UUID,
        group_id: UUID,
        *,
        name: str | None = None,
        parent_ids: list[UUID] | None = None,
        status: str | None = None,
    ) -> OrganizeGroup:
        group = self._organize_group(project_id, group_id)
        if name is None and parent_ids is None and status is None:
            raise OrganizeValidationError("Organize group update is empty")

        group_name = self._organize_name(name, "group") if name is not None else group.name
        if any(
            candidate.project_id == project_id
            and candidate.id != group_id
            and candidate.name.casefold() == group_name.casefold()
            for candidate in self.organize_groups.values()
        ):
            raise OrganizeConflictError("Organize group name is already in use")

        normalized_parents = set(parent_ids) if parent_ids is not None else set(group.parent_ids)
        for parent_id in normalized_parents:
            self._organize_group(project_id, parent_id)
        if self._would_create_organize_cycle(group_id, normalized_parents):
            raise OrganizeConflictError("Organize group hierarchy cannot contain a cycle")

        normalized_status = status.strip().upper() if status is not None else group.status
        if normalized_status not in {"ACTIVE", "ARCHIVED"}:
            raise OrganizeValidationError(f"Unsupported Organize group status: {status}")

        if parent_ids is not None:
            self.organize_group_parents.difference_update(
                (child_id, existing_parent_id)
                for child_id, existing_parent_id in self.organize_group_parents
                if child_id == group_id
            )
            self.organize_group_parents.update((group_id, parent_id) for parent_id in normalized_parents)
        group.name = group_name
        group.parent_ids = sorted(normalized_parents, key=str)
        group.status = normalized_status
        group.updated_at = utc_now()
        return group

    def move_organize_group(
        self,
        project_id: UUID,
        group_id: UUID,
        parent_ids: list[UUID],
    ) -> OrganizeGroup:
        group = self._organize_group(project_id, group_id)
        normalized_parents = set(parent_ids)
        for parent_id in normalized_parents:
            self._organize_group(project_id, parent_id)
        if self._would_create_organize_cycle(group_id, normalized_parents):
            raise OrganizeConflictError("Organize group hierarchy cannot contain a cycle")
        self.organize_group_parents.difference_update(
            (child_id, parent_id)
            for child_id, parent_id in self.organize_group_parents
            if child_id == group_id
        )
        self.organize_group_parents.update((group_id, parent_id) for parent_id in normalized_parents)
        group.parent_ids = sorted(normalized_parents, key=str)
        group.updated_at = utc_now()
        return group

    def set_organize_group_status(self, project_id: UUID, group_id: UUID, status: str) -> OrganizeGroup:
        group = self._organize_group(project_id, group_id)
        normalized_status = status.strip().upper()
        if normalized_status not in {"ACTIVE", "ARCHIVED"}:
            raise OrganizeValidationError(f"Unsupported Organize group status: {status}")
        group.status = normalized_status
        group.updated_at = utc_now()
        return group

    def delete_organize_group(self, project_id: UUID, group_id: UUID) -> None:
        self._organize_group(project_id, group_id)
        self.organize_groups.pop(group_id)
        self.organize_group_parents = {
            (child_id, parent_id)
            for child_id, parent_id in self.organize_group_parents
            if child_id != group_id and parent_id != group_id
        }
        for group in self.organize_groups.values():
            if group.project_id == project_id and group_id in group.parent_ids:
                group.parent_ids = [parent_id for parent_id in group.parent_ids if parent_id != group_id]
                group.updated_at = utc_now()
        self.organize_group_memberships = {
            membership: created_at
            for membership, created_at in self.organize_group_memberships.items()
            if membership[0] != project_id or membership[3] != group_id
        }

    def list_organize_groups(self, project_id: UUID, include_archived: bool = False) -> list[OrganizeGroup]:
        self._require_organize_project(project_id)
        return sorted(
            (
                group
                for group in self.organize_groups.values()
                if group.project_id == project_id and (include_archived or group.status == "ACTIVE")
            ),
            key=lambda group: (group.name.casefold(), str(group.id)),
        )

    def create_organize_tag(self, project_id: UUID, name: str) -> OrganizeTag:
        self._require_organize_project(project_id)
        tag_name = self._organize_name(name, "tag")
        if any(
            tag.project_id == project_id and tag.name.casefold() == tag_name.casefold()
            for tag in self.organize_tags.values()
        ):
            raise OrganizeConflictError("Organize tag name is already in use")
        tag = OrganizeTag(id=uuid4(), project_id=project_id, name=tag_name)
        self.organize_tags[tag.id] = tag
        return tag

    def assign_organize_groups(
        self,
        project_id: UUID,
        item_type: str,
        item_ids: list[UUID],
        group_ids: list[UUID],
        replace: bool = False,
    ) -> list[OrganizeGroupMembership]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type)
        normalized_items = set(item_ids)
        normalized_groups = set(group_ids)
        for group_id in normalized_groups:
            self._organize_group(project_id, group_id)
        if replace:
            self.organize_group_memberships = {
                membership: created_at
                for membership, created_at in self.organize_group_memberships.items()
                if not (
                    membership[0] == project_id
                    and membership[1] == normalized_type
                    and membership[2] in normalized_items
                )
            }
        self._organize_items(project_id, normalized_type, normalized_items)
        for item_id in normalized_items:
            for group_id in normalized_groups:
                key = (project_id, normalized_type, item_id, group_id)
                self.organize_group_memberships.setdefault(key, utc_now())
        return self.list_organize_group_memberships(project_id, normalized_type, normalized_items)

    def validate_organize_membership_targets(
        self,
        project_id: UUID,
        group_ids: list[UUID],
        tag_ids: list[UUID],
    ) -> None:
        self._require_organize_project(project_id)
        for group_id in set(group_ids):
            self._organize_group(project_id, group_id)
        for tag_id in set(tag_ids):
            self._organize_tag(project_id, tag_id)

    def remove_organize_groups(
        self,
        project_id: UUID,
        item_type: str,
        item_ids: list[UUID],
        group_ids: list[UUID],
    ) -> list[OrganizeGroupMembership]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type)
        normalized_items = set(item_ids)
        normalized_groups = set(group_ids)
        self.organize_group_memberships = {
            membership: created_at
            for membership, created_at in self.organize_group_memberships.items()
            if not (
                membership[0] == project_id
                and membership[1] == normalized_type
                and membership[2] in normalized_items
                and membership[3] in normalized_groups
            )
        }
        return self.list_organize_group_memberships(project_id, normalized_type, normalized_items)

    def list_organize_group_memberships(
        self,
        project_id: UUID,
        item_type: str | None = None,
        item_ids: set[UUID] | None = None,
    ) -> list[OrganizeGroupMembership]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type) if item_type else None
        return sorted(
            (
                OrganizeGroupMembership(project_id, membership[1], membership[2], membership[3], created_at)
                for membership, created_at in self.organize_group_memberships.items()
                if membership[0] == project_id
                and (normalized_type is None or membership[1] == normalized_type)
                and (item_ids is None or membership[2] in item_ids)
            ),
            key=lambda membership: (membership.item_type, str(membership.item_id), str(membership.group_id)),
        )

    def assign_organize_tags(
        self,
        project_id: UUID,
        item_type: str,
        item_ids: list[UUID],
        tag_ids: list[UUID],
        replace: bool = False,
    ) -> list[OrganizeTagMembership]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type)
        normalized_items = set(item_ids)
        normalized_tags = set(tag_ids)
        for tag_id in normalized_tags:
            self._organize_tag(project_id, tag_id)
        if replace:
            self.organize_tag_memberships = {
                membership: created_at
                for membership, created_at in self.organize_tag_memberships.items()
                if not (
                    membership[0] == project_id
                    and membership[1] == normalized_type
                    and membership[2] in normalized_items
                )
            }
        self._organize_items(project_id, normalized_type, normalized_items)
        for item_id in normalized_items:
            for tag_id in normalized_tags:
                key = (project_id, normalized_type, item_id, tag_id)
                self.organize_tag_memberships.setdefault(key, utc_now())
        return self.list_organize_tag_memberships(project_id, normalized_type, normalized_items)

    def remove_organize_tags(
        self,
        project_id: UUID,
        item_type: str,
        item_ids: list[UUID],
        tag_ids: list[UUID],
    ) -> list[OrganizeTagMembership]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type)
        normalized_items = set(item_ids)
        normalized_tags = set(tag_ids)
        self.organize_tag_memberships = {
            membership: created_at
            for membership, created_at in self.organize_tag_memberships.items()
            if not (
                membership[0] == project_id
                and membership[1] == normalized_type
                and membership[2] in normalized_items
                and membership[3] in normalized_tags
            )
        }
        return self.list_organize_tag_memberships(project_id, normalized_type, normalized_items)

    def list_organize_tag_memberships(
        self,
        project_id: UUID,
        item_type: str | None = None,
        item_ids: set[UUID] | None = None,
    ) -> list[OrganizeTagMembership]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type) if item_type else None
        return sorted(
            (
                OrganizeTagMembership(project_id, membership[1], membership[2], membership[3], created_at)
                for membership, created_at in self.organize_tag_memberships.items()
                if membership[0] == project_id
                and (normalized_type is None or membership[1] == normalized_type)
                and (item_ids is None or membership[2] in item_ids)
            ),
            key=lambda membership: (membership.item_type, str(membership.item_id), str(membership.tag_id)),
        )

    def set_organize_item_status(
        self,
        project_id: UUID,
        item_type: str,
        item_ids: list[UUID],
        status: str,
    ) -> list[OrganizeItemLifecycle]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type)
        normalized_status = status.strip().upper()
        if normalized_status not in {"ACTIVE", "ARCHIVED", "DELETED"}:
            raise OrganizeValidationError(f"Unsupported Organize lifecycle status: {status}")
        normalized_items = set(item_ids)
        self._organize_items(project_id, normalized_type, normalized_items)
        now = utc_now()
        for item_id in normalized_items:
            self.organize_item_lifecycle[(project_id, normalized_type, item_id)] = normalized_status
        return [
            OrganizeItemLifecycle(project_id, normalized_type, item_id, normalized_status, now)
            for item_id in sorted(normalized_items, key=str)
        ]

    def restore_organize_items(
        self,
        project_id: UUID,
        item_type: str,
        item_ids: list[UUID],
    ) -> list[OrganizeItemLifecycle]:
        return self.set_organize_item_status(project_id, item_type, item_ids, "ACTIVE")

    def record_organize_event(
        self,
        project_id: UUID,
        event_type: str,
        aggregate_id: UUID,
        actor: str,
        payload: dict[str, Any],
        *,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
        status: str = "APPLIED",
    ) -> OutboxEvent:
        self._require_organize_project(project_id)
        return self._add_event(
            event_type,
            aggregate_id,
            project_id,
            len(self.outbox) + 1,
            payload,
            actor=actor,
            object_id=aggregate_id,
            status=status,
            before=before,
            after=after,
        )

    def organize_snapshot(
        self,
        project_id: UUID,
        *,
        query: str | None = None,
        item_type: str | None = None,
        group_id: UUID | None = None,
        tag_id: UUID | None = None,
        status: str | None = None,
        source_file_id: UUID | None = None,
    ) -> dict[str, Any]:
        self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type) if item_type else None
        normalized_status = status.strip().upper() if status else None
        if normalized_status is not None and normalized_status not in {"ACTIVE", "ARCHIVED", "DELETED"}:
            raise OrganizeValidationError(f"Unsupported Organize lifecycle status: {status}")
        if group_id is not None:
            self._organize_group(project_id, group_id)
        if tag_id is not None:
            self._organize_tag(project_id, tag_id)
        query_text = query.strip().casefold() if query else None

        def memberships(item_kind: str, item_id: UUID) -> tuple[list[UUID], list[UUID]]:
            groups = sorted((
                membership[3]
                for membership in self.organize_group_memberships
                if membership[0] == project_id
                and membership[1] == item_kind
                and membership[2] == item_id
            ), key=str)
            tags = sorted((
                membership[3]
                for membership in self.organize_tag_memberships
                if membership[0] == project_id
                and membership[1] == item_kind
                and membership[2] == item_id
            ), key=str)
            return groups, tags

        def include_item(item: dict[str, Any]) -> bool:
            if normalized_type is not None and item["type"] != normalized_type:
                return False
            if normalized_status is not None and item["status"] != normalized_status:
                return False
            if group_id is not None and group_id not in item["group_ids"]:
                return False
            if tag_id is not None and tag_id not in item["tag_ids"]:
                return False
            if source_file_id is not None and item.get("source_file_id") != source_file_id:
                return False
            if query_text:
                searchable = " ".join(
                    str(item.get(field) or "")
                    for field in ("name", "code", "status", "import_status", "source_path")
                ).casefold()
                if query_text not in searchable:
                    return False
            return True

        items: list[dict[str, Any]] = []
        for camera in self.list_cameras(project_id):
            group_ids, tag_ids = memberships("ENTITY", camera.entity_id)
            status_value = self.organize_item_lifecycle.get((project_id, "ENTITY", camera.entity_id), "ACTIVE")
            source = asdict(camera.source) if camera.source else None
            source_file = camera.source.file_id if camera.source else None
            source_revision = camera.source.file_revision if camera.source else None
            item = {
                "type": "ENTITY",
                "id": camera.entity_id,
                "name": camera.name or camera.code,
                "code": camera.code,
                "status": status_value,
                "group_ids": group_ids,
                "tag_ids": tag_ids,
                "metadata": self._camera_payload(camera),
                "source": source,
                "source_file_id": source_file,
                "file_revision": source_revision,
                "source_path": None,
                "import_status": None,
            }
            if include_item(item):
                items.append(item)

        project_file_ids = {
            event.file_id
            for event in self.audit_events
            if event.project_id == project_id and event.file_id is not None
        }
        project_file_ids.update(
            changeset.file_id
            for changeset in self.changesets.values()
            if changeset.project_id == project_id and changeset.file_id is not None
        )
        project_file_ids.update(
            job.file_id
            for job in self.write_jobs.values()
            if job.project_id == project_id
        )
        for file_id in sorted(project_file_ids, key=str):
            versions = self.file_versions.get(file_id, [])
            latest = versions[-1] if versions else None
            group_ids, tag_ids = memberships("SOURCE_FILE", file_id)
            status_value = self.organize_item_lifecycle.get((project_id, "SOURCE_FILE", file_id), "ACTIVE")
            item = {
                "type": "SOURCE_FILE",
                "id": file_id,
                "name": (latest or {}).get("source_path") or str(file_id),
                "code": None,
                "status": status_value,
                "group_ids": group_ids,
                "tag_ids": tag_ids,
                "metadata": {"version_count": len(versions)},
                "source": latest,
                "source_file_id": file_id,
                "file_revision": (latest or {}).get("revision"),
                "source_path": (latest or {}).get("source_path"),
                "import_status": None,
            }
            if include_item(item):
                items.append(item)

        for changeset in sorted(self.changesets.values(), key=lambda value: (value.submitted_at, str(value.id))):
            if changeset.project_id != project_id:
                continue
            group_ids, tag_ids = memberships("IMPORT", changeset.id)
            status_value = self.organize_item_lifecycle.get((project_id, "IMPORT", changeset.id), "ACTIVE")
            versions = self.file_versions.get(changeset.file_id, []) if changeset.file_id else []
            latest = versions[-1] if versions else None
            item = {
                "type": "IMPORT",
                "id": changeset.id,
                "name": changeset.origin,
                "code": None,
                "status": status_value,
                "group_ids": group_ids,
                "tag_ids": tag_ids,
                "metadata": {"submitted_by": changeset.submitted_by, "raw_count": len(changeset.raw_rows)},
                "source": {
                    "file_id": changeset.file_id,
                    "file_revision": changeset.file_revision,
                    "sha256": changeset.file_hash,
                    "version": latest,
                },
                "source_file_id": changeset.file_id,
                "file_revision": changeset.file_revision,
                "source_path": (latest or {}).get("source_path"),
                "import_status": changeset.status,
            }
            if include_item(item):
                items.append(item)

        return {
            "groups": self.list_organize_groups(project_id, include_archived=normalized_status in {"ARCHIVED", "DELETED"}),
            "tags": sorted(
                (tag for tag in self.organize_tags.values() if tag.project_id == project_id),
                key=lambda tag: (tag.name.casefold(), str(tag.id)),
            ),
            "items": sorted(items, key=lambda item: (item["type"], str(item.get("name") or ""), str(item["id"]))),
        }

    def import_camera(self, project_id: UUID, camera: Camera, created_by: str) -> str:
        key = (project_id, camera.code)
        existing_id = self.camera_codes.get(key)
        if existing_id is None:
            self.cameras[camera.entity_id] = camera
            self.camera_codes[key] = camera.entity_id
            self._append_revision(camera, "DESIGNED", created_by, None)
            return "inserted"

        existing = self.cameras[existing_id]
        if self._camera_payload(existing) == self._camera_payload(camera):
            return "unchanged"

        camera.entity_id = existing.entity_id
        self.cameras[existing.entity_id] = camera
        self._append_revision(camera, "DESIGNED", created_by, None)
        return "changed"

    def create_file_import_changeset(
        self,
        project_id: UUID,
        file_id: UUID,
        file_revision: int,
        cameras: list[Camera],
        issues: list[ImportIssue],
        raw_rows: list[dict[str, Any]],
        created_by: str,
        idempotency_key: str,
        source_hash: str | None = None,
        duration_ms: int | None = None,
    ) -> tuple[ChangeSet, ImportResult]:
        file_hash = source_hash or self._raw_rows_hash(raw_rows)
        existing_id = self._changeset_idempotency.get(idempotency_key)
        if existing_id is not None:
            return self.changesets[existing_id], self.file_import_results[existing_id]
        existing_id = self._file_import_idempotency.get((file_id, file_revision, file_hash))
        if existing_id is not None:
            return self.changesets[existing_id], self.file_import_results[existing_id]
        if self.get_project(project_id) is None:
            raise KeyError("Project not found")

        result = ImportResult(invalid=issues)
        items: list[dict[str, Any]] = []
        for camera in cameras:
            camera.project_id = project_id
            existing_id_for_code = self.camera_codes.get((project_id, camera.code))
            if existing_id_for_code is None:
                result.inserted.append(camera)
                entity_id = camera.entity_id
                base_revision = 0
                base_payload: dict[str, Any] = {}
            else:
                entity_id = existing_id_for_code
                existing = self.cameras[existing_id_for_code]
                camera.entity_id = existing_id_for_code
                base_revision = self.current_revision(entity_id, "DESIGNED").revision if self.current_revision(entity_id, "DESIGNED") else 0
                base_payload = self._camera_payload(existing)
                if base_payload == self._camera_payload(camera):
                    result.unchanged.append(camera)
                    continue
                result.changed.append(camera)
            items.append(
                {
                    "entity_id": str(entity_id),
                    "base_revision": base_revision,
                    "base_payload": base_payload,
                    "patch": self._camera_payload(camera),
                }
            )

        first = items[0] if items else {"entity_id": str(uuid4()), "base_revision": 0, "patch": {}}
        changeset = ChangeSet(
            id=uuid4(),
            project_id=project_id,
            origin="FILE_IMPORT",
            submitted_by=created_by,
            submitted_at=utc_now(),
            status="PENDING_APPROVAL",
            entity_id=UUID(first["entity_id"]),
            representation="DESIGNED",
            base_revision=first["base_revision"],
            patch=first["patch"],
            file_id=file_id,
            file_revision=file_revision,
            file_hash=file_hash,
            items=items,
            raw_rows=raw_rows,
        )
        self.changesets[changeset.id] = changeset
        self.file_import_results[changeset.id] = result
        self._changeset_idempotency[idempotency_key] = changeset.id
        self._file_import_idempotency[(file_id, file_revision, file_hash)] = changeset.id
        self._add_event(
            "FileImportSubmitted",
            changeset.id,
            project_id,
            file_revision,
            {"file_id": str(file_id), "file_revision": file_revision, "raw_rows": len(raw_rows)},
            actor=created_by,
            file_id=file_id,
            changeset_id=changeset.id,
            status=changeset.status,
            duration_ms=duration_ms,
        )
        return changeset, result

    def file_import_result(self, changeset_id: UUID) -> ImportResult | None:
        return self.file_import_results.get(changeset_id)

    def create_document_import_changeset(
        self,
        project_id: UUID,
        parsed: Any,
        created_by: str,
        duration_ms: int | None = None,
    ) -> ChangeSet:
        if self.get_project(project_id) is None:
            raise KeyError("Project not found")
        proposals = [asdict(proposal) for proposal in parsed.relationship_proposals]
        assets = [asdict(asset) for asset in parsed.assets]
        tables = [asdict(table) for table in parsed.tables]
        mapped_tables = [asdict(table) for table in parsed.mapped_tables]
        self.source_assets.update({asset["id"]: asset for asset in assets})
        changeset = ChangeSet(
            id=uuid4(),
            project_id=project_id,
            origin="DOCUMENT_IMPORT",
            submitted_by=created_by,
            submitted_at=utc_now(),
            status="PENDING_APPROVAL",
            entity_id=UUID(int=0),
            representation="DOCUMENT",
            base_revision=parsed.file_revision,
            patch={"relationship_proposals": proposals, "mapped_tables": mapped_tables},
            file_id=parsed.file_id,
            file_revision=parsed.file_revision,
            file_hash=parsed.source_hash,
            raw_rows=[asdict(node) for node in parsed.nodes],
            document_assets=assets,
            relationship_proposals=proposals,
            document_tables=tables,
            document_mapped_tables=mapped_tables,
        )
        self.changesets[changeset.id] = changeset
        self._add_event(
            "DocumentImportSubmitted",
            changeset.id,
            project_id,
            parsed.file_revision,
            {
                "file_id": str(parsed.file_id),
                "file_revision": parsed.file_revision,
                "assets": len(assets),
                "relationship_proposals": len(proposals),
            },
            actor=created_by,
            file_id=parsed.file_id,
            changeset_id=changeset.id,
            status=changeset.status,
            duration_ms=duration_ms,
        )
        return changeset

    def approve_file_import_changeset(
        self,
        project_id: UUID,
        changeset_id: UUID,
        approved_by: str,
    ) -> tuple[ChangeSet, list[EntityRevision]]:
        changeset = self.changesets.get(changeset_id)
        if changeset is None or changeset.project_id != project_id:
            raise KeyError("ChangeSet not found")
        if changeset.origin != "FILE_IMPORT":
            raise ValueError("ChangeSet is not a file import")
        if changeset.status != "PENDING_APPROVAL":
            raise ValueError(f"ChangeSet cannot be approved from {changeset.status}")

        resolved: list[dict[str, Any]] = []
        conflicts: list[dict[str, Any]] = []
        for item in changeset.items:
            entity_id = UUID(item["entity_id"])
            existing = self.cameras.get(entity_id)
            current = self.current_revision(entity_id, "DESIGNED")
            if existing is None or current is None or current.revision == item["base_revision"]:
                resolved.append({**item, "patch": dict(item["patch"])})
                continue
            server_payload = self._camera_payload(existing)
            base_payload = item["base_payload"]
            client_payload = item["patch"]
            merged = dict(server_payload)
            field_conflicts: list[dict[str, Any]] = []
            for field_name, client_value in client_payload.items():
                base_value = base_payload.get(field_name)
                server_value = server_payload.get(field_name)
                if server_value == base_value:
                    merged[field_name] = client_value
                elif client_value != base_value and client_value != server_value:
                    field_conflicts.append(
                        {
                            "field": field_name,
                            "base": base_value,
                            "server": server_value,
                            "local": client_value,
                        }
                    )
            if field_conflicts:
                conflicts.append({"entity_id": str(entity_id), "fields": field_conflicts})
            else:
                resolved.append({**item, "patch": merged})

        if conflicts:
            changeset.status = "CONFLICT"
            changeset.conflicts = conflicts
            self._add_event(
                "FileImportConflict",
                changeset.id,
                project_id,
                changeset.file_revision or 0,
                {"file_id": str(changeset.file_id), "conflicts": conflicts},
                actor=approved_by,
                file_id=changeset.file_id,
                changeset_id=changeset.id,
                status=changeset.status,
            )
            raise FileImportConflict(changeset.id, conflicts)

        changeset.status = "APPROVED"
        revisions: list[EntityRevision] = []
        for item in resolved:
            entity_id = UUID(item["entity_id"])
            patch = item["patch"]
            camera = self.cameras.get(entity_id)
            if camera is None:
                camera = self._camera_from_payload(entity_id, project_id, patch)
                self.cameras[entity_id] = camera
            else:
                self._apply_camera_payload(camera, patch)
            self.camera_codes[(project_id, camera.code)] = entity_id
            revisions.append(self._append_revision(camera, "DESIGNED", approved_by, changeset.id, data=patch))
        changeset.status = "APPLIED"
        self._add_event(
            "FileImportApplied",
            changeset.id,
            project_id,
            changeset.file_revision or 0,
            {"file_id": str(changeset.file_id), "revisions": [str(revision.id) for revision in revisions]},
            actor=approved_by,
            file_id=changeset.file_id,
            changeset_id=changeset.id,
            status=changeset.status,
            before=changeset.items[0].get("base_payload", {}) if changeset.items else {},
            after=changeset.items[0].get("patch", {}) if changeset.items else {},
            duration_ms=None,
        )
        return changeset, revisions

    def update_geometry(
        self,
        project_id: UUID,
        entity_id: UUID,
        latitude: float,
        longitude: float,
        base_revision: int,
        created_by: str,
    ) -> EntityRevision:
        camera = self.cameras.get(entity_id)
        if camera is None or camera.project_id != project_id:
            raise KeyError("Camera not found")
        current = self.current_revision(entity_id, "DESIGNED")
        if current is None or current.revision != base_revision:
            raise RevisionConflict(entity_id, base_revision, current.revision if current else 0)
        changeset_id = uuid4()
        revision = self._append_revision(
            camera,
            "DESIGNED",
            created_by,
            changeset_id,
            geometry={"latitude": latitude, "longitude": longitude},
        )
        return revision

    def current_revision(self, entity_id: UUID, representation: str) -> EntityRevision | None:
        revisions = self.revisions.get((entity_id, representation), [])
        return revisions[-1] if revisions else None

    def create_contractor(self, project_id: UUID, code: str, name: str) -> Contractor:
        if self.get_project(project_id) is None:
            raise KeyError("Project not found")
        contractor = Contractor(id=uuid4(), project_id=project_id, code=code, name=name)
        self.contractors[contractor.id] = contractor
        return contractor

    def create_work_package(
        self,
        project_id: UUID,
        contractor_id: UUID,
        code: str,
        name: str,
        entity_ids: list[UUID],
    ) -> WorkPackage:
        contractor = self.contractors.get(contractor_id)
        if contractor is None or contractor.project_id != project_id:
            raise KeyError("Contractor not found")
        if any(entity_id not in self.cameras for entity_id in entity_ids):
            raise KeyError("Camera not found")
        work_package = WorkPackage(
            id=uuid4(), project_id=project_id, contractor_id=contractor_id,
            code=code, name=name, entity_ids=entity_ids, status="READY"
        )
        self.work_packages[work_package.id] = work_package
        return work_package

    def create_field_package(self, project_id: UUID, work_package_id: UUID) -> FieldPackage:
        work_package = self.work_packages.get(work_package_id)
        if work_package is None or work_package.project_id != project_id:
            raise KeyError("Work package not found")
        field_package = FieldPackage(
            id=uuid4(), project_id=project_id, work_package_id=work_package_id,
            entity_ids=list(work_package.entity_ids)
        )
        self.field_packages[field_package.id] = field_package
        return field_package

    def submit_observation(
        self,
        project_id: UUID,
        field_package_id: UUID,
        entity_id: UUID,
        base_revision: int,
        operator_id: str,
        gps: dict[str, Any] | None,
        form_data: dict[str, Any],
        idempotency_key: str,
    ) -> Observation:
        existing_id = self._idempotency.get(idempotency_key)
        if existing_id is not None:
            return self.observations[existing_id]
        field_package = self.field_packages.get(field_package_id)
        if field_package is None or field_package.project_id != project_id or entity_id not in field_package.entity_ids:
            raise KeyError("Entity is not in field package")
        if entity_id not in self.cameras or self.cameras[entity_id].project_id != project_id:
            raise KeyError("Camera not found")
        changeset_id = uuid4()
        changeset = ChangeSet(
            id=changeset_id, project_id=project_id, origin="OPERATE_FIELD",
            submitted_by=operator_id, submitted_at=utc_now(), status="PENDING_APPROVAL",
            entity_id=entity_id, representation="AS_BUILT", base_revision=base_revision,
            patch={"form_data": form_data, "gps": gps},
        )
        observation = Observation(
            id=uuid4(), project_id=project_id, field_package_id=field_package_id,
            entity_id=entity_id, base_revision=base_revision, observed_at=utc_now(),
            operator_id=operator_id, gps=gps, form_data=form_data, status="SUBMITTED",
            changeset_id=changeset_id, idempotency_key=idempotency_key,
        )
        self.changesets[changeset_id] = changeset
        self.observations[observation.id] = observation
        self._idempotency[idempotency_key] = observation.id
        self._add_event(
            "ObservationSubmitted",
            observation.id,
            project_id,
            1,
            {"changeset_id": str(changeset_id)},
            actor=operator_id,
            object_id=observation.entity_id,
            changeset_id=changeset_id,
            status=observation.status,
            duration_ms=None,
        )
        return observation

    def approve_changeset(self, project_id: UUID, changeset_id: UUID, approved_by: str) -> tuple[ChangeSet, EntityRevision]:
        changeset = self.changesets.get(changeset_id)
        if changeset is None or changeset.project_id != project_id:
            raise KeyError("ChangeSet not found")
        if changeset.status != "PENDING_APPROVAL":
            raise ValueError(f"ChangeSet cannot be approved from {changeset.status}")
        current_designed = self.current_revision(changeset.entity_id, "DESIGNED")
        if current_designed is None or current_designed.revision != changeset.base_revision:
            changeset.status = "CONFLICT"
            raise RevisionConflict(changeset.entity_id, changeset.base_revision, current_designed.revision if current_designed else 0)
        camera = self.cameras[changeset.entity_id]
        changeset.status = "APPROVED"
        revision = self._append_revision(
            camera, "AS_BUILT", approved_by, changeset.id,
            data={**self._camera_payload(camera), **changeset.patch},
        )
        changeset.status = "APPLIED"
        self._add_event(
            "AsBuiltRevisionCreated",
            revision.entity_id,
            project_id,
            revision.revision,
            {"revision_id": str(revision.id)},
            actor=approved_by,
            object_id=revision.entity_id,
            changeset_id=changeset.id,
            status=changeset.status,
            before=self._camera_payload(camera),
            after=revision.data,
            duration_ms=None,
        )
        return changeset, revision

    def changes_after(self, project_id: UUID, cursor: int) -> list[OutboxEvent]:
        return [event for event in self.outbox if event.project_id == project_id and event.cursor > cursor]

    def dashboard(self, project_id: UUID) -> dict[str, Any]:
        cameras = self.list_cameras(project_id)
        assigned = {entity_id for package in self.work_packages.values() if package.project_id == project_id for entity_id in package.entity_ids}
        observations = [item for item in self.observations.values() if item.project_id == project_id]
        changesets = [item for item in self.changesets.values() if item.project_id == project_id]
        as_built = sum(1 for camera in cameras if self.current_revision(camera.entity_id, "AS_BUILT") is not None)
        return {
            "total_camera": len(cameras),
            "assigned": len(assigned),
            "field_verified": len({item.entity_id for item in observations}),
            "pending_approval": sum(1 for item in changesets if item.status == "PENDING_APPROVAL"),
            "approved_as_built": as_built,
            "conflict": sum(1 for item in changesets if item.status == "CONFLICT"),
            "projection_cursor": self.outbox[-1].cursor if self.outbox else 0,
        }

    def create_write_job(
        self,
        project_id: UUID,
        file_id: UUID,
        expected_file_revision: int,
        entity_revision: UUID,
        expected_file_hash: str | None = None,
        source_path: str | None = None,
        *,
        plan_id: UUID | None = None,
        destination_mode: str = "IN_PLACE",
        destination_path: str | None = None,
        batch_strategy: str = "PER_FILE",
        confirmed: bool = False,
        safety_enforced: bool = False,
    ) -> FileWriteJob:
        job = FileWriteJob(
            id=uuid4(), project_id=project_id, file_id=file_id,
            expected_file_revision=expected_file_revision, entity_revision=entity_revision,
            expected_file_hash=expected_file_hash, source_path=source_path,
            plan_id=plan_id, destination_mode=destination_mode, destination_path=destination_path,
            batch_strategy=batch_strategy, confirmed=confirmed, safety_enforced=safety_enforced,
        )
        if safety_enforced:
            if not confirmed:
                raise OrganizeValidationError("Write job requires explicit confirmation")
            if file_id in self.file_locks:
                raise FileWriteConflict("FILE_LOCKED: another write job is active")
            self.file_locks[file_id] = job.id
        self.write_jobs[job.id] = job
        self._add_event(
            "FileWriteJobCreated",
            job.id,
            project_id,
            expected_file_revision,
            {
                "file_id": str(file_id),
                "operation": job.operation,
                "plan_id": str(plan_id) if plan_id else None,
                "destination_mode": destination_mode,
                "destination_path": destination_path,
                "batch_strategy": batch_strategy,
                "confirmed": confirmed,
            },
            file_id=file_id,
            status=job.status,
            duration_ms=None,
        )
        return job

    def _writeback_file_evidence(self, project_id: UUID, file_id: UUID) -> dict[str, Any]:
        versions = self.file_versions.get(file_id, [])
        latest = dict(versions[-1]) if versions else {}
        changeset = max(
            (
                changeset
                for changeset in self.changesets.values()
                if changeset.project_id == project_id and changeset.file_id == file_id
            ),
            key=lambda value: (value.file_revision or 0, value.submitted_at),
            default=None,
        )
        if latest:
            return {
                "revision": latest.get("revision"),
                "sha256": latest.get("sha256"),
                "source_path": latest.get("source_path"),
            }
        if changeset is not None:
            return {
                "revision": changeset.file_revision,
                "sha256": changeset.file_hash,
                "source_path": None,
            }
        return {"revision": None, "sha256": None, "source_path": None}

    @staticmethod
    def _new_excel_destination(source_path: str | None, file_id: UUID, root_path: str) -> str:
        if source_path:
            source = Path(source_path)
            return str(source.with_name(f"{source.stem}.organize{source.suffix or '.xlsx'}"))
        return str(Path(root_path) / f"organize-{file_id}.xlsx")

    @staticmethod
    def _writeback_adapter_preview(
        format_name: str,
        source_path: str | None,
        file_id: UUID,
        file_revision: int | None,
        manual_mapping: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if format_name == "EXCEL":
            return {
                "adapter": "excel",
                "serializer": "excel-preserving",
                "structure_detected": True,
                "manual_mapping_required": False,
                "mapping_status": "NOT_REQUIRED",
                "observed_hash": None,
                "warnings": [],
                "source_summary": {"managed_structure": "workbook"},
            }

        expected_document_format = {"MARKDOWN": "markdown", "TXT": "text", "WORD": "word"}[format_name]
        warnings: list[str] = []
        parsed: Any = None
        observed_hash: str | None = None
        if source_path:
            try:
                from .documents import parse_document

                parsed = parse_document(source_path, file_id=file_id, file_revision=file_revision or 1)
                observed_hash = parsed.source_hash
            except (BadZipFile, OSError, ValueError):
                warnings.append("SOURCE_CONTENT_UNAVAILABLE")
        else:
            warnings.append("SOURCE_CONTENT_UNAVAILABLE")

        if parsed is not None and parsed.format != expected_document_format:
            warnings.append("SOURCE_FORMAT_MISMATCH")
        structure_detected = bool(parsed and (
            parsed.tables
            or any(node.kind in {"heading", "metadata", "list_item"} for node in parsed.nodes)
        ))
        mapping_status = "DETECTED" if structure_detected else "MANUAL" if manual_mapping else "REQUIRED"
        if not structure_detected and not manual_mapping:
            warnings.append("MANUAL_MAPPING_REQUIRED")
        return {
            "adapter": format_name.casefold(),
            "serializer": f"{format_name.casefold()}-preserving",
            "structure_detected": structure_detected,
            "manual_mapping_required": not structure_detected and not manual_mapping,
            "mapping_status": mapping_status,
            "observed_hash": observed_hash,
            "warnings": warnings,
            "source_summary": {
                "node_count": len(parsed.nodes) if parsed else 0,
                "table_count": len(parsed.tables) if parsed else 0,
                "unmanaged_content": "preserved",
            },
        }

    def create_organize_excel_preview(
        self,
        project_id: UUID,
        item_type: str,
        item_ids: list[UUID],
        *,
        file_ids: list[UUID] | None = None,
        destination_mode: str = "IN_PLACE",
        batch_strategy: str = "PER_FILE",
        destination_paths: dict[str, str] | None = None,
        expected_file_revisions: dict[str, int] | None = None,
        expected_file_hashes: dict[str, str] | None = None,
        format_name: str = "EXCEL",
        manual_mapping: dict[str, dict[str, Any]] | None = None,
        created_by: str = "organize-editor",
    ) -> WriteBackPreviewPlan:
        project = self._require_organize_project(project_id)
        normalized_type = self._organize_item_type(item_type)
        normalized_format = format_name.strip().upper()
        normalized_destination = destination_mode.strip().upper()
        normalized_strategy = batch_strategy.strip().upper()
        if not item_ids:
            raise OrganizeValidationError("At least one item is required for write-back preview")
        if normalized_destination not in {"IN_PLACE", "NEW_FILE"}:
            raise OrganizeValidationError("destination_mode must be IN_PLACE or NEW_FILE")
        if normalized_strategy not in {"PER_FILE", "ALL_OR_NOTHING"}:
            raise OrganizeValidationError("batch_strategy must be PER_FILE or ALL_OR_NOTHING")
        if normalized_format not in {"EXCEL", "MARKDOWN", "TXT", "WORD"}:
            raise OrganizeValidationError("format must be EXCEL, MARKDOWN, TXT or WORD")

        destination_paths = destination_paths or {}
        expected_file_revisions = expected_file_revisions or {}
        expected_file_hashes = expected_file_hashes or {}
        manual_mapping = manual_mapping or {}
        snapshot_items = {
            item["id"]: item
            for item in self.organize_snapshot(project_id)["items"]
            if item["type"] == normalized_type
        }
        missing = [str(item_id) for item_id in item_ids if item_id not in snapshot_items]
        if missing:
            raise KeyError(f"Organize items not found: {', '.join(missing)}")

        selected_items = [snapshot_items[item_id] for item_id in item_ids]
        derived_file_ids = list(dict.fromkeys(
            item["source_file_id"]
            for item in selected_items
            if item.get("source_file_id") is not None
        ))
        target_file_ids = list(dict.fromkeys(file_ids or derived_file_ids))
        if not target_file_ids:
            raise OrganizeValidationError("Selected items have no source file target")
        project_file_ids = set(derived_file_ids)
        project_file_ids.update(
            changeset.file_id
            for changeset in self.changesets.values()
            if changeset.project_id == project_id and changeset.file_id is not None
        )
        project_file_ids.update(
            job.file_id
            for job in self.write_jobs.values()
            if job.project_id == project_id
        )
        project_file_ids.update(
            event.file_id
            for event in self.audit_events
            if event.project_id == project_id and event.file_id is not None
        )
        if any(file_id not in project_file_ids for file_id in target_file_ids):
            raise OrganizeConflictError("Source file belongs to another project or is not registered")

        all_warnings: list[str] = []
        file_plans: list[dict[str, Any]] = []
        for file_id in target_file_ids:
            evidence = self._writeback_file_evidence(project_id, file_id)
            source_items = [item for item in selected_items if item.get("source_file_id") == file_id]
            if not source_items and len(target_file_ids) == 1:
                source_items = selected_items
            current_revision = evidence["revision"] or next((item.get("file_revision") for item in source_items if item.get("file_revision")), None)
            current_hash = evidence["sha256"] or next((item.get("source", {}).get("sha256") for item in source_items if item.get("source")), None)
            expected_revision = expected_file_revisions.get(str(file_id), current_revision)
            expected_hash = expected_file_hashes.get(str(file_id), current_hash)
            source_path = evidence["source_path"] or next((item.get("source_path") for item in source_items if item.get("source_path")), None)
            requested_destination = destination_paths.get(str(file_id))
            destination_path = requested_destination
            if normalized_destination == "IN_PLACE":
                destination_path = destination_path or source_path
            else:
                destination_path = destination_path or self._new_excel_destination(source_path, file_id, project.root_path)

            warnings: list[str] = []
            adapter = self._writeback_adapter_preview(
                normalized_format,
                source_path,
                file_id,
                current_revision,
                manual_mapping.get(str(file_id)),
            )
            warnings.extend(adapter["warnings"])
            if normalized_destination == "IN_PLACE" and not source_path:
                warnings.append("SOURCE_PATH_UNAVAILABLE")
            if normalized_destination == "IN_PLACE" and requested_destination and source_path and requested_destination != source_path:
                warnings.append("IN_PLACE_DESTINATION_MISMATCH")
            if normalized_destination == "NEW_FILE" and not requested_destination:
                warnings.append("DESTINATION_EXPLICIT_REQUIRED")
            if not expected_revision:
                warnings.append("SOURCE_REVISION_UNAVAILABLE")
            if not expected_hash:
                warnings.append("SOURCE_HASH_UNAVAILABLE")
            if expected_revision and current_revision and expected_revision != current_revision:
                warnings.append("STALE_SOURCE_REVISION")
            if expected_hash and current_hash and expected_hash != current_hash:
                warnings.append("STALE_SOURCE_HASH")
            if expected_hash and (len(expected_hash) != 64 or any(character not in "0123456789abcdefABCDEF" for character in expected_hash)):
                raise OrganizeValidationError("expected_file_hash must be a SHA-256 hex value")
            allowed_extensions = {
                "EXCEL": {".xlsx", ".xlsm", ".xls"},
                "MARKDOWN": {".md", ".markdown"},
                "TXT": {".txt"},
                "WORD": {".docx"},
            }[normalized_format]
            if destination_path and Path(destination_path).suffix.lower() not in allowed_extensions:
                warnings.append("UNSUPPORTED_FORMAT_DESTINATION")
            if adapter["observed_hash"] and current_hash and adapter["observed_hash"] != current_hash:
                warnings.append("STALE_SOURCE_CONTENT")

            changes: list[dict[str, Any]] = []
            for item in source_items:
                source_locator = item.get("source") or {}
                groups = [
                    self.organize_groups[group_id].name
                    for group_id in item.get("group_ids", [])
                    if group_id in self.organize_groups
                ]
                tags = [
                    self.organize_tags[tag_id].name
                    for tag_id in item.get("tag_ids", [])
                    if tag_id in self.organize_tags
                ]
                locator = {
                    "file_id": str(file_id),
                    "file_revision": item.get("file_revision") or current_revision,
                    "sheet": source_locator.get("sheet"),
                    "row": source_locator.get("row"),
                    "column": source_locator.get("column"),
                }
                changes.extend([
                    {
                        "kind": "METADATA",
                        "item_type": item["type"],
                        "item_id": str(item["id"]),
                        "locator": locator,
                        "adapter": adapter["adapter"],
                        "before": {"managed_fields": "current managed source values"},
                        "after": {"organize_groups": groups, "organize_tags": tags, "lifecycle": item["status"]},
                    },
                    {
                        "kind": "CONTENT",
                        "item_type": item["type"],
                        "item_id": str(item["id"]),
                        "locator": locator,
                        "adapter": adapter["adapter"],
                        "operation": "preserve_unmanaged_and_reflect_group_structure",
                        "before": "existing unmanaged content preserved",
                        "after": {"group_paths": groups, "source_locator_preserved": True},
                    },
                ])

            all_warnings.extend(warnings)
            file_plans.append({
                "file_id": str(file_id),
                "format": normalized_format,
                "adapter": adapter["adapter"],
                "serializer": adapter["serializer"],
                "structure_detected": adapter["structure_detected"],
                "manual_mapping_required": adapter["manual_mapping_required"],
                "mapping_status": adapter["mapping_status"],
                "source_summary": adapter["source_summary"],
                "source_path": source_path,
                "destination_path": destination_path,
                "destination_mode": normalized_destination,
                "current_version": {"revision": current_revision, "sha256": current_hash},
                "expected_version": {"revision": expected_revision, "sha256": expected_hash},
                "changes": changes,
                "warnings": warnings,
                "blocked": bool(warnings),
                "unmanaged_content": "PRESERVE",
                "write_performed": False,
            })

        plan = WriteBackPreviewPlan(
            id=uuid4(),
            project_id=project_id,
            created_by=created_by,
            created_at=utc_now(),
            item_type=normalized_type,
            item_ids=item_ids,
            format=normalized_format,
            destination_mode=normalized_destination,
            batch_strategy=normalized_strategy,
            status="PREVIEW",
            confirmation_required=True,
            can_confirm=not all_warnings,
            write_performed=False,
            files=file_plans,
            warnings=list(dict.fromkeys(all_warnings)),
        )
        self.writeback_plans[plan.id] = plan
        self._add_event(
            "FileWriteBackPreviewCreated",
            plan.id,
            project_id,
            1,
            {
                "plan_id": str(plan.id),
                "item_type": normalized_type,
                "item_ids": [str(item_id) for item_id in item_ids],
                "file_ids": [str(file_id) for file_id in target_file_ids],
                "destination_mode": normalized_destination,
                "batch_strategy": normalized_strategy,
                "write_performed": False,
            },
            actor=created_by,
            status=plan.status,
            after={"confirmation_required": True, "can_confirm": plan.can_confirm},
        )
        return plan

    def _release_write_lock(self, job: FileWriteJob) -> None:
        if self.file_locks.get(job.file_id) == job.id:
            self.file_locks.pop(job.file_id, None)

    def _refresh_writeback_plan_status(self, plan_id: UUID | None) -> None:
        if plan_id is None or plan_id not in self.writeback_plans:
            return
        plan = self.writeback_plans[plan_id]
        jobs = [job for job in self.write_jobs.values() if job.plan_id == plan_id]
        if any(job.status in {"FAILED", "CONFLICT"} for job in jobs):
            plan.status = "FAILED"
        elif jobs and all(job.status == "APPLIED" for job in jobs):
            plan.status = "APPLIED"

    def execute_organize_writeback(
        self,
        project_id: UUID,
        plan_id: UUID,
        *,
        confirmed: bool,
        actor: str,
    ) -> dict[str, Any]:
        plan = self.writeback_plans.get(plan_id)
        if plan is None or plan.project_id != project_id:
            raise KeyError("Write-back preview plan not found")
        if not confirmed:
            raise OrganizeValidationError("Explicit confirmation is required before write-back")
        if plan.status != "PREVIEW":
            raise OrganizeConflictError(f"Preview plan cannot be confirmed from {plan.status}")
        if not plan.can_confirm:
            raise FileWriteConflict("WRITE_BACK_BLOCKED: preview contains unresolved safety warnings")

        conflicts: list[str] = []
        for file_plan in plan.files:
            file_id = UUID(file_plan["file_id"])
            if file_id in self.file_locks:
                conflicts.append(f"FILE_LOCKED:{file_id}")
                continue
            evidence = self._writeback_file_evidence(project_id, file_id)
            expected = file_plan["expected_version"]
            if expected.get("revision") != evidence.get("revision"):
                conflicts.append(f"STALE_SOURCE_REVISION:{file_id}")
            if expected.get("sha256") != evidence.get("sha256"):
                conflicts.append(f"STALE_SOURCE_HASH:{file_id}")
            source_path = file_plan.get("source_path")
            if source_path and Path(source_path).is_file() and expected.get("sha256"):
                actual_hash = hashlib.sha256(Path(source_path).read_bytes()).hexdigest()
                if actual_hash != expected["sha256"]:
                    conflicts.append(f"STALE_SOURCE_CONTENT:{file_id}")
        if conflicts:
            plan.status = "CONFLICT"
            self._add_event(
                "FileWriteBackBlocked",
                plan.id,
                project_id,
                1,
                {"plan_id": str(plan.id), "conflicts": conflicts},
                actor=actor,
                status=plan.status,
                after={"confirmed": False},
            )
            raise FileWriteConflict("WRITE_BACK_BLOCKED: " + ", ".join(conflicts))

        jobs: list[FileWriteJob] = []
        try:
            for file_plan in plan.files:
                file_id = UUID(file_plan["file_id"])
                item_revision = UUID(int=0)
                if plan.item_type == "ENTITY":
                    item_id = next((UUID(change["item_id"]) for change in file_plan["changes"] if change["item_type"] == "ENTITY"), None)
                    current = self.current_revision(item_id, "DESIGNED") if item_id else None
                    if current is not None:
                        item_revision = current.id
                job = self.create_write_job(
                    project_id,
                    file_id,
                    file_plan["expected_version"]["revision"],
                    item_revision,
                    file_plan["expected_version"]["sha256"],
                    file_plan.get("source_path"),
                    plan_id=plan.id,
                    destination_mode=file_plan["destination_mode"],
                    destination_path=file_plan.get("destination_path"),
                    batch_strategy=plan.batch_strategy,
                    confirmed=True,
                    safety_enforced=True,
                )
                jobs.append(job)
        except FileWriteConflict:
            for job in jobs:
                job.status = "FAILED"
                self._release_write_lock(job)
            plan.status = "FAILED"
            raise

        plan.status = "QUEUED"
        self._add_event(
            "FileWriteBackConfirmed",
            plan.id,
            project_id,
            1,
            {
                "plan_id": str(plan.id),
                "job_ids": [str(job.id) for job in jobs],
                "batch_strategy": plan.batch_strategy,
                "destination_mode": plan.destination_mode,
            },
            actor=actor,
            status=plan.status,
            after={"confirmed": True, "job_count": len(jobs)},
        )
        return {"plan": plan, "jobs": jobs}

    def register_file_version(
        self,
        project_id: UUID,
        file_id: UUID,
        file_hash: str,
        size: int,
        actor: str,
        operation: str,
        source_path: str | None = None,
    ) -> dict[str, Any]:
        versions = self.file_versions.setdefault(file_id, [])
        for version in versions:
            if version["sha256"] == file_hash:
                return version
        version = {
            "id": uuid4(),
            "file_id": file_id,
            "revision": len(versions) + 1,
            "sha256": file_hash,
            "size": size,
            "actor": actor,
            "operation": operation,
            "source_path": source_path,
            "created_at": utc_now(),
        }
        versions.append(version)
        self._add_event(
            "FileVersionRegistered",
            file_id,
            project_id,
            version["revision"],
            {"file_id": str(file_id), "sha256": file_hash, "operation": operation},
            actor=actor,
            file_id=file_id,
            status="REGISTERED",
            duration_ms=None,
        )
        return version

    def complete_write_job(
        self,
        project_id: UUID,
        job_id: UUID,
        source_hash: str,
        result_hash: str,
        size: int,
        actor: str,
        backup_path: str | None = None,
    ) -> FileWriteJob:
        job = self.write_jobs.get(job_id)
        if job is None or job.project_id != project_id:
            raise KeyError("Write job not found")
        if job.status == "APPLIED":
            return job
        if job.status != "PENDING":
            raise ValueError(f"Write job cannot complete from {job.status}")
        if job.safety_enforced:
            if not job.confirmed or (job.plan_id is None and job.operation != "RESTORE"):
                self._release_write_lock(job)
                job.status = "FAILED"
                self._refresh_writeback_plan_status(job.plan_id)
                raise FileWriteConflict("WRITE_BACK_BLOCKED: job confirmation is missing")
            current_revision = len(self.file_versions.get(job.file_id, []))
            if current_revision != job.expected_file_revision:
                self._release_write_lock(job)
                job.status = "CONFLICT"
                self._refresh_writeback_plan_status(job.plan_id)
                raise FileWriteConflict(
                    f"FILE_CONFLICT: expected revision {job.expected_file_revision}, found {current_revision}"
                )
            if job.source_path and Path(job.source_path).is_file():
                actual_source_hash = hashlib.sha256(Path(job.source_path).read_bytes()).hexdigest()
                if actual_source_hash != source_hash:
                    self._release_write_lock(job)
                    job.status = "CONFLICT"
                    self._refresh_writeback_plan_status(job.plan_id)
                    raise FileWriteConflict(
                        f"FILE_CONFLICT: worker source hash {source_hash}, file hash {actual_source_hash}"
                    )
            if job.destination_mode == "IN_PLACE" and not backup_path:
                self._release_write_lock(job)
                job.status = "FAILED"
                self._refresh_writeback_plan_status(job.plan_id)
                raise FileWriteConflict("BACKUP_REQUIRED: in-place write-back requires a backup path")
        if job.expected_file_hash is not None and job.expected_file_hash != source_hash:
            self._release_write_lock(job)
            job.status = "CONFLICT"
            self._refresh_writeback_plan_status(job.plan_id)
            raise FileWriteConflict(
                f"FILE_CONFLICT: expected {job.expected_file_hash}, found {source_hash}"
            )
        version = self.register_file_version(
            project_id,
            job.file_id,
            result_hash,
            size,
            actor,
            job.operation,
            job.source_path,
        )
        job.status = "APPLIED"
        job.result_file_revision = version["revision"]
        job.result_file_hash = result_hash
        job.backup_path = backup_path
        self.self_write_hashes.add((job.file_id, result_hash))
        self._release_write_lock(job)
        if job.changeset_id is not None and job.changeset_id in self.changesets:
            self.changesets[job.changeset_id].status = "APPLIED"
        self._add_event(
            "FileWriteApplied",
            job.id,
            project_id,
            version["revision"],
            {
                "file_id": str(job.file_id),
                "result_hash": result_hash,
                "backup_path": backup_path,
                "operation": job.operation,
            },
            actor=actor,
            file_id=job.file_id,
            changeset_id=job.changeset_id,
            status=job.status,
            before={"file_hash": source_hash},
            after={"file_hash": result_hash},
            duration_ms=None,
        )
        self._refresh_writeback_plan_status(job.plan_id)
        return job

    def is_self_write(self, file_id: UUID, file_hash: str) -> bool:
        return (file_id, file_hash) in self.self_write_hashes

    def fail_write_job(self, project_id: UUID, job_id: UUID, actor: str, reason: str) -> FileWriteJob:
        job = self.write_jobs.get(job_id)
        if job is None or job.project_id != project_id:
            raise KeyError("Write job not found")
        if job.status == "APPLIED":
            raise ValueError("Applied write job cannot fail")
        job.status = "FAILED"
        self._release_write_lock(job)
        if job.batch_strategy == "ALL_OR_NOTHING" and job.plan_id is not None:
            for sibling in self.write_jobs.values():
                if sibling.plan_id == job.plan_id and sibling.id != job.id and sibling.status == "PENDING":
                    sibling.status = "FAILED"
                    self._release_write_lock(sibling)
        self._add_event(
            "FileWriteFailed",
            job.id,
            project_id,
            1,
            {"file_id": str(job.file_id), "reason": reason, "operation": job.operation},
            actor=actor,
            file_id=job.file_id,
            status=job.status,
            after={"reason": reason},
        )
        self._refresh_writeback_plan_status(job.plan_id)
        return job

    def record_self_write_suppression(self, project_id: UUID, file_id: UUID, file_hash: str, actor: str) -> None:
        self._add_event(
            "SelfWriteSuppressed",
            file_id,
            project_id,
            1,
            {"file_id": str(file_id), "file_hash": file_hash, "suppressed": True},
            actor=actor,
            file_id=file_id,
            status="SUPPRESSED",
        )

    def create_restore_job(
        self,
        project_id: UUID,
        file_id: UUID,
        target_file_revision: int,
        expected_file_revision: int,
        source_path: str,
        created_by: str,
    ) -> FileWriteJob:
        versions = self.file_versions.get(file_id, [])
        target = next((version for version in versions if version["revision"] == target_file_revision), None)
        if target is None:
            raise KeyError("File version not found")
        current_revision = len(versions)
        if current_revision != expected_file_revision:
            raise FileWriteConflict(
                f"FILE_CONFLICT: expected revision {expected_file_revision}, found {current_revision}"
            )
        if file_id in self.file_locks:
            raise FileWriteConflict("FILE_LOCKED: another write job is active")
        changeset_id = uuid4()
        changeset = ChangeSet(
            id=changeset_id,
            project_id=project_id,
            origin="FILE_RESTORE",
            submitted_by=created_by,
            submitted_at=utc_now(),
            status="PENDING_APPROVAL",
            entity_id=uuid4(),
            representation="FILE",
            base_revision=expected_file_revision,
            patch={"restore_file_revision": target_file_revision},
            file_id=file_id,
            file_revision=target_file_revision,
            file_hash=target["sha256"],
        )
        self.changesets[changeset_id] = changeset
        job = FileWriteJob(
            id=uuid4(),
            project_id=project_id,
            file_id=file_id,
            expected_file_revision=expected_file_revision,
            entity_revision=UUID(int=0),
            operation="RESTORE",
            expected_file_hash=versions[-1]["sha256"] if versions else None,
            source_path=source_path,
            source_file_revision=target_file_revision,
            changeset_id=changeset_id,
            destination_mode="IN_PLACE",
            destination_path=source_path,
            confirmed=True,
            safety_enforced=True,
        )
        self.write_jobs[job.id] = job
        self.file_locks[file_id] = job.id
        self._add_event(
            "FileRestoreJobCreated",
            job.id,
            project_id,
            target_file_revision,
            {
                "file_id": str(file_id),
                "target_file_revision": target_file_revision,
                "changeset_id": str(changeset_id),
            },
            actor=created_by,
            file_id=file_id,
            changeset_id=changeset_id,
            status=job.status,
            duration_ms=None,
        )
        return job

    def _add_event(
        self,
        event_type: str,
        aggregate_id: UUID,
        project_id: UUID,
        version: int,
        payload: dict[str, Any],
        *,
        actor: str = "system",
        file_id: UUID | None = None,
        object_id: UUID | None = None,
        profile_id: str | None = None,
        changeset_id: UUID | None = None,
        status: str | None = None,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
        correlation_id: UUID | None = None,
        causation_id: UUID | None = None,
        duration_ms: int | None = None,
    ) -> OutboxEvent:
        event_id = uuid4()
        correlation = correlation_id or self._correlation_by_aggregate.setdefault(aggregate_id, uuid4())
        causation = causation_id or self._last_event_by_aggregate.get(aggregate_id)
        event = OutboxEvent(
            cursor=len(self.outbox) + 1, event_id=event_id, event_type=event_type,
            aggregate_id=aggregate_id, aggregate_version=version, project_id=project_id,
            payload=payload, occurred_at=utc_now(),
        )
        self.outbox.append(event)
        before_values = before or {}
        after_values = after or {}
        field_changes = [
            {"field": field_name, "before": before_values.get(field_name), "after": after_values.get(field_name)}
            for field_name in sorted(set(before_values) | set(after_values))
        ]
        self.audit_events.append(
            AuditEvent(
                id=uuid4(),
                project_id=project_id,
                event_id=event_id,
                event_type=event_type,
                operation=event_type,
                actor=actor,
                occurred_at=event.occurred_at,
                file_id=file_id,
                object_id=object_id or aggregate_id,
                profile_id=profile_id,
                changeset_id=changeset_id,
                status=status,
                correlation_id=correlation,
                causation_id=causation,
                field_changes=field_changes,
                duration_ms=duration_ms,
            )
        )
        self._last_event_by_aggregate[aggregate_id] = event_id
        return event

    def query_audit(
        self,
        project_id: UUID,
        *,
        file_id: UUID | None = None,
        object_id: UUID | None = None,
        actor: str | None = None,
        from_time: datetime | None = None,
        to_time: datetime | None = None,
        profile_id: str | None = None,
        changeset_id: UUID | None = None,
        status: str | None = None,
    ) -> list[AuditEvent]:
        def matches(event: AuditEvent) -> bool:
            return (
                event.project_id == project_id
                and (file_id is None or event.file_id == file_id)
                and (object_id is None or event.object_id == object_id)
                and (actor is None or event.actor == actor)
                and (from_time is None or event.occurred_at >= from_time)
                and (to_time is None or event.occurred_at <= to_time)
                and (profile_id is None or event.profile_id == profile_id)
                and (changeset_id is None or event.changeset_id == changeset_id)
                and (status is None or event.status == status)
            )

        return [event for event in self.audit_events if matches(event)]

    def _append_revision(
        self,
        camera: Camera,
        representation: str,
        created_by: str,
        changeset_id: UUID | None,
        geometry: dict[str, float] | None = None,
        data: dict[str, Any] | None = None,
    ) -> EntityRevision:
        key = (camera.entity_id, representation)
        history = self.revisions.setdefault(key, [])
        revision = EntityRevision(
            id=uuid4(),
            entity_id=camera.entity_id,
            representation=representation,
            revision=len(history) + 1,
            data=data if data is not None else self._camera_payload(camera),
            geometry=geometry,
            created_at=utc_now(),
            created_by=created_by,
            changeset_id=changeset_id,
        )
        history.append(revision)
        return revision

    @staticmethod
    def _camera_payload(camera: Camera) -> dict[str, Any]:
        return {
            "code": camera.code,
            "name": camera.name,
            "intersection_id": str(camera.intersection_id) if camera.intersection_id else None,
            "manufacturer": camera.manufacturer,
            "model": camera.model,
            "ip_address": camera.ip_address,
            "status": camera.status,
            "properties": camera.properties,
        }

    @staticmethod
    def _camera_from_payload(entity_id: UUID, project_id: UUID, payload: dict[str, Any]) -> Camera:
        return Camera(
            entity_id=entity_id,
            project_id=project_id,
            code=payload["code"],
            name=payload.get("name"),
            intersection_id=UUID(payload["intersection_id"]) if payload.get("intersection_id") else None,
            manufacturer=payload.get("manufacturer"),
            model=payload.get("model"),
            ip_address=payload.get("ip_address"),
            status=payload.get("status"),
            properties=payload.get("properties", {}),
        )

    @staticmethod
    def _apply_camera_payload(camera: Camera, payload: dict[str, Any]) -> None:
        camera.code = payload["code"]
        camera.name = payload.get("name")
        camera.intersection_id = UUID(payload["intersection_id"]) if payload.get("intersection_id") else None
        camera.manufacturer = payload.get("manufacturer")
        camera.model = payload.get("model")
        camera.ip_address = payload.get("ip_address")
        camera.status = payload.get("status")
        camera.properties = payload.get("properties", {})

    @staticmethod
    def _raw_rows_hash(raw_rows: list[dict[str, Any]]) -> str:
        canonical = json.dumps(
            raw_rows,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
