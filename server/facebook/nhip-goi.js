'use strict';

/**
 * Nhịp gọi Facebook (F-06, mục 10): mọi lần gọi Graph API đi qua đây.
 *  - Đọc header `X-App-Usage`, `X-Page-Usage`, `X-Business-Use-Case-Usage` (phần trăm dùng trong 1 giờ trượt).
 *  - Mức dùng > 50% → giãn nhịp (≥ 2 giây giữa hai lần gọi); > 80% → ≥ 10 giây.
 *  - Bị giới hạn (lỗi 4, 17, 32, 613, 80001, 80006) → ngừng gọi đúng `estimated_time_to_regain_access` phút;
 *    không có thì lùi 5 s → 10 s → 20 s… tối đa 5 phút.
 * Chỉ giữ trong bộ nhớ: khởi động lại thì Meta sẽ báo lại mức dùng ở lần gọi đầu.
 */

const MA_GIOI_HAN = new Set([4, 17, 32, 613, 80001, 80006]);
const LUI_TOI_DA_MS = 5 * 60 * 1000;

function docJson(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

/** Mức dùng cao nhất (0–100) và số phút phải chờ (nếu Meta báo) từ các header. */
function docHeader(layHeader) {
  let muc = 0;
  let choPhut = 0;
  for (const ten of ['x-app-usage', 'x-page-usage', 'x-ad-account-usage']) {
    const j = docJson(layHeader(ten));
    if (j) muc = Math.max(muc, Number(j.call_count) || 0, Number(j.total_cputime) || 0, Number(j.total_time) || 0);
  }
  const buc = docJson(layHeader('x-business-use-case-usage'));
  if (buc) {
    for (const ds of Object.values(buc)) {
      for (const x of [].concat(ds || [])) {
        muc = Math.max(muc, Number(x.call_count) || 0, Number(x.total_cputime) || 0, Number(x.total_time) || 0);
        choPhut = Math.max(choPhut, Number(x.estimated_time_to_regain_access) || 0);
      }
    }
  }
  return { muc, choPhut };
}

class NhipGoi {
  constructor({ bayGio = () => Date.now(), ngu = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    this.bayGio = bayGio;
    this.ngu = ngu;
    this.muc = 0;
    this.chanDen = 0;
    this.lanLui = 0;
    this.lanGoiCuoi = 0;
  }

  khoangCachMs() {
    if (this.muc > 80) return 10000;
    if (this.muc > 50) return 2000;
    return 0;
  }

  /** Số mili giây phải chờ trước lần gọi kế tiếp. */
  canCho() {
    const now = this.bayGio();
    return Math.max(0, this.chanDen - now, this.lanGoiCuoi + this.khoangCachMs() - now);
  }

  /**
   * Chờ tới lượt. Phải chờ lâu hơn `toiDaChoMs` thì báo lỗi ngay (việc gửi tin không đứng đợi 5 phút).
   * @returns {Promise<void>}
   */
  async truocKhiGoi({ toiDaChoMs = 15000 } = {}) {
    // Xếp hàng thật (F-67, L13): nhiều lời gọi cùng lúc lần lượt tới lượt, không cùng tính một khoảng chờ rồi cùng gọi.
    // Tổng thời gian đứng hàng + chờ quá toiDaChoMs thì báo lỗi (nơi gửi thẻ đưa vào hàng gửi lại, không đứng đợi mãi).
    const vao = this.bayGio();
    const truoc = this.hang || Promise.resolve();
    let xong;
    this.hang = new Promise((r) => { xong = r; });
    try {
      await truoc;
      const cho = this.canCho();
      if (this.bayGio() - vao + cho > toiDaChoMs) {
        const e = new Error(`Facebook đang giới hạn lượt gọi, còn khoảng ${Math.ceil(cho / 1000)} giây.`);
        e.ma = 'FB_GIOI_HAN_GOI';
        throw e;
      }
      if (cho > 0) await this.ngu(cho);
      this.lanGoiCuoi = this.bayGio();
    } finally {
      xong();
    }
  }

  /** Sau mỗi lần gọi: đọc header. */
  sauKhiGoi(layHeader) {
    const { muc, choPhut } = docHeader(layHeader);
    this.muc = muc;
    if (choPhut > 0) this.chanDen = Math.max(this.chanDen, this.bayGio() + choPhut * 60000);
  }

  /** Graph API trả lỗi: là lỗi giới hạn thì ngừng gọi một lúc. Trả true nếu là lỗi giới hạn. */
  khiLoi(maLoi, layHeader = () => null) {
    if (!MA_GIOI_HAN.has(Number(maLoi))) return false;
    const { choPhut } = docHeader(layHeader);
    const ms = choPhut > 0 ? choPhut * 60000 : Math.min(LUI_TOI_DA_MS, 5000 * 2 ** this.lanLui);
    this.lanLui += 1;
    this.chanDen = Math.max(this.chanDen, this.bayGio() + ms);
    return true;
  }

  khiThanhCong() {
    this.lanLui = 0;
  }

  trangThai() {
    const con = Math.max(0, this.chanDen - this.bayGio());
    return { muc_dung: this.muc, dang_gioi_han: con > 0, con_giay: Math.ceil(con / 1000) };
  }
}

module.exports = { NhipGoi, docHeader, MA_GIOI_HAN };
