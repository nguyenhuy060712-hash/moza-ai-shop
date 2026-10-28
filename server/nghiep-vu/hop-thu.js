'use strict';

/**
 * Hộp thư (SPEC.md F-24 → F-26, F-31; mục 7 bảng nguoi_fb, hoi_thoai, tin_nhan).
 *  - Nhận sự kiện Facebook (su-kien.js) → người Facebook, hội thoại, tin nhắn. Chống nhận trùng theo `fb_id`.
 *  - Tin "vọng lại" do Page gửi: của MOZA thì bỏ (đã lưu lúc gửi); của người trên hộp thư Page → lưu là tin người gửi
 *    và AI tạm dừng ở hội thoại đó (#34, A.12 "người luôn thắng").
 *  - Tin gửi ra: một `khoa_chong_trung` → tối đa một lần gửi thật (mục 7). Không rõ đã gửi hay chưa → `khong_ro`,
 *    không tự gửi lại, vào Cần người (mục 9).
 * Mỗi hội thoại thuộc một Page (#37): Page nhận tin là Page trả lời.
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, chuan, boDau } = require('./chung');

const TRANG_THAI = ['moi', 'ai_dang_xu_ly', 'can_nguoi', 'nguoi_dang_xu_ly', 'cho_phan_hoi', 'xong', 'spam'];
const DA_XOA = '[đã xóa theo yêu cầu]';

function docHoiThoai(r) {
  if (!r) return null;
  return { ...r, nhan: JSON.parse(r.nhan || '[]'), ai_tam_dung: r.ai_tam_dung === 1, da_gioi_thieu_ai: r.da_gioi_thieu_ai === 1,
    dang_nang: r.dang_nang === 1, dien_tap: r.dien_tap === 1 };
}

function docTin(r) {
  return r ? { ...r, trich_dan: JSON.parse(r.trich_dan || '[]'), the: r.the ? JSON.parse(r.the) : null } : null;
}

function layHoiThoai(id) {
  const h = docHoiThoai(csdl().prepare('SELECT * FROM hoi_thoai WHERE id = ?').get(id));
  if (!h) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy hội thoại này.', 404);
  return h;
}

function layNguoi(id) {
  return csdl().prepare('SELECT * FROM nguoi_fb WHERE id = ?').get(id) || null;
}

/* ---------------- người Facebook ---------------- */

