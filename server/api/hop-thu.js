'use strict';

/**
 * Hộp thư, Khách hàng, Việc (SPEC.md mục 8; F-25, F-26, F-31, F-54). Chỉ gọi vào khối Nghiệp vụ và dịch vụ Hộp thư.
 */

const express = require('express');
const hopThu = require('../nghiep-vu/hop-thu');
const kh = require('../nghiep-vu/khach');
const sp = require('../nghiep-vu/san-pham');
const { dichVu } = require('../dich-vu');
const { phat } = require('../ws');
const { LoiNghiepVu, kiemChu } = require('../nghiep-vu/chung');

const r = express.Router();

const boolHoacNull = (v) => (v === undefined || v === '' ? null : v === '1' || v === 'true');

/* ---------------- hội thoại ---------------- */

r.get('/hoi-thoai', (req, res) => {
  const q = req.query;
  const dienTap = boolHoacNull(q.dien_tap);
  res.json({
    hoi_thoai: hopThu.danhSach({ loc: String(q.loc || ''), pageId: String(q.page_id || ''), phienLiveId: String(q.phien_live_id || ''),
      sanPhamId: String(q.san_pham_id || ''), q: String(q.q || ''), dienTap }),
    dem: hopThu.demTheoLoc({ dienTap }),
  });
});

r.get('/hoi-thoai/:id', (req, res) => {
  const h = hopThu.layHoiThoai(req.params.id);
  const nguoi = hopThu.layNguoi(h.nguoi_fb_id);
  res.json({
    hoi_thoai: h,
    nguoi: { ten: nguoi?.ten_hien_thi || '', da_xoa: !!nguoi?.xoa_luc },
    tin_nhan: hopThu.tinCuaHoiThoai(h.id, { gioiHan: 300 }),
    khach: h.khach_id ? kh.chiTiet(h.khach_id) : null,
    // F-78: quá 24 giờ kể từ tin cuối của khách → trả lời bằng Meta Business Suite (link mở đúng cuộc trò chuyện).
    qua_24_gio: h.kenh === 'messenger' && (!h.tin_khach_cuoi_luc || Date.now() - new Date(h.tin_khach_cuoi_luc).getTime() >= 24 * 3600e3),
    link_business_suite: h.kenh === 'messenger' && !h.dien_tap ? require('../nghiep-vu/fb-page').linkBusinessSuite(h.page_id, h.fb_thread_id) : null,
    san_pham_goi_y: h.san_pham_goi_y ? (() => { try { const x = sp.laySanPham(h.san_pham_goi_y); return { id: x.id, so: x.so, ten: sp.tenDayDu(x) }; } catch { return null; } })() : null,
  });
});

// Người gửi từ MOZA → AI tạm dừng ở hội thoại này (F-26).
r.post('/hoi-thoai/:id/gui', async (req, res) => {
  const noiDung = kiemChu((req.body || {}).noi_dung, { ten: 'Tin nhắn', batBuoc: true, toiDa: 2000 });
  const kq = await dichVu().hopThu.nguoiGui(req.params.id, noiDung);
  if (kq.loi) throw new LoiNghiepVu(kq.loi.ma, kq.loi.thong_diep, 409);
  res.json({ ok: true, ket_qua: kq.ketQua });
});

r.post('/hoi-thoai/:id/giao-ai', (req, res) => {
  res.json({ hoi_thoai: dichVu().hopThu.giaoLaiAi(req.params.id) });
});

r.post('/hoi-thoai/:id/trang-thai', (req, res) => {
  const tt = String((req.body || {}).trang_thai || '');
  if (!['xong', 'cho_phan_hoi', 'spam', 'can_nguoi', 'nguoi_dang_xu_ly'].includes(tt)) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chỉ chuyển được sang Xong, Chờ phản hồi, Spam, Cần người hoặc "Tôi xử lý".');
  }
  const h = tt === 'nguoi_dang_xu_ly' ? hopThu.tamDungAi(req.params.id) : hopThu.datTrangThai(req.params.id, tt, { lyDo: 'Người dùng chuyển' });
  phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
  res.json({ hoi_thoai: h });
});

r.post('/hoi-thoai/:id/ghi-chu', (req, res) => {
  res.json({ tin: hopThu.ghiChu(req.params.id, kiemChu((req.body || {}).noi_dung, { ten: 'Ghi chú', batBuoc: true, toiDa: 2000 })) });
});

