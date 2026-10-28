// Màn hình người dẫn — cột phải (BH11, F-126; tách từ nguoi-dan.js): dải cảnh báo (bảng huấn luyện F-116, thẻ nhắc khách xin xem F-81,
// Mai nói sai số F-105, MOZA nhìn F-107, nhắc mở tin / cách chốt F-70, Director báo), biểu đồ theo phút, "Vừa chốt" (kèm nhãn khách
// quen / từng hoàn — F-91, F-118, chỉ người dẫn thấy), bình luận lọc Muốn mua / Hỏi / Khách cũ / Tất cả — chạm để Mai soạn (F-115).

import { api } from '../api.js';
import { h, toast } from '../ui.js';
import { taoKhoiHuanLuyen } from './nd-huan-luyen.js';

const LOC = [['mua', 'Muốn mua'], ['hoi', 'Hỏi'], ['cu', 'Khách cũ'], ['tat_ca', 'Tất cả']];
const NHAN_MUA = ['chot', 'ib', 'ib_gia', 'luong_lu'];
const NHAN_HOI = ['cau_hoi', 'muon_xem'];

/** Bình luận thuộc nhóm lọc nào (một bình luận có thể ở nhiều nhóm). */
export function thuocLoc(b, loc) {
  if (loc === 'tat_ca') return true;
  if (loc === 'mua') return NHAN_MUA.some((n) => b.nhan.includes(n));
  if (loc === 'hoi') return NHAN_HOI.some((n) => b.nhan.includes(n));
  if (loc === 'cu') return !!b.khach_cu;
  return false;
}

/**
 * @param {{st:object, p:object, choCham:() => boolean, cham:(bl:object) => void, chuyenTheoNhin:() => void}} ctx
 *   choCham: false khi AI đang dừng (chỉ còn bình luận hỏi size có số đo được chạm — tư vấn size bằng mã).
 */
