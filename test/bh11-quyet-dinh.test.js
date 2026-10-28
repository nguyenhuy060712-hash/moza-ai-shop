'use strict';

/** BH11 (docs/11 mục 3.3): Decisions — dựng đúng yêu cầu `client.decisions.create`, đọc đúng trả lời, Decisions giả, ghi chi phí chỉ token vào. 0 đồng. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');
const openai = require('../server/agent/nha-cung-cap/openai');
const gia = require('../server/agent/nha-cung-cap/gia-mau');

const CAU = [{ ten: 'mon', loai: 'choice', chiDan: 'Món nào?', luaChon: [{ gt: 'so_12', moTa: 'Sơ mi linen — đen, trắng' }, { gt: 'khong_ro' }] },
  { ten: 'moi_xem_size', loai: 'predicate', chiDan: 'Mai vừa mời xem bảng size?' }];

test('dựng yêu cầu Decisions: ảnh base64, input_json, câu choice + predicate', () => {
  const y = openai.chuyenQuyetDinh({ heThong: 'Bạn chọn món.', noiDung: [{ json: { mau: [1] } }, { anh: { mime: 'image/jpeg', base64: 'QUJD', detail: 'low' } }, { chu: 'x' }], cauHoi: CAU });
  assert.equal(y.model, 'gpt-6-luna');
  assert.deepEqual(y.input[0], { role: 'developer', content: 'Bạn chọn món.' });
  assert.deepEqual(y.input[1].content[0], { type: 'input_json', data: { mau: [1] } });
  assert.deepEqual(y.input[1].content[1], { type: 'input_image', image_url: 'data:image/jpeg;base64,QUJD', detail: 'low' });
  assert.deepEqual(y.input[1].content[2], { type: 'input_text', text: 'x' });
  assert.deepEqual(y.questions[0], { type: 'choice', name: 'mon', instructions: 'Món nào?', choices: [{ value: 'so_12', description: 'Sơ mi linen — đen, trắng' }, { value: 'khong_ro' }] });
  assert.deepEqual(y.questions[1], { type: 'predicate', name: 'moi_xem_size', instructions: 'Mai vừa mời xem bảng size?' });
  assert.ok(!('_dapAn' in y));
});

test('đọc trả lời Decisions: choice, predicate, từ chối, token vào', () => {
  const r = openai.docQuyetDinh({ model: 'gpt-6-luna', usage: { input_tokens: 900, output_tokens: 3, input_tokens_details: { cached_tokens: 800 } },
    answers: [{ type: 'choice', name: 'mon', choice: 'so_12', confidence: 0.86, probabilities: [] }, { type: 'predicate', name: 'moi_xem_size', probability: 0.1 }, { type: 'refusal', name: 'x' }] });
  assert.deepEqual(r.traLoi.mon, { loai: 'choice', chon: 'so_12', tinCay: 0.86 });
  assert.equal(r.traLoi.moi_xem_size.chon, false);
  assert.equal(r.traLoi.moi_xem_size.tinCay, 0.9);
  assert.equal(r.traLoi.x.tuChoi, true);
  assert.equal(r.tokenVao, 900);
  assert.equal(r.tokenRa, 0);
  assert.equal(r.tokenDem, 800);
});

test('Decisions giả: đặt sẵn → gợi ý _dapAn → lựa chọn đầu', async () => {
  let r = await gia.quyetDinh({ cauHoi: CAU });
  assert.equal(r.traLoi.mon.chon, 'so_12');
  assert.equal(r.traLoi.mon.tinCay, 0.5);
  r = await gia.quyetDinh({ cauHoi: CAU, _dapAn: { mon: 'khong_ro' } });
  assert.equal(r.traLoi.mon.chon, 'khong_ro');
  gia.datQuyetDinh({ mon: { chon: 'so_12', tinCay: 0.99 } });
  r = await gia.quyetDinh({ cauHoi: CAU, _dapAn: { mon: 'khong_ro' } });
  assert.equal(r.traLoi.mon.tinCay, 0.99);
  gia.datQuyetDinh(null);
});

test('quyetDinh: ghi agent_run chi phí chỉ token vào; Dừng AI / Dừng mọi thứ chặn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { quyetDinh } = require('../server/agent/quyet-dinh');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const nha = { async quyetDinh() { return { traLoi: { mon: { loai: 'choice', chon: 'so_12', tinCay: 0.9 } }, model: 'gpt-6-luna', tokenVao: 10000, tokenRa: 0 }; } };
  const kq = await quyetDinh({ agentId: 'nhin_mon', kichHoat: 'thử', noiDung: [{ chu: 'x' }], cauHoi: CAU, nhaCungCap: nha });
  assert.equal(kq.ok, true);
  assert.equal(kq.traLoi.mon.chon, 'so_12');
  assert.ok(Math.abs(kq.chiPhi - 0.001) < 1e-9); // 10.000 token × 0,10 USD / 1 triệu
  const run = csdl().prepare('SELECT chi_phi_usd, token_ra, model FROM agent_run WHERE id = ?').get(kq.runId);
  assert.equal(run.token_ra, 0);
  assert.equal(run.model, 'gpt-6-luna');
  caiDat.datKhanCap(true);
  assert.equal((await quyetDinh({ agentId: 'nhin_mon', kichHoat: 'thử', noiDung: [], cauHoi: CAU, nhaCungCap: nha })).loi.ma, 'KHAN_CAP_DANG_BAT');
  caiDat.datKhanCap(false);
  const loi = await quyetDinh({ agentId: 'nhin_mon', kichHoat: 'thử', noiDung: [], cauHoi: CAU, nhaCungCap: { async quyetDinh() { throw new Error('mạng hỏng'); } } });
  assert.equal(loi.ok, false);
  assert.equal(loi.loi.ma, 'AI_LOI');
});

test('F-113: kết quả Decisions → phiếu MOZA nhìn — "chắc" khi tin cậy ≥ 0,8 và không phải khong_ro; từ chối / khong_ro → không có món', () => {
  const { phieuTuQuyetDinh } = require('../server/agent/agents/nhin-mon');
  assert.deepEqual(phieuTuQuyetDinh({ mon: { chon: 'so_15', tinCay: 0.8 } }), { co_mon: true, so: 15, chac: 'cao' });
  assert.deepEqual(phieuTuQuyetDinh({ mon: { chon: 'so_15', tinCay: 0.79 } }), { co_mon: true, so: 15, chac: 'vua' });
  assert.deepEqual(phieuTuQuyetDinh({ mon: { chon: 'khong_ro', tinCay: 0.99 } }), { co_mon: false, so: 0, chac: 'thap' });
  assert.deepEqual(phieuTuQuyetDinh({ mon: { tuChoi: true, chon: null, tinCay: 0 } }), { co_mon: false, so: 0, chac: 'thap' });
  assert.deepEqual(phieuTuQuyetDinh(null), { co_mon: false, so: 0, chac: 'thap' });
});
