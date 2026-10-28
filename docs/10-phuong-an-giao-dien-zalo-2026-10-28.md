# Phương án nâng cấp 3.11 — giao diện, học từ VIVA, Zalo cá nhân

*27–28/10/2026. Chỉ tra cứu, chụp màn hình bản xem thử (AI giả, 0 đồng) và đọc hệ thống VIVA HCM (chỉ xem, không sửa); chưa sửa mã.
Chủ dự án duyệt 28/10/2026: "Duyệt phương án theo các khuyến nghị của bạn cho cả 6 câu. Ghi docs/10 và cập nhật kế hoạch SPEC.md, chưa
code." → `SPEC.md` 3.11 (#138 → #146, F-118 → F-129). Báo cáo trước: `docs/09` (công nghệ, thế giới, luật — kế hoạch 3.10).*

## 1. Tóm tắt

- **Giao diện hiện tại:** sạch, tông ấm, phông Be Vietnam Pro đẹp, nhưng vẫn là "phần mềm của người kỹ thuật": nhiều chữ giải thích
  và mã nội bộ, mọi thứ quan trọng ngang nhau, Màn hình người dẫn chưa đọc được từ xa.
- **Phương án:** 5 mốc theo thứ tự **BH10 → GD1 → BH11 → BH12 → BH13**; mỗi mốc xong thì test, chụp ảnh, lưu mốc Git, dừng chờ duyệt.
  - BH10 "Sẵn sàng live thật" (đã duyệt ở 3.10) **+ cảnh báo khách từng hoàn**.
  - **GD1 "Giao diện gọn và rõ"** (mới) — khung giao diện, 5 màn hình chính, 7 điều học từ VIVA.
  - BH11 "Mai thông minh hơn" (đã duyệt) **+ Màn hình người dẫn chế độ sân khấu + tông giọng cho Mai trên sóng**.
  - BH12 "Kịch bản buổi sau" (đã duyệt).
  - **BH13 "Zalo cá nhân"** (mới) — trợ lý trên mozaai.vn tra hàng, giữ hàng qua một cổng MCP hẹp của MOZA.
- **Không làm:** tin nhắn thoại; sao lưu tự động (chưa cần); AI tổng đài (để sau); lịch tự phát; nhiều người dùng / ủy quyền duyệt.

## 2. Chấm giao diện hiện tại (bản xem thử, 1440 × 900 và 1366 × 768)

Theo khung chấm thiết kế (ấn tượng đầu, dễ dùng, thứ bậc thị giác, nhất quán, dễ đọc). 13 màn hình đã chụp ở `data/tam-test/ui/` (chỉ trên máy).

**Đang tốt (giữ):** phông Be Vietnam Pro + Lora; Màn hình người dẫn nền tối; "Việc cần làm ngay" có nút; ô "Nói với Mai" ở mọi màn;
Phòng diễn tập; phím ← → chuyển đoạn; bố cục danh sách trái / chi tiết phải thống nhất.

| Mức | Chỗ chưa được |
| --- | --- |
| 🔴 | **Màn hình người dẫn:** gợi ý của AI nằm dưới cùng, phải cuộn (chế độ mặc định "Chỉ gợi ý" lại cần nó nhất); không thấy giá + còn hàng của món đang nói ở phần trên; tiêu đề, lời Mai, ghi chú cùng một màu cam; dòng số liệu xám mờ; **hai nút dừng** ("Dừng mọi thứ" + "DỪNG AI") cạnh nhau; menu 11 mục vẫn hiện khi live; 1366 × 768 chỉ thấy nửa trên |
| 🔴 | **Chữ kỹ thuật lộ ra:** "(#64)", "(F-75)", "(#103)", "(#105)" trong ghi chú; "Agent & Skill", "Hook", "Luật quyền", "Lời dặn vai trò"; "Chờ duyệt: 99" vàng mãi (mù cảnh báo) |
| 🟡 | Tổng quan: 7 ô số ngang nhau, phần lớn là 0, không có nút "Bắt đầu live" |
| 🟡 | Màu: cam vừa là nút chính vừa là nút nguy hiểm; vàng vừa "Chờ xác nhận" vừa "Sắp hết" |
| 🟡 | Đơn hàng: thêm món = 2 ô chọn + 1 ô số không nhãn; phí ship ô nhập thô; 8 tab trạng thái |
| 🟡 | Định dạng: "10000" thay "10.000đ"; "24" không đơn vị; **ô ngày ở Báo cáo kiểu Mỹ** ("09/27/2026") |
| 🟡 | Sản phẩm: biểu mẫu 6 nhóm ô một mạch; nhãn "Làm đại diện" bị cắt, đè nút "Bỏ" |
| 🟢 | Trang trống chỉ ghi "Chưa có…", không nút dẫn tiếp; thiếu biểu tượng tab (lỗi 404 `favicon.ico`) |

