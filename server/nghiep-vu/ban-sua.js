'use strict';

/**
 * Quản lý phiên bản dùng chung cho Skill và lời dặn vai trò (F-11, F-12):
 *  - mỗi đối tượng có đúng một bản `dang_dung` (AI dùng bản này), tối đa một bản `nhap` đang soạn;
 *  - "Kích hoạt" đưa bản nháp lên dùng, bản đang dùng thành `cu`;
 *  - "Quay lại bản trước" dùng lại bản `cu` gần nhất, có tác dụng ngay ở lần chạy kế tiếp.
 * Bản `dang_dung` và `cu` không bao giờ bị sửa nội dung: nhật ký chạy AI ghi số bản đã dùng
 * và phải mở lại được đúng chữ của bản đó (F-13).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, gio } = require('./chung');

/**
 * @param {{bang:string, cotKhoa:string, truong:string[]}} o  tên bảng và cột là hằng trong mã, không từ người dùng.
 */
function taoBoBanSua({ bang, cotKhoa, truong }) {
  const cot = truong.join(', ');

  const lay = (khoa, trangThai) => csdl()
    .prepare(`SELECT * FROM ${bang} WHERE ${cotKhoa} = ? AND trang_thai = ? ORDER BY phien_ban DESC LIMIT 1`)
    .get(khoa, trangThai) || null;

  const layBan = (khoa, phienBan) => csdl()
    .prepare(`SELECT * FROM ${bang} WHERE ${cotKhoa} = ? AND phien_ban = ?`).get(khoa, phienBan) || null;

  function danhSach(khoa) {
    return csdl().prepare(`SELECT * FROM ${bang} WHERE ${cotKhoa} = ? ORDER BY phien_ban DESC`).all(khoa);
  }

  function them(db, khoa, duLieu, trangThai) {
    const { so } = db.prepare(`SELECT COALESCE(MAX(phien_ban), 0) + 1 AS so FROM ${bang} WHERE ${cotKhoa} = ?`).get(khoa);
    db.prepare(`INSERT INTO ${bang} (${cotKhoa}, phien_ban, ${cot}, trang_thai, luc) VALUES (?, ?, ${truong.map(() => '?').join(', ')}, ?, ?)`)
      .run(khoa, so, ...truong.map((t) => duLieu[t] ?? ''), trangThai, gio());
    return so;
  }

  /** Lần chạy đầu: chưa có bản nào thì tạo bản 1 đang dùng. */
  function gieo(khoa, duLieu) {
    giaoDich((db) => {
      const co = db.prepare(`SELECT 1 FROM ${bang} WHERE ${cotKhoa} = ? LIMIT 1`).get(khoa);
      if (!co) them(db, khoa, duLieu, 'dang_dung');
    });
  }

  /** Lưu bản nháp: đã có nháp thì ghi đè nháp đó, chưa có thì tạo bản mới. Không đụng bản đang dùng. */
  function luuNhap(khoa, duLieu) {
    return giaoDich((db) => {
      const nhap = lay(khoa, 'nhap');
      if (nhap) {
        db.prepare(`UPDATE ${bang} SET ${truong.map((t) => `${t} = ?`).join(', ')}, luc = ? WHERE ${cotKhoa} = ? AND phien_ban = ?`)
          .run(...truong.map((t) => duLieu[t] ?? ''), gio(), khoa, nhap.phien_ban);
        return nhap.phien_ban;
      }
      return them(db, khoa, duLieu, 'nhap');
    });
  }

  /** Đưa một bản lên dùng (mặc định: bản nháp). */
  function kichHoat(khoa, phienBan = null) {
    return giaoDich((db) => {
      const dich = phienBan == null ? lay(khoa, 'nhap') : layBan(khoa, phienBan);
      if (!dich) {
        throw new LoiNghiepVu('KHONG_TIM_THAY', phienBan == null ? 'Chưa có bản nháp để kích hoạt.' : `Không có bản ${phienBan}.`, 404);
      }
      db.prepare(`UPDATE ${bang} SET trang_thai = 'cu' WHERE ${cotKhoa} = ? AND trang_thai = 'dang_dung'`).run(khoa);
      db.prepare(`UPDATE ${bang} SET trang_thai = 'dang_dung', luc = CASE WHEN trang_thai = 'nhap' THEN ? ELSE luc END
                  WHERE ${cotKhoa} = ? AND phien_ban = ?`).run(gio(), khoa, dich.phien_ban);
      return dich.phien_ban;
    });
  }

  /** "Quay lại bản trước": dùng lại bản cũ gần nhất đứng trước bản đang dùng. */
  function quayLai(khoa) {
    const hienTai = lay(khoa, 'dang_dung');
    const truoc = hienTai && csdl().prepare(
      `SELECT phien_ban FROM ${bang} WHERE ${cotKhoa} = ? AND trang_thai = 'cu' AND phien_ban < ? ORDER BY phien_ban DESC LIMIT 1`,
    ).get(khoa, hienTai.phien_ban);
    if (!truoc) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không còn bản trước để quay lại.', 404);
    return kichHoat(khoa, truoc.phien_ban);
  }

  function boNhap(khoa) {
    // Bản nháp chưa từng được AI dùng nên xóa được; bản đã dùng thì không bao giờ xóa.
    csdl().prepare(`DELETE FROM ${bang} WHERE ${cotKhoa} = ? AND trang_thai = 'nhap'`).run(khoa);
  }

  /**
   * Nâng bản mẫu khi phần mềm có lời dặn / Skill mẫu mới (ví dụ bản 2.6: gọi việc bằng tên nhà máy, không đọc mã tin).
   * Chỉ nâng khi bản đang dùng còn đúng chữ một bản mẫu cũ — tức chủ dự án chưa sửa tay; đã sửa thì giữ nguyên.
   * Bản mới thành bản đang dùng, bản cũ thành `cu` ("Quay lại bản trước" vẫn về được). Bản nháp không đụng.
   * @param {object[]} cacBanCu  các bản mẫu cũ (mỗi bản đủ các trường)
   * @param {object} moi         bản mẫu mới
   * @returns {boolean} đã nâng hay không
   */
  function nangMau(khoa, cacBanCu, moi) {
    return giaoDich((db) => {
      const dung = db.prepare(`SELECT * FROM ${bang} WHERE ${cotKhoa} = ? AND trang_thai = 'dang_dung' ORDER BY phien_ban DESC LIMIT 1`).get(khoa);
      if (!dung) return false;
      const giong = (a, b) => truong.every((t) => String(a[t] ?? '') === String(b[t] ?? ''));
      if (giong(dung, moi) || !cacBanCu.some((cu) => giong(dung, cu))) return false;
      db.prepare(`UPDATE ${bang} SET trang_thai = 'cu' WHERE ${cotKhoa} = ? AND trang_thai = 'dang_dung'`).run(khoa);
      them(db, khoa, moi, 'dang_dung');
      return true;
    });
  }

  return {
    dangDung: (khoa) => lay(khoa, 'dang_dung'),
    nhap: (khoa) => lay(khoa, 'nhap'),
    layBan, danhSach, gieo, luuNhap, kichHoat, quayLai, boNhap, nangMau,
  };
}

module.exports = { taoBoBanSua };
