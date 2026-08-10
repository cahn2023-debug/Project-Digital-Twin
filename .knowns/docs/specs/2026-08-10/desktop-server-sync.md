---
title: Desktop Server Data Synchronization and Reconciliation
description: 'Specification for desktop features unification, offline outbox sync, and server-side data reconciliation & conflict resolution.'
createdAt: '2026-08-10T02:12:30.000Z'
updatedAt: '2026-08-10T03:34:44.710Z'
tags:
  - spec
  - draft
  - review-required
---

## Overview

Feature đồng nhất tính năng ứng dụng Desktop với phần mềm hệ thống (Server/Web), hỗ trợ hoạt động offline-first trên phần mềm Desktop, đồng bộ dữ liệu biến đổi (mutations) từ các ứng dụng Desktop lên Server, và xử lý so sánh đối chiếu để hợp nhất hoặc cho phép người dùng chọn bản ghi ưu tiên từ các Client khác nhau.

- D1 (Conflict Resolution Strategy): Server sử dụng cơ chế Field-level Merge tự động cho các trường dữ liệu không bị xung đột giữa các Desktop Clients. Với các trường dữ liệu bị xung đột cùng lúc từ 2 hoặc nhiều Clients, Server chuyển bản ghi vào trạng thái Staging/Conflict Flagged và cung cấp giao diện/API cho Admin/User duyệt chọn giữ phiên bản của Client nào.
- D2 (Sync Trigger & Offline Engine): Desktop Client sử dụng cơ chế đồng bộ Hybrid. SQLite Encrypted Outbox lưu trữ ngoại tuyến mọi mutation event. Background replay worker tự động kiểm tra mạng và đẩy lô sự kiện lên server kèm exponential backoff retry. Đồng thời, giao diện Desktop cung cấp nút "Đồng bộ ngay" (Sync Now) để người dùng chủ động kích hoạt.
- D3 (Client Identity & Scoping): Định danh Desktop Client sử dụng `client_id` (UUID duy nhất) lưu an toàn ở local SQLite, gửi kèm `workspace_id` và `user_id`. Server dùng `client_id` để phân biệt các nguồn phát sinh thay đổi từ các máy desktop khác nhau trong cùng một dự án/workspace, phục vụ lưu vết và đối chiếu.

## System Decision Impact

- Impact: draft new
- Decision: none
- Acceptance Gate: Unit & Integration tests verifying Field-level merge and conflict staging pass cleanly on Server.


## Requirements

### Functional Requirements

- **FR-1 (Desktop Offline Outbox Queue)**: Desktop Client phải lưu trữ tất cả các hành động ghi/sửa/xóa dữ liệu vào SQLite Outbox mã hóa (zero-knowledge encryption) với trạng thái `PENDING` khi ứng dụng hoạt động ngoại tuyến hoặc mất kết nối mạng.
- **FR-2 (Hybrid Replay Engine)**: Desktop Client phải có Background Replay Worker tự động quét Outbox và gửi lô (batch) sự kiện lên Server API khi có kết nối Internet (kèm retry backoff Exponential). Ngoài ra, hỗ trợ nút "Đồng bộ ngay" trên Desktop UI để kích hoạt đồng bộ tức thì.
- **FR-3 (Multi-Client Payload Identification)**: Mọi payload gửi từ Desktop Client lên Server phải chứa đầy đủ metadata bao gồm: `client_id` (UUID thiết bị), `user_id`, `workspace_id`, `entity_type`, `entity_id`, `mutation_timestamp`, `payload_version`, và `field_changes`.
- **FR-4 (Server Field-level Auto-Merge)**: Server khi nhận mutation event từ Desktop Client phải so sánh từng trường (field) với dữ liệu hiện tại trong Database. Nếu các trường thay đổi không trùng lặp/không mâu thuẫn, Server tự động ghi nhận và hợp nhất dữ liệu (Auto-Merge).
- **FR-5 (Server Conflict Detection & Staging)**: Khi 2 hoặc nhiều Desktop Clients sửa cùng một trường (`field`) của cùng một bản ghi trong khoảng thời gian xung đột chưa được giải quyết, Server ghi nhận phiên bản mới dưới dạng `CONFLICT_PENDING` (Staging State), không tự động đè dữ liệu.
- **FR-6 (Web/Desktop Conflict Resolution Interface)**: Server cung cấp API & Giao diện quản lý xung đột (Conflict Dashboard), hiển thị chi tiết so sánh side-by-side (ví dụ: Client A vs Client B vs Current Server Value) cho phép Admin/User chọn phương án: "Dùng dữ liệu Client A", "Dùng dữ liệu Client B", hoặc "Chấp nhận bản ghi tự động hợp nhất".
- **FR-7 (Sync Status Acknowledgement)**: Sau khi Server xử lý lô mutation, Server trả về kết quả Ack (Success/Conflict/Failed) cho Desktop Client để Desktop đánh dấu `CONFIRMED` hoặc `STAGED_FOR_REVIEW` và dọn dẹp Outbox Queue.

