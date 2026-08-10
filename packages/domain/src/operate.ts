import type { EntityId, Representation, RevisionNumber } from "./core";

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
