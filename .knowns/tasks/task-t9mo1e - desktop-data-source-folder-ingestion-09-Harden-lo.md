---
id: t9mo1e
title: "[desktop-data-source-folder-ingestion-09] Harden local persistence, assets, audit and source archive"
status: done
priority: high
labels:
  - from-spec
  - spec:desktop-data-source-folder-ingestion
  - spec-date:2026-08-10
createdAt: '2026-08-10T12:45:28.829Z'
updatedAt: '2026-08-10T14:47:25.954Z'
completedAt: '2026-08-10T14:30:03.823Z'
timeSpent: 4453
assignee: '@me'
spec: specs/2026-08-10/desktop-data-source-folder-ingestion
fulfills:
  - AC-11
  - AC-13
  - AC-16
  - AC-17
order: 90
---
# [desktop-data-source-folder-ingestion-09] Harden local persistence, assets, audit and source archive

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete the encrypted local-first persistence boundary for Raw, ChangeSets, assets, audit and history; use OS keychain credentials, retain Raw until explicit archive/delete, and archive sources without losing provenance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Raw, ChangeSets, assets, audit and pending jobs persist transactionally across restart/offline.
- [x] #2 Local encryption obtains its key through the desktop OS keychain/credential store and never browser local storage.
- [x] #3 Source archive stops its watcher, prevents duplicate registration and retains historical provenance/Raw/assets.
- [x] #4 Append-only audit events include actor, time, source/file/hash, outcome and correlation ID.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Audit the existing ManifestDb/Tauri persistence and key management boundary against the SQLCipher/OS-keychain contract.
2. Add transactional asset, audit and retention/archive records with project/source/file provenance and append-only semantics.
3. Wire source archive, duplicate normalized-path handling and watcher shutdown into the local source lifecycle.
4. Add restart/offline, retention, archive, keychain-boundary and audit tests without storing business data in browser storage.
5. Run desktop-core/Tauri checks, validate the task and record the System Decision Impact marker.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: local manifest now transactionally persists Raw, ChangeSet/history payloads, assets and append-only audit metadata; archive marks source ARCHIVED, disables watcher and preserves provenance; Tauri exposes archive command and UI action; encrypted DB initialization retrieves/generates passkey through OS keychain via keyring and no longer accepts browser/caller secret. Verification: cargo fmt, cargo test -p desktop-core = 35 passed, cargo check -p project-digital-twin-desktop passed; focused server pytest = 10 passed; web typecheck/build passed; Python compileall passed. System Decision Impact: candidate @decision/20260810-2129-desktop-manifest-persists-provenance-and-obtains-db-keys-from-os-keychain (added) — local persistence/archive/keychain boundary is draft review-gated. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass
<!-- SECTION:NOTES:END -->

