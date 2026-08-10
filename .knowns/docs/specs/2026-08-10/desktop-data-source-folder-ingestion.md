---
title: Desktop data source folder ingestion
description: Specification for adding desktop data sources by selecting folders, parsing files, and persisting ingestion results locally before synchronization.
createdAt: '2026-08-10T01:46:40.970Z'
updatedAt: '2026-08-10T01:50:45.764Z'
tags:
  - spec
  - approved
  - desktop
  - data-source
  - ingestion
---

## Overview

Hoàn thiện luồng **Thêm nguồn dữ liệu** trong desktop app: người dùng chọn một thư mục gốc, đăng ký thư mục đó cho Project, quét đệ quy các file dữ liệu, parsing theo Profile hoặc qua preview/mapping, lưu Raw và ChangeSet vào database local mã hóa, sau đó đồng bộ lên server qua hàng đợi khi có mạng.

Feature này nối UI desktop hiện có với pipeline scan/watcher, importer và persistence. Nó bao phủ cả Excel có cấu trúc phức tạp và tài liệu Markdown/TXT/Word theo contract ingestion hiện tại.

## Locked Decisions

- D1: Phạm vi bao gồm chọn thư mục trên desktop, quét file, parsing, lưu database và áp dụng các contract ingestion hiện có; không tách parsing/database thành hạng mục sau.
- D2: Thư mục nguồn được quét đệ quy; chỉ nhận định dạng được hỗ trợ và bỏ qua file ẩn hoặc file tạm.
- D3: File khớp Profile được parsing tự động; file mới hoặc không khớp phải qua preview/mapping và xác nhận trước khi tạo ChangeSet/ghi canonical state.
- D4: Parsing ghi vào database local mã hóa trước; Raw, ChangeSet và pending sync job được lưu bền vững tại desktop rồi mới đồng bộ lên server.
- D5: Thư mục được đăng ký như nguồn dữ liệu lâu dài, hỗ trợ quét thủ công và watcher tự phát hiện file mới/thay đổi.
- D6: Batch import xử lý độc lập theo file; file hợp lệ vẫn tiếp tục. Trong từng file, dòng hợp lệ có thể import một phần; lỗi hiển thị theo file/dòng/field.
- D7: Một Project có thể đăng ký nhiều thư mục nguồn; mỗi thư mục là một source riêng và có watcher độc lập.

## System Decision Impact

- Impact: existing
- Decision: Tái sử dụng contract trong @doc/specs/2026-08-09/local-file-ingestion-and-synchronization và mô hình local-first trong @doc/specs/2026-08-10/offline-desktop-server-sync; không tạo System Decision mới.
- Acceptance gate: xác nhận các acceptance criteria của spec này, gồm persistence local mã hóa, queue sau restart, import idempotent và đồng bộ khi online.

## Requirements

### Functional Requirements

- FR-1: UI desktop cung cấp thao tác “Thêm nguồn dữ liệu”, mở folder picker native và từ chối đường dẫn không tồn tại hoặc không phải thư mục.
- FR-2: Khi xác nhận thư mục, hệ thống tạo source registration gắn với Project, lưu đường dẫn chuẩn hóa, trạng thái hoạt động, thời điểm đăng ký và cấu hình watcher; Project có thể có nhiều registration.
- FR-3: Manual scan và watcher quét đệ quy từng source registration; chỉ nhận `.xlsx`, `.xlsm`, `.xls`, `.md`, `.txt`, `.doc`, `.docx`, bỏ qua file ẩn/temp và file ngoài danh sách.
- FR-4: Scanner tính hash SHA-256, size, mtime và tạo file identity/version bất biến; chỉ enqueue file sau khi file ổn định, đọc được và không bị khóa.
- FR-5: Với file khớp Profile version đang hoạt động, worker tự chạy parser tương ứng và tạo Raw/source locators, kết quả mapping và file-specific ChangeSet.
- FR-6: Với file chưa có Profile hoặc cấu trúc không khớp, UI hiển thị preview vùng dữ liệu, header, mapping, lỗi và dòng cần bỏ qua; người dùng có thể xác nhận hoặc lưu Profile version mới trước khi tạo ChangeSet.
- FR-7: Excel phải hỗ trợ sheet visible, nhiều vùng/bảng, header nhiều dòng, ô merge ngang/dọc, công thức dùng giá trị đã tính và giữ lại công thức/raw cùng locator sheet/row/column.
- FR-8: Markdown/TXT/Word phải được parse thành cấu trúc Markdown-like gồm heading/section, đoạn văn, danh sách, link, metadata, bảng, hình ảnh và attachment; bảng và reference đi qua flow mapping tương ứng.
- FR-9: Mỗi dòng/field được gán identity theo contract; dữ liệu mapped, unmapped, invalid và skipped vẫn được giữ trong Raw cùng source file/version và source locator.
- FR-10: Sau preview confirmation, hệ thống tạo đúng một ChangeSet cho mỗi file, validate và giữ trạng thái chờ approval trước khi áp dụng canonical state.
- FR-11: Raw, ChangeSet, file registry/version và pending sync job được ghi transactionally vào database local mã hóa; dữ liệu phải còn sau khi app restart hoặc offline.
- FR-12: File có cùng file identity, revision và SHA-256 đã xử lý không tạo import/ChangeSet trùng; thay đổi do chính write-back tạo ra được audit/version hóa nhưng không enqueue import trùng.
- FR-13: Watcher của từng source registration chạy độc lập, debounce thay đổi, chỉ enqueue file khi size/mtime/hash ổn định; lỗi watcher hoặc một source không làm dừng các source khác.
- FR-14: Lỗi scan/parser/import được ghi nhận theo source/file và hiển thị cho người dùng; file khác vẫn được xử lý, dòng hợp lệ có thể import một phần.
- FR-15: Khi online, pending sync jobs được gửi lên server theo thứ tự và idempotency key; lỗi mạng retry có giới hạn, conflict được giữ lại để người dùng xử lý.
- FR-16: UI hiển thị trạng thái source (registered/scanning/waiting-preview/imported/failed), số file phát hiện, số file queued, số lỗi và trạng thái sync gần nhất.

