'use strict';

const express = require('express');
const soTay = require('../nghiep-vu/so-tay');

const r = express.Router();

/**
 * F-90: dòng phí ship / miễn ship tự sinh từ Cài đặt → Bán hàng (chỉ đọc — không tạo nguồn thứ hai, luật F-05) và câu chép cho
 * phần Giới thiệu của Page.
 */
function dongTuSinh() {
  const { hienTien } = require('../nghiep-vu/chung');
  const b = require('../nghiep-vu/cai-dat').banHang();
  if (b.phi_ship == null && b.mien_phi_tu == null) return null;
  const ship = b.phi_ship != null ? `Phí ship đồng giá ${hienTien(b.phi_ship)}` : 'Phí ship shop báo khi lên đơn';
  const mien = b.mien_phi_tu != null ? `, miễn phí ship cho đơn từ ${hienTien(b.mien_phi_tu)}` : '';
  const chu = `${ship}${mien}.`;
  return { tieu_de: 'Phí ship (tự sinh từ Cài đặt)', chu, cau_gioi_thieu: `${b.ten_shop ? `${b.ten_shop}: ` : ''}${chu} Chốt đơn trên live: số + màu + size.` };
}

r.get('/so-tay', (req, res) => {
  res.json({ so_tay: soTay.danhSachMuc(), tu_sinh: dongTuSinh() });
});

r.post('/so-tay', (req, res) => {
  res.status(201).json({ muc: soTay.taoMuc(req.body) });
});

r.put('/so-tay/:id', (req, res) => {
  res.json({ muc: soTay.suaMuc(req.params.id, req.body) });
});

r.get('/so-tay/:id/ban-sua', (req, res) => {
  res.json({ ban_sua: soTay.banSuaMuc(req.params.id) });
});

module.exports = r;
