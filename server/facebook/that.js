'use strict';

/**
 * Facebook thật (Graph API v26) — cùng hợp đồng với Facebook giả (giao-dien.js), SPEC.md mục 5 nguyên tắc 5.
 * Nhiều Fanpage cùng lúc (#37): mỗi Page một `FacebookPage` dùng mã riêng của Page đó; `FacebookThat` gộp lại
 * theo hợp đồng chung — tìm live trên mọi Page đang bật, nhớ live / bình luận thuộc Page nào để gọi đúng mã.
 *
 * Live (F-19, F-20):
 *   - Tìm live đang phát: `GET /{page-id}/live_videos?broadcast_status=["LIVE"]`.
 *   - Bình luận live: luồng trực tiếp `streaming-graph.facebook.com/{live-id}/live_comments` (server-sent events,
 *     MOZA kết nối đi ra nên không cần đường hầm); hỏng thì phòng live lùi về `GET /{live-id}/comments`
 *     với `live_filter=no_filter` (mặc định Meta lọc bớt bình luận "chất lượng thấp").
 * Hộp thư (F-24, F-25): gửi Messenger (`messaging_type: RESPONSE`), trả lời bình luận công khai, nhắn riêng người
 * bình luận (`recipient: {comment_id}`, 1 lần, trong 7 ngày), ẩn bình luận (`is_hidden`); lưới an toàn đọc tin mới.
 */

const { kiemHopDong } = require('./giao-dien');
const { LoiFacebook } = require('./graph');
const { chuCuaTin } = require('./su-kien');
const { dungTin } = require('./dung-tin');
const { chuan } = require('../nghiep-vu/chung');

const LUONG = 'https://streaming-graph.facebook.com';

// Bình luận không có người gửi (H22): không đọc tên lên sóng, không đếm là người chốt (L9 ở docs/07).
const TEN_AN_DANH = 'Một bạn';

/**
 * Bình luận Graph → dạng MOZA. `la_page`: chính Page bình luận (câu ghim, mục lục — H13): phòng live không đưa vào chốt đơn,
 * ẩn bình luận hay Director (L8). `an_danh`: không có `from`.
 */
function binhLuanTuGraph(c, liveId, pageId = null) {
  const laPage = !!(pageId && c.from?.id && String(c.from.id) === String(pageId));
  return {
    id: String(c.id),
    live_id: liveId,
    ten: c.from?.name ? chuan(c.from.name) : TEN_AN_DANH,
    nguoi_id: c.from?.id ? String(c.from.id) : `an_${c.id}`,
    noi_dung: chuan(c.message || ''),
    luc: c.created_time ? new Date(c.created_time).toISOString() : new Date().toISOString(),
    ...(c.from?.id ? {} : { an_danh: true }),
    ...(laPage ? { la_page: true } : {}),
  };
}

/** Live Graph → dạng MOZA (F-67): id live, id video (bình luận bài đăng của live mang id video — H09), giờ Facebook, người xem. */
function liveTuGraph(l, pageId, pageTen = '') {
  const link = l.permalink_url ? String(l.permalink_url) : null;
  return {
    id: String(l.id), tieu_de: chuan(l.title || l.description || 'Live trên Page'), bat_dau: l.creation_time || null,
    video_id: l.video?.id ? String(l.video.id) : null, nguoi_xem: Number.isFinite(Number(l.live_views)) ? Number(l.live_views) : null,
    fb_link: link ? (link.startsWith('http') ? link : `https://www.facebook.com${link}`) : null,
    page_id: String(pageId), page_ten: pageTen,
  };
}

/** Một Page: mọi lần gọi dùng mã của đúng Page này. */
class FacebookPage {
  /**
   * @param {object} o
   * @param {{goi:Function, docHet:Function}} o.graph
   * @param {string} o.pageId
   * @param {()=>string} o.layMa
   * @param {string} [o.ten]
   * @param {typeof fetch} [o.fetch]
   */
  constructor({ graph, pageId, layMa, ten = '', fetch: goiMang = fetch }) {
    this.graph = graph;
    this.pageId = String(pageId);
    this.layMa = layMa;
    this.ten = ten;
    this.fetch = goiMang;
  }

  goi(duong, o = {}) {
    return this.graph.goi(duong, { ...o, ma: this.layMa(), pageId: this.pageId });
  }

