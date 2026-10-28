// Tồn kho (SPEC.md F-52): lưới tồn theo sản phẩm (tồn trong kho, đang giữ cho đơn chưa gửi, còn bán được), nhập hàng
// nhanh (gõ số cộng thêm vào từng ô), điều chỉnh khi kiểm kê (gõ số đếm được), lịch sử ra vào, lọc sắp hết / hết hàng.
// Nhập hàng bằng lời: ô "Nói với Mai" trên cùng ("nhập thêm 10 áo 12 đen M").

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam } from '../ui.js';
import { chipSp, urlAnh } from './san-pham.js';

const LY_DO = { nhap_hang: 'Nhập hàng', dieu_chinh: 'Điều chỉnh', gui_don: 'Gửi đơn', nhan_hoan: 'Nhận hàng hoàn' };

let dangSua = false;
export function coThayDoi() { return dangSua; }

export async function ve(khung) {
  const st = { che_do: 'nhap', loc: '', ds: [], nguong: 3, nhap: {} };
  const chonCheDo = h('div', { class: 'chon', role: 'group', 'aria-label': 'Việc' });
  const chonLoc = h('div', { class: 'chon', role: 'group', 'aria-label': 'Lọc' });
  const noiDung = h('div', { class: 'cot', style: 'align-items:stretch;gap:12px' });
  const loi = h('p', { class: 'loi', role: 'alert' });
  const nutLuu = h('button', { class: 'btn primary', type: 'button' });
  khung.replaceChildren(
    h('div', { class: 'viewbar' }, h('h1', {}, 'Tồn kho'), chonCheDo, h('span', { class: 'grow' }), chonLoc),
    h('p', { class: 'hint', style: 'margin:0' }, 'Còn bán được = tồn trong kho − đang giữ cho đơn chưa gửi. Mọi thay đổi tồn đều ghi lịch sử. Nhập bằng lời: gõ vào ô "Nói với Mai" trên cùng, ví dụ "nhập thêm 10 áo 12 đen M, 5 trắng L".'),
    noiDung, loi, h('div', { class: 'nutbam dinh-duoi' }, nutLuu));

  function veNut() {
    const nut = (k, ten) => h('button', { type: 'button', 'aria-pressed': String(st.che_do === k), onclick: () => { if (dangSua && !confirm('Bỏ số đang gõ?')) return; st.che_do = k; st.nhap = {}; dangSua = false; veNut(); veLuoi(); } }, ten);
    chonCheDo.replaceChildren(nut('nhap', 'Nhập hàng'), nut('dieu_chinh', 'Điều chỉnh (kiểm kê)'), nut('lich_su', 'Lịch sử'));
    const loc = (k, ten) => h('button', { type: 'button', 'aria-pressed': String(st.loc === k), onclick: () => { st.loc = k; veLuoi(); } }, ten);
    chonLoc.replaceChildren(loc('', 'Tất cả'), loc('sap_het', 'Sắp hết'), loc('het_hang', 'Hết hàng'));
    nutLuu.textContent = st.che_do === 'nhap' ? 'Lưu nhập hàng' : 'Lưu điều chỉnh';
    nutLuu.hidden = st.che_do === 'lich_su';
  }

  async function tai() {
    const kq = await api.get('/kho');
    st.ds = kq.san_pham;
    st.nguong = kq.nguong_sap_het;
    veLuoi();
  }

  function mucCon(n) {
    if (n <= 0) return 'bad';
    if (n <= st.nguong) return 'warn';
    return 'ok';
  }

  async function veLuoi() {
    if (st.che_do === 'lich_su') {
      const { lich_su: ls } = await api.get('/kho/lich-su');
      noiDung.replaceChildren(h('section', { class: 'panel' }, ls.length ? h('table', { class: 'bang-du-lieu' },
        h('thead', {}, h('tr', {}, ['Lúc', 'Sản phẩm', 'Mã phân loại', 'Thay đổi', 'Tồn sau', 'Lý do', 'Ghi chú'].map((x) => h('th', {}, x)))),
        h('tbody', {}, ls.map((x) => h('tr', {}, h('td', {}, gioPhut(x.luc, true)), h('td', {}, `Số ${x.so} · ${x.ten}`), h('td', {}, x.sku),
          h('td', { class: `num ${x.thay_doi > 0 ? 'dat' : 'loi'}` }, x.thay_doi > 0 ? `+${x.thay_doi}` : x.thay_doi), h('td', { class: 'num' }, x.ton_sau),
          h('td', {}, LY_DO[x.ly_do] || x.ly_do), h('td', {}, x.ghi_chu))))) : h('div', { class: 'empty' }, 'Chưa có thay đổi tồn nào.')));
      return;
    }
    let ds = st.ds;
    if (st.loc === 'sap_het') ds = ds.filter((x) => x.phan_loai.some((p) => p.con_ban_duoc > 0 && p.con_ban_duoc <= st.nguong));
    if (st.loc === 'het_hang') ds = ds.filter((x) => x.phan_loai.some((p) => p.con_ban_duoc <= 0));
    if (!ds.length) {
      noiDung.replaceChildren(h('section', { class: 'panel' }, h('div', { class: 'empty' }, st.ds.length ? 'Không có sản phẩm nào khớp.' : 'Chưa có sản phẩm. Vào màn hình Sản phẩm để tạo.',
        !st.ds.length && h('a', { class: 'btn primary', href: '#/san-pham' }, 'Mở Sản phẩm'))));
      return;
    }
    noiDung.replaceChildren(...ds.map((x) => {
      const g1 = [...new Set(x.phan_loai.map((p) => p.gt1))];
      const g2 = [...new Set(x.phan_loai.map((p) => p.gt2 || ''))];
      const o = (a, b) => {
        const p = x.phan_loai.find((y) => y.gt1 === a && (y.gt2 || '') === b);
        if (!p) return h('td', { class: 'bo' }, '—');
        const e = h('input', { type: 'text', inputmode: 'numeric', class: 'nho', value: st.nhap[p.id] ?? '',
          placeholder: st.che_do === 'nhap' ? '+ số' : String(p.ton), 'aria-label': `${st.che_do === 'nhap' ? 'Nhập thêm' : 'Tồn đếm được'} ${p.sku}` });
        e.addEventListener('input', () => { st.nhap[p.id] = e.value; dangSua = Object.values(st.nhap).some((v) => v !== ''); });
        return h('td', {}, h('div', { class: 'o-pl' },
          h('span', { class: `chip ${mucCon(p.con_ban_duoc)}` }, `còn ${p.con_ban_duoc}`),
          h('span', { class: 'hint' }, `tồn ${p.ton}${p.dang_giu ? ` · giữ ${p.dang_giu}` : ''}`), e));
      };
      return h('section', { class: 'panel' },
        h('header', {}, x.anh_dai_dien ? h('img', { class: 'anh-nho', src: urlAnh(x.id, x.anh_dai_dien), alt: '' }) : null,
          h('b', {}, x.ten_day_du), chipSp(x.trang_thai), h('span', { class: 'grow' }), h('a', { class: 'btn small', href: `#/san-pham` }, 'Sửa sản phẩm')),
        h('div', { class: 'body', style: 'overflow:auto' }, h('table', { class: 'luoi-pl' },
          h('thead', {}, h('tr', {}, h('th', {}), g2.map((b) => h('th', {}, b || 'Tồn')))),
          h('tbody', {}, g1.map((a) => h('tr', {}, h('th', {}, a), g2.map((b) => o(a, b))))))));
    }));
  }

  nutLuu.addEventListener('click', async () => {
    loi.textContent = '';
    const dong = Object.entries(st.nhap).filter(([, v]) => String(v).trim() !== '');
    if (!dong.length) { loi.textContent = 'Chưa gõ số nào.'; return; }
    try {
      const than = st.che_do === 'nhap'
        ? { dong: dong.map(([id, v]) => ({ phan_loai_id: id, so: Number(v) })) }
        : { dong: dong.map(([id, v]) => ({ phan_loai_id: id, ton: Number(v) })), ghi_chu: 'kiểm kê' };
      const kq = await dangLam(nutLuu, 'Đang lưu…', () => api.post(st.che_do === 'nhap' ? '/kho/nhap' : '/kho/dieu-chinh', than));
      toast(`Đã lưu ${kq.ket_qua.length} ô: ${kq.ket_qua.map((x) => `${x.sku} → ${x.ton}`).join(', ')}`);
      st.nhap = {};
      dangSua = false;
      await tai();
    } catch (e) { loi.textContent = e.message; }
  });

  const nghe = (e) => { if (e.detail?.type === 'kho.cap_nhat' && !dangSua) tai(); };
  window.addEventListener('moza:ws', nghe);
  ve.roi = () => window.removeEventListener('moza:ws', nghe);
  veNut();
  await tai();
}

export function roi() { ve.roi?.(); dangSua = false; }
