from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
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
        self.file_import_results: dict[UUID, ImportResult] = {}
        self.outbox: list[OutboxEvent] = []
        self.audit_events: list[AuditEvent] = []
        self.write_jobs: dict[UUID, FileWriteJob] = {}
        self.file_versions: dict[UUID, list[dict[str, Any]]] = {}
        self.self_write_hashes: set[tuple[UUID, str]] = set()
        self.source_assets: dict[UUID, dict[str, Any]] = {}
        self._idempotency: dict[str, UUID] = {}
        self._changeset_idempotency: dict[str, UUID] = {}
        self._file_import_idempotency: dict[tuple[UUID, int, str], UUID] = {}
        self._correlation_by_aggregate: dict[UUID, UUID] = {}
        self._last_event_by_aggregate: dict[UUID, UUID] = {}

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
    ) -> FileWriteJob:
        job = FileWriteJob(
            id=uuid4(), project_id=project_id, file_id=file_id,
            expected_file_revision=expected_file_revision, entity_revision=entity_revision,
            expected_file_hash=expected_file_hash, source_path=source_path,
        )
        self.write_jobs[job.id] = job
        self._add_event(
            "FileWriteJobCreated",
            job.id,
            project_id,
            expected_file_revision,
            {"file_id": str(file_id), "operation": job.operation},
            file_id=file_id,
            status=job.status,
            duration_ms=None,
        )
        return job

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
        if job.expected_file_hash is not None and job.expected_file_hash != source_hash:
            job.status = "CONFLICT"
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
        return job

    def is_self_write(self, file_id: UUID, file_hash: str) -> bool:
        return (file_id, file_hash) in self.self_write_hashes

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
            source_path=source_path,
            source_file_revision=target_file_revision,
            changeset_id=changeset_id,
        )
        self.write_jobs[job.id] = job
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
