'use strict';

/**
 * Sản phẩm (SPEC.md F-51, mục 7; #60, #61, #75).
 *
 * Một sản phẩm là một mẫu, ô theo chuẩn chung của catalog Meta, Shopee, TikTok Shop, chia 6 nhóm:
 *   1. cơ bản (số, tên, danh mục, trạng thái, thương hiệu, ảnh) · 2. giá (bán, gốc, vốn) · 3. thông số theo danh mục
 *   (cấu hình ở thong-so.json / danh-muc.json) · 4. bảng size · 5. phân loại màu × cỡ và kho · 6. cho AI bán hàng + nội bộ.
 * Bắt buộc chỉ: số, tên, danh mục, giá bán, trạng thái, bảng phân loại; Đang bán cần thêm ít nhất 1 ảnh.
 *
 * Mỗi lần lưu có thay đổi tạo một bản sửa (`san_pham_ban_sua`, chụp mọi ô trừ tồn kho): AI trích theo đúng bản đã dùng.
 * Không có hàm xóa: sản phẩm không bán nữa thì Ngừng bán (đơn cũ vẫn trỏ tới).
 *
 * **Thẻ sản phẩm cho AI** (`theChoAi`) là cửa duy nhất đưa dữ liệu sản phẩm cho mọi AI (mục 5): giá vốn và ghi chú nội bộ
 * không bao giờ vào thẻ; ô AI đoán mà người chưa xác nhận ghi "(chưa xác nhận)" và không được trích làm sự thật (K2).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { csdl, giaoDich, thuMucDuLieu } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, chuan, boDau, kiemChu, docTien, hienTien } = require('./chung');
const bangSize = require('./bang-size');
const kho = require('./kho');
const { thong_so: THONG_SO, bo: BO } = require('../cau-hinh/thong-so.json');
const { danh_muc: DANH_MUC } = require('../cau-hinh/danh-muc.json');

const TRANG_THAI = ['nhap', 'dang_ban', 'ngung_ban'];
const TEN_TRANG_THAI = { nhap: 'Nháp', dang_ban: 'Đang bán', ngung_ban: 'Ngừng bán' };
const TOI_DA_ANH = 9;
const TOI_DA_O = 100;
const MAC_DINH_NHOM = { t1: 'Màu', t2: 'Cỡ' };
// Ô AI được đoán từ ảnh và phải người xác nhận trước khi AI nói như sự thật (#75, mục 9). Tên, danh mục là ô bắt buộc
// người luôn nhìn thấy khi lưu nên không cần nhãn.
const O_AI_DOAN = new Set(['mo_ta', 'diem_noi_bat', 'ten_goi_khac', ...Object.keys(THONG_SO).map((k) => `thong_so.${k}`)]);
const TEP_ANH = /^[a-z0-9]{12,40}\.jpg$/;

/* ---------------- cấu hình danh mục, thông số ---------------- */

function danhMuc(khoa) {
  return DANH_MUC.find((d) => d.khoa === khoa) || null;
}

/** Danh mục + bộ thông số + cột bảng size — cho màn hình dựng ô (API `GET /cau-hinh/danh-muc`). */
function cauHinh() {
  return {
    danh_muc: DANH_MUC.map((d) => ({ ...d, thong_so: BO[d.bo] || [] })),
    thong_so: THONG_SO,
    cot_bang_size: bangSize.COT,
  };
}

function boThongSo(khoaDanhMuc) {
  return BO[danhMuc(khoaDanhMuc)?.bo] || [];
}

/**
 * Kiểm ô thông số theo bộ của danh mục (mục 7 "Quy tắc hợp lệ"): khóa lạ bị bỏ và báo lại (`THONG_SO_LA`),
 * lựa chọn lạ bị bỏ. Đổi danh mục thì ô trùng tên được giữ (F-51).
 * @returns {{thongSo:object, boQua:string[]}}
 */
function kiemThongSo(khoaDanhMuc, vao = {}) {
  const duoc = new Set(boThongSo(khoaDanhMuc));
  const thongSo = {};
  const boQua = [];
  for (const [k, v] of Object.entries(vao || {})) {
    const goc = k.endsWith('_ghi') ? k.slice(0, -4) : k;
    const ts = THONG_SO[goc];
    if (!ts || !duoc.has(goc) || (k !== goc && !ts.co_ghi)) {
      if (v !== '' && v != null && !(Array.isArray(v) && !v.length)) boQua.push(k);
      continue;
    }
    if (k !== goc || ts.kieu === 'chu') {
      const s = kiemChu(typeof v === 'string' ? v : '', { ten: ts.ten, toiDa: 300, motDong: true });
      if (s) thongSo[k] = s;
    } else if (ts.kieu === 'mot') {
      if (typeof v === 'string' && Object.hasOwn(ts.lua_chon, v)) thongSo[k] = v;
    } else if (ts.kieu === 'nhieu') {
      const ds = [...new Set((Array.isArray(v) ? v : []).filter((x) => Object.hasOwn(ts.lua_chon, x)))];
      if (ds.length) thongSo[k] = ds;
    }
  }
  return { thongSo, boQua };
}

/** Giá trị thông số thành chữ: "Linen (lanh), Cotton — Linen 70%, cotton 30%". */
function chuThongSo(k, thongSo) {
  const ts = THONG_SO[k];
  const v = thongSo[k];
  const phan = [];
  if (ts.kieu === 'chu') phan.push(v || '');
  else if (ts.kieu === 'mot') phan.push(v ? ts.lua_chon[v] : '');
  else phan.push((v || []).map((x) => ts.lua_chon[x]).join(', '));
  const ghi = ts.co_ghi ? thongSo[`${k}_ghi`] : '';
  return [phan.join(''), ghi].filter(Boolean).join(' — ');
}

/* ---------------- chữ, số, ảnh ---------------- */

function mangChu(vao, { ten, toiDaMuc, toiDaKyTu }) {
  if (vao == null) return [];
  const ds = Array.isArray(vao) ? vao : String(vao).split('\n');
  const sach = ds.map((x) => kiemChu(typeof x === 'string' ? x : '', { ten, toiDa: toiDaKyTu, motDong: true })).filter(Boolean);
  if (sach.length > toiDaMuc) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} tối đa ${toiDaMuc} ý.`);
  return [...new Set(sach)];
}

function kiemHoiDap(vao) {
  if (vao == null) return [];
  if (!Array.isArray(vao)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Hỏi đáp phải là danh sách.');
  const ds = vao.map((x, i) => ({
    hoi: kiemChu(x?.hoi ?? '', { ten: `Câu hỏi ${i + 1}`, toiDa: 300, motDong: true }),
    dap: kiemChu(x?.dap ?? '', { ten: `Câu trả lời ${i + 1}`, toiDa: 1000 }),
  })).filter((x) => x.hoi || x.dap);
  for (const [i, x] of ds.entries()) {
    if (!x.hoi || !x.dap) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Hỏi đáp dòng ${i + 1} cần đủ câu hỏi và câu trả lời.`);
  }
  if (ds.length > 30) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Hỏi đáp tối đa 30 cặp.');
  return ds;
}