  async timLiveDangPhat() {
    const j = await this.goi(`/${this.pageId}/live_videos`, {
      // [CHƯA KIỂM CHỨNG H09–H11] video{id}, live_views, permalink_url: trang tham chiếu LiveVideo trả 404 ngày 27/9/2026 — kiểm ở Bước 0.
      query: { broadcast_status: ['LIVE'], fields: 'id,title,description,creation_time,status,video{id},live_views,permalink_url', limit: 10 },
    });
    return (j.data || []).filter((l) => !l.status || ['LIVE', 'LIVE_NOW'].includes(l.status)).map((l) => liveTuGraph(l, this.pageId, this.ten));
  }

  moLuongBinhLuan(liveId, fn, khiLoi = () => {}) {
    const dieuKhien = new AbortController();
    let daBao = false;
    const bao = (e) => {
      if (daBao || dieuKhien.signal.aborted) return;
      daBao = true;
      dieuKhien.abort();
      khiLoi(e);
    };
    const url = new URL(`${LUONG}/${encodeURIComponent(liveId)}/live_comments`);
    url.searchParams.set('access_token', this.layMa());
    url.searchParams.set('comment_rate', 'one_hundred_per_second');
    url.searchParams.set('fields', 'from{name,id},message,created_time');
    (async () => {
      const res = await this.fetch(url, { headers: { Accept: 'text/event-stream' }, signal: dieuKhien.signal });
      if (!res.ok || !res.body) throw new Error(`Luồng bình luận trực tiếp trả HTTP ${res.status}`);
      const giai = new TextDecoder();
      let dem = '';
      for await (const manh of res.body) {
        dem += giai.decode(manh, { stream: true });
        let i;
        while ((i = dem.search(/\r?\n\r?\n/)) >= 0) {
          const khoi = dem.slice(0, i);
          dem = dem.slice(i).replace(/^\r?\n\r?\n/, '');
          const duLieu = khoi.split(/\r?\n/).filter((d) => d.startsWith('data:')).map((d) => d.slice(5).trim()).join('\n');
          if (!duLieu) continue; // ": ping" giữ kết nối
          try {
            const c = JSON.parse(duLieu);
            if (c?.id) fn(binhLuanTuGraph(c, liveId, this.pageId));
          } catch { /* khối lạ: bỏ */ }
        }
      }
      throw new Error('Luồng bình luận trực tiếp bị đóng');
    })().catch((e) => bao(e));
    return { dong: () => { daBao = true; dieuKhien.abort(); } };
  }

  async docBinhLuan(liveId, sauLuc = null) {
    const query = {
      fields: 'id,from{id,name},message,created_time', filter: 'stream', order: 'reverse_chronological',
      live_filter: 'no_filter', limit: 100,
    };
    if (sauLuc) query.since = Math.floor(new Date(sauLuc).getTime() / 1000) - 1;
    const ds = await this.graph.docHet(`/${liveId}/comments`, { query, ma: this.layMa() }, 300);
    return ds.map((c) => binhLuanTuGraph(c, liveId, this.pageId)).sort((a, b) => (a.luc < b.luc ? -1 : 1));
  }

  /**
   * F-94: bình luận trên video xem lại của live đã xong (GET /{video}/comments). Bình luận xem lại thường không có
   * live_broadcast_timestamp — MOZA không đoán món theo giờ. CHƯA kiểm trên Page thật (Bước 0).
   */
  async docBinhLuanVideo(videoId, sauLuc = null) {
    const query = { fields: 'id,from{id,name},message,created_time', filter: 'stream', order: 'reverse_chronological', limit: 100 };
    if (sauLuc) query.since = Math.floor(new Date(sauLuc).getTime() / 1000);
    const ds = await this.graph.docHet(`/${videoId}/comments`, { query, ma: this.layMa() }, 300);
    return ds.map((c) => binhLuanTuGraph(c, null, this.pageId)).filter((b) => !sauLuc || b.luc > sauLuc).sort((a, b) => (a.luc < b.luc ? -1 : 1));
  }

