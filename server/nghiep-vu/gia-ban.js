'use strict';

/**
 * Giá bán lúc này (SPEC.md F-93, #115 — "Giá live tới hết buổi", TẮT mặc định, chỉ bật sau khi luật sư xem): MỘT hàm dùng chung cho
 * giữ hàng, thẻ đơn, Bộ kiểm tra và lời Mai — để bốn chỗ không ra bốn giá.
 *  - Giá live gắn với đúng buổi (phien_live_san_pham.gia_live), đặt ở Chuẩn bị khi phiên còn Chờ live; live bắt đầu là khóa
 *    (GIA_LIVE_DA_KHOA) — lời hứa "tới hết buổi" phải đúng.
 *  - Áp cho bình luận chốt gửi trong [bắt đầu, kết thúc + độ trễ phát (tối thiểu 15 giây)]. Đơn Messenger, bình luận xem lại, món
 *    thêm sau live: giá thường. Phân loại có giá riêng giữ giá riêng.
 *  - Gợi ý 3 mức −5 / −10 / −15 % làm tròn xuống 1.000đ bằng mã (0 đồng, không gọi AI).
 */

const { csdl } = require('../db/ket-noi');
const { LoiNghiepVu } = require('./chung');
const caiDat = require('./cai-dat');

const AN_HAN_TOI_THIEU_MS = 15000;
const MUC_GOI_Y = [5, 10, 15];

const batGiaLive = () => !!caiDat.banHang().gia_live_bat;

/** Gợi ý giá live từ giá bán: [−5%, −10%, −15%] làm tròn xuống 1.000đ, bỏ mức trùng / không hợp lệ. */
function goiY(gia) {
  const ds = MUC_GOI_Y.map((m) => ({ muc: m, gia: Math.floor((gia * (100 - m)) / 100 / 1000) * 1000 })).filter((x) => x.gia > 0 && x.gia < gia);
  return ds.filter((x, i) => ds.findIndex((y) => y.gia === x.gia) === i);
}

function layPhien(db, phienId) {
  return db.prepare('SELECT id, trang_thai, bat_dau, ket_thuc, do_tre_giay FROM phien_live WHERE id = ?').get(phienId) || null;
}

/** Giá live đã đặt của một món trong buổi (null = không có, hoặc công tắc tắt). */
function giaLiveCua(phienId, spId, db = csdl()) {
  if (!phienId || !batGiaLive()) return null;
  return db.prepare('SELECT gia_live FROM phien_live_san_pham WHERE phien_id = ? AND san_pham_id = ?').get(phienId, spId)?.gia_live ?? null;
}

/** Mốc `luc` có nằm trong giờ hưởng giá live của buổi không (tới kết thúc + độ trễ phát, tối thiểu 15 giây). */
function trongGioLive(p, luc = new Date().toISOString()) {
  if (!p?.bat_dau) return false;
  const t = new Date(luc).getTime();
  if (t < new Date(p.bat_dau).getTime()) return false;
  if (!p.ket_thuc) return p.trang_thai === 'dang_live';
  return t <= new Date(p.ket_thuc).getTime() + Math.max(AN_HAN_TOI_THIEU_MS, (Number(p.do_tre_giay) || 0) * 1000);
}

/**
 * Giá bán của một phân loại lúc này.
 * @param {object} s   sản phẩm
 * @param {object|null} pl  phân loại (null = giá mẫu)
 * @param {{phienId?:string|null, luc?:string|null}} [o]  buổi và lúc bình luận chốt (theo giờ Facebook)
 * @returns {{gia:number, gia_thuong:number, la_gia_live:boolean}}
 */
