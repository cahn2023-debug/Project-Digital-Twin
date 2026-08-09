---
id: 00yzz4
title: "[organize-01] Implement Organize domain graph, groups, tags and lifecycle"
status: done
priority: high
labels:
  - from-spec
  - spec:organize-data-classification-grouping-and-source-management
  - spec-date:2026-08-09
  - domain
  - groups
  - tags
  - lifecycle
createdAt: '2026-08-09T14:22:01.812Z'
updatedAt: '2026-08-09T15:26:19.833Z'
completedAt: '2026-08-09T14:33:52.130Z'
timeSpent: 592
assignee: '@me'
spec: specs/2026-08-09/organize-data-classification-grouping-and-source-management
fulfills:
  - AC-2
  - AC-3
  - AC-5
order: 10
---
# [organize-01] Implement Organize domain graph, groups, tags and lifecycle

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define and persist Organize group/tag membership and lifecycle contracts for canonical objects and file/import records. Support multi-parent acyclic nested groups, bulk membership operations, group unlink deletion, soft-delete/trash and restore without hard-deleting data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Persist typed group, tag and membership state for object/file/import records with multi-parent DAG validation.
- [x] #2 Implement group link deletion, multi-membership operations, soft-delete/trash and restore without deleting underlying data.
- [x] #3 Add domain/storage tests for nesting, cycle rejection, bulk membership and lifecycle retention.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend `packages/domain/src/index.ts` with typed Organize item references, group/tag/membership contracts and lifecycle statuses, preserving existing Camera/source/change-set types.
2. Add Organize persistence tables to `migrations/0001_initial.sql` for project-scoped groups, multi-parent links, tags, item memberships and soft-deleted lifecycle state; enforce uniqueness and self-parent constraints at the schema boundary.
3. Extend `apps/server/app/domain.py` `CameraStore` with in-memory Organize state and typed dataclasses for groups/tags/memberships/lifecycle until the existing PostgreSQL adapter task replaces the store.
4. Implement project isolation, group create/rename/move/archive/delete semantics, DAG cycle detection, multi-item group/tag assignment/removal, and archive/soft-delete/restore operations without deleting underlying objects or source references.
5. Add focused server tests in `apps/server/tests/test_organize.py` and shared contract assertions in `packages/domain/test/domain.test.ts` for nested multi-parent groups, cycle rejection, bulk memberships, group unlink deletion, lifecycle retention and cross-project rejection.
6. Verify with targeted pytest, domain typecheck/test, migration/schema inspection, Knowns task validation and `git diff --check`.

### Plan check

- AC coverage: task AC-1 is covered by steps 1–3; task AC-2 by step 4; task AC-3 by step 5.
- Scope: no Organize API routes, UI, write-back, ChangeSet approval or audit endpoint changes; those belong to later tasks.
- Dependency: task 01 is the first wave and has no Organize sibling dependency. Task 02 consumes these contracts.
- Risk: migration and shared domain changes have cross-module blast radius; tests and existing package checks are mandatory.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass. D9–D16 and D18 are preserved as later write-back constraints; this task does not implement or weaken them.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: added typed Organize contracts in packages/domain, project-scoped groups/tags/membership/lifecycle state and DAG validation in CameraStore, PostgreSQL schema constraints for group/tag/project isolation, bulk group/tag operations, group unlink deletion and reversible item lifecycle. Added domain and server tests.
Verification: targeted server pytest 12 passed (1 existing Starlette/httpx deprecation warning); @project/domain typecheck passed; @project/domain test 2 passed; Python py_compile passed; Knowns task validation passed; SDD validation passed with 0 errors/warnings and 2 informational notices; git diff --check passed with repository line-ending warnings only. Review: PASS, no P1/P2 findings.
System Decision Impact: candidate @decision/20260809-2133-organize-uses-project-scoped-multi-parent-group-memberships-and-reversible-item-lifecycle (added) — records the project-scoped multi-parent DAG, tag membership and reversible lifecycle boundary. Candidate remains draft and needs evidence because two local ADR source refs are not registered Knowns docs.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass.
SDD verification marker normalization: Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Spec Decision Compliance: D18=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
<!-- SECTION:NOTES:END -->

