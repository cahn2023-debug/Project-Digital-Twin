---
id: nh6h0j
title: 'Review follow-up: provider-specific MapLibre layer and Vector offline support'
status: in-progress
priority: medium
labels:
  - review-followup
  - maplibre
  - provider-limitation
  - offline-vector
createdAt: '2026-08-10T02:45:44.677Z'
updatedAt: '2026-08-10T04:08:19.868Z'
timeSpent: 442
assignee: '@me'
---
# Review follow-up: provider-specific MapLibre layer and Vector offline support

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred P2 findings from review of serverdesktop shared MapLibre basemap: Google public Street/Hybrid composite raster details cannot be independently toggled by MapLibre layer IDs; Vector offline requires packaging style-resolved vector tiles plus glyph/sprite assets. Revisit only after provider/source capability is explicitly selected and licensed. Current UI must keep the limitation visible and must not treat project data as basemap content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Có capability/licensing matrix và provider/source được phê duyệt; nếu chưa có thì blocker được ghi rõ và không sửa code.
- [ ] #2 Manifest phân biệt raster composite với style layers và khai báo đầy đủ asset offline; config không hợp lệ giữ last-known-good.
- [ ] #3 DESIGN không hứa hẹn toggle độc lập cho nội dung raster baked; style layers được hỗ trợ toggle đúng và attribution/limitation hiển thị.
- [ ] #4 Vector offline chỉ active khi đủ tiles/glyphs/sprites, checksum/atomic/coverage guards pass và package không chứa project data.
- [ ] #5 Server/web/offline tests, typecheck/build, review và SDD validation pass; task ghi D1–D10 compliance cùng System Decision Impact.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Cập nhật shared manifest/domain/server để mỗi source khai báo provider, kiểu layer (baked-raster hoặc style-layer) và capability offline; Google Street/Hybrid là online-only, OSM/OpenFreeMap Vector khai báo vector tile template, glyphs, sprite, attribution và offline support.
2. Cập nhật web validator/config và DESIGN để giữ last-known-good, bật/tắt layer style-layer đúng, không hứa toggle độc lập cho Google raster, và khi mất Internet tự động dùng OSM Vector.
3. Mở rộng offline package IndexedDB thành package OSM Vector style: tải style JSON, vector/raster tiles, glyphs, sprites; rewrite toàn bộ URL sang pp-offline, checksum, staging/atomic activation, kiểm tra coverage/zoom; không tải hoặc khôi phục package Google.
4. Cập nhật panel và MapLibre runtime: chỉ hiển thị/tải package OSM, Google chỉ được render khi online, offline map dùng style package OSM hoặc empty state rõ ràng.
5. Chạy server contract, web typecheck/build/test, offline guard/checksum/coverage, review và Knowns/SDD validation; ghi D1–D10 compliance cùng System Decision Impact.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Provider gate completed; no code or package files changed.

Evidence:
- Google Maps Tile API policy: prefetch/cache/storage is restricted and offline use is listed as prohibited; current mt1.google.com URL is not a documented Map Tiles API source, so it cannot be treated as an approved production/offline provider without a written agreement: https://developers.google.com/maps/documentation/tile/policies
- OpenFreeMap provides MapLibre styles, custom styles, self-hosting guidance and full-planet/MBTiles downloads, but its public-service Terms prohibit automated collection without permission and provide no explicit permission for this task's regional public-instance downloads: https://openfreemap.org/quick_start/ and https://openfreemap.org/tos/
- MapLibre supports independently styled layers over vector sources, but a complete offline style requires the source tiles and the style-referenced assets: https://maplibre.org/maplibre-style-spec/sources/

Blocker: provider/source and licensing for offline redistribution are not explicitly selected. Google Street/Hybrid remains online display-only for this task; Vector offline and provider capability manifest changes require a separate approved implementation scope.
System Decision Impact: candidate @decision/20260810-1047-explicitly-licensed-vector-provider-required-for-offline-basemap-packages (added) — records the online-only Google raster boundary and the explicit provider/licensing gate for independent layers and offline packages.
Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=conflict: current Google public raster policy does not establish permission for offline storage; D8=pass, D9=pass, D10=pass.
Blocked after provider gate: no explicitly selected and licensed source permits the required offline redistribution. No code changes made.
Reopened by user direction: Google remains online-only; OSM vector is approved for offline fallback. Implementation may proceed without Google tile download, using the existing OSM/OpenFreeMap style and OSM attribution; provider capability must still be explicit in the manifest.
Scope decision confirmed by user: Google public Street/Hybrid is online-only; approved OSM/OpenFreeMap Vector is the offline fallback and package provider. D7 is now satisfied for the OSM source, subject to manifest asset/license metadata and implementation verification.
<!-- SECTION:NOTES:END -->

