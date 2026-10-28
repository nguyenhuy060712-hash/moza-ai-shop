// Cài đặt → "Cần xử lý" và "AI & kênh" (GD1, F-121): gom ở đầu trang những gì đang chặn việc, và các công tắc AI rải rác về một bảng.

import { api } from '../api.js';
import { h, toast, goiY, hoi } from '../ui.js';
import { chipMau } from '../trang-thai.js';
import { usdVnd, vnd, usd } from '../dinh-dang.js';

function panel(tieuDe, moTa, muc, ...con) {
  return h('section', { class: 'panel', 'data-muc': muc },
    h('header', {}, h('h2', {}, tieuDe), moTa && h('p', {}, moTa)),
    h('div', { class: 'body' }, ...con));
}

/** Cuộn tới một khối trong Cài đặt (muc = data-muc của khối), nháy viền cho dễ thấy. */
export function toiKhoi(muc) {
  const e = document.querySelector(`[data-muc="${muc}"]`);
  if (!e) return;
  e.scrollIntoView({ behavior: 'smooth', block: 'start' });
  e.classList.add('nhay');
  setTimeout(() => e.classList.remove('nhay'), 1600);
}

/** "Cần xử lý": mỗi dòng một việc đang chặn + một nút tới đúng chỗ. Không có việc nào → không hiện khối. */
export async function veCanXuLy() {
  const { can_xu_ly: ds } = await api.get('/cai-dat/can-xu-ly');
  if (!ds.length) return null;
  return panel(`Cần xử lý (${ds.length})`, 'Những chỗ đang làm AI hoặc buổi live chưa chạy trọn vẹn. Xong mục nào, mục đó tự biến mất.', 'can-xu-ly',
    h('div', { class: 'viec' }, ds.map((x) => h('div', { class: 'viec-hang' },
      chipMau(x.muc === 'do' ? 'bad' : 'warn', x.muc === 'do' ? 'Gấp' : 'Nên làm'),
      h('span', { class: 'grow' }, x.chu),
      x.nut.den ? h('a', { class: 'btn small', href: x.nut.den }, x.nut.chu)
        : h('button', { class: 'btn small', type: 'button', onclick: () => toiKhoi(x.nut.muc_cai_dat) }, x.nut.chu)))));
}

/** "AI & kênh": mỗi việc AI một dòng (Bật / Tắt, đã dùng hôm nay), nút Dừng mọi tự động ở đầu bảng. */
export async function veAiKenh() {
  const khung = panel('AI & kênh', 'Mỗi việc AI một dòng: bật hoặc tắt ngay tại đây (cùng công tắc với Trợ lý AI → Vận hành).', 'ai-kenh');
  const than = khung.querySelector('.body');
  const ve = async () => {
    const d = await api.get('/cai-dat/ai-kenh');
    const dung = !!d.dung_ai?.bat;
    const nutDung = h('button', { class: dung ? 'btn primary' : 'btn nguy', type: 'button' }, dung ? 'Chạy AI tiếp' : 'Dừng mọi tự động');
    nutDung.addEventListener('click', async () => {
      if (!dung) {
        const ok = await hoi({ tieuDe: 'Dừng mọi tự động?', noiDung: 'AI ngừng nói, ngừng soạn và ngừng gửi. Việc chốt đơn bằng quy tắc (giữ hàng, thẻ đơn, nút bấm) vẫn chạy.', nhan: 'Dừng AI', nguyHiem: true });
        if (!ok) return;
      }
      try { await api.post('/dung-ai', { bat: !dung }); toast(dung ? 'AI chạy lại' : 'Đã dừng mọi tự động'); ve(); } catch (e) { toast(e.message, true); }
    });
    than.replaceChildren(...[
      h('div', { class: 'hang' }, nutDung,
        h('span', { class: 'muted' }, `Hôm nay AI đã dùng ${usdVnd(d.da_dung_ngay_usd)}; trần ${usd(d.tran_ngay_usd)} ${vnd(d.tran_ngay_usd)}.`,
          goiY('Đổi trần ở Trợ lý AI → Vận hành. Chạm trần thì AI tự dừng, chốt đơn bằng quy tắc vẫn chạy.')),
        h('a', { class: 'btn small', href: '#/cai-dat/tro-ly-ai/van-hanh' }, 'Đổi trần')),
      dung && h('p', { class: 'canh' }, 'AI đang dừng. Bấm "Chạy AI tiếp" để chạy lại.'),
      d.dong.map((x) => {
        const o = h('input', { type: 'checkbox', role: 'switch', checked: x.bat, 'aria-label': `${x.bat ? 'Tắt' : 'Bật'} ${x.ten}` });
        o.addEventListener('change', async () => {
          try { await api.put(`/agent/${x.id}`, { bat: o.checked }); toast(`${x.ten}: ${o.checked ? 'đã bật' : 'đã tắt'}`); ve(); } catch (e) { o.checked = !o.checked; toast(e.message, true); }
        });
        return h('div', { class: 'cot-ai-kenh' },
          h('div', {}, h('b', {}, x.ten), h('div', { class: 'muted' }, x.ghi_chu)),
          h('label', { class: 'khancap xanh' }, o, h('span', {}, x.bat ? 'Bật' : 'Tắt')),
          h('span', { class: 'muted' }, x.so_lan ? `${x.so_lan} lần hôm nay` : 'Chưa chạy hôm nay'),
          h('span', { class: 'muted' }, x.usd > 0 ? vnd(x.usd) : ''));
      }),
    ].flat().filter(Boolean));
  };
  await ve();
  return khung;
}
