'use strict';

/**
 * Nạp bộ dữ liệu demo (thư mục demo/) vào thư mục dữ liệu để chạy thử ngay (28/10/2026).
 *
 * Chạy: node scripts/nap-demo.js [thư mục dữ liệu, mặc định data/]
 * Thư mục đích đã có moza.db thì KHÔNG ghi đè (tránh mất dữ liệu thật) — muốn thay thì thêm --ghi-de (cơ sở dữ liệu cũ
 * được đổi tên thành moza.db.truoc-demo-<giờ> chứ không xóa).
 */

const fs = require('node:fs');
const path = require('node:path');

const GOC = path.join(__dirname, '..');
const DEMO = path.join(GOC, 'demo');
const thamSo = process.argv.slice(2);
const ghiDe = thamSo.includes('--ghi-de');
const DICH = path.resolve(thamSo.find((a) => !a.startsWith('--')) || path.join(GOC, 'data'));

function chepThuMuc(tu, toi) {
  if (!fs.existsSync(tu)) return 0;
  let n = 0;
  fs.mkdirSync(toi, { recursive: true });
  for (const m of fs.readdirSync(tu, { withFileTypes: true })) {
    const a = path.join(tu, m.name);
    const b = path.join(toi, m.name);
    if (m.isDirectory()) n += chepThuMuc(a, b);
    else if (!fs.existsSync(b)) { fs.copyFileSync(a, b); n += 1; }
  }
  return n;
}

if (!fs.existsSync(path.join(DEMO, 'moza.db'))) {
  console.error('Không thấy demo/moza.db. Bộ demo nằm trong kho mã; tạo lại bằng: node scripts/tao-demo.js');
  process.exit(1);
}
fs.mkdirSync(DICH, { recursive: true });
const db = path.join(DICH, 'moza.db');
if (fs.existsSync(db)) {
  if (!ghiDe) {
    console.error(`${db} đã có dữ liệu — không ghi đè. Thêm --ghi-de nếu chắc muốn thay bằng dữ liệu demo.`);
    process.exit(1);
  }
  const luc = new Date().toISOString().replace(/[:.]/g, '-');
  for (const duoi of ['', '-wal', '-shm']) if (fs.existsSync(db + duoi)) fs.renameSync(db + duoi, `${db}.truoc-demo-${luc}${duoi}`);
}
fs.copyFileSync(path.join(DEMO, 'moza.db'), db);
const anh = chepThuMuc(path.join(DEMO, 'anh'), path.join(DICH, 'anh'));
const video = chepThuMuc(path.join(DEMO, 'video'), path.join(DICH, 'video'));
console.log(`Đã nạp dữ liệu demo vào ${DICH}: moza.db, ${anh} tệp ảnh, ${video} tệp video. Chạy: npm start`);
