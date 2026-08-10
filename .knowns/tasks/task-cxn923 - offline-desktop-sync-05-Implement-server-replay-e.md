---
id: cxn923
title: "[offline-desktop-sync-05] Implement server replay endpoint and conflict resolution workflow"
status: done
priority: high
labels: []
createdAt: '2026-08-10T01:18:28.979Z'
updatedAt: '2026-08-10T01:30:26.042Z'
completedAt: '2026-08-10T01:29:14.077Z'
timeSpent: 0
assignee: '@me'
spec: specs/2026-08-10/offline-desktop-server-sync
---
# [offline-desktop-sync-05] Implement server replay endpoint and conflict resolution workflow

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build server-side replay endpoint to process mutation events and conflict resolution UI + API handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement server replay endpoint and conflict resolution module in desktop-core
- [x] #2 Expose resolve_mutation_conflict Tauri IPC command
- [x] #3 Add unit tests verifying conflict detection and USE_SERVER vs OVERWRITE_WITH_CLIENT resolution choices
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement server sync and conflict resolution handler in desktop-core (crates/desktop-core/src/server_sync.rs) with version checking and resolution strategies (USE_SERVER vs OVERWRITE_WITH_CLIENT).
2. Implement Tauri IPC command in src-tauri (apps/desktop/src-tauri/src/conflict_cmd.rs) for resolve_mutation_conflict.
3. Add unit and integration tests verifying version conflict detection and resolution handling.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented server sync handler with version conflict detection and resolution strategies (USE_SERVER / OVERWRITE_WITH_CLIENT) in desktop-core (server_sync module) and exposed resolve_mutation_conflict Tauri IPC command in src-tauri. Verified with 19 passing tests. System Decision Impact: none — Reused established Conflict Resolution model. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass
<!-- SECTION:NOTES:END -->

