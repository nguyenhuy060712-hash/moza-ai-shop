# Nghiên cứu nâng cấp Moza AI Shop — thế giới làm gì, công nghệ mới nhất

*27/10/2026. Chỉ tra cứu và đọc mã, chưa sửa mã. Ba nhóm tra song song (các bên live bán hàng trên thế giới; công nghệ AI mới nhất;
Facebook và luật Việt Nam), mỗi nhóm đọc 50–60 nguồn, ưu tiên trang chính thức của hãng. Chỗ chưa kiểm chứng ghi **[chưa kiểm]**.
Chủ dự án chốt 27/10/2026: **khách hàng là người mua của shop; giữ một shop, một laptop**; ghi báo cáo này rồi lên kế hoạch 3 đợt
(`SPEC.md` 3.10, mốc BH10 → BH12). Phần được duyệt ở **mục 10** — khác mục 7 thì theo mục 10. Chưa code.*

## 1. Tóm tắt

- **MOZA đang đi trước phần mềm Việt.** Pancake, Sapo, Harasocial, KiotViet mới bắt bình luận, lên đơn, trả lời bằng chữ. Chưa thấy
  phần mềm Việt nào có AI dẫn live bằng giọng.
- **Thế giới đang làm 3 việc MOZA còn thiếu:** (1) tự cắt clip từ buổi live thành video ngắn để bán tiếp; (2) bảng "huấn luyện"
  người dẫn ngay trong lúc live; (3) AI soạn sẵn câu trả lời, người dẫn chạm bình luận là có.
- **Một việc gấp:** máy đọc giọng `gpt-4o-mini-tts` mà Đội AI và người dẫn giả đang dùng đã bị OpenAI khai tử 1/10/2026, **tắt hẳn
  6/1/2027**. OpenAI không còn máy đọc kiểu "gửi chữ, nhận tiếng".
- **Công nghệ vừa ra đổi cả phương pháp ở hai chỗ:** OpenAI **Decisions** (GA 22/10/2026) — chọn một mục trong danh sách, nhận ảnh,
  đầu ra miễn phí, nhanh ~10 lần → dùng cho "MOZA nhìn" và cho Mai bật thẻ / đổi cảnh trong lúc nói (GPT-Live nối thẳng Decisions từ
  15/10/2026). **Prompt-to-voice** của GPT-Live (16/10/2026) — tạo giọng riêng cho Mai bằng lời mô tả, miễn phí.
- **Luật mới đã có hiệu lực:** Luật AI 134/2025 + Nghị định 142/2026 (nhãn AI, được thông báo **bằng lời**); Luật TMĐT 122/2025 +
  Nghị định 248/2026 (người livestream xác thực danh tính, giá nói ra phải đúng); ngưỡng thuế hộ kinh doanh 1 tỷ đồng/năm.

## 2. Thế giới làm gì

### Trung Quốc — người ảo dẫn live thành phổ biến, nhưng đang siết

- Đợt 618 (6/2026): doanh số live bằng người ảo trên Taobao, Douyin, JD, PDD, Kuaishou vượt 45,1 tỷ tệ, tăng 186%; hơn 300.000 người
  bán dùng. JD (25/3/2026): hơn 70.000 người bán dùng người dẫn AI, chi phí ~1/10 người thật, miễn phí từ 12/2025.
- Bản sao số của Luo Yonghao (Baidu, 15/6/2025): ~55 triệu tệ, 13 triệu lượt xem trong 6–7 giờ; AI dựa trên kho 13.000 mục kiến thức.
  Lãnh đạo Baidu nói khó nhất bây giờ là **tuân thủ**.
- Kuaishou (quý 1/2026): "tóm tắt điểm nổi bật sản phẩm theo thời gian thực + tự trả lời" trong phòng live; clip AI cắt từ live tăng
  doanh số hơn 300% **[con số lấy từ một bản tóm tắt thứ cấp]**.
