'use strict';

/**
 * Tồn kho (SPEC.md F-52, mục 7).
 *
 *  - Mỗi ô phân loại có **tồn trong kho** (`phan_loai.ton`). **Đang giữ** = tổng số lượng các dòng đơn chưa gửi, chưa hủy
 *    (đơn Chờ xác nhận, Đã xác nhận). **Còn bán được** = tồn − đang giữ. Đơn hàng làm ở BH3; tới đó đang giữ = 0.
 *  - Mọi thay đổi tồn ghi một dòng `kho_lich_su` trong cùng giao dịch; bất biến: tồn = tổng thay đổi (test đối chiếu).
 *  - Không có đường nào làm tồn âm hay thấp hơn số đang giữ (bảng có CHECK, hàm kiểm trước khi ghi).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, chuan } = require('./chung');

// Đơn ở hai trạng thái này đang giữ hàng (#64).
const GIU = "('cho_xac_nhan', 'da_xac_nhan')";

function dangGiu(db, phanLoaiId) {
  return db.prepare(`SELECT COALESCE(SUM(d.so_luong), 0) AS n FROM don_dong d JOIN don o ON o.id = d.don_id
                     WHERE d.phan_loai_id = ? AND o.trang_thai IN ${GIU}`).get(phanLoaiId).n;
}

/** Ghi một thay đổi tồn + dòng lịch sử. Chỉ gọi bên trong giao dịch. */
function ghiThayDoi(db, pl, thayDoi, { lyDo, ghiChu = '', boi = 'nguoi', donId = null }) {
  const tonSau = pl.ton + thayDoi;
  if (tonSau < 0) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Tồn ${pl.sku} không thể âm.`);
  const giu = dangGiu(db, pl.id);
  if (tonSau < giu) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${pl.sku} đang giữ ${giu} cho đơn chưa gửi: tồn không thể nhỏ hơn ${giu}.`);
  }
  db.prepare('UPDATE phan_loai SET ton = ? WHERE id = ?').run(tonSau, pl.id);
  db.prepare(`INSERT INTO kho_lich_su (id, phan_loai_id, thay_doi, ton_sau, ly_do, don_id, ghi_chu, boi, luc)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(taoId('kls'), pl.id, thayDoi, tonSau, lyDo, donId, chuan(ghiChu).slice(0, 200), boi, gio());
  return tonSau;
}

function layPhanLoai(db, id) {
  const pl = db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(id);
  if (!pl) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy phân loại này.', 404);
  return pl;
}

function kiemSo(so, { ten, choPhepAm = false, toiThieu = 0 }) {
  const n = Number(so);
  if (!Number.isInteger(n) || (!choPhepAm && n < toiThieu) || Math.abs(n) > 1e6) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} phải là số nguyên${choPhepAm ? '' : ` từ ${toiThieu} trở lên`}.`);
  }
  return n;
}

/**
 * Nhập hàng: cộng thêm vào từng ô (F-52 "nhập hàng nhanh", F-62 "nhập thêm 10 áo 12 đen M").
 * @param {{phan_loai_id:string, so:number}[]} ds
 * @param {{ghiChu?:string, boi?:'nguoi'|'he_thong'}} o  ghiChu ví dụ "qua Mai" khi nhập bằng lời
 */
