'use strict';

/**
 * Kiểm lời Mai trên sóng (SPEC.md F-105, cửa `truoc_phat`, tắt được ở Agent & Skill → Hook). Chữ chép tiếng Mai về theo từng
 * mẩu; khi một câu (hoặc phần đã trọn số) xong, so con số với "giá bán lúc này", phí ship, còn bán được (kiem-so-noi.js).
 * Lỗi "chắc" → chặn với mã MIENG_NOI_SAI (miệng bỏ tiếng còn lại, đính chính); "nghi" → cho qua, ghi nhật ký, người dẫn thấy băng vàng.
 * Tiếng đã ra loa trước khi kiểm (chữ về sau tiếng) — đây là đính chính sau khi lỡ nói, không phải chặn trước (A.5 vẫn để dành).
 */

const { kiemSoNoi } = require('../kiem-tra/kiem-so-noi');
const { hienTien } = require('../../nghiep-vu/chung');

module.exports = {
  id: 'kiem_loi_noi',
  cua: 'truoc_phat',
  ten: 'Kiểm lời Mai trên sóng',
  moTa: 'So giá, phí ship, số còn Mai vừa nói với dữ liệu thật; sai chắc chắn thì Mai tự đính chính và Thanh chữ hiện giá đúng. Tắt: không kiểm.',
  macDinhBat: true,
  chay(ctx) {
    const loi = kiemSoNoi(ctx.cau, { phienId: ctx.phienId, soDangNoi: ctx.soDangNoi ?? null });
    ctx.loi = loi;
    if (!loi.length) return { quyet_dinh: 'cho_qua' };
    const chac = loi.filter((x) => x.muc === 'chac');
    const tomTat = (x) => `${x.loai === 'con' ? `còn ${x.noi}` : hienTien(x.noi)} (đúng: ${x.dung_chu})`;
    if (chac.length) return { quyet_dinh: 'chan', ma: 'MIENG_NOI_SAI', ly_do: `Mai nói sai: ${chac.map(tomTat).join('; ')}` };
    return { quyet_dinh: 'cho_qua', ghi: true, ly_do: `Nghi Mai nói sai: ${loi.map(tomTat).join('; ')}` };
  },
};
