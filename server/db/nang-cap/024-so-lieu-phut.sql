-- 024: BH11 "Mai thông minh hơn" (SPEC.md F-116, F-115; docs/11 mục 6.1, 6.2).
-- Quy ước #126: không thêm giá trị vào cột có CHECK — dùng bảng / cột mới.

-- F-116: số liệu buổi live theo phút (phút = số phút kể từ lúc lên sóng). Người xem lấy từ live_views (phòng live hỏi Facebook mỗi
-- 60 giây); bình luận, chốt, câu hỏi đếm từ bảng có sẵn. Trước đây số người xem chỉ giữ 10 phút trong bộ nhớ (chot-don.js) — BH12
-- (F-117 kịch bản buổi sau) đọc bảng này.
CREATE TABLE so_lieu_phut (
  phien_id   TEXT NOT NULL REFERENCES phien_live(id),
  phut       INTEGER NOT NULL,
  nguoi_xem  INTEGER,
  binh_luan  INTEGER NOT NULL DEFAULT 0,
  chot       INTEGER NOT NULL DEFAULT 0,
  cau_hoi    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (phien_id, phut)
);

-- F-115 / F-116: lúc một bình luận hỏi đã được trả lời (người dẫn bấm "Đã trả lời", "Tự đọc", Mai nói câu trả lời, đăng trả lời dưới
-- bình luận). Cột `xu_ly` có CHECK nên không thêm giá trị mới.
ALTER TABLE binh_luan_live ADD COLUMN tra_loi_luc TEXT;
