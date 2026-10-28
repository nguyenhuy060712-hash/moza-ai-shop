-- 019: BH6 "Trên sóng" (SPEC.md 3.4, #107 → #111; F-80, F-81).
-- Quy ước #126: cột "loại" mới không đặt CHECK (kiểm trong mã).

-- F-80 (#108): nhật ký buổi live — CHỈ CHỮ những gì lên sóng (không lưu tiếng): lời Mai (theo câu), lời Đội AI, lời người dẫn
-- (câu đã chốt của chép lời), màn hình / cảnh, sự kiện (người mẫu, bình chọn, thẻ nhắc…). Câu Co-host đã có ở cau_tren_song,
-- bình luận chốt ở binh_luan_live — đọc gộp khi xem, không chép lại. loai: mai · doi_ai · nguoi_dan · man_hinh · su_kien.
-- canh_bao: đánh dấu sau soát bằng mã ("so" — số tiền không khớp giá; "tu_cam" — từ cấm K11). Giữ 90 ngày.
CREATE TABLE nhat_ky_song (
  id           TEXT PRIMARY KEY,
  phien_id     TEXT NOT NULL REFERENCES phien_live(id),
  luc          TEXT NOT NULL,
  loai         TEXT NOT NULL,
  noi_dung     TEXT NOT NULL,
  san_pham_id  TEXT,
  canh_bao     TEXT
);
CREATE INDEX nhat_ky_song_phien ON nhat_ky_song (phien_id, luc);
CREATE INDEX nhat_ky_song_luc ON nhat_ky_song (luc);

-- F-81 (#109): video sản phẩm có cờ dung_thu (video AI dựng từ ảnh, không phải quay thật) — buổi live thật không chiếu.
-- Mọi video đang có lúc nâng cấp là 14 video dựng thử (#90, ghi ở SPEC mục 12) → đánh dấu hết; người bấm "Đây là video
-- quay thật" để bỏ cờ.
UPDATE san_pham SET video = (SELECT json_group_array(json_set(value, '$.dung_thu', json('true'))) FROM json_each(san_pham.video))
  WHERE video IS NOT NULL AND json_valid(video) AND json_array_length(video) > 0;
