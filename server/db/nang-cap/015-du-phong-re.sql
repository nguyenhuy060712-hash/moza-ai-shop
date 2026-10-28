-- 015: dự phòng rẻ cho Tư vấn viên (SPEC.md #88, chủ dự án chọn "làm 1 và 2" ngày 26/9/2026).
-- Gemini quá tải thì Tư vấn viên chạy gpt-6-luna (0,10 / 0,50 USD mỗi 1 triệu token) thay vì gpt-6-sol (2 / 10) — rẻ hơn ~20 lần.
-- Chỉ đổi khi người dùng chưa tự chọn dự phòng khác.
UPDATE agent SET model_du_phong = 'gpt-6-luna'
  WHERE id = 'tu_van' AND nha_du_phong = 'openai' AND model_du_phong = 'gpt-6-sol';
