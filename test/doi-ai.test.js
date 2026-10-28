'use strict';

/**
 * Đội AI dẫn (SPEC.md bản 2.9, F-44, F-45): dàn nhân vật, đọc lời nhắc dạng thoại, phòng thu (soát số, chia khúc
 * 2 giọng, dùng lại tiếng đã làm), đọc kiểu phát dần. Google giả qua fetch — không gọi mạng, không tốn tiền.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const tts = require('../server/agent/nha-cung-cap/tts');
// Các bài này thử máy đọc Google (còn làm được khi chọn "gemini" ở mac-dinh.json doc_giong); máy OpenAI thử ở doc-giong-openai.test.js.
tts.datNhaDoc('gemini');

/** PCM im lặng 24 kHz dài `giay` giây. */
const pcm = (giay) => Buffer.alloc(Math.round(24000 * giay) * 2);

/** Google giả: đọc thường trả WAV 1 giây; phát dần trả 3 mẩu SSE. Ghi lại mọi lần gọi. */
function taoGoogleGia() {
  const goi = [];
  const tuyChon = { loi503: 0, loiTaoGiong: null };
  let demGiong = 0;
  const f = async (url, o = {}) => {
    const u = new URL(url);
    const than = o.body ? JSON.parse(o.body) : null;
    goi.push({ duong: u.pathname, sse: u.searchParams.get('alt') === 'sse', than });
    if (u.pathname.endsWith('/voices') && o.method === 'POST') {
      if (tuyChon.loiTaoGiong && than.voice.display_name.includes(tuyChon.loiTaoGiong)) {
        return new Response(JSON.stringify({ error: { code: 500, message: 'internal' } }), { status: 500 });
      }
      demGiong += 1;
      return new Response(JSON.stringify({ id: `voice_bac${demGiong}`, expire_time: '2027-09-24T00:00:00Z', usage: { total_input_tokens: 200, total_output_tokens: 900 } }),
        { headers: { 'Content-Type': 'application/json' } });
    }
    if (tuyChon.loi503 > 0) {
      tuyChon.loi503 -= 1;
      return new Response(JSON.stringify({ error: { code: 503, message: 'high demand' } }), { status: 503 });
    }
    const usage = { total_input_tokens: 40, total_output_tokens: 400 };
    if (u.searchParams.get('alt') === 'sse') {
      const manh = [pcm(0.2), pcm(0.3), pcm(0.5)].map((b) => `data: ${JSON.stringify({ event_type: 'step.delta', delta: { type: 'audio', data: b.toString('base64') } })}\n\n`);
      return new Response(`data: {"event_type":"step.start"}\n\n${manh.join('')}data: ${JSON.stringify({ event_type: 'interaction.complete', interaction: { usage } })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } });
    }
    return new Response(JSON.stringify({ status: 'completed', usage, steps: [{ content: [{ type: 'audio', mime_type: 'audio/wav', data: tts.bocWav(pcm(1)).toString('base64') }] }] }),
      { headers: { 'Content-Type': 'application/json' } });
  };
  return { f, goi, tuyChon };
}

test('đọc lời nhắc dạng thoại của đội AI', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const ten = ['Mai', 'Tùng', 'Hạnh'];
  const kq = doiAi.tachThoai([
    '[Hỏi nhanh – đáp gọn]',
    'Tùng: (tò mò) Mai ơi, áo số 12 giá nhiêu?',
    'Mai: (hào hứng, rộn ràng) Hai trăm tám mươi chín nghìn nè anh!',
    'còn màu thì có Đen với Trắng',
    'hạnh: Cả nhà ưng thì chốt 12 kèm màu, size nha.',
    '- Kiểm lại: thẻ chưa ghi giá gốc',
    'Người dẫn: chen một câu nếu muốn',
  ].join('\n'), ten);
  assert.equal(kq.tietMuc, 'Hỏi nhanh – đáp gọn');
  assert.deepEqual(kq.luot, [
    { ai: 'Tùng', cachNoi: 'tò mò', loi: 'Mai ơi, áo số 12 giá nhiêu?' },
    { ai: 'Mai', cachNoi: 'hào hứng, rộn ràng', loi: 'Hai trăm tám mươi chín nghìn nè anh! còn màu thì có Đen với Trắng' },
    { ai: 'Hạnh', cachNoi: '', loi: 'Cả nhà ưng thì chốt 12 kèm màu, size nha.' },
  ], 'dòng không nhãn nối vào lượt đang nói; tên không phân biệt hoa thường');
  assert.deepEqual(kq.luuY, ['Kiểm lại: thẻ chưa ghi giá gốc']);
  assert.deepEqual(kq.nguoiDan, ['chen một câu nếu muốn']);
  assert.equal(kq.cho, null);

  const dv = doiAi.tachThoai('[Đố vui]\nTùng: Đố cả nhà sơ mi linen vừa rồi là áo số mấy?\nMai: (tinh nghịch) Bình luận đáp án nha!\n[Chờ bình luận 20 giây]\nHạnh: Đáp án là áo số 12!\nĐáp án: 12; số 12; áo 12', ten);
  assert.deepEqual(dv.cho, { sau: 2, giay: 20 });
  assert.deepEqual(dv.dapAn, ['12', 'số 12', 'áo 12']);
  assert.equal(dv.luot.length, 3);
  assert.equal(doiAi.tachThoai('Tùng:\n[Chờ bình luận 90 giây]\nMai: Đáp án là A', ten).cho.giay, 60, 'chờ tối đa 60 giây');
  assert.equal(doiAi.tachThoai('Tùng: (vui)\n[Chờ bình luận]\nMai: A', ten).cho.sau, 0, 'lượt chỉ có gợi ý thì bỏ, chỗ chờ giữ đúng vị trí');

  assert.equal(doiAi.laThoaiDoi('Người dẫn:\n- Chào cả nhà\nMai: Dạ em chào cả nhà!', ten), false, 'kịch bản kiểu Mai không phải thoại đội');
  assert.equal(doiAi.laThoaiDoi('Mai: Chào!\nTùng: Chào cả nhà!', ten), true);
  assert.equal(doiAi.laKichBanDoi({ doan: [{ loi_nhac: 'Mai: A\nTùng: B' }, { loi_nhac: 'Hạnh: C' }, { loi_nhac: '' }] }, ten), true);
});

test('dàn nhân vật: mặc định 3 người có nam có nữ; lưu, kiểm tên và giọng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const mac = doiAi.nhanVat();
  assert.deepEqual(mac.map((n) => n.ten), ['Mai', 'Tùng', 'Hạnh']);
  assert.equal(new Set(mac.map((n) => n.giong)).size, 3, 'ba giọng khác nhau');
  assert.ok(mac.some((n) => n.gioi === 'nam') && mac.some((n) => n.gioi === 'nu'));

  const moi = doiAi.luuNhanVat([...mac, { ten: 'Dũng', giong: 'vi-vn-tutor-6', gioi: 'nam', net: 'hài hước' }]);
  assert.deepEqual(moi.map((n) => n.ten), ['Mai', 'Tùng', 'Hạnh', 'Dũng'], 'thêm nhân vật thứ tư');
  caiDat.datTenAi('Lan - Trợ lý bán hàng');
  assert.equal(doiAi.nhanVat()[0].ten, 'Lan', 'nhân vật đầu mang Tên AI của Cài đặt');

  const loi = (ds, re) => assert.throws(() => doiAi.luuNhanVat(ds), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE' && re.test(e.message));
  loi([mac[0]], /từ 2 tới 6/);
  loi([mac[0], { ...mac[1], ten: 'lan' }], /hai nhân vật cùng tên/i);
  loi([mac[0], { ...mac[1], ten: 'Kiểm lại' }], /đã dùng trong lời nhắc/);
  loi([mac[0], { ...mac[1], ten: 'Tùng: A' }], /chỉ gồm chữ cái/);
  loi([mac[0], { ...mac[1], giong: 'giong la; xoa' }], /không đúng dạng giọng của Google/);
  loi([mac[0], { ...mac[1], giong: '' }], /Chưa chọn giọng/);
  // Giọng Bắc tả bằng lời (#50: giọng kho nghe ra giọng Nam) dùng được trong đội.
  assert.equal(doiAi.luuNhanVat([mac[0], { ...mac[1], giong: 'voice_6mhdefi2979u' }])[1].giong, 'voice_6mhdefi2979u');
  assert.deepEqual(doiAi.canGiongBac(), ['Lan'], 'nhân vật còn dùng giọng kho');
  assert.match(doiAi.cauTaGiong({ gioi: 'nam', net: 'vui tính, hay trêu' }, 1), /^Một người đàn ông khoảng 30 tuổi, giọng nam trầm, ấm, giọng miền Bắc chuẩn Hà Nội, vui tính, hay trêu/);
});

test('tạo giọng Bắc (#50): nhân vật còn dùng giọng kho được tạo giọng theo câu tả; nhân vật chính dùng giọng riêng của Mai', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const g = taoGoogleGia();
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  t.after(() => { tts.datFetch(null); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const giongMai = require('../server/nghiep-vu/giong-mai');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');

  giongMai.them({ id: 'voice_maibac', ten: 'Mai · giọng Bắc', loai: 'ta', gioi: 'nu' });
  giongMai.datDangDung({ id: 'voice_maibac' });

  // Google lỗi với Hạnh: Tùng vẫn được lưu, báo rõ ai chưa có giọng.
  g.tuyChon.loiTaoGiong = 'Hạnh';
  await assert.rejects(doiAi.taoGiongBac(), (e) => e.ma === 'AI_LOI' && /Hạnh/.test(e.message) && !/Tùng/.test(e.message));
  assert.deepEqual(doiAi.canGiongBac(), ['Hạnh'], 'Mai dùng giọng riêng đã có, Tùng đã có giọng Bắc');

  g.tuyChon.loiTaoGiong = null;
  const kq = await doiAi.taoGiongBac();
  assert.equal(kq.taoMoi, 1, 'chỉ tạo phần còn thiếu');
  assert.deepEqual(kq.nhanVat.map((n) => n.giong), ['voice_maibac', 'voice_bac1', 'voice_bac2']);
  assert.deepEqual(doiAi.canGiongBac(), []);
  const tao = g.goi.filter((x) => x.duong.endsWith('/voices')).map((x) => x.than.voice);
  assert.equal(tao.length, 3, 'Tùng 1 lần, Hạnh lỗi 1 lần rồi tạo lại 1 lần');
  assert.ok(tao.every((v) => v.type === 'prompted' && v.language_code === 'vi-VN' && /giọng miền Bắc chuẩn Hà Nội/.test(v.prompted.input)));
  assert.equal(tao.find((v) => v.display_name.includes('Tùng')).gender, 'male');
  assert.equal(tao.find((v) => v.display_name.includes('Hạnh')).gender, 'female');
  assert.ok(giongMai.danhSach().giong.some((x) => x.id === 'voice_bac1' && x.ten === 'Đội AI · Tùng · giọng Bắc' && x.gioi === 'nam'),
    'giọng mới hiện trong danh sách giọng (xem, nghe, xóa được)');
  const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'doi_ai'").all();
  assert.equal(run.length, 2);
  assert.ok(run.every((r) => r.chi_phi_usd > 0));
  assert.equal((await doiAi.taoGiongBac()).taoMoi, 0, 'đủ giọng rồi thì không tạo thêm');

  caiDat.datKhanCap(true);
  doiAi.luuNhanVat([...doiAi.nhanVat(), { ten: 'Dũng', giong: 'vi-vn-tutor-6', gioi: 'nam', net: 'hài hước' }]);
  await assert.rejects(doiAi.taoGiongBac(), (e) => e.ma === 'KHAN_CAP_DANG_BAT');
  caiDat.datKhanCap(false);
});

test('phòng thu: soát số, chia khúc tối đa 2 giọng, dùng lại tiếng đã làm, ghi chi phí', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const g = taoGoogleGia();
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  t.after(() => { tts.datFetch(null); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });
  const phongThu = require('../server/doi-ai/phong-thu');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  phongThu.datThuLaiMs(5);
  t.after(() => phongThu.datThuLaiMs(1500));

  // Tiền viết tắt đọc ra lời rõ (buổi tập 24/9/2026: "400k" bị đọc "bốn trăm ca").
  assert.equal(phongThu.docRo('Áo 289k, quần 387,5K; set 1tr2 (1,2 triệu); đầm 1tr – 2tr; thuê váy 150.000đ/ngày; giữ hàng 289k/24h; áo 12 trắng; 2k2'),
    'Áo 289 nghìn, quần 387,5 nghìn; set 1 triệu 2 (1 triệu 2); đầm 1 triệu – 2 triệu; thuê váy 150.000đ một ngày; giữ hàng 289 nghìn cho 24 giờ; áo 12 trắng; 2k2');
  assert.equal(phongThu.docRo('Sơ mi là 289.000 VND, quần jean 350.000VNĐ.'), 'Sơ mi là 289.000 đồng, quần jean 350.000 đồng.');

  // Chia khúc: liền nhau tối đa 2 nhân vật.
  const L = (ai, loi = 'câu') => ({ ai, cachNoi: '', loi });
  assert.deepEqual(phongThu.chiaKhuc([L('Mai'), L('Tùng'), L('Mai'), L('Hạnh'), L('Mai'), L('Tùng')]).map((k) => k.map((l) => l.ai)),
    [['Mai', 'Tùng', 'Mai'], ['Hạnh', 'Mai'], ['Tùng']]);

  const a12 = taoSanPhamMau();
  const doan = {
    san_pham_id: a12.san_pham.id,
    loi_nhac: [
      '[Hỏi nhanh – đáp gọn]',
      'Tùng: (tò mò) Sơ mi linen này giá bao nhiêu hả Mai?',
      'Mai: (hào hứng) 289.000 đồng thôi nè anh!',
      'Hạnh: (ấm) Vải linen mát, thấm hút luôn đó cả nhà.',
      'Tùng: (trêu) Vậy chắc giảm còn 450 nghìn hả? <laugh>',
      'Mai: Không đâu anh, đúng giá trên thẻ thôi.',
    ].join('\n'),
  };
  const kq = await phongThu.lamTiengDoan({ doan, viec: 'Đội AI · thử' });
  assert.deepEqual(kq.bo.map((b) => [b.ai, b.so]), [['Tùng', ['450']]], 'câu có số không thấy trong thẻ sản phẩm thì không đọc');
  assert.equal(kq.phan.length, 1);
  assert.equal(kq.phan[0].tuKho, false);
  // 4 lượt còn lại: [Tùng, Mai] rồi [Hạnh, Mai] — Hạnh vào là khúc mới (mỗi khúc tối đa 2 giọng).
  const doc = g.goi.filter((x) => x.duong.endsWith('/interactions'));
  assert.equal(doc.length, 2);
  const k1 = doc[0].than;
  assert.equal(k1.model, 'gemini-3.8-flash-tts');
  assert.equal(k1.generation_config.speech_config.mode, 'conversational');
  assert.deepEqual(k1.generation_config.speech_config.speakers, [{ speaker: 'Tung', voice: 'vi-vn-advisor-5' }, { speaker: 'Mai', voice: 'vi-vn-advisor-6' }]);
  assert.deepEqual(k1.input[0].content.map((c) => [c.annotations[0].speaker, c.annotations[0].style, c.text]),
    [['Tung', 'tò mò', 'Sơ mi linen này giá bao nhiêu hả Mai?'], ['Mai', 'hào hứng', '289.000 đồng thôi nè anh!']]);
  assert.deepEqual(doc[1].than.generation_config.speech_config.speakers.map((s) => s.speaker), ['Hanh', 'Mai']);
  // 2 khúc 1 giây + 1 chỗ nghỉ 0,3 giây.
  assert.ok(Math.abs(kq.phan[0].giay - 2.3) < 0.01, `dài ${kq.phan[0].giay}`);
  const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'doi_ai'").get();
  assert.ok(run.chi_phi_usd > 0);
  assert.equal(run.token_ra, 800);
  assert.ok(phongThu.coSan(doan));

  // Một người nói liền mấy lượt → đọc một giọng.
  await phongThu.lamTiengLuot({ luot: [L('Hạnh', 'Cả nhà yên tâm.'), L('Hạnh', 'Không mất phí gì hết.')], viec: 'x' });
  assert.deepEqual(g.goi.at(-1).than.generation_config.speech_config, [{ voice: 'vi-vn-csagent-6' }], 'khúc một người thì đọc một giọng');
  const soGoi = g.goi.length;

  // Làm lại: dùng tiếng đã làm, không gọi Google.
  const lai = await phongThu.lamTiengDoan({ doan, viec: 'Đội AI · thử lại' });
  assert.equal(lai.phan[0].tuKho, true);
  assert.equal(lai.phan[0].id, kq.phan[0].id);
  assert.equal(g.goi.length, soGoi);
  assert.ok(phongThu.docTep(kq.phan[0].id).length > 44);
  assert.equal(phongThu.docTep('../../etc'), null);

  // "Dừng mọi thứ": không làm tiếng mới (tiếng đã có vẫn dùng được).
  caiDat.datKhanCap(true);
  await assert.rejects(phongThu.lamTiengDoan({ doan: { san_pham_id: a12.san_pham.id, loi_nhac: 'Mai: Chào!\nTùng: Chào cả nhà!' }, viec: 'x' }), (e) => e.ma === 'KHAN_CAP_DANG_BAT');
  assert.equal((await phongThu.lamTiengDoan({ doan, viec: 'x' })).phan[0].tuKho, true);
  caiDat.datKhanCap(false);

  // Đố vui: hai phần (hỏi, đáp), chỗ chờ ở giữa.
  const dv = await phongThu.lamTiengDoan({
    doan: { san_pham_id: null, loi_nhac: '[Đố vui]\nTùng: Đố cả nhà áo số 12 có màu trắng không?\n[Chờ bình luận 15 giây]\nMai: Có luôn!\nĐáp án: có' },
    viec: 'Đội AI · đố vui',
  });
  assert.equal(dv.phan.length, 2);
  assert.deepEqual(dv.cho, { giay: 15 });
  assert.deepEqual(dv.dapAn, ['có']);

  // Nhân vật không có trong đội → báo rõ.
  await assert.rejects(phongThu.lamTiengLuot({ luot: [L('Bình', 'chào')], viec: 'x' }), (e) => /Chưa có nhân vật Bình/.test(e.message));

  // Google quá tải (503) → thử lại, rồi được.
  g.tuyChon.loi503 = 2;
  const qt = await phongThu.lamTiengLuot({ luot: [L('Mai', 'Câu mới hoàn toàn.')], viec: 'x' });
  assert.equal(qt.tuKho, false);
});

test('đọc kiểu phát dần: từng mẩu tiếng tới ngay, đủ tiếng và chi phí', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const g = taoGoogleGia();
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  t.after(() => { tts.datFetch(null); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });
  const phongThu = require('../server/doi-ai/phong-thu');

  const manh = [];
  const kq = await phongThu.lamTiengLuot({
    luot: [{ ai: 'Tùng', cachNoi: 'vui', loi: 'Bạn Lan hỏi áo có size L không nè Mai!' }, { ai: 'Mai', cachNoi: '', loi: 'Dạ có luôn!' }],
    model: phongThu.MODEL_CHEN, viec: 'Đội AI · trả lời người xem', khiAm: (b) => manh.push(b.length),
  });
  assert.deepEqual(manh, [9600, 14400, 24000], 'ba mẩu tới lần lượt');
  assert.ok(g.goi[0].sse);
  assert.equal(g.goi[0].than.stream, true);
  assert.equal(g.goi[0].than.model, 'gemini-3.8-flash-lite-tts');
  assert.ok(Math.abs(kq.giay - 1) < 0.001);

  // Lần sau dùng lại: vẫn đưa tiếng qua khiAm một lần.
  const lai = [];
  const kq2 = await phongThu.lamTiengLuot({
    luot: [{ ai: 'Tùng', cachNoi: 'vui', loi: 'Bạn Lan hỏi áo có size L không nè Mai!' }, { ai: 'Mai', cachNoi: '', loi: 'Dạ có luôn!' }],
    model: phongThu.MODEL_CHEN, viec: 'x', khiAm: (b) => lai.push(b.length),
  });
  assert.equal(kq2.tuKho, true);
  assert.deepEqual(lai, [48000]);
});

test('máy đọc dự phòng (bản 2.10, #55): hai máy 3.8 hết lượt → đọc bằng gemini-3.1-flash-tts-preview, giọng có sẵn; giãn nhịp 8 lượt/phút', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const phongThu = require('../server/doi-ai/phong-thu');
  const g = taoGoogleGia();
  const hetLuot = new Set(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  const f = async (url, o = {}) => {
    const model = o.body ? JSON.parse(o.body).model : '';
    if (hetLuot.has(model)) {
      g.goi.push({ duong: new URL(url).pathname, than: JSON.parse(o.body), het: true });
      return new Response(JSON.stringify({ error: { code: 429, message: `Quota exceeded for metric: generate_requests_per_model_per_day, limit: 100, model: ${model}\nPlease retry in 7h0m0s.` } }), { status: 429 });
    }
    return g.f(url, o);
  };
  tts.datFetch(f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  phongThu.quenHetLuot();
  t.after(() => { tts.datFetch(null); phongThu.quenHetLuot(); phongThu.datNhipGoi({ toiDa: 8, cuaSoMs: 60000 }); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });

  // Giọng dự phòng gán theo nam nữ, không trùng.
  const doiAi = require('../server/nghiep-vu/doi-ai');
  assert.deepEqual([...phongThu.bangGiongDuPhong(doiAi.nhanVat()).values()], ['Zephyr', 'Puck', 'Sulafat']);

  const luot = [
    { ai: 'Mai', cachNoi: 'hào hứng', loi: 'Chào cả nhà! <laugh> Áo số 12 giá 289 nghìn.' },
    { ai: 'Tùng', cachNoi: 'vui', loi: 'Vải linen |ừ| mát lắm nè!' },
  ];
  const kq = await phongThu.lamTiengLuot({ luot, viec: 'thử dự phòng' });
  assert.equal(kq.model, 'gemini-3.1-flash-tts-preview');
  assert.equal(kq.tuKho, false);
  const doc = g.goi.filter((x) => !x.het && x.duong.endsWith('/interactions'));
  assert.ok(doc.length >= 1);
  const than = doc[0].than;
  assert.equal(than.model, 'gemini-3.1-flash-tts-preview');
  assert.ok(Array.isArray(than.generation_config.speech_config), 'máy 3.1: danh sách người nói, không có mode conversational');
  assert.deepEqual(than.generation_config.speech_config.map((x) => x.voice).sort(), ['Puck', 'Zephyr']);
  const chu = than.input[0].content.map((c) => c.text).join('\n');
  assert.ok(!than.input[0].content.some((c) => c.annotations), 'máy 3.1 không nhận chú thích (gợi ý cách nói)');
  assert.doesNotMatch(chu, /<laugh>|\|ừ\|/, 'bỏ thẻ tiếng, chen lời thành lượt riêng');
  assert.match(chu, /Mai: Chào cả nhà!/);
  assert.match(chu, /Tung: Vải linen/);
  const run = require('../server/db/ket-noi').csdl().prepare("SELECT model, chi_phi_usd FROM agent_run WHERE agent_id = 'doi_ai' ORDER BY rowid DESC LIMIT 1").get();
  assert.equal(run.model, 'gemini-3.1-flash-tts-preview');
  assert.ok(run.chi_phi_usd > 0, 'tính tiền theo giá máy 3.1');

  // Lần sau: dùng lại tiếng dự phòng đã làm, không gọi Google.
  const soGoi = g.goi.length;
  const lai = await phongThu.lamTiengLuot({ luot, viec: 'thử dự phòng' });
  assert.equal(lai.tuKho, true);
  assert.equal(g.goi.length, soGoi);

  // Giãn nhịp: quá toiDa lượt trong cửa sổ thì chờ.
  phongThu.quenHetLuot();
  hetLuot.clear();
  phongThu.datNhipGoi({ toiDa: 2, cuaSoMs: 300 });
  const tu = Date.now();
  for (let i = 0; i < 3; i += 1) await phongThu.lamTiengLuot({ luot: [{ ai: 'Mai', cachNoi: '', loi: `Câu thử ${i}.` }], viec: 'nhịp' });
  assert.ok(Date.now() - tu >= 250, `lượt thứ 3 phải chờ (${Date.now() - tu} ms)`);
});

test('máy đọc nói rõ chữ viết tắt (buổi tập 25/9/2026: "KCN" thành "ca-sê-nờ"): COD, KCN…', () => {
  const { docRo } = require('../server/doi-ai/phong-thu');
  assert.equal(docRo('Shop nhận COD, giao cả trong KCN Quế Võ 1'),
    'Shop nhận thanh toán khi nhận hàng, giao cả trong khu công nghiệp Quế Võ 1');
  assert.equal(docRo('Mã CODE giảm giá, khu KCNX'), 'Mã CODE giảm giá, khu KCNX', 'không đụng chữ khác');
});
