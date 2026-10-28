'use strict';

/** Ghi mỗi lần công cụ chạy xong vào `goi_cong_cu` (A.3 cửa `sau_cong_cu`, bắt buộc). */

const nhatKy = require('../../nghiep-vu/nhat-ky');

module.exports = {
  id: 'ghi_nhat_ky',
  cua: 'sau_cong_cu',
  ten: 'Ghi nhật ký',
  moTa: 'Mỗi lần công cụ chạy đều được ghi lại, để xem "Vì sao" AI làm vậy.',
  batBuoc: true,
  chay(ctx) {
    nhatKy.ghiCongCu({
      runId: ctx.runId ?? null,
      congCu: ctx.congCu.ten,
      thamSo: ctx.thamSo,
      ketQua: ctx.loi ? { loi: ctx.loi } : ctx.ketQua,
      lyDo: ctx.loi ? `${ctx.loi.ma}: ${ctx.loi.thong_diep}` : null,
    });
    return { quyet_dinh: 'cho_qua' };
  },
};
