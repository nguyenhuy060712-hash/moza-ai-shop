'use strict';

/**
 * Miệng GPT Live 1 (SPEC.md F-22, #30): một phiên `gpt-live-1` qua `LiveWS` của SDK `openai`.
 *  - Lời dặn + dữ liệu buổi live nằm trong `instructions` lúc mở: không đổi được sau khi mở, và không bị thu gọn
 *    khi phiên dài (khác với ngữ cảnh đưa thêm).
 *  - Tiếng vào PCM 24 kHz, phải chảy liên tục kể cả lúc im (tài liệu GPT-Live, thử ở M0) → micro không gửi thì tự bơm
 *    khoảng lặng.
 *  - Tiếng ra `session.output_audio.delta` (PCM 24 kHz). Không có sự kiện hết tiếng, không có lệnh dừng câu đang nói.
 *  - Ngữ cảnh thêm: `session.thinking.append` (tối đa 500 token mỗi lần → chia nhỏ). Câu cần Mai nói:
 *    `session.commentary.append`.
 *  - Giao việc kiểu `client` là mặc định của GPT Live: model có thể xin thông tin (`session.delegation.created`).
 *    Bản 3.1 (#80): MOZA tự tra câu model hỏi (số sản phẩm → còn bán được, thẻ rút gọn) và trả lời ngay; không tra được
 *    thì báo không có gì thêm, để model không đứng chờ.
 *  - BH11 (F-112, tắt mặc định): `session.triggers` loại `decisions` trên `session.output_transcript.delta` — Decisions chạy song song
 *    lúc Mai nói ("Mai đang giới thiệu món nào?"); kết quả về `decision.event`. Vẫn giữ `delegation: {type: 'client'}`.
 *  - Tiền tính theo `usage.seconds` (cộng dồn; khoảng 1 phút báo một lần; `session.closed` có số cuối).
 * Nguồn: https://learn.microsoft.com/en-us/azure/foundry/openai/gpt-live-reference (tra 23/9/2026).
 *
 * Mạng gửi lên yếu (26/10/2026, đo thật trên máy chủ dự án): tiếng gửi lên ~64 KB/giây (PCM 24 kHz dạng base64) — đường gửi lên
 * chậm hơn thế thì dữ liệu ứ trong kết nối không giới hạn, mọi lệnh gọi OpenAI khác bị nghẽn ("hết giờ"), rồi phần mềm sập.
 * Nay: ứ quá U_BO_IM thì thôi bơm khoảng lặng; ứ quá U_BO_AM thì bỏ cả tiếng micro (tiếng trễ vô ích với hội thoại trực tiếp)
 * và báo người dẫn (khiMangYeu, tối đa 1 lần / BAO_MANG_YEU_MS). Định dạng tiếng gọn hơn (G.711 8 kHz) có nhưng áp cho cả tiếng
 * Mai nói ra → tiếng rè như điện thoại, không hợp livestream: không dùng.
 */

const OpenAISdk = require('openai');
const { LiveWS } = require('openai/resources/live/ws');
const khoa = require('../../khoa');
const { LoiAi, bocLoi } = require('../nha-cung-cap/chung');
const { doi16Sang24 } = require('../nha-cung-cap/chep-loi');

const OpenAI = OpenAISdk.default || OpenAISdk;
const NHA = 'openai';
const MO_TOI_DA_MS = 15000;
const DONG_TOI_DA_MS = 5000;
const BOM_MS = 100;
const IM_LANG = Buffer.alloc(24000 * 2 * (BOM_MS / 1000)).toString('base64'); // 100 ms im lặng, 24 kHz
const CHIA_KY_TU = 900; // mỗi lần đưa ngữ cảnh dưới 500 token (tiếng Việt khoảng 2–3 ký tự một token)
const U_BO_IM = 32 * 1024; // dữ liệu chưa gửi đi được quá mức này: không bơm khoảng lặng nữa
const U_BO_AM = 256 * 1024; // quá mức này: bỏ cả tiếng micro
const BAO_MANG_YEU_MS = 60000;

