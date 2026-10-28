'use strict';

/**
 * Giọng riêng của Mai (SPEC.md bản 2.5, F-38): Gemini 3.8 TTS và Voices API qua fetch giả — không gọi Google thật.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { moPhanMem } = require('./ho-tro');
const tts = require('../server/agent/nha-cung-cap/tts');
// Các bài này thử máy đọc Google (còn làm được khi chọn "gemini" ở mac-dinh.json doc_giong); máy OpenAI thử ở doc-giong-openai.test.js.
tts.datNhaDoc('gemini');

/** WAV im lặng 24 kHz một kênh dài `giay` giây. */
function wav(giay, tanSo = 24000) {
  return tts.bocWav(Buffer.alloc(Math.round(tanSo * giay) * 2), tanSo);
}

/** Google giả: ghi lại mọi lần gọi, trả đúng dạng đã thấy khi gọi thật ngày 24/9/2026. */
function taoGoogleGia() {
  const goi = [];
  const tuyChon = { tuChoiDongY: false, loiDoc: null };
  let dem = 0;
  const f = async (url, o = {}) => {
    const u = new URL(url);
    const than = o.body ? JSON.parse(o.body) : null;
    goi.push({ method: o.method || 'GET', duong: u.pathname, q: Object.fromEntries(u.searchParams), than, khoa: o.headers?.['x-goog-api-key'] });
    const tra = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname.endsWith('/interactions')) {
      if (tuyChon.loiDoc) return tra({ error: { code: tuyChon.loiDoc, message: 'Resource exhausted' } }, tuyChon.loiDoc);
      return tra({
        status: 'completed',
        usage: { total_input_tokens: 20, total_output_tokens: 31 },
        steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wav(1).toString('base64') }] }],
      });
    }
    if (u.pathname.endsWith('/voices') && o.method === 'POST') {
      if (than.voice.type === 'replicated' && tuyChon.tuChoiDongY) {
        return tra({ error: { code: 400, message: 'Consent audio does not match the reference speaker.' } }, 400);
      }
      dem += 1;
      return tra({
        id: `voice_thu${dem}`, model: 'models/gemini-3.8-flash-tts', type: than.voice.type, expire_time: '2027-09-24T02:38:57Z',
        sample_audio: { mime_type: 'audio/wav', data: wav(2).toString('base64') },
        usage: { total_input_tokens: 200, total_output_tokens: 900, total_thought_tokens: 800 },
      });
    }
    if (u.pathname.endsWith('/voices')) {
      return tra({
        voices: [
          { id: 'voice_cua_toi', type: 'prompted', display_name: 'Giọng riêng', gender: 'female' },
          { id: 'vi-vn-advisor-1', type: 'prebuilt', display_name: 'Authoritative Advisor 1', language_code: 'vi-VN', gender: 'female',
            pitch: 'medium', persona: 'High-Trust Advisor', description: '33-year-old Lawyer from Vietnam.' },
          { id: 'vi-vn-advisor-2', type: 'prebuilt', display_name: 'Authoritative Advisor 2', language_code: 'vi-VN', gender: 'male', pitch: 'low' },
        ],
        next_page_token: 'trang2',
      });
    }
    if (o.method === 'DELETE') return tra({});
    return tra({ error: { code: 404, message: 'not found' } }, 404);
  };
  return { f, goi, tuyChon };
}

test('tệp WAV: bọc rồi tách lại đúng PCM, tần số, số giây', () => {
  const pcm = Buffer.alloc(48000);
  pcm.writeInt16LE(1234, 0);
  const w = tts.bocWav(pcm, 24000);
  const t = tts.tachWav(w);
  assert.equal(t.tanSo, 24000);
  assert.equal(t.pcm.length, 48000);
  assert.equal(t.pcm.readInt16LE(0), 1234);
  assert.equal(tts.soGiay(w), 1);
  // Không có đầu RIFF (Google trả PCM thô khi phát dần) → coi là PCM 24 kHz.
  assert.equal(tts.tachWav(pcm).tanSo, 24000);
});

