---
id: 746tlu
title: "[desktop-data-source-folder-ingestion-10] Complete conflict-aware sync and approval"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
createdAt: '2026-08-10T12:45:29.280Z'
updatedAt: '2026-08-10T14:47:29.276Z'
completedAt: '2026-08-10T14:35:52.323Z'
timeSpent: 310
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-11
  - AC-15
order: 100
---
# [desktop-data-source-folder-ingestion-10] Complete conflict-aware sync and approval

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Finish server and outbox handling for explicit ChangeSet approval, server/local conflicts, asset synchronization and bounded idempotent retry while preventing canonical writes before user confirmation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Normalized and asset sync jobs preserve idempotency and retry independently without replaying successful imports.
- [x] #2 Local/server differences produce conflict review with no implicit winner or canonical overwrite.
- [x] #3 Every ChangeSet requires explicit user approval before canonical apply, including Profile-matched files.
- [x] #4 Server responses preserve parse reports, provenance, conflict details and retry history.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Trace normalized/raw fallback endpoints, ChangeSet domain transitions and the existing desktop outbox contract.
2. Add explicit approval/rejection and conflict-review transitions with field/source provenance and no implicit local/server winner.
3. Queue assets and normalized ChangeSets with bounded retry, idempotency and offline replay semantics.
4. Add server/worker tests for conflicts, approval gates, asset retry and duplicate suppression.
5. Run server/web checks, validate linked refs and record D1-D31 compliance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: added idempotent server file-asset sync with version conflict review; local asset metadata creates independent ASSET_SYNC jobs, bounded retry and SYNCED/CONFLICT_REVIEW status; ChangeSet items retain deterministic identity/source locator and parse report; normalized/raw responses retain retry history; all profile-matched imports remain PENDING_APPROVAL until explicit approve/reject. Verification: cargo fmt, cargo test -p desktop-core = 35 passed, cargo check desktop passed; server desktop/doc/API suite = 24 passed; web typecheck passed. System Decision Impact: candidate @decision/20260810-2135-desktop-changeset-and-asset-sync-remain-idempotent-and-review-gated (added) — sync and approval contract is draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
<!-- SECTION:NOTES:END -->

