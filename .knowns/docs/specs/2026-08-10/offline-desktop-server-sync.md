---
title: Offline desktop server sync
description: Specification for standalone Tauri desktop application operating offline with SQLCipher local storage and event-based online server synchronization.
createdAt: '2026-08-10T08:17:00.000Z'
updatedAt: '2026-08-10T08:17:00.000Z'
tags:
  - spec
  - approved
  - tauri
  - offline-sync
  - sqlcipher
---

## Overview

Đặc tả này xác định kiến trúc và cơ chế hoạt động cho Ứng dụng Desktop hoạt động độc lập (Offline-First Desktop Application) trên nền tảng Tauri (Rust + React/TS). Ứng dụng cho phép người dùng đăng nhập, xem, tạo và chỉnh sửa dữ liệu hoàn toàn ngoại tuyến (offline) bằng cơ sở dữ liệu mã hóa SQLCipher ở máy cục bộ. Khi thiết bị có kết nối mạng (online), các biến đổi dữ liệu (mutation events) tích lũy trong hàng đợi ngoại tuyến sẽ được tự động đồng bộ (replay) và hợp nhất lên Server một cách an toàn.

## Locked Decisions

- D1: Sử dụng **Tauri (Rust + React/TS)** làm nền tảng phát triển ứng dụng Desktop.
- D2: Sử dụng chiến lược **Event / Mutation Log (Append-Only)** cho việc lưu trữ vết thay đổi cục bộ và replay lên server khi đồng bộ.
- D3: Kích hoạt đồng bộ **Tự động khi phát hiện thiết bị chuyển sang trạng thái online (Event-driven)** kết hợp nút **"Đồng bộ ngay" (Manual Sync)** trên UI.
- D4: Lưu trữ cục bộ bằng **SQLite mã hóa (SQLCipher)** quản lý bởi Rust backend của Tauri, hỗ trợ xác thực ngoại tuyến bằng **cached JWT/Session credentials**.

## System Decision Impact

- Impact: draft new
- Decision: none
- Acceptance Gate: Kiểm tra xác thực offline, mã hóa SQLCipher, hàng đợi mutation log và đồng bộ tự động/thủ công vượt qua các kịch bản kiểm thử tích hợp.

## Requirements

### Functional Requirements

- FR-1: **Offline Data Storage & Security**: Lưu trữ toàn bộ dữ liệu ứng dụng và nhật ký thay đổi (mutation log) cục bộ trong cơ sở dữ liệu SQLite mã hóa (SQLCipher) ở ứng dụng Tauri Desktop.
- FR-2: **Offline Authentication**: Lưu bộ nhớ đệm thông tin xác thực (token/JWT, user profile hash) để cho phép người dùng đăng nhập và thao tác khi ứng dụng không có kết nối mạng.
- FR-3: **Event/Mutation Logging**: Mỗi thao tác tạo/sửa/xóa (CUD) ở client khi offline sẽ tạo một Mutation Event dạng Append-Only (bao gồm Event ID, Timestamp, Entity Type, Mutation Payload, Causation/Correlation ID, Sync Status = PENDING).
- FR-4: **Network Status Detection**: Ứng dụng liên tục lắng nghe và phát hiện trạng thái mạng (Online/Offline) ở cả tầng Tauri Rust backend và React frontend.
- FR-5: **Automated Background Sync**: Khi phát hiện kết nối mạng khôi phục (offline -> online), ứng dụng tự động kích hoạt tiến trình chạy ngầm để gửi hàng đợi Mutation Events lên Server theo thứ tự thời gian.
- FR-6: **Manual Sync Trigger**: Giao diện người dùng cung cấp nút "Đồng bộ ngay" cho phép kích hoạt đồng bộ bất kỳ lúc nào người dùng mong muốn khi đang online.
- FR-7: **Server Replay & Conflict Handling**: Server tiếp nhận danh sách mutation events, replay theo thứ tự và xử lý hợp nhất dữ liệu; trường hợp xung đột bản ghi không thể tự hợp nhất sẽ được đánh dấu cờ (FAILED_CONFLICT) và hiển thị thông báo trên UI cho người dùng xử lý.
- FR-8: **Sync Status Indicator**: Hiển thị trạng thái kết nối (Online/Offline), số lượng event chờ đồng bộ (Pending events count), và trạng thái đồng bộ gần nhất trên thanh trạng thái UI ứng dụng desktop.

### Non-Functional Requirements

- NFR-1: **Performance**: Thao tác ghi local mutation log phải hoàn tất trong dưới 50ms để không gây gián đoạn trải nghiệm người dùng trên UI desktop.
- NFR-2: **Security**: Cơ sở dữ liệu SQLite local bắt buộc phải mã hóa bằng SQLCipher với khóa mã hóa derive từ thông tin an toàn của hệ điều hành (Tauri Stronghold / OS Keychain).
- NFR-3: **Reliability & Idempotency**: Tiến trình đồng bộ event phải đảm bảo tính lặp lại an toàn (idempotent), server không gây trùng lặp dữ liệu khi nhận cùng một Event ID nhiều lần.

## Acceptance Criteria

