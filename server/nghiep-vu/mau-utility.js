'use strict';

/**
 * Bộ mẫu tin Utility của MOZA (SPEC.md F-67, F-69, #89, #99): "đơn đã gửi", "đơn đang chờ xác nhận" (có nút), "đơn đã hủy".
 * Nội dung ở server/cau-hinh/mau-utility.json (một nguồn cho cả Phòng diễn tập lẫn Page thật). Cài đặt `fb_mau_utility` giữ
 * lần gửi Meta duyệt: dạng bộ { da_gui, cho_xac_nhan, da_huy } — vẫn đọc được dạng cũ (một mẫu "đơn đã gửi" của #89).
 * Chỉ gửi mẫu khi Meta đã duyệt VÀ xếp loại UTILITY — bị xếp MARKETING thì không gửi (ngoài 24 giờ chỉ tin giao dịch được phép).
 */

const caiDat = require('./cai-dat');
const { hienTien } = require('./chung');
const BO = require('../cau-hinh/mau-utility.json');

const LOAI = ['da_gui', 'cho_xac_nhan', 'da_huy', 'da_xac_nhan', 'chuan_bi_gui', 'hoi_mac'];
const TEN = { da_gui: 'Đơn đã gửi', cho_xac_nhan: 'Đơn đang chờ xác nhận', da_huy: 'Đơn đã hủy', da_xac_nhan: 'Đơn đã xác nhận', chuan_bi_gui: 'Chuẩn bị gửi (hỏi lại)', hoi_mac: 'Hỏi mặc có vừa' };

/** Bộ mẫu đã gửi Meta duyệt (Page thật). Dạng cũ { ten, ngon_ngu, tao_luc } = mẫu "đơn đã gửi". */
function daTao() {
  const x = caiDat.doc('fb_mau_utility', null);
  if (!x) return {};
  if (x.ten && !x.da_gui) return { da_gui: { ten: x.ten, ngon_ngu: x.ngon_ngu || 'vi', tao_luc: x.tao_luc || null } };
  return Object.fromEntries(LOAI.filter((k) => x[k]?.ten).map((k) => [k, x[k]]));
}

/**
 * Mẫu dùng được cho một loại: diễn tập luôn có (Facebook giả có sẵn bộ mẫu đã duyệt); Page thật chỉ khi đã bấm "Tạo bộ mẫu tin".
 * @returns {{ten:string, ngon_ngu:string, noi_dung:string, tham_so:string[], nut:object[]}|null}
 */
function mau(loai, { dienTap = false } = {}) {
  const goc = BO[loai];
  if (!goc) return null;
  if (dienTap) return { ...goc, ngon_ngu: 'vi' };
  const t = daTao()[loai];
  return t ? { ...goc, ten: t.ten, ngon_ngu: t.ngon_ngu || 'vi' } : null;
}

/** Tham số điền vào mẫu theo đơn (thứ tự như `tham_so` trong tệp cấu hình). */
function thamSo(loai, d) {
  const giu = d.giu_den ? new Date(d.giu_den).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
  const gia = {
    ten_nhan: d.ten_nhan || 'bạn', ma: d.ma, ten_shop: caiDat.tenShop(), ma_van_don: d.ma_van_don || 'đang cập nhật',
    mon: (d.dong || []).map((x) => `${x.ten_chup.replace(/^Số (\d+) · /, 'Số $1 ')} x${x.so_luong}`).join(', ').slice(0, 200) || 'đơn hàng',
    tong_tien: hienTien(d.tong_tien), giu_den: giu,
  };
  return (BO[loai]?.tham_so || []).map((k) => String(gia[k] ?? ''));
}

/** Chữ khách sẽ thấy (ghi vào Hộp thư). */
function chuDien(loai, d) {
  let s = BO[loai]?.noi_dung || '';
  thamSo(loai, d).forEach((v, i) => { s = s.split(`{{${i + 1}}}`).join(v); });
  return s;
}

/** Ghi lần tạo bộ mẫu (mỗi loại: tên, lúc tạo, kết quả từng Page). */
function ghiDaTao(ketQua) {
  const cu = daTao();
  const luc = new Date().toISOString();
  const moi = { ...cu };
  for (const k of LOAI) {
    const kq = ketQua.filter((x) => x.loai === k);
    if (kq.some((x) => !x.loi)) moi[k] = { ten: BO[k].ten, ngon_ngu: 'vi', tao_luc: luc, ket_qua: kq };
  }
  return caiDat.ghi('fb_mau_utility', moi);
}

module.exports = { BO, LOAI, TEN, daTao, mau, thamSo, chuDien, ghiDaTao };
