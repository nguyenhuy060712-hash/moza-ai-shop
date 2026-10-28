// Livestream (SPEC.md mục 8): Phiên live · Kịch bản · Phòng diễn tập.
// Kịch bản cố ý đơn giản: tên + các đoạn, mỗi đoạn chỉ sản phẩm và lời nhắc (#31, F-37).

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam, hoi } from '../ui.js';
import { chipSp } from './san-pham.js';
import { veBatDau, veKiemTra, chep, tenDoan } from './bat-dau-live.js';
import { chipTrangThai, thongTin } from '../trang-thai.js';
import { tien, usdVnd } from '../dinh-dang.js';

const TAB = [
  { id: 'phien', ten: 'Phiên live' },
  { id: 'kich-ban', ten: 'Kịch bản' },
  { id: 'dien-tap', ten: 'Phòng diễn tập' },
];

let nghe = null;
let kb = null; // trạng thái trình soạn kịch bản, để hỏi trước khi rời khi đang sửa dở

export function roi() {
  if (nghe) window.removeEventListener('moza:ws', nghe);
  nghe = null;
}

export function coThayDoi() {
  return !!kb?.form && JSON.stringify(kb.form) !== JSON.stringify(kb.goc);
}

function ngheWs(fn) {
  roi();
  nghe = (e) => fn(e.detail);
  window.addEventListener('moza:ws', nghe);
}

export async function ve(khung) {
  kb = null;
  const tab = location.hash.split('/')[2] || 'phien';
  const noiDung = h('div', { class: 'view' });
  khung.replaceChildren(
    h('div', { class: 'viewbar' },
      h('h1', {}, 'Livestream'),
      h('nav', { class: 'chon', 'aria-label': 'Phần của Livestream' }, TAB.map((t) => h('a', {
        href: `#/live/${t.id}`, class: 'tab-link', 'aria-current': t.id === tab ? 'page' : null,
      }, t.ten)))),
    noiDung,
  );
  if (tab === 'kich-ban') return veKichBan(noiDung);
  if (tab === 'dien-tap') return veDienTap(noiDung);
  return vePhien(noiDung);
}

/* ================= Phiên live ================= */

// Sự kiện làm đổi khung Phiên live. Không vẽ lại theo mọi sự kiện: nút Kiểm tra micro đang chạy sẽ bị cắt ngang.
const VE_LAI_PHIEN = ['live.trang_thai', 'live.bat_dau', 'live.ket_thuc', 'live.doan', 'live.nhieu_live'];

async function vePhien(khung) {
  const [{ phien, dem, nhieu_live: nhieuLive = [] }, { kich_ban: dsKb }, { phien: lichSu }] = await Promise.all([
    api.get('/live/phien/hien-tai'), api.get('/kich-ban'), api.get('/live/phien'),
  ]);
  ngheWs((m) => {
    if (VE_LAI_PHIEN.includes(m.type)) vePhien(khung);
  });

  let chinh;
  if (!phien) chinh = [veBatDau(khung, dsKb, () => vePhien(khung)), veBaoTruoc(dsKb)];
  else if (phien.trang_thai === 'cho_live') {
    const huy = h('button', { class: 'btn', type: 'button' }, 'Hủy phiên');
    huy.addEventListener('click', () => ketThuc(huy, phien.id, () => vePhien(khung)));
    chinh = h('section', { class: 'panel' },
      h('header', {}, h('h2', {}, phien.ten), h('span', { class: 'chip warn' }, 'Đang chờ live')),
      h('div', { class: 'body' },
        nhieuLive.length > 1 ? veChonLive(phien, nhieuLive, () => vePhien(khung)) : [
          h('p', { class: 'lon' }, 'Đang chờ live bắt đầu trên Page…'),
          phien.dien_tap
            ? h('p', { class: 'muted' }, 'Đây là phiên diễn tập trên Facebook giả. Mở Phòng diễn tập và bấm "Bắt đầu live giả": '
              + 'MOZA sẽ tự nhận ra live, gắn vào phiên và mở Màn hình người dẫn.')
            : h('p', { class: 'muted' }, 'Phiên live thật. Mở ứng dụng Facebook trên điện thoại, chọn phát trực tiếp dưới tên Page: '
              + 'MOZA tự nhận ra live (thường trong vài giây, chậm nhất khoảng 15 giây), gắn vào phiên và mở Màn hình người dẫn.'),
        ],
        h('div', { class: 'nutbam' }, phien.dien_tap && h('a', { class: 'btn primary', href: '#/live/dien-tap' }, 'Mở Phòng diễn tập'), huy)));
    chinh = [chinh, veGiaLive(phien), veKiemTra()];
  } else {
    const ket = h('button', { class: 'btn danger', type: 'button' }, 'Kết thúc phiên');
    ket.addEventListener('click', async () => {
      if (await hoi({ tieuDe: 'Kết thúc phiên live này?', noiDung: 'Buổi live dừng lại và phiên được lưu vào lịch sử.', nhan: 'Kết thúc', nguyHiem: true })) ketThuc(ket, phien.id, () => vePhien(khung));
    });
    const d = phien.kich_ban.doan[phien.doan_hien_tai];
    chinh = h('section', { class: 'panel' },
      h('header', {}, h('h2', {}, phien.ten), h('span', { class: 'chip bad' }, '● Đang live')),
      h('div', { class: 'body' },
        h('p', {}, `Bắt đầu lúc ${gioPhut(phien.bat_dau)} · ${dem.tong} bình luận (${dem.cau_hoi} câu hỏi)`),
        h('p', {}, h('b', {}, `Đoạn ${phien.doan_hien_tai + 1}/${phien.kich_ban.doan.length}: `), tenDoan(d)),
        h('div', { class: 'nutbam' }, h('a', { class: 'btn primary', href: '#/nguoi-dan' }, 'Mở Màn hình người dẫn'), ket)));
  }

  khung.replaceChildren(...[chinh].flat(), veLichSu(lichSu.filter((p) => p.trang_thai === 'xong')));
}

/**
 * F-96: "Báo trước buổi live" — buổi kế theo lịch, AI soạn bộ bài (Sự kiện live, bài nhá hàng, 3 câu Reels) từ kịch bản; mỗi phần có
 * nút Chép; ảnh ghép 2×2 từ ảnh 4 món (vẽ trên trình duyệt, tải về). MOZA không đăng bài.
 */
function veBaoTruoc(dsKb) {
  const vung = h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Báo trước buổi live')), h('div', { class: 'body' }, h('p', { class: 'muted' }, 'Đang đọc lịch…')));
  const than = vung.querySelector('.body');
  const chep = (chu) => { navigator.clipboard.writeText(chu).then(() => toast('Đã chép'), () => prompt('Chép:', chu)); };
  const dong = (nhan, chu) => h('div', { class: 'bai-dong' }, h('b', {}, nhan), h('p', { class: 'xuong-dong' }, chu), h('button', { class: 'btn small', type: 'button', onclick: () => chep(chu) }, 'Chép'));
  const anhGhep = async (mon) => {
    const ds = mon.filter((m) => m.anh).slice(0, 4);
    if (!ds.length) return null;
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1080;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1080, 1080);
    await Promise.all(ds.map((m, i) => new Promise((xong) => {
      const im = new Image();
      im.onload = () => { const x = (i % 2) * 540; const y = Math.floor(i / 2) * 540; const r = Math.max(540 / im.width, 540 / im.height);
        g.drawImage(im, x + (540 - im.width * r) / 2, y + (540 - im.height * r) / 2, im.width * r, im.height * r);
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, y + 470, 540, 70); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.fillText(`Số ${m.so} · ${m.ten}`.slice(0, 28), x + 20, y + 518); xong(); };
      im.onerror = () => xong();
      im.src = m.anh;
    })));
    const a = h('a', { class: 'btn small', download: 'bao-truoc-live.png', href: cv.toDataURL('image/png') }, 'Tải ảnh ghép 2×2');
    cv.style.cssText = 'width:260px;height:260px;border-radius:8px;display:block;margin:6px 0';
    return h('div', {}, cv, a);
  };
  (async () => {
    let ll;
    try { ll = await api.get('/lich-live'); } catch { ll = { buoi_ke: null }; }
    if (!ll.buoi_ke) { than.replaceChildren(h('p', {}, 'Chọn lịch live trong ', h('a', { href: '#/cai-dat' }, 'Cài đặt → Lịch live'), ' để soạn bài báo trước.')); return; }
    const oKb = h('select', { 'aria-label': 'Kịch bản' }, (dsKb || []).map((k, i) => h('option', { value: k.id, selected: i === 0 }, k.ten)));
    const nut = h('button', { class: 'btn small primary', type: 'button' }, '✨ AI soạn');
    const nutMoi = h('button', { class: 'btn small', type: 'button' }, 'Chép lời mời + link (nhóm Zalo)');
    const kq = h('div', {});
    nutMoi.addEventListener('click', async () => { try { chep((await api.get('/lich-live/loi-moi')).chu); } catch (e) { toast(e.message, true); } });
    nut.addEventListener('click', async () => {
      try {
        const r = await dangLam(nut, 'AI đang soạn…', () => api.post('/lich-live/soan-bai', { kich_ban_id: oKb.value || null }));
        kq.replaceChildren(
          r.su_kien ? dong('Sự kiện live', `${r.su_kien.tieu_de}\n${r.su_kien.mo_ta}`) : null,
          r.bai_nha_hang ? dong('Bài nhá hàng', r.bai_nha_hang) : null,
          ...r.reels.map((x, i) => dong(`Reels ${i + 1}`, x)),
          r.kiem_lai.length ? h('p', { class: 'loi' }, `Kiểm lại: ${r.kiem_lai.join(' · ')}`) : null,
          await anhGhep(r.mon),
          h('p', { class: 'hint' }, r.nhac_quang_cao),
          h('p', { class: 'hint' }, 'MOZA không đăng bài — bạn chép, xem lại rồi tự đăng lên Page.'));
      } catch (e) { toast(e.message, true); }
    });
    const dy = ll.dong_y?.dong_y ? ` · ${ll.dong_y.dong_y} người đã đồng ý nhận tin báo buổi này` : '';
    than.replaceChildren(h('p', {}, `Buổi kế: ${ll.buoi_ke.chu}${dy}.`), h('div', { class: 'hang' }, oKb, nut, nutMoi), kq);
  })();
  return vung;
}

