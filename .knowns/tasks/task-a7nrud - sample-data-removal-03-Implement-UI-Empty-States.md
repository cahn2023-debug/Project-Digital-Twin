---
id: a7nrud
title: "[sample-data-removal-03] Implement UI Empty States and CTA prompts in Web & Desktop"
status: done
priority: high
labels:
  - from-spec
  - spec:sample-data-removal
  - spec-date:2026-08-10
createdAt: '2026-08-10T04:33:12.123Z'
updatedAt: '2026-08-10T04:45:01.507Z'
completedAt: '2026-08-10T04:45:01.507Z'
timeSpent: 68
assignee: '@me'
spec: specs/2026-08-10/sample-data-removal
fulfills:
  - AC-2
  - AC-3
---
# [sample-data-removal-03] Implement UI Empty States and CTA prompts in Web & Desktop

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement intuitive Empty State components with Call-To-Action buttons ('Create Project', 'Add Data Source') for Projects, Cameras, Organize, and Data Sources across Web & Desktop UIs when dataset is empty.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Render Empty State on Projects tab when empty
- [x] #2 Render Empty State on Camera & Organize tabs when empty
- [x] #3 Provide CTA buttons to create project / add data source
- [x] #4 Verify user creation flow from Empty State
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec Decision Compliance: D1=pass, D2=pass, D3=pass
System Decision Impact: none — Replaced hardcoded sample arrays with empty datasets by default; added Empty State containers and CTA buttons across Datacenter, Organize and Projects UI; pnpm web & desktop builds passed.
Flow review found the prior empty-state pass covered Datacenter but lacked Organize/Create-project CTA wiring; reopening to complete the full UI ACs.
Flow review/fix: retained empty Datacenter camera/source states and wired Organize empty states to Create project and Add data source CTAs through AppShell. Verified projects menu already exposes Create CTA; desktop reuses the shared web bundle. Verification: web typecheck/build passed, web test runner has 0 tests, desktop typecheck passed; build emitted only the existing large-chunk warning. Spec Decision Compliance: D1=pass, D2=pass, D3=pass. System Decision Impact: none — empty-state behavior implements the approved UI contract.
<!-- SECTION:NOTES:END -->

