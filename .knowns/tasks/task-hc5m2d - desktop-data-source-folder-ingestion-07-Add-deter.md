---
id: hc5m2d
title: "[desktop-data-source-folder-ingestion-07] Add deterministic identity and revision diff"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
createdAt: '2026-08-10T12:45:27.868Z'
updatedAt: '2026-08-10T14:47:18.512Z'
completedAt: '2026-08-10T13:03:38.271Z'
timeSpent: 279
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-4
  - AC-5
  - AC-9
  - AC-12
order: 70
---
# [desktop-data-source-folder-ingestion-07] Add deterministic identity and revision diff

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace row/UUID-only identity behavior with deterministic record identity, preserve immutable Profile/schema versions, detect schema drift, and create revision diffs and rollback ChangeSets without duplicate records.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Records with a stable source key reuse deterministic identity; records without one use Project/source/file revision/hash/locator identity.
- [x] #2 New or missing fields remain unmapped and trigger preview without mutating the active Profile.
- [x] #3 Every changed file revision is fully reparsed, diffed by locator/version and retained for rollback.
- [x] #4 Identity, schema-drift, duplicate and rollback tests pass across repeated parses.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Locate current row-key, raw-record and server mapping identity paths and define one deterministic identity contract from the linked spec.
2. Implement stable identity derivation with source-key preference and locator fallback across local persistence and server ChangeSet mapping.
3. Persist immutable schema/Profile revisions and surface schema drift as unmapped preview data.
4. Add full-reparse revision diff, history and rollback ChangeSet behavior with idempotent duplicate suppression.
5. Add Rust/Python integration tests, validate task refs and record D1-D31 compliance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: added deterministic parser record identity with stable source-key preference and provenance fallback, propagated identity/raw fields through web/server contracts, switched local raw row keys to identity, and persisted identity-based revision diff metadata for repeated file revisions while retaining immutable profiles/history. Verification: cargo test -p desktop-core = 34 passed; web typecheck passed; focused server pytest = 9 passed; cargo fmt/check passed. System Decision Impact: candidate @decision/20260810-2003-deterministic-source-record-identity-and-revision-diff (added) — identity/revision contract is draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
<!-- SECTION:NOTES:END -->

