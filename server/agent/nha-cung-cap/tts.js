'use strict';

/**
 * Gemini 3.8 TTS và Voices API (SPEC.md bản 2.5, mục 6, #41 → #44): đọc chữ thành giọng, đọc hai người nói,
 * tạo giọng theo câu tả, nhân bản giọng người thật, xóa giọng, danh sách giọng có sẵn tiếng Việt.
 * Gọi thẳng REST bằng fetch — không cần thêm thư viện.
 *
 * Gọi thật ngày 24/9/2026 (khác ví dụ trong tài liệu):
 *  - Đọc (`POST /v1beta/interactions`): tiếng nằm ở `steps[].content[]` { type: 'audio', mime_type: 'audio/wav', data },
 *    WAV 24 kHz một kênh. Một câu ngắn chờ trọn câu mất 5–11 giây.
 *  - Tạo giọng (`POST /v1beta/voices`): KHÔNG ghi `voice.model` — ghi Flash-Lite thì lỗi 400; Google tự dùng model tạo giọng
 *    mặc định, giọng tạo xong đọc được bằng mọi model TTS. Trả { id: 'voice_…', expire_time (1 năm), sample_audio, usage }.
 *  - Token tính tiền: `usage.total_input_tokens`, `usage.total_output_tokens` (khoảng 31 token mỗi giây tiếng),
 *    thêm `usage.total_thought_tokens` khi tạo giọng.
 *
 * Máy đọc OpenAI (BH10, F-108 — tra 28/10/2026, docs/11 mục 1): OpenAI tắt máy đọc cũ ngày 6/1/2027 và chỉ định
 * `gpt-realtime-2.1-mini` qua Realtime API — phiên WebSocket ở doc-realtime.js, 10 giọng (marin, cedar…), tiếng PCM 24 kHz kèm chữ
 * chép lại. Model hội thoại không bảo đảm đọc nguyên văn → kiemDocDung so chữ chép lại với câu gốc TRƯỚC khi phát; lệch thì đọc
 * lại một lần rồi báo DOC_LECH (nơi gọi hiện chữ cho người dẫn đọc). Chi phí theo usage thật.
 * Máy đọc ElevenLabs (`eleven_v4`, doc-elevenlabs.js): Text-to-Dialogue, PCM 24 kHz, tính tiền theo ký tự; giọng ElevenLabs lưu riêng
 * (nhân vật Đội AI `giong_eleven`, Mai `mieng.giong.elevenlabs`). Máy đọc giả (`may-doc-gia`) cho bản xem thử --ai-gia và test.
 * Chọn nhà đọc ở mac-dinh.json "doc_giong": openai | elevenlabs | gemini | gia. Thiếu khóa nhà đã chọn → báo CHUA_CO_KHOA, không
 * tự đổi sang nhà khác (#130). Giọng không phải giọng OpenAI (giọng Google cũ) thì OpenAI đọc bằng marin.
 */

const khoa = require('../../khoa');
const { LoiAi } = require('./chung');
const { boDau } = require('../../nghiep-vu/chung');
const docRealtime = require('./doc-realtime');
const docEleven = require('./doc-elevenlabs');

const GOC = 'https://generativelanguage.googleapis.com/v1beta';
const NHA = 'gemini';
const MODEL_DOC = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
const MAC_DINH = 'gemini-3.8-flash-lite-tts';
// Máy đọc dự phòng của Đội AI (bản 2.10, #55): hạn mức riêng khi hai máy 3.8 hết 100 lượt/ngày. Không nhận giọng kho
// vi-vn-… và không nhận chú thích speech_metadata (lỗi 400, thử 25/9/2026) → giọng có sẵn, hội thoại gửi dạng "Tên: lời".
const MODEL_DU_PHONG = 'gemini-3.1-flash-tts-preview';
const KHONG_CHU_THICH = new Set([MODEL_DU_PHONG]);
const MODEL_TAO_GIONG = 'gemini-3.8-flash-tts'; // model Google tự dùng khi tạo giọng (để tính tiền)
const DOC_TOI_DA_MS = 90000;
const TAO_TOI_DA_MS = 180000; // tạo giọng theo câu tả mất khoảng 28 giây khi gọi thật
const MODEL_NHAC = 'lyria-3.5'; // nhạc của Đội AI dẫn (bản 2.9, F-47)
const NHAC_TOI_DA_MS = 300000;
// Nghe một đoạn tiếng rồi trả lời (tìm chỗ hết câu hát của nhạc hiệu). gemini-3.8-flash hay quá tải (503, 23–24/9/2026).
const MODEL_NGHE = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'];

// Máy đọc OpenAI (BH10, F-108): Realtime, đúng 10 giọng của gpt-realtime-2.1-mini (docs/11 T2).
const MODEL_OPENAI = docRealtime.MODEL;
const GIONG_OPENAI = ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
const GIONG_OPENAI_MAC_DINH = 'marin';
const laOpenAi = (model) => model === MODEL_OPENAI;
// Máy đọc ElevenLabs (BH10, F-108).
const MODEL_ELEVEN = docEleven.MODEL;

