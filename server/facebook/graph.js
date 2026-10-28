'use strict';

/**
 * Gọi Graph API v26 bằng `fetch` (mục 6: không cần SDK). Mọi lần gọi Facebook thật đi qua đây:
 *  - nhịp gọi theo header giới hạn (nhip-goi.js, F-06);
 *  - kèm `appsecret_proof` khi có App Secret (Meta khuyên, và bắt buộc nếu ứng dụng bật "Require App Secret");
 *  - lỗi Graph đổi thành mã lỗi của MOZA (mục 8): 190 → FB_MA_HET_HAN, 4/17/32/613/80001/80006 → FB_GIOI_HAN_GOI,
 *    10/200 → FB_THIEU_QUYEN, 10 hoặc subcode 2018278/2534022 → NGOAI_CUA_SO_24H.
 *  - Mã truy cập không bao giờ nằm trong thông báo lỗi (địa chỉ gọi không được in ra).
 */

const crypto = require('node:crypto');
const { LoiNghiepVu } = require('../nghiep-vu/chung');
const { MA_GIOI_HAN } = require('./nhip-goi');

const PHIEN_BAN = 'v26.0';
const GOC = `https://graph.facebook.com/${PHIEN_BAN}`;

class LoiFacebook extends LoiNghiepVu {
  constructor(ma, thongDiep, { maGraph = null, maPhu = null, http = 502 } = {}) {
    super(ma, thongDiep, http);
    this.maGraph = maGraph;
    this.maPhu = maPhu;
  }
}

/** Đổi lỗi Graph (`{error:{code, error_subcode, message}}`) thành lỗi MOZA. */
function doiLoi(err) {
  const code = Number(err?.code);
  const sub = Number(err?.error_subcode);
  const tin = String(err?.message || 'Facebook báo lỗi').slice(0, 300);
  const o = { maGraph: code || null, maPhu: sub || null };
  // 10/1893063 phải xét TRƯỚC nhánh mã 10 (trước đây bị báo nhầm "thiếu quyền" — L10): Page bị Meta tạm cấm nhắn tin.
  if (sub === 1893063) {
    return new LoiFacebook('FB_PAGE_BI_CAM_NHAN', 'Meta đang tạm khóa tính năng nhắn tin của Page (vi phạm chính sách nhắn tin). Xem mục Chất lượng Page trong Meta Business Suite.', o);
  }
  // Mã duy nhất Meta ghi cho nhắn riêng không được (bình luận đã nhắn, quá 7 ngày, không cho nhắn riêng) — tra 27/9/2026.
  if (sub === 2534025) return new LoiFacebook('FB_KHONG_NHAN_RIENG_DUOC', 'Bình luận này không nhắn riêng được (đã nhắn, quá 7 ngày, hoặc Facebook không cho).', o);
  if (code === 551) return new LoiFacebook('FB_NGUOI_KHONG_NHAN_DUOC', 'Người này hiện không nhận được tin nhắn (đã chặn Page hoặc tạm khóa).', o);
  if (code === 190) return new LoiFacebook('FB_MA_HET_HAN', `Mã truy cập Facebook hết hạn hoặc bị thu hồi: ${tin}`, o);
  if (MA_GIOI_HAN.has(code)) return new LoiFacebook('FB_GIOI_HAN_GOI', `Facebook đang giới hạn lượt gọi: ${tin}`, o);
  if (sub === 2018278 || sub === 2534022) {
    return new LoiFacebook('NGOAI_CUA_SO_24H', 'Đã quá 24 giờ kể từ tin cuối của người này: Facebook không cho gửi.', o);
  }
  if (sub === 2018028) {
    return new LoiFacebook('FB_CHUA_DUYET', 'Ứng dụng Meta chưa được duyệt: chỉ nhắn được với tài khoản có vai trò trong ứng dụng.', o);
  }
  if (sub === 2018300) {
    // F-110 (H26): dấu hiệu trợ lý AI của Facebook (hoặc ứng dụng khác) đang là bên trả lời chính → bảng Sẵn sàng báo đỏ.
    try { require('../san-sang').ghiBusinessAi('loi_2018300'); } catch { /* chưa mở cơ sở dữ liệu */ }
    return new LoiFacebook('FB_UNG_DUNG_KHAC_GIU', 'Một ứng dụng khác (có thể là trợ lý AI của Facebook) đang giữ hội thoại này (Conversation Routing).', o);
  }
  if (sub === 1545041) return new LoiFacebook('FB_NGUOI_KHONG_NHAN_DUOC', 'Người này hiện không nhận được tin nhắn.', o);
  if (code === 10 || code === 200 || code === 283) return new LoiFacebook('FB_THIEU_QUYEN', `Thiếu quyền Facebook: ${tin}`, o);
  return new LoiFacebook('FB_LOI', `Facebook báo lỗi${code ? ` ${code}` : ''}: ${tin}`, o);
}

