# ADR-006: Transactional Event Outbox

- **Date:** 2026-08-09
- **Status:** Accepted baseline
- **Scope:** MVP and Camera Vertical Slice

## Context

Canonical changes must update projections, dashboards, sync feeds, and integrations without losing events between a database commit and background publication.

## Decision

Every successful canonical mutation that has downstream effects writes an outbox event in the same atomic transaction. An event contains `event_id`, `event_type`, `aggregate_id`, `aggregate_version`, `project_id`, payload, `occurred_at`, and nullable `published_at`.

Delivery is at least once. Consumers are idempotent by event ID and aggregate version. Ordering is guaranteed per aggregate, not globally. Workers retry unpublished events with observable failure state. Consumers may rebuild derived projections from retained events or canonical revisions; derived state is never the sole authority.

The MVP uses a database-backed outbox and worker. A broker is not a binding dependency.

## Alternatives

- Publish synchronously after commit: rejected because failures can lose notifications.
- Publish before commit: rejected because consumers can observe rolled-back state.
- Adopt Kafka at MVP: rejected because the required workload does not justify the operational dependency.

## Consequences

Canonical transactions include outbox work and must remain bounded. Consumers must tolerate duplicates and restarts. Operations need backlog, retry, and lag metrics.

Future broker adoption is allowed only behind the same event and delivery contract.

## Migration impact

Existing mutations first add outbox rows and a worker. Rollback stops publication while retaining rows for replay. A superseding ADR must preserve event identity, ordering, idempotency, and historical replay semantics.

## Related ADRs and implementation order

Implement after [ADR-003](ADR-003-changeset-model.md) and [ADR-004](ADR-004-entity-revisions.md). It feeds [ADR-005](ADR-005-sync-concurrency.md), dashboard projections, and audit/rebuild workflows.

## Acceptance checks

- Commit an approved ChangeSet and verify its outbox row is committed atomically.
- Roll back a canonical transaction and verify no corresponding outbox event remains.
- Deliver an event twice and verify an idempotent consumer applies it once.
- Restart the worker with pending rows and verify eventual delivery.
- Verify aggregate ordering and backlog/lag visibility.

## Scenarios

### Normal flow

An approval transaction creates an `AS_BUILT` revision and an outbox event. The worker delivers it to the dashboard projection, which records the source event version.

### Failure flow

The worker crashes after consumer processing but before marking the event published. Retry delivers the duplicate, the consumer recognizes the event ID, and the projection remains correct.

## Traceability

This ADR implements the transactional outbox, at-least-once delivery, idempotency, and rebuildability requirements in Project Platform Architecture v1.1. It closes the event portion of F3/F5/F6 in [CURRENT_ARCHITECTURE.md](../architecture/CURRENT_ARCHITECTURE.md).

## Open questions (non-binding)

- Worker scheduling and deployment topology.
- Event payload versioning encoding.
- Whether projection rebuilds read events, revisions, or both.

