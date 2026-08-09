---
id: j95djb
title: "[organize-07] Verify Organize integration audit trace and SDD coverage"
status: done
priority: high
labels:
  - from-spec
  - spec:organize-data-classification-grouping-and-source-management
  - spec-date:2026-08-09
  - verification
  - audit
  - e2e
createdAt: '2026-08-09T14:22:02.022Z'
updatedAt: '2026-08-09T15:27:51.610Z'
completedAt: '2026-08-09T15:27:51.610Z'
timeSpent: 202
assignee: '@me'
spec: specs/2026-08-09/organize-data-classification-grouping-and-source-management
fulfills:
  - AC-12
  - AC-13
order: 70
---
# [organize-07] Verify Organize integration audit trace and SDD coverage

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run integrated tests and verification across domain/API/UI/write-back, including audit/source traceability, conflict safety, restore and no duplicate self-import. Validate the spec/task set and complete SDD coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Run integrated domain/API/UI/write-back tests covering Organize acceptance criteria and source traceability.
- [x] #2 Verify audit before/after/correlation, conflict blocking, restore and self-write suppression across the integrated diff.
- [x] #3 Run SDD/task validation, complete decision compliance markers and document verification results.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Run full server, web and domain verification across Organize domain/API/UI/write-back changes.
2. Add/extend integrated checks for source locator/version/audit correlation, lifecycle restore, conflict blocking, batch behavior and self-write suppression.
3. Run Knowns task/spec and SDD validation; resolve only verification-scope issues without changing product scope.
4. Review final diff for P1/P2 and record coverage, test baselines, D1-D18 compliance and System Decision impact.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
SDD verification marker normalization: Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Spec Decision Compliance: D18=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Done: Integrated verification covers domain contracts, API snapshot/mutations, Organize UI build boundary, all four preview adapters, confirmed execution, restore/version history, conflict/lock blocking and self-write suppression.
Done: Audit assertions verify preview/confirm/apply/suppression event chain, actor/project/file trace, correlation IDs and before/after field changes.
Verification: server uv run pytest -q = 36 passed, 1 warning; web typecheck/build/test pass (web test suite has 0 test cases); domain typecheck/test pass (2 tests); Python compileall pass; targeted diff check pass; Knowns SDD validation valid=true with 0 errors and 1 unrelated warning on swito3.
Review: PASS, P1=0, P2=0 for Organize scope. SDD coverage reports all 18 Organize decisions compliant for all linked tasks.
System Decision Impact: none — this task records verification evidence for existing Organize contracts and adds no new durable guidance.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
<!-- SECTION:NOTES:END -->

