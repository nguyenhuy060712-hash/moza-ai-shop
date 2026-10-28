'use strict';

/**
 * Phần bán hàng của Phòng diễn tập (SPEC.md #87, chủ dự án duyệt "cách 1" 26/9/2026): buổi tập chạy trên KHO THẬT như thật
 * 100% (giữ hàng, trừ tồn khi gửi, cộng lại khi nhận hàng hoàn); chỉ đụng dữ liệu diễn tập (`dien_tap = 1`).
 *  - tuaThoiGian: lùi mọi mốc thời gian của đơn / hội thoại diễn tập N giờ — để thấy nhắc thông tin giao, quá giờ giữ tự hủy,
 *    cửa sổ 24 giờ của Messenger — không phải chờ thật.
 *  - vanChuyen: giả đơn vị vận chuyển cho đơn diễn tập Đã gửi: phần lớn Đã giao, một ít Hoàn.
 *  - traKho: "Kết thúc buổi tập" → hủy đơn đang giữ, cộng lại hàng đã trừ (ghi lịch sử kho "trả kho sau buổi tập"),
 *    đánh dấu tra_kho_luc để không trả hai lần.
 */

const { csdl } = require('../db/ket-noi');
const { gio, LoiNghiepVu } = require('./chung');
const don = require('./don');
const kho = require('./kho');

