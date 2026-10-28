'use strict';

/**
 * Phòng live: nối bộ Kết nối Facebook với phiên live (SPEC.md F-19, F-20).
 *
 *  - Có phiên "chờ live" → hỏi Facebook định kỳ; thấy đúng một live đang phát → tự gắn vào phiên.
 *    Page có từ 2 live trở lên → không tự đoán, hỏi người dùng chọn live nào.
 *  - Đang live → nhận luồng bình luận trực tiếp, lưu, đẩy lên màn hình; live biến mất trên Page → tự kết thúc phiên.
 *  - Luồng trực tiếp hỏng → hỏi Facebook mỗi 3 giây (không sót bình luận: đọc lại từ bình luận cuối đã nhận),
 *    30 giây thử mở lại luồng trực tiếp một lần.
 *  - Khởi động lại phần mềm giữa buổi live → lần quét đầu tự mở lại luồng bình luận.
 *
 * Bình luận mới đi qua cửa hook `khi_tin_den` (A.3): đóng khung lời người dùng, ẩn bình luận lộ số
 * điện thoại / CCCD. Bình luận còn lại chuyển cho AI của phòng live (phong-ai.js: Director, Co-host).
 */

const live = require('./nghiep-vu/live');
const { chayCua } = require('./agent/hook/cua');
const { LoiNghiepVu } = require('./nghiep-vu/chung');

const HOI_DINH_KY_MS = 3000;
const THU_LAI_LUONG_MS = 30000;
const HOI_XEM_MS = 60000; // F-70: hỏi số người xem (live_views) mỗi phút để nhắc cách chốt khi người xem tăng
const TU_NHAN_MS = 60000; // F-109: kiểm mỗi phút, tới hẹn 15 phút thì Mai tự nhận là trợ lý AI

class PhongLive {
  /**
   * @param {{ layKetNoi: (phien: object) => object, phat: (type: string, duLieu?: object) => void, ai?: object,
   *           hoiDinhKyMs?: number, thuLaiLuongMs?: number }} o
   *   layKetNoi: chọn bộ Kết nối cho phiên (trước M5 luôn là Facebook giả).
   *   ai: AI của phòng live (phong-ai.js); không có thì phòng live chỉ nhận và lưu bình luận.
   */
  constructor({ layKetNoi, phat, ai = null, khiKetThuc = null, hoiDinhKyMs = HOI_DINH_KY_MS, thuLaiLuongMs = THU_LAI_LUONG_MS, hoiXemMs = HOI_XEM_MS }) {
    this.hoiXemMs = hoiXemMs;
    this.layKetNoi = layKetNoi;
    this.phat = phat;
    this.ai = ai;
    this.khiKetThuc = khiKetThuc; // ví dụ tắt chép lời người dẫn
    this.hoiDinhKyMs = hoiDinhKyMs;
    this.thuLaiLuongMs = thuLaiLuongMs;
    this.luong = null; // { phienId, cachDoc: 'truc_tiep' | 'hoi_dinh_ky', dong, thuLaiLuc }
    this.nhieuLive = null; // { phienId, live: [...] } khi Page có từ 2 live, chờ người dùng chọn
    this.binhLuanCuoiLuc = null;
    this.dangQuet = false;
    this.hen = null;
  }

  batDau() {
    const lap = async () => {
      await this.quet().catch((e) => console.error('  [phòng live] ' + e.message));
      const p = live.phienDangMo();
      const chuKy = p ? this.layKetNoi(p).chuKyTimLiveMs : 1000;
      this.hen = setTimeout(lap, chuKy);
    };
    this.hen = setTimeout(lap, 0);
  }

  dung() {
    clearTimeout(this.hen);
    this.dongLuong();
  }

  async quet() {
    if (this.dangQuet) return;
    this.dangQuet = true;
    try {
      const p = live.phienDangMo();
      if (!p) {
        this.nhieuLive = null;
        return this.dongLuong();
      }
      const fb = this.layKetNoi(p);
      const dangPhat = await fb.timLiveDangPhat();
      if (p.trang_thai === 'cho_live') {
        if (dangPhat.length === 1) {
          this.nhieuLive = null;
          this.gan(p, dangPhat[0], fb);
        } else if (dangPhat.length > 1) {
          this.baoNhieuLive(p, dangPhat);
        } else if (this.nhieuLive) {
          this.baoNhieuLive(p, []);
        }
        return;
      }
      if (!dangPhat.some((x) => x.id === p.fb_live_video_id)) {
        this.ketThuc(p.id, 'Live đã kết thúc trên Page');
        return;
      }
      if (this.luong?.phienId !== p.id) this.moLuong(p, fb);
      else if (this.luong.cachDoc === 'hoi_dinh_ky' && Date.now() >= this.luong.thuLaiLuc) this.moLuong(p, fb);
    } finally {
      this.dangQuet = false;
    }
  }

