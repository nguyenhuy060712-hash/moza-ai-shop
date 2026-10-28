'use strict';

/**
 * MOZA nhìn (SPEC.md F-107): bật / tắt theo buổi, bảng mẫu (trình duyệt ghép bằng canvas, máy chỉ giữ trong bộ nhớ), bỏ qua gợi ý,
 * trạng thái. Chuyển món thì Màn hình người dẫn gọi đường đổi đoạn sẵn có (/live/phien/:id/doan) — máy không tự chuyển.
 */

const express = require('express');
const { dichVu } = require('../dich-vu');

const r = express.Router();
const nm = () => dichVu().nhinMon;

r.get('/nhin/:phienId', (req, res) => res.json(nm().trangThai(req.params.phienId)));
r.post('/nhin/:phienId/bat', async (req, res) => res.json(await nm().bat(req.params.phienId, !!(req.body || {}).bat)));
r.post('/nhin/:phienId/bang-mau', express.json({ limit: '6mb' }), (req, res) => res.json(nm().datBangMau(req.params.phienId, req.body || {})));
r.post('/nhin/:phienId/bo-qua', (req, res) => { nm().boQua((req.body || {}).so); res.json(nm().trangThai(req.params.phienId)); });

module.exports = r;
