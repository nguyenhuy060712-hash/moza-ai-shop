'use strict';

/**
 * Tổng quan và thanh trạng thái trên cùng (SPEC.md mục 8).
 * Tổng quan bán hàng (F-33): sản phẩm theo trạng thái, hàng sắp hết / hết, Cần người, việc đến hạn, mục Sổ tay còn
 * trống, nhắc sao lưu, khóa AI, công tắc khẩn cấp, chi phí AI, chờ duyệt; đơn hàng và doanh số thêm ở BH3, BH4.
 */

const express = require('express');
const sp = require('../nghiep-vu/san-pham');
const soTay = require('../nghiep-vu/so-tay');
const caiDat = require('../nghiep-vu/cai-dat');
const khoa = require('../khoa');
const phienban = require('../phienban');
const chiPhi = require('../nghiep-vu/chi-phi');
const choDuyet = require('../nghiep-vu/cho-duyet');

const r = express.Router();

function facebookGon() {
  try {
    return require('../dich-vu').dichVu().ketNoiFb.trangThaiGon();
  } catch {
    return { ket_noi: false, muc: 'xam', chu: 'Facebook: chưa kết nối' };
  }
}

function trangThaiAi() {
  const thieu = caiDat.nhaDangDung().filter((n) => !khoa.lay(n)).map((n) => khoa.NHAN[n] || n);
  return { du: thieu.length === 0, thieu };
}

r.get('/trang-thai', (req, res) => {
  res.json({
    khan_cap: caiDat.khanCap(),
    khan_cap_ly_do: caiDat.lyDoKhanCap(),
    dung_ai: caiDat.dungAi(),
    chi_phi: chiPhi.mucDo(),
    cho_duyet: choDuyet.demCho(),
    ai: trangThaiAi(),
    facebook: facebookGon(),
    can_nguoi: require('../nghiep-vu/hop-thu').demCanNguoi(),
    can_khoi_dong_lai: phienban.daCu(),
    // F-73: Page bị Meta tạm khóa nhắn tin (lỗi 10/1893063 hoặc Page Integrity) — dải đỏ riêng, không gọi là "thiếu quyền".
    page_bi_cam: Object.entries(require('../nghiep-vu/fb-page').dsBiCam()).map(([id, x]) => ({ page_id: id, ten: require('../nghiep-vu/fb-page').lay(id)?.ten || id, ...x })),
    nhan_bu: require('../nghiep-vu/nhan-bu').dem({ dienTap: false }),
  });
});

r.get('/bao-cao/tong-quan', (req, res) => {
  const hopThu = require('../nghiep-vu/hop-thu');
  const kh = require('../nghiep-vu/khach');
  res.json({
    can_nguoi: hopThu.demCanNguoi(),
    hop_thu: hopThu.demTheoLoc({ dienTap: false }),
    // F-97: yêu cầu xóa dữ liệu hiện ngay (có hạn chót 72 giờ), không đợi tới hạn.
    viec_den_han: [...new Map([...kh.danhSachViec({ denHan: true }), ...kh.danhSachViec({}).filter((v) => v.loai === 'xoa_du_lieu')].map((v) => [v.id, v])).values()],
    facebook: facebookGon(),
    san_pham: sp.demTheoTrangThai(),
    sap_het: sp.danhSach({ trang_thai: 'dang_ban', kho: 'sap_het' }).map((x) => ({ id: x.id, ten: x.ten_day_du, con: x.con_ban_duoc })),
    het_hang: sp.danhSach({ trang_thai: 'dang_ban', kho: 'het_hang' }).map((x) => ({ id: x.id, ten: x.ten_day_du })),
    ban_hang: caiDat.banHang(),
    ...(() => { const bc = require('../nghiep-vu/bao-cao'); const dau = new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+07:00').toISOString(); const tat = bc.demDon('1 = 1', []); return { don: tat, doanh_so_hom_nay: bc.demDon('d.tao_luc >= ?', [dau]).doanh_so }; })(),
    so_tay_trong: soTay.demMucTrong(),
    thong_tin_shop: caiDat.thongTinShopConThieu(), // F-95: 8 mục, chỉ mục còn thiếu
    // F-89: đơn chuyển khoản đã xác nhận / đã gửi / đã giao mà người chưa bấm "Đã nhận tiền".
    anh_khach_cho_duyet: require('../nghiep-vu/anh-khach').choDuyet().length, // F-104
    ck_cho_doi_chieu: require('../nghiep-vu/don').danhSach({ chuaNhanTien: true, dienTap: false }).filter((x) => x.thanh_toan === 'chuyen_khoan' && ['da_xac_nhan', 'da_gui', 'da_giao'].includes(x.trang_thai)).length,
    sao_luu: caiDat.trangThaiSaoLuu(),
    ai: trangThaiAi(),
    khan_cap: caiDat.khanCap(),
    chi_phi: chiPhi.tongQuan(),
    cho_duyet: choDuyet.demCho(),
  });
});

/**
 * F-102 / F-103: Tổng kết một buổi (phễu do máy đếm, gợi ý AI đã lưu) và mốc từng món trong video. Gợi ý tự viết lần đầu khi mở
 * trang sau 6 giờ kể từ lúc live xong (số trả lời / xác nhận đã gần đủ) và buổi có từ 5 người chốt; trước đó bấm "Viết gợi ý ngay".
 */
r.get('/bao-cao/phien/:id/tong-ket', async (req, res) => {
  const tkp = require('../nghiep-vu/tong-ket-phien');
  let t = tkp.tongKetPhien(req.params.id);
  if (!t.goi_y && t.du_goi_y && t.phien.ket_thuc && Date.now() - new Date(t.phien.ket_thuc).getTime() >= 6 * 3600e3) {
    try { await require('../agent/agents/tong-ket').vietGoiY(req.params.id); t = tkp.tongKetPhien(req.params.id); } catch { /* AI lỗi: vẫn hiện số liệu */ }
  }
  res.json({ ...t, moc: tkp.mocTungMon(req.params.id), bang_doan: tkp.bangDoan(req.params.id) });
});
r.post('/bao-cao/phien/:id/goi-y', async (req, res) => {
  res.json(await require('../agent/agents/tong-ket').vietGoiY(req.params.id));
});

// Báo cáo bán hàng (F-58): theo buổi live, theo ngày, theo sản phẩm, hiệu quả Agent. Không tính dữ liệu Phòng diễn tập.
r.get('/bao-cao/ban-hang', (req, res) => {
  const bc = require('../nghiep-vu/bao-cao');
  const tu = req.query.tu ? new Date(`${req.query.tu}T00:00:00+07:00`).toISOString() : null;
  const den = req.query.den ? new Date(new Date(`${req.query.den}T00:00:00+07:00`).getTime() + 86400000).toISOString() : null;
  res.json({ ...bc.baoCao({ tu, den, dienTap: req.query.dien_tap === '1' }), agent: bc.hieuQuaAgent({ tu, den }), chi_phi: chiPhi.tongQuan() });
});

r.get('/bao-cao/chi-phi', (req, res) => {
  res.json(chiPhi.tongQuan());
});

module.exports = r;
