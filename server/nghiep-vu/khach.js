'use strict';

/**
 * Khách hàng, bộ nhớ, việc (SPEC.md F-54, F-30, mục 7 — thay "ứng viên" của bản tuyển dụng).
 *  - Hồ sơ chống trùng theo số điện thoại (`+84…`), trên mọi Page. Khách hàng được tạo khi có số điện thoại (lúc khách
 *    cho thông tin giao ở BH3, hoặc người dùng tạo tay); trước đó hội thoại chỉ gắn với người Facebook.
 *  - Người sửa hồ sơ → AI không ghi đè trong 24 giờ (A.12).
 *  - Xóa dữ liệu một người và tự xóa sau 12 tháng không liên lạc (#35 sửa): xóa tên, số, địa chỉ, bộ nhớ, nội dung tin
 *    nhắn; không tự xóa khi khách còn đơn chưa xong.
 * Phần đơn hàng của khách (số đơn, số hoàn, tổng đã mua, nhãn "từng hoàn") làm ở BH3 (F-54, F-55).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, chuan, boDau, kiemChu } = require('./chung');
const { DA_XOA } = require('./hop-thu');

const GIU_NGUOI_MS = 24 * 3600 * 1000;
const NGAY_GIU_DU_LIEU = 365; // #35
const DON_CHUA_XONG = "('cho_xac_nhan', 'da_xac_nhan', 'da_gui')";
// Việc cho người (mục 7) và việc MOZA tự làm khi đến hạn (hoi_tham: nhắn lại khách, nhac_thong_tin_giao: F-32).
const LOAI_VIEC = ['goi_xac_nhan_don', 'goi_khach', 'bo_sung_thong_tin', 'khac', 'hoi_tham', 'nhac_thong_tin_giao', 'xoa_du_lieu', 'hen_ngay_gui', 'doi_size'];

/* ---------------- số điện thoại ---------------- */

/** Chuẩn hóa số di động Việt Nam về `+84xxxxxxxxx`; không phải số hợp lệ → null. */
function chuanSdt(s) {
  if (s == null) return null;
  let x = String(s).replace(/[\s.\-()]/g, '');
  if (x.startsWith('+84')) x = '0' + x.slice(3);
  else if (/^84\d{9}$/.test(x)) x = '0' + x.slice(2);
  if (!/^0[35789]\d{8}$/.test(x)) return null;
  return '+84' + x.slice(1);
}

/** Hiện số cho người dùng: +84912345678 → 0912 345 678. */
function hienSdt(s) {
  if (!s) return '';
  const x = '0' + String(s).slice(3);
  return `${x.slice(0, 4)} ${x.slice(4, 7)} ${x.slice(7)}`;
}

/* ---------------- hồ sơ ---------------- */

function docKhach(r) {
  return r ? { ...r, dien_tap: r.dien_tap === 1, sdt_hien: hienSdt(r.sdt) } : null;
}

function layKhach(id) {
  const k = docKhach(csdl().prepare('SELECT * FROM khach WHERE id = ?').get(id));
  if (!k) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy khách hàng này.', 404);
  return k;
}

/**
 * Tạo hồ sơ. Có số trùng → không tạo mới, liên kết vào hồ sơ cũ. Cùng tên mà khác số → vẫn tạo, báo `nghi_trung`
 * để nơi gọi chuyển Cần người.
 * @returns {{ket_qua:'tao_moi'|'da_lien_ket', khach:object, nghi_trung?:object[]}}
 */