function soNguyenDuong(v, ten) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 1e7) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} phải là số nguyên dương.`);
  return n;
}

function thuMucAnh(sanPhamId) {
  return path.join(thuMucDuLieu(), 'anh', sanPhamId);
}

const thuMucAnhTam = () => path.join(thuMucDuLieu(), 'anh', 'tam');

/** Ảnh JPEG hoặc PNG, tối đa 3 MB (ANH_KHONG_HOP_LE). Trình duyệt đã thu nhỏ về JPEG trước khi gửi (mục 6). */
function kiemAnh(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', 'Chưa có ảnh.');
  if (buf.length > 3 * 1024 * 1024) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', 'Ảnh lớn quá 3 MB.');
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!jpeg && !png) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', 'Tệp này không phải ảnh JPEG hay PNG.');
}

/** Tên tệp do MOZA đặt, không dùng tên người dùng gửi (mục 9: tránh chèn đường dẫn). */
const tenTepMoi = () => `${crypto.randomBytes(8).toString('hex')}.jpg`;

/** Lưu một ảnh vào khu tạm (trước khi có sản phẩm, ví dụ "Tạo từ ảnh"). Trả tên tệp. */
function luuAnhTam(buf) {
  kiemAnh(buf);
  fs.mkdirSync(thuMucAnhTam(), { recursive: true });
  const tep = tenTepMoi();
  fs.writeFileSync(path.join(thuMucAnhTam(), tep), buf);
  return tep;
}

/** Đường dẫn tệp ảnh của một sản phẩm (hoặc khu tạm khi sanPhamId = 'tam'); null nếu tên lạ hay không có tệp. */
function duongAnh(sanPhamId, tep) {
  if (!TEP_ANH.test(String(tep)) || !/^(sp_[a-z0-9]{12}|tam)$/.test(String(sanPhamId))) return null;
  const f = path.join(sanPhamId === 'tam' ? thuMucAnhTam() : thuMucAnh(sanPhamId), tep);
  return fs.existsSync(f) ? f : null;
}

/**
 * Kiểm danh sách ảnh [{tep, mau}]: tệp phải có trong thư mục của sản phẩm hoặc khu tạm (khu tạm thì chép sang thư mục
 * sản phẩm — chép chứ không chuyển, để lưu lỗi vì ô khác rồi bấm lưu lại vẫn còn ảnh). Ảnh bỏ khỏi danh sách không xóa
 * tệp: bản sửa cũ vẫn trỏ tới.
 */
function kiemDanhSachAnh(sanPhamId, vao, giaTri1) {
  const ds = Array.isArray(vao) ? vao : [];
  if (ds.length > TOI_DA_ANH) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', `Tối đa ${TOI_DA_ANH} ảnh.`);
  const daCo = new Set();
  return ds.map((a) => {
    const tep = String(a?.tep ?? '');
    if (!TEP_ANH.test(tep) || daCo.has(tep)) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', 'Ảnh không hợp lệ. Tải ảnh lại.');
    daCo.add(tep);
    const trong = path.join(thuMucAnh(sanPhamId), tep);
    if (!fs.existsSync(trong)) {
      const tam = path.join(thuMucAnhTam(), tep);
      if (!fs.existsSync(tam)) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', 'Không tìm thấy ảnh đã tải. Tải ảnh lại.');
      fs.mkdirSync(thuMucAnh(sanPhamId), { recursive: true });
      fs.copyFileSync(tam, trong);
    }
    const mau = a?.mau ? kiemChu(a.mau, { ten: 'Màu của ảnh', toiDa: 40, motDong: true }) : null;
    return { tep, mau: mau && giaTri1.some((g) => boDau(g) === boDau(mau)) ? giaTri1.find((g) => boDau(g) === boDau(mau)) : null };
  });
}

/* ---------------- video (#90: chiếu lên màn hình sản phẩm) ---------------- */

const TOI_DA_VIDEO = 3;
const TEP_VIDEO = /^[a-z0-9]{12,40}.(mp4|webm)$/;
const thuMucVideo = (sanPhamId) => path.join(thuMucDuLieu(), 'video', sanPhamId);

/** Video MP4 hoặc WebM (quay bằng điện thoại), tối đa 80 MB. Trả tên tệp trong khu tạm. */
function luuVideoTam(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) throw new LoiNghiepVu('VIDEO_KHONG_HOP_LE', 'Chưa có video.');
  if (buf.length > 80 * 1024 * 1024) throw new LoiNghiepVu('VIDEO_KHONG_HOP_LE', 'Video lớn quá 80 MB — cắt ngắn (15–60 giây là đẹp).');
  const mp4 = buf.subarray(4, 8).toString('latin1') === 'ftyp';
  const webm = buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!mp4 && !webm) throw new LoiNghiepVu('VIDEO_KHONG_HOP_LE', 'Tệp này không phải video MP4 hay WebM.');
  const tep = `${crypto.randomBytes(8).toString('hex')}.${mp4 ? 'mp4' : 'webm'}`;
  fs.mkdirSync(thuMucVideo('tam'), { recursive: true });
  fs.writeFileSync(path.join(thuMucVideo('tam'), tep), buf);
  return tep;
}

/** Đường dẫn tệp video của một sản phẩm (hoặc khu tạm), null nếu tên lạ hay không có tệp. */
function duongVideo(sanPhamId, tep) {
  if (!TEP_VIDEO.test(String(tep)) || !/^(sp_[a-z0-9]{12}|tam)$/.test(String(sanPhamId))) return null;
  const f = path.join(thuMucVideo(sanPhamId), tep);
  return fs.existsSync(f) ? f : null;
}

/** Như ảnh: [{tep, mau}], tệp khu tạm được chép sang thư mục sản phẩm; bỏ khỏi danh sách không xóa tệp. */
function kiemDanhSachVideo(sanPhamId, vao, giaTri1) {
  const ds = Array.isArray(vao) ? vao : [];
  if (ds.length > TOI_DA_VIDEO) throw new LoiNghiepVu('VIDEO_KHONG_HOP_LE', `Tối đa ${TOI_DA_VIDEO} video.`);
  const daCo = new Set();
  return ds.map((v) => {
    const tep = String(v?.tep ?? '');
    if (!TEP_VIDEO.test(tep) || daCo.has(tep)) throw new LoiNghiepVu('VIDEO_KHONG_HOP_LE', 'Video không hợp lệ. Tải lại.');
    daCo.add(tep);
    const trong = path.join(thuMucVideo(sanPhamId), tep);
    if (!fs.existsSync(trong)) {
      const tam = path.join(thuMucVideo('tam'), tep);
      if (!fs.existsSync(tam)) throw new LoiNghiepVu('VIDEO_KHONG_HOP_LE', 'Không tìm thấy video đã tải. Tải lại.');
      fs.mkdirSync(thuMucVideo(sanPhamId), { recursive: true });
      fs.copyFileSync(tam, trong);
    }
    const mau = v?.mau ? kiemChu(v.mau, { ten: 'Màu của video', toiDa: 40, motDong: true }) : null;
    const x = { tep, mau: mau && giaTri1.some((g) => boDau(g) === boDau(mau)) ? giaTri1.find((g) => boDau(g) === boDau(mau)) : null };
    // F-81 (#109): video AI dựng (không quay thật) mang cờ dung_thu — buổi live thật không chiếu.
    if (v?.dung_thu) x.dung_thu = true;
    return x;
  });
}

/* ---------------- phân loại (nhóm 5) ---------------- */

const khoaGt = (s) => boDau(s ?? '').replace(/\s+/g, ' ').trim();
const nhanPl = (pl) => (pl.gt2 ? `${pl.gt1}/${pl.gt2}` : pl.gt1);

/** Mã phân loại tự sinh: `<số>-<MÀU>-<CỠ>` bỏ dấu, viết hoa, bỏ khoảng trắng (ví dụ 12-DEN-M). */
function skuTuSinh(so, gt1, gt2) {
  const g = (s) => boDau(s).toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return [so, g(gt1), gt2 ? g(gt2) : null].filter(Boolean).join('-');
}

function kiemNhom(vao) {
  const n = vao || MAC_DINH_NHOM;
  const t1 = kiemChu(n.t1 ?? 'Màu', { ten: 'Tên nhóm phân loại 1', batBuoc: true, toiDa: 20, motDong: true });
  const t2 = n.t2 ? kiemChu(n.t2, { ten: 'Tên nhóm phân loại 2', toiDa: 20, motDong: true }) || null : null;
  return { t1, t2 };
}

/**
 * Kiểm các ô phân loại gửi lên: [{gt1, gt2, sku?, gia?, ton?, bo?, can_nang_g?}]. Nhóm 2 để trống thì gt2 = null.
 * `ton` chỉ dùng cho ô mới (tồn ban đầu); tồn ô cũ đổi ở màn hình Tồn kho (F-52).
 */
function kiemPhanLoai(vao, nhom, so) {
  if (!Array.isArray(vao) || !vao.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Sản phẩm cần bảng phân loại (ví dụ Màu × Cỡ) có ít nhất một ô.');
  if (vao.length > TOI_DA_O) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Tối đa ${TOI_DA_O} ô phân loại.`);
  const daCo = new Set();
  const sku = new Set();
  const ds = vao.map((x, i) => {
    const gt1 = kiemChu(x?.gt1, { ten: `${nhom.t1} (ô ${i + 1})`, batBuoc: true, toiDa: 40, motDong: true });
    const gt2 = nhom.t2 ? kiemChu(x?.gt2, { ten: `${nhom.t2} (ô ${i + 1})`, batBuoc: true, toiDa: 20, motDong: true }) : null;
    const khoa = `${khoaGt(gt1)}|${khoaGt(gt2)}`;
    if (daCo.has(khoa)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Phân loại ${gt2 ? `${gt1}/${gt2}` : gt1} bị trùng.`);
    daCo.add(khoa);
    const ma = kiemChu(x?.sku || skuTuSinh(so, gt1, gt2), { ten: 'Mã phân loại', batBuoc: true, toiDa: 60, motDong: true }).toUpperCase();
    if (sku.has(ma)) throw new LoiNghiepVu('SKU_TRUNG', `Mã phân loại ${ma} bị trùng. Đổi mã khác.`, 409);
    sku.add(ma);
    const bo = x?.bo === true || x?.bo === 1;
    const ton = x?.ton == null || x.ton === '' ? 0 : Number(x.ton);
    if (!Number.isInteger(ton) || ton < 0 || ton > 1e6) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Tồn của ${gt2 ? `${gt1}/${gt2}` : gt1} phải là số nguyên không âm.`);
    return {
      gt1, gt2, khoa, sku: ma, bo, ton,
      gia: docTien(x?.gia, { ten: `Giá riêng ${gt2 ? `${gt1}/${gt2}` : gt1}` }),
      can_nang_g: soNguyenDuong(x?.can_nang_g, 'Cân nặng gói hàng'),
      thu_tu: i,
    };
  });
  if (!ds.some((x) => !x.bo)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cần ít nhất một ô phân loại được bán.');
  return ds;
}

