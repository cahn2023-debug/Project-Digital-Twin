---
id: alcq89
title: "[project-create-and-delete-lifecycle-02] Implement desktop project management UI"
status: done
priority: high
labels:
  - from-spec
  - spec:project-create-and-delete-lifecycle
  - spec-date:2026-08-09
createdAt: '2026-08-09T13:58:26.559Z'
updatedAt: '2026-08-09T14:26:53.385Z'
completedAt: '2026-08-09T14:22:57.489Z'
timeSpent: 628
assignee: '@me'
spec: specs/2026-08-09/project-create-and-delete-lifecycle
fulfills:
  - AC-1
  - AC-2
  - AC-5
  - AC-6
  - AC-9
  - AC-10
  - AC-11
order: 20
---
# [project-create-and-delete-lifecycle-02] Implement desktop project management UI

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect the project switcher to the lifecycle API and implement active/archived lists, folder selection, create flow, archive/restore, exact-name permanent-delete confirmation, empty state, and selection fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project switcher loads active/archived data and supports switching with stable selection state.
- [x] #2 Create flow validates name/folder and reports API errors without optimistic false success.
- [x] #3 Archive, restore and exact-name permanent-delete interactions are wired to the API with empty-state fallback.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Connected the project switcher to active/archived project APIs; added create flow with trimmed name and existing root-path validation, stable selection/fallback, archive/restore actions, exact-name permanent-delete modal, empty states and API error handling. Updated shared Project/ProjectStatus types and added matching project menu/modal styles. Verification: web typecheck passed; web production build passed (existing large-chunk warning); web test passed with 0 tests; domain typecheck passed; git diff --check passed with repository line-ending warnings. Review: PASS, no P1/P2 findings; delegated reviewer timed out and was closed without changes. System Decision Impact: none — UI wires the approved project lifecycle contract without adding new durable guidance. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D10=pass, D11=pass, D12=pass
<!-- SECTION:NOTES:END -->

