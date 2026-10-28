'use strict';

/**
 * Dò từ cấm K11 (SPEC.md F-79, #107) — danh sách ở server/cau-hinh/tu-cam.json. Không có SQL, không gọi AI.
 * So trên chữ bỏ dấu, chữ thường, nguyên từ. Cách gọi món ("áo số 1", "mẫu số 1", "số 1 màu đen") được bỏ trước khi so, để
 * "số 1" chỉ bắt nghĩa "số một thị trường".
 */

const fs = require('node:fs');
const path = require('node:path');
const { boDau } = require('./chung');

const FILE = path.join(__dirname, '..', 'cau-hinh', 'tu-cam.json');
let bo = null;
let docLuc = 0;

function bang() {
  if (!bo || Date.now() - docLuc > 5000) {
    bo = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    docLuc = Date.now();
  }
  return bo;
}

/** Chữ bỏ dấu, chữ thường; chỉ giữ chữ, số và "&" (H&M), cách nhau một dấu cách, có dấu cách hai đầu. */
function gon(s) {
  return ` ${boDau(String(s || '')).toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim()} `;
}

// Cách gọi món: "<danh mục> số N", "mẫu / mã / sp số N", "số N" đứng trước màu, size, cỡ, giá.
function boGoiMon(s) {
  let goi = ['ao', 'quan', 'vay', 'dam', 'chan vay', 'set', 'tui', 'mu', 'giay', 'dep', 'mau', 'ma', 'sp', 'san pham', 'mon', 'bo'];
  try { goi = [...new Set([...goi, ...require('./san-pham').cauHinh().danh_muc.map((d) => gon(d.goi).trim())])]; } catch { /* chưa nạp cấu hình */ }
  return s
    .replace(new RegExp(` (?:${goi.join('|')}) (?:so )?\\d{1,5}(?= )`, 'g'), ' ')
    .replace(/ so \d{1,5}(?= (?:mau|size|co|gia|den|trang|be|kem|xanh|do|hong|vang|nau|xam|tim|cam|s|m|l|xl|xxl)\b)/g, ' ');
}

/**
 * @param {string} cau
 * @param {{nguon?: string[]}} [o]  đoạn trích hợp lệ (thẻ sản phẩm đã xác nhận, Sổ tay) — cụm "can_nguon" có trong đó thì cho qua
 * @returns {{nhom:string, ten:string, cum:string, goi_y:string, luon_chan:boolean}[]}
 */
function timTuCam(cau, { nguon = [], congKhai = true } = {}) {
  const s = boGoiMon(gon(cau));
  const trongNguon = nguon.map((x) => gon(x)).join(' ');
  const ra = [];
  for (const n of bang().nhom) {
    if (n.chi_cong_khai && !congKhai) continue; // F-91: "khách quen" chỉ cấm nơi công khai
    for (const c of n.cum) {
      const cc = ` ${gon(c).trim()} `;
      if (!s.includes(cc)) continue;
      if (!n.luon_chan && trongNguon.includes(cc)) continue;
      ra.push({ nhom: n.ma, ten: n.ten, cum: c, goi_y: n.goi_y, luon_chan: n.luon_chan });
      break; // một cụm mỗi nhóm là đủ để báo
    }
  }
  return ra;
}

/** Thông điệp lỗi K11 kèm cách sửa. */
function thongDiep(x) {
  return `Bỏ cụm "${x.cum}" (${x.ten}): ${x.goi_y}.`;
}

module.exports = { timTuCam, thongDiep, bang, gon };
