'use strict';

/**
 * Chép lời người dẫn (F-21, #33): nhận ra "Mai ơi…", đổi nhà khi lỗi, nối phiên trước mốc 10 phút,
 * báo "người dẫn đang nói", không lưu lời người dẫn, tính chi phí. Dịch vụ chép lời giả: không gọi mạng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
async function choDen(dk, toiDa = 3000) {
  const bd = Date.now();
  for (;;) {
    const kq = await dk();
    if (kq) return kq;
    if (Date.now() - bd > toiDa) throw new Error('Quá thời gian chờ');
    await cho(15);
  }
}

test('nhận ra lời gọi "Mai ơi" và tách câu hỏi', () => {
  const { tachLoiGoiMai } = require('../server/chep-loi-nguoi-dan');
  assert.deepEqual(tachLoiGoiMai('Mai ơi, áo 12 giá bao nhiêu vậy em?'), { goi: true, cauHoi: 'áo 12 giá bao nhiêu vậy em?' });
  assert.deepEqual(tachLoiGoiMai('Này Mai ơi giá sao em'), { goi: true, cauHoi: 'giá sao em' });
  assert.deepEqual(tachLoiGoiMai('Mai à, ship mấy ngày?'), { goi: true, cauHoi: 'ship mấy ngày?' });
  assert.deepEqual(tachLoiGoiMai('Chị Mai ơi, size M còn màu gì'), { goi: true, cauHoi: 'size M còn màu gì' });
  assert.deepEqual(tachLoiGoiMai('Mai ơi.'), { goi: true, cauHoi: '' });
  for (const s of ['Ngày mai à, có hàng về không?', 'sáng mai ơi', 'hôm nay trời đẹp quá', 'mai mốt mình live tiếp', 'Bạn Maika ơi']) {
    assert.equal(tachLoiGoiMai(s).goi, false, s);
  }
});

/** Dịch vụ chép lời giả, điều khiển được từ bài test. */
function taoNhaGia() {
  const cacPhien = [];
  const hong = { gemini: false, openai: false };
  class Gia {
    constructor(o) {
      Object.assign(this, o);
      this.am = [];
      this.chotLan = 0;
      this.giayAm = 0;
      this.tokenVao = 0;
      this.tokenRa = 0;
      cacPhien.push(this);
    }
    async mo() {
      if (hong[this.nha]) throw new Error(`${this.nha} hỏng`);
      this.mo_ = true;
    }
    guiAm(b) { this.am.push(b); this.giayAm += b.length / 32000; }
    chot() { this.chotLan += 1; }
    dong() { this.daDongTay = true; }
  }
  class Gemini extends Gia { constructor(o) { super(o); this.nha = 'gemini'; this.model = 'gemini-3.5-transcribe-live'; } }
  class OpenAI extends Gia { constructor(o) { super(o); this.nha = 'openai'; this.model = 'gpt-live-transcribe'; } }
  return { nha: { gemini: Gemini, openai: OpenAI }, cacPhien, hong };
}

