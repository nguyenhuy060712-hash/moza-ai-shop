'use strict';

/**
 * Nhạc của Đội AI dẫn (SPEC.md bản 2.9, #51, F-47): đọc WAV Lyria trả (44,1 kHz stereo…), cắt phần dùng, đưa về
 * 24 kHz một kênh, chỉnh độ to; làm nhạc qua Google giả; API. Không gọi mạng, không tốn tiền.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { moCSDLTam, moPhanMem } = require('./ho-tro');
const tts = require('../server/agent/nha-cung-cap/tts');

// MP3 mẫu 3 giây (1 giây lặng + 2 giây tiếng 440 Hz), 44,1 kHz stereo — như Lyria trả (làm bằng ffmpeg một lần).
const MP3 = fs.readFileSync(path.join(__dirname, 'du-lieu', 'nhac-thu.mp3'));

/** WAV stereo: im lặng tới giây `tu`, rồi tiếng 440 Hz biên độ 0,5. */
function wavStereo({ tanSo = 44100, giay, tu = 0, bit = 16, soThuc = false }) {
  const n = Math.round(tanSo * giay);
  const b = bit / 8;
  const data = Buffer.alloc(n * 2 * b);
  for (let i = 0; i < n; i += 1) {
    const v = i / tanSo >= tu ? 0.5 * Math.sin((2 * Math.PI * 440 * i) / tanSo) : 0;
    for (let k = 0; k < 2; k += 1) {
      const o = (i * 2 + k) * b;
      if (soThuc) data.writeFloatLE(v, o);
      else if (bit === 16) data.writeInt16LE(Math.round(v * 32767), o);
      else data.writeIntLE(Math.round(v * 8388607), o, 3);
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'latin1');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8, 'latin1');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(soThuc ? 3 : 1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(tanSo, 24);
  h.writeUInt32LE(tanSo * 2 * b, 28);
  h.writeUInt16LE(2 * b, 32);
  h.writeUInt16LE(bit, 34);
  h.write('data', 36, 'latin1');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const LOI_BAI = '[[A0]]\n[[B1]]\n[3.0:] Nhà Mơ ơi, đồ xinh mỗi ngày!\n[6.0:] Mặc đẹp tự tin, vào live ngay!\n[9.0:] Câu ba không lấy\n[[C2]]';
// Có lần Lyria trả lời hát không có mốc giờ (thử 24/9/2026).
const LOI_KHONG_MOC = '[[A0]]\n[:] Nhà Mơ ơi, đồ xinh mỗi ngày! Mặc đẹp tự tin, vào live ngay!\n[[B1]]\n[:] Hôm nay phố phường rộn ràng nơi nơi';

test('xử lý nhạc Lyria: giải mã MP3, đọc WAV các kiểu, đổi về 24 kHz một kênh, cắt đúng phần dùng, chỉnh độ to', async (t) => {
  const nhac = require('../server/doi-ai/nhac');
  // Không gọi mạng: Gemini "nghe" (nhạc hiệu không có mốc giờ) luôn lỗi ở đây → lấy 16 giây đầu.
  tts.datFetch(async () => new Response('{"error":{"code":500,"message":"giả"}}', { status: 500 }));
  nhac.datChoNgheMs(1);
  t.after(() => { tts.datFetch(null); nhac.datChoNgheMs(3000); });

  // MP3 (Lyria 3.5 chỉ trả MP3): giải mã ra một kênh, đúng tần số, chỗ lặng và chỗ có tiếng.
  const g = await nhac.giaiMa(MP3);
  assert.equal(g.tanSo, 44100);
  assert.ok(Math.abs(g.mau.length / g.tanSo - 3) < 0.05, `dài ${g.mau.length / g.tanSo}`);
  const doTo = (tu, den) => Math.sqrt(g.mau.subarray(tu * 44100, den * 44100).reduce((s, v) => s + v * v, 0) / ((den - tu) * 44100));
  assert.ok(doTo(0.2, 0.8) < 0.001 && doTo(1.5, 2.5) > 0.02, 'giây đầu lặng, sau đó có tiếng');
  await assert.rejects(nhac.giaiMa(Buffer.from('không phải nhạc, chỉ là chữ thường thôi nha')), /Không giải mã được/);

  for (const [ten, w] of [['16 bit 44,1 kHz', wavStereo({ giay: 1 })], ['24 bit', wavStereo({ giay: 1, bit: 24 })],
    ['số thực 48 kHz', wavStereo({ giay: 1, tanSo: 48000, soThuc: true, bit: 32 })]]) {
    const { mau, tanSo } = nhac.docWav(w);
    const i = Math.round(tanSo * 0.25) + 7;
    assert.ok(Math.abs(mau[i] - 0.5 * Math.sin((2 * Math.PI * 440 * i) / tanSo)) < 1e-3, ten);
  }
  assert.throws(() => nhac.docWav(Buffer.from('ID3 không phải wav')), /Không phải tệp WAV/);

  // Đổi tần số: 440 Hz vẫn là 440 Hz (đếm số lần đổi dấu trong 1 giây ≈ 880).
  const { mau, tanSo } = nhac.docWav(wavStereo({ giay: 1.2 }));
  const x = nhac.doiTanSo(mau, tanSo);
  let doiDau = 0;
  for (let i = 24000 * 0.1 + 1; i < 24000 * 1.1; i += 1) if ((x[i - 1] < 0) !== (x[i] < 0)) doiDau += 1;
  assert.ok(Math.abs(doiDau - 880) <= 4, `đổi dấu ${doiDau}`);

  // Nhạc chuyển cảnh: 3,5 giây từ chỗ nhạc bắt đầu to (sau 2 giây im lặng), 24 kHz một kênh, vào ra êm, độ to ~0,1.
  const c = await nhac.xuLy('chuyen', wavStereo({ giay: 20, tu: 2 }));
  assert.ok(c.tu > 1.8 && c.tu <= 2, `bắt đầu ${c.tu}`);
  assert.equal(c.pcm.length, 3.5 * 24000 * 2);
  assert.equal(Math.abs(c.pcm.readInt16LE(0)), 0, 'vào êm');
  assert.ok(Math.abs(c.pcm.readInt16LE(c.pcm.length - 2)) < 50, 'ra êm');
  const giua = new Int16Array(c.pcm.buffer, c.pcm.byteOffset + 24000 * 2, 24000);
  const rms = Math.sqrt(giua.reduce((s, v) => s + (v / 32768) ** 2, 0) / giua.length);
  assert.ok(rms > 0.08 && rms < 0.12, `độ to ${rms}`);

  // Nhạc hiệu: từ 3 giây trước câu hát đầu tới hết câu hát thứ hai (theo mốc giờ lời Lyria trả kèm).
  const hieu = await nhac.xuLy('hieu', wavStereo({ giay: 15 }), LOI_BAI);
  assert.equal(hieu.tu, 0);
  assert.ok(Math.abs(hieu.giay - 9.3) < 0.01, `dài ${hieu.giay}`);
  assert.deepEqual(hieu.loi, ['Nhà Mơ ơi, đồ xinh mỗi ngày!', 'Mặc đẹp tự tin, vào live ngay!']);
  assert.ok(Math.abs((await nhac.xuLy('hieu', wavStereo({ giay: 17 }), '')).giay - 16) < 0.01, 'không có mốc giờ, Gemini lỗi: 16 giây đầu');
  const khongMoc = await nhac.xuLy('hieu', wavStereo({ giay: 17 }), LOI_KHONG_MOC);
  assert.deepEqual(khongMoc.loi, ['Nhà Mơ ơi, đồ xinh mỗi ngày! Mặc đẹp tự tin, vào live ngay!'], 'vẫn biết lời câu đầu');
  assert.deepEqual(nhac.cacCauHat(LOI_KHONG_MOC).map((c) => c.luc), [null, null]);
  // Lyria có lần chia câu móc thành 2 dòng trong đoạn đầu: lấy cả hai, không lấy sang đoạn sau.
  const haiDong = '[[A0]]\n[:] Nhà Mơ ơi, đồ xinh mỗi ngày!\n[:] Mặc đẹp tự tin, vào live ngay!\n[[B1]]\n[:] Hôm nay phố phường rộn ràng';
  assert.deepEqual((await nhac.xuLy('hieu', wavStereo({ giay: 20 }), haiDong)).loi,
    ['Nhà Mơ ơi, đồ xinh mỗi ngày!', 'Mặc đẹp tự tin, vào live ngay!']);
  // Nhạc đố vui ngắn hơn 30 giây thì lấy cả bài; MP3 cũng xử lý được.
  assert.ok((await nhac.xuLy('do_vui', wavStereo({ giay: 20 }))).giay <= 20);
  const tuMp3 = await nhac.xuLy('dung', MP3);
  assert.ok(tuMp3.tu > 0.8 && tuMp3.tu <= 1.05, `nhạc bắt đầu to ở giây ${tuMp3.tu}`);
  assert.ok(Math.abs(tuMp3.giay - (3 - tuMp3.tu)) < 0.05, 'bài ngắn thì lấy tới hết bài');
});

/** Google giả: Lyria (Interactions, trả MP3 như thật) và Gemini nghe (generateContent) — ghi lại các lần gọi. */
function taoGoogleGia() {
  const goi = [];
  const tuyChon = { tra: 'mp3', loi: LOI_BAI, nghe: { bat_dau_hat: 2.0, het_cau_dau: 7.5 } };
  const f = async (url, o = {}) => {
    const u = new URL(url);
    goi.push({ duong: u.pathname, than: o.body ? JSON.parse(o.body) : null });
    if (u.pathname.endsWith(':generateContent')) {
      if (u.pathname.includes('gemini-3.8-flash')) return new Response('{"error":{"code":503,"message":"high demand"}}', { status: 503 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(tuyChon.nghe) }] } }],
        usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 20 } }), { headers: { 'Content-Type': 'application/json' } });
    }
    const steps = [{ type: 'model_output', content: [{ type: 'text', text: tuyChon.loi }] }];
    const am = { mp3: [MP3, 'audio/mpeg'], wav: [wavStereo({ giay: 12 }), 'audio/wav'], rac: [Buffer.from('không phải nhạc, chỉ là chữ thường thôi nha'), 'audio/mpeg'] }[tuyChon.tra];
    if (am) steps.push({ type: 'model_output', content: [{ type: 'audio', mime_type: am[1], data: am[0].toString('base64') }] });
    return new Response(JSON.stringify({ object: 'interaction', model: 'lyria-3.5', status: am ? 'completed' : 'failed', steps }),
      { headers: { 'Content-Type': 'application/json' } });
  };
  return { f, goi, tuyChon };
}

