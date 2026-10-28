// Bảng huấn luyện người dẫn (BH11, SPEC.md F-116): biểu đồ nhỏ theo phút (người xem, bình luận, chốt) vẽ bằng SVG tự viết — không
// thư viện — và dải cảnh báo (máy chủ phát ws `live.huan_luyen`, tối đa 1 cảnh báo / 2 phút). Mọi chữ qua textContent.

import { h } from '../ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (the, tt = {}) => {
  const e = document.createElementNS(NS, the);
  for (const [k, v] of Object.entries(tt)) e.setAttribute(k, String(v));
  return e;
};

/** Đường gấp khúc của một dãy số trong khung rộng × cao (dãy rỗng → ''). */
export function duongGap(so, rong, cao, max) {
  if (!so.length) return '';
  const buoc = so.length > 1 ? rong / (so.length - 1) : 0;
  return so.map((v, i) => `${(i * buoc).toFixed(1)},${(cao - (max ? (v / max) * (cao - 2) : 0) - 1).toFixed(1)}`).join(' ');
}

/**
 * Biểu đồ: đường người xem (trục riêng) + cột bình luận + chấm chốt, mỗi phút một nấc. Giữ 60 phút gần nhất.
 * @param {{phut:number, nguoi_xem:number|null, binh_luan:number, chot:number}[]} ds
 */
export function bieuDo(ds, { rong = 300, cao = 64 } = {}) {
  const gan = (ds || []).slice(-60);
  const svg = s('svg', { viewBox: `0 0 ${rong} ${cao}`, class: 'hl-bieu-do', role: 'img', 'aria-label': 'Số liệu theo phút' });
  if (!gan.length) return svg;
  const maxBl = Math.max(1, ...gan.map((x) => x.binh_luan));
  const rongCot = Math.max(2, rong / gan.length - 1);
  gan.forEach((x, i) => {
    const c = (x.binh_luan / maxBl) * (cao * 0.6);
    svg.append(s('rect', { x: (i * rong) / gan.length, y: cao - c, width: rongCot, height: c, class: 'hl-cot' }));
    if (x.chot) svg.append(s('circle', { cx: (i * rong) / gan.length + rongCot / 2, cy: cao - c - 4, r: Math.min(4, 1.5 + x.chot / 2), class: 'hl-chot' }));
  });
  const xem = gan.map((x) => x.nguoi_xem).filter((x) => x != null);
  if (xem.length) svg.append(s('polyline', { points: duongGap(xem, rong, cao, Math.max(1, ...xem)), class: 'hl-xem', fill: 'none' }));
  return svg;
}

/** Khối huấn luyện: dải cảnh báo + biểu đồ + chú giải. `khiCham(binh_luan_id)` mở chạm để trả lời (F-115). */
export function taoKhoiHuanLuyen({ khiCham = null } = {}) {
  const canh = h('div', { class: 'hl-canh', hidden: true, role: 'status' });
  const ve = h('div', { class: 'hl-ve' });
  const chu = h('div', { class: 'hl-chu muted' }, 'Số liệu theo phút sẽ hiện khi buổi live chạy.');
  const khoi = h('section', { class: 'hl' }, canh, ve, chu);
  let cuoi = null;
  const datCanh = (c) => {
    canh.replaceChildren();
    if (!c) { canh.hidden = true; return; }
    canh.hidden = false;
    canh.dataset.mau = c.muc || 'warn';
    canh.append(h('span', { class: 'grow' }, c.cau));
    if (c.binh_luan_id && khiCham) canh.append(h('button', { class: 'btn small', type: 'button', onclick: () => khiCham(c.binh_luan_id) }, 'Soạn trả lời'));
    canh.append(h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Ẩn cảnh báo', onclick: () => datCanh(null) }, '✕'));
  };
  return {
    khoi,
    /** Gói ws `live.huan_luyen` hoặc kết quả GET /huan-luyen. */
    cap(goi) {
      if (goi.canh_bao) { cuoi = goi.canh_bao; datCanh(cuoi); }
      const ds = goi.so_lieu_phut || [];
      ve.replaceChildren(bieuDo(ds));
      const m = ds.at(-1);
      if (m) chu.textContent = `Phút ${m.phut}: ${m.nguoi_xem ?? '–'} người xem · ${m.binh_luan} bình luận · ${m.chot} chốt`;
    },
    anCanh: () => datCanh(null),
    get canhBao() { return cuoi; },
  };
}
