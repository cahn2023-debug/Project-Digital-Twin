---
id: 1xqatp
title: "[serverdesktop-shared-maplibre-01] Define shared basemap manifest and server endpoint"
status: in-progress
priority: high
labels:
  - from-spec
  - spec:serverdesktop-shared-maplibre-basemap-manifest
  - spec-date:2026-08-10
  - server
  - manifest
  - contract
createdAt: '2026-08-10T02:05:33.057Z'
updatedAt: '2026-08-10T02:12:34.267Z'
timeSpent: 0
assignee: '@me'
spec: specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
fulfills:
  - AC-1
order: 10
---
# [serverdesktop-shared-maplibre-01] Define shared basemap manifest and server endpoint

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the display-only MapLibre manifest contract and expose the server endpoint used by web and desktop, including schema/version metadata, basemap modes, tile/style sources, layer groups, attribution, package capabilities, validation, and conditional response metadata.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Define a versioned display-only manifest schema shared by server and clients.
- [x] #2 Expose the manifest with conditional response metadata and reject invalid contracts.
- [x] #3 Add server contract tests proving no project entity data is present.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add the display-only basemap manifest types to `packages/domain/src/design.ts` and mirror the validated JSON contract with Pydantic models/fixtures in `apps/server/app/shared/schemas.py`; include schema/manifest versions, Street/Hybrid/Vector sources, layer groups, attribution, and tile-package capability metadata.
2. Add a server-owned manifest provider and `GET /api/v1/basemap/manifest` in the design module. Preserve the existing production authentication middleware, avoid project-scoped data/authorization, emit stable ETag/Last-Modified metadata, return 304 when the conditional request matches, and reject invalid manifest construction.
3. Add focused server contract tests in `apps/server/tests/test_basemap_manifest.py` for schema shape, all three modes/layer groups, no project entity payload, 200/304 conditional behavior, and validation failure handling.
4. Run server pytest plus domain typecheck/build/test, Knowns task validation, and `git diff --check`.

## Scope and assumptions

- The manifest is a display contract only; it must not include project entities or project-specific tile data.
- Existing `mapConfig.ts` remains the client fallback until task 02 consumes the endpoint.
- The endpoint follows the current API authentication middleware in production; no new project authorization boundary is introduced.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: added shared TypeScript/Pydantic display-only manifest contract, server-owned /api/v1/basemap/manifest endpoint with ETag/Last-Modified and 304 behavior, static Street/Hybrid/Vector/layer/package metadata, and contract tests proving no project entity payload. Review fix: added layer excludePrefixes to prevent administrative/place-label overlap and ISO timestamp validation. Verification: server manifest pytest 3 passed (1 existing Starlette/httpx deprecation warning); @project/domain typecheck/build/test passed; diff check clean aside line-ending warnings.
<!-- SECTION:NOTES:END -->

