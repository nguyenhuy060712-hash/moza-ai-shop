// Hộp thư (SPEC.md F-25, F-26, F-31): 3 cột — danh sách hội thoại | nội dung | khách hàng + các đơn của khách.
// Nhóm "Cần người" luôn ở đầu. Người gõ vào hội thoại nào thì AI tạm dừng ở đó cho tới khi bấm "Giao lại cho AI".
// Mỗi tin AI đã gửi có "Vì sao" (nhật ký) và 👍/👎. Chữ của khách luôn hiện bằng textContent (mục 9).

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam } from '../ui.js';
import { tien as tienChung } from '../dinh-dang.js';
import { thongTin, chipTrangThai } from '../trang-thai.js';
import { ngheWs } from '../ws.js';

const LOC = [
  { id: '', ten: 'Tất cả' },
  { id: 'can_nguoi', ten: 'Cần người' },
  { id: 'ai', ten: 'AI đang xử lý' },
  { id: 'nguoi', ten: 'Tôi đang xử lý' },
  { id: 'cho', ten: 'Chờ phản hồi' },
  { id: 'xong', ten: 'Xong' },
  { id: 'spam', ten: 'Spam' },
];

const TEN_KENH = { messenger: 'Messenger', binh_luan: 'Bình luận bài đăng', binh_luan_live: 'Bình luận live' };
export const TEN_DON = {
};
for (const k of ['cho_xac_nhan', 'da_xac_nhan', 'da_gui', 'da_giao', 'hoan', 'da_huy']) TEN_DON[k] = [thongTin('don', k).ten, thongTin('don', k).mau];
export const tienVn = tienChung;
const TEN_GUI = { khach: '', ai: 'Mai (AI)', nguoi: 'Bạn', he_thong: 'MOZA tự nhắc' };

const chip = (ten, mau) => h('span', { class: `chip ${mau}` }, ten);
const chipTT = (tt) => chipTrangThai('hop_thu', tt);

let st = null;
let boNghe = null;

export function roi() {
  boNghe?.();
  boNghe = null;
}

