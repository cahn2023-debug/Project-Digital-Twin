---
id: 20260810-0017-organize-project-digital-twin-code-by-product-tab-boundaries
title: Organize Project Digital Twin code by product tab boundaries
status: draft
supersedes: []
supersededBy: []
tags:
  - architecture
  - module-boundaries
  - maintainability
sources:
  - '@doc/specs/2026-08-09/phase-0b-architecture-decision-records'
  - '@doc/specs/2026-08-09/organize-data-classification-grouping-and-source-management'
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
relatedDocs:
  - docs/architecture/TARGET_ARCHITECTURE_V1.md
  - docs/architecture/MODULE_BOUNDARIES.md
relatedTasks:
  - kxz78p
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'related doc "docs/architecture/TARGET_ARCHITECTURE_V1" is not readable: doc "docs/architecture/TARGET_ARCHITECTURE_V1" not found'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T17:17:05.483Z'
createdAt: '2026-08-09T17:17:05.483Z'
updatedAt: '2026-08-09T17:17:05.483Z'
---

## Context


## Decision

Keep one deployable web app, FastAPI service and desktop client, but organize source by the five product surfaces DATACENTER, DESIGN, OPERATE, ORGANIZE and DASHBOARD. Shared identity/revision/provenance/audit/outbox contracts live in shared/platform modules; feature modules communicate through public contracts and ports; compatibility barrels and CameraStore remain during incremental migration; DASHBOARD is read-only and ORGANIZE orchestrates but does not directly perform filesystem writes.

## Alternatives Considered

Keep monolithic domain/UI files; split into microservices; organize only by technical layer.

## Consequences

Future changes should target the owning feature module and preserve existing REST/database contracts and ADR-001 through ADR-008 invariants. Transitional façades may be removed only after callers migrate and persistence is verified.
