---
id: ho64sc
title: "[desktop-data-source-folder-ingestion-08] Complete preview, mapping and ChangeSet review UI"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
createdAt: '2026-08-10T12:45:28.326Z'
updatedAt: '2026-08-10T14:47:22.419Z'
completedAt: '2026-08-10T13:15:24.747Z'
timeSpent: 671
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-5
  - AC-9
  - AC-15
order: 80
---
# [desktop-data-source-folder-ingestion-08] Complete preview, mapping and ChangeSet review UI

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend preview/mapping UX to show regions, headers, sample rows, inferred types and field issues; allow mapping/type changes/row skips/Profile versions, then review and edit normalized ChangeSets before approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Preview exposes region/header/sample/type/issue data and supports mapping, type changes, row skips and immutable Profile version save.
- [x] #2 Review shows before/after diff, valid/unmapped/invalid data, warnings, assets and source locators.
- [x] #3 Users can edit normalized ChangeSet values without editing source files; edits are append-only audit events.
- [x] #4 UI tests/typecheck/build cover independent file status and review actions.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend import worker response models and server contracts for preview, schema drift, diff, assets and editable normalized values.
2. Build the preview/mapping interactions while preserving per-file isolation and the existing Tauri-only source boundary.
3. Add a ChangeSet review surface with diff, Raw/unmapped/invalid, warnings, assets, locators and explicit approve/reject actions.
4. Persist normalized edits and audit events without modifying source files; add focused UI/API tests.
5. Run web typecheck/build and relevant server tests; validate the task and compliance markers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation: preview/mapping and ChangeSet review wave.
Done: extended preview contracts/UI with regions, headers, sample rows, inferred types, mapping/type/skip-row controls and immutable profile version fields; added ChangeSet diff/raw/unmapped/invalid/warning/asset/source-locator review; added normalized value edit, explicit approve/reject endpoints and append-only audit events. Verification: cargo fmt/check and cargo test -p desktop-core = 34 passed; focused server pytest = 10 passed; web typecheck/build passed; Python compileall passed. System Decision Impact: candidate @decision/20260810-2014-desktop-changeset-review-is-append-only-and-approval-gated (added) — review edits remain ChangeSet-local and auditable; canonical apply requires explicit approval. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
<!-- SECTION:NOTES:END -->

