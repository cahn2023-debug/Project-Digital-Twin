---
id: 0x820i
title: 'Review follow-up: persist server reconciliation state across restarts'
status: done
priority: medium
labels:
  - review-followup
  - sync
  - persistence
createdAt: '2026-08-10T03:53:58.748Z'
updatedAt: '2026-08-10T04:30:40.687Z'
completedAt: '2026-08-10T04:25:50.412Z'
timeSpent: 454
assignee: '@me'
---
# Review follow-up: persist server reconciliation state across restarts

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
P2 follow-up from desktop-server-sync review: move ReconciliationEngine processed mutation IDs, entity field state and staged conflicts from process-local memory into the server persistence boundary so idempotency and conflict review survive process restarts and multiple workers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Processed mutation IDs and entity field state persist across server restart.
- [x] #2 Staged conflicts remain queryable and resolvable when requests are handled by multiple workers.
- [x] #3 Persistence and restart/integration tests cover idempotency and conflict recovery.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract reconciliation state into a serializable ReconciliationState and attach it to PostgresCameraStore so the existing runtime_store_snapshots transaction persists processed mutation IDs, entity field state, and staged conflicts across restarts.
2. Route sync endpoints through an engine bound to the current store state; keep GLOBAL_RECONCILER as the development/test fallback, while the existing SELECT FOR UPDATE request transaction serializes multiple workers.
3. Add restart snapshot and shared-state multi-worker tests covering duplicate idempotency, conflict listing/resolution, and state round-trip.
4. Run targeted/full server tests, task/entity validation, and diff checks; record AC evidence and implementation notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started: replacing process-local reconciliation state with a persistent SQLite-backed server store and restart/multi-worker coverage.
Plan check: AC1 maps to steps 1 and 3; AC2 maps to steps 2 and 3; AC3 maps to step 3. Assumption: reuse the existing PostgreSQL runtime_store_snapshots row lock/transaction boundary; no new dependency or migration table is needed.
Checkpoint: added serializable ReconciliationState to PostgresCameraStore snapshot state; sync routes now resolve an engine from the request store, preserving the in-memory fallback. Targeted sync tests pass 6/6.
Implemented: ReconciliationState now serializes processed mutation IDs, entity field state and staged conflicts through PostgresCameraStore.runtime_store_snapshots. Sync routes bind to the current store-scoped state; GLOBAL_RECONCILER remains only for development/test fallback. Existing SELECT FOR UPDATE request transactions provide worker serialization. Added restart snapshot, shared multi-worker, and route-binding tests. Verification: uv run --project apps/server pytest -q apps/server/tests = 59 passed, 1 existing Starlette/httpx deprecation warning; server compileall passed; git diff --check passed with repository LF/CRLF warnings. System Decision Impact: candidate @decision/20260810-1124-server-reconciliation-state-uses-the-runtime-snapshot-boundary (added) — persist reconciliation state in the existing locked runtime snapshot boundary and retain the in-memory fallback only for development/tests.
Correction: the implemented persistence boundary is PostgreSQL runtime_store_snapshots, not SQLite; the existing row lock is SELECT FOR UPDATE.
<!-- SECTION:NOTES:END -->

