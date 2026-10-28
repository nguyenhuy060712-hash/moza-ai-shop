// Đội AI dẫn (SPEC.md bản 2.9, F-44): dàn nhân vật AI — tên, giọng, nét riêng.
// Vai trong từng đoạn (ai hỏi, ai đáp) do kịch bản quyết. Nhân vật đầu là trợ lý AI chính: tên đổi ở ô Tên AI.
// Giọng (#50): mặc định giọng kho tiếng Việt (nghe ra giọng miền Nam — chủ dự án chấp nhận 24/9/2026, chỉnh sau);
// hai giọng kho đọc đối đáp một lần, chen lời tự nhiên. Muốn giọng Bắc thì bấm "Tạo giọng Bắc" (Google tạo theo câu tả).
// F-50 (#74): bài hát cho kịch bản Radio của shop — tên bài + kiểu nhạc, Lyria viết lời và hát.

import { api } from '../api.js';
import { h, toast, dangLam } from '../ui.js';
import { vnd } from '../dinh-dang.js';

const CAU_THU = (ten) => `Chào cả nhà, ${ten} đây, trợ lý AI của shop! Hôm nay có nhiều mẫu xinh lắm, ở lại với tụi mình nha.`;

let dangPhat = null;

async function docThu(nut, chu, id) {
  await dangLam(nut, 'Đang đọc…', async () => {
    const r = await fetch('/api/giong-mai/doc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chu, id }) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.loi?.thong_diep || `Không nghe được (mã ${r.status}).`);
    }
    if (dangPhat) dangPhat.pause();
    dangPhat = new Audio(URL.createObjectURL(await r.blob()));
    await dangPhat.play();
  }).catch((e) => toast(e.message, true));
}

function ngheDuongDan(duong) {
  if (dangPhat) dangPhat.pause();
  dangPhat = new Audio(`${duong}?t=${Date.now()}`);
  dangPhat.play().catch((e) => toast(`Không nghe được: ${e.message}`, true));
}
const ngheNhac = (loai) => ngheDuongDan(`/api/doi-ai/nhac/${loai}`);

