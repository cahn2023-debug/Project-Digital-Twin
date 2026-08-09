# ADR-001: Canonical Entity Identity

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

The platform combines imported files, designed geometry, field observations, approvals, and derived views. Those representations must refer to the same domain object even when codes, files, locations, or revisions change.

## Decision

Each project-scoped entity has an immutable `entity_id` generated at creation. Entity identity is separate from mutable entity state and representation revisions.

The logical identity record contains:

- `entity_id`
- `project_id`
- `entity_type`
- `canonical_code`
- `created_at`
- `created_by`

`entity_id` is the only durable cross-system identity. `canonical_code` is project-scoped business data and may be changed only through an explicit, auditable mutation. External keys and source-row keys are provenance attributes, never identity replacements.

Identity transitions are `PROPOSED → ACTIVE → RETIRED`. Retirement prevents new operational references but preserves historical references. Identity merges or splits require an explicit migration record and never silently reuse an existing ID.

The binding invariants are:

1. An entity ID never changes after creation.
2. An entity belongs to exactly one project.
3. A source or display code cannot replace an entity ID.
4. Every revision, ChangeSet, observation, audit record, and evidence locator references the immutable ID.
5. AI or derived output cannot create authoritative identity without an approved domain mutation.

## Alternatives

- Use business codes as primary keys: rejected because codes change and are not globally stable.
- Generate IDs independently in each client: rejected because offline creation can collide or create divergent identities.
- Use a graph-only identity layer: rejected because the MVP needs explicit relational ownership and revision history.

## Consequences

Imports must resolve or create identities before state changes. Renames and source remapping remain traceable. APIs and local projections must carry `entity_id` even when users primarily see business codes.

Future domains may add relationships and aliases, but they remain non-binding until separately specified.

## Migration impact

Forward adoption creates identity records before importing mutable state and backfills all references through a deterministic mapping. Rollback preserves generated IDs and removes only unapproved projections. A later conflict creates a superseding ADR linked to this record; this ADR remains historical and is never overwritten.

## Related ADRs and implementation order

This is the first contract. [ADR-002](ADR-002-file-authority.md) attaches file evidence, [ADR-003](ADR-003-changeset-model.md) governs identity mutations, and [ADR-004](ADR-004-entity-revisions.md) stores mutable state. Implement identity before all three.

## Acceptance checks

- Create two entities in one project and verify distinct immutable IDs.
- Change a canonical code and verify the entity ID and historical references remain unchanged.
- Import the same source row twice and verify deterministic identity resolution.
- Attempt to reference an entity from another project and reject the operation.
- Verify revisions, observations, ChangeSets, and audit records contain the entity ID.

## Scenarios

### Normal flow

An imported Camera row resolves to an existing project-scoped entity, updates mutable state through a revision, and retains the same `entity_id`.

### Failure flow

A row claims an ID belonging to another project. The import is classified invalid or conflicting, no identity is reassigned, and the source locator remains available for review.

## Traceability

This ADR implements the immutable identity and provenance invariants in Project Platform Architecture v1.1 and the F1 gap in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md). Conformance is verified by the acceptance checks above and by dependent ADR checks.

## Open questions (non-binding)

- Whether IDs are represented as UUID text or another opaque UUID-compatible encoding.
- Whether aliases receive a dedicated table or a typed relation.
- Whether retired identities can be reactivated under a later policy.