- **Luật mới của Trung Quốc (1/2/2026):** lần đầu quản người dẫn AI — phải gắn nhãn rõ, khách xin gặp người thật thì phải có người.
  Sau quy định 15/7/2026, các nền tảng dẹp phòng live chạy vòng lặp không người.
- **Alibaba Cloud (23/10/2026) thông báo đóng cả mảng người ảo**, tắt hẳn 11/2027.

### TikTok Shop

- **Live Highlights + tự đăng** (17/2/2026): máy nhận ra khoảnh khắc tốt trong lúc live, cắt thành clip, người bán duyệt rồi đăng.
  Số nội bộ TikTok Đông Nam Á: clip từ live ra doanh số cao hơn tới 29% so với video ngắn thường **[do bên bán công cụ trích]**.
- Trợ lý mua sắm AI cho người mua + mua một chạm (5/10/2026).
- **Cấm giọng AI trong live ở Mỹ (23/5/2026):** lời nói trong live phải là người thật nói trực tiếp; cấm giọng AI, ghi âm, radio;
  ảnh tĩnh / hình động không được che quá 50% màn hình. Hiện chỉ áp ở Mỹ.

### Shopee, Lazada, công cụ Đông Nam Á

- Shopee 2026: AI cho người mua (tìm bằng ảnh, tóm tắt sản phẩm), chưa thấy AI riêng cho live ở Việt Nam.
- AnyMind **AnyLive**: live người ảo 24/7 nhiều thứ tiếng; Beauty of Joseon Việt Nam (7/2025) chạy kiểu lai — AI giờ vắng, người
  thật giờ cao điểm. Bảng phân tích (25/6/2025): người xem, bình luận, từ khóa, giữ chân, chuyển đổi theo thời gian thực; AI đánh dấu
  đoạn đỉnh, đoạn tụt rồi **viết lại kịch bản buổi sau** từ số liệu.

### Mỹ, châu Âu, Hàn Quốc

- **Meta:** Live Video Ads mở rộng toàn cầu (18/6/2026) — biến buổi live thành quảng cáo; Business Agent / Business AI (3/6/2026; bản
  thử tiếng Việt trên Messenger 8/4/2026) — học từ Product Catalog của Meta, Google Drive, Excel, **không thấy API nối kho riêng**.
  Video live tự xóa sau 30 ngày (từ 19/2/2025).
- **YouTube:** "product drops" (món ẩn trên kệ, mở đúng giờ); Made on YouTube (23/9/2026) công bố lồng tiếng tự động cho live.
- **CommentSold:** đối tác đầu tiên của Meta Live Video Ads; ClipHero AI cắt clip có phụ đề.
- **Bambuser** (9/12/2025): phụ đề AI 41 thứ tiếng cho live. **Firework:** AI tiếp tục trả lời câu hỏi trên video xem lại.
- **Whatnot:** gọi vốn 545 triệu USD (2026) để làm công cụ AI — chưa thấy tính năng AI trong live đã ra.
- **Nghiên cứu "Click-to-Ask"** (WWW 2026, 19/3/2026): trước live chuẩn hóa thông tin sản phẩm; trong live người dẫn chạm câu hỏi của
  khách, AI soạn câu trả lời từ dữ liệu sản phẩm + trí nhớ buổi live. Mới thử ngoài phòng thí nghiệm (nhận đúng câu hỏi 0,91).
- Không thấy công ty khởi nghiệp nào năm 2026 làm đúng kiểu "AI cùng dẫn với người thật" như MOZA.

### Phần mềm Việt cho live Facebook

- **Sapo Chat OmniAI** (17/12/2025): lọc bình luận, chốt đơn từ live, trả lời theo câu mẫu, in bình luận / đơn, thống kê buổi (bình
  luận, bình luận có số điện thoại, đơn, doanh thu dự kiến, khách mua nhiều).
