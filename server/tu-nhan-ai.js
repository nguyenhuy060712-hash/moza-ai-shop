'use strict';

/**
 * Mai tự nhận là trợ lý AI bằng lời trên sóng (BH10, F-109, #131; docs/11 mục 4.3). Câu mẫu do MÃ soạn (`cau-mau-khach.json`
 * `tu_nhan_ai_song`, 5 biến thể, qua K11) — không qua AI. Phòng live gọi `nhip` khi buổi live bắt đầu và mỗi phút; mỗi 15 phút một lần:
 *  - Mai nói cùng / Mai dẫn chính (miệng sẵn sàng) → `mieng.noiNguyenVan(cau)`, rồi kiểm chữ chép lại lời Mai có "trợ lý AI"; không có
 *    → nhắc lại một lần; vẫn không → ô nhắc người dẫn tự nói. GPT-Live không bảo đảm nói đúng nguyên văn (docs/11 T5).
 *  - Đội AI dẫn → câu chen `tu_nhan_ai` của đội (bỏ qua nếu 15 phút qua đội đã nói câu có "trợ lý AI", ví dụ câu "người mới vào").
 *  - Chỉ gợi ý, "Dừng AI", "Dừng mọi thứ", miệng chưa sẵn sàng → ô nhắc lớn trên Màn hình người dẫn: "Đến lúc nói: …".
 * Mỗi lần ghi nhật ký buổi live (`nhat_ky_song`, loại sự kiện) để có bằng chứng.
 */

const live = require('./nghiep-vu/live');
const caiDat = require('./nghiep-vu/cai-dat');
const cm = require('./nghiep-vu/cau-mau-khach');
const nhatKySong = require('./nghiep-vu/nhat-ky-song');

const MOI_MS = 15 * 60 * 1000;
const CHO_CHU_MS = 20000;
const CHO_DOI_MS = 3 * 60 * 1000;
const LA_TU_NHAN = /trợ lý AI/i;

class TuNhanAi {
  /** @param {{phat:Function, phongAi?:object, moiMs?:number, choChuMs?:number}} o */
  constructor({ phat, phongAi = null, moiMs = MOI_MS, choChuMs = CHO_CHU_MS }) {
    Object.assign(this, { phat, phongAi, moiMs, choChuMs });
    this.cuoi = new Map(); // phienId → lúc tự nhận gần nhất
    this.dangLam = new Set();
    this.choDoi = new Map(); // phienId → lúc bắt đầu chờ Đội AI dẫn
  }

  /** Câu tự nhận (xoay vòng 5 biến thể). */
  cau() {
    const tenAi = require('./nghiep-vu/doi-ai').tenChinh();
    return cm.cau('tu_nhan_ai_song', { ten_ai: tenAi });
  }

  /**
   * Gọi khi bắt đầu buổi và mỗi phút. Tới hẹn thì tự nhận theo chế độ đang chạy.
   * @returns {Promise<'mai'|'doi_ai'|'nhac'|null>}
   */
  async nhip(phienId, bayGio = Date.now()) {
    let p;
    try { p = live.layPhien(phienId); } catch { return null; }
    if (!p || p.trang_thai !== 'dang_live' || this.dangLam.has(p.id)) return null;
    // Đội AI vừa tự nói câu có "trợ lý AI" (câu người mới vào, báo giờ Radio) thì tính là đã tự nhận.
    const doiNoi = p.doi_ai ? this.phongAi?.doiAi?.lucTuNhan?.(p.id) : null;
    if (doiNoi) this.cuoi.set(p.id, Math.max(this.cuoi.get(p.id) || 0, doiNoi));
    const cuoi = this.cuoi.get(p.id);
    if (cuoi && bayGio - cuoi < this.moiMs) return null;
    // Giọng AI chưa sẵn sàng — Đội AI chưa bắt đầu đọc (chưa mở Màn hình người dẫn; đoạn mở màn của đội tự giới thiệu là trợ lý AI), hoặc
    // miệng của Mai đang mở — chờ tới 3 phút rồi mới nhắc người dẫn (không nhắc thừa ngay giây đầu buổi).
    const chuaSan = p.doi_ai ? !!this.phongAi?.doiAi?.dangDan && !this.phongAi.doiAi.dangDan(p.id)
      : p.che_do_ai === 'noi' && !!this.phongAi?.miengSanSang && !this.phongAi.miengSanSang(p);
    if (chuaSan && !caiDat.dungAi().bat && !caiDat.khanCap()) {
      if (!this.choDoi.has(p.id)) this.choDoi.set(p.id, bayGio);
      if (bayGio - this.choDoi.get(p.id) < CHO_DOI_MS) return null;
    }
    this.cuoi.set(p.id, bayGio);
    const cau = this.cau();
    if (caiDat.dungAi().bat || caiDat.khanCap()) return this.nhac(p, cau);
    if (p.doi_ai) {
      const danDuoc = this.phongAi?.doiAi?.dangDan ? this.phongAi.doiAi.dangDan(p.id) : true;
      if (danDuoc && this.phongAi?.doiAi?.chenBanHang?.(p.id, 'tu_nhan_ai', {})) {
        this.ghi(p, `Đội AI tự nhận là trợ lý AI (câu chen ${this.cuoiChu(cau)}).`);
        return 'doi_ai';
      }
      return this.nhac(p, cau);
    }
    if (this.phongAi?.miengSanSang?.(p)) {
      this.dangLam.add(p.id);
      try { return await this.noiMai(p, cau); } finally { this.dangLam.delete(p.id); }
    }
    return this.nhac(p, cau);
  }

  /** Mai nói nguyên văn; chữ chép lại phải có "trợ lý AI" — không có thì nhắc lại một lần, rồi ô nhắc người dẫn. */
  async noiMai(p, cau) {
    const mieng = this.phongAi.mieng;
    for (let lan = 0; lan < 2; lan += 1) {
      const cho = mieng.choChu ? mieng.choChu(LA_TU_NHAN, this.choChuMs) : Promise.resolve(false);
      mieng.noiNguyenVan(cau);
      if (await cho) {
        this.ghi(p, `Mai tự nhận là trợ lý AI${lan ? ' (nhắc lần 2)' : ''}: "${cau}"`);
        return 'mai';
      }
    }
    return this.nhac(p, cau, 'Mai chưa nói câu tự nhận AI — bạn nói giúp');
  }

  /** Ô nhắc người dẫn tự nói. */
  nhac(p, cau, vi = 'Đến lúc nói') {
    this.phat('live.nhac_tu_nhan', { phien_id: p.id, cau, ly_do: vi });
    try { this.phongAi?.bao?.(`${vi}: "${cau}"`, 'vang'); } catch { /* không có phiên AI */ }
    this.ghi(p, `Nhắc người dẫn tự nói câu tự nhận AI: "${cau}"`);
    return 'nhac';
  }

  ghi(p, noiDung) {
    try { nhatKySong.ghi({ phienId: p.id, loai: 'su_kien', noiDung }); } catch { /* cơ sở dữ liệu đã đóng */ }
  }

  cuoiChu(cau) { return `"${String(cau).slice(0, 40)}…"`; }

  ketThuc(phienId) {
    this.cuoi.delete(phienId);
    this.choDoi.delete(phienId);
  }
}

module.exports = { TuNhanAi, MOI_MS, LA_TU_NHAN };
