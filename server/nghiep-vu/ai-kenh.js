'use strict';

/**
 * GD1 (F-120, F-121): chỗ gom cho giao diện — bảng "AI & kênh", "Cần xử lý" của Cài đặt, "Đội AI như nhân viên" và
 * "Chỉ số AI 7 ngày" của trang Hôm nay. Chỉ ĐỌC dữ liệu có sẵn (agent, agent_run, nhat_ky_hook, cho_duyet, san-sang);
 * không đổi nghiệp vụ nào.
 */

const { csdl } = require('../db/ket-noi');
const caiDat = require('./cai-dat');
const chiPhi = require('./chi-phi');
const khoa = require('../khoa');

/** Tên việc dễ hiểu cho từng agent (người dùng thường không cần biết tên kỹ thuật). */
const TEN_VIEC = {
  director: { ten: 'Điều phối buổi live', ghi_chu: 'Chọn việc kế tiếp trong lúc live (chốt đơn, trả lời, nhắc món).' },
  cohost: { ten: 'Mai trả lời bình luận', ghi_chu: 'Co-host: trả lời bình luận trên bài và trên live.' },
  tu_van: { ten: 'Mai tư vấn Messenger', ghi_chu: 'Trả lời tin nhắn riêng của khách theo Sổ tay shop.' },
  nguoi_dong_vai: { ten: 'Người xem giả (diễn tập)', ghi_chu: 'Chỉ chạy trong Phòng diễn tập.' },
  soat_san_pham: { ten: 'Soát thông tin sản phẩm', ghi_chu: 'Báo sản phẩm còn thiếu thông tin cho Mai.' },
  bai_hoc: { ten: 'Rút bài học từ câu bị 👎', ghi_chu: 'Chỉ đề xuất, bạn duyệt mới ghi.' },
  soan_kich_ban: { ten: 'Soạn kịch bản buổi live', ghi_chu: 'AI soạn nháp, bạn sửa và duyệt.' },
  doc_anh: { ten: 'Đọc ảnh để tạo sản phẩm', ghi_chu: 'Ô nào AI điền sẽ có nhãn "AI đoán".' },
  quan_ly: { ten: 'Nói với Mai (quản lý shop)', ghi_chu: 'Ô gõ lệnh ở đầu mọi màn hình; việc có ghi nằm chờ bạn bấm Làm.' },
  doc_chot: { ten: 'Đọc chốt khó', ghi_chu: 'Chỉ chạy khi bình luận chốt khó đọc bằng quy tắc.' },
  tim_mau: { ten: 'Tìm mẫu theo ảnh khách gửi', ghi_chu: 'Gợi ý sản phẩm giống ảnh khách gửi.' },
  khach_gia: { ten: 'Khách giả (diễn tập)', ghi_chu: 'Chỉ chạy trong Phòng diễn tập.' },
  soan_bai: { ten: 'Soạn bài báo trước buổi live', ghi_chu: 'Bài nháp để bạn chép đăng Page.' },
  tong_ket: { ten: 'Tổng kết sau buổi live', ghi_chu: 'Viết gợi ý từ số liệu gộp, không có tên khách.' },
  nhin_mon: { ten: 'MOZA nhìn món đang cầm', ghi_chu: 'Đoán món theo hình camera; bạn xác nhận.' },
};

const tenViec = (a) => TEN_VIEC[a.id] || { ten: a.ten || a.id, ghi_chu: '' };

/** Bảng "AI & kênh": mỗi việc AI một dòng — Bật/Tắt (cờ agent), đã dùng hôm nay, ghi chú; kèm trần chi phí hôm nay. */
function bang() {
  const cp = chiPhi.tongQuan();
  const homNay = Object.fromEntries(cp.theo_agent.map((x) => [x.agent_id, x]));
  return {
    dung_ai: caiDat.dungAi(),
    khan_cap: caiDat.khanCap(),
    tran_ngay_usd: cp.tran_ngay_ap_dung,
    da_dung_ngay_usd: cp.ngay,
    dong: caiDat.danhSachAgent().filter((a) => !a.thu_nghiem).map((a) => ({
      id: a.id, ...tenViec(a), bat: a.bat,
      so_lan: homNay[a.id]?.so_lan || 0, usd: homNay[a.id]?.usd || 0,
    })),
  };
}

