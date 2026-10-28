'use strict';

/**
 * Máy đọc giọng OpenAI mới (BH10, F-108): `gpt-realtime-2.1-mini` qua Realtime API (máy cũ OpenAI tắt 6/1/2027). Kết nối giả phát
 * đúng tên sự kiện trong tài liệu (response.output_audio.delta, response.output_audio_transcript.*, response.done); mỗi giọng một
 * phiên; chữ chép lại lệch câu gốc → bỏ tiếng, DOC_LECH. ElevenLabs bằng fetch giả. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const tts = require('../server/agent/nha-cung-cap/tts');
const docRealtime = require('../server/agent/nha-cung-cap/doc-realtime');
const docEleven = require('../server/agent/nha-cung-cap/doc-elevenlabs');

/**
 * Máy chủ Realtime giả: mỗi response.create trả 0,5 giây PCM chia 3 mẩu (mẩu lẻ byte như mạng thật) và chữ chép lại = câu gửi
 * (hoặc `doiChep(chu)`), rồi response.done có usage.
 */
function taoRealtimeGia({ doiChep = (c) => c, loiMo = null } = {}) {
  const ketNoi = [];
  const f = ({ model, apiKey }) => {
    const rt = new EventEmitter();
    const socket = new EventEmitter();
    const k = { model, apiKey, gui: [], dong: false };
    ketNoi.push(k);
    let dem = 0;
    rt.socket = socket;
    rt.close = () => { k.dong = true; socket.emit('close'); };
    rt.send = (ev) => {
      k.gui.push(ev);
      // Hủy khi câu đã xong: OpenAI thật báo response_cancel_not_active (thử 28/10/2026) — MOZA phải bỏ qua.
      if (ev.type === 'response.cancel') { setImmediate(() => rt.emit('error', { type: 'error', error: { type: 'invalid_request_error', code: 'response_cancel_not_active', message: 'Cancellation failed: no active response found' } })); return; }
      if (ev.type !== 'response.create') return;
      const id = `resp_${++dem}`;
      const chu = ev.response.input[0].content[0].text;
      setImmediate(() => {
        rt.emit('response.created', { type: 'response.created', response: { id } });
        const pcm = Buffer.alloc(24000);
        for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(1000, i);
        const chep = doiChep(chu);
        rt.emit('response.output_audio_transcript.delta', { delta: chep.slice(0, 5) });
        rt.emit('response.output_audio.delta', { response_id: id, delta: pcm.subarray(0, 1001).toString('base64') });
        rt.emit('response.output_audio_transcript.delta', { delta: chep.slice(5) });
        rt.emit('response.output_audio_transcript.done', { transcript: chep });
        rt.emit('response.output_audio.delta', { response_id: id, delta: pcm.subarray(1000, 9999).toString('base64') });
        rt.emit('response.output_audio.delta', { response_id: id, delta: pcm.subarray(9999).toString('base64') });
        rt.emit('response.done', { response: { id, status: 'completed', usage: { input_tokens: 40, output_tokens: 30, output_token_details: { audio_tokens: 25, text_tokens: 5 } } } });
      });
    };
    setImmediate(() => (loiMo ? socket.emit('error', loiMo) : socket.emit('open')));
    return rt;
  };
  return { f, ketNoi };
}

function datKhoa(t, ten = 'OPENAI_API_KEY', gt = 'sk-thu-1234') {
  const cu = process.env[ten];
  process.env[ten] = gt;
  t.after(() => {
    docRealtime.datKetNoi(null);
    docEleven.datFetch(null);
    tts.datNhaDoc(null);
    if (cu === undefined) delete process.env[ten]; else process.env[ten] = cu;
  });
}

