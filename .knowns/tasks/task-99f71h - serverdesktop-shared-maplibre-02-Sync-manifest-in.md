---
id: 99f71h
title: "[serverdesktop-shared-maplibre-02] Sync manifest in web and desktop with last-known-good fallback"
status: todo
priority: high
labels:
  - from-spec
  - spec:serverdesktop-shared-maplibre-basemap-manifest
  - spec-date:2026-08-10
  - web
  - desktop
  - manifest
  - fallback
createdAt: '2026-08-10T02:05:33.124Z'
updatedAt: '2026-08-10T02:05:45.337Z'
timeSpent: 0
spec: specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
fulfills:
  - AC-2
  - AC-3
  - AC-6
  - AC-7
order: 20
---
# [serverdesktop-shared-maplibre-02] Sync manifest in web and desktop with last-known-good fallback

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the shared manifest client adapter for the web/Tauri frontend, conditional ETag/Last-Modified refresh, local last-known-good persistence, startup/reconnect timeout behavior, invalid-manifest fallback, and integration with the current MapLibre DESIGN UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Load and validate the manifest from server or local last-known-good cache.
- [ ] #2 Use ETag/Last-Modified refresh with startup/reconnect timeout fallback.
- [ ] #3 Wire the current DESIGN MapLibre controls to manifest-defined modes and layer groups.
<!-- AC:END -->

