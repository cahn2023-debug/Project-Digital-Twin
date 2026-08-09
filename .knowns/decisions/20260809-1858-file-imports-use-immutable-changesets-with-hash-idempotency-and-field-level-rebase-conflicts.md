---
id: 20260809-1858-file-imports-use-immutable-changesets-with-hash-idempotency-and-field-level-rebase-conflicts
title: File imports use immutable ChangeSets with hash idempotency and field-level rebase conflicts
status: draft
supersedes: []
supersededBy: []
tags:
  - local-file-ingestion
  - changeset
  - idempotency
  - conflict-resolution
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - 1feoxs
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "1feoxs" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T11:58:46.972Z'
createdAt: '2026-08-09T11:58:46.972Z'
updatedAt: '2026-08-09T11:58:46.972Z'
---

## Context

File ingestion can contain valid, invalid and unmapped rows while the canonical store may change between preview and approval. The import boundary needs replay-safe identity and an explicit review state.

## Decision

Every file import creates an explicit FILE_IMPORT ChangeSet before canonical mutation. Raw rows and validation results remain attached to that ChangeSet; duplicate processing is recognized by file_id, file revision and SHA-256 (with a deterministic row fingerprint fallback); approval rebases non-overlapping fields and returns base/server/local values for conflicts, leaving canonical state unchanged when a conflict remains unresolved.

## Alternatives Considered

Mutate canonical data during preview; deduplicate only by caller idempotency key; reject every stale revision without field-level rebase.

## Consequences

Import retries remain observable and safe across different queue keys, users can review unresolved fields with provenance, and later audit/sync layers can consume a stable ChangeSet boundary. The in-memory implementation remains a foundation until the persistent server adapter is integrated.