/** "Cần xử lý" đầu Cài đặt: chỉ cài đặt đang chặn việc. Mỗi dòng: { ma, muc: do|vang, chu, nut: { chu, muc_cai_dat?|den? } }. */
function canXuLy(dv = null) {
  const ds = [];
  const them = (ma, muc, chu, nut) => { if (!ds.some((x) => x.ma === ma)) ds.push({ ma, muc, chu, nut }); };

  const thieuKhoa = caiDat.nhaDangDung().filter((n) => !khoa.lay(n)).map((n) => khoa.NHAN[n] || n);
  if (thieuKhoa.length) them('thieu_khoa', 'do', `Thiếu khóa AI: ${thieuKhoa.join(', ')}. Chưa có khóa thì phần AI tương ứng không chạy.`, { chu: 'Dán khóa', muc_cai_dat: 'khoa-ai' });

  try {
    const fb = (dv || require('../dich-vu').dichVu()).ketNoiFb.trangThaiGon();
    if (fb.muc === 'do') them('fb', 'do', `${fb.chu}. Lấy mã mới ở phần Facebook.`, { chu: 'Mở Facebook', muc_cai_dat: 'facebook' });
    else if (!fb.ket_noi) them('fb_chua_noi', 'vang', 'Facebook chưa nối: buổi live thật chưa đọc được bình luận.', { chu: 'Nối Facebook', muc_cai_dat: 'facebook' });
  } catch { /* chưa có dịch vụ (test nghiệp vụ): bỏ phần Facebook */ }

  const thieuShop = Object.fromEntries(caiDat.thongTinShopConThieu().map((x) => [x.ma, x]));
  if (thieuShop.tai_khoan) them('tai_khoan', 'vang', 'Chưa có tài khoản nhận tiền: Mai không gửi được mã QR chuyển khoản cho khách.', { chu: 'Điền tài khoản', muc_cai_dat: 'ban-hang' });
  if (thieuShop.phi_ship) them('phi_ship', 'vang', 'Chưa đặt phí ship: Mai sẽ nói "shop báo phí ship sau".', { chu: 'Đặt phí ship', muc_cai_dat: 'ban-hang' });
  if (thieuShop.nguoi_ban) them('nguoi_ban', 'vang', 'Chưa đủ thông tin người bán (tên shop, số điện thoại, địa chỉ gửi hàng): phiếu gửi hàng sẽ thiếu.', { chu: 'Điền thông tin', muc_cai_dat: 'ban-hang' });

  try {
    const ss = require('../san-sang').kiem({ dv });
    const CHI_LAY = new Set(['model_da_tat', 'model_sap_tat', 'business_ai', 'dung_ai', 'chi_phi', 'fb_chua_duyet', 'phu_trach']);
    for (const [muc, mang] of [['do', ss.do], ['vang', ss.vang]]) {
      for (const x of mang) if (CHI_LAY.has(x.ma)) them(x.ma, muc, x.chu, x.nut?.den ? { chu: x.nut.chu, den: x.nut.den } : { chu: 'Xem', muc_cai_dat: 'ban-hang' });
    }
  } catch { /* bảng Sẵn sàng lỗi: bỏ qua, các dòng trên vẫn hiện */ }

  return ds.sort((a, b) => (a.muc === b.muc ? 0 : a.muc === 'do' ? -1 : 1));
}