export function taoBenPhai(ctx) {
  const { st, p } = ctx;
  st.locBl = st.locBl || 'tat_ca';
  const hl = taoKhoiHuanLuyen({ khiCham: (id) => { const b = st.binhLuan.find((x) => x.id === id); if (b) ctx.cham(b); } });
  const eTheNhac = h('div', { class: 'nd-the-nhac', hidden: true, 'aria-live': 'assertive' });
  const eDinhChinh = h('div', { class: 'nd-dinh-chinh', hidden: true, role: 'alert' });
  const eGoiYNhin = h('div', { class: 'nd-goi-y-nhin', hidden: true, 'aria-live': 'polite' });
  const eNhacSong = h('div', { class: 'nd-nhac-song', hidden: true, 'aria-live': 'polite' });
  const eBao = h('p', { class: 'nd-bao', role: 'status', hidden: true });
  const eChot = h('div', { class: 'nd-chot', hidden: true, 'aria-live': 'polite' });
  const eTab = h('div', { class: 'nd-sk-loc', role: 'tablist', 'aria-label': 'Lọc bình luận' });
  const eDs = h('div', { class: 'nd-sk-bl' });
  const eDem = h('span', { class: 'muted nd-sk-dem' });
  const el = h('aside', { class: 'nd-sk-phai' },
    h('div', { class: 'nd-sk-canh' }, hl.khoi, eTheNhac, eDinhChinh, eGoiYNhin, eNhacSong, eBao),
    eChot,
    h('section', { class: 'nd-sk-bl-khoi' }, h('div', { class: 'nd-sk-bl-dau' }, eTab, eDem), eDs));

  // ---- dải cảnh báo ----
  let henAnNhac = null;
  const hienNhac = (nhan, chu) => {
    eNhacSong.replaceChildren(h('span', { class: 'nd-nhan' }, nhan), h('p', {}, chu));
    eNhacSong.hidden = false;
    clearTimeout(henAnNhac);
    henAnNhac = setTimeout(() => { eNhacSong.hidden = true; }, 90000);
  };
  let henAnDc = null;
  const hienDinhChinh = (muc, chu) => {
    eDinhChinh.className = `nd-dinh-chinh ${muc === 'vang' ? 'vang' : 'do'}`;
    eDinhChinh.replaceChildren(h('span', { class: 'nd-nhan' }, muc === 'vang' ? 'Nghi Mai nói nhầm' : 'Mai nói sai số'), h('p', {}, chu));
    eDinhChinh.hidden = false;
    clearTimeout(henAnDc);
    henAnDc = setTimeout(() => { eDinhChinh.hidden = true; }, 30000);
  };
  const veTheNhac = (tt) => {
    const x = tt?.hien;
    eTheNhac.hidden = !x;
    if (!x) return;
    eTheNhac.replaceChildren(
      h('span', { class: 'nd-nhan' }, `Khách xin xem${tt.hang?.length ? ` · còn ${tt.hang.length} thẻ chờ` : ''}`),
      h('p', {}, x.chu),
      h('div', { class: 'nutbam' }, ...x.nut.map((n) => h('button', { class: 'btn', type: 'button', onclick: async () => {
        try { await api.post('/man-hinh/chieu', n.lenh); toast('Đã chiếu'); } catch (er) { toast(er.message, true); }
      } }, n.chu)), h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        try { veTheNhac(await api.post('/live/the-nhac/xong', { id: x.id })); } catch (er) { toast(er.message, true); }
      } }, 'Đã làm')));
  };
  // F-107: máy không bao giờ tự chuyển món — người bấm Chuyển (hoặc Enter) mới đổi đoạn.
  const veGoiYNhin = (g) => {
    st.goiYNhin = g?.so ? g : null;
    eGoiYNhin.hidden = !st.goiYNhin;
    if (!st.goiYNhin) return;
    eGoiYNhin.replaceChildren(h('span', { class: 'nd-nhan' }, 'MOZA nhìn'), h('p', {}, `Đang cầm ${g.ten}?`),
      h('div', { class: 'nutbam' }, h('button', { class: 'btn primary small', type: 'button', onclick: ctx.chuyenTheoNhin }, 'Chuyển (Enter)'),
        h('button', { class: 'btn small', type: 'button', onclick: () => { veGoiYNhin(null); api.post(`/nhin/${p.id}/bo-qua`, { so: g.so }).catch(() => {}); } }, 'Bỏ qua')));
  };
  const veBao = () => {
    eBao.hidden = !st.ai.bao;
    eBao.classList.toggle('do', st.ai.bao?.muc === 'do');
    eBao.textContent = st.ai.bao ? `⚑ ${st.ai.bao.noi_dung}` : '';
  };

  // ---- Vừa chốt (F-53, #72): 3 lượt chốt gần nhất + số đơn trong buổi ----
  st.vuaChot = st.vuaChot || [];
  st.donTrongBuoi = st.donTrongBuoi || new Set();
  function veChot() {
    eChot.hidden = !st.vuaChot.length && !st.donTrongBuoi.size;
    eChot.replaceChildren(h('span', { class: 'nd-nhan' }, `Vừa chốt · ${st.donTrongBuoi.size} đơn trong buổi`),
      ...st.vuaChot.map((x) => h('p', {}, h('b', {}, x.ten), ` vừa chốt ${x.mon}`, h('span', { class: 'muted' }, ` · ${x.don?.ma || ''}`),
        x.nhan_khach ? h('span', { class: 'chip info', title: 'Chỉ bạn thấy — không nói trên sóng' }, x.nhan_khach) : null,
        x.nhan_hoan ? h('span', { class: 'chip bad', title: 'Chỉ bạn thấy — không nói trên sóng' }, x.nhan_hoan) : null)));
  }
  if (st.phien?.id && !st.donTrongBuoi.size) {
    // Mở lại màn hình giữa buổi: đếm lại đơn của buổi này.
    api.get(`/don?phien_live_id=${encodeURIComponent(st.phien.id)}&dien_tap=tat_ca`).then((kq) => {
      for (const d of kq.don) if (d.trang_thai !== 'da_huy') st.donTrongBuoi.add(d.id);
      if (st.donTrongBuoi.size) veChot();
    }).catch(() => {});
  }

  // ---- bình luận lọc + chạm để trả lời ----
  const laHoiSize = (b) => /\d\s*(kg|ký|ki|kí|cân|cm)|\b1m\d|\bm\d\d\b/i.test(b.noi_dung);
  function veBl() {
    const dem = Object.fromEntries(LOC.map(([k]) => [k, st.binhLuan.filter((b) => thuocLoc(b, k)).length]));
    eTab.replaceChildren(...LOC.map(([k, ten]) => h('button', { class: `nd-sk-loc-nut${st.locBl === k ? ' dang' : ''}`, type: 'button', role: 'tab',
      'aria-selected': String(st.locBl === k), onclick: () => { st.locBl = k; veBl(); } }, ten, h('span', { class: 'nd-sk-loc-so' }, String(dem[k])))));
    eDem.textContent = `${st.dem.tong || 0} bình luận · chờ tư vấn ${st.dem.cho_tu_van || 0}`;
    const ds = st.binhLuan.filter((b) => thuocLoc(b, st.locBl)).slice(0, 14);
    const choCham = ctx.choCham();
    eDs.replaceChildren(...(ds.length ? ds.map((b) => {
      const chamDuoc = !b.nhan.includes('cua_page') && (choCham || laHoiSize(b));
      const noi = [
        h('span', { class: 'nd-bl-ten' }, b.ten,
          b.khach_cu && h('span', { class: 'chip info', title: 'Đã từng mua — chỉ bạn thấy' }, 'Khách cũ'),
          b.nhan.includes('thong_tin_ca_nhan') && h('span', { class: 'chip bad' }, b.da_an ? 'Đã ẩn · chờ Tư vấn viên' : 'Lộ SĐT'),
          b.nhan.includes('spam') && h('span', { class: 'chip mute' }, 'Spam'),
          b.nhan.includes('xuc_pham') && h('span', { class: 'chip bad' }, 'Xúc phạm'),
          b.nhan.includes('lua_ai') && h('span', { class: 'chip warn' }, 'Cố lừa AI'),
          b.nhan.includes('loi_chuc') && h('span', { class: 'chip info', title: 'Đội AI đọc lời chúc này trước bài hát (Radio)' }, '💌 Lời chúc'),
          b.nhan.includes('chot') && h('span', { class: 'chip accent' }, '🛒 Chốt'),
          b.so_doan && h('span', { class: 'chip mute' }, `số ${b.so_doan}`),
          b.tra_loi_luc && h('span', { class: 'chip ok' }, 'Đã trả lời')),
        h('span', { class: 'nd-bl-chu' }, b.noi_dung),
      ];
      const lop = `nd-bl-dong${b.nhan.includes('cau_hoi') ? ' hoi' : ''}${['spam', 'xuc_pham', 'lua_ai'].some((n) => b.nhan.includes(n)) ? ' mo-di' : ''}`;
      return chamDuoc
        ? h('button', { class: `${lop} cham`, type: 'button', title: 'Chạm để Mai soạn câu trả lời', onclick: () => ctx.cham(b) }, ...noi)
        : h('div', { class: lop }, ...noi);
    }) : [h('p', { class: 'mo' }, st.locBl === 'tat_ca' ? 'Chưa có bình luận.' : 'Chưa có bình luận nào trong nhóm này.')]));
  }

  return {
    el, hl, veBl, veChot, veBao, veTheNhac, veGoiYNhin, hienNhac, hienDinhChinh,
    /** Sự kiện ws của cột phải. */
    nghe(m) {
      if (m.type === 'live.the_nhac') veTheNhac(m);
      if (m.type === 'live.huan_luyen') hl.cap(m);
      if (m.type === 'live.nhac_mo_tin') hienNhac('Mở tin nhắn chờ', `${m.ten.join(', ')} ơi, shop đã nhắn riêng rồi, xem giúp shop mục Tin nhắn chờ nha.`);
      if (m.type === 'live.canh_bao') hienNhac('Cảnh báo', m.chu);
      if (m.type === 'live.dinh_chinh') hienDinhChinh('do', m.chu);
      if (m.type === 'live.nghi_sai') hienDinhChinh('vang', m.chu);
      if (m.type === 'live.nhin_goi_y') veGoiYNhin(m);
      if (m.type === 'live.nhac_cach_chot') hienNhac('Nhắc cách chốt', `Muốn lấy thì bình luận: ${m.vi_du}. Shop nhắn riêng giữ hàng liền.`);
      if (m.type === 'live.chot') {
        st.vuaChot = [m, ...st.vuaChot].slice(0, 3);
        if (m.don?.id) st.donTrongBuoi.add(m.don.id);
        veChot();
      }
      if (m.type === 'live.da_tra_loi') {
        st.binhLuan = st.binhLuan.map((b) => (b.id === m.binh_luan_id ? { ...b, tra_loi_luc: new Date().toISOString() } : b));
        if (hl.canhBao?.binh_luan_id === m.binh_luan_id) hl.anCanh();
        veBl();
      }
    },
  };
}
