---
id: epi5h5
title: "[local-file-ingestion-03] Implement schema mapping, transformations, identity and validation"
status: done
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - mapping
  - schema
createdAt: '2026-08-09T10:50:29.427Z'
updatedAt: '2026-08-09T12:27:49.619Z'
completedAt: '2026-08-09T11:46:31.616Z'
timeSpent: 10
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-6
  - AC-7
  - AC-8
  - AC-9
order: 30
---
# [local-file-ingestion-03] Implement schema mapping, transformations, identity and validation

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement object/field mapping, schema field UUIDs, inferred custom fields, basic and Profile transformations, row UUIDs, cross-file identity suggestions and per-field validation results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map standard/custom fields and object types with stable schema field UUIDs and inferred custom field types.
- [x] #2 Run preview transformations and reusable Profile transformation rules deterministically.
- [x] #3 Generate row UUIDs, show cross-file identity candidates and report row/field validation results without discarding Raw.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add schema field and mapping contracts in packages/domain/src/index.ts and apps/server/app/domain.py for standard/custom fields, field UUIDs, inferred types, object-type selection and row UUIDs.
2. Implement mapping resolution over the task-02 preview model: one object type per table or classification by source column, basic split/merge/normalization transforms and deterministic Profile-defined rules.
3. Implement cross-file identity candidates using object type, normalized name, parent/group context and location; preserve ambiguous candidates for user confirmation instead of assigning silently.
4. Return field-level validation results and keep the complete source payload/locator in Raw for invalid, skipped and unmapped values.
5. Add focused TypeScript/Python tests for field UUID stability, type inference, transformations, duplicate candidates, ambiguous matches and per-field validation; run package tests/typechecks, pytest, Knowns validation and git diff --check.

## Dependencies and scope

- Depends on local-file-ingestion-01 and 02.
- Defines mapping output consumed by ChangeSet import; it does not apply canonical mutations.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task created from approved spec; implementation plan and verification will be added before execution.
Full-wave planning pass: plan saved before implementation and baseline commit.
Done: added typed schema/mapping contracts, deterministic transforms, inferred custom field types, per-field validation, Raw/unmapped preservation and ranked identity candidates requiring confirmation. Verification: apps/server .venv pytest 13 passed (1 existing httpx/Starlette deprecation warning); corepack pnpm domain typecheck passed; domain test 1 passed; Knowns validation passed; git diff check clean aside line-ending warnings. Review: PASS, no P1/P2/P3 findings. System Decision Impact: candidate @decision/20260809-1846-schema-fields-and-mapping-transforms-are-explicit-and-reviewable (added) — establishes explicit typed mapping and identity review boundaries. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.

Spec Decision Compliance: D52=pass

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass
<!-- SECTION:NOTES:END -->

