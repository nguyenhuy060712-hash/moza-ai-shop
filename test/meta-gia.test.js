'use strict';

// Meta giả và bộ dựng thẻ (SPEC.md F-15 mở rộng, #92; docs/07 H01–H20): luật của Facebook / Messenger, đồng hồ và tua.

const test = require('node:test');
const assert = require('node:assert/strict');

test('bộ dựng thẻ: đúng dạng Send API, chặn thẻ quá giới hạn (không cắt chữ âm thầm)', () => {
  const { dungTin, docTin, kiemThe, chuCuaThe, nutCuaThe } = require('../server/facebook/dung-tin');
  const nut = [{ tieu_de: 'Giữ, lên đơn', payload: 'GIU|x' }, { tieu_de: 'Đổi', payload: 'DOI|x' }, { tieu_de: 'Không lấy', payload: 'KL|x' }];
  const anh = { kieu: 'anh', tieu_de: 'Áo 12 Đen/M · 159.000đ', phu_de: 'Giữ tới hết live + 2 giờ', anh: { url: 'https://x.test/a.jpg' }, nut };
  const m = dungTin(anh);
  assert.equal(m.attachment.payload.template_type, 'generic');
  assert.equal(m.attachment.payload.elements[0].image_url, 'https://x.test/a.jpg');
  assert.equal(m.attachment.payload.elements[0].buttons.length, 3);
  assert.deepEqual(docTin(m), anh, 'đọc ngược ra đúng thẻ');
  assert.match(chuCuaThe(anh), /\[Nút: Giữ, lên đơn \| Đổi \| Không lấy\]/);
  const luoi = { kieu: 'luoi', o: ['Đen', 'Trắng', 'Be'].map((x) => ({ tieu_de: x, anh: { url: `https://x.test/${x}.jpg` }, payload: `CHON|${x}` })) };
  assert.equal(dungTin(luoi).attachment.payload.elements.length, 3);
  assert.deepEqual(docTin(dungTin(luoi)), luoi);
  assert.equal(nutCuaThe(luoi).length, 3);
  const chu = { kieu: 'chu', chu: 'Chọn size nha', tra_loi_nhanh: [{ tieu_de: 'M', payload: 'PL|m' }, { kieu: 'so_dien_thoai' }] };
  assert.deepEqual(dungTin(chu).quick_replies, [{ content_type: 'text', title: 'M', payload: 'PL|m' }, { content_type: 'user_phone_number' }]);
  // Giới hạn.
  assert.match(kiemThe({ ...anh, nut: [...nut, nut[0]] }).join(), /tối đa 3 nút/);
  assert.match(kiemThe({ ...anh, tieu_de: 'x'.repeat(81) }).join(), /tiêu đề thẻ ảnh dài quá 80/);
  assert.match(kiemThe({ ...anh, phu_de: 'x'.repeat(81) }).join(), /phụ đề/);
  assert.match(kiemThe({ kieu: 'nut', chu: 'x'.repeat(641), nut }).join(), /quá 640/);
  assert.match(kiemThe({ kieu: 'nut', chu: 'a', nut: [{ tieu_de: 'x'.repeat(21), payload: 'p' }] }).join(), /dài quá 20/);
  assert.match(kiemThe({ kieu: 'luoi', o: luoi.o.slice(0, 1) }).join(), /2–6 ô/);
  assert.match(kiemThe({ kieu: 'chu', chu: 'a', tra_loi_nhanh: Array.from({ length: 14 }, (_, i) => ({ tieu_de: `${i}`, payload: `p${i}` })) }).join(), /tối đa 13/);
  assert.match(kiemThe({ kieu: 'nut', chu: 'a', nut: [{ tieu_de: 'x', payload: 'p'.repeat(1001) }] }).join(), /payload/);
  assert.match(kiemThe({ kieu: 'media', anh: { url: 'https://x.test/a.jpg' } }).join(), /attachment_id/, 'media template chỉ nhận ảnh đã tải lên');
  assert.throws(() => dungTin({ kieu: 'nut', chu: 'x'.repeat(700), nut }), (e) => e.ma === 'THE_KHONG_HOP_LE');
  assert.deepEqual(dungTin({ kieu: 'nut', chu: 'Gọi shop', nut: [{ kieu: 'goi', tieu_de: '📞 Gọi shop', so: '+84912345678' }] }).attachment.payload.buttons[0],
    { type: 'phone_number', title: '📞 Gọi shop', payload: '+84912345678' }, 'H20 nút gọi');
});

