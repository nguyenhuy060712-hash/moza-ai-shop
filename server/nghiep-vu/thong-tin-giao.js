'use strict';

/**
 * Ghi thông tin giao vào đơn (F-54, F-55): tạo / liên kết hồ sơ khách theo số điện thoại rồi điền tên, số, địa chỉ vào đơn.
 * Một hàm cho cả Tư vấn viên (cap_nhat_don viec thong_tin_giao) lẫn MOZA đọc bằng mã (doc-thong-tin.js, F-68 bản 3.4).
 */

const don = require('./don');
const kh = require('./khach');
const hopThu = require('./hop-thu');

/**
 * @param {{h:object, d:object, ten?:string|null, sdt?:string|null, diaChi?:string|null, thanhToan?:string|null, boi?:'ai'|'nguoi'}} o
 * @returns {object} đơn sau khi ghi
 */
function ghiThongTinGiao({ h, d, ten = null, sdt = null, diaChi = null, thanhToan = null, boi = 'ai' }) {
  let khachId = h.khach_id;
  if (sdt) {
    // Số đã có → hồ sơ cũ; nghi trùng tên khác số → Cần người (F-54).
    const kq = kh.taoKhach({ ten, sdt, diaChi, hoiThoaiId: h.id, phienLiveId: h.phien_live_id, taoBoi: 'ai', dongY: true, dienTap: h.dien_tap });
    khachId = kq.khach.id;
    if (kq.ket_qua === 'da_lien_ket' && diaChi && !kq.khach.dia_chi) {
      try { kh.suaKhach(khachId, { dia_chi: diaChi }, { boi: 'ai' }); } catch { /* người vừa sửa hồ sơ: giữ */ }
    }
    if (kq.nghi_trung) hopThu.datCanNguoi(h.id, `Nghi trùng hồ sơ: đã có khách tên "${ten}" với số khác — kiểm tra, gộp nếu cần.`);
  }
  return don.datThongTinGiao(d.id, { ten: ten || null, sdt: sdt || null, diaChi: diaChi || null, thanhToan: thanhToan || null, khachId }, { boi });
}

module.exports = { ghiThongTinGiao };