  /** Page có từ 2 live: chỉ báo khi danh sách đổi, để màn hình không vẽ lại mỗi giây. */
  baoNhieuLive(p, ds) {
    const khoa = ds.map((x) => x.id).join(',');
    if (this.nhieuLive?.phienId === p.id && this.nhieuLive.live.map((x) => x.id).join(',') === khoa) return;
    this.nhieuLive = ds.length > 1 ? { phienId: p.id, live: ds } : null;
    this.phat('live.nhieu_live', { phien_id: p.id, live: ds.length > 1 ? ds : [] });
  }

  /** Người dùng chọn một live khi Page có nhiều live (F-19). */
  async chonLive(phienId, fbLiveId) {
    const p = live.layPhien(phienId);
    if (p.trang_thai !== 'cho_live') return p;
    const fb = this.layKetNoi(p);
    const l = (await fb.timLiveDangPhat()).find((x) => x.id === fbLiveId);
    if (!l) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Live này không còn phát trên Page.', 404);
    this.nhieuLive = null;
    this.gan(p, l, fb);
    return live.layPhien(phienId);
  }

  gan(p, liveFb, fb) {
    const moi = live.ganLive(p.id, liveFb.id, liveFb.page_id || null, { batDau: liveFb.bat_dau, videoId: liveFb.video_id, link: liveFb.fb_link });
    this.moLuong(moi, fb);
    this.phat('live.bat_dau', { phien_id: moi.id });
    this.khiGan?.(moi); // F-73: hỏi Page Integrity lúc mở phiên
  }

  moLuong(p, fb) {
    const tuHoiDinhKy = this.luong?.phienId === p.id && this.luong.cachDoc === 'hoi_dinh_ky';
    this.dongLuong();
    const phienId = p.id;
    const liveId = p.fb_live_video_id;
    const l = fb.moLuongBinhLuan(liveId, (bl) => this.nhanBinhLuan(phienId, bl), () => {
      // Luồng trực tiếp hỏng: chuyển sang hỏi định kỳ, không làm gián đoạn buổi live.
      if (this.luong?.phienId === phienId && this.luong.cachDoc === 'truc_tiep') this.hoiDinhKy(p, fb);
    });
    this.luong = { phienId, cachDoc: 'truc_tiep', dong: l.dong };
    this.baoCachDoc(phienId);
    this.hoiNguoiXem(phienId, liveId, fb);
    this.henTuNhanAi(phienId);
    // Vừa từ hỏi định kỳ quay lại luồng trực tiếp: đọc bù khoảng giữa lần hỏi cuối và lúc mở luồng.
    if (tuHoiDinhKy) {
      fb.docBinhLuan(liveId, this.binhLuanCuoiLuc)
        .then(async (ds) => { for (const bl of ds) await this.nhanBinhLuan(phienId, bl); })
        .catch((e) => console.error('  [phòng live] đọc bù bình luận lỗi: ' + e.message));
    }
  }

  hoiDinhKy(p, fb) {
    this.dongLuong();
    const phienId = p.id;
    let dung = false;
    let hen = null;
    const hoi = async () => {
      if (dung) return;
      try {
        const ds = await fb.docBinhLuan(p.fb_live_video_id, this.binhLuanCuoiLuc);
        for (const bl of ds) await this.nhanBinhLuan(phienId, bl);
      } catch (e) {
        console.error('  [phòng live] hỏi bình luận định kỳ lỗi: ' + e.message);
      }
      if (!dung) hen = setTimeout(hoi, this.hoiDinhKyMs);
    };
    this.luong = {
      phienId,
      cachDoc: 'hoi_dinh_ky',
      thuLaiLuc: Date.now() + this.thuLaiLuongMs,
      dong: () => { dung = true; clearTimeout(hen); },
    };
    this.baoCachDoc(phienId);
    hoi();
  }

  baoCachDoc(phienId) {
    this.phat('live.luong_binh_luan', { phien_id: phienId, cach_doc: this.luong?.cachDoc ?? null });
  }

  /** Cách đang đọc bình luận của phiên: 'truc_tiep' | 'hoi_dinh_ky' | null. */
  cachDoc(phienId) {
    return this.luong?.phienId === phienId ? this.luong.cachDoc : null;
  }

