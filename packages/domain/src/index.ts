export type EntityId = string;
export type ProjectId = string;
export type RevisionNumber = number;
export type SourceFileId = string;

export type Representation = "DESIGNED" | "AS_BUILT";

export interface SourceLocator {
  fileId: SourceFileId;
  fileRevision: number;
  sheet: string;
  row: number;
  column: string;
}

export type FileVersionStatus = "DISCOVERED" | "SYNCED" | "SUPERSEDED";

export interface FileVersion {
  id: string;
  fileId: SourceFileId;
  revision: number;
  sha256: string;
  size: number;
  modifiedAt: string | null;
  createdAt: string;
  status: FileVersionStatus;
}

export interface RawRecord {
  id: string;
  fileVersionId: string;
  rowKey: string;
  payload: Record<string, unknown>;
  source?: SourceLocator;
}

export type FieldDataType = "text" | "number" | "boolean" | "date" | "json";

export interface SchemaField {
  id: string;
  name: string;
  dataType: FieldDataType;
  group: string | null;
  unit: string | null;
  required: boolean;
}

export interface FieldMapping {
  sourceColumn: string;
  fieldId: string;
  rules: Record<string, unknown>[];
}

export interface IdentityCandidate {
  entityId: EntityId;
  score: number;
  reasons: string[];
  requiresConfirmation: boolean;
}

export interface Project {
  id: ProjectId;
  code: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface Camera {
  entityId: EntityId;
  projectId: ProjectId;
  code: string;
  name: string | null;
  intersectionId: EntityId | null;
  manufacturer: string | null;
  model: string | null;
  ipAddress: string | null;
  status: string | null;
  properties: Record<string, unknown>;
  source?: SourceLocator;
}

export interface EntityRevision {
  id: string;
  entityId: EntityId;
  representation: Representation;
  revision: RevisionNumber;
  data: Record<string, unknown>;
  geometry: { latitude: number; longitude: number } | null;
  createdAt: string;
  createdBy: string;
  changesetId: string | null;
}

export interface ImportIssue {
  code: string;
  message: string;
  row: number;
  column?: string;
}

export interface ImportResult {
  inserted: Camera[];
  changed: Camera[];
  unchanged: Camera[];
  invalid: ImportIssue[];
  conflict: ImportIssue[];
  unmapped: ImportIssue[];
}

export type ChangeSetStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "VALIDATING"
  | "CONFLICT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "FAILED";

export interface ChangeItem {
  changesetId: string;
  entityId: EntityId;
  representation: Representation;
  baseRevision: RevisionNumber;
  patch: Record<string, unknown>;
  changeType: "IMPORT" | "GEOMETRY" | "FIELD_OBSERVATION";
}
