// Sản phẩm (SPEC.md F-51, #61, #75; GD1 F-124): danh sách + chi tiết 5 tab (Cơ bản · Màu và cỡ · Ảnh · Thông tin cho Mai · Hỏi đáp), "Tạo từ ảnh" (AI điền trước, ô
// AI điền mang nhãn "AI đoán" tới khi người xác nhận), bảng Màu × Cỡ có tồn từng ô, thanh "AI đã đủ thông tin", Nhân bản,
// Xem thử AI hiểu gì, thẻ AI đọc, lịch sử bản sửa. Thẻ con "Bảng size" quản lý các bảng size dùng chung.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam, hoi } from '../ui.js';
import { chipTrangThai, BANG } from '../trang-thai.js';
import { tien as tienChung, docTien } from '../dinh-dang.js';

export { docTien };
const TRANG_THAI_SP = BANG.san_pham;
export const chipSp = (t) => chipTrangThai('san_pham', t);
export const tien = (n) => tienChung(n, true);
export const urlAnh = (spId, tep) => `/api/anh/${spId}/${tep}`;

/** Thu nhỏ ảnh trên trình duyệt (cạnh dài 1600 px, JPEG 0,85 — mục 6) rồi tải vào khu tạm. Trả tên tệp. */
export async function taiAnh(file) {
  const bmp = await createImageBitmap(file);
  const tiLe = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * tiLe);
  c.height = Math.round(bmp.height * tiLe);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
  const r = await fetch('/api/anh-tam', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.loi?.thong_diep || 'Tải ảnh không được.');
  return j.tep;
}

const tachDs = (s) => [...new Set(String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))];

let st = null;

export function coThayDoi() {
  return !!st?.form && JSON.stringify(st.form) !== st.gocChu;
}

