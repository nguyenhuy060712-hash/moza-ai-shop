'use strict';

/**
 * Đổi dữ liệu Facebook (webhook trang, hoặc kết quả hỏi định kỳ của lưới an toàn) thành sự kiện chung của MOZA.
 * Webhook và lưới an toàn cho ra cùng một dạng, nên phần nhận phía sau (Hộp thư) không cần biết tin đến đường nào,
 * và chống nhận trùng theo `fb_id` (`mid` hoặc `comment_id`) — F-24.
 *
 * Các loại:
 * Mọi sự kiện có `page_id` (#37: nhiều Fanpage cùng lúc) — Page nhận tin, cũng là Page sẽ trả lời.
 *   tin_nhan      { psid, mid, noi_dung, luc }                     khách nhắn Page
 *   tin_vong      { psid, mid, noi_dung, luc, app_id }             Page gửi đi (echo) — MOZA hay người trên hộp thư Page (#34)
 *   postback      { psid, noi_dung, payload, luc, nguon_nut?, ref? } khách bấm nút hoặc chạm trả lời nhanh (F-65)
 *   gioi_thieu    { psid, ref, nguon_ref, luc }                    khách mở link m.me?ref= khi đã có hội thoại (H19)
 *   binh_luan_bai { comment_id, post_id, parent_id, nguoi_id, ten, noi_dung, luc }  bình luận mới trên bài đăng
 *   live_doi      { live_id, trang_thai }                          live của Page đổi trạng thái (F-19)
 */

const { chuan } = require('../nghiep-vu/chung');

function lucTu(ms) {
  const n = Number(ms);
  if (!n) return new Date().toISOString();
  return new Date(n < 1e12 ? n * 1000 : n).toISOString();
}

/** Tin không có chữ (ảnh, nhãn dán, âm thanh…) vẫn hiện được trong Hộp thư. */
function chuCuaTin(m) {
  if (m?.text) return chuan(m.text);
  const loai = (m?.attachments || []).map((a) => a.type);
  if (m?.sticker_id || loai.includes('sticker')) return '[nhãn dán]';
  if (loai.includes('image')) return '[hình ảnh]';
  if (loai.includes('audio')) return '[tin nhắn thoại]';
  if (loai.includes('video')) return '[video]';
  if (loai.includes('file')) return '[tệp]';
  if (loai.length) return `[${loai.join(', ')}]`;
  return '';
}

/** @param {object} body   JSON webhook đã kiểm chữ ký */
function tuWebhook(body) {
  const ra = [];
  if (body?.object !== 'page') return ra;
  for (const e of body.entry || []) {
    const pageId = String(e.id || '');
    const dau = ra.length;
    for (const m of e.messaging || []) {
      const luc = lucTu(m.timestamp);
      if (m.message) {
        if (m.message.is_echo) {
          ra.push({ loai: 'tin_vong', psid: String(m.recipient?.id || ''), mid: m.message.mid, noi_dung: chuCuaTin(m.message),
            luc, app_id: m.message.app_id != null ? String(m.message.app_id) : null, metadata: m.message.metadata || null });
        } else if (m.message.quick_reply?.payload) {
          // Chạm trả lời nhanh (H05) coi như bấm nút: một bộ đọc nút cho cả hai (F-65). Chữ khách thấy vẫn giữ trong noi_dung.
          ra.push({ loai: 'postback', psid: String(m.sender?.id || ''), mid: m.message.mid, noi_dung: chuCuaTin(m.message),
            payload: String(m.message.quick_reply.payload), nguon_nut: 'tra_loi_nhanh', luc });
        } else {
          const anh = (m.message.attachments || []).find((a) => a.type === 'image' && a.payload?.url);
          ra.push({ loai: 'tin_nhan', psid: String(m.sender?.id || ''), mid: m.message.mid, noi_dung: chuCuaTin(m.message), luc,
            ...(anh ? { anh_url: String(anh.payload.url) } : {}) });
        }
      } else if (m.postback) {
        ra.push({ loai: 'postback', psid: String(m.sender?.id || ''), mid: m.postback.mid || `pb_${m.sender?.id}_${m.timestamp}`,
          noi_dung: chuan(m.postback.title || m.postback.payload || ''), payload: m.postback.payload || '', luc,
          // Người mới bấm "Bắt đầu" từ link m.me?ref= (H19): mã giới thiệu đi kèm postback.
          ...(m.postback.referral?.ref ? { ref: String(m.postback.referral.ref) } : {}) });
      } else if (m.referral) {
        // Người đã có hội thoại mở link m.me?ref= (sự kiện messaging_referrals — H19). Mở cửa sổ 24 giờ.
        ra.push({ loai: 'gioi_thieu', psid: String(m.sender?.id || ''), mid: `ref_${m.sender?.id}_${m.timestamp}`,
          ref: String(m.referral.ref || ''), nguon_ref: String(m.referral.source || ''), noi_dung: '[mở từ link m.me]', luc });
      }
    }
    // F-110 (H25): tin của khách đang do ứng dụng khác giữ (Conversation Routing) về kênh "standby" — MOZA chỉ ghi nhận, không trả lời.
    for (const m of e.standby || []) {
      if (!m?.sender?.id) continue;
      ra.push({ loai: 'standby', psid: String(m.sender.id), mid: m.message?.mid || `sb_${m.sender.id}_${m.timestamp}`, luc: lucTu(m.timestamp) });
      try { require('../san-sang').ghiBusinessAi('standby'); } catch { /* chưa mở cơ sở dữ liệu */ }
    }
    for (const c of e.changes || []) {
      const v = c.value || {};
      if (c.field === 'feed' && v.item === 'comment' && v.verb === 'add') {
        const nguoiId = String(v.from?.id || '');
        if (pageId && nguoiId === String(pageId)) continue; // bình luận của chính Page (MOZA hay người trả lời)
        ra.push({ loai: 'binh_luan_bai', comment_id: String(v.comment_id), post_id: String(v.post_id || ''),
          parent_id: v.parent_id && v.parent_id !== v.post_id ? String(v.parent_id) : null,
          nguoi_id: nguoiId, ten: chuan(v.from?.name || 'Người dùng Facebook'), noi_dung: chuan(v.message || ''), luc: lucTu(v.created_time) });
      } else if (c.field === 'live_videos') {
        ra.push({ loai: 'live_doi', live_id: String(v.id || ''), trang_thai: String(v.status || '') });
      }
    }
    for (let i = dau; i < ra.length; i += 1) ra[i].page_id = pageId;
  }
  return ra;
}

module.exports = { tuWebhook, chuCuaTin, lucTu };
