// Các khối của trang Hôm nay (GD1, F-120): thẻ buổi live kế tiếp, Đội AI như nhân viên, chỉ số AI 7 ngày bằng lời thường.

import { api } from '../api.js';
import { h, trangTrong } from '../ui.js';
import { usdVnd as usd } from '../dinh-dang.js';
import { chipMau, chipTrangThai } from '../trang-thai.js';

/** Thẻ buổi live kế tiếp + Bắt đầu live / Tập trước + một dòng sẵn sàng. */
export async function veTheLive() {
  let ll = null;
  let ss = null;
  try { ll = await api.get('/lich-live'); } catch { /* chưa có lịch */ }
  try { ss = await api.get('/live/san-sang'); } catch { /* bỏ qua */ }
  const ke = ll?.buoi_ke;
  const dongSan = ss
    ? (ss.do.length ? chipMau('bad', `${ss.do.length} việc đỏ trước khi lên sóng`)
      : ss.vang.length ? chipMau('warn', `${ss.vang.length} việc nên làm trước khi lên sóng`) : chipMau('ok', 'Sẵn sàng lên sóng'))
    : null;
  return h('section', { class: 'the-live' },
    h('div', { class: 'grow' },
      h('h2', {}, ke ? `Buổi live ${ke.chu}` : 'Chưa đặt lịch live'),
      h('p', { class: 'muted', style: 'margin:4px 0 0' }, ke ? 'Bắt đầu lúc nào cũng được — lịch chỉ để Mai báo khách.' : 'Đặt giờ ở Cài đặt để Mai báo khách khi nào shop live.'),
      dongSan && h('div', { style: 'margin-top:8px' }, dongSan)),
    h('div', { class: 'nutbam' },
      h('a', { class: 'btn primary', href: '#/live' }, 'Bắt đầu live'),
      h('a', { class: 'btn', href: '#/live/dien-tap' }, 'Tập trước'),
      !ke && h('a', { class: 'btn', href: '#/cai-dat' }, 'Đặt lịch')));
}

/** Đội AI như nhân viên: mỗi việc AI một ô — tên dễ hiểu, trạng thái, số việc hôm nay. */
export async function veDoiHinh() {
  let d;
  try { d = (await api.get('/agent/doi-hinh')).doi_hinh; } catch { return null; }
  return h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Đội AI của bạn'), h('p', {}, 'Mỗi việc AI như một nhân viên: đang chờ việc, đang làm hay đã tắt. Bật / tắt ở Cài đặt → AI & kênh.')),
    h('div', { class: 'body' }, h('div', { class: 'doi-hinh' }, d.map((x) => h('div', {},
      h('b', {}, x.ten), h('span', {}, chipTrangThai('doi_ai', x.trang_thai)),
      h('span', { class: 'muted' }, x.so_viec_hom_nay ? `${x.so_viec_hom_nay} việc hôm nay` : 'Chưa có việc hôm nay'))))));
}

/** Chỉ số AI 7 ngày bằng lời thường. */
export async function veChiSo() {
  let c;
  try { c = await api.get('/agent/chi-so?ngay=7'); } catch { return null; }
  const chan = c.cau_bi_chan;
  const lyDo = [chan.so_khong_co_trong_nguon && `${chan.so_khong_co_trong_nguon} vì con số không có trong nguồn`,
    chan.luat_an_toan && `${chan.luat_an_toan} vì luật an toàn`, chan.khac && `${chan.khac} lý do khác`].filter(Boolean);
  return h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'AI 7 ngày qua')),
    h('div', { class: 'body' }, c.luot_chay || chan.tong
      ? h('p', { style: 'margin:0;line-height:1.8' },
        `Xử lý xong ${c.xong} việc · chuyển cho bạn ${c.chuyen_cho_ban} · ${chan.tong} câu bị chặn${lyDo.length ? ` (${lyDo.join(', ')})` : ''} · lỗi ${String(c.ty_le_loi).replace('.', ',')}% · chi phí ${usd(c.chi_phi_usd)}`)
      : trangTrong('7 ngày qua AI chưa làm việc nào. Bắt đầu live hoặc nhắn Mai để thấy số ở đây.', { href: '#/live', chu: 'Bắt đầu live' })));
}
