// Bắt đầu live — 3 bước (GD1, F-122): 1) món bán (kịch bản) → 2) Mai dẫn thế nào (4 thẻ có hình) → 3) kiểm tra trước khi lên sóng
// (bảng Sẵn sàng thu gọn) → Lên sóng / Tập trước. Dùng đúng API phiên có sẵn (POST /live/phien). Kịch bản và Phòng diễn tập ở tab của Livestream.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam } from '../ui.js';
import { chipSp } from './san-pham.js';
import { chipMau } from '../trang-thai.js';
import { veTongGiong } from './tong-giong.js';

/** Chép chữ vào bộ nhớ tạm (nút "Chép"). */
export async function chep(chu) {
  try { await navigator.clipboard.writeText(chu); toast('Đã chép'); } catch { prompt('Chép câu này:', chu); }
}

export function veKiemTra() {
  const vung = h('div', { class: 'body' }, h('p', { class: 'muted' }, 'Đang kiểm…'));
  const dongKiem = (muc, x) => h('div', { class: 'kiem-tra-dong' },
    chipMau(muc, muc === 'bad' ? 'Đỏ' : 'Vàng'), h('span', {}, x.chu),
    x.nut && h('button', { class: 'btn small', type: 'button', onclick: async (e) => {
      try {
        if (x.nut.hanh_dong === 'tat_khan_cap') await dangLam(e.target, '…', () => api.post('/khan-cap', { bat: false }));
        if (x.nut.den) { location.hash = x.nut.den; return; }
        tai();
      } catch (er) { toast(er.message, true); }
    } }, x.nut.chu));
  const tai = async () => {
    let d;
    try { d = await api.get('/live/san-sang'); } catch (e) { vung.replaceChildren(h('p', { class: 'loi' }, e.message)); return; }
    const ct = d.chot_test;
    vung.replaceChildren(...[
      d.san_sang ? h('p', {}, chipMau('ok', 'Sẵn sàng'), ' Máy tự kiểm không thấy lỗi nào.') : null,
      ...d.do.map((x) => dongKiem('bad', x)),
      ...d.vang.map((x) => dongKiem('warn', x)),
      h('h3', {}, 'Việc bạn tự làm trên Facebook (tích khi xong)'),
      ...d.tich.map((x) => {
        const o = h('input', { type: 'checkbox', checked: x.bat, disabled: !d.phien_id && !x.lau });
        o.addEventListener('change', async () => { try { await api.post('/live/san-sang/tich', { phien_id: d.phien_id, k: x.k, bat: o.checked }); } catch (e) { toast(e.message, true); o.checked = !o.checked; } });
        return h('label', { class: 'hint', style: 'display:flex;gap:8px;align-items:flex-start' }, o, x.chu);
      }),
      !d.phien_id && h('p', { class: 'hint' }, 'Tạo phiên (Bắt đầu — chờ live) rồi mới tích được — ô tích lưu theo từng buổi.'),
      h('h3', {}, 'Phép thử "chốt test"'),
      ct ? h('p', {}, h('span', { class: `chip ${ct.ket_qua === 'da_gui' ? 'ok' : ct.ket_qua === 'cho_duyet' ? 'warn' : 'bad'}` },
        { da_gui: 'Đã nhắn riêng', cho_duyet: 'Chờ duyệt', loi: 'Lỗi' }[ct.ket_qua]),
      ` Đã nhận "chốt test" của ${ct.ten} lúc ${gioPhut(ct.luc)}${ct.ly_do ? ` — ${ct.ly_do}` : ''}. Xem tin thử nằm ở hộp chính hay "Tin nhắn chờ" trên máy bạn.`)
        : h('p', { class: 'hint' }, 'Live gắn vào phiên xong, dùng tài khoản Facebook cá nhân bình luận "chốt test": MOZA không tạo đơn, chỉ nhắn riêng một tin thử để kiểm đường chốt đơn. (Tài khoản có vai trò trong ứng dụng Meta luôn nhận được, kể cả khi ứng dụng chưa duyệt.)'),
      h('h3', {}, 'Câu ghim'),
      h('p', { class: 'cau-chep' }, d.cau_ghim, ' ', h('button', { class: 'btn small', type: 'button', onclick: () => chep(d.cau_ghim) }, 'Chép')),
      h('h3', {}, 'Câu mô tả buổi live'),
      h('p', { class: 'cau-chep' }, d.cau_mo_ta, ' ', h('button', { class: 'btn small', type: 'button', onclick: () => chep(d.cau_mo_ta) }, 'Chép')),
      h('h3', {}, 'Thử thiết bị'),
      veThuThietBi()].filter(Boolean));
  };
  const nghe = (e) => {
    if (!vung.isConnected) { window.removeEventListener('moza:ws', nghe); return; }
    if (['live.san_sang', 'khan_cap', 'dung_ai', 'chi_phi.muc', 'ket_noi.trang_thai', 'cai_dat.ban_hang', 'kho.cap_nhat', 'live.bat_dau'].includes(e.detail?.type)) tai();
  };
  window.addEventListener('moza:ws', nghe);
  tai();
  return h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Sẵn sàng lên sóng'), h('p', {}, 'Máy tự kiểm; chỉ hiện việc cần sửa. Không bắt buộc, nhưng nên xem trước mỗi buổi live thật.')),
    vung);
}

