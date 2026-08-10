---
id: 20260810-2145-desktop-ingestion-jobs-expose-per-file-progress-and-cancellation
title: Desktop ingestion jobs expose per-file progress and cancellation
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - jobs
  - cancellation
sources:
  - '@task-724y4b'
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - 724y4b
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "724y4b" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T14:45:11.173Z'
createdAt: '2026-08-10T14:45:11.173Z'
updatedAt: '2026-08-10T14:45:11.173Z'
---

## Context

Task 11 adds background observability and isolation to desktop folder ingestion.

## Decision

Each queued file/asset job persists source/file identity, status, phase, progress, retry error and cancellation state in the local manifest. Cancellation is scoped to the selected job and checked before upload; locked/permission failures remain retryable per file while other source jobs continue.

## Alternatives Considered

Blocking the UI on batch work, cancelling an entire source, or treating locked files as a batch-fatal error.

## Consequences

The desktop can display and cancel independent work; job schema migrations are required for existing manifests; worker checkpoints prevent cancelled files from reaching the server.
