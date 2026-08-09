---
id: 20260809-1911-excel-write-back-uses-confirmed-atomic-jobs-with-immutable-versions-and-self-write-provenance
title: Excel write-back uses confirmed atomic jobs with immutable versions and self-write provenance
status: draft
supersedes: []
supersededBy: []
tags:
  - local-file-ingestion
  - excel
  - write-back
  - versioning
  - self-write
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - 5h1gqr
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "5h1gqr" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T12:11:12.345Z'
createdAt: '2026-08-09T12:11:12.345Z'
updatedAt: '2026-08-09T12:11:12.345Z'
---

## Context

Managed workbook write-back can overwrite user files and watcher events can reappear as imports. The write path needs explicit approval, stale/lock protection, backups, reproducible versions and event suppression.

## Decision

Excel write-back is executed only from a confirmed write job after expected hash/lock checks. The writer preserves unmanaged workbook content, creates a backup, validates a same-directory temporary workbook and atomically replaces the source where the platform permits; every successful result registers a new immutable file version and self-write marker. Restore is represented by a new RESTORE ChangeSet/write job targeting a prior version, so history is never mutated and the resulting watcher event is suppressed by provenance.

## Alternatives Considered

Write directly during preview; overwrite without a source hash or backup; restore by deleting/replacing historical versions; let watcher re-import every software-generated write.

## Consequences

User confirmation and stale/locked failures are explicit, unmanaged sheets/columns survive round trips, local/server version histories can converge, and software writes remain auditable without duplicate imports. Windows file providers that reject atomic replacement use the guarded compatibility fallback after the atomic API fails.
