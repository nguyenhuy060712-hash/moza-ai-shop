'use strict';

/**
 * Đồng ý nhận tin báo live — TỪNG BUỔI, trong 24 giờ (SPEC.md F-97, #117, 6.3 cách A+B). Mọi SQL của bảng dong_y_nhan_tin ở đây.
 * Bằng chứng đồng ý (Luật 91/2025 Điều 28): nguyên văn câu hỏi, id tin mời, giờ bấm, id tin bấm. Không phải danh sách tiếp thị:
 *  - chỉ mời khi buổi kế bắt đầu trong 23 giờ tới; mỗi người tối đa 1 lời mời mỗi buổi và 1 lời mời mỗi ngày;
 *  - bấm "Thôi" → không mời lại 7 ngày; gõ DỪNG → rút mọi đồng ý, không mời nữa;
 *  - báo lên sóng chỉ khi còn trong 24 giờ kể từ lúc bấm đồng ý (cửa sổ tin nhắn của Meta).
 * tra_loi: cho · dong_y · thoi.
 */

const { csdl } = require('../db/ket-noi');
const { taoId, gio, LoiNghiepVu } = require('./chung');

const MOI_TRUOC_MS = 23 * 3600e3;
const CUA_SO_MS = 24 * 3600e3;
const THOI_CHO_MS = 7 * 86400e3;

const doc = (r) => (r ? { ...r, dien_tap: !!r.dien_tap } : null);

function lay(id) {
  return doc(csdl().prepare('SELECT * FROM dong_y_nhan_tin WHERE id = ?').get(id));
}

