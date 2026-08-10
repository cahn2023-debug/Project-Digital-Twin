---
id: 9c0d07
title: "[sample-data-removal-04] Create database reset / clean sample data CLI script & verification"
status: done
priority: high
labels:
  - from-spec
  - spec:sample-data-removal
  - spec-date:2026-08-10
createdAt: '2026-08-10T04:33:17.172Z'
updatedAt: '2026-08-10T04:43:34.094Z'
completedAt: '2026-08-10T04:43:34.094Z'
timeSpent: 311
assignee: '@me'
spec: specs/2026-08-10/sample-data-removal
fulfills:
  - AC-4
---
# [sample-data-removal-04] Create database reset / clean sample data CLI script & verification

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a clean CLI/reset script (python -m app.clean_sample_data or backend CLI tool) to purge pre-existing sample data from current local databases and verify clean state across backend and desktop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Provide reset / clean script for local databases
- [x] #2 Purge existing sample data without dropping tables
- [x] #3 Run SDD verification for spec ACs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add apps/server/app/clean_sample_data.py with explicit --yes confirmation, --dry-run reporting, PostgreSQL cleanup via TRUNCATE ... CASCADE plus runtime_store_snapshots reset, and SQLite/SQLCipher-compatible table DELETE without dropping schema.
2. Support DATABASE_URL/DESKTOP_MANIFEST_PATH/DESKTOP_DB_PATH environment defaults and verify every selected target is empty after cleanup.
3. Add focused tests using temporary SQLite databases for dry-run, data removal, schema preservation, and CLI validation; keep destructive PostgreSQL execution isolated behind the existing psycopg adapter.
4. Run CLI tests, full server tests, compileall and task/SDD validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec Decision Compliance: D1=pass, D2=pass, D3=pass
System Decision Impact: none — Created clean_sample_data CLI module for server persistence reset; verified 59 pytest tests and 24 cargo tests pass.
Review found the initial CLI only reset PostgreSQL snapshots and lacked confirmation, dry-run, SQLite cleanup and tests; reopening to complete those ACs.
Flow review/fix: replaced the initial PostgreSQL-only reset with a guarded CLI supporting --yes/--dry-run, PostgreSQL application-table cleanup plus runtime snapshot reset, and SQLite/SQLCipher-compatible desktop manifest/database cleanup without dropping tables. Added 4 focused CLI tests. Verification: 63 server tests passed, compileall passed, task validation passed. Spec Decision Compliance: D1=pass, D2=pass, D3=pass. System Decision Impact: none — the CLI implements the approved cleanup contract without adding new durable guidance.
<!-- SECTION:NOTES:END -->

