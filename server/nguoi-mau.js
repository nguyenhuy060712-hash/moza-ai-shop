'use strict';

/**
 * Số đo người mẫu nói bằng lời (SPEC.md F-82, #110) — không thêm ô nhập. Người dẫn nói / gõ "Mai ơi mẫu cao 1m60 (nặng 48) mặc S":
 *  - chiều cao, cân nặng nhớ qua các buổi (cài đặt 'nguoi_mau'); cân nặng chỉ hiện khi người dẫn đã nói, "bỏ cân nặng mẫu" để bỏ;
 *  - size đang mặc gắn với MÓN ĐANG NÓI và chỉ trong buổi; ghi nhật ký (sự kiện) để khôi phục khi khởi động lại;
 *  - "Mai ơi mẫu mặc M" chỉ đổi size; "ẩn số đo mẫu" để không hiện số đo trên hình.
 * Là nguồn "nguoi_mau" cho Bộ kiểm tra (K2/K3), dòng "Mẫu: 1m60 · mặc S" trên Thanh chữ, câu tư vấn size ("bạn mẫu 1m60 đang
 * mặc S"). Không có SQL (nhật ký qua nghiep-vu/nhat-ky-song).
 */

const caiDat = require('./nghiep-vu/cai-dat');
const sp = require('./nghiep-vu/san-pham');
const nk = require('./nghiep-vu/nhat-ky-song');
const { docSoDo } = require('./nghiep-vu/so-do');
const { boDau } = require('./nghiep-vu/chung');

const dangMacTheoPhien = new Map(); // phienId → Map(sanPhamId → co)

function nguoiMau() {
  return caiDat.doc('nguoi_mau', null) || null;
}

