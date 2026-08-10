---
title: Sample Data Removal
description: Specification for removing pre-seeded sample/mock data from backend persistence, desktop/web apps, and providing a clean empty state with reset capabilities.
createdAt: '2026-08-10T04:30:00.000Z'
updatedAt: '2026-08-10T04:46:42.428Z'
tags:
  - spec
  - approved
  - sample-data
  - cleanup
---

## Overview

Loại bỏ toàn bộ dữ liệu mẫu (pre-seeded/mock data) tồn tại trong phần mềm trên tất cả các lớp (Backend PostgreSQL/In-memory store, Desktop SQLite/SQLCipher manifest, Frontend web/desktop UI). Phần mềm sẽ bắt đầu từ trạng thái hoàn toàn rỗng và dữ liệu chỉ được khởi tạo khi người dùng chủ động vận hành (như Tạo dự án, Thêm nguồn dữ liệu, Nhập file).

## Locked Decisions

- D1: Xóa toàn bộ dữ liệu mẫu khởi tạo mặc định trên cả Backend, Cơ sở dữ liệu và Frontend (Bao gồm pre-seeded Projects, Cameras, Work Packages, Organize Groups/Tags, Local SQLite manifest records và UI Mock state). Hệ thống bắt đầu với trạng thái rỗng hoàn toàn.
- D2: Giao diện khi chưa có dữ liệu sẽ hiển thị Empty State trực quan kèm nút thao tác hướng dẫn người dùng (như "Tạo dự án mới", "Thêm nguồn dữ liệu") để người dùng chủ động khởi tạo dữ liệu khi vận hành.
- D3: Cung cấp cơ chế/script dọn dẹp (Database reset / Migration clean script / CLI command) để dọn dẹp triệt để dữ liệu mẫu cũ tồn tại trong các cơ sở dữ liệu local/môi trường dev hiện tại, đưa hệ thống về trạng thái rỗng chuẩn.

## System Decision Impact

- Impact: none
- Decision: N/A
- Acceptance gate: N/A

## Requirements

### Functional Requirements

- FR-1: Loại bỏ toàn bộ mã nguồn pre-seed/default population trong `CameraStore` (backend `domain.py`), các script khởi tạo database, và bất kỳ mock store state nào.
- FR-2: Đảm bảo khi ứng dụng Server backend khởi động với database mới/sạch, `runtime_store_snapshots` và các bảng liên quan ở trạng thái rỗng (0 projects, 0 cameras, 0 work packages, 0 organize groups/tags).
- FR-3: Loại bỏ các file/bản ghi mẫu pre-seeded trong cơ sở dữ liệu local SQLite / SQLCipher manifest của ứng dụng Desktop (`crates/desktop-core`, `apps/desktop/manifest.sql`).
- FR-4: Đảm bảo giao diện người dùng (Web UI & Desktop UI) hiển thị trạng thái Empty State thân thiện tại các mục (Dự án, Camera, Organize, Data Sources) khi không có dữ liệu, kèm các nút hành động (Call To Action) thúc đẩy người dùng tạo/thêm mới.
- FR-5: Cung cấp script/lệnh dọn dẹp (ví dụ CLI script reset database/clean sample data) giúp dọn dẹp dữ liệu mẫu còn sót lại trong môi trường hiện tại.

### Non-Functional Requirements

- NFR-1: Thời gian khởi động ứng dụng (Backend server & Desktop client) không bị chậm trễ và giữ nguyên tính toàn vẹn của cấu trúc cơ sở dữ liệu (schema/tables/indexes) dù dữ liệu rỗng.
- NFR-2: Tính toàn vẹn dữ liệu và kiểm tra ràng buộc (constraints/validations) hoạt động chính xác khi người dùng tạo bản ghi đầu tiên.

## Acceptance Criteria

- [x] AC-1: Khởi tạo lại cơ sở dữ liệu mới (server & desktop manifest), sau đó gọi API lấy danh sách Projects, Cameras, Organize Groups, Data Sources đều trả về mảng rỗng `[]` (HTTP status 200).
- [x] AC-2: Giao diện Web & Desktop hiển thị Empty State đúng chuẩn UI/UX ở từng phân hệ (Projects list, Camera list, Organize tab, Local sources) khi chưa có dữ liệu.
- [x] AC-3: Người dùng có thể tạo thành công Dự án đầu tiên và các dữ liệu liên quan qua UI mà không gặp lỗi ràng buộc hay lỗi id ngầm định.
- [x] AC-4: Chạy script reset/clean thành công xóa toàn bộ dữ liệu mẫu cũ trong môi trường local hiện tại mà không làm hỏng database schema.

## Scenarios

### Scenario 1: Khởi chạy phần mềm trên môi trường mới (Happy Path)

**Given** Hệ thống được cài đặt hoặc khởi tạo với cơ sở dữ liệu mới tinh  
**When** Người dùng mở phần mềm và truy cập danh sách Dự án (Projects)  
**Then** Giao diện hiển thị màn hình Empty State "Chưa có dự án nào" kèm nút "Tạo dự án mới", không có bất kỳ dự án mẫu nào sẵn có.

### Scenario 2: Người dùng chủ động tạo dữ liệu khi vận hành

**Given** Màn hình đang ở trạng thái Empty State "Chưa có dự án nào"  
**When** Người dùng bấm nút "Tạo dự án mới" và nhập thông tin dự án  
**Then** Hệ thống lưu trữ thành công dự án do người dùng vừa nhập và chuyển từ Empty State sang hiển thị thông tin dự án vừa tạo.

### Scenario 3: Dọn dẹp môi trường local đang chứa dữ liệu mẫu cũ

**Given** Môi trường phát triển hiện tại đang có dữ liệu mẫu cũ từ trước  
**When** Nhà phát triển chạy lệnh/script clean sample data  
**Then** Dữ liệu mẫu bị xóa hoàn toàn khỏi DB, các bảng quay về trạng thái rỗng và schema giữ nguyên.

## Technical Notes

- Cần kiểm tra kỹ `apps/server/app/domain.py`, `apps/server/app/persistence.py`, `crates/desktop-core/src/`, `apps/desktop/manifest.sql`, cũng như các mock initial states trong frontend packages.
- Đảm bảo các bộ test tự động (Pytest / Cargo test) vẫn có test fixtures riêng cho testing mà không ảnh hưởng tới sản phẩm chạy thật (production / default startup runtime).

## Task Links

- @task-75ic9j [sample-data-removal-01] Remove backend domain and database seed data
- @task-j4ngmh [sample-data-removal-02] Clean desktop core & manifest pre-seeded data
- @task-a7nrud [sample-data-removal-03] Implement UI Empty States and CTA prompts in Web & Desktop
- @task-9c0d07 [sample-data-removal-04] Create database reset / clean sample data CLI script & verification

## Open Questions

- Không có câu hỏi ngỏ nào còn đọng lại.
