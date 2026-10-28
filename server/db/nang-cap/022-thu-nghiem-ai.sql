-- BH9 "Thử nghiệm AI" (SPEC.md F-105 → F-107).

-- F-105: lỗi số Mai nói trên sóng (chữ chép lại, không lưu tiếng). Bằng chứng đã đính chính (Luật TMĐT Điều 24 khoản 7), căn cứ
-- đánh dấu đơn chốt lúc Mai nói nhầm giá (F-106), báo cáo buổi. `het_khoang_luc`: hết "khoảng nói nhầm" (đính chính + độ trễ phát
-- + 60 giây) — chỉ có khi lỗi có lợi cho khách (giá / phí ship thấp hơn). Thời hạn lưu chờ luật sư (#127).
CREATE TABLE loi_noi_song (
  id              TEXT PRIMARY KEY,
  phien_live_id   TEXT NOT NULL REFERENCES phien_live(id),
  luc             TEXT NOT NULL,
  cau             TEXT NOT NULL,
  loai            TEXT NOT NULL CHECK (loai IN ('gia', 'con', 'ship', 'khan_hiem')),
  muc             TEXT NOT NULL CHECK (muc IN ('chac', 'nghi')),
  san_pham_id     TEXT,
  phan_loai_id    TEXT,
  gia_tri_noi     REAL,
  gia_tri_dung    REAL,
  dinh_chinh_luc  TEXT,
  het_khoang_luc  TEXT,
  model           TEXT,
  dien_tap        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX loi_noi_song_phien ON loi_noi_song (phien_live_id, luc);

-- F-106: đánh dấu đơn (một đơn có thể bị đánh dấu nhiều lần; không đụng cột có CHECK của `don`). chi_tiet JSON: dòng, giá cũ, giá mới.
CREATE TABLE don_danh_dau (
  id          TEXT PRIMARY KEY,
  don_id      TEXT NOT NULL REFERENCES don(id),
  loai        TEXT NOT NULL,
  loi_noi_id  TEXT,
  chi_tiet    TEXT NOT NULL DEFAULT '{}',
  trang_thai  TEXT NOT NULL DEFAULT 'mo' CHECK (trang_thai IN ('mo', 'da_xu_ly')),
  xu_ly       TEXT,
  tao_luc     TEXT NOT NULL,
  xu_ly_luc   TEXT
);
CREATE INDEX don_danh_dau_don ON don_danh_dau (don_id, trang_thai);

-- F-107: agent nhìn món qua OBS (chỉ gợi ý chuyển món). Không dự phòng, không nâng model (nang_cap rỗng).
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('nhin_mon', 'MOZA nhìn món', 'Nhìn khung hình camera, so với bảng mẫu các món của buổi, trả số món người dẫn đang cầm (không chắc thì 0).',
   'openai', 'gpt-6-luna', 'tat', NULL, NULL, '[]', '{"so_buoc":1,"giay":8}');
