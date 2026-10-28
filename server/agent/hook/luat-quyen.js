'use strict';

/**
 * Luật quyền Cho phép / Hỏi / Cấm (F-08, A.3 bắt buộc). Không có luật người dùng đặt thì dùng
 * mức mặc định của công cụ (A.6). "Hỏi" → mục chờ duyệt, không làm cho tới khi người dùng duyệt.
 */

const luatQuyen = require('../../nghiep-vu/luat-quyen');

module.exports = {
  id: 'luat_quyen',
  cua: 'truoc_cong_cu',
  ten: 'Luật quyền',
  moTa: 'Mỗi hành động theo luật Cho phép / Hỏi / Cấm đã đặt ở mục Luật quyền.',
  batBuoc: true,
  chay(ctx) {
    if (ctx.daDuyet) return { quyet_dinh: 'cho_qua' };
    const { muc } = luatQuyen.mucQuyen(ctx.congCu.ten, ctx.thamSo, ctx.congCu.macDinh || 'cho_phep');
    if (muc === 'cam') {
      return { quyet_dinh: 'chan', ma: 'CAM', ly_do: `Luật quyền: "${ctx.congCu.ten}" bị Cấm.` };
    }
    if (muc === 'hoi') {
      return { quyet_dinh: 'chan', ma: 'CAN_DUYET', taoChoDuyet: true, ly_do: `Luật quyền: "${ctx.congCu.ten}" cần người duyệt trước.` };
    }
    return { quyet_dinh: 'cho_qua' };
  },
};
