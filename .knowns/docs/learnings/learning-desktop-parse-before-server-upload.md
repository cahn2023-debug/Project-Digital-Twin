---
title: 'Learning: desktop parse before server upload'
description: Reusable patterns, decisions, and failure learnings from the desktop parse-before-server-upload pipeline.
createdAt: '2026-08-10T06:19:13.364Z'
updatedAt: '2026-08-10T16:14:31.950Z'
tags:
  - learning
  - desktop
  - parsing
  - upload
  - retry
  - provenance
---

## Patterns

### Parse Gate with Explicit Raw Fallback
- **What:** Resolve exactly one local source profile, parse and normalize locally, then route normalized results or an explicit `RAW_FALLBACK` outcome to separate server contracts.
- **When to use:** Desktop ingestion where successful uploads must never include raw content, while unsupported or ambiguous files still need server-side recovery.
- **Source:** @task-ijh7t3, @task-r3nkb7, @task-drpdus, @doc/specs/2026-08-10/desktop-parse-before-server-upload

### Cached Parse Result with Append-Only Import History
- **What:** Persist the latest local import projection plus immutable per-attempt history keyed by project/import/file version; retries reuse the cached parse payload and stable idempotency identity.
- **When to use:** Offline-capable ingestion where reconnects, lost acknowledgements, and audit/reconciliation must not reparse or duplicate data.
- **Source:** @task-r3nkb7, @task-dt5dz4, @task-opsvq7

## Decisions

### Explicit Contracts at the Desktop/Server Boundary
- **Chose:** Separate normalized and raw-fallback request contracts with per-file statuses, source hash verification, temporary raw cleanup, and conflict staging.
- **Over:** Sending a desktop path or an opaque raw payload through the normalized path.
- **Tag:** GOOD_CALL / TRADEOFF
- **Outcome:** The server can reconcile its own parse result without weakening the desktop parse gate.
- **Recommendation:** Keep parser outcomes, transport statuses, provenance, and fallback reasons explicit in both local storage and server responses.
- **System Decisions:** @decision/20260810-1236-desktop-local-parser-contract-and-tauri-parse-boundary, @decision/20260810-1246-desktop-normalized-and-raw-fallback-server-import-contract, @decision/20260810-1257-desktop-import-retries-reuse-cached-parse-results, @decision/20260810-1305-desktop-local-import-history-is-append-only-and-project-scoped

## Failures

### Timestamp-Dependent Retry Ordering
- **What went wrong:** The first history test ordered attempts by arbitrary fixture timestamps (`now` and `later`) and returned attempts in the wrong order.
- **Root cause:** History chronology was coupled to lexical timestamp values instead of immutable append order.
- **Time lost:** A few minutes.
- **Prevention:** Query append-only history by insertion order (`rowid`) or a monotonic event sequence, and test restart plus attempt ordering.

### SDD Marker Formatting
- **What went wrong:** Aggregate SDD validation did not recognize compliance markers embedded in longer notes or ending with punctuation.
- **Root cause:** The validator expects a standalone exact `Spec Decision Compliance: D1=pass, ...` note line.
- **Time lost:** A few minutes.
- **Prevention:** Append a standalone marker line with every D-ID before marking a linked task done.

## Folder Ingestion Extension (2026-08-10)

### Deterministic Record Identity and Revision Diff
- **What:** Prefer a stable source key; otherwise derive identity from project/source/file revision/hash and source locator. Reparse changed revisions fully, diff by deterministic identity, preserve immutable profile/schema history, and retain rollback metadata.
- **When to use:** Any multi-source ingestion flow where moved files, repeated scans, schema drift, and rollback must not create duplicate canonical records.
- **Source:** @task-hc5m2d, @task-at3xfd
- **System Decision:** @decision/20260810-2003-deterministic-source-record-identity-and-revision-diff

### Transactional Provenance and Explicit Approval Boundary
- **What:** Persist Raw, normalized ChangeSets, assets, audit entries, and pending work locally with source/file/hash/locator provenance. Obtain the local database key from the OS keychain, stop the watcher before archive, and require explicit approval before canonical apply.
- **When to use:** Offline-first desktop ingestion where parsing, review, retry, archive, and server reconciliation must remain auditable and restart-safe.
- **Source:** @task-t9mo1e, @task-746tlu, @task-at3xfd
- **System Decisions:** @decision/20260810-2129-desktop-manifest-persists-provenance-and-obtains-db-keys-from-os-keychain, @decision/20260810-2135-desktop-changeset-and-asset-sync-remain-idempotent-and-review-gated

