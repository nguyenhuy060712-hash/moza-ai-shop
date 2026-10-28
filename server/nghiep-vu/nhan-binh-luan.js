'use strict';

/**
 * Gắn nhãn bình luận bằng quy tắc (không cần AI), dùng ngay khi bình luận về:
 *  - `thong_tin_ca_nhan`: lộ số điện thoại hoặc CCCD công khai (#19 — sẽ bị ẩn, chuyển Tư vấn viên);
 *  - `cau_hoi`: có dấu hỏi hoặc cách hỏi quen thuộc của người xem live;
 *  - `muon_xem` (F-81): khách xin xem mặt sau / cận vải / toàn thân / màu khác — thẻ nhắc người dẫn (vẫn tới Director);
 *  - `gia_shop` (F-74): số tài khoản / link lạ của người không phải Page — ẩn, không chuyển Tư vấn viên, báo người dẫn;
 *  - `ib`, `ib_gia` (F-70): xin nhắn lại / chưa thấy tin; hỏi giá chung ("giá sao");
 *  - `an_ten`, `xin_dung` (F-66): xin không đọc tên trên sóng / xin thôi nhận tin (từ khóa ở server/cau-hinh/tu-khoa.json).
 * Các nhãn cần hiểu nghĩa (spam, xúc phạm, cố lừa AI) do Director gắn ở phần AI.
 */

const { chuan } = require('./chung');

// Bỏ dấu cách, chấm, gạch giữa các chữ số: "0912 345.678" → "0912345678".
function chuSoLien(s) {
  return s.replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
}

// Số di động Việt Nam: 0 hoặc +84/84, đầu số 3, 5, 7, 8, 9, thêm 8 chữ số.
const SO_DIEN_THOAI = /(?<!\d)(?:\+?84|0)[35789]\d{8}(?!\d)/;
// CCCD 12 chữ số.
const CCCD = /(?<!\d)\d{12}(?!\d)/;

const CACH_HOI = [
  'bao nhiêu', 'mấy', 'khi nào', 'lúc nào', 'ở đâu', 'chỗ nào', 'thế nào', 'như nào', 'ra sao', 'tại sao',
  'được không', 'đc không', 'dc ko', 'được ko', 'có không', 'không ạ', 'ko ạ', 'k ạ', 'hả', 'nhỉ', 'chưa ạ',
  'cho hỏi', 'cho em hỏi', 'cho mình hỏi', 'xin hỏi', 'tư vấn',
];

/** Số điện thoại trong bình luận (chuẩn +84…), null nếu không có — F-88 lưu làm gợi ý cho đúng đơn. */
function laySdt(noiDung) {
  const m = SO_DIEN_THOAI.exec(chuSoLien(chuan(noiDung)));
  return m ? m[0] : null;
}

function coThongTinCaNhan(noiDung) {
  const s = chuSoLien(chuan(noiDung));
  return SO_DIEN_THOAI.test(s) || CCCD.test(s);
}

function laCauHoi(noiDung) {
  const s = chuan(noiDung).toLowerCase();
  if (s.includes('?')) return true;
  // \b của JavaScript chỉ hiểu chữ không dấu, nên dùng \p{L} để nhận ranh giới chữ tiếng Việt.
  if (/(?<!\p{L})có(?!\p{L}).+(?<!\p{L})(không|ko|k)(?!\p{L})/u.test(s)) return true;
  // Viết tắt hay gặp trong bình luận live: "lương sao ạ", "lương bn", "nhiêu vậy".
  if (/(?<!\p{L})(sao|bn|nhiêu|nhiu)(?!\p{L})/u.test(s)) return true;
  return CACH_HOI.some((c) => s.includes(c));
}

/** F-81: mọi màu của sản phẩm Đang bán (câu "mặc màu be" chỉ tính khi có màu đó). */
function mauDangBan() {
  try {
    const sp = require('./san-pham');
    return [...new Set(sp.mucLucDangBan().flatMap((x) => sp.phanLoaiCua(x.id).map((p) => p.gt1)).filter((m) => m && m !== 'Mặc định'))];
  } catch { return []; }
}

/** F-74: link m.me tới chính Page của shop thì không tính là link lạ. */
function laGiaShopBl(noiDung) {
  let ids = ['page_gia'];
  try { ids = [...ids, ...require('./fb-page').danhSach().map((p) => p.id)]; } catch { /* chưa mở cơ sở dữ liệu */ }
  return require('./gia-shop').laGiaShop(noiDung, { pageIds: ids });
}

function nhanBinhLuan(noiDung) {
  const nhan = [];
  if (laCauHoi(noiDung)) nhan.push('cau_hoi');
  if (coThongTinCaNhan(noiDung)) nhan.push('thong_tin_ca_nhan');
  // F-66: xin không đọc tên trên live; xin thôi nhận tin (câu ngắn, không kèm món).
  const tk = require('./tu-khoa');
  if (tk.laAnTen(noiDung)) nhan.push('an_ten');
  if (tk.laXinDung(noiDung)) nhan.push('xin_dung');
  if (laGiaShopBl(noiDung)) nhan.push('gia_shop');
  if (tk.loaiMuonXem(noiDung, { mauCo: mauDangBan() })) nhan.push('muon_xem');
  // F-70: "ib / check ib / chưa thấy tin / giá sao" — nhắn lại thẻ bằng mã, trước khi đọc chốt và Director.
  const ib = tk.laIb(noiDung);
  if (ib) nhan.push(ib.gia ? 'ib_gia' : 'ib');
  return nhan;
}

module.exports = { nhanBinhLuan, coThongTinCaNhan, laCauHoi, laySdt };
