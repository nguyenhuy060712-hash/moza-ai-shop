'use strict';

/**
 * Các Fanpage đã nối (#37: nhiều Page cùng lúc). Bảng `fb_page` chỉ giữ tên và bật/tắt;
 * mã truy cập của từng Page nằm trong .env (khoa.js), không bao giờ vào cơ sở dữ liệu.
 */

const { csdl } = require('../db/ket-noi');
const { LoiNghiepVu, gio, chuan } = require('./chung');

function doc(r) {
  return r ? { ...r, bat: r.bat === 1 } : null;
}

function danhSach() {
  return csdl().prepare('SELECT * FROM fb_page ORDER BY them_luc').all().map(doc);
}

function lay(id) {
  return doc(csdl().prepare('SELECT * FROM fb_page WHERE id = ?').get(String(id)));
}

/** Thêm Page mới (bật sẵn) hoặc cập nhật tên. */
function luu(id, ten = '') {
  csdl().prepare(`INSERT INTO fb_page (id, ten, bat, them_luc) VALUES (?, ?, 1, ?)
                  ON CONFLICT(id) DO UPDATE SET ten = CASE WHEN excluded.ten <> '' THEN excluded.ten ELSE fb_page.ten END`)
    .run(String(id), chuan(ten).slice(0, 200), gio());
  return lay(id);
}

function datBat(id, bat) {
  const r = csdl().prepare('UPDATE fb_page SET bat = ? WHERE id = ?').run(bat ? 1 : 0, String(id));
  if (!r.changes) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có Page này.', 404);
  return lay(id);
}

function xoa(id) {
  csdl().prepare('DELETE FROM fb_page WHERE id = ?').run(String(id));
}

/** Page chưa có dòng trong bảng (ví dụ mã dán thẳng vào .env) được coi là đang bật. */
function dangBat(id) {
  const p = lay(id);
  return !p || p.bat;
}

/*
 * Page bị Meta tạm khóa nhắn tin (F-73, lỗi 10/1893063 hoặc Page Integrity báo hạn chế). Giữ trong cài đặt `page_bi_cam`
 * { pageId: { luc, ly_do } } cho cả Page thật lẫn Page giả: Hook giới hạn liên hệ dừng mọi tin chủ động, chốt đơn gom công khai.
 */
function dsBiCam() {
  return require('./cai-dat').doc('page_bi_cam', {}) || {};
}

function biCam(pageId) {
  return !!dsBiCam()[String(pageId)];
}

/** @returns {boolean} trạng thái có đổi không */
function datBiCam(pageId, cam, lyDo = null) {
  const ds = dsBiCam();
  const k = String(pageId);
  if (!!ds[k] === !!cam) return false;
  if (cam) ds[k] = { luc: gio(), ly_do: lyDo };
  else delete ds[k];
  require('./cai-dat').ghi('page_bi_cam', ds);
  return true;
}

/**
 * Link m.me có mã buổi (F-70, #100): người chưa thấy tin của shop bấm là mở đúng hội thoại, MOZA nhận ra họ đến từ buổi live nào
 * (`ref=phien_<id>` — chữ, số, _, -, = theo Meta). Dùng id Page (luôn đúng; tên người dùng của Page chưa lưu).
 */
function linkMme(pageId, phienId = null) {
  return `https://m.me/${encodeURIComponent(String(pageId || ''))}${phienId ? `?ref=phien_${phienId}` : ''}`;
}

/**
 * F-78: link mở cuộc trò chuyện trong hộp thư Meta Business Suite (khi quá 24 giờ, người trả lời bằng Business Suite trên điện
 * thoại). Dạng link lấy từ thanh địa chỉ của Business Suite (tra 28/9/2026 — Meta không ghi trong tài liệu; kiểm ở Bước 0):
 * asset_id = Page, selected_item_id = người nhắn, thread_type = FB_MESSAGE. Thiếu người nhắn → hộp thư chung của Page.
 * Chỉ là link để người bấm mở: MOZA không gửi gì ra Facebook.
 */
function linkBusinessSuite(pageId, psid = null) {
  const q = new URLSearchParams({ asset_id: String(pageId || '') });
  if (psid) { q.set('mailbox_id', String(pageId || '')); q.set('selected_item_id', String(psid)); q.set('thread_type', 'FB_MESSAGE'); }
  return `https://business.facebook.com/latest/inbox/all?${q}`;
}

/** Hồ sơ Messenger của Page (F-70): nút Bắt đầu + lời chào tự nhận trợ lý AI (≤ 160 ký tự). */
function hoSoMessenger() {
  const cm = require('./cau-mau-khach');
  return {
    get_started: { payload: require('./nut-bam').taoPayload('BAT_DAU', {}) },
    greeting: [{ locale: 'default', text: cm.cau('loi_chao_messenger').slice(0, 160) }],
    // F-88: menu cố định — Đơn của tôi · Gặp người thật · Xóa dữ liệu của tôi (xử lý bằng mã, 0 AI).
    persistent_menu: [{ locale: 'default', composer_input_disabled: false, call_to_actions: [
      { type: 'postback', title: cm.cau('menu_nut_don'), payload: require('./nut-bam').taoPayload('MENU_DON', {}) },
      { type: 'postback', title: cm.cau('menu_nut_nguoi'), payload: require('./nut-bam').taoPayload('MENU_NGUOI', {}) },
      { type: 'postback', title: cm.cau('menu_nut_xoa'), payload: require('./nut-bam').taoPayload('MENU_XOA', {}) },
    ] }],
  };
}

module.exports = {
  hoSoMessenger, linkBusinessSuite, danhSach, lay, luu, datBat, xoa, dangBat, dsBiCam, biCam, datBiCam, linkMme };
