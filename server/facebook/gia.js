'use strict';

/**
 * Facebook giả của Phòng diễn tập (SPEC.md F-15, #27; bản 3.4 #92: chạy trên "Meta giả" — meta-gia.js).
 *
 * Cùng hợp đồng với Facebook thật (giao-dien.js). Mọi luật (24 giờ, nhắn riêng 1 lần / 7 ngày, giới hạn thẻ, Page bị hạn
 * chế, mẫu Utility…) nằm ở MetaGia — bản này chỉ là lớp vỏ: gửi đi dựng tin bằng `dung-tin` như bản thật, lỗi Meta đổi
 * qua đúng `graph.doiLoi`, sự kiện vào đi qua đúng `su-kien.tuWebhook` và bình luận live qua `binhLuanTuGraph` (L1 ở
 * docs/07: trước đây bản giả phát sẵn sự kiện dạng MOZA, bỏ qua bộ đọc webhook, và kèm cả tên người — Facebook thật không có).
 * KHÔNG có đoạn mã nào gọi ra mạng: tin gửi ra trong diễn tập không bao giờ tới Facebook thật.
 */

const { EventEmitter } = require('node:events');
const { kiemHopDong } = require('./giao-dien');
const { MetaGia, LoiMeta, TINH_HUONG } = require('./meta-gia');
const { dungTin } = require('./dung-tin');
const { tuWebhook } = require('./su-kien');
const { doiLoi, LoiFacebook } = require('./graph');
const { binhLuanTuGraph, liveTuGraph } = require('./that');
const MAU_UTILITY = require('../cau-hinh/mau-utility.json');
const { LoiNghiepVu } = require('../nghiep-vu/chung');

// Hai Page giả để thử nhiều Fanpage cùng lúc (#37).
const PAGE_GIA = [
  { id: 'page_gia', ten: 'Shop thời trang (giả)', username: 'shopthoitranggia' },
  { id: 'page_gia_2', ten: 'Shop thời trang chi nhánh 2 (giả)', username: 'shopthoitranggia2' },
];

/** Thành phần mẫu Utility theo dạng message_templates của Meta. */
function thanhPhanMau(noiDung, nut = []) {
  const c = [{ type: 'BODY', text: noiDung }];
  if (nut.length) c.push({ type: 'BUTTONS', buttons: nut.map((b) => ({ type: 'POSTBACK', text: b.tieu_de, payload: b.payload })) });
  return c;
}

class FacebookGia extends EventEmitter {
  /**
   * @param {object} [o]
   * @param {string} [o.tinhHuong]   tình huống Facebook (meta-gia.js TINH_HUONG); mặc định "Thận trọng"
   * @param {number|[number,number]} [o.treMs]  độ trễ giả của sự kiện vào (Phòng diễn tập 200–800 ms; test 0)
   */
  constructor({ tinhHuong = 'than_trong', treMs = 0 } = {}) {
    super();
    this.setMaxListeners(50);
    this.ten = 'gia';
    this.chuKyTimLiveMs = 1000;
    this.treMs = treMs;
    this.luongHong = false;
    this.hongGui = false; // Phòng diễn tập: giả mất mạng khi gửi (F-25)
    this.meta = new MetaGia({ tinhHuong, pages: PAGE_GIA });
    // Như chủ shop đã bấm "Tạo bộ mẫu tin" từ trước: bộ mẫu Utility của MOZA có sẵn, đã duyệt.
    for (const p of PAGE_GIA) {
      for (const m of Object.values(MAU_UTILITY).filter((x) => x?.ten)) {
        this.meta.taoMau(p.id, { name: m.ten, category: 'UTILITY', components: thanhPhanMau(m.noi_dung, m.nut) });
        this.meta.duyetNgay(p.id, m.ten);
      }
    }
    this.meta.on('webhook', (body) => this.tre(() => { for (const ev of tuWebhook(body)) this.emit('su_kien', ev); }));
    this.meta.on('chat', (e) => this.emit('chat', e));
    this.meta.on('thay_doi', () => this.emit('thay_doi', this.trangThai()));
    this.meta.on('binh_luan_live', ({ liveId, raw }) => {
      const l = this.meta.lives.get(liveId);
      const bl = binhLuanTuGraph(raw, liveId, l?.page_id);
      this.tre(() => this.emit('binh_luan', bl));
    });
    kiemHopDong(this);
  }

