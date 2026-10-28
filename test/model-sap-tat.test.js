'use strict';

/**
 * F-111 (BH10): bảng model, giá, ngày tắt. Model đang dùng còn ≤ 30 ngày là hãng tắt → bảng Sẵn sàng báo vàng; đã tắt → đỏ, có nút
 * "Đổi model". Giá máy đọc mới (Realtime theo token, ElevenLabs theo ký tự) đọc từ gia-model.json. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');
const chiPhi = require('../server/nghiep-vu/chi-phi');

// Máy đọc cũ OpenAI: lấy từ bảng giá (dòng tts có tat_ngay 2027-01-06) — mã không còn gọi tên model này (F-108).
const CU = Object.entries(require('../server/cau-hinh/gia-model.json').tts).find(([, g]) => g.tat_ngay === '2027-01-06')[0];
const MAY_DOC_CU = [{ model: CU, noi_dung: 'Máy đọc giọng' }];

test('modelSapTat: 10/12/2026 còn 27 ngày → sắp tắt; 7/1/2027 → đã tắt; 28/10/2026 → chưa báo', () => {
  assert.deepEqual(chiPhi.modelSapTat(new Date('2026-10-28T09:00:00+07:00'), MAY_DOC_CU), []);
  const v = chiPhi.modelSapTat(new Date('2026-12-10T09:00:00+07:00'), MAY_DOC_CU);
  assert.equal(v.length, 1);
  assert.equal(v[0].tat_ngay, '2027-01-06');
  assert.equal(v[0].con_ngay, 27);
  const d = chiPhi.modelSapTat(new Date('2027-01-07T09:00:00+07:00'), MAY_DOC_CU);
  assert.ok(d[0].con_ngay <= 0);
  assert.deepEqual(chiPhi.modelSapTat(new Date('2027-01-07T09:00:00+07:00'), [{ model: 'gpt-6-luna', noi_dung: 'Agent' }]), [], 'model không có ngày tắt');
});

test('giá model mới khớp bảng tra 28/10/2026; ElevenLabs theo ký tự; Realtime có giá chữ chép lại riêng', () => {
  assert.equal(chiPhi.tinhChiPhi('gpt-6.1-sol', 1e6, 1e6), 12);
  assert.equal(chiPhi.tinhChiPhi('gpt-6.1-terra', 1e6, 1e6), 6);
  assert.equal(chiPhi.tinhChiPhi('claude-sonnet-5-5', 1e6, 1e6), 12);
  assert.ok(Math.abs(chiPhi.tinhChiPhi('claude-haiku-5-5', 1e6, 1e6) - 0.6) < 1e-9);
  assert.ok(Math.abs(chiPhi.tinhChiPhiTtsKyTu('eleven_v4', 1000) - 0.08) < 1e-9);
  assert.ok(Math.abs(chiPhi.tinhChiPhiTtsKyTu('eleven_v4_turbo', 2000) - 0.08) < 1e-9);
  assert.ok(Math.abs(chiPhi.tinhChiPhiDoc('eleven_v4', { ky_tu: 500 }) - 0.04) < 1e-9);
  // 1 phút tiếng ≈ 1.200 token tiếng ra → 0,024 USD (docs/11 T2); chữ vào 100 token, chữ chép lại 100 token.
  const usd = chiPhi.tinhChiPhiDoc('gpt-realtime-2.1-mini', { vao: 100, ra: 1200, ra_chu: 100 });
  assert.ok(Math.abs(usd - (100 * 0.6 + 1200 * 20 + 100 * 2.4) / 1e6) < 1e-12);
  assert.equal(chiPhi.tinhChiPhiDoc('may-doc-gia', { vao: 0, ra: 0 }), 0);
  const cd = require('../server/cau-hinh/mac-dinh.json').nha;
  for (const m of ['gpt-6.1-sol', 'gpt-6.1-terra']) assert.ok(cd.openai.model.includes(m));
  for (const m of ['claude-sonnet-5-5', 'claude-haiku-5-5']) assert.ok(cd.anthropic.model.includes(m));
});

test('bảng Sẵn sàng: model đang dùng sắp tắt → vàng, đã tắt → đỏ, có nút Đổi model', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const tts = require('../server/agent/nha-cung-cap/tts');
  const cu = tts.modelMacDinh;
  // Giả như máy đọc vẫn là máy cũ (bản trước BH10).
  tts.modelMacDinh = () => CU;
  t.after(() => { tts.modelMacDinh = cu; });
  const sanSang = require('../server/san-sang');
  const vang = sanSang.kiem({ bayGio: new Date('2026-12-10T09:00:00+07:00') });
  const v = vang.vang.find((x) => x.ma === 'model_sap_tat');
  assert.ok(v, JSON.stringify(vang.vang));
  assert.ok(v.chu.includes(CU) && /06\/01\/2027.*còn 27 ngày/.test(v.chu), v.chu);
  assert.equal(v.nut.hanh_dong, 'doi_model');
  const doDs = sanSang.kiem({ bayGio: new Date('2027-01-07T09:00:00+07:00') }).do;
  assert.ok(doDs.some((x) => x.ma === 'model_da_tat' && /đã tắt/.test(x.chu)));
  assert.ok(!sanSang.kiem({ bayGio: new Date('2026-10-28T09:00:00+07:00') }).vang.some((x) => x.ma === 'model_sap_tat'));
});
