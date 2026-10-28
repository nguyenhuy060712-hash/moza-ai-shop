-- 014: Diễn tập chạy trọn quy trình bán hàng như thật (SPEC.md #87, chủ dự án duyệt "cách 1" ngày 26/9/2026).
-- Buổi tập dùng kho thật (giữ hàng, trừ tồn khi gửi); "Kết thúc buổi tập" trả toàn bộ hàng của buổi tập về kho —
-- tra_kho_luc đánh dấu đơn diễn tập đã được trả, để không trả hai lần và không đổi trạng thái tiếp.
ALTER TABLE don ADD COLUMN tra_kho_luc TEXT;

-- Khách giả (F-15 mở rộng): AI đóng vai khách trả lời tin nhắn của Tư vấn viên trong Phòng diễn tập — gửi thông tin giao,
-- hỏi ship, đổi size, thêm món, hủy, im lặng. Chỉ chạy với Facebook giả. Model rẻ nhất: gpt-6-luna, dự phòng flash-lite.
INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han) VALUES
  ('khach_gia', 'Khách giả (Phòng diễn tập)', 'Đóng vai khách mua hàng trả lời tin nhắn của shop trong Phòng diễn tập, theo tính cách được giao, để tập trọn quy trình chốt đơn.',
   'openai', 'gpt-6-luna', 'tat', 'gemini', 'gemini-3.5-flash-lite', '[]', '{"so_buoc":1,"giay":20}');
