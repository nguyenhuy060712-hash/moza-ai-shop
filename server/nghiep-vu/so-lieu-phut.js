'use strict';

/**
 * Số liệu buổi live theo phút (SPEC.md F-116; docs/11 mục 6.1) — bảng `so_lieu_phut` (nâng cấp 024). Phút = số phút kể từ lúc lên
 * sóng. Người xem do phòng live ghi (live_views mỗi 60 giây); bình luận, chốt, câu hỏi đếm lại từ bảng có sẵn mỗi lần ghi (ghi lại
 * cùng phút chỉ cập nhật — không cộng dồn hai lần). Không AI, 0 đồng.
 */

const { csdl } = require('../db/ket-noi');
const { gio, boDau } = require('./chung');

const phutCua = (p, luc) => Math.max(0, Math.floor((new Date(luc) - new Date(p.bat_dau)) / 60000));
const iso = (ms) => new Date(ms).toISOString();

/** Ghi / cập nhật dòng của phút đang chạy. `nguoiXem` null thì giữ số đã có. @returns {object|null} dòng vừa ghi */
function ghiPhut(phienId, { nguoiXem = null, bayGio = Date.now() } = {}) {
  const db = csdl();
  const p = db.prepare('SELECT id, bat_dau FROM phien_live WHERE id = ?').get(phienId);
  if (!p?.bat_dau) return null;
  const phut = phutCua(p, bayGio);
  const tu = iso(new Date(p.bat_dau).getTime() + phut * 60e3);
  const den = iso(new Date(p.bat_dau).getTime() + (phut + 1) * 60e3);
  const bl = db.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN nhan LIKE '%"cau_hoi"%' THEN 1 ELSE 0 END) AS hoi FROM binh_luan_live
                         WHERE phien_id = ? AND luc_nhan >= ? AND luc_nhan < ? AND nhan NOT LIKE '%"cua_page"%'`).get(phienId, tu, den);
  const chot = db.prepare(`SELECT COUNT(*) AS n FROM don WHERE phien_live_id = ? AND trang_thai <> 'da_huy' AND tao_luc >= ? AND tao_luc < ?`).get(phienId, tu, den).n;
  const xem = nguoiXem == null || !Number.isFinite(Number(nguoiXem)) ? null : Math.max(0, Math.round(Number(nguoiXem)));
  db.prepare(`INSERT INTO so_lieu_phut (phien_id, phut, nguoi_xem, binh_luan, chot, cau_hoi) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (phien_id, phut) DO UPDATE SET nguoi_xem = COALESCE(excluded.nguoi_xem, so_lieu_phut.nguoi_xem),
                binh_luan = excluded.binh_luan, chot = excluded.chot, cau_hoi = excluded.cau_hoi`)
    .run(phienId, phut, xem, bl.n || 0, chot, bl.hoi || 0);
  return db.prepare('SELECT * FROM so_lieu_phut WHERE phien_id = ? AND phut = ?').get(phienId, phut);
}

/** Cả buổi, theo thứ tự phút. */
function docPhien(phienId) {
  return csdl().prepare('SELECT phut, nguoi_xem, binh_luan, chot, cau_hoi FROM so_lieu_phut WHERE phien_id = ? ORDER BY phut').all(phienId);
}

/**
 * Câu hỏi chưa ai trả lời quá `giay` giây (F-116 cảnh báo 1). Coi là đã trả lời khi: Co-host / tư vấn size đã xử lý (`xu_ly` khác
 * 'moi'), người dẫn bấm "Đã trả lời" / dùng chạm để trả lời (`tra_loi_luc`), hoặc sau câu hỏi có lời Mai / Đội AI / người dẫn nhắc
 * đúng số món của đoạn đó. Chỉ xét câu hỏi trong 10 phút gần nhất.
 * @returns {{id, ten, noi_dung, luc_nhan, san_pham_doan}[]}
 */
function cauHoiChuaTraLoi(phienId, { giay = 60, bayGio = Date.now() } = {}) {
  const db = csdl();
  const ds = db.prepare(`SELECT b.id, b.ten, b.noi_dung, b.luc_nhan, b.san_pham_doan, s.so FROM binh_luan_live b
                         LEFT JOIN san_pham s ON s.id = b.san_pham_doan
                         WHERE b.phien_id = ? AND b.nhan LIKE '%"cau_hoi"%' AND b.nhan NOT LIKE '%"cua_page"%' AND b.xu_ly = 'moi'
                           AND b.tra_loi_luc IS NULL AND b.don_id IS NULL AND b.da_an = 0 AND b.luc_nhan < ? AND b.luc_nhan >= ?
                         ORDER BY b.luc_nhan`).all(phienId, iso(bayGio - giay * 1000), iso(bayGio - 10 * 60e3));
  if (!ds.length) return [];
  const loi = db.prepare(`SELECT luc, noi_dung FROM nhat_ky_song WHERE phien_id = ? AND loai IN ('mai', 'doi_ai', 'nguoi_dan') AND luc >= ?`)
    .all(phienId, ds[0].luc_nhan).map((x) => ({ luc: x.luc, chu: boDau(x.noi_dung) }));
  return ds.filter((b) => !(b.so != null && loi.some((l) => l.luc > b.luc_nhan && new RegExp(`(^|\\D)${b.so}(\\D|$)`).test(l.chu))))
    .map(({ so, ...b }) => b);
}

const TU_CHOT = /(?<![a-z])(chot|gia|cu phap|cmt|comment|binh luan so)(?![a-z])|\d+\s*(k|nghin|ngan|trieu|tr)(?![a-z])/;

/** Lúc gần nhất lời Mai / Đội AI / người dẫn nhắc cách chốt hoặc giá (F-116 cảnh báo 3); null nếu chưa nhắc lần nào. */
function lanNhacChotCuoi(phienId) {
  const ds = csdl().prepare(`SELECT luc, noi_dung FROM nhat_ky_song WHERE phien_id = ? AND loai IN ('mai', 'doi_ai', 'nguoi_dan')
                             ORDER BY luc DESC LIMIT 400`).all(phienId);
  return ds.find((x) => TU_CHOT.test(boDau(x.noi_dung)))?.luc || null;
}

/** Người dẫn bấm "Đã trả lời" / dùng chạm để trả lời (F-115). */
function danhDauDaTraLoi(phienId, binhLuanId) {
  const r = csdl().prepare('UPDATE binh_luan_live SET tra_loi_luc = COALESCE(tra_loi_luc, ?) WHERE id = ? AND phien_id = ?').run(gio(), binhLuanId, phienId);
  return r.changes > 0;
}

/**
 * F-126 bình luận lọc "Khách cũ": người bình luận đã có đơn (chưa hủy) ở buổi khác hoặc qua tin nhắn. Chỉ để lọc trên Màn hình người
 * dẫn — không nói trên sóng.
 */
function laKhachCu(phienId, nguoiFbUserId) {
  if (!nguoiFbUserId) return false;
  return !!csdl().prepare(`SELECT 1 FROM don d JOIN nguoi_fb n ON n.id = d.nguoi_fb_id
                            WHERE n.fb_user_id = ? AND d.trang_thai <> 'da_huy' AND (d.phien_live_id IS NULL OR d.phien_live_id <> ?) LIMIT 1`)
    .get(nguoiFbUserId, phienId);
}

module.exports = { ghiPhut, docPhien, cauHoiChuaTraLoi, lanNhacChotCuoi, danhDauDaTraLoi, laKhachCu, TU_CHOT };
