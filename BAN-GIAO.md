# Bàn giao Moza AI Shop

Ngày: 28/10/2026 · Bản đặc tả 3.15 · `npm test` 791/791 đạt · Tag git `bh11-mai-thong-minh`

File này dành cho người lập trình nhận dự án. Đọc hết file này (khoảng 10 phút), rồi đọc `SPEC.md` mục 0, 2, 12, 13.

---

## 1. Phần mềm là gì

Phần mềm vận hành **livestream bán hàng** (quần áo, phụ kiện) trên Facebook Page. Một người vừa phát live bằng điện thoại,
vừa điều khiển Moza AI Shop trên laptop.

- Sản phẩm đầy đủ (6 nhóm ô, phân loại màu × cỡ, giá riêng từng phân loại, bảng size dùng chung), **Tạo từ ảnh** (AI điền trước).
- Tồn kho có lịch sử; **còn bán được = tồn − đang giữ** cho đơn chưa gửi.
- Phòng live: Mai gợi ý / tự nói / dẫn chính, Đội AI dẫn, Radio; Màn hình người dẫn hiện còn hàng từng màu × cỡ, dòng "Vừa chốt".
- **Bình luận "chốt 12 đen M"** → mã đọc (câu khó nhờ model rẻ) → giữ hàng vào đơn Chờ xác nhận → đọc tên trên sóng → nhắn riêng.
- Tư vấn viên AI 24/7 trên Messenger / bình luận: tư vấn size theo bảng size, gửi ảnh, tìm mẫu theo ảnh, lên đơn, xác nhận.
- Đơn hàng: in phiếu, xuất CSV, gửi nhiều đơn, hoàn hàng; nhắn chủ động (nhắc thông tin giao, báo đã gửi) trong 24 giờ.
- "Nói với Mai": quản lý shop bằng lời, việc ghi có bảng xem trước + nút "Làm".
- Báo cáo doanh số, lãi gộp theo giá vốn, tỷ lệ hoàn.

Chạy trên **một laptop Windows**, chỉ mở ở `http://127.0.0.1:5173`, không có máy chủ ngoài, không đăng nhập (một người dùng).

Cải tạo từ MOZA Live OS bản **tuyển dụng** 2.10 (tag `diem-xuat-phat-ban-hang`; đặc tả cũ ở `docs/05-spec-tuyen-dung-2.10.md`,
gọi "SPEC-TD"). Phần máy móc giữ lại (lõi Agent, miệng Live, Đội AI, Facebook, Phòng diễn tập) vẫn tra chi tiết ở SPEC-TD.
Bản tuyển dụng vẫn dùng riêng ở thư mục khác — **không sửa gì bên đó** từ dự án này.

---

## 2. Trong gói có gì, không có gì

| Có | Không có (cố ý) |
| --- | --- |
| Mã nguồn + **lịch sử git đầy đủ** (mọi tag mốc) | `.env` — khóa API của chủ dự án |
| `SPEC.md` 3.2 — đặc tả, quyết định #56 → #86, kết quả BH1 → BH4 | `data/` — dữ liệu thật: khách, số điện thoại, địa chỉ (dữ liệu cá nhân), ảnh sản phẩm, giọng |
| `test/` — 505 test, không gọi AI hay Facebook thật | `node_modules/` |

Cần dữ liệu thật thì xin chủ dự án chuyển riêng (không qua chat, nén có mật khẩu). Dữ liệu khách phải giữ bí mật theo
Luật Bảo vệ dữ liệu cá nhân.

---

## 3. Cài và chạy

Cần: Windows, **Node.js 26+**, Chrome hoặc Edge.

```
npm install
copy .env.example .env      rồi dán khóa vào .env (hoặc màn hình Cài đặt)
npm start                   http://127.0.0.1:5173
npm test                    505 test, dữ liệu và .env tạm
```

**Bản xem thử khi phát triển:** `node scripts/xem-thu.js` — cổng 5190, dữ liệu riêng `data/xem-thu/`, không dùng mã Facebook.
Không chạy bản thử cổng 5173 song song bản thật. **Bản tuyển dụng dùng cùng cổng** — không chạy hai dự án cùng lúc.

Dữ liệu thử nhanh: Sản phẩm → tạo 1–2 sản phẩm Đang bán (cần ảnh) → Livestream → Phòng diễn tập → **▶ Bắt đầu tập**.

---

## 4. Bản đồ mã

Sơ đồ đầy đủ ở `README.md`. Chỗ quan trọng của phần bán hàng:

