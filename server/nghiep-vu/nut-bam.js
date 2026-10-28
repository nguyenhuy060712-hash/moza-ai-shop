'use strict';

/**
 * Bộ đọc nút dùng chung (SPEC.md F-65, #95): một bảng mô tả mọi loại nút MOZA gửi lên Messenger — thẻ đơn (#89), thẻ giữ hàng
 * (F-68), nhắc đơn (F-69), hỏi lại khi vào từ link m.me (F-70), thẻ mời (F-71), mẫu Utility (#99). Payload dạng
 * `LOAI|phần 1|phần 2…` (≤ 1000 ký tự — giới hạn của Meta). Trả lời nhanh (quick reply) đọc bằng cùng bộ này.
 * Mốc sau chỉ cần thêm một dòng vào bảng (BH7: cách trả tiền, danh sách chờ…).
 * Payload lạ, sai số phần, quá dài → null (không làm gì, không lỗi) — nút giả mạo không đổi được đơn.
 */

// Mỗi loại: tên các phần theo thứ tự. Phần nào có thể trống thì để trống giữa hai dấu |.
const LOAI = {
  XAC_NHAN_DON: ['don', 'tong', 'moc'], // #89 — khóa phiên bản đơn: bấm trên thẻ cũ thì không xác nhận nhầm
  SUA_DON: ['don'],
  CK_DON: ['don', 'tong', 'moc'], // F-89 [💳 Chuyển khoản] — cùng khóa phiên bản như Xác nhận đơn
  DOI_COD: ['don'], // F-89 [🔁 Trả khi nhận hàng] sau khi đã chọn chuyển khoản
  THEM_PHOI: ['don', 'sp'], // F-90 trả lời nhanh [➕ Thêm quần 15] trên thẻ đơn
  CHON_PHOI: ['don', 'pl'], // chọn phân loại của món phối → thêm vào đơn
  GOP_DON: ['tu', 'vao'], // F-90 [🔗 Gộp] đơn mới vào đơn cũ chưa gửi
  TACH_DON: ['tu'], // [Tách riêng]
  VAN_CHO: ['phien', 'pl', 'sl', 'bl'], // F-92 [🙋 Vẫn chờ] trên thẻ hết hàng
  GUI_DI: ['don'], // F-99 [Gửi đi] trên thẻ "chuẩn bị gửi"
  HEN_NGAY: ['don'], // [Hẹn ngày khác]
  HOI_MAC: ['don', 'kieu'], // F-100 [Vừa lắm] [Hơi chật] [Hơi rộng] — kieu: vua · chat · rong
  BAO_LIVE: ['dy'], // F-97 [Báo em buổi này] — dy = id lời mời trong dong_y_nhan_tin
  THOI_BAO_LIVE: ['dy'], // [Thôi]
  ANH_DONG_Y: ['lan'], // F-104 [Đồng ý] dùng ảnh khách mặc thật — lan = lần xin phép (anh_khach.lan_hoi)
  ANH_KHONG: ['lan'], // [Không]
  LUU_SO_DO: ['khach', 'cao', 'nang'], // F-91 [Lưu giúp mình] (chỉ khi công tắc bật)
  KHONG_LUU_SO_DO: ['khach'], // [Không cần]
  GIU_LEN_DON: ['don'], // F-68 [Giữ, lên đơn]
  DOI_MON: ['don', 'pl'], // F-68 [Đổi]: hiện các phân loại còn hàng của món
  DOI_PL: ['don', 'tu', 'den'], // chọn phân loại mới
  KHONG_LAY: ['don', 'pl'], // F-68 [Không lấy] (pl trống = cả đơn)
  CHON_PL: ['phien', 'pl', 'sl', 'bl'], // F-68 chốt thiếu màu / size → chọn phân loại (bl: bình luận chốt gốc)
  GIU_MOI: ['phien', 'pl'], // F-71 [Giữ cho mình]
  XEM_MAU_KHAC: ['phien', 'sp'], // F-71 [Xem màu khác]
  DAT_LAI: ['don'], // F-69 [Đặt lại] sau khi đơn hủy vì quá giờ
  DUNG_NGUOI: ['phien', 'don'], // F-70 vào từ link m.me: [Đúng, là mình]
  KHONG_PHAI: ['phien'], // [Không phải]
  MAU_XAC_NHAN: [], // nút trong mẫu Utility "đơn đang chờ xác nhận" (payload cố định; tìm đơn theo người bấm)
  MAU_SUA: [],
  MAU_KHONG_LAY: [],
  MAU_GUI_DI: [], // F-98 / F-99: mẫu "chuẩn bị gửi" (payload cố định; tìm đơn theo người bấm)
  MAU_HEN_NGAY: [],
  MAU_VUA: [], // F-100: mẫu "hỏi mặc"
  MAU_CHAT: [],
  MAU_RONG: [],
  BAT_DAU: [],
  NHU_DON_TRUOC: ['don'], // F-88 [Như đơn trước]
  DUNG_SO: ['don'], // F-88 [Dùng số 0912***678]
  MENU_DON: [], // F-88 menu cố định: Đơn của tôi
  MENU_NGUOI: [], // Gặp người thật
  MENU_XOA: [], // Xóa dữ liệu của tôi
  XAC_NHAN_XOA: [],
  THOI_XOA: [], // nút Bắt đầu của Messenger (F-70, menu ở F-88)
};

const TOI_DA = 1000;

/** Tạo payload. Phần có dấu | hoặc quá dài là lỗi lập trình (id của MOZA không bao giờ có |). */
function taoPayload(loai, o = {}) {
  const ten = LOAI[loai];
  if (!ten) throw new Error(`Loại nút lạ: ${loai}`);
  const phan = ten.map((k) => String(o[k] ?? ''));
  if (phan.some((p) => p.includes('|'))) throw new Error(`Phần nút có dấu |: ${loai}`);
  const s = [loai, ...phan].join('|');
  if (s.length > TOI_DA) throw new Error(`Payload dài quá ${TOI_DA} ký tự: ${loai}`);
  return s;
}

/**
 * Đọc payload → { ma, ...phần } hoặc null.
 * @param {string} s
 */
function docPayload(s) {
  const chu = String(s ?? '');
  if (!chu || chu.length > TOI_DA) return null;
  const [ma, ...phan] = chu.split('|');
  const ten = LOAI[ma];
  if (!ten || phan.length !== ten.length) return null;
  const kq = { ma };
  ten.forEach((k, i) => { kq[k] = phan[i]; });
  if (ma === 'XAC_NHAN_DON' || ma === 'CK_DON') kq.khoa = phan.join('|');
  return kq;
}

module.exports = { LOAI, taoPayload, docPayload };
