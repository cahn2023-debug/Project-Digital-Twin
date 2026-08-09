---
id: qzkm2k
title: "[local-file-ingestion-01] Establish local file registry, versions, Raw and source locators"
status: in-progress
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - foundation
  - provenance
createdAt: '2026-08-09T10:50:29.361Z'
updatedAt: '2026-08-09T11:25:41.094Z'
timeSpent: 2031
assignee: '@me'
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-1
  - AC-12
order: 10
---
# [local-file-ingestion-01] Establish local file registry, versions, Raw and source locators

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement logical file registration, physical locations, immutable file versions, SHA-256/metadata detection, Raw retention and source locators for local-first ingestion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Register logical file identity separately from physical paths and store current hash, size, metadata and immutable revisions.
- [ ] #2 Persist Raw and source locators for mapped, unmapped and invalid source values.
- [ ] #3 After server acknowledgement, local cleanup keeps only the latest local file version while leaving the server-history contract available for integrated verification.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Define the source provenance contract in packages/domain/src/index.ts: immutable file version metadata, Raw record/source-locator types, file-version status and deduplication identity. Preserve the existing SourceLocator and ImportResult contracts.
2. Align the local manifest schema in apps/desktop/manifest.sql and the desktop-core bootstrap in crates/desktop-core/src/lib.rs for logical files, immutable file versions, Raw records and source locators. Keep existing sync_state and pending_jobs behavior.
3. Extend ManifestDb with explicit operations to register/update a logical file location, record a new version only when hash/metadata changes, reject duplicate hashes, persist Raw/source-locator payloads, and clean local history only after an acknowledged server sync.
4. Preserve the existing SHA-256 helpers and safe-write boundary; make version registration reusable by later watcher, parser and write-back tasks without implementing Excel parsing or ChangeSet application here.
5. Add focused Rust tests for logical identity versus moved paths, immutable/deduplicated versions, Raw/source-locator persistence, local cleanup, restart persistence and existing hash behavior. Add domain typecheck/tests and migration/diff checks where applicable.
6. Validate with cargo fmt/check/test, pnpm --filter @project/domain typecheck/test, Knowns task/spec validation and git diff --check.

## Scope and assumptions

- PostgreSQL source_files/file_versions tables already exist in migrations/0001_initial.sql; this task preserves that server-history boundary and does not duplicate the pending canonical PostgreSQL adapter task.
- Server-side full history verification is integrated in local-file-ingestion-08; this task provides the local manifest and provenance primitives it consumes.
- No Excel parser, Profile engine, watcher, ChangeSet approval, UI or Word parser changes belong in this task.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task created from approved spec; implementation plan and verification will be added before execution.
Planning started from approved spec; existing baseline is desktop-core ManifestDb + manifest.sql plus server source-file/version migration tables.
Plan check refinement: AC-21 verification remains owned by local-file-ingestion-08; this task owns local cleanup behavior.
Implementation plan saved after AC ownership and dependency check.
<!-- SECTION:NOTES:END -->

