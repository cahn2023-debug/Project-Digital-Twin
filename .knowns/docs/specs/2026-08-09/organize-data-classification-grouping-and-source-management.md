---
title: Organize data classification, grouping and source management
description: Specification for connecting the Organize tab to existing project data and managing groups, tags, lifecycle and controlled cross-format source write-back.
createdAt: '2026-08-09T14:17:30.025Z'
updatedAt: '2026-08-09T16:51:15.984Z'
tags:
  - spec
  - approved
  - organize
  - groups
  - tags
  - write-back
  - source-files
---

## Overview

Organize là tab quản lý dữ liệu thật của Project Digital Twin. Tab này kết nối dữ liệu nghiệp vụ đã chuẩn hóa với file/import liên quan, cho phép người dùng phân loại bằng cây nhóm và tag, xem quan hệ nguồn, thực hiện thao tác đơn/hàng loạt, archive/khôi phục dữ liệu, và chuẩn bị hoặc thực hiện write-back có kiểm soát vào file nguồn.

Phạm vi write-back của Organize là một mở rộng có chủ đích đối với boundary ingestion hiện tại: hỗ trợ Excel, Markdown, TXT và Word sau preview/diff và xác nhận rõ ràng của người dùng có quyền chỉnh sửa project. Các nguyên tắc provenance, Raw/source locator, ChangeSet, version, conflict evidence, self-write suppression và audit vẫn được giữ nguyên.

Tham chiếu nền:
- @doc/specs/2026-08-09/local-file-ingestion-and-synchronization
- @doc/specs/2026-08-09/project-create-and-delete-lifecycle
- @doc/learnings/learning-desktop-ui-prototype-implementation

## Locked Decisions

- D1: Organize quản lý cả dữ liệu nghiệp vụ và file/import liên quan.
- D2: Phân loại dùng kết hợp cây nhóm phân cấp và tag.
- D3: Một mục dữ liệu có thể liên kết với nhiều nhóm.
- D4: Cây nhóm hỗ trợ nhiều cấp và nhiều nhóm cha, nhưng không cho phép vòng lặp.
- D5: Xóa nhóm chỉ xóa liên kết nhóm; dữ liệu và nhóm con vẫn được giữ lại.
- D6: Hỗ trợ thao tác từng mục và thao tác hàng loạt.
- D7: UI gồm cây nhóm, danh sách hợp nhất object/file-import và panel chi tiết.
- D8: Dữ liệu dùng soft-delete/thùng rác; hard-delete chỉ qua luồng quản trị riêng.
- D9: Người dùng có quyền chỉnh sửa project được phép xác nhận write-back.
- D10: Phân loại, nhóm, archive và write-back đều lưu audit chi tiết gồm actor, thời gian, before/after, file nguồn và kết quả.
- D11: Với nhiều file, người dùng chọn chiến lược xử lý theo từng lần write-back.
- D12: Write-back hỗ trợ Excel, Markdown, TXT và Word.
- D13: Người dùng chọn cập nhật file tại chỗ có backup/version/restore hoặc tạo file mới.
- D14: Với Markdown/TXT/Word, dùng cấu trúc hiện có; nếu không nhận diện an toàn thì yêu cầu mapping thủ công qua preview.
- D15: Write-back có thể cập nhật metadata và tái cấu trúc nội dung.
- D16: Mọi write-back bắt buộc preview diff và xác nhận; xung đột sẽ chặn ghi.
- D17: Phân loại/nhóm cập nhật canonical metadata và liên kết file/import; chỉ ghi vào file nguồn sau preview và xác nhận.
- D18: Organize supersede rõ ràng các boundary cũ D39 và D47 của spec ingestion cho riêng workflow Organize: editor project được xác nhận write-back cả bốn định dạng; các nguyên tắc provenance, ChangeSet, version, conflict và audit vẫn được giữ.

## System Decision Impact

- Impact: draft new / replacement boundary.
- Decision: @decision/20260809-2116-organize-extends-source-write-back-boundary-with-explicit-preview-and-confirmation
- Governing context: @doc/specs/2026-08-09/local-file-ingestion-and-synchronization
- Acceptance gate: System Decision draft phải được review/accept; implementation phải chứng minh write-back của Organize không làm mất Raw/source locator, không sửa lịch sử bất biến, chặn stale/locked/conflict và không tạo import lặp do self-write.

