// Khung giao diện (GD1): menu trái 3 nhóm, chuyển màn hình theo địa chỉ (#/hom-nay…), thanh trạng thái, ô "Nói với Mai" (F-62),
// công tắc "Dừng mọi thứ" (có ở mọi màn hình — F-03), và kết nối /ws để nhận thay đổi tức thời.

import { api } from './api.js';
import { h, toast } from './ui.js';
import { datKetNoi } from './ws.js';
import { chipMau } from './trang-thai.js';
import { datTyGia } from './dinh-dang.js';
import { doiDuongCu } from './duong-cu.js';
import * as homNay from './man-hinh/hom-nay.js';
import * as sanPham from './man-hinh/san-pham.js';
import * as kho from './man-hinh/kho.js';
import * as donMH from './man-hinh/don.js';
import { gan as ganNoiVoiMai } from './noi-voi-mai.js';
import * as soTay from './man-hinh/so-tay.js';
import * as caiDat from './man-hinh/cai-dat.js';
import * as liveMH from './man-hinh/live.js';
import * as nguoiDan from './man-hinh/nguoi-dan.js';
import * as hopThuMH from './man-hinh/hop-thu.js';
import * as khachMH from './man-hinh/khach.js';
import * as baoCaoMH from './man-hinh/bao-cao.js';
import * as anhKhachMH from './man-hinh/anh-khach.js';

// Màn hình người dẫn không có trên menu: mở từ Livestream hoặc tự mở khi live bắt đầu.
// `an`: khóa trong Cài đặt → Phần mềm → "Ẩn bớt" (chỉ ẩn mục menu, không tắt chức năng máy chủ).
export const NHOM_MENU = ['Bán hàng', 'Hàng hóa', 'Shop'];
const MAN_HINH = [
  { duong: 'hom-nay', ten: 'Hôm nay', bt: '☀', nhom: 0, mo: homNay },
  { duong: 'live', ten: 'Livestream', bt: '◉', nhom: 0, mo: liveMH },
  { duong: 'don', ten: 'Đơn hàng', bt: '▤', nhom: 0, mo: donMH },
  { duong: 'tin-nhan', ten: 'Tin nhắn', bt: '✉', nhom: 0, mo: hopThuMH },
  { duong: 'san-pham', ten: 'Sản phẩm', bt: '▣', nhom: 1, mo: sanPham },
  { duong: 'kho', ten: 'Tồn kho', bt: '▦', nhom: 1, mo: kho },
  { duong: 'khach', ten: 'Khách hàng', bt: '☺', nhom: 1, an: 'khach_hang', mo: khachMH },
  { duong: 'so-tay', ten: 'Sổ tay', bt: '✎', nhom: 2, an: 'so_tay', mo: soTay },
  { duong: 'bao-cao', ten: 'Báo cáo', bt: '▥', nhom: 2, an: 'bao_cao', mo: baoCaoMH },
  { duong: 'cai-dat', ten: 'Cài đặt', bt: '⚙', nhom: 2, mo: caiDat },
  { duong: 'nguoi-dan', ten: 'Màn hình người dẫn', mo: nguoiDan, kinNav: true },
  { duong: 'anh-khach', ten: 'Ảnh khách mặc thật', mo: anhKhachMH, kinNav: true, an: 'anh_khach' }, // F-104
];

const $ = (id) => document.getElementById(id);
let hienTai = null;
let phanAn = new Set();
let demMenu = { 'tin-nhan': 0, don: 0 };

function veNav(duong) {
  const muc = [];
  NHOM_MENU.forEach((ten, n) => {
    muc.push(h('div', { class: 'nhom' }, ten));
    for (const m of MAN_HINH.filter((x) => x.nhom === n && !x.kinNav && !(x.an && phanAn.has(x.an)))) {
      muc.push(h('a', { href: `#/${m.duong}`, title: m.ten, 'aria-current': m.duong === duong ? 'page' : null },
        h('span', { class: 'bt-menu', 'aria-hidden': 'true' }, m.bt), h('span', { class: 'chu-nav' }, m.ten),
        demMenu[m.duong] > 0 && h('span', { class: 'dem-menu' }, demMenu[m.duong])));
    }
  });
  $('nav').replaceChildren(...muc);
}

async function napCaiDatGiaoDien() {
  try {
    const cd = await api.get('/cai-dat');
    phanAn = new Set(cd.giao_dien?.an || []);
    datTyGia(cd.ty_gia_vnd);
  } catch { /* chưa nối được máy chủ: giữ mặc định */ }
}

