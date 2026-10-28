# AI Livestream - Bán hàng

## Dự án này là gì

Bản sao của **MOZA Live OS** (phần mềm livestream **tuyển dụng** cho Bắc Ninh Work), chép sang ngày 25/9/2026
để **phát triển tiếp thành phần mềm livestream bán hàng**.

- Điểm xuất phát: commit `d523648`, tag git `diem-xuat-phat-ban-hang` (= tag `ban-giao-2026-09-25` của bản tuyển dụng).
  Muốn quay về đúng lúc vừa chép: `git checkout diem-xuat-phat-ban-hang`.
- **`SPEC.md` 3.0 (25/9/2026) là đặc tả bán hàng — "Moza AI Shop".** Đặc tả tuyển dụng 2.10 chép ở
  `docs/05-spec-tuyen-dung-2.10.md` ("SPEC-TD"), dùng để tra chi tiết phần máy móc giữ lại.
- 26/9/2026: đã code xong BH1 → BH4 (`SPEC.md` 3.2, 505 test đạt, tag `bh4-giao-hang`); mã, `README.md`, `BAN-GIAO.md` đã là
  bán hàng. `docs/01`–`04` vẫn là tài liệu gốc của bản tuyển dụng (lịch sử). Việc còn chờ chủ dự án: cuối mục 12 `SPEC.md`.
- 28/9/2026: BH5 → BH9 đã code — hết đợt cải tiến 3.4 (`SPEC.md` 3.9, 700 test, tag `bh9-thu-nghiem-ai`). Còn: phép thử AI
  thật (chờ khóa + duyệt chi phí, kịch bản ở `scripts/`) và việc của chủ dự án (cuối mục 12 `SPEC.md`).