### Per-File Job Isolation
- **What:** Persist source/file-scoped job status, phase, progress, retry error, and cancellation state. Check cancellation before parse/upload, classify locked and permission failures as retryable per file, and continue unrelated files and sources.
- **When to use:** Background folder scans where one unreadable or cancelled file must not abort the batch or other source watchers.
- **Source:** @task-724y4b, @task-at3xfd
- **System Decision:** @decision/20260810-2145-desktop-ingestion-jobs-expose-per-file-progress-and-cancellation

## Decisions

### Parser Coverage Favors Explicit Ambiguity
- **Chose:** Support Excel, CSV, TXT, Markdown, .doc, and .docx at the local parser boundary while preserving raw values, source locators, assets, and warnings for ambiguous encoding, delimiter, header, and normalized values.
- **Over:** Silent dialect guessing, source mutation, or treating unsupported binary content as a successful normalized import.
- **Tag:** GOOD_CALL / TRADEOFF
- **Outcome:** Preview and server contracts can distinguish normalized data, raw fallback, warnings, and unsupported input without losing evidence.
- **Recommendation:** Keep format support and ambiguity behavior explicit in parser reports and fixtures.
- **System Decision:** @decision/20260810-1958-desktop-parser-format-boundary-for-csv-and-legacy-word

### Review Is an Append-Only Gate
- **Chose:** Keep normalized edits and audit events inside an immutable ChangeSet until explicit approval; synchronize assets independently with idempotent retry and conflict review.
- **Over:** Applying canonical mutations during preview or silently choosing a local/server conflict winner.
- **Tag:** GOOD_CALL / TRADEOFF
- **Outcome:** Replays remain safe and users retain control over canonical writes.
- **Recommendation:** Make approval, rejection, conflict review, and retry history first-class states in both local and server contracts.
- **System Decision:** @decision/20260810-2014-desktop-changeset-review-is-append-only-and-approval-gated, @decision/20260810-2135-desktop-changeset-and-asset-sync-remain-idempotent-and-review-gated

## Failures

### Decision Review Snapshot Lag
- **What went wrong:** Newly created System Decision candidates still reported linked tasks as in-progress after those tasks were completed.
- **Root cause:** Candidate review evidence was evaluated before the final task status transition and was not automatically re-evaluated afterward.
- **Time lost:** No feature implementation time; acceptance of the decision candidates remained blocked until review is rerun.
- **Prevention:** Re-run decision inbox/review after all linked tasks are marked done, then verify evidence before accepting or superseding candidates.

### Aggregate SDD Validation Contains Legacy Noise
- **What went wrong:** Aggregate SDD validation still reported older task compliance issues even though the target spec and task entities validated cleanly.
- **Root cause:** The aggregate includes legacy/partial compliance records outside this feature wave.
- **Time lost:** Verification triage time.
- **Prevention:** Report target-entity validation separately from aggregate legacy warnings and keep a tracked cleanup task for unrelated historical records.

### Passing Web Runner With Zero Suites
- **What went wrong:** The web test runner returned success while executing zero suites.
- **Root cause:** No web test suites were configured for the runner.
- **Time lost:** None measured; this is a coverage gap rather than a product failure.
- **Prevention:** Treat executed-suite count as verification evidence and add at least one focused UI test for the ingestion review flow.


## 2026-08-10 — XLSX fallback bị từ chối bởi idempotency key quá dài

**Root cause:** Workbook không có sheet `CAMERA` bị desktop parser chuyển sang `RAW_FALLBACK`; raw-fallback request dùng nguyên job idempotency key gồm source ID, SHA-256 và full Windows path, dài 263 ký tự trong khi server giới hạn 200 ký tự, dẫn tới `HTTP 422`. Lớp UI còn che lỗi Tauri dạng chuỗi thành `File import failed` và phân loại thành `IMPORT_TRANSIENT_ERROR`.

