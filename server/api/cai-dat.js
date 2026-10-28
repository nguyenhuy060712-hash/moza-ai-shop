'use strict';

/**
 * Cài đặt (SPEC.md F-03, mục 8 nhóm "Cài đặt").
 * Khóa API: trình duyệt chỉ nhận "đã có / chưa có" và 4 ký tự cuối, không bao giờ nhận khóa thật.
 */

const express = require('express');
const caiDat = require('../nghiep-vu/cai-dat');
const khoa = require('../khoa');
const giong = require('../giong');
const phienban = require('../phienban');
const tuChay = require('../tu-chay');
const { saoLuu } = require('../db/ket-noi');
const { phat } = require('../ws');
const { LoiNghiepVu } = require('../nghiep-vu/chung');

const r = express.Router();

function toanBo() {
  return {
    ten_ai: caiDat.tenAi(),
    khan_cap: caiDat.khanCap(),
    mieng: caiDat.mieng(),
    do_tre_phat: caiDat.doTrePhat(),
    ban_hang: caiDat.banHang(),
    giao_dien: caiDat.giaoDien(),
    phan_an_duoc: caiDat.PHAN_AN_DUOC,
    ty_gia_vnd: caiDat.tyGiaVnd(),
    agents: caiDat.danhSachAgent(),
    sao_luu: caiDat.trangThaiSaoLuu(),
    lua_chon: {
      nha: caiDat.MAC_DINH.nha,
      muc_suy_nghi: caiDat.MAC_DINH.muc_suy_nghi,
      mieng: caiDat.MAC_DINH.mieng.filter((x) => !x.chi_dien_tap), // miệng giả chọn theo buổi tập, không làm mặc định
      hang_van_chuyen: require('../nghiep-vu/xuat-van-chuyen').danhSachMau(), // F-101
      ngan_hang: caiDat.danhSachNganHang().map((x) => ({ bin: x.bin, ten_ngan: x.ten_ngan, ten: x.ten })), // F-89
    },
    can_khoi_dong_lai: phienban.daCu(),
  };
}

/** Các model đang đặt cho một nhà cung cấp — nút "Kiểm tra" xem tài khoản có đủ model không. */
function modelDangDung(nha) {
  const ds = [];
  for (const a of caiDat.danhSachAgent()) {
    if (a.nha === nha) ds.push(a.model);
    if (a.nha_du_phong === nha && a.model_du_phong) ds.push(a.model_du_phong);
    if (a.nang_cap?.nha === nha) ds.push(a.nang_cap.model, a.nang_cap.model_du_phong);
  }
  const m = caiDat.MAC_DINH.mieng.find((x) => x.model === caiDat.mieng().model);
  if (m.nha === nha) ds.push(m.model);
  return [...new Set(ds.filter(Boolean))];
}

r.get('/cai-dat', (req, res) => {
  res.json(toanBo());
});

r.put('/cai-dat', (req, res) => {
  const b = req.body || {};
  if (b.ten_ai !== undefined) caiDat.datTenAi(b.ten_ai);
  if (b.mieng !== undefined) caiDat.datMieng(b.mieng);
  if (b.do_tre_phat !== undefined) caiDat.datDoTrePhat(b.do_tre_phat);
  if (b.ban_hang !== undefined) { caiDat.datBanHang(b.ban_hang); phat('cai_dat.ban_hang', {}); }
  if (b.giao_dien !== undefined) { caiDat.datGiaoDien(b.giao_dien); phat('cai_dat.giao_dien', {}); }
  if (b.ty_gia_vnd !== undefined) caiDat.datTyGiaVnd(b.ty_gia_vnd);
  if (b.fb_tu_dang_muc_luc !== undefined) caiDat.ghi('fb_tu_dang_muc_luc', b.fb_tu_dang_muc_luc === true); // F-94
  res.json(toanBo());
});

