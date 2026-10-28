-- 010: Mai dẫn chính (SPEC.md bản 2.7, #47, F-43): lựa chọn thứ ba cho Phòng live — Mai cầm chương trình, người dẫn
-- thật là người dẫn phụ. Chủ dự án (24/9/2026): "Mai không dẫn liên tục… cho thêm một lựa chọn là Mai chủ động dẫn".
-- Chỉ có nghĩa khi che_do_ai = 'noi' (miệng mở): mọi việc của "Mai nói" giữ nguyên, MOZA cầm nhịp thêm. Thêm cột thay vì
-- thêm giá trị vào che_do_ai để khỏi dựng lại bảng phien_live (SQLite không sửa được ràng buộc CHECK tại chỗ).
ALTER TABLE phien_live ADD COLUMN mai_dan INTEGER NOT NULL DEFAULT 0 CHECK (mai_dan IN (0, 1));
