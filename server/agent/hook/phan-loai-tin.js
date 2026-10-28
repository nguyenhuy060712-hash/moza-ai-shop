'use strict';

/**
 * Phân loại tin đến của Hộp thư bằng quy tắc, không cần AI (A.3 cửa `khi_tin_den`; F-31):
 *  - `spam` (quảng cáo, vay tiền, cá độ, đường link lạ) → chỉ gắn nhãn, KHÔNG gọi AI viết câu trả lời;
 *  - `gap_nguoi` ("cho tôi gặp người thật") → Cần người, AI ngừng gửi;
 *  - `yeu_cau_xoa` ("xóa dữ liệu của tôi", F-27, mục 9) → Cần người để nhân viên bấm "Xóa dữ liệu người này";
 *  - `buc_xuc` / `nhay_cam` (lừa đảo, đặt cọc, nợ lương, tai nạn…) → Tư vấn viên nâng lên Claude (A.7 luật 2);
 *  - bình luận công khai lộ số điện thoại / CCCD → ẩn (#19), để Tư vấn viên nhắn riêng.
 * So trên chữ bỏ dấu để bắt cả cách gõ không dấu.
 */

const { boDau } = require('../../nghiep-vu/chung');
const { coThongTinCaNhan } = require('../../nghiep-vu/nhan-binh-luan');

const SPAM = [
  /https?:\/\/(?!(www\.)?facebook\.com|fb\.com|m\.me)/, /bit\.ly|tinyurl|zalo\.me\/g\//,
  /vay (tien|von|nhanh|online)|giai ngan|no xau/, /ban sim|sim so dep/, /ca do|casino|nha cai|lo de|tai xiu/,
  /kiem tien (online|tai nha)|viec nhe luong cao .*(inbox|ib|zalo)|cong tac vien online/, /tang follow|tang like|hack/,
];
const GAP_NGUOI = [
  /gap nguoi that|nguoi that (tra loi|tu van)|noi chuyen voi nguoi|gap (nhan vien|tu van vien|ad|admin)|nhan vien that/,
  /khong (muon|thich) (noi chuyen|nhan tin) voi (may|bot|robot|ai)|(may|bot|robot) (a|ha)\??$|ad (oi )?(tra loi|rep) di/,
  /goi (dien )?(cho|lai cho) (toi|em|minh|chi|anh)|cho (xin|minh xin|em xin) so (cua )?(tu van|nhan vien|ad|cong ty)/,
];
const XOA_DU_LIEU = [/xoa (het )?(du lieu|thong tin|so dien thoai|sdt)( ca nhan)? (cua )?(toi|em|minh|anh|chi)|khong muon (luu|giu) (thong tin|so)|rut (lai )?(su )?dong y/];
// F-91: "xóa số đo" — xóa ngay chiều cao, cân nặng đã lưu (bằng mã, không gọi AI).
const XOA_SO_DO = [/xoa (het |giup |giup (minh|em|toi) )?(so do|chieu cao|can nang)|khong (muon |can )?(luu|giu) (so do|chieu cao|can nang)|bo luu so do/];
const BUC_XUC = [/lua dao|lua dao|lua (ga|tien)|quyt|tu te (di|chut)|vo trach nhiem|chan qua|buc (minh|qua|boi)|tuc (qua|minh|chet)| dm | dmm | vcl | dcm | clm /];
const NHAY_CAM = [/dat coc|tien coc|nop (tien|phi)|mat (tien|phi)|no luong|khong tra luong|cham luong|tai nan|bi thuong|khoi kien|kien (cong ty|ra toa)|to cao|cong an|thanh tra/];

function dsPageId() {
  try { return ['page_gia', ...require('../../nghiep-vu/fb-page').danhSach().map((p) => p.id)]; } catch { return ['page_gia']; }
}