/** Đầu ngày (giờ Việt Nam) dạng ISO. */
function dauNgayVN(t = Date.now()) {
  const d = new Date(new Date(t).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  return new Date(`${d}T00:00:00+07:00`).toISOString();
}

/**
 * Được mời người này cho buổi `buoi` (ISO) lúc này không.
 * @returns {{duoc:boolean, ly_do?:string}}
 */
function coTheMoi(nguoiFbId, buoi, bayGio = Date.now()) {
  if (!nguoiFbId || !buoi) return { duoc: false, ly_do: 'Thiếu người hoặc buổi.' };
  const con = new Date(buoi).getTime() - bayGio;
  if (con <= 0 || con > MOI_TRUOC_MS) return { duoc: false, ly_do: 'Chỉ mời khi buổi kế bắt đầu trong 23 giờ tới.' };
  if (require('./lien-he').daNgung(nguoiFbId)) return { duoc: false, ly_do: 'Người này đã gõ DỪNG.' };
  const db = csdl();
  if (db.prepare('SELECT 1 FROM dong_y_nhan_tin WHERE nguoi_fb_id = ? AND buoi = ?').get(nguoiFbId, buoi)) return { duoc: false, ly_do: 'Đã mời buổi này.' };
  if (db.prepare("SELECT 1 FROM dong_y_nhan_tin WHERE nguoi_fb_id = ? AND tra_loi = 'thoi' AND tra_loi_luc > ?").get(nguoiFbId, new Date(bayGio - THOI_CHO_MS).toISOString())) {
    return { duoc: false, ly_do: 'Người này bấm "Thôi" trong 7 ngày qua.' };
  }
  if (db.prepare('SELECT 1 FROM dong_y_nhan_tin WHERE nguoi_fb_id = ? AND tao_luc >= ?').get(nguoiFbId, dauNgayVN(bayGio))) return { duoc: false, ly_do: 'Hôm nay đã mời người này.' };
  return { duoc: true };
}

/** Ghi một lời mời (trước khi gửi). Trùng người + buổi → lỗi. */
function taoLoiMoi({ pageId = null, nguoiFbId, hoiThoaiId = null, buoi, cauHoi, dienTap = false }) {
  const id = taoId('dy');
  try {
    csdl().prepare(`INSERT INTO dong_y_nhan_tin (id, page_id, nguoi_fb_id, hoi_thoai_id, buoi, cau_hoi, tra_loi, dien_tap, tao_luc)
                    VALUES (?, ?, ?, ?, ?, ?, 'cho', ?, ?)`).run(id, pageId, nguoiFbId, hoiThoaiId, buoi, String(cauHoi), dienTap ? 1 : 0, gio());
  } catch {
    throw new LoiNghiepVu('DA_MOI', 'Đã mời người này cho buổi này.', 409);
  }
  return lay(id);
}

function ghiTinHoi(id, tinId) {
  csdl().prepare('UPDATE dong_y_nhan_tin SET tin_hoi_id = COALESCE(tin_hoi_id, ?) WHERE id = ?').run(tinId || null, id);
}

/** Khách bấm [Báo em buổi này] / [Thôi]. Chỉ lời mời còn chờ, của đúng người bấm. */
function traLoi(id, nguoiFbId, traLoiMoi, tinId = null) {
  const d = lay(id);
  if (!d || d.nguoi_fb_id !== nguoiFbId) throw new LoiNghiepVu('KHONG_PHAI_CUA_BAN', 'Lời mời không phải của người này.', 403);
  if (!['dong_y', 'thoi'].includes(traLoiMoi)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Trả lời lạ.');
  if (d.rut_luc) return d;
  csdl().prepare('UPDATE dong_y_nhan_tin SET tra_loi = ?, tra_loi_luc = ?, tin_tra_loi_id = ? WHERE id = ?').run(traLoiMoi, gio(), tinId, id);
  return lay(id);
}

/** DỪNG: rút mọi đồng ý của người này. */
function rutCuaNguoi(nguoiFbId) {
  return csdl().prepare('UPDATE dong_y_nhan_tin SET rut_luc = COALESCE(rut_luc, ?) WHERE nguoi_fb_id = ?').run(gio(), nguoiFbId).changes;
}

/** Xóa dữ liệu người này (F-54 / F-97): xóa bản ghi đồng ý. */
function xoaCuaNguoi(nguoiFbId) {
  return csdl().prepare('DELETE FROM dong_y_nhan_tin WHERE nguoi_fb_id = ?').run(nguoiFbId).changes;
}

/**
 * Người đã đồng ý buổi `buoi`, chưa nhắn, chưa rút — chia hai nhóm: còn trong 24 giờ (được nhắn) và quá 24 giờ (không nhắn).
 * @returns {{nhan:object[], qua_24:object[]}}
 */
function canNhac(buoi, { dienTap = null, bayGio = Date.now() } = {}) {
  const ds = csdl().prepare(`SELECT * FROM dong_y_nhan_tin WHERE buoi = ? AND tra_loi = 'dong_y' AND rut_luc IS NULL AND nhac_luc IS NULL
                             ${dienTap === null ? '' : 'AND dien_tap = ?'} ORDER BY tra_loi_luc`).all(...[buoi, ...(dienTap === null ? [] : [dienTap ? 1 : 0])]).map(doc);
  const conHan = (d) => bayGio - new Date(d.tra_loi_luc).getTime() < CUA_SO_MS;
  return { nhan: ds.filter(conHan), qua_24: ds.filter((d) => !conHan(d)) };
}

function ghiNhac(id, { tinId = null, lyDo = null } = {}) {
  csdl().prepare('UPDATE dong_y_nhan_tin SET nhac_luc = ?, nhac_tin_id = ?, nhac_ly_do = ? WHERE id = ?').run(gio(), tinId, lyDo, id);
}

/** Đếm cho khối "Báo trước": đã đồng ý, đã nhắn, quá 24 giờ / không gửi được. */
function demBuoi(buoi) {
  const r = csdl().prepare(`SELECT
      SUM(tra_loi = 'dong_y' AND rut_luc IS NULL) AS dong_y,
      SUM(nhac_tin_id IS NOT NULL) AS da_nhan,
      SUM(nhac_luc IS NOT NULL AND nhac_tin_id IS NULL) AS khong_gui
    FROM dong_y_nhan_tin WHERE buoi = ?`).get(buoi);
  return { dong_y: r.dong_y || 0, da_nhan: r.da_nhan || 0, khong_gui: r.khong_gui || 0 };
}

module.exports = { MOI_TRUOC_MS, CUA_SO_MS, THOI_CHO_MS, lay, coTheMoi, taoLoiMoi, ghiTinHoi, traLoi, rutCuaNguoi, xoaCuaNguoi, canNhac, ghiNhac, demBuoi };