test('máy đọc mặc định là OpenAI gpt-realtime-2.1-mini; đúng 10 giọng Realtime', () => {
  assert.equal(tts.nhaDoc(), 'openai');
  assert.equal(tts.modelMacDinh(), 'gpt-realtime-2.1-mini');
  assert.deepEqual([...tts.GIONG_OPENAI].sort(), ['alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'marin', 'sage', 'shimmer', 'verse']);
});

test('OpenAI Realtime: session.update đúng dạng, mỗi câu một response.create ngoài hội thoại, tiếng chẵn byte, chi phí theo usage', async (t) => {
  const g = taoRealtimeGia();
  docRealtime.datKetNoi(g.f);
  datKhoa(t);
  const manh = [];
  const kq = await tts.docChu({ chu: 'Dạ súp lơ số 58 hôm nay 55 nghìn một cân', giong: 'voice_abc', phongCach: 'hào hứng', khiAm: (b) => manh.push(b) });
  assert.equal(g.ketNoi.length, 1);
  const k = g.ketNoi[0];
  assert.equal(k.model, 'gpt-realtime-2.1-mini');
  assert.equal(k.apiKey, 'sk-thu-1234');
  const ss = k.gui[0];
  assert.equal(ss.type, 'session.update');
  assert.equal(ss.session.type, 'realtime');
  assert.deepEqual(ss.session.output_modalities, ['audio']);
  assert.equal(ss.session.audio.output.voice, 'marin', 'giọng Google cũ đọc bằng marin');
  assert.deepEqual(ss.session.audio.output.format, { type: 'audio/pcm', rate: 24000 });
  assert.match(ss.session.instructions, /đúng nguyên văn/);
  const rc = k.gui[1];
  assert.equal(rc.type, 'response.create');
  assert.equal(rc.response.conversation, 'none');
  assert.match(rc.response.instructions, /hào hứng/);
  assert.equal(rc.response.input[0].content[0].text, 'Dạ súp lơ số 58 hôm nay 55 nghìn một cân');
  assert.ok(manh.length >= 2 && manh.every((m) => m.length % 2 === 0));
  assert.equal(kq.model, 'gpt-realtime-2.1-mini');
  assert.ok(Math.abs(kq.giay - 0.5) < 0.01);
  assert.deepEqual(kq.token, { vao: 40, ra: 25, ra_chu: 5 });

  // Hai người nói: gộp lượt liền nhau cùng người; mỗi giọng một phiên riêng; nghỉ 0,2 giây giữa hai người.
  const hai = await tts.docHoiThoai({
    luot: [{ nguoi: 'Mai', chu: 'Chào cả nhà' }, { nguoi: 'Mai', chu: 'hôm nay rau tươi lắm' }, { nguoi: 'Tung', chu: 'Thật không Mai?' }],
    giong: { Mai: 'marin', Tung: 'cedar' },
  });
  assert.equal(g.ketNoi.length, 2, 'marin dùng lại phiên cũ, cedar mở phiên mới');
  assert.equal(g.ketNoi[1].gui[0].session.audio.output.voice, 'cedar');
  assert.equal(k.gui.at(-1).response.input[0].content[0].text, 'Chào cả nhà hôm nay rau tươi lắm');
  assert.ok(Math.abs(hai.giay - 1.2) < 0.02);
  assert.deepEqual(docRealtime.dsPhien().map((p) => p.giong).sort(), ['cedar', 'marin']);
});

test('OpenAI Realtime: chữ chép lại lệch số → hủy câu, đọc lại một lần, DOC_LECH, không phát mẩu nào', async (t) => {
  const g = taoRealtimeGia({ doiChep: (c) => c.replace('289.000', '298.000') });
  docRealtime.datKetNoi(g.f);
  datKhoa(t);
  const manh = [];
  await assert.rejects(tts.docChu({ chu: 'Sơ mi số 12 giá 289.000 đồng', giong: 'marin', khiAm: (b) => manh.push(b) }), (e) => e.ma === 'DOC_LECH');
  assert.equal(manh.length, 0);
  const gui = g.ketNoi[0].gui.map((x) => x.type);
  assert.equal(gui.filter((x) => x === 'response.create').length, 2, 'đọc lại một lần');
  assert.ok(gui.includes('response.cancel'), 'hủy câu lệch cho đỡ tốn');
});

test('OpenAI Realtime: chưa có khóa → CHUA_CO_KHOA; không mở được phiên → lỗi dễ hiểu', async (t) => {
  datKhoa(t);
  docRealtime.datKetNoi(taoRealtimeGia({ loiMo: Object.assign(new Error('Unexpected server response: 401'), { status: 401 }) }).f);
  await assert.rejects(tts.docChu({ chu: 'thử', giong: 'marin' }), /OpenAI từ chối khóa/);
  docRealtime.datKetNoi(taoRealtimeGia().f);
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(tts.docChu({ chu: 'thử', giong: 'marin' }), (e) => e.ma === 'CHUA_CO_KHOA');
});

test('OpenAI Realtime: phiên rảnh 2 phút thì đóng', async (t) => {
  const g = taoRealtimeGia();
  docRealtime.datKetNoi(g.f);
  datKhoa(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const p = tts.docChu({ chu: 'Chào cả nhà', giong: 'coral' });
  await p;
  assert.equal(g.ketNoi[0].dong, false);
  t.mock.timers.tick(docRealtime.RANH_TOI_DA_MS + 10);
  assert.equal(g.ketNoi[0].dong, true);
  assert.equal(docRealtime.dsPhien().length, 0);
});

test('Đội AI đọc bằng OpenAI Realtime: mỗi nhân vật một giọng (Mai = marin), bỏ thẻ tiếng, ghi chi phí theo usage', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const g = taoRealtimeGia();
  docRealtime.datKetNoi(g.f);
  datKhoa(t);
  const phongThu = require('../server/doi-ai/phong-thu');
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const { csdl } = require('../server/db/ket-noi');
  phongThu.quenHetLuot();

  const nv = doiAi.nhanVat();
  const lc = phongThu.cacLuaChon(phongThu.MODEL_CHEN, nv);
  assert.equal(lc.length, 1);
  assert.equal(lc[0].model, 'gpt-realtime-2.1-mini');
  const giong = [...lc[0].giong.values()];
  assert.equal(giong[0], 'marin');
  assert.equal(new Set(giong).size, giong.length, 'mỗi nhân vật một giọng');
  assert.ok(giong.every((x) => tts.GIONG_OPENAI.includes(x)));

  const a12 = taoSanPhamMau();
  const ten = nv.map((n) => n.ten);
  const kq = await phongThu.lamTiengDoan({
    doan: { san_pham_id: a12.san_pham.id, loi_nhac: `${ten[0]}: Sơ mi linen 289.000 đồng nè <laugh>\n${ten[1]}: Mát không ${ten[0]}?` },
    viec: 'Đội AI · thử OpenAI',
  });
  assert.equal(kq.phan.length, 1);
  const cau = g.ketNoi.flatMap((k) => k.gui.filter((x) => x.type === 'response.create').map((x) => [k.gui[0].session.audio.output.voice, x.response.input[0].content[0].text]));
  assert.deepEqual(cau.map((x) => x[0]), [giong[0], giong[1]]);
  assert.ok(cau.every((x) => !/<laugh>/.test(x[1])), 'thẻ tiếng của Gemini không gửi OpenAI');
  const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'doi_ai'").all();
  assert.equal(run.at(-1).nha, 'openai');
  assert.equal(run.at(-1).model, 'gpt-realtime-2.1-mini');
  assert.ok(Math.abs(run.at(-1).chi_phi_usd - 2 * (40 * 0.6 + 25 * 20 + 5 * 2.4) / 1e6) < 1e-9, `${run.at(-1).chi_phi_usd} ${run.at(-1).token_vao} ${run.at(-1).token_ra}`);
});

/** ElevenLabs giả: text-to-dialogue trả PCM chia mẩu; shared-voices và voices/add trả JSON. */
function taoElevenGia() {
  const goi = [];
  const f = async (url, o) => {
    goi.push({ url, method: o.method, khoa: o.headers['xi-api-key'], than: o.body ? JSON.parse(o.body) : null });
    if (url.includes('/v1/shared-voices')) {
      return Response.json({ voices: [{ voice_id: 'VnGiongNu0001', public_owner_id: 'owner1', name: 'Lan Hà Nội', gender: 'female', accent: 'northern', preview_url: 'https://x/lan.mp3' }] });
    }
    if (url.includes('/v1/voices/add/')) return Response.json({ voice_id: 'VnGiongNuTk01' });
    const pcm = Buffer.alloc(48000);
    return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(pcm.subarray(0, 777))); c.enqueue(new Uint8Array(pcm.subarray(777))); c.close(); } }), { status: 200 });
  };
  return { f, goi };
}

