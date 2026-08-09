---
title: Project create and delete lifecycle
description: Specification for creating, switching, archiving and deleting projects without deleting root-directory data.
createdAt: '2026-08-09T13:45:35.495Z'
updatedAt: '2026-08-09T14:28:15.595Z'
tags:
  - spec
  - approved
  - project-lifecycle
---

## Overview

Hoàn thiện vòng đời project trong desktop app và API: liệt kê/chuyển project, tạo project từ thư mục gốc có sẵn, archive/khôi phục và xóa project theo semantics không phá hủy dữ liệu cục bộ.

Mục tiêu là để người dùng quản lý project thật trong workspace thay vì project switcher placeholder, đồng thời bảo vệ tuyệt đối thư mục gốc và dữ liệu bên trong.

## Locked Decisions

- D1: Phạm vi là full flow desktop + API, gồm danh sách/chuyển project, tạo, archive và xóa.
- D2: Có hai lựa chọn lifecycle: archive hoặc xóa vĩnh viễn.
- D3: Phiên bản này chưa cần phân quyền; dùng boundary hiện có của ứng dụng.
- D4: Form tạo chỉ nhập name; hệ thống tự sinh code duy nhất và trim khoảng trắng.
- D5: Tạo xong tự chọn project mới; xóa project đang chọn thì chọn project còn lại đầu tiên, hoặc empty state nếu không còn.
- D6: Project archived bị ẩn khỏi danh sách mặc định, có bộ lọc và nút khôi phục.
- D7: Xóa vĩnh viễn yêu cầu modal cảnh báo và nhập chính xác tên project.
- D8: D9: Xóa vĩnh viễn là tombstone; project bị đánh dấu đã xóa và không còn là project hoạt động, nhưng toàn bộ dữ liệu hệ thống vẫn được giữ nguyên.
- D10: Không có khôi phục trực tiếp cho project đã xóa vĩnh viễn; muốn dùng lại dữ liệu, người dùng tạo project mới từ thư mục gốc.
- D11: Tạo project yêu cầu chọn một thư mục gốc có sẵn; hệ thống không tự tạo thư mục gốc.
- D12: Một thư mục gốc chỉ được gắn với một project; thư mục đã dùng phải bị từ chối khi tạo project mới.

## System Decision Impact

- Impact: draft new
- Decision: Chưa có System Decision accepted liên quan đến lifecycle project.
- Acceptance gate: kiểm thử tích hợp phải chứng minh archive/xóa không sửa, di chuyển hoặc xóa thư mục gốc; kiểm thử lifecycle phải chứng minh tombstone vẫn giữ toàn bộ dữ liệu hệ thống.

## Requirements

### Functional Requirements

- FR-1: Desktop app phải tải và hiển thị danh sách project active; người dùng có thể chọn/chuyển project từ project switcher.
- FR-2: Desktop app phải hiển thị trạng thái empty state khi không có project active.
- FR-3: Người dùng phải tạo được project bằng name và một thư mục gốc tồn tại trên máy.
- FR-4: Hệ thống phải trim name, từ chối name rỗng và tự sinh code duy nhất cho project mới.
- FR-5: Hệ thống phải từ chối thư mục gốc đã được gắn với project khác và trả lỗi có thể hiển thị cho người dùng.
- FR-6: Sau khi tạo thành công, project mới phải được thêm vào danh sách active và trở thành project đang chọn.
- FR-7: Archive phải đánh dấu project là archived, loại khỏi danh sách mặc định nhưng vẫn cho phép lọc và khôi phục.
- FR-8: Khôi phục project archived phải đưa project trở lại danh sách active và giữ nguyên thư mục gốc cùng dữ liệu.
- FR-9: Xóa vĩnh viễn phải yêu cầu người dùng chọn đúng thao tác xóa, xem cảnh báo và nhập chính xác tên project.
- FR-10: Xóa vĩnh viễn phải tạo tombstone/đánh dấu project đã xóa và loại project khỏi workspace active; không được cung cấp nút khôi phục trực tiếp.
- FR-11: Khi xóa project đang chọn, app phải chọn project active còn lại đầu tiên; nếu không còn project active, hiển thị empty state.
- FR-12: Trong cả archive và xóa vĩnh viễn, hệ thống tuyệt đối không được xóa, di chuyển, đổi tên hoặc sửa file/thư mục trong thư mục gốc.
- FR-13: Xóa vĩnh viễn phải giữ nguyên toàn bộ dữ liệu hệ thống của project, gồm metadata, canonical, raw/import history, audit, cache và local sync queue.
- FR-14: Người dùng muốn dùng lại project đã xóa phải có thể tạo project mới từ thư mục gốc đã được giữ lại; project mới không được tự động khôi phục project cũ.
- FR-15: Nếu API hoặc thao tác lifecycle thất bại, UI phải giữ trạng thái project trước thao tác và hiển thị lỗi rõ ràng; không được hiển thị thành công giả.

### Non-Functional Requirements

- NFR-1: Thao tác archive/xóa phải có boundary filesystem an toàn, không gọi thao tác xóa/di chuyển/ghi lên root directory.
- NFR-2: Các control tạo, archive, khôi phục và xóa phải dùng semantic labels, trạng thái loading và focus/keyboard behavior phù hợp với desktop UI hiện có.
- NFR-3: Lifecycle state phải được biểu diễn nhất quán giữa API response, project switcher và bộ lọc danh sách.

