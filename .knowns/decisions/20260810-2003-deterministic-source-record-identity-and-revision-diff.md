---
id: 20260810-2003-deterministic-source-record-identity-and-revision-diff
title: Deterministic source record identity and revision diff
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - identity
  - revisions
sources:
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - hc5m2d
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "hc5m2d" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T13:03:32.224Z'
createdAt: '2026-08-10T13:03:32.224Z'
updatedAt: '2026-08-10T13:03:32.224Z'
---

## Context

The original worker used row-index raw keys and the server mapping boundary generated UUIDs, which could duplicate records after repeated parses.

## Decision

Source records use a stable source key when available; otherwise identity is derived deterministically from Project/source/file provenance and source locator. Each file revision is reparsed and represented by an identity-based diff retained with local import history for review and rollback.

## Alternatives Considered

Generate a UUID per parse; use row number only; diff only changed rows.

## Consequences

Normalized parse records carry an identity, raw row keys reuse it, revision diff metadata is persisted in local payload/parse reports, and profile/schema versions remain immutable.
