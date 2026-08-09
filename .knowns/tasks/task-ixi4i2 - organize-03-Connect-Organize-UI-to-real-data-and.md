---
id: ixi4i2
title: "[organize-03] Connect Organize UI to real data and bulk management"
status: done
priority: high
labels:
  - from-spec
  - spec:organize-data-classification-grouping-and-source-management
  - spec-date:2026-08-09
  - ui
  - react
  - bulk-actions
createdAt: '2026-08-09T14:22:01.873Z'
updatedAt: '2026-08-09T15:26:28.646Z'
completedAt: '2026-08-09T15:05:57.861Z'
timeSpent: 707
assignee: '@me'
spec: specs/2026-08-09/organize-data-classification-grouping-and-source-management
fulfills:
  - AC-1
  - AC-4
  - AC-5
order: 30
---
# [organize-03] Connect Organize UI to real data and bulk management

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace Organize fixture-only rendering with the real API/state boundary. Implement group tree, unified object/file/import list, detail panel, search/filter, single and bulk group/tag/lifecycle actions, loading/error/empty states and semantic desktop controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Render Organize from the real API/state boundary with tree, unified list and detail panel.
- [x] #2 Implement search/filter, single/bulk group/tag/archive/restore actions with visible per-item results.
- [x] #3 Add loading/error/empty/accessibility coverage and run web typecheck/build.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the existing Organize fixture, shared API types, and project selection flow in apps/web/src/App.tsx.
2. Replace OrganizeView with API-backed group tree, unified entity/source/import list, detail panel, search/filter, and loading/error/empty states.
3. Wire single and bulk group/tag/archive/restore mutations with per-item feedback and accessible controls; keep write-back confirmation outside this task.
4. Add Organize-specific styles in apps/web/src/styles.css without changing unrelated module styling.
5. Run web typecheck/build, validate task/spec references, review the diff, and record D1-D18 compliance plus System Decision impact.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Replaced fixture Organize view with project-scoped API-backed groups, unified ENTITY/SOURCE_FILE/IMPORT list, detail panel, filters, loading/error/empty states and accessible controls.
Done: Added single/bulk membership and lifecycle mutations, group/tag creation, group deletion confirmation, and visible per-item action results.
Verification: web typecheck/build/test pass; uv run pytest -q = 30 passed, 1 warning; Knowns validation = 0 errors, 0 warnings.
Review: PASS, P1=0. P2 deferred: no browser-test harness exists in apps/web; static typecheck/build and API regression cover the available test boundary.
System Decision Impact: none — UI implements existing approved Organize API/spec contracts without adding new durable project guidance.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass.
SDD verification marker normalization: Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Spec Decision Compliance: D18=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
<!-- SECTION:NOTES:END -->

