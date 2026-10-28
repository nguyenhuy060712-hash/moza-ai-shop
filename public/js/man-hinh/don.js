// Đơn hàng (SPEC.md F-55, F-57; GD1 F-123): 4 tab (Cần làm · Đang giao · Xong · Hủy, hoàn), chi tiết đơn có dòng hành trình, ô thêm món bằng chữ,
// (món, người nhận, phí ship, lịch sử trạng thái — ai đổi, bằng chứng), sửa món / người nhận, đổi trạng thái, hoàn tác lần
// đổi gần nhất, in phiếu giao hàng, đánh dấu "Đã gửi" nhiều đơn một lần kèm mã vận đơn, xuất CSV, tạo đơn tay.
// AI tạo đơn từ bình luận chốt và Messenger; người chỉ cần xem, gửi hàng, bấm "Đã gửi".

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam, hoi, trangTrong } from '../ui.js';
import { chipTrangThai, chipMau, thongTin } from '../trang-thai.js';
import { tien, docTien } from '../dinh-dang.js';

// 4 nhóm (lọc phía máy chủ bằng ?nhom=). Trong "Cần làm" có bộ lọc nhỏ: Chờ xác nhận · Cần gửi · Chờ tiền CK (F-89).
const THE = [
  { k: 'can_lam', ten: 'Cần làm' },
  { k: 'dang_giao', ten: 'Đang giao' },
  { k: 'xong', ten: 'Xong' },
  { k: 'huy_hoan', ten: 'Hủy, hoàn' },
];
const LOC_CAN_LAM = [['', 'Tất cả'], ['cho_xac_nhan', 'Chờ xác nhận'], ['da_xac_nhan', 'Cần gửi'], ['ck_cho_tien', 'Chờ tiền CK']];
const NHOM_TU_TT = { cho_xac_nhan: 'can_lam', da_xac_nhan: 'can_lam', da_gui: 'dang_giao', da_giao: 'xong', hoan: 'huy_hoan', da_huy: 'huy_hoan' };
const TEN_TT = new Proxy({}, { get: (_, k) => thongTin('don', k).ten });
const TEN_NGUON = { ai: 'AI', nguoi: 'Người', khach_tu_bao: 'Khách tự báo', he_thong: 'Tự động' };
const TEN_NGUON_DON = { binh_luan_live: 'Bình luận live', tin_nhan: 'Messenger', nguoi: 'Người tạo' };

export { tien };
export const chipDon = (t) => chipTrangThai('don', t);
const sdtHien = (s) => (s ? `0${String(s).slice(3, 6)} ${String(s).slice(6, 9)} ${String(s).slice(9)}` : '');

let ngheWs = null;

export function roi() {
  if (ngheWs) window.removeEventListener('moza:ws', ngheWs);
  ngheWs = null;
}

