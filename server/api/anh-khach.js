'use strict';

/**
 * Ảnh khách mặc thật (SPEC.md F-104): danh sách chờ duyệt / đã duyệt, xem tệp, duyệt kèm ảnh ĐÃ CHE MẶT (dựng bằng canvas trên
 * trình duyệt), gỡ. Không có đường nào gửi ảnh này cho AI.
 */

const express = require('express');
const ak = require('../nghiep-vu/anh-khach');
const { LoiNghiepVu } = require('../nghiep-vu/chung');
const { phat } = require('../ws');

const r = express.Router();

r.get('/anh-khach', (req, res) => {
  res.json({ bat: !!require('../nghiep-vu/cai-dat').banHang().dung_anh_khach, cho_duyet: ak.choDuyet(), da_duyet: ak.daDuyet(), che_mat_mac_dinh: ak.CHE_MAT_MAC_DINH });
});

r.get('/anh-khach/:id/tep', (req, res) => {
  const f = ak.tepCua(req.params.id);
  if (!f) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Ảnh không còn.', 404);
  res.set('Cache-Control', 'no-store');
  res.sendFile(f);
});

// Thân = ảnh đã che mặt (JPEG / PNG); món, size, phần che trong địa chỉ.
r.post('/anh-khach/:id/duyet', express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
  const kq = ak.duyet(req.params.id, { anh: req.body, cheMat: Number(req.query.che_mat), sanPhamId: String(req.query.san_pham_id || ''), co: req.query.co || null });
  phat('anh_khach.cap_nhat', {});
  res.json(kq);
});

r.delete('/anh-khach/:id', (req, res) => {
  ak.go(req.params.id);
  phat('anh_khach.cap_nhat', {}); // Màn hình sản phẩm đang chiếu ảnh này thì gỡ ngay
  res.json({ ok: true });
});

module.exports = r;