/** Trạng thái từng việc AI "như nhân viên": Chờ việc · Đang làm · Diễn tập · Tắt · Dừng vì trần. */
function doiHinh(bayGio = new Date()) {
  const dung = caiDat.dungAi().bat;
  const homNay = Object.fromEntries(chiPhi.tongQuan(bayGio).theo_agent.map((x) => [x.agent_id, x]));
  const haiPhutTruoc = new Date(bayGio.getTime() - 120e3).toISOString();
  const muoiPhutTruoc = new Date(bayGio.getTime() - 600e3).toISOString();
  const db = csdl();
  return caiDat.danhSachAgent().filter((a) => !a.thu_nghiem).map((a) => {
    const dang = db.prepare('SELECT dien_tap FROM agent_run WHERE agent_id = ? AND ket_thuc IS NULL AND bat_dau >= ? ORDER BY bat_dau DESC LIMIT 1').get(a.id, haiPhutTruoc);
    const gan = db.prepare('SELECT dien_tap FROM agent_run WHERE agent_id = ? AND bat_dau >= ? ORDER BY bat_dau DESC LIMIT 1').get(a.id, muoiPhutTruoc);
    let trang_thai = 'cho_viec';
    if (!a.bat) trang_thai = 'tat';
    else if (dung) trang_thai = 'dung_tran';
    else if (dang) trang_thai = dang.dien_tap ? 'dien_tap' : 'dang_lam';
    else if (gan?.dien_tap) trang_thai = 'dien_tap';
    return { id: a.id, ten: tenViec(a).ten, trang_thai, so_viec_hom_nay: homNay[a.id]?.so_lan || 0 };
  });
}

/** Chỉ số AI N ngày qua (lời thường): xong, chuyển cho bạn, câu bị chặn (theo lý do), lỗi, chi phí. */
function chiSo(ngay = 7, bayGio = new Date()) {
  const n = Math.min(Math.max(Math.round(Number(ngay)) || 7, 1), 90);
  const tu = new Date(bayGio.getTime() - n * 86400e3).toISOString();
  const db = csdl();
  const run = db.prepare(`SELECT COUNT(*) AS tong,
      SUM(CASE WHEN loi IS NOT NULL THEN 1 ELSE 0 END) AS loi,
      SUM(CASE WHEN loi IS NULL AND ket_thuc IS NOT NULL THEN 1 ELSE 0 END) AS xong,
      COALESCE(SUM(chi_phi_usd), 0) AS usd
    FROM agent_run WHERE bat_dau >= ? AND dien_tap = 0`).get(tu);
  const chuyen = db.prepare('SELECT COUNT(*) AS n FROM cho_duyet WHERE luc >= ?').get(tu).n;
  const chan = db.prepare("SELECT hook, COUNT(*) AS n FROM nhat_ky_hook WHERE quyet_dinh = 'chan' AND luc >= ? GROUP BY hook").all(tu);
  const NHOM = { kiem_tra: 'so_khong_co_trong_nguon', kiem_loi_noi: 'so_khong_co_trong_nguon', an_gia_shop: 'luat_an_toan', luat_quyen: 'luat_an_toan', khan_cap: 'luat_an_toan',
    hop_thu_gui: 'luat_an_toan', gioi_han_lien_he: 'luat_an_toan', dong_khung: 'luat_an_toan' };
  const theoLy = { so_khong_co_trong_nguon: 0, luat_an_toan: 0, khac: 0 };
  for (const x of chan) theoLy[NHOM[x.hook] || 'khac'] += x.n;
  const tong = run.tong || 0;
  return {
    ngay: n,
    xong: run.xong || 0,
    chuyen_cho_ban: chuyen,
    cau_bi_chan: { tong: chan.reduce((s, x) => s + x.n, 0), ...theoLy },
    luot_chay: tong,
    loi: run.loi || 0,
    ty_le_loi: tong ? Math.round(((run.loi || 0) / tong) * 1000) / 10 : 0,
    chi_phi_usd: run.usd || 0,
  };
}

module.exports = { TEN_VIEC, bang, canXuLy, doiHinh, chiSo };
