'use strict';

/**
 * Miệng Gemini 3.8 Live / Extended Thinking (SPEC.md F-22, #30) qua Live API của `@google/genai`.
 *  - Lời dặn + dữ liệu buổi live nằm trong `systemInstruction` (không mất khi nén ngữ cảnh).
 *  - Model dùng đúng mặc định của hãng (#30): bản thường không đặt `thinkingLevel` (tài liệu Gemini Live 3.8 không nhận);
 *    bản Extended Thinking BẮT BUỘC có (thiếu thì máy chủ đóng kết nối mã 1007 — chạy thật 23/9/2026) → `LOW` theo mục 6.
 *    Không đặt ngôn ngữ (3.8 không nhận `languageCode`; lời dặn đã ghi tiếng Việt).
 *  - Tiếng vào PCM 16 kHz; tiếng ra PCM 24 kHz. Bị người dẫn nói chen → `serverContent.interrupted` → bỏ tiếng đang chờ phát.
 *  - Phiên dài: nén ngữ cảnh (cửa sổ trượt) + nối phiên. Mỗi kết nối sống khoảng 10 phút; máy chủ báo `goAway` trước khi
 *    đóng → đóng kết nối cũ RỒI mới mở kết nối mới bằng mã nối phiên (mở chồng bị đóng mã 1011 — thử ở M0).
 *    Mã nối phiên hỏng thì mở phiên mới: dữ liệu vẫn nằm trong lời dặn.
 *  - Ngữ cảnh thêm: tin nhắn chữ không kết thúc lượt. Câu cần Mai trả lời: tin nhắn chữ kết thúc lượt.
 *  - Bản 3.1 (#81, theo hướng dẫn chuyển lên 3.8 Live của Google, tra 25/9/2026): 3.8 Live coi `turnComplete: true` là
 *    lệnh cắt ngang → câu hỏi gửi lúc Mai đang nói được giữ lại, gửi ngay khi Mai nói xong lượt (hoặc sau CHO_NOI_XONG_MS
 *    nếu không thấy báo xong). Không dùng "affective dialog" (Google đã bỏ khỏi API).
 *  - Bản 3.1 (#80): Mai tự tra `xem_san_pham`, `xem_con_hang` bằng công cụ; 3.8 Live gọi công cụ chạy nền, không ngừng nói.
 *  - Tiền tính theo token từng loại (tiếng / chữ) trong `usageMetadata`.
 * Nguồn: https://ai.google.dev/gemini-api/docs/live-guide, /live-session (tra 23/9/2026).
 */

const { GoogleGenAI, Modality } = require('@google/genai');
const khoa = require('../../khoa');
const { LoiAi, bocLoi } = require('../nha-cung-cap/chung');

const NHA = 'gemini';
const MO_TOI_DA_MS = 20000;
const NOI_LAI_TOI_DA = 3; // rớt kết nối quá 3 lần trong 2 phút thì thôi, báo lỗi để hạ về "Chỉ gợi ý"
const CUA_SO_NOI_LAI_MS = 2 * 60 * 1000;
const CHO_NOI_XONG_MS = 20000; // Mai nói một lượt dài lắm cũng dưới chừng này; quá thì gửi câu hỏi dù chưa thấy báo xong

/** Công cụ tra cứu của miệng (#80), dạng khai báo của Gemini Live. */
const KHAI_BAO_CONG_CU = [
  { name: 'xem_san_pham', description: 'Xem nhanh một sản phẩm theo số: tên, giá, phân loại, điểm nổi bật, bảng size.',
    parameters: { type: 'OBJECT', properties: { so: { type: 'INTEGER', description: 'Số sản phẩm, ví dụ 12' } }, required: ['so'] } },
  { name: 'xem_con_hang', description: 'Xem còn bán được bao nhiêu của từng màu × cỡ một sản phẩm, đúng lúc gọi.',
    parameters: { type: 'OBJECT', properties: { so: { type: 'INTEGER', description: 'Số sản phẩm, ví dụ 12' } }, required: ['so'] } },
  // #90: Mai tự chọn hình lên Màn hình sản phẩm khi đang nói về món đó (ảnh đúng màu, bảng size, video…).
  { name: 'chieu_man_hinh', description: 'Chiếu hình minh họa lên Màn hình sản phẩm cho người xem thấy: ảnh một màu, bảng size (tô cỡ hợp chiều cao cân nặng), chi tiết chất liệu, phối đồ, video, danh sách sản phẩm.',
    parameters: { type: 'OBJECT', properties: {
      mau: { type: 'STRING', enum: ['gioi_thieu', 'anh', 'bang_size', 'chi_tiet', 'phoi_do', 'video', 'trinh_chieu', 'danh_sach'] },
      so: { type: 'INTEGER', description: 'Số sản phẩm (không cần với danh_sach)' },
      mau_sac: { type: 'STRING', description: 'Màu muốn chiếu, ví dụ Be' },
      chieu_cao: { type: 'INTEGER', description: 'cm, cho bang_size' },
      can_nang: { type: 'INTEGER', description: 'kg, cho bang_size' },
    }, required: ['mau'] } },
];

