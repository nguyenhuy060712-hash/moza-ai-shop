-- 004: AI trong phòng live (SPEC.md F-15, F-17, F-18; mục 7 bảng cau_tren_song).

-- Câu AI đưa lên sóng: ở chế độ "Chỉ gợi ý" là câu hiện chữ to cho người dẫn đọc (M4: câu miệng nói).
-- Thêm vào mục 7: `loai` (câu Co-host soạn hay lời nhắc của Director), `cau_hoi`, `ma_tin`, `trich_dan`
-- để biết câu trả lời cho câu hỏi nào, từ tin nào, và không giao lại câu đã trả lời (F-17).
CREATE TABLE cau_tren_song (
  id             TEXT PRIMARY KEY,
  phien_id       TEXT NOT NULL REFERENCES phien_live(id),
  run_id         TEXT,
  delegation_id  TEXT,
  loai           TEXT NOT NULL DEFAULT 'cohost' CHECK (loai IN ('cohost', 'director')),
  cau_hoi        TEXT,
  ma_tin         TEXT,
  noi_dung       TEXT NOT NULL,
  trich_dan      TEXT NOT NULL DEFAULT '[]',
  chep_loi_ra    TEXT,
  trang_thai     TEXT NOT NULL CHECK (trang_thai IN ('cho', 'da_hien', 'da_phat', 'bi_dung', 'het_han', 'bi_chan')),
  luc            TEXT NOT NULL
);
CREATE INDEX cau_tren_song_phien ON cau_tren_song (phien_id, luc);

-- Người đóng vai (F-15): AI giả người xem, chỉ chạy trong Phòng diễn tập; không phải Agent nghiệp vụ (#27),
-- nhưng chạy qua cùng runtime để chi phí được ghi như Agent khác (dien_tap = 1).
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('nguoi_dong_vai', 'Người đóng vai', 'Chỉ trong Phòng diễn tập: giả người xem bình luận theo vai để tập live.',
   'gemini', 'gemini-3.8-flash', 'tat', 'openai', 'gpt-6-luna', '["dua_binh_luan_gia"]', '{"so_buoc":1,"giay":30}');

-- Giới hạn thời gian của Director, Co-host: A.7 ghi 5 và 6 giây. Đo thật ngày 23/9/2026 một lượt Director mất
-- 2,5–5 giây, có lúc 10 giây (Gemini quá tải → nhà dự phòng). Theo #29 (chưa đo tốc độ, cho chạy được trước):
-- tạm 15 giây; quá 15 giây vẫn bỏ lượt. Tinh chỉnh lại khi phần mềm xong.
UPDATE agent SET gioi_han = '{"so_buoc":3,"giay":15}' WHERE id = 'director';
UPDATE agent SET gioi_han = '{"so_buoc":2,"giay":15}' WHERE id = 'cohost';