## Requirements

### Functional Requirements

- FR-1: Khi mở Organize trong một project active, hệ thống tải dữ liệu nghiệp vụ, file/import, trạng thái xử lý và liên kết nguồn từ boundary dữ liệu hiện có; fixture chỉ được dùng làm empty/loading fallback, không phải nguồn dữ liệu chính.
- FR-2: Hiển thị cây nhóm nhiều cấp và danh sách hợp nhất cho object/file/import; panel chi tiết hiển thị metadata, nhóm, tag, trạng thái lifecycle, source file/version và source locator khi có.
- FR-3: Người dùng tạo, đổi tên, di chuyển và archive nhóm; hệ thống từ chối liên kết tạo vòng và giữ nguyên các nhóm/data khác khi thao tác thất bại.
- FR-4: Một object, file hoặc import có thể được gán nhiều nhóm và nhiều tag; tag có thể dùng xuyên qua nhiều nhánh nhóm.
- FR-5: Hỗ trợ tìm kiếm/lọc theo text, loại dữ liệu, nhóm, tag, trạng thái lifecycle, trạng thái import và file nguồn; lựa chọn lọc phải thể hiện rõ trong UI.
- FR-6: Hỗ trợ thao tác đơn và hàng loạt để gán/bỏ nhóm, thêm/bỏ tag, di chuyển, archive và khôi phục; kết quả thành công/thất bại phải hiển thị theo mục.
- FR-7: Xóa nhóm chỉ xóa các membership links của nhóm đó; dữ liệu, tag, file/import và nhóm con không bị xóa. Xóa dữ liệu dùng soft-delete/thùng rác và có thể khôi phục; hard-delete nằm ngoài luồng Organize thông thường.
- FR-8: Thay đổi nhóm/tag/metadata trong Organize cập nhật canonical state và liên kết file/import thông qua ChangeSet hoặc boundary mutation hiện có; trước khi write-back, nội dung file nguồn không bị sửa.
- FR-9: Từ một hoặc nhiều mục đã chọn, người dùng tạo write-back operation và chọn từng file đích, chế độ cập nhật tại chỗ hoặc tạo file mới, cùng chiến lược xử lý nhiều file.
- FR-10: Write-back hỗ trợ Excel, Markdown, TXT và Word. Adapter phải giữ nội dung không quản lý, source locator và liên kết object; metadata quản lý và cấu trúc nội dung được cập nhật theo format.
- FR-11: Với format có cấu trúc nhận diện được, hệ thống tạo kế hoạch tái cấu trúc theo cấu trúc hiện có. Với format/đoạn nội dung không nhận diện an toàn, hệ thống dừng ở preview và yêu cầu mapping thủ công trước khi cho xác nhận.
- FR-12: Preview write-back hiển thị file đích, version/hash hiện tại, thay đổi metadata/nội dung, thêm/xóa/di chuyển theo group, backup/destination và cảnh báo rủi ro; không có thao tác ghi thật trước xác nhận.
- FR-13: Chỉ project editor mới có thể xác nhận write-back. Mọi thao tác ghi phải kiểm tra hash/version kỳ vọng, file lock và thay đổi unmanaged; stale, locked hoặc conflict chưa giải quyết phải bị chặn.
- FR-14: Người dùng chọn chiến lược cho batch nhiều file: tiếp tục độc lập theo từng file hoặc all-or-nothing. Kết quả từng file, backup, version mới và lỗi phải được ghi nhận rõ.
- FR-15: Sau write-back thành công, hệ thống tạo backup/version bất biến, ghi audit và liên kết version mới với object/import. Restore phải tạo write job/ChangeSet mới và không mutate version lịch sử.
- FR-16: Watcher/self-write provenance nhận diện thay đổi do Organize tạo ra và không enqueue import trùng; thay đổi vẫn được version hóa và audit.
- FR-17: Audit append-only cho create/update membership, tag, archive/restore, write-back, conflict, backup, restore và failure; lưu actor, timestamp, operation, before/after, source file/version, correlation và kết quả.
- FR-18: Các thay đổi không làm mất dữ liệu nguồn: nội dung phải được giữ dưới dạng mapped, unmapped, invalid, skipped hoặc Raw cùng source locator theo contract ingestion hiện có.

