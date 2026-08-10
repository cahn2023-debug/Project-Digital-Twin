---
id: 20260810-0932-desktop-file-scan-imports-persist-local-results-before-synchronization
title: Desktop FILE_SCAN imports persist local results before synchronization
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - ingestion
  - local-first
  - parser
sources:
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
  - '@task-bnuso1'
  - apps/desktop/manifest.sql
  - apps/server/app/modules/datacenter/router.py
  - apps/web/src/features/datacenter/importWorker.ts
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - bnuso1
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "bnuso1" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T02:32:37.884Z'
createdAt: '2026-08-10T02:32:37.884Z'
updatedAt: '2026-08-10T02:32:37.884Z'
---

## Context

Queued desktop FILE_SCAN work needs a restart-safe boundary between scanned file versions, parser responses, Raw/source locators and server ChangeSets while the app may be offline.

## Decision

Claim source-aware FILE_SCAN jobs from the desktop manifest, register an immutable local file version before parsing, dispatch supported files through the existing server parser boundaries, and transactionally persist the parser response plus Raw/source-locator records locally. Complete the queue job only after local persistence succeeds; retry the same idempotency key on network or parser failure.

## Alternatives Considered

Parse only in the UI without a durable worker; write directly to canonical server state; or enqueue parser results without persisting the local ChangeSet/Raw boundary first.

## Consequences

Offline/restart flows retain file versions, preview/import results and Raw evidence; retries are idempotent and do not apply canonical state before approval. The parser-from-path endpoint assumes the configured local server can access the selected desktop path. This draft is review-gated and is not current automatically.
