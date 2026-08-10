---
id: 20260810-1305-desktop-local-import-history-is-append-only-and-project-scoped
title: Desktop local import history is append-only and project-scoped
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - audit
  - provenance
  - retry
  - import-history
sources:
  - '@doc/specs/2026-08-10/desktop-parse-before-server-upload'
relatedDocs:
  - specs/2026-08-10/desktop-parse-before-server-upload
relatedTasks:
  - dt5dz4
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "dt5dz4" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T06:05:06.387Z'
createdAt: '2026-08-10T06:05:06.387Z'
updatedAt: '2026-08-10T06:05:06.387Z'
---

## Context

The desktop parse-before-upload lifecycle needs project-lifetime auditability for parser reports, warnings/errors, fallback reasons, server outcomes, retries, and final file status. The existing local_imports table is a latest-state projection and cannot by itself preserve prior attempts or survive queries that need the full retry timeline.

## Decision

Keep local_imports as the latest local import projection and append one immutable row to local_import_history for every stored import result. Scope history queries by project and optionally import identity, retain the file-version identity, attempt, status, payload/report, and timestamp, and expose the query through the desktop boundary.

## Alternatives Considered

Overwrite the latest row only; store history only on the server; or derive retry history from pending jobs. These alternatives lose local/offline provenance or cannot represent completed attempts after job cleanup.

## Consequences

Project-scoped audit and reconciliation can inspect every local attempt after restart, while the UI can continue reading the latest projection. The history table is additive and does not require destructive migration; callers must supply the current attempt number.
