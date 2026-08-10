# Current Architecture

**Project:** Project Digital Twin
**Updated:** 2026-08-09
**Reference:** [Target Architecture v1](TARGET_ARCHITECTURE_V1.md)

## Runtime inventory

| Runtime | Current boundary | Notes |
| --- | --- | --- |
| Web | `apps/web` React/Vite application | `App.tsx` owns the shell; tab views are under `features/`; shared API/UI/config are extracted. |
| Server | `apps/server/app` FastAPI application | `main.py` owns setup and router registration; REST handlers are grouped under `modules/*/router.py`. |
| Desktop shell | `apps/desktop` TypeScript Tauri bridge | Local-file and job commands are exported through feature files. |
| Desktop core | `crates/desktop-core` Rust library | Manifest, scanner, queue contract, hashing and safe-write are separate modules; queue operations still execute transactionally through `ManifestDb`. |
| Shared contracts | `packages/domain` | Context-specific files are re-exported through `src/index.ts` for compatibility. |
| Canonical storage | `migrations`, server persistence adapter | PostgreSQL/PostGIS is the target; the transitional runtime snapshot adapter remains in use. |

## Feature ownership

- `DATACENTER`: source registry, workbook/document import, mapping, Raw/source locators, file versions, import ChangeSets, audit and data quality.
- `DESIGN`: geometry edits, design revisions, map basemap/layer behavior and comparison.
- `OPERATE`: field packages, observations, sync cursor, retry and conflict behavior.
- `ORGANIZE`: groups, tags, memberships, lifecycle, contractor/work-package setup and write-back orchestration.
- `DASHBOARD`: read-only projections, KPIs, forecast and alerts.
- `project-lifecycle`: project creation, active-project selection, archive and tombstone behavior.

## Transitional boundaries

`apps/server/app/domain.py` is still the compatibility façade and contains the `CameraStore` implementation. Domain dataclasses, shared errors, normalization, route handlers and file adapters have been extracted into context namespaces, but the store internals still share one in-memory state model. This is intentional until relational persistence is decomposed safely.

The public REST paths and response shapes remain unchanged. New code should import context contracts from their smallest module and use the root barrels only for compatibility.

## Verification baseline

- `uv run pytest`: 41 passed.
- `corepack pnpm typecheck`: passed.
- `corepack pnpm test`: passed.
- `cargo check --workspace`: passed.
- `cargo test --workspace`: 10 desktop-core tests passed.

The remaining architecture work is to split `CameraStore` into application services/repository ports, move project dialogs out of the web shell, and decompose the transitional persistence snapshot by context without changing the public contract.
