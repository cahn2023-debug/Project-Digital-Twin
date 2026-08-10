---
id: ipwdel
title: "[offline-desktop-sync-03] Implement Append-Only Mutation Event queue and network status listener"
status: done
priority: high
labels: []
createdAt: '2026-08-10T01:18:23.060Z'
updatedAt: '2026-08-10T01:30:16.029Z'
completedAt: '2026-08-10T01:26:44.092Z'
timeSpent: 0
assignee: '@me'
spec: specs/2026-08-10/offline-desktop-server-sync
---
# [offline-desktop-sync-03] Implement Append-Only Mutation Event queue and network status listener

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build local Append-Only Mutation Event queue table in SQLite and network online/offline event listener.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement Append-Only mutation queue helpers in desktop-core
- [x] #2 Expose push_client_mutation_event and get_pending_mutation_count Tauri IPC commands
- [x] #3 Add unit tests verifying event queue ordering and status updates
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement mutation module in desktop-core (crates/desktop-core/src/mutation.rs) providing enqueue_mutation_event, peek_pending_events, and mark_event_status helpers for Append-Only event log queueing.
2. Implement Tauri IPC commands in src-tauri (apps/desktop/src-tauri/src/mutation_cmd.rs) for pushing mutation events, retrieving pending count, and broadcasting network status.
3. Add unit and integration tests verifying FIFO event ordering, status transitions, and payload encryption.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Append-Only Mutation Event queue and network status monitoring in desktop-core (mutation module) and exposed push_client_mutation, get_pending_mutation_count, and set_network_status Tauri IPC commands. Verified with 17 passing tests. System Decision Impact: none — Reused established Append-Only event outbox architecture. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass
<!-- SECTION:NOTES:END -->

