// Cài đặt (SPEC.md F-01, F-02, F-03; bản bán hàng thêm nhóm Bán hàng — tên shop, phí ship, giờ giữ hàng, ngưỡng).
// Khóa API: trình duyệt chỉ thấy "đã có / chưa có" và 4 ký tự cuối; khóa thật chỉ nằm trong .env.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam, duongCon, goiY } from '../ui.js';
import { datTyGia, tien, docTien } from '../dinh-dang.js';
import * as troLyAi from './agent.js';
import { veCanXuLy, veAiKenh } from './cai-dat-ai-kenh.js';
import { veFacebook } from './cai-dat-facebook.js';
import { veGiongMai } from './cai-dat-giong.js';
import { veDoiAi } from './cai-dat-doi-ai.js';
import { veObs } from './cai-dat-obs.js';

const NHA_KHOA = [
  { nha: 'gemini', ten: 'Google Gemini', lay: 'https://aistudio.google.com/apikey',
    ghiChu: 'Nên gắn thẻ thanh toán cho dự án Gemini: với gói miễn phí, Google được dùng dữ liệu gửi lên để cải tiến sản phẩm — không hợp với dữ liệu khách hàng (số điện thoại, địa chỉ).' },
  { nha: 'openai', ten: 'OpenAI', lay: 'https://platform.openai.com/api-keys' },
  { nha: 'anthropic', ten: 'Anthropic Claude', lay: 'https://platform.claude.com', ghiChu: 'Dùng khi Tư vấn viên cần nâng lên Claude (khiếu nại, mặc cả, Bộ kiểm tra vừa chặn) và cho nút "Xem thử AI hiểu gì".' },
  { nha: 'elevenlabs', ten: 'ElevenLabs (máy đọc giọng)', lay: 'https://elevenlabs.io/app/settings/api-keys',
    ghiChu: 'Không bắt buộc: máy đọc giọng thứ hai cho Đội AI và người dẫn giả (giọng tiếng Việt chọn ở Cài đặt → Đội AI dẫn → Giọng ElevenLabs). Tính tiền theo ký tự.' },
];

const MUC = { 'Bán hàng': 'ban-hang', 'Khóa AI': 'khoa-ai', Facebook: 'facebook', 'Lịch live': 'lich-live', 'Phần mềm': 'phan-mem' };
function phan(tieuDe, moTa, ...noiDung) {
  return h('section', { class: 'panel', 'data-muc': MUC[tieuDe] || null },
    h('header', {}, h('h2', {}, tieuDe), moTa && h('p', {}, moTa)),
    h('div', { class: 'body' }, ...noiDung));
}

function chon(giaTri, luaChon, thuocTinh = {}) {
  const s = h('select', thuocTinh, luaChon.map(([gt, chu]) => h('option', { value: gt, selected: gt === giaTri }, chu)));
  s.value = giaTri ?? '';
  return s;
}

