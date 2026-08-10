import type { EntityId, ProjectId, SourceFileId, SourceLocator } from "./core";

export interface FileVersion {
  id: string;
  fileId: SourceFileId;
  revision: number;
  sha256: string;
  size: number;
  modifiedAt: string | null;
  createdAt: string;
  status: "DISCOVERED" | "SYNCED" | "SUPERSEDED";
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