/** Page có từ 2 live cùng lúc: MOZA không đoán, hỏi người dùng chọn (F-19). */
function veChonLive(phien, ds, sau) {
  return [
    h('p', { class: 'lon' }, `Page đang có ${ds.length} live cùng lúc. Gắn live nào vào phiên này?`),
    h('div', { class: 'ds' }, ds.map((l) => {
      const nut = h('button', { class: 'btn small primary', type: 'button' }, 'Chọn live này');
      nut.addEventListener('click', async () => {
        try {
          await dangLam(nut, 'Đang gắn…', () => api.post(`/live/phien/${phien.id}/chon-live`, { fb_live_video_id: l.id }));
          sau();
        } catch (e) { toast(e.message, true); }
      });
      return h('div', { class: 'ds-hang' }, h('span', { class: 'dong1' }, h('b', { class: 'grow' }, l.tieu_de), nut),
        h('span', { class: 'dong3' }, `Bắt đầu lúc ${gioPhut(l.bat_dau)}`));
    })),
  ];
}

/**
 * Bảng "Sẵn sàng lên sóng" (F-77, thay khung "Kiểm tra trước khi live"): chỉ hiện dòng đỏ / vàng máy tự kiểm thấy lỗi (kèm cách
 * sửa); không còn dòng nào → "Sẵn sàng". 3 ô tự tích theo buổi, phép thử "chốt test", câu ghim và câu mô tả có nút Chép.
 * Không khóa nút Bắt đầu. Phần thử micro, loa, AI giữ ở dưới.
 */
/**
 * F-93: "Giá live tới hết buổi" từng món (chỉ khi công tắc Cài đặt → Bán hàng → Giá live bật). Chọn [Không] [−5%] [−10%] [−15%]
 * (MOZA tính sẵn, làm tròn xuống 1.000đ) hoặc gõ số. Khóa khi live bắt đầu.
 */
function veGiaLive(phien) {
  const vung = h('section', { class: 'panel', hidden: true });
  const ve = async () => {
    let kq;
    try { kq = await api.get(`/live/phien/${phien.id}/gia-live`); } catch { return; }
    vung.hidden = !kq.bat || !kq.ds.length;
    if (vung.hidden) return;
    vung.replaceChildren(h('header', {}, h('h2', {}, 'Giá live (tới hết buổi)')),
      h('div', { class: 'body' },
        h('p', { class: 'hint canh-bao' }, '⚠ Nhờ luật sư xem trước; dùng thưa; không nói "chỉ hôm nay". Giá live áp cho bình luận chốt gửi trong lúc live, khóa khi live bắt đầu.'),
        ...kq.ds.map((x) => {
          const chon = h('select', { 'aria-label': `Giá live số ${x.so}` },
            h('option', { value: '', selected: x.gia_live == null }, 'Không'),
            ...x.goi_y.map((g) => h('option', { value: `muc:${g.muc}`, selected: x.gia_live === g.gia }, `−${g.muc}% · ${tien(g.gia)}`)),
            x.gia_live != null && !x.goi_y.some((g) => g.gia === x.gia_live) ? h('option', { value: `gia:${x.gia_live}`, selected: true }, tien(x.gia_live)) : null,
            h('option', { value: 'go' }, 'Gõ số…'));
          chon.addEventListener('change', async () => {
            let body = { san_pham_id: x.san_pham_id, gia: null };
            if (chon.value.startsWith('muc:')) body = { san_pham_id: x.san_pham_id, muc: Number(chon.value.slice(4)) };
            else if (chon.value === 'go') {
              const g = prompt(`Giá live số ${x.so} (nhỏ hơn ${tien(x.gia)}), ví dụ 259k:`);
              if (!g) { ve(); return; }
              body = { san_pham_id: x.san_pham_id, gia: g };
            } else if (chon.value.startsWith('gia:')) return;
            try { await api.put(`/live/phien/${phien.id}/gia-live`, body); toast('Đã lưu giá live'); } catch (e) { toast(e.message, true); }
            ve();
          });
          return h('div', { class: 'hang' }, h('span', { class: 'grow' }, `Số ${x.so} · ${x.ten} · giá ${tien(x.gia)}`), chon);
        })));
  };
  ve();
  return vung;
}

async function ketThuc(nut, id, sau) {
  try {
    await dangLam(nut, 'Đang kết thúc…', () => api.post(`/live/phien/${id}/ket-thuc`));
    toast('Đã kết thúc phiên');
    sau();
  } catch (e) { toast(e.message, true); }
}

function veLichSu(ds) {
  return h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Các phiên gần đây')),
    ds.length
      ? h('div', { class: 'ds' }, ds.map((p) => h('div', { class: 'ds-hang' },
        h('span', { class: 'dong1' }, h('b', {}, p.ten), chipTrangThai('phien', p.trang_thai)),
        h('span', { class: 'dong2' }, p.tom_tat || ''),
        h('span', { class: 'dong3' }, `Kịch bản: ${p.kich_ban.ten}`))))
      : h('div', { class: 'empty' }, 'Chưa có phiên nào'));
}

/* ================= Kịch bản ================= */