class MiengGemini {
  /**
   * Cùng mặt với MiengGptLive, thêm:
   * @param {()=>void} [o.khiNgat]               model bị ngắt lời: bỏ tiếng đang chờ phát
   * @param {(dang:boolean)=>void} [o.khiNoiLai] đang nối lại / đã nối xong
   * @param {(ten:string, thamSo:object)=>object} [o.traCuu] MOZA trả lời công cụ tra cứu (#80)
   */
  constructor({ model = 'gemini-3.8-live', giong = 'Zephyr', loiDan, khiAm, khiChuRa, khiChuVao, khiDong,
    khiLoi = () => {}, khiNgat = () => {}, khiNoiLai = () => {}, traCuu = null, tuRieng = [] }) {
    Object.assign(this, { model, giong, loiDan, khiAm, khiChuRa, khiChuVao, khiDong, khiLoi, khiNgat, khiNoiLai, traCuu, tuRieng });
    this.dangNoi = false; // Mai đang nói một lượt (đã có tiếng, chưa báo xong)
    this.lucNoi = 0;
    this.choHoi = []; // câu hỏi chờ Mai nói xong (#81)
    this.nha = NHA;
    this.token = { vao: {}, ra: {} };
    this.maNoi = null;
    this.phien = null;
    this.dangDong = false;
    this.dangNoiLai = false;
    this.lanNoiLai = [];
  }

