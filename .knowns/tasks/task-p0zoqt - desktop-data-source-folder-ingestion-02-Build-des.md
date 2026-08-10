---
id: p0zoqt
title: "[desktop-data-source-folder-ingestion-02] Build desktop add-source folder picker and source UI"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - desktop-ui
  - folder-picker
createdAt: '2026-08-10T01:50:21.717Z'
updatedAt: '2026-08-10T02:17:01.311Z'
completedAt: '2026-08-10T02:17:01.311Z'
timeSpent: 617
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
- [x] #1 Native folder picker rejects invalid paths and registers a selected directory against the active Project.
- [x] #2 UI lists multiple sources and exposes per-source scan, watcher, counts, progress and error states.
- [x] #3 Frontend typecheck/build and focused UI/API wiring checks pass.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Current HEAD contains the native folder-picker/source-management integration: per-project local manifest path, Tauri source API, Datacenter source list, register/scan/watcher controls, multiple-source status/count/error rendering and accessible actions.
Verification: web typecheck/build passed before the concurrent Design/MapLibre changes appeared; Tauri tests passed; targeted source diff check passed. Current workspace-wide web typecheck/build is blocked by unrelated pre-existing errors in apps/web/src/features/design/DesignView.tsx and mapConfig.ts (missing basemapModes/type narrowing), which were not changed by this task and are left for the active Design work.
Review: PASS for source UI/API scope, P1=0, P2=0, P3=0; delegated reviewer timed out and was closed, then manual four-perspective review completed.
System Decision Impact: none — task consumes the stable source-registration/watcher contract from @decision/20260810-0906-desktop-sources-use-stable-registrations-with-independent-watchers and adds no new durable guidance.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass
<!-- SECTION:NOTES:END -->

