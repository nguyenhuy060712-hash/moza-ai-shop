'use strict';

/**
 * Hàng chờ duyệt (F-08): hành động có luật "Hỏi", hoặc bị công tắc "Dừng mọi thứ" giữ lại.
 * Không làm gì cho tới khi người dùng bấm Duyệt. Duyệt thì agent/cong-cu thực hiện đúng tham số đã lưu.
 */

const { csdl } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio } = require('./chung');
const { anKhoa } = require('../khoa');

function doc(r) {
  return r ? { ...r, tham_so: JSON.parse(r.tham_so), ket_qua: r.ket_qua == null ? null : JSON.parse(r.ket_qua) } : null;
}

/** `hetHanGio`: việc do "Dừng mọi thứ" / giới hạn tin sinh ra tự hết hạn sau chừng này giờ (F-121); bỏ trống = không hết hạn. */
function taoMuc({ runId = null, hanhDong, thamSo, lyDo, hetHanGio = null }) {
  const id = taoId('cd');
  const hetHan = hetHanGio > 0 ? new Date(Date.now() + hetHanGio * 3600000).toISOString() : null;
  csdl().prepare('INSERT INTO cho_duyet (id, run_id, hanh_dong, tham_so, ly_do, luc, het_han_luc) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, runId, hanhDong, anKhoa(JSON.stringify(thamSo || {})), anKhoa(lyDo), gio(), hetHan);
  return layMuc(id);
}

function layMuc(id) {
  const r = doc(csdl().prepare('SELECT * FROM cho_duyet WHERE id = ?').get(id));
  if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy mục chờ duyệt này.', 404);
  return r;
}

/** `trangThai`: cho (còn hạn) · het_han (đang 'cho' nhưng quá hạn — để xem lại) · duyet · tu_choi. */
function danhSach({ trangThai = 'cho', gioiHan = 100 } = {}) {
  const bay = gio();
  if (trangThai === 'het_han') {
    return csdl().prepare("SELECT * FROM cho_duyet WHERE trang_thai = 'cho' AND het_han_luc IS NOT NULL AND het_han_luc <= ? ORDER BY luc DESC LIMIT ?").all(bay, gioiHan).map(doc);
  }
  if (trangThai === 'cho') {
    return csdl().prepare("SELECT * FROM cho_duyet WHERE trang_thai = 'cho' AND (het_han_luc IS NULL OR het_han_luc > ?) ORDER BY luc DESC LIMIT ?").all(bay, gioiHan).map(doc);
  }
  return csdl().prepare('SELECT * FROM cho_duyet WHERE trang_thai = ? ORDER BY luc DESC LIMIT ?').all(trangThai, gioiHan).map(doc);
}

function demCho() {
  return csdl().prepare("SELECT COUNT(*) AS n FROM cho_duyet WHERE trang_thai = 'cho' AND (het_han_luc IS NULL OR het_han_luc > ?)").get(gio()).n;
}

function demHetHan() {
  return csdl().prepare("SELECT COUNT(*) AS n FROM cho_duyet WHERE trang_thai = 'cho' AND het_han_luc IS NOT NULL AND het_han_luc <= ?").get(gio()).n;
}

/** Chốt một mục: chỉ mục đang chờ mới chốt được, để hai lần bấm không làm hành động hai lần. */
function chot(id, trangThai, ketQua = null) {
  const r = csdl().prepare("UPDATE cho_duyet SET trang_thai = ?, ket_qua = ?, xu_ly_luc = ? WHERE id = ? AND trang_thai = 'cho'")
    .run(trangThai, ketQua == null ? null : anKhoa(JSON.stringify(ketQua)), gio(), id);
  if (!r.changes) throw new LoiNghiepVu('DA_XU_LY', 'Mục này đã được xử lý rồi.', 409);
  return layMuc(id);
}

function ghiKetQua(id, ketQua) {
  csdl().prepare('UPDATE cho_duyet SET ket_qua = ? WHERE id = ?').run(anKhoa(JSON.stringify(ketQua)), id);
  return layMuc(id);
}

module.exports = { taoMuc, layMuc, danhSach, demCho, demHetHan, chot, ghiKetQua };
