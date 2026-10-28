# Thiết kế và triển khai chi tiết — BH10 → GD1 → BH11 → BH12 → BH13

> **Đã duyệt 28/10/2026** (`SPEC.md` 3.12, #147 → #154): Q2 → Q7 theo khuyến nghị; chi phí mục 9; phần chưa có khóa làm **mô phỏng**
> (ElevenLabs chờ chủ dự án dán khóa ở Cài đặt). **Zalo tạm chưa làm — mục 8 (BH13) và câu Q1 hoãn**; khi làm lại không qua mozaai.vn.

*28/10/2026 · Bản trình duyệt · Nguồn đặc tả: `SPEC.md` 3.11 (F-108 → F-129, #128 → #146),
`docs/09`, `docs/10`. Bản này tra lại công nghệ ngày 28/10/2026 từ trang chính thức (mục 1) và đọc mã thật (HEAD `4ee2db4`) để chỉ đúng
chỗ sửa. Chỗ ghi **[CHƯA KIỂM]** là tài liệu hãng chưa nói rõ — sẽ kiểm bằng phép thử rẻ ở đầu mốc trước khi viết mã phần đó.*

---

## 0. Nguyên tắc chung cho cả đợt

1. **Làm từng mốc:** BH10 → GD1 → BH11 → BH12 → BH13 (#138). Đầu mốc tra lại tài liệu hãng (ghi `SPEC.md` mục 6); sửa đặc tả trước, code
   sau; xong mốc: `npm test` đạt, chụp ảnh bản xem thử (1440 × 900 và 1366 × 768), ghi kết quả + chi phí vào `SPEC.md` mục 12, sửa
   `BAN-GIAO.md`, commit + tag, **dừng chờ duyệt**.
2. **Mọi test 0 đồng:** AI giả, miệng giả, Facebook giả, **máy đọc giả (mới — mục 3.1)**, Decisions giả, MCP giả. Phép thử thật chỉ chạy
   khi đã báo chi phí và trong ngân sách #145 (OpenAI ≤ 0,50 USD, ElevenLabs ≤ 1 USD) — bảng ở mục 9.
3. **Không đổi nghiệp vụ đã chạy** (giữ hàng, giá, Bộ kiểm tra, luật AI với đơn). Đổi cấu trúc dữ liệu chỉ bằng tệp nâng cấp mới, theo
   #126 (không thêm giá trị vào cột có CHECK — dùng cột / bảng mới). Số tệp nâng cấp đánh theo thứ tự lúc làm, bắt đầu **023**.
4. **Quay lại được:** tag trước mỗi mốc (`truoc-bh10`, `truoc-gd1`…); mốc lớn chia nhiều commit nhỏ, mỗi commit test đạt.

---

## 1. Tra lại ngày 28/10/2026 — những điều làm đổi thiết kế

| # | Sự thật (nguồn chính thức) | Đổi gì trong thiết kế |
| --- | --- | --- |
| T1 | `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd` **tắt 6/1/2027**; OpenAI chỉ định thay bằng **`gpt-realtime-2.1-mini` qua Realtime API**; không có model mới cho `/v1/audio/speech` (developers.openai.com /deprecations, /guides/text-to-speech) | Máy đọc OpenAI phải chuyển từ "gửi chữ nhận tệp" sang **phiên Realtime WebSocket** (F-108) |
| T2 | `gpt-realtime-2.1-mini`: ra tiếng `audio/pcm` 24 kHz (không có mp3), có sự kiện chép lại tiếng ra (`response.output_audio_transcript.*`), giọng: alloy, ash, ballad, coral, echo, sage, shimmer, verse, **marin, cedar**; đổi giọng sau tiếng đầu không được; phiên tối đa 60 phút; tiếng ra 20 USD / 1 triệu token ≈ **0,024 USD / phút** (chưa tính token chữ suy luận — [CHƯA KIỂM]) | Mỗi giọng một phiên; giọng `nova`, `fable`, `onyx` đang có trong `tts.js:46` **không còn** → đổi sang giọng có trong danh sách |
| T3 | Không có hướng dẫn chính thức "đọc nguyên văn" cho model hội thoại | **Bắt buộc so chữ chép lại với câu gốc** trước khi phát (F-108) |
| T4 | **Decisions API** GA 22/10/2026: `POST /v1/decisions`, chỉ `gpt-6-luna`, nhận ảnh base64, câu hỏi `choice` (2–255 lựa chọn) trả `choice` + `confidence`, **đầu ra miễn phí**, vào 0,10 USD / 1 triệu token; SDK `client.decisions.create` từ `openai` 7.30.0 | F-113 dùng thẳng Decisions; **nâng `openai` 7.23.0 → 7.45.1** (mới nhất, 27/10/2026) |
| T5 | GPT-Live: sau khi mở phiên **không đổi được lời dặn**, chỉ thêm được ≤ 500 token (`session.instructions.append`); không có lệnh dừng câu; **không bảo đảm nói đúng nguyên văn**; không nhận ảnh; không ghi tiếng Việt trong danh sách | Tông giọng (F-127) đặt lúc mở phiên, đổi giữa buổi bằng `instructions.append`; nhãn AI bằng lời (F-109) phải kiểm chữ chép lại |
| T6 | GPT-Live gọi Decisions trong lúc nói: tài liệu **hai trang nói ngược nhau** (`decisions-voice` có `delegation.type:"decisions"` + `session.triggers`; `live-delegation` không liệt kê) | F-112 bắt đầu bằng **phép thử nhỏ** (≤ 0,05 USD); không chạy được thì giữ cách hiện tại |
| T7 | Prompt-to-voice (`POST /v1/audio/voices`, `type:"prompt"`): tạo miễn phí, ≤ 100 giọng; **chỉ dùng được với GPT-Live** (không dùng cho máy đọc Realtime); không có tiếng nghe thử; **tiếng Việt không được liệt kê** | F-114 chỉ cho Mai trên sóng; nghe thử phải mở phiên GPT-Live ngắn; phép thử tiếng Việt trước khi code |
| T8 | Lưu đệm prompt 12 giờ: `prompt_cache_options: {ttl: "12h"}` (Responses API, model từ GPT-5.6) — ghi đệm 2,5 × giá vào, đọc đệm 0,1 × | Dùng cho F-115 (lời dặn dài, gọi nhiều lần trong buổi) |
| T9 | ElevenLabs `eleven_v4` / `eleven_v4_turbo` (28/9/2026) có tiếng Việt; v4 0,08 USD, Turbo 0,04 USD / 1.000 ký tự; có `output_format=pcm_24000`; **Text-to-Dialogue** `POST /v1/text-to-dialogue` (≤ 10 giọng) dùng được v4; **v4 có chạy ở `/v1/text-to-speech` thường không — [CHƯA KIỂM]**; tìm giọng `GET /v1/shared-voices?language=vi`; có mốc thời gian từng ký tự | Nhà đọc ElevenLabs: đầu mốc gọi `GET /v1/models` (miễn phí) để chọn đường; dùng `pcm_24000` để khớp đường âm thanh hiện có |
| T10 | Meta: **không có API đọc "Business AI đang bật"** hay ứng dụng trả lời chính; chỉ biết gián tiếp: tin về kênh **standby**, hoặc gửi tin lỗi `code 10 / subcode 2018300` (Handover đã thay bằng Conversation Routing) | F-110 không tự kiểm trực tiếp được → **phát hiện gián tiếp** + ô tích tay nhớ 7 ngày |
| T11 | Cloudflare: đường hầm **có tên, địa chỉ cố định cần tên miền riêng đặt trên Cloudflare**; Quick Tunnel đổi địa chỉ mỗi lần mở; `cloudflared` mới nhất 2026.10.5 | BH13 cần chủ dự án chọn: **mua tên miền** hay dùng địa chỉ đổi mỗi lần (câu hỏi Q1) |
| T12 | MCP bản đặc tả `2026-07-28`: bỏ bắt tay, mỗi yêu cầu độc lập, một đường POST, bắt buộc `server/discover`. SDK chính thức tách gói: **`@modelcontextprotocol/server` 2.4.0** (23/10/2026) + **`@modelcontextprotocol/node` 2.1.2**; `createMcpHandler` + `toNodeHandler`; tự kiểm Bearer trước khi chuyển vào | F-128 dùng hai gói này (#144) |
| T13 | Hermes Agent: gắn MCP ở `~/.hermes/config.yaml` (`mcp_servers.<tên>.url`, `headers.Authorization`, `tools.include`); skill là `~/.hermes/skills/<tên>/SKILL.md`. Bản gốc Hermes **không có Zalo**; **mozaai.vn có add-on "Zalo cá nhân" miễn phí**, nối bằng quét QR (thư viện gì — [CHƯA KIỂM]) | F-129 xuất sẵn đoạn cấu hình + SKILL.md để dán |

**Phát hiện khi đọc mã (khác `SPEC.md`):**
- M1. `--ai-gia` **chưa có máy đọc giả** — máy đọc báo `CHUA_CO_KHOA` (`scripts/xem-thu.js:42-46`). Phải làm trước F-108 (mục 3.1).
- M2. `server/giong.js:164` gọi thẳng `gpt-4o-mini-tts` (nghe thử giọng) — ngoài `tts.js` còn chỗ này phải đổi.
- M3. **Cảnh báo khách từng hoàn đã có một phần:** `don.js:359 soHoanCuaKhach`, ngưỡng `nguong_hoan: 2` (`cai-dat.js:55`), AI không được tự
  xác nhận đơn của khách hoàn ≥ ngưỡng (`don.js:394`), câu hỏi lại "từng hoàn N đơn" (`don.js:691`). **Thiếu:** nhãn trên giao diện, và
  `khach.tomTatMua` chỉ đếm đơn Đã giao, bỏ qua Hoàn. → F-118 thu nhỏ (mục 4.5).
- M4. **Ô tích Business AI đã có** (`san-sang.js:20`, gộp với "Bình luận → tin nhắn"), lưu **theo phiên** — chưa có "nhớ 7 ngày".
- M5. **Đội AI không có danh sách tông** như `SPEC.md` F-127 ghi; tông chỉ có ở miệng Mai (`mieng.js:79-84 CACH_NOI`) và nét riêng từng
  nhân vật (`doi-ai.js:98`). → F-127 tạo danh sách tông mới dùng chung.
- M6. **Số người xem chỉ giữ 10 phút trong bộ nhớ** (`chot-don.js:338`) — F-116, F-117 cần bảng mới.
- M7. **Cổng webhook và đường hầm chỉ mở khi đã nối Facebook** (`facebook/ket-noi.js:122-160`) — BH13 cần tách ra để cổng MCP chạy được độc lập.
- M8. **99 việc Chờ duyệt** của bản xem thử = 62 việc tạo khi "Dừng mọi thứ" bật + 34 việc do giới hạn 5 tin / giờ + 3 do "Dừng mọi tự
  động"; **không có hạn** (`cho-duyet.js`). Cột `trang_thai` có CHECK (`003-agent.sql:114`).
- M9. GPT-Live hiện **không khai công cụ**; "tra cứu" là bắt số món bằng biểu thức trong lời Mai (`gpt-live.js:121-129`); chuyển đoạn đọc
  từ chữ Mai nói (`mieng.js:922`). Không có công cụ đổi cảnh OBS cho Mai.
- M10. Đơn có `nguon` CHECK (`binh_luan_live`, `tin_nhan`, `nguoi` — `012-ban-hang.sql:214`) → đơn Zalo không thêm giá trị mới; dùng cột mới.
- M11. Giao diện: số tiền có **5 bản hàm định dạng**, màu trạng thái có **~15 bảng riêng**, 26.000đ/USD viết cứng 3 chỗ, phông tải từ Google
  (mất mạng là hỏng phông), 38 hộp `confirm`/`prompt` của trình duyệt, Màn hình người dẫn là một hàm 700 dòng (`nguoi-dan.js`).

---

## 2. Cần chủ dự án chọn trước khi code (mỗi câu có khuyến nghị)

| Câu | Lựa chọn | Khuyến nghị |
| --- | --- | --- |
| **Q1. Địa chỉ cổng Zalo (BH13)** | A. **Mua một tên miền** (ví dụ `.com` khoảng 250–350 nghìn đồng / năm), đặt ở Cloudflare gói miễn phí → địa chỉ cố định, dán vào mozaai.vn một lần. B. Dùng Quick Tunnel miễn phí → **địa chỉ đổi mỗi lần mở MOZA**, phải dán lại vào mozaai.vn mỗi lần | **A** — B dễ quên dán lại, khách Zalo hỏi không ai trả lời |
| **Q2. Nhãn "từng hoàn" (F-118)** | Hiện nhãn từ **1** đơn hoàn; ngưỡng chặn AI tự xác nhận giữ **2** như hiện có | Như vậy |
| **Q3. Kiểm Business AI (F-110)** | Facebook không cho hỏi trực tiếp → máy **tự phát hiện gián tiếp** (tin bị giữ ở kênh chờ, lỗi gửi tin đặc thù) + **ô tích tay tách riêng, nhớ 7 ngày** | Như vậy |
| **Q4. Giọng riêng của Mai (F-114)** | Chỉ áp cho **Mai nói trên sóng** (GPT-Live); máy đọc của Đội AI vẫn dùng giọng có sẵn. Phải qua phép thử nghe tiếng Việt (~0,05 USD) trước | Như vậy |
| **Q5. Nâng thư viện** | `openai` 7.23.0 → **7.45.1** (cần cho Decisions; các đổi phá vỡ chỉ ở kiểu dữ liệu Decisions); thêm `@modelcontextprotocol/server` 2.4.0 + `@modelcontextprotocol/node` 2.1.2 ở BH13 (#144) | Đồng ý |
| **Q6. Phông chữ** | Lưu Be Vietnam Pro + Lora **ngay trong máy** (giấy phép OFL, tải một lần) thay vì tải từ Google mỗi lần mở | Đồng ý — không mạng vẫn đúng phông |
| **Q7. Hạn của "Chờ duyệt"** | Việc chờ do máy tự chặn (Dừng mọi thứ, giới hạn tin) **hết hạn sau 24 giờ**, ghi lý do; việc AI xin duyệt thật thì giữ tới khi người bấm | Đồng ý |

---

## 3. Nền chung (làm trước, dùng cho nhiều tính năng)

### 3.1 Máy đọc giả (đầu BH10)
- `server/agent/nha-cung-cap/tts.js`: thêm nhà `gia` — trả PCM 24 kHz im lặng có độ dài theo số chữ (khoảng 14 ký tự / giây), kèm "chữ
  chép lại" = câu gốc (để test phần so chữ). `nhaDoc()` trả `gia` khi `MOZA_AI_GIA=1` (`scripts/xem-thu.js`) hoặc test đặt.
- Có công tắc trong test để máy đọc giả **đọc sai một số** (thử nhánh "lệch số → bỏ tiếng").
- **Xong khi:** bản xem thử `moza-ai-gia` chạy buổi tập Đội AI có tiếng (im lặng) không báo thiếu khóa.

### 3.2 Nâng `openai` lên 7.45.1 (đầu BH10)
- `npm install openai@7.45.1`, chạy toàn bộ test; ghi `SPEC.md` mục 6. Chỗ dùng Responses (`nha-cung-cap/openai.js:63`) giữ nguyên.

### 3.3 Nhà cung cấp Decisions (đầu BH11)
- `server/agent/nha-cung-cap/openai.js`: thêm `quyetDinh({model:'gpt-6-luna', input, questions, tinHieu})` → `client.decisions.create`;
  trả `{answers, usage}`; ghi chi phí (chỉ token vào) qua `chi-phi.js`. Giả: `gia-mau.js` thêm `quyetDinh` trả lựa chọn đặt sẵn.

### 3.4 Bảng màu trạng thái và hàm định dạng chung (đầu GD1)
- `public/js/trang-thai.js`: **một** bảng `{loại → {chữ, màu: ok|warn|bad|info|mute, biểu tượng}}` cho đơn, sản phẩm, kho, kênh, agent,
  việc; hàm `chipTrangThai(loai, ma)`. Thay ~15 bảng riêng (`don.js:19`, `san-pham.js:8`, `agent.js:22`, `tong-quan.js:21`,
  `bao-cao.js:28`, `live.js:59`, `app.js:125`, `cai-dat-facebook.js:64`…).
- `public/js/dinh-dang.js`: `tien()` ("10.000đ"), `docTien()` (chuyển từ `san-pham.js:19`), `usd()`, `vnd(usd)` (theo tỷ giá cài đặt),
  `ngay()` dd/mm/yyyy, `gioPhut()`. Thay 5 bản `tien` và 3 chỗ 26000 viết cứng.

---

## 4. BH10 — Sẵn sàng live thật (thứ tự: 3.1 → 3.2 → F-111 → F-108 → F-109 → F-110 → F-118)

### 4.1 F-111 Bảng model, giá, ngày tắt
- `server/cau-hinh/gia-model.json`: thêm ô `tat_ngay` (YYYY-MM-DD) cho từng model; thêm giá (tra 28/10/2026, USD / 1 triệu token
  vào / ra): `gpt-6.1-sol` 2 / 10, `gpt-6.1-terra` 1 / 5, `gpt-realtime-2.1-mini` (chữ 0,60 / 2,40; tiếng 10 / 20), `claude-sonnet-5-5`
  2 / 10, `claude-haiku-5-5` 0,10 / 0,50; khối mới `tts_ky_tu` cho ElevenLabs (`eleven_v4` 0,08, `eleven_v4_turbo` 0,04 USD / 1.000 ký
  tự). `gpt-4o-mini-tts` ghi `tat_ngay: 2027-01-06`; `gpt-4o-transcribe`, `whisper-1` `2027-02-26` (MOZA không dùng, ghi để báo nếu ai chọn).
- `server/cau-hinh/mac-dinh.json` `nha.openai.model[]` / `nha.anthropic.model[]`: thêm các model trên để chọn ở Cài đặt → Agent
  (`kiemModel`, `cai-dat.js:277`).
- `server/nghiep-vu/chi-phi.js`: `modelSapTat(ngay)` → danh sách `{model, noi_dung, tat_ngay, con_ngay}` cho mọi model đang được dùng
  (agent, miệng, máy đọc, chép lời); `tinhChiPhiTtsKyTu(model, soKyTu)`.
- `server/san-sang.js`: còn ≤ 30 ngày → vàng; đã tắt → đỏ, mỗi dòng có nút "Đổi model".
- **Test:** tua ngày 10/12/2026 với máy đọc vẫn là `gpt-4o-mini-tts` → vàng; 7/1/2027 → đỏ; giá đọc đúng từ bảng.

### 4.2 F-108 Máy đọc giọng mới (OpenAI chính, ElevenLabs thêm)
**Nhà `openai` — `gpt-realtime-2.1-mini`:**
- Tệp mới `server/agent/nha-cung-cap/doc-realtime.js`: lớp `PhienDoc` — mở `wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini`
  (dùng `ws` có sẵn), gửi `session.update` `{type:'realtime', output_modalities:['audio'], instructions: LOI_DAN_DOC,
  audio:{output:{voice, format:{type:'audio/pcm', rate:24000}}}}`.
  - `LOI_DAN_DOC`: "Bạn là máy đọc. Đọc **đúng nguyên văn** câu được gửi bằng tiếng Việt, giọng tự nhiên; không thêm, bớt, đổi chữ;
    không trả lời; con số đọc đúng như viết." + cách nói của lượt (nếu có).
  - Mỗi câu: `response.create` ngoài hội thoại `{conversation:'none', input:[{type:'message', role:'user', content:[{type:'input_text',
    text: chu}]}]}` → gom `response.output_audio.delta` (base64 PCM) → đẩy dần ra `khiAm` như hiện nay; gom
    `response.output_audio_transcript.delta` thành **chữ chép lại**.
  - **Một phiên cho mỗi giọng** (không đổi giọng được sau tiếng đầu); giữ phiên rảnh tối đa 2 phút rồi đóng; mở lại trước mốc 55 phút.
  - `tinHieu` (hủy) → `response.cancel`.
- **Kiểm đọc nguyên văn** (`tts.js` mới `kiemDocDung(goc, chepLai)`): tách số (dùng bộ đọc số của `kiem-so-noi.js`, kể cả số nói bằng chữ) —
  số khác nhau hoặc thiếu > 20% chữ → **bỏ tiếng, trả lỗi `DOC_LECH`**; nơi gọi (câu chen `dan-doi.js:346`, Đội AI `phong-thu.js:266`) lùi
  về hiện chữ như khi chạm trần (đường có sẵn `dan-doi.js:353-359`). Ghi nhật ký lỗi đọc.
  - Đội AI soạn trước (tệp WAV lưu sẵn) thì kiểm lúc làm tiếng, câu lệch làm lại 1 lần rồi mới bỏ.
- `docChu` / `docHoiThoai` (`tts.js:363, 393`) giữ nguyên chữ ký hàm; bên trong chọn nhà theo `nhaDoc()`. `docHoiThoai` với OpenAI đọc
  từng lượt nối nhau (như hiện nay, nghỉ 0,2 giây).
- Giọng: `GIONG_OPENAI` đổi thành đúng 10 giọng Realtime; `bangGiongOpenAi` (`phong-thu.js:319`) bỏ `nova`, `fable`, `onyx`; Mai = `marin`.
- Chi phí: tính theo `usage` thật trả về ở `response.done` (thay cách ước lượng 21 token / giây hiện nay).
- `server/giong.js:154 thuOpenAI` → gọi `docChu` (không gọi thẳng `/v1/audio/speech`).
- Bỏ hẳn `gpt-4o-mini-tts` khỏi mã và cấu hình; tệp tiếng lưu sẵn cũ không xóa (khóa băm có tên model nên tự làm mới khi cần).

**Nhà `elevenlabs`:**
- Tệp mới `server/agent/nha-cung-cap/doc-elevenlabs.js` (gọi bằng `fetch`, không SDK):
  - **Đầu mốc (miễn phí, cần khóa):** `GET /v1/models` xem `eleven_v4_turbo` / `eleven_v4` có `can_do_text_to_speech`. Có → câu chen dùng
    `POST /v1/text-to-speech/{voice_id}?output_format=pcm_24000` với `eleven_v4_turbo`, `language_code:'vi'`. Không → dùng
    `POST /v1/text-to-dialogue` (một lượt) với `eleven_v4`.
  - Đội AI nhiều giọng: `POST /v1/text-to-dialogue?output_format=pcm_24000` `{inputs:[{text, voice_id}…], model_id:'eleven_v4',
    language_code:'vi'}` (≤ 10 giọng, ≤ 2.000 ký tự mỗi lần — dài hơn thì chia).
  - Không cần bước so chữ (đọc thẳng chữ). Chi phí tính theo ký tự (`tinhChiPhiTtsKyTu`).
- `server/khoa.js`: thêm `elevenlabs: 'ELEVENLABS_API_KEY'` vào `TEN` / `NHAN`, nhánh `kiemTra` (gọi `GET /v1/models`); `cai-dat.js`
  (giao diện) thêm dòng khóa; `scripts/xem-thu.js:45` xóa khóa này khi AI giả.
- **Chọn giọng tiếng Việt:** Cài đặt → Giọng → "Giọng ElevenLabs": danh sách từ `GET /v1/shared-voices?language=vi` (lọc giới tính, nghe
  `preview_url` — miễn phí), bấm "Dùng" → `POST /v1/voices/add/{public_owner_id}/{voice_id}` → lưu `voice_id` vào nhân vật
  (`doi_ai.nhan_vat[].giong_eleven`) và Mai (`mieng.giong.elevenlabs`). Ưu tiên giọng Bắc nếu thư viện có nhãn vùng ([CHƯA KIỂM] tên nhãn).
- `mac-dinh.json doc_giong.nha`: `openai` (mặc định) | `elevenlabs` | `gemini` | `gia`. Thiếu khóa nhà đã chọn → hiện chữ, **không tự đổi
  sang nhà khác** (#130).

- **Test (0 đồng):** máy đọc giả hai nhà; phiên Realtime giả (máy chủ WebSocket giả trong test, phát các sự kiện đúng tên tài liệu); câu
  chép lại lệch số → `DOC_LECH` + hiện chữ; không còn chuỗi `gpt-4o-mini-tts` trong `server/`, `public/`, `test/` (test quét); ElevenLabs
  giả trả PCM; chọn giọng giả.
- **Phép thử thật (sau duyệt, mục 9):** 20 câu có giá, cỡ, tên món mỗi nhà; Claude Code đối chiếu chữ chép lại; chủ dự án nghe 5 câu mỗi
  nhà rồi chọn nhà mặc định.

### 4.3 F-109 Mai tự nhận là trợ lý AI bằng lời
- Câu mẫu mới ở `server/cau-hinh/cau-mau-khach.json` khóa `tu_nhan_ai_song` (5 biến thể, có `{ten_shop}`, qua K11), ví dụ "Cả nhà nhớ giúp
  Mai là trợ lý AI của {ten_shop} nha, có gì cần người thật thì nhắn shop."
- Bộ hẹn giờ trong `server/phong-live.js` (cạnh `hoiNguoiXem`): khi bắt đầu buổi và mỗi 15 phút (bỏ qua nếu 15 phút qua đã có câu tự nhận):
  - Mai nói cùng / Mai dẫn chính → `mieng.noiNguyenVan(cau)` (`mieng.js:700`), rồi **kiểm chữ chép lại có "trợ lý AI"**; không có → nhắc lại
    một lần; vẫn không → ô nhắc người dẫn tự nói.
  - Chỉ gợi ý → máy đọc nói ra loa nếu loa bật, không thì ô nhắc lớn trên Màn hình người dẫn "Đến lúc nói: …".
  - Đội AI dẫn → giữ câu "người mới vào" (`doi-ai-cau-mau.json:14-15`), thêm lượt tự nhận nếu 15 phút chưa có.
  - Không chen khi đang đọc tên người chốt (đợi câu xong).
- Ghi vào nhật ký buổi live (`nhat_ky_song`) để có bằng chứng.
- **Test:** buổi tập tua 31 phút → đúng 3 lần ở mỗi chế độ; miệng giả bỏ chữ "AI" → nhắc lại rồi ô nhắc; Dừng AI → ô nhắc.

### 4.4 F-110 Kiểm Business AI (theo Q3)
- **Phát hiện gián tiếp** (`server/facebook/`): (a) webhook có tin ở kênh `standby` (tin của khách đang do ứng dụng khác giữ) → ghi cờ
  `business_ai_nghi` kèm lúc; (b) gửi tin bị lỗi `code 10 / subcode 2018300` → ghi cờ. Có cờ trong 24 giờ → bảng Sẵn sàng **đỏ**: "Có ứng dụng
  khác (có thể là trợ lý AI của Facebook) đang trả lời khách — tắt trong Meta Business Suite → Cài đặt → Định tuyến hội thoại".
- **Ô tích tay tách riêng** khỏi "Bình luận → tin nhắn" (`san-sang.js:20`), lưu ở khóa cài đặt mới `san_sang_tich_lau` `{ma: lúc}` — nhớ 7
  ngày rồi hỏi lại.
- Facebook giả: thêm hành vi **H25** (tin về standby) và **H26** (lỗi 2018300) ở `facebook/hanh-vi-meta.json`.
- **Test:** H25 → đỏ có hướng dẫn; tích → xanh 7 ngày, tua 8 ngày → hỏi lại.

### 4.5 F-118 Nhãn "từng hoàn" (theo Q2; tận dụng mã có sẵn)
- `khach.tomTatMua` (`khach.js:147`) thêm `so_hoan` (dùng `don.soHoanCuaKhach`, `don.js:359`) — không thêm bảng.
- Hiện nhãn đỏ "Từng hoàn N đơn — nên gọi xác nhận / chuyển khoản trước" khi `so_hoan ≥ 1` ở: danh sách + chi tiết đơn (`public/js/man-hinh/don.js`),
  hồ sơ khách (Hộp thư, Khách hàng), dòng "Vừa chốt" (`chot-don.js:185` thêm vào `nhan_khach`). AI không thấy nhãn này trong câu gửi khách.
- Ngưỡng chặn AI tự xác nhận (`nguong_hoan: 2`) giữ nguyên.
- **Test:** khách 1 đơn hoàn → nhãn ở đơn mới; 0 → không; không câu mẫu / thẻ gửi khách nào chứa nhãn.

**BH10 xong khi:** `npm test` đạt; bản xem thử `moza-ai-gia` chạy buổi tập Đội AI + Mai dẫn chính có câu tự nhận; bảng Sẵn sàng có dòng
Business AI và báo model sắp tắt; ảnh chụp; tag `bh10-san-sang-live`. Phép thử nghe thật chờ chủ dự án.

---

## 5. GD1 — Giao diện gọn và rõ (thứ tự: 3.4 → F-119 → F-121 → F-120 → F-122 → F-123 → F-124 → F-125)

Không đổi nghiệp vụ, không đổi API cũ (chỉ thêm). Mỗi màn làm xong chụp ảnh gửi chủ dự án.

### 5.1 F-119 Khung giao diện chung
- **Khung:** `public/index.html` + `public/js/app.js` — thay thanh trên bằng **menu trái** (rộng 200 px, thu gọn còn biểu tượng dưới 1280 px):
  Bán hàng (Hôm nay, Livestream, Đơn hàng, Tin nhắn) · Hàng hóa (Sản phẩm, Tồn kho, Khách hàng) · Shop (Sổ tay, Báo cáo, Cài đặt). Đầu nội
  dung: ô "Nói với Mai" + chip trạng thái + "Dừng mọi thứ" (giữ id `#khanCap`, `#trangThai` để mã cũ chạy).
- **Đường dẫn cũ vẫn chạy:** `MAN_HINH` (`app.js:24-37`) thêm bảng đổi tên: `#/tong-quan → #/hom-nay`, `#/agent… → #/cai-dat/tro-ly-ai…`,
  `#/hop-thu → #/tin-nhan` (nhãn "Tin nhắn", mã giữ `hop-thu.js`).
- **"Trợ lý AI"** (= màn `agent.js` hiện nay) chuyển vào Cài đặt; tab Hook, Luật quyền, Lời dặn vai trò, Agent thử nghiệm chỉ hiện khi bật
  **"Nâng cao"** (lưu `localStorage`).
- **Token CSS** (`app.css:3-12`): thêm khoảng cách (`--k1…--k6`), bo góc, cỡ chữ (`--c-nho…--c-so-lon`); màu nguy hiểm riêng cho nút; dark
  theme Màn hình người dẫn dùng cùng token (bỏ màu rgba viết cứng `app.css:432-435`).
- **Phông trong máy (Q6):** `public/font/` Be Vietnam Pro (400, 500, 600, 700) + Lora 600, dạng woff2, kèm tệp giấy phép OFL; bỏ link Google.
- **Bỏ mã kỹ thuật** khỏi chữ người dùng thấy: 10 chuỗi ở `public/` (`agent.js:222`, `cai-dat.js:298-425`) + 6 chỗ phía máy chủ
  (`api/agent.js:78`, `agent/hook/cua.js:19`, `kich-ban-dien-tap.json` dòng 282, 1254, 1281, 1293). Ghi chú dài → biểu tượng ⓘ (hàm `goiY()`
  mới trong `ui.js`).
- **Ngày:** ô ngày Báo cáo (`bao-cao.js:133-134`) thay `type=date` bằng ô chữ dd/mm/yyyy + nút nhanh (Hôm nay · 7 ngày · 30 ngày · Tháng
  này). **Tiền:** ô nhập tiền dùng `docTien` + hiện "10.000đ" khi rời ô (phí ship, giá, ngưỡng).
- **Trang trống** có câu mời + một nút (Polaris). **Biểu tượng tab** `public/favicon.svg`.
- **Bật / tắt từng phần** (Cài đặt → Phần mềm): danh sách phần ẩn được (Đội AI & Radio, Ảnh khách mặc thật, MOZA nhìn, Bình chọn, Lịch
  live…) lưu ở cài đặt `giao_dien.an[]` — chỉ ẩn mục menu và khối giao diện, không tắt chức năng máy chủ.
- **Hộp hỏi lại:** hàm `hoi()` (khung trong trang) thay `confirm`/`prompt` **ở các màn được làm lại trong GD1** (không sửa hết 38 chỗ một lúc).
- **Test:** mở rộng `test/ra-chu.test.js` — chữ người dùng thấy (đã bỏ chú thích) không có `(#số)` / `(F-số)`; mọi chip trạng thái đi qua
  `trang-thai.js` (quét không còn bảng màu riêng); đường dẫn cũ đổi đúng.

### 5.2 F-121 Bảng "AI & kênh", tỷ giá VNĐ, "Cần xử lý", hạn Chờ duyệt
- **Bảng "AI & kênh"** (Cài đặt, mục đầu): mỗi dòng là một việc AI (đọc chốt khó, Director, Co-host, Tư vấn viên Messenger, Mai trên sóng,
  Đội AI & Radio, MOZA nhìn, Nói với Mai, soạn bài, tổng kết…) với: **Bật / Tắt** (dùng cờ agent có sẵn), **trần / ngày** (ô có sẵn
  `agent.js:84-86`), **đã dùng hôm nay** (từ `agent_run`), ghi chú; đầu bảng nút **Dừng mọi tự động** (F-72 giữ nguyên luật). Không thêm khái
  niệm "Diễn tập" cho Messenger (chưa có).
- **Tỷ giá:** cài đặt `ty_gia_vnd` (mặc định 26.000, sửa được); mọi chỗ hiện USD hiện thêm "≈ … đ" qua `dinh-dang.vnd()`.
- **"Cần xử lý":** đầu Cài đặt — gom các mục đỏ / vàng của `san-sang.kiem()` loại cài đặt (thiếu khóa, Facebook chưa nối, thiếu tài khoản
  nhận tiền, model sắp tắt…), mỗi dòng một nút tới đúng chỗ.
- **Hạn Chờ duyệt (Q7):** tệp nâng cấp mới thêm cột `het_han_luc` cho `cho_duyet` (không đổi CHECK); việc tạo do "Dừng mọi thứ" / giới hạn
  tin (`agent/thuc-hien.js:87`) đặt hạn 24 giờ; `demCho` / `danhSach` bỏ việc quá hạn, màn Chờ duyệt có mục "Đã hết hạn" để xem lại.
- **Test:** đổi Bật / Tắt ở bảng = đổi ở chỗ cũ; tỷ giá đổi → số VNĐ đổi; việc quá hạn không còn được đếm.

### 5.3 F-120 Trang "Hôm nay"
- `public/js/man-hinh/hom-nay.js` (thay `tong-quan.js`, API `/bao-cao/tong-quan` giữ + thêm trường):
  - Thẻ **buổi live kế tiếp** (`lich-live.js` buổi kế) + nút **Bắt đầu live** (→ F-122) / **Tập trước** (→ Phòng diễn tập) + dòng sẵn sàng.
  - 4 con số: Chờ xác nhận · Cần gửi · Doanh số hôm nay · Khách cần bạn; số 0 thay bằng câu chỉ việc.
  - **Việc cần làm** theo mức Gấp / Sắp hết / Nên làm (dùng `hangViec` có sẵn, gắn mức).
  - **Đội AI như nhân viên:** API mới `GET /agent/doi-hinh` → mỗi việc AI đang bật: tên dễ hiểu, trạng thái (Chờ việc · Đang làm · Diễn tập ·
    Tắt · Dừng vì trần), số việc hôm nay.
  - **Chỉ số AI 7 ngày bằng lời thường:** API mới `GET /agent/chi-so?ngay=7` từ `agent_run` + câu bị chặn (có sẵn) → "Xử lý xong N việc ·
    chuyển cho bạn N · N câu bị chặn (N vì con số không có trong nguồn…) · lỗi N% · chi phí X USD ≈ Y đ".

### 5.4 F-122 "Bắt đầu live" 3 bước
- `live.js` tách: `vePhien` (`:68`) / `veBatDau` (`:375`) / `veKiemTra` (`:234-284`) chuyển sang tệp mới `public/js/man-hinh/bat-dau-live.js`
  (bước 1 kịch bản; bước 2 bốn thẻ chế độ có hình + tông giọng khi có F-127; bước 3 bảng Sẵn sàng thu gọn) → **Lên sóng** / Tập trước. Dùng
  đúng API phiên hiện có (`POST /live/phien`…). Kịch bản và Phòng diễn tập giữ ở tab của Livestream.
- Bỏ `confirm()` danh sách đỏ (`live.js:434-438`) → bước 3 hiện đỏ có lý do và nút sửa.

### 5.5 F-123 Đơn hàng mới
- `don.js`: 4 tab **Cần làm** (chờ xác nhận, thiếu thông tin, chờ tiền CK, cần gửi) · Đang giao · Xong · Hủy, hoàn — lọc phía máy chủ bằng
  tham số mới `?nhom=can_lam|dang_giao|xong|huy_hoan` (thêm vào `api/don.js`, giữ tham số cũ).
- Chi tiết: **dòng hành trình** (từ lịch sử đơn có sẵn: nguồn → tin riêng → khách gửi thông tin → chờ xác nhận → …); **ô thêm món** "gõ 12 đen
  M": API mới `POST /don/:id/them-theo-chu {chu}` → xuất `timMon` (`agent/cong-cu/don.js:45`) ra dùng chung → `don.themMon` (`don.js:233`, giữ
  hàng, giá theo F-93); sai thì báo rõ. Phí ship ô tiền. **Một** nút chính theo trạng thái; Hủy vào menu ⋯ dùng `hoi()` có ô lý do.
- **Test:** "12 đen M" thêm đúng phân loại; món hết → báo; đổi món vẫn qua `don.js`.

### 5.6 F-124 Sản phẩm chia tab
- `san-pham.js`: 6 nhóm ô (`:266-376`) → 5 tab Cơ bản · Màu và cỡ · Ảnh · Thông tin cho Mai · Hỏi đáp; chấm báo tab còn thiếu (dùng độ đầy đủ
  có sẵn). Tab **Màu và cỡ** = lưới tồn có màu: bấm ô → ô nhỏ "Nhập thêm / Điều chỉnh" → `kho.ghiThayDoi` (API kho có sẵn). Cột giá riêng.
- Sửa lỗi nhãn ảnh: "Làm đại diện" và "Bỏ" thôi chồng nhau (`app.css:373`) — "Bỏ" góc phải, "Làm đại diện" dưới ảnh.
- Nhãn "AI đoán" + "Đúng" giữ cách có sẵn (`san-pham.js:189-194`), đổi màu theo bảng chung.

### 5.7 F-125 So sánh bản cũ / bản mới
- `public/js/so-sanh.js`: so theo dòng (thuật toán dãy con chung dài nhất, tự viết, không thư viện) → dòng Thêm / Sửa / Bỏ có màu.
- Sổ tay (`so-tay.js:112-115`): xem một bản = so với bản trước. "Nói với Mai" (`noi-voi-mai.js:31-46`): các việc ghi đã có dạng "cũ → mới"
  (`cong-cu/quan-ly.js`) → hiện thành bảng hai cột.

**GD1 xong khi:** `npm test` đạt (kể cả test quét chữ); ảnh chụp mọi màn ở 1440 × 900 và 1366 × 768 không vỡ; đường dẫn cũ vẫn mở đúng; tag
`gd1-giao-dien`.

---

## 6. BH11 — Mai thông minh hơn (thứ tự: 3.3 → F-116 → F-115 → F-126 → F-127 → F-113 → F-112 → F-114)

### 6.1 F-116 Bảng huấn luyện người dẫn
- **Bảng mới** `so_lieu_phut (phien_id, phut, nguoi_xem, binh_luan, chot, cau_hoi, PRIMARY KEY(phien_id, phut))` — tệp nâng cấp mới. Ghi mỗi
  phút ở `phong-live.js` (cạnh `hoiNguoiXem :177`, đã hỏi `live_views` mỗi 60 giây); bình luận / chốt / câu hỏi đếm từ bảng có sẵn.
- `server/huan-luyen.js` (mới, bằng mã, 0 đồng) chạy mỗi 20 giây, phát ws `live.huan_luyen {canh_bao, so_lieu_phut[]}`:
  1. **Câu hỏi chưa ai trả lời > 60 giây** — câu hỏi (Director gắn) chưa có sự kiện trả lời (Mai nói về món đó, trả lời bình luận, người dẫn bấm
     "Đã trả lời" / dùng F-115).
  2. **Người xem tụt ≥ 30% trong 3 phút** (từ `so_lieu_phut`).
  3. **5 phút chưa nhắc cách chốt / giá** — dò chữ chép lời người dẫn + lời Mai (từ khóa "chốt", "giá", số tiền).
  4. Món nguội — giữ gợi ý nhịp F-85.
  Tối đa **1 cảnh báo / 2 phút**, ưu tiên theo thứ tự trên; Đội AI dẫn → chỉ số, không cảnh báo.
- Biểu đồ nhỏ theo phút: SVG tự vẽ trong Màn hình người dẫn (không thư viện).

### 6.2 F-115 Chạm để trả lời
- Màn hình người dẫn: chạm một bình luận → `POST /live/phien/:id/tra-loi-binh-luan {binh_luan_id}` → hỏi **size có số đo** thì
  `tu-van-size.js` (bằng mã); còn lại giao **Co-host có sẵn** (`phong-ai.js:391 giaoCohost`, công cụ `de_xuat_cau_song`) với đúng bình luận đó →
  qua Bộ kiểm tra → `hienGoiY` (`:355`) → ws `live.goi_y` có thêm `binh_luan_id`.
- Thẻ gợi ý: câu, **nguồn** (thẻ món / tồn kho / Sổ tay — từ trích dẫn Co-host đã có), nút **[Mai nói]** (`mieng.noiNguyenVan`, chế độ Chỉ
  gợi ý thì máy đọc), **[Tự đọc]** (đóng, đánh dấu đã trả lời), **[Trả lời bình luận]** (đăng dưới bình luận qua đường trả lời có sẵn, giữ giới hạn
  liên hệ), **[Bỏ]**.
- Co-host dùng `gpt-6-luna`, suy nghĩ tắt, `prompt_cache_options:{ttl:'12h'}` cho lời dặn + thẻ món (T8). Dừng AI → ẩn nút chạm; hỏi size vẫn
  chạy bằng mã.

### 6.3 F-126 Màn hình người dẫn "chế độ sân khấu"
- `nguoi-dan.js` (806 dòng, một hàm) tách thành khối nhỏ: `nd-thanh.js` (thanh trên), `nd-mon.js` (món + lưới tồn), `nd-goi-y.js` (thẻ gợi ý),
  `nd-ben-phai.js` (cảnh báo, Vừa chốt, bình luận lọc), giữ một bộ nghe ws chung và các phím tắt (`:671-685`: Cách = Dừng AI, ←/→ chuyển đoạn,
  Enter, 1/2/3 cảnh).
- `app.js:51-69`: route `#/nguoi-dan` ẩn menu trái + ô Nói với Mai (hiện chỉ ẩn ô Nói với Mai); thanh mảnh: giờ live, đèn Facebook / OBS /
  AI / mạng, xem · chốt · xác nhận, chế độ, **một nút Dừng AI**; "Dừng mọi thứ" vào menu ⋯ của thanh.
- Lưới 3 vùng cố định (CSS grid, `height: 100vh`, không cuộn ở 1366 × 768): món đang bán (giá + lưới tồn chữ to theo token `--c-so-lon`); thẻ gợi ý
  (F-115); "Tiếp theo". Cột phải: dải cảnh báo (F-116), Vừa chốt (kèm nhãn F-118), bình luận lọc **Muốn mua / Hỏi / Khách cũ / Tất cả** (loại
  có sẵn từ đọc chốt + Director + khách cũ). Nội dung phụ (lời dặn, tập, Hỏi Mai) vào ngăn kéo mở bằng phím.
- Lời Mai, ghi chú cho Mai, cảnh báo: ba màu khác nhau. Cảnh báo nguy cấp (mất Facebook / OBS, hết hàng món đang bán, AI lỗi) mới có dải đỏ + tiếng.
- **Cỡ chữ:** dựng trang thử ba cỡ (con số chính 64 / 80 / 96 px) — chủ dự án đứng cách laptop 2 m chọn; ghi vào token.

### 6.4 F-127 Tông giọng cho Mai trên sóng
- Danh sách tông mới `server/cau-hinh/tong-giong.json` (sửa `SPEC.md`: Đội AI chưa có danh sách để dùng chung — M5): `deu_ro`, `mc_vua`,
  `mc_soi_noi`, `am_ap`, `tu_viet` (≤ 400 ký tự), mỗi mục một đoạn chỉ dẫn cách nói tiếng Việt.
- Mai: ghép vào cuối lời dặn ở `taoLoiDan` (`mieng.js:157`) khi mở miệng; đổi giữa buổi → `session.instructions.append` (GPT-Live, ≤ 500 token —
  T5) hoặc mở lại miệng (Gemini). Đội AI: dùng làm cách nói mặc định cho lượt không ghi cách nói.
- Cài đặt → Giọng Mai: chọn tông + "Nghe thử" (máy đọc đọc một câu mẫu với tông — tốn phí nhỏ, giới hạn 3 lần / phút). Bước 2 của "Bắt đầu live"
  có ô chọn tông.
- `mieng-gia.js:23` lưu `giong`, `loiDan` để test kiểm đoạn tông.

### 6.5 F-113 MOZA nhìn bằng Decisions
- `agents/nhin-mon.js:28`: thay `chayAgent` (Responses + lược đồ) bằng `quyetDinh` (3.3): `input` = ảnh camera (base64 JPEG nhỏ như hiện nay) +
  `input_json` bảng mẫu; một câu hỏi `choice` tên `mon`, `choices` = ≤ 10 món của kịch bản (`value: "so_12"`, `description`: tên + màu chính) +
  `khong_ro`.
- Đổi ngưỡng: `confidence ≥ 0,8` và không phải `khong_ro` = "chắc"; giữ luật 2 lần liền (`nhin-mon.js:227 xet`), chỉ gợi ý, tắt mặc định, không lưu ảnh.
- **Phép thử 52 khung có sẵn** (`scripts/thu-ai/thu-nhin-mon.js` thêm cờ `--decisions`): đúng ≥ 80%, "chắc mà sai" ≤ 1/20; so tốc độ + chi phí với cách cũ.

### 6.6 F-112 Mai làm việc trong lúc nói (GPT-Live + Decisions)
- **Bước 0 — phép thử nhỏ (≤ 0,05 USD, sau duyệt):** mở GPT-Live với `session.triggers:[{type:'decisions',
  event_type:'session.output_transcript.delta', decisions:{questions:[…]}}]`, **giữ `delegation:{type:'client'}`** như hiện nay; xem có nhận
  `decision.event` / `decision.completed` không, độ trễ bao nhiêu, khóa có quyền `api.decisions.write` không. Không chạy → dừng F-112, ghi lý do, giữ
  cách đọc chữ hiện có.
- Chạy được: câu hỏi `choice` "Mai đang giới thiệu món nào?" (món của kịch bản + `khong_doi`) và `predicate` "Mai vừa mời khách xem bảng
  size / chất liệu?". Kết quả mới nhất (bỏ kết quả cũ đến muộn) → `live.doiDoan` + `chieuManHinhMieng` (`mieng.js:230`) **chỉ ở chế độ Mai
  dẫn chính / Mai nói cùng**; Chỉ gợi ý giữ nguyên (không tự chuyển). Cách đọc chữ `viTriChuyenSang` (`mieng.js:328`) giữ làm dự phòng.
- Cập nhật danh sách câu hỏi khi đổi đoạn bằng `session.update` (chờ `session.updated`).

### 6.7 F-114 Giọng riêng của Mai (theo Q4)
- **Phép thử trước khi code (≤ 0,05 USD):** tạo 1 giọng `POST /v1/audio/voices {type:'prompt', name, prompt}` (miễn phí) + mở GPT-Live 30
  giây đọc 3 câu bán hàng tiếng Việt → chủ dự án nghe. Không đạt → không làm, ghi lý do.
- Đạt: Cài đặt → Giọng Mai: ô mô tả (≤ 2.000 ký tự) → tạo → lưu `mieng.giong.openai = {id}`; khi mở GPT-Live gửi `audio.output.voice:{id}` và
  **lặp lại mô tả trong lời dặn** (theo tài liệu). "Nghe thử" = phiên GPT-Live ngắn (tốn phí nhỏ, có hỏi trước). Xóa giọng (SDK có). Giới hạn 100
  giọng — chỉ giữ giọng đang dùng + 3 giọng gần nhất.
- Máy đọc Realtime không dùng được giọng này (T7) → giọng "Mai" trong Đội AI vẫn là `marin` / giọng ElevenLabs.

**BH11 xong khi:** `npm test` đạt; bản xem thử: Màn hình người dẫn chế độ sân khấu (chủ dự án duyệt cỡ chữ ở 2 m), bảng huấn luyện có cảnh báo,
chạm bình luận ra câu, Mai đổi thẻ trong lúc nói (miệng giả); các phép thử thật trong ngân sách; tag `bh11-mai-thong-minh`.

---

## 7. BH12 — F-117 Kịch bản buổi sau

- `server/nghiep-vu/tong-ket-phien.js`: hàm mới `bangDoan(phienId)` — mỗi đoạn: món, giây bắt đầu – kết thúc (mốc F-103), người xem đầu / cuối
  đoạn (từ `so_lieu_phut`), người chốt, câu hỏi; đánh dấu **ra đơn** (chốt ≥ trung bình buổi) và **người xem bỏ đi** (tụt ≥ 20% trong đoạn).
- Tổng kết buổi: bảng đoạn + nút **"✨ Mai đề xuất kịch bản buổi sau"** → agent `soan_kich_ban` có sẵn nhận số liệu gộp (không tên, không số
  điện thoại) + món sẽ bán → nháp thứ tự món, thời lượng, chỗ đổi lời mở; mọi con số phải có trong đầu vào (luật như `tong_ket`, mã bỏ gợi ý có
  số lạ). Người sửa → lưu thành kịch bản → buổi sau chọn ở ô kịch bản. Chỉ khi buổi có ≥ 10 phút số liệu.
- **Test:** số liệu đoạn khớp đếm; AI giả nêu số lạ → bỏ; dữ liệu gửi AI không có tên, số. **Xong khi:** bản xem thử chạy buổi tập → Tổng kết →
  nháp → lưu → chọn ở buổi tập kế; tag `bh12-kich-ban-buoi-sau`.

---

## 8. BH13 — Zalo cá nhân — **HOÃN (#153)**, giữ để tham khảo; khi làm lại không qua mozaai.vn

### 8.1 Hạ tầng
- **Tách cổng khỏi Facebook (M7):** `server/cong-ngoai.js` (mới) mở cổng 5174 (bản xem thử 5191) và đường hầm khi **có Facebook hoặc có Zalo**;
  `facebook/webhook.js:34 moCongWebhook` chuyển thành một đường gắn vào cổng chung; đường ảnh `#97` giữ nguyên.
- **Đường hầm (theo Q1):** A → `cloudflared tunnel run --token-file data/cloudflared.token` (chủ dự án dán token ở Cài đặt → Zalo), địa chỉ cố
  định `https://mcp.<tên-miền>/mcp`; B → Quick Tunnel như hiện nay, màn Cài đặt hiện địa chỉ mới + nút chép mỗi lần mở. Kiểm `cloudflared` ≥
  2026.10.5 (máy chủ dự án tự cài / cập nhật).

### 8.2 F-128 Cổng MCP cho khách
- Gói `@modelcontextprotocol/server` 2.4.0 + `@modelcontextprotocol/node` 2.1.2 (Q5; dự án CommonJS → nạp bằng `require` của mô-đun ES, Node 26
  hỗ trợ — kiểm khi cài). `server/mcp/may-chu.js`: `createMcpHandler(() => { const s = new McpServer({name:'moza-shop', version}); …
  s.registerTool(...); return s; })` → `toNodeHandler` gắn vào `POST /mcp` của cổng chung.
- **Trước khi chuyển vào handler:** kiểm `Authorization: Bearer <khóa>` (so với băm khóa lưu ở cài đặt, khóa tạo / thu hồi ở Cài đặt → Zalo),
  giới hạn 60 lần / phút / khóa, chỉ `POST`, kích thước thân ≤ 64 KB; sai → 401 / 429 / 405. Ghi nhật ký gọi (công cụ, lúc, kết quả, không ghi
  số điện thoại đầy đủ).
- **Công cụ (chỉ cho khách):**
  | Công cụ | Vào | Ra | Dùng mã có sẵn |
  | --- | --- | --- | --- |
  | `tim_mon` | `chu` (tên, số món, mô tả) | ≤ 5 món: số, tên, ảnh, **câu giá soạn sẵn** | tìm sản phẩm Đang bán |
  | `xem_mon` | `so` | thông số, màu × cỡ còn bán được, **câu giá + câu còn hàng soạn sẵn** | `san-pham.theChoAi`, `gia-ban.giaBanLucNay`, kho |
  | `tu_van_size` | `so`, `cao_cm`, `nang_kg` | câu tư vấn soạn sẵn | `tu-van-size.js` (bằng mã) |
  | `chinh_sach` | `chu_de` (đổi trả, giao hàng, thanh toán) | đoạn Sổ tay | `so-tay.js` |
  | `giu_hang` | `mon[] {so, mau, co, so_luong}`, `ten`, `so_dien_thoai`, `dia_chi?`, `zalo_ten?` | mã đơn, **câu tổng tiền soạn sẵn**, giữ tới | `don.taoDon` (giữ hàng một giao dịch), `nguon='tin_nhan'` + cột mới `kenh='zalo'` (M10) |
  | `ma_qr` | `ma_don` + `so_dien_thoai` (phải khớp đơn) | đường ảnh QR + câu chuyển khoản | `vietqr.js` |
- Câu soạn sẵn qua Bộ kiểm tra như câu Messenger. Hết hàng / sai phân loại / thiếu thông tin → lỗi có câu gợi ý hỏi lại. **Không có** công cụ xác
  nhận / hủy đơn, đọc khách khác, đơn khác, báo cáo, cài đặt.
- `server/discover` do SDK lo; thử bằng máy khách MCP giả trong test.

### 8.3 F-129 Kênh Zalo trong MOZA
- **Cài đặt → Zalo:** tạo / thu hồi khóa; ô token Cloudflare (A) hoặc địa chỉ hiện tại (B); nút **"Chép cấu hình cho Hermes"** → đoạn
  `config.yaml` (`mcp_servers.moza_shop.url`, `headers.Authorization`, `tools.include`) + nút **"Tải skill"** → `SKILL.md` (xưng hô theo cài đặt;
  luật: giá / còn hàng / tổng tiền **đọc nguyên văn** câu công cụ trả; không hứa giảm giá; không nhắn hàng loạt, chỉ trả lời người nhắn tới; khách
  muốn gặp người → hẹn shop; công cụ không trả lời → "Shop đang bận, lát shop nhắn lại ạ"); trạng thái lần gọi gần nhất, số lần gọi hôm nay.
- **Đơn Zalo:** nhãn nguồn **Zalo** ở Đơn hàng; luôn "Chờ xác nhận", **chủ shop bấm xác nhận**; Hôm nay đếm "đơn Zalo chờ bạn".
- **Hộp thư:** MOZA không thấy toàn bộ tin Zalo (tin nằm ở Hermes) — chỉ hiện **dòng hoạt động** theo khách (đã hỏi món nào, đã giữ đơn nào). Sửa
  `SPEC.md` F-129 cho đúng điều này.
- **Khách:** nhận theo số điện thoại; trùng khách Facebook → gợi ý gộp, người bấm.
- Bảng "AI & kênh" có dòng **Zalo** (Bật / Tắt = khóa còn hiệu lực); bảng Sẵn sàng có dòng đường hầm + khóa.
- **Test (0 đồng):** máy khách MCP giả: hỏi món → tư vấn size → giữ hàng → đơn Chờ xác nhận hiện ở MOZA; không khóa / sai khóa → 401; gọi đường khác
  của cổng → 404; 20 lần giữ hàng song song không bán quá số.
- **Phép thử thật (chủ dự án làm, Claude Code hướng dẫn):** 7 ngày dùng thử mozaai.vn + số Zalo phụ: nối Zalo bằng QR, dán cấu hình + skill, nhắn
  thử 5 câu, giữ 1 đơn rồi hủy. Tiền AI phía mozaai nằm trong gói thử.

---

## 9. Phép thử thật và chi phí (trong ngân sách #145)

| Mốc | Phép thử | Ước tính | Ai làm |
| --- | --- | --- | --- |
| BH10 | Máy đọc OpenAI `gpt-realtime-2.1-mini`: 20 câu (~2 phút tiếng) | ~0,05 USD | Claude Code chạy, chủ dự án nghe 5 câu |
| BH10 | ElevenLabs v4 / v4 Turbo: 20 câu (~1.500 ký tự) | ~0,10 USD (hoặc trong gói miễn phí) | như trên |
| BH11 | F-112 bước 0 (GPT-Live + Decisions, 1 phút) | ~0,05 USD | Claude Code |
| BH11 | F-113 52 khung qua Decisions | < 0,01 USD | Claude Code |
| BH11 | F-114 giọng riêng: tạo (miễn phí) + 30 giây GPT-Live | ~0,03 USD | chủ dự án nghe |
| BH11 | F-115 / F-127 vài lượt thật trong buổi tập | ~0,05 USD | Claude Code |
| BH13 | Zalo qua mozaai.vn | 0 đ (7 ngày thử) | chủ dự án |
| **Cộng** | | **OpenAI ~0,25 USD · ElevenLabs ~0,10 USD** | |

Phép thử chỉ chạy khi chủ dự án đã dán khóa (Cài đặt → Khóa AI; không dán vào chat) và đồng ý lúc đó. Ghi từng lần vào "Sổ chi phí thử AI thật" ở
`SPEC.md` mục 12; cộng dồn chạm 80% ngân sách thì dừng, hỏi.

---

## 10. Sửa `SPEC.md` khi được duyệt (chưa sửa)

1. Mục 6: ghi bảng tra 28/10/2026 (mục 1 bản này); `openai` 7.45.1; gói MCP; `cloudflared` 2026.10.5.
2. F-108: đường Realtime + kiểm chữ chép lại; giọng bỏ `nova` / `fable` / `onyx`; nhà ElevenLabs chọn đường bằng `GET /v1/models`.
3. F-110: phát hiện gián tiếp + ô tích nhớ 7 ngày (Meta không có API).
4. F-112: thêm bước 0 phép thử; giữ `delegation:client`, thêm `triggers`.
5. F-114: chỉ GPT-Live; phép thử tiếng Việt trước.
6. F-118: tận dụng `soHoanCuaKhach`; nhãn từ 1 đơn hoàn; ngưỡng AI giữ 2.
7. F-121: thêm hạn Chờ duyệt 24 giờ (cột `het_han_luc`).
8. F-127: danh sách tông mới `tong-giong.json` (sửa câu "dùng chung danh sách với Đội AI").
9. F-129: Hộp thư chỉ hiện dòng hoạt động Zalo; đơn Zalo dùng cột `kenh`.
10. BH13: tách cổng ngoài khỏi Facebook; đường hầm theo Q1.
11. Thêm "máy đọc giả" vào mục 11 (kiểm thử); số tệp nâng cấp: đánh theo thứ tự lúc làm, bắt đầu 023 (bỏ chỗ ghi "023" / "024" cứng ở F-116 và mốc BH11).
12. Quyết định mới cho Q1 → Q7 (đánh từ #147).

---

## 11. Nguồn (đọc 28/10/2026)

- OpenAI: developers.openai.com/api/docs — /deprecations · /guides/text-to-speech · /models/gpt-realtime-2.1-mini · /guides/realtime-conversations ·
  /guides/voice-latency-cost · /guides/decisions · /guides/decisions-voice · /guides/live-conversations · /guides/voice-websockets?api=live ·
  /guides/live-delegation · /models/gpt-live-1 · /guides/custom-voices · /guides/prompt-caching · /pricing · /changelog; npm `openai` 7.45.1
  (27/10/2026), CHANGELOG github.com/openai/openai-node
- ElevenLabs: elevenlabs.io/docs/overview/models · /docs/changelog (28/9/2026) · /docs/api-reference/text-to-speech/convert (+ with-timestamps) ·
  /docs/api-reference/text-to-dialogue/convert · /ttd-websocket · /voices/voice-library/get-shared · /share · /text-to-voice/design ·
  elevenlabs.io/pricing/api
- Meta: developers.facebook.com/docs/graph-api/changelog (v26.0, 29/7/2026) · documentation/business-messaging/messenger-platform/conversation-routing
- Cloudflare: github.com/cloudflare/cloudflared/releases (2026.10.5, 27/10/2026) · developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel
  (create-remote-tunnel 23/6/2026; run-parameters 17/4/2026; Quick Tunnel 30/9/2026)
- MCP: modelcontextprotocol.io/specification/versioning · /2026-07-28/changelog · /2026-07-28/basic/transports/streamable-http; npm
  `@modelcontextprotocol/server` 2.4.0 (23/10/2026), `@modelcontextprotocol/node` 2.1.2; ts.sdk.modelcontextprotocol.io/v2/serving/http.html,
  /authorization.html
- Hermes Agent: hermes-agent.nousresearch.com/docs/user-guide/features/mcp · /features/skills · /messaging; mozaai.vn/plugin-skill
