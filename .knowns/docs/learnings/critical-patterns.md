---
title: Critical Patterns
description: Promoted learnings that save the most time. Read at session start.
createdAt: '2026-08-10T08:33:00.000Z'
updatedAt: '2026-08-10T15:11:01.380Z'
tags:
  - learning
  - critical
---

# Critical Patterns

Promoted learnings from completed work. Read this at the start of every session via `kn-init`.

---

## 2026-08-10 Windows MSVC SQLite Encrypted Outbox Pattern
**Category:** pattern / failure prevention
**Source:** @task-y3uif4, @task-2tsghf
**System Decision:** @decision/20260810-0823-sqlcipher-encrypted-local-storage-engine-for-desktop
**Tags:** [tauri, sqlite, offline-sync, msvc]

Compiling `rusqlite` with `bundled-sqlcipher-vendored-openssl` on Windows MSVC requires Perl (`perl Configure`) for OpenSSL source compilation. To maintain 100% zero-dependency cross-platform Windows MSVC compilation, pair standard MSVC `bundled` SQLite with `DbPasskey` zero-knowledge payload stream encryption for all sensitive SQLite outbox columns (JWT tokens, password hashes, mutation payloads).

**Full entry:** @doc/learnings/learning-offline-desktop-server-sync


## 2026-08-10 Desktop Parse Gate and Cached Fallback Pattern
**Category:** pattern / failure prevention
**Source:** @task-ijh7t3, @task-r3nkb7, @task-drpdus, @task-dt5dz4, @task-opsvq7
**System Decisions:** @decision/20260810-1236-desktop-local-parser-contract-and-tauri-parse-boundary, @decision/20260810-1246-desktop-normalized-and-raw-fallback-server-import-contract, @decision/20260810-1257-desktop-import-retries-reuse-cached-parse-results, @decision/20260810-1305-desktop-local-import-history-is-append-only-and-project-scoped
**Tags:** [desktop, parsing, raw-fallback, retry, provenance]

Keep the desktop parser gate explicit: a unique profile produces normalized payload only; unsupported/ambiguous/failed parsing produces a raw-fallback result with reason. Persist the latest local projection and append-only retry history so offline retries reuse the cached parse result, preserve provenance, and remain idempotent. Standalone exact compliance-marker lines are required for aggregate SDD validation.

**Full entry:** @doc/learnings/learning-desktop-parse-before-server-upload

## 2026-08-10 Desktop Folder Ingestion Invariants
**Category:** pattern / failure prevention
**Source:** @task-fqzovh, @task-hc5m2d, @task-ho64sc, @task-t9mo1e, @task-746tlu, @task-724y4b, @task-at3xfd
**System Decisions:** @decision/20260810-1958-desktop-parser-format-boundary-for-csv-and-legacy-word, @decision/20260810-2003-deterministic-source-record-identity-and-revision-diff, @decision/20260810-2014-desktop-changeset-review-is-append-only-and-approval-gated, @decision/20260810-2129-desktop-manifest-persists-provenance-and-obtains-db-keys-from-os-keychain, @decision/20260810-2135-desktop-changeset-and-asset-sync-remain-idempotent-and-review-gated, @decision/20260810-2145-desktop-ingestion-jobs-expose-per-file-progress-and-cancellation
**Tags:** [desktop, ingestion, provenance, identity, approval, retry]

A folder ingestion pipeline should preserve source evidence at every boundary: deterministic record identity and revision history, Raw/ChangeSet/assets/audit provenance, explicit approval before canonical apply, and per-file progress/retry/cancellation. Treat ambiguous parser input, locked files, conflicts, stale decision evidence, and zero-suite test runs as visible states requiring review rather than successful completion.

**Full entry:** @doc/learnings/learning-desktop-parse-before-server-upload
