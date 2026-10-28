# Giả lập Facebook và cách test — đợt cải tiến BH5 → BH9

> Tài liệu thiết kế kèm `SPEC.md` 3.4 (mục 11, #92). Đây là bản thiết kế lúc lập kế hoạch 27/9/2026, số hiệu tạm có thể khác; **khi khác, theo `SPEC.md`**. Các chỗ trùng giữa mốc đã được gộp ở `docs/08-thiet-ke-chi-tiet-bh5-bh9.md` mục "Các chỗ đã gộp".

*Viết ngày 27/9/2026. Chỉ đọc mã và tài liệu, không sửa file nào trong repo. Các chỗ trích mã đã kiểm bằng Read/Grep. Riêng hàm `docChot` được chạy thử một lần trong bộ nhớ, không ghi file, không tốn tiền.*

---

## 0. Tóm tắt

- **Hợp đồng hiện tại chỉ kiểm 6 hàm** (`server/facebook/giao-dien.js`, mảng `BAT_BUOC`). Mười hàm của Hộp thư đều ngoài hợp đồng. Facebook giả (`gia.js`) hiện rất "dễ tính":
  - không có luật 24 giờ, không có hạn 7 ngày;
  - không kiểm dạng thẻ;
  - không có video xem lại;
  - số hiệu buổi live trùng số hiệu video;
  - bỏ qua bộ đọc webhook (`tuWebhook`).
- **Đề xuất cách B:** làm một **"Meta giả" dùng chung** (bộ luật và trạng thái, có đồng hồ giả) với hai lối vào:
  - `gia.js`: dùng cho Phòng diễn tập và test nghiệp vụ;
  - một `fetch` giả nối vào chính `that.js` + `graph.js` + `nhip-goi.js`: dùng cho test hợp đồng.
  - Sự kiện vào đi qua đúng `tuWebhook` và `binhLuanTuGraph`. Tin gửi ra đi qua một bộ dựng tin dùng chung. Nhờ vậy bản giả và bản thật chỉ khác nhau ở phần gửi mạng.
- **24 hành vi Facebook** phải giả lập (H01–H24, mục 3). Mỗi hành vi có ghi nguồn tài liệu Meta và trạng thái kiểm chứng trong một bảng hành vi (`hanh-vi-meta.json`). Hành vi nào chưa rõ thì mặc định chọn trường hợp **xấu**, và test chạy cả hai nhánh.
- **Đọc mã thấy 15 chỗ lệch hoặc lỗi** (L1–L15, mục 1.3). Hai chỗ đáng chú ý nhất:
  - **Bình luận của chính Page trên live không bị lọc.** Chạy thử `docChot` với câu ghim của P07 ("ví dụ chốt 12 đen M") và bình luận "mục lục" của P03: cả hai ra `la_chot: true`, và câu ghim có món 12 Đen/M đủ phân loại. Nếu Facebook đưa bình luận của Page vào luồng live (Bước 0 sẽ kiểm) thì MOZA sẽ giữ hàng cho chính Page.
  - **Bình luận không có tên người gửi** thì tên thành "Người xem", và `tenGoi` lấy chữ cuối, nên AI sẽ đọc "xem vừa chốt" trên sóng.
- **Chi phí phần này: 0 USD OpenAI, 0 lượt Google.** Mặc định dùng AI giả và khách giả soạn sẵn do Claude Code viết. Chỉ có một lượt thử AI thật **không bắt buộc**, khoảng 0,05–0,1 USD, phải báo trước.
- **Bước 0** dựng lại từ `scripts/thu-facebook/cong.js` (đang là bản tuyển dụng) thành 18 bước bán hàng, có chế độ ghi mẫu thật. Sau buổi thử, Claude Code ẩn danh các mẫu ghi, đổi thành dữ liệu test, rồi sửa cả `that.js` và `gia.js`.

---

## 1. Hợp đồng Facebook hiện tại

### 1.1 Các hàm

| Hàm | `gia.js` (FacebookGia) | `that.js` (FacebookThat / FacebookPage) | Trả về |
|---|---|---|---|
| `ten`, `chuKyTimLiveMs` | `'gia'`, 1000 | `'that'`, 15000 | — |
| `timLiveDangPhat()` | các live trong bộ nhớ | `GET /{page}/live_videos?broadcast_status=["LIVE"]`, lấy `id,title,description,creation_time,status` | `[{id, tieu_de, bat_dau, (page_id, page_ten)}]` |
| `moLuongBinhLuan(liveId, fn, khiLoi)` | EventEmitter `binh_luan`; `datLuongHong` giả hỏng luồng | SSE `streaming-graph…/live_comments`, `comment_rate=one_hundred_per_second` | `{dong()}`; fn nhận `{id, live_id, ten, noi_dung, luc, nguoi_id}` |
| `docBinhLuan(liveId, sauLuc)` | lọc `luc >= sauLuc` | `GET /{live}/comments` với `live_filter=no_filter`, `since-1`, tối đa 300 | `[bình luận]` |
| `anBinhLuan(id, pageId?)` | thêm vào `daAn` | `POST /{id} is_hidden=true` | boolean |
| *ngoài hợp đồng:* `guiTinNhan({page_id, psid, noi_dung})` | ghi vào luồng chat | `messaging_type: RESPONSE` | `{mid}` |
| `guiAnh({…, anh, ten})` | ghi vào luồng chat | multipart `filedata`, `is_reusable:false` | `{mid}` |
| `guiThe({…, noi_dung, nut})` | cắt còn 3 nút | button template, chữ ≤640, tiêu đề nút ≤20 (cắt bằng `slice`) | `{mid}` |
| `guiUtility({…, ten, tham_so})` | luôn được | `messaging_type: UTILITY` | `{mid}` |
| `taoMauUtility` | **không có** | `POST /{page}/message_templates` | `{id, trang_thai}` |
| `traLoiBinhLuan({comment_id, noi_dung})` | ghi vào `traLoi` | `POST /{comment}/comments` | `{id}` |
| `coTheNhanRieng({comment_id})` | luôn `true` | `GET ?fields=can_reply_privately`, lỗi thì `true` | boolean |
| `nhanRieng({comment_id, noi_dung})` | 1 lần mỗi bình luận, lỗi `DA_NHAN_RIENG` (mã của MOZA) | `recipient:{comment_id}`, chỉ gửi chữ | `{mid, psid}` |
| `layTenNguoi({psid})` | từ `tenNguoi` | `GET /{psid}?fields=name…` | chuỗi |
| `docTinMoi(sauLuc)` (lưới an toàn) | **không có** | `/conversations` + `/feed` | sự kiện chung |

- **Hàm chỉ dành cho Phòng diễn tập** (`gia.js`): `batDauLive`, `batDauLiveThuHai`, `ketThucLive`, `themBinhLuan`, `khachNhan` (có ảnh), `khachBinhLuanBai`, `khachBam`, `luongChat`, `dsChat`, `hongGui`, và 2 Page giả `PAGE_GIA`.
- **Sự kiện vào** (`su-kien.js`): `tin_nhan`, `tin_vong`, `postback`, `binh_luan_bai`, `live_doi`.
- **Đổi lỗi** (`graph.js doiLoi`):
  - 190 → `FB_MA_HET_HAN`;
  - 4/17/32/613/80001/80006 → `FB_GIOI_HAN_GOI`;
  - 2018278/2534022 → `NGOAI_CUA_SO_24H`;
  - 2018028 → `FB_CHUA_DUYET`;
  - 2018300 → `FB_UNG_DUNG_KHAC_GIU`;
  - 1545041 → `FB_NGUOI_KHONG_NHAN_DUOC`;
  - 10/200/283 → `FB_THIEU_QUYEN`.
- **Nhịp gọi** (`nhip-goi.js`): mức dùng trên 50% thì cách nhau 2 giây, trên 80% thì 10 giây. Phải chờ quá `toiDaChoMs` (20 giây khi gửi tin) thì báo lỗi `FB_GIOI_HAN_GOI`.
- **Luật gửi hiện nằm phía MOZA**, trong `agent/hook/hop-thu-gui.js`: 24 giờ (dòng 47–51), 1 lần mỗi bình luận và 7 ngày (dòng 56–58), trả lời công khai cách nhau ít nhất 20 giây, tối đa 60 lần mỗi giờ.

### 1.2 Test đang dùng Facebook giả

- `facebook.test.js`: webhook và chữ ký, `tuWebhook`, nhịp gọi, đổi lỗi. Có `fetchGia` riêng trong file để kiểm dạng gửi của `that.js`.
- `chot-don.test.js`: Luồng 3 trên FacebookGia.
- `the-don.test.js`: nút thẻ, Utility giả, và dạng gửi thật.
- `hop-thu.test.js`: 24 giờ, mất mạng, nhắn riêng 1 lần và 7 ngày, tin diễn tập không bao giờ ra Facebook thật.
- `hop-thu-don.test.js` và `dien-tap-ban-hang.test.js`: khách giả với AI giả.
- AI giả `nhaGia` đang bị chép lặp ở 5 file test.

### 1.3 Chỗ lệch và lỗi thấy khi đọc mã

| # | Chỗ | Hậu quả |
|---|---|---|
| L1 | `gia.js` phát sự kiện đã ở dạng MOZA, bỏ qua `tuWebhook`, và kèm `ten`. Facebook thật không gửi tên trong webhook tin nhắn. | Nhánh `layTen` (`server/hop-thu.js:116`, chỉ chạy khi `!dienTap`) chưa bao giờ được diễn tập. Phần đọc webhook mới (quick reply, referral) sẽ không được thử. |
| L2 | Bản giả không có luật 24 giờ và 7 ngày, không kiểm giới hạn thẻ. `that.js` âm thầm cắt chữ bằng `slice`. | Thẻ quá dài hoặc tin ngoài 24 giờ vẫn "đạt" trên bản giả. |
| L3 | Live giả chỉ có một số hiệu, không có số hiệu video riêng, và không phát bình luận live qua đường webhook bài đăng. | Không lộ lỗi `laBaiLive` (`nghiep-vu/hop-thu.js:394`, so `post_id` với số hiệu buổi live). |
| L4 | `ketThucLive` xóa `binhLuanCu`. | Không có video xem lại, P03 không test được. |
| L5 | `coTheNhanRieng` luôn `true`. `nhanRieng` báo lỗi bằng mã của MOZA chứ không phải lỗi dạng Meta. | Nhánh "không nhắn riêng được" chỉ được thử qua Hook. |
| L6 | `guiUtility` giả không cần mẫu đã duyệt, không cần quyền. `gui-the-don.js:88` luôn có mẫu khi diễn tập. | Không lộ lỗi thiếu `page_utility_messaging` (L11). |
| L7 | `giao-dien.js` chỉ kiểm 6 hàm. | Bản giả và bản thật lệch nhau không ai phát hiện, ví dụ `taoMauUtility` chỉ có ở bản thật. |
| L8 | Phòng live không lọc `nguoi_id === page_id` (`phong-live.js:177`, `live.themBinhLuan`). | Câu ghim P07 và "mục lục" P03 bị đọc thành chốt (đã chạy thử `docChot`). P43 có nguy cơ ẩn nhầm câu có số tài khoản của chính Page. |
| L9 | Không có `from` thì tên thành 'Người xem' (`that.js binhLuanTuGraph`), rồi `tenGoi` (`chot-don.js:33`) lấy chữ cuối. | Đọc "xem vừa chốt" lên sóng. Ở P14, mỗi bình luận ẩn danh bị đếm thành một người (`an_${id}`). |
| L10 | `doiLoi` xét mã 10 trước, nên 10/1893063 thành `FB_THIEU_QUYEN`. | Báo sai lỗi (P04). |
| L11 | `ket-noi.js:27` `QUYEN_CAN` thiếu `page_utility_messaging`. `:26` `TRUONG` thiếu `messaging_referrals`. | #89 có thể hỏng khi nối Page thật. P01 phần 4 không nhận được mã gắn trong link. |
| L12 | `su-kien.js` bỏ qua `message.quick_reply`, `postback.referral`, `referral`, `read`. | Nút trả lời nhanh (P19, 6.3B) và link m.me không về MOZA. |
| L13 | `nhip-goi.js truocKhiGoi` không xếp hàng: nhiều lời gọi cùng lúc cùng tính một khoảng chờ rồi cùng gọi. Chờ quá 20 giây thì lỗi. | Khi 30–50 người chốt và mức dùng trên 80%, thẻ có thể rơi vào lỗi. Phải test dưới tải. |
| L14 | `live.ganLive` (`live.js:118–123`) ghi `bat_dau` là lúc MOZA thấy live, bỏ `creation_time`. Bản giả trả `bat_dau` là lúc bấm nút. | Lệch 10–30 giây, sai mốc giây của P03, P08. |
| L15 | `tuaThoiGian` (`dien-tap-ban-hang.js:19`) chỉ lùi mốc trong cơ sở dữ liệu. | Khi thêm luật 24 giờ và 7 ngày vào bản giả, phải tua cả đồng hồ giả, nếu không hai bên lệch nhau. |

---

## 2. Cách dựng giả lập: ba lựa chọn

| Cách | Làm gì | Ưu | Nhược |
|---|---|---|---|
| A | Chỉ thêm luật vào `gia.js` như hiện nay | Nhanh, ít đổi | `that.js` chỉ được test bằng các `fetch` giả rời rạc. Bản giả và bản thật tiếp tục lệch (L1, L2, L7). |
| **B (khuyến nghị)** | **Một "Meta giả" dùng chung, hai lối vào.** Sự kiện vào đi qua `tuWebhook`/`binhLuanTuGraph`, tin ra đi qua một bộ dựng tin dùng chung. | Lệch ít nhất. Cùng một kịch bản chạy được trên cả bản giả lẫn `that.js`. Mã lỗi đi qua đúng `doiLoi`. | Công sức vừa: khoảng 350 dòng cho Meta giả, 120 dòng bộ dựng tin, 200 dòng `fetch` giả. |
| C | Máy chủ Graph giả chạy trên cổng riêng, bắn webhook có chữ ký vào 5174 | Giống thật nhất | Nặng, test chậm, dễ trùng cổng với bản tuyển dụng. Phần chữ ký đã có test riêng. |

**Cách B gồm các phần sau** (không thêm thư viện; chỉ dùng `node:events`, `FormData`, `fetch`, `ReadableStream` có sẵn):

- **`server/facebook/meta-gia.js` (lớp MetaGia): trạng thái và luật.**
  - Giữ: các Page, các live (số hiệu buổi live, số hiệu video, giờ tạo, giờ bắt đầu phát, trạng thái LIVE/VOD, số người xem), bình luận (`from` có hay không, `laPage`, `giay`, `can_reply_privately`), người nhận, lượt nhắn riêng đã dùng, ảnh đã tải lên, mẫu Utility, hồ sơ Messenger, quyền, trạng thái duyệt ứng dụng, Page bị hạn chế, mức dùng, tình huống.
  - Đồng hồ `bayGio()` + `tua(ms)`.
  - Mỗi hàm mô phỏng một nhóm đường Graph: `gui(body)`, `taiLen`, `docBinhLuan`, `timLive`, `taoMau`, `docMau`, `datHoSo`, `binhLuan`, `an`, `sucKhoe`.
  - Lỗi ném ra đúng dạng Meta `{code, error_subcode, message}`.
  - **Hành động của người** (khách giả, người dùng bấm, Claude Code bấm): `binhLuanLive`, `binhLuanXemLai`, `nhan`, `bam`, `chamTraLoiNhanh`, `moLinkMme`, `moTinCho`, `doc`. Mỗi hành động dựng **thân webhook thô** (`{object:'page', entry:[…]}`).
- **`server/facebook/dung-tin.js`: bộ dựng tin dùng chung.**
  - Nhận một **thẻ trung tính** `{kieu:'chu'|'anh'|'luoi'|'media', chu, tieu_de, phu_de, anh:[{attachment_id|url, payload}], nut:[{tieu_de, payload, kieu:'postback'|'goi', so}], tra_loi_nhanh:[…]}` và trả về `message` đúng dạng Send API.
  - `kiemThe()` kiểm giới hạn: nút tối đa 3, tiêu đề nút tối đa 20 ký tự, chữ thẻ tối đa 640, tiêu đề và dòng phụ của thẻ ảnh tối đa 80, lưới 2–6 ảnh với tiêu đề tối đa 45, trả lời nhanh tối đa 13 nút với nhãn tối đa 20, payload tối đa 1000.
  - Mỗi con số có ghi nguồn và ngày tra.
  - Cả `that.js` và MetaGia đều gọi `kiemThe` (sửa L2).
- **`gia.js` (FacebookGia) thành lớp vỏ theo hợp đồng quanh MetaGia.**
  - Sự kiện vào: `tuWebhook(body)`. Bình luận live: `binhLuanTuGraph`. Sửa L1: bỏ `ten` khỏi sự kiện tin nhắn, Hộp thư gọi `layTenNguoi` như với Facebook thật.
  - Có độ trễ giả `treMs` (test để 0, Phòng diễn tập để 200–800 ms).
- **`test/ho-tro-fb.js`: `fetchMetaGia(meta)`.**
  - Chuyển URL và phương thức HTTP thành lời gọi MetaGia, trả JSON và header mức dùng (`X-Page-Usage`, `X-Business-Use-Case-Usage`), chạy luồng SSE cho `live_comments`.
  - Dùng để chạy `that.js` + `graph.js` + `nhip-goi.js` trên cùng bộ luật.
  - Gộp luôn 5 bản chép `nhaGia` vào `test/ho-tro.js`.
- **Hợp đồng mở rộng** (`giao-dien.js`): danh sách đầy đủ các hàm ở mục 3, cộng `kiemTra` cho bảng P07. Một test khẳng định cả FacebookGia và FacebookThat đều đủ hàm.
- **`server/facebook/hanh-vi-meta.json`: bảng hành vi.**
  - Mỗi dòng có: `id, ten, gia_lap, trang_thai, nguon[], ngay_tra, buoc0, test[]`.
  - `trang_thai` là một trong: `tai_lieu`, `mau_thuan`, `chua_kiem_chung`, `da_thu_nguoi_thu`, `da_thu_khach_la`.
  - Phòng diễn tập đọc bảng này để gắn nhãn "⚠ chưa kiểm chứng". Một test đảm bảo mọi hành vi đều có nguồn và test.

---

## 3. Hành vi Facebook mới cần giả lập (H01–H24)

Ký hiệu: **[TL]** Meta ghi rõ · **[MT]** hai trang Meta nói khác nhau · **[?]** chưa kiểm chứng (có số câu hỏi của Bước 0). Nguồn lấy từ `web-meta-platform.json`, tra ngày 27/9/2026.

### Nhóm A: Tin nhắn riêng và thẻ (nút thắt của cả luồng chốt đơn)

**H01. Nhắn riêng bằng thẻ; 1 tin mỗi bình luận; hạn 7 ngày; `can_reply_privately`** [TL: private-replies, send-messages; riêng bình luận **live** là [?] B0-5]
- **Giả lập:**
  - `nhanRieng({comment_id, noi_dung|the})` nhận thẻ kiểu ảnh, lưới hoặc chữ.
  - Lần thứ hai trên cùng bình luận, hoặc quá 7 ngày theo đồng hồ giả, hoặc `can_reply_privately=false`, thì ném lỗi dạng Meta. Mã lỗi thật **chưa biết**: tài liệu `/private_replies` cũ ghi 10900 và 10903, cần kiểm ở B0-8.
  - Công tắc "Nhắn riêng bình luận live: Được / Không".
- **Dùng cho:** P22, P02, P01 phần 3, P03, P24 bước 2.
- **Sửa `that.js`:**
  - `nhanRieng(commentId, {noi_dung|the})` dựng thân tin bằng `dung-tin`.
  - Gộp `coTheNhanRieng` vào `xemBinhLuan(commentId)` → `{nhan_rieng_duoc, giay}`.
  - Xin thêm `can_reply_privately` trong `fields` của luồng và `docBinhLuan` [?], để bớt một lần gọi Graph cho mỗi người chốt.
  - `graph.js doiLoi` thêm `FB_DA_NHAN_RIENG` và `FB_KHONG_NHAN_RIENG_DUOC`.
- **Test:**
  - `meta-gia.test.js`: luật 1 tin, 7 ngày, giới hạn thẻ.
  - `hop-dong-facebook.test.js`: cùng kịch bản cho ra cùng mã MOZA ở cả hai bản.
  - `chot-don.test.js`: đường P22 bằng thẻ; `can_reply_privately=false` thì gom tên công khai.

**H02. Tin thứ hai trước khi khách trả lời** [MT: trang Send API nói bình luận đã mở cửa sổ 24 giờ, trang nhắn riêng nói phải chờ khách; B0-7]
- **Giả lập:** công tắc "Tin thứ 2: Chặn (mặc định) / Cho". Chặn thì báo lỗi 10/2018278, đổi thành `NGOAI_CUA_SO_24H`.
- **Dùng cho:** P22, P06, P24.
- **Sửa `that.js`:** không đổi. Chỉ đổi mặc định của bản giả sau Bước 0.
- **Test:** `meta-gia.test.js` chạy cả hai nhánh. `hop-thu-don.test.js`: P06 không nhắc khi khách chưa từng trả lời.

**H03. Cửa sổ 24 giờ theo đồng hồ giả, và tua thời gian** [TL]
- **Giả lập:**
  - Cửa sổ mở khi khách nhắn tin, bấm nút, chạm trả lời nhanh, hoặc mở link giới thiệu khi đã có hội thoại.
  - Tin RESPONSE, thẻ, ảnh, trả lời nhanh ngoài cửa sổ thì báo lỗi 2018278.
  - `tua(gio)` lùi mọi mốc trong bộ nhớ. `POST /dien-tap/tua` gọi thêm `fbGia.tua` (sửa L15).
- **Dùng cho:** P06, P19, P21 (ảnh QR), P23, P24, P27, 6.3B.
- **Sửa `that.js`:** không.
- **Test:**
  - `meta-gia.test.js`.
  - `dien-tap-ban-hang.test.js`: tua 24 giờ thì cả MOZA lẫn Meta giả cùng chặn.
  - Test "phòng thủ hai lớp": gọi thẳng bản giả, bỏ qua Hook. Kiểm MOZA nhận lỗi Meta thì ghi "chưa liên lạc được", không gửi lại liên tục.

**H04. Khách bấm nút trên thẻ → webhook postback** [TL]
- **Giả lập:**
  - `bam(payload)` dựng thân webhook `messaging_postbacks` và mở cửa sổ 24 giờ.
  - Thẻ cũ vẫn bấm được (như Messenger thật).
  - Thêm "nút ma": bấm hai lần liên tiếp, và webhook về hai lần cùng `mid` để thử chống trùng.
- **Dùng cho:** P22 (Giữ / Đổi / Không lấy), P02 (GIU_MOI), P06 (Xác nhận / Sửa / Đặt lại), P24a/b (Vẫn chờ), P19, P21 (CK/COD), P23 (Thêm, Gộp, Tách), P27 (Vừa / Chật / Rộng), 6.3B.
- **Sửa `that.js`:** không. Làm **một bộ đọc nút chung**: mở rộng `the-don.js docPayload`, mỗi tiền tố một dòng.
- **Test:** `the-don.test.js`: mọi tiền tố payload, thẻ cũ, bấm trùng, bấm khi hàng đã hết thì có tin do mã soạn.

**H05. Trả lời nhanh, kể cả nút tự điền số điện thoại (`user_phone_number`)** [TL cho quick replies; dạng dữ liệu của số điện thoại là [?] B0-9]
- **Giả lập:** `chamTraLoiNhanh(i)` dựng webhook `message` có `quick_reply.payload`. Nút số điện thoại gửi chữ và payload là số điện thoại bịa của khách giả. Nút trả lời nhanh biến mất sau một lần chạm.
- **Dùng cho:** P19, P20, 6.3B, P27 (trong 24 giờ).
- **Sửa:** `su-kien.js` thêm `payload` vào sự kiện `tin_nhan`. `that.js guiThe` nhận `tra_loi_nhanh`.
- **Test:** `facebook.test.js` (`tuWebhook`). `hop-thu-don.test.js`: số điện thoại điền bằng mã, không qua AI.

**H06. Tải ảnh lên lấy `attachment_id`; ảnh dùng địa chỉ đường hầm bị chết** [TL cho Attachment Upload; ảnh qua địa chỉ tạm là [?] B0-5, B0-6]
- **Giả lập:**
  - `taiAnhLen({page_id, anh, ten})` → `{attachment_id}`, có ghi nhớ theo phân loại.
  - Thẻ ảnh chỉ nhận `image_url`. Loại `media` nhận `attachment_id` nhưng không có chữ.
  - `doiDuongHam()` làm địa chỉ cũ "chết", gửi lỗi `FB_ANH_LOI` (mã giả định).
- **Dùng cho:** P22, P02, P21.
- **Sửa `that.js`:** thêm `taiAnhLen` (`POST /{page}/message_attachments`, `is_reusable:true`).
- **Test:** `hop-dong-facebook.test.js` (dạng multipart). `chot-don.test.js`: ảnh chết thì lùi về thẻ chữ có nút.

**H07. Tin nằm trong "Tin nhắn chờ", khách không thấy; thêm xác nhận đã đọc** [?] B0-5, B0-17
- **Giả lập:**
  - Mỗi người có hộp "chính" hoặc "chờ". Tỷ lệ người mới vào hộp chờ chọn được: 0, 50 (mặc định) hoặc 100%.
  - Khách ở hộp chờ không trả lời và không phát sự kiện đọc cho tới khi `moTinCho`.
  - Tin nhắn sau (kể cả qua "ib") **vẫn vào hộp chờ**, vì tính theo người chứ không theo tin (theo nhận xét kiem-8).
  - Tùy chọn: sự kiện `read {watermark}` khi mở tin.
- **Dùng cho:** P01 (nhắc trên sóng, "ib"), P24a (chọn số giờ N), P06, P32 (phễu "đã trả lời").
- **Sửa:** Facebook không báo gì khi tin vào hộp chờ. Nếu duyệt thêm xác nhận đã đọc thì: `TRUONG` thêm `message_reads`, `su-kien.js` thêm loại `da_doc`. Đây là **đề xuất thêm**: giúp P01 chỉ nhắc người chưa đọc; câu nhắc vẫn trung tính.
- **Test:** `dien-tap-ban-hang.test.js`: khách giả ở hộp chờ nghe câu nhắc trên sóng thì mở tin và bấm nút.

**H08. Khách chặn Page hoặc tạm không nhận tin (551/1545041)** [TL]
- **Giả lập:** cờ cho từng người. Mọi lần gửi cho người đó đều lỗi.
- **Dùng cho:** P22 (lùi về gom tên công khai), P06.
- **Sửa:** `doiLoi` đã có.
- **Test:** `chot-don.test.js`.

### Nhóm B: Live, video xem lại, bình luận

**H09. Số hiệu buổi live khác số hiệu video; bình luận live về cả hai đường** [?] B0-10, sửa lỗi `laBaiLive` là việc nền
- **Giả lập:**
  - Live có `id` và `video.id` khác nhau.
  - Mỗi bình luận live phát cả luồng live lẫn webhook bài đăng với `post_id = {page}_{video_id}`. Công tắc bật mặc định (chọn trường hợp xấu).
  - `docTinMoi` giả cũng trả bài live.
- **Sửa:**
  - `that.js timLiveDangPhat` lấy thêm `video{id}` và trả `video_id`.
  - Tệp nâng cấp `018-*.sql` (hoặc số kế tiếp lúc làm) thêm `phien_live.fb_video_id`.
  - `laBaiLive` so cả hai số hiệu.
- **Test:** `chot-don.test.js`: một bình luận đi hai đường chỉ thành **một** đơn và **một** tin nhắn riêng. `hop-dong-facebook.test.js`: lưới an toàn `/feed` bỏ bài live.

**H10. Giờ bắt đầu live theo Facebook** [?] B0-3, B0-12
- **Giả lập:** live giả có giờ tạo sớm hơn lúc MOZA thấy 10–30 giây.
- **Sửa:**
  - `live.ganLive` ghi `bat_dau_fb` (cùng tệp nâng cấp 018).
  - Lưu ý: `creation_time` có thể là lúc *tạo* buổi live chứ chưa chắc là giây 0 của video. Bước 0 so với `live_broadcast_timestamp` của bình luận đầu. Claude Code tra trang tham chiếu LiveVideo xem có trường giờ phát riêng không.
- **Dùng cho:** P03, P08, việc nền.
- **Test:** `chot-don.test.js` hoặc `live.test.js`.

**H11. Số người xem (`live_views`)** [TL có trường; giá trị là [?] B0-3]
- **Giả lập:** số người xem lên xuống theo kịch bản.
- **Sửa `that.js`:** lấy thêm trường `live_views`, trả `luot_xem` (null nếu không có).
- **Dùng cho:** P16.
- **Test:** `hop-dong-facebook.test.js`.

**H12. Live đã kết thúc; bình luận trên video xem lại (tới 7 ngày); laptop tắt nên webhook lỡ** [?] B0-12
- **Giả lập:**
  - `ketThucLive` giữ live ở trạng thái VOD (sửa L4).
  - `binhLuanXemLai({live_id, ten, noi_dung, giay?})` có công tắc "có hay không có mốc giây".
  - Công tắc "Webhook tắt" để mô phỏng máy tắt: chỉ đọc được bằng hỏi định kỳ.
- **Sửa `that.js`:**
  - Thêm `timLiveGanDay(7)` (`broadcast_status` VOD; giá trị cụ thể Claude Code tra khi code).
  - `docBinhLuan` dùng được cho live đã xong và lấy `live_broadcast_timestamp`.
  - `FacebookThat.nhoBinhLuan` cho video xem lại.
- **Dùng cho:** P03 (hỏi lúc khởi động và 10 phút một lần).
- **Test:** `xem-lai.test.js` mới: có số món thì thành thẻ; không số món thì thẻ hỏi lại; quá 7 ngày thì bỏ; không hưởng giá live.

**H13. Page tự bình luận: câu ghim, "mục lục"** [?] B0-4, B0-13
- **Giả lập:** `themBinhLuan({laPage:true})` cho `from.id = page_id`. Hàm `dangBinhLuan` lưu bình luận Page đăng lên video.
- **Sửa:**
  - `that.js` thêm `dangBinhLuan(objectId, noiDung)` (`POST /{video}/comments`).
  - **Phòng live và phần hỏi video xem lại bỏ bình luận có `nguoi_id === page_id`** (sửa L8).
- **Dùng cho:** P03, P07, P43.
- **Test:** `chot-don.test.js`: câu ghim "ví dụ chốt 12 đen M" **không** thành đơn. `xem-lai.test.js`: mục lục bị bỏ qua.

**H14. Ẩn bình luận có số tài khoản hoặc đường link của người không phải Page** [TL, đã có `anBinhLuan`]
- **Giả lập:** bình luận của kẻ gian; bình luận của Page có số tài khoản thì **không** ẩn.
- **Dùng cho:** P43, #19.
- **Test:** `nhan-binh-luan.test.js` / `chot-don.test.js`.

**H22. Bình luận không có `from` (ẩn danh)** [có thể xảy ra; mã đã phòng bằng `an_${id}`; B0-5]
- **Giả lập:** công tắc cho mỗi bình luận.
- **Sửa:** `tenGoi` gặp tên mặc định thì không đọc lên sóng. P14 không đếm những bình luận này là người chốt (sửa L9).
- **Dùng cho:** P01, P13, P14, P20.
- **Test:** `chot-don.test.js`.

**H23. Một người gõ "ib" nhiều lần; mỗi bình luận là một lượt nhắn riêng**
- **Giả lập:** chỉ cần kịch bản.
- **Sửa:** đánh dấu "bình luận này đã dùng lượt nhắn riêng" trên `binh_luan_live` **trước** Director (việc nền).
- **Dùng cho:** P01 phần 3.
- **Test:** `chot-don.test.js`: Director không `chuyen_tu_van` bình luận đã dùng lượt, nên không bị lỗi `DA_NHAN_RIENG`.

### Nhóm C: Sức khỏe Page, quyền, mẫu tin Utility

**H15. Page bị tạm cấm nhắn tin (10/1893063) và Page Integrity** [TL cho mã lỗi và API; dạng dữ liệu là [?] B0-1]
- **Giả lập:**
  - Công tắc "Page bị hạn chế": mọi lần gửi lỗi 10/1893063.
  - `docSucKhoePage()` trả trạng thái hạn chế.
  - Khi mở lại, hạn 7 ngày vẫn tính từ lúc khách bình luận (theo đồng hồ giả).
- **Sửa:**
  - `doiLoi` bắt mã phụ 1893063 **trước** nhánh mã 10 → `FB_PAGE_BI_HAN_CHE` (sửa L10).
  - `that.js docSucKhoePage()`: đường API cụ thể Claude Code tra khi code.
  - `ket-noi.js` hiện mức đỏ.
- **Dùng cho:** P04, P07, Hook giới hạn liên hệ.
- **Test:** `facebook.test.js` (bảng đổi lỗi). `hop-thu-don.test.js`: dừng mọi tin nhắc, đưa vào danh sách "nhắn bù khi mở lại", nhắn bù rải dần trong hạn 7 ngày.

**H16. Ứng dụng chưa duyệt (2018028) và thiếu quyền** [TL; B0-1, B0-16]
- **Giả lập:**
  - Công tắc "Ứng dụng chưa duyệt": chỉ những người trong danh sách người thử nhận được tin.
  - Tập quyền tùy chỉnh được; thiếu `page_utility_messaging` thì gửi Utility lỗi 10.
- **Sửa:** `QUYEN_CAN` thêm `page_utility_messaging` (sửa L11). Bản giả có `kiemTra()` cùng dạng với `ketNoiFb.kiemTra`.
- **Dùng cho:** P07 (dòng đỏ), việc nền "thêm quyền".
- **Test:** `facebook.test.js` (kết nối). `chuan-bi-live.test.js` của P07.

**H17. Mẫu Utility: tạo (có nút), chờ duyệt, gửi ngoài 24 giờ, bấm nút** [TL: duyệt "trong vài giây", cần quyền; nút trong mẫu Messenger là [?]; B0-14]
- **Giả lập:**
  - `taoMauUtility` ra trạng thái PENDING, sau vài giây giả thành APPROVED. Công tắc "Meta xếp vào loại tiếp thị" thì REJECTED.
  - Gửi mẫu chưa duyệt thì lỗi.
  - Bấm nút trên mẫu → postback, mở cửa sổ 24 giờ.
- **Sửa `that.js`:**
  - `taoMauUtility` nhận thêm nút. Thêm `trangThaiMau(ten)`.
  - Bỏ ghi chú cũ "Meta duyệt khoảng 24 giờ".
- **Dùng cho:** P06 (lần nhắc thứ ba), P27, #89.
- **Test:** `the-don.test.js`, `hop-thu-don.test.js`: mẫu bị từ chối thì bỏ lần nhắc đó.

### Nhóm D: Menu, link m.me, nút gọi

**H18. Menu cố định và nút "Bắt đầu"** [TL: menu bắt buộc có nút Bắt đầu, chỉ nhận `web_url` và `postback`]
- **Giả lập:** `datHoSoMessenger` kiểm các luật này; đặt nút gọi trong menu thì lỗi. Khung chat giả hiện "☰ Menu", mục menu bấm được thành postback.
- **Sửa `that.js`:** thêm `datHoSoMessenger` (`/me/messenger_profile`).
- **Dùng cho:** P19, P01 phần 4.
- **Test:** `meta-gia.test.js`, `hop-dong-facebook.test.js`.

**H19. Link m.me có mã `ref`** [TL; mất mã trên Android là [?] B0-15]
- **Giả lập:** `moLinkMme({ref, nguoiMoi, matRef})`:
  - người mới: hiện nút Bắt đầu, bấm thì ra postback kèm `referral`;
  - người đã có hội thoại: sự kiện `referral` và mở cửa sổ 24 giờ;
  - `matRef=true`: không có mã.
- **Sửa:** `TRUONG` thêm `messaging_referrals`. `su-kien.js` thêm loại `gioi_thieu` và đọc `postback.referral` (sửa L12).
- **Dùng cho:** P01 phần 4 (làm sau Bước 0).
- **Test:** `facebook.test.js` (`tuWebhook`); nút [Đúng] / [Không phải].

**H20. Nút gọi số điện thoại (`phone_number`)** [TL]
- **Giả lập:** chỉ hiện "📞 Gọi …", **không** có webhook, đúng như thật.
- **Sửa:** `dung-tin` thêm nút loại `goi`.
- **Dùng cho:** P19.
- **Test:** `dung-tin` trong `meta-gia.test.js`.

### Nhóm E: Nhịp gửi và dồn tải

**H21. 30–50 người chốt mỗi phút** [TL: chữ 300 lần/giây/Page, tổng 24 giờ = 200 × số người đang tương tác; mức dùng thật đo ở B0-11]
- **Giả lập:**
  - MetaGia tăng mức dùng theo số lần gọi, trả header.
  - Ép lỗi 613/80006 ở lần gọi thứ N.
  - Độ trễ gửi 300–800 ms.
- **Sửa:** `nhip-goi.js` xếp hàng thật (một hàng đợi, không để nhiều lời gọi cùng chờ rồi cùng gọi). Thẻ bị `FB_GIOI_HAN_GOI` thì vào hàng gửi lại trong hạn 7 ngày, không rơi thẳng về gom công khai (L13).
- **Dùng cho:** P22, Bước 0 phần dồn tải.
- **Test:** `dien-tap-tai.test.js` mới, chi tiết ở mục 5.

**H24. Giữ nguyên các tình huống đã có:** mất mạng khi gửi (`hongGui`), luồng bình luận hỏng, 2 live cùng lúc, 2 Page. Thêm "webhook về trùng hoặc sai thứ tự" để thử chống trùng theo `fb_id`.

**Đề xuất không cần giả lập Facebook:** P11, P12, P13 (trừ H22), P14 (trừ H22), P15, P31, P34a, P35, P42, P44, P17 cách A (chỉ cần kịch bản dồn bình luận), P09 bước 1 và 6.5A (chép tay), 6.4B (xuất file), P05 bản nhỏ (chỉ có link, Claude Code tra dạng link khi code).

**Ngoài Facebook nhưng dùng cùng cách:** P21 gọi `img.vietqr.io`. Trong test thay bằng `fetch` giả trả ảnh PNG cố định, có công tắc "dịch vụ QR lỗi" thì lùi về tin chữ.

---

## 4. Phòng diễn tập: khung giả lập

### 4.1 Messenger giả

Sửa `public/js/man-hinh/live.js`, khoảng dòng 857–890.

- **Vẽ đủ các loại thẻ:**
  - thẻ ảnh (ảnh lấy qua đường ảnh sản phẩm MOZA đang có);
  - lưới ảnh, mỗi ô bấm được;
  - thẻ chữ có nút;
  - nhãn trả lời nhanh (biến mất sau một lần chạm);
  - "📞 Gọi" (không phát sự kiện);
  - "☰ Menu" và nút "Bắt đầu";
  - nhãn "Mẫu tin Utility";
  - dòng nhỏ "Tin tự động từ trợ lý AI của shop" (P22, Luật AI Điều 11).
- **Trạng thái mỗi khung chat:** "Tin nhắn chờ: khách chưa thấy" kèm nút [Khách mở Tin nhắn chờ]; "Cửa sổ 24 giờ: còn 23:10"; "Lượt nhắn riêng của bình luận: đã dùng"; "Đã xem".
- **Ai bấm được:** người dùng, khách giả soạn sẵn, và Claude Code qua trình duyệt của bản xem thử.

### 4.2 Tình huống Facebook

Một ô chọn có sẵn các bộ cài; chi tiết thu gọn. Làm theo luật "ít ô nhập".

- **"Như tài liệu Meta, thận trọng" (mặc định):**
  - nhắn riêng bình luận live: được;
  - Tin nhắn chờ: 50% người mới;
  - tin thứ 2: chặn;
  - bình luận không mở cửa sổ 24 giờ;
  - bình luận live về cả hai đường;
  - bình luận xem lại: không có mốc giây;
  - mẫu Utility duyệt sau 3 giây.
- **"Xấu nhất":** không nhắn riêng được, Tin nhắn chờ 100%, ảnh qua đường hầm chết.
- **"Page bị hạn chế"**, **"Ứng dụng chưa duyệt"**, **"Hỗn loạn nhẹ"** (5% lỗi gửi, 5% khách chặn Page, luồng bình luận ngẫu nhiên hỏng).
- Mỗi dòng đọc `hanh-vi-meta.json` và gắn nhãn "⚠ chưa kiểm chứng" khi cần.

### 4.3 Khách giả soạn sẵn thay gpt-6-luna

`server/khach-gia.js` hiện gọi `traLoiKhachGia` (gpt-6-luna). Đề xuất:

- Thêm nguồn **"Soạn sẵn (0 đồng)" làm mặc định**. Chế độ "AI (tốn tiền)" chỉ bật khi chủ dự án chọn.
- `server/cau-hinh/khach-gia-soan-san.json` do Claude Code soạn. Mỗi tính cách là danh sách luật `{khi, lam}`:
  - **`khi`** (tình huống): nhận theo **tiền tố payload** của thẻ (GIU|, XAC_NHAN_DON|, DAT_LAI|…) trước, rồi mới xét từ khóa: xin thông tin, đọc lại đơn, hỏi lại màu size, báo hết hàng, nhắc xác nhận, báo hủy.
  - **`lam`** (việc làm): `bam` (bấm nút), `nhan` (gửi chữ, có mẫu điền tên, số điện thoại, địa chỉ), `cham_nhanh` (chạm trả lời nhanh), `im` (không làm gì), `cho_giay`.
- Chọn ngẫu nhiên theo hạt giống lấy từ mã khách (`bam(psid)` đã có), nên chạy lại cho ra cùng kết quả và test được.
- **Tính cách:** giữ 9 tính cách của `TINH_CACH`, cộng `HOI_MUA`. Thêm:
  - `tin_cho`: ở Tin nhắn chờ, nghe câu nhắc trên sóng thì mở tin;
  - `bam_ngay`, `go_ib`, `khong_lay`, `go_dung` (gõ DỪNG);
  - `so_tu_dien` (chạm nút số điện thoại), `nhu_don_truoc`, `van_cho` (danh sách chờ);
  - `chuyen_khoan_qr`, `an_ten`.
- **Nghe câu nhắc trên sóng:** KhachGia nghe bus (`server/ws.js` `bus`) sự kiện nhắc của P01. Ai đang ở hộp chờ mà có tên trong câu nhắc thì mở tin sau 20–90 giây, theo tỷ lệ của tình huống.

### 4.4 Kịch bản bình luận mới (Claude Code soạn, thêm vào `server/cau-hinh/kich-ban-dien-tap.json`)

- **`don-dap-50`:** 50 tên, 60 bình luận trong 60 giây. Tồn kho nhỏ để có người gặp hết hàng. Có "ib" chen giữa.
- **`ib-va-hoi-mua`** (P01, P02).
- **`xem-lai-sau-live`** (P03).
- **`page-tu-binh-luan`:** câu ghim và mục lục (P07, P03).
- **`ke-gian-gia-shop`** (P43).
- **`an-danh-va-an-ten`** (H22, P01).
- **`yeu-cau-xem`** (P11), **`so-do-hoi-size`** (P13), **`binh-chon-ab`** (P17A), **`luong-lu`** (P12).

### 4.5 Đo ngay trên Phòng diễn tập

- Thời gian từ bình luận chốt tới lúc thẻ hiện trong chat giả: p50 và p95.
- Số thẻ gửi được, số lỗi, số người vào gom công khai, **số người bị bỏ sót (phải bằng 0)**.
- Số người ở Tin nhắn chờ đã mở tin sau câu nhắc.
- Số lượt giọng đọc đã dùng.

### 4.6 Tua thời gian

`POST /dien-tap/tua` lùi cả cơ sở dữ liệu lẫn `fbGia.tua(gio)`, như vậy 24 giờ và 7 ngày khớp nhau hai phía.

---

## 5. Cách test

| Tầng | File | Nội dung chính |
|---|---|---|
| Đơn vị | `test/meta-gia.test.js` (mới) | Luật của Meta giả: H01–H08, H15–H20. Giới hạn thẻ trong `dung-tin`. Đồng hồ và tua. |
| Đơn vị | `test/facebook.test.js` (thêm) | `tuWebhook`: quick_reply, `postback.referral`, `referral`, `read`, bình luận bài có `post_id` là bài video. `doiLoi`: 1893063, lỗi nhắn riêng lần 2 (mã lấy từ Bước 0). `TRUONG`/`QUYEN_CAN` mới. |
| Hợp đồng | `test/hop-dong-facebook.test.js` (mới) | **Cùng danh sách kịch bản** chạy trên FacebookGia và FacebookThat nối `fetchMetaGia`: kết quả và mã lỗi MOZA phải giống nhau. Kiểm hợp đồng đủ hàm ở cả hai bản. Mọi hành vi trong `hanh-vi-meta.json` có nguồn và test. |
| Nghiệp vụ | `chot-don.test.js`, `the-don.test.js`, `hop-thu-don.test.js`, `dien-tap-ban-hang.test.js` (thêm) | Đường thẻ P22/P02; câu ghim và mục lục không thành đơn; ẩn danh; bình luận đi hai đường chỉ xử lý một lần; bộ đọc nút chung; P06 nhắc 2 lần và báo hủy, ngoài 24 giờ, Page bị hạn chế; khách giả soạn sẵn **không gọi AI** (kiểm `nhaCungCap` không bị gọi). |
| Nghiệp vụ | `test/xem-lai.test.js` (mới) | P03 (H12, H13). |
| Dồn tải | `test/dien-tap-tai.test.js` (mới) | 50 người chốt trong một phút giả, độ trễ giả bằng 0. Kiểm: 0 người bị bỏ sót, không bán quá số có, mỗi người có đúng một kết cục (thẻ, báo hết, hoặc gom công khai). Thêm một biến thể qua lớp 2 với header mức dùng 60% và 85%: xếp hàng đúng nhịp, không thẻ nào rơi vào lỗi mà không vào hàng gửi lại. |
| Tay (Claude Code) | Bản xem thử `moza` (cổng 5190) | Chạy kịch bản, bấm thẻ, chụp màn hình, đọc nhật ký (mục 8). |

- **Chạy test:** `npm test`, đặt `TEMP`/`TMP` sang `data\tam-test` như CLAUDE.md. Test mới dùng hẹn giờ ngắn nên `npm test` vẫn nhanh.
- **Mặc định mọi test dùng AI giả và Facebook giả.** Không test nào gọi mạng.

---

## 6. Bước 0: buổi thử Facebook thật

### 6.1 Chuẩn bị (việc của chủ dự án; Claude Code viết hướng dẫn có ảnh)

1. **Page bán hàng phát live được:** có từ 100 người theo dõi, tài khoản dùng từ 60 ngày.
2. **Ứng dụng Meta riêng cho bản bán hàng**, ở chế độ phát triển.
3. **Tài khoản "Người thử":** chưa từng nhắn Page, đã thêm vai trò Tester trong ứng dụng. Nếu có, thêm một tài khoản **không** có vai trò.
4. **`cloudflared`** đã cài.
5. **MOZA bản thật** (`CHAY PHAN MEM.bat`, cổng 5173), đã nối Page trong Cài đặt. Bản xem thử tự bỏ các mã Facebook nên không dùng được cho buổi này.
6. **Tắt "Bình luận → tin nhắn" và Business AI** trong Meta Business Suite.
7. MOZA có **1–2 sản phẩm thật có ảnh**.
8. Kiểm cổng 5173 và 5174 còn trống. Bản tuyển dụng không được chạy cùng lúc.

Thời gian: khoảng 60–90 phút. Live ngắn, đặt tên "Live thử kỹ thuật". Tiền AI gần như 0, vì chế độ "Chỉ gợi ý" và thẻ do mã soạn.

### 6.2 Các bước

Làm theo `scripts/thu-facebook/cong.js`, viết lại cho bán hàng; bản hiện tại vẫn là "BN-012", "lương bao nhiêu".

| Bước | Làm gì | Trả lời câu nào | Hành vi |
|---|---|---|---|
| B0-1 | (tự động) Mã, 7 quyền (có `page_utility_messaging`), Page Integrity đọc được | Q8 | H15, H16 |
| B0-2 | (tự động) Webhook qua Quick Tunnel | — | — |
| B0-3 | Phát live từ điện thoại dưới tên Page. MOZA ghi số hiệu live, số hiệu video, `creation_time`, giờ MOZA thấy, `live_views` | Q5, Q7 | H09, H10, H11 |
| B0-4 | Chủ Page bình luận câu ghim **dưới tên Page**. Có về luồng live không? MOZA phải bỏ qua | — | H13 |
| B0-5 | Người thử bình luận "chốt 12 đen M". MOZA đọc `can_reply_privately`, gửi **thẻ ảnh qua địa chỉ đường hầm**. Điện thoại: tin vào hộp nào, có ảnh không, có nút không (**chụp màn hình**). Có `from` không | Q1, Q2, Q3 | H01, H06, H07, H22 |
| B0-6 | Người thử bình luận "ib". MOZA gửi thẻ dùng ảnh **đã tải lên** (`attachment_id`). Rồi tắt và mở `cloudflared`, gửi lại thẻ dùng địa chỉ cũ | Q3 | H06 |
| B0-7 | Gửi tin thứ hai (RESPONSE tới mã khách vừa nhận) khi người thử **chưa** trả lời. Được hay lỗi mã gì | Q4 | H02 |
| B0-8 | Nhắn riêng lần 2 vào cùng bình luận. Ghi mã lỗi | — | H01 |
| B0-9 | Người thử bấm nút trên thẻ: postback về sau bao nhiêu giây. Chạm nút trả lời nhanh số điện thoại: dữ liệu dạng gì | Q3 | H04, H05 |
| B0-10 | Bình luận live có về đường webhook bài đăng không, `post_id` khớp số hiệu nào. Lưới an toàn `/feed` có thấy bài live không | Q5 | H09 |
| B0-11 | 10 bình luận chốt trong 1 phút từ 2 tài khoản: thời gian tới thẻ, mức dùng trong header | — | H21 |
| B0-12 | Kết thúc live. 5 phút sau người thử bình luận "chốt 7 trắng L" trên video xem lại. Hỏi định kỳ có thấy không, có mốc giây không, webhook có về không. Đọc bình luận bằng số hiệu live sau khi live xong có được không | Q6 | H12, H10 |
| B0-13 | MOZA đăng bình luận "mục lục" lên video: hiện ra sao, mốc phút có thành link bấm được không (chụp màn hình) | — | H13 |
| B0-14 | Tạo mẫu Utility "đơn đang chờ xác nhận" có nút: duyệt sau bao lâu, bị xếp loại gì. Gửi cho người thử | Q8 | H17 |
| B0-15 | (không bắt buộc) m.me?ref: người thử mở link (đã có hội thoại), thử Android và iPhone | — | H19 |
| B0-16 | Tài khoản không có vai trò bình luận chốt: phải ra lỗi 2018028 | — | H16 |
| B0-17 | (nếu duyệt đề xuất xác nhận đã đọc) Người thử mở tin: sự kiện đọc có về không, kể cả khi tin nằm ở Tin nhắn chờ | Q2 | H07 |
| B0-18 | Dọn dẹp: chủ Page tự quyết xóa video thử và hội thoại thử | — | — |

### 6.3 Ghi kết quả

- **`cong.js` ghi** vào `scripts/thu-facebook/ket-qua/buoc0-YYYY-MM-DD.json` (cơ chế `ghi()` đã có). Mỗi dòng: `{ma:'B0-5', cau:'Q1,Q2,Q3', hanh_vi:['H01','H07'], ket_qua:'dat'|'khong'|'ghi_nhan', chi_tiet}`. Ảnh chụp điện thoại để ở `ket-qua/anh/`.
- **Chế độ ghi mẫu** (biến `MOZA_GHI_FB=1`, chỉ dùng trong buổi này): ghi **thân webhook thô** (sau khi đã kiểm chữ ký) và phản hồi Graph (đã bỏ mã truy cập) vào `data/fb-ghi/`. Thư mục `data/` đã nằm trong `.gitignore`.

### 6.4 Sau Bước 0 (Claude Code làm)

1. Đọc kết quả và mẫu ghi. **Ẩn danh**: thay số hiệu bằng số giả cố định, thay tên bằng "Người thử". Lưu thành dữ liệu test `test/du-lieu/fb-that/2026-MM-DD/*.json`. Xóa bản thô sau khi xong.
2. So với `hanh-vi-meta.json`:
   - khớp thì đổi trạng thái sang `da_thu_nguoi_thu`, ghi ngày;
   - khác thì sửa **cả** `meta-gia.js`, `that.js`, `doiLoi` và `su-kien.js`;
   - thay mã lỗi giả định bằng mã thật.
3. Thêm test chạy lại mẫu thật qua `tuWebhook` và `that.js`. Chạy `npm test`.
4. Ghi vào `SPEC.md`: kết quả ở mục 12, bỏ các dòng đã kiểm ở mục 13, thêm quyết định mới nếu đường chính thay đổi.
5. **Rẽ nhánh theo kết quả:**
   - **Q1 = không nhắn riêng được** → đường chính chuyển sang gom tên công khai (#65) và link m.me (P01 phần 4). P22 và P02 chỉ dùng cho người đã nhắn Page. Bộ cài mặc định của bản giả đổi thành "Không".
   - **Q2 = vào Tin nhắn chờ** → câu nhắc trên sóng của P01 là chính; chọn N của P24a dài hơn.
   - **Q3** → ảnh qua đường hầm dùng được thì dùng thẻ ảnh. Chỉ ảnh tải lên dùng được thì thẻ ảnh không chữ, hoặc thẻ chữ có nút. Không cách nào được thì thẻ chữ có nút.
   - **Q4 = cho gửi tin thứ hai** → P22 được gửi ảnh sau, P06 nhắc được cả khi khách chưa trả lời, nhưng vẫn qua Hook giới hạn liên hệ và Điều 28 Luật 91/2025.
   - **Q6 = không có mốc giây** → P03 dùng thẻ hỏi lại món.
   - **Q7 = không đọc được số người xem** → bỏ số người xem khỏi P16.
   - **Q8 = thiếu quyền** → gom vào lần nộp xét duyệt ứng dụng.
6. **Kết quả với người thử có thể khác với khách lạ**, nhất là chuyện Tin nhắn chờ và lỗi 2018028. Phải kiểm lại ở buổi live thật đầu tiên sau khi ứng dụng được duyệt, và đo bằng P32 (tỷ lệ trả lời, tỷ lệ bấm thẻ). Kiểm xong đổi trạng thái sang `da_thu_khach_la`.

---

## 7. Rủi ro giả lập lệch thật và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Bản giả bỏ qua bộ đọc và bộ dựng thật (L1, L2) | Sự kiện vào đi qua `tuWebhook`/`binhLuanTuGraph`; tin ra đi qua `dung-tin` + `kiemThe`; lỗi đi qua `doiLoi`. Bản giả chỉ khác bản thật ở phần gửi mạng. |
| Hai bản khác hàm hoặc khác kết quả (L7) | Hợp đồng đầy đủ; `hop-dong-facebook.test.js` chạy cùng kịch bản trên cả hai. |
| Điều chưa rõ bị giả lập như điều chắc chắn | `hanh-vi-meta.json` ghi trạng thái, nguồn và ngày tra; Phòng diễn tập gắn nhãn "⚠"; mặc định chọn trường hợp **xấu**; test chạy **cả hai nhánh**. Trong mã, chỗ nào dựa vào hành vi chưa kiểm chứng thì ghi chú `// [CHƯA KIỂM CHỨNG Hxx]`. |
| Mã lỗi đoán sai | Lỗi giả dạng Meta, đánh dấu "giả định"; thay bằng mã thật ghi ở Bước 0; test "mọi mã lỗi MOZA đều có đường xử lý". |
| Người thử khác khách lạ | Hai mức trạng thái (`da_thu_nguoi_thu` / `da_thu_khach_la`); đo ở buổi live thật đầu tiên. |
| Thời gian thực khác (trễ, trùng, sai thứ tự) | Độ trễ giả, webhook về trùng hoặc sai thứ tự; dồn tải qua lớp 2 có header mức dùng. |
| Bản giả quá dễ tính, mọi thứ đều thành công | Bộ cài "Hỗn loạn nhẹ" và "Xấu nhất"; khách giả có các tính cách im lặng, chặn Page, ở Tin nhắn chờ. |
| Thẻ trên điện thoại trông khác (cắt chữ, emoji trong tên nút) | `kiemThe` đếm ký tự; Bước 0 chụp màn hình thẻ thật; nút ≤ 20 ký tự tính cả emoji ("✅ Xác nhận đơn"). |
| Meta đổi tài liệu, đổi phiên bản Graph | Bảng hành vi có ngày tra; đầu mỗi mốc Claude Code tra lại theo CLAUDE.md; Graph v26 còn dùng được (v20 ngừng 24/9/2026, v21 ngừng 21/1/2027). |
| Lộ dữ liệu cá nhân trong mẫu ghi | Bản thô chỉ ở `data/`; ẩn danh trước khi đưa vào test; xóa bản thô sau khi xong. |

---

## 8. Việc Claude Code làm thay để khỏi tốn tiền API

1. **Tra tài liệu Meta khi code từng hành vi**, ghi ngày tra vào `hanh-vi-meta.json` và `SPEC.md`. Các chỗ còn phải tra: đường API Page Integrity, trạng thái VOD, nút trong mẫu Utility Messenger, dạng dữ liệu nút số điện thoại, trường giờ phát của LiveVideo.
2. **Viết bộ giả:** Meta giả, `dung-tin`, `fetchMetaGia`, dữ liệu mẫu JSON theo tài liệu, và gộp `nhaGia` dùng chung.
3. **Soạn nội dung giả:** khách giả soạn sẵn cho khoảng 20 tính cách, 11 kịch bản bình luận mới, và **đáp án mẫu cho AI giả** (phiếu gọi công cụ của Tư vấn viên cho các bước còn cần AI, ví dụ đọc địa chỉ khách gõ).
4. **Tự lái bản xem thử** (`preview_start {name:"moza"}`, cổng 5190) bằng trình duyệt: bắt đầu live giả, chạy kịch bản, bấm thẻ trong Messenger giả, chụp màn hình. Sau đó **đọc nhật ký** (`tin_nhan`, `agent_run`, `don` trong `data/xem-thu`, chỉ đọc) và **tự chấm**: số thẻ, độ trễ, người bị bỏ sót, câu có số không qua Bộ kiểm tra. Không dùng model để chấm.
   - **Lưu ý chi phí:** `scripts/xem-thu.js` đang nạp khóa AI thật từ `.env`. Đề xuất thêm cờ `--ai-gia` cho bản xem thử, dùng đáp án mẫu ở ý 3, để các lượt Claude Code tự lái tốn 0 đồng.
5. **Viết hướng dẫn Bước 0** từng bước có ảnh cho chủ dự án, viết lại `cong.js` cho bán hàng, và sau buổi thử thì xử lý kết quả (mục 6.4).

**Chi phí phần giả lập:** OpenAI 0 USD, Google 0 lượt. Dồn tải chạy ở chế độ "Chỉ gợi ý" nên không dùng giọng đọc. Nếu cần thử Đội AI thì chỉ tối đa 3 câu chen.

**Không bắt buộc:** một lượt 5 phút trong Phòng diễn tập với Tư vấn viên thật (gpt-6-luna) và khách giả soạn sẵn, để kiểm lời dặn mới hợp với thẻ. Ước 0,05–0,1 USD (theo #88: 30 phút khoảng 0,3–0,5 USD), nằm trong ngân sách dưới 1 USD của cả đợt. **Phải báo trước và chỉ chạy khi chủ dự án đồng ý.**

---

## 9. Ghi vào SPEC khi làm

- **Quyết định, đánh số từ #91 lúc ghi:**
  - (a) Facebook giả hai lối vào trên một Meta giả, hợp đồng đầy đủ.
  - (b) Bảng hành vi Meta và nhãn "chưa kiểm chứng".
  - (c) Khách giả soạn sẵn là mặc định; cờ `--ai-gia` cho bản xem thử.
  - (d) Tình huống Facebook mặc định "thận trọng".
  - (e) Bước 0 dùng `cong.js` bản bán hàng, có chế độ ghi mẫu.
- **Tính năng:** mở rộng **F-15 (Phòng diễn tập)**, không cần số F mới.
- **Cơ sở dữ liệu:** một tệp nâng cấp `018-*.sql` hoặc số kế tiếp lúc làm (P06 cũng cần 018), thêm `phien_live.fb_video_id` và `phien_live.bat_dau_fb`. Không sửa tệp cũ. SQL chỉ nằm trong `server/nghiep-vu/` và `server/db/`.
- **Không thêm thư viện.** Mọi lời gọi Facebook đi qua hợp đồng chung (`layKetNoi(...)`). Số tiền trên thẻ do mã điền từ dữ liệu.
- **Sửa lỗi gộp vào việc nền, làm trước nhóm chốt đơn:**
  - L8: lọc bình luận của chính Page;
  - L9: tên ẩn danh;
  - L10: mã 1893063;
  - L11: quyền Utility và `messaging_referrals`;
  - L13: xếp hàng nhịp gọi;
  - L14: giờ bắt đầu live;
  - H09: lỗi `laBaiLive`.