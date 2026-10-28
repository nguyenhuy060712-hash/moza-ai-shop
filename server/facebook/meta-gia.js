'use strict';

/**
 * "Meta giả" (SPEC.md F-15 mở rộng, #92; thiết kế docs/07 mục 2 cách B): bộ trạng thái + bộ luật của Facebook / Messenger,
 * có đồng hồ tua được. Dùng chung cho hai lối vào:
 *   - `gia.js` (FacebookGia): Phòng diễn tập và test nghiệp vụ gọi thẳng các hàm ở đây;
 *   - `fetchMetaGia` (test/ho-tro-fb.js): chạy CHÍNH `that.js` + `graph.js` + `nhip-goi.js` trên cùng bộ luật này.
 * Sự kiện vào (khách nhắn, bấm nút, bình luận bài) được dựng thành THÂN WEBHOOK THÔ `{object:'page', entry:[…]}` rồi
 * phát ra — nơi nhận đọc bằng đúng `su-kien.tuWebhook` như với Facebook thật. Tin gửi ra phải là `message` đúng dạng
 * Send API và qua `dung-tin.kiemThe` (giới hạn thẻ). Lỗi ném đúng dạng lỗi Graph `{code, error_subcode, message}`.
 *
 * Luật (nguồn, ngày tra, mức kiểm chứng: hanh-vi-meta.json; điều chưa rõ thì chọn trường hợp XẤU):
 *   H01 nhắn riêng: 1 tin mỗi bình luận, trong 7 ngày, `can_reply_privately`; vi phạm → 100/2534025.
 *   H02 tin thứ hai trước khi khách trả lời → 10/2018278 (tình huống "Thận trọng").
 *   H03 cửa sổ 24 giờ mở khi khách nhắn, bấm nút, chạm trả lời nhanh, mở link m.me.
 *   H07 Tin nhắn chờ: người mới nhận tin riêng có thể nằm ở hộp chờ (không thấy cho tới khi mở).
 *   H08 khách chặn Page → 551/1545041.  H15 Page bị hạn chế nhắn tin → 10/1893063.  H16 ứng dụng chưa duyệt → 10/2018028.
 *   H17 mẫu Utility phải APPROVED + UTILITY, cần quyền page_utility_messaging.  H18 menu cần nút Bắt đầu.
 *   H25 trợ lý AI của Facebook bật → tin khách về kênh standby.  H26 gửi tin lỗi 10/2018300 (ứng dụng khác giữ hội thoại).
 * Không có đoạn mã nào gọi ra mạng.
 */

const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { kiemThe, docTin, chuCuaThe, nutCuaThe } = require('./dung-tin');

const NGAY_MS = 24 * 3600e3;
const QUYEN_DU = ['pages_messaging', 'pages_read_engagement', 'pages_manage_engagement', 'pages_read_user_content', 'pages_manage_metadata',
  'pages_show_list', 'page_utility_messaging'];

class LoiMeta extends Error {
  constructor(code, sub, message) {
    super(message);
    this.error = { message, type: 'OAuthException', code, ...(sub ? { error_subcode: sub } : {}), fbtrace_id: 'metagia' };
  }
}

/**
 * Tình huống Facebook của Phòng diễn tập (docs/07 mục 4.2). "de" chỉ dùng cho test cũ không liên quan tới luật Meta.
 * nhanRiengLive: nhắn riêng bình luận live được · tinCho: tỷ lệ người mới vào Tin nhắn chờ · tinThuHai: cho gửi tin thứ 2
 * trước khi khách trả lời · haiDuong: bình luận live về cả luồng live lẫn webhook bài đăng · duyetMauMs: mẫu Utility duyệt sau.
 */
const TINH_HUONG = {
  than_trong: { ten: 'Như tài liệu Meta, thận trọng', nhanRiengLive: true, tinCho: 0.5, tinThuHai: false, haiDuong: true, duyetMauMs: 3000, luat24h: true },
  xau_nhat: { ten: 'Xấu nhất', nhanRiengLive: false, tinCho: 1, tinThuHai: false, haiDuong: true, duyetMauMs: 3000, luat24h: true, anhUrlChet: true },
  han_che: { ten: 'Page bị hạn chế', nhanRiengLive: true, tinCho: 0.5, tinThuHai: false, haiDuong: true, duyetMauMs: 3000, luat24h: true, camNhan: true },
  chua_duyet: { ten: 'Ứng dụng chưa duyệt', nhanRiengLive: true, tinCho: 0.5, tinThuHai: false, haiDuong: true, duyetMauMs: 3000, luat24h: true, chuaDuyet: true },
  hon_loan: { ten: 'Hỗn loạn nhẹ', nhanRiengLive: true, tinCho: 0.5, tinThuHai: false, haiDuong: true, duyetMauMs: 3000, luat24h: true, loiNgauNhien: 0.05, chanNgauNhien: 0.05 },
  de: { ten: 'Dễ tính (chỉ cho test cũ)', nhanRiengLive: true, tinCho: 0, tinThuHai: true, haiDuong: false, duyetMauMs: 0, luat24h: false },
};

