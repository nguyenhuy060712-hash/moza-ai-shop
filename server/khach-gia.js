'use strict';

/**
 * Điều khiển Khách giả trong Phòng diễn tập (#87; bản 3.4 #94): nghe luồng chat của Facebook giả; tin cuối là của shop thì sau
 * vài giây khách giả làm lượt tiếp theo theo tính cách của người đó.
 *  - "Soạn sẵn (0 đồng)" — MẶC ĐỊNH: luật {khi, lam} trong server/cau-hinh/khach-gia-soan-san.json (bấm nút, chạm trả lời nhanh,
 *    gửi tên / số / địa chỉ, im lặng, gõ DỪNG…). Tính cách chọn theo mã khách (chạy lại ra cùng kết quả). Không gọi AI.
 *  - "AI (tốn tiền)": khách giả gpt-6-luna như #87 — chỉ khi người chọn.
 * Người ở Tin nhắn chờ (Meta giả xếp) không thấy tin cho tới khi nghe câu nhắc trên sóng có tên mình (F-70) → mở tin sau 20–90 giây.
 * Mỗi người tối đa 12 lượt. Tắt là hủy mọi hẹn giờ ngay. Chỉ dùng Facebook giả — không bao giờ gửi gì ra Facebook thật.
 */

const fs = require('node:fs');
const path = require('node:path');
const { traLoiKhachGia, danhTinh, chonTinhCach, HOI_MUA } = require('./agent/agents/khach-gia');
const { ngauTheo } = require('./facebook/meta-gia');

const TOI_DA_TIN = 12;
const FILE_SOAN_SAN = path.join(__dirname, 'cau-hinh', 'khach-gia-soan-san.json');

function boSoanSan() {
  return JSON.parse(fs.readFileSync(FILE_SOAN_SAN, 'utf8'));
}

/** Tình huống nhận từ tin cuối của shop (tiền tố payload trước, rồi mới xét chữ). */
function tinhHuong(t) {
  const noi = String(t?.noi_dung || '');
  const pl = (t?.nut || []).map((n) => String(n.payload || '').split('|')[0]);
  if (pl.includes('GIU_LEN_DON')) return 'the_giu';
  if (pl.includes('GIU_MOI')) return 'the_moi';
  if (pl.includes('DAT_LAI')) return 'bao_huy';
  if (pl.includes('DUNG_NGUOI')) return 'mme_hoi';
  if (pl.includes('XAC_NHAN_DON') || pl.includes('MAU_XAC_NHAN')) return /đang chờ .*xác nhận/.test(noi) ? 'nhac' : 'the_don';
  if (pl.includes('DOI_PL')) return 'doi_chon';
  if (pl.includes('CHON_PL')) return /vừa hết|chỉ còn/.test(noi) ? 'het_hang' : 'chon_pl';
  if (/tên.*số điện thoại|còn thiếu/i.test(noi)) return 'xin_thong_tin';
  return 'khac';
}

/** Tính cách soạn sẵn theo tỷ trọng, cố định theo mã khách. */
function tinhCachSoanSan(psid, bo = boSoanSan()) {
  const ds = bo.tinh_cach;
  const tong = ds.reduce((s, x) => s + (x.trong || 1), 0);
  let x = ngauTheo(`tinhcach${psid}`) * tong;
  for (const t of ds) { x -= t.trong || 1; if (x < 0) return t; }
  return ds[0];
}

class KhachGia {
  /**
   * @param {object} o
   * @param {object} o.fbGia
   * @param {Function} o.phat
   * @param {import('node:events').EventEmitter} [o.bus]  nghe câu nhắc trên sóng (F-70)
   * @param {object} [o.nhaCungCap]  AI giả (test, chế độ AI)
   * @param {[number, number]} [o.cho]  chờ bao lâu (ms) trước khi trả lời — như người đang gõ; null = theo tệp soạn sẵn
   * @param {'soan_san'|'ai'} [o.cheDo]
   */
  constructor({ fbGia, phat = () => {}, bus = null, nhaCungCap = null, cho = null, cheDo = 'soan_san', moTinChoMs = [20000, 90000] }) {
    Object.assign(this, { fbGia, phat, nhaCungCap, cho, moTinChoMs });
    this.st = { bat: false, che_do: cheDo };
    this.khach = new Map(); // khóa page|psid → { tinhCach, nguoi, so_tin, xong, hen, dang, lan: {tình huống: số lần} }
    this.dieuKhien = null;
    fbGia.on('chat', ({ page_id: pageId, psid }) => this.khiCoTin(pageId, psid));
    // F-70: câu nhắc "xem giúp shop mục Tin nhắn chờ" có tên → người đó mở Tin nhắn chờ.
    bus?.on('su_kien', (type, d) => { if (type === 'live.nhac_mo_tin') this.ngheNhac(d.ten || []); });
  }

