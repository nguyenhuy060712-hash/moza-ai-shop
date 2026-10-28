// Màn hình người dẫn — khối "món đang bán" và "Tiếp theo" (BH11, F-126; tách từ nguoi-dan.js). Vùng 1: số món + tên, giá, lưới còn
// hàng màu × cỡ chữ to (vàng sắp hết, đỏ hết kèm chữ). Vùng 3: đoạn kế + nút ←/→. Lời nhắc đầy đủ của đoạn nằm trong ngăn kéo.
// Lời nhắc dạng "Người dẫn: … / Mai: …" (F-37) và kiểu Đội AI "[Tiết mục]" (F-45) tách như máy chủ (kich-ban.js tachLoiNhac).

import { api } from '../api.js';
import { h } from '../ui.js';
import { tien } from '../dinh-dang.js';

export function tachLoiNhac(loiNhac = '') {
  const phan = { nguoi_dan: [], mai: [] };
  let dang = 'nguoi_dan';
  for (const dong of String(loiNhac ?? '').split('\n')) {
    const m = /^\s*(người dẫn|nguoi dan|mai)\s*:\s*(.*)$/iu.exec(dong);
    if (m) {
      dang = /^mai$/iu.test(m[1].trim()) ? 'mai' : 'nguoi_dan';
      if (m[2].trim()) phan[dang].push(m[2].trim());
    } else if (dong.trim()) phan[dang].push(dong.trim());
  }
  return { nguoiDan: phan.nguoi_dan.join('\n'), mai: phan.mai.join(' ') };
}

export const laThoaiDoi = (loiNhac = '') => /^\[[^\]]+\]$/u.test(String(loiNhac).split('\n').map((x) => x.trim()).find(Boolean) || '');
export const chuDoc = (s) => s.replace(/<[^>]+>\s*/g, '').replace(/\|([^|]+)\|/g, '($1)').trim();

// Mỗi lượt Đội AI một dòng, tên in đậm; bỏ gợi ý cách nói và thẻ tiếng (<chuckle>…) cho người dẫn dễ đọc.
export function veThoaiDoi(loiNhac) {
  return String(loiNhac).split('\n').map((x) => x.trim()).filter(Boolean).map((dong) => {
    let m;
    if ((m = /^\[Chờ bình luận (\d+) giây\]$/iu.exec(dong))) return h('p', { class: 'nd-doi-cho' }, `⏳ Chờ người xem bình luận đáp án ${m[1]} giây`);
    if (/^\[\s*Bài hát\s*\]$/iu.test(dong)) return h('p', { class: 'nd-doi-cho' }, '♪ Đọc lời chúc của người xem → phát một bài hát → báo giờ');
    if ((m = /^\[(.+)\]$/u.exec(dong))) return h('p', { class: 'nd-doi-tiet-muc' }, m[1]);
    if (/^-?\s*Kiểm lại/iu.test(dong)) return h('p', {}, h('span', { class: 'nd-kiem-lai', title: 'Ghi chú riêng cho người dẫn, không đọc lên sóng' }, dong));
    if ((m = /^Đáp án\s*:\s*(.*)$/iu.exec(dong))) return h('p', { class: 'nd-doi-dap-an' }, `Đáp án: ${m[1]}`);
    if ((m = /^(người dẫn|nguoi dan)\s*:\s*(.*)$/iu.exec(dong))) return h('p', { class: 'nd-nhac' }, h('b', {}, 'Bạn: '), m[2]);
    if ((m = /^([\p{L}]+(?: [\p{L}]+)?)\s*:\s*(?:\([^)]*\)\s*)?(.*)$/u.exec(dong))) return h('p', { class: 'nd-doi-luot' }, h('b', {}, `${m[1]}: `), chuDoc(m[2]));
    return h('p', { class: 'nd-doi-luot' }, chuDoc(dong));
  });
}

/** Lời nhắc của một đoạn: phần người dẫn (ý "Kiểm lại…" tô màu riêng — không đọc lên sóng), phần "Mai:", hoặc thoại Đội AI. */
export function veLoiNhac(d) {
  if (laThoaiDoi(d.loi_nhac)) return [h('div', { class: 'nd-doi-thoai' }, ...veThoaiDoi(d.loi_nhac))];
  const ln = tachLoiNhac(d.loi_nhac);
  return [
    ln.nguoiDan && h('p', { class: 'nd-nhac' }, ...ln.nguoiDan.split('\n').flatMap((dong, j) => [j ? '\n' : '',
      /^-?\s*Kiểm lại/iu.test(dong) ? h('span', { class: 'nd-kiem-lai', title: 'Ghi chú riêng cho người dẫn, không đọc lên sóng' }, dong) : dong]).filter(Boolean)),
    ln.mai && h('p', { class: 'nd-nhac-mai' }, h('b', {}, 'Ghi chú cho Mai: '), ln.mai),
  ].filter(Boolean);
}

/**
 * @param {{st:object, nhanDan:() => string, doiDoan:(buoc:number) => void, khiHetHang:(chu:string|null) => void}} ctx
 *   nhanDan: "Đang nói" / "Mai đang dẫn" / "Đội AI đang dẫn"; khiHetHang: món đang bán hết sạch → cảnh báo nguy cấp.
 */