/** Số giả 0..1 cố định theo chuỗi — "ngẫu nhiên" mà chạy lại ra cùng kết quả (test được). */
function ngauTheo(s) {
  return crypto.createHash('sha256').update(String(s)).digest().readUInt32BE(0) / 2 ** 32;
}

const iso = (ms) => new Date(ms).toISOString();

class MetaGia extends EventEmitter {
  /**
   * @param {object} [o]
   * @param {string} [o.tinhHuong]
   * @param {{id:string, ten:string, username?:string}[]} [o.pages]
   */
  constructor({ tinhHuong = 'than_trong', pages = [] } = {}) {
    super();
    this.setMaxListeners(50);
    this.pages = new Map();
    this.lives = new Map();
    this.binhLuan = new Map();
    this.nguoi = new Map(); // "page|psid" → người nhắn
    this.chat = new Map(); // "page|psid" → [tin] (dạng khung chat giả)
    this.tenNguoi = new Map(); // psid → tên
    this.dinhKem = new Map(); // attachment_id → { page_id, tep, du_lieu? }
    this.daAn = new Set();
    this.traLoi = [];
    this.soGoi = 0;
    this.mucDung = 0; // % mức dùng trả trong header (test dồn tải)
    this.epLoi = []; // [{ lan, code, sub }] ép lỗi ở lần gọi gửi thứ N
    this.dem = 0;
    this.datTinhHuong(tinhHuong);
    for (const p of pages) this.themPage(p);
  }

  /* ---------------- cấu hình ---------------- */

  datTinhHuong(ten) {
    if (!TINH_HUONG[ten]) throw new Error(`Không có tình huống ${ten}`);
    this.tinhHuongTen = ten;
    this.th = { ...TINH_HUONG[ten] };
    for (const p of this.pages.values()) { p.camNhan = !!this.th.camNhan; p.hanChe = !!this.th.camNhan; p.chuaDuyet = !!this.th.chuaDuyet; }
    this.emit('thay_doi');
    return this.th;
  }

  themPage({ id, ten, username = null }) {
    const p = { id: String(id), ten, username: username || String(id), quyen: new Set(QUYEN_DU), camNhan: !!this.th.camNhan, hanChe: !!this.th.camNhan,
      chuaDuyet: !!this.th.chuaDuyet, nguoiThu: new Set(), hoSo: {}, mau: new Map() };
    this.pages.set(p.id, p);
    return p;
  }

  page(id) {
    const p = this.pages.get(String(id));
    if (!p) throw new LoiMeta(100, 33, `Unsupported request - Object with ID '${id}' does not exist`);
    return p;
  }

  bayGio() {
    return Date.now();
  }

  /** Tua thời gian: lùi mọi mốc trong bộ nhớ `ms` (khớp với tua dữ liệu diễn tập của MOZA — L15). */
  tua(ms) {
    for (const l of this.lives.values()) l.tao_ms -= ms;
    for (const b of this.binhLuan.values()) b.tao_ms -= ms;
    for (const n of this.nguoi.values()) if (n.cua_so_ms) n.cua_so_ms -= ms;
    for (const p of this.pages.values()) for (const m of p.mau.values()) m.tao_ms -= ms;
    for (const ds of this.chat.values()) for (const t of ds) t.luc = iso(new Date(t.luc).getTime() - ms);
    this.emit('thay_doi');
  }