/**
 * Thử thiết bị (F-19): micro, loa (ngay trên trình duyệt), AI, Facebook.
 * Micro chỉ nghe vài giây để xem vạch âm lượng có nhảy không; không gửi tiếng đi đâu.
 */
function veThuThietBi() {
  const dong = (ten, trangThai, chu) => h('div', { class: 'kiem-tra-dong' },
    h('b', {}, ten), h('span', { class: `chip ${trangThai}` }, { ok: 'Ổn', warn: 'Chú ý', bad: 'Lỗi', mute: '—' }[trangThai]), h('span', { class: 'muted' }, chu));
  const vach = h('div', { class: 'vach-am' }, h('span', {}));
  const oMicro = h('div', {}, dong('Micro', 'mute', 'Bấm "Thử micro" rồi nói vài câu.'), vach);
  const oLoa = h('div', {}, dong('Loa', 'mute', 'Bấm "Thử loa": nghe một tiếng "bíp".'));
  const oAi = h('div', {}, dong('AI', 'mute', 'Bấm "Kiểm tra AI".'));
  const oFb = h('div', {}, dong('Facebook', 'mute', ''));

  const nutMicro = h('button', { class: 'btn small', type: 'button' }, 'Thử micro');
  nutMicro.addEventListener('click', async () => {
    let luong;
    try {
      luong = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      oMicro.firstChild.replaceWith(dong('Micro', 'bad', 'Trình duyệt không được dùng micro. Bấm biểu tượng ổ khóa cạnh địa chỉ trang → cho phép Micro.'));
      return;
    }
    const ac = new AudioContext();
    const phanTich = ac.createAnalyser();
    ac.createMediaStreamSource(luong).connect(phanTich);
    const mau = new Float32Array(phanTich.fftSize);
    let lonNhat = 0;
    const batDau = performance.now();
    nutMicro.disabled = true;
    const ve = () => {
      phanTich.getFloatTimeDomainData(mau);
      const rms = Math.sqrt(mau.reduce((s, x) => s + x * x, 0) / mau.length);
      lonNhat = Math.max(lonNhat, rms);
      vach.firstChild.style.width = `${Math.min(100, rms * 400)}%`;
      if (performance.now() - batDau < 6000) { requestAnimationFrame(ve); return; }
      luong.getTracks().forEach((x) => x.stop());
      ac.close();
      vach.firstChild.style.width = '0';
      nutMicro.disabled = false;
      oMicro.firstChild.replaceWith(lonNhat > 0.02
        ? dong('Micro', 'ok', `Nghe thấy tiếng (${luong.getAudioTracks()[0]?.label || 'micro mặc định'}).`)
        : dong('Micro', 'warn', 'Micro mở được nhưng gần như không nghe tiếng. Xem lại micro đang chọn trong Windows.'));
    };
    oMicro.firstChild.replaceWith(dong('Micro', 'mute', 'Đang nghe 6 giây… nói thử vài câu.'));
    ve();
  });

  const nutLoa = h('button', { class: 'btn small', type: 'button' }, 'Thử loa');
  nutLoa.addEventListener('click', () => {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 660;
    g.gain.value = 0.2;
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.4);
    o.onended = () => ac.close();
    oLoa.replaceChildren(dong('Loa', 'ok', 'Đã phát tiếng "bíp" ra loa mặc định của Windows. Không nghe thấy thì xem lại loa, âm lượng.'));
  });

  const TEN_NHA = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude' };
  const nutAi = h('button', { class: 'btn small', type: 'button' }, 'Kiểm tra AI');
  nutAi.addEventListener('click', () => dangLam(nutAi, 'Đang kiểm…', async () => {
    const d = await api.get('/live/kiem-tra');
    const nhaCan = [...new Set(d.ai.filter((a) => ['director', 'cohost'].includes(a.agent_id)).flatMap((a) => [a.nha, a.nha_du_phong]).filter(Boolean))];
    const khoa = await Promise.all(nhaCan.map((n) => api.post('/keys/test', { nha: n }).then((x) => [n, x]).catch((e) => [n, { ok: false, loi: e.message }])));
    oAi.replaceChildren(
      ...khoa.map(([n, x]) => dong(`Khóa ${TEN_NHA[n]}`, x.ok ? (x.canh ? 'warn' : 'ok') : 'bad', x.loi || x.canh || 'Dùng được.')),
      ...d.ai.filter((a) => ['director', 'cohost'].includes(a.agent_id)).map((a) => dong(a.ten,
        a.dang_dung_du_phong ? 'warn' : a.loi_lien_tiep ? 'warn' : 'ok',
        a.dang_dung_du_phong ? `${a.model} vừa lỗi ${a.loi_lien_tiep} lần liền, đang dùng dự phòng ${a.model_du_phong}.`
          : a.loi_lien_tiep ? `${a.model} vừa lỗi ${a.loi_lien_tiep} lần; lỗi thì tự chuyển ${a.model_du_phong}.` : `Dùng ${a.model}, dự phòng ${a.model_du_phong}.`)));
    oFb.replaceChildren(dong('Facebook', 'ok', `${d.facebook.ten}. ${d.facebook.ghi_chu}`));
  }).catch((e) => toast(e.message, true)));

  return h('div', {}, h('div', { class: 'nutbam' }, nutMicro, nutLoa, nutAi), oMicro, oLoa, oAi, oFb);
}