### Non-Functional Requirements

- NFR-1: Không được có đường tắt ghi file nguồn ngoài preview + explicit confirmation + safety checks.
- NFR-2: Quan hệ nhóm là đồ thị có hướng không chu kỳ; thao tác tạo/sửa membership phải được kiểm tra trước khi commit.
- NFR-3: Canonical mutation, file version, ChangeSet và audit phải tuân theo project authorization và tính bất biến của các workflow hiện có.
- NFR-4: UI phải dùng semantic controls, trạng thái loading/error/empty rõ ràng, keyboard/focus behavior phù hợp với desktop UI hiện có.
- NFR-5: Hệ thống phải hiển thị trạng thái queue, processing, conflict, failed và write-back result; chưa đặt ngưỡng hiệu năng cố định, cần ghi baseline trong verification.
- NFR-6: Write-back phải có khả năng khôi phục từ backup/version và không làm mất nội dung unmanaged do thay thế không nguyên tử hoặc lỗi giữa chừng.

## Acceptance Criteria

- [x] AC-1: Mở Organize trong project có dữ liệu thật hiển thị object và file/import từ API/storage hiện có; khi API lỗi, UI giữ trạng thái trước đó và hiển thị lỗi, không hiển thị thành công giả.
- [x] AC-2: Tạo được nhóm chính, nhóm con nhiều cấp và membership tới nhiều nhóm cha; hệ thống từ chối thao tác tạo vòng mà không thay đổi dữ liệu.
- [x] AC-3: Gán nhiều group/tag cho một mục và nhiều mục cùng lúc; sau reload, membership/tag vẫn được giữ và audit event tương ứng tồn tại.
- [x] AC-4: Cây nhóm, danh sách hợp nhất và panel chi tiết đồng bộ selection; filter theo loại dữ liệu, group, tag, lifecycle, import state và source file trả đúng tập kết quả.
- [x] AC-5: Xóa một nhóm chỉ bỏ membership links; dữ liệu và nhóm con vẫn xuất hiện. Archive một object/file/import đưa vào thùng rác và restore đưa nó trở lại danh sách active.
- [x] AC-6: Write-back Excel, Markdown, TXT và Word đều tạo preview diff; nội dung file không đổi trước xác nhận.
- [x] AC-7: Với source structure nhận diện được, preview thể hiện thay đổi metadata và tái cấu trúc theo group; với structure không nhận diện được, hệ thống yêu cầu mapping thủ công và không cho confirm khi mapping thiếu.
- [x] AC-8: Chỉ editor của project xác nhận được write-back; thao tác từ user không có quyền bị từ chối và không sửa file/canonical state.
- [x] AC-9: Stale hash, file bị khóa, unmanaged content conflict hoặc mapping conflict làm write-back dừng trước replace; UI hiển thị nguyên nhân và diff cần xử lý.
- [x] AC-10: Người dùng chọn được in-place hoặc new-file và chiến lược batch; mỗi file thành công có backup/version/audit, mỗi file lỗi có kết quả lỗi độc lập hoặc toàn batch rollback theo lựa chọn.
- [x] AC-11: Restore tạo version/write job mới; file history cũ còn nguyên; watcher không tạo import lặp cho hash do Organize vừa ghi.
- [x] AC-12: Audit truy vết được thao tác group/tag/archive/restore/write-back từ actor đến before/after, source locator, file version và kết quả.
- [x] AC-13: Test/typecheck/build/validation của các package bị ảnh hưởng và Knowns SDD validation pass; diff không chứa lỗi whitespace.

## Scenarios

### Scenario 1: Phân loại object và file nguồn

**Given** project active có canonical objects, file registry và import records
**When** người dùng mở Organize, tạo nhóm “Khu vực A”, gán object cùng file liên quan vào nhóm và thêm tag “ưu tiên”
**Then** cây nhóm, danh sách hợp nhất và panel chi tiết hiển thị liên kết mới; canonical metadata, source link và audit được cập nhật; file gốc chưa bị sửa.

### Scenario 2: Membership nhiều nhóm và chống vòng