  maMoi(tien) {
    this.dem += 1;
    return `${tien}_${Date.now().toString(36)}${this.dem.toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  }

  /* ---------------- người ---------------- */

  // Mã giả theo tên (người cùng tên là cùng một người) — băm để tên dài giống nhau phần đầu không bị trùng mã.
  psidCua(pageId, ten) {
    return `psidgia_${pageId}_${crypto.createHash('sha1').update(String(ten)).digest('hex').slice(0, 16)}`;
  }

  nguoiIdCua(ten) {
    return `nguoigia_${crypto.createHash('sha1').update(String(ten)).digest('hex').slice(0, 16)}`;
  }

  layNguoiNhan(pageId, psid, ten = null) {
    const k = `${pageId}|${psid}`;
    let n = this.nguoi.get(k);
    if (!n) {
      n = { page_id: String(pageId), psid, ten: ten || this.tenNguoi.get(psid) || 'Khách', cua_so_ms: 0, hop: null, chan: false };
      if (this.th.chanNgauNhien && ngauTheo(`chan${psid}`) < this.th.chanNgauNhien) n.chan = true;
      this.nguoi.set(k, n);
    }
    if (ten) { n.ten = ten; this.tenNguoi.set(psid, ten); }
    return n;
  }

  /** Người đã từng tương tác với Page. Tình huống "de" (test cũ) thì người lạ cũng coi như có. */
  timNguoi(pageId, psid) {
    const n = this.nguoi.get(`${pageId}|${psid}`);
    if (n || this.th.luat24h || !psid) return n || null;
    return this.layNguoiNhan(pageId, psid);
  }

  luongChat(pageId, psid) {
    const k = `${pageId}|${psid}`;
    if (!this.chat.has(k)) this.chat.set(k, []);
    return this.chat.get(k);
  }

  /** Người này đang ở hộp nào: tin đầu tới người mới thì theo tỷ lệ Tin nhắn chờ; đã có hội thoại thì hộp chính. */
  xepHop(n) {
    if (n.hop) return n.hop;
    n.hop = ngauTheo(`hop${n.psid}`) < this.th.tinCho ? 'cho' : 'chinh';
    return n.hop;
  }

  /* ---------------- live, bình luận ---------------- */

  batDauLive(pageId, tieuDe, { truocGiay = 15 } = {}) {
    const p = this.page(pageId);
    // H10: giờ Facebook ghi lúc tạo live sớm hơn lúc MOZA thấy (10–30 giây).
    const l = { id: this.maMoi('livegia'), video_id: this.maMoi('videogia'), page_id: p.id, tieu_de: String(tieuDe).slice(0, 120),
      tao_ms: this.bayGio() - truocGiay * 1000, trang_thai: 'LIVE', nguoi_xem: 0 };
    l.link = `https://www.facebook.com/${p.username}/videos/${l.video_id}`;
    this.lives.set(l.id, l);
    this.emit('thay_doi');
    return l;
  }

  ketThucLive(id) {
    const l = this.lives.get(id);
    if (l) l.trang_thai = 'VOD'; // H12: live xong thành video xem lại, bình luận còn đó
    this.emit('thay_doi');
  }

  livesDangPhat(pageId = null) {
    return [...this.lives.values()].filter((l) => l.trang_thai === 'LIVE' && (!pageId || l.page_id === String(pageId)));
  }

  /** GET /{page}/live_videos?broadcast_status=["LIVE"] */
  timLive(pageId) {
    this.page(pageId);
    return this.livesDangPhat(pageId).map((l) => ({ id: l.id, title: l.tieu_de, creation_time: iso(l.tao_ms), status: 'LIVE',
      video: { id: l.video_id }, live_views: l.nguoi_xem, permalink_url: l.link }));
  }

  datNguoiXem(liveId, n) {
    const l = this.lives.get(liveId);
    if (l) l.nguoi_xem = Math.max(0, Math.round(n));
  }

  bangGraph(b) {
    return { id: b.id, ...(b.from ? { from: b.from } : {}), message: b.message, created_time: iso(b.tao_ms) };
  }

  /**
   * Người xem bình luận trên live. `anDanh`: không có `from` (H22). `laPage`: chính Page bình luận (câu ghim — H13).
   * Tình huống "haiDuong": bình luận còn về webhook bài đăng với post_id = page_videoId (H09).
   */
  binhLuanLive({ liveId, ten, noiDung, anDanh = false, laPage = false }) {
    const l = this.lives.get(liveId);
    if (!l || l.trang_thai !== 'LIVE') throw new Error('Live không còn phát');
    const p = this.page(l.page_id);
    const from = laPage ? { id: p.id, name: p.ten } : anDanh ? null : { id: this.nguoiIdCua(ten), name: String(ten) };
    const b = { id: this.maMoi('blgia'), page_id: p.id, live_id: l.id, post_id: `${p.id}_${l.video_id}`, from, message: String(noiDung),
      tao_ms: this.bayGio(), da_nhan_rieng: false, nhan_rieng_duoc: this.th.nhanRiengLive };
    this.binhLuan.set(b.id, b);
    this.emit('binh_luan_live', { liveId: l.id, raw: this.bangGraph(b) });
    if (this.th.haiDuong) this.phatWebhook(p.id, { changes: [{ field: 'feed', value: this.giaTriBinhLuan(b) }] });
    return b;
  }

