'use strict';

/**
 * Khách mặc thật (SPEC.md F-104, P28 — TẮT mặc định, bật sau khi luật sư duyệt câu xin phép #127). Khách tự gửi ảnh trong Messenger
 * trong 30 ngày sau khi đơn được gửi → shop xin phép bằng nút (lưu nguyên văn câu xin phép, giờ bấm, tin bấm) → bấm Đồng ý thì tải
 * ảnh về ngay (địa chỉ ảnh của Facebook có hạn) → người duyệt che mặt (làm mờ trên trình duyệt, tệp gốc bị ghi đè) và chọn món →
 * Màn hình sản phẩm mẫu "Khách mặc thật" tối đa 4 ảnh đã duyệt. Khách nhắn "gỡ ảnh" → gỡ ngay, xóa tệp.
 * Không gửi ảnh khách cho AI, không nhận diện mặt, không sửa ảnh bằng AI, không kèm số đo.
 */

const fs = require('node:fs');
const path = require('node:path');
const { csdl, giaoDich, thuMucDuLieu } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio } = require('./chung');

const NGAY_SAU_DON = 30;
const GOM_MS = 2 * 60e3; // ảnh gửi trong 2 phút gom thành một lần hỏi
const TOI_DA_MAN_HINH = 4;
const CHE_MAT_MAC_DINH = 35; // % phía trên ảnh

const thuMuc = () => path.join(thuMucDuLieu(), 'anh-khach');
const TEP = /^ak_[a-z0-9]{12}\.(jpg|png|webp)$/;

function duongTep(tep) {
  if (!TEP.test(String(tep || ''))) return null;
  const f = path.join(thuMuc(), tep);
  return fs.existsSync(f) ? f : null;
}

function xoaTep(tep) {
  const f = duongTep(tep);
  if (f) { try { fs.unlinkSync(f); } catch { /* đã xóa */ } }
}

/** Đơn đã gửi / đã giao trong 30 ngày của người này (mới nhất), hoặc null. */
function donGanDay({ nguoiFbId, khachId = null, bayGio = Date.now() }) {
  const moc = new Date(bayGio - NGAY_SAU_DON * 86400e3).toISOString();
  return csdl().prepare(`SELECT d.id, MAX(l.luc) AS gui_luc FROM don d JOIN don_lich_su l ON l.don_id = d.id AND l.den = 'da_gui' AND l.da_hoan_tac = 0
      WHERE (d.nguoi_fb_id = ? OR (? IS NOT NULL AND d.khach_id = ?)) AND d.trang_thai IN ('da_gui', 'da_giao') AND l.luc >= ?
      GROUP BY d.id ORDER BY gui_luc DESC LIMIT 1`).get(nguoiFbId, khachId, khachId, moc) || null;
}

/** Món và size gợi ý khi đơn chỉ có một món. */
function monCuaDon(donId, db = csdl()) {
  const ds = db.prepare('SELECT x.san_pham_id, p.gt2 FROM don_dong x LEFT JOIN phan_loai p ON p.id = x.phan_loai_id WHERE x.don_id = ?').all(donId);
  return ds.length === 1 ? { sanPhamId: ds[0].san_pham_id, co: ds[0].gt2 || null } : { sanPhamId: null, co: null };
}

/**
 * Ghi một ảnh khách vừa gửi (chỉ khi công tắc bật và có đơn đã gửi trong 30 ngày — nơi gọi kiểm công tắc).
 * @returns {{id:string, lan_hoi:string, can_hoi:boolean}|null}  can_hoi = lần hỏi mới (gửi thẻ xin phép)
 */