### Non-Functional Requirements

- **NFR-1 (Performance)**: Ghi Outbox tại Desktop local SQLite phải hoàn tất dưới 50ms. API Server tiếp nhận lô đồng bộ (tối đa 100 mutations/batch) và xử lý đối chiếu dưới 500ms.
- **NFR-2 (Data Integrity & Security)**: Dữ liệu Outbox ở đĩa cứng Desktop phải được mã hóa payload bằng DbPasskey. Mọi kết nối đồng bộ lên Server phải được xác thực qua JWT + TLS 1.3.
- **NFR-3 (Idempotency)**: Endpoint tiếp nhận đồng bộ trên Server phải đảm bảo tính Idempotent bằng `mutation_id` / `client_sequence_id` để tránh ghi lặp dữ liệu khi Desktop gửi lại lô sự kiện bị rớt mạng giữa chừng.

## Acceptance Criteria

- [x] **AC-1**: Khi Desktop ngắt kết nối mạng, người dùng thực hiện thao tác sửa đổi dữ liệu -> Dữ liệu được ghi vào SQLite Outbox dưới dạng PENDING, không mất dữ liệu.
- [x] **AC-2**: Khi khôi phục kết nối mạng (hoặc nhấn nút "Đồng bộ ngay"), Background Replay Worker đẩy thành công lô PENDING mutations lên Server và nhận ACK `CONFIRMED`.
- [x] **AC-3**: Hai máy Desktop A và Desktop B cùng sửa các trường khác nhau trên cùng 1 dự án -> Server tự động hợp nhất (Field-level Merge) thành công mà không gây lỗi hoặc mất thông tin của cả 2 máy.
- [x] **AC-4**: Hai máy Desktop A và Desktop B cùng sửa CÙNG một trường dữ liệu -> Server phát hiện xung đột, tạo bản ghi `STAGED` và hiển thị trên Conflict Resolution Dashboard.
- [x] **AC-5**: Admin thực hiện chọn "Giữ phiên bản Client A" trên Dashboard -> Dữ liệu của Client A được áp dụng làm dữ liệu chính thức (Canonical State) và được đồng bộ lại xuống tất cả các Desktop Clients liên quan.

## Scenarios

### Scenario 1: Field-level Auto-Merge (Không xung đột cùng trường)
**Given** Dự án P1 có cấu hình `{ name: "Digital Twin 1", status: "Active" }` trên Server.  
**When** Desktop Client A sửa `name` thành `"Digital Twin Alpha"` (offline) và Desktop Client B sửa `status` thành `"Maintenance"` (offline).  
**Then** Khi cả 2 máy kết nối lại, Server tự động hợp nhất dữ liệu thành `{ name: "Digital Twin Alpha", status: "Maintenance" }` và ghi nhận thành công.

### Scenario 2: Conflict Flagged & Manual Resolution (Xung đột cùng trường)
**Given** Thiết bị D1 có thông số `sampling_rate = 100` trên Server.  
**When** Desktop Client A đổi `sampling_rate = 50` và Desktop Client B đổi `sampling_rate = 200` ở chế độ offline.  
**Then** Khi cả 2 đồng bộ lên Server, Server phát hiện xung đột ở trường `sampling_rate`, giữ giá trị cũ trên Server và đẩy bản ghi vào Staging List. Người dùng mở màn hình Conflict Resolution, bấm chọn "Chấp nhận Client B (200)" -> Server cập nhật `sampling_rate = 200`.

## Technical Notes

- Desktop Outbox Engine: Phát triển trong Rust `crates/desktop-core` sử dụng SQLite.
- Server Reconciliation Engine: Phát triển trong Rust `apps/server` (hoặc module backend server tương ứng).
- REST / WebSocket endpoint: `POST /api/v1/sync/reconcile-batch` nhận lô mutation events.

## Task Links

- `@task-qz0bjs` - [desktop-server-sync-01] Desktop Encrypted Outbox and Hybrid Replay Worker (Done)
- `@task-4p3rrx` - [desktop-server-sync-02] Server Reconcile Batch Endpoint & Field-level Auto-Merge Engine (Done)
- `@task-xbtnje` - [desktop-server-sync-03] Server Conflict Detection, Staging Table & Reconciliation API (Done)
- `@task-n6psxm` - [desktop-server-sync-04] Conflict Resolution UI Dashboard & End-to-End Verification (Done)

## Open Questions

- [ ] Cần lưu trữ bao nhiêu phiên bản lịch sử thay đổi (Audit History) trên Server cho mỗi thực thể?
- [ ] Có cần thông báo Real-time (Push notification / WebSocket) về cho Desktop Client B ngay khi Admin vừa phê duyệt xung đột từ Desktop Client A không?
