'use strict';

/**
 * Hợp đồng Facebook (SPEC.md F-15 mở rộng, #92; docs/07 mục 5): CÙNG kịch bản chạy trên Facebook giả (gia.js) và trên
 * Facebook thật (that.js + graph.js + nhip-goi.js) nối `fetchMetaGia` vào cùng loại Meta giả → cùng kết quả, cùng mã lỗi MOZA.
 * Hai bản đủ mọi hàm của hợp đồng; mọi hành vi trong hanh-vi-meta.json có nguồn và test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { thatTrenMetaGia } = require('./ho-tro-fb');

const maLoi = async (p) => { try { await p; return 'ok'; } catch (e) { return e.ma || e.message; } };

/** Kịch bản chung: `fb` là bản đang thử, `gia` là Facebook giả giữ Meta giả (dùng để đóng vai khách). */
async function kichBan(fb, gia) {
  const ra = {};
  const l = gia.batDauLive('Live thử hợp đồng');
  const ds = await fb.timLiveDangPhat();
  ra.live = ds.map((x) => ({ id: x.id === l.id, video: !!x.video_id && x.video_id !== x.id, bat_dau: !!x.bat_dau, link: !!x.fb_link, page: x.page_id }));
  const nhan = [];
  const luong = fb.moLuongBinhLuan(l.id, (bl) => nhan.push(bl));
  await new Promise((r) => setTimeout(r, 20));
  gia.themBinhLuan({ ten: 'Lan Nguyễn', noi_dung: 'chốt 12 đen M' });
  gia.themBinhLuan({ ten: 'x', noi_dung: 'ẩn danh nè', an_danh: true });
  gia.themBinhLuan({ ten: 'Shop', noi_dung: 'ví dụ chốt 12 đen M', la_page: true });
  for (let i = 0; i < 50 && nhan.length < 3; i += 1) await new Promise((r) => setTimeout(r, 10));
  luong.dong();
  ra.binh_luan = nhan.map((b) => ({ ten: b.ten, noi: b.noi_dung, an: !!b.an_danh, page: !!b.la_page }));
  const doc = await fb.docBinhLuan(l.id, null);
  ra.doc = doc.length;
  const bl = doc[0];
  ra.nhan_duoc = await fb.coTheNhanRieng({ page_id: 'page_gia', comment_id: bl.id });
  const the = { kieu: 'anh', tieu_de: 'Áo 12 Đen/M · 159.000đ', phu_de: 'Tin tự động từ trợ lý AI của shop', anh: { url: 'https://moza.test/a.jpg' },
    nut: [{ tieu_de: 'Giữ, lên đơn', payload: 'GIU|1' }, { tieu_de: 'Đổi', payload: 'DOI|1' }, { tieu_de: 'Không lấy', payload: 'KL|1' }] };
  const r = await fb.nhanRiengThe({ page_id: 'page_gia', comment_id: bl.id, the });
  ra.psid = r.psid === gia.psidCua('page_gia', 'Lan Nguyễn');
  ra.lan2 = await maLoi(fb.nhanRiengThe({ page_id: 'page_gia', comment_id: bl.id, the }));
  ra.lan2_chu = await maLoi(fb.nhanRieng({ page_id: 'page_gia', comment_id: bl.id, noi_dung: 'x' }));
  ra.tin_thu_hai = await maLoi(fb.guiTinNhan({ page_id: 'page_gia', psid: r.psid, noi_dung: 'còn đó không' }));
  gia.khachNhan({ page_id: 'page_gia', psid: r.psid, noi_dung: 'dạ em lấy' });
  ra.sau_khi_nhan = await maLoi(fb.guiTinNhan({ page_id: 'page_gia', psid: r.psid, noi_dung: 'dạ shop ghi rồi' }));
  ra.the_dai = await maLoi(fb.guiThe({ page_id: 'page_gia', psid: r.psid, noi_dung: 'x'.repeat(641), nut: the.nut }));
  ra.lua_chon = await maLoi(fb.guiLuaChon({ page_id: 'page_gia', psid: r.psid, chu: 'Chọn size', lua_chon: [{ tieu_de: 'M', payload: 'P|m' }] }));
  ra.anh = await maLoi(fb.guiAnh({ page_id: 'page_gia', psid: r.psid, anh: Buffer.alloc(10), ten: 'a.jpg' }));
  const tai = await fb.taiAnhLen({ page_id: 'page_gia', anh: Buffer.alloc(10), ten: 'a.jpg' });
  ra.tai = !!tai.attachment_id;
  ra.media = await maLoi(fb.guiTheSp({ page_id: 'page_gia', psid: r.psid, the: { kieu: 'media', anh: { attachment_id: tai.attachment_id }, nut: the.nut } }));
  ra.mau = await fb.trangThaiMau({ page_id: 'page_gia', ten: 'moza_don_da_gui' });
  ra.mau_moi = (await fb.taoMauUtility({ page_id: 'page_gia', ten: 'moza_thu', noi_dung: 'Đơn {{1}}', nut: [{ tieu_de: 'Xác nhận', payload: 'MAU_XAC_NHAN' }] })).trang_thai;
  gia.meta.tua(26 * 3600e3);
  ra.qua_24h = await maLoi(fb.guiTinNhan({ page_id: 'page_gia', psid: r.psid, noi_dung: 'muộn' }));
  ra.utility = await maLoi(fb.guiUtility({ page_id: 'page_gia', psid: r.psid, ten: 'moza_don_da_gui', tham_so: ['Lan', 'DH-1', 'Shop', 'GHN1'] }));
  ra.ho_so = await maLoi(fb.datHoSoMessenger({ page_id: 'page_gia', ho_so: { get_started: { payload: 'BAT_DAU' } } }));
  ra.han_che_truoc = (await fb.kiemHanChePage({ page_id: 'page_gia' })).bi_han_che;
  gia.meta.datCamNhan('page_gia', true);
  ra.han_che_sau = (await fb.kiemHanChePage({ page_id: 'page_gia' })).bi_han_che;
  gia.khachNhan({ page_id: 'page_gia', psid: r.psid, noi_dung: 'alo' });
  ra.bi_cam = await maLoi(fb.guiTinNhan({ page_id: 'page_gia', psid: r.psid, noi_dung: 'x' }));
  gia.meta.datCamNhan('page_gia', false);
  ra.an = await fb.anBinhLuan(bl.id, 'page_gia');
  ra.tra_loi = !!(await fb.traLoiBinhLuan({ page_id: 'page_gia', comment_id: bl.id, noi_dung: 'Shop nhắn riêng rồi nha' })).id;
  ra.ten = await fb.layTenNguoi({ page_id: 'page_gia', psid: r.psid });
  return ra;
}