function nhap(ds, { ghiChu = '', boi = 'nguoi' } = {}) {
  if (!Array.isArray(ds) || !ds.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa có dòng nhập hàng nào.');
  return giaoDich((db) => ds.map((x) => {
    const pl = layPhanLoai(db, x.phan_loai_id);
    const so = kiemSo(x.so, { ten: `Số nhập của ${pl.sku}`, toiThieu: 1 });
    const ton = ghiThayDoi(db, pl, so, { lyDo: 'nhap_hang', ghiChu, boi });
    require('./cho-hang').nhuongSuatTrong(db, [pl.id]); // F-92: có hàng về → mời người chờ (cùng giao dịch)
    return { phan_loai_id: pl.id, sku: pl.sku, thay_doi: so, ton };
  }));
}

/**
 * Điều chỉnh (kiểm kê): đặt tồn về đúng số đếm được; ghi phần chênh.
 * @param {{phan_loai_id:string, ton:number}[]} ds
 */
function dieuChinh(ds, { ghiChu = '', boi = 'nguoi' } = {}) {
  if (!Array.isArray(ds) || !ds.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa có dòng điều chỉnh nào.');
  return giaoDich((db) => ds.map((x) => {
    const pl = layPhanLoai(db, x.phan_loai_id);
    const ton = kiemSo(x.ton, { ten: `Tồn mới của ${pl.sku}` });
    const chenh = ton - pl.ton;
    if (chenh) ghiThayDoi(db, pl, chenh, { lyDo: 'dieu_chinh', ghiChu, boi });
    if (chenh > 0) require('./cho-hang').nhuongSuatTrong(db, [pl.id]); // F-92
    return { phan_loai_id: pl.id, sku: pl.sku, thay_doi: chenh, ton };
  }));
}

/** Còn bán được của từng ô phân loại một sản phẩm (tính lúc hỏi — #80, K9). Ô bị bỏ không trả. */
function conHang(sanPhamId, db = csdl()) {
  return db.prepare('SELECT * FROM phan_loai WHERE san_pham_id = ? AND bo = 0 ORDER BY thu_tu, rowid').all(sanPhamId).map((pl) => {
    const giu = dangGiu(db, pl.id);
    return { ...pl, dang_giu: giu, con_ban_duoc: pl.ton - giu };
  });
}

/** Tổng còn bán được của nhiều sản phẩm một lần (danh sách sản phẩm, mục lục cho AI). */
function tongConTheoSanPham() {
  const r = csdl().prepare(`
    SELECT p.san_pham_id, SUM(p.ton) AS ton,
           SUM(p.ton - COALESCE((SELECT SUM(d.so_luong) FROM don_dong d JOIN don o ON o.id = d.don_id
                                 WHERE d.phan_loai_id = p.id AND o.trang_thai IN ${GIU}), 0)) AS con,
           MIN(p.ton - COALESCE((SELECT SUM(d.so_luong) FROM don_dong d JOIN don o ON o.id = d.don_id
                                 WHERE d.phan_loai_id = p.id AND o.trang_thai IN ${GIU}), 0)) AS con_it_nhat
    FROM phan_loai p WHERE p.bo = 0 GROUP BY p.san_pham_id`).all();
  return new Map(r.map((x) => [x.san_pham_id, { ton: x.ton, con: x.con, con_it_nhat: x.con_it_nhat }]));
}

function lichSu({ phanLoaiId = null, sanPhamId = null, gioiHan = 200 } = {}) {
  const dk = [];
  const ts = [];
  if (phanLoaiId) { dk.push('k.phan_loai_id = ?'); ts.push(phanLoaiId); }
  if (sanPhamId) { dk.push('p.san_pham_id = ?'); ts.push(sanPhamId); }
  return csdl().prepare(`SELECT k.*, p.sku, p.gt1, p.gt2, s.so, s.ten FROM kho_lich_su k
                         JOIN phan_loai p ON p.id = k.phan_loai_id JOIN san_pham s ON s.id = p.san_pham_id
                         ${dk.length ? `WHERE ${dk.join(' AND ')}` : ''} ORDER BY k.luc DESC, k.rowid DESC LIMIT ?`).all(...ts, gioiHan);
}

/** Bất biến mục 7: tồn = tổng thay đổi trong lịch sử. Trả các ô lệch (rỗng = khớp). Dùng trong test. */
function doiChieu() {
  return csdl().prepare(`SELECT p.id, p.sku, p.ton, COALESCE(SUM(k.thay_doi), 0) AS tong FROM phan_loai p
                         LEFT JOIN kho_lich_su k ON k.phan_loai_id = p.id GROUP BY p.id HAVING p.ton <> tong`).all();
}

/** Một phân loại theo id (null nếu không có). */
function phanLoai(id, db = csdl()) {
  return db.prepare('SELECT * FROM phan_loai WHERE id = ?').get(id) || null;
}

module.exports = { nhap, dieuChinh, conHang, tongConTheoSanPham, lichSu, doiChieu, ghiThayDoi, dangGiu, phanLoai };
