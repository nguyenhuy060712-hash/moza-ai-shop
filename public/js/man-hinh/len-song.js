// Khối "Lên sóng" trên Màn hình người dẫn (SPEC.md #90):
//  - 3 nút cảnh Phòng live / Sản phẩm / Cả hai (phím 1 / 2 / 3) — người dẫn luôn giành lại được;
//  - ô gợi ý "Chiếu lên sóng?" khi AI vừa chọn hình (người dẫn đang dẫn): bấm một chạm hoặc phím Enter;
//  - lưới nút nội dung Màn hình sản phẩm của món đang nói + xem trước thu nhỏ.
// Mai dẫn chính / Đội AI dẫn: AI tự chuyển cảnh, khối này chỉ hiện đang chiếu gì.

import { api } from '../api.js';
import { h, toast } from '../ui.js';

const CANH = [['phong', '1', 'Phòng live'], ['san_pham', '2', 'Sản phẩm'], ['ca_hai', '3', 'Cả hai']];
const NUT = [['gioi_thieu', 'Giới thiệu'], ['bang_size', 'Bảng size'], ['chi_tiet', 'Chất liệu'], ['phoi_do', 'Phối đồ'],
  ['video', 'Video'], ['trinh_chieu', 'Trình chiếu'], ['danh_sach', 'Tất cả món'], ['cho', 'Màn chờ']];

