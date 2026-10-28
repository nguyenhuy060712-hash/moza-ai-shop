'use strict';

/**
 * Hộp thư tự động (SPEC.md mục 5 "Bus sự kiện — hàng Hộp thư", F-24 → F-33, Luồng 3).
 *  - Nhận sự kiện từ Facebook thật (webhook + lưới an toàn, `dien_tap = 0`) và Facebook giả (Phòng diễn tập, `dien_tap = 1`).
 *  - Cửa `khi_tin_den`: đóng khung, phân loại (spam → không gọi AI; đòi gặp người → Cần người), ẩn bình luận lộ số.
 *  - Gom tin liên tiếp của một người 6 giây rồi xử lý một lần (F-31). Hàng đợi riêng, tối đa 6 hội thoại cùng lúc —
 *    đường live không bao giờ phải chờ đường Hộp thư (mục 5 nguyên tắc 4).
 *  - Mỗi 30 giây: tin "không rõ" (mục 9), việc MOZA tự làm tới giờ (nhắc lịch, hỏi thăm — F-32), bình luận live
 *    "Chờ Tư vấn viên" (F-17), hội thoại bị kẹt. Mỗi ngày: tự xóa dữ liệu quá 12 tháng không liên lạc (#35).
 */

const hopThu = require('./nghiep-vu/hop-thu');
const kh = require('./nghiep-vu/khach');
const don = require('./nghiep-vu/don');
const theDon = require('./nghiep-vu/the-don');
const guiThe = require('./gui-the-don');
const live = require('./nghiep-vu/live');
const caiDat = require('./nghiep-vu/cai-dat');
const khoa = require('./khoa');
const { chayCua } = require('./agent/hook/cua');
const { thucHienCongCu } = require('./agent/thuc-hien');
const tuVan = require('./agent/agents/tu-van');
const { xuLyNut } = require('./xu-ly-nut');

const GOM_MS = 6000;
const SONG_SONG = 6;
const CHU_KY_MS = 30000;
const NGAY_MS = 86400000;

class HopThuTuDong {
  /**
   * @param {object} o
   * @param {import('./facebook/ket-noi').KetNoiFacebook} [o.ketNoiFb]
   * @param {import('./facebook/gia').FacebookGia} [o.fbGia]
   * @param {Function} o.layKetNoi
   * @param {Function} [o.phat]
   * @param {object} [o.nhaCungCap]  thay nhà cung cấp AI (test)
   */
  constructor({ ketNoiFb = null, fbGia = null, layKetNoi, phat = () => {}, nhaCungCap, gomMs = GOM_MS, songSong = SONG_SONG, chuKyMs = CHU_KY_MS } = {}) {
    this.ketNoiFb = ketNoiFb;
    this.fbGia = fbGia;
    this.layKetNoi = layKetNoi;
    this.phat = phat;
    this.nhaCungCap = nhaCungCap;
    this.gomMs = gomMs;
    this.songSong = songSong;
    this.chuKyMs = chuKyMs;
    this.henGom = new Map(); // hội thoại → hẹn giờ gom 6 giây
    this.cho = []; // hàng chờ
    this.dangChay = new Set();
    this.chayLai = new Set(); // có tin mới trong lúc đang xử lý → xử lý thêm một lượt
    this.hen = null;
    this.xoaCuoi = 0;
    this.dangNhan = 0; // sự kiện đang qua cửa khi_tin_den
    const nghe = (dienTap) => (ev) => {
      this.dangNhan += 1;
      this.nhan(ev, dienTap).catch((e) => console.error('  [hộp thư] ' + e.message)).finally(() => { this.dangNhan -= 1; });
    };
    this.ngheThat = nghe(false);
    this.ngheGia = nghe(true);
  }

  batDau() {
    require('./nghiep-vu/cho-hang').datKhiCoMoi(() => this.guiMoiChoHang()); // F-92
    this.ketNoiFb?.on('su_kien', this.ngheThat);
    this.fbGia?.on('su_kien', this.ngheGia);
    this.hen = setInterval(() => this.nhip().catch((e) => console.error('  [hộp thư] ' + e.message)), this.chuKyMs);
    setTimeout(() => this.nhip().catch(() => {}), 2000).unref?.();
  }

  dung() {
    require('./nghiep-vu/cho-hang').datKhiCoMoi(null);
    this.ketNoiFb?.off('su_kien', this.ngheThat);
    this.fbGia?.off('su_kien', this.ngheGia);
    clearInterval(this.hen);
    for (const t of this.henGom.values()) clearTimeout(t);
    this.henGom.clear();
    this.cho = [];
  }

  /* ---------------- tin đến ---------------- */

