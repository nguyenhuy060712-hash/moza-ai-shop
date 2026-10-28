'use strict';

/**
 * Kết nối Facebook thật (SPEC.md mục 5 khối "Kết nối Facebook", F-06, F-24; #37 nhiều Fanpage cùng lúc). Điều phối:
 *  - cổng webhook 127.0.0.1:5174 → đường hầm Cloudflare → tự đăng ký địa chỉ với Meta mỗi lần khởi động và mỗi lần
 *    đường hầm mở lại: một lần `/{app-id}/subscriptions` cho cả ứng dụng, rồi `/{page-id}/subscribed_apps` cho TỪNG Page
 *    (Meta tự hủy đăng ký sau 1 giờ webhook lỗi);
 *  - lưới an toàn: 60 giây hỏi từng Page các tin / bình luận mới, từ con trỏ đã lưu;
 *  - mã của một Page hết hạn (lỗi 190) → Page đó đỏ ở mọi màn hình, mọi việc gửi ra từ Page đó dừng (F-06);
 *  - đổi mã người dùng ngắn hạn thành mã Page không hết hạn, chọn được nhiều Page một lần (F-06, #37).
 * Sự kiện (su-kien.js, luôn có `page_id`) phát ra bằng `on('su_kien', fn)`; sự kiện trước mốc kết nối đầu bị bỏ (#5),
 * sự kiện của Page đang tắt cũng bị bỏ.
 */

const { EventEmitter } = require('node:events');
const khoa = require('../khoa');
const moc = require('../nghiep-vu/moc-facebook');
const fbPage = require('../nghiep-vu/fb-page');
const { NhipGoi } = require('./nhip-goi');
const { taoGraph, LoiFacebook } = require('./graph');
const { FacebookThat, FacebookPage } = require('./that');
const { moCongWebhook } = require('./webhook');
const { DuongHam } = require('./duong-ham');
const { tuWebhook } = require('./su-kien');

const TRUONG = ['messages', 'messaging_postbacks', 'messaging_referrals', 'message_echoes', 'feed', 'live_videos'];
const QUYEN_CAN = ['pages_messaging', 'pages_read_engagement', 'pages_manage_engagement', 'pages_read_user_content', 'pages_manage_metadata', 'pages_show_list', 'page_utility_messaging'];
const LUOI_MS = 60000;
const CHONG_LAP_MS = 2 * 60 * 1000; // lưới an toàn đọc chồng 2 phút để không sót; trùng thì bỏ theo fb_id

class KetNoiFacebook extends EventEmitter {
  /**
   * @param {object} [o]
   * @param {number} [o.congWebhook]
   * @param {typeof fetch} [o.fetch]
   * @param {Function} [o.taoDuongHam]  (congDich) => DuongHam — test thay
   * @param {number} [o.luoiMs]
   * @param {(type:string, d?:object)=>void} [o.phat]
   */
  constructor({ congWebhook = Number(process.env.MOZA_CONG_WEBHOOK || 5174), fetch: goiMang = fetch,
    taoDuongHam = (c) => new DuongHam({ congDich: c }), luoiMs = LUOI_MS, phat = () => {} } = {}) {
    super();
    this.congWebhook = congWebhook;
    this.fetch = goiMang;
    this.taoDuongHam = taoDuongHam;
    this.luoiMs = luoiMs;
    this.phat = phat;
    this.nhip = new NhipGoi();
    this.graph = taoGraph({
      layMa: (loai) => (loai === 'app' ? this.maUngDung() : ''),
      layBiMat: () => khoa.layFb('app_secret'),
      nhip: this.nhip,
      fetch: goiMang,
      khiLoi: (e, pageId) => this.khiLoiGraph(e, pageId),
    });
    this.cacPage = new Map(); // page id → FacebookPage (dựng lại khi danh sách đổi)
    this.fb = new FacebookThat({ layPages: () => this.pagesDangChay() });
    this.webhook = null;
    this.duongHam = null;
    this.hen = null;
    this.hetHan = new Set(); // Page có mã hết hạn
    this.tt = { webhook: 'tat', loi: null, dia_chi: null, dang_ky_luc: null, luoi: { lan_cuoi: null, loi: null, so_tin: 0 } };
    this.ganDay = [];
    this.maNguoiDungTam = null; // mã dài hạn khi người dùng quản lý nhiều Page, chờ chọn (5 phút)
  }

