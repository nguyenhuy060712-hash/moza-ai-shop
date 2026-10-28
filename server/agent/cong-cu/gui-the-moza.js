'use strict';

/**
 * Công cụ NỘI BỘ `gui_the_moza` (SPEC.md F-65, #95): MỘT đường gửi cho mọi tin do mã soạn — thẻ giữ hàng, thẻ đơn, tin trả lời
 * nút bấm, nhắc đơn, báo hủy, mẫu Utility, nhắn bù. Không Agent nào được cấp (AI không gọi được); hook và dịch vụ của MOZA gọi
 * qua `thucHienCongCu` nên tin nào cũng đi qua đủ cửa `truoc_cong_cu`:
 *   khan_cap ("Dừng mọi thứ" → chờ duyệt, không bỏ im) · luat_quyen · hop_thu_gui (24 giờ, 1 lượt nhắn riêng / bình luận, 7 ngày,
 *   người đang giữ hội thoại) · gioi_han_lien_he (F-66) · gioi_thieu (tin đầu phải có câu tự nhận trợ lý AI).
 * Chữ trên thẻ do mã điền từ dữ liệu (không qua AI), nên không qua Bộ kiểm tra câu chữ.
 *
 * Tham số:
 *   hoi_thoai_id   hội thoại nhận tin (Messenger, hoặc hội thoại bình luận khi nhắn riêng)
 *   dich           'messenger' (theo PSID, trong 24 giờ) · 'nhan_rieng' (theo bình luận — dùng lượt nhắn riêng) · 'utility' (mẫu tin)
 *   the            thẻ trung tính (facebook/dung-tin.js); với utility: { loai } của bộ mẫu
 *   muc_dich       tra_loi · the_dau · nhac · bao_huy · bao_don · cham_soc · moi_chao (F-66)
 *   khoa           khóa chống trùng (một khóa → tối đa một lần gửi thật)
 *   binh_luan_fb_id  bình luận được nhắn riêng (dich = nhan_rieng)
 *   don_id         đơn liên quan ("" nếu không có)
 */

const hopThu = require('../../nghiep-vu/hop-thu');
const luot = require('../../nghiep-vu/luot-nhan-rieng');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');
const { chuCuaThe, kiemThe } = require('../../facebook/dung-tin');

const MUC_DICH = ['tra_loi', 'the_dau', 'nhac', 'bao_huy', 'bao_don', 'cham_soc', 'moi_chao'];
const chuoi = { type: 'string' };

module.exports = {
  ten: 'gui_the_moza',
  moTa: 'Công cụ nội bộ của MOZA: gửi tin / thẻ do mã soạn (không cấp cho Agent).',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  kenhGui: 'the_moza',
  noiBo: true,
  giay: 30,
  MUC_DICH,
  thamSo: {
    type: 'object',
    properties: {
      hoi_thoai_id: chuoi, dich: { type: 'string', enum: ['messenger', 'nhan_rieng', 'utility'] }, the: { type: 'object' },
      muc_dich: { type: 'string', enum: MUC_DICH }, khoa: chuoi, binh_luan_fb_id: chuoi, don_id: chuoi,
    },
    required: ['hoi_thoai_id', 'dich', 'the', 'muc_dich', 'khoa'],
    additionalProperties: false,
  },
  async chay(ts, ctx) {
    const h = hopThu.layHoiThoai(ts.hoi_thoai_id);
    const nguoi = hopThu.layNguoi(h.nguoi_fb_id);
    let the = ts.the;
    let mau = null;
    if (ts.dich === 'utility') {
      mau = require('../../nghiep-vu/mau-utility');
      const d = require('../../nghiep-vu/don').layDon(ts.don_id);
      const m = mau.mau(the.loai, { dienTap: h.dien_tap });
      if (!m) throw new LoiNghiepVu('CHUA_CO_MAU', 'Chưa có mẫu tin Utility này (Cài đặt → Facebook → Tạo bộ mẫu tin).');
      the = { kieu: 'utility', loai: the.loai, ten: m.ten, ngon_ngu: m.ngon_ngu, tham_so: mau.thamSo(the.loai, d), chu: `[Mẫu tin "${mau.TEN[the.loai]}"] ${mau.chuDien(the.loai, d)}` };
    } else {
      const loi = kiemThe(the);
      if (loi.length) throw new LoiNghiepVu('THE_KHONG_HOP_LE', `Thẻ chưa đúng giới hạn của Meta: ${loi.join('; ')}.`);
    }
    const noiDung = the.kieu === 'utility' ? the.chu : chuCuaThe(the);
    const { tin, daCo } = hopThu.ghiTinRa({
      hoiThoaiId: h.id, guiBoi: 'he_thong', loai: ts.dich === 'nhan_rieng' ? 'nhan_rieng' : 'tin', noiDung, khoa: ts.khoa,
      fbCommentId: ts.dich === 'nhan_rieng' ? ts.binh_luan_fb_id : null, the,
    });
    if (daCo) return { da_gui: tin.trang_thai_gui === 'da_gui', trung: true, tin_nhan_id: tin.id };
    const fb = ctx.layKetNoi({ dien_tap: h.dien_tap });
    if (!h.dien_tap && fb?.ten !== 'that') {
      hopThu.capNhatGui(tin.id, { trangThai: 'loi', loi: 'Facebook thật chưa kết nối.' });
      if (ts.dich === 'nhan_rieng') luot.loi(ts.binh_luan_fb_id);
      throw new LoiNghiepVu('FB_CHUA_KET_NOI', 'Facebook thật chưa kết nối: không gửi được.');
    }
    try {
      let r;
      if (ts.dich === 'nhan_rieng') {
        r = await fb.nhanRiengThe({ page_id: h.page_id, comment_id: ts.binh_luan_fb_id, the });
        if (r.psid) hopThu.ganPsid(h.nguoi_fb_id, r.psid);
        luot.daGui(ts.binh_luan_fb_id, { hoiThoaiId: h.id });
      } else if (ts.dich === 'utility') {
        r = await fb.guiUtility({ page_id: h.page_id, psid: nguoi.psid, ten: the.ten, tham_so: the.tham_so, ngon_ngu: the.ngon_ngu });
      } else {
        r = await fb.guiTheSp({ page_id: h.page_id, psid: nguoi.psid, the });
      }
      hopThu.capNhatGui(tin.id, { trangThai: 'da_gui', fbId: r.mid });
      if (MUC_DICH.includes(ts.muc_dich) && ts.muc_dich !== 'tra_loi') {
        require('../../nghiep-vu/lien-he').ghi({ nguoiFbId: h.nguoi_fb_id, donId: ts.don_id || null, phienLiveId: h.phien_live_id || null, loai: ts.muc_dich });
      }
      return { da_gui: true, tin_nhan_id: tin.id, mid: r.mid, psid: r.psid || nguoi?.psid || null };
    } catch (e) {
      const khongRo = e.ma === 'FB_MAT_MANG';
      hopThu.capNhatGui(tin.id, { trangThai: khongRo ? 'khong_ro' : 'loi', loi: e.message });
      if (ts.dich === 'nhan_rieng' && !khongRo) luot.loi(ts.binh_luan_fb_id);
      throw new LoiNghiepVu(e.ma || 'FB_LOI', e.message);
    }
  },
};
