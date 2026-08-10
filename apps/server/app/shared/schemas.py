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


class FileImportProfileRequest(BaseModel):
    profile_id: str = Field(min_length=1, max_length=120)
    version: int = Field(ge=1)
    sheet: str = Field(min_length=1, max_length=120)
    header_rows: list[int] = Field(min_length=1)
    data_start_row: int = Field(ge=1)
    table_start_row: int | None = Field(default=None, ge=1)
    skip_row_patterns: list[str] = Field(default_factory=list)
    aliases: dict[str, list[str]] = Field(default_factory=dict)


class FileImportFromPathRequest(BaseModel):
    path: str = Field(min_length=1)
    file_id: UUID
    file_revision: int = Field(ge=1)
    idempotency_key: str = Field(min_length=1, max_length=200)
    sheet: str = "CAMERA"
    created_by: str = Field(default="desktop-import", min_length=1)
    source_hash: str | None = Field(default=None, min_length=64, max_length=64)
    profile: FileImportProfileRequest | None = None


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
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=200)
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


class BasemapOfflineAssets(BaseModel):
    supported: bool
    kind: Literal["none", "vector-style"]
    glyphs: str | None = None
    sprite: str | None = None

    @model_validator(mode="after")
    def validate_assets(self) -> "BasemapOfflineAssets":
        if self.supported and self.kind != "vector-style":
            raise ValueError("Supported offline basemap sources require vector-style assets")
        if not self.supported and self.kind != "none":
            raise ValueError("Unsupported offline basemap sources must use kind=none")
        if self.kind == "vector-style" and (not self.glyphs or not self.sprite):
            raise ValueError("Vector-style offline assets require glyphs and sprite templates")
        if self.kind == "none" and (self.glyphs or self.sprite):
            raise ValueError("Offline asset URLs are not allowed when offline support is disabled")
        return self


class BasemapSource(BaseModel):
    kind: Literal["raster", "style"]
    provider: Literal["google", "openstreetmap"]
    layerControl: Literal["baked-raster", "style-layer"]
    tiles: list[str] = Field(default_factory=list)
    styleUrl: str | None = None
    offline: BasemapOfflineAssets

    @model_validator(mode="after")
    def validate_source(self) -> "BasemapSource":
        if not self.tiles:
            raise ValueError("Basemap sources require at least one tile template")
        if self.kind == "raster" and not self.styleUrl and self.provider != "google":
            raise ValueError("Non-Google raster basemap sources require a styleUrl")
        if self.kind == "style" and not self.styleUrl:
            raise ValueError("Style basemap sources require a styleUrl")
        if self.provider == "google":
            if self.kind != "raster" or self.layerControl != "baked-raster" or self.offline.supported:
                raise ValueError("Google basemap sources are online-only baked raster sources")
        if self.provider == "openstreetmap":
            if self.kind != "style" or self.layerControl != "style-layer" or not self.offline.supported:
                raise ValueError("OpenStreetMap basemap sources require offline style-layer assets")
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
    supportedModes: list[Literal["street", "hybrid", "vector"]]
    selection: Literal["boundingBox"]
    minZoom: int = Field(ge=0, le=24)
    maxZoom: int = Field(ge=0, le=24)
    storage: Literal["desktop-local"]

    @model_validator(mode="after")
    def validate_zoom_range(self) -> "TilePackageCapabilities":
        if self.maxZoom < self.minZoom:
            raise ValueError("maxZoom must be greater than or equal to minZoom")
        if self.supported and not self.supportedModes:
            raise ValueError("Supported tile packages require at least one supported mode")
        if not self.supported and self.supportedModes:
            raise ValueError("Unsupported tile packages cannot declare supported modes")
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


class SyncMutationItem(BaseModel):
    mutation_id: str = Field(min_length=1, max_length=200)
    client_id: str = Field(min_length=1, max_length=200)
    workspace_id: str = Field(default="default-workspace", min_length=1, max_length=200)
    user_id: str = Field(default="default-user", min_length=1, max_length=200)
    entity_type: str = Field(min_length=1, max_length=100)
    entity_id: str = Field(min_length=1, max_length=200)
    action: str = Field(min_length=1, max_length=50)
    timestamp: int = Field(ge=0)
    payload: str = Field(default="{}")
    field_changes: dict[str, Any] = Field(default_factory=dict)


class SyncBatchRequest(BaseModel):
    mutations: list[SyncMutationItem] = Field(default_factory=list)
    idempotency_key: str | None = Field(default=None, max_length=200)


class SyncMutationAck(BaseModel):
    mutation_id: str
    status: Literal["SYNCED", "STAGED_FOR_REVIEW", "IGNORED_DUPLICATE", "FAILED"]
    entity_id: str
    applied_fields: list[str] = Field(default_factory=list)
    conflicting_fields: list[str] = Field(default_factory=list)
    message: str = ""


class SyncBatchResponse(BaseModel):
    processed_count: int
    synced_count: int
    conflict_count: int
    failed_count: int
    results: list[SyncMutationAck]


class ConflictResolveRequest(BaseModel):
    chosen_client_id: str | None = None
    custom_values: dict[str, Any] | None = None
    resolved_by: str = Field(default="admin", min_length=1)


class StagedConflictResponse(BaseModel):
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
    status: str
    created_at: str


class StagedConflictListResponse(BaseModel):
    total: int
    conflicts: list[StagedConflictResponse]