  maUngDung() {
    const id = khoa.layFb('app_id');
    const bm = khoa.layFb('app_secret');
    return id && bm ? `${id}|${bm}` : '';
  }

  coUngDung() {
    return !!(khoa.layFb('app_id') && khoa.layFb('app_secret'));
  }

  /** Mọi Page đã có mã (kể cả đang tắt). */
  pageCoMa() {
    return khoa.dsPage().filter((id) => khoa.layMaPage(id));
  }

  pageObj(id) {
    let p = this.cacPage.get(id);
    if (!p) {
      p = new FacebookPage({ graph: this.graph, pageId: id, layMa: () => khoa.layMaPage(id), fetch: this.fetch });
      this.cacPage.set(id, p);
    }
    p.ten = fbPage.lay(id)?.ten || p.ten || '';
    return p;
  }

  /** Page đang bật, còn mã, mã chưa hết hạn — những Page MOZA đọc và gửi. */
  pagesDangChay() {
    if (!this.coUngDung()) return [];
    return this.pageCoMa().filter((id) => fbPage.dangBat(id) && !this.hetHan.has(id)).map((id) => this.pageObj(id));
  }

  coDuMa() {
    return this.coUngDung() && this.pageCoMa().length > 0;
  }

  /** Còn được gửi ra Facebook không; có `pageId` thì xét đúng Page đó (F-06). */
  guiDuoc(pageId = null) {
    const ds = this.pagesDangChay().map((p) => p.pageId);
    return pageId ? ds.includes(String(pageId)) : ds.length > 0;
  }

  khiLoiGraph(e, pageId) {
    if (e.ma === 'FB_MA_HET_HAN' && pageId && !this.hetHan.has(pageId)) {
      this.hetHan.add(pageId);
      this.tt.loi = `Mã của Page ${this.pageObj(pageId).ten || pageId} hết hạn hoặc bị thu hồi.`;
      this.baoThayDoi();
    }
  }

  baoThayDoi() {
    this.phat('ket_noi.trang_thai', this.trangThaiGon());
  }

  /* ---------------- chạy / dừng ---------------- */

  async batDau() {
    if (!this.coDuMa()) {
      this.tt.webhook = 'chua_ket_noi';
      return this.trangThai();
    }
    for (const id of this.pageCoMa()) if (!fbPage.lay(id)) fbPage.luu(id);
    khoa.damBaoVerifyToken();
    moc.mocKetNoiDau();
    if (!this.webhook) {
      try {
        this.webhook = await moCongWebhook({
          cong: this.congWebhook,
          layBiMat: () => khoa.layFb('app_secret'),
          layVerifyToken: () => khoa.layFb('verify_token'),
          khiCoTin: (body) => this.nhanWebhook(body),
          khiTuChoi: (lyDo) => console.error(`  [webhook] từ chối yêu cầu: ${lyDo}`),
          layAnh: (ten) => require('../nghiep-vu/anh-cong-khai').timTep(ten),
        });
      } catch (e) {
        this.tt.webhook = 'loi';
        this.tt.loi = e.code === 'EADDRINUSE' ? `Cổng webhook ${this.congWebhook} đang bị giữ.` : e.message;
        this.baoThayDoi();
      }
    }
    if (this.webhook && !this.duongHam) {
      this.duongHam = this.taoDuongHam(this.webhook.cong);
      this.duongHam.on('san_sang', (url) => this.dangKy(url).catch(() => {}));
      this.duongHam.on('thay_doi', (t) => {
        if (t.trang_thai !== 'san_sang') this.tt.webhook = t.trang_thai === 'chua_cai' ? 'chua_cai' : 'ngat';
        this.baoThayDoi();
      });
      this.duongHam.mo().catch((e) => console.error('  [đường hầm] ' + e.message));
    }
    clearInterval(this.hen);
    this.hen = setInterval(() => this.luoiAnToan().catch(() => {}), this.luoiMs);
    setTimeout(() => this.luoiAnToan().catch(() => {}), 3000).unref?.();
    return this.trangThai();
  }

