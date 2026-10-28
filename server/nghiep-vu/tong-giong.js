'use strict';

/**
 * Tông giọng trên sóng (SPEC.md F-127; docs/11 mục 6.4) — danh sách dùng chung `cau-hinh/tong-giong.json`. Chọn ở Cài đặt → Giọng Mai
 * hoặc bước 2 của "Bắt đầu live" (cùng một cài đặt — một shop, một laptop). Mai: ghép cuối lời dặn khi mở miệng; đổi giữa buổi thì
 * GPT-Live thêm lời dặn (`session.instructions.append`, ≤ 500 token), Gemini mở lại miệng. Đội AI: cách nói mặc định cho lượt không ghi.
 */

const caiDat = require('./cai-dat');
const { LoiNghiepVu, chuan } = require('./chung');

const BANG = () => require('../cau-hinh/tong-giong.json');

function danhSach() {
  return BANG().tong.map(({ ma, ten, mo_ta: moTa }) => ({ ma, ten, mo_ta: moTa }));
}

/** Tông đang chọn: {ma, tu_viet}. */
function dangChon() {
  const b = BANG();
  const x = caiDat.doc('tong_giong', null) || {};
  const ma = b.tong.some((t) => t.ma === x.ma) ? x.ma : b.mac_dinh;
  return { ma, tu_viet: x.tu_viet || '' };
}

function datTong({ ma, tu_viet: tuViet = '' } = {}) {
  const b = BANG();
  if (!b.tong.some((t) => t.ma === ma)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có tông giọng "${ma}".`);
  const chu = chuan(String(tuViet || '')).replace(/\s+/g, ' ').trim();
  if (ma === 'tu_viet' && !chu) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Tông "Tự viết": gõ vài câu mô tả cách Mai nói.');
  if (chu.length > b.tu_viet_toi_da) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Mô tả tông giọng tối đa ${b.tu_viet_toi_da} ký tự.`);
  caiDat.ghi('tong_giong', { ma, tu_viet: ma === 'tu_viet' ? chu : '' });
  return dangChon();
}

/** Chỉ dẫn cách nói của tông (để ghép vào lời dặn). */
function chiDan({ ma, tu_viet: tuViet } = dangChon()) {
  if (ma === 'tu_viet') return tuViet;
  return BANG().tong.find((t) => t.ma === ma)?.chi_dan || '';
}

/** Đoạn ghép cuối lời dặn của miệng Mai. */
function doanLoiDan(x = dangChon()) {
  const c = chiDan(x);
  return c ? `TÔNG GIỌNG TRÊN SÓNG (làm theo, không đọc ra): ${c}` : '';
}

/** Đoạn thêm giữa buổi khi đổi tông (GPT-Live, ≤ 500 token). */
function doanDoiGiua(x = dangChon()) {
  const c = chiDan(x);
  return c ? `Từ giờ đổi tông giọng trên sóng (làm theo, không đọc ra, không nhắc là vừa đổi): ${c}` : '';
}

/** Đội AI: cách nói ngắn dùng khi lượt không ghi cách nói. */
function cachNoiDoi(x = dangChon()) {
  if (x.ma === 'tu_viet') return x.tu_viet.slice(0, 120);
  return BANG().tong.find((t) => t.ma === x.ma)?.cach_noi_doi || '';
}

/** Khóa so sánh để biết tông vừa đổi. */
const khoa = (x = dangChon()) => `${x.ma}:${x.tu_viet}`;

module.exports = { danhSach, dangChon, datTong, chiDan, doanLoiDan, doanDoiGiua, cachNoiDoi, khoa };
