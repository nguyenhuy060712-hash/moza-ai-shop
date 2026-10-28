'use strict';

/**
 * Gửi thẻ đơn hàng và tin của hệ thống qua Messenger (#89). Từ bản 3.4 (F-65, #95) mọi tin ở đây đi qua MỘT đường:
 * công cụ nội bộ `gui_the_moza` (thucHienCongCu) — nên qua đủ hook: "Dừng mọi thứ" → mục chờ duyệt (trước đây bỏ im),
 * luật quyền, luật gửi Hộp thư (24 giờ, người đang giữ hội thoại), giới hạn liên hệ (F-66), tự nhận trợ lý AI.
 * Thẻ chỉ gửi vào hội thoại Messenger khách đã nhắn trong 24 giờ; ngoài 24 giờ dùng bộ mẫu Utility (Meta duyệt, chỉ khi xếp
 * loại UTILITY — #99).
 */

const hopThu = require('./nghiep-vu/hop-thu');
const theDon = require('./nghiep-vu/the-don');
const mauUtility = require('./nghiep-vu/mau-utility');

const NGAY_MS = 24 * 3600 * 1000;
// Giữ cho mã cũ đọc: mẫu "đơn đã gửi" của #89 (nay trong bộ mẫu server/cau-hinh/mau-utility.json).
const MAU_DA_GUI = { ten: mauUtility.BO.da_gui.ten, ngon_ngu: 'vi', noi_dung: mauUtility.BO.da_gui.noi_dung };

/** Hội thoại Messenger của người mua (của đơn trước), tùy chọn chỉ lấy hội thoại còn trong 24 giờ. */
function hoiThoaiMessenger(d, { trong24 = true, boQuaTamDung = false } = {}) {
  for (const id of hopThu.hoiThoaiMessengerCua({ hoiThoaiId: d.hoi_thoai_id, nguoiFbId: d.nguoi_fb_id })) {
    const h = hopThu.layHoiThoai(id);
    if (h.ai_tam_dung && trong24 && !boQuaTamDung) continue;
    if (!trong24 || (h.tin_khach_cuoi_luc && Date.now() - new Date(h.tin_khach_cuoi_luc).getTime() < NGAY_MS)) return h;
  }
  return null;
}

/**
 * Một lần gửi qua gui_the_moza.
 * @returns {Promise<{da_gui:boolean, cho_duyet?:boolean, ma?:string, ly_do?:string, doi_den?:string, psid?:string, tin_nhan_id?:string}>}
 */
async function guiMoza({ h, dich = 'messenger', the, mucDich = 'tra_loi', khoa, binhLuanFbId = null, donId = null, layKetNoi }) {
  const { thucHienCongCu } = require('./agent/thuc-hien');
  const thamSo = { hoi_thoai_id: h.id, dich, the, muc_dich: mucDich, khoa };
  if (binhLuanFbId) thamSo.binh_luan_fb_id = binhLuanFbId;
  if (donId) thamSo.don_id = donId;
  const kq = await thucHienCongCu({ ten: 'gui_the_moza', thamSo, nguCanh: { hoiThoaiId: h.id, layKetNoi, guiBoi: 'he_thong' } });
  if (kq.choDuyet) return { da_gui: false, cho_duyet: true, ma: kq.loi?.ma, ly_do: '"Dừng mọi thứ" đang bật: tin vào hàng chờ duyệt.' };
  if (kq.loi) return { da_gui: false, ma: kq.loi.ma, ly_do: kq.loi.thong_diep };
  return { da_gui: !!kq.ketQua?.da_gui, trung: !!kq.ketQua?.trung, psid: kq.ketQua?.psid, tin_nhan_id: kq.ketQua?.tin_nhan_id };
}

/**
 * Gửi thẻ đơn (nếu đơn đủ thông tin và phiên bản này chưa gửi).
 * @returns {Promise<{da_gui:boolean, ly_do?:string, hoi_thoai_id?:string, cho_duyet?:boolean}>}
 */
async function guiTheDon({ d, layKetNoi }) {
  const ng = theDon.nenGui(d);
  if (!ng.gui) return { da_gui: false, ly_do: ng.ly_do, da_gui_truoc: !!ng.da_gui };
  const h = hoiThoaiMessenger(d);
  if (!h) return { da_gui: false, ly_do: 'Khách chưa nhắn Messenger cho Page trong 24 giờ qua: chưa gửi thẻ đơn được. Mời khách nhắn tin cho Page.' };
  const the = { kieu: 'nut', chu: theDon.noiDung(d), nut: theDon.nut(d) };
  const phoi = theDon.nhanhPhoi(d); // F-90: một món phối, mỗi người 1 lần / 24 giờ
  if (phoi) the.tra_loi_nhanh = phoi.nhanh;
  const kq = await guiMoza({ h, the, mucDich: 'bao_don', khoa: `the:${theDon.khoaPhienBan(d)}`, donId: d.id, layKetNoi });
  if (kq.trung) { theDon.daGuiThe(d); return { da_gui: false, ly_do: 'Thẻ này đã gửi rồi.', da_gui_truoc: true }; }
  if (!kq.da_gui) return { da_gui: false, ly_do: kq.cho_duyet ? kq.ly_do : `Gửi thẻ đơn lỗi: ${kq.ly_do}`, cho_duyet: kq.cho_duyet };
  theDon.daGuiThe(d);
  if (phoi) require('./nghiep-vu/don').ghiGoiYPhoi(d.id);
  return { da_gui: true, hoi_thoai_id: h.id };
}

