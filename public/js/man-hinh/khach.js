// Khách hàng (SPEC.md F-54): tìm theo tên, số điện thoại; chi tiết: thông tin, đơn, hội thoại, việc, bộ nhớ. Sửa, gộp hai hồ
// sơ, xóa dữ liệu theo yêu cầu. Nhập tối thiểu: tên, số điện thoại, địa chỉ giao, ghi chú.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam, trangTrong } from '../ui.js';
import { veHoSo } from './hop-thu.js';

const TEN_KENH = { messenger: 'Messenger', binh_luan: 'Bình luận bài đăng', binh_luan_live: 'Bình luận live' };

export async function ve(khung) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const st = { q: '', dienTap: false, chon: q.get('id') || null, ds: [] };
  const oTim = h('input', { type: 'search', placeholder: 'Tìm tên, số điện thoại', 'aria-label': 'Tìm khách' });
  const oDienTap = h('input', { type: 'checkbox' });
  const trai = h('div', { class: 'ds' });
  const phai = h('section', { class: 'panel' });
  khung.replaceChildren(
    h('div', { class: 'viewbar' }, h('h1', {}, 'Khách hàng'), h('span', { class: 'grow' }),
      h('label', { class: 'hint', style: 'display:flex;gap:6px;align-items:center;margin:0' }, oDienTap, 'Khách diễn tập'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { st.chon = 'moi'; veChiTiet(); } }, '+ Tạo khách')),
    h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, h('header', {}, oTim), trai), phai));

  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { st.q = oTim.value; taiDs(); }, 200); });
  oDienTap.addEventListener('change', () => { st.dienTap = oDienTap.checked; taiDs(); });

  async function taiDs() {
    const p = new URLSearchParams({ q: st.q, dien_tap: st.dienTap ? '1' : '0' });
    st.ds = (await api.get(`/khach?${p}`)).khach;
    trai.replaceChildren(...(st.ds.length ? st.ds.map((u) => h('button', {
      type: 'button', 'aria-current': String(st.chon === u.id), onclick: () => { st.chon = u.id; taiDs(); veChiTiet(); },
    },
    h('span', { class: 'dong1' }, h('b', {}, u.ten || '(chưa có tên)'), u.sdt_hien && h('span', { class: 'muted' }, u.sdt_hien),
      u.so_hoan > 0 && h('span', { class: 'chip bad' }, `Từng hoàn ${u.so_hoan}`)),
    h('span', { class: 'dong2' }, u.dia_chi || 'Chưa có địa chỉ'),
    h('span', { class: 'dong3' }, `${u.so_don} đơn · tạo ${gioPhut(u.tao_luc)} · ${u.tao_boi === 'ai' ? 'AI tạo' : 'người tạo'}`))) : [trangTrong('Chưa có khách nào. AI tự tạo hồ sơ khi khách cho số điện thoại lúc lên đơn.', { href: '#/live', chu: 'Bắt đầu live' })]));
  }

  async function veChiTiet() {
    if (!st.chon) { phai.replaceChildren(h('div', { class: 'empty' }, 'Chọn một khách bên trái.')); return; }
    if (st.chon === 'moi') return veTao();
    let ct;
    try { ct = await api.get(`/khach/${st.chon}`); } catch (e) { phai.replaceChildren(h('div', { class: 'empty' }, e.message)); return; }
    const u = ct.khach;
    const oTen = h('input', { type: 'text', value: u.ten, maxlength: 100 });
    const oSdt = h('input', { type: 'tel', value: u.sdt_hien });
    const oDc = h('input', { type: 'text', value: u.dia_chi, maxlength: 300 });
    const oGc = h('textarea', { rows: 2, maxlength: 2000 });
    oGc.value = u.ghi_chu;
    const nutLuu = h('button', { class: 'btn small primary', type: 'button' }, 'Lưu');
    nutLuu.addEventListener('click', async () => {
      try { await dangLam(nutLuu, 'Đang lưu…', () => api.put(`/khach/${u.id}`, { ten: oTen.value, sdt: oSdt.value, dia_chi: oDc.value, ghi_chu: oGc.value })); toast('Đã lưu. AI sẽ không ghi đè hồ sơ này trong 24 giờ.'); veChiTiet(); taiDs(); } catch (e) { toast(e.message, true); }
    });
    const oGop = h('select', {}, h('option', { value: '' }, 'Chọn hồ sơ trùng để gộp vào hồ sơ này…'),
      st.ds.filter((x) => x.id !== u.id).map((x) => h('option', { value: x.id }, `${x.ten || '(chưa tên)'} ${x.sdt_hien || ''}`)));
    const nutGop = h('button', { class: 'btn small', type: 'button' }, 'Gộp');
    nutGop.addEventListener('click', async () => {
      if (!oGop.value || !confirm('Gộp hồ sơ đã chọn vào hồ sơ này? Lịch sử, đơn của cả hai được giữ.')) return;
      try { await api.post(`/khach/${u.id}/gop`, { bo_id: oGop.value }); toast('Đã gộp'); veChiTiet(); taiDs(); } catch (e) { toast(e.message, true); }
    });
    const nutXoa = h('button', { class: 'btn small danger', type: 'button' }, 'Xóa dữ liệu người này');
    nutXoa.addEventListener('click', async () => {
      if (!confirm('Xóa tên, số điện thoại, địa chỉ, bộ nhớ và nội dung tin nhắn của người này? Không hoàn tác được. Đơn đã xong giữ lại dạng ẩn danh để báo cáo đúng.')) return;
      try { await api.del(`/khach/${u.id}/du-lieu`); toast('Đã xóa dữ liệu theo yêu cầu'); veChiTiet(); taiDs(); } catch (e) { toast(e.message, true); }
    });
    phai.replaceChildren(
      h('header', {}, h('h2', {}, u.ten || '(chưa có tên)'), u.dien_tap && h('span', { class: 'chip mute' }, 'Diễn tập')),
      !u.xoa_luc && h('div', { class: 'body' },
        h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Tên'), oTen), h('label', { class: 'field' }, h('span', {}, 'Số điện thoại'), oSdt)),
        h('label', { class: 'field' }, h('span', {}, 'Địa chỉ giao'), oDc),
        h('label', { class: 'field' }, h('span', {}, 'Ghi chú'), oGc), h('div', { class: 'nutbam' }, nutLuu)),
      veHoSo(ct, veChiTiet),
      h('div', { class: 'body' },
        h('h3', {}, 'Hội thoại'),
        ct.hoi_thoai.length ? ct.hoi_thoai.map((x) => h('p', {}, h('a', { href: `#/hop-thu?id=${x.id}${u.dien_tap ? '&dien_tap=1' : ''}` }, `${TEN_KENH[x.kenh]}${x.ten_page ? ` · ${x.ten_page}` : ''}`),
          h('span', { class: 'muted' }, ` · ${gioPhut(x.cap_nhat_luc)}`))) : h('p', { class: 'muted' }, 'Không có.'),
        !u.xoa_luc && [h('h3', {}, 'Gộp hồ sơ trùng'), h('div', { class: 'hang' }, oGop, nutGop),
          h('h3', {}, 'Quyền của người này'), h('p', { class: 'hint' }, 'Khách yêu cầu xóa dữ liệu thì bấm nút dưới (khách còn đơn chưa xong thì phải hủy đơn trước). MOZA cũng tự xóa sau 12 tháng không liên lạc.'), nutXoa]));
  }

  function veTao() {
    const oTen = h('input', { type: 'text', maxlength: 100 });
    const oSdt = h('input', { type: 'tel' });
    const oDc = h('input', { type: 'text', maxlength: 300 });
    const nut = h('button', { class: 'btn primary', type: 'button' }, 'Tạo khách');
    nut.addEventListener('click', async () => {
      try {
        const kq = await dangLam(nut, 'Đang tạo…', () => api.post('/khach', { ten: oTen.value, sdt: oSdt.value, dia_chi: oDc.value }));
        toast(kq.ket_qua === 'da_lien_ket' ? 'Số này đã có hồ sơ: mở hồ sơ cũ' : 'Đã tạo khách');
        st.chon = kq.khach.id;
        taiDs();
        veChiTiet();
      } catch (e) { toast(e.message, true); }
    });
    phai.replaceChildren(h('header', {}, h('h2', {}, 'Tạo khách (khách gọi điện, nhắn Zalo…)')), h('div', { class: 'body' },
      h('label', { class: 'field' }, h('span', {}, 'Tên hoặc cách gọi'), oTen),
      h('label', { class: 'field' }, h('span', {}, 'Số điện thoại'), oSdt),
      h('label', { class: 'field' }, h('span', {}, 'Địa chỉ giao'), oDc), nut));
  }

  await taiDs();
  await veChiTiet();
}
