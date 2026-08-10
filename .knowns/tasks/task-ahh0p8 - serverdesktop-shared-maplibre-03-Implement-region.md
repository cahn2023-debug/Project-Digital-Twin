---
id: ahh0p8
title: "[serverdesktop-shared-maplibre-03] Implement regional offline tile packages"
status: done
priority: high
labels:
  - from-spec
  - spec:serverdesktop-shared-maplibre-basemap-manifest
  - spec-date:2026-08-10
  - desktop
  - offline
  - tiles
  - package
createdAt: '2026-08-10T02:05:33.176Z'
updatedAt: '2026-08-10T02:49:27.061Z'
completedAt: '2026-08-10T02:46:37.773Z'
timeSpent: 1197
assignee: '@me'
spec: specs/2026-08-10/serverdesktop-shared-maplibre-basemap-manifest
fulfills:
  - AC-4
  - AC-5
  - AC-6
order: 30
---
# [serverdesktop-shared-maplibre-03] Implement regional offline tile packages

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement desktop tile-package selection and download for user-selected regions and zoom ranges, direct public tile acquisition from the manifest, local metadata/checksum/atomic persistence, fully-offline MapLibre loading, and outside-coverage empty-state guidance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Select and document a tile-package format without putting project data in the package.
- [x] #2 Download and persist selected region/zoom packages with metadata, checksum, and atomic replacement.
- [x] #3 Render local coverage offline and show an explicit outside-coverage empty state.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Tạo `apps/web/src/features/design/offlineBasemap.ts` với format package `indexeddb-raster-tiles`: metadata display-only, tile blobs, checksum SHA-256, phạm vi bounding box/zoom, trạng thái staging/active và giao thức `pp-offline://` cho MapLibre.
2. Tạo UI chọn bounding box và zoom range trong DESIGN; tải tile trực tiếp từ source raster của manifest, hiển thị tiến độ/hủy/lỗi, cập nhật package cùng mode và giữ package active cũ khi package mới lỗi hoặc bị hủy.
3. Tích hợp MapLibre dùng package local khi desktop offline, style nền cục bộ không phụ thuộc server; khi viewport ngoài coverage hiển thị empty state/hướng dẫn tải thêm, khi online trở lại dùng public source.
4. Thêm kiểm tra giới hạn vùng/zoom, giới hạn số tile, atomic activation và metadata không chứa project entities; chạy web typecheck/build/test, diff check và validate task.

## Scope and assumptions

- Chọn format IndexedDB raw raster tiles vì Tauri đang tải cùng web frontend và MapLibre GL JS có custom protocol; không thêm dependency PMTiles/MBTiles.
- Package được tạo cho Street hoặc Hybrid vì manifest hiện chỉ cung cấp URL tile trực tiếp cho hai mode; Vector style không bị giả vờ là fully-offline và UI nêu rõ giới hạn nguồn.
- Dữ liệu package chỉ gồm tile bytes và metadata nguồn/vùng/zoom/checksum; không đọc hoặc ghi project manifest/entity data.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: selected package format `indexeddb-raster-tiles-v1` in the Tauri webview IndexedDB, with display-only metadata (manifestVersion, mode, source templates, bbox, zoom, tile count, size, timestamps, checksum) and no project entities. Directly downloads public raster tiles from the active manifest, reports progress, supports cancel, stores tiles under staging, atomically activates the completed package, archives the prior package, validates checksum/source/manifest compatibility on restore, and cleans stale staging records. MapLibre uses `pp-offline://` for Street/Hybrid when offline, returns to public sources online, and shows explicit outside-coverage/no-package/Vector-source guidance. Review: PASS with warnings, no P1; provider follow-up @task-nh6h0j covers composite Google raster layer limitations and Vector style/glyph/sprite offline support not exposed by the current manifest. Verification: web typecheck/build pass; web test runner pass with 0 tests; pure tile-selection guard checks pass; server manifest pytest 3 passed; domain typecheck/build/test passed; desktop typecheck and Tauri cargo check passed; scoped diff check clean. System Decision Impact: candidate @decision/20260810-0902-server-authored-display-only-maplibre-manifest-with-desktop-last-known-good-fallback (changed) — adds atomic desktop-local tile package lifecycle under the shared display-only manifest. Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.

Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass
<!-- SECTION:NOTES:END -->

