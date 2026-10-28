'use strict';

/**
 * Ẩn bình luận lộ thông tin cá nhân (#19, A.3 cửa `khi_tin_den`): bình luận live có số điện thoại
 * hoặc CCCD công khai → ẩn trên Facebook (người viết vẫn thấy) và chuyển "Chờ Tư vấn viên".
 * Đi qua công cụ `an_binh_luan`, nên vẫn chịu luật quyền và công tắc "Dừng mọi thứ"
 * (bật công tắc thì thành mục chờ duyệt, không tự ẩn).
 */

module.exports = {
  id: 'an_thong_tin_ca_nhan',
  cua: 'khi_tin_den',
  ten: 'Ẩn bình luận lộ số điện thoại, CCCD',
  moTa: 'Bình luận công khai có số điện thoại hoặc CCCD thì ẩn đi và chuyển Chờ Tư vấn viên nhắn riêng.',
  batBuoc: false,
  macDinhBat: true,
  async chay(ctx) {
    const bl = ctx.binhLuan;
    if (!bl?.nhan?.includes('thong_tin_ca_nhan') || bl.da_an) return { quyet_dinh: 'cho_qua' };
    // Nạp muộn: thuc-hien cần hook/cua, hook/cua cần file này.
    const { thucHienCongCu } = require('../thuc-hien');
    const kq = await thucHienCongCu({
      ten: 'an_binh_luan',
      thamSo: { binh_luan_id: bl.id, ly_do: 'Bình luận công khai có số điện thoại hoặc CCCD' },
      nguCanh: { layKetNoi: ctx.layKetNoi, phienLiveId: bl.phien_id },
    });
    if (kq.loi) {
      return { quyet_dinh: 'chan', ly_do: `Bình luận của ${bl.ten} lộ thông tin cá nhân; chưa ẩn được: ${kq.loi.thong_diep}` };
    }
    ctx.binhLuan = kq.ketQua.binh_luan;
    return { quyet_dinh: 'chan', ly_do: `Bình luận của ${bl.ten} lộ thông tin cá nhân: đã ẩn, chuyển Chờ Tư vấn viên.` };
  },
};
