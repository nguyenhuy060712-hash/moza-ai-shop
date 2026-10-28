'use strict';

/**
 * Người dẫn giả nói có tiếng (SPEC.md bản 2.5, F-39): đổi tần số, phát vào đường micro (micro ảo / chen vào micro thật),
 * xếp hàng, ghi chi phí, kịch bản làm tiếng sẵn. Không gọi Google thật.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');
const { doiTanSo } = require('../server/tieng-gia');
// Máy đọc Google (mac-dinh.json doc_giong = "gemini"); máy OpenAI thử ở doc-giong-openai.test.js.
require('../server/agent/nha-cung-cap/tts').datNhaDoc('gemini');

const ngu = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function choDen(dk, ms = 2000) {
  const het = Date.now() + ms;
  while (!dk()) {
    if (Date.now() > het) throw new Error('Chờ quá lâu');
    await ngu(5);
  }
}

test('đổi tần số 24 kHz → 16 kHz: đủ độ dài, giữ hình dạng tiếng', () => {
  const vao = Buffer.alloc(2400 * 2); // 0,1 giây ở 24 kHz
  for (let i = 0; i < 2400; i += 1) vao.writeInt16LE(Math.round(10000 * Math.sin((2 * Math.PI * 440 * i) / 24000)), i * 2);
  const ra = doiTanSo(vao, 24000, 16000);
  assert.equal(ra.length / 2, 1600);
  // Mẫu ra thứ 100 ứng với thời điểm 100/16000 giây của sóng gốc.
  const mongDoi = 10000 * Math.sin((2 * Math.PI * 440 * 100) / 16000);
  assert.ok(Math.abs(ra.readInt16LE(200) - mongDoi) < 300);
  assert.equal(doiTanSo(Buffer.alloc(0)).length, 0);
});

/** Dịch vụ chép lời giả (như test chép lời người dẫn). */
function taoNhaGia() {
  const cacPhien = [];
  class Gia {
    constructor(o) { Object.assign(this, o); this.am = []; this.chotLan = 0; this.giayAm = 0; this.tokenVao = 0; this.tokenRa = 0; cacPhien.push(this); }
    async mo() { this.mo_ = true; }
    guiAm(b) { this.am.push(b); this.giayAm += b.length / 32000; }
    chot() { this.chotLan += 1; }
    dong() { this.daDongTay = true; }
  }
  class Gemini extends Gia { constructor(o) { super(o); this.nha = 'gemini'; this.model = 'gemini-3.5-transcribe-live'; } }
  class OpenAI extends Gia { constructor(o) { super(o); this.nha = 'openai'; this.model = 'gpt-live-transcribe'; } }
  return { nha: { gemini: Gemini, openai: OpenAI }, cacPhien };
}

