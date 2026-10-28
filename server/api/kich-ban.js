'use strict';

const express = require('express');
const kichBan = require('../nghiep-vu/kich-ban');

const r = express.Router();

r.get('/kich-ban', (req, res) => {
  res.json({ kich_ban: kichBan.danhSachKichBan() });
});

r.post('/kich-ban', (req, res) => {
  res.status(201).json({ kich_ban: kichBan.taoKichBan(req.body) });
});

// Đặt trước /kich-ban/:id để "tao-nhanh" không bị hiểu là một id.
r.post('/kich-ban/tao-nhanh', (req, res) => {
  res.status(201).json({ kich_ban: kichBan.taoNhanh() });
});

// AI soạn kịch bản từ các tin Còn tuyển (bản 2.5, F-37): mỗi đoạn có lời dẫn cho người dẫn và câu Mai nói.
// Bản 2.9 (F-45): `kieu: "doi"` — kịch bản Đội AI dẫn (thoại của cả đội nhân vật AI).
// Bản 2.10 (F-49): `kieu: "radio"` — Radio Việc làm Bắc Ninh (đội AI dẫn kiểu đài phát thanh, có bài hát).
r.post('/kich-ban/soan-ai', async (req, res) => {
  const { soanKichBan } = require('../agent/agents/soan-kich-ban');
  const { LoiNghiepVu } = require('../nghiep-vu/chung');
  const kq = await soanKichBan({ kieu: ['doi', 'radio'].includes(req.body?.kieu) ? req.body.kieu : 'mai' });
  if (!kq.ok) {
    const ma = kq.loi?.ma || 'AI_LOI';
    const thongDiep = ma === 'PHIEU_SAI' ? 'AI soạn chưa đủ đoạn cho các tin. Bấm thử lại; chi tiết ở Cài đặt → Trợ lý AI → Nhật ký.'
      : kq.loi?.thong_diep || 'AI chưa soạn được kịch bản. Thử lại sau.';
    throw new LoiNghiepVu(ma, thongDiep, ma === 'TIN_KHONG_DUNG_DUOC' ? 400 : ma === 'KHAN_CAP_DANG_BAT' ? 409 : 502);
  }
  res.status(201).json({ kich_ban: kq.kichBan, run_id: kq.runId, model: kq.model });
});

r.get('/kich-ban/:id', (req, res) => {
  res.json({ kich_ban: kichBan.layKichBan(req.params.id) });
});

r.put('/kich-ban/:id', (req, res) => {
  res.json({ kich_ban: kichBan.suaKichBan(req.params.id, req.body) });
});

module.exports = r;
