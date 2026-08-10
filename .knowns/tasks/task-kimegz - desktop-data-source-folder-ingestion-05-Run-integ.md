---
id: kimegz
title: "[desktop-data-source-folder-ingestion-05] Run integrated offline import, sync and SDD verification"
status: todo
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - integration
  - verification
createdAt: '2026-08-10T01:50:21.838Z'
updatedAt: '2026-08-10T01:50:43.771Z'
timeSpent: 0
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
- [ ] #1 End-to-end fixtures cover Excel, Markdown/TXT/Word, locked/invalid files, duplicate hashes and self-write suppression.
- [ ] #2 Offline restart and reconnect verification proves pending jobs survive and replay idempotently.
- [ ] #3 Run broad typecheck/build/test/diff/validation checks and record final Spec Decision Compliance D1-D7 plus System Decision Impact.
<!-- AC:END -->