**Signal:** Local import có trạng thái `PARSING` rồi `FAILED`, `desktop_parse` rỗng; `job_attempts.last_error` là `HTTP 422` hoặc `File import failed`; file vẫn tồn tại và hash ổn định.

**Resolution needed:** Tạo idempotency key bounded nhưng deterministic cho server contract, giữ full path ở metadata riêng; bảo toàn lỗi Tauri dạng chuỗi trong UI; bổ sung fixture workbook không có `CAMERA` và assertion cho raw fallback/422.

**Evidence:** `apps/web/src/features/datacenter/importWorker.ts`, `apps/server/app/shared/schemas.py`, `crates/desktop-core/src/parser.rs`.


**Implementation status:** Fixed in `apps/web/src/features/datacenter/importWorker.ts`: server idempotency now uses `FILE_SCAN:<file_id>:<sha256>`, and Tauri string/object errors are preserved. Web typecheck/build, desktop-core parser tests, server desktop-import tests and desktop-core cargo check pass.


## 2026-08-10 — Tauri command payload shape mismatch

**Root cause:** The Rust command is declared as `parse_file(request: ParseRequest)`, which requires a top-level `request` argument, but both frontend call sites passed the `ParseRequest` fields at the top level. Tauri rejected the call before file access with `invalid args request ... missing required key request`.

**Signal:** Import remains at `PARSING`, `desktop_parse` is null, and the local error names a missing required command argument rather than a parser or file error.

**Fix required:** Wrap the payload as `{ request: { path, file_id, file_revision, profiles, project_id, source_id, source_hash } }` in both `parseLocalFile` and `confirmPreviewImport`.

**Evidence:** `apps/desktop/src-tauri/src/parse_cmd.rs:6`, `apps/web/src/features/datacenter/importWorker.ts:355`, `apps/web/src/features/datacenter/importWorker.ts:797`.


**Implementation status:** Fixed in `apps/web/src/features/datacenter/importWorker.ts`: both `parse_file` invocations now pass the `ParseRequest` under the required top-level `request` key. Web typecheck/build, desktop-core parser tests, server desktop-import tests and desktop cargo check pass.


## 2026-08-10 — XLSX discovery must not assume CAMERA and projects must rehydrate by stable ID

**Root cause:** The desktop built-in XLSX profile hard-coded `CAMERA`, so workbooks whose visible sheets used another name failed before preview; independently, the in-memory server could restart without the locally remembered Project, causing raw/normalized upload to return `Project not found` and be mislabeled as transient.

**Signal:** `PARSER_FAILED: Worksheet 'CAMERA' not found` followed by `IMPORT_TRANSIENT_ERROR: Project not found`.

**Fix:** Built-in XLSX/XLS parsing now discovers the first sheet and returns `PARTIAL` with `PROFILE_REQUIRED` until mapping is confirmed. Server fallback resolves an unspecified workbook profile against the discovered region and preserves the actual sheet locator. Recent desktop Projects are rehydrated on reconnect with their stable UUID; upload also verifies/rehydrates the Project before sending data. Project-not-found and worksheet/profile mismatches are terminal import errors rather than retryable transient errors.

**Verification:** Desktop-core/workspace Rust tests, server tests, web typecheck/build, and focused import regression tests pass.


## 2026-08-10 — Parser rollout must invalidate cached parse results

**Root cause:** `processFileScan` reused any cached `desktop_parse` for the same file revision without checking parser version. A result generated by the old `camera-default`/`desktop-parser-v1` path therefore continued to send a missing-`CAMERA` raw fallback after the discovery fix was deployed.

**Signal:** The manifest keeps `profile_id: camera-default`, `parser_version: desktop-parser-v1`, `PARSER_FAILED: Worksheet 'CAMERA' not found`, and hundreds of server-side `MISSING_CAMERA_CODE` issues even though the source parser code has changed.

**Fix:** Bump the desktop parser contract to `desktop-parser-v2`, reuse cached parses only when the version matches, reject an outdated Tauri binary before upload, and exclude the legacy `camera-default` local profile from XLSX discovery. Retry then reparses the file and stores a fresh preview.

**Verification:** The targeted desktop-core parser test, Tauri cargo check/build, web typecheck, and server desktop-import/API tests pass.
