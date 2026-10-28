'use strict';

/**
 * Đội AI dẫn (SPEC.md bản 2.9, F-44, F-45, F-47, mục 8): dàn nhân vật, làm tiếng từng đoạn kịch bản, làm sẵn tiếng
 * cả kịch bản. Tệp tiếng trả về audio/wav; lỗi vẫn là JSON { loi: { ma, thong_diep } }.
 */

const express = require('express');
const doiAi = require('../nghiep-vu/doi-ai');
const kichBan = require('../nghiep-vu/kich-ban');
const phongThu = require('../doi-ai/phong-thu');
const nhacDoi = require('../doi-ai/nhac');
const { LoiNghiepVu } = require('../nghiep-vu/chung');
const { phat } = require('../ws');

const r = express.Router();

// Làm tiếng tính tiền mà vượt mức trần thì nghiệp vụ đã bật "Dừng mọi thứ"; báo mọi màn hình biết ngay.
function baoMucTran(canhBao) {
  require('../nghiep-vu/chi-phi').baoVuotTran(phat, canhBao);
}

function guiWav(res, wav) {
  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'no-store');
  res.send(wav);
}

function layDoan(kichBanId, soDoan) {
  const kb = kichBan.layKichBan(String(kichBanId || ''));
  const i = Number(soDoan);
  if (!Number.isInteger(i) || !kb.doan[i]) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không có đoạn này trong kịch bản.');
  return { kb, i, d: kb.doan[i] };
}

r.get('/doi-ai', (req, res) => {
  const giongDaTao = require('../nghiep-vu/giong-mai').danhSach().giong.map((g) => ({ id: g.id, ten: g.ten, gioi: g.gioi, het_han: g.het_han }));
  res.json({
    nhan_vat: doiAi.nhanVat(), nhac: doiAi.nhac(), loai_nhac: nhacDoi.dsLoai(), toi_thieu: doiAi.TOI_THIEU, toi_da: doiAi.TOI_DA,
    can_giong_bac: doiAi.canGiongBac(), giong_da_tao: giongDaTao,
    // Radio Việc làm Bắc Ninh (bản 2.10, F-50)
    bai_hat: doiAi.baiHat(), kieu_bai: nhacDoi.dsKieuBai(), goi_y_bai: nhacDoi.GOI_Y_BAI, bai_toi_da: doiAi.BAI_HAT_TOI_DA,
  });
});

// Bài hát Radio (F-50): Lyria viết lời và hát theo tên bài + kiểu nhạc (khoảng 1–2 phút, 0,08 USD). `id` = làm lại bài đó.
r.post('/doi-ai/bai-hat', async (req, res) => {
  const kq = await nhacDoi.lamBaiHat({ id: req.body?.id ? String(req.body.id) : null, ten: req.body?.ten, kieu: String(req.body?.kieu || '') });
  baoMucTran(kq.canhBao);
  res.status(201).json({ bai_hat: kq.danhSach, bai: kq.baiHat, chi_phi_usd: kq.usd });
});

r.get('/doi-ai/bai-hat/:id', (req, res) => {
  const wav = nhacDoi.docBaiHat(req.params.id);
  if (!wav) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Chưa có bài hát này. Tạo trong Cài đặt → Đội AI dẫn → Bài hát.', 404);
  guiWav(res, wav);
});

r.delete('/doi-ai/bai-hat/:id', (req, res) => {
  res.json({ bai_hat: nhacDoi.xoaBaiHat(req.params.id) });
});

// Nhạc của đội (F-47): Lyria làm một bài (khoảng 1 phút, 0,08 USD), MOZA cắt phần dùng và lưu.
r.post('/doi-ai/nhac', async (req, res) => {
  const kq = await nhacDoi.lamNhac({ loai: String(req.body?.loai || ''), moTa: req.body?.mo_ta });
  baoMucTran(kq.canhBao);
  res.status(201).json({ nhac: doiAi.nhac(), loai: kq.loai, giay: kq.giay, chi_phi_usd: kq.usd });
});

r.get('/doi-ai/nhac/:loai', (req, res) => {
  const wav = nhacDoi.docNhac(req.params.loai);
  if (!wav) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Chưa có nhạc này. Bấm "🎵 Tạo" trong Cài đặt → Đội AI dẫn.', 404);
  guiWav(res, wav);
});

r.delete('/doi-ai/nhac/:loai', (req, res) => {
  res.json({ nhac: nhacDoi.xoaNhac(req.params.loai) });
});

r.put('/doi-ai/nhan-vat', (req, res) => {
  res.json({ nhan_vat: doiAi.luuNhanVat(req.body?.nhan_vat) });
});

