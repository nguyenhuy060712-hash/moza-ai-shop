'use strict';

/**
 * Bộ kiểm tra ở cửa `truoc_cong_cu` (F-10, A.4, bắt buộc): công cụ nào đưa câu ra ngoài
 * (có `cauRaNgoai`) thì câu đó phải qua K1–K9 (K10 tổng tiền đơn ở BH3). Ghi nhật ký cả khi đạt, để "Vì sao" thấy câu đã được kiểm.
 */

const { kiemTraCau } = require('../kiem-tra/kiem-tra');

module.exports = {
  id: 'kiem_tra',
  cua: 'truoc_cong_cu',
  ten: 'Bộ kiểm tra câu chữ',
  moTa: 'Mọi câu AI đưa ra ngoài: sản phẩm Đang bán, trích dẫn đúng nguyên văn, giá và con số có trong nguồn, số còn đúng lúc nói, không xin hay lộ thông tin cá nhân, độ dài.',
  batBuoc: true,
  chay(ctx) {
    if (!ctx.congCu.cauRaNgoai) return { quyet_dinh: 'cho_qua' };
    // Câu người dùng tự gõ trong Hộp thư là lời của người, không phải của AI: không kiểm (người chịu trách nhiệm câu của mình).
    if (ctx.nguCanh?.guiBoi === 'nguoi' && !ctx.agentId) return { quyet_dinh: 'cho_qua', ghi: true, ly_do: 'Người dùng tự gửi: không qua Bộ kiểm tra.' };
    const kq = kiemTraCau(ctx.congCu.cauRaNgoai(ctx.thamSo, ctx.nguCanh || {}));
    ctx.ketQuaKiemTra = kq;
    if (kq.dat) return { quyet_dinh: 'cho_qua', ghi: true, ly_do: 'Đạt Bộ kiểm tra.' };
    if (kq.giu) return { quyet_dinh: 'giu', ma: 'GIU', ly_do: 'AI đang không được phép nói (K7): giữ lại.' };
    return { quyet_dinh: 'chan', ma: 'KIEM_TRA_CHAN', loi: kq.loi, ly_do: kq.loi.map((l) => `${l.ma}: ${l.thong_diep}`).join(' ') };
  },
};