  async dung() {
    clearInterval(this.hen);
    this.hen = null;
    this.duongHam?.dong();
    this.duongHam = null;
    if (this.webhook) await this.webhook.dong();
    this.webhook = null;
    this.tt.webhook = 'tat';
  }

  /** Mã vừa đổi trong Cài đặt: dừng rồi chạy lại. */
  async khoiDongLai() {
    this.hetHan.clear();
    this.tt.loi = null;
    this.cacPage.clear();
    await this.dung();
    const kq = await this.batDau();
    this.baoThayDoi();
    return kq;
  }

  /* ---------------- đăng ký webhook với Meta ---------------- */

  async dangKy(diaChi = this.tt.dia_chi) {
    if (!diaChi) return false;
    this.tt.webhook = 'dang_ky';
    this.tt.dia_chi = diaChi;
    moc.dat('duong_ham', diaChi);
    this.baoThayDoi();
    const loi = [];
    try {
      // Meta gửi GET xác minh tới địa chỉ mới ngay trong lần gọi này: cổng và đường hầm đã chạy.
      await this.graph.goi(`/${khoa.layFb('app_id')}/subscriptions`, {
        method: 'POST', ma: 'app', giay: 30,
        body: { object: 'page', callback_url: `${diaChi}/webhook`, fields: TRUONG.join(','),
          verify_token: khoa.layFb('verify_token'), include_values: true },
      });
      for (const p of this.pagesDangChay()) {
        try {
          await p.goi(`/${p.pageId}/subscribed_apps`, { method: 'POST', query: { subscribed_fields: TRUONG.join(',') } });
        } catch (e) {
          loi.push(`${p.ten || p.pageId}: ${e.message}`);
        }
      }
    } catch (e) {
      loi.push(e.message);
    }
    this.tt.webhook = loi.length ? 'loi' : 'hoat_dong';
    this.tt.loi = loi.length ? `Đăng ký webhook với Meta chưa được — ${loi.join(' · ')}` : null;
    if (!loi.length) this.tt.dang_ky_luc = new Date().toISOString();
    else console.error('  [facebook] ' + this.tt.loi);
    this.baoThayDoi();
    return !loi.length;
  }

  /* ---------------- sự kiện vào ---------------- */

  phatSuKien(ds, nguon) {
    const mocDau = moc.lay('ket_noi_dau')?.con_tro;
    for (const ev of ds) {
      if (ev.page_id && !fbPage.dangBat(ev.page_id)) continue; // Page đang tắt trong MOZA
      if (ev.loai !== 'live_doi' && mocDau && ev.luc && ev.luc < mocDau) continue; // #5: không nhập tin cũ
      this.ganDay.unshift({ loai: ev.loai, nguon, page_id: ev.page_id || null, luc: new Date().toISOString(), fb_id: ev.mid || ev.comment_id || ev.live_id });
      this.ganDay.length = Math.min(this.ganDay.length, 30);
      try {
        this.emit('su_kien', { ...ev, nguon });
      } catch (e) {
        console.error('  [facebook] xử lý sự kiện lỗi: ' + e.message);
      }
    }
  }

  nhanWebhook(body) {
    this.phatSuKien(tuWebhook(body), 'webhook');
  }

