'use strict';

/**
 * Bộ dựng tin Messenger dùng chung (SPEC.md F-15 mở rộng, F-65, #92): một "thẻ trung tính" → `message` đúng dạng Send API.
 * Cả Facebook thật (that.js) và Meta giả (meta-gia.js) đều đi qua đây, nên thẻ quá dài hay sai dạng bị chặn ở CẢ hai bản
 * (trước đây bản thật âm thầm cắt chữ bằng `slice`, bản giả không kiểm gì — L2 ở docs/07).
 *
 * Thẻ trung tính:
 *   { kieu: 'chu',   chu, tra_loi_nhanh? }                                  tin chữ (có thể kèm trả lời nhanh)
 *   { kieu: 'nut',   chu, nut: [1–3], tra_loi_nhanh? }                      chữ ≤ 640 + nút (button template)
 *   { kieu: 'anh',   tieu_de, phu_de, anh: {url|attachment_id}, nut: [0–3], tra_loi_nhanh? }   thẻ ảnh (generic template, 1 thẻ)
 *   { kieu: 'luoi',  o: [{ tieu_de, anh: {url}, payload }] (2–6), tra_loi_nhanh? }             hàng thẻ ảnh để chọn (generic, nhiều thẻ)
 *   { kieu: 'media', anh: {attachment_id|url}, nut: [0–3] }                 ảnh đã tải lên + nút (media template, không có chữ)
 *   nut:           { tieu_de, payload, kieu?: 'postback'|'goi', so? }
 *   tra_loi_nhanh: { tieu_de, payload, kieu?: 'chu'|'so_dien_thoai' }
 *
 * Giới hạn (tài liệu Send API của Meta, tra 27/9/2026 — hanh-vi-meta.json H01, H04–H06): nút ≤ 3, tiêu đề nút ≤ 20 ký tự,
 * chữ button template ≤ 640, tiêu đề / phụ đề thẻ ảnh ≤ 80, hàng thẻ 2–6 thẻ (MOZA tự giới hạn 6 cho dễ nhìn trên điện thoại,
 * Meta cho tới 10), tiêu đề ô trong hàng ≤ 45 (để không bị cắt trên điện thoại hẹp), trả lời nhanh ≤ 13 nút, nhãn ≤ 20,
 * payload ≤ 1000. Đếm theo ký tự Unicode (emoji tính 1–2 ký tự như Meta đếm theo UTF-16 — dùng `.length` của JavaScript).
 */

const { LoiNghiepVu } = require('../nghiep-vu/chung');

const GIOI_HAN = Object.freeze({
  nut: 3, tieu_de_nut: 20, chu_the: 640, chu_tin: 2000, tieu_de_anh: 80, phu_de_anh: 80,
  luoi_it: 2, luoi_nhieu: 6, tieu_de_o: 45, tra_loi_nhanh: 13, nhan_nhanh: 20, payload: 1000,
});

const dai = (s) => String(s ?? '').length;

function kiemNut(ds, loi, noi) {
  if (!Array.isArray(ds)) return;
  if (ds.length > GIOI_HAN.nut) loi.push(`${noi}: tối đa ${GIOI_HAN.nut} nút (đang ${ds.length})`);
  ds.forEach((n, i) => {
    if (!dai(n?.tieu_de)) loi.push(`${noi}: nút ${i + 1} thiếu tiêu đề`);
    if (dai(n?.tieu_de) > GIOI_HAN.tieu_de_nut) loi.push(`${noi}: tiêu đề nút "${n.tieu_de}" dài quá ${GIOI_HAN.tieu_de_nut} ký tự`);
    if ((n?.kieu || 'postback') === 'goi') {
      if (!/^\+\d{8,15}$/.test(String(n.so || ''))) loi.push(`${noi}: nút gọi cần số dạng +84…`);
    } else {
      if (!dai(n?.payload)) loi.push(`${noi}: nút "${n?.tieu_de}" thiếu payload`);
      if (dai(n?.payload) > GIOI_HAN.payload) loi.push(`${noi}: payload nút "${n.tieu_de}" dài quá ${GIOI_HAN.payload} ký tự`);
    }
  });
}

function kiemNhanh(ds, loi) {
  if (!ds) return;
  if (!Array.isArray(ds) || !ds.length) { loi.push('trả lời nhanh: danh sách trống'); return; }
  if (ds.length > GIOI_HAN.tra_loi_nhanh) loi.push(`trả lời nhanh: tối đa ${GIOI_HAN.tra_loi_nhanh} nút (đang ${ds.length})`);
  for (const q of ds) {
    if (q?.kieu === 'so_dien_thoai') continue;
    if (!dai(q?.tieu_de)) loi.push('trả lời nhanh: thiếu nhãn');
    if (dai(q?.tieu_de) > GIOI_HAN.nhan_nhanh) loi.push(`trả lời nhanh: nhãn "${q.tieu_de}" dài quá ${GIOI_HAN.nhan_nhanh} ký tự`);
    if (!dai(q?.payload) || dai(q?.payload) > GIOI_HAN.payload) loi.push(`trả lời nhanh: payload của "${q?.tieu_de}" trống hoặc dài quá`);
  }
}