  /** Số người xem mỗi phút (F-70, F-116) — biết lúc nào nhiều người mới vào, lưu theo phút; lỗi thì bỏ qua. */
  hoiNguoiXem(phienId, liveId, fb) {
    clearInterval(this.henXem);
    if (!fb?.timLiveDangPhat) return;
    const hoi = () => fb.timLiveDangPhat().then((ds) => {
      const x = ds.find((y) => y.id === liveId);
      if (x && x.nguoi_xem != null) {
        this.chotDon?.ghiNguoiXem(phienId, x.nguoi_xem);
        // F-116: lưu theo phút cho bảng huấn luyện (và F-117) — trong bộ nhớ chỉ giữ 10 phút.
        try { require('./nghiep-vu/so-lieu-phut').ghiPhut(phienId, { nguoiXem: x.nguoi_xem }); } catch { /* cơ sở dữ liệu đã đóng */ }
      }
    }).catch(() => {});
    hoi();
    this.henXem = setInterval(hoi, this.hoiXemMs);
    this.henXem.unref?.();
  }

  /** F-109: Mai tự nhận là trợ lý AI khi bắt đầu buổi và mỗi 15 phút (tu-nhan-ai.js quyết theo chế độ). */
  henTuNhanAi(phienId) {
    clearInterval(this.henTuNhan);
    if (!this.tuNhanAi) return;
    const nhip = () => this.tuNhanAi.nhip(phienId).catch((e) => console.error('  [tự nhận AI] ' + e.message));
    nhip();
    this.henTuNhan = setInterval(nhip, TU_NHAN_MS);
    this.henTuNhan.unref?.();
  }

  dongLuong() {
    clearInterval(this.henXem);
    clearInterval(this.henTuNhan);
    if (this.luong) this.luong.dong();
    this.luong = null;
  }

