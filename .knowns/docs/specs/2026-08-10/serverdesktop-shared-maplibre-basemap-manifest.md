---
title: Server–desktop shared MapLibre basemap manifest
description: Specification for a shared display-only MapLibre basemap manifest with online, server-offline, and fully-offline desktop behavior.
createdAt: '2026-08-10T02:01:52.697Z'
updatedAt: '2026-08-10T02:50:37.236Z'
tags:
  - spec
  - approved
  - maplibre
  - desktop
  - server
  - offline
  - manifest
---

## Overview

Đồng nhất bản đồ nền MapLibre giữa server và app desktop bằng một manifest dùng chung. Server là nguồn phát hành manifest; desktop dùng manifest đó để hiển thị bản đồ nền, điều khiển style/layer và tải tile package theo vùng/zoom. Khi server hoặc Internet không khả dụng, desktop vẫn hoạt động với manifest, tile package và trạng thái `last-known-good` đã lưu cục bộ.

Phạm vi chỉ là hiển thị bản đồ nền. Manifest và tile package không chứa Camera, Intersection, Fiber hoặc dữ liệu dự án.

Liên quan:
- @doc/specs/2026-08-09/maplibre-basemap-for-design
- @doc/specs/2026-08-10/offline-desktop-server-sync

## Locked Decisions

- D1: Server và desktop dùng chung một manifest MapLibre. Desktop lưu bản manifest cuối cùng hợp lệ để hoạt động khi server offline.
- D2: Manifest chỉ chứa cấu hình hiển thị bản đồ nền: style, tile source, attribution, nhóm layer, metadata phiên bản và thông tin package; không chứa dữ liệu dự án.
- D3: Desktop kiểm tra manifest bằng `ETag`/`Last-Modified`; chỉ tải nội dung mới khi server xác nhận có thay đổi.
- D4: Desktop hỗ trợ server-offline khi Internet còn và fully-offline khi cả server lẫn Internet mất.
- D5: Người dùng chọn khu vực và dải zoom để tải/cập nhật tile package offline.
- D6: Khi fully-offline và viewport nằm ngoài vùng tile package, bản đồ hiển thị vùng trống, cảnh báo rõ ràng và hướng dẫn tải thêm khu vực.
- D7: Server cung cấp manifest; desktop dùng thông tin trong manifest để tải tile trực tiếp từ nguồn public và lưu package cục bộ. Server không proxy tile trong phạm vi feature này.
- D8: Manifest/package lỗi hoặc không tương thích không được thay thế bản đang dùng; desktop giữ bản `last-known-good` và hiển thị cảnh báo.
- D9: Desktop kiểm tra manifest khi khởi động và khi kết nối lại server/Internet; request có timeout rồi fallback về cache.
- D10: Nghiệm thu gồm contract test server, typecheck/build web, smoke test Tauri, mô phỏng mất server/Internet, tải tile package theo vùng/zoom và phục hồi `last-known-good`.

## System Decision Impact

- Impact: draft new
- Decision: @decision/20260810-0902-server-authored-display-only-maplibre-manifest-with-desktop-last-known-good-fallback
- Acceptance gate: candidate remains draft until the spec has linked implementation tasks and review confirms the manifest contract, fallback behavior and tile-source rights.

## Requirements

### Functional Requirements

- FR-1: Server cung cấp một manifest endpoint dùng chung cho web và desktop, gồm basemap modes, style/tile sources, layer groups, attribution, schema/version metadata và package capabilities.
- FR-2: Web và desktop diễn giải cùng một manifest schema, cùng key basemap/layer và cùng quy tắc visibility.
- FR-3: Desktop gửi `ETag`/`If-None-Match` hoặc `Last-Modified`/`If-Modified-Since`; response không đổi phải tiếp tục dùng cache, response mới chỉ được active sau khi validate.
- FR-4: Desktop có thể khởi động và hiển thị bản đồ bằng manifest `last-known-good` khi server không hoạt động.
- FR-5: Khi Internet còn nhưng server offline, desktop dùng manifest cache và tải tile trực tiếp từ các URL public được manifest chỉ định.
- FR-6: Người dùng chọn bounding box/khu vực và zoom range để tải, theo dõi trạng thái, hủy hoặc cập nhật tile package offline.
- FR-7: Khi server và Internet đều offline, desktop dùng tile package local trong phạm vi đã tải; ngoài phạm vi đó phải hiển thị empty state và hướng dẫn.
- FR-8: Manifest hoặc package mới lỗi, sai schema, không tương thích hoặc tải dở dang không được làm mất bản đang hoạt động.
- FR-9: Desktop kiểm tra lại manifest khi reconnect và không chặn giao diện nếu request timeout.
- FR-10: Manifest/tile package không được chứa hoặc đồng bộ dữ liệu dự án; dữ liệu dự án tiếp tục đi qua các luồng offline-sync riêng.

### Non-Functional Requirements

