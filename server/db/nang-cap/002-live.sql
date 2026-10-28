-- 002: phòng live (SPEC.md mục 7, F-15, F-16, F-19, F-20, F-37).

-- Kịch bản live: tên + danh sách đoạn, mỗi đoạn chỉ {tin_id|null, loi_nhac} (#31 — ít trường).
CREATE TABLE kich_ban (
  id        TEXT PRIMARY KEY,
  ten       TEXT NOT NULL,
  doan      TEXT NOT NULL DEFAULT '[]',
  tao_luc   TEXT NOT NULL,
  sua_luc   TEXT NOT NULL
);

-- Một buổi live (thật hoặc diễn tập). `kich_ban` là bản chụp lúc bắt đầu:
-- sửa kịch bản giữa chừng không làm đổi phiên đang chạy.
CREATE TABLE phien_live (
  id                TEXT PRIMARY KEY,
  ten               TEXT NOT NULL,
  fb_live_video_id  TEXT,
  che_do_ai         TEXT NOT NULL CHECK (che_do_ai IN ('tat', 'goi_y', 'noi')),
  mieng             TEXT,
  do_tre_giay       INTEGER NOT NULL DEFAULT 15,
  kich_ban_id       TEXT,
  kich_ban          TEXT NOT NULL,
  doan_hien_tai     INTEGER NOT NULL DEFAULT 0,
  trang_thai        TEXT NOT NULL CHECK (trang_thai IN ('cho_live', 'dang_live', 'xong')),
  tao_luc           TEXT NOT NULL,
  bat_dau           TEXT,
  ket_thuc          TEXT,
  tom_tat           TEXT,
  dien_tap          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX phien_live_trang_thai ON phien_live (trang_thai);

-- Bản sửa của từng tin lúc bắt đầu phiên: AI trích đúng bản đang dùng trên sóng.
CREATE TABLE phien_live_tin (
  phien_id   TEXT NOT NULL REFERENCES phien_live(id),
  tin_id     TEXT NOT NULL REFERENCES tin(id),
  phien_ban  INTEGER NOT NULL,
  PRIMARY KEY (phien_id, tin_id)
);

-- Đoạn nào (và mã tin nào) lên sóng từ lúc nào — để đoán bình luận hỏi về tin nào.
CREATE TABLE dong_thoi_gian_tin (
  phien_id  TEXT NOT NULL REFERENCES phien_live(id),
  doan      INTEGER NOT NULL,
  tin_id    TEXT,
  tu_luc    TEXT NOT NULL
);
CREATE INDEX dong_thoi_gian_tin_phien ON dong_thoi_gian_tin (phien_id, tu_luc);

-- Bình luận trong buổi live. `fb_id` duy nhất: cùng một bình luận về hai lần chỉ lưu một dòng.
-- `luc_nhan` = lúc MOZA nhận được (so với `luc_fb` biết bình luận về chậm bao lâu).
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
  ma_tin_doan   TEXT,
  da_an         INTEGER NOT NULL DEFAULT 0,
  xu_ly         TEXT NOT NULL DEFAULT 'moi'
                CHECK (xu_ly IN ('moi', 'da_goi_y', 'da_noi', 'cho_tu_van', 'da_tu_van', 'bo_qua'))
);
CREATE INDEX binh_luan_live_phien ON binh_luan_live (phien_id, luc_fb);
