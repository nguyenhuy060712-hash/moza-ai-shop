-- 005: Soát tin — nút "Xem thử AI hiểu gì" (SPEC.md F-23, mục 6).
-- Một dòng Agent riêng để chọn model trong Cài đặt, ghi nhật ký và chi phí như Agent khác. Không có công cụ:
-- AI chỉ đọc đúng ô Thông tin của tin và trả phiếu. Model theo mục 6 (Claude Opus 5.5, suy nghĩ cao);
-- dự phòng gpt-6-sol để nút vẫn chạy khi chưa có khóa Anthropic.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('soat_tin', 'Soát tin', 'Nút "Xem thử AI hiểu gì": đọc thử một tin như người tìm việc, chỉ ra câu mơ hồ và chỗ mâu thuẫn. Kết quả không lưu vào tin.',
   'anthropic', 'claude-opus-5-5', 'cao', 'openai', 'gpt-6-sol', '[]', '{"so_buoc":2,"giay":120}');
