'use strict';

/**
 * Báo cáo bán hàng (SPEC.md F-58): theo buổi live, theo ngày, theo sản phẩm —
 * bình luận → bình luận chốt → đơn chờ xác nhận → đã xác nhận → đã gửi → đã giao / hoàn / hủy;
 * doanh số (tổng tiền đơn đã xác nhận trở lên, trừ hủy); lãi gộp (tiền hàng − giá vốn chụp trên dòng đơn; dòng chưa có
 * giá vốn thì phần đó ghi "chưa tính"); sản phẩm bán chạy; tỷ lệ hoàn; chi phí AI của buổi live.
 * **Không tính dữ liệu Phòng diễn tập** — trừ khi xem riêng "Buổi tập" (`dienTap: true`, #87): khi đó CHỈ tính dữ liệu diễn tập.
 * Xóa dữ liệu khách không đổi con số (đơn giữ lại dạng ẩn danh — F-54).
 */

const { csdl } = require('../db/ket-noi');

// Đơn được tính doanh số: đã xác nhận trở lên, trừ hủy (hoàn vẫn tính đơn nhưng báo tỷ lệ hoàn riêng).
const TINH_DOANH_SO = "('da_xac_nhan', 'da_gui', 'da_giao', 'hoan')";

/** Khoảng thời gian (ISO, UTC). Không truyền thì lấy toàn bộ. */
function khoang(tu, den) {
  return { tu: tu ? new Date(tu).toISOString() : '0000', den: den ? new Date(den).toISOString() : '9999' };
}

/**
 * Đếm đơn theo trạng thái, doanh số, lãi gộp cho một tập đơn (điều kiện SQL trên bảng `don d`).
 * @returns {{don:number, cho_xac_nhan:number, da_xac_nhan:number, da_gui:number, da_giao:number, hoan:number, da_huy:number,
 *   doanh_so:number, tien_hang:number, lai_gop:number, chua_tinh_von:number, ty_le_hoan:number|null}}
 */
function demDon(dk, ts, dienTap = false) {
  const dt = dienTap ? 1 : 0;
  const db = csdl();
  const kq = { don: 0, cho_xac_nhan: 0, da_xac_nhan: 0, da_gui: 0, da_giao: 0, hoan: 0, da_huy: 0 };
  for (const r of db.prepare(`SELECT d.trang_thai, COUNT(*) AS n FROM don d WHERE d.dien_tap = ${dt} AND ${dk} GROUP BY d.trang_thai`).all(...ts)) {
    kq[r.trang_thai] = r.n;
    kq.don += r.n;
  }
  const t = db.prepare(`SELECT COALESCE(SUM(d.tong_tien), 0) AS doanh_so FROM don d
                        WHERE d.dien_tap = ${dt} AND d.trang_thai IN ${TINH_DOANH_SO} AND ${dk}`).get(...ts);
  const h = db.prepare(`SELECT COALESCE(SUM(x.so_luong * x.don_gia), 0) AS tien_hang,
                               COALESCE(SUM(CASE WHEN x.gia_von_chup IS NOT NULL THEN x.so_luong * (x.don_gia - x.gia_von_chup) END), 0) AS lai,
                               COALESCE(SUM(CASE WHEN x.gia_von_chup IS NULL THEN x.so_luong * x.don_gia END), 0) AS chua_tinh
                        FROM don_dong x JOIN don d ON d.id = x.don_id
                        WHERE d.dien_tap = ${dt} AND d.trang_thai IN ${TINH_DOANH_SO} AND ${dk}`).get(...ts);
  const daGui = kq.da_gui + kq.da_giao + kq.hoan;
  return {
    ...kq, doanh_so: t.doanh_so, tien_hang: h.tien_hang, lai_gop: h.lai, chua_tinh_von: h.chua_tinh,
    ty_le_hoan: daGui ? Math.round((kq.hoan / daGui) * 1000) / 10 : null,
  };
}

/** Theo buổi live thật, trong khoảng thời gian bắt đầu phiên. */
function theoPhien({ tu = null, den = null, dienTap = false } = {}) {
  const k = khoang(tu, den);
  const dt = dienTap ? 1 : 0;
  const db = csdl();
  return db.prepare(`SELECT id, ten, bat_dau, ket_thuc, page_id FROM phien_live WHERE dien_tap = ${dt} AND bat_dau IS NOT NULL
                     AND bat_dau >= ? AND bat_dau < ? ORDER BY bat_dau DESC`).all(k.tu, k.den).map((p) => ({
    ...p,
    binh_luan: db.prepare('SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ?').get(p.id).n,
    binh_luan_chot: db.prepare("SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ? AND (xu_ly = 'da_chot' OR nhan LIKE '%\"chot\"%')").get(p.id).n,
    ...demDon('d.phien_live_id = ?', [p.id], dienTap),
    chi_phi_ai_usd: db.prepare('SELECT COALESCE(SUM(chi_phi_usd), 0) AS n FROM agent_run WHERE phien_live_id = ?').get(p.id).n,
    // F-94: đơn chốt trên video xem lại (bình luận sau giờ kết thúc + 15 giây), không tính đơn đã hủy.
    chot_sau_live: p.ket_thuc ? db.prepare(`SELECT COUNT(DISTINCT d.id) AS n FROM don d JOIN binh_luan_live b ON b.don_id = d.id
      WHERE d.phien_live_id = ? AND d.trang_thai != 'da_huy' AND b.luc_fb > ?`).get(p.id, new Date(new Date(p.ket_thuc).getTime() + 15000).toISOString()).n : 0,
    muc_luc_luc: db.prepare('SELECT muc_luc_luc FROM phien_live WHERE id = ?').get(p.id).muc_luc_luc,
  }));
}

