// Đồ dùng chung cho giao diện.
//
// Mọi chữ đều đưa vào trang bằng textContent, không bao giờ bằng innerHTML: tên sản phẩm, nội dung
// Sổ tay, bình luận, tin nhắn Facebook là dữ liệu người khác gõ (SPEC.md mục 9).

/**
 * Tạo phần tử: h('button', { class: 'btn', onclick }, 'Lưu').
 * Con là chuỗi thì thành chữ thuần; null/false bị bỏ qua.
 */
export function h(the, thuocTinh = {}, ...con) {
  const e = document.createElement(the);
  for (const [k, v] of Object.entries(thuocTinh || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'value') e.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') e[k] = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of con.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function toast(chu, loi = false) {
  const t = document.getElementById('toast');
  t.textContent = chu;
  t.classList.toggle('loi', loi);
  t.hidden = false;
  clearTimeout(toast._hen);
  toast._hen = setTimeout(() => { t.hidden = true; }, loi ? 5000 : 2600);
}

export { gioPhut } from './dinh-dang.js';

/** Nút đang chạy việc: khóa lại và đổi chữ cho tới khi xong. */
export async function dangLam(nut, chuTrongLuc, viec) {
  const cu = nut.textContent;
  nut.disabled = true;
  nut.textContent = chuTrongLuc;
  try {
    return await viec();
  } finally {
    nut.disabled = false;
    nut.textContent = cu;
  }
}

/** Các đoạn của địa chỉ trang (không tính phần ?…), ví dụ "#/cai-dat/tro-ly-ai/skill/x" → ['cai-dat','tro-ly-ai','skill','x']. */
export function phanDuong() {
  return location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
}

/** Các đoạn sau tiền tố của một màn hình con (ví dụ sau 'cai-dat/tro-ly-ai'). */
export function duongCon(tienTo) {
  const d = phanDuong();
  const t = tienTo.split('/');
  return t.every((x, i) => d[i] === x) ? d.slice(t.length) : [];
}

/** Biểu tượng ⓘ: rê chuột hoặc bấm để đọc ghi chú dài (thay cho đoạn chữ dài và mã kỹ thuật dưới ô). */
export function goiY(chu) {
  const nut = h('button', { class: 'goi-y', type: 'button', 'aria-label': 'Xem ghi chú', title: chu }, 'ⓘ');
  const bong = h('span', { class: 'goi-y-bong', role: 'note', hidden: true }, chu);
  nut.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); bong.hidden = !bong.hidden; });
  nut.addEventListener('blur', () => { bong.hidden = true; });
  return h('span', { class: 'goi-y-khung' }, nut, bong);
}

/**
 * Hộp hỏi lại trong khung trang (thay confirm / prompt): trả về Promise —
 * `false` nếu bỏ qua, hoặc `{ ly_do }` khi đồng ý (ly_do có khi `coLyDo`; bắt buộc nếu `batBuocLyDo`).
 */
export function hoi({ tieuDe, noiDung = '', nhan = 'Đồng ý', nguyHiem = false, coLyDo = false, batBuocLyDo = false, nhanLyDo = 'Lý do', macDinh = '' }) {
  return new Promise((xong) => {
    const o = coLyDo ? h('input', { type: 'text', value: macDinh, maxlength: 200, 'aria-label': nhanLyDo, placeholder: nhanLyDo }) : null;
    const loi = h('p', { class: 'loi', hidden: true });
    const nutDong = h('button', { class: 'btn', type: 'button' }, 'Thôi');
    const nutDongY = h('button', { class: `btn ${nguyHiem ? 'nguy' : 'primary'}`, type: 'button' }, nhan);
    const lop = h('div', { class: 'hop-hoi-lop', role: 'dialog', 'aria-modal': 'true', 'aria-label': tieuDe },
      h('div', { class: 'hop-hoi' }, h('h2', {}, tieuDe), noiDung && h('p', { class: 'muted' }, noiDung), o, loi,
        h('div', { class: 'nutbam' }, nutDongY, nutDong)));
    const dong = (kq) => { lop.remove(); document.removeEventListener('keydown', phim, true); xong(kq); };
    const phim = (e) => { if (e.key === 'Escape') { e.stopPropagation(); dong(false); } };
    nutDong.addEventListener('click', () => dong(false));
    lop.addEventListener('click', (e) => { if (e.target === lop) dong(false); });
    nutDongY.addEventListener('click', () => {
      const lyDo = o ? o.value.trim() : '';
      if (batBuocLyDo && !lyDo) { loi.textContent = `Gõ ${nhanLyDo.toLowerCase()} trước.`; loi.hidden = false; o.focus(); return; }
      dong({ ly_do: lyDo });
    });
    document.addEventListener('keydown', phim, true);
    document.body.append(lop);
    (o || nutDongY).focus();
  });
}

/** Câu mời + một nút cho trang trống. */
export function trangTrong(cau, nut = null) {
  return h('div', { class: 'empty' }, h('span', {}, cau), nut && (nut.href ? h('a', { class: 'btn primary', href: nut.href }, nut.chu)
    : h('button', { class: 'btn primary', type: 'button', onclick: nut.bam }, nut.chu)));
}