## 3. Các bên chuyên nghiệp làm gì (tra 27/10/2026)

| Mẫu | Ai làm | Nguồn |
| --- | --- | --- |
| Bảng điều khiển live: số liệu chọn được, xu hướng "5 phút / cả buổi", gợi ý ghim món kèm doanh số dự kiến, gợi ý lời nói cho món đang ghim | TikTok LIVE Manager / LIVE Dashboard (14/4/2025, 13/5/2026) | seller-us.tiktok.com/university |
| Sức khỏe luồng live kèm hướng dẫn sửa; tốc độ chat | YouTube Live Control Room | support.google.com/youtube/answer/2853833 |
| Chế độ tập (sản phẩm mẫu, bình luận giả); lọc chat Hỏi / Người mua | Whatnot (2/2024) | valueaddedresource.net |
| Chạm một bình luận để đưa lên hình; ghim riêng | Restream (9/2024), StreamYard | restream.io/blog |
| Tách "Sự kiện gần đây" ra cửa sổ riêng | Streamlabs Desktop | streamlabs.com |
| Nhãn trạng thái: màu cố định theo nghĩa, có biểu tượng, 1–2 chữ; thông báo có "Hoàn tác"; trang trống có một nút | Shopify Polaris (web components ổn định 10/2025) | shopify.dev |
| Thanh bên trái nhường chỗ cho vùng làm việc | Shopify POS 10 (22/4/2025) | shopify.com/blog/shopify-pos-design-update |
| Mật độ cao nhưng không mọi thứ cùng trọng lượng; thanh bên mờ hơn nội dung | Linear (12/3/2026) | linear.app/now |
| Gợi ý AI có Duyệt / Sửa / Bỏ, nhật ký việc AI làm; nguồn dưới câu trả lời | Zendesk, Intercom Copilot, Gorgias | support.zendesk.com, intercom.com |
| Đồng hồ đổi vàng → đỏ theo ngưỡng; chữ cỡ chỉnh được; đọc từ xa | Square KDS, Toast KDS, máy nhắc chữ | squareup.com/help, doc.toasttab.com |
| Giới hạn cảnh báo (< 1 cảnh báo / 10 phút lúc bình thường; 3 mức) | EEMUA 191 / ISA-18.2 (tóm tắt) | ABB SCADA alarm white paper |
| Lọc bình luận có số điện thoại / địa chỉ, báo khi đặt quá tồn | Sapo Chat OmniAI (17/12/2025) | sapo.vn |

Ước tính (chưa có nguồn chuẩn): đọc từ 2 m cần con số chính ~64–90 px trên laptop 15,6″ — **chốt bằng phép thử đứng cách 2 m**.

## 4. Năm màn hình chính (phác thảo đã trình 27/10/2026)

1. **Hôm nay** (thay Tổng quan): thẻ "Buổi live tối nay" + nút to **Bắt đầu live** / Tập trước + dòng sẵn sàng; 4 con số; Việc cần làm
   theo mức (đỏ Gấp, vàng Sắp hết, xanh dương Nên làm) có nút; ô "Nói với Mai" trên cùng; menu trái 3 nhóm.
