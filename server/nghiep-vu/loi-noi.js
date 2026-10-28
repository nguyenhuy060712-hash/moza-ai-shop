'use strict';

/**
 * Sổ lỗi số Mai nói trên sóng (SPEC.md F-105) và "khoảng nói nhầm" có lợi cho khách (F-106). Chỉ chữ, không tiếng.
 */

const { csdl } = require('../db/ket-noi');
const { taoId, gio } = require('./chung');

/**
 * @param {{phienId:string, cau:string, loi:object, model?:string|null, dienTap?:boolean, dinhChinhLuc?:string|null, hetKhoangLuc?:string|null}} o
 * @returns {object} dòng đã ghi
 */
function ghi({ phienId, cau, loi, model = null, dienTap = false, dinhChinhLuc = null, hetKhoangLuc = null }) {
  const id = taoId('ln');
  csdl().prepare(`INSERT INTO loi_noi_song (id, phien_live_id, luc, cau, loai, muc, san_pham_id, gia_tri_noi, gia_tri_dung, dinh_chinh_luc,
      het_khoang_luc, model, dien_tap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, phienId, gio(), String(cau).slice(0, 300), loi.loai, loi.muc, loi.san_pham_id || null, loi.noi ?? null, loi.dung ?? null,
      dinhChinhLuc, hetKhoangLuc, model, dienTap ? 1 : 0);
  return lay(id);
}

const lay = (id) => csdl().prepare('SELECT * FROM loi_noi_song WHERE id = ?').get(id) || null;

/** Số lỗi "chắc" của buổi (3 lỗi → hạ về "Chỉ gợi ý"). */
function demChac(phienId) {
  return csdl().prepare("SELECT COUNT(*) AS n FROM loi_noi_song WHERE phien_live_id = ? AND muc = 'chac'").get(phienId).n;
}

/** Lỗi có lợi cho khách đang mở khoảng lúc `luc` (F-106): giá / phí ship Mai nói thấp hơn, chưa hết khoảng. */
function khoangMo(phienId, luc = gio()) {
  return csdl().prepare(`SELECT * FROM loi_noi_song WHERE phien_live_id = ? AND het_khoang_luc IS NOT NULL AND luc <= ? AND het_khoang_luc >= ?
      ORDER BY luc`).all(phienId, luc, luc);
}

function danhSach(phienId) {
  return csdl().prepare('SELECT * FROM loi_noi_song WHERE phien_live_id = ? ORDER BY luc').all(phienId);
}

module.exports = { ghi, lay, demChac, khoangMo, danhSach };
