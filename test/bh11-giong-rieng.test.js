'use strict';

/**
 * Giọng riêng của Mai (SPEC.md F-114) — làm sẵn sau công tắc TẮT, kết nối OpenAI giả (0 đồng): tạo bằng mô tả, giữ đang dùng + 3 gần
 * nhất (xóa giọng cũ ở OpenAI), chọn / xóa, công tắc chỉ bật khi có giọng; miệng giả nhận đúng mã giọng {id} và mô tả lặp trong lời dặn
 * khi bật, giọng có sẵn khi tắt; nghe thử trả WAV và ghi chi phí.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

function ketNoiGia() {
  const k = { tao: [], xoa: [], so: 0 };
  return Object.assign(k, {
    async taoGiong({ name, prompt }) { k.so += 1; k.tao.push({ name, prompt }); return { id: `voice_${k.so}`, name, type: 'prompt', prompt }; },
    async xoaGiong(id) { k.xoa.push(id); return { id, deleted: true }; },
    async ngheThu({ id }) { k.nghe = id; return { pcm: Buffer.alloc(48000), giay: 12 }; },
  });
}

test('tạo / chọn / xóa giọng; giữ đang dùng + 3 gần nhất; công tắc tắt mặc định, chỉ bật khi có giọng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const gr = require('../server/nghiep-vu/giong-rieng');
  const k = ketNoiGia();
  gr.datKetNoi(k);
  t.after(() => gr.datKetNoi(null));
  assert.deepEqual([gr.trangThai().bat, gr.trangThai().ds.length], [false, 0]);
  assert.throws(() => gr.datBat(true), /Tạo một giọng trước/);
  await assert.rejects(gr.tao({ mo_ta: '  ' }), /Mô tả giọng/);
  await assert.rejects(gr.tao({ mo_ta: 'a'.repeat(2001) }), /2000/);
  for (let i = 1; i <= 5; i++) await gr.tao({ mo_ta: `Giọng nữ miền Bắc số ${i}` });
  const st = gr.trangThai();
  assert.deepEqual(st.ds.map((g) => g.id), ['voice_5', 'voice_4', 'voice_3', 'voice_2']);
  assert.deepEqual(k.xoa, ['voice_1'], 'giọng ngoài 3 gần nhất xóa ở OpenAI (giới hạn 100)');
  assert.equal(st.dang_dung, 'voice_5');
  assert.equal(st.bat, false, 'tạo xong vẫn TẮT — chủ dự án nghe rồi mới bật');
  assert.equal(gr.giongChoMieng(), null);
  gr.chon('voice_3');
  gr.datBat(true);
  assert.deepEqual(gr.giongChoMieng(), { id: 'voice_3', moTa: 'Giọng nữ miền Bắc số 3' });
  await gr.xoa('voice_3');
  assert.equal(gr.trangThai().dang_dung, 'voice_5');
  assert.ok(k.xoa.includes('voice_3'));
  const n = await gr.ngheThu();
  assert.equal(k.nghe, 'voice_5');
  assert.equal(n.wav.toString('ascii', 0, 4), 'RIFF');
  assert.ok(n.chi_phi_usd > 0);
});

test('miệng giả: công tắc bật → giọng {id} + mô tả lặp trong lời dặn; tắt → giọng có sẵn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const gr = require('../server/nghiep-vu/giong-rieng');
  gr.datKetNoi(ketNoiGia());
  t.after(() => gr.datKetNoi(null));
  const live = require('../server/nghiep-vu/live');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');
  const { MiengGia } = require('../server/agent/mieng/mieng-gia');
  taoSanPhamMau();
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'noi', dien_tap: true });
  const giaModel = caiDat.MAC_DINH.mieng.find((x) => x.nha === 'gia').model;
  csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ?, mieng = ? WHERE id = ?").run(new Date().toISOString(), giaModel, p.id);
  const tatCa = [];
  class Gia extends MiengGia { constructor(o) { super(o); tatCa.push(this); } }
  const mieng = new MiengCuaMai({ phat: () => {}, chepLoi: { nhuong() {}, layLai() {} }, nhaMieng: { gia: Gia }, quyetDinhMai: { bat: false } });
  t.after(() => mieng.dong());
  await gr.tao({ mo_ta: 'Giọng nữ miền Nam, ngọt, nói chậm' });
  await mieng.dongBo();
  assert.notDeepEqual(tatCa[0].giong, { id: 'voice_1' }, 'công tắc tắt: giọng có sẵn');
  assert.ok(!/GIỌNG NÓI CỦA MAI/.test(tatCa[0].loiDan));
  await mieng.dong('thử');
  gr.datBat(true);
  await mieng.dongBo();
  assert.deepEqual(tatCa[1].giong, { id: 'voice_1' });
  assert.match(tatCa[1].loiDan, /GIỌNG NÓI CỦA MAI \(giữ suốt buổi\): Giọng nữ miền Nam, ngọt, nói chậm$/);
});