2. **Bắt đầu live** (3 bước): món bán (kịch bản) → Mai dẫn thế nào (4 thẻ có hình: Gợi ý cho bạn · Cùng dẫn · Mai dẫn chính · Đội AI
   dẫn) → kiểm tra trước khi lên sóng (xanh / vàng + link "Cách mở", "Tắt thế nào") → **Lên sóng**.
3. **Màn hình người dẫn — chế độ sân khấu:** thanh mảnh (giờ live, đèn Facebook / OBS / AI, số xem · chốt · xác nhận, chế độ, **một**
   nút Dừng AI); vùng món đang bán (số + tên, giá, lưới còn hàng màu × cỡ chữ to: xanh / vàng sắp hết / đỏ hết kèm chữ); thẻ gợi ý của
   Mai (câu, nguồn, [Mai nói] [Tự đọc] [Bỏ]); "Tiếp theo" + phím ←/→; cột phải: dải cảnh báo, Vừa chốt, bình luận lọc Muốn mua / Hỏi /
   Khách cũ / Tất cả, chạm để Mai soạn trả lời.
4. **Đơn hàng:** 4 tab (Cần làm · Đang giao · Xong · Hủy, hoàn) + In nhiều phiếu; danh sách có nhãn màu + biểu tượng (Chờ xác nhận, Thiếu
   địa chỉ, Chờ tiền CK, Cần gửi) và giờ còn giữ; chi tiết có dòng hành trình (Chốt trên live → Mai nhắn riêng → khách gửi địa chỉ → chờ
   bạn xác nhận), ô "Thêm món: gõ 21 xanh 28", một nút chính **Xác nhận đơn**, Gọi khách, In phiếu; Hủy trong menu ⋯.
5. **Sản phẩm:** đầu trang (ảnh, tên, trạng thái, giá, còn, "Mai đủ thông tin"); 5 tab Cơ bản · Màu và cỡ · Ảnh · Thông tin cho Mai ·
   Hỏi đáp; tab Màu và cỡ là lưới tồn có màu, bấm ô để nhập / chỉnh (ghi lịch sử kho), cột giá riêng; ô AI điền có nhãn "AI đoán" + nút
   "Đúng".

## 5. Học từ VIVA HCM (hcm.vivaai.vn, xem 27/10/2026, chỉ đọc)

VIVA HCM là hệ thống tuyển dụng nhiều người dùng; phần AI chạy trên cùng bộ máy MOZA (Mai, Phòng live, Diễn tập, Bộ kiểm, câu bị chặn,
trần chi phí). Nhiều kênh đang Diễn tập / chưa nối (tổng đài chưa gắn số, Zalo OA chưa nối). Trang giới thiệu `vivaai.vn` tự ghi là
"phạm vi giải pháp đề xuất", bản thử là kịch bản dựng sẵn.

**Đưa vào GD1 (7 điều):**
1. **Đội AI như nhân viên** trên trang Hôm nay — tên, việc, trạng thái (Chờ việc · Thật · Diễn tập).
2. **Chỉ số AI 7 ngày bằng lời thường:** xử lý xong, chuyển cho người, câu bị chặn theo lý do ("con số không có trong nguồn"…), lượt
   lỗi theo lý do, chi phí theo nhóm.
3. **Chi phí hiện thêm VNĐ** theo tỷ giá chủ shop nhập.
4. **Bảng "AI & kênh":** mỗi kênh một dòng — chế độ Thật / Diễn tập / Tắt, trần chi phí / ngày, đã dùng hôm nay, ghi chú; nút "Dừng mọi
   tự động" ở đầu bảng.
