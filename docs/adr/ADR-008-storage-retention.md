# ADR-008: Storage and Retention

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

Source files, photos, revisions, ChangeSets, events, and projections have different evidentiary value. Retaining everything equally is expensive, while deleting evidence breaks auditability and rebuildability.

## Decision

Every persisted artifact has a retention classification: `TEMPORARY`, `DERIVED`, `WORKING`, `APPROVED_EVIDENCE`, or `PROJECT_RECORD`.

Approved evidence, entity revisions, applied ChangeSets, approvals, conflicts, audit records, and event identifiers are immutable records. Derived thumbnails, previews, map caches, dashboard projections, and search indexes are rebuildable and may be regenerated or removed according to operational policy. Temporary data may be deleted after its job completes or expires. Working data requires explicit lifecycle handling before deletion.

Binary assets use content identity based on SHA-256 where practical: one binary may have many references. Deletion is reference-aware and records the actor, reason, and affected references. Legal, contractual, or project retention constraints override automatic cleanup.

## Alternatives

- Retain only current state: rejected because evidence and history would be lost.
- Back up derived data as authoritative: rejected because it obscures rebuildability.
- Delete by age without classification: rejected because evidence may be removed incorrectly.

## Consequences

Storage APIs need classification, reference, and deletion audit metadata. Rebuild jobs are required for projections and previews. Operators need visibility into retention failures and storage usage.

Future archival providers and lifecycle durations are non-binding deployment choices.

## Migration impact

New tables and files receive a classification at creation. Existing unclassified data is treated as working until reviewed. Rollback disables cleanup and preserves data; a superseding ADR must define grandfathering and historical retention compatibility.

## Related ADRs and implementation order

Implement after [ADR-002](ADR-002-file-authority.md), [ADR-004](ADR-004-entity-revisions.md), and [ADR-006](ADR-006-event-outbox.md). It constrains file versions, photos, revisions, events, audit, and derived dashboard storage.

## Acceptance checks

- Verify every persisted artifact has a retention classification.
- Attempt to delete approved evidence and require an explicit authorized archival/deletion workflow.
- Deduplicate identical binaries while preserving all references.
- Delete a derived projection and rebuild it from canonical data/events.
- Verify cleanup and deletion actions produce auditable records.

## Scenarios

### Normal flow

An approved field photo is stored once by content identity, referenced by an observation, retained as approved evidence, and a derived thumbnail is rebuilt when removed.

### Failure flow

Cleanup attempts to delete an evidence file still referenced by an approved record. The operation is rejected, the reference is preserved, and the failure is observable.

## Traceability

This ADR implements retention, immutable evidence, deduplication, auditability, and rebuildability in Project Platform Architecture v1.1 and F2/F4/F6 in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). The acceptance checks define the storage safety boundary.

## Open questions (non-binding)

- Project-specific retention durations and legal-hold representation.
- The first pilot’s object-storage deployment.
- Whether content hashes need a second integrity algorithm in addition to SHA-256.

