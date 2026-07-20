# Kế hoạch tổng hợp dự án RFID TNG

## 1. Mục tiêu dự án

Dự án xây dựng hệ thống quản lý kho tích hợp RFID cho kho nguyên liệu, kho phụ liệu, bán thành phẩm và thành phẩm. Hệ thống cần kết nối ERP/WMS, ứng dụng di động trên PDA Zebra-class, đầu đọc Zebra RFD4031 và cơ chế quản lý song song QR Code + RFID.

Mục tiêu chính:

- Giảm thời gian nhập, xuất, kiểm kê và tìm hàng bằng bulk RFID scan.
- Giảm lỗi xuất nhầm, nhập nhầm, sai vị trí, thiếu/thừa hàng nhờ đối chiếu tự động.
- Cập nhật tồn kho, vị trí, trạng thái tag và WIP gần realtime.
- Hỗ trợ truy xuất vòng đời nguyên phụ liệu, BTP, TP và vòng đời thẻ RFID.
- Duy trì QR Code trong giai đoạn chuyển đổi, đồng thời bổ sung RFID cho các tác vụ cần tốc độ và độ chính xác cao.

## 2. Tài liệu đã rà soát

- `docs/index.html`: tổng quan hệ thống kho RFID, liên kết ERP/WMS, Mobile App, PDA Zebra RFD4031, QR + RFID.
- `docs/02-process-flow.html`: 15 quy trình nghiệp vụ RFID từ nhập kho NPL đến kho thành phẩm.
- `docs/05-kho-nguyen-lieu-analysis.html`: phân tích AS-IS/TO-BE app Kho nguyên liệu (vải).
- `docs/04-sitemap-analysis.html`: phân tích AS-IS/TO-BE app Kho phụ liệu.
- `docs/pda-mockup-kho-nguyen-lieu.html`: mockup PDA TO-BE cho Kho nguyên liệu.
- `docs/pda-mockup-kho-PL.html`: mockup PDA TO-BE cho Kho phụ liệu.

## 3. Phạm vi nghiệp vụ

### 3.1 Kho nguyên phụ liệu

Bao gồm nhập kho NPL, xuất kho NPL, tìm cuộn/thùng, kiểm kho, cập nhật vị trí, stock, trực quan kho và xử lý chênh lệch. Kho nguyên liệu quản lý theo cây/cuộn vải; kho phụ liệu quản lý theo carton/thùng/phụ liệu.

### 3.2 Sản xuất và BTP

Bao gồm quy trình cắt, tháo/gắn RFID từ nguyên liệu sang bó BTP, nhập kho BTP, cấp phát BTP lên chuyền, tách bó theo quan hệ Parent-Child RFID, phụ trợ in/thêu/laze, và theo dõi WIP trên chuyền may.

### 3.3 KCS, hoàn thiện và thành phẩm

Bao gồm KCS Endline đạt/không đạt, giặt sấy, tổ hoàn thiện, scan qua hầm RFID, đối soát PO/màu/cỡ/số lượng, nhập/xuất kho thành phẩm và tìm hàng/thùng thiếu bằng RFID.

### 3.4 Vòng đời thẻ RFID

Bao gồm gắn tag, scan, đổi tag, thu hồi, clear dữ liệu, phân loại tag tốt/hỏng, đưa về kho thẻ sạch, tái sử dụng hoặc hủy tag.

## 4. Quy trình nghiệp vụ cốt lõi