- **Harasocial Live:** nhận cú pháp đơn, nhận ra khách cũ, chia bình luận cho nhân viên, ẩn bình luận rác, **nhắc khách chưa trả tiền
  sau live**.
- **Pancake / Botcake:** đồng bộ catalog vào công cụ live của Meta (giỏ hàng qua Messenger — chỉ đối tác Meta có).
- **KiotViet:** quét bình luận (mã + số lượng + số điện thoại), in tự động, không AI.

### Số liệu tham khảo (do bên bán công cụ đưa)

- Tỷ lệ chuyển đổi live: Firework 9–12% (buổi thường), 20–30% (ra mắt, giờ vàng); TikTok LIVE 5–12%.
- Thị trường Việt Nam 2025 (Metric): Shopee 56%, TikTok Shop 41,3% (tăng từ 29%); nửa đầu 2026 bốn sàn ~11,08 tỷ USD, +44%. Không có
  số thị phần live riêng của Facebook 2025–2026; Facebook mạnh ở cộng đồng và nhắn tin (89% người dùng nhắn doanh nghiệp hằng tuần).

## 3. Công nghệ AI mới nhất (tra 27/10/2026, nguồn chính thức)

### OpenAI — changelog từ 28/9

| Ngày | Gì mới | Liên quan MOZA |
| --- | --- | --- |
| 29/9 | DevDay: `gpt-6.1-sol` (2 / 10 USD), Agents API có computer use | Thêm vào bảng model |
| 1/10 | **Khai tử `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd` — tắt 6/1/2027**; thay bằng `gpt-realtime-2.1-mini` qua Realtime API | **Phải thay máy đọc** |
| 6/10 → 22/10 | **Decisions API** (beta → GA): chọn một mục trong danh sách, nhận ảnh, `gpt-6-luna` 0,10 USD/1 triệu token vào, **đầu ra miễn phí**, nhanh ~10 lần Responses | MOZA nhìn, việc chọn trong danh sách đóng |
| 15/10 | GPT-Live nối thẳng Decisions — app làm việc trong lúc đang nói | Mai bật thẻ / đổi cảnh nhanh hơn |
| 16/10 | **Prompt-to-voice** cho GPT-Live: tạo giọng bằng lời mô tả, miễn phí, tối đa 100 giọng; 9 giọng mới | Giọng riêng của shop |
| 20/10 | Lưu đệm prompt 12 giờ | Rẻ hơn cho lời dặn dài |
| 26/10 | `gpt-6.1-terra` (1 / 5 USD), mạnh nhìn ảnh và computer use | Thêm vào bảng model |

- `gpt-live-1` vẫn 0,05 USD/phút, **vẫn không nhận ảnh, video**; bảng giọng ghi EN/PT/DE/FR/HI/JA/KO, **không ghi tiếng Việt** — phải
  nghe thử. Giọng nhân bản từ ghi âm chỉ cho khách được duyệt.
- `gpt-realtime-2.1` (6/7/2026) và `-mini` nhận ảnh trong phiên giọng; là "đích thay thế" chính thức cho máy đọc cũ.
- Chép lời: `gpt-4o-transcribe`, `whisper-1` khai tử 26/8/2026 (tắt 26/2/2027). **MOZA đã dùng `gpt-live-transcribe` (0,017 USD/phút)
  — không bị ảnh hưởng.** `gpt-transcribe` 0,0045 USD/phút cho cả tệp. Tiếng Việt của bản mới **[chưa kiểm]**.
- `gpt-6-luna` giữ giá 0,10 / 0,50. Không có model video (Sora 2 tắt 24/9/2026).

### Google (khóa Gemini của chủ dự án đang bị chặn — chỉ tham khảo)

