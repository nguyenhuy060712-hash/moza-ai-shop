'use strict';

/**
 * Mốc Facebook (SPEC.md mục 7 bảng `moc_facebook`): mốc kết nối đầu (sự kiện trước mốc không nhập — #5),
 * con trỏ lưới an toàn, địa chỉ đường hầm hiện tại.
 */

const { csdl } = require('../db/ket-noi');
const { gio } = require('./chung');

function lay(loai) {
  return csdl().prepare('SELECT con_tro, luc FROM moc_facebook WHERE loai = ?').get(loai) || null;
}

function dat(loai, conTro) {
  csdl().prepare(`INSERT INTO moc_facebook (loai, con_tro, luc) VALUES (?, ?, ?)
                  ON CONFLICT(loai) DO UPDATE SET con_tro = excluded.con_tro, luc = excluded.luc`).run(loai, conTro ?? null, gio());
}

/** Ghi mốc kết nối đầu nếu chưa có. Trả về mốc. */
function mocKetNoiDau() {
  const m = lay('ket_noi_dau');
  if (m) return m.con_tro;
  const bay = gio();
  dat('ket_noi_dau', bay);
  return bay;
}

module.exports = { lay, dat, mocKetNoiDau };