  /** F-94: Page bình luận lên video (mục lục). Cần pages_manage_engagement (đã có trong QUYEN_CAN). */
  async dangBinhLuan(videoId, noiDung) {
    const j = await this.goi(`/${videoId}/comments`, { method: 'POST', body: { message: String(noiDung) } });
    return { id: j.id ? String(j.id) : null };
  }

  async anBinhLuan(id) {
    const j = await this.goi(`/${id}`, { method: 'POST', body: { is_hidden: true } });
    return j.success !== false;
  }

  async guiTinNhan(psid, noiDung) {
    const j = await this.goi(`/${this.pageId}/messages`, {
      method: 'POST', toiDaChoMs: 20000,
      body: { recipient: { id: psid }, messaging_type: 'RESPONSE', message: dungTin({ kieu: 'chu', chu: String(noiDung) }) },
    });
    return { mid: j.message_id || null };
  }

  /** Một thẻ trung tính (dung-tin.js) tới một người đã nhắn Page trong 24 giờ. */
  async guiTheSp(psid, the) {
    const j = await this.goi(`/${this.pageId}/messages`, {
      method: 'POST', toiDaChoMs: 20000,
      body: { recipient: { id: psid }, messaging_type: 'RESPONSE', message: dungTin(the) },
    });
    return { mid: j.message_id || null, psid: j.recipient_id ? String(j.recipient_id) : psid };
  }

  /** Chữ + trả lời nhanh (tối đa 13 nút). */
  async guiLuaChon(psid, chu, luaChon) {
    return this.guiTheSp(psid, { kieu: 'chu', chu, tra_loi_nhanh: luaChon });
  }

  /**
   * Thẻ có nút (button template của Messenger — #89): chữ ≤ 640 ký tự, tối đa 3 nút postback (tiêu đề ≤ 20 ký tự).
   * Khách bấm nút → webhook `messaging_postbacks` mang payload về MOZA. Không cắt chữ âm thầm nữa (L2): thẻ sai giới hạn
   * báo THE_KHONG_HOP_LE ngay ở MOZA.
   */
  async guiThe(psid, noiDung, nut) {
    const r = await this.guiTheSp(psid, { kieu: 'nut', chu: String(noiDung), nut });
    return { mid: r.mid };
  }

  /**
   * Mẫu tin Utility (Messenger, 2026 — thay thẻ POST_PURCHASE_UPDATE đã bỏ 27/4/2026): gửi được cả khi quá 24 giờ kể từ tin cuối
   * của khách, chỉ cho tin cập nhật đơn (không quảng cáo). Mẫu phải được Meta duyệt trước (taoMauUtility).
   */
  async guiUtility(psid, ten, thamSo, ngonNgu = 'vi') {
    const j = await this.goi(`/${this.pageId}/messages`, {
      method: 'POST', toiDaChoMs: 20000,
      body: {
        recipient: { id: psid }, messaging_type: 'UTILITY',
        message: { template: { name: ten, language: { code: ngonNgu }, components: [{ type: 'body', parameters: thamSo.map((t) => ({ type: 'text', text: String(t) })) }] } },
      },
    });
    return { mid: j.message_id || null };
  }

  /** Tạo mẫu tin Utility trên Page (Meta duyệt trong vài giây tới vài phút — tra 27/9/2026). Nút POSTBACK tùy chọn. */
  async taoMauUtility(ten, noiDung, ngonNgu = 'vi', nut = []) {
    const components = [{ type: 'BODY', text: noiDung }];
    if (nut.length) components.push({ type: 'BUTTONS', buttons: nut.map((b) => ({ type: 'POSTBACK', text: b.tieu_de, payload: b.payload })) });
    const j = await this.goi(`/${this.pageId}/message_templates`, {
      method: 'POST', toiDaChoMs: 20000,
      body: { name: ten, language: ngonNgu, category: 'UTILITY', components },
    });
    return { id: j.id || null, trang_thai: j.status || null, loai: j.category || null };
  }

  /** Trạng thái + loại một mẫu: chỉ gửi khi APPROVED và Meta xếp UTILITY (MARKETING thì không — #99). */
  async trangThaiMau(ten) {
    const j = await this.goi(`/${this.pageId}/message_templates`, { query: { name: ten } });
    const m = (j.data || []).find((x) => x.name === ten);
    return m ? { trang_thai: m.status || null, loai: m.category || null } : null;
  }