/** Lùi mốc thời gian của dữ liệu diễn tập (đơn, hội thoại, tin nhắn) `soGio` giờ. */
function tuaThoiGian(soGio) {
  const n = Number(soGio);
  // BH8: tới 168 giờ (7 ngày) — đủ cho hỏi thăm sau 4–7 ngày, hạn bán sau live 7 ngày.
  if (!Number.isFinite(n) || n <= 0 || n > 168) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Tua từ 1 tới 168 giờ.');
  const db = csdl();
  const lui = `-${n} hours`;
  // Mốc ISO (…Z) lùi bằng strftime để giữ đúng dạng chuỗi so sánh được.
  const cot = (c) => `${c} = CASE WHEN ${c} IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ', ${c}, '${lui}') END`;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE don SET ${['tao_luc', 'sua_luc', 'giu_den', 'mon_sua_luc', 'nhac_giao_luc', 'bao_gui_luc', 'khach_bam_luc', 'nhac_cuoi_luc', 'bao_huy_luc', 'gia_han_goi_luc', 'hoi_gop_luc', 'goi_y_phoi_luc', 'da_nhan_tien_luc', 'hoi_lai_luc', 'hoi_mac_luc', 'phan_hoi_mac_luc'].map(cot).join(', ')}
                WHERE dien_tap = 1 AND tra_kho_luc IS NULL`).run();
    db.prepare(`UPDATE don_lich_su SET ${cot('luc')} WHERE don_id IN (SELECT id FROM don WHERE dien_tap = 1 AND tra_kho_luc IS NULL)`).run();
    db.prepare(`UPDATE hoi_thoai SET ${['tin_khach_cuoi_luc', 'lien_lac_cuoi_luc', 'hoi_tham_luc'].map(cot).join(', ')} WHERE dien_tap = 1`).run();
    db.prepare(`UPDATE tin_nhan SET ${cot('luc')} WHERE hoi_thoai_id IN (SELECT id FROM hoi_thoai WHERE dien_tap = 1)`).run();
    db.prepare(`UPDATE viec SET ${cot('han_luc')} WHERE hoi_thoai_id IN (SELECT id FROM hoi_thoai WHERE dien_tap = 1)`).run();
    // Bản 3.4: lần liên hệ (nhắc, báo hủy — F-66, F-69), lượt nhắn riêng, danh sách nhắn bù của dữ liệu diễn tập.
    db.prepare(`UPDATE lien_he SET ${cot('luc')} WHERE nguoi_fb_id IN (SELECT id FROM nguoi_fb WHERE dien_tap = 1)`).run();
    db.prepare(`UPDATE luot_nhan_rieng SET ${cot('luc')} WHERE hoi_thoai_id IN (SELECT id FROM hoi_thoai WHERE dien_tap = 1)`).run();
    db.prepare(`UPDATE nhan_bu SET ${['tao_luc', 'han_luc'].map(cot).join(', ')} WHERE dien_tap = 1`).run();
    db.prepare(`UPDATE phien_live SET ${['bat_dau', 'ket_thuc', 'bat_dau_fb', 'xem_lai_con_tro', 'muc_luc_luc'].map(cot).join(', ')} WHERE dien_tap = 1 AND trang_thai = 'xong'`).run();
    // BH7: danh sách chờ (F-92), số đo (F-91) của dữ liệu diễn tập.
    db.prepare(`UPDATE cho_hang SET ${['bam_luc', 'moi_luc', 'tao_luc'].map(cot).join(', ')} WHERE dien_tap = 1`).run();
    db.prepare(`UPDATE khach SET ${['so_do_luc', 'so_do_hoi_luc'].map(cot).join(', ')} WHERE dien_tap = 1`).run();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  // Đơn quá giờ giữ tự hủy ngay (như nhịp mỗi phút của phần mềm).
  const huy = don.huyQuaGio().filter((d) => d.dien_tap);
  return { da_tua_gio: n, huy_qua_gio: huy.map((d) => d.ma) };
}

/** Mã vận đơn giả cho đơn diễn tập (không trùng dạng của hãng thật). */
function maVanDonGia(d) {
  return `TAP${d.ma.replace(/\D/g, '')}${String(Date.now()).slice(-5)}`;
}

/**
 * Giả đơn vị vận chuyển: mọi đơn diễn tập "Đã gửi" → "Đã giao" hoặc "Hoàn" (tỷ lệ hoàn mặc định 15%).
 * @returns {{giao:string[], hoan:string[]}}
 */
function vanChuyen({ tyLeHoan = 0.15, ngau = Math.random } = {}) {
  const ds = csdl().prepare("SELECT id FROM don WHERE dien_tap = 1 AND trang_thai = 'da_gui' AND tra_kho_luc IS NULL ORDER BY tao_luc").all();
  const kq = { giao: [], hoan: [] };
  for (const { id } of ds) {
    const hoan = ngau() < tyLeHoan;
    const d = don.doiTrangThai(id, hoan ? 'hoan' : 'da_giao', { nguon: 'he_thong', ghiChu: hoan ? 'Giả lập: khách không nhận hàng' : 'Giả lập: giao thành công' });
    kq[hoan ? 'hoan' : 'giao'].push(d.ma);
  }
  return kq;
}

/**
 * Trả toàn bộ hàng của buổi tập về kho. Đơn đang giữ → hủy (hàng giữ tự nhả); đơn đã trừ tồn (Đã gửi, Đã giao, Hoàn chưa
 * nhận lại) → cộng lại từng món, ghi lịch sử kho "Trả kho sau buổi tập". Chạy lại lần nữa không trả thêm.
 * @returns {{huy:number, tra_mon:number, tra_chiec:number, don:number}}
 */
function traKho() {
  const db = csdl();
  require('./cho-hang').xoaDienTap(); // F-92: danh sách chờ của buổi tập bỏ trước (không mời người tập bằng hàng vừa trả)
  require('./cai-dat').ghi('dien_tap_tra_kho_luc', gio()); // F-94: buổi tập xong trước mốc này không nhận bình luận xem lại nữa
  const ds = db.prepare('SELECT id FROM don WHERE dien_tap = 1 AND tra_kho_luc IS NULL ORDER BY tao_luc').all();
  const kq = { don: 0, huy: 0, tra_mon: 0, tra_chiec: 0 };
  for (const { id } of ds) {
    let d = don.layDon(id);
    if (['cho_xac_nhan', 'da_xac_nhan'].includes(d.trang_thai)) {
      d = don.doiTrangThai(id, 'da_huy', { nguon: 'he_thong', ghiChu: 'Kết thúc buổi tập' });
      kq.huy += 1;
    }
    const daTru = ['da_gui', 'da_giao'].includes(d.trang_thai) || (d.trang_thai === 'hoan' && !d.da_nhan_hoan_luc);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (daTru) {
        for (const x of d.dong) {
          const pl = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(x.phan_loai_id);
          kho.ghiThayDoi(db, pl, x.so_luong, { lyDo: 'dieu_chinh', donId: d.id, ghiChu: `Trả kho sau buổi tập (${d.ma})`, boi: 'he_thong' });
          kq.tra_mon += 1;
          kq.tra_chiec += x.so_luong;
        }
      }
      db.prepare('UPDATE don SET tra_kho_luc = ? WHERE id = ?').run(gio(), d.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    kq.don += 1;
  }
  return kq;
}

/** Tóm tắt nhanh đơn diễn tập chưa trả kho (Phòng diễn tập hiện). */
function tomTat() {
  const r = csdl().prepare(`SELECT trang_thai, COUNT(*) AS n FROM don WHERE dien_tap = 1 AND tra_kho_luc IS NULL GROUP BY trang_thai`).all();
  return Object.fromEntries(r.map((x) => [x.trang_thai, x.n]));
}

module.exports = { tuaThoiGian, vanChuyen, traKho, maVanDonGia, tomTat };
