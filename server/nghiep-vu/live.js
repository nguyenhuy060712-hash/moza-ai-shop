'use strict';

/**
 * Phiên live (SPEC.md F-19, F-20, F-37): tạo phiên từ kịch bản, gắn live, chuyển đoạn,
 * lưu bình luận, kết thúc phiên. Chỉ khối này đọc/ghi các bảng phiên live.
 *
 * Mỗi lúc chỉ có một phiên đang mở (chờ live hoặc đang live): một người vừa dẫn vừa điều khiển.
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, chuan } = require('./chung');
const kichBan = require('./kich-ban');
const sp = require('./san-pham');
const { nhanBinhLuan } = require('./nhan-binh-luan');

const CHE_DO = ['tat', 'goi_y', 'noi'];
// Độ trễ phát (F-20): bình luận người xem gõ khi thấy hình đã trễ so với máy phát. Chỉnh trong Cài đặt, mặc định 15 giây.
const caiDat = require('./cai-dat');

/**
 * Chế độ gửi lên → cách lưu. "dan" (Mai dẫn chính, bản 2.7, #47) là cách viết gọn của che_do_ai = "noi" + mai_dan = 1:
 * miệng vẫn mở như "Mai nói" (mọi chỗ kiểm "noi" giữ nguyên), MOZA cầm nhịp thêm. Chế độ khác thì mai_dan = 0.
 * "doi" (Đội AI dẫn, bản 2.9, #49) là che_do_ai = "goi_y" + doi_ai = 1: không mở miệng Live, chép lời, Director,
 * Co-host chạy như "Chỉ gợi ý", đội AI đọc lên (server/doi-ai/dan-doi.js).
 */
function chuanCheDo(cheDo, maiDan) {
  if (cheDo === 'dan') return { cheDo: 'noi', maiDan: 1, doiAi: 0 };
  if (cheDo === 'doi') return { cheDo: 'goi_y', maiDan: 0, doiAi: 1 };
  return { cheDo, maiDan: cheDo === 'noi' && maiDan ? 1 : 0, doiAi: 0 };
}

function docPhien(r) {
  return r ? { ...r, kich_ban: JSON.parse(r.kich_ban), dien_tap: r.dien_tap === 1, mai_dan: r.mai_dan === 1, doi_ai: r.doi_ai === 1 } : null;
}

function docBinhLuan(r) {
  // so_doan: số sản phẩm đoán cho bình luận — màn hình và Director gọi món bằng số (#60).
  const soDoan = r.san_pham_doan ? csdl().prepare('SELECT so FROM san_pham WHERE id = ?').get(r.san_pham_doan)?.so ?? null : null;
  return { ...r, nhan: JSON.parse(r.nhan), da_an: r.da_an === 1, so_doan: soDoan };
}

function phienDangMo() {
  return docPhien(csdl().prepare("SELECT * FROM phien_live WHERE trang_thai IN ('cho_live', 'dang_live') ORDER BY tao_luc DESC LIMIT 1").get());
}

function layPhien(id) {
  const p = docPhien(csdl().prepare('SELECT * FROM phien_live WHERE id = ?').get(id));
  if (!p) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy phiên live này.', 404);
  return p;
}

