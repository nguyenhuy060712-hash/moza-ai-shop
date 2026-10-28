'use strict';

/**
 * Danh sách mọi công cụ của AI (A.6, F-08). Mọi hành động của AI đi qua đây.
 * Không có công cụ nào xóa dữ liệu, sửa sản phẩm (trừ đổi trạng thái qua "Nói với Mai", có người bấm "Làm"),
 * sửa giá, sửa Sổ tay hay sửa Skill — cố ý (A.1, F-62).
 *
 * Mỗi công cụ: ten, moTa (cho AI đọc), nhom ('doc' | 'noi_bo' | 'co_anh_huong'), macDinh (luật quyền
 * khi người dùng chưa đặt), thamSo (lược đồ JSON, dùng `strict`), giay (thời gian tối đa, mặc định 10),
 * chay(thamSo, ctx), tùy chọn cauRaNgoai(thamSo, ctx) → câu cần qua Bộ kiểm tra, và xemTruoc(thamSo, ctx) → bảng xem
 * trước cho việc cần người bấm "Làm" (F-62).
 * Công cụ phòng live (Director, Co-host, Người đóng vai) ở phong-live.js; của Tư vấn viên ở hop-thu.js (M5).
 */

const CONG_CU = new Map();

const TEN_NHOM = { doc: 'Đọc', noi_bo: 'Nội bộ', co_anh_huong: 'Có ảnh hưởng thật' };

/** Thêm một công cụ. Trùng tên là lỗi lập trình. */
function dangKy(c) {
  if (CONG_CU.has(c.ten)) throw new Error(`Công cụ ${c.ten} đã có`);
  CONG_CU.set(c.ten, c);
}

for (const f of ['mo-so-tay', 'mo-skill', 'an-binh-luan', 'gui-the-moza']) dangKy(require(`./${f}`));
for (const c of require('./san-pham')) dangKy(c);
for (const c of require('./quan-ly')) dangKy(c);
for (const c of require('./phong-live')) dangKy(c);
for (const c of require('./hop-thu')) dangKy(c);
for (const c of require('./don')) dangKy(c);

function layCongCu(ten) {
  return CONG_CU.get(ten) || null;
}

function danhSachCongCu() {
  return [...CONG_CU.values()];
}

module.exports = { layCongCu, danhSachCongCu, dangKy, TEN_NHOM };