  trangThai() {
    return {
      bat: this.st.bat, che_do: this.st.che_do,
      khach: [...this.khach.entries()].map(([k, x]) => ({
        page_id: k.split('|')[0], psid: k.split('|')[1], ten: x.nguoi.ten_day_du, tinh_cach: x.tinhCach.ten, so_tin: x.so_tin, xong: x.xong,
      })),
    };
  }

  baoThayDoi() { this.phat('dien_tap.khach_gia', this.trangThai()); }

  bat() {
    if (!this.st.bat) {
      this.st.bat = true;
      this.dieuKhien = new AbortController();
      this.baoThayDoi();
    }
    return this.trangThai();
  }

  tat() {
    this.st.bat = false;
    this.dieuKhien?.abort();
    this.dieuKhien = null;
    for (const x of this.khach.values()) clearTimeout(x.hen);
    this.baoThayDoi();
    return this.trangThai();
  }

  /** "Soạn sẵn (0 đồng)" hay "AI (tốn tiền)". */
  datCheDo(cheDo) {
    this.st.che_do = cheDo === 'ai' ? 'ai' : 'soan_san';
    this.xoa();
    return this.trangThai();
  }

  /** Quên các khách của buổi trước (buổi tập mới). */
  xoa() {
    for (const x of this.khach.values()) clearTimeout(x.hen);
    this.khach.clear();
    this.baoThayDoi();
  }

  /** Người này là khách tự nhắn Page hỏi mua (Luồng 4): gán tính cách "hỏi mua" (chế độ AI). */
  laKhachHoiMua(pageId, psid) {
    const x = this.layKhach(pageId, psid);
    if (this.st.che_do === 'ai') x.tinhCach = HOI_MUA;
  }

  layKhach(pageId, psid) {
    const k = `${pageId}|${psid}`;
    if (!this.khach.has(k)) {
      const ten = this.fbGia.tenNguoi?.get(psid) || 'Khách';
      const tinhCach = this.st.che_do === 'ai' ? chonTinhCach() : tinhCachSoanSan(psid);
      this.khach.set(k, { tinhCach, nguoi: danhTinh(ten, psid), so_tin: 0, xong: false, hen: null, dang: false, lan: {} });
    }
    return this.khach.get(k);
  }

  /** Người ở Tin nhắn chờ (Meta giả) thì chưa thấy tin. */
  oTinCho(pageId, psid) {
    return this.fbGia.meta?.tinhTrang(pageId, psid)?.hop === 'cho';
  }

  ngheNhac(dsTen) {
    if (!this.st.bat || !dsTen.length) return;
    const goi = new Set(dsTen.map((t) => String(t).trim().toLowerCase()));
    for (const [k, x] of this.khach) {
      const [pageId, psid] = k.split('|');
      const tenGoi = String(x.nguoi.ten_day_du).trim().split(/\s+/).at(-1).toLowerCase();
      if (!goi.has(tenGoi) || !this.oTinCho(pageId, psid)) continue;
      const [a, b] = this.moTinChoMs;
      setTimeout(() => { if (this.st.bat) this.fbGia.khachMoTinCho({ page_id: pageId, psid }); }, a + ngauTheo(`mo${psid}`) * (b - a)).unref?.();
    }
  }

  khiCoTin(pageId, psid) {
    if (!this.st.bat) return;
    const tin = this.fbGia.luongChat(pageId, psid);
    if (!tin.length || tin.at(-1).tu !== 'page') return;
    const x = this.layKhach(pageId, psid);
    if (x.xong || x.tinhCach.id === 'im_lang' || x.so_tin >= TOI_DA_TIN) return;
    // Soạn sẵn: người ở Tin nhắn chờ chưa thấy tin — chờ câu nhắc trên sóng (moTinCho phát lại sự kiện chat).
    if (this.st.che_do === 'soan_san' && this.oTinCho(pageId, psid)) return;
    clearTimeout(x.hen);
    const [a, b] = this.cho || (this.st.che_do === 'soan_san' ? this.choSoanSan(x, tin.at(-1)) : [4000, 9000]);
    // Shop nhắn liền nhiều tin thì đợi tin cuối rồi mới trả lời một lần.
    x.hen = setTimeout(() => this.traLoi(pageId, psid).catch((e) => console.error(`  [khách giả] ${e.message}`)), a + Math.random() * (b - a));
  }

