---
id: dzvcqy
title: "[offline-desktop-sync-02] Implement offline authentication and cached credential management"
status: done
priority: high
labels: []
createdAt: '2026-08-10T01:18:20.995Z'
updatedAt: '2026-08-10T01:30:11.043Z'
completedAt: '2026-08-10T01:25:32.104Z'
timeSpent: 0
assignee: '@me'
spec: specs/2026-08-10/offline-desktop-server-sync
---
# [offline-desktop-sync-02] Implement offline authentication and cached credential management

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cache JWT and user profile credentials in encrypted local storage for offline login and session validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement auth session caching and offline validation in desktop-core
- [x] #2 Expose offline_login and cache_online_session Tauri IPC commands
- [x] #3 Add unit tests verifying offline authentication with valid and invalid passwords
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement auth module in desktop-core (crates/desktop-core/src/auth.rs) providing save_session and validate_offline_session with password hash verification and JWT expiration checks against EncryptedDb.
2. Implement Tauri IPC commands in src-tauri (apps/desktop/src-tauri/src/auth_cmd.rs) for offline_login and cache_online_session.
3. Add unit and integration tests covering online session caching, successful offline authentication, and invalid password/expired session rejections.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented auth session caching and offline authentication validation in desktop-core (auth module) and exposed cache_user_session and offline_authenticate_user Tauri IPC commands. Verified with 16 passing tests. System Decision Impact: none — Followed established SQLCipher encrypted database architecture. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass
<!-- SECTION:NOTES:END -->

