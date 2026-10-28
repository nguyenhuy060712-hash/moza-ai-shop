'use strict';

/**
 * Mai làm việc trong lúc nói — GPT-Live + Decisions (SPEC.md F-112), sau cờ tắt. Miệng giả mô phỏng `decision.event`: câu "giờ mình xem
 * quần số 15" → thẻ đổi ≤ 1 giây; lựa chọn ngoài danh sách / tin cậy thấp → bỏ; kết quả cũ đến muộn → bỏ; Chỉ gợi ý → không tự chuyển;
 * mời xem bảng size → chiếu bảng size. GPT-Live gửi đúng `session.triggers`. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

async function dung(t, { bat = true } = {}) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');
  const { MiengGia } = require('../server/agent/mieng/mieng-gia');
  taoSanPhamMau();
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'] });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh(); // [mở đầu, áo 12, quần 15, kết thúc]
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'noi', dien_tap: true });
  const giaModel = caiDat.MAC_DINH.mieng.find((x) => x.nha === 'gia').model;
  csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ?, mieng = ? WHERE id = ?").run(new Date().toISOString(), giaModel, p.id);
  live.doiDoan(p.id, 1); // đang nói áo 12
  const tatCa = [];
  class Gia extends MiengGia { constructor(o) { super({ ...o, nhipMs: 20 }); tatCa.push(this); } }
  const suKien = [];
  const mieng = new MiengCuaMai({ phat: (type, d) => suKien.push({ type, ...d }), chepLoi: { nhuong() {}, layLai() {} }, nhaMieng: { gia: Gia }, quyetDinhMai: { bat } });
  t.after(() => mieng.dong());
  await mieng.dongBo();
  return { live, csdl, mieng, p, tatCa, suKien, ket: tatCa[0] };
}

test('cờ bật: miệng nhận câu hỏi Decisions (món của kịch bản + khong_doi, mời xem size); Mai nói "quần số 15" → thẻ đổi ≤ 1 giây', async (t) => {
  const x = await dung(t);
  const q = x.ket.cauHoiQuyetDinh;
  assert.deepEqual(q.map((c) => c.ten), ['mon_dang_noi', 'moi_xem_size']);
  assert.deepEqual(q[0].luaChon.map((c) => c.gt), ['so_12', 'so_15', 'khong_doi']);
  const bd = Date.now();
  x.ket.noi('Giờ mình xem quần số 15 nha cả nhà, jean ống suông tôn dáng lắm.');
  for (let i = 0; i < 50 && x.live.layPhien(x.p.id).doan_hien_tai !== 2; i++) await cho(20);
  assert.equal(x.live.layPhien(x.p.id).doan_hien_tai, 2);
  assert.ok(Date.now() - bd <= 1000, 'thẻ đổi ≤ 1 giây');
  assert.ok(x.suKien.some((e) => e.type === 'live.doan' && e.doan === 2 && e.boi === 'mai_quyet_dinh'));
  assert.equal(x.mieng.m.doan, 2, 'không đưa lại câu kịch bản của đoạn Mai tự sang');
});

test('lựa chọn ngoài danh sách / khong_doi / tin cậy thấp / kết quả cũ đến muộn → bỏ; cần 2 lần liền; Chỉ gợi ý → không tự chuyển; bảng size ≥ 0,85, 1 lần / 30 giây', async (t) => {
  const x = await dung(t);
  const id = x.p.id;
  assert.deepEqual(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'so_99', tinCay: 0.99 } }, thuTu: 1 }), {});
  assert.deepEqual(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'khong_doi', tinCay: 0.99 } }, thuTu: 2 }), {});
  assert.deepEqual(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'so_15', tinCay: 0.6 } }, thuTu: 3 }), {});
  assert.equal(x.live.layPhien(id).doan_hien_tai, 1);
  assert.equal(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'so_15', tinCay: 0.9 } }, thuTu: 2 }), null, 'kết quả cũ đến muộn');
  assert.equal(x.live.layPhien(id).doan_hien_tai, 1);
  assert.deepEqual(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'so_15', tinCay: 0.9 } }, thuTu: 4 }), {}, 'mới 1 lần');
  assert.deepEqual(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'so_15', tinCay: 0.95 } }, thuTu: 5 }), { doan: 2 });
  assert.equal(x.mieng.nhanQuyetDinh(id, { traLoi: { moi_xem_size: { chon: true, tinCay: 0.83 } }, thuTu: 6 }).chieu, undefined, 'dưới 0,85');
  x.csdl().prepare("UPDATE phien_live SET che_do_ai = 'goi_y' WHERE id = ?").run(id);
  assert.equal(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'so_12', tinCay: 0.99 } }, thuTu: 7 }), null);
  assert.equal(x.mieng.nhanQuyetDinh(id, { traLoi: { mon_dang_noi: { chon: 'so_12', tinCay: 0.99 } }, thuTu: 8 }), null);
  assert.equal(x.live.layPhien(id).doan_hien_tai, 2);
});

test('cờ tắt: miệng không nhận câu hỏi Decisions — chỉ còn cách đọc chữ cũ', async (t) => {
  const x = await dung(t, { bat: false });
  assert.equal(x.ket.cauHoiQuyetDinh, null);
});

test('GPT-Live: session.start có triggers loại decisions trên session.output_transcript.delta, vẫn delegation client; decision.event → khiQuyetDinh', () => {
  const { MiengGptLive } = require('../server/agent/mieng/gpt-live');
  const nhan = [];
  const m = new MiengGptLive({ loiDan: 'x', khiAm() {}, khiChuRa() {}, khiChuVao() {}, khiDong() {},
    cauHoiQuyetDinh: [{ ten: 'mon_dang_noi', loai: 'choice', chiDan: 'Món nào?', luaChon: [{ gt: 'so_15' }, { gt: 'khong_doi' }] }],
    khiQuyetDinh: (q) => nhan.push(q) });
  const tr = m.phanTriggers();
  assert.deepEqual(tr.triggers[0].type, 'decisions');
  assert.equal(tr.triggers[0].event_type, 'session.output_transcript.delta');
  assert.deepEqual(tr.triggers[0].decisions.questions[0].choices.map((c) => c.value), ['so_15', 'khong_doi']);
  // Kết nối giả: phát sự kiện như LiveWS.
  const nghe = {};
  const rt = { on: (ten, fn) => { nghe[ten] = fn; } };
  m.gan(rt);
  nghe['session.output_transcript.delta']({ event_id: 'ev1', delta: 'giờ mình xem quần số 15' });
  nghe['decision.event']({ type: 'decision.event', source_event_id: 'ev1', event: { type: 'decision.completed',
    decision: { model: 'gpt-6-luna', usage: { input_tokens: 300 }, answers: [{ type: 'choice', name: 'mon_dang_noi', choice: 'so_15', confidence: 0.93, probabilities: [] }] } } });
  assert.deepEqual(nhan[0].traLoi.mon_dang_noi, { loai: 'choice', chon: 'so_15', tinCay: 0.93 });
  assert.equal(nhan[0].thuTu, 1);
  assert.equal(nhan[0].tokenVao, 300);
  assert.deepEqual(new MiengGptLive({ loiDan: 'x' }).phanTriggers(), {}, 'không có câu hỏi → không gửi triggers');
});
