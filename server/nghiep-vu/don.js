'use strict';

/**
 * Đơn hàng (SPEC.md F-55, F-52 giữ hàng, F-57 gửi hàng; mục 7 bảng don, don_dong, don_lich_su và bảng chuyển trạng thái).
 *
 *  - Giữ hàng (#64) là một hàm duy nhất chạy trong giao dịch SQLite (`giuTrong`): kiểm còn bán được rồi thêm dòng đơn —
 *    hai người chốt món cuối cùng cùng lúc thì chỉ một người được (SQLite ghi tuần tự, BEGIN IMMEDIATE).
 *  - Đang giữ = tổng số lượng dòng của đơn Chờ xác nhận / Đã xác nhận (kho.js). Bấm "Đã gửi" mới trừ tồn; "Đã nhận hàng
 *    hoàn" mới cộng lại.
 *  - Đơn giá chụp lúc thêm món (giá riêng phân loại nếu có, không thì giá mẫu) — đổi giá sau đó không đổi đơn đã có.
 *    Giá vốn cũng chụp (báo cáo lãi gộp, F-58).
 *  - Tổng tiền = tổng hàng + phí ship; phí ship tính theo Cài đặt lúc tạo / sửa (đạt "miễn phí từ" → 0), người sửa được.
 *  - Chuyển trạng thái theo bảng mục 7: AI chỉ được xác nhận khi đủ tên, số, địa chỉ + khách đồng ý (bằng chứng), khách
 *    không từng hoàn ≥ ngưỡng (#73); AI chỉ hủy khi khách tự nói (bằng chứng); AI không được gửi / giao / hoàn.
 *    Mọi lần đổi ghi lịch sử kèm nguồn; người hoàn tác được lần đổi gần nhất của AI.
 *  - Đơn Đã gửi trở đi không sửa được dòng hàng (`DON_KHONG_SUA_DUOC`).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, chuan, kiemChu, docTien, hienTien, boDau } = require('./chung');
const kho = require('./kho');
const caiDat = require('./cai-dat');

const TRANG_THAI = ['cho_xac_nhan', 'da_xac_nhan', 'da_gui', 'da_giao', 'hoan', 'da_huy'];
const TEN_TRANG_THAI = {
  cho_xac_nhan: 'Chờ xác nhận', da_xac_nhan: 'Đã xác nhận', da_gui: 'Đã gửi', da_giao: 'Đã giao', hoan: 'Hoàn', da_huy: 'Đã hủy',
};
const SUA_DUOC = ['cho_xac_nhan', 'da_xac_nhan'];

/** Số điện thoại che bớt để hiện ngoài hồ sơ: +84912345678 → 0912***678. */
const cheSo = (s) => (s ? `0${String(s).slice(3, 6)}***${String(s).slice(-3)}` : '');

/* ---------------- đọc ---------------- */

function docDon(db, r) {
  if (!r) return null;
  const dong = db.prepare('SELECT * FROM don_dong WHERE don_id = ? ORDER BY rowid').all(r.id);
  return { ...r, dien_tap: r.dien_tap === 1, ten_trang_thai: TEN_TRANG_THAI[r.trang_thai], dong };
}

function layDon(id, db = csdl()) {
  const d = docDon(db, db.prepare('SELECT * FROM don WHERE id = ? OR ma = ?').get(id, id));
  if (!d) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy đơn này.', 404);
  return d;
}

function lichSu(donId) {
  return csdl().prepare('SELECT * FROM don_lich_su WHERE don_id = ? ORDER BY luc, rowid').all(donId);
}

/* ---------------- tiền ---------------- */

/** Phí ship theo Cài đặt (#63): đồng giá; đạt "miễn phí từ" thì 0. Chưa đặt phí ship → 0 và báo `chua_dat`. */
function phiShipTheoCaiDat(tongHang) {
  const b = caiDat.banHang();
  if (b.mien_phi_tu != null && tongHang >= b.mien_phi_tu) return { phi: 0, chua_dat: false };
  return { phi: b.phi_ship ?? 0, chua_dat: b.phi_ship == null };
}

/** Tính lại tổng hàng, phí ship (trừ khi người đã sửa tay), tổng tiền. Chỉ gọi trong giao dịch. */
function tinhLai(db, donId, { giuPhiShip = false } = {}) {
  const d = db.prepare('SELECT * FROM don WHERE id = ?').get(donId);
  const tongHang = db.prepare('SELECT COALESCE(SUM(so_luong * don_gia), 0) AS n FROM don_dong WHERE don_id = ?').get(donId).n;
  const phi = giuPhiShip || d.nguoi_sua_luc ? d.phi_ship : phiShipTheoCaiDat(tongHang).phi;
  const luc = gio();
  db.prepare('UPDATE don SET tong_hang = ?, phi_ship = ?, tong_tien = ?, sua_luc = ? WHERE id = ?').run(tongHang, phi, tongHang + phi, luc, donId);
  // Lần sửa món gần nhất: AI chỉ thêm / bớt / đổi món theo tin khách MỚI hơn mốc này (cap_nhat_don).
  if (!giuPhiShip) db.prepare('UPDATE don SET mon_sua_luc = ? WHERE id = ?').run(luc, donId);
}

/* ---------------- giữ hàng (#64) ---------------- */

function phanLoaiVaSp(db, phanLoaiId) {
  const pl = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(phanLoaiId);
  if (!pl) throw new LoiNghiepVu('PHAN_LOAI_KHONG_CO', 'Không có phân loại này.');
  const sp = db.prepare('SELECT * FROM san_pham WHERE id = ?').get(pl.san_pham_id);
  return { pl, sp };
}

const nhan = (pl) => (pl.gt2 ? `${pl.gt1}/${pl.gt2}` : pl.gt1);

/** Ô còn hàng khác của cùng mẫu (để gợi ý khi hết). */
function goiYConHang(db, spId, truId) {
  return kho.conHang(spId, db).filter((p) => p.id !== truId && p.con_ban_duoc > 0).slice(0, 6).map((p) => `${nhan(p)} (còn ${p.con_ban_duoc})`);
}

/**
 * Giữ hàng: thêm (hoặc cộng) một dòng vào đơn, kiểm còn bán được TRONG cùng giao dịch. Chỉ gọi bên trong giaoDich.
 * @returns {object} dòng đơn
 */