export async function ve(khung) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  st = { loc: q.get('loc') ?? '', pageId: '', sanPhamId: q.get('san_pham_id') || '', phien: q.get('phien') || '', q: '', dienTap: q.get('dien_tap') === '1', chon: q.get('id') || null, ds: [], dem: {} };
  const oTim = h('input', { type: 'search', placeholder: 'Tìm tên, nội dung', 'aria-label': 'Tìm hội thoại' });
  const boLoc = h('div', { class: 'chon', role: 'group', 'aria-label': 'Lọc hội thoại' });
  const oPage = h('select', { 'aria-label': 'Page' });
  const oDienTap = h('input', { type: 'checkbox', checked: st.dienTap });
  const trai = h('div', { class: 'ds ds-hop-thu' });
  const giua = h('section', { class: 'panel ht-giua' });
  const phai = h('section', { class: 'panel ht-phai' });

  khung.replaceChildren(
    h('div', { class: 'viewbar' }, h('h1', {}, 'Tin nhắn'), h('span', { class: 'grow' }),
      h('label', { class: 'hint', style: 'display:flex;gap:6px;align-items:center;margin:0' }, oDienTap, 'Xem hội thoại diễn tập')),
    h('div', { class: 'ba-cot' },
      h('section', { class: 'panel' }, h('header', {}, oTim, oPage, boLoc), trai),
      giua, phai));

  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { st.q = oTim.value; taiDs(); }, 200); });
  oPage.addEventListener('change', () => { st.pageId = oPage.value; taiDs(); });
  oDienTap.addEventListener('change', () => { st.dienTap = oDienTap.checked; st.chon = null; taiDs(); veChon(); });

  roi();
  boNghe = ngheWs((m) => {
    if (m.type === 'hop_thu.cap_nhat' || m.type === 'can_nguoi') {
      clearTimeout(st.henWs);
      st.henWs = setTimeout(() => { taiDs(); if (st.chon && (!m.hoi_thoai_id || m.hoi_thoai_id === st.chon)) veChon(false); }, 300);
    }
  });

  async function taiDs() {
    const p = new URLSearchParams({ loc: st.loc, page_id: st.pageId, san_pham_id: st.sanPhamId, phien_live_id: st.phien, q: st.q, dien_tap: st.dienTap ? '1' : '0' });
    const kq = await api.get(`/hoi-thoai?${p}`);
    st.ds = kq.hoi_thoai;
    st.dem = kq.dem;
    boLoc.replaceChildren(...LOC.map((l) => h('button', {
      type: 'button', 'aria-pressed': String(st.loc === l.id), onclick: () => { st.loc = l.id; taiDs(); },
    }, l.id ? `${l.ten} ${st.dem[l.id] ?? 0}` : l.ten)));
    const pages = [...new Map(st.ds.map((x) => [x.page_id, x.ten_page || x.page_id])).entries()];
    if (oPage.options.length !== pages.length + 1) {
      oPage.replaceChildren(h('option', { value: '' }, 'Mọi Page'), ...pages.map(([id, ten]) => h('option', { value: id, selected: id === st.pageId }, ten)));
    }
    oPage.hidden = pages.length < 2 && !st.pageId;
    const locThem = [st.sanPhamId && 'một sản phẩm', st.phien && 'một phiên live'].filter(Boolean);
    trai.replaceChildren(
      ...(locThem.length ? [h('p', { class: 'hint', style: 'padding:0 12px' }, `Đang lọc theo ${locThem.join(', ')}. `,
        h('a', { href: '#/hop-thu' }, 'Bỏ lọc'))] : []),
      ...(st.ds.length ? st.ds.map((x) => h('button', {
        type: 'button', 'aria-current': String(st.chon === x.id), onclick: () => { st.chon = x.id; taiDs(); veChon(); },
      },
      h('span', { class: 'dong1' }, h('b', {}, x.ten_khach || x.ten || 'Người dùng Facebook'), chipTT(x.trang_thai),
        x.so_loi > 0 && chip('Gửi lỗi', 'bad'), x.ai_tam_dung && x.trang_thai !== 'nguoi_dang_xu_ly' && chip('AI tạm dừng', 'warn')),
      h('span', { class: 'dong2' }, x.tin_cuoi || ''),
      h('span', { class: 'dong3' }, [TEN_KENH[x.kenh], pages.length > 1 && x.ten_page, gioPhut(x.cap_nhat_luc), x.nhan.length && x.nhan.join(', ')].filter(Boolean).join(' · ')))) : [
        h('div', { class: 'empty' }, st.dienTap ? 'Chưa có hội thoại diễn tập. Vào Livestream → Phòng diễn tập → Messenger giả để thử.' : 'Chưa có hội thoại nào.'),
      ]));
  }

  async function veChon(cuon = true) {
    if (!st.chon) {
      giua.replaceChildren(h('div', { class: 'empty' }, 'Chọn một hội thoại bên trái.'));
      phai.replaceChildren(h('div', { class: 'empty' }, 'Khách hàng và các đơn của khách hiện ở đây.'));
      return;
    }
    let d;
    try { d = await api.get(`/hoi-thoai/${st.chon}`); } catch (e) { giua.replaceChildren(h('div', { class: 'empty' }, e.message)); return; }
    veGiua(d, cuon);
    vePhai(d);
  }

  function veGiua(d, cuon) {
    const x = d.hoi_thoai;
    const nut = (chu, fn, lop = 'btn small') => { const b = h('button', { class: lop, type: 'button' }, chu); b.addEventListener('click', () => fn(b)); return b; };
    const lam = (duong, than = {}) => async (b) => {
      try { await dangLam(b, '…', () => api.post(duong, than)); await taiDs(); await veChon(false); } catch (e) { toast(e.message, true); }
    };
    const tin = h('div', { class: 'ht-tin' }, d.tin_nhan.map((t) => veTin(t, x)));
    const oTraLoi = h('textarea', { rows: 3, placeholder: x.kenh === 'messenger' ? 'Nhập tin trả lời (Enter để gửi, Shift+Enter xuống dòng). Gửi xong AI tạm dừng ở hội thoại này.' : 'Trả lời công khai dưới bình luận. Gửi xong AI tạm dừng ở hội thoại này.' });
    const nutGui = h('button', { class: 'btn primary', type: 'button' }, 'Gửi');
    const gui = async () => {
      if (!oTraLoi.value.trim()) return;
      try { await dangLam(nutGui, 'Đang gửi…', () => api.post(`/hoi-thoai/${x.id}/gui`, { noi_dung: oTraLoi.value })); oTraLoi.value = ''; await veChon(); taiDs(); } catch (e) { toast(e.message, true); }
    };
    nutGui.addEventListener('click', gui);
    oTraLoi.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui(); } });
    const oGhiChu = h('input', { type: 'text', placeholder: 'Ghi chú nội bộ (khách không thấy)' });
    const nutGhi = nut('Ghi chú', async () => {
      if (!oGhiChu.value.trim()) return;
      try { await api.post(`/hoi-thoai/${x.id}/ghi-chu`, { noi_dung: oGhiChu.value }); oGhiChu.value = ''; veChon(); } catch (e) { toast(e.message, true); }
    });
    const cuaSo = x.kenh === 'messenger' && x.tin_khach_cuoi_luc
      ? Math.max(0, 24 - (Date.now() - new Date(x.tin_khach_cuoi_luc).getTime()) / 3600000) : null;
    giua.replaceChildren(
      h('header', {},
        h('h2', {}, d.nguoi.ten || 'Người dùng Facebook'), chipTT(x.trang_thai), chip(TEN_KENH[x.kenh], 'mute'),
        x.ten_page && chip(x.ten_page, 'mute'),
        cuaSo != null && chip(cuaSo > 0 ? `Còn ${cuaSo < 1 ? '< 1' : Math.floor(cuaSo)} giờ để nhắn` : 'Quá 24 giờ: không nhắn được', cuaSo > 1 ? 'mute' : 'warn'),
        x.ly_do_can_nguoi && x.trang_thai === 'can_nguoi' && h('p', {}, `Cần người vì: ${x.ly_do_can_nguoi}`)),
      h('div', { class: 'nutbam', style: 'padding:8px 16px;border-bottom:1px solid var(--line)' },
        (x.ai_tam_dung || x.trang_thai === 'can_nguoi') ? nut('Giao lại cho AI', lam(`/hoi-thoai/${x.id}/giao-ai`), 'btn small primary')
          : nut('Tôi xử lý (AI dừng)', lam(`/hoi-thoai/${x.id}/trang-thai`, { trang_thai: 'nguoi_dang_xu_ly' })),
        nut('Xong', lam(`/hoi-thoai/${x.id}/trang-thai`, { trang_thai: 'xong' })),
        nut('Chờ phản hồi', lam(`/hoi-thoai/${x.id}/trang-thai`, { trang_thai: 'cho_phan_hoi' })),
        nut('Spam', lam(`/hoi-thoai/${x.id}/trang-thai`, { trang_thai: 'spam' })),
        x.phien_live_id && h('a', { class: 'btn small', href: `#/hop-thu?phien=${x.phien_live_id}` }, 'Cùng phiên live')),
      tin,
      // F-78: quá 24 giờ — Messenger không cho Page nhắn tin thường; ẩn ô gõ, mở cuộc trò chuyện trong Meta Business Suite.
      d.qua_24_gio
        ? h('div', { class: 'ht-soan' },
          h('p', { class: 'hint', style: 'margin:0 0 6px' }, 'Quá 24 giờ kể từ tin cuối của khách: Messenger không cho nhắn tin thường từ đây. Trả lời bằng Meta Business Suite trên điện thoại. Đơn đang chờ thì MOZA tự dùng mẫu tin Utility.'),
          h('div', { class: 'hang' },
            d.link_business_suite
              ? h('a', { class: 'btn primary', href: d.link_business_suite, target: '_blank', rel: 'noopener noreferrer' }, 'Mở trong Meta Business Suite')
              : h('span', { class: 'muted' }, 'Hội thoại diễn tập: không có Business Suite.'),
            oGhiChu, nutGhi))
        : h('div', { class: 'ht-soan' }, oTraLoi, h('div', { class: 'hang' }, oGhiChu, nutGhi, h('span', { class: 'grow' }), nutGui)));
    if (cuon) setTimeout(() => { tin.scrollTop = tin.scrollHeight; }, 0);
  }

  function veTin(t, x) {
    if (t.chieu === 'noi_bo') return h('div', { class: 'ht-ghi-chu' }, h('span', { class: 'muted' }, `Ghi chú · ${gioPhut(t.luc)}`), h('div', {}, t.noi_dung));
    const ra = t.chieu === 'ra';
    const loi = ['loi', 'khong_ro'].includes(t.trang_thai_gui);
    const danhGia = async (diem) => {
      const lyDo = diem === 'xau' ? prompt('Câu này chưa tốt ở đâu? (AI sẽ đề xuất bài học từ lý do này)') : null;
      if (diem === 'xau' && lyDo === null) return;
      try { await api.post(`/run/${t.agent_run_id}/danh-gia`, { diem, ly_do: lyDo || null }); toast(diem === 'tot' ? 'Đã ghi 👍' : 'Đã ghi 👎 — xem ở Agent & Skill → Bài học'); } catch (e) { toast(e.message, true); }
    };
    return h('div', { class: `ht-bong ${ra ? 'ra' : 'vao'} ${loi ? 'loi' : ''}` },
      h('div', { class: 'ht-bong-dau' },
        h('span', {}, ra ? TEN_GUI[t.gui_boi] : (t.loai === 'binh_luan' ? 'Bình luận' : '')),
        t.loai === 'tra_loi' && chip('Trả lời công khai', 'mute'), t.loai === 'nhan_rieng' && chip('Nhắn riêng', 'mute'),
        h('span', { class: 'muted' }, gioPhut(t.luc))),
      h('div', { class: 'ht-bong-chu' }, t.noi_dung),
      loi && h('div', { class: 'loi' }, t.trang_thai_gui === 'khong_ro' ? 'Không rõ đã gửi chưa — kiểm tra trên Facebook trước. ' : 'Gửi lỗi: ', t.loi || '',
        ' ', h('button', { class: 'btn small', type: 'button', onclick: async (e) => {
          if (t.trang_thai_gui === 'khong_ro' && !confirm('Tin này có thể đã tới khách. Vẫn gửi lại?')) return;
          try { await dangLam(e.target, 'Đang gửi…', () => api.post(`/tin-nhan/${t.id}/thu-lai`)); toast('Đã gửi lại'); veChon(false); } catch (er) { toast(er.message, true); }
        } }, 'Thử lại')),
      ra && t.agent_run_id && h('div', { class: 'ht-bong-duoi' },
        h('a', { href: `#/agent/nhat-ky/${t.agent_run_id}` }, 'Vì sao?'),
        h('button', { class: 'btn small', type: 'button', title: 'Tốt', onclick: () => danhGia('tot') }, '👍'),
        h('button', { class: 'btn small', type: 'button', title: 'Chưa tốt', onclick: () => danhGia('xau') }, '👎')));
  }

  function vePhai(d) {
    const x = d.hoi_thoai;
    const goiY = d.san_pham_goi_y && h('p', { class: 'hint' }, `Món có thể đang hỏi: ${d.san_pham_goi_y.ten}`);
    if (!d.khach) {
      const oTen = h('input', { type: 'text', value: d.nguoi.ten || '', placeholder: 'Tên hoặc cách gọi' });
      const oSdt = h('input', { type: 'tel', placeholder: 'Số điện thoại' });
      const oDc = h('input', { type: 'text', placeholder: 'Địa chỉ giao (nếu có)' });
      const nutTao = h('button', { class: 'btn primary small', type: 'button' }, 'Tạo hồ sơ khách');
      nutTao.addEventListener('click', async () => {
        try {
          const kq = await dangLam(nutTao, 'Đang tạo…', () => api.post(`/hoi-thoai/${x.id}/tao-khach`, { ten: oTen.value, sdt: oSdt.value, dia_chi: oDc.value }));
          toast(kq.ket_qua === 'da_lien_ket' ? 'Số này đã có hồ sơ: đã nối hội thoại vào hồ sơ cũ' : 'Đã tạo hồ sơ khách');
          veChon(false);
        } catch (e) { toast(e.message, true); }
      });
      phai.replaceChildren(h('header', {}, h('h2', {}, 'Khách hàng')), h('div', { class: 'body' },
        h('p', { class: 'muted' }, 'Chưa có hồ sơ. Khách chỉ hỏi thì không cần hồ sơ; AI tự tạo khi khách cho số điện thoại lúc lên đơn. Tạo tay khi khách gọi điện.'),
        h('label', { class: 'field' }, h('span', {}, 'Tên'), oTen), h('label', { class: 'field' }, h('span', {}, 'Số điện thoại'), oSdt),
        h('label', { class: 'field' }, h('span', {}, 'Địa chỉ giao'), oDc), nutTao, goiY,
        // F-97: người chưa có hồ sơ vẫn xóa được dữ liệu theo yêu cầu.
        h('p', {}, h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
          if (!confirm('Xóa tên hiển thị và nội dung tin nhắn của người này? Không hoàn tác được.')) return;
          try { await api.del(`/nguoi/${d.hoi_thoai.nguoi_fb_id}/du-lieu`); toast('Đã xóa dữ liệu theo yêu cầu'); veChon(false); } catch (e) { toast(e.message, true); }
        } }, 'Xóa dữ liệu người này'))));
      return;
    }
    phai.replaceChildren(h('header', {}, h('h2', {}, 'Khách hàng'), h('a', { class: 'btn small', href: `#/khach?id=${d.khach.khach.id}` }, 'Mở hồ sơ')),
      goiY || '', veHoSo(d.khach, () => veChon(false)));
  }

  await taiDs();
  await veChon();
}

