'use strict';

/**
 * Dịch vụ chép lời trực tiếp cho người dẫn ở chế độ "Chỉ gợi ý" (SPEC.md F-21, mục 6, #33).
 *  - Gemini: `gemini-3.5-transcribe-live` qua Live API — PCM 16 kHz; có kết quả tạm (interimInputTranscription)
 *    và kết quả chốt (inputTranscription); tự nhận biết lượt nói; mỗi phiên tối đa 10 phút.
 *  - OpenAI (dự phòng): `gpt-live-transcribe`, phiên "transcription" của Realtime API — PCM 24 kHz;
 *    không tự nhận biết lượt nói nên MOZA chốt đoạn khi micro báo người dẫn thôi nói.
 * Cả hai cùng một mặt: mo() → guiAm(pcm16k) / chot() / dong(); gọi lại khiTam(chữ), khiXong(chữ), khiLoi(e), khiDong().
 */

const { GoogleGenAI, Modality } = require('@google/genai');
const OpenAISdk = require('openai');
const khoa = require('../../khoa');
const { LoiAi, bocLoi } = require('./chung');

const OpenAI = OpenAISdk.default || OpenAISdk;

/** F-87: từ riêng không chứa <, > hay xuống dòng (OpenAI từ chối cả phiên), không rỗng. */
const sachTu = (ds) => (ds || []).map((x) => String(x).replace(/[<>\r\n]+/g, ' ').trim()).filter(Boolean);

/** PCM 16-bit 16 kHz → 24 kHz (nội suy tuyến tính) cho OpenAI. */
function doi16Sang24(pcm16) {
  const vao = new Int16Array(pcm16.buffer, pcm16.byteOffset, Math.floor(pcm16.byteLength / 2));
  const soRa = Math.floor((vao.length * 3) / 2);
  const ra = new Int16Array(soRa);
  for (let j = 0; j < soRa; j++) {
    const x = (j * 2) / 3;
    const i = Math.floor(x);
    const t = x - i;
    const a = vao[i];
    const b = vao[Math.min(i + 1, vao.length - 1)];
    ra[j] = Math.round(a + (b - a) * t);
  }
  return Buffer.from(ra.buffer);
}

class ChepLoiGemini {
  constructor({ tuRieng = [], khiTam, khiXong, khiLoi, khiDong }) {
    Object.assign(this, { tuRieng, khiTam, khiXong, khiLoi, khiDong });
    this.nha = 'gemini';
    this.model = 'gemini-3.5-transcribe-live';
    this.giayAm = 0;
    this.tokenVao = 0;
    this.tokenRa = 0;
  }

  async mo() {
    const k = khoa.lay('gemini');
    if (!k) throw new LoiAi('Chưa có khóa Gemini.', { nha: 'gemini', ma: 'CHUA_CO_KHOA' });
    const ai = new GoogleGenAI({ apiKey: k });
    try {
      this.phien = await ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.TEXT],
          inputAudioTranscription: { languageCodes: ['vi-VN'], customVocabulary: sachTu(this.tuRieng).slice(0, 100) },
        },
        callbacks: {
          onmessage: (m) => {
            const c = m.serverContent;
            if (c?.interimInputTranscription?.text) this.khiTam(c.interimInputTranscription.text);
            if (c?.inputTranscription?.text) this.khiXong(c.inputTranscription.text);
            const u = m.usageMetadata;
            if (u) {
              this.tokenVao = Math.max(this.tokenVao, u.promptTokenCount || 0);
              this.tokenRa = Math.max(this.tokenRa, (u.responseTokenCount || u.candidatesTokenCount || 0));
            }
          },
          onerror: (e) => this.khiLoi(bocLoi(e?.error || e, 'gemini')),
          onclose: () => this.khiDong?.(),
        },
      });
    } catch (e) {
      throw bocLoi(e, 'gemini');
    }
  }

  guiAm(pcm16) {
    this.giayAm += pcm16.length / 2 / 16000;
    this.phien?.sendRealtimeInput({ audio: { data: pcm16.toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
  }

  // Gemini tự nhận biết lượt nói; không cần chốt tay.
  chot() {}

  dong() {
    try { this.phien?.close(); } catch { /* đã đóng */ }
    this.phien = null;
  }
}

class ChepLoiOpenAI {
  constructor({ tuRieng = [], khiTam, khiXong, khiLoi, khiDong }) {
    Object.assign(this, { tuRieng, khiTam, khiXong, khiLoi, khiDong });
    this.nha = 'openai';
    this.model = 'gpt-live-transcribe';
    this.giayAm = 0;
    this.tokenVao = 0;
    this.tokenRa = 0;
    this.dangTam = '';
    this.coAm = false;
  }

  async mo() {
    const k = khoa.lay('openai');
    if (!k) throw new LoiAi('Chưa có khóa OpenAI.', { nha: 'openai', ma: 'CHUA_CO_KHOA' });
    const { OpenAIRealtimeWS } = require('openai/realtime/ws');
    const rt = new OpenAIRealtimeWS({ intent: 'transcription' }, new OpenAI({ apiKey: k }));
    this.rt = rt;
    await new Promise((ok, loi) => {
      const hen = setTimeout(() => loi(new LoiAi('OpenAI mở phiên chép lời quá lâu.', { nha: 'openai', ma: 'QUA_THOI_GIAN' })), 10000);
      rt.socket.once('open', () => { clearTimeout(hen); ok(); });
      rt.socket.once('error', (e) => { clearTimeout(hen); loi(bocLoi(e, 'openai')); });
    });
    rt.on('error', (e) => this.khiLoi(bocLoi(e?.error || e, 'openai')));
    rt.socket.on('close', () => this.khiDong?.());
    rt.on('conversation.item.input_audio_transcription.delta', (e) => {
      this.dangTam += e.delta || '';
      this.khiTam(this.dangTam);
    });
    rt.on('conversation.item.input_audio_transcription.completed', (e) => {
      this.dangTam = '';
      if (e.transcript) this.khiXong(e.transcript);
      const u = e.usage;
      if (u) {
        this.tokenVao += u.input_tokens || 0;
        this.tokenRa += u.output_tokens || 0;
      }
    });
    rt.send({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: this.model, languages: ['vi'], keywords: sachTu(this.tuRieng).slice(0, 100), delay: 'low' },
            turn_detection: null,
          },
        },
      },
    });
  }

  guiAm(pcm16) {
    this.giayAm += pcm16.length / 2 / 16000;
    this.coAm = true;
    this.rt?.send({ type: 'input_audio_buffer.append', audio: doi16Sang24(pcm16).toString('base64') });
  }

  /** Không có tự nhận biết lượt nói: người dẫn thôi nói thì chốt đoạn để có kết quả chốt. */
  chot() {
    if (!this.coAm) return;
    this.coAm = false;
    this.rt?.send({ type: 'input_audio_buffer.commit' });
  }

  dong() {
    try { this.rt?.close(); } catch { /* đã đóng */ }
    this.rt = null;
  }
}

const NHA_CHEP_LOI = { gemini: ChepLoiGemini, openai: ChepLoiOpenAI };

module.exports = { NHA_CHEP_LOI, ChepLoiGemini, ChepLoiOpenAI, doi16Sang24 };
