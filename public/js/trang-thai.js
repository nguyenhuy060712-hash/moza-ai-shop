// Một bảng trạng thái duy nhất (GD1, docs/11 mục 3.4): mã → chữ + màu (ok · warn · bad · info · mute) + biểu tượng.
// Màu cố định theo nghĩa: xanh lá = ổn, vàng = cần để ý, đỏ = hỏng / gấp, xanh dương = đang chạy, xám = không còn việc.
// Mọi chip trạng thái trong giao diện đi qua đây; không tự đặt bảng màu riêng ở từng màn hình.

import { h } from './ui.js';

export const BIEU_TUONG = { ok: '✓', warn: '!', bad: '✕', info: '●', mute: '○' };

const T = (ten, mau) => ({ ten, mau });

export const BANG = {
  don: {
    cho_xac_nhan: T('Chờ xác nhận', 'warn'), da_xac_nhan: T('Cần gửi', 'info'), da_gui: T('Đã gửi', 'info'),
    da_giao: T('Đã giao', 'ok'), hoan: T('Hoàn', 'bad'), da_huy: T('Đã hủy', 'mute'),
    thieu_thong_tin: T('Thiếu thông tin', 'warn'), cho_tien: T('Chờ tiền CK', 'warn'),
  },
  san_pham: { nhap: T('Nháp', 'mute'), dang_ban: T('Đang bán', 'ok'), ngung_ban: T('Ngừng bán', 'bad') },
  kho: { con: T('Còn hàng', 'ok'), it: T('Sắp hết', 'warn'), het: T('Hết hàng', 'bad') },
  phien: { cho_live: T('Đang chờ live', 'warn'), dang_live: T('Đang live', 'bad'), xong: T('Đã xong', 'mute') },
  muc: { cho_phep: T('Cho phép', 'ok'), hoi: T('Hỏi', 'warn'), cam: T('Cấm', 'bad') },
  ban: { dang_dung: T('Đang dùng', 'ok'), nhap: T('Nháp', 'warn'), cu: T('Bản cũ', 'mute') },
  duyet: { cho_duyet: T('Chờ duyệt', 'warn'), da_duyet: T('Đã duyệt', 'ok'), bo: T('Đã bỏ', 'mute'), het_han: T('Đã hết hạn', 'mute') },
  nhat_ky: { mai: T('Mai', 'info'), doi_ai: T('Đội AI', 'info'), nguoi_dan: T('Người dẫn', 'mute'), man_hinh: T('Màn hình', 'mute'),
    su_kien: T('Sự kiện', 'warn'), cohost: T('Co-host', 'ok'), chot: T('Chốt', 'ok') },
  muc_viec: { gap: T('Gấp', 'bad'), sap_het: T('Sắp hết', 'warn'), nen_lam: T('Nên làm', 'info') },
  doi_ai: { cho_viec: T('Chờ việc', 'mute'), dang_lam: T('Đang làm', 'info'), dien_tap: T('Diễn tập', 'warn'), tat: T('Tắt', 'mute'),
    dung_tran: T('Dừng vì trần', 'bad') },
  hop_thu: { moi: T('Mới', 'info'), ai_dang_xu_ly: T('AI đang xử lý', 'info'), can_nguoi: T('Cần người', 'bad'), nguoi_dang_xu_ly: T('Tôi đang xử lý', 'info'),
    cho_phan_hoi: T('Chờ phản hồi', 'mute'), xong: T('Xong', 'ok'), spam: T('Spam', 'mute') },
  kenh: { xanh: T('Ổn', 'ok'), vang: T('Cần xem', 'warn'), do: T('Hỏng', 'bad') },
};

const MAU_HOP_LE = new Set(['ok', 'warn', 'bad', 'info', 'mute']);

export function thongTin(loai, ma) {
  return BANG[loai]?.[ma] || { ten: String(ma ?? ''), mau: 'mute' };
}

/** Chip trạng thái: biểu tượng + chữ ngắn, màu theo nghĩa. `chu` ghi đè chữ khi cần (vẫn giữ màu). */
export function chipMau(mau, chu, { href, title } = {}) {
  const m = MAU_HOP_LE.has(mau) ? mau : 'mute';
  return h(href ? 'a' : 'span', { class: `chip ${m}`, href, title }, h('span', { class: 'bt', 'aria-hidden': 'true' }, BIEU_TUONG[m]), chu);
}

export function chipTrangThai(loai, ma, chu) {
  const t = thongTin(loai, ma);
  return chipMau(t.mau, chu ?? t.ten);
}
