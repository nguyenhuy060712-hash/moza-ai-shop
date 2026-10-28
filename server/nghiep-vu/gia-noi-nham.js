'use strict';

/**
 * Đơn chốt lúc Mai nói nhầm giá: giữ giá có lợi cho khách (SPEC.md F-106, P15). Lỗi "chắc" mà Mai nói giá / phí ship / mức miễn ship
 * THẤP hơn thật mở "khoảng nói nhầm" (tới đính chính + độ trễ phát + 60 giây — loi_noi_song.het_khoang_luc). Đơn của buổi, chưa gửi,
 * tạo hoặc thêm món trong khoảng, có dòng món bị nói sai → đánh dấu "Mai nói nhầm giá" (bảng don_danh_dau) và:
 *  - "Bán theo giá Mai nói" (mặc định): hạ đơn giá dòng đó xuống giá Mai nói — CHỈ HẠ, không bao giờ tăng, có dòng don_lich_su,
 *    nút "Giữ giá đúng" đưa về như cũ; lỗi phí ship → phí ship theo lời Mai (đơn đạt mức Mai nói thì miễn).
 *  - "Chủ shop quyết từng đơn": không đổi giá, chỉ đánh dấu + việc.
 * Mai nói giá CAO hơn / sai số còn: không đổi đơn (khách không thiệt; kho.giu đã chặn bán quá). Luôn có việc cho chủ shop.
 * Đây không phải khuyến mại: shop giữ đúng mức giá đã nói trên sóng. MOZA không tự nhắn khách báo đổi giá.
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, hienTien } = require('./chung');
const caiDat = require('./cai-dat');

const LOAI = 'mai_noi_nham_gia';
const DOI_DUOC = ['cho_xac_nhan', 'da_xac_nhan'];

const cheDo = () => (caiDat.banHang().khi_noi_nham_gia === 'chu_shop_quyet' ? 'chu_shop_quyet' : 'ban_theo_gia_noi');

/** Lỗi ship là mức miễn ship (so với Cài đặt) hay phí ship. */
const laMienShip = (l) => l.loai === 'ship' && l.gia_tri_dung != null && l.gia_tri_dung === caiDat.banHang().mien_phi_tu;

function tenMon(spId) {
  try { return require('./san-pham').tenGoi(require('./san-pham').laySanPham(spId)); } catch { return 'món này'; }
}

/** Mô tả lỗi cho lịch sử / việc. */
function moTa(l) {
  if (l.loai === 'gia') return `Mai nói ${tenMon(l.san_pham_id)} giá ${hienTien(l.gia_tri_noi)} (giá đúng ${hienTien(l.gia_tri_dung)})`;
  if (laMienShip(l)) return `Mai nói miễn ship cho đơn từ ${hienTien(l.gia_tri_noi)} (đúng: từ ${hienTien(l.gia_tri_dung)})`;
  return `Mai nói phí ship ${hienTien(l.gia_tri_noi)} (đúng: ${hienTien(l.gia_tri_dung)})`;
}

/**
 * Áp một lỗi cho một đơn. Trả dòng đánh dấu mới (hoặc null: không liên quan / đã áp / đã gửi).
 * Trong giao dịch: đọc — đổi — ghi lịch sử — tính lại tổng cùng lúc.
 */
