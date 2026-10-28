-- 020: BH7 "Khép kín đơn" (SPEC.md 3.4, #112 → #118; F-88 → F-94). Quy ước #126: cột "loại / trạng thái" mới không đặt CHECK.

-- F-88: số khách lỡ ghi trong bình luận chốt (bình luận đã bị ẩn theo #19) — CHỈ gợi ý cho đúng đơn này ([Dùng số 0912***678]),
-- không tự điền; xóa khi đơn Đã xác nhận / Đã hủy.
ALTER TABLE don ADD COLUMN sdt_goi_y TEXT;
-- F-90: lúc đã hỏi gộp đơn giữa hai buổi; lúc đã gợi ý món phối; đơn đã được gộp vào đơn nào.
ALTER TABLE don ADD COLUMN hoi_gop_luc TEXT;
ALTER TABLE don ADD COLUMN goi_y_phoi_luc TEXT;
ALTER TABLE don ADD COLUMN gop_vao TEXT;

-- F-92: danh sách chờ khi hết hàng (khách bấm [🙋 Vẫn chờ]). trang_thai: cho · da_moi · da_nhan · het_han · huy.
CREATE TABLE cho_hang (
  id             TEXT PRIMARY KEY,
  phan_loai_id   TEXT NOT NULL REFERENCES phan_loai(id),
  so_luong       INTEGER NOT NULL DEFAULT 1,
  nguoi_fb_id    TEXT,
  hoi_thoai_id   TEXT,
  phien_live_id  TEXT,
  binh_luan_id   TEXT,
  trang_thai     TEXT NOT NULL DEFAULT 'cho',
  bam_luc        TEXT NOT NULL,
  moi_luc        TEXT,
  don_id         TEXT,
  dien_tap       INTEGER NOT NULL DEFAULT 0,
  tao_luc        TEXT NOT NULL
);
CREATE INDEX cho_hang_pl ON cho_hang (phan_loai_id, trang_thai, bam_luc);

-- F-91: số đo khách CHỈ khi khách bấm [Lưu giúp mình] (công tắc "Hỏi khách lưu chiều cao, cân nặng" tắt mặc định).
ALTER TABLE khach ADD COLUMN chieu_cao_cm INTEGER;
ALTER TABLE khach ADD COLUMN can_nang_kg REAL;
ALTER TABLE khach ADD COLUMN so_do_luc TEXT;
ALTER TABLE khach ADD COLUMN so_do_hoi_luc TEXT;

-- F-93: giá live của từng món trong buổi (tắt mặc định); dòng đơn chụp cả giá thường để thẻ ghi "(giá live)".
ALTER TABLE phien_live_san_pham ADD COLUMN gia_live INTEGER;
ALTER TABLE don_dong ADD COLUMN gia_thuong INTEGER;

-- F-94: bán sau live — con trỏ đọc bình luận video xem lại; bình luận mục lục đã đăng.
ALTER TABLE phien_live ADD COLUMN xem_lai_con_tro TEXT;
ALTER TABLE phien_live ADD COLUMN muc_luc_luc TEXT;
ALTER TABLE phien_live ADD COLUMN muc_luc_fb_id TEXT;

-- F-89: Tư vấn viên có công cụ gửi mã QR chuyển khoản (số tiền, nội dung do mã điền).
UPDATE agent SET cong_cu = json_insert(cong_cu, '$[#]', 'gui_ma_chuyen_khoan')
  WHERE id = 'tu_van' AND NOT EXISTS (SELECT 1 FROM json_each(agent.cong_cu) WHERE value = 'gui_ma_chuyen_khoan');

-- F-93: "Nói với Mai" đặt giá live cho buổi đang chờ live (xem trước + "Làm").
UPDATE agent SET cong_cu = json_insert(cong_cu, '$[#]', 'dat_gia_live')
  WHERE id = 'quan_ly' AND NOT EXISTS (SELECT 1 FROM json_each(agent.cong_cu) WHERE value = 'dat_gia_live');
