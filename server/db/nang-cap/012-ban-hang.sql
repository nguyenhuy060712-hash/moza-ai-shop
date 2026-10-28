-- 012: chuyển sang bán hàng — Moza AI Shop (SPEC.md 3.1 mục 7, #58, #66).
--
-- Thay nghiệp vụ tuyển dụng bằng bán hàng: tin → sản phẩm, ứng viên → khách hàng, ứng tuyển + lịch hẹn → đơn hàng.
-- Dọn dữ liệu cũ theo #66 ngay trong lần nâng này (phần mềm đã tự sao lưu truoc-nang-cap-12.db trước khi chạy; dữ liệu
-- thật của bản tuyển dụng còn được sao lưu riêng ở data/sao-luu/tuyen-dung-2026-09-25/):
--   giữ: cài đặt model, giọng Mai, giọng đã tạo, nhân vật Đội AI, mức trần, nhạc không lời, Page đã nối;
--   bỏ: tin tuyển dụng, Sổ tay, phiên live, kịch bản, hội thoại, ứng viên, nhật ký AI, nhạc hiệu có lời, bài hát;
--   lời dặn vai trò và Skill mẫu gieo lại bộ bán hàng khi khởi động.
-- Không có chế độ tuyển dụng song song (#58): bản tuyển dụng chạy riêng ở thư mục khác.

-- ---------- bỏ dữ liệu và bảng tuyển dụng (con trước, cha sau vì khóa ngoại) ----------

DROP TABLE lich_hen;
DROP TABLE ung_tuyen_lich_su;
DROP TABLE ung_tuyen;
DROP TABLE bo_nho;
DROP TABLE ung_vien;

DROP TABLE cau_tren_song;
DROP TABLE binh_luan_live;
DROP TABLE dong_thoi_gian_tin;
DROP TABLE phien_live_tin;
DELETE FROM phien_live;
DELETE FROM kich_ban;

DROP TABLE tin_ban_sua;
DROP TABLE tin;

DELETE FROM tin_nhan;
-- Ảnh khách gửi trong Messenger (F-63 tìm mẫu theo ảnh): địa chỉ ảnh Facebook trả trong webhook, hoặc "tam:<tệp>" ở diễn tập.
ALTER TABLE tin_nhan ADD COLUMN anh_url TEXT;
DELETE FROM hoi_thoai;
DELETE FROM nguoi_fb;
DELETE FROM moc_facebook;
DELETE FROM viec;

DELETE FROM goi_cong_cu;
DELETE FROM nhat_ky_hook;
DELETE FROM cho_duyet;
DELETE FROM danh_gia;
DELETE FROM bai_hoc;
DELETE FROM agent_run;
DELETE FROM luat_quyen;

-- Sổ tay, Skill, lời dặn: bản sửa "chỉ thêm" có trigger chặn xóa; lần dọn một lần này bỏ trigger, xóa, rồi đặt lại.
DROP TRIGGER so_tay_ban_sua_khong_xoa;
DELETE FROM so_tay_ban_sua;
DELETE FROM so_tay;
CREATE TRIGGER so_tay_ban_sua_khong_xoa BEFORE DELETE ON so_tay_ban_sua
BEGIN SELECT RAISE(ABORT, 'so_tay_ban_sua chỉ được thêm, không được xóa'); END;
DELETE FROM skill_ban_sua;
DELETE FROM skill;
DELETE FROM vai_tro_ban_sua;

-- Nhạc hiệu có lời và bài hát nói về việc làm (#66): bỏ thông tin để phần mềm không phát nữa. Tệp tiếng cũ trong
-- data/doi-ai/ để nguyên (không tự xóa tệp); chủ dự án tự xóa khi muốn — bản gốc đã có trong sao lưu.
UPDATE cai_dat SET gia_tri = json_remove(gia_tri, '$.nhac.hieu', '$.nhac.hieu_radio', '$.bai_hat') WHERE khoa = 'doi_ai';
UPDATE cai_dat SET gia_tri = '"Mai - Trợ lý bán hàng"' WHERE khoa = 'ten_ai' AND gia_tri = '"Mai - Trợ lý tuyển dụng"';

-- ---------- sản phẩm (F-51) ----------

CREATE TABLE san_pham (
  id              TEXT PRIMARY KEY,
  so              INTEGER NOT NULL UNIQUE CHECK (so > 0),
  ten             TEXT NOT NULL,
  danh_muc        TEXT NOT NULL,
  trang_thai      TEXT NOT NULL CHECK (trang_thai IN ('nhap', 'dang_ban', 'ngung_ban')),
  thuong_hieu     TEXT NOT NULL DEFAULT '',
  gia             INTEGER NOT NULL CHECK (gia >= 0),
  gia_goc         INTEGER CHECK (gia_goc IS NULL OR gia_goc >= 0),
  gia_von         INTEGER CHECK (gia_von IS NULL OR gia_von >= 0),
  thong_so        TEXT NOT NULL DEFAULT '{}',
  bang_size_id    TEXT,
  nhom            TEXT NOT NULL DEFAULT '{"t1":"Màu","t2":"Cỡ"}',
  anh             TEXT NOT NULL DEFAULT '[]',
  can_nang_g      INTEGER,
  kich_thuoc_cm   TEXT,
  mo_ta           TEXT NOT NULL DEFAULT '',
  diem_noi_bat    TEXT NOT NULL DEFAULT '[]',
  ten_goi_khac    TEXT NOT NULL DEFAULT '[]',
  phoi_cung       TEXT NOT NULL DEFAULT '[]',
  hoi_dap         TEXT NOT NULL DEFAULT '[]',
  ghi_chu_noi_bo  TEXT NOT NULL DEFAULT '',
  ai_doan         TEXT NOT NULL DEFAULT '[]',
  phien_ban       INTEGER NOT NULL,
  tao_luc         TEXT NOT NULL,
  sua_luc         TEXT NOT NULL
);
CREATE INDEX san_pham_trang_thai ON san_pham (trang_thai);

-- Mỗi lần lưu là một bản sửa, chụp mọi ô trừ tồn kho. Chỉ thêm: AI trích dẫn theo đúng bản sửa (A.4 K2).
CREATE TABLE san_pham_ban_sua (
  san_pham_id  TEXT NOT NULL REFERENCES san_pham(id),
  phien_ban    INTEGER NOT NULL,
  noi_dung     TEXT NOT NULL,
  luc          TEXT NOT NULL,
  PRIMARY KEY (san_pham_id, phien_ban)
);
CREATE TRIGGER san_pham_ban_sua_khong_sua BEFORE UPDATE ON san_pham_ban_sua
BEGIN SELECT RAISE(ABORT, 'san_pham_ban_sua chỉ được thêm, không được sửa'); END;
CREATE TRIGGER san_pham_ban_sua_khong_xoa BEFORE DELETE ON san_pham_ban_sua
BEGIN SELECT RAISE(ABORT, 'san_pham_ban_sua chỉ được thêm, không được xóa'); END;

-- Ô phân loại (màu × cỡ). `ton` = tồn trong kho; còn bán được = ton − đang giữ (tính từ đơn, F-52).
-- `bo` = 1: không bán tổ hợp này (không xóa dòng, vì đơn cũ có thể trỏ tới).
CREATE TABLE phan_loai (
  id           TEXT PRIMARY KEY,
  san_pham_id  TEXT NOT NULL REFERENCES san_pham(id),
  gt1          TEXT NOT NULL,
  gt2          TEXT,
  sku          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  gia          INTEGER CHECK (gia IS NULL OR gia >= 0),
  can_nang_g   INTEGER,
  ton          INTEGER NOT NULL DEFAULT 0 CHECK (ton >= 0),
  bo           INTEGER NOT NULL DEFAULT 0 CHECK (bo IN (0, 1)),
  thu_tu       INTEGER NOT NULL DEFAULT 0
);
-- gt2 NULL (hàng một cỡ): UNIQUE của SQLite coi hai NULL là khác nhau, nên chống trùng bằng COALESCE.
CREATE UNIQUE INDEX phan_loai_to_hop ON phan_loai (san_pham_id, gt1, COALESCE(gt2, ''));

-- ---------- bảng size (F-51 nhóm 4) ----------

CREATE TABLE bang_size (
  id         TEXT PRIMARY KEY,
  ten        TEXT NOT NULL,
  cot        TEXT NOT NULL DEFAULT '[]',
  hang       TEXT NOT NULL DEFAULT '[]',
  rieng      INTEGER NOT NULL DEFAULT 0 CHECK (rieng IN (0, 1)),
  phien_ban  INTEGER NOT NULL,
  sua_luc    TEXT NOT NULL
);

CREATE TABLE bang_size_ban_sua (
  bang_size_id  TEXT NOT NULL REFERENCES bang_size(id),
  phien_ban     INTEGER NOT NULL,
  ten           TEXT NOT NULL,
  cot           TEXT NOT NULL,
  hang          TEXT NOT NULL,
  luc           TEXT NOT NULL,
  PRIMARY KEY (bang_size_id, phien_ban)
);
CREATE TRIGGER bang_size_ban_sua_khong_sua BEFORE UPDATE ON bang_size_ban_sua
BEGIN SELECT RAISE(ABORT, 'bang_size_ban_sua chỉ được thêm, không được sửa'); END;
CREATE TRIGGER bang_size_ban_sua_khong_xoa BEFORE DELETE ON bang_size_ban_sua
BEGIN SELECT RAISE(ABORT, 'bang_size_ban_sua chỉ được thêm, không được xóa'); END;

-- ---------- tồn kho (F-52) ----------

-- Mọi thay đổi tồn. Bất biến (mục 7): ton hiện tại = tổng thay_doi của phân loại đó. Chỉ thêm.
CREATE TABLE kho_lich_su (
  id             TEXT PRIMARY KEY,
  phan_loai_id   TEXT NOT NULL REFERENCES phan_loai(id),
  thay_doi       INTEGER NOT NULL,
  ton_sau        INTEGER NOT NULL CHECK (ton_sau >= 0),
  ly_do          TEXT NOT NULL CHECK (ly_do IN ('nhap_hang', 'dieu_chinh', 'gui_don', 'nhan_hoan')),
  don_id         TEXT,
  ghi_chu        TEXT NOT NULL DEFAULT '',
  boi            TEXT NOT NULL CHECK (boi IN ('nguoi', 'he_thong')),
  luc            TEXT NOT NULL
);
CREATE INDEX kho_lich_su_pl ON kho_lich_su (phan_loai_id, luc);
CREATE TRIGGER kho_lich_su_khong_sua BEFORE UPDATE ON kho_lich_su
BEGIN SELECT RAISE(ABORT, 'kho_lich_su chỉ được thêm, không được sửa'); END;
CREATE TRIGGER kho_lich_su_khong_xoa BEFORE DELETE ON kho_lich_su
BEGIN SELECT RAISE(ABORT, 'kho_lich_su chỉ được thêm, không được xóa'); END;

-- ---------- khách hàng (F-54 — thay ung_vien) ----------

CREATE TABLE khach (
  id                   TEXT PRIMARY KEY,
  ten                  TEXT NOT NULL DEFAULT '',
  sdt                  TEXT UNIQUE,
  dia_chi              TEXT NOT NULL DEFAULT '',
  ghi_chu              TEXT NOT NULL DEFAULT '',
  nguon_hoi_thoai_id   TEXT,
  nguon_phien_live_id  TEXT,
  dong_y_luc           TEXT,
  tao_boi              TEXT NOT NULL CHECK (tao_boi IN ('ai', 'nguoi')),
  nguoi_sua_luc        TEXT,
  gop_vao              TEXT,
  xoa_luc              TEXT,
  dien_tap             INTEGER NOT NULL DEFAULT 0,
  tao_luc              TEXT NOT NULL
);

CREATE TABLE bo_nho (
  id                 TEXT PRIMARY KEY,
  khach_id           TEXT NOT NULL REFERENCES khach(id),
  loai               TEXT NOT NULL CHECK (loai IN ('nguoi_do_noi', 'da_xac_nhan', 'da_hua')),
  noi_dung           TEXT NOT NULL,
  nguon_tin_nhan_id  TEXT,
  luc                TEXT NOT NULL,
  het_hieu_luc       TEXT
);
CREATE INDEX bo_nho_khach ON bo_nho (khach_id);

ALTER TABLE hoi_thoai RENAME COLUMN ung_vien_id TO khach_id;
ALTER TABLE hoi_thoai RENAME COLUMN ma_tin_goi_y TO san_pham_goi_y;

ALTER TABLE viec RENAME COLUMN ung_vien_id TO khach_id;
ALTER TABLE viec RENAME COLUMN lich_hen_id TO don_id;

-- ---------- đơn hàng (F-55; nghiệp vụ đơn làm ở BH3, bảng tạo sẵn ở lần nâng này theo mục 7) ----------

CREATE TABLE don (
  id                TEXT PRIMARY KEY,
  ma                TEXT NOT NULL UNIQUE,
  page_id           TEXT,
  nguoi_fb_id       TEXT,
  khach_id          TEXT REFERENCES khach(id),
  hoi_thoai_id      TEXT,
  phien_live_id     TEXT,
  binh_luan_id      TEXT,
  nguon             TEXT NOT NULL CHECK (nguon IN ('binh_luan_live', 'tin_nhan', 'nguoi')),
  trang_thai        TEXT NOT NULL CHECK (trang_thai IN ('cho_xac_nhan', 'da_xac_nhan', 'da_gui', 'da_giao', 'hoan', 'da_huy')),
  ten_nhan          TEXT NOT NULL DEFAULT '',
  sdt_nhan          TEXT,
  dia_chi_nhan      TEXT NOT NULL DEFAULT '',
  thanh_toan        TEXT NOT NULL DEFAULT 'cod' CHECK (thanh_toan IN ('cod', 'chuyen_khoan')),
  da_nhan_tien_luc  TEXT,
  phi_ship          INTEGER NOT NULL DEFAULT 0 CHECK (phi_ship >= 0),
  tong_hang         INTEGER NOT NULL DEFAULT 0,
  tong_tien         INTEGER NOT NULL DEFAULT 0,
  giu_den           TEXT,
  ma_van_don        TEXT NOT NULL DEFAULT '',
  ghi_chu           TEXT NOT NULL DEFAULT '',
  ly_do_huy         TEXT,
  da_nhan_hoan_luc  TEXT,
  nguoi_sua_luc     TEXT,
  nhac_giao_luc     TEXT,
  bao_gui_luc       TEXT,
  dien_tap          INTEGER NOT NULL DEFAULT 0,
  tao_luc           TEXT NOT NULL,
  sua_luc           TEXT NOT NULL
);
CREATE INDEX don_trang_thai ON don (trang_thai, tao_luc);

CREATE TABLE don_dong (
  id                  TEXT PRIMARY KEY,
  don_id              TEXT NOT NULL REFERENCES don(id),
  phan_loai_id        TEXT NOT NULL REFERENCES phan_loai(id),
  san_pham_id         TEXT NOT NULL REFERENCES san_pham(id),
  san_pham_phien_ban  INTEGER NOT NULL,
  so_luong            INTEGER NOT NULL CHECK (so_luong >= 1),
  don_gia             INTEGER NOT NULL CHECK (don_gia >= 0),
  gia_von_chup        INTEGER,
  ten_chup            TEXT NOT NULL
);
CREATE INDEX don_dong_don ON don_dong (don_id);
CREATE INDEX don_dong_phan_loai ON don_dong (phan_loai_id);

CREATE TABLE don_lich_su (
  id                      TEXT PRIMARY KEY,
  don_id                  TEXT NOT NULL REFERENCES don(id),
  tu                      TEXT,
  den                     TEXT NOT NULL,
  nguon                   TEXT NOT NULL CHECK (nguon IN ('ai', 'nguoi', 'khach_tu_bao', 'he_thong')),
  bang_chung_tin_nhan_id  TEXT,
  agent_run_id            TEXT,
  ghi_chu                 TEXT,
  da_hoan_tac             INTEGER NOT NULL DEFAULT 0,
  luc                     TEXT NOT NULL
);
CREATE INDEX don_lich_su_don ON don_lich_su (don_id, luc);
CREATE TRIGGER don_lich_su_khong_xoa BEFORE DELETE ON don_lich_su
BEGIN SELECT RAISE(ABORT, 'don_lich_su chỉ được thêm, không được xóa'); END;

-- ---------- phòng live theo sản phẩm (F-19, F-20) ----------

CREATE TABLE phien_live_san_pham (
  phien_id     TEXT NOT NULL REFERENCES phien_live(id),
  san_pham_id  TEXT NOT NULL REFERENCES san_pham(id),
  phien_ban    INTEGER NOT NULL,
  PRIMARY KEY (phien_id, san_pham_id)
);

CREATE TABLE dong_thoi_gian_san_pham (
  phien_id     TEXT NOT NULL REFERENCES phien_live(id),
  doan         INTEGER NOT NULL,
  san_pham_id  TEXT,
  tu_luc       TEXT NOT NULL
);
CREATE INDEX dong_thoi_gian_san_pham_phien ON dong_thoi_gian_san_pham (phien_id, tu_luc);

-- `san_pham_doan`: id sản phẩm đoán cho bình luận. `xu_ly` thêm da_chot, `don_id` cho bình luận chốt (F-53, BH3).
CREATE TABLE binh_luan_live (
  id            TEXT PRIMARY KEY,
  phien_id      TEXT NOT NULL REFERENCES phien_live(id),
  fb_id         TEXT NOT NULL UNIQUE,
  nguoi_fb_id   TEXT,
  ten           TEXT NOT NULL,
  noi_dung      TEXT NOT NULL,
  luc_fb        TEXT NOT NULL,
  luc_nhan      TEXT NOT NULL,
  nhan          TEXT NOT NULL DEFAULT '[]',
  nhom_cau_hoi  TEXT,
  san_pham_doan TEXT,
  da_an         INTEGER NOT NULL DEFAULT 0,
  xu_ly         TEXT NOT NULL DEFAULT 'moi'
                CHECK (xu_ly IN ('moi', 'da_goi_y', 'da_noi', 'cho_tu_van', 'da_tu_van', 'bo_qua', 'da_chot')),
  don_id        TEXT
);
CREATE INDEX binh_luan_live_phien ON binh_luan_live (phien_id, luc_fb);

CREATE TABLE cau_tren_song (
  id             TEXT PRIMARY KEY,
  phien_id       TEXT NOT NULL REFERENCES phien_live(id),
  run_id         TEXT,
  delegation_id  TEXT,
  loai           TEXT NOT NULL DEFAULT 'cohost' CHECK (loai IN ('cohost', 'director')),
  cau_hoi        TEXT,
  san_pham_id    TEXT,
  noi_dung       TEXT NOT NULL,
  trich_dan      TEXT NOT NULL DEFAULT '[]',
  chep_loi_ra    TEXT,
  trang_thai     TEXT NOT NULL CHECK (trang_thai IN ('cho', 'da_hien', 'da_phat', 'bi_dung', 'het_han', 'bi_chan')),
  luc            TEXT NOT NULL
);
CREATE INDEX cau_tren_song_phien ON cau_tren_song (phien_id, luc);

ALTER TABLE agent_run RENAME COLUMN tin_id TO san_pham_id;
ALTER TABLE agent_run RENAME COLUMN tin_phien_ban TO san_pham_phien_ban;

-- ---------- Agent (A.1, A.6; model theo mục 6) ----------

UPDATE agent SET muc_tieu = 'Điều phối phòng live bán hàng: chọn đúng một trong năm quyết định mỗi lượt.',
  cong_cu = '["muc_luc_san_pham","lay_san_pham","mo_so_tay","mo_skill","xem_tinh_hinh_phien","xem_cau_hoi_moi","goi_y_nguoi_dan","giao_cohost","chuyen_tu_van","bao_nguoi_dan","chuyen_can_nguoi"]'
  WHERE id = 'director';
UPDATE agent SET muc_tieu = 'Soạn 1–3 câu trả lời trên sóng kèm trích dẫn nguyên văn từ thẻ của một sản phẩm và Sổ tay shop.',
  cong_cu = '["lay_san_pham","tim_trong_san_pham","mo_so_tay","de_xuat_cau_song"]'
  WHERE id = 'cohost';
-- Tư vấn viên: tư vấn sản phẩm, size, phí ship, đổi trả; lên đơn (xem_don, cap_nhat_don — #79), gửi ảnh (F-56), tìm mẫu theo ảnh (F-63).
UPDATE agent SET muc_tieu = 'Tự động tư vấn qua Messenger và bình luận như một nhân viên bán hàng online của shop: tư vấn, lên đơn, sửa, hủy đơn theo lời khách.',
  cong_cu = '["muc_luc_san_pham","lay_san_pham","tim_trong_san_pham","mo_so_tay","mo_skill","xem_hoi_thoai","xem_khach","xem_don","cap_nhat_don","gui_anh_san_pham","tim_mau_theo_anh","gan_nhan","ghi_bo_nho","tao_viec","chuyen_can_nguoi","gui_messenger","tra_loi_binh_luan","nhan_rieng","dat_nhac"]'
  WHERE id = 'tu_van';
UPDATE agent SET muc_tieu = 'Chỉ trong Phòng diễn tập: giả người xem bình luận hỏi mua hàng để tập live.' WHERE id = 'nguoi_dong_vai';
UPDATE agent SET muc_tieu = 'Soạn kịch bản live bán hàng từ các sản phẩm Đang bán: mỗi đoạn có lời dẫn cho người dẫn và câu Mai nói, giá lấy đúng từ sản phẩm.'
  WHERE id = 'soan_kich_ban';
UPDATE agent SET muc_tieu = 'Từ một câu bị chấm 👎 kèm lý do, đề xuất một bài học ngắn để người dùng duyệt thành Skill hoặc mục Sổ tay shop.'
  WHERE id = 'bai_hoc';
UPDATE agent SET id = 'soat_san_pham', ten = 'Soát sản phẩm',
  muc_tieu = 'Nút "Xem thử AI hiểu gì": đọc thử thẻ một sản phẩm như khách hàng, chỉ ra chỗ mơ hồ, mâu thuẫn, còn thiếu. Kết quả không lưu vào sản phẩm.'
  WHERE id = 'soat_tin';

-- "Tạo từ ảnh" (#75): đọc ảnh sản phẩm, điền trước các ô. Model đọc ảnh theo mục 6: gemini-3.8-flash suy nghĩ thấp, dự phòng gpt-6-sol.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('doc_anh', 'Đọc ảnh sản phẩm', '"Tạo từ ảnh": nhìn ảnh sản phẩm, điền trước tên, danh mục, thông số, màu, mô tả, điểm nổi bật. Không đoán giá, xuất xứ, thương hiệu.',
   'gemini', 'gemini-3.8-flash', 'thap', 'openai', 'gpt-6-sol', '[]', '{"so_buoc":2,"giay":90}');

-- "Nói với Mai" (#76, F-62): agent quản lý shop bằng lời. Model theo mục 6: gpt-6-sol, dự phòng gemini-3.8-flash.
-- Việc ghi (nhập kho, điều chỉnh, đổi trạng thái) mặc định "Hỏi": bảng xem trước + nút "Làm".
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('quan_ly', 'Nói với Mai (quản lý shop)', 'Làm việc shop theo lời người dùng: tìm sản phẩm, xem còn hàng, nhập kho, điều chỉnh tồn, đổi trạng thái sản phẩm. Việc có ảnh hưởng luôn chờ người bấm "Làm".',
   'openai', 'gpt-6-sol', 'vua', 'gemini', 'gemini-3.8-flash',
   '["tim_san_pham","xem_con_hang","nhap_kho","dieu_chinh_kho","doi_trang_thai_san_pham","tim_don","xem_don","xem_bao_cao","mo_skill"]', '{"so_buoc":6,"giay":60}');

-- Bình luận chốt khó hiểu (#77, F-53): mã nhận trước; câu có chữ báo mua mà không khớp rõ thì model rẻ đọc hộ, trả phiếu có
-- lược đồ. Model theo mục 6: gemini-3.5-flash-lite suy nghĩ tắt, dự phòng gpt-6-luna.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('doc_chot', 'Đọc bình luận chốt', 'Đọc hộ bình luận có chữ báo mua mà mã chưa hiểu rõ: có phải chốt không, số sản phẩm, màu, cỡ, số lượng.',
   'openai', 'gpt-6-luna', 'tat', 'gemini', 'gemini-3.5-flash-lite', '[]', '{"so_buoc":1,"giay":15}');

-- Tìm mẫu theo ảnh khách gửi (#78, F-63): model đọc ảnh so ảnh khách với ảnh đại diện tối đa 12 mẫu. gemini-3.8-flash, dự phòng gpt-6-sol.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('tim_mau', 'Tìm mẫu theo ảnh', 'So ảnh khách gửi với ảnh các sản phẩm Đang bán, trả mẫu gần giống nhất hoặc báo shop chưa có.',
   'gemini', 'gemini-3.8-flash', 'thap', 'openai', 'gpt-6-sol', '[]', '{"so_buoc":2,"giay":60}');