/**
 * Kiểm một thẻ theo giới hạn của Meta. Trả danh sách lỗi bằng lời thường; rỗng = hợp lệ.
 * @param {object} the
 * @returns {string[]}
 */
function kiemThe(the) {
  const loi = [];
  if (!the || typeof the !== 'object') return ['thẻ trống'];
  switch (the.kieu) {
    case 'chu':
      if (!dai(the.chu)) loi.push('tin chữ trống');
      if (dai(the.chu) > GIOI_HAN.chu_tin) loi.push(`tin chữ dài quá ${GIOI_HAN.chu_tin} ký tự`);
      break;
    case 'nut':
      if (!dai(the.chu)) loi.push('thẻ nút thiếu chữ');
      if (dai(the.chu) > GIOI_HAN.chu_the) loi.push(`chữ thẻ dài ${dai(the.chu)} ký tự, quá ${GIOI_HAN.chu_the}`);
      if (!Array.isArray(the.nut) || !the.nut.length) loi.push('thẻ nút cần ít nhất 1 nút');
      kiemNut(the.nut, loi, 'thẻ nút');
      break;
    case 'anh':
      if (!dai(the.tieu_de)) loi.push('thẻ ảnh thiếu tiêu đề');
      if (dai(the.tieu_de) > GIOI_HAN.tieu_de_anh) loi.push(`tiêu đề thẻ ảnh dài quá ${GIOI_HAN.tieu_de_anh} ký tự`);
      if (dai(the.phu_de) > GIOI_HAN.phu_de_anh) loi.push(`phụ đề thẻ ảnh dài ${dai(the.phu_de)} ký tự, quá ${GIOI_HAN.phu_de_anh}`);
      if (!the.anh?.url) loi.push('thẻ ảnh cần địa chỉ ảnh (image_url)');
      kiemNut(the.nut || [], loi, 'thẻ ảnh');
      break;
    case 'luoi': {
      const o = Array.isArray(the.o) ? the.o : [];
      if (o.length < GIOI_HAN.luoi_it || o.length > GIOI_HAN.luoi_nhieu) loi.push(`hàng thẻ cần ${GIOI_HAN.luoi_it}–${GIOI_HAN.luoi_nhieu} ô (đang ${o.length})`);
      o.forEach((x, i) => {
        if (!dai(x?.tieu_de) || dai(x.tieu_de) > GIOI_HAN.tieu_de_o) loi.push(`ô ${i + 1}: tiêu đề trống hoặc dài quá ${GIOI_HAN.tieu_de_o} ký tự`);
        if (!x?.anh?.url) loi.push(`ô ${i + 1}: thiếu ảnh`);
        if (!dai(x?.payload) || dai(x.payload) > GIOI_HAN.payload) loi.push(`ô ${i + 1}: payload trống hoặc dài quá`);
      });
      break;
    }
    case 'media':
      // Media template chỉ nhận ảnh đã tải lên Meta (url phải là địa chỉ của Facebook) — tra 27/9/2026.
      if (!the.anh?.attachment_id) loi.push('thẻ media cần ảnh đã tải lên (attachment_id)');
      kiemNut(the.nut || [], loi, 'thẻ media');
      break;
    default:
      loi.push(`kiểu thẻ lạ: ${the.kieu}`);
  }
  kiemNhanh(the.tra_loi_nhanh, loi);
  return loi;
}

function nutRa(n) {
  if ((n.kieu || 'postback') === 'goi') return { type: 'phone_number', title: n.tieu_de, payload: n.so };
  return { type: 'postback', title: n.tieu_de, payload: n.payload };
}

function nhanhRa(q) {
  if (q.kieu === 'so_dien_thoai') return { content_type: 'user_phone_number' };
  return { content_type: 'text', title: q.tieu_de, payload: q.payload };
}

function anhRa(a) {
  return a.attachment_id ? { attachment_id: String(a.attachment_id) } : { url: a.url };
}

/**
 * Thẻ trung tính → `message` của Send API. Thẻ sai giới hạn thì báo lỗi THE_KHONG_HOP_LE (không cắt chữ âm thầm).
 * @returns {object}
 */
