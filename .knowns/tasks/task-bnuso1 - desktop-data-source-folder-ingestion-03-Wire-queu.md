---
id: bnuso1
title: "[desktop-data-source-folder-ingestion-03] Wire queued scans to parsers, Raw, ChangeSets and local-first persistence"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - import-worker
  - persistence
createdAt: '2026-08-10T01:50:21.755Z'
updatedAt: '2026-08-10T02:34:04.468Z'
completedAt: '2026-08-10T02:34:04.468Z'
timeSpent: 1000
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-4
  - AC-6
  - AC-7
  - AC-9
order: 30
---
# [desktop-data-source-folder-ingestion-03] Wire queued scans to parsers, Raw, ChangeSets and local-first persistence

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the missing FILE_SCAN processing path. Select the existing Excel/document parser, persist file version/Raw/source locators and file-specific ChangeSets in the local encrypted boundary, submit known Profiles automatically, and create durable pending sync jobs without writing canonical state before approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 FILE_SCAN jobs dispatch to the existing Excel/document parser boundary and register file version, Raw rows/assets and source locators locally.
- [x] #2 Known Profiles auto-submit; new/mismatched structures produce a durable preview/import state without canonical apply before approval.
- [x] #3 ChangeSets and pending sync jobs survive restart/offline and duplicate idempotency keys do not create duplicate imports.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend the desktop manifest boundary with idempotent file-scan preparation, local import/ChangeSet payload persistence, and Raw/source-locator records; add focused restart/duplicate tests.
2. Expose Tauri commands to prepare a scanned file version and store the local import result, then register them with the existing job IPC.
3. Add a server `file-imports/from-path` adapter using the existing Excel parser and preserve document-import idempotency; add endpoint/parser tests.
4. Implement a desktop import worker that claims `FILE_SCAN` jobs, dispatches Excel/document parsing, stores results locally, completes successful jobs, and retries failures with bounded backoff.
5. Start the worker from Datacenter source management and refresh source state after processed jobs.
6. Run focused Rust/Python/TypeScript checks, diff review, Knowns validation, and record AC/spec-decision compliance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan prepared in active kn-flow; execution continues without a separate approval gate because the approved spec flow is already authorized.
Done: FILE_SCAN now prepares immutable local file versions, dispatches source-aware Excel/document jobs through parser boundaries, persists ChangeSet/import payloads plus Raw/source locators transactionally, and completes jobs only after local persistence. Known-profile workbook imports create pending-approval ChangeSets; unmapped workbook structures return durable preview state. Document imports now use idempotency keys. Watcher timestamps use current epoch so debounce progresses after manual scan.

Verification: cargo fmt --all -- --check; cargo test -p desktop-core = 23 passed; cargo test -p project-digital-twin-desktop = 1 passed; cargo check -p project-digital-twin-desktop passed; server pytest = 50 passed; git diff --check passed. Web typecheck remains blocked by unrelated Design/MapLibre work in apps/web/src/features/design/DesignView.tsx and apps/web/src/features/design/offlineBasemap.ts (current workspace errors), not by the ingestion files.

Review: PASS, P1=0, P2=0. Delegated reviewer was closed after timeout; manual four-perspective review completed. No unrelated Design changes were altered.

System Decision Impact: candidate @decision/20260810-0932-desktop-file-scan-imports-persist-local-results-before-synchronization (added) — durable local-first FILE_SCAN/parser/Raw persistence and idempotent retry contract; draft review-gated.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass
<!-- SECTION:NOTES:END -->

