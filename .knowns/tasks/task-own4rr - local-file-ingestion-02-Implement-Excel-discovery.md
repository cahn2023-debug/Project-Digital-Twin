---
id: own4rr
title: "[local-file-ingestion-02] Implement Excel discovery, merge normalization and Profiles"
status: todo
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - excel
  - profiles
createdAt: '2026-08-09T10:50:29.394Z'
updatedAt: '2026-08-09T11:25:10.159Z'
timeSpent: 0
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-1
  - AC-2
  - AC-3
  - AC-4
  - AC-5
order: 20
---
# [local-file-ingestion-02] Implement Excel discovery, merge normalization and Profiles

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement visible-sheet scanning, multiple table/region discovery, multi-row and merged header handling, vertical merged data propagation, skip rules, formula values and immutable Profile versions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Scan only visible Excel sheets and expose multiple table regions with candidate multi-row headers.
- [ ] #2 Propagate horizontal and vertical merged values while retaining original source coordinates.
- [ ] #3 Reuse matching Profile versions automatically and create a new immutable Profile after confirmed unknown-structure mapping.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Extend the Excel parser contract in apps/server/app/importer.py and the shared domain types to represent visible-sheet scans, table regions, header candidates, merged ranges, skip rules, displayed formula values and Raw/source locators while preserving the existing Camera parser.
2. Implement discovery for visible sheets and multiple independent regions, hierarchical header propagation, vertical data merge propagation, repeated-header/total/note filtering and Profile lookup/version creation.
3. Keep Profile versions immutable and make the preview result deterministic so later mapping/UI work can confirm or reject a candidate without reparsing differently.
4. Add representative workbook fixtures/tests in apps/server/tests/test_importer.py and apps/server/tests/test_workbook.py for hidden sheets, multiple tables, merged headers/data, notes, totals, formulas, known Profiles and unknown structures.
5. Validate with pytest, type/build checks for affected packages, Knowns validation and git diff --check.

## Dependencies and scope

- Depends on local-file-ingestion-01 for file version/source-locator persistence.
- Provides parser/preview/Profile contracts to local-file-ingestion-03 and local-file-ingestion-05; no ChangeSet apply or UI implementation here.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task created from approved spec; implementation plan and verification will be added before execution.
Full-wave planning pass: plan saved before implementation and baseline commit.
<!-- SECTION:NOTES:END -->