export async function ve(khung) {
  const the = new URLSearchParams(location.hash.split('?')[1] || '').get('the') === 'bang-size' ? 'bang-size' : 'san-pham';
  st = { the, q: '', loc: '', kho: '', ds: [], dem: {}, chon: new URLSearchParams(location.hash.split('?')[1] || '').get('id') || null, form: null, gocChu: '', cauHinh: null, bangSize: [], chiTiet: null };
  st.cauHinh = await api.get('/cau-hinh/danh-muc');
  st.bangSize = (await api.get('/bang-size')).bang_size;

  const nutThe = (id, ten) => h('a', { class: 'btn small', href: `#/san-pham${id === 'bang-size' ? '?the=bang-size' : ''}`, 'aria-current': st.the === id ? 'page' : null }, ten);
  const dauTrang = h('div', { class: 'viewbar' },
    h('h1', {}, st.the === 'bang-size' ? 'Bảng size' : 'Sản phẩm'),
    h('div', { class: 'chon' }, nutThe('san-pham', 'Sản phẩm'), nutThe('bang-size', 'Bảng size')),
    h('span', { class: 'grow' }),
    st.the === 'san-pham' && h('button', { class: 'btn', type: 'button', onclick: () => chon('moi') }, '+ Tạo tay'),
    st.the === 'san-pham' && h('button', { class: 'btn primary', type: 'button', onclick: () => moTaoTuAnh() }, '📷 Tạo từ ảnh'));
  if (st.the === 'bang-size') {
    khung.replaceChildren(dauTrang);
    return veBangSize(khung);
  }

  const oTim = h('input', { type: 'search', placeholder: 'Tìm theo số, tên (gõ không dấu cũng được)', 'aria-label': 'Tìm sản phẩm' });
  const boLoc = h('div', { class: 'chon', role: 'group', 'aria-label': 'Lọc' });
  const danhSach = h('div', { class: 'ds' });
  const phai = h('section', { class: 'panel' });
  khung.replaceChildren(dauTrang, h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, h('header', {}, oTim, boLoc), danhSach), phai));

  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { st.q = oTim.value; taiDanhSach(); }, 200); });

  async function taiDanhSach() {
    const kq = await api.get(`/san-pham?${new URLSearchParams({ q: st.q, trang_thai: st.loc, kho: st.kho })}`);
    st.ds = kq.san_pham;
    st.dem = kq.dem;
    veBoLoc();
    veDanhSach();
  }

  function veBoLoc() {
    const tong = Object.values(st.dem).reduce((a, b) => a + b, 0);
    const nut = (loc, kho, ten) => h('button', {
      type: 'button', 'aria-pressed': String(st.loc === loc && st.kho === kho), onclick: () => { st.loc = loc; st.kho = kho; taiDanhSach(); },
    }, ten);
    boLoc.replaceChildren(nut('', '', `Tất cả ${tong}`), ...Object.entries(TRANG_THAI_SP).map(([k, v]) => nut(k, '', `${v.ten} ${st.dem[k] || 0}`)),
      nut('', 'sap_het', 'Sắp hết'), nut('', 'het_hang', 'Hết hàng'));
  }

  function veDanhSach() {
    if (!st.ds.length) {
      const co = Object.values(st.dem).some((n) => n > 0);
      danhSach.replaceChildren(h('div', { class: 'empty' }, co ? 'Không có sản phẩm nào khớp.' : 'Chưa có sản phẩm nào.',
        !co && h('button', { class: 'btn primary', type: 'button', onclick: () => moTaoTuAnh() }, '📷 Tạo từ ảnh')));
      return;
    }
    danhSach.replaceChildren(...st.ds.map((x) => h('button', { type: 'button', class: 'sp-dong', 'aria-current': String(st.chon === x.id), onclick: () => chon(x.id) },
      h('span', { class: 'sp-anh' }, x.anh_dai_dien ? h('img', { src: urlAnh(x.id, x.anh_dai_dien), alt: '' }) : '👕'),
      h('span', { class: 'sp-chu' },
        h('span', { class: 'dong1' }, h('b', {}, `Số ${x.so}`), chipSp(x.trang_thai), x.het_hang ? h('span', { class: 'chip bad' }, 'Hết hàng') : x.sap_het && h('span', { class: 'chip warn' }, 'Sắp hết')),
        h('span', { class: 'dong2' }, x.ten),
        h('span', { class: 'dong3' }, `${tien(x.gia)} · còn ${x.con_ban_duoc} · ${x.ten_danh_muc}${x.do_day_du.du ? '' : ' · thiếu thông tin cho AI'}`)))));
  }

  /* ---------------- chi tiết ---------------- */

  function formTrong() {
    const dm = st.cauHinh.danh_muc[0];
    return {
      so: st.cauHinh.so_ke_tiep, ten: '', danh_muc: dm.khoa, trang_thai: 'nhap', thuong_hieu: '', gia: '', gia_goc: '', gia_von: '',
      thong_so: {}, bang_size_id: '', nhom: { t1: 'Màu', t2: 'Cỡ' }, anh: [], video: [], can_nang_g: '', kich_thuoc_cm: ['', '', ''],
      mo_ta: '', diem_noi_bat: '', ten_goi_khac: '', phoi_cung: [], hoi_dap: [], ghi_chu_noi_bo: '', ai_doan: [],
      gia_tri_1: '', gia_tri_2: 'S, M, L, XL', o: {},
    };
  }

  /** Bản ghi máy chủ → form (các ô chữ nhiều ý nối bằng dấu phẩy / xuống dòng; lưới phân loại theo khóa "gt1|gt2"). */
  function tuChiTiet(ct) {
    const s = ct.san_pham;
    const o = {};
    for (const p of ct.phan_loai) o[`${p.gt1}|${p.gt2 || ''}`] = { id: p.id, sku: p.sku, gia: p.gia ?? '', ton: p.ton, con: p.con_ban_duoc, giu: p.dang_giu, bo: p.bo, cu: true };
    return {
      so: s.so, ten: s.ten, danh_muc: s.danh_muc, trang_thai: s.trang_thai, thuong_hieu: s.thuong_hieu, gia: s.gia, gia_goc: s.gia_goc ?? '', gia_von: s.gia_von ?? '',
      thong_so: { ...s.thong_so }, bang_size_id: s.bang_size_id || '', nhom: { t1: s.nhom.t1, t2: s.nhom.t2 || '' }, anh: s.anh.map((a) => ({ ...a })), video: (s.video || []).map((v) => ({ ...v })),
      can_nang_g: s.can_nang_g ?? '', kich_thuoc_cm: s.kich_thuoc_cm || ['', '', ''],
      mo_ta: s.mo_ta, diem_noi_bat: s.diem_noi_bat.join('\n'), ten_goi_khac: s.ten_goi_khac.join(', '), phoi_cung: [...s.phoi_cung],
      hoi_dap: s.hoi_dap.map((x) => ({ ...x })), ghi_chu_noi_bo: s.ghi_chu_noi_bo, ai_doan: [...s.ai_doan],
      gia_tri_1: [...new Set(ct.phan_loai.map((p) => p.gt1))].join(', '), gia_tri_2: [...new Set(ct.phan_loai.map((p) => p.gt2).filter(Boolean))].join(', '), o,
    };
  }

  async function chon(id, nhapSan = null) {
    if (coThayDoi() && !(await hoi({ tieuDe: 'Bỏ phần đang sửa?', noiDung: 'Sản phẩm đang sửa dở chưa lưu.', nhan: 'Bỏ phần sửa', nguyHiem: true }))) return;
    st.chon = id;
    st.tab = 'co-ban';
    st.chiTiet = null;
    if (id === 'moi') {
      st.form = nhapSan || formTrong();
      st.gocChu = nhapSan ? '' : JSON.stringify(st.form);
    } else {
      st.chiTiet = await api.get(`/san-pham/${id}`);
      st.form = tuChiTiet(st.chiTiet);
      st.gocChu = JSON.stringify(st.form);
    }
    veDanhSach();
    veChiTiet();
  }

  /** Dữ liệu gửi máy chủ từ form. */
  function thanGui() {
    const f = st.form;
    const g1 = tachDs(f.gia_tri_1);
    const g2 = f.nhom.t2 ? tachDs(f.gia_tri_2) : [null];
    const phanLoai = [];
    for (const a of g1) for (const b of g2) {
      const o = f.o[`${a}|${b || ''}`] || {};
      const trong = !o.cu && (o.ton === '' || o.ton == null);
      phanLoai.push({ gt1: a, gt2: b, sku: o.sku || undefined, gia: o.gia === '' ? null : o.gia, ton: o.cu ? undefined : (trong ? 0 : Number(o.ton)), bo: o.cu ? !!o.bo : trong });
    }
    return {
      so: Number(f.so), ten: f.ten, danh_muc: f.danh_muc, trang_thai: f.trang_thai, thuong_hieu: f.thuong_hieu,
      gia: f.gia, gia_goc: f.gia_goc || null, gia_von: f.gia_von || null, thong_so: f.thong_so, bang_size_id: f.bang_size_id || null,
      nhom: { t1: f.nhom.t1 || 'Màu', t2: f.nhom.t2 || null }, anh: f.anh, video: f.video || [], can_nang_g: f.can_nang_g || null,
      kich_thuoc_cm: f.kich_thuoc_cm.some((x) => x !== '' && x != null) ? f.kich_thuoc_cm : null,
      mo_ta: f.mo_ta, diem_noi_bat: tachDs(f.diem_noi_bat.replace(/\n/g, ';')), ten_goi_khac: tachDs(f.ten_goi_khac), phoi_cung: f.phoi_cung,
      hoi_dap: f.hoi_dap.filter((x) => x.hoi.trim() || x.dap.trim()), ghi_chu_noi_bo: f.ghi_chu_noi_bo, ai_doan: f.ai_doan, phan_loai: phanLoai,
    };
  }

  /** Hộp nhỏ cho một ô tồn: Nhập thêm (+số) hoặc Điều chỉnh (đếm lại) → API kho có sẵn, ghi lịch sử kho. */
  function hoiTon(x, ten) {
    let kieu = 'nhap';
    const oSo = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': 'Số lượng', placeholder: 'số', class: 'nho' });
    const loi = h('p', { class: 'loi', role: 'alert' });
    const chonKieu = h('div', { class: 'chon', role: 'group', 'aria-label': 'Cách ghi' });
    const veKieu = () => chonKieu.replaceChildren(...[['nhap', 'Nhập thêm'], ['chinh', 'Điều chỉnh (đếm lại)']].map(([k, ten2]) => h('button', {
      type: 'button', 'aria-pressed': String(kieu === k), onclick: () => { kieu = k; oSo.placeholder = k === 'nhap' ? '+ số' : 'tồn đếm được'; veKieu(); },
    }, ten2)));
    veKieu();
    const lop = h('div', { class: 'hop-hoi-lop', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Tồn ${ten}` });
    const dong = () => lop.remove();
    const nutOk = h('button', { class: 'btn primary', type: 'button' }, 'Ghi vào kho');
    nutOk.addEventListener('click', async () => {
      const n = Number(oSo.value);
      if (oSo.value.trim() === '' || !Number.isInteger(n) || (kieu === 'nhap' ? n <= 0 : n < 0)) { loi.textContent = kieu === 'nhap' ? 'Gõ số lượng nhập thêm (số nguyên lớn hơn 0).' : 'Gõ số tồn đếm được (0 trở lên).'; return; }
      try {
        const sach = !coThayDoi();
        const kq = await dangLam(nutOk, 'Đang ghi…', () => api.post(kieu === 'nhap' ? '/kho/nhap' : '/kho/dieu-chinh',
          kieu === 'nhap' ? { dong: [{ phan_loai_id: x.id, so: n }] } : { dong: [{ phan_loai_id: x.id, ton: n }], ghi_chu: 'kiểm kê' }));
        const moi = kq.ket_qua?.[0]?.ton ?? (kieu === 'nhap' ? x.ton + n : n);
        x.con += moi - x.ton;
        x.ton = moi;
        if (sach) st.gocChu = JSON.stringify(st.form);
        toast(`${ten}: tồn ${moi}`);
        dong();
        veChiTiet();
      } catch (e) { loi.textContent = e.message; }
    });
    lop.addEventListener('click', (e) => { if (e.target === lop) dong(); });
    lop.append(h('div', { class: 'hop-hoi' }, h('h2', {}, `Tồn ${ten}`), h('p', { class: 'muted' }, `Đang tồn ${x.ton}, còn bán được ${x.con}.`), chonKieu, oSo, loi,
      h('div', { class: 'nutbam' }, nutOk, h('button', { class: 'btn', type: 'button', onclick: dong }, 'Thôi'))));
    document.body.append(lop);
    oSo.focus();
  }

  function veChiTiet() {
    if (!st.form) {
      phai.replaceChildren(h('div', { class: 'empty' }, st.ds.length ? 'Chọn một sản phẩm bên trái để xem và sửa.' : 'Bấm "📷 Tạo từ ảnh": kéo ảnh vào, AI điền trước thông tin, bạn chỉ gõ giá và tồn.'));
      return;
    }
    const f = st.form;
    st.tab ||= 'co-ban';
    const moi = st.chon === 'moi';
    const s = st.chiTiet?.san_pham;
    const dm = st.cauHinh.danh_muc.find((d) => d.khoa === f.danh_muc) || st.cauHinh.danh_muc[0];
    const loi = h('p', { class: 'loi', role: 'alert' });
    const doi = () => veChiTiet();

    // Ô AI đoán: tô màu, bấm "✓ Đúng" hoặc sửa ô là thành đã xác nhận (#75).
    const laDoan = (k) => f.ai_doan.includes(k);
    const xacNhan = (k) => { f.ai_doan = f.ai_doan.filter((x) => x !== k); };
    const nhanDoan = (k) => laDoan(k) && h('span', { class: 'ai-doan-nhan' }, 'AI đoán',
      h('button', { type: 'button', class: 'btn small', onclick: () => { xacNhan(k); doi(); } }, '✓ Đúng'));
    const o = (nhan, input, k = null, goiY = null) => h('label', { class: `field${k && laDoan(k) ? ' ai-doan' : ''}` },
      h('span', {}, nhan, k && nhanDoan(k)), input, goiY && h('p', { class: 'hint' }, goiY));
    const oChu = (gt, datGt, { k = null, ...tt } = {}) => {
      const e = h('input', { type: 'text', value: gt ?? '', ...tt });
      e.addEventListener('input', () => { datGt(e.value); if (k) xacNhan(k); });
      return e;
    };
    const oVung = (gt, datGt, { k = null, ...tt } = {}) => {
      const e = h('textarea', { ...tt });
      e.value = gt ?? '';
      e.addEventListener('input', () => { datGt(e.value); if (k) xacNhan(k); });
      return e;
    };

    /* 1. cơ bản */
    const chonTT = h('div', { class: 'chon', role: 'group', 'aria-label': 'Trạng thái' },
      Object.entries(TRANG_THAI_SP).map(([k, v]) => h('button', { type: 'button', 'aria-pressed': String(f.trang_thai === k), onclick: () => { f.trang_thai = k; doi(); } }, v.ten)));
    const chonDm = h('select', { 'aria-label': 'Danh mục' }, st.cauHinh.danh_muc.map((d) => h('option', { value: d.khoa, selected: d.khoa === f.danh_muc }, d.ten)));
    chonDm.addEventListener('change', () => { f.danh_muc = chonDm.value; doi(); });

    const g1 = tachDs(f.gia_tri_1);
    const oAnh = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    oAnh.addEventListener('change', async () => {
      const ds = [...oAnh.files].slice(0, 9 - f.anh.length);
      try {
        for (const file of ds) f.anh.push({ tep: await taiAnh(file), mau: null, tam: true });
        doi();
      } catch (e) { toast(e.message, true); }
    });
    const luoiAnh = h('div', { class: 'anh-luoi' },
      f.anh.map((a, i) => h('div', { class: 'anh-o' },
        h('img', { src: a.tam || moi ? urlAnh('tam', a.tep) : urlAnh(st.chon, a.tep), alt: `Ảnh ${i + 1}`, onerror: (e) => { e.target.src = urlAnh(st.chon && !moi ? st.chon : 'tam', a.tep); } }),
        i === 0 ? h('span', { class: 'chip accent' }, 'Đại diện') : h('button', { type: 'button', class: 'btn small', onclick: () => { f.anh.unshift(f.anh.splice(i, 1)[0]); doi(); } }, 'Làm đại diện'),
        (() => {
          const c = h('select', { 'aria-label': 'Màu của ảnh' }, h('option', { value: '' }, 'Màu: —'), g1.map((m) => h('option', { value: m, selected: a.mau === m }, m)));
          c.addEventListener('change', () => { a.mau = c.value || null; });
          return c;
        })(),
        h('button', { type: 'button', class: 'btn small danger', onclick: () => { f.anh.splice(i, 1); doi(); } }, 'Bỏ'))),
      f.anh.length < 9 && h('button', { type: 'button', class: 'anh-them', onclick: () => oAnh.click() }, '+ Thêm ảnh'), oAnh);

    // Video (#90): quay bằng điện thoại, chiếu trên Màn hình sản phẩm khi live. MP4 / WebM, tối đa 3 video, mỗi video 80 MB.
    f.video = f.video || [];
    const oVideo = h('input', { type: 'file', accept: 'video/mp4,video/webm', hidden: true });
    oVideo.addEventListener('change', async () => {
      const file = oVideo.files[0];
      if (!file) return;
      if (file.size > 80 * 1024 * 1024) { toast('Video quá 80 MB — cắt ngắn (15–40 giây là đẹp) rồi tải lại.', true); return; }
      try {
        toast('Đang tải video…');
        const r = await fetch('/api/video-tam', { method: 'POST', headers: { 'Content-Type': file.type || 'video/mp4' }, body: file });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.loi?.thong_diep || 'Tải video không được.');
        f.video.push({ tep: j.tep, mau: null, tam: true });
        doi();
      } catch (e) { toast(e.message, true); }
    });
    const urlVideo = (v) => `/api/video/${v.tam || moi ? 'tam' : st.chon}/${v.tep}`;
    const luoiVideo = h('div', { class: 'anh-luoi' },
      f.video.map((v, i) => h('div', { class: 'anh-o' },
        h('video', { src: `${urlVideo(v)}#t=1`, muted: true, preload: 'metadata', controls: true }),
        (() => {
          const c = h('select', { 'aria-label': 'Màu của video' }, h('option', { value: '' }, 'Màu: —'), g1.map((m) => h('option', { value: m, selected: v.mau === m }, m)));
          c.addEventListener('change', () => { v.mau = c.value || null; });
          return c;
        })(),
        // F-81: video AI dựng từ ảnh không chiếu ở buổi live thật; người bấm bỏ cờ khi đó là video tự quay.
        v.dung_thu && h('span', { class: 'chip warn' }, 'Video dựng thử — không chiếu cho khách'),
        v.dung_thu && h('button', { type: 'button', class: 'btn small', onclick: () => { delete v.dung_thu; doi(); } }, 'Đây là video quay thật'),
        h('button', { type: 'button', class: 'btn small danger', onclick: () => { f.video.splice(i, 1); doi(); } }, 'Bỏ'))),
      f.video.length < 3 && h('button', { type: 'button', class: 'anh-them', onclick: () => oVideo.click() }, '+ Thêm video'), oVideo);

    const khoi1 = h('fieldset', { class: 'khoi' }, h('legend', {}, 'Cơ bản'),
      h('div', { class: 'grid2' },
        o('Số sản phẩm (khách chốt bằng số này)', oChu(f.so, (v) => { f.so = v; }, { inputmode: 'numeric', maxlength: 5 })),
        o('Danh mục', chonDm)),
      o('Tên sản phẩm', oChu(f.ten, (v) => { f.ten = v; }, { maxlength: 120, placeholder: 'VD: Sơ mi linen tay ngắn' })),
      h('div', { class: 'field' }, h('span', {}, 'Trạng thái'), chonTT, h('p', { class: 'hint' }, 'Chỉ sản phẩm "Đang bán" được AI nói tới và khách chốt được. Hết hàng tự tính từ tồn.')),
      o('Thương hiệu', oChu(f.thuong_hieu, (v) => { f.thuong_hieu = v; }, { maxlength: 80, placeholder: 'Để trống = hàng của shop' })));

    const khoiAnh = h('fieldset', { class: 'khoi' }, h('legend', {}, 'Ảnh và video'),
      h('div', { class: 'field' }, h('span', {}, `Ảnh (${f.anh.length}/9) — ảnh đầu là đại diện; gắn màu để AI gửi đúng ảnh khi khách hỏi màu đó`), luoiAnh),
      h('div', { class: 'field' }, h('span', {}, `Video (${f.video.length}/3) — quay mặc thử, cận chất vải; chiếu lên Màn hình sản phẩm khi live (tiếng video tắt)`), luoiVideo));

    /* 2. giá */
    const hienThu = (gt) => { const n = docTien(gt); return gt === '' || gt == null ? '' : Number.isNaN(n) ? 'Chưa đọc được — gõ kiểu 289k, 289000, 1tr2' : `= ${tien(n)}`; };
    const oGia = (k, nhan, goiY) => {
      const thu = h('p', { class: 'hint' }, hienThu(f[k]));
      const e = oChu(f[k], (v) => { f[k] = v; thu.textContent = hienThu(v); }, { inputmode: 'decimal', placeholder: 'VD: 289k' });
      return h('label', { class: 'field' }, h('span', {}, nhan), e, thu, goiY && h('p', { class: 'hint' }, goiY));
    };
    const khoi2 = h('fieldset', { class: 'khoi' }, h('legend', {}, 'Giá'),
      h('div', { class: 'grid3' },
        oGia('gia', 'Giá bán'),
        oGia('gia_goc', 'Giá gốc (trước giảm)', st.chiTiet?.san_pham?.gia_goc_co_bang_chung
          ? 'Đã có đơn giao ở giá này trong 30 ngày: màn hình hiện giá gạch, AI được nói "giảm từ …".'
          : 'Giá gạch chỉ hiện (trên màn hình và lời AI) khi đã có đơn Đã giao ở đúng giá gốc trong 30 ngày — hiện đang ẩn. Ghi giá gốc chưa từng bán là vi phạm quảng cáo.'),
        oGia('gia_von', 'Giá vốn (nội bộ)', 'AI không bao giờ thấy; dùng cho báo cáo lãi gộp.')),
      h('p', { class: 'hint' }, 'Giá riêng từng màu × cỡ (ví dụ XXL đắt hơn): ghi ở bảng phân loại bên dưới.'));

    /* 3. thông số theo danh mục */
    const cacTs = dm.thong_so.map((k) => {
      const ts = st.cauHinh.thong_so[k];
      const kk = `thong_so.${k}`;
      if (ts.kieu === 'mot') {
        const c = h('select', {}, h('option', { value: '' }, '—'), Object.entries(ts.lua_chon).map(([a, b]) => h('option', { value: a, selected: f.thong_so[k] === a }, b)));
        c.addEventListener('change', () => { if (c.value) f.thong_so[k] = c.value; else delete f.thong_so[k]; xacNhan(kk); doi(); });
        return o(ts.ten, c, kk);
      }
      if (ts.kieu === 'nhieu') {
        const ds = new Set(f.thong_so[k] || []);
        const nut = h('div', { class: 'the-chon' }, Object.entries(ts.lua_chon).map(([a, b]) => h('button', {
          type: 'button', 'aria-pressed': String(ds.has(a)),
          onclick: () => { if (ds.has(a)) ds.delete(a); else ds.add(a); if (ds.size) f.thong_so[k] = [...ds]; else delete f.thong_so[k]; xacNhan(kk); doi(); },
        }, b)));
        const ghi = ts.co_ghi && oChu(f.thong_so[`${k}_ghi`], (v) => { if (v) f.thong_so[`${k}_ghi`] = v; else delete f.thong_so[`${k}_ghi`]; xacNhan(kk); },
          { maxlength: 300, placeholder: 'Ghi thêm, ví dụ "Linen 70%, cotton 30%"' });
        return h('div', { class: `field${laDoan(kk) ? ' ai-doan' : ''}` }, h('span', {}, ts.ten, nhanDoan(kk)), nut, ghi);
      }
      return o(ts.ten, oChu(f.thong_so[k], (v) => { if (v) f.thong_so[k] = v; else delete f.thong_so[k]; xacNhan(kk); }, { maxlength: 300 }), kk);
    });
    const khoi3 = h('fieldset', { class: 'khoi' }, h('legend', {}, `Thông số (${dm.ten})`), h('div', { class: 'grid2' }, cacTs),
      h('p', { class: 'hint' }, 'Chọn từ danh sách là chính. Đổi danh mục thì ô trùng tên được giữ.'));

    /* 4. bảng size */
    const chonBs = h('select', {}, h('option', { value: '' }, '— Chưa có bảng size —'), st.bangSize.map((b) => h('option', { value: b.id, selected: b.id === f.bang_size_id }, b.ten)));
    chonBs.addEventListener('change', () => { f.bang_size_id = chonBs.value; doi(); });
    const bs = st.bangSize.find((b) => b.id === f.bang_size_id);
    const khoi4 = h('fieldset', { class: 'khoi' }, h('legend', {}, 'Bảng size'),
      h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Bảng size dùng chung'), chonBs),
        h('a', { class: 'btn small', href: '#/san-pham?the=bang-size' }, 'Quản lý bảng size')),
      bs ? veBang(bs) : h('p', { class: 'hint' }, 'AI chỉ tư vấn size theo bảng này. Chưa có bảng thì AI nói "shop sẽ báo" và tạo việc cho bạn.'));

    /* 5. phân loại và kho */
    const oNhom1 = oChu(f.nhom.t1, (v) => { f.nhom.t1 = v; }, { maxlength: 20 });
    const oNhom2 = oChu(f.nhom.t2, (v) => { f.nhom.t2 = v; }, { maxlength: 20, placeholder: 'Để trống nếu hàng một cỡ' });
    oNhom2.addEventListener('change', doi);
    const oGt1 = oChu(f.gia_tri_1, (v) => { f.gia_tri_1 = v; }, { placeholder: 'VD: Đen, Trắng, Be' });
    const oGt2 = oChu(f.gia_tri_2, (v) => { f.gia_tri_2 = v; }, { placeholder: 'VD: S, M, L, XL', disabled: !f.nhom.t2 });
    oGt1.addEventListener('change', doi);
    oGt2.addEventListener('change', doi);
    const g2 = f.nhom.t2 ? tachDs(f.gia_tri_2) : [''];
    const oLuoi = (a, b) => {
      const k = `${a}|${b}`;
      f.o[k] ||= { ton: '', gia: '', sku: '' };
      const x = f.o[k];
      if (x.cu) {
        // Ô tồn có màu (xanh còn · vàng sắp hết · đỏ hết): bấm để Nhập thêm / Điều chỉnh — ghi lịch sử kho như màn Tồn kho.
        const bat = h('input', { type: 'checkbox', checked: !x.bo, title: 'Còn bán tổ hợp này' });
        bat.addEventListener('change', () => { x.bo = !bat.checked; });
        const gia = h('input', { type: 'text', value: x.gia, placeholder: 'giá riêng', class: 'nho', 'aria-label': `Giá riêng ${a} ${b}` });
        gia.addEventListener('input', () => { x.gia = gia.value; });
        const nguong = st.nguongSapHet ?? 3;
        const mau = x.bo ? 'khong' : x.con <= 0 ? 'het' : x.con <= nguong ? 'it' : '';
        const nutTon = h('button', { type: 'button', class: mau, title: `Tồn ${x.ton}${x.giu ? ` · đang giữ ${x.giu}` : ''} — bấm để nhập thêm hoặc điều chỉnh`,
          onclick: () => hoiTon(x, `${a}${b ? ` / ${b}` : ''}`) }, x.bo ? 'ngừng' : String(x.con));
        return h('td', { class: x.bo ? 'bo' : '' }, h('div', { class: 'o-pl' }, nutTon, h('span', { class: 'hint' }, `tồn ${x.ton}`), gia, h('label', { class: 'hint' }, bat, ' bán')));
      }
      const ton = h('input', { type: 'text', inputmode: 'numeric', value: x.ton, placeholder: 'tồn', class: 'nho', 'aria-label': `Tồn ${a} ${b}` });
      ton.addEventListener('input', () => { x.ton = ton.value; });
      const gia = h('input', { type: 'text', value: x.gia, placeholder: 'giá riêng', class: 'nho' });
      gia.addEventListener('input', () => { x.gia = gia.value; });
      return h('td', {}, h('div', { class: 'o-pl' }, ton, gia));
    };
    const luoi = g1.length ? h('table', { class: 'luoi-pl luoi-ton' },
      h('thead', {}, h('tr', {}, h('th', {}, f.nhom.t2 ? `${f.nhom.t1} \\ ${f.nhom.t2}` : f.nhom.t1), g2.map((b) => h('th', {}, b || 'Tồn')))),
      h('tbody', {}, g1.map((a) => h('tr', {}, h('th', {}, a), g2.map((b) => oLuoi(a, b)))))) : h('p', { class: 'hint' }, 'Gõ các màu (nhóm 1) để hiện bảng.');
    const khoi5 = h('fieldset', { class: 'khoi' }, h('legend', {}, 'Màu, cỡ và tồn kho'),
      h('div', { class: 'grid2' }, o('Tên nhóm 1', oNhom1), o('Tên nhóm 2', oNhom2), o(`Các ${f.nhom.t1 || 'giá trị'} (cách nhau dấu phẩy)`, oGt1), o(`Các ${f.nhom.t2 || 'giá trị'}`, oGt2)),
      luoi,
      h('p', { class: 'hint' }, moi ? 'Điền tồn ban đầu từng ô; ô để trống = không bán tổ hợp đó. Giá riêng để trống = giá bán của mẫu. Mã phân loại (SKU) tự sinh kiểu 12-DEN-M.'
        : 'Ô cũ giữ nguyên tồn (nhập thêm, kiểm kê ở màn hình Tồn kho hoặc "Nói với Mai"). Thêm màu, cỡ mới thì ô mới điền tồn ban đầu.'),
      h('details', {}, h('summary', {}, 'Đóng gói (cho vận chuyển, sàn — chưa dùng ở bản này)'),
        h('div', { class: 'grid2' },
          o('Cân nặng gói hàng (gram)', oChu(f.can_nang_g, (v) => { f.can_nang_g = v; }, { inputmode: 'numeric' })),
          o('Kích thước gói (dài × rộng × cao, cm)', h('div', { class: 'hang' }, [0, 1, 2].map((i) => oChu(f.kich_thuoc_cm[i], (v) => { f.kich_thuoc_cm[i] = v; }, { inputmode: 'numeric', class: 'nho' })))))));

    /* 6. dành cho AI + nội bộ */
    const khac = st.ds.filter((x) => x.id !== st.chon);
    const phoi = h('div', { class: 'the-chon' }, khac.map((x) => h('button', {
      type: 'button', 'aria-pressed': String(f.phoi_cung.includes(x.id)),
      onclick: () => { f.phoi_cung = f.phoi_cung.includes(x.id) ? f.phoi_cung.filter((y) => y !== x.id) : [...f.phoi_cung, x.id]; doi(); },
    }, `Số ${x.so} · ${x.ten}`)));
    const hoiDap = h('div', { class: 'cot', style: 'align-items:stretch' },
      f.hoi_dap.map((x, i) => h('div', { class: 'hang' },
        oChu(x.hoi, (v) => { x.hoi = v; }, { placeholder: 'Hỏi, ví dụ "Có lót trong không?"' }),
        oChu(x.dap, (v) => { x.dap = v; }, { placeholder: 'Đáp, ví dụ "Có lót lưới"' }),
        h('button', { type: 'button', class: 'btn small danger', onclick: () => { f.hoi_dap.splice(i, 1); doi(); } }, 'Bỏ'))),
      h('button', { type: 'button', class: 'btn small', onclick: () => { f.hoi_dap.push({ hoi: '', dap: '' }); doi(); } }, '+ Thêm hỏi đáp'));
    const khoi6 = h('fieldset', { class: 'khoi' }, h('legend', {}, 'Thông tin cho Mai'),
      o('Điểm nổi bật (mỗi dòng một ý, 3–5 ý — nguồn chính cho lời dẫn live)', oVung(f.diem_noi_bat, (v) => { f.diem_noi_bat = v; }, { k: 'diem_noi_bat', rows: 4 }), 'diem_noi_bat'),
      o('Mô tả', oVung(f.mo_ta, (v) => { f.mo_ta = v; }, { k: 'mo_ta', rows: 4 }), 'mo_ta'),
      o('Tên gọi khác (khách hay gọi, cách nhau dấu phẩy)', oChu(f.ten_goi_khac, (v) => { f.ten_goi_khac = v; }, { k: 'ten_goi_khac', placeholder: 'VD: áo babydoll, sơ mi đũi' }), 'ten_goi_khac'),
      h('div', { class: 'field' }, h('span', {}, 'Phối cùng (AI gợi ý mua kèm)'), khac.length ? phoi : h('p', { class: 'hint' }, 'Chưa có sản phẩm khác.')),
      o('Ghi chú nội bộ (AI không đọc)', oVung(f.ghi_chu_noi_bo, (v) => { f.ghi_chu_noi_bo = v; }, { rows: 2, placeholder: 'VD: nhập từ xưởng A, lô 3' })));

    const khoiHd = h('fieldset', { class: 'khoi' }, h('legend', {}, 'Hỏi đáp riêng của mẫu này'),
      h('p', { class: 'hint' }, 'Câu khách hay hỏi về riêng mẫu này và câu trả lời đúng. Mai chỉ trả lời theo những gì bạn ghi ở đây và ở các tab khác.'), hoiDap);

    // 5 tab; tất cả vẫn là MỘT biểu mẫu, một nút Lưu. Chấm vàng ở tab = còn thiếu thông tin (từ thanh "AI đã đủ thông tin").
    const TAB_SP = [['co-ban', 'Cơ bản'], ['mau-co', 'Màu và cỡ'], ['anh', 'Ảnh'], ['thong-tin', 'Thông tin cho Mai'], ['hoi-dap', 'Hỏi đáp']];
    const nhomTab = { 'co-ban': [khoi1, khoi2], 'mau-co': [khoi5, khoi4], anh: [khoiAnh], 'thong-tin': [khoi3, khoi6], 'hoi-dap': [khoiHd] };
    const thieuAi = (st.chiTiet?.do_day_du?.thieu || []);
    const thieuTab = {
      'co-ban': !String(f.so).trim() || !f.ten.trim() || !String(f.gia).trim(),
      'mau-co': !g1.length || (dm.bo === 'quan_ao' && !f.bang_size_id),
      anh: f.anh.length === 0,
      'thong-tin': thieuAi.some((x) => !/bảng size/.test(x)) || f.ai_doan.length > 0,
      'hoi-dap': false,
    };
    const thanhTab = h('div', { class: 'chon', role: 'tablist', 'aria-label': 'Phần của sản phẩm' }, TAB_SP.map(([k, ten]) => h('button', {
      type: 'button', role: 'tab', 'aria-pressed': String(st.tab === k), onclick: () => { st.tab = k; doi(); },
    }, ten, thieuTab[k] && h('span', { class: 'tab-dau', title: 'Còn thiếu thông tin' }))));
    const nutLuu = h('button', { class: 'btn primary', type: 'submit' }, moi ? 'Tạo sản phẩm' : 'Lưu');
    const form = h('form', { class: 'body' }, thanhTab, ...TAB_SP.map(([k]) => h('div', { class: 'tab-nd', hidden: st.tab !== k }, nhomTab[k])), loi,
      h('div', { class: 'nutbam dinh-duoi' }, nutLuu,
        f.ai_doan.length > 0 && h('button', { class: 'btn', type: 'button', onclick: () => { f.ai_doan = []; doi(); } }, `✓ Xác nhận hết ${f.ai_doan.length} ô AI đoán`),
        h('button', { class: 'btn', type: 'button', onclick: () => chon(st.chon, moi ? null : undefined) }, 'Hủy thay đổi')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      loi.textContent = '';
      try {
        const kq = await dangLam(nutLuu, 'Đang lưu…', () => (moi ? api.post('/san-pham', thanGui()) : api.put(`/san-pham/${st.chon}`, thanGui())));
        st.gocChu = JSON.stringify(st.form);
        toast(`${moi ? 'Đã tạo' : 'Đã lưu'} ${kq.san_pham.ten_day_du} (bản ${kq.san_pham.phien_ban})`);
        for (const c of kq.canh_bao || []) toast(c, true);
        await taiDanhSach();
        await chon(kq.san_pham.id);
      } catch (loiGoi) { loi.textContent = loiGoi.message; }
    });
    form.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); form.requestSubmit(); } });

    const dd = st.chiTiet?.do_day_du;
    // replaceChildren gốc của trình duyệt in cả chữ "false": lọc bỏ phần tử điều kiện trước.
    phai.replaceChildren(...[
      h('header', {},
        h('h2', {}, moi ? 'Sản phẩm mới' : s.ten_day_du),
        !moi && chipSp(s.trang_thai),
        !moi && h('p', {}, `Bản ${s.phien_ban} · tạo ${gioPhut(s.tao_luc, true)} · sửa ${gioPhut(s.sua_luc, true)}`),
        !moi && h('span', { class: 'nutbam' },
          h('button', { class: 'btn small', type: 'button', onclick: () => nhanBan() }, 'Nhân bản'),
          h('button', { class: 'btn small', type: 'button', onclick: (ev) => xemThe(ev.target) }, 'Thẻ AI đọc'))),
      dd && h('div', { class: `day-du ${dd.du ? 'du' : ''}` }, dd.du ? '✓ AI đã đủ thông tin để tư vấn.' : `AI chưa đủ thông tin để tư vấn — còn thiếu: ${dd.thieu.join(', ')}.`),
      f.ai_doan.length > 0 && h('div', { class: 'day-du' }, `Có ${f.ai_doan.length} ô AI đoán (tô vàng): AI chưa được nói những ô này như sự thật cho tới khi bạn xác nhận.`),
      form,
      h('div', { class: 'the-ai', hidden: true }),
      !moi && veXemThu(),
      !moi && veLichSu()].filter(Boolean));
  }

  async function nhanBan() {
    try {
      const kq = await api.post(`/san-pham/${st.chon}/nhan-ban`);
      toast(`Đã nhân bản thành ${kq.san_pham.ten_day_du} (Nháp)`);
      st.gocChu = JSON.stringify(st.form);
      await taiDanhSach();
      await chon(kq.san_pham.id);
    } catch (e) { toast(e.message, true); }
  }

  async function xemThe(nut) {
    const hop = phai.querySelector('.the-ai');
    if (!hop.hidden) { hop.hidden = true; return; }
    const kq = await dangLam(nut, 'Đang lấy…', () => api.get(`/san-pham/${st.chon}/the-ai`));
    hop.replaceChildren(h('h2', {}, 'Thẻ sản phẩm AI đọc (không có giá vốn, ghi chú nội bộ)'), h('pre', {}, kq.the));
    hop.hidden = false;
  }

  // "Xem thử AI hiểu gì" (F-23): AI đọc thẻ đã lưu một lần; kết quả chỉ hiện ở đây, không lưu vào sản phẩm.
  function veXemThu() {
    const ketQua = h('div', { class: 'xem-thu' });
    const loi = h('p', { class: 'loi', role: 'alert' });
    const nut = h('button', { class: 'btn', type: 'button' }, '🔍 Xem thử AI hiểu gì');
    const id = st.chon;
    nut.addEventListener('click', async () => {
      loi.textContent = '';
      ketQua.replaceChildren();
      try {
        const kq = await dangLam(nut, 'AI đang đọc… (có thể mất tới 1 phút)', () => api.post(`/san-pham/${id}/soat`));
        if (st.chon !== id) return;
        const nhom = (ten, ds, rong) => h('div', { class: 'xem-thu-nhom' }, h('h3', {}, `${ten} (${ds.length})`),
          ds.length ? h('ul', {}, ds.map((x) => h('li', {}, h('p', {}, x.y), ...x.trich_dan.map((d) => h('blockquote', {}, d))))) : h('p', { class: 'hint' }, rong));
        ketQua.replaceChildren(
          h('p', { class: 'hint' }, `AI đọc bản ${kq.san_pham.phien_ban} (${kq.model}). Kết quả chỉ để xem, không lưu.`),
          nhom('Mâu thuẫn', kq.ket_qua.mau_thuan, 'Không thấy chỗ nào mâu thuẫn.'),
          nhom('Mơ hồ hoặc còn thiếu', kq.ket_qua.mo_ho, 'Không thấy chỗ nào mơ hồ.'),
          nhom('AI hiểu được', kq.ket_qua.tom_tat, 'AI chưa hiểu được gì.'));
      } catch (e) { loi.textContent = e.message; }
    });
    return h('div', { class: 'body' }, h('h2', {}, 'Xem thử AI hiểu gì'),
      h('p', { class: 'hint' }, 'AI đọc thẻ sản phẩm như khách hàng: tóm tắt, chỉ ra chỗ mơ hồ, còn thiếu, mâu thuẫn. AI đọc bản đã lưu — sửa xong hãy lưu trước.'),
      h('div', { class: 'nutbam' }, nut), loi, ketQua);
  }

  function veLichSu() {
    const hop = h('div', { class: 'lichsu' }, h('p', { class: 'hint' }, 'Đang tải…'));
    api.get(`/san-pham/${st.chon}/ban-sua`).then(({ ban_sua: ds }) => {
      hop.replaceChildren(...ds.map((b) => h('details', {},
        h('summary', {}, h('b', {}, `Bản ${b.phien_ban}`), h('span', {}, gioPhut(b.luc, true)), chipSp(b.trang_thai), h('span', {}, `${b.ten} · ${tien(b.gia)}`)),
        h('pre', {}, [b.mo_ta && `Mô tả: ${b.mo_ta}`, b.diem_noi_bat?.length && `Điểm nổi bật: ${b.diem_noi_bat.join('; ')}`,
          `Phân loại: ${(b.phan_loai || []).filter((p) => !p.bo).map((p) => `${p.gt1}${p.gt2 ? `/${p.gt2}` : ''}${p.gia != null ? ` ${tien(p.gia)}` : ''}`).join(', ')}`].filter(Boolean).join('\n')))));
    }).catch((e) => hop.replaceChildren(h('p', { class: 'loi' }, e.message)));
    return h('div', { class: 'body' }, h('h2', {}, 'Lịch sử bản sửa'), hop);
  }

  /* ---------------- Tạo từ ảnh (#75) ---------------- */

  function moTaoTuAnh() {
    if (coThayDoi() && !confirm('Sản phẩm đang sửa dở chưa lưu. Bỏ phần đang sửa?')) return;
    st.form = null;
    st.chon = null;
    veDanhSach();
    const oFile = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const tinh = h('p', { class: 'hint' }, 'Chọn hoặc kéo 1–9 ảnh của MỘT sản phẩm (nên có ảnh từng màu). Ảnh được thu nhỏ ngay trên máy trước khi gửi.');
    const loi = h('p', { class: 'loi', role: 'alert' });
    const vung = h('div', { class: 'vung-tha', tabindex: 0 }, h('b', {}, '📷 Kéo ảnh vào đây'), h('span', {}, 'hoặc bấm để chọn ảnh'), tinh, oFile);
    vung.addEventListener('click', () => oFile.click());
    vung.addEventListener('dragover', (e) => { e.preventDefault(); vung.classList.add('tren'); });
    vung.addEventListener('dragleave', () => vung.classList.remove('tren'));
    vung.addEventListener('drop', (e) => { e.preventDefault(); vung.classList.remove('tren'); lam([...e.dataTransfer.files]); });
    oFile.addEventListener('change', () => lam([...oFile.files]));
    async function lam(files) {
      const anh = files.filter((f) => f.type.startsWith('image/')).slice(0, 9);
      if (!anh.length) { loi.textContent = 'Chưa có ảnh nào.'; return; }
      loi.textContent = '';
      try {
        tinh.textContent = `Đang tải ${anh.length} ảnh…`;
        const tep = [];
        for (const f of anh) tep.push(await taiAnh(f));
        tinh.textContent = 'AI đang nhìn ảnh và điền thông tin… (khoảng 10–30 giây)';
        const { nhap, chi_phi_usd: usd, model } = await api.post('/san-pham/tu-anh', { anh: tep });
        const f = formTrong();
        Object.assign(f, {
          ten: nhap.ten, danh_muc: nhap.danh_muc, thuong_hieu: nhap.thuong_hieu, thong_so: nhap.thong_so,
          nhom: { t1: nhap.nhom.t1, t2: nhap.nhom.t2 || '' }, anh: nhap.anh.map((a) => ({ ...a, tam: true })),
          mo_ta: nhap.mo_ta, diem_noi_bat: nhap.diem_noi_bat.join('\n'), ten_goi_khac: nhap.ten_goi_khac.join(', '), ai_doan: nhap.ai_doan,
          gia_tri_1: nhap.gia_tri_1.join(', '), gia_tri_2: nhap.gia_tri_2.length ? nhap.gia_tri_2.join(', ') : f.gia_tri_2,
        });
        toast(`AI đã điền xong (${model}, khoảng ${Number(usd || 0).toFixed(4)} USD). Gõ giá, tồn, kiểm các ô tô vàng rồi lưu.`);
        if (nhap.can_xac_nhan.length) toast(`Cần bạn xác nhận: ${nhap.can_xac_nhan.join(', ')}`, true);
        await chon('moi', f);
      } catch (e) { loi.textContent = e.message; tinh.textContent = 'Thử lại, hoặc bấm "+ Tạo tay".'; }
    }
    phai.replaceChildren(h('header', {}, h('h2', {}, 'Tạo sản phẩm từ ảnh')),
      h('div', { class: 'body' }, vung, loi,
        h('p', { class: 'hint' }, 'AI điền trước: tên gợi ý, danh mục, thông số nhìn thấy, các màu, mô tả, điểm nổi bật. AI không đoán giá, tồn, xuất xứ; thương hiệu và chất liệu chỉ khi đọc được trên nhãn. Ô AI điền tô vàng "AI đoán" tới khi bạn xác nhận.')));
  }

  await taiDanhSach();
  // Mở thẳng một sản phẩm (#/san-pham?id=…, từ Tồn kho, Đơn hàng).
  const moSan = st.chon;
  st.chon = null;
  if (moSan && st.ds.some((x) => x.id === moSan)) await chon(moSan);
  else veChiTiet();
}

