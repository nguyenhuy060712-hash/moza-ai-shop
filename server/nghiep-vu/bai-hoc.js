'use strict';

/**
 * Bài học (SPEC.md F-36, A.7 "bộ nhớ ba tầng" — tầng Bài học): AI đề xuất từ 👎 kèm lý do; **người duyệt** thì mới thành
 * Skill (thêm vào "Cách làm" của Skill thành một bản sửa mới và kích hoạt) hoặc mục Sổ tay (thêm vào nội dung mục, bản sửa mới).
 * Bài học chưa duyệt không được nạp vào bất kỳ lần chạy nào (không có đường nào đọc bảng này cho AI).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, kiemChu } = require('./chung');
const skill = require('./skill');
const soTay = require('./so-tay');

function doc(r) {
  return r ? { ...r, nguon_run_ids: JSON.parse(r.nguon_run_ids || '[]') } : null;
}

function lay(id) {
  const r = doc(csdl().prepare('SELECT * FROM bai_hoc WHERE id = ?').get(id));
  if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy bài học này.', 404);
  return r;
}

function tao({ noiDung, dich = 'skill', dichId = null, runIds = [], lyDo = null, danhGiaId = null }) {
  if (!['skill', 'so_tay'].includes(dich)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Bài học chỉ ghi vào Skill hoặc Sổ tay.');
  const id = taoId('bh');
  csdl().prepare(`INSERT INTO bai_hoc (id, noi_dung, dich, dich_id, nguon_run_ids, ly_do, danh_gia_id, luc)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, kiemChu(noiDung, { ten: 'Bài học', batBuoc: true, toiDa: 1500 }), dich, dichId || null, JSON.stringify(runIds), lyDo, danhGiaId, gio());
  return lay(id);
}

function danhSach({ trangThai = null } = {}) {
  const ds = trangThai
    ? csdl().prepare('SELECT * FROM bai_hoc WHERE trang_thai = ? ORDER BY luc DESC').all(trangThai)
    : csdl().prepare("SELECT * FROM bai_hoc ORDER BY trang_thai = 'cho_duyet' DESC, luc DESC LIMIT 200").all();
  return ds.map(doc);
}

function demCho() {
  return csdl().prepare("SELECT COUNT(*) AS n FROM bai_hoc WHERE trang_thai = 'cho_duyet'").get().n;
}

/**
 * Người duyệt (có thể sửa chữ, đổi nơi ghi trước khi duyệt) → ghi vào Skill hoặc Sổ tay thành bản sửa mới.
 * @param {string} id
 * @param {{noi_dung?:string, dich?:'skill'|'so_tay', dich_id?:string}} [sua]
 */
function duyet(id, sua = {}) {
  const bh = lay(id);
  if (bh.trang_thai !== 'cho_duyet') throw new LoiNghiepVu('DA_XU_LY', 'Bài học này đã xử lý.', 409);
  const noiDung = sua.noi_dung !== undefined ? kiemChu(sua.noi_dung, { ten: 'Bài học', batBuoc: true, toiDa: 1500 }) : bh.noi_dung;
  const dich = sua.dich || bh.dich;
  const dichId = sua.dich_id || bh.dich_id;
  if (!dichId) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', dich === 'skill' ? 'Chọn Skill để ghi bài học.' : 'Chọn mục Sổ tay để ghi bài học.');
  const ngay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  if (dich === 'skill') {
    const x = skill.xem(dichId);
    const dd = x.dang_dung;
    skill.luuNhap(dichId, { cach_lam: `${dd.cach_lam}\n- Bài học (${ngay}): ${noiDung}`, vi_du_dung: dd.vi_du_dung, vi_du_sai: dd.vi_du_sai });
    skill.kichHoat(dichId);
  } else {
    const m = soTay.layMuc(dichId);
    soTay.suaMuc(dichId, { tieu_de: m.tieu_de, noi_dung: `${m.noi_dung}${m.noi_dung ? '\n' : ''}${noiDung}` });
  }
  giaoDich((db) => db.prepare("UPDATE bai_hoc SET trang_thai = 'da_duyet', noi_dung = ?, dich = ?, dich_id = ?, xu_ly_luc = ? WHERE id = ?")
    .run(noiDung, dich, dichId, gio(), id));
  return lay(id);
}

function bo(id) {
  const bh = lay(id);
  if (bh.trang_thai !== 'cho_duyet') throw new LoiNghiepVu('DA_XU_LY', 'Bài học này đã xử lý.', 409);
  csdl().prepare("UPDATE bai_hoc SET trang_thai = 'bo', xu_ly_luc = ? WHERE id = ?").run(gio(), id);
  return lay(id);
}

module.exports = { tao, lay, danhSach, demCho, duyet, bo };
