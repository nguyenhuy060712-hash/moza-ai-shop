// Màn hình người dẫn — thẻ gợi ý của Mai (BH11, F-126 + F-115; tách từ nguoi-dan.js). Câu chữ to (Co-host soạn, đã qua Bộ kiểm tra),
// nguồn (thẻ món / tồn kho / Sổ tay — từ trích dẫn), nút [Mai nói] [Tự đọc] [Trả lời bình luận] [Bỏ]. Thẻ từ chạm bình luận (F-115) có
// binh_luan_id: "Tự đọc" đánh dấu đã trả lời, "Trả lời bình luận" đăng câu dưới bình luận đó (qua giới hạn liên hệ).
// Ba màu khác nhau: lời Mai (xanh), ghi chú cho Mai (cam đất), cảnh báo (vàng / đỏ — ở cột phải).

import { api } from '../api.js';
import { h, toast } from '../ui.js';

const DANG = { director: 'AI đang đọc bình luận…', cohost: 'Mai đang soạn câu trả lời…' };

/** Nguồn của câu theo trích dẫn: số món → "thẻ món số N", so_tay → Sổ tay, cai_dat → Cài đặt, nguoi_mau → người mẫu. */
export function tenNguon(trichDan = []) {
  const ten = new Set();
  for (const t of trichDan || []) {
    const n = String(t.nguon ?? '');
    if (/^\d+$/.test(n)) ten.add(/^Size /.test(t.doan || '') ? `bảng size số ${n}` : /còn|tồn/i.test(t.doan || '') ? `tồn kho số ${n}` : `thẻ món số ${n}`);
    else if (n === 'so_tay') ten.add('Sổ tay');
    else if (n === 'cai_dat') ten.add('Cài đặt bán hàng');
    else if (n === 'nguoi_mau') ten.add('người mẫu');
    else if (n) ten.add(n);
  }
  return [...ten];
}

/** @param {{st:object, p:object, aiTat:boolean, doiDan:() => boolean, maiDan:() => boolean}} ctx */
export function taoGoiY(ctx) {
  const { st, p } = ctx;
  const eNhan = h('span', { class: 'nd-nhan' });
  const eChu = h('p', { class: 'nd-goi-y-chu' });
  const eNguon = h('p', { class: 'nd-goi-y-nguon' });
  const eNut = h('div', { class: 'nutbam nd-goi-y-nut' });
  const eLoi = h('span', { class: 'nd-loi-hoi', role: 'alert' });
  const el = h('section', { class: 'nd-goi-y nd-sk-goi-y', 'aria-live': 'polite' }, eNhan, eChu, eNguon, eNut, eLoi);
  let chuaChac = null; // {binh_luan_id, cau, du_lieu} khi Bộ kiểm tra chặn câu của chạm bình luận
  let dangSoan = null; // tên người được chạm, đang chờ Mai soạn

  const dong = () => { st.ai.goi_y = null; chuaChac = null; ve(); };
  const nut = (chu, viec, lop = '') => h('button', { class: `btn ${lop}`, type: 'button', onclick: async (e) => {
    eLoi.textContent = '';
    const n = e.currentTarget;
    n.disabled = true;
    try { await viec(); } catch (x) { eLoi.textContent = x.message; } finally { n.disabled = false; }
  } }, chu);

  function ve() {
    const g = st.ai.goi_y;
    const dang = DANG[st.ai.dang];
    eNut.replaceChildren();
    if (chuaChac) {
      eNhan.textContent = 'Mai chưa chắc';
      eChu.className = 'nd-goi-y-chu chua-chac';
      eChu.textContent = chuaChac.cau;
      eNguon.textContent = chuaChac.du_lieu?.length ? `Dữ liệu liên quan: ${chuaChac.du_lieu.join(' · ')}` : 'Không có dữ liệu để Mai trả lời câu này.';
      eNut.append(nut('Đã trả lời', async () => { await api.post(`/live/phien/${p.id}/binh-luan/${chuaChac.binh_luan_id}/da-tra-loi`); dong(); }), nut('Bỏ', async () => dong(), 'ghost'));
      return;
    }
    eNhan.textContent = ctx.aiTat && !g ? 'AI đang tắt' : g?.loai === 'director' ? 'Director nhắc' : ctx.doiDan() && g ? 'Đội AI sẽ đọc câu này' : g?.binh_luan_id ? 'Mai soạn cho bình luận bạn chạm' : 'Gợi ý của Mai';
    if (!g) {
      eChu.className = 'nd-goi-y-chu mo';
      eChu.textContent = dangSoan ? `Mai đang soạn câu trả lời cho ${dangSoan}…` : ctx.aiTat ? 'Phiên này chọn "Tắt AI". Chạm bình luận hỏi size có số đo để MOZA tính size.' : dang || 'Chạm một bình luận ở cột phải để Mai soạn câu trả lời.';
      eNguon.textContent = '';
      return;
    }
    eChu.className = 'nd-goi-y-chu';
    eChu.textContent = g.noi_dung;
    const spGoiY = g.san_pham_id && st.phien.kich_ban.doan.find((d) => d.san_pham?.id === g.san_pham_id)?.san_pham;
    const nguon = tenNguon(g.trich_dan);
    eNguon.textContent = [nguon.length && `Nguồn: ${nguon.join(', ')}`, spGoiY && spGoiY.ten_goi, g.cau_hoi && `Câu hỏi: ${g.cau_hoi}`, dang].filter(Boolean).join(' · ');
    if (g.loai === 'director') { eNut.append(nut('Bỏ', async () => dong(), 'ghost')); return; }
    // append() in null thành chữ "null" — lọc trước.
    eNut.append(...[
      nut('🔊 Mai nói', async () => { await api.post(`/live/phien/${p.id}/goi-y/${g.id}/mai-noi`); toast('Mai đang nói câu này'); dong(); }, 'primary'),
      nut('Tự đọc', async () => { if (g.binh_luan_id) await api.post(`/live/phien/${p.id}/binh-luan/${g.binh_luan_id}/da-tra-loi`); dong(); }),
      g.binh_luan_id ? nut('💬 Trả lời bình luận', async () => { await api.post(`/live/phien/${p.id}/binh-luan/${g.binh_luan_id}/dang-tra-loi`); toast('Đã đăng trả lời dưới bình luận'); }) : null,
      nut('Bỏ', async () => dong(), 'ghost')].filter(Boolean));
  }

  return {
    el,
    ve,
    /** F-115: người dẫn vừa chạm một bình luận. */
    async cham(bl) {
      eLoi.textContent = '';
      chuaChac = null;
      dangSoan = bl.ten || 'bình luận này';
      st.ai.goi_y = null;
      ve();
      try {
        const kq = await api.post(`/live/phien/${p.id}/tra-loi-binh-luan`, { binh_luan_id: bl.id });
        if (kq.chua_chac) chuaChac = kq;
        else if (kq.goi_y) st.ai.goi_y = kq.goi_y;
      } catch (x) { eLoi.textContent = x.message; } finally { dangSoan = null; ve(); }
    },
    baoChuaChac(kq) { chuaChac = kq; ve(); },
  };
}
