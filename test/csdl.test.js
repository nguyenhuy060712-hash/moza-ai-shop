'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const ketNoi = require('../server/db/ket-noi');

test('cơ sở dữ liệu: nâng cấu trúc, WAL, chỉ thêm bản sửa, sao lưu', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const db = ketNoi.csdl();
  const cacBang = () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);

  await t.test('nâng tới bản mới nhất (012 bán hàng) và dùng WAL', () => {
    const moiNhat = Math.max(...ketNoi.danhSachNangCap().map((n) => n.so));
    assert.ok(moiNhat >= 12, 'có lần nâng 012-ban-hang');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, moiNhat);
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    const bang = cacBang();
    for (const b of ['san_pham', 'san_pham_ban_sua', 'phan_loai', 'bang_size', 'bang_size_ban_sua', 'kho_lich_su', 'khach', 'don',
      'don_dong', 'don_lich_su', 'phien_live_san_pham', 'dong_thoi_gian_san_pham', 'so_tay', 'so_tay_ban_sua', 'cai_dat', 'agent']) {
      assert.ok(bang.includes(b), b);
    }
  });

  await t.test('bảng của bản cũ đã bỏ hẳn', () => {
    const bang = cacBang();
    for (const b of ['tin', 'tin_ban_sua', 'ung_vien', 'ung_tuyen', 'ung_tuyen_lich_su', 'lich_hen', 'phien_live_tin', 'dong_thoi_gian_tin']) {
      assert.ok(!bang.includes(b), `còn bảng ${b}`);
    }
  });

  await t.test('bản sửa sản phẩm, bảng size, lịch sử kho chỉ được thêm, không sửa, không xóa', () => {
    const { san_pham: sp, phan_loai: pl } = taoSanPhamMau();
    assert.throws(() => db.prepare('UPDATE san_pham_ban_sua SET noi_dung = ? WHERE san_pham_id = ?').run('{}', sp.id), /chỉ được thêm/);
    assert.throws(() => db.prepare('DELETE FROM san_pham_ban_sua WHERE san_pham_id = ?').run(sp.id), /chỉ được thêm/);
    assert.throws(() => db.prepare('UPDATE bang_size_ban_sua SET ten = ? WHERE bang_size_id = ?').run('sửa lén', sp.bang_size_id), /chỉ được thêm/);
    assert.throws(() => db.prepare('DELETE FROM bang_size_ban_sua WHERE bang_size_id = ?').run(sp.bang_size_id), /chỉ được thêm/);
    assert.throws(() => db.prepare('UPDATE kho_lich_su SET thay_doi = 99 WHERE phan_loai_id = ?').run(pl[0].id), /chỉ được thêm/);
    assert.throws(() => db.prepare('DELETE FROM kho_lich_su WHERE phan_loai_id = ?').run(pl[0].id), /chỉ được thêm/);
  });

  await t.test('tồn kho và số sản phẩm có ràng buộc ở tầng dữ liệu', () => {
    const pl = db.prepare('SELECT id FROM phan_loai LIMIT 1').get();
    assert.throws(() => db.prepare('UPDATE phan_loai SET ton = -1 WHERE id = ?').run(pl.id), /CHECK/);
    assert.throws(() => db.prepare("UPDATE san_pham SET trang_thai = 'la'").run(), /CHECK/);
  });

  await t.test('danh sách Agent mặc định theo bảng model mục 6', () => {
    const ds = db.prepare('SELECT id, nha, model, muc_suy_nghi, model_du_phong FROM agent ORDER BY id').all().map((r) => ({ ...r }));
    assert.deepEqual(ds.map((a) => a.id), ['bai_hoc', 'cohost', 'director', 'doc_anh', 'doc_chot', 'khach_gia', 'nguoi_dong_vai', 'nhin_mon', 'quan_ly',
      'soan_bai', 'soan_kich_ban', 'soat_san_pham', 'tim_mau', 'tong_ket', 'tu_van']);
    const a = Object.fromEntries(ds.map((x) => [x.id, x]));
    for (const id of ['director', 'cohost', 'tu_van', 'nguoi_dong_vai']) assert.equal(a[id].model, 'gemini-3.8-flash', id);
    // Tạo từ ảnh, tìm mẫu theo ảnh: gemini-3.8-flash suy nghĩ thấp, dự phòng gpt-6-sol.
    for (const id of ['doc_anh', 'tim_mau']) {
      assert.deepEqual([a[id].nha, a[id].model, a[id].muc_suy_nghi, a[id].model_du_phong], ['gemini', 'gemini-3.8-flash', 'thap', 'gpt-6-sol'], id);
    }
    // Bình luận chốt khó hiểu: model rẻ nhất, suy nghĩ tắt.
    assert.deepEqual([a.doc_chot.model, a.doc_chot.muc_suy_nghi, a.doc_chot.model_du_phong], ['gpt-6-luna', 'tat', 'gemini-3.5-flash-lite']);
    // Nói với Mai: gpt-6-sol mức vừa, dự phòng gemini-3.8-flash.
    assert.deepEqual([a.quan_ly.nha, a.quan_ly.model, a.quan_ly.muc_suy_nghi, a.quan_ly.model_du_phong], ['openai', 'gpt-6-sol', 'vua', 'gemini-3.8-flash']);
    // Soát sản phẩm (đổi tên từ agent soát cũ): Claude Opus, dự phòng gpt-6-sol.
    assert.deepEqual([a.soat_san_pham.nha, a.soat_san_pham.model, a.soat_san_pham.model_du_phong], ['anthropic', 'claude-opus-5-5', 'gpt-6-sol']);
    assert.deepEqual([a.soan_kich_ban.nha, a.soan_kich_ban.model, a.soan_kich_ban.model_du_phong], ['openai', 'gpt-6-sol', 'gemini-3.8-flash']);
    // Mọi model mặc định phải có trong danh sách lựa chọn của Cài đặt.
    const { nha } = require('../server/cau-hinh/mac-dinh.json');
    const coTrong = new Set(Object.values(nha).flatMap((n) => n.model));
    for (const x of ds) {
      assert.ok(coTrong.has(x.model), `${x.id}: ${x.model}`);
      if (x.model_du_phong) assert.ok(coTrong.has(x.model_du_phong), `${x.id} dự phòng: ${x.model_du_phong}`);
    }
  });

  await t.test('Agent quản lý chỉ có công cụ đọc và ghi kho, không có công cụ xóa hay sửa giá', () => {
    const cc = JSON.parse(db.prepare("SELECT cong_cu FROM agent WHERE id = 'quan_ly'").get().cong_cu);
    assert.ok(cc.includes('nhap_kho') && cc.includes('dieu_chinh_kho') && cc.includes('doi_trang_thai_san_pham'));
    assert.ok(!cc.some((c) => /xoa|sua_gia/.test(c)), cc.join(', '));
    for (const id of ['director', 'cohost', 'tu_van']) {
      const ds = JSON.parse(db.prepare('SELECT cong_cu FROM agent WHERE id = ?').get(id).cong_cu);
      assert.ok(!ds.some((c) => /_tin$|ung_vien|ung_tuyen|phong_van/.test(c)), `${id}: ${ds.join(', ')}`);
    }
  });

  await t.test('sao lưu bằng backup(): bản sao mở được và đủ dòng', async () => {
    const file = await ketNoi.saoLuu(new Date(2026, 8, 23, 18, 5));
    assert.match(file, /moza-20260923-1805\.db$/);
    const file2 = await ketNoi.saoLuu(new Date(2026, 8, 23, 18, 5));
    assert.match(file2, /moza-20260923-1805-2\.db$/, 'trùng phút thì thêm -2, không ghi đè');
    const saoLuu = new DatabaseSync(file, { readOnly: true });
    for (const b of ['san_pham', 'san_pham_ban_sua', 'phan_loai', 'kho_lich_su', 'bang_size', 'so_tay', 'agent', 'cai_dat']) {
      const dem = (d) => d.prepare(`SELECT COUNT(*) AS n FROM ${b}`).get().n;
      assert.equal(dem(saoLuu), dem(db), b);
    }
    assert.ok(saoLuu.prepare('SELECT COUNT(*) AS n FROM phan_loai').get().n > 0, 'bản sao có dữ liệu sản phẩm');
    assert.equal(saoLuu.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    saoLuu.close();
    assert.ok(fs.statSync(file).size > 0);
  });
});
