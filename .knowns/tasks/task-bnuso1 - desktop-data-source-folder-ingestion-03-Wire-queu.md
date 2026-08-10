---
id: bnuso1
title: "[desktop-data-source-folder-ingestion-03] Wire queued scans to parsers, Raw, ChangeSets and local-first persistence"
status: todo
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - import-worker
  - persistence
createdAt: '2026-08-10T01:50:21.755Z'
updatedAt: '2026-08-10T01:50:39.936Z'
timeSpent: 0
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-4
  - AC-6
  - AC-7
  - AC-9
order: 30
---
# [desktop-data-source-folder-ingestion-03] Wire queued scans to parsers, Raw, ChangeSets and local-first persistence

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the missing FILE_SCAN processing path. Select the existing Excel/document parser, persist file version/Raw/source locators and file-specific ChangeSets in the local encrypted boundary, submit known Profiles automatically, and create durable pending sync jobs without writing canonical state before approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 FILE_SCAN jobs dispatch to the existing Excel/document parser boundary and register file version, Raw rows/assets and source locators locally.
- [ ] #2 Known Profiles auto-submit; new/mismatched structures produce a durable preview/import state without canonical apply before approval.
- [ ] #3 ChangeSets and pending sync jobs survive restart/offline and duplicate idempotency keys do not create duplicate imports.
<!-- AC:END -->