// Máy đọc giả (BH10, docs/11 mục 3.1): bản xem thử --ai-gia và test — 0 đồng, không gọi mạng. Trả PCM im lặng dài theo số
// chữ (khoảng 14 ký tự / giây) kèm "chữ chép lại" = câu gốc; công tắc datDocSai(true) làm máy giả đọc sai một con số.
const MODEL_GIA = 'may-doc-gia';
const KY_TU_MOI_GIAY_GIA = 14;
let docSaiGia = false;
const datDocSai = (b) => { docSaiGia = !!b; };

const NHA_DOC = ['openai', 'elevenlabs', 'gemini', 'gia'];
/** Nhà của một model đọc: máy một giọng mỗi lần (openai, elevenlabs, gia) hay Gemini TTS. */
function nhaCuaModel(model) {
  if (model === MODEL_OPENAI) return 'openai';
  if (model === MODEL_ELEVEN) return 'elevenlabs';
  if (model === MODEL_GIA) return 'gia';
  return 'gemini';
}
/** Máy đọc một giọng mỗi lần (đọc từng lượt rồi nối, không nhận thẻ tiếng kiểu Gemini 3.8). */
const laMotGiong = (model) => nhaCuaModel(model) !== 'gemini';

let nhaDocDat = null; // test đặt tạm 'gemini' / 'openai' / 'gia'
/** Nhà đọc giọng đang dùng: mac-dinh.json "doc_giong" (mặc định 'openai'); bản AI giả (MOZA_AI_GIA=1) luôn là 'gia'. */
function nhaDoc() {
  if (nhaDocDat) return nhaDocDat;
  if (process.env.MOZA_AI_GIA === '1') return 'gia';
  try {
    const n = require('../../cau-hinh/mac-dinh.json').doc_giong?.nha;
    return NHA_DOC.includes(n) ? n : 'openai';
  } catch { return 'openai'; }
}
const datNhaDoc = (n) => { nhaDocDat = n || null; };
/** Model đọc mặc định theo nhà đọc đang dùng. */
const modelMacDinh = () => ({ openai: MODEL_OPENAI, elevenlabs: MODEL_ELEVEN, gia: MODEL_GIA }[nhaDoc()] || MAC_DINH);

let goiMang = (...a) => fetch(...a);

/** Test thay mạng bằng fetch giả; không truyền gì thì dùng lại fetch thật. */
function datFetch(f) {
  goiMang = f || ((...a) => fetch(...a));
}

/**
 * Hết lượt trong ngày (khác quá tải tạm thời — thử lại vô ích). Gặp thật 24–25/9/2026: khóa gói trả phí mức 1 chỉ được
 * 100 lượt/ngày cho mỗi model TTS; gemini-3.8-flash-tts trả 429 "generate_requests_per_model_per_day, limit: 100",
 * gemini-3.8-flash-lite-tts lại trả 500 "Rate limit exceeded … (limit: 100 requests per day on Tier 1)".
 */
function laHetLuotNgay(ma, t) {
  return /per[_ ]?(model[_ ]?per[_ ]?)?day|requests per day|PerDay/i.test(t) && (ma === 429 || /rate limit|quota/i.test(t));
}

/** "Please retry in 21h24m3.5s" → "khoảng 21 giờ 24 phút"; không có thì null. */
function thoiGianCho(t) {
  const m = /retry in\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i.exec(t);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const gio = Number(m[1] || 0);
  const phut = Number(m[2] || 0) + (gio || m[2] ? 0 : Math.ceil(Number(m[3] || 0) / 60));
  return { ms: ((gio * 60 + phut) * 60 + (gio || m[2] ? Number(m[3] || 0) : 0)) * 1000, chu: `${gio ? `${gio} giờ ` : ''}${phut ? `${phut} phút` : ''}`.trim() || 'ít phút' };
}

/** Lỗi Google thành LoiAi dễ hiểu; hết lượt trong ngày có ma `HET_LUOT_NGAY` và `choMs` (thời gian tới lúc mở lại). */
function loiGoogle(ma, thongDiep) {
  const t = String(thongDiep || '').trim();
  if (laHetLuotNgay(ma, t)) {
    const han = /limit:\s*(\d+)/i.exec(t)?.[1];
    const model = /model[:\s]+([\w.-]+tts[\w.-]*)/i.exec(t)?.[1] || /for model\s+([\w.-]+)/i.exec(t)?.[1] || '';
    const cho = thoiGianCho(t);
    const e = new LoiAi(`Google đã hết lượt đọc giọng hôm nay${han ? ` (tối đa ${han} lượt/ngày` : ''}${han && model ? ` cho ${model})` : han ? ')' : ''}`
      + `${cho ? `; mở lại sau khoảng ${cho.chu}` : ''}. Muốn nhiều lượt hơn thì nâng mức gói trong Google AI Studio.`,
    { nha: NHA, http: ma, ma: 'HET_LUOT_NGAY' });
    e.choMs = cho?.ms ?? 60 * 60 * 1000;
    e.model = model;
    return e;
  }
  return new LoiAi(loiDeHieu(ma, t), { nha: NHA, http: ma });
}