test('Gemini TTS qua fetch giả: đúng dạng yêu cầu, đọc được tiếng', async (t) => {
  const g = taoGoogleGia();
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  t.after(() => { tts.datFetch(null); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });

  await t.test('đọc một câu: model Flash-Lite mặc định, giọng, phong cách; tiếng lấy ở steps[].content[]', async () => {
    const kq = await tts.docChu({ chu: 'Dạ em chào anh', giong: 'voice_abc', phongCach: 'ấm áp' });
    const lan = g.goi.at(-1);
    assert.equal(lan.duong, '/v1beta/interactions');
    assert.equal(lan.khoa, 'khoa-thu-9876');
    assert.equal(lan.than.model, 'gemini-3.8-flash-lite-tts');
    assert.deepEqual(lan.than.generation_config.speech_config, [{ voice: 'voice_abc' }]);
    assert.equal(lan.than.input[0].content[0].annotations[0].style, 'ấm áp');
    assert.equal(kq.giay, 1);
    assert.equal(kq.tanSo, 24000);
    assert.deepEqual(kq.token, { vao: 20, ra: 31 });
  });

  await t.test('hai người nói: kiểu conversational, mỗi người một giọng', async () => {
    await tts.docHoiThoai({ luot: [{ nguoi: 'NguoiDan', chu: 'Chào bạn' }, { nguoi: 'KhachMoi', chu: 'Dạ chào anh' }],
      giong: { NguoiDan: 'vi-vn-advisor-2', KhachMoi: 'vi-vn-advisor-4' } });
    const sc = g.goi.at(-1).than.generation_config.speech_config;
    assert.equal(sc.mode, 'conversational');
    assert.deepEqual(sc.speakers.map((s) => s.voice), ['vi-vn-advisor-2', 'vi-vn-advisor-4']);
    assert.equal(g.goi.at(-1).than.input[0].content[1].annotations[0].speaker, 'KhachMoi');
  });

  await t.test('tạo giọng theo câu tả: KHÔNG ghi voice.model (ghi Flash-Lite thì Google lỗi 400), có tiếng Việt', async () => {
    const kq = await tts.taoGiongTa({ ten: 'Mai thử', gioi: 'female', moTa: 'Một người phụ nữ khoảng 28 tuổi.' });
    const v = g.goi.at(-1).than.voice;
    assert.equal(v.model, undefined);
    assert.equal(v.type, 'prompted');
    assert.equal(v.language_code, 'vi-VN');
    assert.equal(g.goi.at(-1).than.store, true);
    assert.match(kq.id, /^voice_thu/);
    assert.equal(kq.hetHan, '2027-09-24T02:38:57Z');
    assert.equal(tts.soGiay(kq.mau), 2);
    assert.deepEqual(kq.token, { vao: 200, ra: 1700 }, 'token suy nghĩ tính như token ra');
  });

  await t.test('kho giọng: lọc tiếng Việt, giới tính; bỏ giọng tự tạo khỏi danh sách kho', async () => {
    const kq = await tts.dsGiongKho({ gioi: 'nu', tim: 'warm' });
    const q = g.goi.at(-1).q;
    assert.equal(q.language_code, 'vi-VN');
    assert.equal(q.gender, 'female');
    assert.equal(q.search, 'warm');
    assert.deepEqual(kq.giong.map((x) => x.id), ['vi-vn-advisor-1', 'vi-vn-advisor-2']);
    assert.equal(kq.giong[0].gioi, 'nu');
    assert.equal(kq.trangSau, 'trang2');
  });

  await t.test('Google giới hạn lượt → câu dễ hiểu', async () => {
    g.tuyChon.loiDoc = 429;
    await assert.rejects(() => tts.docChu({ chu: 'a', giong: 'x' }), /giới hạn lượt gọi/);
    g.tuyChon.loiDoc = null;
  });
});