- `gemini-3.8-live` GA 15/9: tiếng vào 0,005, ra 0,018 USD/phút, hình 0,002 USD/phút. TTS `gemini-3.8-flash-tts` GA 22/9.
- **Veo 3.1 preview (kể cả Lite) tắt 22/10/2026** trên Gemini API → thay bằng `gemini-omni-1.1-flash` (ảnh → video, ~0,10 USD/giây 720p).
- Gemini Live Avatar: GA 24/9/2026 chỉ trong Gemini Enterprise (Mỹ, châu Âu).

### Anthropic

- `claude-sonnet-5-5` (28/9, 2 / 10), `claude-haiku-5-5` (7/10, từ 0,10 / 0,50), `claude-opus-5-5` (22/9, 4 / 20), `claude-fable-5-1`.
  SDK lên bản lớn 21/10. Ghi chép `claude-sonnet-5` trong `SPEC.md` mục 6 đã cũ.

### ElevenLabs

- `eleven_v4` và `eleven_v4_turbo` (28/9/2026): **có tiếng Việt**; v4 ~0,08 USD, v4 Turbo ~0,04 USD mỗi 1.000 ký tự (~100 ms); đọc
  hội thoại nhiều giọng trong một lần gọi; nhân bản giọng.
- **Eleven Realtime** (19/10/2026, đang mở dần): 0,08 USD/phút + phí model chữ, 90+ thứ tiếng có tiếng Việt. Nhận ảnh, giọng nhân bản
  **[chưa kiểm]**.
- `scribe_v2_realtime` chép lời có tiếng Việt, 0,39 USD/giờ.
- Hume, Cartesia: chưa thấy bản có tiếng Việt. Viettel AI, FPT.AI: chưa thấy bản mới 2026.

### Người ảo trên sóng

- HeyGen LiveAvatar: chế độ LITE ~0,10 USD/phút, có nối sẵn OpenAI Realtime (không ghi GPT-Live); khớp môi tiếng Việt **[chưa kiểm]**.
  Tavus ~0,26–0,35 USD/phút **[nguồn thứ ba]**. Synthesia chỉ Enterprise. OpenAI không có avatar.

### Video từ ảnh, cắt clip

- Omni Flash (Google), Kling 3.0 (~0,075–0,10 USD/giây qua bên bán lại), Seedance 2.0 **[chưa kiểm giá]**. OpusClip có máy chủ MCP
  (gói Pro); API cho live còn thử sớm.
- **Cắt clip từ bản ghi của chính mình bằng ffmpeg (đã có trên máy) là đủ** — chọn đoạn bằng số liệu MOZA đã có (mốc từng món, đỉnh
  bình luận chốt, chữ chép lời), gần như 0 đồng.

### Chuẩn Agent, bán trong trợ lý AI

- MCP bản đặc tả `2026-07-28` (bỏ bắt tay initialize, thêm `server/discover`, khung extension).
- Bán ngay trong ChatGPT (ACP / Instant Checkout) và Google UCP: chỉ đối tác được duyệt, chủ yếu ở Mỹ, cần cổng thanh toán riêng →
  **chưa khả thi** cho shop Việt.

## 4. Facebook (tra 27/10/2026)

- **Graph API:** mới nhất vẫn **v26.0** (29/7/2026), chưa có v27; v21 ngừng 21/1/2027. Hôm nay (27/10/2026) Meta gỡ hẳn 47 điểm gọi
  "Commerce Order Management" và các kiểu gọi cũ `pretty`, `debug`, `date_format`, `GET /?ids=`, ETag. **Đã rà mã MOZA: không dùng.**
- **Live Video API:** app tạo được buổi live cho Page (`POST /{page}/live_videos`, nhận `secure_stream_url`), cần quyền
  `publish_video` + xét duyệt + xác minh doanh nghiệp. Tài liệu khuyến nghị 16:9 — **live dọc 9:16 qua API không được đảm bảo** (live dọc
  bằng app Facebook trên điện thoại vẫn bình thường). Có API bình chọn, đọc bình luận, chia sẻ chéo, lên lịch. **Không có API ghim bình
  luận, gắn sản phẩm, giỏ hàng** (chỉ đối tác Meta).