```
server/nghiep-vu/san-pham.js   sản phẩm, phân loại, ảnh, thẻ cho AI (theChoAi — không có giá vốn / ghi chú nội bộ)
server/nghiep-vu/kho.js        mọi thay đổi tồn qua ghiThayDoi (tồn luôn = tổng lịch sử kho; doiChieu() để kiểm)
server/nghiep-vu/don.js        đơn: giữ hàng MỘT giao dịch (giuTrong), bảng chuyển trạng thái, luật AI (bằng chứng, #73)
server/nhan-chot.js            đọc bình luận chốt bằng mã; laLoiXinSua (tin khách có phải lời xin mua / đổi)
server/chot-don.js             bình luận chốt → giữ hàng → đơn → đọc tên trên sóng → nhắn riêng / gom công khai
server/agent/cong-cu/don.js    công cụ đơn của AI (#79: xem_don, cap_nhat_don gộp), gửi ảnh, tìm mẫu theo ảnh
server/agent/kiem-tra/         Bộ kiểm tra K1–K10 (K10: tổng tiền phải trích từ khối đơn "DH-xxxx")
server/hop-thu.js              Tư vấn viên tự động; nhắc đơn / báo hủy bằng câu mẫu (nhacDon, F-69); vào từ link m.me (moTuLink)
server/xu-ly-nut.js            BH5: mọi nút khách bấm ở MỘT nơi (bảng loại nút → hàm, trả lời bằng câu mẫu, 0 lượt AI)
server/gui-the-don.js          BH5: gửi thẻ / tin máy soạn qua công cụ nội bộ gui_the_moza (qua đủ hook), mẫu Utility
server/nghiep-vu/the-giu-hang.js, the-moi.js, nut-bam.js, cau-mau-khach.js   BH5: dựng thẻ, payload nút, câu mẫu cho khách
server/nghiep-vu/luot-nhan-rieng.js, lien-he.js, tu-khoa.js, gia-shop.js     BH5: một bình luận một tin riêng, giới hạn liên hệ,
                               từ khóa (dừng, ẩn tên, ib), chống giả shop
server/facebook/meta-gia.js    BH5: Meta giả theo luật thật (hanh-vi-meta.json H01–H26; H25, H26 = Business AI — BH10); gia.js bọc lại; dung-tin.js dựng tin Send API
server/san-sang.js, kiem-page.js  BH5: bảng Sẵn sàng lên sóng (F-77); hỏi Page Integrity (F-73)
server/db/nang-cap/018         BH5: luot_nhan_rieng, lien_he, nhan_bu, anh_fb, cột mới của đơn / phiên
server/the-nhac.js, tu-van-size.js, nguoi-mau.js, go-luong-lu.js, nhip-ban.js, binh-chon.js   BH6: thẻ nhắc khách xin xem, tư vấn size bằng mã,
                               người mẫu nói bằng lời, gỡ lưỡng lự, gợi ý nhịp, bình chọn (không SQL, không AI)
server/nghiep-vu/tu-cam.js, nhat-ky-song.js, so-do.js, tu-rieng.js   BH6: K11 từ cấm, nhật ký buổi live, đọc số đo, từ riêng cho chép lời
server/db/nang-cap/019         BH6: nhat_ky_song, cờ video dung_thu
server/vietqr.js, chuyen-khoan.js   BH7 F-89: ảnh VietQR (chờ ≤ 5 giây, fetch tiêm được), gửi mã chuyển khoản, báo "đã nhận tiền"
server/xem-lai.js              BH7 F-94: bình luận video xem lại ≤ 7 ngày (webhook + quét 10 phút), mục lục sau live
server/nghiep-vu/the-xin-thong-tin.js   BH7 F-88: tin xin thông tin một chạm (nút Gọi shop, trả lời nhanh số / Như đơn trước / Dùng số)
server/nghiep-vu/cho-hang.js   BH7 F-92: danh sách chờ; nhuongSuatTrong chạy TRONG giao dịch trả hàng (don.js, kho.js gọi)
server/nghiep-vu/gia-ban.js    BH7 F-93: "giá bán lúc này" — MỘT hàm cho giữ hàng, thẻ đơn, Bộ kiểm tra, câu giá của Mai
server/cau-hinh/ngan-hang.json BH7: 42 ngân hàng VietQR (tra 28/9/2026)
server/db/nang-cap/020         BH7: cột đơn / khách / phiên mới, bảng cho_hang, công cụ gui_ma_chuyen_khoan, dat_gia_live
scripts/thu-ai-bh7.js          BH7: lượt thử AI thật Tư vấn viên (gpt-6-luna, trần 0,10 USD) — chạy khi .env có khóa OpenAI
server/nghiep-vu/lich-live.js  BH8 F-96: lịch live cố định (giờ Việt Nam), dời / hủy một buổi, buổi kế, khớp live ±60 phút
server/agent/agents/soan-bai.js   BH8 F-96: agent soan_bai — bài báo trước live; chỗ {lich} {so_mon} {cu_phap} do máy điền, kiểm từng phần
server/nghiep-vu/dong-y.js     BH8 F-97: đồng ý nhận 1 tin báo live (bảng dong_y_nhan_tin), rút khi DỪNG
server/nghiep-vu/xuat-van-chuyen.js   BH8 F-101: CSV theo mẫu hãng (mau-xuat-van-chuyen.json), tách tỉnh / xã (tinh-thanh.json, 34 tỉnh)
server/nghiep-vu/tong-ket-phien.js    BH8 F-102/103: phễu buổi (máy đếm), số liệu gộp cho AI (không tên), mốc từng món trong video; BH12 F-117: bangDoan (bảng từng đoạn: ra đơn, người xem bỏ đi), soLieuDoanChoAi
server/agent/agents/tong-ket.js   BH8 F-102: agent tong_ket — ≤ 3 gợi ý; mã bỏ gợi ý có số lạ (kể cả số nhỏ), vùng miền, khan hiếm, giảm giá
server/agent/agents/de-xuat-kich-ban.js   BH12 F-117: nháp kịch bản buổi sau (agent soan_kich_ban, lược đồ riêng); luật số lạ dùng loiSo của tong-ket.js; API POST /live/phien/:id/de-xuat-kich-ban; giao diện: bao-cao.js veBangDoan
server/nghiep-vu/anh-khach.js  BH8 F-104: ảnh khách mặc thật — xin phép, tải khi đồng ý, duyệt (ảnh đã che ghi đè gốc), gỡ; data/anh-khach/
server/api/truoc-live.js, anh-khach.js   BH8: API lịch live / bài báo trước; ảnh khách (chờ duyệt, tệp, duyệt, gỡ)
public/js/man-hinh/anh-khach.js   BH8 F-104: màn duyệt #/anh-khach — che mặt bằng canvas (khảm + mờ phần trên ảnh)
server/db/nang-cap/021         BH8: dong_y_nhan_tin, anh_khach, cột hỏi lại / hỏi mặc của đơn, phien_live.tong_ket, agent soan_bai, tong_ket
scripts/thu-ai-bh8.js          BH8: thử AI thật Nói với Mai, soạn bài, tổng kết (gpt-6-luna, trần 0,08 USD) — chạy khi có khóa OpenAI
server/agent/kiem-tra/kiem-so-noi.js   BH9 F-105: kiemSoNoi — so số Mai nói với giá bán lúc này / ship / còn hàng; đọc số nói bằng chữ
server/agent/hook/kiem-loi-noi.js      BH9 F-105: hook cửa truoc_phat (tắt được), mã MIENG_NOI_SAI
server/agent/mieng/kiem-loi-noi.js     BH9 F-105: gom chữ Mai theo câu, chỉ xét số đã trọn, đính chính, chống lặp, hạ về "Chỉ gợi ý"
server/agent/mieng/mieng-gia.js        BH9: miệng giả (0 đồng) — CHỈ buổi tập; "đọc giúp: …" nói y nguyên
server/nghiep-vu/loi-noi.js    BH9: bảng loi_noi_song, khoảng nói nhầm
server/nghiep-vu/gia-noi-nham.js       BH9 F-106: đơn chốt lúc Mai nói nhầm giá — chỉ hạ, don_danh_dau, Giữ giá đúng
server/nhin-mon.js             BH9 F-107: MOZA nhìn (OBS / Camera giả) — so ảnh nhỏ bằng mã, chỉ gợi ý chuyển món
server/agent/agents/nhin-mon.js   BH9 F-107: agent nhin_mon (gpt-6-luna, detail low, bảng mẫu trước khung hình)
server/db/nang-cap/022         BH9: loi_noi_song, don_danh_dau, agent nhin_mon
scripts/thu-ai/                BH9: dung-khung-thu.js (52 khung thử bằng ffmpeg), thu-nhin-mon.js (trần 0,08 USD)
test/du-lieu/loi-mai-mau.json  BH9: 62 câu mẫu lời Mai có đáp án — thêm câu khi có chữ chép buổi thật
server/db/nang-cap/012, 013    chuyển tuyển dụng → bán hàng; mốc sửa món của đơn
server/agent/nha-cung-cap/tts.js   máy đọc giọng: chọn nhà (mac-dinh.json doc_giong: openai | elevenlabs | gemini | gia), kiemDocDung
                               (BH10 F-108: so chữ chép lại với câu gốc TRƯỚC khi phát; lệch → DOC_LECH, câu hiện chữ), máy đọc giả
server/agent/nha-cung-cap/doc-realtime.js   BH10 F-108: gpt-realtime-2.1-mini qua Realtime — một phiên mỗi giọng, datKetNoi để test
server/agent/nha-cung-cap/doc-elevenlabs.js BH10 F-108: ElevenLabs eleven_v4 Text-to-Dialogue (fetch), tìm / thêm giọng tiếng Việt
server/tu-nhan-ai.js           BH10 F-109: Mai / Đội AI tự nhận là trợ lý AI bằng lời mỗi 15 phút (phòng live gọi mỗi phút)
scripts/thu-ai-bh10-may-doc.js BH10: phép thử thật máy đọc OpenAI 20 câu (trần 0,10 USD), lưu 5 tệp nghe ở docs/nghe-bh10/
server/agent/quyet-dinh.js     BH11 3.3: một lần Decisions (chọn trong danh sách đóng) — giữ Dừng mọi thứ / Dừng AI, ghi agent_run (chỉ token vào)
server/nghiep-vu/so-lieu-phut.js, server/huan-luyen.js   BH11 F-116: số liệu theo phút (024), 4 cảnh báo bằng mã ≤ 1 / 2 phút, ws live.huan_luyen
server/phong-ai.js traLoiBinhLuan / noiGoiY   BH11 F-115: chạm bình luận → tư vấn size bằng mã hoặc Co-host (lưu đệm 12h) → thẻ kèm binh_luan_id
server/nghiep-vu/tong-giong.js, cau-hinh/tong-giong.json   BH11 F-127: 5 tông, ghép lời dặn miệng, GPT-Live instructions.append, Đội AI cách nói mặc định
server/agent/agents/nhin-mon.js   BH11 F-113: MOZA nhìn hỏi bằng Decisions (cách cũ sau nhin_mon.cach = responses)
server/agent/mieng/gpt-live.js, mieng.js nhanQuyetDinh   BH11 F-112: session.triggers decisions trên chữ Mai nói → đổi thẻ món (mac-dinh mai_quyet_dinh)
server/nghiep-vu/giong-rieng.js   BH11 F-114: giọng riêng tạo bằng mô tả (tắt mặc định), chỉ GPT-Live
server/db/nang-cap/024        BH11: so_lieu_phut, binh_luan_live.tra_loi_luc
scripts/thu-ai/thu-gpt-live-decisions.js, thu-giong-rieng.js, thu-nhin-mon.js --decisions   BH11: phép thử thật (khóa từ .env, không in)
server/man-hinh-san-pham.js    #90: Màn hình sản phẩm (dung = dựng nội dung, docLenh = lệnh bằng lời), hai chế độ chuyển cảnh
server/obs.js                  #90: nối OBS qua obs-websocket v5 (xác thực, chuyển cảnh, "Tạo cảnh Moza")
server/ws.js → bus             kênh sự kiện nội bộ: dịch vụ trong máy chủ nghe cùng sự kiện đẩy lên màn hình
public/man-hinh-san-pham.html  trang 1920×1080 cho OBS; public/thanh-chu.html nền trong suốt
public/js/man-hinh/len-song.js khối "Lên sóng" của Màn hình người dẫn; cai-dat-obs.js mục Cài đặt → OBS
```

