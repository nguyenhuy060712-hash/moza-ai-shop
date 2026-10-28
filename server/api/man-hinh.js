'use strict';

/**
 * Màn hình sản phẩm, chuyển cảnh lên sóng và nối OBS (SPEC.md #90).
 * Mật khẩu OBS chỉ ghi vào .env (OBS_MAT_KHAU); trình duyệt chỉ nhận "đã có / chưa có".
 */

const express = require('express');
const khoa = require('../khoa');
const caiDat = require('../nghiep-vu/cai-dat');
const { dichVu } = require('../dich-vu');
const { LoiNghiepVu } = require('../nghiep-vu/chung');

const r = express.Router();
const mh = () => dichVu().manHinh;

const caiDatObs = () => {
  const c = caiDat.doc('obs', {}) || {};
  return { bat: !!c.bat, cong: c.cong || 4455, co_mat_khau: !!khoa.layObs(), khung: c.khung === 'ngang' ? 'ngang' : 'doc' };
};

r.get('/man-hinh', (req, res) => {
  res.json({ ...mh().trangThai(), obs_cai_dat: caiDatObs() });
});

// Chiếu một nội dung (người dẫn bấm ô trên Màn hình người dẫn): người dẫn luôn thắng AI.
r.post('/man-hinh/chieu', (req, res) => {
  const b = req.body || {};
  const kq = mh().chieu({ mau: b.mau, so: Number(b.so) || null, mau_sac: b.mau_sac || null, chieu_cao: Number(b.chieu_cao) || null, can_nang: Number(b.can_nang) || null, so_phoi: Number(b.so_phoi) || null }, { boi: 'nguoi' });
  res.json(kq);
});

// F-86: 🗳 Bình chọn màu của món đang nói (2–3 màu, 60 giây, tối đa 2 lần mỗi buổi).
r.post('/binh-chon', (req, res) => res.json(require('../dich-vu').dichVu().binhChon.mo({ mau: Array.isArray((req.body || {}).mau) ? req.body.mau : [] })));
r.get('/binh-chon', (req, res) => res.json(require('../dich-vu').dichVu().binhChon.trangThai()));

// F-83: nút 🙏 Cảm ơn — dòng cảm ơn người chốt chạy ngang đáy Thanh chữ.
r.post('/man-hinh/cam-on', (req, res) => res.json(mh().camOn()));

r.post('/canh/chuyen', async (req, res) => {
  res.json(await mh().chuyenCanh((req.body || {}).canh, { boi: 'nguoi' }));
});

r.post('/canh/bo-goi-y', (req, res) => {
  mh().canh.goi_y = null;
  mh().baoCanh();
  res.json({ ok: true });
});

// Cài đặt OBS: cổng, bật / tắt tự nối, mật khẩu WebSocket (ghi .env).
r.put('/obs', (req, res) => {
  const b = req.body || {};
  const c = caiDat.doc('obs', {}) || {};
  if (b.cong !== undefined) {
    const cong = Number(b.cong);
    if (!Number.isInteger(cong) || cong < 1 || cong > 65535) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cổng OBS là số từ 1 tới 65535 (mặc định 4455).');
    c.cong = cong;
  }
  if (b.bat !== undefined) c.bat = !!b.bat;
  const doiKhung = b.khung !== undefined && b.khung !== (c.khung || 'doc');
  if (b.khung !== undefined) {
    if (!['doc', 'ngang'].includes(b.khung)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Khung hình chọn Dọc 9:16 hoặc Ngang 16:9.');
    c.khung = b.khung;
  }
  caiDat.ghi('obs', c);
  // Màn hình sản phẩm, Thanh chữ, khung xem trước đổi bố cục ngay (không cần tải lại trang).
  if (doiKhung) require('../ws').phat('mhsp.khung', { khung: c.khung });
  if (b.mat_khau !== undefined) {
    const kq = khoa.datObs(b.mat_khau);
    if (kq.loi) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', kq.loi);
  }
  mh().obs.dong();
  res.json(caiDatObs());
});

const loiObs = (e) => new LoiNghiepVu(e.ma || 'OBS_LOI', e.message, 502);

r.post('/obs/kiem-tra', async (req, res) => {
  try {
    const st = await mh().obs.noi();
    const c = caiDat.doc('obs', {}) || {};
    caiDat.ghi('obs', { ...c, bat: true });
    mh().baoCanh();
    res.json({ ok: true, obs: st });
  } catch (e) { throw loiObs(e); }
});

r.post('/obs/tao-canh', async (req, res) => {
  try {
    const kq = await mh().obs.taoCanhMoza(mh().congMoza, caiDatObs().khung);
    const c = caiDat.doc('obs', {}) || {};
    caiDat.ghi('obs', { ...c, bat: true });
    mh().baoCanh();
    res.json({ ok: true, ...kq });
  } catch (e) { throw loiObs(e); }
});

module.exports = r;