function dungTin(the) {
  const loi = kiemThe(the);
  if (loi.length) throw new LoiNghiepVu('THE_KHONG_HOP_LE', `Thẻ Messenger chưa đúng giới hạn của Meta: ${loi.join('; ')}.`);
  let m;
  if (the.kieu === 'chu') m = { text: String(the.chu) };
  else if (the.kieu === 'nut') {
    m = { attachment: { type: 'template', payload: { template_type: 'button', text: String(the.chu), buttons: the.nut.map(nutRa) } } };
  } else if (the.kieu === 'anh') {
    const e = { title: String(the.tieu_de), image_url: the.anh.url };
    if (dai(the.phu_de)) e.subtitle = String(the.phu_de);
    if (the.nut?.length) e.buttons = the.nut.map(nutRa);
    m = { attachment: { type: 'template', payload: { template_type: 'generic', elements: [e] } } };
  } else if (the.kieu === 'luoi') {
    m = { attachment: { type: 'template', payload: { template_type: 'generic', elements: the.o.map((x) => ({
      title: String(x.tieu_de), image_url: x.anh.url, buttons: [{ type: 'postback', title: 'Chọn', payload: x.payload }],
    })) } } };
  } else {
    const e = { media_type: 'image', ...anhRa(the.anh) };
    if (the.nut?.length) e.buttons = the.nut.map(nutRa);
    m = { attachment: { type: 'template', payload: { template_type: 'media', elements: [e] } } };
  }
  if (the.tra_loi_nhanh?.length) m.quick_replies = the.tra_loi_nhanh.map(nhanhRa);
  return m;
}

/**
 * Ngược lại: `message` của Send API → thẻ trung tính (Meta giả đọc thân tin mà that.js gửi, để cùng một bộ luật kiểm cả
 * hai bản). Dạng lạ → null.
 */
function docTin(m) {
  if (!m || typeof m !== 'object') return null;
  const nhanh = Array.isArray(m.quick_replies)
    ? m.quick_replies.map((q) => (q.content_type === 'user_phone_number' ? { kieu: 'so_dien_thoai', tieu_de: '📞 Số điện thoại', payload: 'SO_DIEN_THOAI' }
      : { tieu_de: q.title, payload: q.payload }))
    : undefined;
  const them = nhanh ? { tra_loi_nhanh: nhanh } : {};
  const nutVao = (b) => (b.type === 'phone_number' ? { kieu: 'goi', tieu_de: b.title, so: b.payload } : { tieu_de: b.title, payload: b.payload });
  if (typeof m.text === 'string') return { kieu: 'chu', chu: m.text, ...them };
  const p = m.attachment?.payload;
  if (m.attachment?.type !== 'template' || !p) return null;
  if (p.template_type === 'button') return { kieu: 'nut', chu: p.text, nut: (p.buttons || []).map(nutVao), ...them };
  if (p.template_type === 'generic') {
    const ds = p.elements || [];
    if (ds.length === 1 && !(ds[0].buttons?.length === 1 && ds[0].buttons[0].title === 'Chọn')) {
      return { kieu: 'anh', tieu_de: ds[0].title, phu_de: ds[0].subtitle || '', anh: { url: ds[0].image_url }, nut: (ds[0].buttons || []).map(nutVao), ...them };
    }
    return { kieu: 'luoi', o: ds.map((e) => ({ tieu_de: e.title, anh: { url: e.image_url }, payload: e.buttons?.[0]?.payload })), ...them };
  }
  if (p.template_type === 'media') {
    const e = p.elements?.[0] || {};
    return { kieu: 'media', anh: e.attachment_id ? { attachment_id: e.attachment_id } : { url: e.url }, nut: (e.buttons || []).map(nutVao), ...them };
  }
  return null;
}

/** Chữ tóm tắt của thẻ (lưu vào Hộp thư, hiện trong khung chat giả, cho người đọc lại). */
function chuCuaThe(the) {
  if (!the) return '';
  const phan = [];
  if (the.kieu === 'chu' || the.kieu === 'nut') phan.push(String(the.chu || ''));
  if (the.kieu === 'anh') phan.push([the.tieu_de, the.phu_de].filter(Boolean).join('\n'));
  if (the.kieu === 'luoi') phan.push(`[${the.o.length} lựa chọn có ảnh: ${the.o.map((x) => x.tieu_de).join(' | ')}]`);
  if (the.kieu === 'media') phan.push('[ảnh]');
  if (the.nut?.length) phan.push(`[Nút: ${the.nut.map((n) => n.tieu_de).join(' | ')}]`);
  if (the.tra_loi_nhanh?.length) phan.push(`[Chọn nhanh: ${the.tra_loi_nhanh.map((q) => q.tieu_de).join(' | ')}]`);
  return phan.filter(Boolean).join('\n');
}

/** Mọi nút bấm được của thẻ (nút + ô trong hàng + trả lời nhanh), để khung chat giả vẽ và khách giả bấm. */
function nutCuaThe(the) {
  if (!the) return [];
  const ds = [];
  for (const n of the.nut || []) if ((n.kieu || 'postback') !== 'goi') ds.push({ tieu_de: n.tieu_de, payload: n.payload, loai: 'nut' });
  for (const o of the.o || []) ds.push({ tieu_de: o.tieu_de, payload: o.payload, loai: 'o', anh: o.anh?.url || null });
  for (const q of the.tra_loi_nhanh || []) if (q.kieu !== 'so_dien_thoai') ds.push({ tieu_de: q.tieu_de, payload: q.payload, loai: 'nhanh' });
  return ds;
}

module.exports = { GIOI_HAN, kiemThe, dungTin, docTin, chuCuaThe, nutCuaThe };
