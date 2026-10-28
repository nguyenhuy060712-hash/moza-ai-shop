// Ô "Nói với Mai" (SPEC.md F-62, #76): ở thanh trên cùng mọi màn hình (trừ Màn hình người dẫn). Gõ, hoặc bấm 🎙 nói.
// Trả lời hiện trong khung trượt bên phải; việc có ảnh hưởng (nhập kho, điều chỉnh, đổi trạng thái) có bảng xem trước và
// nút "Làm" / "Bỏ" — chỉ khi bấm "Làm" mới ghi.
// Nói bằng giọng: dùng bộ nhận giọng có sẵn của trình duyệt (Chrome, Edge — tiếng Việt), không tốn tiền, không cần máy
// chủ; trình duyệt không có thì nút 🎙 ẩn (quyết định ghi ở SPEC.md mục 12, BH1).

import { veBangCuMoi } from './so-sanh.js';
import { api } from './api.js';
import { h, toast, dangLam } from './ui.js';

const MAN_HINH = { san_pham: '#/san-pham', kho: '#/kho', don: '#/don', khach: '#/khach', bao_cao: '#/bao-cao' };

export function gan({ o, khung }) {
  const oCau = h('input', { type: 'text', placeholder: 'Nói với Mai: "nhập thêm 10 áo 12 đen M"…', 'aria-label': 'Nói với Mai', maxlength: 1000 });
  const nutGui = h('button', { class: 'btn small primary', type: 'button' }, 'Gửi');
  const Nhan = window.SpeechRecognition || window.webkitSpeechRecognition;
  const nutMic = Nhan ? h('button', { class: 'btn small', type: 'button', title: 'Bấm rồi nói' }, '🎙') : null;
  o.replaceChildren(oCau, nutMic, nutGui);
  // F-95: Tổng quan bấm "Điền bằng lời" → điền sẵn câu gợi ý cho mục thiếu đầu tiên.
  window.addEventListener('moza:goi-y-noi', (e) => { oCau.value = e.detail?.cau || ''; oCau.focus(); oCau.select(); });

  const dong = h('div', { class: 'nvm-dong' });
  khung.replaceChildren(h('header', {}, h('b', {}, 'Nói với Mai'), h('span', { class: 'grow' }),
    h('button', { class: 'btn small', type: 'button', onclick: () => { khung.hidden = true; } }, 'Đóng')), dong);

  function them(...con) {
    dong.append(h('div', { class: 'nvm-muc' }, ...con));
    dong.scrollTop = dong.scrollHeight;
    khung.hidden = false;
  }

  function veViec(v) {
    const kq = h('p', { class: 'hint' });
    const nutLam = h('button', { class: 'btn small primary', type: 'button' }, 'Làm');
    const nutBo = h('button', { class: 'btn small', type: 'button' }, 'Bỏ');
    const xong = (chu, lop) => { nutLam.remove(); nutBo.remove(); kq.className = lop; kq.textContent = chu; };
    nutLam.addEventListener('click', async () => {
      try {
        const r = await dangLam(nutLam, 'Đang làm…', () => api.post(`/noi-voi-mai/${v.id}/lam`));
        xong(`Đã làm: ${(r.ket_qua?.ket_qua?.da_lam || []).join('; ') || 'xong'}`, 'dat');
        window.dispatchEvent(new CustomEvent('moza:ws', { detail: { type: 'kho.cap_nhat' } }));
      } catch (e) { xong(e.message, 'loi'); }
    });
    nutBo.addEventListener('click', async () => {
      try { await api.post(`/noi-voi-mai/${v.id}/bo`); xong('Đã bỏ, không ghi gì.', 'hint'); } catch (e) { toast(e.message, true); }
    });
    return h('div', { class: 'nvm-viec' }, veBangCuMoi(v.xem_truoc), h('div', { class: 'nutbam' }, nutLam, nutBo), kq);
  }

  async function gui() {
    const cau = oCau.value.trim();
    if (!cau) return;
    oCau.value = '';
    them(h('p', { class: 'nvm-toi' }, cau));
    const cho = h('p', { class: 'hint' }, 'Mai đang làm…');
    them(cho);
    try {
      const kq = await dangLam(nutGui, '…', () => api.post('/noi-voi-mai', { cau }));
      cho.replaceWith(h('div', {},
        h('p', { class: 'nvm-mai' }, kq.tra_loi),
        ...kq.viec.map(veViec),
        kq.man_hinh && MAN_HINH[kq.man_hinh] && h('a', { class: 'btn small', href: MAN_HINH[kq.man_hinh] }, 'Mở màn hình liên quan')));
    } catch (e) { cho.replaceWith(h('p', { class: 'loi' }, e.message)); }
  }

  nutGui.addEventListener('click', gui);
  oCau.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); gui(); } });

  if (nutMic) {
    let nhan = null;
    nutMic.addEventListener('click', () => {
      if (nhan) { nhan.stop(); return; }
      nhan = new Nhan();
      nhan.lang = 'vi-VN';
      nhan.interimResults = true;
      nutMic.textContent = '⏺';
      nhan.onresult = (e) => { oCau.value = [...e.results].map((r) => r[0].transcript).join(' '); };
      nhan.onerror = (e) => toast(`Không nghe được: ${e.error}`, true);
      nhan.onend = () => { nhan = null; nutMic.textContent = '🎙'; if (oCau.value.trim()) gui(); };
      nhan.start();
    });
  }
}