  /**
   * F-94: người xem bình luận trên VIDEO XEM LẠI của live đã xong (`luiMs`: bình luận cũ — thử mốc 7 ngày). Về webhook feed với
   * post_id = {page}_{video_id} (H09) và đọc lại được bằng GET /{video}/comments.
   */
  binhLuanXemLai({ liveId = null, ten, noiDung, luiMs = 0, laPage = false }) {
    const l = liveId ? this.lives.get(liveId) : [...this.lives.values()].filter((x) => x.trang_thai === 'VOD').at(-1);
    if (!l || l.trang_thai !== 'VOD') throw new Error('Chưa có video xem lại (live phải kết thúc trước)');
    const p = this.page(l.page_id);
    const from = laPage ? { id: p.id, name: p.ten } : { id: this.nguoiIdCua(ten), name: String(ten) };
    const b = { id: this.maMoi('blxl'), page_id: p.id, live_id: l.id, post_id: `${p.id}_${l.video_id}`, from, message: String(noiDung),
      tao_ms: this.bayGio() - luiMs, da_nhan_rieng: false, nhan_rieng_duoc: true };
    this.binhLuan.set(b.id, b);
    this.phatWebhook(p.id, { changes: [{ field: 'feed', value: this.giaTriBinhLuan(b) }] });
    return b;
  }

  /** GET /{video}/comments — bình luận của video (live đã xong vẫn đọc được). */
  docBinhLuanVideo(videoId, sauGiay = null) {
    this.demGoi();
    const l = [...this.lives.values()].find((x) => x.video_id === String(videoId) || x.id === String(videoId));
    if (!l) throw new LoiMeta(100, 33, `Object with ID '${videoId}' does not exist`);
    return [...this.binhLuan.values()].filter((b) => b.live_id === l.id && (!sauGiay || b.tao_ms >= sauGiay * 1000))
      .sort((a, b) => a.tao_ms - b.tao_ms).map((b) => this.bangGraph(b));
  }

  /** POST /{video}/comments — Page bình luận (mục lục sau live, F-94). */
  dangBinhLuanVideo(videoId, message) {
    this.demGoi();
    const l = [...this.lives.values()].find((x) => x.video_id === String(videoId) || x.id === String(videoId));
    if (!l) throw new LoiMeta(100, 33, `Object with ID '${videoId}' does not exist`);
    const p = this.page(l.page_id);
    const b = { id: this.maMoi('blpage'), page_id: p.id, live_id: l.id, post_id: `${p.id}_${l.video_id}`, from: { id: p.id, name: p.ten },
      message: String(message), tao_ms: this.bayGio(), da_nhan_rieng: false, nhan_rieng_duoc: false };
    this.binhLuan.set(b.id, b);
    (this.binhLuanPage ||= []).push({ id: b.id, video_id: l.video_id, noi_dung: b.message, luc: iso(b.tao_ms) });
    return { id: b.id };
  }

  /** Bình luận dưới bài đăng thường của Page (webhook feed). */
  binhLuanBai({ pageId, ten, noiDung, postId = null }) {
    const p = this.page(pageId);
    const b = { id: this.maMoi('cmtgia'), page_id: p.id, live_id: null, post_id: postId || `${p.id}_baigia`, from: { id: this.nguoiIdCua(ten), name: String(ten) },
      message: String(noiDung), tao_ms: this.bayGio(), da_nhan_rieng: false, nhan_rieng_duoc: true };
    this.binhLuan.set(b.id, b);
    this.phatWebhook(p.id, { changes: [{ field: 'feed', value: this.giaTriBinhLuan(b) }] });
    return b;
  }

  giaTriBinhLuan(b) {
    return { item: 'comment', verb: 'add', comment_id: b.id, post_id: b.post_id, parent_id: b.post_id, ...(b.from ? { from: b.from } : {}),
      message: b.message, created_time: Math.floor(b.tao_ms / 1000) };
  }

  /** GET /{live}/comments (đường lùi khi luồng hỏng). */
  docBinhLuan(liveId, sauGiay = null) {
    return [...this.binhLuan.values()].filter((b) => b.live_id === liveId && (!sauGiay || b.tao_ms >= sauGiay * 1000))
      .sort((a, b) => a.tao_ms - b.tao_ms).map((b) => this.bangGraph(b));
  }

  /** GET /{comment}?fields=can_reply_privately */
  xemBinhLuan(id) {
    const b = this.binhLuan.get(id);
    if (!b) throw new LoiMeta(100, 33, `Object with ID '${id}' does not exist`);
    const quaHan = this.bayGio() - b.tao_ms > 7 * NGAY_MS;
    return { id: b.id, can_reply_privately: b.nhan_rieng_duoc && !b.da_nhan_rieng && !quaHan };
  }

  an(id) {
    if (!this.binhLuan.has(id)) throw new LoiMeta(100, 33, `Object with ID '${id}' does not exist`);
    this.daAn.add(id);
    return { success: true };
  }

