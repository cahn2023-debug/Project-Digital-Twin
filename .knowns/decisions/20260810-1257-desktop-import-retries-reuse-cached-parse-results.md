---
id: 20260810-1257-desktop-import-retries-reuse-cached-parse-results
title: Desktop import retries reuse cached parse results
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - retry
  - outbox
  - idempotency
  - offline
sources:
  - '@doc/specs/2026-08-10/desktop-parse-before-server-upload'
relatedDocs:
  - specs/2026-08-10/desktop-parse-before-server-upload
relatedTasks:
  - r3nkb7
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "r3nkb7" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T05:57:22.046Z'
createdAt: '2026-08-10T05:57:22.046Z'
updatedAt: '2026-08-10T05:57:22.046Z'
---

## Context

Per-file parsing and upload are separate steps, and network failure can occur after local parsing. Manual retry must not reparse an unchanged file or create duplicate pending jobs.

## Decision

Persist the desktop parse result under the stable file-version/fingerprint import identity before upload. Worker retries reuse that cached result, while the manifest requeue operation resets the existing FILE_SCAN job and preserves its idempotency key. Manual UI retry operates on one file only.

## Alternatives Considered

Reparse on every retry; scan the entire source again; or create a new idempotency key for every manual retry.

## Consequences

Reconnects avoid repeated parsing and maintain deterministic payloads; local import records now contain parser and transport states. Failed jobs can be explicitly requeued without changing file identity.
