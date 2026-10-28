-- 003: lõi AI (SPEC.md mục 7, F-07 → F-14, Phụ lục A).
-- Bài thi Skill (bai_thi, ket_qua_thi) dời tới khi phần mềm xong (#32); bài học ở M6.

-- Lời dặn vai trò của từng Agent và của miệng. Mỗi agent có đúng một bản `dang_dung`,
-- tối đa một bản `nhap` đang soạn; các bản trước là `cu` để "Quay lại bản trước".
CREATE TABLE vai_tro_ban_sua (
  agent_id    TEXT NOT NULL,
  phien_ban   INTEGER NOT NULL,
  noi_dung    TEXT NOT NULL,
  trang_thai  TEXT NOT NULL CHECK (trang_thai IN ('nhap', 'dang_dung', 'cu')),
  luc         TEXT NOT NULL,
  PRIMARY KEY (agent_id, phien_ban)
);

-- Skill: `ten` + `dung_khi` là mục lục (luôn nạp cho Agent được cấp); nội dung nằm ở bản sửa, mở khi cần.
CREATE TABLE skill (
  id         TEXT PRIMARY KEY,
  ten        TEXT NOT NULL,
  dung_khi   TEXT NOT NULL,
  agent_ids  TEXT NOT NULL DEFAULT '[]',
  thu_tu     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE skill_ban_sua (
  skill_id    TEXT NOT NULL REFERENCES skill(id),
  phien_ban   INTEGER NOT NULL,
  cach_lam    TEXT NOT NULL,
  vi_du_dung  TEXT NOT NULL DEFAULT '',
  vi_du_sai   TEXT NOT NULL DEFAULT '',
  trang_thai  TEXT NOT NULL CHECK (trang_thai IN ('nhap', 'dang_dung', 'cu')),
  luc         TEXT NOT NULL,
  PRIMARY KEY (skill_id, phien_ban)
);

-- Hook viết trong mã; bảng chỉ giữ bật/tắt của hook không bắt buộc (A.3).
CREATE TABLE hook_bat (
  id   TEXT PRIMARY KEY,
  bat  INTEGER NOT NULL
);

-- Luật Cho phép / Hỏi / Cấm. Không có dòng nào cho một công cụ thì dùng mức mặc định của công cụ (A.6).
-- `dieu_kien` rỗng = áp cho mọi lần gọi; có ô thì chỉ áp khi tham số khớp.
CREATE TABLE luat_quyen (
  id          TEXT PRIMARY KEY,
  hanh_dong   TEXT NOT NULL,
  dieu_kien   TEXT NOT NULL DEFAULT '{}',
  muc         TEXT NOT NULL CHECK (muc IN ('cho_phep', 'hoi', 'cam')),
  thu_tu      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX luat_quyen_hanh_dong ON luat_quyen (hanh_dong, thu_tu);

-- Mỗi lần một Agent chạy (A.9). Ngữ cảnh đầy đủ không lưu; chỉ lưu bản sửa của từng nguồn đã dùng.
CREATE TABLE agent_run (
  id                 TEXT PRIMARY KEY,
  agent_id           TEXT NOT NULL,
  kich_hoat          TEXT NOT NULL,
  hoi_thoai_id       TEXT,
  phien_live_id      TEXT,
  tin_id             TEXT,
  tin_phien_ban      INTEGER,
  so_tay_phien_ban   TEXT NOT NULL DEFAULT '{}',
  skill_phien_ban    TEXT NOT NULL DEFAULT '{}',
  vai_tro_phien_ban  INTEGER,
  nha                TEXT,
  model              TEXT,
  muc_suy_nghi       TEXT,
  ly_do_nang         TEXT,
  token_vao          INTEGER NOT NULL DEFAULT 0,
  token_ra           INTEGER NOT NULL DEFAULT 0,
  chi_phi_usd        REAL NOT NULL DEFAULT 0,
  so_buoc            INTEGER NOT NULL DEFAULT 0,
  ket_qua            TEXT,
  loi                TEXT,
  bat_dau            TEXT NOT NULL,
  ket_thuc           TEXT,
  dien_tap           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX agent_run_bat_dau ON agent_run (bat_dau);
CREATE INDEX agent_run_agent ON agent_run (agent_id, bat_dau);

-- Mọi lần gọi công cụ, kể cả bị từ chối. `run_id` trống khi do hook gọi (ví dụ ẩn bình luận lộ số).
CREATE TABLE goi_cong_cu (
  id          TEXT PRIMARY KEY,
  run_id      TEXT,
  cong_cu     TEXT NOT NULL,
  tham_so     TEXT NOT NULL DEFAULT '{}',
  ket_qua     TEXT,
  bi_tu_choi  INTEGER NOT NULL DEFAULT 0,
  ly_do       TEXT,
  luc         TEXT NOT NULL
);
CREATE INDEX goi_cong_cu_run ON goi_cong_cu (run_id);

CREATE TABLE nhat_ky_hook (
  id          TEXT PRIMARY KEY,
  run_id      TEXT,
  cua         TEXT NOT NULL,
  hook        TEXT NOT NULL,
  quyet_dinh  TEXT NOT NULL CHECK (quyet_dinh IN ('cho_qua', 'chan', 'giu', 'sua')),
  ly_do       TEXT,
  luc         TEXT NOT NULL
);
CREATE INDEX nhat_ky_hook_run ON nhat_ky_hook (run_id);
CREATE INDEX nhat_ky_hook_luc ON nhat_ky_hook (luc);

-- Hành động bị luật "Hỏi" (hoặc công tắc Dừng mọi tự động) giữ lại chờ người duyệt.
-- `ly_do`, `ket_qua`, `xu_ly_luc` thêm vào mục 7 để biết vì sao phải hỏi và duyệt xong ra sao.
CREATE TABLE cho_duyet (
  id          TEXT PRIMARY KEY,
  run_id      TEXT,
  hanh_dong   TEXT NOT NULL,
  tham_so     TEXT NOT NULL DEFAULT '{}',
  ly_do       TEXT,
  trang_thai  TEXT NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'duyet', 'tu_choi')),
  ket_qua     TEXT,
  luc         TEXT NOT NULL,
  xu_ly_luc   TEXT
);
CREATE INDEX cho_duyet_trang_thai ON cho_duyet (trang_thai, luc);

CREATE TABLE danh_gia (
  id      TEXT PRIMARY KEY,
  run_id  TEXT NOT NULL,
  diem    TEXT NOT NULL CHECK (diem IN ('tot', 'xau')),
  ly_do   TEXT,
  luc     TEXT NOT NULL
);

-- Danh sách công cụ từng Agent (A.6). Công cụ của Tư vấn viên có ở M5.
UPDATE agent SET cong_cu = '["muc_luc_tin","lay_tin","mo_so_tay","mo_skill","xem_tinh_hinh_phien","xem_cau_hoi_moi","goi_y_nguoi_dan","giao_cohost","chuyen_tu_van","bao_nguoi_dan","chuyen_can_nguoi"]'
  WHERE id = 'director';
UPDATE agent SET cong_cu = '["lay_tin","tim_trong_tin","mo_so_tay","de_xuat_cau_song"]'
  WHERE id = 'cohost';
UPDATE agent SET cong_cu = '["muc_luc_tin","lay_tin","tim_trong_tin","mo_so_tay","mo_skill","chuyen_can_nguoi"]'
  WHERE id = 'tu_van';