test('ElevenLabs: Text-to-Dialogue eleven_v4 tiếng Việt PCM 24 kHz, cả hội thoại một lần, tính tiền theo ký tự', async (t) => {
  const g = taoElevenGia();
  docEleven.datFetch(g.f);
  datKhoa(t, 'ELEVENLABS_API_KEY', 'el-thu-5678');
  tts.datNhaDoc('elevenlabs');
  assert.equal(tts.modelMacDinh(), 'eleven_v4');
  const manh = [];
  const kq = await tts.docHoiThoai({ luot: [{ nguoi: 'Mai', chu: 'Chào cả nhà' }, { nguoi: 'Tung', chu: 'Chào Mai' }], giong: { Mai: 'VnGiongNu0001', Tung: 'VnGiongNam001' }, khiAm: (b) => manh.push(b) });
  assert.equal(g.goi.length, 1);
  const lan = g.goi[0];
  assert.equal(lan.url, 'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=pcm_24000');
  assert.equal(lan.khoa, 'el-thu-5678');
  assert.deepEqual(lan.than, { inputs: [{ text: 'Chào cả nhà', voice_id: 'VnGiongNu0001' }, { text: 'Chào Mai', voice_id: 'VnGiongNam001' }], model_id: 'eleven_v4', language_code: 'vi' });
  assert.ok(manh.every((m) => m.length % 2 === 0));
  assert.equal(kq.giay, 1);
  assert.deepEqual(kq.token, { ky_tu: 19 });
  assert.equal(kq.model, 'eleven_v4');
  // Dài hơn 2.000 ký tự thì chia lần.
  assert.equal(docEleven.chiaLan([{ text: 'a'.repeat(1500), voice_id: 'x' }, { text: 'b'.repeat(800), voice_id: 'x' }]).length, 2);
  // Chưa chọn giọng → báo chưa chọn; chưa có khóa → CHUA_CO_KHOA, không tự đổi nhà.
  await assert.rejects(tts.docChu({ chu: 'thử', giong: 'x', model: 'eleven_v4' }).then(() => tts.docHoiThoai({ luot: [{ nguoi: 'A', chu: 'thử' }], giong: {} })), (e) => e.ma === 'CHUA_CO_GIONG');
  delete process.env.ELEVENLABS_API_KEY;
  await assert.rejects(tts.docChu({ chu: 'thử', giong: 'VnGiongNu0001' }), (e) => e.ma === 'CHUA_CO_KHOA' && e.nha === 'elevenlabs');
});

