---
id: opsvq7
title: "[desktop-parse-before-server-upload-05] Integrated verification và SDD compliance"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-parse-before-server-upload
  - spec-date:2026-08-10
  - integration
  - verification
createdAt: '2026-08-10T05:23:07.404Z'
updatedAt: '2026-08-10T06:19:28.343Z'
completedAt: '2026-08-10T06:12:58.207Z'
timeSpent: 381
assignee: '@me'
spec: specs/2026-08-10/desktop-parse-before-server-upload
fulfills:
  - AC-1
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
  - AC-12
order: 50
---
# [desktop-parse-before-server-upload-05] Integrated verification và SDD compliance

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Chạy kiểm thử tích hợp toàn pipeline desktop parse → normalized/raw upload → server fallback → conflict review → retry/offline recovery; rà soát toàn bộ AC, D1-D20, validation và review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Run end-to-end fixtures across supported formats, raw fallback, partial parsing, retries, offline recovery and conflict review.
- [x] #2 Verify all spec ACs and D1-D20 compliance against the integrated diff.
- [x] #3 Run focused and broad tests, Knowns validation and final review; record System Decision Impact.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Trace the integrated parse-before-upload path across local parser/Tauri commands, worker state transitions, normalized/raw server routes, conflict staging, retry/outbox persistence, and project-scoped history; use the real diff and linked task outcomes as evidence.
2. Run focused integration fixtures for prioritized formats and partial/unmapped/provenance behavior, normalized upload, raw fallback cleanup/statuses, hash/metadata conflict review, cached retry/offline outbox, and local restart/history queries.
3. Run broad verification with desktop-core tests, Tauri compile, web typecheck/build, server test environment from apps/server/uv.lock, formatting and diff checks.
4. Verify AC-1 through AC-12 and D1-D20 explicitly against implementation/tests; record any gaps as conflicts instead of silently passing them.
5. Run Knowns entity/SDD validation and integrated review, then record evidence, check implementation ACs, stop the timer, and complete the task.

### Plan check

- AC-1..AC-12 are covered by the linked completed implementation tasks plus focused tests and integrated path review; step 4 is the explicit coverage gate.
- D1..D20 are canonical in the spec Locked Decisions section and will be reported as pass/conflict only after evidence review.
- Verification is read-only except Knowns task evidence/status metadata; no new runtime contract or production feature is introduced.
- The server suite must run from `apps/server` with `uv run --locked --extra test pytest -q` so its declared `pythonpath = ["."]` and locked dependencies are active.

### Spec Decision Compliance

D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Integrated evidence: focused parser fixtures = 5 passed (XLSX, CSV, Markdown, Word, ambiguous-profile raw fallback); focused server desktop-import fixtures = 5 passed; full Rust workspace = 32 tests passed (desktop-core 31 + Tauri 1); Tauri cargo check passed; web typecheck/build passed (existing Vite chunk-size warning); full server suite = 68 passed with existing Starlette/httpx deprecation warning; web tests have no test files; cargo fmt --all -- --check and git diff --check passed. AC mapping: AC-1 parse_file precedes normalized/raw branches and normalized requests omit raw content; AC-2 RAW_FALLBACK branch plus server outcome tests; AC-3/4/5 parser partial/unmapped/provenance tests; AC-6 one-job-at-a-time worker with independent local projections; AC-7 cached parse, stable idempotency and retry tests; AC-8 persisted local payload/outbox retry path; AC-9 SourceManagement status/issue/action UI; AC-10/11 server parsed/cleanup/conflict tests; AC-12 restart/history query test. Review: PASS, P1=0, P2=0, P3=0; artifact verification fully wired. System Decision Impact: none — integrated verification adds no new durable guidance; it confirms the existing parser, server import, cached retry, and local history candidates remain review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass
Extracted reusable patterns, decisions, and failures to @doc/learnings/learning-desktop-parse-before-server-upload; promoted the parse-gate/cached-fallback pattern to @doc/learnings/critical-patterns.
<!-- SECTION:NOTES:END -->