// Gắn món khách đang hỏi (chọn từ danh sách sản phẩm).
r.post('/hoi-thoai/:id/san-pham', (req, res) => {
  const so = (req.body || {}).so;
  const x = so ? sp.layTheoSo(so) : null;
  if (so && !x) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${so}.`, 404);
  res.json({ hoi_thoai: hopThu.ganNhan(req.params.id, { sanPhamId: x?.id || null }) });
});

// Tạo hồ sơ khách từ hội thoại bằng một nút (F-54: khách gọi điện, cho số).
r.post('/hoi-thoai/:id/tao-khach', (req, res) => {
  const b = req.body || {};
  const h = hopThu.layHoiThoai(req.params.id);
  const kq = kh.taoKhach({ ten: b.ten ?? '', sdt: b.sdt || null, diaChi: b.dia_chi || '', ghiChu: b.ghi_chu || '', hoiThoaiId: h.id, phienLiveId: h.phien_live_id, taoBoi: 'nguoi', dienTap: h.dien_tap });
  phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
  res.status(201).json(kq);
});

r.post('/hoi-thoai/:id/lien-ket', (req, res) => {
  const id = String((req.body || {}).khach_id || '');
  kh.layKhach(id);
  res.json({ hoi_thoai: hopThu.lienKetKhach(req.params.id, id) });
});

r.post('/tin-nhan/:id/thu-lai', async (req, res) => {
  const kq = await dichVu().hopThu.thuLai(req.params.id);
  if (kq.loi) throw new LoiNghiepVu(kq.loi.ma, kq.loi.thong_diep, 409);
  res.json({ ok: true });
});

/* ---------------- khách hàng (F-54) ---------------- */

r.get('/khach', (req, res) => {
  const q = req.query;
  res.json({ khach: kh.danhSachKhach({ q: String(q.q || ''), dienTap: boolHoacNull(q.dien_tap) }) });
});

r.post('/khach', (req, res) => {
  const b = req.body || {};
  res.status(201).json(kh.taoKhach({ ten: b.ten ?? '', sdt: b.sdt || null, diaChi: b.dia_chi || '', ghiChu: b.ghi_chu || '', taoBoi: 'nguoi' }));
});

r.get('/khach/:id', (req, res) => {
  res.json(kh.chiTiet(req.params.id));
});

r.put('/khach/:id', (req, res) => {
  res.json({ khach: kh.suaKhach(req.params.id, req.body || {}) });
});

r.post('/khach/:id/gop', (req, res) => {
  res.json({ khach: kh.gopKhach(req.params.id, String((req.body || {}).bo_id || '')) });
});

// F-97: người chưa có hồ sơ khách (chỉ có người Facebook) cũng xóa được theo yêu cầu.
r.delete('/nguoi/:id/du-lieu', (req, res) => {
  res.json(kh.xoaDuLieuNguoi(req.params.id));
});

r.delete('/khach/:id/du-lieu', (req, res) => {
  res.json(kh.xoaDuLieu(req.params.id));
});

r.put('/bo-nho/:id', (req, res) => {
  kh.suaBoNho(req.params.id, (req.body || {}).noi_dung);
  res.json({ ok: true });
});

r.delete('/bo-nho/:id', (req, res) => {
  kh.boBoNho(req.params.id);
  res.json({ ok: true });
});

/* ---------------- việc ---------------- */

r.get('/viec', (req, res) => {
  res.json({ viec: kh.danhSachViec({ denHan: req.query.loc === 'den_han', trangThai: String(req.query.trang_thai || 'mo'), dienTap: req.query.dien_tap === '1' }) });
});

r.post('/viec', (req, res) => {
  const b = req.body || {};
  res.status(201).json({ viec: kh.taoViec({ loai: b.loai || 'khac', noiDung: b.noi_dung, hanLuc: b.han_luc || null, khachId: b.khach_id || null, hoiThoaiId: b.hoi_thoai_id || null }) });
});

r.put('/viec/:id', (req, res) => {
  const b = req.body || {};
  const v = kh.suaViec(req.params.id, { trangThai: b.trang_thai, noiDung: b.noi_dung, hanLuc: b.han_luc, ketQua: b.ket_qua });
  phat('hop_thu.cap_nhat', {});
  res.json({ viec: v });
});

// F-91: nút [Xóa số đo] ở màn hình Khách hàng.
r.delete('/khach/:id/so-do', (req, res) => {
  kh.layKhach(req.params.id);
  res.json({ ok: true, da_xoa: kh.xoaSoDo(req.params.id) });
});

module.exports = r;
