---
title: Critical Patterns
description: Promoted learnings that save the most time. Read at session start.
createdAt: '2026-08-10T08:33:00.000Z'
updatedAt: '2026-08-10T08:33:00.000Z'
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
