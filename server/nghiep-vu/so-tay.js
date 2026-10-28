'use strict';

/**
 * Sổ tay shop (SPEC.md F-05, A.7 "Bộ nhớ ba tầng").
 *
 * Những điều chung không thuộc sản phẩm nào: giới thiệu shop, cách chọn size (lời khuyên chung — số đo nằm ở Bảng size
 * của sản phẩm), giao hàng, thanh toán, đổi trả, câu hỏi thường gặp. Phí ship là số trong Cài đặt → Bán hàng, không ghi
 * ở đây. Chỉ người dùng sửa; mỗi lần lưu tạo bản sửa mới. AI trích từ Sổ tay được như trích từ thẻ sản phẩm (K2).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, kiemChu } = require('./chung');

// Mục mồi theo F-05 (bản bán hàng), để trống cho người dùng điền.
const MUC_MOI = [
  'Giới thiệu shop',
  'Cách chọn size',
  'Giao hàng',
  'Thanh toán',
  'Đổi trả',
  'Câu hỏi thường gặp',
];

function kiemO(duLieu, cu) {
  return {
    tieu_de: kiemChu(duLieu.tieu_de ?? cu?.tieu_de, { ten: 'Tiêu đề', batBuoc: true, toiDa: 120, motDong: true }),
    noi_dung: kiemChu(duLieu.noi_dung ?? cu?.noi_dung ?? '', { ten: 'Nội dung', toiDa: 20000 }),
  };
}

function ghiBanSua(db, m) {
  db.prepare('INSERT INTO so_tay_ban_sua (so_tay_id, phien_ban, tieu_de, noi_dung, luc) VALUES (?, ?, ?, ?, ?)')
    .run(m.id, m.phien_ban, m.tieu_de, m.noi_dung, m.sua_luc);
}

function themMuc(db, o) {
  const luc = gio();
  const thuTu = db.prepare('SELECT COALESCE(MAX(thu_tu), 0) + 1 AS n FROM so_tay').get().n;
  const m = { id: taoId('st'), ...o, phien_ban: 1, thu_tu: thuTu, tao_luc: luc, sua_luc: luc };
  db.prepare('INSERT INTO so_tay (id, tieu_de, noi_dung, phien_ban, thu_tu, tao_luc, sua_luc) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(m.id, m.tieu_de, m.noi_dung, m.phien_ban, m.thu_tu, m.tao_luc, m.sua_luc);
  ghiBanSua(db, m);
  return m;
}

/** Gieo các mục mồi khi Sổ tay còn trống (lần chạy đầu). */
function gieoMucMoi() {
  giaoDich((db) => {
    if (db.prepare('SELECT COUNT(*) AS n FROM so_tay').get().n > 0) return;
    for (const tieuDe of MUC_MOI) themMuc(db, { tieu_de: tieuDe, noi_dung: '' });
  });
}

function taoMuc(duLieu) {
  const o = kiemO(duLieu || {});
  return giaoDich((db) => themMuc(db, o));
}

function layMuc(id) {
  const m = csdl().prepare('SELECT * FROM so_tay WHERE id = ?').get(id);
  if (!m) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy mục Sổ tay này.', 404);
  return { ...m };
}

function suaMuc(id, duLieu) {
  return giaoDich((db) => {
    const cu = layMuc(id);
    const o = kiemO(duLieu || {}, cu);
    if (o.tieu_de === cu.tieu_de && o.noi_dung === cu.noi_dung) return cu;
    const m = { ...cu, ...o, phien_ban: cu.phien_ban + 1, sua_luc: gio() };
    db.prepare('UPDATE so_tay SET tieu_de = ?, noi_dung = ?, phien_ban = ?, sua_luc = ? WHERE id = ?')
      .run(m.tieu_de, m.noi_dung, m.phien_ban, m.sua_luc, id);
    ghiBanSua(db, m);
    return m;
  });
}

function danhSachMuc() {
  return csdl().prepare('SELECT * FROM so_tay ORDER BY thu_tu').all().map((r) => ({ ...r }));
}

function banSuaMuc(id) {
  layMuc(id);
  return csdl().prepare('SELECT * FROM so_tay_ban_sua WHERE so_tay_id = ? ORDER BY phien_ban DESC').all(id).map((r) => ({ ...r }));
}

function demMucTrong() {
  return csdl().prepare("SELECT COUNT(*) AS n FROM so_tay WHERE TRIM(noi_dung) = ''").get().n;
}

module.exports = { MUC_MOI, gieoMucMoi, taoMuc, layMuc, suaMuc, danhSachMuc, banSuaMuc, demMucTrong };
