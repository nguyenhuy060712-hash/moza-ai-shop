'use strict';

/**
 * F-110 (BH10): dòng kiểm trợ lý AI của Facebook (Business AI) trên bảng Sẵn sàng. Meta không có API đọc "Business AI đang bật" (docs/11
 * T10) → phát hiện gián tiếp: tin khách về kênh standby (H25), gửi tin lỗi 10/2018300 (H26) → đỏ có hướng dẫn. Ô tích riêng, nhớ 7
 * ngày rồi hỏi lại. Meta giả, 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');

test('H25: Business AI bật → tin về standby → bảng Sẵn sàng đỏ có hướng dẫn; tích "Đã tắt" → hết đỏ, nhớ 7 ngày, ngày thứ 8 hỏi lại', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { MetaGia } = require('../server/facebook/meta-gia');
  const { tuWebhook } = require('../server/facebook/su-kien');
  const ss = require('../server/san-sang');
  const meta = new MetaGia({ pages: [] });
  meta.themPage({ id: 'p1', ten: 'Nhà Mơ' });

  const bayGio = new Date();
  let kq = ss.kiem({ bayGio });
  assert.ok(kq.vang.some((x) => x.ma === 'business_ai_chua_tich'), 'chưa tích → vàng');
  assert.ok(!kq.do.some((x) => x.ma === 'business_ai'));
  const o = kq.tich.find((x) => x.k === 'business_ai');
  assert.ok(o && o.lau && !o.bat);
  assert.ok(!kq.tich.find((x) => x.k === 'binh_luan_tin_nhan').chu.includes('Business AI'), 'tách khỏi ô Bình luận → tin nhắn');

  meta.datBusinessAi('p1', true);
  const ev = tuWebhook(meta.nhan({ pageId: 'p1', ten: 'Lan', noiDung: 'còn áo không shop' }));
  assert.equal(ev[0].loai, 'standby');
  kq = ss.kiem({ bayGio: new Date() });
  const d = kq.do.find((x) => x.ma === 'business_ai');
  assert.ok(d, JSON.stringify(kq.do));
  assert.match(d.chu, /standby.*Định tuyến hội thoại/);

  ss.datTich(null, 'business_ai', true);
  kq = ss.kiem({ bayGio: new Date() });
  assert.ok(!kq.do.some((x) => x.ma === 'business_ai') && !kq.vang.some((x) => x.ma === 'business_ai_chua_tich'));
  assert.ok(kq.tich.find((x) => x.k === 'business_ai').bat);
  const sau6 = ss.kiem({ bayGio: new Date(Date.now() + 6 * 86400e3) });
  assert.ok(!sau6.vang.some((x) => x.ma === 'business_ai_chua_tich'));
  const sau8 = ss.kiem({ bayGio: new Date(Date.now() + 8 * 86400e3) });
  assert.ok(sau8.vang.some((x) => x.ma === 'business_ai_chua_tich'), 'tua 8 ngày → hỏi lại');
  assert.ok(!sau8.tich.find((x) => x.k === 'business_ai').bat);
});

test('H26: gửi tin lỗi 10/2018300 → lỗi FB_UNG_DUNG_KHAC_GIU và bảng Sẵn sàng đỏ (24 giờ)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { MetaGia, LoiMeta } = require('../server/facebook/meta-gia');
  const { doiLoi } = require('../server/facebook/graph');
  const ss = require('../server/san-sang');
  const meta = new MetaGia({ pages: [] });
  meta.themPage({ id: 'p1', ten: 'Nhà Mơ' });
  meta.nhan({ pageId: 'p1', ten: 'Lan', noiDung: 'chào shop' });
  meta.datBusinessAi('p1', true);
  let loi = null;
  try { meta.gui('p1', { recipient: { id: meta.psidCua('p1', 'Lan') }, message: { text: 'Dạ shop chào bạn' } }); } catch (e) { loi = e; }
  assert.ok(loi instanceof LoiMeta);
  const e = doiLoi({ code: loi.code ?? 10, error_subcode: 2018300, message: loi.message });
  assert.equal(e.ma, 'FB_UNG_DUNG_KHAC_GIU');
  const d = ss.kiem({ bayGio: new Date() }).do.find((x) => x.ma === 'business_ai');
  assert.match(d.chu, /10\/2018300/);
  assert.ok(!ss.kiem({ bayGio: new Date(Date.now() + 25 * 3600e3) }).do.some((x) => x.ma === 'business_ai'), 'quá 24 giờ thì thôi đỏ');
});
