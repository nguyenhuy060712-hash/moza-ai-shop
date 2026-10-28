'use strict';

/**
 * Máy đọc OpenAI qua Realtime API (BH10, F-108; docs/11 mục 1 T1–T3, mục 4.2). OpenAI tắt máy đọc cũ (Speech API) ngày 6/1/2027 và chỉ
 * định thay bằng `gpt-realtime-2.1-mini` — không còn đường "gửi chữ nhận tệp", phải mở phiên WebSocket.
 *  - Mỗi giọng một phiên (không đổi giọng được sau tiếng đầu); rảnh 2 phút thì đóng; phiên tối đa 60 phút nên tới 55 phút mở phiên mới.
 *  - Mỗi câu một `response.create` ngoài hội thoại (`conversation: 'none'`) để câu trước không ảnh hưởng câu sau; câu trong một
 *    phiên đọc lần lượt.
 *  - Tiếng ra `audio/pcm` 24 kHz (base64 trong `response.output_audio.delta`); chữ chép lại tiếng ra ở
 *    `response.output_audio_transcript.delta / .done` — tts.js so với câu gốc trước khi phát (model hội thoại không bảo đảm đọc nguyên văn).
 *  - Hủy bằng `response.cancel`. Chi phí theo `usage` của `response.done`.
 * Kết nối tiêm được (`datKetNoi`) để test dùng máy chủ giả phát đúng tên sự kiện trong tài liệu (SDK chỉ cho địa chỉ wss://).
 */

const OpenAISdk = require('openai');
const khoa = require('../../khoa');
const { LoiAi, bocLoi } = require('./chung');

const OpenAI = OpenAISdk.default || OpenAISdk;

const MODEL = 'gpt-realtime-2.1-mini';
const RANH_TOI_DA_MS = 2 * 60 * 1000;
const TUOI_TOI_DA_MS = 55 * 60 * 1000;
const MO_TOI_DA_MS = 10000;
const CAU_TOI_DA_MS = 90000;

const LOI_DAN_DOC = 'Bạn là máy đọc. Đọc đúng nguyên văn câu được gửi bằng tiếng Việt, giọng miền Bắc tự nhiên, liền mạch như người dẫn '
  + 'livestream bán hàng; không thêm, bớt, đổi chữ; không trả lời, không hỏi lại; con số và giá đọc đúng như viết.';

/** Kết nối thật: OpenAIRealtimeWS của SDK (mẫu như chép lời người dẫn, chep-loi.js). */
function ketNoiThat({ model, apiKey }) {
  const { OpenAIRealtimeWS } = require('openai/realtime/ws');
  return new OpenAIRealtimeWS({ model }, new OpenAI({ apiKey }));
}

let taoKetNoi = ketNoiThat;
/** Test thay kết nối bằng bản giả: hàm ({model, apiKey}) → { socket (on/once 'open' 'close' 'error'), on(type, fn), send(obj), close() }. */
function datKetNoi(f) {
  taoKetNoi = f || ketNoiThat;
  dongHet();
}

const phien = new Map(); // giọng → PhienDoc

class PhienDoc {
  constructor(giong) {
    this.giong = giong;
    this.luc = 0;
    this.song = false;
    this.hang = Promise.resolve();
    this.dang = null; // câu đang đọc
    this.henRanh = null;
  }