- NFR-1: Manifest có schema version và validation rõ ràng để web/server/desktop phát hiện incompatibility.
- NFR-2: Manifest và tile package được ghi atomically; crash giữa lúc cập nhật không làm hỏng bản `last-known-good`.
- NFR-3: Tile package có metadata vùng, zoom, nguồn, thời điểm tải, kích thước và checksum để kiểm tra sử dụng offline.
- NFR-4: Attribution và hạn chế sử dụng của từng nguồn tile phải được hiển thị theo manifest.
- NFR-5: Server contract và desktop fallback được kiểm thử với server unavailable, timeout, 304/not-modified, manifest invalid, tile download failure và package outside coverage.

## Acceptance Criteria

- [x] AC-1: Server trả manifest hợp lệ; web và desktop dùng cùng schema, cùng ba mode Street/Hybrid/Vector và cùng nhóm layer nền.
- [x] AC-2: Desktop nhận manifest mới bằng conditional request, validate thành công rồi active; response 304 giữ nguyên manifest cache.
- [x] AC-3: Khi server offline, desktop khởi động bằng manifest `last-known-good` và bản đồ vẫn hiển thị nếu Internet còn.
- [x] AC-4: Khi cả server và Internet offline, tile package đã tải theo vùng/zoom hiển thị được trong phạm vi của package.
- [x] AC-5: Ngoài phạm vi package, desktop hiển thị vùng trống, cảnh báo và hướng dẫn tải thêm; không hiển thị nhầm dữ liệu dự án.
- [x] AC-6: Manifest/package lỗi hoặc không tương thích không thay thế bản đang hoạt động; cảnh báo được hiển thị.
- [x] AC-7: Reconnect trigger kiểm tra manifest với timeout; desktop tiếp tục dùng cache trong lúc chờ.
- [x] AC-8: Kiểm thử liên thông server contract, web build/typecheck, Tauri smoke, server-offline, fully-offline, package download/restore và last-known-good đều pass.

## Scenarios

### Scenario 1: Server online và manifest đồng nhất

**Given** server đang online và có manifest phiên bản mới
**When** web hoặc desktop khởi động
**Then** client gửi conditional request, nhận manifest hợp lệ và hiển thị cùng mode/layer/attribution theo manifest.

### Scenario 2: Server offline nhưng Internet còn

**Given** desktop có manifest `last-known-good` và server không truy cập được
**When** người dùng mở DESIGN
**Then** desktop khởi động không chặn, dùng manifest cache và tải tile trực tiếp từ nguồn public.

### Scenario 3: Fully-offline trong vùng đã tải

**Given** server và Internet đều mất, tile package bao phủ vùng Hà Nội với zoom đã chọn
**When** người dùng mở hoặc pan bản đồ trong vùng package
**Then** MapLibre hiển thị nền từ package local và các layer nền theo manifest cache.

### Scenario 4: Fully-offline ngoài vùng package

**Given** server và Internet đều mất, viewport nằm ngoài các package local
**When** người dùng pan tới khu vực chưa tải
**Then** bản đồ hiển thị vùng trống, nêu rõ chưa có dữ liệu offline và hướng dẫn chọn/tải thêm khu vực.

### Scenario 5: Manifest mới không hợp lệ

**Given** server trả manifest mới nhưng sai schema hoặc nguồn tile không hợp lệ
**When** desktop reconnect và kiểm tra manifest
**Then** desktop từ chối bản mới, giữ manifest/package `last-known-good` và hiển thị cảnh báo.

## Technical Notes

- Web hiện có MapLibre config phía client tại `apps/web/src/features/design/mapConfig.ts`; feature này chuyển phần cấu hình chuẩn sang manifest server nhưng vẫn giữ adapter client để dùng offline.
- Desktop Tauri hiện tải web frontend; desktop-specific storage/download/reconnect cần tích hợp với local storage và offline-sync hiện có.
- Tile package format, storage engine và cơ chế public tile download là quyết định triển khai sau khi spec được duyệt; spec không khóa PMTiles, MBTiles hay một định dạng cụ thể.
- Spec basemap DESIGN hiện tại giữ trách nhiệm về các mode/layer UI; spec này mở rộng contract và lifecycle giữa server/desktop.

## Task Links

- @task-1xqatp [serverdesktop-shared-maplibre-01] Define shared basemap manifest and server endpoint (done)
- @task-99f71h [serverdesktop-shared-maplibre-02] Sync manifest in web and desktop with last-known-good fallback (done)
- @task-ahh0p8 [serverdesktop-shared-maplibre-03] Implement regional offline tile packages (done)
- @task-zllmsv [serverdesktop-shared-maplibre-04] Verify server–web–Tauri basemap integration (done)

## Open Questions

- [ ] Manifest endpoint có cần authentication/authorization riêng hay dùng quyền project hiện tại?
- [ ] Tile package cần quota/kích thước tối đa, retention và cơ chế xóa package cũ như thế nào?
- [ ] Nguồn Google public/OSM nào được phép dùng production và attribution cụ thể của từng nguồn là gì?