### Non-Functional Requirements

- NFR-1: Không ghi dữ liệu canonical trước khi preview/mapping của cấu trúc mới được người dùng xác nhận và ChangeSet được tạo.
- NFR-2: Database local, Raw, ChangeSet và queue phải dùng boundary persistence hiện có của desktop; không dùng browser local storage làm nơi lưu dữ liệu nghiệp vụ.
- NFR-3: Mọi bản ghi import phải truy vết được tới source registration, file version, hash và locator; lifecycle chính phải có audit correlation.
- NFR-4: Thao tác scan/import phải không làm treo UI; trạng thái tiến trình và lỗi phải được cập nhật bất đồng bộ.
- NFR-5: Parser và scanner phải xử lý Unicode path/nội dung, không làm mất dữ liệu unmanaged và không sửa file gốc trong luồng ingestion.
- NFR-6: Tests phải bao phủ fixture đại diện cho Excel merged/multi-table, document có bảng/asset, file lỗi/locked, duplicate hash, restart offline và watcher nhiều source.

## Acceptance Criteria

- [ ] AC-1: Người dùng chọn được thư mục bằng native folder picker, đăng ký thành công source với Project và nhìn thấy source trong danh sách; có thể đăng ký source thứ hai mà source thứ nhất vẫn hoạt động.
- [ ] AC-2: Manual scan quét đệ quy thư mục, nhận đúng các extension hỗ trợ, bỏ qua file ẩn/temp và hiển thị tổng số file phát hiện cùng lỗi scan nếu có.
- [ ] AC-3: File ổn định tạo được file identity/version có SHA-256, size, mtime và được enqueue một lần; file đang bị khóa hoặc thay đổi liên tục không được import như file hoàn chỉnh.
- [ ] AC-4: File khớp Profile được parsing tự động; Raw, source locator và một ChangeSet theo file được lưu vào local DB mã hóa mà không cần mapping lại.
- [ ] AC-5: File cấu trúc mới mở preview có candidate region/header, mapping, validation issues và cho phép lưu Profile mới; chưa có ChangeSet/canonical apply trước khi người dùng xác nhận.
- [ ] AC-6: Fixture Excel có sheet hidden, merged header/data, nhiều vùng bảng và công thức được parse đúng; giá trị tính được dùng cho mapping, công thức và locator vẫn còn trong Raw.
- [ ] AC-7: Fixture Markdown/TXT/Word có heading, bảng, link, hình ảnh/attachment và reference được parse; asset/reference proposal được liên kết với file version và chờ xác nhận trong ChangeSet.
- [ ] AC-8: Khi batch có file lỗi hoặc dòng lỗi, file/dòng hợp lệ vẫn được lưu; UI hiển thị lỗi theo source/file/row/field và không làm mất Raw của giá trị unmapped/invalid/skipped.
- [ ] AC-9: Sau khi đóng/mở lại app ở trạng thái offline, source registrations, Raw, ChangeSet và pending sync jobs vẫn còn; khi online queue retry idempotently và cập nhật trạng thái sync.
- [ ] AC-10: Quét lại file không đổi hoặc phát hiện self-write không tạo duplicate import/ChangeSet; thay đổi file thật tạo revision mới và được audit.
- [ ] AC-11: Watcher của nhiều source chạy độc lập, debounce được thay đổi và tự enqueue file mới/thay đổi mà không cần mở lại source.
- [ ] AC-12: Typecheck/build/test liên quan của desktop, desktop-core và server pass; `git diff --check` pass.