**Given** nhóm “Hạ tầng” có nhóm con “Camera” và “Mạng”
**When** người dùng gán một object vào “Camera” và một nhóm con khác, sau đó thử đặt “Hạ tầng” làm con của chính descendant của nó
**Then** memberships hợp lệ được lưu; thao tác tạo vòng bị từ chối mà không làm thay đổi đồ thị.

### Scenario 3: Bulk management và thùng rác

**Given** danh sách đang lọc theo một file nguồn
**When** người dùng chọn nhiều object/file, thêm tag, gán hai nhóm và archive một phần selection
**Then** từng kết quả được hiển thị; audit lưu membership/tag/archive; mục archived biến mất khỏi active view và có thể restore.

### Scenario 4: Write-back có preview và xác nhận

**Given** object đã được gán lại group và file nguồn có version/hash đã biết
**When** editor chọn write-back, chọn tạo file mới, xem preview diff và xác nhận
**Then** file mới được tạo theo format, version/backup/audit được đăng ký, canonical/source links trỏ đúng kết quả, và file gốc vẫn còn nguyên.

### Scenario 5: Cấu trúc nguồn không chắc chắn

**Given** TXT hoặc Word có nội dung không có heading/record boundary nhận diện được
**When** người dùng yêu cầu tái cấu trúc theo group
**Then** hệ thống hiển thị vùng không chắc chắn và yêu cầu mapping thủ công; không có write job được confirm nếu mapping chưa đủ.

### Scenario 6: Conflict và stale source

**Given** file nguồn đã thay đổi ngoài Organize sau khi preview được tạo
**When** editor xác nhận write-back
**Then** hash/version check phát hiện stale/conflict, write bị chặn trước khi thay file, diff mới và lựa chọn xử lý được hiển thị; canonical state không bị ghi đè âm thầm.

### Scenario 7: Restore và self-write suppression

**Given** một write-back trước đó đã tạo file version mới
**When** editor restore version cũ thông qua Organize
**Then** restore tạo write job/ChangeSet và version mới, audit liên kết được nguyên nhân; watcher nhận diện self-write và không tạo import trùng.

## Technical Notes

- Tái sử dụng contract hiện có cho Raw, source locator, immutable file version, ChangeSet, sync queue, audit và self-write markers.
- Frontend prototype hiện nằm trong `apps/web/src/App.tsx` và `apps/web/src/styles.css`; cần thay fixture Organize bằng adapter/state thật sau khi API contract được xác nhận.
- Cần giữ project root-directory safety: Organize không được tự ý xóa, di chuyển hoặc đổi tên thư mục gốc; chế độ tạo file mới phải có destination rõ ràng.
- Write-back Markdown/TXT/Word là capability mới của riêng Organize và phải có format adapter, backup/version và verification riêng; không được sửa behavior của các flow ingestion không đi qua Organize.
- Chi tiết serializer/marker cho từng format, API endpoint cụ thể và phân rã task là công việc của planning, không phải quyết định sản phẩm trong spec này.

## Task Links

- @task-00yzz4 [organize-01] Implement Organize domain graph, groups, tags and lifecycle — todo
- @task-uo3utj [organize-02] Connect Organize API to canonical data, sources, ChangeSets and audit — todo
- @task-ixi4i2 [organize-03] Connect Organize UI to real data and bulk management — todo
- @task-ffh54s [organize-04] Implement Excel write-back planning and preview — todo
- @task-mtb31t [organize-05] Implement Markdown TXT and Word write-back adapters — todo
- @task-bl6p7t [organize-06] Implement write-back safety batch restore and self-write handling — todo
- @task-j95djb [organize-07] Verify Organize integration audit trace and SDD coverage — todo

## Open Questions

- [ ] Metadata quản lý trong Markdown/TXT/Word sẽ dùng marker/frontmatter/section nào cho từng format?
- [ ] Batch all-or-nothing cần transaction coordinator chung hay chỉ dùng compensation/restore giữa các adapter?
- [ ] Panel audit và panel restore nằm trong Organize hay deep-link sang audit workflow hiện có?
- [ ] Cần bổ sung browser-based smoke/e2e harness để kiểm tra layout desktop 1280×800 và thao tác hàng loạt hay chưa?
