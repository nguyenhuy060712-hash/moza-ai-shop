'use strict';

/**
 * Tông giọng trên sóng (SPEC.md F-127): danh sách dùng chung, lưu / kiểm ô tự viết, miệng giả nhận đúng đoạn tông trong lời dặn,
 * đổi tông giữa buổi: miệng có thêm lời dặn (GPT-Live, miệng giả) → thêm; miệng không có (Gemini) → mở lại với lời dặn mới.
 * Đội AI: lượt không ghi cách nói dùng tông làm cách nói mặc định. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('danh sách 5 tông, lưu tông, tự viết ≤ 400 ký tự, đoạn ghép lời dặn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const tg = require('../server/nghiep-vu/tong-giong');
  assert.deepEqual(tg.danhSach().map((x) => x.ma), ['deu_ro', 'mc_vua', 'mc_soi_noi', 'am_ap', 'tu_viet']);
  assert.equal(tg.dangChon().ma, 'mc_vua');
  tg.datTong({ ma: 'am_ap' });
  assert.match(tg.doanLoiDan(), /^TÔNG GIỌNG TRÊN SÓNG .*Nói ấm, chậm/);
  assert.match(tg.cachNoiDoi(), /ấm áp/);
  assert.throws(() => tg.datTong({ ma: 'tu_viet', tu_viet: '' }), /gõ vài câu/);
  assert.throws(() => tg.datTong({ ma: 'tu_viet', tu_viet: 'a'.repeat(401) }), /400/);
  assert.throws(() => tg.datTong({ ma: 'la' }), /Không có tông/);
  tg.datTong({ ma: 'tu_viet', tu_viet: 'Giọng nữ miền Bắc, nhanh vừa, gọi khách là các chị.' });
  assert.match(tg.doanLoiDan(), /các chị/);
  assert.match(tg.doanDoiGiua(), /^Từ giờ đổi tông giọng/);
});

test('miệng giả nhận đoạn tông trong lời dặn; đổi tông giữa buổi: thêm lời dặn (có themLoiDan) hoặc mở lại miệng (không có)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const tg = require('../server/nghiep-vu/tong-giong');
  const { csdl } = require('../server/db/ket-noi');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');
  const { MiengGia } = require('../server/agent/mieng/mieng-gia');
  taoSanPhamMau();
  tg.datTong({ ma: 'deu_ro' });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'noi', dien_tap: true });
  csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ?, mieng = 'mieng-gia' WHERE id = ?").run(new Date().toISOString(), p.id);
  const tatCa = [];
  class Gia extends MiengGia { constructor(o) { super(o); tatCa.push(this); } }
  class KhongThem extends MiengGia { constructor(o) { super(o); tatCa.push(this); } }
  KhongThem.prototype.themLoiDan = undefined;
  const phat = () => {};
  const mieng = new MiengCuaMai({ phat, chepLoi: { nhuong() {}, layLai() {} }, nhaMieng: { gia: Gia, openai: Gia, gemini: KhongThem } });
  t.after(() => mieng.dong());
  const giaModel = caiDat.MAC_DINH.mieng.find((x) => x.nha === 'gia')?.model;
  assert.ok(giaModel, 'có miệng giả trong danh sách miệng');
  csdl().prepare('UPDATE phien_live SET mieng = ? WHERE id = ?').run(giaModel, p.id);
  await mieng.dongBo();
  assert.equal(tatCa.length, 1);
  assert.match(tatCa[0].loiDan, /TÔNG GIỌNG TRÊN SÓNG .*đều giọng/);
  tg.datTong({ ma: 'mc_soi_noi' });
  await mieng.dongBo();
  assert.equal(tatCa.length, 1, 'không mở lại');
  assert.match(tatCa[0].loiDanThem.at(-1), /^Từ giờ đổi tông giọng.*hào hứng/);
  // Miệng không thêm được lời dặn (như Gemini): đổi tông → đóng, lần đồng bộ sau mở lại với lời dặn mới.
  await mieng.dong('thử');
  const gem = caiDat.MAC_DINH.mieng.find((x) => x.nha === 'gemini' && !x.chi_dien_tap).model;
  csdl().prepare('UPDATE phien_live SET mieng = ? WHERE id = ?').run(gem, p.id);
  await mieng.dongBo();
  assert.equal(tatCa.length, 2);
  tg.datTong({ ma: 'am_ap' });
  await mieng.dongBo();
  await mieng.dongBo();
  assert.equal(tatCa.length, 3, 'mở lại miệng');
  assert.match(tatCa[2].loiDan, /Nói ấm, chậm/);
});

test('Đội AI: lượt không ghi cách nói dùng tông làm cách nói mặc định', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/tong-giong').datTong({ ma: 'mc_soi_noi' });
  const phongThu = require('../server/doi-ai/phong-thu');
  assert.equal(typeof phongThu.cachNoiCua, 'function');
  assert.equal(phongThu.cachNoiCua({ ai: 'Mai', loi: 'x' }), 'hào hứng, rộn ràng, nhanh');
  assert.equal(phongThu.cachNoiCua({ ai: 'Mai', cachNoi: 'thì thầm', loi: 'x' }), 'thì thầm');
});