function tenMacDinh(dienTap) {
  const x = Object.fromEntries(new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `Live ${x.day}/${x.month} ${x.hour}:${x.minute}${dienTap ? ' (diễn tập)' : ''}`;
}

/**
 * Tạo phiên ở trạng thái "chờ live". Mọi sản phẩm trong kịch bản phải Đang bán (AI chỉ nói về sản phẩm Đang bán).
 * Trước M5 mọi phiên là diễn tập trên Facebook giả (#27); diễn tập không có độ trễ phát.
 */
function taoPhien({ kich_ban_id: kichBanId, che_do_ai: cheDoVao = 'goi_y', mai_dan: maiDanVao = false, dien_tap: dienTap = true } = {}) {
  const { cheDo, maiDan, doiAi } = chuanCheDo(cheDoVao, maiDanVao);
  if (!CHE_DO.includes(cheDo)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chế độ AI phải là Tắt, Chỉ gợi ý, Co-host được nói, Mai dẫn chính hoặc Đội AI dẫn.');
  if (!kichBanId) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn một kịch bản trước khi bắt đầu.');
  return giaoDich((db) => {
    const mo = phienDangMo();
    if (mo) throw new LoiNghiepVu('PHIEN_DANG_MO', `Phiên "${mo.ten}" vẫn đang mở. Kết thúc phiên đó trước.`, 409);
    const kb = kichBan.layKichBan(kichBanId);
    const khongDung = kb.doan.filter((d) => d.san_pham && d.san_pham.trang_thai !== 'dang_ban').map((d) => d.san_pham.ten_day_du);
    if (khongDung.length) {
      throw new LoiNghiepVu('SP_KHONG_BAN_DUOC',
        `${[...new Set(khongDung)].join(', ')} không "Đang bán". Sửa kịch bản hoặc đổi trạng thái sản phẩm trước khi live.`);
    }
    const luc = gio();
    const p = {
      id: taoId('pl'),
      ten: tenMacDinh(dienTap),
      che_do_ai: cheDo,
      // Miệng mặc định trong Cài đặt; đổi được giữa phiên trên Màn hình người dẫn (F-22).
      mieng: caiDat.mieng().model,
      do_tre_giay: dienTap ? 0 : caiDat.doTrePhat(),
      kich_ban_id: kb.id,
      kich_ban: { ten: kb.ten, doan: kb.doan },
      trang_thai: 'cho_live',
      tao_luc: luc,
      dien_tap: dienTap,
    };
    db.prepare(`INSERT INTO phien_live (id, ten, che_do_ai, mieng, mai_dan, doi_ai, do_tre_giay, kich_ban_id, kich_ban, doan_hien_tai, trang_thai, tao_luc, dien_tap)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'cho_live', ?, ?)`)
      .run(p.id, p.ten, p.che_do_ai, p.mieng, maiDan, doiAi, p.do_tre_giay, p.kich_ban_id, JSON.stringify(p.kich_ban), luc, dienTap ? 1 : 0);
    const ghiSp = db.prepare('INSERT OR IGNORE INTO phien_live_san_pham (phien_id, san_pham_id, phien_ban) VALUES (?, ?, ?)');
    for (const d of kb.doan) if (d.san_pham) ghiSp.run(p.id, d.san_pham.id, d.san_pham.phien_ban);
    return layPhien(p.id);
  });
}

/**
 * Đổi chế độ AI và miệng giữa phiên (F-22): "Chỉ gợi ý" ↔ "Co-host được nói" ↔ "Mai dẫn chính" (bản 2.7, #47)
 * với một trong 3 miệng. Phiên chọn "Tắt AI" từ đầu thì giữ nguyên: người dẫn đã chọn không dùng AI.
 */
function datCheDo(phienId, { che_do_ai: cheDoVao, mieng = null, mai_dan: maiDanVao = false } = {}) {
  return giaoDich((db) => {
    const p = layPhien(phienId);
    if (p.trang_thai === 'xong') throw new LoiNghiepVu('PHIEN_DA_XONG', 'Phiên này đã kết thúc.', 409);
    if (p.che_do_ai === 'tat') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Phiên này chọn "Tắt AI" từ đầu: không bật AI giữa phiên được.');
    const { cheDo, maiDan, doiAi } = chuanCheDo(cheDoVao, maiDanVao);
    if (!['goi_y', 'noi'].includes(cheDo)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chế độ phải là Chỉ gợi ý, Co-host được nói, Mai dẫn chính hoặc Đội AI dẫn.');
    const m = mieng ?? p.mieng ?? caiDat.mieng().model;
    const loaiMieng = caiDat.MAC_DINH.mieng.find((x) => x.model === m);
    if (!loaiMieng) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có lựa chọn miệng "${m}".`);
    // F-105: miệng giả chỉ cho buổi tập.
    if (loaiMieng.chi_dien_tap && !p.dien_tap && cheDo === 'noi') throw new LoiNghiepVu('MIENG_CHI_DIEN_TAP', `${loaiMieng.ten} chỉ dùng trong buổi tập (Phòng diễn tập).`);
    db.prepare('UPDATE phien_live SET che_do_ai = ?, mieng = ?, mai_dan = ?, doi_ai = ? WHERE id = ?').run(cheDo, m, maiDan, doiAi, phienId);
    return layPhien(phienId);
  });
}

/**
 * Giờ bắt đầu live (F-67, L14): theo giờ Facebook ghi (creation_time) khi hợp lý — MOZA thấy live chậm 10–30 giây, mốc giây
 * của dòng thời gian (bán sau live, cắt clip) phải theo giờ Facebook. Giờ lạ (tương lai, hoặc sớm quá 6 giờ — live tạo sẵn từ
 * trước rồi mới phát) thì lấy giờ máy.
 */
function gioBatDau(batDauFb, bayGio = Date.now()) {
  const t = batDauFb ? new Date(batDauFb).getTime() : NaN;
  if (!Number.isFinite(t) || t > bayGio + 60e3 || t < bayGio - 6 * 3600e3) return new Date(bayGio).toISOString();
  return new Date(t).toISOString();
}

/**
 * Live đã bắt đầu trên Page: gắn vào phiên, ghi đoạn đầu tiên lên dòng thời gian.
 * @param {{batDau?:string|null, videoId?:string|null, link?:string|null}} [them]  từ timLiveDangPhat (F-67)
 */
function ganLive(phienId, fbLiveId, pageId = null, { batDau = null, videoId = null, link = null } = {}) {
  return giaoDich((db) => {
    const p = layPhien(phienId);
    if (p.trang_thai !== 'cho_live') return p;
    const luc = gioBatDau(batDau);
    db.prepare(`UPDATE phien_live SET trang_thai = 'dang_live', fb_live_video_id = ?, page_id = ?, bat_dau = ?, bat_dau_fb = ?, fb_video_id = ?, fb_link = ?
                WHERE id = ?`).run(fbLiveId, pageId, luc, batDau || null, videoId || null, link || null, phienId);
    db.prepare('INSERT INTO dong_thoi_gian_san_pham (phien_id, doan, san_pham_id, tu_luc) VALUES (?, ?, ?, ?)')
      .run(phienId, p.doan_hien_tai, p.kich_ban.doan[p.doan_hien_tai]?.san_pham_id ?? null, luc);
    return layPhien(phienId);
  });
}

function doiDoan(phienId, doan) {
  return giaoDich((db) => {
    const p = layPhien(phienId);
    if (p.trang_thai === 'xong') throw new LoiNghiepVu('PHIEN_DA_XONG', 'Phiên này đã kết thúc.', 409);
    const so = Number(doan);
    if (!Number.isInteger(so) || so < 0 || so >= p.kich_ban.doan.length) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không có đoạn này trong kịch bản.');
    }
    if (so === p.doan_hien_tai) return p;
    db.prepare('UPDATE phien_live SET doan_hien_tai = ? WHERE id = ?').run(so, phienId);
    if (p.trang_thai === 'dang_live') {
      db.prepare('INSERT INTO dong_thoi_gian_san_pham (phien_id, doan, san_pham_id, tu_luc) VALUES (?, ?, ?, ?)')
        .run(phienId, so, p.kich_ban.doan[so].san_pham_id ?? null, gio());
    }
    return layPhien(phienId);
  });
}

/** Sản phẩm (id) đang nói lúc `luc` (đã lùi theo độ trễ phát) — "đoán" bình luận hỏi về món nào (F-20). */
function sanPhamTaiLuc(db, p, luc) {
  const moc = new Date(new Date(luc).getTime() - p.do_tre_giay * 1000).toISOString();
  const r = db.prepare('SELECT san_pham_id FROM dong_thoi_gian_san_pham WHERE phien_id = ? AND tu_luc <= ? ORDER BY tu_luc DESC, rowid DESC LIMIT 1')
    .get(p.id, moc);
  return r?.san_pham_id ?? null;
}

// Bình luận chỉ có số trơn đứng đầu ("12 đen M", "chốt 12"): số đó là số sản phẩm (#60).
const SO_DAU = /^\s*(?:chốt|chot|lấy|lay|đặt|dat|mua|ck|c)?\s*#?(\d{1,5})(?!\d)/iu;

/**
 * Bình luận nhắc số ("chốt 12", "áo 12 còn M không") hoặc tên của một sản phẩm trong phiên thì gắn sản phẩm đó (#60).
 * Không nhắc món nào thì trả null (nơi gọi lấy món đang nói).
 */
function sanPhamDuocNhacTrongPhien(p, noiDung) {
  const dsPhien = [...new Map(p.kich_ban.doan.filter((d) => d.san_pham).map((d) => [d.san_pham.id, d.san_pham])).values()];
  const { theoSo, theoTen } = sp.sanPhamDuocNhac(noiDung, dsPhien);
  if (theoSo.length) return theoSo[0].id;
  const dau = SO_DAU.exec(String(noiDung));
  const theoSoTron = dau && dsPhien.find((x) => x.so === Number(dau[1]));
  if (theoSoTron) return theoSoTron.id;
  return theoTen[0]?.id ?? null;
}

/**
 * Lưu một bình luận live. Trùng `fb_id` (bình luận về hai lần) thì bỏ qua, trả null.
 * Nội dung bình luận là lời người xem: lưu nguyên văn (đã chuẩn hóa NFC), không bao giờ coi là lệnh.
 */
function themBinhLuan(phienId, { fb_id: fbId, nguoi_fb_id: nguoiId = null, ten, noi_dung: noiDung, luc_fb: lucFb, an_danh: anDanh = false, la_page: laPage = false, xem_lai: xemLai = false }) {
  return giaoDich((db) => {
    const p = layPhien(phienId);
    const nd = chuan(noiDung).trim().slice(0, 2000);
    if (!fbId || !nd) return null;
    if (db.prepare('SELECT 1 FROM binh_luan_live WHERE fb_id = ?').get(fbId)) return null;
    const bl = {
      id: taoId('bl'),
      phien_id: phienId,
      fb_id: fbId,
      nguoi_fb_id: nguoiId,
      ten: chuan(ten || 'Người xem').trim().slice(0, 100),
      noi_dung: nd,
      luc_fb: lucFb || gio(),
      luc_nhan: gio(),
      // Bình luận của chính Page (câu ghim, mục lục — L8) chỉ lưu để hiện, không nhãn nào khác; bình luận ẩn danh (H22) có nhãn an_danh.
      nhan: laPage ? ['cua_page'] : [...nhanBinhLuan(nd), ...(anDanh ? ['an_danh'] : [])],
      san_pham_doan: null,
    };
    // F-94: bình luận xem lại không có mốc trong video → không đoán món theo giờ, chỉ món được nhắc rõ.
    bl.san_pham_doan = sanPhamDuocNhacTrongPhien(p, nd) ?? (xemLai ? null : sanPhamTaiLuc(db, p, bl.luc_fb));
    db.prepare(`INSERT INTO binh_luan_live (id, phien_id, fb_id, nguoi_fb_id, ten, noi_dung, luc_fb, luc_nhan, nhan, san_pham_doan)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(bl.id, bl.phien_id, bl.fb_id, bl.nguoi_fb_id, bl.ten, bl.noi_dung, bl.luc_fb, bl.luc_nhan, JSON.stringify(bl.nhan), bl.san_pham_doan);
    return docBinhLuan(db.prepare('SELECT * FROM binh_luan_live WHERE id = ?').get(bl.id));
  });
}

function layBinhLuan(id) {
  const r = csdl().prepare('SELECT * FROM binh_luan_live WHERE id = ?').get(id);
  if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy bình luận này.', 404);
  return docBinhLuan(r);
}

/** Đánh dấu bình luận đã ẩn trên Facebook và nằm chờ Tư vấn viên nhắn riêng (#19, F-17). */
function danhDauDaAn(id) {
  csdl().prepare("UPDATE binh_luan_live SET da_an = 1, xu_ly = 'cho_tu_van' WHERE id = ?").run(id);
  return layBinhLuan(id);
}

/** Bản sửa của sản phẩm lúc bắt đầu phiên: trên sóng AI dùng đúng bản này (phien_live_san_pham). */
function phienBanSanPhamTrongPhien(phienId, sanPhamId) {
  return csdl().prepare('SELECT phien_ban FROM phien_live_san_pham WHERE phien_id = ? AND san_pham_id = ?').get(phienId, sanPhamId)?.phien_ban ?? null;
}

/** id các sản phẩm trong phiên (K4: trên sóng chỉ nhắc sản phẩm trong phiên). */
function sanPhamTrongPhien(phienId) {
  return csdl().prepare('SELECT san_pham_id FROM phien_live_san_pham WHERE phien_id = ?').all(phienId).map((r) => r.san_pham_id);
}

const XU_LY = ['moi', 'da_goi_y', 'da_noi', 'cho_tu_van', 'da_tu_van', 'bo_qua', 'da_chot'];
// Nhãn cần hiểu nghĩa, do Director gắn (F-20). Nhãn theo quy tắc (câu hỏi, thông tin cá nhân) gắn lúc lưu.
// `loi_chuc` (bản 2.10, F-50): lời chúc đọc lên sóng được ở góc Lời nhắn gửi của Radio {ten_shop}.
const NHAN_DIRECTOR = ['spam', 'xuc_pham', 'lua_ai', 'loi_chuc', 'luong_lu'];

/** Thêm một nhãn Director gắn cho bình luận. Trả bình luận sau khi thêm, hoặc null nếu không đổi gì. */
function themNhan(phienId, id, nhan) {
  if (!NHAN_DIRECTOR.includes(nhan)) return null;
  const r = csdl().prepare('SELECT * FROM binh_luan_live WHERE id = ? AND phien_id = ?').get(id, phienId);
  if (!r) return null;
  const ds = JSON.parse(r.nhan);
  if (ds.includes(nhan)) return null;
  ds.push(nhan);
  csdl().prepare('UPDATE binh_luan_live SET nhan = ? WHERE id = ?').run(JSON.stringify(ds), id);
  return layBinhLuan(id);
}

/**
 * Bình luận chốt (F-53): gắn nhãn "chot"; giữ được hàng thì `xu_ly = da_chot` và gắn đơn. Director không cần giao
 * Co-host cho bình luận này.
 */
function ganChot(id, { donId = null, xuLy = 'da_chot' } = {}) {
  const r = csdl().prepare('SELECT * FROM binh_luan_live WHERE id = ?').get(id);
  if (!r) return null;
  const ds = JSON.parse(r.nhan);
  if (!ds.includes('chot')) ds.push('chot');
  csdl().prepare('UPDATE binh_luan_live SET nhan = ?, xu_ly = ?, don_id = COALESCE(?, don_id) WHERE id = ?').run(JSON.stringify(ds), xuLy, donId, id);
  return layBinhLuan(id);
}

/** Đổi cách xử lý của nhiều bình luận cùng lúc (Director gom, chuyển Tư vấn viên…). Chỉ bình luận của đúng phiên. */
function datXuLy(phienId, ids, xuLy) {
  if (!XU_LY.includes(xuLy)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Cách xử lý lạ: ${xuLy}`);
  const lenh = csdl().prepare('UPDATE binh_luan_live SET xu_ly = ? WHERE id = ? AND phien_id = ?');
  let n = 0;
  for (const id of ids || []) n += lenh.run(xuLy, id, phienId).changes;
  return n;
}

/** Ghi nhóm câu hỏi Director đã gom cho các bình luận (để báo cáo sau biết bình luận nào hỏi cùng một ý). */
function ganNhomCauHoi(phienId, ids, nhom) {
  const lenh = csdl().prepare('UPDATE binh_luan_live SET nhom_cau_hoi = ? WHERE id = ? AND phien_id = ?');
  for (const id of ids || []) lenh.run(nhom, id, phienId);
}

/** "Chờ Tư vấn viên" (F-17): bình luận chuyển cho Tư vấn viên còn trong hạn 7 ngày nhắn riêng của Meta. */
function danhSachChoTuVan(bayGio = new Date()) {
  const moc = new Date(bayGio.getTime() - 7 * 86400e3).toISOString();
  return csdl().prepare(`SELECT b.*, p.ten AS ten_phien FROM binh_luan_live b JOIN phien_live p ON p.id = b.phien_id
                         WHERE b.xu_ly = 'cho_tu_van' AND b.luc_fb >= ? ORDER BY b.luc_fb DESC`).all(moc).map(docBinhLuan);
}

function docCau(r) {
  return r ? { ...r, trich_dan: JSON.parse(r.trich_dan) } : null;
}

/** Lưu một câu AI đưa lên sóng (chế độ gợi ý: câu hiện cho người dẫn đọc). */
function themCauTrenSong({ phienId, runId = null, loai = 'cohost', cauHoi = null, so = null, noiDung, trichDan = [], trangThai = 'da_hien' }) {
  const id = taoId('cts');
  const sanPhamId = so != null ? sp.layTheoSo(so)?.id ?? null : null;
  csdl().prepare(`INSERT INTO cau_tren_song (id, phien_id, run_id, loai, cau_hoi, san_pham_id, noi_dung, trich_dan, trang_thai, luc)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, phienId, runId, loai, cauHoi, sanPhamId, chuan(noiDung), JSON.stringify(trichDan || []), trangThai, gio());
  return docCau(csdl().prepare('SELECT * FROM cau_tren_song WHERE id = ?').get(id));
}

function datTrangThaiCau(id, trangThai) {
  csdl().prepare('UPDATE cau_tren_song SET trang_thai = ? WHERE id = ?').run(trangThai, id);
}

function cauTrenSong(phienId, soLuong = 50) {
  return csdl().prepare('SELECT * FROM cau_tren_song WHERE phien_id = ? ORDER BY luc DESC, rowid DESC LIMIT ?').all(phienId, soLuong).map(docCau);
}

function binhLuanGanDay(phienId, soLuong = 50) {
  return csdl().prepare('SELECT * FROM binh_luan_live WHERE phien_id = ? ORDER BY luc_fb DESC, rowid DESC LIMIT ?')
    .all(phienId, soLuong).map(docBinhLuan);
}

function demBinhLuan(phienId) {
  const db = csdl();
  const tong = db.prepare('SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ?').get(phienId).n;
  const cauHoi = db.prepare("SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ? AND nhan LIKE '%\"cau_hoi\"%'").get(phienId).n;
  const choTuVan = db.prepare("SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ? AND xu_ly = 'cho_tu_van'").get(phienId).n;
  return { tong, cau_hoi: cauHoi, cho_tu_van: choTuVan };
}

/** Kết thúc phiên, lưu tóm tắt ngắn: thời lượng, số bình luận, các đoạn đã qua. */
function ketThucPhien(phienId, lyDo = 'Người dẫn kết thúc phiên') {
  return giaoDich((db) => {
    const p = layPhien(phienId);
    if (p.trang_thai === 'xong') return p;
    const luc = gio();
    const dem = demBinhLuan(phienId);
    const doanDaQua = new Set(db.prepare('SELECT doan FROM dong_thoi_gian_san_pham WHERE phien_id = ?').all(phienId).map((r) => r.doan)).size;
    const phut = p.bat_dau ? Math.round((new Date(luc) - new Date(p.bat_dau)) / 60000) : 0;
    const tomTat = p.bat_dau
      ? `${lyDo}. Live ${phut} phút, ${dem.tong} bình luận (${dem.cau_hoi} câu hỏi), đi qua ${doanDaQua}/${p.kich_ban.doan.length} đoạn.`
      : `${lyDo} trước khi live bắt đầu.`;
    db.prepare("UPDATE phien_live SET trang_thai = 'xong', ket_thuc = ?, tom_tat = ? WHERE id = ?").run(luc, tomTat, phienId);
    // #98: người chốt chưa bấm, chưa nhắn → giữ tới hết live + N giờ (trong lúc live tạm giữ 12 giờ).
    require('./don').rutGiuNgan(phienId, luc);
    return layPhien(phienId);
  });
}

function danhSachPhien(soLuong = 20) {
  return csdl().prepare('SELECT * FROM phien_live ORDER BY tao_luc DESC LIMIT ?').all(soLuong)
    .map((r) => ({ ...docPhien(r), dem: demBinhLuan(r.id) }));
}

/**
 * Số liệu gần đây của buổi để nhắc cách chốt đúng lúc (F-70): số người bình luận LẦN ĐẦU từ `tuNguoiMoi`; theo từng món
 * (món đoán của bình luận) từ `tuCauHoi`: số câu hỏi và số bình luận đã chốt. Không tính bình luận của chính Page.
 */
function soLieuGanDay(phienId, { tuNguoiMoi, tuCauHoi }) {
  const db = csdl();
  const nguoiMoi = db.prepare(`SELECT COUNT(*) AS n FROM (SELECT MIN(luc_nhan) AS dau FROM binh_luan_live
                                WHERE phien_id = ? AND nhan NOT LIKE '%"cua_page"%' GROUP BY COALESCE(nguoi_fb_id, fb_id)) WHERE dau >= ?`)
    .get(phienId, tuNguoiMoi).n;
  const mon = db.prepare(`SELECT san_pham_doan AS san_pham_id,
                                 SUM(CASE WHEN nhan LIKE '%"cau_hoi"%' THEN 1 ELSE 0 END) AS hoi,
                                 SUM(CASE WHEN xu_ly = 'da_chot' OR don_id IS NOT NULL THEN 1 ELSE 0 END) AS chot
                          FROM binh_luan_live WHERE phien_id = ? AND luc_nhan >= ? AND san_pham_doan IS NOT NULL
                            AND nhan NOT LIKE '%"cua_page"%' GROUP BY san_pham_doan`).all(phienId, tuCauHoi);
  const moiNhat = db.prepare('SELECT san_pham_id FROM dong_thoi_gian_san_pham WHERE phien_id = ? ORDER BY tu_luc DESC, rowid DESC LIMIT 1').get(phienId);
  return { nguoi_moi: nguoiMoi, mon, san_pham_dang_noi: moiNhat?.san_pham_id || null };
}

/** Lúc đoạn hiện tại bắt đầu (lần đổi đoạn gần nhất trong lúc live), null nếu chưa có (F-85). */
function lucDoanHienTai(phienId) {
  return csdl().prepare('SELECT tu_luc FROM dong_thoi_gian_san_pham WHERE phien_id = ? ORDER BY tu_luc DESC, rowid DESC LIMIT 1').get(phienId)?.tu_luc || null;
}

/** Một món trong buổi từ `tuLuc` (F-85 nhịp bán): số người chốt (đơn chưa hủy) và số bình luận hỏi về món đó. */
function soLieuMon(phienId, sanPhamId, tuLuc) {
  const db = csdl();
  const chot = db.prepare(`SELECT COUNT(DISTINCT d.nguoi_fb_id) AS n FROM don d JOIN don_dong x ON x.don_id = d.id
                           WHERE d.phien_live_id = ? AND x.san_pham_id = ? AND d.trang_thai <> 'da_huy' AND d.tao_luc >= ?`).get(phienId, sanPhamId, tuLuc).n;
  const hoi = db.prepare(`SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ? AND san_pham_doan = ? AND luc_nhan >= ?
                          AND nhan LIKE '%"cau_hoi"%'`).get(phienId, sanPhamId, tuLuc).n;
  return { chot, hoi };
}

/** F-86: bình luận là phiếu bình chọn — nhãn 'binh_chon', xu_ly 'bo_qua' (không vào Director, không thành câu hỏi nổi bật). */
function ganPhieuBinhChon(id) {
  const r = csdl().prepare('SELECT nhan FROM binh_luan_live WHERE id = ?').get(id);
  if (!r) return null;
  const ds = JSON.parse(r.nhan);
  if (!ds.includes('binh_chon')) ds.push('binh_chon');
  csdl().prepare("UPDATE binh_luan_live SET nhan = ?, xu_ly = 'bo_qua' WHERE id = ?").run(JSON.stringify(ds), id);
  return layBinhLuan(id);
}

module.exports = {
  lucDoanHienTai, soLieuMon, ganPhieuBinhChon,
  soLieuGanDay,
  CHE_DO, taoPhien, datCheDo, layPhien, phienDangMo, ganLive, gioBatDau, doiDoan, themBinhLuan,
  binhLuanGanDay, demBinhLuan, ketThucPhien, danhSachPhien, layBinhLuan, danhDauDaAn, phienBanSanPhamTrongPhien, sanPhamTrongPhien,
  datXuLy, ganNhomCauHoi, danhSachChoTuVan, themCauTrenSong, datTrangThaiCau, cauTrenSong, themNhan, ganChot, NHAN_DIRECTOR,
};
