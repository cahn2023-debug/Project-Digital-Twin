---
id: 20260810-1958-desktop-parser-format-boundary-for-csv-and-legacy-word
title: Desktop parser format boundary for CSV and legacy Word
status: draft
supersedes: []
supersededBy: []
tags:
  - desktop
  - parsing
  - formats
sources:
  - '@doc/specs/2026-08-10/desktop-data-source-folder-ingestion'
  - '@doc/specs/2026-08-10/desktop-parse-before-server-upload'
relatedDocs:
  - specs/2026-08-10/desktop-data-source-folder-ingestion
relatedTasks:
  - fqzovh
verification: []
reviewState: needs_evidence
reviewBlockers:
  - 'linked task "fqzovh" is "in-progress"; all linked tasks must be done before accepting candidate'
reviewMatches: []
reviewAllowedResolutions: []
reviewEvaluatedAt: '2026-08-10T12:58:21.192Z'
createdAt: '2026-08-10T12:58:21.192Z'
updatedAt: '2026-08-10T12:58:21.192Z'
---

## Context

Task fqzovh extends the existing parse-before-upload boundary to formats already accepted by the source scanner but previously unsupported by the desktop/server parser.

## Decision

The desktop parser treats CSV dialect/encoding detection and legacy Word .doc OLE2 reading as explicit parser-boundary responsibilities. Ambiguous CSV scalar/delimiter/encoding results retain source values and emit preview warnings; legacy .doc extraction retains source locators and reports limitations instead of silently dropping content.

## Alternatives Considered

Rely on server parsing only; treat .doc as unsupported; assume comma/UTF-8 CSV silently.

## Consequences

The desktop-core and server parser dependencies include OLE2/encoding readers, parser reports gain explicit warnings, and fixtures must cover .csv, .doc and .docx without modifying source files.