export function veDoiAi() {
  const khung = h('div', { class: 'doi-ai' }, h('p', { class: 'muted' }, 'Đang tải…'));
  let ds = [];
  let kho = [];
  let daTao = [];
  let canBac = [];
  let gioiHan = { toi_thieu: 2, toi_da: 6 };
  // Nhạc (F-47): 4 loại, mỗi loại một dòng — lời tả gửi Lyria, Tạo / Nghe / Xóa.
  let nhac = {};
  let loaiNhac = [];
  const khungNhac = h('div', { class: 'doi-ai-nhac' });
  const tien = (u) => vnd(u);
  const giay = (s) => `${Number(s).toLocaleString('vi-VN')} giây`;
  // Bài hát Radio (bản 2.10, F-50): mỗi bài chỉ có tên và kiểu nhạc; Lyria viết lời và hát (1–2 phút).
  let baiHat = [];
  let kieuBai = [];
  let goiYBai = [];
  let baiToiDa = 8;
  const khungBai = h('div', { class: 'doi-ai-nhac' });
  // Giọng ElevenLabs (BH10, F-108): chỉ dùng khi máy đọc là ElevenLabs. Danh sách thư viện chung tiếng Việt, nghe thử miễn phí.
  const khungEleven = h('div', { class: 'doi-ai-nhac' });
  let dsEleven = null;
  const phutGiay = (s) => `${Math.floor(s / 60)} phút ${String(Math.round(s % 60)).padStart(2, '0')} giây`;

  function veBai() {
    const tenKieu = (id) => kieuBai.find((k) => k.id === id)?.ten || id;
    const cacDong = baiHat.map((b) => {
      const nutNghe = h('button', { class: 'btn small', type: 'button' }, '▶ Nghe');
      nutNghe.addEventListener('click', () => ngheDuongDan(`/api/doi-ai/bai-hat/${b.id}`));
      const nutLai = h('button', { class: 'btn small', type: 'button', title: 'Google làm lại bài này (lời và giai điệu mới)' }, '🎵 Tạo lại');
      nutLai.addEventListener('click', async () => {
        try {
          const kq = await dangLam(nutLai, 'Google đang làm bài (khoảng 1 phút)…', () => api.post('/doi-ai/bai-hat', { id: b.id, ten: b.ten, kieu: b.kieu }));
          baiHat = kq.bai_hat;
          toast(`Đã làm lại "${b.ten}" (${phutGiay(kq.bai.giay)}, khoảng ${tien(kq.chi_phi_usd)}). Bấm ▶ Nghe.`);
          veBai();
        } catch (e) { toast(e.message, true); }
      });
      const nutXoa = h('button', { class: 'btn small', type: 'button', title: 'Xóa bài này: đội không phát bài này nữa' }, '✕');
      nutXoa.addEventListener('click', async () => {
        if (!confirm(`Xóa bài "${b.ten}"?`)) return;
        try { baiHat = (await api.del(`/doi-ai/bai-hat/${b.id}`)).bai_hat; veBai(); } catch (e) { toast(e.message, true); }
      });
      const loiDau = String(b.loi_bai || '').split('\n').filter(Boolean).slice(0, 2).join(' / ');
      return h('div', { class: 'doi-ai-nhac-dong' },
        h('p', {}, h('b', {}, b.ten), h('span', { class: 'muted' }, ` · ${tenKieu(b.kieu)} · ${phutGiay(b.giay)}`)),
        loiDau && h('p', { class: 'hint' }, `Lời: "${loiDau}…"`),
        h('div', { class: 'nutbam' }, nutNghe, nutLai, nutXoa));
    });

    // Thêm bài: tên (gõ hoặc chọn gợi ý) + kiểu nhạc.
    const daCo = new Set(baiHat.map((b) => b.ten.toLowerCase()));
    const goiYCon = goiYBai.filter((g) => !daCo.has(g.ten.toLowerCase()));
    const dsGoiY = h('datalist', { id: 'goi-y-bai-hat' }, ...goiYCon.map((g) => h('option', { value: g.ten })));
    const oTen = h('input', { type: 'text', maxlength: 60, list: 'goi-y-bai-hat', placeholder: 'Tên bài, ví dụ: Tan ca về muộn', 'aria-label': 'Tên bài hát' });
    const oKieu = h('select', { 'aria-label': 'Kiểu nhạc' }, ...kieuBai.map((k) => h('option', { value: k.id }, k.ten)));
    oTen.addEventListener('input', () => {
      const g = goiYBai.find((x) => x.ten.toLowerCase() === oTen.value.trim().toLowerCase());
      if (g) oKieu.value = g.kieu;
    });
    const day = baiHat.length >= baiToiDa;
    const nutTao = h('button', { class: 'btn', type: 'button', disabled: day }, '🎵 Tạo bài');
    nutTao.addEventListener('click', async () => {
      if (!oTen.value.trim()) return toast('Gõ tên bài hát trước (hoặc chọn một tên gợi ý).', true);
      try {
        const kq = await dangLam(nutTao, 'Google đang sáng tác (khoảng 1 phút)…', () => api.post('/doi-ai/bai-hat', { ten: oTen.value, kieu: oKieu.value }));
        baiHat = kq.bai_hat;
        toast(`Đã có bài "${kq.bai.ten}" (${phutGiay(kq.bai.giay)}, khoảng ${tien(kq.chi_phi_usd)}). Bấm ▶ Nghe.`);
        veBai();
      } catch (e) { toast(e.message, true); }
    });
    const bonGoiY = goiYCon.slice(0, Math.min(4, baiToiDa - baiHat.length));
    const nutGoiY = !baiHat.length && bonGoiY.length > 1
      && h('button', { class: 'btn primary', type: 'button' }, `🎵 Tạo ${bonGoiY.length} bài gợi ý (khoảng ${tien(0.08 * bonGoiY.length)})`);
    nutGoiY && nutGoiY.addEventListener('click', async () => {
      try {
        const kq = await dangLam(nutGoiY, 'Google đang sáng tác (khoảng 1–2 phút)…', () => Promise.allSettled(
          bonGoiY.map((g) => api.post('/doi-ai/bai-hat', { ten: g.ten, kieu: g.kieu }))));
        const hong = kq.filter((x) => x.status === 'rejected');
        if (hong.length) toast(`Có ${hong.length} bài chưa làm được: ${hong[0].reason?.message || 'lỗi'}`, true);
        else toast('Đã có bài hát. Bấm ▶ Nghe từng bài.');
        baiHat = (await api.get('/doi-ai')).bai_hat;
        veBai();
      } catch (e) { toast(e.message, true); }
    });

    khungBai.replaceChildren(...[
      h('h4', {}, '🎶 Bài hát (Radio của shop)'),
      h('p', { class: 'hint' }, 'Dùng cho kịch bản Radio: ở góc "Lời nhắn gửi", đội đọc lời chúc người xem bình luận rồi phát một bài (lần lượt từng bài). '
        + 'Google (Lyria) tự viết lời và hát theo tên bài, mỗi bài 1–2 phút, khoảng 2.000 đồng, làm một lần dùng mãi. '
        + 'Bài do AI sáng tác nên không dính bản quyền trên Facebook — đừng phát bài của ca sĩ thật. Nghe thử từng bài trước khi dùng.'),
      ...cacDong,
      !baiHat.length && h('p', { class: 'muted' }, 'Chưa có bài hát nào.'),
      dsGoiY,
      h('div', { class: 'hang doi-ai-hang' },
        h('label', { class: 'field grow' }, h('span', {}, 'Tên bài'), oTen),
        h('label', { class: 'field', style: 'flex:0 1 190px' }, h('span', {}, 'Kiểu nhạc'), oKieu),
        h('div', { class: 'nutbam' }, nutTao)),
      day && h('p', { class: 'hint' }, `Đã đủ ${baiToiDa} bài. Xóa bớt bài chưa ưng để tạo bài mới.`),
      nutGoiY && h('div', { class: 'nutbam' }, nutGoiY)].filter(Boolean));
  }

  async function taoNhac(l, moTa, nut) {
    const kq = await dangLam(nut, 'Google đang làm nhạc (khoảng 1 phút)…', () => api.post('/doi-ai/nhac', { loai: l.id, mo_ta: moTa }));
    nhac = kq.nhac;
    toast(`Đã có ${l.ten.toLowerCase()} (${giay(kq.giay)}, khoảng ${tien(kq.chi_phi_usd)}). Bấm ▶ Nghe.`);
    veNhac();
  }

  function veNhac() {
    const cacDong = loaiNhac.map((l) => {
      const co = nhac[l.id];
      const oMoTa = h('textarea', { rows: 2, maxlength: 1500, 'aria-label': `Lời tả ${l.ten} gửi Google` }, co?.mo_ta || l.mo_ta_mac_dinh);
      const nutTao = h('button', { class: 'btn small', type: 'button' }, co ? '🎵 Tạo lại' : '🎵 Tạo');
      nutTao.addEventListener('click', () => taoNhac(l, oMoTa.value, nutTao).catch((e) => toast(e.message, true)));
      const nutNghe = co && h('button', { class: 'btn small', type: 'button' }, '▶ Nghe');
      nutNghe?.addEventListener('click', () => ngheNhac(l.id));
      const nutXoa = co && h('button', { class: 'btn small', type: 'button', title: 'Xóa nhạc này: đội bỏ qua loại nhạc này' }, '✕');
      nutXoa?.addEventListener('click', async () => {
        try { nhac = (await api.del(`/doi-ai/nhac/${l.id}`)).nhac; veNhac(); } catch (e) { toast(e.message, true); }
      });
      const tinhTrang = co ? `${giay(co.giay)}${co.loi_bai ? ` · lời: "${co.loi_bai.split('\n').join(' ')}"` : ''}` : 'chưa có';
      return { l, oMoTa, el: h('div', { class: 'doi-ai-nhac-dong' },
        h('p', {}, h('b', {}, l.ten), h('span', { class: 'muted' }, ` · ${tinhTrang}`)),
        h('p', { class: 'hint' }, `Phát: ${l.khi.toLowerCase()}.`),
        oMoTa,
        h('div', { class: 'nutbam' }, nutTao, nutNghe, nutXoa)) };
    });
    const thieu = cacDong.filter((x) => !nhac[x.l.id]);
    const nutCaBo = thieu.length > 1 && h('button', { class: 'btn primary', type: 'button' }, `🎵 Tạo cả bộ (${thieu.length} bài, khoảng ${tien(0.08 * thieu.length)})`);
    nutCaBo && nutCaBo.addEventListener('click', async () => {
      try {
        const kq = await dangLam(nutCaBo, 'Google đang làm nhạc (khoảng 1–2 phút)…', () => Promise.allSettled(
          thieu.map((x) => api.post('/doi-ai/nhac', { loai: x.l.id, mo_ta: x.oMoTa.value }))));
        const hong = kq.filter((x) => x.status === 'rejected');
        const xong = kq.filter((x) => x.status === 'fulfilled').map((x) => x.value);
        if (xong.length) nhac = xong.at(-1).nhac;
        if (hong.length) toast(`Có ${hong.length} bài chưa làm được: ${hong[0].reason?.message || 'lỗi'}`, true);
        else toast('Đã có đủ bộ nhạc. Bấm ▶ Nghe từng bài.');
        nhac = (await api.get('/doi-ai')).nhac;
        veNhac();
      } catch (e) { toast(e.message, true); }
    });
    // replaceChildren in chữ "false" cho phần tử không có (đủ bộ nhạc thì không có nút "Tạo cả bộ"): lọc bỏ trước.
    khungNhac.replaceChildren(...[
      h('h4', {}, '🎵 Nhạc'),
      h('p', { class: 'hint' }, 'Google (Lyria) làm nhạc theo lời tả; MOZA cắt đúng đoạn cần dùng. Mỗi bài khoảng 2.000 đồng, làm một lần dùng mãi. '
        + 'Loại nào chưa có thì đội bỏ qua. Nhạc phát chen giữa, không chạy dưới giọng nói.'),
      ...cacDong.map((x) => x.el),
      nutCaBo && h('div', { class: 'nutbam' }, nutCaBo)].filter(Boolean));
  }

  function veEleven() {
    const tenCua = (id) => dsEleven?.find((g) => g.voice_id === id)?.ten || (id ? `mã ${id.slice(0, 6)}…` : 'chưa chọn');
    const oGioi = h('select', { 'aria-label': 'Giới tính giọng' }, h('option', { value: '' }, 'Nam và nữ'), h('option', { value: 'nu' }, 'Nữ'), h('option', { value: 'nam' }, 'Nam'));
    const nutTim = h('button', { class: 'btn small', type: 'button' }, 'Tìm giọng tiếng Việt');
    nutTim.addEventListener('click', async () => {
      try {
        dsEleven = (await dangLam(nutTim, 'Đang tìm…', () => api.get(`/doi-ai/giong-eleven?gioi=${oGioi.value}`))).giong;
        veEleven();
      } catch (e) { toast(e.message, true); }
    });
    const cacDong = (dsEleven || []).map((g) => {
      const nutNghe = h('button', { class: 'btn small', type: 'button', disabled: !g.nghe_thu }, '▶ Nghe');
      nutNghe.addEventListener('click', () => ngheDuongDan(g.nghe_thu));
      const oCho = h('select', { 'aria-label': `Dùng giọng ${g.ten} cho` }, ...ds.map((n, i) => h('option', { value: i }, n.ten || `Nhân vật ${i + 1}`)));
      const nutDung = h('button', { class: 'btn small', type: 'button' }, 'Dùng');
      nutDung.addEventListener('click', async () => {
        try {
          const kq = await dangLam(nutDung, '…', () => api.post('/doi-ai/giong-eleven', { owner_id: g.owner_id, voice_id: g.voice_id, ten: g.ten, nhan_vat: Number(oCho.value) }));
          ds = kq.nhan_vat;
          toast(`Đã dùng giọng ${g.ten} cho ${ds[Number(oCho.value)]?.ten}.`);
          ve();
        } catch (e) { toast(e.message, true); }
      });
      return h('div', { class: 'hang' },
        h('span', { class: 'grow' }, h('b', {}, g.ten), h('span', { class: 'muted' }, ` · ${g.gioi === 'nu' ? 'nữ' : g.gioi === 'nam' ? 'nam' : '?'}${g.giong_vung ? ` · ${g.giong_vung}` : ''}`)),
        nutNghe, oCho, nutDung);
    });
    khungEleven.replaceChildren(...[
      h('h4', {}, '🎙 Giọng ElevenLabs'),
      h('p', { class: 'hint' }, 'Chỉ dùng khi máy đọc giọng là ElevenLabs (cần khóa ElevenLabs ở Khóa AI). Giọng của Mai cũng là giọng Mai khi máy đọc nói thay. '
        + 'Đang chọn: ', ds.map((n) => `${n.ten}: ${tenCua(n.giong_eleven)}`).join(' · '), '.'),
      h('div', { class: 'nutbam' }, oGioi, nutTim),
      dsEleven && !dsEleven.length && h('p', { class: 'muted' }, 'Không thấy giọng tiếng Việt nào.'),
      ...cacDong].filter(Boolean));
  }

  const tenGiong = (g) => `${g.gioi === 'nu' ? 'Nữ' : g.gioi === 'nam' ? 'Nam' : '?'} · ${g.id}${g.phong_cach ? ` — ${g.phong_cach.replace(/\s*\(.*\)$/, '')}` : ''}`;
  const gioiCua = (id) => (daTao.find((g) => g.id === id) || kho.find((g) => g.id === id))?.gioi ?? null;

  function hang(n, i) {
    const oTen = h('input', { type: 'text', maxlength: 20, value: n.ten || '', disabled: i === 0, 'aria-label': 'Tên nhân vật',
      title: i === 0 ? 'Trợ lý AI chính: đổi tên ở ô "Tên AI" phía trên' : '' });
    const biet = daTao.some((g) => g.id === n.giong) || kho.some((g) => g.id === n.giong);
    const oGiong = h('select', { 'aria-label': `Giọng của ${n.ten || 'nhân vật'}` },
      ...(biet ? [] : [h('option', { value: n.giong }, n.giong)]),
      daTao.length && h('optgroup', { label: 'Giọng đã tạo' },
        ...daTao.map((g) => h('option', { value: g.id }, `${g.gioi === 'nu' ? 'Nữ' : g.gioi === 'nam' ? 'Nam' : '?'} · ${g.ten}`))),
      kho.length && h('optgroup', { label: 'Kho Google (giọng miền Nam)' }, ...kho.map((g) => h('option', { value: g.id }, tenGiong(g)))));
    oGiong.value = n.giong;
    const oNet = h('input', { type: 'text', maxlength: 120, value: n.net || '', placeholder: 'Nét riêng (không bắt buộc), ví dụ: vui tính, hay trêu', 'aria-label': 'Nét riêng' });
    const nutNghe = h('button', { class: 'btn small', type: 'button' }, '▶ Nghe thử');
    nutNghe.addEventListener('click', () => docThu(nutNghe, CAU_THU(oTen.value.trim() || 'mình'), oGiong.value));
    const nutXoa = h('button', { class: 'btn small', type: 'button', hidden: i === 0, title: 'Bỏ nhân vật này' }, '✕');
    nutXoa.addEventListener('click', () => {
      if (ds.length <= gioiHan.toi_thieu) return toast(`Đội cần ít nhất ${gioiHan.toi_thieu} nhân vật.`, true);
      doc();
      ds.splice(i, 1);
      ve();
    });
    const doc1 = () => ({ ten: oTen.value.trim(), giong: oGiong.value, gioi: gioiCua(oGiong.value) ?? n.gioi ?? null, net: oNet.value.trim(), giong_eleven: n.giong_eleven || null });
    return { el: h('div', { class: 'hang doi-ai-hang' },
      h('label', { class: 'field', style: 'flex:0 1 130px' }, h('span', {}, i === 0 ? 'Trợ lý chính' : `Nhân vật ${i + 1}`), oTen),
      h('label', { class: 'field grow' }, h('span', {}, 'Giọng'), oGiong),
      h('label', { class: 'field grow' }, h('span', {}, 'Nét riêng'), oNet),
      h('div', { class: 'nutbam' }, nutNghe, nutXoa)), doc1 };
  }

  let cacHang = [];
  // Đọc lại các ô đang gõ vào danh sách trước khi vẽ lại (thêm, bỏ nhân vật).
  const doc = () => { ds = cacHang.map((x) => x.doc1()); };

  function ve() {
    cacHang = ds.map(hang);
    const nutThem = h('button', { class: 'btn small', type: 'button', disabled: ds.length >= gioiHan.toi_da }, '＋ Thêm nhân vật');
    nutThem.addEventListener('click', () => {
      doc();
      const nam = ds.filter((x) => x.gioi === 'nam').length < ds.filter((x) => x.gioi === 'nu').length;
      const g = kho.find((x) => x.gioi === (nam ? 'nam' : 'nu') && !ds.some((n) => n.giong === x.id)) || kho[0];
      ds.push({ ten: '', giong: g?.id || ds[0].giong, gioi: g?.gioi || null, net: '' });
      ve();
    });
    const nutLuu = h('button', { class: 'btn primary', type: 'button' }, 'Lưu đội AI');
    nutLuu.addEventListener('click', async () => {
      doc();
      try {
        const kq = await dangLam(nutLuu, 'Đang lưu…', () => api.put('/doi-ai/nhan-vat', { nhan_vat: ds }));
        ds = kq.nhan_vat;
        toast('Đã lưu đội AI.');
        ve();
      } catch (e) { toast(e.message, true); }
    });
    // Giọng Bắc (#50): không bắt buộc — nhân vật còn dùng giọng kho thì có nút tạo giọng Bắc theo mô tả (Google, khoảng 30 giây).
    const nutBac = canBac.length && h('button', { class: 'btn', type: 'button', title: `Tạo giọng Bắc cho ${canBac.join(', ')}` },
      `🎙 Tạo giọng Bắc (${canBac.length} người)`);
    if (nutBac) {
      nutBac.addEventListener('click', async () => {
        doc();
        try {
          await api.put('/doi-ai/nhan-vat', { nhan_vat: ds }); // lưu nét riêng vừa gõ: câu tả giọng dựa vào đó
          const kq = await dangLam(nutBac, 'Google đang tạo giọng (khoảng 30 giây)…', () => api.post('/doi-ai/tao-giong-bac', {}));
          toast(`Đã tạo ${kq.tao_moi} giọng Bắc (${vnd(kq.chi_phi_usd)}). Bấm ▶ Nghe thử từng người.`);
          await taiLai();
        } catch (e) { toast(e.message, true); }
      });
    }
    khung.replaceChildren(
      h('p', { class: 'hint' }, 'Vai trong từng đoạn (ai hỏi, ai đáp, ai pha trò) do kịch bản quyết. Mọi nhân vật tự giới thiệu là trợ lý AI khi mở màn.'),
      canBac.length && h('p', { class: 'hint' }, 'Giọng trong kho của Google nghe ra giọng miền Nam. Muốn giọng Bắc chuẩn Hà Nội thì bấm "🎙 Tạo giọng Bắc": '
        + 'Google tạo giọng theo nét riêng của từng người (mỗi giọng khoảng 700 đồng, giữ 1 năm).'),
      ...cacHang.map((x) => x.el),
      h('div', { class: 'nutbam' }, nutThem, nutLuu, nutBac),
      khungEleven,
      khungNhac,
      khungBai);
    veEleven();
  }

  async function taiLai() {
    const [d, k] = await Promise.all([api.get('/doi-ai'), kho.length ? { giong: kho } : api.get('/giong-mai/kho?gioi=&tim=').catch(() => ({ giong: [] }))]);
    ds = d.nhan_vat;
    kho = k.giong || [];
    daTao = d.giong_da_tao || [];
    canBac = d.can_giong_bac || [];
    gioiHan = { toi_thieu: d.toi_thieu, toi_da: d.toi_da };
    nhac = d.nhac || {};
    loaiNhac = d.loai_nhac || [];
    baiHat = d.bai_hat || [];
    kieuBai = d.kieu_bai || [];
    goiYBai = d.goi_y_bai || [];
    baiToiDa = d.bai_toi_da || 8;
    ve();
    veNhac();
    veBai();
  }

  taiLai().catch((e) => khung.replaceChildren(h('p', { class: 'loi' }, e.message)));
  return khung;
}
