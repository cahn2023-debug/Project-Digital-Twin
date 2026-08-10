---
id: 20260810-1047-explicitly-licensed-vector-provider-required-for-offline-basemap-packages
title: Explicitly licensed vector provider required for offline basemap packages
status: draft
supersedes: []
supersededBy: []
tags:
  - maplibre
  - offline
  - provider
  - licensing
  - basemap
sources:
  - 'https://developers.google.com/maps/documentation/tile/policies'
  - 'https://openfreemap.org/quick_start/'
  - 'https://openfreemap.org/tos/'
  - 'https://maplibre.org/maplibre-style-spec/sources/'
relatedDocs:
  - specs/2026-08-09/maplibre-basemap-for-design
  - specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
relatedTasks:
  - nh6h0j
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "nh6h0j" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T03:47:40.642Z'
createdAt: '2026-08-10T03:47:40.642Z'
updatedAt: '2026-08-10T03:47:40.642Z'
---

## Context

Task nh6h0j reviewed the current Google public raster source and the existing OpenFreeMap vector style for independent layer control and offline packaging.

## Decision

Treat Google public raster tiles as online display-only until a written provider agreement explicitly permits the required caching/offline use. Only enable independent basemap layer toggles and Vector offline packaging for a provider or self-hosted OSM/OpenMapTiles stack whose style, vector tile, glyph, sprite, attribution, and redistribution terms are explicitly documented.

## Alternatives Considered

Continue prefetching the current Google raster URL; use the OpenFreeMap public endpoint for automated regional downloads without written permission; or self-host an approved OSM/OpenMapTiles dataset and its style assets.

## Consequences

The current Google Street/Hybrid offline download path remains a blocker and must not be expanded. The manifest needs provider capability flags before any vector package implementation. A future approved provider may require domain/server/web schema changes and a separate implementation task.
