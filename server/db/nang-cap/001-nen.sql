-- 001: bảng nền của M1 (SPEC.md mục 7) — tin tuyển dụng, Sổ tay, cài đặt, cấu hình Agent.
-- Quy ước: ID là TEXT có tiền tố; thời gian ISO 8601 UTC; chữ đã chuẩn hóa NFC trước khi lưu.

CREATE TABLE tin (
  id          TEXT PRIMARY KEY,
  ma          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nha_may     TEXT NOT NULL,
  trang_thai  TEXT NOT NULL CHECK (trang_thai IN ('nhap', 'con_tuyen', 'dung_tuyen')),
  thong_tin   TEXT NOT NULL DEFAULT '',
  phien_ban   INTEGER NOT NULL,
  tao_luc     TEXT NOT NULL,
  sua_luc     TEXT NOT NULL
);

-- Mỗi lần lưu tin là một bản sửa. Chỉ được thêm: AI trích dẫn theo đúng bản sửa,
-- nên bản cũ mà bị sửa thì trích dẫn cũ không còn truy ngược được (A.4 K2).
CREATE TABLE tin_ban_sua (
  tin_id      TEXT NOT NULL REFERENCES tin(id),
  phien_ban   INTEGER NOT NULL,
  ma          TEXT NOT NULL,
  nha_may     TEXT NOT NULL,
  trang_thai  TEXT NOT NULL,
  thong_tin   TEXT NOT NULL,
  luc         TEXT NOT NULL,
  PRIMARY KEY (tin_id, phien_ban)
);
CREATE TRIGGER tin_ban_sua_khong_sua BEFORE UPDATE ON tin_ban_sua
BEGIN SELECT RAISE(ABORT, 'tin_ban_sua chỉ được thêm, không được sửa'); END;
CREATE TRIGGER tin_ban_sua_khong_xoa BEFORE DELETE ON tin_ban_sua
BEGIN SELECT RAISE(ABORT, 'tin_ban_sua chỉ được thêm, không được xóa'); END;

CREATE TABLE so_tay (
  id          TEXT PRIMARY KEY,
  tieu_de     TEXT NOT NULL,
  noi_dung    TEXT NOT NULL DEFAULT '',
  phien_ban   INTEGER NOT NULL,
  thu_tu      INTEGER NOT NULL DEFAULT 0,
  tao_luc     TEXT NOT NULL,
  sua_luc     TEXT NOT NULL
);

CREATE TABLE so_tay_ban_sua (
  so_tay_id   TEXT NOT NULL REFERENCES so_tay(id),
  phien_ban   INTEGER NOT NULL,
  tieu_de     TEXT NOT NULL,
  noi_dung    TEXT NOT NULL,
  luc         TEXT NOT NULL,
  PRIMARY KEY (so_tay_id, phien_ban)
);
CREATE TRIGGER so_tay_ban_sua_khong_sua BEFORE UPDATE ON so_tay_ban_sua
BEGIN SELECT RAISE(ABORT, 'so_tay_ban_sua chỉ được thêm, không được sửa'); END;
CREATE TRIGGER so_tay_ban_sua_khong_xoa BEFORE DELETE ON so_tay_ban_sua
BEGIN SELECT RAISE(ABORT, 'so_tay_ban_sua chỉ được thêm, không được xóa'); END;

-- Cài đặt dạng khóa → JSON. Không bao giờ chứa khóa API (khóa chỉ nằm trong .env).
CREATE TABLE cai_dat (
  khoa     TEXT PRIMARY KEY,
  gia_tri  TEXT NOT NULL
);

-- Cấu hình ba Agent (SPEC.md A.1, mục 6). Runtime dùng ở M2; M1 cho sửa model trong Cài đặt.
CREATE TABLE agent (
  id              TEXT PRIMARY KEY,
  ten             TEXT NOT NULL,
  muc_tieu        TEXT NOT NULL DEFAULT '',
  nha             TEXT NOT NULL,
  model           TEXT NOT NULL,
  muc_suy_nghi    TEXT NOT NULL CHECK (muc_suy_nghi IN ('tat', 'thap', 'vua', 'cao')),
  nha_du_phong    TEXT,
  model_du_phong  TEXT,
  nang_cap        TEXT NOT NULL DEFAULT '{}',
  cong_cu         TEXT NOT NULL DEFAULT '[]',
  skill           TEXT NOT NULL DEFAULT '[]',
  gioi_han        TEXT NOT NULL DEFAULT '{}',
  bat             INTEGER NOT NULL DEFAULT 1,
  thu_nghiem      INTEGER NOT NULL DEFAULT 0
);

-- Model mặc định theo bảng model ở SPEC.md mục 6; giới hạn bước và thời gian theo A.7.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, nang_cap, gioi_han) VALUES
  ('director', 'Director', 'Điều phối phòng live: chọn đúng một trong năm quyết định mỗi lượt.',
   'gemini', 'gemini-3.8-flash', 'thap', 'openai', 'gpt-6-luna', '{}', '{"so_buoc":3,"giay":5}'),
  ('cohost', 'Co-host', 'Soạn 1–3 câu trả lời trên sóng kèm trích dẫn nguyên văn từ một mã tin và Sổ tay.',
   'gemini', 'gemini-3.8-flash', 'thap', 'openai', 'gpt-6-luna', '{}', '{"so_buoc":2,"giay":6}'),
  ('tu_van', 'Tư vấn viên AI', 'Tự động tư vấn qua Messenger và bình luận như một nhân viên tư vấn tuyển dụng.',
   'gemini', 'gemini-3.8-flash', 'vua', 'openai', 'gpt-6-sol',
   '{"nha":"anthropic","model":"claude-sonnet-5","muc_suy_nghi":"vua","model_du_phong":"claude-opus-5-5"}',
   '{"so_buoc":8,"giay":25}');
