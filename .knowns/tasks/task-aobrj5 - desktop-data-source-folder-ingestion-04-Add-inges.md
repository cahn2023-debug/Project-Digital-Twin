---
id: aobrj5
title: "[desktop-data-source-folder-ingestion-04] Add ingestion preview, mapping and error status flow"
status: todo
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - preview
  - mapping
  - validation
createdAt: '2026-08-10T01:50:21.791Z'
updatedAt: '2026-08-10T01:50:41.756Z'
timeSpent: 0
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-5
  - AC-8
order: 40
---
# [desktop-data-source-folder-ingestion-04] Add ingestion preview, mapping and error status flow

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose unknown/mismatched structures through preview and mapping, allow Profile confirmation, and surface per-file/row/field validation results while continuing independent valid work. Connect preview/status data to the source UI and preserve Raw for unmapped, invalid and skipped values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Preview exposes candidate regions/headers and mapping confirmation creates an immutable Profile version.
- [ ] #2 Validation results identify source/file/row/field and allow valid rows to proceed while preserving invalid/unmapped/skipped Raw.
- [ ] #3 Source UI renders per-file status and error details without blocking independent files.
<!-- AC:END -->

