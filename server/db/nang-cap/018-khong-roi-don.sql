-- 018: BH5 "Không rơi đơn" (SPEC.md 3.4, #95 → #106, #126; F-65 → F-73).
-- Quy ước #126: không thêm giá trị vào cột đang có CHECK; cột "loại" mới không đặt CHECK (kiểm trong mã như viec.loai).

-- F-65: mỗi bình luận chỉ nhắn riêng được MỘT tin (Meta). Đường nào muốn nhắn riêng phải "giữ lượt" trước bằng
-- INSERT OR IGNORE — ai giữ trước thì gửi, các đường khác (Director chuyển Tư vấn viên, Hộp thư) bỏ. Gửi lỗi thật → 'loi'
-- (còn nhắn bù được). boi: the_giu_hang · the_chon_mau · the_moi · the_ib · tu_van · nhan_bu · chot_test · the_xem_lai…
CREATE TABLE luot_nhan_rieng (
  fb_comment_id  TEXT PRIMARY KEY,
  page_id        TEXT,
  boi            TEXT NOT NULL,
  binh_luan_id   TEXT,
  hoi_thoai_id   TEXT,
  trang_thai     TEXT NOT NULL DEFAULT 'giu' CHECK (trang_thai IN ('giu', 'da_gui', 'loi')),
  chi_tiet       TEXT,
  luc            TEXT NOT NULL
);
-- Điền lại từ tin nhắn riêng cũ (Tư vấn viên gửi): các bình luận này đã dùng lượt.
INSERT OR IGNORE INTO luot_nhan_rieng (fb_comment_id, page_id, boi, hoi_thoai_id, trang_thai, luc)
  SELECT t.fb_comment_id, h.page_id, 'tu_van', t.hoi_thoai_id,
         CASE WHEN t.trang_thai_gui = 'loi' THEN 'loi' ELSE 'da_gui' END, t.luc
  FROM tin_nhan t JOIN hoi_thoai h ON h.id = t.hoi_thoai_id
  WHERE t.loai = 'nhan_rieng' AND t.fb_comment_id IS NOT NULL AND t.trang_thai_gui IN ('da_gui', 'khong_ro', 'cho', 'loi');

-- F-66: mọi lần liên hệ chủ động (gọi tên trên sóng, nhắc, báo hủy, mời chào, chăm sóc…) để giới hạn cho khách không phiền.
CREATE TABLE lien_he (
  id             TEXT PRIMARY KEY,
  nguoi_fb_id    TEXT,
  don_id         TEXT,
  phien_live_id  TEXT,
  loai           TEXT NOT NULL,
  luc            TEXT NOT NULL
);
CREATE INDEX lien_he_nguoi ON lien_he (nguoi_fb_id, loai, luc);
CREATE INDEX lien_he_don ON lien_he (don_id, loai);

-- F-73: nhắn bù cho người chốt lúc Page bị Meta khóa nhắn tin (người quyết), hoặc lúc Facebook giới hạn lượt gọi (tự gửi lại).
CREATE TABLE nhan_bu (
  id             TEXT PRIMARY KEY,
  fb_comment_id  TEXT NOT NULL,
  binh_luan_id   TEXT,
  don_id         TEXT,
  page_id        TEXT,
  ten            TEXT NOT NULL DEFAULT '',
  han_luc        TEXT NOT NULL,
  trang_thai     TEXT NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'da_gui', 'bo', 'het_han')),
  ly_do          TEXT,
  dien_tap       INTEGER NOT NULL DEFAULT 0,
  tao_luc        TEXT NOT NULL,
  xu_ly_luc      TEXT
);
CREATE INDEX nhan_bu_cho ON nhan_bu (trang_thai, han_luc);

-- F-68: ảnh sản phẩm đã tải lên Meta (attachment_id dùng lại) — mỗi ảnh tải một lần cho mỗi Page.
CREATE TABLE anh_fb (
  page_id        TEXT NOT NULL,
  tep            TEXT NOT NULL,
  attachment_id  TEXT NOT NULL,
  tai_luc        TEXT NOT NULL,
  PRIMARY KEY (page_id, tep)
);

-- F-66: khách xin thôi nhận tin ("dừng", "thôi shop", bấm Không lấy) — từ đó không tin chủ động, không gọi tên.
ALTER TABLE nguoi_fb ADD COLUMN ngung_lien_he_luc TEXT;

-- F-68, F-69: giữ hai mức (khách đã bấm / nhắn → giữ dài), nhắc tối đa 2 lần, báo hủy, gia hạn "Gọi xác nhận" một lần.
ALTER TABLE don ADD COLUMN khach_bam_luc TEXT;
ALTER TABLE don ADD COLUMN nhac_lan INTEGER NOT NULL DEFAULT 0;
ALTER TABLE don ADD COLUMN nhac_cuoi_luc TEXT;
ALTER TABLE don ADD COLUMN bao_huy_luc TEXT;
ALTER TABLE don ADD COLUMN gia_han_goi_luc TEXT;

-- F-67: id video của live (bình luận bài đăng của live mang id này — H09), link, giờ Facebook ghi lúc bắt đầu live.
ALTER TABLE phien_live ADD COLUMN fb_video_id TEXT;
ALTER TABLE phien_live ADD COLUMN fb_link TEXT;
ALTER TABLE phien_live ADD COLUMN bat_dau_fb TEXT;

-- F-65: thẻ Messenger đã gửi (JSON thẻ trung tính) để Hộp thư vẽ lại đúng thẻ.
ALTER TABLE tin_nhan ADD COLUMN the TEXT;
