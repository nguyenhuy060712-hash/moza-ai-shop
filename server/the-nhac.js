'use strict';

/**
 * Thẻ nhắc người dẫn khi khách xin xem (SPEC.md F-81, #109): "xoay lưng", "soi vải", "đứng xa", "mặc màu be" — nhận bằng mã
 * (tu-khoa.json muon_xem), không gọi AI; bình luận vẫn tới Director. Không có SQL.
 *  - Gom cùng loại, cùng món trong 60 giây: người sau thêm tên (tối đa 3 tên + "và N bạn").
 *  - Mỗi lúc một thẻ; thẻ khác xếp hàng (tối đa 3). Tự tắt 60 giây sau lần cập nhật cuối, hoặc khi người dẫn bấm "Đã làm".
 *  - Màu khác / cận vải có nút chiếu ảnh đúng màu / video quay thật. Mai dẫn chính, Đội AI: MOZA tự chiếu.
 *  - Đội AI: câu mẫu da_nghe_yeu_cau (≤ 1 câu / 2 phút mỗi loại, tính vào trần câu chen); Mai dẫn chính: một câu ngắn.
 * Chạy cả khi "Dừng AI" (bằng mã); câu Đội AI / Mai thì dừng theo công tắc của chúng. Chế độ "Tắt AI": không chạy.
 */

const tk = require('./nghiep-vu/tu-khoa');
const sp = require('./nghiep-vu/san-pham');
const lienHe = require('./nghiep-vu/lien-he');
const { taoId } = require('./nghiep-vu/chung');

const MAC = () => ({ gom_giay: 60, tat_sau_giay: 60, hang_toi_da: 3, cach_cau_giay: 120, ...(require('./cau-hinh/mac-dinh.json').the_nhac || {}) });
const VIEC = { mat_sau: 'xem mặt sau', can_vai: 'xem cận vải', toan_than: 'xem dáng toàn thân', mau_khac: 'xem màu {mau}' };
const TEN_AN = 'Một bạn';

function tenGoi(ten) {
  return String(ten || '').trim().split(/\s+/).filter(Boolean).at(-1) || 'bạn';
}

class TheNhac {
  /**
   * @param {object} o
   * @param {Function} o.phat
   * @param {object} [o.phongAi]      Đội AI (doiAi.chenBanHang), miệng (mieng.baoYeuCau), miengSanSang
   * @param {Function} [o.layManHinh] Màn hình sản phẩm (tự chiếu khi AI dẫn)
   */
  constructor({ phat, phongAi = null, layManHinh = null, gomMs = null, tatMs = null, cachCauMs = null }) {
    const m = MAC();
    Object.assign(this, { phat, phongAi, layManHinh, gomMs: gomMs ?? m.gom_giay * 1000, tatMs: tatMs ?? m.tat_sau_giay * 1000,
      hangToiDa: m.hang_toi_da, cachCauMs: cachCauMs ?? m.cach_cau_giay * 1000 });
    this.phienId = null;
    this.hien = null;
    this.hang = [];
    this.cauCuoi = new Map(); // loai → lúc đọc câu Đội AI / Mai gần nhất
    this.hen = null;
  }

  datLai(phienId) {
    clearTimeout(this.hen);
    Object.assign(this, { phienId, hien: null, hang: [] });
    this.cauCuoi.clear();
  }

  /** Người này được hiện tên không (ẩn danh, xin ẩn tên, xin dừng — F-66). */
  tenCua(bl) {
    if (bl.nhan?.includes('an_danh') || bl.nhan?.includes('an_ten')) return TEN_AN;
    try {
      const n = require('./nghiep-vu/hop-thu').nguoiCuaBinhLuan(bl, require('./nghiep-vu/live').layPhien(bl.phien_id));
      if (lienHe.daAnTen(n.id) || lienHe.daNgung(n.id)) return TEN_AN;
    } catch { /* không tìm được người: dùng tên bình luận */ }
    return tenGoi(bl.ten);
  }