// Nghe thử: tải trước để còn hiện lỗi dễ hiểu (thẻ <audio> không cho biết vì sao lỗi).
let dangPhat = null;
async function ngheThu(nut, nha, giong) {
  if (dangPhat) dangPhat.pause();
  await dangLam(nut, 'Đang tải…', async () => {
    const r = await fetch(`/api/giong/thu?nha=${encodeURIComponent(nha)}&giong=${encodeURIComponent(giong)}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.loi?.thong_diep || 'Không nghe thử được.');
    }
    dangPhat = new Audio(URL.createObjectURL(await r.blob()));
    await dangPhat.play();
  }).catch((e) => toast(e.message, true));
}

/* ---------------- khóa AI ---------------- */

function veKhoa(trangThai) {
  return NHA_KHOA.map((k) => {
    const tt = trangThai[k.nha] || {};
    const chip = h('span', { class: `chip ${tt.co ? 'ok' : 'warn'}` }, tt.co ? `Đã có ••••${tt.duoi}` : 'Chưa có');
    const o = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Dán khóa mới vào đây rồi bấm Lưu', 'aria-label': `Khóa ${k.ten}` });
    const kq = h('p', { class: 'kq hint', role: 'status' });
    const hienKq = (lop, chu) => { kq.className = `kq ${lop}`; kq.textContent = chu; };
    const nutLuu = h('button', { class: 'btn small', type: 'button' }, 'Lưu');
    const nutThu = h('button', { class: 'btn small', type: 'button' }, 'Kiểm tra');
    nutLuu.addEventListener('click', async () => {
      if (!o.value.trim()) return hienKq('loi', 'Dán khóa vào ô trước đã.');
      try {
        const r = await dangLam(nutLuu, 'Đang lưu…', () => api.post('/keys', { nha: k.nha, khoa: o.value }));
        o.value = '';
        const moi = r.trangThai[k.nha];
        chip.className = `chip ${moi.co ? 'ok' : 'warn'}`;
        chip.textContent = moi.co ? `Đã có ••••${moi.duoi}` : 'Chưa có';
        hienKq('dat', 'Đã lưu vào file .env trên máy này. Bấm Kiểm tra để thử khóa.');
      } catch (e) {
        hienKq('loi', e.message);
      }
    });
    nutThu.addEventListener('click', async () => {
      try {
        const r = await dangLam(nutThu, 'Đang kiểm…', () => api.post('/keys/test', { nha: k.nha }));
        if (!r.ok) hienKq('loi', r.loi);
        else if (r.canh) hienKq('canh', r.canh);
        else hienKq('dat', 'Khóa dùng được.');
      } catch (e) {
        hienKq('loi', e.message);
      }
    });
    return h('div', { class: 'khoa-hang' },
      h('div', {}, h('b', {}, k.ten), h('div', {}, chip)),
      o,
      h('div', { class: 'nutbam' }, nutLuu, nutThu),
      h('div', { class: 'kq-khung' }, kq,
        h('p', { class: 'hint' }, 'Lấy khóa ở ', h('a', { href: k.lay, target: '_blank', rel: 'noopener' }, k.lay.replace('https://', '')),
          k.ghiChu ? `. ${k.ghiChu}` : '.')));
  });
}

/* ---------------- Mai: tên, miệng, giọng ---------------- */

function veMai(cd, dsGiong) {
  const oTen = h('input', { type: 'text', value: cd.ten_ai, maxlength: 60 });
  const nutTen = h('button', { class: 'btn small', type: 'button' }, 'Lưu tên');
  nutTen.addEventListener('click', async () => {
    try {
      await dangLam(nutTen, 'Đang lưu…', () => api.put('/cai-dat', { ten_ai: oTen.value }));
      toast('Đã lưu tên AI');
    } catch (e) { toast(e.message, true); }
  });

  const moTaMieng = h('p', { class: 'hint' });
  const capNhatMoTa = () => {
    const m = cd.lua_chon.mieng.find((x) => x.model === cd.mieng.model);
    moTaMieng.textContent = `Mai đang dùng ${m.ten}, giọng ${cd.mieng.giong[m.nha]}. Bản đầu dùng model đúng như mặc định của hãng, `
      + 'dữ liệu tin đưa thẳng cho Mai; cách Mai nói bạn chỉnh sau trong lời dặn vai trò.';
  };
  capNhatMoTa();

  const luuMieng = async (moi) => {
    try {
      const kq = await api.put('/cai-dat', { mieng: moi });
      cd.mieng = kq.mieng;
      capNhatMoTa();
      toast('Đã lưu');
    } catch (e) { toast(e.message, true); }
  };
  const oMieng = chon(cd.mieng.model, cd.lua_chon.mieng.map((m) => [m.model, m.ten]));
  oMieng.addEventListener('change', () => luuMieng({ model: oMieng.value }));

  const hangGiong = (nha, tenNha) => {
    const ds = dsGiong[nha];
    const oGiong = chon(cd.mieng.giong[nha], ds.map((g) => [g.ten, `${g.ten} — ${g.net}${g.gioi === 'nu' ? ' (nữ)' : g.gioi === 'nam' ? ' (nam)' : ''}`]));
    const nutNghe = h('button', { class: 'btn small', type: 'button' }, '▶ Nghe thử');
    const capNhatNut = () => {
      const g = ds.find((x) => x.ten === oGiong.value);
      nutNghe.disabled = nha === 'openai' && !g?.tts;
      nutNghe.title = nutNghe.disabled ? 'Giọng này chỉ có trong GPT Live, chưa nghe thử được ở đây' : '';
    };
    capNhatNut();
    oGiong.addEventListener('change', () => { capNhatNut(); luuMieng({ giong: { [nha]: oGiong.value } }); });
    nutNghe.addEventListener('click', () => ngheThu(nutNghe, nha, oGiong.value));
    return h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, tenNha), oGiong), nutNghe);
  };

  return [
    h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Tên AI (dùng khi AI tự giới thiệu)'), oTen), nutTen),
    h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Miệng của Mai (khi bật chế độ "Co-host được nói")'), oMieng)),
    hangGiong('openai', 'Giọng khi dùng GPT Live 1'),
    hangGiong('gemini', 'Giọng khi dùng Gemini 3.8 Live'),
    moTaMieng,
  ];
}

/* ---------------- Agent ---------------- */

function veAgent(cd) {
  const nha = Object.entries(cd.lua_chon.nha);
  const mucSuyNghi = Object.entries(cd.lua_chon.muc_suy_nghi);
  return cd.agents.map((a) => {
    const oNha = chon(a.nha, nha.map(([k, v]) => [k, v.ten]));
    const oModel = h('select');
    const oMuc = chon(a.muc_suy_nghi, mucSuyNghi);
    const oNhaDp = chon(a.nha_du_phong || '', [['', 'Không có'], ...nha.map(([k, v]) => [k, v.ten])]);
    const oModelDp = h('select');
    const doModel = (oN, oM, giaTri) => {
      const ds = cd.lua_chon.nha[oN.value]?.model || [];
      oM.replaceChildren(...ds.map((m) => h('option', { value: m }, m)));
      oM.disabled = !ds.length;
      oM.value = ds.includes(giaTri) ? giaTri : ds[0] || '';
    };
    doModel(oNha, oModel, a.model);
    doModel(oNhaDp, oModelDp, a.model_du_phong);
    oNha.addEventListener('change', () => doModel(oNha, oModel));
    oNhaDp.addEventListener('change', () => doModel(oNhaDp, oModelDp));

    const nut = h('button', { class: 'btn small', type: 'button' }, 'Lưu');
    nut.addEventListener('click', async () => {
      try {
        await dangLam(nut, 'Đang lưu…', () => api.put(`/agent/${a.id}`, {
          nha: oNha.value, model: oModel.value, muc_suy_nghi: oMuc.value,
          nha_du_phong: oNhaDp.value || null, model_du_phong: oNhaDp.value ? oModelDp.value : null,
        }));
        toast(`Đã lưu ${a.ten}`);
      } catch (e) { toast(e.message, true); }
    });
    const nangCap = a.nang_cap?.model ? `Khi cần nâng lên: ${a.nang_cap.model}` : '';
    return h('div', { class: 'agent' },
      h('div', { class: 'ten' }, h('b', {}, a.ten), h('span', {}, a.muc_tieu), nangCap && h('span', {}, nangCap)),
      h('label', { class: 'field' }, h('span', {}, 'Nhà cung cấp'), oNha),
      h('label', { class: 'field' }, h('span', {}, 'Model'), oModel),
      h('label', { class: 'field' }, h('span', {}, 'Mức suy nghĩ'), oMuc),
      h('div', { class: 'field' }, h('span', {}, 'Dự phòng khi lỗi'), oNhaDp, oModelDp),
      nut);
  });
}

/* ---------------- sao lưu, chạy nền ---------------- */

function veSaoLuu(sl) {
  const dong = h('p', { class: 'muted' });
  const hien = (s) => {
    dong.textContent = s.cuoi
      ? `Lần gần nhất: ${gioPhut(s.cuoi.luc, true)} — ${s.cuoi.file}`
      : 'Chưa sao lưu lần nào.';
  };
  hien(sl);
  const nut = h('button', { class: 'btn primary', type: 'button' }, 'Sao lưu ngay');
  nut.addEventListener('click', async () => {
    try {
      const kq = await dangLam(nut, 'Đang sao lưu…', () => api.post('/sao-luu'));
      hien(kq.trang_thai);
      toast('Đã sao lưu');
    } catch (e) { toast(e.message, true); }
  });
  return [dong, h('div', { class: 'nutbam' }, nut),
    h('p', { class: 'hint' }, `Không có sao lưu tự động. Quá ${sl.sauNgay} ngày chưa sao lưu thì Tổng quan sẽ nhắc. `
      + 'Bản sao nằm trong thư mục data\\sao-luu — thỉnh thoảng chép thư mục này ra USB hoặc Google Drive, phòng khi hỏng máy.')];
}

function veChayNen() {
  const o = h('input', { type: 'checkbox', role: 'switch', disabled: true });
  const nhan = h('label', { class: 'khancap xanh' }, o, h('span', {}, 'Tự chạy khi mở máy'));
  const trangThai = h('p', { class: 'hint' }, 'Đang xem trạng thái…');
  const hien = (t) => {
    o.checked = t.bat;
    o.disabled = !t.hoTro;
    trangThai.textContent = !t.hoTro ? 'Chỉ có trên Windows.'
      : t.bat ? `Đang bật${t.cach === 'startup' ? ' (qua thư mục Khởi động của Windows)' : ' (qua Task Scheduler)'}: đăng nhập Windows là MOZA tự chạy, không mở trình duyệt.`
        : 'Đang tắt: mỗi lần mở máy phải bấm đúp CHAY PHAN MEM.bat.';
  };
  api.get('/cai-dat/tu-chay').then(hien).catch((e) => { trangThai.textContent = e.message; });
  o.addEventListener('change', async () => {
    const muon = o.checked;
    o.disabled = true;
    try {
      hien(await api.post('/cai-dat/tu-chay', { bat: muon }));
      toast(muon ? 'Đã bật tự chạy khi mở máy' : 'Đã tắt tự chạy khi mở máy');
    } catch (e) {
      o.checked = !muon;
      o.disabled = false;
      toast(e.message, true);
    }
  });
  return [
    nhan, trangThai,
    h('p', { class: 'hint' }, 'Khi đang chạy mà phần mềm bị tắt ngang (lỗi, hoặc tắt trong Task Manager), cửa sổ đen tự chạy lại sau 3 giây. '
      + 'Muốn dừng hẳn thì đóng cửa sổ đen.'),
    h('div', {},
      h('b', {}, 'Để máy không ngủ khi cắm sạc'),
      h('p', { class: 'hint' }, 'MOZA không tự sửa cài đặt nguồn điện của Windows. Bạn làm một lần:'),
      h('ol', { class: 'buoc' },
        h('li', {}, 'Bấm nút Start, mở Settings (Cài đặt).'),
        h('li', {}, 'Vào System (Hệ thống) → Power & battery (Nguồn và pin).'),
        h('li', {}, 'Mở Screen, sleep & hibernate (Màn hình, ngủ và ngủ đông).'),
        h('li', {}, 'Ở dòng "When plugged in, put my device to sleep after" (Khi cắm sạc, cho máy ngủ sau), chọn Never (Không bao giờ).'),
        h('li', {}, 'Màn hình được phép tắt — chỉ cần máy không ngủ.'))),
  ];
}

function veDoTre(giay) {
  const o = h('input', { type: 'number', min: 0, max: 120, step: 1, value: giay, style: 'max-width:110px' });
  const nut = h('button', { class: 'btn small', type: 'button' }, 'Lưu');
  nut.addEventListener('click', async () => {
    try {
      await dangLam(nut, 'Đang lưu…', () => api.put('/cai-dat', { do_tre_phat: Number(o.value) }));
      toast('Đã lưu độ trễ phát');
    } catch (e) { toast(e.message, true); }
  });
  return [
    h('div', { class: 'hang' }, h('label', { class: 'field', style: 'flex:0 1 220px' }, h('span', {}, 'Độ trễ phát (giây)'), o), nut),
    h('p', { class: 'hint' }, 'Người xem thấy hình trễ hơn điện thoại đang phát, nên bình luận hỏi về đoạn đã nói vài giây trước. '
      + 'MOZA lùi lại số giây này khi đoán bình luận hỏi tin nào. Mặc định 15 giây; phiên diễn tập luôn là 0.'),
  ];
}

function veAnBinhLuan(bat) {
  const o = h('input', { type: 'checkbox', role: 'switch', checked: bat });
  o.addEventListener('change', async () => {
    try {
      await api.put('/hook/an_thong_tin_ca_nhan', { bat: o.checked });
      toast(o.checked ? 'Đã bật ẩn bình luận lộ thông tin cá nhân' : 'Đã tắt ẩn bình luận lộ thông tin cá nhân');
    } catch (e) {
      o.checked = !o.checked;
      toast(e.message, true);
    }
  });
  return [
    h('label', { class: 'khancap xanh' }, o, h('span', {}, 'Ẩn bình luận lộ số điện thoại, CCCD')),
    h('p', { class: 'hint' }, 'Bình luận live có số điện thoại hoặc CCCD công khai sẽ bị ẩn (người viết vẫn thấy) và chuyển vào danh sách '
      + '"Chờ Tư vấn viên" để nhắn riêng. Đây cũng là một hook ở Cài đặt → Trợ lý AI → Hook (bật Nâng cao).'),
  ];
}

/* ---------------- bán hàng (F-03, #59, #63, #64, #73) ---------------- */

function veBanHang(bh, dsNganHang = [], dsHang = []) {
  const loi = h('p', { class: 'loi', role: 'alert' });
  // Ghi chú dài nằm sau biểu tượng ⓘ (không để đoạn chữ dưới ô). `tien: true`: ô tiền — rời ô thì hiện "30.000đ".
  const o = (k, nhan, ghiChu, { tien: laTien, ...tt } = {}) => {
    const e = h('input', { type: 'text', value: bh[k] ?? '', ...tt, class: laTien ? 'o-tien' : null });
    if (laTien) {
      const dinhDang = () => { const n = docTien(e.value); if (n != null && !Number.isNaN(n)) e.value = tien(n); };
      e.addEventListener('blur', dinhDang);
      if (e.value) dinhDang();
    }
    return [k, e, h('label', { class: 'field' }, h('span', {}, nhan, ghiChu && goiY(ghiChu)), e)];
  };
  const cac = [
    o('ten_shop', 'Tên shop', 'AI tự giới thiệu là trợ lý của shop này; tên chương trình Radio.', { maxlength: 80 }),
    o('sdt_shop', 'Số điện thoại shop', 'In trên phiếu gửi hàng.', { maxlength: 20 }),
    o('dia_chi_shop', 'Địa chỉ gửi hàng', 'In trên phiếu gửi hàng.', { maxlength: 300 }),
    o('phi_ship', 'Phí ship đồng giá', 'VD: 30k. Để trống = chưa có; AI nói shop sẽ báo khi lên đơn.', { inputmode: 'decimal', tien: true }),
    o('mien_phi_tu', 'Miễn phí ship cho đơn từ', 'VD: 500k. Để trống = không miễn phí.', { inputmode: 'decimal', tien: true }),
    o('gio_giu', 'Giờ giữ hàng cho đơn chờ xác nhận', 'Khách đã bấm nút hoặc nhắn tin: giữ chừng này giờ. Quá giờ mà chưa xác nhận thì đơn tự hủy, hàng trả lại.', { inputmode: 'numeric' }),
    o('gio_giu_ngan', 'Giữ ngắn cho người chưa bấm: hết live + … giờ', 'Người chốt trên live mà chưa bấm nút, chưa nhắn: giữ tới hết live cộng chừng này giờ (1–24).', { inputmode: 'numeric' }),
    o('phu_trach', 'Người phụ trách buổi live', 'Hiện trên nhãn "Trợ lý AI · Phụ trách: …" ở góc hình (luật AI). Để trống: "Trợ lý AI của <tên shop>".', { maxlength: 60 }),
    ['xung_ho', h('select', {}, [['minh_ban', 'mình – bạn'], ['shop_chi', 'shop – chị'], ['em_anh_chi', 'em – anh/chị'], ['shop_ban', 'shop – bạn']]
      .map(([v, t]) => h('option', { value: v, selected: (bh.xung_ho || 'minh_ban') === v }, t)))],
    o('ten_chu_tk', 'Tên chủ tài khoản nhận tiền', 'Thẻ đơn và câu ghim ghi "Shop chỉ nhận tiền vào TK tên …" để khách không bị kẻ gian giả shop lừa.', { maxlength: 60 }),
    // F-89: chọn ngân hàng từ danh sách (ít gõ); đủ 3 ô (ngân hàng, số tài khoản, tên chủ TK) thì thẻ đơn có nút "Chuyển khoản" + mã QR.
    ['ngan_hang', h('select', {}, [h('option', { value: '', selected: !bh.ngan_hang }, '— Chưa nhận chuyển khoản —'),
      ...dsNganHang.map((x) => h('option', { value: x.bin, selected: bh.ngan_hang === x.bin, title: x.ten }, x.ten_ngan))])],
    o('so_tk', 'Số tài khoản nhận tiền', 'Chỉ chữ số. Đủ ngân hàng, số tài khoản, tên chủ tài khoản thì thẻ đơn có nút "💳 Chuyển khoản": khách bấm là nhận mã QR đúng số tiền, nội dung là mã đơn. Bạn vẫn tự xem sao kê rồi bấm "Đã nhận tiền".', { inputmode: 'numeric', maxlength: 25 }),
    // F-91: tắt mặc định — chỉ bật sau khi luật sư trả lời (số đo có thể là dữ liệu nhạy cảm theo NĐ 356).
    ['hoi_so_do', h('input', { type: 'checkbox', role: 'switch', checked: !!bh.hoi_so_do })],
    // F-104: ảnh khách mặc thật — tắt mặc định.
    ['dung_anh_khach', h('input', { type: 'checkbox', role: 'switch', checked: !!bh.dung_anh_khach })],
    // F-93: "Giá live tới hết buổi" — tắt mặc định.
    ['gia_live_bat', h('input', { type: 'checkbox', role: 'switch', checked: !!bh.gia_live_bat })],
    // F-95: giờ nghe máy chọn từ danh sách (6:00–23:00, bước 30 phút).
    ['gio_nghe_may', (() => {
      const gio = []; for (let p = 360; p <= 1380; p += 30) gio.push(`${String(Math.floor(p / 60)).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`);
      const [tu = '', den = ''] = String(bh.gio_nghe_may || '').split('-');
      const chon = (v) => h('select', {}, [h('option', { value: '', selected: !v }, '—'), ...gio.map((g) => h('option', { value: g, selected: g === v }, g))]);
      const a = chon(tu); const b = chon(den);
      const w = h('span', { class: 'hang' }, a, ' → ', b);
      Object.defineProperty(w, 'value', { get: () => (a.value && b.value ? `${a.value}-${b.value}` : '') });
      return w;
    })()],
    o('nguong_don_lon', 'Đơn COD của khách mới từ bao nhiêu thì hỏi lại', 'VD: 500k. Máy đánh dấu "Nên hỏi lại" và nhắn khách "nhận trong tuần này được không" trước khi gửi — không từ chối COD.', { inputmode: 'decimal', tien: true }),
    ['so_ngay_hoi_mac', h('select', {}, [2, 3, 4, 5, 6, 7].map((n) => h('option', { value: n, selected: Number(bh.so_ngay_hoi_mac || 4) === n }, `${n} ngày`)))],
    // F-106: khi Mai lỡ nói giá thấp hơn trên live.
    ['khi_noi_nham_gia', h('select', {}, [['ban_theo_gia_noi', 'Bán theo giá Mai nói (khuyên dùng)'], ['chu_shop_quyet', 'Chủ shop quyết từng đơn']]
      .map(([v, t]) => h('option', { value: v, selected: (bh.khi_noi_nham_gia || 'ban_theo_gia_noi') === v }, t)))],
    ['hang_van_chuyen', h('select', {}, dsHang.map((x) => h('option', { value: x.ma, selected: (bh.hang_van_chuyen || 'chung') === x.ma }, `${x.ten}${x.trang_thai === 'can_file_mau' ? ' — cần file mẫu' : ''}`)))],
    o('doi_tra_ngan', 'Đổi trả (một dòng)', 'VD: Đổi size trong 3 ngày. Hiện cố định trên Thanh chữ và cuối thẻ đơn khi còn chỗ.', { maxlength: 40 }),
    o('nguong_sap_het', 'Ngưỡng "sắp hết"', 'Còn bán được từ số này trở xuống thì báo sắp hết; AI chỉ được nói "sắp hết" khi thật sự dưới ngưỡng.', { inputmode: 'numeric' }),
    o('nguong_hoan', 'Ngưỡng khách từng hoàn', 'Khách hoàn từ số đơn này trở lên thì AI không tự xác nhận đơn mới, tạo việc gọi xác nhận.', { inputmode: 'numeric' }),
  ];
  const nut = h('button', { class: 'btn primary small', type: 'button' }, 'Lưu');
  nut.addEventListener('click', async () => {
    loi.textContent = '';
    try {
      await dangLam(nut, 'Đang lưu…', () => api.put('/cai-dat', { ban_hang: Object.fromEntries(cac.map(([k, e]) => [k, e.type === 'checkbox' ? e.checked : e.value])) }));
      toast('Đã lưu cài đặt bán hàng');
    } catch (e) { loi.textContent = e.message; }
  });
  // Ô chọn xưng hô chưa có nhãn: gắn nhãn tại đây (chọn từ danh sách — ít gõ).
  const xh = cac.find((x) => x[0] === 'xung_ho');
  xh[2] = h('label', { class: 'field' }, h('span', {}, 'Cách xưng hô trong tin nhắn tự động'), xh[1], h('p', { class: 'hint' }, 'Dùng cho thẻ giữ hàng, tin nhắc, câu ghim. Máy không biết giới tính khách nên mặc định "mình – bạn".'));
  const hv = cac.find((x) => x[0] === 'hang_van_chuyen');
  hv[2] = h('label', { class: 'field' }, h('span', {}, 'Hãng vận chuyển đang dùng'), hv[1], h('p', { class: 'hint' }, 'Đơn hàng → Cần gửi → "Xuất file" ra đúng mẫu nhập hàng loạt của hãng. Hãng ghi "cần file mẫu": tải file mẫu ở trang khách hàng của hãng, đưa Claude Code điền cột.'));
  const nn = cac.find((x) => x[0] === 'khi_noi_nham_gia');
  nn[2] = h('label', { class: 'field' }, h('span', {}, 'Khi Mai lỡ nói giá thấp hơn trên live'), nn[1], h('p', { class: 'hint' }, 'MOZA đính chính ngay trên sóng. Đơn chốt trong lúc đó: "Bán theo giá Mai nói" tự hạ giá dòng món bị nói sai (chỉ hạ, có nút "Giữ giá đúng"); "Chủ shop quyết" chỉ đánh dấu và tạo việc. ⚠ Đụng tiền thật — nhờ luật sư / kế toán xem trước khi live thật.'));
  const hm = cac.find((x) => x[0] === 'so_ngay_hoi_mac');
  hm[2] = h('label', { class: 'field' }, h('span', {}, 'Hỏi thăm "mặc thấy sao" sau khi gửi'), hm[1], h('p', { class: 'hint' }, 'Hỏi một lần, 10h–20h; khách bấm Hơi chật / Hơi rộng thì có việc "Đổi size".'));
  const gn = cac.find((x) => x[0] === 'gio_nghe_may');
  gn[2] = h('label', { class: 'field' }, h('span', {}, 'Giờ nghe máy'), gn[1], h('p', { class: 'hint' }, 'Khách hỏi gọi được lúc nào thì AI trả lời theo giờ này.'));
  const sd = cac.find((x) => x[0] === 'hoi_so_do');
  sd[2] = h('label', { class: 'field' }, h('span', { class: 'khancap' }, sd[1], ' Hỏi khách lưu chiều cao, cân nặng'),
    h('p', { class: 'hint' }, 'Tắt mặc định. Bật: khách nói đủ chiều cao, cân nặng trong Messenger thì shop hỏi một lần có lưu để lần sau tư vấn size nhanh không — chỉ lưu khi khách bấm "Lưu giúp mình"; khách nhắn "xóa số đo" là xóa. ⚠ Chỉ bật sau khi luật sư xem.'));
  const gl = cac.find((x) => x[0] === 'gia_live_bat');
  gl[2] = h('label', { class: 'field' }, h('span', { class: 'khancap' }, gl[1], ' Giá live (tới hết buổi)'),
    h('p', { class: 'hint' }, 'Tắt mặc định. Bật: ở Chuẩn bị mỗi món chọn giá live (−5%, −10%, −15% hoặc gõ số), áp cho bình luận chốt trong lúc live. ⚠ Nhờ luật sư xem trước, dùng thưa, không nói "chỉ hôm nay".'));
  const ak = cac.find((x) => x[0] === 'dung_anh_khach');
  ak[2] = h('label', { class: 'field' }, h('span', { class: 'khancap' }, ak[1], ' Dùng ảnh khách mặc thật'),
    h('p', { class: 'hint' }, 'Tắt mặc định. Bật: khách tự gửi ảnh trong 30 ngày sau khi nhận hàng thì shop xin phép bằng nút; khách đồng ý mới lưu, bạn che mặt và duyệt ở ',
      h('a', { href: '#/anh-khach' }, 'màn duyệt ảnh'), ' rồi mới lên Màn hình sản phẩm. Khách nhắn "gỡ ảnh" là gỡ ngay. ⚠ Chỉ bật sau khi luật sư duyệt câu xin phép (quyền hình ảnh, dữ liệu cá nhân).'));
  const nh = cac.find((x) => x[0] === 'ngan_hang');
  nh[2] = h('label', { class: 'field' }, h('span', {}, 'Ngân hàng nhận chuyển khoản'), nh[1], h('p', { class: 'hint' }, 'Chọn từ danh sách VietQR. Để trống: thẻ đơn chỉ có "Xác nhận đơn" (trả khi nhận hàng).'));
  const nhacCk = h('p', { class: 'hint canh-bao' }, '⚠ Trước khi nhận chuyển khoản của khách thật: khai tài khoản nhận tiền với cơ quan thuế (nhờ kế toán xem), '
    + 'viết mục "Hoàn tiền khi shop hết hàng / hủy đơn" trong Sổ tay, và tự chuyển thử 1.000đ bằng mã QR của một đơn tập để chắc đúng tài khoản. '
    + 'Nên nhờ người rành thanh toán xem trước khi ra mắt.');
  return [h('div', { class: 'grid2' }, cac.map((x) => x[2])), nhacCk, loi, h('div', { class: 'nutbam' }, nut)];
}

/* ---------------- lịch live (F-96) ---------------- */

const THU = [[1, 'T2'], [2, 'T3'], [3, 'T4'], [4, 'T5'], [5, 'T6'], [6, 'T7'], [0, 'CN']];

function veLichLive(ll) {
  const gio = []; for (let p = 360; p <= 1410; p += 30) gio.push(`${String(Math.floor(p / 60)).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`);
  const gioDang = ll.lich.buoi[0]?.gio || '20:00';
  const oGio = h('select', { 'aria-label': 'Giờ live' }, gio.map((g) => h('option', { value: g, selected: g === gioDang }, g)));
  const oThu = THU.map(([v, t]) => {
    const o = h('input', { type: 'checkbox', checked: ll.lich.buoi.some((b) => b.thu === v) });
    return [v, o, h('label', { class: 'chip', style: 'cursor:pointer' }, o, ` ${t}`)];
  });
  const nutLuu = h('button', { class: 'btn small primary', type: 'button' }, 'Lưu lịch');
  const ke = h('p', { class: 'hint' }, ll.buoi_ke ? `Buổi kế: ${ll.buoi_ke.chu}${ll.buoi_ke.doi ? ' (đã dời)' : ''}.` : 'Chưa có lịch live.');
  nutLuu.addEventListener('click', async () => {
    try {
      const r = await dangLam(nutLuu, 'Đang lưu…', () => api.put('/lich-live', { buoi: oThu.filter((x) => x[1].checked).map(([thu]) => ({ thu, gio: oGio.value })) }));
      ke.textContent = r.buoi_ke ? `Buổi kế: ${r.buoi_ke.chu}.` : 'Chưa có lịch live.';
      toast('Đã lưu lịch live');
    } catch (e) { toast(e.message, true); }
  });
  const nutDoi = h('button', { class: 'btn small', type: 'button', disabled: !ll.buoi_ke }, 'Dời / Hủy buổi này');
  const bai = h('p', { class: 'hint' });
  nutDoi.addEventListener('click', async () => {
    const b = ll.buoi_ke;
    if (!b) return;
    const tl = prompt(`Buổi ${b.chu}: gõ giờ mới (ví dụ 21:00) để dời, hoặc gõ "hủy" để nghỉ buổi này:`);
    if (!tl) return;
    try {
      const huy = /h[uủ]y/i.test(tl);
      const r = await api.post('/lich-live/doi-buoi', huy ? { ngay: b.ngay, huy: true } : { ngay: b.ngay, gio_moi: tl.trim() });
      ke.textContent = r.buoi_ke ? `Buổi kế: ${r.buoi_ke.chu}.` : 'Chưa có buổi nào.';
      bai.textContent = r.bai ? `Bài báo ${huy ? 'nghỉ' : 'dời'} buổi (chép đăng Page): ${r.bai}` : '';
      toast(huy ? 'Đã hủy buổi này' : 'Đã dời buổi này');
    } catch (e) { toast(e.message, true); }
  });
  return [h('div', { class: 'hang' }, ...oThu.map((x) => x[2]), h('span', {}, ' lúc '), oGio), ke,
    h('p', { class: 'hint' }, 'Tư vấn viên, Co-host trả lời "khi nào shop live" theo lịch này. Lịch là lời hứa công khai: bận thì bấm "Dời / Hủy buổi này" để có bài báo dời.'),
    h('div', { class: 'nutbam' }, nutLuu, nutDoi), bai];
}

/* ---------------- vẽ màn hình ---------------- */

const NHAN_AN = { doi_ai_radio: 'Đội AI & Radio', lich_live: 'Lịch live', anh_khach: 'Ảnh khách mặc thật', khach_hang: 'Khách hàng', so_tay: 'Sổ tay', bao_cao: 'Báo cáo' };

/** Cài đặt → Phần mềm: ẩn bớt từng phần (chỉ ẩn mục menu và khối giao diện — chức năng máy chủ vẫn chạy) và tỷ giá USD → đồng. */
function vePhanMem(cd) {
  const an = new Set(cd.giao_dien?.an || []);
  const kq = h('p', { class: 'dat', hidden: true }, 'Đã lưu. Menu cập nhật ngay; khối trong Cài đặt cập nhật khi mở lại.');
  const ds = (cd.phan_an_duoc || Object.keys(NHAN_AN)).map((k) => {
    const o = h('input', { type: 'checkbox', checked: !an.has(k) });
    o.addEventListener('change', async () => {
      if (o.checked) an.delete(k); else an.add(k);
      try { await api.put('/cai-dat', { giao_dien: { an: [...an] } }); kq.hidden = false; } catch (e) { toast(e.message, true); o.checked = !o.checked; }
    });
    return h('label', { class: 'chon-o' }, o, ' ', NHAN_AN[k] || k);
  });
  const oTy = h('input', { type: 'text', inputmode: 'numeric', class: 'o-tien', value: String(cd.ty_gia_vnd ?? 26000), 'aria-label': 'Tỷ giá đồng cho 1 USD' });
  const nutTy = h('button', { class: 'btn small', type: 'button' }, 'Lưu tỷ giá');
  nutTy.addEventListener('click', () => dangLam(nutTy, 'Đang lưu…', async () => {
    try {
      const kqTy = await api.put('/cai-dat', { ty_gia_vnd: Number(String(oTy.value).replace(/[.,s]/g, '')) });
      datTyGia(kqTy.ty_gia_vnd);
      toast('Đã lưu tỷ giá');
    } catch (e) { toast(e.message, true); }
  }));
  return [
    h('p', { class: 'muted' }, 'Bỏ tích phần nào bạn không dùng để ẩn bớt cho gọn. Ẩn không tắt chức năng — chỉ giấu mục trên menu và khối trong Cài đặt.'),
    h('div', { class: 'cot' }, ...ds), kq,
    h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Tỷ giá (đồng cho 1 USD)', goiY('Chỉ để hiện số tiền Việt bên cạnh chi phí AI tính bằng USD.')), oTy), nutTy),
  ];
}

/** Cài đặt gồm hai phần: Chung (mọi thứ của shop) và Trợ lý AI (trước đây là màn Agent & Skill). */
export function roi() { troLyAi.roi?.(); }
export function coThayDoi() { return duongCon('cai-dat')[0] === 'tro-ly-ai' && !!troLyAi.coThayDoi?.(); }

export async function ve(khung) {
  const phanNay = duongCon('cai-dat')[0] === 'tro-ly-ai' ? 'tro-ly-ai' : 'chung';
  const noiDung = h('div', { class: 'view' });
  khung.replaceChildren(
    h('div', { class: 'viewbar' }, h('h1', {}, 'Cài đặt'),
      h('nav', { class: 'chon', 'aria-label': 'Phần của Cài đặt' },
        h('a', { href: '#/cai-dat', class: 'tab-link', 'aria-current': phanNay === 'chung' ? 'page' : null }, 'Chung'),
        h('a', { href: '#/cai-dat/tro-ly-ai', class: 'tab-link', 'aria-current': phanNay === 'tro-ly-ai' ? 'page' : null }, 'Trợ lý AI'))),
    noiDung);
  if (phanNay === 'tro-ly-ai') await troLyAi.ve(noiDung);
  else await veChungThat(noiDung);
}

async function veChungThat(khung) {
  const [cd, khoa, dsGiong, { cua }, fb, ll] = await Promise.all([api.get('/cai-dat'), api.get('/keys'), api.get('/giong'), api.get('/hook'), api.get('/ket-noi'), api.get('/lich-live')]);
  const an = new Set(cd.giao_dien?.an || []);
  const hookAn = cua.flatMap((c) => c.hook).find((x) => x.id === 'an_thong_tin_ca_nhan');
  const [canXuLy, aiKenh] = await Promise.all([veCanXuLy().catch(() => null), veAiKenh().catch(() => null)]);
  khung.replaceChildren(...[
    canXuLy,
    aiKenh,
    phan('Bán hàng', 'Thông tin shop và luật bán hàng. Phí ship là số ở đây — không ghi ở Sổ tay, để AI chỉ có một nguồn.', ...veBanHang(cd.ban_hang, cd.lua_chon?.ngan_hang || [], cd.lua_chon?.hang_van_chuyen || [])),
    !an.has('lich_live') && phan('Lịch live', 'Tích các thứ có live và chọn giờ. Bài báo trước buổi live soạn ở Livestream → "Báo trước buổi live".', ...veLichLive(ll)),
    phan('Khóa AI', 'Khóa chỉ lưu trong file .env trên máy này. Trình duyệt chỉ thấy 4 ký tự cuối. Không bao giờ dán khóa vào tin nhắn hay gửi cho ai.', ...veKhoa(khoa)),
    phan('Mai — trợ lý AI', null, ...veMai(cd, dsGiong)),
    !an.has('doi_ai_radio') && phan('Giọng riêng của Mai', 'Giọng do Google (Gemini 3.8 TTS) đọc, dùng cho tin nhắn thoại và miệng "Mai nói · giọng riêng" (sẽ làm ở các đợt sau). '
      + 'GPT Live 1 và Gemini Live chưa nhận giọng tự tạo nên vẫn dùng giọng ở phần trên.', veGiongMai()),
    !an.has('doi_ai_radio') && phan('Đội AI dẫn', 'Đội trợ lý AI nhiều giọng dẫn live như talk show (bản 2.9), hoặc kiểu đài phát thanh "Radio" của shop có bài hát và lời chúc. '
      + 'Kiểu dẫn nằm trong kịch bản (Kịch bản → ✨ AI soạn cho Đội AI dẫn / ✨ AI soạn Radio). Chọn chế độ "Đội AI dẫn" ở Livestream hoặc Phòng diễn tập.', veDoiAi()),
    phan('Trợ lý AI', 'Model cho các trợ lý AI. Đổi xong có tác dụng ở lần chạy kế tiếp, không cần khởi động lại. '
      + 'Skill, lời dặn vai trò, luật quyền, mức trần chi phí ở Cài đặt → Trợ lý AI.', ...veAgent(cd)),
    phan('Bình luận live', null, ...veAnBinhLuan(hookAn?.bat ?? true), ...veDoTre(cd.do_tre_phat)),
    phan('Phần mềm', null, ...vePhanMem(cd)),
    phan('Sao lưu', null, ...veSaoLuu(cd.sao_luu)),
    phan('Chạy nền 24/7', null, ...veChayNen()),
    phan('Facebook', 'Nối MOZA với Page bán hàng của shop (Page riêng, ứng dụng Meta riêng — không dùng lại mã của Page cũ). Mã chỉ lưu trong file .env trên máy này. Không bật "AI trả lời" của Meta trên Page này (sẽ trả lời chồng MOZA).', ...veFacebook(fb)),
    phan('OBS — lên sóng hai nguồn hình', 'Camera phòng live (điện thoại) + Màn hình sản phẩm do Mai điều khiển, OBS trên máy này ghép lại và phát lên Facebook. '
      + 'Chưa nối OBS thì chuyển cảnh chỉ mô phỏng — vẫn tập được trong Phòng diễn tập.', ...veObs()),
  ].filter(Boolean));
}