- [ ] AC-1: Khi không có kết nối internet, người dùng đã từng đăng nhập vẫn có thể mở ứng dụng và xác thực thành công vào giao diện làm việc nhờ cached credentials.
- [ ] AC-2: Mọi dữ liệu lưu ở local desktop được ghi vào cơ sở dữ liệu SQLCipher mã hóa; không thể đọc nội dung file DB bằng các trình xem SQLite thông thường nếu không có key.
- [ ] AC-3: Mỗi thao tác thêm/sửa/xóa dữ liệu ở trạng thái offline đều tạo ra một bản ghi Mutation Event với trạng thái `PENDING` trong hàng đợi SQLite cục bộ.
- [ ] AC-4: Khi thiết bị chuyển từ Offline sang Online, ứng dụng tự động phát hiện và gửi các `PENDING` mutation events lên Server theo đúng thứ tự thời gian.
- [ ] AC-5: Người dùng có thể nhấn nút "Đồng bộ ngay" trên UI để kích hoạt gửi sự kiện lên server tức thì khi đang online.
- [ ] AC-6: Khi Server nhận và replay thành công Mutation Event, trạng thái của event ở local SQLite chuyển sang `SYNCED` hoặc được dọn dẹp theo chính sách retention.
- [ ] AC-7: Nếu xảy ra lỗi mạng giữa chừng khi đang đồng bộ, tiến trình đồng bộ tự động dừng, lưu vị trí (checkpoint) và sẽ thử lại (retry với exponential backoff) khi mạng ổn định.
- [ ] AC-8: Khi có xung đột dữ liệu từ server, event bị lỗi được gắn nhãn `CONFLICT`, UI hiển thị danh sách xung đột để người dùng chọn phiên bản dữ liệu giữ lại.
- [ ] AC-9: Thanh trạng thái (Status Bar) trên Desktop UI hiển thị chính xác icon Online/Offline, số lượng sự kiện chờ đồng bộ, và thời gian đồng bộ thành công gần nhất.

## Scenarios

### Scenario 1: Thao tác hoàn toàn Offline và Tự động Đồng bộ khi Online

**Given** Ứng dụng Desktop đang ở trạng thái Offline (không có internet)
**When** Người dùng tạo mới một dự án và chỉnh sửa thông tin dự án
**Then** Dữ liệu được ghi thành công vào SQLCipher local DB, 2 Mutation Events được tạo ở trạng thái `PENDING`, UI cập nhật ngay lập tức và hiển thị nhãn "Chưa đồng bộ (2)".
**When** Thiết bị kết nối lại internet
**Then** Tauri backend phát hiện sự kiện Online, tự động đẩy 2 Mutation Events lên Server, Server xác nhận thành công và UI cập nhật trạng thái "Đã đồng bộ vừa xong".

### Scenario 2: Đồng bộ thủ công bằng nút trên UI

**Given** Thiết bị đang Online và có 5 Mutation Events đang ở trạng thái `PENDING` trong hàng đợi
**When** Người dùng nhấn vào nút "Đồng bộ ngay" trên thanh công cụ UI
**Then** Tiến trình đồng bộ được kích hoạt tức thì, tiến trình hiển thị spinner "Đang đồng bộ...", đẩy 5 events lên Server và thông báo "Đồng bộ hoàn tất" khi hoàn thành.

### Scenario 3: Xử lý Xung đột Dữ liệu (Conflict Resolution)

**Given** Bản ghi A đã được sửa đổi trên Server bởi người dùng khác trong khi Client Desktop đang Offline
**When** Client Desktop kết nối Online và đẩy Event chỉnh sửa bản ghi A lên Server
**Then** Server phát hiện conflict version, phản hồi lỗi `FAILED_CONFLICT`, Event ở Client được chuyển sang trạng thái `CONFLICT`, UI mở bảng điều hướng xung đột cho phép người dùng chọn "Dùng bản ghi Server" hoặc "Đè bằng bản ghi Local".

## Technical Notes

- Tầng Tauri Rust Backend: Quản lý kết nối SQLCipher (`rusqlite` + SQLCipher plugin), lắng nghe sự kiện mạng (network availability plugin), duy trì background task đồng bộ event queue.
- Tầng React Frontend: Đọc dữ liệu từ SQLite qua Tauri IPC commands, quản lý UI state (Zustand/React Query), đăng ký lắng nghe sự kiện đồng bộ từ Rust backend.
- Cấu trúc Mutation Event Schema:
  `{ id: UUID, entity_type: String, entity_id: String, action: "CREATE"|"UPDATE"|"DELETE", payload: JSON, timestamp: i64, status: "PENDING"|"SYNCING"|"SYNCED"|"CONFLICT", retry_count: i32 }`.
- An toàn mã hóa: Key mã hóa SQLCipher được lưu trữ an toàn bằng Tauri Stronghold hoặc hệ thống Keyring OS (Windows Credential Manager).

## Task Links

- @task-y3uif4 [offline-desktop-sync-01] Establish SQLCipher encrypted local database and Tauri Rust backend storage layer (open)
- @task-dzvcqy [offline-desktop-sync-02] Implement offline authentication and cached credential management (open)
- @task-ipwdel [offline-desktop-sync-03] Implement Append-Only Mutation Event queue and network status listener (open)
- @task-2tsghf [offline-desktop-sync-04] Implement background sync replay engine, retry logic and manual sync trigger (open)
- @task-cxn923 [offline-desktop-sync-05] Implement server replay endpoint and conflict resolution workflow (open)
- @task-uzwop1 [offline-desktop-sync-06] Implement desktop UI sync status bar indicator and end-to-end verification (open)

## Open Questions

- [ ] Cơ chế quản lý khóa mã hóa SQLCipher: Sử dụng master password của người dùng hay tự động tạo ngẫu nhiên lưu trong Windows Credential Manager?
- [ ] Thời gian retention của các Mutation Event đã ở trạng thái `SYNCED` trong SQLite local (ví dụ xóa sau 30 ngày hay xóa ngay sau khi sync thành công)?
- [ ] Giới hạn dung lượng hàng đợi Offline Mutation Queue tối đa trên máy client trước khi đưa ra cảnh báo bộ nhớ.