  cauHinh() {
    const c = {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.giong } } },
      systemInstruction: this.loiDan,
      // F-87: từ riêng của shop cho phần nghe người dẫn (tên món, màu, lệnh) — Gemini 3.8 Live nhận custom vocabulary
      // trong input audio transcription (tài liệu Google, tra 28/9/2026); tốt nhất ≤ 100 cụm.
      inputAudioTranscription: this.tuRieng?.length ? { customVocabulary: this.tuRieng.slice(0, 100) } : {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: this.maNoi ? { handle: this.maNoi } : {},
    };
    if (this.traCuu) c.tools = [{ functionDeclarations: KHAI_BAO_CONG_CU }];
    if (this.model.includes('extended-thinking')) c.thinkingConfig = { thinkingLevel: 'LOW' };
    return c;
  }

  async mo() {
    await this.ketNoi();
  }

  /** Mở một kết nối, chờ `setupComplete`. Chỉ tin của kết nối đang dùng được xử lý. */
  async ketNoi() {
    const k = khoa.lay('gemini');
    if (!k) throw new LoiAi('Chưa có khóa Gemini. Dán khóa trong Cài đặt → Khóa và kết nối.', { nha: NHA, ma: 'CHUA_CO_KHOA' });
    const ai = new GoogleGenAI({ apiKey: k });
    let sanSang;
    let biDong;
    const cho = new Promise((ok, loi) => {
      sanSang = ok;
      biDong = (e) => loi(new LoiAi(`Gemini Live đóng kết nối khi đang mở (${e?.code ?? ''} ${e?.reason || ''}).`, { nha: NHA }));
    });
    cho.catch(() => {}); // lỗi xử lý ở chỗ await bên dưới
    let ketNoi = null;
    // Hạn giờ tính từ lúc bắt đầu nối: có lúc chính bước mở WebSocket treo (chạy thật 23/9/2026 với bản Extended Thinking).
    let hen;
    const hetGio = new Promise((_, loi) => {
      hen = setTimeout(() => loi(new LoiAi('Gemini Live mở phiên quá lâu.', { nha: NHA, ma: 'QUA_THOI_GIAN' })), MO_TOI_DA_MS);
    });
    hetGio.catch(() => {});
    const noi = ai.live.connect({
      model: this.model,
      config: this.cauHinh(),
      callbacks: {
        onmessage: (m) => {
          if (m.setupComplete) sanSang();
          if (ketNoi && ketNoi === this.phien) this.nhan(m);
        },
        onerror: (e) => this.khiLoi(bocLoi(e?.error || e, NHA)),
        onclose: (e) => {
          biDong(e);
          if (ketNoi && ketNoi === this.phien && !this.dangDong) this.noiLai(`kết nối đóng (${e?.code ?? ''})`);
        },
      },
    }).then((ph) => { ketNoi = ph; return ph; });
    let phien;
    try {
      phien = await Promise.race([noi, hetGio]);
      await Promise.race([cho, hetGio]);
    } catch (e) {
      // Kết nối có thể xong sau khi đã hết giờ: đóng luôn, không để treo một kết nối không ai dùng.
      noi.then((ph) => { try { ph.close(); } catch { /* đã đóng */ } }, () => {});
      throw bocLoi(e, NHA);
    } finally {
      clearTimeout(hen);
    }
    if (this.dangDong) {
      phien.close();
      return;
    }
    this.phien = phien;
  }

  nhan(m) {
    const u = m.sessionResumptionUpdate;
    if (u?.resumable && u.newHandle) this.maNoi = u.newHandle;
    if (m.usageMetadata) this.demToken(m.usageMetadata);
    const sc = m.serverContent;
    if (sc) {
      if (sc.interrupted) this.khiNgat();
      for (const p of sc.modelTurn?.parts ?? []) {
        if (p.inlineData?.data && !p.thought) {
          this.dangNoi = true;
          this.lucNoi = Date.now();
          this.khiAm(Buffer.from(p.inlineData.data, 'base64'));
        }
      }
      if (sc.outputTranscription?.text) this.khiChuRa(sc.outputTranscription.text);
      if (sc.inputTranscription?.text) this.khiChuVao(sc.inputTranscription.text);
      if (sc.turnComplete || sc.interrupted) this.noiXong();
    }
    if (m.toolCall?.functionCalls?.length) this.traLoiCongCu(m.toolCall.functionCalls);
    if (m.goAway) this.noiLai('máy chủ báo sắp đóng kết nối');
  }

  demToken(u) {
    for (const [chieu, ds] of [['vao', u.promptTokensDetails], ['ra', u.responseTokensDetails]]) {
      for (const d of ds ?? []) this.token[chieu][d.modality] = (this.token[chieu][d.modality] || 0) + (d.tokenCount || 0);
    }
  }

  /** Nối lại: đóng kết nối cũ trước, rồi mở bằng mã nối phiên; hỏng thì mở phiên mới. Rớt liên tục thì thôi. */
  async noiLai(lyDo) {
    if (this.dangNoiLai || this.dangDong) return;
    const bayGio = Date.now();
    this.lanNoiLai = [...this.lanNoiLai.filter((t) => bayGio - t < CUA_SO_NOI_LAI_MS), bayGio];
    const cu = this.phien;
    this.phien = null;
    try { cu?.close(); } catch { /* đã đóng */ }
    if (this.lanNoiLai.length > NOI_LAI_TOI_DA) {
      this.khiDong({ lyDo: `Gemini Live rớt kết nối liên tục (${lyDo})` });
      return;
    }
    this.dangNoiLai = true;
    this.khiNoiLai(true);
    try {
      try {
        await this.ketNoi();
      } catch {
        this.maNoi = null;
        await this.ketNoi();
      }
    } catch (e) {
      this.dangNoiLai = false;
      if (!this.dangDong) this.khiDong({ lyDo: `Gemini Live nối lại không được: ${e.message}` });
      return;
    }
    this.dangNoiLai = false;
    if (!this.dangDong) this.khiNoiLai(false);
  }

  guiAm(pcm16k) {
    try {
      this.phien?.sendRealtimeInput({ audio: { data: pcm16k.toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
    } catch { /* đang nối lại */ }
  }

  gui(chu, turnComplete) {
    try {
      this.phien?.sendClientContent({ turns: [{ role: 'user', parts: [{ text: String(chu) }] }], turnComplete });
    } catch { /* đang nối lại */ }
  }

  duaNguCanh(chu) {
    this.gui(chu, false);
  }

  /** Mai nói xong lượt: gửi câu hỏi đang chờ (mỗi lần một câu — câu sau chờ lượt sau). */
  noiXong() {
    this.dangNoi = false;
    const c = this.choHoi.shift();
    if (c != null) this.hoi(c);
  }

  /**
   * Câu cần Mai trả lời (kết thúc lượt). Mai đang nói thì giữ lại (#81): 3.8 Live coi lệnh kết thúc lượt là cắt ngang.
   * Không thấy báo nói xong quá CHO_NOI_XONG_MS thì coi như đã xong.
   */
  hoi(chu) {
    if (this.dangNoi && Date.now() - this.lucNoi < CHO_NOI_XONG_MS) {
      this.choHoi = [...this.choHoi, chu].slice(-3);
      return;
    }
    this.dangNoi = false;
    this.gui(chu, true);
  }

  /**
   * F-105: đính chính — CỐ Ý cắt ngang câu đang nói (turnComplete: true ngắt ngay, tài liệu 3.8 Live tra 28/9/2026), bỏ qua hàng
   * chờ #81 và bỏ các câu đang chờ (đã cũ so với lời đính chính).
   */
  dinhChinh(chu) {
    this.choHoi = [];
    this.dangNoi = false;
    this.gui(`MOZA đính chính — nói ngay đúng nguyên văn, giữ nguyên con số, rồi dẫn tiếp: "${String(chu).slice(0, 300)}"`, true);
  }

  /** Trả lời công cụ tra cứu (#80): MOZA đọc cơ sở dữ liệu ngay lúc gọi. */
  traLoiCongCu(cacGoi) {
    const functionResponses = cacGoi.map((g) => {
      let response;
      try {
        response = this.traCuu ? this.traCuu(g.name, g.args || {}) : { loi: 'Không có công cụ này.' };
      } catch (e) {
        response = { loi: e.message };
      }
      return { id: g.id, name: g.name, response };
    });
    try { this.phien?.sendToolResponse({ functionResponses }); } catch { /* đang nối lại */ }
  }

  async dong() {
    this.dangDong = true;
    const p = this.phien;
    this.phien = null;
    try { p?.close(); } catch { /* đã đóng */ }
  }
}

module.exports = { MiengGemini };
