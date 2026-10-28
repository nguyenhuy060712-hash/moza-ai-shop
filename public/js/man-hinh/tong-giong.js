// Tông giọng trên sóng (BH11, SPEC.md F-127): 5 thẻ chọn (Đều, rõ ràng · MC vừa · MC sôi nổi · Ấm áp, tư vấn · Tự viết ≤ 400 ký tự) + "Nghe thử"
// (máy đọc đọc câu mẫu theo tông — tốn phí nhỏ, tối đa 3 lần / phút). Dùng ở Cài đặt → Giọng Mai và bước 2 của "Bắt đầu live" — cùng
// một cài đặt. Đang live thì Mai tự đổi tông (GPT-Live thêm lời dặn, Gemini mở lại miệng chừng 1 giây). Đội AI dùng làm cách nói mặc định.

import { api } from '../api.js';
import { h, toast, dangLam } from '../ui.js';

let dangPhat = null;

export function veTongGiong({ gon = false } = {}) {
  const khung = h('div', { class: `tong-giong${gon ? ' gon' : ''}` }, h('p', { class: 'muted' }, 'Đang tải tông giọng…'));
  api.get('/giong-mai/tong').then(({ dang_chon: dc, danh_sach: ds }) => {
    let chon = dc.ma;
    const oTuViet = h('textarea', { maxlength: 400, rows: 3, placeholder: 'Ví dụ: giọng nữ miền Bắc, nhanh vừa, hay cười, gọi khách là "các chị"…', 'aria-label': 'Mô tả tông giọng tự viết' }, dc.tu_viet || '');
    const eTuViet = h('label', { class: 'field', hidden: chon !== 'tu_viet' }, h('span', {}, 'Tông tự viết (tối đa 400 ký tự)'), oTuViet);
    const the = ds.map((t) => h('button', { class: `tong-the${t.ma === chon ? ' dang' : ''}`, type: 'button', 'aria-pressed': String(t.ma === chon), onclick: () => {
      chon = t.ma;
      the.forEach((x, i) => { const dang = ds[i].ma === chon; x.classList.toggle('dang', dang); x.setAttribute('aria-pressed', String(dang)); });
      eTuViet.hidden = chon !== 'tu_viet';
      if (chon !== 'tu_viet') luu();
    } }, h('b', {}, t.ten), h('span', { class: 'muted' }, t.mo_ta)));
    const luu = async () => {
      try {
        await api.put('/giong-mai/tong', { ma: chon, tu_viet: oTuViet.value });
        toast('Đã lưu tông giọng — đang live thì Mai đổi ngay');
      } catch (e) { toast(e.message, true); }
    };
    const nutLuu = h('button', { class: 'btn small primary', type: 'button', onclick: luu }, 'Lưu tông tự viết');
    const nutNghe = h('button', { class: 'btn small', type: 'button', title: 'Máy đọc đọc một câu mẫu theo tông này — tốn phí nhỏ, tối đa 3 lần mỗi phút' }, '▶ Nghe thử');
    nutNghe.addEventListener('click', () => dangLam(nutNghe, 'Đang đọc…', async () => {
      const r = await fetch('/api/giong-mai/tong/nghe-thu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ma: chon, tu_viet: oTuViet.value }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.loi?.thong_diep || `Không nghe được (mã ${r.status}).`); }
      if (dangPhat) dangPhat.pause();
      dangPhat = new Audio(URL.createObjectURL(await r.blob()));
      await dangPhat.play();
    }).catch((e) => toast(e.message, true)));
    eTuViet.append(nutLuu);
    khung.replaceChildren(
      h('div', { class: 'tong-dau' }, h('b', {}, 'Tông giọng trên sóng'), h('span', { class: 'grow' }), nutNghe),
      h('div', { class: 'tong-luoi' }, ...the),
      eTuViet,
      !gon && h('p', { class: 'muted' }, 'Mai và Đội AI dùng chung tông này. Đang live mà đổi: Mai nói theo tông mới ngay (Gemini mở lại miệng chừng 1 giây).'));
  }).catch((e) => khung.replaceChildren(h('p', { class: 'loi' }, e.message)));
  return khung;
}
