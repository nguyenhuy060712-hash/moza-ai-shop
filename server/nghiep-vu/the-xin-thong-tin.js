'use strict';

/**
 * Tin xin thông tin giao do mã soạn (SPEC.md F-88, #118) — Messenger một chạm, 0 lượt AI:
 *  - chữ: "Để giao {món}, {tôi} cần tên, số điện thoại, địa chỉ … chỉ để giao đơn" (còn thiếu một phần thì hỏi đúng phần thiếu);
 *  - nút [📞 Gọi shop] khi số shop hợp lệ;
 *  - trả lời nhanh: số điện thoại Messenger tự điền (Meta tự ẩn nếu hồ sơ không có số), [Như đơn trước] (đơn Đã gửi / Đã giao gần
 *    nhất, không lấy đơn Hoàn), [Dùng số 0912***678] (số khách lỡ ghi ở bình luận chốt).
 * Chỉ gửi trong 24 giờ (đường gửi kiểm).
 */

const don = require('./don');
const caiDat = require('./cai-dat');
const cm = require('./cau-mau-khach');
const nutBam = require('./nut-bam');
const { chuanSdt } = require('./khach');

const cheSo = (s) => (s ? `0${s.slice(3, 6)}***${s.slice(-3)}` : '');

/** Nút gọi shop (phone_number) — null nếu số shop chưa chuẩn hóa được. */
function nutGoiShop() {
  const so = chuanSdt(caiDat.banHang().sdt_shop);
  return so ? { kieu: 'goi', tieu_de: cm.cau('nut_goi_shop'), so } : null;
}

/** Trả lời nhanh cho đơn còn thiếu thông tin. */
function nhanhXinThongTin(d) {
  const ds = [];
  if (!d.sdt_nhan) ds.push({ kieu: 'so_dien_thoai' });
  const cu = don.donCuDaGiao({ khachId: d.khach_id, nguoiFbId: d.nguoi_fb_id, truId: d.id });
  if (cu) ds.push({ tieu_de: cm.cau('nut_nhu_don_truoc'), payload: nutBam.taoPayload('NHU_DON_TRUOC', { don: d.id }) });
  if (d.sdt_goi_y && !d.sdt_nhan) ds.push({ tieu_de: `Dùng số ${cheSo(d.sdt_goi_y)}`.slice(0, 20), payload: nutBam.taoPayload('DUNG_SO', { don: d.id }) });
  return ds;
}

/**
 * @param {object} d  đơn chờ xác nhận còn thiếu
 * @param {{monChu:string, giuDen:string}} o
 */
function theXinThongTin(d, { monChu, giuDen }) {
  const thieu = don.viecConThieu(d);
  const chu = thieu.length === 3
    ? cm.cau('xin_thong_tin_mot_cham', { mon: monChu, giu_den: giuDen })
    : cm.cau('xin_thong_tin_con_thieu', { thieu: thieu.map((t) => t.replace('chưa có ', '')).join(', '), giu_den: giuDen });
  const nhanh = nhanhXinThongTin(d);
  const goi = nutGoiShop();
  const the = goi ? { kieu: 'nut', chu, nut: [goi] } : { kieu: 'chu', chu };
  if (nhanh.length) the.tra_loi_nhanh = nhanh;
  return the;
}

module.exports = { theXinThongTin, nhanhXinThongTin, nutGoiShop, cheSo };
