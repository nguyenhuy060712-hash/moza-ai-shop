'use strict';

// Nền chốt đơn (SPEC.md F-65): một lượt nhắn riêng mỗi bình luận, một bộ đọc nút, một đường gửi tin do mã soạn.

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('bộ đọc nút: tạo / đọc mọi loại, payload lạ hay giả mạo → null, đọc được 2 nút cũ của #89', () => {
  const { LOAI, taoPayload, docPayload } = require('../server/nghiep-vu/nut-bam');
  const mau = { don: 'dh_abc', tong: '289000', moc: '2026-09-27T10:00:00.000Z', pl: 'pl_1', tu: 'pl_1', den: 'pl_2', phien: 'pl_x', sl: '2', bl: 'bl_9', sp: 'sp_1', vao: 'dh_cu', khach: 'kh_1', cao: '158', nang: '50', dy: 'dy_1', kieu: 'chat', lan: 'lh_1' };
  for (const [ma, phan] of Object.entries(LOAI)) {
    const o = Object.fromEntries(phan.map((k) => [k, mau[k]]));
    const p = taoPayload(ma, o);
    assert.ok(p.length <= 1000);
    const d = docPayload(p);
    assert.equal(d.ma, ma, p);
    for (const k of phan) assert.equal(d[k], mau[k], `${ma}.${k}`);
  }
  // Hai nút cũ (#89) vẫn đọc được.
  assert.deepEqual(docPayload('XAC_NHAN_DON|dh_1|289000|2026-09-26T01:02:03.000Z'), { ma: 'XAC_NHAN_DON', don: 'dh_1', tong: '289000', moc: '2026-09-26T01:02:03.000Z', khoa: 'dh_1|289000|2026-09-26T01:02:03.000Z' });
  assert.deepEqual(docPayload('SUA_DON|dh_1'), { ma: 'SUA_DON', don: 'dh_1' });
  const { docPayload: docThe } = require('../server/nghiep-vu/the-don');
  assert.deepEqual(docThe('SUA_DON|dh_1'), { loai: 'sua', donId: 'dh_1' });
  // Sai / lạ / giả mạo.
  for (const x of ['', 'X', 'LAM_GI_DO|1', 'GIU_LEN_DON', 'GIU_LEN_DON|a|b', 'SUA_DON|', 'giu_len_don|dh_1', `GIU_LEN_DON|${'x'.repeat(1000)}`, null, undefined, 'XAC_NHAN_DON|dh_1|1',
    'DOI_PL|dh_1|pl_1', 'CHON_PL|p|pl|1', '|||', 'MAU_XAC_NHAN|them', 'BAT_DAU|x', 'KHONG_LAY', 'DAT_LAI|a|b', 'SUA_DON|dh_1|thua']) {
    const d = docPayload(x);
    assert.ok(d === null || d.don === '' || d.ma === 'SUA_DON', `phải từ chối: ${String(x).slice(0, 40)}`);
    if (x === 'SUA_DON|') assert.equal(d.don, '');
    else assert.equal(d, null, String(x).slice(0, 40));
  }
  assert.throws(() => taoPayload('KHONG_CO'), /Loại nút lạ/);
  assert.throws(() => taoPayload('SUA_DON', { don: 'a|b' }), /dấu \|/);
  assert.throws(() => taoPayload('SUA_DON', { don: 'x'.repeat(1000) }), /dài quá/);
});

