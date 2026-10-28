# Phiếu giao việc — GD1 "Giao diện gọn và rõ"

*Soạn 28/10/2026. Chủ dự án vắng qua đêm, giao tự quyết (`SPEC.md` mục 12 ghi "Quyết định khi chủ dự án vắng — GD1"), **không dừng chờ
duyệt**: xong mốc thì commit + tag rồi kết thúc lượt. Thiết kế: `docs/11` mục 3.4 và 5; bản vẽ 5 màn: `docs/10` mục 4.*

## Model gợi ý
**Sonnet 5.5 · Medium** mặc định; F-121 (nâng cấp dữ liệu Chờ duyệt) và F-123 (thêm món theo chữ — đụng đơn) cẩn thận như Opus.
Nhóm phụ: Haiku.

## Trước khi làm
- BH10 đã xong (tag `bh10-san-sang-live`). Tag trước mốc: tạo `truoc-gd1`.
- Đọc: `docs/11` mục **0, 1 (M11), 3.4, 5**; `docs/10` mục **2, 4**. Tra `SPEC.md` bằng grep F-119 → F-125, #140, #141, #151, #152.
- Bản đồ giao diện (đọc mã 28/10/2026): khung `public/index.html` (56 dòng) + `public/js/app.js` (`MAN_HINH` :24-37, `moManHinh` :51-69,
  chip :111-132, ws :157-182); helper `public/js/ui.js` (`h()`, `toast`, `gioPhut`), `api.js`; CSS `public/css/app.css` (487 dòng, token :3-12,
  dark :185-193, chip :82-88, nút :72-80); phông đang tải từ Google (`index.html:7-9`).
- Mã kỹ thuật lộ ra: `public/js/man-hinh/agent.js:222`, `cai-dat.js:298,299,300,303,324,332,344,350,425`; `server/api/agent.js:78`,
  `server/agent/hook/cua.js:19`, `server/cau-hinh/kich-ban-dien-tap.json` dòng 282, 1254, 1281, 1293.
- Hàm tiền: 5 bản (`don.js:24`, `hop-thu.js:28`, `san-pham.js:15`, `live.js:206`, `nguoi-dan.js:375`); 26000 viết cứng
  (`cai-dat-doi-ai.js:45,247`, `cai-dat-giong.js:11`, `live.js:521`); bảng màu trạng thái ~15 bản (`don.js:19`, `san-pham.js:8`,
  `agent.js:22`, `tong-quan.js:21`, `bao-cao.js:28`, `live.js:59`, `app.js:125`, `cai-dat-facebook.js:64`).
- Test quét chữ có sẵn: `test/ra-chu.test.js:57-75` (`boChuThich`).

## Làm theo thứ tự (mỗi bước test liên quan → commit nhỏ)
1. **3.4** `public/js/trang-thai.js` (một bảng trạng thái → chữ, màu, biểu tượng) + `public/js/dinh-dang.js` (`tien`, `docTien`, `usd`, `vnd`
   theo tỷ giá, `ngay` dd/mm/yyyy, `gioPhut`); thay các bản riêng. Biểu tượng: ký tự / SVG nhỏ tự vẽ, không thêm thư viện.
2. **F-119 khung:** menu trái 3 nhóm (Bán hàng · Hàng hóa · Shop), thu gọn < 1280 px; giữ id `#khanCap`, `#trangThai`, `#noiVoiMai`; đường cũ
   đổi tên (`#/tong-quan → #/hom-nay`, `#/agent… → #/cai-dat/tro-ly-ai…`, `#/hop-thu` nhãn "Tin nhắn"); "Agent & Skill" → "Trợ lý AI" trong
   Cài đặt, tab kỹ thuật ẩn sau "Nâng cao" (`localStorage`); token CSS khoảng cách / cỡ chữ / bo góc; **phông trong máy** `public/font/`
   (Be Vietnam Pro 400–700, Lora 600, woff2 + OFL — tải từ nguồn chính thức Google Fonts / GitHub google/fonts một lần, kiểm tệp); bỏ mã
   kỹ thuật; ⓘ `goiY()`; ô ngày Báo cáo dd/mm/yyyy + nút nhanh; ô tiền; trang trống có nút; `public/favicon.svg`; Cài đặt → Phần mềm ẩn
   từng phần (`giao_dien.an[]`); hàm `hoi()` thay `confirm`/`prompt` ở màn được làm lại. Test quét `(#số)` / `(F-số)` trong chữ người dùng
   thấy; đường cũ đổi đúng.
