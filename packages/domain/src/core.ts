export type EntityId = string;
export type ProjectId = string;
export type RevisionNumber = number;
export type SourceFileId = string;

export type ProjectStatus = "ACTIVE" | "ARCHIVED" | "DELETED";
export type OrganizeItemType = "ENTITY" | "SOURCE_FILE" | "IMPORT";
export type OrganizeLifecycleStatus = "ACTIVE" | "ARCHIVED" | "DELETED";
export type Representation = "DESIGNED" | "AS_BUILT";

export interface SourceLocator {
  fileId: SourceFileId;
  fileRevision: number;
  sheet: string;
  row: number;
  column: string;
}

export interface OrganizeItemRef {
  type: OrganizeItemType;
  id: string;
}