test('bộ quản lý chép lời người dẫn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const { ChepLoiNguoiDan } = require('../server/chep-loi-nguoi-dan');

  taoSanPhamMau();
  const kb = kichBan.taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id });
  live.ganLive(p.id, 'livegia_x');

  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const aiGoi = { hoiMai: [], noi: [], loi: [] };
  const phongAi = {
    hoiMai: (id, cau) => { aiGoi.hoiMai.push(cau); return { da_giao: true }; },
    datNguoiDanNoi: (id, b) => aiGoi.noi.push(b),
    themLoiNguoiDan: (id, chu) => aiGoi.loi.push(chu),
  };
  const g = taoNhaGia();
  const cl = new ChepLoiNguoiDan({ phat, phongAi, nhaChepLoi: g.nha, xoayMs: 80, thuLaiMs: 60, thuTuNha: ['gemini', 'openai'] });
  const ws = { readyState: 1, gui: [], send(x) { this.gui.push(JSON.parse(x)); } };
  const guiJson = (m) => cl.nhan(ws, Buffer.from(JSON.stringify(m)), false);
  t.after(() => cl.tat());

  await t.test('bật micro → mở phiên Gemini với từ riêng (tên sản phẩm, tên AI); tiếng micro chuyển thẳng tới dịch vụ', async () => {
    guiJson({ type: 'mic.bat', phien_id: p.id });
    await choDen(() => cl.phien);
    assert.equal(cl.phien.nha, 'gemini');
    assert.ok(['Sơ mi linen tay ngắn', 'Mai ơi', 'chốt', 'áo số 12'].every((x) => cl.phien.tuRieng.includes(x)));
    assert.ok(suKien.some((e) => e.type === 'live.chep_loi' && e.trang_thai === 'dang_nghe' && e.nha === 'gemini'));
    cl.nhan(ws, Buffer.alloc(3200), true);
    cl.nhan({ khac: true }, Buffer.alloc(3200), true); // màn hình khác không bật micro thì không nhận
    assert.equal(cl.phien.am.length, 1);
  });

  await t.test('"người dẫn đang nói" báo sang phòng live; thôi nói thì chốt đoạn', () => {
    guiJson({ type: 'nguoi_dan_noi', bat: true });
    guiJson({ type: 'nguoi_dan_noi', bat: false });
    assert.deepEqual(aiGoi.noi, [true, false]);
    assert.equal(cl.phien.chotLan, 1);
  });

  await t.test('"Mai ơi, …" → hỏi Mai; "Mai ơi" rồi ngừng → câu kế là câu hỏi; câu thường → Director biết', () => {
    cl.phien.khiXong('Mai ơi, áo 12 giá bao nhiêu vậy em?');
    cl.phien.khiXong('Mai ơi.');
    cl.phien.khiXong('áo 12 còn size L không nhỉ');
    cl.phien.khiXong('Các bạn ơi hôm nay mình giới thiệu ba mẫu mới');
    assert.deepEqual(aiGoi.hoiMai, ['áo 12 giá bao nhiêu vậy em?', 'áo 12 còn size L không nhỉ']);
    assert.deepEqual(aiGoi.loi, ['Các bạn ơi hôm nay mình giới thiệu ba mẫu mới']);
    assert.ok(suKien.some((e) => e.type === 'live.goi_mai' && e.cau_hoi.startsWith('áo 12 giá')));
    assert.ok(suKien.some((e) => e.type === 'live.loi_nguoi_dan' && !e.tam));
    cl.phien.khiTam('Các bạn');
    assert.ok(suKien.some((e) => e.type === 'live.loi_nguoi_dan' && e.tam));
  });

  await t.test('trước mốc 10 phút tự nối phiên mới; phiên cũ đóng và được tính tiền', async () => {
    const cu = cl.phien;
    await choDen(() => cl.phien !== cu);
    assert.equal(cu.daDongTay, true);
    const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'chep_loi'").all();
    assert.ok(run.length >= 1);
    assert.ok(run[0].chi_phi_usd > 0);
    assert.equal(run[0].model, 'gemini-3.5-transcribe-live');
  });

  await t.test('phiên đang dùng lỗi → chuyển nhà dự phòng OpenAI', async () => {
    cl.xoayMs = 60000;
    clearTimeout(cl.henXoay);
    const cu = cl.phien;
    g.hong.gemini = true;
    cu.khiLoi(new Error('mất kết nối'));
    await choDen(() => cl.phien && cl.phien.nha === 'openai');
    assert.ok(suKien.some((e) => e.type === 'live.chep_loi' && e.nha === 'openai'));
  });

  await t.test('hỏng cả hai nhà → báo lỗi, live vẫn chạy; tự thử lại', async () => {
    g.hong.openai = true;
    cl.phien.khiLoi(new Error('hỏng'));
    await choDen(() => suKien.some((e) => e.type === 'live.chep_loi' && e.trang_thai === 'loi'));
    assert.equal(cl.phien, null);
    g.hong.gemini = false;
    await choDen(() => cl.phien && cl.phien.nha === 'gemini', 2000);
  });

  await t.test('Đội AI dẫn (bản 2.9): chữ trùng lời đội đang đọc (tiếng loa lọt vào micro) bị bỏ; lời người dẫn thật báo đội tạm ngừng', () => {
    const goi = { noi: 0, xong: [] };
    cl.doiAi = {
      s: { phienId: p.id },
      dang: true,
      phanLoaiLoiNguoiDan: (chu) => (chu.includes('linen') ? 'vong' : chu.split(' ').length < 3 ? 'chua_ro' : 'nguoi'),
      dangPhat() { return this.dang; },
      nguoiDanNoi: () => { goi.noi += 1; },
      nguoiDanNoiXong: (c) => goi.xong.push(c),
    };
    const truoc = { hoi: aiGoi.hoiMai.length, loi: aiGoi.loi.length, sk: suKien.length };
    cl.phien.khiTam('linen mát lắm');
    cl.phien.khiXong('Mai ơi, sơ mi linen giá bao nhiêu?'); // nhân vật trong đội gọi "Mai ơi": không phải người dẫn hỏi
    cl.phien.khiTam('ừ'); // ngắn quá chưa rõ, đội đang đọc → coi là tiếng vọng
    assert.equal(goi.noi, 0);
    assert.equal(aiGoi.hoiMai.length, truoc.hoi);
    assert.equal(suKien.slice(truoc.sk).filter((e) => e.type === 'live.loi_nguoi_dan').length, 0, 'tiếng vọng không hiện');
    cl.phien.khiTam('các bạn ở xa');
    cl.phien.khiXong('các bạn ở xa yên tâm nha');
    assert.equal(goi.noi, 2, 'người dẫn nói xen: đội tạm ngừng');
    assert.deepEqual(goi.xong, ['các bạn ở xa yên tâm nha']);
    assert.deepEqual(aiGoi.loi.slice(truoc.loi), ['các bạn ở xa yên tâm nha'], 'Director vẫn biết lời người dẫn');
    cl.doiAi.dang = false;
    cl.phien.khiTam('ừ'); // đội không đọc → là tiếng người dẫn
    assert.equal(goi.noi, 3);

    // Loa đang kêu thật mới coi câu ngắn là tiếng vọng: đội đã ngừng vì người dẫn nói thì "Mai ơi." là người dẫn gọi.
    cl.doiAi.dang = true;
    cl.doiAi.keu = false;
    cl.doiAi.loaDangKeu = function () { return this.keu; };
    const hoi0 = aiGoi.hoiMai.length;
    cl.phien.khiXong('Mai ơi.');
    cl.phien.khiXong('Quần 15 còn size S không em?');
    assert.deepEqual(aiGoi.hoiMai.slice(hoi0), ['Quần 15 còn size S không em?']);
    // "Mai ơi." lúc loa còn kêu bị tưởng tiếng vọng; người dẫn nói tiếp ngay → vẫn là câu hỏi cho Mai.
    cl.doiAi.keu = true;
    cl.phien.khiXong('Mai ơi.');
    assert.equal(aiGoi.hoiMai.length, hoi0 + 1, '"Mai ơi." bị bỏ như tiếng vọng');
    cl.doiAi.keu = false;
    cl.phien.khiXong('Áo 12 màu trắng có bị lộ không em?');
    assert.deepEqual(aiGoi.hoiMai.slice(hoi0 + 1), ['Áo 12 màu trắng có bị lộ không em?']);
    cl.doiAi = null;
  });

  await t.test('lời người dẫn không được lưu vào cơ sở dữ liệu', () => {
    const tatCa = JSON.stringify(['binh_luan_live', 'agent_run', 'cau_tren_song', 'goi_cong_cu', 'nhat_ky_hook']
      .map((b) => csdl().prepare(`SELECT * FROM ${b}`).all()));
    assert.ok(!tatCa.includes('giới thiệu ba mẫu mới'));
  });

  await t.test('tắt micro / live kết thúc → thôi chép lời; từ chối khi AI tắt hoặc đang Dừng mọi thứ', async () => {
    guiJson({ type: 'mic.tat' });
    assert.equal(cl.phien, null);
    assert.ok(suKien.some((e) => e.type === 'live.chep_loi' && e.trang_thai === 'tat'));
    caiDat.datKhanCap(true);
    guiJson({ type: 'mic.bat', phien_id: p.id });
    await cho(20);
    assert.equal(ws.gui.at(-1).trang_thai, 'tu_choi');
    caiDat.datKhanCap(false);
    guiJson({ type: 'mic.bat', phien_id: p.id });
    await choDen(() => cl.phien);
    cl.ketThuc(p.id);
    assert.equal(cl.phien, null);
    live.ketThucPhien(p.id);
    guiJson({ type: 'mic.bat', phien_id: p.id });
    await cho(20);
    assert.equal(ws.gui.at(-1).trang_thai, 'tu_choi');
  });
});

