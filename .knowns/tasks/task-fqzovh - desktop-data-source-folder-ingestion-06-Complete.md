---
id: fqzovh
title: "[desktop-data-source-folder-ingestion-06] Complete CSV and Word parser coverage"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
createdAt: '2026-08-10T12:45:27.343Z'
updatedAt: '2026-08-10T14:47:15.133Z'
completedAt: '2026-08-10T12:58:39.712Z'
timeSpent: 739
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-2
  - AC-6
  - AC-7
  - AC-8
  - AC-10
order: 60
---
# [desktop-data-source-folder-ingestion-06] Complete CSV and Word parser coverage

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete the local parser boundary for CSV and Word .doc/.docx, including encoding/delimiter/header detection, structured document extraction, source locators, assets and deterministic normalization reports. Preserve raw values and explicit warnings without modifying source files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop parser supports .doc and .docx structured content with source locators and source assets.
- [x] #2 CSV parser detects encoding/BOM, delimiter and header; ambiguous input produces preview issues instead of silent guessing.
- [x] #3 Date, number and boolean normalization preserves original values and emits warnings for ambiguous values.
- [x] #4 Focused Rust/server fixtures cover Excel, CSV, Markdown/TXT and both Word formats.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Trace the existing desktop-core parser and server document/importer boundaries; add the missing format/profile fields without changing the upload gate.
2. Implement CSV dialect/header detection and structured .doc/.docx parsing with source locators, raw preservation, asset metadata and parse-report issues.
3. Align normalization behavior across desktop and server boundaries, including Project locale/config inputs and ambiguous-value warnings.
4. Add representative fixtures and focused parser/server tests for supported formats, malformed input, assets and source immutability.
5. Run Rust/server checks and Knowns validation; record compliance for D1-D31 relevant to this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation: parser coverage wave; preserving existing source-ingestion changes.
Done: extended desktop-core scanner/parser for CSV, XLS, Markdown, legacy Word .doc and .docx; added CSV encoding/delimiter detection warnings, raw-preserving normalization, OLE2 legacy Word extraction, server olefile document support, schema format updates and fixtures. Verification: cargo test -p desktop-core = 33 passed; server focused pytest = 13 passed; web typecheck passed; cargo fmt/check and Python compileall passed. System Decision Impact: candidate @decision/20260810-1958-desktop-parser-format-boundary-for-csv-and-legacy-word (added) — parser format/detection boundary is draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
<!-- SECTION:NOTES:END -->

