---
id: aobrj5
title: "[desktop-data-source-folder-ingestion-04] Add ingestion preview, mapping and error status flow"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
  - preview
  - mapping
  - validation
createdAt: '2026-08-10T01:50:21.791Z'
updatedAt: '2026-08-10T02:43:06.875Z'
completedAt: '2026-08-10T02:43:06.875Z'
timeSpent: 468
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-5
  - AC-8
order: 40
---
# [desktop-data-source-folder-ingestion-04] Add ingestion preview, mapping and error status flow

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose unknown/mismatched structures through preview and mapping, allow Profile confirmation, and surface per-file/row/field validation results while continuing independent valid work. Connect preview/status data to the source UI and preserve Raw for unmapped, invalid and skipped values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Preview exposes candidate regions/headers and mapping confirmation creates an immutable Profile version.
- [x] #2 Validation results identify source/file/row/field and allow valid rows to proceed while preserving invalid/unmapped/skipped Raw.
- [x] #3 Source UI renders per-file status and error details without blocking independent files.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend the local manifest/Tauri boundary with listable import records and immutable profile-version persistence.
2. Extend the Excel from-path contract to accept an explicit profile mapping and create a ChangeSet only after mapping confirmation.
3. Add worker helpers to load preview records and confirm/persist a mapped import using the same file version and idempotency boundary.
4. Render per-file preview, headers/rows, validation issues and a small code/name mapping form in Datacenter, keeping files independent.
5. Add focused Rust/server tests, run package checks, review the diff, validate the task, and record D1-D7/System Decision compliance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: local manifest/Tauri now lists import results and stores immutable (profile_id, version) profile records. Workbook preview exposes candidate regions, headers, rows and issues; confirmed code/name mapping is sent to the parser boundary, saved locally, and replaces the preview record with a pending-approval ChangeSet while preserving Raw evidence. Datacenter renders per-file status, preview data, row/field validation issues and independent mapping controls; parser failures persist file-level FAILED details and retry independently.

Verification: cargo fmt --all; cargo test -p desktop-core = 23 passed; cargo test -p project-digital-twin-desktop = 1 passed; cargo check -p project-digital-twin-desktop passed; server pytest = 53 passed; web typecheck and production build passed; scoped git diff --check passed. Build emitted only the existing chunk-size warning.

Review: PASS, P1=0, P2=0. Manual four-perspective review found no blocking issue; profile remains local-first and canonical state still waits for ChangeSet approval.

System Decision Impact: candidate @decision/20260810-0942-desktop-source-preview-mapping-creates-immutable-local-profile-versions (added) — immutable local profile confirmation and preview-to-ChangeSet contract; draft review-gated.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass
<!-- SECTION:NOTES:END -->

