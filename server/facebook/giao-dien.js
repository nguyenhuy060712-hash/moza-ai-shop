'use strict';

/**
 * Hợp đồng chung của bộ Kết nối Facebook (SPEC.md mục 5, nguyên tắc 5; bản 3.4 F-15 mở rộng: kiểm đủ MỌI hàm, kể cả Hộp thư).
 *
 * Có hai bản dùng CÙNG hợp đồng này, phần còn lại của phần mềm không cần biết đang dùng bản nào:
 *   - `gia.js`  : Facebook giả của Phòng diễn tập — chạy trên Meta giả (meta-gia.js), không có đoạn mã nào gọi ra mạng;
 *   - `that.js` : Graph API thật.
 * test/hop-dong-facebook.test.js chạy cùng kịch bản trên hai bản (bản thật nối fetch giả vào Meta giả) → cùng kết quả, cùng mã lỗi.
 *
 * Live:     ten · chuKyTimLiveMs · timLiveDangPhat() → [{id, tieu_de, bat_dau, video_id, nguoi_xem, fb_link, page_id}]
 *           moLuongBinhLuan(liveId, fn, khiLoi) → {dong()} · docBinhLuan(liveId, sauLuc) · anBinhLuan(id, pageId?)
 * Hộp thư:  guiTinNhan · guiAnh · guiThe · guiTheSp · guiLuaChon · guiUtility · taoMauUtility · trangThaiMau · taiAnhLen
 *           traLoiBinhLuan · coTheNhanRieng · nhanRieng · nhanRiengThe · layTenNguoi · docTinMoi
 * Page:     datHoSoMessenger (nút Bắt đầu, menu) · kiemHanChePage (Page Integrity)
 * Xem lại:  docBinhLuanVideo (bình luận trên video xem lại của live đã xong — F-94) · dangBinhLuan (Page bình luận mục lục lên video)
 */

const BAT_BUOC = ['ten', 'chuKyTimLiveMs', 'timLiveDangPhat', 'moLuongBinhLuan', 'docBinhLuan', 'anBinhLuan',
  'guiTinNhan', 'guiAnh', 'guiThe', 'guiTheSp', 'guiLuaChon', 'guiUtility', 'taoMauUtility', 'trangThaiMau', 'taiAnhLen',
  'traLoiBinhLuan', 'coTheNhanRieng', 'nhanRieng', 'nhanRiengThe', 'layTenNguoi', 'docTinMoi', 'datHoSoMessenger', 'kiemHanChePage',
  'docBinhLuanVideo', 'dangBinhLuan'];

function kiemHopDong(ketNoi) {
  const thieu = BAT_BUOC.filter((k) => ketNoi[k] === undefined);
  if (thieu.length) throw new Error(`Bộ Kết nối Facebook thiếu: ${thieu.join(', ')}`);
  return ketNoi;
}

module.exports = { kiemHopDong, BAT_BUOC };