/** Theo ngày (giờ Việt Nam) theo lúc tạo đơn. */
function theoNgay({ tu = null, den = null, dienTap = false } = {}) {
  const k = khoang(tu, den);
  const dt = dienTap ? 1 : 0;
  const ngay = csdl().prepare(`SELECT DISTINCT date(tao_luc, '+7 hours') AS ngay FROM don WHERE dien_tap = ${dt} AND tao_luc >= ? AND tao_luc < ?
                               ORDER BY ngay DESC`).all(k.tu, k.den).map((r) => r.ngay);
  return ngay.map((n) => ({ ngay: n, ...demDon("date(d.tao_luc, '+7 hours') = ?", [n], dienTap) }));
}

/** Theo sản phẩm: số chiếc bán, tiền hàng, lãi gộp; sắp theo tiền hàng (sản phẩm bán chạy). */
function theoSanPham({ tu = null, den = null, dienTap = false } = {}) {
  const k = khoang(tu, den);
  const dt = dienTap ? 1 : 0;
  return csdl().prepare(`
    SELECT s.id, s.so, s.ten,
      SUM(x.so_luong) AS so_chiec,
      SUM(x.so_luong * x.don_gia) AS tien_hang,
      SUM(CASE WHEN x.gia_von_chup IS NOT NULL THEN x.so_luong * (x.don_gia - x.gia_von_chup) END) AS lai_gop,
      SUM(CASE WHEN x.gia_von_chup IS NULL THEN 1 ELSE 0 END) AS dong_chua_tinh_von,
      SUM(CASE WHEN d.trang_thai = 'hoan' THEN x.so_luong ELSE 0 END) AS so_chiec_hoan
    FROM don_dong x JOIN don d ON d.id = x.don_id JOIN san_pham s ON s.id = x.san_pham_id
    WHERE d.dien_tap = ${dt} AND d.trang_thai IN ${TINH_DOANH_SO} AND d.tao_luc >= ? AND d.tao_luc < ?
    GROUP BY s.id ORDER BY tien_hang DESC`).all(k.tu, k.den);
}

/** Toàn bộ báo cáo cho màn hình Báo cáo. */
function baoCao({ tu = null, den = null, dienTap = false } = {}) {
  const k = khoang(tu, den);
  return {
    dien_tap: !!dienTap,
    tong: demDon('d.tao_luc >= ? AND d.tao_luc < ?', [k.tu, k.den], dienTap),
    theo_phien: theoPhien({ tu, den, dienTap }),
    theo_ngay: theoNgay({ tu, den, dienTap }),
    theo_san_pham: theoSanPham({ tu, den, dienTap }),
    // Chi phí AI trong khoảng (buổi tập: chỉ lượt AI của diễn tập).
    chi_phi_ai_usd: csdl().prepare('SELECT COALESCE(SUM(chi_phi_usd), 0) AS n FROM agent_run WHERE dien_tap = ? AND bat_dau >= ? AND bat_dau < ?')
      .get(dienTap ? 1 : 0, k.tu, k.den).n,
  };
}

/** Hiệu quả Agent (màn hình Báo cáo): số lần chạy, lỗi, chi phí, 👍/👎 — không tính diễn tập. */
function hieuQuaAgent({ tu = null, den = null } = {}) {
  const k = khoang(tu, den);
  return csdl().prepare(`SELECT r.agent_id, COUNT(*) AS so_lan, SUM(CASE WHEN r.loi IS NOT NULL THEN 1 ELSE 0 END) AS so_loi,
      COALESCE(SUM(r.chi_phi_usd), 0) AS usd, SUM(CASE WHEN r.ly_do_nang IS NOT NULL THEN 1 ELSE 0 END) AS so_lan_nang,
      (SELECT COUNT(*) FROM danh_gia d JOIN agent_run r2 ON r2.id = d.run_id WHERE r2.agent_id = r.agent_id AND d.diem = 'tot' AND r2.dien_tap = 0) AS tot,
      (SELECT COUNT(*) FROM danh_gia d JOIN agent_run r2 ON r2.id = d.run_id WHERE r2.agent_id = r.agent_id AND d.diem = 'xau' AND r2.dien_tap = 0) AS xau
    FROM agent_run r WHERE r.dien_tap = 0 AND r.bat_dau >= ? AND r.bat_dau < ? GROUP BY r.agent_id ORDER BY usd DESC`).all(k.tu, k.den);
}

