'use strict';

/**
 * Quá 24 giờ (SPEC.md F-78): Hộp thư ẩn ô gõ, hiện nút mở đúng cuộc trò chuyện trong Meta Business Suite (lùi về hộp thư chung
 * của Page khi thiếu người nhắn). Chỉ là link: không gửi gì ra Facebook.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');

test('link Business Suite: đúng cuộc trò chuyện; thiếu người nhắn → hộp thư chung', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { linkBusinessSuite } = require('../server/nghiep-vu/fb-page');
  const u = new URL(linkBusinessSuite('1234', '5678'));
  assert.equal(u.origin + u.pathname, 'https://business.facebook.com/latest/inbox/all');
  assert.equal(u.searchParams.get('asset_id'), '1234');
  assert.equal(u.searchParams.get('selected_item_id'), '5678');
  assert.equal(u.searchParams.get('thread_type'), 'FB_MESSAGE');
  const chung = new URL(linkBusinessSuite('1234'));
  assert.equal(chung.searchParams.get('selected_item_id'), null);
});

test('API hội thoại: qua_24_gio chỉ bật khi quá 24 giờ; đọc hội thoại không gọi Facebook', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const { csdl } = require('../server/db/ket-noi');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api', require('../server/api/hop-thu'));
  const sv = app.listen(0);
  t.after(() => sv.close());
  const goc = `http://127.0.0.1:${sv.address().port}/api`;
  const ev = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: '999', psid: 'ps1', mid: 'm1', noi_dung: 'chào shop' }, { dienTap: false });
  const doc = async () => (await fetch(`${goc}/hoi-thoai/${ev.hoiThoai.id}`)).json();
  let d = await doc();
  assert.equal(d.qua_24_gio, false);
  csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE id = ?').run(new Date(Date.now() - 25 * 3600e3).toISOString(), ev.hoiThoai.id);
  d = await doc();
  assert.equal(d.qua_24_gio, true);
  assert.match(d.link_business_suite, /asset_id=999.*selected_item_id=ps1/);
});