function taoKhach({ ten = '', sdt = null, diaChi = '', ghiChu = '', hoiThoaiId = null, phienLiveId = null, taoBoi = 'nguoi', dongY = false, dienTap = false }) {
  const tenSach = kiemChu(ten, { ten: 'Tên', toiDa: 100, motDong: true });
  const so = sdt ? chuanSdt(sdt) : null;
  if (sdt && !so) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `"${sdt}" không phải số di động Việt Nam hợp lệ.`);
  if (!tenSach && !so) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cần ít nhất tên hoặc số điện thoại.');
  const dc = kiemChu(diaChi, { ten: 'Địa chỉ giao', toiDa: 300 });
  return giaoDich((db) => {
    if (so) {
      const cu = db.prepare('SELECT * FROM khach WHERE sdt = ?').get(so);
      if (cu) {
        if (hoiThoaiId) require('./hop-thu').lienKetKhach(hoiThoaiId, cu.id);
        if (tenSach && !cu.ten) db.prepare('UPDATE khach SET ten = ? WHERE id = ?').run(tenSach, cu.id);
        if (dongY && !cu.dong_y_luc) db.prepare('UPDATE khach SET dong_y_luc = ? WHERE id = ?').run(gio(), cu.id);
        return { ket_qua: 'da_lien_ket', khach: layKhach(cu.id) };
      }
    }
    const nghiTrung = tenSach
      ? db.prepare("SELECT id, ten, sdt FROM khach WHERE ten = ? COLLATE NOCASE AND xoa_luc IS NULL AND gop_vao IS NULL AND (sdt IS NULL OR sdt <> ?)").all(tenSach, so || '')
      : [];
    const id = taoId('kh');
    db.prepare(`INSERT INTO khach (id, ten, sdt, dia_chi, ghi_chu, nguon_hoi_thoai_id, nguon_phien_live_id, dong_y_luc, tao_boi, dien_tap, tao_luc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, tenSach, so, dc, chuan(ghiChu).slice(0, 2000), hoiThoaiId, phienLiveId, dongY ? gio() : null, taoBoi, dienTap ? 1 : 0, gio());
    if (hoiThoaiId) require('./hop-thu').lienKetKhach(hoiThoaiId, id);
    return { ket_qua: 'tao_moi', khach: layKhach(id), ...(nghiTrung.length ? { nghi_trung: nghiTrung.map(docKhach) } : {}) };
  });
}

/** Người sửa hồ sơ (ghi mốc để AI không ghi đè trong 24 giờ — A.12). AI sửa thì truyền `boi: 'ai'`. */
function suaKhach(id, duLieu = {}, { boi = 'nguoi' } = {}) {
  const k = layKhach(id);
  if (k.xoa_luc) throw new LoiNghiepVu('DA_XOA', 'Hồ sơ này đã xóa theo yêu cầu.', 409);
  if (boi === 'ai' && k.nguoi_sua_luc && Date.now() - new Date(k.nguoi_sua_luc).getTime() < GIU_NGUOI_MS) {
    throw new LoiNghiepVu('NGUOI_VUA_SUA', 'Người dùng vừa sửa hồ sơ này (trong 24 giờ): AI không ghi đè.');
  }
  const ten = duLieu.ten !== undefined ? kiemChu(duLieu.ten, { ten: 'Tên', toiDa: 100, motDong: true }) : k.ten;
  let so = k.sdt;
  if (duLieu.sdt !== undefined) {
    so = duLieu.sdt ? chuanSdt(duLieu.sdt) : null;
    if (duLieu.sdt && !so) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `"${duLieu.sdt}" không phải số di động Việt Nam hợp lệ.`);
    const trung = so && csdl().prepare('SELECT id FROM khach WHERE sdt = ? AND id <> ?').get(so, id);
    if (trung) throw new LoiNghiepVu('SDT_TRUNG', 'Số này đã thuộc hồ sơ khác. Dùng "Gộp hồ sơ" nếu là cùng một người.', 409);
  }
  const diaChi = duLieu.dia_chi !== undefined ? kiemChu(duLieu.dia_chi, { ten: 'Địa chỉ giao', toiDa: 300 }) : k.dia_chi;
  const ghiChu = duLieu.ghi_chu !== undefined ? chuan(duLieu.ghi_chu).slice(0, 2000) : k.ghi_chu;
  csdl().prepare(`UPDATE khach SET ten = ?, sdt = ?, dia_chi = ?, ghi_chu = ?, nguoi_sua_luc = CASE WHEN ? = 'nguoi' THEN ? ELSE nguoi_sua_luc END WHERE id = ?`)
    .run(ten, so, diaChi, ghiChu, boi, gio(), id);
  return layKhach(id);
}

/** Danh sách khách (tên, số điện thoại, số đơn, số hoàn — F-54). Tìm theo tên hoặc số, gõ không dấu cũng được. */
function danhSachKhach({ q = '', dienTap = null, gioiHan = 300 } = {}) {
  const dk = ['k.xoa_luc IS NULL', 'k.gop_vao IS NULL'];
  const ts = [];
  if (dienTap !== null) { dk.push('k.dien_tap = ?'); ts.push(dienTap ? 1 : 0); }
  const ds = csdl().prepare(`
    SELECT k.*, (SELECT COUNT(*) FROM don d WHERE d.khach_id = k.id AND d.trang_thai <> 'da_huy') AS so_don,
                (SELECT COUNT(*) FROM don d WHERE d.khach_id = k.id AND d.trang_thai = 'hoan') AS so_hoan
    FROM khach k WHERE ${dk.join(' AND ')} ORDER BY k.tao_luc DESC LIMIT ?`).all(...ts, gioiHan).map(docKhach);
  const tim = boDau(q).replace(/\s+/g, '');
  if (!tim) return ds;
  return ds.filter((k) => boDau(k.ten).replace(/\s+/g, '').includes(tim) || (k.sdt || '').includes(tim.replace(/^0/, '')));
}

/** Trang chi tiết (F-54): thông tin, hội thoại, đơn, bộ nhớ, việc. */
function chiTiet(id) {
  const k = layKhach(id);
  const db = csdl();
  return {
    khach: k,
    hoi_thoai: db.prepare(`SELECT h.id, h.kenh, h.trang_thai, h.page_id, h.cap_nhat_luc, p.ten AS ten_page FROM hoi_thoai h
                           LEFT JOIN fb_page p ON p.id = h.page_id WHERE h.khach_id = ? ORDER BY h.cap_nhat_luc DESC`).all(id),
    don: db.prepare('SELECT id, ma, trang_thai, tong_tien, tao_luc FROM don WHERE khach_id = ? ORDER BY tao_luc DESC').all(id),
    viec: db.prepare("SELECT * FROM viec WHERE khach_id = ? ORDER BY trang_thai = 'mo' DESC, han_luc").all(id),
    bo_nho: danhSachBoNho(id),
    tom_tat_mua: tomTatMua(id), // F-91: chỉ người của shop thấy (Hộp thư, Khách hàng)
    so_do: soDo(id),
  };
}

/* ---------------- khách quen, size quen, số đo (F-91, #114) ---------------- */

/**
 * Tóm tắt mua CHỈ từ lịch sử đơn (không đọc bình luận, không đọc bộ nhớ chữ): số đơn Đã giao (không tính Hoàn), size quen theo
 * danh mục (giá trị nhóm 2 gặp nhiều nhất trong dòng đơn Đã giao; bằng nhau thì lấy lần gần nhất), ngày mua gần nhất.
 * Nhãn "khách quen · hay mặc M" (từ 2 đơn) / "đã mua 1 lần · M" chỉ hiện cho người của shop — không lên sóng, không vào AI trên sóng.
 * F-118 (BH10): thêm `so_hoan` (đơn Hoàn của khách) và `nhan_hoan` "Từng hoàn N đơn — …" — cũng chỉ người của shop thấy.
 * @returns {{so_don:number, so_hoan:number, size_quen:Object<string,string>, gan_nhat:string|null, nhan:string|null, nhan_hoan:string|null}|null}
 */
function tomTatMua(khachId) {
  if (!khachId) return null;
  const db = csdl();
  const soHoan = demHoan(db, khachId);
  const hoan = { so_hoan: soHoan, nhan_hoan: nhanHoanTu(soHoan) };
  const soDon = db.prepare("SELECT COUNT(*) AS n, MAX(sua_luc) AS gan FROM don WHERE khach_id = ? AND trang_thai = 'da_giao'").get(khachId);
  if (!soDon.n) return { so_don: 0, size_quen: {}, gan_nhat: null, nhan: null, ...hoan };
  const dong = db.prepare(`SELECT p.gt2, s.danh_muc, d.sua_luc FROM don d JOIN don_dong x ON x.don_id = d.id JOIN phan_loai p ON p.id = x.phan_loai_id
                           JOIN san_pham s ON s.id = x.san_pham_id WHERE d.khach_id = ? AND d.trang_thai = 'da_giao' AND p.gt2 IS NOT NULL AND p.gt2 != ''`).all(khachId);
  const dem = {};
  for (const r of dong) {
    const m = (dem[r.danh_muc] ||= {});
    const o = (m[r.gt2] ||= { n: 0, luc: '' });
    o.n += 1;
    if (r.sua_luc > o.luc) o.luc = r.sua_luc;
  }
  const sizeQuen = {};
  let nhieu = null;
  for (const [dm, m] of Object.entries(dem)) {
    const [gt2, o] = Object.entries(m).sort((a, b) => b[1].n - a[1].n || (b[1].luc > a[1].luc ? 1 : -1))[0];
    sizeQuen[dm] = gt2;
    const tong = Object.values(m).reduce((a, b) => a + b.n, 0);
    if (!nhieu || tong > nhieu.tong) nhieu = { gt2, tong, n: o.n };
  }
  const nhan = soDon.n >= 2 ? `khách quen${nhieu ? ` · hay mặc ${nhieu.gt2}` : ''}` : `đã mua 1 lần${nhieu ? ` · ${nhieu.gt2}` : ''}`;
  return { so_don: soDon.n, size_quen: sizeQuen, gan_nhat: soDon.gan, nhan, ...hoan };
}

/** Số đơn Hoàn của khách (như don.soHoanCuaKhach — viết lại ở đây để khỏi vòng require khach ↔ don). */
function demHoan(db, khachId) {
  return db.prepare("SELECT COUNT(*) AS n FROM don WHERE khach_id = ? AND trang_thai = 'hoan'").get(khachId).n;
}

/** F-118: nhãn đỏ cho người của shop khi khách từng có đơn Hoàn (ngưỡng chặn AI tự xác nhận vẫn là nguong_hoan ở Cài đặt). */
function nhanHoanTu(n) {
  return n >= 1 ? `Từng hoàn ${n} đơn — nên gọi xác nhận / chuyển khoản trước` : null;
}

/** Nhãn "từng hoàn" của khách (null nếu chưa hoàn đơn nào). */
function nhanHoan(khachId) {
  try { return khachId ? nhanHoanTu(demHoan(csdl(), khachId)) : null; } catch { return null; }
}

/** Size quen của khách cho một danh mục (null nếu chưa từng mua danh mục đó). */
function sizeQuen(khachId, danhMuc) {
  return tomTatMua(khachId)?.size_quen?.[danhMuc] || null;
}

/** Nhãn cho người dẫn / Hộp thư (null nếu chưa mua). */
function nhanKhach(khachId) {
  try { return tomTatMua(khachId)?.nhan || null; } catch { return null; }
}

/** Số đo khách đã cho lưu (bấm [Lưu giúp mình]). */
function soDo(khachId) {
  if (!khachId) return null;
  const k = csdl().prepare('SELECT chieu_cao_cm, can_nang_kg, so_do_luc, so_do_hoi_luc FROM khach WHERE id = ?').get(khachId);
  if (!k || (k.chieu_cao_cm == null && k.can_nang_kg == null)) return null;
  return { chieu_cao: k.chieu_cao_cm, can_nang: k.can_nang_kg, luc: k.so_do_luc };
}

function luuSoDo(khachId, { chieuCao, canNang }) {
  const cao = Math.round(Number(chieuCao));
  const nang = Math.round(Number(canNang) * 10) / 10;
  if (!(cao >= 100 && cao <= 210) || !(nang >= 25 && nang <= 150)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chiều cao 100–210 cm, cân nặng 25–150 kg.');
  csdl().prepare('UPDATE khach SET chieu_cao_cm = ?, can_nang_kg = ?, so_do_luc = ? WHERE id = ?').run(cao, nang, gio(), khachId);
  return soDo(khachId);
}

/** Xóa số đo ("xóa số đo", menu Xóa dữ liệu, nút ở màn Khách hàng). @returns {boolean} có số đo để xóa không */
function xoaSoDo(khachId) {
  if (!khachId) return false;
  return csdl().prepare('UPDATE khach SET chieu_cao_cm = NULL, can_nang_kg = NULL, so_do_luc = NULL WHERE id = ? AND (chieu_cao_cm IS NOT NULL OR can_nang_kg IS NOT NULL)').run(khachId).changes > 0;
}

/** Đã hỏi lưu số đo chưa (chỉ hỏi 1 lần). */
function daHoiSoDo(khachId) {
  return !!csdl().prepare('SELECT so_do_hoi_luc FROM khach WHERE id = ?').get(khachId)?.so_do_hoi_luc;
}

function ghiHoiSoDo(khachId) {
  csdl().prepare('UPDATE khach SET so_do_hoi_luc = COALESCE(so_do_hoi_luc, ?) WHERE id = ?').run(gio(), khachId);
}

/* ---------------- bộ nhớ (F-30) ---------------- */

function ghiBoNho(khachId, { loai, noiDung, nguonTinNhanId = null }) {
  if (!['nguoi_do_noi', 'da_xac_nhan', 'da_hua'].includes(loai)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Loại bộ nhớ không hợp lệ.');
  layKhach(khachId);
  const id = taoId('bn');
  csdl().prepare('INSERT INTO bo_nho (id, khach_id, loai, noi_dung, nguon_tin_nhan_id, luc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, khachId, loai, kiemChu(noiDung, { ten: 'Nội dung', batBuoc: true, toiDa: 500 }), nguonTinNhanId, gio());
  return csdl().prepare('SELECT * FROM bo_nho WHERE id = ?').get(id);
}

function danhSachBoNho(khachId) {
  return csdl().prepare('SELECT * FROM bo_nho WHERE khach_id = ? AND (het_hieu_luc IS NULL OR het_hieu_luc > ?) ORDER BY luc').all(khachId, gio());
}

function suaBoNho(id, noiDung) {
  csdl().prepare('UPDATE bo_nho SET noi_dung = ? WHERE id = ?').run(kiemChu(noiDung, { ten: 'Nội dung', batBuoc: true, toiDa: 500 }), id);
}

function boBoNho(id) {
  csdl().prepare('UPDATE bo_nho SET het_hieu_luc = ? WHERE id = ?').run(gio(), id);
}

/* ---------------- việc ---------------- */

function taoViec({ loai = 'khac', noiDung, hanLuc = null, khachId = null, hoiThoaiId = null, donId = null, choAi = 'nguoi', taoBoi = 'nguoi' }) {
  const id = taoId('viec');
  if (!LOAI_VIEC.includes(loai)) loai = 'khac';
  if (hanLuc && Number.isNaN(new Date(hanLuc).getTime())) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thời điểm nhắc không hợp lệ.');
  csdl().prepare(`INSERT INTO viec (id, loai, noi_dung, han_luc, khach_id, hoi_thoai_id, don_id, cho_ai, tao_boi, tao_luc)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, loai, kiemChu(noiDung, { ten: 'Nội dung việc', batBuoc: true, toiDa: 500 }), hanLuc ? new Date(hanLuc).toISOString() : null,
      khachId, hoiThoaiId, donId, choAi, taoBoi, gio());
  return layViec(id);
}

function layViec(id) {
  const v = csdl().prepare('SELECT * FROM viec WHERE id = ?').get(id);
  if (!v) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy việc này.', 404);
  return v;
}

function suaViec(id, { trangThai, noiDung, hanLuc, ketQua } = {}) {
  const v = layViec(id);
  if (trangThai && !['mo', 'xong', 'huy'].includes(trangThai)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Trạng thái việc không hợp lệ.');
  csdl().prepare('UPDATE viec SET trang_thai = ?, noi_dung = ?, han_luc = ?, ket_qua = ? WHERE id = ?')
    .run(trangThai ?? v.trang_thai, noiDung !== undefined ? kiemChu(noiDung, { ten: 'Nội dung việc', batBuoc: true, toiDa: 500 }) : v.noi_dung,
      hanLuc !== undefined ? (hanLuc ? new Date(hanLuc).toISOString() : null) : v.han_luc, ketQua ?? v.ket_qua, id);
  return layViec(id);
}

/** Việc cho người (Tổng quan, Cần người): đang mở; `denHan` = chỉ việc đã tới giờ. */
function danhSachViec({ choAi = 'nguoi', trangThai = 'mo', denHan = false, dienTap = false } = {}) {
  const dk = ['v.cho_ai = ?', 'v.trang_thai = ?', 'COALESCE(k.dien_tap, h.dien_tap, 0) = ?'];
  const ts = [choAi, trangThai, dienTap ? 1 : 0];
  if (denHan) { dk.push('(v.han_luc IS NULL OR v.han_luc <= ?)'); ts.push(gio()); }
  return csdl().prepare(`SELECT v.*, k.ten AS ten_khach, k.sdt FROM viec v LEFT JOIN khach k ON k.id = v.khach_id
                         LEFT JOIN hoi_thoai h ON h.id = v.hoi_thoai_id WHERE ${dk.join(' AND ')} ORDER BY v.han_luc IS NULL, v.han_luc`)
    .all(...ts).map((v) => ({ ...v, sdt_hien: hienSdt(v.sdt) }));
}

/** Việc MOZA tự làm đã tới giờ (F-32). */
function viecAiDenHan() {
  return csdl().prepare("SELECT * FROM viec WHERE cho_ai = 'ai' AND trang_thai = 'mo' AND han_luc <= ? ORDER BY han_luc").all(gio());
}

/* ---------------- gộp, xóa (F-54, #35) ---------------- */

/** Gộp hồ sơ `boId` vào `giuId`: giữ lịch sử của cả hai. Chỉ người làm. */
function gopKhach(giuId, boId) {
  if (giuId === boId) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn hai hồ sơ khác nhau.');
  const giu = layKhach(giuId);
  const bo = layKhach(boId);
  return giaoDich((db) => {
    for (const bang of ['hoi_thoai', 'bo_nho', 'viec', 'don']) db.prepare(`UPDATE ${bang} SET khach_id = ? WHERE khach_id = ?`).run(giuId, boId);
    const sdt = giu.sdt || bo.sdt;
    db.prepare('UPDATE khach SET sdt = NULL, gop_vao = ? WHERE id = ?').run(giuId, boId);
    db.prepare(`UPDATE khach SET sdt = ?, ten = CASE WHEN ten = '' THEN ? ELSE ten END, dia_chi = CASE WHEN dia_chi = '' THEN ? ELSE dia_chi END,
                ghi_chu = trim(ghi_chu || CASE WHEN ? <> '' THEN char(10) || ? ELSE '' END), dong_y_luc = COALESCE(dong_y_luc, ?) WHERE id = ?`)
      .run(sdt, bo.ten, bo.dia_chi, bo.ghi_chu, bo.ghi_chu, bo.dong_y_luc, giuId);
    return layKhach(giuId);
  });
}

function xoaHoiThoaiTrong(db, h, lyDo) {
  db.prepare("UPDATE tin_nhan SET noi_dung = ?, trich_dan = '[]' WHERE hoi_thoai_id = ?").run(lyDo, h.id);
  db.prepare('UPDATE hoi_thoai SET tom_tat = NULL, nhan = \'[]\' WHERE id = ?').run(h.id);
  db.prepare("UPDATE nguoi_fb SET ten_hien_thi = '', xoa_luc = ? WHERE id = ?").run(gio(), h.nguoi_fb_id);
}

/**
 * "Xóa dữ liệu người này" (F-54, mục 9): xóa tên, số, địa chỉ, bộ nhớ; nội dung tin nhắn thay bằng `[đã xóa theo yêu cầu]`.
 * Khách còn đơn chưa xong thì phải hủy đơn trước. Đơn đã xong giữ lại dạng ẩn danh (bỏ tên, số, địa chỉ) để báo cáo đúng.
 */
function xoaDuLieu(khachId, { lyDo = DA_XOA } = {}) {
  const k = layKhach(khachId);
  if (csdl().prepare(`SELECT 1 FROM don WHERE khach_id = ? AND trang_thai IN ${DON_CHUA_XONG}`).get(k.id)) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Khách còn đơn chưa xong: hủy hoặc hoàn tất đơn trước khi xóa dữ liệu.', 409);
  }
  return giaoDich((db) => {
    const hts = db.prepare('SELECT id, nguoi_fb_id FROM hoi_thoai WHERE khach_id = ?').all(k.id);
    for (const h of hts) xoaHoiThoaiTrong(db, h, lyDo);
    // F-97: bản ghi đồng ý báo live của những người Facebook này (cờ DỪNG giữ lại — bảo vệ khách không bị nhắn lại).
    for (const nf of [...new Set(hts.map((x) => x.nguoi_fb_id).filter(Boolean))]) {
      db.prepare('DELETE FROM dong_y_nhan_tin WHERE nguoi_fb_id = ?').run(nf);
      require('./anh-khach').xoaCuaNguoi(db, nf); // F-104: ảnh khách mặc thật (tệp + dòng)
    }
    db.prepare('DELETE FROM bo_nho WHERE khach_id = ?').run(k.id);
    db.prepare("UPDATE viec SET noi_dung = ?, trang_thai = CASE WHEN trang_thai = 'mo' THEN 'huy' ELSE trang_thai END WHERE khach_id = ?").run(lyDo, k.id);
    db.prepare("UPDATE don SET ten_nhan = '', sdt_nhan = NULL, dia_chi_nhan = '', ghi_chu = '' WHERE khach_id = ?").run(k.id);
    db.prepare(`UPDATE khach SET ten = '', sdt = NULL, dia_chi = '', ghi_chu = '', dong_y_luc = NULL, chieu_cao_cm = NULL, can_nang_kg = NULL, so_do_luc = NULL,
                xoa_luc = ? WHERE id = ?`).run(gio(), k.id);
    return { ok: true, hoi_thoai: hts.length };
  });
}

/**
 * F-97: xóa dữ liệu một người CHƯA có hồ sơ khách (chỉ có người Facebook — chưa cho số): nội dung tin, tên hiển thị, bộ nhớ đồng ý;
 * đơn đã xong giữ ẩn danh. Còn đơn chưa xong thì phải hủy / hoàn tất trước. Có hồ sơ khách thì dùng xoaDuLieu.
 */
function xoaDuLieuNguoi(nguoiFbId, { lyDo = DA_XOA } = {}) {
  const db = csdl();
  const n = db.prepare('SELECT * FROM nguoi_fb WHERE id = ?').get(nguoiFbId);
  if (!n) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy người này.', 404);
  const coHoSo = db.prepare('SELECT khach_id FROM hoi_thoai WHERE nguoi_fb_id = ? AND khach_id IS NOT NULL LIMIT 1').get(nguoiFbId);
  if (coHoSo) return xoaDuLieu(coHoSo.khach_id, { lyDo });
  if (db.prepare(`SELECT 1 FROM don WHERE nguoi_fb_id = ? AND trang_thai IN ${DON_CHUA_XONG}`).get(nguoiFbId)) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Người này còn đơn chưa xong: hủy hoặc hoàn tất đơn trước khi xóa dữ liệu.', 409);
  }
  return giaoDich((dbx) => {
    const hts = dbx.prepare('SELECT id, nguoi_fb_id FROM hoi_thoai WHERE nguoi_fb_id = ?').all(nguoiFbId);
    for (const h of hts) xoaHoiThoaiTrong(dbx, h, lyDo);
    dbx.prepare("UPDATE nguoi_fb SET ten_hien_thi = '', xoa_luc = ? WHERE id = ?").run(gio(), nguoiFbId);
    dbx.prepare('DELETE FROM dong_y_nhan_tin WHERE nguoi_fb_id = ?').run(nguoiFbId);
    require('./anh-khach').xoaCuaNguoi(dbx, nguoiFbId); // F-104
    dbx.prepare("UPDATE don SET ten_nhan = '', sdt_nhan = NULL, dia_chi_nhan = '', ghi_chu = '', sdt_goi_y = NULL WHERE nguoi_fb_id = ?").run(nguoiFbId);
    dbx.prepare("UPDATE viec SET noi_dung = ?, trang_thai = CASE WHEN trang_thai = 'mo' AND loai != 'xoa_du_lieu' THEN 'huy' ELSE trang_thai END WHERE hoi_thoai_id IN (SELECT id FROM hoi_thoai WHERE nguoi_fb_id = ?)").run(lyDo, nguoiFbId);
    return { ok: true, hoi_thoai: hts.length };
  });
}

