'use strict';

/**
 * Kiểm lời Mai trên sóng (SPEC.md F-105): 62 câu mẫu có đáp án (test/du-lieu/loi-mai-mau.json) — bắt đúng 100% câu sai có món rõ
 * (mức "chắc"), 0 câu đúng bị báo; số đọc bằng chữ, cách nói tắt "trăm năm chín", giá riêng phân loại, n × giá, giá + ship.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const MAU = require('./du-lieu/loi-mai-mau.json').cau;

async function dung(t) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ phi_ship: '20k', mien_phi_tu: '500k', nguong_sap_het: 3 });
  const ao = taoSanPhamMau({ gia: '159k', ton: 5 });
  require('../server/db/ket-noi').csdl().prepare("UPDATE phan_loai SET gia = 169000 WHERE id = ?").run(ao.pl('Trắng', 'L').id);
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'], ton: 2 });
  return require('../server/agent/kiem-tra/kiem-so-noi');
}

test(`${MAU.length} câu mẫu lời Mai: chắc / nghi / đúng khớp đáp án`, async (t) => {
  const { kiemSoNoi } = await dung(t);
  assert.ok(MAU.length >= 60);
  const sai = [];
  for (const m of MAU) {
    const kq = kiemSoNoi(m.cau, { phienId: null, soDangNoi: m.dang_noi ?? null });
    const chac = kq.filter((x) => x.muc === 'chac');
    const ra = chac.length ? 'chac' : kq.length ? 'nghi' : 'dung';
    if (ra !== m.kq || (m.loai && !chac.some((x) => x.loai === m.loai))) sai.push(`${m.cau} → ${ra} ${JSON.stringify(kq.map((x) => [x.loai, x.muc, x.noi]))} (đáp án ${m.kq}${m.loai ? `/${m.loai}` : ''})`);
  }
  assert.deepEqual(sai, []);
});

test('câu đính chính do máy điền: đúng giá, đúng món; Thanh chữ viết hoa chữ đầu', async (t) => {
  const { kiemSoNoi, cauDinhChinh } = await dung(t);
  const [l] = kiemSoNoi('Áo số 12 giá 150 nghìn thôi', { phienId: null });
  assert.deepEqual([l.noi, l.dung, l.so], [150000, 159000, 12]);
  const c = cauDinhChinh(l);
  assert.equal(c.noi, 'Mai xin nói lại cho đúng: áo số 12 giá 159.000đ.');
  assert.equal(c.thanh_chu, 'Đính chính: Áo số 12 giá 159.000đ');
  const [s] = kiemSoNoi('phí ship 25 nghìn cả nhà', { phienId: null });
  assert.equal(cauDinhChinh(s).noi, 'Mai xin nói lại cho đúng: phí ship 20.000đ.');
});
