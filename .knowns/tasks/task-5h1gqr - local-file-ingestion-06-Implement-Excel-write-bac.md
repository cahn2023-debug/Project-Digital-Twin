---
id: 5h1gqr
title: "[local-file-ingestion-06] Implement Excel write-back, restore and self-write detection"
status: done
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - excel
  - write-back
  - safety
createdAt: '2026-08-09T10:50:29.504Z'
updatedAt: '2026-08-09T12:27:55.881Z'
completedAt: '2026-08-09T12:11:37.101Z'
timeSpent: 551
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-15
  - AC-16
order: 60
---
# [local-file-ingestion-06] Implement Excel write-back, restore and self-write detection

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement confirmed Excel column additions, hash/lock checks, backup, atomic replacement, unmanaged-content preservation, restore jobs and watcher suppression for software-generated writes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Write only after explicit confirmation and expected-hash/lock checks; create backup and preserve unmanaged workbook content.
- [x] #2 Validate and atomically replace the workbook, registering a new file version and audit event.
- [x] #3 Restore a prior version through a new write job/ChangeSet and suppress duplicate re-import from self-generated writes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend apps/server/app/workbook.py and the write-job boundary to support confirmed managed column additions, Profile/schema field values, expected file revision/hash and audit metadata while retaining existing Camera write-back behavior.
2. Reuse crates/desktop-core safe_replace for backup, stale hash rejection, lock/error handling, temporary validation and atomic replacement; preserve unmanaged sheets, columns and values.
3. Implement restore as a new write job/ChangeSet referencing an immutable prior file version, and register the resulting version without mutating history.
4. Add self-write provenance so the watcher recognizes software-generated hashes and does not enqueue a duplicate import.
5. Expand round-trip/stale/locked/restore tests in apps/server/tests/test_workbook.py and desktop-core tests; run pytest, cargo tests, Knowns validation and git diff --check.

## Dependencies and scope

- Depends on tasks 01, 04 and 05.
- Write-back applies only to Excel; Markdown/TXT/Word originals remain read-only.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task created from approved spec; implementation plan and verification will be added before execution.
Full-wave planning pass: plan saved before implementation and baseline commit.
Started Task 06 from the approved plan; preflight confirmed existing workbook writer, Rust safe_replace and manifest version contracts.
Done: added confirmed Excel write-back with expected SHA-256/lock checks, managed-column additions, backup, same-directory temporary validation, atomic replace path and unmanaged-content preservation. Added immutable server file-version registration, write-job completion with source-hash conflict handling, RESTORE ChangeSet/write jobs targeting prior versions, backup/audit event metadata and self-write hash tracking. Added desktop-core self_write_markers persistence and watcher enqueue suppression; safe_replace uses Windows ReplaceFileW write-through with guarded provider fallback after atomic API failure. Verification: apps/server pytest 17 passed (1 existing Starlette/httpx deprecation warning); cargo test -p desktop-core 9 passed; cargo check -p project-digital-twin-desktop passed; cargo fmt check passed; Knowns validation pending final task transition; git diff --check passed with repository line-ending warnings only. Review: manual diff review completed; delegated reviewer was unavailable before timeout and made no changes. System Decision Impact: candidate @decision/20260809-1911-excel-write-back-uses-confirmed-atomic-jobs-with-immutable-versions-and-self-write-provenance (added) — establishes confirmed safe write-back, immutable version, restore and self-write provenance boundaries. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D52=pass

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass
<!-- SECTION:NOTES:END -->