5. **Bật / tắt từng phần của phần mềm** (VIVA đang bật 18/38 phần) để ẩn phần shop không dùng.
6. **"Cần xử lý" trong Cài đặt:** chỉ liệt kê cài đặt đang chặn việc, mỗi dòng một nút tới chỗ sửa.
7. **So sánh bản cũ / bản mới** khi duyệt việc "Nói với Mai" và khi sửa Sổ tay (Sổ tay đã lưu bản — thiếu bảng so sánh).

**Đưa vào BH11:** **tông giọng** cho Mai trên sóng — mẫu "Đều, rõ ràng / MC vừa / MC sôi nổi / Ấm áp, tư vấn / Tự viết (≤ 400 ký tự)",
nghe thử tốn phí nhỏ, giới hạn số lần nghe mỗi phút. (MOZA đã có tông cho Đội AI.) Ghi chú cho BH10: VIVA có nút "Tạo giọng Bắc" vì
giọng kho tiếng Việt nghe ra giọng miền Nam — khi chọn giọng ElevenLabs / OpenAI, chọn giọng theo vùng.

**Để sau:** AI tổng đài — làm theo khung "sổ đồng ý" của VIVA: trước khi gọi kiểm người đó đã đồng ý mục đích + kênh "Gọi tự động";
đầu cuộc gọi đọc nguyên văn câu đồng ý đang áp dụng; ghi kết quả kèm mã phiên bản câu. **Không làm:** tin nhắn thoại; lịch tự phát
(AI tự phát live không người); nhiều người dùng, "người gửi không tự duyệt", ủy quyền duyệt.

## 6. Zalo cá nhân — thiết kế (BH13)

**Mẫu VIVA:** trợ lý chạy trên **mozaai.vn** (máy thuê có Hermes Agent, quét QR bằng Zalo công việc), gắn **hai MCP**: MCP chung cho người
lạ (chỉ dữ liệu công khai; dữ liệu riêng mở sau OTP) và MCP nhân viên (khóa riêng, thu hồi được). Hermes ở chế độ "Đang hoạt động" chỉ
cho người lạ dùng MCP chung. VIVA cảnh báo: Zalo không có cổng chính thức cho tài khoản cá nhân — dùng số phụ, nhắn hàng loạt dễ bị hạn chế.

**mozaai.vn (tra 28/10/2026):** thuê máy chủ ảo đặt tại Việt Nam, có Hermes Agent (Nous Research) và mục Bot & Kỹ năng; gói Khởi đầu
239.000đ/tháng (2 vCPU, 4 GB, kèm 250.000đ tiền AI), Chuyên nghiệp 379.000đ, Doanh nghiệp 758.000đ; dùng thử 7 ngày một lần. Trang chủ
không nói về Zalo hay MCP (VIVA ghi cách nối ở "Kênh kết nối › Zalo cá nhân") → **tra lại đầu BH13**.

**Phía MOZA:**
- **Một cổng MCP hẹp** (`/mcp` trên cổng webhook, qua đường hầm Cloudflare **có tên** — địa chỉ cố định, cần tài khoản Cloudflare miễn
  phí), khóa Bearer, thu hồi được, giới hạn số lần gọi. Chỉ công cụ cho khách: tìm món; xem món (giá bán lúc này, còn bán được, ảnh, thông
  số); bảng size + tư vấn size theo số đo (bằng mã); đọc chính sách Sổ tay; **giữ hàng / tạo đơn "Chờ xác nhận"** (qua `don.js`, cùng một
  hàm giữ hàng); mã QR chuyển khoản của đơn vừa tạo. **Không có** công cụ đọc danh sách khách, đơn của người khác, báo cáo, cài đặt.
- **Giữ cam kết "không nói sai giá":** câu trả lời Zalo do AI của mozaai.vn viết nên Bộ kiểm tra MOZA không kiểm được → công cụ trả về
  **câu giá, câu còn hàng, câu tổng tiền soạn sẵn** (máy điền số), skill bắt đọc nguyên văn; đơn Zalo luôn "Chờ xác nhận", **chủ shop
  bấm xác nhận** (AI không xác nhận / hủy được).
