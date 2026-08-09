# ADR-004: Entity Revisions

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

Designed state, field observations, and approved as-built state must coexist. Replacing a current row would destroy history and make reconciliation impossible.

## Decision

Mutable state is stored as immutable entity revisions. A revision contains `revision_id`, `entity_id`, `representation`, `revision`, `data`, optional `geometry`, `valid_from`, `valid_to`, `created_at`, `created_by`, and the originating `changeset_id`.

The MVP supports `DESIGNED` and `AS_BUILT` representations. Revision numbers increase per entity and representation. Exactly one revision per representation is current at a time; closing the previous revision and opening the next is atomic. `AS_BUILT` creation never overwrites `DESIGNED`, and an approved revision is never edited in place.

Current state is a projection of revision history. It may be indexed for query performance, but it must be rebuildable from immutable revisions. Provenance and audit references remain attached to the revision or its originating ChangeSet.

## Alternatives

- Store only the latest JSON state: rejected because history and approvals become unverifiable.
- Maintain separate unrelated tables for each representation: rejected because shared revision semantics would drift.
- Use event sourcing for every read: deferred; the MVP needs an explicit revision record and rebuildable projections.

## Consequences

Reads need a current-revision query or projection. Writes must use transactions and optimistic checks. Storage grows over time and requires the retention policy in [ADR-008](ADR-008-storage-retention.md).

Future representations are non-binding extensions of the same revision contract.

## Migration impact

Adoption creates an initial revision for imported or seeded state and marks it current. Rollback points the projection to the prior valid revision; it does not delete the newer history. A superseding ADR must preserve historical revision interpretation and define conversion rules.

## Related ADRs and implementation order

Implement after [ADR-001](ADR-001-canonical-entity-identity.md) and before [ADR-003](ADR-003-changeset-model.md), [ADR-005](ADR-005-sync-concurrency.md), and approval. It is the state foundation for [ADR-007](ADR-007-geometry-conflicts.md).

## Acceptance checks

- Create an initial Camera `DESIGNED` revision and verify it is current.
- Apply a change and verify the previous revision remains immutable and historical.
- Create `AS_BUILT` and verify `DESIGNED` remains independently queryable.
- Rebuild current-state projections from revisions and compare them with live projections.
- Reject a revision write with a stale base revision.

## Scenarios

### Normal flow

An approved field ChangeSet creates a new `AS_BUILT` revision while preserving the prior `AS_BUILT` and all `DESIGNED` revisions.

### Failure flow

Two writers attempt to create the same next revision. One transaction wins; the other fails its revision check and leaves no partial revision.

## Traceability

This ADR implements versioned approved state and separate designed/as-built representations in Project Platform Architecture v1.1 and F4 in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). Acceptance checks define implementation conformance.

## Open questions (non-binding)

- Whether current lookup uses a boolean, pointer, or indexed query.
- The exact geometry serialization and coordinate reference system.
- Whether revision payloads require field-level compression.

