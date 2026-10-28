'use strict';

/**
 * Tạo bộ dữ liệu demo sạch để đưa lên GitHub / VPS (28/10/2026).
 *
 * Lấy từ dữ liệu bản xem thử (`data/xem-thu/`), CHỈ GIỮ phần dựng shop: sản phẩm, phân loại, tồn kho, bảng size, Sổ tay,
 * Skill, lời dặn, agent, kịch bản, ảnh và video sản phẩm. BỎ mọi thứ có người thật hay buổi tập: khách, đơn, tin nhắn,
 * bình luận, phiên live, nhật ký, chờ duyệt, ảnh khách, giọng tự tạo (gắn với tài khoản Google), Page Facebook.
 * Thông tin shop (tên, số điện thoại, địa chỉ, tài khoản nhận tiền) đổi thành dữ liệu mẫu. Không chép `.env` (khóa).
 *
 * Chạy: node scripts/tao-demo.js [thư mục nguồn] → ghi vào demo/ (moza.db, anh/, video/).
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const GOC = path.join(__dirname, '..');
const NGUON = path.resolve(process.argv[2] || path.join(GOC, 'data', 'xem-thu'));
const DICH = path.join(GOC, 'demo');

// Bảng dựng shop — giữ nguyên. Bảng khác (giao dịch, người, nhật ký) xóa hết dòng.
const GIU = new Set([
  'agent', 'cai_dat', 'kich_ban', 'san_pham', 'san_pham_ban_sua', 'phan_loai', 'kho_lich_su',
  'bang_size', 'bang_size_ban_sua', 'so_tay', 'so_tay_ban_sua', 'skill', 'skill_ban_sua', 'vai_tro', 'vai_tro_ban_sua',
  'loi_dan', 'loi_dan_ban_sua', 'hook', 'luat_quyen',
]);
// Khóa cài đặt gắn với buổi tập, tài khoản hay giọng riêng — bỏ.
const BO_CAI_DAT = ['giong_mai', 'san_sang_tich', 'san_sang_tich_lau', 'khan_cap_luc', 'khan_cap_ly_do', 'dien_tap_tra_kho_luc', 'nguoi_mau'];

function chepThuMuc(tu, toi) {
  if (!fs.existsSync(tu)) return 0;
  let n = 0;
  fs.mkdirSync(toi, { recursive: true });
  for (const m of fs.readdirSync(tu, { withFileTypes: true })) {
    const a = path.join(tu, m.name);
    const b = path.join(toi, m.name);
    if (m.isDirectory()) n += chepThuMuc(a, b);
    else { fs.copyFileSync(a, b); n += 1; }
  }
  return n;
}

function main() {
  const db0 = path.join(NGUON, 'moza.db');
  if (!fs.existsSync(db0)) throw new Error(`Không thấy ${db0}`);
  const tam = fs.mkdtempSync(path.join(GOC, 'data', 'tao-demo-'));
  let db = null;
  try {
    // Chép cả tệp -wal để lấy đủ dữ liệu mới nhất, rồi gộp vào tệp chính.
    for (const duoi of ['', '-wal', '-shm']) if (fs.existsSync(db0 + duoi)) fs.copyFileSync(db0 + duoi, path.join(tam, 'moza.db' + duoi));
    db = new DatabaseSync(path.join(tam, 'moza.db'));
    db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA foreign_keys = OFF;');
    const bang = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    db.exec('BEGIN');
    // Bảng lịch sử có trigger "chỉ được thêm" — bộ demo là bản chép riêng nên tạm gỡ trigger khi dọn rồi gắn lại y nguyên.
    const chan = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql LIKE '%RAISE%'").all();
    for (const t of chan) db.exec(`DROP TRIGGER "${t.name}"`);
    const daXoa = [];
    for (const b of bang) {
      if (GIU.has(b)) continue;
      const n = db.prepare(`SELECT count(*) AS n FROM "${b}"`).get().n;
      if (n) { db.exec(`DELETE FROM "${b}"`); daXoa.push(`${b} ${n}`); }
    }
    // Lịch sử kho giữ nguyên số (tồn = tổng lịch sử) nhưng bỏ dấu tới đơn đã xóa.
    if (bang.includes('kho_lich_su')) db.exec('UPDATE kho_lich_su SET don_id = NULL');
    for (const k of BO_CAI_DAT) db.prepare('DELETE FROM cai_dat WHERE khoa = ?').run(k);
    const bh = db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'ban_hang'").get();
    if (bh) {
      const v = JSON.parse(bh.gia_tri);
      Object.assign(v, {
        ten_shop: 'Moza Shop', sdt_shop: '0900000000', dia_chi_shop: 'Số 1 Đường Mẫu, Hà Nội',
        phu_trach: '', ten_chu_tk: '', ngan_hang: '', so_tk: '',
      });
      db.prepare("UPDATE cai_dat SET gia_tri = ? WHERE khoa = 'ban_hang'").run(JSON.stringify(v));
    }
    // Không để công tắc khẩn cấp bật sẵn trong bộ demo.
    db.prepare("UPDATE cai_dat SET gia_tri = 'false' WHERE khoa = 'khan_cap'").run();
    for (const t of chan) db.exec(t.sql);
    db.exec('COMMIT');
    fs.rmSync(DICH, { recursive: true, force: true });
    fs.mkdirSync(DICH, { recursive: true });
    db.exec(`VACUUM INTO '${path.join(DICH, 'moza.db').replace(/'/g, "''")}'`);
    db.close();
    db = null;
    const anh = chepThuMuc(path.join(NGUON, 'anh'), path.join(DICH, 'anh'));
    const video = chepThuMuc(path.join(NGUON, 'video'), path.join(DICH, 'video'));
    // video/tam là chỗ tải lên dở (chưa gắn sản phẩm) — không đưa vào bộ demo.
    fs.rmSync(path.join(DICH, 'video', 'tam'), { recursive: true, force: true });
    console.log(`Đã tạo demo/: moza.db, ${anh} tệp ảnh, ${video} tệp video.`);
    console.log(`Đã xóa: ${daXoa.join(', ') || '(không có)'}`);
  } finally {
    // Đóng cơ sở dữ liệu trước khi xóa thư mục tạm (Windows khóa tệp đang mở).
    try { db?.close(); } catch { /* đã đóng */ }
    fs.rmSync(tam, { recursive: true, force: true });
  }
}

main();
