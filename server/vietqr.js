'use strict';

/**
 * Ảnh mã QR chuyển khoản VietQR (SPEC.md F-89, #112 — cách A: người vẫn tự bấm "Đã nhận tiền"). Dùng "quick link" của VietQR:
 *   https://img.vietqr.io/image/{bin}-{stk}-compact2.png?amount=…&addInfo=DH0042&accountName=…
 * (tra vietqr.io và gọi thử một lần với số tài khoản mẫu ngày 28/9/2026: trả PNG có logo ngân hàng, tên chủ TK, số tiền).
 * Địa chỉ ảnh CHỈ có dữ liệu của shop: BIN ngân hàng, số tài khoản, số tiền, mã đơn, tên chủ TK — không có tên, số, địa chỉ khách.
 * Tải ảnh có hạn giờ (5 giây); lỗi hoặc treo → null, nơi gọi chỉ gửi tin chữ. `datFetch` cho test tiêm fetch giả.
 */

const { boDau } = require('./nghiep-vu/chung');

const HAN_MS = 5000;
const goc = (...a) => fetch(...a);
let fetchDung = goc;

/** Test: thay fetch (null = trả lại fetch thật). */
function datFetch(fn) {
  fetchDung = fn || goc;
}

/** Nội dung chuyển khoản từ mã đơn: "DH-0042" → "DH0042" (chỉ chữ, số; ≤ 9 ký tự để sau đổi sang cổng thanh toán vẫn vừa). */
const noiDungCk = (ma) => String(ma || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 9);

/** Tên chủ TK như VietQR cần: viết hoa, bỏ dấu (không sửa giá trị đã lưu). */
const tenKhongDau = (s) => boDau(s).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * @param {{bin:string, so_tk:string, ten_tk:string}} tk
 * @param {{soTien:number, ma:string}} o
 */
function urlQr(tk, { soTien, ma }) {
  const q = `amount=${Math.max(0, Math.round(Number(soTien) || 0))}&addInfo=${encodeURIComponent(noiDungCk(ma))}&accountName=${encodeURIComponent(tenKhongDau(tk.ten_tk))}`;
  return `https://img.vietqr.io/image/${encodeURIComponent(tk.bin)}-${encodeURIComponent(tk.so_tk)}-compact2.png?${q}`;
}

/**
 * Tải ảnh QR. @returns {Promise<Buffer|null>} null khi lỗi, không phải ảnh, hoặc quá hạn giờ.
 */
async function taiAnh(url, { hanMs = HAN_MS } = {}) {
  const ac = new AbortController();
  let hen;
  const hetGio = new Promise((_, loi) => { hen = setTimeout(() => { ac.abort(); loi(new Error('het_gio')); }, hanMs); });
  try {
    const r = await Promise.race([fetchDung(url, { signal: ac.signal }), hetGio]);
    if (!r?.ok) return null;
    const kieu = r.headers?.get?.('content-type') || '';
    if (kieu && !/^image\//i.test(kieu)) return null;
    const b = Buffer.from(await Promise.race([r.arrayBuffer(), hetGio]));
    return b.length ? b : null;
  } catch {
    return null;
  } finally {
    clearTimeout(hen);
  }
}

module.exports = { urlQr, taiAnh, datFetch, noiDungCk, tenKhongDau, HAN_MS };