  traLoiBinhLuan(id, message) {
    const b = this.binhLuan.get(id);
    if (!b) throw new LoiMeta(100, 33, `Object with ID '${id}' does not exist`);
    const r = { id: this.maMoi('cmtgia'), tra_loi: id, noi_dung: String(message), luc: iso(this.bayGio()) };
    this.traLoi.push(r);
    return { id: r.id };
  }

  /* ---------------- gửi tin (Send API) ---------------- */

  demGoi() {
    this.soGoi += 1;
    const ep = this.epLoi.find((x) => x.lan === this.soGoi);
    if (ep) throw new LoiMeta(ep.code, ep.sub || null, ep.message || `(#${ep.code}) Forced error`);
    if (this.th.loiNgauNhien && ngauTheo(`loi${this.soGoi}`) < this.th.loiNgauNhien) throw new LoiMeta(2, null, 'Service temporarily unavailable');
  }

  kiemGuiDuoc(p, n) {
    if (p.camNhan) throw new LoiMeta(10, 1893063, 'You are temporarily restricted from sending messages.');
    if (p.chuaDuyet && !p.nguoiThu.has(n.psid)) throw new LoiMeta(10, 2018028, 'Cannot message users who are not admins, developers or testers of the app until pages_messaging permission is reviewed and the app is live.');
    if (n.chan) throw new LoiMeta(551, 1545041, 'This person isn\'t available right now.');
  }

  datNguoiThu(pageId, psid) {
    this.page(pageId).nguoiThu.add(psid);
  }

  ghiRa(pageId, psid, the, them = {}) {
    const mid = this.maMoi('midgia');
    // Ảnh đã tải lên (media template): khung chat giả hiện đúng ảnh (vd mã QR chuyển khoản, F-89).
    const anhTai = the.kieu === 'media' ? this.dinhKem.get(String(the.anh?.attachment_id))?.du_lieu : null;
    const theLuu = anhTai ? { ...the, anh: { ...the.anh, url: anhTai } } : the;
    const t = { tu: 'page', noi_dung: chuCuaThe(the), the: theLuu, nut: nutCuaThe(the), luc: iso(this.bayGio()), mid, ...them };
    this.luongChat(pageId, psid).push(t);
    this.emit('chat', { page_id: String(pageId), psid });
    return mid;
  }

  /**
   * POST /{page}/messages. `body` như Send API: { recipient: {id}|{comment_id}, messaging_type, message }.
   * Mẫu Utility: messaging_type UTILITY, message.template { name, language, components }.
   * @returns {{recipient_id:string, message_id:string}}
   */
  gui(pageId, body) {
    const p = this.page(pageId);
    this.demGoi();
    const r = body?.recipient || {};
    if (p.businessAi) throw new LoiMeta(10, 2018300, '(#10) This message is sent outside of allowed window. Another app is the thread owner (Conversation Routing).');
    if (body?.messaging_type === 'UTILITY') return this.guiMau(p, r, body.message?.template);
    const the = docTin(body?.message);
    if (!the) throw new LoiMeta(100, null, '(#100) Invalid message parameter');
    const loi = kiemThe(the);
    if (loi.length) throw new LoiMeta(100, null, `(#100) ${loi.join('; ')}`);
    if (the.kieu === 'anh' && this.th.anhUrlChet) throw new LoiMeta(100, 2018047, '(#100) Upload attachment failure: could not fetch image_url');
    if (the.kieu === 'media' && !this.dinhKem.has(String(the.anh.attachment_id))) throw new LoiMeta(100, null, '(#100) Invalid attachment_id');

    if (r.comment_id) {
      let b = this.binhLuan.get(String(r.comment_id));
      if (!b && !this.th.luat24h) {
        // Tình huống "de" (test cũ ghi bình luận thẳng vào MOZA): bình luận lạ coi như có, không rõ người gửi.
        b = { id: String(r.comment_id), page_id: p.id, live_id: null, post_id: null, from: null, message: '', tao_ms: this.bayGio(), da_nhan_rieng: false, nhan_rieng_duoc: true };
        this.binhLuan.set(b.id, b);
      }
      // H01: chỉ một tin, trong 7 ngày, bình luận phải cho nhắn riêng. Mã lỗi duy nhất Meta ghi rõ: 100/2534025.
      if (!b || b.page_id !== p.id || b.da_nhan_rieng || !b.nhan_rieng_duoc || this.bayGio() - b.tao_ms > 7 * NGAY_MS) {
        throw new LoiMeta(100, 2534025, 'The comment is invalid for a private reply.');
      }
      const psid = b.from && b.from.id !== p.id ? this.psidCua(p.id, b.from.name) : `psidgia_${p.id}_bl_${b.id}`;
      const n = this.layNguoiNhan(p.id, psid, b.from?.name || 'Người bình luận');
      this.kiemGuiDuoc(p, n);
      b.da_nhan_rieng = true;
      this.xepHop(n);
      // Bình luận mở cửa sổ 24 giờ? Hai trang tài liệu nói ngược nhau (H02) — "Thận trọng": không mở.
      if (this.th.tinThuHai && !n.cua_so_ms) n.cua_so_ms = this.bayGio();
      const mid = this.ghiRa(p.id, psid, the, { nhan_rieng: b.id });
      return { recipient_id: psid, message_id: mid };
    }
    const psid = String(r.id || '');
    const n = this.timNguoi(p.id, psid);
    if (!n) throw new LoiMeta(100, 2018001, 'No matching user found');
    this.kiemGuiDuoc(p, n);
    if (this.th.luat24h && (!n.cua_so_ms || this.bayGio() - n.cua_so_ms > NGAY_MS)) {
      throw new LoiMeta(10, 2018278, 'This message is sent outside of allowed window.');
    }
    const mid = this.ghiRa(p.id, psid, the);
    return { recipient_id: psid, message_id: mid };
  }

