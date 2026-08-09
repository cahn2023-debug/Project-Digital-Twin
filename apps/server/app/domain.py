from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from ipaddress import ip_address
from typing import Any
from uuid import UUID, uuid4


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


@dataclass
class FileWriteJob:
    id: UUID
    project_id: UUID
    file_id: UUID
    expected_file_revision: int
    entity_revision: UUID
    status: str = "PENDING"


class RevisionConflict(Exception):
    def __init__(self, entity_id: UUID, base_revision: int, current_revision: int):
        self.entity_id = entity_id
        self.base_revision = base_revision
        self.current_revision = current_revision
        super().__init__(
            f"Revision conflict for {entity_id}: base={base_revision}, current={current_revision}"
        )


class CameraStore:
    """In-memory canonical repository used until the PostgreSQL adapter is added."""

    def __init__(self) -> None:
        self.projects: dict[UUID, Project] = {}
        self.cameras: dict[UUID, Camera] = {}
        self.camera_codes: dict[tuple[UUID, str], UUID] = {}
        self.revisions: dict[tuple[UUID, str], list[EntityRevision]] = {}
        self.contractors: dict[UUID, Contractor] = {}
        self.work_packages: dict[UUID, WorkPackage] = {}
        self.field_packages: dict[UUID, FieldPackage] = {}
        self.observations: dict[UUID, Observation] = {}
        self.changesets: dict[UUID, ChangeSet] = {}
        self.outbox: list[OutboxEvent] = []
        self.write_jobs: dict[UUID, FileWriteJob] = {}
        self._idempotency: dict[str, UUID] = {}

    def create_project(self, code: str, name: str) -> Project:
        if any(project.code == code for project in self.projects.values()):
            raise ValueError(f"Project code already exists: {code}")
        project = Project(id=uuid4(), code=code, name=name)
        self.projects[project.id] = project
        return project

    def get_project(self, project_id: UUID) -> Project | None:
        return self.projects.get(project_id)

    def list_cameras(self, project_id: UUID) -> list[Camera]:
        return sorted(
            (camera for camera in self.cameras.values() if camera.project_id == project_id),
            key=lambda camera: camera.code,
        )

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
        self._add_event("ObservationSubmitted", observation.id, project_id, 1, {"changeset_id": str(changeset_id)})
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
        self._add_event("AsBuiltRevisionCreated", revision.entity_id, project_id, revision.revision, {"revision_id": str(revision.id)})
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

    def create_write_job(self, project_id: UUID, file_id: UUID, expected_file_revision: int, entity_revision: UUID) -> FileWriteJob:
        job = FileWriteJob(
            id=uuid4(), project_id=project_id, file_id=file_id,
            expected_file_revision=expected_file_revision, entity_revision=entity_revision,
        )
        self.write_jobs[job.id] = job
        return job

    def _add_event(self, event_type: str, aggregate_id: UUID, project_id: UUID, version: int, payload: dict[str, Any]) -> OutboxEvent:
        event = OutboxEvent(
            cursor=len(self.outbox) + 1, event_id=uuid4(), event_type=event_type,
            aggregate_id=aggregate_id, aggregate_version=version, project_id=project_id,
            payload=payload, occurred_at=utc_now(),
        )
        self.outbox.append(event)
        return event

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