// Giọng ElevenLabs tiếng Việt (BH10, F-108): danh sách thư viện chung (miễn phí, có bản nghe thử), bấm "Dùng" → thêm vào tài khoản.
// Lỗi ElevenLabs (chưa có khóa, khóa sai…) → lỗi nghiệp vụ có câu dễ hiểu, không phải "lỗi phần mềm".
const loiEleven = (e) => (e?.nha === 'elevenlabs' ? new LoiNghiepVu(e.ma === 'CHUA_CO_KHOA' ? 'CHUA_CO_KHOA' : 'GIONG_LOI', e.message, e.ma === 'CHUA_CO_KHOA' ? 409 : 502) : e);
r.get('/doi-ai/giong-eleven', async (req, res) => {
  const gioi = ['nam', 'nu'].includes(req.query.gioi) ? req.query.gioi : '';
  try { res.json({ giong: await require('../agent/nha-cung-cap/doc-elevenlabs').dsGiong({ gioi }) }); } catch (e) { throw loiEleven(e); }
});

r.post('/doi-ai/giong-eleven', async (req, res) => {
  const { owner_id: ownerId, voice_id: voiceId, ten, nhan_vat: i } = req.body || {};
  let id;
  try { id = await require('../agent/nha-cung-cap/doc-elevenlabs').themGiong({ ownerId, voiceId, ten }); } catch (e) { throw loiEleven(e); }
  res.json({ nhan_vat: doiAi.datGiongEleven(Number(i), id) });
});

// Tạo giọng Bắc tả bằng lời cho các nhân vật còn dùng giọng kho (#50: giọng kho tiếng Việt nghe ra giọng miền Nam).
r.post('/doi-ai/tao-giong-bac', async (req, res) => {
  const kq = await doiAi.taoGiongBac();
  baoMucTran(kq.canhBao);
  res.status(201).json({ nhan_vat: kq.nhanVat, tao_moi: kq.taoMoi, chi_phi_usd: kq.usd });
});

// Đoạn nào của kịch bản đã có tiếng sẵn (không gọi Google).
r.get('/doi-ai/co-san', (req, res) => {
  const kb = kichBan.layKichBan(String(req.query.kich_ban_id || ''));
  res.json({ co_san: kb.doan.map((d) => phongThu.coSan(d)), la_thoai: kb.doan.map((d) => doiAi.laThoaiDoi(d.loi_nhac)) });
});

// Làm (hoặc lấy lại) tiếng một đoạn để nghe thử trong màn hình Kịch bản.
r.post('/doi-ai/tieng', async (req, res) => {
  const { kb, i, d } = layDoan(req.body?.kich_ban_id, req.body?.doan);
  const kq = await phongThu.lamTiengDoan({ doan: d, viec: `Đội AI · nghe thử đoạn ${i + 1}/${kb.doan.length}` });
  baoMucTran(kq.canhBao);
  res.status(201).json({ phan: kq.phan, bo_cau: kq.bo, cho: kq.cho, dap_an: kq.dapAn, tiet_muc: kq.tietMuc, chi_phi_usd: kq.usd });
});

r.get('/doi-ai/tieng/:id', (req, res) => {
  const wav = phongThu.docTep(req.params.id);
  if (!wav) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Tệp tiếng này chưa có hoặc đã bị xóa.', 404);
  guiWav(res, wav);
});

// Làm sẵn tiếng cả kịch bản: chạy nền, báo tiến độ qua /ws (`doi_ai.lam_tieng`). Một lúc một kịch bản.
let dangLamSan = null;
r.post('/doi-ai/lam-san', (req, res) => {
  const kb = kichBan.layKichBan(String(req.body?.kich_ban_id || ''));
  if (dangLamSan) throw new LoiNghiepVu('DANG_LAM', 'Đang làm sẵn tiếng cho một kịch bản khác. Chờ xong rồi bấm lại.', 409);
  dangLamSan = kb.id;
  (async () => {
    const tong = kb.doan.length;
    const kq = { kich_ban_id: kb.id, tong, giay: 0, chi_phi_usd: 0, lam_moi: 0, dung_lai: 0, loi: [] };
    for (const [i, d] of kb.doan.entries()) {
      if (!doiAi.tachThoai(d.loi_nhac).luot.length) continue;
      phat('doi_ai.lam_tieng', { kich_ban_id: kb.id, doan: i, tong, trang_thai: 'dang_lam' });
      try {
        const x = await phongThu.lamTiengDoan({ doan: d, viec: `Đội AI · làm sẵn đoạn ${i + 1}/${tong}` });
        kq.chi_phi_usd += x.usd;
        for (const p of x.phan) {
          kq.giay += p.giay;
          kq[p.tuKho ? 'dung_lai' : 'lam_moi'] += 1;
        }
        baoMucTran(x.canhBao);
        if (x.canhBao) break;
      } catch (e) {
        kq.loi.push({ doan: i, thong_diep: e.message });
        if (e.ma === 'KHAN_CAP_DANG_BAT' || e.ma === 'HET_LUOT_NGAY') break;
      }
    }
    phat('doi_ai.lam_tieng', { ...kq, trang_thai: 'xong', giay: Math.round(kq.giay), chi_phi_usd: Math.round(kq.chi_phi_usd * 10000) / 10000 });
  })().catch((e) => console.error('  [đội AI] làm sẵn lỗi: ' + e.message)).finally(() => { dangLamSan = null; });
  res.status(202).json({ dang_lam: true, tong: kb.doan.length });
});

module.exports = r;