  /** Gửi mẫu Utility (H17): ngoài 24 giờ vẫn được, nhưng mẫu phải APPROVED, loại UTILITY, Page có quyền. */
  guiMau(p, r, tpl) {
    const n = this.timNguoi(p.id, String(r.id || ''));
    if (!n) throw new LoiMeta(100, 2018001, 'No matching user found');
    this.kiemGuiDuoc(p, n);
    if (!p.quyen.has('page_utility_messaging')) throw new LoiMeta(10, null, '(#10) Requires page_utility_messaging permission');
    const m = p.mau.get(String(tpl?.name || ''));
    this.capNhatMau(m);
    if (!m || m.trang_thai !== 'APPROVED' || m.loai !== 'UTILITY') throw new LoiMeta(100, 2388072, '(#100) Template is not approved as UTILITY');
    const thamSo = (tpl.components || []).flatMap((c) => (c.parameters || []).map((x) => x.text));
    let chu = m.noi_dung;
    thamSo.forEach((v, i) => { chu = chu.split(`{{${i + 1}}}`).join(String(v)); });
    const the = m.nut.length ? { kieu: 'nut', chu: chu.slice(0, 640), nut: m.nut } : { kieu: 'chu', chu };
    const mid = this.ghiRa(p.id, n.psid, the, { utility: m.ten });
    return { recipient_id: n.psid, message_id: mid };
  }

  /** Gửi ảnh kèm tệp (POST /{page}/messages multipart filedata — F-56): luật 24 giờ như tin thường. */
  guiTep(pageId, psid, { ten = 'anh.jpg', co = 0 } = {}) {
    const p = this.page(pageId);
    this.demGoi();
    const n = this.timNguoi(p.id, psid);
    if (!n) throw new LoiMeta(100, 2018001, 'No matching user found');
    this.kiemGuiDuoc(p, n);
    if (this.th.luat24h && (!n.cua_so_ms || this.bayGio() - n.cua_so_ms > NGAY_MS)) {
      throw new LoiMeta(10, 2018278, 'This message is sent outside of allowed window.');
    }
    const mid = this.maMoi('midgia');
    this.luongChat(p.id, psid).push({ tu: 'page', noi_dung: `[ảnh ${ten}]`, anh: ten, co, luc: iso(this.bayGio()), mid });
    this.emit('chat', { page_id: p.id, psid });
    return { recipient_id: psid, message_id: mid };
  }

  /** Mẫu đã có sẵn và đã duyệt (Phòng diễn tập giả như chủ shop đã bấm "Tạo bộ mẫu tin" từ trước). */
  duyetNgay(pageId, ten) {
    const m = this.page(pageId).mau.get(ten);
    if (m) { m.trang_thai = m.loai === 'UTILITY' && !m.tu_choi ? 'APPROVED' : 'REJECTED'; m.tao_ms -= 3600e3; }
  }

  /** POST /{page}/message_attachments — ảnh tải lên dùng lại được (H06). */
  taiLen(pageId, { tep = null, url = null, du_lieu: duLieu = null }) {
    const p = this.page(pageId);
    this.demGoi();
    if (url && this.th.anhUrlChet) throw new LoiMeta(100, 2018047, '(#100) Upload attachment failure');
    const id = String(1e15 + this.dinhKem.size + 1);
    // Ảnh nhỏ (≤ 300 KB) giữ dạng data: để khung chat giả vẽ lại được; ảnh lớn chỉ giữ tên.
    const du = duLieu && duLieu.length <= 300 * 1024 ? `data:${/.png$/i.test(tep || '') ? 'image/png' : 'image/jpeg'};base64,${Buffer.from(duLieu).toString('base64')}` : null;
    this.dinhKem.set(id, { page_id: p.id, tep: tep || url, du_lieu: du });
    return { attachment_id: id };
  }

