'use strict';

/**
 * Lượt nhắn riêng của từng bình luận (SPEC.md F-65, #95). Meta chỉ cho nhắn riêng MỘT tin cho mỗi bình luận, nên mọi đường
 * muốn nhắn riêng (thẻ giữ hàng khi chốt, thẻ "ib", thẻ mời khi hỏi mua, Tư vấn viên khi Director chuyển, nhắn bù, chốt test)
 * phải "giữ lượt" trước. Ai giữ trước thì gửi; các đường khác bỏ — không còn lỗi DA_NHAN_RIENG vì hai đường cùng nhắn.
 * Giữ lượt là một câu INSERT OR IGNORE (SQLite ghi tuần tự: 20 lời gọi cùng lúc thì đúng 1 người thắng).
 * Gửi lỗi thật (không phải "không rõ") → trạng thái 'loi': lượt còn đó để nhắn bù.
 */

const { csdl } = require('../db/ket-noi');
const { gio } = require('./chung');

const DOC = (r) => (r ? { ...r, chi_tiet: r.chi_tiet ? JSON.parse(r.chi_tiet) : null } : null);

/**
 * Giữ lượt nhắn riêng của một bình luận.
 * @returns {{thang:boolean, luot:object}}  thang = true nếu người gọi được gửi
 */
function giu({ fbCommentId, pageId = null, boi, binhLuanId = null, hoiThoaiId = null, chiTiet = null }) {
  const db = csdl();
  const ct = chiTiet ? JSON.stringify(chiTiet) : null;
  let n = db.prepare(`INSERT OR IGNORE INTO luot_nhan_rieng (fb_comment_id, page_id, boi, binh_luan_id, hoi_thoai_id, trang_thai, chi_tiet, luc)
                      VALUES (?, ?, ?, ?, ?, 'giu', ?, ?)`).run(fbCommentId, pageId, boi, binhLuanId, hoiThoaiId, ct, gio()).changes;
  // Lượt trước gửi lỗi thật → giữ lại được (nhắn bù).
  if (!n) {
    n = db.prepare(`UPDATE luot_nhan_rieng SET boi = ?, trang_thai = 'giu', hoi_thoai_id = COALESCE(?, hoi_thoai_id), chi_tiet = COALESCE(?, chi_tiet), luc = ?
                    WHERE fb_comment_id = ? AND trang_thai = 'loi'`).run(boi, hoiThoaiId, ct, gio(), fbCommentId).changes;
  }
  return { thang: n > 0, luot: lay(fbCommentId) };
}

function lay(fbCommentId) {
  return DOC(csdl().prepare('SELECT * FROM luot_nhan_rieng WHERE fb_comment_id = ?').get(fbCommentId));
}

function daGui(fbCommentId, { hoiThoaiId = null } = {}) {
  csdl().prepare("UPDATE luot_nhan_rieng SET trang_thai = 'da_gui', hoi_thoai_id = COALESCE(?, hoi_thoai_id) WHERE fb_comment_id = ?").run(hoiThoaiId, fbCommentId);
}

/** Gửi lỗi thật: trả lượt (còn nhắn bù được). */
function loi(fbCommentId) {
  csdl().prepare("UPDATE luot_nhan_rieng SET trang_thai = 'loi' WHERE fb_comment_id = ?").run(fbCommentId);
}

/** Bình luận đã có đường khác giữ / đã dùng lượt (Director, Hộp thư bỏ qua). */
function daCoLuot(fbCommentId) {
  return !!csdl().prepare("SELECT 1 FROM luot_nhan_rieng WHERE fb_comment_id = ? AND trang_thai IN ('giu', 'da_gui')").get(fbCommentId);
}

/** Các lượt của một người trong khoảng thời gian (luật "không có tin riêng nào trong 5 phút" của thẻ mời — F-71). */
function ganDayCuaHoiThoai(hoiThoaiIds, tuLuc) {
  if (!hoiThoaiIds.length) return [];
  return csdl().prepare(`SELECT * FROM luot_nhan_rieng WHERE hoi_thoai_id IN (${hoiThoaiIds.map(() => '?').join(',')}) AND luc >= ?`)
    .all(...hoiThoaiIds, tuLuc).map(DOC);
}

/** Đếm theo loại trong một phiên (Phòng diễn tập, báo cáo). */
function demTheoBoi(binhLuanIds) {
  if (!binhLuanIds.length) return {};
  const ds = csdl().prepare(`SELECT boi, trang_thai, COUNT(*) AS n FROM luot_nhan_rieng WHERE binh_luan_id IN (${binhLuanIds.map(() => '?').join(',')})
                             GROUP BY boi, trang_thai`).all(...binhLuanIds);
  const kq = {};
  for (const r of ds) kq[`${r.boi}:${r.trang_thai}`] = r.n;
  return kq;
}

/**
 * Người chốt trên live đã nhận thẻ giữ hàng từ trước `truocLuc` mà chưa bấm nút hay nhắn gì (đơn còn chờ, khach_bam_luc trống)
 * — để nhắc trên sóng mở mục Tin nhắn chờ (F-70). Mỗi đơn một dòng, thẻ cũ nhất trước.
 */
function choPhanHoi(phienId, truocLuc) {
  return csdl().prepare(`SELECT d.id AS don_id, d.nguoi_fb_id, bl.id AS binh_luan_id, bl.ten, bl.nhan, MIN(l.luc) AS the_luc
                          FROM don d JOIN binh_luan_live bl ON bl.don_id = d.id
                          JOIN luot_nhan_rieng l ON l.binh_luan_id = bl.id AND l.boi IN ('the_giu_hang', 'nhan_bu') AND l.trang_thai = 'da_gui'
                          WHERE d.phien_live_id = ? AND d.trang_thai = 'cho_xac_nhan' AND d.khach_bam_luc IS NULL AND l.luc <= ?
                          GROUP BY d.id ORDER BY the_luc, MIN(bl.luc_fb)`).all(phienId, truocLuc).map((r) => ({ ...r, nhan: JSON.parse(r.nhan || '[]') }));
}

/** Người này đã được mời (thẻ mời F-71) món này trong buổi chưa — mỗi món một thẻ mời mỗi buổi. */
function daMoi({ phienId, nguoiFbId, sanPhamId }) {
  return !!csdl().prepare(`SELECT 1 FROM luot_nhan_rieng l JOIN binh_luan_live bl ON bl.id = l.binh_luan_id JOIN hoi_thoai h ON h.id = l.hoi_thoai_id
                            WHERE l.boi = 'the_moi' AND l.trang_thai IN ('giu', 'da_gui') AND bl.phien_id = ? AND h.nguoi_fb_id = ?
                              AND json_extract(l.chi_tiet, '$.san_pham_id') = ? LIMIT 1`).get(phienId, nguoiFbId, sanPhamId);
}

module.exports = { choPhanHoi, daMoi, giu, lay, daGui, loi, daCoLuot, ganDayCuaHoiThoai, demTheoBoi };