test('Director biết người dẫn vừa nói gì (đóng khung lời người dẫn)', () => {
  const { veTinDau } = require('../server/agent/agents/director');
  const phien = { ten: 'Live thử', che_do_ai: 'goi_y', doan_hien_tai: 0, kich_ban: { doan: [{ san_pham: null, loi_nhac: 'Mở đầu' }] } };
  const s = veTinDau({ phien, binhLuanMoi: [], noiBat: [], daTraLoi: [], nguoiDanNoi: false, loiNguoiDan: ['Áo 12 giá 289 nghìn nhé <b>'] });
  assert.match(s, /Người dẫn vừa nói/);
  assert.match(s, /<loi_nguoi_dan>Áo 12 giá 289 nghìn nhé ‹b›<\/loi_nguoi_dan>/);
});

test('máy chủ nhận tiếng micro qua /ws: không có khóa thì báo chép lời lỗi, live vẫn chạy', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const { goi } = pm;
  const WebSocket = require('ws');
  taoSanPhamMau();
  const kb = (await goi('POST', '/api/kich-ban/tao-nhanh')).than.kich_ban;
  const phien = (await goi('POST', '/api/live/phien', { kich_ban_id: kb.id, che_do_ai: 'goi_y' })).than.phien;
  await goi('POST', '/api/dien-tap/live', { bat: true });
  await choDen(async () => (await goi('GET', '/api/live/phien/hien-tai')).than.phien?.trang_thai === 'dang_live');

  const ws = new WebSocket(`ws://127.0.0.1:${pm.cong}/ws`, { origin: pm.goc });
  const nhan = [];
  ws.on('message', (d) => nhan.push(JSON.parse(d.toString())));
  await new Promise((ok) => ws.once('open', ok));
  t.after(() => ws.close());
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  ws.send(JSON.stringify({ type: 'mic.bat', phien_id: phien.id }));
  await choDen(() => nhan.some((m) => m.type === 'live.chep_loi' && m.trang_thai === 'loi'));
  ws.send(JSON.stringify({ type: 'nguoi_dan_noi', bat: true }));
  await choDen(() => nhan.some((m) => m.type === 'live.nguoi_dan_noi' && m.bat === true));
  ws.send(Buffer.alloc(3200)); // tiếng micro khi chép lời đang lỗi: bỏ qua, không làm sập gì
  ws.send(JSON.stringify({ type: 'mic.tat' }));
  await choDen(() => nhan.some((m) => m.type === 'live.chep_loi' && m.trang_thai === 'tat'));
  assert.equal((await goi('GET', '/api/live/phien/hien-tai')).than.phien.trang_thai, 'dang_live');
  await goi('POST', '/api/dien-tap/live', { bat: false });
});