test('Meta giả: luật nhắn riêng, 24 giờ, Tin nhắn chờ, chặn Page, Page bị cấm, ứng dụng chưa duyệt (H01–H03, H07, H08, H15, H16)', () => {
  const { MetaGia, LoiMeta } = require('../server/facebook/meta-gia');
  const { dungTin } = require('../server/facebook/dung-tin');
  const meta = new MetaGia({ pages: [{ id: 'P', ten: 'Shop' }] });
  const loi = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof LoiMeta, e.message); return `${e.error.code}/${e.error.error_subcode || ''}`; } return 'ok'; };
  const tin = (chu) => dungTin({ kieu: 'chu', chu });
  const l = meta.batDauLive('P', 'Live');
  assert.ok(l.video_id && l.video_id !== l.id, 'id video khác id live (H09)');
  assert.ok(Date.now() - l.tao_ms >= 10000, 'giờ Facebook sớm hơn lúc thấy (H10)');
  const b = meta.binhLuanLive({ liveId: l.id, ten: 'Lan', noiDung: 'chốt 12 đen M' });
  assert.equal(meta.xemBinhLuan(b.id).can_reply_privately, true);
  const r = meta.gui('P', { recipient: { comment_id: b.id }, message: tin('Shop giữ hàng rồi nè') });
  assert.equal(r.recipient_id, meta.psidCua('P', 'Lan'), 'nhắn riêng trả PSID của người bình luận');
  assert.equal(loi(() => meta.gui('P', { recipient: { comment_id: b.id }, message: tin('lần 2') })), '100/2534025', 'H01: chỉ 1 tin mỗi bình luận');
  assert.equal(meta.xemBinhLuan(b.id).can_reply_privately, false);
  assert.equal(loi(() => meta.gui('P', { recipient: { id: r.recipient_id }, messaging_type: 'RESPONSE', message: tin('tin 2') })), '10/2018278',
    'H02: tin thứ hai trước khi khách trả lời bị chặn (Thận trọng)');
  meta.nhan({ pageId: 'P', ten: 'Lan', noiDung: 'dạ em lấy' });
  assert.equal(loi(() => meta.gui('P', { recipient: { id: r.recipient_id }, messaging_type: 'RESPONSE', message: tin('cảm ơn') })), 'ok', 'khách nhắn → cửa sổ mở');
  meta.tua(25 * 3600e3);
  assert.equal(loi(() => meta.gui('P', { recipient: { id: r.recipient_id }, message: tin('muộn') })), '10/2018278', 'H03: quá 24 giờ');
  // 7 ngày.
  const b2 = meta.binhLuanLive({ liveId: l.id, ten: 'Hoa', noiDung: 'chốt 12' });
  meta.tua(8 * 86400e3);
  assert.equal(loi(() => meta.gui('P', { recipient: { comment_id: b2.id }, message: tin('x') })), '100/2534025', 'quá 7 ngày');
  // Tin nhắn chờ: tỷ lệ 50% theo hạt giống — người mới có hộp cố định, chạy lại ra cùng kết quả.
  const hop = [];
  for (let i = 0; i < 20; i += 1) {
    const x = meta.binhLuanLive({ liveId: l.id, ten: `Khách ${i}`, noiDung: 'chốt' });
    meta.gui('P', { recipient: { comment_id: x.id }, message: tin('hi') });
    hop.push(meta.tinhTrang('P', meta.psidCua('P', `Khách ${i}`)).hop);
  }
  assert.ok(hop.includes('cho') && hop.includes('chinh'), 'có người ở Tin nhắn chờ, có người hộp chính (H07)');
  const psCho = meta.psidCua('P', `Khách ${hop.indexOf('cho')}`);
  meta.moTinCho('P', psCho);
  assert.equal(meta.tinhTrang('P', psCho).hop, 'chinh');
  // Chặn Page, Page bị cấm, ứng dụng chưa duyệt.
  meta.nhan({ pageId: 'P', ten: 'Minh', noiDung: 'hi' });
  meta.nguoi.get(`P|${meta.psidCua('P', 'Minh')}`).chan = true;
  assert.equal(loi(() => meta.gui('P', { recipient: { id: meta.psidCua('P', 'Minh') }, message: tin('x') })), '551/1545041', 'H08');
  meta.nhan({ pageId: 'P', ten: 'Nga', noiDung: 'hi' });
  meta.datCamNhan('P', true);
  assert.equal(loi(() => meta.gui('P', { recipient: { id: meta.psidCua('P', 'Nga') }, message: tin('x') })), '10/1893063', 'H15');
  assert.equal(meta.trangThaiPage('P').restrictions[0].status, 'RESTRICTED');
  meta.datCamNhan('P', false);
  meta.pages.get('P').chuaDuyet = true;
  assert.equal(loi(() => meta.gui('P', { recipient: { id: meta.psidCua('P', 'Nga') }, message: tin('x') })), '10/2018028', 'H16');
  meta.datNguoiThu('P', meta.psidCua('P', 'Nga'));
  assert.equal(loi(() => meta.gui('P', { recipient: { id: meta.psidCua('P', 'Nga') }, message: tin('x') })), 'ok', 'người thử vẫn nhận');
  // Thẻ sai giới hạn bị Meta từ chối (L2).
  meta.pages.get('P').chuaDuyet = false;
  assert.equal(loi(() => meta.gui('P', { recipient: { id: meta.psidCua('P', 'Nga') }, message: { text: 'x'.repeat(2001) } })), '100/');
});

