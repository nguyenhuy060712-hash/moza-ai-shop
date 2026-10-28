'use strict';

/**
 * Máy đọc giả (BH10, docs/11 mục 3.1) và kiểm đọc nguyên văn (F-108, T3): bản xem thử --ai-gia đọc được (im lặng) mà không
 * báo thiếu khóa; máy đọc không bảo đảm đọc đúng chữ nên so chữ chép lại với câu gốc trước khi phát. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const tts = require('../server/agent/nha-cung-cap/tts');

function dungGia(t) {
  const cu = process.env.MOZA_AI_GIA;
  process.env.MOZA_AI_GIA = '1';
  t.after(() => { tts.datDocSai(false); if (cu === undefined) delete process.env.MOZA_AI_GIA; else process.env.MOZA_AI_GIA = cu; });
}

test('MOZA_AI_GIA=1 → nhà đọc "gia": tiếng im lặng dài theo số chữ, phát dần, không cần khóa', async (t) => {
  dungGia(t);
  const khoaCu = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  t.after(() => { if (khoaCu !== undefined) process.env.OPENAI_API_KEY = khoaCu; });
  assert.equal(tts.nhaDoc(), 'gia');
  assert.equal(tts.modelMacDinh(), 'may-doc-gia');
  const manh = [];
  const chu = 'Áo số 12 giá 289.000 đồng, cả nhà chốt nha';
  const kq = await tts.docChu({ chu, giong: 'marin', khiAm: (b) => manh.push(b) });
  assert.equal(kq.model, 'may-doc-gia');
  assert.ok(Math.abs(kq.giay - chu.length / 14) < 0.01);
  assert.ok(manh.length >= 2 && Buffer.concat(manh).length === kq.pcm.length);
  assert.ok(kq.pcm.every((x) => x === 0), 'im lặng');
  const hai = await tts.docHoiThoai({ luot: [{ nguoi: 'Mai', chu: 'Chào cả nhà' }, { nguoi: 'Tung', chu: 'Chào Mai' }], giong: { Mai: 'marin', Tung: 'cedar' } });
  assert.equal(hai.model, 'may-doc-gia');
  assert.ok(hai.giay > 1);
});

test('kiemDocDung: số đọc bằng chữ vẫn khớp; lệch số hoặc thiếu hơn 20% chữ thì lệch', () => {
  assert.equal(tts.kiemDocDung('Áo số 12 giá 289.000 đồng nha', 'Áo số mười hai giá hai trăm tám mươi chín nghìn đồng nha').dung, true);
  assert.equal(tts.kiemDocDung('Dạ súp lơ 55 nghìn một cân', 'Dạ, súp lơ năm mươi lăm nghìn một cân.').dung, true);
  // Thử thật 28/10/2026: chép lại trộn chữ và số.
  assert.equal(tts.kiemDocDung('Túi xách số 9 giá 1.250.000 đồng', 'Túi xách số 9 giá một triệu 250 nghìn đồng').dung, true);
  assert.equal(tts.kiemDocDung('Túi xách số 9 giá 1.250.000 đồng', 'Túi xách số 9 giá một triệu 520 nghìn đồng').dung, false);
  assert.equal(tts.kiemDocDung('Áo số 12 giá 289.000 đồng', 'Áo số 12 giá 298.000 đồng').dung, false);
  assert.equal(tts.kiemDocDung('Áo số 12 giá 289.000 đồng', 'Áo số 12 giá 289.000 đồng, còn 3 cái').dung, false, 'thêm số cũng lệch');
  assert.equal(tts.kiemDocDung('Chào cả nhà hôm nay rau tươi lắm nha', 'Chào cả nhà hôm nay rau tươi lắm').dung, true, 'thiếu 1/8 chữ còn được');
  assert.equal(tts.kiemDocDung('Chào cả nhà hôm nay rau tươi lắm nha', 'Chào cả nhà').dung, false);
  assert.equal(tts.kiemDocDung('Chào cả nhà', '').dung, false);
});

test('máy giả "đọc sai một số" → đọc lại một lần rồi lỗi DOC_LECH, không phát mẩu tiếng nào', async (t) => {
  dungGia(t);
  tts.datDocSai(true);
  const manh = [];
  await assert.rejects(tts.docChu({ chu: 'Quần jean số 15 giá 349.000 đồng', giong: 'marin', khiAm: (b) => manh.push(b) }),
    (e) => e.ma === 'DOC_LECH' && /hiện chữ/.test(e.message));
  assert.equal(manh.length, 0, 'câu lệch không ra loa');
  tts.datDocSai(false);
  await tts.docChu({ chu: 'Quần jean số 15 giá 349.000 đồng', giong: 'marin', khiAm: (b) => manh.push(b) });
  assert.ok(manh.length > 0);
});

test('Đội AI với máy đọc giả: làm tiếng đoạn không cần khóa, ghi nhật ký nhà "gia" 0 đồng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  dungGia(t);
  const phongThu = require('../server/doi-ai/phong-thu');
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const { csdl } = require('../server/db/ket-noi');
  phongThu.quenHetLuot();
  const nv = doiAi.nhanVat();
  const lc = phongThu.cacLuaChon(phongThu.MODEL_CHEN, nv);
  assert.deepEqual(lc.map((x) => x.model), ['may-doc-gia']);
  const a12 = taoSanPhamMau();
  const ten = nv.map((n) => n.ten);
  const kq = await phongThu.lamTiengDoan({
    doan: { san_pham_id: a12.san_pham.id, loi_nhac: `${ten[0]}: Sơ mi linen 289.000 đồng nè <laugh>\n${ten[1]}: Mát không ${ten[0]}?` },
    viec: 'Đội AI · thử máy giả',
  });
  assert.equal(kq.phan.length, 1);
  assert.ok(kq.phan[0].giay > 2);
  const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'doi_ai'").all().at(-1);
  assert.equal(run.nha, 'gia');
  assert.equal(run.model, 'may-doc-gia');
  assert.equal(run.chi_phi_usd, 0);
});
