'use strict';

/** GD1 (F-121, Q7): việc chờ duyệt do "Dừng mọi thứ" / giới hạn tin có hạn 24 giờ; quá hạn thì thôi đếm. 0 đồng. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');
const choDuyet = require('../server/nghiep-vu/cho-duyet');
const { csdl } = require('../server/db/ket-noi');

test('hạn Chờ duyệt 24 giờ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);

  await t.test('mục có hạn đếm bình thường; mục không hạn (luật Hỏi) không bao giờ hết hạn', () => {
    choDuyet.taoMuc({ hanhDong: 'gui_tin', thamSo: {}, lyDo: 'Dừng mọi thứ', hetHanGio: 24 });
    choDuyet.taoMuc({ hanhDong: 'gui_tin', thamSo: {}, lyDo: 'Luật quyền: cần duyệt' });
    assert.equal(choDuyet.demCho(), 2);
    assert.equal(choDuyet.demHetHan(), 0);
  });

  await t.test('quá hạn: không đếm, không nằm ở danh sách chờ, nằm ở mục "Đã hết hạn"', () => {
    const cu = choDuyet.taoMuc({ hanhDong: 'gui_tin', thamSo: {}, lyDo: 'Dừng mọi thứ', hetHanGio: 24 });
    csdl().prepare('UPDATE cho_duyet SET het_han_luc = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), cu.id);
    assert.equal(choDuyet.demCho(), 2);
    assert.equal(choDuyet.demHetHan(), 1);
    assert.ok(!choDuyet.danhSach({ trangThai: 'cho' }).some((m) => m.id === cu.id));
    assert.deepEqual(choDuyet.danhSach({ trangThai: 'het_han' }).map((m) => m.id), [cu.id]);
  });

  await t.test('mục quá hạn vẫn xem lại và từ chối được (không mất dấu vết)', () => {
    const [cu] = choDuyet.danhSach({ trangThai: 'het_han' });
    assert.equal(choDuyet.chot(cu.id, 'tu_choi').trang_thai, 'tu_choi');
    assert.equal(choDuyet.demHetHan(), 0);
  });
});