  async nhanBinhLuan(phienId, bl) {
    if (!this.binhLuanCuoiLuc || bl.luc > this.binhLuanCuoiLuc) this.binhLuanCuoiLuc = bl.luc;
    let r;
    try {
      const p0 = live.layPhien(phienId);
      // L8: bình luận của chính Page (câu ghim "ví dụ chốt 12 đen M", mục lục) không bao giờ vào chốt đơn, ẩn bình luận, Director.
      const laPage = !!bl.la_page || (!!bl.nguoi_id && bl.nguoi_id === (p0.page_id || (p0.dien_tap ? 'page_gia' : '')));
      r = live.themBinhLuan(phienId, { fb_id: bl.id, nguoi_fb_id: bl.nguoi_id, ten: bl.ten, noi_dung: bl.noi_dung, luc_fb: bl.luc,
        an_danh: !!bl.an_danh, la_page: laPage });
    } catch (e) {
      console.error('  [phòng live] không lưu được bình luận: ' + e.message);
      return null;
    }
    if (!r) return null;
    // Hiện ngay cho người dẫn, rồi mới chạy hook: ẩn bình luận trên Facebook có thể mất một lúc.
    // F-126: cờ khách cũ cho bộ lọc bình luận của Màn hình người dẫn (chỉ người dẫn thấy).
    let khachCu = false;
    try { khachCu = require('./nghiep-vu/so-lieu-phut').laKhachCu(phienId, r.nguoi_fb_id); } catch { /* bỏ qua */ }
    this.phat('live.binh_luan', { phien_id: phienId, binh_luan: { ...r, khach_cu: khachCu } });
    if (r.nhan.includes('cua_page')) return r;
    const ctx = { binhLuan: r, layKetNoi: () => this.layKetNoi(live.layPhien(phienId)) };
    try {
      await chayCua('khi_tin_den', ctx);
    } catch (e) {
      console.error('  [phòng live] hook khi bình luận đến lỗi: ' + e.message);
    }
    if (ctx.binhLuan !== r) this.phat('live.binh_luan_cap_nhat', { phien_id: phienId, binh_luan: ctx.binhLuan });
    // F-74: bình luận có số tài khoản / link lạ của người không phải Page — đã ẩn (hook an_gia_shop); báo người dẫn, dừng ở đây.
    if (r.nhan.includes('gia_shop')) {
      this.phat('live.canh_bao', { phien_id: phienId, loai: 'gia_shop', ten: r.ten,
        chu: `${r.ten} bình luận có số tài khoản hoặc link lạ — có thể giả shop. MOZA đã ẩn. Nhắc cả nhà: shop chỉ nhận tiền qua Messenger của Page.` });
      return ctx.binhLuan;
    }
    // F-66: "ẩn tên" → cả buổi (và về sau) không đọc tên người này; "dừng / thôi shop" → thôi nhắn chủ động. Nhận bằng mã.
    const yDinh = r.nhan.filter((n) => n === 'an_ten' || n === 'xin_dung');
    if (yDinh.length) {
      try {
        const n = require('./nghiep-vu/hop-thu').nguoiCuaBinhLuan(r, live.layPhien(phienId));
        const lienHe = require('./nghiep-vu/lien-he');
        if (yDinh.includes('an_ten')) lienHe.datAnTen(n.id);
        if (yDinh.includes('xin_dung')) lienHe.datNgung(n.id);
      } catch (e) { console.error('  [phòng live] ghi ẩn tên / xin dừng lỗi: ' + e.message); }
    }
    // F-81: khách xin xem (xoay lưng, soi vải, đứng xa, màu khác) → thẻ nhắc người dẫn; bình luận vẫn đi tiếp tới Director.
    if (r.nhan.includes('muon_xem')) {
      try { this.theNhac?.nhan(ctx.binhLuan, live.layPhien(phienId)); } catch (e) { console.error('  [phòng live] thẻ nhắc lỗi: ' + e.message); }
    }
    // F-77: phép thử "chốt test" — không tạo đơn, nhắn riêng một tin thử, bảng Sẵn sàng báo kết quả.
    if (require('./nghiep-vu/tu-khoa').gon(r.noi_dung) === 'chot test') {
      try { await this.chotDon?.xuLyChotTest(ctx.binhLuan, live.layPhien(phienId)); } catch (e) { console.error('  [phòng live] chốt test lỗi: ' + e.message); }
      return ctx.binhLuan;
    }
    // F-70: "ib / check ib / chưa thấy tin / giá sao" → nhắn lại thẻ bằng mã, trước chốt và Director. "ib" không cần Director;
    // "giá sao" vẫn để AI trả lời trên sóng (câu hỏi chung của nhiều người).
    let daIb = false;
    if ((r.nhan.includes('ib') || r.nhan.includes('ib_gia')) && !ctx.binhLuan.da_an) {
      try {
        daIb = await this.chotDon?.xuLyIb(ctx.binhLuan, live.layPhien(phienId));
      } catch (e) {
        console.error('  [phòng live] thẻ ib lỗi: ' + e.message);
      }
      if (daIb && r.nhan.includes('ib')) return ctx.binhLuan;
    }
    // Bình luận chốt (F-53): giữ hàng, đọc tên trên sóng, nhắn riêng — không cần Director. Kể cả bình luận đã ẩn vì lộ số.
    let laChot = false;
    try {
      if (!daIb) laChot = await this.chotDon?.xuLy(ctx.binhLuan, live.layPhien(phienId));
    } catch (e) {
      console.error('  [phòng live] chốt đơn lỗi: ' + e.message);
    }
    // F-86: đang bình chọn → bình luận là phiếu ("A", "chọn b", "be") thì không vào Director.
    if (!laChot && this.binhChon?.nhanBinhLuan(ctx.binhLuan)) {
      this.phat('live.binh_luan_cap_nhat', { phien_id: phienId, binh_luan: live.layBinhLuan(ctx.binhLuan.id) });
      return ctx.binhLuan;
    }
    // F-82: hỏi size kèm số đo, khớp bảng size rõ → MOZA tự trả lời bằng mã (gọi tên), Director không nhận.
    if (!laChot && !ctx.binhLuan.da_an) {
      let daTraLoi = false;
      try { daTraLoi = !!this.tuVanSize?.nhan(ctx.binhLuan, live.layPhien(phienId)); } catch (e) { console.error('  [phòng live] tư vấn size lỗi: ' + e.message); }
      if (daTraLoi) return ctx.binhLuan;
    }
    // Bình luận đã bị ẩn (lộ số) thì không đưa cho Director: nó đã nằm chờ Tư vấn viên.
    // Bình luận chỉ để xin ẩn tên / xin dừng: đã xử lý bằng mã, không cần Director.
    if (!laChot && !ctx.binhLuan.da_an && !yDinh.length) this.ai?.nhanBinhLuan(ctx.binhLuan);
    return ctx.binhLuan;
  }

  ketThuc(phienId, lyDo) {
    this.dongLuong();
    this.binhLuanCuoiLuc = null;
    this.ai?.ketThuc(phienId);
    this.tuNhanAi?.ketThuc(phienId);
    this.khiKetThuc?.(phienId);
    const p = live.ketThucPhien(phienId, lyDo);
    this.phat('live.ket_thuc', { phien_id: phienId, tom_tat: p.tom_tat });
    return p;
  }
}

module.exports = { PhongLive };
