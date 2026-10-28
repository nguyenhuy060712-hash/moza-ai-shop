'use strict';

/**
 * Số người chốt thật trên Thanh chữ, cảm ơn cuối buổi, ẩn tên, ngưỡng "còn ít" (SPEC.md F-83, #111).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('đếm người chốt (khác nhau, trừ hủy, tách buổi tập), ngưỡng 5, mốc đọc 5/10/20/50, cảm ơn bỏ người ẩn tên, cờ sắp hết theo Cài đặt', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const don = require('../server/nghiep-vu/don');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const lienHe = require('../server/nghiep-vu/lien-he');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const { demNguoiChot } = require('../server/nghiep-vu/bao-cao');
  const { dung, docLenh, ManHinhSanPham } = require('../server/man-hinh-san-pham');
  const { ChotDon } = require('../server/chot-don');
  const s = taoSanPhamMau({ ton: 50 });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const pTap = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  let i = 0;
  const chot = (p, ten, mau = 'Đen') => {
    i += 1;
    const bl = live.themBinhLuan(p.id, { fb_id: `c${i}`, nguoi_fb_id: `u_${ten}`, ten, noi_dung: `chốt 12 ${mau} M`, luc_fb: new Date(Date.now() + i).toISOString() });
    const n = hopThu.nguoiCuaBinhLuan(bl, p);
    const d = don.taoDon({ mon: [{ phan_loai_id: s.pl(mau, 'M').id }], nguon: 'binh_luan_live', phienLiveId: p.id, binhLuanId: bl.id, nguoiFbId: n.id, dienTap: p.dien_tap });
    live.ganChot(bl.id, { donId: d.id });
    return { d, n };
  };
  // Buổi tập: 7 người chốt — không bao giờ cộng vào buổi thật.
  for (const ten of ['A1 Tập', 'A2 Tập', 'A3 Tập', 'A4 Tập', 'A5 Tập', 'A6 Tập', 'A7 Tập']) chot(pTap, ten);
  live.ketThucPhien(pTap.id, 'xong');
  const pThat = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  const ds = [];
  for (const ten of ['Nguyễn Lan', 'Trần Hoa', 'Lê Trâm', 'Phạm Vy']) ds.push(chot(pThat, ten));
  assert.equal(demNguoiChot(pThat.id, s.san_pham.id), 4);
  assert.equal(dung({ mau: 'gioi_thieu', so: 12 }).san_pham.nguoi_chot, null, '4 người: chưa hiện');
  ds.push(chot(pThat, 'Đỗ Quỳnh'));
  chot(pThat, 'Nguyễn Lan', 'Trắng'); // cùng người chốt lần 2 (đơn khác) → vẫn 1 người
  ds.push(chot(pThat, 'Bùi Khánh'));
  assert.equal(demNguoiChot(pThat.id, s.san_pham.id), 6);
  assert.equal(dung({ mau: 'gioi_thieu', so: 12 }).san_pham.nguoi_chot, 6, '"6 người chốt buổi này"');
  don.doiTrangThai(ds[1].d.id, 'da_huy', { nguon: 'nguoi' });
  assert.equal(demNguoiChot(pThat.id, s.san_pham.id), 5, 'đơn hủy → giảm');
  assert.equal(demNguoiChot(pTap.id, s.san_pham.id), 7);

  // Cảm ơn: tên gọi, không trùng, bỏ người đơn hủy, bỏ người xin ẩn tên.
  lienHe.datAnTen(ds[2].n.id); // Trâm xin ẩn tên
  assert.deepEqual(docLenh('Mai ơi cảm ơn cả nhà'), { cam_on: true });
  const { EventEmitter } = require('node:events');
  const obs = Object.assign(new EventEmitter(), { trangThai: () => ({ ket_noi: false }), noi: async () => ({}), dong() {}, async chuyenCanh() {} });
  const suKien = [];
  const mh = new ManHinhSanPham({ phat: (type, d) => suKien.push({ type, ...d }), bus: new EventEmitter(), obs });
  t.after(() => mh.dong());
  const kq = await mh.lamLenh(docLenh('Mai ơi cảm ơn cả nhà'));
  assert.deepEqual(kq.cam_on.ten, ['Lan', 'Vy', 'Quỳnh', 'Khánh']);
  assert.equal(suKien.find((e) => e.type === 'mhsp.cam_on').giay, 45);

  // Ngưỡng sắp hết theo Cài đặt (không còn số 5 viết cứng).
  const kho = require('../server/nghiep-vu/kho');
  const { csdl } = require('../server/db/ket-noi');
  csdl().prepare('UPDATE phan_loai SET ton = ? WHERE id = ?').run(4 + kho.dangGiu(csdl(), s.pl('Trắng', 'L').id), s.pl('Trắng', 'L').id);
  csdl().prepare('UPDATE phan_loai SET ton = ? WHERE id = ?').run(3 + kho.dangGiu(csdl(), s.pl('Đen', 'L').id), s.pl('Đen', 'L').id);
  caiDat.datBanHang({ nguong_sap_het: 3 });
  const co = (nhan) => dung({ mau: 'gioi_thieu', so: 12 }).san_pham.con_hang.find((x) => x.nhan === nhan);
  assert.equal(co('Trắng/L').sap_het, false, 'còn 4, ngưỡng 3 → không hiện');
  assert.equal(co('Đen/L').sap_het, true, 'còn 3 → hiện');
  caiDat.datBanHang({ nguong_sap_het: 5 });
  assert.equal(co('Trắng/L').sap_het, true, 'đổi ngưỡng 5 → còn 4 hiện');

  // Mốc đọc: 5 → một lần; chưa tới 10 thì không đọc nữa.
  const chen = [];
  const cd = new ChotDon({ phat: () => {}, phongAi: { doiAi: { chenBanHang: (id, k, b) => { chen.push({ k, ...b }); return true; } } } });
  const pDoi = { ...live.layPhien(pThat.id), doi_ai: true };
  cd.docMocChot(pDoi, [sp()]);
  cd.docMocChot(pDoi, [sp()]);
  assert.deepEqual(chen, [{ k: 'dem_chot', mon: 'áo số 12', so: 5 }]);
  function sp() { return require('../server/nghiep-vu/san-pham').laySanPham(s.san_pham.id); }
  const mau = require('../server/cau-hinh/doi-ai-cau-mau.json');
  for (const l of [...mau.dem_chot, ...mau.cam_on_cuoi]) for (const [, loi] of l) assert.doesNotMatch(loi, /đã bán/);
});
