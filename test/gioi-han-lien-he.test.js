'use strict';

// Giới hạn liên hệ, ngừng liên hệ, ẩn tên (SPEC.md F-66, #96).

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('giới hạn liên hệ: 2 nhắc / đơn, 1 báo hủy, khung 7h–22h dời tới 7h, xin dừng, Page bị hạn chế', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const lienHe = require('../server/nghiep-vu/lien-he');
  const fbPage = require('../server/nghiep-vu/fb-page');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const { hoiThoai: h } = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'P', psid: 'u1', mid: 'm1', noi_dung: 'hi', luc: new Date().toISOString() });
  const n = h.nguoi_fb_id;
  const trua = new Date('2026-09-28T05:00:00Z'); // 12:00 giờ Việt Nam
  assert.deepEqual(lienHe.kiem({ mucDich: 'nhac', nguoiFbId: n, donId: 'dh1', bayGio: trua }), { duoc: true });
  lienHe.ghi({ nguoiFbId: n, donId: 'dh1', loai: 'nhac' });
  lienHe.ghi({ nguoiFbId: n, donId: 'dh1', loai: 'nhac' });
  assert.equal(lienHe.kiem({ mucDich: 'nhac', nguoiFbId: n, donId: 'dh1', bayGio: trua }).ma, 'GIOI_HAN_LIEN_HE', 'lần nhắc thứ 3 bị chặn');
  assert.equal(lienHe.kiem({ mucDich: 'bao_huy', nguoiFbId: n, donId: 'dh1', bayGio: trua }).duoc, true);
  lienHe.ghi({ nguoiFbId: n, donId: 'dh1', loai: 'bao_huy' });
  assert.equal(lienHe.kiem({ mucDich: 'bao_huy', nguoiFbId: n, donId: 'dh1', bayGio: trua }).ma, 'GIOI_HAN_LIEN_HE');
  // 22:30 giờ Việt Nam → dời tới 7:00 hôm sau.
  const khuya = new Date('2026-09-28T15:30:00Z');
  const k = lienHe.kiem({ mucDich: 'nhac', nguoiFbId: n, donId: 'dh2', bayGio: khuya });
  assert.equal(k.ma, 'NGOAI_GIO');
  assert.equal(k.doi_den, '2026-09-29T00:00:00.000Z', '7:00 giờ Việt Nam hôm sau');
  assert.equal(lienHe.kiem({ mucDich: 'nhac', nguoiFbId: n, donId: 'dh2', bayGio: new Date('2026-09-28T22:00:00Z') }).doi_den, '2026-09-29T00:00:00.000Z', '5:00 sáng → 7:00 cùng ngày');
  assert.equal(lienHe.kiem({ mucDich: 'tra_loi', nguoiFbId: n, bayGio: khuya }).duoc, true, 'trả lời tin khách không bị giới hạn');
  assert.equal(lienHe.kiem({ mucDich: 'bao_don', nguoiFbId: n, bayGio: khuya }).duoc, true, 'tin giao dịch không bị khung giờ');
  // Chăm sóc 1 tin / ngày.
  lienHe.ghi({ nguoiFbId: n, loai: 'cham_soc', luc: trua.toISOString() });
  assert.equal(lienHe.kiem({ mucDich: 'cham_soc', nguoiFbId: n, bayGio: new Date('2026-09-28T07:00:00Z') }).ma, 'GIOI_HAN_LIEN_HE');
  // Xin dừng.
  lienHe.datNgung(n);
  assert.equal(lienHe.kiem({ mucDich: 'nhac', nguoiFbId: n, donId: 'dh3', bayGio: trua }).ma, 'NGUNG_LIEN_HE');
  assert.equal(lienHe.duocGoiTen({ nguoiFbId: n, donId: 'dh3' }), false, 'không gọi tên người đã xin dừng');
  assert.equal(lienHe.kiem({ mucDich: 'tra_loi', nguoiFbId: n, bayGio: trua }).duoc, true);
  // Page bị Meta hạn chế.
  const { hoiThoai: h2 } = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'P', psid: 'u2', mid: 'm2', noi_dung: 'hi', luc: new Date().toISOString() });
  fbPage.datBiCam('P', true, 'thử');
  assert.equal(lienHe.kiem({ mucDich: 'nhac', nguoiFbId: h2.nguoi_fb_id, pageId: 'P', donId: 'dh9', bayGio: trua }).ma, 'PAGE_BI_HAN_CHE');
  assert.equal(lienHe.kiem({ mucDich: 'the_dau', nguoiFbId: h2.nguoi_fb_id, pageId: 'P', bayGio: trua }).ma, 'PAGE_BI_HAN_CHE');
  fbPage.datBiCam('P', false);
  assert.equal(lienHe.kiem({ mucDich: 'nhac', nguoiFbId: h2.nguoi_fb_id, pageId: 'P', donId: 'dh9', bayGio: trua }).duoc, true);
});