  /**
   * Một bình luận có nhãn muon_xem.
   * @returns {object|null} thẻ vừa tạo / cập nhật
   */
  nhan(bl, p, bayGio = Date.now()) {
    if (!p || p.che_do_ai === 'tat') return null;
    if (this.phienId !== p.id) this.datLai(p.id);
    let s = null;
    try { s = bl.so_doan != null ? sp.layTheoSo(bl.so_doan) : null; } catch { s = null; }
    const mauCo = s ? sp.phanLoaiCua(s.id).map((x) => x.gt1) : [];
    const y = tk.loaiMuonXem(bl.noi_dung, { mauCo: mauCo.length ? mauCo : this.mauDangBan() });
    if (!y) return null;
    const khoa = `${y.loai}|${y.mau || ''}|${s?.id || ''}`;
    const ten = this.tenCua(bl);
    const cu = [this.hien, ...this.hang].find((x) => x && x.khoa === khoa && bayGio - x.luc_cap_nhat < this.gomMs);
    let the = cu;
    if (cu) {
      if (ten === TEN_AN || !cu.ten.includes(ten)) cu.ten.push(ten);
      cu.luc_cap_nhat = bayGio;
    } else {
      the = { id: taoId('thn'), khoa, loai: y.loai, mau: y.mau || null, so: s?.so ?? null, san_pham_id: s?.id || null, ten: [ten], luc_tao: bayGio, luc_cap_nhat: bayGio };
      if (!this.hien) this.hien = the;
      else if (this.hang.length < this.hangToiDa) this.hang.push(the);
      else return null; // hàng đã đầy: bỏ (người dẫn đang bận với 4 thẻ)
    }
    if (the === this.hien) this.henTat();
    this.bao();
    this.noiVaChieu(the, p, bayGio);
    return this.dang(the);
  }

  mauDangBan() {
    try { return [...new Set(sp.mucLucDangBan().flatMap((x) => sp.phanLoaiCua(x.id).map((q) => q.gt1)))]; } catch { return []; }
  }

  henTat() {
    clearTimeout(this.hen);
    if (!this.hien) return;
    const con = Math.max(0, this.hien.luc_cap_nhat + this.tatMs - Date.now());
    this.hen = setTimeout(() => this.tat(), con);
    this.hen.unref?.();
  }

  /** Thẻ đang hiện tắt (hết giờ hoặc người dẫn bấm "Đã làm") → thẻ kế tiếp trong hàng. */
  tat() {
    clearTimeout(this.hen);
    this.hien = this.hang.shift() || null;
    if (this.hien) { this.hien.luc_cap_nhat = Math.max(this.hien.luc_cap_nhat, Date.now()); this.henTat(); }
    this.bao();
  }

  /**
   * Thẻ ưu tiên cao nhất (F-86 kết quả bình chọn): lên ngay, thẻ đang hiện lùi về đầu hàng chờ.
   * @param {{phienId:string, chu:string, nut?:object[]}} o
   */
  themTheUuTien({ phienId, chu, nut = [] }) {
    if (this.phienId !== phienId) this.datLai(phienId);
    const bayGio = Date.now();
    const the = { id: taoId('thn'), khoa: `uu_tien|${bayGio}`, loai: 'uu_tien', chu_san: chu, nut_san: nut, mau: null, so: null, ten: [], luc_tao: bayGio, luc_cap_nhat: bayGio };
    if (this.hien) this.hang.unshift(this.hien);
    this.hang = this.hang.slice(0, this.hangToiDa);
    this.hien = the;
    this.henTat();
    this.bao();
    return this.dang(the);
  }

  /** Người dẫn bấm "Đã làm". */
  xong(id) {
    if (this.hien?.id === id) this.tat();
    else { this.hang = this.hang.filter((x) => x.id !== id); this.bao(); }
    return this.trangThai();
  }

  /** Món của thẻ bán theo cân (rau, củ — 8/10/2026): không có "vải", "mặt sau" mà là xem gần. */
  banTheoCan(the) {
    if (!the.so) return false;
    try { return sp.donVi(sp.layTheoSo(the.so)) === 'kg'; } catch { return false; }
  }