export async function ve(khung) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const loc0 = q.get('loc') === 'chua_nhan_tien' ? 'ck_cho_tien' : q.get('loc') || '';
  const tt0 = q.get('trang_thai') || '';
  const st = {
    the: THE.some((x) => x.k === q.get('nhom')) ? q.get('nhom') : loc0 ? 'can_lam' : NHOM_TU_TT[tt0] || 'can_lam',
    loc: LOC_CAN_LAM.some(([k]) => k && k === loc0) ? loc0 : ['cho_xac_nhan', 'da_xac_nhan'].includes(tt0) ? tt0 : '',
    q: '', dienTap: q.get('dien_tap') === '1', chon: q.get('id') || null, ds: [], dem: {}, demNhom: {}, danhDau: new Set(),
  };
  // Mở thẳng một đơn (từ Tin nhắn, Khách hàng…): chuyển tới tab chứa đơn đó.
  if (st.chon && st.chon !== 'moi' && !q.has('nhom')) {
    try { const ct0 = await api.get(`/don/${st.chon}`); st.the = NHOM_TU_TT[ct0.don.trang_thai] || st.the; st.loc = ''; } catch { /* không có đơn này: giữ mặc định */ }
  }
  // Đang có buổi tập (phiên diễn tập mở) thì mặc định xem đơn của buổi tập — người dùng hay tưởng chưa lên đơn.
  // Còn đơn tập mà chưa có đơn thật nào đang chờ xử lý (chờ xác nhận / cần gửi) thì cũng xem đơn tập.
  if (!q.has('dien_tap')) {
    try {
      if ((await api.get('/live/phien/hien-tai')).phien?.dien_tap) st.dienTap = true;
      else if (Object.values((await api.get('/dien-tap/ban-hang')).don).some((n) => n > 0)) {
        const that = (await api.get('/don?trang_thai=&dien_tap=0')).dem;
        if (!(that.cho_xac_nhan + that.da_xac_nhan)) st.dienTap = true;
      }
    } catch { /* không đọc được thì giữ mặc định: đơn thật */ }
  }
  const baoTap = h('p', { class: 'hint', style: 'margin:0' });
  // F-73: người chốt lúc Meta khóa nhắn tin của Page — người quyết nhắn bù từng người / tất cả / bỏ (3 tin mỗi phút, hạn 7 ngày).
  const khungNhanBu = h('section', { class: 'panel nhan-bu', hidden: true });
  const khungCho = h('details', { class: 'panel', hidden: true }); // F-92
  const theBar = h('div', { class: 'chon', role: 'tablist', 'aria-label': 'Trạng thái đơn' });
  const oTim = h('input', { type: 'search', placeholder: 'Tìm mã đơn, tên, số điện thoại', 'aria-label': 'Tìm đơn' });
  const oDienTap = h('input', { type: 'checkbox', checked: st.dienTap });
  const thanhChon = h('div', { class: 'hang thanh-chon', hidden: true });
  const locBar = h('div', { class: 'chon', role: 'group', 'aria-label': 'Lọc trong Cần làm', hidden: true });
  const trai = h('div', { class: 'ds' });
  const phai = h('section', { class: 'panel' });
  const qs = () => new URLSearchParams(st.the === 'can_lam' && st.loc === 'ck_cho_tien'
    ? { trang_thai: '', chua_nhan_tien: '1', thanh_toan: 'chuyen_khoan', q: st.q, dien_tap: st.dienTap ? '1' : '0' }
    : st.the === 'can_lam' && st.loc ? { trang_thai: st.loc, q: st.q, dien_tap: st.dienTap ? '1' : '0' }
      : { trang_thai: '', nhom: st.the, q: st.q, dien_tap: st.dienTap ? '1' : '0' });
  khung.replaceChildren(
    h('div', { class: 'viewbar' }, h('h1', {}, 'Đơn hàng'), theBar, h('span', { class: 'grow' }),
      h('label', { class: 'hint', style: 'display:flex;gap:6px;align-items:center;margin:0' }, oDienTap, 'Đơn diễn tập'),
      h('button', { class: 'btn', type: 'button', onclick: () => { location.href = `/api/don/xuat.csv?${qs()}`; } }, 'Xuất Excel (CSV)'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { st.chon = 'moi'; veChiTiet(); } }, '+ Tạo đơn')),
    baoTap,
    khungNhanBu,
    khungCho,
    h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, h('header', {}, oTim, locBar), thanhChon, trai), phai));

  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { st.q = oTim.value; taiDs(); }, 200); });
  oDienTap.addEventListener('change', () => { st.dienTap = oDienTap.checked; st.danhDau.clear(); taiDs(); });

  function veThe() {
    theBar.replaceChildren(...THE.map((x) => h('button', {
      type: 'button', role: 'tab', 'aria-pressed': String(st.the === x.k),
      onclick: () => { st.the = x.k; st.loc = ''; st.danhDau.clear(); veThe(); taiDs(); },
    }, x.ten, x.k === 'can_lam' && st.demNhom[x.k] ? h('span', { class: 'dem' }, String(st.demNhom[x.k])) : null)));
    locBar.hidden = st.the !== 'can_lam';
    locBar.replaceChildren(...LOC_CAN_LAM.map(([k, ten]) => h('button', {
      type: 'button', 'aria-pressed': String(st.loc === k), onclick: () => { st.loc = k; st.danhDau.clear(); veThe(); taiDs(); },
    }, ten)));
  }

  function veThanhChon() {
    // Cần gửi: chọn nhiều đơn → in phiếu, đánh dấu Đã gửi (F-57).
    const coChon = st.the === 'can_lam' && st.loc === 'da_xac_nhan' && st.ds.length > 0;
    thanhChon.hidden = !coChon;
    if (!coChon) return;
    const n = st.danhDau.size;
    const tatCa = h('input', { type: 'checkbox', checked: n > 0 && n === st.ds.length, 'aria-label': 'Chọn tất cả' });
    tatCa.addEventListener('change', () => { if (tatCa.checked) st.ds.forEach((d) => st.danhDau.add(d.id)); else st.danhDau.clear(); veDs(); });
    thanhChon.replaceChildren(
      h('label', { class: 'hint', style: 'display:flex;gap:6px;align-items:center;margin:0' }, tatCa, n ? `Đã chọn ${n}` : 'Chọn tất cả'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn small', type: 'button', disabled: !n, onclick: () => inPhieu([...st.danhDau], 'a6') }, 'In phiếu A6'),
      h('button', { class: 'btn small', type: 'button', disabled: !n, onclick: () => inPhieu([...st.danhDau], 'a4') }, 'In 4 phiếu / A4'),
      h('button', { class: 'btn small', type: 'button', disabled: !n, onclick: () => xuatHang([...st.danhDau]) }, 'Xuất file cho hãng'), // F-101
      h('button', { class: 'btn small primary', type: 'button', disabled: !n, onclick: guiNhieu }, 'Đánh dấu Đã gửi'));
  }

  /** F-101: xuất file đúng mẫu hãng đang dùng (Cài đặt); đơn cần sửa địa chỉ / khối lượng mặc định báo trước khi tải. */
  async function xuatHang(ids) {
    try {
      const cd = await api.get('/cai-dat');
      const hang = cd.ban_hang.hang_van_chuyen || 'chung';
      const m = (cd.lua_chon?.hang_van_chuyen || []).find((x) => x.ma === hang);
      const dung = m?.trang_thai === 'dung_duoc' ? hang : 'nhap_hang_loat';
      if (dung !== hang) toast(`${m?.ten || hang}: chưa có file mẫu của hãng — tạm xuất mẫu "Nhập hàng loạt".`);
      const q = `hang=${dung}&ids=${encodeURIComponent(ids.join(','))}`;
      if (dung !== 'chung') {
        const k = await api.get(`/don/xuat-kiem?${q}`);
        const canSua = k.can_sua.map((x) => `${x.ma}: ${x.dia_chi}`).join('\n');
        if (k.can_sua.length && !confirm(`${k.can_sua.length} đơn cần sửa địa chỉ (chưa tách được tỉnh / xã chắc chắn — cột "Cần sửa địa chỉ" = X):\n${canSua}\n\nVẫn tải file để tự sửa?`)) return;
        if (k.khoi_luong_mac_dinh.length) toast(`${k.khoi_luong_mac_dinh.length} đơn có món chưa nhập cân nặng — tạm tính 300 g mỗi món.`);
      }
      location.href = `/api/don/xuat.csv?${q}`;
    } catch (e) { toast(e.message, true); }
  }

  function inPhieu(ids, kho) {
    window.open(`/api/don/phieu?ids=${encodeURIComponent(ids.join(','))}&kho=${kho}`, '_blank');
  }

  async function guiNhieu() {
    const ids = [...st.danhDau];
    if (!(await hoi({ tieuDe: `Đánh dấu ${ids.length} đơn là "Đã gửi"?`, noiDung: 'Tồn kho sẽ trừ theo các món trong đơn.', nhan: 'Đã gửi' }))) return;
    const ds = ids.map((id) => {
      const o = document.querySelector(`[data-van-don="${id}"]`);
      return { id, ma_van_don: o && o.value.trim() ? o.value.trim() : null };
    });
    try {
      const kq = await api.post('/don/gui', { ds });
      toast(kq.loi ? `Đã gửi ${kq.ok} đơn, ${kq.loi} đơn lỗi: ${kq.ket_qua.filter((x) => !x.ok).map((x) => x.loi).join('; ')}` : `Đã gửi ${kq.ok} đơn`, kq.loi > 0);
      st.danhDau.clear();
      taiDs();
    } catch (e) { toast(e.message, true); }
  }

  async function taiCho() {
    let kq;
    try { kq = await api.get(`/cho-hang?dien_tap=${st.dienTap ? '1' : '0'}`); } catch { return; }
    const ds = kq.ds.filter((x) => x.trang_thai === 'cho');
    khungCho.hidden = !kq.ds.length;
    khungCho.replaceChildren(h('summary', {}, `Danh sách chờ hàng · ${ds.length} người${kq.ds.length > ds.length ? ` · ${kq.ds.length - ds.length} đang được mời` : ''}`),
      h('p', { class: 'hint' }, 'Khách bấm "Vẫn chờ" trên thẻ hết hàng. Có hàng trả về (hủy, bớt, nhập thêm, nhận hoàn) thì MOZA giữ 30 phút cho người chờ đầu và nhắn mời; không bấm thì nhường người sau. Quá 24 giờ thì thôi.'),
      ...kq.ds.map((x) => {
        const nut = x.trang_thai === 'cho' ? h('button', { class: 'btn small', type: 'button' }, 'Hủy') : null;
        nut?.addEventListener('click', async () => { try { await api.del(`/cho-hang/${x.id}`); toast('Đã bỏ khỏi danh sách chờ'); taiCho(); } catch (e) { toast(e.message, true); } });
        return h('div', { class: 'hang' }, h('span', { class: 'grow' }, `Số ${x.so} ${x.gt2 ? `${x.gt1}/${x.gt2}` : x.gt1} · ${x.ten_nguoi || 'khách'} · bấm ${gioPhut(x.bam_luc)}${x.trang_thai === 'cho' ? '' : ' · đang được mời'}`), nut);
      }));
  }

  async function taiNhanBu() {
    taiCho();
    let kq;
    try { kq = await api.get(`/don/nhan-bu?dien_tap=${st.dienTap ? '1' : '0'}`); } catch { return; }
    const ds = kq.nhan_bu;
    khungNhanBu.hidden = !ds.length && !kq.dang;
    if (khungNhanBu.hidden) return;
    const gui = async (nut, body) => {
      try {
        const r = await dangLam(nut, 'Đang kiểm Page…', () => api.post('/don/nhan-bu/gui', { ...body, dien_tap: st.dienTap }));
        toast(`Bắt đầu nhắn bù ${r.bat_dau} người — cách nhau ${r.cach_giay} giây để Page không bị khóa lại.`);
      } catch (e) { toast(e.message, true); }
      taiNhanBu();
    };
    const nutTatCa = h('button', { class: 'btn small primary', type: 'button', disabled: !!(kq.dang && !kq.dang.xong) || !ds.length }, 'Nhắn bù tất cả');
    nutTatCa.addEventListener('click', () => gui(nutTatCa, { tat_ca: true }));
    const dang = kq.dang && !kq.dang.xong ? `Đang nhắn bù: đã gửi ${kq.dang.da_gui}/${kq.dang.tong}…`
      : kq.dang?.dung_vi ? kq.dang.dung_vi : kq.dang ? `Lượt vừa rồi: gửi được ${kq.dang.da_gui}/${kq.dang.tong}.` : '';
    khungNhanBu.replaceChildren(
      h('header', {}, h('h3', { style: 'margin:0' }, `Nhắn bù (${ds.length})`), h('span', { class: 'grow' }), nutTatCa),
      h('p', { class: 'hint' }, 'Những người chốt lúc Meta tạm khóa nhắn tin của Page: chưa nhận được thẻ giữ hàng. Hết khóa thì bấm nhắn bù — MOZA hỏi lại Meta trước, gửi 3 tin mỗi phút, gặp lại khóa thì dừng. Quá 7 ngày kể từ lúc bình luận thì Facebook không cho nhắn nữa. Đơn đã hủy thì gửi thẻ mời nếu còn hàng.'),
      dang && h('p', { class: 'hint' }, dang),
      h('ul', { class: 'lich-su' }, ...ds.map((x) => {
        const nut = h('button', { class: 'btn small', type: 'button' }, 'Nhắn bù');
        nut.addEventListener('click', () => gui(nut, { ids: [x.id] }));
        const bo = h('button', { class: 'btn small', type: 'button' }, 'Bỏ');
        bo.addEventListener('click', async () => { try { await api.post(`/don/nhan-bu/${x.id}/bo`); taiNhanBu(); } catch (e) { toast(e.message, true); } });
        return h('li', {}, h('b', {}, x.ten || 'Người xem'), ` · chốt lúc ${gioPhut(x.tao_luc)} · hạn tới ${gioPhut(x.han_luc)} `, nut, ' ', bo);
      })));
  }

  async function taiDs() {
    taiNhanBu();
    const kq = await api.get(`/don?${qs()}`);
    st.ds = kq.don;
    st.dem = kq.dem;
    st.demNhom = kq.dem_nhom || {};
    let soTap = 0;
    if (!st.dienTap) { try { soTap = Object.values((await api.get('/dien-tap/ban-hang')).don).reduce((a, b) => a + b, 0); } catch { /* bỏ qua */ } }
    baoTap.replaceChildren(...(st.dienTap
      ? [h('span', { class: 'chip warn' }, 'Đang xem đơn của BUỔI TẬP'), ' không phải đơn thật. Bỏ tích "Đơn diễn tập" để xem đơn thật.']
      : soTap ? [h('span', { class: 'chip info' }, `Buổi tập có ${soTap} đơn`), ' — tích "Đơn diễn tập" để xem.'] : []));
    for (const id of [...st.danhDau]) if (!st.ds.some((d) => d.id === id)) st.danhDau.delete(id);
    veThe();
    veDs();
  }

  function veDs() {
    veThanhChon();
    const chon = st.the === 'can_lam' && st.loc === 'da_xac_nhan';
    trai.replaceChildren(...(st.ds.length ? st.ds.map((d) => {
      const o = chon ? h('input', { type: 'checkbox', checked: st.danhDau.has(d.id), 'aria-label': `Chọn ${d.ma}`, onclick: (ev) => ev.stopPropagation() }) : null;
      o?.addEventListener('change', () => { if (o.checked) st.danhDau.add(d.id); else st.danhDau.delete(d.id); veThanhChon(); });
      return h('div', { class: 'don-dong' }, o, h('button', {
        type: 'button', 'aria-current': String(st.chon === d.id), onclick: () => { st.chon = d.id; veDs(); veChiTiet(); },
      },
      h('span', { class: 'dong1' }, h('b', {}, d.ma), chipDon(d.trang_thai),
        d.trang_thai === 'cho_xac_nhan' && !(d.ten_nhan && d.sdt_nhan && d.dia_chi_nhan) && chipTrangThai('don', 'thieu_thong_tin'),
        d.thanh_toan === 'chuyen_khoan' && !d.da_nhan_tien_luc && !['da_huy', 'hoan'].includes(d.trang_thai) && chipTrangThai('don', 'cho_tien'),
        d.chua_lien_lac && chipMau('warn', 'Chưa liên lạc được'),
        // F-118: khách từng hoàn đơn — nhãn nội bộ, khách không thấy.
        d.so_hoan_khach > 0 && h('span', { class: 'chip bad', title: `Từng hoàn ${d.so_hoan_khach} đơn — nên gọi xác nhận / chuyển khoản trước` }, `Từng hoàn ${d.so_hoan_khach}`),
        // F-99: nhãn NỘI BỘ (khách không thấy) — máy đánh dấu, người quyết; không khóa in phiếu.
        // F-106: "Mai nói nhầm giá" — nhãn + nút xử lý (bán theo giá Mai nói / giữ giá đúng).
        ...(d.danh_dau || []).map((x) => h('span', { class: 'chip warn', title: x.chi_tiet.mo_ta }, `Mai nói nhầm giá · ${x.chi_tiet.che_do === 'ban_theo_gia_noi' ? 'đã bán theo giá Mai nói' : 'chờ bạn quyết'}`,
          ...[['giu_gia_dung', 'Giữ giá đúng'], ['ban_theo_gia_noi', 'Bán theo giá Mai nói'], ['da_xem', 'Đã xem']]
            .filter(([k]) => !(x.chi_tiet.che_do === 'ban_theo_gia_noi' && k === 'ban_theo_gia_noi'))
            .map(([k, t]) => h('button', { class: 'btn small', type: 'button', style: 'margin-left:6px', onclick: async (e) => {
              e.stopPropagation();
              try { const r = await api.post(`/don/${d.id}/danh-dau/${x.id}/xu-ly`, { cach: k }); toast(r.doi_tong ? `Đã đổi — tổng ${tien(r.don.tong_tien)}` : 'Đã ghi'); window.dispatchEvent(new CustomEvent('moza:ws', { detail: { type: 'don.cap_nhat' } })); } catch (er) { toast(er.message, true); }
            } }, t)))),
        d.hoi_lai_nhan?.nen && h('span', { class: 'chip info', title: d.hoi_lai_nhan.ly_do }, `Nên hỏi lại · ${({ da_hoi: 'đã hỏi', dong_y: 'khách OK', hen_ngay: 'hẹn ngày', khong_tra_loi: 'chưa trả lời' })[d.hoi_lai] || d.hoi_lai_nhan.ly_do}`),
        h('span', { class: 'grow' }), h('b', {}, tien(d.tong_tien))),
      h('span', { class: 'dong2' }, `${d.ten_nhan || d.ten_fb || '(chưa có tên)'}${d.sdt_nhan ? ` · ${sdtHien(d.sdt_nhan)}` : ''}`),
      h('span', { class: 'dong3' }, `${d.dong.map((x) => `${x.ten_chup.replace(/^Số (\d+) · .*? · /, 'Số $1 ')} x${x.so_luong}`).join(', ')}`),
      h('span', { class: 'dong3' }, `${gioPhut(d.tao_luc)} · ${TEN_NGUON_DON[d.nguon]}${d.trang_thai === 'cho_xac_nhan' && d.giu_den ? ` · giữ tới ${gioPhut(d.giu_den)}` : ''}${d.thanh_toan === 'chuyen_khoan' ? ' · chuyển khoản' : ''}`)),
      chon ? h('input', { type: 'text', class: 'van-don', placeholder: 'Mã vận đơn', 'data-van-don': d.id, value: d.ma_van_don || '', 'aria-label': `Mã vận đơn ${d.ma}` }) : null);
    }) : [st.the === 'can_lam' ? trangTrong('Chưa có đơn nào cần làm. Khách chốt ở bình luận live hoặc nhắn Messenger thì AI tự lên đơn.', { href: '#/live', chu: 'Bắt đầu live' }) : trangTrong('Chưa có đơn nào ở đây.', null)]));
  }

  async function doiTrangThai(d, den, hoiCau, them = {}) {
    if (hoiCau && !(await hoi({ tieuDe: hoiCau, nhan: 'Đồng ý' }))) return;
    try { await api.post(`/don/${d.id}/trang-thai`, { den, ...them }); toast(`Đơn ${d.ma}: ${TEN_TT[den]}`); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); }
  }

  async function veChiTiet() {
    if (!st.chon) { phai.replaceChildren(h('div', { class: 'empty' }, 'Chọn một đơn bên trái.')); return; }
    if (st.chon === 'moi') return veTao();
    let ct;
    try { ct = await api.get(`/don/${st.chon}`); } catch (e) { phai.replaceChildren(h('div', { class: 'empty' }, e.message)); return; }
    const d = ct.don;
    const suaDuoc = ['cho_xac_nhan', 'da_xac_nhan'].includes(d.trang_thai);
    const oTen = h('input', { type: 'text', value: d.ten_nhan, maxlength: 100, disabled: !suaDuoc });
    const oSdt = h('input', { type: 'tel', value: sdtHien(d.sdt_nhan).replace(/ /g, ''), disabled: !suaDuoc });
    const oDc = h('input', { type: 'text', value: d.dia_chi_nhan, maxlength: 300, disabled: !suaDuoc });
    const oTt = h('select', { disabled: !suaDuoc }, h('option', { value: 'cod', selected: d.thanh_toan === 'cod' }, 'Thanh toán khi nhận (COD)'),
      h('option', { value: 'chuyen_khoan', selected: d.thanh_toan === 'chuyen_khoan' }, 'Chuyển khoản'));
    const oShip = h('input', { type: 'text', value: tien(d.phi_ship), inputmode: 'numeric', disabled: !suaDuoc, class: 'o-tien', 'aria-label': 'Phí ship' });
    oShip.addEventListener('blur', () => { const n = docTien(oShip.value); if (n != null && !Number.isNaN(n)) oShip.value = tien(n); });
    const oVd = h('input', { type: 'text', value: d.ma_van_don, maxlength: 60, disabled: d.trang_thai === 'da_huy' });
    const oGc = h('textarea', { rows: 2, maxlength: 1000, disabled: !suaDuoc });
    oGc.value = d.ghi_chu;
    const nutLuu = h('button', { class: 'btn small primary', type: 'button' }, 'Lưu');
    nutLuu.addEventListener('click', async () => {
      const than = { ma_van_don: oVd.value };
      if (suaDuoc) Object.assign(than, { ten: oTen.value, sdt: oSdt.value, dia_chi: oDc.value, thanh_toan: oTt.value, ghi_chu: oGc.value, ...(docTien(oShip.value) !== d.phi_ship ? { phi_ship: Number.isNaN(docTien(oShip.value)) ? oShip.value : String(docTien(oShip.value)) } : {}) });
      try { await dangLam(nutLuu, 'Đang lưu…', () => api.put(`/don/${d.id}`, than)); toast('Đã lưu'); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); }
    });

    const nut = (chu, lop, fn) => h('button', { class: `btn small ${lop}`, type: 'button', onclick: fn }, chu);
    const hanhDong = []; // một nút chính + vài nút phụ
    const them = []; // trong menu ⋯: hủy, hoàn, đưa về…
    if (d.trang_thai === 'cho_xac_nhan') {
      hanhDong.push(nut('Xác nhận đơn', 'primary', () => doiTrangThai(d, 'da_xac_nhan', ct.con_thieu.length ? null : 'Xác nhận đơn này? (đã gọi hoặc khách đã đồng ý)')));
    }
    if (d.trang_thai === 'da_xac_nhan') {
      hanhDong.push(nut('Đã gửi', 'primary', () => doiTrangThai(d, 'da_gui', 'Đánh dấu đã gửi? Tồn kho sẽ trừ.', { ma_van_don: oVd.value })));
      them.push({ chu: 'Đưa về Chờ xác nhận', fn: () => doiTrangThai(d, 'cho_xac_nhan') });
    }
    if (d.trang_thai === 'da_gui') {
      hanhDong.push(nut('Đã giao', 'primary', () => doiTrangThai(d, 'da_giao')));
      them.push({ chu: 'Đơn bị hoàn', nguy: true, fn: () => doiTrangThai(d, 'hoan', 'Đánh dấu đơn bị hoàn? Khi hàng về kho, bấm "Đã nhận hàng hoàn" để cộng lại tồn.') });
    }
    if (d.trang_thai === 'hoan' && !d.da_nhan_hoan_luc) {
      hanhDong.push(nut('Đã nhận hàng hoàn', 'primary', async () => { try { await api.post(`/don/${d.id}/nhan-hoan`); toast('Đã cộng lại tồn kho'); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); } }));
    }
    if (suaDuoc) {
      them.push({ chu: 'Hủy đơn', nguy: true, fn: async () => {
        const kq = await hoi({ tieuDe: `Hủy đơn ${d.ma}?`, noiDung: 'Hàng đang giữ trả về kho. Ghi lý do để sau này xem lại.', nhan: 'Hủy đơn', nguyHiem: true, coLyDo: true, nhanLyDo: 'Lý do hủy (ví dụ: khách không nghe máy)', macDinh: 'khách hủy' });
        if (kq) doiTrangThai(d, 'da_huy', null, { ghi_chu: kq.ly_do || 'người hủy' });
      } });
    }
    if (d.trang_thai === 'da_xac_nhan' && !d.hoi_lai) {
      hanhDong.push(nut('Hỏi lại ngay', '', async () => { try { await api.post(`/don/${d.id}/hoi-lai`); toast('Đã nhắn hỏi khách trước khi gửi'); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); } }));
    }
    if (d.thanh_toan === 'chuyen_khoan' && !d.da_nhan_tien_luc && !['da_huy', 'hoan'].includes(d.trang_thai)) {
      hanhDong.push(nut('Đã nhận tiền', '', async () => { try { const r = await api.post(`/don/${d.id}/nhan-tien`); toast(r.bao_khach?.da_gui ? 'Đã ghi nhận tiền, đã nhắn báo khách' : 'Đã ghi nhận tiền'); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); } }));
    }
    const cuoi = ct.lich_su.filter((x) => !x.da_hoan_tac).at(-1);
    if (cuoi && cuoi.nguon === 'ai') {
      them.push({ chu: 'Hoàn tác lần đổi của AI', fn: async () => {
        if (!(await hoi({ tieuDe: `Đưa đơn về "${TEN_TT[cuoi.tu]}"?`, nhan: 'Hoàn tác' }))) return;
        try { await api.post(`/don/${d.id}/hoan-tac`); toast('Đã hoàn tác'); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); }
      } });
    }
    if (d.sdt_nhan) hanhDong.push(h('a', { class: 'btn small', href: `tel:${d.sdt_nhan}` }, 'Gọi khách'));
    hanhDong.push(nut('In phiếu', '', () => inPhieu([d.id], 'a6')));
    if (them.length) {
      hanhDong.push(h('details', { class: 'menu-them' }, h('summary', { class: 'btn small', 'aria-label': 'Thêm việc với đơn' }, '⋯'),
        h('div', { class: 'the-menu' }, them.map((x) => h('button', { type: 'button', class: x.nguy ? 'nguy-chu' : '', onclick: x.fn }, x.chu)))));
    }

    // Sửa món: bớt từng món, thêm món mới (chọn từ danh sách còn hàng).
    const bangMon = h('table', { class: 'bang-du-lieu' },
      h('thead', {}, h('tr', {}, ['Món', 'SL', 'Đơn giá', 'Thành tiền', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, d.dong.map((x) => h('tr', {}, h('td', {}, x.ten_chup), h('td', { class: 'num' }, String(x.so_luong)),
        h('td', { class: 'num' }, tien(x.don_gia)), h('td', { class: 'num' }, tien(x.don_gia * x.so_luong)),
        h('td', {}, suaDuoc && d.dong.length > 0 ? h('button', { class: 'btn small', type: 'button', title: 'Bớt 1', onclick: async () => {
          try { await api.post(`/don/${d.id}/bot-mon`, { phan_loai_id: x.phan_loai_id, so_luong: 1 }); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); }
        } }, '−1') : null))),
      h('tr', {}, h('td', { colspan: 3 }, 'Tổng hàng'), h('td', { class: 'num' }, tien(d.tong_hang)), h('td')),
      h('tr', {}, h('td', { colspan: 3 }, 'Phí ship'), h('td', { class: 'num' }, suaDuoc ? oShip : tien(d.phi_ship)), h('td')),
      h('tr', {}, h('td', { colspan: 3 }, h('b', {}, 'Tổng tiền')), h('td', { class: 'num' }, h('b', {}, tien(d.tong_tien))), h('td'))));

    const oChu = h('input', { type: 'text', maxlength: 100, placeholder: 'Thêm món: gõ 12 đen M', 'aria-label': 'Thêm món bằng chữ', disabled: !suaDuoc });
    const nutChu = h('button', { class: 'btn small', type: 'button' }, 'Thêm');
    const themChu = async () => {
      if (!oChu.value.trim()) return;
      try { await dangLam(nutChu, 'Đang thêm…', () => api.post(`/don/${d.id}/them-theo-chu`, { chu: oChu.value })); toast('Đã thêm món'); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); }
    };
    nutChu.addEventListener('click', themChu);
    oChu.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); themChu(); } });
    const themMon = suaDuoc ? h('div', {}, h('div', { class: 'hang', style: 'margin-top:8px' }, oChu, nutChu),
      h('details', {}, h('summary', { class: 'hint' }, 'Hoặc chọn từ danh sách'), await oChonMon(async (plId, sl) => {
        try { await api.post(`/don/${d.id}/mon`, { phan_loai_id: plId, so_luong: sl }); taiDs(); veChiTiet(); } catch (e) { toast(e.message, true); }
      }, 'Thêm món'))) : null;

    // Dòng hành trình: nguồn → tin riêng → khách gửi thông tin → các trạng thái đã qua (từ lịch sử đơn).
    const buoc = [{ binh_luan_live: 'Chốt trên live', tin_nhan: 'Khách nhắn Messenger', nguoi: 'Người tạo' }[d.nguon] || 'Tạo đơn'];
    if (ct.lien_he?.length || d.hoi_thoai_id) buoc.push('Mai nhắn riêng');
    if (d.ten_nhan && d.sdt_nhan && d.dia_chi_nhan) buoc.push('Khách gửi thông tin');
    for (const x of ct.lich_su.filter((y) => !y.da_hoan_tac)) { const ten = TEN_TT[x.den]; if (buoc.at(-1) !== ten) buoc.push(ten); }
    const hanhTrinh = h('ol', { class: 'hanh-trinh', 'aria-label': 'Hành trình đơn' }, buoc.map((ten, i) => h('li', { class: i === buoc.length - 1 ? 'nay' : '' }, ten)));

    phai.replaceChildren(
      h('header', {}, h('h2', {}, d.ma), chipDon(d.trang_thai), d.dien_tap && h('span', { class: 'chip mute' }, 'Diễn tập'),
        h('span', { class: 'grow' }), h('span', { class: 'muted' }, `${TEN_NGUON_DON[d.nguon]} · ${gioPhut(d.tao_luc)}`)),
      h('div', { class: 'body' },
        hanhTrinh,
        ct.con_thieu.length && d.trang_thai === 'cho_xac_nhan' ? h('p', { class: 'hint' }, `Còn thiếu: ${ct.con_thieu.join(', ')}.`) : null,
        d.trang_thai === 'cho_xac_nhan' && d.giu_den ? h('p', { class: 'hint' }, `Đang giữ hàng tới ${gioPhut(d.giu_den)}. Quá giờ: đơn đủ tên, số, địa chỉ được giữ thêm 12 giờ để shop gọi xác nhận; đơn còn thiếu thì tự hủy, trả hàng về kho và báo khách kèm nút Đặt lại.`) : null,
        ct.chua_lien_lac ? h('p', { class: 'hint' }, h('span', { class: 'chip warn' }, 'Chưa liên lạc được'), ' Khách chưa để số và không nhắn Messenger quá 24 giờ: Facebook không cho shop nhắn thêm. Chờ khách nhắn lại, hoặc hủy đơn.') : null,
        ct.lien_he?.length ? h('p', { class: 'hint' }, `MOZA đã liên hệ: ${ct.lien_he.join(' · ')}.`) : null,
        // F-90: gộp đơn; đơn đã xác nhận bị sửa món → về Chờ xác nhận (phiếu in trước đó đã cũ).
        ct.gop_vao ? h('p', { class: 'hint' }, 'Đơn này đã gộp vào ', h('a', { href: `#/don?id=${ct.gop_vao.id}&trang_thai=` }, ct.gop_vao.ma), '.') : null,
        ct.gop_tu?.length ? h('p', { class: 'hint' }, 'Gộp món từ: ', ...ct.gop_tu.flatMap((x, i) => [i ? ', ' : '', h('a', { href: `#/don?id=${x.id}&trang_thai=` }, x.ma)]), '.') : null,
        d.trang_thai === 'cho_xac_nhan' && ct.lich_su.filter((x) => !x.da_hoan_tac).at(-1)?.ghi_chu === 'sửa món sau xác nhận'
          ? h('p', { class: 'loi', role: 'alert' }, '⚠ Đơn đã xác nhận nhưng khách vừa đổi món: đơn về Chờ xác nhận, MOZA gửi thẻ mới để khách xác nhận lại. Phiếu gửi hàng in trước đó đã cũ — đừng gửi theo phiếu cũ.') : null,
        d.ly_do_huy ? h('p', { class: 'hint' }, `Lý do hủy: ${d.ly_do_huy}`) : null,
        h('div', { class: 'nutbam', style: 'justify-content:flex-start;flex-wrap:wrap' }, hanhDong),
        h('h3', {}, 'Món'), bangMon, themMon,
        h('h3', {}, 'Người nhận'),
        h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Tên'), oTen), h('label', { class: 'field' }, h('span', {}, 'Số điện thoại'), oSdt)),
        h('label', { class: 'field' }, h('span', {}, 'Địa chỉ giao'), oDc),
        h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Thanh toán'), oTt), h('label', { class: 'field' }, h('span', {}, 'Mã vận đơn'), oVd)),
        h('label', { class: 'field' }, h('span', {}, 'Ghi chú'), oGc),
        h('div', { class: 'nutbam' }, nutLuu),
        ct.khach ? h('p', {}, 'Hồ sơ khách: ', h('a', { href: `#/khach?id=${ct.khach.id}` }, ct.khach.ten || '(chưa có tên)'),
          ct.khach.so_hoan > 0 ? h('span', { class: 'chip bad', style: 'margin-left:6px' }, `Từng hoàn ${ct.khach.so_hoan} đơn — nên gọi xác nhận / chuyển khoản trước`) : null) : null,
        d.hoi_thoai_id ? h('p', {}, h('a', { href: `#/tin-nhan?id=${d.hoi_thoai_id}${d.dien_tap ? '&dien_tap=1' : ''}` }, 'Mở hội thoại với khách')) : null,
        h('h3', {}, 'Lịch sử'),
        h('ul', { class: 'lich-su' }, ct.lich_su.map((x) => h('li', { class: x.da_hoan_tac ? 'muted' : '' },
          `${gioPhut(x.luc)} · ${x.tu ? `${TEN_TT[x.tu]} → ` : ''}${TEN_TT[x.den]} · ${TEN_NGUON[x.nguon] || x.nguon}`,
          x.ghi_chu ? ` · ${x.ghi_chu.replace(/\s*\((nguoi|ai|khach|he_thong|khach_tu_bao)\)/g, '')}` : '', x.bang_chung_tin_nhan_id ? ' · có tin khách làm bằng chứng' : '', x.da_hoan_tac ? ' (đã hoàn tác)' : '')))));
  }

  /** Ô chọn món còn hàng: sản phẩm → phân loại → số lượng. */
  async function oChonMon(khiChon, chuNut) {
    const { san_pham: ds } = await api.get('/kho');
    const dangBan = ds.filter((s) => s.trang_thai === 'dang_ban');
    const oSp = h('select', {}, h('option', { value: '' }, 'Chọn sản phẩm…'), dangBan.map((s) => h('option', { value: s.id }, `Số ${s.so} · ${s.ten}`)));
    const oPl = h('select', { disabled: true });
    const oSl = h('input', { type: 'number', min: 1, max: 100, value: 1, style: 'max-width:70px' });
    oSp.addEventListener('change', () => {
      const s = dangBan.find((x) => x.id === oSp.value);
      oPl.disabled = !s;
      oPl.replaceChildren(...(s ? s.phan_loai.filter((p) => !p.bo).map((p) => h('option', { value: p.id, disabled: p.con_ban_duoc <= 0 },
        `${p.gt2 ? `${p.gt1} / ${p.gt2}` : p.gt1} — còn ${p.con_ban_duoc}`)) : []));
    });
    const nut = h('button', { class: 'btn small', type: 'button' }, chuNut);
    nut.addEventListener('click', () => { if (!oPl.value) { toast('Chọn sản phẩm và phân loại', true); return; } khiChon(oPl.value, Number(oSl.value) || 1); });
    return h('div', { class: 'hang', style: 'margin-top:8px' }, oSp, oPl, oSl, nut);
  }

  async function veTao() {
    const mon = [];
    const bang = h('ul', { class: 'lich-su' });
    const veMon = () => bang.replaceChildren(...(mon.length ? mon.map((m, i) => h('li', {}, `${m.ten} x${m.so_luong} `,
      h('button', { class: 'btn small', type: 'button', onclick: () => { mon.splice(i, 1); veMon(); } }, 'Bỏ'))) : [h('li', { class: 'muted' }, 'Chưa có món.')]));
    veMon();
    const { san_pham: ds } = await api.get('/kho');
    const chonMon = await oChonMon((plId, sl) => {
      const s = ds.find((x) => x.phan_loai.some((p) => p.id === plId));
      const p = s.phan_loai.find((x) => x.id === plId);
      mon.push({ phan_loai_id: plId, so_luong: sl, ten: `Số ${s.so} · ${s.ten} · ${p.gt2 ? `${p.gt1}/${p.gt2}` : p.gt1}` });
      veMon();
    }, 'Thêm vào đơn');
    const oTen = h('input', { type: 'text', maxlength: 100 });
    const oSdt = h('input', { type: 'tel' });
    const oDc = h('input', { type: 'text', maxlength: 300 });
    const oTt = h('select', {}, h('option', { value: 'cod' }, 'Thanh toán khi nhận (COD)'), h('option', { value: 'chuyen_khoan' }, 'Chuyển khoản'));
    const oGc = h('textarea', { rows: 2, maxlength: 1000 });
    const nutTao = h('button', { class: 'btn primary', type: 'button' }, 'Tạo đơn (giữ hàng)');
    nutTao.addEventListener('click', async () => {
      if (!mon.length) { toast('Thêm ít nhất một món', true); return; }
      try {
        const d = await dangLam(nutTao, 'Đang tạo…', () => api.post('/don', { mon: mon.map(({ phan_loai_id: p, so_luong: s }) => ({ phan_loai_id: p, so_luong: s })),
          ten: oTen.value, sdt: oSdt.value, dia_chi: oDc.value, thanh_toan: oTt.value, ghi_chu: oGc.value }));
        toast(`Đã tạo đơn ${d.ma}`);
        st.chon = d.id; st.the = 'can_lam'; st.loc = ''; taiDs(); veChiTiet();
      } catch (e) { toast(e.message, true); }
    });
    phai.replaceChildren(h('header', {}, h('h2', {}, 'Tạo đơn tay')), h('div', { class: 'body' },
      h('p', { class: 'hint' }, 'Dùng khi khách đặt qua điện thoại, Zalo… Đơn từ bình luận live và Messenger thì AI tự tạo.'),
      h('h3', {}, 'Món'), bang, chonMon,
      h('h3', {}, 'Người nhận (có thể điền sau)'),
      h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Tên'), oTen), h('label', { class: 'field' }, h('span', {}, 'Số điện thoại'), oSdt)),
      h('label', { class: 'field' }, h('span', {}, 'Địa chỉ giao'), oDc),
      h('label', { class: 'field' }, h('span', {}, 'Thanh toán'), oTt),
      h('label', { class: 'field' }, h('span', {}, 'Ghi chú'), oGc),
      h('div', { class: 'nutbam' }, nutTao)));
  }

  ngheWs = (ev) => {
    const t = ev.detail?.type;
    if (t === 'don.nhan_bu') { clearTimeout(ngheWs.henNb); ngheWs.henNb = setTimeout(taiNhanBu, 300); }
    if (t === 'don.cap_nhat' || t === 'live.chot') {
      clearTimeout(ngheWs.hen);
      ngheWs.hen = setTimeout(() => { taiDs(); if (st.chon && st.chon !== 'moi' && ev.detail?.don_id === st.chon) veChiTiet(); }, 300);
    }
  };
  window.addEventListener('moza:ws', ngheWs);
  await taiDs();
  await veChiTiet();
}
