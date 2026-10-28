// Sổ tay shop (SPEC.md F-05): những điều chung không thuộc sản phẩm nào (giao hàng, thanh toán, đổi trả, cách chọn size).
// Chỉ người dùng sửa; mỗi lần lưu là một bản sửa mới, bản cũ vẫn xem lại được.

import { veSoSanh } from '../so-sanh.js';
import { api } from '../api.js';
import { h, toast, gioPhut, dangLam } from '../ui.js';

let st = null;

export function coThayDoi() {
  if (!st?.form) return false;
  return st.form.tieu_de !== st.goc.tieu_de || st.form.noi_dung !== st.goc.noi_dung;
}

export async function ve(khung) {
  st = { ds: [], chon: null, muc: null, form: null, goc: null, banSua: [] };
  const danhSach = h('div', { class: 'ds' });
  const phai = h('section', { class: 'panel' });
  // F-90: dòng phí ship / miễn ship tự sinh từ Cài đặt (chỉ đọc) + nút chép câu cho phần Giới thiệu của Page.
  const tuSinh = h('div', { class: 'hint', hidden: true });

  khung.replaceChildren(
    h('div', { class: 'viewbar' },
      h('h1', {}, 'Sổ tay shop'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn primary', type: 'button', onclick: () => chonMuc('moi') }, '+ Thêm mục')),
    h('p', { class: 'hint' }, 'Giới thiệu shop, cách chọn size (lời khuyên chung), giao hàng, thanh toán (số tài khoản), đổi trả, câu hỏi thường gặp… '
      + 'AI trích từ đây được như trích từ thẻ sản phẩm. Phí ship ghi ở Cài đặt → Bán hàng, không ghi ở đây. Mục nào còn trống thì AI coi như chưa có thông tin.'),
    tuSinh,
    h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, danhSach), phai),
  );

  async function taiDanhSach() {
    const kq = await api.get('/so-tay');
    st.ds = kq.so_tay;
    veDanhSach();
    if (kq.tu_sinh) {
      const chep = h('button', { class: 'btn small', type: 'button' }, 'Chép câu cho phần Giới thiệu Page');
      chep.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(kq.tu_sinh.cau_gioi_thieu); toast('Đã chép. Dán vào Giới thiệu của Page trên Facebook.'); } catch { prompt('Chép câu này:', kq.tu_sinh.cau_gioi_thieu); }
      });
      tuSinh.replaceChildren(h('span', { class: 'chip info' }, kq.tu_sinh.tieu_de), ' ', kq.tu_sinh.chu, ' ', h('a', { href: '#/cai-dat' }, 'Sửa ở Cài đặt'), ' ', chep);
      tuSinh.hidden = false;
    } else tuSinh.hidden = true;
  }

  function veDanhSach() {
    danhSach.replaceChildren(...st.ds.map((m) => h('button', {
      type: 'button', 'aria-current': String(st.chon === m.id), onclick: () => chonMuc(m.id),
    },
    h('span', { class: 'dong1' }, h('b', {}, m.tieu_de), !m.noi_dung.trim() && h('span', { class: 'chip warn' }, 'Trống')),
    h('span', { class: 'dong2' }, m.noi_dung.trim() ? m.noi_dung.slice(0, 120) : 'Chưa có nội dung'),
    h('span', { class: 'dong3' }, `Bản ${m.phien_ban} · sửa ${gioPhut(m.sua_luc)}`))));
  }

  async function chonMuc(id) {
    if (coThayDoi() && !confirm('Mục đang sửa dở chưa lưu. Bỏ phần đang sửa?')) return;
    st.chon = id;
    if (id === 'moi') {
      st.goc = { tieu_de: '', noi_dung: '' };
      st.muc = null;
      st.banSua = [];
    } else {
      st.muc = st.ds.find((m) => m.id === id);
      st.goc = { tieu_de: st.muc.tieu_de, noi_dung: st.muc.noi_dung };
      st.banSua = (await api.get(`/so-tay/${id}/ban-sua`)).ban_sua;
    }
    st.form = { ...st.goc };
    veDanhSach();
    vePhai();
  }

  function vePhai() {
    if (!st.form) {
      phai.replaceChildren(h('div', { class: 'empty' }, 'Chọn một mục bên trái để điền hoặc sửa.'));
      return;
    }
    const moi = st.chon === 'moi';
    const loi = h('p', { class: 'loi', role: 'alert' });
    const oTieuDe = h('input', { type: 'text', value: st.form.tieu_de, maxlength: 120, required: true });
    const oNoiDung = h('textarea', { class: 'lon', maxlength: 20000, placeholder: 'Viết như đang dặn một nhân viên mới…' });
    oNoiDung.value = st.form.noi_dung;
    oTieuDe.addEventListener('input', () => { st.form.tieu_de = oTieuDe.value; });
    oNoiDung.addEventListener('input', () => { st.form.noi_dung = oNoiDung.value; });

    const nutLuu = h('button', { class: 'btn primary', type: 'submit' }, moi ? 'Thêm mục' : 'Lưu');
    const form = h('form', { class: 'body' },
      h('label', { class: 'field' }, h('span', {}, 'Tiêu đề'), oTieuDe),
      h('label', { class: 'field' }, h('span', {}, 'Nội dung'), oNoiDung),
      loi,
      h('div', { class: 'nutbam' }, nutLuu,
        h('button', { class: 'btn', type: 'button', onclick: () => { st.form = { ...st.goc }; vePhai(); } }, 'Hủy thay đổi')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      loi.textContent = '';
      try {
        const { muc } = await dangLam(nutLuu, 'Đang lưu…', () => (moi ? api.post('/so-tay', st.form) : api.put(`/so-tay/${st.chon}`, st.form)));
        st.goc = { ...st.form };
        toast(`Đã lưu "${muc.tieu_de}" (bản ${muc.phien_ban})`);
        await taiDanhSach();
        await chonMuc(muc.id);
      } catch (loiGoi) {
        loi.textContent = loiGoi.message;
      }
    });
    form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); form.requestSubmit(); }
    });

    phai.replaceChildren(
      h('header', {}, h('h2', {}, moi ? 'Mục mới' : st.muc.tieu_de),
        !moi && h('p', {}, `Bản ${st.muc.phien_ban} · sửa lần cuối ${gioPhut(st.muc.sua_luc, true)}`)),
      form,
      !moi && h('div', { class: 'body' },
        h('h2', {}, `Lịch sử bản sửa (${st.banSua.length})`),
        h('div', { class: 'lichsu' }, st.banSua.map((b) => h('details', {},
          h('summary', {}, h('b', {}, `Bản ${b.phien_ban}`), h('span', {}, gioPhut(b.luc, true)), h('span', {}, b.tieu_de)),
          // F-125: xem một bản = so với bản trước (bản đầu so với trống); nguyên văn ở dưới.
          veSoSanh(st.banSua.find((x) => x.phien_ban === b.phien_ban - 1)?.noi_dung ?? '', b.noi_dung || ''),
          h('details', {}, h('summary', { class: 'hint' }, 'Nguyên văn bản này'), h('pre', {}, b.noi_dung || '(trống)')))))),
    );
    (moi ? oTieuDe : oNoiDung).focus();
  }

  await taiDanhSach();
  vePhai();
}