async function veKichBan(khung) {
  const [{ kich_ban: ds }, { san_pham: tatCaSp }] = await Promise.all([api.get('/kich-ban'), api.get('/san-pham')]);
  kb = { ds, sp: tatCaSp, chon: null, form: null, goc: null };
  const danhSach = h('div', { class: 'ds' });
  const phai = h('section', { class: 'panel' });

  const nutNhanh = h('button', { class: 'btn', type: 'button' }, 'Tạo nhanh từ các sản phẩm Đang bán');
  nutNhanh.addEventListener('click', async () => {
    if (coThayDoi() && !confirm('Kịch bản đang sửa dở chưa lưu. Bỏ phần đang sửa?')) return;
    try {
      const { kich_ban: moi } = await dangLam(nutNhanh, 'Đang tạo…', () => api.post('/kich-ban/tao-nhanh'));
      toast(`Đã tạo "${moi.ten}"`);
      kb.form = null;
      await tai();
      chon(moi.id);
    } catch (e) { toast(e.message, true); }
  });

  // AI soạn kịch bản (bản 2.5, F-37): mỗi đoạn có "Người dẫn: …" (ý chính để nói) và "Mai: …" (câu Mai nói).
  // Bản 2.9 (F-45): kiểu "Đội AI dẫn" — thoại của cả đội nhân vật AI như talk show.
  const soanAi = (nut, kieu) => nut.addEventListener('click', async () => {
    if (coThayDoi() && !confirm('Kịch bản đang sửa dở chưa lưu. Bỏ phần đang sửa?')) return;
    try {
      const { kich_ban: moi } = await dangLam(nut, 'AI đang soạn (khoảng 1 phút)…', () => api.post('/kich-ban/soan-ai', { kieu }));
      toast(`Đã soạn "${moi.ten}" — ${moi.doan.length} đoạn. Đọc lại, sửa chỗ nào chưa ưng rồi Lưu.${kieu !== 'mai' ? ' Bấm ▶ Nghe ở từng đoạn để nghe đội AI đọc.' : ''}`);
      kb.form = null;
      await tai();
      chon(moi.id);
    } catch (e) { toast(e.message, true); }
  });
  const nutAi = h('button', { class: 'btn primary', type: 'button', title: 'AI viết lời dẫn cho từng sản phẩm và câu Mai nói, giá lấy đúng từ thẻ sản phẩm' }, '✨ AI soạn kịch bản');
  soanAi(nutAi, 'mai');
  const nutAiDoi = h('button', { class: 'btn primary', type: 'button', title: 'AI viết thoại cho cả đội AI (nhiều giọng nam nữ) như talk show: hỏi đáp, đối đáp, cười đùa' }, '✨ AI soạn cho Đội AI dẫn');
  soanAi(nutAiDoi, 'doi');
  // #74, F-49: Radio của shop — đội AI dẫn kiểu đài phát thanh, có lời chúc và bài hát.
  const nutAiRadio = h('button', { class: 'btn primary', type: 'button', title: 'Đội AI dẫn kiểu đài phát thanh: báo giờ, điểm tin hàng mới, hỏi đáp size ship, góc phối đồ, lời chúc và bài hát xen giữa' }, '✨ AI soạn Radio');
  soanAi(nutAiRadio, 'radio');

  // Tiến độ "Làm sẵn tiếng cả kịch bản" (bản 2.9, F-45) báo qua /ws.
  ngheWs((m) => {
    if (m.type !== 'doi_ai.lam_tieng' || !kb?.eLamSan || m.kich_ban_id !== kb.chon) return;
    if (m.trang_thai === 'dang_lam') {
      kb.eLamSan.textContent = `Đang làm tiếng đoạn ${m.doan + 1}/${m.tong}…`;
      return;
    }
    const phut = Math.floor(m.giay / 60);
    kb.eLamSan.textContent = `Xong: ${phut ? `${phut} phút ` : ''}${m.giay % 60} giây tiếng; làm mới ${m.lam_moi} phần, dùng lại ${m.dung_lai} phần; `
      + `${usdVnd(m.chi_phi_usd)}.${m.loi?.length ? ` Lỗi ${m.loi.length} đoạn: ${m.loi[0].thong_diep}` : ''}`;
    taiCoSan().then(veSoan).catch(() => {});
  });

  khung.replaceChildren(
    h('div', { class: 'viewbar' },
      h('p', { class: 'hint grow' }, 'Kịch bản là thứ tự các đoạn bạn sẽ nói. Mỗi đoạn chọn sản phẩm (hoặc để trống cho đoạn chung) và ghi lời nhắc. '
        + 'Trong lời nhắc, dòng "Mai: …" là câu Mai nói khi bạn chuyển tới đoạn đó; phần còn lại là ý chính cho bạn. '
        + 'Kịch bản Đội AI dẫn: mỗi dòng "Tên: (cách nói) lời" là một lượt nói của nhân vật AI. '
        + 'Kịch bản Radio: dòng "[Bài hát]" là chỗ đội đọc lời chúc của người xem rồi phát một bài hát.'),
      nutAi,
      nutAiDoi,
      nutAiRadio,
      nutNhanh,
      h('button', { class: 'btn primary', type: 'button', onclick: () => chon('moi') }, '+ Kịch bản mới')),
    h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, danhSach), phai),
  );

  async function tai() {
    kb.ds = (await api.get('/kich-ban')).kich_ban;
    veDs();
  }

  function veDs() {
    if (!kb.ds.length) {
      danhSach.replaceChildren(h('div', { class: 'empty' }, 'Chưa có kịch bản nào.'));
      return;
    }
    danhSach.replaceChildren(...kb.ds.map((k) => h('button', {
      type: 'button', 'aria-current': String(kb.chon === k.id), onclick: () => chon(k.id),
    },
    h('span', { class: 'dong1' }, h('b', {}, k.ten)),
    h('span', { class: 'dong2' }, k.doan.map((d) => (d.san_pham ? `Số ${d.san_pham.so}` : 'Đoạn chung')).join(' → ')),
    h('span', { class: 'dong3' }, `${k.doan.length} đoạn · sửa ${gioPhut(k.sua_luc)}`))));
  }

  function chon(id) {
    if (kb.form && id !== kb.chon && coThayDoi() && !confirm('Kịch bản đang sửa dở chưa lưu. Bỏ phần đang sửa?')) return;
    kb.chon = id;
    const k = kb.ds.find((x) => x.id === id);
    kb.goc = id === 'moi'
      ? { ten: '', doan: [{ san_pham_id: null, loi_nhac: 'Mở đầu: chào cả nhà, giới thiệu shop và cách chốt đơn.' }] }
      : { ten: k.ten, doan: k.doan.map((d) => ({ san_pham_id: d.san_pham_id, loi_nhac: d.loi_nhac })) };
    kb.form = structuredClone(kb.goc);
    kb.coSan = null;
    veDs();
    veSoan();
    // Đoạn nào là thoại của đội AI, đã có tiếng sẵn chưa (bản 2.9, F-45): hiện nút ▶ Nghe, Làm sẵn tiếng.
    taiCoSan().then(() => { if (kb?.chon === id && kb.coSan?.la_thoai?.some(Boolean)) veSoan(); }).catch(() => {});
  }

  async function taiCoSan() {
    if (!kb?.chon || kb.chon === 'moi') return;
    kb.coSan = await api.get(`/doi-ai/co-san?kich_ban_id=${encodeURIComponent(kb.chon)}`);
  }

  // Nghe đội AI đọc một đoạn: làm tiếng nếu chưa có (Google, vài trăm đồng), rồi phát lần lượt các phần.
  let tiengDangPhat = null;
  async function ngheDoan(nut, i) {
    if (coThayDoi()) return toast('Lưu kịch bản trước rồi mới nghe (đội AI đọc bản đã lưu).', true);
    try {
      const kq = await dangLam(nut, 'Đang làm tiếng…', () => api.post('/doi-ai/tieng', { kich_ban_id: kb.chon, doan: i }));
      if (kq.bo_cau?.length) toast(`Bỏ ${kq.bo_cau.length} câu vì có số không thấy trong thẻ sản phẩm: ${kq.bo_cau.map((b) => b.so.join(', ')).join('; ')}`, true);
      if (kb.coSan) kb.coSan.co_san[i] = true;
      for (const p of kq.phan) {
        const r = await fetch(`/api/doi-ai/tieng/${p.id}`);
        if (!r.ok) throw new Error('Không tải được tiếng của đoạn này.');
        if (tiengDangPhat) tiengDangPhat.pause();
        tiengDangPhat = new Audio(URL.createObjectURL(await r.blob()));
        await tiengDangPhat.play();
        await new Promise((ok) => { tiengDangPhat.onended = ok; tiengDangPhat.onpause = ok; });
        if (kq.cho && p !== kq.phan.at(-1)) await new Promise((ok) => setTimeout(ok, 1500)); // chỗ chờ đố vui: nghỉ ngắn khi nghe thử
      }
    } catch (e) { toast(e.message, true); }
  }

  function veSoan() {
    if (!kb.form) {
      phai.replaceChildren(h('div', { class: 'empty' }, 'Chọn một kịch bản bên trái để sửa, hoặc tạo kịch bản mới.'));
      return;
    }
    const moi = kb.chon === 'moi';
    const loi = h('p', { class: 'loi', role: 'alert' });
    const oTen = h('input', { type: 'text', value: kb.form.ten, maxlength: 100, placeholder: 'VD: Live sáng thứ 2' });
    oTen.addEventListener('input', () => { kb.form.ten = oTen.value; });

    const dangBan = kb.sp.filter((t) => t.trang_thai === 'dang_ban');
    const dsDoan = h('ol', { class: 'doan-soan' });
    const veDoan = () => dsDoan.replaceChildren(...kb.form.doan.map((d, i) => {
      const tinDaChon = kb.sp.find((t) => t.id === d.san_pham_id);
      const luaChon = [...dangBan];
      if (tinDaChon && tinDaChon.trang_thai !== 'dang_ban') luaChon.push(tinDaChon);
      const oTin = h('select', { 'aria-label': `Sản phẩm đoạn ${i + 1}` },
        h('option', { value: '' }, '— Đoạn chung (không gắn sản phẩm) —'),
        luaChon.map((t) => h('option', { value: t.id, selected: t.id === d.san_pham_id },
          `${t.ten_day_du}${t.trang_thai !== 'dang_ban' ? ' (không Đang bán)' : ''}`)));
      oTin.value = d.san_pham_id || '';
      oTin.addEventListener('change', () => { d.san_pham_id = oTin.value || null; veDoan(); });
      // Thoại của đội AI nhiều dòng (bản 2.9): ô cao theo số dòng, tối đa 12.
      const oNhac = h('textarea', { rows: Math.min(12, Math.max(2, (d.loi_nhac.match(/\n/g) || []).length + 1)), maxlength: 4000, placeholder: d.san_pham_id ? 'Lời nhắc (không bắt buộc)' : 'Lời nhắc: đoạn này nói gì' });
      oNhac.value = d.loi_nhac;
      oNhac.addEventListener('input', () => { d.loi_nhac = oNhac.value; });
      const doi = (tu, den) => { const [x] = kb.form.doan.splice(tu, 1); kb.form.doan.splice(den, 0, x); veDoan(); };
      const laThoai = !moi && !!kb.coSan?.la_thoai?.[i];
      const nutNghe = laThoai && h('button', { class: 'btn small', type: 'button',
        title: kb.coSan.co_san[i] ? 'Nghe đội AI đọc đoạn này (đã có tiếng sẵn)' : 'Nghe đội AI đọc đoạn này (làm tiếng khoảng 10–30 giây, tốn vài trăm đồng)' },
      kb.coSan.co_san[i] ? '▶ Nghe ✓' : '▶ Nghe');
      if (nutNghe) nutNghe.addEventListener('click', () => ngheDoan(nutNghe, i));
      return h('li', {},
        h('span', { class: 'so' }, String(i + 1)),
        h('div', { class: 'doan-o' }, oTin, oNhac,
          tinDaChon && tinDaChon.trang_thai !== 'dang_ban' && h('p', { class: 'canh' }, `${tinDaChon.ten_day_du} không "Đang bán": không bắt đầu live được với đoạn này.`)),
        h('div', { class: 'doan-nut' }, nutNghe,
          h('button', { class: 'btn small', type: 'button', title: 'Lên', disabled: i === 0, onclick: () => doi(i, i - 1) }, '↑'),
          h('button', { class: 'btn small', type: 'button', title: 'Xuống', disabled: i === kb.form.doan.length - 1, onclick: () => doi(i, i + 1) }, '↓'),
          h('button', { class: 'btn small danger', type: 'button', title: 'Xóa đoạn', disabled: kb.form.doan.length === 1,
            onclick: () => { kb.form.doan.splice(i, 1); veDoan(); } }, '✕')));
    }));
    veDoan();

    const nutLuu = h('button', { class: 'btn primary', type: 'submit' }, moi ? 'Tạo kịch bản' : 'Lưu');
    // Làm sẵn tiếng cả kịch bản Đội AI dẫn (bản 2.9, F-45): chạy nền, tiến độ hiện ở dòng dưới.
    const coThoai = !moi && kb.coSan?.la_thoai?.some(Boolean);
    kb.eLamSan = h('p', { class: 'hint', role: 'status' });
    const nutLamSan = coThoai && h('button', { class: 'btn', type: 'button', title: 'Làm tiếng mọi đoạn trước buổi live: lúc live không phải chờ, chữ và giọng không đổi thì dùng lại' }, '🎙 Làm sẵn tiếng cả kịch bản');
    if (nutLamSan) {
      nutLamSan.addEventListener('click', async () => {
        if (coThayDoi()) return toast('Lưu kịch bản trước rồi mới làm tiếng.', true);
        try {
          const kq = await dangLam(nutLamSan, 'Đang gửi…', () => api.post('/doi-ai/lam-san', { kich_ban_id: kb.chon }));
          kb.eLamSan.textContent = `Đang làm tiếng ${kq.tong} đoạn… (mỗi đoạn khoảng 10–30 giây)`;
        } catch (e) { toast(e.message, true); }
      });
    }
    const form = h('form', { class: 'body' },
      h('label', { class: 'field' }, h('span', {}, 'Tên kịch bản'), oTen),
      h('div', { class: 'field' }, h('span', {}, 'Các đoạn'), dsDoan,
        h('button', { class: 'btn small', type: 'button', onclick: () => { kb.form.doan.push({ san_pham_id: null, loi_nhac: '' }); veDoan(); } }, '+ Thêm đoạn')),
      loi,
      h('div', { class: 'nutbam' }, nutLuu,
        h('button', { class: 'btn', type: 'button', onclick: () => { kb.form = structuredClone(kb.goc); veSoan(); } }, 'Hủy thay đổi'),
        nutLamSan),
      coThoai && kb.eLamSan);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      loi.textContent = '';
      try {
        const { kich_ban: k } = await dangLam(nutLuu, 'Đang lưu…',
          () => (moi ? api.post('/kich-ban', kb.form) : api.put(`/kich-ban/${kb.chon}`, kb.form)));
        kb.goc = structuredClone(kb.form);
        toast(`Đã lưu kịch bản "${k.ten}"`);
        await tai();
        kb.form = null;
        chon(k.id);
      } catch (loiGoi) { loi.textContent = loiGoi.message; }
    });

    phai.replaceChildren(h('header', {}, h('h2', {}, moi ? 'Kịch bản mới' : kb.form.ten || 'Kịch bản')), form);
    if (moi) oTen.focus();
  }

  veDs();
  veSoan();
}

