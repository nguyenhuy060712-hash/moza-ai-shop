'use strict';

/**
 * Bảng size (SPEC.md F-51 nhóm 4, mục 7 bảng `bang_size`).
 *
 * Một bảng là lưới: hàng = cỡ; cột chọn từ danh sách trong `thong-so.json` (`cot_bang_size`), mỗi ô một số hoặc khoảng
 * ("48–55"). Bảng dùng chung (ví dụ "Áo nữ form chuẩn") gắn cho nhiều sản phẩm: sửa một lần, mọi sản phẩm thấy số mới.
 * Bảng riêng (`rieng = 1`) tạo từ màn hình sản phẩm, không hiện trong danh sách dùng chung.
 * Mỗi lần lưu có thay đổi là một bản sửa (chỉ thêm) — tư vấn size của AI trích đúng dòng của bản đang dùng (A.4 K2).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, chuan, kiemChu } = require('./chung');
const { cot_bang_size: COT } = require('../cau-hinh/thong-so.json');

const TOI_DA_HANG = 20;

function doc(r) {
  return r ? { ...r, cot: JSON.parse(r.cot), hang: JSON.parse(r.hang), rieng: r.rieng === 1 } : null;
}

function kiemBang(duLieu, cu) {
  const ten = kiemChu(duLieu.ten ?? cu?.ten, { ten: 'Tên bảng size', batBuoc: true, toiDa: 80, motDong: true });
  const cot = [...new Set(duLieu.cot ?? cu?.cot ?? [])];
  if (!Array.isArray(cot) || !cot.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Bảng size cần ít nhất một cột (ví dụ Chiều cao, Cân nặng).');
  for (const k of cot) if (!Object.hasOwn(COT, k)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có cột "${k}" trong danh sách cột bảng size.`);
  const vao = duLieu.hang ?? cu?.hang ?? [];
  if (!Array.isArray(vao) || !vao.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Bảng size cần ít nhất một cỡ.');
  if (vao.length > TOI_DA_HANG) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Bảng size tối đa ${TOI_DA_HANG} cỡ.`);
  const daCo = new Set();
  const hang = vao.map((h, i) => {
    const co = kiemChu(h?.co, { ten: `Tên cỡ ở hàng ${i + 1}`, batBuoc: true, toiDa: 20, motDong: true });
    if (daCo.has(co.toLowerCase())) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Cỡ "${co}" có hai hàng.`);
    daCo.add(co.toLowerCase());
    const dong = { co };
    // Dấu gạch nối "48-55" viết thống nhất thành "48–55" để thẻ sản phẩm và câu AI trích khớp nhau.
    for (const k of cot) dong[k] = kiemChu(h?.[k] ?? '', { ten: `${COT[k].ten} cỡ ${co}`, toiDa: 30, motDong: true }).replace(/\s*-\s*/g, '–');
    return dong;
  });
  return { ten, cot, hang };
}

function ghiBanSua(db, b) {
  db.prepare('INSERT INTO bang_size_ban_sua (bang_size_id, phien_ban, ten, cot, hang, luc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(b.id, b.phien_ban, b.ten, JSON.stringify(b.cot), JSON.stringify(b.hang), b.sua_luc);
}

function taoBang(duLieu = {}) {
  const o = kiemBang(duLieu);
  return giaoDich((db) => {
    const b = { id: taoId('bs'), ...o, rieng: !!duLieu.rieng, phien_ban: 1, sua_luc: gio() };
    db.prepare('INSERT INTO bang_size (id, ten, cot, hang, rieng, phien_ban, sua_luc) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(b.id, b.ten, JSON.stringify(b.cot), JSON.stringify(b.hang), b.rieng ? 1 : 0, 1, b.sua_luc);
    ghiBanSua(db, b);
    return layBang(b.id);
  });
}

function layBang(id) {
  const b = doc(csdl().prepare('SELECT * FROM bang_size WHERE id = ?').get(id));
  if (!b) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy bảng size này.', 404);
  return b;
}

/** Sửa bảng: không đổi gì thì không tạo bản sửa. */
function suaBang(id, duLieu = {}) {
  return giaoDich((db) => {
    const cu = layBang(id);
    const o = kiemBang(duLieu, cu);
    if (JSON.stringify(o) === JSON.stringify({ ten: cu.ten, cot: cu.cot, hang: cu.hang })) return cu;
    const b = { ...cu, ...o, phien_ban: cu.phien_ban + 1, sua_luc: gio() };
    db.prepare('UPDATE bang_size SET ten = ?, cot = ?, hang = ?, phien_ban = ?, sua_luc = ? WHERE id = ?')
      .run(b.ten, JSON.stringify(b.cot), JSON.stringify(b.hang), b.phien_ban, b.sua_luc, id);
    ghiBanSua(db, b);
    return layBang(id);
  });
}

/** Các bảng dùng chung, kèm số sản phẩm đang dùng mỗi bảng. */
function danhSachBang({ caRieng = false } = {}) {
  return csdl().prepare(`SELECT b.*, (SELECT COUNT(*) FROM san_pham s WHERE s.bang_size_id = b.id) AS so_san_pham
                         FROM bang_size b ${caRieng ? '' : 'WHERE b.rieng = 0'} ORDER BY b.ten`).all().map(doc);
}

function banSuaBang(id) {
  layBang(id);
  return csdl().prepare('SELECT * FROM bang_size_ban_sua WHERE bang_size_id = ? ORDER BY phien_ban DESC').all(id).map(doc);
}

function layBanSua(id, phienBan) {
  return doc(csdl().prepare('SELECT * FROM bang_size_ban_sua WHERE bang_size_id = ? AND phien_ban = ?').get(id, phienBan));
}

/** Ô "155–162" → "155–162 cm"; ô đã có chữ ("M trở xuống", "48kg") để nguyên. */
function giaTriCoDonVi(k, v) {
  const s = chuan(v).trim();
  if (!s) return '';
  return /^[\d.,–\s]+$/.test(s) ? `${s} ${COT[k].don_vi}` : s;
}

/**
 * Dòng dữ liệu cho AI và Bộ kiểm tra: "Size M: chiều cao 155–162 cm, cân nặng 48–55 kg" (A.4 K2).
 * Tư vấn size của AI chỉ dựa vào các dòng này (F-51).
 */
function dongChoAi(b) {
  if (!b) return [];
  return b.hang.map((h) => {
    const o = b.cot.map((k) => [k, giaTriCoDonVi(k, h[k])]).filter(([, v]) => v).map(([k, v]) => `${COT[k].ten.toLowerCase()} ${v}`);
    return `Size ${h.co}: ${o.length ? o.join(', ') : '(chưa có số đo)'}`;
  });
}

module.exports = { COT, taoBang, layBang, suaBang, danhSachBang, banSuaBang, layBanSua, dongChoAi };
