---
id: 20260810-0942-desktop-source-preview-mapping-creates-immutable-local-profile-versions
title: Desktop source preview mapping creates immutable local profile versions
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - ingestion
  - preview
  - mapping
  - profile
sources:
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
  - '@task-aobrj5'
  - apps/server/app/modules/datacenter/router.py
  - crates/desktop-core/src/manifest.rs
  - apps/web/src/features/datacenter/SourceManagement.tsx
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - aobrj5
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "aobrj5" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T02:42:14.256Z'
createdAt: '2026-08-10T02:42:14.256Z'
updatedAt: '2026-08-10T02:42:14.256Z'
---

## Context

Unknown workbook structures need a user-confirmed mapping while preserving candidate headers, rows and validation issues without applying canonical state.

## Decision

Persist each confirmed workbook mapping as an immutable (profile_id, version) record in the desktop local manifest. Send the confirmed profile to the existing parser boundary, replace the preview import result with the file-specific pending-approval ChangeSet only after parsing succeeds, and retain invalid/unmapped Raw evidence.

## Alternatives Considered

Apply inferred headers automatically; mutate an existing profile in place; or discard preview data after mapping confirmation.

## Consequences

Mapping is auditable and restart-safe, files with independent errors remain visible, and canonical state still requires ChangeSet approval. The current UI exposes camera code/name mapping and the server merges those aliases with the existing camera profile defaults. This draft is review-gated and is not current automatically.
