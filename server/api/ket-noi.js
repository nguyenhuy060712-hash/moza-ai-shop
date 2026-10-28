'use strict';

/**
 * Kết nối Facebook (SPEC.md mục 8 nhóm "Cài đặt", F-03, F-06, F-24).
 * Trình duyệt chỉ nhận "đã có / chưa có" và 4 ký tự cuối của App Secret và mã Page.
 */

const express = require('express');
const khoa = require('../khoa');
const { dichVu } = require('../dich-vu');
const { LoiNghiepVu } = require('../nghiep-vu/chung');

const r = express.Router();

r.get('/ket-noi', (req, res) => {
  res.json({ ...dichVu().ketNoiFb.trangThai(), tu_dang_muc_luc: require('../nghiep-vu/cai-dat').doc('fb_tu_dang_muc_luc', true) !== false }); // F-94
});

// Lưu App ID, App Secret, hoặc dán thẳng mã Page (nếu đã có). Lưu xong thì kết nối chạy lại.
r.post('/ket-noi/ma', async (req, res) => {
  const b = req.body || {};
  let doi = false;
  for (const ten of ['app_id', 'app_secret']) {
    if (b[ten] === undefined) continue;
    const kq = khoa.datFb(ten, b[ten]);
    if (kq.loi) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', kq.loi);
    doi = true;
  }
  // Dán thẳng mã một Page đã có sẵn (không qua Graph API Explorer).
  if (b.page_id !== undefined || b.page_token !== undefined) {
    const kq = khoa.datPage(b.page_id, b.page_token);
    if (kq.loi) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', kq.loi);
    doi = true;
  }
  if (!doi) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa nhập mã nào.');
  await dichVu().ketNoiFb.khoiDongLai();
  res.json(dichVu().ketNoiFb.trangThai());
});

// Dán mã người dùng ngắn hạn (Graph API Explorer) → MOZA tự lấy mã Page không hết hạn.
r.post('/ket-noi/ma-page', async (req, res) => {
  const b = req.body || {};
  const ids = Array.isArray(b.page_ids) ? b.page_ids.map(String) : null;
  res.json(await dichVu().ketNoiFb.doiMaPage({ maNguoiDung: b.ma_nguoi_dung, pageIds: ids }));
});

// Nhiều Fanpage (#37): bật / tắt một Page trong MOZA, hoặc bỏ hẳn (xóa mã khỏi .env).
r.put('/ket-noi/page/:id', async (req, res) => {
  const bat = (req.body || {}).bat;
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  await dichVu().ketNoiFb.batTatPage(req.params.id, bat);
  res.json(dichVu().ketNoiFb.trangThai());
});

r.delete('/ket-noi/page/:id', async (req, res) => {
  await dichVu().ketNoiFb.boPage(req.params.id);
  res.json(dichVu().ketNoiFb.trangThai());
});

r.post('/ket-noi/kiem-tra', async (req, res) => {
  res.json({ kiem_tra: await dichVu().ketNoiFb.kiemTra(), trang_thai: dichVu().ketNoiFb.trangThai() });
});

r.post('/ket-noi/dang-ky-lai', async (req, res) => {
  res.json(await dichVu().ketNoiFb.khoiDongLai());
});

/**
 * "Tạo bộ mẫu tin" (F-67, #89, #99): gửi cả bộ mẫu Utility của MOZA (đơn đã gửi · đang chờ xác nhận · đã hủy) lên mọi Page
 * đang nối. Meta duyệt trong vài giây tới vài phút; duyệt xong MOZA báo đơn được cả khi khách nhắn lần cuối đã quá 24 giờ.
 */
r.post('/ket-noi/mau-utility', async (req, res) => {
  const mu = require('../nghiep-vu/mau-utility');
  const pages = dichVu().ketNoiFb.pagesDangChay();
  if (!pages.length) throw new LoiNghiepVu('FB_CHUA_KET_NOI', 'Chưa có Page nào đang nối: nối Facebook trước rồi tạo mẫu tin.');
  const ketQua = [];
  for (const p of pages) {
    for (const loai of mu.LOAI) {
      const m = mu.BO[loai];
      try {
        ketQua.push({ loai, page_id: p.pageId, ten: p.ten, ...(await p.taoMauUtility(m.ten, m.noi_dung, 'vi', m.nut)) });
      } catch (e) {
        ketQua.push({ loai, page_id: p.pageId, ten: p.ten, loi: e.message });
      }
    }
  }
  mu.ghiDaTao(ketQua);
  res.json({ ket_qua: ketQua, bo: mu.daTao() });
});

/** Bộ mẫu đã tạo, kèm trạng thái Meta duyệt hiện tại (APPROVED / PENDING / REJECTED, loại UTILITY / MARKETING) của từng Page. */
r.get('/ket-noi/mau-utility', async (req, res) => {
  const mu = require('../nghiep-vu/mau-utility');
  const bo = mu.daTao();
  const trangThai = [];
  for (const p of dichVu().ketNoiFb.pagesDangChay()) {
    for (const [loai, m] of Object.entries(bo)) {
      try { const x = await p.trangThaiMau(m.ten); trangThai.push({ loai, page_id: p.pageId, trang_thai: x?.trang_thai || null, loai_mau: x?.loai || null }); } catch (e) { trangThai.push({ loai, page_id: p.pageId, loi: e.message }); }
    }
  }
  res.json({ bo, trang_thai: trangThai, mau: Object.fromEntries(mu.LOAI.map((k) => [k, mu.BO[k].noi_dung])) });
});

/**
 * "Cài Messenger cho Page" (F-70; menu thêm ở F-88): nút Bắt đầu (payload BAT_DAU — người mới vào từ link m.me?ref= mang theo mã
 * buổi) và lời chào có câu tự nhận trợ lý AI. Một hàm, một nút — Messenger Profile ghi đè nhau nếu gọi riêng.
 */
r.post('/ket-noi/ho-so-messenger', async (req, res) => {
  const pages = dichVu().ketNoiFb.pagesDangChay();
  if (!pages.length) throw new LoiNghiepVu('FB_CHUA_KET_NOI', 'Chưa có Page nào đang nối: nối Facebook trước.');
  const { hoSoMessenger } = require('../nghiep-vu/fb-page');
  const ketQua = [];
  for (const p of pages) {
    try { await p.datHoSoMessenger(hoSoMessenger()); ketQua.push({ page_id: p.pageId, ten: p.ten, ok: true }); } catch (e) { ketQua.push({ page_id: p.pageId, ten: p.ten, loi: e.message }); }
  }
  res.json({ ket_qua: ketQua });
});

module.exports = r;
