---
id: 99f71h
title: "[serverdesktop-shared-maplibre-02] Sync manifest in web and desktop with last-known-good fallback"
status: done
priority: high
labels:
  - from-spec
  - spec:serverdesktop-shared-maplibre-basemap-manifest
  - spec-date:2026-08-10
  - web
  - desktop
  - manifest
  - fallback
createdAt: '2026-08-10T02:05:33.124Z'
updatedAt: '2026-08-10T02:49:24.696Z'
completedAt: '2026-08-10T02:46:15.829Z'
timeSpent: 1577
assignee: '@me'
spec: specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
fulfills:
  - AC-2
  - AC-3
  - AC-6
  - AC-7
order: 20
---
# [serverdesktop-shared-maplibre-02] Sync manifest in web and desktop with last-known-good fallback

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the shared manifest client adapter for the web/Tauri frontend, conditional ETag/Last-Modified refresh, local last-known-good persistence, startup/reconnect timeout behavior, invalid-manifest fallback, and integration with the current MapLibre DESIGN UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Load and validate the manifest from server or local last-known-good cache.
- [x] #2 Use ETag/Last-Modified refresh with startup/reconnect timeout fallback.
- [x] #3 Wire the current DESIGN MapLibre controls to manifest-defined modes and layer groups.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Hoàn thiện adapter manifest phía client trong `apps/web/src/features/design/mapConfig.ts`: validate schema/mode/layer/source, đọc và ghi cache last-known-good, gửi ETag/Last-Modified conditional request, timeout và fallback theo thứ tự server → cache → bundled.
2. Đồng bộ `apps/web/src/features/design/DesignView.tsx` với manifest: refresh lúc startup/reconnect/interval, remount map khi manifest hợp lệ mới active, dùng cùng mode/layer groups và giữ trạng thái bật/tắt layer ở DESIGN.
3. Review diff thực tế và sửa các lỗi P1/P2; không đưa project data vào basemap state.
4. Chạy web typecheck, production build, test script và diff check; validate task trước khi hoàn tất.

## Scope and assumptions

- Tauri hiện tải cùng web frontend, nên localStorage là cache runtime dùng chung cho web/desktop trong phạm vi task này; native regional tile storage thuộc task 03.
- Manifest mới chỉ active sau khi validate; 304 tiếp tục dùng cache; timeout/offline không chặn DESIGN.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: client manifest adapter validates schema, mode/source compatibility, public HTTPS tile/style URLs, layer/package metadata, and ISO timestamps; sends ETag/Last-Modified conditionals with a timeout covering response body parsing; persists an atomic last-known-good cache record and falls back server → cache → bundled. DESIGN now refreshes startup/reconnect/interval, uses manifest modes/layers/attribution, applies manifest default visibility, remounts safely on manifest/runtime changes, and exposes online/offline state. Review: PASS with no P1 after fixing source-kind validation, longest-matching layer routing, timeout body fallback, default visibility refresh, and manifest attribution. Provider limitation deferred to review follow-up @task-nh6h0j: Google composite raster details cannot be independently split into MapLibre layers. Verification: web typecheck/build pass; web test runner pass with 0 tests; scoped diff check clean. System Decision Impact: candidate @decision/20260810-0902-server-authored-display-only-maplibre-manifest-with-desktop-last-known-good-fallback (changed) — completes client enforcement and last-known-good behavior for the shared manifest. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass
<!-- SECTION:NOTES:END -->

