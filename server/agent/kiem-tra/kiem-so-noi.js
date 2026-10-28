'use strict';

/**
 * Soát lời nói trên sóng bằng mã (SPEC.md F-80, #108; F-105 BH9) — không gọi AI, không có SQL. Tiếng miệng Live (Mai) không qua
 * Bộ kiểm tra trước khi nói được, nên soát chữ chép lại:
 *  - `soatCau` (F-80): câu có số tiền không trùng giá món nào trong phiên, phí ship, mức miễn ship → "so"; từ cấm K11 → "tu_cam".
 *    Chỉ đánh dấu cho người xem nhật ký.
 *  - `kiemSoNoi` (F-105): so từng con số với "giá bán lúc này" của đúng món được nhắc (giá mẫu, giá riêng phân loại, giá live,
 *    giá gốc có bằng chứng, n × giá với n ≤ 5, giá + phí ship), phí ship / mức miễn ship của Cài đặt, "còn N" với còn bán được
 *    (luật K9). Hai mức: "chac" (món nói rõ trong câu, số khác mọi giá trị hợp lệ) → tự đính chính; "nghi" (không rõ món, số trùng
 *    giá món khác…) → chỉ báo người dẫn. Không đòi trích dẫn như K3. Bỏ qua cm, kg, số không đơn vị, số của sản phẩm, giờ.
 */

const sp = require('../../nghiep-vu/san-pham');
const live = require('../../nghiep-vu/live');
const caiDat = require('../../nghiep-vu/cai-dat');
const kho = require('../../nghiep-vu/kho');
const { boDau, hienTien } = require('../../nghiep-vu/chung');
const { laySo } = require('./quy-doi-so');
const { timTuCam } = require('../../nghiep-vu/tu-cam');

/** Các số tiền được nói trong phiên: giá, giá riêng, giá gốc có bằng chứng, phí ship, miễn ship từ. */
function soTienHopLe(phienId) {
  const ds = new Set();
  let ids = [];
  try { ids = live.sanPhamTrongPhien(phienId); } catch { ids = []; }
  if (!ids.length) ids = sp.mucLucDangBan().map((x) => x.id);
  for (const id of ids) {
    let s;
    try { s = sp.laySanPham(id); } catch { continue; }
    ds.add(s.gia);
    if (s.gia_goc && sp.bangChungGiaGoc?.(s)) ds.add(s.gia_goc);
    for (const p of sp.phanLoaiCua(id)) if (p.gia != null) ds.add(p.gia);
  }
  const b = caiDat.banHang();
  if (b.phi_ship != null) ds.add(b.phi_ship);
  if (b.mien_phi_tu != null) ds.add(b.mien_phi_tu);
  return ds;
}

/**
 * @param {string} cau
 * @param {{phienId:string, hopLe?:Set<number>}} o
 * @returns {string|null} "so", "tu_cam", "so,tu_cam" hoặc null
 */
function soatCau(cau, { phienId, hopLe = null }) {
  const nhan = [];
  const tien = laySo(chuanNoi(cau)).filter((x) => x.donVi === 'tien');
  if (tien.length) {
    const ok = hopLe || soTienHopLe(phienId);
    if (tien.some((x) => !ok.has(x.giaTri))) nhan.push('so');
  }
  if (timTuCam(cau).length) nhan.push('tu_cam');
  return nhan.length ? nhan.join(',') : null;
}

/* ---------------- F-105: kiểm lời Mai theo từng món ---------------- */

const SO_CHU = { 'không': 0, 'một': 1, 'mốt': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'tư': 4, 'năm': 5, 'lăm': 5, 'sáu': 6, 'bảy': 7, 'bẩy': 7, 'tám': 8, 'chín': 9 };
const CS = '(một|hai|ba|bốn|năm|sáu|bảy|bẩy|tám|chín)';
const CS_HANG = '(không|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín)';
const BAC_SAU = '(?!\\s*(?:nghìn|ngàn|k\\b|triệu|tr\\b|đồng|đ\\b|mươi|lẻ|linh))';
const SO_TU = '(?:không|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín|mười|mươi|trăm|linh|lẻ)';
const TU_GOI = '(áo|quần|váy|đầm|chân váy|túi|giày|dép|số|mẫu|món|mã)';

/**
 * Chuẩn lời nói trước khi đọc số:
 *  - cách nói tắt giá (kiểu nói bán hàng, đơn vị nghìn ngầm hiểu): "trăm năm chín" = 159.000đ, "hai trăm tám chín" = 289.000đ,
 *    "trăm rưỡi" = 150.000đ, "hai trăm tư" = 240.000đ;
 *  - số sản phẩm đọc bằng chữ: "áo số mười hai" → "áo số 12".
 */
