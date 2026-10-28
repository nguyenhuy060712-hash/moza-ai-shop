'use strict';

/**
 * Danh sách chờ khi hết hàng (SPEC.md F-92, P24 bước 2). Thẻ hết hàng có [🙋 Vẫn chờ] — bắt buộc bấm (bấm mới mở cửa sổ 24 giờ).
 * Chờ theo giờ bấm, tối đa 30 người mỗi phân loại, hết hạn sau 24 giờ. Hàng được trả (đơn hủy, bớt, đổi món, nhập kho, nhận hàng
 * hoàn) → `nhuongSuatTrong` chạy TRONG CÙNG giao dịch đó: tạo đơn Chờ xác nhận giữ 30 phút cho người chờ đầu (bình luận chốt mới
 * không lấy mất suất), rồi — sau khi ghi xong — MOZA gửi thẻ mời. Không bao giờ cắt suất của đơn đang giữ: suất chỉ về khi người
 * giữ trước bấm Không lấy hoặc hết giờ giữ ghi trên thẻ của họ. Lời mời không bấm trong 30 phút → tự hủy → người kế tiếp.
 * trang_thai: cho · dang_moi (đã tạo đơn, chưa gửi thẻ mời) · da_moi · da_nhan · het_han · huy.
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio } = require('./chung');

const TOI_DA = 30;
const HAN_CHO_MS = 24 * 3600e3;
const GIU_MOI_MS = 30 * 60e3;

let khiCoMoi = null;

/** Dịch vụ gửi thẻ mời đăng ký ở đây (Hộp thư tự động); gọi sau khi giao dịch ghi xong. */
function datKhiCoMoi(fn) {
  khiCoMoi = fn;
}

function baoCoMoi() {
  if (khiCoMoi) setImmediate(() => { Promise.resolve().then(khiCoMoi).catch((e) => console.error(`  [chờ hàng] gửi thẻ mời lỗi: ${e.message}`)); });
}

/** Vị trí (1, 2, …) của một người trong hàng chờ của phân loại. */
function viTriTrong(db, c) {
  return db.prepare("SELECT COUNT(*) AS n FROM cho_hang WHERE phan_loai_id = ? AND trang_thai = 'cho' AND (bam_luc < ? OR (bam_luc = ? AND rowid <= (SELECT rowid FROM cho_hang WHERE id = ?)))")
    .get(c.phan_loai_id, c.bam_luc, c.bam_luc, c.id).n;
}

/**
 * Khách bấm [🙋 Vẫn chờ]. Đã chờ rồi thì trả vị trí cũ. Còn hàng ngay lúc bấm thì nhường suất luôn.
 * @returns {{cho:object, so:number, da_co:boolean}}
 */
function them({ plId, sl = 1, nguoiFbId, hoiThoaiId, phienId = null, blId = null, dienTap = false }) {
  if (!nguoiFbId) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu người chờ.');
  return giaoDich((db) => {
    const pl = db.prepare('SELECT id FROM phan_loai WHERE id = ?').get(plId);
    if (!pl) throw new LoiNghiepVu('PHAN_LOAI_KHONG_CO', 'Không có phân loại này.');
    const cu = db.prepare("SELECT * FROM cho_hang WHERE phan_loai_id = ? AND nguoi_fb_id = ? AND trang_thai = 'cho'").get(plId, nguoiFbId);
    if (cu) return { cho: cu, so: viTriTrong(db, cu), da_co: true };
    const dem = db.prepare("SELECT COUNT(*) AS n FROM cho_hang WHERE phan_loai_id = ? AND trang_thai = 'cho'").get(plId).n;
    if (dem >= TOI_DA) throw new LoiNghiepVu('CHO_DAY', `Danh sách chờ đã đủ ${TOI_DA} người.`);
    const id = taoId('ch');
    const luc = gio();
    db.prepare(`INSERT INTO cho_hang (id, phan_loai_id, so_luong, nguoi_fb_id, hoi_thoai_id, phien_live_id, binh_luan_id, trang_thai, bam_luc, dien_tap, tao_luc)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'cho', ?, ?, ?)`)
      .run(id, plId, Math.max(1, Math.min(100, Number(sl) || 1)), nguoiFbId, hoiThoaiId, phienId || null, blId || null, luc, dienTap ? 1 : 0, luc);
    const c = db.prepare('SELECT * FROM cho_hang WHERE id = ?').get(id);
    const so = viTriTrong(db, c);
    nhuongSuatTrong(db, [plId]);
    return { cho: db.prepare('SELECT * FROM cho_hang WHERE id = ?').get(id), so, da_co: false };
  });
}

/**
 * Nhường suất cho người chờ — CHỈ gọi bên trong giao dịch đang trả hàng. Người chờ đầu (theo giờ bấm, còn trong 24 giờ) được tạo đơn
 * giữ 30 phút nếu còn bán được đủ số họ cần; người đầu cần nhiều hơn số còn thì chờ tiếp (không nhảy cóc).
 * @param {object} db
 * @param {string[]} plIds
 * @returns {number} số lời mời vừa tạo
 */
