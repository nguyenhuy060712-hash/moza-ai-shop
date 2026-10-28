'use strict';

/**
 * Lịch live cố định + bộ bài báo trước (SPEC.md F-96, #117). Đồng hồ giả, AI giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const vn = (s) => new Date(`${s}+07:00`).getTime(); // "2026-10-01T21:00:00" giờ Việt Nam

test('T3, T5 lúc 20:00: buổi kế đúng giờ Việt Nam, qua nửa đêm và qua Chủ nhật; dời / hủy một buổi thì buổi kế đổi; khớp live ±60 phút; dòng cho AI', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const ll = require('../server/nghiep-vu/lich-live');
  assert.equal(ll.buoiKe(vn('2026-10-01T10:00:00')), null, 'chưa có lịch');
  assert.equal(ll.dongLich(), null);
  ll.datLich({ buoi: [{ thu: 2, gio: '20:00' }, { thu: 4, gio: '20:00' }] });
  // 1/10/2026 là thứ Năm.
  assert.equal(ll.buoiKe(vn('2026-10-01T10:00:00')).chu, '20:00 thứ Năm 1/10');
  assert.equal(ll.buoiKe(vn('2026-10-01T20:30:00')).chu, '20:00 thứ Ba 6/10', 'qua buổi tối thứ Năm → thứ Ba tuần sau (qua Chủ nhật)');
  assert.equal(ll.buoiKe(vn('2026-10-01T23:59:00')).chu, '20:00 thứ Ba 6/10', 'gần nửa đêm vẫn đúng giờ VN');
  assert.equal(new Date(ll.buoiKe(vn('2026-10-02T00:30:00')).luc).toISOString(), '2026-10-06T13:00:00.000Z', 'sau nửa đêm (UTC còn ngày 1/10)');
  // Dời thứ Ba 6/10 sang 21:00; hủy thứ Năm 8/10.
  ll.doiBuoi({ ngay: '2026-10-06', gio_moi: '21:00' });
  ll.doiBuoi({ ngay: '2026-10-08', huy: true });
  assert.equal(ll.buoiKe(vn('2026-10-02T09:00:00')).chu, '21:00 thứ Ba 6/10');
  assert.equal(ll.buoiKe(vn('2026-10-06T22:00:00')).chu, '20:00 thứ Ba 13/10', 'thứ Năm 8/10 đã hủy');
  assert.throws(() => ll.doiBuoi({ ngay: '2026-10-07', huy: true }), /không có buổi live/);
  assert.throws(() => ll.datLich({ buoi: [{ thu: 2, gio: '20:15' }] }), /chọn từ danh sách/);
  // Khớp live ±60 phút.
  assert.equal(ll.khopBuoi(new Date(vn('2026-10-06T21:40:00')).toISOString())?.ngay, '2026-10-06');
  assert.equal(ll.khopBuoi(new Date(vn('2026-10-06T22:30:00')).toISOString()), null);
  assert.match(ll.dongLich(vn('2026-10-02T09:00:00')), /^Lịch live: 20:00 thứ Ba, thứ Năm hằng tuần; buổi kế 21:00 thứ Ba 6\/10$/);
  // Tư vấn viên trả lời "khi nào shop live" trích dòng Lịch live → Bộ kiểm tra đạt.
  const { kiemTraCau, dongCaiDat } = require('../server/agent/kiem-tra/kiem-tra');
  const dongLich = dongCaiDat().find((x) => x.startsWith('Lịch live'));
  assert.ok(dongLich);
  assert.ok(kiemTraCau({ cau: 'Dạ shop live 20:00 thứ Ba, thứ Năm hằng tuần ạ', trich_dan: [{ nguon: 'cai_dat', doan: '20:00 thứ Ba, thứ Năm hằng tuần' }], kenh: 'messenger' }).dat);
});

function nhaGia(kichBan) {
  let i = 0;
  const goi = async () => { const b = kichBan[Math.min(i, kichBan.length - 1)]; i += 1; return { goiCongCu: [], goc: null, tokenVao: 300, tokenRa: 200, chu: JSON.stringify(b) }; };
  return { openai: { goi }, gemini: { goi }, anthropic: { goi }, dem: () => i };
}

test('AI soạn bài: điền {lich} {so_mon} {cu_phap}; chữ của ô "AI đoán", "giảm 50%", "chỉ hôm nay", "còn 3 chiếc" bị trả lại, bản cuối không có; phần vẫn sai thì bỏ + "Kiểm lại"', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Moza Shop' });
  require('../server/nghiep-vu/lich-live').datLich({ buoi: [0, 1, 2, 3, 4, 5, 6].map((thu) => ({ thu, gio: '23:30' })) });
  const sp = require('../server/nghiep-vu/san-pham');
  const mau = taoSanPhamMau({ gia: '289k', ten: 'Sơ mi tay ngắn' }); // tên không có "linen": chữ đó chỉ ở ô AI đoán
  // Chất liệu thành "AI đoán" (chưa xác nhận).
  sp.suaSanPham(mau.san_pham.id, { thong_so: { doi_tuong: 'nu', chat_lieu: ['linen'], kieu_dang: 'suong' }, ai_doan: ['thong_so.chat_lieu'] });
  const { soanBai } = require('../server/agent/agents/soan-bai');
  const tot = { su_kien: { tieu_de: 'Live đồ đi làm {so_mon} món', mo_ta: '{lich} Moza Shop lên áo số 12 sơ mi tay ngắn giá 289.000đ.' },
    bai_nha_hang: '{lich} live {so_mon} món. Áo số 12 giá 289.000đ, form suông. Cả nhà bình luận món muốn xem kèm size, tối live bình luận {cu_phap}.',
    reels: ['Áo số 12 form suông cho ngày đi làm', 'Sơ mi tay ngắn mặc đi chơi', 'Hẹn {lich}'] };
  const sai = { ...tot, bai_nha_hang: 'Áo số 12 vải linen giảm 50% chỉ hôm nay, còn 3 chiếc!', reels: ['Sale sốc', 'Áo 12 linen mát', 'Hẹn {lich}'] };
  const nha = nhaGia([sai, { ...tot, reels: ['Sale sốc', 'Áo số 12 form suông cho ngày đi làm', 'Hẹn {lich}'] }]);
  const kq = await soanBai({ nhaCungCap: nha });
  assert.equal(nha.dem(), 2, 'sai → làm lại đúng 1 lần');
  assert.match(kq.bai_nha_hang, /^\d{2}:\d{2} (thứ|Chủ)/, '{lich} được điền');
  assert.match(kq.bai_nha_hang, /live 1 món/);
  assert.match(kq.bai_nha_hang, /chốt 12 \+ màu \+ size/);
  assert.match(kq.su_kien.mo_ta, /Buổi live có sử dụng trợ lý AI của Moza Shop\./);
  assert.doesNotMatch(JSON.stringify([kq.su_kien, kq.bai_nha_hang, kq.reels]), /linen|giảm|chỉ hôm nay|còn 3/i);
  const sb = require('../server/agent/agents/soan-bai');
  assert.ok(sb.loiPhan('Áo số 12 vải linen mát', 'bài', { nguon: 'Giá: 289.000đ', doan: sb.nguonMon(sp.laySanPham(mau.san_pham.id)).doan }).some((x) => /AI đoán/.test(x)), 'chữ của ô AI đoán bị bắt');
  assert.equal(kq.reels.length, 2, 'câu "Sale sốc" vẫn sai → bỏ');
  assert.ok(kq.kiem_lai.some((x) => /reels 1/.test(x)), JSON.stringify(kq.kiem_lai));
  // Giá sai (không có trong thẻ) cũng bị bắt.
  const { loiPhan } = require('../server/agent/agents/soan-bai');
  assert.ok(loiPhan('Áo số 12 chỉ 199.000đ', 'bài', { nguon: 'Giá: 289.000đ', doan: [] }).some((x) => /199\.000/.test(x)));
  assert.ok(loiPhan('Freeship toàn quốc', 'bài', { nguon: '', doan: [] }).some((x) => /miễn ship/.test(x)));
});

test('API: lịch, dời buổi có bài báo dời; lời mời + link: chưa live → link Page + giờ buổi kế', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api', require('../server/api/truoc-live'));
  app.use((e, req, res, next) => res.status(e.http || 500).json({ loi: { ma: e.ma, thong_diep: e.message } })); // eslint-disable-line no-unused-vars
  const sv = app.listen(0);
  t.after(() => sv.close());
  const goc = `http://127.0.0.1:${sv.address().port}/api`;
  const goi = async (m, u, b) => (await fetch(goc + u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Moza Shop' });
  const r = await goi('PUT', '/lich-live', { buoi: [{ thu: 4, gio: '20:00' }] });
  assert.equal(r.lich.buoi.length, 1);
  assert.ok(r.buoi_ke);
  const d = await goi('POST', '/lich-live/doi-buoi', { ngay: r.buoi_ke.ngay, gio_moi: '21:00' });
  assert.match(d.bai, /dời sang 21:00 thứ Năm/);
  const loiMoi = await goi('GET', '/lich-live/loi-moi');
  assert.equal(loiMoi.dang_live, false);
  assert.match(loiMoi.chu, /21:00 thứ Năm .*Moza Shop live/);
});