Dễ vấp (#90): trang cho OBS dùng `setTimeout` chứ không `requestAnimationFrame` (nguồn trình duyệt / tab ẩn ngừng vẽ khung →
nội dung mờ mãi); `replaceChildren` của trình duyệt in `null` / `false` thành chữ — lọc trước khi truyền.

---

## 4b. Bản đồ giao diện sau GD1 (28/10/2026)

```
public/index.html             khung: menu trái (#menu, #nav) + thanh trên (#noiVoiMai, #trangThai, #khanCap) + dải cảnh báo + #main
public/js/app.js              MAN_HINH (3 nhóm menu), veNav, napCaiDatGiaoDien (ẩn bớt + tỷ giá), thanh trạng thái; duong-cu.js = đường cũ → mới
public/js/trang-thai.js       MỘT bảng trạng thái (BANG: don, san_pham, kho, phien, hop_thu, doi_ai…) + chipTrangThai / chipMau — không tự đặt bảng màu ở màn hình
public/js/dinh-dang.js        tien, docTien, usd / vnd / usdVnd (tỷ giá), ngay, gioPhut, docNgay
public/js/ui.js              h(), toast, goiY (ⓘ), hoi (hộp hỏi thay confirm), trangTrong, phanDuong / duongCon
public/js/so-sanh.js          so sánh theo dòng (Sổ tay, Nói với Mai)
public/js/man-hinh/hom-nay.js (+ hom-nay-phu.js)  trang Hôm nay
public/js/man-hinh/bat-dau-live.js  Bắt đầu live 3 bước + bảng Sẵn sàng (veKiemTra) + thử thiết bị
public/js/man-hinh/cai-dat.js (+ cai-dat-ai-kenh.js)  Cài đặt: tab Chung / Trợ lý AI (agent.js); Cần xử lý, AI & kênh, Phần mềm
server/nghiep-vu/ai-kenh.js   bảng AI & kênh, Cần xử lý, đội hình AI, chỉ số AI 7 ngày (chỉ đọc)
public/font/ , css/gd1.css    phông trong máy (OFL); kiểu của GD1; token ở css/app.css
```