export function tenDoan(d) {
  if (!d) return '';
  if (d.san_pham) return d.san_pham.ten_day_du;
  return d.loi_nhac.split('\n')[0].slice(0, 80);
}

// Bốn thẻ cách Mai dẫn. "Tắt AI" là lựa chọn nhỏ riêng (không phải một cách dẫn).
const THE_CHE_DO = [
  { id: 'goi_y', ten: 'Gợi ý cho bạn', hinh: '💡', mo: 'Bạn dẫn. Câu trả lời của Mai hiện chữ to trên màn hình, không phát ra loa.' },
  { id: 'noi', ten: 'Cùng dẫn', hinh: '🎙️', mo: 'Bạn dẫn chính; Mai nghe micro và tự trả lời ra loa bằng dữ liệu sản phẩm.' },
  { id: 'dan', ten: 'Mai dẫn chính', hinh: '🤖', mo: 'Vào live là Mai dẫn, tự đi hết kịch bản. Bạn nói xen lúc nào cũng được.' },
  { id: 'doi', ten: 'Đội AI dẫn', hinh: '👥', mo: 'Nhiều nhân vật AI nhiều giọng dẫn như talk show (cần kịch bản soạn cho Đội AI).' },
];

const TEN_BUOC = ['Món bán', 'Mai dẫn thế nào', 'Kiểm tra'];

/**
 * @param {HTMLElement} khung  khung Phiên live (để vẽ lại sau khi tạo phiên)
 * @param {object[]} dsKb  danh sách kịch bản
 * @param {() => void} veLaiPhien  vẽ lại màn Phiên live
 */
