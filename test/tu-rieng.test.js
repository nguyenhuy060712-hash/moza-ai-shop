'use strict';

/**
 * Từ riêng của shop cho phần nghe người dẫn (SPEC.md F-87, P44): ≤ 100 cụm theo ưu tiên, món trong phiên luôn có, không ký tự
 * cấm; miệng Gemini 3.8 Live nhận custom vocabulary (tài liệu Google tra 28/9/2026).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('≤ 100 từ, đủ nhóm lệnh / tên AI, shop / cách gọi món / màu, cỡ / tên món; 40 món Đang bán → món trong phiên luôn có; không <, >, xuống dòng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { tuRiengCua } = require('../server/nghiep-vu/tu-rieng');
  const live = require('../server/nghiep-vu/live');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  caiDat.datBanHang({ ten_shop: 'Moza <Shop>' });
  taoSanPhamMau({ so: 12, mau: ['Đen', 'Be'], them: { ten_goi_khac: ['sơ mi đũi'] } });
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh nhạt'], co: ['29', '30'] });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  for (let i = 40; i < 80; i++) taoSanPhamMau({ so: i, ten: `Mẫu khác số ${i}` });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  const ds = tuRiengCua(p);
  assert.ok(ds.length <= 100, String(ds.length));
  assert.equal(new Set(ds.map((x) => x.toLowerCase())).size, ds.length, 'không trùng');
  for (const x of ['Mai ơi', 'mẫu cao', 'bình chọn', 'cảm ơn cả nhà', 'áo 12', 'áo số 12', 'số 12', 'quần 15', 'Đen', 'Be', 'Xanh nhạt', '29', 'Sơ mi linen tay ngắn', 'sơ mi đũi', 'Quần jean ống suông']) {
    assert.ok(ds.includes(x), `thiếu "${x}"`);
  }
  assert.ok(ds.indexOf('Mai ơi') < ds.indexOf('áo 12') && ds.indexOf('áo 12') < ds.indexOf('Sơ mi linen tay ngắn'), 'đúng thứ tự ưu tiên');
  assert.ok(ds.every((x) => !/[<>\n\r]/.test(x)), 'không ký tự cấm');
  assert.ok(ds.includes('Moza Shop'), 'tên shop đã lọc < >');
  assert.ok(!ds.includes('M') && !ds.includes('mặc'), 'bỏ chữ quá thường (cỡ chữ cái, động từ trơn)');

  const { MiengGemini } = require('../server/agent/mieng/gemini-live');
  const m = new MiengGemini({ loiDan: 'x', tuRieng: ds, khiAm() {}, khiChuRa() {}, khiChuVao() {}, khiDong() {} });
  assert.deepEqual(m.cauHinh().inputAudioTranscription, { customVocabulary: ds.slice(0, 100) });
  assert.deepEqual(new MiengGemini({ loiDan: 'x', khiAm() {}, khiChuRa() {}, khiChuVao() {}, khiDong() {} }).cauHinh().inputAudioTranscription, {});
});