/** Bảng size dạng bảng chỉ xem. */
export function veBang(b) {
  return h('table', { class: 'bang-size' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Cỡ'), b.cot.map((k) => h('th', {}, `${k.replace(/_/g, ' ')}`)))),
    h('tbody', {}, b.hang.map((r) => h('tr', {}, h('th', {}, r.co), b.cot.map((k) => h('td', {}, r[k] || '—'))))));
}

/* ---------------- thẻ Bảng size ---------------- */

async function veBangSize(khung) {
  const { bang_size: ds, cot: COT } = await api.get('/bang-size');
  const trai = h('div', { class: 'ds' });
  const phai = h('section', { class: 'panel' });
  khung.append(h('div', { class: 'hai-cot' }, h('section', { class: 'panel' },
    h('header', {}, h('b', {}, 'Bảng size dùng chung'), h('span', { class: 'grow' }), h('button', { class: 'btn small primary', type: 'button', onclick: () => sua(null) }, '+ Tạo bảng')), trai), phai));
  trai.replaceChildren(...(ds.length ? ds.map((b) => h('button', { type: 'button', onclick: () => sua(b) },
    h('span', { class: 'dong1' }, h('b', {}, b.ten)), h('span', { class: 'dong2' }, `${b.hang.map((r) => r.co).join(', ')} · ${b.so_san_pham} sản phẩm dùng`),
    h('span', { class: 'dong3' }, `Bản ${b.phien_ban} · sửa ${gioPhut(b.sua_luc)}`))) : [h('div', { class: 'empty' }, 'Chưa có bảng size nào. Tạo một bảng dùng chung (ví dụ "Áo nữ form chuẩn") rồi chọn cho nhiều sản phẩm.')]));
  phai.replaceChildren(h('div', { class: 'empty' }, 'Chọn hoặc tạo một bảng size. Sửa một lần, mọi sản phẩm dùng bảng đó thấy số mới.'));

  function sua(b) {
    const f = b ? { ten: b.ten, cot: [...b.cot], hang: b.hang.map((r) => ({ ...r })) }
      : { ten: '', cot: ['chieu_cao', 'can_nang'], hang: ['S', 'M', 'L', 'XL'].map((co) => ({ co })) };
    const loi = h('p', { class: 'loi', role: 'alert' });
    const ve = () => {
      const oTen = h('input', { type: 'text', value: f.ten, maxlength: 80, placeholder: 'VD: Áo nữ form chuẩn' });
      oTen.addEventListener('input', () => { f.ten = oTen.value; });
      const chonCot = h('div', { class: 'the-chon' }, Object.entries(COT).map(([k, c]) => h('button', {
        type: 'button', 'aria-pressed': String(f.cot.includes(k)), onclick: () => { f.cot = f.cot.includes(k) ? f.cot.filter((x) => x !== k) : [...f.cot, k]; ve(); },
      }, `${c.ten} (${c.don_vi})`)));
      const bang = h('table', { class: 'bang-size sua' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Cỡ'), f.cot.map((k) => h('th', {}, `${COT[k].ten} (${COT[k].don_vi})`)), h('th', {}))),
        h('tbody', {}, f.hang.map((r, i) => h('tr', {},
          h('td', {}, (() => { const e = h('input', { type: 'text', value: r.co, class: 'nho' }); e.addEventListener('input', () => { r.co = e.value; }); return e; })()),
          f.cot.map((k) => h('td', {}, (() => { const e = h('input', { type: 'text', value: r[k] || '', class: 'nho', placeholder: 'VD: 155-162' }); e.addEventListener('input', () => { r[k] = e.value; }); return e; })())),
          h('td', {}, h('button', { type: 'button', class: 'btn small danger', onclick: () => { f.hang.splice(i, 1); ve(); } }, 'Bỏ'))))));
      const nutLuu = h('button', { class: 'btn primary', type: 'button' }, b ? 'Lưu' : 'Tạo bảng');
      nutLuu.addEventListener('click', async () => {
        loi.textContent = '';
        try {
          await dangLam(nutLuu, 'Đang lưu…', () => (b ? api.put(`/bang-size/${b.id}`, f) : api.post('/bang-size', f)));
          toast('Đã lưu bảng size');
          location.reload();
        } catch (e) { loi.textContent = e.message; }
      });
      phai.replaceChildren(h('header', {}, h('h2', {}, b ? b.ten : 'Bảng size mới')), h('div', { class: 'body' },
        h('label', { class: 'field' }, h('span', {}, 'Tên bảng'), oTen),
        h('div', { class: 'field' }, h('span', {}, 'Các cột'), chonCot),
        bang, h('button', { type: 'button', class: 'btn small', onclick: () => { f.hang.push({ co: '' }); ve(); } }, '+ Thêm cỡ'),
        h('p', { class: 'hint' }, 'Mỗi ô một số hoặc một khoảng (155-162). AI tư vấn size chỉ dựa vào bảng này.'),
        loi, h('div', { class: 'nutbam' }, nutLuu)));
    };
    ve();
  }
}
