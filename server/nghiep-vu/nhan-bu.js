'use strict';

/**
 * Danh sách nhắn bù (SPEC.md F-73, #102; F-67 L13): người chốt trên live mà thẻ giữ hàng chưa gửi được vì
 *   - Page bị Meta tạm khóa nhắn tin (ly_do 'page_bi_cam') → NGƯỜI quyết: nhắn bù từng người / tất cả / bỏ, rải 3 tin mỗi phút;
 *   - Facebook giới hạn lượt gọi lúc đông (ly_do 'gioi_han_goi') → MOZA tự gửi lại.
 * Hạn = lúc bình luận + 7 ngày (hạn nhắn riêng của Meta) — quá hạn thì 'het_han', không gửi.
 */

const { csdl } = require('../db/ket-noi');
const { taoId, gio } = require('./chung');

const NGAY_MS = 86400e3;

function them({ fbCommentId, binhLuanId = null, donId = null, pageId = null, ten = '', lyDo, binhLuanLuc = null, dienTap = false }) {
  const db = csdl();
  const cu = db.prepare("SELECT id FROM nhan_bu WHERE fb_comment_id = ? AND trang_thai = 'cho'").get(fbCommentId);
  if (cu) {
    db.prepare('UPDATE nhan_bu SET ly_do = ?, don_id = COALESCE(?, don_id) WHERE id = ?').run(lyDo, donId, cu.id);
    return lay(cu.id);
  }
  const id = taoId('nb');
  const han = new Date(new Date(binhLuanLuc || gio()).getTime() + 7 * NGAY_MS).toISOString();
  db.prepare(`INSERT INTO nhan_bu (id, fb_comment_id, binh_luan_id, don_id, page_id, ten, han_luc, trang_thai, ly_do, dien_tap, tao_luc)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'cho', ?, ?, ?)`).run(id, fbCommentId, binhLuanId, donId, pageId, String(ten || '').slice(0, 100), han, lyDo, dienTap ? 1 : 0, gio());
  return lay(id);
}

function lay(id) {
  const r = csdl().prepare('SELECT * FROM nhan_bu WHERE id = ?').get(id);
  return r ? { ...r, dien_tap: r.dien_tap === 1 } : null;
}

/** Danh sách chờ nhắn bù (quá hạn tự thành het_han). */
function danhSach({ trangThai = 'cho', lyDo = null, dienTap = null } = {}) {
  const db = csdl();
  db.prepare("UPDATE nhan_bu SET trang_thai = 'het_han', xu_ly_luc = ? WHERE trang_thai = 'cho' AND han_luc <= ?").run(gio(), gio());
  const dk = ['trang_thai = ?'];
  const ts = [trangThai];
  if (lyDo) { dk.push('ly_do = ?'); ts.push(lyDo); }
  if (dienTap !== null) { dk.push('dien_tap = ?'); ts.push(dienTap ? 1 : 0); }
  return db.prepare(`SELECT * FROM nhan_bu WHERE ${dk.join(' AND ')} ORDER BY tao_luc`).all(...ts).map((r) => ({ ...r, dien_tap: r.dien_tap === 1 }));
}

function dat(id, trangThai, lyDo = null) {
  csdl().prepare('UPDATE nhan_bu SET trang_thai = ?, ly_do = COALESCE(?, ly_do), xu_ly_luc = ? WHERE id = ?').run(trangThai, lyDo, gio(), id);
  return lay(id);
}

function dem({ dienTap = null } = {}) {
  return danhSach({ dienTap }).filter((x) => x.ly_do === 'page_bi_cam').length;
}

module.exports = { them, lay, danhSach, dat, dem };
