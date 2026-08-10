---
id: 20260810-0906-desktop-sources-use-stable-registrations-with-independent-watchers
title: Desktop sources use stable registrations with independent watchers
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - ingestion
  - source-registration
  - watcher
sources:
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
  - '@task-i3beyy'
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - i3beyy
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "i3beyy" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T02:06:04.510Z'
createdAt: '2026-08-10T02:06:04.510Z'
updatedAt: '2026-08-10T02:06:04.510Z'
---

## Context

The desktop ingestion flow needs multiple persistent source directories per Project while preserving stable file identity, idempotent scan jobs and restart-safe watcher behavior.

## Decision

Persist each source registration by a stable identifier derived from project and normalized directory. Keep source status/watcher configuration in the local manifest, include source identity in new FILE_SCAN payloads/idempotency keys, and run watcher stop flags independently per source. Keep the legacy single-directory scan/watcher commands as compatibility wrappers.

## Alternatives Considered

Use one global watcher and infer source from file path; or keep directory selection as a one-time non-persistent scan.

## Consequences

The desktop UI and future import worker can list and address sources explicitly, duplicate scans remain source-scoped, and watcher lifecycle can be controlled without stopping unrelated sources. The draft remains review-gated and does not become current automatically.
