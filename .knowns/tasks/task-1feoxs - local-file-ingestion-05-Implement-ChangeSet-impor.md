---
id: 1feoxs
title: "[local-file-ingestion-05] Implement ChangeSet import, approval and conflict resolution"
status: todo
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - changeset
  - conflicts
createdAt: '2026-08-09T10:50:29.464Z'
updatedAt: '2026-08-09T11:25:18.174Z'
timeSpent: 0
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-10
  - AC-13
order: 50
---
# [local-file-ingestion-05] Implement ChangeSet import, approval and conflict resolution

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create one ChangeSet per file after preview, preserve Raw/unmapped data, validate before canonical apply, merge multi-source fields and resolve base/server/local conflicts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Create one ChangeSet per file after preview and keep canonical state unchanged until approval.
- [ ] #2 Persist unmapped data in Raw and show user-visible notices.
- [ ] #3 Present source-file and base/server/local field conflicts and apply only resolved changes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend the existing ChangeSet and import boundaries in apps/server/app/domain.py and apps/server/app/main.py so each accepted file preview produces one explicit file-origin ChangeSet with Raw/unmapped references and no canonical mutation before approval.
2. Implement validation state transitions, approval/apply behavior, field-level base/server/local conflict payloads and same-object multi-source conflict resolution using the task-03 mapping output.
3. Preserve idempotency by file_id/revision/hash and emit the existing outbox/audit hooks exactly once for an applied ChangeSet; retain rejected/failed/conflicted history.
4. Add API/domain tests for one-ChangeSet-per-file, pre-approval immutability, partial valid import, Raw notices, non-overlapping field rebase, field conflict and retry idempotency.
5. Run pytest/API checks, package checks, Knowns validation and git diff --check.

## Dependencies and scope

- Depends on tasks 01–04 and existing ADR-003/005/006 contracts.
- Does not implement Excel discovery, document parsing or write-back; it consumes their stable contracts.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task created from approved spec; implementation plan and verification will be added before execution.
Full-wave planning pass: plan saved before implementation and baseline commit.
<!-- SECTION:NOTES:END -->