- **Nhắn riêng từ bình luận:** 1 tin trong 7 ngày; tài liệu chỉ nói "bình luận trên bài viết", không nói live **[thử ở Bước 0]**. Chỉ có
  quyền thường thì tin chỉ tới được người có vai trò trong app — **phải có quyền nâng cao `pages_messaging`** (xét duyệt + xác minh doanh
  nghiệp, ~10–13 ngày mỗi việc theo diễn đàn, nên dự trù 2–4 tuần).
- **Messenger 2026:** mẫu Utility có tham số có tên (6/3); Calling API mở cho mọi người (11/2); Page Integrity webhook (30/1 — MOZA đã
  có ở F-73); chia sẻ bài / Reel vào tin nhắn có trong webhook (26/3). Marketing Messages ở Việt Nam chỉ qua Tech Provider.
- **Meta Business AI** (bản thử tiếng Việt 8/4/2026): nếu bật cùng MOZA, hai bên tranh trả lời khách → phải đặt MOZA làm ứng dụng mặc
  định (Handover Protocol). Không nối được kho, đơn của MOZA → **giữ Tư vấn viên của MOZA**.
- Dịch, lồng tiếng Reels bằng AI: tiếng Việt "sắp có" (4/6/2026), chưa xác nhận đã ra.

## 5. Luật Việt Nam (nguồn báo chí, trang luật thứ cấp; văn bản gốc chưa đọc được nguyên văn)

- **Luật TMĐT 122/2025/QH15** (hiệu lực 1/7/2026) + **Nghị định 248/2026/NĐ-CP** (30/6/2026): người livestream cung cấp thông tin xác
  thực danh tính; không thông tin gian dối về công dụng, xuất xứ, chất lượng, **giá, khuyến mại**; người bán đưa giấy tờ chất lượng cho
  người livestream trước live. Thời hạn lưu giữ thông tin giao dịch **[số lấy từ bản dự thảo, chưa đối chiếu luật cuối]**.
- **Luật AI 134/2025/QH15** (hiệu lực 1/3/2026) Điều 11 + **Nghị định 142/2026/NĐ-CP** (hiệu lực 1/5/2026) Điều 18: giọng, hình mô
  phỏng người phải có nhãn dễ nhận biết, hiện **trước hoặc ngay khi** khán giả tiếp xúc; nhãn đặt trên nội dung, tiêu đề, mô tả **hoặc
  bằng lời thông báo**. Mức phạt **[chưa tìm thấy]**.
- **Luật Quảng cáo sửa đổi 75/2025/QH15** (1/1/2026) + Nghị định 342/2025: người livestream là "người chuyển tải sản phẩm quảng cáo",
  phải kiểm chứng sản phẩm.
- **Dữ liệu cá nhân:** Luật 91/2025 (1/1/2026) + Nghị định 356/2025 — hộ kinh doanh, doanh nghiệp siêu nhỏ được miễn hồ sơ đánh giá tác
  động trừ khi xử lý dữ liệu nhạy cảm hoặc lượng lớn; lộ dữ liệu phải báo trong 72 giờ.
- **Thuế:** Nghị định 141/2026 (29/4/2026) nâng ngưỡng không chịu thuế của hộ kinh doanh lên **1 tỷ đồng/năm** từ 1/1/2026; từ 1 tỷ trở
  lên bán lẻ trực tiếp phải dùng hóa đơn điện tử từ máy tính tiền; bán qua Facebook tự kê khai.
- Giá gạch: không thấy quy định riêng, chỉ có cấm thông tin gây nhầm lẫn về giá (Điều 24 Luật 122).

## 6. Đối chiếu với MOZA

