'use strict';

/**
 * Kiểm phiếu kết quả của Agent (A.8, A.3 cửa `khi_agent_xong`, bắt buộc): đúng lược đồ, đủ ô,
 * cộng các điều kiện riêng của từng Agent (ví dụ Co-host phải có trích dẫn).
 * Sai → runtime cho làm lại 1 lần; vẫn sai → Cần người (Hộp thư) hoặc bỏ lượt (live).
 */

const { kiemLuocDo } = require('../luoc-do');

module.exports = {
  id: 'kiem_phieu',
  cua: 'khi_agent_xong',
  ten: 'Kiểm phiếu kết quả',
  moTa: 'Phiếu kết quả của Agent phải đúng mẫu, đủ ô và có trích nguồn.',
  batBuoc: true,
  chay(ctx) {
    const loi = ctx.phieu == null ? ['Không đọc được phiếu JSON trong câu trả lời.'] : kiemLuocDo(ctx.phieu, ctx.luocDo);
    if (!loi.length && ctx.kiemThem) loi.push(...(ctx.kiemThem(ctx.phieu) || []));
    if (!loi.length) return { quyet_dinh: 'cho_qua' };
    return { quyet_dinh: 'chan', ma: 'PHIEU_SAI', ly_do: loi.join('; ') };
  },
};
