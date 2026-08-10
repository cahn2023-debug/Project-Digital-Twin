---
id: 0yuitq
title: Tạo cấu trúc 5 tab và Main-core cho Project Digital Twin
status: done
priority: medium
labels:
  - normal
  - architecture
  - module-boundaries
  - maintainability
createdAt: '2026-08-10T01:37:26.402Z'
updatedAt: '2026-08-10T02:00:54.259Z'
completedAt: '2026-08-10T02:00:54.259Z'
timeSpent: 1253
assignee: '@me'
---
# Tạo cấu trúc 5 tab và Main-core cho Project Digital Twin

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tổ chức code theo năm tab DATACENTER, DESIGN, OPERATE, ORGANIZE và DASHBOARD; đưa code app composition, dependency wiring, project context, navigation và runtime command registration vào vùng Main-core theo từng runtime. Giữ nguyên REST/API, database contract, runtime behavior và các invariant ADR-001 đến ADR-008.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Five product-tab boundaries remain canonical across server modules, web features and domain contracts without duplicate top-level tab folders.
- [x] #2 Runtime-local Main-core namespaces exist for server, web and Tauri composition using the import-safe name main_core.
- [x] #3 main.py, App.tsx and Tauri lib.rs become thin bootstrap/compatibility entrypoints while existing REST routes, payloads and command names remain unchanged.
- [x] #4 Routers and features follow the dependency direction and no feature imports another feature's private implementation.
- [x] #5 CameraStore compatibility, project isolation, provenance, revision, ChangeSet, audit, outbox, dashboard read-only behavior and file-write safety remain intact.
- [x] #6 All workspace typecheck, build, test, Rust checks, diff validation and Knowns validation pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Freeze the current contract and ownership baseline.
   - Inventory the existing five-tab paths, orchestration entrypoints, compatibility facades and router imports.
   - Record REST routes, request/response schemas and runtime command names before editing.
   - Use completed task kxz78p as the structural baseline; do not create duplicate top-level tab folders.

2. Establish the Main-core convention and boundary.
   - Create runtime-local orchestration namespaces: apps/server/app/main_core, apps/web/src/main_core and apps/desktop/src-tauri/src/main_core.
   - Use main_core as the import-safe source name for the requested Main-core area; document the product-facing name as Main-core.
   - Update docs/architecture/CURRENT_ARCHITECTURE.md, TARGET_ARCHITECTURE_V1.md and MODULE_BOUNDARIES.md with ownership and dependency rules.
   - Main-core may compose modules, but must not own domain rules, persistence implementation, auth implementation or physical file writes.

3. Extract server application composition.
   - Move app factory, dependency wiring, router registration and request-context coordination out of apps/server/app/main.py into main_core/app_factory.py, dependencies.py, router_registry.py and request_context.py.
   - Keep auth, observability and persistence implementations in platform/shared; keep CameraStore as the compatibility facade.
   - Leave main.py as a thin compatibility/bootstrap entrypoint and preserve health, metrics, middleware behavior and REST paths.

4. Migrate project, DATACENTER and DESIGN server routers.
   - Replace direct router imports of main.store and main helpers with Main-core dependency/provider ports.
   - Keep project lifecycle in modules/project, import/mapping/source concerns in modules/datacenter and geometry/revision concerns in modules/design.
   - Add import-boundary and endpoint contract tests before removing each compatibility path.

5. Migrate OPERATE, ORGANIZE and DASHBOARD server routers.
   - Apply the same provider boundary to field package, observation, sync, conflict, group/tag, lifecycle, write-back and projection routes.
   - Keep ORGANIZE write-back orchestration behind file-adapter interfaces and keep DASHBOARD read-only.
   - Verify project isolation, provenance, revision, ChangeSet, audit and outbox behavior remains unchanged.

6. Extract web Main-core shell coordination.
   - Move shell state, project context/switching, navigation selection, global search, theme and toast coordination from apps/web/src/App.tsx into AppShell.tsx, ProjectContext.tsx, navigation.ts and notifications.ts.
   - Keep project-lifecycle API/dialog implementation under features/project-lifecycle and tab views under features/{datacenter,design,operate,organize,dashboard}.
   - Leave App.tsx as a compatibility entrypoint and prevent feature-to-feature private imports.

7. Extract desktop runtime coordination.
   - Move Tauri command registration, runtime state wiring and startup composition from apps/desktop/src-tauri/src/lib.rs into main_core.
   - Keep scan, jobs, mutation, replay, conflict, auth and encrypted-database implementations in their capability modules; keep crates/desktop-core as a compatibility barrel.
   - Preserve SQLite schema, retry/idempotency, watcher debounce, self-write suppression, safe replace and offline sync behavior.

8. Verify, document and hand off.
   - Add or update module-boundary, REST contract, project isolation, dashboard read-only and compatibility-facade tests.
   - Run corepack pnpm typecheck, corepack pnpm test, corepack pnpm build, uv run pytest, cargo fmt --all -- --check, cargo check --workspace, cargo test --workspace, git diff --check and knowns validate.
   - Confirm no database migration, public endpoint, payload, ADR-001..ADR-008 invariant or runtime behavior changed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: created apps/server/app/main_core/{app_factory,dependencies,request_context,router_registry}.py; main.py is now a compatibility/bootstrap entrypoint and all six feature routers use Main-core dependency providers instead of importing app.main. Server verification: uv run pytest 43 passed; existing Starlette/httpx deprecation warning remains.
Done: extracted web shell/project context/navigation/notifications into apps/web/src/main_core and kept App.tsx plus feature navigation config as compatibility entrypoints. Extracted Tauri runtime composition into apps/desktop/src-tauri/src/main_core; command implementations and public command names remain unchanged. Updated CURRENT_ARCHITECTURE.md, TARGET_ARCHITECTURE_V1.md and MODULE_BOUNDARIES.md. Verification so far: uv run pytest 44 passed, corepack pnpm typecheck passed, cargo check --workspace passed.
Completed: all five tab boundaries remain canonical without duplicate top-level folders; runtime-local main_core namespaces exist for server, web and Tauri; main.py, App.tsx and Tauri lib.rs are thin compatibility/bootstrap entrypoints; router/feature dependency boundaries are enforced; CameraStore, project isolation, provenance, revisions, ChangeSets, audit/outbox, dashboard read-only and file-write behavior remain covered. Added a local binding in crates/desktop-core/src/manifest.rs::list_sources to satisfy the Rust borrow checker without changing behavior while verifying the existing overlapping desktop source-ingestion work. Verification: corepack pnpm typecheck passed; corepack pnpm test passed; corepack pnpm build passed with existing 1.2 MB bundle-size warning; uv run pytest 44 passed with existing Starlette/httpx deprecation warning; cargo fmt --all -- --check passed; cargo check --workspace passed; cargo test --workspace 21 passed; git diff --check passed; knowns validate task passed. System Decision Impact: candidate @decision/20260810-0859-runtime-local-main-core-composition-boundary (added) — records runtime-local main_core composition boundary and import-safe naming; reviewState=needs_evidence because local architecture docs are not Knowns-managed. Spec Decision Compliance: no linked spec; ADR-001..ADR-008 and adjacent locked decisions remain unchanged with no conflict.
<!-- SECTION:NOTES:END -->
