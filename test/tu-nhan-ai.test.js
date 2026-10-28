'use strict';

/**
 * F-109 (BH10): Mai tự nhận là trợ lý AI bằng lời — khi bắt đầu buổi và mỗi 15 phút (tua giờ). Mai nói nguyên văn rồi kiểm chữ chép
 * lại có "trợ lý AI"; Đội AI chen câu tự nhận; Chỉ gợi ý / Dừng AI → ô nhắc người dẫn. Miệng giả, đội giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const PHUT = 60 * 1000;

async function dung(t, { cheDo = 'noi', doiAi = false } = {}) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { csdl } = require('../server/db/ket-noi');
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Nhà Mơ' });
  taoSanPhamMau();
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: cheDo });
  csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', doi_ai = ? WHERE id = ?").run(doiAi ? 1 : 0, p.id);
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  return { p, suKien, phat, live };
}

/** Miệng giả: nói nguyên văn (hoặc bỏ chữ "AI" khi `boAi`) và đẩy chữ chép lại qua nhanChuMai như miệng thật. */
function taoMiengGia({ boAi = false } = {}) {
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');
  const m = Object.create(MiengCuaMai.prototype);
  m.ngheChu = new Set();
  m.noi = [];
  m.m = { chan: false };
  m.nhanChuMai = function (chu) { for (const n of [...this.ngheChu]) { n.chu += chu; if (n.kiem.test(n.chu)) n.xong(true); } };
  m.noiNguyenVan = function (cau) { this.noi.push(cau); setImmediate(() => this.nhanChuMai(boAi ? cau.replace(/ AI/g, '') : cau)); };
  return m;
}

test('Mai nói cùng: tự nhận lúc bắt đầu, rồi mỗi 15 phút — buổi 31 phút đúng 3 lần, ghi nhật ký', async (t) => {
  const { p, phat } = await dung(t);
  const mieng = taoMiengGia();
  const { TuNhanAi } = require('../server/tu-nhan-ai');
  const tn = new TuNhanAi({ phat, phongAi: { mieng, miengSanSang: () => true, bao() {} }, choChuMs: 200 });
  const goc = Date.parse('2026-10-28T19:00:00+07:00');
  const kq = [];
  for (let phut = 0; phut <= 31; phut += 1) kq.push(await tn.nhip(p.id, goc + phut * PHUT));
  assert.equal(kq.filter((x) => x === 'mai').length, 3);
  assert.deepEqual(kq.map((x, i) => (x ? i : null)).filter((x) => x !== null), [0, 15, 30]);
  assert.equal(mieng.noi.length, 3);
  assert.ok(mieng.noi.every((c) => /trợ lý AI của Nhà Mơ/.test(c) && !/\{\w+\}/.test(c)));
  assert.equal(new Set(mieng.noi).size, 3, 'xoay vòng biến thể');
  const nk = require('../server/nghiep-vu/nhat-ky-song').doc(p.id).filter((x) => /tự nhận là trợ lý AI/.test(x.noi_dung));
  assert.equal(nk.length, 3);
});

test('Mai không nói chữ "AI" → nhắc lại một lần, vẫn không → ô nhắc người dẫn tự nói', async (t) => {
  const { p, phat, suKien } = await dung(t);
  const mieng = taoMiengGia({ boAi: true });
  const bao = [];
  const { TuNhanAi } = require('../server/tu-nhan-ai');
  const tn = new TuNhanAi({ phat, phongAi: { mieng, miengSanSang: () => true, bao: (c) => bao.push(c) }, choChuMs: 50 });
  assert.equal(await tn.nhip(p.id), 'nhac');
  assert.equal(mieng.noi.length, 2, 'nhắc lại một lần');
  assert.ok(suKien.some((e) => e.type === 'live.nhac_tu_nhan' && /bạn nói giúp/.test(e.ly_do)));
  assert.match(bao[0], /trợ lý AI/);
});

test('Chỉ gợi ý → ô nhắc người dẫn; Dừng AI ở Mai nói cùng → ô nhắc, miệng không nói', async (t) => {
  const { p, phat, suKien } = await dung(t, { cheDo: 'goi_y' });
  const { TuNhanAi } = require('../server/tu-nhan-ai');
  const mieng = taoMiengGia();
  const tn = new TuNhanAi({ phat, phongAi: { mieng, miengSanSang: (x) => x.che_do_ai === 'noi', bao() {} } });
  const goc = Date.now();
  const kq = [];
  for (let phut = 0; phut <= 31; phut += 1) kq.push(await tn.nhip(p.id, goc + phut * PHUT));
  assert.equal(kq.filter((x) => x === 'nhac').length, 3);
  assert.equal(suKien.filter((e) => e.type === 'live.nhac_tu_nhan').length, 3);
  assert.equal(mieng.noi.length, 0);

  const caiDat = require('../server/nghiep-vu/cai-dat');
  caiDat.datDungAi(true, { ma: 'THU' });
  const tn2 = new TuNhanAi({ phat, phongAi: { mieng, miengSanSang: () => true, bao() {} } });
  assert.equal(await tn2.nhip(p.id), 'nhac');
  assert.equal(mieng.noi.length, 0);
  caiDat.datDungAi(false);
});