/* ================= Phòng diễn tập ================= */

const TEN_NGUOI_XEM = ['Lan Nguyễn', 'Hùng Trần', 'Mai Phương', 'Tuấn Anh', 'Thu Hà', 'Minh Đức', 'Ngọc Ánh', 'Văn Toàn', 'Hải Yến', 'Quang Huy'];
const tenNgauNhien = () => TEN_NGUOI_XEM[Math.floor(Math.random() * TEN_NGUOI_XEM.length)];

async function veDienTap(khung) {
  const [tt, { kich_ban: dsKb }, hienTai, { san_pham: spDangBan }, { kich_ban: dsKbLive }] = await Promise.all([
    api.get('/dien-tap/trang-thai'), api.get('/dien-tap/kich-ban'), api.get('/live/phien/hien-tai'), api.get('/san-pham?trang_thai=dang_ban'),
    api.get('/kich-ban'), // kịch bản live đã lưu, mới sửa lên đầu — cho ô "Kịch bản" của buổi tập
  ]);
  let trangThai = tt;
  let binhLuan = hienTai.binh_luan || [];

  // Tập nhanh một chạm (bản 2.5): kịch bản nhanh + phiên diễn tập + live giả; Màn hình người dẫn tự mở khi live bắt đầu.
  // Chỉ rõ còn thiếu gì: Mai cần ít nhất 1 sản phẩm Đang bán để có thông tin trả lời, và cần một phiên live đang chạy.
  const tapNhanh = h('div', { class: 'body' });
  const veTapNhanh = () => {
    const p = hienTai.phien;
    const TEN_CHE_DO = { goi_y: 'Chỉ gợi ý (Mai trả lời bằng chữ)', noi: 'Mai nói (Mai trả lời bằng tiếng)', tat: 'Tắt AI' };
    if (p) {
      const tenCheDo = p.doi_ai ? 'Đội AI dẫn (nhiều giọng)' : p.che_do_ai === 'noi' && p.mai_dan ? 'Mai dẫn chính (bạn dẫn phụ)' : TEN_CHE_DO[p.che_do_ai] || p.che_do_ai;
      const nutKetThuc = h('button', { class: 'btn danger', type: 'button' }, 'Kết thúc buổi tập');
      nutKetThuc.addEventListener('click', async () => {
        try {
          await dangLam(nutKetThuc, 'Đang kết thúc…', async () => {
            if (trangThai.dang_phat) trangThai = await api.post('/dien-tap/live', { bat: false });
            const con = await api.get('/live/phien/hien-tai');
            if (con.phien) await api.post(`/live/phien/${con.phien.id}/ket-thuc`);
          });
          // #87 (cách 1): buổi tập dùng kho thật — hỏi trả hàng về kho ngay, hay để tập tiếp phần gửi hàng, giao hàng.
          if (confirm(['Đã kết thúc live giả.', '', 'Trả toàn bộ hàng của buổi tập về kho ngay?', '',
            '• OK: hủy đơn đang giữ, cộng lại hàng đã trừ — kho về như trước buổi tập.',
            '• Hủy: giữ đơn để tập tiếp phần sau buổi live (in phiếu, Đã gửi, giao, hoàn); trả kho sau ở khung "Bán hàng trong buổi tập".'].join('\n'))) {
            const kq = await api.post('/dien-tap/tra-kho');
            toast(`Đã trả kho: hủy ${kq.huy} đơn đang giữ, cộng lại ${kq.tra_chiec} chiếc đã trừ`);
          } else toast('Đã kết thúc live giả. Đơn của buổi tập vẫn còn để tập gửi hàng.');
          veDienTap(khung);
        } catch (e) { toast(e.message, true); }
      });
      tapNhanh.replaceChildren(
        h('p', {}, h('span', { class: `chip ${p.trang_thai === 'dang_live' ? 'bad' : 'warn'}` }, p.trang_thai === 'dang_live' ? '● Đang tập' : 'Đang chờ live giả'),
          ' ', h('b', {}, p.ten), ` · ${tenCheDo}`),
        h('div', { class: 'nutbam' }, h('a', { class: 'btn primary', href: '#/nguoi-dan' }, 'Mở Màn hình người dẫn (xem và nghe Mai)'), nutKetThuc),
        h('p', { class: 'hint' }, 'Trên Màn hình người dẫn: bấm "Bật loa" nếu thấy nút đó, rồi bấm một câu hỏi mẫu ở thanh "Tập" để người dẫn giả hỏi Mai.'));
      return;
    }
    const coTin = spDangBan.length > 0;
    const oCheDo = (giaTri, chu, chon) => h('label', { class: 'chon-o' }, h('input', { type: 'radio', name: 'tap-che-do', value: giaTri, checked: chon }), ` ${chu}`);
    // Bản 2.7 (#47): "Mai dẫn chính" đặt sẵn — vào là Mai dẫn luôn, bạn nói xen khi muốn.
    // Bản 2.9 (#49): Đội AI dẫn — đội nhân vật AI nhiều giọng nam nữ, hỏi đáp, cười đùa như talk show.
    const cheDoDoi = oCheDo('doi', 'Đội AI dẫn — đội trợ lý AI nhiều giọng thay nhau dẫn như talk show bán hàng, bạn nói xen khi muốn (tiếng làm sẵn dùng lại được, rẻ hơn Mai nói)', false);
    const cheDoDan = oCheDo('dan', 'Mai dẫn chính — Mai tự dẫn cả buổi, bạn là người dẫn phụ, nói xen khi muốn (khoảng 1.300 đồng mỗi phút)', true);
    const cheDoNoi = oCheDo('noi', 'Mai nói — bạn dẫn, Mai trả lời bằng tiếng (khoảng 1.300 đồng mỗi phút)', false);
    const cheDoGoiY = oCheDo('goi_y', 'Chỉ gợi ý — trả lời bằng chữ trên màn hình (gần như không tốn tiền)', false);
    const oXemGia = h('input', { type: 'checkbox', checked: true });
    // Chọn kịch bản cho buổi tập: mặc định để MOZA tự chọn (AI soạn nếu cần), hoặc chọn đúng một kịch bản đã lưu.
    const oKichBan = h('select', { 'aria-label': 'Kịch bản buổi tập' },
      h('option', { value: '' }, 'Tự chọn — kịch bản gần nhất có đủ các món, chưa có thì AI soạn mới'),
      ...dsKbLive.map((k) => h('option', { value: k.id }, `${k.ten} · ${k.doan.length} đoạn`)));
    const nutBatDau = h('button', { class: 'btn primary', type: 'button', disabled: !coTin }, '▶ Bắt đầu tập');
    nutBatDau.addEventListener('click', async () => {
      const cheDo = tapNhanh.querySelector('input[name="tap-che-do"]:checked')?.value || 'dan';
      try {
        const kq = await dangLam(nutBatDau, oKichBan.value ? 'Đang mở buổi tập…' : 'Đang chuẩn bị (AI soạn kịch bản nếu cần, khoảng 1 phút)…',
          () => api.post('/dien-tap/bat-dau-nhanh', { che_do_ai: cheDo, nguoi_xem_gia: oXemGia.checked, ...(oKichBan.value ? { kich_ban_id: oKichBan.value } : {}) }));
        if (kq.canh_bao) toast(kq.canh_bao, true);
        // Live bắt đầu thì app tự chuyển sang Màn hình người dẫn; chưa chuyển sau 3 giây thì tự mở.
        setTimeout(() => { if (location.hash.startsWith('#/live')) location.hash = '#/nguoi-dan'; }, 3000);
      } catch (e) { toast(e.message, true); }
    });
    tapNhanh.replaceChildren(
      coTin
        ? h('p', {}, h('span', { class: 'chip ok' }, '✓'), ` Có ${spDangBan.length} sản phẩm Đang bán: ${spDangBan.slice(0, 5).map((t) => `số ${t.so}`).join(', ')}${spDangBan.length > 5 ? '…' : ''}`)
        : h('p', {}, h('span', { class: 'chip bad' }, '✗'), ' Chưa có sản phẩm nào "Đang bán". Mai cần ít nhất 1 sản phẩm để có thông tin trả lời. ',
          h('a', { href: '#/san-pham' }, 'Tạo sản phẩm'), ' (📷 Tạo từ ảnh, chọn trạng thái Đang bán) rồi quay lại đây.'),
      h('label', { class: 'field' }, h('span', {}, 'Kịch bản'), oKichBan),
      h('div', { class: 'cot' }, cheDoDoi, cheDoDan, cheDoNoi, cheDoGoiY),
      h('label', { class: 'chon-o' }, oXemGia, ' Có người xem giả bình luận, hỏi han (AI đóng vai, tốn rất ít)'),
      h('div', { class: 'nutbam' }, nutBatDau),
      h('p', { class: 'hint' }, 'Chọn một kịch bản đã lưu (ví dụ buổi live rau) hoặc để "Tự chọn": MOZA lấy kịch bản gần nhất có đủ các sản phẩm, chưa có thì AI soạn mới. Phiên diễn tập và live giả tự mở, Màn hình người dẫn tự hiện (bấm "Bật loa" nếu thấy nút đó). '
        + '"Đội AI dẫn": lần đầu AI soạn kịch bản đội (khoảng 1 phút); đội tự mở màn, tự sang đoạn, trả lời người xem bằng 2 giọng; bạn nói xen thì đội ngừng, gọi "Mai ơi" để hỏi. '
        + '"Mai dẫn chính": Mai mở màn ngay, tự đi hết kịch bản; bạn muốn nói thì cứ nói (hoặc bấm "Nói xen" ở thanh Tập), Mai đáp rồi dẫn tiếp; phím cách để Mai thôi dẫn. '
        + '"Mai nói": bạn đọc ý chính của đoạn rồi bấm → sang đoạn sau, Mai nói phần của Mai. Người xem giả sẽ hỏi, Mai trả lời. Không có gì ra Facebook thật.'));
  };

  const trangThaiLive = h('div', { class: 'nutbam' });
  const nutLive = h('button', { class: 'btn primary', type: 'button' });
  const nutLive2 = h('button', { class: 'btn small', type: 'button', title: 'Thử trường hợp Page có 2 live: MOZA phải hỏi chọn' }, '+ Live thứ hai');
  nutLive2.addEventListener('click', async () => {
    try { trangThai = await api.post('/dien-tap/live-thu-hai'); veLive(); toast('Đã mở live giả thứ hai'); } catch (e) { toast(e.message, true); }
  });
  const nutHong = h('button', { class: 'btn small', type: 'button' });
  nutHong.addEventListener('click', async () => {
    try { trangThai = await api.post('/dien-tap/hong-luong', { bat: !trangThai.luong_hong }); veLive(); } catch (e) { toast(e.message, true); }
  });
  const veLive = () => {
    nutLive2.hidden = !trangThai.dang_phat || trangThai.so_live >= 2;
    nutHong.hidden = !trangThai.dang_phat;
    nutHong.textContent = trangThai.luong_hong ? 'Sửa luồng bình luận' : 'Làm hỏng luồng bình luận';
    nutHong.title = 'Thử khi luồng bình luận trực tiếp hỏng: MOZA phải tự chuyển sang hỏi Facebook 3 giây một lần';
    trangThaiLive.replaceChildren(...[
      trangThai.dang_phat ? h('span', { class: 'chip bad' }, `● Live giả đang phát${trangThai.so_live > 1 ? ` (${trangThai.so_live} live)` : ''}`)
        : h('span', { class: 'chip mute' }, 'Chưa phát live giả'),
      trangThai.luong_hong && h('span', { class: 'chip warn' }, 'Luồng bình luận đang hỏng'),
      nutLive, nutLive2, nutHong,
    ].filter(Boolean));
    nutLive.textContent = trangThai.dang_phat ? 'Kết thúc live giả' : 'Bắt đầu live giả';
    nutLive.className = trangThai.dang_phat ? 'btn danger' : 'btn primary';
  };
  nutLive.addEventListener('click', async () => {
    try {
      trangThai = await api.post('/dien-tap/live', { bat: !trangThai.dang_phat });
      veLive();
      veKb();
    } catch (e) { toast(e.message, true); }
  });

  const oTen = h('input', { type: 'text', value: tenNgauNhien(), maxlength: 100, 'aria-label': 'Tên người xem giả' });
  const oNoiDung = h('input', { type: 'text', maxlength: 2000, placeholder: 'Gõ bình luận rồi bấm Enter', 'aria-label': 'Nội dung bình luận' });
  const formBl = h('form', { class: 'hang' },
    h('label', { class: 'field', style: 'flex:0 1 200px' }, h('span', {}, 'Tên người xem'), oTen),
    h('button', { class: 'btn small', type: 'button', title: 'Đổi tên ngẫu nhiên', onclick: () => { oTen.value = tenNgauNhien(); } }, '🎲'),
    h('label', { class: 'field' }, h('span', {}, 'Bình luận'), oNoiDung),
    h('button', { class: 'btn primary', type: 'submit' }, 'Gửi'));
  formBl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!oNoiDung.value.trim()) return;
    try {
      await api.post('/dien-tap/binh-luan', { ten: oTen.value, noi_dung: oNoiDung.value });
      oNoiDung.value = '';
      oNoiDung.focus();
    } catch (loi) { toast(loi.message, true); }
  });

  const dsKichBan = h('div', { class: 'ds' });
  const veKb = () => dsKichBan.replaceChildren(...dsKb.map((k) => {
    const dangChay = trangThai.kich_ban_dang_chay?.id === k.id;
    const nut = h('button', { class: dangChay ? 'btn small danger' : 'btn small', type: 'button', disabled: k.loai !== 'messenger' && !trangThai.dang_phat && !dangChay },
      dangChay ? `Dừng (còn ${trangThai.kich_ban_dang_chay.con})` : 'Chạy');
    nut.addEventListener('click', async () => {
      try {
        trangThai = dangChay ? await api.post('/dien-tap/dung') : await api.post('/dien-tap/chay', { id: k.id });
        veKb();
      } catch (e) { toast(e.message, true); }
    });
    return h('div', { class: 'ds-hang' },
      h('span', { class: 'dong1' }, h('b', { class: 'grow' }, k.ten), nut),
      h('span', { class: 'dong2 xuong-dong' }, k.mo_ta),
      h('span', { class: 'dong3' }, k.loai === 'messenger' ? `Messenger giả · ${k.so_binh_luan} tin trong khoảng ${k.giay} giây (không cần live giả)`
        : k.co_tieng ? `Có tiếng người dẫn giả · ${k.so_binh_luan} bước trong khoảng ${k.giay} giây`
          : `${k.so_binh_luan} bình luận trong khoảng ${k.giay} giây`));
  }));

  // Người dẫn giả nói có tiếng (bản 2.5, F-39): Google đọc câu → tiếng đi vào đường micro của MOZA như người dẫn thật.
  const ndg = h('div', { class: 'body' });
  const trangThaiTieng = h('p', { class: 'hint', role: 'status' });
  let phatLoa = true;
  const veNdg = async () => {
    let dsGiong = [];
    let macDinh = { nguoi_dan: 'vi-vn-advisor-2', khach: 'vi-vn-advisor-4' };
    try {
      const g = await api.get('/dien-tap/giong');
      dsGiong = g.giong;
      macDinh = g.mac_dinh;
    } catch (e) {
      trangThaiTieng.textContent = `Chưa tải được danh sách giọng: ${e.message}`;
    }
    const oGiong = (giaTri) => {
      const s = h('select', {}, (dsGiong.length ? dsGiong : [{ id: giaTri, ten: giaTri }]).map((g) => h('option', { value: g.id, selected: g.id === giaTri },
        `${g.ten}${g.gioi === 'nu' ? ' (nữ)' : g.gioi === 'nam' ? ' (nam)' : ''}`)));
      s.value = giaTri;
      return s;
    };
    const oGiongNd = oGiong(macDinh.nguoi_dan);
    const oGiongKhach = oGiong(macDinh.khach);
    const oCau = h('input', { type: 'text', maxlength: 600, placeholder: 'Ví dụ: Mai ơi, {goi} số {so} giá bao nhiêu vậy em?', 'aria-label': 'Câu người dẫn giả nói' });
    const nutNoi = h('button', { class: 'btn primary', type: 'button' }, 'Nói vào micro');
    const noi = async (chu) => {
      if (!chu.trim()) return;
      try {
        const kq = await dangLam(nutNoi, 'Google đang đọc…', () => api.post('/dien-tap/noi', { chu, giong: oGiongNd.value }));
        trangThaiTieng.textContent = `Đã có tiếng (${kq.giay.toFixed(1)} giây): "${kq.chu}"`;
      } catch (e) { toast(e.message, true); }
    };
    nutNoi.addEventListener('click', () => noi(oCau.value));
    oCau.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); noi(oCau.value); } });
    const mau = ['Mai ơi, {goi} số {so} giá bao nhiêu vậy em?', 'Mai ơi, khách cao 1m58 nặng 50 cân mặc size nào em?',
      'Mai ơi, em chào cả nhà một câu đi.', 'Cả nhà ơi, tiếp theo là {goi} số {so}, ai ưng thì bình luận chốt {so} kèm màu và size nha.'];
    const nutMau = mau.map((c) => {
      const n = h('button', { class: 'btn small', type: 'button', title: 'Nói câu này' }, c);
      n.addEventListener('click', () => { oCau.value = c; noi(c); });
      return n;
    });
    const oNd = h('input', { type: 'text', maxlength: 400, value: 'Em mặc {goi} số {so} size {co} thấy vừa không?' });
    const oKhach = h('input', { type: 'text', maxlength: 400, value: 'Dạ vừa lắm ạ, em cao một mét sáu, dáng suông nên dễ mặc.' });
    const nutHai = h('button', { class: 'btn', type: 'button' }, 'Hai người nói');
    nutHai.addEventListener('click', async () => {
      try {
        const kq = await dangLam(nutHai, 'Google đang đọc…', () => api.post('/dien-tap/hoi-thoai', {
          luot: [{ vai: 'nguoi_dan', chu: oNd.value }, { vai: 'khach', chu: oKhach.value }],
          giong: { nguoi_dan: oGiongNd.value, khach: oGiongKhach.value },
        }));
        trangThaiTieng.textContent = `Đã có tiếng (${kq.giay.toFixed(1)} giây): ${kq.chu}`;
      } catch (e) { toast(e.message, true); }
    });
    const oLoa = h('input', { type: 'checkbox', role: 'switch', checked: phatLoa });
    oLoa.addEventListener('change', () => { phatLoa = oLoa.checked; });
    const truong = (nhan, el, co = '1 1 220px') => h('label', { class: 'field', style: `flex:${co}` }, h('span', {}, nhan), el);
    ndg.replaceChildren(
      h('p', { class: 'muted' }, 'Giả người dẫn nói vào micro bằng giọng thật (Google đọc, vài giây mới có tiếng). Chế độ "Chỉ gợi ý": chép lời nghe câu "Mai ơi…" '
        + 'và Mai trả lời trên Màn hình người dẫn. Chế độ "Mai nói": miệng của Mai nghe và trả lời bằng tiếng. Cần có buổi live đang chạy. '
        + 'Tiếng giả chỉ đi vào đường micro của MOZA, không bao giờ ra Facebook. Mỗi câu tốn dưới 100 đồng.'),
      h('div', { class: 'hang' }, truong('Giọng người dẫn giả', oGiongNd, '0 1 260px'), truong('Câu người dẫn nói ({so}, {goi}, {co} tự thay theo sản phẩm đang nói)', oCau), nutNoi),
      h('div', { class: 'nutbam' }, ...nutMau),
      h('details', {}, h('summary', { class: 'hint' }, 'Người dẫn và người mẫu nói chuyện (hai giọng)'),
        h('div', { class: 'hang' }, truong('Giọng người mẫu', oGiongKhach, '0 1 260px'), truong('Người dẫn nói', oNd), truong('Người mẫu đáp', oKhach), nutHai)),
      h('label', { class: 'khancap xanh' }, oLoa, h('span', {}, 'Phát tiếng người dẫn giả ra loa ở trang này')),
      trangThaiTieng);
  };

  // Người đóng vai (F-15): AI giả người xem theo vai, theo nhịp. Chỉ trong Phòng diễn tập.
  const ndv = h('div', { class: 'body' });
  let nguoiDanNoi = !!hienTai.ai?.nguoi_dan_noi;
  const veNdv = () => {
    const n = trangThai.nguoi_dong_vai;
    if (!n) { ndv.replaceChildren(h('p', { class: 'muted' }, 'Chưa sẵn sàng.')); return; }
    // Chưa chọn vai nào thì gợi ý sẵn 3 vai hay gặp.
    const dangChon = new Set(n.vai_chon?.length ? n.vai_chon : ['hoi_gia', 'hoi_size', 'chot_don']);
    const hop = n.vai.map((v) => h('label', { class: 'chon-o', title: v.mo_ta },
      h('input', { type: 'checkbox', value: v.id, checked: dangChon.has(v.id), disabled: n.bat }), ` ${v.ten}`));
    const chonNhip = h('select', { 'aria-label': 'Nhịp bình luận' }, n.nhip_lua_chon.map((x) => h('option', { value: x.id, selected: x.id === n.nhip }, x.ten)));
    const nut = h('button', { class: n.bat ? 'btn danger' : 'btn primary', type: 'button', disabled: !trangThai.dang_phat && !n.bat },
      n.bat ? 'Tắt Người đóng vai' : 'Bật Người đóng vai');
    nut.addEventListener('click', async () => {
      try {
        trangThai = await api.post('/dien-tap/nguoi-dong-vai', n.bat ? { bat: false }
          : { bat: true, vai: hop.map((l) => l.firstChild).filter((o) => o.checked).map((o) => o.value), nhip: chonNhip.value });
        veNdv();
      } catch (e) { toast(e.message, true); }
    });
    const oNoi = h('input', { type: 'checkbox', role: 'switch', checked: nguoiDanNoi, disabled: !hienTai.phien });
    oNoi.addEventListener('change', async () => {
      try {
        nguoiDanNoi = (await api.post('/dien-tap/nguoi-dan-noi', { bat: oNoi.checked })).nguoi_dan_noi;
      } catch (e) { oNoi.checked = !oNoi.checked; toast(e.message, true); }
    });
    ndv.replaceChildren(...[
      h('p', { class: 'muted' }, 'AI (model rẻ) đóng vai người xem, tự gõ bình luận theo vai đã chọn. Tốn một ít tiền AI mỗi phút; ghi vào chi phí như Agent khác, có đánh dấu diễn tập.'),
      !hienTai.phien && h('p', { class: 'loi' }, 'Chưa có phiên live: bình luận giả sẽ không có ai nhận và Mai không trả lời. Bấm "Bắt đầu tập" ở trên trước.'),
      h('div', { class: 'hang' }, hop),
      h('div', { class: 'hang' }, h('label', { class: 'field', style: 'flex:0 1 200px' }, h('span', {}, 'Nhịp'), chonNhip), nut,
        n.bat && h('span', { class: 'chip bad' }, `● Đang đóng vai · đã gửi ${n.da_dua} bình luận`)),
      n.loi && h('p', { class: 'loi' }, `AI lỗi: ${n.loi}`),
      h('label', { class: 'khancap xanh' }, oNoi, h('span', {}, 'Giả "người dẫn đang nói"')),
      h('p', { class: 'hint' }, 'Bật thì Director không giao Co-host (như khi người dẫn đang nói thật; M3 tự biết qua chép lời người dẫn).'),
    ].filter(Boolean));
  };

  const dsBl = h('div', { class: 'ds' });
  const veBl = () => {
    if (!binhLuan.length) {
      dsBl.replaceChildren(h('div', { class: 'empty' }, 'Chưa có bình luận nào về MOZA. Cần có phiên đang live và live giả đang phát.'));
      return;
    }
    dsBl.replaceChildren(...binhLuan.slice(0, 30).map(veMotBinhLuan));
  };

  ngheWs((m) => {
    if (m.type === 'dien_tap.trang_thai') { trangThai = m; veLive(); veKb(); veNdv(); }
    if (m.type === 'dien_tap.nguoi_dong_vai') { trangThai = { ...trangThai, nguoi_dong_vai: m }; veNdv(); }
    if (m.type === 'live.nguoi_dan_noi') { nguoiDanNoi = m.bat; veNdv(); }
    if (m.type === 'dien_tap.tieng_gia') {
      if (m.loi) {
        trangThaiTieng.textContent = `Người dẫn giả chưa nói được: ${m.loi}`;
        toast(m.loi, true);
      } else {
        trangThaiTieng.textContent = `Người dẫn giả đang nói (${m.giay} giây): "${m.chu}"`;
        if (phatLoa) new Audio(`/api/dien-tap/tieng/${encodeURIComponent(m.id)}`).play().catch(() => {});
      }
    }
    if (m.type === 'live.binh_luan') { binhLuan = [m.binh_luan, ...binhLuan]; veBl(); }
    if (m.type === 'live.binh_luan_cap_nhat') { binhLuan = binhLuan.map((b) => (b.id === m.binh_luan.id ? m.binh_luan : b)); veBl(); }
    if (m.type === 'live.bat_dau' || m.type === 'live.ket_thuc') api.get('/live/phien/hien-tai').then((r) => { binhLuan = r.binh_luan || []; veBl(); });
  });

  // Bán hàng trọn quy trình trong buổi tập (#87): khách giả trả lời tin nhắn, đơn của buổi tập, tua thời gian,
  // sau buổi live (in phiếu, Đã gửi → trừ kho, giả lập vận chuyển), báo cáo buổi tập, kết thúc thì trả hàng về kho.
  const banHangTap = h('div', { class: 'body' });
  const TEN_TT = new Proxy({}, { get: (_, k) => thongTin('don', k).ten });
  const veBanHangTap = async () => {
    const d = await api.get('/dien-tap/ban-hang');
    const tong = Object.values(d.don).reduce((a, b) => a + b, 0);
    const kg = d.khach_gia;
    const oKg = h('input', { type: 'checkbox', role: 'switch', checked: kg.bat });
    oKg.addEventListener('change', async () => { try { await api.post('/dien-tap/khach-gia', { bat: oKg.checked }); veBanHangTap(); } catch (e) { toast(e.message, true); } });
    // #94: khách giả "Soạn sẵn (0 đồng)" là mặc định; "AI (tốn tiền)" chỉ khi chọn.
    const oCd = h('select', { 'aria-label': 'Kiểu khách giả' }, h('option', { value: 'soan_san', selected: kg.che_do !== 'ai' }, 'Soạn sẵn (0 đồng)'), h('option', { value: 'ai', selected: kg.che_do === 'ai' }, 'AI (tốn tiền, GPT-6 Luna)'));
    oCd.addEventListener('change', async () => { try { await api.post('/dien-tap/khach-gia', { che_do: oCd.value }); toast(oCd.value === 'ai' ? 'Khách giả dùng AI (tốn một ít tiền)' : 'Khách giả soạn sẵn: 0 đồng'); veBanHangTap(); } catch (e) { toast(e.message, true); } });
    const nut = (chu, lop, fn, tieuDe) => { const b = h('button', { class: `btn small ${lop}`, type: 'button', title: tieuDe || null }, chu); b.addEventListener('click', () => dangLam(b, 'Đang làm…', fn).catch((e) => toast(e.message, true))); return b; };
    const tua = (gio) => nut(`⏩ Tua ${gio} giờ`, '', async () => {
      const kq = await api.post('/dien-tap/tua', { gio });
      toast(`Đã tua ${gio} giờ${kq.huy_qua_gio.length ? ` — tự hủy vì quá giờ giữ: ${kq.huy_qua_gio.join(', ')}` : ''}`);
      veBanHangTap();
    }, gio === 2 ? 'Đơn chờ xác nhận sắp hết giờ giữ: AI nhắn nhắc khách gửi thông tin giao' : 'Đơn chưa xác nhận quá giờ giữ tự hủy, hàng trả về kho; quá 24 giờ AI không nhắn được nữa (tạo việc gọi điện)');
    banHangTap.replaceChildren(
      h('p', { class: 'hint' }, 'Buổi tập chạy như thật trên kho thật: người xem giả chốt → giữ hàng, tạo đơn → MOZA nhắn riêng thẻ giữ hàng (0 đồng) → khách giả bấm nút, gửi thông tin → thẻ đơn → xác nhận. Kết thúc buổi tập thì trả hàng về kho. Khách giả "Soạn sẵn" không tốn tiền; khách gõ câu lạ thì Tư vấn viên (GPT-6 Luna khi tập) mới trả lời.'),
      h('div', { class: 'hang' }, h('label', { class: 'khancap xanh' }, oKg, h('span', {}, kg.bat ? 'Khách giả đang trả lời tin nhắn' : 'Khách giả đang tắt')),
        h('label', { class: 'field', style: 'flex:0 1 240px' }, h('span', {}, 'Kiểu khách giả'), oCd)),
      kg.khach.length ? h('details', {}, h('summary', { class: 'hint' }, `${kg.khach.length} khách giả trong buổi này`),
        h('ul', { class: 'lich-su' }, kg.khach.map((k) => h('li', {}, `${k.ten} · ${k.tinh_cach} · ${k.so_tin} tin${k.xong ? ' · xong' : ''}`)))) : '',
      h('h3', {}, 'Đơn của buổi tập'),
      tong ? h('p', {}, Object.entries(d.don).map(([k, n]) => h('span', { class: 'chip mute', style: 'margin-right:6px' }, `${TEN_TT[k] || k}: ${n}`))) : h('p', { class: 'hint' }, 'Chưa có đơn nào. Người xem giả chốt trên live hoặc nhắn Page là có đơn.'),
      h('div', { class: 'nutbam' }, h('a', { class: 'btn small primary', href: '#/don?dien_tap=1&trang_thai=' }, 'Mở Đơn hàng (diễn tập)'), tua(2), tua(24), tua(96)), // BH8: tua 96 giờ để thử hỏi thăm sau khi gửi
      h('h3', {}, 'Sau buổi live — làm như shop thật'),
      h('ol', { class: 'lich-su' },
        h('li', {}, 'Đơn hàng → thẻ "Cần gửi": chọn đơn → In phiếu → Đánh dấu Đã gửi (tồn kho trừ thật; AI nhắn khách mã vận đơn).'),
        h('li', {}, 'Bấm "Giả lập vận chuyển": phần lớn đơn thành Đã giao, một ít Hoàn; đơn Hoàn → bấm "Đã nhận hàng hoàn" để cộng lại kho.'),
        h('li', {}, 'Xem báo cáo buổi tập: bình luận → chốt → đơn → gửi → giao / hoàn, doanh số, lãi, chi phí AI.'),
        h('li', {}, 'Xong thì "Kết thúc & trả hàng về kho".')),
      h('div', { class: 'nutbam' },
        nut('🚚 Giả lập vận chuyển', '', async () => { const kq = await api.post('/dien-tap/van-chuyen'); toast(kq.giao.length + kq.hoan.length ? `Đã giao ${kq.giao.length} đơn, hoàn ${kq.hoan.length} đơn` : 'Chưa có đơn nào "Đã gửi" — gửi hàng ở màn hình Đơn hàng trước'); veBanHangTap(); }),
        h('a', { class: 'btn small', href: '#/bao-cao?dien_tap=1' }, '📊 Báo cáo buổi tập'),
        nut('Kết thúc & trả hàng về kho', 'danger', async () => {
          if (!confirm('Trả toàn bộ hàng của buổi tập về kho? Đơn đang giữ bị hủy, hàng đã trừ được cộng lại. Đơn diễn tập sau đó khóa, không sửa được nữa.')) return;
          const kq = await api.post('/dien-tap/tra-kho');
          toast(`Đã trả kho: ${kq.don} đơn, hủy ${kq.huy} đơn đang giữ, cộng lại ${kq.tra_chiec} chiếc`);
          veBanHangTap();
        })));
  };
  let henBh;
  window.addEventListener('moza:ws', function ngheBh(e) {
    if (!document.body.contains(banHangTap)) { window.removeEventListener('moza:ws', ngheBh); return; }
    if (['don.cap_nhat', 'dien_tap.khach_gia', 'live.chot'].includes(e.detail.type)) { clearTimeout(henBh); henBh = setTimeout(() => veBanHangTap().catch(() => {}), 500); }
  });
  veBanHangTap().catch((e) => toast(e.message, true));

  // Messenger giả (M5, F-15): khách giả nhắn Page giả hoặc bình luận bài đăng; Tư vấn viên trả lời như thật.
  const hopThuGia = h('div', { class: 'body' });
  const veHopThuGia = async () => {
    const d = await api.get('/dien-tap/chat');
    const oPage = h('select', { 'aria-label': 'Page giả' }, d.pages.map((p) => h('option', { value: p.id }, p.ten)));
    const oTenK = h('input', { type: 'text', value: tenNgauNhien(), maxlength: 100, 'aria-label': 'Tên khách giả' });
    const oChu = h('input', { type: 'text', maxlength: 2000, placeholder: 'Gõ tin nhắn rồi bấm Enter', 'aria-label': 'Tin nhắn' });
    const oKieu = h('select', { 'aria-label': 'Kiểu' }, h('option', { value: 'nhan-tin' }, 'Nhắn Messenger'), h('option', { value: 'binh-luan-bai' }, 'Bình luận bài đăng'), h('option', { value: 'binh-luan-xem-lai' }, 'Bình luận video xem lại')); // F-94: live giả đã kết thúc
    const f = h('form', { class: 'hang' },
      h('label', { class: 'field', style: 'flex:0 1 190px' }, h('span', {}, 'Page'), oPage),
      h('label', { class: 'field', style: 'flex:0 1 170px' }, h('span', {}, 'Khách'), oTenK),
      h('label', { class: 'field', style: 'flex:0 1 170px' }, h('span', {}, 'Kiểu'), oKieu),
      h('label', { class: 'field' }, h('span', {}, 'Nội dung'), oChu),
      h('button', { class: 'btn primary', type: 'submit' }, 'Gửi'),
      // F-104: khách giả gửi ảnh (ví dụ ảnh mặc đồ sau khi nhận hàng) — ảnh vào khu tạm như ảnh Facebook gửi tới.
      (() => {
        const chonAnh = h('input', { type: 'file', accept: 'image/jpeg,image/png', hidden: true });
        chonAnh.addEventListener('change', async () => {
          const f0 = chonAnh.files[0];
          chonAnh.value = '';
          if (!f0) return;
          try {
            const r = await fetch('/api/anh-tam', { method: 'POST', headers: { 'Content-Type': f0.type || 'image/jpeg' }, body: f0 });
            const j = await r.json();
            if (!r.ok) throw new Error(j.loi?.thong_diep || 'Không tải được ảnh.');
            await api.post('/dien-tap/nhan-tin', { page_id: oPage.value, ten: oTenK.value, noi_dung: oChu.value, anh: j.tep });
            oChu.value = '';
          } catch (er) { toast(er.message, true); }
        });
        return h('button', { class: 'btn', type: 'button', title: 'Khách giả gửi ảnh qua Messenger', onclick: () => chonAnh.click() }, '📷 Gửi ảnh', chonAnh);
      })());
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!oChu.value.trim()) return;
      try { await api.post(`/dien-tap/${oKieu.value}`, { page_id: oPage.value, ten: oTenK.value, noi_dung: oChu.value }); oChu.value = ''; oChu.focus(); } catch (er) { toast(er.message, true); }
    });
    const oHong = h('input', { type: 'checkbox', role: 'switch', checked: d.hong_gui });
    oHong.addEventListener('change', async () => { await api.post('/dien-tap/hong-gui', { bat: oHong.checked }); toast(oHong.checked ? 'Tin gửi ra sẽ bị "mất mạng"' : 'Gửi bình thường'); });
    const tenPage = Object.fromEntries(d.pages.map((p) => [p.id, p.ten]));
    // Tình huống Facebook (#92, docs/07 4.2): một ô chọn, chi tiết thu gọn.
    const oTh = h('select', { 'aria-label': 'Tình huống Facebook' }, d.tinh_huong.ds.map((x) => h('option', { value: x.id, selected: x.id === d.tinh_huong.hien }, x.ten)));
    oTh.addEventListener('change', async () => { try { await api.post('/dien-tap/tinh-huong', { id: oTh.value }); toast(`Tình huống Facebook: ${oTh.selectedOptions[0].textContent}`); veHopThuGia(); } catch (er) { toast(er.message, true); } });
    const bamNut = (c, n) => api.post('/dien-tap/bam-nut', { page_id: c.page_id, psid: c.psid, payload: n.payload, tieu_de: n.tieu_de }).catch((er) => toast(er.message, true));
    /** Vẽ một tin của Page: thẻ ảnh, hàng thẻ, thẻ chữ có nút, trả lời nhanh, mẫu Utility (F-15 mở rộng, docs/07 4.1). */
    const veTinPage = (c, t) => {
      const the = t.the || {};
      const nutThuong = (t.nut || []).filter((n) => n.loai !== 'nhanh' && n.loai !== 'o');
      const nhanh = (t.nut || []).filter((n) => n.loai === 'nhanh');
      return [
        t.utility ? h('span', { class: 'chip info', style: 'margin-bottom:4px' }, 'Mẫu tin Utility') : null,
        t.nhan_rieng ? h('span', { class: 'chip mute', style: 'margin-bottom:4px' }, 'Nhắn riêng từ bình luận') : null,
        the.kieu === 'anh' ? h('div', { class: 'ht-the-anh' },
          h('img', { src: the.anh?.url || '', alt: '', style: 'width:100%;max-height:220px;object-fit:cover;border-radius:8px 8px 0 0;display:block' }),
          h('div', { style: 'padding:6px 8px' }, h('b', {}, the.tieu_de), h('div', { class: 'hint' }, the.phu_de || ''))) : null,
        the.kieu === 'luoi' ? h('div', { style: 'display:flex;gap:6px;overflow-x:auto' }, (the.o || []).map((o) => h('button', { class: 'btn small', type: 'button', style: 'flex:0 0 120px;padding:0;overflow:hidden', onclick: () => bamNut(c, { payload: o.payload, tieu_de: o.tieu_de }) },
          h('img', { src: o.anh?.url || '', alt: '', style: 'width:120px;height:90px;object-fit:cover;display:block' }), h('span', { style: 'display:block;padding:4px' }, o.tieu_de)))) : null,
        the.kieu === 'media' && the.anh?.url ? h('img', { src: the.anh.url, alt: 'Ảnh shop gửi', style: 'max-width:220px;border-radius:8px;display:block' }) : null,
        the.kieu !== 'anh' && the.kieu !== 'luoi' && !(the.kieu === 'media' && the.anh?.url) ? h('div', { class: 'ht-bong-chu' }, t.noi_dung.replace(/\n\[(Nút|Chọn nhanh):[^\]]*\]/g, '')) : null,
        nutThuong.length ? h('div', { class: 'nutbam', style: 'margin-top:6px' }, nutThuong.map((n) => h('button', { class: 'btn small', type: 'button', onclick: () => bamNut(c, n) }, n.tieu_de))) : null,
        // Nút gọi điện (phone_number, F-88): trên điện thoại khách bấm là gọi — khung giả chỉ hiện số.
        (the.nut || []).some((n) => n.kieu === 'goi') ? h('div', { class: 'nutbam', style: 'margin-top:4px' }, the.nut.filter((n) => n.kieu === 'goi')
          .map((n) => h('span', { class: 'chip mute', title: 'Khách bấm là gọi điện cho shop' }, `${n.tieu_de} · ${n.so}`))) : null,
        nhanh.length ? h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px' }, nhanh.map((n) => h('button', { class: 'chip accent', type: 'button', style: 'cursor:pointer', onclick: () => bamNut(c, n) }, n.tieu_de))) : null,
      ];
    };
    const tinhTrangChat = (c) => [
      c.hop === 'cho' ? h('span', { class: 'chip warn', title: 'Khách chưa thấy tin của shop (Meta không báo). Câu nhắc trên sóng có tên họ thì khách giả mở.' }, 'Tin nhắn chờ: khách chưa thấy') : null,
      c.hop === 'cho' ? h('button', { class: 'btn small', type: 'button', onclick: () => api.post('/dien-tap/mo-tin-cho', { page_id: c.page_id, psid: c.psid }).then(veHopThuGia).catch((er) => toast(er.message, true)) }, 'Khách mở Tin nhắn chờ') : null,
      h('span', { class: `chip ${c.con_cua_so_phut > 0 ? 'ok' : 'mute'}` }, c.con_cua_so_phut > 0 ? `Cửa sổ 24 giờ: còn ${Math.floor(c.con_cua_so_phut / 60)}:${String(c.con_cua_so_phut % 60).padStart(2, '0')}` : 'Chưa mở cửa sổ 24 giờ'),
      c.chan ? h('span', { class: 'chip bad' }, 'Khách đã chặn Page') : null,
    ];
    hopThuGia.replaceChildren(
      h('p', { class: 'muted' }, 'Facebook giả chạy theo luật của Meta (24 giờ, nhắn riêng 1 lần / 7 ngày, Tin nhắn chờ…). Tin đầu sau khi chốt là thẻ do MOZA soạn (0 đồng). Xem và xử lý ở ', h('a', { href: '#/hop-thu?dien_tap=1' }, 'Hộp thư → Xem hội thoại diễn tập'), '.'),
      h('div', { class: 'hang' }, h('label', { class: 'field', style: 'flex:0 1 280px' }, h('span', {}, 'Tình huống Facebook'), oTh),
        d.hanh_vi?.length ? h('details', {}, h('summary', { class: 'hint' }, `⚠ ${d.hanh_vi.length} hành vi chưa kiểm chứng trên Page thật`), h('ul', { class: 'lich-su' }, d.hanh_vi.map((x) => h('li', { class: 'hint' }, `${x.id} ${x.ten}`)))) : null),
      f,
      h('label', { class: 'khancap' }, oHong, h('span', {}, 'Giả mất mạng khi gửi (thử "không rõ đã gửi")')),
      d.chat.length ? h('div', { class: 'grid', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px' },
        d.chat.slice(-8).reverse().map((c) => h('div', { class: 'the-page' },
          h('div', { class: 'hang' }, h('b', {}, c.ten), h('span', { class: 'chip mute' }, tenPage[c.page_id] || c.page_id)),
          h('div', { class: 'hang', style: 'flex-wrap:wrap;gap:4px' }, tinhTrangChat(c)),
          h('div', { class: 'ht-tin', style: 'max-height:460px;min-height:0' }, c.tin.map((t) => h('div', { class: `ht-bong ${t.tu === 'page' ? 'ra' : 'vao'}` },
            t.tu === 'page' ? veTinPage(c, t) : h('div', { class: 'ht-bong-chu' }, t.postback ? `👆 ${t.noi_dung}` : t.noi_dung))))))) : h('p', { class: 'hint' }, 'Chưa có khung chat nào.'),
      d.tra_loi.length > 0 ? h('details', {}, h('summary', { class: 'hint' }, `Trả lời công khai trên bài đăng giả (${d.tra_loi.length})`),
        d.tra_loi.slice(-10).map((r) => h('p', { class: 'hint' }, r.noi_dung))) : '');
  };
  let henChat;
  window.addEventListener('moza:ws', function ngheChat(e) {
    if (!document.body.contains(hopThuGia)) { window.removeEventListener('moza:ws', ngheChat); return; }
    if (e.detail.type === 'hop_thu.cap_nhat') { clearTimeout(henChat); henChat = setTimeout(() => veHopThuGia().catch(() => {}), 400); }
  });
  veHopThuGia().catch((e) => toast(e.message, true));

  veLive();
  veKb();
  veBl();
  veNdv();
  veTapNhanh();
  veNdg().catch((e) => { trangThaiTieng.textContent = e.message; });
  khung.replaceChildren(
    h('p', { class: 'hint' }, 'Facebook giả để tập live: không có gì ở đây đi ra Facebook thật. '
      + 'Cách nhanh nhất: bấm "Bắt đầu tập" ngay dưới đây. Các khung bên dưới để tập kỹ hơn (bình luận giả, kịch bản soạn sẵn, Người đóng vai).'),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Bắt đầu tập')), tapNhanh),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Bán hàng trong buổi tập')), banHangTap),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Live giả trên Page giả')), h('div', { class: 'body' }, trangThaiLive)),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Người xem giả bình luận')), h('div', { class: 'body' }, formBl)),
    // F-107: Camera giả cho "MOZA nhìn" — chọn món người dẫn đang cầm; khung hình là ảnh của món đó.
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Camera giả (MOZA nhìn)')), h('div', { class: 'body' }, (() => {
      const o = h('select', { 'aria-label': 'Người dẫn đang cầm' }, h('option', { value: '' }, '— Không cầm gì —'), ...spDangBan.map((x) => h('option', { value: x.so }, `Số ${x.so} · ${x.ten}`)));
      o.addEventListener('change', () => api.post('/dien-tap/camera', { so: o.value || null }).catch((e) => toast(e.message, true)));
      return h('label', { class: 'field' }, h('span', {}, 'Người dẫn đang cầm'), o, h('p', { class: 'hint' }, 'Bật "👁 MOZA nhìn" trên Màn hình người dẫn, rồi đổi món ở đây: MOZA gợi ý "Đang cầm …? [Chuyển]" — không tự chuyển.'));
    })())),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Người đóng vai')), ndv),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Người dẫn giả nói (có tiếng)')), ndg),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Messenger giả (Hộp thư)')), hopThuGia),
    h('div', { class: 'hai-cot' },
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Kịch bản soạn sẵn (live và Messenger)')), dsKichBan),
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Bình luận đã về MOZA')), dsBl)),
  );
}