function loiDeHieu(ma, thongDiep) {
  const t = String(thongDiep || '').trim();
  if (ma === 429) return 'Google đang giới hạn lượt gọi (quá nhiều lần trong một lúc). Đợi một phút rồi thử lại.';
  if (ma === 401 || ma === 403) return `Google không cho khóa hiện tại dùng tính năng này. ${t}`.trim();
  if (/consent/i.test(t)) return `Câu đồng ý không khớp: chính người trong đoạn mẫu phải đọc đúng nguyên văn câu đồng ý. (${t})`;
  if (ma >= 500) return `Máy chủ Google đang lỗi (${ma}). Thử lại sau ít phút. ${t}`.trim();
  return `Google từ chối (${ma}): ${t}`;
}

async function goi(duong, { method = 'GET', than, gioiHanMs = DOC_TOI_DA_MS } = {}) {
  const k = khoa.lay('gemini');
  if (!k) throw new LoiAi('Chưa có khóa Gemini. Dán khóa trong Cài đặt → Khóa AI.', { nha: NHA, ma: 'CHUA_CO_KHOA' });
  let res;
  try {
    res = await goiMang(GOC + duong, {
      method,
      headers: { 'x-goog-api-key': k, 'Content-Type': 'application/json' },
      body: than === undefined ? undefined : JSON.stringify(than),
      signal: AbortSignal.timeout(gioiHanMs),
    });
  } catch (e) {
    const het = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new LoiAi(het ? 'Google trả lời quá lâu.' : `Không gọi được Google: ${e.message}`, { nha: NHA, ma: het ? 'QUA_THOI_GIAN' : 'AI_LOI' });
  }
  const chu = await res.text();
  let d = null;
  try { d = chu ? JSON.parse(chu) : {}; } catch { /* không phải JSON */ }
  if (!res.ok) throw loiGoogle(res.status, d?.error?.message || chu.slice(0, 600));
  return d || {};
}

/**
 * Đọc kiểu phát dần (bản 2.9, F-46): thân như đọc thường thêm `stream: true`, đường có `?alt=sse`. Google gửi sự kiện
 * SSE `step.delta` với `delta.type = "audio"`, `delta.data` là PCM 16-bit 24 kHz một kênh; `usage` ở cuối dòng.
 * Đo 24/9/2026: tiếng đầu sau 1,4–1,8 giây, làm nhanh hơn thời gian thực. khiAm(pcm) nhận từng mẩu ngay khi tới.
 * @returns {Promise<{pcm:Buffer, usage:object|null}>}
 */
async function goiPhatDan(than, khiAm, { gioiHanMs = DOC_TOI_DA_MS, tinHieu = null } = {}) {
  const k = khoa.lay('gemini');
  if (!k) throw new LoiAi('Chưa có khóa Gemini. Dán khóa trong Cài đặt → Khóa AI.', { nha: NHA, ma: 'CHUA_CO_KHOA' });
  const huy = tinHieu ? AbortSignal.any([AbortSignal.timeout(gioiHanMs), tinHieu]) : AbortSignal.timeout(gioiHanMs);
  let res;
  try {
    res = await goiMang(`${GOC}/interactions?alt=sse`, {
      method: 'POST',
      headers: { 'x-goog-api-key': k, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...than, stream: true }),
      signal: huy,
    });
  } catch (e) {
    const het = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new LoiAi(het ? 'Google trả lời quá lâu.' : `Không gọi được Google: ${e.message}`, { nha: NHA, ma: het ? 'QUA_THOI_GIAN' : 'AI_LOI' });
  }
  if (!res.ok) {
    const chu = await res.text();
    let d = null;
    try { d = JSON.parse(chu); } catch { /* không phải JSON */ }
    throw loiGoogle(res.status, d?.error?.message || chu.slice(0, 600));
  }
  const manh = [];
  let usage = null;
  const xuLy = (khoi) => {
    for (const dong of khoi.split('\n')) {
      if (!dong.startsWith('data:')) continue;
      const s = dong.slice(5).trim();
      if (!s || s === '[DONE]') continue;
      let ev;
      try { ev = JSON.parse(s); } catch { continue; }
      if (ev.error) throw loiGoogle(Number(ev.error.code) || 500, ev.error.message);
      const d = ev.delta;
      if (d?.type === 'audio' && d.data) {
        const b = Buffer.from(d.data, 'base64');
        manh.push(b);
        if (khiAm) khiAm(b);
      }
      const u = ev.usage || ev.interaction?.usage;
      if (u) usage = u;
    }
  };
  const giai = new TextDecoder();
  let du = '';
  try {
    for await (const b of res.body) {
      du = (du + giai.decode(b, { stream: true })).replace(/\r\n/g, '\n');
      let i;
      while ((i = du.indexOf('\n\n')) >= 0) {
        xuLy(du.slice(0, i));
        du = du.slice(i + 2);
      }
    }
  } catch (e) {
    if (e instanceof LoiAi) throw e;
    const het = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new LoiAi(het ? 'Google đọc quá lâu hoặc đã bị dừng.' : `Mất kết nối khi Google đang đọc: ${e.message}`, { nha: NHA, ma: het ? 'QUA_THOI_GIAN' : 'AI_LOI' });
  }
  if (du.trim()) xuLy(du);
  const pcm = Buffer.concat(manh);
  if (!pcm.length) throw new LoiAi('Google không trả tiếng cho câu này.', { nha: NHA });
  return { pcm, usage };
}

