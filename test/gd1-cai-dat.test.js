'use strict';

/** GD1 (F-119, F-121): cài đặt "ẩn bớt từng phần" và tỷ giá USD → đồng, qua API. 0 đồng, không gọi mạng. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moPhanMem } = require('./ho-tro');

test('Cài đặt → Phần mềm: ẩn bớt phần giao diện và tỷ giá', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);

  await t.test('mặc định: không ẩn gì, tỷ giá 26.000, có danh sách phần ẩn được', async () => {
    const r = await pm.goi('GET', '/api/cai-dat');
    assert.equal(r.ma, 200);
    assert.deepEqual(r.than.giao_dien, { an: [] });
    assert.equal(r.than.ty_gia_vnd, 26000);
    assert.ok(r.than.phan_an_duoc.includes('doi_ai_radio'));
  });

  await t.test('ẩn một phần: lưu lại, bỏ trùng; phần lạ bị từ chối', async () => {
    const ok = await pm.goi('PUT', '/api/cai-dat', { giao_dien: { an: ['anh_khach', 'anh_khach', 'so_tay'] } });
    assert.equal(ok.ma, 200);
    assert.deepEqual(ok.than.giao_dien.an, ['anh_khach', 'so_tay']);
    const sai = await pm.goi('PUT', '/api/cai-dat', { giao_dien: { an: ['may_chu'] } });
    assert.equal(sai.ma, 400);
    assert.deepEqual((await pm.goi('GET', '/api/cai-dat')).than.giao_dien.an, ['anh_khach', 'so_tay'], 'lần sai không làm đổi gì');
  });

  await t.test('tỷ giá: đổi được, giới hạn 10.000–100.000', async () => {
    const ok = await pm.goi('PUT', '/api/cai-dat', { ty_gia_vnd: 25500 });
    assert.equal(ok.than.ty_gia_vnd, 25500);
    assert.equal((await pm.goi('PUT', '/api/cai-dat', { ty_gia_vnd: 5 })).ma, 400);
    assert.equal((await pm.goi('PUT', '/api/cai-dat', { ty_gia_vnd: 'abc' })).ma, 400);
    assert.equal((await pm.goi('GET', '/api/cai-dat')).than.ty_gia_vnd, 25500);
  });
});
