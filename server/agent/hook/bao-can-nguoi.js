'use strict';

/**
 * Báo khi hội thoại chuyển Cần người (A.3 cửa `khi_can_nguoi`). Trong lúc đang live chỉ báo việc khẩn
 * (khách đòi gặp người, lỗi gửi) lên Màn hình người dẫn; còn lại chỉ tăng số "Cần người" trên thanh trên cùng.
 */

const { phat } = require('../../ws');
const live = require('../../nghiep-vu/live');

const KHAN = /gặp người|không rõ|lỗi|hết hạn/i;

module.exports = {
  id: 'bao_can_nguoi',
  cua: 'khi_can_nguoi',
  ten: 'Báo Cần người',
  moTa: 'Hội thoại chuyển Cần người thì báo trên giao diện; đang live chỉ báo việc khẩn lên Màn hình người dẫn.',
  batBuoc: false,
  macDinhBat: true,
  chay(ctx) {
    phat('can_nguoi', { hoi_thoai_id: ctx.hoiThoaiId, ly_do: ctx.lyDo });
    const p = live.phienDangMo();
    if (p && p.trang_thai === 'dang_live' && KHAN.test(ctx.lyDo || '') && !ctx.dienTap) {
      phat('live.bao', { phien_id: p.id, noi_dung: `Hộp thư cần người: ${ctx.lyDo}`, muc: 'vang' });
    }
    return { quyet_dinh: 'cho_qua' };
  },
};