test('phát tiếng giả vào đường micro của MOZA', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const { ChepLoiNguoiDan } = require('../server/chep-loi-nguoi-dan');
  const { TiengGia } = require('../server/tieng-gia');
  const { DienTap } = require('../server/dien-tap');

  taoSanPhamMau();
  const kb = kichBan.taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id });

  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const noi = [];
  const phongAi = { hoiMai: () => ({ da_giao: true }), datNguoiDanNoi: (id, b) => noi.push(b), themLoiNguoiDan: () => {} };
  const g = taoNhaGia();
  const cl = new ChepLoiNguoiDan({ phat, phongAi, nhaChepLoi: g.nha });
  t.after(() => cl.tat());
  const nhanh = { nhipMs: 1, choChotMs: 5 };
  const pcm = Buffer.alloc(3200 * 4); // 0,4 giây ở 16 kHz = 4 mẩu

  await t.test('chưa có buổi live đang chạy → báo lý do, không mở gì', async () => {
    await assert.rejects(() => cl.phatTiengGia(p.id, pcm, nhanh), (e) => e.ma === 'KHONG_CO_LIVE' && /live/i.test(e.message));
    assert.equal(cl.ws, null);
  });

  live.ganLive(p.id, 'livegia_x');

  await t.test('chưa bật micro → mở micro ảo, đủ tiếng + nửa giây im, báo "đang nói" rồi tự tắt', async () => {
    await cl.phatTiengGia(p.id, pcm, nhanh);
    const phien = g.cacPhien.at(-1);
    assert.equal(phien.am.length, 4 + 8);
    assert.equal(phien.chotLan, 1, 'thôi nói thì chốt đoạn');
    assert.deepEqual(noi.slice(0, 2), [true, false]);
    assert.equal(cl.ws, null, 'micro ảo đã tắt');
    assert.ok(suKien.some((e) => e.type === 'live.chep_loi' && e.trang_thai === 'tat' && e.ly_do === 'Người dẫn giả nói xong'));
  });

  await t.test('micro thật đang bật → chen vào; tiếng micro thật bị bỏ trong lúc phát; micro thật vẫn bật sau đó', async () => {
    const ws = { send() {} };
    cl.nhan(ws, Buffer.from(JSON.stringify({ type: 'mic.bat', phien_id: p.id })), false);
    await choDen(() => cl.phien);
    const phien = cl.phien;
    const viec = cl.phatTiengGia(p.id, pcm, { nhipMs: 5, choChotMs: 5 });
    await ngu(8);
    cl.nhan(ws, Buffer.alloc(3200, 1), true); // tiếng micro thật giữa lúc phát
    await viec;
    assert.equal(phien.am.length, 12, 'chỉ có tiếng giả');
    assert.ok(phien.am.every((b) => b.every((x) => x === 0)));
    assert.equal(cl.ws, ws);
    cl.nhan(ws, Buffer.alloc(3200, 1), true);
    assert.equal(phien.am.length, 13, 'phát xong thì nhận lại micro thật');
    cl.tat();
  });

  await t.test('"Dừng mọi thứ" đang bật → micro ảo không mở, báo lý do', async () => {
    caiDat.datKhanCap(true);
    await assert.rejects(() => cl.phatTiengGia(p.id, pcm, nhanh), /Dừng mọi thứ/);
    caiDat.datKhanCap(false);
  });

  // TTS giả: không gọi Google.
  const ttsGia = {
    goi: [],
    async docChu(o) { this.goi.push(o); return { wav: Buffer.from('RIFFgia'), pcm: Buffer.alloc(24000 * 2 * 0.3), tanSo: 24000, giay: 0.3, token: { vao: 10, ra: 9 }, model: 'gemini-3.8-flash-lite-tts' }; },
    async docHoiThoai(o) { this.goi.push(o); return { wav: Buffer.from('RIFFhai'), pcm: Buffer.alloc(24000 * 2), tanSo: 24000, giay: 1, token: { vao: 20, ra: 31 }, model: 'gemini-3.8-flash-lite-tts' }; },
    async dsGiongKho() { return { giong: [{ id: 'vi-vn-advisor-2', ten: 'A2', gioi: 'nam' }], trangSau: null }; },
  };
  const tg = new TiengGia({ chepLoi: cl, phat, tts: ttsGia, tuyChonPhat: nhanh });

  await t.test('người dẫn giả nói: làm tiếng bằng giọng người dẫn, báo trang phát ra loa, phát vào micro, ghi chi phí diễn tập', async () => {
    const truoc = g.cacPhien.length;
    const kq = await tg.noi({ chu: 'Mai ơi, áo 12 giá bao nhiêu vậy em?' });
    assert.equal(ttsGia.goi.at(-1).giong, 'vi-vn-advisor-2');
    assert.ok(tg.layTep(kq.id));
    await tg.hang; // đợi đoạn nói xong (hàng đợi phát)
    assert.ok(g.cacPhien.length > truoc && cl.ws === null);
    assert.ok(suKien.some((e) => e.type === 'dien_tap.tieng_gia' && e.id === kq.id));
    // 0,3 giây ở 24 kHz → 0,3 giây ở 16 kHz = 3 mẩu (mẩu cuối thiếu) + 8 mẩu im
    assert.equal(g.cacPhien.at(-1).am.length, 3 + 8);
    const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'tieng_gia'").get();
    assert.equal(run.dien_tap, 1);
    assert.equal(run.token_ra, 9);
    assert.ok(run.chi_phi_usd > 0);
  });

  await t.test('hai người nói: nhãn không dấu cho Google, giọng người dẫn và khách mời', async () => {
    const kq = await tg.hoiThoai({ luot: [{ vai: 'nguoi_dan', chu: 'Bạn mặc áo này đi làm được chưa?' }, { vai: 'khach', chu: 'Dạ hai năm rồi ạ.' }] });
    const o = ttsGia.goi.at(-1);
    assert.deepEqual(o.luot.map((l) => l.nguoi), ['NguoiDan', 'KhachMoi']);
    assert.deepEqual(o.giong, { NguoiDan: 'vi-vn-advisor-2', KhachMoi: 'vi-vn-advisor-4' });
    assert.match(kq.chu, /Người dẫn: Bạn mặc.*Khách mời: Dạ hai năm/);
    await tg.hang;
    assert.equal(cl.ws, null);
  });

  await t.test('câu trống → từ chối, không gọi Google', async () => {
    const truoc = ttsGia.goi.length;
    await assert.rejects(() => tg.noi({ chu: '  ' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.equal(ttsGia.goi.length, truoc);
  });

  await t.test('kịch bản có bước nói: làm tiếng sẵn ngay lúc bắt đầu, thay {goi}, {so}, {ten_sp}, {mau}, {co} bằng sản phẩm đang nói', async () => {
    const dt = new DienTap({ fb: { trangThai: () => ({ dang_phat: true }) }, phat, tiengGia: tg });
    const truoc = ttsGia.goi.length;
    const san = dt.lamTiengSan({ binh_luan: [
      { sau_giay: 1, noi: 'Mai ơi, {goi} số {so} giá bao nhiêu? Chốt {so} {mau} {co} nhé' },
      { sau_giay: 2, ten: 'A', noi_dung: 'bình luận thường' },
      { sau_giay: 3, hoi_thoai: [{ vai: 'nguoi_dan', chu: 'Chào {ten_sp}' }, { vai: 'khach', chu: 'Dạ' }] },
    ] });
    assert.equal(san.size, 2);
    await Promise.all(san.values());
    assert.equal(ttsGia.goi[truoc].chu, 'Mai ơi, áo số 12 giá bao nhiêu? Chốt 12 Đen M nhé', 'gọi món bằng số, màu và cỡ lấy từ ô còn hàng');
    assert.equal(ttsGia.goi[truoc + 1].luot[0].chu, 'Chào Sơ mi linen tay ngắn');
    assert.ok(dt.danhSach().find((k) => k.id === 'nguoi-dan-hoi-mai-giong').co_tieng);
  });
});

test('API người dẫn giả nói: chưa có live → 409 KHONG_CO_LIVE; tệp tiếng hết hạn → 404', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const r = await pm.goi('POST', '/api/dien-tap/noi', { chu: 'Mai ơi, áo 12 giá bao nhiêu?' });
  assert.equal(r.ma, 409);
  assert.equal(r.than.loi.ma, 'KHONG_CO_LIVE');
  assert.equal((await pm.goi('GET', '/api/dien-tap/tieng/tg_khongco')).ma, 404);
  const kb = await pm.goi('GET', '/api/dien-tap/kich-ban');
  assert.ok(kb.than.kich_ban.some((k) => k.id === 'hai-nguoi-noi' && k.co_tieng));
});