**BH11 — Màn hình người dẫn chế độ sân khấu** (`#/nguoi-dan`; `body.nd-san-khau` ẩn menu + thanh trên khi đang live; `css/nd-san-khau.css`):

```
public/js/man-hinh/nguoi-dan.js   ghép khối, một bộ nghe ws, phím (Cách, ←/→, Enter, 1/2/3, N ngăn kéo, / Hỏi Mai), micro, loa, chế độ Mai, ngăn kéo,
                                  dải nguy cấp + tiếng, trang thử cỡ chữ #/nguoi-dan?thu-co-chu (64/80/96 px, localStorage moza.nd_co_chu)
nd-thanh.js    thanh mảnh: giờ, đèn FB/OBS/AI/mạng, xem·chốt·xác nhận, MỘT nút Dừng AI, menu ⋯ (Dừng mọi thứ = bấm công tắc #khanCap của app.js)
nd-mon.js      vùng 1 món đang bán (số, giá, lưới tồn theo --nd-so-chinh) + vùng 3 Tiếp theo; tachLoiNhac / veThoaiDoi dùng chung
nd-goi-y.js    vùng 2 thẻ gợi ý: nguồn, [Mai nói] [Tự đọc] [Trả lời bình luận] [Bỏ], "Mai chưa chắc"; cham(bl) gọi tra-loi-binh-luan
nd-ben-phai.js cột phải: cảnh báo (huấn luyện, thẻ nhắc, đính chính, MOZA nhìn, nhắc sống, Director báo), Vừa chốt, bình luận lọc 4 nhóm
nd-huan-luyen.js  biểu đồ SVG theo phút + dải cảnh báo huấn luyện
tong-giong.js, giong-rieng.js   Cài đặt → Giọng Mai (tông F-127; giọng riêng F-114) — tông cũng ở bước 2 Bắt đầu live
```