  /** Tải ảnh lên Meta một lần, dùng lại bằng attachment_id (Attachment Upload API, is_reusable). */
  async taiAnhLen(anh, ten = 'anh.jpg', url = null) {
    let body;
    if (url) body = { message: { attachment: { type: 'image', payload: { url, is_reusable: true } } } };
    else {
      body = new FormData();
      body.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }));
      const kieu = /.png$/i.test(ten) ? 'image/png' : /.webp$/i.test(ten) ? 'image/webp' : 'image/jpeg';
      body.append('filedata', new Blob([anh], { type: kieu }), ten);
    }
    const j = await this.goi(`/${this.pageId}/message_attachments`, { method: 'POST', toiDaChoMs: 20000, giay: 40, body });
    return { attachment_id: j.attachment_id ? String(j.attachment_id) : null };
  }

  /** Nút Bắt đầu + menu cố định (Messenger Profile API) — người bấm trong Cài đặt vì đây là đổi cài đặt Page. */
  async datHoSoMessenger(hoSo) {
    return this.goi('/me/messenger_profile', { method: 'POST', body: hoSo, toiDaChoMs: 20000 });
  }

  /** Page Integrity API (ra 30/1/2026): Page có đang bị Meta hạn chế nhắn tin không (F-73). */
  async kiemHanChePage() {
    const { docHanChe } = require('./gia');
    return docHanChe(await this.goi(`/${this.pageId}/page_status`));
  }

  /** Gửi ảnh qua Messenger (Send API, tải tệp lên kèm tin — F-56). */
  async guiAnh(psid, anh, ten = 'anh.jpg') {
    const f = new FormData();
    f.append('recipient', JSON.stringify({ id: psid }));
    f.append('messaging_type', 'RESPONSE');
    f.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: false } } }));
    const kieu = /.png$/i.test(ten) ? 'image/png' : /.webp$/i.test(ten) ? 'image/webp' : 'image/jpeg';
    f.append('filedata', new Blob([anh], { type: kieu }), ten);
    const j = await this.goi(`/${this.pageId}/messages`, { method: 'POST', toiDaChoMs: 20000, giay: 40, body: f });
    return { mid: j.message_id || null };
  }

  async traLoiBinhLuan(commentId, noiDung) {
    const j = await this.goi(`/${commentId}/comments`, { method: 'POST', body: { message: noiDung }, toiDaChoMs: 20000 });
    return { id: j.id || null };
  }

  /** Tài liệu Meta không nói rõ bình luận live có nhắn riêng được không: hỏi Facebook trước. */
  async coTheNhanRieng(commentId) {
    try {
      const j = await this.goi(`/${commentId}`, { query: { fields: 'can_reply_privately' } });
      return j.can_reply_privately !== false;
    } catch {
      return true; // không đọc được thì cứ thử gửi; Facebook sẽ từ chối nếu không được
    }
  }

  async nhanRieng(commentId, noiDung) {
    return this.guiNhanRieng(commentId, { kieu: 'chu', chu: String(noiDung) });
  }

  async guiNhanRieng(commentId, the) {
    const j = await this.goi(`/${this.pageId}/messages`, {
      method: 'POST', toiDaChoMs: 20000,
      body: { recipient: { comment_id: commentId }, message: dungTin(the) },
    });
    // recipient_id là PSID của người bình luận: gắn người (ganPsid) để tin sau nhận ra cùng người.
    return { mid: j.message_id || null, psid: j.recipient_id ? String(j.recipient_id) : null };
  }

  /** Nhắn riêng bằng thẻ (F-65): hỏi `can_reply_privately` trước — false thì không gửi, nơi gọi gom tên công khai. */
  async nhanRiengThe(commentId, the) {
    if (!(await this.coTheNhanRieng(commentId))) {
      throw new LoiFacebook('FB_KHONG_NHAN_RIENG_DUOC', 'Bình luận này không nhắn riêng được (Facebook báo can_reply_privately = false).', { http: 409 });
    }
    return this.guiNhanRieng(commentId, the);
  }

  async layTenNguoi(psid) {
    try {
      const j = await this.goi(`/${psid}`, { query: { fields: 'name,first_name,last_name' } });
      return chuan(j.name || [j.last_name, j.first_name].filter(Boolean).join(' ') || '');
    } catch {
      return '';
    }
  }

  /**
   * Lưới an toàn (F-24): tin Messenger và bình luận bài đăng từ `sauLuc`. Cùng dạng sự kiện với webhook (su-kien.js).
   * Tin do Page gửi trả về `tin_vong` không có `app_id` — Hộp thư nhận ra tin MOZA đã gửi theo `mid`.
   */
  async docTinMoi(sauLuc) {
    const pageId = this.pageId;
    const moc = sauLuc ? new Date(sauLuc).getTime() : 0;
    const ra = [];
    const hoiThoai = await this.goi(`/${pageId}/conversations`, {
      query: { platform: 'messenger', fields: 'updated_time,messages.limit(25){id,message,from,to,created_time,attachments}', limit: 25 },
    });
    for (const h of hoiThoai.data || []) {
      if (moc && new Date(h.updated_time).getTime() < moc) continue;
      for (const m of h.messages?.data || []) {
        const luc = new Date(m.created_time).toISOString();
        if (moc && new Date(luc).getTime() < moc) continue;
        const tuPage = String(m.from?.id) === pageId;
        const noiDung = chuCuaTin({ text: m.message, attachments: (m.attachments?.data || []).map((a) => ({ type: (a.mime_type || '').split('/')[0] })) });
        if (tuPage) {
          const nguoi = (m.to?.data || []).find((x) => String(x.id) !== pageId);
          if (nguoi) ra.push({ loai: 'tin_vong', page_id: pageId, psid: String(nguoi.id), mid: m.id, noi_dung: noiDung, luc, app_id: null });
        } else {
          ra.push({ loai: 'tin_nhan', page_id: pageId, psid: String(m.from?.id || ''), mid: m.id, noi_dung: noiDung, luc, ten: chuan(m.from?.name || '') });
        }
      }
    }
    const feed = await this.goi(`/${pageId}/feed`, {
      query: { fields: 'id,updated_time,comments.order(reverse_chronological).limit(25){id,message,from,created_time,parent{id}}', limit: 10 },
    });
    for (const p of feed.data || []) {
      for (const c of p.comments?.data || []) {
        const luc = new Date(c.created_time).toISOString();
        if (moc && new Date(luc).getTime() < moc) continue;
        if (String(c.from?.id) === pageId) continue;
        ra.push({ loai: 'binh_luan_bai', page_id: pageId, comment_id: String(c.id), post_id: String(p.id), parent_id: c.parent?.id ? String(c.parent.id) : null,
          nguoi_id: String(c.from?.id || ''), ten: chuan(c.from?.name || 'Người dùng Facebook'), noi_dung: chuan(c.message || ''), luc });
      }
    }
    return ra.sort((a, b) => (a.luc < b.luc ? -1 : 1));
  }
}