test('Meta giả: webhook thô qua su-kien.tuWebhook — nhắn, bấm nút, trả lời nhanh, m.me ref hai kiểu (H04, H05, H19)', () => {
  const { MetaGia } = require('../server/facebook/meta-gia');
  const { tuWebhook } = require('../server/facebook/su-kien');
  const meta = new MetaGia({ pages: [{ id: 'P', ten: 'Shop' }] });
  const ev = [];
  meta.on('webhook', (b) => ev.push(...tuWebhook(b)));
  meta.nhan({ pageId: 'P', ten: 'Lan', noiDung: 'chào shop' });
  assert.equal(ev[0].loai, 'tin_nhan');
  assert.equal(ev[0].ten, undefined, 'webhook Messenger không mang tên (L1)');
  const psid = ev[0].psid;
  meta.bam({ pageId: 'P', psid, payload: 'GIU|dh_1', tieuDe: 'Giữ, lên đơn' });
  assert.deepEqual([ev[1].loai, ev[1].payload], ['postback', 'GIU|dh_1']);
  meta.nhan({ pageId: 'P', psid, noiDung: 'M', quickReply: 'PL|pl_1' });
  assert.deepEqual([ev[2].loai, ev[2].payload, ev[2].nguon_nut, ev[2].noi_dung], ['postback', 'PL|pl_1', 'tra_loi_nhanh', 'M'], 'trả lời nhanh coi như nút');
  meta.datHoSo('P', { get_started: { payload: 'BAT_DAU' } });
  const moi = meta.moLinkMme({ pageId: 'P', ten: 'Hoa', ref: 'phien_pl1' });
  assert.equal(moi.nguoiMoi, true);
  assert.deepEqual([ev[3].loai, ev[3].payload, ev[3].ref], ['postback', 'BAT_DAU', 'phien_pl1'], 'người mới: postback kèm referral');
  const cu = meta.moLinkMme({ pageId: 'P', ten: 'Lan', ref: 'phien_pl1' });
  assert.equal(cu.nguoiMoi, false);
  assert.deepEqual([ev[4].loai, ev[4].ref], ['gioi_thieu', 'phien_pl1'], 'người cũ: messaging_referrals');
  assert.equal(meta.moLinkMme({ pageId: 'P', ten: 'Lan', ref: 'x', matRef: true }).body, null, 'máy Android mất ref');
  // Page tự bình luận / ẩn danh; hai đường.
  const l = meta.batDauLive('P', 'Live');
  const truoc = ev.length;
  meta.binhLuanLive({ liveId: l.id, ten: 'Shop', noiDung: 'Chốt: số + màu + size, ví dụ chốt 12 đen M', laPage: true });
  assert.equal(ev.length, truoc, 'webhook bài đăng bỏ bình luận của chính Page');
  meta.binhLuanLive({ liveId: l.id, ten: 'Tú', noiDung: 'chốt 12 đen M' });
  assert.equal(ev.at(-1).loai, 'binh_luan_bai');
  assert.equal(ev.at(-1).post_id, `P_${l.video_id}`, 'bình luận live cũng về webhook bài đăng, post_id = page_videoId (H09)');
});