function nhuongSuatTrong(db, plIds) {
  const kho = require('./kho');
  const don = require('./don');
  const han = new Date(Date.now() - HAN_CHO_MS).toISOString();
  let moi = 0;
  for (const plId of new Set((plIds || []).filter(Boolean))) {
    db.prepare("UPDATE cho_hang SET trang_thai = 'het_han' WHERE phan_loai_id = ? AND trang_thai = 'cho' AND bam_luc <= ?").run(plId, han);
    for (let i = 0; i < TOI_DA; i++) {
      const c = db.prepare("SELECT * FROM cho_hang WHERE phan_loai_id = ? AND trang_thai = 'cho' ORDER BY bam_luc, rowid LIMIT 1").get(plId);
      if (!c) break;
      const pl = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(plId);
      const sp = db.prepare('SELECT trang_thai FROM san_pham WHERE id = ?').get(pl.san_pham_id);
      if (pl.bo || sp?.trang_thai !== 'dang_ban') break;
      if (pl.ton - kho.dangGiu(db, plId) < c.so_luong) break;
      const h = c.hoi_thoai_id ? db.prepare('SELECT page_id FROM hoi_thoai WHERE id = ?').get(c.hoi_thoai_id) : null;
      const d = don.taoDonTrong(db, {
        mon: [{ phan_loai_id: plId, so_luong: c.so_luong }], nguon: 'binh_luan_live', pageId: h?.page_id || null, nguoiFbId: c.nguoi_fb_id,
        hoiThoaiId: c.hoi_thoai_id, phienLiveId: c.phien_live_id, binhLuanId: c.binh_luan_id, dienTap: !!c.dien_tap, ghiChu: 'Suất nhường từ danh sách chờ',
      });
      db.prepare('UPDATE don SET giu_den = ? WHERE id = ?').run(new Date(Date.now() + GIU_MOI_MS).toISOString(), d.id);
      db.prepare("UPDATE cho_hang SET trang_thai = 'dang_moi', moi_luc = ?, don_id = ? WHERE id = ?").run(gio(), d.id, c.id);
      moi += 1;
    }
  }
  if (moi) baoCoMoi();
  return moi;
}

/** Đơn vừa hủy: lời mời gắn với đơn đó kết thúc (hết giờ → het_han, khách Không lấy → huy). Gọi trong giao dịch hủy. */
function ketThucMoiTrong(db, donId, { hetGio = false } = {}) {
  db.prepare("UPDATE cho_hang SET trang_thai = ? WHERE don_id = ? AND trang_thai IN ('dang_moi', 'da_moi')").run(hetGio ? 'het_han' : 'huy', donId);
}

/** Khách bấm Giữ trên thẻ mời. */
function daNhan(donId) {
  csdl().prepare("UPDATE cho_hang SET trang_thai = 'da_nhan' WHERE don_id = ? AND trang_thai IN ('dang_moi', 'da_moi')").run(donId);
}

/** Lời mời đã tạo đơn, chưa gửi thẻ. */
function canGuiMoi() {
  return csdl().prepare("SELECT * FROM cho_hang WHERE trang_thai = 'dang_moi' ORDER BY moi_luc").all();
}

function daGuiMoi(id) {
  csdl().prepare("UPDATE cho_hang SET trang_thai = 'da_moi' WHERE id = ? AND trang_thai = 'dang_moi'").run(id);
}

/** Quét mỗi phút (lưới an toàn): người chờ quá 24 giờ → het_han (không nhắn). */
function quetHetHan(bayGio = Date.now()) {
  return csdl().prepare("UPDATE cho_hang SET trang_thai = 'het_han' WHERE trang_thai = 'cho' AND bam_luc <= ?").run(new Date(bayGio - HAN_CHO_MS).toISOString()).changes;
}

/** Người hủy tay ở màn hình Đơn hàng. */
function huy(id) {
  const r = csdl().prepare("UPDATE cho_hang SET trang_thai = 'huy' WHERE id = ? AND trang_thai = 'cho'").run(id);
  if (!r.changes) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Người này không còn trong danh sách chờ.', 404);
  return { ok: true };
}

/** Buổi tập "Kết thúc & trả hàng về kho" (#87): xóa danh sách chờ diễn tập. */
function xoaDienTap() {
  return csdl().prepare("UPDATE cho_hang SET trang_thai = 'huy' WHERE dien_tap = 1 AND trang_thai IN ('cho', 'dang_moi', 'da_moi')").run().changes;
}

/**
 * Danh sách đang chờ (màn hình Đơn hàng) và tóm tắt theo phân loại ("Chờ hàng: Áo 12 Đen/M · 3 người" — Màn hình người dẫn).
 */
function danhSach({ dienTap = null } = {}) {
  const ds = csdl().prepare(`SELECT c.*, p.gt1, p.gt2, s.so, s.ten, s.danh_muc, n.ten_hien_thi AS ten_nguoi FROM cho_hang c
                             JOIN phan_loai p ON p.id = c.phan_loai_id JOIN san_pham s ON s.id = p.san_pham_id
                             LEFT JOIN nguoi_fb n ON n.id = c.nguoi_fb_id
                             WHERE c.trang_thai IN ('cho', 'dang_moi', 'da_moi') ${dienTap === null ? '' : 'AND c.dien_tap = ?'}
                             ORDER BY c.phan_loai_id, c.bam_luc`).all(...(dienTap === null ? [] : [dienTap ? 1 : 0]));
  const theo = new Map();
  for (const x of ds) {
    const t = theo.get(x.phan_loai_id) || { phan_loai_id: x.phan_loai_id, so: x.so, ten: x.ten, danh_muc: x.danh_muc, loai: x.gt2 ? `${x.gt1}/${x.gt2}` : x.gt1, so_nguoi: 0 };
    if (x.trang_thai === 'cho') t.so_nguoi += 1;
    theo.set(x.phan_loai_id, t);
  }
  return { ds, tom_tat: [...theo.values()].filter((x) => x.so_nguoi) };
}

module.exports = { TOI_DA, HAN_CHO_MS, GIU_MOI_MS, datKhiCoMoi, them, nhuongSuatTrong, ketThucMoiTrong, daNhan, canGuiMoi, daGuiMoi, quetHetHan, huy, xoaDienTap, danhSach };
