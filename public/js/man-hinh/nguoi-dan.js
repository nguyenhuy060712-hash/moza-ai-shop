// Màn hình người dẫn (SPEC.md F-16) — BH11 "chế độ sân khấu" (F-126): nền tối, chữ to, đọc được từ xa khi đang cầm điện thoại live.
// Đang live thì ẩn menu trái và thanh trên; lưới cố định không cuộn (vừa 1366 × 768):
//   thanh mảnh (nd-thanh.js) · vùng 1 món đang bán (nd-mon.js) · vùng 2 thẻ gợi ý của Mai (nd-goi-y.js) · vùng 3 "Tiếp theo" ·
//   cột phải: cảnh báo, bảng huấn luyện, Vừa chốt, bình luận lọc — chạm để Mai soạn (nd-ben-phai.js).
// Nội dung phụ (lời nhắc đầy đủ, câu hỏi nổi bật, Hỏi Mai, tập, Lên sóng, MOZA nhìn) vào ngăn kéo: phím N (hoặc /: Hỏi Mai).
// Phím giữ nguyên: Cách = DỪNG AI (chạy cả khi con trỏ không ở ô nhập), ←/→ chuyển đoạn, Enter nhận gợi ý (MOZA nhìn / chiếu), 1/2/3 cảnh.
// Không bật hộp thoại nào che màn hình trong lúc live. Cảnh báo nguy cấp (mất mạng / OBS, hết hàng món đang bán, Mai lỗi) mới có dải
// đỏ + tiếng. Micro (F-21), Mai nói (F-22), Mai dẫn chính (F-43), Đội AI dẫn (F-46), Lên sóng (#90) như trước.
// Cỡ chữ con số chính: token --nd-so-chinh (mặc định 80 px); trang thử #/nguoi-dan?thu-co-chu hiện 64 / 80 / 96 px để chủ dự án chọn.

import { api } from '../api.js';
import { h, toast, dangLam } from '../ui.js';
import { gui, dangMo } from '../ws.js';
import { tien } from '../dinh-dang.js';
import { Micro } from '../micro.js';
import { Loa } from '../loa.js';
import { taoLenSong } from './len-song.js';
import { taoThanh } from './nd-thanh.js';
import { taoMon, chuDoc } from './nd-mon.js';
import { taoGoiY } from './nd-goi-y.js';
import { taoBenPhai } from './nd-ben-phai.js';

let st = null;
const CO_CHU = [64, 80, 96];
const KHOA_CO_CHU = 'moza.nd_co_chu';

function coChu() {
  try { const v = Number(localStorage.getItem(KHOA_CO_CHU)); return CO_CHU.includes(v) ? v : 80; } catch { return 80; }
}

export function roi() {
  document.body.classList.remove('nd-san-khau');
  if (!st) return;
  window.removeEventListener('moza:ws', st.nghe);
  window.removeEventListener('keydown', st.phim);
  window.removeEventListener('moza:am', st.am);
  clearInterval(st.dongHo);
  st.tatMicro?.();
  st.loa?.tat();
  st = null;
}

/** Trang thử cỡ chữ (F-126): ba cỡ con số chính cạnh nhau — chủ dự án đứng cách laptop 2 m chọn, máy nhớ trên máy này. */
async function veThuCoChu(khung) {
  const r = await api.get('/live/phien/hien-tai').catch(() => ({}));
  const x = r.phien?.kich_ban?.doan?.find((d) => d.san_pham)?.san_pham || { so: 12, ten: 'Sơ mi linen tay ngắn', gia: 289000 };
  const dang = coChu();
  const cot = (co) => h('div', { class: `nd-thu-cot${co === dang ? ' dang' : ''}`, style: `--nd-so-chinh:${co}px` },
    h('span', { class: 'nd-nhan' }, `${co} px${co === 80 ? ' · mặc định' : ''}`),
    h('div', { class: 'nd-sk-mon-dau' }, h('span', { class: 'nd-sk-so' }, `Số ${x.so}`), h('span', { class: 'nd-sk-gia' }, tien(x.gia))),
    h('p', { class: 'nd-sk-ten' }, x.ten),
    h('div', { class: 'nd-sk-ton' }, h('span', { class: 'nd-sk-ton-o' }, 'Đen/M ', h('b', {}, '4')), h('span', { class: 'nd-sk-ton-o it' }, 'Trắng/L ', h('b', {}, '1')), h('span', { class: 'nd-sk-ton-o het' }, 'Be/S ', h('b', {}, 'hết'))),
    h('button', { class: `btn ${co === dang ? 'primary' : ''}`, type: 'button', onclick: () => {
      try { localStorage.setItem(KHOA_CO_CHU, String(co)); } catch { /* trình duyệt chặn lưu: dùng mặc định */ }
      toast(`Đã chọn cỡ ${co} px cho Màn hình người dẫn`);
      veThuCoChu(khung);
    } }, co === dang ? 'Đang dùng' : 'Dùng cỡ này'));
  khung.replaceChildren(h('div', { class: 'nd-thu' },
    h('p', { class: 'nd-lon' }, 'Thử cỡ chữ Màn hình người dẫn'),
    h('p', {}, 'Đứng cách laptop khoảng 2 mét. Cột nào đọc rõ số món, giá và số còn hàng mà không phải nheo mắt thì bấm "Dùng cỡ này".'),
    h('div', { class: 'nd-thu-luoi' }, ...CO_CHU.map(cot)),
    h('a', { class: 'btn', href: '#/nguoi-dan' }, 'Về Màn hình người dẫn')));
}

