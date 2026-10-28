'use strict';

/**
 * API sản phẩm, bảng size, tồn kho, ảnh, "Tạo từ ảnh", "Nói với Mai" (SPEC.md mục 8; F-51, F-52, F-62).
 * Ảnh gửi lên là thân nhị phân (trình duyệt đã thu nhỏ về JPEG cạnh dài 1600 px, mục 6), tối đa 3 MB.
 * Ảnh chỉ phục vụ ở 127.0.0.1 qua đường này (không qua cổng webhook — mục 9).
 */

const express = require('express');
const sp = require('../nghiep-vu/san-pham');
const bangSize = require('../nghiep-vu/bang-size');
const kho = require('../nghiep-vu/kho');
const { LoiNghiepVu } = require('../nghiep-vu/chung');

const r = express.Router();
const thanAnh = express.raw({ type: () => true, limit: '3mb' });

function baoNgungBan(truoc, sau) {
  // Sản phẩm thôi "Đang bán" giữa buổi live: báo đỏ người dẫn ngay (Luồng 2, nhánh lỗi).
  if (truoc.trang_thai === 'dang_ban' && sau.trang_thai !== 'dang_ban') {
    try { require('../dich-vu').dichVu().phongAi.sanPhamNgungBan(sau.so); } catch { /* dịch vụ chưa mở (test nghiệp vụ) */ }
  }
}

/* ---------------- sản phẩm ---------------- */

r.get('/cau-hinh/danh-muc', (req, res) => {
  res.json({ ...sp.cauHinh(), so_ke_tiep: sp.soKeTiep() });
});

r.get('/san-pham', (req, res) => {
  const q = req.query;
  res.json({
    san_pham: sp.danhSach({ q: String(q.q || ''), trang_thai: String(q.trang_thai || ''), danh_muc: String(q.danh_muc || ''), kho: String(q.kho || '') }),
    dem: sp.demTheoTrangThai(),
  });
});

r.post('/san-pham', (req, res) => {
  res.status(201).json(sp.taoSanPham(req.body || {}));
});

r.get('/san-pham/:id', (req, res) => {
  res.json(sp.chiTiet(req.params.id));
});

r.put('/san-pham/:id', (req, res) => {
  const truoc = sp.laySanPham(req.params.id);
  const kq = sp.suaSanPham(req.params.id, req.body || {});
  baoNgungBan(truoc, kq.san_pham);
  res.json(kq);
});

r.get('/san-pham/:id/ban-sua', (req, res) => {
  res.json({ ban_sua: sp.banSua(req.params.id) });
});

r.post('/san-pham/:id/nhan-ban', (req, res) => {
  res.status(201).json(sp.nhanBan(req.params.id));
});

// Thẻ AI đọc — để người dùng kiểm: đúng thứ mọi AI thấy (không có giá vốn, ghi chú nội bộ).
r.get('/san-pham/:id/the-ai', (req, res) => {
  const s = sp.laySanPham(req.params.id);
  res.json({ the: sp.theChoAi(s), do_day_du: sp.doDayDu(s) });
});

// "Xem thử AI hiểu gì" (F-23): AI đọc thẻ một lần. Kết quả chỉ trả về màn hình, không lưu vào sản phẩm.
r.post('/san-pham/:id/soat', async (req, res) => {
  const { soatSanPham } = require('../agent/agents/soat-san-pham');
  const kq = await soatSanPham(req.params.id);
  if (!kq.ok) {
    const ma = kq.loi?.ma || 'AI_LOI';
    const thongDiep = ma === 'PHIEU_SAI' ? 'AI trả kết quả chưa đúng (đoạn trích không khớp với thẻ). Bấm thử lại; chi tiết ở Cài đặt → Trợ lý AI → Nhật ký.'
      : kq.loi?.thong_diep || 'AI chưa đọc được sản phẩm này. Thử lại sau.';
    throw new LoiNghiepVu(ma, thongDiep, ma === 'KHAN_CAP_DANG_BAT' ? 409 : 502);
  }
  res.json({ ket_qua: kq.ketQua, san_pham: kq.san_pham, run_id: kq.runId, nha: kq.nha, model: kq.model });
});

/* ---------------- ảnh ---------------- */

// Tải một ảnh vào khu tạm (trước khi có sản phẩm, hoặc thêm ảnh khi sửa). Trả tên tệp để gắn vào sản phẩm.
r.post('/anh-tam', thanAnh, (req, res) => {
  res.status(201).json({ tep: sp.luuAnhTam(req.body) });
});

// Video sản phẩm (#90): thân nhị phân MP4 / WebM tối đa 80 MB; phát lại có hỗ trợ tua (Range) cho màn hình sản phẩm.
r.post('/video-tam', express.raw({ type: () => true, limit: '80mb' }), (req, res) => {
  res.status(201).json({ tep: sp.luuVideoTam(req.body) });
});

