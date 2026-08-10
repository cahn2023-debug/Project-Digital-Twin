---
title: 'Learning: desktop parse before server upload'
description: Reusable patterns, decisions, and failure learnings from the desktop parse-before-server-upload pipeline.
createdAt: '2026-08-10T06:19:13.364Z'
updatedAt: '2026-08-10T06:19:13.364Z'
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