  /** Lưới an toàn (F-24): hỏi từng Page từ con trỏ; webhook ngắt thì đây là đường duy nhất. */
  async luoiAnToan() {
    const pages = this.pagesDangChay();
    if (!pages.length) return;
    const conTro = moc.lay('con_tro_luoi')?.con_tro || moc.lay('ket_noi_dau')?.con_tro;
    const tu = conTro ? new Date(new Date(conTro).getTime() - CHONG_LAP_MS).toISOString() : null;
    const batDau = new Date().toISOString();
    const loi = [];
    let so = 0;
    for (const p of pages) {
      try {
        const ds = await p.docTinMoi(tu);
        so += ds.length;
        this.phatSuKien(ds, 'luoi_an_toan');
      } catch (e) {
        loi.push(`${p.ten || p.pageId}: ${e.message}`);
      }
    }
    if (!loi.length) moc.dat('con_tro_luoi', batDau);
    this.tt.luoi = { lan_cuoi: batDau, loi: loi.join(' · ') || null, so_tin: so };
  }

  /* ---------------- kiểm tra, đổi mã, bật/tắt Page ---------------- */

  /** Nút "Kiểm tra kết nối" (F-06): từng Page — tên, quyền có / thiếu, hạn mã. */
  async kiemTra() {
    if (!this.coDuMa()) {
      return { ok: false, loi: 'Chưa đủ App ID, App Secret và mã của ít nhất một Page.', pages: [], quyen_can: QUYEN_CAN };
    }
    const pages = [];
    for (const id of this.pageCoMa()) {
      const p = this.pageObj(id);
      try {
        const j = await p.goi(`/${id}`, { query: { fields: 'id,name' } });
        fbPage.luu(id, j.name);
        p.ten = j.name;
        const d = await this.graph.goi('/debug_token', { ma: 'app', query: { input_token: khoa.layMaPage(id) } });
        const co = new Set(d.data?.scopes || []);
        if (d.data?.is_valid === false) this.hetHan.add(id); else this.hetHan.delete(id);
        const quyen = QUYEN_CAN.map((q) => ({ quyen: q, co: co.has(q) }));
        pages.push({ id, ten: j.name, bat: fbPage.dangBat(id), ok: d.data?.is_valid !== false && quyen.every((q) => q.co), quyen,
          het_han: !d.data?.expires_at ? 'Không hết hạn' : new Date(d.data.expires_at * 1000).toISOString() });
      } catch (e) {
        pages.push({ id, ten: p.ten || fbPage.lay(id)?.ten || id, bat: fbPage.dangBat(id), ok: false, loi: e.message, quyen: QUYEN_CAN.map((q) => ({ quyen: q, co: null })) });
      }
    }
    this.baoThayDoi();
    return { ok: pages.every((p) => p.ok), pages, quyen_can: QUYEN_CAN };
  }

  /**
   * Đổi mã người dùng ngắn hạn (Graph API Explorer) thành mã Page không hết hạn rồi ghi vào .env.
   * Lần đầu trả danh sách Page người đó quản lý để chọn (chọn được nhiều Page, #37); chỉ có một Page thì lấy luôn.
   * @param {{maNguoiDung?:string, pageIds?:string[]}} o
   */
  async doiMaPage({ maNguoiDung = '', pageIds = null } = {}) {
    if (!this.coUngDung()) throw new LoiFacebook('FB_CHUA_KET_NOI', 'Nhập App ID và App Secret trước.', { http: 400 });
    let maDaiHan = this.maNguoiDungTam?.het > Date.now() ? this.maNguoiDungTam.ma : null;
    const moi = String(maNguoiDung || '').trim();
    if (moi) {
      const j = await this.graph.goi('/oauth/access_token', {
        ma: 'app',
        query: { grant_type: 'fb_exchange_token', client_id: khoa.layFb('app_id'), client_secret: khoa.layFb('app_secret'), fb_exchange_token: moi },
      });
      maDaiHan = j.access_token;
    }
    if (!maDaiHan) throw new LoiFacebook('DU_LIEU_KHONG_HOP_LE', 'Dán mã lấy từ Graph API Explorer vào ô (mã cũ đã quá 5 phút).', { http: 400 });
    this.maNguoiDungTam = { ma: maDaiHan, het: Date.now() + 5 * 60 * 1000 };
    const ds = await this.graph.docHet('/me/accounts', { ma: maDaiHan, query: { fields: 'id,name,access_token,tasks', limit: 50 } }, 200);
    if (!ds.length) throw new LoiFacebook('FB_THIEU_QUYEN', 'Mã này không quản lý Page nào. Khi lấy mã, nhớ tích chọn các Page cần nối.', { http: 400 });
    const chon = pageIds ? ds.filter((p) => pageIds.map(String).includes(String(p.id))) : ds.length === 1 ? ds : null;
    if (!chon) {
      const daNoi = new Set(this.pageCoMa());
      return { can_chon: true, pages: ds.map((p) => ({ id: String(p.id), ten: p.name, da_noi: daNoi.has(String(p.id)) })) };
    }
    if (!chon.length) throw new LoiFacebook('DU_LIEU_KHONG_HOP_LE', 'Chọn ít nhất một Page.', { http: 400 });
    for (const p of chon) {
      const kq = khoa.datPage(String(p.id), p.access_token);
      if (kq.loi) throw new LoiFacebook('DU_LIEU_KHONG_HOP_LE', kq.loi, { http: 400 });
      fbPage.luu(String(p.id), p.name);
    }
    this.maNguoiDungTam = null;
    await this.khoiDongLai();
    return { ok: true, pages: chon.map((p) => ({ id: String(p.id), ten: p.name })) };
  }

