-- 011: Đội AI dẫn (SPEC.md bản 2.9, #49, F-46): lựa chọn thứ tư cho Phòng live — đội nhân vật AI nhiều giọng dẫn như
-- talk show. Chủ dự án (24/9/2026): "nên cho nhiều AI với nhiều giọng thay nhau live, có cả nam, nữ…".
-- Chỉ có nghĩa khi che_do_ai = 'goi_y' (không mở miệng Live): chép lời người dẫn, Director, Co-host chạy như "Chỉ gợi ý",
-- đội AI đọc câu Co-host đã qua Bộ kiểm tra. Thêm cột như mai_dan (nâng cấp 010) để khỏi dựng lại bảng phien_live.
ALTER TABLE phien_live ADD COLUMN doi_ai INTEGER NOT NULL DEFAULT 0 CHECK (doi_ai IN (0, 1));