/** Chia chữ dài thành các mẩu ≤ n ký tự, ưu tiên cắt ở chỗ xuống dòng. */
function chiaNho(chu, n = CHIA_KY_TU) {
  const ra = [];
  let con = String(chu);
  while (con.length > n) {
    let cat = con.lastIndexOf('\n', n);
    if (cat < n / 2) cat = n;
    ra.push(con.slice(0, cat));
    con = con.slice(cat).replace(/^\n+/, '');
  }
  if (con.trim()) ra.push(con);
  return ra;
}

class MiengGptLive {
  /**
   * @param {object} o
   * @param {string} o.model
   * @param {string} o.giong      giọng GPT Live (Cài đặt)
   * @param {string} o.loiDan     lời dặn vai trò + dữ liệu buổi live
   * @param {(pcm24k:Buffer)=>void} o.khiAm
   * @param {(chu:string)=>void} o.khiChuRa    chép lời tiếng Mai
   * @param {(chu:string)=>void} o.khiChuVao   chép lời tiếng micro
   * @param {(o:{lyDo:string})=>void} o.khiDong  phiên đóng mà MOZA không yêu cầu
   * @param {(e:Error)=>void} [o.khiLoi]
   */
  constructor({ model = 'gpt-live-1', giong = 'marin', loiDan, khiAm, khiChuRa, khiChuVao, khiDong, khiLoi = () => {}, traCuu = null, khiMangYeu = () => {},
    cauHoiQuyetDinh = null, khiQuyetDinh = null }) {
    Object.assign(this, { model, giong, loiDan, khiAm, khiChuRa, khiChuVao, khiDong, khiLoi, traCuu, khiMangYeu, cauHoiQuyetDinh, khiQuyetDinh });
    this.thuTuChu = new Map(); // event_id của chữ Mai nói → thứ tự (F-112: bỏ kết quả Decisions cũ đến muộn)
    this.soChu = 0;
    this.baoMangYeuLuc = 0;
    this.boAm = 0; // số mẩu tiếng micro đã bỏ vì mạng gửi lên ứ
    this.nha = NHA;
    this.giay = 0; // giây phiên đã tính tiền (cộng dồn)
    this.amCuoi = 0;
    this.dangDong = false;
    this.lyDoDong = null;
  }

  async mo() {
    const k = khoa.lay('openai');
    if (!k) throw new LoiAi('Chưa có khóa OpenAI. Dán khóa trong Cài đặt → Khóa và kết nối.', { nha: NHA, ma: 'CHUA_CO_KHOA' });
    const rt = new LiveWS(new OpenAI({ apiKey: k }));
    this.rt = rt;
    // 26/10/2026: khóa hỏng (401) → kết nối đóng; thư viện OpenAI gửi lệnh trên kết nối đã đóng mà không có ai nghe 'error' thì
    // ném lỗi lạc làm sập cả phần mềm. Luôn có một người nghe; lỗi thật đã báo qua baoLoi / khiLoi.
    rt.on('error', () => {});
    try {
      await new Promise((ok, loi) => {
        const hen = setTimeout(() => loi(new LoiAi('GPT Live 1 mở phiên quá lâu.', { nha: NHA, ma: 'QUA_THOI_GIAN' })), MO_TOI_DA_MS);
        const xong = (fn) => (x) => { clearTimeout(hen); rt.off('error', baoLoi); rt.off('close', dongSom); fn(x); };
        const baoLoi = xong((e) => loi(bocLoi(e?.error?.error || e, NHA)));
        const dongSom = xong((ma, lyDo) => loi(new LoiAi(`GPT Live 1 đóng kết nối khi đang mở (${ma} ${lyDo || ''}).`, { nha: NHA })));
        rt.once('session.started', xong(ok));
        rt.on('error', baoLoi);
        rt.on('close', dongSom);
        rt.send({
          type: 'session.start',
          session: { model: this.model, instructions: this.loiDan, audio: { output: { voice: this.giong } }, delegation: { type: 'client' }, ...this.phanTriggers() },
        });
      });
    } catch (e) {
      try { rt.close(); } catch { /* đã đóng */ }
      this.rt = null; // mở hỏng: dong() sau đó không gửi gì nữa
      throw e;
    }
    this.gan(rt);
    this.bom = setInterval(() => {
      if (Date.now() - this.amCuoi > BOM_MS * 1.5 && this.dangU() <= U_BO_IM) this.gui({ type: 'session.input_audio.append', audio: IM_LANG });
    }, BOM_MS);
  }

