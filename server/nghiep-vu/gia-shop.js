'use strict';

/**
 * Chống kẻ gian giả làm shop (SPEC.md F-74, #105): bình luận của người KHÔNG phải Page có số tài khoản (6–19 chữ số kèm "stk",
 * "tk", "ck", "chuyển khoản", tên ngân hàng / ví) hoặc link lạ → ẩn, không chuyển Tư vấn viên, báo người dẫn. Nhận bằng mã,
 * 0 đồng. Câu chốt ("chốt 12 đen M"), giá ("159k"), mã đơn ("DH-0042"), số điện thoại trơn không bị nhãn này.
 * Dòng "Shop chỉ nhận tiền vào TK tên …" ở thẻ đơn và câu ghim (dongTaiKhoan).
 */

const { boDau } = require('./chung');

// Chữ báo tài khoản / chuyển tiền (đã bỏ dấu, chữ thường). YEU: chữ chung ("ck", "tk") — số trông như số điện thoại đi với chữ
// yếu thì coi là số điện thoại của người mua (#19), không phải giả shop. MANH: nói rõ tài khoản / tên ngân hàng, ví.
const TU_YEU = ['tk', 'ck', 'chuyen khoan', 'chuyen tien', 'ctk', 'nh'];
const TU_MANH = ['stk', 'so tk', 'so tai khoan', 'tai khoan', 'chu tk', 'ngan hang',
  'vietcombank', 'vcb', 'techcombank', 'tcb', 'mbbank', 'mb bank', 'mb', 'acb', 'bidv', 'vietinbank', 'vtb', 'agribank', 'tpbank', 'tp bank', 'vpbank',
  'vp bank', 'sacombank', 'scb', 'shb', 'hdbank', 'ocb', 'msb', 'vib', 'seabank', 'lpbank', 'eximbank', 'nam a', 'bac a', 'pvcombank', 'abbank',
  'kienlongbank', 'cake', 'timo', 'momo', 'zalopay', 'zalo pay', 'viettelpay', 'viettel money', 'vnpay', 'shopeepay'];
const reTu = (ds) => new RegExp(`(?<![a-z0-9])(${ds.map((x) => x.replace(/ /g, '\\s')).join('|')})(?![a-z0-9])`);
const RE_YEU = reTu(TU_YEU);
const RE_MANH = reTu(TU_MANH);
const RE_SO_DT = /^(?:84|0)[35789]\d{8}$/;
// Dãy 6–19 chữ số (cho phép cách, chấm, gạch giữa các nhóm: "1903 6688 2233").
const RE_DAY_SO = /(?<![\d])\d(?:[\s.-]?\d){5,18}(?![\d])/g;
// Link: có giao thức, www., link rút gọn / m.me, hoặc tên miền có đuôi quen thuộc. Đuôi ngắn trùng chữ Việt không dấu
// ("co" = có, "me" = mẹ, "ly") không dùng.
const RE_LINK = /\b(?:https?:\/\/|www\.)\S+|\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|shorturl\.at|cutt\.ly|m\.me)\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|vn|net|org|info|xyz|top|shop|store|site|online|click|link|live|app|io|biz)(?:\/\S*)?\b/gi;
const LINK_DUOC = [/^(?:https?:\/\/)?(?:www\.|m\.|web\.)?facebook\.com\//i, /^(?:https?:\/\/)?fb\.watch\//i];

/**
 * @param {string} noiDung
 * @param {{pageIds?: string[]}} [o]  id / tên người dùng của các Page của shop (link m.me tới Page mình thì không tính)
 * @returns {{loai:'tai_khoan'|'link', ly_do:string}|null}
 */
function laGiaShop(noiDung, { pageIds = [] } = {}) {
  const goc = String(noiDung || '');
  const s = boDau(goc).toLowerCase();
  const manh = RE_MANH.test(s);
  if (manh || RE_YEU.test(s)) {
    for (const m of s.matchAll(RE_DAY_SO)) {
      const so = m[0].replace(/\D/g, '');
      if (so.length < 6 || so.length > 19) continue;
      if (!manh && RE_SO_DT.test(so)) continue; // "số em 0912…, không ck" — số điện thoại của người mua
      return { loai: 'tai_khoan', ly_do: 'Bình luận có số tài khoản / ví của người không phải Page.' };
    }
  }
  for (const m of goc.matchAll(RE_LINK)) {
    const link = m[0];
    if (LINK_DUOC.some((re) => re.test(link))) continue;
    const mme = /^(?:https?:\/\/)?m\.me\/([^/?#\s]+)/i.exec(link);
    if (mme && pageIds.map(String).includes(decodeURIComponent(mme[1]))) continue;
    return { loai: 'link', ly_do: 'Bình luận có link lạ của người không phải Page.' };
  }
  return null;
}

/** Dòng chống giả shop ở thẻ đơn và câu ghim: có tên chủ tài khoản thì nêu tên, chưa có thì câu chung. */
function dongTaiKhoan() {
  const ten = require('./cai-dat').banHang().ten_chu_tk;
  return ten ? `Shop chỉ nhận tiền vào TK tên ${ten} và chỉ gửi mã QR trong Messenger của Page.`
    : 'Shop không bao giờ xin chuyển khoản qua bình luận.';
}

module.exports = { laGiaShop, dongTaiKhoan };
