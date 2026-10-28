'use strict';

/**
 * Kết nối cơ sở dữ liệu SQLite (SPEC.md mục 6, 7; F-02).
 *
 * - Một file `data/moza.db`, chế độ WAL, `synchronous = FULL`.
 *   M0 đã thử trên Node 26: tắt ngang giữa lúc ghi thì mở lại được, không mất giao dịch đã xong.
 * - Nâng cấu trúc: các file `nang-cap/NNN-*.sql`; số đang dùng lưu trong `PRAGMA user_version`.
 *   Mỗi file áp trong một giao dịch; trước mỗi lần nâng một cơ sở dữ liệu đã có dữ liệu,
 *   tự sao lưu ra `data/sao-luu/truoc-nang-cap-<số>.db`.
 * - Sao lưu dùng `backup()` của SQLite, không chép tay file đang mở (chép tay có thể ra bản hỏng).
 *
 * Chỉ khối Nghiệp vụ gọi vào đây (SPEC.md mục 5, nguyên tắc 3).
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');

const THU_MUC_NANG_CAP = path.join(__dirname, 'nang-cap');

let _db = null;
let _thuMuc = null;

function danhSachNangCap() {
  return fs.readdirSync(THU_MUC_NANG_CAP)
    .filter((f) => /^\d{3}-.+\.sql$/.test(f))
    .sort()
    .map((f) => ({ so: Number(f.slice(0, 3)), ten: f, file: path.join(THU_MUC_NANG_CAP, f) }));
}

function thuMucSaoLuu(thuMuc) {
  const p = path.join(thuMuc, 'sao-luu');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

async function nangCap(db, thuMuc) {
  const hienTai = db.prepare('PRAGMA user_version').get().user_version;
  for (const n of danhSachNangCap().filter((x) => x.so > hienTai)) {
    const daCoDuLieu = db.prepare('PRAGMA user_version').get().user_version > 0;
    if (daCoDuLieu) await backup(db, path.join(thuMucSaoLuu(thuMuc), `truoc-nang-cap-${n.so}.db`));
    db.exec('BEGIN');
    try {
      db.exec(fs.readFileSync(n.file, 'utf8'));
      db.exec(`PRAGMA user_version = ${n.so}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Nâng cấu trúc cơ sở dữ liệu (${n.ten}) lỗi: ${e.message}`);
    }
  }
}

/** Mở (hoặc tạo) cơ sở dữ liệu trong `thuMuc`, nâng cấu trúc, rồi dùng làm kết nối chung. */
async function moCSDL(thuMuc) {
  fs.mkdirSync(thuMuc, { recursive: true });
  const db = new DatabaseSync(path.join(thuMuc, 'moza.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  await nangCap(db, thuMuc);
  _db = db;
  _thuMuc = thuMuc;
  return db;
}

function csdl() {
  if (!_db) throw new Error('Cơ sở dữ liệu chưa mở');
  return _db;
}

function thuMucDuLieu() {
  return _thuMuc;
}

function dongCSDL() {
  if (_db) _db.close();
  _db = null;
  _thuMuc = null;
}

/** Chạy `viec` trong một giao dịch: lỗi giữa chừng thì không ghi gì cả. */
function giaoDich(viec) {
  const db = csdl();
  db.exec('BEGIN IMMEDIATE');
  try {
    const kq = viec(db);
    db.exec('COMMIT');
    return kq;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Sao lưu ra `data/sao-luu/moza-YYYYMMDD-HHmm.db` (giờ máy). Trùng phút thì thêm -2, -3… */
async function saoLuu(luc = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const ten = `moza-${luc.getFullYear()}${p(luc.getMonth() + 1)}${p(luc.getDate())}-${p(luc.getHours())}${p(luc.getMinutes())}`;
  const noi = thuMucSaoLuu(_thuMuc);
  let file = path.join(noi, `${ten}.db`);
  for (let i = 2; fs.existsSync(file); i++) file = path.join(noi, `${ten}-${i}.db`);
  await backup(csdl(), file);
  return file;
}

module.exports = { moCSDL, csdl, dongCSDL, giaoDich, saoLuu, thuMucDuLieu, danhSachNangCap };
