'use strict';

/**
 * Bảng huấn luyện người dẫn (SPEC.md F-116; docs/11 mục 6.1) — bằng mã, 0 đồng. 20 giây một lần trong lúc live: ghi dòng số liệu của
 * phút đang chạy (so_lieu_phut), xét 4 cảnh báo theo thứ tự ưu tiên, phát ws `live.huan_luyen {phien_id, canh_bao, so_lieu_phut[]}`:
 *  1. câu hỏi chưa ai trả lời > 60 giây (chạm để mở F-115);
 *  2. người xem tụt ≥ 30% trong 3 phút;
 *  3. 5 phút chưa nhắc cách chốt / giá (lời Mai, Đội AI, người dẫn đã chép);
 *  4. món nguội — cùng luật gợi ý nhịp F-85 (nhip-ban.js vẫn chạy riêng).
 * Tối đa 1 cảnh báo / 2 phút. Đội AI dẫn → chỉ số liệu, không cảnh báo. Máy không tự làm gì thay người dẫn.
 */

const live = require('./nghiep-vu/live');
const soLieu = require('./nghiep-vu/so-lieu-phut');

const MAC = () => ({ moi_giay: 20, cach_phut: 2, cau_hoi_giay: 60, tut_phan_tram: 30, tut_phut: 3, tut_toi_thieu: 5, nhac_chot_phut: 5,
  nguoi_phut: 4, ...(require('./cau-hinh/mac-dinh.json').huan_luyen || {}) });

class HuanLuyen {
  constructor({ phat = () => {}, dongHo = () => Date.now() } = {}) {
    Object.assign(this, { phat, dongHo });
    this.cuoi = new Map(); // phienId → lúc cảnh báo gần nhất
    this.canhBaoCuoi = new Map(); // phienId → cảnh báo gần nhất (mở lại màn hình giữa buổi vẫn thấy)
    this.hen = null;
  }

  batDau() {
    clearInterval(this.hen);
    this.hen = setInterval(() => { try { this.xem(); } catch (e) { console.error('  [huấn luyện] ' + e.message); } }, MAC().moi_giay * 1000);
    this.hen.unref?.();
  }

  dung() { clearInterval(this.hen); }

  /** Cảnh báo đầu tiên theo thứ tự ưu tiên, hoặc null. Không xét giới hạn 2 phút. */
  xetCanhBao(p, bayGio = this.dongHo()) {
    const m = MAC();
    const hoi = soLieu.cauHoiChuaTraLoi(p.id, { giay: m.cau_hoi_giay, bayGio });
    if (hoi.length) {
      const b = hoi[0];
      return { loai: 'cau_hoi', muc: 'warn', binh_luan_id: b.id, so: hoi.length,
        cau: `${hoi.length} câu hỏi chưa ai trả lời — ${b.ten}: "${b.noi_dung.slice(0, 80)}". Chạm để Mai soạn câu trả lời.` };
    }
    const ds = soLieu.docPhien(p.id).filter((x) => x.nguoi_xem != null);
    const moi = ds.at(-1);
    if (moi) {
      const truoc = ds.filter((x) => x.phut < moi.phut && x.phut >= moi.phut - m.tut_phut);
      const dinh = Math.max(0, ...truoc.map((x) => x.nguoi_xem));
      if (dinh >= m.tut_toi_thieu && moi.nguoi_xem <= dinh * (1 - m.tut_phan_tram / 100)) {
        const pt = Math.round((1 - moi.nguoi_xem / dinh) * 100);
        return { loai: 'nguoi_xem_tut', muc: 'warn', cau: `Người xem giảm ${pt}% trong ${m.tut_phut} phút (${dinh} → ${moi.nguoi_xem}): thử bình chọn màu, mời khách bình luận, hoặc sang món nổi bật.` };
      }
    }
    const batDau = new Date(p.bat_dau).getTime();
    if (bayGio - batDau >= m.nhac_chot_phut * 60e3) {
      const cuoi = soLieu.lanNhacChotCuoi(p.id);
      if (!cuoi || bayGio - new Date(cuoi).getTime() >= m.nhac_chot_phut * 60e3) {
        return { loai: 'nhac_chot', muc: 'info', cau: `${m.nhac_chot_phut} phút chưa nhắc giá / cách chốt: nhắc lại giá và câu "chốt + số + màu + size".` };
      }
    }
    const doan = p.kich_ban?.doan?.[p.doan_hien_tai];
    if (doan?.san_pham_id) {
      const tuDoan = live.lucDoanHienTai(p.id) || p.bat_dau;
      if (tuDoan && bayGio - new Date(tuDoan).getTime() >= m.nguoi_phut * 60e3) {
        const lang = live.soLieuMon(p.id, doan.san_pham_id, new Date(bayGio - 3 * 60e3).toISOString());
        if (!lang.chot && !lang.hoi) {
          let ten = 'món này';
          try { const sp = require('./nghiep-vu/san-pham'); ten = sp.tenGoi(sp.laySanPham(doan.san_pham_id)); } catch { /* món đã xóa */ }
          return { loai: 'mon_nguoi', muc: 'info', cau: `3 phút chưa ai hỏi, chưa ai chốt ${ten}: sang món tiếp?` };
        }
      }
    }
    return null;
  }

  /** Cảnh báo gần nhất của phiên nếu còn trong khoảng 2 phút (GET /huan-luyen khi mở lại màn hình). */
  canhBaoGanDay(phienId, bayGio = this.dongHo()) {
    const c = this.canhBaoCuoi.get(phienId);
    return c && bayGio - new Date(c.luc).getTime() < MAC().cach_phut * 60e3 ? c : null;
  }

  /** @returns {object|null} gói vừa phát */
  xem(bayGio = this.dongHo()) {
    const p = live.phienDangMo();
    if (!p || p.trang_thai !== 'dang_live' || !p.bat_dau) return null;
    soLieu.ghiPhut(p.id, { bayGio });
    let canhBao = null;
    if (!p.doi_ai && bayGio - (this.cuoi.get(p.id) || 0) >= MAC().cach_phut * 60e3) {
      canhBao = this.xetCanhBao(p, bayGio);
      if (canhBao) { this.cuoi.set(p.id, bayGio); this.canhBaoCuoi.set(p.id, { ...canhBao, luc: new Date(bayGio).toISOString() }); }
    }
    const goi = { phien_id: p.id, canh_bao: canhBao ? { ...canhBao, luc: new Date(bayGio).toISOString() } : null, so_lieu_phut: soLieu.docPhien(p.id) };
    this.phat('live.huan_luyen', goi);
    return goi;
  }
}

module.exports = { HuanLuyen, MAC };