/** Tin chữ của hệ thống (trả lời nút bấm) vào đúng hội thoại. `the` thay chữ trơn khi cần nút / trả lời nhanh. */
async function guiTinHeThong({ h, noiDung, the = null, khoa, layKetNoi, mucDich = 'tra_loi', donId = null }) {
  return guiMoza({ h, the: the || { kieu: 'chu', chu: String(noiDung) }, mucDich, khoa, donId, layKetNoi });
}

/**
 * Mẫu tin Utility (bộ mẫu #99): gửi được khi đã quá 24 giờ. Chỉ khi Meta đã duyệt và xếp UTILITY (MARKETING thì không gửi).
 * @param {'da_gui'|'cho_xac_nhan'|'da_huy'} loai
 */
async function guiUtility({ d, loai, layKetNoi, mucDich = 'bao_don' }) {
  const h = hoiThoaiMessenger(d, { trong24: false });
  if (!h) return { da_gui: false, ly_do: 'Khách chưa từng nhắn Messenger.' };
  const m = mauUtility.mau(loai, { dienTap: h.dien_tap });
  if (!m) return { da_gui: false, ly_do: 'Chưa có mẫu tin Utility (Cài đặt → Facebook → Tạo bộ mẫu tin).' };
  const fb = layKetNoi({ dien_tap: h.dien_tap });
  try {
    const tt = await fb.trangThaiMau({ page_id: h.page_id, ten: m.ten });
    if (!tt || tt.trang_thai !== 'APPROVED' || tt.loai !== 'UTILITY') {
      return { da_gui: false, ma: 'MAU_CHUA_DUNG_DUOC', ly_do: `Mẫu "${m.ten}" chưa dùng được (${tt ? `${tt.trang_thai}, ${tt.loai}` : 'chưa có trên Page'}): Meta phải duyệt và xếp loại UTILITY.` };
    }
  } catch (e) {
    return { da_gui: false, ma: e.ma, ly_do: e.message };
  }
  return guiMoza({ h, dich: 'utility', the: { loai }, mucDich, khoa: `utility:${loai}:${d.id}`, donId: d.id, layKetNoi });
}

/**
 * Tin trạng thái đơn do máy soạn (F-98, #120) — không gọi AI: còn trong 24 giờ kể từ tin cuối của khách → câu mẫu (có thể kèm nút);
 * ngoài 24 giờ → mẫu Utility cùng loại (chỉ khi Meta duyệt + xếp UTILITY). Khách đã DỪNG → không gửi, tạo việc cho người.
 * @param {'da_gui'|'da_xac_nhan'|'chuan_bi_gui'|'hoi_mac'} loai
 * @param {object} [o.the]  thẻ thay chữ trơn trong 24 giờ (câu có nút)
 * @returns {Promise<{da_gui:boolean, cach?:'cau_mau'|'utility', ly_do?:string, viec?:boolean}>}
 */
async function guiTrangThai({ d, loai, layKetNoi, chu = null, the = null, mucDich = 'bao_don' }) {
  const lienHe = require('./nghiep-vu/lien-he');
  if (d.nguoi_fb_id && lienHe.daNgung(d.nguoi_fb_id)) {
    require('./nghiep-vu/khach').taoViec({ loai: 'goi_khach', noiDung: `Khách đã gõ DỪNG nên MOZA không nhắn "${mauUtility.TEN[loai] || loai}" cho đơn ${d.ma}${d.sdt_nhan ? ` — gọi ${require('./nghiep-vu/don').cheSo(d.sdt_nhan)} nếu cần` : ''}.`,
      khachId: d.khach_id, hoiThoaiId: d.hoi_thoai_id, donId: d.id, taoBoi: 'ai', dienTap: d.dien_tap });
    return { da_gui: false, viec: true, ly_do: 'Khách đã gõ DỪNG.' };
  }
  const h = hoiThoaiMessenger(d);
  if (h) {
    const kq = await guiMoza({ h, the: the || { kieu: 'chu', chu: String(chu) }, mucDich, khoa: `trang_thai:${loai}:${d.id}`, donId: d.id, layKetNoi });
    return { ...kq, da_gui: kq.da_gui || !!kq.trung, cach: 'cau_mau' };
  }
  const kq = await guiUtility({ d, loai, layKetNoi, mucDich });
  return { ...kq, cach: 'utility' };
}

/** Báo "đơn đã gửi" bằng mẫu Utility khi đã quá 24 giờ (#89). */
async function guiUtilityDaGui({ d, layKetNoi }) {
  return guiUtility({ d, loai: 'da_gui', layKetNoi });
}

module.exports = { guiMoza, guiTheDon, guiTinHeThong, guiUtility, guiUtilityDaGui, guiTrangThai, hoiThoaiMessenger, MAU_DA_GUI };
