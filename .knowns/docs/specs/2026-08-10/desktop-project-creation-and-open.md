---
title: Desktop Project Creation and Opening Launcher
description: Specification for the zero-state launcher UI, project creation wizard, open project handler, and project switching/closing UX in the desktop application.
createdAt: '2026-08-10T18:06:00.000Z'
updatedAt: '2026-08-10T18:06:00.000Z'
tags:
  - spec
  - approved
  - desktop
  - project-management
  - launcher
---

## Overview

Quy định thiết kế và yêu cầu kỹ thuật cho trải nghiệm khởi tạo và quản lý trạng thái dự án trên ứng dụng Desktop khi chưa có dự án nào được mở hoặc tạo mới. Tính năng bao gồm Màn hình Welcome Launcher Hub hiển thị danh sách dự án gần đây (Recent Projects), quy trình Tạo dự án mới (Create New Project Wizard), quy trình Mở dự án từ ổ đĩa (Open Existing Project), và cơ chế Chuyển/Đóng dự án hiện tại từ Header App Shell.

## Locked Decisions

- D1: Khi ứng dụng Desktop mở mà chưa chọn hoặc chưa có dự án active nào, giao diện sẽ hiển thị Màn hình Welcome/Launcher Hub riêng biệt (Modal/Full-screen Hub) chứa danh sách các dự án mở gần đây (Recent Projects) cùng hai hành động khởi tạo chính: "Tạo dự án mới" (Create Project) và "Mở dự án" (Open Project).
- D2: Form Tạo dự án mới yêu cầu người dùng cung cấp Tên dự án (Project Name), Mô tả ngắn (Description - không bắt buộc), và Đường dẫn thư mục lưu trữ cục bộ (Local Storage Path) chọn qua thư mục tập tin (Directory Picker).
- D3: Quy trình Mở dự án hỗ trợ chọn Thư mục dự án (chứa tệp cấu hình `project.json` / cơ sở dữ liệu `project.sqlite`) hoặc chọn tệp gói dự án đơn lẻ (`.pdt` / `.sqlite` / `.db`). Khi mở thành công, ứng dụng tự động active dự án lên App Shell và ghi nhận vào lịch sử Recent Projects.
- D4: Trên thanh Header của ứng dụng chính (App Shell), hiển thị Project Selector Dropdown cho phép xem thông tin dự án hiện tại, thực hiện "Chuyển dự án" (Switch Project) hoặc "Đóng dự án" (Close Project) để đưa màn hình quay lại Welcome Launcher Hub.

## System Decision Impact

- Impact: none
- Decision: N/A
- Acceptance gate: N/A

## Requirements

### Functional Requirements

- FR-1: **Welcome Launcher Hub**: Xây dựng màn hình khởi động (Welcome Hub / Launcher) xuất hiện khi trạng thái dự án active là null. Hiển thị danh sách Recent Projects (tên dự án, đường dẫn, lần mở cuối), nút "Tạo dự án mới" và nút "Mở dự án".
- FR-2: **Create Project Dialog/Wizard**: Cho phép nhập Tên dự án, Mô tả ngắn tùy chọn, và chọn Thư mục lưu trữ cục bộ qua Native Directory Picker (Tauri dialog / HTML5 file system API). Tự động khởi tạo file manifest (`project.json` / SQLite DB) trong thư mục được chọn.
- FR-3: **Open Project Selector**: Hỗ trợ mở dự án bằng cách chọn Thư mục dự án hoặc Tệp dự án (`.pdt`, `.sqlite`, `.db`). Tiến hành xác thực cấu trúc dự án (validate project manifest) trước khi active.
- FR-4: **Recent Projects Persistence**: Tự động lưu vết lịch sử mở/tạo dự án vào cấu hình cục bộ của desktop client (Local Storage / SQLCipher client config). Cho phép gỡ hoặc dọn dẹp các đường dẫn dự án không còn tồn tại trên ổ đĩa khỏi danh sách Recent Projects.
- FR-5: **Header Project Control**: Tích hợp Project Selector Control trên Header bar của App Shell khi dự án đã được active, cung cấp menu thả xuống chứa tên dự án hiện tại, tùy chọn "Chuyển dự án" và "Đóng dự án".
- FR-6: **Close & Switch Project Flow**: Cho phép đóng dự án active hiện tại mà không thoát ứng dụng, giải phóng bộ nhớ/kết nối DB dự án và đưa ứng dụng về màn hình Welcome Launcher Hub.

### Non-Functional Requirements

- NFR-1: **Performance**: Màn hình Welcome Launcher nạp và hiển thị ngay lập tức trong < 300ms kể từ khi bật ứng dụng.
- NFR-2: **Data Safety & Integrity**: Mọi thao tác Đóng dự án hoặc Chuyển dự án đều đảm bảo xả các thay đổi dữ liệu ra đĩa (flush pending writes / local storage) an toàn trước khi đóng kết nối.
- NFR-3: **UX Consistency**: Giao diện Welcome Hub và các Dialog tuân thủ đúng Design System của ứng dụng Desktop, hỗ trợ cả sáng/tối (Dark/Light mode).

