---
id: 75ic9j
title: "[sample-data-removal-01] Remove backend domain and database seed data"
status: done
priority: high
labels:
  - from-spec
  - spec:sample-data-removal
  - spec-date:2026-08-10
createdAt: '2026-08-10T04:33:04.101Z'
updatedAt: '2026-08-10T04:46:14.297Z'
completedAt: '2026-08-10T04:37:02.547Z'
timeSpent: 48
assignee: '@me'
spec: specs/2026-08-10/sample-data-removal
fulfills:
  - AC-1
---
# [sample-data-removal-01] Remove backend domain and database seed data

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove all pre-seeded default population in CameraStore (apps/server/app/domain.py), startup database initialization code, and default store snapshots so server starts completely empty.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Remove pre-seeded records from CameraStore initialization
- [x] #2 Ensure runtime_store_snapshots initializes empty
- [x] #3 Pass backend unit tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec Decision Compliance: D1=pass, D2=pass, D3=pass
System Decision Impact: none — Verified CameraStore starts empty with zero pre-seeded records and added is_empty() domain check.
<!-- SECTION:NOTES:END -->

