'use strict';

/**
 * Thẻ nhắc người dẫn khi khách xin xem + video dựng thử (SPEC.md F-81, #109). Bộ câu do Claude Code soạn 28/9/2026.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const MAU = ['Đen', 'Trắng', 'Be', 'Xanh navy'];
// [câu, loại mong đợi (null = không phải yêu cầu), màu]
const CAU = [
  ['quay lưng cho xem', 'mat_sau'], ['xoay lưng đi shop', 'mat_sau'], ['mặt sau sao shop', 'mat_sau'], ['cho xem mặt sau với', 'mat_sau'],
  ['xoay ra sau em xem', 'mat_sau'], ['quay sau lưng xíu', 'mat_sau'], ['xoay 1 vòng đi c', 'mat_sau'], ['sau lưng áo thế nào', 'mat_sau'],
  ['quay lung cho e xem', 'mat_sau'], ['xoay lung di', 'mat_sau'], ['mat sau the nao', 'mat_sau'], ['phía sau có gì không', 'mat_sau'],
  ['lưng áo có xẻ không', 'mat_sau'], ['xoay một vòng cho xem', 'mat_sau'], ['quay một vòng đi shop', 'mat_sau'],
  ['soi vải giúp em', 'can_vai'], ['zoom gần tí', 'can_vai'], ['zoom vải xem', 'can_vai'], ['cận vải cho xem', 'can_vai'], ['gần vải xíu', 'can_vai'],
  ['cho xem vải', 'can_vai'], ['soi kỹ giúp em', 'can_vai'], ['soi chất vải đi', 'can_vai'], ['cận cảnh đi shop', 'can_vai'], ['quay cận chất vải', 'can_vai'],
  ['lại gần cho xem', 'can_vai'], ['đưa gần máy xíu', 'can_vai'], ['zoom', 'can_vai'], ['xem chất vải', 'can_vai'], ['soi vai giup e', 'can_vai'],
  ['đứng xa cho xem form', 'toan_than'], ['đứng ra xa xíu', 'toan_than'], ['lùi ra xa tí', 'toan_than'], ['lên form thế nào', 'toan_than'],
  ['cho xem toàn thân', 'toan_than'], ['đi vài bước cho xem', 'toan_than'], ['đi thử đi shop', 'toan_than'], ['xem form áo', 'toan_than'],
  ['mặc lên cho xem', 'toan_than'], ['mặc thử cho xem với', 'toan_than'], ['xem dáng áo sao', 'toan_than'], ['len form sao shop', 'toan_than'],
  ['mặc màu be đi shop', 'mau_khac', 'Be'], ['thử màu xanh navy', 'mau_khac', 'Xanh navy'], ['cho xem màu trắng', 'mau_khac', 'Trắng'],
  ['mặc thử màu đen', 'mau_khac', 'Đen'], ['xem màu be', 'mau_khac', 'Be'], ['đổi màu trắng đi', 'mau_khac', 'Trắng'], ['mac mau den di', 'mau_khac', 'Đen'],
  ['cho em xem màu xanh navy', 'mau_khac', 'Xanh navy'],
  // Câu dễ nhầm / không phải yêu cầu.
  ['xoay sở không kịp', null], ['soi giúp em đơn hôm qua', null], ['mặc màu tím đi', null], ['chốt 12 đen M', null], ['áo đẹp quá', null],
  ['giá bao nhiêu', null], ['ship bao lâu', null], ['size M cao 1m6 mặc vừa không', null], ['lúc sau em chốt', null], ['hôm sau có live không', null],
  ['vải gì vậy shop', null], ['màu này đẹp', null],
];

test(`≥ 60 câu "xin xem" nhận đúng loại (${CAU.length} câu), câu dễ nhầm không gắn nhãn`, () => {
  const { loaiMuonXem } = require('../server/nghiep-vu/tu-khoa');
  assert.ok(CAU.length >= 60);
  for (const [c, loai, mau] of CAU) {
    const y = loaiMuonXem(c, { mauCo: MAU });
    assert.equal(y?.loai ?? null, loai, c);
    if (mau) assert.equal(y.mau, mau, c);
  }
});

test('thẻ nhắc: 3 người xin xoay lưng trong 40 giây → 1 thẻ 3 tên; thẻ cận vải chờ tới khi thẻ đầu tắt; tự tắt; Đã làm; Đội AI ≤ 1 câu / 2 phút', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { TheNhac } = require('../server/the-nhac');
  taoSanPhamMau({ mau: ['Đen', 'Be'] });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const { csdl } = require('../server/db/ket-noi');
  const p0 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  csdl().prepare('UPDATE phien_live SET doi_ai = 1 WHERE id = ?').run(p0.id);
  const p = live.layPhien(p0.id);
  live.doiDoan(p.id, 1);
  const suKien = [];
  const chen = [];
  const chieu = [];
  const tn = new TheNhac({ phat: (type, d) => suKien.push({ type, ...d }), gomMs: 60000, tatMs: 800,
    phongAi: { doiAi: { chenBanHang: (id, khoa, bien) => { chen.push({ khoa, ...bien }); return true; } } },
    layManHinh: () => ({ chieu: (lenh) => chieu.push(lenh) }) });
  t.after(() => tn.datLai(null));
  // so_doan: món đang nói (đoán theo đoạn — ở đây đặt thẳng số 12).
  const bl = (ten, noiDung, o = {}) => ({ ...live.themBinhLuan(p.id, { fb_id: `c${Math.random()}`, nguoi_fb_id: `u_${ten}`, ten, noi_dung: noiDung, luc_fb: new Date().toISOString(), an_danh: !!o.an_danh }), so_doan: 12 });
  const t0 = Date.now();
  tn.nhan(bl('Lê Thu Hằng', 'quay lưng cho xem'), p, t0 - 40000);
  tn.nhan(bl('Trần Thu', 'xoay lưng đi'), p, t0 - 20000);
  tn.nhan(bl('Phạm Ngọc', 'mặt sau sao'), p, t0);
  let tt = tn.trangThai();
  assert.equal(tt.hien.chu, '3 người muốn xem mặt sau (số 12): Hằng, Thu, Ngọc');
  assert.equal(tt.hang.length, 0);
  assert.deepEqual(chen.map((x) => [x.khoa, x.ten, x.viec]), [['da_nghe_yeu_cau', 'Hằng', 'xem mặt sau']], 'Đội AI đọc một câu; cùng loại trong 2 phút không đọc lần hai');

  tn.nhan(bl('Đỗ Vy', 'soi vải giúp em'), p, Date.now());
  tt = tn.trangThai();
  assert.equal(tt.hien.loai, 'mat_sau', 'thẻ cận vải chờ');
  assert.equal(tt.hang[0].chu, 'Vy muốn xem cận vải (số 12)');
  assert.deepEqual(tt.hang[0].nut.map((n) => n.chu), ['Chiếu chất liệu'], 'chưa có video quay thật → chiếu chất liệu');

  // Tự tắt sau tatMs kể từ lần cập nhật cuối → thẻ cận vải lên.
  await new Promise((r) => setTimeout(r, 1100));
  tt = tn.trangThai();
  assert.equal(tt.hien?.loai, 'can_vai');
  tn.xong(tt.hien.id);
  assert.equal(tn.trangThai().hien, null, 'bấm Đã làm → tắt ngay');
  assert.ok(suKien.filter((e) => e.type === 'live.the_nhac').length >= 4);

  tn.nhan(bl('Bùi An', 'mặc màu be đi shop'), p, Date.now());
  tt = tn.trangThai();
  assert.deepEqual(tt.hien.nut, [{ chu: 'Chiếu ảnh Be', lenh: { mau: 'anh', so: 12, mau_sac: 'Be' } }]);
  assert.deepEqual(chieu.at(-1), { mau: 'anh', so: 12, mau_sac: 'Be' }, 'Đội AI dẫn: MOZA tự chiếu ảnh đúng màu');
  tn.nhan(bl('Ẩn Danh', 'mặc màu be đi', { an_danh: true }), p, Date.now());
});

test('video dựng thử: buổi thật không chiếu (lùi về trình chiếu ảnh), buổi tập chiếu kèm nhãn; lưu sản phẩm giữ cờ; nâng cấp 019 đánh dấu video cũ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const sp = require('../server/nghiep-vu/san-pham');
  const { csdl } = require('../server/db/ket-noi');
  const s = taoSanPhamMau();
  const tep = 'abcdef1234567890.mp4';
  csdl().prepare('UPDATE san_pham SET video = ? WHERE id = ?').run(JSON.stringify([{ tep, mau: 'Đen' }]), s.san_pham.id);
  // Câu UPDATE của tệp nâng cấp 019, chạy lại trên dòng này.
  const sql = fs.readFileSync(path.join(__dirname, '..', 'server', 'db', 'nang-cap', '019-tren-song.sql'), 'utf8');
  csdl().exec(sql.slice(sql.indexOf('UPDATE san_pham SET video')));
  assert.equal(sp.laySanPham(s.san_pham.id).video[0].dung_thu, true, 'video cũ được đánh dấu dựng thử');

  // Lưu sản phẩm (giữ video) không làm mất cờ.
  const thu = path.join(require('../server/db/ket-noi').thuMucDuLieu(), 'video', s.san_pham.id);
  fs.mkdirSync(thu, { recursive: true });
  fs.writeFileSync(path.join(thu, tep), Buffer.from('00000000ftypisom'));
  const r = sp.suaSanPham(s.san_pham.id, { video: sp.laySanPham(s.san_pham.id).video, mo_ta: 'Sơ mi linen.' });
  assert.equal(r.san_pham?.video?.[0]?.dung_thu ?? sp.laySanPham(s.san_pham.id).video[0].dung_thu, true);

  const { ManHinhSanPham } = require('../server/man-hinh-san-pham');
  const { EventEmitter } = require('node:events');
  const obs = Object.assign(new EventEmitter(), { trangThai: () => ({ ket_noi: false }), noi: async () => ({}), dong() {}, async chuyenCanh() {} });
  const mh = new ManHinhSanPham({ phat: () => {}, bus: new EventEmitter(), obs });
  t.after(() => mh.dong());
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const pTap = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  let h = mh.chieu({ mau: 'video', so: 12 }, { boi: 'nguoi' }).hien;
  assert.equal(h.mau, 'video');
  assert.equal(h.video.dung_thu, true, 'buổi tập: chiếu kèm nhãn');
  live.ketThucPhien(pTap.id, 'xong');
  live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  h = mh.chieu({ mau: 'video', so: 12 }, { boi: 'nguoi' }).hien;
  assert.equal(h.mau, 'trinh_chieu');
  assert.match(h.ghi_chu, /Chỉ có video dựng thử: buổi live thật không chiếu/);
});