1. Nhập kho NPL: nhận hàng từ NCC, đối chiếu PO/số lượng/chất lượng, gắn RFID, scan nhập kho, xử lý chênh lệch hoặc trả NCC.
2. Xuất kho NPL: nhận lệnh xuất, chuẩn bị hàng, scan RFID hàng loạt, đối chiếu lệnh, cảnh báo thiếu/thừa/sai mã/sai lot, cập nhật tồn và bàn giao.
3. Tìm cuộn trong danh sách xuất: dùng Zebra RFD4031 ở Geiger-counter mode, định vị theo RSSI, xác nhận tag đúng lệnh.
4. Kiểm kho: tạo đợt kiểm kê, bulk scan theo khu vực, đối chiếu ERP, phân loại thiếu/thừa/sai vị trí/tag lỗi, xử lý và cập nhật tồn.
5. Thu hồi và tái sử dụng RFID: tháo tag khỏi BTP/TP, test đọc, clear dữ liệu, đưa về kho thẻ sạch hoặc hủy.
6. Quy trình cắt: xuất cuộn vải có RFID, cắt, tháo RFID nguyên liệu, bó BTP, gắn RFID bó BTP, QC, nhập kho BTP.
7. Nhà cắt lên chuyền: tìm và scan bó BTP, cấp phát lên chuyền, tách bó Parent-Child, điều chuyển tổ, xuất phụ trợ, trả lỗi về kho.
8. Cấp nhãn RFID lên chuyền may: cấp thẻ từ kho thẻ sạch, bàn giao cho chuyền, ghi nhận trạng thái tag đã cấp.
9. Phụ trợ in/thêu/laze: scan xuất BTP, bàn giao phụ trợ, giữ nguyên tag gốc sau gia công, KCS, scan nhập lại kho BTP.
10. Trên chuyền may: scan nhập chuyền, theo dõi WIP realtime, cảnh báo sai quy trình/ùn tắc/chậm tiến độ, chuyển TP sang KCS.
11. KCS Endline: scan SP đạt, ghi nhận lỗi, chuyển sửa hoặc hủy, thu hồi tag với SP hủy.
12. KCS sang giặt sấy: scan bàn giao tổ giặt, kiểm tra sau giặt, scan hàng loạt SP đạt, bàn giao hoàn thiện.
13. Hoàn thiện: scan qua hầm RFID, hoàn thiện/đóng gói, đối soát PO/màu/cỡ/số lượng, cập nhật Ready for FG.
14. Nhập/xuất kho TP: nhập theo RFID khách hàng hoặc QR thùng sau khi gỡ RFID, xuất kho theo lệnh bằng RFID.
15. Tìm thùng/hàng thiếu kho TP: lọc tag thiếu, dùng RFD4031 định vị theo RSSI/âm thanh/đèn, cập nhật vị trí/trạng thái.

## 5. Nâng cấp ứng dụng Kho nguyên liệu

Hiện trạng Kho nguyên liệu có khoảng 23 màn hình, gồm 17 màn nghiệp vụ xuất/nhập, 4 màn kho/vị trí và 2 màn báo cáo. App đang có field `RFID:` trong form chi tiết cuộn vải nhưng chưa dùng. Các vấn đề chính là màu CTA không nhất quán, badge "Đã dán" mơ hồ, form dày, empty state chỉ có "Data is empty", thao tác xóa cuộn thiếu xác nhận và chưa có RFID scan hàng loạt.

Nâng cấp đề xuất:

- Home: thêm widget trạng thái Zebra RFD4031, số tag hôm nay, coverage %, shortcut Scan RFID hàng loạt.
- Danh sách BBGĐ: thêm badge X/Y RFID tags, progress từng phiếu, sticky search/filter, chuẩn hóa tab Chờ/Đã xử lý.
- Chi tiết cuộn vải: kích hoạt field RFID, hiển thị EPC, trạng thái Đã gắn/Chưa gắn/Lỗi, nút Gắn RFID/Đổi RFID.
- Chi tiết phiếu xuất/nhập: thêm nút RFID Scan tất cả cạnh Quét QRCode, đối chiếu yêu cầu/thực tế ngay sau scan.
- Cập nhật vị trí: thêm Quét RFID hàng loạt cho nhiều cuộn, thay empty state bằng hướng dẫn hành động.
- Trực quan kho: thêm KPI tổng tag/tag OK/tag lỗi/coverage, badge coverage theo khoang, highlight lệch tồn/tag lỗi.
- Stock nguyên liệu: thêm coverage RFID theo mã hàng, filter thiếu tag.
- Cảnh báo quản lý: danh sách cuộn tồn lâu chưa gắn tag, khoang lệch tồn, BBGĐ thiếu tag quá hạn, coverage thấp.