| Thế giới làm | MOZA hiện có | Còn thiếu |
| --- | --- | --- |
| Nhãn AI (Trung Quốc, Luật AI VN) | Nhãn chữ trên hình (F-75), thẻ Messenger, câu mô tả buổi live; Đội AI tự nhận khi người mới vào | **Mai** (Chỉ gợi ý / Nói cùng / Dẫn chính) chưa có câu tự nhận bằng lời theo nhịp |
| Gặp người thật khi khách xin (Trung Quốc) | "gặp người" → Cần người | — |
| Thống kê buổi live (Sapo, AnyLive) | Dòng số liệu F-85, một gợi ý nhịp | Số theo từng phút, cảnh báo câu hỏi chưa ai trả lời, người xem tụt |
| Chạm để trả lời (Click-to-Ask) | Mai gợi ý tự động ở chế độ Chỉ gợi ý | Người dẫn chủ động chạm một bình luận để có câu soạn sẵn |
| Clip từ live (TikTok, Kuaishou, CommentSold) | Mốc từng món + đoạn 45 giây không tên khách (F-103) — "MOZA không cắt, không đăng" | Ghi hình, cắt, phụ đề, duyệt, đăng Reels |
| Lưu live (Facebook xóa sau 30 ngày) | Nhắc "hoãn xóa 6 tháng" | Bản ghi trên máy |
| Kịch bản buổi sau từ số liệu (AnyLive) | Tổng kết sau live ≤ 3 gợi ý (F-102) | Đoạn giữ / mất người xem → thứ tự món buổi sau |
| Nhắc khách chưa trả tiền (Harasocial) | Nhắc đơn chưa xác nhận, QR chuyển khoản, "Đã nhận tiền" | — |
| AI trả lời trên video xem lại (Firework) | Bình luận video xem lại ≤ 7 ngày (F-94) | — |
| Đẩy live bằng quảng cáo (Meta) | — | Gợi ý buổi nào nên đẩy (người tự bấm) |

## 7. Đề xuất — 3 đợt

### Đợt 1 — "Sẵn sàng live thật" (đề xuất ban đầu — phần duyệt ở mục 10)

1. **Thay máy đọc giọng** trước 6/1/2027. Khuyến nghị **ElevenLabs `eleven_v4_turbo`** (câu chen, nhanh) và `eleven_v4` (hội thoại nhiều
   giọng của Đội AI): có tiếng Việt, gọi bằng `fetch`, không thêm thư viện. Cách khác: `gpt-realtime-2.1-mini` qua phiên Realtime —
   cùng hãng nhưng phức tạp hơn (mở phiên giọng cho mỗi câu đọc). Cần chủ dự án tạo tài khoản, dán khóa ở Cài đặt.
2. **Mai tự nhận là trợ lý AI bằng lời** (Nghị định 142/2026 Điều 18): câu mẫu do máy soạn khi mở buổi, rồi định kỳ — cả ở ba chế độ
   có Mai, không chỉ Đội AI.
3. **Ghi hình mỗi buổi live về máy** (OBS ghi theo lệnh MOZA, lưu ổ D vì ổ C gần đầy) — giữ bằng chứng (Luật TMĐT), nguyên liệu cho clip.
4. **Bảng Sẵn sàng lên sóng** thêm: máy đọc giọng sắp tắt, khóa ElevenLabs, chỗ trống ổ ghi hình, nhắc tắt Meta Business AI / đặt MOZA làm
   ứng dụng mặc định.
5. **Bảng model, giá, ngày tắt model:** thêm `gpt-6.1-sol`, `gpt-6.1-terra`, `claude-sonnet-5-5`, `claude-haiku-5-5`; máy tự báo khi model
   đang dùng sắp tắt.
6. **Việc của chủ dự án** (không phải code): Bước 0 Facebook thật, xác minh doanh nghiệp, xin quyền nâng cao — nộp sớm vì mất 2–4 tuần.

### Đợt 2 — "Mai thông minh hơn, rẻ hơn"

