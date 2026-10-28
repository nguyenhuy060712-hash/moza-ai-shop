-- 021: BH8 "Trước live và sau mua" (SPEC.md 3.4, #117 → #122; F-95 → F-104). Quy ước #126: cột "loại / trạng thái" mới không đặt CHECK.

-- F-95: "Nói với Mai" điền thông tin bán hàng và Sổ tay (luôn xem trước + "Làm", số phải có trong câu người nói).
UPDATE agent SET cong_cu = json_insert(cong_cu, '$[#]', 'dat_ban_hang')
  WHERE id = 'quan_ly' AND NOT EXISTS (SELECT 1 FROM json_each(agent.cong_cu) WHERE value = 'dat_ban_hang');
UPDATE agent SET cong_cu = json_insert(cong_cu, '$[#]', 'ghi_so_tay')
  WHERE id = 'quan_ly' AND NOT EXISTS (SELECT 1 FROM json_each(agent.cong_cu) WHERE value = 'ghi_so_tay');

-- F-96: bộ bài báo trước buổi live (Sự kiện live, bài nhá hàng, 3 câu Reels). Model rẻ vì bài ngắn và có Bộ kiểm tra canh.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('soan_bai', 'Soạn bài báo trước live', 'Viết mô tả Sự kiện live, bài nhá hàng và 3 câu Reels từ thẻ sản phẩm đã xác nhận; MOZA điền ngày giờ, số món, cú pháp chốt; người chép, MOZA không đăng.',
   'openai', 'gpt-6-luna', 'thap', 'gemini', 'gemini-3.5-flash-lite', '[]', '{"so_buoc":1,"giay":60}');

-- F-97: đồng ý nhận tin báo live TỪNG BUỔI, trong 24 giờ (6.3 A+B). Bằng chứng đồng ý (Luật 91/2025 Điều 28): nguyên văn câu hỏi,
-- tin mời, giờ bấm, tin bấm. tra_loi: cho · dong_y · thoi. Khác khach.dong_y_luc (đồng ý dùng thông tin để giao hàng).
CREATE TABLE dong_y_nhan_tin (
  id              TEXT PRIMARY KEY,
  page_id         TEXT,
  nguoi_fb_id     TEXT NOT NULL,
  hoi_thoai_id    TEXT,
  buoi            TEXT NOT NULL,
  cau_hoi         TEXT NOT NULL,
  tin_hoi_id      TEXT,
  tra_loi         TEXT NOT NULL DEFAULT 'cho',
  tra_loi_luc     TEXT,
  tin_tra_loi_id  TEXT,
  rut_luc         TEXT,
  nhac_luc        TEXT,
  nhac_tin_id     TEXT,
  nhac_ly_do      TEXT,
  dien_tap        INTEGER NOT NULL DEFAULT 0,
  tao_luc         TEXT NOT NULL,
  UNIQUE (nguoi_fb_id, buoi)
);
CREATE INDEX dong_y_buoi ON dong_y_nhan_tin (buoi, tra_loi);

-- F-99: hỏi lại đơn nên xác nhận trước khi gửi (máy đánh dấu, người quyết). hoi_lai: da_hoi · dong_y · hen_ngay · khong_tra_loi.
ALTER TABLE don ADD COLUMN hoi_lai TEXT;
ALTER TABLE don ADD COLUMN hoi_lai_luc TEXT;
-- F-100: hỏi thăm sau khi gửi "mặc thấy sao". phan_hoi_mac: vua · chat · rong (số liệu "X/Y khách nói vừa").
ALTER TABLE don ADD COLUMN hoi_mac_luc TEXT;
ALTER TABLE don ADD COLUMN phan_hoi_mac TEXT;
ALTER TABLE don ADD COLUMN phan_hoi_mac_luc TEXT;

-- F-102: tổng kết sau live — gợi ý AI đã viết (JSON {luc, goi_y, bo, run_id}) để không gọi AI lại khi mở trang.
ALTER TABLE phien_live ADD COLUMN tong_ket TEXT;
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('tong_ket', 'Tổng kết sau live', 'Đọc số liệu gộp của buổi live (máy đếm, không tên khách) và viết tối đa 3 gợi ý cho buổi sau, mỗi gợi ý có lý do kèm số.',
   'openai', 'gpt-6-luna', 'tat', 'gemini', 'gemini-3.5-flash-lite', '[]', '{"so_buoc":1,"giay":40}');

-- F-104: ảnh khách mặc thật (TẮT mặc định). Ảnh khách là dữ liệu cá nhân: giữ bằng chứng đồng ý (nguyên văn câu xin phép, giờ bấm,
-- tin bấm), người duyệt (đã che mặt) và gỡ được. `lan_hoi`: các ảnh gửi trong 2 phút gom chung một lần xin phép. Tệp ở data/anh-khach/.
CREATE TABLE anh_khach (
  id            TEXT PRIMARY KEY,
  page_id       TEXT,
  nguoi_fb_id   TEXT NOT NULL,
  khach_id      TEXT,
  hoi_thoai_id  TEXT,
  don_id        TEXT,
  san_pham_id   TEXT,
  co            TEXT,
  tin_nhan_id   TEXT NOT NULL UNIQUE,
  lan_hoi       TEXT NOT NULL,
  cau_xin_phep  TEXT,
  hoi_luc       TEXT,
  tep           TEXT,
  dong_y_luc    TEXT,
  tin_dong_y_id TEXT,
  tu_choi_luc   TEXT,
  loi           TEXT,
  che_mat       INTEGER,
  duyet_luc     TEXT,
  go_luc        TEXT,
  dien_tap      INTEGER NOT NULL DEFAULT 0,
  tao_luc       TEXT NOT NULL
);
CREATE INDEX anh_khach_nguoi ON anh_khach (nguoi_fb_id, hoi_luc);
CREATE INDEX anh_khach_mon ON anh_khach (san_pham_id, duyet_luc);
