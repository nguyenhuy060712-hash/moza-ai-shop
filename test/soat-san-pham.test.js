'use strict';

/**
 * "Xem thử AI hiểu gì" (F-23 bản bán hàng): gọi AI một lần với Skill Soát sản phẩm trên đúng thẻ mọi AI đọc,
 * trích dẫn phải có nguyên văn trong thẻ (sai thì làm lại một lần), kết quả không lưu vào sản phẩm.
 * Nhà cung cấp giả: không gọi mạng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');

function nhaGia(kichBan) {
  const yeuCau = [];
  let i = 0;
  return {
    yeuCau,
    async goi(o) {
      yeuCau.push({ model: o.model, mucSuyNghi: o.mucSuyNghi, heThong: o.heThong, lichSu: JSON.parse(JSON.stringify(o.lichSu)) });
      const r = kichBan[Math.min(i, kichBan.length - 1)];
      i += 1;
      return { goiCongCu: [], chu: JSON.stringify(r), goc: null, tokenVao: 2000, tokenRa: 500 };
    },
  };
}

// Thẻ có mâu thuẫn cố ý: mô tả nói cotton, thông số ghi linen.
const MO_TA = 'Chất cotton mềm, mặc đi làm, đi chơi đều hợp.';
const PHIEU_DUNG = {
  tom_tat: [{ y: 'Áo sơ mi giá 289.000đ, form suông', trich_dan: ['Giá: 289.000đ', '- Kiểu dáng / form: Suông'] }],
  mo_ho: [{ y: 'Chưa ghi hướng dẫn giặt', trich_dan: [] }],
  mau_thuan: [{ y: 'Mô tả nói cotton, thông số ghi linen', trich_dan: ['Chất cotton mềm', 'Chất liệu: Linen (lanh)'] }],
};

test('soát sản phẩm: mâu thuẫn trích cả hai đoạn, trích sai thì làm lại, không lưu vào sản phẩm', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const { soatSanPham, tichSai } = require('../server/agent/agents/soat-san-pham');
  const { csdl } = require('../server/db/ket-noi');
  const { san_pham: s } = taoSanPhamMau({ them: { mo_ta: MO_TA } });
  const the = sp.theChoAi(s);

  await t.test('kiểm trích dẫn: có nguyên văn trong thẻ (không phân biệt dấu, khoảng trắng)', () => {
    assert.deepEqual(tichSai(PHIEU_DUNG, the), []);
    assert.deepEqual(tichSai({ tom_tat: [{ y: 'giá', trich_dan: ['gia:   289.000D'] }], mo_ho: [], mau_thuan: [] }, the), []);
    const sai = tichSai({ tom_tat: [], mo_ho: [], mau_thuan: [{ y: 'x', trich_dan: ['Giá: 250.000đ'] }] }, the);
    assert.match(sai[0], /cần ít nhất 2 đoạn trích/);
    assert.match(sai[1], /không có nguyên văn trong thẻ sản phẩm/);
    const giaVon = tichSai({ tom_tat: [{ y: 'vốn', trich_dan: ['nhập xưởng A'] }], mo_ho: [], mau_thuan: [] }, the);
    assert.equal(giaVon.length, 1, 'ghi chú nội bộ không có trong thẻ nên không trích được');
  });

  await t.test('gọi một lần với Skill Soát sản phẩm, trả tóm tắt / mơ hồ / mâu thuẫn', async () => {
    const g = nhaGia([PHIEU_DUNG]);
    const kq = await soatSanPham(s.id, { nhaCungCap: { anthropic: g, openai: g } });
    assert.equal(kq.ok, true);
    assert.equal(kq.ketQua.mau_thuan[0].trich_dan.length, 2);
    assert.deepEqual(kq.san_pham, { id: s.id, so: 12, phien_ban: 1 });
    assert.equal(g.yeuCau.length, 1);
    assert.equal(g.yeuCau[0].model, 'claude-opus-5-5');
    assert.equal(g.yeuCau[0].mucSuyNghi, 'cao');
    const guiDi = g.yeuCau[0].heThong + JSON.stringify(g.yeuCau[0].lichSu);
    assert.match(guiDi, /Skill: Soát sản phẩm/);
    assert.match(g.yeuCau[0].heThong, /đọc thử thẻ một sản phẩm/);
    assert.match(guiDi, /Chất cotton mềm/);
    assert.ok(!guiDi.includes('nhập xưởng A') && !guiDi.includes('150.000'), 'AI không thấy giá vốn, ghi chú nội bộ');
    const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'soat_san_pham'").get();
    assert.equal(run.san_pham_id, s.id);
    assert.equal(run.san_pham_phien_ban, 1);
  });

  await t.test('trích dẫn bịa → làm lại một lần', async () => {
    const bia = { ...PHIEU_DUNG, mau_thuan: [{ y: 'Hai mức giá', trich_dan: ['Giá: 250.000đ', 'Giá: 289.000đ'] }] };
    const g = nhaGia([bia, PHIEU_DUNG]);
    const kq = await soatSanPham(s.id, { nhaCungCap: { anthropic: g, openai: g } });
    assert.equal(kq.ok, true);
    assert.equal(g.yeuCau.length, 2);
    assert.match(JSON.stringify(g.yeuCau[1].lichSu), /không có nguyên văn trong thẻ sản phẩm/);
  });

  await t.test('trích dòng đầu (số, tên) vẫn tính là chữ của thẻ', async () => {
    const tieuDe = { ...PHIEU_DUNG, tom_tat: [{ y: 'Áo sơ mi linen', trich_dan: ['Áo số 12 · Sơ mi linen tay ngắn'] }] };
    const g = nhaGia([tieuDe]);
    const kq = await soatSanPham(s.id, { nhaCungCap: { anthropic: g, openai: g } });
    assert.equal(kq.ok, true);
    assert.equal(g.yeuCau.length, 1, 'không phải làm lại');
  });

  await t.test('kết quả không lưu thành ô nào của sản phẩm', () => {
    const sau = sp.laySanPham(s.id);
    assert.equal(sau.phien_ban, 1);
    assert.equal(sau.mo_ta, MO_TA);
    assert.equal(sp.banSua(s.id).length, 1);
    assert.ok(!Object.keys(sau).some((k) => /soat|tom_tat|mau_thuan|mo_ho/.test(k)));
  });
});

test('API soát sản phẩm: không có khóa AI thì báo lỗi rõ ràng', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const { than: { san_pham: s } } = await pm.goi('POST', '/api/san-pham', { ten: 'Áo thun trơn', danh_muc: 'ao_thun', gia: '99k',
    phan_loai: [{ gt1: 'Đen', gt2: 'M' }] });
  const r = await pm.goi('POST', `/api/san-pham/${s.id}/soat`);
  assert.equal(r.ma, 502);
  assert.match(r.than.loi.thong_diep, /khóa/);
  assert.equal((await pm.goi('POST', '/api/san-pham/sp_khongco/soat')).ma, 404);
});
