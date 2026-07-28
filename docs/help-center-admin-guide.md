# Hướng dẫn quản trị Tre Support

## Mục tiêu

Tre Support dùng chung một web app cho nội bộ và khách hàng ngoài, nhưng nội dung hướng dẫn và file đính kèm được tách riêng theo tenant.

Phần demo/giải pháp của Tre Support là public. Người dùng chỉ cần đăng nhập khi muốn xem bộ HDSD riêng theo tài khoản nội bộ hoặc khách hàng ngoài.

## Đăng nhập người dùng

- Người dùng nội bộ đăng nhập vào tenant `internal`.
- Người dùng khách hàng ngoài đăng nhập vào tenant riêng của khách hàng.
- Frontend không tự chọn tenant bằng URL hoặc localStorage; API luôn lấy tenant từ session đăng nhập.

Tài khoản seed để kiểm thử:

- `internal` / `internal123`
- `customer-a` / `khach123`
- `customer-b` / `khach123`

Khi vận hành thật cần thay mật khẩu seed hoặc chuyển sang danh sách tài khoản chính thức do Tre cấp.

## Quản trị nội dung

1. Vào `/admin.html` và đăng nhập admin.
2. Mở `/help-admin.html`.
3. Chọn đúng `Phạm vi nội dung`: Nội bộ hoặc khách hàng ngoài.
4. Chọn bài hiện có hoặc bấm `Bài mới`.
5. Nhập module, nền tảng, tiêu đề, mô tả, từ khóa, các bước hướng dẫn và lưu ý.
6. Upload ảnh, video hoặc tài liệu đính kèm nếu cần.
7. Bấm `Lưu bài`.

Nội dung sau khi lưu được ghi vào `help-center-content.json` trên GitHub để production phục vụ lại cho mọi người xem thuộc tenant tương ứng.

## Upload file

File Tre Support được lưu tại:

`content-assets/help-center/<tenantId>/<articleId>/<file-name>`

Giới hạn V1:

- Ảnh `png/jpg/webp/gif`: tối đa 5MB.
- Video `mp4/webm/mov`: tối đa 50MB.
- Tài liệu `pdf/doc/docx/xls/xlsx/ppt/pptx`: tối đa 20MB.

Sau khi upload, admin cần bấm `Lưu bài` để file được gắn vào article cho người xem.

## Kiểm tra tách tenant

- Login `internal` chỉ thấy nội dung nội bộ.
- Login `customer-a` chỉ thấy nội dung Khách hàng A.
- Login `customer-b` chỉ thấy nội dung Khách hàng B.
- Link file Tre Support chỉ mở được khi có session đúng tenant hoặc session admin.
