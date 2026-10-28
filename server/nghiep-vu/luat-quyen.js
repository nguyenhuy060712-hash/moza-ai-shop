'use strict';

/**
 * Luật quyền Cho phép / Hỏi / Cấm (F-08) và công tắc bật/tắt hook (F-09).
 * Luật cứng nằm trong mã; bảng chỉ giữ lựa chọn của người dùng.
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId } = require('./chung');

const MUC = ['cho_phep', 'hoi', 'cam'];

function docLuat(r) {
  return { ...r, dieu_kien: JSON.parse(r.dieu_kien) };
}

// Ô điều kiện có giá trị null nghĩa là "tham số này bỏ trống" (ví dụ đổi trạng thái mà không có bằng chứng).
function khop(dieuKien, thamSo) {
  return Object.entries(dieuKien).every(([k, v]) => (v === null ? thamSo?.[k] == null || thamSo[k] === '' : thamSo?.[k] === v));
}

/** Mức quyền của một lần gọi: luật đầu tiên khớp thắng; không luật nào khớp thì dùng mặc định của công cụ. */
function mucQuyen(hanhDong, thamSo, macDinh) {
  const ds = csdl().prepare('SELECT * FROM luat_quyen WHERE hanh_dong = ? ORDER BY thu_tu, rowid').all(hanhDong).map(docLuat);
  const r = ds.find((l) => khop(l.dieu_kien, thamSo));
  return r ? { muc: r.muc, luat_id: r.id } : { muc: macDinh, luat_id: null };
}

function danhSachLuat() {
  return csdl().prepare('SELECT * FROM luat_quyen ORDER BY hanh_dong, thu_tu').all().map(docLuat);
}

/** Đặt mức chung (không điều kiện) cho một hành động. `null` = trở về mặc định của công cụ. */
function datMuc(hanhDong, muc) {
  if (muc !== null && !MUC.includes(muc)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Mức phải là Cho phép, Hỏi hoặc Cấm.');
  giaoDich((db) => {
    db.prepare("DELETE FROM luat_quyen WHERE hanh_dong = ? AND dieu_kien = '{}'").run(hanhDong);
    // Luật chung đứng sau mọi luật có điều kiện: điều kiện hẹp hơn nên được xét trước.
    if (muc) db.prepare("INSERT INTO luat_quyen (id, hanh_dong, dieu_kien, muc, thu_tu) VALUES (?, ?, '{}', ?, 1000)").run(taoId('lq'), hanhDong, muc);
  });
}

/* ---------------- bật/tắt hook ---------------- */

function hookDangBat(id, macDinh = true) {
  const r = csdl().prepare('SELECT bat FROM hook_bat WHERE id = ?').get(id);
  return r ? r.bat === 1 : macDinh;
}

function datHookBat(id, bat) {
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  csdl().prepare('INSERT INTO hook_bat (id, bat) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET bat = excluded.bat').run(id, bat ? 1 : 0);
  return bat;
}

module.exports = { MUC, mucQuyen, danhSachLuat, datMuc, hookDangBat, datHookBat };
