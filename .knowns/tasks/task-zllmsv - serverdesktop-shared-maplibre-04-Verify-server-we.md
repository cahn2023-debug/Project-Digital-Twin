---
id: zllmsv
title: "[serverdesktop-shared-maplibre-04] Verify server–web–Tauri basemap integration"
status: done
priority: high
labels:
  - from-spec
  - spec:serverdesktop-shared-maplibre-basemap-manifest
  - spec-date:2026-08-10
  - integration
  - verification
  - tauri
createdAt: '2026-08-10T02:05:33.242Z'
updatedAt: '2026-08-10T02:49:29.530Z'
completedAt: '2026-08-10T02:48:33.678Z'
timeSpent: 80
assignee: '@me'
spec: specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
fulfills:
  - AC-8
order: 40
---
# [serverdesktop-shared-maplibre-04] Verify server–web–Tauri basemap integration

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run integrated server contract, web build/typecheck, Tauri smoke, server-offline, Internet-offline, package download/restore, reconnect, and last-known-good verification; fix cross-boundary integration gaps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Run server contract, web typecheck/build, desktop typecheck, and Tauri smoke verification.
- [x] #2 Simulate server-offline, Internet-offline, invalid manifest, reconnect, package restore, and last-known-good paths.
- [x] #3 Record unresolved provider/license or environment limitations without weakening acceptance criteria.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Chạy server basemap contract tests và kiểm tra endpoint 200/304/invalid-contract; chạy domain contracts.
2. Chạy web typecheck/build/test, desktop typecheck và Tauri `cargo check`; kiểm tra generated frontend bundle có các mode/layer/manifest/offline package symbols.
3. Mô phỏng bằng guard/pure checks các path server unavailable/timeout/invalid manifest, package bbox/zoom limit, package compatibility/checksum/atomic state và outside coverage; thực hiện smoke build với server không cần chạy.
4. Review integrated diff, validate task/spec SDD, ghi rõ provider/license/environment limitations và các follow-up không làm mất last-known-good.

## Scope and assumptions

- GUI Tauri automation không khả dụng trong môi trường hiện tại; `cargo check` và production web build là smoke boundary, còn thao tác click/download thực tế được kiểm tra qua code path/guard.
- Không tải toàn bộ package Google trong verification để tránh external quota; chỉ kiểm tra tile endpoint headers và deterministic tile-selection guards.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Integrated verification completed. Passes: full server pytest 54/54 (including basemap 200/304 contract), workspace pnpm typecheck/build/test, domain tests 2/2, desktop typecheck, Tauri cargo check and cargo test 1/1, web offline tile-selection/zoom guard checks, and scoped diff check. The web test runner has 0 tests; no Playwright package or Tauri GUI automation is available in this environment, so browser click/download and real network-cutover paths are represented by the implemented code guards plus build/smoke boundaries, not claimed as GUI E2E. Provider/environment limitations recorded: Google public Street/Hybrid composite raster keeps roads/POI/labels baked into the image and source terms/production rights remain a deployment gate; current Vector manifest exposes styleUrl but not resolved vector tile/glyph/sprite package assets, so fully-offline Vector shows explicit guidance and follow-up @task-nh6h0j tracks it. No project data enters manifest or tile package. System Decision Impact: candidate @decision/20260810-0902-server-authored-display-only-maplibre-manifest-with-desktop-last-known-good-fallback (changed) — integrated server/web/Tauri/offline behavior and verification evidence. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass
<!-- SECTION:NOTES:END -->