export async function ve(khung) {
  roi();
  if (/[?&]thu-co-chu/.test(location.hash)) { st = { phim: () => {}, nghe: () => {} }; await veThuCoChu(khung); return; }
  const r = await api.get('/live/phien/hien-tai');
  st = { phien: r.phien, binhLuan: r.binh_luan || [], dem: r.dem || {}, ai: r.ai || {}, cachDoc: r.cach_doc, choTv: [], dangDoi: false,
    mieng: r.mieng || { trang_thai: 'tat' }, luaChonMieng: r.lua_chon_mieng || [], doi: r.doi_ai || { trang_thai: 'tat' }, nguyCap: new Map(), canh: null };
  document.body.classList.toggle('nd-san-khau', st.phien?.trang_thai === 'dang_live');

  if (!st.phien || st.phien.trang_thai !== 'dang_live') {
    khung.replaceChildren(h('div', { class: 'nd-trong' },
      h('p', { class: 'nd-lon' }, st.phien ? 'Đang chờ live bắt đầu trên Page…' : 'Chưa có buổi live nào đang phát'),
      h('p', {}, st.phien ? 'Live bắt đầu là màn hình này tự hiện nội dung.' : 'Tạo phiên ở màn hình Livestream trước. Muốn tập với Mai: vào Phòng diễn tập, bấm "Bắt đầu tập".'),
      h('div', { class: 'nutbam' }, h('a', { class: 'btn primary', href: '#/live/dien-tap' }, 'Vào Phòng diễn tập'), h('a', { class: 'btn', href: '#/live' }, 'Về Livestream'),
        h('a', { class: 'btn', href: '#/nguoi-dan?thu-co-chu' }, 'Thử cỡ chữ'))));
    st.nghe = (e) => { if (e.detail.type === 'live.bat_dau') ve(khung); };
    window.addEventListener('moza:ws', st.nghe);
    st.phim = () => {};
    return;
  }

  const p = st.phien;
  const aiTat = p.che_do_ai === 'tat';
  const maiNoi = () => st.phien.che_do_ai === 'noi';
  const maiDan = () => maiNoi() && !!st.phien.mai_dan; // Mai dẫn chính (bản 2.7)
  const doiDan = () => !!st.phien.doi_ai; // Đội AI dẫn (bản 2.9)
  // "Dừng mọi thứ" / "Dừng AI" (chạm trần) đang bật: đọc từ công tắc và dải đỏ của app.js.
  const aiDangDung = () => aiTat || !!document.getElementById('khanCap')?.checked || document.getElementById('bangDungAi')?.hidden === false;

  // ---- cảnh báo nguy cấp: dải đỏ + tiếng (chỉ khi có lý do MỚI) ----
  const eNguy = h('div', { class: 'nd-sk-nguy', role: 'alert', hidden: true });
  const tiengBao = () => {
    try {
      const ac = new AudioContext();
      [0, 0.22].forEach((t) => { const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = 880; g.gain.value = 0.15;
        o.connect(g).connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.15); });
      setTimeout(() => ac.close().catch(() => {}), 800);
    } catch { /* trình duyệt chặn tiếng: vẫn có dải đỏ */ }
  };
  const datNguy = (khoa, chu) => {
    const co = st.nguyCap.has(khoa);
    if (chu) st.nguyCap.set(khoa, chu); else st.nguyCap.delete(khoa);
    eNguy.hidden = !st.nguyCap.size;
    eNguy.textContent = [...st.nguyCap.values()].join(' · ');
    if (chu && !co) tiengBao();
  };

  // ---- Mai nói (F-22): chế độ, trạng thái miệng, loa, chữ Mai đang nói ----
  const oCheDo = h('select', { class: 'nd-che-do', title: 'Đổi chế độ AI giữa buổi live' },
    h('option', { value: 'goi_y' }, 'Chỉ gợi ý'),
    h('option', { value: 'doi' }, 'Đội AI dẫn (nhiều giọng) — bạn dẫn phụ'),
    h('optgroup', { label: 'Mai cùng dẫn — bạn dẫn chính' },
      ...st.luaChonMieng.map((m) => h('option', { value: `noi:${m.model}` }, `Mai nói · ${m.ten}`))),
    h('optgroup', { label: 'Mai dẫn chính — bạn dẫn phụ' },
      ...st.luaChonMieng.map((m) => h('option', { value: `dan:${m.model}` }, `Mai dẫn chính · ${m.ten}`))));
  const eCheDoLoi = h('span', { class: 'nd-loi-hoi', role: 'alert' });
  const eMieng = h('span', { class: 'chip mute', hidden: true });
  const nutLoa = h('button', { class: 'btn small', type: 'button', hidden: true, title: 'Trình duyệt cần một cú bấm trước khi phát tiếng' }, '🔈 Bật loa');
  const eMaiNoi = h('p', { class: 'nd-mai-noi nd-sk-dong', hidden: true });
  const eDan = h('span', { class: 'chip ok', hidden: true });
  const nutDanTiep = h('button', { class: 'btn small primary', type: 'button', hidden: true, title: 'Mai dẫn tiếp từ đoạn đang nói' }, '▶ Mai dẫn tiếp');
  let maiDangPhat = false;
  const loa = new Loa({ khiDoiPhat: (b) => { maiDangPhat = b; veMieng(); } });
  st.loa = loa;
  const eHuongDan = h('span', { class: 'nd-sk-phim' });
  const veCheDo = () => {
    oCheDo.value = doiDan() ? 'doi' : maiDan() ? `dan:${st.phien.mieng}` : maiNoi() ? `noi:${st.phien.mieng}` : 'goi_y';
    eHuongDan.textContent = `${doiDan() ? 'Cách: đội thôi dẫn' : maiDan() ? 'Cách: Mai thôi dẫn' : 'Cách: DỪNG AI'} · ←/→ chuyển đoạn · Enter nhận gợi ý · 1/2/3 cảnh · N ngăn kéo · / Hỏi Mai`;
  };
  function veMieng() {
    const t = st.mieng.trang_thai;
    eMieng.hidden = !maiNoi() && t !== 'loi';
    const [chu, mau] = maiDangPhat ? ['● Mai đang nói', 'ok dang-noi'] : {
      dang_mo: ['Mai đang mở…', 'mute'],
      san_sang: ['Mai sẵn sàng', 'ok'],
      noi_lai: ['Mai đang nối lại…', 'warn'],
      loi: ['Mai lỗi — đã về Chỉ gợi ý', 'bad'],
    }[t] || ['Mai đang mở…', 'mute'];
    eMieng.className = `chip ${mau}`;
    eMieng.textContent = chu;
    eMieng.title = st.mieng.ly_do || '';
    nutLoa.hidden = !(maiNoi() || doiDan()) || loa.duocPhat();
    datNguy('mai', t === 'loi' ? `Mai lỗi${st.mieng.ly_do ? `: ${st.mieng.ly_do}` : ''} — đã về Chỉ gợi ý, bạn tự đọc gợi ý` : null);
    veDan();
    veDen();
  }
  function veDan() {
    const d = doiDan() ? (st.doi.trang_thai !== 'tat' ? st.doi : null) : maiDan() && st.mieng.trang_thai === 'san_sang' ? st.mieng.dan : null;
    const ai = doiDan() ? 'Đội AI' : 'Mai';
    eDan.hidden = !d;
    nutDanTiep.hidden = !d || d.trang_thai !== 'tam_dung';
    nutDanTiep.textContent = doiDan() ? '▶ Dẫn tiếp' : '▶ Mai dẫn tiếp';
    if (!d) return;
    const dung = d.trang_thai === 'tam_dung';
    eDan.className = `chip ${dung ? 'warn' : 'ok'}`;
    eDan.textContent = dung ? `${ai} tạm dừng dẫn` : `${ai} đang dẫn${d.vong > 1 ? ` · vòng ${d.vong}` : ''}`;
    eDan.title = d.ly_do || (dung ? `Bấm "${nutDanTiep.textContent}" để ${ai} dẫn lại` : `Bạn nói xen lúc nào cũng được; phím cách để ${ai} thôi dẫn`);
  }
  nutDanTiep.addEventListener('click', async () => {
    eCheDoLoi.textContent = '';
    batLoa();
    try {
      const kq = await api.post(`/live/phien/${p.id}/mai-dan-tiep`);
      if (kq.doi_ai) st.doi = kq.doi_ai;
      else st.mieng = { ...st.mieng, ...kq.mieng };
    } catch (x) { eCheDoLoi.textContent = x.message; }
    veMieng();
  });
  async function batLoa() {
    try { await loa.bat(); } catch { /* trình duyệt chặn: nút Bật loa vẫn hiện */ }
    veMieng();
  }
  nutLoa.addEventListener('click', batLoa);
  oCheDo.addEventListener('change', async () => {
    eCheDoLoi.textContent = '';
    const [cheDo, model] = oCheDo.value.split(':');
    try {
      st.phien = (await api.put(`/live/phien/${p.id}/che-do`, { che_do_ai: cheDo, mieng: model || null })).phien;
      if (cheDo !== 'goi_y') await batLoa(); // cú bấm này cũng cho phép trình duyệt phát tiếng
    } catch (x) { eCheDoLoi.textContent = x.message; }
    veCheDo();
    veMieng();
    veNoiBat();
    mon.veDoan();
  });
  const hienMaiNoi = (chu) => {
    eMaiNoi.hidden = !chu;
    eMaiNoi.classList.remove('nhieu-dong');
    eMaiNoi.textContent = chu ? `Mai: ${chu}` : '';
  };
  const TEN_NHAC = {
    hieu: 'Nhạc hiệu', chuyen: 'Nhạc chuyển cảnh', do_vui: 'Nhạc đố vui — chờ người xem bình luận đáp án', dung: 'Tiếng chúc mừng',
    hieu_radio: 'Nhạc hiệu Radio', bai_hat: 'Bài hát',
  };
  const hienDoiNoi = (luot = [], nhac = null, bai = null) => {
    eMaiNoi.hidden = !luot.length && !nhac;
    eMaiNoi.classList.add('nhieu-dong');
    eMaiNoi.textContent = nhac ? `♪ ${TEN_NHAC[nhac] || 'Nhạc'}${bai ? `: ${bai}` : ''}` : luot.map((l) => `${l.ai}: ${chuDoc(l.loi)}`).join('\n');
  };
  st.am = (e) => loa.phat(e.detail);
  window.addEventListener('moza:am', st.am);

  // ---- Micro và chép lời người dẫn ----
  const nutMic = h('button', { class: 'btn small', type: 'button', disabled: aiTat, title: aiTat ? 'AI đang tắt trong phiên này' : null }, '🎙 Bật micro');
  const eMic = h('span', { class: 'chip mute', hidden: true });
  const eNoi = h('span', { class: 'nd-dang-noi-dau', hidden: true }, '● Bạn đang nói');
  const eVach = h('span', { class: 'nd-vach-mic', hidden: true }, h('span', {}));
  const eLoiDan = h('p', { class: 'nd-loi-dan nd-sk-dong', hidden: true });
  let micro = null;
  const veNoi = (b) => { eNoi.hidden = !b; };
  const veMic = (trangThai, nha = null, lyDo = '') => {
    eMic.hidden = !micro && trangThai !== 'tu_choi';
    const TEN = { gemini: 'Gemini', openai: 'OpenAI', mieng: 'Mai' };
    const [chu, mau] = {
      dang_nghe: [`Đang nghe${nha ? ` · ${TEN[nha] || nha}` : ''}`, 'ok'],
      dang_mo: ['Đang mở chép lời…', 'mute'],
      loi: ['Chép lời lỗi — live vẫn chạy', 'warn'],
      tu_choi: ['Micro tắt', 'mute'],
      tat: ['Micro tắt', 'mute'],
    }[trangThai] || ['Micro', 'mute'];
    eMic.className = `chip ${mau}`;
    eMic.textContent = chu;
    eMic.title = lyDo || '';
  };
  const hienLoiDan = (chu, kieu = '') => {
    eLoiDan.hidden = !chu;
    eLoiDan.className = `nd-loi-dan nd-sk-dong ${kieu}`;
    eLoiDan.textContent = chu;
  };
  async function batMicro() {
    micro = new Micro({
      khiCoTieng: (pcm) => gui(pcm),
      khiDoiNoi: (b) => { gui({ type: 'nguoi_dan_noi', bat: b }); veNoi(b); },
      khiMuc: (rms) => { eVach.firstChild.style.width = `${Math.min(100, rms * 500)}%`; },
    });
    try {
      const ten = await micro.bat();
      nutMic.title = ten;
    } catch {
      micro = null;
      hienLoiDan('Trình duyệt không được dùng micro. Bấm biểu tượng ổ khóa cạnh địa chỉ trang → cho phép Micro.', 'loi');
      return;
    }
    nutMic.textContent = '🎙 Tắt micro';
    nutMic.classList.add('dang-bat');
    eVach.hidden = false;
    veMic('dang_mo');
    gui({ type: 'mic.bat', phien_id: p.id });
  }
  function tatMicro(baoMayChu = true) {
    if (!micro) return;
    micro.tat();
    micro = null;
    if (baoMayChu) gui({ type: 'mic.tat' });
    nutMic.textContent = '🎙 Bật micro';
    nutMic.classList.remove('dang-bat');
    eVach.hidden = true;
    veNoi(false);
    veMic('tat');
  }
  st.tatMicro = () => tatMicro();
  nutMic.addEventListener('click', () => (micro ? tatMicro() : batMicro()));
  const eHetLive = h('div', { class: 'nd-het', hidden: true });

  // ---- ngăn kéo: nội dung phụ ----
  const eNgan = h('aside', { class: 'nd-sk-ngan', hidden: true, 'aria-label': 'Ngăn kéo' });
  const moNgan = (mo = eNgan.hidden) => { eNgan.hidden = !mo; if (!mo && eNgan.contains(document.activeElement)) document.activeElement.blur(); };

  // Hỏi Mai bằng chữ. Enter để gửi; lỗi hiện ngay cạnh ô, không bật hộp thoại.
  const oHoi = h('input', { type: 'text', maxlength: 500, placeholder: aiTat ? 'AI đang tắt trong phiên này' : 'Hỏi Mai… (Enter để gửi, Esc để thoát ô)', disabled: aiTat });
  const loiHoi = h('span', { class: 'nd-loi-hoi', role: 'alert' });
  const formHoi = h('form', { class: 'nd-hoi-mai' }, h('span', { class: 'nd-nhan' }, 'Hỏi Mai'), oHoi,
    h('button', { class: 'btn small', type: 'submit', disabled: aiTat }, 'Gửi'), loiHoi);
  formHoi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cau = oHoi.value.trim();
    if (!cau) return;
    loiHoi.textContent = '';
    try {
      const kq = await api.post(`/live/phien/${p.id}/hoi-mai`, { cau_hoi: cau });
      if (kq.bo_qua) loiHoi.textContent = kq.ly_do;
      else oHoi.value = '';
    } catch (x) { loiHoi.textContent = x.message; }
    oHoi.blur();
  });

  // Buổi tập (bản 2.5, F-39): người dẫn giả hỏi Mai — tiếng giả đi vào micro của MOZA, trang phát tiếng người dẫn giả ra loa.
  // {so}, {goi}, {co} lấy theo sản phẩm của đoạn đang nói (người xem gọi món bằng số, #60). Chỉ có ở phiên diễn tập.
  const eTap = h('div', { class: 'nd-tap', hidden: !p.dien_tap || aiTat });
  const eTapTT = h('span', { class: 'nd-loi-hoi', role: 'status' });
  if (p.dien_tap && !aiTat) {
    const noiGia = async (nut, chu) => {
      eTapTT.textContent = '';
      batLoa();
      const cu = nut.textContent;
      nut.disabled = true;
      nut.textContent = 'Đang tạo tiếng…';
      try {
        await api.post('/dien-tap/noi', { chu });
      } catch (x) { eTapTT.textContent = x.message; } finally {
        nut.disabled = false;
        nut.textContent = cu;
      }
    };
    const MAU = [
      ['Hỏi giá', 'Mai ơi, {goi} số {so} giá bao nhiêu vậy em?'],
      ['Hỏi size', 'Mai ơi, khách cao 1m58 nặng 50 cân thì mặc size nào em?'],
      ['Hỏi chất liệu', 'Mai ơi, {goi} số {so} chất vải gì vậy em?'],
      ['Nhờ Mai chào', 'Mai ơi, em chào cả nhà một câu đi.'],
      ['Nói xen', 'Chị nói thêm một chút: mẫu này vải mát lắm, ai ưng thì bình luận chốt số {so} kèm màu và size nha.'],
    ];
    const oGia = h('input', { type: 'text', maxlength: 600, placeholder: 'Hoặc gõ câu người dẫn giả nói, bắt đầu bằng "Mai ơi, …"' });
    const nutGia = h('button', { class: 'btn small', type: 'button' }, 'Nói');
    nutGia.addEventListener('click', () => { if (oGia.value.trim()) noiGia(nutGia, oGia.value.trim()); });
    oGia.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nutGia.click(); } });
    eTap.replaceChildren(h('span', { class: 'nd-nhan' }, 'Tập · người dẫn giả hỏi Mai'),
      ...MAU.map(([ten, chu]) => {
        const n = h('button', { class: 'btn small', type: 'button', title: chu }, ten);
        n.addEventListener('click', () => noiGia(n, chu));
        return n;
      }),
      oGia, nutGia, eTapTT);
  }

  // Câu hỏi nổi bật (tối đa 3) do Director gom.
  const eNoiBat = h('div', { class: 'nd-noi-bat' });
  function veNoiBat() {
    const ds = st.ai.cau_hoi || [];
    eNoiBat.hidden = aiTat;
    eNoiBat.replaceChildren(h('span', { class: 'nd-nhan' }, 'Câu hỏi nổi bật'),
      ...(ds.length ? ds.map((c) => h('div', { class: `nd-noi-bat-dong${c.da_goi_y ? ' xong' : ''}` },
        h('span', { class: 'nd-so-nguoi', title: 'Số người hỏi' }, `${c.binh_luan_ids.length}`),
        h('span', { class: 'nd-noi-bat-chu' }, c.cau_hoi),
        c.so && h('span', { class: 'chip mute' }, `số ${c.so}`),
        c.da_goi_y && h('span', { class: 'chip ok' }, doiDan() ? 'Đội AI sẽ trả lời' : maiDan() ? 'Đã giao Mai' : maiNoi() ? 'Mai đã trả lời' : 'Đã có gợi ý')))
        : [h('p', { class: 'mo' }, 'Chưa có câu hỏi nào nhiều người hỏi.')]));
  }
  const eChoTv = h('div', { class: 'nd-cho-tv' });
  async function taiChoTv() {
    try { st.choTv = (await api.get('/live/cho-tu-van')).binh_luan.filter((b) => b.phien_id === p.id); } catch { /* không bật hộp thoại trong lúc live */ }
    const ds = st.choTv.slice(0, 4);
    eChoTv.hidden = !ds.length;
    eChoTv.replaceChildren(h('span', { class: 'nd-nhan' }, `Chờ Tư vấn viên (${st.choTv.length})`),
      ...ds.map((b) => h('p', {}, h('b', {}, b.ten), ` · ${b.noi_dung.slice(0, 60)}`)));
  }
  // F-92: người đang chờ hàng (bấm "Vẫn chờ" trên thẻ hết hàng).
  const eChoHang = h('p', { class: 'hint', hidden: true });
  const taiChoHang = () => api.get(`/cho-hang?dien_tap=${st.phien?.dien_tap ? '1' : '0'}`).then((kq) => {
    eChoHang.hidden = !kq.tom_tat.length;
    eChoHang.textContent = kq.tom_tat.length ? `Chờ hàng: ${kq.tom_tat.slice(0, 4).map((x) => `số ${x.so} ${x.loai} · ${x.so_nguoi} người`).join(' · ')}` : '';
  }).catch(() => {});

  // ---- các khối ----
  const lenSong = taoLenSong({ soDangNoi: () => st?.phien?.kich_ban.doan[st.phien.doan_hien_tai]?.san_pham?.so ?? null,
    khiDoiCanh: (c) => {
      const noi = !!c.obs?.ket_noi;
      // Mất OBS giữa buổi (đã nối rồi rớt) mới là nguy cấp; chưa nối từ đầu thì chỉ đèn xám.
      if (st.canh?.obs?.ket_noi && !noi) datNguy('obs', 'Mất kết nối OBS — kiểm OBS trên máy này');
      if (noi) datNguy('obs', null);
      st.canh = c;
      veDen();
    } });
  async function doiDoan(buoc) {
    const moi = st.phien.doan_hien_tai + buoc;
    if (st.dangDoi || moi < 0 || moi >= st.phien.kich_ban.doan.length) return;
    st.dangDoi = true;
    try {
      st.phien = (await api.post(`/live/phien/${p.id}/doan`, { doan: moi })).phien;
      mon.veDoan();
    } catch { /* không bật hộp thoại trong lúc live; lần bấm sau thử lại */ } finally {
      st.dangDoi = false;
    }
  }
  const mon = taoMon({ st, doiDoan, khiHetHang: (chu) => datNguy('het_hang', chu),
    nhanDan: () => (doiDan() ? 'Đội AI đang dẫn' : maiDan() ? 'Mai đang dẫn' : 'Đang bán') });
  const goiY = taoGoiY({ st, p, aiTat, doiDan, maiDan });
  const chuyenTheoNhin = async () => {
    const g = st.goiYNhin;
    if (!g) return;
    benPhai.veGoiYNhin(null);
    try { st.phien = (await api.post(`/live/phien/${p.id}/doan`, { doan: g.doan })).phien; mon.veDoan(); } catch (e) { toast(e.message, true); }
  };
  const benPhai = taoBenPhai({ st, p, choCham: () => !aiDangDung(), cham: (bl) => goiY.cham(bl), chuyenTheoNhin });
  const nutDung = () => dungAi();
  const thanh = taoThanh({ p, dungAi: nutDung, moNganKeo: () => moNgan(true),
    cheDo: [aiTat ? h('span', { class: 'chip mute' }, 'AI tắt') : oCheDo, eCheDoLoi, eMieng, eDan, nutDanTiep, nutLoa],
    mic: [eNoi, eVach, eMic, nutMic] });

  // Đèn: Facebook theo cách đọc bình luận, OBS theo Lên sóng, AI theo chế độ + công tắc dừng, mạng theo /ws.
  function veDen() {
    const dangDung = aiDangDung();
    thanh.veDen({
      fb: st.cachDoc === 'truc_tiep' ? ['ok', p.dien_tap ? 'Facebook giả · bình luận trực tiếp' : 'bình luận trực tiếp']
        : st.cachDoc === 'hoi_dinh_ky' ? ['warn', 'luồng bình luận ngắt — MOZA hỏi Facebook 3 giây một lần'] : ['mute', 'chưa đọc bình luận'],
      obs: st.canh?.obs?.ket_noi ? ['ok', 'đã nối OBS'] : ['mute', 'chưa nối OBS (Cài đặt → OBS)'],
      ai: aiTat ? ['mute', 'phiên này tắt AI'] : st.mieng.trang_thai === 'loi' ? ['bad', 'Mai lỗi'] : dangDung ? ['warn', '"Dừng mọi thứ" hoặc "Dừng AI" đang bật'] : ['ok', 'AI chạy'],
      mang: dangMo() ? ['ok', 'nối máy chủ'] : ['bad', 'mất kết nối máy chủ'],
    });
  }

  // MOZA nhìn (F-107): nút bật theo buổi trong ngăn kéo (chỉ khi đã nối OBS, hoặc buổi tập có Camera giả).
  const eNhin = h('div', { class: 'nd-nhin', hidden: true });
  const dungBangMau = async () => {
    const ds = st.phien.kich_ban.doan.map((d, i) => ({ d, i })).filter((x) => x.d.san_pham?.anh_dai_dien)
      .sort((a, b) => Math.abs(a.i - st.phien.doan_hien_tai) - Math.abs(b.i - st.phien.doan_hien_tai));
    const dsMon = [...new Map(ds.map((x) => [x.d.san_pham.id, x.d.san_pham])).values()].slice(0, 10);
    if (!dsMon.length) throw new Error('Các món của buổi chưa có ảnh để làm bảng mẫu.');
    const cot = Math.min(5, dsMon.length); const hang = Math.ceil(dsMon.length / cot); const W = 240; const H = 300;
    const c = document.createElement('canvas'); c.width = cot * W; c.height = hang * H;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await Promise.all(dsMon.map((s, k) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => { const x = (k % cot) * W; const y = Math.floor(k / cot) * H; const t = Math.min(W / img.width, (H - 60) / img.height);
        g.drawImage(img, x + (W - img.width * t) / 2, y + 60, img.width * t, img.height * t); ok(); };
      img.onerror = ok;
      img.src = `/api/anh/${s.id}/${s.anh_dai_dien}`;
    })));
    dsMon.forEach((s, k) => { const x = (k % cot) * W; const y = Math.floor(k / cot) * H; g.fillStyle = '#e8505b'; g.fillRect(x + 6, y + 6, 90, 50); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText(String(s.so), x + 14, y + 46); });
    await api.post(`/nhin/${p.id}/bang-mau`, { anh: c.toDataURL('image/jpeg', 0.8), so: dsMon.map((s) => s.so) });
  };
  const veNhin = (tt) => {
    eNhin.hidden = !tt?.co_nguon;
    if (eNhin.hidden) return;
    const nut = h('button', { class: `btn small${tt.bat ? ' primary' : ''}`, type: 'button', 'aria-pressed': String(!!tt.bat) }, tt.bat ? '👁 MOZA đang nhìn' : '👁 MOZA nhìn');
    nut.addEventListener('click', async () => {
      try {
        if (!tt.bat) await dangLam(nut, 'Đang bật…', dungBangMau);
        veNhin(await api.post(`/nhin/${p.id}/bat`, { bat: !tt.bat }));
      } catch (e) { toast(e.message, true); }
    });
    eNhin.replaceChildren(nut, h('span', { class: 'muted' }, tt.bat ? `${tt.camera_gia ? 'Camera giả · ' : ''}chỉ gợi ý, bạn bấm mới chuyển · ${tt.lan_hoi} lần nhìn · ${(tt.chi_phi_usd || 0).toFixed(4)} USD` : 'Tắt: dùng ← → hoặc "Mai ơi áo 7"'));
  };

  eNgan.append(
    h('div', { class: 'nd-sk-ngan-dau' }, h('b', {}, 'Ngăn kéo'), h('span', { class: 'grow' }), h('button', { class: 'btn small', type: 'button', onclick: () => moNgan(false) }, '✕ Đóng (Esc)')),
    mon.eLoiNhac, formHoi, eTap, eNoiBat, eChoTv, eChoHang, eNhin, lenSong.el);

  // ---- DỪNG AI ----
  const eDungAi = h('div', { class: 'nd-da-dung', hidden: true }, 'ĐÃ DỪNG AI');
  let henDung;
  function hienDaDung() {
    eDungAi.hidden = false;
    clearTimeout(henDung);
    henDung = setTimeout(() => { eDungAi.hidden = true; }, 1500);
  }
  function dungAi() {
    hienDaDung();
    loa.xoa(400); // tắt tiếng ngay; bỏ cả gói tiếng đang trên đường tới
    hienMaiNoi('');
    st.ai.goi_y = null;
    st.ai.bao = null;
    goiY.ve();
    benPhai.veBao();
    api.post(`/live/phien/${p.id}/dung-ai`).catch(() => {});
  }

  st.phim = (e) => {
    const trongO = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (trongO) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    if (e.key === 'Escape' && !eNgan.hidden) { moNgan(false); return; }
    // F-107: mỗi lúc một gợi ý — ô "Đang cầm …?" đang hiện thì Enter là Chuyển.
    if (e.key === 'Enter' && st.goiYNhin) { e.preventDefault(); chuyenTheoNhin(); return; }
    if (lenSong.phim(e)) { e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); dungAi(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); doiDoan(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); doiDoan(-1); }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); moNgan(); }
    if (e.key === '/' && !aiTat) { e.preventDefault(); moNgan(true); oHoi.focus(); }
  };
  window.addEventListener('keydown', st.phim);

  st.nghe = (e) => {
    const m = e.detail;
    if (m.type === 'live.so_lieu' && (!m.phien_id || m.phien_id === p.id)) thanh.veSoLieu(m);
    if (m.type === 'khan_cap' || m.type === 'dung_ai') setTimeout(() => { veDen(); benPhai.veBl(); }, 300);
    if (m.phien_id && m.phien_id !== p.id) return;
    lenSong.nghe(m);
    benPhai.nghe(m);
    if (m.type === 'live.nhin') api.get(`/nhin/${p.id}`).then(veNhin).catch(() => {});
    if (m.type === 'kho.cap_nhat' || m.type === 'live.chot') {
      taiChoHang();
      const d = st.phien?.kich_ban.doan[st.phien.doan_hien_tai];
      if (d?.san_pham) mon.taiTon(d.san_pham.id);
    }
    if (m.type === 'live.binh_luan') {
      st.binhLuan = [m.binh_luan, ...st.binhLuan].slice(0, 50);
      st.dem.tong = (st.dem.tong || 0) + 1;
      if (m.binh_luan.nhan.includes('cau_hoi')) st.dem.cau_hoi = (st.dem.cau_hoi || 0) + 1;
      benPhai.veBl();
    }
    if (m.type === 'live.binh_luan_cap_nhat') {
      const cu = st.binhLuan.find((b) => b.id === m.binh_luan.id);
      if (cu && !cu.da_an && m.binh_luan.xu_ly === 'cho_tu_van') st.dem.cho_tu_van = (st.dem.cho_tu_van || 0) + 1;
      st.binhLuan = st.binhLuan.map((b) => (b.id === m.binh_luan.id ? { ...m.binh_luan, khach_cu: b.khach_cu, tra_loi_luc: m.binh_luan.tra_loi_luc ?? b.tra_loi_luc } : b));
      benPhai.veBl();
      taiChoTv();
    }
    if (m.type === 'live.cho_tu_van') { st.dem = m.dem; benPhai.veBl(); taiChoTv(); }
    if (m.type === 'live.cau_hoi') { st.ai.cau_hoi = m.cau_hoi; veNoiBat(); }
    if (m.type === 'live.goi_y') { st.ai.goi_y = m.goi_y; goiY.ve(); }
    if (m.type === 'live.goi_y_chua_chac') goiY.baoChuaChac(m);
    if (m.type === 'live.bao') { st.ai.bao = m.bao; benPhai.veBao(); }
    if (m.type === 'live.luong_binh_luan') { st.cachDoc = m.cach_doc; veDen(); }
    if (m.type === 'live.ai_dang') { st.ai.dang = m.dang; goiY.ve(); }
    if (m.type === 'live.doan' && m.doan !== st.phien.doan_hien_tai) {
      api.get('/live/phien/hien-tai').then((x) => { if (x.phien) { st.phien = x.phien; mon.veDoan(); } });
    }
    if (m.type === 'live.dung_ai') hienDaDung();
    if (m.type === 'ws.mo') { datNguy('mang', null); veDen(); if (micro) gui({ type: 'mic.bat', phien_id: p.id }); gui({ type: 'loa.bat' }); }
    if (m.type === 'live.che_do') {
      st.phien = { ...st.phien, che_do_ai: m.che_do_ai, mieng: m.mieng, mai_dan: !!m.mai_dan, doi_ai: !!m.doi_ai };
      if (!doiDan()) st.doi = { trang_thai: 'tat' };
      veCheDo();
      veMieng();
      veNoiBat();
      mon.veDoan();
      if (!maiNoi()) hienMaiNoi('');
    }
    if (m.type === 'live.doi_dan') { st.doi = { trang_thai: m.trang_thai, vong: m.vong, ly_do: m.ly_do }; veMieng(); }
    if (m.type === 'live.doi_noi') hienDoiNoi(m.luot, m.nhac, m.bai);
    if (m.type === 'live.mieng') {
      // Sự kiện miệng không kèm nhịp dẫn: giữ trạng thái "Mai dẫn chính" khi miệng vẫn sẵn sàng.
      st.mieng = { ...m, dan: m.trang_thai === 'san_sang' ? st.mieng.dan ?? null : null };
      if (m.trang_thai === 'tat' || m.trang_thai === 'loi') { loa.xoa(); hienMaiNoi(''); }
      veMieng();
    }
    if (m.type === 'live.mai_dan') { st.mieng = { ...st.mieng, dan: { trang_thai: m.trang_thai, vong: m.vong, ly_do: m.ly_do } }; veMieng(); }
    if (m.type === 'live.mai_noi') hienMaiNoi(m.chu);
    if (m.type === 'dien_tap.tieng_gia' && p.dien_tap) {
      if (m.loi) eTapTT.textContent = m.loi;
      else new Audio(`/api/dien-tap/tieng/${encodeURIComponent(m.id)}`).play().catch(() => {});
    }
    if (m.type === 'live.mai_ngat') loa.xoa();
    if (m.type === 'live.chep_loi') {
      if (m.trang_thai === 'tu_choi' || (m.trang_thai === 'tat' && m.ly_do && micro)) {
        tatMicro(false);
        hienLoiDan(m.ly_do || '', 'loi');
      } else veMic(m.trang_thai, m.nha, m.ly_do);
    }
    if (m.type === 'live.loi_nguoi_dan') hienLoiDan(`Bạn vừa nói: ${m.chu}`, m.tam ? 'tam' : '');
    if (m.type === 'live.goi_mai') {
      const nguon = maiNoi() && m.tu_nguoi_dan === false ? 'Mai trả lời người xem' : 'Mai nghe';
      hienLoiDan(m.ly_do ? `${nguon}: “${m.cau_hoi}” — ${m.ly_do}` : `${nguon}: “${m.cau_hoi}”`, 'goi-mai');
    }
    if (m.type === 'live.nguoi_dan_noi' && !micro) veNoi(m.bat);
    if (m.type === 'live.ket_thuc') {
      eHetLive.replaceChildren(h('p', { class: 'nd-lon' }, 'Live đã kết thúc'), h('p', {}, m.tom_tat || ''),
        h('a', { class: 'btn', href: '#/live' }, 'Về Livestream'));
      eHetLive.hidden = false;
      document.body.classList.remove('nd-san-khau');
      clearInterval(st.dongHo);
      tatMicro(false);
      loa.xoa();
    }
  };
  window.addEventListener('moza:ws', st.nghe);

  // Đồng hồ live + kiểm mạng mỗi giây (mất /ws > 3 giây là nguy cấp).
  let matMangTu = null;
  st.dongHo = setInterval(() => {
    thanh.nhip();
    if (dangMo()) { matMangTu = null; if (st.nguyCap.has('mang')) { datNguy('mang', null); veDen(); } } else {
      matMangTu = matMangTu || Date.now();
      if (Date.now() - matMangTu > 3000 && !st.nguyCap.has('mang')) { datNguy('mang', 'Mất kết nối máy chủ MOZA — kiểm cửa sổ đen còn chạy không'); veDen(); }
    }
  }, 1000);
  mon.veDoan();
  veNoiBat();
  benPhai.veBl();
  benPhai.veChot();
  goiY.ve();
  benPhai.veBao();
  taiChoTv();
  taiChoHang();
  veCheDo();
  veMieng();
  api.get(`/nhin/${p.id}`).then(veNhin).catch(() => {});
  api.get('/live/the-nhac').then(benPhai.veTheNhac).catch(() => {});
  api.get(`/live/phien/${p.id}/so-lieu`).then(thanh.veSoLieu).catch(() => {});
  api.get(`/live/phien/${p.id}/huan-luyen`).then((x) => benPhai.hl.cap(x)).catch(() => {});
  if (doiDan() && (st.doi.dang_noi?.length || st.doi.dang_nhac)) hienDoiNoi(st.doi.dang_noi, st.doi.dang_nhac, st.doi.dang_bai);
  gui({ type: 'loa.bat' });
  batLoa(); // đã bấm vào trang trước đó thì trình duyệt cho phát tiếng luôn; chưa thì hiện nút "Bật loa"

  khung.replaceChildren(h('div', { class: 'nd nd-sk', style: `--nd-so-chinh:${coChu()}px` },
    thanh.el,
    eNguy,
    h('div', { class: 'nd-sk-trai' }, mon.eMon, goiY.el, mon.eKe),
    benPhai.el,
    h('footer', { class: 'nd-sk-duoi' }, eMaiNoi, eLoiDan, eHuongDan),
    eNgan, eDungAi, eHetLive));
}
