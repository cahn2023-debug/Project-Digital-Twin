---
id: ijh7t3
title: "[desktop-parse-before-server-upload-01] Chuẩn hóa desktop parse gate và normalized payload"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-parse-before-server-upload
  - spec-date:2026-08-10
  - desktop-core
  - parser
  - contract
createdAt: '2026-08-10T05:23:07.233Z'
updatedAt: '2026-08-10T06:10:30.999Z'
completedAt: '2026-08-10T05:37:16.002Z'
timeSpent: 783
assignee: '@me'
spec: specs/2026-08-10/desktop-parse-before-server-upload
fulfills:
  - AC-3
  - AC-4
  - AC-5
order: 10
---
# [desktop-parse-before-server-upload-01] Chuẩn hóa desktop parse gate và normalized payload

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mở rộng pipeline desktop để chỉ upload normalized payload khi source profile khớp duy nhất và parsing hoàn tất; bao phủ Excel/XLSX, CSV, TXT, Markdown, Word, partial rows, required fields, unmapped fields, deterministic type normalization, fingerprint và provenance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement the desktop parser gate and normalized payload contract without uploading raw on successful parse.
- [x] #2 Cover partial rows, required-field errors, unmapped fields, deterministic normalization, fingerprint and source-location provenance.
- [x] #3 Add focused parser/contract tests for supported formats and ambiguous/unsupported profiles.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Define a stable desktop parser contract in `crates/desktop-core/src/parser.rs`: format/profile decision, normalized records, source locator, fingerprint, parser metadata, parse report, and invalid/unmapped/warning issue categories. Reuse the existing file hashing and manifest identity conventions.
2. Implement local adapters for the prioritized inputs (XLSX, CSV, TXT, Markdown, Word) behind the contract. Select a parser only for one unambiguous source profile; preserve valid rows, reject required-field failures with located issues, retain unmapped values explicitly, and apply deterministic scalar normalization without silently guessing.
3. Ensure successful normalized results contain records and metadata only, never the raw file or an opaque raw-row fallback; include sheet/row or section/line provenance for every record and stable fingerprint/profile/parser versions.
4. Expose a Tauri `parse_file` command in `apps/desktop/src-tauri/src/parse_cmd.rs`, register it in `apps/desktop/src-tauri/src/lib.rs`, and return the typed parser result to the desktop webview. The command must be local-only and have no upload/network side effect; sibling task `r3nkb7` will consume it before upload.
5. Add focused parser and command-boundary tests covering supported formats, ambiguous/unsupported profiles, partial valid/invalid rows, required fields, unmapped fields, deterministic normalization, and source locators/fingerprint.
6. Verify with `cargo fmt --all -- --check`, `cargo test -p desktop-core`, `cargo check -p project-digital-twin-desktop`, relevant web typecheck, `git diff --check`, and Knowns task/spec validation.

### Plan check

- Task AC-1 is intentionally owned by sibling `r3nkb7` after this parser foundation; this task fulfills AC-3, AC-4 and AC-5.
- Task AC-3 is covered by steps 2 and 5.
- Task AC-4 is covered by steps 1–3 and 5.
- Task AC-5 is covered by steps 1, 3 and 5.
- No circular dependency: `r3nkb7` and `drpdus` consume this contract after it is complete.
- External parser dependencies are a bounded implementation risk and must be kept to the minimum needed for the five prioritized formats.

### Spec Decision Compliance

D1=pass (fallback-capable result contract), D2=pass, D3=pass, D4=pass, D5=pass (upload owned by sibling), D6=pass (result states preserved), D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass (per-file result metadata), D15=pass (retry owned by sibling), D16=pass, D17=pass (outbox owned by sibling), D18=pass (server fallback owned by sibling), D19=pass (server reconciliation owned by sibling), D20=pass (audit owned by sibling).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Using kn-flow: ownership taken; planning and implementation started.
Scope refinement from code audit: this task owns the local parser/normalized contract foundation. End-to-end parse-before-upload gate is fulfilled by sibling task r3nkb7 after consuming this output.
Plan saved: local parser foundation and Tauri parse_file boundary; upload integration remains with r3nkb7.
Done: Added local Rust parser contract/adapters for XLSX, CSV, TXT, Markdown and DOCX with profile resolution, normalized records, unmapped values, partial/error reporting, deterministic scalar cleanup, SHA-256 fingerprint, provenance and parse timestamp. Added local-only Tauri parse_file command and registered it in the handler. Tests: cargo test -p desktop-core = 29 passed; cargo check -p project-digital-twin-desktop passed; filtered clippy passed; cargo fmt --all -- --check passed; git diff --check passed. Full clippy -D warnings remains blocked by 4 pre-existing lints in crypto.rs, manifest.rs, mutation.rs and replay.rs. Review: PASS, P1=0, P2=0, P3=0; webview upload wiring is intentionally owned by sibling task r3nkb7. System Decision Impact: candidate @decision/20260810-1236-desktop-local-parser-contract-and-tauri-parse-boundary (added) — durable local parser contract and Tauri parse boundary; draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
Flow audit: integrated verification confirms the local parser/Tauri boundary remains compliant. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass
<!-- SECTION:NOTES:END -->