Chỗ dễ vấp: `hạn Chờ duyệt` chỉ áp cho việc có `het_han_luc` (Dừng mọi thứ / giới hạn tin); trình duyệt giữ bản JS cũ — sau khi sửa giao diện nhớ tải lại trang (F5).

## 5. Trạng thái hiện tại

| Mốc | Tình trạng |
| --- | --- |
| BH1 Nền bán hàng | Code xong, test đạt. "Tạo từ ảnh" chưa thử với ảnh sản phẩm thật |
| BH2 Phòng live bán hàng | Code xong, test đạt. Chưa tập 4 chế độ với AI và giọng thật; **phép thử camera F-64 chưa làm** |
| BH3 Chốt đơn | Code xong; Luồng 4 thử trọn với AI thật trên Facebook giả (~0,03 USD) |
| BH4 Giao hàng, báo cáo | Code xong, test đạt |
| BH5 Không rơi đơn | Code xong 28/9/2026, 597 test đạt, bản xem thử chạy trọn trên Facebook giả với AI giả (0 USD). Chưa chạy trên Facebook thật (Bước 0) |
| BH6 Trên sóng | Code xong 28/9/2026, 619 test đạt, bản xem thử chạy trọn (0 USD). Director gắn nhãn lưỡng lự chưa thử với AI thật |
| BH7 Khép kín đơn | Code xong 28/9/2026, 656 test đạt, bản xem thử chạy trọn luồng chuyển khoản + bán sau live (0 USD). Thử AI thật chờ khóa OpenAI (`.env` đang trống) |
| BH8 Trước live và sau mua | Code xong 28/9/2026, 683 test đạt, bản xem thử chạy Tổng kết buổi + trọn luồng ảnh khách mặc thật (0 USD). Mẫu cột 4 hãng vận chuyển chờ file mẫu; thử AI thật chờ khóa |
| BH9 Thử nghiệm AI | Code xong 28/9/2026, 700 test đạt, bản xem thử chạy đính chính trên sóng (miệng giả), giữ giá Mai nói, MOZA nhìn (Camera giả) (0 USD). Phép thử thật chờ duyệt chi phí + khóa |
| BH10 Sẵn sàng live thật | Code xong 28/10/2026, 733 test đạt. Máy đọc mới gpt-realtime-2.1-mini (thử thật 20 câu, 0,045 USD), ElevenLabs mô phỏng (chờ khóa), Mai tự nhận AI mỗi 15 phút, dòng Business AI, model sắp tắt, nhãn "từng hoàn". Chờ chủ dự án duyệt + nghe 5 tệp ở `docs/nghe-bh10/` |
| GD1 Giao diện gọn và rõ | Code xong 28/10/2026, 768 test đạt (tag `gd1-giao-dien`, 0 USD): menu trái 3 nhóm, Hôm nay, Bắt đầu live 3 bước, Đơn hàng 4 tab, Sản phẩm 5 tab, bảng trạng thái và định dạng chung, phông trong máy, "AI & kênh", hạn Chờ duyệt 24 giờ (nâng cấp 023). Chụp 16 màn × 2 cỡ ở `data/tam-test/ui-gd1/`. Quyết định tự đưa ra: `SPEC.md` mục 12 |
| BH11 Mai thông minh hơn | Code xong 28/10/2026, 791 test đạt (tag `bh11-mai-thong-minh`): Màn hình người dẫn chế độ sân khấu (tách 4 khối, không cuộn ở 1366 × 768), bảng huấn luyện (nâng cấp 024), chạm bình luận để Mai soạn, tông giọng, MOZA nhìn + Mai đổi thẻ bằng Decisions (thử thật 52/52; GPT-Live + Decisions chạy được), giọng riêng làm sẵn (tắt). Thử thật BH11 0,047 USD (cộng dồn đợt 0,092 / 0,50 USD). Chờ chủ dự án chọn cỡ chữ ở 2 m, nghe `docs/nghe-bh11/giong-rieng.wav` |
| BH12 Kịch bản buổi sau | Code xong 28/10/2026, 797 test đạt (tag `bh12-kich-ban-buoi-sau`, 0 USD): Báo cáo → Tổng kết có bảng từng đoạn (ra đơn / người xem bỏ đi) và nút "Mai đề xuất kịch bản buổi sau" → nháp sửa được → lưu thành kịch bản. Model thật chưa chạy (chờ khóa); số người xem cần Facebook thật. **Hết đợt BH10 → BH12** (BH13 Zalo hoãn) |
| Cổng Facebook thật | **Chưa làm** — cần chủ dự án tạo Page / ứng dụng Meta bán hàng riêng, `cloudflared`, tài khoản thứ hai |