test('lượt nhắn riêng: 20 lời giữ cùng lúc → đúng 1 người thắng; lỗi thật thì trả lượt; điền lại từ tin cũ (018)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const luot = require('../server/nghiep-vu/luot-nhan-rieng');
  const boi = ['the_giu_hang', 'tu_van', 'the_ib', 'the_moi'];
  const kq = await Promise.all(Array.from({ length: 20 }, (_, i) => Promise.resolve().then(() => luot.giu({ fbCommentId: 'cmt_1', boi: boi[i % 4], pageId: 'P' }))));
  assert.equal(kq.filter((x) => x.thang).length, 1, 'một người thắng');
  assert.equal(luot.lay('cmt_1').boi, 'the_giu_hang');
  assert.equal(luot.daCoLuot('cmt_1'), true);
  luot.loi('cmt_1');
  assert.equal(luot.daCoLuot('cmt_1'), false, 'gửi lỗi thật → lượt trả lại');
  assert.equal(luot.giu({ fbCommentId: 'cmt_1', boi: 'nhan_bu' }).thang, true, 'nhắn bù giữ lại được lượt đó');
  luot.daGui('cmt_1');
  assert.equal(luot.giu({ fbCommentId: 'cmt_1', boi: 'tu_van' }).thang, false);
  // 018 điền lại từ tin nhắn riêng cũ: mô phỏng bằng chính câu SQL của tệp nâng cấp.
  const db = require('../server/db/ket-noi').csdl();
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const { hoiThoai } = hopThu.nhanSuKien({ loai: 'binh_luan_bai', page_id: 'P', comment_id: 'cmt_cu', post_id: 'P_1', nguoi_id: 'u1', ten: 'A', noi_dung: 'hỏi', luc: new Date().toISOString() });
  const { tin } = hopThu.ghiTinRa({ hoiThoaiId: hoiThoai.id, guiBoi: 'ai', loai: 'nhan_rieng', noiDung: 'x', khoa: 'k1', fbCommentId: 'cmt_cu' });
  hopThu.capNhatGui(tin.id, { trangThai: 'da_gui' });
  const sql = require('node:fs').readFileSync(require('node:path').join(__dirname, '../server/db/nang-cap/018-khong-roi-don.sql'), 'utf8');
  db.exec(sql.split('\n').filter((d) => !d.startsWith('--')).join('\n').match(/INSERT OR IGNORE INTO luot_nhan_rieng[\s\S]*?;/)[0]);
  assert.deepEqual([luot.lay('cmt_cu').boi, luot.lay('cmt_cu').trang_thai], ['tu_van', 'da_gui']);
});

test('một đường gửi: gui_the_moza qua đủ hook — "Dừng mọi thứ" thành chờ duyệt, duyệt thì gửi; Tư vấn viên không nhắn riêng bình luận MOZA đã nhắn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const don = require('../server/nghiep-vu/don');
  const choDuyet = require('../server/nghiep-vu/cho-duyet');
  const guiThe = require('../server/gui-the-don');
  const { FacebookGia } = require('../server/facebook/gia');
  const { xuLyChoDuyet, thucHienCongCu } = require('../server/agent/thuc-hien');
  const fb = new FacebookGia();
  const layKetNoi = () => fb;
  const s = taoSanPhamMau();
  const ev = fb.khachNhan({ ten: 'Lan', noi_dung: 'em lấy áo 12 đen M' });
  const { hoiThoai: h } = hopThu.nhanSuKien(ev, { dienTap: true });
  const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'tin_nhan', hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, dienTap: true, tenNhan: 'Lan', sdtNhan: '+84912000111', diaChiNhan: 'Hà Nội' });
  caiDat.datKhanCap(true);
  const kq = await guiThe.guiTheDon({ d, layKetNoi });
  assert.equal(kq.da_gui, false);
  assert.equal(kq.cho_duyet, true, '"Dừng mọi thứ" → thẻ vào chờ duyệt, không bỏ im');
  assert.equal(fb.luongChat('page_gia', ev.psid).filter((x) => x.tu === 'page').length, 0);
  const muc = choDuyet.danhSach().find((m) => m.hanh_dong === 'gui_the_moza');
  assert.ok(muc);
  caiDat.datKhanCap(false);
  await xuLyChoDuyet(muc.id, true, { layKetNoi });
  const cuoi = fb.luongChat('page_gia', ev.psid).at(-1);
  assert.equal(cuoi.tu, 'page');
  assert.match(cuoi.noi_dung, /Đơn DH-0001/);
  assert.equal(cuoi.nut.length, 2, 'thẻ đơn có nút sau khi người duyệt');
  // Hook gioi_thieu: tin đầu do mã soạn mà thiếu câu tự nhận AI → MOZA thêm.
  const ev2 = fb.khachNhan({ ten: 'Hoa', noi_dung: 'alo' });
  const { hoiThoai: h2 } = hopThu.nhanSuKien(ev2, { dienTap: true });
  const r = await guiThe.guiTinHeThong({ h: h2, noiDung: 'Shop chào bạn', khoa: 'thu:1', layKetNoi });
  assert.equal(r.da_gui, true);
  assert.match(fb.luongChat('page_gia', ev2.psid).at(-1).noi_dung, /Shop chào bạn\nTin tự động từ trợ lý AI của shop\./);
  // Không Agent nào có công cụ gui_the_moza.
  for (const a of caiDat.danhSachAgent()) assert.ok(!a.cong_cu.includes('gui_the_moza'), a.id);
  const tuChoi = await thucHienCongCu({ ten: 'gui_the_moza', thamSo: {}, agent: caiDat.layAgent('tu_van') });
  assert.equal(tuChoi.loi.ma, 'CONG_CU_KHONG_DUOC_CAP');
});
