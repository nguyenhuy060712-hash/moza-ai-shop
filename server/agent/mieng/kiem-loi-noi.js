'use strict';

/**
 * Kiểm lời Mai trên sóng và tự đính chính (SPEC.md F-105). Chữ chép tiếng Mai (GPT Live 1 `output_transcript`, Gemini 3.8 Live
 * `outputTranscription`) về từng mẩu → gom theo câu, chỉ xét con số ĐÃ TRỌN (sau số đã có dấu câu, hoặc lặng 600 ms: "159." + "000đ"
 * không bị báo nhầm) → cửa hook `truoc_phat` (hook kiem-loi-noi) → lỗi "chắc":
 *   (1) bỏ phần tiếng còn lại của câu sai (GPT Live 1 không có lệnh dừng câu: giữ im tới câu mới; Gemini: lượt mới cắt ngang),
 *   (2) Thanh chữ hiện dòng đính chính 12 giây (`mhsp.dinh_chinh`, máy điền), (3) Mai nói câu mẫu đính chính (`dinhChinh`),
 *   (4) Màn hình người dẫn băng đỏ (`live.dinh_chinh`). Lỗi "nghi" → băng vàng (`live.nghi_sai`), không đính chính.
 * Câu đính chính vẫn sai, hoặc 3 lỗi "chắc" trong một buổi → hạ về "Chỉ gợi ý". Mỗi (món, loại lỗi) đính chính tối đa 1 lần / 60 giây.
 * Lỗi có lợi cho khách (giá / phí ship thấp hơn) mở "khoảng nói nhầm" cho F-106.
 */

const live = require('../../nghiep-vu/live');
const loiNoi = require('../../nghiep-vu/loi-noi');
const { hienTien } = require('../../nghiep-vu/chung');
const { chayCua } = require('../hook/cua');
const { cauDinhChinh } = require('../kiem-tra/kiem-so-noi');

const MAC_DINH = { tu_dinh_chinh: true, nguong_ha_goi_y: 3, lap_lai_giay: 60, hien_thanh_chu_giay: 12, cho_so_tron_ms: 600, them_khoang_giay: 60,
  cua_so_dinh_chinh_ms: 20000, ha_sau_ms: 5000 };

const sachChu = (s) => String(s || '').replace(/\[[^\]\n]{1,24}\]\s*/g, '').trim();

class KiemLoiNoiSong {
  /**
   * @param {object} o
   * @param {object} o.mieng        MiengCuaMai
   * @param {object} [o.cauHinh]    đè mac-dinh.json kiem_loi_noi (test rút ngắn thời gian)
   * @param {(loi:object)=>void} [o.khiNoiNham]  F-106: lỗi có lợi cho khách vừa mở khoảng nói nhầm
   */
  constructor({ mieng, cauHinh = {}, khiNoiNham = null }) {
    this.mieng = mieng;
    this.ch = { ...MAC_DINH, ...(require('../../cau-hinh/mac-dinh.json').kiem_loi_noi || {}), ...cauHinh };
    this.khiNoiNham = khiNoiNham;
    this.lap = new Map(); // `${phien}|${loai}|${so}` → lúc đính chính gần nhất
    this.dinhChinhDen = new Map(); // phiên → hết cửa sổ "câu này là câu đính chính"
    this.dangCho = new Set();
  }

  /** Mẩu chữ Mai mới (m.chuMai đã cộng). `moi` = câu mới. */
  nhan(m, chu, moi) {
    if (moi) { m.daXet = new Set(); m.kiemCuoi = ''; }
    clearTimeout(m.henKiem);
    const cau = sachChu(m.chuMai);
    // Mẩu kết thúc bằng dấu câu mà trước đó KHÔNG phải chữ số ("159." có thể còn "000đ") → xét ngay; còn lại chờ lặng.
    if (/[.!?;,…]\s*$/.test(chu) && !/\d[.,]\s*$/.test(cau)) { this.kiem(m).catch(() => {}); return; }
    m.henKiem = setTimeout(() => this.kiem(m).catch(() => {}), this.ch.cho_so_tron_ms);
    m.henKiem.unref?.();
  }

  dong(m) {
    if (m) clearTimeout(m.henKiem);
  }

  soDangNoi(p) {
    const d = p?.kich_ban?.doan?.[p.doan_hien_tai];
    if (!d?.san_pham_id) return null;
    try { return require('../../nghiep-vu/san-pham').laySanPham(d.san_pham_id).so; } catch { return null; }
  }