/**
 * Số NGƯỜI khác nhau đã chốt một món trong buổi (F-83, #111): đơn nguồn bình luận live của phiên, chứa món đó, chưa hủy, cùng
 * loại (tập / thật) với phiên — buổi tập không bao giờ cộng vào buổi thật. Không có món → mọi món.
 */
function demNguoiChot(phienId, sanPhamId = null) {
  return csdl().prepare(`SELECT COUNT(DISTINCT d.nguoi_fb_id) AS n FROM don d JOIN phien_live p ON p.id = d.phien_live_id
                          WHERE d.phien_live_id = ? AND d.nguon = 'binh_luan_live' AND d.trang_thai <> 'da_huy' AND d.dien_tap = p.dien_tap
                            AND d.nguoi_fb_id IS NOT NULL
                            AND (? IS NULL OR EXISTS (SELECT 1 FROM don_dong x WHERE x.don_id = d.id AND x.san_pham_id = ?))`).get(phienId, sanPhamId, sanPhamId).n;
}

/** Người đã chốt trong buổi (đơn chưa hủy), theo thứ tự chốt: tên bình luận, người, nhãn — để dòng cảm ơn (bỏ người ẩn tên ở nơi gọi). */
function nguoiChotTrongBuoi(phienId) {
  return csdl().prepare(`SELECT b.ten, b.nhan, d.nguoi_fb_id, MIN(b.luc_nhan) AS luc FROM binh_luan_live b JOIN don d ON d.id = b.don_id
                          WHERE b.phien_id = ? AND d.trang_thai <> 'da_huy' GROUP BY d.nguoi_fb_id ORDER BY luc`).all(phienId)
    .map((r) => ({ ...r, nhan: JSON.parse(r.nhan || '[]') }));
}

/**
 * Dòng số liệu cho người dẫn (F-85): người chốt (khác nhau, trừ hủy), đã trả lời tin (nhắn Messenger hoặc bấm nút sau khi có
 * đơn), đã xác nhận (đơn từ Đã xác nhận trở đi) — chỉ đơn cùng loại tập / thật với phiên.
 */
function soLieuPhien(phienId) {
  const db = csdl();
  const dk = `FROM don d JOIN phien_live p ON p.id = d.phien_live_id WHERE d.phien_live_id = ? AND d.nguon = 'binh_luan_live'
              AND d.trang_thai <> 'da_huy' AND d.dien_tap = p.dien_tap AND d.nguoi_fb_id IS NOT NULL`;
  const chot = db.prepare(`SELECT COUNT(DISTINCT d.nguoi_fb_id) AS n ${dk}`).get(phienId).n;
  const traLoi = db.prepare(`SELECT COUNT(DISTINCT d.nguoi_fb_id) AS n ${dk} AND (d.khach_bam_luc IS NOT NULL OR EXISTS (
      SELECT 1 FROM tin_nhan t JOIN hoi_thoai h ON h.id = t.hoi_thoai_id
      WHERE h.nguoi_fb_id = d.nguoi_fb_id AND h.kenh = 'messenger' AND t.chieu = 'vao' AND t.gui_boi = 'khach' AND t.luc >= d.tao_luc))`).get(phienId).n;
  const xacNhan = db.prepare(`SELECT COUNT(DISTINCT d.nguoi_fb_id) AS n ${dk} AND d.trang_thai IN ('da_xac_nhan', 'da_gui', 'da_giao', 'hoan')`).get(phienId).n;
  return { chot, tra_loi: traLoi, xac_nhan: xacNhan };
}

/**
 * F-100 (P14 bước 2): phản hồi "mặc thấy sao" thật (không diễn tập) của một mẫu. Từ 10 phản hồi mới được hiện
 * "X/Y khách nói vừa" — luôn có cả số không vừa (không chọn lọc lời khen).
 * @returns {{vua:number, tong:number, chu:string|null}}
 */
function phanHoiMac(sanPhamId) {
  const r = csdl().prepare(`SELECT SUM(d.phan_hoi_mac = 'vua') AS vua, COUNT(*) AS tong FROM don d
      WHERE d.dien_tap = 0 AND d.phan_hoi_mac IS NOT NULL AND EXISTS (SELECT 1 FROM don_dong x WHERE x.don_id = d.id AND x.san_pham_id = ?)`).get(sanPhamId);
  const tong = r.tong || 0;
  const vua = r.vua || 0;
  return { vua, tong, chu: tong >= 10 ? `${vua}/${tong} khách nói vừa` : null };
}

module.exports = { phanHoiMac, soLieuPhien, demNguoiChot, nguoiChotTrongBuoi, baoCao, theoPhien, theoNgay, theoSanPham, demDon, hieuQuaAgent };
