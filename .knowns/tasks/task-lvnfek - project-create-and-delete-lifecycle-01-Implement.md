---
id: lvnfek
title: "[project-create-and-delete-lifecycle-01] Implement backend project lifecycle API and domain"
status: done
priority: high
labels:
  - from-spec
  - spec:project-create-and-delete-lifecycle
  - spec-date:2026-08-09
createdAt: '2026-08-09T13:58:26.508Z'
updatedAt: '2026-08-09T14:26:51.334Z'
completedAt: '2026-08-09T14:12:07.637Z'
timeSpent: 770
assignee: '@me'
spec: specs/2026-08-09/project-create-and-delete-lifecycle
fulfills:
  - AC-2
  - AC-3
  - AC-4
  - AC-5
  - AC-6
  - AC-7
  - AC-8
  - AC-9
  - AC-10
  - AC-11
order: 10
---
# [project-create-and-delete-lifecycle-01] Implement backend project lifecycle API and domain

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add project listing, creation from an existing unique root folder, generated unique codes, archive/restore, tombstone deletion, stable selection ordering, and focused API/domain tests. Preserve all project-managed data and never mutate the root directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project lifecycle state and root-directory ownership are represented in the backend boundary.
- [x] #2 List/create/archive/restore/tombstone operations return stable, UI-consumable responses and errors.
- [x] #3 Focused backend tests cover generated code, duplicate roots, lifecycle transitions, retention and no filesystem mutation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend `apps/server/app/domain.py` so Project records own a normalized existing root path and explicit lifecycle status (ACTIVE/ARCHIVED/DELETED), while CameraStore keeps all project-owned maps/data intact and exposes stable active/archived listing, unique code generation, archive/restore and tombstone transitions. (D4, D5, D6, D8, D9, D10, D11, D12)
2. Update `apps/server/app/main.py` with the name + root-path create contract, project list/filter response, archive/restore/delete routes, exact validation/error mapping and active-project guards. Keep all lifecycle operations metadata-only with no filesystem deletion, move, rename or write. (D1, D2, D3, D7, D8, D9, D10, D11, D12)
3. Add focused API/domain coverage in `apps/server/tests/test_api.py` using temporary directories: generated codes, blank names, duplicate roots, stable listing, archive/restore, exact-name tombstone deletion, retention of project-owned data, root-directory snapshots and current-project fallback data.
4. Run affected server tests, Python compilation, Knowns task/spec validation and `git diff --check`; record any environment limitation without weakening the acceptance criteria.

### Plan check

- AC coverage: task AC-1 is covered by steps 1–2; task AC-2 by steps 1–2; task AC-3 by step 3.
- Scope: 3 implementation files, bounded backend contract; no dependency or migration changes.
- Dependency: runnable first; desktop UI depends on these API contracts, integrated verification follows.
- Risk: lifecycle contract and data-retention semantics are high-impact; tests cover every transition and filesystem invariant.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Added Project root_path/status lifecycle state, stable active/archived/deleted listing, generated P-### codes, existing-root validation, archive/restore, exact-name tombstone deletion, and root ownership release for a new identity. Added API routes for list/create/archive/restore/delete and updated all server API tests to create projects with temporary roots. Verification: apps/server .venv pytest 25 passed (1 existing Starlette/httpx deprecation warning); compileall passed; git diff --check passed with repository line-ending warnings. Review: PASS, no P1/P2 findings; delegated reviewer timed out and was closed without changes. System Decision Impact: candidate @decision/20260809-2111-project-deletion-uses-tombstones-and-never-mutates-the-user-root-directory (added) — establishes metadata-only project lifecycle and root-directory safety. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D10=pass, D11=pass, D12=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D10=pass, D11=pass, D12=pass
<!-- SECTION:NOTES:END -->

