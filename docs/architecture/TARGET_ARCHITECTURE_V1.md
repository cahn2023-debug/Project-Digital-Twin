# Target Architecture v1

## Purpose

This document defines the maintainable module layout for the Camera Vertical Slice and the five product tabs. It keeps one deployable web app, one FastAPI service and one desktop client; it does not introduce microservices.

## Module layout

```text
apps/server/app/
  main.py
  shared/                  # clock, normalization, errors, event/audit contracts
  platform/                # auth, observability, persistence
  modules/
    project/
    datacenter/
    design/
    operate/
    organize/
    dashboard/
  adapters/                # repositories, importers, writers

apps/web/src/
  App.tsx                  # shell and project context
  shared/                  # API, UI primitives, common types
  features/                # one directory per product capability

packages/domain/src/
  core.ts project.ts datacenter.ts design.ts operate.ts organize.ts dashboard.ts
  index.ts                  # compatibility barrel

crates/desktop-core/src/
  lib.rs hash.rs safe_write.rs manifest/scanner/queue boundaries
```

## Dependency direction

```text
UI feature → feature API client → FastAPI router → application service
           → domain contract → repository/adapter → persistence/filesystem
```

Feature modules may depend on shared contracts and platform ports. They must not import another feature's private implementation. `DASHBOARD` is read-only and consumes projections. `ORGANIZE` can request write-back, but only a file adapter performs physical writes.

## Runtime invariants

The module split does not change ADR-001 through ADR-008: immutable entity identity, immutable file versions, explicit ChangeSets, append-only revisions, deterministic sync, transactional outbox, explicit geometry conflicts and retention classifications remain binding.

## Migration policy

Refactoring is incremental. Compatibility barrels, `CameraStore` and existing REST routes remain until all callers move to the new boundaries. Database migrations remain forward-only; the existing migration is not rewritten merely to mirror source folders. Relational decomposition follows the same context order as the code modules.