/** Hồ sơ khách gọn (dùng chung cho Hộp thư và màn hình Khách hàng): thông tin, các đơn, việc, bộ nhớ. */
export function veHoSo(ct, veLai) {
  const u = ct.khach;
  const lam = (fn) => async (e) => { try { await dangLam(e.target, '…', fn); veLai(); } catch (er) { toast(er.message, true); } };
  const soHoan = ct.don.filter((x) => x.trang_thai === 'hoan').length;
  return h('div', { class: 'body ho-so' },
    u.xoa_luc ? h('p', { class: 'muted' }, 'Dữ liệu người này đã xóa theo yêu cầu.') : [
      h('div', { class: 'vs-dong' }, h('span', { class: 'muted' }, 'Tên'), h('span', {}, u.ten || '—')),
      h('div', { class: 'vs-dong' }, h('span', { class: 'muted' }, 'Số điện thoại'), h('span', {}, u.sdt_hien || '—')),
      h('div', { class: 'vs-dong' }, h('span', { class: 'muted' }, 'Địa chỉ giao'), h('span', { class: 'xuong-dong' }, u.dia_chi || '—')),
      u.ghi_chu && h('div', { class: 'vs-dong' }, h('span', { class: 'muted' }, 'Ghi chú'), h('span', { class: 'xuong-dong' }, u.ghi_chu)),
      soHoan > 0 && h('p', {}, chip(`Từng hoàn ${soHoan} đơn — nên gọi xác nhận / chuyển khoản trước`, 'bad')),
      // F-91: chỉ người của shop thấy — không lên sóng, không nói với khách khi khách không hỏi.
      ct.tom_tat_mua?.nhan && h('p', {}, chip(ct.tom_tat_mua.nhan, 'info'),
        Object.keys(ct.tom_tat_mua.size_quen || {}).length ? h('span', { class: 'hint' }, ` Size quen: ${Object.entries(ct.tom_tat_mua.size_quen).map(([dm, s]) => `${dm.replace(/_/g, ' ')} ${s}`).join(' · ')}`) : null),
      ct.so_do && h('div', { class: 'vs-dong' }, h('span', { class: 'muted' }, 'Số đo khách cho lưu'),
        h('span', {}, `${ct.so_do.chieu_cao} cm, ${ct.so_do.can_nang} kg `, h('button', { class: 'btn small', type: 'button', onclick: lam(() => api.del(`/khach/${u.id}/so-do`)) }, 'Xóa số đo'))),
    ],
    h('h3', {}, `Đơn hàng (${ct.don.length})`),
    ct.don.length ? ct.don.map((x) => h('a', { class: 'the-page', href: `#/don?id=${x.id}`, style: 'text-decoration:none;color:inherit' },
      h('div', { class: 'hang' }, h('b', {}, x.ma), chip(...(TEN_DON[x.trang_thai] || [x.trang_thai, 'mute'])), h('span', { class: 'grow' }), h('span', { class: 'num' }, tienVn(x.tong_tien))),
      h('span', { class: 'hint' }, gioPhut(x.tao_luc, true)))) : h('p', { class: 'muted' }, 'Chưa có đơn.'),
    h('h3', {}, 'Việc'),
    ct.viec.filter((v) => v.trang_thai === 'mo' && v.cho_ai === 'nguoi').length
      ? ct.viec.filter((v) => v.trang_thai === 'mo' && v.cho_ai === 'nguoi').map((v) => h('div', { class: 'hang' },
        h('span', { class: 'grow' }, v.noi_dung, v.han_luc ? h('span', { class: 'hint' }, ` · ${gioPhut(v.han_luc)}`) : ''),
        h('button', { class: 'btn small', type: 'button', onclick: lam(() => api.put(`/viec/${v.id}`, { trang_thai: 'xong' })) }, 'Xong')))
      : h('p', { class: 'muted' }, 'Không có việc đang mở.'),
    h('h3', {}, 'Bộ nhớ AI ghi'),
    ct.bo_nho.length ? ct.bo_nho.map((b) => h('div', { class: 'hang' },
      chip(b.loai === 'da_xac_nhan' ? 'Đã xác nhận' : b.loai === 'da_hua' ? 'Đã hứa' : 'Khách nói', 'mute'), h('span', { class: 'grow' }, b.noi_dung),
      h('button', { class: 'btn small', type: 'button', title: 'Bỏ dòng này', onclick: lam(() => api.del(`/bo-nho/${b.id}`)) }, 'Bỏ'))) : h('p', { class: 'muted' }, 'Chưa có.'),
  );
}