/* ---------------- tệp tiếng ---------------- */

/** PCM 16-bit một kênh → tệp WAV nghe được ngay trong trình duyệt. */
function bocWav(pcm, tanSo = 24000) {
  const dau = Buffer.alloc(44);
  dau.write('RIFF', 0);
  dau.writeUInt32LE(36 + pcm.length, 4);
  dau.write('WAVE', 8);
  dau.write('fmt ', 12);
  dau.writeUInt32LE(16, 16);
  dau.writeUInt16LE(1, 20); // PCM
  dau.writeUInt16LE(1, 22); // 1 kênh
  dau.writeUInt32LE(tanSo, 24);
  dau.writeUInt32LE(tanSo * 2, 28);
  dau.writeUInt16LE(2, 32);
  dau.writeUInt16LE(16, 34);
  dau.write('data', 36);
  dau.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([dau, pcm]);
}

/** Tách PCM và tần số mẫu khỏi tệp WAV. Không có đầu RIFF thì coi là PCM 24 kHz thô (dạng Google trả khi phát dần). */
function tachWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF') return { pcm: buf || Buffer.alloc(0), tanSo: 24000, kenh: 1 };
  let tanSo = 24000;
  let kenh = 1;
  let i = 12;
  while (i + 8 <= buf.length) {
    const ten = buf.toString('ascii', i, i + 4);
    const dai = buf.readUInt32LE(i + 4);
    if (ten === 'fmt ' && i + 16 <= buf.length) {
      kenh = buf.readUInt16LE(i + 10);
      tanSo = buf.readUInt32LE(i + 12);
    }
    // Tệp ghi dần có thể ghi độ dài 0xFFFFFFFF: lấy tới hết tệp.
    if (ten === 'data') return { pcm: buf.subarray(i + 8, Math.min(buf.length, i + 8 + dai)), tanSo, kenh };
    i += 8 + dai + (dai % 2);
  }
  return { pcm: Buffer.alloc(0), tanSo, kenh };
}

function soGiay(buf) {
  const { pcm, tanSo, kenh } = tachWav(buf);
  return pcm.length / (tanSo * 2 * (kenh || 1));
}

function soToken(d) {
  const u = d?.usage || {};
  return { vao: u.total_input_tokens || 0, ra: (u.total_output_tokens || 0) + (u.total_thought_tokens || 0) };
}

function layTieng(d) {
  for (const s of d?.steps || []) {
    for (const c of s?.content || []) if (c?.type === 'audio' && c.data) return Buffer.from(c.data, 'base64');
  }
  // Ví dụ trong tài liệu ghi `output_audio.data`: vẫn nhận cho chắc.
  const cu = d?.interaction?.output_audio?.data || d?.output_audio?.data;
  return cu ? Buffer.from(cu, 'base64') : null;
}

function ketQuaDoc(d, model) {
  const am = layTieng(d);
  if (!am || !am.length) throw new LoiAi('Google không trả tiếng cho câu này.', { nha: NHA });
  const wav = am.toString('ascii', 0, 4) === 'RIFF' ? am : bocWav(am);
  const { pcm, tanSo } = tachWav(wav);
  return { wav, pcm, tanSo, giay: pcm.length / (tanSo * 2), token: soToken(d), model };
}

function chonModel(model) {
  return MODEL_DOC.includes(model) || model === MODEL_DU_PHONG ? model : MAC_DINH;
}

/* ---------------- đọc bằng OpenAI (Realtime) ---------------- */

/** Một lượt đọc OpenAI qua phiên Realtime của giọng đó: PCM 24 kHz phát dần, kèm chữ chép lại để kiểm. */
async function docMotOpenAi({ chu, giong, phongCach = null, khiAm = null, khiChep = null, tinHieu = null }) {
  const voice = GIONG_OPENAI.includes(giong) ? giong : GIONG_OPENAI_MAC_DINH;
  return docRealtime.docCau({ giong: voice, chu, phongCach, khiAm, khiChep, tinHieu });
}

/* ---------------- máy đọc giả ---------------- */