export function taoMon(ctx) {
  const { st } = ctx;
  const eMon = h('section', { class: 'nd-sk-mon', 'aria-live': 'polite' });
  const eKe = h('section', { class: 'nd-sk-ke' });
  const eLoiNhac = h('div', { class: 'nd-ngan-loi-nhac' });
  st.tonTheoSp = st.tonTheoSp || {};

  async function taiTon(id) {
    try {
      const kq = await api.get(`/kho?san_pham_id=${encodeURIComponent(id)}`);
      st.tonTheoSp[id] = kq.phan_loai;
      st.nguongSapHet = st.nguongSapHet ?? (await api.get('/cai-dat/ban-hang').catch(() => ({ ban_hang: { nguong_sap_het: 3 } }))).ban_hang?.nguong_sap_het ?? 3;
      veDoan();
    } catch { /* không có mạng lúc live: giữ số cũ */ }
  }

  /** Lưới còn hàng: mỗi ô "Đen/M 4"; sắp hết vàng, hết đỏ + chữ "hết" (không chỉ dựa vào màu). */
  function luoiTon(x) {
    const ds = st.tonTheoSp[x.id];
    if (!ds) { taiTon(x.id); return h('p', { class: 'muted' }, 'Đang đọc tồn kho…'); }
    const nguong = st.nguongSapHet ?? 3;
    const het = ds.length && ds.every((p) => p.con_ban_duoc <= 0);
    ctx.khiHetHang?.(het ? `Số ${x.so} đã HẾT HÀNG mọi màu, cỡ — chuyển món hoặc nhận chờ hàng.` : null);
    // Nhiều màu × cỡ thì chữ nhỏ dần để vẫn vừa vùng 1 (không cuộn).
    return h('div', { class: `nd-sk-ton${ds.length > 12 ? ' rat-nhieu' : ds.length > 6 ? ' nhieu' : ''}` }, ds.map((p) => {
      const loai = p.con_ban_duoc <= 0 ? 'het' : p.con_ban_duoc <= nguong ? 'it' : '';
      return h('span', { class: `nd-sk-ton-o ${loai}`, title: p.con_ban_duoc <= 0 ? 'Hết hàng' : `Còn bán được ${p.con_ban_duoc}` },
        `${p.gt1}${p.gt2 ? `/${p.gt2}` : ''} `, h('b', {}, p.con_ban_duoc <= 0 ? 'hết' : String(p.con_ban_duoc)));
    }));
  }

  function veDoan() {
    const ds = st.phien.kich_ban.doan;
    const i = st.phien.doan_hien_tai;
    const d = ds[i];
    const ke = ds[i + 1];
    const x = d.san_pham;
    const nhan = h('span', { class: 'nd-nhan' }, `${ctx.nhanDan()} · đoạn ${i + 1}/${ds.length}`);
    if (x) {
      eMon.replaceChildren(nhan,
        h('div', { class: 'nd-sk-mon-dau' },
          x.anh_dai_dien ? h('img', { class: 'nd-sk-anh', src: `/api/anh/${x.id}/${x.anh_dai_dien}`, alt: '' }) : null,
          h('span', { class: 'nd-sk-so' }, `Số ${x.so}`),
          h('span', { class: 'nd-sk-gia' }, tien(x.gia))),
        h('p', { class: 'nd-sk-ten' }, x.ten),
        luoiTon(x));
    } else {
      ctx.khiHetHang?.(null);
      eMon.replaceChildren(nhan, h('p', { class: 'nd-sk-ten' }, 'Đoạn chung'), h('div', { class: 'nd-sk-loi-nhac' }, ...veLoiNhac(d)));
    }
    eLoiNhac.replaceChildren(h('span', { class: 'nd-nhan' }, `Lời nhắc đoạn ${i + 1}`), ...(veLoiNhac(d).length ? veLoiNhac(d) : [h('p', { class: 'muted' }, 'Đoạn này không có lời nhắc.')]));
    let chuKe = 'Hết kịch bản';
    if (ke) {
      const lnKe = tachLoiNhac(ke.loi_nhac);
      chuKe = ke.san_pham ? `${ke.san_pham.ten_day_du} · ${tien(ke.san_pham.gia)}`
        : laThoaiDoi(ke.loi_nhac) ? `Đoạn chung · ${ke.loi_nhac.trim().split('\n')[0].slice(1, -1)}`
          : (lnKe.nguoiDan.split('\n')[0].replace(/^-\s*/, '') || lnKe.mai || 'Đoạn chung');
    }
    eKe.replaceChildren(
      h('button', { class: 'btn nd-sk-mui', type: 'button', title: 'Đoạn trước (←)', disabled: i <= 0, onclick: () => ctx.doiDoan(-1) }, '←'),
      h('div', { class: 'nd-sk-ke-chu' }, h('span', { class: 'nd-nhan' }, 'Tiếp theo'), h('p', {}, chuKe)),
      h('button', { class: 'btn nd-sk-mui', type: 'button', title: 'Đoạn sau (→)', disabled: !ke, onclick: () => ctx.doiDoan(1) }, '→'));
  }

  return { eMon, eKe, eLoiNhac, veDoan, taiTon };
}
