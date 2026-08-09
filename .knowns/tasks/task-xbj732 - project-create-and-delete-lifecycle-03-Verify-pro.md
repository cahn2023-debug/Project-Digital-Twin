---
id: xbj732
title: "[project-create-and-delete-lifecycle-03] Verify project lifecycle and root-directory safety"
status: done
priority: high
labels:
  - from-spec
  - spec:project-create-and-delete-lifecycle
  - spec-date:2026-08-09
createdAt: '2026-08-09T13:58:26.606Z'
updatedAt: '2026-08-09T14:26:55.587Z'
completedAt: '2026-08-09T14:25:49.663Z'
timeSpent: 152
assignee: '@me'
spec: specs/2026-08-09/project-create-and-delete-lifecycle
fulfills:
  - AC-7
  - AC-8
  - AC-9
  - AC-10
  - AC-11
order: 30
---
# [project-create-and-delete-lifecycle-03] Verify project lifecycle and root-directory safety

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run integrated lifecycle verification for API/UI behavior, tombstone data retention, root-directory immutability, duplicate-root rejection, failure handling, and create-new-project-from-preserved-root behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Integrated checks verify root directory paths, contents and file inventory remain unchanged.
- [x] #2 Integrated checks verify tombstone retention and create-new-project-from-preserved-root behavior.
- [x] #3 Repository validation and affected test/build commands are recorded with unresolved environment limits.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Run the backend lifecycle tests and full server suite with the repository `.venv`, including compileall; confirm duplicate-root rejection, archive/restore, tombstone retention, root-file snapshot preservation and new identity reuse from a deleted root.
2. Run the affected frontend/domain typecheck, production build and test commands; verify the project switcher contract is compiled against the backend response mapping.
3. Run Knowns task/spec validation and `git diff --check`; inspect the integrated diff for accidental filesystem operations, false-success paths, missing task/spec compliance markers and unrelated edits.
4. Record verification results and any environment-only limitations; do not weaken ACs or change implementation in this verification task.

### Plan check

- AC coverage: task AC-1 is covered by step 1; task AC-2 by steps 1 and 3; task AC-3 by steps 2 and 3.
- Scope: verification-only; no source edits expected unless a concrete verification failure requires returning to the owning task.
- Dependency: backend and UI tasks are done; this is the final integrated wave.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified: apps/server .venv pytest 25 passed (1 existing Starlette/httpx deprecation warning); server compileall passed; web typecheck passed; web production build passed with existing large-chunk warning; web test passed with 0 tests; @project/domain typecheck passed; git diff --check passed with repository line-ending warnings. Root-directory safety, duplicate-root rejection, tombstone retention and new identity reuse are covered by apps/server/tests/test_api.py. Review: integrated diff manually inspected; no P1/P2 findings. System Decision Impact: none — verification adds no new durable guidance and confirms the existing tombstone/root-safety decision candidate. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D10=pass, D11=pass, D12=pass
<!-- SECTION:NOTES:END -->