## Acceptance Criteria

- [x] AC-1: Người dùng mở project switcher và thấy danh sách active, có thể chuyển sang một project khác.
- [x] AC-2: Người dùng tạo project bằng name hợp lệ và thư mục gốc có sẵn; project mới xuất hiện và được chọn tự động.
- [x] AC-3: Name rỗng sau khi trim bị từ chối; code được tự sinh và không trùng với code project hiện có.
- [x] AC-4: Chọn thư mục gốc đã được sử dụng bị từ chối và không tạo project một phần.
- [x] AC-5: Archive project làm project biến khỏi danh sách mặc định, xuất hiện trong bộ lọc archived và có thể khôi phục.
- [x] AC-6: Xóa vĩnh viễn chỉ thành công sau khi người dùng nhập đúng tên project trong modal cảnh báo; nhập sai không làm thay đổi project.
- [x] AC-7: Sau xóa vĩnh viễn, project bị đánh dấu deleted/tombstone và không còn selectable trong workspace active, nhưng toàn bộ metadata, canonical, raw/import history, audit, cache, local sync queue và root directory vẫn tồn tại.
- [x] AC-8: Không có thao tác archive/xóa nào làm thay đổi checksum, nội dung, đường dẫn hoặc danh sách file của thư mục gốc.
- [x] AC-9: Project đã deleted không có nút khôi phục trực tiếp; tạo project mới từ cùng thư mục gốc tạo một project identity mới.
- [x] AC-10: Khi xóa project hiện tại, app chọn project active đầu tiên còn lại; nếu danh sách rỗng, app hiển thị empty state.
- [x] AC-11: Lỗi API/filesystem validation không làm UI chuyển sang trạng thái thành công hoặc làm mất project khỏi danh sách.

## Scenarios

### Scenario 1: Tạo project và chuyển sang project mới

**Given** người dùng đang ở project switcher và chọn một thư mục gốc tồn tại chưa được sử dụng

**When** người dùng nhập name hợp lệ và gửi form tạo project

**Then** API tạo project với code duy nhất, project xuất hiện trong danh sách active và được chọn tự động

### Scenario 2: Từ chối thư mục gốc trùng

**Given** thư mục gốc đã gắn với một project khác

**When** người dùng dùng thư mục đó để tạo project

**Then** hệ thống từ chối thao tác, hiển thị lỗi thư mục đã được sử dụng và không tạo bản ghi project mới

### Scenario 3: Archive và khôi phục

**Given** project active có thư mục gốc chứa dữ liệu

**When** người dùng chọn Archive rồi mở bộ lọc archived và chọn Khôi phục

**Then** project biến khỏi danh sách active trong thời gian archived, trở lại danh sách active sau khi khôi phục, và thư mục gốc không thay đổi

### Scenario 4: Xóa vĩnh viễn không phá hủy dữ liệu

**Given** project có metadata, canonical, raw/import history, audit, cache, local sync queue và thư mục gốc

**When** người dùng chọn Xóa vĩnh viễn, nhập chính xác tên project và xác nhận

**Then** project chuyển sang tombstone/deleted, không còn là project active, mọi dữ liệu hệ thống vẫn còn, và toàn bộ thư mục gốc cùng file bên trong giữ nguyên

### Scenario 5: Xóa project hiện tại cuối cùng

**Given** chỉ còn một project active và project đó đang được chọn

**When** người dùng archive hoặc xóa project đó thành công

**Then** project switcher hiển thị empty state và không còn project active được chọn

### Scenario 6: Xác nhận xóa sai

**Given** modal xóa vĩnh viễn đang mở

**When** người dùng nhập tên khác với tên project

**Then** nút xác nhận bị từ chối hoặc thao tác trả lỗi, project và dữ liệu không thay đổi

## Technical Notes

- Code hiện có API tạo project với contract code/name và CameraStore in-memory; spec này yêu cầu mở rộng contract lifecycle/listing mà không coi in-memory là persistence cuối cùng.
- Frontend hiện có project switcher placeholder trong apps/web/src/App.tsx; cần nối vào API và state project đang chọn.
- Root directory là tài nguyên người dùng sở hữu: lifecycle service chỉ cập nhật trạng thái/metadata quản lý, không được dùng filesystem deletion, move, rename hoặc write trong root.
- Tombstone cần đủ thông tin để loại khỏi workspace active nhưng vẫn giữ dữ liệu cho đối soát và cho phép tạo project identity mới từ cùng root directory.
- Việc chọn project active “đầu tiên” phải dùng thứ tự ổn định do API trả về, không phụ thuộc thứ tự object/map không xác định.

## Task Links

- @task-lvnfek [project-create-and-delete-lifecycle-01] Backend project lifecycle API/domain — done
- @task-alcq89 [project-create-and-delete-lifecycle-02] Desktop project management UI — done
- @task-xbj732 [project-create-and-delete-lifecycle-03] Integrated safety verification — done

## Open Questions

- [ ] Quy tắc định dạng code tự sinh (sequence, UUID rút gọn hay quy tắc khác)?
- [ ] Project tombstone có cần xuất hiện trong một màn hình chẩn đoán nội bộ hay hoàn toàn ẩn khỏi UI?
- [ ] “Thư mục gốc có sẵn” có cần kiểm tra quyền đọc/ghi và symlink trước khi tạo không?
