'use strict';

/**
 * Giọng riêng của Mai (SPEC.md bản 2.5, F-38, mục 8): danh sách giọng đã lưu, tạo theo lựa chọn, nhân bản giọng
 * người thật, kho giọng tiếng Việt của Google, chọn giọng đang dùng, nghe thử, đọc thử, xóa.
 * Tệp tiếng trả về dạng audio/wav; lỗi vẫn là JSON { loi: { ma, thong_diep } } như mọi đường khác.
 */

const express = require('express');
const giongMai = require('../nghiep-vu/giong-mai');
const { phat } = require('../ws');

const r = express.Router();

// Gọi Google tính tiền mà vượt mức trần thì nghiệp vụ đã bật "Dừng mọi thứ"; báo cho mọi màn hình biết ngay.
function baoMucTran(kq) {
  require('../nghiep-vu/chi-phi').baoVuotTran(phat, kq?.canh_bao || null);
}

function guiWav(res, wav) {
  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'no-store');
  res.send(wav);
}

r.get('/giong-mai', (req, res) => {
  res.json({ ...giongMai.danhSach(), lua_chon: giongMai.luaChon() });
});

r.get('/giong-mai/kho', async (req, res) => {
  const { gioi = '', tim = '', trang = '' } = req.query;
  res.json(await giongMai.giongKho({ gioi: String(gioi), tim: String(tim), trang: String(trang) }));
});

r.post('/giong-mai/ta', async (req, res) => {
  const { lua_chon: luaChon, mo_ta_them: moTaThem, ten } = req.body || {};
  const kq = await giongMai.taoTheoLuaChon({ luaChon: luaChon || {}, moTaThem, ten });
  baoMucTran(kq);
  res.status(201).json(kq);
});

// Thân yêu cầu lớn (hai đoạn ghi âm WAV dạng base64): bộ đọc JSON riêng được gắn trước ở api/index.js.
r.post('/giong-mai/nhan-ban', async (req, res) => {
  const { ten, am_mau: amMau, am_dong_y: amDongY } = req.body || {};
  const kq = await giongMai.nhanBan({ ten, amMau, amDongY });
  baoMucTran(kq);
  res.status(201).json(kq);
});

r.post('/giong-mai/kho', (req, res) => {
  res.status(201).json({ giong: giongMai.luuTuKho(req.body || {}) });
});

r.put('/giong-mai/dang-dung', (req, res) => {
  const { id, model } = req.body || {};
  res.json({ dang_dung: giongMai.datDangDung({ id, model }) });
});

r.delete('/giong-mai/:id', async (req, res) => {
  res.json(await giongMai.xoa(req.params.id));
});

r.get('/giong-mai/:id/nghe', async (req, res) => {
  const kq = await giongMai.ngheMau(req.params.id);
  baoMucTran(kq);
  guiWav(res, kq.wav);
});

r.post('/giong-mai/doc', async (req, res) => {
  const { chu, id, phong_cach: phongCach } = req.body || {};
  const kq = await giongMai.doc({ chu, id: id || null, phongCach: phongCach || null });
  baoMucTran(kq);
  guiWav(res, kq.wav);
});

/* ---------- F-127: tông giọng trên sóng (dùng chung Mai + Đội AI) ---------- */

const tongGiong = require('../nghiep-vu/tong-giong');
const CAU_MAU_TONG = 'Dạ cả nhà ơi, áo sơ mi linen số 12 hôm nay có bốn màu, size từ S tới XL. Ưng màu nào thì bình luận chốt kèm màu và size, shop giữ hàng liền.';
const NGHE_THU_MOI_PHUT = 3;
let ngheThuGanDay = [];

r.get('/giong-mai/tong', (req, res) => {
  res.json({ dang_chon: tongGiong.dangChon(), danh_sach: tongGiong.danhSach() });
});

r.put('/giong-mai/tong', (req, res) => {
  const kq = tongGiong.datTong(req.body || {});
  // Đang live với miệng mở: vòng đồng bộ của miệng tự áp tông mới (GPT-Live thêm lời dặn, Gemini mở lại).
  phat('mieng.tong_giong', { dang_chon: kq });
  res.json({ dang_chon: kq });
});

/** Nghe thử tông: máy đọc đọc một câu mẫu với chỉ dẫn của tông (tốn phí nhỏ, tối đa 3 lần / phút). */
r.post('/giong-mai/tong/nghe-thu', async (req, res) => {
  const bayGio = Date.now();
  ngheThuGanDay = ngheThuGanDay.filter((t) => bayGio - t < 60e3);
  if (ngheThuGanDay.length >= NGHE_THU_MOI_PHUT) {
    throw new (require('../nghiep-vu/chung').LoiNghiepVu)('NGHE_THU_NHIEU', 'Nghe thử tối đa 3 lần mỗi phút (mỗi lần tốn một ít tiền). Chờ chút rồi thử lại.', 429);
  }
  ngheThuGanDay.push(bayGio);
  const x = req.body?.ma ? { ma: req.body.ma, tu_viet: req.body.tu_viet || '' } : tongGiong.dangChon();
  const kq = await giongMai.doc({ chu: CAU_MAU_TONG, phongCach: tongGiong.chiDan(x) || null, viec: 'Nghe thử tông giọng' });
  baoMucTran(kq);
  guiWav(res, kq.wav);
});

/* ---------- F-114: giọng riêng của Mai trên sóng (GPT-Live) — tắt mặc định ---------- */

const giongRieng = require('../nghiep-vu/giong-rieng');
r.get('/giong-mai/rieng', (req, res) => res.json(giongRieng.trangThai()));
r.post('/giong-mai/rieng', async (req, res) => res.status(201).json(await giongRieng.tao(req.body || {})));
r.put('/giong-mai/rieng/dang-dung', (req, res) => res.json(giongRieng.chon(String((req.body || {}).id || ''))));
r.put('/giong-mai/rieng/bat', (req, res) => res.json(giongRieng.datBat(!!(req.body || {}).bat)));
r.delete('/giong-mai/rieng/:id', async (req, res) => res.json(await giongRieng.xoa(req.params.id)));
/** Nghe thử = phiên GPT-Live ngắn (tốn ~0,01 USD): giao diện hỏi trước, gửi kèm dong_y: true. */
r.post('/giong-mai/rieng/nghe-thu', async (req, res) => {
  if ((req.body || {}).dong_y !== true) throw new (require('../nghiep-vu/chung').LoiNghiepVu)('CAN_DONG_Y', 'Nghe thử tốn một ít tiền: bấm đồng ý trước.', 409);
  const kq = await giongRieng.ngheThu((req.body || {}).id || null);
  baoMucTran(kq);
  guiWav(res, kq.wav);
});

module.exports = r;
