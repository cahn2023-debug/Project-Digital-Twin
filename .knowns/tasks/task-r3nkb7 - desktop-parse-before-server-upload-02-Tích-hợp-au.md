---
id: r3nkb7
title: "[desktop-parse-before-server-upload-02] Tích hợp auto-upload, trạng thái file, retry và offline outbox"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-parse-before-server-upload
  - spec-date:2026-08-10
  - desktop
  - upload
  - retry
  - outbox
createdAt: '2026-08-10T05:23:07.274Z'
updatedAt: '2026-08-10T06:10:36.873Z'
completedAt: '2026-08-10T05:57:54.131Z'
timeSpent: 669
assignee: '@me'
spec: specs/2026-08-10/desktop-parse-before-server-upload
fulfills:
  - AC-1
  - AC-6
  - AC-7
  - AC-8
  - AC-9
order: 30
---
# [desktop-parse-before-server-upload-02] Tích hợp auto-upload, trạng thái file, retry và offline outbox

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Kết nối kết quả desktop parsing với upload tự động theo từng file, trạng thái lifecycle, actionable errors, per-file retry từ bước lỗi, fingerprint/idempotency và resume từ local outbox khi offline/reconnect.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Wire per-file parsing outcomes to automatic upload and visible lifecycle statuses.
- [x] #2 Persist/replay parsed payloads through the existing outbox and enforce per-file retry/idempotency.
- [x] #3 Add tests for partial batch success, lost ACK, offline reconnect and actionable error details.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add the local transport commands required by the worker: read a selected file as base64 for raw fallback, list saved local profiles for parser matching, and enqueue a single file scan for manual retry. Keep all three commands local and reuse the existing manifest/job identity.
2. Refactor `apps/web/src/features/datacenter/importWorker.ts` into a per-file state machine:
   - invoke `parse_file` before any server request;
   - reuse a cached local parse result on retry/reconnect instead of parsing again;
   - send `PARSED`/`PARTIAL` results to `desktop-imports/normalized`;
   - send `RAW_FALLBACK` files to `desktop-imports/raw-fallback`;
   - persist `PARSING`, `PARSED`/`PARTIAL`, `UPLOADING`, final and `FAILED` states locally with the parser report and provenance.
3. Preserve per-file idempotency and offline behavior by keeping the existing pending-job backoff, using the stable file fingerprint/idempotency key, and making the cached local parse payload the retry source of truth.
4. Extend `LocalImportView` and Datacenter source UI to render the full lifecycle/status set, parse-report locations and actionable errors, and expose a retry action for one failed file without re-running successful files.
5. Add focused Rust tests for profile listing/retry command behavior and TypeScript-safe worker/status helpers where practical; verify batch independence through the existing one-job-at-a-time worker loop.
6. Verify with desktop-core/Tauri checks, web typecheck/build, server endpoint tests, diff checks and Knowns validation.

### Plan check

- AC-1 is covered by steps 2 and 3: local parse precedes both normalized and raw upload branches.
- AC-6 is covered by steps 2 and 4: each FILE_SCAN job persists an independent final status.
- AC-7 is covered by steps 2, 3 and 4: cached parse payload, stable idempotency and single-file retry.
- AC-8 is covered by steps 2 and 3: normalized payload survives offline/reconnect without reparsing.
- AC-9 is covered by step 4: status, location, cause and next action are visible.
- Server endpoint dependency `drpdus` is complete; no parallel writer touches the same worker files.
- No new API shape is invented here; requests must match the server schemas completed by `drpdus`.

### Spec Decision Compliance

D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope refinement from code audit: consume the local parser result from ijh7t3 before any server upload request; preserve per-file status/retry/outbox behavior.
Using kn-flow: ownership taken; planning and implementation started after ijh7t3.
Dependency refinement: wait for server normalized/raw fallback contract from drpdus before wiring worker transport.
Paused before plan/implementation: server contract task drpdus must define normalized/raw fallback endpoints first.
Resumed after drpdus completed; server normalized/raw-fallback endpoints are available.
Plan saved: local parse-first worker state machine, normalized/raw transport, cached retry and per-file UI retry.
Done: Worker now invokes local parse_file before any server request, routes normalized/partial results to the normalized endpoint and raw fallback results to the temporary-raw endpoint, persists parser/transport states, reuses cached parse results on retries, exposes per-file retry, maps detailed parse issues/statuses in Datacenter UI, and keeps old path-based upload out of the desktop flow. Added local profile listing, base64 read command and requeue of failed FILE_SCAN jobs with stable idempotency. Verification: web typecheck/build passed (existing chunk-size warning only); cargo test -p desktop-core = 30 passed; cargo check -p project-digital-twin-desktop passed; server pytest = 68 passed; Knowns validation passed; git diff --check passed. Review: PASS, P1=0, P2=0, P3=0. System Decision Impact: candidate @decision/20260810-1257-desktop-import-retries-reuse-cached-parse-results (added) — durable cached-parse/manual-requeue/idempotency contract; draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
Flow audit: integrated verification confirms parse-first upload, cached retry, offline outbox, per-file status and idempotency behavior. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass
<!-- SECTION:NOTES:END -->

