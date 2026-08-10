---
id: 20260810-2014-desktop-changeset-review-is-append-only-and-approval-gated
title: Desktop ChangeSet review is append-only and approval-gated
status: draft
supersedes: []
supersededBy: []
tags:
  - datacenter
  - changeset
sources:
  - '@task-ho64sc'
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - ho64sc
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "ho64sc" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T13:14:40.220Z'
createdAt: '2026-08-10T13:14:40.220Z'
updatedAt: '2026-08-10T13:14:40.220Z'
---

## Context

Task 08 adds the desktop review contract for source parsing and ChangeSets.

## Decision

Desktop imports expose preview and normalized ChangeSet review before canonical apply; normalized edits target a record identity and field, are retained on the ChangeSet, and emit append-only audit events. Reject leaves source files untouched.

## Alternatives Considered

Editing source files directly or applying profile-matched imports automatically.

## Consequences

Review state can be persisted locally and replayed; approval and rejection remain explicit; the server API must preserve identity, provenance and audit history.
