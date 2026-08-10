---
id: lyi4r2
title: Desktop parse gate and cached fallback
layer: project
category: pattern
status: proposed
tags:
  - desktop
  - parsing
  - retry
  - provenance
createdAt: '2026-08-10T06:19:28.284Z'
updatedAt: '2026-08-10T06:19:28.284Z'
---

For desktop ingestion, resolve one profile and parse locally before upload; route only explicit RAW_FALLBACK outcomes to the raw server contract. Persist the latest local import projection plus append-only per-attempt history so retries reuse the cached parse payload and stable idempotency identity. Full reference: @doc/learnings/learning-desktop-parse-before-server-upload; candidates: @decision/20260810-1236-desktop-local-parser-contract-and-tauri-parse-boundary, @decision/20260810-1246-desktop-normalized-and-raw-fallback-server-import-contract, @decision/20260810-1257-desktop-import-retries-reuse-cached-parse-results, @decision/20260810-1305-desktop-local-import-history-is-append-only-and-project-scoped
