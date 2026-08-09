---
id: l0g5hy
title: Hoàn thiện giao diện desktop app theo prototype HTML
status: done
priority: medium
labels:
  - normal
  - ui
  - desktop
createdAt: '2026-08-09T09:30:45.070Z'
updatedAt: '2026-08-09T09:50:56.397Z'
completedAt: '2026-08-09T09:50:56.397Z'
timeSpent: 1200
assignee: '@me'
---
# Hoàn thiện giao diện desktop app theo prototype HTML

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Đối chiếu giao diện ứng dụng desktop hiện tại với project_platform_ui_prototype.html và triển khai các phần còn thiếu để đạt bố cục, nội dung, trạng thái tương tác và phong cách hiển thị theo prototype.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Frontend matches the prototype shell, module navigation, sidebar, five module views, and key visual states.
- [x] #2 Theme, sidebar collapse, search shortcut, module/sidebar selection, and toast interactions work in the web app.
- [x] #3 Web typecheck/build and repository diff validation pass without changing API/native boundaries.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Chuyển cấu trúc prototype thành React UI trong `apps/web/src/App.tsx`: top bar/project switcher/global search, module tabs DATACENTER/DESIGN/OPERATE/ORGANIZE/DASHBOARD, sidebar động theo module, và các view/panel/kpi/table/map mockup tương ứng. Dữ liệu hiển thị giữ dạng fixture giống prototype; health check API hiện có vẫn được giữ và thể hiện trạng thái kết nối.
2. Port hệ design token và layout desktop từ `project_platform_ui_prototype.html` vào `apps/web/src/styles.css`: light/dark theme, grid/sidebar/topbar, cards/tables/status badges, map placeholder, timeline/charts, responsive breakpoint cho cửa sổ hẹp; không thêm dependency UI bên ngoài.
3. Bổ sung hành vi tương tác bằng state/effect React: chuyển module và active sidebar, thu gọn sidebar, đổi theme và lưu localStorage, toast cho action buttons, Ctrl/Cmd+K focus global search; dùng button/label/aria phù hợp và không dùng `innerHTML`.
4. Cập nhật metadata locale/title trong `apps/web/index.html` để khớp prototype và kiểm tra giao diện ở kích thước desktop Tauri 1280×800 cùng breakpoint hẹp.
5. Xác minh bằng `pnpm --filter @project/web typecheck`, `pnpm --filter @project/web build`, test script hiện có nếu không phát sinh lỗi môi trường, và `git diff --check`; ghi nhận rõ phần API/MapLibre/backend tiếp tục thuộc task `trbw1k`.

## Assumptions

- “Window desktop app” là frontend React được Tauri load qua `apps/desktop/src-tauri/tauri.conf.json`; không cần thay đổi Rust/Tauri window configuration.
- Các số liệu/panel trong prototype là fixture cho UI parity; việc nối toàn bộ dashboard/map vào API thật nằm ngoài task này.
- Không có System Decision hay template liên quan cần áp dụng.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: replaced the minimal web shell with a React implementation matching project_platform_ui_prototype.html across DATACENTER, DESIGN, OPERATE, ORGANIZE, and DASHBOARD; added design tokens/layout, sidebar/module navigation, status/table/map/timeline/chart fixtures, responsive breakpoints, theme persistence, sidebar collapse, global Ctrl/Cmd+K search focus, working camera filtering, and toast interactions. Changed only apps/web/src/App.tsx, apps/web/src/styles.css, and apps/web/index.html; no API, server, Tauri, or native boundaries changed. Verification: web typecheck passed; web production build passed (Vite); web test script passed with 0 tests; git diff --check passed. Automated browser screenshot was unavailable because no Playwright/Chrome runtime is installed; responsive behavior is covered by the CSS breakpoints and build validation. System Decision Impact: none — this task implements the supplied UI prototype and introduces no durable architecture, API, storage, or workflow guidance.
<!-- SECTION:NOTES:END -->

