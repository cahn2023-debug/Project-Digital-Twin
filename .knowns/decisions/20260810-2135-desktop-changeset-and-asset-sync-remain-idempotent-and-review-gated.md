---
id: 20260810-2135-desktop-changeset-and-asset-sync-remain-idempotent-and-review-gated
title: Desktop ChangeSet and asset sync remain idempotent and review-gated
status: draft
supersedes: []
supersededBy: []
tags:
  - sync
  - changeset
  - conflict
sources:
  - '@task-746tlu'
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - 746tlu
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "746tlu" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T14:35:01.419Z'
createdAt: '2026-08-10T14:35:01.419Z'
updatedAt: '2026-08-10T14:35:01.419Z'
---

## Context

Task 10 closes the server/outbox boundary for normalized imports and document assets.

## Decision

Every normalized import creates a pending ChangeSet and preserves parse report, record identity, source locator, conflict details and retry history until explicit approval or rejection. Asset synchronization uses a separate idempotent pending job keyed by asset identity/version; a different payload for an existing version becomes conflict review without overwrite.

## Alternatives Considered

Applying profile-matched imports automatically, replaying all assets with every retry, or silently choosing local/server content on conflict.

## Consequences

Successful ChangeSets and asset jobs are not replayed; offline retry is bounded and independent; conflict review remains visible to the user and cannot mutate canonical state implicitly.