function apChoDon(donId, l) {
  return giaoDich((db) => {
    const don = require('./don');
    const d = don.layDon(donId, db);
    if (!DOI_DUOC.includes(d.trang_thai) || d.phien_live_id !== l.phien_live_id) return null;
    // Chủ shop đã bấm "Giữ giá đúng" cho lỗi này ở đơn này → không hạ lại. Món thêm sau trong khoảng vẫn được hạ (dòng mới).
    if (db.prepare("SELECT 1 FROM don_danh_dau WHERE don_id = ? AND loi_noi_id = ? AND xu_ly = 'giu_gia_dung'").get(d.id, l.id)) return null;
    if (cheDo() === 'chu_shop_quyet' && db.prepare('SELECT 1 FROM don_danh_dau WHERE don_id = ? AND loi_noi_id = ?').get(d.id, l.id)) return null;
    const ban = cheDo() === 'ban_theo_gia_noi';
    const chiTiet = { tong_cu: d.tong_tien, dong: [], phi_cu: d.phi_ship, phi_moi: d.phi_ship, che_do: cheDo(), mo_ta: moTa(l) };
    if (l.loai === 'gia') {
      const dong = d.dong.filter((x) => x.san_pham_id === l.san_pham_id && x.don_gia > l.gia_tri_noi);
      if (!dong.length) return null;
      chiTiet.dong = dong.map((x) => ({ id: x.id, ten: x.ten_chup, gia_cu: x.don_gia, gia_moi: l.gia_tri_noi }));
      if (ban) for (const x of dong) db.prepare('UPDATE don_dong SET don_gia = ? WHERE id = ? AND don_gia > ?').run(l.gia_tri_noi, x.id, l.gia_tri_noi);
    } else if (l.loai === 'ship') {
      const phiMoi = laMienShip(l) ? (d.tong_hang >= l.gia_tri_noi ? 0 : d.phi_ship) : Math.min(d.phi_ship, l.gia_tri_noi);
      if (!(phiMoi < d.phi_ship)) return null;
      chiTiet.phi_moi = phiMoi;
      if (ban) db.prepare('UPDATE don SET phi_ship = ?, nguoi_sua_luc = ? WHERE id = ?').run(phiMoi, gio(), d.id);
    } else return null;
    if (ban) {
      // Giữ phí ship: tổng hàng giảm không được làm mất miễn ship (tổng không bao giờ tăng).
      don.tinhLaiTrong(db, d.id, { giuPhiShip: true });
      const moi = don.layDon(d.id, db);
      chiTiet.tong_moi = moi.tong_tien;
      require('./don').ghiLichSuTrong(db, d.id, { tu: d.trang_thai, den: d.trang_thai, nguon: 'he_thong',
        ghiChu: `${moTa(l)} trên live — bán theo giá Mai nói: tổng ${hienTien(d.tong_tien)} → ${hienTien(moi.tong_tien)}` });
    } else {
      chiTiet.tong_moi = d.tong_tien;
    }
    const id = taoId('dd');
    db.prepare('INSERT INTO don_danh_dau (id, don_id, loai, loi_noi_id, chi_tiet, tao_luc) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, d.id, LOAI, l.id, JSON.stringify(chiTiet), gio());
    return { id, don_id: d.id, ma: d.ma, chi_tiet: chiTiet };
  });
}

function taoViec(dd) {
  const c = dd.chi_tiet;
  const noiDung = c.che_do === 'ban_theo_gia_noi'
    ? `Đơn ${dd.ma} chốt lúc ${c.mo_ta} — đã bán theo giá Mai nói (${hienTien(c.tong_cu)} → ${hienTien(c.tong_moi)}). Muốn thu giá đúng: Đơn hàng → "Giữ giá đúng".`
    : `Đơn ${dd.ma} chốt lúc ${c.mo_ta} — giá chưa đổi, bạn quyết ở Đơn hàng: "Bán theo giá Mai nói" hoặc "Giữ giá đúng".`;
  const d = require('./don').layDon(dd.don_id);
  require('./khach').taoViec({ loai: 'khac', noiDung, khachId: d.khach_id, hoiThoaiId: d.hoi_thoai_id, donId: d.id, taoBoi: 'ai' });
}

/** Lỗi vừa mở khoảng: quét đơn của buổi tạo / thêm món từ lúc câu sai tới giờ. @returns {object[]} dòng đánh dấu mới */
function quetKhoang(l) {
  const den = new Date(Math.min(Date.now(), new Date(l.het_khoang_luc).getTime())).toISOString();
  const ids = csdl().prepare(`SELECT id FROM don WHERE phien_live_id = ? AND trang_thai IN ('cho_xac_nhan', 'da_xac_nhan')
      AND ((tao_luc >= ? AND tao_luc <= ?) OR (mon_sua_luc >= ? AND mon_sua_luc <= ?))`).all(l.phien_live_id, l.luc, den, l.luc, den).map((r) => r.id);
  const ra = [];
  for (const id of ids) {
    const dd = apChoDon(id, l);
    if (dd) { taoViec(dd); ra.push(dd); }
  }
  return ra;
}

/** Đơn vừa tạo / thêm món (ChotDon): áp mọi khoảng đang mở của buổi — trước khi nhắn riêng, để tin đầu đúng giá. */
function apChoDonMoi(donId, { phienId, luc = gio() }) {
  const ra = [];
  for (const l of require('./loi-noi').khoangMo(phienId, luc)) {
    const dd = apChoDon(donId, l);
    if (dd) { taoViec(dd); ra.push(dd); }
  }
  return ra;
}

/** Đánh dấu còn mở của một đơn (màn Đơn hàng). */
function cuaDon(donId) {
  return csdl().prepare("SELECT * FROM don_danh_dau WHERE don_id = ? ORDER BY tao_luc").all(donId).map((r) => ({ ...r, chi_tiet: JSON.parse(r.chi_tiet) }));
}

/**
 * Người xử lý đánh dấu: "giu_gia_dung" (đưa giá về như cũ — chỉ đơn chưa gửi), "ban_theo_gia_noi" (áp giá Mai nói nếu chưa áp),
 * "da_xem" (đóng). @returns {{don:object, doi_tong:boolean}}
 */
function xuLy(ddId, cach) {
  if (!['giu_gia_dung', 'ban_theo_gia_noi', 'da_xem'].includes(cach)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cách xử lý không hợp lệ.');
  return giaoDich((db) => {
    const r = db.prepare('SELECT * FROM don_danh_dau WHERE id = ?').get(ddId);
    if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy đánh dấu.', 404);
    if (r.trang_thai !== 'mo') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Đánh dấu này đã xử lý.', 409);
    const don = require('./don');
    const d = don.layDon(r.don_id, db);
    const c = JSON.parse(r.chi_tiet);
    const daAp = c.che_do === 'ban_theo_gia_noi' && !c.hoan;
    let doiTong = false;
    const doi = (gia, phi, ghiChu) => {
      if (!DOI_DUOC.includes(d.trang_thai)) throw new LoiNghiepVu('DON_DA_GUI', 'Đơn đã gửi: không đổi giá nữa.', 409);
      for (const x of c.dong) db.prepare('UPDATE don_dong SET don_gia = ? WHERE id = ?').run(gia(x), x.id);
      if (phi != null) db.prepare('UPDATE don SET phi_ship = ?, nguoi_sua_luc = ? WHERE id = ?').run(phi, gio(), d.id);
      don.tinhLaiTrong(db, d.id, { giuPhiShip: true });
      const moi = don.layDon(d.id, db);
      don.ghiLichSuTrong(db, d.id, { tu: d.trang_thai, den: d.trang_thai, nguon: 'nguoi', ghiChu: `${ghiChu}: tổng ${hienTien(d.tong_tien)} → ${hienTien(moi.tong_tien)}` });
      doiTong = moi.tong_tien !== d.tong_tien;
    };
    if (cach === 'giu_gia_dung' && daAp) doi((x) => x.gia_cu, c.phi_moi !== c.phi_cu ? c.phi_cu : null, 'Giữ giá đúng (bỏ giá Mai nói nhầm)');
    if (cach === 'ban_theo_gia_noi' && !daAp) doi((x) => Math.min(x.gia_moi, x.gia_cu), c.phi_moi !== c.phi_cu ? c.phi_moi : null, 'Bán theo giá Mai nói trên live');
    db.prepare("UPDATE don_danh_dau SET trang_thai = 'da_xu_ly', xu_ly = ?, xu_ly_luc = ? WHERE id = ?").run(cach, gio(), ddId);
    return { don: don.layDon(d.id, db), doi_tong: doiTong };
  });
}

/** Dòng cho AI (khoiChoAi): đơn giá đang giữ theo lời Mai. */
function dongChoAi(donId) {
  const ds = cuaDon(donId).filter((r) => (r.chi_tiet.che_do === 'ban_theo_gia_noi' && r.xu_ly !== 'giu_gia_dung') || r.xu_ly === 'ban_theo_gia_noi');
  return ds.map((r) => `(Đơn giá / phí ship giữ theo lời Mai trên live: ${r.chi_tiet.mo_ta}. Đây là giá shop đã nói, không phải khuyến mại.)`);
}

module.exports = { apChoDon, quetKhoang, apChoDonMoi, cuaDon, xuLy, dongChoAi, cheDo, LOAI };
