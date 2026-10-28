'use strict';

/**
 * Người dẫn giả nói (SPEC.md bản 2.5, F-39, #42).
 * Phòng diễn tập gõ câu → Gemini TTS đọc bằng giọng người dẫn giả (hoặc người dẫn và khách mời nói chuyện) →
 * tiếng đi vào đường micro của MOZA như người dẫn thật: chép lời người dẫn ở chế độ "Chỉ gợi ý", hoặc miệng của Mai
 * khi đang mở. Tiếng giả chỉ đi vào đường micro của MOZA, không bao giờ ra Facebook.
 *
 * Trang Phòng diễn tập nhận sự kiện `dien_tap.tieng_gia` rồi tải tệp ở `/api/dien-tap/tieng/:id` để phát ra loa
 * cho người dùng cùng nghe. Các đoạn nói xếp hàng: đoạn trước nói xong mới tới đoạn sau.
 * Gemini TTS đọc một câu ngắn mất 5–11 giây (gọi thật 24/9/2026), nên kịch bản làm sẵn tiếng lúc bắt đầu (lam → phatVao).
 */

const live = require('./nghiep-vu/live');
const chiPhi = require('./nghiep-vu/chi-phi');
const nhatKy = require('./nghiep-vu/nhat-ky');
const { LoiNghiepVu, taoId } = require('./nghiep-vu/chung');
const tts = require('./agent/nha-cung-cap/tts');

// Giọng tiếng Việt có sẵn của Google (danh sách vi-VN gọi thật 24/9/2026): người dẫn giọng nam trầm, khách mời giọng nữ.
const GIONG_NGUOI_DAN = 'vi-vn-advisor-2';
const GIONG_KHACH = 'vi-vn-advisor-4';
// Nhà đọc OpenAI (8/10/2026): người dẫn giả giọng nam cedar, khách mời giọng nữ coral (khác marin của Mai).
const GIONG_OPENAI = { [GIONG_NGUOI_DAN]: 'cedar', [GIONG_KHACH]: 'coral' };
function giongDoc(g) {
  const nha = tts.nhaDoc();
  if (nha === 'elevenlabs') {
    // ElevenLabs cần mã giọng của tài khoản: mượn giọng ElevenLabs của nhân vật Đội AI (người dẫn giả nam, khách mời nữ).
    const nv = require('./nghiep-vu/doi-ai').nhanVat().slice(1);
    const gioi = g === GIONG_KHACH ? 'nu' : 'nam';
    return (nv.find((n) => n.gioi === gioi && n.giong_eleven) || nv.find((n) => n.giong_eleven))?.giong_eleven || null;
  }
  return nha !== 'gemini' ? GIONG_OPENAI[g] || (tts.GIONG_OPENAI.includes(g) ? g : 'cedar') : g;
}
const GIU_TEP_MS = 10 * 60 * 1000;
const TOI_DA_TEP = 40;
const GIU_DS_GIONG_MS = 30 * 60 * 1000;

/** Đổi tần số mẫu PCM 16-bit một kênh bằng nội suy tuyến tính (TTS trả 24 kHz; đường micro dùng 16 kHz như micro thật). */
function doiTanSo(pcm, tu = 24000, den = 16000) {
  const soVao = Math.floor(pcm.length / 2);
  if (!soVao || tu === den) return Buffer.from(pcm.subarray(0, soVao * 2));
  const buoc = tu / den;
  const soRa = Math.floor((soVao - 1) / buoc) + 1;
  const ra = Buffer.alloc(soRa * 2);
  for (let i = 0; i < soRa; i += 1) {
    const viTri = i * buoc;
    const a = Math.floor(viTri);
    const b = Math.min(a + 1, soVao - 1);
    const t = viTri - a;
    const x = pcm.readInt16LE(a * 2) + (pcm.readInt16LE(b * 2) - pcm.readInt16LE(a * 2)) * t;
    ra.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x))), i * 2);
  }
  return ra;
}

class TiengGia {
  /**
   * @param {object} o
   * @param {object} o.chepLoi      chep-loi-nguoi-dan.js (có phatTiengGia)
   * @param {Function} o.phat       phát sự kiện /ws
   * @param {object} [o.tts]        thay Gemini TTS (test)
   * @param {object} [o.tuyChonPhat] { nhipMs, choChotMs } — test rút ngắn thời gian
   */
  constructor({ chepLoi, phat, tts: nhaTts = tts, tuyChonPhat = {} }) {
    Object.assign(this, { chepLoi, phat, nhaTts, tuyChonPhat });
    this.tep = new Map(); // id → { wav, luc }
    this.hang = Promise.resolve();
    this.dsGiong = null; // { luc, giong }
  }

  /** Phiên live đang phát (người dẫn giả chỉ nói được khi có buổi live đang chạy). */
  phienDangLive() {
    const p = live.phienDangMo();
    if (!p || p.trang_thai !== 'dang_live') {
      throw new LoiNghiepVu('KHONG_CO_LIVE', 'Chưa có buổi live đang chạy. Tạo phiên diễn tập, bấm "Bắt đầu live giả" rồi thử lại.', 409);
    }
    return p;
  }

  ghiChiPhi(viec, kq, phienId) {
    const usd = chiPhi.tinhChiPhiDoc(kq.model, kq.token);
    const runId = nhatKy.taoRun({ agentId: 'tieng_gia', kichHoat: viec, phienLiveId: phienId, dienTap: true });
    nhatKy.xongRun(runId, { nha: tts.nhaCuaModel(kq.model), model: kq.model, tokenVao: kq.token?.vao || 0, tokenRa: kq.token?.ra || 0, chiPhi: usd });
    const canhBao = chiPhi.kiemMucTran();
    require('./nghiep-vu/chi-phi').baoVuotTran(this.phat, canhBao);
  }