function giuTrong(db, donId, phanLoaiId, soLuong, { donGia = null, giaThuong = null } = {}) {
  const n = Number(soLuong);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Số lượng phải từ 1 tới 100.');
  const { pl, sp } = phanLoaiVaSp(db, phanLoaiId);
  const ten = `${sp.ten} số ${sp.so}`;
  if (sp.trang_thai !== 'dang_ban') {
    throw new LoiNghiepVu('SP_KHONG_BAN_DUOC', `Sản phẩm số ${sp.so} đang ${sp.trang_thai === 'nhap' ? 'Nháp' : 'Ngừng bán'}: không bán. Báo khách lịch sự, gợi ý mẫu khác.`);
  }
  if (pl.bo) throw new LoiNghiepVu('PHAN_LOAI_KHONG_CO', `${ten} không bán ${nhan(pl)}. Còn: ${goiYConHang(db, sp.id, pl.id).join(', ') || 'không'}.`);
  const con = pl.ton - kho.dangGiu(db, pl.id);
  if (con <= 0) {
    throw new LoiNghiepVu('HET_HANG', `${ten} ${nhan(pl)} vừa hết. Báo khách, gợi ý: ${goiYConHang(db, sp.id, pl.id).join(', ') || 'mẫu này hết mọi phân loại'}.`);
  }
  if (con < n) {
    throw new LoiNghiepVu('KHONG_DU_HANG', `${ten} ${nhan(pl)} chỉ còn bán được ${con}, khách muốn ${n}. Hỏi khách lấy ${con} hay đổi phân loại khác (${goiYConHang(db, sp.id, pl.id).join(', ') || 'không còn phân loại khác'}).`);
  }
  const dongGia = donGia ?? pl.gia ?? sp.gia;
  // F-93: cùng phân loại mà khác giá (giá live / giá thường) → dòng riêng, mỗi dòng giữ đúng giá đã chụp.
  const cu = db.prepare('SELECT * FROM don_dong WHERE don_id = ? AND phan_loai_id = ? AND don_gia = ?').get(donId, pl.id, dongGia);
  if (cu) {
    db.prepare('UPDATE don_dong SET so_luong = so_luong + ? WHERE id = ?').run(n, cu.id);
    return db.prepare('SELECT * FROM don_dong WHERE id = ?').get(cu.id);
  }
  const id = taoId('dd');
  db.prepare(`INSERT INTO don_dong (id, don_id, phan_loai_id, san_pham_id, san_pham_phien_ban, so_luong, don_gia, gia_von_chup, ten_chup, gia_thuong)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, donId, pl.id, sp.id, sp.phien_ban, n, dongGia, sp.gia_von, `Số ${sp.so} · ${sp.ten} · ${nhan(pl)}`, giaThuong != null && giaThuong !== dongGia ? giaThuong : null);
  return db.prepare('SELECT * FROM don_dong WHERE id = ?').get(id);
}

/* ---------------- hạn giữ hai mức (#98, F-68) ---------------- */

const GIO_MS = 3600e3;
const TRAN_TRONG_LIVE_GIO = 12; // trần an toàn khi đang live (phòng khi phiên không đóng được)

/**
 * Hạn giữ hàng (sửa #64 bằng #98): đơn từ bình luận live mà khách CHƯA bấm, chưa nhắn → giữ tới hết live + N giờ ("Giữ ngắn cho
 * người chưa bấm", mặc định 2) — trong lúc live tạm là lúc chốt + 12 giờ, khi phiên kết thúc thì rút về (rutGiuNgan). Khách bấm
 * nút hoặc nhắn tin → giữ đủ "Giờ giữ hàng" (24) tính từ lúc đó. Đơn Tư vấn viên / người tạo: giữ như cũ.
 */
function tinhGiuDen(db, { nguon, phienLiveId = null, khachBamLuc = null }, bayGio = Date.now()) {
  const b = caiDat.banHang();
  if (nguon === 'binh_luan_live' && !khachBamLuc && phienLiveId) {
    const p = db.prepare('SELECT trang_thai, ket_thuc FROM phien_live WHERE id = ?').get(phienLiveId);
    if (p?.trang_thai === 'xong') return new Date(Math.max(new Date(p.ket_thuc || bayGio).getTime(), bayGio) + b.gio_giu_ngan * GIO_MS).toISOString();
    return new Date(bayGio + TRAN_TRONG_LIVE_GIO * GIO_MS).toISOString();
  }
  return new Date(bayGio + b.gio_giu * GIO_MS).toISOString();
}

/** Khách bấm nút / nhắn tin lần đầu → chuyển sang giữ dài (#98). Trả đơn (đổi hay không). */
function batDauGiuDai(donId, bayGio = Date.now()) {
  const db = csdl();
  db.prepare("UPDATE don SET khach_bam_luc = ?, giu_den = ? WHERE id = ? AND trang_thai = 'cho_xac_nhan' AND khach_bam_luc IS NULL")
    .run(new Date(bayGio).toISOString(), new Date(bayGio + caiDat.banHang().gio_giu * GIO_MS).toISOString(), donId);
  return layDon(donId, db);
}

/** Khách vừa nhắn / bấm: mọi đơn chờ xác nhận từ bình luận live của người này chuyển sang giữ dài. */
function khachTuongTac(nguoiFbId, bayGio = Date.now()) {
  if (!nguoiFbId) return [];
  const ds = csdl().prepare("SELECT id FROM don WHERE nguoi_fb_id = ? AND trang_thai = 'cho_xac_nhan' AND khach_bam_luc IS NULL").all(nguoiFbId);
  return ds.map((r) => batDauGiuDai(r.id, bayGio));
}

/** Phiên kết thúc: đơn giữ ngắn của người chưa bấm rút hạn về lúc kết thúc + N giờ. */
function rutGiuNgan(phienId, ketThuc) {
  const han = new Date(new Date(ketThuc).getTime() + caiDat.banHang().gio_giu_ngan * GIO_MS).toISOString();
  return csdl().prepare("UPDATE don SET giu_den = ? WHERE phien_live_id = ? AND trang_thai = 'cho_xac_nhan' AND nguon = 'binh_luan_live' AND khach_bam_luc IS NULL AND giu_den > ?")
    .run(han, phienId, han).changes;
}

/* ---------------- tạo, sửa ---------------- */

function maKeTiep(db) {
  const r = db.prepare("SELECT MAX(CAST(substr(ma, 4) AS INTEGER)) AS n FROM don").get();
  return `DH-${String((r.n || 0) + 1).padStart(4, '0')}`;
}

function ghiLichSu(db, donId, { tu = null, den, nguon, bangChung = null, runId = null, ghiChu = null }) {
  db.prepare(`INSERT INTO don_lich_su (id, don_id, tu, den, nguon, bang_chung_tin_nhan_id, agent_run_id, ghi_chu, luc)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(taoId('dls'), donId, tu, den, nguon, bangChung, runId, ghiChu ? chuan(ghiChu).slice(0, 300) : null, gio());
}

/**
 * Tạo đơn Chờ xác nhận và giữ hàng các món (một giao dịch: món nào hết thì cả đơn không tạo).
 * @param {object} o
 * @param {{phan_loai_id:string, so_luong:number}[]} o.mon
 * @param {'binh_luan_live'|'tin_nhan'|'nguoi'} o.nguon
 */
function taoDon({ mon, nguon, pageId = null, nguoiFbId = null, khachId = null, hoiThoaiId = null, phienLiveId = null, binhLuanId = null,
  tenNhan = '', sdtNhan = null, diaChiNhan = '', ghiChu = '', dienTap = false, boi = 'he_thong', runId = null }) {
  return giaoDich((db) => taoDonTrong(db, { mon, nguon, pageId, nguoiFbId, khachId, hoiThoaiId, phienLiveId, binhLuanId, tenNhan, sdtNhan, diaChiNhan, ghiChu, dienTap, boi, runId }));
}

/** Thân của taoDon — CHỈ gọi bên trong giao dịch (F-92: nhường suất tạo đơn trong giao dịch trả hàng). */
function taoDonTrong(db, { mon, nguon, pageId = null, nguoiFbId = null, khachId = null, hoiThoaiId = null, phienLiveId = null, binhLuanId = null,
  tenNhan = '', sdtNhan = null, diaChiNhan = '', ghiChu = '', dienTap = false, boi = 'he_thong', runId = null }) {
  if (!Array.isArray(mon) || !mon.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Đơn cần ít nhất một món.');
  if (!['binh_luan_live', 'tin_nhan', 'nguoi'].includes(nguon)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Nguồn đơn không hợp lệ.');
  const id = taoId('dh');
  const luc = gio();
  const giuDen = tinhGiuDen(db, { nguon, phienLiveId });
  db.prepare(`INSERT INTO don (id, ma, page_id, nguoi_fb_id, khach_id, hoi_thoai_id, phien_live_id, binh_luan_id, nguon, trang_thai,
                ten_nhan, sdt_nhan, dia_chi_nhan, ghi_chu, giu_den, dien_tap, tao_luc, sua_luc)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cho_xac_nhan', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, maKeTiep(db), pageId, nguoiFbId, khachId, hoiThoaiId, phienLiveId, binhLuanId, nguon,
      chuan(tenNhan).slice(0, 100), sdtNhan, chuan(diaChiNhan).slice(0, 300), chuan(ghiChu).slice(0, 1000), giuDen, dienTap ? 1 : 0, luc, luc);
  for (const m of mon) giuTrong(db, id, m.phan_loai_id, m.so_luong ?? 1, { donGia: m.don_gia ?? null, giaThuong: m.gia_thuong ?? null });
  tinhLai(db, id);
  ghiLichSu(db, id, { den: 'cho_xac_nhan', nguon: boi === 'ai' ? 'ai' : boi === 'nguoi' ? 'nguoi' : 'he_thong', runId, ghiChu: `Tạo đơn (${nguon})` });
  return layDon(id, db);
}

/** F-92: hàng vừa được trả (hủy, bớt, đổi, nhập, nhận hoàn) → nhường suất cho người chờ, trong cùng giao dịch. */
function nhuong(db, plIds) {
  require('./cho-hang').nhuongSuatTrong(db, plIds);
}

function kiemSua(d) {
  if (!SUA_DUOC.includes(d.trang_thai)) throw new LoiNghiepVu('DON_KHONG_SUA_DUOC', `Đơn ${d.ma} đang ${d.ten_trang_thai}: không sửa món được. Chuyển người nếu khách cần đổi.`);
}

/**
 * F-90 (#113): đơn Đã xác nhận bị đổi món bởi khách (nút), AI hay gộp đơn → về Chờ xác nhận, giữ lại hàng đủ "Giờ giữ hàng" từ lúc
 * này, lịch sử ghi "sửa món sau xác nhận"; nơi gọi gửi thẻ đơn mới để khách xác nhận lại tổng tiền mới. Người sửa tay trên màn
 * hình Đơn hàng (`boi` = 'nguoi') thì giữ nguyên trạng thái. Chỉ gọi trong giao dịch.
 */
function veChoSauSua(db, donId, boi) {
  const d = db.prepare('SELECT trang_thai, khach_bam_luc FROM don WHERE id = ?').get(donId);
  if (boi === 'nguoi' || d.trang_thai !== 'da_xac_nhan') return false;
  const luc = gio();
  db.prepare("UPDATE don SET trang_thai = 'cho_xac_nhan', giu_den = ?, khach_bam_luc = COALESCE(khach_bam_luc, ?), sua_luc = ? WHERE id = ?")
    .run(new Date(Date.now() + caiDat.banHang().gio_giu * GIO_MS).toISOString(), luc, luc, donId);
  ghiLichSu(db, donId, { tu: 'da_xac_nhan', den: 'cho_xac_nhan', nguon: boi === 'ai' ? 'ai' : 'he_thong', ghiChu: 'sửa món sau xác nhận' });
  return true;
}

/**
 * Thêm món vào đơn đang mở (giữ hàng trong cùng giao dịch).
 * @param {{boi?:'khach'|'ai'|'he_thong'|'nguoi'}} [o]  ai sửa: người sửa tay thì đơn Đã xác nhận giữ nguyên, còn lại về Chờ xác nhận
 */
function themMon(donId, phanLoaiId, soLuong = 1, { boi = 'khach', donGia = null, giaThuong = null } = {}) {
  return giaoDich((db) => {
    const d = layDon(donId, db);
    kiemSua(d);
    giuTrong(db, d.id, phanLoaiId, soLuong, { donGia, giaThuong });
    tinhLai(db, d.id);
    veChoSauSua(db, d.id, boi);
    return layDon(d.id, db);
  });
}

/** Bớt món (số lượng hoặc bỏ hẳn dòng). Hàng trả về còn bán được ngay. Đơn không còn món nào thì không cho — hãy hủy. */
function botMon(donId, phanLoaiId, soLuong = null, { boi = 'khach' } = {}) {
  return giaoDich((db) => {
    const d = layDon(donId, db);
    kiemSua(d);
    const dong = db.prepare('SELECT * FROM don_dong WHERE don_id = ? AND phan_loai_id = ?').get(d.id, phanLoaiId);
    if (!dong) throw new LoiNghiepVu('PHAN_LOAI_KHONG_CO', 'Món này không có trong đơn.');
    const bot = soLuong == null ? dong.so_luong : Math.min(dong.so_luong, Number(soLuong));
    const conDong = db.prepare('SELECT COUNT(*) AS n FROM don_dong WHERE don_id = ?').get(d.id).n;
    if (bot >= dong.so_luong && conDong <= 1) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Đơn chỉ còn món này: hủy đơn thay vì bớt.');
    if (bot >= dong.so_luong) db.prepare('DELETE FROM don_dong WHERE id = ?').run(dong.id);
    else db.prepare('UPDATE don_dong SET so_luong = so_luong - ? WHERE id = ?').run(bot, dong.id);
    tinhLai(db, d.id);
    veChoSauSua(db, d.id, boi);
    nhuong(db, [phanLoaiId]);
    return layDon(d.id, db);
  });
}

/**
 * Đổi phân loại (khách đổi cỡ M → L): giữ món mới và trả món cũ trong cùng giao dịch; món mới hết → lỗi, đơn giữ nguyên.
 */
function doiPhanLoai(donId, tuId, denId, soLuong = null, { boi = 'khach' } = {}) {
  return giaoDich((db) => {
    const d = layDon(donId, db);
    kiemSua(d);
    const dong = db.prepare('SELECT * FROM don_dong WHERE don_id = ? AND phan_loai_id = ?').get(d.id, tuId);
    if (!dong) throw new LoiNghiepVu('PHAN_LOAI_KHONG_CO', 'Món cần đổi không có trong đơn.');
    const n = soLuong == null ? dong.so_luong : Math.min(dong.so_luong, Number(soLuong));
    if (n >= dong.so_luong) db.prepare('DELETE FROM don_dong WHERE id = ?').run(dong.id);
    else db.prepare('UPDATE don_dong SET so_luong = so_luong - ? WHERE id = ?').run(n, dong.id);
    // F-93: đổi size cùng mẫu giữ giá live của dòng cũ (phân loại mới có giá riêng thì theo giá riêng).
    const moi = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(denId);
    const giuGia = dong.gia_thuong != null && moi && moi.san_pham_id === dong.san_pham_id && moi.gia == null;
    giuTrong(db, d.id, denId, n, giuGia ? { donGia: dong.don_gia, giaThuong: dong.gia_thuong } : {}); // lỗi → ROLLBACK cả giao dịch, món cũ vẫn giữ
    tinhLai(db, d.id);
    veChoSauSua(db, d.id, boi);
    nhuong(db, [tuId]);
    return layDon(d.id, db);
  });
}

/** Thông tin giao (tên, số điện thoại chuẩn +84, địa chỉ), thanh toán, ghi chú. */
function datThongTinGiao(donId, { ten, sdt, diaChi, thanhToan, ghiChu, khachId } = {}, { boi = 'ai' } = {}) {
  const { chuanSdt } = require('./khach');
  return giaoDich((db) => {
    const d = layDon(donId, db);
    kiemSua(d);
    const so = sdt != null && sdt !== '' ? chuanSdt(sdt) : d.sdt_nhan;
    if (sdt && !so) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `"${sdt}" không phải số di động Việt Nam hợp lệ. Hỏi lại khách.`);
    const tt = thanhToan ?? d.thanh_toan;
    if (!['cod', 'chuyen_khoan'].includes(tt)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thanh toán là COD hoặc chuyển khoản.');
    db.prepare(`UPDATE don SET ten_nhan = ?, sdt_nhan = ?, dia_chi_nhan = ?, thanh_toan = ?, ghi_chu = ?, khach_id = COALESCE(?, khach_id),
                nguoi_sua_luc = CASE WHEN ? = 'nguoi' THEN ? ELSE nguoi_sua_luc END, sua_luc = ? WHERE id = ?`)
      .run(ten != null ? kiemChu(ten, { ten: 'Tên người nhận', toiDa: 100, motDong: true }) : d.ten_nhan, so,
        diaChi != null ? kiemChu(diaChi, { ten: 'Địa chỉ', toiDa: 300 }) : d.dia_chi_nhan, tt,
        ghiChu != null ? chuan(ghiChu).slice(0, 1000) : d.ghi_chu, khachId || null, boi, gio(), gio(), d.id);
    return layDon(d.id, db);
  });
}

/** Người sửa phí ship tay (F-55): từ đó không tự tính lại theo Cài đặt. */
function datPhiShip(donId, phi) {
  return giaoDich((db) => {
    const d = layDon(donId, db);
    kiemSua(d);
    const n = docTien(phi, { ten: 'Phí ship', batBuoc: true });
    db.prepare('UPDATE don SET phi_ship = ?, nguoi_sua_luc = ? WHERE id = ?').run(n, gio(), d.id);
    tinhLai(db, d.id, { giuPhiShip: true });
    return layDon(d.id, db);
  });
}

/** Mã vận đơn (người gõ khi gửi, hoặc sửa sau). Không đổi trạng thái. */
function datMaVanDon(donId, ma) {
  const d = layDon(donId);
  if (['da_huy'].includes(d.trang_thai)) throw new LoiNghiepVu('CHUYEN_KHONG_HOP_LE', 'Đơn đã hủy.', 409);
  csdl().prepare('UPDATE don SET ma_van_don = ?, sua_luc = ? WHERE id = ?')
    .run(kiemChu(ma ?? '', { ten: 'Mã vận đơn', toiDa: 60, motDong: true, batBuoc: false }), gio(), d.id);
  return layDon(d.id);
}

/**
 * AI chỉ xác nhận khi khách đồng ý với ĐÚNG đơn hiện tại (thử AI thật 26/9/2026: khách chốt thêm món sau lần đọc lại, AI vẫn
 * xác nhận theo lời "đồng ý" cũ): sau lần sửa món cuối phải có một tin shop gửi khách ghi đúng tổng tiền hiện tại, và tin
 * đồng ý của khách phải đến SAU tin đó.
 */
function kiemDaDocLai(db, d, bangChung) {
  const soTrong = (s) => (String(s).replace(/(\d)[.,](?=\d{3}\b)/g, '$1').match(/\d+/g) || []).map(Number);
  const moc = d.mon_sua_luc || d.tao_luc;
  const docLai = db.prepare(`SELECT t.noi_dung, t.luc FROM tin_nhan t JOIN hoi_thoai h ON h.id = t.hoi_thoai_id
                             WHERE (t.hoi_thoai_id = ? OR (h.nguoi_fb_id IS NOT NULL AND h.nguoi_fb_id = ?)) AND t.chieu = 'ra' AND t.luc >= ?
                             ORDER BY t.luc DESC`).all(d.hoi_thoai_id, d.nguoi_fb_id, moc).find((t) => soTrong(t.noi_dung).includes(d.tong_tien));
  const tin = db.prepare('SELECT luc FROM tin_nhan WHERE id = ?').get(bangChung);
  if (!docLai || !tin || tin.luc <= docLai.luc) {
    throw new LoiNghiepVu('CHUA_DOC_LAI', `Đơn ${d.ma} vừa đổi hoặc chưa được đọc lại: đọc lại đơn với tổng tiền hiện tại ${hienTien(d.tong_tien)} (xem_don), chờ khách đồng ý rồi mới xác nhận.`);
  }
}

/** Đơn diễn tập đã trả kho sau buổi tập (#87): khóa, không đổi gì nữa (tránh cộng kho hai lần). */
function daTraKho(d) {
  if (d.tra_kho_luc) throw new LoiNghiepVu('DA_TRA_KHO', `Đơn diễn tập ${d.ma} đã trả hàng về kho khi kết thúc buổi tập: không đổi được nữa.`, 409);
}

/* ---------------- chuyển trạng thái (mục 7) ---------------- */

/** Những điều còn thiếu để xác nhận (F-55, cho AI biết việc còn phải làm). */
function viecConThieu(d) {
  const ds = [];
  if (!d.ten_nhan) ds.push('chưa có tên người nhận');
  if (!d.sdt_nhan) ds.push('chưa có số điện thoại');
  if (!d.dia_chi_nhan) ds.push('chưa có địa chỉ giao');
  return ds;
}

function soHoanCuaKhach(db, khachId) {
  return khachId ? db.prepare("SELECT COUNT(*) AS n FROM don WHERE khach_id = ? AND trang_thai = 'hoan'").get(khachId).n : 0;
}

/**
 * Đổi trạng thái. `nguon`: 'ai' | 'nguoi' | 'khach_tu_bao' | 'he_thong'. AI bị ràng theo bảng mục 7.
 * @returns {object} đơn sau khi đổi
 */
function doiTrangThai(donId, den, { nguon = 'nguoi', bangChung = null, runId = null, ghiChu = null } = {}) {
  if (!TRANG_THAI.includes(den)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Trạng thái đơn không hợp lệ.');
  return giaoDich((db) => {
    const d = layDon(donId, db);
    daTraKho(d);
    const tu = d.trang_thai;
    if (tu === den) return d;
    const la = (a, b) => tu === a && den === b;
    const ai = nguon === 'ai';
    // Bảng chuyển trạng thái (mục 7).
    const hopLe = la('cho_xac_nhan', 'da_xac_nhan') || (['cho_xac_nhan', 'da_xac_nhan'].includes(tu) && den === 'da_huy')
      || la('da_xac_nhan', 'da_gui') || (tu === 'da_gui' && ['da_giao', 'hoan'].includes(den))
      || (!ai && nguon !== 'he_thong' && la('da_xac_nhan', 'cho_xac_nhan'));
    if (!hopLe) throw new LoiNghiepVu('CHUYEN_KHONG_HOP_LE', `Không chuyển đơn ${d.ma} từ ${TEN_TRANG_THAI[tu]} sang ${TEN_TRANG_THAI[den]}.`, 409);
    if (ai) {
      if (!['da_xac_nhan', 'da_huy'].includes(den)) throw new LoiNghiepVu('CAM', 'AI không được chuyển đơn sang trạng thái này.', 403);
      if (!bangChung) throw new LoiNghiepVu('THIEU_BANG_CHUNG', `Cần id tin nhắn khách ${den === 'da_huy' ? 'nói hủy' : 'nói đồng ý'} làm bằng chứng.`);
      // Bằng chứng: tin của chính khách, trong hội thoại của đơn hoặc hội thoại khác của cùng người (bình luận chốt → Messenger).
      const tin = db.prepare(`SELECT t.*, h.nguoi_fb_id FROM tin_nhan t JOIN hoi_thoai h ON h.id = t.hoi_thoai_id
                              WHERE t.id = ? AND t.gui_boi = 'khach'`).get(bangChung);
      if (!tin || (d.hoi_thoai_id && tin.hoi_thoai_id !== d.hoi_thoai_id && tin.nguoi_fb_id !== d.nguoi_fb_id)) {
        throw new LoiNghiepVu('THIEU_BANG_CHUNG', 'Bằng chứng phải là tin nhắn của chính khách trong hội thoại của đơn này.');
      }
    }
    if (den === 'da_xac_nhan') {
      const thieu = viecConThieu(d);
      if (thieu.length) throw new LoiNghiepVu('THIEU_THONG_TIN_GIAO', `Chưa xác nhận được: ${thieu.join(', ')}. Xin tiếp thông tin giao.`);
      if (ai && soHoanCuaKhach(db, d.khach_id) >= caiDat.banHang().nguong_hoan) {
        throw new LoiNghiepVu('CAN_GOI_XAC_NHAN', 'Khách từng hoàn nhiều đơn: AI không tự xác nhận. Báo khách shop sẽ gọi xác nhận; MOZA đã tạo việc cho người.');
      }
      if (ai) kiemDaDocLai(db, d, bangChung);
    }
    const luc = gio();
    const capNhat = { trang_thai: den, sua_luc: luc };
    // F-88: số khách lỡ ghi ở bình luận chỉ giữ cho tới khi đơn xong.
    if (den === 'da_xac_nhan' || den === 'da_huy') capNhat.sdt_goi_y = null;
    if (den === 'da_xac_nhan') capNhat.giu_den = null;
    // Người đưa đơn về Chờ xác nhận: giữ hàng lại từ bây giờ (không giữ vô hạn).
    if (den === 'cho_xac_nhan') capNhat.giu_den = tinhGiuDen(db, { nguon: d.nguon, phienLiveId: d.phien_live_id, khachBamLuc: d.khach_bam_luc });
    if (den === 'da_huy') capNhat.ly_do_huy = ghiChu || (nguon === 'khach_tu_bao' || ai ? 'khách hủy' : nguon === 'he_thong' ? 'quá giờ giữ hàng' : 'người hủy');
    if (den === 'da_gui') {
      // Trừ tồn khi gửi (#64): đang giữ giảm (đơn không còn ở trạng thái giữ), tồn giảm — còn bán được không đổi.
      for (const x of d.dong) {
        const pl = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(x.phan_loai_id);
        db.prepare("UPDATE don SET trang_thai = 'da_gui' WHERE id = ?").run(d.id); // không còn tính "đang giữ" khi kiểm tồn
        kho.ghiThayDoi(db, pl, -x.so_luong, { lyDo: 'gui_don', donId: d.id, ghiChu: d.ma, boi: nguon === 'nguoi' ? 'nguoi' : 'he_thong' });
      }
    }
    if (den === 'da_giao' && d.thanh_toan === 'cod' && !d.da_nhan_tien_luc) capNhat.da_nhan_tien_luc = luc; // COD đã giao coi như đã nhận tiền
    const cot = Object.keys(capNhat);
    db.prepare(`UPDATE don SET ${cot.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...cot.map((k) => capNhat[k]), d.id);
    ghiLichSu(db, d.id, { tu, den, nguon, bangChung, runId, ghiChu });
    if (den === 'da_huy') {
      // F-92: đơn từ lời mời của danh sách chờ kết thúc; hàng nhả ra → người chờ kế tiếp (cùng giao dịch).
      require('./cho-hang').ketThucMoiTrong(db, d.id, { hetGio: nguon === 'he_thong' });
      nhuong(db, d.dong.map((x) => x.phan_loai_id));
    }
    return layDon(d.id, db);
  });
}

/**
 * Đơn cần nhắn chủ động (F-32): `nhac` = Chờ xác nhận, còn ≤ 2 giờ giữ, thiếu thông tin giao, chưa nhắc;
 * `bao` = Đã gửi, chưa báo (chỉ đơn gửi trong 2 ngày gần đây).
 */
function canNhanChuDong(bayGio = new Date()) {
  const db = csdl();
  const nhac = db.prepare(`SELECT id FROM don WHERE trang_thai = 'cho_xac_nhan' AND nhac_giao_luc IS NULL AND giu_den IS NOT NULL
                           AND giu_den > ? AND giu_den <= ?`).all(bayGio.toISOString(), new Date(bayGio.getTime() + 2 * 3600e3).toISOString())
    .map((r) => layDon(r.id, db)).filter((d) => viecConThieu(d).length);
  const bao = db.prepare(`SELECT id FROM don WHERE trang_thai = 'da_gui' AND bao_gui_luc IS NULL AND sua_luc > ?`)
    .all(new Date(bayGio.getTime() - 2 * 86400e3).toISOString()).map((r) => layDon(r.id, db));
  return { nhac, bao };
}

function danhDauNhan(donId, cot) {
  if (!['nhac_giao_luc', 'bao_gui_luc'].includes(cot)) throw new Error(`Cột lạ: ${cot}`);
  csdl().prepare(`UPDATE don SET ${cot} = ? WHERE id = ?`).run(gio(), donId);
}

/** Người hoàn tác lần đổi gần nhất của AI (A.12): chỉ khi lần đổi đó là lần đổi cuối cùng của đơn. */
function hoanTac(donId) {
  return giaoDich((db) => {
    const d = layDon(donId, db);
    daTraKho(d);
    const cuoi = db.prepare('SELECT * FROM don_lich_su WHERE don_id = ? AND da_hoan_tac = 0 ORDER BY luc DESC, rowid DESC LIMIT 1').get(d.id);
    if (!cuoi || cuoi.nguon !== 'ai' || !cuoi.tu) throw new LoiNghiepVu('KHONG_HOAN_TAC_DUOC', 'Lần đổi gần nhất không phải của AI: không hoàn tác được.', 409);
    if (cuoi.den === 'da_huy') {
      // Hủy đã trả hàng: giữ lại phải còn hàng.
      for (const x of d.dong) {
        const pl = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(x.phan_loai_id);
        if (pl.ton - kho.dangGiu(db, pl.id) < x.so_luong) throw new LoiNghiepVu('HET_HANG', `${x.ten_chup} đã bán cho người khác: không khôi phục đơn được.`, 409);
      }
    }
    const giuDen = cuoi.tu === 'cho_xac_nhan' ? tinhGiuDen(db, { nguon: d.nguon, phienLiveId: d.phien_live_id, khachBamLuc: d.khach_bam_luc }) : null;
    db.prepare('UPDATE don SET trang_thai = ?, ly_do_huy = NULL, giu_den = ?, sua_luc = ? WHERE id = ?').run(cuoi.tu, giuDen, gio(), d.id);
    db.prepare('UPDATE don_lich_su SET da_hoan_tac = 1 WHERE id = ?').run(cuoi.id);
    ghiLichSu(db, d.id, { tu: cuoi.den, den: cuoi.tu, nguon: 'nguoi', ghiChu: 'Hoàn tác lần đổi của AI' });
    return layDon(d.id, db);
  });
}

/** "Đã nhận tiền" (#62: chuyển khoản — người tự đối chiếu). AI không bao giờ gọi. */
function nhanTien(donId) {
  const d = layDon(donId);
  csdl().prepare('UPDATE don SET da_nhan_tien_luc = COALESCE(da_nhan_tien_luc, ?), sua_luc = ? WHERE id = ?').run(gio(), gio(), d.id);
  return layDon(d.id);
}

/** "Đã nhận hàng hoàn" (#64): cộng lại kho. */
function nhanHoan(donId) {
  return giaoDich((db) => {
    const d = layDon(donId, db);
    daTraKho(d);
    if (d.trang_thai !== 'hoan') throw new LoiNghiepVu('CHUYEN_KHONG_HOP_LE', 'Chỉ đơn "Hoàn" mới nhận hàng hoàn được.', 409);
    if (d.da_nhan_hoan_luc) return d;
    for (const x of d.dong) {
      const pl = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(x.phan_loai_id);
      kho.ghiThayDoi(db, pl, x.so_luong, { lyDo: 'nhan_hoan', donId: d.id, ghiChu: d.ma });
    }
    db.prepare('UPDATE don SET da_nhan_hoan_luc = ?, sua_luc = ? WHERE id = ?').run(gio(), gio(), d.id);
    ghiLichSu(db, d.id, { tu: 'hoan', den: 'hoan', nguon: 'nguoi', ghiChu: 'Đã nhận hàng hoàn, cộng lại kho' });
    nhuong(db, d.dong.map((x) => x.phan_loai_id));
    return layDon(d.id, db);
  });
}

/** Gửi nhiều đơn một lần (F-57): mã vận đơn (không bắt buộc) rồi "Đã gửi". Trả từng đơn ok / lỗi. */
function guiNhieu(ds, { nguon = 'nguoi' } = {}) {
  return (ds || []).map((x) => {
    try {
      if (x.ma_van_don != null) {
        csdl().prepare('UPDATE don SET ma_van_don = ? WHERE id = ?').run(kiemChu(x.ma_van_don, { ten: 'Mã vận đơn', toiDa: 60, motDong: true }), x.id);
      }
      return { id: x.id, ok: true, don: doiTrangThai(x.id, 'da_gui', { nguon }) };
    } catch (e) {
      return { id: x.id, ok: false, loi: e.message };
    }
  });
}

/**
 * Đơn Chờ xác nhận quá giờ giữ (F-52; bản 3.4 F-69, #99):
 *  - đơn ĐỦ tên, số, địa chỉ mà khách chưa bấm xác nhận → KHÔNG tự hủy lần đầu: gia hạn 12 giờ (một lần) + việc "Gọi xác nhận đơn";
 *    hết 12 giờ đó mà chưa ai xử lý thì hủy như thường;
 *  - còn lại → tự hủy, trả hàng.
 * Chạy mỗi phút và lúc khởi động. Trả danh sách đơn vừa hủy (thuộc tính `gia_han` = đơn vừa gia hạn) — nơi gọi báo khách.
 */
const GIA_HAN_GOI_GIO = 12;

function huyQuaGio(bayGio = new Date()) {
  const db = csdl();
  const ds = db.prepare("SELECT id FROM don WHERE trang_thai = 'cho_xac_nhan' AND giu_den IS NOT NULL AND giu_den <= ?").all(bayGio.toISOString());
  const huy = [];
  const giaHan = [];
  for (const { id } of ds) {
    const d = layDon(id);
    if (!viecConThieu(d).length && !d.gia_han_goi_luc && !d.tra_kho_luc) {
      const moi = new Date(bayGio.getTime() + GIA_HAN_GOI_GIO * GIO_MS).toISOString();
      db.prepare('UPDATE don SET giu_den = ?, gia_han_goi_luc = ?, sua_luc = ? WHERE id = ?').run(moi, bayGio.toISOString(), gio(), id);
      require('./khach').taoViec({ loai: 'goi_xac_nhan_don', noiDung: `Gọi xác nhận đơn ${d.ma} · ${cheSo(d.sdt_nhan)} — khách đủ thông tin nhưng chưa bấm xác nhận; MOZA giữ thêm ${GIA_HAN_GOI_GIO} giờ.`,
        khachId: d.khach_id, hoiThoaiId: d.hoi_thoai_id, donId: d.id, taoBoi: 'ai' });
      ghiLichSu(db, id, { tu: 'cho_xac_nhan', den: 'cho_xac_nhan', nguon: 'he_thong', ghiChu: `Hết giờ giữ: gia hạn ${GIA_HAN_GOI_GIO} giờ để gọi xác nhận` });
      giaHan.push(layDon(id));
      continue;
    }
    huy.push(doiTrangThai(id, 'da_huy', { nguon: 'he_thong', ghiChu: 'quá giờ giữ hàng' }));
  }
  huy.gia_han = giaHan;
  return huy;
}

/* ---------------- nhắc đơn (F-69, #99) ---------------- */

/** Đơn chờ xác nhận còn được nhắc (dưới 2 lần), chưa trả kho. Thời điểm nhắc nơi gọi tính theo hội thoại. */
function donCanNhac() {
  return csdl().prepare("SELECT id FROM don WHERE trang_thai = 'cho_xac_nhan' AND nhac_lan < 2 AND tra_kho_luc IS NULL ORDER BY tao_luc").all().map((r) => layDon(r.id));
}

/** Đã nhắc thêm một lần (hoặc dừng hẳn nhắc: `het` = true — khách xin dừng, đã đủ lần). */
function ghiNhac(donId, { het = false, bayGio = new Date() } = {}) {
  if (het) csdl().prepare('UPDATE don SET nhac_lan = 2 WHERE id = ?').run(donId);
  else csdl().prepare('UPDATE don SET nhac_lan = nhac_lan + 1, nhac_cuoi_luc = ? WHERE id = ?').run(bayGio.toISOString(), donId);
}

/** Đơn vừa tự hủy vì quá giờ giữ (trong 24 giờ), chưa báo khách — báo kèm nút [Đặt lại] (F-69). Không tính đơn diễn tập đã trả kho. */
function donCanBaoHuy(bayGio = new Date()) {
  const db = csdl();
  return db.prepare(`SELECT d.id FROM don d WHERE d.trang_thai = 'da_huy' AND d.bao_huy_luc IS NULL AND d.tra_kho_luc IS NULL
                     AND EXISTS (SELECT 1 FROM don_lich_su l WHERE l.don_id = d.id AND l.den = 'da_huy' AND l.nguon = 'he_thong'
                                 AND l.ghi_chu = 'quá giờ giữ hàng' AND l.luc > ?)`)
    .all(new Date(bayGio.getTime() - 24 * GIO_MS).toISOString()).map((r) => layDon(r.id, db));
}

function ghiBaoHuy(donId) {
  csdl().prepare('UPDATE don SET bao_huy_luc = ? WHERE id = ?').run(gio(), donId);
}

/**
 * [Đặt lại] sau khi đơn hủy vì quá giờ (F-69): đơn mới cùng món trong MỘT giao dịch, giữ dài (khách vừa bấm). Hết món nào thì
 * lỗi HET_HANG / KHONG_DU_HANG (không tạo gì). Hạn 24 giờ kể từ lúc hủy.
 */
function datLai(donCuId, { hoiThoaiId = null } = {}) {
  const cu = layDon(donCuId);
  if (cu.trang_thai !== 'da_huy') throw new LoiNghiepVu('CHUYEN_KHONG_HOP_LE', `Đơn ${cu.ma} không ở trạng thái đã hủy.`, 409);
  const luc = lichSu(cu.id).filter((x) => x.den === 'da_huy').at(-1)?.luc || cu.sua_luc;
  if (Date.now() - new Date(luc).getTime() > 24 * GIO_MS) throw new LoiNghiepVu('QUA_HAN', 'Nút Đặt lại đã quá 24 giờ.', 409);
  const moi = taoDon({ mon: cu.dong.map((x) => ({ phan_loai_id: x.phan_loai_id, so_luong: x.so_luong })), nguon: cu.nguon === 'nguoi' ? 'tin_nhan' : cu.nguon,
    pageId: cu.page_id, nguoiFbId: cu.nguoi_fb_id, khachId: cu.khach_id, hoiThoaiId: hoiThoaiId || cu.hoi_thoai_id, phienLiveId: cu.phien_live_id,
    tenNhan: cu.ten_nhan, sdtNhan: cu.sdt_nhan, diaChiNhan: cu.dia_chi_nhan, dienTap: cu.dien_tap, ghiChu: `Đặt lại từ ${cu.ma}` });
  return batDauGiuDai(moi.id);
}

/* ---------------- miễn ship, món phối, gộp / tách (F-90, #113) ---------------- */

/** "Thêm X nữa là miễn ship": chỉ khi có mức miễn ship, tổng hàng còn dưới mức và đơn đang chịu phí ship > 0. Không thì null. */
function tienConThieuMienShip(d) {
  const b = caiDat.banHang();
  if (b.mien_phi_tu == null || !(d.phi_ship > 0) || d.tong_hang >= b.mien_phi_tu) return null;
  return b.mien_phi_tu - d.tong_hang;
}

/**
 * Một món phối gợi ý cho thẻ đơn: trong "Phối cùng" của các món trong đơn; Đang bán, còn hàng ít nhất một phân loại, chưa có trong
 * đơn. Ưu tiên món có giá bù đủ phần còn thiếu để miễn ship; không có thì món đầu còn hàng. @returns {object|null} sản phẩm
 */
function monPhoiGoiY(d) {
  const sp = require('./san-pham');
  const coRoi = new Set(d.dong.map((x) => x.san_pham_id));
  const ung = [];
  for (const x of d.dong) {
    let s;
    try { s = sp.laySanPham(x.san_pham_id); } catch { continue; }
    for (const id of s.phoi_cung || []) {
      if (coRoi.has(id) || ung.some((y) => y.id === id)) continue;
      let p;
      try { p = sp.laySanPham(id); } catch { continue; }
      if (p.trang_thai !== 'dang_ban' || !kho.conHang(p.id).some((y) => y.con_ban_duoc > 0)) continue;
      ung.push(p);
    }
  }
  const thieu = tienConThieuMienShip(d);
  return (thieu != null && ung.find((p) => p.gia >= thieu)) || ung[0] || null;
}

/** Người này đã được gợi ý món phối trong 24 giờ qua chưa (mỗi người tối đa 1 lần / 24 giờ). */
function daGoiYPhoi(d, bayGio = Date.now()) {
  const tu = new Date(bayGio - 24 * GIO_MS).toISOString();
  return !!csdl().prepare(`SELECT 1 FROM don WHERE goi_y_phoi_luc > ? AND ((? IS NOT NULL AND nguoi_fb_id = ?) OR (? IS NOT NULL AND khach_id = ?) OR id = ?) LIMIT 1`)
    .get(tu, d.nguoi_fb_id, d.nguoi_fb_id, d.khach_id, d.khach_id, d.id);
}

function ghiGoiYPhoi(donId) {
  csdl().prepare('UPDATE don SET goi_y_phoi_luc = ? WHERE id = ?').run(gio(), donId);
}

/**
 * Đơn mở khác của cùng người (Chờ / Đã xác nhận, chưa gửi) ở buổi khác hoặc từ tin nhắn — để hỏi gộp một lần (F-90).
 * @returns {object|null} đơn cũ nhất
 */
function donMoKhac(d) {
  if (!d.nguoi_fb_id && !d.khach_id) return null;
  const r = csdl().prepare(`SELECT id FROM don WHERE id != ? AND trang_thai IN ('cho_xac_nhan', 'da_xac_nhan') AND dien_tap = ? AND tra_kho_luc IS NULL
                             AND ((? IS NOT NULL AND nguoi_fb_id = ?) OR (? IS NOT NULL AND khach_id = ?))
                             AND (phien_live_id IS NULL OR ? IS NULL OR phien_live_id != ?) ORDER BY tao_luc LIMIT 1`)
    .get(d.id, d.dien_tap ? 1 : 0, d.nguoi_fb_id, d.nguoi_fb_id, d.khach_id, d.khach_id, d.phien_live_id, d.phien_live_id);
  return r ? layDon(r.id) : null;
}

function ghiHoiGop(donId) {
  csdl().prepare('UPDATE don SET hoi_gop_luc = ? WHERE id = ?').run(gio(), donId);
}

/**
 * Gộp đơn `tuId` vào đơn `vaoId` trong MỘT giao dịch: chuyển dòng hàng (giữ đơn giá từng dòng — kể cả giá live; cùng phân loại
 * cùng giá thì cộng số lượng), đơn `tu` thành Đã hủy với lý do "đã gộp vào DH-…" (không còn dòng nên không trả hàng — còn bán
 * được không đổi), đơn `vao` tính lại ship và về Chờ xác nhận nếu đang Đã xác nhận.
 * @returns {object} đơn nhận
 */
function gopDon(tuId, vaoId, { boi = 'khach' } = {}) {
  return giaoDich((db) => {
    const tu = layDon(tuId, db);
    const vao = layDon(vaoId, db);
    if (tu.id === vao.id) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không gộp một đơn với chính nó.');
    kiemSua(tu);
    kiemSua(vao);
    daTraKho(tu);
    daTraKho(vao);
    if (tu.dien_tap !== vao.dien_tap) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không gộp đơn diễn tập với đơn thật.');
    for (const x of tu.dong) {
      const trung = db.prepare('SELECT * FROM don_dong WHERE don_id = ? AND phan_loai_id = ? AND don_gia = ?').get(vao.id, x.phan_loai_id, x.don_gia);
      if (trung) {
        db.prepare('UPDATE don_dong SET so_luong = so_luong + ? WHERE id = ?').run(x.so_luong, trung.id);
        db.prepare('DELETE FROM don_dong WHERE id = ?').run(x.id);
      } else db.prepare('UPDATE don_dong SET don_id = ? WHERE id = ?').run(vao.id, x.id);
    }
    const luc = gio();
    db.prepare("UPDATE don SET trang_thai = 'da_huy', ly_do_huy = ?, gop_vao = ?, giu_den = NULL, sdt_goi_y = NULL, sua_luc = ? WHERE id = ?")
      .run(`đã gộp vào ${vao.ma}`, vao.id, luc, tu.id);
    ghiLichSu(db, tu.id, { tu: tu.trang_thai, den: 'da_huy', nguon: boi === 'nguoi' ? 'nguoi' : 'khach_tu_bao', ghiChu: `đã gộp vào ${vao.ma}` });
    ghiLichSu(db, vao.id, { tu: vao.trang_thai, den: vao.trang_thai, nguon: boi === 'nguoi' ? 'nguoi' : 'khach_tu_bao', ghiChu: `gộp món từ ${tu.ma}` });
    tinhLai(db, vao.id);
    veChoSauSua(db, vao.id, boi);
    if (layDon(vao.id, db).trang_thai === 'cho_xac_nhan') {
      db.prepare('UPDATE don SET giu_den = MAX(COALESCE(giu_den, ?), ?) WHERE id = ?').run(luc, new Date(Date.now() + caiDat.banHang().gio_giu * GIO_MS).toISOString(), vao.id);
    }
    return layDon(vao.id, db);
  });
}

/* ---------------- hỏi lại trước khi gửi (F-99), hỏi thăm sau gửi (F-100) ---------------- */

/** Đếm đơn Đã giao / Hoàn của người mua (theo hồ sơ khách, chưa có hồ sơ thì theo người Facebook), trừ đơn này. */
function lichSuMua(d, db = csdl()) {
  const [cot, v] = d.khach_id ? ['khach_id', d.khach_id] : ['nguoi_fb_id', d.nguoi_fb_id];
  if (!v) return { giao: 0, hoan: 0 };
  const r = db.prepare(`SELECT SUM(trang_thai = 'da_giao') AS giao, SUM(trang_thai = 'hoan') AS hoan FROM don WHERE ${cot} = ? AND id != ?`).get(v, d.id);
  return { giao: r.giao || 0, hoan: r.hoan || 0 };
}

/**
 * "Nên hỏi lại" (F-99, #120) — CHỈ từ lịch sử đơn của shop (không tỉnh, tên, giới tính): khách mới + COD chưa nhận tiền + tổng ≥ ngưỡng
 * đơn lớn; hoặc từng hoàn ≥ 1 đơn mà dưới ngưỡng #73 (từ ngưỡng #73 đã có việc "Gọi xác nhận đơn"). Người quyết, máy chỉ đánh dấu.
 * @returns {{nen:boolean, ly_do:string}}
 */
function mucHoiLai(d) {
  const b = caiDat.banHang();
  const ls = lichSuMua(d);
  if (ls.hoan >= b.nguong_hoan) return { nen: false, ly_do: '' };
  if (ls.hoan >= 1) return { nen: true, ly_do: `từng hoàn ${ls.hoan} đơn` };
  if (!ls.giao && d.thanh_toan === 'cod' && !d.da_nhan_tien_luc && d.tong_tien >= b.nguong_don_lon) {
    return { nen: true, ly_do: `khách mới · COD · ${hienTien(d.tong_tien)}` };
  }
  return { nen: false, ly_do: '' };
}

/** Đơn Đã xác nhận ≥ 2 giờ, chưa hỏi lại, đáng hỏi lại. */
function donCanHoiLai(bayGio = Date.now()) {
  const db = csdl();
  return db.prepare("SELECT id FROM don WHERE trang_thai = 'da_xac_nhan' AND hoi_lai IS NULL AND tra_kho_luc IS NULL").all().map((r) => layDon(r.id, db))
    .filter((d) => {
      const xn = db.prepare("SELECT MAX(luc) AS luc FROM don_lich_su WHERE don_id = ? AND den = 'da_xac_nhan' AND da_hoan_tac = 0").get(d.id).luc;
      return xn && bayGio - new Date(xn).getTime() >= 2 * GIO_MS && mucHoiLai(d).nen;
    });
}

function ghiHoiLai(donId, trangThai, { ghiChu = null, nguon = 'he_thong' } = {}) {
  return giaoDich((db) => {
    const d = layDon(donId, db);
    db.prepare('UPDATE don SET hoi_lai = ?, hoi_lai_luc = ? WHERE id = ?').run(trangThai, gio(), d.id);
    if (ghiChu) ghiLichSu(db, d.id, { tu: d.trang_thai, den: d.trang_thai, nguon, ghiChu });
    return layDon(d.id, db);
  });
}

/** Đã hỏi lại quá 24 giờ mà khách chưa trả lời. */
function donHoiLaiQuaHan(bayGio = Date.now()) {
  return csdl().prepare("SELECT id FROM don WHERE hoi_lai = 'da_hoi' AND hoi_lai_luc <= ? AND trang_thai = 'da_xac_nhan'")
    .all(new Date(bayGio - 24 * GIO_MS).toISOString()).map((r) => layDon(r.id));
}

/**
 * Đơn cần hỏi thăm "mặc thấy sao" (F-100): Đã gửi / Đã giao từ N ngày (tính từ lúc chuyển Đã gửi), chưa hỏi, không Hoàn / Hủy; mỗi
 * người chỉ đơn mới nhất; một người không bị hỏi 2 lần trong 14 ngày.
 */
function donCanHoiMac(bayGio = Date.now()) {
  const db = csdl();
  const moc = new Date(bayGio - caiDat.banHang().so_ngay_hoi_mac * 24 * GIO_MS).toISOString();
  const ds = db.prepare(`SELECT d.id, MAX(l.luc) AS gui_luc FROM don d JOIN don_lich_su l ON l.don_id = d.id AND l.den = 'da_gui' AND l.da_hoan_tac = 0
      WHERE d.trang_thai IN ('da_gui', 'da_giao') AND d.hoi_mac_luc IS NULL AND d.tra_kho_luc IS NULL GROUP BY d.id HAVING gui_luc <= ? ORDER BY gui_luc DESC`).all(moc)
    .map((r) => layDon(r.id, db));
  const daChon = new Set();
  const tu14 = new Date(bayGio - 14 * 24 * GIO_MS).toISOString();
  return ds.filter((d) => {
    const k = d.khach_id || d.nguoi_fb_id;
    if (!k || daChon.has(k)) return false;
    daChon.add(k);
    return !db.prepare('SELECT 1 FROM don WHERE hoi_mac_luc > ? AND ((? IS NOT NULL AND khach_id = ?) OR (? IS NOT NULL AND nguoi_fb_id = ?)) LIMIT 1')
      .get(tu14, d.khach_id, d.khach_id, d.nguoi_fb_id, d.nguoi_fb_id);
  });
}

function ghiHoiMac(donId) {
  csdl().prepare('UPDATE don SET hoi_mac_luc = COALESCE(hoi_mac_luc, ?) WHERE id = ?').run(gio(), donId);
}

function ghiPhanHoiMac(donId, kieu) {
  if (!['vua', 'chat', 'rong'].includes(kieu)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Phản hồi lạ.');
  csdl().prepare('UPDATE don SET phan_hoi_mac = ?, phan_hoi_mac_luc = ? WHERE id = ?').run(kieu, gio(), donId);
  return layDon(donId);
}

/** Đơn đã gộp vào đơn này (truy ngược, mục tiêu 4 SPEC). */
function donGopVao(donId) {
  return csdl().prepare('SELECT id, ma FROM don WHERE gop_vao = ? ORDER BY tao_luc').all(donId);
}

/**
 * F-70: đơn Chờ xác nhận của buổi mà người bình luận có tên đúng bằng `ten` (bỏ dấu, không phân biệt hoa thường) và CHƯA gắn
 * Messenger — ứng viên khi khách vào bằng link m.me?ref=phien_<id>. Mới nhất trước. Luôn hỏi lại bằng nút, không tự gắn.
 */
function donChotTheoTen(phienId, ten) {
  const g = boDau(String(ten || '')).trim();
  if (!g) return [];
  return csdl().prepare(`SELECT d.id, n.ten_hien_thi FROM don d JOIN nguoi_fb n ON n.id = d.nguoi_fb_id
                          WHERE d.phien_live_id = ? AND d.trang_thai = 'cho_xac_nhan' AND n.psid IS NULL ORDER BY d.tao_luc DESC`)
    .all(phienId).filter((r) => boDau(r.ten_hien_thi || '').trim() === g).map((r) => layDon(r.id));
}

/**
 * F-88: số điện thoại khách lỡ ghi trong bình luận chốt (bình luận đã bị ẩn — #19) — chỉ để hiện nút [Dùng số 0912***678] cho
 * đúng đơn này, không tự điền vào đơn, không vào hồ sơ khách.
 */
function datSdtGoiY(donId, sdt) {
  const so = require('./khach').chuanSdt(sdt);
  if (so) csdl().prepare("UPDATE don SET sdt_goi_y = ? WHERE id = ? AND trang_thai = 'cho_xac_nhan'").run(so, donId);
}

/** F-88 "Như đơn trước": đơn Đã gửi / Đã giao gần nhất của cùng hồ sơ / người (không lấy đơn Hoàn), còn địa chỉ. */
function donCuDaGiao({ khachId = null, nguoiFbId = null, truId = null }) {
  const r = csdl().prepare(`SELECT id FROM don WHERE trang_thai IN ('da_gui', 'da_giao') AND dia_chi_nhan IS NOT NULL AND sdt_nhan IS NOT NULL
                            AND ((? IS NOT NULL AND khach_id = ?) OR (? IS NOT NULL AND nguoi_fb_id = ?)) AND id <> COALESCE(?, '')
                            ORDER BY sua_luc DESC LIMIT 1`).get(khachId, khachId, nguoiFbId, nguoiFbId, truId);
  return r ? layDon(r.id) : null;
}

/** Tối đa 3 đơn của một người (đơn mở trước) — menu "Đơn của tôi" (F-88). */
function donCuaNguoi({ khachId = null, nguoiFbId = null }) {
  return csdl().prepare(`SELECT id FROM don WHERE (? IS NOT NULL AND khach_id = ?) OR (? IS NOT NULL AND nguoi_fb_id = ?)
                          ORDER BY CASE WHEN trang_thai IN ('cho_xac_nhan', 'da_xac_nhan', 'da_gui') THEN 0 ELSE 1 END, tao_luc DESC LIMIT 3`)
    .all(khachId, khachId, nguoiFbId, nguoiFbId).map((r) => layDon(r.id));
}

/** "Chưa liên lạc được" (F-69): đơn chờ chưa có số, người này không nhắn Messenger trong 24 giờ — tính từ dữ liệu, không lưu. */
function chuaLienLacDuoc(d, bayGio = Date.now()) {
  if (d.trang_thai !== 'cho_xac_nhan' || d.sdt_nhan) return false;
  const r = csdl().prepare(`SELECT MAX(tin_khach_cuoi_luc) AS luc FROM hoi_thoai WHERE kenh = 'messenger' AND (id = ? OR (nguoi_fb_id IS NOT NULL AND nguoi_fb_id = ?))`)
    .get(d.hoi_thoai_id, d.nguoi_fb_id);
  return !r?.luc || bayGio - new Date(r.luc).getTime() > 24 * GIO_MS;
}

/* ---------------- tìm, danh sách ---------------- */

/**
 * Danh sách đơn (màn hình Đơn hàng): lọc trạng thái, buổi live, khoảng ngày, "chưa nhận tiền"; tìm mã, tên, số điện thoại.
 */
/** GD1 (F-123): 4 nhóm của màn Đơn hàng — lọc theo nhóm trạng thái; giữ nguyên tham số cũ. */
const NHOM_DON = { can_lam: ['cho_xac_nhan', 'da_xac_nhan'], dang_giao: ['da_gui'], xong: ['da_giao'], huy_hoan: ['da_huy', 'hoan'] };

function danhSach({ trangThai = '', nhom = '', phienLiveId = '', tu = '', den = '', q = '', chuaNhanTien = false, thanhToan = '', dienTap = null, gioiHan = 500 } = {}) {
  const dk = [];
  const ts = [];
  if (trangThai) { dk.push('d.trang_thai = ?'); ts.push(trangThai); }
  if (nhom && NHOM_DON[nhom]) { dk.push(`d.trang_thai IN (${NHOM_DON[nhom].map(() => '?').join(', ')})`); ts.push(...NHOM_DON[nhom]); }
  if (phienLiveId) { dk.push('d.phien_live_id = ?'); ts.push(phienLiveId); }
  if (tu) { dk.push('d.tao_luc >= ?'); ts.push(new Date(tu).toISOString()); }
  if (den) { dk.push('d.tao_luc < ?'); ts.push(new Date(den).toISOString()); }
  if (chuaNhanTien) dk.push("d.da_nhan_tien_luc IS NULL AND d.trang_thai NOT IN ('da_huy', 'hoan')");
  if (thanhToan) { dk.push('d.thanh_toan = ?'); ts.push(thanhToan); }
  if (dienTap !== null) { dk.push('d.dien_tap = ?'); ts.push(dienTap ? 1 : 0); }
  // Cần gửi: cũ trước (F-57); còn lại mới trước.
  const thuTu = trangThai === 'da_xac_nhan' || nhom === 'can_lam' ? 'd.tao_luc ASC' : 'd.tao_luc DESC';
  const db = csdl();
  // F-118: số đơn Hoàn của khách để danh sách hiện nhãn "Từng hoàn" (chỉ người của shop thấy).
  let ds = db.prepare(`SELECT d.*, (SELECT ten_hien_thi FROM nguoi_fb n WHERE n.id = d.nguoi_fb_id) AS ten_fb,
                         (SELECT COUNT(*) FROM don h WHERE d.khach_id IS NOT NULL AND h.khach_id = d.khach_id AND h.trang_thai = 'hoan') AS so_hoan_khach FROM don d
                       ${dk.length ? `WHERE ${dk.join(' AND ')}` : ''} ORDER BY ${thuTu} LIMIT ?`).all(...ts, gioiHan).map((r) => docDon(db, r));
  const tim = boDau(q).trim();
  if (tim) {
    const so = tim.replace(/\D/g, '').replace(/^0/, '');
    ds = ds.filter((d) => boDau(`${d.ma} ${d.ten_nhan} ${d.ten_fb || ''}`).includes(tim) || (so.length >= 4 && (d.sdt_nhan || '').includes(so)));
  }
  return ds;
}

/** Số đơn mỗi nhóm (cho nhãn số ở các tab). */
function demTheoNhom({ dienTap = false } = {}) {
  const tt = demTheoTrangThai({ dienTap });
  return Object.fromEntries(Object.entries(NHOM_DON).map(([k, ds]) => [k, ds.reduce((s, t) => s + (tt[t] || 0), 0)]));
}

function demTheoTrangThai({ dienTap = false } = {}) {
  const kq = Object.fromEntries(TRANG_THAI.map((t) => [t, 0]));
  for (const r of csdl().prepare('SELECT trang_thai, COUNT(*) AS n FROM don WHERE dien_tap = ? GROUP BY trang_thai').all(dienTap ? 1 : 0)) kq[r.trang_thai] = r.n;
  return kq;
}

/** Đơn đang mở (Chờ xác nhận / Đã xác nhận) của một người Facebook trong một buổi live — gộp chốt nhiều món (F-53). */
function donMoTrongPhien(nguoiFbId, phienLiveId) {
  const r = csdl().prepare(`SELECT id FROM don WHERE nguoi_fb_id = ? AND phien_live_id = ? AND trang_thai IN ('cho_xac_nhan', 'da_xac_nhan')
                            ORDER BY tao_luc DESC LIMIT 1`).get(nguoiFbId, phienLiveId);
  return r ? layDon(r.id) : null;
}

/** Đơn đi theo hội thoại đang trao đổi (khách chốt ở bình luận, trả lời trong Messenger). */
function ganHoiThoai(donId, hoiThoaiId) {
  csdl().prepare('UPDATE don SET hoi_thoai_id = ? WHERE id = ?').run(hoiThoaiId, donId);
}

/** Đơn đang mở gắn với một hội thoại hoặc người Facebook (Tư vấn viên lên đơn tiếp). */
function donMoCuaNguoi({ hoiThoaiId = null, nguoiFbId = null, khachId = null }) {
  const r = csdl().prepare(`SELECT id FROM don WHERE (hoi_thoai_id = ? OR nguoi_fb_id = ? OR (khach_id IS NOT NULL AND khach_id = ?))
                            AND trang_thai IN ('cho_xac_nhan', 'da_xac_nhan') ORDER BY tao_luc DESC LIMIT 1`).get(hoiThoaiId, nguoiFbId, khachId);
  return r ? layDon(r.id) : null;
}

/**
 * Khối chữ đơn cho AI (#79 `xem_don`, `cap_nhat_don`): món, đơn giá, phí ship, tổng tiền (dòng dữ liệu để trích, K2/K10),
 * còn hàng của từng món, hạn giữ, việc còn thiếu. Không có số điện thoại đầy đủ (che bớt).
 */
function khoiChoAi(d) {
  const tt = TEN_TRANG_THAI[d.trang_thai];
  const dong = [
    `Đơn ${d.ma} · ${tt} · ${d.thanh_toan === 'cod' ? 'thanh toán khi nhận hàng (COD)' : 'chuyển khoản'}`,
    ...d.dong.map((x) => `- ${x.ten_chup} x${x.so_luong}: ${hienTien(x.don_gia * x.so_luong)} (đơn giá ${hienTien(x.don_gia)})`),
    `Tổng hàng đơn ${d.ma}: ${hienTien(d.tong_hang)}`,
    `Phí ship đơn ${d.ma}: ${hienTien(d.phi_ship)}`,
    `Tổng tiền đơn ${d.ma}: ${hienTien(d.tong_tien)}`,
  ];
  if (phiShipTheoCaiDat(d.tong_hang).chua_dat && !d.nguoi_sua_luc) dong.push('(Shop chưa đặt phí ship: nói với khách shop sẽ báo phí ship, không tự nói số.)');
  const nguoiNhan = [d.ten_nhan || 'chưa có tên', d.sdt_nhan ? `0${d.sdt_nhan.slice(3, 6)}***${d.sdt_nhan.slice(-3)}` : 'chưa có số', d.dia_chi_nhan || 'chưa có địa chỉ'];
  dong.push(`Người nhận: ${nguoiNhan.join(' · ')}`);
  if (d.trang_thai === 'cho_xac_nhan' && d.giu_den) {
    dong.push(`Giữ hàng tới: ${new Date(d.giu_den).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`);
  }
  if (d.ma_van_don) dong.push(`Mã vận đơn: ${d.ma_van_don}`);
  dong.push(...require('./gia-noi-nham').dongChoAi(d.id)); // F-106
  const thieu = SUA_DUOC.includes(d.trang_thai) ? viecConThieu(d) : [];
  if (d.trang_thai === 'cho_xac_nhan') {
    dong.push(`Việc còn thiếu: ${[...thieu, 'đọc lại đơn và tổng tiền, chờ khách nói đồng ý rồi xác nhận'].join('; ')}`);
  }
  return dong.join('\n');
}

module.exports = {
  mucHoiLai, donCanHoiLai, ghiHoiLai, donHoiLaiQuaHan, donCanHoiMac, ghiHoiMac, ghiPhanHoiMac,
  taoDonTrong,
  tienConThieuMienShip, monPhoiGoiY, daGoiYPhoi, ghiGoiYPhoi, donMoKhac, ghiHoiGop, gopDon, donGopVao,
  TRANG_THAI, TEN_TRANG_THAI, layDon, lichSu, taoDon, themMon, botMon, doiPhanLoai, datThongTinGiao, datPhiShip, doiTrangThai,
  hoanTac, nhanTien, nhanHoan, guiNhieu, huyQuaGio, danhSach, demTheoTrangThai, demTheoNhom, NHOM_DON, donMoTrongPhien, donMoCuaNguoi, khoiChoAi,
  donCanNhac, donCanBaoHuy, donChotTheoTen, datSdtGoiY, donCuDaGiao, donCuaNguoi, ghiNhac, ghiBaoHuy, datLai, chuaLienLacDuoc, tinhGiuDen, batDauGiuDai, khachTuongTac, rutGiuNgan, cheSo, viecConThieu, phiShipTheoCaiDat, giuTrong, ganHoiThoai, datMaVanDon, canNhanChuDong, danhDauNhan,
  tinhLaiTrong: tinhLai, ghiLichSuTrong: ghiLichSu, // F-106: chỉ gọi TRONG giao dịch (gia-noi-nham.js)
};
