---
id: 20260809-2223-organize-execution-queues-confirmed-plans-with-rechecked-locks-versions-backup-and-self-write-provenance
title: Organize execution queues confirmed plans with rechecked locks, versions, backup and self-write provenance
status: draft
supersedes: []
supersededBy: []
tags:
  - organize
  - write-back
  - safety
  - restore
  - self-write
  - batch
sources:
  - '@doc/specs/2026-08-09/organize-data-classification-grouping-and-source-management'
relatedDocs:
  - specs/2026-08-09/organize-data-classification-grouping-and-source-management
relatedTasks:
  - bl6p7t
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "bl6p7t" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T15:23:42.903Z'
createdAt: '2026-08-09T15:23:42.903Z'
updatedAt: '2026-08-09T15:23:42.903Z'
---

## Context

A preview is not sufficient for source-file mutation. Organize execution must require editor confirmation, revalidate the source immediately before queueing/completing jobs, coordinate batch locks, preserve immutable file versions and prevent self-generated changes from re-entering import.

## Decision

Organize execution accepts only a PREVIEW plan with can_confirm=true and confirmed=true. It rechecks project-scoped file ownership, revision/hash and active locks before creating safety-enforced per-file jobs; ALL_OR_NOTHING fails preflight without creating any job. Completion requires confirmation, current revision/hash and an in-place backup, registers a new immutable version, releases the lock and records the result hash as self-write provenance. Restore creates a new safety-enforced RESTORE job/ChangeSet/version, and import boundaries suppress matching self-write hashes with audit evidence.

## Alternatives Considered

- Confirm directly against the old preview without rechecking: rejected because the source can become stale between preview and confirmation.
- Let each worker manage locks independently: rejected because the API must prevent duplicate jobs and batch partial queueing.
- Re-import self-generated hashes: rejected because watcher/import would enqueue duplicate Changesets.

## Consequences

- Workers receive explicit destination, expected version/hash, plan and batch metadata.
- Failed or conflicted jobs release locks and remain auditable; historical versions are not mutated.
- The current in-memory implementation preserves the existing worker-completion boundary until the production repository/worker tasks replace it.
