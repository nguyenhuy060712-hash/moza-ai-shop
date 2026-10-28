'use strict';

/**
 * Đồ dùng chung của khối Nghiệp vụ: lỗi có mã, ID, thời gian, chuẩn hóa chữ, kiểm dữ liệu vào.
 */

const crypto = require('node:crypto');

/** Lỗi nghiệp vụ có mã (SPEC.md mục 8, "Mã lỗi") và mã HTTP đi kèm. */
class LoiNghiepVu extends Error {
  constructor(ma, thongDiep, http = 400) {
    super(thongDiep);
    this.ma = ma;
    this.http = http;
  }
}

const KY_TU = '0123456789abcdefghijklmnopqrstuvwxyz';

/** ID dạng `tin_k3j9x0a1b2c3`: tiền tố + 12 ký tự base36 ngẫu nhiên (SPEC.md mục 7). */
function taoId(tienTo) {
  let s = '';
  for (const b of crypto.randomBytes(12)) s += KY_TU[b % 36];
  return `${tienTo}_${s}`;
}

function gio() {
  return new Date().toISOString();
}

/**
 * Chuẩn hóa chữ trước khi lưu: NFC (cùng chữ "ư" có hai cách mã hóa, không chuẩn hóa
 * thì so trích dẫn sẽ sai — SPEC.md mục 7), xuống dòng kiểu Windows về `\n`.
 */
function chuan(s) {
  return String(s ?? '').normalize('NFC').replace(/\r\n?/g, '\n');
}

/** Bỏ dấu tiếng Việt để tìm kiếm: gõ "que vo" vẫn ra "Quế Võ". */
function boDau(s) {
  return chuan(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/**
 * Kiểm một ô chữ người dùng nhập. Trả về chữ đã chuẩn hóa và cắt khoảng trắng hai đầu.
 * @param {{ten:string, batBuoc?:boolean, toiDa:number, motDong?:boolean}} o
 */
function kiemChu(giaTri, { ten, batBuoc = false, toiDa, motDong = false }) {
  if (giaTri != null && typeof giaTri !== 'string') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} phải là chữ.`);
  const s = chuan(giaTri).trim();
  if (batBuoc && !s) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Chưa nhập ${ten.toLowerCase()}.`);
  if (s.length > toiDa) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} dài quá ${toiDa} ký tự.`);
  if (motDong && /\n/.test(s)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} chỉ được một dòng.`);
  return s;
}

/**
 * Đọc số tiền người dùng gõ thành số nguyên VND (SPEC.md mục 7, F-51): "289k", "289.000", "289.000đ", "1tr2", "1,2tr",
 * "1 triệu 2", "1tr". Trống → null. Không đọc được → lỗi có tên ô.
 */
function docTien(giaTri, { ten = 'Giá', batBuoc = false } = {}) {
  if (giaTri == null || String(giaTri).trim() === '') {
    if (batBuoc) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Chưa nhập ${ten.toLowerCase()}.`);
    return null;
  }
  if (typeof giaTri === 'number') {
    if (!Number.isInteger(giaTri) || giaTri < 0) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} phải là số nguyên không âm.`);
    return giaTri;
  }
  const s = boDau(giaTri).replace(/\s+/g, '').replace(/(vnd|dong|d)$/, '');
  let m;
  let so = null;
  if ((m = /^(\d+)(?:[.,](\d+))?(tr|trieu|m)(\d{0,3})$/.exec(s))) {
    // "1tr2" = 1.200.000; "1,25tr" = 1.250.000; "1tr250" = 1.250.000
    const le = m[2] ?? m[4] ?? '';
    so = Number(m[1]) * 1e6 + (le ? Math.round(Number(`0.${le}`) * 1e6) : 0);
  } else if ((m = /^(\d+)(?:[.,](\d+))?k$/.exec(s))) {
    so = Math.round(Number(`${m[1]}.${m[2] || 0}`) * 1000);
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    so = Number(s.replace(/[.,]/g, ''));
  } else if (/^\d+$/.test(s)) {
    so = Number(s);
  }
  if (so === null || !Number.isSafeInteger(so)) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} "${giaTri}" chưa đọc được. Gõ kiểu 289000, 289k hoặc 1tr2.`);
  }
  return so;
}

/** 289000 → "289.000đ" (cách hiện giá ở mọi nơi, kể cả dòng dữ liệu cho Bộ kiểm tra). */
function hienTien(so) {
  if (so == null) return '';
  return `${String(Math.round(so)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
}

module.exports = { LoiNghiepVu, taoId, gio, chuan, boDau, kiemChu, docTien, hienTien };
