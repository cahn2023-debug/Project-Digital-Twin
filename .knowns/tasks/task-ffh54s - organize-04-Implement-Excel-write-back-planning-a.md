---
id: ffh54s
title: "[organize-04] Implement Excel write-back planning and preview"
status: done
priority: high
labels:
  - from-spec
  - spec:organize-data-classification-grouping-and-source-management
  - spec-date:2026-08-09
  - excel
  - write-back
  - preview
createdAt: '2026-08-09T14:22:01.914Z'
updatedAt: '2026-08-09T15:26:33.119Z'
completedAt: '2026-08-09T15:12:37.033Z'
timeSpent: 274
assignee: '@me'
spec: specs/2026-08-09/organize-data-classification-grouping-and-source-management
fulfills:
  - AC-6
  - AC-7
order: 40
---
# [organize-04] Implement Excel write-back planning and preview

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Organize write-back plan/preview contract for Excel, reusing safe existing version/hash/backup behavior. Show metadata/content restructuring diffs, destination choice and explicit confirmation without writing before approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create Excel write-back plan and preview diff for metadata and group-driven restructuring.
- [x] #2 Reuse expected-hash, backup/version and unmanaged-content safety contracts without writing before confirmation.
- [x] #3 Add Excel planner/preview tests for in-place/new-file destinations and stale source evidence.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the existing server write-back boundary with an in-memory preview plan contract for Excel only; keep execution/confirmation/restore in later tasks.
2. Resolve selected Organize items to source files and current revision/hash evidence, derive in-place/new-file destinations and per-file/all-or-nothing batch strategy.
3. Produce metadata/content restructuring diffs, source locators, unmanaged-content preservation and safety warnings without touching source files; audit preview creation.
4. Add API/domain tests for in-place/new-file previews, batch strategy, unsupported/stale source evidence and the no-write guarantee.
5. Run server tests, Python compile, Knowns validation/review and record D1-D18 compliance plus System Decision impact.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Added project-scoped Excel WriteBackPreviewPlan and POST /api/v1/projects/{id}/organize/write-back/preview.
Done: Preview resolves selected Organize items to source files, current/expected revision/hash, in-place/new-file destination, PER_FILE/ALL_OR_NOTHING strategy, metadata/content changes, source locators, unmanaged-content preservation and warnings; it never creates or completes a write job.
Done: Added editor authorization, cross-project target validation, explicit new-file destination requirement and stale/unsupported target blocking.
Verification: uv run pytest -q = 32 passed, 1 warning; Python compileall passed; Knowns validation = 0 errors, 0 warnings; git diff --check passed with repository line-ending warnings only.
Review: PASS, P1=0, P2=0. Execution/confirmation/restore remain explicitly out of scope for later write-back tasks.
System Decision Impact: candidate @decision/20260809-2212-organize-write-back-uses-non-mutating-excel-preview-plans-with-explicit-destination-and-version-gates (added) — defines the non-mutating preview, destination and version/hash safety boundary.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass.
SDD verification marker normalization: Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Spec Decision Compliance: D18=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
<!-- SECTION:NOTES:END -->