test('làm nhạc qua Google giả: gọi Lyria đúng cách, giải mã, cắt, lưu, ghi chi phí; lỗi dễ hiểu', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const g = taoGoogleGia();
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  t.after(() => { tts.datFetch(null); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });
  const nhac = require('../server/doi-ai/nhac');
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  caiDat.datBanHang({ ten_shop: 'Nhà Mơ' });

  g.tuyChon.tra = 'wav'; // bài dài 12 giây để thấy cắt theo lời hát
  const kq = await nhac.lamNhac({ loai: 'hieu' });
  assert.ok(Math.abs(kq.giay - 9.3) < 0.01);
  assert.equal(kq.loi_bai, 'Nhà Mơ ơi, đồ xinh mỗi ngày!\nMặc đẹp tự tin, vào live ngay!');
  assert.equal(kq.usd, 0.08);
  const yc = g.goi[0];
  assert.match(yc.duong, /\/v1beta\/interactions$/);
  assert.equal(yc.than.model, 'lyria-3.5');
  assert.match(yc.than.input, /Nhà Mơ ơi, đồ xinh mỗi ngày!/, 'lời tả mặc định, điền tên shop');
  assert.match(yc.than.input, /livestream bán quần áo của shop "Nhà Mơ"/);
  assert.doesNotMatch(yc.than.input, /\{ten_shop\}/);
  const wav = nhac.docNhac('hieu');
  assert.equal(tts.tachWav(wav).tanSo, 24000);
  assert.ok(Math.abs(tts.soGiay(wav) - 9.3) < 0.01);
  assert.equal(doiAi.nhac().hieu.giay, 9.3);
  // Chỉ phát nhạc có thông tin đã lưu (lần nâng 012 bỏ thông tin nhạc cũ): thiếu thông tin → null, tệp trên đĩa không bị xóa.
  const thongTin = doiAi.nhac().hieu;
  doiAi.luuNhac('hieu', null);
  assert.equal(nhac.docNhac('hieu'), null);
  assert.ok(fs.existsSync(path.join(require('../server/doi-ai/phong-thu').thuMuc('nhac'), 'hieu.wav')), 'tệp âm thanh vẫn còn');
  doiAi.luuNhac('hieu', thongTin);
  assert.ok(nhac.docNhac('hieu'));
  const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'doi_ai'").all();
  assert.equal(run.length, 1);
  assert.equal(run[0].chi_phi_usd, 0.08);
  assert.equal(run[0].model, 'lyria-3.5');

  // MP3 như Lyria trả thật; lời tả sửa được; nhạc không lời lấy từ chỗ nhạc to.
  g.tuyChon.tra = 'mp3';
  const c = await nhac.lamNhac({ loai: 'chuyen', moTa: 'Tiếng whoosh ngắn. Instrumental only, no vocals.' });
  assert.ok(c.giay > 1.9 && c.giay <= 2.2, `dài ${c.giay}`);
  assert.equal(g.goi[1].than.input, 'Tiếng whoosh ngắn. Instrumental only, no vocals.');
  assert.equal(doiAi.nhac().chuyen.mo_ta, 'Tiếng whoosh ngắn. Instrumental only, no vocals.');

  // Lời hát không có mốc giờ: Gemini nghe 25 giây đầu (3.8 quá tải → 3.7), cắt tới hết câu đầu + 2,5 giây, ghi chi phí nghe.
  g.tuyChon.tra = 'wav';
  g.tuyChon.loi = LOI_KHONG_MOC;
  const soGoi = g.goi.length;
  const hieu2 = await nhac.lamNhac({ loai: 'hieu' });
  assert.ok(Math.abs(hieu2.giay - 10) < 0.01, `dài ${hieu2.giay}`);
  assert.equal(hieu2.loi_bai, 'Nhà Mơ ơi, đồ xinh mỗi ngày! Mặc đẹp tự tin, vào live ngay!');
  const nghe = g.goi.slice(soGoi).filter((x) => x.duong.endsWith(':generateContent'));
  assert.deepEqual(nghe.map((x) => x.duong.match(/models\/([^:]+)/)[1]), ['gemini-3.8-flash', 'gemini-3.7-flash']);
  const phan = nghe[1].than.contents[0].parts;
  assert.equal(tts.tachWav(Buffer.from(phan[0].inlineData.data, 'base64')).tanSo, 16000);
  assert.ok(tts.soGiay(Buffer.from(phan[0].inlineData.data, 'base64')) <= 12.01, 'chỉ gửi phần đầu bài');
  assert.match(phan[1].text, /Lời hát đầu tiên: "Nhà Mơ ơi, đồ xinh mỗi ngày! Mặc đẹp tự tin, vào live ngay!"/);
  assert.ok(hieu2.usd > 0.08 && hieu2.usd < 0.09, `thêm chút tiền nghe: ${hieu2.usd}`);
  g.tuyChon.loi = LOI_BAI;

  // Tiếng hỏng: Google đã tính tiền nên vẫn ghi chi phí, báo tạo lại. Không có tiếng: không tính tiền.
  g.tuyChon.tra = 'rac';
  await assert.rejects(nhac.lamNhac({ loai: 'dung' }), (e) => e.ma === 'AI_LOI' && /không dùng được/.test(e.message));
  g.tuyChon.tra = 'chan';
  await assert.rejects(nhac.lamNhac({ loai: 'dung' }), (e) => e.ma === 'AI_LOI' && /Google không trả nhạc \(failed\)/.test(e.message));
  await assert.rejects(nhac.lamNhac({ loai: 'nhac_la' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  caiDat.datKhanCap(true);
  await assert.rejects(nhac.lamNhac({ loai: 'dung' }), (e) => e.ma === 'KHAN_CAP_DANG_BAT');
  caiDat.datKhanCap(false);
  assert.equal(csdl().prepare("SELECT COUNT(*) n FROM agent_run WHERE agent_id = 'doi_ai'").get().n, 5, 'hiệu, chuyển cảnh, hiệu + nghe, tiếng hỏng');
  g.tuyChon.tra = 'mp3';

  assert.deepEqual(Object.keys(nhac.xoaNhac('hieu')), ['chuyen']);
  assert.equal(nhac.docNhac('hieu'), null);
  assert.equal(nhac.docNhac('../../.env'), null);
});

test('API nhạc: danh sách loại, tạo, nghe (WAV), xóa', async (t) => {
  const g = taoGoogleGia();
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  const pm = await moPhanMem();
  t.after(() => { pm.dong(); tts.datFetch(null); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });

  const d = (await pm.goi('GET', '/api/doi-ai')).than;
  assert.deepEqual(d.loai_nhac.map((l) => l.id), ['hieu', 'chuyen', 'do_vui', 'dung', 'hieu_radio']);
  assert.ok(d.loai_nhac.every((l) => l.ten && l.khi && l.mo_ta_mac_dinh));
  assert.ok(d.loai_nhac.every((l) => !/\{ten_shop\}/.test(l.ten + l.khi + l.mo_ta_mac_dinh)), 'tên shop đã điền');
  assert.match(d.loai_nhac.find((l) => l.id === 'hieu_radio').mo_ta_mac_dinh, /Radio shop/, 'chưa đặt tên shop thì gọi chung là "shop"');
  assert.equal((await pm.goi('GET', '/api/doi-ai/nhac/do_vui')).ma, 404);
  const tao = await pm.goi('POST', '/api/doi-ai/nhac', { loai: 'do_vui' });
  assert.equal(tao.ma, 201);
  assert.equal(tao.than.loai, 'do_vui');
  assert.equal(tao.than.chi_phi_usd, 0.08);
  assert.ok(tao.than.nhac.do_vui);
  const r = await fetch(`http://127.0.0.1:${pm.cong}/api/doi-ai/nhac/do_vui`);
  assert.equal(r.headers.get('content-type'), 'audio/wav');
  assert.equal(tts.tachWav(Buffer.from(await r.arrayBuffer())).tanSo, 24000);
  assert.equal((await pm.goi('POST', '/api/doi-ai/nhac', { loai: 'x' })).ma, 400);
  assert.deepEqual((await pm.goi('DELETE', '/api/doi-ai/nhac/do_vui')).than.nhac, {});
  assert.equal((await pm.goi('GET', '/api/doi-ai/nhac/do_vui')).ma, 404);
});

/* ---------------- Radio {ten_shop} (#54, #74, F-49, F-50) ---------------- */

test('bài hát Radio: cắt tối đa 2 phút, kết ở chỗ sang đoạn nhạc; bài ngắn giữ cả bài', () => {
  const nhac = require('../server/doi-ai/nhac');
  const tanSo = 1000; // tần số thấp cho test nhanh: chỉ cần độ to từng khung
  const bai = (giay) => new Float32Array(giay * tanSo).fill(0.5);
  const loi = '[[A0]]\n[3.0:] Mở bài\n[[B1]]\n[20.0:] Đoạn một\n[[C2]]\n[50.0:] Điệp khúc\n[[D3]]\n[95.0:] Đoạn hai\n[[E4]]\n[130.0:] Điệp khúc cuối';
  const a = nhac.chonDoanBai(bai(150), tanSo, loi);
  assert.equal(a.den, 96, 'kết ở chỗ sang đoạn cuối cùng trong khoảng 80–120 giây (+1 giây ngân)');
  assert.equal(a.catSom, true);
  const b = nhac.chonDoanBai(bai(150), tanSo, '');
  assert.equal(b.den - b.tu, 120, 'không có mốc lời hát: cắt ở 2 phút');
  const c = nhac.chonDoanBai(bai(110), tanSo, loi);
  assert.equal(c.den, 110, 'bài 1–2 phút giữ cả bài');
  assert.equal(c.catSom, false);
  // Lời tả gửi Lyria ghép từ tên bài và kiểu nhạc (tài liệu Lyria 3.5: độ dài, bố cục dặn bằng lời).
  const mt = nhac.moTaBai('Chiều phố mùa thu', 'ballad');
  assert.match(mt, /tên "Chiều phố mùa thu"/);
  assert.match(mt, /1 phút 45 giây/);
  assert.match(mt, /\[Verse\], \[Chorus\]/);
  assert.match(mt, /Không nhắc tên shop, nhãn hàng, không quảng cáo/);
  assert.match(mt, /ballad/);
});

test('làm bài hát qua Google giả + API: tạo, nghe, tạo lại, xóa, lỗi dễ hiểu', async (t) => {
  const g = taoGoogleGia();
  g.tuyChon.tra = 'wav'; // bài 12 giây: ngắn hơn 2 phút thì giữ cả bài
  tts.datFetch(g.f);
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  const pm = await moPhanMem();
  t.after(() => { pm.dong(); tts.datFetch(null); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });

  const d = (await pm.goi('GET', '/api/doi-ai')).than;
  assert.deepEqual(d.bai_hat, []);
  assert.deepEqual(d.kieu_bai.map((k) => k.id), ['pop', 'ballad', 'acoustic', 'tru_tinh']);
  assert.ok(d.goi_y_bai.length >= 4 && d.goi_y_bai.every((x) => x.ten && d.kieu_bai.some((k) => k.id === x.kieu)));

  const tao = await pm.goi('POST', '/api/doi-ai/bai-hat', { ten: '  Chiều phố mùa thu ', kieu: 'ballad' });
  assert.equal(tao.ma, 201);
  assert.equal(tao.than.chi_phi_usd, 0.08);
  const b = tao.than.bai;
  assert.match(b.id, /^bh[a-f0-9]{10}$/);
  assert.equal(b.ten, 'Chiều phố mùa thu');
  assert.equal(b.giay, 12);
  assert.equal(b.loi_bai.split('\n')[0], 'Nhà Mơ ơi, đồ xinh mỗi ngày!', 'giữ lời hát để nhận ra tiếng loa lọt vào micro');
  const yc = g.goi.at(-1);
  assert.equal(yc.than.model, 'lyria-3.5');
  assert.match(yc.than.input, /Chiều phố mùa thu/);
  const r = await fetch(`http://127.0.0.1:${pm.cong}/api/doi-ai/bai-hat/${b.id}`);
  assert.equal(r.headers.get('content-type'), 'audio/wav');
  assert.equal(tts.tachWav(Buffer.from(await r.arrayBuffer())).tanSo, 24000);

  // Tạo lại: cùng id, thay tệp và thông tin; bài lạ → 404; kiểu lạ, tên trống → 400.
  const lai = await pm.goi('POST', '/api/doi-ai/bai-hat', { id: b.id, ten: 'Chiều phố mùa thu', kieu: 'acoustic' });
  assert.equal(lai.ma, 201);
  assert.deepEqual(lai.than.bai_hat.map((x) => [x.id, x.kieu]), [[b.id, 'acoustic']]);
  assert.equal((await pm.goi('POST', '/api/doi-ai/bai-hat', { id: 'bh0000000000', ten: 'A', kieu: 'pop' })).ma, 404);
  assert.equal((await pm.goi('POST', '/api/doi-ai/bai-hat', { ten: 'A', kieu: 'rock' })).ma, 400);
  assert.equal((await pm.goi('POST', '/api/doi-ai/bai-hat', { ten: '  ', kieu: 'pop' })).ma, 400);
  assert.equal((await pm.goi('GET', '/api/doi-ai/bai-hat/..%2F..%2F.env')).ma, 404);

  // Tối đa 8 bài.
  for (let i = 0; i < 7; i += 1) assert.equal((await pm.goi('POST', '/api/doi-ai/bai-hat', { ten: `Bài ${i}`, kieu: 'pop' })).ma, 201);
  const qua = await pm.goi('POST', '/api/doi-ai/bai-hat', { ten: 'Bài chín', kieu: 'pop' });
  assert.equal(qua.ma, 400);
  assert.match(qua.than.loi.thong_diep, /Tối đa 8 bài/);

  assert.equal((await pm.goi('DELETE', `/api/doi-ai/bai-hat/${b.id}`)).than.bai_hat.length, 7);
  assert.equal((await pm.goi('GET', `/api/doi-ai/bai-hat/${b.id}`)).ma, 404);
  assert.equal((await pm.goi('DELETE', `/api/doi-ai/bai-hat/${b.id}`)).ma, 404);
});
