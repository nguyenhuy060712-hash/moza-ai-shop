'use strict';

/**
 * Một gợi ý nhịp bán cho người dẫn (SPEC.md F-85, P16) — chạy 20 giây một lần, chỉ ở chế độ Chỉ gợi ý và Co-host được nói
 * (người dẫn cầm nhịp; Mai dẫn chính và Đội AI dẫn không gợi ý). Không có SQL, không gọi AI.
 *  - (a) món đang nói có ≥ 3 người chốt trong 2 phút → "Áo số 12 đang có nhiều người chốt: nói thêm một vòng màu, size còn hàng?";
 *  - (b) ở món ≥ 4 phút, 3 phút không ai chốt, không ai hỏi → "Chưa ai hỏi áo số 7: sang món tiếp (váy số 15)?".
 * Dùng ô gợi ý chung (phongAi.hienGoiY, loại director — không đè câu Co-host vừa hiện). Tối đa 1 gợi ý / 3 phút. Máy không tự
 * chuyển món; không bao giờ dựa vào nhịp chốt để nói "sắp hết".
 */

const live = require('./nghiep-vu/live');
const sp = require('./nghiep-vu/san-pham');

const MAC = () => ({ moi_giay: 20, cach_phut: 3, nong_nguoi: 3, nong_phut: 2, nguoi_phut: 4, ...(require('./cau-hinh/mac-dinh.json').nhip_ban || {}) });

class NhipBan {
  constructor({ phongAi = null, phat = () => {}, dongHo = () => Date.now() }) {
    Object.assign(this, { phongAi, phat, dongHo });
    this.cuoi = new Map(); // phienId → lúc gợi ý gần nhất
    this.hen = null;
  }

  batDau() {
    clearInterval(this.hen);
    this.hen = setInterval(() => { try { this.xem(); } catch (e) { console.error('  [nhịp bán] ' + e.message); } }, MAC().moi_giay * 1000);
    this.hen.unref?.();
  }

  dung() { clearInterval(this.hen); }

  /** @returns {string|null} câu gợi ý vừa hiện */
  xem(bayGio = this.dongHo()) {
    const m = MAC();
    const p = live.phienDangMo();
    if (!p || p.trang_thai !== 'dang_live' || p.che_do_ai === 'tat' || p.doi_ai || p.mai_dan) return null;
    if (bayGio - (this.cuoi.get(p.id) || 0) < m.cach_phut * 60e3) return null;
    const doan = p.kich_ban.doan[p.doan_hien_tai];
    if (!doan?.san_pham_id) return null;
    let s;
    try { s = sp.laySanPham(doan.san_pham_id); } catch { return null; }
    const tuDoan = live.lucDoanHienTai(p.id) || p.bat_dau;
    const nong = live.soLieuMon(p.id, s.id, new Date(bayGio - m.nong_phut * 60e3).toISOString());
    let cau = null;
    if (nong.chot >= m.nong_nguoi) {
      cau = `${hoa(sp.tenGoi(s))} đang có nhiều người chốt: nói thêm một vòng màu, size còn hàng?`;
    } else if (tuDoan && bayGio - new Date(tuDoan).getTime() >= m.nguoi_phut * 60e3) {
      const lang = live.soLieuMon(p.id, s.id, new Date(bayGio - 3 * 60e3).toISOString());
      if (!lang.chot && !lang.hoi) {
        const ke = p.kich_ban.doan.slice(p.doan_hien_tai + 1).find((d) => d.san_pham_id);
        let sKe = null;
        try { sKe = ke ? sp.laySanPham(ke.san_pham_id) : null; } catch { sKe = null; }
        cau = `Chưa ai hỏi ${sp.tenGoi(s)}: sang món tiếp${sKe ? ` (${sp.tenGoi(sKe)})` : ''}?`;
      }
    }
    if (!cau) return null;
    this.cuoi.set(p.id, bayGio);
    try { this.phongAi?.hienGoiY({ loai: 'director', cau, so: s.so }); } catch { return null; }
    this.phat('live.nhip_ban', { phien_id: p.id, cau });
    return cau;
  }
}

const hoa = (x) => `${x.charAt(0).toUpperCase()}${x.slice(1)}`;

module.exports = { NhipBan };
