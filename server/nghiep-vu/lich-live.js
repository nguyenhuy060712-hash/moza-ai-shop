'use strict';

/**
 * Lịch live cố định (SPEC.md F-96, #117): tích thứ + chọn giờ (06:00–23:30, bước 30 phút), dời / hủy một buổi. Lưu ở cai_dat khóa
 * 'lich_live' = { buoi: [{thu, gio}], ngoai_le: [{ngay, huy:true} | {ngay, gio_moi}] }. `thu` theo JavaScript: 0 = Chủ nhật,
 * 1 = thứ Hai … 6 = thứ Bảy. Mọi giờ tính theo giờ Việt Nam (UTC+7, không đổi giờ theo mùa).
 * Lịch là lời hứa công khai: luôn có "Dời / Hủy buổi này"; AI trích được dòng lịch (dongLich → Bộ kiểm tra K2).
 */

const caiDat = require('./cai-dat');
const { LoiNghiepVu } = require('./chung');

const VN_MS = 7 * 3600e3;
const TEN_THU = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
const LECH_KHOP_MS = 60 * 60e3;

function lich() {
  const l = caiDat.doc('lich_live', null) || {};
  return { buoi: Array.isArray(l.buoi) ? l.buoi : [], ngoai_le: Array.isArray(l.ngoai_le) ? l.ngoai_le : [] };
}

function kiemGio(g) {
  const m = /^(\d{1,2}):(00|30)$/.exec(String(g || '').trim());
  const p = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
  if (p < 360 || p > 1410) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Giờ live chọn từ danh sách (06:00–23:30, bước 30 phút).');
  return `${String(Math.floor(p / 60)).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`;
}

/** Đặt lịch cố định (thay cả lịch; ngoại lệ đã qua tự bỏ). */
function datLich({ buoi = [] } = {}) {
  if (!Array.isArray(buoi) || buoi.length > 14) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Lịch live tối đa 14 buổi một tuần.');
  const ds = buoi.map((b) => {
    const thu = Number(b.thu);
    if (!Number.isInteger(thu) || thu < 0 || thu > 6) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thứ chọn từ danh sách.');
    return { thu, gio: kiemGio(b.gio) };
  });
  const homNay = ngayVN(Date.now());
  const cu = lich();
  const moi = { buoi: [...new Map(ds.map((b) => [`${b.thu}|${b.gio}`, b])).values()].sort((a, b) => ((a.thu + 6) % 7) - ((b.thu + 6) % 7) || a.gio.localeCompare(b.gio)),
    ngoai_le: cu.ngoai_le.filter((x) => x.ngay >= homNay) };
  caiDat.ghi('lich_live', moi);
  return moi;
}

/** "YYYY-MM-DD" theo giờ Việt Nam. */
function ngayVN(t) {
  return new Date(new Date(t).getTime() + VN_MS).toISOString().slice(0, 10);
}

/** Mốc UTC của ngày (giờ VN) + giờ "HH:MM". */
function lucCua(ngay, gio) {
  return new Date(`${ngay}T${gio}:00+07:00`).getTime();
}

/**
 * Các buổi trong [tu, den) (đã áp dời / hủy).
 * @returns {{luc:string, ngay:string, gio:string, thu:number, doi:boolean}[]}
 */
function cacBuoi(tu, den) {
  const l = lich();
  if (!l.buoi.length) return [];
  const ra = [];
  const bd = new Date(ngayVN(tu) + 'T00:00:00+07:00').getTime() - 86400e3;
  for (let t = bd; t < new Date(den).getTime() + 86400e3; t += 86400e3) {
    const ngay = ngayVN(t + 12 * 3600e3);
    const thu = new Date(`${ngay}T12:00:00+07:00`).getUTCDay();
    const nl = l.ngoai_le.find((x) => x.ngay === ngay);
    for (const b of l.buoi.filter((x) => x.thu === thu)) {
      if (nl?.huy) continue;
      const gio = nl?.gio_moi || b.gio;
      const luc = lucCua(ngay, gio);
      if (luc >= new Date(tu).getTime() && luc < new Date(den).getTime()) ra.push({ luc: new Date(luc).toISOString(), ngay, gio, thu, doi: !!nl?.gio_moi });
    }
  }
  return [...new Map(ra.map((x) => [x.luc, x])).values()].sort((a, b) => a.luc.localeCompare(b.luc));
}

/** Chữ một buổi: "20:00 thứ Năm 2/10". */
function chuBuoi(b) {
  if (!b) return '';
  const [, m, d] = b.ngay.split('-').map(Number);
  return `${b.gio} ${TEN_THU[b.thu]} ${d}/${m}`;
}

/** Buổi kế (từ lúc `bayGio`, trong 14 ngày). @returns {object|null} buổi + chu */
function buoiKe(bayGio = Date.now()) {
  const b = cacBuoi(new Date(bayGio).toISOString(), new Date(new Date(bayGio).getTime() + 14 * 86400e3).toISOString())[0];
  return b ? { ...b, chu: chuBuoi(b) } : null;
}

/** Live bắt đầu lúc `lucLive` khớp buổi nào trong lịch (lệch ±60 phút). */
function khopBuoi(lucLive) {
  const t = new Date(lucLive).getTime();
  const b = cacBuoi(new Date(t - LECH_KHOP_MS).toISOString(), new Date(t + LECH_KHOP_MS + 1).toISOString())
    .find((x) => Math.abs(new Date(x.luc).getTime() - t) <= LECH_KHOP_MS);
  return b ? { ...b, chu: chuBuoi(b) } : null;
}

/**
 * Dời / hủy một buổi: `ngay` "YYYY-MM-DD" (giờ VN) của buổi trong lịch; `huy` hoặc `gio_moi`. Bỏ ngoại lệ: `bo: true`.
 */
function doiBuoi({ ngay, huy = false, gio_moi: gioMoi = null, bo = false }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ngay || ''))) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn ngày của buổi cần dời / hủy.');
  const l = lich();
  const thu = new Date(`${ngay}T12:00:00+07:00`).getUTCDay();
  if (!l.buoi.some((b) => b.thu === thu)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Ngày này không có buổi live trong lịch.', 404);
  const ngoaiLe = l.ngoai_le.filter((x) => x.ngay !== ngay);
  if (!bo) ngoaiLe.push(huy ? { ngay, huy: true } : { ngay, gio_moi: kiemGio(gioMoi) });
  caiDat.ghi('lich_live', { ...l, ngoai_le: ngoaiLe.sort((a, b) => a.ngay.localeCompare(b.ngay)) });
  return lich();
}

/** Dòng cho nguồn của AI (dongCaiDat): "Lịch live: 20:00 thứ Ba, thứ Năm hằng tuần; buổi kế 20:00 thứ Năm 2/10". */
function dongLich(bayGio = Date.now()) {
  const l = lich();
  if (!l.buoi.length) return null;
  const theoGio = new Map();
  for (const b of l.buoi) theoGio.set(b.gio, [...(theoGio.get(b.gio) || []), TEN_THU[b.thu]]);
  const chu = [...theoGio.entries()].map(([g, thu]) => `${g} ${thu.join(', ')}`).join('; ');
  const ke = buoiKe(bayGio);
  return `Lịch live: ${chu} hằng tuần${ke ? `; buổi kế ${ke.chu}` : ''}`;
}

module.exports = { TEN_THU, lich, datLich, cacBuoi, buoiKe, khopBuoi, doiBuoi, dongLich, chuBuoi, ngayVN };