## Scenarios

### Scenario 1: Thêm source và quét thư mục

**Given** người dùng đang ở một Project và có thư mục dữ liệu gốc chứa nhiều thư mục con  
**When** người dùng chọn “Thêm nguồn dữ liệu” và xác nhận thư mục  
**Then** source được đăng ký, scanner quét đệ quy các file hỗ trợ, ghi manifest/hash và hiển thị kết quả theo file; source khác của Project không bị dừng.

### Scenario 2: File khớp Profile

**Given** source có workbook khớp Profile đã lưu và hash khác revision gần nhất  
**When** manual scan hoặc watcher kết thúc debounce  
**Then** file version mới được đăng ký, parser tự chạy, Raw/source locator và một ChangeSet file-specific được lưu local, không tạo import trùng.

### Scenario 3: Workbook cấu trúc mới

**Given** workbook có merged header, nhiều vùng bảng và không khớp Profile  
**When** worker đưa file vào preview  
**Then** UI hiển thị vùng/header/mapping/validation, người dùng xác nhận mapping và lưu Profile version mới, sau đó ChangeSet được tạo để chờ approval.

### Scenario 4: Document và asset

**Given** Word hoặc Markdown-like document có heading, reference, bảng, hình ảnh và attachment  
**When** parser xử lý file  
**Then** nội dung, bảng, asset, locator và relationship proposal được lưu vào Raw/ChangeSet; file gốc không bị sửa và proposal chưa trở thành canonical nếu chưa được xác nhận.

### Scenario 5: Batch có lỗi một phần

**Given** source có một file bị khóa, một workbook có dòng sai kiểu và các file hợp lệ khác  
**When** người dùng chạy scan/import  
**Then** file bị khóa chuyển trạng thái lỗi, dòng sai được đánh dấu theo field, file/dòng hợp lệ vẫn được lưu và UI hiển thị kết quả từng mục.

### Scenario 6: Offline restart và đồng bộ

**Given** desktop đang offline khi file được import  
**When** app restart rồi kết nối mạng trở lại  
**Then** source/Raw/ChangeSet/pending job được khôi phục, queue gửi lên server theo idempotency key, retry không tạo duplicate và conflict được giữ để xử lý.

### Scenario 7: File unchanged và self-write

**Given** file đã import hoặc vừa được app ghi write-back  
**When** watcher phát hiện lại file  
**Then** hash/idempotency hoặc self-write provenance ngăn import trùng; nếu nội dung thay đổi thật thì tạo file revision mới và audit liên kết được nguyên nhân.

## Technical Notes

- Desktop entry points hiện có: `apps/desktop/src/features/local-files.ts` và Tauri commands trong `apps/desktop/src-tauri/src/scan.rs`.
- Scanner/manifest hiện có: `crates/desktop-core/src/scanner.rs` và `crates/desktop-core/src/manifest.rs`; cần nối source registration, UI state, worker/import execution và local encrypted persistence theo contract thay vì chỉ dừng ở enqueue.
- Server-side parsing contracts hiện có tại `apps/server/app/adapters/files/importers/excel.py`, `apps/server/app/adapters/files/importers/documents.py`, `apps/server/app/shared/contracts.py`, `apps/server/app/shared/schemas.py` và domain import/ChangeSet.
- Chi tiết hành vi ingestion dùng @doc/specs/2026-08-09/local-file-ingestion-and-synchronization; local-first queue dùng @doc/specs/2026-08-10/offline-desktop-server-sync.
- Exact debounce interval, tên bảng local và cơ chế worker orchestration là nội dung planning/implementation, không phải quyết định sản phẩm của spec này.

## Task Links

- @task-i3beyy [desktop-data-source-folder-ingestion-01] Add source registry and multi-source watcher persistence (todo)
- @task-p0zoqt [desktop-data-source-folder-ingestion-02] Build desktop add-source folder picker and source UI (todo)
- @task-bnuso1 [desktop-data-source-folder-ingestion-03] Wire queued scans to parsers, Raw, ChangeSets and local-first persistence (todo)
- @task-aobrj5 [desktop-data-source-folder-ingestion-04] Add ingestion preview, mapping and error status flow (todo)
- @task-kimegz [desktop-data-source-folder-ingestion-05] Run integrated offline import, sync and SDD verification (todo)

## Open Questions

- [ ] Quyền nào được phép đăng ký source và xác nhận preview/ChangeSet trong desktop: mọi thành viên Project hay chỉ Project editor?
- [ ] Extension `.doc` legacy cần parser native đầy đủ ngay trong scope này hay chuyển trạng thái unsupported với hướng dẫn chuyển sang `.docx`?
- [ ] Khi một source registration bị xóa khỏi Project, có dừng watcher nhưng giữ file registry/Raw/ChangeSet lịch sử hay archive toàn bộ source?