test('Đội AI dẫn: chen câu tự nhận mỗi 15 phút; đội vừa nói câu "trợ lý AI" (người mới vào) thì không chen thêm', async (t) => {
  const { p, phat } = await dung(t, { cheDo: 'goi_y', doiAi: true });
  const chen = [];
  let lucTuNhan = null;
  const doiAi = { chenBanHang: (id, khoa) => { chen.push(khoa); return true; }, lucTuNhan: () => lucTuNhan };
  const { TuNhanAi } = require('../server/tu-nhan-ai');
  const tn = new TuNhanAi({ phat, phongAi: { doiAi, miengSanSang: () => false, bao() {} } });
  const goc = Date.now();
  const kq = [];
  for (let phut = 0; phut <= 31; phut += 1) {
    if (phut === 14) lucTuNhan = goc + 14 * PHUT; // vòng mới: "Cả nhà mới vào ơi, tụi mình là đội trợ lý AI…"
    kq.push(await tn.nhip(p.id, goc + phut * PHUT));
  }
  assert.deepEqual(kq.map((x, i) => (x ? i : null)).filter((x) => x !== null), [0, 29]);
  assert.deepEqual(chen, ['tu_nhan_ai', 'tu_nhan_ai']);
  const cau = require('../server/cau-hinh/doi-ai-cau-mau.json').tu_nhan_ai;
  assert.ok(cau.length >= 3 && cau.every((l) => l.some(([, loi]) => /trợ lý AI/.test(loi))));
});

test('Đội AI chưa bắt đầu đọc (chưa mở Màn hình người dẫn) → chờ; đội đọc đoạn mở màn có "trợ lý AI" → không chen; quá 3 phút vẫn chưa dẫn → nhắc', async (t) => {
  const { p, phat, suKien } = await dung(t, { cheDo: 'goi_y', doiAi: true });
  let dan = false;
  let lucTuNhan = null;
  const doiAi = { chenBanHang: () => true, lucTuNhan: () => lucTuNhan, dangDan: () => dan };
  const { TuNhanAi } = require('../server/tu-nhan-ai');
  const tn = new TuNhanAi({ phat, phongAi: { doiAi, miengSanSang: () => false, bao() {} } });
  const goc = Date.now();
  assert.equal(await tn.nhip(p.id, goc), null);
  assert.equal(await tn.nhip(p.id, goc + 2 * PHUT), null);
  dan = true;
  lucTuNhan = goc + 2 * PHUT + 1000; // đoạn mở màn: "Em là Mai, trợ lý AI của Moza Shop"
  assert.equal(await tn.nhip(p.id, goc + 3 * PHUT), null);
  assert.equal(await tn.nhip(p.id, goc + 18 * PHUT), 'doi_ai');
  // Phiên khác: đội không bao giờ dẫn → phút thứ 3 nhắc người dẫn.
  const tn2 = new TuNhanAi({ phat, phongAi: { doiAi: { ...doiAi, dangDan: () => false, lucTuNhan: () => null }, miengSanSang: () => false, bao() {} } });
  assert.equal(await tn2.nhip(p.id, goc), null);
  assert.equal(await tn2.nhip(p.id, goc + 3 * PHUT), 'nhac');
  assert.ok(suKien.some((e) => e.type === 'live.nhac_tu_nhan'));
});

test('Mai nói cùng mà miệng đang mở → chờ; miệng sẵn sàng → Mai tự nói (không nhắc thừa lúc mở buổi)', async (t) => {
  const { p, phat, suKien } = await dung(t);
  const mieng = taoMiengGia();
  let san = false;
  const { TuNhanAi } = require('../server/tu-nhan-ai');
  const tn = new TuNhanAi({ phat, phongAi: { mieng, miengSanSang: () => san, bao() {} }, choChuMs: 200 });
  const goc = Date.now();
  assert.equal(await tn.nhip(p.id, goc), null);
  san = true;
  assert.equal(await tn.nhip(p.id, goc + PHUT), 'mai');
  assert.ok(!suKien.some((e) => e.type === 'live.nhac_tu_nhan'));
});

test('câu mẫu tu_nhan_ai_song: 5 biến thể, câu nào cũng có "trợ lý AI"', () => {
  const ds = require('../server/cau-hinh/cau-mau-khach.json').tu_nhan_ai_song;
  assert.equal(ds.length, 5);
  assert.ok(ds.every((c) => /trợ lý AI của \{ten_shop\}/.test(c)));
});
