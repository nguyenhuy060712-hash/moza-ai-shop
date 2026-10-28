-- 017: Màn hình sản phẩm + OBS (SPEC.md #90, chủ dự án duyệt 26/9/2026): video của sản phẩm (shop tự quay, tối đa 3 clip
-- [{tep, mau}]) để chiếu lên màn hình sản phẩm; ảnh vẫn ở cột anh.
ALTER TABLE san_pham ADD COLUMN video TEXT NOT NULL DEFAULT '[]';
