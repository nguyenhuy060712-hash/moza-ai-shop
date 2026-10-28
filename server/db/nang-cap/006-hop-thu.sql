-- 006: Facebook thật và Hộp thư tự động (SPEC.md mục 7, M5: F-24 → F-33; #34, #35).

-- Mốc kết nối đầu, con trỏ lưới an toàn, địa chỉ đường hầm hiện tại.
CREATE TABLE moc_facebook (
  loai     TEXT PRIMARY KEY,
  con_tro  TEXT,
  luc      TEXT NOT NULL
);

-- Các Page đã nối (#37: nhiều Fanpage cùng lúc). Mã truy cập của Page chỉ nằm trong .env, bảng chỉ giữ tên và bật/tắt.
CREATE TABLE fb_page (
  id        TEXT PRIMARY KEY,
  ten       TEXT NOT NULL DEFAULT '',
  bat       INTEGER NOT NULL DEFAULT 1,
  them_luc  TEXT NOT NULL
);

-- Danh tính Facebook: PSID (Messenger) và id người bình luận. Hai id có thể về một người sau khi nhắn riêng.
-- PSID và id người bình luận là riêng cho từng Page, nên duy nhất theo (Page, id).
CREATE TABLE nguoi_fb (
  id            TEXT PRIMARY KEY,
  page_id       TEXT NOT NULL,
  psid          TEXT,
  fb_user_id    TEXT,
  ten_hien_thi  TEXT NOT NULL DEFAULT '',
  lan_dau       TEXT NOT NULL,
  lan_cuoi      TEXT NOT NULL,
  xoa_luc       TEXT,
  dien_tap      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (page_id, psid),
  UNIQUE (page_id, fb_user_id)
);

-- Hội thoại: Messenger (một người một hội thoại) hoặc bình luận (một người trên một bài / một live).
-- Cửa sổ 24 giờ tính từ tin_khach_cuoi_luc. `ai_tam_dung` = người đang giữ (A.12, #34).
CREATE TABLE hoi_thoai (
  id                 TEXT PRIMARY KEY,
  page_id            TEXT NOT NULL,
  kenh               TEXT NOT NULL CHECK (kenh IN ('messenger', 'binh_luan', 'binh_luan_live')),
  fb_thread_id       TEXT NOT NULL,
  nguoi_fb_id        TEXT NOT NULL REFERENCES nguoi_fb(id),
  ung_vien_id        TEXT,
  trang_thai         TEXT NOT NULL DEFAULT 'moi'
                     CHECK (trang_thai IN ('moi', 'ai_dang_xu_ly', 'can_nguoi', 'nguoi_dang_xu_ly', 'cho_phan_hoi', 'xong', 'spam')),
  ai_tam_dung        INTEGER NOT NULL DEFAULT 0,
  ly_do_can_nguoi    TEXT,
  nhan               TEXT NOT NULL DEFAULT '[]',
  uu_tien            INTEGER NOT NULL DEFAULT 0,
  ma_tin_goi_y       TEXT,
  phien_live_id      TEXT,
  fb_post_id         TEXT,
  tin_khach_cuoi_luc TEXT,
  lien_lac_cuoi_luc  TEXT,
  da_gioi_thieu_ai   INTEGER NOT NULL DEFAULT 0,
  tom_tat            TEXT,
  tom_tat_den_luc    TEXT,
  lan_hoi_tham       INTEGER NOT NULL DEFAULT 0,
  hoi_tham_luc       TEXT,
  luot_khong_nang    INTEGER NOT NULL DEFAULT 0,
  dang_nang          INTEGER NOT NULL DEFAULT 0,
  dien_tap           INTEGER NOT NULL DEFAULT 0,
  tao_luc            TEXT NOT NULL,
  cap_nhat_luc       TEXT NOT NULL,
  UNIQUE (page_id, kenh, fb_thread_id)
);
CREATE INDEX hoi_thoai_trang_thai ON hoi_thoai (trang_thai, cap_nhat_luc);
CREATE INDEX hoi_thoai_nguoi ON hoi_thoai (nguoi_fb_id);

-- Tin nhắn và bình luận. `fb_id` chống nhận trùng; `khoa_chong_trung` chống gửi trùng (một khóa → tối đa một lần gửi).
-- `loai`: tin (Messenger), binh_luan (khách bình luận), tra_loi (Page trả lời công khai), nhan_rieng, ghi_chu (nội bộ).
CREATE TABLE tin_nhan (
  id                TEXT PRIMARY KEY,
  hoi_thoai_id      TEXT NOT NULL REFERENCES hoi_thoai(id),
  chieu             TEXT NOT NULL CHECK (chieu IN ('vao', 'ra', 'noi_bo')),
  gui_boi           TEXT NOT NULL CHECK (gui_boi IN ('khach', 'ai', 'nguoi', 'he_thong')),
  loai              TEXT NOT NULL DEFAULT 'tin' CHECK (loai IN ('tin', 'binh_luan', 'tra_loi', 'nhan_rieng', 'ghi_chu')),
  noi_dung          TEXT NOT NULL,
  fb_id             TEXT UNIQUE,
  fb_comment_id     TEXT,
  khoa_chong_trung  TEXT UNIQUE,
  trang_thai_gui    TEXT CHECK (trang_thai_gui IN ('cho', 'da_gui', 'loi', 'khong_ro')),
  loi               TEXT,
  agent_run_id      TEXT,
  trich_dan         TEXT NOT NULL DEFAULT '[]',
  luc               TEXT NOT NULL
);
CREATE INDEX tin_nhan_hoi_thoai ON tin_nhan (hoi_thoai_id, luc);
CREATE INDEX tin_nhan_binh_luan ON tin_nhan (fb_comment_id);

CREATE TABLE ung_vien (
  id                   TEXT PRIMARY KEY,
  ten                  TEXT NOT NULL DEFAULT '',
  sdt                  TEXT UNIQUE,
  thong_tin            TEXT NOT NULL DEFAULT '',
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
  ung_vien_id        TEXT NOT NULL REFERENCES ung_vien(id),
  loai               TEXT NOT NULL CHECK (loai IN ('nguoi_do_noi', 'da_xac_nhan', 'da_hua')),
  noi_dung           TEXT NOT NULL,
  nguon_tin_nhan_id  TEXT,
  luc                TEXT NOT NULL,
  het_hieu_luc       TEXT
);
CREATE INDEX bo_nho_ung_vien ON bo_nho (ung_vien_id);

CREATE TABLE ung_tuyen (
  id           TEXT PRIMARY KEY,
  ung_vien_id  TEXT NOT NULL REFERENCES ung_vien(id),
  tin_id       TEXT NOT NULL REFERENCES tin(id),
  trang_thai   TEXT NOT NULL DEFAULT 'moi'
               CHECK (trang_thai IN ('moi', 'dang_tu_van', 'da_dang_ky', 'da_hen_pv', 'da_pv', 'da_nhan_viec', 'dung')),
  thong_tin    TEXT NOT NULL DEFAULT '',
  nguoi_sua_luc TEXT,
  tao_luc      TEXT NOT NULL,
  UNIQUE (ung_vien_id, tin_id)
);

CREATE TABLE ung_tuyen_lich_su (
  id                      TEXT PRIMARY KEY,
  ung_tuyen_id            TEXT NOT NULL REFERENCES ung_tuyen(id),
  tu                      TEXT,
  den                     TEXT NOT NULL,
  nguon                   TEXT NOT NULL CHECK (nguon IN ('ai', 'nguoi', 'ung_vien_tu_bao')),
  bang_chung_tin_nhan_id  TEXT,
  agent_run_id            TEXT,
  da_hoan_tac             INTEGER NOT NULL DEFAULT 0,
  luc                     TEXT NOT NULL
);
CREATE INDEX ung_tuyen_lich_su_ut ON ung_tuyen_lich_su (ung_tuyen_id, luc);

CREATE TABLE lich_hen (
  id               TEXT PRIMARY KEY,
  ung_tuyen_id     TEXT NOT NULL REFERENCES ung_tuyen(id),
  luc_hen          TEXT NOT NULL,
  dia_diem         TEXT NOT NULL DEFAULT '',
  trich_nguon      TEXT NOT NULL,
  nguon_loai       TEXT NOT NULL CHECK (nguon_loai IN ('tin', 'so_tay')),
  nguon_id         TEXT NOT NULL,
  nguon_phien_ban  INTEGER,
  trang_thai       TEXT NOT NULL DEFAULT 'da_hen' CHECK (trang_thai IN ('da_hen', 'da_nhac', 'huy')),
  tao_luc          TEXT NOT NULL
);
CREATE INDEX lich_hen_luc ON lich_hen (luc_hen);

-- Việc cần làm. `cho_ai` = nguoi (hiện ở Cần người / Tổng quan) hay ai (nhắc lịch, hỏi thăm — MOZA tự làm khi đến hạn).
CREATE TABLE viec (
  id            TEXT PRIMARY KEY,
  loai          TEXT NOT NULL,
  noi_dung      TEXT NOT NULL,
  han_luc       TEXT,
  ung_vien_id   TEXT,
  hoi_thoai_id  TEXT,
  lich_hen_id   TEXT,
  cho_ai        TEXT NOT NULL DEFAULT 'nguoi' CHECK (cho_ai IN ('nguoi', 'ai')),
  trang_thai    TEXT NOT NULL DEFAULT 'mo' CHECK (trang_thai IN ('mo', 'xong', 'huy')),
  tao_boi       TEXT NOT NULL DEFAULT 'nguoi',
  ket_qua       TEXT,
  tao_luc       TEXT NOT NULL
);
CREATE INDEX viec_mo ON viec (trang_thai, han_luc);

-- Bài học (M6, F-36): AI đề xuất từ 👎 và các lần bị chặn; người duyệt thì thành Skill hoặc mục Sổ tay.
CREATE TABLE bai_hoc (
  id             TEXT PRIMARY KEY,
  noi_dung       TEXT NOT NULL,
  dich           TEXT NOT NULL DEFAULT 'skill' CHECK (dich IN ('skill', 'so_tay')),
  dich_id        TEXT,
  nguon_run_ids  TEXT NOT NULL DEFAULT '[]',
  trang_thai     TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'bo')),
  luc            TEXT NOT NULL,
  xu_ly_luc      TEXT
);

-- Phiên live thật gắn với Page có live (#37).
ALTER TABLE phien_live ADD COLUMN page_id TEXT;

-- Công cụ của Tư vấn viên (A.6). Đổi luật nâng lên: chưa có khóa Anthropic thì gpt-6-sol (bản 2.4).
UPDATE agent SET cong_cu = '["muc_luc_tin","lay_tin","tim_trong_tin","mo_so_tay","mo_skill","xem_hoi_thoai","xem_ho_so","gan_nhan","ghi_bo_nho","tao_viec","chuyen_can_nguoi","gui_messenger","tra_loi_binh_luan","nhan_rieng","tao_ung_vien","tao_ung_tuyen","doi_trang_thai","hen_phong_van","dat_nhac"]'
  WHERE id = 'tu_van';
UPDATE agent SET nang_cap = json_set(nang_cap, '$.thay_khi_thieu_khoa', json('{"nha":"openai","model":"gpt-6-sol"}'))
  WHERE id = 'tu_van';
-- Giới hạn thời gian Tư vấn viên tạm 60 giây (bản 2.4, #29 — như Director, Co-host tạm 15 giây): chạy thật 24/9/2026, Gemini quá tải
-- mất khoảng 6 giây mỗi lần lỗi trước khi sang nhà dự phòng. Chỉnh về 25 giây khi tinh chỉnh tốc độ sau khi phần mềm xong.
UPDATE agent SET gioi_han = json_set(gioi_han, '$.giay', 60) WHERE id = 'tu_van';