/**
 * @param {object} o
 * @param {(loai:'page'|'app')=>string} o.layMa    mã truy cập đang dùng
 * @param {()=>string} [o.layBiMat]                App Secret (cho appsecret_proof)
 * @param {import('./nhip-goi').NhipGoi} o.nhip
 * @param {typeof fetch} [o.fetch]
 * @param {(e:LoiFacebook, pageId:string|null)=>void} [o.khiLoi]  báo lỗi ra ngoài (mã hết hạn → băng đỏ)
 */
function taoGraph({ layMa, layBiMat = () => '', nhip, fetch: goiMang = fetch, khiLoi = () => {} }) {
  /**
   * @param {string} duong  ví dụ `/123/messages` hoặc URL đầy đủ (trang kế tiếp)
   * @param {{method?:string, query?:object, body?:object, ma?:'page'|'app'|string, toiDaChoMs?:number, giay?:number}} [o]
   */
  async function goi(duong, { method = 'GET', query = {}, body = null, ma = 'page', toiDaChoMs, giay = 20, pageId = null } = {}) {
    const token = ma === 'page' || ma === 'app' ? layMa(ma) : ma;
    if (!token) throw new LoiFacebook('FB_CHUA_KET_NOI', 'Chưa có mã Facebook. Vào Cài đặt → Facebook để nhập.', { http: 400 });
    const url = new URL(/^https?:/.test(duong) ? duong : GOC + duong);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    url.searchParams.set('access_token', token);
    const biMat = layBiMat();
    if (biMat && !token.includes('|')) {
      url.searchParams.set('appsecret_proof', crypto.createHmac('sha256', biMat).update(token).digest('hex'));
    }
    await nhip.truocKhiGoi({ toiDaChoMs }).catch((e) => {
      throw new LoiFacebook('FB_GIOI_HAN_GOI', e.message, { http: 429 });
    });
    let res;
    try {
      res = await goiMang(url, {
        method,
        // FormData (gửi ảnh kèm tệp): để fetch tự đặt kiểu multipart.
        headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(giay * 1000),
      });
    } catch (e) {
      const het = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      // Không rõ Facebook đã nhận hay chưa: nơi gửi tin coi là "không rõ", không tự gửi lại (mục 9).
      throw new LoiFacebook('FB_MAT_MANG', het ? 'Facebook quá lâu không trả lời.' : 'Không kết nối được tới Facebook.', { http: 503 });
    }
    const layHeader = (t) => res.headers.get(t);
    nhip.sauKhiGoi(layHeader);
    let j = null;
    try { j = await res.json(); } catch { /* không phải JSON */ }
    if (!res.ok || j?.error) {
      const e = doiLoi(j?.error || { message: `HTTP ${res.status}` });
      nhip.khiLoi(e.maGraph, layHeader);
      khiLoi(e, pageId);
      throw e;
    }
    nhip.khiThanhCong();
    return j ?? {};
  }

  /** Đọc hết các trang (theo `paging.next`), tối đa `toiDa` dòng. */
  async function docHet(duong, o = {}, toiDa = 500) {
    const ds = [];
    let j = await goi(duong, o);
    for (;;) {
      ds.push(...(j.data || []));
      if (ds.length >= toiDa || !j.paging?.next) break;
      j = await goi(j.paging.next, { ma: o.ma });
    }
    return ds.slice(0, toiDa);
  }

  return { goi, docHet };
}

module.exports = { taoGraph, doiLoi, LoiFacebook, PHIEN_BAN, GOC };