/** Gộp nhiều Page theo hợp đồng chung. */
class FacebookThat {
  /** @param {{ layPages: () => FacebookPage[] }} o  các Page đang bật và còn mã */
  constructor({ layPages }) {
    this.ten = 'that';
    this.chuKyTimLiveMs = 15000;
    this.layPages = layPages;
    this.liveCuaPage = new Map(); // live id → page id
    this.binhLuanCuaPage = new Map(); // bình luận live id → page id (để ẩn đúng Page)
    kiemHopDong(this);
  }

  page(pageId) {
    const p = this.layPages().find((x) => x.pageId === String(pageId));
    if (!p) throw new LoiFacebook('FB_CHUA_KET_NOI', `Page ${pageId || ''} chưa nối với MOZA hoặc đang tắt. Vào Cài đặt → Facebook.`, { http: 400 });
    return p;
  }

  pageCuaLive(liveId) {
    return this.page(this.liveCuaPage.get(String(liveId)) || this.layPages()[0]?.pageId);
  }

  async timLiveDangPhat() {
    const ra = [];
    for (const p of this.layPages()) {
      for (const l of await p.timLiveDangPhat()) {
        this.liveCuaPage.set(l.id, p.pageId);
        ra.push({ ...l, tieu_de: this.layPages().length > 1 && p.ten ? `${p.ten} · ${l.tieu_de}` : l.tieu_de });
      }
    }
    return ra;
  }