function phanLoai(noiDung) {
  const s = ` ${boDau(noiDung).replace(/\s+/g, ' ')} `;
  const nhan = [];
  if (SPAM.some((re) => re.test(s))) nhan.push('spam');
  if (GAP_NGUOI.some((re) => re.test(s))) nhan.push('gap_nguoi');
  if (XOA_DU_LIEU.some((re) => re.test(s))) nhan.push('yeu_cau_xoa');
  if (XOA_SO_DO.some((re) => re.test(s))) nhan.push('xoa_so_do');
  if (BUC_XUC.some((re) => re.test(s))) nhan.push('buc_xuc');
  if (NHAY_CAM.some((re) => re.test(s))) nhan.push('nhay_cam');
  if (coThongTinCaNhan(noiDung)) nhan.push('thong_tin_ca_nhan');
  if (require('../../nghiep-vu/gia-shop').laGiaShop(noiDung, { pageIds: dsPageId() })) nhan.push('gia_shop');
  // F-66: xin thôi nhận tin ("dừng", "thôi shop"…) và xin không đọc tên trên live — bằng mã (server/cau-hinh/tu-khoa.json).
  const tk = require('../../nghiep-vu/tu-khoa');
  if (tk.laXinDung(noiDung)) nhan.push('xin_dung');
  if (tk.laHongLive(noiDung)) nhan.push('hong_live'); // F-97
  if (tk.laHoiLichLive(noiDung)) nhan.push('hoi_lich_live');
  if (tk.laAnTen(noiDung)) nhan.push('an_ten');
  if (tk.laGoAnh(noiDung)) nhan.push('go_anh'); // F-104
  return nhan;
}

module.exports = {
  id: 'phan_loai_tin',
  cua: 'khi_tin_den',
  ten: 'Phân loại tin Hộp thư',
  moTa: 'Gắn nhãn spam (không trả lời), đòi gặp người thật (Cần người), bức xúc / nhạy cảm (nâng lên Claude); ẩn bình luận công khai lộ số điện thoại.',
  batBuoc: false,
  macDinhBat: true,
  phanLoai,
  async chay(ctx) {
    const t = ctx.tinDen;
    if (!t) return { quyet_dinh: 'cho_qua' };
    ctx.nhan = phanLoai(t.noi_dung);
    if (t.cong_khai && ctx.nhan.includes('gia_shop') && ctx.anDuoc !== false) {
      // F-74: số tài khoản / link lạ trong bình luận bài đăng — ẩn, không trả lời công khai, người xem xét (Hộp thư: Cần người).
      const { thucHienCongCu } = require('../thuc-hien');
      const kq = await thucHienCongCu({ ten: 'an_binh_luan', thamSo: { binh_luan_id: t.id, ly_do: 'Bình luận có số tài khoản hoặc link lạ — có thể giả shop' }, nguCanh: { layKetNoi: ctx.layKetNoi } });
      ctx.daAn = !kq.loi;
      return { quyet_dinh: 'cho_qua', ghi: true, ly_do: kq.loi ? `Bình luận giả shop, chưa ẩn được: ${kq.loi.thong_diep}` : 'Bình luận có số tài khoản / link lạ: đã ẩn, không trả lời.' };
    }
    if (t.cong_khai && ctx.nhan.includes('thong_tin_ca_nhan') && ctx.anDuoc !== false) {
      const { thucHienCongCu } = require('../thuc-hien');
      const kq = await thucHienCongCu({ ten: 'an_binh_luan', thamSo: { binh_luan_id: t.id, ly_do: 'Bình luận công khai có số điện thoại hoặc CCCD' }, nguCanh: { layKetNoi: ctx.layKetNoi } });
      ctx.daAn = !kq.loi;
      return { quyet_dinh: 'cho_qua', ghi: true, ly_do: kq.loi ? `Bình luận lộ số điện thoại, chưa ẩn được: ${kq.loi.thong_diep}` : 'Bình luận lộ số điện thoại: đã ẩn, Tư vấn viên sẽ nhắn riêng.' };
    }
    return ctx.nhan.length ? { quyet_dinh: 'cho_qua', ghi: true, ly_do: `Nhãn: ${ctx.nhan.join(', ')}` } : { quyet_dinh: 'cho_qua' };
  },
};
