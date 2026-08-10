---
id: 20260810-2129-desktop-manifest-persists-provenance-and-obtains-db-keys-from-os-keychain
title: Desktop manifest persists provenance and obtains DB keys from OS keychain
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - persistence
  - security
sources:
  - '@task-t9mo1e'
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - t9mo1e
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "t9mo1e" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T14:29:37.463Z'
createdAt: '2026-08-10T14:29:37.463Z'
updatedAt: '2026-08-10T14:29:37.463Z'
---

## Context

Task 09 hardens local-first persistence and source lifecycle for desktop ingestion.

## Decision

Persist local imports, Raw, ChangeSet payloads, assets and append-only audit events transactionally in the desktop manifest; retain those records when a source is archived. The encrypted database passkey is generated/retrieved through the desktop OS keychain, never browser storage.

## Alternatives Considered

Storing import metadata in browser storage, deleting source history on archive, or accepting a caller-provided passkey.

## Consequences

Restart/offline workflows retain provenance and audit evidence; archive only stops watcher and marks source state; keychain availability becomes a desktop prerequisite for encrypted DB initialization.