test('Hộp thư: "thôi shop" → ngừng tin chủ động + câu xác nhận bằng mã, đơn còn chờ có việc gọi; nhắn lại vẫn được trả lời; "ẩn tên giúp em" trên live → không đọc tên', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const lienHe = require('../server/nghiep-vu/lien-he');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const don = require('../server/nghiep-vu/don');
  const kh = require('../server/nghiep-vu/khach');
  const { FacebookGia } = require('../server/facebook/gia');
  const { HopThuTuDong } = require('../server/hop-thu');
  const s = taoSanPhamMau();
  const fb = new FacebookGia();
  let goiAi = 0;
  const nha = { async goi() { goiAi += 1; return { goiCongCu: [], chu: '{}', goc: null, tokenVao: 1, tokenRa: 1 }; } };
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi: () => fb, nhaCungCap: { gemini: nha, openai: nha, anthropic: nha }, gomMs: 10, chuKyMs: 3600000 });
  ht.batDau();
  t.after(() => ht.dung());
  const ev = fb.khachNhan({ ten: 'Lan', noi_dung: 'em lấy áo 12 đen M' });
  await ht.choXong();
  const h = hopThu.danhSach({ dienTap: true })[0];
  don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'tin_nhan', hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, dienTap: true });
  const truoc = goiAi;
  fb.khachNhan({ psid: ev.psid, noi_dung: 'thôi shop' });
  await ht.choXong();
  assert.equal(goiAi, truoc, 'xin dừng xử lý bằng mã, không gọi AI');
  assert.equal(lienHe.daNgung(h.nguoi_fb_id), true);
  assert.match(fb.luongChat('page_gia', ev.psid).at(-1).noi_dung, /không nhắn chủ động cho bạn nữa/);
  assert.ok(kh.danhSachViec({ dienTap: true }).some((v) => v.loai === 'goi_xac_nhan_don' && /xin thôi nhận tin/.test(v.noi_dung)), 'đơn còn chờ → việc gọi cho người');
  fb.khachNhan({ psid: ev.psid, noi_dung: 'thôi shop ơi em lấy size L' });
  await ht.choXong();
  assert.ok(goiAi > truoc, 'câu có món không phải xin dừng: Tư vấn viên trả lời như thường');

  // Ẩn tên trên live.
  const live = require('../server/nghiep-vu/live');
  const { PhongLive } = require('../server/phong-live');
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const dsDirector = [];
  const phong = new PhongLive({ layKetNoi: () => fb, phat: () => {}, ai: { nhanBinhLuan: (b) => dsDirector.push(b.noi_dung), ketThuc() {} } });
  t.after(() => phong.dongLuong());
  const p = live.taoPhien({ kich_ban_id: kb.id });
  fb.batDauLive();
  await phong.quet();
  fb.themBinhLuan({ ten: 'Trần Thu', noi_dung: 'ẩn tên giúp em nha shop' });
  await new Promise((r) => setTimeout(r, 40));
  const bl = live.binhLuanGanDay(p.id, 1)[0];
  assert.ok(bl.nhan.includes('an_ten'));
  const n = hopThu.nguoiCuaBinhLuan(bl, live.layPhien(p.id));
  assert.equal(lienHe.daAnTen(n.id), true);
  assert.equal(lienHe.duocGoiTen({ nguoiFbId: n.id }), false);
  assert.deepEqual(dsDirector, [], 'bình luận xin ẩn tên không cần Director');
});