## Acceptance Criteria

- [x] AC-1: Mở ứng dụng Desktop ở trạng thái ban đầu (chưa có dự án), Màn hình Welcome Launcher Hub hiển thị đúng với danh sách Recent Projects (nếu có) và hai nút "Tạo dự án mới", "Mở dự án".
- [x] AC-2: Nhấp "Tạo dự án mới", nhập Tên dự án, Chọn thư mục lưu trữ và bấm xác nhận -> Dự án mới được tạo trên ổ đĩa, ứng dụng mở ngay giao diện App Shell với dự án mới được active.
- [x] AC-3: Nhấp "Mở dự án", duyệt chọn một thư mục dự án đã tạo hoặc file `.sqlite` hợp lệ -> Ứng dụng active thành công dự án đó và lưu đường dẫn vào Recent Projects.
- [x] AC-4: Trên Header của App Shell, nhấp vào Tên dự án -> Hiển thị dropdown menu với tùy chọn "Chuyển dự án" và "Đóng dự án". Nhấp "Đóng dự án" -> Giao diện ứng dụng đóng dự án và quay về Welcome Launcher Hub.
- [x] AC-5: Khi đường dẫn một dự án trong Recent Projects bị xóa hoặc di chuyển bên ngoài hệ thống, hệ thống cảnh báo "Dự án không tồn tại" và cung cấp tùy chọn xóa khỏi danh sách Recent Projects.

## Scenarios

### Scenario 1: Mở phần mềm lần đầu và tạo dự án mới (Happy Path)

**Given** Ứng dụng Desktop vừa khởi động và chưa có dự án active nào  
**When** Màn hình Welcome Launcher Hub xuất hiện, người dùng bấm "Tạo dự án mới", nhập tên "Dự án Twin 01", chọn thư mục `D:/Projects/Twin01` và bấm Tạo  
**Then** Thư mục dự án được khởi tạo file cấu hình, dự án được kích hoạt trên ứng dụng, danh sách Recent Projects cập nhật "Dự án Twin 01".

### Scenario 2: Mở dự án có sẵn từ ổ đĩa

**Given** Người dùng đang ở màn hình Welcome Launcher Hub  
**When** Người dùng bấm "Mở dự án", duyệt tập tin chọn `D:/Projects/OldProject/project.sqlite`  
**Then** Hệ thống xác thực file hợp lệ, nạp dữ liệu dự án lên App Shell và thêm "OldProject" vào danh sách Recent Projects.

### Scenario 3: Đóng dự án hiện tại để về Welcome Hub

**Given** Người dùng đang vận hành trong một dự án active trên App Shell  
**When** Người dùng nhấp vào Dropdown tên dự án ở Header và chọn "Đóng dự án"  
**Then** Ứng dụng ngắt kết nối với dự án hiện tại, lưu các thay đổi pending (nếu có) và hiển thị lại Màn hình Welcome Launcher Hub.

### Scenario 4: Mở dự án trong Recent Projects bị mất thư mục (Edge Case)

**Given** Danh sách Recent Projects có hiển thị "Project A" ở đường dẫn `D:/Projects/ProjectA`  
**When** Thư mục `ProjectA` bị người dùng xóa thủ công trên ổ đĩa và nhấp vào "Project A" trong Welcome Launcher  
**Then** Ứng dụng hiển thị thông báo "Dự án không còn tồn tại tại đường dẫn chỉ định" và gợi ý xóa bản ghi khỏi danh sách Recent Projects.

## Technical Notes

- Cần tích hợp state quản lý dự án active trong React (`useProjectStore` hoặc `ActiveProjectContext`) trong `apps/web/src/` và Tauri Desktop Core backend (`crates/desktop-core`).
- Khi chưa có dự án active (`activeProject === null`), `AppShell` sẽ render component `WelcomeLauncherHub` thay vì các view tính năng chính (Design, Operate, Organize).
- Lưu trữ lịch sử Recent Projects trong `localStorage` hoặc cấu hình `desktop_settings.db` của Tauri client.

## Task Links

- @task-yu642x [desktop-project-creation-01] Implement Welcome Launcher Hub UI and Active Project State
- @task-0tllrv [desktop-project-creation-02] Implement Create Project Dialog and Disk Storage Initialization
- @task-n41jqb [desktop-project-creation-03] Implement Open Project Folder/File Picker and Validation
- @task-83jybh [desktop-project-creation-04] Implement Header Project Selector Dropdown, Close & Switch Project

## Open Questions

- Không còn câu hỏi mở nào đọng lại.
