---
id: 20260809-1851-desktop-watcher-queues-stable-local-file-scans-idempotently
title: Desktop watcher queues stable local file scans idempotently
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - watcher
  - sync
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
  - docs/adr/ADR-005-sync-concurrency.md
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - trbw1k
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "trbw1k" is "todo"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T11:51:30.347Z'
createdAt: '2026-08-09T11:51:30.347Z'
updatedAt: '2026-08-09T11:51:30.347Z'
---

## Context

Local-first ingestion needs a restart-safe desktop boundary that scans registered directories, waits for stable readable files and preserves retry state.

## Decision

The desktop watcher uses a polling boundary over registered directories, records file observations until size/mtime/hash remain stable for the debounce interval, enqueues FILE_SCAN jobs with a path+SHA idempotency key, and stores bounded retry attempts with visible RETRY/FAILED status. Watcher start/stop is exposed through Tauri commands; canonical ChangeSet application remains downstream.

## Alternatives Considered

Enqueue every filesystem event immediately; rejected because files may still be written. Keep retry state only in memory; rejected because restart would lose work.

## Consequences

Manual scans and automatic watcher scans share the same queue contract, duplicate events are harmless, unreadable files do not abort the whole scan, and transient failures can be retried without losing the source path.
