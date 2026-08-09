---
title: MapLibre basemap for DESIGN
description: Specification for the DESIGN tab MapLibre basemap modes and independently toggled map layers.
createdAt: '2026-08-09T12:10:13.056Z'
updatedAt: '2026-08-09T12:10:13.056Z'
tags:
  - spec
  - draft
  - maplibre
  - design
  - basemap
---

## Overview

Thay thế bản đồ giả lập trong thẻ DESIGN bằng bản đồ MapLibre tập trung khu vực Việt Nam. Người dùng có thể chuyển đổi ba nền Street, Hybrid và Vector, điều khiển các nhóm layer bản đồ nền, ghi nhớ lựa chọn gần nhất và mở vị trí hiện tại trên Google Maps public.

## Locked Decisions

- D1: MapLibre là renderer chính. Street và Hybrid dùng Google public tile URL như lựa chọn thử nghiệm trực tuyến; Vector dùng style vector công khai OSM/OpenFreeMap. Không triển khai tải/lưu tile Google offline.
- D2: Ghi nhớ chế độ nền bản đồ gần nhất trong local storage; khi chưa có lựa chọn trước, dùng Vector.
- D3: Khi tile Google lỗi, giữ nguyên chế độ đang chọn và hiển thị cảnh báo để người dùng tự đổi nền.
- D4: Layer map là layer của bản đồ nền, không phải dữ liệu dự án. Các nhóm layer có thể bật/tắt gồm đường & giao thông, tên đường, địa giới & hành chính, địa điểm công cộng, tên địa danh, đất/nước & công trình.
- D5: Có link mở Google Maps tại tâm và mức zoom hiện tại của MapLibre trong tab mới.

## System Decision Impact

- Impact: none
- Decision: Không tạo System Decision; phạm vi là hành vi UI của feature này, không thay đổi kiến trúc/API/storage dùng chung.
- Acceptance gate: Review đặc tả và xác nhận nguồn Google public trước khi dùng production.

## Requirements

### Functional Requirements

- FR-1: DESIGN hiển thị bản đồ MapLibre thay cho MapMockup CSS và tập trung mặc định tại Việt Nam.
- FR-2: Người dùng chuyển đổi được Street, Hybrid và Vector bằng nút chọn nền.
- FR-3: Nền Street dùng `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`; Hybrid dùng biến thể Google satellite/hybrid; Vector dùng style vector công khai.
- FR-4: Người dùng bật/tắt thủ công từng nhóm layer nền qua bảng Lớp bản đồ.
- FR-5: Lựa chọn nền và trạng thái layer được giữ lại giữa các lần mở DESIGN.
- FR-6: Link Google Maps mở theo viewport hiện tại.
- FR-7: Lỗi tải tile hiển thị trạng thái cảnh báo mà không tự ý chuyển nền.
- FR-8: Không trộn các layer Camera/Intersection/Fiber của dữ liệu dự án vào layer nền bản đồ.

### Non-Functional Requirements

- NFR-1: MapLibre map được khởi tạo và huỷ đúng vòng đời React.
- NFR-2: Các layer được điều khiển bằng visibility của style layer, không mô phỏng bằng CSS.
- NFR-3: Hiển thị attribution cho nguồn bản đồ và ghi rõ Google public tiles là experimental.

## Acceptance Criteria

- [ ] AC-1: Mở DESIGN thấy bản đồ MapLibre và khu vực Việt Nam, không còn bản đồ CSS giả lập.
- [ ] AC-2: Chọn Street/Hybrid/Vector đổi nền đang hiển thị và nút đang chọn có trạng thái active.
- [ ] AC-3: Tắt một nhóm layer làm các style layers tương ứng chuyển sang visibility `none`; bật lại khôi phục hiển thị.
- [ ] AC-4: Reload ứng dụng giữ lại nền và các layer đã chọn trước đó.
- [ ] AC-5: Link Google Maps mở đúng tâm/zoom hiện tại trong tab mới.
- [ ] AC-6: Lỗi tile hiển thị cảnh báo và không tự động đổi mode.
- [ ] AC-7: Typecheck, build, test script và `git diff --check` pass.

## Scenarios

### Scenario 1: Chuyển nền bản đồ

**Given** người dùng đang ở DESIGN với Vector
**When** chọn Hybrid
**Then** raster Hybrid hiện lên, Vector base background tắt, layer panel vẫn giữ các lựa chọn layer.

### Scenario 2: Bật/tắt layer nền

**Given** nhóm “Tên đường” đang bật
**When** người dùng bỏ chọn nhóm này
**Then** các style layer tên đường được MapLibre đặt visibility là `none` mà không ảnh hưởng các nhóm khác.

### Scenario 3: Ghi nhớ lựa chọn

**Given** người dùng chọn Street và tắt “Địa điểm công cộng”
**When** rời DESIGN rồi mở lại
**Then** Street vẫn là mode hiện tại và “Địa điểm công cộng” vẫn tắt.

### Scenario 4: Tile lỗi và link Google Maps

**Given** Google public tile không tải được
**When** lỗi được MapLibre phát hiện
**Then** mode không tự chuyển, cảnh báo được hiển thị và người dùng vẫn có thể mở link Google Maps theo viewport hiện tại.

## Technical Notes

- Vector style hiện dùng `https://tiles.openfreemap.org/styles/bright` và nhóm layer theo id/source-layer của style OpenMapTiles.
- Google Street/Hybrid là raster source MapLibre; layer groups là style layers vector độc lập được điều khiển cùng bảng layer.
- Endpoint Google public là lựa chọn thử nghiệm, không phải Google Maps Platform Map Tiles API chính thức. Cần review quyền sử dụng, attribution và độ ổn định trước khi production.

## Task Links

Chưa tạo task Knowns riêng; implementation hiện nằm trong thay đổi frontend của feature.

## Open Questions

- [ ] Có thay Google public endpoint bằng Google Maps Platform Map Tiles API hoặc nhà cung cấp có SLA trước production không?
- [ ] Có cần thêm các nhóm layer nền khác ngoài sáu nhóm hiện tại không?
