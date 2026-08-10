from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    root_path: str = Field(min_length=1)


class ProjectDelete(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class ImportRequest(BaseModel):
    rows: list[dict[str, Any]]
    file_id: UUID
    file_revision: int = Field(ge=1)
    sheet: str = "CAMERA"
    created_by: str = Field(default="import", min_length=1)
    source_hash: str | None = Field(default=None, min_length=64, max_length=64)


class FileImportRequest(ImportRequest):
    idempotency_key: str = Field(min_length=1, max_length=200)
    source_hash: str | None = Field(default=None, min_length=64, max_length=64)


class GeometryRequest(BaseModel):
    latitude: float
    longitude: float
    base_revision: int = Field(ge=1)
    created_by: str = Field(default="designer", min_length=1)


class ContractorCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)


class WorkPackageCreate(BaseModel):
    contractor_id: UUID
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    entity_ids: list[UUID]


class FieldPackageCreate(BaseModel):
    work_package_id: UUID


class ObservationCreate(BaseModel):
    field_package_id: UUID
    entity_id: UUID
    base_revision: int = Field(ge=1)
    operator_id: str = Field(min_length=1)
    gps: dict[str, Any] | None = None
    form_data: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=1, max_length=200)


class ApprovalRequest(BaseModel):
    approved_by: str = Field(min_length=1)


class WriteJobCreate(BaseModel):
    file_id: UUID
    expected_file_revision: int = Field(ge=1)
    entity_revision: UUID
    expected_file_hash: str | None = Field(default=None, min_length=64, max_length=64)
    source_path: str | None = None


class WriteJobComplete(BaseModel):
    source_hash: str = Field(min_length=64, max_length=64)
    result_hash: str = Field(min_length=64, max_length=64)
    size: int = Field(ge=0)
    actor: str = Field(min_length=1)
    backup_path: str | None = None


class RestoreJobCreate(BaseModel):
    file_id: UUID
    target_file_revision: int = Field(ge=1)
    expected_file_revision: int = Field(ge=1)
    source_path: str = Field(min_length=1)
    created_by: str = Field(default="restore", min_length=1)


class DocumentImportRequest(BaseModel):
    path: str = Field(min_length=1)
    file_id: UUID
    file_revision: int = Field(ge=1)
    created_by: str = Field(default="document-import", min_length=1)
    canonical_entities: list[dict[str, Any]] = Field(default_factory=list)


class OrganizeGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_ids: list[UUID] = Field(default_factory=list)


class OrganizeGroupPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_ids: list[UUID] | None = None
    status: str | None = None


class OrganizeTagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class OrganizeMembershipRequest(BaseModel):
    operation: str = "add"
    item_type: str
    item_ids: list[UUID] = Field(min_length=1)
    group_ids: list[UUID] = Field(default_factory=list)
    tag_ids: list[UUID] = Field(default_factory=list)
    replace_groups: bool = False
    replace_tags: bool = False


class OrganizeLifecycleRequest(BaseModel):
    item_type: str
    item_ids: list[UUID] = Field(min_length=1)
    status: str


class OrganizeWriteBackPreviewRequest(BaseModel):
    item_type: str
    item_ids: list[UUID] = Field(min_length=1)
    file_ids: list[UUID] = Field(default_factory=list)
    format: str = "EXCEL"
    destination_mode: str = "IN_PLACE"
    batch_strategy: str = "PER_FILE"
    destination_paths: dict[str, str] = Field(default_factory=dict)
    expected_file_revisions: dict[str, int] = Field(default_factory=dict)
    expected_file_hashes: dict[str, str] = Field(default_factory=dict)
    manual_mapping: dict[str, dict[str, Any]] = Field(default_factory=dict)


class OrganizeWriteBackExecuteRequest(BaseModel):
    plan_id: UUID
    confirmed: bool = False


class WriteJobFailureRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class BasemapSource(BaseModel):
    kind: Literal["raster", "style"]
    tiles: list[str] = Field(default_factory=list)
    styleUrl: str | None = None

    @model_validator(mode="after")
    def validate_source(self) -> "BasemapSource":
        if self.kind == "raster" and not self.tiles:
            raise ValueError("Raster basemap sources require at least one tile template")
        if self.kind == "style" and not self.styleUrl:
            raise ValueError("Style basemap sources require a styleUrl")
        return self


class BasemapMode(BaseModel):
    key: Literal["street", "hybrid", "vector"]
    label: str = Field(min_length=1, max_length=80)
    detail: str = Field(min_length=1, max_length=200)
    source: BasemapSource


class BasemapLayerGroup(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    detail: str = Field(min_length=1, max_length=240)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    layerPrefixes: list[str] = Field(min_length=1)
    excludePrefixes: list[str] = Field(default_factory=list)
    defaultVisibility: bool = True


class TilePackageCapabilities(BaseModel):
    supported: bool
    selection: Literal["boundingBox"]
    minZoom: int = Field(ge=0, le=24)
    maxZoom: int = Field(ge=0, le=24)
    storage: Literal["desktop-local"]

    @model_validator(mode="after")
    def validate_zoom_range(self) -> "TilePackageCapabilities":
        if self.maxZoom < self.minZoom:
            raise ValueError("maxZoom must be greater than or equal to minZoom")
        return self


class BasemapManifest(BaseModel):
    schemaVersion: int = Field(ge=1)
    manifestVersion: str = Field(min_length=1, max_length=80)
    generatedAt: str = Field(min_length=1, max_length=80)
    defaultMode: Literal["street", "hybrid", "vector"]
    modes: dict[str, BasemapMode]
    layers: list[BasemapLayerGroup] = Field(min_length=1)
    attribution: list[str] = Field(min_length=1)
    tilePackages: TilePackageCapabilities

    @model_validator(mode="after")
    def validate_modes(self) -> "BasemapManifest":
        expected = {"street", "hybrid", "vector"}
        if set(self.modes) != expected:
            raise ValueError("Basemap manifest must define exactly street, hybrid, and vector modes")
        if any(mode.key != key for key, mode in self.modes.items()):
            raise ValueError("Basemap mode keys must match their manifest keys")
        return self

    @model_validator(mode="after")
    def validate_generated_at(self) -> "BasemapManifest":
        try:
            datetime.fromisoformat(self.generatedAt.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("generatedAt must be an ISO-8601 timestamp") from exc
        return self