  async batTatPage(id, bat) {
    const p = fbPage.datBat(id, bat);
    await this.khoiDongLai();
    return p;
  }

  async boPage(id) {
    // Gỡ ứng dụng khỏi Page để Meta thôi gửi webhook của Page này (không được thì thôi: mã vẫn bị xóa khỏi máy).
    await this.pageObj(String(id)).goi(`/${id}/subscribed_apps`, { method: 'DELETE' }).catch(() => {});
    khoa.boPage(id);
    fbPage.xoa(id);
    await this.khoiDongLai();
  }

  /* ---------------- trạng thái ---------------- */

  /** Cho thanh trên cùng: một chữ + màu. */
  trangThaiGon() {
    if (!this.coDuMa()) return { ket_noi: false, muc: 'xam', chu: 'Facebook: chưa kết nối' };
    const soPage = this.pagesDangChay().length;
    if (this.hetHan.size) {
      const ten = [...this.hetHan].map((id) => this.pageObj(id).ten || id).join(', ');
      return { ket_noi: soPage > 0, muc: 'do', chu: `Facebook: mã hết hạn (${ten}) — đã dừng gửi`, ma: 'FB_MA_HET_HAN' };
    }
    const nhieu = soPage > 1 ? ` · ${soPage} Page` : '';
    if (this.tt.webhook === 'hoat_dong') return { ket_noi: soPage > 0, muc: 'xanh', chu: `Facebook: webhook${nhieu}` };
    return { ket_noi: soPage > 0, muc: 'vang', chu: `Facebook: webhook ngắt, đang hỏi định kỳ${nhieu}` };
  }

  trangThai() {
    return {
      ...this.trangThaiGon(),
      cau_hinh: khoa.trangThaiFb(),
      pages: this.pageCoMa().map((id) => ({ id, ten: fbPage.lay(id)?.ten || '', bat: fbPage.dangBat(id), het_han: this.hetHan.has(id) })),
      webhook: this.tt.webhook,
      loi: this.tt.loi,
      dia_chi: this.tt.dia_chi,
      dang_ky_luc: this.tt.dang_ky_luc,
      duong_ham: this.duongHam?.trangThai() || null,
      cong_webhook: this.webhook?.thongKe() || null,
      luoi_an_toan: this.tt.luoi,
      nhip_goi: this.nhip.trangThai(),
      moc_ket_noi_dau: moc.lay('ket_noi_dau')?.con_tro || null,
      su_kien_gan_day: this.ganDay.slice(0, 10),
    };
  }
}

module.exports = { KetNoiFacebook, TRUONG, QUYEN_CAN };
