-- 013: mốc "lần sửa món gần nhất" của đơn (SPEC.md #79, mục 7). Thử AI thật 26/9/2026: Tư vấn viên thêm lại món MOZA
-- đã giữ từ bình luận chốt (x2 thành x4) và thêm món khi khách chỉ hỏi còn hàng. Từ nay AI chỉ thêm / bớt / đổi món theo
-- một tin của khách MỚI hơn mốc này, và tin đó phải là lời xin mua / đổi (không phải câu hỏi).
ALTER TABLE don ADD COLUMN mon_sua_luc TEXT;
UPDATE don SET mon_sua_luc = sua_luc;