async function moManHinh() {
  const cu = doiDuongCu(location.hash);
  if (cu) { history.replaceState(null, '', cu); }
  const duong = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'hom-nay';
  const m = MAN_HINH.find((x) => x.duong === duong) || MAN_HINH[0];
  hienTai?.mo.roi?.();
  veNav(m.duong);
  hienTai = m;
  // Màn hình người dẫn nền tối, chữ to (F-16): đổi bảng màu cho cả trang, kể cả thanh trên cùng.
  document.body.classList.toggle('nguoi-dan', m.duong === 'nguoi-dan');
  // "Nói với Mai" ở mọi màn hình trừ Màn hình người dẫn đang live (F-62).
  $('noiVoiMai').hidden = m.duong === 'nguoi-dan';
  if (m.duong === 'nguoi-dan') $('nvmKhung').hidden = true;
  const khung = h('div', { class: m.duong === 'nguoi-dan' ? 'view rong' : 'view' });
  $('main').replaceChildren(khung);
  try {
    await m.mo.ve(khung);
  } catch (e) {
    khung.replaceChildren(h('div', { class: 'panel' }, h('div', { class: 'empty' }, e.message)));
  }
}

// Sửa dở mà bấm sang màn hình khác thì hỏi trước.
window.addEventListener('hashchange', (e) => {
  if (hienTai?.mo.coThayDoi?.() && !confirm('Bạn đang sửa dở, chưa lưu. Rời màn hình này và bỏ phần đang sửa?')) {
    history.replaceState(null, '', new URL(e.oldURL).hash);
    return;
  }
  moManHinh();
});
window.addEventListener('beforeunload', (e) => {
  if (hienTai?.mo.coThayDoi?.()) e.preventDefault();
});

/* ---------------- thanh trạng thái ---------------- */

const CHU_KHAN_CAP = 'ĐANG DỪNG MỌI THỨ — AI không chạy, không gửi, không nói gì ra ngoài. Tắt công tắc ở góc phải để chạy lại.';

function datKhanCap(bat, lyDo = null) {
  $('khanCap').checked = bat;
  $('khanCapNhan').classList.toggle('dang-bat', bat);
  $('bangKhanCap').hidden = !bat;
  // Tự bật vì vượt mức trần chi phí thì nói rõ lý do và cách chạy lại (F-14).
  $('bangKhanCapChu').textContent = lyDo?.thong_diep ? `ĐANG DỪNG MỌI THỨ — ${lyDo.thong_diep}` : CHU_KHAN_CAP;
}

/** F-72: dải đỏ "Dừng AI" (kèm ô nâng trần + Chạy AI tiếp) và dải vàng từ 80% trần. */
function datChiPhi(dung, cp) {
  const bat = !!dung?.bat;
  $('bangDungAi').hidden = !bat;
  if (bat) {
    $('bangDungAiChu').textContent = dung.ly_do?.thong_diep || 'AI tạm dừng — chốt đơn vẫn chạy.';
    if (cp && !$('bangDungAiTran').value) $('bangDungAiTran').value = Math.ceil(Math.max(cp.tran_ngay * 1.5, cp.ngay + 5));
  }
  const vang = !bat && cp?.muc === 'vang';
  $('bangChiPhi').hidden = !vang;
  if (vang) $('bangChiPhiChu').textContent = `Chi phí AI đã tới ${Math.round(cp.ty_le * 100)}% mức trần (giờ qua ${cp.gio.toFixed(2)} / ${cp.tran_gio} USD · hôm nay ${cp.ngay.toFixed(2)} / ${cp.tran_ngay} USD). Chạm trần thì AI tạm dừng, chốt đơn vẫn chạy.`;
}