const gon = (s) => ` ${boDau(String(s || '')).toLowerCase().replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

/**
 * Đọc lệnh người mẫu. Phải có chữ "mẫu" đi với cao / nặng / mặc / bỏ / ẩn (không nhầm "mẫu số 12").
 * @returns {{chieu_cao?:number, can_nang?:number, co?:string, bo_can_nang?:boolean, an?:boolean, hien?:boolean}|null}
 */
function docLenh(cau) {
  const s = gon(cau).replace(/^ mai( oi)? /, ' ');
  if (/ (bo|xoa) (can nang|so can) (cua )?(ban )?mau /.test(s) || / (ban )?mau (bo|xoa) can nang /.test(s)) return { bo_can_nang: true };
  if (/ an so do (cua )?(ban )?mau /.test(s) || / (ban )?mau an so do /.test(s)) return { an: true };
  if (/ hien so do (cua )?(ban )?mau /.test(s)) return { hien: true };
  const m = / (?:ban |nguoi )?mau (?=(?:cao|nang|mac|dang mac|hom nay|minh)\b)(.*)$/.exec(s);
  if (!m) return null;
  const sau = m[1];
  const kq = {};
  const sd = docSoDo(sau);
  if (sd?.chieu_cao) kq.chieu_cao = sd.chieu_cao;
  if (sd?.can_nang) kq.can_nang = sd.can_nang;
  const co = / mac (?:size |co |sai )?(xxxl|xxl|xl|xs|s|m|l|\d{2}|free ?size) /.exec(` ${sau} `);
  if (co) kq.co = co[1].replace(/\s/g, '').toUpperCase().replace('FREESIZE', 'Freesize');
  return Object.keys(kq).length ? kq : null;
}

/** Size người mẫu đang mặc của một món trong buổi (khôi phục từ nhật ký khi vừa khởi động lại). */
function dangMac(phienId, sanPhamId) {
  if (!phienId || !sanPhamId) return null;
  let m = dangMacTheoPhien.get(phienId);
  if (!m) {
    m = new Map();
    for (const x of nk.doc(phienId).filter((y) => y.loai === 'su_kien')) {
      const r = /^Người mẫu mặc (\S+) · số (\d+)$/.exec(x.noi_dung);
      if (r) { const s = sp.layTheoSo(Number(r[2])); if (s) m.set(s.id, r[1]); }
    }
    dangMacTheoPhien.set(phienId, m);
  }
  return m.get(sanPhamId) || null;
}

/**
 * Làm theo lệnh (nếu là lệnh người mẫu). @returns {object|null} trạng thái mới, null nếu không phải lệnh người mẫu
 * @param {object} p   phiên đang live
 */
function xuLy(p, cau, phat = () => {}) {
  const l = docLenh(cau);
  if (!l) return null;
  const cu = nguoiMau() || { chieu_cao: null, can_nang: null, an_can_nang: false, an: false };
  const moi = { ...cu, luc: new Date().toISOString() };
  if (l.chieu_cao) moi.chieu_cao = l.chieu_cao;
  if (l.can_nang) { moi.can_nang = l.can_nang; moi.an_can_nang = false; }
  if (l.bo_can_nang) { moi.can_nang = null; moi.an_can_nang = true; }
  if (l.an) moi.an = true;
  if (l.hien) moi.an = false;
  caiDat.ghi('nguoi_mau', moi);
  if (l.co && p) {
    const doan = p.kich_ban?.doan?.[p.doan_hien_tai];
    const s = doan?.san_pham_id ? (() => { try { return sp.laySanPham(doan.san_pham_id); } catch { return null; } })() : null;
    if (s) {
      if (!dangMacTheoPhien.has(p.id)) dangMac(p.id, s.id);
      dangMacTheoPhien.get(p.id).set(s.id, l.co);
      nk.ghi({ phienId: p.id, loai: 'su_kien', noiDung: `Người mẫu mặc ${l.co} · số ${s.so}`, sanPhamId: s.id });
    }
  }
  const tt = trangThai(p);
  phat('live.nguoi_mau', tt);
  return tt;
}

const caoChu = (cm) => (cm >= 100 ? `1m${String(cm - 100).padStart(2, '0')}` : `${cm}cm`);

/** Dòng "Mẫu: 1m60 · mặc S" (Thanh chữ) cho một món; null nếu không có gì để hiện. */
function chuThanhChu(phienId, s) {
  const n = nguoiMau();
  const co = s ? dangMac(phienId, s.id) : null;
  if (!n || n.an || !co) return null; // chỉ hiện khi mẫu đang mặc món này
  const phan = [n.chieu_cao ? caoChu(n.chieu_cao) : '', n.can_nang && !n.an_can_nang ? `${n.can_nang}kg` : ''].filter(Boolean);
  return `Mẫu: ${[...phan, `mặc ${co}`].join(' · ')}`;
}

/** Dòng nguồn cho Bộ kiểm tra (nguồn "nguoi_mau") — mọi món trong buổi mà mẫu đang mặc. */
function dongNguon(phienId) {
  const n = nguoiMau();
  if (!n || !n.chieu_cao || !phienId) return [];
  const m = dangMacTheoPhien.get(phienId) || (dangMac(phienId, '_'), dangMacTheoPhien.get(phienId));
  return [...(m || new Map()).entries()].map(([id, co]) => {
    let s;
    try { s = sp.laySanPham(id); } catch { return null; }
    return `Người mẫu: cao ${n.chieu_cao} cm (${caoChu(n.chieu_cao)})${n.can_nang && !n.an_can_nang ? `, nặng ${n.can_nang} kg` : ''}, đang mặc size ${co} của ${sp.tenGoi(s)}`;
  }).filter(Boolean);
}

function trangThai(p) {
  const n = nguoiMau();
  const doan = p?.kich_ban?.doan?.[p.doan_hien_tai];
  const s = doan?.san_pham_id ? (() => { try { return sp.laySanPham(doan.san_pham_id); } catch { return null; } })() : null;
  return { phien_id: p?.id || null, nguoi_mau: n, dang_mac: s && p ? dangMac(p.id, s.id) : null, so: s?.so ?? null, chu: p && s ? chuThanhChu(p.id, s) : null };
}

/** Test: quên size đang mặc (giả khởi động lại). */
function quenBoNho() { dangMacTheoPhien.clear(); }

module.exports = { docLenh, xuLy, dangMac, chuThanhChu, dongNguon, trangThai, nguoiMau, caoChu, quenBoNho };