test('ElevenLabs: tìm giọng tiếng Việt, "Dùng" → thêm vào tài khoản, lưu cho nhân vật; Mai lưu cả vào giọng của Mai', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const g = taoElevenGia();
  docEleven.datFetch(g.f);
  datKhoa(t, 'ELEVENLABS_API_KEY', 'el-thu-5678');
  const ds = await docEleven.dsGiong({ gioi: 'nu' });
  assert.match(g.goi[0].url, /\/v1\/shared-voices\?language=vi.*gender=female/);
  assert.deepEqual(ds[0], { voice_id: 'VnGiongNu0001', owner_id: 'owner1', ten: 'Lan Hà Nội', gioi: 'nu', giong_vung: 'northern', mo_ta: '', nghe_thu: 'https://x/lan.mp3' });
  const id = await docEleven.themGiong({ ownerId: 'owner1', voiceId: 'VnGiongNu0001', ten: 'Lan Hà Nội' });
  assert.equal(g.goi[1].url, 'https://api.elevenlabs.io/v1/voices/add/owner1/VnGiongNu0001');
  assert.equal(id, 'VnGiongNuTk01');
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  doiAi.datGiongEleven(0, id);
  doiAi.datGiongEleven(1, 'VnGiongNam001');
  assert.deepEqual(doiAi.nhanVat().slice(0, 2).map((n) => n.giong_eleven), ['VnGiongNuTk01', 'VnGiongNam001']);
  assert.equal(caiDat.mieng().giong.elevenlabs, 'VnGiongNuTk01');
  // Lưu đội AI (gõ tên, nét riêng) không làm mất giọng ElevenLabs.
  doiAi.luuNhanVat(doiAi.nhanVat());
  assert.equal(doiAi.nhanVat()[1].giong_eleven, 'VnGiongNam001');
  tts.datNhaDoc('elevenlabs');
  const lc = require('../server/doi-ai/phong-thu').cacLuaChon('x', doiAi.nhanVat());
  assert.equal(lc[0].model, 'eleven_v4');
  assert.equal([...lc[0].giong.values()][0], 'VnGiongNuTk01');
});

test('không còn chỗ nào dùng máy đọc cũ của OpenAI (trừ bảng giá ghi ngày tắt)', () => {
  const cu = ['gpt', '4o', 'mini', 'tts'].join('-');
  const goc = path.join(__dirname, '..');
  const ra = [];
  const quet = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') quet(p); continue; }
      if (!/\.(js|json|html|css)$/.test(e.name) || p.endsWith(path.join('cau-hinh', 'gia-model.json'))) continue;
      if (fs.readFileSync(p, 'utf8').includes(cu)) ra.push(path.relative(goc, p));
    }
  };
  for (const d of ['server', 'public', 'test']) quet(path.join(goc, d));
  assert.deepEqual(ra, []);
});
