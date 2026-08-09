---
id: uo3utj
title: "[organize-02] Connect Organize API to canonical data, sources, ChangeSets and audit"
status: done
priority: high
labels:
  - from-spec
  - spec:organize-data-classification-grouping-and-source-management
  - spec-date:2026-08-09
  - api
  - changeset
  - audit
  - provenance
createdAt: '2026-08-09T14:22:01.845Z'
updatedAt: '2026-08-09T15:26:24.208Z'
completedAt: '2026-08-09T14:51:36.026Z'
timeSpent: 934
assignee: '@me'
spec: specs/2026-08-09/organize-data-classification-grouping-and-source-management
fulfills:
  - AC-1
  - AC-3
  - AC-4
  - AC-12
order: 20
---
# [organize-02] Connect Organize API to canonical data, sources, ChangeSets and audit

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose project-scoped data for the unified Organize view and apply group/tag/metadata changes through existing canonical/source boundaries. Preserve object-to-file/import links, source locators, ChangeSet behavior, authorization and append-only audit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Expose project-scoped unified object/file/import queries and mutations with source/version/locator links.
- [x] #2 Route group/tag/metadata changes through canonical/ChangeSet boundaries and preserve authorization.
- [x] #3 Add API/integration tests for filtering, provenance, failure rollback and append-only audit payloads.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend `apps/server/app/domain.py` with a project-scoped Organize snapshot builder that merges canonical Cameras, source file versions and import ChangeSets into typed unified items, including lifecycle, group/tag memberships, source file/version and source locator details.
2. Add domain mutation/audit helpers for group/tag membership and item lifecycle changes. Use the existing append-only `_add_event` boundary with before/after payloads, actor, correlation and project scope; preserve task 01's DAG/project isolation.
3. Extend `apps/server/app/authorization.py` with the project-editor `organize.edit` action, keeping read access separate from mutations.
4. Add FastAPI models and endpoints in `apps/server/app/main.py` for the Organize snapshot/filter contract, group/tag CRUD/update, bulk membership assignment/removal and archive/delete/restore; map domain validation/conflict/not-found errors to stable HTTP responses.
5. Add API tests covering unified object/file/import payloads and filters, multi-group/tag mutations, lifecycle restore, project isolation, audit before/after/correlation and viewer mutation rejection.
6. Verify with targeted/full server tests, Python compile, Knowns task validation, SDD validation and `git diff --check`.

### Plan check

- AC coverage: task AC-1 is covered by steps 1 and 4; AC-2 by steps 2–4; AC-3 by step 5.
- Scope: no React UI, source-file write-back, serializers or PostgreSQL adapter implementation; task 03 and tasks 04–06 own those boundaries.
- Dependency: organize-01 is done and supplies domain group/tag/lifecycle contracts; this task exposes them to the UI and later write-back work.
- Risk: API response shape and authorization are shared runtime contracts; tests must exercise project isolation, failure paths and audit payloads.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass. Write-back D9–D16/D18 remain constraints for later tasks; this task does not perform source writes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: exposed the project-scoped Organize snapshot and filter API for canonical entities, source files and import ChangeSets; added group/tag/lifecycle CRUD/mutation endpoints, project-editor authorization and append-only audit events with before/after/correlation payloads. Added API integration tests for unified items, source locators, filters, editor rejection, reversible lifecycle and audit trace.
Integration recovery: the completed project-lifecycle task metadata was present but its domain/root_path contract was absent from the active worktree; restored that prerequisite contract alongside Organize so the existing staged project API/tests remain runnable. No filesystem lifecycle behavior was expanded beyond the approved contract.
Verification: full apps/server pytest 30 passed (1 existing Starlette/httpx deprecation warning); Python compile passed; @project/domain typecheck/test passed; web typecheck passed; Knowns task validation passed; SDD validation passed with 0 errors/warnings and 2 informational notices; git diff --check passed with repository line-ending warnings only. Review: PASS, no P1/P2 findings.
System Decision Impact: candidate @decision/20260809-2151-organize-api-exposes-unified-project-scoped-data-and-audited-editor-mutations (added) — records the unified snapshot, editor mutation, authorization and audit boundary. Candidate remains draft pending linked-task completion evidence.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass.
SDD verification marker normalization: Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Spec Decision Compliance: D18=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
<!-- SECTION:NOTES:END -->

