---
id: p0zoqt
title: "[desktop-data-source-folder-ingestion-02] Build desktop add-source folder picker and source UI"
status: in-progress
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - desktop-ui
  - folder-picker
createdAt: '2026-08-10T01:50:21.717Z'
updatedAt: '2026-08-10T02:08:24.650Z'
timeSpent: 0
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-1
order: 20
---
# [desktop-data-source-folder-ingestion-02] Build desktop add-source folder picker and source UI

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the desktop/web source-management experience: native folder picker, source registration, multiple-source list, scan controls, progress/count/error states and independent watcher status. Wire it to the Tauri commands from task 01 and preserve existing project/tab UI boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Native folder picker rejects invalid paths and registers a selected directory against the active Project.
- [ ] #2 UI lists multiple sources and exposes per-source scan, watcher, counts, progress and error states.
- [ ] #3 Frontend typecheck/build and focused UI/API wiring checks pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add a Tauri `get_local_manifest_path` command that resolves a safe per-project manifest location under the app-local data directory, creates its parent directory, and expose the command through the existing command registry.
2. Add a small web-side source API boundary using `@tauri-apps/api/core` and the existing dialog plugin: resolve manifest path, list/register sources, scan a source, and start/stop its watcher. Keep browser mode explicit with a usable unsupported/native-picker error.
3. Add a Datacenter source-management component/state that loads sources for the active Project, opens the native folder picker, registers a selected folder, starts its watcher, supports per-source manual scan and watcher toggle, and renders queued counts, status and errors.
4. Wire the component into `DatacenterView`/AppShell without disturbing existing canonical dataset panels; add focused styles and accessible labels for source rows/actions.
5. Add `@tauri-apps/api` to the web workspace importer, run lockfile/typecheck/build and Tauri compile/tests, validate the task and `git diff --check`.

### Plan check

- AC coverage: AC-1 → steps 1–4; task UI/wiring ACs → steps 2–5.
- Scope: web UI + Tauri path helper + one workspace dependency; no parser or database contract rewrite.
- Dependency: task 01 commands are available; task 03 consumes the source state but does not need to change this UI.
- Risk: browser-vs-Tauri runtime and manifest path safety; explicit runtime guard, app-local path resolution and type/build checks cover the risk.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass.
<!-- SECTION:PLAN:END -->

