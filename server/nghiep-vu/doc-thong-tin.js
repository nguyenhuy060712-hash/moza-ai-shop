'use strict';

/**
 * Đọc thông tin giao hàng khách gửi BẰNG MÃ (SPEC.md F-68 bản 3.4 — quyết định khi chủ dự án vắng, xem mục 12): tin có đủ tên,
 * số di động Việt Nam và địa chỉ ("Nguyễn Lan, 0912 345 678, số 12 ngõ 45 Trần Duy Hưng, Cầu Giấy, Hà Nội") thì MOZA tự điền
 * vào đơn và gửi thẻ đơn để khách bấm xác nhận — 0 lượt AI, vài trăm mili giây. Chỉ điền khi CHẮC (đủ cả ba phần, mỗi phần đúng
 * dạng); còn lại để Tư vấn viên đọc như cũ. Khách thấy thẻ đơn và bấm "Sửa đơn" nếu MOZA đọc sai.
 */

const { chuan, boDau } = require('./chung');

const TU_DIA_CHI = ['so', 'ngo', 'ngach', 'hem', 'kiet', 'duong', 'pho', 'phuong', 'xa', 'thi tran', 'quan', 'huyen', 'tp', 'thanh pho', 'tinh', 'thon',
  'xom', 'ap', 'to', 'khu', 'chung cu', 'toa', 'kdt', 'khu pho', 'lang', 'ban', 'cum', 'phong', 'can ho', 'block', 'lo', 'q', 'p', 'tx', 'thi xa'];
const NHAN = /^(ho ten|ho va ten|ten nguoi nhan|nguoi nhan|ten|sdt|so dien thoai|dien thoai|so dt|dt|dia chi nhan hang|dia chi nhan|dia chi giao|dia chi|dc|d\/c)\s*[:\-–]?\s*/;

function coTuDiaChi(s) {
  const w = ` ${boDau(s).replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ')} `;
  return TU_DIA_CHI.some((t) => w.includes(` ${t} `));
}

/**
 * @param {string} chu
 * @returns {{ten:string|null, sdt:string|null, dia_chi:string|null, chac:boolean}}
 */
function docThongTinGiao(chu) {
  const s = chuan(String(chu || '')).trim();
  const kq = { ten: null, sdt: null, dia_chi: null, chac: false };
  if (!s || s.length > 500) return kq;
  // Tin còn nói chuyện khác (đổi size, thêm món, hỏi, hủy…) → để Tư vấn viên đọc, không tự điền.
  if (/\b(chot|lay|them|doi|size|mau|huy|khong|ko|sao|bao nhieu|ship|\?)\b|\?/.test(boDau(s))) return kq;
  // Số di động: 0 hoặc +84, đầu 3/5/7/8/9, có thể cách bằng dấu cách / chấm / gạch.
  const soM = /(?<!\d)(?:\+?84|0)[\s.\-]?[35789](?:[\s.\-]?\d){8}(?!\d)/.exec(s);
  if (!soM) return kq;
  kq.sdt = soM[0].replace(/[^\d+]/g, '');
  const conLai = `${s.slice(0, soM.index)}\n${s.slice(soM.index + soM[0].length)}`;
  const phan = conLai.split(/\n|,|;|\s[-–]\s|\|/).map((x) => x.trim()).filter(Boolean)
    .map((x) => { const bd = boDau(x); const m = NHAN.exec(bd); return m ? x.slice(m[0].length).trim() : x; }).filter(Boolean);
  const laTen = (x) => /^[\p{L}\s.'-]+$/u.test(x) && x.split(/\s+/).length >= 1 && x.split(/\s+/).length <= 5 && !coTuDiaChi(x) && x.length <= 50;
  const iTen = phan.findIndex(laTen);
  if (iTen < 0) return kq;
  kq.ten = phan[iTen].replace(/\s+/g, ' ');
  const diaChi = phan.filter((_, i) => i !== iTen).join(', ').replace(/\s+/g, ' ').trim();
  if (diaChi.length >= 10 && (coTuDiaChi(diaChi) || /\d/.test(diaChi)) && diaChi.split(',').length >= 2) kq.dia_chi = diaChi.slice(0, 300);
  kq.chac = !!(kq.ten && kq.sdt && kq.dia_chi);
  return kq;
}

module.exports = { docThongTinGiao };
