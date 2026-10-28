-- 009: Agent "Soạn kịch bản" (SPEC.md bản 2.5, F-37): AI soạn kịch bản live từ các tin Còn tuyển — mỗi đoạn có
-- lời dẫn cho người dẫn ("Người dẫn: …") và câu Mai nói ("Mai: …"). Chủ dự án thấy "vào diễn tập chẳng biết dẫn gì,
-- Mai cũng chưa biết nói gì" (24/9/2026). Model theo não của Mai (#39: gpt-6-sol), dự phòng gemini-3.8-flash.
-- Không có công cụ: đọc ô Thông tin của các tin, trả phiếu kịch bản.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('soan_kich_ban', 'Soạn kịch bản', 'Soạn kịch bản live từ các tin Còn tuyển: mỗi đoạn có lời dẫn cho người dẫn và câu Mai nói, số liệu lấy đúng từ tin.',
   'openai', 'gpt-6-sol', 'thap', 'gemini', 'gemini-3.8-flash', '[]', '{"so_buoc":2,"giay":180}');
