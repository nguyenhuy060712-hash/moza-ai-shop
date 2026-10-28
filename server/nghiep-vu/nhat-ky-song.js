'use strict';

/**
 * Nhật ký buổi live — chỉ chữ (SPEC.md F-80, #108). Ghi: lời Mai (theo câu), lời Đội AI, lời người dẫn (câu đã chốt của chép
 * lời), màn hình / cảnh, sự kiện. Đọc gộp thêm câu Co-host (cau_tren_song) và bình luận chốt gắn đơn (binh_luan_live) theo giờ —
 * không chép lại dữ liệu đã có. Giữ 90 ngày (mac-dinh.json nhat_ky_song.giu_ngay); bình luận không gắn đơn cùng hạn: xóa nội
 * dung và tên, giữ số đếm.
 */

const { csdl } = require('../db/ket-noi');
const { taoId, gio, chuan, boDau } = require('./chung');

const LOAI = ['mai', 'doi_ai', 'nguoi_dan', 'man_hinh', 'su_kien'];
const TEN_LOAI = { mai: 'Mai', doi_ai: 'Đội AI', nguoi_dan: 'Người dẫn', man_hinh: 'Màn hình', su_kien: 'Sự kiện', cohost: 'Co-host', chot: 'Chốt' };

function giuNgay() {
  return Number(require('../cau-hinh/mac-dinh.json').nhat_ky_song?.giu_ngay) || 90;
}

/**
 * @param {{phienId:string, loai:string, noiDung:string, sanPhamId?:string|null, canhBao?:string|null, luc?:string}} o
 */
function ghi({ phienId, loai, noiDung, sanPhamId = null, canhBao = null, luc = gio() }) {
  if (!phienId || !LOAI.includes(loai)) return null;
  const chu = chuan(String(noiDung || '')).replace(/\s+/g, ' ').trim().slice(0, 2000);
  if (!chu) return null;
  const id = taoId('nk');
  try {
    csdl().prepare('INSERT INTO nhat_ky_song (id, phien_id, luc, loai, noi_dung, san_pham_id, canh_bao) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, phienId, luc, loai, chu, sanPhamId, canhBao);
  } catch { return null; } // phiên không còn (đã xóa) — nhật ký không làm hỏng việc chính
  return id;
}

/**
 * Đọc gộp theo giờ: nhật ký + câu Co-host đã hiện / đã phát + bình luận chốt gắn đơn. `q` tìm chữ (bỏ dấu, "150k" tìm được).
 * @returns {{luc:string, loai:string, ten_loai:string, noi_dung:string, canh_bao:string|null}[]}
 */
function doc(phienId, { q = '', gioiHan = 3000 } = {}) {
  const db = csdl();
  const ds = [
    ...db.prepare('SELECT luc, loai, noi_dung, canh_bao, san_pham_id FROM nhat_ky_song WHERE phien_id = ? ORDER BY luc, rowid').all(phienId),
    ...db.prepare("SELECT luc, 'cohost' AS loai, noi_dung, NULL AS canh_bao, san_pham_id FROM cau_tren_song WHERE phien_id = ? AND trang_thai IN ('da_hien', 'da_phat')")
      .all(phienId),
    ...db.prepare(`SELECT b.luc_nhan AS luc, 'chot' AS loai, b.ten || ': ' || b.noi_dung || ' → ' || COALESCE(d.ma, '') AS noi_dung, NULL AS canh_bao, NULL AS san_pham_id
                   FROM binh_luan_live b LEFT JOIN don d ON d.id = b.don_id WHERE b.phien_id = ? AND b.don_id IS NOT NULL`).all(phienId),
  ].sort((a, b) => (a.luc < b.luc ? -1 : a.luc > b.luc ? 1 : 0));
  const tim = boDau(String(q || '')).trim();
  const loc = tim ? ds.filter((x) => boDau(x.noi_dung).includes(tim)) : ds;
  return loc.slice(0, gioiHan).map((x) => ({ ...x, ten_loai: TEN_LOAI[x.loai] || x.loai }));
}

/** Dọn quá hạn (lúc khởi động và mỗi ngày). @returns {{nhat_ky:number, binh_luan:number}} */
function don(bayGio = new Date()) {
  const moc = new Date(bayGio.getTime() - giuNgay() * 86400e3).toISOString();
  const db = csdl();
  const a = db.prepare('DELETE FROM nhat_ky_song WHERE luc < ?').run(moc).changes;
  // Bình luận không gắn đơn: xóa nội dung và tên, giữ dòng để số đếm của báo cáo không đổi.
  const b = db.prepare("UPDATE binh_luan_live SET noi_dung = '', ten = '' WHERE don_id IS NULL AND luc_nhan < ? AND (noi_dung <> '' OR ten <> '')").run(moc).changes;
  return { nhat_ky: a, binh_luan: b };
}

module.exports = { ghi, doc, don, LOAI, TEN_LOAI, giuNgay };