  async mo() {
    const k = khoa.lay('openai');
    if (!k) throw new LoiAi('Chưa có khóa OpenAI. Dán khóa trong Cài đặt → Khóa AI.', { nha: 'openai', ma: 'CHUA_CO_KHOA' });
    const rt = taoKetNoi({ model: MODEL, apiKey: k });
    this.rt = rt;
    await new Promise((ok, loi) => {
      const hen = setTimeout(() => loi(new LoiAi('OpenAI mở phiên đọc giọng quá lâu.', { nha: 'openai', ma: 'QUA_THOI_GIAN' })), MO_TOI_DA_MS);
      rt.socket.once('open', () => { clearTimeout(hen); ok(); });
      rt.socket.once('error', (e) => { clearTimeout(hen); loi(bocLoi(e, 'openai')); });
    });
    this.song = true;
    this.luc = Date.now();
    rt.socket.on('close', () => this.chet(new LoiAi('Mất kết nối khi OpenAI đang đọc.', { nha: 'openai' })));
    rt.on('error', (e) => {
      // Hủy câu vừa đọc xong (chữ chép lại về sau tiếng cuối): OpenAI báo response_cancel_not_active — không phải lỗi đọc (thử thật 28/10/2026).
      if (/response_cancel_not_active/.test(`${e?.error?.code || ''} ${e?.code || ''} ${e?.error?.message || ''} ${e?.message || ''}`)) return;
      const loi = bocLoi(e?.error || e, 'openai');
      if (this.dang) this.dang.loi(loi);
      else console.error(`  [máy đọc] OpenAI báo lỗi: ${loi.message}`);
    });
    rt.on('response.created', (e) => { if (this.dang && !this.dang.id) this.dang.id = e.response?.id || null; });
    rt.on('response.output_audio.delta', (e) => this.dang?.am(e.delta));
    rt.on('response.output_audio_transcript.delta', (e) => { if (this.dang) this.dang.chep += e.delta || ''; });
    rt.on('response.output_audio_transcript.done', (e) => this.dang?.chepXong(e.transcript));
    rt.on('response.done', (e) => this.dang?.xong(e.response));
    rt.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        output_modalities: ['audio'],
        instructions: LOI_DAN_DOC,
        audio: { output: { voice: this.giong, format: { type: 'audio/pcm', rate: 24000 } } },
      },
    });
  }

  chet(loi) {
    if (!this.song) return;
    this.song = false;
    clearTimeout(this.henRanh);
    if (phien.get(this.giong) === this) phien.delete(this.giong);
    this.dang?.loi(loi);
  }

  dong() {
    this.chet(new LoiAi('Phiên đọc giọng đã đóng.', { nha: 'openai' }));
    try { this.rt?.close(); } catch { /* đã đóng */ }
  }

  /** Đọc một câu (xếp hàng sau câu trước của cùng giọng). */
  doc(o) {
    const lam = this.hang.then(() => this.docNgay(o));
    this.hang = lam.catch(() => {});
    return lam;
  }

  async docNgay({ chu, phongCach = null, khiAm = null, khiChep = null, tinHieu = null }) {
    clearTimeout(this.henRanh);
    if (!this.song) await this.mo();
    const manh = [];
    const kq = await new Promise((ok, loi) => {
      let xong = false;
      const c = {
        id: null,
        chep: '',
        daChep: false,
        am: (b64) => {
          if (xong || !b64) return;
          const b = Buffer.from(b64, 'base64');
          const m = b.subarray(0, b.length - (b.length % 2));
          if (!m.length) return;
          manh.push(m);
          if (khiAm) khiAm(m);
        },
        chepXong: (t) => {
          if (c.daChep) return;
          c.daChep = true;
          c.chep = typeof t === 'string' ? t : c.chep;
          // tts.js trả false khi chữ chép lại lệch câu gốc: hủy câu cho đỡ tốn tiền.
          if (khiChep && khiChep(c.chep) === false) this.huy(c);
        },
        xong: (r) => {
          if (xong) return;
          if (r?.status === 'failed') { c.loi(new LoiAi(`OpenAI không đọc được câu này: ${r.status_details?.error?.message || 'lỗi'}`, { nha: 'openai' })); return; }
          xong = true;
          ket();
          const u = r?.usage || {};
          ok({
            chepLai: c.chep,
            token: {
              vao: u.input_tokens || 0,
              ra: u.output_token_details?.audio_tokens ?? u.output_tokens ?? 0,
              ra_chu: u.output_token_details?.text_tokens || 0,
            },
            huy: r?.status === 'cancelled',
          });
        },
        loi: (e) => {
          if (xong) return;
          xong = true;
          ket();
          loi(e);
        },
      };
      const hen = setTimeout(() => { this.huy(c); c.loi(new LoiAi('OpenAI đọc quá lâu.', { nha: 'openai', ma: 'QUA_THOI_GIAN' })); }, CAU_TOI_DA_MS);
      const khiHuy = () => { this.huy(c); c.loi(new LoiAi('Đã dừng đọc.', { nha: 'openai', ma: 'QUA_THOI_GIAN' })); };
      if (tinHieu?.aborted) { khiHuy(); return; }
      tinHieu?.addEventListener('abort', khiHuy, { once: true });
      const ket = () => {
        clearTimeout(hen);
        tinHieu?.removeEventListener('abort', khiHuy);
        if (this.dang === c) this.dang = null;
      };
      this.dang = c;
      this.rt.send({
        type: 'response.create',
        response: {
          conversation: 'none',
          output_modalities: ['audio'],
          ...(phongCach ? { instructions: `${LOI_DAN_DOC} Cách nói: ${phongCach}.` } : {}),
          input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: chu }] }],
        },
      });
    });
    this.henGio();
    const pcm = Buffer.concat(manh);
    if (!pcm.length && !kq.huy) throw new LoiAi('OpenAI không trả tiếng cho câu này.', { nha: 'openai' });
    return { pcm, giay: pcm.length / 48000, chepLai: kq.chepLai, token: kq.token };
  }

  huy(c) {
    try { this.rt?.send({ type: 'response.cancel', ...(c?.id ? { response_id: c.id } : {}) }); } catch { /* đã đóng */ }
  }

  /** Rảnh 2 phút thì đóng; tới 55 phút thì đóng để câu sau mở phiên mới (phiên tối đa 60 phút). */
  henGio() {
    if (Date.now() - this.luc >= TUOI_TOI_DA_MS) { this.dong(); return; }
    clearTimeout(this.henRanh);
    this.henRanh = setTimeout(() => this.dong(), Math.min(RANH_TOI_DA_MS, TUOI_TOI_DA_MS - (Date.now() - this.luc)));
    this.henRanh.unref?.();
  }
}

/**
 * Đọc một câu bằng giọng `giong` (phiên của giọng đó; chưa có thì mở).
 * @returns {Promise<{pcm:Buffer, giay:number, chepLai:string, token:{vao:number, ra:number, ra_chu:number}}>}
 */
function docCau({ giong, ...o }) {
  let p = phien.get(giong);
  if (!p || (p.song && Date.now() - p.luc >= TUOI_TOI_DA_MS && !p.dang)) {
    p?.dong();
    p = new PhienDoc(giong);
    phien.set(giong, p);
  }
  return p.doc(o);
}

/** Đóng mọi phiên (tắt phần mềm, test). */
function dongHet() {
  for (const p of [...phien.values()]) p.dong();
  phien.clear();
}

const dsPhien = () => [...phien.values()].map((p) => ({ giong: p.giong, song: p.song, luc: p.luc }));

module.exports = { docCau, dongHet, datKetNoi, dsPhien, MODEL, LOI_DAN_DOC, RANH_TOI_DA_MS, TUOI_TOI_DA_MS };
