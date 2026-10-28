'use strict';

/**
 * Máy đọc ElevenLabs (BH10, F-108; docs/11 mục 1 T9, mục 4.2) — gọi REST bằng fetch, không thêm SDK.
 *  - `eleven_v4` có tiếng Việt (28/9/2026). Đường `/v1/text-to-speech` với v4 còn [CHƯA KIỂM] → dùng **Text-to-Dialogue**
 *    `POST /v1/text-to-dialogue?output_format=pcm_24000` cho cả câu một giọng (≤ 10 giọng, ≤ 2.000 ký tự mỗi lần — dài hơn thì chia).
 *  - Tiếng ra PCM 16-bit 24 kHz một kênh, khớp đường âm thanh hiện có. Đọc thẳng chữ nên không cần so chữ chép lại.
 *  - Chi phí theo ký tự (gia-model.json `tts_ky_tu`: v4 0,08 USD / 1.000 ký tự).
 *  - Tìm giọng tiếng Việt: `GET /v1/shared-voices?language=vi` (miễn phí, có `preview_url` để nghe); bấm "Dùng" →
 *    `POST /v1/voices/add/{public_owner_id}/{voice_id}` để đưa vào thư viện giọng của tài khoản.
 * Chưa có khóa (28/10/2026): test dùng fetch giả (datFetch). Phép thử thật chờ chủ dự án dán khóa ở Cài đặt → Khóa AI.
 */

const khoa = require('../../khoa');
const { LoiAi } = require('./chung');

const GOC = 'https://api.elevenlabs.io';
const MODEL = 'eleven_v4';
const KY_TU_MOI_LAN = 2000;
const GIONG_MOI_LAN = 10;
const DOC_TOI_DA_MS = 90000;

let goiMang = (...a) => fetch(...a);
/** Test thay mạng bằng fetch giả; không truyền gì thì dùng lại fetch thật. */
function datFetch(f) {
  goiMang = f || ((...a) => fetch(...a));
}

function layKhoa() {
  const k = khoa.lay('elevenlabs');
  if (!k) throw new LoiAi('Chưa có khóa ElevenLabs. Dán khóa trong Cài đặt → Khóa AI.', { nha: 'elevenlabs', ma: 'CHUA_CO_KHOA' });
  return k;
}

function loiEleven(ma, thongDiep) {
  const t = String(thongDiep || '').trim();
  const o = { nha: 'elevenlabs', http: ma };
  if (ma === 401) return new LoiAi('ElevenLabs không nhận khóa hiện tại. Kiểm lại khóa trong Cài đặt → Khóa AI.', o);
  if (ma === 402 || /quota|credit/i.test(t)) return new LoiAi('Tài khoản ElevenLabs đã hết lượt ký tự của gói. Nâng gói ở elevenlabs.io.', o);
  if (ma === 429) return new LoiAi('ElevenLabs đang giới hạn lượt gọi. Đợi một phút rồi thử lại.', o);
  if (ma >= 500) return new LoiAi(`Máy chủ ElevenLabs đang lỗi (${ma}). Thử lại sau ít phút.`, o);
  return new LoiAi(`ElevenLabs từ chối (${ma}): ${t.slice(0, 300)}`, o);
}

async function goi(duong, { method = 'GET', than = null, tinHieu = null, gioiHanMs = 30000 } = {}) {
  const k = layKhoa();
  const huy = tinHieu ? AbortSignal.any([AbortSignal.timeout(gioiHanMs), tinHieu]) : AbortSignal.timeout(gioiHanMs);
  let res;
  try {
    res = await goiMang(`${GOC}${duong}`, {
      method,
      headers: { 'xi-api-key': k, ...(than ? { 'Content-Type': 'application/json' } : {}) },
      body: than ? JSON.stringify(than) : undefined,
      signal: huy,
    });
  } catch (e) {
    const het = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new LoiAi(het ? 'ElevenLabs đọc quá lâu hoặc đã bị dừng.' : `Không gọi được ElevenLabs: ${e.message}`, { nha: 'elevenlabs', ma: het ? 'QUA_THOI_GIAN' : 'AI_LOI' });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    let d = null;
    try { d = JSON.parse(t); } catch { /* không phải JSON */ }
    throw loiEleven(res.status, d?.detail?.message || d?.detail || t);
  }
  return res;
}