- 27/9/2026: `SPEC.md` 3.4 — **kế hoạch đợt cải tiến BH5 → BH9** (báo cáo `docs/06`, thiết kế `docs/07`, `docs/08`).
  Điều kiện chủ dự án đặt: thử AI thật OpenAI < 1 USD cả đợt; việc nào Claude Code làm được thì không gọi API trả tiền; Facebook
  làm luôn nhưng test bằng giả lập; việc luật sư, chuyên gia để sau (#127, không chặn mốc).
- 28/9/2026: **BH5, BH6 code xong** (`SPEC.md` 3.6, 619 test, tag `bh5-khong-roi-don`, `bh6-tren-song`, 0 USD). Chủ dự án giao làm liền BH6 → BH9 khi
  vắng; kết quả và "Quyết định khi chủ dự án vắng" ghi ở mục 12 `SPEC.md`.
- 27/10/2026: **`SPEC.md` 3.10 — kế hoạch đợt nâng cấp BH10 → BH12** (nghiên cứu `docs/09`; #128 → #137, F-108 → F-117): một shop,
  một laptop; BH10 máy đọc mới (`gpt-4o-mini-tts` tắt 6/1/2027 → `gpt-realtime-2.1-mini` chính, ElevenLabs thêm), Mai tự nhận AI bằng
  lời, dòng kiểm Meta Business AI, bảng model; BH11 Decisions, giọng riêng, chạm để trả lời, bảng huấn luyện; BH12 kịch bản buổi sau.
  **Chưa code** — chờ lệnh. Facebook giữ như hiện có, không cắt video, không ghi hình.
- 28/10/2026: **`SPEC.md` 3.12 — thiết kế chi tiết `docs/11` đã duyệt** (#128 → #154). Thứ tự mốc **BH10 → GD1 "Giao diện gọn và rõ"
  → BH11 (+ Màn hình người dẫn chế độ sân khấu) → BH12**; mỗi mốc dừng chờ duyệt. **Zalo hoãn** (không dùng mozaai.vn). Ngân sách thử:
  OpenAI ≤ 0,50 USD, ElevenLabs ≤ 1 USD (chưa có khóa → mô phỏng). BH10 đã làm bước 1 (nâng `openai` 7.45.1); **việc tiếp theo ở
  `docs/phieu-bh10.md`**.
- 28/10/2026 (đêm): **GD1 code xong** (`SPEC.md` 3.14, 768 test, tag `gd1-giao-dien`, 0 USD) — giao diện mới; bản đồ ở `BAN-GIAO.md` 4b. Việc tiếp theo: BH11 (chờ lệnh).
- 28/10/2026 (đêm): **BH11 code xong** (`SPEC.md` 3.15, 791 test, tag `bh11-mai-thong-minh`; thử thật OpenAI trong trần, sổ chi phí mục 12) — Màn hình người
  dẫn sân khấu (`nd-*.js`), bảng huấn luyện, chạm để trả lời, tông giọng, Decisions (MOZA nhìn, Mai đổi thẻ), giọng riêng tắt. Việc tiếp theo: (đã xong BH12, xem dòng dưới) (`docs/phieu-bh12.md`).
- 28/10/2026 (đêm): **BH12 code xong — hết đợt BH10 → BH12** (`SPEC.md` 3.16, 797 test, tag `bh12-kich-ban-buoi-sau`, 0 USD; thử thật cả đợt OpenAI 0,092 USD) — bảng từng đoạn + "Mai đề xuất kịch bản buổi sau" ở Báo cáo → Tổng kết (`bao-cao.js` `veBangDoan`, `agents/de-xuat-kich-ban.js`). Việc chủ dự án: cuối mục 12 `SPEC.md`. Chạy test: `node --test --test-concurrency=3 test/`.
- 28/10/2026: **BH10 code xong** (`SPEC.md` 3.13, 733 test, tag `bh10-san-sang-live`; thử thật máy đọc OpenAI 0,045 USD) — **chờ chủ dự
  án duyệt** (hoặc lệnh làm tiếp) rồi mới làm GD1 theo `docs/phieu-gd1.md`. ElevenLabs chờ khóa.
- Bản tuyển dụng gốc vẫn dùng riêng ở `D:\Du an khac X\AI Livestream - Tuyen dung`. **Không sửa gì bên đó** từ dự án này.
- Tư liệu bán hàng cũ (trước khi cải tạo sang tuyển dụng): tag git `ban-ban-hang-cu` (mã cũ) và
  `data/db.json.ban-hang-cu` (dữ liệu cũ). Dùng để tham khảo, không khôi phục nguyên xi.

## Việc đầu tiên khi bắt đầu phát triển

0. **Đợt BH10 → BH12 đã code xong** (28/10/2026). Việc kế tiếp do chủ dự án quyết (danh sách ở cuối mục 12 `SPEC.md`); mốc mới thì làm theo mục "Cách làm tiết kiệm token" dưới.
1. Đọc `BAN-GIAO.md` (bản đồ mã, chỗ dễ vấp), rồi `SPEC.md` mục 0, 2, 12, 13 (đặc tả bán hàng). Cần chi tiết phần máy
   móc giữ lại thì tra `docs/05-spec-tuyen-dung-2.10.md` theo cùng số mục, F-xx, #xx.
2. Khi mâu thuẫn, theo `SPEC.md`. `docs/` là tài liệu nền, khác `SPEC.md` thì theo `SPEC.md`.

Quy trình: làm lần lượt từng mốc ở kế hoạch trong `SPEC.md`; xong mỗi mốc chạy
`npm test`, ghi kết quả vào `SPEC.md`, commit + tag mốc, rồi dừng để chủ dự án duyệt. Không thêm tính năng hay thư viện
ngoài đặc tả. Tuân theo "Quyền của Claude Code" trong `SPEC.md`. Trước khi cài thư viện, kiểm phiên bản mới nhất;
khác với mục công nghệ thì ghi vào `SPEC.md`.

## Cách làm tiết kiệm token (chủ dự án duyệt 28/10/2026)

Không giảm tốc độ, không giảm chất lượng — chỉ bớt đọc thừa:
1. **Mỗi mốc một cuộc trò chuyện mới**, bắt đầu từ phiếu giao việc `docs/phieu-<mốc>.md` (đọc gì, sửa tệp nào, xong khi nào). Mốc
   BH10 trở đi: **không đọc cả `SPEC.md`** — đọc phiếu + mục `docs/11` phiếu chỉ ra; tra `SPEC.md` bằng `grep` đúng số F-xx / #xx.
2. Đọc tệp lớn theo đoạn (số dòng có trong `docs/11` và `BAN-GIAO.md`), không đọc trọn `live.js`, `nguoi-dan.js`, `SPEC.md`.
3. **Không mở nhóm tra cứu lớn**: công nghệ đã tra 28/10/2026 (`docs/11` mục 1). Đầu mốc chỉ tra lại đúng chỗ ghi [CHƯA KIỂM] bằng vài
   lượt tìm. Nhóm phụ (subagent) chỉ khi phải đọc rộng nhiều tệp, chạy model rẻ.
4. Test: lúc làm chỉ chạy tệp test liên quan; chạy đủ `npm test` một lần trước khi commit; chỉ đọc dòng tổng kết (`ℹ tests/pass/fail`, `✖`).
5. Kiểm giao diện bằng chữ (`get_page_text`, `read_page`) trước; ảnh chụp chỉ khi xem bố cục và gửi chủ dự án cuối mốc.
6. Gom câu hỏi một lần; làm trọn mốc rồi dừng chờ duyệt; tin báo tiến độ ngắn, báo cáo dài ghi vào tệp.
7. **Chọn model và mức suy nghĩ theo việc** (chủ dự án chọn trong app; nhóm phụ do Claude Code đặt model khi giao):

   | Model · mức | Dùng cho |
   | --- | --- |
   | **Opus 5.5 · High** | Việc khó, sai là hỏng tiền / hỏng live: phiên Realtime máy đọc + kiểm đọc nguyên văn (F-108), GPT-Live + Decisions (F-112), tách Màn hình người dẫn 800 dòng (F-126), lỗi sập / giữ hàng / tiền, tài liệu hãng mâu thuẫn |
   | **Opus 5.5 · Medium** (mặc định) | Logic nghiệp vụ có test: F-109, F-110, F-113 → F-117, F-121 (nâng cấp dữ liệu), F-123 (thêm món theo chữ — đụng đơn) |
   | **Sonnet 5.5 · Medium** | Làm theo bản vẽ / mẫu sẵn: F-111 (bảng giá), F-118 (nhãn), F-119 (khung, token CSS, phông, bỏ mã kỹ thuật), F-120, F-122, F-124, F-125; viết test theo mẫu có sẵn; ghi kết quả mốc vào SPEC / BAN-GIAO |
   | **Haiku 5.5 · Low** | Nhóm phụ tìm mã, quét chữ hàng loạt, chạy và tóm kết quả test, chụp ảnh bản xem thử, tóm nhật ký — không viết mã nghiệp vụ |

   Một phiên một model chính; phiếu mỗi mốc ghi model mặc định và chỗ nên đổi.

## Người dùng và cách làm việc

Chủ dự án **không rành kỹ thuật**. Trả lời bằng tiếng Việt, lời thường; thuật ngữ nào buộc dùng thì giải thích ngắn.

- **Bàn trước, code sau.** Đang bàn thì chỉ tra cứu và trình bày; không sửa mã, không sửa `SPEC.md`, không chạy thử gọi
  API tốn tiền. Chỉ làm khi có lệnh rõ ("Code", "Làm đi", "Làm cách 1 đi", hoặc trả lời đủ các câu chọn).
- **Chủ dự án vắng và đã giao làm hết:** tự quyết theo đặc tả, ghi quyết định + lý do vào `SPEC.md`, làm liền các mốc,
  mỗi phần chạy test và commit; gom việc cần họ làm (tài khoản, cài phần mềm Windows) vào một danh sách cuối kèm hướng dẫn.
- **Công nghệ mới nhất — luật cứng của chủ dự án:** không đưa công nghệ cũ vào. Trước khi đề xuất hay code phần nào dùng
  model, API, SDK, thư viện (OpenAI, Gemini, Claude, Meta…): tra kỹ nguồn chính thức mới nhất tại thời điểm code, ghi ngày
  tra vào `SPEC.md`. Cái mới có thể đổi cả phương pháp — khi đó đề xuất đổi phương pháp. Chủ dự án nhắc rằng Claude hay
  bỏ sót hoặc tra không kỹ cái mới nhất: mỗi mốc phải tự kiểm lại điều này.
- **Thiết kế theo chuẩn Agent:** càng đơn giản càng tốt để AI hiểu; ít trường dữ liệu, ít ô nhập (AI tự điền thay người gõ);
  tận dụng tối đa Skill, Tool, Hook, Memory. Thấy cải tiến tốt thì mạnh dạn đề xuất và áp dụng khi được duyệt.
- **Nền tảng làm sẵn thì dùng:** hiểu hết năng lực gốc của nền tảng AI trước khi thiết kế; chỉ tự xây và chỉ thử phần riêng
  của sản phẩm. Phép thử ngắn, rẻ, báo chi phí trước. Việc gì cần người dùng làm thì nói rõ để làm gì.
- **Thiết kế ít ô nhập:** mỗi màn hình chỉ giữ ô tối thiểu; chọn từ danh sách thay vì gõ; không thêm trường "phòng khi cần".
- **AI nói tự nhiên như người thật:** liền mạch, nghỉ ngắn, cuốn hút, rất ít chữ "nhé".
- **Ưu tiên tính năng chạy được** trước; không đo đạc, không tinh chỉnh model cho tới khi phần mềm xong (trừ khi chủ dự án đổi ý).
- Không bao giờ xin khóa API hay mã truy cập trong chat — hướng dẫn tự dán vào `.env` hoặc màn hình Cài đặt.
- Đụng tới thanh toán, dữ liệu cá nhân khách hàng, pháp lý (quảng cáo, giọng AI): cảnh báo rõ, khuyên nhờ chuyên gia xem trước khi ra mắt.
- Tự kiểm tra kết quả (chạy test, mở bản xem thử, chụp màn hình) thay vì bắt chủ dự án đọc mã. Lưu mốc Git sau mỗi bước thành công.

**Nguyên tắc của bản tuyển dụng KHÔNG áp dụng ở đây:** "tuyển dụng, không phải bán hàng", "gọi việc bằng tên nhà máy",
"tin tuyển dụng 4 ô" — đó là luật riêng của bản tuyển dụng. Với bán hàng, hỏi chủ dự án cách gọi sản phẩm và các ô cần có.

## Chạy và xem thử — chú ý trùng cổng với bản tuyển dụng

Hai dự án dùng **cùng cổng**: bản thật 5173 (webhook 5174), bản xem thử 5190 (webhook 5191).
Không chạy cả hai cùng lúc. Trước khi chạy, kiểm cổng còn trống (`Get-NetTCPConnection -LocalPort 5173,5190`);
nếu bản tuyển dụng đang chạy thì báo chủ dự án, không tự tắt nó.

- Xem thử (cổng 5190, dữ liệu `data/xem-thu/`, không dùng mã Facebook, chạy `scripts/xem-thu.js`). Không chạy `server/index.js` qua khung xem trước. Xong thì `preview_stop`.
  - `preview_start {name: "moza"}` = bản chủ dự án dùng, **khóa AI thật** (`.env` + khóa dán ở Cài đặt của bản xem thử, lưu ở `data/xem-thu/.env`) — TỐN TIỀN khi có live / bình luận.
  - `preview_start {name: "moza-ai-gia"}` = AI giả, 0 đồng — Claude Code dùng khi tự kiểm. Không mở bản AI giả cho chủ dự án dùng (8/10/2026: chủ dự án dán khóa mà máy báo thiếu vì đang chạy AI giả).
- Node: dùng `"C:\Program Files\nodejs\node.exe"` (bản 26). `node` trong Git Bash là bản 24.
- Test: `npm test`; ổ C gần đầy nên đặt `TEMP`/`TMP` sang `data\tam-test` trước khi chạy.
- `data/moza.db` là bản chép từ bản tuyển dụng (tin tuyển dụng, phiên live tập, cài đặt, giọng Mai). Khi chuyển sang bán hàng,
  bàn với chủ dự án có làm sạch để bắt đầu mới không; luôn sao lưu trước khi xóa.
- `.env` chép từ bản tuyển dụng nhưng **các ô khóa Google/OpenAI đang trống** (kiểm 28/9/2026) — thử AI thật phải chờ chủ dự án dán
  khóa riêng của shop (Cài đặt → Khóa AI). Nếu sau này dùng chung khóa bản tuyển dụng thì chung cả hạn mức (giọng Google 100 lượt/ngày).
  Nối Facebook Page bán hàng thì dùng ứng dụng/Page riêng, không dùng lại mã của Page tuyển dụng.
