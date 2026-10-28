'use strict';

/**
 * Giới hạn liên hệ (SPEC.md F-66, #96; cửa `truoc_cong_cu`, bắt buộc, ngay sau Luật gửi Hộp thư). Mọi tin gửi ra mang một mục
 * đích (gui_the_moza: tham số muc_dich; công cụ của AI: trả lời). Nhắc, báo hủy, chăm sóc, mời chào bị giới hạn số lần, khung
 * 7h–22h, khách xin dừng, Page bị hạn chế — luật ở nghiep-vu/lien-he.js. Bị chặn thì trả mã rõ, không tạo mục chờ duyệt.
 */

const hopThu = require('../../nghiep-vu/hop-thu');
const lienHe = require('../../nghiep-vu/lien-he');

module.exports = {
  id: 'gioi_han_lien_he',
  cua: 'truoc_cong_cu',
  ten: 'Giới hạn liên hệ',
  moTa: 'Mỗi đơn tối đa 2 tin nhắc và 1 tin báo hủy; chăm sóc, mời chào 1 tin mỗi ngày; chỉ 7h–22h; khách xin dừng hoặc Page bị Meta hạn chế thì không nhắn chủ động.',
  batBuoc: true,
  chay(ctx) {
    if (!ctx.congCu.kenhGui) return { quyet_dinh: 'cho_qua' };
    const mucDich = ctx.thamSo?.muc_dich || ctx.nguCanh?.mucDich || 'tra_loi';
    const id = ctx.thamSo?.hoi_thoai_id || ctx.nguCanh?.hoiThoaiId;
    if (!id) return { quyet_dinh: 'cho_qua' };
    const h = hopThu.layHoiThoai(id);
    const kq = lienHe.kiem({ mucDich, nguoiFbId: h.nguoi_fb_id, donId: ctx.thamSo?.don_id || null, pageId: h.page_id });
    if (kq.duoc) return { quyet_dinh: 'cho_qua' };
    return { quyet_dinh: 'chan', ma: kq.ma, ly_do: kq.ly_do, ...(kq.doi_den ? { doi_den: kq.doi_den } : {}) };
  },
};
