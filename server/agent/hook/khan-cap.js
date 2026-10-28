'use strict';

/**
 * Công tắc "Dừng mọi thứ" (F-03, A.3 bắt buộc): đang bật thì mọi hành động có ảnh hưởng thật
 * mà luật là "Cho phép" chuyển thành "Hỏi" — không làm, tạo mục chờ duyệt. Người đã duyệt thì cho qua.
 */

const caiDat = require('../../nghiep-vu/cai-dat');

module.exports = {
  id: 'khan_cap',
  cua: 'truoc_cong_cu',
  ten: 'Công tắc Dừng mọi thứ',
  moTa: 'Đang bật thì mọi hành động có ảnh hưởng thật đều phải chờ người duyệt.',
  batBuoc: true,
  chay(ctx) {
    if (ctx.daDuyet || ctx.congCu.nhom !== 'co_anh_huong' || !caiDat.khanCap()) return { quyet_dinh: 'cho_qua' };
    return {
      quyet_dinh: 'chan',
      ma: 'KHAN_CAP_DANG_BAT',
      taoChoDuyet: true,
      hetHanGio: 24, // F-121: việc do "Dừng mọi thứ" giữ lại tự hết hạn sau 24 giờ
      ly_do: `"Dừng mọi thứ" đang bật: ${ctx.congCu.ten} chuyển sang chờ duyệt.`,
    };
  },
};