Mockup PDA Kho nguyên liệu đã mô phỏng 9 màn hình, 14 lỗi UX đã sửa và 4 màn RFID mới.

## 6. Nâng cấp ứng dụng Kho phụ liệu

Hiện trạng Kho phụ liệu có khoảng 24 màn hình, gồm 14 màn nghiệp vụ, 6 màn kho/vị trí và 4 màn báo cáo. App hiện thuần QR, scan chủ yếu bằng FAB/camera QR hoặc CTA Quét QRCode. Chưa có field RFID ở màn carton/phụ liệu, chưa có feedback scan tức thì, bảng stock dễ tràn ngang trên PDA và flow tìm thùng còn thủ công.

Nâng cấp đề xuất:

- Home: widget RFID Status, pin/online/tag count, shortcut Scan RFID hàng loạt.
- Danh sách lệnh/phiếu: thêm progress X/Y thùng, badge RFID tags, indicator Đủ/Thiếu tag, sticky search/filter.
- Chi tiết carton: thêm field RFID EPC Tag, trạng thái Đã gắn/Chưa gắn/Lỗi, nút Gắn RFID/Đổi RFID.
- Chi tiết phụ liệu: thêm field RFID, lịch sử scan/di chuyển vị trí.
- Chi tiết lệnh xuất/chuyển/nội bộ: thêm RFID Bulk Scan, counter Khớp/Thiếu/Sai/Tag lỗi, cảnh báo realtime.
- Cập nhật vị trí thùng: thêm Scan RFID song song QR, scan nhiều thùng cùng lúc.
- Trực quan kho PL: thêm badge tag count theo ô vị trí, indicator tag lỗi, KPI coverage tổng kho.
- Stock kho PL: thêm cột/metric RFID Coverage %, filter trạng thái RFID.
- Màn hình mới: RFID Bulk Scan và Geiger tìm thùng theo RSSI.

Mockup PDA Kho phụ liệu đã mô phỏng 9 màn hình, 12 lỗi UX đã sửa và 5 màn RFID mới.

## 7. Yêu cầu chức năng chính

- QR và RFID chạy song song: QR giữ flow cũ, RFID bổ sung cho bulk scan, tìm hàng và đối soát nhanh.
- Scan RFID đơn lẻ: đọc 1 tag, xem chi tiết cuộn/carton/phụ liệu/SP.
- Scan RFID hàng loạt: đọc nhiều tag trong một phiên, gom kết quả realtime.
- Đối chiếu tự động: so sánh tag scan với lệnh xuất/nhập/kiểm kê theo mã hàng, PO, lot, màu, size, số lượng, trạng thái và vị trí.
- Geiger mode: tìm cuộn/thùng/hàng thiếu bằng RSSI, âm thanh, rung, đèn hoặc thanh tín hiệu.
- Quản lý tag: gắn, đổi, thu hồi, clear, tái sử dụng, hủy, kiểm tra tag lỗi.
- Cập nhật vị trí: scan QR/RFID để chuyển vị trí nhiều cuộn/thùng.
- Dashboard cảnh báo: thiếu tag, tag lỗi, coverage thấp, lệch tồn, tồn lâu, lệnh thiếu/thừa/sai.
- Audit log: lưu user, thời gian, thiết bị, EPC, hành động, vị trí, kết quả đối chiếu.

## 8. Yêu cầu kỹ thuật

### 8.1 Thiết bị và ứng dụng

- PDA Android Zebra-class, tích hợp hoặc kết nối sled Zebra RFD4031.
- Tích hợp Zebra RFD4031 qua DataWedge API hoặc EMDK Android.
- Cần build APK riêng cho PDA kho vải/kho phụ liệu.
- UI PDA ưu tiên tap target lớn, feedback rõ, dùng được khi thao tác nhanh trong kho.