1. **Mai làm việc trong lúc nói** — GPT-Live gọi Decisions: bật thẻ sản phẩm, đổi cảnh, tra còn hàng, chỉ chọn trong danh sách đóng.
2. **MOZA nhìn bằng Decisions** — ảnh camera + danh sách món → "món số 12"; đầu ra miễn phí, nhanh hơn. Giữ "chỉ gợi ý, người bấm".
3. **Giọng riêng của shop cho Mai** — prompt-to-voice; nghe thử tiếng Việt trước, không đạt thì không làm.
4. **Chạm để trả lời** — người dẫn chạm một bình luận, AI soạn một câu từ dữ liệu shop, qua Bộ kiểm tra.
5. **Bảng huấn luyện trực tiếp** — số theo phút; cảnh báo bằng mã: câu hỏi chưa ai trả lời, lâu chưa nhắc giá / cách chốt, người xem
   tụt; tối đa một cảnh báo mỗi 2 phút; 0 đồng.

### Đợt 3 — "Bán tiếp sau khi tắt live"

1. **Clip Reels tự động** — từ bản ghi + mốc từng món + đỉnh bình luận chốt; cắt dọc, phụ đề từ chữ chép lời, chỉ đoạn không có tên
   khách, nhãn "Có giọng trợ lý AI"; chủ shop duyệt, **bấm mới đăng**.
2. **Kịch bản buổi sau từ số liệu** — đoạn giữ / mất người xem, món chạy / nguội → nháp thứ tự món và kịch bản, người duyệt.
3. **Gợi ý đẩy live bằng quảng cáo** — buổi có tỷ lệ chốt cao thì gợi ý "nên đẩy" kèm hướng dẫn; MOZA không chạy quảng cáo.
4. **Mốc thuế 1 tỷ/năm** — Báo cáo hiện doanh thu năm so với mốc, báo khi tới 80%.

### Không làm (và vì sao)

| Việc | Vì sao |
| --- | --- |
| Bán phần mềm cho nhiều shop, chạy đám mây, làm Tech Provider của Meta | Chủ dự án chốt 27/10/2026: một shop, một laptop |
| Người ảo dẫn thay người thật | Ngoài phạm vi (P37, P40, P41); luật nhãn AI; TikTok cấm giọng AI ở Mỹ; Alibaba đóng mảng người ảo |
| Mai hiện hình (HeyGen LiveAvatar) | Để sau — chưa kiểm khớp môi tiếng Việt, không nối GPT-Live |
| TikTok Shop, phát nhiều nền tảng cùng lúc | Để sau (F-61) — TikTok Mỹ đã cấm giọng AI trong live; nếu làm, Mai chỉ ở chế độ gợi ý chữ |
| Bán trong ChatGPT / Gemini | Chỉ đối tác ở Mỹ, cần cổng thanh toán |
| Giỏ hàng, ghim sản phẩm trong live Facebook | Chỉ đối tác Meta |
| Meta Business AI thay Tư vấn viên | Không đọc được kho, đơn của MOZA |
| Video quảng cáo AI từ ảnh (Omni Flash, Kling) | Cần khóa Google (đang bị chặn) hoặc dịch vụ mới; người thật mặc thử vẫn hiệu quả hơn (docs/06) |

## 8. Chưa kiểm chứng — kiểm khi làm

