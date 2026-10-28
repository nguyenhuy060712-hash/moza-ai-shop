'use strict';

// Chi phí AI (sự cố 26/9/2026, #88): Gemini quá tải vài giây → Tư vấn viên nâng lên GPT-6 Sol và không bao giờ quay về.
// Nay: (1) Agent có dự phòng thì lỗi của nhà chính đi sang dự phòng (Tư vấn viên: gpt-6-luna, rẻ), không nâng lên model đắt;
// (2) Agent không có dự phòng thì vẫn nâng, nhưng chỉ trong 5 phút kể từ lần lỗi gần nhất; (3) buổi tập dùng model rẻ riêng.

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');

const LUOC_DO = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };

function nhaGia(daGoi, loi) {
  const tao = (nha) => ({
    async goi(o) {
      daGoi.push(`${nha}/${o.model}`);
      if (loi(nha)) throw Object.assign(new Error('503 quá tải'), { ma: 'AI_LOI' });
      return { goiCongCu: [], chu: JSON.stringify({ ok: true }), goc: null, tokenVao: 10, tokenRa: 5 };
    },
  });
  return { gemini: tao('gemini'), openai: tao('openai'), anthropic: tao('anthropic') };
}

test('chi phí AI khi nhà chính lỗi và khi tập', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { chayAgent, datLaiTrangThaiNha } = require('../server/agent/runtime');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const daGoi = [];
  let geminiLoi = true;
  const nhaCungCap = nhaGia(daGoi, (nha) => nha === 'gemini' && geminiLoi);
  const chay = (o = {}) => chayAgent({ agentId: 'tu_van', kichHoat: 'thử', tinDau: 'x', luocDo: LUOC_DO, nhaCungCap, ...o });

  await t.test('Tư vấn viên mặc định: dự phòng gpt-6-luna (nâng cấp 015)', () => {
    const a = caiDat.layAgent('tu_van');
    assert.deepEqual([a.nha, a.model, a.nha_du_phong, a.model_du_phong], ['gemini', 'gemini-3.8-flash', 'openai', 'gpt-6-luna']);
  });

  await t.test('có dự phòng: Gemini lỗi → dự phòng rẻ, không nâng; sau 5 phút thử lại Gemini', async () => {
    datLaiTrangThaiNha();
    for (let i = 0; i < 3; i++) {
      const kq = await chay();
      assert.equal(kq.lyDoNang, null, 'không nâng lên model đắt');
      assert.equal(kq.model, 'gpt-6-luna');
    }
    daGoi.length = 0;
    await chay();
    assert.equal(daGoi[0], 'openai/gpt-6-luna', 'lỗi 3 lần: 5 phút đi thẳng dự phòng');
    assert.ok(!daGoi.some((x) => /gpt-6-sol|claude/.test(x)), 'không bao giờ gọi model đắt');
    geminiLoi = false;
    const bayGio = Date.now();
    t.mock.method(Date, 'now', () => bayGio + 6 * 60 * 1000);
    daGoi.length = 0;
    const kq = await chay();
    assert.equal(daGoi[0], 'gemini/gemini-3.8-flash', 'hết 5 phút: thử lại nhà chính');
    assert.equal(kq.model, 'gemini-3.8-flash');
    t.mock.restoreAll();
  });

  await t.test('không có dự phòng: vẫn nâng khi lỗi 2 lần, nhưng chỉ trong 5 phút rồi quay về', async () => {
    datLaiTrangThaiNha();
    geminiLoi = true;
    caiDat.suaAgent('tu_van', { nha_du_phong: null, model_du_phong: null });
    await chay();
    await chay();
    const kq = await chay();
    assert.match(kq.lyDoNang || '', /lỗi 2 lần liên tiếp/);
    geminiLoi = false;
    const bayGio = Date.now();
    t.mock.method(Date, 'now', () => bayGio + 6 * 60 * 1000);
    daGoi.length = 0;
    const kq2 = await chay();
    assert.equal(kq2.lyDoNang, null, 'hết 5 phút: không nâng nữa');
    assert.equal(daGoi[0], 'gemini/gemini-3.8-flash');
    t.mock.restoreAll();
    caiDat.suaAgent('tu_van', { nha_du_phong: 'openai', model_du_phong: 'gpt-6-luna' });
  });

  await t.test('buổi tập: Tư vấn viên chạy gpt-6-luna, kể cả khi có lý do nâng (không gọi model đắt)', async () => {
    datLaiTrangThaiNha();
    const m = caiDat.modelDienTap('tu_van');
    assert.deepEqual([m.nha, m.model], ['openai', 'gpt-6-luna']);
    assert.equal(caiDat.modelDienTap('director'), null, 'Agent khác dùng model thường');
    daGoi.length = 0;
    const kq = await chay({ thayModel: m, lyDoNang: 'Khách khiếu nại' });
    assert.deepEqual(daGoi, ['openai/gpt-6-luna']);
    assert.equal(kq.model, 'gpt-6-luna');
  });
});
