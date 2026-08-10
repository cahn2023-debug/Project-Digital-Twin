---
id: kimegz
title: "[desktop-data-source-folder-ingestion-05] Run integrated offline import, sync and SDD verification"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - integration
  - verification
createdAt: '2026-08-10T01:50:21.838Z'
updatedAt: '2026-08-10T02:44:38.439Z'
completedAt: '2026-08-10T02:44:38.439Z'
timeSpent: 69
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-9
  - AC-10
  - AC-12
order: 50
---
# [desktop-data-source-folder-ingestion-05] Run integrated offline import, sync and SDD verification

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete the end-to-end verification wave across multiple sources, restart/offline queue recovery, idempotent duplicate/self-write suppression, parser fixtures, UI/Tauri wiring and broad workspace checks. Fix integration defects found by review and record final SDD compliance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 End-to-end fixtures cover Excel, Markdown/TXT/Word, locked/invalid files, duplicate hashes and self-write suppression.
- [x] #2 Offline restart and reconnect verification proves pending jobs survive and replay idempotently.
- [x] #3 Run broad typecheck/build/test/diff/validation checks and record final Spec Decision Compliance D1-D7 plus System Decision Impact.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add/confirm end-to-end parser fixtures for Excel, Markdown/TXT/Word, invalid/locked input, duplicate hash and self-write suppression.
2. Verify manifest restart persistence, independent source queues/watchers, retry/reconnect behavior, local preview/profile persistence and idempotent ChangeSet responses.
3. Run Rust, Tauri, server, web typecheck/build, diff and Knowns SDD validation; review the integrated diff and record final D1-D7/System Decision compliance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Integrated verification confirms existing fixtures cover Excel/import idempotency, Markdown/TXT/Word parsing, invalid/locked input, duplicate hashes and self-write suppression; desktop-core covers recursive filtering, source isolation, retry and restart persistence. Local preview/profile/Raw persistence and per-file status are wired through the Tauri worker and Datacenter UI.

Verification: cargo test --workspace = 23 desktop-core tests + 1 desktop integration test passed; corepack pnpm --filter @project/desktop typecheck passed; server pytest = 53 passed; scoped git diff --check passed. Web typecheck previously passed for ingestion and current build is blocked only by unrelated Design offline-basemap errors in apps/web/src/features/design/offlineBasemap.ts and OfflineBasemapPanel.tsx. Global Knowns SDD validation reports unrelated errors/warnings for existing MapLibre/server-sync tasks (1xqatp/99f71h/ahh0p8 and desktop-server-sync); ingestion tasks i3beyy, bnuso1 and aobrj5 are compliant.

Review: PASS, P1=0, P2=0 for ingestion diff; no unrelated Design/server-sync edits made.

System Decision Impact: none — this task adds verification evidence only; durable ingestion choices are already captured by the linked draft candidates.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass
<!-- SECTION:NOTES:END -->

