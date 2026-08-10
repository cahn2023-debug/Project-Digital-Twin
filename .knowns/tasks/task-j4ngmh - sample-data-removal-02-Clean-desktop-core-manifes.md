---
id: j4ngmh
title: "[sample-data-removal-02] Clean desktop core & manifest pre-seeded data"
status: done
priority: high
labels:
  - from-spec
  - spec:sample-data-removal
  - spec-date:2026-08-10
createdAt: '2026-08-10T04:33:08.067Z'
updatedAt: '2026-08-10T04:38:43.330Z'
completedAt: '2026-08-10T04:35:47.282Z'
timeSpent: 0
spec: specs/2026-08-10/sample-data-removal
fulfills:
  - AC-1
---
# [sample-data-removal-02] Clean desktop core & manifest pre-seeded data

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove sample data scripts and default SQLite/SQLCipher manifest records in crates/desktop-core and apps/desktop/manifest.sql.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clean manifest.sql sample records
- [x] #2 Ensure desktop_core database initializes empty
- [x] #3 Pass desktop tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec Decision Compliance: D1=pass, D2=pass, D3=pass
System Decision Impact: none — Verified SQLite manifest.sql and desktop-core initialize clean tables with zero pre-seeded records; 24 Rust cargo tests pass.
<!-- SECTION:NOTES:END -->