/**
 * Tự xóa sau 12 tháng không liên lạc (#35 sửa): người không nhắn, không được nhắn trong 12 tháng; người còn đơn chưa xong
 * hoặc việc đang mở thì giữ. Chạy lúc khởi động và mỗi ngày.
 */
function tuXoaQuaHan(bayGio = Date.now()) {
  const moc = new Date(bayGio - NGAY_GIU_DU_LIEU * 86400000).toISOString();
  const db = csdl();
  let soKhach = 0;
  let soHt = 0;
  const ds = db.prepare(`
    SELECT k.id FROM khach k WHERE k.xoa_luc IS NULL AND k.gop_vao IS NULL AND k.tao_luc < ?
      AND COALESCE((SELECT MAX(COALESCE(h.lien_lac_cuoi_luc, h.cap_nhat_luc)) FROM hoi_thoai h WHERE h.khach_id = k.id), k.tao_luc) < ?
      AND NOT EXISTS (SELECT 1 FROM don d WHERE d.khach_id = k.id AND d.trang_thai IN ${DON_CHUA_XONG})
      AND NOT EXISTS (SELECT 1 FROM viec v WHERE v.khach_id = k.id AND v.trang_thai = 'mo')`).all(moc, moc);
  for (const k of ds) { xoaDuLieu(k.id, { lyDo: '[đã tự xóa sau 12 tháng không liên lạc]' }); soKhach += 1; }
  const hts = db.prepare(`SELECT h.id, h.nguoi_fb_id FROM hoi_thoai h JOIN nguoi_fb n ON n.id = h.nguoi_fb_id
                          WHERE h.khach_id IS NULL AND n.xoa_luc IS NULL AND COALESCE(h.lien_lac_cuoi_luc, h.cap_nhat_luc) < ?
                            AND NOT EXISTS (SELECT 1 FROM don d WHERE d.hoi_thoai_id = h.id AND d.trang_thai IN ${DON_CHUA_XONG})`).all(moc);
  if (hts.length) {
    giaoDich((d) => { for (const h of hts) xoaHoiThoaiTrong(d, h, '[đã tự xóa sau 12 tháng không liên lạc]'); });
    soHt = hts.length;
  }
  return { khach: soKhach, hoi_thoai: soHt };
}

module.exports = {
  xoaDuLieuNguoi,
  tomTatMua, sizeQuen, nhanKhach, nhanHoan, nhanHoanTu, soDo, luuSoDo, xoaSoDo, daHoiSoDo, ghiHoiSoDo,
  LOAI_VIEC, chuanSdt, hienSdt, taoKhach, suaKhach, layKhach, danhSachKhach, chiTiet,
  ghiBoNho, danhSachBoNho, suaBoNho, boBoNho,
  taoViec, layViec, suaViec, danhSachViec, viecAiDenHan,
  gopKhach, xoaDuLieu, tuXoaQuaHan,
};
