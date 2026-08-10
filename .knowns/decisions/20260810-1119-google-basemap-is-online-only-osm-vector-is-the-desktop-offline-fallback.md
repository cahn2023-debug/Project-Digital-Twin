---
id: 20260810-1119-google-basemap-is-online-only-osm-vector-is-the-desktop-offline-fallback
title: Google basemap is online-only; OSM Vector is the desktop offline fallback
status: draft
supersedes: []
supersededBy: []
tags:
  - maplibre
  - offline
  - provider
  - basemap
  - osm
sources:
  - '@doc/specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest'
  - '@doc/specs/2026-08-09/maplibre-basemap-for-design'
  - 'https://www.openstreetmap.org/copyright'
  - 'https://openfreemap.org/quick_start/'
  - 'https://maplibre.org/maplibre-style-spec/sources/'
relatedDocs:
  - specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
  - specs/2026-08-09/maplibre-basemap-for-design
relatedTasks:
  - nh6h0j
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "nh6h0j" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T04:19:11.392Z'
createdAt: '2026-08-10T04:19:11.392Z'
updatedAt: '2026-08-10T04:19:11.392Z'
---

## Context

Task nh6h0j resolved the provider gate for shared server/desktop basemap behavior. Google public Street/Hybrid tiles are used only while Internet is available; the approved OSM/OpenFreeMap Vector style is the offline package source.

## Decision

Keep Google Street/Hybrid sources marked online-only and baked-raster. Use the OSM/OpenFreeMap Vector style as the only offline-capable source. A valid desktop package must include the resolved MapLibre style, every style-referenced vector/raster tile source, glyphs, sprites, attribution metadata, checksum, and atomic coverage metadata, and must never include project data.

## Alternatives Considered

Continue storing Google public raster tiles offline; allow a Google raster package to be reused offline; or ship an OSM package without style-referenced assets.

## Consequences

Offline mode automatically renders OSM Vector and restores the selected Google mode when Internet returns. Google Street/Hybrid layer details remain baked into raster tiles and are not independently toggleable. Package download size includes style assets and source tiles.
