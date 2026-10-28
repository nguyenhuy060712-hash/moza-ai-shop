# Thiết kế chi tiết đợt cải tiến BH5 → BH9

> Bản thiết kế từng tính năng lúc lập kế hoạch (27/9/2026, chỉ đọc mã, chưa code), kèm `SPEC.md` 3.4. Mỗi mốc do một trợ lý thiết kế song song nên **số F-xx, số quyết định, tên tệp nâng cấp trong phần dưới là số tạm**; bản đánh số chính thức và cách gộp các chỗ trùng nằm ở `SPEC.md` 3.4 và mục "Các chỗ đã gộp" ngay sau. **Khi khác nhau, theo `SPEC.md`.**

## Các chỗ đã gộp khi đối chiếu (áp dụng đè lên thiết kế từng mốc)

- Ba thiết kế trùng cho “một đường gửi tin do mã soạn”: BH5 dùng công cụ nội bộ gui_the_moza qua thucHienCongCu, BH7 tạo server/gui-he-thong.js, BH8 cho gui-the-don.js gọi thẳng lienHe.choGui. Gộp về gui_the_moza (BH5); đưa hai kiểm của BH7 vào đó: người đang giữ hội thoại (ai_tam_dung) và tin đầu tự nhận trợ lý AI. Lưu ý: hook gioi_thieu (server/agent/hook/gioi-thieu.js) hiện bỏ qua khi không có agentId, phải mở cho gui_the_moza. Bỏ gui-he-thong.js; BH8 không gọi choGui trực tiếp.
- Hai cột “ngừng nhắn” và luật ngược nhau: BH5 thêm nguoi_fb.ngung_lien_he_luc, “thôi shop” là xin dừng, tin báo đơn không bị chặn; BH8 thêm nguoi_fb.dung_nhan_tin_luc, “thôi” đứng một mình không tính, chặn cả tin trạng thái đơn. Gộp: một cột ngung_lien_he_luc (018), một danh sách từ trong tu-khoa.json (“thôi” chỉ tính khi câu ngắn không kèm món/size), chặn mọi tin chủ động; tin trạng thái đơn còn mở thành việc gọi cho người; khách tự nhắn lại vẫn được trả lời.
- Bốn kiểu “khách giả không gọi AI”: BH5 “khách soạn sẵn”, BH7 kich-ban-khach-gia.json chế độ kich_ban, BH8 lựa chọn kichBan, giả lập mục 4.3 khach-gia-soan-san.json. Gộp một tệp server/cau-hinh/khach-gia-soan-san.json (luật {khi, lam}) làm ở BH5, mặc định “Soạn sẵn (0 đồng)”; mốc sau chỉ thêm tính cách.
- Hai tệp câu mẫu tin cho khách: BH7 tin-he-thong.json, BH8 cau-mau-khach.json, còn BH5 để câu thẻ trong the-giu-hang.js. Gộp một tệp server/cau-hinh/cau-mau-khach.json từ BH5.
- Ba tên cho giờ Facebook của live: BH5 ghi đè bat_dau bằng creation_time (không cột mới), BH7 bat_dau_fb, BH8 fb_bat_dau; chỉ BH8 lưu link live. Gộp trong 018: phien_live.fb_video_id, fb_link, bat_dau_fb; bat_dau = bat_dau_fb khi có (lùi giờ máy). BH7 P03, BH8 P08 dùng bat_dau_fb để biết mốc có chính xác không.
- live_views: BH5 F-67/F-70 và BH6 P16 cùng thêm; tên trả khác nhau (BH6 nguoi_xem, giả lập luot_xem). Làm ở BH5 F-67, tên nguoi_xem; BH6 chỉ dùng.
- Mẫu Utility: BH5 đổi khóa fb_mau_utility thành bộ {da_gui, cho_xac_nhan, da_huy} + hàm trangThaiMau; BH8 thêm khóa khác fb_mau_utility_bo + hàm trangThaiMauUtility. Gộp: một khóa fb_mau_utility dạng bộ, một hàm trangThaiMau, một nút “Tạo bộ mẫu tin” từ BH5; BH8 thêm mẫu vào bộ.
- Tên chủ tài khoản: BH5 F-74 ô ten_chu_tk, BH7 P21 ô ten_tk. Dùng ten_chu_tk; BH7 chỉ thêm ngan_hang, so_tk (viết hoa bỏ dấu lúc dựng URL VietQR, không sửa giá trị lưu).
- Xóa dữ liệu làm hai lần, hạn khác nhau: BH7 menu MENU_XOA/XAC_NHAN_XOA, việc hạn 2 ngày làm việc; BH8 payload XOA_DU_LIEU, hạn 72 giờ, và xoaDuLieuNguoi. Gộp vào BH7 F-88 (menu cần trước): một payload, câu báo đã nhận gửi ngay bằng mã (đáp ứng mốc “báo đã nhận trong 2 ngày làm việc” mà kiem-7 dẫn NĐ 356), việc xoa_du_lieu hạn 72 giờ (tạm, luật sư). BH8 chỉ thêm: xóa bản ghi đồng ý và ảnh khách khi xóa dữ liệu.
- Nút “Bắt đầu”/menu Messenger: BH5 F-70 nút “Bật nút Bắt đầu”, BH7 P19 nút “Cài menu Messenger” — cùng gọi Messenger Profile, gọi riêng sẽ đè nhau. Một hàm datHoSoMessenger (get_started + persistent_menu) và một nút “Cài Messenger cho Page” từ BH5; BH7 thêm mục menu.
- Ràng buộc CHECK sẽ vỡ ở mốc sau: BH5 đặt lien_he.loai CHECK IN (goi_ten, nhac, bao_huy, moi_chao) nhưng BH8 cần cham_soc; luot_nhan_rieng.boi sẽ cần xem_lai (BH7) và moi_bao_live (BH8). Với SQLite phải dựng lại bảng mới thêm được. Quy ước: cột “loại” mới không đặt CHECK, kiểm trong mã (như viec.loai).
- BH5 F-68 trái sua_lai kiem-9 P22 (dùng image_url qua đường hầm cho thẻ generic) và tự mâu thuẫn: cấm Quick Tunnel cho ảnh, trong khi thẻ ảnh generic chỉ nhận image_url còn mẫu media nhận attachment_id nhưng không có chữ. Sửa: thứ tự image_url qua một đường ảnh công khai hẹp trên cổng webhook (chỉ ảnh sản phẩm Đang bán, tên băm) → attachment nếu Bước 0 cho thấy thẻ nhận → thẻ chữ có nút. Đây là ngoại lệ luật SPEC mục 9 “ảnh chỉ ở 127.0.0.1” nên ghi quyết định và báo chủ dự án. Thêm sua_lai kiem-8 P22 (c): lấy recipient_id trả về để ganPsid.
- Bố cục Thanh chữ xung đột: BH5 F-75 đặt nhãn AI góc trên trái; BH6 đề nghị nhãn góc trên phải, bình chọn góc trên trái; BH9 thêm khung đính chính. Chốt một bố cục ngay ở BH5 F-75 (nhãn góc trên phải; bình chọn góc trên trái; Tiếp theo/đính chính trên ô món; cảm ơn chạy đáy).
- “Ẩn tên” và nhận ý định: BH5 F-66 đặt ở nhan-binh-luan.js, F-70 lại tạo server/nhan-y-dinh.js mới cho cùng việc; BH6 P14 cũng “tạo” hàm ẩn tên và tệp tu-khoa-song.json. Gộp: không tạo nhan-y-dinh.js; nhận bằng mã ở nghiep-vu/nhan-binh-luan.js (bình luận) và hook phan-loai-tin.js (tin nhắn); từ khóa trong một tệp server/cau-hinh/tu-khoa.json; BH5 tạo live.daAnTen, BH6 dùng lại.
- Kiểm số lời Mai viết hai lần: BH6 thêm hàm soát trong kiem-tra.js, BH9 viết kiem-so-noi.js. BH6 tạo server/agent/kiem-tra/kiem-so-noi.js (soát sau buổi), BH9 mở rộng thành kiểm trên sóng hai mức. Cả hai dùng một hàm “giá bán lúc này” do BH7 F-93 tạo.
- BH6 P13 mặc định “gọi tên trơn tới khi P35 có danh sách xưng hô” — nhưng P35 nằm ở BH5 (trước BH6). BH6 dùng {xung} của F-75 ngay.
- Giả lập Facebook chưa gắn vào mốc nào: Meta giả (meta-gia.js, dung-tin.js, fetchMetaGia, hanh-vi-meta.json, test hợp đồng) phải là bước đầu BH5, trước F-65 (F-65 mở rộng gia.js). “Nền BH7” vì vậy chỉ còn thêm vài hành vi (nút số điện thoại, menu, video xem lại, Page bình luận, nút gọi). Cờ --ai-gia cho bản xem thử cũng phải ở BH5: scripts/xem-thu.js hiện nạp khóa AI thật từ .env, nên mọi lượt Claude Code tự lái đều tốn tiền nếu thiếu cờ này.
- Phát hiện của thiết kế giả lập chưa có chỗ: L8 (phong-live.js nhanBinhLuan không lọc nguoi_id = page_id → câu ghim “ví dụ chốt 12 đen M” của F-77 và mục lục của F-94 sẽ bị đọc thành chốt), L9 (that.js đặt tên “Người xem” khi thiếu from, tenGoi lấy chữ cuối → đọc “xem vừa chốt”), L13 (nhip-goi.js truocKhiGoi không xếp hàng, chờ quá toiDaChoMs thì lỗi). Thêm vào F-67, L8 phải xong trước F-77.
- Bỏ sót từ phiếu soi: kiem-6 [8] dòng “Đổi size trong N ngày” cố định trên Thanh chữ; kiem-7 [9] thẻ đơn có chính sách đổi trả (bán hàng từ xa); kiem-7 [5] trang chính sách quyền riêng tư (cần sớm cho xét duyệt ứng dụng); kiem-7 P15 bình luận thường giữ ngắn hạn; P14 bước 2 chưa có mốc. Đề xuất: khóa doi_tra_ngan ở F-95; nháp chính sách ở BH5; dọn bình luận không gắn đơn cùng nhịp 90 ngày của F-80; P14 bước 2 gộp F-100.
- Giới hạn 3 nút: BH5 F-69 nhắc lần 1 dùng [Xác nhận][Sửa][Không lấy]; BH7 đổi thẻ đơn thành [Nhận hàng trả tiền][Chuyển khoản][Sửa đơn] → nhắc sau BH7 sẽ cần 4 nút. Quy ước từ BH5: nhắc gửi thẻ đơn hiện hành + trả lời nhanh [Không lấy]; mẫu Utility “đang chờ xác nhận” giữ [Xác nhận][Sửa][Không lấy] (Xác nhận = theo cách trả đã chọn, mặc định COD). Thẻ hết hàng ở BH5 phải chừa 1 nút cho [Vẫn chờ] của BH7.
- Ngân sách: BH6 (P15/P12) và BH9 (P15) mỗi bên đề xuất một buổi GPT Live 1 3 phút (0,15 + 0,20 USD) — gộp một lần ở BH9 khi đã có đính chính. BH6 ghi “mặc định 0,01–0,03 USD OpenAI” vì bản xem thử gọi Tư vấn viên và khách giả thật; với --ai-gia và khách soạn sẵn thì là 0.
- Thứ tự trong BH5: báo cáo dặn P24a (giữ ngắn) nên sau P01 vì khách “im” có thể do Tin nhắn chờ; thiết kế làm F-68 (P24a) trước F-70 (P01). Chấp nhận vì cùng một mốc và chưa live thật trước tag; ghi luật: không dùng giữ ngắn cho buổi thật nào khi F-70 chưa chạy.
- BH5 F-69 thêm “quá 12 giờ gia hạn không ai xử lý thì hủy như thường”, trong khi báo cáo viết “để người quyết”. Giữ (tránh khóa hàng mãi) nhưng đưa vào câu hỏi chủ dự án.
- BH8 F-101 thêm danh mục 34 tỉnh và tách tỉnh — đây là một mẩu của P30 (báo cáo xếp để sau). Giới hạn: chỉ tỉnh + cờ “Cần sửa địa chỉ”, không tự đổi địa chỉ, không chuẩn hóa xã.
- BH8 F-98 làm bộ mẫu Utility trong khi báo cáo 6.4 ghi “Bộ tin theo trạng thái (P25) chỉ làm cùng C”. Hợp lệ khi giới hạn đúng phần không cần hãng (đã xác nhận, đã gửi, chuẩn bị gửi, hỏi mặc) — tin “hôm nay giao/chưa giao được” vẫn để sau.
- SPEC hiện có chỗ cũ cần sửa khi ghi 3.4: BAN-GIAO.md dòng 117 “quyết định mới đánh tiếp từ #87” (nay #127), dòng 141 “vượt trần tự bật Dừng mọi tự động”; SPEC mục 8 ghi GET /don/xuat nhưng mã là /don/xuat.csv; SPEC mục 7 liệt kê viec.loai thiếu nhac_thong_tin_giao, hoi_tham (khach.js:21); SPEC mục 3 “Để sau” còn F-59 dù #90 đã làm; “Ngoài phạm vi” còn “giá riêng từng phân loại” dù F-51 đã có.
- Đánh số trong các thiết kế là số tạm và chồng nhau (BH5 dùng #91–#103, các mốc khác “đánh sau”). Nháp này đánh lại một lượt: quyết định #91–#126, tính năng F-65–F-107, tệp nâng cấp 018–022 theo thứ tự làm.

## Tệp nâng cấp dữ liệu

- 018-khong-roi-don.sql — BH5 (F-65, F-66, F-67, F-68, F-69, F-73): bảng luot_nhan_rieng (fb_comment_id PK, page_id, boi TEXT không CHECK, binh_luan_id, hoi_thoai_id, trang_thai CHECK giu/da_gui/loi, luc) + điền lại từ tin_nhan loại nhan_rieng; bảng lien_he (id, nguoi_fb_id, don_id, phien_live_id, loai TEXT không CHECK, luc, chỉ mục theo người và đơn); bảng nhan_bu (fb_comment_id, binh_luan_id, don_id, page_id, han_luc, trang_thai CHECK cho/da_gui/bo/het_han, ly_do, tao_luc, xu_ly_luc); bảng anh_fb (page_id, tep, attachment_id, tai_luc, PK(page_id, tep)); cột nguoi_fb.ngung_lien_he_luc; don.khach_bam_luc, nhac_lan (DEFAULT 0), nhac_cuoi_luc, bao_huy_luc, gia_han_goi_luc; phien_live.fb_video_id, fb_link, bat_dau_fb. Không đổi CHECK cũ. Khóa cai_dat mới (dung_ai, lien_he, fb_mau_utility dạng bộ, ban_hang.gio_giu_ngan/phu_trach/xung_ho/ten_chu_tk, san_sang_tich) không cần SQL.
- 019-tren-song.sql — BH6 (F-80, F-81): bảng nhat_ky_song (id nk_…, phien_id, luc, loai không CHECK: mai/doi_ai/nguoi_dan/man_hinh/su_kien, noi_dung, san_pham_id, canh_bao, chỉ mục (phien_id, luc)); UPDATE san_pham.video bằng json_each + json_set thêm dung_thu = true cho mọi video đang có (14 video dựng thử ở data/moza.db và data/xem-thu — Claude Code kiểm danh sách trước khi chạy). Skill go-luong-lu vào bằng gieoSkill đã sửa, không cần SQL. Tự sao lưu trước như mọi lần nâng.
- 020-khep-kin-don.sql — BH7 (F-88 → F-94): cột don.sdt_goi_y, hoi_gop_luc, goi_y_phoi_luc, gop_vao; bảng cho_hang (id, phan_loai_id, so_luong, nguoi_fb_id, hoi_thoai_id, phien_live_id, binh_luan_id, trang_thai không CHECK, bam_luc, moi_luc, don_id, dien_tap, tao_luc; chỉ mục (phan_loai_id, trang_thai, bam_luc)); cột khach.chieu_cao_cm, can_nang_kg, so_do_luc, so_do_hoi_luc (không dùng bo_nho vì bo_nho.loai có CHECK); phien_live_san_pham.gia_live; don_dong.gia_thuong; phien_live.xem_lai_con_tro, muc_luc_luc, muc_luc_fb_id; agent tu_van thêm công cụ gui_ma_chuyen_khoan (json_insert như 016).
- 021-truoc-sau-live.sql — BH8 (F-95 → F-104): bảng dong_y_nhan_tin (id, page_id, nguoi_fb_id, hoi_thoai_id, buoi, cau_hoi nguyên văn, tin_hoi_id, tra_loi, tra_loi_luc, tin_tra_loi_id, rut_luc, nhac_luc, nhac_tin_id, dien_tap, tao_luc, UNIQUE(nguoi_fb_id, buoi)); bảng anh_khach (…, cau_xin_phep, dong_y_luc, che_mat, duyet_luc, go_luc, dien_tap); cột don.hoi_lai, hoi_lai_luc, hoi_mac_luc, phan_hoi_mac, phan_hoi_mac_luc; phien_live.tong_ket; INSERT agent soan_bai và tong_ket (gpt-6-luna, dự phòng gemini-3.5-flash-lite); agent quan_ly thêm dat_ban_hang, ghi_so_tay. KHÔNG thêm nguoi_fb.dung_nhan_tin_luc (dùng ngung_lien_he_luc của 018).
- 022-thu-nghiem-ai.sql — BH9 (F-105 → F-107): bảng loi_noi_song (id, phien_live_id, luc, cau ≤300 ký tự, loai, muc, san_pham_id, phan_loai_id, gia_tri_noi, gia_tri_dung, dinh_chinh_luc, het_khoang_luc, model, dien_tap); bảng don_danh_dau (id, don_id, loai, loi_noi_id, chi_tiet JSON, trang_thai, xu_ly, tao_luc, xu_ly_luc); INSERT agent nhin_mon (gpt-6-luna, suy nghĩ tắt, không dự phòng, nang_cap '{}', gioi_han 1 bước / 8 giây).

## Bản đồ P01–P44

- **P01**: BH5 · F-70 (nhắc trên sóng trung tính, nhắc cách chốt theo tình huống, bắt “ib”, link m.me có ref + nút Bắt đầu — phần 4 làm luôn theo lệnh “Facebook cứ làm”, kiểm lại ở Bước 0 B0-15) + “ẩn tên” ở F-66
- **P02**: BH5 · F-71 (câu hỏi có ý mua → thẻ mời giữ một chạm, không tự giữ hàng; tách timMon khỏi docChot, chạy lại 105 câu)
- **P03**: BH7 · F-94 (bán sau live 7 ngày: webhook + tự hỏi 10 phút, chỉ nhận chốt có số món, giá hiện tại, bình luận mục lục của Page không giá không tên)
- **P04**: BH5 · F-73 (mã 10/1893063 → FB_PAGE_BI_CAM_NHAN ở F-67; báo đỏ, dừng nhắc, câu gom riêng, danh sách Nhắn bù người quyết; KHÔNG gia hạn giữ 48 giờ)
- **P05**: BH5 · F-78 bản nhỏ (nút mở cuộc trò chuyện trong Business Suite khi quá 24 giờ). Thẻ HUMAN_AGENT: để sau — cần xét duyệt quyền Human Agent + xác minh doanh nghiệp
- **P06**: BH5 · F-69 (2 nhắc + 1 báo hủy có Đặt lại trong 24 giờ, mẫu Utility “đang chờ xác nhận” chỉ khi Meta xếp UTILITY, đơn đủ thông tin hết giờ → Gọi xác nhận gia hạn 12 giờ một lần, sửa lỗi việc “Gọi khách” khi không có số)
- **P07**: BH5 · F-77 (bảng Sẵn sàng lên sóng: chỉ dòng đỏ/vàng máy tự kiểm, phép thử “chốt test”, 3 ô tích, câu ghim + câu mô tả có nút Chép) — làm cuối BH5 vì gom trạng thái mọi phần
- **P08**: BH8 · F-103 bản đơn giản (mốc từng món từ dòng thời gian, đoạn 45 giây tránh tên khách, chú thích máy điền không giá, nhắc Hoãn xóa 6 tháng); bỏ phần chấm “khoảnh khắc”
- **P09**: BH8 · F-96 bước 1 (lịch live cố định, agent soan_bai viết bài báo trước, link Zalo, nhắc quảng cáo). Bước 2 (MOZA lên lịch, tự bấm phát): không làm — 6.5 cách A
- **P10**: BH8 · F-97 (6.3 A+B: xin đồng ý từng buổi, chỉ nhắn trong 24 giờ, bảng dong_y_nhan_tin). Phần DỪNG: BH5 F-66; phần Xóa dữ liệu: dời lên BH7 F-88 (menu cần). 6.3 C Zalo OA: để sau
- **P11**: BH6 · F-81 (thẻ nhắc người dẫn khi khách xin xem; cờ dung_thu cho 14 video dựng thử, buổi thật không chiếu)
- **P12**: BH6 · F-84 (Director gắn luong_lu, ≥2 người cùng kiểu → giao_cohost Skill go-luong-lu; không nguồn thì im; sửa gieoSkill)
- **P13**: BH6 · F-82 (tư vấn size tính bằng mã, gọi tên theo {xung}, số đo người mẫu bằng lời, nguồn nguoi_mau, bỏ dòng in số đo khách trên Màn hình sản phẩm). Ý “đưa gợi ý size vào thẻ giữ hàng” của kiem-6: để sau (chỉ khi có số đo khách đã đồng ý lưu, F-91)
- **P14**: Bước 1: BH6 · F-83 (N người chốt từ 5, cảm ơn cuối buổi, sửa số 5 cứng). Bước 2 (“X/Y khách nói vừa”, từ 10 phản hồi): BH8 · gộp vào F-100 sau P27
- **P15**: Phần rẻ: BH6 · F-80 (nhật ký chỉ chữ 90 ngày, luật “Mai không tự nói con số”, soát sau buổi). Bản đầy đủ: BH9 · F-105 (kiểm lời Mai + đính chính) và F-106 (giữ giá có lợi cho khách)
- **P16**: BH6 · F-85 (dòng số liệu, “Tiếp theo”, tối đa 1 gợi ý nhịp). Bỏ ô tích ý đã nói và nhịp tự động cho Mai dẫn (mục 7 báo cáo)
- **P17**: Cách A: BH6 · F-86 (đếm A/B bằng mã, ≤2 lần/buổi, không quà). Cách B (Live Polls API): không làm
- **P18**: BH7 · F-93 (6.1 B “giá live tới hết buổi”, TẮT mặc định, bật sau khi luật sư xem; người xem lại không hưởng). Cách C giờ vàng có đồng hồ: không làm
- **P19**: BH7 · F-88 (tin xin thông tin do mã soạn, số điện thoại tự điền, Như đơn trước, Gọi shop, menu Đơn của tôi / Gặp người thật / Xóa dữ liệu)
- **P20**: BH7 · F-91 (nhãn khách quen chỉ người dẫn thấy, size quen từ đơn đã giao; số đo chỉ lưu khi khách bấm đồng ý, công tắc TẮT mặc định)
- **P21**: Bước 1: BH7 · F-89 (6.2 A: thẻ đơn Nhận hàng trả tiền / Chuyển khoản / Sửa, ảnh VietQR, người tự bấm Đã nhận tiền). Bước 2 (payOS/SePay): để sau — khi đối chiếu tay thành gánh nặng
- **P22**: BH5 · F-68 (thẻ giữ hàng do mã soạn 0 AI, có câu tự nhận AI; ảnh theo thứ tự image_url qua đường ảnh hẹp → attachment → thẻ chữ)
- **P23**: BH7 · F-90 (thêm X nữa là miễn ship, 1 món phối, gộp/tách đơn giữa hai buổi, sửa lỗi đơn Đã xác nhận bị đổi món không về Chờ xác nhận)
- **P24**: P24a (giữ hai mức): BH5 · F-68. Bước 2 (danh sách chờ): BH7 · F-92
- **P25**: Phần không cần hãng: BH8 · F-98 (bộ mẫu Utility trạng thái đơn, tin trạng thái do máy soạn). Tin theo trạng thái hãng (hôm nay giao…) + Zalo ZBS: để sau cùng 6.4 C / 6.3 C
- **P26**: BH8 · F-99 (máy đánh dấu “Nên hỏi lại” chỉ từ lịch sử đơn của shop, người quyết, không chữ “rủi ro”, không xin cọc)
- **P27**: BH8 · F-100 bước 1 (hỏi thăm 4 ngày sau gửi, 3 nút, trích Sổ tay đổi trả, việc cho chủ shop). Đơn đổi size tự động: để sau
- **P28**: BH8 · F-104 (khách mặc thật, TẮT mặc định, xin phép bằng nút, che mặt, người duyệt, gỡ được)
- **P29**: BH8 · F-101 (6.4 B xuất file đúng mẫu hãng). Cách C (nối thẳng, F-60): để sau
- **P30**: Để sau — làm cùng 6.4 C. BH8 chỉ tách tỉnh (danh mục 34 tỉnh QĐ 19/2025) + cờ “Cần sửa địa chỉ” cho file xuất, không tự sửa địa chỉ
- **P31**: BH8 · F-95 (2 công cụ dat_ban_hang, ghi_so_tay luôn qua bảng xem trước; Tổng quan kiểm 8 mục; thêm khóa doi_tra_ngan)
- **P32**: BH8 · F-102 (phễu do mã đếm, ≤3 gợi ý AI từ số liệu gộp, dùng lại soLieuPhien/demNguoiChot của BH6)
- **P33**: Không làm (mục 7): khi kê khai thì xuất danh sách đơn ra file và hỏi kế toán
- **P34**: P34a giá gạch có bằng chứng: BH5 · F-76. Danh sách từ cấm K11: BH6 · F-79
- **P35**: BH5 · F-75 (bắt buộc trước live thật: nhãn “Trợ lý AI · Phụ trách”, không nút tắt, xưng hô chọn từ danh sách, câu mô tả buổi live; chốt bố cục Thanh chữ chung)
- **P36**: Để sau — chờ luật sư trả lời Luật 91/2025 Điều 20 (#18); nếu phải che thì mã bắt số ghi thẳng vào đơn, AI chỉ thấy “[đã nhận SĐT]”
- **P37**: Không làm (mục 7) — thay bằng ảnh thật trên hai dáng người + số đo (việc chủ dự án)
- **P38**: BH9 · F-107 (MOZA nhìn nguồn camera OBS, chỉ gợi ý chuyển món, tắt mặc định; thay F-64/#82)
- **P39**: Không làm (bị bác) — xem lại khi có số chi phí thật từ F-102
- **P40**: Không làm (mục 7) — thay bằng video điện thoại 15 giây mỗi màu
- **P41**: Không làm (mục 7) — cần người trực, hạn mức giọng Google, luật sư
- **P42**: BH5 · F-72 (tách Dừng AI tự bật khi vượt trần / Dừng mọi thứ chỉ người bấm, cảnh báo 80%, trần ngày có live 20 USD) — làm trước F-68
- **P43**: BH5 · F-74 (ẩn bình luận có STK/link lạ của người không phải Page; dòng “Shop chỉ nhận tiền vào TK tên…” ở thẻ đơn và câu ghim; ô ten_chu_tk)
- **P44**: BH6 · F-87 (từ riêng ≤100 theo ưu tiên cho phần nghe người dẫn; giá gemini-3.5-transcribe-live 3,5/21 là đúng bản Live, không sửa)
- **Việc nền: đánh dấu lượt nhắn riêng**: BH5 · F-65 (bảng luot_nhan_rieng, giữ lượt trước Director)
- **Việc nền: bộ đọc nút dùng chung**: BH5 · F-65 (nut-bam.js + xu-ly-nut.js; BH7, BH8 chỉ đăng ký thêm loại nút)
- **Việc nền: Hook giới hạn liên hệ**: BH5 · F-66 (một cột ngung_lien_he_luc, lien-he.js, muc_dich gồm cả cham_soc cho BH8)
- **Việc nền: trần câu chen Đội AI**: BH5 · F-67 (60 câu/buổi; chenBanHang mỗi khóa một nhãn)
- **Việc nền: giờ bắt đầu live do Facebook trả về**: BH5 · F-67 (cột bat_dau_fb, fb_video_id, fb_link; bat_dau = bat_dau_fb khi có)
- **Việc nền: quyền page_utility_messaging**: BH5 · F-67 (QUYEN_CAN; sửa chữ “Meta duyệt khoảng 24 giờ” 4 chỗ)
- **Việc nền: bảng giá model**: BH5 · F-67 (khối giá từ 1/1/2027 cho Gemini 3.8 Live/Flash/TTS + giá phần hình; chi-phi.js chọn theo ngày)
- **Bước 0 (buổi thử Facebook thật)**: Để sau, lúc chủ dự án có Page — không chặn code (#92). Trong lúc chờ test bằng Meta giả (F-15 mở rộng, BH5). Khác giả lập thì sửa that.js + gia.js + hanh-vi-meta.json
- **Dồn tải 30–50 chốt/phút**: BH5 · kịch bản “40 chốt/60 giây” + test/dien-tap-tai.test.js (50 chốt/phút, qua lớp that.js với header mức dùng)
- **Phát hiện giả lập L8 (bình luận của chính Page bị đọc thành chốt)**: BH5 · F-67 — bắt buộc trước F-77 (câu ghim) và F-94 (mục lục)
- **Phát hiện giả lập L9 (tên “Người xem” → đọc “xem vừa chốt”, đếm nhầm người)**: BH5 · F-67 (không đọc tên, hiện “Một bạn”, không đếm là người chốt)
- **Phát hiện giả lập L13 (nhịp gọi không xếp hàng)**: BH5 · F-67 (xếp hàng thật; thẻ gặp giới hạn gọi vào hàng gửi lại trong 7 ngày)
- **kiem-7 [5] trang chính sách quyền riêng tư**: BH5 · Claude Code soạn nháp (cần cho xét duyệt ứng dụng); chủ dự án chọn chỗ đặt, luật sư duyệt
- **kiem-6 [8] dòng “Đổi size trong N ngày” trên Thanh chữ + kiem-7 [9] chính sách đổi trả trong thẻ đơn**: BH8 · F-95 (khóa doi_tra_ngan, hiện trên Thanh chữ và trong thẻ đơn khi còn chỗ)
- **kiem-7 P15: bình luận thường giữ ngắn hạn**: BH6 · F-80 (cùng nhịp dọn 90 ngày: bình luận không gắn đơn quá hạn thì xóa nội dung và tên, giữ số đếm)
- **kiem-7 [0] khóa AI riêng đã bật trả tiền; kiem-8 [2]/kiem-9 [1] gom quyền một lần xét duyệt; kiem-9 [2] Page 100 người theo dõi**: Việc chủ dự án (mục 8 báo cáo), Claude Code viết hướng dẫn
- **Meta Live Shopping Tools, Marketing Messages, Muse, Gemini Live Avatar**: Theo dõi, chưa dùng được (ghi ở Để sau)

---

## BH5 — Không rơi đơn (nền chung + chốt đơn qua Messenger)

**Định nghĩa xong:** - npm test đạt toàn bộ: 537 test cũ (đã sửa theo luật mới ở chot-don, don, hop-thu-don, the-don, dien-tap-ban-hang, doi-ai-dan, runtime) cộng khoảng 14 tệp test mới. Không gọi AI hay Facebook thật trong npm test.
- Trên bản xem thử (cổng 5190, Facebook giả, khách soạn sẵn, không gọi AI):
  - kịch bản 40 người chốt trong 60 giây → 40 thẻ giữ hàng do mã soạn, mỗi thẻ ≤ 3 giây, 0 lần bán quá tồn, 0 lượt AI cho tin đầu;
  - bấm [Giữ, lên đơn] / [Đổi] / [Không lấy] / [Đặt lại] / [Giữ cho mình] đều chạy đúng;
  - tua thời gian thấy đủ 2 lần nhắc, tin báo hủy, danh sách "Gọi xác nhận";
  - ib, ẩn tên, m.me ref, chốt test, Page bị khóa và nhắn bù, bình luận STK bị ẩn đều chạy đúng;
  - vượt trần chi phí giả → "Dừng AI" bật, chốt đơn vẫn chạy.
- Có ảnh chụp: Thanh chữ có nhãn "Trợ lý AI · Phụ trách", bảng Sẵn sàng lên sóng, dải vàng 80%, khung chat giả có thẻ ảnh.
- SPEC.md đã sửa trước khi code: #91 trở đi, F-65 → F-78, Luồng 3, #64, #65, F-32, F-52, F-53, mục 6 (ngày tra), 7, 12 (kết quả, chi phí), 13 (câu Bước 0 mới). BAN-GIAO.md sửa dòng "vượt trần tự bật Dừng mọi tự động".
- Commit và tag `bh5-khong-roi-don`. Chi phí AI thật ≤ 0,05 USD OpenAI (hoặc 0), Google 0.
- Dừng để chủ dự án duyệt. Buổi thử Facebook thật (Bước 0) để sau, lúc có Page; khác giả lập thì chỉ sửa that.js và gia.js rồi chạy lại test.

**Thứ tự:**
- 0. Đầu mốc, 0 đồng: Claude Code tra tài liệu mới nhất và ghi ngày tra vào SPEC mục 6. Gồm Meta Send API (generic template, lưới ảnh, media template, attachment_id, quick reply trong nhắn riêng, messaging_referrals, postback.referral, Messenger Profile get_started), mẫu Utility (nút, cách Meta xếp loại), Page Integrity API, mã lỗi 10/1893063, link Business Suite, trang giá Gemini, OpenAI. Rồi sửa SPEC theo phần đã duyệt: #91 trở đi, F-65 → F-78, Luồng 3, #64, #65, F-32, F-52, F-53, mục 7, 12, 13, danh sách câu Bước 0. Lý do: SPEC sửa trước, code sau; tài liệu mới có thể đổi cách gửi ảnh.
- 1. F-67 sửa nền và F-65 nền chốt đơn, chung một tệp nâng cấp. Lý do: mọi tính năng sau dựa vào lượt nhắn riêng, bộ đọc nút, đường gửi thẻ qua hook và hợp đồng Facebook mở rộng; phần sửa nền nhỏ, độc lập, giảm rủi ro sớm.
- 2. F-76 (giá gạch) và F-75 (nhãn AI). Lý do: nhỏ, không phụ thuộc gì, lại là điều pháp lý bắt buộc trước live thật; làm sớm để có ảnh chụp gửi luật sư.
- 3. F-66 Hook giới hạn liên hệ. Lý do: phải có trước khi thêm bất kỳ tin nhắc hay lần gọi tên nào.
- 4. F-72 tách Dừng AI / Dừng mọi thứ. Lý do: để thẻ giữ hàng không bị công tắc chi phí chặn ngay khi vừa làm xong; nhiều chỗ sửa máy móc, làm gọn một lần.
- 5. F-68 thẻ giữ hàng + giữ hai mức, kèm kịch bản 40 chốt/60 giây và khách soạn sẵn. Lý do: lõi của mốc; F-69, F-70, F-71, F-73 đều dùng thẻ và nút của nó.
- 6. F-69 nhắc đơn / báo hủy / Gọi xác nhận. Lý do: cần giữ hai mức và nút; thử trọn bằng tua thời gian.
- 7. F-70 nhắc trên sóng + ib + m.me. Lý do: cần hàng chờ phản hồi (thẻ đã gửi), trần câu chen và thẻ món đang nói.
- 8. F-71 câu hỏi có ý mua. Lý do: sửa docChot có rủi ro nên làm khi thẻ đã ổn, rồi chạy lại đủ 105 câu.
- 9. F-73 Page bị khóa + nhắn bù, F-74 chống giả shop, F-78 nút Business Suite. Lý do: độc lập, nhỏ, dùng lại thẻ và hook đã có.
- 10. F-77 bảng Sẵn sàng lên sóng. Lý do: gom trạng thái của mọi phần trên (Dừng AI, Page bị hạn chế, quyền, câu ghim có TK và m.me).
- 11. Kiểm cuối, 0 đồng AI:
- npm test (TEMP = data\tam-test, Node 26);
- bản xem thử preview "moza" cổng 5190: chạy kịch bản 40 chốt/60 giây, ib, ẩn tên, lừa đảo, chốt test, Page bị khóa, tua thời gian;
- Claude Code tự lái trình duyệt bấm nút trong khung chat giả, chụp màn hình Thanh chữ, bảng Sẵn sàng, dải vàng;
- đọc nhật ký tự chấm (0 lượt AI cho tin đầu, không câu nào "chưa trả lời").
- 12. Tùy chọn, báo trước chi phí: 1 lượt Luồng 3 với gpt-6-luna thật (khoảng 0,02–0,05 USD) để xem Tư vấn viên nối tiếp sau thẻ do mã soạn. Sau đó ghi kết quả vào SPEC mục 12, sửa BAN-GIAO.md, commit và tag `bh5-khong-roi-don`, dừng để chủ dự án duyệt. Gửi kèm danh sách việc chủ dự án và phiếu Bước 0 cập nhật.

**Chi phí thử thật:** - OpenAI: 0 USD bắt buộc. Tùy chọn 1 lượt Luồng 3 bằng gpt-6-luna trên bản xem thử, khoảng 0,02–0,05 USD, báo trước khi chạy.
- Google (Gemini, TTS, Live): 0. Không gọi. Trần câu chen và nhắc trên sóng thử bằng TTS giả, miệng giả.
- Anthropic: 0.
- Tổng mốc ≤ 0,05 USD, trong ngân sách OpenAI dưới 1 USD của cả đợt.
- Toàn bộ thẻ, tin nhắc, câu gom, câu ghim, nhãn do mã soạn, nên khi chạy thật cũng 0 đồng cho mỗi người chốt (trước đây tin đầu tốn 1 lượt AI).

**Ghi chú khi đọc mã:** PHÁT HIỆN KHI ĐỌC MÃ (đã kiểm bằng Read/Grep):
1. `coTheNhanRieng` có ở that.js:185 và gia.js:237 nhưng không nơi nào gọi, nên hiện MOZA không đọc can_reply_privately trước khi nhắn riêng.
2. `gui-the-don.js` (guiTheDon, guiTinHeThong, guiUtilityDaGui) gọi Facebook thẳng, bỏ qua hook hop_thu_gui, luat_quyen và Bộ kiểm tra; chỉ tự kiểm khanCap. Vì vậy phải đưa qua `gui_the_moza`.
3. hop-thu.js:263–266 tạo việc loại 'nhac_thong_tin_giao' với chữ "Gọi khách…" cả khi đơn chưa có số điện thoại (đúng lỗi báo cáo nêu).
4. `canHoiTham` và `tangHoiTham` (nghiep-vu/hop-thu.js:409, 419) không nơi nào gọi và không có test. Kế hoạch bỏ hai hàm, đưa ý của chúng vào mốc nhắc lần 2.
5. `timLiveDangPhat` (that.js:62) đã trả `bat_dau = creation_time`, nhưng `live.ganLive` (live.js:122) ghi giờ máy và dùng luôn giờ này cho đoạn đầu của dòng thời gian.
6. `laBaiLive` (nghiep-vu/hop-thu.js:394) chỉ so id LiveVideo. Nó còn bỏ mọi bình luận trên video của MỌI phiên đã xong, tức bình luận chốt khi xem lại bị bỏ hẳn; đây là phần của P03.
7. `chenBanHang` (dan-doi.js:964) gán mọi khóa lạ vào nhãn "nhắc cách chốt" rồi đè câu cùng nhãn. `nhac_cach_chot` chỉ test gọi (test/doi-ai-dan.test.js:252).
8. Giá gốc lộ ở 2 chỗ: màn hình (man-hinh-san-pham.js:73) và thẻ cho AI (san-pham.js:562). Phải chặn cả hai.
9. gio_giu (24 giờ) được dùng ở 3 chỗ trong don.js: taoDon:142, doiTrangThai:322, hoanTac:373.
10. Vượt trần hiện được phát thành 'khan_cap' ở khoảng 10 nơi (runtime.js:263, mieng.js:971, chep-loi-nguoi-dan.js:252, dan-doi.js:261, tieng-gia.js:73, api/doi-ai.js:20, api/giong-mai.js:17…).
11. binh_luan_live.xu_ly, tin_nhan.loai, don.trang_thai có CHECK, nên mọi dữ liệu mới đặt bằng bảng hoặc cột mới, không thêm giá trị vào các cột này.
12. Khóa cai_dat 'fb_mau_utility' hiện chỉ chứa một mẫu.
13. Chữ "Meta duyệt khoảng 24 giờ" còn ở 4 chỗ.
14. Đã có nút "DỪNG AI" theo phiên (phongAi.dungAi), dễ nhầm với trạng thái "Dừng AI" mới.
15. Thanh chữ đã có ở mọi cảnh OBS (obs.js:141–148), nên nhãn AI chỉ cần đặt ở thanh-chu.html.

XUNG ĐỘT VỚI MỐC KHÁC:
- P03 (xem lại 7 ngày): đổi laBaiLive cho video đã xong; dùng thẻ giữ hàng ("giá hiện tại"), luot_nhan_rieng, creation_time. BH5 giữ nguyên hành vi "bỏ", P03 sửa sau.
- P14 và P16 cùng sửa thanh-chu.html và Màn hình người dẫn (nguoi-dan.js) với P35 và P01. P14 còn sửa số 5 cứng ở public/js/man-hinh-san-pham.js:45.
- P19: menu cố định của Messenger và nút tự điền số điện thoại dùng cùng Messenger Profile API với nút "Bắt đầu" (F-70). Phải gửi get_started và persistent_menu chung, tránh đè nhau.
- P21 (6.2 A, mã QR): dùng lại ô `ten_chu_tk` của F-74, chỉ thêm ngân hàng và số tài khoản. Thẻ đơn 640 ký tự dùng chung với dòng TK (P43) và dòng "thêm X nữa là miễn ship" (P23).
- P24 bước 2 (danh sách chờ): dựng trên giữ hai mức và bộ đọc nút ([Vẫn chờ]).
- P27 và 6.3 B: dùng lại kho nhiều mẫu Utility, Hook giới hạn liên hệ (moi_chao ≤ 1/ngày) và ngung_lien_he_luc ("gõ DỪNG").
- P20: thẻ "Lấy M như lần trước?" dùng lại lưới và trả lời nhanh.
- P13, P11, P12: tốn câu chen, nên theo trần câu chen của F-67.
- P31: kiểm 8 mục, trong đó người phụ trách, xưng hô, tài khoản nhận tiền là các ô tạo ở mốc này.
- P32: phễu đơn dùng dữ liệu lien_he, luot_nhan_rieng, nhan_bu.
- P44: cùng sửa gia-model.json (giá transcribe 3,5 / 21 so với 2 / 12). Nên kiểm luôn khi sửa bảng giá ở F-67 nếu mốc P44 chưa làm.
- Đánh số #91–#103 và F-65–F-78 là số tạm cho BH5, giả định BH5 làm trước. Tệp nâng cấp gợi ý 018-khong-roi-don.sql; số thật đặt lúc làm.

CẦN HỎI CHỦ DỰ ÁN (có mặc định, không chặn việc code):
(1) Giữ ngắn cho người chưa bấm là hết live + 2 giờ: được không?
(2) Trần ngày có live 20 USD: được không?
(3) Tên người phụ trách, cách xưng hô, tên chủ tài khoản nhận tiền.
(4) Khi "Dừng AI", tin khách gõ chữ vào Cần người kèm 1 câu báo nhận: đồng ý không?
(5) "Gọi xác nhận" gia hạn 12 giờ một lần: được không?
(6) Nút "Bật nút Bắt đầu cho Page" do chủ shop bấm (là đổi cài đặt Page).
(7) Chỉ ghi "còn N" khi N ≤ ngưỡng sắp hết.

NHỜ LUẬT SƯ XEM:
- Chữ nhãn "Trợ lý AI · Phụ trách".
- Câu tự nhận AI trong thẻ.
- Nhịp nhắc 2 lần + báo hủy.
- Thẻ đơn cần những thông tin gì theo luật bán hàng từ xa.

THÊM VÀO PHIẾU BƯỚC 0 (Facebook thật): mẫu nào nhận attachment_id; quick reply và lưới ảnh có gửi được qua nhắn riêng không; mẫu Utility có nút postback có được duyệt là UTILITY không; ref m.me trên Android; Page Integrity trả gì; link Business Suite có mở đúng hội thoại và có cho trả lời tới 7 ngày không; tin thẻ rơi vào hộp chính hay Tin nhắn chờ.

KHÔNG THÊM THƯ VIỆN: không cần. SQL chỉ đặt trong server/nghiep-vu/ và server/db/. Mọi lệnh gọi Facebook đi qua hợp đồng chung; hàm mới có đủ ở that.js và gia.js.

### F-65 Nền chốt đơn: một lượt nhắn riêng, một bộ đọc nút, một đường gửi thẻ

*Đề xuất: Nền: đánh dấu lượt nhắn riêng, Nền: bộ đọc nút dùng chung, Nền: một đường gửi tin do mã soạn · công sức: vua*

- Bảng mới `luot_nhan_rieng` (khóa = id bình luận): muốn nhắn riêng một bình luận thì phải "giữ lượt" trước bằng một câu INSERT OR IGNORE. Ai giữ trước người đó gửi, các đường khác bỏ. Việc giữ lượt đặt trong `PhongLive.nhanBinhLuan` (server/phong-live.js), ngay sau cửa `khi_tin_den`, TRƯỚC `chotDon.xuLy` và Director.
- Loại lượt: the_giu_hang, the_chon_mau, the_moi (P02), the_ib (P01), tu_van (Tư vấn viên), nhan_bu (P04), chot_test (P07). Gửi lỗi thật (không phải "không rõ") thì trả lượt (trạng thái 'loi') để còn nhắn bù.
- Director và Hộp thư đọc cùng bảng: `phong-ai.js lamTheoPhieu` bỏ khỏi `chuyen_tu_van_ids` các bình luận đã có lượt; `hop-thu.js nhanChoTuVan` bỏ qua; hook `hop-thu-gui.js` (DA_NHAN_RIENG) xét bảng này, cộng với kiểm cũ theo tin_nhan.
- Bộ đọc nút `server/nghiep-vu/nut-bam.js`: một bảng mô tả mọi loại nút (mã, các phần, hạn dùng). Có `taoPayload(loai, …)` và `docPayload(chuoi)`, payload ≤ 1000 ký tự. `the-don.js docPayload` gọi sang, vẫn đọc được XAC_NHAN_DON| và SUA_DON|. Loại mới: GIU_LEN_DON, DOI_MON, DOI_PL, KHONG_LAY, CHON_PL, GIU_MOI, XEM_MAU_KHAC, DAT_LAI, DUNG_NGUOI, KHONG_PHAI.
- Xử lý nút ở một nơi: `server/xu-ly-nut.js` (bảng loại → hàm); `server/hop-thu.js xuLyNut` chỉ gọi sang. Mọi nút đều kiểm "đơn có phải của người bấm" như `xacNhanBangNut`.
- Trả lời nhanh (quick reply) được coi như nút: `su-kien.js` đọc `message.quick_reply.payload` thành sự kiện 'postback' có `nguon: 'tra_loi_nhanh'`.
- Một đường gửi cho mọi tin do mã soạn: công cụ nội bộ `gui_the_moza` (nhóm co_anh_huong, có kenhGui, không cấp cho Agent nào). Công cụ đi qua `thucHienCongCu` nên qua đủ hook khan_cap, luat_quyen, hop_thu_gui và gioi_han_lien_he (F-66). `gui-the-don.js` (guiTheDon, guiTinHeThong, guiUtilityDaGui) chuyển sang đường này; hiện ba hàm gọi fb thẳng, bỏ qua mọi hook.
- Hợp đồng Facebook (giao-dien.js, that.js, gia.js) thêm: taiAnhLen, nhanRiengThe (thẻ gửi theo comment_id), guiTheSp (thẻ gửi theo psid), guiLuaChon (chữ + trả lời nhanh). `nhanRiengThe` luôn hỏi `coTheNhanRieng` trước; hàm này đã có ở that.js:185 nhưng chưa nơi nào gọi.

**Tiêu chí:**
- [ ] Cùng một bình luận vừa là chốt vừa bị Director đưa vào chuyen_tu_van → Facebook giả chỉ nhận 1 tin, nhật ký không có lỗi DA_NHAN_RIENG
- [ ] Test the-don cũ (XAC_NHAN_DON|…, SUA_DON|…) vẫn đạt nguyên
- [ ] Bấm nút mang id đơn của người khác → đơn không đổi, khách nhận câu trả lời lịch sự
- [ ] guiTheDon khi "Dừng mọi thứ" đang bật → tạo mục chờ duyệt (không âm thầm bỏ như hiện nay)
- [ ] Gửi lỗi FB_LOI → lượt trở về 'loi', nhắn bù giữ lại được lượt đó
- [ ] npm test: toàn bộ 537 test cũ đạt

**Tệp sửa:** `server/phong-live.js`, `server/phong-ai.js`, `server/hop-thu.js`, `server/gui-the-don.js`, `server/nghiep-vu/the-don.js`, `server/nghiep-vu/nut-bam.js (mới)`, `server/xu-ly-nut.js (mới)`, `server/nghiep-vu/luot-nhan-rieng.js (mới)`, `server/agent/cong-cu/gui-the-moza.js (mới)`, `server/agent/cong-cu/danh-sach.js`, `server/agent/hook/hop-thu-gui.js`, `server/facebook/giao-dien.js`, `server/facebook/that.js`, `server/facebook/gia.js`, `server/facebook/su-kien.js`, `server/nghiep-vu/dien-tap-ban-hang.js (tua thời gian thêm cột mới)`, `server/db/nang-cap/0NN-khong-roi-don.sql (mới; gợi ý 018 nếu BH5 làm trước)`

**Dữ liệu:** Bảng mới `luot_nhan_rieng` (fb_comment_id TEXT PRIMARY KEY, page_id, boi TEXT NOT NULL, binh_luan_id NULL, hoi_thoai_id NULL, trang_thai CHECK IN ('giu','da_gui','loi'), luc). Lý do: phải giữ lượt một cách nguyên tử trước khi Director chạy. Không thêm giá trị vào binh_luan_live.xu_ly vì cột này có CHECK (012-ban-hang.sql:300), đổi thì phải dựng lại bảng. Tệp nâng cấp điền lại dữ liệu từ tin_nhan cũ (loai='nhan_rieng', trạng thái cho/da_gui/khong_ro → boi 'tu_van').

**Cấu hình, câu mẫu, Skill, Hook:** Không có ô nhập mới. Công cụ nội bộ `gui_the_moza` hiện trong bảng Luật quyền (mặc định Cho phép) để "Dừng mọi thứ" vẫn chặn được.

**Giả lập Facebook:** gia.js: thêm taiAnhLen (trả attachment_id giả), nhanRiengThe, guiTheSp, guiLuaChon (lưu vào khung chat giả: ảnh, tiêu đề, phụ đề, nút, trả lời nhanh). khachBam nhận được cả trả lời nhanh. Công tắc `khongNhanRieng` (Set id bình luận hoặc true) làm coTheNhanRieng trả false và nhanRieng ném lỗi như thật.

**Test:**
- test/luot-nhan-rieng.test.js: giữ lượt song song 20 lời gọi → đúng 1 người thắng; Director bỏ bình luận đã có lượt; lỗi thì trả lượt; điền lại từ dữ liệu cũ
- test/nut-bam.test.js: tạo và đọc từng loại nút, payload ≤ 1000 ký tự, payload lạ → null, tương thích 2 nút cũ
- test/facebook.test.js: su-kien đọc quick_reply.payload
- test/the-don.test.js: chạy lại, đi qua gui_the_moza
- test/hook.test.js: gui_the_moza bị "Dừng mọi thứ" giữ lại thành chờ duyệt

**Claude Code làm thay:** Viết bảng loại nút và 30 ca payload (đúng, sai, giả mạo, quá dài). Soạn các câu trả lời sau khi khách bấm nút (câu mẫu máy điền, không gọi AI). Tra tài liệu Meta Send API (trả lời nhanh trong tin nhắn riêng, giới hạn tiêu đề nút) và ghi ngày tra. Tự chạy npm test.

**Thử AI thật:** không

**Phụ thuộc:** Làm đầu tiên cùng F-67 (dùng chung tệp nâng cấp). Không cần Facebook thật.

**Rủi ro:** Đưa gui-the-don qua thucHienCongCu thì cách chạy khi "Dừng mọi thứ" bật sẽ đổi: trước bỏ im lặng, nay vào chờ duyệt. Phải sửa test cũ và ghi vào SPEC. Nếu đổi dạng payload thì nút đã gửi ra Facebook thật sẽ hỏng, nhưng hiện chưa có (chưa live thật).

**Mặc định tự chọn:** Tên bảng và tên các loại lượt như trên. Trả lời nhanh coi như nút. Mọi câu trả lời sau khi bấm nút đều do mã soạn: nhanh, 0 đồng, vẫn chạy khi "Dừng AI". Tư vấn viên chỉ vào cuộc khi khách gõ chữ.

### F-66 Hook giới hạn liên hệ (khách không thấy phiền, Page không bị báo spam)

*Đề xuất: Nền: Hook giới hạn liên hệ · công sức: vua*

- Module `server/nghiep-vu/lien-he.js` (có SQL) và hook `server/agent/hook/gioi-han-lien-he.js` (cửa truoc_cong_cu, bắt buộc, đứng ngay sau hop_thu_gui trong cua.js).
- Mỗi lần gửi mang một `muc_dich`: tra_loi (trả lời tin khách, không giới hạn), the_dau (tin nhắn riêng đầu, đã giới hạn bằng lượt ở F-65), nhac, bao_huy, moi_chao, bao_don (xác nhận, đã gửi hàng: tin giao dịch).
- Luật:
  - mỗi đơn tối đa 1 lần gọi tên kiểu nhắc trên sóng, 2 tin nhắc và 1 tin báo hủy;
  - tin mời chào tối đa 1 tin mỗi ngày cho mỗi người;
  - nhac, bao_huy, moi_chao chỉ gửi trong khung 7h–22h giờ Việt Nam; ngoài khung thì dời tới 7h, không bỏ;
  - khách nhắn "thôi", "dừng", "stop", "đừng nhắn nữa", hoặc bấm [Không lấy] → ghi `nguoi_fb.ngung_lien_he_luc` → chặn nhac, bao_huy, moi_chao và gọi tên. Khách nhắn lại sau đó thì vẫn được trả lời;
  - Page đang bị hạn chế nhắn tin (F-73) → chặn nhac, moi_chao, bao_huy, the_dau (chuyển sang gom công khai hoặc nhắn bù).
- Gọi tên trên sóng không đi qua công cụ: ChotDon hỏi `lienHe.duocGoiTen(nguoiFbId, phienId)` rồi `lienHe.ghi(...)`.
- "Ẩn tên": bình luận "ẩn tên", "đừng gọi tên", "đừng đọc tên" → nhãn `an_ten` (nhan-binh-luan.js). Cả buổi không đọc tên người đó, kể cả câu "vừa chốt"; bình luận này không chuyển Director.
- Bị chặn thì trả mã rõ (GIOI_HAN_LIEN_HE, NGUNG_LIEN_HE, NGOAI_GIO, PAGE_BI_HAN_CHE), không tạo mục chờ duyệt. Màn Đơn hàng ghi "đã nhắc 2/2" hoặc "khách xin dừng".

**Tiêu chí:**
- [ ] Đơn đã nhắc 2 lần → lần thứ 3 bị chặn, mã GIOI_HAN_LIEN_HE
- [ ] Tin nhắc lúc 22:30 → dời tới 7:00 hôm sau (đồng hồ giả)
- [ ] Khách nhắn "thôi shop" → không còn tin nhắc, không bị gọi tên; khách nhắn lại "cho em size L" → vẫn được trả lời
- [ ] "thôi shop ơi em lấy size L" KHÔNG bị coi là xin dừng
- [ ] Bình luận "ẩn tên giúp em" → cả buổi không có câu nào đọc tên người đó
- [ ] Page bị hạn chế → hook chặn mọi tin nhắc

**Tệp sửa:** `server/nghiep-vu/lien-he.js (mới)`, `server/agent/hook/gioi-han-lien-he.js (mới)`, `server/agent/hook/cua.js`, `server/nghiep-vu/nhan-binh-luan.js`, `server/agent/hook/phan-loai-tin.js (nhãn 'ngung')`, `server/hop-thu.js (khi tin đến có nhãn ngung → ghi ngung_lien_he_luc)`, `server/nghiep-vu/hop-thu.js`, `server/chot-don.js`, `public/js/man-hinh/don.js`

**Dữ liệu:** - Bảng mới `lien_he` (id, nguoi_fb_id, don_id NULL, phien_live_id NULL, loai CHECK IN ('goi_ten','nhac','bao_huy','moi_chao'), luc, có chỉ mục). Lý do: đếm được cả liên hệ không phải tin nhắn (gọi tên trên sóng); một chỗ dùng chung cho P10, P23, P24, P27 sau này.
- Cột `nguoi_fb.ngung_lien_he_luc` TEXT NULL.

**Cấu hình, câu mẫu, Skill, Hook:** Không có ô nhập. Hằng số để trong `server/cau-hinh/mac-dinh.json` khóa `lien_he` = {goi_ten_moi_don:1, nhac_moi_don:2, bao_huy_moi_don:1, moi_chao_moi_ngay:1, gio_tu:7, gio_den:22}.

**Giả lập Facebook:** không (hook chạy trước khi gọi Facebook; test dùng Facebook giả sẵn có và đồng hồ giả)

**Test:**
- test/gioi-han-lien-he.test.js: đủ các luật trên, khung giờ, dời 7h, xin dừng, Page bị hạn chế, ẩn tên
- test/nhan-binh-luan.test.js: ≥40 câu "thôi / dừng" có và không; ≥15 câu "ẩn tên"

**Claude Code làm thay:** Soạn danh sách từ "xin dừng", "ẩn tên" và bộ mẫu kiểm (câu đúng, câu dễ nhầm). Soạn câu hiển thị lý do chặn cho người dùng. Không cần model nào phân loại.

**Thử AI thật:** không

**Phụ thuộc:** F-65 (gui_the_moza, muc_dich). F-73 cung cấp trạng thái Page bị hạn chế.

**Rủi ro:** Bắt nhầm "thôi" sẽ làm mất tin nhắc của khách đang muốn mua. Giảm bằng cách chỉ tính câu ngắn và có mẫu kiểm câu dễ nhầm. Luật dời giờ phải tính theo giờ Việt Nam; dùng dauNgayVN có sẵn trong chi-phi.js.

**Mặc định tự chọn:** Tin nhắc ngoài 7h–22h thì dời tới 7h chứ không bỏ, để không mất đơn. "Ngừng liên hệ" không chặn trả lời khi khách tự nhắn lại (họ đã mở lại cuộc trò chuyện). Tin báo đơn (xác nhận, đã gửi) không bị giới hạn vì là tin giao dịch.

### F-67 Sửa nền: giờ bắt đầu live, id video, quyền tin báo đơn, bảng giá, trần câu chen

*Đề xuất: Nền: giờ bắt đầu live từ creation_time, Nền: sửa laBaiLive, Nền: quyền page_utility_messaging, Nền: bảng giá Gemini 3.8 Live, Nền: trần câu chen Đội AI · công sức: vua*

- Giờ bắt đầu live: `that.js timLiveDangPhat` đã trả `bat_dau = creation_time`, nhưng `phong-live.js gan` → `live.ganLive` lại ghi giờ máy (live.js:122). Sửa để ganLive nhận `batDau` và dùng làm `bat_dau`, đồng thời làm `tu_luc` của đoạn đầu trong dong_thoi_gian_san_pham. Không có thì lấy giờ máy như cũ.
- Id video: timLiveDangPhat xin thêm trường `video{id},live_views`, lưu `phien_live.fb_video_id`. `hopThu.laBaiLive` (nghiep-vu/hop-thu.js:394) so cả id live, id video và dạng pageId_videoId, để bình luận live không vào Hộp thư lần hai. Giữ nguyên việc "bài của live đã xong vẫn bị Hộp thư bỏ"; P03 ở mốc khác sẽ đổi phần này.
- Quyền tin báo đơn: `QUYEN_CAN` (ket-noi.js:27) thêm `page_utility_messaging`. Sửa chữ "Meta duyệt khoảng 24 giờ" thành "Meta duyệt trong vài giây tới vài phút" ở that.js:158, api/ket-noi.js:69, public/js/man-hinh/cai-dat-facebook.js:169 và 177.
- Nhiều mẫu tin Utility: khóa cai_dat `fb_mau_utility` đổi thành {da_gui, cho_xac_nhan, da_huy}, vẫn đọc được dạng cũ. Nút "Tạo mẫu tin" tạo mọi mẫu MOZA cần. Thêm `trangThaiMau` để đọc lại trạng thái và loại mẫu (UTILITY, hay bị Meta xếp MARKETING). `taoMauUtility` nhận thêm nút.
- Bảng giá: gia-model.json thêm khối `tu_2027_01_01` gồm Gemini 3.8 Live gấp đôi, gemini-3.8-flash 1,50 / 7,50, TTS gấp đôi, và giá phần hình (VIDEO, IMAGE) cho miệng Gemini Live. `chi-phi.js` chọn giá theo ngày gọi (tinhChiPhi, tinhChiPhiMieng, tinhChiPhiTts). Hiện mốc 1/1/2027 mới chỉ ghi trong phần ghi chú, mã không dùng.
- Lỗi mã 10 / mã phụ 1893063 → `FB_PAGE_BI_CAM_NHAN` trong `graph.js doiLoi`, đặt trước nhánh mã 10 (hiện bị báo nhầm là FB_THIEU_QUYEN). Phần xử lý ở F-73.
- Trần câu chen Đội AI mỗi buổi: `doi-ai/dan-doi.js` đếm câu chen theo phiên (khởi động lại thì đếm lại từ nhật ký chi phí của phiên), mặc định 60 câu/buổi.
  - Từ 80% trần: chỉ còn câu ưu tiên (trả lời "Mai ơi", vừa chốt, vừa hết).
  - Chạm trần: các câu chen khác hiện chữ trên Màn hình người dẫn.
  - Sửa `chenBanHang` (dan-doi.js:964): mỗi khóa một nhãn riêng. Hiện khóa lạ bị gán nhãn "nhắc cách chốt" và đè mất câu nhắc cách chốt.

**Tiêu chí:**
- [ ] Live giả bắt đầu lúc T, MOZA phát hiện lúc T+2s → phien_live.bat_dau = T
- [ ] Bình luận bài đăng có post_id = pageId_videoId của live đang phát → Hộp thư bỏ qua, phòng live xử lý (không trùng)
- [ ] "Kiểm tra kết nối" báo thiếu page_utility_messaging khi mã Page không có quyền này
- [ ] tinhChiPhiMieng('gemini-3.8-live') ngày 31/12/2026 = X; ngày 1/1/2027 = 2X; token VIDEO có giá riêng
- [ ] Lỗi Graph {code:10, error_subcode:1893063} → mã FB_PAGE_BI_CAM_NHAN
- [ ] Buổi Đội AI: câu chen thứ 61 không gọi TTS mà hiện chữ; nhac_cach_chot và mo_tin_nhan cùng nằm trong hàng, không đè nhau

**Tệp sửa:** `server/facebook/that.js`, `server/facebook/gia.js`, `server/facebook/graph.js`, `server/facebook/ket-noi.js`, `server/phong-live.js`, `server/nghiep-vu/live.js`, `server/nghiep-vu/hop-thu.js`, `server/api/ket-noi.js`, `server/gui-the-don.js`, `public/js/man-hinh/cai-dat-facebook.js`, `server/cau-hinh/gia-model.json`, `server/nghiep-vu/chi-phi.js`, `server/doi-ai/dan-doi.js`, `server/cau-hinh/mac-dinh.json`, `server/db/nang-cap/0NN-khong-roi-don.sql`

**Dữ liệu:** Cột `phien_live.fb_video_id` TEXT NULL, để nhận ra bài của live theo id video. Khóa cai_dat `fb_mau_utility` đổi dạng (không cần nâng cấp; mã đọc được cả dạng cũ).

**Cấu hình, câu mẫu, Skill, Hook:** mac-dinh.json: `doi_ai.tran_cau_chen_moi_buoi = 60`. gia-model.json: khối `tu_2027_01_01` và giá VIDEO/IMAGE. Không có ô nhập mới.

**Giả lập Facebook:** - gia.js: live giả có `video_id` khác id live; `bat_dau` = lúc bấm "Bắt đầu live giả"; `live_views` tăng giảm theo người xem giả.
- Bình luận bài đăng giả đặt được vào video của live (post_id = page_videoId).
- Công tắc `camNhan` làm mọi lệnh gửi ném lỗi 10/1893063.
- Mẫu Utility giả có trạng thái đặt được: APPROVED, REJECTED hoặc MARKETING.

**Test:**
- test/facebook.test.js: creation_time, video_id, live_views, QUYEN_CAN, doiLoi 1893063, trangThaiMau
- test/live.test.js: bat_dau lấy creation_time
- test/hop-thu.test.js: laBaiLive nhận id video
- test chi phí: giá đổi theo ngày, VIDEO
- test/doi-ai-dan.test.js: trần câu chen, nhãn riêng từng khóa (sửa test dòng 252)

**Claude Code làm thay:** Tra trang giá Gemini (3.8 Live, Flash, TTS, phần hình) và OpenAI rồi ghi ngày tra vào SPEC mục 6. Tra các trường Graph LiveVideo (video, live_views) và cách tạo, đọc trạng thái mẫu Utility. Đếm câu chen bằng dữ liệu giả. Không gọi Google.

**Thử AI thật:** không (không gọi TTS thật; trần câu chen thử bằng TTS giả)

**Phụ thuộc:** Không. Làm song song với F-65.

**Rủi ro:** Tên trường Graph (video{id}) và cách lấy trạng thái mẫu có thể khác tài liệu, nên kiểm lại ở Bước 0; khác thì chỉ sửa that.js và gia.js. Trần 60 câu có thể thấp nếu bản tuyển dụng đã dùng bớt hạn mức trong ngày.

**Mặc định tự chọn:** Trần 60 câu chen mỗi buổi. Lý do: máy đọc câu chen có 100 lượt/ngày; chừa 40 lượt cho buổi tập hoặc buổi thứ hai và cho bản tuyển dụng đang dùng chung khóa. Chọn giá theo ngày tự động để mức trần không tính thiếu sau 1/1/2027 mà không cần ai nhớ sửa.

### F-68 Thẻ giữ hàng do mã soạn + giữ hàng hai mức

*Đề xuất: P22, P24a · công sức: lon*

- Tin nhắn riêng đầu tiên cho MỌI bình luận chốt do mã soạn trong 1–2 giây, không gọi AI. Nó thay `ChotDon.nhanRieng` (chot-don.js:198–230), hiện đang giao Tư vấn viên soạn qua `ht.xuLy`. Nội dung dựng ở `server/nghiep-vu/the-giu-hang.js`, gửi qua `gui_the_moza` (F-65).
- Thẻ chuẩn:
  - một ảnh đúng màu;
  - tiêu đề ≤ 80 ký tự: "Áo 12 Đen/M · 159.000đ" (chốt nhiều món: "2 món · 448.000đ", ảnh món đầu);
  - phụ đề ≤ 80 ký tự: "Giữ tới hết live + 2 giờ · Tin tự động từ trợ lý AI của {ten_shop}";
  - 3 nút: [Giữ, lên đơn] [Đổi] [Không lấy].
  Luôn có câu tự nhận là AI. Không có số điện thoại hay địa chỉ. Giá và tên món do mã điền từ đơn.
- Thiếu màu hoặc size: gửi lưới 2–6 ảnh màu còn hàng (mỗi ảnh một nút CHON_PL). Không có ảnh hoặc quá 6 lựa chọn thì gửi tin chữ kèm trả lời nhanh (tối đa 13 phân loại còn hàng). Chưa giữ hàng cho tới khi khách chọn.
- Hết hàng hoặc không đủ: thẻ "Đen/M vừa hết" kèm lựa chọn phân loại còn hàng của cùng mẫu. Ngừng bán hoặc số không có: tin chữ lịch sự kèm lựa chọn các món đang live.
- Ảnh:
  - tải ảnh sản phẩm lên Meta một lần (Attachment Upload, is_reusable), nhớ attachment_id theo Page và tệp;
  - KHÔNG mở ảnh qua Quick Tunnel: giữ luật SPEC mục 9 "ảnh chỉ phục vụ ở 127.0.0.1";
  - Claude Code tra tài liệu Meta ngày code để biết mẫu nào nhận attachment_id, mẫu nào cần image_url; cách gửi chốt trong that.js;
  - không gửi được ảnh thì tự lùi về thẻ chữ có nút (button template ≤ 640 ký tự).
- Không nhắn riêng được (can_reply_privately = false, lỗi Facebook, Page bị hạn chế) → gom tên vào một bình luận công khai mỗi 2 phút như #65. Câu gom có link m.me ở F-70; câu riêng khi Page bị hạn chế ở F-73.
- Khách bấm nút:
  - [Giữ, lên đơn] → giữ dài, ghi `don.khach_bam_luc`, trả lời bằng câu mẫu xin tên, số điện thoại, địa chỉ. Đơn đã đủ thông tin thì gửi luôn thẻ đơn #89;
  - [Đổi] → trả lời nhanh các phân loại còn hàng của món đó (DOI_PL); muốn món khác thì giao Tư vấn viên;
  - [Không lấy] → bỏ món của bình luận đó; đơn chỉ còn món đó thì hủy (nguồn khach_tu_bao, bằng chứng là tin postback) và ghi ngừng liên hệ cho đơn đó.
- Giữ hàng hai mức (sửa #64), gom về một hàm `tinhGiuDen` (thay 3 chỗ đang dùng gio_giu: don.taoDon, doiTrangThai về cho_xac_nhan, hoanTac):
  - đơn từ bình luận live, khách chưa bấm và chưa nhắn: trong lúc live, hạn tạm là lúc chốt + 12 giờ (trần an toàn); khi phiên kết thúc (live.ketThucPhien) thì rút về lúc kết thúc + N giờ;
  - khách bấm nút hoặc nhắn tin → hạn = lúc đó + gio_giu (24 giờ);
  - đơn do Tư vấn viên hay người tạo tay: giữ như cũ.
- Buổi tập không tốn AI: `server/khach-gia.js` thêm kiểu "khách soạn sẵn" (bấm nút sau N giây, gửi sẵn tên và địa chỉ, im lặng, nói "thôi"), không gọi gpt-6-luna.

**Tiêu chí:**
- [ ] Facebook giả: "chốt 12 đen M" → khung chat giả có thẻ ảnh Đen, tiêu đề đúng giá, 3 nút, dòng "trợ lý AI" trong ≤ 2 giây; nhật ký AI không có lượt chạy nào cho tin này
- [ ] Kịch bản diễn tập mới "40 người chốt trong 60 giây" → 40 thẻ, 0 lần bán quá tồn, mỗi thẻ ≤ 3 giây sau khi bình luận tới MOZA
- [ ] "chốt 12" với 3 màu × 2 size → lưới hoặc trả lời nhanh đúng các ô còn hàng; chưa giữ; khách chọn Đen/M → giữ và gửi thẻ
- [ ] can_reply_privately = false → không nhắn riêng; tên vào bình luận gom công khai
- [ ] Chế độ ảnh 'khong' của Facebook giả → thẻ chữ có nút, chữ ≤ 640 ký tự, vẫn có câu tự nhận AI
- [ ] Live kết thúc 21:00, khách chưa bấm → hạn giữ 23:00; khách bấm Giữ lúc 21:30 → hạn 21:30 hôm sau
- [ ] [Không lấy] → hàng về còn bán được ngay, không có tin nhắc nào sau đó
- [ ] Buổi tập với khách soạn sẵn đi trọn tới "Đã xác nhận" mà không gọi AI

**Tệp sửa:** `server/chot-don.js`, `server/nghiep-vu/the-giu-hang.js (mới)`, `server/gui-the-don.js`, `server/xu-ly-nut.js`, `server/nghiep-vu/don.js`, `server/nghiep-vu/live.js`, `server/phong-live.js`, `server/facebook/that.js`, `server/facebook/gia.js`, `server/nghiep-vu/cai-dat.js`, `public/js/man-hinh/cai-dat.js`, `public/js/man-hinh/live.js (khung chat giả hiện thẻ ảnh, lưới, trả lời nhanh)`, `server/khach-gia.js`, `server/agent/agents/khach-gia.js`, `server/cau-hinh/kich-ban-dien-tap.json`, `server/nghiep-vu/dien-tap-ban-hang.js`, `SPEC.md (Luồng 3, #64, #65, F-53, F-52, F-56)`

**Dữ liệu:** - Cột `don.khach_bam_luc` TEXT NULL: đánh dấu khách đã bấm hoặc nhắn, để chuyển sang giữ dài.
- Bảng mới `anh_fb` (page_id, tep, attachment_id, tai_luc, PK(page_id, tep)): mỗi ảnh chỉ tải lên Meta một lần cho mỗi Page.
- Đơn cũ đang chờ giữ nguyên hạn.

**Cấu hình, câu mẫu, Skill, Hook:** Một ô mới trong Cài đặt → Bán hàng: "Giữ ngắn cho người chưa bấm: hết live + N giờ" (`gio_giu_ngan`, 1–24, mặc định 2), đặt cạnh ô giờ giữ cũ. Câu chữ của thẻ do Claude Code soạn thành câu mẫu trong mã (the-giu-hang.js), không cần lời dặn hay Skill mới.

**Giả lập Facebook:** - gia.js: công tắc `anhThe` = 'attachment' | 'url' | 'khong', để thử cả ba đường ảnh.
- Lưới ảnh và trả lời nhanh hiện trong khung chat giả, bấm được.
- `binhLuanMoCuaSo` (mặc định false): tin thứ hai gửi trước khi khách trả lời thì bị từ chối như trang tài liệu nhắn riêng mô tả.
- `hopNhan` = 'chinh' | 'tin_nhan_cho': khung chat giả ghi "đang nằm ở Tin nhắn chờ".
- Thêm hàm tạo 40 bình luận chốt trong 60 giây.

**Test:**
- test/the-giu-hang.test.js: độ dài tiêu đề và phụ đề, có câu tự nhận AI, không lộ số điện thoại; ảnh tải một lần theo Page và tệp; lùi về thẻ chữ; lưới ≤ 6, trả lời nhanh ≤ 13; hết hàng; can_reply_privately false → gom công khai; 40 chốt/60 giây
- test/don.test.js: tinhGiuDen hai mức; kết thúc phiên rút hạn; bấm nút kéo dài
- test/chot-don.test.js: sửa dòng 206–207 (giả định giữ 24 giờ); tin đầu không còn giao Tư vấn viên
- test/dien-tap-ban-hang.test.js: khách soạn sẵn đi trọn luồng, 0 lượt AI

**Claude Code làm thay:** - Soạn toàn bộ câu mẫu của thẻ theo từng nhánh (đủ, thiếu màu, thiếu size, hết, ngừng bán, số không có, nhiều món) và cách xưng hô.
- Tra tài liệu Meta (generic template, lưới ảnh, media template, attachment_id, quick reply trong nhắn riêng), ghi ngày tra.
- Viết kịch bản diễn tập 40 chốt/60 giây và 9 khách soạn sẵn thay cho khách giả gọi gpt-6-luna.
- Tự lái trình duyệt bản xem thử (preview "moza", cổng 5190) đóng vai khách bấm nút, chụp màn hình khung chat giả.
- Đọc nhật ký tự chấm "0 lượt AI cho tin đầu".

**Thử AI thật:** Không bắt buộc. Tùy chọn cuối mốc: 1 lượt Luồng 3 trên bản xem thử, gpt-6-luna (OpenAI), để xem Tư vấn viên nối tiếp đúng sau thẻ do mã soạn. Ước 0,02–0,05 USD, báo trước khi chạy.

**Phụ thuộc:** F-65, F-66, F-67 (tệp nâng cấp chung). F-72 nên xong trước để thẻ không bị công tắc chi phí chặn.

**Rủi ro:** - Chưa kiểm chứng: nhắn riêng bình luận live; mẫu nào nhận attachment_id; trả lời nhanh trong nhắn riêng; tin rơi vào hộp nào. Tất cả là Bước 0; khác giả lập thì sửa that.js và gia.js.
- Khách chưa bấm mà hàng được giữ quá ngắn có thể bực. Thẻ đã nói luật giữ ngay từ đầu, và N sửa được.

**Mặc định tự chọn:** - N = 2 giờ sau khi live kết thúc. Lý do: khách live hay xem tin trong buổi tối; P01 và P06 nhắc trong khoảng này; hàng đang chạy không bị treo qua đêm cho người không trả lời.
- Trần an toàn trong lúc live là 12 giờ, phòng khi phiên không đóng được.
- Mọi nhánh của tin đầu đều do mã soạn (kể cả hết hàng, thiếu size), để 0 đồng và vẫn chạy khi "Dừng AI".
- Hiện "còn N" chỉ khi N ≤ ngưỡng sắp hết (mặc định 3), còn lại ghi "còn hàng" (theo tinh thần K9).

### F-69 Nhắc đơn chưa xác nhận, báo khách khi hủy, danh sách "Gọi xác nhận"

*Đề xuất: P06 · công sức: vua*

- Hàm mới `don.canNhacXacNhan(bayGio)` thay `canNhanChuDong` phần nhắc (hiện chỉ nhắc đơn còn thiếu thông tin, một lần). Mỗi đơn tối đa 2 tin nhắc + 1 tin báo hủy; Hook F-66 giữ giới hạn này. Tin do mã soạn, có khóa chống trùng riêng `nhac:{don}:{lan}` (khóa `the:` của thẻ đơn đang chặn gửi lại cùng phiên bản).
- Lần 1: 20 phút sau tin cuối của shop mà khách chưa làm bước tiếp. Chỉ gửi khi hội thoại Messenger còn trong 24 giờ và AI không tạm dừng.
- Lần 2: vào lúc sớm hơn trong hai mốc "hạn giữ − 2 giờ" và "tin cuối của khách + 22 giờ", cách lần 1 ít nhất 2 giờ.
  - Còn trong 24 giờ: tin thường có nút.
  - Ngoài 24 giờ: mẫu Utility "đơn đang chờ xác nhận", chỉ gửi khi Meta xếp mẫu là UTILITY. Mẫu bị xếp MARKETING thì bỏ lần này.
- Nội dung:
  - đơn đủ thông tin: "Đơn DH-0042 · 169.000đ đang chờ mình xác nhận, shop giữ tới 21:15" + [Xác nhận] [Sửa] [Không lấy];
  - đơn còn thiếu: nêu thiếu gì + [Không lấy].
- Tin báo hủy: `huyQuaGio` (don.js:420, gọi từ dich-vu.js:91) trả về đơn vừa hủy, rồi Hộp thư báo khách.
  - Trong 24 giờ: "Đơn DH-0042 đã hủy vì quá giờ giữ, hàng đã về kho. Vẫn muốn lấy thì bấm [Đặt lại]".
  - Ngoài 24 giờ: mẫu Utility "đơn đã hủy" chỉ có thông tin; chưa có mẫu thì không gửi.
- [Đặt lại] (hạn 24 giờ kể từ lúc hủy): tạo đơn mới cùng món trong một giao dịch, giữ dài. Món nào hết thì báo và gợi ý phân loại còn hàng.
- Đơn đã đủ tên, số điện thoại, địa chỉ mà hết giờ giữ: KHÔNG tự hủy. Gia hạn một lần 12 giờ và tạo việc goi_xac_nhan_don "Gọi xác nhận đơn DH-0042 · 0912***678". Màn Đơn hàng có thẻ lọc "Gọi xác nhận". Người chưa xử lý trong 12 giờ thì hủy như thường, kèm tin báo hủy.
- Sửa lỗi hop-thu.js:263–266: đơn chưa có số điện thoại, ngoài 24 giờ thì KHÔNG tạo việc "Gọi khách". Đơn hiện nhãn "Chưa liên lạc được" (tính ra từ dữ liệu, không thêm cột).
- Không gọi lại `canHoiTham`/`tangHoiTham` (nghiep-vu/hop-thu.js:409, 419). Hai hàm này chưa nơi nào gọi và tính theo hội thoại, không gắn với đơn. Ý "cửa sổ sắp đóng" (20–23 giờ) được đưa vào mốc lần 2. Bỏ hai hàm chết; cột lan_hoi_tham để nguyên.

**Tiêu chí:**
- [ ] Khách gửi địa chỉ rồi im 20 phút (đồng hồ giả) → 1 tin nhắc có 3 nút; thêm vài giờ → lần 2; không có lần 3
- [ ] Lần 2 rơi ngoài 24 giờ, mẫu APPROVED/UTILITY → gửi mẫu; mẫu MARKETING → không gửi gì
- [ ] Quá giờ giữ, đơn thiếu số → hủy, tin báo có [Đặt lại] (trong 24 giờ); bấm → đơn mới, hàng được giữ lại
- [ ] Đơn đủ tên, số, địa chỉ hết giờ → vẫn Chờ xác nhận, có việc "Gọi xác nhận", hạn +12 giờ
- [ ] Đơn không số, ngoài 24 giờ → không có việc gọi; Đơn hàng hiện "Chưa liên lạc được"
- [ ] Khách đã xin dừng → không nhắc, không báo hủy
- [ ] Tua thời gian ở Phòng diễn tập thấy đủ các bước trên

**Tệp sửa:** `server/nghiep-vu/don.js`, `server/hop-thu.js (nhacDon, hoiThoaiNhan)`, `server/nghiep-vu/hop-thu.js (bỏ canHoiTham, tangHoiTham)`, `server/gui-the-don.js (guiUtility cho_xac_nhan, da_huy)`, `server/nghiep-vu/the-don.js (câu nhắc, câu báo hủy)`, `server/xu-ly-nut.js (DAT_LAI)`, `server/dich-vu.js (huyQuaGio → báo hủy)`, `server/api/ket-noi.js (tạo 3 mẫu)`, `server/facebook/that.js`, `server/facebook/gia.js`, `public/js/man-hinh/don.js`, `server/nghiep-vu/dien-tap-ban-hang.js`, `SPEC.md (F-32, F-52, mục 7)`

**Dữ liệu:** Cột mới trên `don`: nhac_lan INTEGER NOT NULL DEFAULT 0, nhac_cuoi_luc TEXT, bao_huy_luc TEXT, gia_han_goi_luc TEXT. Lý do: đếm nhắc, không báo hủy hai lần, chỉ gia hạn "Gọi xác nhận" một lần. Cột nhac_giao_luc cũ vẫn giữ để tương thích. Loại việc goi_xac_nhan_don đã có (khach.js:21, không có CHECK).

**Cấu hình, câu mẫu, Skill, Hook:** Không có ô nhập. Hai mẫu Utility mới ("đơn đang chờ xác nhận" có nút, "đơn đã hủy") tạo chung bằng nút "Tạo mẫu tin" đã có trong Cài đặt → Facebook.

**Giả lập Facebook:** gia.js: guiUtility nhận nút (khung chat giả hiện nút bấm được); trangThaiMau đặt được APPROVED, REJECTED hoặc MARKETING; `binhLuanMoCuaSo` để thử cả trường hợp khách chưa từng trả lời.

**Test:**
- test/nhac-don.test.js (mới): các mốc lần 1, lần 2, Utility, MARKETING, khung giờ, xin dừng, báo hủy, Đặt lại còn hàng / hết hàng, Gọi xác nhận 12 giờ, không có việc gọi khi thiếu số
- Sửa test/don.test.js:181–199, test/hop-thu-don.test.js:263–305, test/the-don.test.js:178, test/dien-tap-ban-hang.test.js:49 theo luật mới

**Claude Code làm thay:** Soạn câu nhắc, câu báo hủy, câu cho hai mẫu Utility (không có chữ mời chào để Meta xếp đúng loại UTILITY). Viết kịch bản tua thời gian trong Phòng diễn tập. Tra tài liệu mẫu Utility của Messenger (nút postback, cách xếp loại) và ghi ngày tra.

**Thử AI thật:** không

**Phụ thuộc:** F-65, F-66, F-67 (nhiều mẫu Utility), F-68 (giữ hai mức, nút).

**Rủi ro:** Meta có thể xếp mẫu "đang chờ xác nhận" có nút vào loại MARKETING; khi đó lần 2 ngoài 24 giờ không gửi được (đã có đường lùi: bỏ lần này). Gia hạn 12 giờ làm món hot bị treo lâu hơn; người bấm Hủy được bất cứ lúc nào.

**Mặc định tự chọn:** Lần 1 sau 20 phút (theo đề xuất, trong khoảng khách còn nhớ). Lần 2 theo mốc sớm hơn trong "hạn giữ − 2 giờ" và "cửa sổ 24 giờ − 2 giờ", để còn gửi bằng tin thường. "Gọi xác nhận" gia hạn 12 giờ một lần: đủ cho người gọi trong ngày mà không khóa hàng mãi. Tin nhắc về đơn không tính vào giới hạn "1 tin chủ động mỗi ngày" cũ; Hook F-66 thay cho giới hạn đó.

### F-70 Nhắc trên sóng mở Tin nhắn chờ, nhắc cách chốt theo tình huống, bắt "ib", link m.me có mã buổi

*Đề xuất: P01 · công sức: lon*

- Hàng "chờ phản hồi" trong ChotDon (nhịp 5 giây có sẵn ở chot-don.js:65): đơn của phiên đã gửi thẻ ≥ 4 phút mà người đó chưa bấm hay nhắn → mỗi lượt đọc tối đa 3 tên. Mỗi người chỉ bị gọi tên kiểu nhắc 1 lần mỗi buổi (Hook F-66). Bỏ người đã "ẩn tên".
- Câu trung tính, không bao giờ nói "chưa trả lời", "chưa mở", "chưa xác nhận". Ví dụ: "Hoa, Trâm ơi, shop đã nhắn riêng rồi nè, xem giúp shop mục Tin nhắn chờ nha".
  - Đội AI: khóa câu mẫu mới `mo_tin_nhan`, nhãn riêng.
  - Mai: hàm mới `mieng.nhacMoTin(ten)`, không dùng lại `baoVuaChot` (mieng.js:626 cứng câu "có người vừa chốt đơn").
  - Chỉ gợi ý: dòng chữ to "Mở tin nhắn chờ: Hoa, Trâm" trên Màn hình người dẫn.
  - Câu `vua_chot` thêm các lựa chọn "shop nhắn riêng rồi, xem cả Tin nhắn chờ nha".
- Nhắc cách chốt theo tình huống (câu nhac_cach_chot hiện chỉ test gọi):
  - (a) có người mới vào: ≥ 3 người bình luận lần đầu trong 3 phút, hoặc live_views tăng ≥ 20% trong 3 phút;
  - (b) món đang nói có ≥ 3 câu hỏi trong 2 phút mà 0 người chốt;
  - hai lần nhắc cách nhau ít nhất 5 phút; tính vào trần câu chen F-67.
  Đội AI dùng chenBanHang; Mai dùng hàm mới `mieng.nhacCachChot()`; Chỉ gợi ý hiện dòng báo.
- Bắt "ib / check ib / inbox / nt / chưa thấy tin / giá sao" trong PhongLive.nhanBinhLuan, TRƯỚC docChot và Director:
  - người đang có đơn trong phiên → nhắn riêng lại thẻ hiện tại qua chính bình luận mới (lượt the_ib);
  - người chưa có đơn → 1 thẻ món đang nói (thẻ chọn màu, size của F-68); không có món đang nói → tin chữ kèm trả lời nhanh các món trong phiên;
  - mỗi người tối đa 1 lần mỗi 5 phút; luôn hỏi can_reply_privately trước;
  - "ib" không chuyển Director; "giá sao" vẫn chuyển Director để Mai trả lời trên sóng;
  - "ib" chỉ là lưới phụ: tin đầu vào Tin nhắn chờ thì tin sau cũng vào đó.
- Link m.me (phần 4):
  - bình luận gom công khai và câu ghim (F-77) có `https://m.me/<username hoặc id Page>?ref=phien_<id>`;
  - su-kien.js đọc `referral` (sự kiện messaging_referrals) và `postback.referral` (người mới bấm "Bắt đầu") thành sự kiện 'gioi_thieu'; `ket-noi.js TRUONG` thêm messaging_referrals;
  - Hộp thư: ref khớp một phiên thì tìm người chốt cùng tên trong phiên và hỏi bằng nút [Đúng, là mình] [Không phải]. Đúng → ganPsid gộp người rồi gửi thẻ đơn hoặc thẻ giữ hàng. Không phải hoặc không khớp → Tư vấn viên xử lý như tin thường, kèm ghi chú "khách vào từ live X";
  - nút "Bật nút Bắt đầu cho Page" trong Cài đặt → Facebook (Messenger Profile get_started; người bấm vì đây là đổi cài đặt Page).

**Tiêu chí:**
- [ ] Đội AI: người chốt không bấm hay nhắn trong 4 phút → đúng 1 lần câu mo_tin_nhan có tên; không câu nào chứa "chưa trả lời", "chưa mở", "chưa xác nhận" (test quét câu mẫu)
- [ ] Chỉ gợi ý: dòng "Mở tin nhắn chờ" hiện ≤ 3 tên, chữ to
- [ ] 3 người mới bình luận trong 3 phút → 1 câu nhắc cách chốt; không có câu thứ hai trong 5 phút
- [ ] Người có đơn gõ "ib" → Facebook giả nhận thẻ qua bình luận mới; Director không nhận bình luận đó
- [ ] Người chưa có đơn gõ "check ib" khi đang nói áo 12 → thẻ chọn màu, size của áo 12
- [ ] Khách giả vào bằng link m.me?ref=phien_X (người mới: postback.referral; người cũ: messaging_referrals) → nút Đúng / Không phải; bấm Đúng → đơn gắn đúng người
- [ ] Câu gom công khai có link m.me đúng ref

**Tệp sửa:** `server/chot-don.js`, `server/phong-live.js`, `server/nghiep-vu/nhan-binh-luan.js`, `server/nhan-y-dinh.js (mới: nhận ib, ẩn tên, xin dừng, chốt test bằng mã)`, `server/doi-ai/dan-doi.js`, `server/cau-hinh/doi-ai-cau-mau.json`, `server/agent/mieng/mieng.js`, `public/js/man-hinh/nguoi-dan.js`, `server/facebook/su-kien.js`, `server/facebook/ket-noi.js`, `server/facebook/that.js (layLinkMe, datNutBatDau)`, `server/facebook/gia.js (khachVaoTuLink)`, `server/hop-thu.js (sự kiện gioi_thieu)`, `server/xu-ly-nut.js (DUNG_NGUOI, KHONG_PHAI)`, `server/api/ket-noi.js`, `public/js/man-hinh/cai-dat-facebook.js`, `server/cau-hinh/kich-ban-dien-tap.json`

**Dữ liệu:** không (dùng bảng lien_he, luot_nhan_rieng của F-65/F-66; nhãn ib, an_ten nằm trong cột JSON binh_luan_live.nhan, không có CHECK)

**Cấu hình, câu mẫu, Skill, Hook:** Không có ô nhập. Câu mẫu mới trong doi-ai-cau-mau.json: `mo_tin_nhan`, thêm lựa chọn cho `vua_chot` và `nhac_cach_chot`. Một nút "Bật nút Bắt đầu" trong Cài đặt → Facebook (bấm một lần).

**Giả lập Facebook:** - gia.js: `khachVaoTuLink({page_id, ten, ref, nguoiMoi})` phát sự kiện referral theo đúng hai kiểu của Meta; công tắc `matRef` giả máy Android làm mất ref.
- `live_views` giả tăng khi có người xem giả mới.
- Thêm kịch bản diễn tập "ib / check ib / giá sao", "ẩn tên", "chốt rồi im 5 phút".

**Test:**
- test/nhac-tren-song.test.js (mới): mo_tin_nhan tối đa 3 tên, 1 lần mỗi người, ẩn tên, câu trung tính; hai điều kiện nhắc cách chốt; nhãn riêng không đè nhau; trần câu chen
- test/ib.test.js (mới): ≥ 50 câu ib / không phải ib; có đơn → gửi lại; chưa đơn → thẻ món đang nói; 5 phút; không vào Director
- test/m-me-ref.test.js (mới): hai kiểu referral, Đúng / Không phải, ghép người, mất ref
- Sửa test/doi-ai-dan.test.js:252

**Claude Code làm thay:** Soạn câu mẫu mo_tin_nhan, vua_chot, nhac_cach_chot (tự nhiên, rất ít "nhé"). Soạn danh sách cách viết "ib" và bộ ≥ 50 câu kiểm. Viết kịch bản diễn tập. Tra tài liệu Meta (m.me ref, messaging_referrals, postback.referral, Messenger Profile get_started) và ghi ngày tra. Đọc nhật ký buổi tập để tự chấm câu nào lặp hay gượng, thay cho model chấm.

**Thử AI thật:** không (Đội AI dùng TTS giả; Mai dùng miệng giả)

**Phụ thuộc:** F-65, F-66, F-67 (live_views, trần câu chen), F-68 (thẻ).

**Rủi ro:** - Gọi tên trước đông người có thể làm khách ngại; đã dùng câu trung tính, 1 lần mỗi người, có "ẩn tên".
- Ghép người qua m.me theo tên có thể nhầm người trùng tên, nên luôn hỏi lại bằng nút.
- Một số máy Android mất ref, nên luôn giữ đường "ib".
- Nếu Bước 0 cho thấy không nhắn riêng được bình luận live thì link m.me thành đường chính, phải đưa lên đầu câu ghim.

**Mặc định tự chọn:** Nhắc sau 4 phút (Vpage: khách chờ 3–7 phút là bỏ). Các ngưỡng nhắc cách chốt (3 người mới / 3 phút, 3 câu hỏi / 2 phút, cách nhau 5 phút) là số khởi đầu, chỉnh sau khi có số đo buổi thật. "giá sao" vừa nhận thẻ vừa để Mai trả lời trên sóng, vì câu đó cũng là câu hỏi chung.

### F-71 Câu hỏi có ý mua ("12 đen M còn ko") → thẻ mời giữ một chạm

*Đề xuất: P02 · công sức: vua*

- Tách phần tìm số, màu, size trong `docChot` (nhan-chot.js:114–198, dùng tachMon, timGiaTri) thành hàm dùng chung `timMon`. Hiện câu hỏi bị gạt ra ở dòng 125 trước khi tìm món. docChot trả thêm `{la_hoi_mua: true, mon}` khi câu là câu hỏi nhưng ghi đủ số, màu và size.
- Chỉ gửi khi đủ các điều kiện:
  - còn hàng;
  - người đó chưa có đơn mở chứa phân loại này;
  - chưa nhận thẻ mời của món này trong buổi;
  - không có tin riêng nào tới người đó trong 5 phút qua, và người đó không vừa chốt đúng món này trong 1 phút;
  - còn lượt nhắn riêng (lượt the_moi).
  KHÔNG tự giữ hàng.
- Thẻ: ảnh đúng màu, "Áo 12 Đen/M · 159.000đ · còn hàng" (ghi "còn N" chỉ khi N ≤ ngưỡng sắp hết), dòng tự nhận AI, nút [Giữ cho mình] [Xem màu khác].
- Bình luận vẫn chuyển Director như cũ: `ChotDon.xuLy` trả false cho câu hỏi mua sau khi gửi thẻ.
- Bấm [Giữ cho mình] (GIU_MOI) → taoDon trong một giao dịch, ghi khach_bam_luc (giữ dài), rồi gửi thẻ giữ hàng theo psid (đã trong 24 giờ). Gặp HET_HANG hay KHONG_DU_HANG thì báo bằng câu mẫu kèm lựa chọn còn hàng.
- [Xem màu khác] → lưới hoặc trả lời nhanh các phân loại còn hàng (CHON_PL).

**Tiêu chí:**
- [ ] 105 câu chốt cũ vẫn đúng 100% (test/nhan-chot.test.js)
- [ ] ≥ 40 câu hỏi mua mới → la_hoi_mua đúng; câu thiếu màu hoặc size → không gửi thẻ
- [ ] "12 đen M còn ko shop" → Facebook giả nhận thẻ mời; Director vẫn nhận bình luận; kho không đổi
- [ ] Bấm Giữ cho mình → đơn Chờ xác nhận, giữ 24 giờ, thẻ giữ hàng tới khung chat giả
- [ ] Hỏi lại cùng món trong buổi → không có thẻ thứ hai
- [ ] Hàng vừa hết lúc bấm → câu báo hết + lựa chọn còn hàng, không lỗi

**Tệp sửa:** `server/nhan-chot.js`, `server/chot-don.js`, `server/nghiep-vu/the-giu-hang.js`, `server/xu-ly-nut.js`, `server/phong-live.js`

**Dữ liệu:** không (thẻ mời đã gửi ghi vào luot_nhan_rieng với boi = 'the_moi' kèm phân loại)

**Cấu hình, câu mẫu, Skill, Hook:** không

**Giả lập Facebook:** Thêm kịch bản diễn tập "hỏi còn hàng có màu size". Không thêm hàm mới ngoài F-65/F-68.

**Test:**
- test/nhan-chot.test.js: chạy lại 105 câu + ≥ 40 câu hỏi mua
- test/hoi-mua.test.js (mới): các điều kiện gửi, không tự giữ, một thẻ mỗi món mỗi buổi, 5 phút, bấm Giữ, hết hàng lúc bấm, Director vẫn nhận

**Claude Code làm thay:** Soạn ≥ 40 câu hỏi mua theo cách viết của khách Việt (không dấu, viết tắt, "hông", "hok", "k shop") và câu dễ nhầm. Soạn câu thẻ mời. Chạy lại toàn bộ bộ chốt.

**Thử AI thật:** không

**Phụ thuộc:** F-68 (thẻ, nút, lượt nhắn riêng).

**Rủi ro:** Sửa docChot có thể làm sai bộ 105 câu cũ, nên chạy lại toàn bộ trước khi làm tiếp. Khách chỉ hỏi cho biết có thể thấy phiền; đã giới hạn đủ màu và size, mỗi món một lần.

**Mặc định tự chọn:** Cách 5 phút sau tin riêng gần nhất. Ghi "còn hàng" thay cho số khi còn nhiều, tránh tạo sức ép giả. Không tự giữ hàng khi chưa bấm.

### F-72 Tách "Dừng AI" (tự bật khi vượt trần) và "Dừng mọi thứ" (chỉ khi người bấm)

*Đề xuất: P42 · công sức: vua*

- Cài đặt mới `dung_ai` {bat, ly_do, luc} (cai-dat.js: dungAi, datDungAi, lyDoDungAi). `kiemMucTran` (chi-phi.js:102) bật `dung_ai` thay cho `khan_cap`. "Dừng mọi thứ" = khan_cap cũ, chỉ bật khi người bấm nút đỏ.
- "Dừng AI" chặn mọi lần gọi AI tốn tiền:
  - runtime.chayAgent (runtime.js:127), trừ việc người tự bấm (boQuaKhanCap);
  - miệng Live (mieng.js:369), Đội AI (dan-doi.js:202), chép lời người dẫn (chep-loi-nguoi-dan.js:125, 217), model rẻ đọc hộ chốt (#77: chot-don.js docHo bỏ qua; câu mơ hồ thì thẻ hỏi lại bằng mã).
  Không đọc tên bằng giọng; Chỉ gợi ý vẫn hiện dòng "Vừa chốt".
- Phần chốt đơn bằng mã vẫn chạy: giữ hàng, thẻ giữ hàng, nút, gom công khai, ẩn bình luận. Hook khan-cap.js chỉ xét khan_cap như cũ.
- Tin Messenger khách gõ chữ trong lúc Dừng AI → hội thoại Cần người, kèm 1 câu mẫu báo nhận (tối đa 1 lần/giờ mỗi hội thoại): "Shop nhận được tin rồi, nhân viên shop trả lời mình ngay".
- Cảnh báo từ 80% trần giờ hoặc trần ngày: `chiPhi.mucDo()` → sự kiện 'chi_phi.muc'; dải vàng ở thanh trên cùng (app.js) và Màn hình người dẫn. Dừng AI: dải đỏ "AI tạm dừng vì chạm trần — chốt đơn vẫn chạy" + nút "Chạy AI tiếp" (hiện số tiền, cho nâng trần ngay).
- Trần ngày có live: `muc_tran.ngay_co_live` áp dụng cho ngày có phiên live (thật hoặc tập). Ô nhập thêm ở Agent & Skill → Vận hành, cạnh hai ô cũ.
- Tự tắt: lý do không còn (sang ngày mới với trần ngày; chi phí 60 phút qua < 80% với trần giờ) VÀ không có phiên đang live. Trong lúc live không tự bật lại giọng.
- Đổi các nơi đang phát `khan_cap` kèm VUOT_MUC_TRAN sang sự kiện 'dung_ai': runtime.js:263, mieng.js:971, chep-loi-nguoi-dan.js:252, dan-doi.js:261, tieng-gia.js:73, api/doi-ai.js:20, api/giong-mai.js:17, và nơi dùng canhBao ở phong-thu.js:244, nhac.js:405/472, nghiep-vu/doi-ai.js:143, giong-mai.js:151. Dùng một hàm chung `chiPhi.baoVuotTran(phat, canhBao)`.
- Đổi chữ trên giao diện "Dừng mọi tự động" thành "Dừng mọi thứ". Sửa BAN-GIAO.md dòng 141.

**Tiêu chí:**
- [ ] Chi phí giả vượt trần giờ giữa live → dung_ai bật, khan_cap vẫn tắt; bình luận "chốt 12 đen M" vẫn có đơn và thẻ trên Facebook giả; không có lượt AI nào chạy
- [ ] Chạm 80% trần → sự kiện 'chi_phi.muc' mức vàng, dải vàng hiện
- [ ] Người bấm "Dừng mọi thứ" → thẻ giữ hàng vào chờ duyệt (không gửi)
- [ ] Hôm sau (đồng hồ giả), không có live → dung_ai tự tắt; đang live → không tự tắt
- [ ] Khách nhắn chữ khi Dừng AI → Cần người + 1 câu báo nhận
- [ ] Ngày có phiên live dùng ngay_co_live thay cho trần ngày thường

**Tệp sửa:** `server/nghiep-vu/cai-dat.js`, `server/nghiep-vu/chi-phi.js`, `server/agent/runtime.js`, `server/agent/hook/khan-cap.js (chú thích)`, `server/agent/mieng/mieng.js`, `server/chep-loi-nguoi-dan.js`, `server/doi-ai/dan-doi.js`, `server/doi-ai/phong-thu.js`, `server/doi-ai/nhac.js`, `server/nghiep-vu/doi-ai.js`, `server/nghiep-vu/giong-mai.js`, `server/tieng-gia.js`, `server/api/doi-ai.js`, `server/api/giong-mai.js`, `server/api/cai-dat.js`, `server/api/agent.js`, `server/api/bao-cao.js`, `server/hop-thu.js`, `server/chot-don.js`, `public/js/app.js`, `public/js/man-hinh/agent.js`, `public/js/man-hinh/nguoi-dan.js`, `BAN-GIAO.md`, `server/cau-hinh/gia-model.json (muc_tran_mac_dinh.ngay_co_live)`

**Dữ liệu:** không (khóa cai_dat mới: dung_ai; muc_tran thêm ngay_co_live)

**Cấu hình, câu mẫu, Skill, Hook:** Thêm ô "Trần ngày có live (USD)" ở Agent & Skill → Vận hành, mặc định 20. Cảnh báo 80% là hằng số trong mã.

**Giả lập Facebook:** không

**Test:**
- test/dung-ai.test.js (mới): vượt trần → dung_ai không phải khan_cap; chayAgent bị bỏ; thẻ vẫn gửi; 80%; khan_cap chặn thẻ; tự tắt theo luật; ngày có live
- Sửa test runtime.test.js và runtime-nang.test.js ở chỗ đang chờ khan_cap bật khi vượt trần

**Claude Code làm thay:** Sửa hàng loạt các nơi gọi (việc máy móc). Soạn câu báo nhận và câu trên dải. Tự chạy buổi tập với chi phí giả để xem dải vàng, đỏ và chụp màn hình.

**Thử AI thật:** không

**Phụ thuộc:** Nên làm trước F-68 để thẻ không bị công tắc chi phí chặn giữa chừng.

**Rủi ro:** Đã có nút "DỪNG AI" theo phiên trên Màn hình người dẫn (phongAi.dungAi: ngắt câu đang nói), dễ nhầm với trạng thái "Dừng AI" mới. Giao diện ghi rõ "AI tạm dừng vì chạm trần chi phí". Sót một nơi gọi thì vượt trần vẫn bật khan_cap như cũ; test quét mọi nơi gọi kiemMucTran.

**Mặc định tự chọn:** Trần ngày có live 20 USD. Lý do: GPT Live 1 khoảng 3 USD/giờ × 4 giờ, cộng Director, Co-host, Tư vấn viên và buổi tập ≈ 14–16 USD; 15 USD cũ dễ chạm giữa live. Không tự bật lại giọng giữa live để người dẫn không bị bất ngờ. Tư vấn viên cũng dừng khi Dừng AI (vì tốn tiền); tin khách vào Cần người kèm câu báo nhận để không mất khách.

### F-73 Nhận đúng lỗi "Page bị Meta tạm khóa nhắn tin" + danh sách nhắn bù

*Đề xuất: P04 · công sức: vua*

- Mã FB_PAGE_BI_CAM_NHAN (F-67) → `ket-noi.js khiLoiGraph` ghi Page đang bị cấm nhắn. trangThaiGon hiện đỏ "Page bị Meta tạm khóa nhắn tin", không báo nhầm "Thiếu quyền" nữa. Kèm hướng dẫn xem lý do ở mục Chất lượng Page / Page Integrity; không lách.
- Tự hỏi Page Integrity lúc mở phiên live và mỗi giờ (`fb.kiemHanChePage`), không dùng webhook vì địa chỉ Quick Tunnel đổi mỗi lần mở máy. Hết hạn chế, hoặc gửi thử thành công, thì bỏ trạng thái đỏ.
- Trong lúc Page bị cấm:
  - Hook F-66 chặn mọi tin nhắc;
  - ChotDon không thử nhắn riêng mà gom công khai bằng câu riêng: "shop giữ hàng cho mọi người rồi, Messenger đang trục trặc, shop nhắn ngay khi mở lại". Câu chỉ có tên gọi, không có món hay số tiền, không mời "nhắn tin cho Page" (chot-don.js:241 hiện đang mời).
- KHÔNG tự gia hạn giữ hàng 48 giờ; hạn giữ chạy như thường.
- Mỗi bình luận nhắn riêng hỏng vì lỗi này vào bảng `nhan_bu` với hạn = lúc bình luận + 7 ngày.
- Màn Đơn hàng có thẻ "Nhắn bù (N)" để người quyết: nhắn bù từng người, nhắn bù tất cả, hoặc bỏ.
- Nhắn bù rải dần 1 tin mỗi 20 giây, dừng ngay nếu gặp lại lỗi 1893063:
  - đơn còn chờ → thẻ giữ hàng;
  - đơn đã hủy vì quá giờ → thẻ mời giữ (GIU_MOI) nếu còn hàng, hết hàng thì ghi lý do và bỏ;
  - quá hạn 7 ngày → het_han.

**Tiêu chí:**
- [ ] Facebook giả bật camNhan → dải đỏ đúng chữ; không còn chữ "Thiếu quyền"
- [ ] Có người chốt khi Page bị cấm → bình luận công khai câu riêng, không có "nhắn tin cho Page"; bình luận vào danh sách Nhắn bù
- [ ] Tắt camNhan, bấm "Nhắn bù tất cả" → tin gửi cách nhau ≥ 20 giây; bình luận quá 7 ngày không gửi
- [ ] Đơn đã hủy khi nhắn bù → thẻ mời giữ nếu còn hàng
- [ ] Page Integrity giả báo hạn chế lúc mở phiên → đỏ ngay, trước khi có ai chốt

**Tệp sửa:** `server/facebook/ket-noi.js`, `server/facebook/that.js (kiemHanChePage)`, `server/facebook/gia.js`, `server/chot-don.js`, `server/nghiep-vu/nhan-bu.js (mới)`, `server/hop-thu.js (nhịp gửi rải dần)`, `server/api/don.js (GET /don/nhan-bu, POST /don/nhan-bu/gui, POST /don/nhan-bu/:id/bo)`, `public/js/man-hinh/don.js`, `public/js/man-hinh/tong-quan.js`, `server/phong-live.js (kiểm lúc gắn live)`

**Dữ liệu:** Bảng mới `nhan_bu` (id, fb_comment_id, binh_luan_id, don_id NULL, page_id, han_luc, trang_thai CHECK IN ('cho','da_gui','bo','het_han'), ly_do, tao_luc, xu_ly_luc). Lý do: cần một danh sách người quyết, có hạn 7 ngày; không đổi CHECK của tin_nhan.

**Cấu hình, câu mẫu, Skill, Hook:** không

**Giả lập Facebook:** gia.js: `camNhan` (mọi lệnh gửi ném 10/1893063); `hanChe` cho kiemHanChePage trả {bi_han_che, ly_do}; bật tắt được trong Phòng diễn tập.

**Test:**
- test/page-bi-khoa.test.js (mới): nhận mã, trạng thái đỏ, chặn nhắc, câu gom riêng, danh sách nhắn bù, rải dần, 7 ngày tính từ lúc bình luận, Page Integrity lúc mở phiên

**Claude Code làm thay:** Tra tài liệu Page Integrity API (đường gọi, trường trả về) và trang mã lỗi Messenger, ghi ngày tra. Soạn câu gom công khai và câu nhắn bù. Soạn hướng dẫn cho chủ dự án khi Page bị khóa.

**Thử AI thật:** không

**Phụ thuộc:** F-67 (doiLoi), F-66 (chặn nhắc), F-68 (thẻ, thẻ mời).

**Rủi ro:** Mã lỗi mới chỉ thấy trong tài liệu, chưa gặp trên Page thật. Dạng trả về của Page Integrity chưa chắc, nên để trong that.js cho dễ sửa. Nhắn bù dồn dập dễ bị khóa lại, nên rải dần và để người bấm.

**Mặc định tự chọn:** Rải 3 tin mỗi phút. Người bấm mới nhắn bù, không tự nhắn khi Page vừa mở. Không gia hạn giữ hàng (theo phiếu soi lỗi góc bán hàng).

### F-74 Chống kẻ gian giả làm shop

*Đề xuất: P43 · công sức: nho*

- `nhan-binh-luan.js` thêm nhãn `nghi_lua_dao` khi bình luận của người không phải Page có:
  - số tài khoản (6–19 chữ số đi kèm chữ "stk", "tk", "số tài khoản", "ck", "chuyển khoản" hay tên ngân hàng; không tính số điện thoại, vì số điện thoại đã có luật riêng #19);
  - hoặc đường link không phải facebook.com / m.me (bit.ly, zalo.me, t.me, http…).
- Hook `an-thong-tin-ca-nhan.js` ẩn luôn các bình luận này qua công cụ an_binh_luan (mở rộng lý do 'lua_dao'). Khác số điện thoại: KHÔNG chuyển "Chờ Tư vấn viên" mà đặt xu_ly 'bo_qua'. Màn hình người dẫn báo "Đã ẩn 1 bình luận nghi giả shop". Bình luận bài đăng trong Hộp thư (phan-loai-tin.js) cũng ẩn.
- Câu "Shop chỉ nhận tiền vào TK tên {ten_chu_tk} và chỉ gửi mã QR trong Messenger của Page" có trong thẻ đơn (the-don.js noiDung, vẫn ≤ 640 ký tự) và trong câu ghim (F-77). Chưa có tên chủ tài khoản thì dùng câu "Shop không bao giờ xin chuyển khoản qua bình luận".
- Không tự trả lời công khai để cảnh báo, tránh cãi nhau trên sóng.

**Tiêu chí:**
- [ ] ≥ 40 mẫu (Claude Code soạn): STK, tên ngân hàng + số, link lạ → nhãn đúng; "chốt 12 đen M", "size 38", "159k", "DH-0042", số điện thoại → không có nhãn này
- [ ] Bình luận live có STK → bị ẩn trên Facebook giả, không vào Chờ Tư vấn viên, người dẫn thấy dòng báo
- [ ] Thẻ đơn có dòng "Shop chỉ nhận tiền vào TK tên …" và vẫn ≤ 640 ký tự khi đơn có 5 món

**Tệp sửa:** `server/nghiep-vu/nhan-binh-luan.js`, `server/agent/hook/an-thong-tin-ca-nhan.js`, `server/agent/cong-cu/an-binh-luan.js`, `server/nghiep-vu/live.js`, `server/agent/hook/phan-loai-tin.js`, `server/nghiep-vu/the-don.js`, `server/nghiep-vu/cai-dat.js`, `public/js/man-hinh/cai-dat.js`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** Một ô mới trong Cài đặt → Bán hàng: "Tên chủ tài khoản nhận tiền" (`ten_chu_tk`). P21 ở mốc sau dùng lại ô này, chỉ thêm ngân hàng và số tài khoản.

**Giả lập Facebook:** Thêm kịch bản diễn tập "kẻ gian để lại STK và link" trong kich-ban-dien-tap.json; gia.js đã có anBinhLuan.

**Test:**
- test/nhan-binh-luan.test.js: ≥ 40 mẫu lừa đảo / không lừa đảo
- test/hook.test.js: ẩn, không chuyển Tư vấn viên
- test/the-don.test.js: dòng TK và giới hạn 640

**Claude Code làm thay:** Soạn danh sách từ khóa ngân hàng, cách viết STK, link lạ, và bộ mẫu kiểm (cả câu dễ nhầm). Soạn câu cảnh báo.

**Thử AI thật:** không

**Phụ thuộc:** Không (làm độc lập). Câu ghim ở F-77 dùng lại.

**Rủi ro:** Ẩn nhầm bình luận thật có chuỗi số dài (mã đơn, mã vận đơn). Giảm bằng cách đòi đi kèm chữ ngân hàng / stk và có bộ mẫu kiểm câu dễ nhầm.

**Mặc định tự chọn:** Chỉ ẩn và báo người dẫn, không trả lời công khai. Chưa có tên chủ tài khoản thì dùng câu chung, không bỏ dòng.

### F-75 Nhãn "Trợ lý AI · Phụ trách: …" trên hình + câu mô tả buổi live

*Đề xuất: P35 · công sức: nho*

- `public/thanh-chu.html` có nhãn nhỏ góc trên (không che sản phẩm): "Trợ lý AI · Phụ trách: {phu_trach}", chưa điền người phụ trách thì "Trợ lý AI của {ten_shop}".
- Nhãn hiện suốt khi có phiên đang live hoặc tập mà AI không ở chế độ "Tắt AI"; Thanh chữ có mặt ở mọi cảnh OBS (obs.js:141–148). Không có nút tắt.
- `public/man-hinh-san-pham.html` có cùng nhãn, phòng khi dùng riêng Màn hình sản phẩm.
- Dữ liệu nhãn đi theo `/api/man-hinh` và sự kiện mhsp.hien (man-hinh-san-pham.js); đổi cài đặt thì nhãn đổi ngay.
- Cài đặt → Bán hàng thêm:
  - "Người phụ trách buổi live" (chữ);
  - "Cách xưng hô" (chọn từ danh sách), dùng cho câu do mã soạn (thẻ, nhắc, câu ghim).
- Câu mô tả buổi live do MOZA soạn sẵn, có nút Chép, nằm ở bảng Sẵn sàng (F-77). MOZA không có quyền sửa bài nên chủ shop tự dán. Ví dụ: "Buổi live có sử dụng trợ lý AI ({ten_ai}) để đọc tên, trả lời giá, size và nhắn tin xác nhận đơn. Người phụ trách: … ".

**Tiêu chí:**
- [ ] Bản xem thử: mở /thanh-chu.html khi có phiên tập → thấy nhãn góc; chụp màn hình lưu vào SPEC mục 12
- [ ] Không có API hay ô nào tắt được nhãn (test tìm)
- [ ] Đổi người phụ trách → nhãn đổi trong ≤ 2 giây qua ws
- [ ] Câu mô tả có chữ "trợ lý AI" và tên người phụ trách

**Tệp sửa:** `public/thanh-chu.html`, `public/man-hinh-san-pham.html`, `public/js/man-hinh-san-pham.js`, `server/man-hinh-san-pham.js`, `server/api/man-hinh.js`, `server/nghiep-vu/cai-dat.js`, `public/js/man-hinh/cai-dat.js`

**Dữ liệu:** không (khóa ban_hang thêm phu_trach, xung_ho)

**Cấu hình, câu mẫu, Skill, Hook:** 2 ô mới trong Cài đặt → Bán hàng: người phụ trách (chữ) và cách xưng hô (chọn: "mình – bạn" mặc định, "shop – chị", "em – anh/chị", "shop – bạn").

**Giả lập Facebook:** không

**Test:**
- test/man-hinh-san-pham.test.js: dữ liệu nhãn, không có công tắc, đổi cài đặt phát mhsp.hien

**Claude Code làm thay:** Soạn chữ nhãn, câu mô tả, danh sách cách xưng hô. Mở bản xem thử bằng preview_start "moza", chụp màn hình Thanh chữ và Màn hình sản phẩm có nhãn. Soạn ghi chú nhờ luật sư xem câu chữ nhãn.

**Thử AI thật:** không

**Phụ thuộc:** Không (làm sớm được).

**Rủi ro:** Câu chữ nhãn có thể chưa đạt yêu cầu Luật AI 134/2025 Điều 11; cần luật sư xem trước live thật. P14 ở mốc khác cũng sửa thanh-chu.html, nên làm trước và cẩn thận khi gộp.

**Mặc định tự chọn:** Nhãn luôn hiện ở góc trên trái, cỡ nhỏ, nền mờ. Xưng hô mặc định "mình – bạn" vì máy không biết giới tính khách.

### F-76 Giá gạch chỉ hiện khi có bằng chứng

*Đề xuất: P34a · công sức: nho*

- Hàm `bangChungGiaGoc(sp)` trong server/nghiep-vu/san-pham.js (SQL): có dòng don_dong của sản phẩm với don_gia = gia_goc, trong đơn đã giao ('da_giao', không phải diễn tập), giao trong 30 ngày gần nhất.
- Màn hình sản phẩm (man-hinh-san-pham.js:73) chỉ trả gia_goc khi có bằng chứng.
- Thẻ sản phẩm cho AI (san-pham.js:562 dòng "Giá gốc (trước giảm)") cũng chỉ có dòng này khi có bằng chứng, để AI không nói "giảm từ …".
- Dưới ô Giá gốc ở màn Sản phẩm hiện: "Chưa có đơn giao ở giá này trong 30 ngày: giá gạch đang ẩn trên màn hình và AI không nói 'giảm từ'". Cảnh báo lúc lưu (san-pham.js:407) thêm ý này.
- Shop mới chưa có đơn giao nên giá gạch coi như TẮT ngay (đúng khuyến nghị "tạm tắt tới khi có bằng chứng"). Cách B ở mục 6.1 (giá live) làm ở mốc sau, dùng lại hàm này.

**Tiêu chí:**
- [ ] Sản phẩm có gia_goc > gia, chưa có đơn giao → /api/man-hinh không có gia_goc; theChoAi không có dòng giá gốc
- [ ] Có đơn đã giao ở đúng giá gốc 10 ngày trước → hiện; 40 ngày trước → không; đơn diễn tập → không tính
- [ ] Màn Sản phẩm hiện dòng giải thích

**Tệp sửa:** `server/nghiep-vu/san-pham.js`, `server/man-hinh-san-pham.js`, `public/js/man-hinh/san-pham.js`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** không

**Giả lập Facebook:** không

**Test:**
- test/san-pham.test.js: bằng chứng 30 ngày, diễn tập không tính, thẻ AI
- test/man-hinh-san-pham.test.js: gia_goc ẩn / hiện

**Claude Code làm thay:** Viết câu SQL và dữ liệu test (đơn giao ở các mốc 10 / 40 ngày). Soạn dòng giải thích.

**Thử AI thật:** không

**Phụ thuộc:** Không (làm sớm được).

**Rủi ro:** Luật sư có thể yêu cầu định nghĩa giá gốc khác (ví dụ giá niêm yết liên tục N ngày). Hàm để một chỗ nên dễ đổi.

**Mặc định tự chọn:** Cửa sổ 30 ngày, và chỉ đơn "Đã giao" mới tính là bằng chứng. Tính theo cả mẫu, không theo từng phân loại, cho đơn giản.

### F-77 Bảng "Sẵn sàng lên sóng"

*Đề xuất: P07 · công sức: vua*

- Module dịch vụ `server/san-sang.js` gom trạng thái, không có SQL; đọc từ caiDat, chiPhi, ketNoiFb, obs, kho, sản phẩm trong kịch bản. API `GET /live/san-sang`, `POST /live/san-sang/tich`.
- Bảng thay khung "Kiểm tra trước khi live" (public/js/man-hinh/live.js:130–206) và có 1 dòng trên Tổng quan. Chỉ hiện dòng đỏ, vàng khi máy tự kiểm thấy lỗi:
  - Đỏ: "Dừng mọi thứ" đang bật (có nút Tắt); Page bị hạn chế nhắn tin; mã Page hết hạn hoặc thiếu quyền (có page_utility_messaging); đã gặp lỗi FB_CHUA_DUYET (ứng dụng chưa được duyệt).
  - Vàng: "Dừng AI" đang bật hoặc chi phí ≥ 80% trần; webhook ngắt (đang hỏi định kỳ); phí ship trống; món trong kịch bản hết hàng, thiếu ảnh, ngừng bán, thiếu bảng size; chưa điền người phụ trách; chế độ Đội AI mà câu chen còn ít.
- Phép thử "chốt test": sau khi live gắn vào phiên, chủ shop dùng tài khoản cá nhân bình luận "chốt test". MOZA không tạo đơn; nhắn riêng một thẻ thử (lượt chot_test): "MOZA đã nhận 'chốt test' lúc 20:01, đường chốt đơn đang chạy — tin này nằm ở hộp nào trên máy bạn?". Bảng hiện "Đã nhận chốt test của <tên> · nhắn riêng: đã gửi / lỗi …".
- 3 ô người tự tích (lưu theo phiên trong cai_dat 'san_sang_tich'): đã tắt chế độ Thảo luận; đã tắt "Bình luận → tin nhắn" và Business AI trong Meta Business Suite; đã dán câu ghim.
- Câu ghim do MOZA soạn, có nút Chép: "Chốt: số + màu + size, ví dụ chốt 12 đen M. Trợ lý AI của shop nhắn riêng, xem cả Tin nhắn chờ. Shop chỉ nhận tiền vào TK tên … qua Messenger của Page. Chưa thấy tin: m.me/…?ref=…". Ví dụ lấy từ món đầu của kịch bản. Câu mô tả buổi live (F-75) cũng có nút Chép.
- Không khóa nút Bắt đầu. Còn dòng đỏ thì hỏi lại một lần.

**Tiêu chí:**
- [ ] Bật khan_cap → bảng có dòng đỏ và nút Tắt; tắt xong dòng biến mất
- [ ] Kịch bản có món hết hàng → dòng vàng nêu đúng số món
- [ ] Facebook giả: bình luận "chốt test" → bảng báo đã nhận, khung chat giả có thẻ thử, kho và đơn không đổi
- [ ] Câu ghim có ví dụ đúng số món đầu, có dòng TK, có link m.me
- [ ] Không còn dòng nào → bảng chỉ hiện "Sẵn sàng" + 3 ô tích + 2 nút Chép

**Tệp sửa:** `server/san-sang.js (mới)`, `server/api/live.js`, `server/phong-live.js (chốt test)`, `server/nhan-y-dinh.js`, `server/nghiep-vu/cai-dat.js`, `public/js/man-hinh/live.js`, `public/js/man-hinh/tong-quan.js`

**Dữ liệu:** không (khóa cai_dat 'san_sang_tich' lưu 3 ô tích và kết quả chốt test của phiên gần nhất)

**Cấu hình, câu mẫu, Skill, Hook:** Không có ô nhập mới ngoài 3 ô tích theo buổi.

**Giả lập Facebook:** Dùng các công tắc đã thêm (camNhan, hanChe, khongNhanRieng, hopNhan) để hiện đủ các dòng. Thêm kịch bản "chốt test".

**Test:**
- test/san-sang.test.js (mới): từng dòng theo trạng thái; chốt test không tạo đơn và có thẻ thử; lưu ô tích; câu ghim đúng

**Claude Code làm thay:** Soạn câu ghim, câu mô tả, chữ từng dòng kiểm (lời thường, có cách sửa). Mở bản xem thử, bật từng công tắc Facebook giả, chụp màn hình bảng. Soạn hướng dẫn tắt chế độ Thảo luận và "Bình luận → tin nhắn" trong Live Producer / Business Suite (tra trang Meta, ghi ngày).

**Thử AI thật:** không

**Phụ thuộc:** Làm sau cùng vì gom trạng thái của F-67, F-72, F-73, F-74, F-75, F-70 (link m.me).

**Rủi ro:** Người dùng có thể tích cho xong mà không làm thật; đã giữ ít ô và thay bằng phép thử "chốt test". Nếu tài khoản thử có vai trò trong ứng dụng thì "chốt test" vẫn qua dù ứng dụng chưa duyệt; bảng ghi rõ điều này.

**Mặc định tự chọn:** Chốt test có nhắn riêng thẻ thử, để kiểm luôn nhắn riêng và hộp nhận tin. Ô "xác thực danh tính người livestream" không đưa vào bảng từng buổi (việc làm một lần, ở danh sách việc chủ dự án).

### F-78 Quá 24 giờ: nút mở đúng cuộc trò chuyện trong Meta Business Suite

*Đề xuất: P05 · công sức: nho*

- Hộp thư (public/js/man-hinh/hop-thu.js:133–139): hội thoại Messenger đã quá 24 giờ kể từ tin cuối của khách thì ẩn ô gõ trả lời, hiện dòng "Quá 24 giờ: trả lời bằng Meta Business Suite trên điện thoại" kèm nút mở đúng cuộc trò chuyện (link theo page_id và psid, dựng ở server). Không xin quyền mới, không gửi gì ra Facebook.
- Chưa làm thẻ HUMAN_AGENT; để sau vì cần xét duyệt ứng dụng.

**Tiêu chí:**
- [ ] Hội thoại quá 24 giờ → API trả link, giao diện ẩn ô gõ và hiện nút
- [ ] Hội thoại trong 24 giờ → không có nút, ô gõ như cũ
- [ ] Không có lệnh nào gửi ra Facebook giả khi bấm

**Tệp sửa:** `public/js/man-hinh/hop-thu.js`, `server/api/hop-thu.js`, `server/nghiep-vu/hop-thu.js (hàm dựng link)`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** không

**Giả lập Facebook:** không (chỉ là link mở trình duyệt)

**Test:**
- test/hop-thu.test.js: link có đúng page và người, chỉ hiện khi quá 24 giờ

**Claude Code làm thay:** Tra dạng link Business Suite mở đúng cuộc trò chuyện, ghi ngày tra. Soạn câu hướng dẫn.

**Thử AI thật:** không

**Phụ thuộc:** Không.

**Rủi ro:** Dạng link Business Suite có thể đổi, hoặc không mở đúng hội thoại trên điện thoại; kiểm ở Bước 0. Không mở được thì lùi về link hộp thư của Page. Business Suite có cho trả lời tới 7 ngày không: chưa kiểm chứng.

**Mặc định tự chọn:** Chỉ hiện nút, không tự làm gì. Link lùi về trang hộp thư chung của Page.

---

## BH6 — Trên sóng: tư vấn đúng người, trình diễn thật, bằng chứng thật (P11, P12, P13, P14 bước 1, P15 phần rẻ, P16, P17 cách A, P34 phần K11, P44). Tag đề xuất: bh6-tren-song. Số F-xx / #xx đánh khi ghi SPEC theo thứ tự các mốc được duyệt (tính năng từ F-65, quyết định từ #91).

**Định nghĩa xong:** - `npm test` đạt toàn bộ: 537 test cũ và các test mới, 0 hỏng. Test chạy với Node 26, TEMP/TMP đặt sang data\tam-test.
- Mọi tiêu chí của 9 tính năng kiểm được bằng Facebook giả và AI giả.
- Chạy bản xem thử (preview_start moza, cổng 5190; trước đó kiểm cổng 5173/5190 còn trống, không chạy cùng bản tuyển dụng):
  - chạy các kịch bản diễn tập mới: khách xin xem, hỏi size theo số đo + lệnh người mẫu, khách lưỡng lự, 8 người chốt + ẩn tên + 1 đơn hủy, bình chọn màu, người xem 150;
  - chạy ở chế độ Chỉ gợi ý và Đội AI; tiếng thật của Đội AI chỉ khi còn lượt giọng Google;
  - chụp Màn hình người dẫn, Thanh chữ 1920×1080 và Màn hình sản phẩm; Claude Code tự xem ảnh, kiểm không đè nhau và không có số đo của khách trên sóng.
- Claude Code đọc nhật ký buổi tập và tự chấm: câu của Mai hay Đội AI có số lạ không, có từ cấm không, câu gỡ lưỡng lự có nguồn không. Kết quả ghi vào SPEC.
- Cập nhật SPEC.md:
  - các F-xx mới, quyết định #9x (luật con số của Mai, lưu chép lời người dẫn vào nhật ký 90 ngày, tư vấn size trên sóng bằng mã, video dựng thử không chiếu ở buổi thật, K11, số người chốt, bình chọn không quà);
  - mục 7: bảng nhat_ky_song, cờ dung_thu;
  - A.4: K11; A.7: Skill go-luong-lu; mục 6: ngày tra giá Transcribe;
  - mục 12: kết quả, số test, chi phí thật theo hãng; mục 13: rủi ro mới;
  - thêm câu hỏi live_views và bình luận 1 chữ vào danh sách Bước 0.
- Commit + tag `bh6-tren-song`, rồi dừng chờ chủ dự án duyệt.

**Thứ tự:**
- 1. K11 danh sách từ cấm (P34): nhỏ, không phụ thuộc gì. Mọi câu mẫu, Skill, lời dặn mới của mốc phải qua K11 ngay từ đầu.
- 2. Nhật ký buổi live + luật "Mai không tự nói con số" (P15): tạo bảng nhat_ky_song mà P11, P13, P17 ghi vào; đổi lời dặn miệng một lần cho cả mốc.
- 3. Thẻ nhắc khách xin xem + cờ video dựng thử (P11): dựng khung thẻ nhắc (the-nhac.js) và bộ gắn nhãn bình luận bằng mã, để P12 và P17 dùng lại.
- 4. Tư vấn size gọi tên + người mẫu (P13): giá trị bán hàng cao nhất (điểm 5). Tạo nguồn "người mẫu" mà P12 cần.
- 5. Số người chốt + cảm ơn + ẩn tên + sửa số 5 (P14): tạo hàm ẩn tên dùng chung và hàm đếm người chốt mà P16 dùng lại.
- 6. Gỡ lưỡng lự (P12): cần thẻ nhắc, người mẫu, cờ video, K11. Phải đổi lược đồ phiếu Director nên làm khi các phần trên đã ổn.
- 7. Dòng số liệu + Tiếp theo + gợi ý nhịp (P16): dùng hàm đếm của P14; thêm số người xem vào Facebook giả.
- 8. Bình chọn bằng bình luận (P17): dùng thẻ nhắc, Thanh chữ, nhật ký.
- 9. Từ riêng cho phần nghe người dẫn (P44): làm cuối, khi đã có đủ các lệnh bằng lời mới (người mẫu, cảm ơn, bình chọn).
- Sau cùng: chạy npm test toàn bộ; lái bản xem thử qua các kịch bản diễn tập mới; tự chấm nhật ký; ghi SPEC; commit + tag.

**Chi phí thử thật:** - OpenAI:
  - mặc định khoảng 0,01–0,03 USD: Tư vấn viên diễn tập (gpt-6-luna) và khách giả chạy thật khi xem thử có chốt đơn;
  - tùy chọn +0,15 USD nếu chủ dự án duyệt 1 phép thử GPT Live 1 dài 3 phút (dùng chung cho P15 và P12);
  - trần của mốc: 0,20 USD, nằm trong ngân sách dưới 1 USD cho cả đợt.
- Google:
  - khoảng 0,05–0,15 USD: Director và Co-host gemini-3.8-flash trong các lần xem thử; tùy chọn thêm Gemini 3.5 Transcribe Live 3 phút ≈ 0,03 USD;
  - tối đa khoảng 20 lượt giọng Google (hạn 100 lượt/ngày dùng chung với bản tuyển dụng), chỉ khi nghe thử Đội AI hoặc tạo tiếng giả.
- Anthropic: 0.
- Mọi phép thử tốn tiền đều báo trước và chờ chủ dự án đồng ý. Mặc định kiểm bằng AI giả và Facebook giả, 0 đồng.

**Ghi chú khi đọc mã:** PHÁT HIỆN KHI ĐỌC MÃ
- P44 phần lớn đã có: chep-loi.js đã truyền customVocabulary (Gemini, cắt 1000) và keywords (OpenAI, cắt 100) lấy từ tuRiengCua (chep-loi-nguoi-dan.js:164). Còn thiếu màu, cỡ, cách gọi số món, lệnh, và thứ tự ưu tiên trong 100 từ. Miệng Gemini 3.8 Live (gemini-live.js:76, inputAudioTranscription {}) chưa nạp từ riêng; GPT Live 1 không có chỗ nạp.
- Giá gemini-3.5-transcribe-live 3,5 / 21 trong gia-model.json là ĐÚNG (trang giá Gemini tra 27/9/2026: bản Live 3,50 / 21; bản thường gemini-3.5-transcribe 2 / 12). Nghi ngờ trong báo cáo không đúng, không cần sửa. Chỉ còn thiếu mốc giá gấp đôi 1/1/2027 của gemini-3.8-live; việc này thuộc việc nền của mốc khác, cùng tệp.
- Màn hình sản phẩm đang in số đo của khách lên sóng: public/js/man-hinh-san-pham.js:76–86 hiện \"Bạn cao 158cm · 50kg → size M\". Trái P13, sửa trong BH6.
- K3 vốn đã chặn Co-host nhắc lại số đo khách trên sóng (kênh song không truyền soKhachNoi). Nhưng Skill tu-van-size có \"ví dụ đúng\" nhắc lại số đo → Co-host bị chặn rồi phải soạn lại. Cần sửa Skill.
- Màn hình người dẫn đã có dòng \"Tiếp theo\" (nguoi-dan.js, veDoan, eKe). P16 chỉ còn thêm phần cho khách thấy (Thanh chữ, câu sap_toi) và dòng số liệu.
- cau_tren_song.loai có ràng buộc CHECK chỉ nhận 'cohost' / 'director' → câu tư vấn size do máy soạn lưu loại 'cohost', run_id NULL, không phải đổi bảng.
- gieoSkill (nghiep-vu/skill.js:34) chỉ chèn Skill khi bảng rỗng → Skill mới go-luong-lu sẽ không tự vào dữ liệu đang chạy; phải sửa hàm. Mọi lời dặn và Skill sửa đổi phải chép bản cũ sang loi-dan-mau-cu.json / skill-mau-cu.json (hai tệp này đang trống), nếu không dữ liệu đang chạy sẽ không được nâng.
- kiemDanhSachVideo (san-pham.js:215) chỉ giữ tep và mau → cờ dung_thu sẽ mất nếu không sửa.
- Lược đồ phiếu Director là loại chặt: thêm luong_lu thì phải thêm vào required và sửa các phiếu giả trong test cũ. Danh sách Skill của Co-host đang viết cứng ở director.js:141.
- SPEC-TD #33 ghi \"chép lời người dẫn không lưu\" (phong-ai.js themLoiNguoiDan chỉ giữ 90 giây). P15 thay đổi điều này → cần quyết định mới.
- Lời dặn Director và Skill nhuong-loi đang ghi \"size theo số đo riêng → Tư vấn viên\", mâu thuẫn P13; sửa trong BH6.
- F-30 (bộ nhớ khách) đang cho Tư vấn viên lưu số đo khách. Phiếu soi lỗi pháp lý khuyên chỉ lưu khi khách đồng ý (P20). Việc này ngoài BH6; BH6 không lưu số đo khách.
- Luồng streaming live_comments (that.js:76) không có tham số lọc: bình luận 1 chữ (\"A\" cho bình chọn) có thể bị Meta lọc. Chế độ Thảo luận còn ẩn bình luận dưới 100 ký tự. Cần thêm vào Bước 0.
- Tệp nâng cấp: tên gợi ý 0xx-tren-song.sql, gồm bảng nhat_ky_song và cờ dung_thu cho video. Số thứ tự lấy sau các tệp của mốc khác (bắt đầu từ 018); không sửa tệp cũ. Không thêm thư viện nào.

XUNG ĐỘT / PHỐI HỢP VỚI MỐC KHÁC
- P01 (nhắc người chốt, \"ẩn tên\", câu gọi tên): BH6 tạo hàm live.daAnTen và áp cho Thanh chữ, cảm ơn, #72 và các câu mới. Mốc nào làm trước thì tạo hàm, mốc sau dùng lại.
- Việc nền \"trần số câu chen Đội AI mỗi buổi\": BH6 thêm khoảng 8 loại câu chen (da_nghe_yeu_cau, tu_van_size, dem_chot, cam_on_cuoi, sap_toi, binh_chon…), mỗi câu tốn 1 lượt giọng Google. Nếu nền chưa làm thì BH6 phải tự đặt trần tạm.
- P42 (tách \"Dừng AI\" và \"Dừng mọi thứ\"): các phần chạy bằng mã của BH6 (thẻ nhắc, số trên Thanh chữ, nhật ký, đếm phiếu) nên vẫn chạy khi \"Dừng AI\" tự bật vì chi phí. Câu chen của Đội AI thì dừng.
- P34a (giá gạch) và 6.1 (giá live): cùng sửa theSanPham (man-hinh-san-pham.js:70) và Thanh chữ. P35 (nhãn \"Trợ lý AI\"): cùng sửa thanh-chu.html. Cần thống nhất bố cục: nhãn AI góc trên phải; ô món có số người chốt và dòng Mẫu; \"Tiếp theo\" nằm trên ô món; bình chọn góc trên trái; dòng cảm ơn chạy ngang đáy.
- P31 (điền Sổ tay chính sách đổi size) là nguồn chính của P12; Sổ tay trống thì P12 im.
- P08, P32: nên dùng lại nhật ký và soLieuPhien của BH6.
- Việc nền \"lưu giờ bắt đầu live do Facebook trả về\" (live.ganLive) giúp nhật ký khớp phút trong video.
- P14 bước 2 chờ P27. P20 (nhớ size khách) không được dùng số đo on-air của P13.

CẦN HỎI CHỦ DỰ ÁN
1. Có duyệt 1 phép thử GPT Live 1 dài 3 phút (~0,15 USD OpenAI) để nghe Mai đọc đúng \"câu giá\" và gỡ lưỡng lự không? Mặc định là không thử.
2. Giữ nhật ký 90 ngày có được không, tạm dùng tới khi luật sư trả lời?
3. Xác nhận chưa tải video quay thật nào, để đánh dấu toàn bộ video hiện có là \"dựng thử\".
4. Khi gọi tên khách, dùng tên trơn (không \"chị/anh\") tới khi có danh sách xưng hô của P35 — có đồng ý không?
5. Các ngưỡng: 5 người chốt mới hiện số; bình chọn tối đa 2 lần mỗi buổi.
6. Nhờ luật sư xem: danh sách từ cấm K11, giấy đồng ý người mẫu (Claude Code soạn nháp), cách hiện số \"người chốt\" (Điều 6 Luật TMĐT), thời hạn lưu nhật ký.

### Danh sách từ cấm K11 trong Bộ kiểm tra

*Đề xuất: P34 · công sức: nho*

- Thêm luật K11 vào kiemTraCau (server/agent/kiem-tra/kiem-tra.js). Luật chạy trong hook kiểm tra sẵn có ở cửa truoc_cong_cu, áp cho mọi kênh: song, binh_luan, nhan_rieng, messenger.
- Danh sách để trong tệp cấu hình mới server/cau-hinh/tu-cam.json (sửa tệp là đổi được, không cần sửa mã). Có 5 nhóm:
  - thuong_hieu, luôn chặn: "dáng Zara", Zara, Gucci, Chanel, LV, Dior, Uniqlo, H&M, "auth", "hàng hiệu", "hàng xịn", "rep 1:1", "super fake", "fake".
  - tuyet_doi, luôn chặn: "số 1", "số một", "tốt nhất", "rẻ nhất", "đẹp nhất", "duy nhất", "nhất thị trường", "hàng đầu". Cách gọi món "áo số 1" đã được boGoiSo bỏ trước khi so nên không bị chặn.
  - so_sanh, luôn chặn: "shop khác", "rẻ hơn chỗ khác", "ngoài chợ", "bên kia bán".
  - xuat_xu, chặn trừ khi có nguồn: "hàng xuất khẩu", "VNXK", "Quảng Châu loại 1", "QC loại 1", "hàng Thái", "hàng Hàn", "hàng Nhật".
  - cong_dung, chặn trừ khi có nguồn: "kháng khuẩn", "chống nắng", "chống tia UV", "khử mùi", "thải độc", "giảm mỡ".
- "Có nguồn" nghĩa là cụm đó nằm nguyên văn trong đoạn trích của thẻ sản phẩm (ô người đã xác nhận, không còn nhãn "AI đoán") hoặc của Sổ tay. Tức là chủ shop tự ghi và tự chịu trách nhiệm giữ giấy tờ.
- So trên chữ bỏ dấu, so nguyên từ, không bắt chữ con.
- Lỗi trả mã K11 kèm cách sửa, ví dụ "bỏ cụm 'hàng xuất khẩu' — chỉ nói khi thẻ sản phẩm ghi và shop có giấy tờ".
- Đội AI: soatSo (server/doi-ai/phong-thu.js:107) bỏ lượt thoại kịch bản có từ cấm, như đang bỏ câu sai số, và báo người dẫn.
- Lưu sản phẩm (nghiep-vu/san-pham.js): mô tả, điểm nổi bật, xuất xứ hoặc tên gọi khác có từ cấm thì trả canh_bao, không chặn: "cần giấy tờ chứng minh (Luật TMĐT Điều 23, 24)". Màn hình Sản phẩm hiện dòng vàng.
- Giới hạn: K11 không kiểm được tiếng miệng Live. Phần đó do tính năng Nhật ký đánh dấu sau buổi.

**Tiêu chí:**
- [ ] Bộ ≥ 40 câu mẫu K11 (≥ 25 bị chặn, ≥ 15 đạt) cho kết quả đúng 100%. Phải có: "áo số 1 màu đen" đạt; "hàng số 1 thị trường" chặn; "dáng Zara" chặn; "vải kháng khuẩn" chặn khi thẻ không ghi, đạt khi thẻ ghi và câu có trích dẫn dòng đó
- [ ] Test quét: mọi câu mẫu trong doi-ai-cau-mau.json, mọi vi_du_dung trong skill-mau.json, mọi lời dặn mẫu đều qua K11
- [ ] Co-host giả soạn câu có "hàng xuất khẩu" → bị chặn, soạn lại, câu bị chặn không hiện lên màn hình
- [ ] Lưu sản phẩm có mô tả "hàng VNXK" → có cảnh báo vàng, vẫn lưu được
- [ ] 78 ca K1–K10 cũ trong test/kiem-tra.test.js vẫn đạt

**Tệp sửa:** `server/agent/kiem-tra/kiem-tra.js`, `server/cau-hinh/tu-cam.json (mới)`, `server/doi-ai/phong-thu.js`, `server/nghiep-vu/san-pham.js`, `public/js/man-hinh/san-pham.js`, `server/cau-hinh/skill-mau.json + skill-mau-cu.json (thêm ví dụ sai vào Skill gioi-thieu-san-pham; chép bản cũ sang tệp -cu để dữ liệu đang chạy được nâng)`, `test/kiem-tra.test.js`, `test/soan-kich-ban.test.js hoặc test/doi-ai.test.js (soatSo bỏ lượt có từ cấm)`, `SPEC.md (A.4 thêm K11)`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** Tệp mới server/cau-hinh/tu-cam.json gồm 5 nhóm, mỗi nhóm có cờ luon_chan hoặc can_nguon. Skill gioi-thieu-san-pham thêm ví dụ sai. Không thêm ô Cài đặt. K11 chạy trong Hook kiểm tra sẵn có.

**Giả lập Facebook:** không

**Test:**
- test/kiem-tra.test.js: ≥ 40 ca K11, gồm cả câu dễ chặn nhầm ("áo số 1", "mát nhất" không nằm trong danh sách)
- test/kiem-tra.test.js: quét toàn bộ câu mẫu, Skill mẫu và lời dặn mẫu qua K11
- test/san-pham.test.js: lưu có từ cấm trả về canh_bao
- test Đội AI: soatSo bỏ lượt có "hàng Quảng Châu loại 1"

**Claude Code làm thay:** - Soạn danh sách bám điều luật. Trước khi chốt danh sách, tra lại Luật Quảng cáo (bản sửa 75/2025) và văn bản hướng dẫn về chữ "nhất", "số 1"; ghi ngày tra vào SPEC.
- Soạn ≥ 40 câu test.
- Rà toàn bộ câu mẫu và Skill hiện có qua K11.
- Soạn đoạn nhờ luật sư xem lại danh sách.
- Toàn bộ phần này không gọi AI.

**Thử AI thật:** không (0 USD)

**Phụ thuộc:** Không phụ thuộc gì. Nên làm đầu tiên vì mọi câu mẫu và Skill mới của mốc phải qua K11.

**Rủi ro:** - Chặn nhầm làm Co-host im trên sóng. Cách giảm: giữ danh sách ngắn, so nguyên từ, có test câu dễ nhầm.
- Tên riêng trùng từ thường (Mango). Cách giảm: chỉ bắt khi viết đúng dạng tên thương hiệu.
- Tiếng Mai nói trực tiếp không chặn được.
- Danh sách cần luật sư xem.

**Mặc định tự chọn:** - 3 nhóm luôn chặn: thương hiệu, tuyệt đối, so sánh. 2 nhóm chặn trừ khi có nguồn do người xác nhận: xuất xứ, công dụng.
- Khi lưu sản phẩm thì chỉ cảnh báo, không chặn, vì MOZA không biết shop có giấy tờ hay không; chủ shop tự ghi là tự chịu trách nhiệm.

### Nhật ký buổi live (chỉ chữ) và luật "Mai không tự nói con số"

*Đề xuất: P15 · công sức: vua*

- Bảng mới nhat_ky_song lưu CHỈ CHỮ những gì lên sóng, không lưu tiếng:
  - lời Mai: gom theo câu từ chép lời tiếng ra (mieng.js nhanChuMai), ngắt câu khi nghỉ ≥ 2 giây như DOAN_MAI_MOI_MS;
  - lời Đội AI: câu đã phát (dan-doi.js batDauPhat);
  - lời người dẫn: câu đã chốt của chép lời (chep-loi-nguoi-dan.js khiXong và mieng.js nhanChuNguoiDan);
  - màn hình và cảnh: ManHinhSanPham.chieu và chuyenCanh, ví dụ "Chiếu giới thiệu áo 12 · 159.000đ (Director)";
  - sự kiện của mốc: người mẫu, bình chọn, thẻ nhắc.
- Không chép lại dữ liệu đã có: câu Co-host đã nằm ở cau_tren_song, bình luận chốt gắn đơn đã nằm ở binh_luan_live.don_id. Khi đọc, nhật ký gộp 3 nguồn theo giờ.
- Xem nhật ký: Báo cáo → buổi live → nút "Nhật ký". Danh sách theo giờ, có ô tìm chữ (ví dụ "150k"), lọc buổi tập như báo cáo. API GET /api/live/phien/:id/nhat-ky?q=.
- Soát sau buổi bằng mã, không gọi AI:
  - câu của Mai có số tiền không trùng giá món nào trong phiên, phí ship hay mức miễn ship → đánh dấu "⚠ số cần xem lại";
  - câu có từ cấm K11 → đánh dấu "⚠ từ cấm";
  - chỉ đánh dấu, không đính chính trên sóng (bản đầy đủ A.5 để sau).
- Giữ 90 ngày rồi tự xóa; kiểm lúc khởi động và mỗi ngày một lần.
- Luật "Mai không tự nói con số" (quyết định mới):
  - Lời dặn mieng và mieng_dan đổi thành: Mai chỉ nói giá, số còn, phí ship, số đo, thời hạn khi đọc nguyên văn "câu số" MOZA vừa đưa trong lượt đó, hoặc đọc kết quả công cụ. Không tự nhớ, không tự tính, không làm tròn. Không chắc thì nói "giá trên màn hình nè".
  - loiGiaoDoan thêm dòng `Câu giá (đọc đúng nguyên văn): "…"`, lấy từ dòng "Giá:" của thẻ sản phẩm.
  - mieng.hoi và giaoMai kèm dòng dữ liệu của món được hỏi.
  - Thanh chữ vẫn luôn hiện giá (đã có).
- Đội AI (đọc câu mẫu do máy điền) và Co-host (đi qua Bộ kiểm tra) giữ như cũ.

**Tiêu chí:**
- [ ] Buổi tập với AI giả và miệng giả, chế độ Đội AI và Chỉ gợi ý: nhat_ky_song có đủ các loại mai, doi_ai, nguoi_dan, man_hinh, đúng thứ tự giờ; bản đọc gộp có câu Co-host và bình luận chốt kèm mã đơn
- [ ] Tìm "150k" trong nhật ký trả đúng câu
- [ ] Miệng giả nói "áo 12 giá 150 nghìn" khi giá thật 159.000đ → câu bị gắn "⚠ số cần xem lại"; nói đúng giá thì không bị gắn
- [ ] Chạy dọn với đồng hồ giả → dòng cũ hơn 90 ngày bị xóa, dòng mới còn
- [ ] Lời dặn mieng và mieng_dan mới có luật con số; dữ liệu đang chạy chưa sửa tay được nâng lên bản mới (loi-dan-mau-cu.json có bản cũ), test nâng mẫu đạt
- [ ] loiGiaoDoan có "Câu giá" đúng giá thẻ và vẫn ≤ LUOT_TOI_DA_KY_TU (1200 ký tự)

**Tệp sửa:** `server/db/nang-cap/0xx-tren-song.sql (mới, tên gợi ý — số thật lấy sau các tệp của mốc khác, bắt đầu từ 018)`, `server/nghiep-vu/nhat-ky-song.js (mới, chứa SQL)`, `server/agent/mieng/mieng.js (nhanChuMai, nhanChuNguoiDan, loiGiaoDoan, hoi)`, `server/doi-ai/dan-doi.js (batDauPhat)`, `server/chep-loi-nguoi-dan.js (khiXong)`, `server/man-hinh-san-pham.js (chieu, chuyenCanh)`, `server/agent/kiem-tra/kiem-tra.js (thêm hàm soát lời miệng dùng laySo, không có SQL)`, `server/api/live.js (GET /live/phien/:id/nhat-ky)`, `server/dich-vu.js (hẹn giờ dọn)`, `server/cau-hinh/loi-dan-mau.json + loi-dan-mau-cu.json`, `server/cau-hinh/mac-dinh.json`, `public/js/man-hinh/bao-cao.js`, `test/nhat-ky-song.test.js (mới)`, `test/mieng.test.js`

**Dữ liệu:** - Bảng mới nhat_ky_song, các cột:
  - id TEXT PK 'nk_…', phien_id REFERENCES phien_live, luc;
  - loai CHECK IN ('mai','doi_ai','nguoi_dan','man_hinh','su_kien');
  - noi_dung, san_pham_id NULL, canh_bao NULL;
  - chỉ mục (phien_id, luc).
- Lý do: hiện lời Mai, lời Đội AI, màn hình chưa được lưu ở đâu cả. Lời người dẫn chỉ giữ 90 giây trong bộ nhớ (PhongAi.themLoiNguoiDan) — theo SPEC-TD #33 là "không lưu", nên phần này cần một quyết định mới.
- Cùng tệp nâng cấp chứa cờ dung_thu của video (tính năng P11).

**Cấu hình, câu mẫu, Skill, Hook:** - mac-dinh.json thêm `nhat_ky_song: { giu_ngay: 90 }`.
- Lời dặn mieng và mieng_dan: thêm luật con số và cách gỡ lưỡng lự.
- Không thêm ô Cài đặt.

**Giả lập Facebook:** không

**Test:**
- test/nhat-ky-song.test.js: ghi và đọc gộp 3 nguồn, tìm chữ, dọn 90 ngày, đánh dấu ⚠ số và ⚠ từ cấm
- test/mieng.test.js: miệng giả sinh câu Mai vào nhật ký; loiGiaoDoan có Câu giá
- test/skill-vai-tro.test.js: nâng lời dặn mieng và mieng_dan từ bản mẫu cũ

**Claude Code làm thay:** - Viết lời dặn mới.
- Đọc nhật ký các buổi tập rồi tự chấm (đếm câu có số lạ, câu có từ cấm, Mai có đọc đúng Câu giá không) thay cho model chấm.
- Nháp đoạn chính sách quyền riêng tư về nhật ký và câu hỏi cho luật sư về thời hạn lưu.

**Thử AI thật:** - Mặc định: không.
- Tùy chọn, hỏi chủ dự án trước: 1 phép thử GPT Live 1 (OpenAI) dài 3 phút trong Phòng diễn tập, chế độ Mai dẫn chính, xem Mai có đọc đúng "Câu giá" và không tự nói số.
- Chi phí phép thử khoảng 0,15 USD (0,05 USD/phút). Dùng chung phép thử với tính năng Gỡ lưỡng lự.
- Không thử Gemini 3.8 Live vì đó không phải miệng mặc định.

**Phụ thuộc:** - Cần K11 để đánh dấu ⚠ từ cấm.
- Việc nền "lưu giờ bắt đầu live do Facebook trả về" (live.ganLive, mốc khác) giúp đối chiếu phút trong video, nhưng không chặn tính năng này.

**Rủi ro:** - Lời dặn không phải luật cứng, miệng Live vẫn có thể tự nói số. Cách giảm: đánh dấu sau buổi, giữ nút DỪNG AI.
- Nhật ký có tên gọi và lời người dẫn, là dữ liệu cá nhân → luật sư xem thời hạn lưu và ghi vào chính sách quyền riêng tư.
- Lượng dòng khoảng vài nghìn mỗi buổi, không đáng kể.

**Mặc định tự chọn:** - Giữ 90 ngày: dài hơn 30 ngày Facebook giữ video, đủ để xử lý khiếu nại giao hàng và đổi trả; đổi lại khi luật sư trả lời.
- Lưu theo câu.
- Không lưu thêm bình luận thường (đã có ở binh_luan_live).
- Chỉ đánh dấu số lạ, không đính chính tự động.

### Thẻ nhắc người dẫn khi khách xin xem (xoay lưng, soi vải, đứng xa, mặc màu khác) + đánh dấu video dựng thử

*Đề xuất: P11 · công sức: vua*

- Nhận bằng từ khóa, không gọi AI. nhan-binh-luan.js thêm nhãn muon_xem và hàm loaiMuonXem(noiDung) chia 4 loại:
  - mat_sau: "xoay lưng", "quay lưng", "mặt sau", "sau lưng";
  - can_vai: "soi vải", "zoom", "cận", "gần vải";
  - toan_than: "đứng xa", "lên form", "toàn thân", "đi vài bước";
  - mau_khac: "mặc màu be", "thử màu…" — tên màu so với phân loại của món đang nói.
  Từ khóa để trong server/cau-hinh/tu-khoa-song.json.
- Bình luận có nhãn này vẫn đi qua Director như cũ, không đổi xu_ly.
- Module mới server/the-nhac.js (không có SQL) quản lý thẻ:
  - gom cùng loại, cùng món trong 60 giây;
  - thẻ hiện ngay ở yêu cầu đầu; người sau thêm tên (tối đa 3 tên + "và N bạn");
  - mỗi lúc chỉ 1 thẻ, thẻ khác xếp hàng (tối đa 3);
  - tự tắt 60 giây sau lần cập nhật cuối, hoặc khi bấm "Đã làm";
  - phát sự kiện /ws live.the_nhac.
- Màn hình người dẫn (nguoi-dan.js): thẻ chữ to ở dải trên cùng, không che nút DỪNG AI, có nút "Đã làm". Loại mau_khac và can_vai thêm nút "Chiếu ảnh Be" / "Chiếu video cận vải" (gọi /man-hinh/chieu).
- Mai dẫn chính và Đội AI (AI tự chuyển cảnh): tự chiếu ảnh đúng màu, hoặc video quay thật đúng màu nếu có.
- Đội AI: câu mẫu mới da_nghe_yeu_cau ({ten}, {viec}) đi qua chenBanHang; mỗi loại tối đa 1 câu / 2 phút; bỏ tên người xin ẩn tên; tính vào trần câu chen.
- Mai dẫn chính: MOZA đưa 1 câu ngắn qua mieng.hoi ở chỗ nghỉ, tối đa 1 câu / 2 phút. Mai nói và Chỉ gợi ý: chỉ có thẻ.
- Video dựng thử:
  - mỗi video trong san_pham.video có cờ dung_thu;
  - tệp nâng cấp đánh dấu mọi video đang có là dựng thử (14 video Claude dựng ngày 26/9/2026);
  - màn hình Sản phẩm hiện nhãn "Video dựng thử — không chiếu cho khách" và nút "Đây là video quay thật" (bỏ cờ);
  - video tải lên mới mặc định là quay thật;
  - kiemDanhSachVideo (nghiep-vu/san-pham.js:215) phải giữ cờ; hiện hàm chỉ giữ tep và mau.
- dung() (man-hinh-san-pham.js:127):
  - buổi thật (dien_tap = 0): không chiếu video dựng thử, lùi về trình chiếu ảnh;
  - buổi tập: vẫn chiếu, góc có nhãn "Video dựng thử".
- Chế độ Tắt AI: không chạy.

**Tiêu chí:**
- [ ] Bộ ≥ 60 câu mẫu nhận đúng loại 100%, gồm câu không phải yêu cầu ("xoay sở không kịp", "soi giúp em đơn hôm qua") → không gắn nhãn
- [ ] Facebook giả: 3 người gõ "quay lưng cho xem", "xoay lưng đi", "mặt sau sao" trong 40 giây → 1 thẻ "3 người muốn xem mặt sau: Hằng, Thu, Ngọc"; đồng hồ giả chạy tới 60 giây → thẻ tắt; bấm Đã làm → tắt ngay
- [ ] Đang có thẻ mặt sau mà có yêu cầu cận vải → thẻ cận vải chỉ hiện sau khi thẻ đầu tắt
- [ ] Đội AI đọc "Hằng muốn xem mặt sau nè" ở chỗ nghỉ kế tiếp; yêu cầu cùng loại trong 2 phút không đọc lần hai
- [ ] Phiên thật: Director chọn video của món chỉ có video dựng thử → lùi về trình chiếu ảnh, có ghi chú; phiên tập → chiếu video kèm nhãn
- [ ] Sửa và lưu sản phẩm không làm mất cờ dung_thu; nút "Đây là video quay thật" bỏ được cờ
- [ ] Bình luận muon_xem vẫn có trong lượt Director (phiếu AI giả thấy id)

**Tệp sửa:** `server/nghiep-vu/nhan-binh-luan.js`, `server/cau-hinh/tu-khoa-song.json (mới)`, `server/the-nhac.js (mới)`, `server/phong-ai.js (nhanBinhLuan gọi the-nhac)`, `server/dich-vu.js`, `server/doi-ai/dan-doi.js`, `server/agent/mieng/mieng.js`, `server/cau-hinh/doi-ai-cau-mau.json`, `server/man-hinh-san-pham.js (dung mẫu video)`, `server/nghiep-vu/san-pham.js (kiemDanhSachVideo)`, `server/db/nang-cap/0xx-tren-song.sql`, `public/js/man-hinh/nguoi-dan.js`, `public/js/man-hinh/san-pham.js`, `public/js/man-hinh-san-pham.js (nhãn Video dựng thử)`, `public/css/app.css`, `server/cau-hinh/kich-ban-dien-tap.json`, `test/nhan-binh-luan.test.js`, `test/the-nhac.test.js (mới)`, `test/man-hinh-san-pham.test.js`, `test/san-pham.test.js`

**Dữ liệu:** - Không có bảng mới.
- san_pham.video (JSON) thêm khóa dung_thu. Tệp nâng cấp (chung 0xx-tren-song.sql) cập nhật video bằng json_each + json_set, đánh dấu dung_thu = true cho mọi video đang có. Như mọi lần nâng cấp, phần mềm tự sao lưu trước.
- binh_luan_live.nhan thêm giá trị 'muon_xem' (cột JSON, không có ràng buộc CHECK).

**Cấu hình, câu mẫu, Skill, Hook:** - Tệp mới tu-khoa-song.json: từ khóa muon_xem theo loại.
- Câu mẫu da_nghe_yeu_cau: 4 loại × 2 lựa chọn.
- mac-dinh.json thêm `the_nhac: { gom_giay: 60, tat_sau_giay: 60, hang_toi_da: 3 }`.
- Không thêm ô nhập; lúc tải video không hỏi thêm gì.

**Giả lập Facebook:** - Không cần hàm mới.
- Thêm 2 kịch bản vào kich-ban-dien-tap.json: "Khách xin xem" (6 bình luận xoay lưng, soi vải, đứng xa, màu be trong 90 giây) và "Câu dễ nhầm".

**Test:**
- test/nhan-binh-luan.test.js: ≥ 60 câu muon_xem, có câu dễ nhầm
- test/the-nhac.test.js: gom 60 giây, 1 thẻ + hàng chờ, tự tắt (đồng hồ giả), Đã làm, câu Đội AI tối đa 1 câu / 2 phút / loại
- test/man-hinh-san-pham.test.js: phiên thật không chiếu video dựng thử
- test/san-pham.test.js: giữ cờ dung_thu; tệp nâng cấp đánh dấu video cũ

**Claude Code làm thay:** - Soạn từ khóa theo cách viết của khách Việt (không dấu, viết tắt) và ≥ 60 câu test.
- Soạn câu mẫu Đội AI và kịch bản diễn tập.
- Kiểm danh sách 14 video trên cả data/moza.db và data/xem-thu trước khi chạy nâng cấp.
- Lái bản xem thử (preview_start moza): gửi bình luận giả, chụp Màn hình người dẫn khi thẻ hiện, tự xem ảnh chụp.

**Thử AI thật:** - Không (0 USD).
- Muốn nghe Đội AI bằng tiếng thật thì mỗi câu tốn 1 lượt giọng Google (100 lượt/ngày, dùng chung với bản tuyển dụng). Mặc định không nghe.

**Phụ thuộc:** - Cần K11 (câu mẫu mới phải qua K11).
- Hàm ẩn tên dùng chung với tính năng Số người chốt (P14) và P01 (mốc khác).
- Trần câu chen của Đội AI (việc nền, mốc khác).

**Rủi ro:** - Nhận nhầm "xoay" hay "zoom" trong câu khác. Chỉ hiện thẻ nên hại ít.
- Thẻ có thể che màn hình. Cách giảm: đặt ở dải trên cùng.
- Tốn lượt giọng Google.
- Đánh dấu mọi video cũ là dựng thử có thể gắn nhầm video thật nếu chủ dự án đã tải lên. Cách giảm: kiểm trước, báo chủ dự án rằng bỏ cờ chỉ cần 1 nút.

**Mặc định tự chọn:** - Gom 60 giây, tự tắt 60 giây, 1 thẻ + hàng chờ 3.
- Video tải mới coi là quay thật: người dùng tự quay, không thêm ô lúc tải.
- Buổi tập vẫn chiếu video dựng thử (có nhãn) để còn tập được.

### Tư vấn size gọi đúng tên người hỏi + số đo người mẫu nói bằng lời

*Đề xuất: P13 · công sức: vua*

- Nhận số đo: nhan-binh-luan.js thêm nhãn so_do và hàm dùng chung docSoDo(noiDung) → {chieu_cao, can_nang}.
  - Nhận các dạng "1m58", "m58", "158cm", "cao 158", "50kg", "50 ký/kí".
  - Ô man_hinh của Director cũng lấy số đo từ hàm này, tránh hai chỗ đọc ra hai kết quả.
- Sửa dongHop (man-hinh-san-pham.js:54): trả MẢNG mọi dòng khớp đủ các số đo khách nói; bỏ nhánh lùi "chỉ so cân nặng" khi dùng để khuyên size.
- Module mới server/tu-van-size.js (không SQL), gọi từ PhongAi.nhanBinhLuan trước Director:
  - món = số trong bình luận, không có thì món đang nói; món phải có bảng size;
  - khớp đúng 1 dòng → câu máy soạn "{ten} ơi, theo bảng size của shop thì lấy {co}"; có số đo người mẫu của món này thì thêm ", bạn mẫu {cao} đang mặc {co_mau}";
  - khớp 2 dòng liền nhau → "{ten} nằm giữa {co1} và {co2}: thích mặc ôm thì {co1}, thích thoải mái thì {co2}"; thẻ có kiểu dáng Rộng/oversize thì thêm "form vốn rộng";
  - 0 dòng, quá 2 dòng, hoặc món chưa có bảng size → không tự khuyên, để Director / Co-host xử lý như cũ;
  - gom người hỏi cùng món trong 20 giây thành 1 câu, tối đa 3 tên ("Lan lấy M, Hoa lấy S");
  - câu KHÔNG bao giờ chứa số đo của khách, luôn có cụm "theo bảng size của shop";
  - bình luận đã trả lời đặt xu_ly = 'da_goi_y' để Director không giao Co-host lần nữa; chiếu bảng size tô đúng dòng.
- Đưa lên sóng theo chế độ:
  - Chỉ gợi ý: câu qua kiemTraCau rồi hiện ở ô gợi ý (hienGoiY, loai 'cohost', trích dẫn dòng bảng size);
  - Đội AI: câu mẫu tu_van_size / tu_van_size_giua qua chenBanHang;
  - Mai nói / Mai dẫn: mieng.hoi kèm câu đọc đúng nguyên văn.
- Số đo người mẫu nói bằng lời, không thêm ô. Người dẫn nói "Mai ơi mẫu cao 1m60 (nặng 48) mặc S":
  - Chỉ gợi ý: bắt trong hoiMai, trước docLenh; Mai nói / Mai dẫn: bắt trong mieng.nhanChuNguoiDan;
  - chiều cao, cân nặng nhớ qua các buổi (cai_dat khóa 'nguoi_mau');
  - size đang mặc gắn với món đang nói và chỉ trong buổi; ghi nhật ký để khôi phục khi khởi động lại;
  - "Mai ơi mẫu mặc M" chỉ đổi size; "Mai ơi bỏ cân nặng mẫu" / "ẩn số đo mẫu" để bỏ.
- Nguồn "nguoi_mau" cho Bộ kiểm tra: chuNguon (kiem-tra.js:55) nhận nguồn này, trả dòng "Người mẫu: cao 160 cm, đang mặc size S của áo số 12" (có cân nặng khi người dẫn đã nói). Co-host nhận dòng này trong ngữ cảnh (cohost.js, phần phan); miệng nhận qua duaNguCanh.
- Thanh chữ: dòng cố định dưới ô món "Mẫu: 1m60 · mặc S" khi món đang chiếu có số đo người mẫu. Cân nặng chỉ hiện khi người dẫn đã nói.
- Màn hình sản phẩm, mẫu bảng size: tô MỌI dòng khớp. Bỏ dòng "Bạn cao …cm · …kg → size M" (public/js/man-hinh-san-pham.js:76–86 đang in số đo khách lên sóng), thay bằng "Size gợi ý: M".
- Sửa lời dặn và Skill:
  - lời dặn director + Skill nhuong-loi: bỏ luật "size theo số đo riêng → Tư vấn viên" khi MOZA đã trả lời được;
  - Skill tu-van-size: không nhắc lại số đo khách trên sóng (K3 vốn đã chặn), giữa hai size nói cả hai, dùng nguồn người mẫu.

**Tiêu chí:**
- [ ] Bộ ≥ 50 câu số đo đọc đúng 100% ("1m58 50kg", "cao 1m6 nặng 55 ký", "158cm", "nặng 48 cao 1m55"), không nhầm "chốt 12 đen M x2", "giá 150k", "áo 12 size M"
- [ ] Bảng M 155–162 / 48–55, L 160–168 / 53–60: "1m58 50kg" → [M]; "1m61 54kg" → [M, L] → câu "nằm giữa M và L…"; món chưa có bảng size → không có câu máy, Director nhận bình luận
- [ ] Facebook giả, chế độ Chỉ gợi ý: Lan gõ "1m58 50kg mặc áo 12 size gì" → trong ≤ 3 giây ô gợi ý có "Lan ơi, theo bảng size của shop thì lấy M"; câu không chứa 158 hay 50; Màn hình sản phẩm tô dòng M, không hiện số đo khách
- [ ] "Mai ơi mẫu cao 1m60 mặc S" → Thanh chữ hiện "Mẫu: 1m60 · mặc S"; câu tư vấn kèm "bạn mẫu 1m60 đang mặc S"; Co-host trích nguồn nguoi_mau qua Bộ kiểm tra đạt; khi chưa có người mẫu mà trích nguồn này → K2 chặn
- [ ] Đội AI: 3 người hỏi cùng món trong 20 giây → 1 câu mẫu có 3 tên
- [ ] Khởi động lại giữa buổi → size mẫu đang mặc khôi phục từ nhật ký
- [ ] 3 assert cũ về dong_hop trong test/man-hinh-san-pham.test.js sửa theo dạng mảng, vẫn đạt

**Tệp sửa:** `server/nghiep-vu/nhan-binh-luan.js`, `server/tu-van-size.js (mới)`, `server/man-hinh-san-pham.js (dongHop, dung bang_size)`, `server/phong-ai.js (nhanBinhLuan, hoiMai)`, `server/agent/mieng/mieng.js (nhanChuNguoiDan, đưa dòng người mẫu)`, `server/agent/kiem-tra/kiem-tra.js (chuNguon)`, `server/agent/agents/cohost.js`, `server/agent/agents/director.js (veTinDau: câu việc về size)`, `server/nghiep-vu/cai-dat.js (nguoiMau, datNguoiMau)`, `public/thanh-chu.html`, `public/js/man-hinh-san-pham.js (veBangSize)`, `server/cau-hinh/doi-ai-cau-mau.json`, `server/cau-hinh/skill-mau.json + skill-mau-cu.json`, `server/cau-hinh/loi-dan-mau.json + loi-dan-mau-cu.json`, `server/cau-hinh/kich-ban-dien-tap.json`, `docs/mau-dong-y-nguoi-mau.md (mới, nháp giấy đồng ý cho chủ dự án)`, `test/tu-van-size.test.js (mới)`, `test/man-hinh-san-pham.test.js`, `test/kiem-tra.test.js`, `test/nhan-binh-luan.test.js`

**Dữ liệu:** - Không có bảng hay cột mới.
- cai_dat thêm khóa 'nguoi_mau' = {chieu_cao, can_nang | null, an_can_nang, luc}.
- Size đang mặc ghi trong nhat_ky_song (loại su_kien).
- Không lưu số đo khách: không ghi bộ nhớ khách, không ghi hồ sơ.

**Cấu hình, câu mẫu, Skill, Hook:** - Câu mẫu tu_van_size và tu_van_size_giua, mỗi loại 2–3 lựa chọn.
- Sửa Skill tu-van-size và nhuong-loi.
- Lời dặn director, cohost, mieng, mieng_dan: thêm nguồn người mẫu.
- mac-dinh.json thêm `tu_van_size: { gom_giay: 20, toi_da_ten: 3 }`.
- Không thêm ô.

**Giả lập Facebook:** - Không cần hàm mới.
- Thêm kịch bản diễn tập "Hỏi size theo số đo": 8 bình luận, có câu nằm giữa hai size, câu hỏi món chưa có bảng size, câu gõ không dấu; kèm bước hoi_mai "Mai ơi mẫu cao 1m60 mặc S".

**Test:**
- test/tu-van-size.test.js: 1 dòng, 2 dòng, 0 dòng, gom 3 tên, xu_ly da_goi_y, câu không chứa số đo khách, qua kiemTraCau
- test/nhan-binh-luan.test.js: ≥ 50 câu docSoDo
- test/kiem-tra.test.js: nguồn nguoi_mau đạt / chặn
- test/man-hinh-san-pham.test.js: dongHop trả mảng, không in số đo khách, dòng Mẫu trên Thanh chữ
- test/phong-ai.test.js: lệnh người mẫu qua hoiMai không gọi Co-host

**Claude Code làm thay:** - Soạn regex và ≥ 50 câu test số đo.
- Soạn câu mẫu; sửa Skill và lời dặn.
- Soạn kịch bản diễn tập.
- Nháp giấy đồng ý người mẫu (hình ảnh trên live, clip, Reels, số đo công khai, quyền bỏ cân nặng, quyền rút lại) để chủ dự án nhờ luật sư xem.
- Chụp Thanh chữ và Màn hình sản phẩm ở bản xem thử, tự kiểm bố cục.

**Thử AI thật:** - Không (0 USD): phần tư vấn tính bằng mã.
- Director thật trong bản xem thử chỉ để kiểm không bị giao trùng; chi phí nằm trong phần xem thử chung của mốc.

**Phụ thuộc:** - Cần Nhật ký (khôi phục size mẫu) và K11 (câu mẫu).
- Tính năng Từ riêng (P44) giúp nghe đúng lệnh "mẫu mặc S".

**Rủi ro:** - Bảng size chồng khoảng → không tự khuyên.
- Tên Facebook lạ → dùng tenGoi; không có tên hợp lệ thì nói "Có bạn hỏi".
- Số đo người mẫu là dữ liệu cá nhân → cần giấy đồng ý; mặc định không hiện cân nặng.
- GPT Live 1 không nạp được từ riêng nên lệnh bằng lời ở chế độ Mai có thể nghe nhầm. Cách giảm: MOZA luôn hiện lại trên Thanh chữ và Màn hình người dẫn để người dẫn thấy mà sửa.

**Mặc định tự chọn:** - Gọi tên trơn, không thêm "chị/anh" vì không biết giới tính; đổi khi P35 có danh sách xưng hô.
- Gom 20 giây, tối đa 3 tên.
- Chỉ tự khuyên khi khớp 1 dòng, hoặc 2 dòng liền nhau (size nhỏ = ôm, size lớn = thoải mái).
- Nhớ chiều cao mẫu qua các buổi.
- Cân nặng mẫu chỉ hiện khi người dẫn nói.

### Số người chốt thật trên Thanh chữ, cảm ơn cuối buổi, "ẩn tên", sửa ngưỡng "còn ít"

*Đề xuất: P14 · công sức: vua*

- Đếm người chốt bằng SQL: hàm mới demNguoiChot(phienId, sanPhamId) trong nghiep-vu/bao-cao.js.
  - Đếm số NGƯỜI khác nhau (don.nguoi_fb_id) có đơn nguồn bình luận live của phiên này chứa món đó; bỏ đơn đã hủy.
  - Chỉ đếm đơn cùng dien_tap với phiên, nên buổi tập không bao giờ cộng vào buổi thật.
- theSanPham (man-hinh-san-pham.js:70) thêm nguoi_chot khi đạt ngưỡng (mặc định 5).
  - Thanh chữ hiện "14 người chốt buổi này" trong ô món.
  - Luôn viết "người chốt", không viết "đã bán".
  - Cập nhật khi có live.chot và khi đơn bị hủy.
- Đọc số người chốt trên sóng:
  - Đội AI: câu mẫu dem_chot ({mon}, {so}) khi vượt mốc 5, 10, 20, 50; mỗi mốc 1 lần mỗi món.
  - Mai nói / Mai dẫn: mieng.hoi kèm câu đọc nguyên văn.
  - Chỉ gợi ý: chỉ có Thanh chữ.
- Ẩn tên:
  - nhan-binh-luan.js nhận "ẩn tên", "đừng đọc tên", "không đọc tên", "giấu tên" → nhãn 'an_ten'.
  - Hàm live.daAnTen(phienId, nguoiFbId) (SQL trong nghiep-vu/live.js) đọc nhãn này.
  - Cả buổi không đọc, không hiện tên người đó ở: Thanh chữ "vừa chốt" (thay bằng "Một bạn"), dòng cảm ơn, câu đọc tên người chốt (#72, chot-don.js docTrenSong), thẻ nhắc, tư vấn size, câu chào tên của Đội AI và Mai.
- Dòng cảm ơn cuối buổi:
  - Sự kiện mhsp.cam_on làm Thanh chữ chạy dòng chữ "Cảm ơn Lan, Hoa, Trâm… đã chốt đơn buổi này" trong 45 giây.
  - Chỉ tên gọi, không món, không tiền; tối đa 40 tên; bỏ người xin ẩn tên.
  - Bật bằng: nút "🙏 Cảm ơn" trong khối Lên sóng; lệnh "Mai ơi cảm ơn cả nhà" (docLenh); khi Đội AI chào kết (chaoKet); khi Mai dẫn chính nghe câu chào kết (CHAO_KET).
  - Đội AI có câu mẫu cam_on_cuoi, tối đa 5 tên.
- Sửa số 5 viết cứng (public/js/man-hinh-san-pham.js:45): máy chủ gửi cờ sap_het (còn > 0 và ≤ nguong_sap_het của Cài đặt, mặc định 3) trong con_hang; trang chỉ đọc cờ này.
- Bước 2 ("X/Y khách nói vừa") để sau P27.

**Tiêu chí:**
- [ ] Phiên thật: 6 người khác nhau chốt áo 12 (1 người chốt 2 lần) → Thanh chữ "6 người chốt buổi này"; chỉ 4 người → không hiện; 1 đơn bị hủy → số giảm
- [ ] Phiên tập có 7 người chốt không làm phiên thật hiện số (test hai phiên song song)
- [ ] Người gõ "ẩn tên" rồi chốt → Thanh chữ "Một bạn vừa chốt…"; tên không có trong dòng cảm ơn; Đội AI không đọc tên
- [ ] "Mai ơi cảm ơn cả nhà" → mhsp.cam_on có đúng danh sách tên gọi, không trùng, không có người ẩn tên
- [ ] Ngưỡng sắp hết 3: ô còn 4 không hiện "còn 4", ô còn 3 hiện "còn 3"; đổi ngưỡng trong Cài đặt thành 5 → ô còn 4 hiện
- [ ] Câu dem_chot chỉ đọc khi ≥ 5 người, mỗi mốc 1 lần, câu không có chữ "đã bán"

**Tệp sửa:** `server/nghiep-vu/bao-cao.js (demNguoiChot)`, `server/nghiep-vu/live.js (daAnTen)`, `server/nghiep-vu/nhan-binh-luan.js`, `server/man-hinh-san-pham.js (theSanPham, khiCoSuKien, docLenh, camOn)`, `server/chot-don.js (docTrenSong, live.chot bỏ tên ẩn)`, `server/doi-ai/dan-doi.js (layTenMoi, chaoKet)`, `server/agent/mieng/mieng.js (layTenMoi, chào kết)`, `server/api/man-hinh.js (POST /man-hinh/cam-on)`, `public/thanh-chu.html`, `public/js/man-hinh-san-pham.js`, `public/js/man-hinh/len-song.js`, `server/cau-hinh/doi-ai-cau-mau.json`, `server/cau-hinh/mac-dinh.json`, `server/cau-hinh/kich-ban-dien-tap.json`, `test/nguoi-chot.test.js (mới)`, `test/man-hinh-san-pham.test.js`, `test/chot-don.test.js`, `test/nhan-binh-luan.test.js`

**Dữ liệu:** - Không có bảng hay cột mới.
- binh_luan_live.nhan thêm giá trị 'an_ten'. Lưu bằng nhãn (không chỉ giữ trong bộ nhớ) để khởi động lại giữa buổi vẫn nhớ.

**Cấu hình, câu mẫu, Skill, Hook:** - mac-dinh.json thêm `tren_song: { nguong_nguoi_chot: 5, moc_doc: [5, 10, 20, 50], cam_on: { giay: 45, toi_da_ten: 40 } }`.
- Câu mẫu dem_chot, cam_on_cuoi.
- Không thêm ô Cài đặt (ngưỡng "sắp hết" dùng ô sẵn có).

**Giả lập Facebook:** - Không cần hàm mới.
- Thêm kịch bản diễn tập "8 người chốt + 1 người ẩn tên + 1 đơn hủy".

**Test:**
- test/nguoi-chot.test.js: đếm người khác nhau, bỏ đơn hủy, tách buổi tập / buổi thật, ngưỡng, mốc đọc
- test/man-hinh-san-pham.test.js: cờ sap_het theo Cài đặt, mhsp.cam_on
- test/chot-don.test.js: người ẩn tên → "Một bạn", không có trong hàng đọc tên
- test/nhan-binh-luan.test.js: nhận các câu xin ẩn tên

**Claude Code làm thay:** - Soạn câu mẫu và kịch bản.
- Chụp Thanh chữ 1920×1080 ở bản xem thử, kiểm không đè nhãn AI (P35) và ô "vừa chốt".
- Ghi căn cứ luật đúng cho SPEC: Điều 6 Luật TMĐT (cấm lừa dối), không phải Điều 24.

**Thử AI thật:** - Không tốn AI cho phần đếm.
- Xem thử có chốt đơn thì Tư vấn viên diễn tập (gpt-6-luna) và khách giả nhắn riêng thật: khoảng 0,01 USD OpenAI cho 8 người chốt.
- Kiểm bằng npm test thì 0 USD.

**Phụ thuộc:** - P01 (mốc khác) cũng cần ẩn tên và câu gọi tên → dùng chung live.daAnTen; mốc nào làm trước tạo hàm, mốc sau dùng lại.
- P35 (mốc khác) cùng sửa thanh-chu.html.

**Rủi ro:** - Số nhỏ dễ gây hiểu nhầm → ngưỡng 5.
- Dòng cảm ơn nằm trong video Facebook lưu 30 ngày, có thể bị cắt vào Reels → chỉ tên gọi, ai muốn thì xin ẩn tên.
- Người đã chốt có thể hủy sau → trừ đơn hủy.
- Luật sư nên xem cách hiện số người chốt (căn cứ Điều 6).

**Mặc định tự chọn:** - Đếm theo phiên, bỏ đơn hủy.
- Ngưỡng 5 người; mốc đọc 5 / 10 / 20 / 50.
- Cảm ơn chạy 45 giây, tối đa 40 tên.
- Người ẩn tên hiện "Một bạn".

### Gỡ lưỡng lự bằng bằng chứng thật

*Đề xuất: P12 · công sức: vua*

- Director gắn thêm ô luong_lu trong phiếu (director.js, LUOC_DO). Lược đồ là loại chặt nên phải thêm ô này vào danh sách required.
  - Dạng: [{binh_luan_id, kieu}], kieu ∈ khong_vua · chat_lieu · khac_anh · gia · ship · suy_nghi.
  - Director vốn đọc bình luận nên không tốn thêm lượt AI.
  - Ghi nhãn 'luong_lu' vào binh_luan_live.nhan: thêm vào NHAN_DIRECTOR để live.themNhan cho phép.
- PhongAi đếm theo (món, kiểu): số người khác nhau trong 5 phút. veTinDau cho Director thấy, ví dụ "Lưỡng lự chưa gỡ: không vừa · áo 12 · 2 người".
- Khi nào gỡ: ≥ 2 người cùng kiểu, chưa gỡ trong 10 phút, người dẫn không đang nói.
  - Director chọn giao_cohost với skill_ids ['go-luong-lu']. Đây là một dạng giao_cohost, vẫn giữ luật "một quyết định mỗi lượt".
  - Mã chặn trước khi giao (phong-ai.js lamTheoPhieu): chưa đủ 2 người, hoặc KHÔNG có nguồn thật → không giao (im), chỉ hiện thẻ nhắc cho người dẫn.
- Mỗi kiểu gắn với nguồn thật (hàm nguonGoLuongLu trong module mới server/go-luong-lu.js, không SQL):
  - khong_vua: bảng size, mục Sổ tay có "đổi size" / "đổi trả", số đo người mẫu;
  - chat_lieu: thông số chất liệu / độ dày đã xác nhận, video quay thật;
  - khac_anh: video quay thật, từ 2 ảnh thật;
  - gia: điểm nổi bật đã xác nhận, món phối cùng rẻ hơn trong phiên;
  - ship: Cài đặt phí ship / miễn ship, Sổ tay mục Giao hàng;
  - suy_nghi: giờ giữ hàng trong Cài đặt.
- Skill mới go-luong-lu cho Co-host:
  - trích đúng nguồn của kiểu; không có nguồn thì không nói;
  - CẤM giảm giá, hứa quà, so với shop hay thương hiệu khác;
  - được nói nhược điểm có thật nếu thẻ ghi ("vải hơi mỏng, hợp mặc hè");
  - câu "đổi size trong N ngày" chỉ nói khi Sổ tay ghi đúng như vậy;
  - tối đa 3 câu.
- Màn hình tự chọn hình theo kiểu qua ô man_hinh có sẵn: khong_vua → bảng size; chat_lieu → video quay thật đúng màu, không có thì mẫu chi tiết; khac_anh → video quay thật hoặc ảnh màu.
- Thẻ nhắc người dẫn dùng chung the-nhac.js, ví dụ "2 người lo không vừa — chiếu bảng size, nói chính sách đổi". Ưu tiên thấp hơn thẻ khách xin xem.
- Theo chế độ:
  - Chỉ gợi ý: câu Co-host hiện ở ô gợi ý;
  - Đội AI: đội đọc (đường traLoi sẵn có);
  - Mai nói / Mai dẫn: đường giaoMai sẵn có. Mai đang nói thì bỏ lượt hoặc xếp hàng tới chỗ nghỉ. Không đưa bối cảnh chen giữa câu, nên không phụ thuộc chuyện GPT Live 1 có cắt lời hay không.
- Lời dặn:
  - director: thêm luật lưỡng lự và thêm id Skill vào danh sách Skill viết cứng (director.js:141);
  - mieng / mieng_dan: cách gỡ lưỡng lự (chỉ dùng Sổ tay và thẻ; không giảm giá, không so sánh).
- gieoSkill (nghiep-vu/skill.js:34) hiện chỉ chèn Skill khi bảng rỗng → sửa để chèn Skill mẫu còn thiếu theo id. Nhờ vậy go-luong-lu vào được dữ liệu đang chạy; Skill đã sửa tay không bị đè.

**Tiêu chí:**
- [ ] Director giả gắn luong_lu cho 2 người "sợ không vừa" áo 12, Sổ tay có "Đổi size trong 3 ngày nếu chưa giặt" → Co-host giả dùng go-luong-lu; câu qua Bộ kiểm tra có trích so_tay; màn hình chiếu bảng size
- [ ] Chỉ 1 người lưỡng lự → không giao; Sổ tay trống và món chưa có bảng size → không giao, thẻ nhắc báo "chưa có nguồn"
- [ ] Co-host giả soạn "bớt 20k cho cả nhà" hoặc "rẻ hơn shop khác" → bị chặn (K3 / K11), không hiện
- [ ] Phiếu Director thiếu luong_lu → lỗi lược đồ; các phiếu mẫu cũ trong test Director được sửa theo
- [ ] Cùng kiểu, cùng món đã gỡ trong 10 phút → không gỡ lại
- [ ] Dữ liệu cũ (bảng skill đã có dòng) khởi động → có Skill go-luong-lu bản 1; Skill đã sửa tay giữ nguyên
- [ ] Kịch bản ≥ 30 bình luận lưỡng lự chạy trên bản xem thử với Director thật: Claude Code tự chấm tỷ lệ gắn đúng từ nhật ký và ghi vào SPEC

**Tệp sửa:** `server/agent/agents/director.js`, `server/phong-ai.js`, `server/go-luong-lu.js (mới)`, `server/the-nhac.js`, `server/nghiep-vu/live.js (NHAN_DIRECTOR thêm luong_lu)`, `server/nghiep-vu/skill.js (gieoSkill chèn Skill thiếu)`, `server/cau-hinh/skill-mau.json + skill-mau-cu.json`, `server/cau-hinh/loi-dan-mau.json + loi-dan-mau-cu.json`, `server/cau-hinh/mac-dinh.json`, `server/cau-hinh/kich-ban-dien-tap.json`, `test/phong-ai.test.js`, `test/go-luong-lu.test.js (mới)`, `test/skill-vai-tro.test.js`

**Dữ liệu:** - Không có bảng mới.
- binh_luan_live.nhan thêm giá trị 'luong_lu'.
- Skill mới là một dòng trong bảng skill, chèn bằng mã (gieoSkill), không cần tệp nâng cấp.

**Cấu hình, câu mẫu, Skill, Hook:** - Skill mới go-luong-lu.
- Lời dặn director, cohost, mieng, mieng_dan (chép bản cũ sang tệp -cu để dữ liệu đang chạy được nâng).
- mac-dinh.json thêm `luong_lu: { toi_thieu_nguoi: 2, cua_so_phut: 5, go_lai_sau_phut: 10 }`.

**Giả lập Facebook:** - Không cần hàm mới.
- Thêm kịch bản diễn tập "Khách lưỡng lự": 12 bình luận thuộc 6 kiểu, có câu đùa "đắt quá ta ơi haha" để xem Director có gắn nhầm không.

**Test:**
- test/go-luong-lu.test.js: bảng kiểu → nguồn, không nguồn thì im, ngưỡng 2 người, không gỡ lại trong 10 phút
- test/phong-ai.test.js: phiếu Director giả có luong_lu → giao Co-host đúng Skill; lược đồ chặt
- test/kiem-tra.test.js: câu gỡ có giảm giá / so sánh bị chặn
- test/skill-vai-tro.test.js: gieoSkill chèn Skill thiếu, không đè Skill đã sửa

**Claude Code làm thay:** - Soạn Skill và bảng kiểu → nguồn.
- Soạn ≥ 30 bình luận lưỡng lự mẫu và "đáp án mẫu" (phiếu Director giả, câu Co-host giả) cho test.
- Đọc nhật ký buổi tập, tự chấm câu gỡ (có nguồn, không giảm giá, không so sánh) thay cho model chấm.
- Tra tài liệu GPT Live 1 về session.thinking.append (có cắt lời không); miễn phí, ghi vào SPEC để dùng về sau.

**Thử AI thật:** - Director và Co-host thật trong bản xem thử: Google gemini-3.8-flash, khoảng 20 lượt ≈ 0,05 USD. Dự phòng gpt-6-luna chỉ chạy khi Gemini lỗi, gần như 0.
- Tùy chọn, hỏi trước: dùng chung phép thử GPT Live 1 3 phút (~0,15 USD OpenAI) với tính năng Nhật ký để nghe Mai gỡ lưỡng lự.

**Phụ thuộc:** - Cần các tính năng trong mốc: thẻ nhắc và cờ video dựng thử (P11), người mẫu (P13), K11.
- P31 (mốc khác, điền Sổ tay chính sách đổi size) là nguồn mạnh nhất; Sổ tay trống thì tính năng này im.

**Rủi ro:** - Director hiểu câu đùa là lưỡng lự → cần ≥ 2 người và phải có nguồn mới gỡ.
- Co-host đang bận (dangCohost) thì bỏ lượt.
- Kiểu "gia" dễ trượt thành giảm giá → Skill cấm, K3 chặn số tiền lạ, K11 chặn so sánh.
- Phiếu Director dài thêm vài chục token.

**Mặc định tự chọn:** - ≥ 2 người khác nhau trong 5 phút.
- Mỗi kiểu, mỗi món gỡ tối đa 1 lần / 10 phút.
- Kiểu "gia" không bao giờ nói giảm giá; chỉ nói giá trị của món hoặc gợi ý món rẻ hơn trong phiên.

### Dòng số liệu, dòng "Tiếp theo" và một gợi ý nhịp bán cho người dẫn

*Đề xuất: P16 · công sức: vua*

- Dòng số liệu trên Màn hình người dẫn (nguoi-dan.js, cạnh dòng "Vừa chốt"): "23 người chốt · 17 đã trả lời tin · 9 đã xác nhận · 140 người xem". Cập nhật 10 giây một lần (sự kiện live.so_lieu).
- SQL mới soLieuPhien(phienId) trong nghiep-vu/bao-cao.js, chỉ tính đơn cùng dien_tap với phiên:
  - chốt = số người khác nhau có đơn nguồn bình luận live của phiên, trừ đơn hủy;
  - đã trả lời = trong số đó, người có ít nhất 1 tin gửi vào (gui_boi khach, loai tin) sau lúc tạo đơn; nối người bình luận với người nhắn qua ganPsid (nghiep-vu/hop-thu.js:256);
  - đã xác nhận = đơn từ da_xac_nhan trở đi, trừ hủy.
- Người xem:
  - that.js timLiveDangPhat thêm live_views vào fields, dùng luôn lần hỏi 15 giây sẵn có, không gọi thêm; trả về nguoi_xem;
  - phong-live.quet giữ số của live đang gắn, phát live.nguoi_xem;
  - không có số thì ẩn phần này.
- Dòng "Tiếp theo" cho khách:
  - Thanh chữ hiện "Tiếp theo: váy số 15" khi đoạn đang nói đã chạy 60 giây và đoạn kế có món Đang bán; người dẫn đổi đoạn thì tính lại.
  - Màn hình người dẫn đã có "Tiếp theo" (nguoi-dan.js, veDoan, eKe) — giữ nguyên.
- Câu "món sau":
  - Đội AI: câu mẫu sap_toi ({mon_sau}) 1 lần mỗi đoạn, ở chỗ nghỉ sau khi đoạn đã phát ≥ 20 giây; bỏ nếu người dẫn đổi đoạn;
  - Mai dẫn chính: loiGiaoDoan đã có "Đoạn sau"; thêm ý mời khách ở lại.
- Một gợi ý nhịp: module mới server/nhip-ban.js (không SQL), chạy 20 giây một lần, chỉ ở chế độ Chỉ gợi ý và Mai nói (người dẫn cầm nhịp).
  - (a) Món đang nói có ≥ 3 người chốt trong 2 phút → "Áo 12 đang có nhiều người chốt: nói thêm một vòng màu, size còn hàng?"
  - (b) Ở món ≥ 4 phút, 3 phút không ai chốt, không ai hỏi → "Chưa ai hỏi áo 7: sang món tiếp (váy 15)?"
  - Dùng chung ô gợi ý (phongAi.hienGoiY, loai 'director'), không đè câu Co-host vừa hiện trong 30 giây.
  - Tối đa 1 gợi ý / 3 phút. Máy không tự chuyển món. Không bao giờ dựa vào nhịp chốt để nói "sắp hết".
- Bỏ theo báo cáo: ô tích "ý đã nói"; nhịp tự động cho chế độ Mai dẫn.

**Tiêu chí:**
- [ ] Dữ liệu test: 5 người chốt, 3 người trả lời Messenger, 2 đơn xác nhận → soLieuPhien = {chot: 5, tra_loi: 3, xac_nhan: 2}; đơn hủy không tính; phiên tập không lẫn vào phiên thật
- [ ] Facebook giả đặt 140 người xem → Màn hình người dẫn hiện "140 người xem" trong ≤ 2 giây; that.js với fetch giả gửi fields có live_views và đọc đúng số
- [ ] Đồng hồ giả: 4 phút ở áo 7 không ai chốt, không ai hỏi → 1 gợi ý "sang món tiếp"; 3 phút sau đó không gợi ý thêm; chế độ Đội AI dẫn → không gợi ý
- [ ] 3 người chốt áo 12 trong 2 phút → gợi ý nói thêm một vòng; không có chữ "sắp hết"
- [ ] Sau 60 giây ở đoạn áo 12 → Thanh chữ "Tiếp theo: váy số 15"; đoạn kế là đoạn chung → không hiện

**Tệp sửa:** `server/nghiep-vu/bao-cao.js (soLieuPhien)`, `server/nhip-ban.js (mới)`, `server/phong-live.js`, `server/facebook/that.js`, `server/facebook/gia.js`, `server/facebook/giao-dien.js (ghi chú trường nguoi_xem, không bắt buộc)`, `server/dien-tap.js (bước nguoi_xem trong kịch bản)`, `server/api/live.js (GET /live/phien/:id/so-lieu khi mở lại màn hình)`, `server/dich-vu.js`, `server/doi-ai/dan-doi.js`, `server/agent/mieng/mieng.js (loiGiaoDoan)`, `server/man-hinh-san-pham.js (phát mhsp.tiep_theo)`, `public/js/man-hinh/nguoi-dan.js`, `public/thanh-chu.html`, `server/cau-hinh/doi-ai-cau-mau.json`, `server/cau-hinh/mac-dinh.json`, `test/so-lieu-phien.test.js (mới)`, `test/nhip-ban.test.js (mới)`, `test/facebook.test.js`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** - Câu mẫu sap_toi.
- mac-dinh.json thêm `nhip_ban: { moi_giay: 20, cach_phut: 3, nong_nguoi: 3, nong_phut: 2, nguoi_phut: 4 }` và `tiep_theo_sau_giay: 60`.
- Không thêm ô.

**Giả lập Facebook:** - gia.js: timLiveDangPhat trả thêm nguoi_xem; thêm hàm datNguoiXem(n) cho Phòng diễn tập và test; mặc định null (ẩn).
- kich-ban-dien-tap.json: thêm bước {"nguoi_xem": 150}.
- Bước 0 (Facebook thật): thêm câu hỏi "live_views đọc được không, nghĩa là gì". Khác giả lập thì sửa that.js + gia.js.

**Test:**
- test/so-lieu-phien.test.js: chốt / trả lời / xác nhận, trừ hủy, tách buổi tập
- test/nhip-ban.test.js: luật nóng và nguội, cách 3 phút, không chạy ở chế độ Đội AI, không có "sắp hết"
- test/facebook.test.js: fields có live_views; gia.js trả nguoi_xem
- test/man-hinh-san-pham.test.js: Tiếp theo sau 60 giây, đoạn chung không hiện

**Claude Code làm thay:** - Viết SQL và dữ liệu test.
- Soạn kịch bản diễn tập có người xem và nhịp chốt.
- Chụp Màn hình người dẫn, tự xem ảnh để kiểm có rối mắt không, thay cho việc hỏi người dùng.

**Thử AI thật:** không (0 USD)

**Phụ thuộc:** - Dùng hàm đếm người chốt của tính năng Số người chốt (P14).
- P32 (mốc khác, tổng kết sau live) nên dùng lại soLieuPhien.

**Rủi ro:** - Màn hình rối → chỉ 1 dòng số và 1 gợi ý.
- Số "đã trả lời" phụ thuộc việc nối người bình luận với người nhắn tin (psid); trên Facebook thật chưa kiểm (chờ Bước 0) nên có thể thấp hơn thực tế.
- Meta không mô tả rõ live_views.

**Mặc định tự chọn:** - Số liệu cập nhật 10 giây.
- Gợi ý chạy 20 giây/lần, tối đa 1 gợi ý / 3 phút.
- Nóng = 3 người chốt trong 2 phút; nguội = ở món 4 phút.
- "Tiếp theo" hiện sau 60 giây.

### Bình chọn bằng bình luận (A/B), không quà

*Đề xuất: P17 · công sức: vua*

- Cách mở:
  - nút "🗳 Bình chọn" trong khối Lên sóng, chọn 2 màu của món đang nói từ danh sách phân loại (không phải gõ);
  - hoặc lệnh "Mai ơi bình chọn be hay đen" (docLenh, nhận màu theo phân loại như lệnh chiếu).
- Module mới server/binh-chon.js (không SQL):
  - mỗi lần 60 giây; 2 lựa chọn (tối đa 3: A/B/C);
  - tối đa 2 lần mỗi buổi; quá thì báo người dẫn;
  - mỗi người 1 phiếu, tính phiếu sau cùng;
  - nhận "A", "a nha", "chọn A", "A be", hoặc đúng tên màu ("be").
- Bình luận là phiếu thì gắn nhãn 'binh_chon', xu_ly = 'bo_qua' → không vào Director. Không bị nhận là chốt: docChot chỉ bắt chữ "c" đi liền số, và chạy trước bình chọn.
- Thanh chữ: ô "Bình chọn: A · Be 12 | B · Đen 9 · còn 34 giây" cập nhật mỗi giây; hết giờ hiện "Be thắng!" trong 20 giây.
- Khi có kết quả:
  - thẻ nhắc người dẫn ưu tiên cao nhất: "Be thắng — mặc Be cho cả nhà xem ngay";
  - chiếu ảnh màu thắng;
  - Đội AI đọc câu mẫu binh_chon_mo / binh_chon_ket ("Be thắng rồi, bạn mẫu mặc liền nè"), không đọc số phiếu;
  - Mai: mieng.hoi kèm câu đọc nguyên văn;
  - hòa → thẻ "Hòa — người dẫn chọn".
- Không quà, không câu kiểu "chia sẻ để bình chọn". Câu mẫu không nhắc quà; phần soạn kịch bản đã có luật không treo thưởng (#74).
- Kết quả ghi vào nhật ký.

**Tiêu chí:**
- [ ] Facebook giả, 20 bình luận trong 60 giây ("A", "b", "chọn a", "A be", "đen", "chốt 12 đen M") → đếm đúng; "chốt 12 đen M" thành đơn và không tính là phiếu; người đổi phiếu → tính phiếu sau
- [ ] Phiếu không tới Director (phiếu AI giả không thấy id) và không tạo câu hỏi nổi bật
- [ ] Mở lần thứ 3 trong buổi → bị từ chối, báo "đã đủ 2 lần"
- [ ] Hết giờ → có sự kiện mhsp.binh_chon kèm kết quả, thẻ nhắc "mặc Be", Đội AI xếp câu binh_chon_ket; câu không chứa số phiếu
- [ ] Hòa → thẻ "Hòa"

**Tệp sửa:** `server/binh-chon.js (mới)`, `server/nghiep-vu/live.js (gắn nhãn phiếu)`, `server/phong-ai.js (đưa bình luận cho binh-chon trước Director)`, `server/man-hinh-san-pham.js (docLenh)`, `server/api/man-hinh.js (POST /binh-chon)`, `server/dich-vu.js`, `public/js/man-hinh/len-song.js`, `public/thanh-chu.html`, `server/doi-ai/dan-doi.js`, `server/cau-hinh/doi-ai-cau-mau.json`, `server/cau-hinh/mac-dinh.json`, `server/cau-hinh/kich-ban-dien-tap.json`, `test/binh-chon.test.js (mới)`

**Dữ liệu:** - Không có bảng hay cột mới.
- binh_luan_live.nhan thêm giá trị 'binh_chon'.
- Kết quả ghi vào nhat_ky_song (loại su_kien).

**Cấu hình, câu mẫu, Skill, Hook:** - Câu mẫu binh_chon_mo, binh_chon_ket, binh_chon_hoa.
- mac-dinh.json thêm `binh_chon: { giay: 60, toi_da_moi_buoi: 2, toi_da_lua_chon: 3 }`.
- Không thêm ô: chọn màu bằng nút.

**Giả lập Facebook:** - Không cần hàm mới.
- Thêm kịch bản diễn tập "Bình chọn màu": bước hoi_mai "Mai ơi bình chọn be hay đen" và 20 phiếu.
- Bước 0 (Facebook thật): kiểm bình luận 1 chữ ("A") có về luồng streaming không. Meta có thể lọc bình luận "chất lượng thấp", và chế độ Thảo luận ẩn bình luận dưới 100 ký tự. Nếu mất thì mời khách gõ tên màu.

**Test:**
- test/binh-chon.test.js: nhận phiếu, phiếu sau cùng, không lẫn với chốt, không vào Director, giới hạn 2 lần, hòa, câu kết không có số

**Claude Code làm thay:** - Viết regex nhận phiếu và test.
- Soạn câu mẫu và kịch bản.
- Chụp Thanh chữ ở bản xem thử.

**Thử AI thật:** không (0 USD)

**Phụ thuộc:** Cần thẻ nhắc (P11), Nhật ký, bố cục Thanh chữ chung; lệnh bằng lời được nạp vào P44.

**Rủi ro:** - Bình luận 1 chữ có thể bị Facebook lọc hoặc ẩn.
- Bình chọn dày làm loãng buổi bán → tối đa 2 lần/buổi.
- Không làm theo kết quả thì khách thấy bị lừa → thẻ kết quả ưu tiên cao nhất.
- Gắn quà là khuyến mại phải đăng ký (NĐ 81/2018 sửa bởi NĐ 128/2024, NĐ 239/2026) → câu mẫu khóa không có quà.

**Mặc định tự chọn:** - 60 giây, 2 lựa chọn, 2 lần mỗi buổi.
- Tính phiếu sau cùng; nhận cả tên màu.
- Hòa thì người dẫn chọn.

### Nạp từ riêng của shop cho phần nghe người dẫn

*Đề xuất: P44 · công sức: nho*

- Phần đã có sẵn: chep-loi.js đã truyền danh sách từ riêng cho cả hai dịch vụ nghe.
  - Gemini 3.5 Transcribe Live: customVocabulary, cắt 1000 từ.
  - gpt-live-transcribe: keywords, cắt 100 từ.
  - Danh sách lấy từ tuRiengCua (chep-loi-nguoi-dan.js:164): tên AI, tên shop, "size", "chốt", tên và tên gọi khác của món trong kịch bản, tên mọi món Đang bán.
- Việc cần làm: thêm từ và sắp theo ưu tiên, tối đa 100 từ (Google khuyên tốt nhất ≤ 100):
  1. lệnh: "Mai ơi", "mẫu cao", "mặc", "bảng size", "chiếu", "quay lại camera", "cả hai", "bình chọn", "cảm ơn";
  2. tên AI, tên shop;
  3. cách gọi món trong phiên, theo danh mục: "áo 12", "số 12", quần, váy, đầm…;
  4. màu và cỡ của các món trong phiên;
  5. tên và tên gọi khác của món trong phiên;
  6. món Đang bán khác nếu còn chỗ.
- Lọc ký tự <, > và xuống dòng: OpenAI từ chối phiên nếu từ có các ký tự này.
- Lấy lại danh sách khi xoay phiên 10 phút (xoay), để có món mới.
- Miệng Gemini 3.8 Live: gemini-live.js đang để inputAudioTranscription {} → thêm customVocabulary cùng danh sách NẾU tài liệu 3.8 Live cho phép (Claude Code tra lúc code). Tài liệu không cho thì giữ nguyên.
- GPT Live 1 không có chỗ nạp từ riêng → ghi giới hạn vào SPEC.
- Giá: gemini-3.5-transcribe-live trong gia-model.json (3,5 / 21) ĐÃ ĐÚNG theo trang giá tra ngày 27/9/2026 (bản Live 3,50 / 21, khoảng 0,009 USD/phút). Con số 2 / 12 mà báo cáo so là của bản thường gemini-3.5-transcribe → không sửa, chỉ ghi ngày tra vào SPEC mục 6.

**Tiêu chí:**
- [ ] Phiên 3 món: tuRiengCua trả ≤ 100 từ, không trùng, có đủ nhóm 1–5
- [ ] Có 40 món Đang bán: từ của món trong phiên luôn có mặt; món ngoài phiên bị cắt trước
- [ ] Chép lời giả Gemini: cấu hình mở phiên có customVocabulary đúng danh sách. OpenAI giả: keywords đúng danh sách, không từ nào chứa <, > hay xuống dòng
- [ ] Xoay phiên 10 phút → danh sách được lấy lại
- [ ] (Nếu 3.8 Live nhận) Gemini Live giả nhận customVocabulary trong inputAudioTranscription

**Tệp sửa:** `server/chep-loi-nguoi-dan.js (tuRiengCua, xoay)`, `server/agent/nha-cung-cap/chep-loi.js (lọc ký tự cấm)`, `server/agent/mieng/gemini-live.js (tùy theo tài liệu)`, `server/agent/mieng/mieng.js (truyền danh sách khi mở miệng Gemini)`, `test/chep-loi.test.js`, `test/mieng.test.js`, `SPEC.md mục 6 (ghi ngày tra)`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** Không thêm ô. Danh sách lệnh để trong mã, hoặc trong tu-khoa-song.json mục tu_rieng_lenh.

**Giả lập Facebook:** không

**Test:**
- test/chep-loi.test.js: ≤ 100 từ, thứ tự ưu tiên, lọc ký tự, lấy lại khi xoay phiên
- test/mieng.test.js: miệng Gemini giả nhận từ riêng (nếu làm)

**Claude Code làm thay:** - Đã tra ngày 27/9/2026, miễn phí:
  - trang giá Gemini API: bản Live 3,50/21, bản thường 2/12;
  - tài liệu Gemini live-transcribe: customVocabulary tối đa 1.000, tốt nhất ≤ 100;
  - tài liệu OpenAI realtime transcription: keywords dùng được cho gpt-live-transcribe, cấm ký tự <, >, xuống dòng.
- Chọn danh sách lệnh.
- Nếu chạy phép thử: tự so bản chép lời có và không có từ riêng.

**Thử AI thật:** - Tùy chọn, hỏi trước: Google Gemini 3.5 Transcribe Live chạy 3 phút (≈ 0,03 USD), nghe 10 câu lệnh bằng tiếng giả, so khi có và không có danh sách.
- Tiếng giả tạo bằng tieng-gia.js, tốn khoảng 10 lượt giọng Google (hạn 100 lượt/ngày).
- OpenAI: 0.

**Phụ thuộc:** Làm sau P13, P14, P17 để đủ các lệnh bằng lời mới (người mẫu, cảm ơn, bình chọn).

**Rủi ro:** - Danh sách dài làm nghe kém hơn → cắt ở 100.
- Từ riêng có thể làm máy "nghe ra" từ không có thật → chỉ nạp từ thật của phiên.
- Ở chế độ Mai với GPT Live 1 thì tính năng này không có tác dụng.

**Mặc định tự chọn:** 100 từ, theo thứ tự ưu tiên ở trên: lệnh và tên riêng trước, món trong phiên trước món khác.

---

## BH7 — Khép kín đơn: Messenger một chạm, chuyển khoản, tăng giá trị đơn, bán sau live

**Định nghĩa xong:** - npm test đạt toàn bộ: 537 test cũ cộng test mới (gui-he-thong, messenger-mot-cham, chuyen-khoan, gop-don, khach-quen, cho-hang, gia-live, xem-lai và phần sửa ở the-don, don, facebook, kiem-tra, chot-don, hop-thu). Không test nào gọi mạng hay AI thật. kho.doiChieu() rỗng sau các chuỗi ngẫu nhiên có gộp, nhường suất và giá live.
- Bản xem thử (cổng 5190): Claude Code tự lái trình duyệt, chạy trọn 8 kịch bản khách giả theo kịch bản, 0 lượt AI. Gồm: khách mới chọn SĐT → COD; khách cũ 'Như đơn trước' → Chuyển khoản → QR → 'Đã nhận tiền'; thêm món phối đạt miễn ship; hai buổi → Gộp; cháy size → Vẫn chờ → nhường suất; giá live (bật tạm trong dữ liệu xem thử); bình luận xem lại → thẻ; bấm 3 mục menu. Có ảnh chụp màn hình.
- Một lượt AI thật (gpt-6-luna, Messenger giả, khách do Claude Code gõ) đạt: không tự gõ số tài khoản, gọi gui_ma_chuyen_khoan, không nói 'đã nhận tiền', dùng đúng số đo đã lưu. Chi phí thật ghi vào SPEC, dưới 0,10 USD.
- SPEC.md lên 3.4:
  - quyết định mới từ #91 trở đi: thẻ đơn 3 nút và QR (sửa #62, #89); đổi dòng 83 Hộp thư; giá live mở lại một phần mục 'Ngoài phạm vi', tắt mặc định; số đo tắt mặc định; đơn sửa món sau xác nhận thì về Chờ xác nhận (sửa bảng chuyển trạng thái mục 7);
  - các F mới đánh tiếp sau những số các mốc trước đã dùng; mục 7 thêm cột và bảng cho_hang; ghi ngày tra tài liệu vào mục 6;
  - mục 12 ghi kết quả và các dòng Bước 0 cho BH7; mục 13 thêm rủi ro.
- Soạn sẵn cho chủ dự án: hướng dẫn cài menu Messenger, khai tài khoản với thuế, thử chuyển 1.000đ; nháp chính sách hoàn tiền; câu hỏi cho luật sư về giá live và số đo.
- Commit, tag bh7-khep-kin-don, dừng chờ chủ dự án duyệt.

**Thứ tự:**
- 1. Nền BH7 (Facebook giả mở rộng, khách giả theo kịch bản, gui-he-thong): mọi tính năng sau cần các hàm mới trong hợp đồng Facebook và đường gửi có kiểm 24 giờ, Hook, tự giới thiệu. Làm trước thì test nào cũng chạy được bằng giả.
- 2. Messenger một chạm (P19): dựng trả lời nhanh, nút gọi, xử lý postback menu. Tính năng Chuyển khoản và Gộp đơn dùng lại các phần này.
- 3. Thẻ đơn chọn cách trả và QR (P21): đổi thẻ đơn #89 sang 3 nút. Tính năng Gộp đơn gắn trả lời nhanh lên thẻ mới này. Lượt thử AI thật duy nhất của mốc đặt ở đây.
- 4. Miễn ship, món phối, gộp / tách (P23): sửa lỗi đơn Đã xác nhận bị đổi món mà không xác nhận lại. Tính năng Bán sau live cần luật gộp này.
- 5. Khách quen và size quen (P20): chỉ đọc lịch sử đơn. Size quen dùng cho nút phân loại của Gộp đơn và thẻ thiếu size.
- 6. Danh sách chờ (P24 bước 2): đụng lõi giữ hàng (nhường suất trong giao dịch). Làm sau khi các luồng thẻ đã ổn, kèm test song song.
- 7. Giá live tới hết buổi (P18, tắt mặc định): đổi giuTrong. Làm trước Bán sau live để luật 'người xem lại không hưởng giá live' có ngay từ đầu.
- 8. Bán sau live (P03) và bình luận mục lục: phụ thuộc gộp đơn, giá live và thẻ P22. Phần Facebook thật cần Bước 0 nhất nên làm cuối, giả lập đủ.

**Chi phí thử thật:** OpenAI: trần 0,10 USD cho BH7, ước 0,03–0,05 USD. Chỉ một lượt gộp: Tư vấn viên gpt-6-luna trên Messenger giả, khoảng 20–25 lượt, khách do Claude Code gõ thay cho khach_gia; phần còn lại của ngân sách dưới 1 USD để cho các mốc khác. Google: 0 USD (không TTS, không miệng Live, không Gemini). VietQR: 0đ (1 lần lấy ảnh với STK mẫu). Chuyển 1.000đ thật do chủ dự án tự làm. Không chạy miệng Live thật.

**Ghi chú khi đọc mã:** XUNG ĐỘT VÀ PHỤ THUỘC VỚI MỐC KHÁC
1. Giới hạn 3 nút của Messenger:
   - Thẻ đơn #89 (Xác nhận / Sửa) cộng P21 (Nhận hàng trả tiền / Chuyển khoản) cộng Gọi shop là 5 nút. Đã gộp thành [Nhận hàng trả tiền = xác nhận COD] [Chuyển khoản = xác nhận CK] [Sửa đơn]. Nút Gọi shop chuyển sang tin xin thông tin, trả lời menu và tin chuyển khoản. Phải sửa #89 và test/the-don.test.js.
   - Thẻ giữ hàng P22 (mốc trước) cũng chỉ có 3 nút mà BH7 cần thêm [Vẫn chờ] (bản hết hàng) và [Lấy M như lần trước] (bản thiếu size). Người thiết kế P22 phải để chỗ.
2. BH7 cần các việc của mốc trước:
   - P22: thẻ và đường gửi có Hook; bộ đọc nút chung; Hook giới hạn liên hệ.
   - P24a: giữ hàng hai mức.
   - P06: đơn đủ thông tin mà hết giờ giữ thì vào 'Gọi xác nhận', không tự hủy. Thiếu cái này thì đơn gộp bị hủy cả phần khách đã xác nhận.
   - P42: tách 'Dừng AI' và 'Dừng mọi thứ'.
   - Đánh dấu lượt nhắn riêng; lưu giờ bắt đầu và video id do Facebook trả về.
   - P34a: bangChungGiaGoc. Chưa có thì làm trong tính năng Giá live.
   Các mốc khác liên quan:
   - P43: câu 'chỉ nhận tiền vào TK tên …' nên đọc ten_tk mới.
   - P31: danh sách 8 mục đọc 3 ô ngân hàng; 'giờ nghe máy' chưa có ô nên tin Gặp người thật không ghi giờ.
   - P07: câu ghim thêm luật giá live.
   - P08: mục lục dùng chung hàm mốc thời gian.
   - P32: tổng kết thêm 'chốt sau live'.
   - K11 (P34): nhận thêm cụm cấm 'khách quen', 'chỉ hôm nay'.
   - Mục 6.3 (P09/P10): dùng lại luồng dừng nhận tin và xóa dữ liệu mà menu BH7 gọi tới.
   - Mục 6.4 (xuất file đúng mẫu hãng) thuộc mốc khác, BH7 không đụng.
3. Số F, số # và số tệp nâng cấp chưa đánh cứng. BH7 gom vào MỘT tệp gợi ý '0xx-khep-kin-don.sql', từ 018 trở đi sau các mốc trước. Không sửa tệp cũ.

PHÁT HIỆN KHI ĐỌC MÃ (đã kiểm bằng Read / Grep)
a. don.js themMon, botMon, doiPhanLoai cho sửa đơn Đã xác nhận mà không đưa về Chờ xác nhận. cap_nhat_don 'them' của AI có thể đổi tổng tiền đơn đã xác nhận mà khách không xác nhận lại. BH7 sửa trong tính năng Gộp đơn.
b. gui-the-don.js guiTinHeThong không kiểm cửa sổ 24 giờ và ai_tam_dung. Hiện chỉ an toàn vì mới dùng để trả lời nút bấm. BH7 thay bằng gui-he-thong.js.
c. hop-thu.js:83 bỏ bình luận bài live TRƯỚC khi lưu, nên bình luận xem lại mất hẳn. laBaiLive (nghiep-vu/hop-thu.js:394) chỉ so với fb_live_video_id.
d. gia.js ketThucLive xóa binhLuanCu, nên chưa giả lập được video xem lại.
e. giao-dien.js BAT_BUOC không kiểm các hàm Hộp thư. Giả và thật có thể lệch mà không ai hay.
f. man-hinh-san-pham.js:73 và san-pham.js:562 đưa giá gạch và dòng 'Giá gốc' cho AI mỗi khi gia_goc > gia, không cần bằng chứng (P34a).
g. binh_luan_live.noi_dung vẫn giữ nguyên số điện thoại của bình luận đã bị ẩn (#19). P19 chỉ xóa don.sdt_goi_y. Có nên che số trong bảng bình luận không: hỏi chủ dự án hoặc luật sư.
h. the-don.js noiDung có chữ 'nhé' trong dòng cuối thẻ. Nên bỏ theo luật 'rất ít nhé' khi sửa thẻ.
i. ChotDon.xuLy chỉ gộp đơn trong cùng phiên (donMoTrongPhien). Gộp giữa hai buổi làm ở P23.

CẦN HỎI CHỦ DỰ ÁN (đã chọn mặc định, đổi được)
1. 'AI gợi ý mức giá live' làm bằng quy tắc −5/−10/−15%, 0đ, không gọi AI. Có đồng ý không?
2. Hỏi lưu số đo đang TẮT tới khi luật sư trả lời. Có đồng ý không?
3. Tự đăng bình luận mục lục sau live đang BẬT. Có muốn chuyển sang bấm tay không?
4. Bình luận xem lại không phải chốt đưa Tư vấn viên AI trả lời (tốn một ít tiền AI mỗi bình luận). Có đồng ý không?
5. Shop dùng ngân hàng nào? Đã khai tài khoản với thuế chưa? Duyệt nháp chính sách hoàn tiền.
6. Khách giả mặc định 'theo kịch bản' (0đ) thay cho AI (#87). Có đồng ý không?

BƯỚC 0 CẦN THÊM CHO BH7 (Facebook thật; khác giả thì sửa that.js và gia.js)
- Trả lời nhanh, gồm user_phone_number, gửi kèm button template và trong tin nhắn riêng.
- Nút phone_number.
- /me/messenger_profile (get_started, persistent_menu) và postback của menu.
- Upload ảnh QR bằng guiAnh.
- Dạng post_id trong webhook bình luận live; bình luận xem lại có về webhook và có live_broadcast_timestamp không.
- POST bình luận lên video id; giờ creation_time hay broadcast_start_time mới là giờ phát thật.
Tài liệu Meta, VietQR và payOS đã được phiếu soi 'công nghệ mới nhất' tra ngày 27/9/2026. Lúc code tra lại và ghi ngày vào SPEC mục 6. BH7 không thêm thư viện nào: ảnh QR lấy từ img.vietqr.io, danh sách ngân hàng là JSON tĩnh.

### Nền cho BH7: mở rộng Facebook giả, khách giả theo kịch bản, một đường gửi tin hệ thống (mở rộng F-15, F-25)

*Đề xuất: P19, P20, P21, P23, P24, P03, P18 · công sức: vua*

- Hợp đồng chung server/facebook/giao-dien.js: hiện BAT_BUOC chỉ kiểm các hàm live. Ghi và kiểm thêm các hàm Hộp thư đang có (guiTinNhan, guiThe, guiAnh, guiUtility, nhanRieng, traLoiBinhLuan, coTheNhanRieng), và thêm hàm mới, that.js và gia.js cùng làm:
  - guiTinNhan({…, nhanh}) và guiThe({…, nhanh}): kèm trả lời nhanh, gồm loại {loai:'sdt'} (user_phone_number) và {tieu_de, payload};
  - nút loại gọi trong guiThe: {loai:'goi', tieu_de, so}, thành type 'phone_number' của Meta (hiện mọi nút đều là 'postback');
  - caiMenu({page_id, bat_dau, menu}): Messenger Profile API (get_started + persistent_menu);
  - dangBinhLuan({page_id, doi_tuong_id, noi_dung}): Page bình luận lên video;
  - docBinhLuanVideo(liveId, sauLuc): đọc bình luận của live đã tắt.
- su-kien.js tuWebhook: đọc message.quick_reply.payload thành trường nhanh_payload của sự kiện tin_nhan. Postback giữ postback.referral.ref (để P01 phần 4 dùng sau, BH7 chưa xử lý).
- Đường gửi tin hệ thống duy nhất, file mới server/gui-he-thong.js, tách từ gui-the-don.js guiTinHeThong. Mọi tin do mã soạn của BH7 (QR, trả lời menu, mời giữ hàng, hỏi gộp, hỏi lưu số đo, gợi ý phối) đều qua đường này. Nó kiểm lần lượt:
  - 'Dừng mọi thứ' (P42): chặn; riêng 'Dừng AI' thì tin do mã soạn vẫn đi;
  - người đang giữ hội thoại (ai_tam_dung): không gửi tự động;
  - cửa sổ 24 giờ (tin_khach_cuoi_luc; bấm nút cũng tính là khách vừa nhắn);
  - Hook giới hạn liên hệ của mốc trước;
  - khóa chống trùng (ghiTinRa);
  - hội thoại chưa giới thiệu (da_gioi_thieu_ai = 0): tự thêm câu 'Mình là {ten_ai} (trợ lý tự động) của {ten_shop}', dùng lại gioi-thieu.daTuGioiThieu, rồi đặt cờ.
  Hiện guiTinHeThong KHÔNG kiểm 24 giờ và ai_tam_dung; chỉ an toàn vì mới dùng để trả lời nút bấm.
- Bộ đọc nút chung (mốc trước) thêm payload của BH7: CK_DON, DOI_COD, GOP_DON, TACH_DON, THEM_PHOI, CHON_PL, VAN_CHO, NHU_DON_TRUOC, DUNG_SO, LUU_SO_DO, KHONG_LUU_SO_DO, MENU_DON, MENU_NGUOI, MENU_XOA, XAC_NHAN_XOA, BAT_DAU. Mọi payload có mã đơn phải kiểm đơn thuộc đúng người bấm, như theDon.xacNhanBangNut đang làm.
- Khách giả theo kịch bản, không gọi AI: file mới server/cau-hinh/kich-ban-khach-gia.json. Mỗi kịch bản là chuỗi 'khi shop gửi tin có nút / trả lời nhanh X, hoặc chữ khớp Y, thì khách bấm / chọn / gõ Z / im'. KhachGia (server/khach-gia.js) có thêm chế độ 'kich_ban' bên cạnh chế độ AI của #87.
- Phòng diễn tập: khung Messenger giả hiện trả lời nhanh (bấm được), nút gọi (hiện số, không gọi), ảnh (QR hiện ảnh thật), menu cố định 3 nút, và ô 'Bình luận xem lại (giả)'.

**Tiêu chí:**
- [ ] Khởi động với bộ Facebook thiếu hàm mới thì báo lỗi rõ tên hàm (test kiemHopDong cho cả gia.js và FacebookThat)
- [ ] that.js với fetchGia (test/facebook.test.js): body có quick_replies [{content_type:'user_phone_number'},{content_type:'text',title,payload}]; nút {type:'phone_number',title,payload:'+84…'}; POST /me/messenger_profile có get_started.payload='BAT_DAU' và persistent_menu gồm 3 postback
- [ ] tuWebhook: tin có message.quick_reply.payload thì ra sự kiện có nhanh_payload
- [ ] gui-he-thong: ngoài 24 giờ thì không gọi Facebook và ghi lý do; hội thoại ai_tam_dung thì không gửi; 'Dừng mọi thứ' thì không gửi; tin đầu của hội thoại chưa giới thiệu có 'trợ lý tự động'; cùng khóa gửi hai lần thì chỉ một tin
- [ ] Khách giả kịch bản đi trọn 'chốt → Giữ → chọn SĐT → gõ địa chỉ → Nhận hàng trả tiền' với 0 lần gọi nhà cung cấp AI (đếm bằng AI giả)
- [ ] Test cũ của #89 (test/the-don.test.js) vẫn đạt sau khi tách guiTinHeThong

**Tệp sửa:** `server/facebook/giao-dien.js`, `server/facebook/that.js`, `server/facebook/gia.js`, `server/facebook/su-kien.js`, `server/gui-the-don.js`, `server/gui-he-thong.js (mới)`, `server/khach-gia.js`, `server/cau-hinh/kich-ban-khach-gia.json (mới)`, `server/api/dien-tap.js`, `public/js/man-hinh/live.js`, `test/facebook.test.js`, `test/gui-he-thong.test.js (mới)`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** - Tệp mới server/cau-hinh/kich-ban-khach-gia.json.
- Tệp mới server/cau-hinh/tin-he-thong.json: mọi câu mẫu do mã soạn của BH7, sửa được không cần đổi mã, dùng chung cho các tính năng dưới.
- Phòng diễn tập thêm công tắc 'Khách giả: theo kịch bản (0đ) / AI'.

**Giả lập Facebook:** Thêm vào gia.js:
- guiTinNhan/guiThe nhận 'nhanh' và nút gọi, lưu vào luồng chat;
- khachChonNhanh({page_id, psid, payload, tieu_de}) phát tin_nhan có nhanh_payload;
- sdtHoSo (Map psid → số): hồ sơ không có số thì bỏ trả lời nhanh 'sdt', như Meta;
- caiMenu lưu menuPage; khachBamMenu phát postback;
- guiAnh lưu thêm ảnh base64 nhỏ (≤ 200 KB) để hiện QR;
- dangBinhLuan lưu vào traLoi;
- giữ live đã tắt: ketThucLive hiện XÓA binhLuanCu, cần đổi thành chuyển sang videoCu;
- docBinhLuanVideo; themBinhLuanXemLai({live_id, ten, noi_dung, luc}).
API Phòng diễn tập: POST /dien-tap/chon-nhanh, /dien-tap/bam-menu, /dien-tap/binh-luan-xem-lai.

**Test:**
- test/facebook.test.js: body that.js cho quick_replies, phone_number, messenger_profile, POST /{video}/comments; tuWebhook quick_reply
- test/gui-he-thong.test.js (mới): 24 giờ, ai_tam_dung, Dừng mọi thứ, tự giới thiệu, chống trùng
- test/dien-tap-ban-hang.test.js: khách giả theo kịch bản không gọi AI

**Claude Code làm thay:** - Claude Code viết toàn bộ kich-ban-khach-gia.json (khoảng 12 kịch bản cho mọi luồng BH7), thay cho khách giả gọi gpt-6-luna.
- Viết 'đáp án mẫu' cho AI giả trong test.
- Tự lái trình duyệt bản xem thử (cổng 5190) đóng vai khách bấm từng nút và chụp màn hình, thay cho chủ dự án thử tay.

**Thử AI thật:** không

**Phụ thuộc:** Mốc trước: bộ đọc nút chung, Hook giới hạn liên hệ, P42 (tách 'Dừng AI' và 'Dừng mọi thứ'), P22 (đường gửi thẻ có Hook).

**Rủi ro:** - Giả khác thật: quick reply gắn vào button template, nút phone_number, Messenger Profile API chưa kiểm trên Page thật. Ghi vào Bước 0; khác thì sửa that.js và gia.js.
- Tách guiTinHeThong có thể đổi hành vi #89. Chạy lại test/the-don.test.js.

**Mặc định tự chọn:** - Khách giả mặc định 'theo kịch bản' trong Phòng diễn tập. Lý do: ngân sách OpenAI của cả đợt dưới 1 USD. Chế độ AI của #87 vẫn bật được.
- Tin do mã soạn vẫn đi khi 'Dừng AI', vì không tốn tiền AI (P42).
- Ảnh giả tối đa 200 KB.

### Messenger một chạm: chạm là điền số, 'Như đơn trước', nút Gọi shop, menu cố định và nút Bắt đầu

*Đề xuất: P19 · công sức: vua*

- Tin xin thông tin giao do MÃ soạn (hiện do Tư vấn viên AI viết). Gửi khi đơn Chờ xác nhận còn thiếu tên, SĐT hoặc địa chỉ và khách vừa tương tác (bấm Giữ ở thẻ P22, hoặc nhắn trả lời).
  - Dạng button template: 'Để giao {món}, shop cần tên, số điện thoại và địa chỉ. Shop dùng số này chỉ để giao đơn.'
  - Nút [📞 Gọi shop] (phone_number, lấy sdt_shop trong Cài đặt), chỉ hiện khi số hợp lệ.
  - Trả lời nhanh: (a) user_phone_number, Messenger tự điền số trong hồ sơ, hồ sơ không có số thì nút không hiện; (b) [Như đơn trước] khi hồ sơ khách có đơn Đã gửi / Đã giao còn địa chỉ; (c) [Dùng số 0912***678] khi bình luận chốt có số điện thoại (bình luận đã bị ẩn theo #19).
- Khách chọn thì mã ghi vào đơn: don.datThongTinGiao thêm boi 'khach'; taoKhach theo số giống cap_nhat_don hiện nay. Đủ thông tin thì thẻ đơn tự gửi (#89 / tính năng Chuyển khoản). Còn thiếu thì mã hỏi đúng phần thiếu ('Shop cần thêm địa chỉ giao ạ'). Khách gõ chữ thì Tư vấn viên xử lý như cũ.
- Như đơn trước: chép tên, SĐT, địa chỉ từ đơn Đã gửi / Đã giao gần nhất của cùng hồ sơ (không lấy đơn Hoàn). Thẻ đơn đọc lại địa chỉ, số che bớt để khách soát.
- Số khách lỡ ghi trong bình luận: ChotDon.xuLy lấy số bằng regex của nhan-binh-luan.js, lưu vào don.sdt_goi_y. Chỉ ghi vào đơn khi khách bấm. Xóa khi đơn Đã xác nhận hoặc Đã hủy (trong doiTrangThai). Không vào hồ sơ khách nếu khách không chọn. Luật #19 và chot-don.js:222 vẫn giữ: không tự điền.
- Menu cố định và nút Bắt đầu: Cài đặt → Facebook thêm nút 'Cài menu Messenger' (người bấm, không tự đổi Page). Gọi caiMenu: get_started BAT_DAU; persistent_menu 3 postback: Đơn của tôi / Gặp người thật / Xóa dữ liệu của tôi. Menu không chứa nút gọi, vì Meta chỉ nhận web_url và postback.
- Xử lý bằng mã, 0 lượt AI, trong server/hop-thu.js nhan() cạnh xuLyNut:
  - BAT_DAU: chào, tự giới thiệu, dặn 'gõ số món + màu + size', kèm trả lời nhanh [Đơn của tôi] [Gặp người thật].
  - MENU_DON: tối đa 3 đơn của người đó (mở trước): mã, trạng thái, tổng tiền, mã vận đơn, không có số đầy đủ. Chưa có đơn thì báo chưa thấy.
  - MENU_NGUOI: chuyển Cần người (canNguoi) kèm tin 'đã báo nhân viên' và [📞 Gọi shop].
  - MENU_XOA: thẻ [Xác nhận xóa] [Thôi]. Xác nhận thì báo 'shop đã nhận yêu cầu, xử lý trong 2 ngày làm việc' (NĐ 356), tạo việc loại 'xoa_du_lieu' hạn 2 ngày làm việc cho người, và Cần người (dùng lại luồng yeu_cau_xoa có sẵn). Không tự xóa khi khách còn đơn chưa xong.
- Trả lời nhanh chỉ gửi trong 24 giờ; mọi tin đi qua gui-he-thong.

**Tiêu chí:**
- [ ] Đơn thiếu thông tin, khách bấm Giữ: Facebook giả nhận ĐÚNG 1 tin có nút Gọi shop và trả lời nhanh SĐT; 0 lần gọi AI
- [ ] Khách chọn SĐT (nhanh_payload '+84912345678'): đơn có sdt_nhan, hồ sơ khách tạo mới hoặc nối theo số; thiếu địa chỉ thì có tin hỏi địa chỉ; đủ thì có thẻ đơn
- [ ] Khách có đơn cũ Đã giao: có [Như đơn trước]; bấm thì đơn mới có tên, số, địa chỉ cũ và thẻ đơn được gửi. Khách chỉ có đơn Hoàn: không có nút
- [ ] Bình luận 'chốt 12 đen M 0912345678': bình luận bị ẩn, đơn có sdt_goi_y, nút hiện '0912***678', sdt_nhan vẫn trống; đơn xác nhận hoặc hủy thì sdt_goi_y về NULL
- [ ] Payload DUNG_SO / NHU_DON_TRUOC mang mã đơn của người khác: không ghi gì, không trả thông tin đơn
- [ ] Hồ sơ giả không có số: không có trả lời nhanh SĐT
- [ ] Menu: Đơn của tôi trả đúng đơn, số che bớt; Gặp người thật đưa hội thoại vào Cần người và AI ngừng; Xóa dữ liệu qua bước xác nhận thì có việc hạn 2 ngày làm việc và tin báo, dữ liệu CHƯA bị xóa tự động
- [ ] Nút 'Cài menu Messenger': that.js gửi đúng body (fetchGia); Facebook giả lưu menu; Phòng diễn tập hiện 3 nút bấm được

**Tệp sửa:** `server/hop-thu.js`, `server/nghiep-vu/the-don.js (hoặc tệp mới server/nghiep-vu/the-xin-thong-tin.js)`, `server/nghiep-vu/don.js (datThongTinGiao boi 'khach', sdt_goi_y, xóa khi xác nhận/hủy)`, `server/nghiep-vu/khach.js (LOAI_VIEC thêm xoa_du_lieu, donGanNhatDaGui)`, `server/chot-don.js (lưu sdt_goi_y)`, `server/nghiep-vu/nhan-binh-luan.js (xuất hàm laySdt)`, `server/facebook/ket-noi.js (caiMenu)`, `server/api/ket-noi.js (POST /ket-noi/menu-messenger)`, `public/js/man-hinh/cai-dat-facebook.js`, `server/cau-hinh/tin-he-thong.json`, `server/cau-hinh/skill-mau.json + skill-mau-cu.json (Skill 'Lên đơn và xin thông tin giao')`, `server/cau-hinh/loi-dan-mau.json + loi-dan-mau-cu.json`, `server/db/nang-cap/0xx-khep-kin-don.sql`, `test/messenger-mot-cham.test.js (mới)`

**Dữ liệu:** don.sdt_goi_y TEXT, cột mới trong tệp nâng cấp gợi ý tên '0xx-khep-kin-don.sql' (số tiếp sau các mốc trước, từ 018). Lý do: số chỉ gắn với đúng một đơn, xóa khi đơn xong. viec.loai thêm 'xoa_du_lieu', chỉ đổi LOAI_VIEC trong khach.js vì cột viec.loai không có CHECK.

**Cấu hình, câu mẫu, Skill, Hook:** - tin-he-thong.json: tin xin thông tin, hỏi phần còn thiếu, chào Bắt đầu, trả lời 3 mục menu, xác nhận xóa.
- Lời dặn Tư vấn viên thêm: 'khách chọn số / Như đơn trước qua nút thì MOZA đã ghi; không hỏi lại; tin xin thông tin do MOZA gửi, đừng gửi lại'.
- Skill 'Lên đơn và xin thông tin giao': thêm phần trên, và nhớ ghi bản cũ vào skill-mau-cu.json.
- Cài đặt → Facebook thêm nút 'Cài menu Messenger' (không thêm ô nhập).

**Giả lập Facebook:** Dùng phần nền: sdtHoSo, khachChonNhanh, caiMenu / khachBamMenu, nút gọi. Kịch bản khách giả: 'khách mới chọn SĐT', 'khách cũ Như đơn trước', 'bình luận có số', 'bấm 3 mục menu'.

**Test:**
- test/messenger-mot-cham.test.js (mới): 8 tiêu chí trên, dùng Facebook giả và AI giả
- test/chot-don.test.js: bình luận có số lưu sdt_goi_y, không tự điền
- test/don.test.js: sdt_goi_y xóa khi xác nhận hoặc hủy
- test/facebook.test.js: body messenger_profile

**Claude Code làm thay:** - Claude Code soạn mọi câu trong tin-he-thong.json, không để AI viết lúc chạy (bớt 1 lượt AI mỗi lần xin thông tin).
- Viết kịch bản khách giả; tự lái Phòng diễn tập bấm từng nút.
- Tra lại tài liệu Meta lúc code: Messenger Profile, quick replies trên template, phone_number button (lần tra trước là 27/9/2026).
- Soạn hướng dẫn cho chủ dự án: bấm 'Cài menu Messenger' sau khi nối Page, tắt 'Bình luận → tin nhắn' của Meta Business Suite.

**Thử AI thật:** không, 0 USD: toàn bộ làm bằng mã. Lời dặn mới được kiểm chung trong lượt thử của tính năng Chuyển khoản.

**Phụ thuộc:** Nền BH7; P22 (thẻ giữ hàng, nút Giữ); bộ đọc nút chung; Hook giới hạn liên hệ; #19; #89.

**Rủi ro:** - Số trong hồ sơ Facebook có thể đã cũ: thẻ đơn đọc lại số che bớt để khách soát.
- Gắn trả lời nhanh vào button template chưa kiểm trên Page thật (Bước 0). Không được thì tách thành tin chữ có trả lời nhanh, rồi tin nút Gọi shop.
- Payload do khách gửi là dữ liệu không tin cậy: luôn kiểm chủ đơn.
- Menu đổi cấu hình Page thật: người bấm nút, không tự làm.

**Mặc định tự chọn:** - 'Như đơn trước' lấy đơn Đã gửi / Đã giao gần nhất, vì địa chỉ đó đã gửi hàng thật được.
- Chỉ hiện nút Gọi shop khi sdt_shop chuẩn hóa được thành +84.
- Yêu cầu xóa dữ liệu: người làm, MOZA chỉ báo đã nhận và tạo việc hạn 2 ngày làm việc. Lý do: còn đơn chưa xong thì không xóa được (F-54).
- Menu cài bằng nút bấm.

### Thẻ đơn chọn cách trả tiền và mã QR chuyển khoản đúng số tiền, đúng mã đơn (6.2 cách A)

*Đề xuất: P21 · công sức: vua*

- Thẻ đơn #89 đổi thành 3 nút, vì Messenger cho tối đa 3 nút:
  - [✅ Nhận hàng trả tiền]: xác nhận, thanh toán COD;
  - [💳 Chuyển khoản]: xác nhận, thanh toán chuyển khoản;
  - [✏️ Sửa đơn].
  Chưa đủ 3 ô ngân hàng thì giữ 2 nút cũ [✅ Xác nhận đơn] [✏️ Sửa đơn]. Không ép khách chuyển khoản. Khóa phiên bản đơn giữ như cũ: bấm trên thẻ cũ thì gửi thẻ mới.
- Bấm Chuyển khoản:
  1. Đơn đặt thanh_toan = chuyen_khoan và thành Đã xác nhận (nguồn 'khách tự báo').
  2. Tải ảnh VietQR quick link https://img.vietqr.io/image/{bin}-{stk}-compact2.png?amount={tong_tien}&addInfo=DH0042&accountName={TEN}, rồi gửi bằng guiAnh. guiAnh tải tệp lên Facebook nên không cần địa chỉ công khai.
  3. Gửi tin chữ do mã soạn: ngân hàng · STK · tên chủ TK · số tiền · nội dung DH0042; câu chống giả shop 'Shop chỉ nhận tiền vào TK tên … và chỉ gửi mã QR trong Messenger của Page này'; 'shop báo lại khi nhận được tiền'. Kèm nút [🔁 Trả khi nhận hàng] (đổi về COD) và [📞 Gọi shop].
  Tải ảnh lỗi hoặc quá 5 giây thì chỉ gửi tin chữ.
- Chỉ gửi đi dữ liệu của shop: STK, tên chủ TK, số tiền, mã đơn. Không có tên, số, địa chỉ khách. MOZA không lưu gì về người chuyển.
- Người vẫn tự bấm 'Đã nhận tiền' (POST /don/:id/nhan-tien có sẵn). Còn trong 24 giờ thì MOZA nhắn khách 'shop đã nhận {tổng} cho đơn {mã}' bằng mã; AI không bao giờ nói câu này. Tổng quan thêm dòng 'Chuyển khoản chờ đối chiếu: N'.
- Cài đặt → Bán hàng thêm 3 ô:
  - Ngân hàng: chọn từ danh sách server/cau-hinh/ngan-hang.json;
  - Số tài khoản;
  - Tên chủ tài khoản: tự viết hoa, bỏ dấu, như VietQR cần.
  Kèm dòng nhắc: khai tài khoản nhận tiền với thuế (NĐ 68/2026, mẫu 01/BK-STK), có mục 'Hoàn tiền' trong Sổ tay, thử chuyển 1.000đ.
- Tư vấn viên có công cụ mới gui_ma_chuyen_khoan (không tham số). Chỉ chạy khi đơn đang mở của khách đã có thanh_toan chuyển khoản; không thì báo lỗi kèm cách sửa: 'gọi cap_nhat_don thong_tin_giao thanh_toan chuyen_khoan trước'. Lời dặn và Skill 'Giá, phí ship, thanh toán': không tự gõ số tài khoản, gọi công cụ; không nói đã nhận tiền.
- kiem-tra.js dongCaiDat thêm dòng 'Tài khoản nhận tiền: …' để K2 trích được nếu AI cần nhắc.

**Tiêu chí:**
- [ ] Đủ 3 ô ngân hàng: thẻ có 3 nút, mọi tiêu đề ≤ 20 ký tự (theo độ dài UTF-16 như that.js cắt). Thiếu ô: 2 nút như #89
- [ ] Bấm Chuyển khoản trên thẻ đúng phiên bản: đơn Đã xác nhận, thanh_toan chuyen_khoan; Facebook giả nhận 1 ảnh và 1 tin chữ; số tiền trong URL = tong_tien; nội dung 'DH0042'
- [ ] URL VietQR chỉ có bin, STK, số tiền, mã đơn, tên chủ TK: kiểm bằng regex, không có số hay tên khách
- [ ] fetch VietQR giả lỗi hoặc treo 6 giây: chỉ có tin chữ, đơn vẫn Đã xác nhận
- [ ] Bấm 'Trả khi nhận hàng': thanh_toan về cod, trạng thái đơn không đổi, có tin xác nhận
- [ ] Người bấm Đã nhận tiền: trong 24 giờ có tin do mã soạn, ngoài 24 giờ không gửi gì; câu AI có 'shop đã nhận tiền' vẫn bị chặn như cũ
- [ ] Khách từng hoàn ≥ ngưỡng (#73) bấm Chuyển khoản: không xác nhận, không gửi QR, có việc 'Gọi xác nhận đơn'
- [ ] AI giả gọi gui_ma_chuyen_khoan khi đơn COD: lỗi kèm cách sửa; khi đơn chuyển khoản: gửi ảnh và tin
- [ ] Tổng quan đếm đúng đơn chuyển khoản chưa nhận tiền

**Tệp sửa:** `server/nghiep-vu/the-don.js (nut, docPayload, xacNhanBangNut nhận cách trả)`, `server/hop-thu.js (xuLyNut: CK_DON, DOI_COD)`, `server/gui-the-don.js`, `server/vietqr.js (mới: dựng URL, tải ảnh có hạn giờ, fetch tiêm vào được)`, `server/nghiep-vu/cai-dat.js (ban_hang: ngan_hang, so_tk, ten_tk, kiểm hợp lệ)`, `server/cau-hinh/ngan-hang.json (mới)`, `server/agent/cong-cu/don.js (gui_ma_chuyen_khoan)`, `server/agent/kiem-tra/kiem-tra.js (dongCaiDat)`, `server/api/don.js (nhan-tien gửi tin)`, `server/api/cai-dat.js (GET /cau-hinh/ngan-hang)`, `server/cau-hinh/skill-mau.json + skill-mau-cu.json`, `server/cau-hinh/loi-dan-mau.json + loi-dan-mau-cu.json`, `server/cau-hinh/tin-he-thong.json`, `public/js/man-hinh/cai-dat.js`, `public/js/man-hinh/tong-quan.js`, `public/js/man-hinh/live.js (hiện ảnh QR trong chat giả)`, `server/db/nang-cap/0xx-khep-kin-don.sql`, `test/the-don.test.js (sửa)`, `test/chuyen-khoan.test.js (mới)`

**Dữ liệu:** - Không thêm bảng. Ba ô ngân hàng nằm trong JSON cai_dat.ban_hang (ngan_hang = BIN, so_tk, ten_tk). Không để trong .env, vì đây không phải bí mật (gửi cho khách mọi lần).
- Nâng cấp '0xx-khep-kin-don.sql' thêm 'gui_ma_chuyen_khoan' vào agent tu_van.cong_cu, dùng json_insert như 016.
- Không lưu gì của người chuyển tiền. NĐ 356 xếp tài khoản ngân hàng vào dữ liệu nhạy cảm.

**Cấu hình, câu mẫu, Skill, Hook:** - ngan-hang.json: bin, mã, tên ngắn, tên đầy đủ.
- tin-he-thong.json mục chuyển khoản.
- Công cụ mới gui_ma_chuyen_khoan; Skill 'Giá, phí ship, thanh toán' sửa (bước 4); lời dặn Tư vấn viên.
- Cài đặt → Bán hàng thêm 3 ô (ngân hàng chọn từ danh sách).

**Giả lập Facebook:** - gia.js guiAnh lưu ảnh base64 để khung chat giả hiện đúng ảnh QR.
- fetch VietQR tiêm vào: test dùng PNG 1×1; Phòng diễn tập gọi thật img.vietqr.io, 0đ, chỉ khi shop đã điền ngân hàng.
- Kịch bản khách giả: 'chọn chuyển khoản', 'bấm nhầm rồi đổi COD', 'hỏi ck được không'.

**Test:**
- test/chuyen-khoan.test.js (mới): 9 tiêu chí trên, gồm hạn giờ 5 giây bằng fetch treo
- test/the-don.test.js: đổi kiểm 2 nút sang 3 nút khi đủ ngân hàng; giữ ca 2 nút khi thiếu
- test/kiem-tra.test.js: dongCaiDat có dòng tài khoản; câu 'shop đã nhận tiền' bị chặn
- test/cai-dat.test.js: tên chủ TK tự viết hoa, bỏ dấu; STK chỉ là chữ số

**Claude Code làm thay:** - Lấy danh sách ngân hàng từ api.vietqr.io/v2/banks một lần (miễn phí) để làm ngan-hang.json. Gọi img.vietqr.io một lần với STK mẫu để khớp định dạng (0đ).
- Soạn tin chuyển khoản.
- Nháp mục Sổ tay 'Hoàn tiền khi shop hết hàng / hủy đơn' để chủ dự án và kế toán duyệt.
- Viết hướng dẫn: khai tài khoản với thuế, thử chuyển 1.000đ.
- Tự lái Phòng diễn tập đóng vai khách chọn chuyển khoản. Trong lượt thử AI thật, Claude Code gõ vai khách thay cho khach_gia.

**Thử AI thật:** Có, 1 lượt thử gộp cho cả BH7 đặt ở đây: Messenger giả, Tư vấn viên chạy gpt-6-luna (model diễn tập #88), khách do Claude Code gõ trên trình duyệt. 3 tình huống: 'chuyển khoản được không', 'cho mình số tài khoản', 'mình ck rồi nha'; cộng 1 tình huống số đo đã lưu của tính năng Khách quen. Khoảng 20 lượt, ước 0,03–0,05 USD OpenAI; báo trước khi chạy. Google 0.

**Phụ thuộc:** Nền BH7, Messenger một chạm (nút Gọi shop), #89, #62 (sửa), #73; P43 dùng tên chủ TK từ đây; P31 (danh sách 8 mục đọc 3 ô mới).

**Rủi ro:** - Đụng tới tiền thật. Khách chuyển sai nội dung: shop đối chiếu tay.
- img.vietqr.io không cam kết luôn chạy: có đường lùi tin chữ.
- Chưa khai tài khoản với thuế: nhắc trong Cài đặt, nhờ kế toán xem.
- Khách bấm nhầm Chuyển khoản: có nút đổi về COD.
- Người quên bấm Đã nhận tiền: đơn vẫn vào danh sách Cần gửi, phiếu in ghi 'Chuyển khoản — chưa nhận tiền' như hiện có.
- Cần người rành thanh toán xem trước khi gửi QR cho khách thật.

**Mặc định tự chọn:** - Mẫu ảnh 'compact2' (có logo ngân hàng, số tiền, nội dung).
- Chờ ảnh tối đa 5 giây.
- Nội dung 'DH0042': bỏ gạch, ≤ 9 ký tự, để sau đổi sang payOS vẫn vừa.
- Nút Chuyển khoản chỉ hiện khi đủ 3 ô.
- #73 bấm Chuyển khoản thì không gửi QR, để không nhận tiền trước khi người gọi xác nhận.
- Tin 'đã nhận tiền' chỉ gửi trong 24 giờ, không làm mẫu Utility riêng.

### 'Thêm X nữa là miễn ship', gợi ý một món phối, gộp / tách đơn giữa hai buổi

*Đề xuất: P23 · công sức: vua*

- Thẻ đơn (Chờ xác nhận, đủ thông tin) thêm dòng do mã tính: 'Thêm {mien_phi_tu − tong_hang} nữa là miễn ship'. Chỉ khi có mức miễn ship, tong_hang còn dưới mức và phí ship > 0. Không bao giờ đưa vào tin Utility.
- Một món phối: mã chọn trong phoi_cung của các món trong đơn. Điều kiện: Đang bán, còn hàng ít nhất một phân loại, chưa có trong đơn. Ưu tiên món có giá bù đủ phần còn thiếu.
  - Gắn làm trả lời nhanh của thẻ đơn: [➕ Thêm {gọi} {số}].
  - Bấm thì mã gửi trả lời nhanh các phân loại còn hàng của món đó, tối đa 12, size quen của khách đứng đầu. Lý do: áo M và quần 28 khác bảng size, không tự suy được.
  - Bấm phân loại thì themMon (giữ hàng trong một giao dịch), tính lại ship và gửi thẻ đơn mới.
  - Mỗi người tối đa 1 lần gợi ý trong 24 giờ (don.goi_y_phoi_luc), chỉ trong cửa sổ 24 giờ.
- Sửa lỗi đang có: themMon, botMon, doiPhanLoai trên đơn Đã xác nhận hiện KHÔNG đưa đơn về Chờ xác nhận. Vì vậy AI (cap_nhat_don 'them') có thể đổi tổng tiền mà khách không xác nhận lại.
  - Mới: đổi món do khách, AI hoặc gộp đơn thì đơn tự về Chờ xác nhận, có giu_den mới, lịch sử ghi 'sửa món sau xác nhận', gửi thẻ mới.
  - Người sửa tay trên màn hình Đơn hàng thì giữ nguyên trạng thái.
  - doiTrangThai hiện cấm da_xac_nhan → cho_xac_nhan với nguồn he_thong: mở riêng cho đường này, có ghi lý do.
- Gộp giữa hai buổi: người chốt ở buổi mới mà còn đơn mở chưa gửi (Chờ hoặc Đã xác nhận, ở buổi khác hoặc từ tin nhắn).
  - Vẫn giữ hàng vào đơn mới ngay, để không mất món.
  - Ở lần tương tác đầu của khách, mã gửi thẻ 'Chị còn đơn DH-0038 chưa gửi (Áo 7 Trắng/L). Gộp chung để ship một lần?' [🔗 Gộp] [Tách riêng], trước thẻ xin thông tin.
  - Gộp chạy trong MỘT giao dịch: chuyển dòng hàng sang đơn cũ, giữ đơn giá; đơn mới Đã hủy, lý do 'đã gộp vào DH-0038', không trả hàng vì không còn dòng; đơn cũ tính lại ship, về Chờ xác nhận nếu đang Đã xác nhận, gửi thẻ đơn mới (đơn cũ thường đã đủ thông tin nên khách chỉ cần một chạm).
  - Tách, hoặc khách không bấm: giữ 2 đơn. Chỉ hỏi một lần (don.hoi_gop_luc).
- Mức miễn ship công khai:
  - Sổ tay hiện một dòng tự sinh, chỉ đọc, lấy từ Cài đặt. Không tạo nguồn thứ hai (giữ luật F-05).
  - Nút 'Chép câu cho phần Giới thiệu Page'.

**Tiêu chí:**
- [ ] Miễn ship từ 200.000đ, áo 159.000đ, ship 10.000đ: thẻ có 'Thêm 41.000đ nữa là miễn ship'. Đạt mức thì không có dòng; mức miễn ship trống thì không có dòng (test bảng số)
- [ ] Món phối hết hàng hoặc Ngừng bán thì không được gợi ý; gợi ý lần 2 trong 24 giờ thì không có trả lời nhanh
- [ ] Bấm phối rồi chọn phân loại: đơn thêm dòng, ship tính lại (có thể về 0đ), có thẻ mới; bấm trên thẻ cũ không xác nhận nhầm
- [ ] Đơn Đã xác nhận bị thêm, bớt hoặc đổi món qua AI, nút hay gộp: về Chờ xác nhận và có thẻ mới; người sửa tay thì giữ Đã xác nhận
- [ ] Gộp: 2 đơn ở 2 phiên, bấm Gộp thì còn 1 đơn đủ dòng; còn bán được không đổi; kho.doiChieu() rỗng; đơn mới Đã hủy với lý do gộp. Bấm Tách hoặc không bấm: 2 đơn
- [ ] Payload GOP_DON với đơn của người khác thì bị từ chối
- [ ] Sổ tay hiện dòng miễn ship đúng số trong Cài đặt, không sửa được ở Sổ tay

**Tệp sửa:** `server/nghiep-vu/the-don.js (dòng miễn ship, trả lời nhanh phối)`, `server/nghiep-vu/don.js (tienConThieuMienShip, monPhoiGoiY, gopDon trong giao dịch, về Chờ xác nhận khi sửa món)`, `server/chot-don.js (tìm đơn mở khác của cùng người hoặc hồ sơ)`, `server/hop-thu.js (GOP_DON, TACH_DON, THEM_PHOI, CHON_PL)`, `server/gui-the-don.js`, `server/agent/cong-cu/don.js (thông báo mới khi đơn về Chờ xác nhận)`, `public/js/man-hinh/so-tay.js`, `public/js/man-hinh/don.js (hiện 'đã gộp từ / vào', cảnh báo đơn về Chờ xác nhận sau khi đã in phiếu)`, `server/cau-hinh/tin-he-thong.json`, `server/db/nang-cap/0xx-khep-kin-don.sql`, `test/gop-don.test.js (mới)`, `test/don.test.js`

**Dữ liệu:** Thêm cột (nâng cấp '0xx-khep-kin-don.sql'):
- don.hoi_gop_luc TEXT: chỉ hỏi gộp một lần;
- don.goi_y_phoi_luc TEXT: luật 1 lần trong 24 giờ;
- don.gop_vao TEXT: đơn bị gộp trỏ tới đơn nhận, để truy ngược (mục tiêu 4 SPEC).
Không đổi CHECK trạng thái.

**Cấu hình, câu mẫu, Skill, Hook:** tin-he-thong.json: hỏi gộp, gợi ý phối, dòng miễn ship; câu cho phần Giới thiệu Page. Không thêm ô, vì mức miễn ship đã có trong Cài đặt.

**Giả lập Facebook:** Kịch bản live giả 2 buổi liên tiếp, cùng tên người xem (cùng nguoi_id): buổi 2 chốt, rồi khách giả bấm Gộp / Tách. Kịch bản khách giả bấm món phối. Dùng trả lời nhanh của phần nền.

**Test:**
- test/gop-don.test.js (mới): tiêu chí 1–6, có ca giữ song song trong lúc gộp
- test/don.test.js: về Chờ xác nhận khi sửa món sau xác nhận; doiChieu sau chuỗi gộp và tách ngẫu nhiên
- test/the-don.test.js: dòng miễn ship ≤ 640 ký tự khi đơn nhiều món

**Claude Code làm thay:** Soạn câu mẫu và câu cho phần Giới thiệu Page. Soạn dữ liệu phoi_cung mẫu cho bản xem thử và kịch bản 2 buổi. Tự kiểm số tiền bằng test bảng thay cho AI chấm.

**Thử AI thật:** không

**Phụ thuộc:** Nền BH7, Messenger một chạm (trả lời nhanh), thẻ đơn mới của tính năng Chuyển khoản. Bắt buộc có P06 (mốc trước): đơn đủ SĐT và địa chỉ mà hết giờ giữ thì vào 'Gọi xác nhận', không tự hủy. Thiếu P06 thì đơn gộp bị huyQuaGio hủy CẢ những món khách đã xác nhận. Thêm P22 (tương tác đầu), P24a (giờ giữ), tính năng Khách quen (size quen, không bắt buộc).

**Rủi ro:** - Dễ bị coi là chèo kéo: chỉ 1 lần trong 24 giờ, không đưa vào Utility.
- Gộp nhầm đơn mua hộ giao nơi khác: luôn hỏi, mặc định tách.
- Đơn đã in phiếu mà về Chờ xác nhận: cảnh báo đỏ ở màn hình Đơn hàng.
- Đổi chiều trạng thái (về Chờ xác nhận) đụng bảng chuyển trạng thái mục 7: sửa đặc tả trước.

**Mặc định tự chọn:** - Món phối: ưu tiên món có giá ≥ phần còn thiếu, không có thì món đầu còn hàng.
- Tối đa 12 phân loại trong trả lời nhanh.
- Không bấm Gộp / Tách thì coi như tách.
- Người sửa tay không bị tự đổi trạng thái.
- Đơn gộp giữ đơn giá gốc của từng dòng, kể cả giá live.

### Nhận ra khách quen và size quen (nhãn chỉ người dẫn thấy); số đo lưu khi khách đồng ý

*Đề xuất: P20 · công sức: vua*

- Hàm mới khach.tomTatMua(khachId), chỉ dùng lịch sử ĐƠN (không đọc bình luận, không đọc bộ nhớ chữ):
  - số đơn Đã giao không hoàn;
  - size quen theo danh mục: giá trị nhóm 2 xuất hiện nhiều nhất trong dòng đơn Đã giao không hoàn, ví dụ Áo sơ mi: M, Quần jean: 28;
  - ngày mua gần nhất.
- Nhãn chỉ người dẫn thấy: 'khách quen · hay mặc M' khi có từ 2 đơn đã giao; 'đã mua 1 lần · M' khi có 1.
  - Hiện ở Màn hình người dẫn (danh sách bình luận, dòng Vừa chốt qua sự kiện live.chot), Hộp thư, màn hình Khách hàng.
  - Không vào Thanh chữ, Màn hình sản phẩm, dữ liệu đưa miệng, Đội AI, Co-host, Director.
- Chỉ nối được khi người bình luận đã từng được nhắn riêng thành công. Lúc đó nguoi_fb đã có psid (ganPsid) và damBaoHoiThoai tự lấy khach_id. Người bình luận lần đầu thì không có nhãn.
- Chốt thiếu size (thẻ hỏi phân loại của P22): nếu size quen cùng danh mục có ở sản phẩm và còn hàng thì nút đầu là [Lấy M như lần trước]. Khách bấm mới giữ hàng.
- Không lộ việc mua trên sóng hay nơi công khai: Bộ kiểm tra thêm cụm cấm ở kênh 'song' và 'binh_luan': 'khách quen', 'quay lại rồi', 'lần trước (chị|anh|em) mua', 'mua lần thứ'. Đưa vào danh sách từ cấm K11 nếu mốc trước đã có, không thì thêm vào K6.
- Số đo (TẮT mặc định; bật ở Cài đặt → Bán hàng 'Hỏi khách lưu chiều cao, cân nặng' sau khi luật sư trả lời):
  - Khi khách đã có hồ sơ nói đủ chiều cao và cân nặng trong Messenger (mã nhận bằng soTrongLoiKhach) và chưa từng được hỏi, thì SAU lượt trả lời của Tư vấn viên, MOZA gửi 1 tin mã soạn: 'Shop lưu chiều cao, cân nặng của chị để lần sau tư vấn size nhanh hơn được không ạ?' [Lưu giúp mình] [Không cần].
  - Chỉ lưu khi khách bấm Lưu.
  - Xóa bằng 3 cách: khách nhắn 'xóa số đo' (hook phan-loai-tin nhận bằng mã, xóa ngay, báo lại); menu Xóa dữ liệu; nút [Xóa số đo] ở màn hình Khách hàng.
  - Tư vấn viên thấy dòng 'Số đo khách cho lưu: 158 cm, 50 kg (ngày)'. Ngoại lệ K3 mở rộng sang số đo đã lưu, trong cauRaNgoai của cong-cu/hop-thu.js. Không bao giờ nói trên sóng.

**Tiêu chí:**
- [ ] Khách có 3 đơn áo Đã giao (M, M, L) và 1 đơn Hoàn (S): size quen áo là M; chưa từng mua quần thì không có gợi ý size quần
- [ ] Người bình luận chưa có psid: không nhãn, không nút
- [ ] 'chốt 12 đen', khách quen M và M còn hàng: thẻ có [Lấy M như lần trước]; bấm thì giữ Đen/M; M hết thì không có nút
- [ ] Câu Co-host 'Lan là khách quen của shop' bị Bộ kiểm tra chặn ở kênh song; cùng câu trong Messenger thì không chặn
- [ ] Dữ liệu gửi miệng, Director, Đội AI không có chữ 'khách quen' (test ngữ cảnh)
- [ ] Số đo: công tắc tắt thì không hỏi; bật thì hỏi đúng 1 lần; bấm Lưu thì lưu; 'xóa số đo' thì xóa và có tin báo; 'Xóa dữ liệu người này' (F-54) xóa cả số đo

**Tệp sửa:** `server/nghiep-vu/khach.js (tomTatMua, luuSoDo, xoaSoDo, xoaDuLieu xóa cột mới)`, `server/chot-don.js (live.chot kèm nhãn; nút size quen)`, `server/nghiep-vu/live.js (nhãn theo người trong phiên, bộ nhớ đệm theo phiên)`, `server/hop-thu.js (hỏi lưu số đo sau lượt AI; LUU_SO_DO)`, `server/agent/hook/phan-loai-tin.js (nhận 'xóa số đo')`, `server/agent/agents/tu-van.js (dòng số đo)`, `server/agent/cong-cu/hop-thu.js (soKhachNoi thêm số đo đã lưu)`, `server/agent/kiem-tra/kiem-tra.js (cụm cấm)`, `server/nghiep-vu/cai-dat.js (ban_hang.hoi_so_do)`, `server/api (khách: DELETE /khach/:id/so-do)`, `public/js/man-hinh/nguoi-dan.js`, `public/js/man-hinh/hop-thu.js`, `public/js/man-hinh/khach.js`, `public/js/man-hinh/cai-dat.js`, `server/db/nang-cap/0xx-khep-kin-don.sql`, `test/khach-quen.test.js (mới)`

**Dữ liệu:** Cột mới trong bảng khach: chieu_cao_cm INTEGER, can_nang_kg INTEGER, so_do_luc TEXT, so_do_hoi_luc TEXT. Không dùng bo_nho, vì bo_nho.loai có CHECK 3 giá trị, muốn thêm phải dựng lại bảng (phiếu soi kỹ thuật). Size quen tính lúc hỏi, không lưu.

**Cấu hình, câu mẫu, Skill, Hook:** ban_hang.hoi_so_do = false. Danh sách cụm cấm trong tệp cấu hình từ cấm (chung với K11). tin-he-thong.json: hỏi lưu số đo, báo đã lưu, báo đã xóa. Lời dặn Tư vấn viên: dùng số đo đã lưu để tư vấn, không nhắc lịch sử mua trừ khi khách hỏi.

**Giả lập Facebook:** Kịch bản 'khách quen': live giả 1, rồi chốt, rồi nhanRieng trả psid, ganPsid; tua thời gian và giả lập vận chuyển (#87) cho đơn Đã giao; live giả 2 cùng tên, 'chốt 12 đen'. Khách giả kịch bản gõ 'cao 1m58 nặng 50kg' rồi bấm Lưu.

**Test:**
- test/khach-quen.test.js (mới): 6 tiêu chí trên
- test/kiem-tra.test.js: cụm cấm trên sóng
- test/hop-thu.test.js: 'xóa số đo' xử lý bằng mã, không gọi AI

**Claude Code làm thay:** - Claude Code soạn danh sách cụm cấm và dữ liệu lịch sử đơn để test.
- Soạn câu hỏi cho luật sư: số đo có phải dữ liệu sức khỏe / nhạy cảm theo NĐ 356 không; gắn lịch sử vào hồ sơ có bị coi là 'dữ liệu hành vi' không.
- Tự chụp Màn hình người dẫn để kiểm nhãn không ra Thanh chữ.

**Thử AI thật:** Gộp vào lượt thử của tính năng Chuyển khoản: 1 tình huống khách có số đo đã lưu hỏi size, khoảng 5 lượt gpt-6-luna, dưới 0,01 USD. Không tốn Google.

**Phụ thuộc:** P22 (thẻ hỏi phân loại khi thiếu size), ganPsid có sẵn, Messenger một chạm (hồ sơ nối theo số), K11 (P34) nếu mốc trước đã làm, luật sư (số đo).

**Rủi ro:** - Pháp lý số đo: tắt mặc định, chỉ lưu khi khách đồng ý, có nút xóa.
- Nhãn lộ ra nếu người dẫn đưa Màn hình người dẫn lên OBS: ghi cảnh báo trong hướng dẫn OBS.
- Size quen sai khi khách mua hộ: chỉ là gợi ý, khách bấm mới giữ.

**Mặc định tự chọn:** - 'Khách quen' = từ 2 đơn Đã giao không hoàn.
- Size quen tính theo danh mục.
- Số đo tắt mặc định tới khi luật sư trả lời (khác P18: đây là mở rộng dữ liệu cá nhân duy nhất của BH7).
- Hỏi lưu số đo tối đa 1 lần cho mỗi khách.

### Danh sách chờ khi hết hàng (P24 bước 2)

*Đề xuất: P24 · công sức: vua*

- Thẻ hết hàng (P22) có nút [🙋 Vẫn chờ]. Bắt buộc bấm: không bấm thì không vào danh sách, vì cửa sổ 24 giờ không mở.
- Bấm thì MOZA thêm vào bảng cho_hang theo phân loại và nhắn bằng mã: 'Chị đứng số {n} trong danh sách chờ Áo 12 Đen/M. Có suất shop nhắn ngay, trong 24 giờ.' Kèm luật: suất chỉ trả về khi người giữ trước bấm Không lấy hoặc hết giờ giữ ghi trên thẻ của họ.
- Nhường suất theo đúng luật đã ghi trên thẻ người giữ trước (P24a); không bao giờ cắt suất của đơn đang giữ.
  - Khi hàng được trả (đơn hủy, bớt hoặc đổi món, nhập kho, nhận hàng hoàn), cho_hang.nhuongSuatTrong(db, phanLoaiIds) chạy TRONG CÙNG giao dịch. Nó tạo đơn Chờ xác nhận cho người chờ đầu tiên (theo giờ bấm) còn trong 24 giờ, giữ 30 phút, để bình luận chốt mới không lấy mất suất.
  - Sau khi ghi xong, MOZA gửi thẻ mời: 'Có suất Áo 12 Đen/M cho chị, shop giữ tới HH:MM' [Giữ, lên đơn] [Không lấy]. Bấm Giữ thì lên mức giữ đủ (P24a).
  - Hết 30 phút không bấm thì huyQuaGio hủy và nhường người kế tiếp.
  - Quét thêm mỗi phút cùng nhịp tự hủy trong dich-vu.js, làm lưới an toàn.
- Quá 24 giờ kể từ lúc bấm thì trạng thái het_han, không nhắn.
- Màn hình người dẫn hiện 'Chờ hàng: Áo 12 Đen/M · 3 người'. Màn hình Đơn hàng có mục nhỏ 'Danh sách chờ', người hủy tay được.
- Buổi tập 'Kết thúc & trả hàng về kho' (#87) xóa danh sách chờ diễn tập.

**Tiêu chí:**
- [ ] Còn 1 chiếc: A giữ; B rồi C bấm Vẫn chờ thì B số 1, C số 2. A bấm Không lấy thì trong cùng giao dịch có đơn cho B giữ đúng 1 chiếc, và B nhận thẻ mời
- [ ] B không bấm quá 30 phút (đồng hồ giả) thì đơn B tự hủy và C được mời
- [ ] D không bấm Vẫn chờ thì không có trong danh sách, không nhận tin
- [ ] Người chờ quá 24 giờ thì het_han, không có tin
- [ ] Nhập thêm 2 chiếc thì 2 người chờ đầu được mời
- [ ] Người chờ nhận suất cùng lúc với một bình luận chốt mới: chỉ một bên giữ được; không bán quá; kho.doiChieu() rỗng (test song song)
- [ ] Trả kho buổi tập thì danh sách chờ diễn tập trống

**Tệp sửa:** `server/nghiep-vu/cho-hang.js (mới, có SQL)`, `server/nghiep-vu/don.js (gọi nhuongSuatTrong khi hủy, bớt, đổi)`, `server/nghiep-vu/kho.js (gọi khi nhập, điều chỉnh tăng)`, `server/nghiep-vu/don.js nhanHoan`, `server/hop-thu.js (VAN_CHO)`, `server/chot-don.js (hết hàng: gắn nút Vẫn chờ vào thẻ P22)`, `server/dich-vu.js (quét mỗi phút)`, `server/nghiep-vu/dien-tap-ban-hang.js (trả kho xóa chờ)`, `server/api/don.js (GET /cho-hang, DELETE /cho-hang/:id)`, `public/js/man-hinh/nguoi-dan.js`, `public/js/man-hinh/don.js`, `server/cau-hinh/tin-he-thong.json`, `server/db/nang-cap/0xx-khep-kin-don.sql`, `test/cho-hang.test.js (mới)`

**Dữ liệu:** Bảng mới cho_hang: id, phan_loai_id, so_luong, nguoi_fb_id, hoi_thoai_id, phien_live_id, binh_luan_id, trang_thai (cho, da_moi, da_nhan, het_han, huy), bam_luc, moi_luc, don_id, dien_tap, tao_luc. Chỉ mục (phan_loai_id, trang_thai, bam_luc). Làm bảng riêng vì không nhét được vào don (CHECK trạng thái) và cần thứ tự hàng đợi.

**Cấu hình, câu mẫu, Skill, Hook:** tin-he-thong.json: đứng số N, mời có suất, hết hạn chờ. Hằng số: 24 giờ, giữ lời mời 30 phút, tối đa 30 người chờ mỗi phân loại. Không thêm ô Cài đặt.

**Giả lập Facebook:** Kịch bản 'cháy size' trong kich-ban-dien-tap.json: 10 người xem giả chốt cùng một phân loại còn 2 chiếc. Khách giả theo kịch bản bấm Vẫn chờ, Không lấy hoặc im. Tua thời gian để thử hết 30 phút và hết 24 giờ.

**Test:**
- test/cho-hang.test.js (mới): 7 tiêu chí trên, có ca giữ song song
- test/don.test.js: doiChieu sau chuỗi hủy, nhường, nhập ngẫu nhiên

**Claude Code làm thay:** Viết kịch bản 'cháy size' và câu mẫu. Tự lái Phòng diễn tập với 3 khách giả. Đọc nhật ký đơn để tự chấm thứ tự nhường suất.

**Thử AI thật:** không

**Phụ thuộc:** P22 (thẻ hết hàng có chỗ cho nút Vẫn chờ); P24a (mức giữ ngắn và đủ); Hook giới hạn liên hệ (tin mời là tin khách đã xin, không tính trần mời chào nhưng vẫn theo 'thôi / dừng' và Page bị hạn chế); nền BH7.

**Rủi ro:** - Người giữ trước phật ý: không cắt suất, chỉ theo luật ghi trên thẻ.
- Tạo đơn trong giao dịch hủy làm don.js dính cho-hang.js: giữ một hàm duy nhất, có test song song.
- Tin 'có hàng' ngoài 24 giờ là tiếp thị, không gửi Utility: quá 24 giờ thì thôi.

**Mặc định tự chọn:** - Thứ tự theo giờ bấm Vẫn chờ.
- Lời mời giữ 30 phút. Lý do: ngắn hơn mức 'hết buổi + N giờ' của P24a để công bằng cho người kế tiếp.
- Tối đa 30 người chờ mỗi phân loại.
- Bản này chỉ nhận người chờ từ bình luận live; Messenger để sau.

### Giá live tới hết buổi cho từng món (6.1 cách B) — TẮT mặc định, bật sau khi luật sư xem

*Đề xuất: P18 · công sức: vua*

- Công tắc Cài đặt → Bán hàng 'Giá live', TẮT mặc định. Bật thì hiện dòng nhắc: 'nhờ luật sư xem trước, dùng thưa, không nói chỉ hôm nay'.
- Khi bật, màn hình Livestream → Chuẩn bị (phiên chờ live) cho mỗi sản phẩm trong kịch bản một ô không bắt buộc 'Giá live'.
  - Chọn từ danh sách [Không] [−5%] [−10%] [−15%], MOZA tính sẵn và làm tròn xuống 1.000đ; hoặc gõ số.
  - Giá live phải > 0 và < giá bán.
  - Khóa khi live bắt đầu (GIA_LIVE_DA_KHOA), để lời hứa 'tới hết buổi' đúng.
  - Nói với Mai: 'đặt giá live áo 12 259k' thì hiện bảng xem trước và nút Làm (công cụ quan_ly dat_gia_live, chỉ khi phiên chờ live).
- Áp giá: bình luận chốt của đúng buổi đó có luc_fb trong khoảng [bat_dau, ket_thuc + độ trễ phát (15 giây)].
  - giuTrong nhận thêm giaLive: don_dong.don_gia = giá live, don_dong.gia_thuong = giá thường lúc đó.
  - Chỉ áp cho phân loại dùng giá chung; phân loại có giá riêng giữ giá riêng.
  - Đơn Messenger, bình luận xem lại, món thêm sau live: giá thường.
  - Đổi size cùng mẫu (doiPhanLoai) giữ giá của dòng cũ.
- Hiển thị:
  - Thanh chữ và Màn hình sản phẩm: 'Giá live 259.000đ · tới hết buổi'.
  - Giá thường chỉ hiện gạch ngang khi bangChungGiaGoc(sp, giá thường) đúng, tức có đơn Đã giao ở đúng giá đó trong 30 ngày qua (P34a); không có thì chỉ hiện giá live.
  - Thẻ đơn và tin xác nhận ghi '(giá live)'.
- Nguồn cho AI:
  - dongThe (san-pham.js) có phienLiveId và phiên đang live thì thêm dòng 'Giá live buổi này: 259.000đ (tới hết buổi)' để K2 trích được. Messenger không có dòng này.
  - Đội AI: câu mẫu gia_live do máy điền {mon}, {gia}.
  - Miệng: công cụ xem_san_pham trả dòng giá live; lời dặn 'giá live chỉ đọc đúng dòng công cụ trả'.
  - Bộ kiểm tra: cấm 'chỉ hôm nay', 'lần cuối', 'duy nhất hôm nay', 'giờ vàng'.
- phien_live_san_pham giữ giá live đã đặt, để báo cáo và đối chiếu khi khách khiếu nại.

**Tiêu chí:**
- [ ] Công tắc tắt: không có ô, đơn luôn giá thường (test)
- [ ] Bật; áo 12 giá 299k, giá live 259k: 'chốt 12 đen M' lúc đang live thì dòng đơn 259.000đ, gia_thuong 299.000đ; bình luận có luc_fb sau ket_thuc + 15 giây thì 299.000đ; bình luận xem lại và đơn Messenger thì 299.000đ
- [ ] Phân loại XXL giá riêng 319k không được giảm; đổi M → L sau live vẫn 259k
- [ ] Đặt giá live khi phiên đang live thì lỗi GIA_LIVE_DA_KHOA
- [ ] Màn hình sản phẩm: chưa có đơn giao ở giá 299k trong 30 ngày thì không có giá gạch; có thì có
- [ ] Co-host 'giá live 259k chỉ hôm nay' bị chặn; 'giá live 259k tới hết buổi' có trích dòng giá live thì đạt; Tư vấn viên nói 'giá live' trong Messenger thì bị chặn K2
- [ ] Tổng tiền đơn trộn giá live và giá thường đúng (test bảng); thẻ đơn có '(giá live)'

**Tệp sửa:** `server/nghiep-vu/cai-dat.js (gia_live_bat)`, `server/nghiep-vu/live.js (datGiaLive, giaLiveTaiLuc, khóa khi dang_live)`, `server/nghiep-vu/don.js (giuTrong có giaLive; doiPhanLoai giữ giá)`, `server/chot-don.js (tính giá khi giữ theo luc_fb)`, `server/nghiep-vu/san-pham.js (dòng giá live theo phiên; bangChungGiaGoc nếu P34a chưa làm)`, `server/man-hinh-san-pham.js (dung: gia_live, gia_goc theo bằng chứng)`, `public/thanh-chu.html`, `public/js/man-hinh-san-pham.js`, `public/js/man-hinh/live.js (ô giá live ở Chuẩn bị)`, `server/nghiep-vu/the-don.js`, `server/agent/kiem-tra/kiem-tra.js (chuNguon có dòng giá live; cụm cấm)`, `server/cau-hinh/doi-ai-cau-mau.json (gia_live)`, `server/agent/cong-cu/quan-ly.js (dat_gia_live)`, `server/agent/mieng (xem_san_pham trả dòng giá live)`, `server/api/live.js (PUT /live/phien/:id/gia-live)`, `server/db/nang-cap/0xx-khep-kin-don.sql`, `test/gia-live.test.js (mới)`

**Dữ liệu:** Cột mới:
- phien_live_san_pham.gia_live INTEGER, NULL = không có. Gắn với đúng buổi, không sửa bảng sản phẩm.
- don_dong.gia_thuong INTEGER, NULL = không phải giá live. Để thẻ, báo cáo và khiếu nại biết dòng nào hưởng giá live.

**Cấu hình, câu mẫu, Skill, Hook:** - ban_hang.gia_live_bat = false.
- Câu mẫu Đội AI gia_live; lời dặn miệng.
- Skill 'Giá, phí ship, thanh toán' thêm luật giá live (ghi bản cũ vào skill-mau-cu.json).
- Cụm cấm khi nói giá live.
- Câu cho câu ghim (P07): 'Giá live áp cho bình luận chốt gửi trong lúc live'.

**Giả lập Facebook:** gia.js themBinhLuan nhận 'luc' tùy chọn để thử mốc ket_thuc + 15 giây. Live giả kết thúc rồi có bình luận muộn. Không cần gì thêm.

**Test:**
- test/gia-live.test.js (mới): 7 tiêu chí trên
- test/kiem-tra.test.js: dòng giá live chỉ là nguồn khi có phiên đang live; cụm cấm
- test/man-hinh-san-pham.test.js: giá gạch theo bằng chứng

**Claude Code làm thay:** - Viết quy tắc gợi ý 3 mức bằng mã, thay cho gọi AI gợi ý (0đ).
- Soạn câu mẫu Đội AI, câu cho câu ghim, danh sách cụm cấm.
- Soạn câu hỏi luật sư: NĐ 128/2024, NĐ 239/2026, Luật Thương mại Điều 97 (phải công bố gì, mức giảm tối đa, 'giá thường' chứng minh thế nào).

**Thử AI thật:** không. Không chạy miệng Live thật ở mốc này vì tốn tiền; rủi ro miệng tự nói số ghi ở mục 13.

**Phụ thuộc:** P34a (bangChungGiaGoc, mốc trước; chưa có thì làm ở đây); P07 (câu ghim); K11 (P34); tính năng 'Bán sau live' dùng luật 'người xem lại không hưởng'; luật sư trả lời trước khi bật.

**Rủi ro:** - Pháp lý khuyến mại: tắt mặc định, cần mở lại mục 'Ngoài phạm vi' ở SPEC (dòng 'khuyến mại, flash sale').
- Lỗi tính giá là mất tiền thật: test bảng, giá chụp lúc giữ.
- Tranh cãi chốt phút chót: ân hạn bằng độ trễ phát, luật ghi ở câu ghim.
- Miệng Live không qua Bộ kiểm tra: chỉ công cụ trả giá live, có lời dặn.
- Làm giá live mọi buổi khiến 'giá thường' thành giá ảo: nhắc 'dùng thưa'; giá gạch cần bằng chứng.

**Mặc định tự chọn:** - Gợi ý 3 mức (−5, −10, −15%) làm tròn xuống 1.000đ bằng mã, không gọi AI. Đây là cách làm 'AI gợi ý mức' của 6.1 với 0đ; báo chủ dự án.
- Khóa khi live bắt đầu.
- Ân hạn = độ trễ phát trong Cài đặt (15 giây).
- Không giảm phân loại có giá riêng.
- Giữ giá live khi đổi size cùng mẫu.

### Bán sau live: nhận bình luận chốt trên video xem lại tới 7 ngày và đăng bình luận mục lục

*Đề xuất: P03 · công sức: vua*

- Nhận bình luận xem lại theo 2 đường:
  - (a) Webhook feed: server/hop-thu.js:83 hiện bỏ mọi bình luận bài live TRƯỚC khi lưu. Đổi thành: phiên đang live thì phòng live xử lý như cũ; phiên đã xong chưa quá 7 ngày thì chuyển sang bộ nhận xem lại (file mới server/xem-lai.js).
  - (b) MOZA tự hỏi docBinhLuanVideo của mọi phiên thật đã xong trong 7 ngày, lúc khởi động và mỗi 10 phút, theo con trỏ phien_live.xem_lai_con_tro.
  Chống trùng theo fb_id (binh_luan_live.fb_id UNIQUE).
- laBaiLive so thêm fb_video_id nếu mốc trước đã lưu. Phiếu soi kỹ thuật nghi post_id của webhook mang id Video khác id LiveVideo; nếu đúng, bình luận TRONG live có thể đang bị Hộp thư xử lý trùng.
- Xử lý bình luận xem lại:
  - Lưu vào binh_luan_live của phiên gốc.
  - Không đoán món theo giờ: bình luận xem lại gần như chắc không có live_broadcast_timestamp; sanPhamTaiLuc tính theo giờ thật sẽ sai.
  - Chỉ nhận chốt có số món. Có chữ mua mà thiếu số thì gửi thẻ hỏi món (lưới ảnh các món của buổi, P22), chưa giữ hàng.
  - Không phải chốt thì đưa vào Hộp thư như bình luận bài đăng; Tư vấn viên xử lý như F-31.
- ChotDon.xuLy thêm chế độ xem lại:
  - không đọc tên trên sóng, không phát live.chot lên Màn hình người dẫn;
  - giá thường; thẻ ghi 'giá hiện tại'. Buổi đó có giá live cho món này thì thẻ ghi 'Giá live đã kết thúc lúc 21:30 ngày 26/9';
  - người đã có đơn mở của buổi đó thì gộp vào đơn đó (donMoTrongPhien);
  - đơn nguồn binh_luan_live, phien_live_id là phiên gốc.
- Quá 7 ngày: không nhắn riêng (Meta cấm), bỏ qua.
- Bình luận mục lục: 2 phút sau khi live thật kết thúc, MOZA đăng 1 bình luận của Page lên video (dangBinhLuan; quyền pages_manage_engagement đã có trong QUYEN_CAN).
  - Mẫu: '📌 Mục lục: 02:15 Áo 12 · Sơ mi linen | 08:40 Váy 15 · … Chốt: bình luận "chốt 12 đen M", trợ lý AI của shop nhắn riêng, nhận tới 7 ngày.'
  - Phút = dong_thoi_gian_san_pham.tu_luc trừ giờ bắt đầu do Facebook trả về. Chưa có giờ này thì không đăng và báo.
  - Không ghi giá, không ghi tên khách.
  - Công tắc 'Tự đăng mục lục sau live' (bật). 'Dừng mọi thứ' chặn. Đăng một lần (phien_live.muc_luc_luc, muc_luc_fb_id). Báo cáo có nút 'Đăng lại'.
- Báo cáo buổi live thêm dòng 'Chốt sau live: N đơn'.

**Tiêu chí:**
- [ ] Phiên thật xong 2 ngày; Facebook giả có 'chốt 12 đen M' gửi sau giờ kết thúc: lượt quét tạo đơn giá thường, nhắn riêng đúng 1 thẻ, không có sự kiện đọc tên
- [ ] Cùng bình luận về qua webhook và qua quét: 1 đơn, 1 tin
- [ ] 'chốt đen M' (không số): thẻ hỏi món, không giữ hàng
- [ ] Bình luận 8 ngày tuổi: không xử lý
- [ ] Người đã có đơn mở của buổi đó: món gộp vào đơn đó
- [ ] Buổi có giá live cho món: thẻ có dòng 'giá live đã kết thúc lúc …' và đơn tính giá thường
- [ ] Bình luận TRONG lúc live với post_id dạng '{page}_{videoId}': Hộp thư bỏ qua (test mô phỏng lệch id)
- [ ] Mục lục đăng đúng 1 lần, phút đúng theo dòng thời gian giả, không có giá, không có tên khách; công tắc tắt thì không đăng; 'Dừng mọi thứ' thì không đăng
- [ ] Phiên tập chưa trả kho vẫn thử được; sau khi trả kho (#87) thì không tạo đơn

**Tệp sửa:** `server/xem-lai.js (mới: quét và định tuyến vào ChotDon)`, `server/hop-thu.js (nhan: định tuyến bình luận bài live)`, `server/nghiep-vu/hop-thu.js (laBaiLive so fb_video_id)`, `server/chot-don.js (chế độ xem lại)`, `server/nghiep-vu/live.js (phiên xong trong 7 ngày, con trỏ, dữ liệu mục lục)`, `server/dich-vu.js (nhịp 10 phút, chạy lúc khởi động)`, `server/phong-live.js (ketThuc hẹn đăng mục lục)`, `server/facebook/that.js, gia.js (docBinhLuanVideo, dangBinhLuan)`, `server/nghiep-vu/bao-cao.js`, `server/api/live.js (POST /live/phien/:id/muc-luc)`, `public/js/man-hinh/bao-cao.js`, `public/js/man-hinh/cai-dat-facebook.js`, `public/js/man-hinh/live.js (ô bình luận xem lại giả)`, `server/cau-hinh/tin-he-thong.json`, `server/db/nang-cap/0xx-khep-kin-don.sql`, `test/xem-lai.test.js (mới)`

**Dữ liệu:** - Cột mới trong phien_live: xem_lai_con_tro TEXT, muc_luc_luc TEXT, muc_luc_fb_id TEXT.
- Nếu mốc trước chưa làm việc nền 'lưu giờ bắt đầu live do Facebook trả về', thêm ở đây phien_live.fb_video_id và phien_live.bat_dau_fb. that.js timLiveDangPhat đã có creation_time nhưng live.ganLive bỏ đi; cần thêm video{id}.

**Cấu hình, câu mẫu, Skill, Hook:** Khóa cai_dat 'fb_tu_dang_muc_luc' = true, là công tắc ở Cài đặt → Facebook. Mẫu mục lục trong tin-he-thong.json. Chu kỳ 10 phút và hạn 7 ngày là hằng số.

**Giả lập Facebook:** gia.js:
- giữ live đã tắt (videoCu) cùng bình luận của nó;
- themBinhLuanXemLai; docBinhLuanVideo;
- phát sự kiện binh_luan_bai với post_id kiểu '{page}_{videoId}' để thử lệch id;
- dangBinhLuan lưu lại để kiểm mục lục.
Phòng diễn tập có ô 'Bình luận xem lại (giả)'.

**Test:**
- test/xem-lai.test.js (mới): 9 tiêu chí trên, dùng đồng hồ giả cho mốc 7 ngày và nhịp 10 phút
- test/hop-thu.test.js: định tuyến dòng 83 mới
- test/chot-don.test.js: chế độ xem lại không đọc tên, giá thường

**Claude Code làm thay:** Claude Code soạn 30 bình luận xem lại mẫu (có số, không số, câu hỏi, quá 7 ngày, trùng) và mẫu câu mục lục. Tự lái Phòng diễn tập. Soạn hướng dẫn cho chủ dự án về 'hoãn xóa video 6 tháng' (dùng chung P08).

**Thử AI thật:** không. Bình luận không phải chốt đi luồng Tư vấn viên có sẵn, test bằng AI giả.

**Phụ thuộc:** - Việc nền mốc trước: lưu giờ bắt đầu và video id từ Facebook; đánh dấu lượt nhắn riêng.
- P22 (thẻ và lưới ảnh).
- Tính năng Giá live (luật không hưởng) và tính năng Gộp đơn.
- Bước 0: dạng post_id của webhook, bình luận xem lại có về webhook không, có live_broadcast_timestamp không, POST bình luận lên video id được không.

**Rủi ro:** - Laptop tắt quá 7 ngày thì mất bình luận.
- post_id lệch cần kiểm trên Page thật.
- Quét 10 phút tốn lượt gọi Graph (có nhịp gọi sẵn).
- Phút trong mục lục có thể lệch nếu giờ Facebook là giờ tạo live chứ không phải giờ phát: kiểm ở Bước 0, lệch thì ghi 'khoảng'.
- Đăng bình luận có thể cần xét duyệt quyền: không được thì chỉ hiện ở Báo cáo để chép.

**Mặc định tự chọn:** - Quét 10 phút và lúc khởi động.
- Chỉ phiên thật, cộng phiên tập chưa trả kho.
- Mục lục không ghi giá, vì bình luận ở lại 30 ngày trong khi giá có thể đổi (Điều 24).
- Tự đăng mục lục bật mặc định (hỏi lại chủ dự án).
- Bình luận xem lại không phải chốt đi Tư vấn viên như bình luận bài đăng.

---

## BH8 — Trước live và sau mua: lịch live, đồng ý nhận tin, hỏi thăm, tổng kết (P09 bước 1, P10 = 6.3 A+B, P31, P32, P26, P27, P25 phần không cần nối hãng, P29 = 6.4 B, P08 bản đơn giản, P28 tắt mặc định). Chỉ là kế hoạch, chưa code.

**Định nghĩa xong:** Mốc xong khi đủ các điều sau:
- `npm test` đạt toàn bộ: các test hiện có (từ 537 trở lên, theo SPEC #90) và khoảng 12 tệp test mới. Mọi tính năng đạt tiêu chí của nó trên Facebook giả với AI giả.
- Claude Code tự lái bản xem thử (preview "moza", cổng 5190, dữ liệu data/xem-thu), đóng vai khách qua khung Messenger giả, và chụp màn hình từng bước:
  - đặt lịch → AI soạn bài → khách hóng dưới bài → bấm "Báo em buổi này" → live giả bắt đầu → nhận tin có link → gõ DỪNG → không nhận gì thêm;
  - đơn khách mới COD 650.000đ → sau 2 giờ nhận "Shop chuẩn bị gửi" → bấm Gửi đi;
  - đơn Đã gửi → tua 96 giờ → nhận "Mặc thấy sao" → bấm Hơi chật → có việc đổi size;
  - xuất file theo hãng;
  - Tổng kết buổi tập có phễu, 3 gợi ý (AI giả) và mốc từng món;
  - Tổng quan hiện 8 mục thông tin shop;
  - bật thử công tắc ảnh khách trên dữ liệu xem thử để duyệt và gỡ ảnh.
- Thử AI thật trong ngân sách (OpenAI khoảng 0,05 USD, Google 0), ghi chi phí.
- SPEC.md lên 3.4:
  - mục 2: quyết định mới từ #91;
  - mục 3: F-xx từ F-65;
  - mục 7: bảng dong_y_nhan_tin, anh_khach; cột mới của don, nguoi_fb, phien_live; agent soan_bai, tong_ket;
  - mục 8 (màn hình, API), A.6 (dat_ban_hang, ghi_so_tay), A.7 (Skill và lời dặn mới);
  - mục 11 (test), mục 12 (dòng BH8, kết quả, việc chủ dự án), mục 13 (rủi ro);
  - ngày tra tài liệu ở mục 6.
- Commit và tag `bh8-truoc-sau-live`, rồi dừng chờ chủ dự án duyệt. Kèm danh sách việc chủ dự án làm: chọn lịch live, chọn hãng vận chuyển, bấm "Tạo bộ mẫu tin" sau Bước 0, đưa luật sư câu xin đồng ý, giấy đồng ý dùng ảnh và chính sách quyền riêng tư, bật P28 sau khi luật sư đồng ý.

**Thứ tự:**
- 1. Đầu mốc: tra lại tài liệu mới nhất (Meta: Utility template có nút, nhắn riêng có nút, trường permalink_url và video của LiveVideo, quyền page_utility_messaging; mẫu nhập đơn của 4 hãng; giá gpt-6-luna và có model mới rẻ hơn không) và ghi ngày vào SPEC mục 6. Đọc mã BH5 để dùng lại phần nền, không viết trùng.
- 2. Nền dùng chung: câu mẫu, bộ đọc nút, choGui, tệp nâng cấp chung, Facebook giả, khách giả kịch bản, tua 168 giờ. Làm trước vì mọi tính năng sau đều dùng.
- 3. Điền thông tin shop (P31). Nhỏ, và các phần sau cần nó: chính sách đổi trong Sổ tay cho P27, xưng hô cho mọi câu mẫu, thông tin người bán cho mẫu tin.
- 4. Lịch live và bài báo trước (P09). Lịch là gốc của báo live, của chú thích P08 và của dòng lịch cho Tư vấn viên.
- 5. Báo live cho người đã đồng ý (P10), rồi quyền của khách: DỪNG và Xóa dữ liệu. Làm DỪNG liền sau vì mọi tin chủ động phía sau phải tôn trọng DỪNG.
- 6. Bộ mẫu tin Utility (P25). Khung mẫu có nút mà P26 và P27 cần.
- 7. Hỏi lại đơn trước khi gửi (P26), rồi hỏi thăm sau gửi (P27).
- 8. Xuất file theo hãng (P29). Độc lập, làm sau khi Claude Code tra xong mẫu; chưa biết hãng thì vẫn làm khung và 4 mẫu.
- 9. Tổng kết sau live (P32), rồi mốc từng món (P08). Cần dữ liệu của các phần trên và cột fb_bat_dau.
- 10. Khách mặc thật (P28) làm cuối, tắt mặc định. Phụ thuộc P27 và luật sư.
- 11. Thử AI thật gom một lượt (P31: 3 câu, P09: 2 bộ bài, P32: 2 lần), báo chi phí trước khi chạy. Claude Code lái bản xem thử đóng vai khách qua trọn các luồng và chụp màn hình. Chạy npm test, ghi SPEC, commit và tag, rồi dừng chờ duyệt.

**Chi phí thử thật:** OpenAI khoảng 0,05 USD cho cả mốc:
- P31: 3 câu bằng gpt-6-sol, khoảng 0,04 USD. Nếu tạm dùng gpt-6-luna thì khoảng 0,003 USD.
- P09: 2 bộ bài bằng gpt-6-luna, khoảng 0,003 USD.
- P32: 2 lần gợi ý bằng gpt-6-luna, khoảng 0,002 USD.

Mức này nằm trong ngân sách dưới 1 USD của cả đợt và còn dư cho các mốc khác.

Google: 0 USD. Không gọi Gemini; nói bằng giọng trong "Nói với Mai" dùng bộ nhận giọng miễn phí của trình duyệt.

Anthropic: 0 USD.

Mọi phép thử còn lại dùng AI giả, Facebook giả và khách giả theo kịch bản, do Claude Code tự chấm. Báo chủ dự án chi phí trước khi chạy lượt thử thật.

**Ghi chú khi đọc mã:** PHÁT HIỆN KHI ĐỌC MÃ (đã kiểm bằng Read/Grep):
1. live.ganLive ghi bat_dau = gio(), tức giờ MOZA phát hiện ra live, lệch 10–30 giây. Trong khi đó phong-live.js gan() đã có liveFb.bat_dau (creation_time từ that.js timLiveDangPhat) mà không dùng. P08 phụ thuộc chỗ này.
2. that.js: taoMauUtility chỉ có khối BODY, không có nút; guiUtility không gửi nút; chú thích còn ghi "Meta duyệt khoảng 24 giờ" (đã cũ). facebook/ket-noi.js QUYEN_CAN (dòng 27) thiếu page_utility_messaging.
3. the-don.docPayload chỉ hiểu XAC_NHAN_DON và SUA_DON, cần bộ đọc nút chung.
4. hop-thu.js nhacDon, nhánh "bao" (báo đã gửi trong 24 giờ), đang gọi Tư vấn viên (AI). P25 đổi sang câu mẫu nên đỡ một lượt AI mỗi đơn.
5. gui-the-don.js gửi thẳng fb.guiThe / guiTinNhan, không đi qua hook truoc_cong_cu. Vì vậy giới hạn liên hệ phải là hàm nghiệp vụ, gọi được từ cả hai đường.
6. dien-tap-ban-hang.tuaThoiGian chỉ cho tua 1–72 giờ, không tới được hỏi thăm sau 4 ngày.
7. khach.xoaDuLieu chỉ xóa được người đã có hồ sơ khách; người chỉ có nguoi_fb không có đường xóa theo yêu cầu.
8. cai-dat.datBanHang ghi lại mọi khóa, nên không phân biệt được mặc định với giá trị người đặt. Cần khóa da_dat.
9. viec.loai không có CHECK trong CSDL (006-hop-thu.sql), chỉ lọc bằng LOAI_VIEC nên thêm loại việc không cần nâng cấp. Mọi cột mới thêm bằng ALTER, không đổi CHECK nên không phải dựng lại bảng.
10. SPEC mục 8 ghi `GET /don/xuat`, còn mã là `/don/xuat.csv`. Sửa SPEC khi ghi BH8.
11. Regex XOA_DU_LIEU trong phan-loai-tin.js đòi đuôi "của tôi/em/mình…", nên câu như "xoá giúp mình thông tin" có thể lọt. BH8 thêm bộ câu mẫu test.

XUNG ĐỘT HOẶC PHỤ THUỘC VỚI MỐC KHÁC:
- BH5 (việc nền Tầng 1): Hook giới hạn liên hệ, bộ đọc nút chung, đánh dấu lượt nhắn riêng, lưu giờ bắt đầu live từ Facebook, thêm quyền Utility, sửa laBaiLive bằng video id. BH8 dùng lại; phần nào BH5 chưa làm thì BH8 làm. Phải đọc mã BH5 trước để không có hai kiểu.
- P06 và P25 cùng sửa nhacDon, cùng dùng khung mẫu Utility. Mốc nào làm trước thì dựng khung "bộ mẫu"; mẫu P06 "đơn đang chờ xác nhận" gộp vào nút "Tạo bộ mẫu tin".
- P22 và P10 cùng cần "nhắn riêng có nút" (nhanRiengThe). P10 chỗ mời a chỉ bật khi đã có fb_video_id, nếu không có thể mời nhầm người bình luận live và dùng mất lượt nhắn riêng duy nhất.
- Dùng chung khóa với mốc khác:
  - P35: cách xưng hô, câu "Có sử dụng trợ lý AI";
  - P21: 3 ô tài khoản ngân hàng, phục vụ mục 5 của P31;
  - P24a: giờ giữ hai mức, phục vụ mục 3 của P31.
- P42 tách "Dừng AI" và "Dừng mọi thứ": tin do máy soạn ở BH8 chạy khi chỉ "Dừng AI", dừng khi "Dừng mọi thứ".
- Các mốc khác dùng lại phần của BH8: P19 dùng payload XOA_DU_LIEU; P03 dùng mocTungMon cho bình luận mục lục; P14 bước 1 dùng hàm đếm người chốt; P14 bước 2 và P20 dùng don.phan_hoi_mac.
- Tệp nâng cấp: nhiều mốc cùng thêm từ 018, nên BH8 chỉ đặt tên gợi ý `0NN-truoc-sau-live.sql` và đánh số lúc code.

QUYẾT ĐỊNH CẦN GHI VÀO SPEC (từ #91), đều theo khuyến nghị đã duyệt:
- 6.3 A+B: đồng ý từng buổi, trong 24 giờ, có DỪNG và xóa dữ liệu. Dòng "Ngoài phạm vi: gửi tin marketing hàng loạt" giữ nguyên.
- 6.4 B: F-60 vẫn để sau. 6.5 A.
- P28 tắt mặc định.
- A.1: thêm ngoại lệ cho quan_ly, được ghi Cài đặt → Bán hàng và Sổ tay nhưng chỉ qua bảng xem trước và nút "Làm", số phải có trong câu người nói.
- F-32: tin trạng thái và tin chăm sóc do máy soạn, không gọi AI; ngoài 24 giờ dùng bộ mẫu Utility, sửa tiếp #21 và #89.
- #73 giữ nguyên; P26 áp cho khách dưới ngưỡng #73.
- DỪNG chặn mọi tin chủ động.

CẦN HỎI CHỦ DỰ ÁN (không chặn việc code; tạm dùng mặc định):
(1) Lịch live cố định mỗi tuần (thứ, giờ)?
(2) Hãng vận chuyển đang dùng? Tạm để "Chung".
(3) Ngưỡng hỏi lại đơn 500.000đ, hỏi thăm sau 4 ngày, hạn xóa dữ liệu 72 giờ: đồng ý không?
(4) Chú thích clip luôn ghi "Có giọng trợ lý AI" khi buổi có giọng AI, được không?
(5) Cho Claude Code viết bộ ghi xlsx tối giản bằng node:zlib, không thêm thư viện, nếu hãng chỉ nhận Excel?

VIỆC CHO LUẬT SƯ (nối mục 9): câu xin đồng ý báo live (NĐ 330/2026, Luật 91/2025 Điều 28), thời hạn xử lý yêu cầu xóa, câu xin phép và giấy đồng ý dùng ảnh khách, việc tự đánh dấu "Nên hỏi lại" đơn, chính sách quyền riêng tư, nhắc về clip Reels.

CHƯA KIỂM CHỨNG, ĐỂ BƯỚC 0 VỚI FACEBOOK THẬT (khác giả lập thì sửa that.js cùng gia.js):
- nhắn riêng có nút tới người bình luận bài thường;
- mẫu Utility có nút postback: cách tạo, loại Meta xếp vào, payload động hay cố định;
- trường permalink_url và video{id} của LiveVideo;
- Utility gửi được cho người chỉ từng bấm nút hay không.

### Nền dùng chung của mốc: câu mẫu tin khách, bộ đọc nút, giới hạn liên hệ, khách giả theo kịch bản

*Đề xuất: P10, P25, P26, P27, P28 · công sức: vua*

- Chỉ làm phần mà mốc nền (BH5, “các việc nền” Tầng 1) chưa làm. Đã có thì dùng lại, không viết lần hai.
- Thêm tệp câu mẫu `server/cau-hinh/cau-mau-khach.json`, cùng kiểu với doi-ai-cau-mau.json: muốn đổi lời thì sửa tệp, không sửa mã. Tệp chứa mọi tin MOZA tự soạn trong mốc này: xin đồng ý báo live, báo đã lên sóng, xác nhận DỪNG, đã nhận yêu cầu xóa, đã xóa, hỏi lại trước khi gửi, hỏi mặc có vừa không, trả lời cho 3 nút, xin phép dùng ảnh, gỡ ảnh, lời mời gửi nhóm Zalo, bài dời buổi, nhắc quảng cáo, câu “Có sử dụng trợ lý AI”. Máy tự điền các chỗ trống {ten} {xung} {ten_shop} {ma} {gio} {link}. Tin đầu tiên gửi người lạ luôn có dòng “Tin tự động từ trợ lý AI của {ten_shop}”. Dùng rất ít chữ “nhé”.
- Bộ đọc nút dùng chung: đổi the-don.docPayload thành một bảng tra, mỗi tiền tố payload trỏ tới một hàm xử lý. HopThuTuDong.xuLyNut tra bảng này để làm đúng việc. Mốc này thêm các tiền tố BAO_LIVE, THOI_BAO_LIVE, GUI_DI, HEN_NGAY, HOI_MAC, ANH_DONG_Y, ANH_KHONG, XOA_DU_LIEU. Hai nút cũ XAC_NHAN_DON và SUA_DON giữ nguyên.
- Hàm giới hạn liên hệ dùng chung (nghiệp vụ, tên gợi ý server/nghiep-vu/lien-he.js, hàm choGui({nguoiFbId, loai, bayGio})). Cả hook hop-thu-gui (công cụ AI) lẫn tin máy tự gửi đều gọi được hàm này. Cần vậy vì gui-the-don.js gửi thẳng fb.guiThe/guiTinNhan, không đi qua hook truoc_cong_cu. Ba loại tin:
  - giao_dich (trạng thái đơn): không tính vào trần mỗi ngày;
  - cham_soc (hỏi lại, hỏi mặc): tối đa 1 tin mỗi ngày;
  - moi_chao (báo live): tối đa 1 tin mỗi ngày, chỉ trong 7h–22h.
  Người đã DỪNG: chặn mọi tin chủ động, việc cần báo cho đơn đang mở chuyển thành việc cho người. Công tắc khanCap chặn tất cả. Nếu BH5 đã tách “Dừng AI” thì tin do máy soạn vẫn chạy khi chỉ bật “Dừng AI”.
- Khóa chống trùng của mọi tin chủ động có tiền tố 'chu_dong:', để hopThu.demTinChuDongHomNay đếm đúng.
- Khách giả theo kịch bản có sẵn lời: server/khach-gia.js thêm lựa chọn `kichBan`, là chuỗi hành động viết sẵn (bấm nút theo tên, gõ câu, gửi ảnh). Chuỗi này thay cho lần gọi gpt-6-luna trong buổi tập của mốc.
- dien-tap-ban-hang.tuaThoiGian: nâng giới hạn tua từ 72 lên 168 giờ, và tua luôn các cột mới của mốc. Hỏi mặc cần tua 96 giờ.

**Tiêu chí:**
- [ ] Mọi câu mẫu trong cau-mau-khach.json điền đủ chỗ trống, không còn ký tự “{”; tin đầu tới người lạ có dòng tự giới thiệu AI (test quét tệp).
- [ ] Nút có payload lạ, hoặc mang id đơn của người khác: không đổi dữ liệu gì, hội thoại chuyển Cần người (test).
- [ ] Người đã DỪNG: choGui chặn cả moi_chao, cham_soc, giao_dich; câu trả lời khi chính khách nhắn vẫn gửi được (test).
- [ ] Hai tin cham_soc cho cùng một người trong một ngày: tin thứ hai lùi sang ngày sau (test đồng hồ giả).
- [ ] Tua 96 giờ chạy được, các cột mới cũng được lùi giờ (test).
- [ ] Buổi tập dùng khách giả kịch bản không tạo lượt agent_run nào của khach_gia (test).

**Tệp sửa:** `server/cau-hinh/cau-mau-khach.json (mới)`, `server/nghiep-vu/lien-he.js (mới, tên gợi ý — dùng tên của BH5 nếu đã có)`, `server/nghiep-vu/the-don.js (docPayload → bảng tra)`, `server/hop-thu.js (xuLyNut)`, `server/agent/hook/hop-thu-gui.js (gọi choGui)`, `server/gui-the-don.js (gọi choGui trước khi gửi)`, `server/khach-gia.js, server/agent/agents/khach-gia.js (kịch bản có sẵn lời)`, `server/nghiep-vu/dien-tap-ban-hang.js (tuaThoiGian 168 giờ + cột mới)`, `server/facebook/gia.js, server/facebook/giao-dien.js (ghi chú hàm tùy chọn)`, `server/db/nang-cap/0NN-truoc-sau-live.sql (mới)`

**Dữ liệu:** Một tệp nâng cấp chung cho cả mốc. Tên gợi ý `0NN-truoc-sau-live.sql`, NN là số kế tiếp sau tệp mới nhất lúc code (từ 018), không sửa tệp cũ. Phần nền: bảng nguoi_fb thêm cột dung_nhan_tin_luc (người đã gõ DỪNG). Không đổi ràng buộc CHECK nào, để khỏi phải dựng lại bảng (theo kiem-8). viec.loai không có CHECK trong CSDL (006-hop-thu.sql), chỉ lọc bằng LOAI_VIEC trong khach.js, nên thêm loại việc không cần nâng cấp.

**Cấu hình, câu mẫu, Skill, Hook:** Thêm tệp cau-mau-khach.json. Không thêm ô Cài đặt nào.

**Giả lập Facebook:** gia.js lưu nút của mọi loại tin Page gửi (thẻ, nhắn riêng có nút, mẫu Utility có nút), để khachBam bấm được. khachBam nhận thêm cách tìm nút theo tên, cho khách giả kịch bản. Không đổi danh sách bắt buộc BAT_BUOC trong giao-dien.js; hàm mới là tùy chọn và có ghi chú.

**Test:**
- test/cau-mau-khach.test.js (mới)
- test/lien-he.test.js (mới)
- test/hop-thu-don.test.js (thêm các nút mới)
- test/dien-tap-ban-hang.test.js (tua 168 giờ, cột mới)

**Claude Code làm thay:** Claude Code viết toàn bộ câu mẫu, mỗi câu 2–3 biến thể cho khỏi lặp, rồi tự đọc lại theo luật “nói tự nhiên, ít chữ nhé”. Claude Code cũng viết sẵn 10 kịch bản khách giả thay cho gpt-6-luna: đồng ý báo live, bấm Thôi, gõ DỪNG, xin xóa dữ liệu, Gửi đi, Hẹn ngày khác, im lặng, Hơi chật, gửi ảnh rồi đồng ý, gửi ảnh rồi gõ “gỡ ảnh”.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc BH5 (việc nền Tầng 1: Hook giới hạn liên hệ, bộ đọc nút chung, đánh dấu lượt nhắn riêng). BH5 làm rồi thì BH8 chỉ thêm loại tin và tiền tố nút.

**Rủi ro:** BH5 và BH8 có thể viết bộ đọc nút hoặc hàm giới hạn liên hệ theo hai kiểu khác nhau. Cách tránh: đầu BH8 đọc lại mã BH5 trước khi viết.

**Mặc định tự chọn:** - moi_chao và cham_soc: 1 tin mỗi ngày mỗi người, theo luật nền đã duyệt.
- Khung giờ moi_chao 7h–22h, theo luật nền.
- giao_dich không tính trần: tin trạng thái đơn là tin khách cần, theo gop.json P25.
- Khi nhiều tin trùng ngày, ưu tiên: giao_dich > hỏi lại (P26) > báo live > hỏi mặc (P27).
- Tua tối đa 168 giờ: đủ cho hỏi mặc sau 4–7 ngày.

### Điền nốt thông tin shop bằng lời; Tổng quan kiểm 8 mục

*Đề xuất: P31 · công sức: nho*

- Tổng quan thêm thẻ “Thông tin shop” và chỉ liệt kê mục còn thiếu trong 8 mục:
  1. Phí ship: ban_hang.phi_ship có số (0 = miễn ship mọi đơn).
  2. Mức miễn ship: có mien_phi_tu, hoặc người đã nói rõ “không miễn ship”.
  3. Giờ giữ hàng: gio_giu do người tự đặt. Nếu BH5 đã thêm mức ngắn của P24a thì kiểm cả mức đó.
  4. Chính sách đổi size: mục Sổ tay “Đổi trả” có nội dung.
  5. Tài khoản nhận tiền: 3 ô ngân hàng của P21 nếu mốc đó đã làm, chưa thì mục Sổ tay “Thanh toán”.
  6. Giờ nghe máy: ban_hang.gio_nghe_may.
  7. Cách xưng hô: ban_hang.xung_ho, dùng chung với P35.
  8. Thông tin người bán: đủ ten_shop, sdt_shop, dia_chi_shop.
  Đủ 8 mục thì thẻ tự ẩn.
- Nút “Điền bằng lời” mở ô Nói với Mai, gợi ý sẵn câu cho mục thiếu đầu tiên.
- Agent quan_ly có thêm 2 công cụ: `dat_ban_hang({dong:[{o, gia_tri}]})` (o là 1 trong các khóa trên) và `ghi_so_tay({muc, cach: 'thay'|'them', noi_dung})`, với muc chọn từ tiêu đề mục Sổ tay đang có. Cả hai mặc định “Hỏi”: bảng xem trước ghi cũ → mới, số tiền in bằng hienTien, ví dụ “Phí ship: (trống) → 10.000đ”. Chỉ ghi khi người bấm “Làm”.
- Luật cứng trong xemTruoc:
  - mọi con số trong gia_tri hay noi_dung phải có trong câu người dùng vừa nói, so bằng quy-doi-so.soKhongCoTrongNguon; không có thì báo lỗi kèm lời “hỏi lại”, không tạo việc chờ duyệt;
  - khóa lạ bị từ chối;
  - không có đường sửa giá sản phẩm hay xóa mục Sổ tay.
- Lời dặn: Mai luôn đọc lại con số trong câu trả lời, phòng nghe nhầm.
- Cài đặt → Bán hàng thêm 2 ô chọn từ danh sách: “Giờ nghe máy” (từ giờ – đến giờ) và “Cách xưng hô” (chị/em · bạn/mình · anh chị/em). Nếu P35 đã thêm ô xưng hô thì dùng lại.

**Tiêu chí:**
- [ ] Dữ liệu trống: Tổng quan báo thiếu 8/8. Điền phí ship còn thiếu 7. Đủ 8 thì thẻ ẩn (test /api/bao-cao/tong-quan).
- [ ] AI giả gọi dat_ban_hang 2 dòng cho câu “phí ship 10 nghìn, đơn trên 200 nghìn thì miễn ship”: bảng xem trước đúng 2 dòng “Phí ship: (trống) → 10.000đ” và “Miễn phí ship từ: (trống) → 200.000đ”; Cài đặt chưa đổi cho tới khi bấm “Làm”.
- [ ] AI giả tự thêm “giờ giữ 12” trong khi câu người dùng không có số 12: xemTruoc báo lỗi, không có việc chờ duyệt.
- [ ] “Shop cho đổi size trong 3 ngày nếu chưa giặt”: ghi_so_tay thêm vào mục “Đổi trả”; bấm “Làm” thì có bản sửa mới trong so_tay_ban_sua; Tư vấn viên trích được câu này và Bộ kiểm tra K2 đạt.
- [ ] Bấm “Bỏ” thì không ghi gì. Khi “Dừng mọi tự động” đang bật vẫn chạy (như F-62).

**Tệp sửa:** `server/agent/cong-cu/quan-ly.js`, `server/agent/agents/quan-ly.js (đưa câu người dùng và danh sách mục thiếu vào ngữ cảnh)`, `server/agent/cong-cu/danh-sach.js (sửa chú thích “không sửa Sổ tay”)`, `server/nghiep-vu/cai-dat.js (khóa mới, da_dat, hàm thongTinShopConThieu)`, `server/api/bao-cao.js (tong-quan trả thêm thong_tin_shop)`, `public/js/man-hinh/tong-quan.js`, `public/js/noi-voi-mai.js (mở ô với câu gợi ý)`, `public/js/man-hinh/cai-dat.js`, `server/cau-hinh/loi-dan-mau.json (quan_ly)`, `server/cau-hinh/skill-mau.json`, `server/db/nang-cap/0NN-truoc-sau-live.sql`

**Dữ liệu:** Không thêm bảng. Trong tệp nâng cấp chung: agent quan_ly thêm 'dat_ban_hang' và 'ghi_so_tay' vào cong_cu bằng json_insert, như 016-the-don.sql. Khóa mới trong cai_dat.ban_hang (JSON, không cần nâng cấu trúc): gio_nghe_may, xung_ho (nếu P35 chưa thêm), da_dat. da_dat là danh sách khóa người đã tự đặt, kể cả đặt giá trị trống. Cần da_dat vì datBanHang hiện ghi lại mọi khóa, nên không phân biệt được giá trị mặc định với giá trị người đặt.

**Cấu hình, câu mẫu, Skill, Hook:** - Skill mới “Điền thông tin shop” (cho Q): ánh xạ câu nói sang khóa, thiếu số thì hỏi lại, không đoán.
- Lời dặn quan_ly: thêm 2 công cụ và luật “đọc lại con số”.
- Câu gợi ý cho từng mục thiếu, để trong cau-mau-khach.json.
- Hai ô Cài đặt chọn từ danh sách như đã tả ở trên.

**Giả lập Facebook:** không

**Test:**
- test/thong-tin-shop.test.js (mới): 8 mục, da_dat, luật con số, xem trước → Làm / Bỏ
- test/noi-voi-mai.test.js (thêm 2 công cụ)
- test/so-tay.test.js (bản sửa khi ghi qua Mai)

**Claude Code làm thay:** Claude Code viết Skill và lời dặn. Claude Code soạn 20 câu nói mẫu của chủ shop (đủ 8 mục, có câu mơ hồ, câu nhiều số, cách nói “10 cành”, “200k”, “mười nghìn”), mỗi câu kèm “đáp án mẫu” là lời gọi công cụ đúng, dùng làm AI giả trong test. Sau đó Claude Code tự gõ các câu này trên bản xem thử (AI giả) và chụp Tổng quan cùng bảng xem trước.

**Thử AI thật:** Có, ngắn. Gõ 3 câu thật trên bản xem thử bằng model đang cài cho quan_ly (OpenAI gpt-6-sol):
1. “phí ship 10 nghìn, trên 200 nghìn miễn ship”
2. “shop nghe máy 8 giờ sáng tới 9 giờ tối”
3. “đổi size trong 3 ngày nếu chưa giặt”
Ước 0,04 USD. Muốn rẻ hơn thì tạm đổi sang gpt-6-luna trong dữ liệu xem thử, khoảng 0,003 USD.

**Phụ thuộc:** F-62 đã có. Nếu các mốc trước đã làm thì dùng chung khóa: P35 (xưng hô), P21 (3 ô tài khoản ngân hàng), P24a (giờ giữ hai mức).

**Rủi ro:** - Web Speech nghe nhầm số. Chặn bằng luật “số phải có trong câu người nói” và bảng xem trước.
- Sổ tay là nguồn trích của Bộ kiểm tra, nên AI viết Sổ tay có thể đưa số bịa vào nguồn. Chặn bằng cùng luật số và bước người bấm “Làm”.
- Việc này trái câu “AI không sửa Sổ tay” ở A.1 nên cần một quyết định mới.

**Mặc định tự chọn:** - Giờ giữ tính là “đã đặt” khi khóa có trong da_dat. Lưu form Bán hàng nghĩa là người đã thấy số 24 và chấp nhận.
- “Không miễn ship” lưu là mien_phi_tu = null kèm có trong da_dat. Không dùng số 0, vì 0 nghĩa là miễn ship mọi đơn.
- Giờ nghe máy chọn từ 6:00 đến 23:00, bước 30 phút.
- xung_ho mặc định chưa chọn; câu mẫu khi đó xưng “mình”.
- Thông tin người bán chỉ đòi 3 ô đang có, không thêm ô mới.

### Lịch live cố định và bộ bài báo trước do AI soạn

*Đề xuất: P09 · công sức: vua*

- Cài đặt → Bán hàng → “Lịch live”: tích chọn thứ (T2–CN) và chọn giờ trong danh sách (06:00–23:30, bước 30 phút). Có nút “Dời / Hủy buổi này”.
- Nghiệp vụ mới server/nghiep-vu/lich-live.js: buoiKe(bayGio), cacBuoi(tu, den), khopBuoi(lucLive) cho phép lệch ±60 phút, cùng phần ngoại lệ dời/hủy một ngày. Mọi giờ tính theo giờ Việt Nam.
- dongCaiDat() thêm dòng “Lịch live: …; buổi kế …”. Nhờ vậy Tư vấn viên, Co-host, miệng và soạn kịch bản đều biết lịch và trích được (K2, K3 đạt).
- Màn hình Livestream thêm khối “Báo trước buổi live”: hiện buổi kế và ô chọn kịch bản (mặc định kịch bản mới nhất; không có kịch bản thì lấy tối đa 8 sản phẩm Đang bán mới nhất).
- Nút “✨ AI soạn” gọi agent mới `soan_bai`, trả phiếu {su_kien:{tieu_de, mo_ta}, bai_nha_hang, reels:[3 câu]}.
  - Ngày giờ, số món và cú pháp chốt: AI để chỗ trống {lich} {so_mon} {cu_phap}, MOZA tự điền.
  - Nguồn chỉ là thẻ đã xác nhận, lấy bằng theChoAi({tonKho:false}); ô “AI đoán” không có trong thẻ.
  - Từng phần qua kiemTraCau kênh 'binh_luan' (K1, K2, K3, K5, K6, K8), cộng các kiểm riêng như loiNoiDung của soan-kich-ban.js: cấm ghi số lượng còn; cấm “chỉ hôm nay”, “giảm”, “sale”, “freeship” khi Cài đặt không có; cấm kể đã mặc thử.
  - Sai thì trả AI làm lại 1 lần; vẫn sai thì bỏ phần đó và ghi “Kiểm lại”.
- Mỗi phần có nút “Chép”. Ảnh ghép 2×2 dựng từ ảnh đại diện 4 món bằng canvas trên trình duyệt, có nút “Tải ảnh”. MOZA không đăng bài (6.5 cách A).
- Phần máy điền, không gọi AI:
  - “Lời mời + link” cho nhóm Zalo: trước live là link Page, đang live là link buổi live; nút “Chép lời mời + link live” đặt ở Màn hình người dẫn;
  - câu “Có sử dụng trợ lý AI”, dùng chung với P35;
  - bài báo dời buổi;
  - khối nhắc 2 lựa chọn quảng cáo: bật quảng cáo live 10–15 phút đầu, hoặc quảng cáo bấm để nhắn Messenger “Nhắn GIỮ CHỖ” trong ngày live. Chỉ là chữ hướng dẫn; chủ shop tự quyết, MOZA không gọi API quảng cáo.
- Bài nhá hàng có câu mời “bình luận món muốn xem kèm size”. Người bình luận dưới bài sẽ được mời nhận tin báo live (tính năng báo live).

**Tiêu chí:**
- [ ] Chọn T3 và T5 lúc 20:00: buổi kế tính đúng giờ Việt Nam, kể cả khi qua nửa đêm và qua Chủ nhật (test đồng hồ giả). Dời một buổi thì buổi kế đổi theo.
- [ ] AI giả trả bài có chữ “linen” trong khi ô chất liệu còn “AI đoán”: bài bị trả lại; bản cuối không có chữ đó.
- [ ] AI giả viết “giảm 50%”, “chỉ hôm nay”, “còn 3 chiếc”: bị chặn. Giá trong bài đúng thẻ; {lich} được điền thành “20:00 thứ Năm 2/10”.
- [ ] Đang có live giả: “Chép lời mời + link live” cho ra link buổi live lấy từ Facebook giả.
- [ ] Hỏi Tư vấn viên “khi nào shop live” (AI giả): câu trả lời trích dòng Lịch live, Bộ kiểm tra đạt.
- [ ] Chưa có lịch: khối Báo trước hiện “Chọn lịch live trong Cài đặt”.

**Tệp sửa:** `server/nghiep-vu/lich-live.js (mới)`, `server/agent/agents/soan-bai.js (mới)`, `server/api/truoc-live.js (mới, đăng ký trong server/api/index.js): GET/PUT /lich-live, POST /lich-live/soan-bai, POST /lich-live/doi-buoi`, `server/agent/kiem-tra/kiem-tra.js (dongCaiDat)`, `server/facebook/that.js (timLiveDangPhat thêm trường permalink_url, video{id})`, `server/facebook/gia.js (live giả có link)`, `server/nghiep-vu/live.js (ganLive lưu giờ Facebook, link, video id — nếu BH5 chưa làm)`, `server/phong-live.js (gan truyền liveFb.bat_dau và link)`, `public/js/man-hinh/live.js`, `public/js/man-hinh/nguoi-dan.js`, `public/js/man-hinh/cai-dat.js`, `server/cau-hinh/loi-dan-mau.json (soan_bai)`, `server/cau-hinh/skill-mau.json`, `server/cau-hinh/cau-mau-khach.json`

**Dữ liệu:** - Không thêm bảng. Lịch lưu trong cai_dat khóa 'lich_live' = {buoi:[{thu, gio}], ngoai_le:[{ngay, huy}|{ngay, gio_moi}]}.
- Tệp nâng cấp chung: INSERT agent soan_bai (openai gpt-6-luna, suy nghĩ thấp, dự phòng gemini-3.5-flash-lite, cong_cu '[]').
- Nếu BH5 chưa thêm thì phien_live thêm 3 cột: fb_bat_dau (creation_time của Graph), fb_link, fb_video_id. Lý do: ganLive hiện ghi bat_dau là giờ MOZA phát hiện ra live, lệch 10–30 giây. Cần link cho Zalo và tin báo lên sóng. Cần video id để sửa lỗi laBaiLive (kiem-8).

**Cấu hình, câu mẫu, Skill, Hook:** - Skill mới “Viết bài báo trước live” (luật trung thực, không hứa ưu đãi chưa cài, không dùng ô chưa xác nhận).
- Lời dặn soan_bai.
- Câu mẫu Zalo, dời buổi, nhắc quảng cáo trong cau-mau-khach.json.
- Ô “Lịch live” chọn từ danh sách.

**Giả lập Facebook:** - timLiveDangPhat của Facebook giả trả thêm link giả dạng https://facebook.com/live-gia/{id} và bat_dau.
- Phòng diễn tập đã có /dien-tap/binh-luan-bai để giả bình luận dưới bài nhá hàng.

**Test:**
- test/lich-live.test.js (mới): buổi kế, ngoại lệ, khớp live ±60 phút, dòng dongCaiDat
- test/soan-bai.test.js (mới): AI giả, chặn “AI đoán”, chặn giảm giá / khan hiếm, điền chỗ trống
- test/kiem-tra.test.js (thêm ca trích Lịch live)
- test/facebook.test.js (yêu cầu Graph có trường permalink_url, video{id})

**Claude Code làm thay:** - Viết Skill và lời dặn.
- Viết 6 “đáp án mẫu” cho AI giả: 3 bài đạt, 3 bài phạm luật (AI đoán, giảm giá, số còn).
- Tự viết thử bài cho 6 sản phẩm mẫu và tự chấm, thay vì gọi AI nhiều lần.
- Tra lại tài liệu Meta mới nhất về Sự kiện live (nút Nhắc tôi), Boost live, quảng cáo bấm để nhắn. Viết hướng dẫn từng bước cho chủ shop, ghi ngày tra vào SPEC mục 6.

**Thử AI thật:** Có. Soạn 2 bộ bài thật bằng gpt-6-luna (OpenAI) trên 6 sản phẩm mẫu của bản xem thử, ước 0,003 USD. Nếu bị Bộ kiểm tra chặn từ 2/3 lần trở lên thì báo chủ dự án và đề xuất đổi sang gpt-6-sol (khoảng 0,015 USD mỗi bộ); không tự đổi.

**Phụ thuộc:** Phụ thuộc việc nền BH5 “Lưu giờ bắt đầu live do Facebook trả về” (chưa làm thì làm ở đây). P35 dùng chung câu “Có sử dụng trợ lý AI”.

**Rủi ro:** - AI viết quảng cáo vượt dữ liệu. Chặn bằng Bộ kiểm tra cùng các từ cấm.
- Luôn phải có nút “Dời buổi” vì lịch là lời hứa công khai.
- Người dẫn quên đổi đoạn thì danh sách món trong bài lệch với buổi thật (chỉ ảnh hưởng bài, không ảnh hưởng tiền).

**Mặc định tự chọn:** - Mặc định chưa có lịch nào; chủ shop tự chọn (mục 8 việc 9).
- Khớp live với buổi trong khoảng ±60 phút.
- Model gpt-6-luna vì bài ngắn, đã có Bộ kiểm tra canh, và cần rẻ cho ngân sách thử dưới 1 USD. Đổi được trong Cài đặt.
- Bài lấy tối đa 8 món; ảnh ghép dùng 4 món đầu; mỗi câu Reels tối đa 150 ký tự.
- Soạn bài là việc người bấm, nên vẫn chạy khi “Dừng mọi tự động” đang bật (như #F-62, quyết định vắng số 5).

### Báo live cho người đã đồng ý, xin từng buổi, trong 24 giờ (6.3 A+B)

*Đề xuất: P10 · công sức: vua*

- Chỉ nhắn người đã tự bấm đồng ý cho đúng một buổi, và chỉ trong 24 giờ kể từ lúc bấm (bấm nút là mở cửa sổ 24 giờ). Không lập danh sách tiếp thị lâu dài, không gửi hàng loạt, không dùng Marketing Messages hay Zalo.
- Chỉ mời khi buổi kế bắt đầu trong vòng 23 giờ tới. Tin mời do máy soạn từ câu mẫu, không gọi AI, có dòng tự giới thiệu AI. Có 3 chỗ mời:
  a) Người bình luận dưới bài đăng thường của Page (không phải bài live) kiểu hóng, chấm, “báo em”: nhận bằng từ khóa, không có câu hỏi, không phải chốt. Gửi nhắn riêng một thẻ có 2 nút. Bình luận có câu hỏi vẫn đi Tư vấn viên như cũ.
  b) Trong Messenger, khách hỏi lịch (“khi nào live”, “mấy giờ live”, “báo em khi live”): trả lời lịch bằng câu mẫu kèm 2 nút. Buổi kế còn hơn 23 giờ thì chỉ báo lịch và mời bấm “Nhắc tôi” ở Sự kiện live.
  c) Sau tin cảm ơn khi khách bấm “Xác nhận đơn” (the-don.tinTraLoi): gửi thêm thẻ mời.
- Câu hỏi nguyên văn nằm trong câu mẫu, chờ luật sư duyệt: “Tối {thu} {gio} shop live {so_mon} mẫu mới. Shop gửi {xung} 1 tin Messenger lúc lên sóng được không?” [Báo em buổi này] [Thôi].
- Lưu nguyên văn câu hỏi, id tin mời, giờ bấm và id tin bấm.
- Khi MOZA nhận ra live của Page đã bắt đầu và khớp buổi: nghe bus 'live.bat_dau', gửi mỗi người đã đồng ý 1 tin “{ten} ơi, {ten_shop} lên sóng rồi: {link}. Gõ DỪNG để không nhận tin nhắc.” Điều kiện: còn trong 24 giờ kể từ lúc bấm; chưa DỪNG; chưa rút đồng ý; đạt choGui loại moi_chao; “Dừng mọi thứ” tắt. Gửi rải tối đa 20 tin mỗi phút. Tới giờ buổi + 60 phút mà live chưa bắt đầu thì không gửi.
- Bấm “Thôi” thì không mời lại người đó trong 7 ngày. Mỗi người tối đa 1 lời mời mỗi buổi và 1 lời mời mỗi ngày.
- Khối Báo trước ghi “12 người đã đồng ý báo buổi này”; sau live ghi “đã nhắn 11, 1 người quá 24 giờ”.

**Tiêu chí:**
- [ ] Có buổi sau 5 giờ nữa, khách giả bình luận “hóng quá” dưới bài đăng giả: nhận được nhắn riêng có 2 nút. Bình luận “áo 12 còn M không” dưới bài: đi Tư vấn viên, không nhận thẻ mời (test).
- [ ] Bình luận thuộc live: không bao giờ nhận thẻ mời (test theo fb_video_id).
- [ ] Bấm “Báo em buổi này”: bảng dong_y_nhan_tin có đúng nguyên văn câu hỏi và giờ bấm. Live giả bắt đầu đúng giờ: nhận 1 tin có link và dòng “Gõ DỪNG”.
- [ ] Bấm lúc T, live bắt đầu lúc T + 25 giờ: không gửi, ghi lý do “quá 24 giờ” (test đồng hồ giả).
- [ ] Bấm “Thôi”: không nhận tin; lời mời thứ hai trong 7 ngày bị chặn.
- [ ] 30 người đồng ý: tin báo rải đều, không quá 20 tin mỗi phút (test đồng hồ giả).
- [ ] Khách hỏi “tối nay mấy giờ live” trong Messenger: được trả lời bằng câu mẫu, không có lượt agent_run nào.

**Tệp sửa:** `server/nghiep-vu/dong-y.js (mới, chứa mọi SQL của bảng dong_y_nhan_tin)`, `server/nghiep-vu/lich-live.js`, `server/hop-thu.js (nhan: chỗ mời a và b; xuLyNut BAO_LIVE / THOI_BAO_LIVE; nghe bus → nhacLive)`, `server/dich-vu.js (đưa bus cho HopThuTuDong)`, `server/agent/hook/phan-loai-tin.js (nhãn hoi_lich_live, hong_live)`, `server/nghiep-vu/the-don.js / server/gui-the-don.js (thẻ mời sau khi xác nhận, gửi thẻ qua nhắn riêng)`, `server/facebook/that.js, server/facebook/gia.js (nhắn riêng có nút, nếu BH5 chưa có)`, `server/nghiep-vu/hop-thu.js (laBaiLive dùng thêm fb_video_id)`, `server/nghiep-vu/dien-tap-ban-hang.js (tua các cột đồng ý)`, `public/js/man-hinh/live.js`, `server/cau-hinh/cau-mau-khach.json`, `server/db/nang-cap/0NN-truoc-sau-live.sql`

**Dữ liệu:** Thêm bảng dong_y_nhan_tin với các cột: id, page_id, nguoi_fb_id, hoi_thoai_id, buoi (giờ bắt đầu buổi, ISO), cau_hoi (nguyên văn), tin_hoi_id, tra_loi ∈ {cho, dong_y, thoi}, tra_loi_luc, tin_tra_loi_id, rut_luc, nhac_luc, nhac_tin_id, dien_tap, tao_luc; UNIQUE(nguoi_fb_id, buoi). Lý do: làm bằng chứng đồng ý theo Luật 91/2025 Điều 28. Cột khach.dong_y_luc hiện có là đồng ý dùng thông tin để giao hàng, không dùng lẫn được.

**Cấu hình, câu mẫu, Skill, Hook:** - Câu mời, câu báo lên sóng, câu trả lời khi bấm “Thôi” trong cau-mau-khach.json.
- Từ khóa hóng, hỏi lịch trong phan-loai-tin.js.
- Không thêm ô Cài đặt: công tắc chính là việc chủ shop đặt lịch live.

**Giả lập Facebook:** - Nhắn riêng có nút (nhanRiengThe) trong gia.js.
- Bình luận bài giả mang post_id khác id live.
- Live giả bắt đầu trễ hoặc sớm so với lịch để thử khopBuoi.
- Phòng diễn tập thêm nút “Khách hóng dưới bài đăng” (gọi /dien-tap/binh-luan-bai sẵn có).

**Test:**
- test/dong-y-nhan-tin.test.js (mới): 3 chỗ mời, 24 giờ, Thôi 7 ngày, rải tin, không mời bình luận live
- test/hop-thu.test.js (nhãn hỏi lịch, hóng)
- test/facebook.test.js (thân yêu cầu nhắn riêng có button template)

**Claude Code làm thay:** - Viết từ khóa và hơn 60 câu mẫu phân loại (hóng, hỏi lịch, không phải; có dấu, không dấu, viết tắt), cùng dạng bộ 105 câu chốt.
- Viết nháp câu xin đồng ý nêu rõ nội dung, kênh, tần suất, cách từ chối, để đưa luật sư (NĐ 330/2026, Luật 91/2025 Điều 28).
- Viết nháp chính sách quyền riêng tư, liệt kê các bên nhận dữ liệu.
- Tự lái bản xem thử đóng vai khách: bấm nút, xem tin báo lên sóng.

**Thử AI thật:** không (toàn bộ do mã soạn)

**Phụ thuộc:** Phụ thuộc tính năng Lịch live, phần nền (bộ đọc nút, choGui) và BH5: đánh dấu lượt nhắn riêng, nhắn riêng có nút của P22, sửa laBaiLive bằng fb_video_id. Cần Bước 0 để kiểm nhắn riêng có nút tới người bình luận bài thường.

**Rủi ro:** - Lúc sắp live, ít người còn trong 24 giờ nên hiệu quả vừa phải (báo cáo đã nói).
- Nếu laBaiLive vẫn so nhầm id thì có thể mời nhầm người bình luận live và dùng mất lượt nhắn riêng. Vì vậy phải có fb_video_id trước khi bật chỗ mời a.
- Câu xin đồng ý chưa được luật sư duyệt: giữ ở mức hẹp nhất.
- Nhiều người chặn Page thì Page có thể bị khóa nhắn tin (P04).

**Mặc định tự chọn:** - Chỉ mời khi buổi bắt đầu trong vòng 23 giờ: giờ báo lên sóng (lúc live bắt đầu, trễ tối đa 60 phút) vẫn nằm trong cửa sổ 24 giờ tính từ lúc bấm.
- Báo lúc live thật sự bắt đầu, không báo trước 30 phút: lúc đó mới có link live, và không báo nhầm khi shop hoãn.
- “Thôi” thì chờ 7 ngày; mỗi người mỗi buổi 1 lời mời.
- Gửi tối đa 20 tin mỗi phút, dưới giới hạn gửi của Meta, như nhịp nhắn riêng hiện có.

### Quyền của khách: gõ DỪNG để thôi nhận tin, “Xóa dữ liệu của tôi” (nghĩa vụ luật)

*Đề xuất: P10 · công sức: nho*

- phan-loai-tin.js thêm nhãn `dung_nhan_tin`. Nhận: “DỪNG”, “dung”, “stop”, “không nhận tin nữa”, “đừng nhắn nữa”, “hủy nhận tin”. Không nhận: chữ “thôi” đứng một mình, và “hủy đơn”.
- Khi nhận DỪNG:
  - ghi nguoi_fb.dung_nhan_tin_luc và rút mọi đồng ý (điền rut_luc);
  - trả câu mẫu, không gọi AI: “Shop đã dừng tự nhắn cho {xung}. {Xung} vẫn nhắn hỏi hàng bình thường; đơn đang giao shop gọi điện khi cần.”;
  - từ đó choGui chặn mọi tin chủ động (báo live, hỏi lại, hỏi mặc, nhắc đơn); đơn đang mở cần báo gì thì tạo việc gọi cho người;
  - câu trả lời khi chính khách nhắn vẫn chạy.
- “Xóa dữ liệu của tôi”: nhãn yeu_cau_xoa đã có, giữ việc chuyển Cần người như cũ. Thêm:
  - trả câu mẫu ngay: “Shop đã nhận yêu cầu xóa dữ liệu của {xung}. Shop xóa trong 72 giờ và nhắn báo khi xong.”;
  - tạo việc 'xoa_du_lieu' có hạn chót 72 giờ; trên Tổng quan việc chuyển đỏ khi còn dưới 12 giờ.
- Nút “Xóa dữ liệu người này”: xoaDuLieu mở rộng để xóa luôn bản ghi đồng ý và ảnh khách (P28). Cờ DỪNG được giữ lại, vì cờ này bảo vệ khách (không bị nhắn lại). Xóa xong gửi câu mẫu “đã xóa” nếu còn trong 24 giờ; hết 24 giờ thì ghi chú cho người.
- Người chưa có hồ sơ khách (chỉ có nguoi_fb, chưa cho số điện thoại) cũng xóa được, bằng hàm mới xoaDuLieuNguoi(nguoiFbId). Khách còn đơn chưa xong thì phải hủy hoặc hoàn tất đơn trước, như hiện nay.
- Có sẵn payload nút XOA_DU_LIEU để menu cố định của P19 dùng lại.

**Tiêu chí:**
- [ ] Có 60 câu mẫu phân loại: DỪNG nhận đúng 100%; “thôi shop hủy giúp mình” không bị coi là DỪNG (test).
- [ ] Gõ DỪNG: rút mọi đồng ý; tin báo live, hỏi lại, hỏi mặc cho người này không gửi; câu hỏi hàng sau đó vẫn được Tư vấn viên trả lời (test).
- [ ] “xóa hết thông tin của em đi”: nhận câu mẫu, có việc 'xoa_du_lieu' hạn 72 giờ, hội thoại Cần người.
- [ ] Xóa người chỉ có nguoi_fb: nội dung tin, tên hiển thị, đồng ý, ảnh đều bị xóa; báo cáo vẫn đúng số đơn (test).
- [ ] Tổng quan hiện việc xóa dữ liệu kèm hạn chót, đỏ khi còn dưới 12 giờ.

**Tệp sửa:** `server/agent/hook/phan-loai-tin.js`, `server/hop-thu.js (nhan: xử lý dung_nhan_tin, yeu_cau_xoa)`, `server/nghiep-vu/khach.js (LOAI_VIEC thêm 'xoa_du_lieu'; xoaDuLieu mở rộng; xoaDuLieuNguoi mới)`, `server/nghiep-vu/hop-thu.js (đặt / đọc dung_nhan_tin_luc)`, `server/nghiep-vu/dong-y.js (xoaCuaNguoi)`, `server/api/hop-thu.js (DELETE /nguoi/:id/du-lieu)`, `public/js/man-hinh/tong-quan.js (TEN_VIEC thêm loại mới, hạn chót)`, `public/js/man-hinh/hop-thu.js (nút xóa cho người chưa có hồ sơ)`, `server/cau-hinh/cau-mau-khach.json`

**Dữ liệu:** Dùng cột nguoi_fb.dung_nhan_tin_luc của tệp nâng cấp chung. Không thêm bảng. Loại việc 'xoa_du_lieu' không cần nâng cấp vì viec.loai không có CHECK.

**Cấu hình, câu mẫu, Skill, Hook:** Câu mẫu DỪNG, đã nhận yêu cầu xóa, đã xóa. Hạn xóa 72 giờ là hằng số trong mã, chờ luật sư xác nhận, không thêm ô.

**Giả lập Facebook:** Không cần thêm. Khách giả kịch bản gõ “DỪNG” và “xóa dữ liệu của tôi”.

**Test:**
- test/quyen-khach.test.js (mới)
- test/hop-thu.test.js (nhãn mới trong phanLoai)
- test/csdl.test.js (cột mới)

**Claude Code làm thay:** Claude Code viết 60 câu mẫu phân loại (DỪNG, xóa, câu dễ nhầm) và các câu mẫu trả lời. Tra văn bản gốc Luật 91/2025 và NĐ 356/2025 về thời hạn xử lý yêu cầu xóa, rồi ghi câu hỏi cho luật sư.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc phần nền (choGui). P19 (menu cố định) dùng lại payload XOA_DU_LIEU.

**Rủi ro:** - Bắt nhầm “dừng” trong câu thường thì làm mất tin chăm sóc; chỉ bắt câu ngắn hoặc cụm rõ nghĩa.
- Hạn 72 giờ chưa có nguồn luật xác nhận.

**Mặc định tự chọn:** - Hạn xóa 72 giờ: cách làm phổ biến, chờ luật sư xác nhận.
- DỪNG chặn cả tin trạng thái đơn: theo luật nền đã duyệt “khách nói thôi, dừng là ngừng hẳn”; đơn đang giao chuyển thành việc gọi.
- Giữ cờ DỪNG sau khi xóa, vì cờ không chứa nội dung cá nhân và giúp không nhắn lại.

### Bộ mẫu tin Utility trạng thái đơn và tin trạng thái do máy soạn (không cần nối hãng)

*Đề xuất: P25 · công sức: nho*

- Nút cũ “Tạo mẫu tin” đổi thành “Tạo bộ mẫu tin”, tạo 4 mẫu trên mọi Page đang nối:
  - moza_don_da_xac_nhan (mới);
  - moza_don_da_gui (đã có ở #89);
  - moza_chuan_bi_gui, có 2 nút postback, cho P26;
  - moza_hoi_mac, có 3 nút, cho P27.
  Mẫu P06 của BH5 nếu có thì gộp vào bộ này. Có bảng trạng thái từng mẫu: chờ duyệt, đã duyệt, bị từ chối, bị Meta xếp Tiếp thị. Mẫu không ở loại UTILITY thì MOZA không dùng, tính năng cần mẫu đó tự lùi (chỉ gửi trong 24 giờ, hoặc tạo việc).
- that.js:
  - taoMauUtility nhận thêm nút (khối BUTTONS);
  - guiUtility gửi được nút và tham số payload;
  - hàm mới trangThaiMauUtility(ten);
  - sửa chú thích cũ “Meta duyệt khoảng 24 giờ” thành “duyệt trong vài giây”.
  Cú pháp chính xác Claude Code phải tra tài liệu Meta mới nhất trước khi viết.
- Tin trạng thái trong 24 giờ đổi sang câu mẫu máy điền, không gọi AI. Hiện nhacDon (nhánh “bao”) còn gọi Tư vấn viên để báo đã gửi, tốn một lượt AI mỗi đơn.
- Ngoài 24 giờ thì gửi mẫu Utility.
- Thêm tin “đã xác nhận” khi người tự xác nhận đơn trên màn hình Đơn hàng (ví dụ sau cuộc gọi xác nhận của #73). Hiện khách không được báo trường hợp này.
- Tin “Hôm nay giao” và “Chưa giao được” không làm, vì cần dữ liệu từ hãng (6.4 cách C).

**Tiêu chí:**
- [ ] Bấm “Tạo bộ mẫu tin” trên Facebook giả: 4 mẫu hiện “Đã duyệt”. Giả một mẫu bị xếp Tiếp thị: mẫu đó hiện đỏ và không được gửi (test).
- [ ] Đơn Đã gửi, khách nhắn cách đây 3 giờ: nhận câu mẫu có mã vận đơn, số agent_run của tu_van không tăng.
- [ ] Đơn Đã gửi, khách nhắn cách đây 30 giờ: nhận mẫu Utility moza_don_da_gui (đã có) — giữ đúng test hiện tại.
- [ ] Người đổi đơn sang Đã xác nhận: khách nhận tin “đã xác nhận” (câu mẫu trong 24 giờ, Utility ngoài 24 giờ).
- [ ] Khách đã DỪNG: không gửi tin trạng thái; có việc cho người.

**Tệp sửa:** `server/gui-the-don.js (bảng MAU_UTILITY thay MAU_DA_GUI, guiUtilityTheoMau, guiTrangThai)`, `server/hop-thu.js (nhacDon nhánh “bao” dùng câu mẫu)`, `server/api/don.js (sau khi người xác nhận thì gửi tin trạng thái)`, `server/api/ket-noi.js (/ket-noi/mau-utility tạo cả bộ, GET trạng thái)`, `server/facebook/that.js`, `server/facebook/gia.js`, `server/facebook/ket-noi.js (QUYEN_CAN thêm page_utility_messaging, nếu BH5 chưa thêm)`, `public/js/man-hinh/cai-dat-facebook.js`, `server/cau-hinh/cau-mau-khach.json`

**Dữ liệu:** Không. Trạng thái bộ mẫu lưu trong cai_dat khóa 'fb_mau_utility_bo'. Vẫn đọc khóa cũ 'fb_mau_utility' để không mất mẫu đã tạo.

**Cấu hình, câu mẫu, Skill, Hook:** Nội dung 4 mẫu, chỉ có thông tin, không tiếp thị, cộng câu mẫu tin trạng thái trong 24 giờ.

**Giả lập Facebook:** - gia.js: taoMauUtility giả có thể đặt kết quả duyệt từng mẫu (APPROVED, REJECTED, MARKETING) cho test.
- guiUtility giả lưu nút để khachBam bấm được như webhook thật.
- Có trangThaiMauUtility giả.
- Phòng diễn tập thêm ô “Giả Meta duyệt mẫu: duyệt / từ chối / xếp tiếp thị”.

**Test:**
- test/mau-utility.test.js (mới)
- test/hop-thu-don.test.js (báo đã gửi bằng câu mẫu, không có agent_run)
- test/facebook.test.js (thân yêu cầu tạo / gửi mẫu có nút, trường category)

**Claude Code làm thay:** - Viết nội dung 4 mẫu, đúng luật Utility (không tiếp thị, không đe dọa bêu tên).
- Tra tài liệu Meta mới nhất: Messenger Utility templates có nút postback, cách kiểm trạng thái mẫu, quyền page_utility_messaging. Ghi ngày tra.
- Viết hướng dẫn cho chủ shop bấm “Tạo bộ mẫu tin” sau Bước 0.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc phần nền; BH5 (quyền page_utility_messaging, mẫu “đơn đang chờ xác nhận” của P06). Mẫu thật chỉ tạo được sau Bước 0, khi có Page, ứng dụng và quyền.

**Rủi ro:** - Meta có thể xếp mẫu hỏi mặc hoặc chuẩn bị gửi vào loại tiếp thị; khi đó tính năng lùi về chỉ trong 24 giờ.
- Chưa khẳng định Utility miễn phí (kiem-9).
- Cú pháp nút trong mẫu Messenger chưa kiểm với Page thật.

**Mặc định tự chọn:** - Tin trạng thái trong 24 giờ do máy soạn, theo gop.json P25 “Tin do máy điền, không gọi AI”.
- Mẫu viết tiếng Việt (vi), ngắn, có mã đơn.
- Tin trạng thái không tính vào trần 1 tin mỗi ngày.

### Hỏi lại đơn nên xác nhận trước khi gửi hàng (máy đánh dấu, người quyết)

*Đề xuất: P26 · công sức: nho*

- Hàm mucHoiLai(d) trong don.js chỉ dùng lịch sử đơn của chính shop. Không dùng tỉnh, xã, tên, giới tính. Đánh dấu “Nên hỏi lại” khi:
  - khách mới (chưa có đơn Đã giao nào, tính theo khach_id, chưa có thì theo nguoi_fb_id) VÀ đơn COD chưa nhận tiền VÀ tong_tien ≥ ngưỡng đơn lớn;
  - HOẶC khách từng hoàn ít nhất 1 đơn nhưng chưa tới ngưỡng #73. Từ ngưỡng #73 trở lên đã có việc “Gọi xác nhận đơn”.
- Gửi khi đơn đã Đã xác nhận được ít nhất 2 giờ và đang trong 8h–21h. Tin là thẻ câu mẫu: “Shop chuẩn bị gửi đơn {ma} ({tong}), {xung} nhận trong tuần này được không?” [Gửi đi] [Hẹn ngày khác]. Trong 24 giờ gửi thẻ thường; ngoài 24 giờ gửi mẫu moza_chuan_bi_gui; không có mẫu thì tạo việc 'goi_xac_nhan_don'. Khách không bao giờ thấy chữ “rủi ro”.
- Bấm [Gửi đi]: don.hoi_lai = 'dong_y', ghi lịch sử (nguồn khách tự báo), trả câu mẫu cảm ơn.
- Bấm [Hẹn ngày khác]: trả câu mẫu “{xung} muốn shop gửi ngày nào ạ?”; tạo việc 'hen_ngay_gui' cho chủ shop; khách nhắn chữ sau đó thì Tư vấn viên xử lý như thường, ghi ngày vào ghi chú đơn.
- Không trả lời sau 24 giờ: việc “Gọi xác nhận đơn: khách chưa trả lời tin hỏi lại”.
- Không bao giờ tự hủy, không từ chối COD, không khóa nút in phiếu. Màn hình Đơn hàng → Cần gửi có nhãn nội bộ “Nên hỏi lại” kèm lý do (“khách mới · COD · 650.000đ”) và trạng thái hỏi. Nút “Hỏi lại ngay” cho người muốn gửi sớm.
- Không có phần xin cọc (cần P21 bước 2).

**Tiêu chí:**
- [ ] Khách mới, COD, 650.000đ, ngưỡng 500.000đ: có nhãn; sau 2 giờ trong khung giờ thì nhận thẻ 2 nút. Khách có 1 đơn Đã giao trước đó: không có nhãn (test).
- [ ] Khách từng hoàn 1 đơn, ngưỡng #73 là 2: có nhãn. Từng hoàn 2: không có nhãn P26, vẫn có việc #73.
- [ ] Bấm Gửi đi: hoi_lai = dong_y, có dòng lịch sử. Bấm Hẹn ngày khác: có việc hen_ngay_gui.
- [ ] Im lặng 24 giờ (tua): có việc gọi xác nhận; đơn không đổi trạng thái.
- [ ] Đơn Đã xác nhận lúc 23h: tin chờ tới 8h sáng hôm sau; nếu lúc đó đã quá 24 giờ thì dùng Utility.
- [ ] Chữ “rủi ro” không xuất hiện trong mọi tin gửi khách (test quét).

**Tệp sửa:** `server/nghiep-vu/don.js (mucHoiLai, canHoiLai, ghi hoi_lai)`, `server/hop-thu.js (nhip: hoiLaiDon; nút GUI_DI / HEN_NGAY)`, `server/gui-the-don.js`, `server/nghiep-vu/khach.js (LOAI_VIEC 'hen_ngay_gui')`, `server/nghiep-vu/cai-dat.js (nguong_don_lon)`, `server/api/don.js (POST /don/:id/hoi-lai; danh sách trả nhãn)`, `public/js/man-hinh/don.js`, `public/js/man-hinh/cai-dat.js`, `server/nghiep-vu/dien-tap-ban-hang.js (tua hoi_lai_luc)`, `server/cau-hinh/cau-mau-khach.json`

**Dữ liệu:** Tệp nâng cấp chung: bảng don thêm cột hoi_lai TEXT (NULL | 'da_hoi' | 'dong_y' | 'hen_ngay' | 'khong_tra_loi') và hoi_lai_luc. Không đặt CHECK để khỏi dựng lại bảng. Lý do: để không hỏi hai lần và để màn hình hiện trạng thái hỏi.

**Cấu hình, câu mẫu, Skill, Hook:** Cài đặt → Bán hàng thêm 1 ô “Đơn từ bao nhiêu thì hỏi lại khách mới (COD)”, mặc định 500.000đ. Câu mẫu thẻ và trả lời trong cau-mau-khach.json.

**Giả lập Facebook:** Không thêm gì ngoài phần nền (thẻ có nút, Utility có nút giả). Khách giả kịch bản có hành động bấm Gửi đi, Hẹn ngày khác, im lặng.

**Test:**
- test/hoi-lai-don.test.js (mới): tiêu chí đánh dấu, khung giờ, 24 giờ / Utility / việc, nút, không có chữ “rủi ro”

**Claude Code làm thay:** Claude Code viết câu mẫu và bộ dữ liệu test (khách mới, khách cũ đã giao, khách hoàn 1 và 2 đơn, đơn chuyển khoản đã nhận tiền). Tự chạy buổi tập trên bản xem thử và chụp màn Cần gửi.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc phần nền, bộ mẫu Utility (P25) và #73 hiện có.

**Rủi ro:** - Tự chấm mức cần hỏi lại khách là lập hồ sơ theo luật dữ liệu cá nhân: chỉ dùng đơn của shop, người quyết; luật sư xem (mục 9).
- Khách vừa bấm xác nhận lại bị hỏi thì dễ phật ý: chờ 2 giờ và viết như tin báo chuẩn bị gửi.

**Mặc định tự chọn:** - Ngưỡng 500.000đ: đơn live quần áo thường khoảng 150–400k, nên chỉ đơn lớn mới bị hỏi (ước tính, sửa được).
- Chờ 2 giờ sau khi xác nhận.
- Khung 8h–21h.
- Không trả lời sau 24 giờ thì tạo việc gọi.
- Nhãn nội bộ ghi “Nên hỏi lại”, không ghi “rủi ro” hay “bom hàng”.

### Hỏi thăm 4 ngày sau khi gửi hàng: “Mặc thấy sao?” [Vừa lắm] [Hơi chật] [Hơi rộng]

*Đề xuất: P27 · công sức: nho*

- Nhịp 30 giây của HopThuTuDong lấy các đơn Đã gửi hoặc Đã giao, đã gửi từ N ngày trở lên (tính từ don_lich_su den='da_gui'), chưa hỏi, không Hoàn hay Hủy, khách chưa DỪNG, đạt choGui loại cham_soc, đang trong 10h–20h.
- Tin: “{xung} nhận đơn {ma} rồi, mặc thấy sao {xung}?” kèm 3 nút. Trong 24 giờ gửi thẻ thường; ngoài 24 giờ gửi mẫu moza_hoi_mac. Không có mẫu, hoặc mẫu bị xếp Tiếp thị, thì bỏ qua, không tạo việc. Không dùng mẫu khảo sát CSAT của Meta (còn “in development”).
- Không mời mua thêm, không gợi ý phối trong tin này, không tặng quà hay mã giảm giá để đổi lấy lời khen.
- Bấm [Vừa lắm]: câu mẫu cảm ơn, ghi don.phan_hoi_mac = 'vua'.
- Bấm [Hơi chật] hoặc [Hơi rộng]: câu mẫu cộng trích nguyên văn mục Sổ tay “Đổi trả” (tối đa 400 ký tự, cắt ở dấu chấm), cộng “nhân viên shop nhắn {xung} ngay”; tạo việc 'doi_size' hạn 24 giờ. Sổ tay trống thì chỉ có câu mẫu và việc. Không gọi AI, chưa làm “đơn đổi” tự động.
- Khách nhắn chữ sau đó: Tư vấn viên trả lời như thường, ngữ cảnh có dòng “khách vừa được hỏi thăm đơn {ma}”.
- Nhiều đơn liên tiếp thì chỉ hỏi đơn mới nhất; một người không bị hỏi 2 lần trong 14 ngày.
- Số liệu phan_hoi_mac để dành cho P14 bước 2 (“X/Y khách nói vừa”, từ 10 phản hồi) và P20.

**Tiêu chí:**
- [ ] Đơn Đã gửi, tua 96 giờ, lúc 11h: nhận thẻ 3 nút. Tua 72 giờ: chưa nhận (test).
- [ ] Bấm Hơi chật: tin trả lời chứa nguyên văn câu “đổi size trong 3 ngày nếu chưa giặt” từ Sổ tay; có việc doi_size; agent_run không tăng.
- [ ] Đơn Hoàn, đơn Hủy, khách đã DỪNG: không hỏi.
- [ ] Tin hỏi thăm không chứa từ khóa bán thêm (“mua thêm”, “ưu đãi”, “giảm”, “mã”, “quà”) — test quét câu mẫu.
- [ ] Ngoài 24 giờ, mẫu bị xếp Tiếp thị: không gửi gì, không lỗi.

**Tệp sửa:** `server/nghiep-vu/don.js (canHoiMac, ghiPhanHoiMac)`, `server/hop-thu.js (nhip: hoiMac; nút HOI_MAC)`, `server/gui-the-don.js`, `server/nghiep-vu/so-tay.js (lấy trích mục “Đổi trả”)`, `server/nghiep-vu/khach.js (LOAI_VIEC 'doi_size')`, `server/nghiep-vu/cai-dat.js (so_ngay_hoi_mac)`, `server/agent/agents/tu-van.js (dòng ngữ cảnh “vừa được hỏi thăm”)`, `server/nghiep-vu/dien-tap-ban-hang.js (tua cột mới)`, `public/js/man-hinh/cai-dat.js`, `public/js/man-hinh/tong-quan.js (TEN_VIEC)`, `server/cau-hinh/cau-mau-khach.json`

**Dữ liệu:** Tệp nâng cấp chung: bảng don thêm cột hoi_mac_luc, phan_hoi_mac TEXT ('vua'|'chat'|'rong', không CHECK) và phan_hoi_mac_luc. Lý do: không hỏi trùng; làm số liệu cho P14 bước 2 và P32. Đặt tên khác cột hoi_thoai.hoi_tham_luc đã có (F-32 hỏi thăm người im lặng) để khỏi nhầm.

**Cấu hình, câu mẫu, Skill, Hook:** Cài đặt → Bán hàng thêm 1 ô chọn “Hỏi thăm sau khi gửi” 2–7 ngày, mặc định 4. Câu mẫu trong cau-mau-khach.json.

**Giả lập Facebook:** Không thêm gì ngoài phần nền (Utility có 3 nút giả, kết quả duyệt giả). Đồng hồ: tua 168 giờ. Diễn tập: /dien-tap/van-chuyen có sẵn để đơn thành Đã giao.

**Test:**
- test/hoi-tham-sau-gui.test.js (mới)

**Claude Code làm thay:** Claude Code viết câu mẫu (có biến thể), danh sách từ cấm bán thêm, kịch bản khách giả bấm 3 nút; tự tua thời gian trên bản xem thử để kiểm.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc phần nền, bộ mẫu Utility (P25) và mục Sổ tay “Đổi trả” (tính năng thông tin shop).

**Rủi ro:** - Hàng thường tới tay khách sau 24 giờ, nên phần lớn phải dùng mẫu Utility. Meta xếp mẫu vào Tiếp thị thì gần như không hỏi được.
- Trích Sổ tay dài hoặc lạc ý: giới hạn 400 ký tự và có người nhận việc.

**Mặc định tự chọn:** - 4 ngày sau khi gửi, vì hàng nội vùng thường tới trong 2–4 ngày; sửa được 2–7.
- Khung 10h–20h.
- 14 ngày không hỏi lại cùng một người.
- Trả lời 3 nút bằng mã, không gọi AI, để tiết kiệm và tránh AI hứa đổi hàng.

### Xuất file đúng mẫu nhập đơn hàng loạt của hãng vận chuyển (6.4 cách B)

*Đề xuất: P29 · công sức: vua*

- Tệp cấu hình mới `server/cau-hinh/mau-xuat-van-chuyen.json`, mỗi hãng một khối: tên, định dạng (csv hoặc xlsx), tên sheet, dòng bắt đầu, danh sách cột {tieu_de, lay}, cột bắt buộc, nguồn và ngày tra.
  - Giá trị “lay” thuộc: ma_don, ten_nhan, sdt, dia_chi, tinh, xa, ten_hang, so_luong, khoi_luong_g, thu_ho, gia_tri_khai, co_dinh.
  - Sẵn khối “chung” (file CSV hiện tại của /don/xuat.csv). Các khối GHTK, GHN, Viettel Post, J&T chỉ điền sau khi Claude Code tra mẫu chính thức.
- Cài đặt → Bán hàng thêm ô chọn “Hãng vận chuyển đang dùng”: Chung (CSV) · GHTK · GHN · Viettel Post · J&T.
- Đơn hàng → Cần gửi → nút “Xuất file cho {hãng}”. Chỉ xuất đơn Đã xác nhận đã chọn.
- Cách tính các cột:
  - Thu hộ = tong_tien nếu COD chưa nhận tiền, bằng 0 nếu đã nhận chuyển khoản.
  - Giá trị khai = tong_hang.
  - Khối lượng = Σ số lượng × (can_nang_g của phân loại, hoặc của sản phẩm, không có thì 300 g). Dòng dùng số mặc định có cờ riêng.
  - Không đưa ghi chú nội bộ hay lịch sử khách vào file.
- Tách địa chỉ: bảng 34 tỉnh (`server/cau-hinh/tinh-thanh.json`, theo QĐ 19/2025, kèm tên gọi khác như HN, HCM, Sài Gòn). Hàm tachDiaChi trả {tinh, xa, con_lai, chac}. Không chắc thì cột “Cần sửa địa chỉ” = X, và màn hình liệt kê các đơn đó trước khi tải. Chưa chuẩn hóa địa chỉ đầy đủ (P30 để làm cùng cách C).
- Hãng nào chỉ nhận .xlsx: tự viết bộ ghi xlsx tối giản bằng node:zlib có sẵn (deflateRawSync, crc32). Không thêm thư viện.
- F-60 (nối thẳng hãng) vẫn để sau.

**Tiêu chí:**
- [ ] Chọn “Chung”: file y hệt bản hiện tại (test so byte).
- [ ] Mỗi hãng có tệp mẫu chuẩn do Claude Code dựng từ mẫu chính thức: file xuất ra khớp đúng tiêu đề và thứ tự cột (test so file mẫu).
- [ ] Đơn chuyển khoản đã nhận tiền: thu hộ 0. Đơn COD: thu hộ bằng tong_tien (test).
- [ ] Bộ 30 địa chỉ mẫu: tỉnh nhận đúng từ 90% trở lên; địa chỉ không rõ có cờ “Cần sửa” (test).
- [ ] File xlsx mở ra đọc lại được: giải nén bằng zlib trong test thấy đúng giá trị; Claude Code mở bằng Excel trên máy để kiểm.
- [ ] File không chứa ghi chú nội bộ (test).

**Tệp sửa:** `server/cau-hinh/mau-xuat-van-chuyen.json (mới)`, `server/cau-hinh/tinh-thanh.json (mới)`, `server/nghiep-vu/xuat-van-chuyen.js (mới: dựng dòng, tách địa chỉ, khối lượng)`, `server/nghiep-vu/xlsx-toi-gian.js (mới, chỉ khi có hãng cần xlsx)`, `server/api/don.js (/don/xuat.csv?hang=, /don/xuat-hang)`, `server/nghiep-vu/cai-dat.js (hang_van_chuyen)`, `public/js/man-hinh/don.js`, `public/js/man-hinh/cai-dat.js`

**Dữ liệu:** Không. Hãng lưu trong ban_hang.hang_van_chuyen.

**Cấu hình, câu mẫu, Skill, Hook:** Hai tệp cấu hình mới (mẫu cột theo hãng, danh mục 34 tỉnh) và 1 ô chọn hãng trong Cài đặt.

**Giả lập Facebook:** không

**Test:**
- test/xuat-van-chuyen.test.js (mới, so với các tệp mẫu chuẩn trong test/du-lieu/van-chuyen/)
- test/don.test.js (tham số hang của /don/xuat.csv)

**Claude Code làm thay:** - Tra mẫu nhập đơn hàng loạt chính thức của GHTK, GHN, Viettel Post, J&T: tên cột, định dạng, cột bắt buộc, cách ghi tiền thu hộ. Ghi nguồn và ngày tra.
- Dựng các tệp mẫu chuẩn cho test.
- Soạn danh mục 34 tỉnh với tên gọi khác, và 30 địa chỉ mẫu.
- Tự tải file từ bản xem thử để kiểm.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc F-57 đã có. Chờ chủ dự án cho biết hãng đang dùng (mục 8 việc 13); trong lúc chờ vẫn làm khung và mẫu 4 hãng.

**Rủi ro:** - Mẫu của hãng đổi mà không báo: ghi ngày tra, và báo lỗi rõ khi tải lên bị từ chối.
- Tách tỉnh, xã từ ô chữ tự do dễ sai: có cờ “Cần sửa”, người soát trước khi tải.
- Thu hộ sai là mất tiền thật: có test, và người xem lại file.

**Mặc định tự chọn:** - Mặc định “Chung” để không đổi thói quen hiện tại.
- 300 g mỗi món khi thiếu cân nặng (áo quần phổ thông), có cờ báo.
- Không đưa ghi chú đơn vào file, vì có thể là ghi chú nội bộ; hãng cần thì thêm cột sau.

### Tổng kết sau live: phễu do máy đếm và tối đa 3 gợi ý do AI viết

*Đề xuất: P32 · công sức: vua*

- Báo cáo → bấm vào một buổi → trang “Tổng kết buổi”. Chỉ tính buổi thật; mục “Buổi tập” xem được để thử.
- Máy đếm phễu, luôn tính lại theo dữ liệu mới nhất:
  - người chốt: số người khác nhau có bình luận da_chot;
  - đã trả lời tin: đơn có tin khách trong Messenger sau lúc tạo đơn, kể cả bấm nút;
  - đã xác nhận: từng có don_lich_su den='da_xac_nhan';
  - rồi đã gửi, đã giao, hoàn;
  - tách riêng đơn hủy vì quá giờ giữ (ly_do_huy 'quá giờ giữ hàng') và hủy do khách.
- Máy đếm thêm:
  - món bán chạy (lấy theoSanPham, lọc theo buổi);
  - món hỏi nhiều mà ít chốt (từ 5 câu hỏi và tỷ lệ chốt trên câu hỏi dưới 20%);
  - số câu hỏi chưa ai trả lời (nhãn cau_hoi, xu_ly 'moi');
  - chi phí AI của buổi.
  - Có dữ liệu của BH5 (bấm thẻ, nhắc) thì thêm cột tương ứng.
- So với trung bình 5 buổi trước, chỉ khi đã có đủ 5 buổi thật.
- Gợi ý AI (agent mới tong_ket, không có công cụ):
  - đầu vào chỉ là số liệu gộp theo “số + tên món”, không có tên, số điện thoại hay nguyên văn bình luận;
  - đầu ra {goi_y:[{viec, vi_sao}]}, tối đa 3 mục;
  - kiểm: mọi con số trong gợi ý phải có trong số liệu đầu vào (soKhongCoTrongNguon); cấm gợi ý đối xử khác theo vùng miền, giới tính; cấm tạo khan hiếm giả hay giảm giá giả;
  - không tự sắp lại kịch bản.
- Gợi ý chỉ viết khi buổi có từ 5 người chốt trở lên. Tự viết lần đầu khi mở trang sau 6 giờ kể từ lúc live kết thúc (số trả lời, xác nhận đã gần đủ); trước đó có nút “Viết gợi ý ngay”; có nút “Viết lại”. Lưu vào phien_live.tong_ket.
- Hàm đếm người chốt dùng chung với P14 bước 1.

**Tiêu chí:**
- [ ] Bộ dữ liệu buổi giả (40 chốt, 30 trả lời, 22 xác nhận, 18 gửi, 15 giao, 2 hoàn, 6 hủy vì quá giờ, 2 khách hủy): trang Tổng kết hiện đúng từng số, khớp đếm trực tiếp trong CSDL (test).
- [ ] Dữ liệu gửi cho AI không chứa tên, số điện thoại hay nguyên văn bình luận (test kiểm nội dung gửi nhà cung cấp giả).
- [ ] AI giả trả gợi ý có số 35% không có trong đầu vào: bị loại. Trả 5 gợi ý: chỉ giữ 3.
- [ ] Buổi 3 người chốt: không gọi AI, hiện “Ít dữ liệu, chưa gợi ý”.
- [ ] Chưa đủ 5 buổi thật: không hiện so sánh.

**Tệp sửa:** `server/nghiep-vu/bao-cao.js (tongKetPhien, demNguoiChot, phễu)`, `server/agent/agents/tong-ket.js (mới)`, `server/api/bao-cao.js (GET /bao-cao/phien/:id/tong-ket, POST …/goi-y)`, `public/js/man-hinh/bao-cao.js`, `server/cau-hinh/loi-dan-mau.json (tong_ket)`, `server/db/nang-cap/0NN-truoc-sau-live.sql`

**Dữ liệu:** Tệp nâng cấp chung: phien_live thêm cột tong_ket TEXT (JSON {luc, so_lieu, goi_y, run_id}), để lưu gợi ý đã viết mà không gọi AI lại. INSERT agent tong_ket (openai gpt-6-luna, suy nghĩ tắt, dự phòng gemini-3.5-flash-lite).

**Cấu hình, câu mẫu, Skill, Hook:** Lời dặn tong_ket: chỉ dựa vào số liệu, mỗi gợi ý có “vì sao” kèm số, không kết luận khi ít dữ liệu, không sắp kịch bản. Các ngưỡng là hằng số trong mã.

**Giả lập Facebook:** Không. Dữ liệu tạo bằng hàm test, hoặc bằng buổi tập có khách giả kịch bản.

**Test:**
- test/tong-ket.test.js (mới)
- test/bao-cao.test.js (nếu có; không thì trong tong-ket.test.js: khớp đếm trực tiếp)

**Claude Code làm thay:** Claude Code viết lời dặn và “đáp án mẫu” (2 bộ gợi ý tốt, 2 bộ sai luật). Dựng bộ dữ liệu buổi giả. Đọc trang tổng kết trên bản xem thử và tự chấm độ đúng, độ dễ hiểu của gợi ý, thay cho dùng model chấm.

**Thử AI thật:** Có. 2 lần gpt-6-luna (OpenAI) trên buổi tập của bản xem thử, ước 0,002 USD.

**Phụ thuộc:** Phụ thuộc F-58 đã có. Phễu đầy đủ hơn khi có dữ liệu BH5 (P22 bấm thẻ, P06 nhắc) và P27 (phan_hoi_mac).

**Rủi ro:** - Ít dữ liệu dễ kết luận vội: có ngưỡng 5 người chốt và cần 5 buổi mới so sánh.
- Nếu miền dữ liệu diễn tập lẫn vào buổi thật thì số sai; có test dien_tap.

**Mặc định tự chọn:** - gpt-6-luna: 0,10 / 0,50 USD cho 1 triệu token, theo kiem-9.
- Từ 5 người chốt mới gợi ý.
- Viết sau 6 giờ khi mở trang: không cần đồng hồ nền, chỉ tốn tiền khi có người xem.
- Món “hỏi nhiều ít chốt”: từ 5 câu hỏi và tỷ lệ chốt dưới 20%.

### Mốc từng món trong video live để tự cắt Reels (bản đơn giản)

*Đề xuất: P08 · công sức: nho*

- Trang “Tổng kết buổi” thêm khối “Mốc từng món”. Hàm mocTungMon(phienId) trong bao-cao.js lấy dữ liệu từ dong_thoi_gian_san_pham:
  - từng món có giây bắt đầu và kết thúc trong video, tính bằng tu_luc trừ mốc gốc; mốc gốc là fb_bat_dau (creation_time), chưa có thì dùng bat_dau và ghi “±30 giây”;
  - số người chốt trong đoạn;
  - đoạn gợi ý cắt: 45 giây đầu tiên trong đoạn không có tên khách. Vùng có tên = từ lúc nhận chốt tới 40 giây sau (30 giây chờ đọc tên của chot-don.js, cộng 6,2 giây Thanh chữ hiện tên). Không tìm được thì ghi “cắt khung chỉ lấy camera hoặc Màn hình sản phẩm, bỏ tiếng đoạn đọc tên”.
- Chú thích do máy điền, không AI, không ghi giá: “{ten_sp} · số {so} · bình luận “chốt {so} + màu + size” ở buổi live tới · Live {lich_ke}”. Buổi có giọng AI (chế độ nói, Mai dẫn, Đội AI) thì thêm “ · Có giọng trợ lý AI”. Mỗi dòng có nút “Chép”.
- Hộp nhắc:
  - video live tự xóa sau 30 ngày (còn N ngày): bấm “Hoãn xóa 6 tháng”;
  - clip có người mẫu phải có giấy đồng ý đăng lại;
  - đăng clip có giọng AI thì bật nhãn AI info;
  - không cắt đoạn có giá đã hết hiệu lực.
- MOZA không tự cắt, không tự đăng.
- P03 (bình luận “mục lục” trên video xem lại) dùng lại hàm này.

**Tiêu chí:**
- [ ] Buổi giả có 3 đoạn món, bat_dau gốc biết trước: mốc hh:mm:ss đúng tới từng giây (test).
- [ ] Có chốt lúc 00:05:10: đoạn gợi ý không giao với 00:05:10–00:05:50 (test).
- [ ] Chú thích không chứa số tiền, có cú pháp chốt đúng số món (test quét).
- [ ] Buổi chỉ gợi ý (không giọng AI): chú thích không có dòng giọng AI.
- [ ] Hộp nhắc hiện đúng số ngày còn lại tới mốc 30 ngày.

**Tệp sửa:** `server/nghiep-vu/bao-cao.js (mocTungMon)`, `server/api/bao-cao.js (GET /bao-cao/phien/:id/moc)`, `public/js/man-hinh/bao-cao.js`, `server/cau-hinh/cau-mau-khach.json (chú thích, nhắc)`

**Dữ liệu:** Không thêm gì ngoài cột fb_bat_dau (nền, hoặc tính năng Lịch live nếu BH5 chưa làm).

**Cấu hình, câu mẫu, Skill, Hook:** Câu mẫu chú thích và nhắc. Không thêm ô.

**Giả lập Facebook:** Live giả trả bat_dau (creation_time) sớm hơn lúc MOZA nhận ra 20 giây, để test dùng đúng mốc Facebook.

**Test:**
- test/moc-video.test.js (mới)

**Claude Code làm thay:** Claude Code viết câu mẫu chú thích và nhắc. Tra lại trang trợ giúp Meta về nút hoãn xóa video live và nhãn AI info, ghi ngày tra. Tự mở trang trên bản xem thử để kiểm mốc.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc cột fb_bat_dau (việc nền BH5 hoặc tính năng Lịch live) và trang Tổng kết (P32). P03 dùng lại hàm.

**Rủi ro:** - Người dẫn quên chuyển đoạn trong chế độ Chỉ gợi ý thì mốc sai món.
- Mốc lệch vài giây vì độ trễ phát.
- Pháp lý nằm ở phần chủ shop tự đăng (Luật Quảng cáo Điều 8): có nhắc, luật sư xem.

**Mặc định tự chọn:** - Đoạn 45 giây: đủ cho một Reels ngắn.
- Tránh 40 giây sau mỗi lần chốt: đủ thời gian đọc tên cộng Thanh chữ.
- Không ghi giá trong chú thích (kiem-7).
- Chú thích máy điền thay AI, để 0 đồng và không bịa.

### Khách mặc thật: ảnh khách tự gửi, xin phép bằng nút, rút lại được, che mặt (TẮT mặc định)

*Đề xuất: P28 · công sức: vua*

- Công tắc trong Cài đặt → Bán hàng “Dùng ảnh khách mặc thật”, mặc định TẮT; chỉ bật sau khi luật sư duyệt câu xin phép. Tắt thì MOZA không xin phép, không lưu ảnh.
- Khi bật: khách tự gửi ảnh trong Messenger, trong hội thoại có đơn Đã gửi hoặc Đã giao trong 30 ngày → máy gửi thẻ câu mẫu (mọi ảnh gửi trong 2 phút gom thành một lần hỏi): “Ảnh đẹp quá! Shop xin phép dùng ảnh này (đã che mặt, không kèm tên) trên live và clip của shop được không? Nhắn “gỡ ảnh” bất cứ lúc nào là shop gỡ.” [Đồng ý] [Không].
- Lưu nguyên văn câu xin phép và giờ bấm.
- Bấm Đồng ý thì tải ảnh về máy ngay, vì anh_url có hạn; dùng lại taiAnhKhach của tim-mau.js. Ảnh lưu ở data/anh-khach/; ảnh ở trạng thái chờ duyệt.
- Màn hình duyệt ảnh mới:
  - che mặt mặc định bằng làm mờ phần trên 35% ảnh, có một thanh kéo chỉnh 0–60%; ảnh đã che dựng bằng canvas trên trình duyệt, tệp gốc bị xóa;
  - chọn món: lấy từ đơn nếu đơn chỉ có một món;
  - nút “Duyệt (ảnh người lớn, đã che mặt)”.
- Không gửi ảnh khách cho AI. Không nhận diện khuôn mặt. Không sửa ảnh bằng AI. Không kèm số đo.
- Màn hình sản phẩm thêm mẫu 'khach_mac': tối đa 4 ảnh đã duyệt của món, ghi “Khách thật · mặc size {co}”. Gọi lên bằng lệnh “Mai ơi chiếu ảnh khách mặc áo 12” (docLenh), hoặc ô man_hinh của Director khi có bình luận hỏi “có ảnh thật không”.
- Khách nhắn “gỡ ảnh”: ảnh bị gỡ khỏi màn hình ngay, tệp bị xóa, ghi go_luc, trả câu mẫu. Khi xóa dữ liệu người đó cũng xóa ảnh.

**Tiêu chí:**
- [ ] Công tắc tắt: khách gửi ảnh thì không có tin xin phép, không lưu tệp (test).
- [ ] Công tắc bật: bấm Đồng ý thì tệp được lưu, ảnh ở trạng thái chờ duyệt; ảnh chưa duyệt không bao giờ lên màn hình (test).
- [ ] “gỡ ảnh”: tệp bị xóa, mẫu khach_mac không còn ảnh đó, khách nhận câu mẫu (test).
- [ ] Không có lời gọi nhà cung cấp AI nào chứa ảnh khách (test).
- [ ] Ảnh lỗi hoặc hết hạn khi tải: báo lỗi, không chờ duyệt ảnh hỏng.

**Tệp sửa:** `server/nghiep-vu/anh-khach.js (mới)`, `server/api/anh-khach.js (mới: danh sách chờ duyệt, duyệt kèm ảnh đã che, gỡ)`, `server/hop-thu.js (khách gửi ảnh → xin phép; nút ANH_DONG_Y / ANH_KHONG; “gỡ ảnh”)`, `server/agent/hook/phan-loai-tin.js (nhãn go_anh)`, `server/man-hinh-san-pham.js (MAU thêm 'khach_mac', docLenh)`, `public/man-hinh-san-pham.html, public/js/man-hinh-san-pham.js`, `public/js/man-hinh/anh-khach.js (mới: màn duyệt, che mặt bằng canvas)`, `server/nghiep-vu/khach.js (xoaDuLieu xóa ảnh)`, `server/nghiep-vu/cai-dat.js (dung_anh_khach)`, `server/cau-hinh/cau-mau-khach.json`

**Dữ liệu:** Tệp nâng cấp chung: bảng mới anh_khach (id, nguoi_fb_id, khach_id, don_id, san_pham_id, co, tin_nhan_id, tep, cau_xin_phep, dong_y_luc, tin_dong_y_id, che_mat, duyet_luc, go_luc, dien_tap, tao_luc). Lý do: ảnh khách là dữ liệu cá nhân, phải có bằng chứng đồng ý, người duyệt và gỡ được. Tệp ở data/anh-khach/, nằm trong bản Sao lưu.

**Cấu hình, câu mẫu, Skill, Hook:** Công tắc dung_anh_khach (mặc định false). Câu xin phép, câu gỡ ảnh, cả hai chờ luật sư duyệt.

**Giả lập Facebook:** - khachNhan có ảnh đã có sẵn (tiền tố 'tam:').
- Thêm cờ giả “ảnh hết hạn” để test đường tải lỗi.
- Khách giả kịch bản: gửi ảnh rồi Đồng ý; gửi ảnh rồi gõ “gỡ ảnh”.

**Test:**
- test/anh-khach.test.js (mới)
- test/man-hinh-san-pham.test.js (mẫu khach_mac, lệnh bằng lời)

**Claude Code làm thay:** Claude Code viết câu xin phép và nháp giấy đồng ý dùng ảnh cho luật sư (Luật Quảng cáo Điều 8, Bộ luật Dân sự Điều 32, Luật 91/2025). Tự lái bản xem thử: gửi ảnh giả, duyệt, chiếu lên màn hình, gỡ ảnh, chụp màn hình.

**Thử AI thật:** không

**Phụ thuộc:** Phụ thuộc hỏi thăm sau gửi (P27), vì khách thường gửi ảnh sau khi được hỏi thăm; phần nền; màn hình sản phẩm #90. Luật sư duyệt trước khi bật.

**Rủi ro:** Rủi ro pháp lý rõ nhất nhóm (kiem-7):
- quyền hình ảnh, dữ liệu cá nhân;
- ảnh có trẻ em: người duyệt phải tự xác nhận;
- làm mờ theo vùng có thể không che hết mặt: người duyệt chỉnh thanh kéo, không duyệt nếu còn lộ mặt.

**Mặc định tự chọn:** - TẮT mặc định, theo lệnh duyệt.
- Làm mờ 35% phía trên ảnh (ảnh mặc đồ thường chụp từ đầu tới gối).
- Tối đa 4 ảnh mỗi món.
- Chỉ xin phép với ảnh gửi trong 30 ngày sau đơn.
- Không kèm số đo, để tránh câu hỏi dữ liệu nhạy cảm (NĐ 356/2025).

---

## BH9 — Thử nghiệm AI (báo chi phí trước khi chạy thật): P15 bản đầy đủ (kiểm lời Mai trên sóng, đính chính, giữ giá có lợi cho khách) + P38 (MOZA nhìn qua OBS, chỉ gợi ý chuyển món) + ghi sổ Để sau / Không làm

**Định nghĩa xong:** - `npm test` đạt toàn bộ: 537 test cũ, 78 ca K1–K10 sau khi tách hàm dùng chung, và test mới của cả ba tính năng. Toàn bộ chạy bằng miệng giả, OBS giả, Camera giả, Facebook giả, AI giả; không gọi mạng.
- Bản xem thử có ảnh chụp: Thanh chữ hiện dòng đính chính, băng đỏ trên Màn hình người dẫn, đơn có nhãn "Mai nói nhầm giá" đã hạ giá, ô gợi ý "Đang cầm áo 7?" bấm được và chuyển đúng đoạn.
- Phép thử AI thật: hoặc đã chạy sau khi chủ dự án đồng ý và ghi đủ số liệu (tỷ lệ đúng, báo nhầm, độ trễ, chi phí theo hãng), hoặc ghi rõ "chủ dự án chưa duyệt, hoãn". Tổng OpenAI của BH9 dưới 0,25 USD, Google khoảng 0,15 USD, nằm trong ngân sách dưới 1 USD của cả đợt.
- SPEC.md đã cập nhật: nhật ký sửa, quyết định, tính năng mới, dữ liệu, sổ Để sau / Không làm kèm điều kiện mở lại, ngày tra công nghệ.
- Có commit và tag `bh9-thu-nghiem-ai`.
- Có danh sách việc cho chủ dự án (luật sư, giấy đồng ý, OBS cho bước B).
- Không thêm thư viện nào. SQL chỉ nằm trong server/nghiep-vu/ và server/db/. Mọi con số AI nói ra đều qua Bộ kiểm tra, hook kiểm lời, hoặc câu mẫu máy điền.

**Thứ tự:**
- 1. Tra lại công nghệ mới nhất (Claude Code, 0 USD), ghi ngày tra vào SPEC mục 6: GPT Live 1 (lệnh dừng câu, chữ chép về trước hay sau tiếng, đã nhận ảnh chưa), Gemini 3.8 Live (cách ngắt, chữ chép đầu ra), obs-websocket GetSourceScreenshot, gpt-6-luna (token của ảnh, detail, lưu đệm có tính ảnh không). Có gì đổi phương pháp thì dừng lại hỏi chủ dự án.
- 2. Sửa SPEC trước khi code (luật dự án): quyết định mới #9x (P15 bản đầy đủ thay phần A.5 để dành; giữ giá có lợi cho khách; P38 thay #82 / F-64), tính năng F-xx mới (đánh số lúc code, tiếp sau các mốc trước), mục 7 hai bảng mới, mục 8 nút và mã lỗi MIENG_NOI_SAI, A.6 bỏ chuyen_san_pham, và sổ Để sau / Không làm (tính năng 4).
- 3. Tính năng 1 (kiểm lời Mai và đính chính) cùng miệng giả: lớn nhất, 0 USD, là nền cho tính năng 2. Bắt đầu bằng câu mẫu và test của kiemSoNoi, rồi hook truoc_phat, rồi đính chính trong miệng.
- 4. Tính năng 2 (đơn chốt lúc Mai nói nhầm giá): cần bảng lỗi và khoảng nói nhầm của tính năng 1. Đụng tiền nên làm sau khi phần kiểm đã chắc, có test bất biến tổng tiền.
- 5. Tính năng 3 (MOZA nhìn): độc lập, làm sau vì phải chuyển và mở rộng OBS giả trong test.
- 6. Chạy npm test toàn bộ (TEMP/TMP = data\tam-test, Node 26). Kiểm cổng 5190/5173 còn trống, rồi lái bản xem thử bằng miệng giả và Camera giả, chụp màn hình Thanh chữ, băng đỏ, ô gợi ý.
- 7. Dừng lại, báo chủ dự án chi phí thử thật (OpenAI tối đa 0,25 USD, Google khoảng 0,15 USD) và chờ đồng ý. Đây là tên mốc: báo chi phí trước khi chạy thật.
- 8. Thử thật theo thứ tự rẻ trước: (a) P38 trên khung dựng sẵn, luna, khoảng 0,05 USD; (b) P15 với Gemini 3.8 Live 6 phút, khoảng 0,15 USD tiền Google; (c) P15 với GPT Live 1 3 phút, khoảng 0,15–0,20 USD, chỉ khi ngân sách OpenAI còn đủ. Ghi bản chép lời thành dữ liệu test.
- 9. Ghi kết quả và chi phí vào SPEC mục 12, commit, tag `bh9-thu-nghiem-ai`, dừng để chủ dự án duyệt.

**Chi phí thử thật:** Mọi phép thử chỉ chạy sau khi chủ dự án đồng ý. Trong lúc thử, mức trần giờ tạm ở bản xem thử là 0,5 USD và script có trần riêng.
- OpenAI: tối đa khoảng 0,25 USD. P38 dùng gpt-6-luna khoảng 0,05 USD (100 lần gọi; bước B tùy chọn thêm 0,02–0,05). P15 dùng GPT Live 1 trong 3 phút, khoảng 0,15–0,20 USD. Nếu ngân sách OpenAI còn lại của cả đợt dưới 0,25 USD thì bỏ phần GPT Live 1.
- Google: khoảng 0,15 USD cho Gemini 3.8 Live chạy 6 phút. Đây là giá khuyến mãi tới 31/12/2026, từ 1/1/2027 gấp đôi. Không tốn lượt giọng TTS vì câu hỏi gõ vào ô Hỏi Mai.
- Anthropic: 0 USD. Claude Code làm các việc soạn câu mẫu, chấm kết quả, dựng khung thử.
- Tổng khoảng 0,40 USD.
- Khi dùng thật sau này: P15 tốn 0 đồng (dùng chữ chép sẵn có). P38 ước 0,05–0,3 USD mỗi giờ bật (ước tính, chưa đo).

**Ghi chú khi đọc mã:** PHÁT HIỆN KHI ĐỌC MÃ
- Chữ chép lời Mai đã có sẵn. mieng.js nhận chữ ở `nhanChuMai` (dòng 555) nhưng chỉ đưa lên màn hình, chưa kiểm. Tiếng Mai được gửi thẳng ra trình duyệt ngay khi tới (`nhanAm`, dòng 521–540). Vì vậy đây là đính chính sau khi đã nói sai, không phải chặn trước (khớp phiếu kiem-8).
- Cửa hook `truoc_phat` và mã lỗi `MIENG_NOI_SAI` đã có tên nhưng đang để dành (cua.js dòng 18; SPEC-TD mục 8). BH9 dùng lại, nên không phải tạo cơ chế mới, và chủ shop tắt được ở Agent & Skill → Hook.
- `kiemTraCau` (K3) đòi trích dẫn, nên không đưa lời Mai vào thẳng được. Phần K9 và `boGoiSo` thì dùng lại được. `sp.sanPhamDuocNhac` chỉ nhận chữ số, nên phải đổi "áo số mười hai" thành số trước.
- `MiengGemini.hoi` giữ câu lại khi Mai đang nói (#81), nên phải có hàm `dinhChinh` riêng để cắt ngang. GPT Live 1 không có lệnh dừng câu (gpt-live.js dòng 9).
- test/du-lieu/goi-gpt-live-*.json chỉ có mốc thời gian của gói tiếng, không có chữ chép. Buổi thử thật cần ghi lại chữ chép để làm dữ liệu test.
- `phien_live.do_tre_giay` (mặc định 15) đã có sẵn, dùng để tính khoảng nói nhầm.
- `don_dong.don_gia` được chụp trong `giuTrong`; chưa có hàm nào đổi đơn giá, nên phải viết hàm mới chỉ cho phép hạ giá.
- Thanh chữ (thanh-chu.html) hiện tên người chốt, nên khung gửi AI phải lấy từ nguồn camera, không lấy cảnh đang phát.
- `KetNoiObs.yeuCau` gửi được mọi lệnh, nên GetSourceScreenshot không cần thư viện. OBS giả hiện nằm riêng trong man-hinh-san-pham.test.js.
- openai.js chưa gửi `detail` cho ảnh.
- Agent có `nang_cap` rỗng thì runtime không nâng lên Claude, nên nhin_mon an toàn về chi phí.
- Ước của báo cáo là buổi thử P15 30 phút: với GPT Live 1 tốn 1,5 USD, vượt ngân sách OpenAI. Đã rút còn 3 phút; phép thử chính chuyển sang Gemini.

XUNG ĐỘT VÀ PHỤ THUỘC VỚI MỐC KHÁC
- "P15 phần rẻ" (nhật ký buổi live, luật "Mai không tự nói con số") nên xong trước; có thì BH9 ghi thêm dòng đính chính vào nhật ký đó.
- P34a (giá gạch có bằng chứng) và 6.1 B (giá live): kiemSoNoi phải gọi đúng hàm giá bán mà giuTrong và thẻ đơn dùng. Nên tách thành một hàm "giá bán lúc này" dùng chung, nếu mốc 6.1 B chưa tách.
- K11 từ cấm (P34): có thể chạy thêm trên lời Mai, chỉ báo cho người dẫn. Không bắt buộc.
- P35 (nhãn "Trợ lý AI") và BH9 cùng sửa thanh-chu.html: phải chia chỗ.
- P22 và #89 (thẻ đơn), P06 (Hook giới hạn liên hệ): thẻ gửi lại khi hạ giá phải theo mã và luật mới nhất của các mốc đó.
- P42 (tách Dừng AI / Dừng mọi thứ): vòng nhìn của P38 phải dừng khi "Dừng AI".
- P11, P12, P16 cũng dùng thẻ hoặc ô gợi ý trên Màn hình người dẫn: giữ luật mỗi lúc một gợi ý.
- P26 có thể cũng tạo bảng đánh dấu đơn: dùng chung `don_danh_dau`.
- Việc nền "cập nhật gia-model.json" (Gemini 3.8 Live gấp đôi giá từ 1/1/2027, thêm giá phần hình) thuộc mốc khác. Chi phí thử của BH9 tính theo giá hiện tại.
- P44 không thuộc BH9, nhưng giúp đường dự phòng "Mai ơi áo 7" nghe đúng hơn.
- #82 và F-64 bị thay, A.6 bỏ `chuyen_san_pham`: phải sửa SPEC ở mục 2, 3, 8 và A.6.
- Số tệp nâng cấp (0xx) và số F / # lấy lúc code, theo thứ tự các mốc trước. Mục 7 "Không nên làm" không có gì bị đưa vào BH9.

CẦN HỎI CHỦ DỰ ÁN
1. Mặc định "Bán theo giá Mai nói" (tự hạ giá, có nút hoàn lại) có được không? Việc này đụng tiền thật. Khuyến nghị: được; nhờ luật sư hoặc kế toán xem trước khi live thật.
2. Duyệt chi phí thử thật (OpenAI tối đa 0,25 USD, Google khoảng 0,15 USD) trước khi Claude Code chạy.
3. Bước B của P38 cần cài OBS và nối camera điện thoại. Anh/chị có muốn làm không? Giấy đồng ý của người lên hình phải ghi thêm việc gửi khung hình sang OpenAI ở nước ngoài; luật sư xem thêm câu hỏi này (Điều 20).
4. Mai đính chính bằng chính giọng của mình. Miệng AI có thể diễn đạt lại, nên con số chuẩn nằm trên Thanh chữ. Cách này có được không, hay muốn đọc bằng giọng máy đúng từng chữ (tốn lượt giọng Google)?
5. Bảng lỗi nói trên sóng lưu bao lâu: gộp vào câu hỏi luật sư về nhật ký buổi live.
- Chế độ mặc định vẫn nên là "Chỉ gợi ý" sau BH9, tới khi có số liệu buổi live thật.

### Kiểm lời Mai trên sóng và tự đính chính

*Đề xuất: P15 · công sức: lon*

- Chỉ chạy khi miệng Live đang mở (chế độ "Mai nói" và "Mai dẫn chính"). Dùng bản chép lời đầu ra có sẵn của miệng, đã nối sẵn vào `MiengCuaMai.nhanChuMai` (mieng.js dòng 555): GPT Live 1 `session.output_transcript.delta` (gpt-live.js dòng 99), Gemini 3.8 Live `outputTranscription` (gemini-live.js dòng 156). Không gọi thêm AI, chạy thật tốn 0 đồng.
- Bật cửa hook `truoc_phat` đang để dành trong `server/agent/hook/cua.js` ("Miệng nói xong một câu"). Thêm hook mới `kiem-loi-noi`, không bắt buộc, mặc định bật. Chủ shop tắt được ở Agent & Skill → Hook, không thêm ô Cài đặt. Nhật ký hook tự ghi. Dùng lại mã lỗi `MIENG_NOI_SAI` đang để dành của SPEC-TD, định nghĩa lại là "Mai nói số sai → đính chính".
- Có cách kiểm riêng `kiemSoNoi(cau, {phienId, soDangNoi})`, không đòi trích dẫn như K3.
  - Tìm món được nhắc: theo số, theo tên, và cả số đọc bằng chữ ("áo số mười hai"), vì `sp.sanPhamDuocNhac` hiện chỉ nhận chữ số. Câu không nhắc món thì lấy món của đoạn đang nói.
  - So số tiền với giá bán lúc này của món (giá mẫu, giá riêng từng phân loại). Cho qua các số: n × giá (n ≤ 5), giá + phí ship, phí ship, mức miễn ship (lấy từ `dongCaiDat`), giá gốc hợp lệ (theo hàm của P34a nếu đã có), giá live (theo hàm của 6.1 B nếu đã có).
  - Câu "còn N" và các chữ "sắp hết / chỉ còn": dùng lại luật K9. Tách phần K9 và `boGoiSo` trong kiem-tra.js thành hàm dùng chung.
  - Bỏ qua: cm, kg, số không đơn vị từ 0 tới 10 (`mienK3`), số của sản phẩm, giờ.
- Có hai mức:
  - "Chắc sai": món rõ và con số khác mọi giá trị hợp lệ → tự đính chính.
  - "Nghi sai": không rõ món, hoặc số có thể là tổng tiền → chỉ hiện băng vàng cho người dẫn.
- Kiểm theo từng mẩu chữ, nhưng chỉ xét con số đã trọn: sau số đã có chữ khác, hoặc đã lặng 600 ms. Như vậy số bị cắt giữa hai mẩu ("159." + "000đ") không bị báo sai.
- Các bước đính chính:
  - (1) Bỏ phần tiếng còn lại của câu sai. Làm như DỪNG AI: đặt `m.chan`, phát sự kiện `live.mai_ngat`.
  - (2) Thanh chữ hiện dòng đính chính 12 giây, do máy điền. Sự kiện mới `mhsp.dinh_chinh`, ví dụ: "Đính chính: Áo 12 · Đen/M · 159.000đ".
  - (3) Miệng nói câu mẫu "Mai xin nói lại cho đúng: áo số 12 giá 159.000đ". Mỗi miệng có hàm mới `dinhChinh(chu)`. Gemini gửi ngay kèm `turnComplete: true`, bỏ qua hàng chờ của #81: cố ý cắt ngang câu sai. GPT Live 1 dùng `session.commentary.append`, vì chưa có lệnh dừng câu (tra lại lúc code).
  - (4) Màn hình người dẫn hiện băng đỏ (sự kiện `live.dinh_chinh`), ví dụ "Mai vừa nói 150.000đ cho áo 12, giá đúng 159.000đ. Đã đính chính".
- Câu đính chính cũng được kiểm. Nếu vẫn sai thì không đính chính tiếp: hạ về "Chỉ gợi ý" (dùng `haVeGoiY`) và báo đỏ. Có 3 lỗi "chắc sai" trong một buổi cũng hạ về "Chỉ gợi ý".
- Chống lặp: mỗi cặp (món, loại lỗi) đính chính tối đa 1 lần trong 60 giây.
- Mỗi lỗi được ghi lại: câu Mai nói (dạng chữ), loại lỗi, số đã nói, số đúng, lúc nói, lúc đính chính. Nếu mốc "P15 phần rẻ" đã có nhật ký buổi live thì ghi thêm dòng "đính chính" vào đó.
- Giữ tiếng lại X ms để kịp chặn: mặc định 0 (tắt). Chỉ bật (tối đa 500 ms) khi phép thử thật cho thấy chữ về trước tiếng từ 300 ms trở lên.
- Miệng giả `mieng-gia` (mới):
  - Chỉ chọn được trong buổi tập. Chọn cho phiên thật thì báo lỗi.
  - Câu trả lời do máy soạn từ dữ liệu sản phẩm. Khi người dẫn bảo "đọc giúp …" thì nói lại y nguyên, để tập nói nhầm.
  - Phát chữ theo nhịp nói, kèm tiếng rất nhỏ để máy biết "Mai đang nói".
- Kịch bản diễn tập mới "Mai nói nhầm số", có biến mới {gia_sai} (giá − 10.000đ) và {con_sai} (còn + 3), thêm ở `DienTap.dienMau`.
- Không làm: so từng câu trước khi phát (A.5 của SPEC-TD vẫn để dành); kiểm Đội AI (Đội AI đã đi qua Co-host và Bộ kiểm tra có trích dẫn).

**Tiêu chí:**
- [ ] Test `kiemSoNoi` với ít nhất 60 câu mẫu lời Mai có đáp án: bắt đúng 100% câu sai giá, sai số còn, sai phí ship có món rõ (mức "chắc"); 0 câu đúng bị báo sai. Bộ câu có số đọc bằng chữ ("một trăm năm mươi chín nghìn", "trăm năm chín", "159k"), giá riêng phân loại, "2 cái 318k", giá + ship, số đo khách nói, "áo số mười hai".
- [ ] Test với miệng giả GPT và Gemini, đồng hồ giả: câu sai → trong 3 giây có đủ `live.dinh_chinh`, `mhsp.dinh_chinh`, miệng nhận câu đính chính (Gemini: `turnComplete: true`, không vào hàng chờ #81) và tiếng còn lại của câu sai bị bỏ. Câu đúng: không có sự kiện nào.
- [ ] Câu đính chính sai lần nữa → hạ về "Chỉ gợi ý" và có báo đỏ; 3 lỗi "chắc" trong một buổi → hạ về "Chỉ gợi ý"; cùng một lỗi lặp lại trong 60 giây → đính chính một lần.
- [ ] Chữ về từng mẩu, cắt giữa con số → không báo nhầm.
- [ ] Tắt hook ở Agent & Skill → không kiểm, không đính chính (test).
- [ ] Miệng giả: chọn cho phiên thật → lỗi rõ; chọn cho buổi tập → chạy.
- [ ] Bản xem thử, miệng giả, kịch bản "Mai nói nhầm số": Thanh chữ hiện dòng đính chính, Màn hình người dẫn hiện băng đỏ. Claude Code chụp màn hình để làm bằng chứng.
- [ ] Phép thử thật (sau khi chủ dự án đồng ý chi phí) có số liệu ghi vào SPEC mục 12: chữ về sớm hay trễ so với tiếng, tỷ lệ bắt đúng, số lần báo nhầm, Mai có nói đúng câu đính chính không, chi phí.
- [ ] `npm test` đạt hết, gồm 78 ca K1–K10 cũ sau khi tách hàm dùng chung.

**Tệp sửa:** `server/agent/kiem-tra/kiem-so-noi.js (mới)`, `server/agent/kiem-tra/kiem-tra.js (xuất boGoiSo, tách K9 thành hàm dùng chung)`, `server/agent/kiem-tra/quy-doi-so.js (cách đọc giá kiểu nói nếu còn thiếu: "trăm rưỡi", "trăm năm chín", "hai trăm tư")`, `server/agent/hook/kiem-loi-noi.js (mới, cửa truoc_phat)`, `server/agent/hook/cua.js (đăng ký hook, sửa ghi chú cửa truoc_phat)`, `server/agent/mieng/kiem-loi-noi.js (mới: gom chữ theo câu, chống lặp, đếm lỗi, gọi đính chính)`, `server/agent/mieng/mieng.js (nhanChuMai → kiểm; dinhChinh; NHA_MIENG thêm miệng giả)`, `server/agent/mieng/gemini-live.js (dinhChinh)`, `server/agent/mieng/gpt-live.js (dinhChinh)`, `server/agent/mieng/mieng-gia.js (mới)`, `server/nghiep-vu/loi-noi.js (mới, có SQL)`, `server/nghiep-vu/live.js hoặc server/api/live.js (chặn miệng giả ở phiên thật)`, `server/cau-hinh/mac-dinh.json`, `server/cau-hinh/loi-dan-mau.json + loi-dan-mau-cu.json`, `server/cau-hinh/kich-ban-dien-tap.json`, `server/dien-tap.js`, `public/thanh-chu.html`, `public/js/man-hinh/nguoi-dan.js`, `server/db/nang-cap/0xx-thu-nghiem-ai.sql (mới)`, `test/kiem-so-noi.test.js (mới)`, `test/du-lieu/loi-mai-mau.json (mới)`, `test/mieng.test.js`, `test/hook.test.js`, `SPEC.md`

**Dữ liệu:** Bảng mới `loi_noi_song`, gồm các cột: id, phien_live_id, luc, cau (tối đa 300 ký tự), loai ∈ {gia, con, ship, khan_hiem}, muc ∈ {chac, nghi}, san_pham_id, phan_loai_id NULL, gia_tri_noi, gia_tri_dung, dinh_chinh_luc, het_khoang_luc, model, dien_tap. Có ba lý do: làm bằng chứng đã đính chính (Luật TMĐT Điều 24 khoản 7), làm căn cứ đánh dấu đơn ở tính năng 2, và để báo cáo buổi. Bảng chỉ lưu chữ, không lưu tiếng; thời hạn lưu chờ luật sư. Tệp nâng cấp tên gợi ý `0xx-thu-nghiem-ai.sql`: số kế tiếp lúc code, dự kiến 018 nếu các mốc trước chưa thêm tệp, dùng chung với tính năng 2 và 3.

**Cấu hình, câu mẫu, Skill, Hook:** - mac-dinh.json thêm khóa `kiem_loi_noi` gồm {tu_dinh_chinh: true, nguong_ha_goi_y: 3, lap_lai_giay: 60, giu_tieng_ms: 0, hien_thanh_chu_giay: 12, cho_so_tron_ms: 600}. Không có ô nào trên giao diện; tắt cả tính năng bằng hook.
- Danh sách `mieng` thêm {model: "mieng-gia", ten: "Miệng giả (tập, không tốn tiền)", nha: "gia", chi_dien_tap: true}.
- Câu mẫu đính chính (Mai nói và Thanh chữ) do máy điền, đặt trong mac-dinh.json.
- Lời dặn `mieng` và `mieng_dan` thêm một câu: "MOZA báo đính chính thì nói đúng câu MOZA đưa, giữ nguyên con số". Lưu bản cũ vào loi-dan-mau-cu.json để cơ chế tự nâng mẫu chạy.
- Kịch bản diễn tập "noi-nham-so".
- Hook mới `kiem-loi-noi`. Không Skill mới, không công cụ AI mới.

**Giả lập Facebook:** Không cần thêm. Kịch bản tập dùng Facebook giả và bước `hoi_mai` có sẵn. Thứ cần giả lập là miệng giả (mieng-gia.js), dùng cho cả test lẫn bản xem thử.

**Test:**
- test/kiem-so-noi.test.js: ít nhất 60 câu mẫu, hai mức chắc / nghi, đọc số bằng chữ, món theo đoạn đang nói, giá phân loại riêng, bội số và giá + ship, bỏ qua cm/kg
- test/mieng.test.js: miệng giả GPT và Gemini đính chính (sự kiện, dinhChinh, m.chan bỏ tiếng); Gemini dinhChinh không vào hàng chờ #81; chống lặp 60 giây; câu đính chính sai → haVeGoiY; 3 lỗi/buổi → Chỉ gợi ý; mẩu chữ cắt ngang số; chế độ Mai dẫn chính vẫn đi tiếp đoạn sau khi đính chính
- test/hook.test.js: hook kiem-loi-noi ở cửa truoc_phat, tắt được, ghi nhat_ky_hook với MIENG_NOI_SAI
- test/kiem-tra.test.js (hoặc tệp đang chứa 78 ca K): sau khi tách hàm dùng chung vẫn đạt đủ
- Miệng giả: chỉ chọn được ở buổi tập; phát chữ và tiếng đúng nhịp; lặp lại câu "đọc giúp"
- Chạy lại bản chép lời của buổi thử thật (lưu thành dữ liệu test) → kết quả bắt lỗi giống lúc chạy thật

**Claude Code làm thay:** - Viết ít nhất 60 câu mẫu lời Mai kèm đáp án (đúng / sai / nghi), gồm cách đọc giá kiểu miền Bắc và miền Nam. Việc này thay cho chạy miệng thật nhiều lần.
- Viết miệng giả và kịch bản tập "Mai nói nhầm số".
- Viết câu mẫu đính chính và câu thêm vào lời dặn miệng.
- Tự lái bản xem thử bằng miệng giả, chụp màn hình Thanh chữ và Màn hình người dẫn.
- Đọc nhật ký hook và bảng lỗi rồi tự chấm, thay cho dùng model chấm.
- Tra tài liệu mới nhất: GPT Live 1 đã có lệnh dừng hay cắt câu chưa; chữ chép đầu ra về trước hay sau tiếng; Gemini 3.8 Live có cách ngắt nào ngoài `turnComplete`.
- Ghi bản chép lời của buổi thử thật (chữ và mốc giờ, không ghi tiếng) thành test/du-lieu/chep-loi-mai-*.json để chạy lại mãi không tốn tiền.
- Soạn đoạn cho nháp chính sách quyền riêng tư: nhật ký lời AI trên sóng.

**Thử AI thật:** - Có, nhưng chỉ chạy sau khi chủ dự án đồng ý chi phí. Chạy trên bản xem thử, chế độ "Mai nói", 3 sản phẩm. Câu hỏi gõ vào ô Hỏi Mai theo kịch bản "Mai nói nhầm số" nên không tốn giọng Google TTS.
- (a) Gemini 3.8 Live, 6 phút, khoảng 0,15 USD tiền Google (giá khuyến mãi tới 31/12/2026).
- (b) GPT Live 1, 3 phút (0,05 USD/phút), khoảng 0,15–0,20 USD tiền OpenAI. Chỉ chạy nếu ngân sách OpenAI còn lại của cả đợt còn ít nhất 0,25 USD; thiếu thì bỏ (b), dựa vào (a) và bản chép lời.
- Đặt mức trần giờ tạm 0,5 USD ở bản xem thử; hết số phút thì tự dừng.
- Không dùng buổi 30 phút như báo cáo ước: GPT Live 1 chạy 30 phút tốn 1,5 USD, vượt ngân sách OpenAI.

**Phụ thuộc:** - Nên có trước: "P15 phần rẻ" (nhật ký buổi live, luật "Mai không tự nói con số"), mốc Tầng 2. Chưa có thì BH9 vẫn chạy nhờ bảng `loi_noi_song`.
- Nếu đã có thì dùng: hàm giá gạch hợp lệ của P34a; hàm "giá bán lúc này" của 6.1 B, để kiểm, giữ hàng và thẻ đơn cùng dùng một hàm giá.
- P35 (nhãn AI) cũng sửa thanh-chu.html: chia chỗ đặt nhãn và khung đính chính.
- P42 (Dừng AI / Dừng mọi thứ): miệng đóng thì không kiểm.

**Rủi ro:** - Chép lời nghe nhầm số (nhất là bản của Gemini) → đính chính nhầm trên sóng, gây khó xử. Giảm bằng: hai mức chắc / nghi, bộ 60 câu, phép thử thật trước khi dùng thật.
- Câu sai vẫn lên sóng 1–2 giây trước khi đính chính. GPT Live 1 không có lệnh dừng nên nói hết câu sai rồi mới đính chính.
- Miệng có thể diễn đạt lại câu đính chính. Thanh chữ mới là con số chuẩn; nếu câu đính chính sai lần nữa thì hạ về "Chỉ gợi ý".
- Có thể làm rối nhịp "Mai dẫn chính" (có test).
- Có lúc không có chữ chép (hãng tắt): khi đó tính năng không chạy. Nên hiện chip "chưa có chữ chép" nếu 60 giây có tiếng mà không có chữ.
- Chế độ mặc định vẫn là "Chỉ gợi ý" (rủi ro Cao ở SPEC mục 13 chỉ giảm, không hết).

**Mặc định tự chọn:** - Chỉ tự đính chính ở mức "chắc", để tránh đính chính nhầm trên sóng.
- 3 lỗi "chắc" mỗi buổi thì hạ về "Chỉ gợi ý" (theo gop.json).
- Chống lặp 60 giây.
- Thanh chữ hiện 12 giây: đủ cho người xem có độ trễ 15 giây vẫn thấy khi nghe câu sai.
- Chờ số trọn 600 ms.
- Giữ tiếng 0 ms: không làm Mai chậm đi khi chưa có số đo.
- Đính chính bằng chính miệng Mai (giữ một giọng, không tốn lượt giọng Google 100/ngày), Thanh chữ làm con số chuẩn.
- Bật và tắt qua Hook có sẵn, không thêm ô Cài đặt (ít ô nhập).

### Đơn chốt lúc Mai nói nhầm giá: giữ giá có lợi cho khách

*Đề xuất: P15 · công sức: vua*

- Khi có lỗi "chắc sai" mà có lợi cho khách thì mở một "khoảng nói nhầm". Hai trường hợp: Mai nói giá thấp hơn giá bán; hoặc Mai nói phí ship thấp hơn, mức miễn ship thấp hơn Cài đặt.
- Khoảng này tính từ lúc câu sai tới lúc đính chính + độ trễ phát của phiên (`phien_live.do_tre_giay`, mặc định 15) + 60 giây.
- Đơn bị đánh dấu "Mai nói nhầm giá" khi thỏa đủ: của phiên này, chưa gửi, có dòng hàng của món bị nói sai, và được tạo hoặc thêm món trong khoảng (`don.tao_luc`, `don.mon_sua_luc`). Lỗi phí ship: đơn có tổng hàng đạt mức Mai nói.
- Cài đặt → Bán hàng thêm MỘT ô chọn "Khi Mai lỡ nói giá thấp hơn", hai lựa chọn:
  - "Bán theo giá Mai nói" (mặc định): hạ đơn giá dòng đó xuống giá Mai nói. Chỉ hạ, không bao giờ tăng. Ghi `don_lich_su` (nguồn he_thong, kèm id lỗi) và tính lại tổng. Lỗi phí ship thì dùng `don.datPhiShip` sẵn có.
  - "Chủ shop quyết từng đơn": không đổi giá, chỉ đánh dấu và tạo việc.
- Có người chốt khi khoảng đang mở: `ChotDon.xuLy` áp giá ngay sau khi giữ hàng, trước khi nhắn riêng, để tin đầu và thẻ đơn đúng giá ngay. Lúc vừa phát hiện lỗi thì quét thêm các đơn tạo từ lúc câu sai tới lúc đó.
- Mai nói giá cao hơn giá bán: không đổi đơn (khách trả ít hơn điều đã nghe), chỉ ghi lỗi. Mai nói sai số còn: không đổi đơn, vì `kho.giu` đã chặn bán quá số có.
- Luôn tạo việc cho chủ shop (loại `khac`, gắn `don_id`), ví dụ: "3 đơn chốt lúc Mai nói nhầm giá áo 12 (150.000đ thay vì 159.000đ), đã bán theo giá Mai nói. [Xem] [Giữ giá đúng]". Nút "Giữ giá đúng" đưa giá về như cũ và ghi lịch sử.
- Khối đơn cho AI (`don.khoiChoAi`) ghi thêm "đơn giá giữ theo lời Mai trên live". Nhờ vậy Bộ kiểm tra K2/K10 vẫn khớp, và Tư vấn viên giải thích được nếu khách hỏi. MOZA không tự nhắn khách báo đổi giá.
- Thẻ đơn (#89) đã gửi mà tổng tiền đổi → gửi thẻ mới qua `guiTheDon` sẵn có, theo luật gửi hiện có (khung 24 giờ; Hook giới hạn liên hệ của P06 nếu đã có). `the_gui` tính theo món + tổng nên tự biết có phải gửi lại không.
- Đơn đã gửi trở đi: không đổi, chỉ gắn nhãn.
- Màn hình Đơn hàng: nhãn "Mai nói nhầm giá" kèm nút xử lý.
- Đây không phải khuyến mại: shop giữ đúng mức giá đã nói trên sóng.

**Tiêu chí:**
- [ ] Test: 3 đơn tạo trước, trong và sau khoảng → chỉ đơn trong khoảng có dòng món sai bị đánh dấu và hạ giá. Luôn đúng `tong_tien` = Σ(so_luong × don_gia) + phi_ship.
- [ ] Chỉ hạ, không bao giờ tăng. Đơn đã gửi không đổi. Mỗi lần đổi có dòng `don_lich_su`.
- [ ] Chốt trong lúc khoảng đang mở: đơn có giá Mai nói ngay trước tin nhắn riêng đầu tiên (Facebook giả nhận tin với tổng đúng).
- [ ] Chọn "Chủ shop quyết": giá không đổi, có việc cho người.
- [ ] "Giữ giá đúng": giá về như cũ, có lịch sử, thẻ đơn gửi lại theo luật 24 giờ.
- [ ] Mai nói giá cao hơn: đơn không đổi.
- [ ] Lỗi phí ship: đơn đạt mức Mai nói có phí ship theo lời Mai.
- [ ] `npm test` đạt; chuỗi thao tác ngẫu nhiên trên kho và đơn vẫn khớp `doiChieu()`.

**Tệp sửa:** `server/nghiep-vu/don.js (apGiaNoiNham, hoanGiaDung, ghi chú trong khoiChoAi)`, `server/nghiep-vu/don-danh-dau.js (mới, có SQL)`, `server/agent/mieng/kiem-loi-noi.js (mở / đóng khoảng, quét đơn)`, `server/chot-don.js (áp giá ngay khi khoảng đang mở)`, `server/gui-the-don.js (gọi guiTheDon khi tổng đổi)`, `server/api/don.js (POST /don/:id/danh-dau/:ddId/xu-ly)`, `server/nghiep-vu/cai-dat.js + server/cau-hinh/mac-dinh.json (ban_hang.khi_noi_nham_gia)`, `public/js/man-hinh/cai-dat.js (một ô chọn)`, `public/js/man-hinh/don.js (nhãn, nút)`, `server/db/nang-cap/0xx-thu-nghiem-ai.sql`, `test/don.test.js`, `test/chot-don.test.js`, `test/the-don.test.js`, `SPEC.md`

**Dữ liệu:** Bảng mới `don_danh_dau`, gồm các cột: id, don_id, loai (ví dụ 'mai_noi_nham_gia'), loi_noi_id NULL, chi_tiet JSON (dòng, giá cũ, giá mới), trang_thai ∈ {mo, da_xu_ly}, xu_ly, tao_luc, xu_ly_luc. Lý do dùng bảng riêng: một đơn có thể bị đánh dấu nhiều lần, và không đụng cột có ràng buộc CHECK của `don` (phiếu kỹ thuật dặn dùng bảng hoặc cột mới). Nếu mốc có P26 (máy đánh dấu đơn) tạo trước một bảng tương tự thì dùng chung. Giá đổi ghi vào `don_lich_su` sẵn có. Việc cho chủ shop dùng bảng `viec` (loai 'khac', don_id), không đổi cấu trúc. Cùng tệp nâng cấp với tính năng 1.

**Cấu hình, câu mẫu, Skill, Hook:** Khóa `ban_hang.khi_noi_nham_gia` ∈ {ban_theo_gia_noi (mặc định), chu_shop_quyet}: một ô chọn trong Cài đặt → Bán hàng. Khóa `kiem_loi_noi.them_khoang_giay` = 60. Không có Skill, Hook hay công cụ AI mới.

**Giả lập Facebook:** Không cần hành vi mới. Test dùng Facebook giả có sẵn để kiểm tin nhắn riêng đầu và thẻ đơn gửi lại mang tổng đã hạ. Nếu mốc P06 đã thêm Hook giới hạn liên hệ vào Facebook giả thì test thêm trường hợp thẻ gửi lại bị Hook chặn.

**Test:**
- test/don.test.js: apGiaNoiNham chỉ hạ, cấm với đơn đã gửi, có lịch sử, bất biến tổng tiền; hoanGiaDung
- test/chot-don.test.js: chốt trong và ngoài khoảng, hai lựa chọn Cài đặt, giá cao hơn không đổi, lỗi phí ship
- test/the-don.test.js: tổng đổi → thẻ mới; tổng không đổi → không gửi trùng
- Chuỗi ngẫu nhiên kho và đơn có thêm thao tác hạ giá: doiChieu() rỗng

**Claude Code làm thay:** - Viết các tình huống đơn mẫu có sẵn đáp án (giờ tạo, món, giá mong đợi), thay cho khách giả gọi gpt-6-luna.
- Viết chữ trên việc và nhãn đơn.
- Tự kiểm bằng bản xem thử: chạy kịch bản "Mai nói nhầm số" kèm bình luận chốt, đọc đơn và lịch sử để chấm.
- Viết đoạn cảnh báo về tiền cho chủ dự án.

**Thử AI thật:** Không. Mọi phần chạy bằng mã, test bằng miệng giả, Facebook giả và AI giả.

**Phụ thuộc:** - Cần bảng lỗi và "khoảng nói nhầm" của tính năng 1.
- Dùng chung hàm giá bán với 6.1 B nếu mốc đó đã làm.
- Thẻ đơn #89 và P22 (tin đầu thành thẻ) có thể đã đổi mã gửi thẻ: làm theo bản mới nhất.
- Hook giới hạn liên hệ của P06 nếu đã có.

**Rủi ro:** - Đụng tiền thật: lỗi mã có thể hạ giá nhầm đơn. Giảm bằng: chỉ hạ, chỉ dòng của món bị nói sai, chỉ trong khoảng, có lịch sử và nút hoàn lại, có test bất biến.
- Trường hợp "Chủ shop quyết": khách có thể khiếu nại "live bảo 150k" nếu shop đòi giá cao hơn. Nên nhờ luật sư hoặc kế toán xem cách xử lý trước khi live thật.
- Mai nói giá sai của món khác trong câu so sánh có thể làm đánh dấu nhầm. Đã giảm vì chỉ xét mức "chắc".

**Mặc định tự chọn:** - Mặc định "Bán theo giá Mai nói": có lợi cho khách, ít bị khiếu nại nhất. Phiếu soi lỗi pháp lý (kiem-7) khuyên chọn cách này, và chủ shop vẫn hoàn lại được bằng một chạm.
- Khoảng thêm 60 giây sau độ trễ phát: đủ thời gian để khách nghe câu sai rồi gõ bình luận chốt.
- Không tự nhắn khách báo đổi giá, để tránh tin thừa và đỡ tốn lượt liên hệ.

### MOZA nhìn qua OBS, gợi ý chuyển món

*Đề xuất: P38 · công sức: vua*

- Nút "MOZA nhìn" trên Màn hình người dẫn: tắt mặc định, bật theo từng buổi. Nút chỉ hiện khi đã nối OBS, hoặc khi buổi tập dùng Camera giả. Chạy ở mọi chế độ dẫn.
- Nguồn hình: chỉ lấy nguồn camera, không lấy cảnh đang phát, để khung gửi đi không có Thanh chữ ghi tên khách. MOZA tự chọn nguồn video đầu tiên trong cảnh "Moza · Phòng live" không phải nguồn của MOZA. Cài đặt → OBS có MỘT ô chọn từ danh sách để đổi.
- Tiết kiệm tiền bằng cách so hình bằng mã:
  - Mỗi 2,5 giây lấy một ảnh rất nhỏ (32×18, định dạng thô bmp hoặc ppm, chọn theo `GetVersion.supportedImageFormats`) bằng `GetSourceScreenshot` qua `KetNoiObs.yeuCau` sẵn có, không cần thư viện. Mã tự so khác biệt, không tốn tiền.
  - Chỉ khi hình đổi rồi đứng yên mới lấy ảnh 512 px JPEG gửi AI.
  - Tối đa 1 lần hỏi mỗi 5 giây, 600 lần mỗi giờ.
- Agent mới `nhin_mon`: gpt-6-luna, suy nghĩ tắt, không dự phòng, không nâng model (`nang_cap` rỗng, runtime không nâng lên Claude).
  - Nhận "bảng mẫu": một ảnh ghép tối đa 10 món của phiên (các món gần đoạn đang nói nhất), mỗi ô ghi số to. Trình duyệt ghép bằng canvas lúc bật nút, gửi `POST /nhin/bang-mau`, máy chỉ giữ trong bộ nhớ.
  - Nhận thêm khung hình, kèm dòng tên và màu của từng món.
  - Trả phiếu {co_mon, so, chac: cao|vua|thap}.
  - Lời dặn: chỉ nhìn món đồ, không mô tả hay nhận diện người; không chắc thì so = 0.
  - Bảng mẫu đặt trước khung hình để phần đầu yêu cầu giống nhau mọi lần, được tính giá lưu đệm của luna (0,01 USD / 1 triệu token).
  - openai.js thêm tùy chọn `detail: 'low'` cho ảnh.
- Chỉ gợi ý khi đủ các điều kiện: có món, số thuộc phiên, khác món đang nói, chắc = cao, và 2 lần hỏi liền nhau cùng ra một số.
  - Ô gợi ý "Đang cầm áo 7? [Chuyển] (Enter) [Bỏ qua]" dùng chung chỗ gợi ý của khối Lên sóng (`len-song.js`). Mỗi lúc chỉ một gợi ý, cái mới thay cái cũ; tự ẩn sau 20 giây.
  - Bấm Bỏ qua thì 60 giây không gợi ý lại món đó.
- Bấm Chuyển nghĩa là người dẫn đổi đoạn: `live.doiDoan` tới đoạn có món đó, gần nhất sau đoạn hiện tại; không có thì đoạn đầu tiên. Các việc theo sau y như người dẫn bấm ← →: dòng thời gian món, Màn hình sản phẩm, miệng.
- Máy không bao giờ tự đổi món hay tự đổi màn hình.
- Không lưu khung hình: chỉ nằm trong bộ nhớ, bỏ ngay sau khi hỏi, không ghi ảnh vào nhật ký AI. Không nhận diện khuôn mặt.
- Dừng khi: tắt nút, hết live, "Dừng mọi tự động" hoặc "Dừng AI" (P42), vượt mức trần. Chi phí đi qua runtime nên tính vào mức trần.
- Cạnh nút hiện chi phí nhìn của buổi.
- Lệnh giọng "Mai ơi áo 7" (`docLenh`) và phím ← → vẫn là đường không tốn tiền.
- Camera giả cho Phòng diễn tập: ô chọn "Người dẫn đang cầm: [món]"; khung hình là ảnh của món đó.
- Thay F-64 / #82 (Mai nhìn qua Gemini Live và tự chuyển món): bỏ công cụ `chuyen_san_pham` của miệng (A.6) và nút "Cho Mai xem" (mục 8). Cách mới chạy được với cả hai miệng.

**Tiêu chí:**
- [ ] Test với OBS giả: hình không đổi → không gọi AI; hình đổi rồi đứng yên → gọi đúng 1 lần; giới hạn 1 lần / 5 giây và 600 lần / giờ đúng.
- [ ] Test với AI giả: chỉ gợi ý khi đủ 5 điều kiện; AI trả "chắc cao" 10 lần mà không ai bấm → `doan_hien_tai` không đổi (không bao giờ tự chuyển).
- [ ] Bấm Chuyển → đúng đoạn, có dòng `dong_thoi_gian_san_pham`, Màn hình sản phẩm chiếu theo đoạn; Bỏ qua → 60 giây không gợi ý lại món đó.
- [ ] Nguồn gửi AI không bao giờ là cảnh, không bao giờ là nguồn Thanh chữ hay Màn hình sản phẩm (test).
- [ ] Không có tệp ảnh mới trong data/; `agent_run` và nhật ký không chứa 'data:image' hay chuỗi base64 (test tìm chuỗi).
- [ ] Dừng khi "Dừng mọi tự động", tắt nút, hết live (test).
- [ ] Bản xem thử với Camera giả: ô gợi ý hiện, bấm Chuyển đổi đúng đoạn (Claude Code chụp màn hình).
- [ ] Phép thử thật trên khoảng 50 khung dựng sẵn: nhận đúng ít nhất 80%, lần "chắc mà sai" tối đa 1/20, có chi phí mỗi lần và độ trễ. Không đạt thì vẫn giữ tắt mặc định và ghi kết quả vào SPEC mục 12, như luật F-64 cũ.

**Tệp sửa:** `server/nhin-mon.js (mới: vòng nhìn, so khác biệt, luật gợi ý; không có SQL)`, `server/agent/agents/nhin-mon.js (mới)`, `server/obs.js (chupNguon qua GetSourceScreenshot, danhSachNguonCamera, dinhDangHoTro)`, `server/agent/nha-cung-cap/openai.js (detail cho ảnh)`, `server/nghiep-vu/vai-tro.js (thêm nhin_mon vào bảng tên)`, `server/cau-hinh/loi-dan-mau.json (lời dặn nhin_mon)`, `server/cau-hinh/mac-dinh.json (khóa nhin_mon)`, `server/dich-vu.js (tạo NhinMon, nối manHinh.obs, phat, bus)`, `server/api/nhin.js (mới) + server/api/index.js`, `server/api/man-hinh.js (PUT /obs thêm nguon_camera; GET /obs/nguon-camera)`, `server/dien-tap.js + server/api/dien-tap.js (Camera giả)`, `public/js/man-hinh/nguoi-dan.js (nút, ghép bảng mẫu bằng canvas)`, `public/js/man-hinh/len-song.js (dùng chung ô gợi ý, phím Enter)`, `public/js/man-hinh/cai-dat-obs.js (ô chọn nguồn camera)`, `public/js/man-hinh/live.js (Camera giả trong Phòng diễn tập)`, `server/db/nang-cap/0xx-thu-nghiem-ai.sql (INSERT agent nhin_mon)`, `test/ho-tro.js (chuyển obsGia từ man-hinh-san-pham.test.js sang, thêm lệnh mới)`, `test/nhin-mon.test.js (mới)`, `test/man-hinh-san-pham.test.js`, `test/nha-cung-cap.test.js`, `scripts/thu-ai/dung-khung-thu.js và scripts/thu-ai/thu-nhin-mon.js (mới, chỉ để thử, có trần chi phí)`, `SPEC.md`

**Dữ liệu:** Không có bảng mới, không lưu ảnh. Tệp nâng cấp chung thêm một dòng `agent` ('nhin_mon', openai, gpt-6-luna, 'tat', không dự phòng, nang_cap '{}', gioi_han {"so_buoc":1,"giay":8}). Nguồn camera đã chọn lưu trong `cai_dat` khóa `obs` (JSON sẵn có), không đổi cấu trúc.

**Cấu hình, câu mẫu, Skill, Hook:** - mac-dinh.json thêm khóa `nhin_mon` gồm {chu_ky_giay: 2.5, cach_toi_thieu_giay: 5, toi_da_lan_gio: 600, canh_anh: 512, anh_so: [32,18], nguong_doi_hinh: 0.12, can_lien_tiep: 2, an_goi_y_giay: 20, bo_qua_giay: 60, toi_da_mon: 10}.
- Lời dặn `nhin_mon` do Claude Code soạn.
- Công cụ AI: không có công cụ mới. Bỏ `chuyen_san_pham` (miệng, F-64) khỏi A.6.
- Không có Skill hay Hook mới.
- Chỉ thêm 1 nút trên Màn hình người dẫn và 1 ô chọn trong Cài đặt → OBS (đã tự chọn sẵn).

**Giả lập Facebook:** Không. Phần cần giả lập là OBS giả trong test: thêm các lệnh GetVersion (supportedImageFormats), GetInputList, GetSceneItemList có sẵn một camera, GetSourceScreenshot. Lệnh này trả ảnh BMP nhỏ tạo bằng mã (đổi màu theo bước test) và JPEG lấy từ ảnh mẫu. Bản xem thử dùng Camera giả trong Phòng diễn tập.

**Test:**
- test/nhin-mon.test.js: so khác biệt ảnh nhỏ, nhịp hỏi và giới hạn; 5 điều kiện gợi ý; 2 lần liên tiếp; ẩn sau 20 giây; bỏ qua 60 giây; không tự chuyển; Chuyển → doiDoan đúng đoạn; dừng khi khẩn cấp, tắt nút, hết live; bảng mẫu tối đa 10 món gần đoạn đang nói
- test/nhin-mon.test.js: chọn nguồn camera, bỏ nguồn Thanh chữ và Màn hình sản phẩm; không có camera → báo rõ, nút ẩn
- test/nhin-mon.test.js: không có tệp ảnh mới; nhật ký không có base64
- test/man-hinh-san-pham.test.js: OBS giả chuyển sang ho-tro.js, các test cũ vẫn đạt
- test/nha-cung-cap.test.js: ảnh có detail 'low' khi được yêu cầu, thứ tự bảng mẫu rồi mới tới khung
- Camera giả: chỉ có trong buổi tập

**Claude Code làm thay:** - Dựng khoảng 50 khung thử 1280×720 bằng ffmpeg (có sẵn trên máy; chỉ Claude Code dùng để tạo dữ liệu thử, không phải thư viện của phần mềm).
  - Nguồn: ảnh 7 sản phẩm trong data/xem-thu/anh, đặt trên nhiều nền khác nhau, có lệch cỡ, lệch góc.
  - Thêm 10 khung không có món, không có mặt người.
  - Kèm đáp án cho từng khung.
- Tự xem các khung dựng để loại khung vô lý.
- Tự chấm kết quả thử theo đáp án, thay cho model chấm.
- Viết lời dặn nhin_mon, OBS giả, Camera giả.
- Tra tài liệu mới nhất trước khi code, ghi ngày tra:
  - obs-websocket GetSourceScreenshot (tham số, định dạng ảnh);
  - gpt-6-luna: số token của ảnh, `detail`, lưu đệm có tính cả ảnh không;
  - GPT Live 1 đã nhận ảnh chưa: nếu đã nhận thì cân nhắc đổi phương pháp.
- Viết hướng dẫn cho chủ dự án: bật nút, chọn nguồn camera, bước thử với camera thật. Giấy đồng ý của người lên hình phải ghi rõ có gửi khung hình ra nước ngoài.

**Thử AI thật:** - Có, gpt-6-luna của OpenAI, chạy sau khi chủ dự án đồng ý.
- Bước A: khoảng 100 lần gọi (50 khung × 2 cách: bảng mẫu `detail` low và high), mỗi lần tối đa khoảng 0,0005 USD → khoảng 0,05 USD. Chạy bằng script, dừng khi đạt 0,08 USD.
- Bước B (tùy chọn, khi chủ dự án đã cài OBS và nối camera điện thoại): 10 phút cầm lần lượt 5 món, khoảng 0,02–0,05 USD.
- Ước chi phí khi chạy thật: khoảng 0,05–0,3 USD mỗi giờ bật "MOZA nhìn" (ước tính, sẽ đo ở bước A).

**Phụ thuộc:** - OBS thật chỉ cần cho bước B (mục 12 việc 10: cài OBS, nối camera). Chưa cài thì nút ẩn và bước B hoãn.
- P42 (tách "Dừng AI") nếu đã làm.
- P16 (dòng "Tiếp theo", tối đa 1 gợi ý) cũng dùng chỗ gợi ý: giữ luật mỗi lúc một gợi ý.
- P44 (danh sách từ riêng cho phần nghe người dẫn) giúp lệnh "Mai ơi áo 7" (đường không tốn tiền) nghe đúng hơn; P44 thuộc mốc khác.

**Rủi ro:** - Hai áo cùng kiểu khác màu dễ bị nhận nhầm. Vì vậy chỉ gợi ý, cần 2 lần liên tiếp, người bấm mới chuyển.
- Khung hình có mặt người dẫn, người mẫu được gửi sang OpenAI ở nước ngoài (Luật 91/2025 Điều 20). Cần: giấy đồng ý, khóa đã bật trả tiền, không lưu ảnh, không nhận diện mặt, không gửi Thanh chữ; luật sư xem.
- Gửi ảnh lên mạng giữa lúc live: ảnh 512 px khoảng 30–50 KB mỗi lần, tối đa 12 lần/phút, nhỏ.
- Chi phí có thể chạy quá tay: đã có giới hạn số lần mỗi giờ, mức trần, nút tắt.
- Nhận ảnh của luna mới sửa lỗi ngày 25/9/2026, phải thử lại.
- Tên nguồn camera trong OBS mỗi máy mỗi khác: đã có ô chọn.
- Phím Enter dùng chung với gợi ý "Chiếu lên sóng?": mỗi lúc chỉ hiện một gợi ý.

**Mặc định tự chọn:** - 2,5 giây: nằm giữa khoảng 2–3 giây đã duyệt.
- 32×18 ảnh thô để so bằng mã; 512 px JPEG gửi AI (đủ nhìn quần áo, ít token).
- Ngưỡng đổi hình 12% là số tạm, chỉnh sau bước A.
- 1 lần / 5 giây và 600 lần / giờ giữ chi phí dưới khoảng 0,3 USD/giờ.
- 2 lần liên tiếp để giảm gợi ý nhầm, chịu trễ thêm 3–5 giây vì đây chỉ là gợi ý.
- Ẩn sau 20 giây, bỏ qua 60 giây.
- Tối đa 10 món gần đoạn đang nói (theo đúng nội dung đã duyệt).
- Không dự phòng: lỗi thì bỏ khung đó, không đi sang model đắt hơn.
- Tắt mặc định, bật theo từng buổi.
- Tự chọn nguồn camera, người chỉ đổi khi sai.

### Sổ Để sau / Không làm (ghi vào SPEC, không code)

*Đề xuất: P29, P25, P30, P21, P36, P05, P09, P37, P40, P41, P39, P33 · công sức: nho*

- Ghi vào SPEC mục 3 "Để sau" và mục 13, mỗi mục kèm điều kiện mở lại. Không code gì.
- P29 cách C (nối thẳng GHTK hoặc hãng khác, tức F-60) + P25 (bộ tin theo trạng thái hãng) + P30 (chuẩn hóa địa chỉ theo QĐ 19/2025/QĐ-TTg, 34 tỉnh, 3.321 xã). Mở lại khi chủ dự án đã chọn hãng VÀ số đơn đủ lớn: gợi ý từ 30 đơn/ngày trong 2 tuần liền, hoặc xuất file tạo vận đơn mất hơn 30 phút/ngày. Làm cả ba cùng lúc. Tiền thu hộ sai là mất tiền thật, nên có người rành xem trước.
- P21 bước 2 (tự xác nhận tiền qua payOS hoặc SePay). Mở lại khi đối chiếu tay thành gánh nặng: gợi ý hơn 20 đơn chuyển khoản/ngày, hoặc chủ shop báo mất hơn 15 phút/ngày. Chọn payOS nếu chịu mở tài khoản Kiên Long; chọn SePay để giữ ngân hàng đang dùng (miễn phí 50 giao dịch/tháng). Thử chuyển 1.000đ trước, nhờ người rành tài chính xem. Chỉ lưu "đã nhận, số tiền, giờ, mã tham chiếu", không lưu tên hay số tài khoản người chuyển (NĐ 356).
- P36 (che số điện thoại trước khi gửi AI). Chờ luật sư trả lời câu hỏi về Luật 91/2025 Điều 20. Nếu phải che thì làm cách đơn giản: mã tự bắt số trong tin khách, ghi thẳng vào đơn, AI chỉ thấy "[đã nhận SĐT]". Đồng thời sửa #18.
- P05 bản trả lời ngay trong MOZA (thẻ HUMAN_AGENT). Mở lại khi ứng dụng Meta đã qua xét duyệt quyền nâng cao VÀ doanh nghiệp đã xác minh (cần giấy đăng ký hộ kinh doanh).
- P09 bước 2 / 6.5: giữ cách A (làm tay). Cách B (lên lịch qua Facebook để biết trước mã buổi live) mở lại khi một tính năng cần biết trước mã live VÀ đã kiểm quyền lên lịch không phải xin duyệt. Cách C (tự bấm phát) không làm: ngoài phạm vi.
- 6.3 C (Zalo OA). Mở lại khi hộ kinh doanh xác thực được Zalo OA VÀ luật sư duyệt câu xin đồng ý (Luật 91/2025 Điều 28, NĐ 330/2026). Mỗi tin khoảng 200–300đ.
- Mục 7 "Không nên làm":
  - P37 (người mẫu AI), P40 (video AI người mẫu xoay): không làm; thay bằng ảnh thật trên hai dáng người kèm số đo và video điện thoại 15 giây mỗi màu. Chỉ xem lại khi luật nhãn hình AI đã rõ VÀ có số đo cho thấy tỷ lệ hoàn vì "khác ảnh" không tăng.
  - P41 (live giờ vắng với nhân vật hoạt hình): không làm. Chỉ xem lại khi có người trực từ xa dừng được, phần kiểm lời Mai của BH9 chạy ổn qua nhiều buổi thật, và hạn mức giọng Google đủ.
  - P39 (đổi Tư vấn viên sang model rẻ): không làm cho tới khi phần mềm xong và có số chi phí thật (từ P32); lúc đó so chất lượng bằng bộ hội thoại mẫu.
  - P33 (doanh thu năm so với mốc 1 tỷ): không làm; xuất danh sách đơn ra file (đã có) rồi hỏi kế toán.
- Theo dõi, chưa dùng được:
  - Marketing Messages: mở lại khi Meta cho doanh nghiệp tự dùng (FAQ ghi "no launch date").
  - Meta Live Shopping Tools: mở lại khi Meta mở cho ứng dụng không phải đối tác ở Việt Nam (hiện chỉ qua Haravan, đang thử nghiệm). Khi đó có thể đổi hẳn cách chốt đơn: khách không cần nhớ cú pháp.
- Ghi thêm: F-64 / #82 đã được thay bằng tính năng MOZA nhìn ở trên.

**Tiêu chí:**
- [ ] SPEC.md mục 3 "Để sau" và mục 13 có đủ các mục trên, mỗi mục một điều kiện mở lại đo được.
- [ ] Có dòng nhật ký sửa trong SPEC.
- [ ] Không có mã nào được thêm cho các mục này (rà bằng git diff).

**Tệp sửa:** `SPEC.md`

**Dữ liệu:** không

**Cấu hình, câu mẫu, Skill, Hook:** không

**Giả lập Facebook:** không

**Test:**
- Không có test mã; Claude Code rà lại SPEC theo danh sách.

**Claude Code làm thay:** Viết toàn bộ phần này vào SPEC, dựa trên báo cáo đã duyệt (mục 6, 7, 10). Không cần AI trả tiền.

**Thử AI thật:** không

**Phụ thuộc:** Làm cùng lúc sửa SPEC ở đầu mốc (sửa đặc tả trước, code sau).

**Rủi ro:** Điều kiện mở lại chỉ là gợi ý (30 đơn/ngày, 20 đơn chuyển khoản/ngày…); chủ dự án đổi được.

**Mặc định tự chọn:** Các ngưỡng mở lại là số gợi ý của Claude, dựa trên công sức tay ước tính (30 phút tạo vận đơn, 15 phút đối chiếu mỗi ngày), để có mốc đo được thay vì chữ "khi đủ lớn".

