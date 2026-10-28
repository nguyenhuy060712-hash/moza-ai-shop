// Màn hình người dẫn — thanh mảnh trên cùng (BH11, F-126; tách từ nguoi-dan.js): giờ live, đèn Facebook / OBS / AI / mạng, số xem ·
// chốt · xác nhận, chế độ + trạng thái Mai, micro, MỘT nút Dừng AI (phím cách). "Dừng mọi thứ", toàn màn hình, chép lời mời vào menu ⋯.

import { api } from '../api.js';
import { h, toast } from '../ui.js';

const dongHoChu = (tu) => {
  const giay = Math.max(0, Math.floor((Date.now() - new Date(tu)) / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${Math.floor(giay / 3600) ? `${Math.floor(giay / 3600)}:` : ''}${p(Math.floor(giay / 60) % 60)}:${p(giay % 60)}`;
};

/**
 * @param {{p:object, cheDo:Node[], mic:Node[], dungAi:() => void, moNganKeo:() => void}} o
 *   cheDo: ô chọn chế độ + chip Mai + nút dẫn tiếp + nút bật loa; mic: các phần micro (đang nói, vạch, chip, nút).
 */
export function taoThanh({ p, cheDo, mic, dungAi, moNganKeo }) {
  const eDongHo = h('span', { class: 'num nd-sk-gio' });
  const eDen = h('span', { class: 'nd-sk-den' });
  const eSo = h('span', { class: 'nd-sk-so-lieu num' });
  const nutDung = h('button', { class: 'btn nd-nut-dung', type: 'button', title: 'Phím cách: tắt tiếng Mai, xóa gợi ý, AI thôi dẫn' }, '■ Dừng AI');
  nutDung.addEventListener('click', () => dungAi());
  const eMenu = h('div', { class: 'nd-sk-menu', hidden: true, role: 'menu' },
    h('button', { class: 'btn', type: 'button', role: 'menuitem', onclick: () => { eMenu.hidden = true; moNganKeo(); } }, '☰ Ngăn kéo: lời nhắc, Hỏi Mai, Lên sóng (N)'),
    h('button', { class: 'btn', type: 'button', role: 'menuitem', onclick: () => {
      eMenu.hidden = true;
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    } }, '⛶ Toàn màn hình'),
    // F-96: lời mời + link buổi live để dán nhóm Zalo.
    h('button', { class: 'btn', type: 'button', role: 'menuitem', onclick: async () => {
      eMenu.hidden = true;
      try { const r = await api.get('/lich-live/loi-moi'); await navigator.clipboard.writeText(r.chu); toast('Đã chép lời mời + link live'); } catch (e) { toast(e.message, true); }
    } }, 'Chép lời mời + link live'),
    // "Dừng mọi thứ" dùng đúng công tắc của thanh trên (app.js) — thanh đó ẩn ở chế độ sân khấu.
    h('button', { class: 'btn nguy', type: 'button', role: 'menuitem', onclick: () => { eMenu.hidden = true; document.getElementById('khanCap')?.click(); } }, '⛔ Dừng mọi thứ / chạy lại'),
    h('a', { class: 'btn', href: '#/live', role: 'menuitem' }, 'Rời màn hình người dẫn'));
  const nutMenu = h('button', { class: 'btn small nd-sk-nut-menu', type: 'button', 'aria-label': 'Thêm', 'aria-haspopup': 'menu', onclick: () => { eMenu.hidden = !eMenu.hidden; } }, '⋯');
  const ngoai = (e) => {
    if (!el.isConnected) { document.removeEventListener('click', ngoai); return; } // đã rời màn hình
    if (!eMenu.hidden && !eMenu.contains(e.target) && e.target !== nutMenu) eMenu.hidden = true;
  };
  document.addEventListener('click', ngoai);

  const el = h('header', { class: 'nd-sk-thanh' },
    h('span', { class: 'chip bad' }, '● LIVE'), eDongHo, h('b', { class: 'nd-sk-ten-phien', title: p.ten }, p.ten),
    eDen, eSo, ...cheDo, h('span', { class: 'grow' }), ...mic, nutDung, h('span', { class: 'nd-sk-menu-boc' }, nutMenu, eMenu));

  eDongHo.textContent = dongHoChu(p.bat_dau);
  return {
    el,
    nhip() { eDongHo.textContent = dongHoChu(p.bat_dau); },
    /** @param {{fb:[string,string], obs:[string,string], ai:[string,string], mang:[string,string]}} d — [lớp màu chung ok|warn|bad|mute, chú thích] */
    veDen(d) {
      eDen.replaceChildren(...[['fb', 'Facebook'], ['obs', 'OBS'], ['ai', 'AI'], ['mang', 'Mạng']].map(([k, ten]) => {
        const [mau, chu] = d[k] || ['mute', ''];
        return h('span', { class: `nd-sk-den-o ${mau}`, title: `${ten}: ${chu}` }, h('i', { 'aria-hidden': 'true' }), ten);
      }));
    },
    /** Dòng số liệu F-85 ở thanh: xem · chốt · xác nhận. */
    veSoLieu(x) {
      if (!x) return;
      eSo.textContent = `${x.nguoi_xem ?? '–'} xem · ${x.chot ?? 0} chốt · ${x.xac_nhan ?? 0} xác nhận`;
    },
  };
}