/** Tìm hoặc tạo người Facebook theo (Page, PSID) hoặc (Page, id người bình luận). */
function damBaoNguoi(db, { pageId, psid = null, fbUserId = null, ten = '', luc, dienTap = false }) {
  let r = null;
  if (psid) r = db.prepare('SELECT * FROM nguoi_fb WHERE page_id = ? AND psid = ?').get(pageId, psid);
  if (!r && fbUserId) r = db.prepare('SELECT * FROM nguoi_fb WHERE page_id = ? AND fb_user_id = ?').get(pageId, fbUserId);
  if (r) {
    const tenMoi = chuan(ten).trim();
    db.prepare(`UPDATE nguoi_fb SET lan_cuoi = ?, ten_hien_thi = CASE WHEN ? <> '' AND xoa_luc IS NULL THEN ? ELSE ten_hien_thi END,
                psid = COALESCE(psid, ?), fb_user_id = COALESCE(fb_user_id, ?) WHERE id = ?`)
      .run(luc, tenMoi, tenMoi, psid, fbUserId, r.id);
    return db.prepare('SELECT * FROM nguoi_fb WHERE id = ?').get(r.id);
  }
  const id = taoId('nfb');
  db.prepare('INSERT INTO nguoi_fb (id, page_id, psid, fb_user_id, ten_hien_thi, lan_dau, lan_cuoi, dien_tap) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, pageId, psid, fbUserId, chuan(ten).trim().slice(0, 200), luc, luc, dienTap ? 1 : 0);
  return db.prepare('SELECT * FROM nguoi_fb WHERE id = ?').get(id);
}

function damBaoHoiThoai(db, { pageId, kenh, threadId, nguoiId, dienTap, luc, postId = null, phienLiveId = null, sanPhamId = null }) {
  let h = db.prepare('SELECT * FROM hoi_thoai WHERE page_id = ? AND kenh = ? AND fb_thread_id = ?').get(pageId, kenh, threadId);
  if (!h) {
    const id = taoId('ht');
    // Người này đã có hồ sơ từ hội thoại khác (cùng Page) → nối luôn.
    const kh = db.prepare('SELECT khach_id FROM hoi_thoai WHERE nguoi_fb_id = ? AND khach_id IS NOT NULL LIMIT 1').get(nguoiId);
    db.prepare(`INSERT INTO hoi_thoai (id, page_id, kenh, fb_thread_id, nguoi_fb_id, khach_id, fb_post_id, phien_live_id, san_pham_goi_y,
                dien_tap, tao_luc, cap_nhat_luc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, pageId, kenh, threadId, nguoiId, kh?.khach_id ?? null, postId, phienLiveId, sanPhamId, dienTap ? 1 : 0, luc, luc);
    h = db.prepare('SELECT * FROM hoi_thoai WHERE id = ?').get(id);
  }
  return h;
}

/* ---------------- nhận sự kiện ---------------- */

/**
 * Lưu một sự kiện Facebook. Trả { hoiThoai, tinNhan, moi, loai } — `moi` = tin khách mới cần AI xử lý;
 * `nguoiTraLoi` = người vừa trả lời trên hộp thư Page (#34). Trùng thì trả { trung: true }.
 * @param {object} ev       sự kiện su-kien.js (có page_id)
 * @param {object} [o]
 * @param {string} [o.appIdMoza]   app_id của ứng dụng MOZA — tin vọng mang id này là của MOZA
 * @param {boolean} [o.dienTap]
 */
function nhanSuKien(ev, { appIdMoza = '', dienTap = false } = {}) {
  const pageId = String(ev.page_id || '');
  if (!pageId) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Sự kiện Facebook thiếu Page.');
  const luc = ev.luc || gio();
  return giaoDich((db) => {
    const fbId = ev.mid || ev.comment_id;
    if (fbId && db.prepare('SELECT 1 FROM tin_nhan WHERE fb_id = ?').get(fbId)) return { trung: true };

    // F-70: 'gioi_thieu' = người đã có hội thoại mở link m.me?ref= (messaging_referrals) — Meta mở cửa sổ 24 giờ như một tin.
    if (ev.loai === 'tin_nhan' || ev.loai === 'postback' || ev.loai === 'gioi_thieu') {
      const nguoi = damBaoNguoi(db, { pageId, psid: ev.psid, ten: ev.ten || '', luc, dienTap });
      const h = damBaoHoiThoai(db, { pageId, kenh: 'messenger', threadId: ev.psid, nguoiId: nguoi.id, dienTap, luc });
      const tinId = taoId('tn');
      db.prepare(`INSERT INTO tin_nhan (id, hoi_thoai_id, chieu, gui_boi, loai, noi_dung, fb_id, luc, anh_url)
                  VALUES (?, ?, 'vao', 'khach', 'tin', ?, ?, ?, ?)`).run(tinId, h.id, chuan(ev.noi_dung).slice(0, 5000), fbId || null, luc, ev.anh_url || null);
      // Khách nhắn lại: hội thoại đã xong / chờ phản hồi quay về "mới"; đang có người giữ thì giữ nguyên.
      const ttMoi = ['xong', 'cho_phan_hoi', 'moi', 'ai_dang_xu_ly'].includes(h.trang_thai) && !h.ai_tam_dung ? 'moi' : h.trang_thai;
      db.prepare(`UPDATE hoi_thoai SET tin_khach_cuoi_luc = ?, lien_lac_cuoi_luc = ?, cap_nhat_luc = ?, trang_thai = ?, lan_hoi_tham = 0 WHERE id = ?`)
        .run(luc, luc, gio(), ttMoi, h.id);
      return { hoiThoai: docHoiThoai(db.prepare('SELECT * FROM hoi_thoai WHERE id = ?').get(h.id)), tinNhanId: tinId, moi: true, loai: ev.loai, nguoi };
    }

    if (ev.loai === 'tin_vong') {
      // Của MOZA: đã lưu lúc gửi (theo mid ở trên) hoặc mang app_id của MOZA.
      if (appIdMoza && ev.app_id && String(ev.app_id) === String(appIdMoza)) return { trung: true };
      const nguoi = damBaoNguoi(db, { pageId, psid: ev.psid, luc, dienTap });
      const h = damBaoHoiThoai(db, { pageId, kenh: 'messenger', threadId: ev.psid, nguoiId: nguoi.id, dienTap, luc });
      db.prepare(`INSERT INTO tin_nhan (id, hoi_thoai_id, chieu, gui_boi, loai, noi_dung, fb_id, trang_thai_gui, luc)
                  VALUES (?, ?, 'ra', 'nguoi', 'tin', ?, ?, 'da_gui', ?)`).run(taoId('tn'), h.id, chuan(ev.noi_dung).slice(0, 5000), fbId || null, luc);
      // #34: người trả lời từ hộp thư Page / Meta Business Suite → AI tạm dừng ở hội thoại này.
      db.prepare("UPDATE hoi_thoai SET ai_tam_dung = 1, trang_thai = 'nguoi_dang_xu_ly', lien_lac_cuoi_luc = ?, cap_nhat_luc = ? WHERE id = ?")
        .run(luc, gio(), h.id);
      return { hoiThoai: docHoiThoai(db.prepare('SELECT * FROM hoi_thoai WHERE id = ?').get(h.id)), moi: false, nguoiTraLoi: true, loai: ev.loai };
    }

    if (ev.loai === 'binh_luan_bai') {
      const nguoi = damBaoNguoi(db, { pageId, fbUserId: ev.nguoi_id || `an_${ev.comment_id}`, ten: ev.ten, luc, dienTap });
      const h = damBaoHoiThoai(db, { pageId, kenh: 'binh_luan', threadId: `${ev.post_id}:${nguoi.id}`, nguoiId: nguoi.id, dienTap, luc, postId: ev.post_id });
      const tinId = taoId('tn');
      db.prepare(`INSERT INTO tin_nhan (id, hoi_thoai_id, chieu, gui_boi, loai, noi_dung, fb_id, fb_comment_id, luc)
                  VALUES (?, ?, 'vao', 'khach', 'binh_luan', ?, ?, ?, ?)`)
        .run(tinId, h.id, chuan(ev.noi_dung).slice(0, 5000), ev.comment_id, ev.comment_id, luc);
      const ttMoi = h.ai_tam_dung ? h.trang_thai : 'moi';
      db.prepare('UPDATE hoi_thoai SET lien_lac_cuoi_luc = ?, cap_nhat_luc = ?, trang_thai = ? WHERE id = ?').run(luc, gio(), ttMoi, h.id);
      return { hoiThoai: docHoiThoai(db.prepare('SELECT * FROM hoi_thoai WHERE id = ?').get(h.id)), tinNhanId: tinId, moi: true, loai: ev.loai, nguoi };
    }
    return { boQua: true };
  });
}

/**
 * Bình luận live "Chờ Tư vấn viên" (F-17, F-20) thành hội thoại để Tư vấn viên nhắn riêng.
 * @param {{id, fb_id, nguoi_fb_id, ten, noi_dung, luc_fb, phien_id, san_pham_doan}} bl  dòng binh_luan_live
 * @param {{page_id:string, dien_tap:boolean}} phien
 */
function tuBinhLuanLive(bl, phien) {
  const pageId = String(phien.page_id || (phien.dien_tap ? 'page_gia' : ''));
  return giaoDich((db) => {
    const trung = db.prepare('SELECT hoi_thoai_id FROM tin_nhan WHERE fb_id = ?').get(bl.fb_id);
    if (trung) return { hoiThoai: docHoiThoai(db.prepare('SELECT * FROM hoi_thoai WHERE id = ?').get(trung.hoi_thoai_id)), trung: true };
    const luc = bl.luc_fb || gio();
    const nguoi = damBaoNguoi(db, { pageId, fbUserId: bl.nguoi_fb_id || `an_${bl.fb_id}`, ten: bl.ten, luc, dienTap: phien.dien_tap });
    // san_pham_doan là id sản phẩm đoán theo bình luận (F-20).
    const sanPhamId = bl.san_pham_doan && db.prepare('SELECT 1 FROM san_pham WHERE id = ?').get(bl.san_pham_doan) ? bl.san_pham_doan : null;
    const h = damBaoHoiThoai(db, { pageId, kenh: 'binh_luan_live', threadId: bl.fb_id, nguoiId: nguoi.id, dienTap: phien.dien_tap, luc,
      phienLiveId: phien.id, sanPhamId });
    db.prepare(`INSERT INTO tin_nhan (id, hoi_thoai_id, chieu, gui_boi, loai, noi_dung, fb_id, fb_comment_id, luc)
                VALUES (?, ?, 'vao', 'khach', 'binh_luan', ?, ?, ?, ?)`).run(taoId('tn'), h.id, chuan(bl.noi_dung), bl.fb_id, bl.fb_id, luc);
    db.prepare("UPDATE hoi_thoai SET trang_thai = 'moi', lien_lac_cuoi_luc = ?, cap_nhat_luc = ? WHERE id = ?").run(luc, gio(), h.id);
    return { hoiThoai: docHoiThoai(db.prepare('SELECT * FROM hoi_thoai WHERE id = ?').get(h.id)), moi: true };
  });
}

/** Người Facebook của một bình luận live (tạo nếu chưa có) — để ghi "ẩn tên", "ngừng liên hệ" đúng người (F-66). */
function nguoiCuaBinhLuan(bl, phien) {
  const pageId = String(phien.page_id || (phien.dien_tap ? 'page_gia' : ''));
  return giaoDich((db) => damBaoNguoi(db, { pageId, fbUserId: bl.nguoi_fb_id || `an_${bl.fb_id}`, ten: bl.ten, luc: bl.luc_fb || gio(), dienTap: phien.dien_tap }));
}

/* ---------------- tin gửi ra ---------------- */

/**
 * Ghi một tin sắp gửi (trạng thái `cho`). Cùng `khoa` đã có → trả dòng cũ (chống gửi trùng: không gửi lại).
 * @returns {{tin:object, daCo:boolean}}
 */
function ghiTinRa({ hoiThoaiId, guiBoi, loai = 'tin', noiDung, khoa, runId = null, trichDan = [], fbCommentId = null, the = null }) {
  const db = csdl();
  const cu = db.prepare('SELECT * FROM tin_nhan WHERE khoa_chong_trung = ?').get(khoa);
  if (cu) return { tin: docTin(cu), daCo: true };
  const id = taoId('tn');
  db.prepare(`INSERT INTO tin_nhan (id, hoi_thoai_id, chieu, gui_boi, loai, noi_dung, fb_comment_id, khoa_chong_trung, trang_thai_gui, agent_run_id, trich_dan, the, luc)
              VALUES (?, ?, 'ra', ?, ?, ?, ?, ?, 'cho', ?, ?, ?, ?)`)
    .run(id, hoiThoaiId, guiBoi, loai, chuan(noiDung), fbCommentId, khoa, runId, JSON.stringify(trichDan || []), the ? JSON.stringify(the) : null, gio());
  return { tin: docTin(db.prepare('SELECT * FROM tin_nhan WHERE id = ?').get(id)), daCo: false };
}

function capNhatGui(tinId, { trangThai, fbId = null, loi = null }) {
  const db = csdl();
  db.prepare('UPDATE tin_nhan SET trang_thai_gui = ?, fb_id = COALESCE(?, fb_id), loi = ? WHERE id = ?').run(trangThai, fbId, loi, tinId);
  const t = docTin(db.prepare('SELECT * FROM tin_nhan WHERE id = ?').get(tinId));
  if (trangThai === 'da_gui') {
    db.prepare('UPDATE hoi_thoai SET lien_lac_cuoi_luc = ?, cap_nhat_luc = ? WHERE id = ?').run(gio(), gio(), t.hoi_thoai_id);
    // Tin của AI, hoặc tin máy soạn có câu tự nhận trợ lý AI (thẻ giữ hàng — F-68): hội thoại đã được giới thiệu.
    if (t.gui_boi === 'ai' || (t.gui_boi === 'he_thong' && /trợ lý (AI|tự động)/i.test(t.noi_dung))) db.prepare('UPDATE hoi_thoai SET da_gioi_thieu_ai = 1 WHERE id = ?').run(t.hoi_thoai_id);
  }
  return t;
}

/** Tin `cho` quá 60 giây không rõ kết quả (ví dụ tắt máy giữa lúc gửi) → `khong_ro`, Cần người, không tự gửi lại (mục 9). */
function donTinKhongRo(bayGio = Date.now()) {
  const moc = new Date(bayGio - 60000).toISOString();
  const ds = csdl().prepare("SELECT id, hoi_thoai_id FROM tin_nhan WHERE trang_thai_gui = 'cho' AND luc < ?").all(moc);
  for (const t of ds) {
    capNhatGui(t.id, { trangThai: 'khong_ro', loi: 'Không rõ Facebook đã nhận tin chưa (mất mạng hoặc tắt máy giữa lúc gửi). Không tự gửi lại.' });
    datCanNguoi(t.hoi_thoai_id, 'Một tin không rõ đã gửi được chưa — kiểm tra trên Facebook rồi quyết định gửi lại.');
  }
  return ds.length;
}

function ghiChu(hoiThoaiId, noiDung) {
  layHoiThoai(hoiThoaiId);
  const id = taoId('tn');
  csdl().prepare(`INSERT INTO tin_nhan (id, hoi_thoai_id, chieu, gui_boi, loai, noi_dung, luc) VALUES (?, ?, 'noi_bo', 'nguoi', 'ghi_chu', ?, ?)`)
    .run(id, hoiThoaiId, chuan(noiDung).slice(0, 2000), gio());
  return docTin(csdl().prepare('SELECT * FROM tin_nhan WHERE id = ?').get(id));
}

/* ---------------- trạng thái hội thoại ---------------- */

function datTrangThai(id, trangThai, { lyDo = null } = {}) {
  if (!TRANG_THAI.includes(trangThai)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Trạng thái hội thoại không hợp lệ.');
  const h = layHoiThoai(id);
  csdl().prepare('UPDATE hoi_thoai SET trang_thai = ?, ly_do_can_nguoi = ?, cap_nhat_luc = ? WHERE id = ?')
    .run(trangThai, trangThai === 'can_nguoi' ? (lyDo || h.ly_do_can_nguoi) : null, gio(), id);
  return layHoiThoai(id);
}

function datCanNguoi(id, lyDo) {
  return datTrangThai(id, 'can_nguoi', { lyDo });
}

/** Người gõ vào hội thoại → AI tạm dừng ở đó (F-26, A.12). */
function tamDungAi(id) {
  csdl().prepare("UPDATE hoi_thoai SET ai_tam_dung = 1, trang_thai = 'nguoi_dang_xu_ly', cap_nhat_luc = ? WHERE id = ?").run(gio(), id);
  return layHoiThoai(id);
}

/** "Giao lại cho AI": AI chạy tiếp; tin đầu tiên sau đó tự giới thiệu lại là trợ lý tự động (F-31). */
function giaoLaiAi(id) {
  csdl().prepare(`UPDATE hoi_thoai SET ai_tam_dung = 0, da_gioi_thieu_ai = 0, ly_do_can_nguoi = NULL,
                  trang_thai = CASE WHEN trang_thai = 'spam' THEN 'spam' ELSE 'moi' END, cap_nhat_luc = ? WHERE id = ?`).run(gio(), id);
  return layHoiThoai(id);
}

function ganNhan(id, { nhan = null, uuTien = null, sanPhamId = null } = {}) {
  const h = layHoiThoai(id);
  const moi = nhan ? [...new Set([...h.nhan, ...[].concat(nhan)])].slice(0, 20) : h.nhan;
  csdl().prepare('UPDATE hoi_thoai SET nhan = ?, uu_tien = COALESCE(?, uu_tien), san_pham_goi_y = COALESCE(?, san_pham_goi_y), cap_nhat_luc = ? WHERE id = ?')
    .run(JSON.stringify(moi), uuTien, sanPhamId, gio(), id);
  return layHoiThoai(id);
}

function datNang(id, dangNang, lyDo = null) {
  csdl().prepare('UPDATE hoi_thoai SET dang_nang = ?, luot_khong_nang = 0 WHERE id = ?').run(dangNang ? 1 : 0, id);
  return lyDo;
}

function demLuotKhongNang(id) {
  csdl().prepare('UPDATE hoi_thoai SET luot_khong_nang = luot_khong_nang + 1 WHERE id = ?').run(id);
  return layHoiThoai(id).luot_khong_nang;
}

function datTomTat(id, tomTat) {
  csdl().prepare('UPDATE hoi_thoai SET tom_tat = ?, tom_tat_den_luc = ? WHERE id = ?').run(chuan(tomTat).slice(0, 3000), gio(), id);
}

/**
 * Nhắn riêng một bình luận xong, Facebook trả PSID của người bình luận (#65): gắn PSID vào người đó, để khi khách trả lời
 * trong Messenger thì nhận ra cùng một người (đơn đã giữ, hồ sơ khách). Đã có người khác mang PSID này (khách nhắn Page từ
 * trước) → chuyển hội thoại, đơn của người đó sang, bỏ PSID ở dòng cũ.
 */
/** PSID Messenger đã gắn của một người Facebook (null nếu chưa) — để không gắn nhầm người qua link m.me (F-70). */
function psidCuaNguoi(nguoiId) {
  return csdl().prepare('SELECT psid FROM nguoi_fb WHERE id = ?').get(nguoiId)?.psid || null;
}

/** Hội thoại này đã từng nhận một nút có payload đúng như vậy chưa (nút giả mạo thì không). */
function daGuiNut(hoiThoaiId, payload) {
  return csdl().prepare("SELECT 1 FROM tin_nhan WHERE hoi_thoai_id = ? AND chieu = 'ra' AND the IS NOT NULL AND instr(the, ?) > 0 LIMIT 1")
    .get(hoiThoaiId, JSON.stringify(String(payload)).slice(1, -1)) != null;
}

function ganPsid(nguoiId, psid) {
  if (!psid) return;
  giaoDich((db) => {
    const n = db.prepare('SELECT * FROM nguoi_fb WHERE id = ?').get(nguoiId);
    if (!n || n.psid === psid) return;
    const khac = db.prepare('SELECT * FROM nguoi_fb WHERE page_id = ? AND psid = ? AND id <> ?').get(n.page_id, psid, nguoiId);
    if (khac) {
      db.prepare('UPDATE nguoi_fb SET psid = NULL WHERE id = ?').run(khac.id);
      db.prepare('UPDATE hoi_thoai SET nguoi_fb_id = ? WHERE nguoi_fb_id = ?').run(nguoiId, khac.id);
      db.prepare('UPDATE don SET nguoi_fb_id = ? WHERE nguoi_fb_id = ?').run(nguoiId, khac.id);
    }
    db.prepare('UPDATE nguoi_fb SET psid = ? WHERE id = ?').run(psid, nguoiId);
  });
}

function lienKetKhach(hoiThoaiId, khachId) {
  const h = layHoiThoai(hoiThoaiId);
  // Mọi hội thoại của cùng người Facebook đi theo cùng hồ sơ.
  csdl().prepare('UPDATE hoi_thoai SET khach_id = ? WHERE nguoi_fb_id = ?').run(khachId, h.nguoi_fb_id);
  return layHoiThoai(hoiThoaiId);
}

/* ---------------- đọc ---------------- */

function tinCuaHoiThoai(id, { gioiHan = 200 } = {}) {
  return csdl().prepare('SELECT * FROM (SELECT rowid AS thu_tu, * FROM tin_nhan WHERE hoi_thoai_id = ? ORDER BY luc DESC, rowid DESC LIMIT ?) ORDER BY luc, thu_tu')
    .all(id, gioiHan).map((r) => { const { thu_tu: _bo, ...x } = r; return docTin(x); });
}

function demTin(id) {
  return csdl().prepare("SELECT COUNT(*) AS n FROM tin_nhan WHERE hoi_thoai_id = ? AND chieu <> 'noi_bo'").get(id).n;
}

function layTin(id) {
  const t = docTin(csdl().prepare('SELECT * FROM tin_nhan WHERE id = ?').get(id));
  if (!t) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy tin nhắn này.', 404);
  return t;
}

const LOC = {
  can_nguoi: "h.trang_thai = 'can_nguoi'",
  ai: "h.trang_thai IN ('moi', 'ai_dang_xu_ly') AND h.ai_tam_dung = 0",
  nguoi: "h.trang_thai = 'nguoi_dang_xu_ly'",
  cho: "h.trang_thai = 'cho_phan_hoi'",
  xong: "h.trang_thai = 'xong'",
  spam: "h.trang_thai = 'spam'",
};

/**
 * Danh sách hội thoại cho Hộp thư (F-26): nhóm Cần người ở đầu.
 * @param {{loc?:string, pageId?:string, phienLiveId?:string, sanPhamId?:string, q?:string, dienTap?:boolean|null, gioiHan?:number}} o
 */
function danhSach({ loc = '', pageId = '', phienLiveId = '', sanPhamId = '', q = '', dienTap = null, gioiHan = 200 } = {}) {
  const dk = [];
  const ts = [];
  if (LOC[loc]) dk.push(LOC[loc]);
  if (pageId) { dk.push('h.page_id = ?'); ts.push(pageId); }
  if (phienLiveId) { dk.push('h.phien_live_id = ?'); ts.push(phienLiveId); }
  if (sanPhamId) {
    dk.push('h.san_pham_goi_y = ?');
    ts.push(sanPhamId);
  }
  if (dienTap !== null) { dk.push('h.dien_tap = ?'); ts.push(dienTap ? 1 : 0); }
  const ds = csdl().prepare(`
    SELECT h.*, n.ten_hien_thi AS ten, u.ten AS ten_khach, p.ten AS ten_page,
      (SELECT noi_dung FROM tin_nhan WHERE hoi_thoai_id = h.id AND chieu <> 'noi_bo' ORDER BY luc DESC, rowid DESC LIMIT 1) AS tin_cuoi,
      (SELECT COUNT(*) FROM tin_nhan WHERE hoi_thoai_id = h.id AND trang_thai_gui IN ('loi', 'khong_ro')) AS so_loi
    FROM hoi_thoai h JOIN nguoi_fb n ON n.id = h.nguoi_fb_id LEFT JOIN khach u ON u.id = h.khach_id LEFT JOIN fb_page p ON p.id = h.page_id
    ${dk.length ? `WHERE ${dk.join(' AND ')}` : ''}
    ORDER BY CASE h.trang_thai WHEN 'can_nguoi' THEN 0 ELSE 1 END, h.uu_tien DESC, h.cap_nhat_luc DESC LIMIT ?`).all(...ts, gioiHan)
    .map(docHoiThoai);
  const tim = boDau(q).trim();
  return tim ? ds.filter((h) => boDau(`${h.ten} ${h.ten_khach || ''} ${h.tin_cuoi || ''}`).includes(tim)) : ds;
}

function demTheoLoc({ dienTap = null } = {}) {
  const kq = {};
  for (const [k, dk] of Object.entries(LOC)) {
    const them = dienTap === null ? '' : ` AND h.dien_tap = ${dienTap ? 1 : 0}`;
    kq[k] = csdl().prepare(`SELECT COUNT(*) AS n FROM hoi_thoai h WHERE ${dk}${them}`).get().n;
  }
  return kq;
}

function demCanNguoi() {
  return csdl().prepare("SELECT COUNT(*) AS n FROM hoi_thoai WHERE trang_thai = 'can_nguoi' AND dien_tap = 0").get().n;
}

/* ---------------- tần suất (F-25, F-32, A.6) ---------------- */

/** Số tin AI đã gửi cho một hội thoại trong N phút gần nhất. */
function demTinAiGanDay(hoiThoaiId, phut) {
  const moc = new Date(Date.now() - phut * 60000).toISOString();
  return csdl().prepare("SELECT COUNT(*) AS n FROM tin_nhan WHERE hoi_thoai_id = ? AND gui_boi = 'ai' AND trang_thai_gui = 'da_gui' AND luc >= ?")
    .get(hoiThoaiId, moc).n;
}

/** Trả lời công khai gần đây của Page (cho giới hạn ≥ 20 giây cùng bài, ≤ 60 lần/giờ, không lặp y hệt trong 1 giờ). */
function traLoiCongKhaiGanDay(pageId, phut = 60) {
  const moc = new Date(Date.now() - phut * 60000).toISOString();
  return csdl().prepare(`SELECT t.noi_dung, t.luc, h.fb_post_id FROM tin_nhan t JOIN hoi_thoai h ON h.id = t.hoi_thoai_id
                         WHERE h.page_id = ? AND t.loai = 'tra_loi' AND t.trang_thai_gui IN ('cho', 'da_gui') AND t.luc >= ?`).all(pageId, moc);
}

/** Bình luận đã được nhắn riêng chưa (1 lần mỗi bình luận — F-25). */
function daNhanRieng(commentId) {
  return !!csdl().prepare("SELECT 1 FROM tin_nhan WHERE loai = 'nhan_rieng' AND fb_comment_id = ? AND trang_thai_gui IN ('cho', 'da_gui', 'khong_ro')").get(commentId);
}

/** Tin chủ động (nhắc lịch, hỏi thăm) đã gửi cho người này hôm nay (giờ Việt Nam). */
function demTinChuDongHomNay(hoiThoaiId) {
  const vn = new Date(Date.now() + 7 * 3600000);
  const dauNgay = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600000).toISOString();
  return csdl().prepare("SELECT COUNT(*) AS n FROM tin_nhan WHERE hoi_thoai_id = ? AND khoa_chong_trung LIKE 'chu_dong:%' AND luc >= ?")
    .get(hoiThoaiId, dauNgay).n;
}

/**
 * Tin gần đây của CÙNG người ở các hội thoại khác (bình luận live, bình luận bài, tin nhắn riêng) — khách chốt ở bình luận rồi
 * trả lời trong Messenger là hai hội thoại; Tư vấn viên cần thấy đoạn trước để không hỏi lại (thử AI thật 26/9/2026).
 * @returns {{kenh:string, gui_boi:string, loai:string, noi_dung:string, luc:string, san_pham_goi_y:string|null}[]} cũ → mới
 */
function tinCuaNguoiNoiKhac(hoiThoaiId, { gioiHan = 8, ngay = 7 } = {}) {
  const h = layHoiThoai(hoiThoaiId);
  if (!h.nguoi_fb_id) return [];
  return csdl().prepare(`SELECT t.gui_boi, t.loai, t.noi_dung, t.luc, h.kenh, h.san_pham_goi_y FROM tin_nhan t JOIN hoi_thoai h ON h.id = t.hoi_thoai_id
                         WHERE h.nguoi_fb_id = ? AND h.id <> ? AND t.chieu <> 'noi_bo' AND t.luc >= ?
                         ORDER BY t.luc DESC, t.rowid DESC LIMIT ?`)
    .all(h.nguoi_fb_id, h.id, new Date(Date.now() - ngay * 86400e3).toISOString(), gioiHan).reverse();
}

/** Hội thoại Messenger của một người (hội thoại của đơn trước, rồi mới nhất trước) — nhắn chủ động về đơn. */
function hoiThoaiMessengerCua({ hoiThoaiId = null, nguoiFbId = null }) {
  return csdl().prepare(`SELECT id FROM hoi_thoai WHERE kenh = 'messenger' AND (id = ? OR nguoi_fb_id = ?)
                          ORDER BY (id = ?) DESC, tin_khach_cuoi_luc DESC`).all(hoiThoaiId, nguoiFbId, hoiThoaiId).map((r) => r.id);
}

/** Bình luận thuộc bài của một live đã gắn vào phiên → phòng live xử lý, Hộp thư bỏ qua (tránh làm hai lần). */
function laBaiLive(postId) {
  const id = String(postId || '');
  if (!id) return false;
  // F-67 (H09): bình luận live về cả webhook bài đăng với post_id = {page}_{video_id} — so cả id live lẫn id video.
  return !!csdl().prepare(`SELECT 1 FROM phien_live WHERE (fb_live_video_id IS NOT NULL
                             AND (fb_live_video_id = ? OR substr(?, -length(fb_live_video_id) - 1) = '_' || fb_live_video_id))
                           OR (fb_video_id IS NOT NULL AND (fb_video_id = ? OR substr(?, -length(fb_video_id) - 1) = '_' || fb_video_id))`).get(id, id, id, id);
}

/** Hội thoại mới / chưa xong quá lâu (ví dụ phần mềm vừa bật lại) để hàng đợi nhận lại. */
function hoiThoaiCanXuLyLai(truocLuc) {
  csdl().prepare("UPDATE hoi_thoai SET trang_thai = 'moi' WHERE trang_thai = 'ai_dang_xu_ly' AND cap_nhat_luc < ?").run(truocLuc);
  return csdl().prepare("SELECT id FROM hoi_thoai WHERE trang_thai = 'moi' AND ai_tam_dung = 0 AND cap_nhat_luc < ? ORDER BY cap_nhat_luc LIMIT 50")
    .all(truocLuc).map((r) => r.id);
}

/** Người im lặng gần 24 giờ sau tin cuối của AI (F-32 hỏi thăm): còn trong cửa sổ, chưa hỏi thăm quá 3 lần. */
function canHoiTham(bayGio = Date.now()) {
  const tu = new Date(bayGio - 23 * 3600000).toISOString();
  const den = new Date(bayGio - 20 * 3600000).toISOString();
  return csdl().prepare(`SELECT h.id FROM hoi_thoai h WHERE h.kenh = 'messenger' AND h.trang_thai = 'cho_phan_hoi' AND h.ai_tam_dung = 0
      AND h.lan_hoi_tham < 3 AND h.tin_khach_cuoi_luc BETWEEN ? AND ?
      AND (SELECT gui_boi FROM tin_nhan WHERE hoi_thoai_id = h.id AND chieu <> 'noi_bo' ORDER BY luc DESC, rowid DESC LIMIT 1) IN ('ai', 'he_thong')
      AND (h.hoi_tham_luc IS NULL OR h.hoi_tham_luc < h.tin_khach_cuoi_luc)`)
    .all(tu, den).map((r) => r.id);
}

function tangHoiTham(id) {
  csdl().prepare('UPDATE hoi_thoai SET lan_hoi_tham = lan_hoi_tham + 1, hoi_tham_luc = ? WHERE id = ?').run(gio(), id);
}

/** Người này đã nhận tin tự nhận trợ lý AI ở hội thoại nào đó (bình luận nhắn riêng → Messenger là cùng một luồng chat). */
function daGioiThieuNguoi(nguoiId) {
  return !!nguoiId && !!csdl().prepare('SELECT 1 FROM hoi_thoai WHERE nguoi_fb_id = ? AND da_gioi_thieu_ai = 1 LIMIT 1').get(nguoiId);
}

function datTenNguoi(nguoiId, ten) {
  csdl().prepare("UPDATE nguoi_fb SET ten_hien_thi = ? WHERE id = ? AND ten_hien_thi = '' AND xoa_luc IS NULL").run(chuan(ten).slice(0, 200), nguoiId);
}

/** Tin lỗi đã được người bấm "Thử lại" và gửi được bằng một tin mới. */
function ghiDaThuLai(tinId) {
  csdl().prepare("UPDATE tin_nhan SET trang_thai_gui = 'da_gui', loi = 'Đã thử lại thành công (xem tin mới bên dưới).' WHERE id = ?").run(tinId);
}

module.exports = {
  daGioiThieuNguoi, datTenNguoi, ghiDaThuLai, laBaiLive, hoiThoaiCanXuLyLai, canHoiTham, tangHoiTham,
  TRANG_THAI, DA_XOA, nhanSuKien, tuBinhLuanLive, nguoiCuaBinhLuan, ghiTinRa, capNhatGui, donTinKhongRo, ghiChu,
  datTrangThai, datCanNguoi, tamDungAi, giaoLaiAi, ganNhan, datNang, demLuotKhongNang, datTomTat, lienKetKhach, ganPsid, psidCuaNguoi, daGuiNut,
  layHoiThoai, layNguoi, layTin, tinCuaHoiThoai, demTin, danhSach, demTheoLoc, demCanNguoi,
  demTinAiGanDay, traLoiCongKhaiGanDay, daNhanRieng, demTinChuDongHomNay, hoiThoaiMessengerCua, tinCuaNguoiNoiKhac,
};
