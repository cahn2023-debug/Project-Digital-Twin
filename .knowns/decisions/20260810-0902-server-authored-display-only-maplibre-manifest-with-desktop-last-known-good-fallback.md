---
id: 20260810-0902-server-authored-display-only-maplibre-manifest-with-desktop-last-known-good-fallback
title: Server-authored display-only MapLibre manifest with desktop last-known-good fallback
status: draft
supersedes: []
supersededBy: []
tags:
  - maplibre
  - desktop
  - server
  - manifest
  - offline
sources:
  - '@doc/specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest'
relatedDocs:
  - specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
  - specs/2026-08-09/maplibre-basemap-for-design
relatedTasks:
  - 1xqatp
  - 99f71h
  - ahh0p8
  - zllmsv
verification: []
reviewState: ready_for_review
reviewBlockers: []
reviewMatches: []
reviewAllowedResolutions:
  - accept_new
  - reject_new
reviewEvaluatedAt: '2026-08-10T02:50:58.938Z'
createdAt: '2026-08-10T02:02:02.349Z'
updatedAt: '2026-08-10T02:50:58.938Z'
---

## Context

Server and desktop need the same MapLibre basemap display contract while the desktop must continue operating when the server or Internet is unavailable.

## Decision

The server is the source of the display-only MapLibre manifest. The desktop validates and conditionally refreshes it with ETag/Last-Modified, retains a last-known-good manifest and tile package, and uses public tile sources or selected local packages without including project data in the manifest.

## Alternatives Considered

Keep client-only map configuration; proxy all tiles through the server; bundle one immutable map configuration without server refresh.

## Consequences

Web and desktop must share the manifest schema and validation rules. Desktop needs atomic local manifest/package persistence and reconnect fallback. Tile provider attribution and production-use rights remain explicit deployment gates.
