---
id: 20260810-0823-sqlcipher-encrypted-local-storage-engine-for-desktop
title: SQLCipher Encrypted Local Storage Engine for Desktop
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - security
  - sqlite
sources: []
relatedDocs:
  - specs/2026-08-10/offline-desktop-server-sync
relatedTasks:
  - y3uif4
verification: []
reviewState: needs_evidence
reviewBlockers:
  - candidate needs at least one source before acceptance
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T01:23:22.399Z'
createdAt: '2026-08-10T01:23:22.399Z'
updatedAt: '2026-08-10T01:23:22.399Z'
---

## Context


## Decision

All desktop local storage (credentials, mutation events, sync checkpoints) must be stored in an encrypted SQLite database managed by desktop-core with OS Keyring key derivation and zero-knowledge payload encryption.

## Alternatives Considered


## Consequences
