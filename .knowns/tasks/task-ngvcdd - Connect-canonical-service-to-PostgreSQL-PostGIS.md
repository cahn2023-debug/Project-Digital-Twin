---
id: ngvcdd
title: Connect canonical service to PostgreSQL/PostGIS
status: todo
priority: high
labels:
  - implementation
  - persistence
  - camera-vertical-slice
createdAt: '2026-08-09T09:23:54.703Z'
updatedAt: '2026-08-09T09:23:54.703Z'
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
<!-- AC:END -->

