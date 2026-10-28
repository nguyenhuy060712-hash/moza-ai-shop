'use strict';

/**
 * Câu mẫu tin cho khách do mã soạn (SPEC.md F-65, F-75): đọc server/cau-hinh/cau-mau-khach.json (đọc lại mỗi lần — sửa tệp là đổi
 * lời ngay), điền {toi}/{ban} theo "Cách xưng hô", {ten_shop}, {tu_nhan_ai} và biến truyền vào. Không có AI ở đây.
 */

const fs = require('node:fs');
const path = require('node:path');
const caiDat = require('./cai-dat');

const FILE = path.join(__dirname, '..', 'cau-hinh', 'cau-mau-khach.json');
// "Cách xưng hô" (F-75, #103): máy không biết giới tính khách nên mặc định "mình – bạn".
const XUNG_HO = {
  minh_ban: { ten: 'mình – bạn', toi: 'mình', ban: 'bạn' },
  shop_chi: { ten: 'shop – chị', toi: 'shop', ban: 'chị' },
  em_anh_chi: { ten: 'em – anh/chị', toi: 'em', ban: 'anh/chị' },
  shop_ban: { ten: 'shop – bạn', toi: 'shop', ban: 'bạn' },
};

let xoay = 0;
const hoa = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function bang() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function xungHo() {
  return XUNG_HO[caiDat.banHang().xung_ho] || XUNG_HO.minh_ban;
}

/**
 * Câu mẫu đã điền.
 * @param {string} khoa
 * @param {object} [bien]
 */
function cau(khoa, bien = {}) {
  const b = bang();
  let x = b[khoa];
  if (x === undefined) throw new Error(`Không có câu mẫu ${khoa}`);
  if (Array.isArray(x)) { xoay += 1; x = x[xoay % x.length]; }
  const xh = xungHo();
  const ten = caiDat.tenShop();
  const tuNhan = String(b.tu_nhan_ai).replace('{ten_shop}', ten);
  const du = { toi: xh.toi, ban: xh.ban, Toi: hoa(xh.toi), Ban: hoa(xh.ban), ten_shop: ten, tu_nhan_ai: tuNhan, ...bien };
  return String(x).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(du, k) ? String(du[k]) : m)).replace(/\s+\./g, '.').trim();
}

/** Mọi câu mẫu (test quét chữ cấm "chưa trả lời / chưa mở / chưa xác nhận"). */
function tatCa() {
  const b = bang();
  return Object.entries(b).filter(([k]) => !k.startsWith('_')).flatMap(([k, v]) => [].concat(v).map((c) => ({ khoa: k, cau: c })));
}

module.exports = { XUNG_HO, cau, xungHo, tatCa };
