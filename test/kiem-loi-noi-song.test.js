'use strict';

/**
 * Kiểm lời Mai trên sóng và tự đính chính (SPEC.md F-105): miệng giả GPT / Gemini (điều khiển từ test) và miệng giả của phần mềm
 * (mieng-gia.js). Câu sai → đủ `live.dinh_chinh`, `mhsp.dinh_chinh`, miệng nhận câu đính chính, tiếng còn lại bị bỏ (GPT); câu đúng
 * → không sự kiện; số cắt giữa hai mẩu không báo nhầm; lặp 60 giây đính chính một lần; câu đính chính vẫn sai / 3 lỗi → "Chỉ gợi ý";
 * tắt hook → không kiểm; miệng giả chỉ ở buổi tập. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const tieng = (n) => { const b = Buffer.alloc(n); for (let i = 0; i + 1 < n; i += 2) b.writeInt16LE(i % 4 ? 3000 : -3000, i); return b; };

function taoMiengGia() {
  const tatCa = [];
  class Gia {
    constructor(o) { Object.assign(this, o); this.goi = []; this.giay = 0; this.token = { vao: {}, ra: {} }; tatCa.push(this); }
    async mo() { this.daMo = true; }
    guiAm() {}
    duaNguCanh(c) { this.goi.push(['nguCanh', c]); }
    hoi(c) { this.goi.push(['hoi', c]); }
    dinhChinh(c) { this.goi.push(['dinhChinh', c]); }
    async dong() { this.daDong = true; }
    cuoi(loai) { return this.goi.filter((x) => x[0] === loai).at(-1)?.[1]; }
  }
  return { nha: { openai: class extends Gia {}, gemini: class extends Gia {}, gia: require('../server/agent/mieng/mieng-gia').MiengGia }, tatCa };
}

async function dung(t, { mieng: model = 'gpt-live-1', dienTap = true, kiemLoiNoi = {} } = {}) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ phi_ship: '20k', mien_phi_tu: '500k' });
  taoSanPhamMau({ gia: '159k', ton: 5 });
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'], ton: 3 });
  const live = require('../server/nghiep-vu/live');
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: dienTap });
  live.ganLive(p.id, 'livegia_x');
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const gia = taoMiengGia();
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');
  const mieng = new MiengCuaMai({ phat, chepLoi: { nhuong() {}, layLai() {} }, nhaMieng: gia.nha,
    kiemLoiNoi: { cho_so_tron_ms: 60, ha_sau_ms: 20, ...kiemLoiNoi } });
  t.after(() => mieng.dong('hết test'));
  const loa = [];
  mieng.datLoa({ readyState: 1, send: (b) => loa.push(b) });
  live.datCheDo(p.id, { che_do_ai: 'noi', mieng: model });
  await mieng.dongBo();
  const ev = (type) => suKien.filter((e) => e.type === type);
  // Câu mới sau một khoảng lặng: có tiếng rồi mới có chữ (như miệng thật) — sau đính chính, máy giữ im tới tiếng câu mới.
  const noi = async (cau) => { await cho(2100); mieng.nhanAm(tieng(4800)); gia.tatCa.at(-1).khiChuRa(cau); await cho(120); };
  return { live, p, mieng, gia, suKien, ev, loa, noi, m: () => gia.tatCa.at(-1) };
}

test('GPT Live 1: câu sai giá → đính chính trong ≤ 3 giây (băng đỏ, Thanh chữ, câu mẫu), tiếng còn lại bị bỏ; câu đúng → không gì cả', async (t) => {
  const x = await dung(t);
  x.m().khiChuRa('Áo số 12 giá 159k nha cả nhà.');
  await cho(80);
  assert.equal(x.ev('live.dinh_chinh').length, 0, 'câu đúng: không sự kiện');
  const t0 = Date.now();
  x.m().khiChuRa('Áo số 12 hôm nay chỉ 150 ');
  x.m().khiChuRa('nghìn thôi cả nhà ơi.');
  await cho(80);
  assert.ok(Date.now() - t0 < 3000);
  assert.equal(x.ev('live.dinh_chinh').length, 1);
  assert.match(x.ev('live.dinh_chinh')[0].chu, /150\.000đ.*áo số 12 giá 159\.000đ/);
  assert.equal(x.ev('mhsp.dinh_chinh')[0].chu, 'Đính chính: Áo số 12 giá 159.000đ');
  assert.equal(x.ev('mhsp.dinh_chinh')[0].giay, 12);
  assert.equal(x.m().cuoi('dinhChinh'), 'Mai xin nói lại cho đúng: áo số 12 giá 159.000đ.');
  assert.ok(x.ev('live.mai_ngat').some((e) => /đính chính/.test(e.ly_do || '')), 'trình duyệt bỏ tiếng đang chờ');
  const truoc = x.loa.length;
  x.mieng.nhanAm(tieng(4800)); // GPT nói nốt câu sai
  assert.equal(x.loa.length, truoc, 'tiếng còn lại của câu sai bị bỏ');
  const l = require('../server/nghiep-vu/loi-noi').danhSach(x.p.id);
  assert.deepEqual([l.length, l[0].loai, l[0].muc, l[0].gia_tri_noi, l[0].gia_tri_dung], [1, 'gia', 'chac', 150000, 159000]);
  assert.ok(l[0].het_khoang_luc > l[0].dinh_chinh_luc, 'nói thấp hơn → mở khoảng nói nhầm (F-106)');
  const hook = require('../server/db/ket-noi').csdl().prepare("SELECT * FROM nhat_ky_hook WHERE hook = 'kiem_loi_noi'").all();
  assert.ok(hook.some((h) => h.quyet_dinh === 'chan' && /Mai nói sai/.test(h.ly_do)));
});

test('Gemini: dinhChinh gửi ngay (không vào hàng chờ #81), không giữ im; số cắt giữa hai mẩu "159." + "000đ" không báo nhầm', async (t) => {
  const x = await dung(t, { mieng: 'gemini-3.8-live' });
  x.m().khiChuRa('áo 12 giá 159.');
  await cho(10);
  x.m().khiChuRa('000đ nha cả nhà.');
  await cho(100);
  assert.equal(x.ev('live.dinh_chinh').length, 0, 'số trọn 159.000đ đúng');
  await cho(2100); // câu mới
  x.m().khiChuRa('phí ship 25 nghìn cả nhà.');
  await cho(80);
  assert.equal(x.m().cuoi('dinhChinh'), 'Mai xin nói lại cho đúng: phí ship 20.000đ.');
  assert.equal(x.mieng.m.chan, undefined, 'Gemini: lượt mới cắt ngang ở máy chủ');
});

test('lặp cùng lỗi trong 60 giây → đính chính 1 lần; câu nghi → băng vàng, không đính chính; tắt hook → không kiểm', async (t) => {
  const x = await dung(t, { kiemLoiNoi: { cua_so_dinh_chinh_ms: 0 } });
  await x.noi('Áo số 12 giá 150k thôi.');
  await x.noi('Áo số 12 giá 150k thôi.');
  assert.equal(x.m().goi.filter((g) => g[0] === 'dinhChinh').length, 1);
  await x.noi('giá 145k thôi cả nhà.');
  assert.equal(x.ev('live.nghi_sai').length, 1);
  assert.equal(x.m().goi.filter((g) => g[0] === 'dinhChinh').length, 1);
  require('../server/agent/hook/cua').datBat('kiem_loi_noi', false);
  await x.noi('Quần 15 giá 99k thôi.');
  assert.equal(x.m().goi.filter((g) => g[0] === 'dinhChinh').length, 1, 'hook tắt: không đính chính');
});

test('câu đính chính vẫn sai → "Chỉ gợi ý" + báo đỏ; 3 lỗi chắc trong buổi → "Chỉ gợi ý"', async (t) => {
  const x = await dung(t);
  await x.noi('Áo số 12 giá 150k thôi.');
  await x.noi('Mai xin nói lại cho đúng: áo số 12 giá 149k.'); // miệng diễn đạt lại vẫn sai
  assert.ok(x.ev('live.dinh_chinh').some((e) => e.muc === 'do'));
  assert.equal(x.live.layPhien(x.p.id).che_do_ai, 'goi_y');
});

test('3 lỗi chắc trong một buổi → hạ về "Chỉ gợi ý"', async (t) => {
  const x = await dung(t, { kiemLoiNoi: { cua_so_dinh_chinh_ms: 0 } });
  for (const cau of ['Áo số 12 giá 150k thôi.', 'Quần 15 giá 300k thôi.', 'phí ship 30k nha.']) {
    await x.noi(cau);
  }
  await cho(100);
  assert.equal(x.m().goi.filter((g) => g[0] === 'dinhChinh').length, 3);
  assert.equal(x.live.layPhien(x.p.id).che_do_ai, 'goi_y');
  assert.ok(x.ev('live.dinh_chinh').some((e) => e.muc === 'do' && /3 lần/.test(e.chu)));
});

test('miệng giả: phiên thật → lỗi rõ; buổi tập → "đọc giúp" nói y nguyên, sai → Mai đính chính đúng câu mẫu', async (t) => {
  await t.test('phiên thật', async (tt) => {
    const { dong } = await moCSDLTam();
    tt.after(dong);
    const live = require('../server/nghiep-vu/live');
    taoSanPhamMau();
    const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
    const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
    assert.throws(() => live.datCheDo(p.id, { che_do_ai: 'noi', mieng: 'mieng-gia' }), (e) => e.ma === 'MIENG_CHI_DIEN_TAP');
  });
  const x = await dung(t, { mieng: 'mieng-gia' });
  const mg = x.mieng.m.ket;
  assert.equal(mg.constructor.name, 'MiengGia');
  x.mieng.hoi({ cauHoi: 'đọc giúp: áo số 12 hôm nay giá 150k thôi cả nhà', tuNguoiDan: true });
  await cho(1500);
  assert.equal(mg.daNoi[0], 'áo số 12 hôm nay giá 150k thôi cả nhà');
  assert.equal(mg.daNoi.at(-1), 'Mai xin nói lại cho đúng: áo số 12 giá 159.000đ.');
  assert.equal(x.ev('mhsp.dinh_chinh').length, 1);
  assert.ok(x.loa.length > 0, 'miệng giả có tiếng (nhỏ) để máy biết Mai đang nói');
});
