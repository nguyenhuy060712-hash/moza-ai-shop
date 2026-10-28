'use strict';

/**
 * Nén ngữ cảnh hội thoại dài (A.3 cửa `truoc_nen`, bắt buộc; F-30): hội thoại dài chỉ đưa cho AI bản tóm tắt + tối đa
 * 20 tin gần nhất, nhưng những điều không được quên luôn được đưa lại **bằng mã**, không dựa vào bản tóm tắt của AI:
 * tên, số điện thoại, địa chỉ đã cho, đơn đang mở và món đã giữ, điều đã hứa.
 */

const hopThu = require('../../nghiep-vu/hop-thu');
const kh = require('../../nghiep-vu/khach');
const don = require('../../nghiep-vu/don');

module.exports = {
  id: 'giu_khi_nen',
  cua: 'truoc_nen',
  ten: 'Giữ thông tin quan trọng khi nén',
  moTa: 'Hội thoại dài chỉ gửi AI bản tóm tắt + 20 tin gần nhất, nhưng luôn giữ tên, số điện thoại, địa chỉ, đơn đang mở, điều đã hứa.',
  batBuoc: true,
  chay(ctx) {
    const h = hopThu.layHoiThoai(ctx.hoiThoaiId);
    const dong = [];
    if (h.khach_id) {
      const ct = kh.chiTiet(h.khach_id);
      if (ct.khach.ten || ct.khach.sdt) dong.push(`- Tên: ${ct.khach.ten || '(chưa có)'} · Số điện thoại: ${ct.khach.sdt_hien || '(chưa có)'}${ct.khach.dia_chi ? ` · Địa chỉ giao: ${ct.khach.dia_chi}` : ''}`);
      for (const b of ct.bo_nho.filter((x) => x.loai === 'da_hua')) dong.push(`- Đã hứa: ${b.noi_dung}`);
    }
    if (dong.length) ctx.phanGiu.push(['## Điều không được quên (MOZA ghi, luôn đúng)', ...dong].join('\n'));
    // Đơn đang mở của khách (kể cả chốt ở bình luận live rồi sang Messenger): tổng tiền, phí ship do MOZA tính.
    const d = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
    if (d) ctx.phanGiu.push(`## Đơn đang mở của khách (trích tổng tiền, phí ship với nguon "${d.ma}"; vừa sửa đơn thì xem_don lại)\n${don.khoiChoAi(don.layDon(d.id))}`);
    return { quyet_dinh: 'cho_qua' };
  },
};
