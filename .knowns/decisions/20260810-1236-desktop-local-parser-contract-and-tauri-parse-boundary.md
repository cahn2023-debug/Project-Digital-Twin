---
id: 20260810-1236-desktop-local-parser-contract-and-tauri-parse-boundary
title: Desktop-local parser contract and Tauri parse boundary
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - parsing
  - contract
  - tauri
  - provenance
sources:
  - '@doc/specs/2026-08-10/desktop-parse-before-server-upload'
relatedDocs:
  - specs/2026-08-10/desktop-parse-before-server-upload
relatedTasks:
  - ijh7t3
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "ijh7t3" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T05:36:42.897Z'
createdAt: '2026-08-10T05:36:42.897Z'
updatedAt: '2026-08-10T05:36:42.897Z'
---

## Context

Desktop ingestion currently needs a stable local parsing boundary before transport. The parser must emit normalized records, provenance and diagnostics without sending raw files.

## Decision

Use a Rust desktop-core parser contract exposed through a local Tauri parse_file command. The result carries format/profile/parser metadata, fingerprint, normalized records, unmapped values, source locators, parse report and explicit Parsed/Partial/RawFallback status. Upload and server fallback consumers must treat this result as the input boundary.

## Alternatives Considered

Keep sending source paths to the server for parsing; embed format-specific parsing only in the webview; or duplicate parser implementations in desktop and server.

## Consequences

Supported file parsing and provenance are testable locally and can be reused by the desktop webview. Parser crates become part of the desktop dependency surface; upload/retry and server fallback remain separate consumers of the contract.