  /** Độ trễ giả (docs/07 mục 2): test để 0 cho nhanh, Phòng diễn tập như mạng thật. */
  tre(fn) {
    const [a, b] = [].concat(this.treMs);
    const ms = b ? a + Math.random() * (b - a) : a || 0;
    if (ms > 0) setTimeout(fn, ms);
    else fn();
  }

  /** Gọi Meta giả: lỗi dạng Meta → lỗi MOZA qua đúng bảng đổi lỗi của bản thật; mất mạng giả → FB_MAT_MANG. */
  goi(fn) {
    if (this.hongGui) throw new LoiFacebook('FB_MAT_MANG', 'Facebook giả: mất mạng giữa lúc gửi', { http: 503 });
    try {
      return fn();
    } catch (e) {
      if (e instanceof LoiMeta) throw doiLoi(e.error);
      throw e;
    }
  }

  /* ---------------- trạng thái, tình huống, đồng hồ ---------------- */

  get pages() { return PAGE_GIA; }

  get chat() { return this.meta.chat; }

  get tenNguoi() { return this.meta.tenNguoi; }

  get daAn() { return this.meta.daAn; }

  get traLoi() { return this.meta.traLoi; }

  /** Bình luận đã dùng lượt nhắn riêng (Phòng diễn tập hiện "lượt nhắn riêng: đã dùng"). */
  get daNhanRieng() { return new Set([...this.meta.binhLuan.values()].filter((b) => b.da_nhan_rieng).map((b) => b.id)); }

  get cacLive() {
    return this.meta.livesDangPhat().map((l) => liveTuGraph(this.meta.timLive(l.page_id).find((x) => x.id === l.id), l.page_id, ''));
  }

  get live() { return this.cacLive[0] || null; }

  datTinhHuong(ten) {
    if (!TINH_HUONG[ten]) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không có tình huống Facebook này.');
    this.meta.datTinhHuong(ten);
    return this.trangThai();
  }

  /** Tua đồng hồ Meta giả cùng lúc với dữ liệu diễn tập (L15). */
  tua(gio) { this.meta.tua(Number(gio) * 3600e3); }

  trangThai() {
    return { dang_phat: this.cacLive.length > 0, live: this.live, so_live: this.cacLive.length, luong_hong: this.luongHong,
      tinh_huong: { id: this.meta.tinhHuongTen, ten: this.meta.th.ten }, cam_nhan: [...this.meta.pages.values()].some((p) => p.camNhan) };
  }

  /* ---------------- live giả ---------------- */

  batDauLive(tieuDe = 'Live bán hàng (giả)') {
    if (this.cacLive.length) throw new LoiNghiepVu('LIVE_GIA_DANG_PHAT', 'Live giả đang phát rồi.', 409);
    return this.themLive(tieuDe);
  }

  /** Thử trường hợp Page có 2 live cùng lúc (F-19): MOZA phải hỏi chọn live nào. */
  batDauLiveThuHai(tieuDe = 'Live thứ hai (giả)') {
    if (!this.cacLive.length) throw new LoiNghiepVu('KHONG_CO_LIVE_GIA', 'Bấm "Bắt đầu live giả" trước.', 409);
    if (this.cacLive.length >= 2) throw new LoiNghiepVu('LIVE_GIA_DANG_PHAT', 'Đã có 2 live giả.', 409);
    return this.themLive(tieuDe);
  }

  themLive(tieuDe) {
    const l = this.meta.batDauLive(PAGE_GIA[0].id, tieuDe || 'Live bán hàng (giả)');
    return this.cacLive.find((x) => x.id === l.id);
  }

