'use strict';

/**
 * Đường ảnh sản phẩm công khai HẸP cho thẻ giữ hàng trên Messenger (SPEC.md #97 — ngoại lệ luật "ảnh chỉ ở 127.0.0.1",
 * chủ dự án đồng ý 27/9/2026). Thẻ ảnh của Messenger (generic template) chỉ nhận `image_url` nên Meta phải tải được ảnh.
 *  - Chỉ ảnh của sản phẩm ĐANG BÁN; không ảnh khách, không video, không liệt kê thư mục.
 *  - Tên tệp băm bằng bí mật riêng của máy (không đoán được, không lộ id sản phẩm): /anh-sp/<32 ký tự>.<đuôi>.
 *  - Chỉ đọc; phục vụ trên cổng webhook (đi qua đường hầm). Mọi đường khác của giao diện vẫn chỉ ở 127.0.0.1.
 */

const crypto = require('node:crypto');
const path = require('node:path');
const caiDat = require('./cai-dat');
const sp = require('./san-pham');

const KIEU = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
let bang = null;
let bangLuc = 0;

function biMat() {
  let b = caiDat.doc('anh_cong_khai_bi_mat', null);
  if (!b) b = caiDat.ghi('anh_cong_khai_bi_mat', crypto.randomBytes(24).toString('hex'));
  return b;
}

function tenBam(sanPhamId, tep) {
  const duoi = (path.extname(tep) || '.jpg').toLowerCase();
  return `${crypto.createHmac('sha256', biMat()).update(`${sanPhamId}/${tep}`).digest('hex').slice(0, 32)}${duoi}`;
}

/** Địa chỉ công khai của một ảnh (qua đường hầm đang mở). Không có đường hầm → null (thẻ lùi về thẻ chữ có nút). */
function url(s, tep, goc) {
  if (!goc || !tep || s.trang_thai !== 'dang_ban' || !KIEU[(path.extname(tep) || '').toLowerCase()]) return null;
  return `${String(goc).replace(/\/$/, '')}/anh-sp/${tenBam(s.id, tep)}`;
}

/** Tên băm → tệp ảnh trên đĩa, chỉ khi ảnh đó thuộc sản phẩm Đang bán. Bảng dựng lại mỗi 60 giây. */
function timTep(ten) {
  if (!/^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/.test(String(ten))) return null;
  if (!bang || Date.now() - bangLuc > 60000) {
    bang = new Map();
    for (const x of sp.danhSach()) {
      const s = sp.laySanPham(x.id);
      if (s.trang_thai !== 'dang_ban') continue;
      for (const a of s.anh || []) if (KIEU[(path.extname(a.tep) || '').toLowerCase()]) bang.set(tenBam(s.id, a.tep), { sanPhamId: s.id, tep: a.tep });
    }
    bangLuc = Date.now();
  }
  const x = bang.get(ten);
  if (!x) return null;
  const f = sp.duongAnh(x.sanPhamId, x.tep);
  return f ? { file: f, kieu: KIEU[path.extname(x.tep).toLowerCase()] } : null;
}

function xoaBang() {
  bang = null;
}

module.exports = { url, timTep, tenBam, xoaBang };