test('Bắt đầu tập một chạm: chưa có sản phẩm Đang bán thì báo cách làm; có sản phẩm thì mở phiên diễn tập và live giả', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const khongSp = await pm.goi('POST', '/api/dien-tap/bat-dau-nhanh', { che_do_ai: 'goi_y' });
  assert.equal(khongSp.than.loi.ma, 'SP_KHONG_BAN_DUOC');
  assert.match(khongSp.than.loi.thong_diep, /Đang bán/);

  taoSanPhamMau();
  const r = await pm.goi('POST', '/api/dien-tap/bat-dau-nhanh', { che_do_ai: 'goi_y', nguoi_xem_gia: false });
  assert.equal(r.ma, 201, JSON.stringify(r.than));
  // Test không có khóa AI: AI không soạn được kịch bản → vẫn tập được bằng kịch bản nhanh, có câu báo.
  assert.match(r.than.canh_bao, /AI chưa soạn được kịch bản/);
  assert.equal(r.than.phien.dien_tap, true);
  assert.equal(r.than.phien.che_do_ai, 'goi_y');
  assert.equal(r.than.phien.trang_thai, 'dang_live', 'phòng live gắn phiên vào live giả ngay');
  assert.equal(r.than.dien_tap.dang_phat, true);
  assert.ok(r.than.phien.kich_ban.doan.some((d) => d.san_pham?.so === 12));

  const lai = await pm.goi('POST', '/api/dien-tap/bat-dau-nhanh', { che_do_ai: 'noi' });
  assert.equal(lai.than.phien.id, r.than.phien.id, 'đang có buổi tập thì dùng luôn, không mở phiên mới');
  await pm.goi('POST', '/api/dien-tap/live', { bat: false });
});

test('Bắt đầu tập với kịch bản đã chọn: dùng đúng kịch bản đó (không nhờ AI soạn); kịch bản không có → 404; Đội AI dẫn cần kịch bản của đội', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const mau = taoSanPhamMau();
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'] });
  // Kịch bản chỉ có 1 trong 2 món Đang bán: "Tự chọn" sẽ không lấy kịch bản này, chọn tay thì phải lấy.
  const kb = (await pm.goi('POST', '/api/kich-ban', { ten: 'Live áo 12 · 5 phút', doan: [{ san_pham_id: mau.san_pham.id, loi_nhac: 'Người dẫn: Áo số 12 nè.' }] })).than;
  const kbId = (kb.kich_ban || kb).id;
  assert.equal((await pm.goi('POST', '/api/dien-tap/bat-dau-nhanh', { che_do_ai: 'goi_y', kich_ban_id: 'kb_khongco', nguoi_xem_gia: false })).ma, 404);
  const doi = await pm.goi('POST', '/api/dien-tap/bat-dau-nhanh', { che_do_ai: 'doi', kich_ban_id: kbId, nguoi_xem_gia: false });
  assert.equal(doi.ma, 400);
  assert.match(doi.than.loi.thong_diep, /không phải kịch bản Đội AI dẫn/);
  const r = await pm.goi('POST', '/api/dien-tap/bat-dau-nhanh', { che_do_ai: 'goi_y', kich_ban_id: kbId, nguoi_xem_gia: false });
  assert.equal(r.ma, 201, JSON.stringify(r.than));
  assert.equal(r.than.phien.kich_ban.ten, 'Live áo 12 · 5 phút');
  assert.equal(r.than.canh_bao, null, 'không nhờ AI soạn');
  assert.equal(r.than.phien.trang_thai, 'dang_live');
  await pm.goi('POST', '/api/dien-tap/live', { bat: false });
});