r.get('/video/:sanPhamId/:ten', (req, res) => {
  const f = sp.duongVideo(req.params.sanPhamId, req.params.ten);
  if (!f) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có video này.', 404);
  res.sendFile(f, { acceptRanges: true, headers: { 'Cache-Control': 'private, max-age=86400' } });
});

r.get('/anh/:sanPhamId/:ten', (req, res) => {
  const f = sp.duongAnh(req.params.sanPhamId, req.params.ten);
  if (!f) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có ảnh này.', 404);
  res.set('Cache-Control', 'private, max-age=86400');
  res.sendFile(f);
});

// "Tạo từ ảnh" (#75): ảnh đã tải → phiếu AI điền, chưa lưu. Ô AI điền mang nhãn "AI đoán".
r.post('/san-pham/tu-anh', async (req, res) => {
  const { docAnh } = require('../agent/agents/doc-anh');
  const kq = await docAnh((req.body || {}).anh || []);
  if (!kq.ok) throw new LoiNghiepVu(kq.loi?.ma || 'AI_LOI', `AI chưa đọc được ảnh: ${kq.loi?.thong_diep || 'lỗi'}. Thử lại, hoặc điền tay.`, 502);
  res.json({ nhap: kq.nhap, run_id: kq.runId, nha: kq.nha, model: kq.model, chi_phi_usd: kq.chiPhi });
});

/* ---------------- bảng size ---------------- */

r.get('/bang-size', (req, res) => {
  res.json({ bang_size: bangSize.danhSachBang(), cot: bangSize.COT });
});

r.post('/bang-size', (req, res) => {
  res.status(201).json({ bang_size: bangSize.taoBang(req.body || {}) });
});

r.get('/bang-size/:id', (req, res) => {
  res.json({ bang_size: bangSize.layBang(req.params.id) });
});

r.put('/bang-size/:id', (req, res) => {
  res.json({ bang_size: bangSize.suaBang(req.params.id, req.body || {}) });
});

r.get('/bang-size/:id/ban-sua', (req, res) => {
  res.json({ ban_sua: bangSize.banSuaBang(req.params.id) });
});

/* ---------------- tồn kho (F-52) ---------------- */

function baoKho(ds) {
  try { require('../ws').phat('kho.cap_nhat', { dong: ds }); } catch { /* chưa có ws */ }
}

r.get('/kho', (req, res) => {
  const id = String(req.query.san_pham_id || '');
  if (id) return res.json({ san_pham: sp.chiTiet(id).san_pham, phan_loai: kho.conHang(id) });
  // Lưới tồn theo sản phẩm (mọi sản phẩm trừ Ngừng bán, hoặc cả Ngừng bán khi hỏi).
  const ds = sp.danhSach({ trang_thai: String(req.query.trang_thai || '') })
    .filter((x) => req.query.trang_thai || x.trang_thai !== 'ngung_ban')
    .map((x) => ({ ...x, phan_loai: kho.conHang(x.id) }));
  const nguong = require('../nghiep-vu/cai-dat').banHang().nguong_sap_het;
  res.json({ san_pham: ds, nguong_sap_het: nguong });
});

r.post('/kho/nhap', (req, res) => {
  const kq = kho.nhap((req.body || {}).dong || [], { ghiChu: String((req.body || {}).ghi_chu || '') });
  baoKho(kq);
  res.json({ ket_qua: kq });
});

r.post('/kho/dieu-chinh', (req, res) => {
  const kq = kho.dieuChinh((req.body || {}).dong || [], { ghiChu: String((req.body || {}).ghi_chu || 'kiểm kê') });
  baoKho(kq);
  res.json({ ket_qua: kq });
});

r.get('/kho/lich-su', (req, res) => {
  res.json({ lich_su: kho.lichSu({ phanLoaiId: String(req.query.phan_loai_id || '') || null, sanPhamId: String(req.query.san_pham_id || '') || null }) });
});

/* ---------------- Nói với Mai (F-62) ---------------- */

r.post('/noi-voi-mai', async (req, res) => {
  const { noiVoiMai } = require('../agent/agents/quan-ly');
  res.json(await noiVoiMai((req.body || {}).cau));
});

r.post('/noi-voi-mai/:viecId/lam', async (req, res) => {
  const { xuLyChoDuyet } = require('../agent/thuc-hien');
  const muc = await xuLyChoDuyet(req.params.viecId, true);
  if (muc.ket_qua?.loi) throw new LoiNghiepVu(muc.ket_qua.loi.ma || 'LOI', muc.ket_qua.loi.thong_diep, 409);
  baoKho([]);
  res.json({ ket_qua: muc.ket_qua });
});

r.post('/noi-voi-mai/:viecId/bo', async (req, res) => {
  const { xuLyChoDuyet } = require('../agent/thuc-hien');
  await xuLyChoDuyet(req.params.viecId, false);
  res.json({ ok: true });
});

module.exports = r;
