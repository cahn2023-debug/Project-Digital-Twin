---
id: 20260809-1843-excel-ingestion-uses-immutable-versioned-profiles-and-scan-results
title: Excel ingestion uses immutable versioned Profiles and scan results
status: draft
supersedes: []
supersededBy: []
tags:
  - excel
  - profiles
  - provenance
sources:
  - '@doc/specs/2026-08-09/local-file-ingestion-and-synchronization'
  - docs/adr/ADR-002-file-authority.md
relatedDocs:
  - specs/2026-08-09/local-file-ingestion-and-synchronization
relatedTasks:
  - own4rr
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "own4rr" is "todo"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-09T11:43:44.960Z'
createdAt: '2026-08-09T11:43:44.960Z'
updatedAt: '2026-08-09T11:43:44.960Z'
---

## Context

Messy workbooks require reusable structural interpretation for visible sheets, multiple regions, merged headers/data, formula provenance and confirmed skip rules.

## Decision

Excel ingestion exposes a deterministic scan result for visible sheets and table regions, propagates merged values while retaining source coordinates/formulas, and persists user-confirmed WorkbookProfile versions as immutable JSON records. A matching Profile is reused automatically; unknown structures remain preview candidates until the user confirms headers, regions and skip patterns.

## Alternatives Considered

Assume a fixed CAMERA sheet and first-row header; rejected because project workbooks are structurally irregular. Mutate one Profile in place; rejected because historical imports would no longer be reproducible.

## Consequences

The mapping and ChangeSet tasks can consume stable scan/profile output without reparsing a workbook differently. Profile versions can reproduce prior imports and hidden sheets remain excluded by contract.
