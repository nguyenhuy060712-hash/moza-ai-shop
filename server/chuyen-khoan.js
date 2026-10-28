'use strict';

/**
 * Gửi mã QR chuyển khoản cho khách (SPEC.md F-89, #112): ảnh VietQR đúng tổng đơn, nội dung = mã đơn (DH0042), rồi MỘT tin chữ do
 * mã soạn (ngân hàng · số tài khoản · tên chủ TK · số tiền · nội dung + câu chống giả shop) kèm [🔁 Trả khi nhận hàng] [📞 Gọi shop].
 * Ảnh tải lỗi / quá 5 giây → chỉ tin chữ. Mọi tin đi qua gui_the_moza (đủ hook). AI không bao giờ tự gõ số tài khoản hay nói
 * "đã nhận tiền": người bấm "Đã nhận tiền" → MOZA báo khách bằng câu mẫu (trong 24 giờ).
 */

const caiDat = require('./nghiep-vu/cai-dat');
const cm = require('./nghiep-vu/cau-mau-khach');
const nutBam = require('./nghiep-vu/nut-bam');
const { hienTien } = require('./nghiep-vu/chung');
const vietqr = require('./vietqr');
const guiThe = require('./gui-the-don');

/**
 * @param {{h:object, d:object, layKetNoi:Function, khoa:string}} o
 * @returns {Promise<{da_gui:boolean, trung?:boolean, co_anh:boolean, ly_do?:string, cho_duyet?:boolean}>}
 */
async function guiMaChuyenKhoan({ h, d, layKetNoi, khoa }) {
  const tk = caiDat.taiKhoanNhanTien();
  if (!tk) return { da_gui: false, co_anh: false, ly_do: 'Shop chưa điền đủ ngân hàng, số tài khoản, tên chủ tài khoản (Cài đặt → Bán hàng).' };
  let coAnh = false;
  const anh = await vietqr.taiAnh(vietqr.urlQr(tk, { soTien: d.tong_tien, ma: d.ma }));
  if (anh) {
    try {
      const fb = layKetNoi({ dien_tap: h.dien_tap });
      const len = await fb.taiAnhLen({ page_id: h.page_id, anh, ten: `qr-${vietqr.noiDungCk(d.ma)}.png` });
      if (len?.attachment_id) {
        const kq = await guiThe.guiMoza({ h, the: { kieu: 'media', anh: { attachment_id: len.attachment_id }, nut: [] }, mucDich: 'bao_don', khoa: `${khoa}:anh`, donId: d.id, layKetNoi });
        coAnh = kq.da_gui;
      }
    } catch { /* ảnh lỗi → chỉ tin chữ */ }
  }
  const chu = [
    cm.cau('ck_thong_tin', { ma: d.ma, ngan_hang: tk.ten_ngan, so_tk: tk.so_tk, ten_tk: tk.ten_tk, so_tien: hienTien(d.tong_tien), noi_dung: vietqr.noiDungCk(d.ma) }),
    cm.cau(coAnh ? 'ck_co_qr' : 'ck_khong_qr'),
    require('./nghiep-vu/gia-shop').dongTaiKhoan(),
    cm.cau('ck_bao_lai'),
  ].join('\n').slice(0, 640);
  const nut = [{ tieu_de: cm.cau('nut_doi_cod'), payload: nutBam.taoPayload('DOI_COD', { don: d.id }) }];
  const goi = require('./nghiep-vu/the-xin-thong-tin').nutGoiShop();
  if (goi) nut.push(goi);
  const kq = await guiThe.guiMoza({ h, the: { kieu: 'nut', chu, nut }, mucDich: 'bao_don', khoa: `${khoa}:chu`, donId: d.id, layKetNoi });
  // Cùng khóa (vừa gửi xong) → coi như đã gửi, không gửi lại lần hai.
  return { da_gui: kq.da_gui || !!kq.trung, trung: !!kq.trung, co_anh: coAnh, ly_do: kq.ly_do, cho_duyet: kq.cho_duyet };
}

/**
 * Người bấm "Đã nhận tiền" (#62): còn trong 24 giờ thì báo khách bằng câu mẫu; ngoài 24 giờ không gửi gì.
 * @returns {Promise<{da_gui:boolean, ly_do?:string}>}
 */
async function baoDaNhanTien({ d, layKetNoi }) {
  if (d.thanh_toan !== 'chuyen_khoan') return { da_gui: false, ly_do: 'Đơn COD: không báo.' };
  const h = guiThe.hoiThoaiMessenger(d);
  if (!h) return { da_gui: false, ly_do: 'Khách không nhắn Messenger trong 24 giờ qua: không gửi.' };
  return guiThe.guiTinHeThong({ h, noiDung: cm.cau('ck_da_nhan', { tong: hienTien(d.tong_tien), ma: d.ma }), khoa: `nhan_tien:${d.id}`, layKetNoi, mucDich: 'bao_don', donId: d.id });
}

module.exports = { guiMaChuyenKhoan, baoDaNhanTien };