/** Đổi con số đầu tiên của câu (công tắc "đọc sai một số" của máy giả). */
function doiMotSo(chu) {
  return String(chu).replace(/\d+/, (m) => String(Number(m) + 1));
}

/** Một lượt đọc giả: PCM im lặng 24 kHz chia mẩu 0,5 giây; chữ chép lại = câu gốc (hoặc sai một số khi bật công tắc). */
async function docMotGia({ chu, khiAm = null, khiChep = null }) {
  const giay = Math.max(0.3, String(chu).length / KY_TU_MOI_GIAY_GIA);
  const pcm = Buffer.alloc(Math.round(giay * 24000) * 2);
  const chepLai = docSaiGia ? doiMotSo(chu) : String(chu);
  if (khiChep) khiChep(chepLai);
  if (khiAm) for (let i = 0; i < pcm.length; i += 24000) khiAm(Buffer.from(pcm.subarray(i, i + 24000)));
  return { pcm, giay: pcm.length / 48000, chepLai, token: { vao: 0, ra: 0 } };
}

/* ---------------- kiểm đọc nguyên văn (F-108, T3) ---------------- */

const TU_SO = new Set(['không', 'một', 'mốt', 'hai', 'ba', 'bốn', 'tư', 'năm', 'lăm', 'nhăm', 'sáu', 'bảy', 'bẩy', 'tám', 'chín', 'mười',
  'mươi', 'trăm', 'nghìn', 'ngàn', 'triệu', 'tỷ', 'tỉ', 'linh', 'lẻ', 'rưỡi', 'k', 'tr', 'đ', 'đồng'].map((t) => boDau(t)));

