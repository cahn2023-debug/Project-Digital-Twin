import type { EntityId, Representation, RevisionNumber } from "./core";

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