test('API giọng riêng của Mai (fetch giả)', async (t) => {
  const g = taoGoogleGia();
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  const pm = await moPhanMem();
  t.after(async () => {
    await pm.dong();
    tts.datFetch(null);
    if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu;
  });
  const { goi } = pm;
  const giongMai = require('../server/nghiep-vu/giong-mai');

  await t.test('ban đầu: chưa có giọng; có lựa chọn tả giọng, câu đồng ý tiếng Việt, hai model đọc', async () => {
    const { than } = await goi('GET', '/api/giong-mai');
    assert.deepEqual(than.giong, []);
    assert.equal(than.dang_dung.id, null);
    assert.equal(than.dang_dung.model, 'gemini-3.8-flash-lite-tts');
    assert.deepEqual(than.lua_chon.gioi_tinh.map((x) => x.id), ['nu', 'nam']);
    assert.match(than.lua_chon.cau_dong_y, /^Tôi là chủ sở hữu giọng nói này/);
    assert.equal(than.lua_chon.model.length, 2);
  });

  await t.test('câu tả ghép từ lựa chọn; lựa chọn lạ lấy mặc định; mô tả thêm nối sau', () => {
    const ta = giongMai.taoCauTa({ gioi_tinh: 'nu', tuoi: '25-35', vung: 'bac', chat_giong: 'am_ap' }, 'hay cười.');
    assert.equal(ta.gioi, 'female');
    assert.match(ta.cau, /^Một người phụ nữ khoảng 28 tuổi, giọng miền Bắc chuẩn Hà Nội, chất giọng ấm áp/);
    assert.match(ta.cau, /hay cười\.$/);
    assert.equal(giongMai.taoCauTa({ gioi_tinh: 'khong-co' }).chon.gioi_tinh, 'nu');
    assert.equal(giongMai.taoCauTa({ gioi_tinh: 'nam' }).gioi, 'male');
  });

  let idTa;
  await t.test('tạo giọng theo lựa chọn → lưu, có bản nghe thử, giọng đầu tiên thành giọng Mai, ghi chi phí', async () => {
    const r = await goi('POST', '/api/giong-mai/ta', { lua_chon: { gioi_tinh: 'nu', tuoi: '25-35', vung: 'bac', chat_giong: 'am_ap' }, mo_ta_them: '' });
    assert.equal(r.ma, 201);
    idTa = r.than.giong.id;
    assert.equal(r.than.giong.loai, 'ta');
    assert.equal(r.than.giong.het_han, '2027-09-24T02:38:57Z');
    assert.equal(r.than.giong.co_mau, true);
    assert.ok(fs.existsSync(path.join(pm.thuMuc, 'giong', `mai-${idTa}.wav`)));
    assert.ok(r.than.chi_phi_usd > 0);
    const ds = await goi('GET', '/api/giong-mai');
    assert.equal(ds.than.dang_dung.id, idTa);
    const { csdl } = require('../server/db/ket-noi');
    const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'giong_mai'").get();
    assert.equal(run.model, 'gemini-3.8-flash-tts');
    assert.equal(run.token_ra, 1700);
  });

  await t.test('nghe thử: có tệp sẵn thì trả luôn, không gọi Google', async () => {
    const truoc = g.goi.length;
    const r = await fetch(`${pm.goc}/api/giong-mai/${idTa}/nghe`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/wav');
    assert.equal(tts.soGiay(Buffer.from(await r.arrayBuffer())), 2);
    assert.equal(g.goi.length, truoc);
  });

  await t.test('kho: danh sách tiếng Việt đánh dấu giọng đã lưu; lưu một giọng kho không tốn tiền', async () => {
    const k = await goi('GET', '/api/giong-mai/kho?gioi=nam');
    assert.equal(k.than.giong.length, 2);
    assert.equal(k.than.trang_sau, 'trang2');
    const luu = await goi('POST', '/api/giong-mai/kho', { id: 'vi-vn-advisor-2', ten: 'Authoritative Advisor 2', gioi: 'nam' });
    assert.equal(luu.ma, 201);
    assert.equal(luu.than.giong.loai, 'kho');
    assert.equal(luu.than.giong.het_han, null);
    assert.equal((await goi('GET', '/api/giong-mai/kho')).than.giong.find((x) => x.id === 'vi-vn-advisor-2').da_luu, true);
    assert.equal((await goi('POST', '/api/giong-mai/kho', { id: 'a b c' })).than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('đổi giọng đang dùng và model đọc; giọng không có trong danh sách → 404', async () => {
    const r = await goi('PUT', '/api/giong-mai/dang-dung', { id: 'vi-vn-advisor-2', model: 'gemini-3.8-flash-tts' });
    assert.deepEqual(r.than.dang_dung, { id: 'vi-vn-advisor-2', model: 'gemini-3.8-flash-tts' });
    assert.equal((await goi('PUT', '/api/giong-mai/dang-dung', { id: 'khong-co' })).ma, 404);
    assert.equal((await goi('PUT', '/api/giong-mai/dang-dung', { model: 'gpt-4o' })).than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('Mai đọc thử: đọc bằng giọng và model đang dùng, trả tệp WAV', async () => {
    const r = await fetch(`${pm.goc}/api/giong-mai/doc`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chu: 'Dạ em chào cả nhà' }) });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/wav');
    const lan = g.goi.at(-1);
    assert.equal(lan.than.model, 'gemini-3.8-flash-tts');
    assert.deepEqual(lan.than.generation_config.speech_config, [{ voice: 'vi-vn-advisor-2' }]);
    assert.equal((await goi('POST', '/api/giong-mai/doc', { chu: '   ' })).than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('nhân bản: ghi âm quá ngắn bị từ chối trước khi gọi Google', async () => {
    const truoc = g.goi.length;
    const r = await goi('POST', '/api/giong-mai/nhan-ban', { ten: 'Chị Hoa', am_mau: wav(4).toString('base64'), am_dong_y: wav(6).toString('base64') });
    assert.equal(r.than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
    assert.match(r.than.loi.thong_diep, /ngắn quá/);
    assert.equal(g.goi.length, truoc);
    assert.match((await goi('POST', '/api/giong-mai/nhan-ban', { am_mau: '', am_dong_y: '' })).than.loi.thong_diep, /tên người/);
  });

  await t.test('nhân bản: thân yêu cầu hơn 1 MB vẫn nhận; gửi đoạn mẫu + câu đồng ý đúng dạng Google cần', async () => {
    const mau = wav(20).toString('base64');
    assert.ok(mau.length > 1024 * 1024);
    const r = await goi('POST', '/api/giong-mai/nhan-ban', { ten: 'Chị Hoa', am_mau: mau, am_dong_y: wav(7).toString('base64') });
    assert.equal(r.ma, 201, JSON.stringify(r.than));
    assert.equal(r.than.giong.loai, 'nhan_ban');
    assert.equal(r.than.giong.ten, 'Giọng Chị Hoa');
    const v = g.goi.at(-1).than.voice;
    assert.equal(v.type, 'replicated');
    assert.equal(v.model, undefined);
    assert.equal(v.replicated.source_audio.mime_type, 'audio/wav');
    assert.ok(v.replicated.consent_audio.data.length > 0);
  });

  await t.test('nhân bản: Google báo câu đồng ý không khớp → GIONG_LOI, câu dễ hiểu', async () => {
    g.tuyChon.tuChoiDongY = true;
    const r = await goi('POST', '/api/giong-mai/nhan-ban', { ten: 'Anh Nam', am_mau: wav(12).toString('base64'), am_dong_y: wav(7).toString('base64') });
    g.tuyChon.tuChoiDongY = false;
    assert.equal(r.than.loi.ma, 'GIONG_LOI');
    assert.match(r.than.loi.thong_diep, /Câu đồng ý không khớp/);
  });

  await t.test('xóa: giọng tự tạo xóa cả ở Google; giọng kho chỉ xóa khỏi danh sách; xóa giọng đang dùng thì bỏ chọn', async () => {
    const r = await goi('DELETE', `/api/giong-mai/${idTa}`);
    assert.equal(r.ma, 200);
    assert.ok(g.goi.some((x) => x.method === 'DELETE' && x.duong.endsWith(`/voices/${idTa}`)));
    assert.ok(!fs.existsSync(path.join(pm.thuMuc, 'giong', `mai-${idTa}.wav`)));
    const truoc = g.goi.length;
    const r2 = await goi('DELETE', '/api/giong-mai/vi-vn-advisor-2');
    assert.equal(g.goi.length, truoc, 'giọng kho không gọi Google');
    assert.equal(r2.than.dang_dung.id, null);
    assert.equal((await goi('DELETE', '/api/giong-mai/khong-co')).ma, 404);
  });
});