export async function capNhatTrangThai() {
  let t;
  try {
    t = await api.get('/trang-thai');
  } catch {
    $('trangThai').replaceChildren(chipMau('bad', 'Mất kết nối với phần mềm'));
    return;
  }
  datKhanCap(t.khan_cap, t.khan_cap_ly_do);
  datChiPhi(t.dung_ai, t.chi_phi);
  $('bangBanCu').hidden = !t.can_khoi_dong_lai;
  $('bangFacebook').hidden = t.facebook?.ma !== 'FB_MA_HET_HAN';
  const cam = t.page_bi_cam || [];
  $('bangPageCam').hidden = !cam.length;
  if (cam.length) {
    $('bangPageCamChu').textContent = `META ĐANG TẠM KHÓA NHẮN TIN CỦA PAGE ${cam.map((x) => x.ten).join(', ')} — MOZA đã dừng mọi tin chủ động; người chốt được gom tên công khai (không mời nhắn Page) và vào danh sách Nhắn bù. Mở Meta Business Suite → Chất lượng Page để xem lý do và thời hạn khóa.`;
    $('bangPageCamNhanBu').textContent = `Xem Nhắn bù (${t.nhan_bu || 0})`;
  }
  const muaFb = { xanh: 'ok', vang: 'warn', do: 'bad' }[t.facebook.muc] || 'mute';
  demMenu = { ...demMenu, 'tin-nhan': t.can_nguoi || 0 };
  if (hienTai) veNav(hienTai.duong);
  $('trangThai').replaceChildren(...[
    chipMau(muaFb, t.facebook.chu, { href: '#/cai-dat' }),
    t.ai.du
      ? chipMau('ok', 'AI: đủ khóa')
      : chipMau('warn', `AI: thiếu ${t.ai.thieu.length} khóa`, { href: '#/cai-dat', title: `Thiếu khóa: ${t.ai.thieu.join(', ')}` }),
    t.can_nguoi > 0 && chipMau('bad', `Cần người: ${t.can_nguoi}`, { href: '#/tin-nhan?loc=can_nguoi' }),
    t.cho_duyet > 0 && chipMau('warn', `Chờ duyệt: ${t.cho_duyet}`, { href: '#/cai-dat/tro-ly-ai/cho-duyet' }),
  ].filter(Boolean));
}

$('bangDungAiNut').addEventListener('click', async () => {
  try {
    const tran = Number($('bangDungAiTran').value);
    if (tran > 0) await api.put('/muc-tran', { ngay: tran, ngay_co_live: tran });
    await api.post('/dung-ai', { bat: false });
    $('bangDungAiTran').value = '';
    toast('AI chạy lại');
    capNhatTrangThai();
  } catch (loi) { toast(loi.message, true); }
});

$('khanCap').addEventListener('change', async (e) => {
  const bat = e.target.checked;
  try {
    const kq = await api.post('/khan-cap', { bat });
    datKhanCap(kq.khan_cap);
    toast(bat ? 'Đã DỪNG mọi thứ' : 'Tự động chạy lại bình thường');
  } catch (loi) {
    datKhanCap(!bat);
    toast(loi.message, true);
  }
});

/* ---------------- nhận thay đổi tức thời ---------------- */

function noiWs(lanThu = 0) {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => { lanThu = 0; datKetNoi(ws); window.dispatchEvent(new CustomEvent('moza:ws', { detail: { type: 'ws.mo' } })); };
  ws.onmessage = (ev) => {
    // Khung nhị phân là tiếng Mai (F-22): chỉ Màn hình người dẫn nghe sự kiện này.
    if (ev.data instanceof ArrayBuffer) {
      window.dispatchEvent(new CustomEvent('moza:am', { detail: ev.data }));
      return;
    }
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === 'khan_cap') datKhanCap(m.bat, m.ly_do);
    if (['trang_thai', 'cho_duyet', 'khan_cap', 'dung_ai', 'chi_phi.muc', 'ket_noi.trang_thai', 'can_nguoi', 'hop_thu.cap_nhat', 'don.nhan_bu'].includes(m.type)) capNhatTrangThai();
    if (m.type === 'cai_dat.giao_dien') napCaiDatGiaoDien().then(() => hienTai && veNav(hienTai.duong));
    // Live vừa bắt đầu mà đang ở màn hình Livestream thì mở luôn Màn hình người dẫn (F-19).
    if (m.type === 'live.bat_dau' && location.hash.startsWith('#/live')) location.hash = '#/nguoi-dan';
    // Chuyển mọi sự kiện cho màn hình đang mở tự xử lý.
    window.dispatchEvent(new CustomEvent('moza:ws', { detail: m }));
  };
  // Phần mềm tắt rồi tự chạy lại (start.bat) thì trang tự nối lại, chờ lâu dần tới 10 giây.
  ws.onclose = () => {
    capNhatTrangThai();
    setTimeout(() => noiWs(lanThu + 1), Math.min(10000, 1000 * 2 ** lanThu));
  };
}

ganNoiVoiMai({ o: $('noiVoiMai'), khung: $('nvmKhung') });
capNhatTrangThai();
setInterval(capNhatTrangThai, 30000);
noiWs();
napCaiDatGiaoDien().finally(moManHinh);