/** Chia các lượt thành từng lần gọi: ≤ 2.000 ký tự và ≤ 10 giọng mỗi lần. */
function chiaLan(luot) {
  const lan = [];
  let cur = [];
  let dai = 0;
  for (const l of luot) {
    const giong = new Set(cur.map((x) => x.voice_id));
    if (cur.length && (dai + l.text.length > KY_TU_MOI_LAN || (!giong.has(l.voice_id) && giong.size >= GIONG_MOI_LAN))) {
      lan.push(cur);
      cur = [];
      dai = 0;
    }
    cur.push(l);
    dai += l.text.length;
  }
  if (cur.length) lan.push(cur);
  return lan;
}

/**
 * Đọc các lượt (mỗi lượt một giọng ElevenLabs) qua Text-to-Dialogue; có khiAm thì đẩy dần từng mẩu PCM (luôn chẵn byte).
 * @param {{chu:string, giong:string}[]} luot   giong = voice_id ElevenLabs
 * @returns {Promise<{pcm:Buffer, giay:number, token:{ky_tu:number}}>}
 */
async function docLuot({ luot, khiAm = null, tinHieu = null }) {
  const ds = luot.map((l) => ({ text: String(l.chu).trim(), voice_id: l.giong })).filter((l) => l.text);
  const thieu = ds.find((l) => !l.voice_id);
  if (thieu) throw new LoiAi('Chưa chọn giọng ElevenLabs cho nhân vật này (Cài đặt → Giọng → Giọng ElevenLabs).', { nha: 'elevenlabs', ma: 'CHUA_CO_GIONG' });
  const manh = [];
  for (const phan of chiaLan(ds)) {
    const res = await goi(`/v1/text-to-dialogue?output_format=pcm_24000`, {
      method: 'POST', than: { inputs: phan, model_id: MODEL, language_code: 'vi' }, tinHieu, gioiHanMs: DOC_TOI_DA_MS,
    });
    let du = Buffer.alloc(0);
    try {
      for await (const b of res.body) {
        const tat = Buffer.concat([du, Buffer.from(b)]);
        const chan = tat.length - (tat.length % 2);
        du = tat.subarray(chan);
        if (!chan) continue;
        const m = Buffer.from(tat.subarray(0, chan));
        manh.push(m);
        if (khiAm) khiAm(m);
      }
    } catch (e) {
      const het = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      throw new LoiAi(het ? 'ElevenLabs đọc quá lâu hoặc đã bị dừng.' : `Mất kết nối khi ElevenLabs đang đọc: ${e.message}`, { nha: 'elevenlabs', ma: het ? 'QUA_THOI_GIAN' : 'AI_LOI' });
    }
  }
  const pcm = Buffer.concat(manh);
  if (!pcm.length) throw new LoiAi('ElevenLabs không trả tiếng cho câu này.', { nha: 'elevenlabs' });
  return { pcm, giay: pcm.length / 48000, token: { ky_tu: ds.reduce((n, l) => n + l.text.length, 0) } };
}

/** Giọng tiếng Việt trong thư viện chung của ElevenLabs (miễn phí). `gioi`: 'nam' | 'nu' | ''. */
async function dsGiong({ gioi = '', trang = 0 } = {}) {
  const q = new URLSearchParams({ language: 'vi', page_size: '30', page: String(trang) });
  if (gioi) q.set('gender', gioi === 'nam' ? 'male' : 'female');
  const d = await (await goi(`/v1/shared-voices?${q}`)).json();
  return (d.voices || []).map((v) => ({
    voice_id: v.voice_id, owner_id: v.public_owner_id, ten: v.name, gioi: v.gender === 'male' ? 'nam' : v.gender === 'female' ? 'nu' : '',
    giong_vung: v.accent || null, mo_ta: v.description || '', nghe_thu: v.preview_url || null,
  }));
}

/** Đưa một giọng của thư viện chung vào tài khoản (cần trước khi đọc bằng giọng đó). Trả voice_id dùng để đọc. */
async function themGiong({ ownerId, voiceId, ten }) {
  if (!ownerId || !voiceId) throw new LoiAi('Thiếu mã giọng ElevenLabs.', { nha: 'elevenlabs', ma: 'DU_LIEU_KHONG_HOP_LE' });
  const d = await (await goi(`/v1/voices/add/${encodeURIComponent(ownerId)}/${encodeURIComponent(voiceId)}`, {
    method: 'POST', than: { new_name: String(ten || voiceId).slice(0, 100) },
  })).json();
  return d.voice_id || voiceId;
}

module.exports = { docLuot, dsGiong, themGiong, datFetch, chiaLan, MODEL };