  /** Kết thúc mọi live giả (hoặc một live theo id). Video xem lại vẫn còn (H12). */
  ketThucLive(id = null) {
    if (!this.cacLive.length) throw new LoiNghiepVu('KHONG_CO_LIVE_GIA', 'Chưa có live giả nào đang phát.', 409);
    for (const l of this.cacLive) if (!id || l.id === id) this.meta.ketThucLive(l.id);
  }

  /**
   * Người xem giả bình luận (vào live đầu tiên). Người cùng tên là cùng một người. `an_danh`: bình luận không có người gửi
   * (H22); `la_page`: chính Page bình luận (câu ghim — H13).
   */
  themBinhLuan({ ten, noi_dung: noiDung, live_id: liveId = null, an_danh: anDanh = false, la_page: laPage = false }) {
    const l = liveId ? this.cacLive.find((x) => x.id === liveId) : this.live;
    if (!l) throw new LoiNghiepVu('KHONG_CO_LIVE_GIA', 'Bấm "Bắt đầu live giả" trước khi gửi bình luận.', 409);
    const nd = String(noiDung || '').slice(0, 2000);
    if (!nd.trim()) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Bình luận trống.');
    const tenSach = String(ten || 'Người xem').trim().slice(0, 100) || 'Người xem';
    const b = this.meta.binhLuanLive({ liveId: l.id, ten: tenSach, noiDung: nd, anDanh, laPage });
    // Số người xem giả tăng theo người bình luận (H11).
    const khac = new Set([...this.meta.binhLuan.values()].filter((x) => x.live_id === l.id && x.from).map((x) => x.from.id)).size;
    const ml = this.meta.lives.get(l.id);
    this.meta.datNguoiXem(l.id, Math.max(ml.nguoi_xem, khac * 4 + 3));
    return binhLuanTuGraph(this.meta.bangGraph(b), l.id, l.page_id);
  }

  /** F-116: kịch bản diễn tập đặt số người xem của live giả (người xem tụt). */
  datNguoiXem(n) {
    if (!this.live) throw new LoiNghiepVu('KHONG_CO_LIVE_GIA', 'Bấm "Bắt đầu live giả" trước.', 409);
    this.meta.datNguoiXem(this.live.id, n);
  }

  async timLiveDangPhat() {
    return this.cacLive.map((l) => ({ ...l }));
  }

  /**
   * Luồng bình luận trực tiếp. Luồng hỏng thì gọi `khiLoi` một lần và tự đóng (như mất kết nối tới streaming-graph của
   * Facebook thật); phòng live chuyển sang hỏi định kỳ bằng docBinhLuan.
   */
  moLuongBinhLuan(liveId, fn, khiLoi = () => {}) {
    let dong = false;
    const nghe = (bl) => { if (!dong && bl.live_id === liveId) fn(bl); };
    const hong = () => {
      if (dong) return;
      dongLuong();
      khiLoi(new Error('Luồng bình luận trực tiếp bị ngắt'));
    };
    const dongLuong = () => {
      dong = true;
      this.off('binh_luan', nghe);
      this.off('luong_hong', hong);
    };
    if (this.luongHong) {
      setImmediate(hong);
      return { dong: dongLuong };
    }
    this.on('binh_luan', nghe);
    this.on('luong_hong', hong);
    return { dong: dongLuong };
  }

  /** Đường lùi khi luồng hỏng (F-20): bình luận của một live sau thời điểm `sauLuc`. */
  async docBinhLuan(liveId, sauLuc = null) {
    const l = this.meta.lives.get(liveId);
    const ds = this.meta.docBinhLuan(liveId).map((c) => binhLuanTuGraph(c, liveId, l?.page_id));
    // >= : hai bình luận cùng mili giây vẫn đọc đủ; phòng live bỏ bình luận trùng theo id.
    return sauLuc ? ds.filter((b) => b.luc >= sauLuc) : ds;
  }

