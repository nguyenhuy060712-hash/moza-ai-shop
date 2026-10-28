'use strict';

/**
 * Từ riêng của shop cho phần nghe người dẫn (SPEC.md F-87, P44) — tối đa 100 cụm (Google khuyên ≤ 100; OpenAI nhận tối đa 100),
 * theo thứ tự ưu tiên:
 *  1. lệnh bằng lời ("Mai ơi", "mẫu cao", "bảng size", "bình chọn", "cảm ơn cả nhà"…);
 *  2. tên AI, tên shop;
 *  3. cách gọi món trong phiên ("áo 12", "áo số 12", "số 12");
 *  4. màu, cỡ của các món trong phiên;
 *  5. tên và tên gọi khác của món trong phiên;
 *  6. món Đang bán khác nếu còn chỗ.
 * Lọc ký tự <, > và xuống dòng (OpenAI từ chối phiên có các ký tự này); không trùng (không phân biệt hoa thường).
 * Google khuyên chỉ đưa từ riêng, tên riêng — bỏ chữ thường ngày đứng một mình ("mặc", "chiếu").
 */

const sp = require('./san-pham');
const caiDat = require('./cai-dat');

const LENH = ['Mai ơi', 'chốt', 'mẫu cao', 'mẫu mặc', 'bảng size', 'quay lại camera', 'cả hai', 'bình chọn', 'cảm ơn cả nhà', 'chiếu video', 'chiếu ảnh', 'ẩn số đo mẫu', 'chốt test'];
const TOI_DA = 100;

/** @param {object|null} p  phiên live (kịch bản) */
function tuRiengCua(p) {
  const ds = [];
  const them = (x) => {
    const t = String(x ?? '').replace(/[<>\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 60 || ds.length >= TOI_DA) return;
    if (!ds.some((y) => y.toLowerCase() === t.toLowerCase())) ds.push(t);
  };
  LENH.forEach(them);
  them(caiDat.tenAi().split(' - ')[0]);
  them(caiDat.banHang().ten_shop);
  const trongPhien = [];
  for (const d of p?.kich_ban?.doan || []) {
    const id = d.san_pham_id || d.san_pham?.id;
    if (!id || trongPhien.some((x) => x.id === id)) continue;
    try { trongPhien.push(sp.laySanPham(id)); } catch { /* đã xóa */ }
  }
  for (const s of trongPhien) {
    const goi = sp.tenGoi(s); // "áo số 12"
    them(goi.replace(' số ', ' '));
    them(goi);
    them(`số ${s.so}`);
  }
  for (const s of trongPhien) {
    for (const pl of sp.phanLoaiCua(s.id).filter((x) => !x.bo)) { them(pl.gt1 !== 'Mặc định' ? pl.gt1 : ''); them(pl.gt2 && !/^[smlx]{1,3}$/i.test(pl.gt2) ? pl.gt2 : ''); }
  }
  for (const s of trongPhien) { them(s.ten); for (const x of s.ten_goi_khac || []) them(x); }
  const ids = new Set(trongPhien.map((x) => x.id));
  for (const x of sp.mucLucDangBan()) if (!ids.has(x.id)) them(x.ten);
  return ds.slice(0, TOI_DA);
}

module.exports = { tuRiengCua, LENH, TOI_DA };
