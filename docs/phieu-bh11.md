# Phiếu giao việc — BH11 "Mai thông minh hơn" (+ Màn hình người dẫn chế độ sân khấu)

*Soạn 28/10/2026. Chủ dự án vắng qua đêm, giao tự quyết (ghi "Quyết định khi chủ dự án vắng — BH11" ở `SPEC.md` mục 12), **không dừng chờ
duyệt**. Thiết kế: `docs/11` mục 3.3 và 6.*

## Model gợi ý
**Opus 5.5 · Medium**; lên **High** cho F-126 (tách `nguoi-dan.js`) và F-112 (GPT-Live + Decisions). Nhóm phụ: Haiku.

## Trước khi làm
- BH10, GD1 đã xong (tag `bh10-san-sang-live`, `gd1-giao-dien`). Tạo tag `truoc-bh11`.
- Đọc: `docs/11` mục **0, 1 (T4–T8, M6, M9), 3.3, 6**; `BAN-GIAO.md` mục 8. Tra `SPEC.md` grep F-112 → F-116, F-126, F-127, #149.
- Mã liên quan: `phong-ai.js` (`giaoCohost :391`, `hienGoiY :355`, ws `live.goi_y`), `nhip-ban.js:33`, `chot-don.js` (`soLieu :326`,
  `ghiNguoiXem :338` — chỉ giữ 10 phút), `phong-live.js:177 hoiNguoiXem`, `agents/nhin-mon.js:22-28`, `nhin-mon.js:187-227`,
  `nha-cung-cap/openai.js:63`, `gia-mau.js:37`, `mieng/mieng.js` (`taoLoiDan :157`, `CACH_NOI :79-84`, `noiNguyenVan :700`,
  `chieuManHinhMieng :230`, `viTriChuyenSang :328`, `theoKipMai :922`), `mieng/gpt-live.js:96-129`, `mieng/mieng-gia.js:23,39`,
  `public/js/man-hinh/nguoi-dan.js` (806 dòng: bố cục :790-805, `veHang :364-380`, `veChot :392-397`, phím :671-685, ws :510-531, :687-772),
  `len-song.js`.

## Làm theo thứ tự (mỗi bước test liên quan → commit nhỏ)
1. **3.3** `quyetDinh()` trong `nha-cung-cap/openai.js` → `client.decisions.create` (SDK 7.45.1 có), chi phí chỉ token vào; Decisions giả trong `gia-mau.js`.
2. **F-116 bảng huấn luyện:** tệp nâng cấp mới (số kế tiếp) bảng `so_lieu_phut`; ghi mỗi phút ở `phong-live.js`; `server/huan-luyen.js`
   (bằng mã) 4 loại cảnh báo, ≤ 1 / 2 phút, ws `live.huan_luyen`; biểu đồ SVG tự vẽ.
3. **F-115 chạm để trả lời:** `POST /live/phien/:id/tra-loi-binh-luan {binh_luan_id}` → hỏi size có số đo thì `tu-van-size.js`; còn lại giao
   Co-host đúng bình luận đó → Bộ kiểm tra → `live.goi_y` kèm `binh_luan_id`; nút Mai nói / Tự đọc / Trả lời bình luận / Bỏ; Co-host dùng
   `prompt_cache_options:{ttl:'12h'}` (Responses API).
4. **F-126 chế độ sân khấu** (High): tách `nguoi-dan.js` thành `nd-thanh.js`, `nd-mon.js`, `nd-goi-y.js`, `nd-ben-phai.js`; ẩn menu trái trên
   `#/nguoi-dan`; một nút Dừng AI ("Dừng mọi thứ" vào ⋯); lưới 3 vùng không cuộn ở 1366 × 768; bình luận lọc Muốn mua / Hỏi / Khách cũ / Tất
   cả; nhãn từng hoàn (F-118) ở Vừa chốt; giữ mọi phím tắt. **Cỡ chữ:** chủ dự án vắng → chọn mức giữa (con số chính 80 px) và làm trang thử
   `#/nguoi-dan?thu-co-chu` hiện 64 / 80 / 96 px để chủ dự án chọn sau (ghi vào việc của chủ dự án).
5. **F-127 tông giọng:** `server/cau-hinh/tong-giong.json` (deu_ro, mc_vua, mc_soi_noi, am_ap, tu_viet ≤ 400 ký tự); ghép vào `taoLoiDan`;
   đổi giữa buổi bằng `session.instructions.append` (GPT-Live, ≤ 500 token) hoặc mở lại miệng (Gemini); Đội AI dùng làm cách nói mặc định;
   Cài đặt → Giọng Mai chọn + nghe thử (giới hạn 3 lần / phút); `mieng-gia.js` lưu `giong`, `loiDan`.
6. **F-113 MOZA nhìn bằng Decisions:** `agents/nhin-mon.js` → `quyetDinh` (ảnh base64 + `input_json` bảng mẫu, một câu `choice` ≤ 10 món +
   `khong_ro`), "chắc" = `confidence ≥ 0,8`; giữ luật 2 lần liền, tắt mặc định, không lưu ảnh. `scripts/thu-ai/thu-nhin-mon.js` thêm `--decisions`.
7. **F-112 GPT-Live + Decisions:** **phép thử nhỏ trước** (chỉ khi có khóa OpenAI, ≤ 0,05 USD): giữ `delegation:{type:'client'}`, thêm
   `session.triggers` loại `decisions` trên `session.output_transcript.delta`. Chạy được → câu hỏi chọn món đang giới thiệu → `live.doiDoan` +
   `chieuManHinhMieng` chỉ ở Mai dẫn chính / Mai nói cùng; cách đọc chữ cũ giữ dự phòng. **Không chạy được hoặc chưa có khóa → không bật**,
   làm sẵn mã sau cờ tắt + test bằng miệng giả, ghi lý do.
8. **F-114 giọng riêng:** cần phép thử nghe tiếng Việt của chủ dự án → **chủ dự án vắng: làm sẵn mã** (tạo giọng `POST /v1/audio/voices`,
   lưu `mieng.giong.openai = {id}`, gửi `audio.output.voice:{id}` + lặp mô tả trong lời dặn, nghe thử bằng phiên GPT-Live ngắn có hỏi
   trước, xóa giọng) **sau công tắc tắt**, test bằng giả; ghi vào việc của chủ dự án "nghe thử rồi bật".
9. **Kết mốc:** `npm test` đủ; xem thử `moza-ai-gia`: Màn hình người dẫn sân khấu (ảnh 1366 × 768 + 1920 × 1080), bảng huấn luyện có cảnh
   báo (kịch bản diễn tập), chạm bình luận ra câu, Mai đổi thẻ trong lúc nói (miệng giả); `preview_stop`; phép thử thật trong trần (F-113 <
   0,01 USD; F-112 ≤ 0,05; F-115 vài lượt ≤ 0,05) chỉ khi có khóa, ghi sổ chi phí; ghi "Kết quả BH11" + quyết định khi vắng; `BAN-GIAO.md`;
   commit + tag `bh11-mai-thong-minh`. Kết thúc lượt, câu cuối ghi tag, số test, việc dở.

## Không làm
BH12, Zalo. Không tự chuyển món ở chế độ "Chỉ gợi ý". Không lưu khung hình camera.

## Lưu ý máy
Như `docs/phieu-gd1.md`. Tổng chi phí thử thật cả đợt OpenAI ≤ 0,50 USD — cộng dồn ở sổ chi phí `SPEC.md` mục 12 trước khi chạy.
