'use strict';

/**
 * Nhận ý của bình luận / tin nhắn bằng từ khóa (SPEC.md F-66, F-70, F-74) — một tệp cấu hình server/cau-hinh/tu-khoa.json.
 * Không gọi AI: nhanh, 0 đồng, vẫn chạy khi "Dừng AI".
 */

const fs = require('node:fs');
const path = require('node:path');
const { boDau } = require('./chung');

const FILE = path.join(__dirname, '..', 'cau-hinh', 'tu-khoa.json');
let bo = null;
let docLuc = 0;

function bang() {
  // Đọc lại mỗi 5 giây: sửa tệp là có tác dụng, không đọc đĩa với mỗi bình luận.
  if (!bo || Date.now() - docLuc > 5000) {
    bo = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    docLuc = Date.now();
  }
  return bo;
}

/** Chữ bỏ dấu, chữ thường, chỉ còn chữ và số cách nhau một dấu cách. */
function gon(s) {
  return boDau(String(s || '')).replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Bỏ từ đệm ("shop ơi", "ạ", "nha", "giúp em"…) — giữ lại phần mang nghĩa. */
function boDem(s) {
  const dem = new Set(bang().tu_dem);
  return gon(s).split(' ').filter((w) => w && !dem.has(w)).join(' ');
}

/**
 * Khách xin thôi nhận tin (#96): câu ngắn, không kèm món / size / số. "thôi shop ơi em lấy size L" KHÔNG phải xin dừng.
 */
function laXinDung(s) {
  const g = gon(s);
  if (!g || g.split(' ').length > 9 || /\d/.test(g)) return false;
  const b = bang().ngung;
  if (b.chi_mot_minh.includes(g)) return true;
  const con = boDem(s);
  // "thôi shop ơi": chỉ có "thôi" và từ đệm.
  if (!con) return g.split(' ')[0] === 'thoi';
  // "dung" trơn không dấu thường là "đúng" ("dung roi" = đúng rồi): chỉ tính khi gõ có dấu "dừng" hoặc viết hoa DUNG.
  if (con === 'dung' && !/dừng/i.test(String(s)) && !/(^|[^A-Za-z])DUNG([^A-Za-z]|$)/.test(String(s))) return false;
  // "thôi" là từ đệm: "thôi đừng nhắn nữa" → "dung nhan nua".
  return b.cum.includes(con);
}

/** Xin không đọc tên trên live ("ẩn tên giúp em", "đừng đọc tên em nha"). */
function laAnTen(s) {
  const g = ` ${gon(s)} `;
  return bang().an_ten.cum.some((c) => g.includes(` ${c} `));
}

/**
 * Bình luận "ib / check ib / inbox / nt / chưa thấy tin / giá sao" (F-70): câu ngắn chỉ có ý xin nhắn lại. Trả null nếu không phải;
 * { gia: true } khi là hỏi giá chung ("giá sao") — vẫn nhắn thẻ, AI vẫn trả lời trên sóng.
 */
function laIb(s) {
  const g = gon(s);
  if (!g || g.split(' ').length > 8) return null;
  const b = bang().ib;
  const con = boDem(s);
  if (!con) return null;
  if (b.gia.includes(con)) return { gia: true };
  return b.cum.includes(con) ? { gia: false } : null;
}

/**
 * Khách xin xem trên live (F-81): mặt sau · cận vải · toàn thân · màu khác (tên màu phải có ở `mauCo` — màu của món đang nói,
 * hoặc mọi màu đang bán khi chưa biết món). Câu dễ nhầm ("xoay sở", "soi giúp em đơn") không tính.
 * @returns {{loai:'mat_sau'|'can_vai'|'toan_than'|'mau_khac', mau?:string}|null}
 */
function loaiMuonXem(s, { mauCo = [] } = {}) {
  const g = ` ${gon(s)} `;
  const b = bang().muon_xem;
  if (b.tru.some((c) => g.includes(` ${c} `))) return null;
  const mau = [...new Set(mauCo)].sort((a, c) => c.length - a.length);
  for (const c of b.moi_mau) {
    const i = g.indexOf(` ${c} `);
    if (i < 0) continue;
    const sau = g.slice(i + c.length + 2);
    const m = mau.find((x) => sau.startsWith(`${gon(x)} `));
    if (m) return { loai: 'mau_khac', mau: m };
  }
  for (const loai of ['mat_sau', 'can_vai', 'toan_than']) if (b[loai].some((c) => g.includes(` ${c} `))) return { loai };
  return null;
}

/** F-97: bình luận "hóng" (ngắn, không hỏi, không số) dưới bài đăng thường. */
function laHongLive(s) {
  const goc = String(s || '').trim();
  if (/^[.\s…]+$/.test(goc) && goc.length <= 5 && goc.length) return true;
  if (!goc || goc.includes('?') || /\d/.test(goc) || goc.length > 60) return false;
  const g = gon(s);
  if (!g || g.split(' ').length > 8) return false;
  const con = boDem(s);
  const dau = bang().hong_live?.dau || [];
  return [g, con].some((x) => x && dau.some((c) => x === c || x.startsWith(`${c} `)));
}

/** F-97: tin hỏi lịch live ("khi nào live", "tối nay mấy giờ live", "báo em khi live"). */
function laHoiLichLive(s) {
  const g = gon(s);
  if (!g || g.split(' ').length > 18) return false;
  return (bang().hoi_lich_live?.mau || []).some((m) => new RegExp(`(?:^| )${m}(?: |$)`).test(g));
}

/** F-104: xin gỡ ảnh đã cho shop dùng ("gỡ ảnh giúp em", "đừng dùng ảnh của mình nữa"). */
function laGoAnh(s) {
  const g = ` ${gon(s)} `;
  return (bang().go_anh?.cum || []).some((c) => g.includes(` ${c} `));
}

module.exports = { gon, boDem, laXinDung, laAnTen, laGoAnh, laIb, loaiMuonXem, laHongLive, laHoiLichLive, bang };