  viec(the) {
    if (the.loai === 'can_vai' && this.banTheoCan(the)) return 'xem gần';
    return VIEC[the.loai].replace('{mau}', String(the.mau || '').toLowerCase());
  }

  /** Chữ thẻ: "Hằng muốn xem mặt sau" / "3 người muốn xem mặt sau: Hằng, Thu, Ngọc" / "… và 2 bạn". */
  chu(the) {
    if (the.chu_san) return the.chu_san;
    const n = the.ten.length;
    const mon = the.so != null ? ` (số ${the.so})` : '';
    if (n === 1) return `${the.ten[0]} muốn ${this.viec(the)}${mon}`;
    return `${n} người muốn ${this.viec(the)}${mon}: ${the.ten.slice(0, 3).join(', ')}${n > 3 ? ` và ${n - 3} bạn` : ''}`;
  }

  /** Nút chiếu kèm thẻ: ảnh đúng màu; cận vải → video quay thật nếu có, không thì phần chi tiết chất liệu. */
  nut(the) {
    if (the.nut_san) return the.nut_san;
    if (!the.so) return [];
    if (the.loai === 'mau_khac') return [{ chu: `Chiếu ảnh ${the.mau}`, lenh: { mau: 'anh', so: the.so, mau_sac: the.mau } }];
    if (the.loai === 'can_vai' && this.banTheoCan(the)) return [{ chu: 'Chiếu ảnh món', lenh: { mau: 'gioi_thieu', so: the.so } }];
    if (the.loai === 'can_vai') {
      let s = null;
      try { s = sp.layTheoSo(the.so); } catch { s = null; }
      const that = (s?.video || []).some((v) => !v.dung_thu);
      return [that ? { chu: 'Chiếu video quay thật', lenh: { mau: 'video', so: the.so } } : { chu: 'Chiếu chất liệu', lenh: { mau: 'chi_tiet', so: the.so } }];
    }
    return [];
  }

  dang(the) {
    return the ? { id: the.id, loai: the.loai, mau: the.mau, so: the.so, ten: [...the.ten], chu: this.chu(the), nut: this.nut(the), uu_tien: the.loai === 'uu_tien',
      tat_luc: new Date(the.luc_cap_nhat + this.tatMs).toISOString() } : null;
  }

  trangThai() {
    return { phien_id: this.phienId, hien: this.dang(this.hien), hang: this.hang.map((x) => this.dang(x)) };
  }

  bao() {
    this.phat('live.the_nhac', this.trangThai());
  }

  /**
   * Đội AI đọc câu da_nghe_yeu_cau (≤ 1 câu / 2 phút mỗi loại); Mai dẫn chính nói một câu ngắn; khi AI tự chuyển cảnh (Mai dẫn
   * chính, Đội AI) thì tự chiếu ảnh đúng màu / video quay thật. Mai nói (Co-host) và Chỉ gợi ý: chỉ có thẻ.
   */
  noiVaChieu(the, p, bayGio) {
    const aiDan = p.doi_ai || p.mai_dan;
    if (!aiDan) return;
    if (bayGio - (this.cauCuoi.get(the.loai) || 0) >= this.cachCauMs) {
      const ten = the.ten.filter((x) => x !== TEN_AN);
      const bien = { ten: ten.length ? ten.slice(0, 3).join(', ') : 'Có bạn', viec: this.viec(the) };
      let da = false;
      if (p.doi_ai) da = !!this.phongAi?.doiAi?.chenBanHang(p.id, 'da_nghe_yeu_cau', bien);
      else if (this.phongAi?.miengSanSang?.(p)) { this.phongAi.mieng?.baoYeuCau?.(`${bien.ten} muốn ${bien.viec}${the.so != null ? ` món số ${the.so}` : ''}`); da = true; }
      if (da) this.cauCuoi.set(the.loai, bayGio);
    }
    const n = this.nut(the)[0];
    if (n && the.ten.length === 1) {
      try { this.layManHinh?.()?.chieu(n.lenh, { boi: 'ai', lyDo: `Khách muốn ${this.viec(the)}` }); } catch { /* không chiếu được: người dẫn tự làm */ }
    }
  }
}

module.exports = { TheNhac, VIEC };