  moLuongBinhLuan(liveId, fn, khiLoi) {
    const p = this.pageCuaLive(liveId);
    return p.moLuongBinhLuan(liveId, (bl) => { this.nhoBinhLuan(bl.id, p.pageId); fn(bl); }, khiLoi);
  }

  async docBinhLuan(liveId, sauLuc) {
    const p = this.pageCuaLive(liveId);
    const ds = await p.docBinhLuan(liveId, sauLuc);
    for (const bl of ds) this.nhoBinhLuan(bl.id, p.pageId);
    return ds;
  }

  nhoBinhLuan(id, pageId) {
    this.binhLuanCuaPage.set(id, pageId);
    if (this.binhLuanCuaPage.size > 20000) this.binhLuanCuaPage.delete(this.binhLuanCuaPage.keys().next().value);
  }

  async anBinhLuan(id, pageId = null) {
    return this.page(pageId || this.binhLuanCuaPage.get(id) || this.layPages()[0]?.pageId).anBinhLuan(id);
  }

  /* Hộp thư: luôn nói rõ Page nào (Page nhận tin là Page trả lời). */
  async guiTinNhan({ page_id: pageId, psid, noi_dung: noiDung }) { return this.page(pageId).guiTinNhan(psid, noiDung); }

  async guiAnh({ page_id: pageId, psid, anh, ten }) { return this.page(pageId).guiAnh(psid, anh, ten); }

  async guiThe({ page_id: pageId, psid, noi_dung: noiDung, nut }) { return this.page(pageId).guiThe(psid, noiDung, nut); }

  async guiUtility({ page_id: pageId, psid, ten, tham_so: thamSo, ngon_ngu: ngonNgu }) { return this.page(pageId).guiUtility(psid, ten, thamSo, ngonNgu); }

  async taoMauUtility({ page_id: pageId, ten, noi_dung: noiDung, ngon_ngu: ngonNgu, nut = [] }) { return this.page(pageId).taoMauUtility(ten, noiDung, ngonNgu, nut); }

  async guiTheSp({ page_id: pageId, psid, the }) { return this.page(pageId).guiTheSp(psid, the); }

  async guiLuaChon({ page_id: pageId, psid, chu, lua_chon: luaChon }) { return this.page(pageId).guiLuaChon(psid, chu, luaChon); }

  async nhanRiengThe({ page_id: pageId, comment_id: id, the }) { return this.page(pageId).nhanRiengThe(id, the); }

  async taiAnhLen({ page_id: pageId, anh, ten, url }) { return this.page(pageId).taiAnhLen(anh, ten, url); }

  async trangThaiMau({ page_id: pageId, ten }) { return this.page(pageId).trangThaiMau(ten); }

  async datHoSoMessenger({ page_id: pageId, ho_so: hoSo }) { return this.page(pageId).datHoSoMessenger(hoSo); }

  async kiemHanChePage({ page_id: pageId }) { return this.page(pageId).kiemHanChePage(); }

  async docBinhLuanVideo({ page_id: pageId, video_id: videoId, sau_luc: sauLuc = null }) { return this.page(pageId).docBinhLuanVideo(videoId, sauLuc); }

  async dangBinhLuan({ page_id: pageId, video_id: videoId, noi_dung: noiDung }) { return this.page(pageId).dangBinhLuan(videoId, noiDung); }

  /** Lưới an toàn gộp mọi Page (ket-noi.js hỏi từng Page riêng; hàm này cho hợp đồng chung). */
  async docTinMoi(sauLuc) {
    const ra = [];
    for (const p of this.layPages()) ra.push(...await p.docTinMoi(sauLuc));
    return ra;
  }

  async traLoiBinhLuan({ page_id: pageId, comment_id: id, noi_dung: noiDung }) { return this.page(pageId).traLoiBinhLuan(id, noiDung); }

  async coTheNhanRieng({ page_id: pageId, comment_id: id }) { return this.page(pageId).coTheNhanRieng(id); }

  async nhanRieng({ page_id: pageId, comment_id: id, noi_dung: noiDung }) { return this.page(pageId).nhanRieng(id, noiDung); }

  async layTenNguoi({ page_id: pageId, psid }) { return this.page(pageId).layTenNguoi(psid); }
}

module.exports = { FacebookThat, FacebookPage, binhLuanTuGraph, liveTuGraph, TEN_AN_DANH };
