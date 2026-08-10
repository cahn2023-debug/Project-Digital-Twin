---
id: 2tsghf
title: "[offline-desktop-sync-04] Implement background sync replay engine, retry logic and manual sync trigger"
status: done
priority: high
labels: []
createdAt: '2026-08-10T01:18:25.968Z'
updatedAt: '2026-08-10T01:30:21.038Z'
completedAt: '2026-08-10T01:28:01.171Z'
timeSpent: 0
assignee: '@me'
spec: specs/2026-08-10/offline-desktop-server-sync
---
# [offline-desktop-sync-04] Implement background sync replay engine, retry logic and manual sync trigger

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Develop automatic background replay worker for pending mutation events with exponential backoff and manual sync command.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement ReplayEngine worker with backoff retries in desktop-core
- [x] #2 Expose trigger_manual_sync and get_last_sync_info Tauri IPC commands
- [x] #3 Add unit tests for background replay worker and retry backoff logic
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement replay engine in desktop-core (crates/desktop-core/src/replay.rs) handling background mutation event batch processing, exponential backoff retries, and status transitions.
2. Implement Tauri IPC commands in src-tauri (apps/desktop/src-tauri/src/replay_cmd.rs) for trigger_manual_sync and get_last_sync_info.
3. Add unit and integration tests verifying event batch replay, retry count increments, and manual sync execution.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented ReplayEngine worker for background batch replay and retry backoff logic in desktop-core (replay module) and exposed trigger_manual_sync Tauri IPC command in src-tauri. Verified with 18 passing tests. System Decision Impact: none — Followed established Outbox replay pattern. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass
<!-- SECTION:NOTES:END -->

