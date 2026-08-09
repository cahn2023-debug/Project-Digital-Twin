---
id: ngvcdd
title: Connect canonical service to PostgreSQL/PostGIS
status: in-progress
priority: high
labels:
  - implementation
  - persistence
  - camera-vertical-slice
createdAt: '2026-08-09T09:23:54.703Z'
updatedAt: '2026-08-09T15:37:12.662Z'
timeSpent: 0
assignee: '@me'
parent: swito3
---
# Connect canonical service to PostgreSQL/PostGIS

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the in-memory CameraStore behind the existing service boundary with a PostgreSQL/PostGIS adapter using migrations/0001_initial.sql. Preserve transactionally applied revisions, ChangeSets, approvals, outbox events, and cursor-based sync.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Production API uses a PostgreSQL/PostGIS-backed canonical persistence boundary and never silently falls back to in-memory state.
- [ ] #2 Clean/upgrade migration and integration tests verify restart persistence, transaction/idempotency, project isolation, revision conflicts, approvals, outbox events and sync cursor.
- [ ] #3 Readiness, CI and deployment checks document the database contract and fail clearly when PostGIS is unavailable.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the current CameraStore service contract and wire PostgresCameraStore behind DATABASE_URL with APP_ENV=production refusing in-memory startup.
2. Apply migrations/0001_initial.sql including the versioned runtime snapshot boundary and add Postgres integration tests for restart persistence, idempotency, project isolation, revision conflict and outbox cursor.
3. Run clean/upgrade migration checks, API tests, readiness checks and CI release-config validation; replace the transitional snapshot with relational mappings in a follow-up when all domain tables are exercised.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started under parent swito3: PostgresCameraStore, runtime snapshot migration and production DB guard are implemented. PostGIS integration remains pending because Docker daemon is unavailable.
<!-- SECTION:NOTES:END -->