  /* ---------------- mẫu Utility, hồ sơ Messenger, sức khỏe Page ---------------- */

  /** POST /{page}/message_templates (H17): PENDING, vài giây sau APPROVED; `xepMarketing` → Meta xếp MARKETING. */
  taoMau(pageId, { name, category = 'UTILITY', components = [] }, { xepMarketing = false, tuChoi = false } = {}) {
    const p = this.page(pageId);
    const than = components.find((c) => c.type === 'BODY')?.text || '';
    const nut = (components.find((c) => c.type === 'BUTTONS')?.buttons || []).map((b) => ({ tieu_de: b.text, payload: b.payload || b.text }));
    const m = { id: String(2e15 + p.mau.size + 1), ten: String(name), noi_dung: than, nut, loai: xepMarketing ? 'MARKETING' : category,
      trang_thai: 'PENDING', tao_ms: this.bayGio(), tu_choi: !!tuChoi };
    p.mau.set(m.ten, m);
    this.capNhatMau(m);
    return { id: m.id, status: m.trang_thai, category: m.loai };
  }

  capNhatMau(m) {
    if (m && m.trang_thai === 'PENDING' && this.bayGio() - m.tao_ms >= this.th.duyetMauMs) m.trang_thai = m.loai === 'UTILITY' ? 'APPROVED' : 'REJECTED';
  }

  /** GET /{page}/message_templates?name= */
  docMau(pageId, ten) {
    const p = this.page(pageId);
    const ds = [...p.mau.values()].filter((m) => !ten || m.ten === ten);
    for (const m of ds) this.capNhatMau(m);
    return ds.map((m) => ({ id: m.id, name: m.ten, status: m.trang_thai, category: m.loai }));
  }

  /** POST /me/messenger_profile (H18): menu cố định chỉ nhận web_url, postback và phải có nút Bắt đầu. */
  datHoSo(pageId, body) {
    const p = this.page(pageId);
    const moi = { ...p.hoSo, ...body };
    if (moi.persistent_menu) {
      if (!moi.get_started?.payload) throw new LoiMeta(100, 2018145, '(#100) persistent_menu requires get_started to be set');
      for (const m of moi.persistent_menu) {
        for (const b of m.call_to_actions || []) {
          if (!['web_url', 'postback'].includes(b.type)) throw new LoiMeta(100, null, `(#100) persistent_menu does not support ${b.type}`);
        }
      }
    }
    p.hoSo = moi;
    return { result: 'success' };
  }

  /** GET /{page}/page_status (Page Integrity API, tra 27/9/2026). */
  trangThaiPage(pageId) {
    const p = this.page(pageId);
    const khoa = p.hanChe || p.camNhan;
    return {
      status: khoa ? 'restricted' : 'ok',
      restrictions: [{ feature: 'page_messaging', status: khoa ? 'RESTRICTED' : 'UNRESTRICTED', applied_time: khoa ? iso(this.bayGio()) : null }],
      violations: khoa ? [{ type: 'MESSAGING_POLICY', description: 'Page gửi tin vi phạm chính sách nhắn tin (giả lập)' }] : [],
    };
  }

  /** H25, H26 (F-110): bật "trợ lý AI của Facebook" — tin khách về kênh standby, MOZA gửi tin bị 10/2018300. */
  datBusinessAi(pageId, bat) {
    this.page(pageId).businessAi = !!bat;
  }

  datCamNhan(pageId, bat) {
    const p = this.page(pageId);
    p.camNhan = !!bat;
    p.hanChe = !!bat;
    this.emit('thay_doi');
  }

  layNguoi(psid) {
    const ten = this.tenNguoi.get(psid);
    if (!ten) throw new LoiMeta(100, 33, `Object with ID '${psid}' does not exist`);
    const ds = ten.split(/\s+/);
    return { id: psid, name: ten, first_name: ds.at(-1), last_name: ds.slice(0, -1).join(' ') };
  }

  /* ---------------- hành động của khách (webhook thô) ---------------- */

  phatWebhook(pageId, phan) {
    const body = { object: 'page', entry: [{ id: String(pageId), time: this.bayGio(), ...phan }] };
    this.emit('webhook', body);
    return body;
  }

  suKienNhan(pageId, psid) {
    return { sender: { id: psid }, recipient: { id: String(pageId) }, timestamp: this.bayGio() };
  }

  moCuaSo(n) {
    n.cua_so_ms = this.bayGio();
    n.hop = 'chinh'; // khách đã nhắn / bấm → đã thấy hội thoại
  }

