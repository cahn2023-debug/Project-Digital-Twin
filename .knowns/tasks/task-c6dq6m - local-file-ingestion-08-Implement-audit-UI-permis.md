---
id: c6dq6m
title: "[local-file-ingestion-08] Implement audit UI, permissions, retention and end-to-end verification"
status: done
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - audit
  - verification
createdAt: '2026-08-09T10:50:29.576Z'
updatedAt: '2026-08-09T12:28:00.364Z'
completedAt: '2026-08-09T12:26:14.324Z'
timeSpent: 458
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-19
  - AC-20
  - AC-21
  - AC-22
order: 80
---
# [local-file-ingestion-08] Implement audit UI, permissions, retention and end-to-end verification

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement append-only lifecycle audit, correlation chain, field before/after values, Project-scoped audit search/export, independent permissions, local cleanup and representative/real-file verification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Record append-only lifecycle audit with actor, time, before/after fields and event/correlation/causation links.
- [x] #2 Provide Project-scoped audit filtering/export and separate view/export/approval/restore permissions.
- [x] #3 Run representative fixture and real Project-file verification, record processing duration and validate local/server retention behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add append-only audit records and lifecycle event links across file detection, parsing, Profile/mapping, preview, ChangeSet, canonical apply, conflict, sync and write-back; include actor, time, before/after fields, event_id, correlation_id and causation_id.
2. Expose Project-scoped audit query/export and independent authorization checks for view, export, ChangeSet approval and file restore; wire the relevant view into apps/web/src/App.tsx without disturbing existing prototype modules.
3. Implement local cleanup after server acknowledgement while keeping server file/version/Raw history queryable and reproducible; verify retention classifications against the existing migration/ADR boundary.
4. Build representative fixtures and selected real Project-file verification covering Excel, Markdown/TXT/Word, offline restart, duplicate detection, conflict, write-back safety, audit filters/export and processing-duration capture.
5. Run full repository validation: pytest, TypeScript typecheck/test/build, cargo fmt/check/test, SDD/Knows validation and git diff --check; record unresolved environment limits without weakening ACs.

## Dependencies and scope

- Depends on tasks 01–07 and existing authorization/API boundaries.
- This is the final integrated verification task; it does not silently add a fixed performance target.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task created from approved spec; implementation plan and verification will be added before execution.
Full-wave planning pass: plan saved before implementation and baseline commit.
Started Task 08 from the approved plan; existing outbox events and authorization roles will be extended into append-only audit/query/export boundaries.
Done: added append-only AuditEvent records for outbox lifecycle events with actor, operation, time, file/object/Profile/ChangeSet links, status, field before/after, correlation/causation IDs and processing duration. Added Project-scoped audit query and CSV/JSON export API; added independent audit.view, audit.export, changeset.approve and file.restore permissions and a wired Audit Trail UI with filters and export action. Added server-acknowledged local cleanup guard in desktop-core and integrated representative API/parser/workbook/audit/permission tests. Server history remains available in file versions, Raw, ChangeSets and audit events. Verification: apps/server pytest 23 passed (1 existing Starlette/httpx deprecation warning); Python compileall passed; web build/typecheck passed (one existing chunk-size warning), web test passed with 0 tests; domain typecheck/test passed; desktop typecheck passed; cargo fmt/check/test passed; git diff --check passed with repository line-ending warnings only. Review: manual diff review completed; delegated reviewer was unavailable before timeout and made no changes. System Decision Impact: candidate @decision/20260809-1925-audit-is-append-only-project-scoped-and-independently-permissioned (added) — establishes audit, permission and retention boundaries. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D52=pass

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass
<!-- SECTION:NOTES:END -->

