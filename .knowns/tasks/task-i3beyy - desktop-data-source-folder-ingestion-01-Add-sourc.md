---
id: i3beyy
title: "[desktop-data-source-folder-ingestion-01] Add source registry and multi-source watcher persistence"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - desktop-core
  - watcher
createdAt: '2026-08-10T01:50:21.679Z'
updatedAt: '2026-08-10T02:06:24.218Z'
completedAt: '2026-08-10T02:06:24.218Z'
timeSpent: 920
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-2
  - AC-3
  - AC-11
order: 10
---
# [desktop-data-source-folder-ingestion-01] Add source registry and multi-source watcher persistence

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close the desktop-core/Tauri gap for registering multiple Project source directories, persisting source state locally, scanning recursively, and running independent manual/watcher scans. Reuse existing file identity/version, hash, debounce, queue and self-write primitives; do not reimplement prior ingestion contracts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Source registration persists normalized directory identity, active state and independent watcher configuration for multiple sources.
- [x] #2 Manual and watcher scans recurse only supported extensions, skip hidden/temp files, debounce unstable files and preserve existing hash/idempotency/self-write behavior.
- [x] #3 Rust and desktop-core tests cover multiple sources, duplicate registration, scan failures, restart persistence and independent watcher state.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend the desktop-core manifest schema and `ManifestDb` with normalized Project source registrations: stable source ID, directory path, active state, watcher/debounce configuration and last scan metadata. Reject duplicate registrations without losing existing file/version/Raw records.
2. Update the recursive scanner to ignore hidden/temp entries and carry source identity through observations and FILE_SCAN idempotency keys while preserving SHA-256, stable-file debounce, failure recording and self-write suppression.
3. Replace the single Tauri watcher slot with independently controllable watcher state keyed by source ID; add register/list/scan/start/stop commands and register them in `apps/desktop/src-tauri/src/lib.rs`.
4. Expose the new source-management invoke wrappers in `apps/desktop/src/features/local-files.ts` and keep current scan/watcher APIs backward-compatible where existing callers depend on them.
5. Add focused Rust/desktop-core tests for multiple source registrations, duplicate paths, recursive filtering, scan failures, restart persistence and independent watcher lifecycle; run cargo format/check/test, desktop typecheck, Knowns validation and `git diff --check`.

### Plan check

- AC coverage: AC-2 → steps 1–2; AC-3 → steps 1–2 and tests; AC-11 → steps 3–5.
- Scope: bounded desktop-core/Tauri/IPC change; no new dependency, parser rewrite or UI work.
- Dependency: task 01 is the first runnable wave; tasks 02–05 depend on its source command contract.
- Risk: watcher concurrency and migration compatibility; covered by keyed state tests, idempotent schema initialization and restart tests.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Added persistent source_registrations with project-scoped stable IDs, normalized directory registration, watcher state and source scan metadata; added source-aware FILE_SCAN JSON payload/idempotency keys. Added recursive hidden/temp filtering, source registration/list/scan/start/stop Tauri commands, keyed independent watcher flags, and TypeScript IPC wrappers while preserving legacy commands.
Verification: cargo fmt --all; cargo test -p desktop-core = 21 passed; cargo test -p project-digital-twin-desktop = 1 passed; cargo check -p project-digital-twin-desktop passed; corepack pnpm --filter @project/desktop typecheck passed; targeted git diff --check passed with only CRLF normalization warnings.
Review: PASS, P1=0, P2=0, P3=0. Manual four-perspective review completed after delegated reviewer timed out; no blocking findings.
System Decision Impact: candidate @decision/20260810-0906-desktop-sources-use-stable-registrations-with-independent-watchers (added) — stable project-scoped source registration and independent watcher contract; draft review-gated.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass
<!-- SECTION:NOTES:END -->

