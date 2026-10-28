-- GD1 (F-121, Q7): việc chờ duyệt do "Dừng mọi thứ" hoặc giới hạn tin gửi có hạn 24 giờ — quá hạn thì thôi đếm, không còn làm
-- "Chờ duyệt: 99" vàng mãi. Việc do luật quyền "Hỏi" (người chủ động đặt) không hết hạn (cột để trống).
-- Không đổi CHECK của `trang_thai`: mục quá hạn vẫn là 'cho', chỉ khác `het_han_luc` đã qua.
ALTER TABLE cho_duyet ADD COLUMN het_han_luc TEXT;

-- Việc cũ: đặt hạn = lúc tạo + 24 giờ cho các mục do "Dừng mọi thứ" / giới hạn tin sinh ra (nhận ra qua câu lý do).
UPDATE cho_duyet
   SET het_han_luc = strftime('%Y-%m-%dT%H:%M:%fZ', luc, '+24 hours')
 WHERE trang_thai = 'cho'
   AND (ly_do LIKE '"Dừng mọi thứ" đang bật%' OR ly_do LIKE 'Đã gửi 5 tin cho người này%');