export function veMotBinhLuan(b) {
  return h('div', { class: 'ds-hang' },
    h('span', { class: 'dong1' }, h('b', {}, b.ten),
      b.nhan.includes('cau_hoi') && h('span', { class: 'chip info' }, 'Câu hỏi'),
      b.nhan.includes('chot') && h('span', { class: 'chip accent' }, b.xu_ly === 'da_chot' ? '🛒 Đã chốt' : '🛒 Chốt'),
      b.nhan.includes('thong_tin_ca_nhan') && h('span', { class: 'chip bad' }, b.da_an ? 'Đã ẩn · chờ Tư vấn viên' : 'Lộ SĐT'),
      b.nhan.includes('spam') && h('span', { class: 'chip mute' }, 'Spam'),
      b.nhan.includes('xuc_pham') && h('span', { class: 'chip bad' }, 'Xúc phạm'),
      b.nhan.includes('lua_ai') && h('span', { class: 'chip warn' }, 'Cố lừa AI'),
      b.nhan.includes('loi_chuc') && h('span', { class: 'chip info' }, '💌 Lời chúc'),
      b.so_doan && h('span', { class: 'chip mute' }, `số ${b.so_doan}`),
      h('span', { class: 'grow' }), h('span', { class: 'dong3' }, gioPhut(b.luc_fb))),
    h('span', { class: 'dong2 xuong-dong' }, b.noi_dung));
}