### 8.2 Database

Bổ sung bảng `rfid_tag` với các trường tối thiểu:

- `epc`: mã EPC/tag RFID.
- `entity_type`: roll, carton, pl, btp_bundle, product, box, tag_pool.
- `entity_id`: id đối tượng đang gắn tag.
- `status`: clean, linked, in_use, returned, damaged, void, error.
- `last_scan_at`, `last_scan_device`, `last_scan_user`.
- `last_location_id`.
- `weight_reading` nếu áp dụng cho cuộn vải.

Liên kết chính:

- Kho nguyên liệu: `rfid_tag` liên kết `roll_id`.
- Kho phụ liệu: `rfid_tag` liên kết `carton_id` hoặc phụ liệu/thùng chứa.
- BTP/TP: tag liên kết bó BTP, sản phẩm hoặc thùng thành phẩm.
- Cần lưu lịch sử mapping tag để truy xuất trước/sau khi đổi hoặc thu hồi.

### 8.3 API

Các endpoint nền tảng:

- `POST /rfid/scan-bulk`: gửi danh sách EPC đọc được trong phiên scan.
- `GET /rfid/tag/{epc}`: tra cứu tag và đối tượng liên kết.
- `PUT /rfid/link-roll`: gắn tag với cuộn vải.
- `PUT /rfid/link-carton`: gắn tag với carton/thùng.
- `PUT /rfid/unlink`: gỡ/thu hồi tag.
- `GET /rfid/status`: trạng thái đầu đọc, pin, kết nối, coverage.
- `POST /rfid/audit-log`: ghi log thao tác nếu không ghi tự động ở service.

### 8.4 Offline và đồng bộ

- PDA phải cache local khi mất WiFi, đặc biệt trong kho rộng/nhiều tầng kệ.
- Mỗi scan session cần idempotency key để tránh ghi trùng khi sync lại.
- Khi đồng bộ cần xử lý xung đột: tag đã đổi, tag thuộc lệnh khác, tồn/vị trí đã thay đổi.
- UI phải hiển thị trạng thái chờ sync, sync lỗi và cho phép retry.

### 8.5 Bảo mật và phân quyền

- Phân quyền theo vai trò: thủ kho, QLCL/KCS, quản lý kho, tổ cắt, chuyền may, kho TP.
- Các thao tác nhạy cảm cần xác nhận hoặc quyền cao hơn: điều chỉnh tồn, xóa cuộn khỏi phiếu, hủy SP, hủy tag, ghi nhận chênh lệch chính thức.
- Toàn bộ scan, link/unlink tag, đổi vị trí, xuất/nhập và điều chỉnh phải có audit log.

## 9. Thiết kế UX/UI cần chuẩn hóa

- Dùng 1 màu primary cho hành động chính; tách màu RFID riêng để phân biệt QR/RFID.
- Dùng toast/loading/success/error sau mỗi scan QR hoặc RFID.
- Thêm beep/rung khi RFID đọc thành công; cảnh báo rõ khi sai lệnh/tag lỗi.
- Chuẩn hóa label: dùng thống nhất "Đổi mã QR", "Gắn RFID", "Đổi RFID", "Scan RFID hàng loạt".
- Empty state phải có hướng dẫn hành động tiếp theo, không chỉ hiển thị "No data" hoặc "Data is empty".
- Danh sách cần progress, badge trạng thái tag và filter sticky khi scroll.
- Trực quan kho cần KPI đầu trang và cảnh báo màu cho ô lệch tồn/tag lỗi/coverage thấp.
- Thao tác xóa hoặc điều chỉnh phải có confirm dialog.

## 10. Roadmap đề xuất

### Giai đoạn 0: Quick wins, 1-2 tuần

- Chuẩn hóa tab, màu CTA, label QR/RFID.
- Thêm toast feedback cho scan QR.
- Đổi FAB scan về màu brand, bổ sung loading/empty state.
- Thêm progress bar X/Y trên danh sách phiếu/lệnh.
- Thêm confirm dialog trước thao tác xóa cuộn/carton khỏi phiếu.