function giaBanLucNay(s, pl = null, { phienId = null, luc = null, db = csdl() } = {}) {
  const thuong = pl?.gia ?? s.gia;
  const rieng = pl?.gia != null && pl.gia !== s.gia;
  if (rieng || !phienId) return { gia: thuong, gia_thuong: thuong, la_gia_live: false };
  const gl = giaLiveCua(phienId, s.id, db);
  if (gl == null || !(gl < thuong)) return { gia: thuong, gia_thuong: thuong, la_gia_live: false };
  if (!trongGioLive(layPhien(db, phienId), luc || new Date().toISOString())) return { gia: thuong, gia_thuong: thuong, la_gia_live: false };
  return { gia: gl, gia_thuong: thuong, la_gia_live: true };
}

/**
 * Đặt giá live cho một món của buổi (Chuẩn bị). `gia` = số (hoặc "259k") hoặc null để bỏ; `muc` = 5 / 10 / 15 (%).
 * @returns {{san_pham_id:string, gia_live:number|null}}
 */
function datGiaLive(phienId, spId, { gia = undefined, muc = null } = {}) {
  if (!batGiaLive()) throw new LoiNghiepVu('GIA_LIVE_TAT', 'Công tắc "Giá live" đang tắt (Cài đặt → Bán hàng).', 409);
  const db = csdl();
  const p = layPhien(db, phienId);
  if (!p) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy phiên.', 404);
  if (p.trang_thai !== 'cho_live') throw new LoiNghiepVu('GIA_LIVE_DA_KHOA', 'Giá live khóa khi live đã bắt đầu — để lời hứa "tới hết buổi" đúng.', 409);
  const r = db.prepare('SELECT 1 FROM phien_live_san_pham WHERE phien_id = ? AND san_pham_id = ?').get(phienId, spId);
  if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Món này không có trong kịch bản của buổi.', 404);
  const s = require('./san-pham').laySanPham(spId);
  let moi = null;
  if (muc != null) {
    moi = goiY(s.gia).find((x) => x.muc === Number(muc))?.gia ?? null;
    if (moi == null) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Mức giảm chọn từ danh sách (5%, 10%, 15%).');
  } else if (gia !== null && gia !== '' && gia !== undefined) {
    moi = require('./chung').docTien(gia, { ten: 'Giá live' });
    if (!(moi > 0 && moi < s.gia)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Giá live phải lớn hơn 0 và nhỏ hơn giá bán ${require('./chung').hienTien(s.gia)}.`);
  }
  db.prepare('UPDATE phien_live_san_pham SET gia_live = ? WHERE phien_id = ? AND san_pham_id = ?').run(moi, phienId, spId);
  return { san_pham_id: spId, gia_live: moi };
}

/** Các món của buổi kèm giá live đã đặt và 3 mức gợi ý (màn hình Chuẩn bị). */
function giaLiveCuaPhien(phienId) {
  const sp = require('./san-pham');
  return csdl().prepare('SELECT san_pham_id, gia_live FROM phien_live_san_pham WHERE phien_id = ?').all(phienId).map((r) => {
    let s;
    try { s = sp.laySanPham(r.san_pham_id); } catch { return null; }
    return { san_pham_id: s.id, so: s.so, ten: s.ten, gia: s.gia, gia_live: batGiaLive() ? r.gia_live : null, goi_y: goiY(s.gia) };
  }).filter(Boolean);
}

/** Dòng nguồn cho AI trên sóng (K2 trích được): "Giá live buổi này: 259.000đ (tới hết buổi)". Messenger không có dòng này. */
function dongGiaLive(phienId, spId) {
  const gl = giaLiveCua(phienId, spId);
  if (gl == null) return null;
  const db = csdl();
  const p = layPhien(db, phienId);
  if (!p || !['cho_live', 'dang_live'].includes(p.trang_thai)) return null;
  return `Giá live buổi này: ${require('./chung').hienTien(gl)} (tới hết buổi)`;
}

module.exports = { goiY, giaLiveCua, trongGioLive, giaBanLucNay, datGiaLive, giaLiveCuaPhien, dongGiaLive, AN_HAN_TOI_THIEU_MS };
