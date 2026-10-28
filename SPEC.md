# Moza AI Shop — Đặc tả kỹ thuật

Phiên bản 3.16 · 28/10/2026 · Trạng thái: **ĐỢT NÂNG CẤP BH10 → BH12 ĐÃ CODE XONG** (BH12 "Kịch bản buổi sau" — 797 test đạt, tag `bh12-kich-ban-buoi-sau`, kết quả ở mục 12; BH13 Zalo hoãn); **BH11 "Mai thông minh hơn" đã code (791 test đạt, tag `bh11-mai-thong-minh` — kết quả ở mục 12; Màn hình người dẫn chế độ sân khấu, bảng huấn luyện, chạm để trả lời, tông giọng, MOZA nhìn + Mai bằng Decisions; giọng riêng làm sẵn, tắt); GD1 "Giao diện gọn và rõ" đã code (768 test đạt, tag `gd1-giao-dien` — kết quả ở mục 12); BH10 "Sẵn sàng live thật" đã code (733 test đạt, tag `bh10-san-sang-live`, chờ duyệt — kết quả
ở mục 12).** BH1 → BH4, #87 → #90 và **cả đợt cải tiến 3.4 đã code: BH5 "Không rơi đơn"
(F-65 → F-78), BH6 "Trên sóng" (F-79 → F-87), BH7 "Khép kín đơn" (F-88 → F-94), BH8 "Trước live và sau mua" (F-95 → F-104), BH9
"Thử nghiệm AI" (F-105 → F-107)** (700 test đạt, tag `bh5-khong-roi-don` … `bh9-thu-nghiem-ai`). **Kế hoạch nâng cấp 3.10 + 3.11: BH10
"Sẵn sàng live thật" → GD1 "Giao diện gọn và rõ" → BH11 "Mai thông minh hơn" → BH12 "Kịch bản buổi sau"** (BH13 "Zalo cá nhân"
**hoãn** — #153) (#128 → #154, F-108 → F-127; nghiên cứu `docs/09`, phương án `docs/10`, **thiết kế chi tiết `docs/11-thiet-ke-chi-tiet-bh10-bh13.md`**). Các phép thử AI thật chờ chủ dự án dán khóa và duyệt chi phí; việc chủ
dự án cần làm ở cuối mục 12

Đây là đặc tả cho phần mềm livestream **bán hàng**, được cải tạo từ MOZA Live OS bản tuyển dụng 2.10 (commit `d523648`,
tag `diem-xuat-phat-ban-hang`). Đặc tả đầy đủ của bản tuyển dụng được chép nguyên ở `docs/05-spec-tuyen-dung-2.10.md`
(gọi tắt là **"SPEC-TD"**). Phần máy móc giữ lại (lõi AI, miệng Live, Đội AI, Facebook, Phòng diễn tập) vẫn theo chi tiết ở
SPEC-TD. Chỗ nào file này ghi khác, **theo file này**. Muốn biết một chi tiết kỹ thuật cũ, tra SPEC-TD theo cùng số mục,
cùng mã tính năng (F-xx) hoặc cùng số quyết định (#xx).

**Đánh số:** quyết định mới đánh tiếp từ **#56**, tính năng mới tiếp từ **F-51**. Tính năng cũ giữ số khi còn dùng, để chú
thích trong mã (ghi F-xx, #xx) vẫn tra được.

Nhật ký sửa:
- 28/10/2026 — Claude — đầu trang, mục 12 (Kết quả BH12, Quyết định khi chủ dự án vắng — BH12, sổ chi phí, "Việc chủ dự án cần làm — sau đợt BH10 → BH12") — **Bản 3.16. Code xong BH12 và cả đợt
  BH10 → BH12** theo `docs/phieu-bh12.md` (797 test, tag `bh12-kich-ban-buoi-sau`; 0 USD; cộng dồn thử thật cả đợt OpenAI 0,092 USD, ElevenLabs 0).
- 28/10/2026 — Claude — đầu trang, mục 3 (tiêu chí F-112 → F-116, F-126, F-127), mục 12 (Kết quả BH11, Quyết định khi chủ dự án vắng — BH11, sổ chi phí, tệp
  nâng cấp 024, việc chủ dự án 4c) — **Bản 3.15. Code xong BH11** theo `docs/phieu-bh11.md` (791 test, tag `bh11-mai-thong-minh`; thử thật OpenAI 0,0473 USD
  trong BH11, cộng dồn đợt 0,0920 / 0,50 USD — xem sổ).
- 28/10/2026 — Claude — đầu trang, mục 8, mục 12 (Kết quả GD1, Quyết định khi chủ dự án vắng — GD1) — **Bản 3.14. Code xong GD1** (768 test, tag `gd1-giao-dien`).
- 28/10/2026 — Claude — đầu trang, mục 12 (Kết quả BH10, Quyết định khi chủ dự án vắng — BH10, sổ chi phí đợt 3.10, việc chủ dự án) — **Bản 3.13. Code xong BH10**
  theo `docs/phieu-bh10.md` (máy đọc giả, F-111, F-108, F-109, F-110, F-118); phép thử thật máy đọc OpenAI 0,045 USD; 733 test đạt.
- 28/10/2026 — Claude — đầu trang, mục 2 (#142 → #144 hoãn, #147 → #154), 3 (điều chỉnh 3.12), 6, 12 (BH13 hoãn) — **Bản 3.12. Duyệt
  thiết kế chi tiết `docs/11`.** Chủ dự án: "Duyệt: Q2, Q3, Q4, Q5, Q6, Q7. Duyệt chi phí, Phần Elevenlab tôi sẽ gửi Key khi hoàn thành.
  Các cái nào chưa có thì làm mô phỏng. Tạm thời chưa làm Zao." (Trước đó chủ dự án hỏi vì sao Zalo lại qua mozaai.vn — Claude đã tự chép
  cách của VIVA, chủ dự án chưa chọn → bỏ.) Bắt đầu code BH10.
- 28/10/2026 — Claude — đầu trang, mục 2 (#135 sửa, #138 → #146), 3 (F-110 sửa, F-118 → F-129, Để sau), 5, 6 (tra 27–28/10), 8 (màn
  hình), 12 (mốc GD1, BH13, việc chủ dự án), 13 — **Bản 3.11. Phương án nâng cấp giao diện + Zalo cá nhân** theo
  `docs/10-phuong-an-giao-dien-zalo-2026-10-28.md` (chấm 13 màn hình bản xem thử, tra các bên chuyên nghiệp, đọc VIVA HCM). Chủ dự án:
  "Duyệt phương án theo các khuyến nghị của bạn cho cả 6 câu. Ghi docs/10 và cập nhật kế hoạch SPEC.md, chưa code"; trước đó: "Zalo cá
  nhân có, Tin nhắn thoại: Không, AI Tổng đài để sau này làm. Phần sao lưu chưa cần", đồng ý phần "không nên". **Chưa code.**
- 27/10/2026 — Claude — đầu trang, mục 2 (#128 → #137), 3 (F-108 → F-117, Để sau), 6 (tra 27/10/2026), 12 (BH10 → BH12, việc chủ
  dự án đợt 3.10), 13 — **Bản 3.10. Kế hoạch đợt nâng cấp 3 đợt** theo nghiên cứu `docs/09-nghien-cuu-nang-cap-2026-10-27.md`
  (thế giới làm gì, công nghệ mới nhất, Facebook và luật Việt Nam — tra 27/10/2026). Chủ dự án: một shop, một laptop; duyệt đợt 1 (máy
  đọc OpenAI chính + ElevenLabs, Mai tự nhận AI bằng lời, dòng kiểm Business AI, bảng model), cả đợt 2, đợt 3 chỉ "kịch bản buổi sau";
  không cắt video, không ghi hình, Facebook giữ như hiện có (#128 → #137). **Chưa code.**
- 28/9/2026 — Claude — đầu trang, mục 3 (tiêu chí F-105 → F-107), 6, 8 (màn hình, mã lỗi), 12, 13, A.6 — **Bản 3.9. Code xong BH9
  "Thử nghiệm AI"** khi chủ dự án vắng: 700 test đạt, bản xem thử chạy trọn đính chính trên sóng (miệng giả), giữ giá có lợi cho
  khách và MOZA nhìn (Camera giả), 0 USD. Phép thử thật chưa chạy (chưa duyệt chi phí, chưa có khóa) — kịch bản sẵn ở
  `scripts/thu-ai/`. Quyết định tự đưa ra: mục 12 "Quyết định khi chủ dự án vắng — BH9".
- 28/9/2026 — Claude — đầu trang, mục 3 (tiêu chí F-95 → F-104), 6, 7 (021), 12 — **Bản 3.8. Code xong BH8 "Trước live và sau mua"**
  khi chủ dự án vắng: 683 test đạt, bản xem thử (Facebook giả, AI giả) chạy tổng kết buổi và trọn luồng ảnh khách mặc thật, 0 USD.
  Thử AI thật BH8 chưa chạy (`.env` chưa có khóa) — kịch bản sẵn ở `scripts/thu-ai-bh8.js` (trần 0,08 USD). Quyết định tự đưa ra:
  mục 12 "Quyết định khi chủ dự án vắng — BH8".
- 28/9/2026 — Claude — đầu trang, mục 3 (tiêu chí F-88 → F-94), 6, 12, A.4 (K12) — **Bản 3.7. Code xong BH7 "Khép kín đơn"** khi chủ
  dự án vắng: 656 test đạt, bản xem thử (Facebook giả, AI giả) chạy trọn luồng chuyển khoản và bán sau live, 0 USD. Lượt thử AI thật
  của BH7 **chưa chạy được: `.env` chưa có khóa OpenAI** — kịch bản sẵn ở `scripts/thu-ai-bh7.js` (trần 0,10 USD). Quyết định tự đưa
  ra: mục 12 "Quyết định khi chủ dự án vắng — BH7".
- 28/9/2026 — Claude — đầu trang, mục 3 (tiêu chí F-79 → F-87), 6, 12, A.7 — **Bản 3.6. Code xong BH6 "Trên sóng"** khi chủ dự án
  vắng: 619 test đạt, bản xem thử (Facebook giả, AI giả) chạy trọn, 0 USD. Quyết định tự đưa ra: mục 12 "Quyết định khi chủ dự án
  vắng — BH6". Nháp giấy đồng ý người mẫu: `docs/mau-dong-y-nguoi-mau.md` (cần luật sư đọc).
- 28/9/2026 — Claude — đầu trang, mục 3 (tiêu chí F-65 → F-78), 6, 12 — **Bản 3.5. Code xong BH5 "Không rơi đơn"** khi chủ dự án
  vắng ("Tiếp tục … triển khai từng mốc lần lượt cho đến khi hoàn thành … chủ động quyết … Ngân sách thử OpenAI dưới 1 USD"):
  597 test đạt, bản xem thử (Facebook giả, AI giả) chạy trọn, 0 USD. Quyết định tự đưa ra và lý do: mục 12 "Quyết định khi chủ
  dự án vắng — BH5". Nháp chính sách quyền riêng tư bán hàng: `docs/chinh-sach-rieng-tu-ban-hang.md` (cần luật sư đọc).
- 27/9/2026 — Claude — mục 2 (#97, #101), 3 (F-68), 5, 9, 12 — Chủ dự án trả lời "1. Đồng ý 2. Đồng ý. Chưa code": mở đường ảnh
  sản phẩm công khai hẹp trên cổng webhook cho thẻ giữ hàng (#97, ngoại lệ luật "ảnh chỉ ở 127.0.0.1", có test chặn mọi ảnh khác);
  trần ngày có live 20 USD (#101). Chưa code.
- 27/9/2026 — Claude — mục 2 (#91 → #127), 3 (F-15 mở rộng, F-65 → F-107, Để sau, Ngoài phạm vi), 4 (Luồng 3), 6, 7, 11, 12
  (BH5 → BH9), 13, A.1, A.4, A.6 — **Bản 3.4. Kế hoạch đợt cải tiến P01–P44** theo báo cáo `docs/06-de-xuat-cai-tien-2026-09-27.md`
  (nghiên cứu 27/9/2026: 7 hướng tra cứu, 41 đề xuất soi qua 4 lăng kính). Chủ dự án: "Duyệt. Lên kế hoạch toàn bộ phần đề xuất.
  Phần Facebook cứ làm, nhưng test thì thêm giả lập. Ngân sách cấp cho OpenAI là dưới 1 USD. Cái nào tận dụng được Claude làm thì
  yêu cầu làm để đỡ tốn chi phí. Chưa code." và "Phần luật sư, chuyên gia chưa làm. Để sau này làm." → làm mọi khuyến nghị của
  báo cáo (6.1 B tắt mặc định, 6.2 A, 6.3 A+B, 6.4 B, 6.5 A; mục 8 theo cột Khuyến nghị; mục 7 không làm), áp các "sửa lại" của 4
  phiếu soi lỗi; 5 mốc BH5 → BH9; Facebook làm luôn, test bằng Facebook giả mới, Bước 0 để lúc có Page; thử AI thật OpenAI < 1 USD
  cả đợt; việc luật sư, chuyên gia gom vào danh sách để sau (#127). Thiết kế chi tiết: `docs/07-gia-lap-facebook.md`,
  `docs/08-thiet-ke-chi-tiet-bh5-bh9.md`. **Chưa code.**
- 26/9/2026 — Claude — mục 2 (#90), 3 (F-59), 6, 7, 8, 12, 14 — **Bản 3.3. Hai nguồn hình lên sóng + Màn hình sản phẩm do Mai điều khiển.** Chủ dự án chọn cách A (OBS trên laptop, màn hình sản phẩm là nguồn trình duyệt — không cần camera thứ hai), "hai chế độ" chuyển cảnh, duyệt trình chiếu ảnh + video tự quay (video AI từ ảnh để giai đoạn 3), thiết bị Android + iPhone. Bỏ dòng "điều khiển camera, hiển thị hình buổi live" khỏi Ngoài phạm vi (MOZA chỉ đổi cảnh OBS, không tự phát live). Tra 26/9/2026: OBS Studio 32.2 (21/7/2026), obs-websocket v5 có sẵn từ OBS 28; Windows 11 "Connected camera" cho Android; DroidCam / Camo cho iPhone. 537 test đạt.
- 26/9/2026 — Claude — mục 2 (#89) — Thẻ đơn hàng có nút "Xác nhận đơn" / "Sửa đơn" trong Messenger (cách A) + mẫu tin Utility "đơn đã gửi" sau 24 giờ. Tra tài liệu Meta 26/9/2026: template nút vẫn hỗ trợ; Utility Templates tạo và gửi qua API (`/{page}/message_templates`, `messaging_type: UTILITY`).
- 26/9/2026 — Claude — mục 2 (#88), 6 — Chủ dự án chọn "làm 1 và 2": buổi tập dùng `gpt-6-luna` cho Tư vấn viên; dự phòng bán thật `gpt-6-luna`; lỗi nhà chính đi dự phòng thay vì nâng lên model đắt.
- 26/9/2026 — Claude — mục 2 (#87), 12 — **Diễn tập trọn quy trình** (#87). Thử bằng AI thật tìm ra và sửa: Tư vấn viên bên Messenger không thấy đoạn trao đổi ở bình luận / nhắn riêng (nay đưa kèm); AI xác nhận đơn theo lời "đồng ý" cũ sau khi khách chốt thêm món (nay phải đọc lại đúng tổng tiền hiện tại, khách đồng ý sau đó — mã `CHUA_DOC_LAI`); **lỗi runtime "nâng model khi lỗi 2 lần" không bao giờ hết hạn** — Gemini quá tải vài giây làm Tư vấn viên chạy GPT-6 Sol mãi (buổi tập sáng của chủ dự án ~1,9 USD, lần thử của Claude ~5,7 USD, vượt ngân sách thử 2 USD) → nay chỉ nâng trong 5 phút kể từ lần lỗi gần nhất, có test.
- 26/9/2026 — Claude — mục 2 (#77), 6, 12, 13 — **Bản 3.2.** Chủ dự án giao làm hết khi vắng ("chủ động quyết", ngân sách thử
  OpenAI dưới 2 USD, được dùng `gpt-6-luna` thay `gpt-6-sol`). Code xong BH1 → BH4; 505 test đạt; thử AI thật hết khoảng
  0,06 USD. Quyết định tự đưa ra và lý do: mục 12 "Quyết định khi chủ dự án vắng". Đổi model chính #77 sang `gpt-6-luna`
  (giá thật `gemini-3.5-flash-lite` là 0,30 / 2,50, đắt hơn Luna). Thêm nâng cấp 013 (mốc sửa món của đơn).
- 26/9/2026 — Claude — mục 0, 2, 3, 5, 6, 7, 8, 12, 13, 14, A.4, A.6, A.7 — **Bản 3.1.** Chủ dự án đặt 4 nguyên tắc luôn áp
  dụng (công nghệ mới nhất, đòn bẩy công nghệ, thiết kế chuẩn Agent, mạnh dạn cải tiến — ghi ở `CLAUDE.md`); Claude tra lại
  ngày 25/9/2026 (OpenAI, Google, Anthropic, Meta, hướng dẫn thiết kế agent, ba miệng Live) và đề xuất 8 cải tiến; chủ dự án
  "Duyệt tất cả", riêng: "phần quản lý sản phẩm phải làm cho đầy đủ thì mới quản lý được, AI mới hiểu và có đủ thông tin".
  → #61 viết lại (sản phẩm đầy đủ theo chuẩn Meta / Shopee / TikTok, AI điền từ ảnh), #75 → #86, F-51 viết lại, F-62 → F-64,
  bảng `bang_size`, gộp công cụ đơn hàng, miệng tự tra tồn, sửa theo Gemini 3.8 Live, cập nhật bảng model.
- 25/9/2026 — Claude — toàn bộ — **Bản 3.0 — Moza AI Shop.** Viết lại cho bán hàng sau khi chủ dự án trả lời 5 câu hỏi
  (bán quần áo trước, Facebook trước rồi TikTok, Shopee, website; khách chốt bằng bình luận, AI xin địa chỉ và tư vấn;
  MOZA quản lý tồn kho và giao hàng cho hàng bán trên Facebook; giữ Mai, Đội AI dẫn, Radio, Tư vấn viên 24/7; một người,
  một laptop), rồi duyệt mọi khuyến nghị của Claude, riêng: giữ tên Mai, phần mềm tên "Moza AI Shop", website để sau, tạm
  dùng chung khóa (đổi ngày 26/9/2026), pháp lý làm mức vừa đủ, chặt hơn khi live thật. #56 → #74, F-51 → F-61, mốc BH1 → BH4.
  Đặc tả tuyển dụng 2.10 chép sang `docs/05-spec-tuyen-dung-2.10.md`.

---

## 0. Tóm tắt

- **Là gì:** phần mềm vận hành livestream **bán hàng** trên Facebook Page cho một shop. Bắt đầu bằng **quần áo** (nhiều
  mẫu, nhiều màu, nhiều cỡ), thiết kế đủ chung để sau bán thêm loại hàng khác. Tên phần mềm: **Moza AI Shop** (gọi tắt MOZA).
- **Cho ai:** một người không rành kỹ thuật, vừa phát live bằng điện thoại vừa điều khiển MOZA trên một laptop Windows.
- **Làm được:**
  - Quản lý **sản phẩm đầy đủ** theo chuẩn chung của Meta, Shopee, TikTok (danh mục, giá, thông số quần áo, bảng size, ảnh,
    màu × cỡ có mã và tồn riêng, cân nặng gói, điểm nổi bật, hỏi đáp riêng, món phối cùng) — **AI nhìn ảnh điền trước**, người
    duyệt; **tồn kho** từng phân loại; Sổ tay shop (đổi trả, giao hàng, thanh toán).
  - Ô **"Nói với Mai"** ở mọi màn hình: làm việc shop bằng lời ("nhập thêm 10 áo 12 đen M", "đơn nào chưa gửi?").
  - **Phòng live** với 4 cách dẫn giữ từ bản tuyển dụng, đổi sang lời bán hàng: Mai chỉ gợi ý · Mai nói cùng người dẫn ·
    Mai dẫn chính · **Đội AI dẫn** (talk show nhiều giọng, và kiểu **Radio** có bài hát AI).
  - **Chốt đơn trên live:** khách bình luận "chốt 12 đen M" → MOZA giữ hàng, Mai đọc tên người vừa chốt trên sóng, AI nhắn
    riêng xin tên, số điện thoại, địa chỉ, báo tổng tiền → **đơn hàng**.
  - **Tư vấn viên AI 24/7** trên Messenger: tư vấn size, chất liệu, phối đồ, phí ship, đổi trả; lên đơn; sửa, hủy đơn theo lời khách.
  - **Đơn hàng và giao hàng:** danh sách đơn cần gửi, in phiếu, xuất file, nhập mã vận đơn; hoàn hàng; trừ và cộng kho tự động.
  - **Báo cáo bán hàng** theo buổi live và theo sản phẩm.
- **Chạy ở đâu:** như bản tuyển dụng — Node.js 26 trên một laptop Windows, giao diện `http://127.0.0.1:5173`, không có máy
  chủ ngoài, không đăng nhập; webhook Facebook qua Cloudflare Quick Tunnel.
- **Điều quan trọng nhất phải đúng:**
  1. **Không câu nào đi ra ngoài có giá, số lượng còn, phí ship, tổng tiền hay chính sách không có trong nguồn** (sản phẩm,
     tồn kho, Sổ tay, đơn hàng của chính khách đó). Câu chữ do code chặn (A.4); tiếng trên sóng của miệng Live chưa so lại
     (như SPEC-TD #30), nên chế độ mặc định vẫn là "Chỉ gợi ý".
  2. **Không bán quá số hàng đang có:** giữ hàng khi khách chốt, trong một giao dịch cơ sở dữ liệu.
- **Làm Facebook trước.** TikTok Shop, Shopee, website làm sau (F-61), tra tài liệu chính thức khi tới lúc làm.

---

## 1. Bài toán và mục tiêu

- **Vấn đề:** shop bán quần áo qua livestream Facebook. Một người phải vừa giới thiệu hàng, vừa đọc hàng trăm bình luận
  chốt, vừa nhắn tin xin địa chỉ, ghi đơn, trừ kho. Hay bị: sót đơn, bán quá số hàng còn, nhầm màu hoặc cỡ, trả lời chậm
  làm khách nguội, không biết buổi live nào ra tiền.
- **Người dùng:** một người, không có chuyên môn lập trình, dẫn live trước điện thoại; laptop chạy MOZA đặt phía sau.
- **Mục tiêu** *(mục tiêu tham khảo, không đo và không chặn mốc cho tới khi phần mềm xong — giữ SPEC-TD #29)*:
  1. 0 câu đi ra ngoài có giá, số còn, phí ship, tổng tiền sai nguồn.
  2. 0 lần bán quá số hàng còn bán được.
  3. Bình luận chốt hợp lệ thành đơn "Chờ xác nhận" trong ≤ 10 giây *(ước tính)*.
  4. 100% đơn hàng truy ngược được về bình luận, hội thoại và buổi live gốc.
  5. Tạo một sản phẩm 3 màu × 4 cỡ kèm tồn kho trong ≤ 2 phút.
- **Không phải mục tiêu (bản này):**
  - Nhiều người dùng, đăng nhập, phân quyền, nhiều cửa hàng.
  - Bán trên TikTok Shop, Shopee, website (để sau, F-61).
  - Cổng thanh toán trực tuyến; tự đối soát chuyển khoản.
  - Nối thẳng hãng vận chuyển (để sau, F-60).
  - Phát live từ MOZA; hiển thị hình buổi live trong MOZA (màn hình trình chiếu để sau, F-59).
  - Kế toán, hóa đơn điện tử, thuế.
- **Hiện trạng:** repo là MOZA Live OS bản tuyển dụng 2.10, chạy tốt, `npm test` 346/346. Toàn bộ nghiệp vụ tuyển dụng
  (tin tuyển dụng, ứng viên, ứng tuyển, lịch phỏng vấn, phễu tuyển dụng) sẽ được thay bằng nghiệp vụ bán hàng. Bản bán
  hàng cũ trước đó (tag `ban-ban-hang-cu`, dữ liệu `data/db.json.ban-hang-cu`: 6 sản phẩm mẫu, 20 kỹ năng dẫn, 4 kịch
  bản, 0 đơn) chỉ để tham khảo cách đặt tên và lời dặn, không khôi phục.

---

## 2. Quyết định đã chốt

**CX** = chủ dự án chốt · **CQ** = Claude đề xuất, chủ dự án duyệt (25/9/2026, "Duyệt theo các lời khuyên trên").

### Quyết định mới cho bán hàng

| # | Vấn đề | Chốt | Hệ quả | Ai chốt |
| --- | --- | --- | --- | --- |
| 56 | Bán gì | **Quần áo trước**, nhiều mẫu, màu, loại, cỡ; sau bán thêm hàng khác | Sản phẩm có tối đa **2 thuộc tính phân loại**, mặc định "Màu" × "Cỡ", đổi tên được (ví dụ "Mùi" × "Dung tích") — dùng được cho hàng khác mà không đổi cấu trúc | CX |
| 57 | Kênh bán | Facebook, TikTok, Shopee, website; **làm Facebook trước**, tận dụng Phòng diễn tập (Facebook giả) | Bản này chỉ nối Facebook. MOZA là nơi giữ **số tồn kho gốc** cho hàng bán trên Facebook. Khi thêm sàn khác phải đồng bộ tồn kho (F-61, mục 13) | CX |
| 58 | Cách cải tạo | **Giữ khung, thay nghiệp vụ**: giữ lõi AI, miệng Live, Đội AI, Radio, Tư vấn viên, Facebook, Phòng diễn tập, mức trần; thay tin tuyển dụng → sản phẩm, ứng viên → khách hàng, ứng tuyển + lịch hẹn → đơn hàng, phễu tuyển dụng → báo cáo bán hàng | Không có chế độ tuyển dụng song song. Bản tuyển dụng dùng riêng ở thư mục khác | CQ |
| 59 | Tên | Phần mềm **"Moza AI Shop"**; trợ lý AI **giữ tên Mai** — mặc định "Mai - Trợ lý bán hàng" của shop | Cài đặt thêm ô **Tên shop** (`{ten_shop}`); `{ten_ai}` vẫn sửa được. Mọi chữ "Bắc Ninh Work", "tuyển dụng", "nhà máy", "ứng viên" trong giao diện, lời dặn, Skill, câu mẫu được thay | CX |
| 60 | Gọi sản phẩm trên live | Bằng **số ngắn kèm tên**: "áo số 12, sơ mi linen". Khách chốt kiểu "chốt 12 đen M" | Mỗi sản phẩm có **số** (số nguyên dương, không trùng). Khác bản tuyển dụng (#46 bỏ): ở bán hàng, số là cách khách gõ nhanh | CQ |
| 61 | Ô của một sản phẩm | **Làm đầy đủ** (chủ dự án 26/9/2026: "phải làm cho đầy đủ thì mới quản lý được, AI mới hiểu và có đủ thông tin"), theo chuẩn chung của catalog Meta, Shopee, TikTok Shop (tra 25/9/2026). 6 nhóm ô ở F-51: cơ bản · giá · thông số theo danh mục · bảng size · phân loại và kho · dành cho AI bán hàng + nội bộ. **Bắt buộc** chỉ: số, tên, danh mục, giá bán, trạng thái, 1 ảnh, bảng phân loại có tồn. **AI nhìn ảnh điền trước** các ô mô tả và thông số (#75), người duyệt | Mâu thuẫn với "ít ô nhập" được giải bằng: AI điền, người chỉ sửa; ô nào chưa duyệt ghi "AI đoán". Thông số theo danh mục nằm trong file cấu hình → bán hàng khác (mỹ phẩm, giày…) chỉ thêm danh mục, không đổi cấu trúc. Tối đa 2 nhóm phân loại (như Shopee). Giá là số nguyên VND. Mọi ô dùng tên gần với chuẩn catalog để sau đồng bộ sàn (F-61) chỉ cần ghép cột | CX (đầy đủ) · CQ (ô cụ thể) |
| 62 | Thanh toán | **Thu tiền khi giao (COD)** mặc định. Khách muốn chuyển khoản: AI gửi thông tin tài khoản ghi trong Sổ tay; người dùng tự đối chiếu và bấm **"Đã nhận tiền"** | Không cổng thanh toán, không tự đọc sao kê. AI không bao giờ nói "shop đã nhận tiền" | CQ |
| 63 | Giao hàng | **Bước 1:** MOZA lập danh sách đơn cần gửi, in phiếu gửi hàng, xuất file; người dùng tự tạo đơn trên trang của hãng vận chuyển và dán mã vận đơn (không bắt buộc). **Sau:** nối thẳng một hãng (F-60) khi chủ dự án chọn hãng | Phí ship tính theo Cài đặt → Bán hàng: **một mức đồng giá** và **miễn phí từ** một giá trị đơn (ô này có thể để trống). Không tính phí theo vùng hay cân nặng ở bản này | CQ |
| 64 | Giữ hàng khi chốt | Chốt → **giữ ngay** số lượng đó (không ai khác chốt được phần đã giữ). Đơn "Chờ xác nhận" giữ tối đa **24 giờ** (sửa được trong Cài đặt); hết hạn mà chưa xác nhận → tự hủy, trả hàng. Đơn đã xác nhận giữ tới khi gửi | Còn bán được = Tồn trong kho − Đang giữ. Bấm "Đã gửi" mới trừ tồn trong kho. Đơn hoàn → người dùng bấm "Đã nhận hàng hoàn" mới cộng lại kho | CQ |
| 65 | Chốt đơn trên live Facebook | Bình luận chốt → giữ hàng → **Mai / Đội AI đọc tên người vừa chốt trên sóng** → AI **nhắn riêng** (1 tin, trong 7 ngày) tóm tắt món đã giữ và xin thông tin giao. **Không trả lời công khai từng bình luận chốt** | Giới hạn trả lời công khai (≤ 60 lần/giờ, cách nhau 20 giây, F-25) không đủ cho buổi live đông; nhắn riêng được 750 lần/giờ mỗi Page. Nhắn riêng không được (`can_reply_privately` = false) → gom tên vào **một** bình luận công khai mỗi 2 phút mời nhắn tin cho Page | CQ |
| 66 | Dữ liệu cũ | **Sao lưu rồi bắt đầu dữ liệu mới.** Giữ: cài đặt model, giọng Mai, giọng đã tạo, nhân vật Đội AI, mức trần, nhạc không lời (chuyển cảnh, đố vui, chúc mừng). Bỏ: tin tuyển dụng, Sổ tay, phiên live, hội thoại, ứng viên, nhật ký AI, tiếng tiết mục, nhạc hiệu có lời và bài hát (lời nói về tuyển dụng) | Sao lưu `data/moza.db` và `data/doi-ai/` sang `data/sao-luu/tuyen-dung-2026-09-25/` trước khi xóa. Lời dặn và Skill mẫu thay bằng bộ bán hàng | CQ |
| 67 | Khóa API | **Tạm dùng chung `.env`** với bản tuyển dụng; chủ dự án đổi sang khóa riêng ngày 26/9/2026. Facebook: **ứng dụng Meta và Page bán hàng riêng**, không dùng lại mã của Page tuyển dụng | Tới lúc đổi khóa: chung tiền và chung hạn mức giọng Google (100 lượt/ngày mỗi máy đọc) với bản tuyển dụng và AI Coaching | CX |
| 68 | Hình trên live | Điện thoại quay người mẫu, giá treo đồ hoặc bàn hàng. **Màn hình trình chiếu** trên laptop (ảnh, giá, còn bao nhiêu, người vừa chốt) để sau (F-59) | Vẫn ngoài phạm vi: phát live từ MOZA, trộn hình | CQ |
| 69 | Thử Facebook thật | **Cổng Facebook thật chạy sớm, song song** với BH1 → BH4, ngay khi chủ dự án có Page bán hàng, ứng dụng Meta và `cloudflared` — không đợi cuối như bản tuyển dụng | Mấu chốt phải biết sớm: nhắn riêng được bình luận **live** không (SPEC-TD mục 13 chưa kiểm chứng) | CQ |
| 70 | Website, TikTok, Shopee | **Để sau** (F-61). Khi làm: tra tài liệu chính thức lúc đó | Không thiết kế trước tính năng riêng cho các sàn; chỉ giữ tồn kho theo phân loại để sau này đồng bộ được | CX |
| 71 | Pháp lý | **Mức vừa đủ để ưu tiên tính năng**; chặt hơn khi live thật với khách lạ. Bản này giữ: AI tự giới thiệu là AI (#52), không bịa công dụng, chất liệu, xuất xứ ngoài mô tả; giá, còn bao nhiêu, phí ship đúng nguồn (Bộ kiểm tra); không tạo khan hiếm giả; không hứa giảm giá, quà, miễn ship ngoài chính sách; không chê hàng nơi khác | Trước live thật: rà Luật Thương mại điện tử 2025 (hiệu lực 1/7/2026), bảo vệ người tiêu dùng, dữ liệu cá nhân (địa chỉ, số điện thoại), nhãn giọng AI — nhờ người có chuyên môn (mục 9, 13) | CX (mức) · CQ (nội dung) |
| 72 | Đọc tên người chốt trên sóng | Chỉ **tên gọi** (chữ cuối của tên Facebook, có "bạn"/"chị" theo câu mẫu) + món đã chốt ("Chị Lan vừa chốt áo số 12 màu đen size M"). Không đọc số điện thoại, địa chỉ, số tiền đơn | Câu mẫu, không cần AI soạn (nhanh, rẻ, không sai). Tối đa 3 tên mỗi lần, mỗi 30 giây một lần | CQ |
| 73 | Khách từng hoàn hàng | Khách có **từ 2 đơn hoàn** trở lên → AI không tự xác nhận đơn mới; tạo việc **"Gọi xác nhận đơn"** cho người dùng | Giảm bom hàng COD. Ngưỡng sửa được trong Cài đặt → Bán hàng | CQ |
| 74 | Radio của shop | Kiểu Radio giữ nguyên cách làm (SPEC-TD #54), đổi nội dung: tên chương trình **"Radio {ten_shop}"**, điểm tin hàng mới, bản tin từng sản phẩm, "Alo {ten_shop}" (hỏi đáp size, ship, đổi trả), góc phối đồ, lời nhắn gửi + bài hát về thời trang và cuộc sống | Bài hát, nhạc hiệu tạo lại (lời cũ nói về việc làm). Không treo thưởng ở đố vui (khuyến mại có quy định riêng) | CQ |

### Quyết định bản 3.1 — công nghệ mới và thiết kế chuẩn Agent (duyệt 26/9/2026, "Duyệt tất cả")

| # | Vấn đề | Chốt | Hệ quả | Ai chốt |
| --- | --- | --- | --- | --- |
| 75 | Tạo sản phẩm từ ảnh | Kéo ảnh vào → AI đọc ảnh (`gemini-3.8-flash`, đọc ảnh có sẵn) điền trước: tên gợi ý, danh mục, thông số (chất liệu nhìn được, kiểu dáng, họa tiết, đối tượng…), màu từ ảnh, mô tả, điểm nổi bật, tên gọi khác; gợi ý bảng Màu × Cỡ. Người gõ giá, tồn, sửa chỗ sai | Ô AI điền mang nhãn **"AI đoán"** tới khi người bấm lưu; AI không đoán giá, không đoán xuất xứ, thương hiệu (chỉ điền nếu đọc được trên nhãn trong ảnh). Khoảng dưới 0,01 USD mỗi sản phẩm *(ước tính)*. F-51 | CQ |
| 76 | Quản lý shop bằng lời | Ô **"Nói với Mai"** ở thanh trên cùng mọi màn hình (gõ hoặc bấm micro). BH1: nhập kho, điều chỉnh tồn, tìm sản phẩm, xem còn hàng; BH3: tìm đơn, xem đơn chưa gửi; BH4: in phiếu đơn cần gửi, doanh số. Việc có ảnh hưởng (nhập kho, đổi trạng thái) → Mai đọc lại và chờ người bấm **"Làm"** | Là bước đầu của "Mai là agent chính" (F-41) cho phần quản lý shop. Màn hình nhập tay vẫn đủ. F-62 | CQ |
| 77 | Bình luận chốt khó hiểu | Mã nhận trước (F-53); câu mã **không chắc** → model rẻ (`gpt-6-luna`, dự phòng `gemini-3.5-flash-lite` — đổi 26/9/2026 theo giá thật) đọc cùng danh sách phân loại, trả phiếu có lược đồ; vẫn không chắc thì hỏi lại khách | Ít phải nhắn hỏi lại; khoảng 0,0001 USD mỗi câu *(ước tính)*. BH3 | CQ |
| 78 | Khách gửi ảnh hỏi "có mẫu này không?" | Tư vấn viên so ảnh khách gửi với ảnh sản phẩm Đang bán (model đọc ảnh; nhiều sản phẩm thì lọc trước theo danh mục, màu), trả lời số + tên mẫu giống nhất hoặc "shop chưa có mẫu này" | Không thêm thư viện; nếu danh mục lớn (> 300 mẫu) cân nhắc Gemini Embedding 2 lúc đó. F-63, BH3 | CQ |
| 79 | Công cụ đơn hàng | Gộp 6 công cụ nhỏ thành **2**: `xem_don` (món, tổng tiền, phí ship, còn hàng, việc còn thiếu) và `cap_nhat_don` (thêm / bớt món, điền thông tin giao, xác nhận, hủy — một tham số `viec`) | Theo hướng dẫn thiết kế công cụ của Anthropic (ít công cụ mạnh hơn nhiều công cụ nhỏ; trả lời bằng lời dễ hiểu thay mã). Luật chặn vẫn trong code. A.6 | CQ |
| 80 | Miệng tự tra tồn | Miệng Live có **2 công cụ đọc**: `xem_san_pham(so)` và `xem_con_hang(so)`. Gemini 3.8 Live gọi chạy nền (mặc định của model, không ngừng nói); GPT Live 1 giao việc kiểu `client` → MOZA trả lời | Số còn luôn đúng lúc hỏi thay vì dữ liệu nạp đầu buổi. Dữ liệu đưa thẳng vẫn giữ (danh sách sản phẩm, giá) để Mai nói trôi. BH2 | CQ |
| 81 | Sửa theo Gemini 3.8 Live | Không dùng "affective dialog" (Google đã bỏ khỏi API); **không gửi `turnComplete: true` khi Mai đang nói** (3.8 Live coi là lệnh cắt ngang) — thêm test; tận dụng cập nhật bối cảnh không kết thúc lượt cho thay đổi tồn | Theo hướng dẫn chuyển lên 3.8 Live của Google (tra 25/9/2026). BH1 | CQ |
| 82 | Mai nhìn sản phẩm qua camera | **Phép thử ngắn ở BH2**: webcam laptop gửi hình thưa (1 khung / 2–3 giây, chỉ khi bật) cho miệng Gemini 3.8 Live; người dẫn giơ áo → Mai nhận ra số sản phẩm, MOZA chuyển đoạn; Mai tả đúng màu, kiểu đang thấy | **Báo chi phí trước khi thử**; đắt hoặc nhận sai nhiều thì bỏ. GPT Live 1 không nhận hình. F-64 | CQ |
| 83 | Gemini 3.8 Live with Live Avatar (Mai có hình động) | **Theo dõi, chưa làm**: ra 24–25/9/2026 nhưng chỉ ở Gemini Enterprise (máy chủ Mỹ / EU, liên hệ bán hàng của Google), avatar riêng phải xin duyệt | Khi mở cho Gemini API thường: đề xuất đổi phương pháp — Mai hiện hình trên live (gộp với F-59) | CQ |
| 84 | Meta Business Agent | **Không dùng**: phần cho lập trình viên chỉ có ở WhatsApp doanh nghiệp lớn; trên Messenger bật trong Business Suite và không gọi được kho, đơn của MOZA; sắp thu phí | Hướng dẫn kết nối Facebook dặn **không bật "AI trả lời" của Meta** trên Page bán hàng (sẽ trả lời chồng MOZA). Khi làm F-61 xem lại (Meta Business Agent nối được Shopee) | CQ |
| 85 | Agent chạy trên máy chủ hãng (Managed Agents của Claude, Gemini; OpenAI Agents SDK) | **Không dùng**, giữ lõi AI tự viết | MOZA chạy trên laptop, phải chặn câu sai giá trước khi gửi, dùng nhiều hãng và đổi hãng khi quá tải; lõi hiện có 346 test | CQ |
| 86 | Model mới (tra 25/9/2026) | Không đổi model mặc định. Ghi thêm: `gpt-6-astra` (mạnh nhất OpenAI, 10 / 50 USD — không dùng mặc định); `claude-fable-5-1` (mạnh nhất Anthropic, 10 / 50 — không dùng mặc định); `claude-sonnet-5` giữ giá 2 / 10; **không dùng `claude-haiku-4-5`** (ngừng sớm nhất 15/10/2026); `gemini-3.5-flash-lite` cho việc phân loại rẻ | Mục 6 | CQ |
| 87 | Diễn tập chạy trọn quy trình bán hàng như thật (duyệt 26/9/2026, "cách 1") | Buổi tập dùng **kho thật**: chốt → giữ hàng, tạo đơn → Tư vấn viên nhắn riêng → **Khách giả** (agent `khach_gia`, `gpt-6-luna`) trả lời theo 9 tính cách (dễ tính, hỏi ship, gửi từng phần, đổi size, mua thêm, chuyển khoản, hay hỏi, hủy, im lặng) → đọc lại đơn → xác nhận. Người xem giả thêm vai nhắn Page hỏi mua, gửi ảnh mẫu (Luồng 4). **Tua thời gian** (2 / 24 giờ) cho dữ liệu diễn tập; **giả lập vận chuyển** (đa số Đã giao, ~15% Hoàn); đơn tập gửi không gõ mã vận đơn thì có mã giả `TAP…`; **báo cáo "Buổi tập"** riêng; **kết thúc buổi tập → trả toàn bộ hàng về kho** (hủy đơn đang giữ, cộng lại hàng đã trừ, ghi lịch sử kho, khóa đơn — nâng cấp 014 `don.tra_kho_luc`) | Tập được mọi khâu bán hàng mà kho thật về đúng như trước. F-15 | CQ |
| 88 | Chi phí AI: dự phòng rẻ, buổi tập dùng model rẻ (chủ dự án chọn "làm 1 và 2", 26/9/2026) | (1) **Phòng diễn tập**: Tư vấn viên dùng `gpt-6-luna` (dự phòng `gemini-3.8-flash`), không nâng lên model đắt — cấu hình `mac-dinh.json` → `dien_tap_model`; buổi tập 30 phút ước 0,3–0,5 USD. (2) **Bán thật**: dự phòng của Tư vấn viên đổi `gpt-6-sol` → `gpt-6-luna` (nâng cấp 015, chỉ khi người dùng chưa tự đổi); Agent có dự phòng thì nhà chính lỗi → đi dự phòng, **không** "nâng lên Claude khi lỗi 2 lần" (A.7 luật 4 nay chỉ áp dụng cho Agent không có dự phòng, và chỉ trong 5 phút). Nâng vì chất lượng (Bộ kiểm tra chặn, khiếu nại, hội thoại dài) giữ nguyên | Tránh lặp sự cố #87 (Gemini quá tải → chạy GPT-6 Sol mãi). A.7, mục 6 | CQ |
| 90 | Hai nguồn hình lên sóng + Màn hình sản phẩm do AI điều khiển (chủ dự án chọn "A", "hai chế độ", duyệt trình chiếu + video tự quay, 26/9/2026) | **OBS Studio trên laptop** ghép hình và phát lên Facebook (khóa luồng từ Live Producer); camera phòng live là điện thoại (Android: Connected camera của Windows 11 / USB; iPhone: DroidCam, Camo). **Màn hình sản phẩm** = trang `/man-hinh-san-pham.html` 1920×1080 mà OBS lấy làm nguồn trình duyệt — không cần camera thứ hai quay màn hình. Mẫu trình bày: giới thiệu, ảnh đúng màu, bảng size (tô dòng hợp chiều cao / cân nặng), chất liệu, phối đồ, tất cả món, video, trình chiếu ảnh (phóng chậm), màn chờ — chỉ dữ liệu thật của sản phẩm Đang bán. **Thanh chữ** `/thanh-chu.html` (nền trong suốt): số, tên, giá, cú pháp chốt, người vừa chốt. MOZA nối OBS qua obs-websocket v5 (chỉ 127.0.0.1, mật khẩu trong `.env` `OBS_MAT_KHAU`), nút "Tạo cảnh Moza" tạo 3 cảnh **Phòng live / Sản phẩm / Cả hai** (Cả hai = camera + màn hình sản phẩm thu nhỏ). **Ai chọn hình:** đổi đoạn kịch bản → thẻ giới thiệu món của đoạn; Director (ô `man_hinh` trong phiếu) theo bình luận; Mai trên sóng gọi công cụ `chieu_man_hinh` (Gemini Live); người dẫn bấm ô / nói "Mai ơi, chiếu bảng size áo 12", "quay lại camera" (hiểu bằng mã, không tốn AI) — người dẫn luôn thắng (AI không đè lựa chọn tay trong 20 giây). **Hai chế độ chuyển cảnh:** người dẫn đang dẫn → AI chỉ **gợi ý** "Chiếu lên sóng?" (bấm hoặc Enter); Mai dẫn chính / Đội AI dẫn → AI **tự chuyển** sang Sản phẩm, 15 giây sau (video 35 giây) tự về Cả hai. Phím 1 / 2 / 3 đổi cảnh bất cứ lúc nào. Chưa nối OBS → chuyển cảnh chỉ mô phỏng, vẫn tập được. Sản phẩm có tối đa 3 video MP4 / WebM (80 MB), gắn màu (nâng cấp 017 `san_pham.video`); video chiếu tắt tiếng | Người thật không show kịp mọi màu, size, chi tiết; màn hình minh họa trực quan, AI điều khiển. Dùng OBS (miễn phí, chuẩn ngành) thay vì tự làm phần mềm phát live. F-59 | CX |
| 89 | Thẻ đơn hàng có nút xác nhận trong Messenger (chủ dự án chọn "cách A, có làm kèm", 26/9/2026) | Đơn Chờ xác nhận đủ tên / số / địa chỉ → MOZA **tự gửi thẻ đơn** (button template của Messenger: món, ship, tổng tiền, người nhận che số; nút "✅ Xác nhận đơn" / "✏️ Sửa đơn") vào hội thoại Messenger còn trong 24 giờ; không gửi trùng phiên bản (`don.the_gui`, nâng cấp 016). Khách bấm Xác nhận → postback → xác nhận **bằng mã** (nguồn "khách tự báo", không tốn AI) và nhắn xác nhận + cảm ơn ngay trong chat; thẻ cũ (đơn đã đổi) không xác nhận nhầm mà gửi thẻ mới; khách từng hoàn ≥ ngưỡng → việc gọi xác nhận (#73). "Sửa đơn" → Tư vấn viên hỏi sửa gì. Khách nhắn chữ "đồng ý" vẫn xác nhận được như cũ. Công cụ mới `gui_the_don`. Buổi tập: khung Messenger giả hiện thẻ, khách giả / người dùng bấm được. **Làm kèm:** mẫu tin **Utility** (Messenger 2026, thay POST_PURCHASE_UPDATE) "đơn đã gửi, mã vận đơn" gửi được sau 24 giờ; nút "Tạo mẫu tin" trong Cài đặt → Facebook gửi Meta duyệt qua API | Khách xác nhận một chạm, không cần trang web, không lộ dữ liệu cá nhân. Cách B (trang web đơn hàng) cần tên miền cố định — để sau | CQ |

### Quyết định bản 3.4 — đợt cải tiến P01–P44 (duyệt 27/9/2026)

Nguồn: báo cáo `docs/06-de-xuat-cai-tien-2026-09-27.md` (mã Pxx là số đề xuất trong báo cáo). Thiết kế chi tiết từng tính
năng: `docs/08-thiet-ke-chi-tiet-bh5-bh9.md`; giả lập Facebook: `docs/07-gia-lap-facebook.md`. Khác nhau thì theo file này.

| # | Vấn đề | Chốt | Hệ quả | Ai chốt |
| --- | --- | --- | --- | --- |
| 91 | Làm gì trong đợt này | Làm mọi khuyến nghị của báo cáo `docs/06` (mục 3–6, mục 8 cột Khuyến nghị); mục 7 "Không nên làm" không làm. 5 mốc BH5 → BH9 (mục 12) | F-65 → F-107. Trước khi live thật với khách lạ vẫn cần: Page đủ điều kiện, ứng dụng Meta đã duyệt, xác thực người livestream, F-75, F-76, khóa AI riêng đã bật trả tiền, trang chính sách quyền riêng tư. Phần luật sư, chuyên gia: #127 | CX |
| 92 | Facebook khi chưa có Page | **Làm luôn, không chờ Bước 0; test bằng Facebook giả.** Facebook giả mới: một "Meta giả" (bộ luật + trạng thái + đồng hồ giả) hai lối vào — `gia.js` cho diễn tập, `fetch` giả chạy chính `that.js` / `graph.js` / `nhip-goi.js`; sự kiện vào qua `tuWebhook`, tin ra qua bộ dựng tin chung; bảng hành vi `hanh-vi-meta.json` ghi nguồn, ngày tra, mức kiểm chứng; điều chưa rõ thì giả lập trường hợp xấu | Sửa SPEC-TD #27 và #69. Bước 0 (buổi thử thật, mục 11) làm khi chủ dự án có Page; khác giả lập thì sửa `that.js` + `gia.js` + bảng hành vi, chạy lại test | CX |
| 93 | Ngân sách thử AI thật | OpenAI **dưới 1 USD cả đợt** (kế hoạch ≤ 0,6); Google tối thiểu (~0,25 USD, ≤ 20 lượt giọng); mặc định AI giả; bản xem thử có cờ `--ai-gia`; mỗi lần thử thật báo trước, có trần | Sổ chi phí thử ở mục 12; cộng dồn OpenAI 0,80 USD thì dừng mọi phép thử OpenAI | CX |
| 94 | Claude Code làm thay | Việc nào Claude Code làm được thì không gọi API trả tiền: câu mẫu, từ khóa, Skill, lời dặn, dữ liệu test, khách giả soạn sẵn, đáp án mẫu cho AI giả, tự lái bản xem thử, tự chấm nhật ký, tra tài liệu, nháp giấy tờ và hướng dẫn (danh sách ở mục 11) | Khách giả mặc định "Soạn sẵn (0 đồng)"; chế độ khách giả AI của #87 chỉ bật khi chọn | CX |
| 95 | Lượt nhắn riêng, nút, đường gửi | Bảng `luot_nhan_rieng` giữ lượt trước Director; một bộ đọc nút; mọi tin do mã soạn đi qua công cụ nội bộ `gui_the_moza` (qua đủ hook) | `gui-the-don.js` không gọi Facebook thẳng nữa; "Dừng mọi thứ" bật → tin vào chờ duyệt thay vì bỏ im | CQ |
| 96 | Giới hạn liên hệ | Hook `gioi_han_lien_he`: mỗi đơn 1 lần gọi tên kiểu nhắc, 2 nhắc, 1 báo hủy; mời chào và chăm sóc 1 tin/ngày/người; chỉ 7h–22h (ngoài khung thì dời); khách xin dừng → ngừng mọi tin chủ động (tin trạng thái đơn thành việc gọi), vẫn trả lời khi khách tự nhắn; Page bị hạn chế → dừng nhắc | Thay luật "1 tin chủ động mỗi ngày" của F-32 | CQ |
| 97 | Luồng 3 — tin riêng đầu | Thẻ giữ hàng **do mã soạn** (0 AI), có câu tự nhận trợ lý AI. Ảnh: `image_url` qua một **đường ảnh công khai hẹp** trên cổng webhook (chỉ ảnh sản phẩm Đang bán, tên băm, chỉ đọc) → ảnh đã tải lên nếu Bước 0 cho thấy thẻ nhận → thẻ chữ có nút | Sửa #65 (câu gom công khai có link m.me), F-53, Luồng 3. Đường ảnh công khai là **ngoại lệ luật mục 5, mục 9** "ảnh chỉ ở 127.0.0.1" — **chủ dự án đồng ý 27/9/2026** | CQ · phần ảnh công khai: CX |
| 98 | Giữ hàng | Hai mức: đơn từ bình luận live chưa bấm, chưa nhắn giữ tới **hết live + 2 giờ** (trần 12 giờ khi đang live); bấm nút hoặc nhắn → giữ đủ `gio_giu` (24). Không dùng giữ ngắn cho buổi thật khi F-70 chưa chạy | Sửa #64; ô mới "Giữ ngắn cho người chưa bấm" | CQ |
| 99 | Nhắc đơn | Tối đa 2 nhắc + 1 báo hủy (có [Đặt lại] trong 24 giờ); ngoài 24 giờ chỉ mẫu Utility mà Meta xếp UTILITY; đơn đủ tên, số, địa chỉ mà hết giờ → "Gọi xác nhận", gia hạn 12 giờ một lần, không ai xử lý thì hủy kèm tin báo; đơn không số + ngoài 24 giờ → "Chưa liên lạc được", không tạo việc gọi | Sửa F-32, SPEC-TD #21 | CQ |
| 100 | Nhắc trên sóng, "ib", m.me | Câu trung tính (không "chưa trả lời / chưa mở"), ≤ 3 tên mỗi lượt, mỗi người 1 lần mỗi buổi, bỏ người xin ẩn tên; nhắc cách chốt theo tình huống; bắt "ib" bằng mã trước Director; link m.me có mã buổi + nút Bắt đầu | Phần 4 của P01 làm luôn theo #92 | CQ |
| 101 | Công tắc chi phí | Vượt trần → **"Dừng AI"** (tắt mọi lần gọi AI tốn tiền; chốt đơn bằng mã vẫn chạy); **"Dừng mọi thứ"** chỉ khi người bấm; cảnh báo từ 80%; ô mới "Trần ngày có live", mặc định 20 USD (chủ dự án đồng ý 27/9/2026; ngày không live giữ 15 USD) | Sửa hành vi "vượt trần tự bật Dừng mọi tự động" (BAN-GIAO) | CQ · mức 20 USD: CX |
| 102 | Page bị khóa nhắn tin | Nhận đúng lỗi 10/1893063, báo đỏ, dừng nhắc, câu gom riêng; danh sách "Nhắn bù" để người quyết, rải dần, trong 7 ngày tính từ lúc bình luận; không gia hạn giữ | — | CQ |
| 103 | Nhãn AI | "Trợ lý AI · Phụ trách: …" luôn hiện góc trên phải Thanh chữ và Màn hình sản phẩm khi AI không tắt, không có nút tắt; MOZA soạn câu mô tả buổi live để chủ shop chép | Luật AI 134/2025 Điều 11; bắt buộc trước live thật | CQ |
| 104 | Giá gạch | Chỉ hiện (màn hình và thẻ AI) khi có đơn Đã giao ở đúng giá gốc trong 30 ngày, không tính diễn tập | Shop mới coi như tắt giá gạch | CQ |
| 105 | Chống giả shop; bình luận của Page | Ẩn bình luận của người không phải Page có số tài khoản hoặc link lạ; thẻ đơn và câu ghim ghi "chỉ nhận tiền vào TK tên …"; bình luận của **chính Page** không bao giờ vào chốt đơn, ẩn bình luận, Director | — | CQ |
| 106 | Trước khi lên sóng | Bảng "Sẵn sàng lên sóng": chỉ dòng đỏ / vàng máy tự kiểm; phép thử "chốt test"; 3 ô tự tích; câu ghim có nút Chép; không khóa nút Bắt đầu | Thay khung "Kiểm tra trước khi live" | CQ |
| 107 | Từ cấm | K11: thương hiệu, tuyệt đối, so sánh luôn chặn; xuất xứ, công dụng chặn trừ khi có nguồn người đã xác nhận; lưu sản phẩm chỉ cảnh báo | A.4 thêm K11 | CQ |
| 108 | Nhật ký buổi live, con số của Mai | Bảng `nhat_ky_song` chỉ chữ, giữ 90 ngày (tạm; chuyên gia xem sau, #127); bình luận không gắn đơn cùng hạn; lời dặn miệng: con số chỉ đọc nguyên văn "câu số" MOZA đưa hoặc kết quả công cụ | Sửa SPEC-TD #33 (lời người dẫn nay được lưu dạng chữ) | CQ |
| 109 | Video dựng thử | Cờ `dung_thu`; buổi thật không chiếu (lùi về trình chiếu ảnh); 14 video hiện có đánh dấu dựng thử | — | CQ |
| 110 | Tư vấn size trên sóng | Tính bằng mã từ bảng size (khớp 1 dòng; 2 dòng liền nhau thì nói cả hai); không đọc số đo của khách; số đo người mẫu bằng lời, nguồn "người mẫu" | Sửa lời dặn Director, Skill "Nhường lời và chuyển việc" | CQ |
| 111 | Bằng chứng xã hội, bình chọn | "N người chốt buổi này" từ 5 người (không nói "đã bán"; trừ hủy; bỏ buổi tập); cảm ơn cuối buổi chỉ tên gọi; bình chọn A/B bằng bình luận, không quà, ≤ 2 lần/buổi | Căn cứ Luật TMĐT Điều 6 (cấm lừa dối) | CQ |
| 112 | Thẻ đơn, chuyển khoản (6.2 A) | [Nhận hàng trả tiền] [Chuyển khoản] [Sửa đơn]; chuyển khoản → ảnh VietQR đúng số tiền, nội dung mã đơn (lỗi thì tin chữ); người tự bấm "Đã nhận tiền"; không lưu gì của người chuyển | Sửa #62, #89 | CQ |
| 113 | Sửa món sau xác nhận | Đơn Đã xác nhận bị đổi món bởi khách, AI hay gộp → về Chờ xác nhận, gửi thẻ mới; người sửa tay giữ nguyên | Sửa bảng chuyển trạng thái mục 7 | CQ |
| 114 | Khách quen, số đo | Nhãn "khách quen" chỉ người dẫn thấy, chỉ từ lịch sử đơn; trên sóng cấm "khách quen", "quay lại"; số đo chỉ lưu khi khách bấm đồng ý (công tắc tắt mặc định) | — | CQ |
| 115 | Giá live (6.1 B) | **Tắt mặc định**, bật sau khi chuyên gia xem (#127); giá live từng món đặt trước live, khóa khi live, áp cho bình luận chốt trong buổi (+ độ trễ phát), chụp vào đơn; người xem lại không hưởng; không "chỉ hôm nay" | Mở một phần mục Ngoài phạm vi "khuyến mại" | CQ |
| 116 | Bán sau live | Nhận bình luận chốt có số món trên video xem lại ≤ 7 ngày (webhook + tự hỏi 10 phút), giá hiện tại; Page đăng bình luận mục lục (không giá, không tên khách) | Đổi bước bỏ bình luận bài live của `hop-thu.js` | CQ |
| 117 | Mời khách cũ (6.3 A+B), lên lịch (6.5 A) | A: bài báo lịch, Sự kiện live, link Zalo, nhắc quảng cáo (chủ shop tự làm); B: xin đồng ý từng buổi, chỉ nhắn trong 24 giờ, lưu nguyên văn; không danh sách lâu dài. MOZA không lên lịch, không bấm phát | "Gửi tin marketing hàng loạt" vẫn ngoài phạm vi; 6.3 C để sau | CQ |
| 118 | Quyền của khách | Gõ DỪNG (#96); menu "Xóa dữ liệu của tôi" và tin xin xóa → báo đã nhận ngay bằng mã, việc "Xóa dữ liệu" hạn 72 giờ (tạm; chuyên gia xem sau); xóa được người chỉ có tài khoản Facebook | Luật 91/2025, NĐ 356/2025 | CQ |
| 119 | "Nói với Mai" ghi Cài đặt, Sổ tay | Agent `quan_ly` thêm `dat_ban_hang`, `ghi_so_tay`, luôn "Hỏi" (bảng xem trước + Làm); con số phải có trong câu người nói | Sửa A.1, A.6 | CQ |
| 120 | Tin sau mua | Tin trạng thái (đã xác nhận, đã gửi) và chăm sóc (hỏi lại trước khi gửi, hỏi thăm sau 4 ngày) do mã soạn, 0 AI; ngoài 24 giờ dùng bộ mẫu Utility (chỉ loại UTILITY); hỏi lại đơn chỉ dùng lịch sử đơn của shop, người quyết, khách không thấy chữ "rủi ro" | Sửa F-32, SPEC-TD #21; tin theo trạng thái hãng để sau | CQ |
| 121 | Vận chuyển (6.4 B) | Xuất file đúng mẫu nhập đơn hàng loạt của hãng đang dùng; nối thẳng hãng (F-60), tin theo trạng thái hãng, chuẩn hóa địa chỉ để sau | — | CQ |
| 122 | Ảnh khách mặc thật | **Tắt mặc định** (bật sau khi chuyên gia xem, #127); chỉ ảnh khách tự gửi, xin phép bằng nút, che mặt mặc định, người duyệt, "gỡ ảnh" bất cứ lúc nào; không gửi ảnh khách cho AI | — | CQ |
| 123 | Kiểm lời Mai (A.5) | Làm ở BH9 bằng chữ chép sẵn (0 đồng): chắc sai → đính chính; 3 lỗi/buổi → về "Chỉ gợi ý"; đơn chốt lúc Mai nói giá thấp hơn → mặc định bán theo giá Mai nói (có nút giữ giá đúng) | Chế độ mặc định vẫn "Chỉ gợi ý" | CQ |
| 124 | MOZA nhìn (thay #82) | Nhìn nguồn camera OBS, so hình bằng mã, chỉ hỏi `gpt-6-luna` khi hình đổi; chỉ gợi ý "Đang cầm áo 7? [Chuyển]", không tự chuyển; không lưu ảnh; tắt mặc định | Bỏ F-64, nút "Cho Mai xem", công cụ `chuyen_san_pham` | CQ |
| 125 | Không làm, để sau | Không làm: P33, P37, P39 (tới khi có chi phí thật), P40, P41, P17 cách B, giờ vàng có đồng hồ, tự gia hạn giữ 48 giờ, tự đổi món theo camera. Để sau có điều kiện mở lại (mục 3 "Để sau") | — | CQ |
| 126 | Quy ước dữ liệu đợt này | Không thêm giá trị vào cột có CHECK; dùng bảng / cột mới; cột "loại" mới không đặt CHECK (kiểm trong mã); mỗi mốc một tệp nâng cấp 018 → 022 | Mục 7 | CQ |
| 127 | Luật sư, chuyên gia | **Để sau** (chủ dự án 27/9/2026: "Phần luật sư, chuyên gia chưa làm. Để sau này làm."). Mọi việc cần luật sư, kế toán, người rành thanh toán gom vào danh sách "Để sau: luật sư, chuyên gia" cuối mục 12; **không chặn mốc nào**. Tính năng nhạy cảm vẫn code nhưng **tắt mặc định** (giá live F-93, số đo khách F-91, ảnh khách F-104); chỗ đang chờ ý kiến chuyên gia giữ cách làm hiện tại (#18) | Vẫn cảnh báo rõ ở từng tính năng; nên làm danh sách này trước khi live thật với khách lạ | CX |

### Quyết định bản 3.10 — đợt nâng cấp BH10 → BH12 (27/10/2026)

Nguồn: `docs/09-nghien-cuu-nang-cap-2026-10-27.md` (mục 7 là đề xuất, mục 10 là phần chủ dự án duyệt). Chủ dự án 27/10/2026: "Khách
hàng là người mua của shop tôi. Giữ một shop, một laptop", rồi duyệt từng mục: "Không cần cắt Video · Bảng huấn luyện người dẫn → ok ·
AI soạn sẵn câu trả lời, người dẫn chỉ cần chạm vào bình luận → Okie · Vẫn dùng OpenAI, cho thêm Elevenlab → Okie · Facebook chỉ nối
vào bình luận · Cập nhật bảng Model · Đợt 2. Duyệt · Đợt 3: … Kịch bản buổi sau dựng từ số liệu buổi trước", và chọn ở ba câu hỏi lại:
Facebook "giữ như hiện có", máy đọc "OpenAI chính, ElevenLabs thêm", giữ "Mai tự nhận AI bằng lời" và "dòng kiểm Meta Business AI".

| # | Vấn đề | Chốt | Hệ quả | Ai chốt |
| --- | --- | --- | --- | --- |
| 128 | Phần mềm cho ai | **Một shop, một laptop**; "khách hàng" là người mua của shop | Không đám mây, không đăng nhập, không làm Tech Provider của Meta → không có Marketing Messages, giỏ hàng / ghim sản phẩm trong live. "Ngoài phạm vi" giữ nguyên | CX |
| 129 | Đợt nâng cấp 3.10 | 3 mốc: **BH10 "Sẵn sàng live thật"** (F-108 → F-111), **BH11 "Mai thông minh hơn"** (F-112 → F-116), **BH12 "Kịch bản buổi sau"** (F-117) | Nâng cấp dữ liệu từ 023; quyết định tiếp từ #138, tính năng từ F-118 | CX |
| 130 | Máy đọc giọng (OpenAI tắt `gpt-4o-mini-tts` ngày 6/1/2027) | **OpenAI vẫn là nhà chính**: chuyển sang `gpt-realtime-2.1-mini` (đích thay thế OpenAI chỉ định) qua phiên Realtime — gửi chữ, nhận tiếng. **Thêm ElevenLabs** (`eleven_v4_turbo` câu chen, `eleven_v4` hội thoại Đội AI) làm lựa chọn ở Cài đặt khi có khóa. Gọi bằng `ws` / `fetch` có sẵn, không thêm thư viện | Máy đọc mới là model hội thoại nên có thể đọc chệch chữ → so chữ chép tiếng ra với câu gốc, lệch số thì bỏ tiếng, hiện chữ. Lỗi / thiếu khóa → hiện chữ, không tự đổi sang máy đắt hơn | CX |
| 131 | Nhãn AI bằng lời | Ở mọi chế độ có giọng AI, máy soạn câu tự nhận "trợ lý AI của {ten_shop}" khi mở buổi và **mỗi 15 phút** (Đội AI đã có câu cho người mới vào — giữ) | Nghị định 142/2026 Điều 18 cho phép nhãn "bằng lời thông báo"; câu mẫu qua K11; chữ cuối do luật sư xem (#127) | CX |
| 132 | Facebook | **Giữ như hiện có** (đọc bình luận, nhắn riêng giữ hàng, Messenger, mẫu Utility); **không thêm kết nối Facebook mới** — không tạo / lên lịch live qua API, không đăng bài hay Reels, không quảng cáo | Bước 0 và xét duyệt quyền nhắn tin vẫn là việc của chủ dự án | CX |
| 133 | OpenAI Decisions | Dùng cho **việc chọn trong danh sách đóng**: Mai gọi việc trong lúc nói (F-112), MOZA nhìn (F-113) | Không dùng để soạn câu gửi khách; lựa chọn vẫn qua mã kiểm như cũ | CX |
| 134 | Không làm đợt này | Cắt clip / đăng Reels; ghi hình buổi live; gợi ý đẩy live bằng quảng cáo; mốc thuế 1 tỷ trong Báo cáo; người ảo / Mai hiện hình; TikTok và phát nhiều nền tảng; bán trong ChatGPT / Gemini; giỏ hàng trong live; Meta Business AI thay Tư vấn viên; video AI từ ảnh | F-103 giữ nguyên "MOZA không cắt, không đăng". Lý do: `docs/09` mục 7, 10 | CX |
| 135 | Ngân sách thử AI thật đợt 3.10 | Đề xuất: OpenAI **≤ 0,50 USD**, ElevenLabs **≤ 1 USD** (hoặc gói miễn phí) cả đợt; mặc định AI giả, giọng giả; báo trước từng phép thử | **Đã duyệt 28/10/2026** — xem #145 (dùng cho cả phương án 3.11) | CX |
| 136 | Model và ngày tắt | `gia-model.json` ghi **ngày tắt** của model; máy báo 30 ngày trước khi model đang dùng tắt; thêm `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-realtime-2.1-mini`, `claude-sonnet-5-5`, `claude-haiku-5-5` | Không để lặp lại chuyện máy đọc sắp tắt mà không ai biết | CX |
| 137 | Meta Business AI | Bảng Sẵn sàng lên sóng có dòng "Trợ lý AI của Facebook đã tắt, MOZA là bên trả lời chính" — máy tự kiểm nếu Graph API cho đọc, không thì người tự đánh dấu kèm hướng dẫn | Tránh hai AI cùng trả lời một khách (Business AI không đọc được kho, đơn của MOZA) | CX |

### Quyết định bản 3.11 — giao diện, học từ VIVA, Zalo cá nhân (duyệt 28/10/2026)

Nguồn: `docs/10-phuong-an-giao-dien-zalo-2026-10-28.md` (mục 7 là 6 câu chủ dự án duyệt theo khuyến nghị).

| # | Vấn đề | Chốt | Hệ quả | Ai chốt |
| --- | --- | --- | --- | --- |
| 138 | Thứ tự và cách làm | **BH10 → GD1 → BH11 → BH12 → BH13**; xong mỗi mốc: `npm test`, ảnh chụp bản xem thử, ghi kết quả, commit + tag, **dừng chờ duyệt** | GD1 trước BH11 để nút mới của BH11 gắn vào khung mới; Zalo cuối vì cần dịch vụ ngoài và tài khoản của chủ dự án | CX |
| 139 | Khách từng hoàn hàng | Làm ở BH10 (F-118): đơn mới của khách từng hoàn gắn nhãn "nên gọi xác nhận / chuyển khoản trước" | Chỉ dữ liệu của chính shop, không chia sẻ shop khác (#125) | CX |
| 140 | Giao diện | Mốc mới **GD1** theo `docs/10` mục 2–5 (F-119 → F-125); Màn hình người dẫn "chế độ sân khấu" ở BH11 (F-126) | Phông Be Vietnam Pro, tông cam đất, nền kem giữ; cỡ chữ Màn hình người dẫn chốt bằng phép thử đứng cách 2 m | CX |
| 141 | Học từ VIVA | 7 điều vào GD1 (Đội AI như nhân viên, chỉ số AI 7 ngày lời thường, chi phí VNĐ, bảng "AI & kênh", bật / tắt từng phần, "Cần xử lý", so sánh bản cũ / mới); tông giọng Mai trên sóng vào BH11 (F-127) | Không làm: tin nhắn thoại, lịch tự phát, nhiều người dùng / ủy quyền duyệt | CX |
| 142 | Zalo cá nhân | Mốc **BH13**: trợ lý trên **mozaai.vn** (Hermes Agent) trả lời khách Zalo cá nhân của shop, tra hàng và giữ hàng qua **cổng MCP của MOZA** (F-128, F-129) | Số Zalo phụ; chỉ trả lời người nhắn tới; đơn Zalo luôn "Chờ xác nhận", chủ shop bấm; laptop tắt thì trợ lý không tra được hàng | CX — **hoãn 28/10/2026 (#153)** |
| 143 | Cổng công khai thứ hai | Đồng ý mở **cổng MCP hẹp** `/mcp` trên cổng webhook, qua **đường hầm Cloudflare có tên** (địa chỉ cố định), khóa Bearer thu hồi được, giới hạn lượt gọi, **chỉ công cụ cho khách** | Ngoại lệ thứ hai của "chỉ ở 127.0.0.1" (sau đường ảnh #97); giao diện MOZA vẫn không ra internet; test chặn mọi đường khác | CX — **hoãn 28/10/2026 (#153)** |
| 144 | Thư viện | Thêm **SDK MCP chính thức cho Node** (bản đặc tả mới nhất — `2026-07-28` lúc tra); tra phiên bản đầu BH13, ghi mục 6 | Ngoại lệ của "không thêm thư viện" | CX — **hoãn 28/10/2026 (#153)** |
| 145 | Ngân sách thử AI thật (3.10 + 3.11) | OpenAI **≤ 0,50 USD**, ElevenLabs **≤ 1 USD**; Zalo dùng 7 ngày thử của mozaai.vn; báo chi phí trước từng phép thử | Thay "chờ duyệt" ở #135 | CX |
| 146 | Không làm / để sau | Không: tin nhắn thoại (F-40 giữ để sau), lịch tự phát, nhiều người dùng, ủy quyền duyệt. Chưa cần: sao lưu tự động. Để sau: **AI tổng đài** (theo khung sổ đồng ý của VIVA, `docs/10` mục 5) | Mục 3 "Để sau / không làm của đợt 3.11" | CX |

### Quyết định bản 3.12 — duyệt thiết kế chi tiết `docs/11` (28/10/2026)

Chi tiết từng tính năng, chỗ sửa trong mã, test, phép thử: `docs/11-thiet-ke-chi-tiet-bh10-bh13.md`. Khác mục 3 thì **theo `docs/11`** (đã
tra lại công nghệ 28/10/2026 và đọc mã thật).

| # | Vấn đề | Chốt | Hệ quả | Ai chốt |
| --- | --- | --- | --- | --- |
| 147 | Nhãn "từng hoàn" (Q2) | Hiện nhãn khi khách có **≥ 1** đơn hoàn; ngưỡng chặn AI tự xác nhận giữ `nguong_hoan: 2` | Tận dụng `don.soHoanCuaKhach`; thêm `so_hoan` vào `khach.tomTatMua` | CX |
| 148 | Kiểm Business AI (Q3) | Meta không có API đọc → **phát hiện gián tiếp** (tin kênh standby, lỗi `10 / 2018300`) + **ô tích tay riêng nhớ 7 ngày** | Facebook giả thêm H25, H26 | CX |
| 149 | Giọng riêng của Mai (Q4) | Prompt-to-voice **chỉ cho Mai trên sóng (GPT-Live)**; phép thử nghe tiếng Việt trước khi code F-114 | Máy đọc Đội AI vẫn dùng giọng có sẵn | CX |
| 150 | Thư viện (Q5) | Nâng `openai` 7.23.0 → **7.45.1** (cần cho Decisions). Gói MCP (#144) **không cài** vì Zalo hoãn | Ghi mục 6 | CX |
| 151 | Phông chữ (Q6) | Be Vietnam Pro + Lora **lưu trong máy** (woff2, giấy phép OFL), bỏ tải từ Google | GD1 | CX |
| 152 | Hạn "Chờ duyệt" (Q7) | Việc máy tự chặn (Dừng mọi thứ, giới hạn tin) **hết hạn sau 24 giờ**, ghi lý do; cột mới `het_han_luc` (không đổi CHECK) | GD1 F-121 | CX |
| 153 | Zalo | **Tạm chưa làm** (BH13 hoãn; #142 → #144, F-128, F-129 không áp dụng). Khi làm lại **không qua mozaai.vn** — cách đáng xét: MOZA nối thẳng Zalo cá nhân trên laptop (thư viện không chính thức, rủi ro khóa tài khoản) hoặc Zalo OA chính thức | Câu Q1 (tên miền) bỏ | CX |
| 154 | Chưa có thì mô phỏng | Phần chưa có khóa / chưa kiểm được làm **bản mô phỏng** để code và test trước: máy đọc giả, phiên Realtime giả, ElevenLabs giả (tới khi chủ dự án dán khóa ở Cài đặt → Khóa AI — **không gửi khóa qua chat**), Decisions giả, tín hiệu Business AI giả | Chi phí thử thật duyệt theo `docs/11` mục 9 (OpenAI ~0,25 USD, ElevenLabs ~0,10 USD, trong #145) | CX |

### Quyết định giữ từ bản tuyển dụng

Chi tiết từng dòng ở SPEC-TD mục 2. "Giữ" nghĩa là vẫn đúng như SPEC-TD, chỉ đổi chữ tuyển dụng sang bán hàng.

| # SPEC-TD | Nội dung | Ở bản bán hàng |
| --- | --- | --- |
| 1, 2, 3, 4 | Một người, không đăng nhập, chỉ `127.0.0.1`; laptop 24/7; Node 26 + Express 5 + JS thuần; SQLite + nút Sao lưu | Giữ |
| 5 | Dữ liệu cũ | **Thay bằng #66** |
| 6 | Website bacninhwork.vn | **Thay bằng #70** |
| 7 | Webhook qua Cloudflare Quick Tunnel, lưới an toàn 60 giây | Giữ |
| 8 | Phát live bằng điện thoại, MOZA tự nhận live, không hiển thị hình | Giữ; hình xem #68 |
| 9 | Thứ tự làm | **Thay bằng kế hoạch mục 12** |
| 10 | Ba Agent Director, Co-host, Tư vấn viên (+ Mai là agent chính, chưa làm) | Giữ |
| 11, 12, 13, 14 | Miệng GPT Live 1 / Gemini 3.8 Live, dữ liệu đưa thẳng; mặc định "Chỉ gợi ý"; người dẫn = người điều khiển; âm thanh qua loa mặc định | Giữ. Dữ liệu đưa thẳng = sản phẩm trong phiên + tồn còn bán được + Sổ tay |
| 15, 16 | Tư vấn viên tự động hoàn toàn, 24/7 | Giữ — thêm việc lên đơn (F-31) |
| 17 | Không loại ứng viên | **Thay bằng bảng chuyển trạng thái đơn** (mục 7) |
| 18 | Dữ liệu khách gửi nguyên văn cho nhà cung cấp AI; cách xin số nằm trong lời dặn | Giữ, thêm **địa chỉ giao hàng** |
| 19 | Ẩn bình luận công khai lộ số điện thoại / CCCD | Giữ — khách hay bình luận số điện thoại khi chốt: ẩn, vẫn ghi nhận chốt, nhắn riêng |
| 20 | Tuân quy định Meta (nhịp gọi, nhắn riêng 1 lần / 7 ngày, bot tự giới thiệu, 30 giây) | Giữ |
| 21 | Nhắc lịch sau 24 giờ chỉ tạo việc gọi điện | **Sửa:** mọi tin chủ động ngoài 24 giờ (nhắc địa chỉ, báo đã gửi) → tạo việc cho người dùng, không nhắn (F-32) |
| 22, 23, 24, 26 | Model, mức suy nghĩ, cách tổ chức AI học từ Claude Code, công nghệ mới nhất | Giữ |
| 25 | Tên AI "Mai - Trợ lý tuyển dụng" | **Thay bằng #59** |
| 27 | Facebook giả trước, Facebook thật sau | **Sửa bằng #69** (thật chạy sớm, song song) |
| 28 | Hồ sơ Meta (App Review, xác minh doanh nghiệp) là việc của chủ dự án | Giữ |
| 29, 30 | Ưu tiên tính năng chạy được; không tinh chỉnh model Live ở bản đầu | Giữ |
| 31 | Kịch bản: tên + đoạn, mỗi đoạn 2 ô | Giữ — ô thứ nhất là **sản phẩm** (không bắt buộc) thay mã tin |
| 32, 33, 34 | Bài thi dời; chép lời người dẫn, "Mai ơi…"; người trả lời trên Facebook → AI tạm dừng | Giữ |
| 35 | Tự xóa dữ liệu sau 12 tháng không liên lạc | **Sửa:** không xóa khi khách còn đơn chưa xong; đơn đã xong giữ lại dạng ẩn danh (bỏ tên, số, địa chỉ) để báo cáo đúng |
| 36, 37, 38 | M5 làm song song; nhiều Fanpage; câu người tự gõ không qua Bộ kiểm tra | Giữ |
| 39 → 45 | Mai toàn năng, giọng riêng, diễn tập có tiếng, tin thoại, miệng giọng riêng, mức trần 3 USD | Giữ. Phần chưa làm (F-40, F-41, F-42) vẫn **để sau** |
| 46 | Gọi bằng tên nhà máy, không nói mã | **Bỏ — thay bằng #60** |
| 47 → 55 | Mai dẫn chính; giọng lên xuống; Đội AI dẫn; giọng kho miền Nam; nhạc; luật AI #52; mức trần xem thử; Radio; máy đọc dự phòng | Giữ, đổi nội dung sang bán hàng (#74) |

---

## 3. Tính năng

Ưu tiên: **B** = Bắt buộc · **N** = Nên có · **S** = Để sau. Con số thời gian, tỷ lệ trong tiêu chí là mục tiêu tham khảo
(SPEC-TD #29). Tính năng ghi "Giữ" là chạy như SPEC-TD, tiêu chí cũ đã đạt vẫn phải đạt (test cũ đổi theo dữ liệu bán hàng).

### Giữ từ bản tuyển dụng — chỉ đổi chữ và nguồn dữ liệu

| Mã | Tính năng | Thay đổi ở bản bán hàng | Mốc |
| --- | --- | --- | --- |
| F-01 | Chạy nền 24/7, tự chạy lại | Giữ | — |
| F-02 | SQLite, nâng cấu trúc, Sao lưu ngay | Giữ; thêm lần nâng cấu trúc bán hàng (mục 7) | BH1 |
| F-03 | Cài đặt và khóa | Thêm ô **Tên shop**; nhóm **Bán hàng**: phí ship đồng giá, miễn phí từ, giờ giữ hàng (mặc định 24), ngưỡng "sắp hết" (mặc định 3), ngưỡng khách hoàn (mặc định 2) | BH1 |
| F-05 | Sổ tay | Đổi thành **Sổ tay shop**; mục mồi: Giới thiệu shop · Cách chọn size (lời khuyên chung; số đo nằm ở Bảng size của sản phẩm, F-51) · Giao hàng (thời gian, hãng) · Thanh toán (số tài khoản) · Đổi trả · Câu hỏi thường gặp (nội dung trống để người dùng điền). Phí ship là số trong Cài đặt, không ghi ở Sổ tay (tránh hai nguồn khác nhau) | BH1 |
| F-06, F-24, F-25 | Kết nối Facebook, webhook, gửi ra | Giữ; F-25 thêm luật #65 (không trả lời công khai từng bình luận chốt); gửi ảnh qua Messenger ở F-56 | Cổng FB |
| F-07 → F-14 | Runtime, công cụ, luật quyền, hook, Bộ kiểm tra, Skill, lời dặn, nhật ký, chi phí | Giữ; công cụ đổi theo A.6, Bộ kiểm tra đổi nguồn theo A.4, Skill và lời dặn mẫu thay bộ bán hàng (A.7) | BH1 |
| F-15 | Phòng diễn tập | Giữ; kịch bản và vai người xem giả đổi sang mua hàng: hỏi giá, hỏi size theo chiều cao cân nặng, hỏi ship, **chốt đơn** (đúng cú pháp, sai cú pháp, chốt món hết hàng, chốt nhiều món), mặc cả, người để số điện thoại công khai, người cố lừa AI giảm giá. Kịch bản Messenger: "chốt trên live → nhắn riêng → lên đơn trọn luồng", "khách hỏi mua qua tin nhắn", "khách đổi cỡ", "khách hủy đơn", "khách đòi gặp người thật" | BH2, BH3 |
| F-16 | Màn hình người dẫn | Hiện **sản phẩm đang nói**: ảnh nhỏ, số, tên, giá, còn bán được theo từng màu × cỡ (đổi màu khi sắp hết, gạch khi hết); dòng **"Vừa chốt"** (tên, món); số đơn chốt trong buổi | BH2 |
| F-17, F-18 | Director, Co-host | Giữ; Co-host chỉ dùng **một sản phẩm** được giao + Sổ tay + tồn còn bán được của sản phẩm đó | BH1 |
| F-19, F-20, F-21 | Chuẩn bị phiên, bình luận live, chép lời người dẫn | Giữ; chọn **sản phẩm Đang bán** thay tin; đoán sản phẩm của bình luận theo số, tên hoặc đoạn đang nói (lùi theo độ trễ phát) | BH1 |
| F-22, F-43 | Miệng của Mai, Mai dẫn chính | Giữ; dữ liệu đưa thẳng gồm danh sách sản phẩm trong phiên (thẻ sản phẩm rút gọn, giá, tồn lúc mở); **miệng tự tra** bằng `xem_san_pham`, `xem_con_hang` (#80); tồn đổi giữa buổi (hết một phân loại, còn ≤ ngưỡng) → MOZA gửi cập nhật bối cảnh không kết thúc lượt (#81); lời dặn bán hàng (A.7). Gemini 3.8 Live: bỏ affective dialog, không gửi lệnh hết lượt lúc Mai đang nói (#81, BH1) | BH1, BH2 |
| F-23 | Xem thử AI hiểu gì | Chạy trên sản phẩm (mô tả mơ hồ, mâu thuẫn, thiếu chất liệu / form) | BH1 |
| F-26 | Hộp thư | Cột phải là **khách hàng + các đơn của khách**; lọc thêm "Có đơn chờ xác nhận", theo sản phẩm | BH3 |
| F-30 | Bộ nhớ và nén ngữ cảnh | Giữ; bộ nhớ gắn khách hàng (ví dụ "cao 1m60, 52kg, thích màu be"); điều không được quên khi nén: đơn đang mở, món đã giữ, địa chỉ đã cho | BH3 |
| F-33 | Tổng quan | Đổi: đơn chờ xác nhận, đơn cần gửi hôm nay, hàng sắp hết, Cần người, việc đến hạn, doanh số hôm nay, chi phí AI | BH4 |
| F-34, F-36 | Agent thử nghiệm, vòng cải tiến | Giữ | — |
| F-37 | Kịch bản live | Ô thứ nhất của đoạn là **sản phẩm** (chọn từ sản phẩm Đang bán, được để trống cho đoạn chung). "Tạo nhanh từ sản phẩm Đang bán". AI soạn kịch bản bán hàng (xem F-45, F-49 và A.7) | BH1, BH2 |
| F-38, F-39 | Giọng riêng của Mai, Phòng diễn tập có tiếng | Giữ; câu mẫu người dẫn giả đổi sang bán hàng (`{san_pham}` thay `{nha_may}`) | BH2 |
| F-44 → F-50 | Đội AI dẫn, phòng thu, chế độ trên sóng, nhạc, tiết mục, Radio, bài hát | Giữ cách làm; đổi nội dung theo F-45, F-49, F-50 dưới đây | BH2 |

### Bỏ

| Mã | Tính năng cũ | Thay bằng |
| --- | --- | --- |
| F-04 | Tin tuyển dụng | F-51 Sản phẩm |
| F-27 | Ứng viên | F-54 Khách hàng |
| F-28, F-29 | Ứng tuyển, lịch hẹn | F-55 Đơn hàng |
| F-35 | Báo cáo phễu tuyển dụng | F-58 Báo cáo bán hàng |

### Để sau (không làm ở bản này)

F-40 Tin nhắn thoại hai chiều · F-41 Mai là agent chính · F-42 Miệng "Mai nói · giọng riêng" (như SPEC-TD) · F-60 Nối
hãng vận chuyển · F-61 Kênh bán khác. (F-59 đã làm ở #90; F-64 thay bằng F-107, #124.) Các mục để sau của đợt cải tiến 3.4 và
điều kiện mở lại: cuối phần "Để sau — mô tả ngắn" dưới đây.

### Nền bán hàng — BH1

#### F-51 Sản phẩm (đầy đủ) — B
- **Mô tả:** mỗi sản phẩm là một mẫu. Ô theo chuẩn chung của catalog Meta, Shopee, TikTok Shop (#61). **(B)** = bắt buộc;
  **(AI)** = AI điền trước từ ảnh và tên (#75), người duyệt; còn lại không bắt buộc.
  1. **Cơ bản**
     - **Số (B)** — số nguyên dương, không trùng, MOZA gợi ý số kế tiếp. Khách gõ số này khi chốt.
     - **Tên (B, AI gợi ý)** — ví dụ "Sơ mi linen tay ngắn".
     - **Danh mục (B, AI)** — chọn từ danh sách trong `server/cau-hinh/danh-muc.json` (mồi: Áo thun · Áo sơ mi · Áo kiểu ·
       Áo khoác · Áo len · Quần jean · Quần tây / kaki · Quần short · Chân váy · Đầm / váy liền · Đồ bộ · Đồ ngủ · Đồ thể thao ·
       Đồ lót · Phụ kiện). Danh mục quyết định **bộ thông số** ở nhóm 3.
     - **Trạng thái (B)** — Nháp / Đang bán / Ngừng bán. Hết hàng tự tính từ tồn, không phải trạng thái.
     - **Thương hiệu** — mặc định tên shop; AI chỉ điền khác khi đọc được trên nhãn trong ảnh.
     - **Ảnh (B ≥ 1)** — tối đa 9 ảnh (như Shopee); trình duyệt thu nhỏ (cạnh dài 1600 px, JPEG) trước khi gửi; ảnh đầu là
       đại diện; mỗi ảnh **gắn màu** được (AI gợi ý) để gửi đúng ảnh khi khách hỏi màu đó. Lưu `data/anh/<san_pham_id>/`.
  2. **Giá**
     - **Giá bán (B)** — số nguyên VND; nhận "289k", "289.000", "1tr2".
     - **Giá gốc** — giá trước giảm (gạch ngang). Chỉ khi có ô này AI mới được nói "giảm từ …"; nhắc người dùng giá gốc phải là
       giá đã bán thật (quảng cáo giá giảm giả là vi phạm — mục 9).
     - **Giá vốn** — nội bộ, **AI không bao giờ thấy**; dùng cho báo cáo lãi gộp (F-58).
     - Giá riêng một phân loại: ở nhóm 5.
  3. **Thông số (AI)** — bộ ô theo danh mục, định nghĩa trong `server/cau-hinh/thong-so.json` (sửa được, không đổi mã).
     Bộ quần áo mồi: **Đối tượng** (Nữ · Nam · Unisex · Bé gái · Bé trai) · **Chất liệu** (chọn nhiều + ô chữ, ví dụ "Linen 70%,
     cotton 30%") · **Kiểu dáng / form** (Ôm · Suông · Rộng / oversize · Croptop · Dáng dài…) · **Độ co giãn** (Không · Ít ·
     Nhiều) · **Họa tiết** (Trơn · Kẻ · Caro · Hoa · In hình · Chữ…) · **Độ dày** (Mỏng · Vừa · Dày) · **Mùa** (Hè · Đông ·
     Quanh năm) · **Phong cách / dịp mặc** (chọn nhiều: Đi làm · Đi chơi · Dạo phố · Dự tiệc · Ở nhà · Thể thao) · **Xuất xứ** ·
     **Hướng dẫn giặt, bảo quản**. Chọn từ danh sách là chính, ô chữ chỉ khi cần.
  4. **Bảng size** — chọn một **bảng size dùng chung** (bảng `bang_size`, ví dụ "Áo nữ form chuẩn") hoặc tạo bảng riêng. Bảng là
     lưới: hàng = cỡ; cột chọn từ danh sách (Chiều cao · Cân nặng · Vòng ngực · Vòng eo · Vòng mông · Dài áo · Dài quần · Rộng
     vai…), mỗi ô một số hoặc khoảng ("48–55 kg"). Tư vấn size của AI chỉ dựa vào bảng này (A.4). Màn hình Sản phẩm → **Bảng
     size** để quản lý các bảng dùng chung.
  5. **Phân loại và kho (B)** — tối đa **2 nhóm** (mặc định "Màu" × "Cỡ"; nhóm 2 để trống cho hàng một cỡ; tên nhóm đổi được
     cho hàng khác). Gõ danh sách giá trị ("Đen, Trắng, Be" · "S, M, L, XL") → lưới; mỗi ô:
     - **Tồn ban đầu (B)**;
     - **Mã phân loại (SKU)** — tự sinh `<số>-<MÀU>-<CỠ>` bỏ dấu (ví dụ `12-DEN-M`), sửa được, không trùng;
     - **Giá riêng** — để trống = giá bán của mẫu (ví dụ XXL đắt hơn);
     - bỏ một ô (không bán tổ hợp đó) bằng cách để trống.
     **Cân nặng gói hàng** (gram) và **kích thước gói** (dài × rộng × cao cm) ở mức mẫu, sửa riêng được cho phân loại — chưa
     dùng tới ở bản này, cần khi nối hãng vận chuyển và sàn (F-60, F-61).
  6. **Dành cho AI bán hàng (AI) và nội bộ**
     - **Mô tả (AI)** — đoạn văn giới thiệu cho khách.
     - **Điểm nổi bật (AI)** — 3–5 ý ngắn ("vải linen mát, thấm hút", "form suông che bụng") — nguồn chính cho lời dẫn live.
     - **Tên gọi khác (AI)** — cách khách hay gọi ("áo babydoll", "sơ mi đũi") — giúp nhận bình luận chốt và tìm kiếm.
     - **Phối cùng** — chọn các sản phẩm khác để AI gợi ý mua kèm.
     - **Hỏi đáp riêng** — cặp hỏi / đáp chỉ của mẫu này ("Có lót trong không?" — "Có lót lưới").
     - **Ghi chú nội bộ** — **AI không đọc** (ví dụ "nhập từ xưởng A, lô 3").
  - **"Tạo từ ảnh" (#75):** kéo ảnh vào → AI điền nhóm 1 (tên, danh mục), 3, gợi ý màu (nhóm 5) và gắn màu cho ảnh, nhóm 6
    (mô tả, điểm nổi bật, tên gọi khác). Ô AI điền có nhãn **"AI đoán"** (màu khác) tới khi người lưu. AI **không** điền giá,
    tồn, giá vốn, xuất xứ và thương hiệu (trừ khi đọc được trên nhãn), không bịa chất liệu không nhìn thấy (ghi "cần xác nhận").
  - **Độ đầy đủ cho AI:** thanh "AI đã đủ thông tin để tư vấn" liệt kê ô còn thiếu ảnh hưởng tới tư vấn (chất liệu, đối tượng,
    kiểu dáng, bảng size, điểm nổi bật). Thiếu **không chặn** đổi sang Đang bán, chỉ nhắc; AI gặp câu hỏi về ô thiếu thì nói
    chưa có và tạo việc "Bổ sung thông tin sản phẩm".
  - **Thẻ sản phẩm cho AI:** MOZA dựng một khối chữ gọn, có nhãn rõ (Giá · Thông số · Bảng size · Còn hàng theo màu × cỡ ·
    Điểm nổi bật · Hỏi đáp · Phối cùng) từ các ô — AI đọc thẻ này thay vì đọc cột dữ liệu. Giá vốn và ghi chú nội bộ không bao
    giờ vào thẻ (test).
  - Mỗi lần lưu tạo một **bản sửa** (mọi ô nhóm 1–4 và 6): nội dung cũ vẫn đọc được, để trích dẫn và "Vì sao" chỉ đúng bản đã
    dùng. Tồn kho không nằm trong bản sửa (F-52).
  - Sao chép một sản phẩm (nút **"Nhân bản"**) để tạo mẫu gần giống nhanh.
- **Tiêu chí chấp nhận:**
  - [ ] Tạo sản phẩm 3 màu × 4 cỡ kèm tồn từng ô, có ảnh. Số trùng → `SP_TRUNG_SO`; mã phân loại trùng → `SKU_TRUNG`.
  - [ ] Giá gõ "289k" → lưu 289000, hiện "289.000đ". Giá riêng XXL 319k → đơn chốt XXL tính 319.000đ.
  - [ ] "Tạo từ ảnh" với 3 ảnh áo sơ mi → AI điền danh mục, đối tượng, kiểu dáng, họa tiết, màu, mô tả, điểm nổi bật; các ô đó
    mang nhãn "AI đoán"; giá, tồn trống. (Test với AI giả; chạy thật một lần, ghi chi phí.)
  - [ ] Đổi danh mục sang "Quần jean" → bộ thông số đổi theo `thong-so.json`, giá trị ô trùng tên được giữ.
  - [ ] Thẻ sản phẩm gửi AI không chứa giá vốn, ghi chú nội bộ (test).
  - [ ] Sản phẩm thiếu bảng size → thanh độ đầy đủ báo thiếu; AI được hỏi size trả lời chưa có, tạo việc bổ sung.
  - [ ] Bảng size dùng chung sửa một lần → mọi sản phẩm dùng bảng đó thấy số mới.
  - [ ] Sửa mô tả 3 lần → xem được 4 bản, bản nào cũng đọc nguyên văn.
  - [ ] Đổi sang Ngừng bán → công cụ `muc_luc_san_pham` không còn trả sản phẩm đó ở lần gọi kế tiếp; bình luận chốt số đó được trả lời "đã ngừng bán".
  - [ ] Danh sách tìm theo số, tên (gõ không dấu cũng được), lọc theo trạng thái và "sắp hết" / "hết hàng".
  - [ ] Thêm một màu vào sản phẩm đang bán → các ô mới có tồn 0, ô cũ giữ nguyên số.

#### F-52 Tồn kho và giữ hàng — B
- **Mô tả:** mỗi ô phân loại có **Tồn trong kho**. **Đang giữ** = tổng số lượng của các đơn chưa gửi, chưa hủy.
  **Còn bán được** = Tồn − Đang giữ. Mọi thay đổi tồn ghi một dòng lịch sử (nhập hàng, điều chỉnh tay, gửi đơn, nhận hàng hoàn).
  - Màn hình **Tồn kho**: lưới theo sản phẩm, nhập hàng nhanh (gõ số cộng thêm vào từng ô), điều chỉnh (kiểm kê), lịch sử
    ra vào, danh sách **sắp hết** (còn bán được ≤ ngưỡng) và **hết hàng**.
  - **Giữ hàng** (#64) chạy trong một giao dịch SQLite: kiểm còn bán được rồi giữ; hai người chốt món cuối cùng cùng lúc
    thì chỉ một người được.
  - Đơn "Chờ xác nhận" quá giờ giữ → tự hủy, hàng trở lại còn bán được; kiểm mỗi phút và lúc khởi động.
- **Tiêu chí chấp nhận:**
  - [ ] Nhập thêm 10 chiếc Đen/M → tồn tăng 10, có dòng lịch sử "nhập hàng".
  - [ ] Còn 1 chiếc, 2 bình luận chốt cùng lúc → 1 đơn giữ được, người kia nhận "vừa hết" (test chạy song song).
  - [ ] Đơn chờ xác nhận quá giờ giữ → đơn "Đã hủy" lý do "quá giờ giữ hàng", còn bán được tăng lại.
  - [ ] Bấm "Đã gửi" → tồn giảm, đang giữ giảm, còn bán được không đổi; "Đã nhận hàng hoàn" → tồn tăng lại.
  - [ ] Không có đường nào làm tồn âm (test).

#### F-62 "Nói với Mai" — quản lý shop bằng lời — B (mở dần theo mốc)
- **Mô tả:** (#76) ô ở thanh trên cùng mọi màn hình (trừ Màn hình người dẫn đang live): gõ, hoặc bấm 🎙 nói (chép lời bằng
  dịch vụ chép lời đã có). Agent `quan_ly` (não `gpt-6-sol`, dự phòng `gemini-3.8-flash`, lời dặn và Skill riêng) dùng công cụ
  của MOZA:
  - **BH1:** `tim_san_pham`, `xem_con_hang`, `nhap_kho` ("nhập thêm 10 áo 12 đen M, 5 trắng L"), `dieu_chinh_kho`,
    `doi_trang_thai_san_pham` ("ngừng bán áo 7").
  - **BH3:** `tim_don` ("đơn của chị Lan", "đơn nào chờ xác nhận quá 12 giờ?"), `xem_don`.
  - **BH4:** "in phiếu các đơn cần gửi" (mở trang in), "hôm qua bán được bao nhiêu, món nào chạy nhất".
  - Việc có ảnh hưởng (nhập kho, điều chỉnh, đổi trạng thái): Mai trả lời bằng **bảng xem trước** ("Nhập: 12-DEN-M +10, 12-TRANG-L
    +5") và nút **"Làm"** / "Bỏ"; chỉ khi bấm "Làm" mới ghi (luật "Hỏi"). Việc chỉ đọc: trả lời ngay kèm đường mở màn hình liên quan.
  - Không có công cụ xóa, sửa giá, sửa đơn đã gửi. Mọi lần chạy ghi nhật ký như Agent khác (nút "Vì sao").
- **Tiêu chí chấp nhận:**
  - [ ] "nhập thêm 10 áo 12 đen M, 5 trắng L" → bảng xem trước đúng 2 dòng; bấm "Làm" → tồn tăng, lịch sử ghi "nhập hàng · qua Mai".
  - [ ] Câu mơ hồ ("nhập 10 áo đen") khi có nhiều áo đen → Mai hỏi lại số sản phẩm, không ghi gì.
  - [ ] "áo 12 còn size M không" → trả lời đúng còn bán được từng màu.

### Chốt đơn và Tư vấn viên bán hàng — BH3

#### F-53 Chốt đơn từ bình luận live — B
- **Mô tả:**
  - **Nhận ra bình luận chốt** bằng mã (không gọi AI, nhanh và rẻ), ở cửa `khi_tin_den`: có chữ báo mua ("chốt", "chot",
    "lấy", "đặt", "mua", "ck", "c" đứng đầu…) hoặc đúng dạng "số + phân loại"; tìm **số sản phẩm**, **giá trị phân loại** (so
    không dấu, không phân biệt hoa thường, có bảng tên gọi khác sửa được trong `server/cau-hinh/ten-goi-khac.json`, ví dụ
    "trắng kem" = "Kem", "size m" = "M", "đen" = "black"), **số lượng** ("x2", "2 cái", "2c"). Thiếu số sản phẩm → lấy
    sản phẩm của đoạn đang nói lúc bình luận (lùi theo độ trễ phát). Sản phẩm chỉ một phân loại → "chốt 12" là đủ.
  - **Đủ thông tin và còn hàng** → giữ hàng, tạo hoặc gộp vào đơn "Chờ xác nhận" của người đó trong buổi live này (một
    người chốt nhiều món trong một buổi = một đơn), nguồn = bình luận.
  - **Mã không chắc** (có chữ báo mua nhưng không khớp rõ phân loại, hoặc viết lạ) → **model rẻ đọc hộ** (#77: `gpt-6-luna`,
    dự phòng `gemini-3.5-flash-lite`) với thẻ rút gọn của sản phẩm đang nói, trả phiếu `{la_chot, so, gt1, gt2, so_luong, chac_chan}`; chắc
    chắn thì giữ như trên. Dùng cả **tên gọi khác** của sản phẩm (F-51) khi so.
  - **Vẫn thiếu hoặc mơ hồ** (không rõ màu, cỡ; màu không có) → không giữ; Tư vấn viên nhắn riêng hỏi lại, kèm các phân loại còn hàng.
  - **Hết hàng** → không giữ; nhắn riêng báo hết và gợi ý phân loại còn hàng của cùng mẫu.
  - **Lên sóng** (#72): câu mẫu "vừa chốt" đọc bằng miệng / Đội AI ở chỗ nghỉ kế tiếp (tối đa 3 tên mỗi 30 giây); chế độ
    "Chỉ gợi ý" thì hiện ở dòng "Vừa chốt" trên Màn hình người dẫn để người dẫn tự đọc. Món vừa **hết** thì câu mẫu "vừa hết".
  - **Nhắn riêng** (#65): tin đầu tóm tắt món đã giữ, giá từng món, tổng tạm tính, hạn giữ hàng, rồi xin tên, số điện thoại,
    địa chỉ (khách cũ có địa chỉ thì hỏi "giao về … như lần trước không?"). Không nhắn riêng được → bình luận công khai gom
    tên mỗi 2 phút.
  - Bình luận chốt có số điện thoại → vẫn ẩn (#19), vẫn ghi nhận chốt, số điện thoại **không** tự điền vào đơn (khách xác nhận trong tin nhắn).
  - Bình luận chốt ghi nhận `xu_ly = da_chot`, gắn `don_id`; Director không cần giao Co-host cho bình luận này.
- **Tiêu chí chấp nhận:**
  - [ ] Bộ ≥ 60 câu mẫu chốt (đúng, sai chính tả, không dấu, viết tắt, nhiều món, có số điện thoại, không phải chốt như "chốt
    rồi chưa shop?") → nhận đúng 100% (test).
  - [ ] Phòng diễn tập: người xem giả "chốt 12 đen M" → trong ≤ 10 giây có đơn Chờ xác nhận, món được giữ, Mai đọc tên trên sóng, Facebook giả nhận tin nhắn riêng.
  - [ ] "chốt 12 đen" với sản phẩm có cỡ → không giữ, tin nhắn riêng hỏi cỡ, liệt kê cỡ còn hàng màu đen.
  - [ ] Cùng người chốt 3 món trong một buổi → một đơn 3 dòng.
  - [ ] Chốt số sản phẩm Ngừng bán hoặc không có → không giữ, nhắn báo lịch sự.

#### F-54 Khách hàng — B
- **Mô tả:** thay "Ứng viên". Hồ sơ: **tên**, **số điện thoại** (chuẩn `+84…`, không trùng), **địa chỉ giao** (một ô chữ;
  đơn mới dùng lại được), **ghi chú**; hệ thống ghi: nguồn (hội thoại, buổi live), số đơn, số đơn hoàn, tổng đã mua, bộ nhớ.
  - Khách hàng được tạo khi có **số điện thoại** (lúc khách cho thông tin giao, hoặc người dùng tạo tay). Trước đó đơn chỉ
    gắn với người Facebook.
  - Chống trùng theo số điện thoại trên mọi Page; gộp hai hồ sơ giữ lịch sử cả hai; "Xóa dữ liệu người này" như SPEC-TD F-27
    (đơn đã xong giữ ẩn danh, đơn chưa xong phải hủy trước).
  - Tự xóa sau 12 tháng không liên lạc — trừ khi còn đơn chưa xong (#35 sửa).
- **Tiêu chí chấp nhận:**
  - [ ] Khách cho số `0912 345 678` khi đã có hồ sơ `+84912345678` → không tạo mới, đơn gắn hồ sơ cũ, AI hỏi xác nhận địa chỉ cũ.
  - [ ] Một bình luận không chốt không tạo hồ sơ.
  - [ ] Khách có 2 đơn hoàn → hồ sơ có nhãn "Từng hoàn 2 đơn"; đơn mới không được AI xác nhận, có việc "Gọi xác nhận đơn" (#73).
  - [ ] Xóa dữ liệu → tên, số, địa chỉ, bộ nhớ, nội dung tin nhắn của người đó bị xóa; báo cáo vẫn đúng số đơn và doanh số.

#### F-55 Đơn hàng — B
- **Mô tả:**
  - Đơn có **mã dễ đọc** (`DH-` + số tăng dần), **các dòng hàng** (sản phẩm, phân loại, số lượng, **đơn giá chụp lúc
    chốt** — đổi giá sau đó không đổi đơn đã có), người nhận (tên, số điện thoại, địa chỉ), **phí ship** (tính theo Cài đặt lúc
    tạo; người dùng sửa được), **tổng tiền** (máy tính: tổng hàng + phí ship), thanh toán (COD / chuyển khoản, "Đã nhận tiền"),
    ghi chú, mã vận đơn, nguồn (bình luận live / tin nhắn / người tạo tay), buổi live, hội thoại.
  - **Trạng thái:** Chờ xác nhận → Đã xác nhận → Đã gửi → Đã giao / Hoàn; Đã hủy (từ Chờ xác nhận hoặc Đã xác nhận). Ai
    được chuyển gì: bảng ở mục 7. Mọi lần đổi ghi lịch sử kèm nguồn (AI / người / khách tự báo) và bằng chứng; người hoàn tác
    được lần đổi gần nhất của AI.
  - **Sửa đơn:** chỉ khi Chờ xác nhận hoặc Đã xác nhận (thêm, bớt món, đổi phân loại, đổi địa chỉ) — mỗi lần sửa giữ lại
    hàng mới và trả hàng cũ trong cùng giao dịch. Đơn Đã gửi trở đi không sửa được (`DON_KHONG_SUA_DUOC`).
  - Màn hình **Đơn hàng**: lọc theo trạng thái, buổi live, ngày, "chưa nhận tiền"; tìm theo mã, tên, số điện thoại; chi tiết
    đơn có lịch sử và nút mở hội thoại; người dùng tạo đơn tay (khách gọi điện).
- **Tiêu chí chấp nhận:**
  - [ ] Đổi giá sản phẩm sau khi chốt → đơn cũ giữ giá cũ, đơn mới dùng giá mới.
  - [ ] Tổng tiền = tổng hàng + phí ship theo Cài đặt; đạt mức "miễn phí từ" → phí ship 0 (test).
  - [ ] AI xác nhận đơn khi khách chưa nói đồng ý → bị chặn, ghi lý do (test).
  - [ ] AI hủy đơn khi khách chưa tự nói hủy → bị chặn (test).
  - [ ] Khách đổi cỡ M → L khi đơn Đã xác nhận → M trả về, L được giữ; L hết → báo, đơn giữ nguyên.
  - [ ] Người dùng tạo đơn tay cho khách gọi điện, giữ hàng như đơn chốt.

#### F-31 Tư vấn viên AI (bán hàng) — B — *thay nội dung SPEC-TD F-31*
- **Mô tả:** tự động xử lý mọi hội thoại Messenger và bình luận bài đăng như nhân viên bán hàng (A.1): tư vấn sản phẩm
  theo **thẻ sản phẩm** (thông số, điểm nổi bật, hỏi đáp riêng; cỡ theo **Bảng size của sản phẩm** và chiều cao, cân nặng khách
  nói), gợi ý món trong ô **Phối cùng** (chỉ Đang bán, còn hàng, tối đa một lần mỗi hội thoại), gửi ảnh đúng màu khách hỏi (F-56),
  tìm mẫu theo ảnh khách gửi (F-63), trả lời phí ship, thời gian giao, đổi trả, thanh toán theo Sổ tay;
  **lên đơn**: giữ hàng, xin tên, số điện thoại, địa chỉ, đọc lại đơn và tổng tiền, chờ khách nói đồng ý rồi xác nhận; sửa,
  hủy đơn theo lời khách; hỏi mã vận đơn / tình trạng đơn thì đọc từ đơn.
  - Xin thông tin giao theo lời dặn vai trò: nói rõ để giao hàng, shop giữ thế nào, khách sửa hay xóa được (Luật 91/2025,
    mức vừa đủ #71).
  - Chuyển **Cần người**: khiếu nại hàng lỗi, đòi hoàn tiền, đổi trả phức tạp, đòi gặp người thật, khách nghi bom hàng (#73),
    hỏi điều không có trong nguồn sau một lần hẹn kiểm lại.
  - Giữ từ SPEC-TD F-31: tự giới thiệu là trợ lý tự động ở tin đầu, spam chỉ gắn nhãn, gom tin nhắn liên tiếp 6 giây, người gõ
    tay thì AI tạm dừng.
- **Tiêu chí chấp nhận:**
  - [ ] Kịch bản "chốt trên live → nhắn riêng → lên đơn trọn luồng" đi hết: khách trả lời → AI xin thông tin → khách cho số,
    địa chỉ → tạo khách hàng → AI đọc lại đơn và tổng tiền đúng → khách "ok" → Đã xác nhận.
  - [ ] Khách nhắn "cao 1m58 nặng 50 kí mặc size gì" → AI trả lời theo Bảng size của sản phẩm đang hỏi, trích dòng bảng size; sản phẩm chưa có bảng size → nói chưa có, mời khách chờ shop báo, tạo việc "Bổ sung thông tin sản phẩm".
  - [ ] Khách mặc cả "bớt 50k được không" → AI không tự giảm, không có con số tiền nào khác giá (Bộ kiểm tra), có thể chuyển Cần người nếu khách nài.
  - [ ] "Cho tôi gặp người thật" → Cần người, AI ngừng gửi.

#### F-56 Gửi ảnh sản phẩm qua Messenger — N
- **Mô tả:** công cụ `gui_anh_san_pham(so, phan_loai?)`: gửi ảnh đại diện (hoặc ảnh có ghi tên màu, nếu người dùng đặt tên
  tệp theo màu) qua Messenger — tải ảnh lên Meta bằng Attachment Upload API rồi gửi theo mã tệp (MOZA không có địa chỉ
  công khai cho ảnh). Tối đa 3 ảnh mỗi lần. Facebook giả nhận ảnh để diễn tập.
- **Tiêu chí chấp nhận:**
  - [ ] Khách "cho xem ảnh áo 12" → Facebook giả nhận ảnh của sản phẩm 12.
  - [ ] Cổng Facebook thật có dòng "gửi ảnh qua Messenger".

#### F-63 Tìm mẫu theo ảnh khách gửi — N
- **Mô tả:** (#78) khách gửi ảnh (chụp màn hình, ảnh mẫu nơi khác) kèm "shop có mẫu này không?" → MOZA tải ảnh về, lọc trước
  sản phẩm Đang bán theo danh mục và màu AI đọc được từ ảnh khách, rồi đưa model đọc ảnh so ảnh khách với ảnh đại diện của
  tối đa 12 mẫu → trả lời "giống nhất là áo số 12 …" kèm ảnh (F-56), hoặc "shop chưa có mẫu này" và gợi ý mẫu gần nhất. Không
  khẳng định "giống hệt"; chỉ nói "gần giống".
- **Tiêu chí chấp nhận:**
  - [ ] Facebook giả: khách gửi một ảnh sản phẩm 12 chụp lại → AI trả lời số 12.
  - [ ] Ảnh không liên quan (ảnh phong cảnh) → AI hỏi lại khách cần tìm mẫu gì.

### Giao hàng và báo cáo — BH4

#### F-57 Gửi hàng (bước 1) — B
- **Mô tả:** (#63)
  - Màn hình **Đơn hàng → Cần gửi**: đơn Đã xác nhận, cũ trước; tích chọn nhiều đơn.
  - **In phiếu gửi hàng:** mỗi đơn một phiếu khổ A6 (4 phiếu một trang A4): shop gửi (tên shop, số điện thoại, địa chỉ
    trong Cài đặt → Bán hàng), người nhận, món, số tiền thu hộ (COD) hoặc "Đã thanh toán", ghi chú. In bằng trình duyệt, không cần thư viện.
  - **Xuất file** CSV (mở được bằng Excel, tiếng Việt không lỗi) theo cột thường gặp của hãng vận chuyển: tên, số điện thoại,
    địa chỉ, tên hàng, số lượng, tiền thu hộ, ghi chú.
  - Dán **mã vận đơn** vào từng đơn (không bắt buộc); bấm **"Đã gửi"** cho các đơn đã chọn → trừ tồn (F-52).
  - Đơn Đã gửi: người dùng bấm "Đã giao" hoặc "Hoàn"; hoàn → "Đã nhận hàng hoàn" cộng lại kho. Đơn COD Đã giao coi như đã nhận tiền.
  - Nhắn khách "đơn đã gửi, mã vận đơn …" nếu còn trong 24 giờ kể từ tin cuối của khách (F-32).
- **Tiêu chí chấp nhận:**
  - [ ] Chọn 5 đơn → in 5 phiếu đúng thông tin; xuất CSV mở bằng Excel không lỗi dấu.
  - [ ] "Đã gửi" 5 đơn → tồn giảm đúng, trạng thái đổi, lịch sử ghi người làm.
  - [ ] Đơn hoàn → "Đã nhận hàng hoàn" → tồn tăng lại, khách tăng số đơn hoàn.

#### F-32 Nhắn chủ động (bán hàng) — N — *thay nội dung SPEC-TD F-32*
- **Mô tả:** trong 24 giờ kể từ tin cuối của khách: nhắc khách đã chốt mà chưa cho thông tin giao (một lần, trước khi hết
  giờ giữ khoảng 2 giờ); báo đơn đã gửi kèm mã vận đơn. Ngoài 24 giờ: không nhắn (thẻ POST_PURCHASE_UPDATE đã bị Meta bỏ
  từ 27/4/2026, SPEC-TD A.10) → tạo việc cho người dùng khi cần (ví dụ "Gọi khách xác nhận địa chỉ"). Tối đa 1 tin chủ động mỗi người mỗi ngày.
- **Tiêu chí chấp nhận:**
  - [ ] Đơn chờ xác nhận còn 2 giờ là hết giờ giữ, khách nhắn lần cuối cách đó 20 giờ → AI nhắc một lần.
  - [ ] Lúc cần nhắc đã ngoài 24 giờ → không gửi gì ra Facebook; có việc cho người dùng.

#### F-58 Báo cáo bán hàng — N
- **Mô tả:** theo buổi live, theo ngày, theo sản phẩm: bình luận → bình luận chốt → đơn chờ xác nhận → đã xác nhận → đã gửi
  → đã giao / hoàn / hủy; doanh số (tổng tiền đơn đã xác nhận trở lên, trừ hủy); **lãi gộp** (doanh số hàng − giá vốn chụp
  trên dòng đơn; sản phẩm chưa có giá vốn thì ghi "chưa tính"); sản phẩm bán chạy; tỷ lệ hoàn; chi phí AI của buổi live. Dữ liệu Phòng diễn tập không tính.
- **Tiêu chí chấp nhận:**
  - [ ] Số liệu khớp đếm trực tiếp trong cơ sở dữ liệu trên bộ dữ liệu test; xóa dữ liệu khách không đổi con số.

### Nội dung trên sóng cho bán hàng — BH2

Cách làm của Đội AI, phòng thu, nhạc, Radio giữ như SPEC-TD F-44 → F-50. Chỉ đổi nội dung dưới đây.

#### F-45 (đổi) Kịch bản bán hàng — B
- **AI soạn kịch bản** có 3 kiểu như cũ — Mai (cặp MC người dẫn + Mai), Đội AI (talk show), Radio — đổi sang bán hàng:
  - Mở đầu có móc câu (món hot nhất hôm nay); mỗi sản phẩm một đoạn; điểm hút trước (chất liệu, form, dịp mặc), rồi giá,
    màu, cỡ còn hàng; cuối đoạn **lời mời chốt đúng cú pháp** ("chốt 12 kèm màu, cỡ"); sau mỗi 3–4 sản phẩm một đoạn giao lưu
    (chào người mới, đọc người vừa chốt, nhắc cách chốt, trả lời câu hay hỏi về size, ship).
  - Tiết mục Đội AI: hỏi nhanh đáp gọn, **so kè hai mẫu**, **gợi ý phối đồ** (giữa các sản phẩm đang bán), bản tin hàng mới, đố
    vui (đáp án là số sản phẩm, màu hoặc vài chữ; chỉ chúc mừng, không treo thưởng — #74).
  - Luật (#52, #71): nhân vật tự giới thiệu là trợ lý AI của `{ten_shop}`; **không kể đã mặc thử, đã dùng** như người thật;
    không bịa chất liệu, xuất xứ, công dụng ngoài mô tả; không nói "sắp hết", "cuối cùng" khi số còn không đúng; không hứa giảm giá, quà.
  - Số liệu: giá chép đúng; kịch bản **không ghi số lượng còn** (đổi liên tục) — số còn chỉ nói trên sóng từ dữ liệu tồn lúc đó
    (miệng nhận cập nhật; Đội AI dùng câu mẫu).
  - Tối đa 3 chữ "nhé" cả kịch bản (giữ).
- **Tiêu chí chấp nhận:**
  - [ ] AI soạn từ các sản phẩm Đang bán: đủ sản phẩm, mỗi đoạn có lời mời chốt đúng số sản phẩm, giá đúng, không có số lượng còn.
  - [ ] Kịch bản Đội AI có ít nhất một đoạn so kè hoặc phối đồ; không câu nào kể trải nghiệm mặc thử.

#### F-46 (đổi) Câu chen bán hàng của Đội AI — B
- Thêm câu mẫu trong `doi-ai-cau-mau.json`: `vua_chot` ("{ai}: Chị {ten} vừa chốt {mon} rồi nè!"), `vua_het` ("{mon} vừa hết
  rồi cả nhà ơi"), `con_it` ("{mon} chỉ còn {so} chiếc" — `{so}` lấy từ tồn lúc đọc, chỉ đọc khi ≤ ngưỡng sắp hết),
  `nhac_cach_chot`. Ưu tiên chen ở chỗ nghỉ: câu trả lời "Mai ơi" → chúc mừng đố vui → **vừa chốt / vừa hết** → trả lời người
  xem → chào tên. Vẫn tối đa 2 câu giữa hai đoạn (câu vừa chốt gom tên, tính một câu).
- **Tiêu chí chấp nhận:**
  - [ ] Buổi tập Đội AI: người xem giả chốt → đội đọc "vừa chốt" ở chỗ nghỉ kế tiếp; phân loại hết → đọc "vừa hết".

#### F-49, F-50 (đổi) Radio {ten_shop} — B
- Kịch bản Radio (#74): **Điểm tin hàng mới** (mở đầu, 3–4 món nổi bật, mọi nhân vật tự giới thiệu là AI, mời bình luận lời
  chúc) · **Bản tin sản phẩm** (mỗi sản phẩm một đoạn, kèm một mẹo hữu ích lấy từ mô tả hoặc Sổ tay: cách giặt, cách chọn
  size, dịp mặc) · **Alo {ten_shop}** (câu khách hay hỏi về size, ship, đổi trả — chỉ theo Sổ tay) · **Góc phối đồ** ·
  **Đố vui** · **Lời nhắn gửi** (lời chúc + `[Bài hát]`) · **Điểm lại**. Báo giờ giữ nguyên.
- Nhạc hiệu có lời và nhạc hiệu Radio tạo lại với lời về shop (`{ten_shop}`); bài hát gợi ý mới: "Cuối tuần dạo phố",
  "Ngày mới rạng rỡ", "Gửi mẹ chiếc áo mới", "Tự tin là chính mình", "Mùa thu áo mới". Lời bài: tích cực, về thời trang và
  cuộc sống, không tên thương hiệu, không quảng cáo, không hứa hẹn.
- **Tiêu chí chấp nhận:**
  - [ ] AI soạn Radio từ các sản phẩm Đang bán: có Điểm tin hàng mới, Lời nhắn gửi với `[Bài hát]`, Alo {ten_shop}; không số lượng còn.
  - [ ] Buổi tập Radio: nhạc hiệu Radio mới → báo giờ → Điểm tin hàng mới.

#### F-64 Mai nhìn sản phẩm qua camera — phép thử — N
- **Mô tả:** (#82) Màn hình người dẫn có nút **"👁 Cho Mai xem"** (tắt mặc định). Bật → webcam laptop gửi hình thưa (1 khung /
  2–3 giây, cạnh dài 768 px) vào miệng **Gemini 3.8 Live** (GPT Live 1 không nhận hình — nút ẩn khi dùng miệng đó). Lời dặn: nhận
  ra sản phẩm theo ảnh của các sản phẩm trong phiên (ảnh đại diện đưa sẵn lúc mở phiên), gọi công cụ `chuyen_san_pham(so)` khi
  người dẫn giơ một món khác; chỉ tả màu, kiểu thấy được — giá, chất liệu vẫn theo thẻ sản phẩm.
  - **Phép thử trước khi làm đầy đủ:** 5 phút trong Phòng diễn tập với 3 sản phẩm thật; đo chi phí mỗi phút và tỷ lệ nhận
    đúng. **Báo chi phí cho chủ dự án trước khi chạy.** Đắt (> 0,05 USD/phút thêm, *ngưỡng tạm*) hoặc nhận sai > 1/5 lần thì
    dừng, ghi kết quả vào mục 12.
- **Tiêu chí chấp nhận:**
  - [ ] Phép thử chạy, có số liệu chi phí và tỷ lệ nhận đúng; chủ dự án quyết làm tiếp hay bỏ.

### Đợt cải tiến — BH5 "Không rơi đơn"

#### F-15 (mở rộng) Facebook giả mới, khách giả soạn sẵn — B · BH5 · #92–#94
- **Meta giả** `server/facebook/meta-gia.js`: bộ trạng thái và luật (Page, live có id live và id video, bình luận có / không `from`, lượt nhắn riêng, ảnh tải lên, mẫu Utility, hồ sơ Messenger, quyền, Page bị hạn chế, mức dùng), đồng hồ giả tua được. Hai lối vào: `gia.js` (Phòng diễn tập, test nghiệp vụ) và `fetchMetaGia` (`test/ho-tro-fb.js`) chạy chính `that.js` + `graph.js` + `nhip-goi.js`. Sự kiện vào qua `tuWebhook` / `binhLuanTuGraph`; tin ra qua `server/facebook/dung-tin.js` (`kiemThe`: ≤ 3 nút, tiêu đề nút ≤ 20, chữ thẻ ≤ 640, tiêu đề / phụ đề thẻ ảnh ≤ 80, lưới 2–6 ảnh, trả lời nhanh ≤ 13, payload ≤ 1000); lỗi ném đúng dạng Meta, đổi qua `doiLoi`.
- Hợp đồng `giao-dien.js` kiểm đủ mọi hàm (cả Hộp thư). Bảng `server/facebook/hanh-vi-meta.json`: 24 hành vi H01–H24, mỗi dòng có nguồn, ngày tra, trạng thái (`tai_lieu`, `mau_thuan`, `chua_kiem_chung`, `da_thu_nguoi_thu`, `da_thu_khach_la`).
- Phòng diễn tập: Messenger giả vẽ thẻ ảnh, lưới, nút, trả lời nhanh, nút gọi, menu, mẫu Utility; mỗi khung chat hiện Tin nhắn chờ / còn 24 giờ / lượt nhắn riêng đã dùng; ô chọn **tình huống Facebook**: Thận trọng (mặc định) · Xấu nhất · Page bị hạn chế · Ứng dụng chưa duyệt · Hỗn loạn nhẹ. Tua thời gian lùi cả dữ liệu lẫn đồng hồ Meta giả.
- **Khách giả "Soạn sẵn (0 đồng)"** mặc định: `server/cau-hinh/khach-gia-soan-san.json` (luật `{khi, lam}`: bấm nút theo loại payload, gõ chữ, chạm trả lời nhanh, im, chờ; chạy lại ra cùng kết quả). Bản xem thử có cờ `--ai-gia`.
- Mốc sau thêm hành vi vào Meta giả khi cần (BH7: số điện thoại tự điền, nút gọi, menu, video xem lại, Page bình luận).
- **Tiêu chí:** [x] cùng kịch bản chạy trên bản giả và bản thật nối `fetchMetaGia` cho cùng kết quả, cùng mã lỗi; [x] mọi hành vi trong bảng có nguồn và test; [x] buổi tập khách soạn sẵn không có lượt `agent_run` nào của `khach_gia`; [x] 50 người chốt trong 1 phút giả: 0 người bị bỏ sót, 0 bán quá, mỗi người đúng một kết cục.

#### F-65 Nền chốt đơn: một lượt nhắn riêng, một bộ đọc nút, một đường gửi — B · BH5 · việc nền · #95
- Bảng `luot_nhan_rieng`: mọi đường muốn nhắn riêng một bình luận phải **giữ lượt** trước, trong `PhongLive.nhanBinhLuan`, trước `chotDon.xuLy` và Director. Director, Hộp thư, hook `hop_thu_gui` đọc cùng bảng. Gửi lỗi thật thì trả lượt để nhắn bù.
- Bộ đọc nút `server/nghiep-vu/nut-bam.js` (`taoPayload`, `docPayload`; vẫn đọc hai nút cũ của #89), xử lý ở một nơi `server/xu-ly-nut.js`; mọi nút kiểm "đơn có phải của người bấm"; trả lời nhanh coi như nút.
- Mọi tin do mã soạn đi qua công cụ nội bộ `gui_the_moza` (không cấp cho Agent), qua đủ hook: `khan_cap`, `luat_quyen`, `hop_thu_gui` (24 giờ, 1 lượt / bình luận, 7 ngày, người đang giữ hội thoại), `gioi_han_lien_he`, `gioi_thieu` (mở cho tin không có Agent: tin đầu phải có câu tự nhận trợ lý AI).
- Hợp đồng Facebook thêm `taiAnhLen`, `nhanRiengThe` (luôn hỏi `can_reply_privately` trước), `guiTheSp`, `guiLuaChon`; lấy `recipient_id` để gắn người.
- Mọi câu do mã soạn nằm ở `server/cau-hinh/cau-mau-khach.json` (sửa tệp là đổi lời).
- **Tiêu chí:** [x] một bình luận vừa là chốt vừa bị Director chuyển tư vấn → đúng 1 tin, không lỗi `DA_NHAN_RIENG`; [x] 20 lời giữ lượt song song → 1 người thắng; [x] nút mang đơn của người khác → đơn không đổi; [x] "Dừng mọi thứ" bật → thẻ vào chờ duyệt; [x] test thẻ đơn cũ vẫn đạt.

#### F-66 Giới hạn liên hệ, ngừng liên hệ, "ẩn tên" — B · BH5 · việc nền, P01, P06, P10 · #96
- `server/nghiep-vu/lien-he.js` + hook `gioi-han-lien-he.js` (cửa `truoc_cong_cu`, bắt buộc). Mỗi lần gửi mang một mục đích: trả lời (không giới hạn) · tin đầu · nhắc · báo hủy · báo đơn · chăm sóc · mời chào; gọi tên trên sóng cũng được ghi.
- Luật (hằng số trong `mac-dinh.json`): mỗi đơn 1 gọi tên kiểu nhắc, 2 nhắc, 1 báo hủy; chăm sóc và mời chào mỗi người 1 tin/ngày; nhắc, báo hủy, chăm sóc, mời chào chỉ 7h–22h giờ Việt Nam (ngoài khung thì dời tới 7h); Page bị hạn chế → chặn mọi tin chủ động và nhắn riêng mới.
- **Ngừng liên hệ:** "dừng", "stop", "đừng nhắn nữa", "không nhận tin nữa", "thôi / thôi shop" đứng riêng (câu ngắn, không kèm món hay size), hoặc bấm [Không lấy] → ghi `nguoi_fb.ngung_lien_he_luc`, trả câu xác nhận. Từ đó không tin chủ động, không gọi tên; tin trạng thái đơn còn mở → việc gọi cho người; khách tự nhắn lại vẫn được trả lời.
- **Ẩn tên:** "ẩn tên", "đừng gọi / đọc tên" → nhãn `an_ten`; hàm `live.daAnTen` dùng cho mọi chỗ đọc hoặc hiện tên.
- Nhận bằng mã ở `nhan-binh-luan.js` (bình luận) và hook `phan-loai-tin.js` (tin nhắn); từ khóa ở một tệp `server/cau-hinh/tu-khoa.json`.
- **Tiêu chí:** [x] lần nhắc thứ 3 bị chặn `GIOI_HAN_LIEN_HE`; [x] nhắc lúc 22:30 → 7:00 hôm sau; [x] "thôi shop" → không còn tin chủ động; "thôi shop ơi em lấy size L" không bị coi là dừng; khách nhắn lại vẫn được trả lời; [x] "ẩn tên giúp em" → cả buổi không đọc tên người đó.

#### F-67 Sửa nền Facebook, bảng giá, trần câu chen — B · BH5 · việc nền, P04, P16 · #92, #101, #105
- `timLiveDangPhat` lấy thêm id video, link, số người xem; `ganLive` lưu `fb_video_id`, `fb_link`, `bat_dau_fb` (giờ Facebook) và đặt `bat_dau` theo giờ Facebook (không có thì giờ máy); `laBaiLive` so cả id live lẫn id video.
- Bình luận của chính Page không vào chốt đơn, ẩn bình luận, Director. Bình luận không có người gửi: không đọc tên (hiện "Một bạn"), không đếm là người chốt.
- `QUYEN_CAN` thêm `page_utility_messaging`, `TRUONG` thêm `messaging_referrals`; sửa chữ "Meta duyệt khoảng 24 giờ" (4 chỗ). Khóa `fb_mau_utility` thành một bộ nhiều mẫu (đọc được dạng cũ); tạo mẫu có nút; `trangThaiMau` đọc trạng thái và loại mẫu.
- Lỗi 10 / 1893063 → `FB_PAGE_BI_CAM_NHAN` (trước nhánh mã 10).
- `nhip-goi.js` xếp hàng thật; thẻ gặp giới hạn gọi thì vào hàng gửi lại trong 7 ngày.
- Bảng giá theo ngày gọi: khối giá từ 1/1/2027 (Gemini 3.8 Live, 3.8 Flash, TTS gấp đôi) và giá phần hình.
- Trần câu chen Đội AI 60 câu/buổi (từ 80% chỉ còn câu ưu tiên; chạm trần thì hiện chữ); `chenBanHang` mỗi khóa một nhãn riêng.
- **Tiêu chí:** [x] live bắt đầu lúc T, MOZA thấy lúc T+20 giây → `bat_dau` = T; [x] bình luận live về cả luồng live lẫn webhook bài đăng → 1 đơn, 1 tin; [x] Page bình luận "ví dụ chốt 12 đen M" → không đơn; [x] lỗi {10, 1893063} đúng mã; [x] giá 3.8 Live ngày 1/1/2027 gấp đôi 31/12/2026; [x] câu chen thứ 61 thành chữ.

#### F-68 Thẻ giữ hàng do mã soạn + giữ hàng hai mức — B · BH5 · P22, P24a · #97, #98
- Tin riêng đầu cho mọi bình luận chốt do mã soạn trong 1–2 giây, 0 lượt AI. Thẻ: ảnh đúng màu · "Áo 12 Đen/M · 159.000đ" · "Giữ tới hết live + 2 giờ · Tin tự động từ trợ lý AI của {ten_shop}" · [Giữ, lên đơn] [Đổi] [Không lấy]. Không số điện thoại, địa chỉ.
- Thiếu màu / size: lưới 2–6 ảnh hoặc trả lời nhanh các phân loại còn hàng, chưa giữ. Hết hàng: thẻ "vừa hết" + phân loại còn hàng, chừa chỗ cho nút [Vẫn chờ] (F-92). Ngừng bán, số không có: tin chữ + món đang live.
- Ảnh theo #97 (đường ảnh công khai hẹp — chủ dự án đã đồng ý; ảnh lỗi thì thẻ chữ có nút); không nhắn riêng được → gom tên công khai mỗi 2 phút (#65), câu có link m.me.
- [Giữ, lên đơn] → giữ dài, xin tên, số, địa chỉ (đủ thì gửi thẻ đơn); [Đổi] → phân loại còn hàng; [Không lấy] → bỏ món (còn mỗi món đó thì hủy, nguồn khách tự báo) và ngừng nhắc đơn.
- Giữ hai mức (#98) gom về một hàm `tinhGiuDen`; ô mới "Giữ ngắn cho người chưa bấm: hết live + N giờ" (1–24, mặc định 2).
- **Tiêu chí:** [x] "chốt 12 đen M" → thẻ đúng giá, 3 nút, dòng "trợ lý AI" trong ≤ 2 giây, 0 lượt AI; [x] 40 người chốt trong 60 giây → 40 thẻ, mỗi thẻ ≤ 3 giây, 0 bán quá; [x] không nhắn riêng được → gom công khai; [x] ảnh hỏng → thẻ chữ có nút, vẫn có câu tự nhận AI; [x] live hết 21:00, chưa bấm → giữ tới 23:00; bấm lúc 21:30 → 21:30 hôm sau.

#### F-69 Nhắc đơn chưa xác nhận, báo hủy, "Gọi xác nhận" — B · BH5 · P06 · #99
- Lần 1: 20 phút sau tin cuối của shop mà khách chưa làm bước tiếp (trong 24 giờ). Lần 2: sớm hơn giữa "hạn giữ − 2 giờ" và "tin cuối của khách + 22 giờ", cách lần 1 ≥ 2 giờ; ngoài 24 giờ dùng mẫu Utility "đơn đang chờ xác nhận" có nút, chỉ khi Meta xếp UTILITY. Khóa chống trùng riêng cho mỗi lần nhắc.
- Nội dung do mã soạn: đơn đủ thông tin → "Đơn DH-0042 · 169.000đ đang chờ mình xác nhận, shop giữ tới 21:15" + thẻ đơn hiện hành + trả lời nhanh [Không lấy]; đơn còn thiếu → nêu thiếu gì.
- Báo hủy: trong 24 giờ có [Đặt lại] (tạo đơn mới cùng món trong một giao dịch); ngoài 24 giờ mẫu Utility "đơn đã hủy" chỉ thông tin.
- Đơn đủ tên, số, địa chỉ mà hết giờ: không tự hủy; gia hạn 12 giờ một lần + việc "Gọi xác nhận đơn … · 0912***678"; không ai xử lý thì hủy như thường kèm tin báo.
- Đơn không số, ngoài 24 giờ: không tạo việc gọi, màn Đơn hàng ghi "Chưa liên lạc được". Bỏ hai hàm không nơi nào gọi `canHoiTham`, `tangHoiTham`.
- **Tiêu chí:** [x] gửi địa chỉ rồi im 20 phút → 1 nhắc; vài giờ sau lần 2; không có lần 3; [x] mẫu bị xếp MARKETING → không gửi; [x] quá giờ, thiếu số → hủy, có [Đặt lại]; bấm → đơn mới; [x] đủ thông tin hết giờ → có việc "Gọi xác nhận"; [x] khách đã ngừng liên hệ → không nhắc, không báo hủy.

#### F-70 Nhắc trên sóng, nhắc cách chốt, "ib", link m.me — B · BH5 · P01 · #100
- Người đã nhận thẻ ≥ 4 phút mà chưa bấm hay nhắn → mỗi lượt đọc ≤ 3 tên, mỗi người 1 lần mỗi buổi, bỏ người ẩn tên. Câu trung tính ("Hoa, Trâm ơi, shop đã nhắn riêng rồi nè, xem giúp shop mục Tin nhắn chờ nha"). Đội AI câu `mo_tin_nhan`; Mai hàm mới `mieng.nhacMoTin`; Chỉ gợi ý: dòng chữ to trên Màn hình người dẫn.
- Nhắc cách chốt khi có người mới (≥ 3 người bình luận lần đầu trong 3 phút, hoặc người xem tăng ≥ 20%) hoặc món có ≥ 3 câu hỏi / 2 phút mà 0 chốt; cách nhau ≥ 5 phút; tính vào trần câu chen.
- "ib / check ib / inbox / nt / chưa thấy tin / giá sao" nhận bằng mã trước khi đọc chốt và Director: có đơn → nhắn lại thẻ hiện tại qua bình luận mới; chưa có đơn → thẻ món đang nói; 1 lần / 5 phút mỗi người; "giá sao" vẫn tới Director.
- Link `m.me/<page>?ref=phien_<id>` trong câu gom công khai và câu ghim; đọc cả hai kiểu giới thiệu của Meta; khớp buổi thì hỏi [Đúng, là mình] [Không phải] rồi gắn người. Nút "Cài Messenger cho Page" (nút Bắt đầu; menu thêm ở F-88) — người bấm.
- **Tiêu chí:** [x] người chốt im 4 phút → đúng 1 câu nhắc có tên; không câu mẫu nào chứa "chưa trả lời / chưa mở / chưa xác nhận"; [x] người có đơn gõ "ib" → thẻ qua bình luận mới, Director không nhận; [x] vào bằng m.me (người mới và người cũ) → nút Đúng / Không phải; bấm Đúng → đơn gắn đúng người.

#### F-71 Câu hỏi có ý mua → thẻ mời giữ một chạm — N · BH5 · P02
- Tách phần tìm số, màu, size của `docChot` thành `timMon`; câu hỏi ghi đủ số, màu, size → thẻ mời (ảnh đúng màu, "còn hàng" — chỉ ghi "còn N" khi N ≤ ngưỡng sắp hết, [Giữ cho mình] [Xem màu khác]).
- Chỉ gửi khi: còn hàng; chưa có đơn mở chứa phân loại đó; chưa nhận thẻ mời món này trong buổi; không có tin riêng tới người đó trong 5 phút; không vừa chốt món này trong 1 phút; còn lượt nhắn riêng. Không tự giữ hàng; bình luận vẫn tới Director.
- **Tiêu chí:** [x] 105 câu chốt cũ vẫn đúng 100%; ≥ 40 câu hỏi mua mới đúng; [x] bấm Giữ → đơn giữ 24 giờ; hàng vừa hết lúc bấm → câu báo hết + lựa chọn còn hàng.

#### F-72 Tách "Dừng AI" và "Dừng mọi thứ" — B · BH5 · P42 · #101
- Vượt trần → `dung_ai`: chặn mọi lần gọi AI tốn tiền (Agent, miệng, Đội AI, chép lời, đọc hộ chốt); chốt đơn bằng mã vẫn chạy. Khách gõ chữ lúc Dừng AI → Cần người + 1 câu báo nhận (≤ 1 lần / giờ).
- "Dừng mọi thứ" chỉ khi người bấm; đổi chữ "Dừng mọi tự động" → "Dừng mọi thứ".
- Dải vàng từ 80% trần; Dừng AI → dải đỏ "AI tạm dừng vì chạm trần — chốt đơn vẫn chạy" + nút "Chạy AI tiếp". Ô mới "Trần ngày có live (USD)", mặc định 20. Tự tắt khi hết lý do và không có phiên đang live.
- **Tiêu chí:** [x] vượt trần giữa live → Dừng AI bật, "Dừng mọi thứ" tắt; chốt vẫn có đơn và thẻ, 0 lượt AI; [x] người bấm "Dừng mọi thứ" → thẻ vào chờ duyệt; [x] hôm sau không live → tự tắt; đang live → không.

#### F-73 Page bị Meta tạm khóa nhắn tin + nhắn bù — N · BH5 · P04 · #102
- Lỗi khóa nhắn tin → dải đỏ đúng chữ kèm hướng dẫn xem Chất lượng Page; tự hỏi Page Integrity lúc mở phiên và mỗi giờ.
- Trong lúc bị khóa: dừng mọi tin chủ động; gom công khai bằng câu riêng (chỉ tên gọi, không mời "nhắn tin cho Page"); không gia hạn giữ.
- Bảng `nhan_bu`; màn Đơn hàng thẻ "Nhắn bù (N)": người bấm từng người / tất cả / bỏ; rải 3 tin / phút, gặp lại lỗi thì dừng; hạn 7 ngày tính từ lúc bình luận; đơn đã hủy → thẻ mời nếu còn hàng.
- **Tiêu chí:** [x] không còn chữ "Thiếu quyền" cho lỗi này; câu gom không có "nhắn tin cho Page"; [x] "Nhắn bù tất cả" → cách nhau ≥ 20 giây, bình luận quá 7 ngày không gửi.

#### F-74 Chống kẻ gian giả làm shop — B · BH5 · P43 · #105
- Bình luận của người không phải Page có số tài khoản (6–19 chữ số kèm "stk", "tk", "ck", "chuyển khoản", tên ngân hàng) hoặc link lạ → ẩn, không chuyển Tư vấn viên, báo người dẫn; bình luận bài đăng cũng vậy. Không trả lời công khai.
- Thẻ đơn và câu ghim có "Shop chỉ nhận tiền vào TK tên {ten_chu_tk} và chỉ gửi mã QR trong Messenger của Page" (chưa có tên thì "Shop không bao giờ xin chuyển khoản qua bình luận"). Ô mới "Tên chủ tài khoản nhận tiền".
- **Tiêu chí:** [x] ≥ 40 mẫu đúng; "chốt 12 đen M", "159k", "DH-0042", số điện thoại không bị nhãn này; [x] thẻ đơn 5 món vẫn ≤ 640 ký tự.

#### F-75 Nhãn "Trợ lý AI · Phụ trách", xưng hô, bố cục Thanh chữ — B (bắt buộc trước live thật) · BH5 · P35 · #103
- Nhãn nhỏ góc trên phải Thanh chữ và Màn hình sản phẩm: "Trợ lý AI · Phụ trách: {phu_trach}" (chưa điền: "Trợ lý AI của {ten_shop}"); hiện suốt khi có phiên mà AI không "Tắt"; không nút tắt.
- Cài đặt → Bán hàng thêm "Người phụ trách buổi live" và "Cách xưng hô" (chọn: mình – bạn (mặc định) · shop – chị · em – anh/chị · shop – bạn), dùng cho mọi câu mẫu.
- Câu mô tả buổi live ("Buổi live có sử dụng trợ lý AI …") có nút Chép ở bảng Sẵn sàng.
- **Bố cục Thanh chữ chung:** nhãn AI góc trên phải; bình chọn góc trên trái; "Tiếp theo" và dải đính chính ngay trên ô món; ô món có giá, số người chốt, dòng "Mẫu"; cảm ơn chạy ngang đáy.
- **Tiêu chí:** [x] ảnh chụp Thanh chữ có nhãn; [x] không API hay ô nào tắt được nhãn; [x] đổi người phụ trách → nhãn đổi trong ≤ 2 giây.

#### F-76 Giá gạch chỉ khi có bằng chứng — B · BH5 · P34a · #104
- `bangChungGiaGoc`: có đơn Đã giao (không diễn tập) với đơn giá bằng giá gốc trong 30 ngày. Không có → Màn hình sản phẩm không gạch giá, thẻ AI không có dòng "Giá gốc", màn Sản phẩm giải thích vì sao.
- **Tiêu chí:** [x] chưa có đơn giao → không giá gạch ở cả hai chỗ; đơn giao 10 ngày trước → có; 40 ngày → không; đơn diễn tập không tính.

#### F-77 Bảng "Sẵn sàng lên sóng" — B · BH5 · P07 · #106
- Thay khung "Kiểm tra trước khi live" + một dòng trên Tổng quan. Đỏ: "Dừng mọi thứ" bật (nút Tắt), Page bị hạn chế, mã Page hết hạn hoặc thiếu quyền, ứng dụng chưa duyệt. Vàng: Dừng AI hoặc chi phí ≥ 80%, webhook ngắt, phí ship trống, món trong kịch bản hết hàng / thiếu ảnh / ngừng bán / thiếu bảng size, chưa điền người phụ trách.
- "Chốt test": chủ shop bình luận "chốt test" → không tạo đơn, nhắn riêng một thẻ thử, bảng báo đã nhận và kết quả nhắn riêng.
- 3 ô tự tích theo buổi: đã tắt chế độ Thảo luận; đã tắt "Bình luận → tin nhắn" và Business AI; đã dán câu ghim. Câu ghim (cú pháp với ví dụ món đầu, "xem cả Tin nhắn chờ", dòng TK, link m.me) có nút Chép. Không khóa nút Bắt đầu; còn dòng đỏ thì hỏi lại một lần.
- **Tiêu chí:** [x] bật "Dừng mọi thứ" → dòng đỏ + nút Tắt; [x] "chốt test" → thẻ thử, kho và đơn không đổi; [x] câu ghim có ví dụ đúng, dòng TK, link m.me.

#### F-78 Quá 24 giờ: mở cuộc trò chuyện trong Meta Business Suite — N · BH5 · P05 bản nhỏ
- Hội thoại quá 24 giờ kể từ tin cuối của khách → Hộp thư ẩn ô gõ, hiện "Quá 24 giờ: trả lời bằng Meta Business Suite trên điện thoại" + nút mở đúng cuộc trò chuyện (lùi về hộp thư chung của Page). Không gửi gì ra Facebook.
- **Tiêu chí:** [x] chỉ hiện khi quá 24 giờ; bấm không gửi lệnh nào ra Facebook.

### Đợt cải tiến — BH6 "Trên sóng"

#### F-79 Danh sách từ cấm K11 — B · BH6 · P34 · #107
- `server/cau-hinh/tu-cam.json`: thương hiệu ("dáng Zara", "auth", "hàng hiệu", "rep 1:1"…), tuyệt đối ("số 1" trừ cách gọi món, "tốt nhất", "rẻ nhất", "duy nhất"…), so sánh ("shop khác", "rẻ hơn chỗ khác"…) luôn chặn; xuất xứ ("hàng xuất khẩu", "VNXK", "Quảng Châu loại 1"…), công dụng ("kháng khuẩn", "chống nắng"…) chặn trừ khi cụm nằm nguyên văn ở ô đã xác nhận hoặc Sổ tay. So bỏ dấu, nguyên từ; lỗi kèm cách sửa.
- Đội AI bỏ lượt thoại có từ cấm; lưu sản phẩm có từ cấm → cảnh báo vàng. Mọi câu mẫu, Skill, lời dặn mẫu (cả của BH5) qua K11.
- **Tiêu chí:** [x] ≥ 40 ca đúng 100%, "áo số 1 màu đen" đạt; [x] 78 ca K1–K10 cũ vẫn đạt.

#### F-80 Nhật ký buổi live + luật "Mai không tự nói con số" — B · BH6 · P15 phần rẻ · #108
- `nhat_ky_song` chỉ chữ: lời Mai (theo câu), lời Đội AI, lời người dẫn, màn hình / cảnh, sự kiện; đọc gộp thêm câu Co-host và bình luận chốt gắn đơn. Báo cáo → buổi → "Nhật ký" có ô tìm chữ. Giữ 90 ngày; bình luận không gắn đơn cùng hạn (xóa nội dung và tên, giữ số đếm).
- Soát sau buổi bằng mã (`server/agent/kiem-tra/kiem-so-noi.js`): câu của Mai có số tiền lạ → "⚠ số cần xem lại"; có từ cấm → "⚠ từ cấm". Chỉ đánh dấu.
- Lời dặn miệng: giá, số còn, phí ship, số đo chỉ đọc nguyên văn "câu số" MOZA đưa hoặc kết quả công cụ; lời giao đoạn có dòng "Câu giá (đọc đúng nguyên văn)".
- **Tiêu chí:** [x] buổi tập miệng giả có đủ loại dòng, đúng thứ tự; tìm "150k" ra đúng câu; [x] Mai giả nói "150 nghìn" khi giá 159.000đ → gắn ⚠; [x] dòng quá 90 ngày bị xóa.

#### F-81 Thẻ nhắc khi khách xin xem + video dựng thử — B · BH6 · P11 · #109
- Nhãn `muon_xem` (mặt sau · cận vải · toàn thân · màu khác) bằng từ khóa; bình luận vẫn tới Director. `server/the-nhac.js`: gom 60 giây, 1 thẻ chữ to + hàng chờ 3, tự tắt 60 giây, nút "Đã làm"; màu khác / cận vải có nút chiếu ảnh hoặc video quay thật. Đội AI "Hằng muốn xem mặt sau nè" ≤ 1 câu / 2 phút mỗi loại.
- Video có cờ `dung_thu`; buổi thật không chiếu video dựng thử; buổi tập chiếu kèm nhãn; nút "Đây là video quay thật".
- **Tiêu chí:** [x] ≥ 60 câu đúng 100%; [x] 3 người xin xoay lưng trong 40 giây → 1 thẻ 3 tên; [x] phiên thật không chiếu video dựng thử.

#### F-82 Tư vấn size gọi đúng tên + số đo người mẫu bằng lời — B · BH6 · P13 · #110
- Một hàm đọc số đo dùng chung; dò bảng size trả mọi dòng khớp (bỏ nhánh chỉ theo cân nặng). Khớp 1 dòng → "{ten} ơi, theo bảng size của shop thì lấy M"; 2 dòng liền nhau → nói cả hai kèm độ ôm; không khớp hoặc chưa có bảng size → Director như cũ. Gom 20 giây ≤ 3 tên; xưng hô theo Cài đặt; câu không bao giờ có số đo của khách.
- "Mai ơi mẫu cao 1m60 (nặng 48) mặc S" → nguồn "người mẫu" cho Bộ kiểm tra; Thanh chữ dòng "Mẫu: 1m60 · mặc S" (cân nặng chỉ khi người dẫn nói). Màn hình sản phẩm bỏ dòng in số đo khách, tô mọi dòng khớp.
- **Tiêu chí:** [x] ≥ 50 câu số đo đúng, không nhầm "chốt 12 đen M x2", "150k"; [x] "1m61 54kg" → câu nằm giữa M và L; [x] câu tư vấn không chứa số đo khách.

#### F-83 Số người chốt, cảm ơn cuối buổi, sửa ngưỡng "còn ít" — N · BH6 · P14 bước 1 · #111
- Đếm người khác nhau có đơn từ bình luận của phiên, trừ hủy, tách buổi tập; Thanh chữ "14 người chốt buổi này" từ 5 người; Đội AI đọc ở mốc 5 / 10 / 20 / 50.
- Dòng cảm ơn 45 giây (≤ 40 tên gọi, không món, không tiền): nút 🙏, "Mai ơi cảm ơn cả nhà", lúc chào kết. Người ẩn tên hiện "Một bạn" ở mọi chỗ.
- Sửa số 5 viết cứng ở Màn hình sản phẩm theo ngưỡng sắp hết trong Cài đặt.
- **Tiêu chí:** [x] 6 người (1 người chốt 2 lần) → "6 người chốt"; 1 đơn hủy → giảm; buổi tập không cộng vào buổi thật; [x] ngưỡng 3: còn 4 không hiện, còn 3 hiện.

#### F-84 Gỡ lưỡng lự bằng bằng chứng thật — N · BH6 · P12
- Director gắn ô `luong_lu` (không vừa · chất liệu · khác ảnh · giá · ship · để suy nghĩ). ≥ 2 người cùng kiểu, cùng món trong 5 phút, chưa gỡ trong 10 phút → giao Co-host Skill mới `go-luong-lu`; không có nguồn thật (bảng size, Sổ tay đổi trả, người mẫu, video quay thật) → chỉ thẻ nhắc người dẫn.
- Skill: trích đúng nguồn; cấm giảm giá, quà, so với shop hay thương hiệu khác; được nói nhược điểm có thật; ≤ 3 câu. Skill mẫu mới được chèn vào dữ liệu đang chạy.
- **Tiêu chí:** [x] 2 người "sợ không vừa" + Sổ tay có câu đổi size → Co-host trích Sổ tay, chiếu bảng size; [x] 1 người hoặc không nguồn → không giao; [x] câu có giảm giá hoặc so sánh bị chặn.

#### F-85 Dòng số liệu, "Tiếp theo", một gợi ý nhịp — N · BH6 · P16
- Màn hình người dẫn: "23 người chốt · 17 đã trả lời tin · 9 đã xác nhận · 140 người xem" (10 giây một lần; không có số người xem thì ẩn).
- Thanh chữ "Tiếp theo: váy số 15" sau 60 giây ở đoạn hiện tại; Đội AI câu "món sau" 1 lần mỗi đoạn.
- Chỉ gợi ý / Mai nói: tối đa 1 gợi ý / 3 phút ở ô gợi ý chung (món nóng: nói thêm một vòng; món nguội: sang món tiếp?). Máy không tự chuyển món, không nói "sắp hết" theo nhịp chốt.
- **Tiêu chí:** [x] số liệu khớp đếm trực tiếp, trừ hủy; [x] món nguội → 1 gợi ý; Đội AI dẫn → không gợi ý.

#### F-86 Bình chọn bằng bình luận, không quà — N · BH6 · P17 cách A · #111
- Nút "🗳 Bình chọn" (chọn 2–3 màu của món đang nói) hoặc "Mai ơi bình chọn be hay đen"; 60 giây; ≤ 2 lần / buổi; mỗi người 1 phiếu (phiếu sau cùng). Phiếu không vào Director, không bị đọc thành chốt.
- Kết quả → thẻ nhắc ưu tiên cao nhất "Be thắng — mặc Be cho cả nhà xem ngay", chiếu ảnh màu thắng; câu kết không đọc số phiếu. Không quà.
- **Tiêu chí:** [x] "chốt 12 đen M" giữa lúc bình chọn vẫn thành đơn, không tính phiếu; [x] lần thứ 3 bị từ chối; [x] hòa → "người dẫn chọn".

#### F-87 Từ riêng cho phần nghe người dẫn — N · BH6 · P44
- Danh sách ≤ 100 từ theo ưu tiên: lệnh ("Mai ơi", "mẫu cao", "chiếu", "bình chọn", "cảm ơn"…) → tên AI, tên shop → cách gọi món trong phiên → màu, cỡ → tên gọi khác → món khác; lọc ký tự cấm; lấy lại khi xoay phiên. Miệng Gemini 3.8 Live nhận nếu tài liệu cho phép; GPT Live 1 không có chỗ nạp.
- Giá `gemini-3.5-transcribe-live` 3,5 / 21 đúng bản Live (tra 27/9/2026), không sửa.
- **Tiêu chí:** [x] ≤ 100 từ, món trong phiên luôn có; [x] không từ nào chứa `<`, `>`, xuống dòng.

### Đợt cải tiến — BH7 "Khép kín đơn"

#### F-88 Messenger một chạm, menu cố định, xóa dữ liệu — B · BH7 · P19, P10 · #118
- Tin xin thông tin giao do mã soạn ("… shop dùng số này chỉ để giao đơn") + [📞 Gọi shop] (khi số shop hợp lệ) + trả lời nhanh: số điện thoại Messenger tự điền, [Như đơn trước] (đơn Đã gửi / Đã giao gần nhất, không lấy đơn hoàn), [Dùng số 0912***678] (số khách lỡ ghi ở bình luận chốt, lưu tạm cho đúng đơn, xóa khi đơn xong; không tự điền — giữ #19). Chỉ trong 24 giờ.
- Menu cố định: Đơn của tôi · Gặp người thật · Xóa dữ liệu của tôi — xử lý bằng mã, 0 AI.
- Xóa dữ liệu: bước xác nhận → báo đã nhận ngay, việc "Xóa dữ liệu" hạn 72 giờ + Cần người; xóa được người chỉ có tài khoản Facebook; còn đơn chưa xong thì xong hoặc hủy trước (như F-54).
- **Tiêu chí:** [x] khách chọn số → đơn có số, 0 AI; [x] nút mang đơn của người khác → không ghi gì; [x] xóa dữ liệu → có việc hạn 72 giờ, dữ liệu chưa tự xóa.

#### F-89 Thẻ đơn chọn cách trả + mã QR chuyển khoản — B · BH7 · P21 bước 1 · #112
- Đủ thông tin ngân hàng → thẻ đơn [✅ Nhận hàng trả tiền] [💳 Chuyển khoản] [✏️ Sửa đơn] (thiếu thì 2 nút như #89). Chuyển khoản → đơn Đã xác nhận; ảnh VietQR (số tiền = tổng đơn, nội dung DH0042, chờ ≤ 5 giây, lỗi thì chỉ tin chữ) + tin chữ có dòng chống giả shop + [🔁 Trả khi nhận hàng]. Khách từng hoàn ≥ ngưỡng → không gửi QR, việc gọi xác nhận.
- Người tự bấm "Đã nhận tiền"; trong 24 giờ MOZA báo khách bằng câu mẫu (AI không bao giờ nói). Không lưu gì của người chuyển. Tổng quan "Chuyển khoản chờ đối chiếu: N".
- Cài đặt → Bán hàng thêm "Ngân hàng" (chọn từ danh sách) và "Số tài khoản" (tên chủ TK dùng ô của F-74). Tư vấn viên có công cụ `gui_ma_chuyen_khoan`. Bỏ chữ "nhé" ở dòng cuối thẻ đơn.
- **Tiêu chí:** [x] địa chỉ ảnh QR chỉ có dữ liệu của shop; [x] dịch vụ QR treo 6 giây → chỉ tin chữ, đơn vẫn Đã xác nhận; [x] tiêu đề nút ≤ 20 ký tự.

#### F-90 Miễn ship, món phối, gộp / tách đơn giữa hai buổi — N · BH7 · P23 · #113
- Thẻ đơn đủ thông tin: "Thêm 41.000đ nữa là miễn ship" do mã tính (không vào tin Utility); 1 món phối còn hàng qua trả lời nhanh, mỗi người 1 lần / 24 giờ.
- Đơn Đã xác nhận bị đổi món (khách, AI, gộp) → về Chờ xác nhận, thẻ mới (#113).
- Chốt ở buổi mới mà còn đơn mở chưa gửi → vẫn giữ hàng vào đơn mới, lần tương tác đầu hỏi [🔗 Gộp] [Tách riêng] (không bấm = tách); gộp trong một giao dịch.
- Sổ tay hiện dòng miễn ship tự sinh (chỉ đọc) + câu cho phần Giới thiệu Page có nút Chép.
- **Tiêu chí:** [x] 159.000đ, ship 10.000đ, miễn từ 200.000đ → "Thêm 41.000đ"; [x] gộp → 1 đơn đủ dòng, đối chiếu kho rỗng; [x] AI thêm món vào đơn đã xác nhận → về Chờ xác nhận.

#### F-91 Khách quen, size quen; số đo khi khách đồng ý — N · BH7 · P20 · #114
- Tóm tắt mua chỉ từ lịch sử đơn: số đơn Đã giao không hoàn, size quen theo danh mục. Nhãn "khách quen · hay mặc M" chỉ ở Màn hình người dẫn, Hộp thư, Khách hàng. Thẻ thiếu size có [Lấy M như lần trước] nếu còn hàng.
- K11 cấm trên sóng và công khai: "khách quen", "quay lại rồi", "lần trước … mua".
- Công tắc "Hỏi khách lưu chiều cao, cân nặng" **tắt mặc định**: hỏi 1 lần, chỉ lưu khi bấm [Lưu giúp mình]; "xóa số đo", menu Xóa dữ liệu, nút ở màn Khách hàng đều xóa.
- **Tiêu chí:** [x] 3 đơn áo giao (M, M, L) + 1 hoàn (S) → size quen M; [x] câu trên sóng có "khách quen" bị chặn; [x] công tắc tắt → không hỏi.

#### F-92 Danh sách chờ khi hết hàng — N · BH7 · P24 bước 2
- Thẻ hết hàng có [🙋 Vẫn chờ] (bắt buộc bấm); chờ theo giờ bấm, ≤ 30 người mỗi phân loại, hết hạn sau 24 giờ.
- Hàng được trả (hủy, bớt, đổi, nhập, nhận hoàn) → trong cùng giao dịch tạo đơn giữ 30 phút cho người chờ đầu, rồi gửi thẻ mời; không bấm thì nhường người sau. Không cắt suất đơn đang giữ.
- **Tiêu chí:** [x] A Không lấy → B có đơn và thẻ mời; B im 30 phút → C được mời; [x] nhường suất song song với chốt mới → không bán quá.

#### F-93 Giá live tới hết buổi — S (tắt mặc định) · BH7 · P18 (6.1 B) · #115
- Công tắc "Giá live" tắt mặc định. Bật: ở Chuẩn bị, mỗi món chọn [Không] [−5%] [−10%] [−15%] (mã tính, làm tròn xuống 1.000đ) hoặc gõ số; khóa khi live bắt đầu.
- Áp cho bình luận chốt trong buổi (tới hết live + 15 giây độ trễ phát), chụp vào dòng đơn cùng giá thường; phân loại giá riêng giữ giá riêng; đơn Messenger, xem lại, món thêm sau live: giá thường. **Một hàm "giá bán lúc này"** dùng chung cho giữ hàng, thẻ đơn, Bộ kiểm tra, kiểm lời Mai.
- "Giá live 259.000đ · tới hết buổi"; giá thường gạch chỉ khi có bằng chứng (F-76); thẻ đơn ghi "(giá live)"; K11 cấm "chỉ hôm nay", "lần cuối", "giờ vàng".
- **Tiêu chí:** [x] tắt → không có ô, luôn giá thường; [x] bật: chốt trong buổi 259.000đ, sau hết live + 15 giây 299.000đ; [x] đặt giá khi đang live → `GIA_LIVE_DA_KHOA`.

#### F-94 Bán sau live + bình luận mục lục — N · BH7 · P03 · #116
- Bình luận bài của live đã xong ≤ 7 ngày (webhook, và tự hỏi lúc khởi động + 10 phút một lần) → chỉ nhận chốt có số món (thiếu thì thẻ hỏi món), không đọc tên trên sóng, giá hiện tại (buổi có giá live thì ghi "giá live đã kết thúc lúc …"), gộp vào đơn mở của buổi đó. Không phải chốt → Tư vấn viên như bình luận bài đăng. Quá 7 ngày: bỏ.
- 2 phút sau live thật, Page bình luận mục lục (phút từng món, cú pháp chốt; không giá, không tên khách); không có giờ Facebook thì không đăng; đăng 1 lần; "Dừng mọi thứ" chặn. Báo cáo "Chốt sau live: N đơn".
- **Tiêu chí:** [x] bình luận 2 ngày sau → 1 đơn giá thường, 1 thẻ, không đọc tên; cùng bình luận về hai đường → 1 đơn; [x] 8 ngày → bỏ; [x] mục lục đúng phút, không giá, không tên.

### Đợt cải tiến — BH8 "Trước live và sau mua"

#### F-95 Điền nốt thông tin shop bằng lời; Tổng quan kiểm 8 mục — N · BH8 · P31 · #119
- Tổng quan chỉ liệt kê mục còn thiếu: phí ship · mức miễn ship (hoặc "không miễn ship") · giờ giữ · chính sách đổi size · tài khoản nhận tiền · giờ nghe máy (ô mới, chọn từ danh sách) · cách xưng hô · thông tin người bán. Đủ thì ẩn.
- "Nói với Mai" có 2 công cụ ghi Cài đặt → Bán hàng và Sổ tay, luôn qua bảng xem trước + "Làm"; số phải có trong câu người nói; không sửa giá, không xóa mục Sổ tay.
- Khóa ngắn `doi_tra_ngan` ("Đổi size trong 3 ngày"): một dòng cố định trên Thanh chữ và trong thẻ đơn khi còn chỗ.
- **Tiêu chí:** [x] "phí ship 10 nghìn, trên 200 nghìn miễn ship" → bảng xem trước 2 dòng, chỉ ghi sau Làm; [x] AI tự thêm số không có trong câu → lỗi.

#### F-96 Lịch live cố định + bộ bài báo trước — N · BH8 · P09 bước 1 · #117
- Cài đặt "Lịch live" (tích thứ, chọn giờ), "Dời / Hủy buổi này"; AI trích được dòng lịch.
- "✨ AI soạn" (agent mới `soan_bai`, `gpt-6-luna`): mô tả Sự kiện live, bài nhá hàng (mời "bình luận món muốn xem kèm size"), 3 câu Reels; ngày giờ, số món, cú pháp do máy điền; chỉ ô đã xác nhận; qua Bộ kiểm tra + K11, cấm số còn, "giảm", "sale", "chỉ hôm nay". Nút Chép, ảnh ghép 2×2. MOZA không đăng.
- Máy điền: "Chép lời mời + link live" cho nhóm Zalo, bài dời buổi, nhắc 2 lựa chọn quảng cáo (chủ shop tự quyết).
- **Tiêu chí:** [x] T3, T5 20:00 → buổi kế đúng qua nửa đêm; [x] bài dùng ô "AI đoán" hoặc "giảm 50%" bị trả lại.

#### F-97 Báo live cho người đã đồng ý — N · BH8 · P10 (6.3 A+B) · #117
- Chỉ mời khi buổi kế trong 23 giờ tới, ở 3 chỗ: bình luận "hóng" dưới bài đăng thường; khách hỏi lịch trong Messenger; sau khi khách xác nhận đơn. [Báo em buổi này] [Thôi].
- Bảng `dong_y_nhan_tin` lưu nguyên văn câu hỏi, giờ bấm. Live bắt đầu khớp buổi → mỗi người 1 tin có link + "Gõ DỪNG để không nhận tin nhắc", chỉ khi còn trong 24 giờ kể từ lúc bấm, rải ≤ 20 tin / phút. [Thôi] → không mời lại 7 ngày. DỪNG rút mọi đồng ý; xóa dữ liệu xóa bản ghi đồng ý.
- **Tiêu chí:** [x] bấm lúc T, live lúc T + 25 giờ → không gửi; [x] bình luận của live không bao giờ nhận lời mời; [x] 30 người → ≤ 20 tin / phút.

#### F-98 Bộ mẫu Utility trạng thái đơn, tin trạng thái do máy soạn — N · BH8 · P25 phần không cần hãng · #120
- "Tạo bộ mẫu tin" có thêm: đã xác nhận, chuẩn bị gửi, hỏi mặc; bảng trạng thái từng mẫu; mẫu không phải UTILITY thì không dùng.
- Tin "đã gửi" trong 24 giờ thành câu mẫu (nay còn gọi Tư vấn viên); thêm tin "đã xác nhận" khi người xác nhận trên màn Đơn hàng.
- **Tiêu chí:** [x] báo đã gửi trong 24 giờ → câu mẫu, không lượt AI; [x] mẫu bị xếp Tiếp thị → không gửi.

#### F-99 Hỏi lại đơn trước khi gửi — N · BH8 · P26 · #120
- "Nên hỏi lại" chỉ từ lịch sử đơn của shop: khách mới + COD chưa nhận tiền + tổng ≥ ngưỡng (ô mới, mặc định 500.000đ), hoặc từng hoàn 1 đơn (dưới ngưỡng #73). Sau khi Đã xác nhận ≥ 2 giờ, 8h–21h: "Shop chuẩn bị gửi đơn …, {xung} nhận trong tuần này được không?" [Gửi đi] [Hẹn ngày khác]. Không trả lời 24 giờ → việc gọi. Không tự hủy, không từ chối COD, không khóa in phiếu, không xin cọc.
- **Tiêu chí:** [x] khách mới COD 650.000đ → có nhãn và thẻ; khách đã có đơn giao → không; [x] không tin nào gửi khách có chữ "rủi ro".

#### F-100 Hỏi thăm sau khi gửi + "X/Y khách nói vừa" — N · BH8 · P27, P14 bước 2 · #120
- Sau khi gửi N ngày (chọn 2–7, mặc định 4), 10h–20h: "… mặc thấy sao {xung}?" [Vừa lắm] [Hơi chật] [Hơi rộng]. Không mời mua thêm, không quà. Chật / rộng → câu mẫu + trích Sổ tay "Đổi trả" + việc "Đổi size" hạn 24 giờ. Không hỏi một người 2 lần trong 14 ngày.
- Từ 10 phản hồi thật của một mẫu: Thanh chữ được hiện "X/Y khách nói vừa" (có cả số không vừa).
- **Tiêu chí:** [x] tua 96 giờ → thẻ 3 nút; 72 giờ → chưa; [x] Hơi chật → có câu đổi size của Sổ tay, có việc, 0 AI.

#### F-101 Xuất file đúng mẫu nhập đơn của hãng — N · BH8 · P29 (6.4 B) · #121
- Ô chọn "Hãng vận chuyển đang dùng" (Chung · GHTK · GHN · Viettel Post · J&T); mẫu cột trong `mau-xuat-van-chuyen.json` (ghi nguồn, ngày tra). Thu hộ = tổng đơn nếu COD chưa nhận tiền, 0 nếu đã nhận; khối lượng theo phân loại (thiếu thì 300 g có cờ); không ghi chú nội bộ. Tách tỉnh theo danh mục 34 tỉnh, không chắc thì cột "Cần sửa địa chỉ" — không tự sửa địa chỉ. Hãng chỉ nhận Excel thì bộ ghi tối giản bằng `node:zlib`, không thêm thư viện.
- **Tiêu chí:** [x] "Chung" y hệt file hiện nay; [ ] mỗi hãng khớp tệp mẫu chuẩn (chờ chủ dự án đưa file mẫu của hãng — tạm dùng "Nhập hàng loạt"); [x] đơn đã nhận tiền → thu hộ 0.

#### F-102 Tổng kết sau live — N · BH8 · P32
- Phễu do mã đếm (người chốt → trả lời tin → xác nhận → gửi → giao → hoàn; tách hủy quá giờ và khách hủy), món chạy, món hỏi nhiều ít chốt, câu hỏi chưa trả lời, chi phí AI; so 5 buổi trước khi đủ 5 buổi thật. Chỉ buổi thật.
- Agent `tong_ket` (`gpt-6-luna`) chỉ nhận số liệu gộp, ≤ 3 gợi ý, mọi con số phải có trong đầu vào; chỉ khi ≥ 5 người chốt.
- **Tiêu chí:** [x] số khớp đếm trực tiếp; [x] dữ liệu gửi AI không có tên, số, bình luận.

#### F-103 Mốc từng món trong video — S · BH8 · P08 bản đơn giản
- Mỗi món: giây bắt đầu, kết thúc (theo giờ Facebook; thiếu thì ghi "±30 giây"), số người chốt; đoạn 45 giây không có tên khách; chú thích máy điền (không giá, có cú pháp chốt, lịch kế, "Có giọng trợ lý AI" khi có); nhắc "Hoãn xóa 6 tháng", giấy đồng ý người mẫu, nhãn AI khi đăng. MOZA không cắt, không đăng.
- **Tiêu chí:** [x] mốc đúng tới giây; đoạn gợi ý không chạm vùng có tên; chú thích không có số tiền.

#### F-104 Khách mặc thật — S (tắt mặc định) · BH8 · P28 · #122
- Bật sau khi chuyên gia xem (#127): khách tự gửi ảnh trong 30 ngày sau đơn → xin phép bằng nút, lưu nguyên văn; tải ảnh về ngay; che mặt mặc định, người duyệt; Màn hình sản phẩm mẫu "Khách mặc thật" ≤ 4 ảnh; "gỡ ảnh" gỡ ngay. Không gửi ảnh khách cho AI, không kèm số đo.
- **Tiêu chí:** [x] tắt → không xin phép, không lưu; [x] ảnh chưa duyệt không lên màn hình; [x] không lời gọi AI nào có ảnh khách.

### Đợt cải tiến — BH9 "Thử nghiệm AI" (báo chi phí trước khi chạy thật)

#### F-105 Kiểm lời Mai trên sóng và tự đính chính — N · BH9 · P15 bản đầy đủ (A.5) · #123
- Dùng chữ chép tiếng ra có sẵn (0 đồng); bật cửa hook "Trước khi phát" đang để dành, hook `kiem-loi-noi` (tắt được), mã `MIENG_NOI_SAI`. Mở rộng `kiem-so-noi.js`: so số tiền với "giá bán lúc này" (bội số ≤ 5, cộng ship, phí ship, mức miễn ship, giá gốc hợp lệ, giá live), "còn N" theo K9; chỉ xét số đã trọn.
- Chắc sai → bỏ phần tiếng còn lại, Thanh chữ dải đính chính 12 giây, Mai nói câu mẫu "Mai xin nói lại cho đúng…", băng đỏ cho người dẫn; nghi sai → băng vàng. Đính chính sai tiếp hoặc 3 lỗi / buổi → về "Chỉ gợi ý". Miệng giả chỉ cho buổi tập.
- **Tiêu chí:** [x] ≥ 60 câu mẫu: bắt đúng 100% câu sai có món rõ, 0 câu đúng bị báo; [x] miệng giả: câu sai → đủ sự kiện đính chính trong 3 giây; [ ] phép thử thật (sau khi duyệt chi phí) ghi số liệu vào mục 12 — **chờ chủ dự án duyệt + dán khóa**.

#### F-106 Đơn chốt lúc Mai nói nhầm giá: giữ giá có lợi cho khách — N · BH9 · P15 · #123
- Lỗi chắc có lợi cho khách mở "khoảng nói nhầm" (tới lúc đính chính + độ trễ phát + 60 giây). Ô chọn "Khi Mai lỡ nói giá thấp hơn": "Bán theo giá Mai nói" (mặc định; chỉ hạ, chỉ dòng món bị nói sai, có lịch sử và nút "Giữ giá đúng") hoặc "Chủ shop quyết từng đơn". Đơn đã gửi không đổi; luôn tạo việc cho chủ shop.
- **Tiêu chí:** [x] chỉ đơn trong khoảng bị hạ, tổng tiền luôn đúng; [x] chốt trong khoảng → tin đầu đã mang giá hạ.

#### F-107 MOZA nhìn qua OBS, gợi ý chuyển món — S (tắt mặc định) · BH9 · P38 · #124
- Nút "MOZA nhìn" theo buổi. Chỉ lấy nguồn camera (không cảnh đang phát, không Thanh chữ); so ảnh nhỏ bằng mã mỗi 2,5 giây; hình đổi rồi đứng yên mới hỏi agent `nhin_mon` (`gpt-6-luna`) với bảng mẫu ≤ 10 món; ≤ 1 lần / 5 giây, ≤ 600 lần / giờ.
- Chỉ gợi ý "Đang cầm áo 7? [Chuyển]" khi chắc cao 2 lần liền; bấm mới đổi đoạn. Không lưu ảnh, không nhận diện mặt. Thay F-64.
- **Tiêu chí:** [x] hình không đổi → không gọi AI; [x] AI giả chắc cao nhưng không ai bấm → đoạn không đổi; [ ] phép thử khung dựng sẵn: đúng ≥ 80%, "chắc mà sai" ≤ 1/20 — không đạt thì giữ tắt (52 khung đã dựng; **chờ duyệt chi phí + khóa**).

### Đợt nâng cấp 3.10 — BH10 "Sẵn sàng live thật" (#128 → #137)

Nguồn và lý do: `docs/09-nghien-cuu-nang-cap-2026-10-27.md`. Đầu mốc tra lại tài liệu chính thức (OpenAI Realtime / Decisions / GPT-Live,
ElevenLabs) — khác ghi chép ngày 27/10/2026 thì dừng, báo chủ dự án.

#### F-108 Máy đọc giọng mới: OpenAI chính, thêm ElevenLabs — B · BH10 · #130
- Thay `gpt-4o-mini-tts` (tắt 6/1/2027) ở mọi chỗ đang đọc: câu chen Đội AI, Radio, người dẫn giả Phòng diễn tập, nghe thử giọng
  (`server/agent/nha-cung-cap/tts.js`, `server/giong.js`, `server/doi-ai/phong-thu.js`).
- Nhà `openai` (mặc định): `gpt-realtime-2.1-mini` qua Realtime API — mở phiên với giọng của nhân vật, lời dặn "đọc nguyên văn, không
  thêm bớt", gửi chữ, nhận tiếng PCM. Giữ phiên cho cả buổi khi được (rẻ, nhanh), mở lại khi rớt. Mỗi nhân vật Đội AI một giọng như
  bảng giọng hiện có (Mai = marin).
- Nhà `elevenlabs` (thêm): `eleven_v4_turbo` cho câu chen, `eleven_v4` đọc hội thoại nhiều giọng một lần; giọng tiếng Việt chọn từ thư
  viện ElevenLabs ở Cài đặt → Giọng. Khóa dán ở Cài đặt → Khóa AI (`ELEVENLABS_API_KEY`).
- **Kiểm đọc nguyên văn:** lấy chữ chép tiếng ra của máy đọc so với câu gốc — số (giá, số còn, cỡ) lệch thì bỏ tiếng, hiện chữ, ghi lỗi
  (dùng lại phần so số của `kiem-so-noi.js`). ElevenLabs đọc thẳng chữ nên không cần bước này.
- Lỗi / thiếu khóa → hiện chữ như khi chạm trần; không tự chuyển sang nhà khác đắt hơn. Bảng giá theo ký tự (ElevenLabs) và theo token
  tiếng (OpenAI) vào `gia-model.json`, cộng vào mức trần như cũ.
- **Tiêu chí:** [ ] máy đọc giả đủ hai nhà, test chạy không khóa; [ ] câu đọc chệch số → bỏ tiếng, hiện chữ; [ ] không còn chỗ nào gọi
  `gpt-4o-mini-tts`; [ ] phép thử nghe thật (≤ 0,05 USD mỗi nhà, sau khi duyệt #135): 20 câu có giá, cỡ, tên món — Claude Code đối chiếu
  chữ chép lại, chủ dự án nghe 5 câu chọn nhà mặc định.

#### F-109 Mai tự nhận là trợ lý AI bằng lời — B · BH10 · #131
- Câu mẫu máy soạn (không qua AI): khi mở buổi và mỗi 15 phút, ở Mai nói cùng / Mai dẫn chính (miệng nói câu đọc giúp) và Chỉ gợi ý (máy
  đọc nói, hoặc hiện ô nhắc người dẫn tự nói nếu tắt giọng). Đội AI giữ câu "người mới vào", thêm nhịp 15 phút nếu 15 phút chưa có câu tự
  nhận.
- Câu ở `doi-ai-cau-mau.json` / `cau-mau-khach.json`, nhiều biến thể để không lặp; qua test K11. Không nói chen khi đang đọc tên người chốt.
- **Tiêu chí:** [ ] buổi tập 31 phút (tua giờ) → đúng 3 lần tự nhận ở mỗi chế độ; [ ] Dừng AI / tắt giọng → hiện ô nhắc người dẫn.

#### F-110 Dòng kiểm Meta Business AI trên bảng Sẵn sàng — B · BH10 · #137
- Bảng Sẵn sàng **đã có ô tích tay** "Đã tắt Bình luận → tin nhắn tự động và Business AI" (thấy khi chấm giao diện 27/10/2026) → F-110
  chỉ thêm phần máy tự kiểm và tách thành dòng riêng ở `server/san-sang.js`: "Trợ lý AI của Facebook đã tắt, MOZA là bên trả lời chính". Đầu mốc tra Graph API (Handover Protocol /
  Conversation Routing): đọc được ứng dụng trả lời chính của Page → máy tự báo xanh / đỏ; không đọc được → ô người tự đánh dấu "Đã tắt"
  (nhớ 7 ngày rồi hỏi lại), kèm hướng dẫn bấm trong Meta Business Suite.
- Đỏ / chưa đánh dấu → vàng (không chặn live). Facebook giả thêm hành vi "Business AI đang bật" (H25) để test.
- **Tiêu chí:** [ ] Facebook giả bật Business AI → dòng đỏ có hướng dẫn; [ ] đánh dấu → xanh 7 ngày.

#### F-111 Bảng model, giá và ngày tắt — B · BH10 · #136
- `gia-model.json`: thêm `gpt-6.1-sol` (2 / 10), `gpt-6.1-terra` (1 / 5), `gpt-realtime-2.1-mini`, `claude-sonnet-5-5` (2 / 10),
  `claude-haiku-5-5` (0,10 / 0,50), ElevenLabs v4 / v4 Turbo; mỗi model thêm ô `tat_ngay` (ví dụ `gpt-4o-mini-tts` 2027-01-06,
  `gpt-live-transcribe` không). Ô chọn model ở Cài đặt → Agent có các model mới.
- Bảng Sẵn sàng và trang Cài đặt báo vàng khi model đang dùng tắt trong 30 ngày, đỏ khi đã tắt.
- **Tiêu chí:** [ ] tua ngày tới 10/12/2026 → báo vàng `gpt-4o-mini-tts` nếu còn dùng; [ ] giá khớp trang giá chính thức ngày tra.

### Đợt nâng cấp 3.10 — BH11 "Mai thông minh hơn"

#### F-112 Mai làm việc trong lúc nói (GPT-Live + Decisions) — N · BH11 · #133
- Dùng đường nối GPT-Live ↔ Decisions (OpenAI 15/10/2026) cho các việc chọn trong danh sách đóng mà Mai đang làm bằng công cụ: chuyển
  đoạn / món đang giới thiệu, bật thẻ sản phẩm trên Màn hình sản phẩm, đổi cảnh OBS, tra còn hàng của một phân loại.
- Danh sách lựa chọn do máy dựng từ kịch bản buổi + món đang bán; kết quả vẫn qua mã kiểm như công cụ hiện tại. Chế độ "Chỉ gợi ý" giữ
  nguyên: không tự chuyển món.
- Đầu mốc đọc tài liệu Decisions-voice; nếu không nhanh hơn rõ (đo trên miệng giả + 1 phút thật) thì giữ cách hiện tại, ghi lý do.
- **Tiêu chí:** [x] miệng giả: câu "giờ mình xem áo số 15" → thẻ đổi ≤ 1 giây (xem thử 0,6 giây); [x] lựa chọn ngoài danh sách → bỏ. Thử thật 1 lần
  (6 giây phiên): chạy được — kết quả ở mục 12.

#### F-113 MOZA nhìn bằng Decisions — N (tắt mặc định) · BH11 · #133
- Agent `nhin_mon` đổi từ Responses sang Decisions: ảnh camera nhỏ + danh sách ≤ 10 món + "không rõ" → một lựa chọn. Giữ hết luật
  F-107 (chỉ nguồn camera, chỉ gợi ý, 2 lần liền, không lưu ảnh, tắt mặc định).
- **Tiêu chí:** [x] test bằng Decisions giả; [x] phép thử 52 khung có sẵn (≤ 0,02 USD): đúng ≥ 80%, "chắc mà sai" ≤ 1/20, ghi tốc độ
  và chi phí so với cách cũ.

#### F-114 Giọng riêng của shop cho Mai (prompt-to-voice) — N · BH11
- Cài đặt → Giọng Mai: gõ mô tả ("giọng nữ miền Bắc, ấm, nói nhanh vừa"), nghe thử một câu bán hàng, lưu. Dùng cho miệng GPT-Live (và
  máy đọc OpenAI nếu giọng tạo được dùng ở đó — kiểm khi làm).
- **Trước khi code:** phép thử nghe tiếng Việt (≤ 0,05 USD, sau khi duyệt #135) — bảng giọng GPT-Live không ghi tiếng Việt. Chủ dự án
  nghe không đạt → không làm, ghi lý do.
- **Tiêu chí:** [x] lưu / đổi / xóa giọng; [x] miệng giả nhận đúng mã giọng. [ ] Chủ dự án nghe `docs/nghe-bh11/giong-rieng.wav` rồi bật.

#### F-115 Chạm để trả lời — N · BH11
- Màn hình người dẫn: chạm một bình luận → agent soạn **một câu** trả lời (≤ 2 câu ngắn) từ thẻ sản phẩm, tồn còn bán được, Sổ tay, bảng
  size; qua Bộ kiểm tra K1–K11. Hiện trong ô lớn; nút **[Mai nói]** (miệng / máy đọc nói câu này), **[Tự đọc]** (đóng ô), **[Trả lời bình
  luận]** (đăng trả lời dưới bình luận đó, qua giới hạn liên hệ).
- Model `gpt-6-luna`, suy nghĩ tắt, có lưu đệm lời dặn (12 giờ). Câu bị chặn → "Mai chưa chắc, anh/chị kiểm lại" + dữ liệu liên quan.
  Hỏi size có số đo → dùng `tu-van-size.js` bằng mã, không gọi AI.
- **Tiêu chí:** [x] AI giả: chạm → câu hiện ≤ 2 giây; [x] câu có số lạ → bị chặn; [x] Dừng AI → nút chạm ẩn, hỏi size vẫn chạy bằng mã.

#### F-116 Bảng huấn luyện người dẫn — N · BH11
- Mở rộng dòng số liệu F-85: biểu đồ nhỏ theo phút (người xem từ `live_views`, bình luận, chốt) cho cả buổi; dữ liệu theo phút lưu vào
  bảng mới (023) để F-117 dùng.
- Cảnh báo bằng mã (0 đồng), tối đa một cảnh báo mỗi 2 phút, ưu tiên theo thứ tự: (1) **câu hỏi chưa ai trả lời** > 60 giây (đếm, chạm
  để mở F-115); (2) người xem **tụt ≥ 30% trong 3 phút**; (3) **5 phút chưa nhắc cách chốt** / giá (theo chữ chép lời người dẫn + lời
  Mai); (4) món nguội (gợi ý nhịp F-85 giữ). Đội AI dẫn → chỉ hiện số, không cảnh báo.
- **Tiêu chí:** [x] kịch bản diễn tập "người xem tụt", "3 câu size chưa trả lời" → đúng cảnh báo; [x] không quá 1 cảnh báo / 2 phút.

### Đợt nâng cấp 3.10 — BH12 "Kịch bản buổi sau"

#### F-117 Kịch bản buổi sau dựng từ số liệu buổi trước — N · BH12
- Sau buổi thật: mã dựng bảng từng đoạn (món, giây bắt đầu – kết thúc theo F-103, người xem đầu / cuối đoạn, người chốt, câu hỏi) →
  đánh dấu **đoạn ra đơn** và **đoạn người xem bỏ đi** (tụt ≥ 20% trong đoạn).
- Nút "✨ Mai đề xuất kịch bản buổi sau" ở Tổng kết buổi: agent `soan_kich_ban` (có sẵn) nhận số liệu gộp (không tên khách) + món sẽ bán
  → nháp thứ tự món, thời lượng mỗi đoạn, chỗ cần đổi lời mở; mọi con số phải có trong đầu vào (luật như `tong_ket`). Người sửa, lưu
  thành kịch bản; buổi sau chọn ở ô kịch bản.
- Chỉ khi buổi có ≥ 10 phút số liệu theo phút. Model `gpt-6-luna`.
- **Tiêu chí:** [x] số liệu đoạn khớp đếm trực tiếp; [x] AI giả nêu số lạ → bỏ gợi ý đó; [x] dữ liệu gửi AI không có tên, số điện thoại. (BH12 xong 28/10/2026)

### Đợt nâng cấp 3.11 — thêm vào BH10

#### F-118 Cảnh báo khách từng hoàn hàng — N · BH10 · #139
- Khách có ≥ 1 đơn **Hoàn** (hoặc hủy vì không nhận hàng) → đơn mới của khách gắn nhãn "Từng hoàn N đơn — nên gọi xác nhận hoặc chuyển
  khoản trước" ở Đơn hàng, Màn hình người dẫn (dòng Vừa chốt) và tóm tắt mua của khách. Chỉ người của shop thấy; AI không nói với khách.
- Tính từ lịch sử đơn (`khach.tomTatMua`), không thêm bảng. Không tự chặn đơn.
- **Tiêu chí:** [ ] khách có đơn hoàn → nhãn ở đơn mới; [ ] khách chưa hoàn → không nhãn; [ ] không câu nào gửi khách có nhãn này.

### Đợt nâng cấp 3.11 — GD1 "Giao diện gọn và rõ" (#140, #141)

Bản vẽ và lý do: `docs/10` mục 2–5. Mọi màn hình kiểm bằng bản xem thử (AI giả, 0 đồng), chụp ảnh 1440 × 900 và 1366 × 768 gửi chủ dự án.
Không đổi nghiệp vụ, không đổi API trừ chỗ ghi rõ.

#### F-119 Khung giao diện chung — B · GD1
- Menu trái 3 nhóm: **Bán hàng** (Hôm nay, Livestream, Đơn hàng, Tin nhắn) · **Hàng hóa** (Sản phẩm, Tồn kho, Khách hàng) · **Shop** (Sổ
  tay, Báo cáo, Cài đặt); số việc chờ cạnh mục. "Agent & Skill" đổi tên **"Trợ lý AI"**, vào Cài đặt; Hook, Luật quyền, Lời dặn vai trò,
  Agent thử nghiệm ẩn sau công tắc **"Nâng cao"**.
- **Bảng màu trạng thái chung** (một tệp): xanh = ổn / xong, vàng = cần chú ý, đỏ = gấp / hết / hủy / lỗi, xanh dương = thông tin, xám =
  bình thường; nhãn luôn kèm biểu tượng, 1–3 chữ. Cam thương hiệu chỉ cho **một** nút chính mỗi màn; nút nguy hiểm đỏ riêng.
- Bỏ mọi mã "(#xx)", "(F-xx)" khỏi chữ người dùng thấy (giữ trong chú thích mã); ghi chú dài thu vào ⓘ; mỗi màn một câu hướng dẫn.
- Tiền hiện / nhập "10.000đ"; giờ có đơn vị; ngày dd/mm/yyyy (sửa ô ngày Báo cáo); trang trống có câu mời + một nút; biểu tượng tab.
- **Bật / tắt từng phần** (Cài đặt → Phần mềm): ẩn mục shop không dùng (ví dụ Đội AI, Radio, Ảnh khách) — chỉ ẩn giao diện, không xóa dữ liệu.
- **Tiêu chí:** [ ] test quét chữ giao diện không còn mã "#số" / "F-số"; [ ] mọi nhãn trạng thái lấy từ một bảng; [ ] ảnh chụp từng màn.

#### F-120 Trang "Hôm nay" — B · GD1 · #141
- Thay Tổng quan: thẻ buổi live kế tiếp (lịch F-96) + **Bắt đầu live** / Tập trước + dòng sẵn sàng; 4 con số (Chờ xác nhận, Cần gửi,
  Doanh số hôm nay, Khách cần bạn); Việc cần làm theo mức (Gấp / Sắp hết / Nên làm) có nút.
- **Đội AI như nhân viên:** mỗi agent đang bật một dòng — tên việc ("Mai tư vấn Messenger", "Mai dẫn live", "Mai đọc chốt"…), trạng thái
  (Chờ việc · Đang làm · Thật · Diễn tập · Tắt), việc hôm nay.
- **Chỉ số AI 7 ngày bằng lời thường:** xử lý xong, chuyển cho người, câu bị chặn theo lý do, lượt lỗi theo lý do, chi phí — số từ nhật
  ký chạy có sẵn.
- **Tiêu chí:** [ ] số khớp đếm trực tiếp; [ ] không có số 0 đứng trơ (thay câu chỉ việc).

#### F-121 Bảng "AI & kênh", chi phí VNĐ, "Cần xử lý" — B · GD1 · #141
- Một bảng mỗi kênh một dòng (Bình luận live, Messenger / Tư vấn viên, Phòng live, Đội AI, sau này Zalo): chế độ **Thật / Diễn tập / Tắt**,
  trần chi phí / ngày, đã dùng hôm nay, ghi chú; nút **Dừng mọi tự động** đầu bảng. Gom các công tắc đang rải rác về đây (giữ nguyên luật F-72).
- Ô **tỷ giá** (để trống = chỉ USD) → mọi chỗ hiện chi phí thêm VNĐ.
- **"Cần xử lý"** đầu Cài đặt: chỉ cài đặt đang chặn việc (thiếu khóa, Facebook chưa nối, chưa có tài khoản nhận tiền…), mỗi dòng một nút.
- Xem lại hàng "Chờ duyệt" (99 việc ở bản xem thử): việc chờ quá hạn tự hết hạn có ghi lý do; chỉ báo khi có việc mới.
- **Tiêu chí:** [ ] đổi chế độ một kênh ở bảng = như đổi ở chỗ cũ (test); [ ] tỷ giá trống → không hiện VNĐ.

#### F-122 "Bắt đầu live" 3 bước — B · GD1
- Bước 1 món / kịch bản; bước 2 cách Mai dẫn bằng 4 thẻ có hình (Gợi ý cho bạn · Cùng dẫn · Mai dẫn chính · Đội AI dẫn) + tông giọng (F-127
  khi có); bước 3 kiểm tra (bảng Sẵn sàng thu gọn: xanh / vàng + link hướng dẫn) → **Lên sóng** / Tập trước. Thay trang Phiên live hiện có.
- **Tiêu chí:** [ ] cùng dữ liệu phiên như cách cũ; [ ] vàng không chặn, đỏ có lý do.

#### F-123 Đơn hàng mới — B · GD1
- 4 tab: **Cần làm** (chờ xác nhận, thiếu thông tin, chờ tiền CK, cần gửi) · Đang giao · Xong · Hủy, hoàn; In nhiều phiếu.
- Chi tiết: dòng hành trình đơn (nguồn → tin riêng → thông tin → chờ xác nhận…), **ô thêm món gõ kiểu chốt** ("21 xanh 28", dùng bộ đọc
  `nhan-chot.js`), phí ship ô tiền; **một** nút chính theo trạng thái; Hủy trong menu ⋯ có hỏi lại.
- **Tiêu chí:** [ ] gõ "12 đen M" thêm đúng phân loại, sai thì báo; [ ] đổi món vẫn qua `don.js` (giữ hàng, F-93).

#### F-124 Sản phẩm chia tab — B · GD1
- 5 tab: Cơ bản · Màu và cỡ · Ảnh · Thông tin cho Mai · Hỏi đáp (chấm báo tab thiếu). Tab Màu và cỡ là **lưới tồn có màu**, bấm ô để nhập /
  điều chỉnh (qua `kho.ghiThayDoi`), cột giá riêng. Ô AI điền có nhãn **"AI đoán"** + nút "Đúng" (thay nhãn hiện có).
- **Tiêu chí:** [ ] sửa tồn ở lưới ghi lịch sử kho; [ ] nhãn ảnh không còn chữ bị cắt.

#### F-125 So sánh bản cũ / bản mới — N · GD1 · #141
- Bảng xem trước của "Nói với Mai" và màn sửa Sổ tay hiện **Thêm / Sửa / Bỏ** theo dòng, so với bản đang dùng (Sổ tay đã lưu bản ở `so_tay_ban_sua`).
- **Tiêu chí:** [ ] sửa một câu Sổ tay → chỉ dòng đó hiện "Sửa".

### Đợt nâng cấp 3.11 — thêm vào BH11

#### F-126 Màn hình người dẫn "chế độ sân khấu" — B · BH11 · #140
- Đang live: ẩn menu; thanh mảnh (giờ live, đèn Facebook / OBS / AI / mạng, số xem · chốt · xác nhận, chế độ, **một** nút **Dừng AI**;
  "Dừng mọi thứ" vào menu ⋯).
- 3 vùng cố định không cuộn: **món đang bán** (số + tên, giá, lưới còn hàng màu × cỡ chữ to, vàng sắp hết, đỏ hết kèm chữ); **thẻ gợi ý của
  Mai** (câu, nguồn, [Mai nói] [Tự đọc] [Bỏ] — F-115); "Tiếp theo" + ←/→. Cột phải: dải cảnh báo (F-116), **Vừa chốt** (kèm nhãn F-118),
  bình luận lọc Muốn mua / Hỏi / Khách cũ / Tất cả, chạm để Mai soạn.
- Lời Mai, ghi chú cho Mai, cảnh báo khác màu; cảnh báo nguy cấp (mất kết nối, hết hàng, AI lỗi) mới có dải đỏ + tiếng.
- Vừa khít 1366 × 768 không cuộn. **Cỡ chữ chốt bằng phép thử: chủ dự án đứng cách laptop 2 m.**
- **Tiêu chí:** [x] ảnh chụp 1366 × 768 và 1920 × 1080 không thanh cuộn; [x] phím tắt cũ giữ nguyên; [ ] chủ dự án duyệt cỡ chữ (trang thử `#/nguoi-dan?thu-co-chu`).

#### F-127 Tông giọng cho Mai trên sóng — N · BH11 · #141
- Cài đặt → Giọng Mai: mẫu tông "Đều, rõ ràng / MC vừa / MC sôi nổi / Ấm áp, tư vấn / Tự viết (≤ 400 ký tự)" ghép vào lời dặn của miệng
  khi mở phiên; nghe thử tốn phí nhỏ, giới hạn lượt mỗi phút. Dùng chung danh sách tông với Đội AI (`doi-ai.js`).
- **Tiêu chí:** [x] miệng giả nhận đúng đoạn tông; [x] đổi tông giữa buổi áp khi miệng mở lại (GPT-Live: thêm lời dặn, không cần mở lại).

### Đợt nâng cấp 3.11 — BH13 "Zalo cá nhân" (#142 → #144)

Đầu mốc tra lại: cách Hermes Agent trên mozaai.vn nối Zalo cá nhân và gắn MCP + skill; bản đặc tả MCP và SDK Node mới nhất; Cloudflare
named tunnel. Khác thiết kế dưới thì dừng, báo chủ dự án.

#### F-128 Cổng MCP cho khách — B · BH13 · #143, #144
- `/mcp` trên cổng webhook (đường hầm Cloudflare có tên), khóa Bearer (tạo / thu hồi ở Cài đặt → Zalo), giới hạn lượt gọi, nhật ký gọi.
- Công cụ (chỉ cho khách): `tim_mon`, `xem_mon` (giá bán lúc này, còn bán được, ảnh, thông số — qua `theChoAi`), `bang_size` / `tu_van_size`
  (bằng mã), `chinh_sach` (Sổ tay), `giu_hang` (tạo đơn "Chờ xác nhận" qua `don.js`, cần tên + số điện thoại), `ma_qr` (đơn vừa tạo).
  **Mọi câu có giá, còn hàng, tổng tiền trả về dạng câu soạn sẵn** để trợ lý đọc nguyên văn.
- Không có công cụ đọc khách khác, đơn khác, báo cáo, cài đặt. Hết hàng / sai phân loại → lỗi rõ để trợ lý hỏi lại.
- **Tiêu chí:** [ ] test: không khóa / sai khóa → từ chối; [ ] mọi đường khác của cổng webhook vẫn chặn; [ ] giữ hàng song song không bán
  quá số; [ ] câu soạn sẵn qua Bộ kiểm tra.

#### F-129 Kênh Zalo trong MOZA — B · BH13 · #142
- Cài đặt → Zalo: tạo / thu hồi khóa, chép địa chỉ MCP + **skill mẫu** (xưng hô, đọc nguyên văn câu giá, không nhắn hàng loạt, "gặp người",
  khi MOZA không trả lời thì hẹn shop) để dán vào mozaai.vn; trạng thái lần gọi gần nhất.
- Đơn và tin Zalo vào Đơn hàng, Hộp thư với nhãn nguồn **Zalo**; khách nhận theo số điện thoại (trùng khách Facebook thì gợi ý gộp, người bấm).
  Đơn Zalo không bao giờ tự xác nhận. Dòng "Zalo" trong bảng AI & kênh (F-121) và bảng Sẵn sàng (đường hầm, khóa).
- Laptop tắt → trợ lý không gọi được MCP; skill dặn nhận lời nhắn, hẹn shop trả lời.
- **Tiêu chí:** [ ] MCP giả chạy trọn: hỏi món → tư vấn size → giữ hàng → đơn Chờ xác nhận hiện ở MOZA; [ ] phép thử thật bằng 7 ngày dùng
  thử mozaai.vn với số Zalo phụ (chủ dự án làm, Claude Code hướng dẫn).

### Để sau — mô tả ngắn để không quên

- **F-59 Màn hình trình chiếu — ĐÃ LÀM ở #90** (Màn hình sản phẩm + Thanh chữ + chuyển cảnh OBS). Còn để sau: **video AI tạo từ
  ảnh** (giai đoạn 3 — Veo 3.1 Lite khoảng 0,03–0,05 USD/giây; Sora 2 API đã đóng 24/9/2026; tra lại lúc làm); khi Gemini Live
  Avatar mở cho người dùng thường (#83): Mai hiện hình trên màn hình này.
- **F-60 Nối hãng vận chuyển — S:** chủ dự án chọn hãng (GHN, GHTK, Viettel Post, J&T…); tạo vận đơn, lấy phí, theo dõi
  trạng thái tự động. Tra tài liệu chính thức lúc làm. (#63)
- **F-61 Kênh bán khác — S:** TikTok Shop, Shopee, website. Nhiều khả năng sàn tự lo giỏ hàng và thanh toán trong live;
  MOZA lo AI dẫn, trả lời bình luận, **đồng bộ tồn kho** để không bán quá số. Kiểm chứng khi làm. (#57, #70)

**Để sau của đợt cải tiến 3.4** (#125), mỗi mục có điều kiện mở lại:
- **F-60 + tin theo trạng thái hãng (P25) + chuẩn hóa địa chỉ (P30):** khi đã chọn hãng và có từ 30 đơn/ngày trong 2 tuần,
  hoặc tạo vận đơn mất hơn 30 phút/ngày. Làm cả ba cùng lúc; người rành xem phần thu hộ.
- **Tự xác nhận tiền (P21 bước 2, payOS hoặc SePay):** khi có hơn 20 đơn chuyển khoản/ngày hoặc đối chiếu mất hơn 15 phút/ngày;
  chỉ lưu "đã nhận, số tiền, giờ, mã tham chiếu".
- **Thẻ HUMAN_AGENT trong MOZA (P05):** khi ứng dụng đã được duyệt quyền Human Agent và doanh nghiệp đã xác minh.
- **Che số điện thoại trước khi gửi AI (P36):** khi chuyên gia trả lời câu hỏi Luật 91/2025 Điều 20 (#18, #127).
- **Zalo OA (6.3 C):** khi hộ kinh doanh xác thực được OA và chuyên gia duyệt câu xin đồng ý.
- **Lên lịch live qua Facebook (6.5 B):** khi có tính năng cần biết trước mã live và quyền không phải xin duyệt.
- **Đơn đổi size tự động (P27 bước 2); gợi ý size trong thẻ giữ hàng từ số đo khách đã đồng ý lưu (P13, sau F-91).**
- **Tư vấn viên dùng model rẻ (P39):** khi có số chi phí thật (F-102).
- **Theo dõi, chưa dùng được:** Meta Live Shopping Tools (ghim sản phẩm, giỏ hàng trong live — có thể đổi hẳn cách chốt đơn
  khi mở cho ứng dụng không phải đối tác Meta), Marketing Messages trên Messenger (chỉ qua nhà cung cấp được duyệt), Gemini Live
  Avatar (#83).

**Để sau của đợt 3.10** (#134; lý do ở `docs/09` mục 7), mỗi mục có điều kiện mở lại:
- **Clip từ live → Reels; ghi hình buổi live:** khi chủ dự án muốn bán thêm bằng video ngắn, hoặc có khiếu nại cần bằng chứng hình.
- **Gợi ý đẩy live bằng quảng cáo (Meta Live Video Ads); mốc thuế 1 tỷ đồng/năm trong Báo cáo:** khi chủ dự án hỏi.
- **Mai hiện hình (HeyGen LiveAvatar ~0,10 USD/phút):** khi có bản nối GPT-Live và khớp môi tiếng Việt đạt qua phép thử.
- **TikTok Shop, phát nhiều nền tảng:** cùng F-61; TikTok Mỹ cấm giọng AI trong live từ 23/5/2026 — nếu Việt Nam cũng cấm, Mai chỉ
  được gợi ý chữ cho người dẫn.
- **Bán trong ChatGPT / Gemini (ACP, UCP):** khi mở cho người bán Việt Nam không cần cổng thanh toán riêng.

**Để sau / không làm của đợt 3.11** (#146):
- **AI tổng đài** (gọi vào / gọi ra, xác nhận đơn): khi chủ dự án muốn — làm theo khung sổ đồng ý (`docs/10` mục 5), tra Messenger Calling
  API và nhà mạng lúc làm; luật sư xem (cuộc gọi tự động, ghi âm).
- **Sao lưu tự động:** chưa cần (chủ dự án 27/10/2026); vẫn có "Sao lưu ngay".
- **Không làm:** tin nhắn thoại cho khách; lịch tự phát (AI tự live không người); nhiều người dùng, ủy quyền duyệt.

**Ngoài phạm vi (cố ý không làm — Claude Code không được tự thêm):**
- Đăng nhập, nhiều người dùng, phân quyền; đưa giao diện MOZA ra internet.
- Tự phát live, tự trộn hình / âm thanh bằng phần mềm của MOZA (việc này do OBS làm — MOZA chỉ đổi cảnh OBS và cấp trang
  Màn hình sản phẩm, #90); tự lên lịch live, tự bấm phát (6.5 A, #117).
- Cổng thanh toán, ví điện tử, tự đọc sao kê ngân hàng (mã QR chuyển khoản F-89 thì có — người vẫn tự bấm "Đã nhận tiền").
- Mã giảm giá, khuyến mại (**trừ "Giá live tới hết buổi" F-93, tắt mặc định, #115**), tích điểm, giờ vàng / flash sale có
  đồng hồ, bốc thăm trúng thưởng, quà cho bình chọn hay đố vui.
- Giá sỉ, nhiều kho. (Giá riêng từng phân loại đã có ở F-51.)
- Hóa đơn điện tử, kế toán, thuế.
- Sao lưu tự động, đồng bộ đám mây; nhập tin nhắn có trước lúc kết nối Page.
- Tự động hóa giao diện Facebook (Puppeteer, Playwright…), mọi cách lách quy định Meta; gửi tin marketing hàng loạt (chỉ nhắn
  người đã đồng ý cho từng buổi, trong 24 giờ — #117).
- Thu thập CCCD hay giấy tờ cá nhân; ứng dụng di động.
- Người mẫu hay video do AI tạo thay hàng thật (P37, P40); live do AI dẫn mà không có người trực (P41); chia sẻ danh sách khách
  bom hàng giữa các shop (trái Luật 91/2025); tự đổi món theo camera (F-107 chỉ gợi ý); coi bình luận là đã mở cửa sổ 24 giờ khi
  Bước 0 chưa xác nhận.

---

## 4. Luồng người dùng chính

### Luồng 1 — Chuẩn bị hàng
1. Một lần: Sản phẩm → Bảng size → tạo vài bảng dùng chung ("Áo nữ form chuẩn", "Quần jean nữ"); Sổ tay shop: Giao hàng,
   Thanh toán, Đổi trả; Cài đặt → Bán hàng: tên shop, phí ship, miễn phí từ.
2. Sản phẩm → **Tạo từ ảnh**: kéo 3–6 ảnh vào → khoảng 10–20 giây sau AI đã điền tên gợi ý, danh mục, thông số, màu, mô tả,
   điểm nổi bật (nhãn "AI đoán").
3. Người dùng sửa chỗ sai, gõ **giá**, chọn **bảng size**, gõ cỡ "S, M, L, XL", điền **tồn** từng ô → Lưu, Đang bán. Thanh độ
   đầy đủ báo còn thiếu gì cho AI tư vấn.
4. Hàng về thêm: gõ vào "Nói với Mai" — "nhập thêm 10 áo 12 đen M, 5 trắng L" → xem trước → **Làm**.

### Luồng 2 — Buổi live bán hàng (mọi chế độ)
1. Kịch bản → ✨ AI soạn kịch bản (kiểu Mai / Đội AI / Radio) từ sản phẩm Đang bán → nghe thử, sửa → (Đội AI) Làm sẵn tiếng.
2. Livestream → Chuẩn bị: chọn kịch bản, chế độ; Kiểm tra (micro, AI, Facebook). Bắt đầu live trên điện thoại → MOZA tự nhận live, mở Màn hình người dẫn.
3. Người dẫn / Mai / Đội AI giới thiệu từng sản phẩm; Màn hình người dẫn hiện sản phẩm đang nói, giá, còn bán được.
4. Bình luận hỏi → như SPEC-TD Luồng 1, 2, 2b, 2c (gợi ý chữ, Mai nói, Mai dẫn, đội trả lời bằng 2 giọng).
5. Bình luận chốt → Luồng 3.
6. Live tắt trên điện thoại → phiên kết thúc; báo cáo buổi live có số đơn, doanh số tạm tính.

**Nhánh lỗi:** như SPEC-TD mục 4; thêm: sản phẩm vừa hết giữa buổi → màn hình gạch phân loại đó, miệng nhận cập nhật, Đội AI đọc "vừa hết"; sản phẩm bị đổi Ngừng bán giữa buổi → báo đỏ, không nói về sản phẩm đó nữa.

### Luồng 3 — Chốt trên live đến đơn đã xác nhận (tự động)

**Từ bản 3.4 (BH5 → BH7; #97 → #100, #112)** các bước 4–6 dưới đây đổi thành:
- 4'. Trong 1–2 giây MOZA **tự soạn thẻ giữ hàng** (0 AI): ảnh đúng màu, "Áo 12 Đen/M · 159.000đ · giữ tới …", dòng "Tin tự động
  từ trợ lý AI của shop", nút [Giữ, lên đơn] [Đổi] [Không lấy] — gửi làm tin nhắn riêng duy nhất của bình luận đó (F-68).
- 5'. Chị Lan bấm [Giữ, lên đơn] → giữ đủ 24 giờ, tin xin thông tin do mã soạn có nút số điện thoại tự điền, [Như đơn trước]
  (F-88); gửi địa chỉ → thẻ đơn [Nhận hàng trả tiền] [Chuyển khoản] [Sửa đơn] kèm "thêm X nữa là miễn ship" (F-89, F-90).
- 6'. Bấm một nút là xác nhận; chọn chuyển khoản thì nhận mã QR đúng số tiền. Khách gõ chữ thì Tư vấn viên tiếp như cũ.
- Chưa bấm gì sau 4 phút → nhắc trên sóng mở mục Tin nhắn chờ (F-70); đủ thông tin mà chưa xác nhận → tối đa 2 nhắc + 1 báo hủy
  (F-69); giữ ngắn tới hết live + 2 giờ cho người chưa bấm (#98).

1. Chị Lan bình luận "chốt 12 đen M".
2. `khi_tin_den` nhận ra bình luận chốt → giữ 1 Đen/M của sản phẩm 12 → đơn DH-0042 "Chờ xác nhận", giữ tới 24 giờ.
3. Màn hình người dẫn: "Vừa chốt · Lan · Áo 12 Đen/M". Mai / Đội AI đọc "Chị Lan vừa chốt áo số 12 màu đen size M" ở chỗ nghỉ kế tiếp.
4. Tư vấn viên nhắn riêng: tóm tắt món, giá, tạm tính, hạn giữ; xin tên, số điện thoại, địa chỉ. Tin qua Bộ kiểm tra.
5. Chị Lan trả lời (cửa sổ 24 giờ mở) → cho thông tin → `cap_nhat_don(viec: thong_tin_giao)` → tạo / liên kết khách hàng.
6. AI đọc lại đơn: món, phí ship, tổng tiền (số lấy từ khối chữ `xem_don` trả về), thanh toán COD → chị Lan "ok" → `cap_nhat_don(viec: xac_nhan)` (bằng chứng là tin nhắn "ok") → "Đã xác nhận".
7. Hôm sau: Luồng 5.

**Nhánh lỗi:**
- Chị Lan không trả lời tin nhắn riêng → trên sóng Mai nhắc định kỳ "ai đã chốt nhớ mở tin nhắn chờ của shop"; 2 giờ trước hết giờ giữ không nhắc được (cửa sổ 24 giờ chưa mở) → hết giờ giữ tự hủy, trả hàng.
- Nhắn riêng không được → gom tên vào bình luận công khai mời nhắn tin cho Page (#65).
- Bộ kiểm tra chặn tin → thử lại bằng Claude (A.7) → vẫn chặn thì Cần người.
- Khách từng hoàn ≥ 2 đơn → không tự xác nhận; việc "Gọi xác nhận đơn" (#73).

### Luồng 4 — Khách nhắn Page hỏi mua (không qua live)
1. "Áo sơ mi linen còn màu be size L không shop?" → Tư vấn viên tra sản phẩm, trả lời theo tồn còn bán được, gửi ảnh (F-56).
2. Khách "lấy 1 cái" → AI giữ hàng, tạo đơn nguồn "tin nhắn" → bước 5–6 của Luồng 3.

### Luồng 5 — Gửi hàng mỗi ngày
1. Đơn hàng → Cần gửi → chọn các đơn → In phiếu (hoặc Xuất file để nhập lên trang hãng).
2. Tạo đơn trên trang hãng vận chuyển, dán mã vận đơn vào MOZA (không bắt buộc).
3. Bấm "Đã gửi" → trừ kho; AI báo khách nếu còn trong 24 giờ.
4. Vài ngày sau: đánh dấu "Đã giao" hoặc "Hoàn"; hàng hoàn về → "Đã nhận hàng hoàn".

### Luồng 6 — Sửa một Skill
Như SPEC-TD Luồng 4.

---

## 5. Kiến trúc

Giữ nguyên SPEC-TD mục 5 (sơ đồ, bảng khối, nguồn sự thật, 5 nguyên tắc bắt buộc). Khác:

- **Nguồn sự thật cho AI:** sản phẩm (bản sửa đang dùng: tên, giá, mô tả), **tồn còn bán được** (tính lúc hỏi, không lưu
  trong bản sửa), Sổ tay shop, Cài đặt → Bán hàng (phí ship), và **đơn hàng của chính khách đang xử lý**. AI chỉ được dựa vào
  các nguồn này cho giá, số lượng, phí, tổng tiền, chính sách.
- **Khối Nghiệp vụ** thêm: `san-pham.js`, `bang-size.js`, `kho.js`, `don.js`, `khach.js`, `nhan-chot.js` (nhận ra bình luận chốt — không có
  SQL thì đặt ở `server/` như `phong-ai.js`; phần ghi đơn đi qua `don.js`), `bao-cao.js` (viết lại); bỏ `tin.js`, `ung-vien.js`.
- **Giữ hàng** là một hàm nghiệp vụ duy nhất (`kho.giu`) chạy trong giao dịch SQLite; mọi đường tạo / sửa đơn (bình luận
  chốt, Tư vấn viên, người tạo tay) đều gọi hàm này.
- Nguyên tắc 2 mở rộng: câu nhắc tới giá, số còn, tổng tiền phải qua Bộ kiểm tra (A.4). **Câu mẫu** của Đội AI có `{so}`, `{mon}`
  do máy điền từ dữ liệu, không qua AI nên không cần Bộ kiểm tra.
- Ảnh sản phẩm: tệp ở `data/anh/`, phục vụ qua `/anh/...` chỉ ở `127.0.0.1` (không qua cổng webhook). **Ngoại lệ từ bản 3.4
  (#97, chủ dự án đồng ý 27/9/2026):** cổng webhook có thêm một đường ảnh hẹp, chỉ đọc, cho thẻ giữ hàng trên Messenger — chỉ ảnh
  của sản phẩm Đang bán, tên tệp băm (không đoán được, không lộ id), không liệt kê thư mục, không ảnh khách, không video; mọi đường
  khác của giao diện vẫn chỉ ở `127.0.0.1`.
- **Ngoại lệ thứ hai từ bản 3.11 (#143, BH13):** cổng MCP `/mcp` cho trợ lý Zalo — đường hầm Cloudflare có tên, khóa Bearer, giới hạn lượt,
  chỉ công cụ cho khách (F-128). Giao diện MOZA vẫn không ra internet.
- **Dữ liệu theo danh mục nằm ở cấu hình, không ở cấu trúc bảng:** `danh-muc.json` (danh mục → bộ thông số), `thong-so.json`
  (mỗi thông số: tên, kiểu chọn một / chọn nhiều / chữ, danh sách lựa chọn). Giao diện và thẻ sản phẩm dựng từ hai file này.
  Bán loại hàng mới = thêm danh mục và bộ thông số, không nâng cấu trúc (#61).
- **Thẻ sản phẩm** (`nghiep-vu/san-pham.js` → `theChoAi()`) là cửa duy nhất đưa dữ liệu sản phẩm cho mọi AI (Co-host, Tư vấn
  viên, miệng, Đội AI, Soạn kịch bản, Quản lý) — một chỗ để loại giá vốn, ghi chú nội bộ và sinh "dòng dữ liệu" cho Bộ kiểm tra.
- **Agent mới `quan_ly`** (F-62) chạy trên runtime sẵn có, hàng đợi riêng, không bao giờ chặn đường live.

---

## 6. Công nghệ

Giữ nguyên SPEC-TD mục 6 (Node 26.10.0, `node:sqlite`, Express 5.2.1, ws 8.21.3, `@google/genai` 2.24.0, `openai` 7.23.0,
`@anthropic-ai/sdk` 0.128.0, `mpg123-decoder` 1.0.3, Graph API v26.0, `cloudflared` 2026.9.1; bảng model và giá tra
23–25/9/2026). **Bản bán hàng không thêm thư viện nào:**

| Việc mới | Cách làm | Lý do |
| --- | --- | --- |
| Tải ảnh sản phẩm lên | Trình duyệt thu nhỏ bằng `<canvas>` (cạnh dài 1600 px, JPEG chất lượng 0,85) rồi gửi thân nhị phân (`express.raw`, tối đa 3 MB) | Không cần `multer`, `sharp` |
| In phiếu gửi hàng | Trang HTML + CSS `@media print`, `window.print()` | Không cần thư viện PDF |
| Xuất CSV | Tự viết, UTF-8 có BOM, dấu phẩy, bọc ngoặc kép | Excel mở đúng tiếng Việt |
| Gửi ảnh Messenger (F-56) | Attachment Upload API của Meta bằng `fetch` + `FormData` có sẵn trong Node | Không cần SDK |
| Nhận ra bình luận chốt | Mã thuần (bỏ dấu, tách số, so danh sách phân loại); câu không chắc mới gọi model rẻ (#77) | Nhanh, gần như không tốn tiền AI |
| Hai nguồn hình lên sóng (#90) | OBS Studio 32 (người dùng tự cài, miễn phí) nối qua obs-websocket v5 có sẵn trong OBS, dùng `ws` đã có; Màn hình sản phẩm và Thanh chữ là trang HTML của MOZA làm nguồn trình duyệt | Không thêm thư viện; OBS lo phát live, MOZA chỉ đổi cảnh |
| Video sản phẩm (#90) | Trình duyệt gửi thân nhị phân MP4 / WebM (`express.raw`, tối đa 80 MB); phát lại có tua (`sendFile` + Range) | Không cần `multer`, không chuyển mã |
| Đọc ảnh sản phẩm (F-51 "Tạo từ ảnh"), ảnh khách gửi (F-63) | Model chữ có đọc ảnh của nhà đang dùng (`gemini-3.8-flash`, dự phòng `gpt-6-sol`), đầu ra theo lược đồ | Có sẵn trong model; không thêm dịch vụ |

**Model — tra lại ngày 25/9/2026** (#86; nguồn mục 14). Giữ bảng SPEC-TD mục 6, thêm và sửa:

| Việc | Model chính | Dự phòng | Ghi chú |
| --- | --- | --- | --- |
| Tạo sản phẩm từ ảnh, tìm mẫu theo ảnh | `gemini-3.8-flash` (GA 2/9/2026) | `gpt-6-sol` | Suy nghĩ thấp; phiếu theo lược đồ |
| Nhận bình luận chốt khó hiểu (#77) | `gpt-6-luna` (0,10 / 0,50) | `gemini-3.5-flash-lite` (0,30 / 2,50) | Suy nghĩ tắt; rẻ nhất. Đổi chính / dự phòng 26/9/2026 sau khi tra giá thật |
| Nói với Mai — agent `quan_ly` (F-62) | `gpt-6-sol` | `gemini-3.8-flash` | Vừa |
| Miệng Mai | `gpt-live-1` (ra 10/9/2026, full-duplex, 0,05 USD/phút + não phía sau) · `gemini-3.8-live` (ra 15/9/2026; gọi công cụ **chạy nền mặc định**, nhận ảnh / video, proactive audio luôn bật, **không còn affective dialog**, `turnComplete: true` luôn cắt lời đang nói) · `gemini-3.8-live-extended-thinking` | — | Không đổi mặc định. Cả hai hãng **chưa nhận giọng tự tạo** cho miệng Live (diễn đàn Google 24/9/2026) → giọng riêng vẫn chỉ ở Đội AI. `gpt-realtime-2.1` là thế hệ trước, không chuyển |
| Tư vấn viên — dự phòng khi Gemini lỗi (#88) | `gpt-6-luna` | — | Đổi từ `gpt-6-sol` 26/9/2026 (rẻ hơn ~20 lần). Trong Phòng diễn tập Tư vấn viên chạy `gpt-6-luna` làm model chính |
| Nâng lên Claude (Tư vấn viên), Soát sản phẩm | `claude-sonnet-5` (giữ giá 2 / 10, không tăng như dự kiến 1/9/2026) · `claude-opus-5-5` | `gpt-6-sol` | Không dùng `claude-haiku-4-5` (ngừng sớm nhất 15/10/2026). `claude-fable-5-1` (10 / 50) mạnh nhất, không dùng mặc định |
| Mạnh nhất OpenAI | `gpt-6-astra` (ra 3/9/2026, 10 / 50 USD) | — | Không dùng mặc định (đắt); chủ dự án chọn được trong Cài đặt cho agent nào muốn |

Không dùng (tra 25/9/2026, lý do ở #83 → #85): Gemini Live Avatar (chỉ Gemini Enterprise), Meta Business Agent (không gọi
được kho / đơn của MOZA trên Messenger), Managed Agents / Agents SDK (chạy trên máy chủ hãng, khóa vào một hãng).
Tra lại model mới nhất **đầu mỗi mốc** (nguyên tắc 1 trong `CLAUDE.md`), ghi ngày tra vào đây.

**Tra lại 26/9/2026 (đầu BH2 → BH4):** OpenAI — `gpt-6-sol` (22/9), `gpt-6-astra` (3/9), GPT Image 2.5: đã có trong bảng,
không đổi phương pháp. Google — Gemini 3.8 Live / Extended Thinking (15/9), Gemini 3.5 Transcribe, Omni Flash: không đổi
phương pháp (chép lời người dẫn vẫn theo SPEC-TD). Giá `gemini-3.5-flash-lite` thật là 0,30 / 2,50 → sửa `gia-model.json`, đổi
#77 sang `gpt-6-luna`. Meta — Graph API v26.0 (29/7/2026); nhắn riêng vẫn 7 ngày; chưa thấy thay đổi cho bình luận live.

**Tra 26/9/2026 (#90):** OBS Studio mới nhất 32.2 (21/7/2026); obs-websocket v5 có sẵn từ OBS 28 (cổng 4455, có mật khẩu) — giao thức
không đổi. Camera điện thoại: Windows 11 "Connected camera" (Android 10+, ứng dụng Liên kết với Windows 1.23112.189+), chế độ
Webcam qua USB của một số máy Android; iPhone: DroidCam (plugin OBS, bản miễn phí hình chuẩn, HD cần Pro) hoặc Camo. Video AI
từ ảnh (giai đoạn 3, chưa làm): Sora 2 API đóng 24/9/2026; Veo 3.1 Lite còn.

**Tra 27/9/2026 (bản 3.4, đợt cải tiến — nguồn ở `docs/06` mục 10 và `server/facebook/hanh-vi-meta.json` khi làm).** Đợt này
**không thêm thư viện** (xuất Excel nếu hãng bắt buộc: bộ ghi tối giản bằng `node:zlib`; ảnh VietQR: đường dẫn ảnh của VietQR).
- **Meta:** nhắn riêng từ bình luận được **1 tin**, trong 7 ngày, dùng được mọi loại tin kể cả thẻ ảnh + nút → tin đầu phải là
  thẻ trọn vẹn (#97). Hai trang tài liệu nói ngược nhau về việc bình luận có mở cửa sổ 24 giờ → không dựa vào, kiểm ở Bước 0.
  Thẻ POST_PURCHASE_UPDATE / CONFIRMED_EVENT_UPDATE / ACCOUNT_UPDATE bỏ từ 27/4/2026, HUMAN_AGENT còn (cần xét duyệt); mẫu Utility
  do Page tạo được duyệt trong vài giây, cần quyền `page_utility_messaging` (mã hiện thiếu); Recurring Notifications tắt 10/2/2026;
  Marketing Messages có Việt Nam nhưng chỉ qua nhà cung cấp công nghệ được duyệt → MOZA chưa dùng được. Messenger có lưới ảnh 2–6
  tấm, trả lời nhanh tự điền số điện thoại, menu cố định, link m.me có `ref`; mẫu khảo sát và Instant form còn "đang phát triển".
  Messenger Calling API (11/2/2026) có Việt Nam. Live: bình luận theo luồng + cảm xúc, `live_views` đọc được, API bình chọn có (không
  dùng — #125), **không có API ghim bình luận hay ghim sản phẩm**; chế độ Thảo luận ẩn bình luận dưới 100 ký tự; video live tự xóa
  sau 30 ngày (hoãn được 6 tháng); Page phải có ≥ 100 người theo dõi và tài khoản ≥ 60 ngày mới phát live; quyền nhắn tin khách lạ
  cần xét duyệt + xác minh doanh nghiệp. Live Shopping Tools (ghim sản phẩm, giỏ hàng) ở Việt Nam chỉ qua đối tác Meta — theo dõi.
  Meta Business Agent (3/6/2026) nối API riêng mới có trên WhatsApp — giữ #84. Graph API MOZA dùng v26, v20 ngừng 24/9/2026.
- **Google:** Gemini 3.8 Live nhận hình ~0,002 USD/phút; không nén bối cảnh thì phiên có hình chỉ 2 phút (phải bật nén + nối
  phiên); nhận thêm bối cảnh không cắt lời (#81). **Giá Gemini 3.8 Live / 3.8 Flash / TTS gấp đôi từ 1/1/2027** (bảng giá MOZA còn
  thiếu mốc của 3.8 Live và giá phần hình — F-67). Gemini 3.5 Transcribe (26/8/2026) nạp được danh sách từ riêng (F-87). Gemini 3.8
  Live chưa dùng được giọng tự tạo; Live Avatar vẫn chỉ ở Gemini Enterprise (~0,39 USD/phút theo nguồn thứ ba). Omni 1.1 Flash làm
  video từ ảnh (27/8/2026) — không dùng (#125).
- **OpenAI:** lỗi đọc ảnh của `gpt-6-luna` sửa ngày 25/9/2026 (thử ảnh trước ngày đó phải làm lại); GPT Live 1 không nhận hình;
  Sora 2 đóng 24/9/2026; Assistants API đóng 26/8/2026 (MOZA không dùng).
- **Anthropic:** không đổi phương pháp (#85); Claude Code làm thay các việc soạn, chấm, tra (#94) nên thử AI thật không gọi Claude API.
- **Việt Nam:** VietQR tạo ảnh QR có sẵn số tiền + nội dung qua đường dẫn (không cần tích hợp); payOS miễn phí từ 23/1/2026, SePay
  gói miễn phí 50 giao dịch/tháng (để sau, #125); GHTK không bắt ô quận/huyện, GHN nhận cả địa chỉ cũ và mới; danh mục 34 tỉnh,
  3.321 xã theo QĐ 19/2025/QĐ-TTg; Zalo ZBS 200–300đ/tin (để sau).

**Tra 27–28/10/2026 (bản 3.11):** giao diện các bên chuyên nghiệp (TikTok LIVE Manager / Dashboard 5/2026, YouTube Live Control Room,
Whatnot, Restream, Shopify Polaris web components 10/2025, Shopify POS 10, Linear 3/2026, Zendesk, Intercom, Gorgias, Square / Toast KDS)
→ `docs/10` mục 3. VIVA HCM (cùng bộ máy MOZA) → `docs/10` mục 5. mozaai.vn: máy chủ ảo tại Việt Nam có Hermes Agent (Nous Research), gói
từ 239.000đ/tháng kèm 250.000đ tiền AI, dùng thử 7 ngày; trang chủ không nói Zalo / MCP → tra lại đầu BH13. MCP: bản đặc tả `2026-07-28`
(tra 27/10). Không đổi phương pháp phần đã có; thêm thư viện SDK MCP ở BH13 (#144).

**Tra 27/10/2026 (bản 3.10, nghiên cứu nâng cấp — chi tiết và nguồn ở `docs/09` mục 3, 4, 9):**
- **OpenAI:** `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd` khai tử 1/10/2026, **tắt 6/1/2027**; đích thay thế là `gpt-realtime-2.1-mini` qua
  Realtime API (`/v1/audio/speech` không còn model mới) → **đổi phương pháp máy đọc** (#130, F-108). Chép lời: `gpt-4o-transcribe`,
  `whisper-1` tắt 26/2/2027 — MOZA dùng `gpt-live-transcribe` nên không ảnh hưởng. Mới: `gpt-6.1-sol` (29/9, 2 / 10), `gpt-6.1-terra`
  (26/10, 1 / 5); **Decisions API** GA 22/10 (chọn trong danh sách, nhận ảnh, `gpt-6-luna` 0,10 USD/1 triệu token vào, đầu ra miễn phí);
  GPT-Live nối Decisions (15/10); prompt-to-voice cho GPT-Live (16/10, miễn phí, ≤ 100 giọng — bảng giọng không ghi tiếng Việt); lưu
  đệm prompt 12 giờ (20/10). `gpt-live-1` vẫn 0,05 USD/phút, vẫn không nhận ảnh. `gpt-6-luna` giữ 0,10 / 0,50.
- **Google:** Veo 3.1 preview (kể cả Lite) tắt 22/10/2026 → Omni Flash (`gemini-omni-1.1-flash`). Khóa Gemini của chủ dự án vẫn bị chặn.
- **Anthropic:** `claude-sonnet-5-5` (28/9), `claude-haiku-5-5` (7/10), `claude-opus-5-5`, `claude-fable-5-1`; SDK bản lớn mới 21/10.
- **ElevenLabs:** `eleven_v4` (~0,08 USD / 1.000 ký tự), `eleven_v4_turbo` (~0,04, ~100 ms) ra 28/9/2026, có tiếng Việt, đọc hội thoại
  nhiều giọng; Eleven Realtime (19/10, 0,08 USD/phút) đang mở dần — chưa dùng.
- **Meta:** Graph API mới nhất vẫn v26.0; 27/10/2026 gỡ các kiểu gọi `pretty`, `debug`, `date_format`, `GET /?ids=`, ETag — **đã rà mã MOZA:
  không dùng**. Nhắn riêng: tài liệu vẫn chỉ nói bình luận bài viết, quyền thường chỉ tới người có vai trò trong app (Bước 0). Meta
  Business AI bản thử tiếng Việt 8/4/2026 → #137.
- **Luật:** Nghị định 142/2026 Điều 18 (nhãn AI được thông báo bằng lời) → #131; Nghị định 248/2026 (hướng dẫn Luật TMĐT); Nghị định
  141/2026 (ngưỡng thuế 1 tỷ đồng/năm).
- **Kết luận:** đổi phương pháp máy đọc (bắt buộc); Decisions là cách mới cho việc chọn trong danh sách (F-112, F-113). Phần còn lại không đổi.

**Tra 28/9/2026 (khi code BH9):**
- **GPT Live 1** (developers.openai.com — trang model gpt-live-1): vào / ra tiếng và chữ, **không nhận ảnh, video**; 0,05 USD / phút tính theo giây. Chưa thấy lệnh dừng câu cho kết nối WebSocket (`output_audio_buffer.clear` là của WebRTC) → MOZA tự bỏ tiếng còn lại khi đính chính.
- **Gemini 3.8 Live** (ai.google.dev, cập nhật 15/9/2026): vào chữ, ảnh, tiếng, video; bật được chữ chép tiếng ra. `turn_complete = true` ngắt ngay lượt đang nói → dùng cho `dinhChinh`.
- **obs-websocket 5.x** `GetSourceScreenshot`: sourceName / sourceUuid, imageFormat (lấy từ `GetVersion.supportedImageFormats`), rộng / cao 8–4096 (giữ tỷ lệ), chất lượng −1…100; trả `imageData` base64.
- **gpt-6-luna**: nhận ảnh (JPEG, PNG, GIF, WebP); 0,10 USD / 1 triệu token vào, 0,01 lưu đệm, 0,50 ra. Responses API `detail` nhận low / high / original / auto — low thu ảnh về trong 512 × 512.
- **Kết luận:** không có gì đổi phương pháp. "MOZA nhìn" vẫn qua gpt-6-luna, vì GPT Live 1 chưa nhận ảnh.

**Tra 28/9/2026 (khi code BH8):**
- **Messenger mẫu tin (Utility templates):** tin ngoài 24 giờ chỉ gửi bằng mẫu Utility đã duyệt. Meta có thể xếp lại mẫu thành Tiếp thị — khi đó MOZA không dùng mẫu đó (bảng trạng thái từng mẫu ở "Tạo bộ mẫu tin").
- **Hãng vận chuyển:** GHTK, GHN, Viettel Post, J&T — file mẫu nhập đơn hàng loạt chỉ tải được sau khi đăng nhập trang khách hàng. Không lấy được mẫu cột chính thức, nên để "cần file mẫu".
- **Tỉnh thành:** danh mục 34 tỉnh theo Nghị quyết 202/2025/QH15 (có bảng tên tỉnh cũ → tên mới) ở `server/cau-hinh/tinh-thanh.json`.
- **Model:** `soan_bai`, `tong_ket` dùng `gpt-6-luna` như kế hoạch 3.4 (tra 27/9); dự phòng `gemini-3.5-flash-lite`.
- Không có gì đổi phương pháp.

**Tra 28/9/2026 (khi code BH7):** Messenger (developers.facebook.com, trang Buttons, Persistent Menu, Quick Replies): nút gọi điện
`phone_number` vẫn dùng được, tiêu đề nút < 20 ký tự; menu cố định cần nút Bắt đầu, tối đa 20 mục (khuyên 5), tiêu đề ≤ 30 ký tự, chỉ
`postback` / `web_url`; trả lời nhanh tối đa 13, nhãn ≤ 20, `user_phone_number` vẫn dùng được. **Tài liệu chỉ ví dụ trả lời nhanh gắn
tin chữ** — gắn vào thẻ nút (F-88, F-90) chưa kiểm được: để Bước 0; không được thì tách thành tin chữ có trả lời nhanh + tin nút.
VietQR: gọi thử quick link `img.vietqr.io/image/{bin}-{stk}-compact2.png?amount&addInfo&accountName` với số tài khoản mẫu (trả PNG có
logo ngân hàng, tên chủ TK, số tiền); danh sách ngân hàng từ `api.vietqr.io/v2/banks` (65 ngân hàng, lấy 42 ngân hàng hỗ trợ chuyển
khoản vào `server/cau-hinh/ngan-hang.json`). Bình luận video xem lại: GET / POST `/{video-id}/comments` — CHƯA kiểm trên Page thật
(Bước 0: bình luận xem lại có về webhook không, có `live_broadcast_timestamp` không, Page bình luận lên video id được không).
Không có gì đổi phương pháp.

**Tra 28/9/2026 (khi code BH6):** Gemini 3.8 Live nhận `custom_vocabulary` trong cấu hình chép lời tiếng vào (`input_audio_transcription`)
— trước đây chỉ bản `gemini-3.5-transcribe-live` nhận; tốt nhất ≤ 100 cụm, chỉ từ riêng / tên riêng (ai.google.dev "Live
transcription", docs.cloud.google.com "Developer's guide to Gemini 3.8 Live"). → F-87 nạp cho cả miệng Gemini. GPT Live 1 vẫn không có
chỗ nạp. Giá `gemini-3.5-transcribe-live` 3,50 / 21 giữ nguyên (tra 27/9).

**Tra 28/9/2026 (khi code BH5):** không có gì đổi phương pháp so với bản tra 27/9. Link mở một cuộc trò chuyện trong hộp thư Meta
Business Suite (F-78) Meta không ghi trong tài liệu; dạng lấy từ thanh địa chỉ của Business Suite
(`business.facebook.com/latest/inbox/all?asset_id=<Page>&selected_item_id=<người nhắn>&thread_type=FB_MESSAGE`) — kiểm ở B0-17,
sai thì lùi về hộp thư chung của Page (`asset_id` thôi).

---

## 7. Dữ liệu

Quy ước giữ SPEC-TD mục 7 (ID tiền tố + base36, giờ UTC, NFC, số điện thoại `+84…`). **Tiền: số nguyên VND ở mọi nơi**
(giá, đơn giá, phí ship, tổng tiền) — khác bản tuyển dụng (tiền trong ô Thông tin là chữ tự do).

### Bảng mới

| Bảng | Trường chính | Ghi chú |
| --- | --- | --- |
| `san_pham` | `video` JSON `[{ "tep", "mau" \| null }]` (tối đa 3, MP4 / WebM, nâng cấp 017, #90) · `id` (`sp_…`), `so` INTEGER UNIQUE, `ten`, `danh_muc` (khóa trong `danh-muc.json`), `trang_thai` ∈ {`nhap`,`dang_ban`,`ngung_ban`}, `thuong_hieu`, `gia` (giá bán), `gia_goc` NULL, `gia_von` NULL (nội bộ), `thong_so` JSON (khóa theo `thong-so.json`, ví dụ `{ "doi_tuong": "nu", "chat_lieu": ["linen","cotton"], "chat_lieu_ghi": "Linen 70%, cotton 30%", "kieu_dang": "suong", … }`), `bang_size_id` NULL, `nhom` JSON `{ "t1": "Màu", "t2": "Cỡ" \| null }`, `anh` JSON `[{ "tep", "mau" \| null }]` (ảnh đầu là đại diện, tối đa 9), `can_nang_g` NULL, `kich_thuoc_cm` JSON NULL `[d, r, c]`, `mo_ta`, `diem_noi_bat` JSON (3–5 chuỗi), `ten_goi_khac` JSON, `phoi_cung` JSON (id sản phẩm), `hoi_dap` JSON `[{ "hoi", "dap" }]`, `ghi_chu_noi_bo`, `ai_doan` JSON (danh sách ô AI điền chưa được người lưu), `phien_ban`, `tao_luc`, `sua_luc` | Bản đang dùng (F-51). Thông số là JSON theo cấu hình để thêm danh mục không phải nâng cấu trúc |
| `san_pham_ban_sua` | `san_pham_id`, `phien_ban`, `noi_dung` JSON (chụp mọi ô trừ tồn kho), `luc` · PK(`san_pham_id`,`phien_ban`) | Chỉ thêm |
| `phan_loai` | `id` (`pl_…`), `san_pham_id`, `gt1`, `gt2` (NULL khi không có nhóm 2), `sku` UNIQUE, `gia` NULL (NULL = giá của mẫu), `can_nang_g` NULL, `ton` INTEGER ≥ 0, `bo` (1 = không bán tổ hợp này) · UNIQUE(`san_pham_id`,`gt1`,`gt2`) | Tồn trong kho (F-52) |
| `bang_size` | `id` (`bs_…`), `ten`, `cot` JSON (khóa cột: `chieu_cao`, `can_nang`, `vong_nguc`, `vong_eo`, `vong_mong`, `dai_ao`, `dai_quan`, `rong_vai`…), `hang` JSON `[{ "co": "M", "chieu_cao": "155–162 cm", "can_nang": "48–55 kg", … }]`, `phien_ban`, `sua_luc` | Bảng size dùng chung hoặc riêng (F-51 nhóm 4). Bản sửa lưu như `so_tay_ban_sua` (thêm bảng `bang_size_ban_sua`) |
| `kho_lich_su` | `id`, `phan_loai_id`, `thay_doi` (+/−), `ton_sau`, `ly_do` ∈ {`nhap_hang`,`dieu_chinh`,`gui_don`,`nhan_hoan`}, `don_id` NULL, `ghi_chu`, `boi` ∈ {`nguoi`,`he_thong`}, `luc` | Chỉ thêm |
| `khach` | `id` (`kh_…`), `ten`, `sdt` UNIQUE NULL, `dia_chi`, `ghi_chu`, `nguon_hoi_thoai_id`, `nguon_phien_live_id`, `dong_y_luc`, `tao_boi` ∈ {`ai`,`nguoi`}, `nguoi_sua_luc`, `gop_vao`, `xoa_luc`, `dien_tap`, `tao_luc` | Thay `ung_vien` (F-54). Số đơn, số hoàn, tổng mua tính từ `don` |
| `don` | `id` (`dh_…`), `ma` UNIQUE (`DH-0001`…), `page_id`, `nguoi_fb_id` NULL, `khach_id` NULL, `hoi_thoai_id` NULL, `phien_live_id` NULL, `binh_luan_id` NULL, `nguon` ∈ {`binh_luan_live`,`tin_nhan`,`nguoi`}, `trang_thai` ∈ {`cho_xac_nhan`,`da_xac_nhan`,`da_gui`,`da_giao`,`hoan`,`da_huy`}, `ten_nhan`, `sdt_nhan`, `dia_chi_nhan`, `thanh_toan` ∈ {`cod`,`chuyen_khoan`}, `da_nhan_tien_luc`, `phi_ship`, `tong_hang`, `tong_tien`, `giu_den` NULL, `ma_van_don`, `ghi_chu`, `ly_do_huy`, `da_nhan_hoan_luc`, `nguoi_sua_luc`, `dien_tap`, `tao_luc`, `sua_luc` | F-55. `tong_hang`, `tong_tien` do nghiệp vụ tính lại mỗi lần sửa |
| `don_dong` | `id`, `don_id`, `phan_loai_id`, `san_pham_id`, `san_pham_phien_ban`, `so_luong` ≥ 1, `don_gia` (giá riêng của phân loại nếu có, không thì giá mẫu — chụp lúc thêm), `gia_von_chup` NULL (cho báo cáo lãi gộp), `ten_chup` ("Áo 12 · Sơ mi linen · Đen / M") | Dòng hàng |
| `don_lich_su` | `id`, `don_id`, `tu`, `den`, `nguon` ∈ {`ai`,`nguoi`,`khach_tu_bao`,`he_thong`}, `bang_chung_tin_nhan_id`, `agent_run_id`, `ghi_chu`, `da_hoan_tac`, `luc` | Cho hoàn tác |

### Bảng giữ, đổi cột

| Bảng | Đổi |
| --- | --- |
| `hoi_thoai` | `ung_vien_id` → `khach_id`; `ma_tin_goi_y` → `san_pham_goi_y` (id) |
| `bo_nho` | `ung_vien_id` → `khach_id` |
| `viec` | `loai` ∈ {`goi_xac_nhan_don`, `goi_khach`, `bo_sung_thong_tin`, `khac`}; `ung_vien_id` → `khach_id`; `lich_hen_id` → `don_id` |
| `kich_ban` | `doan` JSON `[{san_pham_id \| null, loi_nhac}]` |
| `phien_live_tin`, `dong_thoi_gian_tin` | Thành `phien_live_san_pham` (`phien_id`, `san_pham_id`, `phien_ban`), `dong_thoi_gian_san_pham` (`phien_id`, `doan`, `san_pham_id` NULL, `tu_luc`) |
| `binh_luan_live` | `ma_tin_doan` → `san_pham_doan`; `xu_ly` thêm `da_chot`; thêm `don_id` NULL; `nhan` thêm `chot` |
| `cau_tren_song` | `ma_tin` → `san_pham_id` |
| `agent_run` | `tin_id`, `tin_phien_ban` → `san_pham_id`, `san_pham_phien_ban` |
| `cai_dat` | Thêm khóa `ban_hang` = `{ ten_shop, sdt_shop, dia_chi_shop, phi_ship, mien_phi_tu, gio_giu, nguong_sap_het, nguong_hoan }` |

**Bỏ:** `tin`, `tin_ban_sua`, `ung_vien`, `ung_tuyen`, `ung_tuyen_lich_su`, `lich_hen`.
Các bảng khác (`so_tay`, `fb_page`, `nguoi_fb`, `tin_nhan`, `skill`, `vai_tro_ban_sua`, `agent`, `luat_quyen`, `hook_bat`,
`goi_cong_cu`, `nhat_ky_hook`, `cho_duyet`, `danh_gia`, `bai_hoc`, `moc_facebook`, `giong_mai`, `skill_ban_sua`,
`so_tay_ban_sua`, `phien_live`) giữ nguyên. (`bai_thi`, `ket_qua_thi` của SPEC-TD chưa từng được tạo vì bài thi dời, #32.)

### Chuyển trạng thái đơn

| Từ → Đến | AI được làm khi | Người | Kho |
| --- | --- | --- | --- |
| (tạo) → `cho_xac_nhan` | Bình luận chốt hợp lệ, hoặc khách nói muốn mua trong tin nhắn | Được | Giữ hàng |
| `cho_xac_nhan` → `da_xac_nhan` | Đủ tên, số điện thoại, địa chỉ; AI đã đọc lại đơn và tổng tiền; **khách nói đồng ý** (bằng chứng là tin nhắn); khách không có nhãn "từng hoàn ≥ ngưỡng" | Được | Giữ tiếp, bỏ hạn giữ |
| `cho_xac_nhan` / `da_xac_nhan` → `da_huy` | **Chỉ** khi khách tự nói hủy (bằng chứng); hoặc hệ thống hủy vì quá giờ giữ (chỉ `cho_xac_nhan`) | Được | Trả hàng |
| `da_xac_nhan` → `da_gui` | **Cấm** | Được | Trừ tồn, bỏ giữ |
| `da_gui` → `da_giao` / `hoan` | **Cấm** | Được | — |
| `hoan` → nhận hàng hoàn (`da_nhan_hoan_luc`) | **Cấm** | Được | Cộng tồn |
| Mọi chuyển khác | **Cấm** | Được (trừ lùi từ `da_gui` về trước: phải "Hoàn") | — |
| `da_xac_nhan` → `cho_xac_nhan` (từ bản 3.4, #113) | Khi đơn đã xác nhận bị đổi món theo lời khách, bởi AI hay do gộp đơn (F-90) — gửi thẻ đơn mới để khách xác nhận lại | Người sửa tay thì giữ nguyên trạng thái | Giữ tiếp theo món mới |

### Quy tắc hợp lệ (bất biến)
- Với mọi phân loại: `ton` ≥ 0 và **đang giữ ≤ ton** (còn bán được ≥ 0). Kiểm trong cùng giao dịch với mọi lần giữ, sửa đơn, gửi.
- `san_pham_ban_sua`, `bang_size_ban_sua`, `kho_lich_su`, `don_lich_su` chỉ thêm.
- `gia_von`, `ghi_chu_noi_bo` không bao giờ xuất hiện trong thẻ sản phẩm, ngữ cảnh AI, nhật ký AI hay phiếu gửi hàng (test).
- Mọi khóa trong `san_pham.thong_so` phải có trong bộ thông số của danh mục (kiểm lúc lưu; khóa lạ bị bỏ, báo người dùng).
- `ton` hiện tại = tổng `thay_doi` trong `kho_lich_su` của phân loại đó (test đối chiếu).
- `don.tong_tien` = Σ(`so_luong` × `don_gia`) + `phi_ship`.
- Đơn `da_gui` trở đi không đổi dòng hàng.
- Mọi dòng `don_lich_su` có `nguon = ai` tuân bảng chuyển trạng thái.
- Giữ từ SPEC-TD: một `khoa_chong_trung` tối đa một lần gửi thật; tin `ra` của AI có `agent_run_id`; `ai_tam_dung = 1` → AI không gửi; mỗi bình luận tối đa một tin nhắn riêng; dòng `dien_tap = 1` không đi qua Facebook thật.

### Lưu trữ
- `data/moza.db`; `data/anh/<san_pham_id>/` (ảnh sản phẩm — **nằm trong bản sao lưu**: nút Sao lưu chép cả thư mục ảnh); `data/giong/`, `data/doi-ai/` như SPEC-TD.
- **Lần nâng cấu trúc bán hàng** (`server/db/nang-cap/012-ban-hang.sql`, số tiếp theo sau các tệp hiện có): tự sao lưu như mọi lần nâng; tạo bảng mới, đổi cột, bỏ bảng tuyển dụng. Dọn dữ liệu cũ theo #66 là việc làm **một lần** ở BH1, có sao lưu riêng trước.

### Đợt cải tiến 3.4 — bảng, cột mới (#126)

Quy ước: không thêm giá trị vào cột đang có CHECK (SQLite phải dựng lại bảng); dùng bảng / cột mới; cột "loại" mới không đặt
CHECK (kiểm trong mã như `viec.loai`); mỗi mốc một tệp, tự sao lưu trước khi nâng. Khóa `cai_dat` mới không cần SQL.

| Tệp | Mốc | Nội dung |
| --- | --- | --- |
| `018-khong-roi-don.sql` | BH5 | Bảng `luot_nhan_rieng` (`fb_comment_id` PK, `page_id`, `boi`, `binh_luan_id`, `hoi_thoai_id`, `trang_thai` ∈ {`giu`,`da_gui`,`loi`}, `luc`) + điền lại từ `tin_nhan` loại nhắn riêng; bảng `lien_he` (`nguoi_fb_id`, `don_id`, `phien_live_id`, `loai`, `luc`); bảng `nhan_bu` (`fb_comment_id`, `binh_luan_id`, `don_id`, `page_id`, `han_luc`, `trang_thai`, `ly_do`, `tao_luc`, `xu_ly_luc`); bảng `anh_fb` (`page_id`, `tep`, `attachment_id`, `tai_luc`); cột `nguoi_fb.ngung_lien_he_luc`; `don.khach_bam_luc`, `nhac_lan`, `nhac_cuoi_luc`, `bao_huy_luc`, `gia_han_goi_luc`; `phien_live.fb_video_id`, `fb_link`, `bat_dau_fb`. Khóa Cài đặt mới: `dung_ai`, `lien_he`, `fb_mau_utility` (dạng bộ, đọc được dạng cũ), `ban_hang.gio_giu_ngan`, `phu_trach`, `xung_ho`, `ten_chu_tk`, `tran_ngay_co_live` |
| `019-tren-song.sql` | BH6 | Bảng `nhat_ky_song` (`phien_id`, `luc`, `loai` ∈ mai/doi_ai/nguoi_dan/man_hinh/su_kien, `noi_dung`, `san_pham_id`, `canh_bao`); `san_pham.video[].dung_thu = true` cho 14 video dựng thử (Claude Code kiểm danh sách trước khi chạy) |
| `020-khep-kin-don.sql` | BH7 | Cột `don.sdt_goi_y`, `hoi_gop_luc`, `goi_y_phoi_luc`, `gop_vao`; bảng `cho_hang` (danh sách chờ); cột `khach.chieu_cao_cm`, `can_nang_kg`, `so_do_luc`, `so_do_hoi_luc`; `phien_live_san_pham.gia_live`; `don_dong.gia_thuong`; `phien_live.xem_lai_con_tro`, `muc_luc_luc`, `muc_luc_fb_id`; Tư vấn viên thêm công cụ `gui_ma_chuyen_khoan`. Khóa Cài đặt: `ban_hang.ngan_hang`, `so_tk`, `gia_live_bat` (tắt), `hoi_so_do` (tắt) |
| `021-truoc-sau-live.sql` | BH8 | Bảng `dong_y_nhan_tin` (nguyên văn câu hỏi, giờ bấm, rút, nhắc; UNIQUE người + buổi); bảng `anh_khach` (xin phép, đồng ý, che mặt, duyệt, gỡ); cột `don.hoi_lai`, `hoi_lai_luc`, `hoi_mac_luc`, `phan_hoi_mac`, `phan_hoi_mac_luc`; `phien_live.tong_ket`; agent mới `soan_bai`, `tong_ket` (`gpt-6-luna`, dự phòng `gemini-3.5-flash-lite`); `quan_ly` thêm `dat_ban_hang`, `ghi_so_tay`. Khóa Cài đặt: `lich_live`, `ban_hang.hang_van_chuyen`, `nguong_don_lon` (500.000đ), `so_ngay_hoi_mac` (4), `doi_tra_ngan`, `gio_nghe_may`, `da_dat`, `dung_anh_khach` (tắt) · bảng `anh_khach` có thêm `lan_hoi` (gom ảnh 2 phút), `hoi_luc`, `tu_choi_luc`, `loi` |
| `022-thu-nghiem-ai.sql` | BH9 | Bảng `loi_noi_song` (câu Mai nói sai / nghi sai, giá trị nói và đúng, lúc đính chính); bảng `don_danh_dau` (đơn chốt trong khoảng nói nhầm); agent mới `nhin_mon` (`gpt-6-luna`, suy nghĩ tắt, không dự phòng, ≤ 1 lần / 8 giây) |

Hạn giữ dữ liệu mới: `nhat_ky_song` và bình luận không gắn đơn 90 ngày (xóa nội dung và tên, giữ số đếm); số đo khách và ảnh
khách chỉ khi khách đồng ý, xóa theo "Xóa dữ liệu của tôi"; không lưu ảnh camera (F-107) và không lưu gì của người chuyển khoản.

---

## 8. Giao diện và API

### Màn hình

**Từ GD1 (3.11):** menu trái 3 nhóm, "Tổng quan" thành **"Hôm nay"**, "Phiên live" thành **"Bắt đầu live"** 3 bước, Đơn hàng 4 tab,
Sản phẩm 5 tab, "Agent & Skill" thành "Trợ lý AI" trong Cài đặt — chi tiết F-119 → F-126, bản vẽ `docs/10` mục 4. Bảng dưới là hiện trạng.

| Màn hình | Nội dung chính | Trạng thái rỗng |
| --- | --- | --- |
| Tổng quan | F-33 bán hàng | "Không có việc cần làm ngay" |
| **Sản phẩm** | Danh sách (ảnh nhỏ, số, tên, danh mục, giá, còn bán được, trạng thái, độ đầy đủ; lọc theo danh mục, trạng thái, sắp hết); chi tiết chia 6 khối theo F-51 trên **một trang cuộn** (không tab ẩn), ô "AI đoán" tô màu, thanh độ đầy đủ; nút **Tạo từ ảnh**, **Nhân bản**, Xem thử AI hiểu gì; lịch sử bản sửa. Thẻ con **Bảng size** (bảng dùng chung) | Nút "Tạo từ ảnh" to ở giữa |
| **Tồn kho** | Lưới tồn theo sản phẩm; Nhập hàng; Điều chỉnh; lịch sử ra vào; Sắp hết / Hết hàng | "Chưa có sản phẩm" |
| **Đơn hàng** | Thẻ lọc: Chờ xác nhận · Đã xác nhận (Cần gửi) · Đã gửi · Hoàn · Đã hủy · Tất cả; chi tiết đơn; In phiếu; Xuất file; Đã gửi hàng loạt; Tạo đơn tay | "Chưa có đơn nào" |
| **Khách hàng** | Danh sách (tên, số điện thoại, số đơn, số hoàn); chi tiết: thông tin, hội thoại, đơn, bộ nhớ, việc | — |
| Sổ tay | Như cũ, mục mồi của shop | Các mục mồi trống |
| Hộp thư | 3 cột; cột phải: khách + đơn của khách (nút mở đơn) | Mất kết nối Facebook: băng đỏ |
| Livestream | Như cũ; thêm khung "Đơn chốt trong buổi" | "Đang chờ live bắt đầu trên Page…" |
| Agent & Skill, Báo cáo, Cài đặt | Như cũ; Báo cáo theo F-58; Cài đặt thêm Tên shop, nhóm Bán hàng | — |

Thanh trên cùng: như SPEC-TD mục 8, thêm ô **"Nói với Mai"** (F-62) — trả lời hiện trong một khung trượt bên phải, có bảng
xem trước và nút "Làm" / "Bỏ". Phong cách, Màn hình người dẫn: như SPEC-TD mục 8; Màn hình người dẫn có nút "👁 MOZA nhìn"
(F-107, thay nút "Cho Mai xem" của F-64), băng đỏ / vàng khi Mai nói sai / nghi sai số (F-105); Thanh chữ có dòng đính chính.

### API HTTP (`/api`)

| Nhóm | Đường dẫn chính |
| --- | --- |
| Sản phẩm | `GET /san-pham?q=&trang_thai=&danh_muc=&kho=` · `POST /san-pham` · `PUT /san-pham/:id` · `GET /san-pham/:id/ban-sua` · `POST /san-pham/:id/soat` · `POST /san-pham/:id/anh` (thân nhị phân) · `DELETE /san-pham/:id/anh/:ten` · `PUT /san-pham/:id/anh` (thứ tự, gắn màu) · `POST /san-pham/tu-anh` (ảnh đã tải → phiếu AI điền, chưa lưu) · `POST /san-pham/:id/nhan-ban` · `GET /san-pham/:id/the-ai` (xem thẻ AI đọc — để kiểm) · `GET /cau-hinh/danh-muc` (danh mục + bộ thông số) |
| Bảng size | `GET /bang-size` · `POST /bang-size` · `PUT /bang-size/:id` · `GET /bang-size/:id/ban-sua` |
| Nói với Mai | `POST /noi-voi-mai` (`cau` → trả lời, có thể kèm `xem_truoc` và `viec_id`) · `POST /noi-voi-mai/:viec_id/lam` · `POST /noi-voi-mai/:viec_id/bo` |
| Tồn kho | `GET /kho?san_pham_id=` · `POST /kho/nhap` (`[{phan_loai_id, so}]`) · `POST /kho/dieu-chinh` · `GET /kho/lich-su?phan_loai_id=` |
| Đơn hàng | `GET /don?trang_thai=&phien_live_id=&tu=&den=&q=` · `GET /don/:id` · `POST /don` (tạo tay) · `PUT /don/:id` (sửa dòng, người nhận, phí ship) · `POST /don/:id/trang-thai` · `POST /don/:id/hoan-tac` · `POST /don/:id/nhan-tien` · `POST /don/:id/nhan-hoan` · `POST /don/gui` (`ids[]`, mã vận đơn) · `GET /don/phieu?ids=` (trang in) · `GET /don/xuat?ids=` (CSV) |
| Khách hàng | `GET /khach?q=` · `POST /khach` · `PUT /khach/:id` · `POST /khach/:id/gop` · `DELETE /khach/:id/du-lieu` · `PUT/DELETE /bo-nho/:id` |
| Ảnh, video | `GET /anh/:san_pham_id/:ten` · `POST /video-tam` (thân MP4 / WebM) · `GET /video/:san_pham_id/:ten` (có Range) |
| Màn hình sản phẩm, OBS (#90) | `GET /man-hinh` · `POST /man-hinh/chieu` (`mau`, `so`, `mau_sac`, `chieu_cao`, `can_nang`, `so_phoi`) · `POST /canh/chuyen` (`phong` \| `san_pham` \| `ca_hai`) · `POST /canh/bo-goi-y` · `PUT /obs` (`cong`, `bat`, `mat_khau` → `.env`) · `POST /obs/kiem-tra` · `POST /obs/tao-canh` |
| Giữ, đổi tên | Hộp thư, Việc, Kịch bản, Đội AI, Live, Diễn tập, Agent, Nhật ký, Báo cáo, Cài đặt như SPEC-TD; mọi tham số `ma_tin` → `san_pham_id`; `POST /hoi-thoai/:id/tao-ung-vien` → `/tao-khach`; `POST /cai-dat` nhận khóa `ban_hang` |

**Bỏ:** `/tin`, `/ung-vien`, `/ung-tuyen`, `/lich-hen`.

### WebSocket `/ws`
Giữ SPEC-TD; thêm `live.chot` (vừa ghi nhận chốt: tên gọi, món, đơn), `don.cap_nhat`, `kho.cap_nhat` (phân loại, còn bán được); `live.bao` có mức đỏ khi sản phẩm vừa Ngừng bán. #90: `mhsp.hien` (nội dung Màn hình sản phẩm), `mhsp.chot` (thanh chữ báo người vừa chốt), `canh.cap_nhat` (cảnh đang lên sóng, gợi ý, chế độ, trạng thái OBS).

### Mã lỗi
Giữ SPEC-TD mục 8, trừ `TIN_TRUNG_MA`, `TIN_KHONG_DUNG_DUOC`, `LICH_KHONG_CO_NGUON` (bỏ). Thêm:

| Mã | Ý nghĩa | Xử lý |
| --- | --- | --- |
| `SP_TRUNG_SO` | Số sản phẩm đã có | Người dùng đổi số |
| `SKU_TRUNG` | Mã phân loại đã có | Người dùng đổi mã |
| `THONG_SO_LA` | Ô thông số không thuộc danh mục | Bỏ ô đó, báo người dùng |
| `SP_KHONG_BAN_DUOC` | Sản phẩm Nháp hoặc Ngừng bán | AI chọn sản phẩm khác, báo khách |
| `MIENG_NOI_SAI` | (F-105, định nghĩa lại) Mai nói sai số chắc chắn trên sóng | Bỏ tiếng còn lại, đính chính, băng đỏ; lần 2 / 3 lỗi → "Chỉ gợi ý" |
| `MIENG_CHI_DIEN_TAP` | Chọn miệng giả cho buổi live thật | Chọn miệng thật, hoặc tập ở Phòng diễn tập |
| `OBS_CHUA_NOI` · `KHONG_CO_CAMERA` | Bật MOZA nhìn khi chưa nối OBS / cảnh Phòng live chưa có camera | Cài đặt → OBS; thêm camera vào cảnh "Moza · Phòng live" |
| `DON_DA_GUI` | Đổi giá đơn đã gửi (Giữ giá đúng / Bán theo giá Mai nói) | Xử lý ngoài MOZA với khách |
| `PHAN_LOAI_KHONG_CO` | Màu / cỡ không có ở sản phẩm này | AI hỏi lại, kèm danh sách còn hàng |
| `HET_HANG` / `KHONG_DU_HANG` | Còn bán được = 0 / nhỏ hơn số khách muốn | Báo khách; gợi ý phân loại khác |
| `DON_KHONG_SUA_DUOC` | Đơn đã gửi trở đi | Chặn |
| `THIEU_THONG_TIN_GIAO` | Xác nhận đơn khi thiếu tên, số điện thoại hoặc địa chỉ | AI xin tiếp |
| `CAN_GOI_XAC_NHAN` | Khách từng hoàn ≥ ngưỡng (#73) | Không xác nhận; tạo việc cho người dùng |
| `ANH_KHONG_HOP_LE` | Tệp không phải ảnh hoặc quá 3 MB | Báo dưới ô ảnh |

---

## 9. Lỗi, bảo mật, quyền riêng tư

Giữ SPEC-TD mục 9 (mất mạng, sập tiến trình, đường hầm, bí mật trong `.env`, kiểm tên máy và nguồn, cổng webhook, đầu vào
không tin cậy). Thêm:

- **Dữ liệu khách mới:** địa chỉ giao hàng. Gửi nguyên văn cho nhà cung cấp AI như số điện thoại (#18). Không bao giờ đọc
  trên sóng hay viết công khai (Bộ kiểm tra K5, K6). Ẩn bình luận công khai có số điện thoại giữ nguyên (#19); thêm địa chỉ
  nhà nếu nhận ra được bằng quy tắc đơn giản (số nhà + đường / phường) — *N, làm nếu dễ*.
- **Phiếu gửi hàng và file CSV** chứa dữ liệu cá nhân: chỉ tạo khi người dùng bấm; không lưu thêm bản ở đâu.
- **Ảnh sản phẩm:** chỉ phục vụ ở `127.0.0.1`; tên tệp do MOZA đặt, không dùng tên người dùng gửi lên (tránh chèn đường dẫn).
  Ngoại lệ duy nhất: đường ảnh hẹp trên cổng webhook cho thẻ giữ hàng (#97, mục 5) — test phải kiểm: ảnh sản phẩm Nháp / Ngừng
  bán, ảnh khách, video, tên tệp thật, đường dẫn có `..` đều trả 404.
- **Pháp lý — mức vừa đủ (#71).** Ghi để nhớ, rà lại với người có chuyên môn **trước khi live thật với khách lạ**:
  - **Luật Thương mại điện tử 2025, hiệu lực 1/7/2026**: livestream bán hàng trên nền tảng thương mại điện tử phải xác thực
    danh tính người livestream; người bán phải có giấy tờ điều kiện kinh doanh và chất lượng hàng hóa trước khi live; nội dung
    live bám sát nội dung quảng cáo, không thổi phồng — [nguồn](https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/chinh-sach-moi/107004/luat-thuong-mai-dien-tu-moi-nhat-va-trach-nhiem-cua-nguoi-livestream-ban-hang-tu-01-7-2026),
    [nguồn](https://doanhnghiephoinhap.vn/5-quy-dinh-moi-khong-the-bo-qua-khi-livestream-ban-hang-tu-172026-134275.html) (tra 25/9/2026).
    Phạm vi áp dụng với bán qua mạng xã hội (Facebook Page) **chưa rõ** trong nguồn đã đọc → hỏi chuyên gia.
  - Luật Trí tuệ nhân tạo 134/2025/QH15 (nhãn "có sử dụng giọng nói AI", AI tự giới thiệu) — giữ #52.
  - Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (số điện thoại, địa chỉ, giọng nhân bản) — giữ cách làm SPEC-TD mục 9.
  - Bảo vệ quyền lợi người tiêu dùng: thông tin hàng hóa, giá, chính sách đổi trả rõ ràng — Sổ tay shop là nơi ghi, AI chỉ nói theo đó.
  - Đố vui không treo thưởng; mã giảm giá, bốc thăm ngoài phạm vi (khuyến mại có quy định riêng).
  - **Giá gốc** (F-51): chỉ ghi khi là giá đã bán thật; AI chỉ nói "giảm từ …" khi có ô này. Màn hình nhắc điều này ngay dưới ô.
  - **Ảnh do AI điền thông tin** (#75): chất liệu, xuất xứ phải được người xác nhận trước khi AI nói với khách như sự thật —
    ô còn nhãn "AI đoán" thì thẻ sản phẩm ghi "(chưa xác nhận)" và AI không khẳng định.

---

## 10. Yêu cầu phi chức năng

Giữ SPEC-TD mục 10 (mục tiêu tham khảo, không đo tới khi xong). Thêm *(ước tính)*:

| Chỉ tiêu | Mục tiêu |
| --- | --- |
| Bình luận chốt → đơn Chờ xác nhận + giữ hàng | ≤ 2 giây sau khi bình luận về MOZA |
| Bình luận chốt → tin nhắn riêng gửi đi | ≤ 30 giây |
| Giữ hàng song song | 50 bình luận chốt trong 10 giây không sai tồn |
| Danh sách 500 sản phẩm, 5.000 đơn | Mở trong ≤ 1 giây |
| Nhắn riêng | ≤ 750 lần/giờ mỗi Page (giới hạn Meta, SPEC-TD A.10) |

**Giới hạn đã biết** (thêm vào danh sách SPEC-TD): khách chốt nhưng không mở tin nhắn riêng thì AI không nhắn tiếp được
(Meta chỉ mở hội thoại khi khách trả lời); ngoài 24 giờ không báo được "đã gửi hàng" qua Messenger.

---

## 11. Kiểm thử

Giữ SPEC-TD mục 11 (`node:test`, AI và Facebook giả, không gọi thật trong `npm test`). Thêm:

| Loại | Kiểm cái gì | Tiêu chí |
| --- | --- | --- |
| Đơn vị | Nhận ra bình luận chốt với ≥ 60 câu mẫu (F-53) | 100% đúng |
| Đơn vị | Đọc giá "289k", "1tr2", "289.000đ" → số nguyên | 100% đúng |
| Đơn vị | Bảng chuyển trạng thái đơn; tính tổng tiền, phí ship, miễn phí từ | 100% |
| Tích hợp | Giữ hàng song song (nhiều lời gọi cùng lúc tới `kho.giu`) — không bao giờ âm, không bán quá | 0 lần sai |
| Tích hợp | Đối chiếu `ton` với tổng `kho_lich_su` sau một chuỗi thao tác ngẫu nhiên (nhập, chốt, sửa, hủy, gửi, hoàn) | Luôn khớp |
| Tích hợp | Luồng 3 trọn qua Facebook giả với AI giả | Đúng trạng thái cuối, đúng số tin gửi, đúng tồn |
| Đơn vị | Bộ kiểm tra bán hàng ≥ 60 câu mẫu (A.4): sai giá, sai số còn, sai tổng, hứa giảm giá, số khách tự nói | 100% đúng |
| Rà chữ | Không còn "tuyển dụng", "nhà máy", "ứng viên", "Bắc Ninh Work" trong giao diện, lời dặn mẫu, Skill mẫu, câu mẫu | 0 kết quả (trừ SPEC-TD, docs cũ, chú thích lịch sử) |
| Đơn vị | Thẻ sản phẩm: đủ nhãn, không có giá vốn, ghi chú nội bộ; ô "AI đoán" ghi "(chưa xác nhận)"; giá riêng phân loại hiện đúng | 100% |
| Đơn vị | `thong-so.json` / `danh-muc.json` hợp lệ; đổi danh mục giữ ô trùng tên | 100% |
| Tích hợp | "Tạo từ ảnh" và "Nói với Mai" với AI giả: phiếu đúng lược đồ; việc có ảnh hưởng chỉ ghi sau "Làm" | 100% |
| Tích hợp | Miệng Gemini giả: không gửi `turnComplete: true` khi Mai đang phát tiếng (#81); công cụ `xem_con_hang` trả đúng số lúc gọi (#80) | 100% |

### Đợt cải tiến 3.4 — test, giả lập Facebook, ngân sách thử AI (#92 → #94)

Thiết kế đầy đủ: `docs/07-gia-lap-facebook.md` (24 hành vi H01–H24, Phòng diễn tập, Bước 0, rủi ro giả lập lệch thật).

**Nguyên tắc:** mọi test và mọi lượt Claude Code tự lái dùng AI giả, Facebook giả, khách giả soạn sẵn — 0 đồng. Chỉ các phép thử ở bảng ngân sách dưới đây gọi AI thật, và chỉ khi chủ dự án đồng ý.

| Tầng | Tệp | Kiểm gì |
| --- | --- | --- |
| Đơn vị | `test/meta-gia.test.js` (mới) | Luật của Meta giả: 1 tin mỗi bình luận, 7 ngày, 24 giờ, giới hạn thẻ, Page bị hạn chế, mẫu Utility, menu, đồng hồ và tua |
| Đơn vị | `test/facebook.test.js` (thêm) | Đọc webhook: trả lời nhanh, hai kiểu giới thiệu m.me, bình luận bài của video live; đổi lỗi 1893063; quyền mới |
| Hợp đồng | `test/hop-dong-facebook.test.js` (mới) | Cùng kịch bản chạy trên bản giả và bản thật nối `fetch` giả → cùng kết quả, cùng mã lỗi; hai bản đủ hàm; mọi hành vi có nguồn và test |
| Nghiệp vụ | test của từng tính năng (F-65 → F-107) | Theo tiêu chí; khách soạn sẵn không gọi AI |
| Dồn tải | `test/dien-tap-tai.test.js` (mới) | 50 người chốt trong 1 phút giả: 0 bỏ sót, 0 bán quá, mỗi người một kết cục; qua lớp `that.js` với mức dùng 60% và 85% |
| Tay (Claude Code) | Bản xem thử `moza`, cổng 5190 | Chạy kịch bản, bấm nút trong Messenger giả, chụp màn hình, đọc nhật ký tự chấm |

**Tình huống Facebook trong Phòng diễn tập:** Thận trọng (mặc định: nhắn riêng bình luận live được; 50% người mới vào Tin nhắn chờ; tin thứ hai bị chặn; bình luận live về cả hai đường; bình luận xem lại không có mốc giây) · Xấu nhất · Page bị hạn chế · Ứng dụng chưa duyệt · Hỗn loạn nhẹ. Chỗ nào trong mã dựa vào hành vi chưa kiểm chứng thì ghi chú `[CHƯA KIỂM CHỨNG Hxx]`.

#### Bước 0 — buổi thử Facebook thật

**Bước 0** (60–90 phút, chủ dự án cầm điện thoại, tài khoản người thử bình luận; `scripts/thu-facebook/cong.js` viết lại cho bán hàng, chế độ ghi mẫu `MOZA_GHI_FB=1` lưu vào `data/fb-ghi/`):

| Bước | Làm gì | Hành vi |
| --- | --- | --- |
| B0-1, 2 | Tự động: mã, 7 quyền (có `page_utility_messaging`), Page Integrity; webhook qua đường hầm | H15, H16 |
| B0-3 | Phát live: id live, id video, giờ Facebook so với giờ MOZA thấy, số người xem, link | H09–H11 |
| B0-4 | Page bình luận câu ghim: có về luồng live không (MOZA phải bỏ qua) | H13 |
| B0-5 | "chốt 12 đen M": `can_reply_privately`; thẻ ảnh qua đường hầm; hộp chính hay Tin nhắn chờ; có ảnh, nút; có tên người gửi (chụp màn hình) | H01, H06, H07, H22 |
| B0-6 | "ib": thẻ dùng ảnh đã tải lên; tắt / mở đường hầm rồi xem ảnh ở thẻ cũ còn không | H06 |
| B0-7, 8 | Tin thứ hai khi người thử chưa trả lời; nhắn riêng lần 2 cùng bình luận: được hay mã lỗi gì | H01, H02 |
| B0-9 | Bấm nút thẻ; trả lời nhanh số điện thoại; nút gọi; cài nút Bắt đầu + menu | H04, H05, H18, H20 |
| B0-10 | Bình luận live có về webhook bài đăng không, khớp id nào; lưới an toàn có thấy bài live | H09 |
| B0-11 | 10 chốt / phút từ 2 tài khoản: thời gian tới thẻ, mức dùng; bình luận một chữ "A" có về luồng live | H21 |
| B0-12, 13 | Hết live, bình luận "chốt 7 trắng L" trên video xem lại; MOZA đăng mục lục: phút có thành link | H10, H12, H13 |
| B0-14 | Mẫu Utility có nút: duyệt bao lâu, xếp loại gì; gửi cho người thử (cả người chỉ từng bấm nút) | H17 |
| B0-15, 16 | (tùy) m.me trên Android và iPhone; tài khoản không có vai trò → lỗi 2018028 | H16, H19 |
| B0-17 | (tùy) nhắn riêng có nút tới người bình luận bài thường; link Business Suite mở đúng hội thoại, trả lời được tới 7 ngày không | H07 |
| B0-18 | Dọn: chủ Page tự quyết xóa video, hội thoại thử | — |

Sau Bước 0: Claude Code ẩn danh mẫu ghi thành dữ liệu test, đổi trạng thái hành vi, sửa `that.js` + `gia.js`, chạy lại test. Rẽ nhánh: không nhắn riêng được bình luận live → đường chính là gom tên công khai + m.me; tin vào Tin nhắn chờ → câu nhắc trên sóng là chính, cân nhắc N dài hơn; không gửi được ảnh → thẻ chữ có nút; được gửi tin thứ hai → nới F-68, F-69 nhưng vẫn qua Hook giới hạn liên hệ. Kết quả với người thử có thể khác khách lạ: kiểm lại ở buổi live thật đầu tiên sau khi ứng dụng được duyệt (đo bằng F-102).

#### Ngân sách thử AI thật (#93)

| Mốc | Phép thử | Hãng, model | Ước | Trần |
| --- | --- | --- | --- | --- |
| BH5 | (tùy) 1 lượt Luồng 3: Tư vấn viên nối sau thẻ | OpenAI `gpt-6-luna` | 0,02–0,05 | 0,05 |
| BH6 | Director / Co-host thật chấm gắn nhãn lưỡng lự | Google `gemini-3.8-flash` | ~0,05 | 0,08 |
| BH6 | (tùy) Transcribe Live 3 phút + ~10 lượt giọng tạo tiếng giả | Google | ~0,03 | — |
| BH7 | 1 lượt gộp: chuyển khoản, số tài khoản, "ck rồi", số đo đã lưu | OpenAI `gpt-6-luna` | 0,03–0,05 | 0,10 |
| BH8 | 3 câu "Nói với Mai" (`gpt-6-sol`), 2 bộ bài, 2 tổng kết (`gpt-6-luna`) | OpenAI | ~0,05 | 0,08 |
| BH9 | P38 bước A: ~100 lần trên khung dựng sẵn | OpenAI `gpt-6-luna` | ~0,05 | 0,08 |
| BH9 | (tùy) P38 bước B: 10 phút camera thật | OpenAI `gpt-6-luna` | 0,02–0,05 | 0,05 |
| BH9 | Kiểm lời Mai 6 phút | Google Gemini 3.8 Live | ~0,15 | 0,20 |
| BH9 | (tùy) Kiểm lời Mai + "câu giá" 3 phút (một lần cho cả BH6 và BH9) | OpenAI GPT Live 1 | 0,15–0,20 | 0,20 |

- **OpenAI:** phần chính ~0,15 USD; chạy hết tùy chọn ~0,56 USD → dưới 1 USD, còn ≥ 0,44 dự phòng. Cộng dồn chạm 0,80 thì dừng mọi phép thử OpenAI.
- **Google:** ~0,23 USD + ≤ 20 lượt giọng. Thử trước 31/12/2026 (từ 1/1/2027 gấp đôi).
- **Anthropic:** 0.
- **Cắt nếu vượt:** (1) bỏ GPT Live 1; (2) "Nói với Mai" thử bằng `gpt-6-luna`; (3) bỏ P38 bước B; (4) bỏ lượt tùy chọn BH5; (5) BH7 còn ~10 lượt. Google: bỏ Transcribe, chấm lưỡng lự 10 bình luận, Gemini Live 3 phút.
- Mỗi lần: báo con số trước, chờ đồng ý, trần giờ tạm 0,5 USD ở bản xem thử, script có trần riêng, ghi vào sổ chi phí mục 12.

#### Claude Code làm thay (#94)
- **Soạn:** mọi câu mẫu tin cho khách (`cau-mau-khach.json`), câu mẫu Đội AI, mẫu Utility chỉ có thông tin, Skill và lời dặn mới (kèm bản cũ vào `*-cu.json`), từ khóa và bộ câu kiểm (ib, dừng, ẩn tên, lừa đảo, muốn xem, số đo, hỏi mua, lưỡng lự, hóng, K11, lời Mai).
- **Thay AI trong test:** khách giả soạn sẵn (~20 tính cách) và các kịch bản diễn tập mới; "đáp án mẫu" cho AI giả; các phần tính bằng mã thay AI (gợi ý giá live 3 mức, chú thích clip, tư vấn size, đếm phiếu).
- **Tự kiểm:** lái bản xem thử bấm nút, tua thời gian, chụp và tự xem ảnh; đọc nhật ký để tự chấm (0 lượt AI cho tin đầu, độ trễ, người bị sót, câu lặp, số lạ, từ cấm); trong lượt thử thật tự gõ vai khách.
- **Dữ liệu:** tệp mẫu chuẩn 4 hãng, 34 tỉnh, danh sách ngân hàng, dữ liệu đơn giả, khung hình thử cho P38 (ffmpeg có sẵn), bản chép lời thử thật thành dữ liệu test.
- **Tra cứu:** tài liệu Meta, Google, OpenAI, obs-websocket, mẫu hãng vận chuyển, VietQR, Luật Quảng cáo — ghi ngày tra.
- **Giấy tờ:** nháp chính sách quyền riêng tư, câu xin đồng ý báo live, giấy đồng ý người mẫu, câu xin phép ảnh khách, chính sách hoàn tiền, câu hỏi luật sư / kế toán; hướng dẫn Bước 0, xét duyệt ứng dụng, cài Messenger cho Page, khai tài khoản thuế, quay video, OBS.

---

## 12. Kế hoạch triển khai

Quy ước repo (thư mục, lệnh, quy tắc code: CommonJS, tên tiếng Việt không dấu, comment giải thích vì sao, SQL chỉ ở
`server/nghiep-vu/` và `server/db/`) giữ SPEC-TD mục 12. Test: đặt `TEMP`/`TMP` sang `data\tam-test`, dùng
`"C:\Program Files\nodejs\node.exe"`. Xem thử bằng `preview_start {name: "moza"}` (cổng 5190); kiểm cổng 5173/5190 trống trước.

| Mốc | Tính năng | Định nghĩa xong | Tag |
| --- | --- | --- | --- |
| **BH0 — Đặc tả** | Bản này | Chủ dự án duyệt `SPEC.md` 3.0 | `bh0-dac-ta` |
| **BH1 — Nền bán hàng** | Dọn dữ liệu (#66), đổi tên (#59), F-02 (nâng cấu trúc), F-03, F-05, **F-51 đầy đủ** (6 nhóm ô, bảng size, danh mục và thông số theo cấu hình, **Tạo từ ảnh**, thẻ sản phẩm, độ đầy đủ, nhân bản), **F-52** (phần kho, chưa có đơn), **F-62** phần BH1 (nhập kho, tìm, xem còn hàng bằng lời), #81 (sửa theo Gemini 3.8 Live), đổi mọi chỗ dùng tin sang sản phẩm để phần mềm vẫn chạy trọn: công cụ, Bộ kiểm tra, lời dặn và Skill mẫu bán hàng, F-17/F-18, F-19/F-20, F-23, F-37 (chọn sản phẩm, Tạo nhanh). Bỏ màn hình Tin tuyển dụng, Ứng viên | `npm test` đạt; "Tạo từ ảnh" điền được sản phẩm thật (ghi chi phí); tạo sản phẩm 3 màu × 4 cỡ có bảng size, nhập kho bằng lời; buổi diễn tập "Chỉ gợi ý" và "Mai nói" giới thiệu sản phẩm đúng giá, tư vấn size đúng bảng; rà chữ tuyển dụng đạt ở phần đã đổi | `bh1-nen` |
| **BH2 — Phòng live bán hàng** | F-45, F-46, F-49, F-50 (đổi), F-16, F-22/F-43 (**miệng tự tra tồn**, #80), F-15 (người xem giả mua hàng), F-38/F-39 câu mẫu, nhạc hiệu và bài hát mới, **phép thử F-64** (báo chi phí trước) | Buổi tập ở cả 4 chế độ với kịch bản AI soạn; giá đúng; Màn hình người dẫn hiện còn bán được; người xem giả hỏi size, giá, ship, còn hàng được trả lời đúng nguồn; kết quả phép thử camera ghi vào mục 12 | `bh2-live` |
| **BH3 — Chốt đơn** | **F-53** (kèm #77), **F-54**, **F-55**, F-52 (giữ hàng theo đơn), **F-31** (bán hàng, công cụ gộp #79), F-26, F-30, F-56, **F-63**, F-62 phần BH3, F-15 kịch bản Messenger | Buổi tập: người xem giả chốt → đơn, giữ hàng, đọc tên trên sóng, nhắn riêng; Luồng 3 và Luồng 4 trọn trên Facebook giả với AI thật; khách giả gửi ảnh tìm mẫu; test giữ hàng song song đạt | `bh3-chot-don` |
| **BH4 — Giao hàng và báo cáo** | **F-57**, F-32, F-33, **F-58** (có lãi gộp theo giá vốn), #73, F-62 phần BH4 | In phiếu, xuất file, Đã gửi / Đã giao / Hoàn đúng kho; báo cáo khớp đếm; rà chữ tuyển dụng đạt toàn bộ | `bh4-giao-hang` |

**Đầu mỗi mốc:** tra lại công nghệ mới nhất (OpenAI, Google, Anthropic, Meta — model, API, tính năng agent) theo nguyên tắc 1
trong `CLAUDE.md`; có gì làm đổi phương pháp thì dừng, đề xuất với chủ dự án trước khi code; ghi ngày tra vào mục 6.

| Mốc | Tính năng | Định nghĩa xong | Tag |
| --- | --- | --- | --- |
| **Song song — Cổng Facebook thật** (#69) | F-06, F-24, F-25, F-56 với Facebook thật | Theo bảng "Cổng Facebook thật" SPEC-TD mục 12, thêm các dòng bán hàng dưới đây | `cong-facebook-that` |
| **Sau khi xong** | F-60, F-61, F-40 → F-42; pháp lý chặt (#127); đo và tinh chỉnh (F-59 đã làm ở #90) | Chủ dự án quyết | — |
| **BH5 — Không rơi đơn** | F-15 mở rộng (Facebook giả mới, khách soạn sẵn, `--ai-gia`), F-65 → F-78; nâng cấp 018. Thứ tự: Facebook giả + F-67 + F-65 → F-76, F-75 → F-66 → F-72 → F-68 → F-69 → F-70 → F-71 → F-73, F-74, F-78 → F-77 | `npm test` đạt (537 test cũ đã sửa theo luật mới + test mới; không gọi thật). Bản xem thử (Facebook giả, khách soạn sẵn, AI giả): 40 người chốt / 60 giây → 40 thẻ ≤ 3 giây, 0 bán quá, 0 lượt AI cho tin đầu; nút, 2 nhắc, báo hủy, Gọi xác nhận (tua thời gian), "ib", ẩn tên, m.me, chốt test, Page bị khóa + nhắn bù, STK bị ẩn, vượt trần → Dừng AI mà chốt đơn vẫn chạy. Có ảnh chụp: Thanh chữ có nhãn, bảng Sẵn sàng, dải vàng, thẻ ảnh. OpenAI ≤ 0,05 USD, Google 0 | `bh5-khong-roi-don` |
| **BH6 — Trên sóng** | F-79 → F-87; 019. Thứ tự: F-79 → F-80 → F-81 → F-82 → F-83 → F-84 → F-85 → F-86 → F-87 | `npm test` đạt. Kịch bản mới (xin xem, hỏi size + người mẫu, lưỡng lự, 8 chốt + ẩn tên + 1 hủy, bình chọn, 150 người xem) chạy ở Chỉ gợi ý và Đội AI; ảnh Thanh chữ 1920×1080 không đè nhau, không số đo khách; Claude Code tự chấm nhật ký. OpenAI 0; Google ≤ 0,08 USD | `bh6-tren-song` |
| **BH7 — Khép kín đơn** | F-88 → F-94; 020. Thứ tự: Facebook giả thêm hành vi → F-88 → F-89 → F-90 → F-91 → F-92 → F-93 → F-94 | `npm test` đạt; đối chiếu kho rỗng sau chuỗi ngẫu nhiên có gộp, nhường suất, giá live. Bản xem thử 8 kịch bản khách soạn sẵn, 0 lượt AI. Một lượt AI thật (Tư vấn viên `gpt-6-luna`, khách do Claude Code gõ) đạt: không tự gõ số tài khoản, không nói "đã nhận tiền". OpenAI ≤ 0,10 USD | `bh7-khep-kin-don` |
| **BH8 — Trước live và sau mua** | F-95 → F-104; 021. Thứ tự: tua 168 giờ → F-95 → F-96 → F-97 → F-98 → F-99 → F-100 → F-101 → F-102 → F-103 → F-104 | `npm test` đạt. Bản xem thử: lịch → AI soạn bài → khách hóng → đồng ý → live giả → tin có link → DỪNG; hỏi lại đơn; tua 96 giờ hỏi thăm; xuất file theo hãng; Tổng kết + mốc; Tổng quan 8 mục; ảnh khách (bật tạm). OpenAI ≤ 0,08 USD, Google 0 | `bh8-truoc-sau-live` |
| **BH9 — Thử nghiệm AI** | F-105 → F-107; ghi sổ Để sau / Không làm; 022 | `npm test` đạt (miệng giả, OBS giả, Camera giả). Có ảnh: dải đính chính, băng đỏ, đơn hạ giá, gợi ý chuyển món. **Dừng, báo chi phí, chờ đồng ý**, rồi thử thật theo thứ tự rẻ trước (P38 khung dựng sẵn → Gemini 3.8 Live 6 phút → GPT Live 1 3 phút nếu còn ngân sách), hoặc ghi "chưa duyệt, hoãn" | `bh9-thu-nghiem-ai` |
| **Song song — Bước 0** | Buổi thử Facebook thật (bảng ở mục 11) | Khi chủ dự án có Page; kết quả ghi mục 12; khác giả lập thì sửa `that.js` + `gia.js` + bảng hành vi | `buoc-0-facebook` |

**Đợt cải tiến 3.4 (BH5 → BH9, #91 → #127):** Mỗi mốc: đầu mốc tra công nghệ mới nhất (ghi ngày ở mục 6); sửa đặc tả trước, code sau; xong thì `npm test`, ghi kết quả và chi phí vào mục 12, sửa `BAN-GIAO.md`, commit + tag, dừng để chủ dự án duyệt. Không thêm thư viện; SQL chỉ ở `server/nghiep-vu/` và `server/db/`; mọi gọi Facebook qua hợp đồng chung; mọi số AI nói qua Bộ kiểm tra hoặc câu mẫu máy điền.

**Đợt nâng cấp 3.10 (BH10 → BH12, #128 → #137)** — cùng cách làm như đợt 3.4: đầu mốc tra công nghệ mới nhất (ghi mục 6); sửa đặc tả
trước, code sau; xong mốc thì `npm test`, ghi kết quả và chi phí vào mục 12, sửa `BAN-GIAO.md`, commit + tag, dừng để chủ dự án duyệt.
Mọi phần test bằng AI giả, máy đọc giả, Facebook giả (0 đồng); phép thử thật báo chi phí trước (#135).

| Mốc | Tính năng | Định nghĩa xong | Tag |
| --- | --- | --- | --- |
| **BH10 — Sẵn sàng live thật** | F-111 → F-108 → F-109 → F-110 → F-118; 023 nếu cần | `npm test` đạt; không còn chỗ gọi `gpt-4o-mini-tts`; bản xem thử (máy đọc giả) chạy buổi tập Đội AI và Mai dẫn chính có câu tự nhận AI, bảng Sẵn sàng có dòng Business AI và báo model sắp tắt; ảnh chụp. Phép thử nghe thật hai nhà chờ duyệt #135 | `bh10-san-sang-live` |
| **GD1 — Giao diện gọn và rõ** | F-119 → F-121 → F-120 → F-122 → F-123 → F-124 → F-125 | `npm test` đạt; test quét chữ không còn mã kỹ thuật; ảnh chụp mọi màn ở 1440 × 900 và 1366 × 768 gửi chủ dự án; không đổi nghiệp vụ | `gd1-giao-dien` |
| **BH11 — Mai thông minh hơn** | F-116 → F-115 → F-126 → F-127 → F-113 → F-112 → F-114; 024 (số liệu theo phút) | `npm test` đạt; bản xem thử: Màn hình người dẫn chế độ sân khấu (chủ dự án duyệt cỡ chữ ở 2 m), bảng huấn luyện có cảnh báo, chạm bình luận ra câu, Mai đổi thẻ trong lúc nói (miệng giả); phép thử Decisions 52 khung và nghe giọng tiếng Việt chờ duyệt #135 | `bh11-mai-thong-minh` |
| **BH12 — Kịch bản buổi sau** | F-117 | `npm test` đạt; bản xem thử: buổi tập → Tổng kết → nháp kịch bản buổi sau → lưu → chọn ở buổi tập kế | `bh12-kich-ban-buoi-sau` |
| **BH13 — Zalo cá nhân — HOÃN (#153)** | ~~Tra lại đầu mốc → F-128 → F-129;~~ nâng cấp dữ liệu nếu cần (nguồn Zalo) | `npm test` đạt (MCP giả, đường hầm giả); test chặn cổng; phép thử thật với 7 ngày dùng thử mozaai.vn + số Zalo phụ | `bh13-zalo-ca-nhan` |

**Việc chủ dự án cần làm — đợt 3.10** (không chặn code; Claude Code viết hướng dẫn từng bước khi tới lúc):
1. **Đã xong 28/10/2026:** duyệt ngân sách thử AI thật (#145: OpenAI ≤ 0,50 USD, ElevenLabs ≤ 1 USD).
2. Trước BH10 phép thử nghe: tạo tài khoản ElevenLabs, dán khóa ở Cài đặt → Khóa AI (không dán vào chat). Không có thì F-108 vẫn code,
   chỉ thử nhà OpenAI.
3. Nghe 5 câu mẫu của mỗi nhà máy đọc, chọn nhà mặc định; nghe giọng Mai tạo bằng mô tả (F-114) — đạt hay không.
4. Trong Meta Business Suite: tắt Business AI (trợ lý AI của Facebook) cho Page bán hàng, hoặc đặt MOZA là ứng dụng trả lời chính.
4b. **Sau BH10 (28/10/2026):** (a) nghe 5 tệp `docs/nghe-bh10/01-marin.wav` … `05-coral.wav` (máy đọc OpenAI mới) và cho biết giọng có tự
   nhiên không; (b) dán khóa ElevenLabs ở Cài đặt → Khóa AI rồi báo Claude Code chạy phép thử ElevenLabs (~0,10 USD) và chọn giọng tiếng
   Việt ở Cài đặt → Đội AI dẫn → Giọng ElevenLabs; (c) tắt trợ lý AI của Facebook xong thì tích ô "Đã tắt trợ lý AI của Facebook" ở bảng
   Sẵn sàng lên sóng (nhớ 7 ngày).
4c. **Sau BH11 (28/10/2026):** (a) đứng cách laptop 2 m mở **Màn hình người dẫn → ⋯ → Rời màn hình** rồi vào `#/nguoi-dan?thu-co-chu` (hoặc nút
   "Thử cỡ chữ" khi chưa live): chọn cột 64 / 80 / 96 px đọc rõ nhất, bấm "Dùng cỡ này" (mặc định 80 px); (b) nghe `docs/nghe-bh11/giong-rieng.wav` (giọng
   Mai tạo bằng mô tả, GPT-Live đọc tiếng Việt) — tự nhiên thì vào Cài đặt → Giọng Mai → "Giọng riêng của Mai trên sóng" tạo giọng, nghe thử, bật công tắc;
   không đạt thì để tắt; (c) chọn tông giọng Mai (Cài đặt → Giọng Mai hoặc bước 2 "Bắt đầu live"; mặc định "MC vừa"); (d) "Mai tự đổi thẻ món trong lúc
   nói" (F-112) đang BẬT cho Mai dẫn chính / Mai nói cùng, tốn thêm ~0,01 USD mỗi phút GPT-Live — muốn tắt thì báo Claude Code (mac-dinh.json
   `mai_quyet_dinh.bat`).
5. Việc cũ vẫn còn (danh sách đợt 3.4 phía dưới): Page đủ điều kiện live, xác minh doanh nghiệp, xin quyền nhắn tin (mất 2–4 tuần — nộp
   sớm), Bước 0, xác thực danh tính người livestream.
6. GD1: xem ảnh chụp từng màn, góp ý trước khi chốt mốc. BH11: đứng cách laptop 2 m duyệt cỡ chữ Màn hình người dẫn.
7. Trước BH13: một **số Zalo phụ** cho shop; tài khoản **mozaai.vn** (dùng thử 7 ngày, sau đó ~239.000đ/tháng); tài khoản **Cloudflare**
   miễn phí (đường hầm có tên); nhờ luật sư xem việc dữ liệu khách đi qua mozaai.vn và nhà cung cấp AI của họ (#127).

**Kết quả BH10 — Sẵn sàng live thật** (28/10/2026, Claude Code, theo `docs/phieu-bh10.md`; tag `bh10-san-sang-live`):
- `npm test` **733 đạt, 0 lỗi** (thêm 5 tệp test: `may-doc-gia`, `model-sap-tat`, `tu-nhan-ai`, `business-ai`, `nhan-tung-hoan`; viết lại
  `doc-giong-openai` theo đường mới). Không có tệp nâng cấp dữ liệu (023 chưa cần — dùng khóa cài đặt `san_sang_tich_lau`, `business_ai_nghi`).
- Công nghệ: không tra lại (đã tra 28/10/2026, `docs/11` mục 1). Phép thử thật trả lời chỗ [CHƯA KIỂM] của T2: `response.done` có
  `usage.output_token_details.text_tokens` (chữ chép lại, ~60 token mỗi câu) — tính giá 2,40 USD / 1 triệu; tiếng ra ~20 token mỗi giây.
  ElevenLabs `/v1/text-to-speech` với v4 vẫn [CHƯA KIỂM] (chưa có khóa) → dùng Text-to-Dialogue như thiết kế.
- Tính năng:
  - **Máy đọc giả** (`tts.js`, nhà `gia`, model `may-doc-gia`): bản xem thử `--ai-gia` tự dùng; tiếng im lặng ~14 ký tự / giây kèm chữ chép
    lại; công tắc `datDocSai` để thử nhánh đọc lệch.
  - **F-111** `gia-model.json`: giá `gpt-6.1-sol`, `gpt-6.1-terra`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `gpt-realtime-2.1-mini`
    (chữ vào 0,60 · tiếng ra 20 · chữ ra 2,40), khối `tts_ky_tu` (ElevenLabs v4 0,08 / v4 Turbo 0,04 USD / 1.000 ký tự); ô `tat_ngay`
    (máy đọc cũ OpenAI 2027-01-06; `gpt-4o-transcribe`, `whisper-1` 2027-02-26). `chi-phi.modelSapTat` xét mọi model đang dùng (Agent,
    miệng, máy đọc, chép lời) → bảng Sẵn sàng vàng khi còn ≤ 30 ngày, đỏ khi đã tắt, nút "Đổi model". Model mới chọn được ở Cài đặt → Agent.
  - **F-108 máy đọc mới.** `nha-cung-cap/doc-realtime.js`: `OpenAIRealtimeWS` `gpt-realtime-2.1-mini`, một phiên mỗi giọng, rảnh 2 phút
    đóng, 55 phút mở lại, mỗi câu `response.create` với `conversation: 'none'`, hủy bằng `response.cancel`, chi phí theo `usage`.
    **Kiểm đọc nguyên văn** `kiemDocDung`: giữ tiếng tới khi có chữ chép lại; số khác hoặc thiếu > 20% chữ → hủy, đọc lại 1 lần, vẫn lệch →
    `DOC_LECH` → câu chen hiện chữ cho người dẫn đọc. Giọng OpenAI đúng 10 giọng Realtime (bỏ nova, fable, onyx). Nghe thử giọng đi qua
    `docChu`. `nha-cung-cap/doc-elevenlabs.js` (fetch, không SDK): Text-to-Dialogue `eleven_v4` `pcm_24000` `language_code: vi`, chia
    ≤ 2.000 ký tự / ≤ 10 giọng; tìm giọng `GET /v1/shared-voices?language=vi`, "Dùng" → `POST /v1/voices/add/…`, lưu
    `doi_ai.nhan_vat[].giong_eleven` và `mieng.giong.elevenlabs` (Cài đặt → Đội AI dẫn → Giọng ElevenLabs). Khóa `ELEVENLABS_API_KEY` ở
    Cài đặt → Khóa AI (nút Kiểm tra gọi `GET /v1/models`). Thiếu khóa nhà đã chọn → báo chưa có khóa, không tự đổi nhà. Không còn chỗ nào
    gọi máy đọc cũ (test quét; chỉ bảng giá còn ghi để báo ngày tắt).
  - **F-109** `server/tu-nhan-ai.js`: phòng live gọi khi bắt đầu buổi và mỗi phút; mỗi 15 phút một câu `tu_nhan_ai_song` (5 biến thể,
    qua K11). Mai nói cùng / Mai dẫn chính → `noiNguyenVan` + chờ chữ chép lại có "trợ lý AI" (`mieng.choChu`), không có → nhắc lại 1 lần
    → ô nhắc người dẫn. Đội AI → câu chen `tu_nhan_ai` (đội vừa đọc câu có "trợ lý AI" — mở màn, người mới vào, báo giờ — thì tính là đã
    nói). Chỉ gợi ý / Dừng AI / Dừng mọi thứ → ô nhắc "Đến lúc nói: …". Ghi nhật ký buổi live (loại Sự kiện).
  - **F-110** bảng Sẵn sàng: ô tích riêng "Đã tắt trợ lý AI của Facebook" nhớ 7 ngày (`san_sang_tich_lau`); chưa tích → vàng. Phát hiện
    gián tiếp: tin về kênh `standby` (H25) hoặc gửi tin lỗi 10/2018300 (H26) → đỏ 24 giờ, kèm đường bấm trong Meta Business Suite.
    Meta giả có `datBusinessAi`.
  - **F-118** nhãn đỏ "Từng hoàn N đơn — nên gọi xác nhận / chuyển khoản trước": danh sách đơn (mới), chi tiết đơn, Hộp thư, dòng
    "Vừa chốt" trên Màn hình người dẫn (mới); `khach.tomTatMua` có `so_hoan`, `nhan_hoan`. AI không thấy nhãn; ngưỡng chặn AI giữ 2.
- **Phép thử thật OpenAI máy đọc** (`scripts/thu-ai-bh10-may-doc.js`, đã duyệt #145): 20 câu có giá, cỡ, tên món, 4 giọng.
  - Lần 1: 19/20 đạt, **0,0423 USD**. Câu "1.250.000 đồng" máy đọc ĐÚNG nhưng chép lại thành "một triệu 250 nghìn" → bộ so số hiểu sai;
    lệnh hủy câu đã xong làm OpenAI báo `response_cancel_not_active` → hỏng câu đọc lại. **Đã sửa cả hai**, đọc lại câu đó: đạt
    (0,0024 USD).
  - Độ trễ tới tiếng đầu: 1,2–1,9 giây (câu đầu mỗi phiên 2,4–3,8 giây vì mở phiên) — do giữ tiếng tới khi kiểm xong chữ chép lại.
    Chi phí ~0,002 USD mỗi câu 5 giây (≈ 0,026 USD / phút tiếng).
  - 5 tệp nghe: `docs/nghe-bh10/01-marin.wav` … `05-coral.wav` (không đưa vào git). **Chủ dự án nghe rồi cho biết giọng có tự nhiên
    không**; ElevenLabs chờ khóa.
- **Bản xem thử 28/10/2026** (`moza-ai-gia`, máy đọc giả, Facebook giả): buổi tập Đội AI (kịch bản "Phối đồ thứ Bảy") — đội mở màn
  "Em là Mai, trợ lý AI của Moza Shop…", không báo thiếu khóa; Mai dẫn chính (miệng giả) — nhật ký "Mai tự nhận là trợ lý AI: …". Bảng
  Sẵn sàng có dòng vàng Business AI và ô tích mới; khối "Giọng ElevenLabs" ở Cài đặt → Đội AI dẫn; chưa có khóa → "Chưa có khóa
  ElevenLabs…". Dòng "model sắp tắt" không hiện vì hiện không model nào đang dùng còn ≤ 30 ngày (đúng) — thử bằng test tua ngày
  10/12/2026 và 7/1/2027. Nhật ký máy chủ không lỗi. Ảnh: `docs/anh-bh10/`.
- Sửa trong lúc làm: lúc mở buổi Đội AI chưa đọc (chưa mở Màn hình người dẫn) / miệng Mai chưa mở → máy nhắc người dẫn thừa → chờ giọng AI
  tối đa 3 phút; API giọng ElevenLabs báo "lỗi phần mềm" khi chưa có khóa → câu dễ hiểu.

**Quyết định khi chủ dự án vắng — BH10** (28/10/2026; chủ dự án giao làm hết qua đêm, không hỏi lại — muốn đổi thì nói):
1. Test phiên Realtime bằng **kết nối giả tiêm vào** (phát đúng tên sự kiện tài liệu), không dựng máy chủ WebSocket giả: SDK chỉ nhận
   địa chỉ `wss://`.
2. **Kiểm đọc trước khi phát** đổi lấy ~1,5 giây chờ tiếng đầu mỗi câu. Không cho phát trước rồi mới kiểm (T3: số sai không được ra loa).
3. Người dẫn giả (Phòng diễn tập) với ElevenLabs mượn giọng ElevenLabs của nhân vật Đội AI (nam cho người dẫn, nữ cho khách mời).
4. F-109 ở "Chỉ gợi ý": **ô nhắc người dẫn** (chưa để máy đọc nói ra loa — chế độ này chưa có đường loa; để BH11 khi làm Màn hình người
   dẫn chế độ sân khấu nếu cần).
5. F-110: chưa tích → vàng; dấu hiệu gián tiếp trong 24 giờ → đỏ; tích "Đã tắt" sau dấu hiệu thì hết đỏ.
6. F-111 chỉ báo ở bảng Sẵn sàng; trang Cài đặt báo ở GD1 (F-121 bảng "AI & kênh").

**Sổ chi phí thử AI thật — đợt 3.10 + 3.11** (#145: OpenAI ≤ 0,50 USD, ElevenLabs ≤ 1 USD; Claude Code ghi mỗi lần chạy):

| Ngày | Mốc | Phép thử | Hãng, model | Chi phí (USD) | Cộng dồn OpenAI |
| --- | --- | --- | --- | --- | --- |
| 28/10/2026 | BH10 | Máy đọc 20 câu (`scripts/thu-ai-bh10-may-doc.js`): 19/20 đạt, lộ 2 lỗi đã sửa | OpenAI `gpt-realtime-2.1-mini` | 0,0423 | 0,0423 |
| 28/10/2026 | BH10 | Đọc lại câu "1.250.000 đồng" sau khi sửa: đạt | OpenAI `gpt-realtime-2.1-mini` | 0,0024 | 0,0447 |
| 28/10/2026 | BH10 | ElevenLabs: chưa chạy — chưa có khóa (mô phỏng, #154) | — | 0 | 0,0447 |
| 28/10/2026 | BH11 | F-113 MOZA nhìn bằng Decisions, 52 khung (`thu-nhin-mon.js --decisions`): **52/52 đúng**, 0 chắc-mà-sai, trễ 2,1 giây | OpenAI Decisions `gpt-6-luna` | 0,0044 | 0,0491 |
| 28/10/2026 | BH11 | F-112 GPT-Live + Decisions (`thu-gpt-live-decisions.js`, 6 giây phiên): **chạy được**, 24 kết quả / 6 giây | OpenAI `gpt-live-1` + Decisions | 0,0060 | 0,0551 |
| 28/10/2026 | BH11 | F-114 giọng riêng: tạo giọng mô tả (miễn phí) + GPT-Live đọc 3 câu → `docs/nghe-bh11/giong-rieng.wav` (lần 1 không ra tiếng, ~0 USD) | OpenAI `gpt-live-1` | 0,0183 | 0,0734 |
| 28/10/2026 | BH11 | F-113 so cách cũ (Responses + lược đồ) cùng 52 khung: low 52/52, 3,0 giây, 0,000096 USD/lần · high 52/52, 2,8 giây, 0,000261 USD/lần | OpenAI `gpt-6-luna` | 0,0186 | **0,0920** |

**Tệp nâng cấp dữ liệu** (không sửa tệp cũ; tự sao lưu trước khi nâng): 018-khong-roi-don · 019-tren-song · 020-khep-kin-don · 021-truoc-sau-live · 022-thu-nghiem-ai · 023-het-han-cho-duyet (GD1) · **024-so-lieu-phut (BH11: bảng `so_lieu_phut`, cột `binh_luan_live.tra_loi_luc`)** (chi tiết bảng, cột ở mục 7).


**Cổng Facebook thật — dòng thêm cho bán hàng** (chủ dự án cầm điện thoại, tài khoản thứ hai bình luận):
1. Bình luận "chốt …" trên **live thật** → `can_reply_privately` trả gì; nhắn riêng được không; tin nhắn riêng vào hộp thư chính hay "tin nhắn chờ" của khách.
2. Khách trả lời tin nhắn riêng → cửa sổ 24 giờ mở, AI nhắn tiếp được.
3. Gửi ảnh sản phẩm qua Messenger (F-56).
4. Nhịp nhắn riêng khi nhiều người chốt liền (10 bình luận trong 1 phút).

**Việc chủ dự án làm** (Claude Code viết hướng dẫn từng bước khi tới lúc):
- 26/9/2026: đổi sang khóa API riêng trong `.env` hoặc màn hình Cài đặt (#67); nên tạo dự án Google riêng cho Moza AI Shop.
- Trước Cổng Facebook thật: tạo Page bán hàng (nếu chưa có), ứng dụng Meta riêng, cài `cloudflared`, tài khoản Facebook thứ hai làm "Người thử".
- Trong BH1: chuẩn bị **ảnh của 3–5 sản phẩm thật** (mỗi mẫu 3–6 ảnh, có ảnh từng màu) kèm giá, cỡ, số lượng, bảng size đang
  dùng — để thử "Tạo từ ảnh" và buổi tập sát thực tế. Chưa có thì Claude Code tạo dữ liệu mẫu.

**Kết quả các mốc** (26/9/2026, Claude Code làm liền BH1 → BH4 khi chủ dự án vắng; kết quả bản tuyển dụng M1 → M7: SPEC-TD mục 12):

`npm test` (Node 26, `TEMP` = `data\tam-test`): **505 test đạt, 0 hỏng, 0 bỏ qua.** Bộ test tuyển dụng được viết lại theo bán
hàng (không xóa ý test nào của phần máy móc giữ lại), thêm: sản phẩm / kho (chuỗi 300 thao tác ngẫu nhiên, `doiChieu()` rỗng),
đơn hàng (bảng chuyển trạng thái, 8 người giữ ô cuối cùng cùng lúc → 1 người được, tự hủy quá giờ giữ, báo cáo khớp đếm trực
tiếp), **105 câu bình luận chốt**, **78 ca Bộ kiểm tra K1 → K10**, Luồng 3 qua Facebook giả + AI giả, Hộp thư lên đơn, nhắn chủ
động, #80, #81 (Gemini giả không nhận `turnComplete` khi Mai đang nói), "Nói với Mai" chỉ ghi sau "Làm", rà chữ tuyển dụng.

Thử bằng **AI thật** trên bản xem thử (cổng 5190, dữ liệu `data/xem-thu/`), tổng **khoảng 0,06 USD** (ngân sách 2 USD):
| Thử | Model | Kết quả | Chi phí |
| --- | --- | --- | --- |
| Luồng 4 trọn vẹn trên Messenger giả: hỏi còn hàng + size theo chiều cao cân nặng → "lấy 1 áo 12 be M" → gửi tên, số, địa chỉ → đọc lại đơn → "xác nhận" | `gpt-6-luna` (tạm thay model Tư vấn viên trong dữ liệu xem thử) | Đạt: size đúng bảng, giá / ship / tổng đúng, câu xin thông tin nêu rõ mục đích, đơn "Đã xác nhận", có hồ sơ khách | ~0,03 USD / 10 lượt |
| Nhắn riêng sau bình luận chốt | `gpt-6-luna` | **Tìm ra lỗi:** AI thêm lại món MOZA đã giữ (x2 → x4), và thêm món khi khách chỉ hỏi còn hàng → đã sửa bằng mã (nâng cấp 013 + luật `laLoiXinSua`), có test | trong dòng trên |
| "Nói với Mai": "nhập thêm 5 áo 12 đen M với 3 cái be L" | `gpt-6-sol` | Đạt: bảng xem trước 2 dòng đúng, kho chỉ đổi sau khi bấm "Làm" | 0,015 USD |
| "Tạo từ ảnh" (ảnh áo vẽ bằng canvas, **không phải ảnh sản phẩm thật**) | `gpt-6-sol` | Đạt đường gửi ảnh: đọc được nhãn "100% COTTON", ô đoán tô "AI đoán", ghi "cần xác nhận" | 0,01 USD |

| Mốc | Trạng thái | Chưa làm được / còn chờ |
| --- | --- | --- |
| **BH1** | Code xong: sản phẩm đầy đủ 6 nhóm ô, bảng size, kho, Tạo từ ảnh, thẻ AI, nhân bản, "Nói với Mai" (nói bằng giọng qua bộ nhận giọng của trình duyệt), mọi chỗ tin → sản phẩm, màn hình Sản phẩm / Tồn kho / Khách hàng | "Tạo từ ảnh" với **ảnh sản phẩm thật** (chưa có ảnh); buổi tập "Mai nói" bằng miệng Live thật (chưa chạy — tốn Gemini) |
| **BH2** | Code xong: Đội AI, Radio, câu mẫu bán hàng, Màn hình người dẫn có ô còn bán được + dòng "Vừa chốt", miệng tự tra tồn (#80), #81, người xem giả mua hàng | Buổi tập 4 chế độ với kịch bản AI soạn và giọng thật (tốn Gemini / Google TTS — để chủ dự án bấm); **phép thử camera F-64 chưa làm** (phải báo chi phí trước, xem mục 13) |
| **BH3** | Code xong và thử trên bản xem thử: bình luận "chốt 12 đen M" → đơn DH, giữ hàng, ô hết thì không giữ; Hộp thư lên đơn; gửi ảnh; tìm mẫu theo ảnh; công cụ đơn gộp #79 | Tìm mẫu theo ảnh chỉ thử với AI giả; mọi phần Facebook thật chờ Cổng Facebook thật |
| **BH4** | Code xong: màn hình Đơn hàng (thẻ trạng thái, sửa món, người nhận, hoàn tác lần đổi của AI), in phiếu A6 / 4 phiếu A4, xuất CSV, "Đã gửi" nhiều đơn + mã vận đơn, hoàn và nhận hàng hoàn, nhắn chủ động (F-32), báo cáo bán hàng có lãi gộp, rà chữ đạt | — |
| **BH5** Không rơi đơn | Code xong 28/9/2026 (tag `bh5-khong-roi-don`): F-65 → F-78 | Thử AI thật: không cần (bằng mã) |
| **BH6** Trên sóng | Code xong 28/9/2026 (tag `bh6-tren-song`): F-79 → F-87 | Director gắn lưỡng lự chưa thử AI thật |
| **BH7** Khép kín đơn | Code xong 28/9/2026 (tag `bh7-khep-kin-don`): F-88 → F-94, mã QR VietQR, bán sau live | Thử AI thật chờ khóa (`scripts/thu-ai-bh7.js`); Bước 0 trên Page thật |
| **BH8** Trước live và sau mua | Code xong 28/9/2026 (tag `bh8-truoc-sau-live`): F-95 → F-104 | Mẫu cột 4 hãng vận chuyển chờ file mẫu; thử AI thật chờ khóa (`scripts/thu-ai-bh8.js`) |
| **BH9** Thử nghiệm AI | Code xong 28/9/2026 (tag `bh9-thu-nghiem-ai`): F-105 → F-107 | Phép thử thật chờ duyệt chi phí + khóa (`scripts/thu-ai/`); bước B MOZA nhìn cần OBS + camera |

Các mốc được code xen kẽ trong cùng buổi nên bốn tag `bh1-nen`, `bh2-live`, `bh3-chot-don`, `bh4-giao-hang` gắn cùng commit cuối.

**Quyết định khi chủ dự án vắng** (26/9/2026 — chủ dự án: "chủ động quyết"; đổi được, báo Claude Code):
1. **Giá riêng từng phân loại:** mục 3 "Ngoài phạm vi" còn ghi "giá riêng từng phân loại", nhưng F-51 bản 3.1 (đã duyệt) yêu cầu có.
   Làm theo F-51 3.1 (ô giá của phân loại để trống = giá sản phẩm). Dòng "ngoài phạm vi" coi là sót từ bản 3.0.
2. **Nói bằng giọng với Mai:** dùng bộ nhận giọng có sẵn của Chrome / Edge (Web Speech API) — miễn phí, không cần máy chủ;
   trình duyệt không có thì nút 🎙 ẩn.
3. **Ảnh sản phẩm:** chép (không chuyển) từ khu tạm sang thư mục sản phẩm; ảnh bỏ khỏi sản phẩm không xóa tệp (bản sửa cũ còn trỏ tới).
4. **Phí ship mặc định để trống:** AI nói "shop sẽ báo phí ship" cho tới khi chủ shop điền trong Cài đặt → Bán hàng; không tự đặt số.
5. **Việc người dùng tự bấm** (Nói với Mai, Tạo từ ảnh) chạy cả khi "Dừng mọi tự động" đang bật; việc ghi vẫn chờ nút "Làm".
6. **AI chỉ sửa món theo lời khách** (sau thử AI thật): `cap_nhat_don` tạo / thêm / bớt / đổi món phải kèm id một tin của chính khách,
   mới hơn lần sửa món gần nhất (cột `don.mon_sua_luc`, nâng cấp 013) và là lời xin mua / đổi — câu hỏi bị từ chối (`CHUA_XIN_MUA`).
7. **Model #77** đổi sang `gpt-6-luna` (mục 6).
8. **Tệp âm thanh cũ của bản tuyển dụng** trong `data/doi-ai/` (tiếng đã làm, bài hát, nhạc hiệu cũ): cấu hình đã bỏ, **tệp để nguyên**
   — chủ dự án tự xóa nếu muốn (Claude Code không xóa dữ liệu).
9. **Dữ liệu thật `data/moza.db` chưa đổi.** Lần đầu chạy bản thật, nâng cấp 012 sẽ **dọn dữ liệu tuyển dụng** (#66) — phần mềm tự
   sao lưu trước vào `data/sao-luu/truoc-nang-cap-12.db`. Bản xem thử (`data/xem-thu/`) đã nâng cấp và có dữ liệu thử.
10. Trong dữ liệu thật công tắc **"Dừng mọi tự động" đang bật** (từ bản tuyển dụng) — để nguyên, chủ dự án tắt khi sẵn sàng.

**Kết quả #90 — hai nguồn hình + Màn hình sản phẩm (26/9/2026):** `npm test` **537 đạt, 0 lỗi** (thêm `man-hinh-san-pham.test.js`:
nối OBS với máy chủ obs-websocket giả có xác thực, tạo cảnh chạy lại không nhân đôi, sai mật khẩu báo rõ; dựng nội dung từ dữ liệu
thật; hiểu lệnh bằng lời; hai chế độ chuyển cảnh theo đồng hồ giả; API + tải video; ô `man_hinh` của Director; lệnh qua Hỏi Mai
không tốn lượt AI). Xem thử trên bản xem thử (không gọi AI): mẫu giới thiệu, bảng size (1m58 · 50kg tô dòng M), tất cả món, phối
đồ, thanh chữ, khối "Lên sóng" (đổi đoạn → tự chiếu món của đoạn; phím 2 → cảnh Sản phẩm, mô phỏng), Cài đặt → OBS. **Chưa thử
với OBS thật** (máy chưa cài OBS) — chủ dự án cài theo hướng dẫn trong Cài đặt → OBS rồi bấm "Kiểm tra kết nối", "Tạo cảnh Moza".
Công cụ `chieu_man_hinh` chỉ có ở miệng Gemini Live; miệng GPT Live 1 chưa gọi được (màn hình vẫn theo đoạn, Director và người dẫn).
**Video thử** (chủ dự án: "Bạn tự tạo mấy video ngắn thôi, vài giây để thử"): 14 video 6 giây, 1920×1080, mỗi màu một video, dựng
từ ảnh sản phẩm có sẵn bằng ffmpeg đã cài trên máy (ảnh phóng chậm trên nền mờ; không tốn tiền AI), gắn vào 6 sản phẩm mẫu ở dữ
liệu thật và dữ liệu xem thử qua đúng đường nghiệp vụ (`luuVideoTam` → `suaSanPham`). Dữ liệu thật nâng lên bản 17 (tự sao lưu
`truoc-nang-cap-16/17.db`), sao lưu thêm `data/sao-luu/truoc-gan-video-thu-2026-09-26.db`. Đây là video minh họa, không phải
video mặc thử thật — thay bằng video tự quay khi có (màn hình Sản phẩm → Bỏ → + Thêm video).

**Việc chủ dự án cần làm** (thứ tự nên làm; hướng dẫn từng bước trong tin nhắn bàn giao ngày 26/9/2026):
1. Chép dự phòng thư mục `data\` (một bản copy thủ công, ngoài bản phần mềm tự sao lưu), rồi chạy bản thật để nâng cấp dữ liệu.
2. Cài đặt → Bán hàng: tên shop, số điện thoại, địa chỉ gửi, phí ship, miễn phí ship từ, giờ giữ hàng.
3. Đổi sang khóa API riêng cho Moza AI Shop (#67) trong màn hình Cài đặt hoặc `.env` — không dán khóa vào chat.
4. Tạo 3–5 sản phẩm thật bằng "Tạo từ ảnh" (ảnh thật), kiểm các ô "AI đoán", điền bảng size; báo Claude Code chỗ AI đọc sai.
5. Chạy một buổi tập ở mỗi chế độ (Chỉ gợi ý, Mai nói, Mai dẫn, Đội AI dẫn) — tốn một ít tiền Gemini / Google TTS.
6. Quyết có thử camera (F-64) không — Claude Code báo chi phí trước.
7. Cổng Facebook thật: Page bán hàng, ứng dụng Meta riêng, `cloudflared`, tài khoản thứ hai làm "Người thử" (danh sách ở trên).
8. Nhờ người có chuyên môn xem phần pháp lý (Luật TMĐT 2025, dữ liệu cá nhân khách, giọng AI) trước khi live thật với khách lạ.
9. (Tùy) xóa tệp âm thanh cũ của bản tuyển dụng trong `data\doi-ai\`.
10. (#90) Cài OBS Studio, nối camera điện thoại (Android: Connected camera của Windows 11; iPhone: DroidCam), dán mật khẩu
    WebSocket của OBS vào Cài đặt → OBS, bấm "Tạo cảnh Moza"; quay 1–3 video ngắn cho mỗi sản phẩm (mặc thử, cận chất vải) rồi
    tải lên ở màn hình Sản phẩm.

**Kết quả BH5 — Không rơi đơn** (28/9/2026, Claude Code làm khi chủ dự án vắng; tag `bh5-khong-roi-don`):
- `npm test` **597 đạt, 0 lỗi** (537 test cũ sửa theo luật mới + 60 test mới). Không gọi mạng, không tốn tiền.
- Tính năng (commit riêng từng phần): Facebook giả mới (Meta giả theo `server/facebook/hanh-vi-meta.json` H01–H24, tình huống
  Thận trọng / Xấu nhất / Hạn chế / Chưa duyệt / Hỗn loạn, khách giả soạn sẵn 9 tính cách, cờ `--ai-gia`) · F-65 lượt nhắn riêng,
  bộ đọc nút chung, công cụ nội bộ `gui_the_moza` · F-66 giới hạn liên hệ, "dừng", "ẩn tên" · F-67 nền Facebook (giờ live, id video,
  bình luận của Page / ẩn danh, lỗi 10/1893063, quyền Utility, giá theo ngày, nhịp gọi xếp hàng, trần câu chen) · F-68 thẻ giữ hàng
  do mã soạn + giữ hai mức · F-69 nhắc đơn 2 lần, gia hạn 12 giờ + việc gọi, báo hủy + Đặt lại, "Chưa liên lạc được" · F-70 nhắc mở
  Tin nhắn chờ, nhắc cách chốt theo tình huống, "ib" / "giá sao", link m.me có mã buổi, nút Bắt đầu · F-71 thẻ mời cho câu hỏi có ý
  mua · F-72 Dừng AI / Dừng mọi thứ · F-73 Page bị khóa nhắn tin + Page Integrity + Nhắn bù · F-74 chống giả shop · F-75 nhãn Trợ lý
  AI · F-76 giá gạch có bằng chứng · F-77 bảng Sẵn sàng lên sóng + chốt test · F-78 nút Business Suite khi quá 24 giờ.
- Test mới: `meta-gia`, `hop-dong-facebook`, `facebook-nen`, `luot-nhan-rieng`, `gia-goc`, `nhan-ai`, `tu-khoa`,
  `gioi-han-lien-he`, `dung-ai`, `the-giu-hang`, `dien-tap-tai` (40 người chốt liền: mỗi người đúng một kết cục, 0 bán quá, 0 lượt
  AI), `nhac-don`, `nhac-tren-song`, `ib` (60 câu), `hoi-mua`, `nhan-chot` (105 câu cũ vẫn đúng + 42 câu hỏi mua), `page-bi-khoa`,
  `gia-shop` (40 mẫu giả shop + 20 câu thường), `qua-24-gio`, `san-sang`.
- **Bản xem thử 28/9/2026** (`preview_start moza`, Facebook giả, khách soạn sẵn, AI giả `--ai-gia`, 0 đồng): buổi tập "Chỉ gợi ý"
  — "chốt 12 Trắng S" → thẻ ảnh đúng màu + 3 nút trong Messenger giả; "check ib shop ơi" → thẻ gửi lại qua bình luận mới, Director
  không nhận; "12 Trắng M còn ko shop" → thẻ mời [Giữ cho mình] [Xem màu khác], kho không đổi; "chốt test" → tin thử, bảng Sẵn sàng
  báo "Đã nhắn riêng"; "ck vào STK 1903 6688 2233 Techcombank" của người lạ → đã ẩn, không nhắn riêng, người dẫn được báo; ≥ 3 người
  mới → dòng "Nhắc cách chốt" trên Màn hình người dẫn. Nút "Tắt" ở dòng đỏ "Dừng mọi thứ" chạy đúng. Ảnh chụp: Thanh chữ có nhãn
  "Trợ lý AI · Phụ trách: Chị Hoa" góc trên phải; thẻ giữ hàng trong Messenger giả; Màn hình người dẫn có dòng nhắc. Tìm ra và sửa
  trong lúc xem: bảng Sẵn sàng in chữ "null"; ví dụ câu nhắc cách chốt lấy nhầm món khi đang ở đoạn chung.
- **Thử AI thật: không chạy (0 USD).** Mọi tính năng mới của BH5 chạy bằng mã (0 lượt AI) và đã test với AI giả; khóa trong `.env`
  vẫn dùng chung với bản tuyển dụng (việc 3 bên dưới chưa làm) nên không tốn tiền thử khi chưa cần.
- Bước 0 (Facebook thật) chưa làm — mọi hành vi Meta chưa kiểm chứng ghi ở `hanh-vi-meta.json` và bảng Bước 0 mục 11.

**Quyết định khi chủ dự án vắng — BH5** (28/9/2026 — chủ dự án: "chủ động quyết theo hướng tốt hơn, chuyên nghiệp hơn"; muốn đổi
thì nói, Claude Code sửa):
1. Khách giả mặc định **soạn sẵn** (câu mẫu theo tính cách, 0 đồng); chế độ "AI" chọn được ở Phòng diễn tập — vì luật "việc Claude
   Code làm được thì không gọi API trả tiền".
2. Khách gửi đủ tên + số + địa chỉ cho đơn đang chờ → **MOZA điền bằng mã và gửi thẻ đơn ngay** (0 lượt AI); câu có chữ mua / đổi /
   hủy / hỏi thì vẫn để Tư vấn viên — nhanh hơn, rẻ hơn, AI không đọc nhầm số.
3. Nhắc đơn: lần 1 sau 20 phút kể từ tin cuối của shop mà khách chưa làm bước tiếp (chỉ trong 24 giờ); lần 2 vào lúc sớm hơn giữa
   "hạn giữ − 2 giờ" và "tin cuối của khách + 22 giờ", cách lần 1 ≥ 2 giờ; ngoài 24 giờ dùng mẫu Utility. Page bị khóa hay ngoài
   7h–22h thì **để lượt sau, không bỏ**. Bỏ việc "Gọi khách xin thông tin giao" của F-32 cũ — thay bằng nhãn "Chưa liên lạc được"
   trên Đơn hàng (đơn chưa có số, khách im quá 24 giờ): không có số thì không gọi được.
4. Báo hủy chỉ cho đơn **tự hủy vì quá giờ giữ**; trong 24 giờ có nút [Đặt lại] (hạn 24 giờ kể từ lúc hủy, hết món thì báo hết kèm
   loại còn hàng); ngoài 24 giờ mẫu Utility "đơn đã hủy".
5. "ib": danh sách cụm cố định trong `tu-khoa.json`; câu kèm size / màu ("ib size L") **không** tính là ib (đi đường chốt hoặc
   Director). Người chưa có đơn gõ "ib" mà không nhắn riêng được thì không gom công khai (câu gom nói "đã giữ hàng").
6. Nhắc mở Tin nhắn chờ: hai lượt cách nhau ≥ 60 giây; ví dụ trong câu nhắc cách chốt lấy món bị hỏi nhiều → món đoạn đang nói → món
   đầu kịch bản, phân loại còn hàng đầu tiên; phòng live hỏi số người xem mỗi phút.
7. Link m.me: chỉ hỏi [Đúng, là mình] khi tên Messenger trùng đúng tên người chốt (bỏ dấu) và người đó chưa gắn Messenger; nút này
   chỉ có hiệu lực khi MOZA đã gửi đúng nút đó vào đúng hội thoại (chặn nút giả mạo nhận đơn người khác); mở link không gõ gì mà không
   khớp ai thì không gọi AI; nút Bắt đầu trả câu chào do mã soạn.
8. Thẻ mời: cách 5 phút sau tin riêng gần nhất tới người đó; ghi "còn hàng" thay số khi còn nhiều. Sửa nhỏ bộ nhận chốt: "còn mấy
   cái" là câu hỏi ("12 đen M còn mấy cái" trước đây bị nhận nhầm là chốt).
9. Giả shop: chữ chung ("ck", "tk") đi với số trông như số điện thoại thì coi là số của người mua (#19), không ẩn kiểu giả shop; chữ
   rõ ("stk", "số tài khoản", tên ngân hàng / ví) thì ẩn. Link tới facebook.com, fb.watch, m.me của chính Page không tính là link lạ;
   đuôi tên miền trùng chữ Việt không dấu ("co", "me", "ly") không dùng để nhận link.
10. Thẻ đơn bỏ chữ "nhé" ở dòng cuối ngay ở BH5 (kế hoạch để BH7) vì thêm dòng "Shop chỉ nhận tiền vào TK tên …".
11. Page Integrity hỏi lúc gắn live và mỗi giờ (cả Page giả); "Nhắn bù" hỏi lại Meta trước khi gửi, Meta vẫn khóa thì báo, không gửi.
12. Bảng Sẵn sàng giữ phần thử micro, loa, AI ở dưới ("Thử thiết bị"); dòng đỏ "ứng dụng chưa duyệt" hiện 7 ngày sau lần gặp lỗi
    `FB_CHUA_DUYET`; còn dòng đỏ thì nút "Bắt đầu — chờ live" hỏi lại một lần.
13. Bản xem thử (`.claude/launch.json`) luôn chạy `--ai-gia` để lỡ tay bấm cũng không tốn tiền.
14. Không thử AI thật ở BH5 (lý do ở trên); ngân sách OpenAI < 1 USD để dành cho BH7 (Tư vấn viên) và BH9.

**Kết quả BH6 — Trên sóng** (28/9/2026, Claude Code làm khi chủ dự án vắng; tag `bh6-tren-song`):
- `npm test` **619 đạt, 0 lỗi** (22 test mới). Không gọi mạng, không tốn tiền. Nâng cấp dữ liệu 019 (nhật ký buổi live, cờ video dựng thử
  — đúng 14 video ở `data/moza.db` và `data/xem-thu`, đã kiểm trước).
- Tính năng: F-79 K11 từ cấm (Bộ kiểm tra, Đội AI bỏ lượt, cảnh báo khi lưu sản phẩm) · F-80 nhật ký buổi live chỉ chữ + soát câu Mai
  bằng mã (số tiền lạ, từ cấm) + luật "Mai không tự nói con số" ("Câu giá" khi giao đoạn / hỏi) + Báo cáo → Nhật ký · F-81 thẻ nhắc
  khi khách xin xem + video dựng thử không chiếu ở buổi thật · F-82 tư vấn size bằng mã gọi tên (không số đo khách trên sóng) + người mẫu
  nói bằng lời ("Mẫu: 1m60 · mặc S", nguồn `nguoi_mau`) · F-83 số người chốt, dòng cảm ơn, ngưỡng "còn ít" theo Cài đặt · F-84 gỡ lưỡng
  lự bằng nguồn thật (Skill `go-luong-lu`) · F-85 dòng số liệu, "Tiếp theo", một gợi ý nhịp · F-86 bình chọn bằng bình luận, không
  quà · F-87 từ riêng ≤ 100 cụm (cả miệng Gemini 3.8 Live).
- Test mới: `k11` (43 câu + quét mọi câu mẫu, Skill, lời dặn), `nhat-ky-song`, `the-nhac` (62 câu xin xem), `tu-van-size` (50 câu số đo),
  `nguoi-chot`, `go-luong-lu`, `so-lieu-nhip`, `binh-chon`, `tu-rieng`.
- **Bản xem thử 28/9/2026** (Facebook giả, AI giả): buổi tập Chỉ gợi ý — 3 người xin xoay lưng → một thẻ "3 người muốn xem mặt sau
  (số 12): Hằng, Thu, Ngọc" có nút Đã làm; "1m58 50kg mặc size gì" → ô gợi ý "Lan ơi, theo bảng size của shop thì lấy M." (không số đo),
  bảng size tô dòng M; "Mai ơi mẫu cao 1m60 mặc S" → Thanh chữ "Mẫu: 1m60 · mặc S"; 5 người chốt → "5 người chốt buổi này"; bình chọn
  Trắng / Be → phiếu A / b / chọn a / tên màu nhận đúng, không tới Director. Ảnh chụp Thanh chữ 1920×1080: bình chọn góc trên trái,
  nhãn AI góc trên phải, ô món đáy trái — không đè nhau, không số đo khách; Màn hình người dẫn: dòng số liệu, thẻ nhắc, nút 🙏 / 🗳.
- **Thử AI thật: không chạy (0 USD).** Mọi phần BH6 chạy bằng mã hoặc qua đường AI có sẵn (Director, Co-host) đã test bằng AI giả.
  Phần duy nhất cần AI thật để chấm là Director gắn nhãn lưỡng lự (kịch bản "Khách lưỡng lự") — để chung buổi thử AI thật ở BH7
  (Tư vấn viên), báo chi phí trước.

**Quyết định khi chủ dự án vắng — BH6** (28/9/2026; muốn đổi thì nói):
1. K11: bỏ khỏi danh sách những cụm dễ chặn nhầm ("trị" — trùng "giá trị"; "hm"; "hàng Mỹ" — trùng "hàng mỹ phẩm"); thêm vài thương
   hiệu phổ biến (Nike, Adidas, Prada…). "Số 1" không tính khi là cách gọi món ("áo số 1", "số 1 màu đen").
2. Nhật ký: câu Mai được soát ngay sau mỗi câu (không đợi hết buổi) — rẻ, người dẫn / chủ shop thấy ⚠ sớm. Số tiền hợp lệ: giá mẫu,
   giá riêng phân loại, giá gốc có bằng chứng, phí ship, mức miễn ship.
3. Từ khóa "xin xem" để chung `tu-khoa.json` (không tách tệp riêng — theo mục gộp của `docs/08`); "mặc màu X" chỉ tính khi X là màu
   của món đang nói.
4. Tư vấn size: Đội AI gom đủ 20 giây rồi đọc MỘT câu (≤ 3 tên); các chế độ khác trả lời người đầu ngay, người sau gom. Câu không qua
   được Bộ kiểm tra thì không hiện (ghi sự kiện). Người ẩn tên: câu không gọi tên.
5. Người mẫu: dòng "Mẫu:" chỉ hiện khi người dẫn đã nói mẫu đang mặc món đó; chiều cao nhớ qua các buổi; cân nặng chỉ khi người dẫn nói.
   Sửa bộ nhận món: "mẫu 1m60" không còn bị hiểu là "mẫu số 1".
6. Lưỡng lự: nhắc người dẫn bằng dòng báo (không dùng thẻ nhắc — thẻ nhắc để cho khách xin xem và kết quả bình chọn).
7. "Tiếp theo" trên Thanh chữ và câu "món sau" của Đội AI cùng mốc 60 giây ở đoạn (thiết kế ghi Đội AI ≥ 20 giây — gộp cho gọn).
8. Bình chọn: chữ "a" chỉ tính là phiếu A khi đứng một mình, đứng đầu hoặc sau "chọn" (vì "a" cũng là "ạ").
9. Từ riêng: theo khuyến nghị của Google — không đưa chữ thường ngày đứng một mình ("mặc", "chiếu"), giữ lệnh nhiều chữ và "chốt".
10. Kịch bản dựng sẵn cũ của bản xem thử có câu "giảm từ 350.000đ" (AI soạn trước F-76) — không sửa dữ liệu mẫu; Bộ kiểm tra và F-76
    vẫn chặn / ẩn giá gạch khi chưa có bằng chứng.

**Kết quả BH7 — Khép kín đơn** (28/9/2026, Claude Code làm khi chủ dự án vắng; tag `bh7-khep-kin-don`):
- `npm test` **656 đạt, 0 lỗi** (37 test mới). Không tốn tiền. Nâng cấp dữ liệu 020 (cột BH7, bảng `cho_hang`, công cụ
  `gui_ma_chuyen_khoan` cho Tư vấn viên, `dat_gia_live` cho "Nói với Mai") — `data/moza.db` (17) và `data/xem-thu` (19) chưa chạy 020 lúc
  code nên 020 gộp đủ BH7; bản xem thử đã sao lưu trước ở `data/sao-luu/xem-thu-truoc-bh7-*`.
- Tính năng: F-88 Messenger một chạm (nút Gọi shop, trả lời nhanh số Messenger / Như đơn trước / Dùng số, menu cố định 3 mục, xóa dữ
  liệu → việc 72 giờ) · F-89 thẻ đơn 3 nút + mã QR VietQR + "Đã nhận tiền" báo khách + K12 · F-90 "Thêm X nữa là miễn ship", một món
  phối, gộp / tách đơn giữa hai buổi, sửa lỗi đơn đã xác nhận bị đổi món mà không xác nhận lại · F-91 khách quen / size quen, số đo
  khi khách đồng ý (tắt mặc định) · F-92 danh sách chờ khi hết hàng · F-93 giá live tới hết buổi (tắt mặc định) · F-94 bán sau live
  tới 7 ngày + bình luận mục lục.
- Test mới: `messenger-mot-cham`, `chuyen-khoan`, `gop-don`, `khach-quen`, `cho-hang`, `gia-live`, `xem-lai`; `don` (chuỗi 300 thao tác
  ngẫu nhiên thêm gộp đơn, sửa món sau xác nhận).
- **Bản xem thử 28/9/2026** (Facebook giả, AI giả): Cài đặt chọn Vietcombank + số tài khoản mẫu → chốt "12 trắng M", bấm Giữ, gửi tên /
  số / địa chỉ một tin → thẻ đơn 3 nút + [➕ Thêm chân váy 25]; bấm Chuyển khoản → đơn Đã xác nhận, ảnh QR VietQR thật (0đ, số tài khoản
  mẫu) hiện trong khung chat giả + tin có ngân hàng, số tài khoản, nội dung DH0032, câu chống giả shop; Đơn hàng → tab "Chờ tiền CK" →
  "Đã nhận tiền" → khách nhận "Dạ shop đã nhận 289.000đ cho đơn DH-0032…". Kết thúc live giả, bình luận "chốt 12 be M" trên video xem
  lại → thẻ giữ hàng "Giữ tới 05:39", không đọc tên, không "Vừa chốt". Mục lục không đăng vì buổi tập chưa sang món nào — báo đúng lý do.
  Công tắc Giá live và Số đo tắt → không có ô.
- Sửa trong lúc xem thử: khung chat giả hiện nút Gọi shop; quét xem lại bỏ qua video không còn (báo một lần); công cụ chuyển khoản gọi lại
  trong 10 phút không báo lỗi; sửa test chập chờn `chot-don` (dãy số ngẫu nhiên trong payload).
- **Thử AI thật: chưa chạy (0 USD) — `.env` của dự án này chưa có khóa** (`OPENAI_API_KEY=` trống; ghi chú cũ "dùng chung khóa bản tuyển
  dụng" không còn đúng). Kịch bản đã viết sẵn và chạy khô bằng AI giả: `scripts/thu-ai-bh7.js` — Tư vấn viên gpt-6-luna (tắt dự phòng
  Gemini), khách do mã gõ: "chuyển khoản được không", "cho mình xin số tài khoản", "mình ck rồi nha", khách có số đo đã lưu hỏi size;
  tự chấm: AI không tự gõ số tài khoản, không nói "đã nhận tiền", có gửi mã QR; trần 0,10 USD (vượt là dừng), ước 0,03–0,05 USD. Director
  gắn nhãn lưỡng lự (hoãn từ BH6) cũng chờ khóa.

**Quyết định khi chủ dự án vắng — BH7** (28/9/2026; muốn đổi thì nói):
1. Tên chủ tài khoản lưu đúng như gõ (viết hoa); bỏ dấu chỉ lúc dựng ảnh QR (VietQR cần không dấu).
2. Số tài khoản KHÔNG vào nguồn của AI (dòng Cài đặt chỉ có ngân hàng + tên chủ TK) — AI tự gõ số tài khoản thì Bộ kiểm tra chặn (K3);
   số tài khoản và mã QR chỉ đi bằng công cụ `gui_ma_chuyen_khoan`. Thêm **K12**: AI nói "đã nhận tiền / chuyển khoản thành công" là chặn
   (trước chỉ cấm trong lời dặn).
3. Khách từng hoàn nhiều bấm Chuyển khoản → không đổi cách trả, không gửi QR, việc "Gọi xác nhận" ghi rõ khách muốn chuyển khoản.
4. Món phối: gợi ý cả khi không có mức miễn ship (vẫn 1 lần / 24 giờ mỗi người). Hỏi gộp gửi **trước** tin xin thông tin, và tin xin
   thông tin vẫn gửi ngay (không bấm = tách, không bị treo). Mỗi đơn mới hỏi gộp một lần.
5. Gộp đơn: cùng phân loại cùng giá thì cộng số lượng; khác giá (giá live / thường) thì giữ dòng riêng.
6. Hỏi lưu số đo gửi như tin trả lời (ngay sau lượt Tư vấn viên), chỉ ghi "đã hỏi" khi gửi được. "Xóa số đo" xóa ngay, không hỏi lại.
   Menu "Xóa dữ liệu của tôi" xóa ngay số đo (phần còn lại người xử lý trong 72 giờ).
7. Danh sách chờ: người đầu cần nhiều hơn số còn thì chờ tiếp, không nhảy cóc; lời mời không nhắn được (quá 24 giờ) → hủy đơn đó, suất
   sang người sau; bấm "Vẫn chờ" lúc vừa có hàng → mời luôn.
8. Giá live: thêm dòng đơn cùng phân loại khác giá thành dòng riêng; Thanh chữ hiện "259.000đ · tới hết buổi"; công cụ "Nói với Mai"
   `dat_gia_live` (xem trước + Làm). Đội AI không có câu mẫu giá live riêng — câu giá của Mai đã đổi sang giá live khi có.
9. Bán sau live: buổi tập nhận bình luận xem lại tới khi bấm "Kết thúc & trả hàng về kho" (mốc lưu ở Cài đặt); mục lục đăng cả cho buổi
   tập trên Facebook giả để xem được; chỉ đếm "Chốt sau live" khi bình luận sau giờ kết thúc + 15 giây.
10. Nhu cầu sửa bảng trạng thái mục 7 (`da_xac_nhan → cho_xac_nhan` khi sửa món) đã có sẵn từ bản 3.4 — không sửa thêm.

**Kết quả BH8 — Trước live và sau mua** (28/9/2026, Claude Code làm khi chủ dự án vắng; tag `bh8-truoc-sau-live`):
- `npm test` **683 đạt, 0 lỗi** (27 test mới). Không tốn tiền.
- Nâng cấp dữ liệu 021:
  - bảng `dong_y_nhan_tin`, `anh_khach`;
  - cột hỏi lại / hỏi mặc của đơn, `phien_live.tong_ket`;
  - agent `soan_bai`, `tong_ket`.

  Bản xem thử đã nâng 021 (tự sao lưu `data/xem-thu/sao-luu/truoc-nang-cap-21.db`); `data/moza.db` (17) chưa chạy 018 → 021.
- Tính năng:
  - Nền: tua thời gian tới 168 giờ, nút tua 96 giờ.
  - F-95: Tổng quan kiểm 8 mục thông tin shop, "Điền bằng lời" qua Nói với Mai (xem trước + Làm), giờ nghe máy, dòng đổi trả ngắn.
  - F-96: lịch live cố định, "✨ AI soạn" bài báo trước (Sự kiện live, bài nhá hàng, 3 câu Reels), ảnh ghép 2×2, lời mời + link cho nhóm Zalo.
  - F-97: báo live cho người đã đồng ý (từng buổi, trong 24 giờ).
  - F-98: bộ mẫu Utility trạng thái đơn, tin "đã gửi" trong 24 giờ thành câu mẫu (0 AI).
  - F-99: hỏi lại đơn trước khi gửi.
  - F-100: hỏi thăm "mặc thấy sao" và "X/Y khách nói vừa".
  - F-101: xuất file theo hãng — "Chung", "Nhập hàng loạt", tách 34 tỉnh.
  - F-102: Tổng kết sau live (phễu máy đếm, ≤ 3 gợi ý AI có kiểm số).
  - F-103: mốc từng món trong video + đoạn 45 giây nên cắt + chú thích.
  - F-104: khách mặc thật (tắt mặc định).
- Test mới:
  - `thong-tin-shop`, `lich-live`, `dong-y-nhan-tin`, `mau-utility`, `hoi-lai-hoi-mac`;
  - `xuat-van-chuyen` (so byte với file cũ, 30 địa chỉ mẫu ≥ 90% đúng tỉnh);
  - `tong-ket` (phễu khớp đếm thật, AI không thấy tên, gợi ý sai số / vùng miền / khan hiếm bị bỏ, mốc đúng tới giây);
  - `anh-khach` (tắt → không lưu; chưa duyệt không lên màn hình; gỡ ảnh lúc đang chiếu → đổi ngay; ảnh không tới AI).
- **Bản xem thử 28/9/2026** (Facebook giả, AI giả):
  - Tổng quan hiện "Thông tin shop: còn thiếu 3/8".
  - Báo cáo → Tổng kết buổi tập 9:40: phễu 7 người chốt, 6 mốc món có giờ trong video, chú thích chép được, "Có giọng trợ lý AI".
  - Khách giả "Ngọc Anh" (đơn DH-0032 chuyển Đã gửi) gửi ảnh qua nút mới "📷 Gửi ảnh" → thẻ xin phép [Đồng ý] [Không] → bấm Đồng ý → màn duyệt hiện ảnh đã nhòe phần mặt, món số 12 + size M điền sẵn → Duyệt → Màn hình sản phẩm "Khách mặc thật" hiện ảnh đã che, nhãn "Khách thật · mặc size M" → khách nhắn "shop gỡ ảnh của em nha" → "Dạ shop gỡ ảnh của bạn rồi", màn hình hết ảnh.
  - Công tắc tắt lại sau khi thử.
- Sửa trong lúc xem thử:
  - phễu tách "Shop hủy / trả kho" khỏi "Khách hủy" (buổi tập trả kho bị tính nhầm là khách hủy);
  - chú thích clip thiếu dấu cách, cú pháp chốt ghi "+ size" cả với món không size (sửa cả bài báo trước);
  - **ảnh khách đã che nhưng trình duyệt hiện lại ảnh gốc cùng địa chỉ** → địa chỉ ảnh có mã phiên bản (tệp trên đĩa đã che đúng — kiểm điểm ảnh ở mắt, miệng);
  - Màn hình sản phẩm đang chiếu ảnh khách mà khách xin gỡ / tắt công tắc → đổi ngay;
  - kiểm số của gợi ý tổng kết chặt hơn K3 (số nhỏ 0–10 cũng phải có trong số liệu).
- **Thử AI thật: chưa chạy (0 USD) — `.env` chưa có khóa OpenAI.**
  - Kịch bản viết sẵn, chạy khô bằng AI giả được: `scripts/thu-ai-bh8.js` — Nói với Mai điền thông tin shop, soạn bài báo trước, tổng kết buổi 8 người chốt; chỉ `gpt-6-luna`, tắt dự phòng Gemini, trần 0,08 USD, ước 0,02–0,04 USD.
  - Chấm bằng mã: có bảng xem trước, số lỗi kiểm của bài, số gợi ý, không tên trong số liệu.

**Quyết định khi chủ dự án vắng — BH8** (28/9/2026; muốn đổi thì nói):
1. "Nói với Mai" chỉ ghi được 11 ô thông tin shop (phí ship, miễn ship, giờ giữ, giờ nghe máy, xưng hô, tên / số / địa chỉ shop,
   người phụ trách, đổi trả). **Ngân hàng, số tài khoản, tên chủ tài khoản chỉ gõ ở Cài đặt** (số tài khoản không đi qua AI, như BH7).
   Sổ tay chỉ thêm / bổ sung, không xóa.
2. Bài báo trước: MOZA không tự đăng. Chỗ ngày giờ, số món, cú pháp chốt do máy điền. Bài sai kiểm thì AI viết lại 1 lần, vẫn sai thì bỏ phần đó
   và ghi "Kiểm lại".
3. Báo live: lời mời chỉ khi buổi kế trong 23 giờ; tin báo chỉ gửi khi còn trong 24 giờ kể từ lúc khách bấm (không dùng mẫu tiếp thị).
4. Tin trạng thái đơn (đã xác nhận, chuẩn bị gửi, đã gửi, hỏi mặc): trong 24 giờ dùng câu mẫu (0 AI), ngoài 24 giờ chỉ mẫu Utility đã duyệt
   và được xếp UTILITY; khách đã DỪNG → không gửi, tạo việc cho người.
5. Hỏi lại đơn và hỏi thăm "mặc thấy sao" tính là tin chăm sóc (giới hạn liên hệ `cham_soc`), giờ riêng 8h–21h và 10h–20h. Hỏi thăm mỗi
   người một lần / 14 ngày, chỉ đơn mới nhất.
6. Xuất file theo hãng: **GHTK, GHN, Viettel Post, J&T chưa có mẫu cột chính thức** (file mẫu chỉ tải được khi đăng nhập trang khách hàng
   — tra 28/9/2026). Tạm dùng mẫu "Nhập hàng loạt" (cột phổ biến). Chủ dự án đưa file mẫu thì Claude Code điền cột, không cần sửa mã.
   Không sinh Excel (chưa hãng nào bắt buộc) — CSV mở được bằng Excel.
7. Tổng kết sau live:
   - hiện cả cho buổi tập (ghi rõ "Buổi tập"), nhưng so sánh chỉ lấy 5 buổi thật;
   - gợi ý AI tự viết khi mở trang sau 6 giờ kể từ lúc live xong (khách kịp trả lời, xác nhận), trước đó bấm "Viết gợi ý ngay";
   - gợi ý đã lưu không gọi AI lại.
   - Phễu đếm theo **đơn** (một người 2 đơn thì tính 2), riêng "Người chốt" đếm người.
8. Mốc video: tính theo giờ bắt đầu Facebook trả về, thiếu thì theo giờ MOZA thấy live (ghi "±30 giây"). Đoạn nên cắt tránh 40 giây sau
   mỗi lần chốt (30 giây chờ đọc tên + Thanh chữ). Không có 45 giây liền thì ghi cách cắt khác, không bịa đoạn.
9. Khách mặc thật:
   - che mặt bằng **khảm ô + làm mờ phần trên ảnh** trên trình duyệt (không nhận diện mặt, không AI), mặc định 35%, kéo 0–60%;
   - ảnh đã che ghi đè tệp gốc;
   - ảnh gửi trong 2 phút sau lần hỏi gom chung; ảnh gửi sau khi khách đã trả lời thì hỏi lần mới;
   - tin chỉ có ảnh thì không gọi AI; tin có ảnh kèm câu hỏi thì Tư vấn viên vẫn trả lời chữ, nhưng công cụ tìm mẫu theo ảnh từ chối ảnh này;
   - khách đã DỪNG gửi ảnh thì không hỏi;
   - buổi live thật không chiếu ảnh của khách diễn tập.
   - Sao lưu tự động hiện chỉ chép cơ sở dữ liệu (như ảnh sản phẩm) — thư mục `data/anh-khach/` chép tay khi chuyển máy.
10. Hộp thư giả có nút "📷 Gửi ảnh" cho khách giả (để chủ dự án tự thử F-104 và tìm mẫu theo ảnh).

**Kết quả BH9 — Thử nghiệm AI** (28/9/2026, Claude Code làm khi chủ dự án vắng; tag `bh9-thu-nghiem-ai`):
- `npm test` **700 đạt, 0 lỗi** (17 test mới + bộ 62 câu mẫu). Không tốn tiền.
- Nâng cấp dữ liệu 022:
  - bảng `loi_noi_song`, `don_danh_dau`;
  - agent `nhin_mon`.
- Tính năng:
  - **F-105 kiểm lời Mai trên sóng + tự đính chính.** Hook `kiem_loi_noi` ở cửa `truoc_phat` (tắt được), mã `MIENG_NOI_SAI`, `dinhChinh` cho GPT Live 1 / Gemini 3.8 Live. Miệng giả chỉ cho buổi tập; kịch bản diễn tập "Mai nói nhầm số".
  - **F-106 giữ giá có lợi cho khách.** Chỉ hạ, chỉ dòng món bị nói sai, chỉ đơn chưa gửi, có "Giữ giá đúng"; ô chọn ở Cài đặt → Bán hàng.
  - **F-107 MOZA nhìn qua OBS.** Chỉ gợi ý, không tự chuyển; Camera giả trong Phòng diễn tập.
- Test mới:
  - `kiem-so-noi`: 62 câu mẫu có đáp án. Bắt đúng 100% câu sai có món rõ, 0 câu đúng bị báo. Có cả số đọc bằng chữ, "trăm năm chín", "trăm rưỡi", "hai trăm tư", giá riêng phân loại, n × giá, giá + ship, số đo, "áo số mười hai".
  - `kiem-loi-noi-song`: GPT / Gemini / miệng giả; đính chính trong ≤ 3 giây; tiếng câu sai bị bỏ; số cắt đôi "159." + "000đ" không báo nhầm; lặp 60 giây; câu đính chính vẫn sai / 3 lỗi → "Chỉ gợi ý"; tắt hook; miệng giả ở phiên thật → lỗi.
  - `gia-noi-nham`: bất biến tổng tiền; trước / trong / sau khoảng; đơn đã gửi; hai chế độ; phí ship / miễn ship; chốt qua Facebook giả → tin đầu mang giá Mai nói.
  - `nhin-mon`: OBS giả, đồng hồ giả; hình không đổi → 0 lần gọi; 5 điều kiện + 2 lần liền; không bao giờ tự chuyển; bỏ qua 60 giây; giới hạn lần / giờ; nguồn chỉ camera; nhật ký không có ảnh; Dừng mọi thứ / hết live → tắt.
- **Bản xem thử 28/9/2026** (Facebook giả, AI giả, miệng giả):
  - Tập nhanh → chế độ "Mai nói" với "Miệng giả (tập, không tốn tiền)". Người dẫn nhờ "đọc giúp: áo số 12 hôm nay chỉ 150k" → Mai (giả) nói → Màn hình người dẫn băng đỏ "Mai vừa nói 150.000đ, đúng là áo số 12 giá 289.000đ. Đã đính chính trên sóng."
  - Khách giả chốt "12 trắng M" ngay sau đó → đơn DH-0034 đơn giá 150.000đ, nhãn "Mai nói nhầm giá". Thẻ giữ hàng đầu tiên gửi khách ghi "Áo 12 Trắng/M · 150.000đ".
  - Lỗi thứ hai (quần 21 giá 199k) → Thanh chữ hiện "Đính chính: Quần số 21 giá 349.000đ".
  - Bật "👁 MOZA nhìn" (Camera giả), chọn "Người dẫn đang cầm: quần 21" → ô "Đang cầm quần số 21? [Chuyển (Enter)] [Bỏ qua]" hiện sau 2 lần nhìn, đoạn chưa đổi. Bấm Chuyển → đoạn 6 (quần 21), Màn hình sản phẩm chiếu quần 21. Nhật ký máy chủ không có lỗi.
- Sửa trong lúc làm:
  - "áo số 12 đồng giá" bị đọc "12 đồng" thành tiền → bỏ cụm gọi món trước khi đọc số (dùng chung `boGoiSo`);
  - câu đính chính sai lần hai bị bộ chống lặp 60 giây bỏ qua → câu trong cửa sổ đính chính luôn được xét;
  - khách chốt thêm món trong khoảng nói nhầm vẫn được hạ giá (trừ đơn chủ shop đã bấm "Giữ giá đúng").
- **Phép thử AI thật: chưa chạy — chủ dự án chưa duyệt chi phí và `.env` chưa có khóa (0 USD).** Đã chuẩn bị:
  - `scripts/thu-ai/dung-khung-thu.js`: đã dựng 52 khung 1280×720 + bảng mẫu 6 món bằng ffmpeg có sẵn trên máy (0 đồng; Claude Code đã xem, khung hợp lý).
  - `scripts/thu-ai/thu-nhin-mon.js`: chấm tỷ lệ đúng, "chắc mà sai", độ trễ, chi phí; detail low rồi high; trần 0,08 USD; chạy khô được.
  - P15 với miệng thật (Gemini 3.8 Live 6 phút ~0,15 USD Google; GPT Live 1 3 phút ~0,15–0,20 USD) chạy trên bản xem thử bằng kịch bản "Mai nói nhầm số" khi chủ dự án duyệt. Ghi chữ chép thành `test/du-lieu/chep-loi-mai-*.json`.

**Quyết định khi chủ dự án vắng — BH9** (28/9/2026; muốn đổi thì nói):
1. Tra 28/9/2026 không có gì đổi phương pháp:
   - GPT Live 1 vẫn không nhận ảnh → "MOZA nhìn" dùng `gpt-6-luna`.
   - Gemini 3.8 Live ngắt bằng `turnComplete`.
   - OBS có `GetSourceScreenshot`.
2. **Chỉ đính chính ở mức "chắc"** (món nói rõ trong câu). Món chỉ đoán theo đoạn đang nói, hoặc số trùng giá món khác (câu so sánh) → "nghi", chỉ báo người dẫn.
3. Đính chính bằng chính miệng Mai (giữ một giọng, 0 lượt giọng Google); Thanh chữ là con số chuẩn.
   - GPT Live 1: MOZA giữ im phần còn lại của câu sai tới câu mới (chưa có lệnh dừng câu qua WebSocket).
   - Gemini: lượt mới cắt ngang ở máy chủ, không giữ im để khỏi mất đầu câu đính chính.
4. "Còn N" sai: đính chính bằng số còn thật của các ô được nhắc. "Sắp hết" không đúng ngưỡng: chỉ "nghi" (băng vàng).
5. Chưa hiện chip "chưa có chữ chép" (để khi có số liệu buổi thật). Giữ tiếng 0 ms như kế hoạch.
6. Giữ giá có lợi cho khách:
   - Hạ giá giữ nguyên phí ship của đơn, để tổng không bao giờ tăng (tổng hàng giảm dưới mức miễn ship vẫn không bị tính ship).
   - Đơn Đã xác nhận bị hạ giá không phải xác nhận lại (khách chỉ trả ít hơn); thẻ đơn gửi lại chỉ khi đơn còn Chờ xác nhận và đã có thẻ.
   - Mỗi đơn một việc cho chủ shop (ghi mã đơn), không gộp.
   - Lỗi miễn ship: đơn đạt mức Mai nói thì phí ship 0.
7. MOZA nhìn:
   - ảnh nhỏ dùng BMP (OBS báo có); khung gửi AI là JPEG 512 px, detail low;
   - hỏi tối đa 2 lần cho mỗi lần đổi hình (lần 2 chỉ để xác nhận), nên lần hỏi / giờ thấp hơn trần 600;
   - chọn nguồn camera: tự lấy nguồn đầu tiên trong cảnh "Moza · Phòng live" không phải nguồn của MOZA; đổi bằng khóa `obs.nguon_camera` (**chưa có ô chọn trên Cài đặt → OBS** — thêm khi chủ dự án làm bước B với camera thật).
8. Camera giả gắn đáp án riêng cho AI giả của bản xem thử (AI thật không nhận trường này) để xem được trọn luồng.
9. Miệng giả không có trong danh sách miệng mặc định ở Cài đặt, chỉ chọn được theo buổi tập.

**Việc chủ dự án cần làm — đợt cải tiến 3.4** (theo thứ tự; Claude Code viết hướng dẫn từng bước khi tới lúc):
1. **Đã xong 27/9/2026:** đồng ý mở đường ảnh sản phẩm công khai hẹp cho thẻ giữ hàng (#97); đồng ý trần ngày có live 20 USD (#101).
   - Còn lại (không chặn code): xem các mặc định Claude Code đã chọn, muốn đổi thì nói: giữ ngắn "hết live + 2 giờ"; khi Dừng AI tin
     khách vào Cần người kèm câu báo nhận; Gọi xác nhận gia hạn 12 giờ một lần rồi mới hủy; đánh dấu 14 video là dựng thử; nhật ký
     90 ngày; ngưỡng hỏi lại đơn 500.000đ; hỏi thăm sau 4 ngày; hạn xử lý xóa dữ liệu 72 giờ; tự đăng mục lục sau live. Các mặc định
     nhỏ khác ở `docs/08` (mục "Mặc định tự chọn" của từng tính năng).
2. **Đã xong 27/9/2026:** "Làm BH5" rồi giao làm hết khi vắng. BH5 đã code (28/9); duyệt lại các "Quyết định khi chủ dự án vắng — BH5".
3. Trước lần thử AI thật đầu tiên (cuối BH5): dùng khóa AI riêng của shop (Google, OpenAI), đã bật trả tiền, tự dán vào `.env`
   hoặc màn hình Cài đặt (không dán vào chat) — để tiền thử không lẫn bản tuyển dụng, dữ liệu khách không đi qua gói miễn phí.
4. Duyệt từng phép thử tốn tiền khi Claude Code báo (BH5 ≤ 0,05 USD; BH6 ≤ 0,08 USD Google; BH7 ≤ 0,10; BH8 ≤ 0,08; BH9 ~0,40
   cả hai hãng — mục 11).
5. Càng sớm càng tốt: lập Page bán hàng riêng có ≥ 100 người theo dõi, tài khoản dùng ≥ 60 ngày — để phát live được và làm Bước 0.
6. Cho biết shop đã có giấy đăng ký hộ kinh doanh chưa — quyết định xác minh doanh nghiệp trên Meta và quyền nhắn tin khách lạ.
7. Lập ứng dụng Meta riêng; chọn chỗ đặt trang chính sách quyền riêng tư có địa chỉ cố định (nháp: `docs/chinh-sach-rieng-tu-ban-hang.md`
   — nhờ luật sư đọc trước khi đăng); nộp
   **một** lần xét duyệt gom đủ quyền — chưa duyệt thì MOZA không nhắn được khách thật nào.
8. Chuẩn bị Bước 0: tài khoản cá nhân chưa từng nhắn Page thêm làm "người thử", cài `cloudflared`, tắt "Bình luận → tin nhắn" và
   Business AI trong Meta Business Suite.
9. Cài đặt → Bán hàng: điền **người phụ trách buổi live**, chọn **cách xưng hô**, điền **tên chủ tài khoản nhận tiền** và **phí ship**
   (bảng Sẵn sàng lên sóng báo vàng khi còn trống).
10. Sau khi nối Page thật: bấm một lần "Cài Messenger cho Page" và "Tạo bộ mẫu tin" (đổi cài đặt Page nên người bấm).
11. BH7 đã code: vào Cài đặt → Bán hàng chọn **ngân hàng** + gõ **số tài khoản** thật của shop (bản xem thử đang để số mẫu
    0011001234567 — đổi đi); viết mục Sổ tay "Hoàn tiền khi shop hết hàng / hủy đơn"; tự chuyển thử 1.000đ bằng mã QR của một đơn tập.
    Dán **khóa OpenAI** vào Cài đặt → Khóa AI (không dán vào chat) rồi báo Claude Code chạy `scripts/thu-ai-bh7.js` (≤ 0,10 USD) và
    `scripts/thu-ai-bh8.js` (≤ 0,08 USD).
12. Trước live thật: xác thực danh tính người livestream (Luật TMĐT 122/2025) — một lần.
13. Quay video thật 15 giây mỗi màu, chụp ảnh trên hai dáng người; lấy giấy đồng ý của người lên hình (Claude Code soạn mẫu).
14. BH8 đã code: Cài đặt → **Lịch live** tích thứ + giờ live cố định; Cài đặt → Bán hàng chọn **hãng vận chuyển**; đăng nhập trang
    khách hàng của hãng, tải **file mẫu nhập đơn hàng loạt** (Excel / CSV) rồi đưa Claude Code điền cột. Sau khi nối Page thật: bấm lại
    "Tạo bộ mẫu tin" để gửi thêm 3 mẫu mới (đã xác nhận, chuẩn bị gửi, hỏi mặc) cho Meta duyệt. Ô "Giờ nghe máy" và dòng "Đổi trả".
15. BH9 đã code — **duyệt chi phí phép thử thật** rồi báo Claude Code chạy (cần khóa ở mục 11 trước):
    - (a) `scripts/thu-ai/thu-nhin-mon.js`: MOZA nhìn trên 52 khung dựng sẵn, gpt-6-luna, trần 0,08 USD.
    - (b) P15 với Gemini 3.8 Live: 6 phút ~0,15 USD tiền Google, kịch bản "Mai nói nhầm số".
    - (c) P15 với GPT Live 1: 3 phút ~0,15–0,20 USD — chỉ khi ngân sách OpenAI còn ≥ 0,25 USD.
16. (Tùy, bước B của MOZA nhìn) cài OBS, thêm camera điện thoại vào cảnh "Moza · Phòng live". Giấy đồng ý của người lên hình phải
    ghi rõ khung hình được gửi sang OpenAI ở nước ngoài — luật sư xem (Luật 91/2025 Điều 20).
17. Xem lại ô "Khi Mai lỡ nói giá thấp hơn" (mặc định "Bán theo giá Mai nói") — đụng tiền thật, nhờ luật sư / kế toán xem trước khi
    live thật.

**Sổ chi phí thử AI thật — đợt 3.4** (#93; Claude Code ghi mỗi lần chạy; cộng dồn OpenAI chạm 0,80 USD thì dừng):

| Ngày | Mốc | Phép thử | Hãng, model | Chi phí (USD) | Cộng dồn OpenAI |
| --- | --- | --- | --- | --- | --- |
| 28/9/2026 | BH5 | Không chạy (mọi phần mới bằng mã, test với AI giả) | — | 0 | 0 |
| 28/9/2026 | BH6 | Không chạy (bằng mã / AI giả; Director gắn lưỡng lự để chung buổi thử ở BH7) | — | 0 | 0 |
| 28/9/2026 | BH7 | Chưa chạy: `.env` chưa có khóa OpenAI — kịch bản `scripts/thu-ai-bh7.js` chờ khóa (trần 0,10 USD) | — | 0 | 0 |
| 28/9/2026 | BH8 | Chưa chạy: chưa có khóa — kịch bản `scripts/thu-ai-bh8.js` (Nói với Mai, soạn bài, tổng kết; trần 0,08 USD) | — | 0 | 0 |
| 28/9/2026 | BH9 | Chưa chạy: chưa duyệt chi phí, chưa có khóa — `scripts/thu-ai/thu-nhin-mon.js` (0,08) + P15 miệng thật (Gemini ~0,15, GPT ~0,20) | — | 0 | 0 |

**Chuyển sang OpenAI — 8/10/2026** (chủ dự án: "Chuyển sang OpenAI cả"; khóa Gemini bị Google trả 403 "project has been denied access"):
- 12 Agent dùng OpenAI: `gpt-6-luna` chính, `gpt-6-sol` dự phòng (hai Agent Claude — Soát sản phẩm, Bài học — giữ Claude, thiếu
  khóa thì tự sang `gpt-6-sol`). Đổi trong Cài đặt của bản xem thử; bản thật đổi giống vậy ở Cài đặt → Agent.
- Chép lời người dẫn thử OpenAI trước, Gemini dự phòng. Buổi tập: Tư vấn viên dự phòng `gpt-6-sol`.
- Máy đọc giọng (câu chen Đội AI, người dẫn giả ở Phòng diễn tập): `gpt-4o-mini-tts` (tra tài liệu, bảng giá OpenAI 8/10/2026 —
  vẫn là máy đọc mới nhất; 0,60 / 12 USD cho 1 triệu token ≈ 0,015 USD mỗi phút tiếng). Chọn ở `mac-dinh.json` `doc_giong.nha`
  (`openai` | `gemini`). Mỗi nhân vật Đội AI một giọng OpenAI theo nam / nữ (Mai = marin như GPT Live); người dẫn giả cedar,
  khách mời coral. Giọng Mai tự tạo ở Google không dùng được với OpenAI.
- Còn cần Google: nhạc hiệu AI sáng tác (Lyria — OpenAI không có), tạo / nhân bản giọng Google ở Cài đặt → Giọng Mai.
- Test: 710 đạt (thêm `test/doc-giong-openai.test.js`; các test máy đọc Google chạy với `datNhaDoc('gemini')`).

**Để sau: luật sư, chuyên gia (#127)** — chủ dự án làm sau; không chặn mốc nào. Nên xong **trước khi live thật với khách lạ** và
**trước khi bật** các công tắc đang tắt. Claude Code soạn sẵn nháp và danh sách câu hỏi để đưa chuyên gia.
- **Luật sư:**
  - #18 gửi nguyên số điện thoại, địa chỉ khách cho OpenAI / Google — có phải lập hồ sơ chuyển dữ liệu ra nước ngoài (Luật 91/2025
    Điều 20) không; có phải che số (P36) không. Mức phạt có thể tới 5% doanh thu.
  - Trang chính sách quyền riêng tư (các bên nhận dữ liệu: OpenAI, Google, hãng vận chuyển, VietQR).
  - Chữ nhãn AI và câu tự nhận AI trong thẻ, trên sóng (Luật AI 134/2025 Điều 11, NĐ 142/2026).
  - Giá gạch và giá live (Luật TMĐT Điều 24; F-76, F-93); từ cấm K11, chữ "nhất", "số 1"; cách hiện "N người chốt" (Luật TMĐT
    Điều 6, Luật Quảng cáo 75/2025).
  - Nhịp nhắc 2 lần + báo hủy; câu xin đồng ý báo live (NĐ 330/2026, Luật 91/2025 Điều 28 — hai nguồn ghi mức phạt khác nhau).
  - Nhật ký buổi live giữ 90 ngày; hạn xử lý xóa dữ liệu 72 giờ; số đo khách có phải dữ liệu nhạy cảm (NĐ 356/2025).
  - Ảnh khách mặc thật (câu xin phép "Ảnh đẹp quá! Shop xin phép dùng ảnh này…" và câu gỡ ảnh ở `cau-mau-khach.json`: `xin_anh_khach`, `da_go_anh`; che mặt theo vùng có đủ không); giấy đồng ý người mẫu (Luật Quảng cáo Điều 8, Bộ luật Dân sự Điều 32); khung hình camera gửi OpenAI (F-107).
  - Bán hàng từ xa (Luật 19/2023, NĐ 55/2024 — chưa tra): thẻ đơn cần thông tin gì.
  - Nghĩa vụ người bán, người livestream (Luật TMĐT 122/2025, NĐ 248/2026); nếu sau này bán MOZA cho shop khác: nghĩa vụ bên cung cấp
    hệ thống AI (NĐ 142/2026), hợp đồng xử lý dữ liệu.
  - Kiểm lời Mai / đính chính (F-105): bảng lỗi nói trên sóng giữ bao lâu; câu đính chính có đủ theo Luật TMĐT Điều 24 không.
  - "Bán theo giá Mai nói" (F-106) hay "Chủ shop quyết": cách nào an toàn khi khách khiếu nại "live bảo 150k".
- **Kế toán:** khai tài khoản nhận tiền bán hàng với cơ quan thuế (NĐ 68/2026, mẫu 01/BK-STK); mốc doanh thu 1 tỷ đồng/năm.
- **Người rành thanh toán:** mã QR chuyển khoản, chính sách hoàn tiền; sau này payOS / SePay; tiền thu hộ khi nối hãng vận chuyển.
- **Công tắc chỉ bật sau khi chuyên gia xem:** "Giá live" (F-93), "Hỏi khách lưu chiều cao, cân nặng" (F-91), "Dùng ảnh khách
  mặc thật" (F-104).

**Quyền của Claude Code**
- **Được tự quyết:** cấu trúc bên trong module, tên hàm, cách viết SQL, nội dung mồi của Skill, lời dặn, câu mẫu, câu mẫu
  chốt đơn, bảng tên gọi khác của màu / cỡ; dữ liệu mẫu cho Phòng diễn tập.
- **Được tự ghi vào SPEC.md** (kèm dòng nhật ký sửa): kết quả đo; gạch mục "cần kiểm chứng" đã xong; phiên bản thực tế đã dùng.
- **Phải dừng và hỏi trước khi làm:** đổi yêu cầu, cấu trúc dữ liệu (mục 7) hoặc kiến trúc (mục 5); thêm thư viện; một tiêu
  chí không đạt được; phát hiện đặc tả sai hoặc thiếu (ghi mục 13 trước rồi hỏi); mọi việc cần chủ dự án thao tác trên
  Facebook, Meta, Cloudflare, Google hoặc cài phần mềm vào Windows; xóa dữ liệu (luôn sao lưu trước).
- Chủ dự án đồng ý thay đổi thì sửa đặc tả trước, code sau. Xong mỗi mốc: `npm test`, ghi kết quả vào SPEC.md, commit + tag, dừng để chủ dự án duyệt.

---

**Kết quả GD1 — Giao diện gọn và rõ** (28/10/2026, Claude Code, theo `docs/phieu-gd1.md`; tag `gd1-giao-dien`, tag trước mốc `truoc-gd1`; 0 USD):
- `npm test`: **768 / 768 đạt** (733 cũ + 35 mới: `giao-dien-dinh-dang`, `giao-dien-chu-nguoi-dung`, `giao-dien-so-sanh`, `gd1-cai-dat`, `gd1-cho-duyet-het-han`,
  `gd1-ai-kenh`, `gd1-don`). Xem thử `moza-ai-gia`: 16 màn × 2 cỡ (1440 × 900, 1366 × 768) chụp ở `data/tam-test/ui-gd1/` (chỉ trên máy), không lỗi JS, không tràn ngang.
- **3.4** `public/js/trang-thai.js` (một bảng trạng thái → chữ + màu + biểu tượng; đơn, sản phẩm, kho, phiên, hộp thư, agent, duyệt, nhật ký, đội AI…) và
  `dinh-dang.js` (tiền "10.000đ", `docTien`, USD ≈ VNĐ theo tỷ giá, ngày dd/mm/yyyy, giờ phút); thay các bảng màu và 5 bản hàm tiền, 3 chỗ 26000 viết cứng.
- **F-119** menu trái 3 nhóm (thu còn biểu tượng dưới 1280 px và ở Màn hình người dẫn); đường cũ đổi tên (`#/tong-quan → #/hom-nay`, `#/hop-thu → #/tin-nhan`,
  `#/agent… → #/cai-dat/tro-ly-ai…`, `public/js/duong-cu.js`); "Trợ lý AI" thành tab trong Cài đặt, tab kỹ thuật (Lời dặn vai trò, Hook, Luật quyền, Agent thử nghiệm) sau
  "Nâng cao" (`localStorage`); token CSS (`--k1…--k6`, `--bo*`, `--c-*`, `--nguy`); **phông trong máy** `public/font/` (Be Vietnam Pro 400–700 + Lora 600, woff2 từ Google Fonts
  chính thức, giấy phép OFL kèm theo); bỏ mã kỹ thuật (`(#số)`, `(F-số)`) ở 16 chuỗi người dùng thấy; `goiY()` (ⓘ), `hoi()` (hộp hỏi trong khung trang), `trangTrong()`;
  ô ngày Báo cáo dd/mm/yyyy + nút nhanh; ô tiền "10.000đ"; `favicon.svg`; Cài đặt → Phần mềm (ẩn bớt `giao_dien.an[]`, tỷ giá).
- **F-121** Cài đặt đầu trang: "Cần xử lý" và bảng "AI & kênh" (Bật / Tắt = cờ `agent.bat`, đã dùng hôm nay, nút Dừng mọi tự động = "Dừng AI" của F-72); cài đặt `ty_gia_vnd`
  (mặc định 26.000); **hạn Chờ duyệt 24 giờ**: nâng cấp **023** (cột `cho_duyet.het_han_luc`, không đổi CHECK; việc cũ do "Dừng mọi thứ" / giới hạn tin được đặt hạn từ lúc tạo),
  `demCho` / `danhSach` bỏ việc quá hạn, mục "Đã hết hạn" trong Chờ duyệt (xem lại, Bỏ).
- **F-120** trang Hôm nay (`hom-nay.js`, `hom-nay-phu.js`): thẻ buổi live kế + Bắt đầu live / Tập trước, 4 số (số 0 thành câu chỉ việc), việc theo mức, Đội AI như nhân viên
  (`GET /api/agent/doi-hinh`), chỉ số AI 7 ngày (`GET /api/agent/chi-so?ngay=7`); mã ở `server/nghiep-vu/ai-kenh.js`.
- **F-122** Bắt đầu live 3 bước (`bat-dau-live.js`, tách khỏi `live.js`); danh sách đỏ hiện ngay trong bước 3 (không còn `confirm`), "Vẫn lên sóng" / "Sửa trước".
- **F-123** Đơn hàng 4 tab (`?nhom=can_lam|dang_giao|xong|huy_hoan`, giữ tham số cũ; trong "Cần làm" có lọc Chờ xác nhận / Cần gửi / Chờ tiền CK), dòng hành trình, ô thêm món bằng chữ
  (`POST /api/don/:id/them-theo-chu` dùng chung `timMon` với AI rồi `don.themMon`), phí ship ô tiền, một nút chính + menu ⋯ (Hủy có ô lý do).
- **F-124** Sản phẩm 5 tab (chấm vàng = còn thiếu), lưới tồn có màu bấm để Nhập thêm / Điều chỉnh (API kho có sẵn, ghi lịch sử kho), sửa nhãn ảnh chồng nút.
- **F-125** `so-sanh.js` (dãy con chung dài nhất tự viết): Sổ tay xem bản = so với bản trước; "Nói với Mai" hiện việc "cũ → mới" thành bảng hai cột.

**Quyết định khi chủ dự án vắng — GD1** (28/10/2026; chủ dự án giao làm hết qua đêm, không hỏi lại — muốn đổi thì nói):
1. **Tỷ giá mặc định 26.000** (theo `docs/11` và phiếu), không để trống như câu F-121 trong mục 3 — để chủ dự án khỏi phải nhập; sửa được ở Cài đặt → Phần mềm.
2. **"Dừng mọi tự động" = "Dừng AI" (F-72)**, không phải "Dừng mọi thứ": AI ngừng, chốt đơn bằng quy tắc vẫn chạy; công tắc "Dừng mọi thứ" vẫn ở thanh trên.
3. **Bảng "AI & kênh" theo từng việc AI (agent) với Bật / Tắt**, chưa có chế độ Thật / Diễn tập / Tắt từng kênh và trần chi phí riêng từng dòng (hệ thống chỉ có một trần chung — hiện ở đầu bảng).
4. **Việc chờ duyệt đã quá hạn vẫn bấm Duyệt được** (người chủ động bấm), chỉ thôi đếm; hạn chỉ áp cho việc do "Dừng mọi thứ" / giới hạn tin, không áp cho luật quyền "Hỏi".
5. **Phần ẩn được** chỉ gồm các phần thật sự ẩn được ở giao diện hôm nay: Đội AI & Radio, Lịch live, Ảnh khách mặc thật, Khách hàng, Sổ tay, Báo cáo (MOZA nhìn, Bình chọn bỏ khỏi danh sách vì chưa có khối riêng để ẩn).
6. **Mức Gấp / Sắp hết / Nên làm** của "Việc cần làm" lấy theo màu có sẵn của từng việc (đỏ / vàng / xanh dương), không đổi nghiệp vụ. *(Đầu BH11 đổi tên mức
   giữa thành **"Cần chú ý"** — "Sắp hết" trùng nghĩa với dòng hàng sắp hết.)*
7. Menu thu còn biểu tượng ở **Màn hình người dẫn** (không ẩn hẳn) để vẫn có đường thoát; bố cục màn đó giữ nguyên cho BH11.
8. "Chờ tiền CK" giữ ở bộ lọc nhỏ trong "Cần làm" nhưng vẫn lọc cả đơn đã gửi chưa nhận tiền như cũ.
9. Đường dẫn cũ `#/don?trang_thai=…` chuyển tới tab chứa trạng thái đó; mở thẳng một đơn (`&id=`) tự chuyển tới tab của đơn.
10. `confirm` / `prompt` chỉ đổi sang `hoi()` ở các màn làm lại (Đơn hàng, Sản phẩm, Livestream kết thúc phiên, Cài đặt → AI & kênh); các chỗ khác để lần sau.

**Việc còn dở của GD1:** chưa chụp ảnh các màn khi có dữ liệu thật (chỉ dữ liệu xem thử); phép thử đọc từ 2 m cho Màn hình người dẫn thuộc BH11; `confirm` còn ở các màn không làm lại.

**Kết quả BH11 — Mai thông minh hơn** (28/10/2026, Claude Code, theo `docs/phieu-bh11.md`; tag `bh11-mai-thong-minh`, tag trước mốc `truoc-bh11`):
- `npm test`: **791 / 791 đạt** (768 cũ + 23 mới: `bh11-quyet-dinh`, `bh11-huan-luyen`, `bh11-cham-tra-loi`, `bh11-tong-giong`, `bh11-mai-quyet-dinh`, `bh11-giong-rieng`;
  `nhin-mon.test.js` sửa theo Decisions). Xem thử `moza-ai-gia`: Màn hình người dẫn sân khấu ở 1366 × 768 và 1920 × 1080 không thanh cuộn (dọc, ngang), bảng huấn
  luyện báo "2 câu hỏi chưa ai trả lời" sau ~80 giây kịch bản diễn tập, "Soạn trả lời" → câu trên thẻ → "Trả lời bình luận" đăng lên Facebook giả, bình luận chuyển
  "Đã trả lời", cảnh báo tự ẩn; Mai nói cùng (miệng giả) đọc "áo số 15" → thẻ đổi sau 0,6 giây; không lỗi JS. Ảnh ở `data/tam-test/ui-bh11/` (chỉ trên máy).
- Sửa nhỏ còn sót của GD1 (commit riêng): trang Hôm nay đổi tên mức việc "Sắp hết" → **"Cần chú ý"** (Gấp / Cần chú ý / Nên làm).
- **3.3** `nha-cung-cap/openai.js` `quyetDinh` (`client.decisions.create`), `doiCauHoi` dùng chung cho `session.triggers`; Decisions giả (`gia-mau.quyetDinh`, đặt sẵn / `_dapAn`);
  `server/agent/quyet-dinh.js` giữ "Dừng mọi thứ" / "Dừng AI" / agent tắt, ghi `agent_run` (chi phí chỉ token vào).
- **F-116** nâng cấp **024** (`so_lieu_phut`, `binh_luan_live.tra_loi_luc`); `nghiep-vu/so-lieu-phut.js` (ghi theo phút, câu hỏi chưa trả lời, lần nhắc chốt cuối, khách cũ);
  `server/huan-luyen.js` 20 giây / lần, 4 cảnh báo theo thứ tự, ≤ 1 / 2 phút, Đội AI chỉ số; ws `live.huan_luyen`; `GET /live/phien/:id/huan-luyen`; phòng live ghi
  người xem theo phút; kịch bản diễn tập mới "Người xem tụt" (bước `nguoi_xem`), "3 câu size chưa trả lời"; biểu đồ SVG tự vẽ `nd-huan-luyen.js`.
- **F-115** `POST /live/phien/:id/tra-loi-binh-luan` → `phongAi.traLoiBinhLuan`: hỏi size có số đo → `tu-van-size.soanCau` (bằng mã, chạy cả khi Dừng AI); còn lại Co-host
  đúng bình luận đó (1–2 câu, `prompt_cache_options: {ttl: '12h'}` qua `chayAgent({luuDem})`), Bộ kiểm tra, thẻ `live.goi_y` kèm `binh_luan_id`; bị chặn 2 lần → "Mai chưa chắc"
  + dữ liệu liên quan; nút [Mai nói] (`/goi-y/:id/mai-noi`), [Tự đọc] (`/binh-luan/:id/da-tra-loi`), [Trả lời bình luận] (`/binh-luan/:id/dang-tra-loi` qua công cụ
  `tra_loi_binh_luan`, đủ hook + giới hạn liên hệ + chống gửi trùng), [Bỏ].
- **F-126** `nguoi-dan.js` (806 dòng) tách: `nd-thanh.js` (thanh mảnh: giờ, đèn Facebook / OBS / AI / mạng, xem · chốt · xác nhận, chế độ, micro, **một** nút Dừng AI, menu ⋯:
  ngăn kéo, toàn màn hình, chép lời mời, "Dừng mọi thứ", rời màn hình), `nd-mon.js` (vùng 1 món + lưới tồn chữ to, vùng 3 Tiếp theo ←/→), `nd-goi-y.js` (vùng 2 thẻ gợi ý),
  `nd-ben-phai.js` (cảnh báo, biểu đồ, Vừa chốt kèm nhãn từng hoàn, bình luận lọc Muốn mua / Hỏi / Khách cũ / Tất cả — chạm để Mai soạn); `css/nd-san-khau.css` (ẩn menu
  + thanh trên khi đang live, lưới cố định); ngăn kéo (phím N; "/" = Hỏi Mai): lời nhắc đầy đủ, Hỏi Mai, tập, câu hỏi nổi bật, chờ tư vấn, chờ hàng, MOZA nhìn, Lên sóng;
  dải đỏ + tiếng chỉ cho nguy cấp (mất máy chủ > 3 giây, mất OBS sau khi đã nối, hết sạch món đang bán, Mai lỗi); giữ phím Cách / ←→ / Enter / 1 2 3. Cỡ chữ token
  `--nd-so-chinh` 80 px, trang thử `#/nguoi-dan?thu-co-chu` (64 / 80 / 96 px, nhớ trên máy). Lộ và sửa: khối món cũ gọi `tien()` mà không nạp.
- **F-127** `cau-hinh/tong-giong.json` (Đều, rõ ràng · MC vừa · MC sôi nổi · Ấm áp, tư vấn · Tự viết ≤ 400 ký tự) + `nghiep-vu/tong-giong.js`; ghép cuối lời dặn miệng;
  đổi giữa buổi: GPT-Live `session.instructions.append` (≤ 500 token), Gemini mở lại miệng; Đội AI dùng làm cách nói mặc định (`phong-thu.cachNoiCua`); Cài đặt → Giọng
  Mai + bước 2 "Bắt đầu live" chọn tông, "Nghe thử" ≤ 3 lần / phút (`/giong-mai/tong/nghe-thu`, máy đọc đọc câu mẫu); miệng giả giữ `giong`, `loiDan`, `loiDanThem`.
- **F-113** `agents/nhin-mon.js` hỏi bằng Decisions (bảng mẫu ảnh + `input_json`, khung camera, `choice` ≤ 10 món + `khong_ro`; chắc = confidence ≥ 0,8); giữ 2 lần liền, chỉ
  gợi ý, tắt mặc định, không lưu ảnh; cách cũ sau `nhin_mon.cach = "responses"`. **Thử thật 52 khung: 52/52 đúng, 0 chắc-mà-sai, trễ trung bình 2,1 giây, 0,000085 USD / lần**
  — cách cũ cũng 52/52 nhưng chậm hơn (3,0 giây detail low, 2,8 giây high) và đắt hơn (0,000096 / 0,000261 USD / lần) → giữ Decisions làm mặc định. MOZA nhìn vẫn tắt
  mặc định (bật theo buổi) như F-107.
- **F-112** `gpt-live.js` gửi `session.triggers` loại `decisions` trên `session.output_transcript.delta` (giữ `delegation: {type: 'client'}`), đọc `decision.event`;
  `mieng.nhanQuyetDinh`: chỉ Mai dẫn chính / Mai nói cùng, ≥ 0,8 **hai lần liền** mới đổi thẻ (đoạn kế có món đó), bảng size ≥ 0,85 và ≤ 1 lần / 30 giây mỗi món, bỏ kết quả
  cũ đến muộn, cộng chi phí token vào; cách đọc chữ `theoKipMai` giữ dự phòng; miệng giả mô phỏng `decision.event`. **Thử thật: chạy được** — GPT-Live nhận `triggers`
  cùng giao việc kiểu client, 24 kết quả trong 6 giây (mỗi mẩu chữ một lần, 100–400 ms một lần); "số 15" đạt ≥ 0,8 khoảng 2,4 giây sau khi Mai bắt đầu câu, các mẩu đầu dao
  động (0,42 → 0,85 → 0,96) nên thêm luật hai lần liền; câu có / không "mời xem bảng size" dao động mạnh → ngưỡng 0,85. Token vào Decisions ~1.600 / giây nói ≈ **+0,01 USD /
  phút** (GPT-Live 0,05 USD / phút).
- **F-114** `nghiep-vu/giong-rieng.js` (tạo `audio.voices.create({type: 'prompt'})`, giữ đang dùng + 3 gần nhất, chọn, xóa, công tắc **tắt**, nghe thử = phiên GPT-Live ngắn
  có bơm khoảng lặng), miệng GPT-Live gửi `audio.output.voice: {id}` + lặp mô tả trong lời dặn; Cài đặt → Giọng Mai (hỏi trước khi nghe thử tốn tiền). Phép thử: giọng nữ
  miền Bắc tả bằng lời → 17,6 giây tiếng ở `docs/nghe-bh11/giong-rieng.wav` (giọng thử đã xóa ở OpenAI). Chờ chủ dự án nghe.
- Công nghệ: không mở nhóm tra cứu (đã tra 28/10/2026, `docs/11` mục 1). Kiểm trong SDK `openai` 7.45.1 có sẵn: `decisions.create`, `audio.voices.create/delete`, Live
  `triggers` (`DecisionTrigger`), `decision.event`, `session.instructions.append`, `CustomVoice {id}`, Responses `prompt_cache_options`. T6 (hai trang tài liệu nói ngược
  nhau) — phép thử cho thấy `delegation.type: 'client'` + `session.triggers` chạy được cùng nhau.

**Quyết định khi chủ dự án vắng — BH11** (28/10/2026; chủ dự án giao làm hết qua đêm, không hỏi lại — muốn đổi thì nói):
1. **Cỡ chữ Màn hình người dẫn mặc định 80 px** (mức giữa); trang thử 64 / 80 / 96 px lưu lựa chọn trên máy (laptop của shop) — chờ chủ dự án chọn ở 2 m rồi ghi vào token.
2. **F-112 bật** (`mai_quyet_dinh.bat = true`) vì phép thử chạy được và nhanh hơn cách đọc chữ (cách cũ cần Mai nói thêm ≥ 150 chữ sau tên món); thêm luật **hai lần liền ≥ 0,8**
   và bảng size **≥ 0,85, 1 lần / 30 giây / món** vì kết quả dao động theo từng mẩu chữ. Chỉ Mai dẫn chính / Mai nói cùng; "Chỉ gợi ý" không bao giờ tự chuyển. Tốn thêm
   ~0,01 USD / phút GPT-Live. Không cập nhật câu hỏi bằng `session.update` khi đổi đoạn: danh sách gồm mọi món của kịch bản ngay từ lúc mở (Decisions nhận tới 255 lựa chọn).
3. **F-114 tắt** tới khi chủ dự án nghe (phiếu); giọng lưu ở khóa cài đặt riêng `giong_rieng` (không đổi kiểu `mieng.giong.openai` đang là tên giọng có sẵn).
4. **[Mai nói] ở chế độ "Chỉ gợi ý"**: chưa có tiếng Mai trên sóng (giống F-109 ở BH10) → báo "anh/chị tự đọc"; Mai nói cùng / dẫn chính thì `noiNguyenVan`, Đội AI thì đội đọc.
5. **Tông giọng là một cài đặt chung** (Cài đặt và bước 2 "Bắt đầu live" sửa cùng một chỗ) — một shop, một laptop; mặc định "MC vừa".
6. **"Dừng AI" của F-115** = phiên tắt AI, "Dừng mọi thứ" hoặc "Dừng AI" chạm trần: chỉ bình luận có số đo (hỏi size) còn chạm được; nút Dừng AI trên thanh (phím cách) vẫn
   là dừng lượt đang làm như cũ.
7. **Câu hỏi coi là đã trả lời** (F-116) khi: Co-host / tư vấn size đã xử lý, người dẫn bấm Tự đọc / đăng trả lời, hoặc lời Mai / Đội AI / người dẫn sau câu hỏi nhắc đúng số
   món của đoạn đó. Người xem tụt chỉ báo khi đỉnh 3 phút ≥ 5 người (tránh báo 3 → 2). Nhắc chốt nhận "chốt", "giá", "cú pháp", số tiền "…k / nghìn / triệu".
8. **Bình luận "Khách cũ"** = người bình luận đã có đơn chưa hủy ở buổi khác (hoặc qua tin nhắn) — chỉ người dẫn thấy, không nói trên sóng.
9. **AI giả của bản xem thử** trả một câu Co-host mẫu không có số ("câu mẫu của AI giả") để thấy chạm ra câu; trước đây trả câu rỗng.
10. **So cách cũ của MOZA nhìn** chạy thêm trên cùng 52 khung (trong trần) để có số so tốc độ, chi phí như `docs/11` 6.5 yêu cầu.

**Việc còn dở của BH11:** chủ dự án chọn cỡ chữ ở 2 m và nghe giọng riêng (việc 4c); F-112 mới thử 1 lần 6 giây — cần xem trong buổi tập thật có đổi thẻ nhầm không
(tắt bằng `mai_quyet_dinh.bat`); "Mai nói" ở Chỉ gợi ý chưa có tiếng (chờ quyết định có cho máy đọc phát ra loa không); bình luận lọc "Muốn mua" dựa trên nhãn có sẵn
(chốt, ib, lưỡng lự) — chưa có nhãn "hỏi mua" riêng; không làm BH12, Zalo.

**Kết quả BH12 — Kịch bản buổi sau** (28/10/2026, Claude Code, theo `docs/phieu-bh12.md`; tag `bh12-kich-ban-buoi-sau`, tag trước mốc `truoc-bh12`; 0 USD):
- `npm test` **797 đạt, 0 lỗi** (thêm `test/bh12-kich-ban-buoi-sau.test.js`, 6 test). Không có tệp nâng cấp dữ liệu (dùng bảng `so_lieu_phut` của 024). Công nghệ: không tra lại (đã tra 28/10/2026, `docs/11` mục 1);
  không dùng API mới — agent `soan_kich_ban` (`gpt-6-luna`) có sẵn.
- **Sửa nhỏ còn sót của BH11** (commit riêng): Màn hình người dẫn sân khấu ở 1366 × 768 — tên món bị dãy ô còn hàng đè. Nguyên nhân: khối món là cột flex, ô tên có `overflow:hidden` nên bị ép co. Sửa: tên món và dòng số–giá không co,
  dãy ô tồn lấy phần còn lại; mức "nhiều" (7–12 ô) nhỏ lại để vừa vùng (đo `scrollHeight = clientHeight` ở cả 1366 × 768 và 1920 × 1080). Ảnh: `docs/anh-bh12/san-khau-ten-mon-1366.jpg`.
- **Bước 1 — `tong-ket-phien.js` `bangDoan(phienId)`** (F-117): mỗi đoạn món (từ `dong_thoi_gian_san_pham`): món, giây bắt đầu – kết thúc (cùng gốc giờ với mốc F-103), số phút, người xem đầu / cuối (đầu và cuối của các phút
  có số trong đoạn; cần ≥ 2 phút có số), người chốt (người khác nhau), câu hỏi; `ra_don` = người chốt > 0 và ≥ trung bình các đoạn; `bo_di` = người xem tụt ≥ 20 % từ đầu đến cuối đoạn. Chỉ khi buổi có ≥ 10 phút số liệu
  (`du_so_lieu: false` nếu thiếu). `soLieuDoanChoAi` dựng chữ gửi AI: chỉ số và "số, tên món" (không tên người, số điện thoại, bình luận).
- **Bước 2 — `server/agent/agents/de-xuat-kich-ban.js` + `POST /live/phien/:id/de-xuat-kich-ban {mon_se_ban?}`**: agent `soan_kich_ban`, lược đồ riêng (`ten`, `thu_tu[{so, so_phut, ly_do}]`, `loi_mo{viec, vi_sao}`). Kiểm bằng mã:
  món lạ hoặc lặp bị bỏ; số phút chỉ được chọn trong các số phút của buổi trước, ngoài đó thì để trống; `ly_do` / lời mở có con số không có trong số liệu (luật `loiSo` — tách ra từ `tong_ket`, chặt cả số 0–10) hoặc trái luật
  (khan hiếm giả, giảm giá giả, vùng miền, giới tính) thì bỏ phần chữ đó; món AI quên được xếp cuối — không mất món nào. Trả về `bo` = số phần đã bỏ. Nháp **không tự lưu**. AI giả (`gia-mau.js`) trả nháp mẫu đủ món.
  `GET /bao-cao/phien/:id/tong-ket` thêm `bang_doan`.
- **Bước 3 — Báo cáo → buổi → Tổng kết** (`bao-cao.js` `veBangDoan`): mục "Từng đoạn của buổi" (bảng + chip "Ra đơn" / "Người xem bỏ đi"), nút **✨ Mai đề xuất kịch bản buổi sau** → nháp sửa được (↑ ↓ đổi thứ tự, ô số phút, chỗ đổi lời mở,
  tên kịch bản) → **Lưu thành kịch bản** (`POST /kich-ban`: đoạn đầu là lời mở, mỗi món một đoạn "Khoảng N phút" + lý do, đoạn kết) → xuất hiện ở ô kịch bản của Phòng diễn tập / Bắt đầu live.
- **Bước 4 — test:** số liệu đoạn khớp đếm tay (người xem đầu / cuối, chốt, câu hỏi, ra đơn, bỏ đi, giây); dưới 10 phút → không dựng, không gọi AI; AI nêu số lạ / trái luật / món lạ / món lặp → bỏ, món quên xếp cuối;
  dữ liệu gửi AI không chứa tên, số điện thoại, bình luận; AI giả qua được bước kiểm; API đề xuất → lưu → liệt kê.
- **Bước 5 — bản xem thử `moza-ai-gia`** (1366 × 768): buổi tập (đã gieo 30 phút số liệu và 3 đoạn món vì buổi tập thật chỉ dài vài phút) → Tổng kết → bảng đoạn → nháp → Lưu → có trong ô kịch bản Phòng diễn tập
  ("Buổi sau (AI giả) · 5 đoạn"). Ảnh: `docs/anh-bh12/tong-ket-de-xuat-1366.jpg`, `chon-o-buoi-tap-ke-1366.jpg`. Đã `preview_stop`, không chạy cổng 5173.
- **Chưa kiểm:** model thật (`gpt-6-luna`) viết nháp có hay không — chưa chạy (chưa có khóa; một lần đề xuất ước < 0,001 USD, chạy khi chủ dự án dán khóa). Số người xem theo phút chỉ có khi nối Facebook thật
  (`live_views`); buổi tập với Facebook giả không có số người xem nên "bỏ đi" không đánh dấu.

**Quyết định khi chủ dự án vắng — BH12** (28/10/2026; chủ dự án giao làm hết qua đêm, không hỏi lại — muốn đổi thì nói):
1. **Nháp là bản phác, không phải kịch bản đầy đủ:** chỉ thứ tự món, số phút, lý do, một chỗ đổi lời mở; lưu thành kịch bản với lời nhắc ngắn cho người dẫn (không có câu "Mai:" soạn sẵn). Lý do: đúng phiếu, rẻ, không để AI bịa lời bán hàng
   từ số liệu; muốn kịch bản đủ lời thì bấm "AI soạn kịch bản" như cũ rồi chép ý từ nháp.
2. **Dùng `soan_kich_ban` với lược đồ riêng** thay vì mở rộng `soanKichBan` (500 dòng, kiểm cú pháp chốt, "nhé", số còn): hai việc khác nhau, tránh làm hỏng việc đã chạy.
3. **Số phút chỉ chọn trong các số phút buổi trước** (thay vì cho AI tự đề xuất số mới): bảo đảm luật "mọi con số có trong đầu vào"; chấp nhận chặn cả con số hợp lý nhưng chưa từng xuất hiện (người sửa tay được).
4. **Bỏ phần sai, không bỏ cả nháp**: số phút lạ → để trống; lý do có số lạ → bỏ chữ; không để người dùng mất món. Luật "không sắp lại kịch bản" của `tong_ket` không áp dụng ở đây (đây chính là việc cần làm); vẫn cấm khan hiếm giả, giảm giá giả, vùng miền, giới tính.
5. **Ra đơn** = người chốt từ mức trung bình các đoạn món trở lên (và > 0); **bỏ đi** = tụt từ 20 % đầu → cuối đoạn (không dùng đỉnh), cần ≥ 2 phút có số người xem.
6. **Món sẽ bán buổi sau** mặc định = các món buổi này đã bán còn Đang bán; API nhận `mon_se_ban` (danh sách số) nhưng giao diện chưa có ô chọn (ít ô nhập) — thêm khi chủ dự án cần.
7. **`npm test` chạy song song quá nhiều tệp (mặc định của Node) làm hàng loạt tệp sập cùng lúc trên laptop này** (không phải lỗi mã: từng tệp chạy riêng đều đạt); dùng `node --test --test-concurrency=3 test/`; **từ 28/10/2026 `npm test` đã đặt sẵn `--test-concurrency=4`** (phiên điều phối chạy 3 lần liền 797/797 đạt). `doi-ai-nhac.test.js` có lần sập khi máy tải nặng, chạy riêng đạt.

**Sổ chi phí đợt 3.10 + 3.11 — tổng kết:** BH12 0 USD. **Cộng dồn thử thật cả đợt: OpenAI 0,0920 USD** (trần 0,50), **ElevenLabs 0 USD** (chưa có khóa — mô phỏng).

**Việc chủ dự án cần làm — sau đợt BH10 → BH12** (gộp từ BH10, GD1, BH11, BH12; không lặp; không chặn gì; Claude Code viết hướng dẫn từng bước khi tới lúc):
1. **Xem và góp ý giao diện mới** (GD1) bằng ảnh `docs/anh-bh12/` và mở bản xem thử; duyệt các mục "Quyết định khi chủ dự án vắng" của BH10, GD1, BH11, BH12.
2. **Máy đọc (BH10):** nghe 5 tệp `docs/nghe-bh10/01-marin.wav` … `05-coral.wav` và cho biết giọng có tự nhiên không; tạo tài khoản ElevenLabs, dán khóa ở Cài đặt → Khóa AI (không dán vào chat), báo Claude Code chạy phép thử
   (~0,10 USD) rồi chọn giọng tiếng Việt ở Cài đặt → Đội AI dẫn → Giọng ElevenLabs.
3. **Facebook:** tắt trợ lý AI của Facebook (Business AI) cho Page bán hàng trong Meta Business Suite rồi tích ô "Đã tắt trợ lý AI của Facebook" ở bảng Sẵn sàng lên sóng (nhớ 7 ngày).
4. **Màn hình người dẫn (BH11):** đứng cách laptop 2 m mở `#/nguoi-dan?thu-co-chu` (hoặc nút "Thử cỡ chữ" khi chưa live), chọn 64 / 80 / 96 px đọc rõ nhất, bấm "Dùng cỡ này" (mặc định 80 px).
5. **Giọng riêng của Mai (BH11, đang TẮT):** nghe `docs/nghe-bh11/giong-rieng.wav`; tự nhiên thì vào Cài đặt → Giọng Mai → "Giọng riêng của Mai trên sóng", tạo giọng, nghe thử, bật; không đạt thì để tắt.
6. **Tông giọng Mai và F-112:** chọn tông (mặc định "MC vừa"); "Mai tự đổi thẻ món trong lúc nói" đang BẬT (~0,01 USD mỗi phút GPT-Live) — theo dõi trong buổi tập thật có đổi thẻ nhầm không; muốn tắt thì báo Claude Code.
7. **Facebook thật (Bước 0) và tài khoản:** Page bán hàng, ứng dụng Meta riêng (không dùng lại của Page tuyển dụng), cài `cloudflared`, tài khoản Facebook thứ hai làm "Người thử"; xin quyền nhắn tin (mất 2–4 tuần — nộp sớm),
   xác minh doanh nghiệp, xác thực danh tính người livestream; khóa API riêng của shop (Cài đặt → Khóa AI); ảnh 3–5 sản phẩm thật kèm giá, cỡ, số lượng, bảng size để thử "Tạo từ ảnh".
8. **BH12 (mới):** sau một buổi live thật ≥ 10 phút nối Facebook thật, mở Báo cáo → buổi đó → Tổng kết → xem bảng đoạn → bấm "Mai đề xuất kịch bản buổi sau" → sửa → Lưu thành kịch bản → chọn khi bắt đầu buổi sau;
   cho biết nháp có dùng được không (lần đầu chạy với model thật khi đã có khóa OpenAI).
9. **Luật sư / chuyên gia (#127, để sau, không chặn mốc):** quảng cáo, giọng AI và nhãn nội dung AI, dữ liệu khách hàng, nhắn riêng theo luật Meta; nhờ xem trước khi ra mắt thật.
10. **BH13 Zalo cá nhân đang hoãn** (#153): nếu làm lại cần số Zalo phụ, tài khoản Cloudflare, quyết định có mua tên miền; khi làm lại không qua mozaai.vn.

## 13. Rủi ro và câu hỏi mở

| Rủi ro | Mức | Cách giảm |
| --- | --- | --- |
| Facebook không cho nhắn riêng bình luận **live** (tài liệu Meta chỉ nói bài đăng, Reels; trang tài liệu `private_replies` lỗi khi tra 25/9/2026) → luồng chốt đơn mất bước chính | Cao | Cổng Facebook thật chạy sớm (#69); phương án B: bình luận công khai gom tên mời nhắn tin cho Page (#65); Mai nhắc trên sóng "nhắn tin cho shop để giữ hàng" |
| Tin nhắn riêng rơi vào "tin nhắn chờ" của khách, khách không thấy → đơn treo, hết giờ giữ tự hủy | Trung bình | Mai / Đội AI nhắc trên sóng mở tin nhắn chờ; giờ giữ sửa được; báo cáo tỷ lệ đơn quá giờ giữ để chỉnh |
| Bán quá số hàng khi nhiều người chốt cùng lúc | Cao | Giữ hàng trong giao dịch SQLite, một hàm duy nhất (`kho.giu`); test song song |
| Nhận sai bình luận chốt (màu viết lạ, "chốt rồi chưa shop?") → giữ nhầm hoặc bỏ sót | Trung bình | Bộ ≥ 60 câu mẫu; bảng tên gọi khác sửa được; mơ hồ thì không giữ, hỏi lại trong tin nhắn; người dùng sửa, hủy đơn được |
| Tồn kho trong MOZA lệch thực tế (bán ngoài live, hàng lỗi, đếm nhầm) | Trung bình | Điều chỉnh tay có lịch sử; khi thêm sàn khác phải đồng bộ tồn (F-61) |
| Miệng Live nói sai giá hoặc số còn (bản đầu không so lại tiếng, SPEC-TD #30) | Cao | Mặc định "Chỉ gợi ý"; dữ liệu đưa thẳng + cập nhật tồn giữa buổi; lời dặn "không nói số còn nếu không chắc"; DỪNG AI; sau khi xong cân nhắc so lại tiếng (SPEC-TD A.5) |
| AI hứa giảm giá, quà, miễn ship khi khách mặc cả | Trung bình | Bộ kiểm tra chặn số tiền không có trong nguồn; lời dặn và Skill "không tự giảm"; mặc cả dai → Cần người |
| Bom hàng COD | Trung bình | #73; báo cáo tỷ lệ hoàn; chủ dự án tự gọi xác nhận |
| Pháp lý bán hàng livestream (Luật TMĐT 2025 hiệu lực 1/7/2026, bảo vệ người tiêu dùng, dữ liệu cá nhân, giọng AI) — làm mức vừa đủ theo #71 | Trung bình | Luật AI trong code và lời dặn (mục 9); nhờ người có chuyên môn xem trước live thật với khách lạ |
| Dùng chung khóa Google với bản tuyển dụng và AI Coaching tới 26/9/2026 (100 lượt đọc giọng/ngày mỗi máy đọc) | Thấp | Chủ dự án đổi khóa (#67); không chạy bản tuyển dụng và bản bán hàng cùng lúc |
| Dọn mã tuyển dụng sót chữ hoặc sót đường dẫn cũ → AI nói "nhà máy", "ứng tuyển" | Thấp | Test rà chữ (mục 11); lời dặn và Skill mẫu thay toàn bộ, không dùng cơ chế "tự nâng mẫu cũ" cho lần đổi này |
| Đổi cấu trúc lớn làm vỡ phần live, Đội AI đang chạy tốt | Trung bình | BH1 giữ phần mềm chạy trọn sau mỗi bước; 346 test cũ đổi theo dữ liệu mới chứ không xóa; tag `diem-xuat-phat-ban-hang` để quay lại |
| AI đọc ảnh điền sai (chất liệu, đối tượng, màu) → AI tư vấn sai | Trung bình | Nhãn "AI đoán" tới khi người lưu; thẻ sản phẩm ghi "(chưa xác nhận)", AI không khẳng định; AI không đoán giá, xuất xứ, thương hiệu |
| Sản phẩm đầy đủ nhiều ô → người dùng ngại nhập | Trung bình | Chỉ 7 ô bắt buộc; AI điền trước phần còn lại; bảng size dùng chung; Nhân bản; nhập kho bằng lời |
| "Nói với Mai" hiểu sai lệnh nhập kho | Trung bình | Luôn có bảng xem trước + nút "Làm"; câu mơ hồ thì hỏi lại; lịch sử kho ghi "qua Mai", điều chỉnh lại được |
| Gemini 3.8 Live đổi cách chạy so với Gemini Live thế hệ trước (lệnh hết lượt cắt lời, bỏ affective dialog) làm Mai bị ngắt giữa câu | Thấp | #81 + test; buổi tập lại ở BH1 |
| Công nghệ đổi nhanh (model mới ra hằng tuần) → đặc tả lỗi thời | Trung bình | Tra lại đầu mỗi mốc (mục 12); model đổi được trong Cài đặt không cần sửa mã |
| Rủi ro máy móc giữ từ bản tuyển dụng (Gemini quá tải 503, hạn mức TTS, Quick Tunnel rớt, webhook lỗi 1 giờ bị hủy đăng ký, App Review, miệng không có lệnh dừng câu…) | — | Như SPEC-TD mục 13 |
| Facebook giả khác Facebook thật (nhắn riêng bình luận live, Tin nhắn chờ, ảnh thẻ, tin thứ hai, mã lỗi) | Cao | Một Meta giả dùng chung bộ đọc và bộ dựng tin thật; bảng hành vi có nguồn và mức kiểm chứng; mặc định trường hợp xấu, test cả hai nhánh; Bước 0; kiểm lại ở buổi live thật đầu tiên |
| Ứng dụng Meta chưa được duyệt → MOZA không nhắn được khách thật nào | Cao | Chủ dự án nộp một lần xét duyệt sớm; bảng Sẵn sàng báo đỏ `FB_CHUA_DUYET` |
| Ảnh thẻ qua đường hầm chết khi tắt máy; mở đường ảnh công khai | Trung bình | Chỉ ảnh sản phẩm Đang bán, tên băm; lùi ảnh đã tải lên hoặc thẻ chữ; Bước 0 kiểm Meta có lưu ảnh lúc gửi |
| Bắt nhầm "thôi", "dừng" → mất tin nhắc của khách đang muốn mua | Trung bình | Chỉ câu ngắn; bộ câu dễ nhầm trong test; khách nhắn lại vẫn được trả lời |
| Nhắc, gọi tên, nhắn bù dồn → Page bị báo spam, bị khóa | Trung bình | Hook giới hạn liên hệ; câu trung tính, ẩn tên; nhắn bù rải dần, người bấm |
| Meta xếp mẫu Utility có nút vào loại Tiếp thị; chưa chắc Utility miễn phí | Trung bình | Chỉ dùng mẫu UTILITY, lùi về trong 24 giờ hoặc việc gọi; theo dõi phí |
| Đụng tiền thật: số tiền QR, giá live, hạ giá khi Mai nói nhầm, gộp đơn | Cao | Một hàm "giá bán lúc này"; test bảng và chuỗi ngẫu nhiên đối chiếu kho; người tự bấm "Đã nhận tiền"; thử 1.000đ; kế toán / người rành thanh toán xem trước (#127) |
| Thêm dữ liệu cá nhân: nhật ký 90 ngày, số đo, ảnh khách, bản ghi đồng ý, khung hình gửi OpenAI | Trung bình | Chỉ chữ, có hạn xóa; số đo và ảnh khách tắt mặc định, cần đồng ý; không lưu khung hình; chuyên gia xem (#127); ghi vào chính sách quyền riêng tư |
| Đính chính nhầm trên sóng do chép lời nghe sai số | Trung bình | Chỉ tự đính chính khi chắc; 3 lỗi thì về Chỉ gợi ý; phép thử trước khi dùng thật |
| Câu chen tăng (nhắc, size, cảm ơn, bình chọn) → hết lượt giọng Google giữa buổi | Trung bình | Trần 60 câu/buổi; câu ưu tiên từ 80%; chạm trần thì hiện chữ |
| Vượt ngân sách thử AI | Thấp | Mặc định AI giả, `--ai-gia`; báo trước; trần mỗi phép thử; dừng ở 0,80 USD OpenAI |
| Giá Gemini gấp đôi từ 1/1/2027 làm mức trần tính thiếu | Thấp | Bảng giá theo ngày (F-67) |
| Thanh chữ quá nhiều dòng, đè nhau | Thấp | Bố cục chốt ở F-75; ảnh chụp 1920×1080 mỗi mốc |
| Chép lời nghe nhầm số (nhất là Gemini) → Mai đính chính nhầm trên sóng (F-105) | Trung bình | Chỉ đính chính mức "chắc" (món nói rõ); 62 câu mẫu; phép thử thật trước khi dùng; hook tắt được; lần 2 / 3 lỗi → "Chỉ gợi ý"; mặc định vẫn "Chỉ gợi ý" |
| Hạ giá nhầm đơn khi Mai nói nhầm (F-106) — đụng tiền | Trung bình | Chỉ hạ, chỉ dòng món bị nói sai, chỉ trong khoảng, đơn đã gửi không đổi, lịch sử + "Giữ giá đúng", test bất biến tổng tiền |
| MOZA nhìn gợi ý nhầm món giống nhau khác màu; khung hình có mặt người gửi ra nước ngoài (F-107) | Trung bình | Chỉ gợi ý, 2 lần liền, người bấm mới chuyển; tắt mặc định; không lưu ảnh, không nhận diện mặt; giấy đồng ý + luật sư trước bước B |
| Các mục "Để sau" của đợt 3.4 mở lại quá sớm / quá muộn | Thấp | Điều kiện mở lại đo được ở mục 3 "Để sau" (30 đơn/ngày, 20 đơn CK/ngày…) — chủ dự án đổi được |
| Việc luật sư, chuyên gia để sau (#127) → live thật khi chưa rà pháp lý | Trung bình | Tính năng nhạy cảm tắt mặc định; danh sách "Để sau: luật sư, chuyên gia" ở mục 12; nhắc lại trước buổi live thật đầu tiên |
| Máy đọc `gpt-4o-mini-tts` tắt 6/1/2027 → Đội AI, người dẫn giả câm (3.10) | Cao | F-108 làm đầu BH10; F-111 báo trước 30 ngày mọi model sắp tắt |
| Máy đọc mới `gpt-realtime-2.1-mini` là model hội thoại → đọc chệch câu, nói thêm (3.10) | Trung bình | Lời dặn đọc nguyên văn; so chữ chép tiếng ra với câu gốc, lệch số thì bỏ tiếng; ElevenLabs làm lựa chọn |
| GPT-Live / prompt-to-voice nói tiếng Việt chưa tự nhiên (bảng giọng không ghi tiếng Việt) | Trung bình | Phép thử nghe trước khi code F-114; không đạt thì không làm |
| Meta Business AI bật cùng MOZA → hai AI cùng trả lời, Business AI báo sai tồn / giá | Trung bình | F-110 dòng kiểm trên bảng Sẵn sàng; việc chủ dự án đợt 3.10 số 4 |
| Chạm để trả lời / cảnh báo huấn luyện làm người dẫn rối giữa live | Thấp | Tối đa 1 cảnh báo / 2 phút, một câu mỗi lần chạm; tắt được |
| Kịch bản buổi sau dựa trên quá ít số liệu → gợi ý lệch | Thấp | Chỉ khi ≥ 10 phút số liệu; người duyệt; con số phải có trong đầu vào |
| GD1 đổi nhiều màn hình cùng lúc → vỡ thao tác quen, sót tính năng cũ (3.11) | Trung bình | Không đổi nghiệp vụ / API; test giữ nguyên; ảnh chụp từng màn cho chủ dự án duyệt; tag trước GD1 để quay lại |
| Cổng MCP mở ra internet bị dò, lạm dụng (3.11) | Trung bình | Khóa Bearer thu hồi được, giới hạn lượt, chỉ công cụ khách, không đọc dữ liệu khách khác; test chặn mọi đường khác |
| Trợ lý Zalo (AI của mozaai.vn) nói sai giá / hứa bừa — Bộ kiểm tra MOZA không kiểm được (3.11) | Trung bình | Câu giá / còn / tổng soạn sẵn, skill đọc nguyên văn; đơn Zalo luôn Chờ xác nhận, chủ shop bấm |
| Tài khoản Zalo cá nhân bị hạn chế (không có cổng chính thức) (3.11) | Trung bình | Số Zalo phụ; chỉ trả lời người nhắn tới; không nhắn hàng loạt |
| Dữ liệu khách đi qua mozaai.vn và nhà cung cấp AI của họ (3.11) | Trung bình | Ghi vào chính sách quyền riêng tư; luật sư xem (#127) trước khi dùng thật |
| Laptop tắt → trợ lý Zalo không tra được hàng (3.11) | Thấp | Skill: nhận lời nhắn, hẹn shop; bảng Sẵn sàng / Hôm nay báo đường hầm |

**Câu hỏi mở** (không chặn BH1):
1. Tên shop, số điện thoại, địa chỉ gửi hàng — chủ dự án điền trong Cài đặt khi có.
2. Hãng vận chuyển đang dùng — để chọn cột file xuất cho khớp, và cho F-60 sau này.
3. Có bán thêm loại hàng khác ngay sau quần áo không — ảnh hưởng tên thuộc tính mặc định.

**Cần kiểm chứng khi code** (thêm vào danh sách SPEC-TD mục 13). Từ bản 3.4: danh sách đầy đủ là bảng Bước 0 ở mục 11 và
`server/facebook/hanh-vi-meta.json` (H01–H24); ba dòng dưới giữ để tra lịch sử:
- [ ] `can_reply_privately` và nhắn riêng với bình luận live (Cổng Facebook thật dòng 1).
- [ ] Tin nhắn riêng tới người chưa từng nhắn Page vào hộp nào.
- [ ] Attachment Upload API cho ảnh (F-56) với Graph API v26.

---

## 14. Nguồn

- Luật Thương mại điện tử 2025, livestream bán hàng từ 1/7/2026 (tra 25/9/2026):
  [thuvienphapluat.vn](https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/chinh-sach-moi/107004/luat-thuong-mai-dien-tu-moi-nhat-va-trach-nhiem-cua-nguoi-livestream-ban-hang-tu-01-7-2026),
  [doanhnghiephoinhap.vn](https://doanhnghiephoinhap.vn/5-quy-dinh-moi-khong-the-bo-qua-khi-livestream-ban-hang-tu-172026-134275.html),
  [thuvienphapluat.vn — xác thực danh tính](https://thuvienphapluat.vn/phap-luat-doanh-nghiep/bai-viet/tu-01-7-2026-livestream-ban-hang-bat-buoc-phai-xac-thuc-danh-tinh-19844.html).
- Meta Private Replies: [Graph API /object/private_replies](https://developers.facebook.com/docs/graph-api/reference/object/private_replies/) (trang lỗi khi tra 25/9/2026 — kiểm lại ở Cổng Facebook thật).
- Model và nền tảng (tra 25/9/2026): [OpenAI Models](https://developers.openai.com/api/docs/models) ·
  [GPT-Live 1](https://developers.openai.com/api/docs/models/gpt-live-1) ·
  [So sánh GPT-Live / GPT-Realtime](https://www.leadlock.ai/blog/gpt-live-vs-gpt-realtime/) ·
  [Gemini Models](https://ai.google.dev/gemini-api/docs/models) · [Gemini changelog](https://ai.google.dev/gemini-api/docs/changelog) ·
  [Gemini 3.8 Live](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live) ·
  [Gemini 3.8 Live with Live Avatar](https://cloud.google.com/blog/products/ai-machine-learning/gemini-3-8-live-with-live-avatar-is-now-generally-available) ·
  [Giọng tự tạo chưa dùng được với 3.8 Live](https://discuss.ai.google.dev/t/gemini-3-8-live-support-for-voice-design-custom-voices/184651) ·
  [Claude Models](https://platform.claude.com/docs/en/about-claude/models/overview) ·
  [Meta Business Agent](https://developers.facebook.com/documentation/meta-business-agent/overview) ·
  [Meta công bố Business Agent](https://about.fb.com/news/2026/06/meta-business-agent/).
- Thiết kế agent: [Anthropic — Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) ·
  [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).
- Chuẩn thông tin sản phẩm (tra 25/9/2026): [Meta catalog — thông số sản phẩm](https://www.facebook.com/business/help/120325381656392) ·
  [Shopee — quy định đăng bán](https://help.shopee.vn/portal/4/article/77246) ·
  [Shopee — phân loại hàng](https://banhang.shopee.vn/edu/article/3528) ·
  [TikTok Shop — cân nặng theo SKU](https://seller-us.tiktok.com/university/essay?knowledge_id=6871882257123085&lang=en).
- Hai nguồn hình (tra 26/9/2026, #90): [OBS — tin phát hành](https://obsproject.com/blog) ·
  [obs-websocket](https://github.com/obsproject/obs-websocket) ·
  [Giao thức obs-websocket v5](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md) ·
  [OBS — Remote Control Guide](https://obsproject.com/kb/remote-control-guide) ·
  [OBS — Smartphone Camera Guide](https://obsproject.com/kb/smartphone-camera-guide) ·
  [Windows 11 — điện thoại Android làm camera](https://www.windowscentral.com/microsoft/windows-11/how-to-use-android-phone-as-webcam-on-windows-11) ·
  [DroidCam OBS](https://droidcam.app/).
- Mọi nguồn kỹ thuật khác (Node, SQLite, Meta Graph API, Cloudflare, luật dữ liệu cá nhân, luật AI): SPEC-TD mục 14.
- **Đợt cải tiến 3.4 (tra 27/9/2026)** — danh sách đầy đủ theo từng phát hiện ở cuối `docs/06-de-xuat-cai-tien-2026-09-27.md`. Chính:
  Meta — [Nhắn riêng từ bình luận](https://developers.facebook.com/documentation/business-messaging/messenger-platform/discovery/private-replies) ·
  [Send API](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages) ·
  [Utility](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/utility-messages) ·
  [Lưới ảnh](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/template/image-grid.md) ·
  [Marketing Messages FAQ](https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/faq.md) ·
  [Giới hạn gửi](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview/rate-limiting.md) ·
  [Calling](https://developers.facebook.com/documentation/business-messaging/messenger-platform/calling) ·
  [Live Video API — tương tác](https://developers.facebook.com/documentation/live-video-api/interact-with-viewers.md) ·
  [Video live lưu 30 ngày](https://about.fb.com/news/2025/02/updating-our-facebook-live-video-storage-policy/) ·
  [Chính sách Page](https://www.facebook.com/policies_center/pages_groups_events) ·
  [Live Shopping Tools](https://www.facebook.com/business/help/1737830097171282);
  Google — [Giá Gemini API](https://ai.google.dev/gemini-api/docs/pricing) · [Live API](https://ai.google.dev/gemini-api/docs/live-api/capabilities) ·
  [Changelog](https://ai.google.dev/gemini-api/docs/changelog);
  OpenAI — [gpt-6-luna](https://developers.openai.com/api/docs/models/gpt-6-luna) · [Changelog](https://developers.openai.com/api/docs/changelog);
  Việt Nam — [VietQR tạo mã nhanh](https://www.vietqr.io/en/danh-sach-api/link-tao-ma-nhanh/) · [payOS](https://payos.vn/cong-thanh-toan-mien-phi-2026/) ·
  [SePay bảng giá](https://sepay.vn/bang-gia.html) · [GHTK tạo đơn](https://api.ghtk.vn/docs/submit-order/submit-order-express/) ·
  [Q&Me live commerce 2026](https://qandme.net/en/report/vietnam-live-commerce-market-trends-and-buyer-behavior.html) ·
  [NĐ 142/2026 gắn nhãn AI](https://luatvietnam.vn/tin-van-ban-moi/2-truong-hop-noi-dung-do-ai-tao-ra-bat-buoc-phai-gan-nhan-tu-01-5-2026-186-108836-article.html) ·
  [Luật BVDLCN 2025 hiệu lực](https://baochinhphu.vn/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-tu-ngay-mai-1-1-2026-102251231155609721.htm).

---

## Phụ lục A — Tích hợp AI

Giữ SPEC-TD Phụ lục A (ranh giới ba lớp A.2, hook 8 cửa A.3, so lại tiếng A.5 để dành, tự kiểm A.8, nhật ký A.9, khả năng
nền tảng A.10, chi phí A.11, người và AI cùng sửa A.12). Khác:

### A.1 Vai trò

| Agent | Làm | Không được làm |
| --- | --- | --- |
| Director | Như cũ: điều phối phòng live, 5 quyết định. Bình luận chốt đã được mã xử lý, Director chỉ gắn nhãn (spam, xúc phạm, lời chúc…) | Nói trên sóng; gửi gì ra Facebook; sửa dữ liệu |
| Co-host | Soạn 1–3 câu trên sóng kèm trích dẫn từ **một** sản phẩm + tồn của nó + Sổ tay | Tự chọn sản phẩm; nói số còn không có trong dữ liệu |
| Miệng | Như cũ; dữ liệu đưa thẳng là sản phẩm trong phiên + tồn còn bán được + Sổ tay | Đọc số điện thoại, địa chỉ, tổng tiền đơn của ai |
| Tư vấn viên | Tư vấn sản phẩm, size, phối đồ; lên đơn, giữ hàng, xin thông tin giao, đọc lại đơn, xác nhận khi khách đồng ý; sửa, hủy theo lời khách; ghi bộ nhớ; tạo việc | Tự giảm giá, tặng quà, miễn ship; xác nhận khi khách chưa đồng ý; hủy khi khách chưa nói; đổi sang Đã gửi / Đã giao / Hoàn; nói "đã nhận tiền" |

Tất cả: không sửa sản phẩm, tồn kho, Sổ tay, Skill, luật; không xóa gì.

**Từ bản 3.4:** Director thêm nhãn `luong_lu` và giao Skill "Gỡ lưỡng lự" (F-84); Quản lý ("Nói với Mai") thêm `dat_ban_hang`,
`ghi_so_tay`, luôn "Hỏi" (#119). Agent mới: `soan_bai` (bài báo trước live, F-96), `tong_ket` (tổng kết sau live từ số liệu gộp,
F-102), `nhin_mon` (gợi ý món đang cầm, F-107) — cả ba `gpt-6-luna`, không gửi gì ra Facebook, không sửa dữ liệu. Mọi tin **do mã
soạn** (thẻ, nhắc, báo hủy, tin trạng thái, câu gom) đi qua công cụ nội bộ `gui_the_moza`, không Agent nào được cấp (#95).

### A.4 Bộ kiểm tra (bán hàng)

Áp dụng như cũ cho mọi câu AI đi ra ngoài. Đổi nguồn và thêm luật:

| # | Kiểm tra | Sai thì |
| --- | --- | --- |
| K1 | Mọi sản phẩm được nhắc (theo **số** "số 12", "áo 12", hoặc theo tên, gõ không dấu cũng nhận) đang `dang_ban` — đọc lại cơ sở dữ liệu lúc kiểm | Chặn |
| K2 | Mọi đoạn trích có nguyên văn trong **thẻ sản phẩm** của đúng bản sửa (mô tả, điểm nổi bật, thông số, hỏi đáp riêng, dòng bảng size), mục Sổ tay, hoặc **dòng dữ liệu MOZA tự sinh** ("Giá: 289.000đ", "Giá Đen/XXL: 319.000đ", "Còn bán được Đen/M: 3", "Size M: chiều cao 155–162 cm, cân nặng 48–55 kg", "Phí ship: 30.000đ", "Tổng tiền đơn DH-0042: 319.000đ"). Ô còn "AI đoán" không được trích làm sự thật | Chặn |
| K3 | Mọi con số **có đơn vị** (tiền, %, chiếc, cái, bộ, cm, kg, ngày, giờ…) bằng một con số trong các đoạn trích sau khi quy đổi (bảng quy đổi SPEC-TD A.4 giữ nguyên). **Ngoại lệ:** con số khách tự nói trong hội thoại này (chiều cao, cân nặng, số đo) được nhắc lại — trừ số tiền | Chặn |
| K4 | Trên sóng: chỉ nhắc sản phẩm trong phiên | Chặn |
| K5 | Trên sóng và công khai: không xin số điện thoại, địa chỉ | Chặn |
| K6 | Câu công khai không chứa số điện thoại, địa chỉ, họ tên đầy đủ của người khác | Chặn |
| K7, K8 | Như cũ (được phép nói; độ dài) | Giữ / Chặn |
| K9 | Số còn: câu nói "còn N" về một phân loại / sản phẩm phải bằng còn bán được **lúc kiểm**; câu "sắp hết", "chỉ còn", "cuối cùng" chỉ khi còn bán được ≤ ngưỡng sắp hết | Chặn |
| K10 | Tổng tiền, phí ship nói với khách phải bằng số của đơn đó lúc kiểm | Chặn |
| K11 (3.4, #107) | Từ cấm trong `server/cau-hinh/tu-cam.json`: thương hiệu ("dáng Zara", "auth", "rep 1:1"…), tuyệt đối ("tốt nhất", "rẻ nhất"; "số 1" trừ cách gọi món), so sánh ("rẻ hơn chỗ khác"…) luôn chặn; xuất xứ ("hàng xuất khẩu", "Quảng Châu loại 1"…), công dụng ("kháng khuẩn"…) chặn trừ khi cụm có nguyên văn ở ô đã xác nhận hoặc Sổ tay; "khách quen", "quay lại rồi" trên sóng; "chỉ hôm nay", "giờ vàng" (F-93). Áp cả câu mẫu, Skill, lời dặn mẫu | Chặn (lưu sản phẩm: chỉ cảnh báo) |
| K12 (3.7, F-89) | AI báo "đã nhận tiền", "vừa nhận được chuyển khoản", "chuyển khoản thành công", "tiền đã về tài khoản" (trừ "khi đã nhận tiền …" nói trước). Người đối chiếu sao kê, bấm "Đã nhận tiền", MOZA báo khách bằng câu mẫu | Chặn |

Câu "giá 250k" khi sản phẩm giá 289.000đ → chặn. Câu "còn 5 chiếc" khi còn bán được 3 → chặn. "Chị cao 1m58, nặng 50kg thì
mặc M vừa" (1m58, 50kg khách tự nói; M có trong Bảng size) → đạt.

### A.6 Công cụ

Giữ các công cụ chung (`mo_so_tay`, `mo_skill`, `xem_tinh_hinh_phien`, `xem_cau_hoi_moi`, `xem_hoi_thoai`, `goi_y_nguoi_dan`,
`chuyen_tu_van`, `bao_nguoi_dan`, `de_xuat_cau_song`, `hoi_moza`, `gan_nhan`, `ghi_bo_nho`, `tom_tat_hoi_thoai`, `tao_viec`,
`de_xuat_bai_hoc`, `chuyen_can_nguoi`, `gui_messenger`, `tra_loi_binh_luan`, `nhan_rieng`, `an_binh_luan`, `dat_nhac`). Đổi / thêm:

| Công cụ | Nhóm | Ai dùng | Mặc định | Luật cứng bên trong |
| --- | --- | --- | --- | --- |
| `muc_luc_san_pham` | Đọc | D, T | Cho phép | Chỉ `dang_ban`; kèm giá, tổng còn bán được |
| `lay_san_pham(so)` | Đọc | D, C\*, T | Cho phép | Nháp / Ngừng bán → `SP_KHONG_BAN_DUOC`; trả mô tả, giá, bảng phân loại và còn bán được từng ô (dạng dòng dữ liệu để trích) |
| `tim_trong_san_pham(so, cau_hoi)` | Đọc | C\*, T | Cho phép | Trong một sản phẩm |
| `xem_khach` | Đọc | T | Cho phép | Chỉ khách của hội thoại đang xử lý; số điện thoại che bớt, địa chỉ đủ (để hỏi "giao về … như lần trước?") |
| `xem_don(don_id?)` | Đọc | T, Q | Cho phép | (#79) T: chỉ đơn của khách đang xử lý. Trả **một khối chữ**: món, đơn giá, phí ship, tổng tiền (dòng dữ liệu để trích), còn hàng của từng món, hạn giữ, **việc còn thiếu** ("chưa có địa chỉ", "khách chưa đồng ý tổng tiền") |
| `cap_nhat_don(viec, …)` | Có ảnh hưởng | T | Cho phép · `huy` thiếu bằng chứng: **Cấm** | (#79) `viec` ∈ {`tao`, `them`, `bot`, `doi_phan_loai`, `thong_tin_giao`, `xac_nhan`, `huy`}. Món gọi bằng lời ("áo 12 đen M x1"), MOZA tự tìm phân loại. Gọi `kho.giu`; chuyển trạng thái theo mục 7; `thong_tin_giao` chuẩn hóa số, tạo / liên kết khách, nghi trùng → Cần người. Lỗi `HET_HANG`, `KHONG_DU_HANG`, `PHAN_LOAI_KHONG_CO`, `DON_KHONG_SUA_DUOC`, `THIEU_THONG_TIN_GIAO`, `CAN_GOI_XAC_NHAN` kèm cách sửa. Trả lại khối chữ như `xem_don` |
| `gui_anh_san_pham(so, mau?)` | Có ảnh hưởng | T | Cho phép | F-56; ảnh gắn đúng màu; tối đa 3 ảnh mỗi lần |
| `tim_mau_theo_anh(tin_nhan_id)` | Đọc | T | Cho phép | F-63; trả tối đa 3 mẫu gần nhất kèm mức giống |
| `xem_san_pham(so)` · `xem_con_hang(so)` | Đọc | **Miệng**, Q | Cho phép | (#80) Trả thẻ rút gọn / còn bán được từng màu × cỡ lúc gọi. Gemini 3.8 Live gọi chạy nền; GPT Live 1 qua giao việc `client` |
| ~~`chuyen_san_pham(so)`~~ | Nội bộ | Miệng (F-64) | — | **Đã bỏ** (dòng dưới) — chưa từng code |
| `tim_san_pham(cau)` · `nhap_kho([...])` · `dieu_chinh_kho([...])` · `doi_trang_thai_san_pham(so, trang_thai)` · `tim_don(cau)` | Đọc / Có ảnh hưởng | Q | Đọc: Cho phép · ghi: **Hỏi** (bảng xem trước + "Làm") | F-62. Không có công cụ xóa, sửa giá, sửa đơn đã gửi |
| `ghi_nhan_chot` | Nội bộ | Hook `khi_tin_den` (mã; câu không chắc thì gọi model rẻ #77) | Cho phép | F-53; gọi `kho.giu` |
| `gui_the_moza` (3.4) | Nội bộ, có ảnh hưởng | Mã của MOZA (thẻ, nhắc, báo hủy, tin trạng thái, câu gom) — không Agent nào | Cho phép (hiện trong Luật quyền để "Dừng mọi thứ" chặn được) | #95; qua đủ hook `khan_cap`, `luat_quyen`, `hop_thu_gui`, `gioi_han_lien_he`, `gioi_thieu` (tin đầu phải tự nhận trợ lý AI) |
| `gui_ma_chuyen_khoan` (3.4) | Có ảnh hưởng | T | Cho phép | F-89; ảnh VietQR đúng tổng đơn, nội dung mã đơn; không bao giờ nói "đã nhận tiền" |
| `dat_ban_hang` · `ghi_so_tay` (3.4) | Có ảnh hưởng | Q | **Hỏi** (bảng xem trước + "Làm") | F-95, #119; con số phải có trong câu người nói; không sửa giá, không xóa mục Sổ tay |
| `chuyen_san_pham(so)` | — | — | — | **Bỏ ở 3.4** cùng F-64 (#124); F-107 chỉ gợi ý, người bấm mới chuyển |
| Bỏ | — | — | — | `muc_luc_tin`, `lay_tin`, `tim_trong_tin`, `xem_ho_so`, `giao_cohost(ma)` → `giao_cohost(so)`, `tao_ung_vien`, `tao_ung_tuyen`, `doi_trang_thai`, `hen_phong_van`, `gop_ho_so` → `gop_khach` (Hỏi) |

D = Director, C = Co-host, T = Tư vấn viên, Q = Quản lý ("Nói với Mai", F-62). Theo hướng dẫn thiết kế công cụ mới nhất
(mục 14): ít công cụ nhưng mỗi cái làm trọn việc; tham số và kết quả bằng lời dễ hiểu (số sản phẩm, tên màu, cỡ), không bắt AI
dùng mã nội bộ; kết quả gọn, có lọc và giới hạn độ dài; lỗi luôn kèm cách sửa.

Ví dụ lỗi chỉ cách sửa:
```json
{ "loi": "KHONG_DU_HANG",
  "thong_diep": "Áo 12 Đen/M chỉ còn bán được 1, khách muốn 2. Báo khách còn 1, hỏi lấy 1 hay đổi sang Đen/L (còn 4)." }
```

### A.7 Lời dặn vai trò và Skill mẫu

Thứ tự ghép ngữ cảnh giữ SPEC-TD A.7 ("mục lục tin còn tuyển" → "mục lục sản phẩm đang bán"; Co-host: "ô Thông tin của
một mã" → "dữ liệu của một sản phẩm"; Tư vấn viên thêm "đơn đang mở của khách" trước tóm tắt hội thoại). Giới hạn bước, thời
gian, luật nâng lên Claude giữ nguyên; thêm điều kiện nâng: hội thoại có nhãn "khiếu nại" hoặc "mặc cả".

**Lời dặn vai trò mồi** — Claude Code soạn lại toàn bộ theo bán hàng, giữ những điều chủ dự án đã chốt về cách nói (nói tự
nhiên như người thật, liền mạch, nghỉ ngắn, giọng có lên có xuống — bản đồ cảm xúc #48, tối đa 3 chữ "nhé" cả kịch bản, rất
ít "nhé" khi nói). Ý chính:
- **Chung:** `{ten_ai}` là trợ lý AI của shop `{ten_shop}`; chỉ nói giá, số còn, phí ship, chính sách theo dữ liệu; gọi sản
  phẩm bằng "số + tên"; mời chốt đúng cú pháp; không bịa chất liệu, công dụng, không kể đã mặc thử; không hứa giảm giá, quà.
- **Miệng / Mai dẫn chính:** giới thiệu từng món như MC bán hàng: điểm hút → dịp mặc → giá → màu, cỡ còn hàng → lời mời chốt;
  đọc tên người vừa chốt khi MOZA đưa; số còn chỉ nói khi dữ liệu có và ≤ ngưỡng; không đọc số điện thoại, địa chỉ.
- **Tư vấn viên:** như nhân viên bán hàng online: trả lời nhanh, gọn, thân thiện; tư vấn size theo Bảng size; lên đơn đúng
  bước (giữ hàng → xin thông tin giao, nói rõ để giao hàng → đọc lại đơn và tổng tiền → chờ khách đồng ý → xác nhận); tin đầu
  tự giới thiệu là trợ lý tự động.
- **Soạn kịch bản:** theo F-45, F-49.

**Skill mẫu** (thay 15 Skill tuyển dụng):

| Skill | Dùng khi | Ai dùng |
| --- | --- | --- |
| Gom và hiểu câu hỏi từ bình luận | Có loạt bình luận mới | D |
| Nhường lời và chuyển việc | Người dẫn đang nói, hoặc câu hỏi cá nhân | D |
| Giới thiệu sản phẩm | Có câu hỏi về một sản phẩm | C, T |
| Tư vấn size | Hỏi cỡ, chiều cao, cân nặng, số đo | C, T |
| Gợi ý phối đồ và món đi kèm | Khách phân vân, hỏi mặc với gì | C, T |
| Giá, phí ship, thanh toán | Hỏi giá, ship, COD, chuyển khoản | C, T |
| Đổi trả và bảo quản | Hỏi đổi trả, giặt, bảo quản | C, T |
| Hỏi lại khi thiếu thông tin | Nguồn không có câu trả lời | D, C, T |
| Gỡ lưỡng lự bằng bằng chứng thật (`go-luong-lu`, BH6 F-84) | Từ 2 người cùng lưỡng lự về một món | C |
| Phân loại và xếp ưu tiên hội thoại | Mở hội thoại mới | T |
| Tư vấn qua tin nhắn | Mọi hội thoại Messenger | T |
| Lên đơn và xin thông tin giao | Khách muốn mua / vừa chốt trên live | T |
| Xử lý hết hàng | Món khách muốn đã hết hoặc không đủ | T |
| Sửa và hủy đơn | Khách đổi món, đổi cỡ, đổi địa chỉ, hủy | T |
| Hỏi tình trạng đơn | Khách hỏi đơn đâu, mã vận đơn | T |
| Nhận biết lúc cần chuyển người | Khiếu nại, hàng lỗi, đòi hoàn tiền, mặc cả dai, đòi gặp người | T |
| Soát sản phẩm | Nút "Xem thử AI hiểu gì" | (một lần) |
| Đọc ảnh sản phẩm | "Tạo từ ảnh" (#75): điền thông số theo danh mục, chỉ điều nhìn thấy, không đoán giá / xuất xứ | (một lần) |
| Quản lý kho bằng lời | "Nói với Mai" nhập / điều chỉnh tồn: hiểu "10 áo 12 đen M", hỏi lại khi mơ hồ, luôn xem trước | Q |
| Tra đơn và báo cáo nhanh | "Nói với Mai" hỏi đơn, doanh số | Q |
| Gỡ lưỡng lự (3.4, F-84) | ≥ 2 người cùng lưỡng lự một món ("sợ không vừa", "vải mỏng không"): trích đúng nguồn thật, không nguồn thì im, cấm giảm giá / so sánh | C |
| Điền thông tin shop (3.4, F-95) | "Nói với Mai" điền phí ship, miễn ship, đổi size, giờ nghe máy…: luôn xem trước | Q |
| Viết bài báo trước live (3.4, F-96) | "✨ AI soạn" bài nhá hàng, mô tả Sự kiện live, câu Reels | `soan_bai` |

Từ bản 3.4 Claude Code soạn các Skill, lời dặn mới và chép bản cũ vào `loi-dan-mau-cu.json` / `skill-mau-cu.json` để dữ liệu đang
chạy được nâng (#94).

**Bộ nhớ ba tầng:** Sổ tay shop · bộ nhớ từng khách (số đo, sở thích, điều đã hứa) · bài học. Thứ tự tin cậy: Sản phẩm và
tồn kho > Sổ tay > Bộ nhớ khách. Bộ kiểm tra không nhận trích từ bộ nhớ cho giá, số còn, tổng tiền.