function chuanNoi(cau) {
  let s = String(cau ?? '').normalize('NFC');
  const v = (w) => SO_CHU[String(w).toLowerCase()];
  // "mười hai trăm rưỡi" = (số) 12 + trăm rưỡi: chữ số đứng sau "mười / mươi" không làm hàng trăm.
  const LB = '(?<!(?:mười|mươi)\\s+)';
  s = s.replace(new RegExp(`(?<![\\p{L}])(?:${LB}${CS}\\s+)?trăm\\s+rưỡi(?![\\p{L}])${BAC_SAU}`, 'giu'), (_, a) => ` ${(a ? v(a) : 1) * 100 + 50} nghìn `);
  s = s.replace(new RegExp(`(?<![\\p{L}])(?:${LB}${CS}\\s+)?trăm\\s+${CS_HANG}\\s+${CS_HANG}(?![\\p{L}])${BAC_SAU}`, 'giu'),
    (_, a, b, c) => ` ${(a ? v(a) : 1) * 100 + v(b) * 10 + v(c)} nghìn `);
  s = s.replace(new RegExp(`(?<![\\p{L}])${LB}${CS}\\s+trăm\\s+${CS_HANG}(?![\\p{L}])(?!\\s+${SO_TU}(?![\\p{L}]))${BAC_SAU}`, 'giu'),
    (_, a, b) => ` ${v(a) * 100 + v(b) * 10} nghìn `);
  // "áo số mười hai", "số bảy" → chữ số (chỉ khi sau đó không phải bậc tiền: "áo năm trăm nghìn" không phải áo số 500).
  s = s.replace(new RegExp(`(?<![\\p{L}])${TU_GOI}(\\s+số)?\\s+((?:${SO_TU}\\s*){1,4})(?![\\p{L}])${BAC_SAU}`, 'giu'), (m, goi, so, chu) => {
    const x = laySo(chu).find((y) => y.donVi == null);
    return x && Number.isInteger(x.giaTri) && x.giaTri > 0 && x.giaTri < 1000 ? `${goi}${so || ''} ${x.giaTri} ` : m;
  });
  return s;
}

function dsPhien(phienId) {
  let ids = [];
  try { ids = live.sanPhamTrongPhien(phienId); } catch { ids = []; }
  const ds = (ids.length ? ids : sp.mucLucDangBan().map((x) => x.id)).map((id) => { try { return sp.laySanPham(id); } catch { return null; } }).filter(Boolean);
  return ds;
}

/** Mọi số tiền hợp lệ khi nói về một món. */
function giaHopLe(s, { phienId, ship }) {
  const ds = new Set();
  const gs = new Set();
  for (const p of [null, ...sp.phanLoaiCua(s.id)]) {
    const g = require('../../nghiep-vu/gia-ban').giaBanLucNay(s, p, { phienId });
    gs.add(g.gia);
    gs.add(g.gia_thuong);
  }
  if (s.gia_goc && sp.bangChungGiaGoc?.(s)) ds.add(s.gia_goc);
  for (const g of gs) {
    for (let n = 1; n <= 5; n++) {
      ds.add(g * n);
      if (ship != null) ds.add(g * n + ship);
    }
  }
  return { ds, gia: [...gs] };
}

// K9 dùng chung với Bộ kiểm tra (kiem-tra.js): cùng một luật cho câu AI viết và lời Mai nói.
const { KHAN_HIEM, CON_SO, boGoiSo } = require('./kiem-tra');
const SHIP = /(ship|van chuyen|phi giao|tien giao)/;
const MIEN_SHIP = /(mien (phi )?(ship|van chuyen)|free ?ship|freeship)[^.?!]{0,25}$/;

