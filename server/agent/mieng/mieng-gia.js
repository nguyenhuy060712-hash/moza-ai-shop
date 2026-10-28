'use strict';

/**
 * Miệng giả (SPEC.md F-105): cùng giao diện với MiengGptLive / MiengGemini nhưng không gọi mạng, 0 đồng — CHỈ cho buổi tập.
 *  - Câu MOZA đưa có đoạn trong ngoặc kép ("… nói: "…"", "đọc giúp: …") → nói lại y nguyên (tập nói nhầm số: người dẫn gõ ô Hỏi
 *    Mai "đọc giúp: áo 12 giá 150k"). Không có → câu trả lời máy soạn từ thẻ sản phẩm MOZA đã đưa (giá đúng).
 *  - Phát chữ theo nhịp nói (vài từ mỗi 150 ms) kèm tiếng rất nhỏ để máy biết "Mai đang nói".
 *  - `dinhChinh(chu)`: bỏ câu đang nói, nói câu đính chính ngay.
 *  - BH11 F-112: có câu hỏi Decisions thì mô phỏng `decision.event` — câu Mai nói nhắc "số N" (N trong danh sách) → chọn so_N, tin
 *    cậy 0,95; nhắc "bảng size" / "chất liệu" → mời xem size. Trả về sau một nhịp nói (giống độ trễ thật nhỏ).
 */

const NHIP_MS = 150;
const TU_MOI_NHIP = 3;
const TIENG_MS = 150; // mỗi nhịp một gói tiếng nhỏ, 24 kHz

function tiengNho(ms) {
  const n = Math.round((24000 * ms) / 1000);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(i % 2 ? 420 : -420, i * 2); // đủ để coTiengNoi() nhận là tiếng nói, rất nhỏ trên loa
  return b;
}

class MiengGia {
  constructor({ khiAm = () => {}, khiChuRa = () => {}, khiDong = () => {}, loiDan = '', giong = null, nhipMs = NHIP_MS, cauHoiQuyetDinh = null, khiQuyetDinh = null } = {}) {
    // BH11: giữ giọng + lời dặn để test kiểm đoạn tông (F-127) và mã giọng riêng (F-114).
    Object.assign(this, { khiAm, khiChuRa, khiDong, loiDan, giong, nhipMs, cauHoiQuyetDinh, khiQuyetDinh });
    this.thuTuQd = 0;
    this.loiDanThem = [];
    this.giay = 0;
    this.token = { vao: {}, ra: {} };
    this.nguCanh = [];
    this.hen = null;
    this.daNoi = [];
  }

  async mo() { this.daMo = true; }

  guiAm() {}

  /** Như GPT-Live: thêm lời dặn giữa buổi (F-127 đổi tông). */
  themLoiDan(chu) { if (chu) this.loiDanThem.push(String(chu)); }

  duaNguCanh(chu) { this.nguCanh = [...this.nguCanh, String(chu)].slice(-20); }

  /** Câu sẽ nói cho một lượt MOZA đưa. */
  soanCau(chu) {
    const s = String(chu);
    const doc = /đọc giúp\s*:?\s*"?([^"\n]+)"?/i.exec(s);
    if (doc) return doc[1].trim();
    const trich = /"([^"]{4,})"/.exec(s);
    if (trich) return trich[1].trim();
    // Câu hỏi người xem: lấy dòng giá của thẻ MOZA gửi kèm ("Giá: …").
    const gia = /Giá[^:\n]*:\s*([^\n]+)/.exec(s);
    return gia ? `Dạ, giá ${gia[1].trim().replace(/\.$/, '')} ạ.` : 'Dạ, Mai nghe rồi ạ, cả nhà chờ chút.';
  }

  /** F-112: mô phỏng Decisions trên câu Mai vừa nói. */
  quyetDinhGia(cau) {
    if (!this.khiQuyetDinh || !this.cauHoiQuyetDinh?.length) return;
    const traLoi = {};
    for (const q of this.cauHoiQuyetDinh) {
      if (q.loai === 'predicate') traLoi[q.ten] = /bảng size|chất liệu/i.test(cau) ? { loai: 'predicate', chon: true, tinCay: 0.95 } : { loai: 'predicate', chon: false, tinCay: 0.9 };
      else {
        const co = (q.luaChon || []).map((c) => c.gt).filter((gt) => /^so_\d+$/.test(gt)).find((gt) => new RegExp(`(số|so|#)\\s*${gt.slice(3)}(?!\\d)`, 'iu').test(cau));
        traLoi[q.ten] = co ? { loai: 'choice', chon: co, tinCay: 0.95 } : { loai: 'choice', chon: 'khong_doi', tinCay: 0.9 };
      }
    }
    const thuTu = (this.thuTuQd += 1);
    const h = setTimeout(() => this.khiQuyetDinh({ traLoi, thuTu, tokenVao: 0 }), this.nhipMs);
    h.unref?.();
  }

  noi(cau) {
    clearInterval(this.hen);
    const tu = String(cau).split(/\s+/).filter(Boolean);
    this.daNoi.push(cau);
    let i = 0;
    const buoc = () => {
      if (i >= tu.length) { clearInterval(this.hen); this.hen = null; return; }
      const manh = tu.slice(i, i + TU_MOI_NHIP).join(' ');
      i += TU_MOI_NHIP;
      this.khiAm(tiengNho(TIENG_MS));
      this.khiChuRa(`${manh}${i < tu.length ? ' ' : ''}`);
      this.quyetDinhGia(tu.slice(0, i).join(' ')); // như GPT-Live: Decisions chạy trên từng mẩu chữ đã nói
    };
    buoc();
    this.hen = setInterval(buoc, this.nhipMs);
    this.hen.unref?.();
  }

  hoi(chu) { this.noi(this.soanCau(chu)); }

  /** Bỏ câu đang nói, nói ngay câu đính chính (đúng nguyên văn). */
  dinhChinh(chu) { this.noi(chu); }

  dangNoi() { return !!this.hen; }

  async dong() {
    clearInterval(this.hen);
    this.hen = null;
    this.daDong = true;
  }
}

module.exports = { MiengGia };