  luuTep(wav) {
    const id = taoId('tg');
    const bayGio = Date.now();
    for (const [k, v] of this.tep) if (bayGio - v.luc > GIU_TEP_MS) this.tep.delete(k);
    while (this.tep.size >= TOI_DA_TEP) this.tep.delete(this.tep.keys().next().value);
    this.tep.set(id, { wav, luc: bayGio });
    return id;
  }

  layTep(id) {
    return this.tep.get(String(id))?.wav || null;
  }

  /**
   * Làm tiếng cho một câu của người dẫn giả (chưa phát).
   * @returns {Promise<{id:string, chu:string, giay:number, pcm16:Buffer}>}
   */
  async lam({ chu, giong = GIONG_NGUOI_DAN, phongCach = 'tự nhiên như người dẫn livestream' }) {
    const c = String(chu ?? '').trim();
    if (!c) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Gõ câu người dẫn giả sẽ nói.');
    if (c.length > 600) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Câu dài quá (tối đa 600 ký tự).');
    const p = this.phienDangLive();
    let kq;
    try {
      kq = await this.nhaTts.docChu({ chu: c, giong: giongDoc(giong || GIONG_NGUOI_DAN), phongCach });
    } catch (e) {
      throw new LoiNghiepVu('GIONG_LOI', `Không làm được tiếng người dẫn giả: ${e.message}`, 502);
    }
    this.ghiChiPhi(`Người dẫn giả nói: ${c.slice(0, 80)}`, kq, p.id);
    return { id: this.luuTep(kq.wav), chu: c, giay: kq.giay, pcm16: doiTanSo(kq.pcm, kq.tanSo, 16000) };
  }

  /**
   * Làm tiếng cho một đoạn người dẫn và khách mời nói chuyện (Gemini TTS đọc hai người trong một lần).
   * @param {{luot: {vai: 'nguoi_dan'|'khach', chu: string}[], giong?: {nguoi_dan?:string, khach?:string}}} o
   */
  async lamHoiThoai({ luot, giong = {} }) {
    const ds = (Array.isArray(luot) ? luot : []).filter((l) => String(l?.chu ?? '').trim()).slice(0, 12);
    if (!ds.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Gõ ít nhất một câu cho người dẫn hoặc khách mời.');
    const p = this.phienDangLive();
    const nhan = { nguoi_dan: 'NguoiDan', khach: 'KhachMoi' };
    let kq;
    try {
      kq = await this.nhaTts.docHoiThoai({
        luot: ds.map((l) => ({ nguoi: nhan[l.vai] || 'NguoiDan', chu: String(l.chu).trim().slice(0, 400) })),
        giong: { NguoiDan: giongDoc(giong.nguoi_dan || GIONG_NGUOI_DAN), KhachMoi: giongDoc(giong.khach || GIONG_KHACH) },
      });
    } catch (e) {
      throw new LoiNghiepVu('GIONG_LOI', `Không làm được tiếng hai người nói: ${e.message}`, 502);
    }
    const chu = ds.map((l) => `${l.vai === 'khach' ? 'Khách mời' : 'Người dẫn'}: ${String(l.chu).trim()}`).join(' / ');
    this.ghiChiPhi(`Người dẫn và khách mời nói: ${chu.slice(0, 80)}`, kq, p.id);
    return { id: this.luuTep(kq.wav), chu, giay: kq.giay, pcm16: doiTanSo(kq.pcm, kq.tanSo, 16000) };
  }

  /**
   * Phát một đoạn đã làm vào đường micro. Xếp hàng: đoạn trước nói xong mới tới đoạn sau.
   * Trả Promise xong khi đoạn này phát xong.
   */
  phatVao(doan) {
    const viec = this.hang.then(async () => {
      const p = this.phienDangLive();
      this.phat('dien_tap.tieng_gia', { id: doan.id, chu: doan.chu, giay: Math.round(doan.giay * 10) / 10 });
      await this.chepLoi.phatTiengGia(p.id, doan.pcm16, this.tuyChonPhat);
    });
    this.hang = viec.catch(() => {});
    return viec;
  }

  /** Người dẫn giả nói một câu: làm tiếng rồi xếp hàng phát. Trả khi tiếng đã sẵn sàng (không chờ nói xong). */
  async noi({ chu, giong }) {
    const doan = await this.lam({ chu, giong });
    this.phatVao(doan).catch((e) => this.phat('dien_tap.tieng_gia', { id: doan.id, loi: e.message }));
    return { id: doan.id, chu: doan.chu, giay: doan.giay };
  }

  async hoiThoai({ luot, giong }) {
    const doan = await this.lamHoiThoai({ luot, giong });
    this.phatVao(doan).catch((e) => this.phat('dien_tap.tieng_gia', { id: doan.id, loi: e.message }));
    return { id: doan.id, chu: doan.chu, giay: doan.giay };
  }

  /** Giọng tiếng Việt có sẵn để chọn cho người dẫn giả (lưu tạm 30 phút cho đỡ gọi Google). */
  async giongCoSan() {
    if (this.dsGiong && Date.now() - this.dsGiong.luc < GIU_DS_GIONG_MS) return this.dsGiong.giong;
    let kq;
    try {
      kq = await this.nhaTts.dsGiongKho({ soLuong: 60 });
    } catch (e) {
      throw new LoiNghiepVu('GIONG_LOI', e.message, 502);
    }
    this.dsGiong = { luc: Date.now(), giong: kq.giong };
    return kq.giong;
  }
}

module.exports = { TiengGia, doiTanSo, GIONG_NGUOI_DAN, GIONG_KHACH };