/** Các con số của câu (cả số đọc bằng chữ, cách nói tắt giá) — dùng bộ đọc số của Bộ kiểm tra. */
function cacSoCau(chu) {
  const { chuanNoi } = require('../kiem-tra/kiem-so-noi');
  const { laySo } = require('../kiem-tra/quy-doi-so');
  // Chép lại hay trộn chữ và số: "một triệu 250 nghìn" (thử thật 28/10/2026) — đổi chữ số đứng trước triệu / tỷ thành số để đọc
  // như "1 triệu 250 nghìn" = 1.250.000 (chỉ ở đây, không đổi bộ đọc số chung của Bộ kiểm tra).
  const so = { 'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10 };
  const tron = String(chu).normalize('NFC').replace(/(?<![\p{L}])(một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+(triệu|tỷ|tỉ)(?=\s+\d)/giu,
    (_, a, b) => `${so[a.toLowerCase()]} ${b}`);
  return laySo(chuanNoi(tron)).map((x) => Math.round(x.giaTri * 1000) / 1000).sort((a, b) => a - b);
}

/** Các chữ thường (không dấu, bỏ số và chữ đọc số) để đếm chữ bị thiếu. */
function cacChu(chu) {
  return boDau(String(chu ?? '').normalize('NFC')).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !/\d/.test(t) && !TU_SO.has(t));
}

/**
 * Máy đọc hội thoại không bảo đảm đọc đúng nguyên văn (T3): so chữ chép lại với câu gốc trước khi phát.
 * Lệch khi con số khác nhau, hoặc thiếu hơn 20% chữ của câu gốc.
 * @returns {{dung:boolean, lyDo?:string}}
 */
function kiemDocDung(goc, chepLai) {
  const c = String(chepLai ?? '').trim();
  if (!c) return { dung: false, lyDo: 'không có chữ chép lại' };
  const a = cacSoCau(goc);
  const b = cacSoCau(c);
  if (a.length !== b.length || a.some((x, i) => Math.abs(x - b[i]) > 1e-6)) return { dung: false, lyDo: `số khác: "${goc}" đọc thành "${c}"` };
  const tuGoc = cacChu(goc);
  const con = new Map();
  for (const t of cacChu(c)) con.set(t, (con.get(t) || 0) + 1);
  let thieu = 0;
  for (const t of tuGoc) {
    if (con.get(t)) con.set(t, con.get(t) - 1);
    else thieu += 1;
  }
  if (tuGoc.length && thieu / tuGoc.length > 0.2) return { dung: false, lyDo: `thiếu ${thieu}/${tuGoc.length} chữ: "${goc}" đọc thành "${c}"` };
  return { dung: true };
}

/* ---------------- máy đọc một giọng (OpenAI, giả) ---------------- */

const MAY_MOT_GIONG = { openai: (o) => docMotOpenAi(o), gia: (o) => docMotGia(o) };

/**
 * Một lượt của máy một giọng, kiểm đọc nguyên văn TRƯỚC khi phát: tiếng giữ lại tới khi có chữ chép lại; khớp thì phát phần đã
 * giữ và phần sau đi thẳng; lệch thì bỏ tiếng, đọc lại một lần, vẫn lệch → lỗi DOC_LECH (nơi gọi lùi về hiện chữ).
 * Máy không trả chữ chép lại (chepLai undefined) thì không kiểm.
 */
async function docMotLuot(nha, l, { khiAm = null, tinHieu = null } = {}) {
  for (let lan = 0; ; lan += 1) {
    const giu = [];
    let mo = false;
    let lech = null;
    const khiChep = (chepLai) => {
      const k = kiemDocDung(l.chu, chepLai);
      if (!k.dung) { lech = k.lyDo; return false; }
      mo = true;
      if (khiAm) for (const m of giu.splice(0)) khiAm(m);
      return true;
    };
    const kq = await MAY_MOT_GIONG[nha]({
      ...l, tinHieu, khiChep,
      khiAm: (b) => { if (lech) return; if (mo) { if (khiAm) khiAm(b); } else giu.push(b); },
    });
    if (!lech && !mo && kq.chepLai !== undefined) khiChep(kq.chepLai);
    if (!lech) {
      if (!mo && khiAm) for (const m of giu.splice(0)) khiAm(m);
      return kq;
    }
    console.warn(`  [máy đọc] đọc lệch lần ${lan + 1}: ${lech}`);
    if (lan >= 1 || tinHieu?.aborted) {
      throw new LoiAi('Máy đọc đọc lệch câu gốc — câu này hiện chữ để người dẫn đọc.', { nha, ma: 'DOC_LECH', goc: l.chu, lyDo: lech });
    }
  }
}

/**
 * Đọc nhiều lượt bằng máy một giọng (mỗi lượt một lần gọi, lần lượt), giữa hai người nghỉ 0,2 giây. ElevenLabs đọc cả hội thoại
 * trong một lần (Text-to-Dialogue), không cần so chữ.
 */
async function docLuot({ nha, model, luot, khiAm = null, tinHieu = null }) {
  if (nha === 'elevenlabs') {
    const kq = await docEleven.docLuot({ luot, khiAm, tinHieu });
    return { wav: bocWav(kq.pcm), pcm: kq.pcm, tanSo: 24000, giay: kq.giay, token: kq.token, model };
  }
  const phan = [];
  const token = { vao: 0, ra: 0 };
  const nghi = Buffer.alloc(Math.round(24000 * 0.2) * 2);
  for (const [i, l] of luot.entries()) {
    if (i) { phan.push(nghi); if (khiAm) khiAm(nghi); }
    const kq = await docMotLuot(nha, l, { khiAm, tinHieu });
    phan.push(kq.pcm);
    for (const [k, v] of Object.entries(kq.token || {})) token[k] = (token[k] || 0) + v;
  }
  const pcm = Buffer.concat(phan);
  return { wav: bocWav(pcm), pcm, tanSo: 24000, giay: pcm.length / 48000, token, model };
}

/* ---------------- đọc ---------------- */

/**
 * Đọc một đoạn chữ bằng một giọng.
 * @param {object} o
 * @param {string} o.chu
 * @param {string} o.giong      mã giọng: voice_… (tự tạo), vi-vn-… (kho), hoặc tên giọng có sẵn như Kore
 * @param {string} [o.model]
 * @param {string} [o.phongCach] cảm xúc, nhịp cho cả đoạn (speech_metadata.style), ví dụ "ấm áp, thân thiện"
 * @param {(pcm:Buffer) => void} [o.khiAm]  có thì đọc kiểu phát dần: nhận từng mẩu PCM 24 kHz ngay khi Google gửi
 * @param {AbortSignal} [o.tinHieu]
 */
async function docChu({ chu, giong, model = modelMacDinh(), phongCach = null, khiAm = null, tinHieu = null }) {
  const c = String(chu ?? '').trim();
  if (!c) throw new LoiAi('Chưa có chữ để đọc.', { nha: NHA });
  if (!giong) throw new LoiAi('Chưa chọn giọng để đọc.', { nha: NHA });
  if (laMotGiong(model)) return docLuot({ nha: nhaCuaModel(model), model, luot: [{ chu: c, giong, phongCach }], khiAm, tinHieu });
  const m = chonModel(model);
  const noiDung = { type: 'text', text: c };
  if (phongCach && !KHONG_CHU_THICH.has(m)) noiDung.annotations = [{ type: 'speech_metadata', style: String(phongCach) }];
  const than = {
    model: m,
    input: [{ type: 'user_input', content: [noiDung] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice: giong }] },
  };
  if (khiAm) return ketQuaPhatDan(await goiPhatDan(than, khiAm, { tinHieu }), m);
  return ketQuaDoc(await goi('/interactions', { method: 'POST', than }), m);
}

function ketQuaPhatDan({ pcm, usage }, model) {
  return { wav: bocWav(pcm), pcm, tanSo: 24000, giay: pcm.length / 48000, token: soToken({ usage }), model };
}

