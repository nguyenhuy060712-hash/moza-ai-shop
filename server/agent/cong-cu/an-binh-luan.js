'use strict';

const live = require('../../nghiep-vu/live');
const hopThu = require('../../nghiep-vu/hop-thu');
const { coThongTinCaNhan } = require('../../nghiep-vu/nhan-binh-luan');
const { laGiaShop } = require('../../nghiep-vu/gia-shop');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');

/**
 * Ẩn bình luận công khai lộ số điện thoại hoặc CCCD (#19), hoặc có số tài khoản / link lạ của người không phải Page (F-74 —
 * có thể giả shop: ẩn, không nhắn riêng): người viết vẫn thấy, người khác không thấy.
 *  - Bình luận live (id `bl_…`): chuyển sang "Chờ Tư vấn viên" để nhắn riêng.
 *  - Bình luận bài đăng trong Hộp thư (id tin nhắn `tn_…`, M5): Tư vấn viên nhắn riêng sau đó.
 * Chỉ hook `khi_tin_den` dùng; không Agent nào có công cụ này.
 */
module.exports = {
  ten: 'an_binh_luan',
  moTa: 'Ẩn một bình luận công khai lộ số điện thoại hoặc CCCD, hoặc có số tài khoản / link lạ (giả shop).',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  thamSo: {
    type: 'object',
    properties: {
      binh_luan_id: { type: 'string' },
      ly_do: { type: 'string' },
    },
    required: ['binh_luan_id', 'ly_do'],
    additionalProperties: false,
  },
  async chay({ binh_luan_id: id }, ctx = {}) {
    if (String(id).startsWith('tn_')) {
      const t = hopThu.layTin(id);
      if (!t.fb_comment_id || !(coThongTinCaNhan(t.noi_dung) || laGiaShop(t.noi_dung))) {
        throw new LoiNghiepVu('KHONG_DUOC_AN', 'Chỉ ẩn bình luận có số điện thoại, CCCD, số tài khoản hoặc link lạ.');
      }
      const h = hopThu.layHoiThoai(t.hoi_thoai_id);
      const fb = ctx.layKetNoi?.({ dien_tap: h.dien_tap });
      if (!fb) throw new LoiNghiepVu('KHONG_CO_KET_NOI', 'Chưa có kết nối Facebook để ẩn bình luận.');
      await fb.anBinhLuan(t.fb_comment_id, h.page_id);
      hopThu.ganNhan(h.id, { nhan: ['da_an_binh_luan'] });
      return { tin_nhan_id: id, da_an: true };
    }
    const bl = live.layBinhLuan(id);
    const giaShop = bl.nhan.includes('gia_shop');
    if (!bl.nhan.includes('thong_tin_ca_nhan') && !giaShop) {
      throw new LoiNghiepVu('KHONG_DUOC_AN', 'Chỉ ẩn bình luận có số điện thoại, CCCD, số tài khoản hoặc link lạ.');
    }
    if (!bl.da_an) {
      const fb = ctx.layKetNoi?.(bl.phien_id);
      if (!fb) throw new LoiNghiepVu('KHONG_CO_KET_NOI', 'Chưa có kết nối Facebook để ẩn bình luận.');
      await fb.anBinhLuan(bl.fb_id, live.layPhien(bl.phien_id).page_id || null);
    }
    const x = live.danhDauDaAn(id);
    // Giả shop: không nhắn riêng, không Director — xong ở đây (người dẫn được báo).
    if (giaShop) { live.datXuLy(bl.phien_id, [id], 'bo_qua'); return { binh_luan: live.layBinhLuan(id) }; }
    return { binh_luan: x };
  },
};
