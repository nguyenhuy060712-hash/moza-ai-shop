# Moza AI Shop

Phần mềm vận hành **livestream bán hàng** (quần áo, phụ kiện) trên Facebook Page: sản phẩm và tồn kho, trợ lý AI "Mai"
trong phòng live, nhận bình luận **chốt đơn** tự giữ hàng, Tư vấn viên AI trả lời Messenger 24/7 và lên đơn, đơn hàng,
in phiếu giao, báo cáo doanh số. Chạy trên một laptop Windows, chỉ mở trên chính máy đó (`http://127.0.0.1:5173`).

Cải tạo từ MOZA Live OS bản tuyển dụng (tag `diem-xuat-phat-ban-hang`). Đặc tả: [SPEC.md](SPEC.md) (bản 3.2) —
kết quả các mốc và việc chủ shop cần làm ở mục 12.

## Chạy

1. Cài [Node.js](https://nodejs.org) **bản 26 trở lên**.
2. Bấm đúp `CHAY PHAN MEM.bat`. Lần đầu nó tự cài thư viện, tạo file `.env` rồi mở trình duyệt.
   Lần đầu chạy trên dữ liệu của bản tuyển dụng, phần mềm **tự sao lưu** rồi dọn dữ liệu tuyển dụng
   (bản sao ở `data\sao-luu\truoc-nang-cap-12.db`).
3. **Cài đặt → Khóa AI**: dán khóa vào ô, **Lưu**, rồi **Kiểm tra** (Gemini, OpenAI, Anthropic).
   Khóa chỉ nằm trong `.env` trên máy này. **Không bao giờ dán khóa vào tin nhắn hay gửi cho ai.**
4. **Cài đặt → Bán hàng**: tên shop, số điện thoại, địa chỉ gửi hàng, phí ship, miễn phí ship từ, giờ giữ hàng.

Để cửa sổ đen mở trong lúc dùng. Công tắc **Dừng mọi tự động** ở góc phải mọi màn hình: bật là AI không chạy, không gửi,
không nói gì ra ngoài (vượt mức trần chi phí thì tự bật).

## Màn hình

| Màn hình | Việc |
| --- | --- |
| Tổng quan | Đơn chờ xác nhận, đơn cần gửi, doanh số hôm nay, sắp hết / hết hàng, chi phí AI, việc cần làm ngay |
| Đơn hàng | Thẻ Chờ xác nhận · Cần gửi · Đã gửi · Đã giao · Hoàn · Đã hủy. Sửa món, người nhận, phí ship; xác nhận, hủy, hoàn tác lần đổi của AI; **in phiếu** (A6 hoặc 4 phiếu / A4); chọn nhiều đơn → **Đánh dấu Đã gửi** kèm mã vận đơn; **Xuất Excel (CSV)**; tạo đơn tay (khách gọi điện, Zalo) |
| Hộp thư | Messenger, bình luận bài đăng, bình luận live. **Tư vấn viên AI** tư vấn giá, size theo bảng size, ship, đổi trả theo Sổ tay; gửi ảnh sản phẩm; tìm mẫu theo ảnh khách gửi; lên đơn, xin thông tin giao, đọc lại đơn, xác nhận khi khách đồng ý. Bạn gõ vào hội thoại nào thì AI dừng ở đó tới khi bấm **Giao lại cho AI** |
| Livestream | Phiên live, kịch bản (mỗi đoạn một sản phẩm, **AI soạn kịch bản**), **Phòng diễn tập** (Facebook giả, người xem giả hỏi và chốt) |
| Màn hình người dẫn | Sản phẩm đang nói kèm **còn bán được từng màu × cỡ**, dòng **Vừa chốt** và số đơn trong buổi, câu hỏi nổi bật, gợi ý của Mai. Chế độ: Chỉ gợi ý, Mai nói, Mai dẫn chính, Đội AI dẫn. Khối **Lên sóng**: cảnh Phòng live / Sản phẩm / Cả hai (phím 1 / 2 / 3), gợi ý chiếu của Mai (Enter), nút chọn nội dung Màn hình sản phẩm |
| Màn hình sản phẩm | Trang `/man-hinh-san-pham.html` cho OBS lấy làm nguồn trình duyệt: giới thiệu, ảnh đúng màu, bảng size tô cỡ hợp, chất liệu, phối đồ, tất cả món, video, trình chiếu. Mai tự chọn theo bình luận và đoạn kịch bản; nói "Mai ơi, chiếu bảng size áo 12" / "quay lại camera". Thanh chữ `/thanh-chu.html` hiện món đang bán và người vừa chốt |
| Sản phẩm | 6 nhóm ô (cơ bản, giá, thông số theo danh mục, bảng size, phân loại màu × cỡ và kho, cho AI). **📷 Tạo từ ảnh**: kéo ảnh vào, AI điền trước, ô AI đoán tô vàng tới khi bạn xác nhận. Nhân bản, bản sửa, "Thẻ AI đọc". Thẻ **Bảng size** dùng chung |
| Tồn kho | Nhập hàng, điều chỉnh khi kiểm kê, lịch sử ra vào; lọc sắp hết / hết hàng. Còn bán được = tồn − đang giữ cho đơn chưa gửi |
| Khách hàng | Hồ sơ, đơn, hội thoại, gộp hồ sơ trùng, xóa dữ liệu theo yêu cầu |
| Sổ tay shop | Giới thiệu shop, cách chọn size, giao hàng, thanh toán, đổi trả, câu hỏi thường gặp — AI chỉ nói chuyện chung theo đây |
| Agent & Skill | Vận hành, chi phí AI, Skill, lời dặn, Hook, luật quyền, chờ duyệt, nhật ký "Vì sao", bài học |
| Báo cáo | Theo buổi live, theo ngày, theo sản phẩm: bình luận → chốt → đơn → gửi → giao / hoàn / hủy; doanh số, **lãi gộp** theo giá vốn, tỷ lệ hoàn. Không tính diễn tập |
| Tổng kết buổi (Báo cáo → buổi live → Tổng kết) | Phễu từ bình luận tới đơn, bán chạy, gợi ý sau live, mốc từng món trong video, **bảng từng đoạn** của buổi (món nào ra đơn, món nào người xem bỏ đi — cần buổi live thật từ 10 phút). Nút **✨ Mai đề xuất kịch bản buổi sau**: Mai soạn nháp thứ tự món, số phút, chỗ đổi lời mở từ số liệu (không có tên khách); bạn sửa rồi **Lưu thành kịch bản** và chọn nó ở ô kịch bản khi bắt đầu buổi sau |
| Cài đặt | Khóa AI, Bán hàng, Facebook, **OBS** (hai nguồn hình lên sóng: camera điện thoại + Màn hình sản phẩm; "Tạo cảnh Moza"), giọng và giọng riêng của Mai, Đội AI, model từng Agent, sao lưu, tự chạy khi mở máy |

**Nói với Mai** (ô trên cùng mọi màn hình): gõ hoặc bấm 🎙 nói — "nhập thêm 10 áo 12 đen M", "áo 12 còn bao nhiêu",
"đơn nào chờ xác nhận quá 12 giờ". Việc ghi (nhập kho, điều chỉnh, ngừng bán) hiện bảng xem trước, chỉ làm khi bấm **Làm**.

## Khách chốt đơn thế nào

Trên live, người xem bình luận **"chốt" + số sản phẩm + màu + size** (ví dụ "chốt 12 đen M", "c12 den m x2"; không ghi số
thì là món đang nói). MOZA đọc bằng mã (câu khó hiểu mới nhờ model rẻ `gpt-6-luna`), **giữ hàng** ngay vào đơn "Chờ xác nhận"
(cùng người chốt nhiều món = một đơn), đọc tên người chốt trên sóng (tối đa 3 tên / 30 giây), rồi Tư vấn viên nhắn riêng
xin tên, số, địa chỉ. Hết hàng thì không giữ và báo khách. Quá giờ giữ chưa xác nhận thì đơn tự hủy, hàng trả về kho.
AI chỉ **xác nhận / hủy** đơn khi có tin khách đồng ý / xin hủy, chỉ sửa món theo lời khách; gửi, giao, hoàn là việc của người.

## Tập trước khi live thật

Livestream → Phòng diễn tập → chọn chế độ → **▶ Bắt đầu tập**. Người xem giả tự hỏi giá, size, ship và chốt đơn; Messenger
giả để thử Tư vấn viên. Đơn diễn tập tách riêng (tích "Đơn diễn tập" ở màn hình Đơn hàng). Chi tiết phần máy móc giữ từ
bản tuyển dụng (Mai nói, Mai dẫn chính, Đội AI, Radio, giọng riêng, nối Facebook thật): `docs/05-spec-tuyen-dung-2.10.md`.

**Nối Facebook thật**: Cài đặt → Facebook → "Hướng dẫn từng bước"; cần `cloudflared`
(`winget install --id Cloudflare.cloudflared -e`). Dùng **ứng dụng Meta và Page bán hàng riêng**, không dùng lại của Page tuyển dụng.

## Dữ liệu và sao lưu

- Dữ liệu trong `data\moza.db` (SQLite); ảnh sản phẩm trong `data\anh\`.
- Bấm **Sao lưu ngay** trong Cài đặt; bản sao ở `data\sao-luu\`. Thỉnh thoảng chép ra USB hoặc Google Drive.

## Dành cho người phát triển

Người mới nhận dự án: đọc [BAN-GIAO.md](BAN-GIAO.md) trước.

```
npm install     cài thư viện
npm start       chạy
npm test        chạy test (đặt TEMP/TMP sang data\tam-test nếu ổ C gần đầy)
```

```
server/
  index.js, dich-vu.js   khởi động, nối các dịch vụ (phòng live, hộp thư, chốt đơn, tự hủy đơn quá giờ)
  db/                    ket-noi.js, nang-cap/NNN-*.sql (012 bán hàng, 013 mốc sửa món của đơn)
  nghiep-vu/             san-pham, bang-size, kho, don, khach, hop-thu, live, kich-ban, bao-cao, so-tay, cai-dat… — chỉ khối này viết SQL
  nhan-chot.js           đọc bình luận chốt bằng mã; chot-don.js: bình luận chốt → giữ hàng, đơn, đọc tên, nhắn riêng
  agent/                 runtime, nha-cung-cap/ (Gemini, OpenAI, Claude, có ảnh), cong-cu/ (san-pham, don, quan-ly, hop-thu…),
                         hook/, kiem-tra/ (Bộ kiểm tra K1–K10), agents/ (Director, Co-host, Tư vấn viên, Đọc ảnh, Nói với Mai,
                         Đọc bình luận chốt, Tìm mẫu theo ảnh…), mieng/ (GPT Live 1, Gemini 3.8 Live)
  hop-thu.js             Tư vấn viên tự động, nhắn chủ động về đơn
  facebook/              gia.js (Facebook giả), that.js (Graph API, gửi ảnh)
  doi-ai/                Đội AI dẫn, nhạc
  api/                   /api cho các màn hình (san-pham, don, …)
  cau-hinh/              danh-muc.json, thong-so.json, ten-goi-khac.json, loi-dan-mau.json, skill-mau.json, gia-model.json…
public/                  giao diện JavaScript thuần, không cần build
test/                    node:test (505 test)
```