function kiemSkuKhongTrung(db, ds, sanPhamId) {
  for (const x of ds) {
    const r = db.prepare('SELECT san_pham_id FROM phan_loai WHERE sku = ? COLLATE NOCASE').get(x.sku);
    if (r && r.san_pham_id !== sanPhamId) throw new LoiNghiepVu('SKU_TRUNG', `Mã phân loại ${x.sku} đã có ở sản phẩm khác. Đổi mã khác.`, 409);
  }
}

/** Ghi các ô phân loại: ô cũ giữ nguyên tồn; ô mới ghi tồn ban đầu qua kho (có lịch sử); ô không còn gửi lên → bỏ. */
function ghiPhanLoai(db, sanPhamId, ds) {
  const cu = db.prepare('SELECT * FROM phan_loai WHERE san_pham_id = ?').all(sanPhamId);
  const theoKhoa = new Map(cu.map((p) => [`${khoaGt(p.gt1)}|${khoaGt(p.gt2)}`, p]));
  kiemSkuKhongTrung(db, ds, sanPhamId);
  // Đổi mã hai ô cho nhau trong cùng sản phẩm: xóa tạm mã cũ trước để không vấp UNIQUE.
  for (const x of ds) {
    const p = theoKhoa.get(x.khoa);
    if (p && p.sku.toUpperCase() !== x.sku) db.prepare('UPDATE phan_loai SET sku = ? WHERE id = ?').run(`~${p.id}`, p.id);
  }
  const giu = new Set();
  for (const x of ds) {
    const p = theoKhoa.get(x.khoa);
    if (p) {
      giu.add(p.id);
      db.prepare('UPDATE phan_loai SET gt1 = ?, gt2 = ?, sku = ?, gia = ?, can_nang_g = ?, bo = ?, thu_tu = ? WHERE id = ?')
        .run(x.gt1, x.gt2, x.sku, x.gia, x.can_nang_g, x.bo ? 1 : 0, x.thu_tu, p.id);
      continue;
    }
    const id = taoId('pl');
    db.prepare('INSERT INTO phan_loai (id, san_pham_id, gt1, gt2, sku, gia, can_nang_g, ton, bo, thu_tu) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(id, sanPhamId, x.gt1, x.gt2, x.sku, x.gia, x.can_nang_g, x.bo ? 1 : 0, x.thu_tu);
    if (x.ton > 0 && !x.bo) {
      kho.ghiThayDoi(db, db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(id), x.ton, { lyDo: 'nhap_hang', ghiChu: 'tồn ban đầu' });
    }
  }
  for (const p of cu) if (!giu.has(p.id)) db.prepare('UPDATE phan_loai SET bo = 1 WHERE id = ?').run(p.id);
}

/* ---------------- đọc, ghi sản phẩm ---------------- */

const COT_JSON = ['thong_so', 'nhom', 'anh', 'video', 'kich_thuoc_cm', 'diem_noi_bat', 'ten_goi_khac', 'phoi_cung', 'hoi_dap', 'ai_doan'];

function doc(r) {
  if (!r) return null;
  const sp = { ...r };
  for (const k of COT_JSON) sp[k] = sp[k] == null ? null : JSON.parse(sp[k]);
  return sp;
}

function phanLoaiCua(sanPhamId, db = csdl()) {
  return db.prepare('SELECT * FROM phan_loai WHERE san_pham_id = ? ORDER BY thu_tu, rowid').all(sanPhamId).map((p) => ({ ...p, bo: p.bo === 1 }));
}

/** Nội dung một bản sửa: mọi ô trừ tồn kho (F-51). Phân loại chụp mã, giá riêng, bỏ — để thẻ bản cũ vẫn dựng lại được. */
function chup(sp, dsPl) {
  const { id, tao_luc: _t, sua_luc: _s, phien_ban: _p, ...o } = sp;
  return { ...o, phan_loai: dsPl.map((p) => ({ gt1: p.gt1, gt2: p.gt2, sku: p.sku, gia: p.gia, bo: !!p.bo })) };
}

function ghiBanSua(db, sp) {
  db.prepare('INSERT INTO san_pham_ban_sua (san_pham_id, phien_ban, noi_dung, luc) VALUES (?, ?, ?, ?)')
    .run(sp.id, sp.phien_ban, JSON.stringify(chup(sp, phanLoaiCua(sp.id, db))), sp.sua_luc);
}

function soKeTiep(db = csdl()) {
  return db.prepare('SELECT COALESCE(MAX(so), 0) + 1 AS n FROM san_pham').get().n;
}

function kiemTrangThai(t) {
  if (!TRANG_THAI.includes(t)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Trạng thái phải là Nháp, Đang bán hoặc Ngừng bán.');
  return t;
}

/**
 * Kiểm mọi ô (trừ ảnh, phân loại). `cu` = bản đang có khi sửa: ô không gửi lên giữ nguyên.
 * @returns {{o:object, canhBao:string[]}}
 */
function kiemO(db, duLieu, cu, id) {
  const lay = (k, macDinh) => (Object.hasOwn(duLieu, k) ? duLieu[k] : (cu ? cu[k] : macDinh));
  const so = Number(lay('so', null) ?? soKeTiep(db));
  if (!Number.isInteger(so) || so <= 0 || so > 99999) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Số sản phẩm phải là số nguyên dương.');
  const trung = db.prepare('SELECT id FROM san_pham WHERE so = ?').get(so);
  if (trung && trung.id !== id) throw new LoiNghiepVu('SP_TRUNG_SO', `Số ${so} đã có sản phẩm khác. Chọn số khác (gợi ý ${soKeTiep(db)}).`, 409);

  const khoaDm = String(lay('danh_muc', '') || '');
  if (!danhMuc(khoaDm)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn danh mục cho sản phẩm.');
  const { thongSo, boQua } = kiemThongSo(khoaDm, lay('thong_so', {}));
  const canhBao = boQua.length ? [`Bỏ ${boQua.length} ô thông số không thuộc danh mục ${danhMuc(khoaDm).ten} (THONG_SO_LA): ${boQua.join(', ')}.`] : [];

  const bangId = lay('bang_size_id', null) || null;
  if (bangId && !db.prepare('SELECT 1 FROM bang_size WHERE id = ?').get(bangId)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không tìm thấy bảng size đã chọn.');

  const phoiCung = [...new Set((lay('phoi_cung', []) || []).map(String))].filter((x) => x !== id);
  for (const x of phoiCung) if (!db.prepare('SELECT 1 FROM san_pham WHERE id = ?').get(x)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Món "Phối cùng" không còn trong danh sách sản phẩm.');
  if (phoiCung.length > 10) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Phối cùng tối đa 10 món.');

  const kt = lay('kich_thuoc_cm', null);
  const kichThuoc = Array.isArray(kt) && kt.some((x) => x !== '' && x != null)
    ? kt.slice(0, 3).map((x, i) => soNguyenDuong(x, ['Dài', 'Rộng', 'Cao'][i] + ' gói hàng')) : null;

  const aiDoan = [...new Set((lay('ai_doan', []) || []).filter((k) => O_AI_DOAN.has(k)))];

  const o = {
    so,
    ten: kiemChu(lay('ten', ''), { ten: 'Tên sản phẩm', batBuoc: true, toiDa: 120, motDong: true }),
    danh_muc: khoaDm,
    trang_thai: kiemTrangThai(lay('trang_thai', 'nhap')),
    thuong_hieu: kiemChu(lay('thuong_hieu', ''), { ten: 'Thương hiệu', toiDa: 80, motDong: true }),
    gia: docTien(lay('gia', null), { ten: 'Giá bán', batBuoc: true }),
    gia_goc: docTien(lay('gia_goc', null), { ten: 'Giá gốc' }),
    gia_von: docTien(lay('gia_von', null), { ten: 'Giá vốn' }),
    thong_so: thongSo,
    bang_size_id: bangId,
    nhom: kiemNhom(lay('nhom', MAC_DINH_NHOM)),
    can_nang_g: soNguyenDuong(lay('can_nang_g', null), 'Cân nặng gói hàng'),
    kich_thuoc_cm: kichThuoc,
    mo_ta: kiemChu(lay('mo_ta', ''), { ten: 'Mô tả', toiDa: 5000 }),
    diem_noi_bat: mangChu(lay('diem_noi_bat', []), { ten: 'Điểm nổi bật', toiDaMuc: 8, toiDaKyTu: 200 }),
    ten_goi_khac: mangChu(lay('ten_goi_khac', []), { ten: 'Tên gọi khác', toiDaMuc: 15, toiDaKyTu: 60 }),
    phoi_cung: phoiCung,
    hoi_dap: kiemHoiDap(lay('hoi_dap', [])),
    ghi_chu_noi_bo: kiemChu(lay('ghi_chu_noi_bo', ''), { ten: 'Ghi chú nội bộ', toiDa: 2000 }),
    ai_doan: aiDoan,
  };
  // F-79 (K11): mô tả, điểm nổi bật, xuất xứ, tên gọi khác có từ cấm → cảnh báo vàng, vẫn lưu (MOZA không biết shop có giấy tờ).
  const chuKiem = [o.mo_ta, ...(o.diem_noi_bat || []), ...(o.ten_goi_khac || []), o.thong_so?.xuat_xu, o.thong_so?.xuat_xu_ghi].filter(Boolean).join('. ');
  const cam = require('./tu-cam').timTuCam(chuKiem);
  if (cam.length) canhBao.push(`Có cụm cần giấy tờ chứng minh (Luật TMĐT Điều 23, 24; Luật Quảng cáo): ${cam.map((x) => `"${x.cum}" (${x.ten})`).join(', ')}. AI chỉ nói cụm xuất xứ / công dụng khi trích đúng dòng này; thương hiệu khác, "nhất", so sánh thì AI không nói.`);
  if (o.gia_goc != null && o.gia_goc <= o.gia) canhBao.push('Giá gốc không lớn hơn giá bán: AI sẽ không nói "giảm từ…".');
  else if (o.gia_goc != null && !bangChungGiaGoc({ ...o, id })) {
    canhBao.push('Chưa có đơn đã giao ở giá gốc này trong 30 ngày: giá gạch đang ẩn trên màn hình và AI không nói "giảm từ".');
  }
  return { o, canhBao };
}

const CAC_O = ['so', 'ten', 'danh_muc', 'trang_thai', 'thuong_hieu', 'gia', 'gia_goc', 'gia_von', 'thong_so', 'bang_size_id', 'nhom', 'anh', 'video',
  'can_nang_g', 'kich_thuoc_cm', 'mo_ta', 'diem_noi_bat', 'ten_goi_khac', 'phoi_cung', 'hoi_dap', 'ghi_chu_noi_bo', 'ai_doan'];

function ghiDong(db, sp, moi) {
  const gt = CAC_O.map((k) => (COT_JSON.includes(k) ? (sp[k] == null ? null : JSON.stringify(sp[k])) : sp[k]));
  if (moi) {
    db.prepare(`INSERT INTO san_pham (id, ${CAC_O.join(', ')}, phien_ban, tao_luc, sua_luc) VALUES (?, ${CAC_O.map(() => '?').join(', ')}, ?, ?, ?)`)
      .run(sp.id, ...gt, sp.phien_ban, sp.tao_luc, sp.sua_luc);
  } else {
    db.prepare(`UPDATE san_pham SET ${CAC_O.map((k) => `${k} = ?`).join(', ')}, phien_ban = ?, sua_luc = ? WHERE id = ?`)
      .run(...gt, sp.phien_ban, sp.sua_luc, sp.id);
  }
}

/** Đang bán cần ít nhất một ảnh (F-51 "Ảnh (B ≥ 1)"). Nháp được lưu khi chưa có ảnh. */
function kiemDuDeBan(sp) {
  if (sp.trang_thai === 'dang_ban' && !sp.anh.length) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Sản phẩm Đang bán cần ít nhất 1 ảnh. Thêm ảnh hoặc lưu ở trạng thái Nháp.');
  }
}

/**
 * Tạo sản phẩm. Trả { san_pham, phan_loai, canh_bao }.
 * @param {object} duLieu  các ô của F-51 + `phan_loai: [{gt1, gt2, sku?, gia?, ton, bo?}]` + `anh: [{tep, mau}]`
 */
function taoSanPham(duLieu = {}) {
  return giaoDich((db) => {
    const id = taoId('sp');
    const { o, canhBao } = kiemO(db, duLieu, null, id);
    const dsPl = kiemPhanLoai(duLieu.phan_loai, o.nhom, o.so);
    const luc = gio();
    const g1 = [...new Set(dsPl.map((x) => x.gt1))];
    const sp = { id, ...o, anh: kiemDanhSachAnh(id, duLieu.anh, g1), video: kiemDanhSachVideo(id, duLieu.video, g1), phien_ban: 1, tao_luc: luc, sua_luc: luc };
    kiemDuDeBan(sp);
    ghiDong(db, sp, true);
    ghiPhanLoai(db, id, dsPl);
    ghiBanSua(db, sp);
    return { ...chiTiet(id), canh_bao: canhBao };
  });
}

/**
 * Sửa sản phẩm: ô không gửi lên giữ nguyên. Có `phan_loai` thì ghi lại bảng phân loại (ô cũ giữ tồn, ô mới tồn ban đầu).
 * Không có gì đổi thì không tạo bản sửa mới.
 */
function suaSanPham(id, duLieu = {}) {
  return giaoDich((db) => {
    const cu = laySanPham(id);
    const { o, canhBao } = kiemO(db, duLieu, cu, id);
    const dsPl = duLieu.phan_loai ? kiemPhanLoai(duLieu.phan_loai, o.nhom, o.so) : null;
    const gt1 = dsPl ? dsPl.map((x) => x.gt1) : phanLoaiCua(id, db).map((p) => p.gt1);
    const anh = Object.hasOwn(duLieu, 'anh') ? kiemDanhSachAnh(id, duLieu.anh, [...new Set(gt1)]) : cu.anh;
    const video = Object.hasOwn(duLieu, 'video') ? kiemDanhSachVideo(id, duLieu.video, [...new Set(gt1)]) : (cu.video || []);
    const sp = { ...cu, ...o, anh, video };
    const truoc = JSON.stringify(chup(cu, phanLoaiCua(id, db)));
    if (dsPl) ghiPhanLoai(db, id, dsPl);
    if (JSON.stringify(chup(sp, phanLoaiCua(id, db))) === truoc) return { ...chiTiet(id), canh_bao: canhBao };
    kiemDuDeBan(sp);
    sp.phien_ban = cu.phien_ban + 1;
    sp.sua_luc = gio();
    ghiDong(db, sp, false);
    ghiBanSua(db, sp);
    return { ...chiTiet(id), canh_bao: canhBao };
  });
}

/**
 * Bằng chứng giá gốc (F-76, #104; Luật TMĐT Điều 24): chỉ hiện giá gạch và cho AI nói "giảm từ …" khi đã có đơn ĐÃ GIAO (không
 * tính diễn tập) bán đúng giá gốc trong 30 ngày gần nhất. Shop mới chưa có đơn giao → giá gạch coi như tắt. Tính theo cả mẫu.
 */
function bangChungGiaGoc(sp, bayGio = new Date()) {
  if (!sp?.id || sp.gia_goc == null || !(sp.gia_goc > sp.gia)) return false;
  const tu = new Date(new Date(bayGio).getTime() - 30 * 86400e3).toISOString();
  return !!csdl().prepare(`SELECT 1 FROM don_dong dd JOIN don d ON d.id = dd.don_id
      JOIN don_lich_su ls ON ls.don_id = d.id AND ls.den = 'da_giao' AND ls.da_hoan_tac = 0
    WHERE dd.san_pham_id = ? AND dd.don_gia = ? AND d.trang_thai = 'da_giao' AND d.dien_tap = 0 AND ls.luc >= ? LIMIT 1`).get(sp.id, sp.gia_goc, tu);
}

function laySanPham(id) {
  const sp = doc(csdl().prepare('SELECT * FROM san_pham WHERE id = ?').get(id));
  if (!sp) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy sản phẩm này.', 404);
  return sp;
}

/** Sản phẩm theo số (khách gõ "chốt 12", AI gọi `lay_san_pham(12)`), không có thì null. */
function layTheoSo(so) {
  const n = Number(String(so ?? '').replace(/^\s*(so|số|#)\s*/i, '').trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return doc(csdl().prepare('SELECT * FROM san_pham WHERE so = ?').get(n));
}

/** Một bản sửa cụ thể (nội dung đã chụp), null nếu không có. */
function layBanSua(sanPhamId, phienBan) {
  const r = csdl().prepare('SELECT * FROM san_pham_ban_sua WHERE san_pham_id = ? AND phien_ban = ?').get(sanPhamId, phienBan);
  return r ? { id: sanPhamId, phien_ban: r.phien_ban, sua_luc: r.luc, ...JSON.parse(r.noi_dung) } : null;
}

function banSua(id) {
  laySanPham(id);
  return csdl().prepare('SELECT * FROM san_pham_ban_sua WHERE san_pham_id = ? ORDER BY phien_ban DESC').all(id)
    .map((r) => ({ phien_ban: r.phien_ban, luc: r.luc, ...JSON.parse(r.noi_dung) }));
}

/** Đổi trạng thái (nút trên danh sách, "Nói với Mai" `doi_trang_thai_san_pham`). */
function doiTrangThai(id, trangThai) {
  return suaSanPham(id, { trang_thai: kiemTrangThai(trangThai) });
}

/* ---------------- tên gọi, độ đầy đủ ---------------- */

/** Chữ gọi trên live (#60): "áo số 12". */
/** Đơn vị bán của danh mục ("kg" cho rau củ) hoặc null (bán theo chiếc). */
function donVi(sp) {
  return danhMuc(sp?.danh_muc)?.don_vi || null;
}

/** Giá kèm đơn vị: "25.000đ/kg"; hàng bán theo chiếc giữ "289.000đ". */
function hienGia(sp, gia = sp.gia) {
  const dv = donVi(sp);
  return `${hienTien(gia)}${dv ? `/${dv}` : ''}`;
}

/**
 * Cú pháp chốt hiện cho khách (Thanh chữ, chú thích clip, bài báo trước). Quần áo giữ "chốt 12 + màu + size";
 * hàng bán theo kg: "chốt 50 + số kg"; món chỉ một phân loại: "chốt 15".
 */
function cuPhapChot(sp) {
  const dv = donVi(sp);
  if (dv) return `chốt ${sp.so} + số ${dv}`;
  if (sp.nhom?.t2) return `chốt ${sp.so} + màu + size`;
  const dsPl = (sp.phan_loai || (sp.id ? phanLoaiCua(sp.id) : [])).filter((p) => !p.bo);
  return dsPl.length === 1 ? `chốt ${sp.so}` : `chốt ${sp.so} + màu`;
}

/** Cách chốt chung cho một nhóm món (câu ghim, lời mời): quần áo "số + màu + size", rau củ "số món + số cân", lẫn cả hai thì ghi cả hai. */
function cachChotChung(ds = []) {
  const kg = ds.some((s) => donVi(s));
  const thuong = ds.some((s) => !donVi(s));
  if (kg && !thuong) return 'số món + số cân';
  if (kg) return 'số + màu + size (rau củ: số món + số cân)';
  return 'số + màu + size';
}

function tenGoi(sp) {
  return `${danhMuc(sp.danh_muc)?.goi || 'mẫu'} số ${sp.so}`;
}

/** "Áo số 12 · Sơ mi linen tay ngắn" — cách gọi đầy đủ trên màn hình và trong thẻ. */
function tenDayDu(sp) {
  const g = tenGoi(sp);
  return `${g.charAt(0).toUpperCase()}${g.slice(1)} · ${sp.ten}`;
}

/**
 * Thanh "AI đã đủ thông tin để tư vấn" (F-51): các ô còn thiếu ảnh hưởng tới tư vấn. Thiếu không chặn Đang bán.
 * Ô còn "AI đoán" tính là chưa đủ (AI chưa được nói như sự thật).
 */
function doDayDu(sp) {
  const bo = new Set(boThongSo(sp.danh_muc));
  const doan = new Set(sp.ai_doan || []);
  const coTs = (k) => {
    const v = sp.thong_so?.[k];
    return (Array.isArray(v) ? v.length > 0 : !!v) || !!sp.thong_so?.[`${k}_ghi`];
  };
  const thieu = [];
  for (const [k, ten] of [['chat_lieu', 'chất liệu'], ['doi_tuong', 'đối tượng'], ['kieu_dang', 'kiểu dáng']]) {
    if (!bo.has(k)) continue;
    if (!coTs(k)) thieu.push(ten);
    else if (doan.has(`thong_so.${k}`)) thieu.push(`${ten} (AI đoán, chưa xác nhận)`);
  }
  if (danhMuc(sp.danh_muc)?.bo === 'quan_ao' && !sp.bang_size_id) thieu.push('bảng size');
  if (!sp.diem_noi_bat?.length) thieu.push('điểm nổi bật');
  else if (doan.has('diem_noi_bat')) thieu.push('điểm nổi bật (AI đoán, chưa xác nhận)');
  return { du: thieu.length === 0, thieu };
}

/* ---------------- thẻ sản phẩm cho AI (mục 5) ---------------- */

/**
 * Các dòng của thẻ sản phẩm. Mỗi dòng { chu, xacNhan }: dòng xacNhan = false là ô AI đoán chưa xác nhận — hiện cho AI kèm
 * "(chưa xác nhận)" nhưng Bộ kiểm tra không nhận làm nguồn trích (K2). Giá vốn, ghi chú nội bộ không bao giờ có ở đây.
 * @param {object} sp          sản phẩm hoặc một bản sửa (đã có phan_loai trong bản chụp)
 * @param {object} [o]
 * @param {boolean} [o.tonKho] kèm "Còn bán được" từng ô (tính lúc gọi)
 */
function dongThe(sp, { tonKho = true } = {}) {
  const ds = [];
  const them = (chu, xacNhan = true) => ds.push({ chu, xacNhan });
  const doan = new Set(sp.ai_doan || []);
  const dm = danhMuc(sp.danh_muc);
  const dsPl = (sp.phan_loai || phanLoaiCua(sp.id)).filter((p) => !p.bo);
  them(tenDayDu(sp));
  them(`Danh mục: ${dm?.ten || sp.danh_muc}`);
  if (sp.thuong_hieu) them(`Thương hiệu: ${sp.thuong_hieu}`);
  them(`Giá: ${hienGia(sp)}`);
  if (dm?.don_vi) them(`Bán theo ${dm.don_vi}: khách chốt "${cuPhapChot(sp)}" (ví dụ "chốt ${sp.so} 2${dm.don_vi}" là 2 ${dm.don_vi})`);
  // F-76: dòng giá gốc chỉ có khi có bằng chứng — AI không nói "giảm từ …" với giá gốc chưa từng bán.
  if (bangChungGiaGoc(sp)) them(`Giá gốc (trước giảm): ${hienTien(sp.gia_goc)}`);
  for (const p of dsPl) if (p.gia != null && p.gia !== sp.gia) them(`Giá ${nhanPl(p)}: ${hienTien(p.gia)}`);
  const gt1 = [...new Set(dsPl.map((p) => p.gt1))];
  const gt2 = [...new Set(dsPl.map((p) => p.gt2).filter(Boolean))];
  them(`Phân loại: ${sp.nhom.t1} (${gt1.join(', ')})${sp.nhom.t2 ? ` × ${sp.nhom.t2} (${gt2.join(', ')})` : ''}`);

  const cacTs = boThongSo(sp.danh_muc).map((k) => [k, chuThongSo(k, sp.thong_so || {})]).filter(([, v]) => v);
  if (cacTs.length) {
    them('Thông số:');
    for (const [k, v] of cacTs) {
      const chua = doan.has(`thong_so.${k}`);
      them(`- ${THONG_SO[k].ten}: ${v}${chua ? ' (chưa xác nhận)' : ''}`, !chua);
    }
  }

  const bs = sp.bang_size_id ? (() => { try { return bangSize.layBang(sp.bang_size_id); } catch { return null; } })() : null;
  if (bs) {
    them(`Bảng size (${bs.ten}):`);
    for (const d of bangSize.dongChoAi(bs)) them(`- ${d}`);
  } else if (dm?.bo === 'quan_ao') them('Bảng size: chưa có');

  if (tonKho && sp.id) {
    them('Còn bán được (lúc này):');
    for (const p of kho.conHang(sp.id)) them(`- Còn bán được ${nhanPl(p)}: ${p.con_ban_duoc}`);
  }

  if (sp.diem_noi_bat?.length) {
    const chua = doan.has('diem_noi_bat');
    them(`Điểm nổi bật:${chua ? ' (chưa xác nhận)' : ''}`, !chua);
    for (const d of sp.diem_noi_bat) them(`- ${d}`, !chua);
  }
  if (sp.mo_ta) {
    const chua = doan.has('mo_ta');
    them(`Mô tả:${chua ? ' (chưa xác nhận)' : ''}`, !chua);
    for (const d of sp.mo_ta.split('\n').map((x) => x.trim()).filter(Boolean)) them(d, !chua);
  }
  if (sp.ten_goi_khac?.length) them(`Khách hay gọi: ${sp.ten_goi_khac.join(', ')}`, !doan.has('ten_goi_khac'));
  // #90: ảnh / video chiếu được lên màn hình sản phẩm.
  const mauAnh = [...new Set((sp.anh || []).map((a) => a.mau).filter(Boolean))];
  them(`Ảnh: ${(sp.anh || []).length} ảnh${mauAnh.length ? ` (có ảnh màu ${mauAnh.join(', ')})` : ''}; video: ${(sp.video || []).length ? `${sp.video.length} video` : 'chưa có'}`, false);
  if (sp.hoi_dap?.length) {
    them('Hỏi đáp của mẫu này:');
    for (const h of sp.hoi_dap) them(`- Hỏi: ${h.hoi} — Đáp: ${h.dap}`);
  }
  const phoi = (sp.phoi_cung || []).map((id) => { try { return laySanPham(id); } catch { return null; } })
    .filter((x) => x && x.trang_thai === 'dang_ban');
  if (phoi.length) {
    them('Phối cùng (gợi ý mua kèm):');
    for (const x of phoi) them(`- ${tenDayDu(x)} · Giá: ${hienTien(x.gia)}`);
  }
  return ds;
}

/** Thẻ sản phẩm dạng chữ cho mọi AI (Co-host, Tư vấn viên, miệng, Đội AI, Soạn kịch bản, Quản lý). */
function theChoAi(sp, o = {}) {
  return dongThe(sp, o).map((d) => d.chu).join('\n');
}

/** Chữ nguồn cho Bộ kiểm tra (K2): chỉ các dòng đã xác nhận, kèm còn bán được lúc kiểm. */
function nguonKiemTra(sp) {
  return dongThe(sp, { tonKho: true }).filter((d) => d.xacNhan).map((d) => d.chu).join('\n');
}

/* ---------------- danh sách, tìm, mục lục ---------------- */

function tomTat(sp, ton) {
  const t = ton.get(sp.id) || { ton: 0, con: 0, con_it_nhat: 0 };
  return {
    id: sp.id, so: sp.so, ten: sp.ten, ten_day_du: tenDayDu(sp), ten_goi: tenGoi(sp), danh_muc: sp.danh_muc,
    ten_danh_muc: danhMuc(sp.danh_muc)?.ten || sp.danh_muc, trang_thai: sp.trang_thai, gia: sp.gia, anh_dai_dien: sp.anh[0]?.tep || null,
    ton: t.ton, con_ban_duoc: t.con, do_day_du: doDayDu(sp), phien_ban: sp.phien_ban, sua_luc: sp.sua_luc,
    sap_het: t.con > 0 && t.con_it_nhat <= nguongSapHet(), het_hang: t.con <= 0,
  };
}

function nguongSapHet() {
  return require('./cai-dat').banHang().nguong_sap_het;
}

/**
 * Danh sách sản phẩm (F-51): tìm theo số, tên, tên gọi khác (gõ không dấu cũng được); lọc trạng thái, danh mục,
 * kho = 'sap_het' | 'het_hang'. Lọc ở Node vì LIKE của SQLite không bỏ dấu tiếng Việt.
 */
function danhSach({ q = '', trang_thai: trangThai = '', danh_muc: dm = '', kho: locKho = '' } = {}) {
  const ton = kho.tongConTheoSanPham();
  let ds = csdl().prepare('SELECT * FROM san_pham ORDER BY so').all().map(doc);
  if (trangThai) ds = ds.filter((s) => s.trang_thai === kiemTrangThai(trangThai));
  if (dm) ds = ds.filter((s) => s.danh_muc === dm);
  const tu = boDau(q).trim();
  if (tu) {
    const soQ = /^\d+$/.test(tu) ? Number(tu) : null;
    ds = ds.filter((s) => s.so === soQ || boDau(`${s.ten} ${s.ten_goi_khac.join(' ')} ${tenGoi(s)}`).includes(tu));
  }
  let kq = ds.map((s) => tomTat(s, ton));
  if (locKho === 'sap_het') kq = kq.filter((s) => s.sap_het);
  if (locKho === 'het_hang') kq = kq.filter((s) => s.het_hang);
  return kq;
}

/** Chi tiết cho màn hình: sản phẩm + phân loại (kèm còn bán được) + độ đầy đủ + bảng size đang dùng. */
function chiTiet(id) {
  const sp = laySanPham(id);
  const con = new Map(kho.conHang(id).map((p) => [p.id, p]));
  return {
    san_pham: { ...sp, ten_day_du: tenDayDu(sp), ten_goi: tenGoi(sp), gia_goc_co_bang_chung: bangChungGiaGoc(sp) },
    phan_loai: phanLoaiCua(id).map((p) => ({ ...p, dang_giu: con.get(p.id)?.dang_giu ?? 0, con_ban_duoc: con.get(p.id)?.con_ban_duoc ?? 0 })),
    do_day_du: doDayDu(sp),
    bang_size: sp.bang_size_id ? bangSize.layBang(sp.bang_size_id) : null,
  };
}

/** Mục lục sản phẩm Đang bán cho AI (`muc_luc_san_pham`, nạp mục lục): số, tên, giá, tổng còn bán được. */
function mucLucDangBan() {
  const ton = kho.tongConTheoSanPham();
  return csdl().prepare("SELECT * FROM san_pham WHERE trang_thai = 'dang_ban' ORDER BY so").all().map(doc)
    .map((s) => ({ id: s.id, so: s.so, ten: s.ten, ten_goi: tenGoi(s), ten_day_du: tenDayDu(s), gia: s.gia, phien_ban: s.phien_ban,
      con_ban_duoc: ton.get(s.id)?.con ?? 0, ten_goi_khac: s.ten_goi_khac, danh_muc: s.danh_muc }));
}

function demTheoTrangThai() {
  const kq = { nhap: 0, dang_ban: 0, ngung_ban: 0 };
  for (const r of csdl().prepare('SELECT trang_thai, COUNT(*) AS n FROM san_pham GROUP BY trang_thai').all()) kq[r.trang_thai] = r.n;
  return kq;
}

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TU_GOI_SO = ['so', 'mau', 'ma', 'sp', 'san pham', 'mau so', '#'];

/**
 * Sản phẩm được nhắc trong một câu (K1, K4, đoán bình luận hỏi món nào — F-20):
 *  - theo số: "số 12", "mẫu 12", "sp 12", "#12", "áo số 12", "áo 12" (chữ gọi của danh mục);
 *  - theo tên đầy đủ hoặc tên gọi khác (gõ không dấu cũng nhận).
 * @param {string} cau
 * @param {object[]} ds  sản phẩm để so (thường mọi sản phẩm, hoặc sản phẩm trong phiên)
 * @returns {{theoSo:object[], theoTen:object[], soLa:number[]}} soLa = số gọi rõ ("số 99") mà không có sản phẩm nào
 */
function sanPhamDuocNhac(cau, ds) {
  const s = ` ${boDau(cau).replace(/[^\p{L}\d#]+/gu, ' ')} `;
  const goi = [...new Set(DANH_MUC.map((d) => boDau(d.goi)))];
  const soRo = new Set();
  const soCoGoi = new Set();
  // F-82: "mẫu 1m60", "mẫu 158cm" là số đo người mẫu, không phải "mẫu số 1".
  for (const m of s.matchAll(new RegExp(`(?<![\\p{L}\\d])(?:${TU_GOI_SO.map(esc).join('|')})\\s*(\\d{1,5})(?!\\d)(?!m\\d|\\s*(?:cm|kg|ky|ki)(?![\\p{L}]))`, 'gu'))) soRo.add(Number(m[1]));
  for (const m of s.matchAll(new RegExp(`(?<![\\p{L}\\d])(?:${goi.map(esc).join('|')})\\s+(?:so\\s+)?(\\d{1,5})(?![\\p{L}\\d])`, 'gu'))) soCoGoi.add(Number(m[1]));
  const theoSo = ds.filter((x) => soRo.has(x.so) || soCoGoi.has(x.so));
  // "áo 2 dây" không phải áo số 2: chỉ coi là số lạ khi gọi rõ bằng "số / mẫu / sp".
  const soLa = [...soRo].filter((n) => !ds.some((x) => x.so === n));
  const theoTen = ds.filter((x) => !theoSo.includes(x) && [x.ten, ...(x.ten_goi_khac || [])]
    .map((t) => boDau(t).replace(/[^\p{L}\d]+/gu, ' ').trim()).filter((t) => t.length >= 4)
    .some((t) => new RegExp(`(?<![\\p{L}\\d])${esc(t)}(?![\\p{L}\\d])`, 'u').test(s)));
  return { theoSo, theoTen, soLa };
}

/** Nhân bản (F-51 "Nhân bản"): bản Nháp, số kế tiếp, cùng ô và phân loại (tồn 0, mã phân loại sinh lại), chép ảnh. */
function nhanBan(id) {
  const goc = laySanPham(id);
  const so = soKeTiep();
  const dsPl = phanLoaiCua(id).map((p) => ({ gt1: p.gt1, gt2: p.gt2, gia: p.gia, bo: p.bo, can_nang_g: p.can_nang_g, ton: 0 }));
  const anh = goc.anh.map((a) => {
    const tep = tenTepMoi();
    fs.mkdirSync(thuMucAnhTam(), { recursive: true });
    const nguon = duongAnh(goc.id, a.tep);
    if (nguon) fs.copyFileSync(nguon, path.join(thuMucAnhTam(), tep));
    return nguon ? { tep, mau: a.mau } : null;
  }).filter(Boolean);
  const { id: _i, so: _s, phien_ban: _p, tao_luc: _t, sua_luc: _u, ...o } = goc;
  return taoSanPham({ ...o, so, ten: `${goc.ten} (bản sao)`, trang_thai: 'nhap', phan_loai: dsPl, anh });
}

module.exports = {
  donVi, hienGia, cuPhapChot, cachChotChung,
  bangChungGiaGoc,
  TRANG_THAI, TEN_TRANG_THAI, O_AI_DOAN, cauHinh, danhMuc, boThongSo, kiemThongSo, chuThongSo, skuTuSinh, nhanPl,
  taoSanPham, suaSanPham, laySanPham, layTheoSo, layBanSua, banSua, doiTrangThai, chiTiet, danhSach, mucLucDangBan,
  demTheoTrangThai, phanLoaiCua, soKeTiep, tenGoi, tenDayDu, doDayDu, dongThe, theChoAi, nguonKiemTra, sanPhamDuocNhac, nhanBan,
  luuAnhTam, duongAnh, kiemAnh, luuVideoTam, duongVideo,
};
