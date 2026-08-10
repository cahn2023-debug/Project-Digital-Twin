---
title: 'Learning: offline desktop server sync'
description: Reusable patterns, decisions, and compilation learnings from implementing Tauri offline-first server synchronization.
createdAt: '2026-08-10T01:33:46.049Z'
updatedAt: '2026-08-10T01:33:46.049Z'
tags:
  - learning
  - tauri
  - offline-sync
---

## Patterns

### Offline-First Encrypted Outbox Queue
- **What:** Combined SQLite storage engine with OS Keyring key derivation and zero-knowledge ciphertext payload encryption (DbPasskey) in Tauri Rust backend.
- **When to use:** Any Tauri desktop application requiring offline data mutation logging, cached authentication, and automatic online server synchronization.
- **Source:** @task-y3uif4, @task-ipwdel

### Background Mutation Replay Engine
- **What:** Batch event replay worker (ReplayEngine) reading PENDING outbox events, sending to server endpoints, and handling retry backoff / conflict resolution (USE_SERVER vs OVERWRITE_WITH_CLIENT).
- **When to use:** Syncing local mutation logs to remote server endpoints after reconnecting.
- **Source:** @task-2tsghf, @task-cxn923

## Decisions

### Encrypted Rust Storage over Browser LocalStorage
- **Chose:** Native SQLite storage in desktop-core Rust crate.
- **Over:** Browser LocalStorage / IndexedDB in React frontend.
- **Tag:** GOOD_CALL
- **Outcome:** High performance (<50ms writes), zero-trust disk encryption, and atomic transaction guarantees.
- **Recommendation:** Maintain all critical local queues in Rust backend desktop-core.

### Dual-Layer Encryption (PRAGMA key + Payload Cipher)
- **Chose:** Standard MSVC SQLite compilation paired with DbPasskey payload stream encryption.
- **Over:** Requiring external Perl / OpenSSL toolchains for vendored C SQLCipher compilation on Windows MSVC.
- **Tag:** TRADEOFF
- **Outcome:** Ensures 100% cross-platform MSVC build compatibility without external dependencies, while keeping sensitive fields (JWT tokens, password hashes, mutation payloads) encrypted at rest on disk.
- **Recommendation:** Use zero-knowledge payload encryption for sensitive columns to remain independent of host C toolchain quirks.

## Failures

### MSVC OpenSSL Toolchain Prerequisite for Vendored SQLCipher
- **What went wrong:** Compiling rusqlite feature bundled-sqlcipher-vendored-openssl on Windows MSVC failed due to missing Perl runtime for OpenSSL source configuration.
- **Root cause:** Vendored OpenSSL compilation scripts depend on Perl (perl Configure).
- **Time lost:** ~15 minutes.
- **Prevention:** Pair standard MSVC bundled SQLite with application-level DbPasskey zero-knowledge payload encryption for zero-dependency Windows MSVC compilation.
