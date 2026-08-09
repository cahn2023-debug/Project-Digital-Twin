# Target Architecture v1

## Purpose

This document translates the accepted ADR contracts into the first executable platform baseline. It is binding for the Camera Vertical Slice and intentionally leaves vendor-specific choices replaceable behind the interfaces.

## Runtime boundaries

The server owns canonical projects, entities, immutable revisions, ChangeSets, approvals, audit records, and the transactional outbox. The desktop owns scoped filesystem access, managed workbook jobs, local SQLite projections, and offline queues. The web client communicates with the server over versioned HTTPS APIs. Map views consume canonical or cached projections, never raw workbook rows.

The first implementation uses React/Vite, Tauri 2/Rust, FastAPI/Python, PostgreSQL/PostGIS, and SQLite. These are replaceable implementation choices; the contracts in `docs/adr/` remain authoritative.

## Camera data flow

```text
Managed Camera Workbook
  -> desktop file registry and hash
  -> profile parser and provenance
  -> validated import result
  -> Project/Entity/Revision records
  -> map projection and ChangeSet
  -> assignment and FieldPackage
  -> offline observation and sync
  -> approval and AS_BUILT revision
  -> desktop write-back job
  -> dashboard projection
```

## Initial modules

| Module | Responsibility |
| --- | --- |
| `packages/domain` | Shared IDs, revisions, provenance, import, and API contract types |
| `apps/server/app` | FastAPI transport, canonical service boundary, Camera import/geometry behavior |
| `migrations` | Versioned PostgreSQL/PostGIS schema |
| `crates/desktop-core` | Hashing and rebuildable local manifest primitives |
| `apps/desktop/src-tauri` | Tauri command boundary and filesystem permission scope |
| `apps/web` | DATACENTER/DESIGN shell for the first slice |

## Gap closure

The repository audit found no reusable application code. The baseline therefore creates a narrow foundation rather than introducing generic workflow, event-broker, graph, or AI infrastructure. Assignment, field operation, sync, approval, write-back, and dashboard modules are sequenced behind the typed identity/revision/import contracts.