  choSoanSan(x, tinCuoi) {
    const bo = boSoanSan();
    const luat = this.chonLuat(x, tinhHuong(tinCuoi), false);
    const [a, b] = luat?.cho || bo.cho_mac_dinh || [3, 8];
    return [a * 1000, b * 1000];
  }

  /** Luật đầu tiên khớp tình huống và lần thứ mấy (không đánh dấu nếu chỉ xem). */
  chonLuat(x, th, danhDau = true) {
    const lan = (x.lan[th] || 0) + 1;
    const luat = (x.tinhCach.luat || []).find((l) => l.khi === th && (!l.lan || l.lan === lan));
    if (danhDau && luat) x.lan[th] = lan;
    return luat || null;
  }

  async traLoi(pageId, psid) {
    const x = this.layKhach(pageId, psid);
    if (!this.st.bat || x.dang) return;
    x.dang = true;
    try {
      if (this.st.che_do === 'soan_san') this.traLoiSoanSan(pageId, psid, x);
      else await this.traLoiAi(pageId, psid, x);
      this.baoThayDoi();
    } finally {
      x.dang = false;
    }
  }

  /** Một lượt khách soạn sẵn (0 đồng): làm theo luật của tình huống. */
  traLoiSoanSan(pageId, psid, x) {
    const cuoi = this.fbGia.luongChat(pageId, psid).filter((t) => t.tu === 'page').at(-1);
    const th = tinhHuong(cuoi);
    const luat = this.chonLuat(x, th);
    if (!luat || luat.lam?.im) return;
    const l = luat.lam;
    const nut = cuoi?.nut || [];
    let n = null;
    if (l.bam) n = nut.find((y) => String(y.payload).split('|')[0] === l.bam);
    else if (Number.isInteger(l.cham)) n = nut[l.cham] || nut[0];
    if (n) {
      x.so_tin += 1;
      this.fbGia.khachBam({ page_id: pageId, psid, payload: n.payload, tieu_de: n.tieu_de });
      return;
    }
    if (l.nhan) {
      const chu = String(l.nhan).replace('{ten}', x.nguoi.ten_day_du).replace('{sdt}', x.nguoi.sdt).replace('{dia_chi}', x.nguoi.dia_chi);
      x.so_tin += 1;
      this.fbGia.khachNhan({ page_id: pageId, psid, ten: this.fbGia.tenNguoi?.get(psid) || x.nguoi.ten_day_du, noi_dung: chu });
    }
  }

  /** Chế độ AI (#87): gpt-6-luna đóng vai theo tính cách. */
  async traLoiAi(pageId, psid, x) {
    const kq = await traLoiKhachGia({
      tin: this.fbGia.luongChat(pageId, psid), tinhCach: x.tinhCach, nguoi: x.nguoi,
      nhaCungCap: this.nhaCungCap, tinHieu: this.dieuKhien?.signal,
    });
    if (!this.st.bat || !kq) return;
    if (kq.ket_thuc) x.xong = true;
    // Bấm nút trên thẻ mới nhất của shop (#89, F-68).
    const the = [...this.fbGia.luongChat(pageId, psid)].reverse().find((t) => t.tu === 'page' && t.nut?.length);
    const tenNut = String(kq.bam_nut || '').trim();
    const nut = tenNut && the ? the.nut.find((n) => n.tieu_de === tenNut || tenNut.includes(n.tieu_de.replace(/^\S+\s/, ''))) : null;
    if (nut) {
      x.so_tin += 1;
      this.fbGia.khachBam({ page_id: pageId, psid, payload: nut.payload, tieu_de: nut.tieu_de });
      return;
    }
    const chu = String(kq.tra_loi || '').trim().slice(0, 1000);
    if (chu) {
      x.so_tin += 1;
      this.fbGia.khachNhan({ page_id: pageId, psid, ten: this.fbGia.tenNguoi?.get(psid) || x.nguoi.ten_day_du, noi_dung: chu });
    }
  }
}

module.exports = { KhachGia, tinhHuong, tinhCachSoanSan };
