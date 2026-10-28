// Ảnh khách mặc thật (SPEC.md F-104, tắt mặc định): duyệt ảnh khách đã đồng ý — che mặt (làm mờ phần trên ảnh, thanh kéo 0–60%)
// bằng canvas NGAY TRÊN TRÌNH DUYỆT, chọn món + size, bấm "Duyệt" thì ảnh đã che ghi đè tệp gốc. Không gửi ảnh cho AI.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam } from '../ui.js';

function taiAnh(url) {
  return new Promise((ok, loi) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => loi(new Error('Không mở được ảnh.')); i.src = url; });
}

/** Vẽ ảnh lên canvas, phần trên `pt`% làm nhòe mạnh (khảm ô vuông + mờ) — che mặt theo vùng, không nhận diện mặt. */
function veChe(canvas, img, pt) {
  const toiDa = 1600;
  const k = Math.min(1, toiDa / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k);
  const hh = Math.round(img.naturalHeight * k);
  canvas.width = w;
  canvas.height = hh;
  const c = canvas.getContext('2d');
  c.drawImage(img, 0, 0, w, hh);
  const cao = Math.round((hh * pt) / 100);
  if (!cao) return;
  const o = Math.max(12, Math.round(w / 28)); // cỡ ô khảm
  const nho = document.createElement('canvas');
  nho.width = Math.max(1, Math.round(w / o));
  nho.height = Math.max(1, Math.round(cao / o));
  nho.getContext('2d').drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * (pt / 100), 0, 0, nho.width, nho.height);
  c.save();
  c.imageSmoothingEnabled = false;
  c.filter = `blur(${Math.round(o / 2)}px)`;
  c.drawImage(nho, 0, 0, nho.width, nho.height, 0, 0, w, cao);
  c.restore();
}

export async function ve(khung) {
  const noiDung = h('div', { class: 'view' });
  khung.replaceChildren(h('div', { class: 'viewbar' }, h('h1', {}, 'Ảnh khách mặc thật'), h('span', { class: 'grow' }),
    h('a', { class: 'btn small', href: '#/cai-dat' }, 'Công tắc ở Cài đặt → Bán hàng')), noiDung);
  const tai = async () => {
    let d;
    let dsSp;
    try { [d, { san_pham: dsSp }] = await Promise.all([api.get('/anh-khach'), api.get('/san-pham?trang_thai=dang_ban')]); } catch (e) { toast(e.message, true); return; }
    const theDuyet = (a) => {
      const canvas = h('canvas', { class: 'anh-che', 'aria-label': 'Ảnh đã che mặt' });
      const keo = h('input', { type: 'range', min: 0, max: 60, step: 1, value: a.che_mat ?? d.che_mat_mac_dinh, 'aria-label': 'Phần che mặt (%)' });
      const nhanKeo = h('span', { class: 'muted' });
      const chonSp = h('select', { 'aria-label': 'Món khách mặc' }, h('option', { value: '' }, '— Chọn món —'),
        ...dsSp.map((s) => h('option', { value: s.id, selected: s.id === a.san_pham_id }, `Số ${s.so} · ${s.ten}`)));
      const chonCo = h('select', { 'aria-label': 'Size khách mặc' }, ...['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Freesize'].map((c) => h('option', { value: c, selected: (a.co || '') === c }, c || '— Size —')));
      let img = null;
      const veLai = () => { nhanKeo.textContent = `Che ${keo.value}% phía trên ảnh`; if (img) veChe(canvas, img, Number(keo.value)); };
      keo.addEventListener('input', veLai);
      taiAnh(a.url).then((i) => { img = i; veLai(); }).catch((e) => toast(e.message, true));
      const nutDuyet = h('button', { class: 'btn primary small', type: 'button' }, 'Duyệt (ảnh người lớn, đã che mặt)');
      nutDuyet.addEventListener('click', async () => {
        if (!chonSp.value) { toast('Chọn món khách đang mặc trước khi duyệt.', true); return; }
        try {
          await dangLam(nutDuyet, 'Đang lưu…', async () => {
            const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.86));
            const qs = new URLSearchParams({ che_mat: keo.value, san_pham_id: chonSp.value, co: chonCo.value });
            const r = await fetch(`/api/anh-khach/${a.id}/duyet?${qs}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.loi?.thong_diep || 'Chưa duyệt được.');
          });
          toast('Đã duyệt — ảnh đã che thay ảnh gốc');
          tai();
        } catch (e) { toast(e.message, true); }
      });
      return h('div', { class: 'the-anh-khach' }, canvas,
        h('div', { class: 'cot' },
          h('label', { class: 'field' }, h('span', {}, 'Che mặt'), keo, nhanKeo),
          h('p', { class: 'hint' }, 'Kéo tới khi không còn thấy mặt. Còn lộ mặt, ảnh có trẻ em hoặc người khác trong ảnh thì đừng duyệt — bấm "Gỡ".'),
          h('div', { class: 'hang' }, chonSp, chonCo),
          h('p', { class: 'hint' }, `Khách đồng ý lúc ${gioPhut(a.dong_y_luc)} · câu xin phép: “${a.cau_xin_phep}”`),
          h('div', { class: 'nutbam' }, nutDuyet, h('button', { class: 'btn small', type: 'button', onclick: () => go(a) }, 'Gỡ'))));
    };
    const go = async (a) => {
      if (!confirm('Gỡ ảnh này? Tệp bị xóa, không lấy lại được.')) return;
      try { await api.del(`/anh-khach/${a.id}`); toast('Đã gỡ ảnh'); tai(); } catch (e) { toast(e.message, true); }
    };
    noiDung.replaceChildren(
      d.bat ? '' : h('p', { class: 'hint canh-bao' }, 'Công tắc "Dùng ảnh khách mặc thật" đang TẮT: MOZA không xin phép, không lưu ảnh mới, Màn hình sản phẩm không chiếu. Chỉ bật sau khi luật sư duyệt câu xin phép.'),
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, `Chờ duyệt (${d.cho_duyet.length})`)),
        h('div', { class: 'body' }, d.cho_duyet.length ? d.cho_duyet.map(theDuyet) : h('div', { class: 'empty' }, 'Chưa có ảnh nào chờ duyệt.'))),
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, `Đang dùng (${d.da_duyet.length})`), h('p', {}, 'Mỗi món chiếu tối đa 4 ảnh mới nhất.')),
        h('div', { class: 'body luoi-anh-khach' }, d.da_duyet.length ? d.da_duyet.map((a) => h('figure', {}, h('img', { src: a.url, alt: `Khách mặc số ${a.so}` }),
          h('figcaption', {}, `Số ${a.so ?? '?'} · ${a.co ? `size ${a.co}` : 'chưa ghi size'}${a.dien_tap ? ' · diễn tập' : ''}`),
          h('button', { class: 'btn small', type: 'button', onclick: () => go(a) }, 'Gỡ'))) : h('div', { class: 'empty' }, 'Chưa dùng ảnh khách nào.'))));
  };
  await tai();
}
