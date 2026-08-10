---
id: 0x820i
title: 'Review follow-up: persist server reconciliation state across restarts'
status: todo
priority: medium
labels:
  - review-followup
  - sync
  - persistence
createdAt: '2026-08-10T03:53:58.748Z'
updatedAt: '2026-08-10T03:54:05.520Z'
timeSpent: 0
---
# Review follow-up: persist server reconciliation state across restarts

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
P2 follow-up from desktop-server-sync review: move ReconciliationEngine processed mutation IDs, entity field state and staged conflicts from process-local memory into the server persistence boundary so idempotency and conflict review survive process restarts and multiple workers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Processed mutation IDs and entity field state persist across server restart.
- [ ] #2 Staged conflicts remain queryable and resolvable when requests are handled by multiple workers.
- [ ] #3 Persistence and restart/integration tests cover idempotency and conflict recovery.
<!-- AC:END -->
