'use strict';

const soTay = require('../../nghiep-vu/so-tay');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');

module.exports = {
  ten: 'mo_so_tay',
  moTa: 'Mở một mục Sổ tay shop (điều chung không thuộc sản phẩm nào: giao hàng, thanh toán, đổi trả, cách chọn size…) theo id trong mục lục Sổ tay.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: {
    type: 'object',
    properties: { id: { type: 'string', description: 'id của mục Sổ tay, lấy từ mục lục' } },
    required: ['id'],
    additionalProperties: false,
  },
  chay({ id }, ctx = {}) {
    let m;
    try {
      m = soTay.layMuc(id);
    } catch {
      throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có mục Sổ tay "${id}". Chỉ dùng id có trong mục lục Sổ tay.`);
    }
    ctx.ghiNguon?.('so_tay', m.id, m.phien_ban);
    return { id: m.id, tieu_de: m.tieu_de, phien_ban: m.phien_ban, noi_dung: m.noi_dung || '(mục này chưa có nội dung)' };
  },
};