  /** Khách nhắn Page (có thể kèm ảnh, hoặc là chạm trả lời nhanh). */
  nhan({ pageId, ten, psid = null, noiDung = '', anh = null, quickReply = null }) {
    const p = this.page(pageId);
    const id = psid || this.psidCua(p.id, ten);
    const n = this.layNguoiNhan(p.id, id, ten || null);
    this.moCuaSo(n);
    const mid = this.maMoi('midgia');
    const message = { mid, ...(noiDung ? { text: String(noiDung) } : {}), ...(quickReply ? { quick_reply: { payload: String(quickReply) } } : {}),
      ...(anh ? { attachments: [{ type: 'image', payload: { url: anh } }] } : {}) };
    this.luongChat(p.id, id).push({ tu: 'khach', noi_dung: noiDung || (anh ? '[hình ảnh]' : ''), luc: iso(this.bayGio()), mid,
      ...(quickReply ? { postback: String(quickReply), nguon: 'tra_loi_nhanh' } : {}) });
    // H25: trợ lý AI của Facebook đang giữ hội thoại → tin về kênh standby, không về messaging.
    const body = this.phatWebhook(p.id, p.businessAi ? { standby: [{ ...this.suKienNhan(p.id, id), message }] } : { messaging: [{ ...this.suKienNhan(p.id, id), message }] });
    this.emit('chat', { page_id: p.id, psid: id });
    return body;
  }

  /** Khách bấm nút (postback), có thể kèm `referral` (người mới bấm Bắt đầu từ link m.me — H19). */
  bam({ pageId, psid, payload, tieuDe = '', referral = null }) {
    const p = this.page(pageId);
    const n = this.layNguoiNhan(p.id, psid);
    this.moCuaSo(n);
    const mid = this.maMoi('pbgia');
    this.luongChat(p.id, psid).push({ tu: 'khach', noi_dung: String(tieuDe || payload).slice(0, 100), postback: String(payload), luc: iso(this.bayGio()), mid });
    const body = this.phatWebhook(p.id, { messaging: [{ ...this.suKienNhan(p.id, psid),
      postback: { mid, title: String(tieuDe || payload).slice(0, 100), payload: String(payload), ...(referral ? { referral } : {}) } }] });
    this.emit('chat', { page_id: p.id, psid });
    return body;
  }

  /** Khách mở link m.me?ref= (H19): người mới → màn Bắt đầu (postback kèm referral); người cũ → messaging_referrals. */
  moLinkMme({ pageId, ten, ref, matRef = false }) {
    const p = this.page(pageId);
    const psid = this.psidCua(p.id, ten);
    const cu = this.nguoi.has(`${p.id}|${psid}`) && this.luongChat(p.id, psid).length > 0;
    const referral = matRef ? null : { ref: String(ref), source: 'SHORTLINK', type: 'OPEN_THREAD' };
    this.layNguoiNhan(p.id, psid, ten);
    if (!cu) {
      const pl = p.hoSo.get_started?.payload || 'BAT_DAU';
      return { nguoiMoi: true, psid, body: this.bam({ pageId: p.id, psid, payload: pl, tieuDe: 'Bắt đầu', referral }) };
    }
    const n = this.layNguoiNhan(p.id, psid);
    this.moCuaSo(n);
    if (!referral) return { nguoiMoi: false, psid, body: null };
    const body = this.phatWebhook(p.id, { messaging: [{ ...this.suKienNhan(p.id, psid), referral }] });
    return { nguoiMoi: false, psid, body };
  }

  /** Khách mở mục Tin nhắn chờ (H07): từ giờ thấy tin (khách giả mới phản ứng được). */
  moTinCho(pageId, psid) {
    const n = this.nguoi.get(`${pageId}|${psid}`);
    if (n) n.hop = 'chinh';
    this.emit('chat', { page_id: String(pageId), psid });
  }

  /** Trạng thái một khung chat cho Messenger giả: hộp, cửa sổ 24 giờ còn bao lâu. */
  tinhTrang(pageId, psid) {
    const n = this.nguoi.get(`${pageId}|${psid}`);
    if (!n) return { hop: null, con_cua_so_phut: 0, chan: false };
    const con = n.cua_so_ms ? Math.max(0, Math.round((n.cua_so_ms + NGAY_MS - this.bayGio()) / 60000)) : 0;
    return { hop: n.hop, con_cua_so_phut: con, chan: n.chan };
  }

  /** Header mức dùng như Facebook thật (X-Page-Usage) — nhịp gọi của MOZA đọc để giãn nhịp (H21). */
  headerMucDung() {
    return { 'x-page-usage': JSON.stringify({ call_count: this.mucDung, total_cputime: 0, total_time: 0 }) };
  }
}

module.exports = { MetaGia, LoiMeta, TINH_HUONG, QUYEN_DU, ngauTheo };
