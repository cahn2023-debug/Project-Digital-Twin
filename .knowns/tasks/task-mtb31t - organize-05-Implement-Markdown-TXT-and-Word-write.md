---
id: mtb31t
title: "[organize-05] Implement Markdown TXT and Word write-back adapters"
status: done
priority: high
labels:
  - from-spec
  - spec:organize-data-classification-grouping-and-source-management
  - spec-date:2026-08-09
  - markdown
  - txt
  - word
  - write-back
createdAt: '2026-08-09T14:22:01.950Z'
updatedAt: '2026-08-09T15:26:35.836Z'
completedAt: '2026-08-09T15:16:28.888Z'
timeSpent: 300
spec: specs/2026-08-09/organize-data-classification-grouping-and-source-management
fulfills:
  - AC-6
  - AC-7
order: 50
---
# [organize-05] Implement Markdown TXT and Word write-back adapters

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add format-aware Organize write-back adapters for Markdown, TXT and Word. Preserve unmanaged content and source locators, use detectable existing structure, require manual mapping for uncertain structure, and expose preview diffs before confirmation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement format-aware Markdown/TXT/Word planners and serializers that preserve unmanaged content and locators.
- [x] #2 Require manual mapping and block confirmation when structure cannot be detected safely.
- [x] #3 Add representative fixtures/tests for detectable and ambiguous structures plus preview diffs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: Extended the Organize write-back preview boundary with Markdown, TXT and Word format adapters/serializer metadata.
Done: Read-only adapters preserve unmanaged-content/source-locator semantics, report detected structure and source summary, and require per-file manual_mapping for ambiguous TXT/Word/Markdown structure.
Done: Added representative API fixtures/tests for detectable Markdown, ambiguous TXT with/without mapping, Word structure, format mismatch/stale evidence and no-write behavior.
Verification: uv run pytest -q = 34 passed, 1 warning; Python compileall passed; Knowns validation = 0 errors, 0 warnings; git diff --check passed with repository line-ending warnings only.
Review: PASS, P1=0, P2=0. Actual format execution remains scoped to later safety/execute tasks.
System Decision Impact: candidate @decision/20260809-2216-organize-document-previews-use-format-adapters-and-require-mapping-for-uncertain-structure (added) — records format adapter, unmanaged preservation and manual mapping boundary.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass.
Workflow recovery: task was completed and validated before timer start; added a 5m manual entry to preserve execution tracking.
SDD verification marker normalization: Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
Spec Decision Compliance: D18=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass
<!-- SECTION:NOTES:END -->

