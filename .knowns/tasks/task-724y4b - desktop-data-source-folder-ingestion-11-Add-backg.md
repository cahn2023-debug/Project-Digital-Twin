---
id: 724y4b
title: "[desktop-data-source-folder-ingestion-11] Add background progress, cancellation and file isolation"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
createdAt: '2026-08-10T12:45:29.733Z'
updatedAt: '2026-08-10T14:47:32.651Z'
completedAt: '2026-08-10T14:46:16.621Z'
timeSpent: 603
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-3
  - AC-14
order: 110
---
# [desktop-data-source-folder-ingestion-11] Add background progress, cancellation and file isolation

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make scan/parse/import progress observable and cancellable, keep locked/permission failures per-file, and preserve independent source watchers and batch continuation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Background jobs expose source/file progress and queued/running/failed/cancelled states without blocking the main UI.
- [x] #2 Queued work can be cancelled safely and does not cancel unrelated files or sources.
- [x] #3 Locked or inaccessible files are not uploaded, retain retry/outbox state and do not stop other work.
- [x] #4 Watcher auto-start, debounce and multi-source isolation remain covered by focused tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Trace the Tauri job queue and SourceManagement polling path; define progress/cancellation state transitions compatible with existing imports.
2. Add cancellation checkpoints and per-file error classification for locked, permission and transient failures.
3. Expose progress/cancel state in source UI while preserving independent watcher and batch behavior.
4. Add focused Rust/TypeScript tests for cancellation, locked files, retry and multiple-source isolation.
5. Run desktop/web checks, validate the task and record compliance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: persisted per-job source/file identity, status, phase, progress, retry error and cancellation fields with migration-safe manifest columns; added list/update/cancel/checkpoint Tauri commands and source UI progress/cancel controls; worker checkpoints before parse/upload, classifies locked/permission/transient errors, keeps retry/outbox state and continues independent files; source failure jobs are source-scoped and readable retries resolve old failure jobs. Verification: cargo fmt, cargo test -p desktop-core = 37 passed, cargo check desktop passed; web typecheck/build passed; focused server pytest = 11 passed; Python compileall passed. System Decision Impact: candidate @decision/20260810-2145-desktop-ingestion-jobs-expose-per-file-progress-and-cancellation (added) — job progress/cancellation contract is draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
<!-- SECTION:NOTES:END -->

