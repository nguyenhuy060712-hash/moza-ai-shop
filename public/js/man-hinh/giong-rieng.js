// Giọng riêng của Mai trên sóng (BH11, SPEC.md F-114): gõ mô tả → OpenAI tạo giọng (miễn phí) → nghe thử (phiên GPT-Live ngắn, tốn
// ~0,01 USD, hỏi trước) → bật công tắc. TẮT mặc định: chủ dự án nghe thử tiếng Việt rồi mới bật. Chỉ miệng GPT-Live dùng giọng này;
// Đội AI vẫn dùng giọng có sẵn.

import { api } from '../api.js';
import { h, toast, dangLam, hoi } from '../ui.js';

let dangPhat = null;

export function veGiongRieng() {
  const khung = h('div', { class: 'giong-rieng' }, h('p', { class: 'muted' }, 'Đang tải giọng riêng…'));
  const ve = (st) => {
    const oMoTa = h('textarea', { rows: 3, maxlength: st.mo_ta_toi_da, placeholder: 'Ví dụ: giọng nữ miền Bắc, khoảng 25 tuổi, ấm, nói nhanh vừa, hay cười, rõ chữ khi đọc giá.', 'aria-label': 'Mô tả giọng riêng của Mai' });
    const nutTao = h('button', { class: 'btn small primary', type: 'button' }, 'Tạo giọng (miễn phí)');
    nutTao.addEventListener('click', async () => {
      try { ve(await dangLam(nutTao, 'Đang tạo…', () => api.post('/giong-mai/rieng', { mo_ta: oMoTa.value }))); toast('Đã tạo giọng — nghe thử rồi mới bật'); } catch (e) { toast(e.message, true); }
    });
    const ngheThu = async (nut, id) => {
      const ok = await hoi({ tieuDe: 'Nghe thử giọng riêng?', noiDung: 'MOZA mở một phiên GPT-Live ngắn để Mai đọc một câu bằng giọng này — tốn khoảng 0,01 USD (dưới 300 đồng).', nhan: 'Nghe thử' });
      if (!ok) return;
      await dangLam(nut, 'Đang đọc…', async () => {
        const r = await fetch('/api/giong-mai/rieng/nghe-thu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, dong_y: true }) });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.loi?.thong_diep || `Không nghe được (mã ${r.status}).`); }
        if (dangPhat) dangPhat.pause();
        dangPhat = new Audio(URL.createObjectURL(await r.blob()));
        await dangPhat.play();
      }).catch((e) => toast(e.message, true));
    };
    const ds = st.ds.map((g) => {
      const dang = g.id === st.dang_dung;
      const nutNghe = h('button', { class: 'btn small', type: 'button' }, '▶ Nghe thử');
      nutNghe.addEventListener('click', () => ngheThu(nutNghe, g.id));
      return h('div', { class: 'ds-hang' },
        h('span', { class: 'dong1' }, h('b', { class: 'grow' }, g.ten), dang && h('span', { class: 'chip ok' }, 'Đang chọn')),
        h('span', { class: 'dong2 xuong-dong' }, g.mo_ta),
        h('span', { class: 'nutbam' }, nutNghe,
          !dang && h('button', { class: 'btn small', type: 'button', onclick: async () => { try { ve(await api.put('/giong-mai/rieng/dang-dung', { id: g.id })); } catch (e) { toast(e.message, true); } } }, 'Chọn'),
          h('button', { class: 'btn small', type: 'button', onclick: async () => {
            if (!await hoi({ tieuDe: `Xóa giọng "${g.ten}"?`, noiDung: 'Giọng bị xóa cả ở OpenAI, không lấy lại được.', nhan: 'Xóa', nguyHiem: true })) return;
            try { ve(await api.del(`/giong-mai/rieng/${encodeURIComponent(g.id)}`)); } catch (e) { toast(e.message, true); }
          } }, 'Xóa')));
    });
    const oBat = h('input', { type: 'checkbox', role: 'switch', checked: st.bat, disabled: !st.dang_dung });
    oBat.addEventListener('change', async () => {
      try { ve(await api.put('/giong-mai/rieng/bat', { bat: oBat.checked })); toast(oBat.checked ? 'Mai trên sóng dùng giọng riêng từ lần mở miệng sau' : 'Mai về giọng có sẵn'); } catch (e) { oBat.checked = !oBat.checked; toast(e.message, true); }
    });
    khung.replaceChildren(
      h('div', { class: 'tong-dau' }, h('b', {}, 'Giọng riêng của Mai trên sóng (thử nghiệm)'), h('span', { class: 'grow' }),
        h('label', { class: 'chon-o' }, oBat, ' Dùng giọng riêng')),
      h('p', { class: 'muted' }, 'Chỉ cho Mai nói bằng GPT Live 1. OpenAI chưa ghi tiếng Việt trong danh sách giọng: nghe thử trước, thấy tự nhiên mới bật.'),
      h('label', { class: 'field' }, h('span', {}, `Mô tả giọng (tối đa ${st.mo_ta_toi_da.toLocaleString('vi-VN')} ký tự)`), oMoTa),
      h('div', { class: 'nutbam' }, nutTao),
      ...(ds.length ? ds : [h('p', { class: 'muted' }, 'Chưa có giọng riêng nào.')]));
  };
  api.get('/giong-mai/rieng').then(ve).catch((e) => khung.replaceChildren(h('p', { class: 'loi' }, e.message)));
  return khung;
}
