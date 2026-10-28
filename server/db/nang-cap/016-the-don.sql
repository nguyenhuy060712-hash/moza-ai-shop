-- 016: Thẻ đơn hàng có nút "Xác nhận đơn" / "Sửa đơn" trong Messenger (SPEC.md #89, chủ dự án chọn "cách A, có làm kèm" 26/9/2026).
-- the_gui: khóa phiên bản đơn của thẻ vừa gửi (mã đơn | tổng tiền | mốc sửa món) — không gửi trùng; khách bấm nút trên thẻ cũ
-- (đơn đã đổi sau đó) thì không xác nhận nhầm mà gửi lại thẻ mới.
ALTER TABLE don ADD COLUMN the_gui TEXT;

-- Tư vấn viên có thêm công cụ gửi (lại) thẻ đơn.
UPDATE agent SET cong_cu = json_insert(cong_cu, '$[#]', 'gui_the_don')
  WHERE id = 'tu_van' AND NOT EXISTS (SELECT 1 FROM json_each(agent.cong_cu) WHERE value = 'gui_the_don');