/** @param {{ soDangNoi: () => number|null, khiDoiCanh?: (canh:object) => void }} o — khiDoiCanh: đèn OBS của thanh trên (F-126) */
export function taoLenSong({ soDangNoi, khiDoiCanh = null }) {
  let st = { hien: { mau: 'cho' }, canh: { hien: 'ca_hai', goi_y: null, mo_phong: true, obs: {} } };
  const eCanh = h('div', { class: 'ls-canh' });
  const eGoiY = h('div', { class: 'ls-goi-y', hidden: true });
  const eDang = h('p', { class: 'ls-dang' });
  const eNut = h('div', { class: 'ls-nut' });
  const eMau = h('div', { class: 'ls-nut' });
  // Xem trước: chính trang OBS đang lấy, thu nhỏ.
  const eXem = h('div', { class: 'ls-xem' }, h('iframe', { src: '/man-hinh-san-pham.html', title: 'Xem trước Màn hình sản phẩm', tabindex: '-1' }));
  // F-83: 🙏 Cảm ơn — dòng cảm ơn người chốt chạy ngang đáy Thanh chữ 45 giây (chỉ tên gọi, bỏ người xin ẩn tên).
  const nutCamOn = h('button', { class: 'btn small', type: 'button', title: 'Dòng cảm ơn người chốt trên Thanh chữ (45 giây)', onclick: async () => {
    try { const kq = await api.post('/man-hinh/cam-on'); toast(kq.ten.length ? `Đang cảm ơn ${kq.ten.length} người chốt` : 'Buổi này chưa có ai chốt'); } catch (e) { toast(e.message, true); }
  } }, '🙏 Cảm ơn');
  // F-86: 🗳 Bình chọn — bấm để chọn 2–3 màu của món đang nói rồi bắt đầu (60 giây, tối đa 2 lần mỗi buổi, không quà).
  const eBinhChon = h('div', { class: 'ls-nut', hidden: true });
  const nutBinhChon = h('button', { class: 'btn small', type: 'button', title: 'Bình chọn màu bằng bình luận (60 giây)', onclick: () => {
    const x = st.hien || {};
    const mau = [...new Set((x.san_pham?.anh || []).map((a) => a.mau).filter(Boolean).concat((x.san_pham?.con_hang || []).map((p) => String(p.nhan).split('/')[0])))];
    if (mau.length < 2) { toast('Món đang chiếu có dưới 2 màu — chiếu món có nhiều màu rồi bình chọn.', true); return; }
    const chon = new Set();
    const nutBd = h('button', { class: 'btn small primary', type: 'button', disabled: true, onclick: async () => {
      try { await api.post('/binh-chon', { mau: [...chon] }); toast('Đang bình chọn 60 giây'); eBinhChon.hidden = true; } catch (e) { toast(e.message, true); }
    } }, 'Bắt đầu');
    eBinhChon.replaceChildren(...mau.map((m) => {
      const b = h('button', { class: 'btn small', type: 'button' }, m);
      b.addEventListener('click', () => { if (chon.has(m)) chon.delete(m); else if (chon.size < 3) chon.add(m); b.classList.toggle('dang', chon.has(m)); nutBd.disabled = chon.size < 2; });
      return b;
    }), nutBd);
    eBinhChon.hidden = !eBinhChon.hidden;
  } }, '🗳 Bình chọn');
  // Phóng to riêng khối Lên sóng ra toàn màn hình (8/10/2026): dễ nhìn xem trước và bấm chuyển cảnh khi đang live. Esc để thu về.
  const nutPhong = h('button', { class: 'btn small ls-phong', type: 'button', title: 'Xem riêng khối Lên sóng toàn màn hình (Esc để thu về)' }, '⛶ Phóng to');
  const el = h('div', { class: 'ls' }, h('div', { class: 'ls-dau' }, h('span', { class: 'nd-nhan' }, 'Lên sóng'), nutPhong), eCanh, eGoiY,
    h('div', { class: 'ls-giua' }, eXem, h('div', {}, eDang, eNut, eMau, nutCamOn, nutBinhChon, eBinhChon)));
  // Khung xem trước là trang 1920×1080 thu nhỏ: tỷ lệ thu theo bề rộng khung (nhỏ khi bình thường, to khi phóng to).
  const coXem = () => {
    const doc = el.classList.contains('doc');
    const w = eXem.clientWidth || (doc ? 108 : 192);
    eXem.querySelector('iframe').style.transform = `scale(${w / (doc ? 1080 : 1920)})`;
  };
  // Khung dọc / ngang theo Cài đặt → OBS.
  const datKhung = (k) => { el.classList.toggle('doc', k !== 'ngang'); requestAnimationFrame(coXem); };
  datKhung('doc');
  // Phủ kín cửa sổ ngay trong trang (chạy ở mọi trình duyệt), trình duyệt cho phép thì vào luôn toàn màn hình thật.
  const datPhong = (phong) => {
    el.classList.toggle('ls--to', phong);
    nutPhong.textContent = phong ? '✕ Thu nhỏ (Esc)' : '⛶ Phóng to';
    if (phong && !document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    if (!phong && document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
    requestAnimationFrame(coXem);
  };
  nutPhong.addEventListener('click', () => datPhong(!el.classList.contains('ls--to')));
  // Esc (hoặc thoát toàn màn hình của trình duyệt) → thu về.
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && el.classList.contains('ls--to')) datPhong(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('ls--to')) datPhong(false); });
  window.addEventListener('resize', () => requestAnimationFrame(coXem));

  async function chuyen(canh) {
    try { st.canh = { ...st.canh, ...(await api.post('/canh/chuyen', { canh })), hien: canh, goi_y: null }; ve(); } catch (e) { toast(e.message, true); }
  }
  async function chieu(than) {
    try { await api.post('/man-hinh/chieu', { so: soDangNoi(), ...than }); } catch (e) { toast(e.message, true); }
  }

  function ve() {
    const c = st.canh;
    khiDoiCanh?.(c);
    eCanh.replaceChildren(...CANH.map(([k, phim, ten]) => h('button', { class: `btn ls-canh-nut${c.hien === k ? ' dang' : ''}`, onclick: () => chuyen(k), title: `Phím ${phim}` },
      h('kbd', {}, phim), ten)),
    h('span', { class: `chip ${c.obs?.ket_noi ? 'ok' : 'mute'}`, title: c.obs?.ket_noi ? 'Đã nối OBS trên máy này' : 'Chưa nối OBS: chuyển cảnh chỉ mô phỏng (Cài đặt → OBS)' },
      c.obs?.ket_noi ? 'OBS ✓' : 'OBS chưa nối'),
    c.che_do === 'tu_chuyen' ? h('span', { class: 'chip info', title: 'Mai dẫn chính / Đội AI dẫn: AI tự chuyển cảnh, bấm nút là giành lại' }, 'AI tự chuyển') : '');
    eGoiY.hidden = !c.goi_y;
    if (c.goi_y) {
      eGoiY.replaceChildren(h('span', {}, `${c.goi_y.ly_do} — chuyển sang `, h('b', {}, c.goi_y.ten), '?'),
        h('button', { class: 'btn primary', onclick: () => chuyen(c.goi_y.canh) }, 'Chiếu lên (Enter)'),
        h('button', { class: 'btn', onclick: () => api.post('/canh/bo-goi-y').catch(() => {}) }, 'Bỏ qua'));
    }
    const x = st.hien;
    eDang.textContent = `Đang chiếu: ${x.ten_mau || 'Màn chờ'}${x.san_pham ? ` · số ${x.san_pham.so}` : ''}${x.mau_sac ? ` · ${x.mau_sac}` : ''}${x.dong_hop?.length ? ` · size ${x.dong_hop.join(' / ')}` : ''}${x.boi === 'ai' ? ' (AI chọn)' : ''}`;
    const so = soDangNoi();
    eNut.replaceChildren(...NUT.map(([mau, ten]) => h('button', { class: `btn small${x.mau === mau && (!x.san_pham || x.san_pham.so === so) ? ' dang' : ''}`,
      disabled: !so && !['danh_sach', 'cho'].includes(mau), onclick: () => chieu({ mau }) }, ten)));
    // Nút màu: theo ảnh của món đang nói (lấy từ nội dung đang chiếu của chính món đó).
    const mauAnh = x.san_pham?.so === so ? [...new Set((x.san_pham.anh || []).map((a) => a.mau).filter(Boolean))] : [];
    eMau.replaceChildren(...mauAnh.map((m) => h('button', { class: `btn small${x.mau === 'anh' && x.mau_sac === m ? ' dang' : ''}`, onclick: () => chieu({ mau: 'anh', mau_sac: m }) }, `Ảnh ${m}`)));
  }

  async function tai() {
    try { const kq = await api.get('/man-hinh'); st = { hien: kq.hien, canh: kq.canh }; datKhung(kq.obs_cai_dat?.khung); ve(); } catch { /* không bật hộp thoại trong lúc live */ }
  }

  function nghe(m) {
    if (m.type === 'mhsp.hien') { st.hien = m; ve(); }
    if (m.type === 'canh.cap_nhat') { const { type, ...c } = m; st.canh = c; ve(); }
    if (m.type === 'live.doan') setTimeout(ve, 50);
    if (m.type === 'ws.mo') tai();
    if (m.type === 'mhsp.khung') datKhung(m.khung);
  }

  /** Phím 1/2/3 đổi cảnh, Enter nhận gợi ý. Trả true nếu đã dùng phím. */
  function phim(e) {
    const c = CANH.find(([, p]) => p === e.key);
    if (c) { chuyen(c[0]); return true; }
    if (e.key === 'Enter' && st.canh.goi_y) { chuyen(st.canh.goi_y.canh); return true; }
    return false;
  }

  tai();
  return { el, nghe, phim, ve };
}
