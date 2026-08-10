---
id: 20260810-1124-server-reconciliation-state-uses-the-runtime-snapshot-boundary
title: Server reconciliation state uses the runtime snapshot boundary
status: draft
supersedes: []
supersededBy: []
tags:
  - server
  - sync
  - persistence
  - reconciliation
sources:
  - '@doc/specs/2026-08-10/desktop-server-sync'
relatedDocs:
  - specs/2026-08-10/desktop-server-sync
relatedTasks:
  - 0x820i
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "0x820i" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T04:24:26.344Z'
createdAt: '2026-08-10T04:24:26.344Z'
updatedAt: '2026-08-10T04:24:26.344Z'
---

## Context

The sync reconciliation engine previously kept processed mutation IDs, entity field state, and staged conflicts only in process memory, so restarts or multiple server workers could lose idempotency and conflict review state.

## Decision

Persist a serializable ReconciliationState inside the existing PostgresCameraStore runtime_store_snapshots JSONB boundary. Sync requests construct the engine from the current request-scoped store state, and the existing SELECT FOR UPDATE transaction serializes workers. Keep GLOBAL_RECONCILER only as the development/test fallback until the canonical store is relationally decomposed.

## Alternatives Considered

A separate reconciliation table or external cache would add another schema/transaction boundary and was not required for this bounded follow-up.

## Consequences

Reconciliation idempotency, field state, and staged conflicts survive server restart and are shared across workers without a second persistence transaction or new dependency. The snapshot remains a transitional boundary and can later be decomposed into relational tables.