- Bình luận live có về webhook `feed` và nhắn riêng được không (Bước 0).
- GPT-Live nói tiếng Việt tự nhiên đến đâu; prompt-to-voice với tiếng Việt.
- ElevenLabs v4 đọc tiếng Việt (số tiền, cỡ áo, tên món) — nghe thử.
- Decisions có giữ được độ đúng của "MOZA nhìn" (phép thử 52 khung).
- Đăng Reels lên Page qua API (quyền, điểm gọi) — tra lúc làm BH12.
- Thời hạn lưu giữ theo Luật TMĐT bản cuối; mức phạt thiếu nhãn AI; định danh người livestream trên Facebook — luật sư (#127).

## 9. Nguồn chính

- OpenAI: developers.openai.com/api/docs/changelog · /deprecations · /guides/decisions · /guides/custom-voices · /models/gpt-live-1
- Google: ai.google.dev/gemini-api/docs/video · /pricing
- Anthropic: platform.claude.com/docs/en/about-claude/models/overview
- ElevenLabs: elevenlabs.io/docs/changelog · /docs/models · /pricing/api
- HeyGen LiveAvatar: docs.liveavatar.com/docs/credits-and-subscriptions
- MCP: modelcontextprotocol.io/docs/learn/versioning
- Meta: developers.facebook.com/docs/graph-api/changelog · blog v26 (29/7/2026) · /docs/messenger-platform/changelog ·
  /docs/messenger-platform/discovery/private-replies · /documentation/live-video-api
- TikTok: socialmediatoday.com (17/2/2026, công cụ người bán) · ppc.land (23/5/2026, cấm giọng AI) · techcrunch.com (5/10/2026)
- Trung Quốc: 36kr (23/10/2026, Alibaba đóng người ảo) · yicaiglobal.com (25/3/2026 JD; luật live 1/2/2026) · technode.com (17/6/2025)
- AnyMind: anymindgroup.com/news/press-release/anylive-data-analysis/ · Click-to-Ask: arxiv.org/abs/2603.18649
- Việt Nam: sapo.vn (cập nhật OmniAI 17/12/2025) · moj.gov.vn (livestream xác thực danh tính) · lsvn.vn (14/1/2026; 12/5/2026 nhãn AI)
  · vov.vn (4/7/2026, NĐ 248) · tapchicongthuong.vn (NĐ 141/2026) · bizhub.vietnamnews.vn (10/4/2026 Business AI) · e27.co (15/1/2026)

## 10. Chủ dự án duyệt (27/10/2026) → `SPEC.md` 3.10

Trả lời của chủ dự án: "1. Không cần cắt Video · 2. Bảng huấn luyện người dẫn → ok · 3. AI soạn sẵn câu trả lời, người dẫn chỉ cần chạm
vào bình luận → Okie · 4. Vẫn dùng OpenAI, cho thêm Elevenlab → Okie · 5. Facebook chỉ nối vào bình luận · 6. Cập nhật bảng Model ·
Đợt 2. Duyệt · Đợt 3: Duyệt … Kịch bản buổi sau dựng từ số liệu buổi trước". Hỏi lại ba điểm, chủ dự án chọn: Facebook **giữ như hiện
có, không thêm kết nối mới**; máy đọc **OpenAI chính, ElevenLabs thêm**; giữ **Mai tự nhận AI bằng lời** và **dòng kiểm Meta Business
AI**, bỏ ghi hình.

| Mốc | Làm | Không làm |
| --- | --- | --- |
| **BH10 "Sẵn sàng live thật"** | F-108 máy đọc `gpt-realtime-2.1-mini` (OpenAI chính) + ElevenLabs v4 (thêm) · F-109 Mai tự nhận AI bằng lời · F-110 dòng kiểm Meta Business AI · F-111 bảng model, giá, ngày tắt | Ghi hình buổi live; tạo live / đăng bài / quảng cáo qua Facebook |
| **BH11 "Mai thông minh hơn"** | F-112 GPT-Live + Decisions · F-113 MOZA nhìn bằng Decisions · F-114 giọng riêng (prompt-to-voice, thử tiếng Việt trước) · F-115 chạm để trả lời · F-116 bảng huấn luyện người dẫn | — |
| **BH12 "Kịch bản buổi sau"** | F-117 kịch bản buổi sau từ số liệu buổi trước | Cắt clip / Reels; gợi ý đẩy quảng cáo; mốc thuế 1 tỷ |

Quyết định: `SPEC.md` #128 → #137. Ngân sách thử AI thật đợt này (#135) còn chờ chủ dự án duyệt.
