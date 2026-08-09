# ADR-003: ChangeSet Model

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

Direct writes from map edits, imports, and field operations make review, conflict detection, and auditability impossible. The platform needs an explicit mutation envelope distinct from asynchronous domain events.

## Decision

A ChangeSet is the unit of proposed domain change. It contains `changeset_id`, `project_id`, `origin`, `submitted_by`, `submitted_at`, `status`, and metadata. Each Change Item contains `changeset_id`, `entity_id`, `representation`, `base_revision`, `patch`, and `change_type`.

ChangeSets use these states:

`DRAFT → SUBMITTED → VALIDATING → PENDING_APPROVAL → APPROVED → APPLIED`

Failure branches are `VALIDATING → CONFLICT`, `PENDING_APPROVAL → REJECTED`, and `APPROVED → FAILED`. A failed or rejected ChangeSet is retained and cannot be silently retried as a different mutation. A retry creates a new ChangeSet linked to the original.

Scalar and object patches use a JSON-Patch-compatible logical form. Geometry is represented by a typed geometry operation and follows [ADR-007](ADR-007-geometry-conflicts.md). A ChangeSet must carry the base revision for every changed representation.

Design edits may transition directly through approval when the principal has the design-edit permission. Field-originated changes always require manual approval. Applying an approved ChangeSet atomically creates the next revision, records audit data, and emits an outbox event as described by [ADR-006](ADR-006-event-outbox.md).

## Alternatives

- Update canonical rows directly: rejected because review and rollback disappear.
- Use only domain events as commands: rejected because events describe completed facts, not proposals.
- Use a general workflow engine: rejected for MVP complexity and unnecessary coupling.

## Consequences

All user-visible mutations need a ChangeSet path. APIs must expose status and conflict details. UI can display a clear change inbox instead of claiming success before application.

Future workflow automation is non-binding and must preserve these states and audit rules.

## Migration impact

Initial features wrap their writes in ChangeSets before canonical mutation. Rollback rejects or supersedes unapplied ChangeSets and never deletes applied history. A future incompatible lifecycle requires a superseding ADR with explicit mapping of old states.

## Related ADRs and implementation order

Implement after [ADR-001](ADR-001-canonical-entity-identity.md) and [ADR-004](ADR-004-entity-revisions.md). It is consumed by [ADR-005](ADR-005-sync-concurrency.md), [ADR-006](ADR-006-event-outbox.md), and [ADR-007](ADR-007-geometry-conflicts.md).

## Acceptance checks

- Submit a valid Camera edit and observe every required state transition.
- Reject an invalid or unauthorized ChangeSet without changing canonical state.
- Apply a ChangeSet and verify one revision, one audit record, and one outbox event are committed atomically.
- Re-submit an already applied idempotency key and verify no duplicate mutation.
- Verify a conflict exposes base, server, and proposed values.

## Scenarios

### Normal flow

A designer drags a Camera, the client creates a geometry ChangeSet with the current base revision, validation passes, auto-approval applies it, and the next `DESIGNED` revision is created.

### Failure flow

The base revision is stale. Validation moves the ChangeSet to `CONFLICT`, leaves canonical state untouched, and presents the competing values for resolution.

## Traceability

This ADR implements explicit change, approval, conflict, and audit behavior in Project Platform Architecture v1.1 and F3 in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). Its acceptance checks must pass before field sync is enabled.

## Open questions (non-binding)

- Whether patches are serialized as JSON text or a structured equivalent.
- The exact approval policy expression language.
- Whether ChangeSet metadata needs a typed extension registry.