### Giai đoạn 1: Core RFID Integration, 4-8 tuần

- Tích hợp Zebra RFD4031 SDK/DataWedge/EMDK.
- Xây dựng scan engine QR + RFID dùng chung.
- Thêm bảng dữ liệu RFID, audit log và API cơ bản.
- Kích hoạt RFID field trong chi tiết cuộn vải/carton.
- Xây màn hình RFID Bulk Scan cho phiếu xuất/nhập/cập nhật vị trí.
- Tách badge QR và RFID.
- Pilot thực tế trên PDA tại 1 nhà máy/kho.

### Giai đoạn 2: Coverage & Visibility, 4-6 tuần

- Thêm RFID status widget trên Home.
- Bổ sung coverage RFID trong Stock và Trực quan kho.
- Thêm filter trạng thái RFID trong danh sách.
- Rollout sau pilot cho nhiều nhà máy/kho.
- Hoàn thiện offline cache/sync và xử lý xung đột.

### Giai đoạn 3: Advanced RFID, 6-10 tuần

- Geiger mode tìm cuộn/thùng/hàng thiếu.
- Dashboard cảnh báo quản lý và push alert.
- Quản lý vòng đời tag đầy đủ: cấp, thu hồi, clear, tái sử dụng, hủy.
- Đối chiếu khối lượng RFID/QR cho kho vải nếu có dữ liệu cân/đọc.
- Tích hợp IoT reader cố định/hầm quét/cổng kho sau khi đánh giá ROI.

## 11. KPI thành công

- RFID Coverage đạt tối thiểu 95% trong 3 tháng đầu pilot.
- Thời gian scan nhập/xuất/kiểm kê giảm tối thiểu 60%; mục tiêu bulk scan 42 thùng hoặc nhiều cuộn trong dưới 30 giây.
- Lỗi xuất nhầm giảm 80% nhờ đối chiếu tự động và cảnh báo realtime.
- Lỗi xóa nhầm cuộn giảm 90% nhờ confirm dialog.
- Tìm thùng/cuộn mục tiêu dưới 2 phút bằng Geiger mode.
- Thời gian phát hiện bất thường dưới 1 ngày nhờ dashboard cảnh báo.
- UX score của nhân viên kho đạt tối thiểu 4/5 sau 1 tháng sử dụng bản nâng cấp.

## 12. Rủi ro và điểm cần làm rõ

- Độ ổn định đọc RFID phụ thuộc môi trường kho, vật liệu, khoảng cách, chồng lấp hàng và vị trí gắn tag.
- Cần thử nghiệm thực tế với Zebra RFD4031 trước khi chốt UX bulk scan, Geiger mode và SLA scan.
- Cần xác định chuẩn EPC, quy tắc mapping tag với cuộn/carton/BTP/TP và chính sách tái sử dụng tag.
- Cần làm rõ nguồn dữ liệu ERP/WMS hiện có, id phiếu/lệnh, cấu trúc bảng roll/carton/stock và cơ chế đồng bộ.
- Cần chính sách phân quyền cho điều chỉnh tồn, hủy tag, hủy SP, xử lý chênh lệch.
- Cần định nghĩa rõ trạng thái offline/sync lỗi để tránh scan trùng hoặc ghi nhận sai.

## 13. Backlog tài liệu còn thiếu

Theo `docs/index.html`, các tài liệu sau còn TODO và nên được tạo tiếp:

- SRS - System Requirements.
- Test Plan tổng thể.
- Test Cases - RFID Scan.
- Test Cases - từng module.
- UAT Script & Checklist.
- Performance - Bulk RFID Scan.
- Hướng dẫn sử dụng.

## 14. Ưu tiên triển khai gần nhất

