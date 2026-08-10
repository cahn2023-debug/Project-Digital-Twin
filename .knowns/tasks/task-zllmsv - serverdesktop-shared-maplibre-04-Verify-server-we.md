---
id: zllmsv
title: "[serverdesktop-shared-maplibre-04] Verify server–web–Tauri basemap integration"
status: todo
priority: high
labels:
  - from-spec
  - spec:serverdesktop-shared-maplibre-basemap-manifest
  - spec-date:2026-08-10
  - integration
  - verification
  - tauri
createdAt: '2026-08-10T02:05:33.242Z'
updatedAt: '2026-08-10T02:05:50.441Z'
timeSpent: 0
spec: specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
fulfills:
  - AC-8
order: 40
---
# [serverdesktop-shared-maplibre-04] Verify server–web–Tauri basemap integration

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run integrated server contract, web build/typecheck, Tauri smoke, server-offline, Internet-offline, package download/restore, reconnect, and last-known-good verification; fix cross-boundary integration gaps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run server contract, web typecheck/build, desktop typecheck, and Tauri smoke verification.
- [ ] #2 Simulate server-offline, Internet-offline, invalid manifest, reconnect, package restore, and last-known-good paths.
- [ ] #3 Record unresolved provider/license or environment limitations without weakening acceptance criteria.
<!-- AC:END -->