test('Meta giả: mẫu Utility, menu, tải ảnh, Page Integrity (H06, H15, H17, H18)', () => {
  const { MetaGia, LoiMeta } = require('../server/facebook/meta-gia');
  const meta = new MetaGia({ pages: [{ id: 'P', ten: 'Shop' }] });
  const loi = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof LoiMeta); return e.error.code; } return 'ok'; };
  const m = meta.taoMau('P', { name: 'moza_x', category: 'UTILITY', components: [{ type: 'BODY', text: 'Đơn {{1}} đã gửi' },
    { type: 'BUTTONS', buttons: [{ type: 'POSTBACK', text: 'Xác nhận', payload: 'MAU_XAC_NHAN' }] }] });
  assert.equal(m.status, 'PENDING');
  meta.nhan({ pageId: 'P', ten: 'Lan', noiDung: 'hi' });
  const psid = meta.psidCua('P', 'Lan');
  const guiMau = () => meta.gui('P', { recipient: { id: psid }, messaging_type: 'UTILITY', message: { template: { name: 'moza_x', language: { code: 'vi' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'DH-1' }] }] } } });
  assert.equal(loi(guiMau), 100, 'chưa duyệt thì không gửi');
  meta.tua(4000);
  assert.equal(meta.docMau('P', 'moza_x')[0].status, 'APPROVED', 'duyệt sau vài giây');
  meta.tua(30 * 3600e3);
  assert.equal(loi(guiMau), 'ok', 'mẫu gửi được cả ngoài 24 giờ');
  const cuoi = meta.luongChat('P', psid).at(-1);
  assert.equal(cuoi.noi_dung, 'Đơn DH-1 đã gửi\n[Nút: Xác nhận]');
  meta.taoMau('P', { name: 'moza_mkt', category: 'UTILITY', components: [{ type: 'BODY', text: 'Sale 50%' }] }, { xepMarketing: true });
  meta.tua(4000);
  assert.deepEqual([meta.docMau('P', 'moza_mkt')[0].status, meta.docMau('P', 'moza_mkt')[0].category], ['REJECTED', 'MARKETING']);
  meta.pages.get('P').quyen.delete('page_utility_messaging');
  assert.equal(loi(guiMau), 10, 'thiếu quyền page_utility_messaging');
  assert.equal(loi(() => meta.datHoSo('P', { persistent_menu: [{ locale: 'default', call_to_actions: [{ type: 'postback', title: 'Đơn', payload: 'DON' }] }] })), 100, 'menu cần nút Bắt đầu');
  assert.equal(loi(() => meta.datHoSo('P', { get_started: { payload: 'BAT_DAU' }, persistent_menu: [{ locale: 'default', call_to_actions: [{ type: 'phone_number', title: 'Gọi', payload: '+84' }] }] })), 100, 'menu không nhận nút gọi');
  assert.equal(loi(() => meta.datHoSo('P', { get_started: { payload: 'BAT_DAU' }, persistent_menu: [{ locale: 'default', call_to_actions: [{ type: 'postback', title: 'Đơn', payload: 'DON' }] }] })), 'ok');
  const a = meta.taiLen('P', { tep: 'ao.jpg' });
  assert.ok(a.attachment_id);
  assert.equal(meta.trangThaiPage('P').status, 'ok');
});
