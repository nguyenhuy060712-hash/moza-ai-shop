'use strict';

/**
 * Phép thử nhỏ F-112 (BH11, docs/11 mục 6.6 bước 0): mở GPT-Live (`gpt-live-1`) có `session.triggers` loại `decisions` trên
 * `session.output_transcript.delta`, GIỮ `delegation: {type: 'client'}` như miệng thật; cho Mai nói một câu chuyển món ("quần số 15") và
 * xem có `decision.event` / `decision.completed` không, độ trễ bao nhiêu, khóa có quyền không. Tối đa 40 giây phiên — trần 0,05 USD.
 * Khóa đọc từ .env / Cài đặt bản xem thử (chỉ đọc, KHÔNG in). Kết quả: data/tam-test/thu-f112.json.
 * Chạy: "C:\Program Files\nodejs\node.exe" scripts/thu-ai/thu-gpt-live-decisions.js
 */

process.chdir(require('node:path').join(__dirname, '..', '..'));
const path = require('node:path');
const fs = require('node:fs');

process.env.MOZA_FILE_ENV = path.resolve('data/tam-test/thu-f112.env');
try { process.loadEnvFile('.env'); } catch { /* chưa có .env */ }
try {
  const rieng = require('node:util').parseEnv(fs.readFileSync('data/xem-thu/.env', 'utf8'));
  for (const [k, v] of Object.entries(rieng)) if (String(v).trim()) process.env[k] = v;
} catch { /* chưa có khóa riêng */ }

const TOI_DA_MS = 40000;
const BOM_MS = 100;
const IM_LANG = Buffer.alloc(24000 * 2 * (BOM_MS / 1000)).toString('base64');
const CAU = 'Dạ giờ mình xem quần số 15 nha cả nhà, quần jean ống suông, ai muốn biết size thì nhìn bảng size trên màn hình nè.';

(async () => {
  const khoa = require('../../server/khoa');
  if (!khoa.lay('openai')) { console.log('Chưa có khóa OpenAI: không chạy, 0 đồng.'); process.exit(3); }
  const OpenAISdk = require('openai');
  const OpenAI = OpenAISdk.default || OpenAISdk;
  const { LiveWS } = require('openai/resources/live/ws');
  const { doiCauHoi, docQuyetDinh } = require('../../server/agent/nha-cung-cap/openai');
  const cauHoi = [
    { ten: 'mon_dang_noi', loai: 'choice', chiDan: 'Theo câu Mai vừa nói, Mai đang giới thiệu món nào? Chưa đổi món thì chọn khong_doi.',
      luaChon: [{ gt: 'so_12', moTa: 'Số 12: Sơ mi linen tay ngắn' }, { gt: 'so_15', moTa: 'Số 15: Quần jean ống suông' }, { gt: 'khong_doi', moTa: 'Chưa đổi món' }] },
    { ten: 'moi_xem_size', loai: 'predicate', chiDan: 'Mai vừa mời khách nhìn bảng size hoặc chất liệu trên màn hình?' },
  ];
  const kq = { bat_dau: new Date().toISOString(), mo_duoc: false, loi: [], chu_mai: '', quyet_dinh: [], giay: 0, token_qd: 0 };
  const t0 = Date.now();
  let lucChu15 = null;
  const rt = new LiveWS(new OpenAI({ apiKey: khoa.lay('openai') }));
  rt.on('error', (e) => { kq.loi.push(String(e?.error?.error?.message || e?.error?.message || e?.message || e).slice(0, 300)); });
  let bom = null;
  const xong = new Promise((ok) => {
    const ket = () => { clearInterval(bom); ok(); };
    rt.on('session.started', () => {
      kq.mo_duoc = true;
      bom = setInterval(() => { try { rt.send({ type: 'session.input_audio.append', audio: IM_LANG }); } catch { /* đóng */ } }, BOM_MS);
      rt.send({ type: 'session.commentary.append', delegation_id: null, content: `Nói ngay đúng nguyên văn câu này bằng tiếng Việt: "${CAU}"` });
    });
    rt.on('session.output_transcript.delta', (m) => {
      kq.chu_mai += m.delta || '';
      if (!lucChu15 && /15|mười lăm/i.test(kq.chu_mai)) lucChu15 = Date.now();
    });
    rt.on('decision.event', (m) => {
      const r = m.event?.type === 'decision.completed' ? docQuyetDinh(m.event.decision) : null;
      kq.token_qd += r?.tokenVao || 0;
      kq.quyet_dinh.push({ ms_tu_dau: Date.now() - t0, ms_sau_chu_15: lucChu15 ? Date.now() - lucChu15 : null, nguon: m.source_event_type, tra_loi: r?.traLoi || null });
    });
    rt.on('session.usage.updated', (m) => { kq.giay = Math.max(kq.giay, m.usage?.seconds || 0); });
    rt.on('session.closed', (m) => { kq.giay = Math.max(kq.giay, m.usage?.seconds || 0); ket(); });
    rt.on('close', ket);
    setTimeout(() => { try { rt.send({ type: 'session.close' }); } catch { ket(); } setTimeout(() => { try { rt.close(); } catch { /* */ } ket(); }, 5000); }, TOI_DA_MS);
  });
  // Có quyết định món 15 rồi thì đóng sớm (đỡ tiền).
  const hen = setInterval(() => {
    if (kq.quyet_dinh.some((q) => q.tra_loi?.mon_dang_noi?.chon === 'so_15') && Date.now() - t0 > 8000) { clearInterval(hen); try { rt.send({ type: 'session.close' }); } catch { /* */ } }
  }, 500);
  rt.send({
    type: 'session.start',
    session: {
      model: 'gpt-live-1',
      instructions: 'Bạn là Mai, trợ lý AI dẫn livestream bán quần áo của shop. MOZA đưa câu nào thì nói đúng câu đó bằng tiếng Việt, tự nhiên như MC.',
      audio: { output: { voice: 'marin' } },
      delegation: { type: 'client' },
      triggers: [{ type: 'decisions', event_type: 'session.output_transcript.delta', decisions: { questions: doiCauHoi(cauHoi) } }],
    },
  });
  await xong;
  clearInterval(hen);
  const gia = require('../../server/cau-hinh/gia-model.json');
  kq.usd = +(kq.giay / 60 * (gia.mieng['gpt-live-1']?.usd_moi_phut ?? 0.05) + kq.token_qd * 0.1 / 1e6).toFixed(5);
  kq.chay_duoc = kq.mo_duoc && kq.quyet_dinh.length > 0;
  const dau15 = kq.quyet_dinh.find((q) => q.tra_loi?.mon_dang_noi?.chon === 'so_15');
  kq.tre_ms_sau_chu_15 = dau15?.ms_sau_chu_15 ?? null;
  fs.writeFileSync('data/tam-test/thu-f112.json', JSON.stringify(kq, null, 1));
  console.log(`mở được: ${kq.mo_duoc} · quyết định nhận: ${kq.quyet_dinh.length} · chọn số 15: ${!!dau15} (trễ sau chữ "15": ${kq.tre_ms_sau_chu_15 ?? '-'} ms) · ${kq.giay} giây · ${kq.usd} USD`);
  if (kq.loi.length) console.log('Lỗi:', kq.loi.slice(0, 3).join(' | '));
  process.exit(0);
})().catch((e) => { console.error(String(e?.message || e).slice(0, 300)); process.exit(1); });
