'use strict';

/**
 * Chốt "bản đang chạy đã cũ".
 *
 * Node nạp file .js một lần lúc khởi động. Nếu file trên đĩa được cập nhật
 * trong khi chương trình đang chạy, trình duyệt sẽ nhận giao diện mới (file
 * tĩnh đọc lại mỗi lần) nhưng phía máy chủ vẫn là mã cũ — dẫn tới lỗi khó
 * hiểu kiểu "bấm nút thì báo lỗi".
 *
 * Ở đây so giờ sửa file với giờ khởi động để báo người dùng mở lại chương trình.
 */

const fs = require('fs');
const path = require('path');

const GOC = path.join(__dirname);
const KHOI_DONG = Date.now();
const CACH = 3000; // chỉ soi lại mỗi 3 giây cho nhẹ

let _luc = 0;
let _cu = false;

function quet(thuMuc) {
  let moiNhat = 0;
  let muc;
  try {
    muc = fs.readdirSync(thuMuc, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const m of muc) {
    const p = path.join(thuMuc, m.name);
    if (m.isDirectory()) {
      moiNhat = Math.max(moiNhat, quet(p));
    } else if (m.name.endsWith('.js')) {
      try {
        moiNhat = Math.max(moiNhat, fs.statSync(p).mtimeMs);
      } catch { /* bỏ qua file vừa bị xoá */ }
    }
  }
  return moiNhat;
}

/** true nếu có file máy chủ mới hơn lúc chương trình khởi động. */
function daCu() {
  const gio = Date.now();
  if (gio - _luc < CACH) return _cu;
  _luc = gio;
  // Trừ hao 2 giây cho sai lệch giờ ghi file.
  _cu = quet(GOC) > KHOI_DONG + 2000;
  return _cu;
}

module.exports = { daCu, KHOI_DONG };