/** Còn bán được của các ô được nhắc (theo màu / cỡ nếu câu có nói), như K9. */
function conCuaMon(s, khongDau) {
  const coTu = (x) => x && new RegExp(`(?<![a-z0-9])${boDau(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(khongDau);
  const ds = kho.conHang(s.id);
  const t1 = ds.filter((p) => coTu(p.gt1));
  const b1 = t1.length ? t1 : ds;
  const t2 = b1.filter((p) => coTu(p.gt2));
  return t2.length ? t2 : b1;
}

/**
 * @param {string} cau  một câu (đã trọn) Mai vừa nói
 * @param {{phienId:string, soDangNoi?:number|null}} o
 * @returns {{loai:'gia'|'ship'|'con'|'khan_hiem', muc:'chac'|'nghi', san_pham_id:string|null, so:number|null, noi:number, dung:number|null,
 *   dung_chu:string, chu:string}[]}
 */
function kiemSoNoi(cau, { phienId, soDangNoi = null } = {}) {
  const c = chuanNoi(cau);
  const ds = dsPhien(phienId);
  const b = caiDat.banHang();
  const ship = b.phi_ship ?? null;
  const { theoSo, theoTen } = sp.sanPhamDuocNhac(c, ds);
  const ro = [...new Map([...theoSo, ...theoTen].map((x) => [x.id, x])).values()];
  const dangNoi = soDangNoi != null ? ds.find((x) => x.so === soDangNoi) || null : null;
  const mon = ro.length === 1 ? ro[0] : ro.length === 0 ? dangNoi : null;
  const monRo = ro.length === 1;
  const hl = mon ? giaHopLe(mon, { phienId, ship }) : null;
  const khac = new Set(ds.filter((x) => x.id !== mon?.id).flatMap((x) => [...giaHopLe(x, { phienId, ship }).ds]));
  const chung = new Set([ship, b.mien_phi_tu].filter((x) => x != null));
  const loi = [];
  const them = (x) => { if (!loi.some((y) => y.loai === x.loai && y.noi === x.noi)) loi.push(x); };
  // "áo số 12 đồng giá 159k": cụm gọi món không phải con số ("12 đồng").
  const tu = boGoiSo(c).normalize('NFC');
  for (const x of laySo(tu).filter((y) => y.donVi === 'tien')) {
    // Ngữ cảnh ngay trước số (khoảng 30 ký tự): "phí ship 25k", "miễn ship từ 400k".
    const vt = boDau(tu).indexOf(boDau(x.chu.split(' ')[0]));
    const truoc = boDau(tu).slice(Math.max(0, (vt < 0 ? 0 : vt) - 32), vt < 0 ? 0 : vt);
    if (MIEN_SHIP.test(truoc)) {
      if (b.mien_phi_tu != null && x.giaTri !== b.mien_phi_tu) {
        them({ loai: 'ship', muc: 'chac', san_pham_id: null, so: null, noi: x.giaTri, dung: b.mien_phi_tu, dung_chu: `miễn ship cho đơn từ ${hienTien(b.mien_phi_tu)}`, chu: x.chu });
      } else if (b.mien_phi_tu == null) {
        them({ loai: 'ship', muc: 'nghi', san_pham_id: null, so: null, noi: x.giaTri, dung: null, dung_chu: 'shop chưa đặt mức miễn ship', chu: x.chu });
      }
      continue;
    }
    if (SHIP.test(truoc.slice(-18))) {
      if (ship != null && x.giaTri !== ship && !(hl?.ds.has(x.giaTri))) {
        them({ loai: 'ship', muc: 'chac', san_pham_id: null, so: null, noi: x.giaTri, dung: ship, dung_chu: `phí ship ${hienTien(ship)}`, chu: x.chu });
      } else if (ship == null) {
        them({ loai: 'ship', muc: 'nghi', san_pham_id: null, so: null, noi: x.giaTri, dung: null, dung_chu: 'shop chưa đặt phí ship', chu: x.chu });
      }
      continue;
    }
    if (chung.has(x.giaTri)) continue;
    if (mon) {
      if (hl.ds.has(x.giaTri)) continue;
      const g = require('../../nghiep-vu/gia-ban').giaBanLucNay(mon, null, { phienId }).gia;
      // Số trùng giá món khác (câu so sánh), hoặc món chỉ đoán theo đoạn đang nói → nghi.
      const muc = monRo && !khac.has(x.giaTri) ? 'chac' : 'nghi';
      them({ loai: 'gia', muc, san_pham_id: mon.id, so: mon.so, noi: x.giaTri, dung: g, dung_chu: `${sp.tenGoi(mon)} giá ${hienTien(g)}`, chu: x.chu });
    } else if (!khac.has(x.giaTri)) {
      them({ loai: 'gia', muc: 'nghi', san_pham_id: null, so: null, noi: x.giaTri, dung: null, dung_chu: 'không rõ món', chu: x.chu });
    }
  }
  // "còn N" và lời khan hiếm (K9) — chỉ khi biết món.
  if (mon) {
    const kd = boDau(tu);
    const o = conCuaMon(mon, kd);
    const con = o.map((p) => p.con_ban_duoc);
    const chuCon = o.filter((p) => p.con_ban_duoc > 0).slice(0, 3).map((p) => `${sp.nhanPl(p)} còn ${p.con_ban_duoc}`).join(', ') || 'đã hết';
    for (const m of kd.matchAll(CON_SO)) {
      const n = Number(m[1]);
      if (!con.includes(n)) them({ loai: 'con', muc: monRo ? 'chac' : 'nghi', san_pham_id: mon.id, so: mon.so, noi: n, dung: Math.max(0, ...con), dung_chu: `${sp.tenGoi(mon)}: ${chuCon}`, chu: m[0] });
    }
    if (KHAN_HIEM.test(kd)) {
      const nguong = b.nguong_sap_het;
      if (!con.some((n) => n > 0 && n <= nguong)) them({ loai: 'khan_hiem', muc: 'nghi', san_pham_id: mon.id, so: mon.so, noi: 0, dung: null, dung_chu: `${sp.tenGoi(mon)}: ${chuCon}`, chu: 'sắp hết' });
    }
  }
  return loi;
}

/** Câu đính chính Mai nói (máy điền) và dòng trên Thanh chữ. */
function cauDinhChinh(l) {
  const mau = require('../../cau-hinh/mac-dinh.json').kiem_loi_noi || {};
  const dien = (t) => String(t).replace('{dung}', l.dung_chu);
  const hoaDau = l.dung_chu.charAt(0).toUpperCase() + l.dung_chu.slice(1);
  return { noi: dien(mau.cau_noi || 'Mai xin nói lại cho đúng: {dung}.'), thanh_chu: String(mau.cau_thanh_chu || 'Đính chính: {dung}').replace('{dung}', hoaDau) };
}

module.exports = { soatCau, soTienHopLe, kiemSoNoi, chuanNoi, cauDinhChinh };