3. **F-121:** bảng "AI & kênh" (Bật/Tắt cờ agent có sẵn, trần/ngày có sẵn `agent.js:84-86`, đã dùng hôm nay từ `agent_run`, nút Dừng mọi tự
   động — F-72 giữ luật); cài đặt `ty_gia_vnd` (mặc định 26.000); "Cần xử lý" đầu Cài đặt từ `san-sang.kiem()`; **hạn Chờ duyệt 24 giờ**: tệp
   nâng cấp mới (số kế tiếp trong `server/db/nang-cap/`) thêm cột `het_han_luc` cho `cho_duyet` (không đổi CHECK), đặt hạn ở
   `agent/thuc-hien.js:87` cho việc do Dừng mọi thứ / giới hạn tin; `cho-duyet.js` `demCho` / `danhSach` bỏ việc quá hạn, màn có mục "Đã hết hạn".
4. **F-120 Hôm nay** (`hom-nay.js` thay `tong-quan.js`): thẻ buổi live kế (`lich-live.buoiKe`) + Bắt đầu live / Tập trước; 4 số; việc cần
   làm theo mức; API mới `GET /agent/doi-hinh` (Đội AI như nhân viên) và `GET /agent/chi-so?ngay=7` (chỉ số 7 ngày lời thường + ≈ VNĐ).
5. **F-122 Bắt đầu live 3 bước** — tách `live.js` `vePhien :68`, `veBatDau :375`, `veKiemTra :234-284` sang `bat-dau-live.js`; dùng API phiên
   có sẵn (`POST /live/phien`, `server/api/live.js:36`); bỏ `confirm` `live.js:434-438`.
6. **F-123 Đơn hàng:** 4 tab với `?nhom=can_lam|dang_giao|xong|huy_hoan` (thêm vào `server/api/don.js`, giữ tham số cũ); dòng hành trình
   từ lịch sử đơn; `POST /don/:id/them-theo-chu {chu}` → xuất `timMon` (`server/agent/cong-cu/don.js:45`) dùng chung → `don.themMon`
   (`don.js:233`); một nút chính; Hủy vào ⋯ dùng `hoi()` có ô lý do.
7. **F-124 Sản phẩm 5 tab** (`san-pham.js:266-376`); lưới tồn bấm ô → `kho.ghiThayDoi`; sửa nhãn ảnh chồng nút (`app.css:373`).
8. **F-125 So sánh** `public/js/so-sanh.js` (dãy con chung dài nhất, tự viết) cho Sổ tay (`so-tay.js:112-115`) và "Nói với Mai"
   (`noi-voi-mai.js:31-46`).
9. **Kết mốc:** `npm test` đủ; xem thử `moza-ai-gia` (kiểm cổng 5190 trống) — chụp mọi màn ở 1440 × 900 và 1366 × 768 vào
   `data/tam-test/ui-gd1/`, tự soi lỗi vỡ bố cục và sửa; `preview_stop`; ghi "Kết quả GD1" + quyết định khi vắng vào `SPEC.md` mục 12,
   cập nhật mục 8 (màn hình) và `BAN-GIAO.md` (bản đồ giao diện mới); commit + tag `gd1-giao-dien`. Kết thúc lượt, câu cuối ghi tag, số
   test, việc dở.

## Không làm
Màn hình người dẫn chế độ sân khấu (BH11 F-126 — chỉ đổi màu theo token chung, không đổi bố cục), BH11/BH12, Zalo. Không đổi nghiệp vụ.

## Lưu ý máy
Node `"C:\Program Files\nodejs\node.exe"`; `TEMP`/`TMP` = `data\tam-test`; lệnh lâu chạy nền; luôn `preview_stop`; không đưa
`.claude/launch.json` vào commit; không xin khóa qua chat.
