-- 008: Giọng riêng của Mai (SPEC.md bản 2.5, #41, F-38).
-- Các giọng Mai đã lưu: giọng tự tả (Google tạo theo câu tả), giọng nhân bản (người thật, có câu đồng ý),
-- giọng lấy từ kho có sẵn của Google. Giọng đang dùng và model đọc nằm ở cai_dat khóa 'giong_mai'.
-- Bản nghe thử lưu thành tệp ở data/giong/mai-<id>.wav, không để trong cơ sở dữ liệu.
CREATE TABLE giong_mai (
  id        TEXT PRIMARY KEY,               -- mã giọng của Google: voice_… (tự tạo) hoặc mã giọng kho như vi-vn-advisor-1
  ten       TEXT NOT NULL,
  loai      TEXT NOT NULL CHECK (loai IN ('ta', 'nhan_ban', 'kho')),
  mo_ta     TEXT NOT NULL DEFAULT '',       -- câu tả gửi Google, hoặc mô tả của giọng kho
  lua_chon  TEXT NOT NULL DEFAULT '{}',     -- JSON: giới tính, tuổi, vùng, chất giọng đã chọn khi tả
  gioi      TEXT,                           -- 'nu' | 'nam' | NULL
  tao_luc   TEXT NOT NULL,
  het_han   TEXT                            -- Google giữ giọng tự tạo 1 năm; giọng kho không hết hạn
);
