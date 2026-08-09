---
id: 20260809-2111-project-deletion-uses-tombstones-and-never-mutates-the-user-root-directory
title: Project deletion uses tombstones and never mutates the user root directory
status: draft
supersedes: []
supersededBy: []
tags:
  - project-lifecycle
  - data-safety
  - root-directory
sources:
  - '@doc/specs/2026-08-09/project-create-and-delete-lifecycle'
  - apps/server/app/domain.py
  - apps/server/app/main.py
  - apps/server/tests/test_api.py
relatedDocs:
  - specs/2026-08-09/project-create-and-delete-lifecycle
relatedTasks:
  - lvnfek
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "lvnfek" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T14:11:41.657Z'
createdAt: '2026-08-09T14:11:41.657Z'
updatedAt: '2026-08-09T14:11:41.657Z'
---

## Context


## Decision

Project lifecycle operations are metadata-only: archive changes the project status, permanent deletion creates a DELETED tombstone while retaining project-managed data, and neither operation deletes, moves, renames, or writes inside the user-selected root directory. A deleted root may be associated with a new project identity while the old tombstone remains retained.

## Alternatives Considered


## Consequences