test('hợp đồng Facebook: bản giả và bản thật (fetch giả vào Meta giả) cho cùng kết quả, cùng mã lỗi', async () => {
  const { FacebookGia } = require('../server/facebook/gia');
  const gia1 = new FacebookGia();
  const kqGia = await kichBan(gia1, gia1);
  const gia2 = new FacebookGia();
  const { that, fetch: f } = thatTrenMetaGia(gia2);
  const kqThat = await kichBan(that, gia2);
  assert.deepEqual(kqThat, kqGia);
  // Kết quả đúng như luật Meta.
  assert.deepEqual(kqGia.live, [{ id: true, video: true, bat_dau: true, link: true, page: 'page_gia' }]);
  assert.deepEqual(kqGia.binh_luan, [
    { ten: 'Lan Nguyễn', noi: 'chốt 12 đen M', an: false, page: false },
    { ten: 'Một bạn', noi: 'ẩn danh nè', an: true, page: false },
    { ten: 'Shop thời trang (giả)', noi: 'ví dụ chốt 12 đen M', an: false, page: true },
  ]);
  assert.equal(kqGia.nhan_duoc, true);
  assert.equal(kqGia.psid, true);
  assert.equal(kqGia.lan2, 'FB_KHONG_NHAN_RIENG_DUOC');
  assert.equal(kqGia.lan2_chu, 'FB_KHONG_NHAN_RIENG_DUOC');
  assert.equal(kqGia.tin_thu_hai, 'NGOAI_CUA_SO_24H', 'Thận trọng: chưa trả lời thì không gửi tin thứ hai');
  assert.equal(kqGia.sau_khi_nhan, 'ok');
  assert.equal(kqGia.the_dai, 'THE_KHONG_HOP_LE');
  assert.deepEqual([kqGia.lua_chon, kqGia.anh, kqGia.tai, kqGia.media], ['ok', 'ok', true, 'ok']);
  assert.deepEqual(kqGia.mau, { trang_thai: 'APPROVED', loai: 'UTILITY' });
  assert.equal(kqGia.mau_moi, 'PENDING');
  assert.equal(kqGia.qua_24h, 'NGOAI_CUA_SO_24H');
  assert.equal(kqGia.utility, 'ok', 'mẫu Utility gửi được ngoài 24 giờ');
  assert.equal(kqGia.ho_so, 'ok');
  assert.deepEqual([kqGia.han_che_truoc, kqGia.han_che_sau], [false, true]);
  assert.equal(kqGia.bi_cam, 'FB_PAGE_BI_CAM_NHAN');
  assert.deepEqual([kqGia.an, kqGia.tra_loi, kqGia.ten], [true, true, 'Lan Nguyễn']);
  // Bản thật gửi đúng đường Graph.
  const duong = new Set(f.goi.map((g) => `${g.phuong} ${g.duong.replace(/\/[\w.]+/, '/X')}`));
  for (const d of ['GET /X/live_videos', 'POST /X/messages', 'POST /X/message_attachments', 'GET /X/page_status', 'POST /X/messenger_profile', 'POST /X/message_templates']) {
    assert.ok(duong.has(d), `bản thật có gọi ${d}`);
  }
});

test('hợp đồng đủ hàm ở cả hai bản; mọi hành vi Meta có nguồn, ngày tra và test', () => {
  const { BAT_BUOC } = require('../server/facebook/giao-dien');
  const { FacebookGia } = require('../server/facebook/gia');
  const { FacebookThat } = require('../server/facebook/that');
  const gia = new FacebookGia();
  const that = new FacebookThat({ layPages: () => [] });
  for (const k of BAT_BUOC) {
    assert.notEqual(gia[k], undefined, `Facebook giả thiếu ${k}`);
    assert.notEqual(that[k], undefined, `Facebook thật thiếu ${k}`);
  }
  const bang = require('../server/facebook/hanh-vi-meta.json');
  const trangThai = ['tai_lieu', 'mau_thuan', 'chua_kiem_chung', 'da_thu_nguoi_thu', 'da_thu_khach_la'];
  assert.equal(bang.hanh_vi.length, 26);
  for (const h of bang.hanh_vi) {
    assert.ok(trangThai.includes(h.trang_thai), `${h.id}: trạng thái lạ`);
    assert.ok(h.nguon.length, `${h.id}: thiếu nguồn`);
    assert.ok(h.test.length, `${h.id}: thiếu test`);
    for (const t of h.test) assert.ok(fs.existsSync(path.join(__dirname, t)), `${h.id}: chưa có tệp test ${t}`);
  }
});