  async nhan(ev, dienTap, { tuXemLai = false } = {}) {
    if (ev.loai === 'live_doi') return null;
    if (ev.loai === 'binh_luan_bai' && !tuXemLai && hopThu.laBaiLive(ev.post_id)) {
      // Bài của một buổi live: đang live → phòng live đã nhận; đã xong ≤ 7 ngày → bộ nhận xem lại (F-94); cũ hơn → bỏ.
      const xl = this.xemLai;
      const p = xl?.phienCuaBai(ev.post_id);
      if (p && p.trang_thai === 'xong') {
        await xl.nhan(p, { id: ev.comment_id, nguoi_id: ev.nguoi_id, ten: ev.ten, noi_dung: ev.noi_dung, luc: ev.luc || new Date().toISOString() }).catch((e) => console.error(`  [hộp thư] xem lại lỗi: ${e.message}`));
      }
      return null;
    }
    const kq = hopThu.nhanSuKien(ev, { appIdMoza: khoa.layFb('app_id'), dienTap });
    if (kq.trung || kq.boQua) return kq;
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: kq.hoiThoai.id });
    if (!kq.moi) return kq;
    const h = kq.hoiThoai;
    // #98: khách nhắn / bấm nút → đơn chốt trên live của người này chuyển sang giữ dài (đủ "Giờ giữ hàng" tính từ lúc này).
    if (h.kenh === 'messenger') { try { if (don.khachTuongTac(h.nguoi_fb_id).length) this.phat('don.cap_nhat', {}); } catch { /* không có đơn */ } }

    // F-70: vào từ link m.me?ref=phien_<id> (người cũ: sự kiện giới thiệu; người mới: nút Bắt đầu kèm ref) → hỏi lại bằng nút.
    if (h.kenh === 'messenger' && (ev.loai === 'gioi_thieu' || ev.ref)) {
      let xong = false;
      try { xong = await this.moTuLink(h, ev, kq, dienTap); } catch (e) { console.error(`  [hộp thư] link m.me lỗi: ${e.message}`); }
      // Mở link mà không gõ gì, không khớp ai: không cần AI trả lời (chờ khách nhắn).
      if (xong || ev.loai === 'gioi_thieu') return kq;
    }

    // Khách bấm nút / chạm trả lời nhanh (F-65): xử lý bằng mã ở một nơi (xu-ly-nut.js), không gọi AI (trừ "Sửa đơn").
    // F-88: khách chọn số Messenger tự điền (trả lời nhanh user_phone_number — payload là số điện thoại).
    if (ev.loai === 'postback' && ev.nguon_nut === 'tra_loi_nhanh' && /^\+?\d[\d\s.]{8,14}$/.test(String(ev.payload || ''))) {
      const { xuLySdtNhanh } = require('./xu-ly-nut');
      try { if (await xuLySdtNhanh({ h, so: ev.payload, ht: this, tinId: kq.tinNhanId })) return kq; } catch (e) { console.error(`  [hộp thư] số điện thoại nhanh lỗi: ${e.message}`); }
    }
    if (ev.loai === 'postback' && ev.payload) {
      let daXuLy = false;
      try {
        daXuLy = await xuLyNut({ h, payload: ev.payload, tinId: kq.tinNhanId, ht: this, ev });
      } catch (e) {
        console.error(`  [hộp thư] nút bấm lỗi: ${e.message}`);
        daXuLy = true;
      }
      if (daXuLy) return kq;
    }

    // Cửa khi_tin_den (A.3): đóng khung, phân loại, ẩn bình luận lộ số.
    const tin = hopThu.layTin(kq.tinNhanId);
    const ctx = { tinDen: { id: tin.id, noi_dung: tin.noi_dung, cong_khai: h.kenh !== 'messenger' }, layKetNoi: this.layKetNoi, nhan: [] };
    await chayCua('khi_tin_den', ctx);
    if (ctx.nhan.length) hopThu.ganNhan(h.id, { nhan: ctx.nhan.filter((n) => n !== 'thong_tin_ca_nhan') });
    if (ctx.nhan.includes('spam')) {
      hopThu.datTrangThai(h.id, 'spam'); // F-31: spam chỉ gắn nhãn, không gọi AI
      this.phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
      return kq;
    }
    if (ctx.nhan.includes('gia_shop') && h.kenh !== 'messenger') {
      await this.canNguoi(h.id, 'Bình luận có số tài khoản hoặc link lạ — có thể là kẻ gian giả shop. MOZA đã ẩn, không trả lời; xem và chặn người này nếu cần.');
      return kq;
    }
    if (ctx.nhan.includes('xoa_so_do') && h.kenh === 'messenger') {
      // F-91: xóa ngay số đo đã lưu, báo lại bằng câu mẫu.
      const kh = require('./nghiep-vu/khach');
      const co = kh.xoaSoDo(h.khach_id);
      if (h.khach_id) kh.ghiHoiSoDo(h.khach_id); // không hỏi lưu lại nữa
      await guiThe.guiTinHeThong({ h, noiDung: require('./nghiep-vu/cau-mau-khach').cau(co ? 'da_xoa_so_do' : 'chua_luu_so_do'), khoa: `xoa_so_do:${kq.tinNhanId}`, layKetNoi: this.layKetNoi }).catch(() => {});
      return kq;
    }
    if (ctx.nhan.includes('go_anh') && h.kenh === 'messenger') {
      // F-104: gỡ ngay mọi ảnh của người này khỏi màn hình, xóa tệp, báo lại bằng câu mẫu (chạy cả khi công tắc đã tắt).
      const n = require('./nghiep-vu/anh-khach').goCuaNguoi(h.nguoi_fb_id);
      await guiThe.guiTinHeThong({ h, noiDung: require('./nghiep-vu/cau-mau-khach').cau(n ? 'da_go_anh' : 'chua_co_anh_go'), khoa: `go_anh:${kq.tinNhanId}`, layKetNoi: this.layKetNoi }).catch(() => {});
      this.phat('anh_khach.cap_nhat', {});
      return kq;
    }
    if (ctx.nhan.includes('yeu_cau_xoa')) {
      // F-88: việc "Xóa dữ liệu" hạn 72 giờ + Cần người, báo khách đã nhận (bằng mã).
      await require('./xu-ly-nut').taoViecXoaDuLieu({ h, ht: this });
      if (h.kenh === 'messenger') await guiThe.guiTinHeThong({ h, noiDung: require('./nghiep-vu/cau-mau-khach').cau('menu_xoa_da_nhan'), khoa: `xoa:${kq.tinNhanId}`, layKetNoi: this.layKetNoi }).catch(() => {});
      return kq;
    }
    // F-97: khách hỏi lịch live trong Messenger → trả lời lịch bằng câu mẫu (0 AI), mời nhận 1 tin khi lên sóng.
    if (ctx.nhan.includes('hoi_lich_live') && h.kenh === 'messenger' && ev.loai === 'tin_nhan') {
      await this.traLoiLich(h, kq.tinNhanId);
      return kq;
    }
    // F-97: bình luận "hóng" dưới bài đăng thường (bài live đã rẽ đi phòng live / xem lại) → nhắn riêng thẻ mời, không gọi AI.
    if (ctx.nhan.includes('hong_live') && h.kenh !== 'messenger' && ev.loai === 'binh_luan_bai') {
      if (await this.moiBaoLive({ h, cauGoc: tin.noi_dung, binhLuanFbId: ev.comment_id }).catch(() => false)) return kq;
    }
    if (ctx.nhan.includes('an_ten')) require('./nghiep-vu/lien-he').datAnTen(h.nguoi_fb_id);
    // F-66 (#96): khách xin thôi nhận tin → ngừng mọi tin chủ động, trả một câu xác nhận bằng mã (không gọi AI). Khách tự nhắn
    // lại sau đó thì vẫn được trả lời như thường. Đơn còn chờ xác nhận → việc gọi cho người (không nhắn nhắc nữa).
    if (ctx.nhan.includes('xin_dung') && h.kenh === 'messenger') {
      await this.xinDung(h, kq.tinNhanId);
      return kq;
    }
    if (ctx.nhan.includes('gap_nguoi')) {
      await this.canNguoi(h.id, 'Người nhắn muốn gặp người thật.');
      return kq;
    }
    // Chưa biết tên (webhook Messenger không mang tên — cả bản giả từ 3.4, L1): hỏi Facebook một lần.
    if (h.kenh === 'messenger' && !kq.nguoi?.ten_hien_thi) await this.layTen(h, kq.nguoi, dienTap).catch(() => {});
    // F-104: ảnh khách tự gửi sau khi nhận hàng → xin phép bằng nút (0 AI); tin chỉ có ảnh thì không gọi AI.
    if (ev.loai === 'tin_nhan' && h.kenh === 'messenger' && tin.anh_url && await this.xinAnhKhach(h, tin).catch(() => false) && !String(tin.noi_dung || '').replace('[hình ảnh]', '').trim()) return kq;
    // F-68 (bản 3.4): khách gửi đủ tên, số, địa chỉ cho đơn đang chờ → MOZA điền bằng mã và gửi thẻ đơn (0 lượt AI).
    if (ev.loai === 'tin_nhan' && h.kenh === 'messenger' && await this.tuDienThongTin(h, tin).catch(() => false)) return kq;
    this.henXuLy(h.id);
    return kq;
  }

  /**
   * Thông tin giao đọc bằng mã (doc-thong-tin.js): chỉ khi CHẮC đủ tên + số + địa chỉ và người này có đơn chờ còn thiếu thông tin.
   * @returns {Promise<boolean>} đã xử lý (không cần Tư vấn viên)
   */
  async tuDienThongTin(h, tin) {
    const d = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
    if (!d || d.trang_thai !== 'cho_xac_nhan' || !don.viecConThieu(d).length) return false;
    const tt = require('./nghiep-vu/doc-thong-tin').docThongTinGiao(tin.noi_dung);
    if (!tt.chac) return false;
    const d2 = require('./nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d, ten: tt.ten, sdt: tt.sdt, diaChi: tt.dia_chi });
    don.ganHoiThoai(d2.id, h.id);
    if (!don.viecConThieu(d2).length) await guiThe.guiTheDon({ d: don.layDon(d2.id), layKetNoi: this.layKetNoi });
    hopThu.datTrangThai(h.id, 'cho_phan_hoi');
    this.phat('don.cap_nhat', { don_id: d2.id });
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
    return true;
  }

  /**
   * F-104 (tắt mặc định): khách gửi ảnh trong 30 ngày sau khi đơn được gửi → ghi ảnh, gửi MỘT thẻ xin phép cho mọi ảnh trong 2 phút.
   * Không tải ảnh trước khi khách đồng ý. @returns {Promise<boolean>} ảnh đã vào luồng xin phép
   */
  async xinAnhKhach(h, tin) {
    if (!require('./nghiep-vu/cai-dat').banHang().dung_anh_khach) return false;
    if (require('./nghiep-vu/lien-he').daNgung?.(h.nguoi_fb_id)) return false;
    const cm = require('./nghiep-vu/cau-mau-khach');
    const cau = cm.cau('xin_anh_khach');
    const a = require('./nghiep-vu/anh-khach').ghiAnh({ h, tin, cauXinPhep: cau });
    if (!a) return false;
    if (a.can_hoi) {
      const nutBam = require('./nghiep-vu/nut-bam');
      await guiThe.guiTinHeThong({ h, the: { kieu: 'nut', chu: cau, nut: [
        { tieu_de: cm.cau('nut_anh_dong_y'), payload: nutBam.taoPayload('ANH_DONG_Y', { lan: a.lan_hoi }) },
        { tieu_de: cm.cau('nut_anh_khong'), payload: nutBam.taoPayload('ANH_KHONG', { lan: a.lan_hoi }) },
      ] }, khoa: `xin_anh:${a.lan_hoi}`, layKetNoi: this.layKetNoi });
    }
    return true;
  }

  /** Khách xin thôi nhận tin (F-66): ghi ngừng liên hệ, trả câu xác nhận, đơn còn chờ thì tạo việc gọi. */
  async xinDung(h, tinId) {
    const lienHe = require('./nghiep-vu/lien-he');
    lienHe.datNgung(h.nguoi_fb_id);
    require('./nghiep-vu/dong-y').rutCuaNguoi(h.nguoi_fb_id); // F-97: rút mọi đồng ý báo live
    await guiThe.guiTinHeThong({ h, noiDung: require('./nghiep-vu/cau-mau-khach').cau('ngung_lien_he'), khoa: `ngung:${tinId}`, layKetNoi: this.layKetNoi });
    const d = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
    if (d?.trang_thai === 'cho_xac_nhan') {
      kh.taoViec({ loai: 'goi_xac_nhan_don', noiDung: `Khách xin thôi nhận tin nhưng đơn ${d.ma} còn chờ xác nhận${d.sdt_nhan ? ` — gọi ${don.cheSo(d.sdt_nhan)}` : ''}: hỏi khách còn lấy không.`,
        khachId: d.khach_id, hoiThoaiId: h.id, donId: d.id, taoBoi: 'ai', dienTap: d.dien_tap });
    }
    hopThu.datTrangThai(h.id, 'xong');
    this.phat('don.cap_nhat', { don_id: d?.id || null });
  }

  /**
   * Khách vào bằng link m.me của một buổi (F-70). Người này đã có đơn trong buổi → gửi lại thẻ. Chưa → tìm người chốt cùng tên
   * trong buổi (chưa gắn Messenger) và hỏi [Đúng, là mình] [Không phải] — không tự gắn (trùng tên thì nhầm người).
   * @returns {Promise<boolean>} đã trả lời bằng mã
   */
  async moTuLink(h, ev, kq, dienTap) {
    const m = /^phien_([\w-]+)$/.exec(String(ev.ref || ''));
    if (!m) return false;
    let p;
    try { p = live.layPhien(m[1]); } catch { return false; }
    hopThu.ghiChu(h.id, `Khách vào từ link m.me của buổi live "${p.tieu_de || p.id}".`);
    const cm = require('./nghiep-vu/cau-mau-khach');
    const nutBam = require('./nghiep-vu/nut-bam');
    const dCu = don.donMoTrongPhien(h.nguoi_fb_id, p.id);
    if (dCu) {
      if (don.viecConThieu(dCu).length) await guiThe.guiTinHeThong({ h, noiDung: cm.cau('ib_co_don'), khoa: `mme:${ev.mid}`, layKetNoi: this.layKetNoi });
      else await guiThe.guiTheDon({ d: dCu, layKetNoi: this.layKetNoi });
      return true;
    }
    if (!kq.nguoi?.ten_hien_thi && kq.nguoi) await this.layTen(h, kq.nguoi, dienTap).catch(() => {});
    const ten = hopThu.layNguoi(h.nguoi_fb_id)?.ten_hien_thi || '';
    const ung = don.donChotTheoTen(p.id, ten)[0];
    if (!ung) return false;
    const x = ung.dong.at(-1);
    const nut = [
      { tieu_de: cm.cau('mme_dung'), payload: nutBam.taoPayload('DUNG_NGUOI', { phien: p.id, don: ung.id }) },
      { tieu_de: cm.cau('mme_khong'), payload: nutBam.taoPayload('KHONG_PHAI', { phien: p.id }) },
    ];
    const chu = cm.cau('mme_hoi', { ten, mon: `${x.ten_chup}${ung.dong.length > 1 ? ` và ${ung.dong.length - 1} món nữa` : ''}` });
    await guiThe.guiTinHeThong({ h, noiDung: null, the: { kieu: 'nut', chu, nut }, khoa: `mme:${ev.mid}`, layKetNoi: this.layKetNoi });
    return true;
  }

  async layTen(h, nguoi, dienTap = false) {
    const ten = await this.layKetNoi({ dien_tap: dienTap }).layTenNguoi({ page_id: h.page_id, psid: nguoi.psid });
    if (ten) hopThu.datTenNguoi(nguoi.id, ten);
  }

  /** Gom tin liên tiếp của một người: 6 giây không có tin mới thì mới xử lý (F-31). */
  henXuLy(hoiThoaiId, ms = this.gomMs) {
    clearTimeout(this.henGom.get(hoiThoaiId));
    this.henGom.set(hoiThoaiId, setTimeout(() => {
      this.henGom.delete(hoiThoaiId);
      this.xepHang(hoiThoaiId);
    }, ms));
  }

  xepHang(hoiThoaiId) {
    if (this.dangChay.has(hoiThoaiId)) { this.chayLai.add(hoiThoaiId); return; }
    if (!this.cho.includes(hoiThoaiId)) this.cho.push(hoiThoaiId);
    this.chayTiep();
  }

  chayTiep() {
    while (this.dangChay.size < this.songSong && this.cho.length) {
      const id = this.cho.shift();
      this.dangChay.add(id);
      this.xuLy(id)
        .catch((e) => console.error('  [hộp thư] xử lý lỗi: ' + e.message))
        .finally(() => {
          this.dangChay.delete(id);
          if (this.chayLai.delete(id)) this.xepHang(id);
          this.chayTiep();
        });
    }
  }

  /**
   * F-91 (#114): công tắc "Hỏi khách lưu chiều cao, cân nặng" (TẮT mặc định) bật, khách có hồ sơ đã nói đủ chiều cao + cân nặng
   * trong Messenger, chưa từng được hỏi → SAU lượt trả lời của Tư vấn viên, MOZA gửi MỘT tin mã soạn [Lưu giúp mình] [Không cần].
   * Chỉ lưu khi khách bấm Lưu.
   */
  async hoiLuuSoDo(h) {
    const caiDat = require('./nghiep-vu/cai-dat');
    const kh = require('./nghiep-vu/khach');
    if (!caiDat.banHang().hoi_so_do || h.kenh !== 'messenger' || !h.khach_id || h.trang_thai === 'can_nguoi') return false;
    if (kh.daHoiSoDo(h.khach_id) || kh.soDo(h.khach_id)) return false;
    const { docSoDo } = require('./nghiep-vu/so-do');
    let cao = null;
    let nang = null;
    for (const t of hopThu.tinCuaHoiThoai(h.id, { gioiHan: 20 }).filter((x) => x.gui_boi === 'khach')) {
      const x = docSoDo(t.noi_dung);
      if (x?.chieu_cao) cao = x.chieu_cao;
      if (x?.can_nang) nang = x.can_nang;
    }
    if (!cao || !nang) return false;
    const nutBam = require('./nghiep-vu/nut-bam');
    const cm = require('./nghiep-vu/cau-mau-khach');
    const kq = await guiThe.guiTinHeThong({ h, the: { kieu: 'nut', chu: cm.cau('hoi_luu_so_do', { cao, nang }), nut: [
      { tieu_de: cm.cau('nut_luu_so_do'), payload: nutBam.taoPayload('LUU_SO_DO', { khach: h.khach_id, cao, nang }) },
      { tieu_de: cm.cau('nut_khong_luu_so_do'), payload: nutBam.taoPayload('KHONG_LUU_SO_DO', { khach: h.khach_id }) },
    ] }, khoa: `hoi_so_do:${h.khach_id}`, layKetNoi: this.layKetNoi });
    if (kq.da_gui) kh.ghiHoiSoDo(h.khach_id); // hỏi đúng 1 lần (chưa gửi được thì lượt sau hỏi lại)
    return !!kq.da_gui;
  }

  /**
   * F-92: gửi thẻ mời cho người chờ vừa được nhường suất (đơn đã giữ 30 phút trong giao dịch trả hàng). Không nhắn được (quá 24 giờ)
   * → hủy đơn đó, suất sang người kế tiếp. Chưa gửi được vì lý do tạm (ngoài giờ, mạng) → thử lại nhịp sau.
   */
  async guiMoiChoHang() {
    const choHang = require('./nghiep-vu/cho-hang');
    const theGiu = require('./nghiep-vu/the-giu-hang');
    const cm = require('./nghiep-vu/cau-mau-khach');
    const nutBam = require('./nghiep-vu/nut-bam');
    this.dangMoi = (this.dangMoi || 0) + 1;
    try {
      for (let vong = 0; vong < 5; vong++) {
        const ds = choHang.canGuiMoi();
        if (!ds.length) break;
        for (const c of ds) {
          let d;
          try { d = don.layDon(c.don_id); } catch { choHang.daGuiMoi(c.id); continue; }
          if (d.trang_thai !== 'cho_xac_nhan') { choHang.daGuiMoi(c.id); continue; }
          const h = guiThe.hoiThoaiMessenger(d);
          if (!h) { don.doiTrangThai(d.id, 'da_huy', { nguon: 'he_thong', ghiChu: 'không nhắn được người chờ (quá 24 giờ)' }); continue; }
          const x = d.dong[0];
          const s = require('./nghiep-vu/san-pham').laySanPham(x.san_pham_id);
          const pl = require('./nghiep-vu/kho').phanLoai(x.phan_loai_id);
          const the = { kieu: 'nut', chu: cm.cau('moi_co_suat', { mon: theGiu.tenMonNgan(s, pl), gio: theGiu.gioChu(d.giu_den) }), nut: [
            { tieu_de: cm.cau('nut_giu'), payload: nutBam.taoPayload('GIU_LEN_DON', { don: d.id }) },
            { tieu_de: cm.cau('nut_khong_lay'), payload: nutBam.taoPayload('KHONG_LAY', { don: d.id, pl: pl.id }) },
          ] };
          const kq = await guiThe.guiTinHeThong({ h, the, khoa: `moi_cho:${c.id}`, layKetNoi: this.layKetNoi, donId: d.id });
          if (kq.da_gui || kq.trung) choHang.daGuiMoi(c.id);
          this.phat('don.cap_nhat', { don_id: d.id });
        }
        if (choHang.canGuiMoi().every((c) => ds.some((y) => y.id === c.id))) break; // chỉ còn lời mời chưa gửi được: chờ nhịp sau
      }
    } finally {
      this.dangMoi -= 1;
    }
  }

  /* ---------------- hỏi lại trước khi gửi (F-99), hỏi thăm sau gửi (F-100) ---------------- */

  /**
   * F-99: đơn "Nên hỏi lại" đã xác nhận ≥ 2 giờ → trong 8h–21h gửi "Shop chuẩn bị gửi đơn …, nhận trong tuần này được không?"
   * [Gửi đi] [Hẹn ngày khác] (24 giờ: thẻ; ngoài: mẫu Utility; không gửi được: việc gọi). Im lặng 24 giờ → việc gọi xác nhận.
   * Không tự hủy, không từ chối COD, không khóa in phiếu.
   */
  async hoiLaiDon(bayGio = Date.now()) {
    const gioVn = require('./nghiep-vu/lien-he').gioVN(new Date(bayGio));
    for (const d of don.donHoiLaiQuaHan(bayGio)) {
      don.ghiHoiLai(d.id, 'khong_tra_loi');
      kh.taoViec({ loai: 'goi_xac_nhan_don', noiDung: `Gọi xác nhận đơn ${d.ma}: khách chưa trả lời tin hỏi lại trước khi gửi${d.sdt_nhan ? ` — ${don.cheSo(d.sdt_nhan)}` : ''}.`,
        khachId: d.khach_id, hoiThoaiId: d.hoi_thoai_id, donId: d.id, taoBoi: 'ai', dienTap: d.dien_tap });
    }
    if (gioVn < 8 || gioVn >= 21) return;
    for (const d of don.donCanHoiLai(bayGio)) await this.guiHoiLai(d).catch((e) => console.error(`  [hộp thư] hỏi lại ${d.ma} lỗi: ${e.message}`));
  }

  async guiHoiLai(d) {
    const cm = require('./nghiep-vu/cau-mau-khach');
    const nutBam = require('./nghiep-vu/nut-bam');
    const { hienTien } = require('./nghiep-vu/chung');
    const chu = cm.cau('hoi_lai_gui', { ma: d.ma, tong: hienTien(d.tong_tien) });
    const the = { kieu: 'nut', chu, nut: [
      { tieu_de: cm.cau('nut_gui_di'), payload: nutBam.taoPayload('GUI_DI', { don: d.id }) },
      { tieu_de: cm.cau('nut_hen_ngay'), payload: nutBam.taoPayload('HEN_NGAY', { don: d.id }) },
    ] };
    const kq = await guiThe.guiTrangThai({ d, loai: 'chuan_bi_gui', the, layKetNoi: this.layKetNoi, mucDich: 'cham_soc' });
    if (!kq.da_gui && !kq.viec) {
      // Tạm thời (giới hạn 1 tin chăm sóc / ngày, ngoài giờ): để lượt sau. Không có cách nhắn: việc gọi.
      if (['GIOI_HAN_LIEN_HE', 'NGOAI_GIO'].includes(kq.ma)) return kq;
      kh.taoViec({ loai: 'goi_xac_nhan_don', noiDung: `Gọi xác nhận đơn ${d.ma} trước khi gửi (${don.mucHoiLai(d).ly_do}) — không nhắn được: ${kq.ly_do || 'ngoài 24 giờ, chưa có mẫu tin'}.`,
        khachId: d.khach_id, hoiThoaiId: d.hoi_thoai_id, donId: d.id, taoBoi: 'ai', dienTap: d.dien_tap });
    }
    don.ghiHoiLai(d.id, 'da_hoi');
    this.phat('don.cap_nhat', { don_id: d.id });
    return kq;
  }

  /** F-100: 10h–20h, đơn đã gửi đủ N ngày → "{ban} nhận đơn … rồi, mặc thấy sao?" [Vừa lắm] [Hơi chật] [Hơi rộng]. 0 AI. */
  async hoiMac(bayGio = Date.now()) {
    const gioVn = require('./nghiep-vu/lien-he').gioVN(new Date(bayGio));
    if (gioVn < 10 || gioVn >= 20) return;
    const cm = require('./nghiep-vu/cau-mau-khach');
    const nutBam = require('./nghiep-vu/nut-bam');
    for (const d of don.donCanHoiMac(bayGio)) {
      const the = { kieu: 'nut', chu: cm.cau('hoi_mac', { ma: d.ma }), nut: ['vua', 'chat', 'rong'].map((k) => ({ tieu_de: cm.cau(`nut_${k}`), payload: nutBam.taoPayload('HOI_MAC', { don: d.id, kieu: k }) })) };
      const kq = await guiThe.guiTrangThai({ d, loai: 'hoi_mac', the, layKetNoi: this.layKetNoi, mucDich: 'cham_soc' }).catch((e) => ({ da_gui: false, ly_do: e.message }));
      if (!kq.da_gui && ['GIOI_HAN_LIEN_HE', 'NGOAI_GIO'].includes(kq.ma)) continue; // lượt sau
      don.ghiHoiMac(d.id); // gửi được hay không (mẫu bị xếp Tiếp thị, DỪNG): không hỏi lại, không tạo việc
    }
  }

  /* ---------------- báo live cho người đã đồng ý (F-97) ---------------- */

  /**
   * Mời nhận 1 tin báo lên sóng cho buổi kế (trong 23 giờ tới). `binhLuanFbId`: mời bằng nhắn riêng bình luận (chỗ mời a); không có
   * thì gửi trong Messenger (chỗ mời b, c). @returns {Promise<boolean>} đã gửi thẻ mời
   */
  async moiBaoLive({ h, cauGoc = '', binhLuanFbId = null }) {
    const lichLive = require('./nghiep-vu/lich-live');
    const dongY = require('./nghiep-vu/dong-y');
    const cm = require('./nghiep-vu/cau-mau-khach');
    const nutBam = require('./nghiep-vu/nut-bam');
    const ke = lichLive.buoiKe();
    if (!ke || !dongY.coTheMoi(h.nguoi_fb_id, ke.luc).duoc) return false;
    const soMon = require('./nghiep-vu/san-pham').danhSach().filter((x) => x.trang_thai === 'dang_ban').length;
    const chu = cm.cau('moi_bao_live', { lich: ke.chu, so_mon: soMon });
    const dy = dongY.taoLoiMoi({ pageId: h.page_id, nguoiFbId: h.nguoi_fb_id, hoiThoaiId: h.id, buoi: ke.luc, cauHoi: chu, dienTap: h.dien_tap });
    const the = { kieu: 'nut', chu, nut: [
      { tieu_de: cm.cau('nut_bao_live'), payload: nutBam.taoPayload('BAO_LIVE', { dy: dy.id }) },
      { tieu_de: cm.cau('nut_thoi_bao_live'), payload: nutBam.taoPayload('THOI_BAO_LIVE', { dy: dy.id }) },
    ] };
    let kq;
    if (binhLuanFbId) {
      const luot = require('./nghiep-vu/luot-nhan-rieng');
      const lg = luot.giu({ fbCommentId: binhLuanFbId, pageId: h.page_id, boi: 'moi_bao_live', binhLuanId: null, hoiThoaiId: h.id });
      if (!lg.thang) return false;
      kq = await guiThe.guiMoza({ h, dich: 'nhan_rieng', the, mucDich: 'tra_loi', khoa: `moi_live:${dy.id}`, binhLuanFbId, layKetNoi: this.layKetNoi });
    } else {
      kq = await guiThe.guiTinHeThong({ h, the, khoa: `moi_live:${dy.id}`, layKetNoi: this.layKetNoi });
    }
    if (kq.tin_nhan_id) dongY.ghiTinHoi(dy.id, kq.tin_nhan_id);
    hopThu.ghiChu(h.id, `MOZA mời nhận tin báo buổi live ${ke.chu}${cauGoc ? ` (khách viết: "${String(cauGoc).slice(0, 80)}")` : ''}.`);
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
    return !!kq.da_gui;
  }

  /** Khách hỏi lịch live (Messenger): câu mẫu + mời nếu buổi kế trong 23 giờ; xa hơn thì mời bấm "Nhắc tôi" ở Sự kiện live. */
  async traLoiLich(h, tinId) {
    const lichLive = require('./nghiep-vu/lich-live');
    const cm = require('./nghiep-vu/cau-mau-khach');
    const dong = lichLive.dongLich();
    const ke = lichLive.buoiKe();
    const gui = (chu, them = '') => guiThe.guiTinHeThong({ h, noiDung: chu, khoa: `lich:${tinId}${them}`, layKetNoi: this.layKetNoi });
    if (!dong || !ke) { await gui(cm.cau('tra_loi_lich_chua_co')); return; }
    await gui(cm.cau('tra_loi_lich', { dong_lich: dong.replace(/^Lịch live: /, 'Shop live ') }));
    const gan = new Date(ke.luc).getTime() - Date.now() <= require('./nghiep-vu/dong-y').MOI_TRUOC_MS;
    if (!gan || !(await this.moiBaoLive({ h, cauGoc: '' }).catch(() => false))) {
      if (!gan) await gui(cm.cau('tra_loi_lich_xa', { lich: ke.chu }), ':xa');
    }
    hopThu.datTrangThai(h.id, 'cho_phan_hoi');
  }

  /**
   * Live của Page vừa bắt đầu (phòng live gắn được live) và khớp một buổi trong lịch (±60 phút) → nhắn mỗi người đã đồng ý 1 tin có
   * link, rải tối đa 20 tin mỗi phút. Quá 24 giờ kể từ lúc bấm, đã DỪNG, "Dừng mọi thứ" → không gửi (ghi lý do).
   */
  async nhacLive(p, { cachMs = 3000, ngu = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    const buoi = require('./nghiep-vu/lich-live').khopBuoi(p.bat_dau_fb || p.bat_dau);
    if (!buoi) return { gui: 0, ly_do: 'Live không khớp buổi nào trong lịch.' };
    const dongY = require('./nghiep-vu/dong-y');
    const { nhan, qua_24: qua } = dongY.canNhac(buoi.luc, { dienTap: p.dien_tap });
    for (const d of qua) dongY.ghiNhac(d.id, { lyDo: 'quá 24 giờ kể từ lúc bấm' });
    const link = p.fb_link || '';
    const cm = require('./nghiep-vu/cau-mau-khach');
    let gui = 0;
    for (const [i, d] of nhan.entries()) {
      if (i) await ngu(cachMs);
      if (caiDat.khanCap()) { dongY.ghiNhac(d.id, { lyDo: '"Dừng mọi thứ" đang bật' }); continue; }
      const ids = hopThu.hoiThoaiMessengerCua({ hoiThoaiId: d.hoi_thoai_id, nguoiFbId: d.nguoi_fb_id });
      const h = ids.length ? hopThu.layHoiThoai(ids[0]) : null;
      if (!h) { dongY.ghiNhac(d.id, { lyDo: 'chưa có hội thoại Messenger' }); continue; }
      const ten = hopThu.layNguoi(d.nguoi_fb_id)?.ten_hien_thi?.split(' ').at(-1) || 'Bạn';
      const kq = await guiThe.guiTinHeThong({ h, noiDung: cm.cau('bao_len_song', { ten, link }), khoa: `chu_dong:bao_live:${d.id}`, layKetNoi: this.layKetNoi, mucDich: 'moi_chao' });
      if (kq.da_gui) { dongY.ghiNhac(d.id, { tinId: kq.tin_nhan_id || 'da_gui' }); gui += 1; } else dongY.ghiNhac(d.id, { lyDo: kq.ly_do || kq.ma || 'không gửi được' });
    }
    this.phat('live.dong_y', { phien_id: p.id, ...dongY.demBuoi(buoi.luc) });
    return { gui, qua_24: qua.length };
  }

  /** Chờ mọi việc đang gom / đang chạy xong (test). */
  async choXong(toiDaMs = 20000) {
    const het = Date.now() + toiDaMs;
    while ((this.dangNhan || this.henGom.size || this.cho.length || this.dangChay.size || this.dangMoi) && Date.now() < het) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async xuLy(hoiThoaiId, { viec = null, kichHoat = null, chuDong = false } = {}) {
    const truoc = hopThu.layHoiThoai(hoiThoaiId);
    const kq = await tuVan.xuLyHoiThoai(hoiThoaiId, {
      kichHoat: kichHoat || `Tin mới trong hội thoại ${truoc.kenh === 'messenger' ? 'Messenger' : 'bình luận'}`,
      layKetNoi: this.layKetNoi, viec, chuDong, nhaCungCap: this.nhaCungCap,
    });
    // F-72: "Dừng AI" (chạm trần chi phí) — khách gõ chữ thì vào Cần người kèm MỘT câu báo nhận (tối đa 1 lần / giờ mỗi hội thoại),
    // không để khách chờ im.
    if (kq?.loi?.ma === 'DUNG_AI' && !viec && !chuDong) {
      const h = hopThu.datCanNguoi(hoiThoaiId, 'AI tạm dừng vì chạm trần chi phí: người trả lời khách giúp.');
      if (h.kenh === 'messenger') {
        const gioBucket = Math.floor(Date.now() / 3600e3);
        await guiThe.guiTinHeThong({ h, noiDung: require('./nghiep-vu/cau-mau-khach').cau('dung_ai_bao_nhan'), khoa: `dung_ai:${h.id}:${gioBucket}`, layKetNoi: this.layKetNoi }).catch(() => {});
      }
    }
    const sau = hopThu.layHoiThoai(hoiThoaiId);
    if (!viec && !chuDong && kq?.ok !== false) await this.hoiLuuSoDo(sau).catch((e) => console.error(`  [hộp thư] hỏi lưu số đo lỗi: ${e.message}`));
    if (sau.trang_thai === 'can_nguoi' && truoc.trang_thai !== 'can_nguoi') {
      await chayCua('khi_can_nguoi', { hoiThoaiId, lyDo: sau.ly_do_can_nguoi, dienTap: sau.dien_tap });
    }
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: hoiThoaiId });
    return kq;
  }

  async canNguoi(hoiThoaiId, lyDo) {
    const h = hopThu.datCanNguoi(hoiThoaiId, lyDo);
    await chayCua('khi_can_nguoi', { hoiThoaiId, lyDo, dienTap: h.dien_tap });
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: hoiThoaiId });
  }

  /* ---------------- nhịp 30 giây ---------------- */

  async nhip() {
    const n = hopThu.donTinKhongRo();
    if (n) this.phat('hop_thu.cap_nhat', {});
    await this.lamViecDenHan();
    await this.nhacDon();
    require('./nghiep-vu/cho-hang').quetHetHan(); // F-92: người chờ quá 24 giờ → hết hạn (không nhắn)
    await this.hoiLaiDon().catch((e) => console.error('  [hộp thư] hỏi lại đơn lỗi: ' + e.message)); // F-99
    await this.hoiMac().catch((e) => console.error('  [hộp thư] hỏi thăm lỗi: ' + e.message)); // F-100
    await this.guiMoiChoHang();
    if (caiDat.layAgent('tu_van').bat) {
      this.nhanChoTuVan();
    }
    for (const id of hopThu.hoiThoaiCanXuLyLai(new Date(Date.now() - 2 * 60000).toISOString())) {
      if (!this.henGom.has(id) && !this.dangChay.has(id) && !this.cho.includes(id)) this.xepHang(id);
    }
    if (Date.now() - this.xoaCuoi > NGAY_MS) {
      this.xoaCuoi = Date.now();
      const kq = kh.tuXoaQuaHan();
      if (kq.khach || kq.hoi_thoai) console.log(`  [hộp thư] tự xóa dữ liệu quá 12 tháng: ${kq.khach} khách, ${kq.hoi_thoai} hội thoại`);
    }
  }

  /** Bình luận live "Chờ Tư vấn viên" (F-17): thành hội thoại để Tư vấn viên nhắn riêng. */
  nhanChoTuVan() {
    const luot = require('./nghiep-vu/luot-nhan-rieng');
    for (const bl of live.danhSachChoTuVan()) {
      // F-65: bình luận đã dùng lượt nhắn riêng (thẻ do MOZA gửi) → không giao Tư vấn viên nhắn riêng lần hai.
      if (luot.daCoLuot(bl.fb_id)) { live.datXuLy(bl.phien_id, [bl.id], 'da_tu_van'); continue; }
      let p;
      try { p = live.layPhien(bl.phien_id); } catch { continue; }
      const kq = hopThu.tuBinhLuanLive(bl, p);
      live.datXuLy(bl.phien_id, [bl.id], 'da_tu_van');
      this.phat('live.cho_tu_van', { phien_id: bl.phien_id, dem: live.demBinhLuan(bl.phien_id) });
      if (kq.moi) this.henXuLy(kq.hoiThoai.id, 0);
    }
  }

  /**
   * Việc MOZA tự làm đã tới giờ (F-32 bán hàng): nhắn lại khách theo hẹn (dat_nhac) — Tư vấn viên soạn; ngoài 24 giờ
   * kể từ tin cuối của khách thì không nhắn (Meta chỉ cho nhắn trong 24 giờ), ghi lý do. Nhắc thông tin giao, báo đã gửi
   * hàng làm ở BH4 (don.js).
   */
  async lamViecDenHan() {
    for (const v of kh.viecAiDenHan()) {
      try {
        await this.hoiThamViec(v);
      } catch (e) {
        kh.suaViec(v.id, { trangThai: 'huy', ketQua: `Lỗi: ${e.message}` });
      }
    }
  }

  /**
   * Nhắn chủ động về đơn (F-32 bán hàng), mỗi đơn một lần:
   *  - đơn Chờ xác nhận còn ≤ 2 giờ giữ hàng mà thiếu thông tin giao → nhắc khách;
   *  - đơn vừa Đã gửi → báo khách kèm mã vận đơn.
   * Chỉ nhắn trong 24 giờ kể từ tin cuối của khách, tối đa 1 tin chủ động mỗi người mỗi ngày; ngoài đó nhắc thông tin
   * giao thành việc "Gọi khách" cho người, báo đã gửi thì thôi (không có cách nhắn hợp lệ).
   */
  async nhacDon(bayGio = Date.now()) {
    // F-69 (#99): nhắc đơn chờ xác nhận — tối đa 2 lần, tin do mã soạn (0 lượt AI); Hook giới hạn liên hệ giữ luật số lần, khung
    // 7h–22h, khách xin dừng. Đơn không có số mà khách không nhắn trong 24 giờ: không tạo việc gọi (Đơn hàng ghi "Chưa liên lạc được").
    for (const d of don.donCanNhac()) await this.nhacMotDon(d, bayGio).catch((e) => console.error(`  [hộp thư] nhắc ${d.ma} lỗi: ${e.message}`));
    for (const d of don.donCanBaoHuy(new Date(bayGio))) await this.baoHuyDon(d).catch((e) => console.error(`  [hộp thư] báo hủy ${d.ma} lỗi: ${e.message}`));
    const { bao } = don.canNhanChuDong(new Date(bayGio));
    for (const d of bao) {
      don.danhDauNhan(d.id, 'bao_gui_luc');
      // F-98: câu mẫu trong 24 giờ (0 lượt AI — trước đây gọi Tư vấn viên), ngoài 24 giờ mẫu Utility; khách DỪNG → việc cho người.
      const cm = require('./nghiep-vu/cau-mau-khach');
      await guiThe.guiTrangThai({ d, loai: 'da_gui', layKetNoi: this.layKetNoi,
        chu: cm.cau('tt_da_gui', { ma: d.ma, van_don: d.ma_van_don ? `, mã vận đơn ${d.ma_van_don}` : '' }) })
        .catch((e) => console.error(`  [hộp thư] báo gửi ${d.ma} lỗi: ${e.message}`));
    }
  }

  /** Hội thoại Messenger mới nhất của người mua (tin khách gần nhất trước). */
  hoiThoaiMessengerMoi(d) {
    const ds = hopThu.hoiThoaiMessengerCua({ hoiThoaiId: d.hoi_thoai_id, nguoiFbId: d.nguoi_fb_id }).map((id) => hopThu.layHoiThoai(id));
    return ds.filter((h) => h.tin_khach_cuoi_luc).sort((x, y) => (x.tin_khach_cuoi_luc < y.tin_khach_cuoi_luc ? 1 : -1))[0] || null;
  }

  /**
   * Một lần nhắc (F-69). Lần 1: 20 phút sau tin cuối của shop mà khách chưa làm bước tiếp (trong 24 giờ). Lần 2: vào lúc sớm hơn
   * giữa "hạn giữ − 2 giờ" và "tin cuối của khách + 22 giờ", cách lần 1 ≥ 2 giờ; ngoài 24 giờ thì mẫu Utility "đơn đang chờ xác
   * nhận" (chỉ khi Meta xếp UTILITY). Khách chưa từng nhắn Messenger (chỉ có thẻ nhắn riêng) → không nhắn được: nhắc trên sóng lo.
   */
  async nhacMotDon(d, bayGio = Date.now()) {
    const h = this.hoiThoaiMessengerMoi(d);
    if (!h || h.ai_tam_dung) return;
    const lan = d.nhac_lan + 1;
    const tinKhach = new Date(h.tin_khach_cuoi_luc).getTime();
    const trong24 = bayGio - tinKhach < NGAY_MS;
    const cuoi = hopThu.tinCuaHoiThoai(h.id, { gioiHan: 5 }).filter((t) => t.chieu !== 'noi_bo').at(-1);
    const PHUT = 60e3;
    if (lan === 1) {
      if (!trong24 || !cuoi || cuoi.gui_boi === 'khach' || bayGio - new Date(cuoi.luc).getTime() < 20 * PHUT) return;
    } else {
      const moc = Math.min(new Date(d.giu_den).getTime() - 2 * 3600e3, tinKhach + 22 * 3600e3);
      if (bayGio < moc || bayGio - new Date(d.nhac_cuoi_luc || 0).getTime() < 2 * 3600e3) return;
      if (cuoi?.gui_boi === 'khach' && bayGio - new Date(cuoi.luc).getTime() < 20 * PHUT) return; // đang trò chuyện
    }
    const cm = require('./nghiep-vu/cau-mau-khach');
    const theGiu = require('./nghiep-vu/the-giu-hang');
    const nutBam = require('./nghiep-vu/nut-bam');
    let kq;
    if (trong24) {
      const thieu = don.viecConThieu(d);
      const bien = { ma: d.ma, tong: require('./nghiep-vu/chung').hienTien(d.tong_tien), giu_den: theGiu.gioChu(d.giu_den), thieu: thieu.map((x) => x.replace('chưa có ', '')).join(', ') };
      const khongLay = [{ tieu_de: cm.cau('nut_khong_lay'), payload: nutBam.taoPayload('KHONG_LAY', { don: d.id, pl: '' }) }];
      const the = thieu.length
        ? { kieu: 'chu', chu: cm.cau('nhac_con_thieu', bien), tra_loi_nhanh: khongLay }
        : { kieu: 'nut', chu: cm.cau('nhac_du_thong_tin', bien), nut: theDon.nut(d), tra_loi_nhanh: khongLay };
      kq = await guiThe.guiMoza({ h, the, mucDich: 'nhac', khoa: `nhac:${d.id}:${lan}`, donId: d.id, layKetNoi: this.layKetNoi });
    } else {
      if (lan === 1) return;
      kq = await guiThe.guiUtility({ d, loai: 'cho_xac_nhan', layKetNoi: this.layKetNoi, mucDich: 'nhac' });
    }
    if (kq.da_gui || kq.trung) don.ghiNhac(d.id, { bayGio: new Date(bayGio) });
    // Mẫu bị Meta xếp tiếp thị / chưa có → bỏ lần này. Đã đủ lần / khách xin dừng → thôi nhắc hẳn. Ngoài giờ → để lượt sau.
    else if (kq.ma === 'MAU_CHUA_DUNG_DUOC' || /Chưa có mẫu/.test(kq.ly_do || '')) don.ghiNhac(d.id, { bayGio: new Date(bayGio) });
    else if (['GIOI_HAN_LIEN_HE', 'NGUNG_LIEN_HE'].includes(kq.ma)) don.ghiNhac(d.id, { het: true });
    // Page bị Meta khóa nhắn tin (F-73): không nhắc lúc này, hết khóa thì lượt sau nhắc tiếp.
    if (kq.da_gui) this.phat('don.cap_nhat', { don_id: d.id });
  }

  /**
   * Báo khách đơn đã hủy vì quá giờ giữ (F-69): trong 24 giờ có nút [Đặt lại]; ngoài 24 giờ mẫu Utility "đơn đã hủy" (chỉ thông
   * tin; chưa có mẫu thì thôi). Khách đã xin dừng → không báo (Hook). Mỗi đơn một lần.
   */
  async baoHuyDon(d) {
    const h = this.hoiThoaiMessengerMoi(d);
    if (!h) { don.ghiBaoHuy(d.id); return; }
    const trong24 = Date.now() - new Date(h.tin_khach_cuoi_luc).getTime() < NGAY_MS;
    const cm = require('./nghiep-vu/cau-mau-khach');
    let kq;
    if (trong24) {
      const nut = [{ tieu_de: cm.cau('nut_dat_lai'), payload: require('./nghiep-vu/nut-bam').taoPayload('DAT_LAI', { don: d.id }) }];
      kq = await guiThe.guiMoza({ h, the: { kieu: 'nut', chu: cm.cau('bao_huy', { ma: d.ma }), nut }, mucDich: 'bao_huy', khoa: `bao_huy:${d.id}`, donId: d.id, layKetNoi: this.layKetNoi });
    } else {
      kq = await guiThe.guiUtility({ d, loai: 'da_huy', layKetNoi: this.layKetNoi, mucDich: 'bao_huy' });
    }
    if (kq.ma === 'NGOAI_GIO' || kq.ma === 'PAGE_BI_HAN_CHE' || kq.cho_duyet) return; // lượt sau (7h / hết khóa) / người duyệt
    don.ghiBaoHuy(d.id);
  }

  /** Hội thoại Messenger nhắn chủ động được cho đơn này (trong 24 giờ, AI không tạm dừng, chưa có tin chủ động hôm nay). */
  hoiThoaiNhan(d, bayGio = Date.now()) {
    const ids = hopThu.hoiThoaiMessengerCua({ hoiThoaiId: d.hoi_thoai_id, nguoiFbId: d.nguoi_fb_id });
    for (const id of ids) {
      const h = hopThu.layHoiThoai(id);
      const trong24 = h.tin_khach_cuoi_luc && bayGio - new Date(h.tin_khach_cuoi_luc).getTime() < NGAY_MS;
      if (trong24 && !h.ai_tam_dung && hopThu.demTinChuDongHomNay(h.id) < 1) return h;
    }
    return null;
  }

  async hoiThamViec(v) {
    const h = v.hoi_thoai_id ? hopThu.layHoiThoai(v.hoi_thoai_id) : null;
    const trong24 = h?.tin_khach_cuoi_luc && Date.now() - new Date(h.tin_khach_cuoi_luc).getTime() < NGAY_MS;
    if (!h || h.kenh !== 'messenger' || !trong24 || h.ai_tam_dung || hopThu.demTinChuDongHomNay(h.id) >= 1) {
      return kh.suaViec(v.id, { trangThai: 'huy', ketQua: 'Không nhắn: ngoài 24 giờ, người đang giữ hội thoại hoặc đã có tin chủ động hôm nay.' });
    }
    await this.xuLy(h.id, { viec: `Nhắn lại khách theo hẹn: ${v.noi_dung}. Nhắn một tin ngắn, thân thiện.`, kichHoat: 'Nhắn lại theo hẹn', chuDong: true });
    return kh.suaViec(v.id, { trangThai: 'xong', ketQua: 'Đã giao Tư vấn viên nhắn lại.' });
  }

  /* ---------------- người dùng thao tác ---------------- */

  /** Người gửi tin từ MOZA (F-26): AI tạm dừng ở hội thoại đó cho tới khi "Giao lại cho AI". */
  async nguoiGui(hoiThoaiId, noiDung) {
    const h = hopThu.tamDungAi(hoiThoaiId);
    const cong = await thucHienCongCu({
      ten: h.kenh === 'messenger' ? 'gui_messenger' : 'tra_loi_binh_luan',
      thamSo: { noi_dung: noiDung, trich_dan: [] },
      nguCanh: { hoiThoaiId, layKetNoi: this.layKetNoi, guiBoi: 'nguoi', agentId: null, khoaChongTrung: `nguoi:${Date.now()}:${Math.random()}` },
      daDuyet: true,
    });
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: hoiThoaiId });
    return cong;
  }

  giaoLaiAi(hoiThoaiId) {
    const h = hopThu.giaoLaiAi(hoiThoaiId);
    const cuoi = hopThu.tinCuaHoiThoai(h.id, { gioiHan: 1 })[0];
    if (cuoi?.gui_boi === 'khach') this.henXuLy(h.id, 0); // còn tin khách chưa trả lời
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: hoiThoaiId });
    return h;
  }

  /** "Thử lại" một tin AI gửi lỗi (F-25): gửi lại đúng câu, vẫn qua Bộ kiểm tra; khóa mới để không đụng lần cũ. */
  async thuLai(tinNhanId) {
    const t = hopThu.layTin(tinNhanId);
    if (t.chieu !== 'ra' || !['loi', 'khong_ro'].includes(t.trang_thai_gui)) {
      throw new (require('./nghiep-vu/chung').LoiNghiepVu)('KHONG_THU_LAI_DUOC', 'Chỉ thử lại được tin gửi lỗi hoặc không rõ.', 409);
    }
    const ten = t.loai === 'tin' ? 'gui_messenger' : t.loai === 'tra_loi' ? 'tra_loi_binh_luan' : 'nhan_rieng';
    const kq = await thucHienCongCu({
      ten, thamSo: { noi_dung: t.noi_dung, trich_dan: t.trich_dan || [] },
      nguCanh: { hoiThoaiId: t.hoi_thoai_id, layKetNoi: this.layKetNoi, guiBoi: t.gui_boi, agentId: null, khoaChongTrung: `thu_lai:${t.id}:${Date.now()}` },
      daDuyet: true,
    });
    if (!kq.loi) hopThu.ghiDaThuLai(t.id);
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: t.hoi_thoai_id });
    return kq;
  }
}

module.exports = { HopThuTuDong };