  /** F-94: bình luận trên video xem lại (bình luận sau khi live xong vẫn về). */
  async docBinhLuanVideo({ page_id: pageId, video_id: videoId, sau_luc: sauLuc = null }) {
    return this.goi(() => {
      const ds = this.meta.docBinhLuanVideo(videoId).map((c) => binhLuanTuGraph(c, null, pageId));
      return sauLuc ? ds.filter((b) => b.luc > sauLuc) : ds;
    });
  }

  /** F-94: Page bình luận lên video (mục lục sau live). */
  async dangBinhLuan({ video_id: videoId, noi_dung: noiDung }) {
    return this.goi(() => this.meta.dangBinhLuanVideo(videoId, noiDung));
  }

  /** Phòng diễn tập: người xem giả bình luận trên video xem lại của live giả vừa kết thúc (`lui_gio`: bình luận cũ). */
  themBinhLuanXemLai({ ten, noi_dung: noiDung, lui_gio: luiGio = 0 }) {
    const nd = String(noiDung || '').slice(0, 2000);
    if (!nd.trim()) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Bình luận trống.');
    try {
      return this.meta.binhLuanXemLai({ ten: String(ten || 'Người xem').trim().slice(0, 100) || 'Người xem', noiDung: nd, luiMs: Number(luiGio) * 3600e3 || 0 });
    } catch (e) {
      throw new LoiNghiepVu('CHUA_CO_VIDEO_XEM_LAI', 'Kết thúc live giả trước, rồi mới bình luận trên video xem lại.', 409);
    }
  }

  datLuongHong(hong) {
    this.luongHong = !!hong;
    if (this.luongHong) this.emit('luong_hong');
    this.emit('thay_doi', this.trangThai());
    return this.trangThai();
  }

  async anBinhLuan(id) {
    return this.goi(() => this.meta.an(id)).success !== false;
  }

  /* ---------------- Hộp thư giả ---------------- */

  psidCua(pageId, ten) { return this.meta.psidCua(pageId, ten); }

  luongChat(pageId, psid) { return this.meta.luongChat(pageId, psid); }