- Hội thoại và đơn Zalo hiện ở Hộp thư, Đơn hàng với nhãn nguồn "Zalo"; khách nhận diện theo số điện thoại (gộp với khách Facebook khi
  trùng số, chủ shop xem lại).
- **Laptop tắt** → trợ lý Zalo không tra được hàng; skill dặn: nhận lời nhắn, hẹn shop trả lời. Bảng Sẵn sàng / Hôm nay báo đường hầm,
  khóa, lần gọi gần nhất.
- Skill mẫu cho trợ lý Zalo (cách xưng hô, luật đọc nguyên văn, không nhắn hàng loạt, "gặp người") do MOZA xuất ra để dán vào mozaai.vn.
- **Thư viện:** dùng SDK MCP chính thức cho Node (đúng bản đặc tả mới nhất — `2026-07-28` lúc tra), tra phiên bản khi làm.

**Rủi ro:** tài khoản Zalo bị hạn chế (dùng số phụ, chỉ trả lời người nhắn tới); dữ liệu khách đi qua máy mozaai.vn và nhà cung cấp AI
của họ (ghi vào chính sách quyền riêng tư, luật sư xem — #127); cổng mở ra internet (khóa, giới hạn, chỉ công cụ khách, test chặn).

## 7. Phương án được duyệt (28/10/2026)

| Câu | Chọn |
| --- | --- |
| 1. Thứ tự mốc | BH10 → GD1 → BH11 → BH12 → BH13 |
| 2. Cảnh báo khách từng hoàn | Làm, gộp vào BH10 |
| 3. Cổng cho Zalo | Đồng ý mở cổng MCP hẹp qua đường hầm Cloudflare có tên (ngoại lệ thứ hai sau đường ảnh #97) |
| 4. Thư viện MCP | Dùng SDK MCP chính thức, tra phiên bản lúc làm |
| 5. Ngân sách thử AI thật cả phương án | OpenAI ≤ 0,50 USD, ElevenLabs ≤ 1 USD; Zalo dùng 7 ngày thử của mozaai.vn |
| 6. Cách làm | Xong mỗi mốc: `npm test`, ảnh chụp, lưu mốc Git, dừng chờ duyệt |

Việc của chủ dự án: tạo tài khoản ElevenLabs (nếu dùng); tắt Business AI trên Page; nộp xin quyền nhắn tin Meta sớm; trước BH13: số Zalo
phụ, tài khoản mozaai.vn, tài khoản Cloudflare; đứng cách laptop 2 m duyệt cỡ chữ Màn hình người dẫn.

## 8. Nguồn

- TikTok Seller University: LIVE Manager (14/4/2025), LIVE Dashboard (13/5/2026) — seller-us.tiktok.com/university
- YouTube Help 2524549, 2853833 · Whatnot (valueaddedresource.net, 10/2/2024) · Restream blog (12/9/2024) · StreamYard Help
- Shopify Polaris (shopify.dev/blog/polaris-unified-and-for-the-web; Badge; Toast API; Empty state) · Shopify POS 10 (22/4/2025)
- Linear "Behind the latest design refresh" (12/3/2026) · Stripe Apps design · Zendesk auto assist · Intercom Copilot · Gorgias AI Agent
- Square KDS (squareup.com/help 7944) · Toast KDS · Datavideo, Autocue (máy nhắc chữ) · ABB SCADA alarm management
- Sapo Chat OmniAI (17/12/2025) · Google Fonts METADATA (Be Vietnam Pro, Inter — có bộ chữ tiếng Việt)
- vivaai.vn (trang chủ, /hoat-dong/ai-livestream, /hoat-dong/ai-tu-van-tong-dai, /trien-khai) · hcm.vivaai.vn (xem khi chủ dự án đã đăng
  nhập, 27/10/2026) · mozaai.vn (28/10/2026)
