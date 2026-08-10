---
id: 20260810-1246-desktop-normalized-and-raw-fallback-server-import-contract
title: Desktop normalized and raw-fallback server import contract
status: draft
supersedes: []
supersededBy: []
tags:
  - server
  - desktop-import
  - raw-fallback
  - idempotency
  - conflict
sources:
  - '@doc/specs/2026-08-10/desktop-parse-before-server-upload'
relatedDocs:
  - specs/2026-08-10/desktop-parse-before-server-upload
relatedTasks:
  - drpdus
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "drpdus" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T05:46:26.114Z'
createdAt: '2026-08-10T05:46:26.114Z'
updatedAt: '2026-08-10T05:46:26.114Z'
---

## Context

The desktop parser now emits normalized records or an explicit fallback reason. The server must accept normalized results without reading desktop paths and must process fallback bytes without retaining raw artifacts.

## Decision

Expose per-project desktop import endpoints for normalized payloads and raw fallback. The normalized endpoint creates idempotent ChangeSets from desktop records. The raw fallback endpoint verifies the fingerprint, parses only from a temporary file, deletes the temporary artifact in all outcomes, and returns SERVER_PARSED, FAILED, or CONFLICT_REVIEW. Metadata conflicts stage the ChangeSet and never apply canonical state automatically.

## Alternatives Considered

Keep the existing from-path endpoint as the desktop contract; persist raw uploads for later processing; or let the server silently overwrite metadata mismatches.

## Consequences

Desktop transport no longer depends on server access to a local filesystem path. Server API schemas and ChangeSet status handling become shared compatibility contracts; raw uploads require bounded transport and operational monitoring.