Chi tiết, chi phí, lỗi tìm ra khi thử: `SPEC.md` mục 12 "Kết quả các mốc" và "Quyết định khi chủ dự án vắng".

---

## 6. Việc tiếp theo

0. **Đợt cải tiến BH5 → BH9** (`SPEC.md` 3.5 — mục 2 #91 → #127, mục 3 F-65 → F-107, mục 11 test và giả lập Facebook, mục 12
   mốc, kết quả, việc chủ dự án). BH5 → BH9 đã code (tag `bh5-khong-roi-don` … `bh9-thu-nghiem-ai`) — hết đợt cải tiến 3.4; còn các phép thử AI thật và việc của chủ dự án (cuối mục 12 SPEC). Vì sao:
   `docs/06-de-xuat-cai-tien-2026-09-27.md`; thiết kế từng tính năng: `docs/08-thiet-ke-chi-tiet-bh5-bh9.md`; Facebook giả:
   `docs/07-gia-lap-facebook.md`.
0c. **Phương án 3.11 — giao diện + Zalo cá nhân** (`SPEC.md` 3.11, 28/10/2026, chưa code): `docs/10-phuong-an-giao-dien-zalo-2026-10-28.md`;
   thứ tự BH10 → GD1 → BH11 → BH12 → BH13; #138 → #146, F-118 → F-129.
0b. **Đợt nâng cấp 3.10 — BH10 → BH12** (`SPEC.md` 3.10, 27/10/2026, chưa code): nghiên cứu `docs/09-nghien-cuu-nang-cap-2026-10-27.md`;
   quyết định #128 → #137, tính năng F-108 → F-117, mốc và việc chủ dự án ở mục 12. **BH10 đã code 28/10/2026** (tag
   `bh10-san-sang-live`), **GD1 28/10** (`gd1-giao-dien`), **BH11 28/10** (`bh11-mai-thong-minh`); **BH12 28/10** (`bh12-kich-ban-buoi-sau`) — **hết đợt BH10 → BH12**; việc tiếp theo là danh sách "Việc chủ dự án cần làm — sau đợt BH10 → BH12" cuối mục 12 `SPEC.md`.

1. Chủ dự án làm danh sách "Việc chủ dự án cần làm" (`SPEC.md` mục 12).
2. **Cổng Facebook thật** — đặc biệt: bình luận **live** có nhắn riêng được không (`can_reply_privately`), tin riêng rơi vào
   hộp nào, gửi ảnh bằng tải tệp (`that.js` `guiAnh`, FormData). Khác bộ giả thì sửa `that.js` + `gia.js`, chạy lại test.
3. Buổi tập đủ 4 chế độ với sản phẩm thật; phép thử camera F-64 (báo chi phí trước).
4. Sau khi xong: F-59 → F-61 (TikTok, sàn, website), F-40 → F-42, pháp lý chặt, đo và tinh chỉnh.

---

## 7. Cách làm việc với chủ dự án

Chủ dự án **không rành kỹ thuật** và làm cùng Claude Code (lời dặn ở `CLAUDE.md`).