  kiemPage(pageId) {
    if (!PAGE_GIA.some((p) => p.id === pageId)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không có Page giả này.');
  }

  /** Khách giả nhắn Page giả (có thể kèm ảnh đã tải vào khu tạm — F-63). */
  khachNhan({ page_id: pageId = PAGE_GIA[0].id, ten, psid = null, noi_dung: noiDung, anh = null }) {
    this.kiemPage(pageId);
    const tenSach = String(ten || this.meta.tenNguoi.get(psid) || 'Khách').trim().slice(0, 100) || 'Khách';
    const chu = String(noiDung || '').slice(0, 2000);
    if (!chu.trim() && !anh) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Tin nhắn trống.');
    const body = this.meta.nhan({ pageId, ten: tenSach, psid, noiDung: chu, anh: anh ? `tam:${anh}` : null });
    return tuWebhook(body)[0];
  }

  /** Khách chạm một nút trả lời nhanh (H05): tin nhắn có quick_reply.payload. */
  khachChamNhanh({ page_id: pageId = PAGE_GIA[0].id, psid, payload, tieu_de: tieuDe }) {
    this.kiemPage(pageId);
    if (!psid || !payload) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu người chạm hoặc nút.');
    const body = this.meta.nhan({ pageId, psid, noiDung: String(tieuDe || payload).slice(0, 100), quickReply: payload });
    return tuWebhook(body)[0];
  }

  /** Người giả bình luận dưới bài đăng giả của Page. */
  khachBinhLuanBai({ page_id: pageId = PAGE_GIA[0].id, ten, noi_dung: noiDung, post_id: postId = null }) {
    this.kiemPage(pageId);
    const tenSach = String(ten || 'Người xem').trim().slice(0, 100) || 'Người xem';
    const b = this.meta.binhLuanBai({ pageId, ten: tenSach, noiDung: String(noiDung || '').slice(0, 2000), postId });
    return tuWebhook({ object: 'page', entry: [{ id: pageId, changes: [{ field: 'feed', value: this.meta.giaTriBinhLuan(b) }] }] })[0];
  }

  /** Khách giả bấm một nút (thẻ, ô trong hàng thẻ, mẫu Utility) → postback như webhook thật. Trả lời nhanh cũng bấm được. */
  khachBam({ page_id: pageId = PAGE_GIA[0].id, psid, payload, tieu_de: tieuDe }) {
    this.kiemPage(pageId);
    if (!psid || !payload) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu người bấm hoặc nút.');
    const cuoi = [...this.luongChat(pageId, psid)].reverse().find((t) => t.tu === 'page' && t.nut?.some((n) => n.payload === payload));
    const n = cuoi?.nut.find((x) => x.payload === payload);
    if (n?.loai === 'nhanh') return this.khachChamNhanh({ page_id: pageId, psid, payload, tieu_de: tieuDe || n.tieu_de });
    return tuWebhook(this.meta.bam({ pageId, psid, payload, tieuDe }))[0];
  }

  /** Khách vào từ link m.me?ref= (H19) — người mới bấm Bắt đầu, người cũ ra sự kiện giới thiệu. */
  khachVaoTuLink({ page_id: pageId = PAGE_GIA[0].id, ten, ref, mat_ref: matRef = false }) {
    this.kiemPage(pageId);
    const kq = this.meta.moLinkMme({ pageId, ten: String(ten || 'Khách').trim(), ref, matRef });
    return { ...kq, su_kien: kq.body ? tuWebhook(kq.body)[0] : null };
  }

  /** Khách mở mục Tin nhắn chờ (H07). */
  khachMoTinCho({ page_id: pageId = PAGE_GIA[0].id, psid }) {
    this.meta.moTinCho(pageId, psid);
  }

  guiTheSp({ page_id: pageId, psid, the }) {
    return this.goi(() => {
      const r = this.meta.gui(pageId, { recipient: { id: psid }, messaging_type: 'RESPONSE', message: dungTin(the) });
      return { mid: r.message_id, psid: r.recipient_id };
    });
  }

  async guiTinNhan({ page_id: pageId, psid, noi_dung: noiDung }) {
    return this.guiTheSp({ page_id: pageId, psid, the: { kieu: 'chu', chu: String(noiDung) } });
  }

  /** Chữ + trả lời nhanh (F-65). */
  async guiLuaChon({ page_id: pageId, psid, chu, lua_chon: luaChon }) {
    return this.guiTheSp({ page_id: pageId, psid, the: { kieu: 'chu', chu, tra_loi_nhanh: luaChon } });
  }

  async guiAnh({ page_id: pageId, psid, anh, ten = 'anh.jpg' }) {
    return this.goi(() => ({ mid: this.meta.guiTep(pageId, psid, { ten, co: anh?.length || 0 }).message_id }));
  }

  /** Thẻ có nút (#89): chữ + tối đa 3 nút. */
  async guiThe({ page_id: pageId, psid, noi_dung: noiDung, nut }) {
    return this.guiTheSp({ page_id: pageId, psid, the: { kieu: 'nut', chu: String(noiDung), nut } });
  }

  async guiUtility({ page_id: pageId, psid, ten, tham_so: thamSo = [], ngon_ngu: ngonNgu = 'vi' }) {
    return this.goi(() => {
      const r = this.meta.gui(pageId, { recipient: { id: psid }, messaging_type: 'UTILITY',
        message: { template: { name: ten, language: { code: ngonNgu }, components: [{ type: 'body', parameters: thamSo.map((t) => ({ type: 'text', text: String(t) })) }] } } });
      return { mid: r.message_id };
    });
  }

  async taoMauUtility({ page_id: pageId, ten, noi_dung: noiDung, nut = [] }) {
    return this.goi(() => {
      // F-98: Phòng diễn tập / test đặt kết quả từng mẫu (ketQuaMau[ten] = 'MARKETING' | 'REJECTED').
      const kqMau = (this.ketQuaMau || {})[ten];
      const r = this.meta.taoMau(pageId, { name: ten, category: 'UTILITY', components: thanhPhanMau(noiDung, nut) }, { xepMarketing: !!this.xepMarketing || kqMau === 'MARKETING', tuChoi: kqMau === 'REJECTED' });
      return { id: r.id, trang_thai: r.status, loai: r.category };
    });
  }

  async trangThaiMau({ page_id: pageId, ten }) {
    return this.goi(() => {
      const m = this.meta.docMau(pageId, ten)[0];
      return m ? { trang_thai: m.status, loai: m.category } : null;
    });
  }

  async taiAnhLen({ page_id: pageId, anh = null, ten = 'anh.jpg', url = null }) {
    return this.goi(() => this.meta.taiLen(pageId, url ? { url } : { tep: ten || (anh ? 'anh' : null), du_lieu: anh }));
  }

  async datHoSoMessenger({ page_id: pageId, ho_so: hoSo }) {
    return this.goi(() => this.meta.datHoSo(pageId, hoSo));
  }

  /** Page Integrity (F-73): Page có đang bị hạn chế nhắn tin không. */
  async kiemHanChePage({ page_id: pageId }) {
    return this.goi(() => docHanChe(this.meta.trangThaiPage(pageId)));
  }

  async traLoiBinhLuan({ comment_id: id, noi_dung: noiDung }) {
    return this.goi(() => this.meta.traLoiBinhLuan(id, noiDung));
  }

  async coTheNhanRieng({ comment_id: id }) {
    try { return this.meta.xemBinhLuan(id).can_reply_privately; } catch { return false; }
  }

  /** Nhắn riêng bằng thẻ (F-65): luôn hỏi `can_reply_privately` trước. */
  async nhanRiengThe({ page_id: pageId, comment_id: id, the }) {
    if (!(await this.coTheNhanRieng({ comment_id: id }))) {
      throw new LoiFacebook('FB_KHONG_NHAN_RIENG_DUOC', 'Bình luận này không nhắn riêng được (Facebook báo can_reply_privately = false).', { http: 409 });
    }
    return this.goi(() => {
      const r = this.meta.gui(pageId, { recipient: { comment_id: id }, message: dungTin(the) });
      return { mid: r.message_id, psid: r.recipient_id };
    });
  }

  async nhanRieng({ page_id: pageId, comment_id: id, noi_dung: noiDung }) {
    return this.goi(() => {
      const r = this.meta.gui(pageId, { recipient: { comment_id: id }, message: dungTin({ kieu: 'chu', chu: String(noiDung) }) });
      return { mid: r.message_id, psid: r.recipient_id };
    });
  }

  async layTenNguoi({ psid }) {
    return this.meta.tenNguoi.get(psid) || '';
  }

  /** Lưới an toàn: bản giả không mất webhook nên không có gì thêm. */
  async docTinMoi() {
    return [];
  }

  /** Cho Phòng diễn tập: các khung chat giả kèm hộp (Tin nhắn chờ), cửa sổ 24 giờ còn bao lâu. */
  dsChat() {
    return [...this.meta.chat.entries()].map(([k, tin]) => {
      const [pageId, psid] = k.split('|');
      return { page_id: pageId, psid, ten: this.meta.tenNguoi.get(psid) || 'Người bình luận', tin: tin.slice(-50), ...this.meta.tinhTrang(pageId, psid) };
    });
  }
}

/** Kết quả Page Integrity (GET /{page}/page_status) → { bi_han_che, ly_do } — dùng chung cho bản thật. */
function docHanChe(j) {
  const r = (j?.restrictions || []).find((x) => ['page_messaging', 'page_messaging_api'].includes(x.feature) && x.status === 'RESTRICTED');
  const khoa = !!r || ['restricted', 'suspended'].includes(j?.status);
  return { bi_han_che: khoa, ly_do: khoa ? (j?.violations?.[0]?.description || 'Meta đang hạn chế Page nhắn tin') : null, trang_thai: j?.status || null };
}

module.exports = { FacebookGia, PAGE_GIA, docHanChe, thanhPhanMau };