/**
 * Hai người nói trong một lần đọc (kiểu conversational của Gemini TTS: tối đa 2 người, giọng có sẵn).
 * @param {object} o
 * @param {{nguoi:string, chu:string, phongCach?:string}[]} o.luot   `nguoi` là nhãn chữ không dấu, ví dụ NguoiDan
 * @param {Object<string,string>} o.giong   nhãn → mã giọng
 * @param {(pcm:Buffer) => void} [o.khiAm]  có thì đọc kiểu phát dần (bản 2.9)
 * @param {AbortSignal} [o.tinHieu]
 */
async function docHoiThoai({ luot, giong, model = modelMacDinh(), khiAm = null, tinHieu = null }) {
  const ds = (luot || []).filter((l) => String(l?.chu ?? '').trim());
  const nguoi = [...new Set(ds.map((l) => l.nguoi))];
  if (!ds.length) throw new LoiAi('Chưa có câu nào để đọc.', { nha: NHA });
  // Máy một giọng (OpenAI, ElevenLabs, giả): gộp các lượt liền nhau cùng người, đọc lần lượt (không giới hạn số người).
  if (laMotGiong(model)) {
    const gop = [];
    for (const l of ds) {
      const cuoi = gop.at(-1);
      if (cuoi && cuoi.nguoi === l.nguoi && (cuoi.phongCach || null) === (l.phongCach || null)) cuoi.chu += ` ${String(l.chu).trim()}`;
      else gop.push({ nguoi: l.nguoi, chu: String(l.chu).trim(), phongCach: l.phongCach || null });
    }
    return docLuot({ nha: nhaCuaModel(model), model, luot: gop.map((l) => ({ chu: l.chu, giong: giong[l.nguoi], phongCach: l.phongCach })), khiAm, tinHieu });
  }
  if (nguoi.length > 2) throw new LoiAi('Gemini TTS chỉ đọc tối đa 2 người trong một lần.', { nha: NHA });
  if (nguoi.length === 1) {
    return docChu({ chu: ds.map((l) => l.chu).join(' '), giong: giong[nguoi[0]], model, phongCach: ds[0].phongCach, khiAm, tinHieu });
  }
  const m = chonModel(model);
  // Máy không nhận chú thích (3.1): cả đoạn thoại một khối chữ "Tên: lời", giọng theo tên người nói (thử 25/9/2026).
  const than = KHONG_CHU_THICH.has(m) ? {
    model: m,
    input: [{ type: 'user_input', content: [{ type: 'text', text: ds.map((l) => `${l.nguoi}: ${String(l.chu).trim()}`).join('\n') }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: nguoi.map((n) => ({ speaker: n, voice: giong[n] })) },
  } : {
    model: m,
    input: [{
      type: 'user_input',
      content: ds.map((l) => ({
        type: 'text',
        text: String(l.chu).trim(),
        annotations: [{ type: 'speech_metadata', speaker: l.nguoi, ...(l.phongCach ? { style: String(l.phongCach) } : {}) }],
      })),
    }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: { mode: 'conversational', speakers: nguoi.map((n) => ({ speaker: n, voice: giong[n] })) } },
  };
  if (khiAm) return ketQuaPhatDan(await goiPhatDan(than, khiAm, { tinHieu }), m);
  return ketQuaDoc(await goi('/interactions', { method: 'POST', than }), m);
}

/* ---------------- giọng ---------------- */

function giongGon(v) {
  return {
    id: v.id,
    ten: v.display_name || v.id,
    gioi: v.gender === 'female' ? 'nu' : v.gender === 'male' ? 'nam' : null,
    cao_do: v.pitch || null,
    phong_cach: v.persona || '',
    mo_ta: v.description || '',
  };
}

/**
 * Giọng có sẵn tiếng Việt trong kho của Google (hơn 2.000 giọng mọi thứ tiếng; lọc vi-VN).
 * @param {{gioi?:string, tim?:string, trang?:string, soLuong?:number}} o   gioi: 'nu' | 'nam' | ''
 */
async function dsGiongKho({ gioi = '', tim = '', trang = '', soLuong = 50 } = {}) {
  const q = new URLSearchParams({ language_code: 'vi-VN', type: 'prebuilt', page_size: String(soLuong) });
  if (gioi === 'nu' || gioi === 'nam') q.set('gender', gioi === 'nu' ? 'female' : 'male');
  if (tim) q.set('search', String(tim).slice(0, 80));
  if (trang) q.set('page_token', String(trang));
  const d = await goi(`/voices?${q}`);
  return { giong: (d.voices || []).filter((v) => v.type !== 'prompted' && v.type !== 'replicated').map(giongGon), trangSau: d.next_page_token || null };
}

function ketQuaTao(d) {
  const id = d.id || d.replicated_voice?.id || d.voice?.id || d.replicated_voice?.key;
  if (!id) throw new LoiAi('Google không trả mã giọng.', { nha: NHA });
  return {
    id: String(id).replace(/^voices\//, ''),
    hetHan: d.expire_time || d.replicated_voice?.expire_time || null,
    mau: d.sample_audio?.data ? Buffer.from(d.sample_audio.data, 'base64') : null,
    token: soToken(d),
    model: MODEL_TAO_GIONG,
  };
}

/** Tạo giọng theo câu tả (voice design). gioi: 'female' | 'male'. */
async function taoGiongTa({ ten, gioi, moTa }) {
  const d = await goi('/voices', {
    method: 'POST',
    gioiHanMs: TAO_TOI_DA_MS,
    than: { store: true, voice: { type: 'prompted', display_name: ten, gender: gioi, language_code: 'vi-VN', prompted: { input: moTa } } },
  });
  return ketQuaTao(d);
}

/** Nhân bản giọng người thật: đoạn mẫu 10–30 giây và câu đồng ý do chính người đó đọc (WAV). */
async function nhanBanGiong({ ten, amMau, amDongY }) {
  const d = await goi('/voices', {
    method: 'POST',
    gioiHanMs: TAO_TOI_DA_MS,
    than: {
      store: true,
      voice: {
        type: 'replicated',
        display_name: ten,
        language_code: 'vi-VN',
        replicated: {
          source_audio: { mime_type: 'audio/wav', data: amMau.toString('base64') },
          consent_audio: { mime_type: 'audio/wav', data: amDongY.toString('base64') },
        },
      },
    },
  });
  return ketQuaTao(d);
}

/** Xóa giọng tự tạo ở Google. Google báo không còn giọng đó thì coi như đã xóa. */
async function xoaGiong(id) {
  try {
    await goi(`/voices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {
    if (e.http === 404) return;
    throw e;
  }
}

/**
 * Làm một bài nhạc bằng Lyria 3.5 (bản 2.9, F-47): MP3 44,1 kHz stereo, bài dài 1–3 phút, có dấu SynthID. Lyria 3.5
 * chưa trả được WAV (thử 24/9/2026: `AUDIO_WAV`, `AUDIO_L16` bị báo "not supported for models/lyria-3.5", dù tài liệu
 * ghi có) → nhận MP3, doi-ai/nhac.js giải mã. Phần chữ Lyria trả kèm là lời hát có mốc giờ ("[12.0:] …").
 * @returns {Promise<{tep:Buffer, mime:string, loiBai:string, model:string}>}
 */
async function taoNhac({ moTa }) {
  const d = await goi('/interactions', {
    method: 'POST',
    gioiHanMs: NHAC_TOI_DA_MS,
    than: { model: MODEL_NHAC, input: String(moTa) },
  });
  const noi = (d.steps || []).flatMap((s) => s.content || []);
  const am = noi.find((c) => c.type === 'audio' && c.data);
  if (!am) {
    const lyDo = d.status && d.status !== 'completed' ? d.status : '';
    throw new LoiAi(`Google không trả nhạc${lyDo ? ` (${lyDo})` : ''}. Lời tả không được nêu tên ca sĩ, bài hát có thật.`, { nha: NHA });
  }
  return {
    tep: Buffer.from(am.data, 'base64'),
    mime: am.mime_type || '',
    loiBai: noi.filter((c) => c.type === 'text' && c.text).map((c) => c.text).join('\n'),
    model: MODEL_NHAC,
  };
}

/**
 * Cho Gemini nghe một đoạn tiếng (WAV) và trả lời theo JSON. Model đầu quá tải hay lỗi thì thử model kế; cả ba cùng
 * quá tải (gặp 24/9/2026) thì chờ vài giây rồi thử lại, tối đa `thuLai` lượt.
 * @returns {Promise<{ketQua:object, model:string, token:{vao:number, ra:number}}>}
 */
async function ngheTieng({ wav, cau, thuLai = 2, choMs = 3000 }) {
  let loi = null;
  for (let lan = 0; lan <= thuLai; lan += 1) {
    if (lan) await new Promise((r) => setTimeout(r, choMs * lan));
    for (const model of MODEL_NGHE) {
      try {
        return await ngheMot(model, wav, cau);
      } catch (e) {
        loi = e;
      }
    }
  }
  throw loi;
}

async function ngheMot(model, wav, cau) {
  const d = await goi(`/models/${model}:generateContent`, {
    method: 'POST',
    gioiHanMs: 60000,
    than: {
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }, { text: cau }] }],
      generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } },
    },
  });
  const chu = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  const u = d.usageMetadata || {};
  return { ketQua: JSON.parse(chu), model, token: { vao: u.promptTokenCount || 0, ra: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
}

module.exports = {
  docChu, docHoiThoai, dsGiongKho, taoGiongTa, nhanBanGiong, xoaGiong, taoNhac, ngheTieng,
  bocWav, tachWav, soGiay, datFetch, MODEL_DOC, MAC_DINH, MODEL_TAO_GIONG, MODEL_NHAC, loiGoogle, MODEL_DU_PHONG,
  MODEL_OPENAI, GIONG_OPENAI, laOpenAi, nhaDoc, datNhaDoc, modelMacDinh, MODEL_GIA, MODEL_ELEVEN, datDocSai, nhaCuaModel, laMotGiong, kiemDocDung,
};