export function veBatDau(khung, dsKb, veLaiPhien) {
  if (!dsKb.length) {
    const nut = h('button', { class: 'btn primary', type: 'button' }, 'Tạo nhanh từ các sản phẩm Đang bán');
    nut.addEventListener('click', async () => {
      try {
        await dangLam(nut, 'Đang tạo…', () => api.post('/kich-ban/tao-nhanh'));
        toast('Đã tạo kịch bản');
        veLaiPhien();
      } catch (e) { toast(e.message, true); }
    });
    return h('div', { class: 'view' }, h('section', { class: 'panel' }, h('div', { class: 'empty' },
      'Chưa có kịch bản nào. Kịch bản là thứ tự các sản phẩm bạn sẽ giới thiệu trong buổi live.',
      h('div', { class: 'nutbam' }, nut, h('a', { class: 'btn', href: '#/live/kich-ban' }, 'Tự soạn kịch bản')))), veKiemTra());
  }

  const st = { buoc: 1, cheDo: 'goi_y', tatAi: false, that: false, fbDuoc: false, kb: dsKb[0].id, loiDo: null };
  const vung = h('section', { class: 'panel' });
  const loi = h('p', { class: 'loi', role: 'alert' });

  api.get('/trang-thai').then((t) => { st.fbDuoc = !!t.facebook?.ket_noi && t.facebook?.ma !== 'FB_MA_HET_HAN'; if (st.buoc === 2) ve(); }).catch(() => {});

  const thanhBuoc = () => h('div', { class: 'buoc-thanh', 'aria-label': 'Các bước' }, TEN_BUOC.map((ten, i) => h('span', {
    class: st.buoc === i + 1 ? 'nay' : st.buoc > i + 1 ? 'xong' : '', 'aria-current': st.buoc === i + 1 ? 'step' : null,
  }, h('b', {}, st.buoc > i + 1 ? '✓' : String(i + 1)), ten)));

  const buoc1 = () => {
    const oKb = h('select', { 'aria-label': 'Kịch bản' }, dsKb.map((k) => h('option', { value: k.id, selected: k.id === st.kb }, `${k.ten} (${k.doan.length} đoạn)`)));
    const xem = h('ol', { class: 'doan-xem' });
    const veXem = () => {
      const k = dsKb.find((x) => x.id === oKb.value);
      xem.replaceChildren(...k.doan.map((d) => h('li', {}, h('span', {}, tenDoan(d)), d.san_pham && d.san_pham.trang_thai !== 'dang_ban' && chipSp(d.san_pham.trang_thai))));
    };
    oKb.addEventListener('change', () => { st.kb = oKb.value; veXem(); });
    veXem();
    return [
      h('p', { class: 'muted' }, 'Chọn kịch bản: thứ tự các món bạn sẽ giới thiệu trong buổi live.'),
      h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Kịch bản'), oKb), h('a', { class: 'btn small', href: '#/live/kich-ban' }, 'Soạn kịch bản')),
      xem,
    ];
  };

  const buoc2 = () => {
    const the = h('div', { class: 'the-che-do', role: 'group', 'aria-label': 'Mai dẫn thế nào' });
    const veThe = () => the.replaceChildren(...THE_CHE_DO.map((c) => h('button', {
      type: 'button', 'aria-pressed': String(!st.tatAi && st.cheDo === c.id),
      onclick: () => { st.cheDo = c.id; st.tatAi = false; ve(); },
    }, h('span', { class: 'hinh', 'aria-hidden': 'true' }, c.hinh), h('b', {}, c.ten), h('span', { class: 'muted' }, c.mo))));
    veThe();
    const noi = h('div', { class: 'chon', role: 'group', 'aria-label': 'Live ở đâu' }, [
      { id: false, ten: 'Diễn tập (Facebook giả)' },
      { id: true, ten: 'Live thật trên Page', khoa: st.fbDuoc ? null : 'Facebook thật chưa kết nối (Cài đặt → Facebook)' },
    ].map((c) => h('button', {
      type: 'button', 'aria-pressed': String(st.that === c.id), disabled: !!c.khoa, title: c.khoa || null, onclick: () => { st.that = c.id; ve(); },
    }, c.ten)));
    // F-127: tông giọng trên sóng (cùng cài đặt với Cài đặt → Giọng Mai). Giữ một khối để chọn chế độ không tải lại.
    st.eTong = st.eTong || veTongGiong({ gon: true });
    return [
      the,
      !st.tatAi && st.eTong,
      h('label', { class: 'chon-o' }, h('input', { type: 'checkbox', checked: st.tatAi, onchange: (e) => { st.tatAi = e.target.checked; ve(); } }), ' Không dùng AI buổi này (chỉ chạy kịch bản)'),
      h('div', { class: 'field' }, h('span', {}, 'Live ở đâu'), noi,
        h('p', { class: 'hint' }, st.fbDuoc
          ? (st.that ? 'Bắt đầu live trên điện thoại (đăng dưới tên Page): MOZA tự nhận ra, gắn vào phiên và mở Màn hình người dẫn.' : 'Diễn tập: mọi thứ chạy trên Facebook giả, không có gì đi ra Facebook thật.')
          : 'Facebook thật chưa kết nối: phiên sẽ là diễn tập trên Facebook giả (Phòng diễn tập).')),
    ];
  };

  /** Tạo phiên — dùng đúng API phiên có sẵn. */
  const lenSong = async (nut) => {
    loi.textContent = '';
    try {
      await dangLam(nut, 'Đang tạo phiên…', () => api.post('/live/phien', { kich_ban_id: st.kb, che_do_ai: st.tatAi ? 'tat' : st.cheDo, dien_tap: !st.that }));
      veLaiPhien();
    } catch (e) { loi.textContent = e.message; }
  };

  const buoc3 = () => {
    const kiem = veKiemTra();
    const nutLen = h('button', { class: 'btn primary', type: 'button' }, st.that ? 'Lên sóng — chờ live' : 'Bắt đầu — chờ live');
    const canh = h('div', { class: 'canh-do', hidden: true });
    nutLen.addEventListener('click', async () => {
      // F-77: không khóa nút; còn dòng đỏ thì hiện rõ lý do ngay tại đây (không dùng hộp hỏi của trình duyệt) và hỏi lại một lần.
      if (!st.loiDo) {
        try {
          const ss = await api.get('/live/san-sang');
          if (ss.do.length) {
            st.loiDo = ss.do;
            canh.hidden = false;
            canh.replaceChildren(h('p', { class: 'loi' }, `Còn ${ss.do.length} việc đỏ chưa xong:`),
              h('ul', {}, ss.do.map((x) => h('li', {}, x.chu))),
              h('div', { class: 'nutbam' },
                h('button', { class: 'btn nguy', type: 'button', onclick: (e) => lenSong(e.currentTarget) }, 'Vẫn lên sóng'),
                h('button', { class: 'btn', type: 'button', onclick: () => { st.loiDo = null; canh.hidden = true; } }, 'Sửa trước')));
            return;
          }
        } catch { /* không kiểm được thì vẫn cho bắt đầu */ }
      }
      lenSong(nutLen);
    });
    return [
      h('p', { class: 'muted' }, 'Máy tự kiểm; chỉ hiện việc cần sửa. Không bắt buộc, nhưng nên xem trước mỗi buổi live thật.'),
      h('details', { open: true }, h('summary', {}, 'Bảng sẵn sàng'), kiem),
      canh, loi,
      h('div', { class: 'nutbam' }, nutLen, h('a', { class: 'btn', href: '#/live/dien-tap' }, 'Tập trước')),
    ];
  };

  const ve = () => {
    const noiDung = [buoc1, buoc2, buoc3][st.buoc - 1]();
    vung.replaceChildren(
      h('header', {}, h('h2', {}, 'Bắt đầu live'), thanhBuoc()),
      h('div', { class: 'body' }, ...noiDung,
        st.buoc < 3 && h('div', { class: 'nutbam' },
          st.buoc > 1 && h('button', { class: 'btn', type: 'button', onclick: () => { st.buoc -= 1; ve(); } }, 'Quay lại'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { st.buoc += 1; ve(); } }, st.buoc === 1 ? 'Tiếp: Mai dẫn thế nào' : 'Tiếp: Kiểm tra'))
        || (st.buoc === 3 && h('div', { class: 'nutbam' }, h('button', { class: 'btn', type: 'button', onclick: () => { st.buoc = 2; ve(); } }, 'Quay lại')))));
  };
  ve();
  return h('div', { class: 'view' }, vung);
}