- Tiếng Việt, lời thường. **Bàn trước, code sau** — chờ lệnh "Code", "Làm đi". Đang bàn không sửa mã, không chạy thử tốn tiền.
- Đổi yêu cầu → sửa `SPEC.md` trước; quyết định mới đánh tiếp từ #147, tính năng từ F-130, tệp nâng cấp dữ liệu từ 023 (bản 3.10 + 3.11 đã dành #128 → #146, F-108 → F-129)
  (bản 3.4 đã dành #91 → #127, F-65 → F-107, 018 → 022 cho đợt cải tiến BH5 → BH9).
- Không bao giờ xin khóa API qua chat.
- **Công nghệ mới nhất** là luật cứng: tra nguồn chính thức mới nhất đầu mỗi mốc, ghi ngày tra vào `SPEC.md` mục 6.
- **Thiết kế ít ô nhập**, AI tự điền thay người gõ; tận dụng Skill, Tool, Hook, Memory.
- Mai nói tự nhiên, liền mạch, rất ít chữ "nhé".
- Ưu tiên tính năng chạy được; chưa đo đạc, tinh chỉnh model.
- Luật riêng của bản tuyển dụng ("gọi việc bằng tên nhà máy", "tin 4 ô") **không áp dụng** ở đây. Bán hàng gọi món bằng **số
  sản phẩm** ("áo số 12") vì khách chốt bằng số.

---

## 8. Những chỗ dễ vấp

- **AI và đơn hàng:** AI chỉ xác nhận / hủy (cần id tin khách làm bằng chứng), chỉ sửa món theo tin khách **mới hơn** lần sửa món
  gần nhất và là lời xin mua / đổi thật. Luật này nằm trong mã (`cong-cu/don.js`), không chỉ trong lời dặn — thử AI thật đã thấy
  model tự thêm món khi khách chỉ hỏi.
- **Tồn kho:** không `UPDATE phan_loai SET ton` trực tiếp; luôn qua `kho.ghiThayDoi` (có lịch sử).
- **Lời dặn và Skill mẫu:** sửa `loi-dan-mau.json` / `skill-mau.json` thì thêm bản cũ vào `*-cu.json` để dữ liệu đang chạy được
  nâng. (Lần chuyển sang bán hàng, nâng cấp 012 xóa hết lời dặn / Skill tuyển dụng nên hai tệp `*-cu.json` đang trống.)
- **Đổi cấu trúc dữ liệu:** thêm `server/db/nang-cap/NNN-*.sql` mới, không sửa tệp đã chạy (bản xem thử đã chạy tới 024; tệp kế tiếp 025).
- SQL chỉ trong `server/nghiep-vu/`. Mọi chỗ gọi Facebook qua hợp đồng chung; bộ thật và bộ giả cùng dạng.
- `node` trong Git Bash là bản 24; dùng `"C:\Program Files\nodejs\node.exe"`. Ổ C gần đầy: đặt `TEMP`/`TMP` sang `data\tam-test`.
- Sửa tệp bằng lệnh shell có dấu `\` trong biểu thức chính quy dễ bị mất dấu `\` → dùng công cụ sửa tệp trực tiếp.
- `data/doi-ai/` còn tệp âm thanh của bản tuyển dụng (cấu hình đã bỏ) — chủ dự án tự quyết xóa, đừng tự xóa.
- Mức trần chi phí vượt → **"Dừng AI"** tự bật (F-72): mọi lần gọi AI tốn tiền dừng, **chốt đơn bằng mã vẫn chạy**; tự tắt khi hết lý
  do và không có buổi live, hoặc bấm "Chạy AI tiếp". "Dừng mọi thứ" (nút đỏ) chỉ bật khi người bấm. AI im thì kiểm hai công tắc này.
- **Tin đầu tới người chốt là thẻ do mã soạn, không phải AI** (F-68): sửa chữ ở `server/cau-hinh/cau-mau-khach.json`, không sửa lời
  dặn. Một bình luận chỉ nhắn riêng được MỘT tin (Meta) — mọi đường phải giữ lượt qua `luot-nhan-rieng.js` trước khi gửi.
- **Câu trên sóng do mã soạn (BH6):** tư vấn size, số người chốt, cảm ơn, bình chọn, thẻ nhắc đều bằng mã — câu mẫu ở
  `doi-ai-cau-mau.json`, từ khóa ở `tu-khoa.json`, từ cấm ở `tu-cam.json`. Mọi câu mẫu mới phải qua test quét K11 (`test/k11.test.js`).
- **Đơn và kho (BH7):** đơn Đã xác nhận bị đổi món (khách, AI, gộp) tự về Chờ xác nhận — người sửa tay truyền `{ boi: 'nguoi' }`
  (API đã làm). Hàng trả về (hủy, bớt, đổi, nhập, nhận hoàn) gọi `cho-hang.nhuongSuatTrong` trong cùng giao dịch — tạo đơn trong giao
  dịch khác thì dùng `don.taoDonTrong(db, …)`, không gọi `taoDon` lồng (BEGIN lồng sẽ lỗi). Giá của dòng đơn chỉ lấy từ
  `gia-ban.giaBanLucNay`.
- **Công tắc tắt mặc định (BH7, BH8):** Giá live, Hỏi khách lưu chiều cao / cân nặng, Dùng ảnh khách mặc thật — chỉ bật sau khi luật
  sư xem (#127).
- **Ảnh khách (BH8):** không đưa ảnh trong `anh_khach` cho AI — `tim-mau` đã từ chối (`ANH_KHACH`), đường mới nào đọc `tin_nhan.anh_url`
  cũng phải kiểm `anhKhach.laAnhKhach(tinId)`. Địa chỉ ảnh luôn kèm `?v=` (trình duyệt không hiện lại ảnh chưa che). Xóa dữ liệu người
  gọi `anhKhach.xoaCuaNguoi` (khach.js đã làm).
- **Tin trạng thái đơn (BH8):** gửi qua `guiThe.guiTrangThai` (24 giờ → câu mẫu; ngoài 24 giờ → mẫu Utility đã duyệt; DỪNG → việc cho
  người) — đừng gọi Tư vấn viên để báo trạng thái.
- **Tin chỉ có ảnh** có `noi_dung` là "[hình ảnh]" (su-kien.js), không phải chuỗi rỗng.
- **Lời Mai trên sóng (BH9):** sau đính chính với GPT Live 1, `m.chan = 'cho_cau_moi'` nên chữ Mai bị bỏ tới khi có tiếng câu mới — test
  phải gửi tiếng (`nhanAm`) trước chữ câu mới. Câu mẫu mới thêm vào `test/du-lieu/loi-mai-mau.json`, đừng sửa đáp án cũ cho khớp mã.
- **Giá đơn (BH9):** chỉ `gia-noi-nham.js` được hạ đơn giá sau khi giữ hàng (luôn qua `don.tinhLaiTrong(db, id, { giuPhiShip: true })`
  trong giao dịch) — tổng không bao giờ tăng.
- **MOZA nhìn (BH9):** không bao giờ gửi cảnh hay nguồn Thanh chữ / Màn hình sản phẩm cho AI (có tên khách); không lưu khung hình.
  Máy không tự chuyển món.
- **`.env` của dự án này chưa có khóa AI** (28/9/2026, các ô trống) — ghi chú cũ "dùng chung khóa bản tuyển dụng" không còn đúng.
- **Test chạy lúc nửa đêm:** tin nhắc / báo hủy chỉ gửi 7h–22h (giờ Việt Nam). Test đụng nhắc đơn phải mở khung giờ
  (`lienHe.MAC.gio_tu = 0; gio_den = 24`), không thì đỏ vào ban đêm.
- **Máy đọc giọng (BH10):** máy đọc OpenAI là model hội thoại — luôn đi qua `docMotLuot` (kiểm chữ chép lại trước khi phát); đừng
  gọi thẳng `doc-realtime.docCau` cho câu lên loa. Mỗi giọng một phiên (đổi giọng phải mở phiên mới). Hủy câu đã xong → OpenAI báo
  `response_cancel_not_active` (đã bỏ qua). Chép lại hay trộn chữ và số ("một triệu 250 nghìn") — `cacSoCau` đã đổi trước khi so.
  Test: `docRealtime.datKetNoi(giả)`, `docEleven.datFetch(giả)`, `tts.datNhaDoc('gia' | 'gemini')`.
- **Không gọi tên máy đọc cũ của OpenAI** ở `server/`, `public/`, `test/` — test quét (chỉ `gia-model.json` được ghi để báo ngày tắt).
- **Decisions (BH11):** mọi lần gọi qua `agent/quyet-dinh.js` (ghi chi phí, giữ công tắc dừng). Test: `gia-mau.datQuyetDinh(...)` hoặc truyền
  `nhaCungCap: { quyetDinh }`; Camera giả / miệng giả đưa đáp án qua `_dapAn` (bộ thật bỏ qua). F-112 trên GPT-Live trả **một kết quả mỗi mẩu chữ** (dao động) —
  luôn qua `mieng.nhanQuyetDinh` (hai lần liền, bỏ kết quả cũ). Tắt: `mac-dinh.json` `mai_quyet_dinh.bat = false`.
- **Màn hình người dẫn (BH11):** sửa từng khối `nd-*.js`, đừng dồn lại `nguoi-dan.js`; lưới không cuộn ở 1366 × 768 — thêm gì vào cột phải / vùng 1 phải kiểm
  `#main` không tràn (`scrollHeight`). `append(null)` in chữ "null" — lọc trước. Sửa bằng lệnh shell có `\d` trong biểu thức chính quy hay mất `\` (BH11 gặp 3 lần) —
  dùng công cụ sửa tệp.
- **Model tắt (F-111):** thêm ngày tắt vào `gia-model.json` ô `tat_ngay` — bảng Sẵn sàng tự báo vàng 30 ngày trước, đỏ khi đã tắt.
- Các chỗ dễ vấp của phần máy móc (Gemini 503, hạn mức giọng Google 100 lượt/ngày, GPT Live 1 không dừng giữa câu, Lyria
  chỉ trả MP3…): xem `BAN-GIAO.md` của bản tuyển dụng (tag `ban-giao-2026-09-25`).

---

## 9. Tài liệu

| Tệp | Nội dung |
| --- | --- |
| `SPEC.md` | Nguồn chính (bản bán hàng 3.6) |
| `docs/mau-dong-y-nguoi-mau.md` | Nháp giấy đồng ý của người mẫu lên hình và công khai số đo (cần luật sư đọc) |
| `docs/chinh-sach-rieng-tu-ban-hang.md` | Nháp chính sách quyền riêng tư của shop (cần luật sư đọc trước khi đăng) |
| `docs/05-spec-tuyen-dung-2.10.md` | Đặc tả bản tuyển dụng — tra chi tiết phần máy móc giữ lại |
| `README.md` | Hướng dẫn người dùng + sơ đồ thư mục |
| `docs/01` → `docs/04` | Tài liệu gốc của bản tuyển dụng (lịch sử) |

Tag git: `diem-xuat-phat-ban-hang` (lúc vừa chép), `bh1-nen`, `bh2-live`, `bh3-chot-don`, `bh4-giao-hang`, `bh5-khong-roi-don`, `bh6-tren-song`;
tag cũ của bản tuyển dụng vẫn còn trong lịch sử.
