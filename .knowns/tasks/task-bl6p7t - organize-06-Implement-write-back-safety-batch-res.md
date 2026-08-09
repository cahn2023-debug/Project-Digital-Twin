---
id: bl6p7t
title: "[organize-06] Implement write-back safety batch restore and self-write handling"
status: done
priority: high
labels:
  - from-spec
  - spec:organize-data-classification-grouping-and-source-management
  - spec-date:2026-08-09
  - write-back
  - safety
  - restore
  - sync
createdAt: '2026-08-09T14:22:01.982Z'
updatedAt: '2026-08-09T15:26:38.390Z'
completedAt: '2026-08-09T15:24:01.276Z'
timeSpent: 379
assignee: '@me'
spec: specs/2026-08-09/organize-data-classification-grouping-and-source-management
fulfills:
  - AC-8
  - AC-9
  - AC-10
  - AC-11
order: 60
---
# [organize-06] Implement write-back safety batch restore and self-write handling

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Execute confirmed write-back for all supported formats with editor authorization, in-place/new-file choice, per-file or all-or-nothing batch strategy, stale/lock/conflict blocking, backup/version/restore, audit and self-write suppression.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enforce editor authorization, explicit confirmation, stale/lock/conflict checks and selected destination mode.
- [x] #2 Implement per-file or all-or-nothing batch execution with backup/version/audit and restore as a new job/version.
- [x] #3 Integrate self-write provenance so watcher does not enqueue duplicate imports; add failure/rollback tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend write-back job state with preview-plan linkage, destination mode/path, confirmation, batch strategy and project-scoped file locks.
2. Add an editor-only Organize execute endpoint that confirms a valid preview, rechecks revision/hash/source evidence and queues per-file jobs with PER_FILE or ALL_OR_NOTHING preflight semantics.
3. Harden completion/restore with lock release, backup/version requirements, stale/conflict blocking, immutable version registration and audit/self-write provenance.
4. Suppress watcher/import re-enqueue for hashes produced by Organize write-back and add failure/rollback helpers without mutating canonical history.
5. Add API tests for authorization, confirmation, stale/lock/conflict blocking, batch behavior, backup/version/restore and self-write suppression; run full server verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Added editor-only Organize write-back execute endpoint with explicit confirmation, plan status gate, current revision/hash/source recheck, project file ownership and active lock validation.
Done: Added safety-enforced per-file jobs carrying plan/destination/batch metadata; ALL_OR_NOTHING preflight creates no jobs when any file is stale/locked/conflicted.
Done: Completion requires in-place backup, registers immutable result version, releases locks, updates plan status and records audit/self-write provenance; restore now creates a safety-enforced RESTORE job/ChangeSet and self-write hashes suppress duplicate imports.
Done: Added failure endpoint with lock release and batch failure handling, plus API coverage for authorization, confirmation, stale/lock blocking, completion, backup/version, restore and self-write suppression.
Verification: uv run pytest -q = 36 passed, 1 warning; Python compileall passed; Knowns validation = 0 errors, 0 warnings; targeted git diff --check passed. Repository-wide diff check still reports pre-existing trailing whitespace in an unrelated .knowns task document.
Review: PASS, P1=0, P2=0. Production repository/worker replacement remains outside this in-memory implementation task.
System Decision Impact: candidate @decision/20260809-2223-organize-execution-queues-confirmed-plans-with-rechecked-locks-versions-backup-and-self-write-provenance (added) — defines confirmed execution, lock/version/backup, restore and self-write boundaries.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass.
SDD verification marker normalization: Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Spec Decision Compliance: D18=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
<!-- SECTION:NOTES:END -->

