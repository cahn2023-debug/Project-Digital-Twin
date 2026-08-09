# ADR-007: Geometry Conflicts

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

Camera geometry is edited on maps and may also be changed by another designer or field process. Scalar merge rules cannot safely combine two independent positions.

## Decision

Geometry is revisioned data attached to a representation. A geometry operation carries the entity, representation, base revision, source coordinate reference, and proposed geometry. Geometry comparison is performed against `BASE`, `SERVER`, and `CLIENT`.

The rules are:

- Server unchanged and client changed: rebase and apply.
- Server changed and client unchanged: retain the server change and report a successful no-op/rebase.
- Server changed and client changed: create an explicit geometry conflict; never auto-merge.
- Invalid coordinates, unsupported reference systems, or missing geometry evidence: reject validation without mutation.

Conflict resolution offers `USE_SERVER`, `USE_FIELD`, or `MANUAL_EDIT`, each producing a new ChangeSet and revision. The original competing revisions remain available for audit.

## Alternatives

- Last-write-wins: rejected because it loses spatial work.
- Average or coordinate interpolation: rejected because the result may be physically invalid.
- CRDT geometry merge: deferred until benchmarked real workloads justify it.

## Consequences

Map UI must show designed, as-built, and field values distinctly. APIs must return conflict overlays and source evidence. Geometry validation must occur before approval or canonical mutation.

Future topology and network geometry rules are non-binding extensions.

## Migration impact

Existing point geometry is imported as the initial revision with its source locator. Rollback selects an earlier revision or creates a compensating ChangeSet; it never edits the original geometry. A superseding ADR must preserve conflict evidence and define migration of unresolved conflicts.

## Related ADRs and implementation order

Implement after [ADR-004](ADR-004-entity-revisions.md) and [ADR-003](ADR-003-changeset-model.md), then integrate with [ADR-005](ADR-005-sync-concurrency.md). It governs DESIGN and field conflict UI.

## Acceptance checks

- Move a Camera with no competing server edit and verify a new designed revision.
- Change the same geometry concurrently and verify an explicit conflict.
- Verify geometry conflicts include base, server, client, and source metadata.
- Reject invalid coordinates without creating a revision.
- Resolve a conflict through each supported action and verify a new audited ChangeSet.

## Scenarios

### Normal flow

A designer moves a Camera from A to B against the current revision. Validation passes, the design ChangeSet is auto-approved, and B becomes the current `DESIGNED` geometry.

### Failure flow

The server has moved the Camera to C while an offline client proposes B from the old base. The server retains C and returns an explicit geometry conflict rather than choosing B.

## Traceability

This ADR implements the geometry conflict requirements in Project Platform Architecture v1.1 and the geometry portions of F3/F4/F5 in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). The acceptance checks are mandatory for concurrent-edit verification.

## Open questions (non-binding)

- The MVP coordinate reference system and precision policy.
- Whether geometry validation includes project boundary checks.
- The visual encoding for conflict overlays.

