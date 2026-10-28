# Phiếu giao việc — BH10 "Sẵn sàng live thật"

*Soạn 28/10/2026 cho một cuộc trò chuyện mới (cách làm tiết kiệm token, `CLAUDE.md`). Đã duyệt: `SPEC.md` 3.12 (#147 → #154), thiết kế
`docs/11`. Code được ngay khi chủ dự án nói "Code tiếp BH10" ở phiên mới.*

## Model gợi ý cho phiên này
- **Mặc định: Opus 5.5 · Medium.**
- **Đổi lên High** khi làm bước 3 (F-108 phiên Realtime + kiểm đọc nguyên văn).
- Bước 2 (F-111) và bước 6 (F-118) làm bằng Sonnet 5.5 cũng được nếu chủ dự án muốn tiết kiệm.
- Nhóm phụ (nếu cần tìm mã rộng): Haiku 5.5.

## Đã xong (đừng làm lại)
- `openai` 7.23.0 → **7.45.1** (commit `5f317fc`, 710 test đạt). Tag trước mốc: `truoc-bh10`.
- Tra công nghệ 28/10/2026: `docs/11` mục 1 (T1–T3 máy đọc OpenAI, T9 ElevenLabs, T10 Meta). **Không tra lại**, trừ chỗ ghi [CHƯA KIỂM].

## Chỉ đọc
- `docs/11` mục **0, 1 (T1, T2, T3, T9, T10 và M1–M4), 3.1, 3.2, 4** — dùng `grep -n "^## \|^### "` rồi đọc theo đoạn.
- `BAN-GIAO.md` mục 8 "Những chỗ dễ vấp".
- Tra `SPEC.md` bằng `grep` đúng F-108 → F-111, F-118, #147 → #154. Không đọc cả tệp.

## Làm theo thứ tự (mỗi bước: test liên quan → commit nhỏ)
1. **Máy đọc giả** (`docs/11` 3.1).
   - `server/agent/nha-cung-cap/tts.js`: `nhaDoc()` thêm `gia` (khi `MOZA_AI_GIA=1` hoặc test đặt), model `may-doc-gia`.
   - Máy giả trả PCM 24 kHz im lặng theo độ dài chữ, kèm chữ chép lại; có công tắc "đọc sai một số".
   - `scripts/xem-thu.js:42-46` dùng nhà `gia`.
2. **F-111 bảng model, giá, ngày tắt** (`docs/11` 4.1).
   - `server/cau-hinh/gia-model.json`: thêm `tat_ngay` và giá các model mới.
   - `mac-dinh.json` thêm vào `nha.*.model[]`.
   - `server/nghiep-vu/chi-phi.js`: `modelSapTat`, `tinhChiPhiTtsKyTu`.
   - `server/san-sang.js`: vàng khi model còn ≤ 30 ngày là tắt, đỏ khi đã tắt.
3. **F-108 máy đọc mới** (`docs/11` 4.2) — **Opus High**.
   - **Tệp mới `nha-cung-cap/doc-realtime.js`**:
     - Dùng `OpenAIRealtimeWS` của `openai/realtime/ws` với `{model:'gpt-realtime-2.1-mini'}`, mẫu theo `chep-loi.js:105-148`.
     - `session.update`: `output_modalities:['audio']`, `audio/pcm` 24 kHz, `voice`.
     - Mỗi câu một `response.create` với `conversation:'none'`. Gom `response.output_audio.delta` và `response.output_audio_transcript.delta`.
     - Một phiên cho mỗi giọng; rảnh 2 phút thì đóng; tới 55 phút thì mở lại. Hủy bằng `response.cancel`.
     - Chi phí lấy từ `usage` trong `response.done`.
     - Kết nối phải tiêm được, để test dùng máy chủ WebSocket giả.
   - **Kiểm đọc nguyên văn** `kiemDocDung(goc, chepLai)`:
     - Dùng phần đọc số của `kiem-tra/kiem-so-noi.js`.
     - Lệch số, hoặc thiếu hơn 20% chữ → lỗi `DOC_LECH` → nơi gọi lùi về hiện chữ (`doi-ai/dan-doi.js:346-370`, `doi-ai/phong-thu.js:266`).
   - **Giọng:** `GIONG_OPENAI` chỉ giữ 10 giọng Realtime, bỏ `nova`, `fable`, `onyx` (sửa cả `phong-thu.js:319` `bangGiongOpenAi`). Thêm hằng `MODEL_OPENAI`.
   - **Nghe thử giọng:** `server/giong.js:154-164` gọi `docChu`, không gọi thẳng `/v1/audio/speech`.
   - **Tệp mới `nha-cung-cap/doc-elevenlabs.js`** (`fetch`, không SDK):
     - `POST /v1/text-to-dialogue?output_format=pcm_24000`, `model_id:'eleven_v4'`, `language_code:'vi'`.
     - **Dùng cho cả câu một giọng**, vì đường `/v1/text-to-speech` với v4 còn [CHƯA KIỂM].
     - Tìm giọng: `GET /v1/shared-voices?language=vi`, rồi `POST /v1/voices/add/{owner}/{voice}`.
     - **Chưa có khóa → làm ElevenLabs giả** để test (#154).
   - **Khóa:** `server/khoa.js` thêm `elevenlabs:'ELEVENLABS_API_KEY'` vào `TEN`/`NHAN`/`kiemTra`; `public/js/man-hinh/cai-dat.js` `NHA_KHOA`; `xem-thu.js:45`.
   - **Chọn giọng ElevenLabs:**
     - Đội AI: lưu vào `doi_ai.nhan_vat[].giong_eleven` (Cài đặt → Đội AI).
     - Mai: lưu vào `mieng.giong.elevenlabs`.
   - Thiếu khóa thì hiện chữ, không tự đổi sang nhà khác.
   - Test quét: không còn chuỗi `gpt-4o-mini-tts` trong `server/`, `public/`, `test/`. Sửa `test/doc-giong-openai.test.js` theo đường mới.
4. **F-109 Mai tự nhận AI bằng lời** (`docs/11` 4.3).
   - Câu mẫu `tu_nhan_ai_song` (5 biến thể, qua K11).
   - Hẹn giờ trong `server/phong-live.js`: phát khi bắt đầu, rồi mỗi 15 phút.
   - Nói qua `mieng.noiNguyenVan` (`mieng.js:700`), rồi kiểm chữ chép lại có chữ "trợ lý AI". Ghi `nhat_ky_song`.
5. **F-110 kiểm Business AI** (`docs/11` 4.4).
   - Phát hiện gián tiếp: tin về kênh standby; lỗi gửi tin `10 / 2018300`.
   - Ô tích riêng, nhớ 7 ngày, khóa `san_sang_tich_lau` (`san-sang.js:20`).
   - Facebook giả thêm H25, H26 vào `facebook/hanh-vi-meta.json`.
6. **F-118 nhãn "từng hoàn"** (`docs/11` 4.5).
   - `khach.tomTatMua` thêm `so_hoan` (dùng `don.soHoanCuaKhach`, `don.js:359`).
   - Nhãn hiện khi có ≥ 1 đơn hoàn: ở Đơn hàng, hồ sơ khách, và `nhan_khach` trong `chot-don.js:185`. Ngưỡng chặn AI giữ 2.
7. **Kết mốc.**
   - `npm test` đủ bộ.
   - Mở `preview_start {name:"moza-ai-gia"}` (kiểm cổng 5190 trống trước): buổi tập Đội AI và Mai dẫn chính có câu tự nhận AI; bảng Sẵn sàng có dòng Business AI và dòng model sắp tắt. Chụp ảnh. `preview_stop`.
   - Ghi `SPEC.md` mục 12 "Kết quả BH10" và sổ chi phí; sửa `BAN-GIAO.md`.
   - Commit, tag `bh10-san-sang-live`. **Dừng chờ duyệt.**

## Phép thử thật (đã duyệt chi phí, #145)
- **OpenAI máy đọc, ~0,05 USD:** chỉ chạy khi đã có khóa OpenAI. Kiểm bằng `khoa.trangThai()`, **không in khóa**. Đọc 20 câu có giá, cỡ, tên món; đối chiếu chữ chép lại; lưu 5 tệp WAV để chủ dự án nghe.
- **ElevenLabs: chưa chạy.** Chờ chủ dự án dán khóa ở Cài đặt → Khóa AI (không gửi qua chat).

## Không làm trong mốc này
GD1 (giao diện), BH11, Zalo (hoãn #153), gói MCP.

## Lưu ý máy
- Node: `"C:\Program Files\nodejs\node.exe"`. Trước khi test đặt `TEMP` / `TMP` = `data\tam-test`.
- `.claude/launch.json` có sửa đổi chưa commit của chủ dự án — **không đưa vào commit**.
