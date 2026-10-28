-- 007: Báo cáo và mở rộng (SPEC.md M6: F-34 Agent thử nghiệm, F-35 Báo cáo phễu, F-36 Vòng cải tiến).

-- Agent đề xuất bài học (A.7 bảng model: "đề xuất bài học" dùng claude-opus-5-5, suy nghĩ cao; dự phòng gpt-6-sol để chạy được
-- khi chưa có khóa Anthropic, như Soát tin). Không có công cụ: đọc ngữ cảnh và trả phiếu; bài học chỉ có tác dụng khi người duyệt.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('bai_hoc', 'Đề xuất bài học', 'Từ một câu bị chấm 👎 kèm lý do, đề xuất một bài học ngắn để người dùng duyệt thành Skill hoặc mục Sổ tay.',
   'anthropic', 'claude-opus-5-5', 'cao', 'openai', 'gpt-6-sol', '[]', '{"so_buoc":2,"giay":120}');

-- Bài học đề xuất từ lần chạy nào, vì lý do gì.
ALTER TABLE bai_hoc ADD COLUMN ly_do TEXT;
ALTER TABLE bai_hoc ADD COLUMN danh_gia_id TEXT;