// Cài đặt → Bán hàng (F-03): tên shop, liên hệ, phí ship, miễn phí từ, giờ giữ hàng, ngưỡng sắp hết, ngưỡng khách từng hoàn.
r.get('/cai-dat/ban-hang', (req, res) => {
  res.json({ ban_hang: caiDat.banHang() });
});

// GD1 (F-121): bảng "AI & kênh" và "Cần xử lý" đầu Cài đặt.
r.get('/cai-dat/ai-kenh', (req, res) => {
  res.json(require('../nghiep-vu/ai-kenh').bang());
});

r.get('/cai-dat/can-xu-ly', (req, res) => {
  res.json({ can_xu_ly: require('../nghiep-vu/ai-kenh').canXuLy() });
});

r.put('/agent/:id', (req, res) => {
  const a = caiDat.suaAgent(req.params.id, req.body || {});
  phat('trang_thai');
  res.json({ agent: a });
});

/* ---------------- khóa API ---------------- */

r.get('/keys', (req, res) => {
  res.json(khoa.trangThai());
});

r.post('/keys', (req, res) => {
  const { nha, khoa: k } = req.body || {};
  const kq = khoa.dat(nha, k);
  if (kq.loi) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', kq.loi);
  phat('trang_thai');
  res.json({ ok: true, trangThai: khoa.trangThai() });
});

r.post('/keys/test', async (req, res) => {
  const { nha } = req.body || {};
  if (!khoa.TEN[nha]) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không biết nhà cung cấp "${nha}".`);
  res.json(await khoa.kiemTra(nha, modelDangDung(nha)));
});

/* ---------------- công tắc "Dừng mọi thứ" ---------------- */

r.post('/khan-cap', (req, res) => {
  const bat = caiDat.datKhanCap((req.body || {}).bat);
  phat('khan_cap', { bat });
  res.json({ khan_cap: bat });
});

/*
 * "Dừng AI" (F-72): tự bật khi chạm trần chi phí. "Chạy AI tiếp" = tắt (nâng trần trước ở PUT /muc-tran, không thì lượt AI kế
 * tiếp lại chạm trần và bật lại). Người cũng bật tay được (ví dụ muốn tiết kiệm mà chốt đơn vẫn chạy).
 */
r.post('/dung-ai', (req, res) => {
  const { bat } = req.body || {};
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  caiDat.datDungAi(bat, bat ? { ma: 'NGUOI_BAT', thong_diep: 'Bạn bật "Dừng AI": AI không chạy, chốt đơn bằng mã vẫn chạy.' } : null);
  const chiPhi = require('../nghiep-vu/chi-phi');
  phat('dung_ai', { bat, ly_do: caiDat.dungAi().ly_do || null });
  chiPhi.baoVuotTran(phat);
  res.json({ dung_ai: caiDat.dungAi(), chi_phi: chiPhi.mucDo() });
});

/* ---------------- sao lưu ---------------- */

r.post('/sao-luu', async (req, res) => {
  const file = await saoLuu();
  const kq = caiDat.ghiSaoLuu(file);
  phat('trang_thai');
  res.json({ sao_luu: kq, trang_thai: caiDat.trangThaiSaoLuu() });
});

/* ---------------- giọng ---------------- */

r.get('/giong', (req, res) => {
  res.json(giong.danhSach());
});

// Nghe thử thật: gọi nhà cung cấp đọc một câu tiếng Việt bằng đúng giọng đó (lưu lại cho lần sau).
r.get('/giong/thu', async (req, res) => {
  const kq = await giong.ngheThu(String(req.query.nha || ''), String(req.query.giong || ''));
  if (kq.loi) throw new LoiNghiepVu('KHONG_NGHE_THU_DUOC', kq.loi);
  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'no-store');
  res.send(kq.wav);
});

/* ---------------- tự chạy khi mở máy ---------------- */

r.get('/cai-dat/tu-chay', async (req, res) => {
  res.json(await tuChay.xem());
});

r.post('/cai-dat/tu-chay', async (req, res) => {
  const { bat } = req.body || {};
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  res.json(await tuChay.dat(bat));
});

module.exports = r;