1. Hoàn thiện SRS và data model RFID.
2. Chốt scope pilot: chọn kho nguyên liệu hoặc kho phụ liệu, chọn 1 nhà máy/kho, chọn 3-5 flow quan trọng nhất.
3. Prototype scan engine trên PDA Zebra RFD4031.
4. Làm Quick wins UI để app dễ dùng hơn ngay cả trước khi SDK RFID sẵn sàng.
5. Xây Bulk Scan + Link RFID cho đối tượng pilot.
6. Chạy UAT tại kho thật, đo coverage, tốc độ scan, lỗi đối chiếu và phản hồi nhân viên kho.

## 15. Nâng cấp Tre ERP Docs

`https://rfid-pjt.vercel.app/` đã được chuyển thành portal `Tre ERP Docs`, nơi tập trung tài liệu cho các module thuộc hệ thống ERP.

Phạm vi đã triển khai:

- Trang chủ `index.html` dùng brand `Tre ERP Docs`.
- Module Nhân sự có tài liệu `HDSD App Đào tạo & Học hỏi CBQL` tại `Di_hoc_hoi.html`.
- Tài liệu RFID hiện có được nhóm vào module Kho.
- Các URL RFID cũ ở root được giữ bằng redirect/stub sang thư mục `docs/`.
- Tất cả page tài liệu được gắn sidebar portal ERP cố định và sidebar nội bộ của tài liệu vẫn giữ nguyên.

## 16. Cơ chế chỉnh sửa nội dung tài liệu

Mục tiêu là cho phép admin chỉnh sửa text, ảnh và video HDSD trên các page HTML hiện có mà không thay đổi UI hiển thị cho người xem thường.

Luồng admin:

1. Truy cập `/admin.html`.
2. Đăng nhập bằng mật khẩu admin.
3. Mở page tài liệu cần sửa.
4. Bấm `Bật sửa` ở thanh công cụ admin.
5. Sửa text trực tiếp trên page hoặc upload/xóa ảnh minh họa, video HDSD hoặc embed YouTube.
6. Copy toàn bộ nội dung một box và paste vào box text khác khi cần tái sử dụng cấu trúc nội dung.
7. Chèn ảnh từ máy vào một box text bất kỳ, thay ảnh minh họa sẵn có, upload video HDSD hoặc dán link YouTube trong admin mode.
8. Thêm hoặc xóa dòng trong các bảng tài liệu khi cần chỉnh cấu trúc bảng.
9. Nội dung được lưu vào GitHub để người khác xem cùng một bản, không phụ thuộc cache/localStorage.
10. Với người xem thường, các control cấu hình như field dán link YouTube được ẩn; người xem chỉ thấy nội dung/player đã được lưu public.

Thành phần kỹ thuật:

- `assets/admin-editor.js`: áp override cho người xem và bật editor cho admin đã đăng nhập.
- `api/admin-login.js`, `api/admin-logout.js`, `api/admin-session.js`: quản lý session admin bằng cookie HttpOnly.
- `api/docs-content.js`: đọc/ghi override nội dung trong `content-overrides.json`.
- `api/page-image.js`: upload ảnh vào `content-assets/` và ghi override ảnh.
- `api/page-video.js`: upload video file vào `content-assets/` và ghi override video.
- YouTube embed được lưu vào `content-overrides.json` với key video ổn định, ví dụ `video:hdsd`.
- Field dán link YouTube trên `/Di_hoc_hoi.html` chỉ hiển thị khi `body.admin-editing`; public viewer không thấy control này.
- `api/content-asset.js`: phục vụ ảnh/video từ GitHub qua URL public để preview/FE hiển thị ngay sau khi upload.
- `scripts/inject-admin-editor.js`: tự gắn editor vào file HTML mới khi build/deploy.
- `docs/admin-editing-guide.md`: tài liệu vận hành cơ chế chỉnh sửa.

Biến môi trường cần có trên Vercel:

- `GITHUB_TOKEN`.
- `GITHUB_REPO`.
- `GITHUB_BRANCH`.
- `ADMIN_PASSWORD`.
- `AUTH_SECRET`.
