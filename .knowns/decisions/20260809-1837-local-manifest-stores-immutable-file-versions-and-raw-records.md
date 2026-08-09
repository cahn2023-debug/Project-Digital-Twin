---
id: 20260809-1837-local-manifest-stores-immutable-file-versions-and-raw-records
title: Local manifest stores immutable file versions and Raw records
status: draft
supersedes: []
supersededBy: []
tags:
  - local-files
  - provenance
  - storage
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
  - docs/adr/ADR-002-file-authority.md
  - docs/adr/ADR-008-storage-retention.md
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - qzkm2k
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "qzkm2k" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T11:37:09.361Z'
createdAt: '2026-08-09T11:37:09.361Z'
updatedAt: '2026-08-09T11:37:09.361Z'
---

## Context

The desktop local-first ingestion flow needs stable logical file identity, deduplicated immutable versions and provenance-preserving local storage before parsing, sync and write-back can run.

## Decision

The local manifest keeps logical file identity separate from physical path. Each new file content is recorded once per file_id and SHA-256 in file_versions with a monotonic revision, and Raw rows are stored under a file version with serialized source-locator evidence. Local cleanup is allowed only after server acknowledgement and keeps the latest local version; historical server retention remains governed by the approved file-authority and retention ADRs.

## Alternatives Considered

Keep only a mutable hash cache and current path; rejected because it cannot reproduce imports or preserve source evidence. Store Raw without a file-version link; rejected because provenance and retention would be ambiguous.

## Consequences

Watcher, parser, sync and write-back tasks consume the same file-version and Raw provenance boundary. Duplicate hashes do not create duplicate imports, moved paths do not change logical identity, and source evidence remains queryable for later ChangeSets and audit.
