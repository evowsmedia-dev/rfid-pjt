# Tre ERP Docs Admin Editing Guide

## Mục tiêu

Cho phép admin đăng nhập, mở bất kỳ page tài liệu HTML nào trên `rfid-pjt.vercel.app`, chỉnh sửa text hoặc ảnh minh họa trực tiếp trên page mà không thay đổi UI dành cho người xem.

Nội dung sau khi lưu không nằm ở cache trình duyệt. Hệ thống ghi thay đổi vào GitHub:

- Text override: `content-overrides.json`.
- Ảnh upload: `content-assets/<page>/<key>-<timestamp>.<ext>`.

Ảnh được load qua `/api/content-asset?path=...`, nên preview và FE người xem có thể hiển thị ngay sau khi upload, không cần chờ Vercel deploy static asset mới.

## Biến môi trường trên Vercel

Cần cấu hình:

- `GITHUB_TOKEN`: token có quyền đọc/ghi repo.
- `GITHUB_REPO`: mặc định có thể để `evowsmedia-dev/rfid-pjt`.
- `GITHUB_BRANCH`: mặc định `main`.
- `ADMIN_PASSWORD`: mật khẩu admin dùng tại `/admin.html`.
- `AUTH_SECRET`: chuỗi bí mật để ký cookie đăng nhập.

`DOCS_EDIT_PASSWORD` vẫn được hỗ trợ như fallback tương thích, nhưng nên dùng `ADMIN_PASSWORD` + `AUTH_SECRET` cho cơ chế mới.

## Luồng sử dụng

1. Mở `/admin.html`.
2. Nhập mật khẩu admin.
3. Sau khi đăng nhập, mở page cần sửa.
4. Bấm nút `Bật sửa` ở thanh công cụ góc dưới.
5. Click trực tiếp vào nội dung text để sửa. Hệ thống tự lưu sau khi nhập hoặc blur khỏi vùng sửa.
6. Khi click vào một box text, toolbar nhỏ sẽ hiện gần box đó:
   - `Copy box`: copy toàn bộ HTML trong box hiện tại.
   - `Paste vào box`: dán nội dung box đã copy vào box đang chọn.
   - `Thêm ảnh`: upload ảnh từ máy và chèn ảnh vào trong box đang chọn.
7. Với ảnh minh họa có sẵn, bấm `Đổi ảnh` hoặc dùng nút upload ảnh sẵn có trên page HR. Ảnh được upload vào repo và override cho mọi người xem.
8. Bấm `Thoát` để đăng xuất admin.

Có thể mở trực tiếp link cũ dạng `?edit=1` hoặc `#step1?edit=1`; nếu chưa đăng nhập, hệ thống sẽ chuyển sang `/admin.html` rồi quay lại page đó.

## Cách thêm page HTML mới

Thêm file `.html` vào root hoặc thư mục `docs/` như bình thường.

Trong quá trình build/deploy, script sau sẽ tự gắn editor vào các file HTML chưa có:

```bash
npm run build
```

Script này chạy `scripts/inject-admin-editor.js` và bỏ qua `admin.html`. Nếu cần gắn thủ công, thêm trước `</body>`:

Root page:

```html
<script src="assets/admin-editor.js"></script>
```

Page trong `docs/`:

```html
<script src="../assets/admin-editor.js"></script>
```

## API liên quan

- `POST /api/admin-login`: đăng nhập admin, tạo cookie HttpOnly.
- `POST /api/admin-logout`: đăng xuất.
- `GET /api/admin-session`: kiểm tra trạng thái đăng nhập.
- `GET /api/docs-content?page=/path.html`: đọc override public.
- `POST /api/docs-content`: lưu/xóa override text hoặc ảnh, yêu cầu admin session.
- `POST /api/page-image`: upload ảnh vào repo, yêu cầu admin session.
- `GET /api/content-asset?path=content-assets/...`: đọc ảnh đã upload từ GitHub để hiển thị public.

## Ghi chú kỹ thuật

- UI gốc của tài liệu không đổi với người xem thường.
- Thanh công cụ admin chỉ xuất hiện sau khi đăng nhập.
- Các key text được sinh theo vùng gần nhất có `id` và thứ tự tag, ví dụ `ch1:p:1`.
- Ảnh minh họa HR có key ổn định theo bước, ví dụ `step1:image`.
- Ảnh chèn inline vào box text được upload vào `content-assets/` rồi lưu URL proxy `/api/content-asset?path=...` trong HTML override của box đó.
- Ảnh tối đa 5MB, hỗ trợ PNG, JPG, WEBP và GIF.