  /** F-112: `triggers` của phiên khi có câu hỏi Decisions (giọng chữ GPT-Live — Decisions chạy trên chữ Mai nói ra). */
  phanTriggers(cauHoi = this.cauHoiQuyetDinh) {
    if (!cauHoi?.length) return {};
    const { doiCauHoi } = require('../nha-cung-cap/openai');
    return { triggers: [{ type: 'decisions', event_type: 'session.output_transcript.delta', decisions: { questions: doiCauHoi(cauHoi) } }] };
  }

  /** F-112: đổi danh sách câu hỏi giữa buổi (session.update; chờ session.updated không bắt buộc). */
  datCauHoiQuyetDinh(cauHoi) {
    this.cauHoiQuyetDinh = cauHoi;
    this.gui({ type: 'session.update', session: this.phanTriggers(cauHoi) });
  }

  gan(rt) {
    rt.on('session.output_audio.delta', (m) => { if (m.delta) this.khiAm(Buffer.from(m.delta, 'base64')); });
    rt.on('session.output_transcript.delta', (m) => {
      if (m.event_id) { this.thuTuChu.set(m.event_id, (this.soChu += 1)); if (this.thuTuChu.size > 500) this.thuTuChu.delete(this.thuTuChu.keys().next().value); }
      if (m.delta) this.khiChuRa(m.delta);
    });
    rt.on('decision.event', (m) => {
      if (!this.khiQuyetDinh || m.event?.type !== 'decision.completed') return;
      try {
        const { docQuyetDinh } = require('../nha-cung-cap/openai');
        const r = docQuyetDinh(m.event.decision);
        this.khiQuyetDinh({ traLoi: r.traLoi, thuTu: this.thuTuChu.get(m.source_event_id) ?? this.soChu, tokenVao: r.tokenVao });
      } catch (e) { this.khiLoi(e); }
    });
    rt.on('session.input_transcript.delta', (m) => { if (m.delta) this.khiChuVao(m.delta); });
    rt.on('session.usage.updated', (m) => { this.giay = Math.max(this.giay, m.usage?.seconds || 0); });
    rt.on('session.closed', (m) => {
      this.giay = Math.max(this.giay, m.usage?.seconds || 0);
      this.lyDoDong = m.reason || null;
    });
    rt.on('session.delegation.created', (m) => {
      let content = 'MOZA không có thêm thông tin nào ngoài dữ liệu đã gửi trong lời dặn.';
      try {
        const hoi = [m.delegation?.instructions, m.delegation?.query, m.delegation?.content, m.delegation?.task].find((x) => typeof x === 'string') || '';
        const so = (/(?:số|so|sp|áo|quần|mẫu|#)\s*(\d{1,5})/iu.exec(hoi) || /(\d{1,5})/.exec(hoi) || [])[1];
        if (this.traCuu && so) content = JSON.stringify(this.traCuu(/còn|con|het|hết|size|màu|mau/iu.test(hoi) ? 'xem_con_hang' : 'xem_san_pham', { so: Number(so) }));
      } catch { /* tra không được: trả câu mặc định */ }
      this.gui({ type: 'session.thinking.append', delegation_id: m.delegation?.id ?? null, content: content.slice(0, CHIA_KY_TU) });
    });
    // Lỗi của một lệnh không làm đóng phiên (tài liệu GPT-Live): chỉ ghi lại.
    rt.on('error', (e) => this.khiLoi(bocLoi(e?.error?.error || e, NHA)));
    rt.on('close', (ma, lyDo) => {
      clearInterval(this.bom);
      if (!this.dangDong) this.khiDong({ lyDo: `GPT Live 1 đóng phiên (${this.lyDoDong || lyDo || ma})` });
    });
  }

  /** F-127: thêm lời dặn giữa buổi (đổi tông) — GPT-Live không đổi được lời dặn đã gửi, chỉ thêm được ≤ 500 token. */
  themLoiDan(chu) {
    if (chu) this.gui({ type: 'session.instructions.append', content: String(chu).slice(0, CHIA_KY_TU), delegation_id: null });
  }

  gui(suKien) {
    if (this.dangDong || !this.rt) return;
    try { this.rt.send(suKien); } catch { /* socket vừa đóng: sự kiện close sẽ báo */ }
  }

  /** Byte đã đưa vào kết nối mà chưa gửi đi được (mạng gửi lên chậm). */
  dangU() {
    const s = this.rt?.socket; // lớp vỏ của SDK; số đo nằm ở kết nối ws gốc (platformSocket)
    return s?.platformSocket?.bufferedAmount ?? s?.bufferedAmount ?? 0;
  }

  guiAm(pcm16k) {
    this.amCuoi = Date.now();
    if (this.dangU() > U_BO_AM) {
      this.boAm += 1;
      if (Date.now() - this.baoMangYeuLuc > BAO_MANG_YEU_MS) {
        this.baoMangYeuLuc = Date.now();
        this.khiMangYeu({ dangU: this.dangU(), boAm: this.boAm });
      }
      return;
    }
    this.gui({ type: 'session.input_audio.append', audio: doi16Sang24(pcm16k).toString('base64') });
  }

  /** Ngữ cảnh model biết nhưng không đọc to. */
  duaNguCanh(chu) {
    for (const m of chiaNho(chu)) this.gui({ type: 'session.thinking.append', delegation_id: null, content: m });
  }

  /** Nội dung model nói ra ngay (tự diễn đạt). */
  hoi(chu) {
    this.gui({ type: 'session.commentary.append', delegation_id: null, content: String(chu).slice(0, CHIA_KY_TU * 2) });
  }

  /**
   * F-105: đính chính. GPT Live 1 (WebSocket) chưa có lệnh dừng câu đang nói (tra 28/9/2026 — `output_audio_buffer.clear` chỉ có ở
   * WebRTC): MOZA tự bỏ tiếng còn lại của câu sai (mieng.js giữ im tới câu mới), rồi đưa câu đính chính cho model nói ngay.
   */
  dinhChinh(chu) {
    this.hoi(`MOZA đính chính — nói ngay đúng nguyên văn, giữ nguyên con số, rồi dẫn tiếp: "${String(chu).slice(0, 300)}"`);
  }

  /** Đóng đúng cách: chờ `session.closed` để có số giây tính tiền cuối cùng. */
  async dong() {
    if (this.dangDong || !this.rt) return;
    const rt = this.rt;
    clearInterval(this.bom);
    const daDong = new Promise((r) => {
      const hen = setTimeout(r, DONG_TOI_DA_MS);
      rt.once('session.closed', () => { clearTimeout(hen); r(); });
      rt.once('close', () => { clearTimeout(hen); r(); });
    });
    try { rt.send({ type: 'session.close' }); } catch { /* đã đóng */ }
    this.dangDong = true;
    await daDong;
    try { rt.close(); } catch { /* đã đóng */ }
  }
}

module.exports = { MiengGptLive, chiaNho };
