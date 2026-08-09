# ADR-005: Synchronization and Concurrency

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

Field work must continue offline while the server remains authoritative. Clients need deterministic push and pull behavior that never silently overwrites concurrent changes.

## Decision

The server owns a monotonic change revision. Each client stores `last_server_revision` and submits operations with an idempotency key, entity/representation, base revision, and operation payload. Pull returns all changes after a cursor. Push is deterministic: an operation is applied only when its base revision is compatible with the current revision.

Non-overlapping scalar changes may be rebased from `BASE + SERVER + CLIENT`. Same-field changes produce an explicit conflict. Geometry changes are governed by [ADR-007](ADR-007-geometry-conflicts.md) and are never automatically merged when both sides changed geometry.

Every push result is one of `APPLIED`, `ALREADY_APPLIED`, `REBASED`, `CONFLICT`, or `REJECTED`. Pull is repeatable from any acknowledged cursor. Client queues retain failed operations and server responses until the user or policy resolves them.

## Alternatives

- Last-write-wins: rejected because it silently loses field or design work.
- General CRDT for every domain: deferred until workload evidence requires it.
- Client-authoritative sync: rejected because canonical approvals and audit must be centralized.

## Consequences

Clients need durable queues, cursors, retry state, and conflict UI. APIs must be idempotent and expose enough base/server/client evidence for resolution. Server revision ordering is part of the contract, not a UI detail.

Future mobile clients may use the same contract regardless of framework.

## Migration impact

Desktop and web clients first persist cursor and operation IDs, then adopt push/pull. Rollback pauses pushes, drains or preserves queues, and resumes from the last acknowledged cursor. A superseding sync decision must define compatibility with existing cursors and idempotency keys.

## Related ADRs and implementation order

Implement after [ADR-003](ADR-003-changeset-model.md) and [ADR-004](ADR-004-entity-revisions.md). It depends on [ADR-001](ADR-001-canonical-entity-identity.md), uses [ADR-007](ADR-007-geometry-conflicts.md), and emits facts through [ADR-006](ADR-006-event-outbox.md).

## Acceptance checks

- Retry an applied operation and verify exactly one mutation.
- Pull from a cursor twice and verify deterministic results.
- Rebase two non-overlapping scalar changes successfully.
- Detect a same-field concurrent edit as a conflict.
- Verify an offline queue survives restart and preserves operation order.

## Scenarios

### Normal flow

An offline operator submits a verification against revision 4. The server is still at revision 4, applies it, advances the cursor, and the client acknowledges the operation.

### Failure flow

The server is at revision 5 with a changed field. The client’s base is revision 4; the server returns a conflict containing base, server, and client values and changes nothing until resolution.

## Traceability

This ADR implements deterministic local-first synchronization, server authority, and explicit conflict behavior in Project Platform Architecture v1.1 and F5 in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). The checks above are required for offline MVP acceptance.

## Open questions (non-binding)

- Transport encoding and compression for large pull batches.
- Cursor expiration and snapshot recovery policy.
- Whether attachment uploads use separate resumable sessions.