function ghiAnh({ h, tin, cauXinPhep, bayGio = Date.now() }) {
  const d = donGanDay({ nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id, bayGio });
  if (!d) return null;
  return giaoDich((db) => {
    if (db.prepare('SELECT 1 FROM anh_khach WHERE tin_nhan_id = ?').get(tin.id)) return null;
    const mo = db.prepare(`SELECT lan_hoi FROM anh_khach WHERE nguoi_fb_id = ? AND hoi_luc >= ? AND dong_y_luc IS NULL AND tu_choi_luc IS NULL
        ORDER BY hoi_luc DESC LIMIT 1`).get(h.nguoi_fb_id, new Date(bayGio - GOM_MS).toISOString());
    const lanHoi = mo?.lan_hoi || taoId('lh');
    const { sanPhamId, co } = monCuaDon(d.id, db);
    const id = taoId('ak');
    const luc = new Date(bayGio).toISOString();
    db.prepare(`INSERT INTO anh_khach (id, page_id, nguoi_fb_id, khach_id, hoi_thoai_id, don_id, san_pham_id, co, tin_nhan_id, lan_hoi, cau_xin_phep, hoi_luc,
                che_mat, dien_tap, tao_luc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, h.page_id || null, h.nguoi_fb_id, h.khach_id || null, h.id, d.id, sanPhamId, co, tin.id, lanHoi, cauXinPhep, luc, CHE_MAT_MAC_DINH, h.dien_tap ? 1 : 0, luc);
    return { id, lan_hoi: lanHoi, can_hoi: !mo };
  });
}

/** Ảnh của một lần hỏi còn chờ khách trả lời, đúng người bấm. */
const choTraLoi = (lanHoi, nguoiFbId) => csdl().prepare(`SELECT a.*, t.anh_url FROM anh_khach a JOIN tin_nhan t ON t.id = a.tin_nhan_id
    WHERE a.lan_hoi = ? AND a.nguoi_fb_id = ? AND a.dong_y_luc IS NULL AND a.tu_choi_luc IS NULL AND a.go_luc IS NULL`).all(lanHoi, nguoiFbId);

/**
 * Khách bấm Đồng ý: ghi giờ bấm + tin bấm, tải ảnh về ngay. Ảnh lỗi / hết hạn → ghi lỗi, không vào hàng chờ duyệt.
 * @param {(url:string)=>Promise<Buffer>} taiAnh
 * @returns {Promise<{luu:number, loi:number}|null>}  null = không có ảnh nào đang chờ (nút cũ / không phải của người bấm)
 */
async function dongY({ lanHoi, nguoiFbId, tinId, taiAnh }) {
  const ds = choTraLoi(lanHoi, nguoiFbId);
  if (!ds.length) return null;
  fs.mkdirSync(thuMuc(), { recursive: true });
  let luu = 0;
  let loi = 0;
  for (const a of ds) {
    let tep = null;
    let chuLoi = null;
    try {
      const buf = await taiAnh(a.anh_url);
      require('./san-pham').kiemAnh(buf);
      tep = `${a.id}.${buf[0] === 0x89 ? 'png' : 'jpg'}`;
      fs.writeFileSync(path.join(thuMuc(), tep), buf);
      luu += 1;
    } catch (e) {
      chuLoi = String(e.message || 'Không tải được ảnh').slice(0, 200);
      loi += 1;
    }
    csdl().prepare('UPDATE anh_khach SET dong_y_luc = ?, tin_dong_y_id = ?, tep = ?, loi = ? WHERE id = ?').run(gio(), tinId || null, tep, chuLoi, a.id);
  }
  return { luu, loi };
}

/** Khách bấm Không: ghi lại, không tải, không lưu. */
function tuChoi({ lanHoi, nguoiFbId }) {
  const ds = choTraLoi(lanHoi, nguoiFbId);
  if (!ds.length) return 0;
  csdl().prepare('UPDATE anh_khach SET tu_choi_luc = ? WHERE lan_hoi = ? AND nguoi_fb_id = ? AND dong_y_luc IS NULL AND tu_choi_luc IS NULL').run(gio(), lanHoi, nguoiFbId);
  return ds.length;
}

function docDong(a) {
  const sp = a.san_pham_id ? (() => { try { return require('./san-pham').laySanPham(a.san_pham_id); } catch { return null; } })() : null;
  return {
    id: a.id, don_id: a.don_id, san_pham_id: a.san_pham_id, so: sp?.so ?? null, ten_sp: sp?.ten ?? null, co: a.co, che_mat: a.che_mat,
    dong_y_luc: a.dong_y_luc, duyet_luc: a.duyet_luc, cau_xin_phep: a.cau_xin_phep, dien_tap: !!a.dien_tap,
    // ?v= đổi khi duyệt: trình duyệt không dùng lại ảnh CHƯA che đã hiện cùng địa chỉ.
    url: `/api/anh-khach/${a.id}/tep?v=${encodeURIComponent(a.duyet_luc || 'cho')}`,
  };
}

/** Ảnh đã đồng ý, đã tải được, chưa duyệt, chưa gỡ. */
function choDuyet() {
  return csdl().prepare(`SELECT * FROM anh_khach WHERE dong_y_luc IS NOT NULL AND tep IS NOT NULL AND duyet_luc IS NULL AND go_luc IS NULL
      ORDER BY dong_y_luc`).all().map(docDong);
}

function daDuyet() {
  return csdl().prepare('SELECT * FROM anh_khach WHERE duyet_luc IS NOT NULL AND go_luc IS NULL AND tep IS NOT NULL ORDER BY duyet_luc DESC').all().map(docDong);
}

/**
 * Người duyệt: ảnh ĐÃ CHE MẶT (dựng bằng canvas trên trình duyệt) ghi đè tệp gốc; chọn món (bắt buộc) và size.
 * @param {string} id
 * @param {{anh:Buffer, cheMat:number, sanPhamId:string, co?:string}} o
 */
function duyet(id, { anh, cheMat, sanPhamId, co = null }) {
  const a = csdl().prepare('SELECT * FROM anh_khach WHERE id = ?').get(id);
  if (!a || a.go_luc || !a.tep || !a.dong_y_luc) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Ảnh này không còn (khách đã gỡ hoặc chưa đồng ý).', 404);
  if (a.duyet_luc) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Ảnh này đã duyệt rồi.', 409);
  const n = Number(cheMat);
  if (!Number.isInteger(n) || n < 0 || n > 60) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Phần che mặt từ 0 đến 60%.');
  const sp = require('./san-pham').laySanPham(sanPhamId); // ném lỗi nếu không có
  require('./san-pham').kiemAnh(anh);
  const tep = `${a.id}.${anh[0] === 0x89 ? 'png' : 'jpg'}`;
  fs.writeFileSync(path.join(thuMuc(), tep), anh);
  if (tep !== a.tep) xoaTep(a.tep); // tệp gốc (chưa che) không giữ lại
  csdl().prepare('UPDATE anh_khach SET tep = ?, che_mat = ?, san_pham_id = ?, co = ?, duyet_luc = ? WHERE id = ?')
    .run(tep, n, sp.id, co ? String(co).slice(0, 10) : null, gio(), id);
  return docDong(csdl().prepare('SELECT * FROM anh_khach WHERE id = ?').get(id));
}

/** Gỡ một ảnh (người bấm "Gỡ"): xóa tệp, ghi go_luc. */
function go(id) {
  const a = csdl().prepare('SELECT * FROM anh_khach WHERE id = ?').get(id);
  if (!a) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy ảnh.', 404);
  if (a.tep) xoaTep(a.tep);
  csdl().prepare('UPDATE anh_khach SET go_luc = COALESCE(go_luc, ?), tep = NULL WHERE id = ?').run(gio(), id);
  return true;
}

/** Khách nhắn "gỡ ảnh": gỡ mọi ảnh của người này (cả ảnh đang chờ hỏi). @returns {number} số ảnh đã có đồng ý bị gỡ */
function goCuaNguoi(nguoiFbId) {
  const ds = csdl().prepare('SELECT * FROM anh_khach WHERE nguoi_fb_id = ? AND go_luc IS NULL').all(nguoiFbId);
  for (const a of ds) go(a.id);
  return ds.filter((a) => a.dong_y_luc && !a.tu_choi_luc).length;
}

/** Xóa dữ liệu người (F-27 / F-97): xóa tệp và dòng. Gọi trong giao dịch của khach.js. */
function xoaCuaNguoi(db, nguoiFbId) {
  for (const a of db.prepare('SELECT tep FROM anh_khach WHERE nguoi_fb_id = ?').all(nguoiFbId)) xoaTep(a.tep);
  db.prepare('DELETE FROM anh_khach WHERE nguoi_fb_id = ?').run(nguoiFbId);
}

/** Tệp ảnh để hiện (chờ duyệt cho người duyệt, đã duyệt cho Màn hình sản phẩm); đã gỡ → null. */
function tepCua(id) {
  const a = csdl().prepare('SELECT tep, go_luc FROM anh_khach WHERE id = ?').get(id);
  return a && !a.go_luc ? duongTep(a.tep) : null;
}

/** Ảnh đã duyệt của một món cho Màn hình sản phẩm (tối đa 4, mới nhất). Buổi thật không lấy ảnh của khách diễn tập. */
function anhCuaMon(sanPhamId, { chiThat = false } = {}) {
  return csdl().prepare(`SELECT id, co, duyet_luc FROM anh_khach WHERE san_pham_id = ? AND duyet_luc IS NOT NULL AND go_luc IS NULL AND tep IS NOT NULL
      ${chiThat ? 'AND dien_tap = 0' : ''} ORDER BY duyet_luc DESC LIMIT ?`).all(sanPhamId, TOI_DA_MAN_HINH).map((a) => ({ id: a.id, co: a.co, url: `/api/anh-khach/${a.id}/tep?v=${encodeURIComponent(a.duyet_luc)}` }));
}

/** Tin này là ảnh khách đã vào luồng xin phép → không đưa cho AI (tìm mẫu theo ảnh). */
function laAnhKhach(tinId) {
  return !!csdl().prepare('SELECT 1 FROM anh_khach WHERE tin_nhan_id = ?').get(tinId);
}

module.exports = {
  ghiAnh, dongY, tuChoi, choDuyet, daDuyet, duyet, go, goCuaNguoi, xoaCuaNguoi, tepCua, anhCuaMon, laAnhKhach, donGanDay,
  NGAY_SAU_DON, GOM_MS, TOI_DA_MAN_HINH, CHE_MAT_MAC_DINH,
};