  async kiem(m) {
    if (this.mieng.m !== m || !m.phienId || m.chan === 'dung') return;
    const cau = sachChu(m.chuMai);
    if (!cau || cau === m.kiemCuoi) return;
    m.kiemCuoi = cau;
    let p = null;
    try { p = live.layPhien(m.phienId); } catch { return; }
    const ctx = { cau, phienId: m.phienId, soDangNoi: this.soDangNoi(p), runId: null };
    await chayCua('truoc_phat', ctx);
    if (this.mieng.m !== m) return;
    for (const l of ctx.loi || []) {
      m.daXet = m.daXet || new Set();
      const khoa = `${l.loai}|${l.so ?? ''}|${l.noi}`;
      if (m.daXet.has(khoa)) continue;
      m.daXet.add(khoa);
      const lapKhoa = `${m.phienId}|${l.loai}|${l.so ?? ''}`;
      // Câu ngay sau đính chính (câu đính chính) luôn được xét, kể cả cùng lỗi: sai lần nữa thì về "Chỉ gợi ý".
      const dangDinhChinh = l.muc === 'chac' && Date.now() < (this.dinhChinhDen.get(m.phienId) || 0);
      if (!dangDinhChinh && Date.now() - (this.lap.get(lapKhoa) || 0) < this.ch.lap_lai_giay * 1000) continue;
      if (l.muc !== 'chac' || !this.ch.tu_dinh_chinh) {
        loiNoi.ghi({ phienId: m.phienId, cau, loi: { ...l, muc: 'nghi' }, model: m.model, dienTap: !!p.dien_tap });
        this.mieng.phat('live.nghi_sai', { phien_id: m.phienId, chu: `Nghi Mai nói nhầm: ${chuNoi(l)} — ${l.dung_chu}. Kiểm lại, nhắc nếu cần.` });
        continue;
      }
      this.lap.set(lapKhoa, Date.now());
      await this.dinhChinh(m, l, cau, p);
      return; // một câu sai chỉ đính chính một lần (câu đã bỏ)
    }
  }

  async dinhChinh(m, l, cau, p) {
    const bayGio = Date.now();
    // Câu vừa rồi là câu đính chính mà vẫn sai → thôi đính chính, về "Chỉ gợi ý".
    if (bayGio < (this.dinhChinhDen.get(m.phienId) || 0)) {
      loiNoi.ghi({ phienId: m.phienId, cau, loi: l, model: m.model, dienTap: !!p.dien_tap });
      this.mieng.phat('live.dinh_chinh', { phien_id: m.phienId, muc: 'do', chu: `Mai đính chính vẫn nói sai (${chuNoi(l)}; đúng: ${l.dung_chu}). Đã chuyển về "Chỉ gợi ý" — bạn nói lại giá đúng.` });
      await this.mieng.haVeGoiY(m.phienId, 'Mai đính chính vẫn nói sai số');
      return;
    }
    const c = cauDinhChinh(l);
    // (1) Bỏ tiếng còn lại của câu sai. GPT Live 1 nói nốt câu (không có lệnh dừng): giữ im tới câu nói mới sau một khoảng lặng.
    // Gemini: lượt mới (turnComplete) cắt ngang ở máy chủ, không giữ im để khỏi mất đầu câu đính chính.
    if (m.nha === 'openai') { m.chan = 'cho_cau_moi'; m.amCuoi = bayGio; }
    this.mieng.boTiengCho('Mai nói sai số: đính chính');
    m.chuMai = '';
    m.daXet = new Set();
    m.kiemCuoi = '';
    // (3) Miệng nói câu mẫu.
    if (typeof m.ket.dinhChinh === 'function') m.ket.dinhChinh(c.noi);
    else m.ket.hoi(`MOZA đính chính — nói ngay đúng nguyên văn, giữ nguyên con số: "${c.noi}"`);
    this.dinhChinhDen.set(m.phienId, bayGio + this.ch.cua_so_dinh_chinh_ms);
    const coLoiChoKhach = (l.loai === 'gia' || l.loai === 'ship') && l.dung != null && l.noi < l.dung;
    const hetKhoang = coLoiChoKhach ? new Date(bayGio + (Number(p.do_tre_giay) || 15) * 1000 + this.ch.them_khoang_giay * 1000).toISOString() : null;
    const dong = loiNoi.ghi({ phienId: m.phienId, cau, loi: l, model: m.model, dienTap: !!p.dien_tap, dinhChinhLuc: new Date(bayGio).toISOString(), hetKhoangLuc: hetKhoang });
    // (2) Thanh chữ, (4) Màn hình người dẫn, nhật ký buổi.
    this.mieng.phat('mhsp.dinh_chinh', { phien_id: m.phienId, chu: c.thanh_chu, giay: this.ch.hien_thanh_chu_giay });
    this.mieng.phat('live.dinh_chinh', { phien_id: m.phienId, muc: 'chac', loi_id: dong.id,
      chu: `Mai vừa nói ${chuNoi(l)}, đúng là ${l.dung_chu}. Đã đính chính trên sóng.` });
    require('../../nghiep-vu/nhat-ky-song').ghi({ phienId: m.phienId, loai: 'su_kien', noiDung: `${c.thanh_chu} (Mai vừa nói ${chuNoi(l)})` });
    if (hetKhoang) { try { this.khiNoiNham?.(dong); } catch (e) { console.error(`  [kiểm lời] khoảng nói nhầm: ${e.message}`); } }
    if (loiNoi.demChac(m.phienId) >= this.ch.nguong_ha_goi_y) {
      const phienId = m.phienId;
      const hen = setTimeout(() => {
        this.mieng.phat('live.dinh_chinh', { phien_id: phienId, muc: 'do', chu: `Mai nói sai số ${this.ch.nguong_ha_goi_y} lần trong buổi: đã chuyển về "Chỉ gợi ý".` });
        this.mieng.haVeGoiY(phienId, `Mai nói sai số ${this.ch.nguong_ha_goi_y} lần trong buổi`).catch(() => {});
      }, this.ch.ha_sau_ms); // chờ Mai nói xong câu đính chính
      hen.unref?.();
    }
  }
}

function chuNoi(l) {
  if (l.loai === 'con') return `"còn ${l.noi}"`;
  if (l.loai === 'khan_hiem') return '"sắp hết"';
  return hienTien(l.noi);
}

module.exports = { KiemLoiNoiSong, MAC_DINH };
