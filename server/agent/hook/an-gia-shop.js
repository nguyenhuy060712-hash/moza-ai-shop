'use strict';

/**
 * Chống kẻ gian giả làm shop (SPEC.md F-74, #105; A.3 cửa `khi_tin_den`): bình luận live của người không phải Page có số tài
 * khoản / ví hoặc link lạ → ẩn trên Facebook, KHÔNG chuyển Tư vấn viên, không trả lời công khai, báo người dẫn. Đi qua công cụ
 * `an_binh_luan` nên vẫn chịu luật quyền và "Dừng mọi thứ". Bình luận bài đăng: hook phan_loai_tin làm cùng việc.
 */

module.exports = {
  id: 'an_gia_shop',
  cua: 'khi_tin_den',
  ten: 'Ẩn bình luận giả shop (số tài khoản, link lạ)',
  moTa: 'Bình luận của người không phải Page có số tài khoản / ví hoặc link lạ thì ẩn đi, không trả lời, báo người dẫn.',
  batBuoc: false,
  macDinhBat: true,
  async chay(ctx) {
    const bl = ctx.binhLuan;
    if (!bl?.nhan?.includes('gia_shop') || bl.da_an || bl.nhan.includes('cua_page')) return { quyet_dinh: 'cho_qua' };
    const { thucHienCongCu } = require('../thuc-hien');
    const kq = await thucHienCongCu({
      ten: 'an_binh_luan',
      thamSo: { binh_luan_id: bl.id, ly_do: 'Bình luận có số tài khoản hoặc link lạ — có thể giả shop' },
      nguCanh: { layKetNoi: ctx.layKetNoi, phienLiveId: bl.phien_id },
    });
    if (kq.loi) return { quyet_dinh: 'chan', ly_do: `Bình luận của ${bl.ten} có số tài khoản / link lạ; chưa ẩn được: ${kq.loi.thong_diep}` };
    ctx.binhLuan = kq.ketQua.binh_luan;
    return { quyet_dinh: 'chan', ly_do: `Bình luận của ${bl.ten} có số tài khoản / link lạ (có thể giả shop): đã ẩn, không trả lời.` };
  },
};
