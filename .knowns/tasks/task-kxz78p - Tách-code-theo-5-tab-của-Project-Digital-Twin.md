---
id: kxz78p
title: Tách code theo 5 tab của Project Digital Twin
status: done
priority: high
labels:
  - architecture
  - refactor
  - maintainability
  - module-boundaries
createdAt: '2026-08-09T16:54:25.748Z'
updatedAt: '2026-08-09T17:24:31.101Z'
completedAt: '2026-08-09T17:24:31.101Z'
timeSpent: 1725
assignee: '@me'
---
# Tách code theo 5 tab của Project Digital Twin

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor cấu trúc code theo DATACENTER, DESIGN, OPERATE, ORGANIZE và DASHBOARD; tách shared kernel, backend modules, frontend features và desktop runtime trong khi giữ nguyên REST/API/database behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Existing REST routes and response contracts remain unchanged.
- [x] #2 packages/domain retains backward-compatible root exports after context split.
- [x] #3 Backend code is organized by project/datacenter/design/operate/organize/dashboard with shared platform/adapters separated.
- [x] #4 Frontend App.tsx becomes shell-oriented and tab views live under features.
- [x] #5 Desktop core is split into manifest/scanner/queue/hash/safe-write modules with existing tests preserved.
- [x] #6 Architecture docs reflect the implemented module boundaries.
- [x] #7 pnpm checks, server tests, Rust checks/tests, and Knowns validation pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Freeze current contracts and update architecture docs to match implemented code.
Split shared TypeScript domain contracts by context while preserving the root barrel exports.
Split backend responsibilities into feature modules with compatibility facades and unchanged REST behavior.
Split frontend shell/features and desktop Rust capabilities without behavior changes.
Verify all runtimes, add module-boundary coverage, and validate the Knowns task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation: task created from approved user plan; preserving REST, database and runtime behavior while extracting boundaries incrementally.
Checkpoint: extracted FastAPI feature routers with unchanged REST paths; split shared Python contracts/errors/normalization and preserved domain.py compatibility exports; split TypeScript domain contracts, web tab views/shared UI/API/config, and Tauri/Rust scan/jobs/hash/safe-write boundaries. Verification so far: uv run pytest 43 passed; domain/web/desktop typecheck passed; cargo fmt/check/test passed. Remaining: full workspace verification, final docs/diff cleanup, and task validation.
Completed: REST paths/response behavior preserved; shared TypeScript and Python context contracts extracted with compatibility barrels/facades; FastAPI routers grouped by product surface; web tabs/shared UI/API/config extracted; desktop Tauri commands and Rust hash/safe-write boundaries extracted; architecture docs updated and module boundary tests added. Verification: corepack pnpm typecheck passed; corepack pnpm test passed; corepack pnpm build passed with existing bundle-size warning; uv run pytest 43 passed with one existing Starlette/httpx deprecation warning; cargo fmt --check, cargo check --workspace, cargo test --workspace passed; git diff --check passed. System Decision Impact: candidate @decision/20260810-0017-organize-project-digital-twin-code-by-product-tab-boundaries added (architecture guidance; draft reviewState=needs_evidence because local architecture docs are not Knowns-managed entities). Spec Decision Compliance: Phase 0B D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass.
Reopened for completion audit: the initial implementation passed all checks, but the target layout still needs explicit desktop manifest/scanner/queue files and server file-adapter namespaces. Continuing without changing public behavior.
Final completion wave: extracted server file adapters under adapters/files/importers and adapters/files/writers with compatibility wrappers; moved project dialogs into features/project-lifecycle; split desktop-core ManifestDb/scanner/queue/hash/safe-write modules. Final verification remains green: pnpm typecheck/test/build, uv run pytest 43 passed, cargo fmt/check/test, git diff --check. Existing warnings: web bundle >500KB and Starlette/httpx deprecation only.
<!-- SECTION:NOTES:END -->

