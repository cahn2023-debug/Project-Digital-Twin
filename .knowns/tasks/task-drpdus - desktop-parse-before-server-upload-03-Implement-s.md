---
id: drpdus
title: "[desktop-parse-before-server-upload-03] Implement server raw fallback parsing và conflict review"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-parse-before-server-upload
  - spec-date:2026-08-10
  - server
  - raw-fallback
  - conflict
createdAt: '2026-08-10T05:23:07.319Z'
updatedAt: '2026-08-10T06:10:33.926Z'
completedAt: '2026-08-10T05:46:58.545Z'
timeSpent: 401
assignee: '@me'
spec: specs/2026-08-10/desktop-parse-before-server-upload
fulfills:
  - AC-2
  - AC-10
  - AC-11
order: 20
---
# [desktop-parse-before-server-upload-03] Implement server raw fallback parsing và conflict review

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Thêm contract/server flow nhận raw fallback theo từng file, trả kết quả parsing chi tiết, xóa raw tạm sau khi có kết quả, phát hiện mismatch với metadata/kết quả dự kiến và đưa dữ liệu vào CONFLICT_REVIEW trước canonical commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement or extend the server raw-fallback contract with per-file result states and diagnostics.
- [x] #2 Delete temporary raw artifacts after parsing while retaining metadata and parse report.
- [x] #3 Stage parser-result mismatches as CONFLICT_REVIEW and test canonical-commit blocking.
- [x] #4 Provide a normalized desktop-import endpoint that accepts the ijh7t3 result contract for tabular and document records.
- [x] #5 Provide a raw-fallback endpoint with per-file idempotency, source-hash verification and SERVER_PARSED/FAILED/CONFLICT_REVIEW outcomes.
- [x] #6 Use temporary server storage for raw bytes and delete it in all success/failure paths while retaining metadata and parse report.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Add server request models in `apps/server/app/shared/schemas.py` for the `ijh7t3` normalized result and raw fallback envelope: file identity/revision, fingerprint, format/profile/parser metadata, parse report, normalized records, fallback reason, raw content and idempotency key.
2. Add a normalized desktop-import route in `apps/server/app/modules/datacenter/router.py` that accepts already parsed tabular and document records, reuses existing ChangeSet/idempotency persistence, preserves source locators/unmapped data, and never reads a desktop path.
3. Add a raw-fallback route that verifies the declared fingerprint, writes the received bytes only to a temporary file with the correct suffix, invokes the existing Excel/document parsers, and deletes the temporary artifact in a `finally` path.
4. Map every raw-fallback outcome to an explicit per-file response: `SERVER_PARSED` with changeset/result, `FAILED` with actionable diagnostics, or `CONFLICT_REVIEW` when source hash/format/profile metadata disagrees. Conflict outcomes must not apply canonical state and must remain reviewable through the existing ChangeSet flow.
5. Preserve idempotency across normalized and raw requests using the supplied idempotency key plus file identity/fingerprint; repeated requests return the existing outcome without creating duplicate ChangeSets.
6. Add API/domain tests for normalized XLSX/document payloads, raw fallback success/failure, temporary-artifact cleanup, hash mismatch conflict staging, metadata mismatch, and duplicate retries.
7. Verify with the server test suite, focused desktop-import tests, diff checks, Knowns task validation, and a review of the route contract for compatibility with the next worker task `r3nkb7`.

### Plan check

- Task AC-2 is covered by steps 1, 3, 4 and 6.
- Task AC-10 is covered by steps 3, 4 and 6.
- Task AC-11 is covered by steps 4 and 6.
- The normalized endpoint is included because `r3nkb7` must upload the local parser result without sending a source path.
- No circular dependency: `r3nkb7` consumes these routes after this task; `dt5dz4` owns durable report/history queries.

### Spec Decision Compliance

D1=pass, D2=pass, D3=pass, D4=pass, D5=pass (worker-owned), D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dependency refinement: define server normalized/raw fallback contract before worker integration task r3nkb7.
Using kn-flow: ownership taken; planning started after local parser contract ijh7t3.
Plan saved: normalized desktop-import and raw-fallback server contracts precede worker transport integration.
Done: Added /desktop-imports/normalized and /desktop-imports/raw-fallback contracts. Normalized imports create idempotent ChangeSets from desktop records; fallback verifies SHA-256, parses temporary raw files, deletes temp artifacts, returns SERVER_PARSED/FAILED/CONFLICT_REVIEW, and stages metadata mismatches without canonical apply. Added document source-name preservation after temp cleanup and conflict audit event. Verification: focused desktop import tests = 5 passed; full server suite = 68 passed; Python compileall passed; git diff --check passed. Review: PASS, P1=0, P2=0, P3=0. System Decision Impact: candidate @decision/20260810-1246-desktop-normalized-and-raw-fallback-server-import-contract (added) — durable server endpoint/status/idempotency/temp-raw contract; draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
Flow audit: implementation AC #4 normalized endpoint, AC #5 raw-fallback/idempotency/status contract, and AC #6 temporary-storage cleanup/provenance are verified by the focused and full server suites. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass
<!-- SECTION:NOTES:END -->

