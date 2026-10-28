'use strict';

/**
 * API đơn hàng (SPEC.md mục 8; F-55, F-57, F-58). Chỉ gọi khối Nghiệp vụ.
 * Người làm được mọi chuyển trạng thái hợp lệ (mục 7); hoàn tác lần đổi gần nhất; gửi nhiều đơn một lần;
 * in phiếu giao hàng (khổ A6, hoặc 4 phiếu trên một tờ A4); xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt).
 */

const express = require('express');
const don = require('../nghiep-vu/don');
const kh = require('../nghiep-vu/khach');
const caiDat = require('../nghiep-vu/cai-dat');
const { LoiNghiepVu, hienTien } = require('../nghiep-vu/chung');

const r = express.Router();

/** Đơn diễn tập gửi mà chưa gõ mã vận đơn: sinh mã giả để AI báo khách như thật (#87). Đơn thật: không. */
function maGiaNeuTap(id) {
  try {
    const d = don.layDon(id);
    return d.dien_tap && !d.ma_van_don ? require('../nghiep-vu/dien-tap-ban-hang').maVanDonGia(d) : null;
  } catch { return null; }
}

function bao(d) {
  try {
    const { phat } = require('../ws');
    phat('don.cap_nhat', { don_id: d?.id || null });
    phat('kho.cap_nhat', {});
  } catch { /* chưa mở ws (test nghiệp vụ) */ }
  return d;
}

const locTuQuery = (q) => ({
  trangThai: String(q.trang_thai || ''), nhom: Object.hasOwn(don.NHOM_DON, String(q.nhom)) ? String(q.nhom) : '', q: String(q.q || ''), phienLiveId: String(q.phien_live_id || ''),
  tu: String(q.tu || ''), den: String(q.den || ''), chuaNhanTien: q.chua_nhan_tien === '1', thanhToan: ['cod', 'chuyen_khoan'].includes(q.thanh_toan) ? q.thanh_toan : '',
  dienTap: q.dien_tap === '1' ? true : q.dien_tap === 'tat_ca' ? null : false,
});

r.get('/don', (req, res) => {
  const loc = locTuQuery(req.query);
  res.json({ don: don.danhSach(loc).map((d) => ({ ...d, chua_lien_lac: don.chuaLienLacDuoc(d), ...(d.trang_thai === 'da_xac_nhan' ? { hoi_lai_nhan: don.mucHoiLai(d) } : {}),
    danh_dau: require('../nghiep-vu/gia-noi-nham').cuaDon(d.id).filter((x) => x.trang_thai === 'mo') /* F-106 */ })) /* F-99: nhãn nội bộ Nên hỏi lại */, dem: don.demTheoTrangThai({ dienTap: loc.dienTap === true }), dem_nhom: don.demTheoNhom({ dienTap: loc.dienTap === true }) });
});

/**
 * Xuất CSV (F-57) — F-101: `?hang=` chọn mẫu của hãng vận chuyển (mặc định "Chung" = file như trước), `?ids=a,b` chỉ các đơn đã chọn.
 */
r.get('/don/xuat.csv', (req, res) => {
  const xvc = require('../nghiep-vu/xuat-van-chuyen');
  const ids = String(req.query.ids || '').split(',').filter(Boolean);
  const ds = ids.length ? ids.map((id) => don.layDon(id)) : don.danhSach({ ...locTuQuery(req.query), gioiHan: 5000 });
  const kq = xvc.xuat(ds, String(req.query.hang || 'chung'));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${kq.ten_tep}"`);
  res.send(kq.noi_dung);
});

/** F-101: soát trước khi tải — đơn cần sửa địa chỉ, đơn dùng khối lượng mặc định 300 g. */
r.get('/don/xuat-kiem', (req, res) => {
  const xvc = require('../nghiep-vu/xuat-van-chuyen');
  const ids = String(req.query.ids || '').split(',').filter(Boolean);
  const kq = xvc.xuat(ids.map((id) => don.layDon(id)), String(req.query.hang || 'nhap_hang_loat'));
  res.json({ can_sua: kq.can_sua, khoi_luong_mac_dinh: kq.khoi_luong_mac_dinh, mau: xvc.danhSachMau() });
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Phiếu giao hàng (F-57): tên shop, người nhận, món, tiền thu hộ (COD). In bằng trình duyệt. */
r.get('/don/phieu', (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 200);
  if (!ids.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn ít nhất một đơn để in.');
  const a4 = req.query.kho === 'a4';
  const b = caiDat.banHang();
  const phieu = ids.map((id) => don.layDon(id)).map((d) => `
    <section class="phieu">
      <div class="dau"><b>${esc(b.ten_shop || 'Shop')}</b>${b.sdt_shop ? ` · ${esc(b.sdt_shop)}` : ''}${b.dia_chi_shop ? `<br>${esc(b.dia_chi_shop)}` : ''}</div>
      <div class="ma">${esc(d.ma)}${d.ma_van_don ? ` · Vận đơn ${esc(d.ma_van_don)}` : ''}</div>
      <div class="nhan"><div>Người nhận: <b>${esc(d.ten_nhan || '—')}</b></div><div>Điện thoại: <b>${esc(kh.hienSdt(d.sdt_nhan) || '—')}</b></div>
        <div>Địa chỉ: ${esc(d.dia_chi_nhan || '—')}</div></div>
      <table>${d.dong.map((x) => `<tr><td>${esc(x.ten_chup)}</td><td class="so">x${x.so_luong}</td><td class="so">${hienTien(x.don_gia * x.so_luong)}</td></tr>`).join('')}
        <tr><td colspan="2">Phí ship</td><td class="so">${hienTien(d.phi_ship)}</td></tr></table>
      <div class="thu">${d.thanh_toan === 'cod' && !d.da_nhan_tien_luc ? `Thu hộ (COD): ${hienTien(d.tong_tien)}` : 'Không thu tiền'}</div>
      ${d.thanh_toan === 'chuyen_khoan' && !d.da_nhan_tien_luc ? '<div class="ghi">Chuyển khoản — shop chưa đánh dấu đã nhận tiền.</div>' : ''}
      ${d.ghi_chu ? `<div class="ghi">Ghi chú: ${esc(d.ghi_chu)}</div>` : ''}
    </section>`).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu giao hàng</title><style>
    @page { size: ${a4 ? 'A4' : 'A6'}; margin: ${a4 ? '8mm' : '4mm'}; }
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 0; color: #000; }
    ${a4 ? '.giay { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; } .phieu { height: 132mm; }' : '.phieu { page-break-after: always; }'}
    .phieu { border: 1px dashed #000; padding: 4mm; box-sizing: border-box; overflow: hidden; break-inside: avoid; }
    .dau { border-bottom: 1px solid #000; padding-bottom: 2mm; } .ma { font-size: 14pt; font-weight: bold; margin: 2mm 0; }
    .nhan div { margin: 1mm 0; } table { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 10pt; }
    td { border-top: 1px solid #999; padding: 1mm 0; } td.so { text-align: right; white-space: nowrap; padding-left: 2mm; }
    .thu { font-size: 14pt; font-weight: bold; border: 2px solid #000; padding: 2mm; text-align: center; } .ghi { margin-top: 2mm; font-size: 10pt; }
    .nut { position: fixed; top: 8px; right: 8px; font-size: 14pt; } @media print { .nut { display: none; } }
  </style></head><body><button class="nut" onclick="print()">In</button><div class="giay">${phieu}</div></body></html>`);
});

/* ---------------- Nhắn bù (F-73) ---------------- */

r.get('/don/nhan-bu', (req, res) => {
  const nhanBu = require('../nghiep-vu/nhan-bu');
  const dienTap = req.query.dien_tap === '1' ? true : req.query.dien_tap === 'tat_ca' ? null : false;
  const { dichVu } = require('../dich-vu');
  let dang = null;
  try { dang = dichVu().chotDon.nhanBuDang; } catch { /* chưa mở dịch vụ (test) */ }
  res.json({ nhan_bu: nhanBu.danhSach({ lyDo: 'page_bi_cam', dienTap }), dang, page_bi_cam: require('../nghiep-vu/fb-page').dsBiCam() });
});

/**
 * Nhắn bù (người bấm): `ids` hoặc `tat_ca`. Page còn ghi "bị khóa" → hỏi Meta lại trước (Page Integrity); Meta vẫn khóa thì báo,
 * không gửi. Gửi nền, 3 tin mỗi phút.
 */
r.post('/don/nhan-bu/gui', async (req, res) => {
  const nhanBu = require('../nghiep-vu/nhan-bu');
  const fbPage = require('../nghiep-vu/fb-page');
  const dienTap = req.body?.dien_tap === true;
  const ds = nhanBu.danhSach({ lyDo: 'page_bi_cam', dienTap }).filter((x) => req.body?.tat_ca || (req.body?.ids || []).includes(x.id));
  if (!ds.length) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có ai trong danh sách Nhắn bù để gửi.', 404);
  const { dichVu } = require('../dich-vu');
  const dv = dichVu();
  const camPages = [...new Set(ds.map((x) => x.page_id))].filter((id) => fbPage.biCam(id));
  if (camPages.length) {
    const { kiemPages, dsPage } = require('../kiem-page');
    await kiemPages(dsPage({ ketNoiFb: dv.ketNoiFb, fbGia: dv.fbGia }).filter((p) => camPages.includes(p.pageId)), require('../ws').phat);
    const con = camPages.filter((id) => fbPage.biCam(id));
    if (con.length) throw new LoiNghiepVu('PAGE_VAN_BI_KHOA', 'Meta vẫn đang khóa nhắn tin của Page: chưa nhắn bù được. Xem Chất lượng Page trong Meta Business Suite; hết khóa thì bấm lại.', 409);
  }
  dv.chotDon.nhanBuNhieu(ds.map((x) => x.id)).catch((e) => console.error('  [nhắn bù] ' + e.message));
  res.json({ bat_dau: ds.length, cach_giay: 20 });
});

r.post('/don/nhan-bu/:id/bo', (req, res) => {
  const nhanBu = require('../nghiep-vu/nhan-bu');
  const x = nhanBu.lay(req.params.id);
  if (!x) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có dòng nhắn bù này.', 404);
  res.json(nhanBu.dat(x.id, 'bo', 'Người bấm Bỏ'));
});

// F-99: "Hỏi lại ngay" (người muốn gửi sớm, không chờ 2 giờ).
// F-106: xử lý đánh dấu "Mai nói nhầm giá": giu_gia_dung · ban_theo_gia_noi · da_xem. Tổng đổi + thẻ đã gửi → gửi thẻ mới.
r.post('/don/:id/danh-dau/:ddId/xu-ly', async (req, res) => {
  const gnn = require('../nghiep-vu/gia-noi-nham');
  const kq = gnn.xuLy(req.params.ddId, String(req.body?.cach || ''));
  let the = null;
  if (kq.doi_tong && kq.don.trang_thai === 'cho_xac_nhan' && kq.don.the_gui) {
    try { the = await require('../gui-the-don').guiTheDon({ d: kq.don, layKetNoi: require('../dich-vu').dichVu().layKetNoi }); } catch (e) { the = { da_gui: false, ly_do: e.message }; }
  }
  res.json({ ...kq, the });
});

r.post('/don/:id/hoi-lai', async (req, res) => {
  const d = don.layDon(req.params.id);
  if (d.trang_thai !== 'da_xac_nhan') throw new LoiNghiepVu('CHUYEN_KHONG_HOP_LE', 'Chỉ hỏi lại đơn Đã xác nhận (Cần gửi).', 409);
  const kq = await require('../dich-vu').dichVu().hopThu.guiHoiLai(d);
  res.json({ ...bao(don.layDon(d.id)), gui: kq });
});

r.get('/don/:id', (req, res) => {
  const d = don.layDon(req.params.id);
  let khach = null;
  if (d.khach_id) { try { khach = kh.layKhach(d.khach_id); } catch { /* hồ sơ đã xóa */ } }
  if (khach) khach.so_hoan = don.danhSach({ trangThai: 'hoan' }).filter((x) => x.khach_id === khach.id).length;
  res.json({ don: d, lich_su: don.lichSu(d.id), khach, con_thieu: don.viecConThieu(d),
    // F-69: MOZA đã nhắc / báo hủy mấy lần, khách có xin dừng nhận tin không; chưa có số mà khách im quá 24 giờ.
    lien_he: require('../nghiep-vu/lien-he').tomTatDon(d), chua_lien_lac: don.chuaLienLacDuoc(d),
    // F-90: đơn gộp — truy ngược hai chiều.
    gop_tu: don.donGopVao(d.id), gop_vao: d.gop_vao ? (() => { try { return { id: d.gop_vao, ma: don.layDon(d.gop_vao).ma }; } catch { return null; } })() : null });
});

/** Người tạo đơn tay (khách gọi điện, nhắn Zalo…). */
r.post('/don', (req, res) => {
  const b = req.body || {};
  let d = don.taoDon({ mon: b.mon, nguon: 'nguoi', ghiChu: b.ghi_chu || '', boi: 'nguoi' });
  if (b.ten || b.sdt || b.dia_chi || b.thanh_toan) {
    let khachId = null;
    if (b.sdt) khachId = kh.taoKhach({ ten: b.ten || '', sdt: b.sdt, diaChi: b.dia_chi || '', taoBoi: 'nguoi' }).khach.id;
    d = don.datThongTinGiao(d.id, { ten: b.ten ?? null, sdt: b.sdt || null, diaChi: b.dia_chi ?? null, thanhToan: b.thanh_toan || null, khachId }, { boi: 'nguoi' });
  }
  res.status(201).json(bao(d));
});

r.put('/don/:id', (req, res) => {
  const b = req.body || {};
  let d = don.layDon(req.params.id);
  if (['ten', 'sdt', 'dia_chi', 'thanh_toan', 'ghi_chu'].some((k) => k in b)) {
    d = don.datThongTinGiao(d.id, { ten: b.ten ?? null, sdt: b.sdt ?? null, diaChi: b.dia_chi ?? null, thanhToan: b.thanh_toan ?? null, ghiChu: b.ghi_chu ?? null }, { boi: 'nguoi' });
  }
  if ('phi_ship' in b && b.phi_ship !== null && b.phi_ship !== '') d = don.datPhiShip(d.id, b.phi_ship);
  if ('ma_van_don' in b) d = don.datMaVanDon(d.id, b.ma_van_don);
  res.json(bao(d));
});

r.post('/don/:id/mon', (req, res) => {
  res.json(bao(don.themMon(req.params.id, req.body?.phan_loai_id, req.body?.so_luong ?? 1, { boi: 'nguoi' })));
});

// GD1 (F-123): thêm món bằng chữ ("12 đen M") — dùng chung bộ đọc món với AI (timMon), rồi qua đúng don.themMon (giữ hàng, giá theo F-93).
r.post('/don/:id/them-theo-chu', (req, res) => {
  const chu = String(req.body?.chu || '').trim();
  if (!chu) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Gõ món cần thêm, ví dụ "12 đen M".');
  let m;
  try {
    m = require('../agent/cong-cu/don').timMon(chu, {});
  } catch (e) {
    // Câu lỗi của bộ đọc món viết cho AI ("Gọi muc_luc_san_pham…", "Hỏi lại khách"): bỏ phần đó, người dùng chỉ cần biết món nào sai.
    if (!(e instanceof LoiNghiepVu)) throw e;
    const gon = e.message.replace(/s*Gọi muc_luc_san_pham[^.]*./, '').replace(/s*Hỏi lại khách./, '').replace(/ Ghi rõ một món:.*$/, ' Gõ kiểu "12 đen M" (số sản phẩm, màu, cỡ).').trim();
    throw new LoiNghiepVu(e.ma, gon, 400);
  }
  res.json(bao(don.themMon(req.params.id, m.phan_loai.id, m.so_luong, { boi: 'nguoi' })));
});

r.post('/don/:id/bot-mon', (req, res) => {
  res.json(bao(don.botMon(req.params.id, req.body?.phan_loai_id, req.body?.so_luong ?? null, { boi: 'nguoi' })));
});

r.post('/don/:id/doi-phan-loai', (req, res) => {
  res.json(bao(don.doiPhanLoai(req.params.id, req.body?.tu, req.body?.den, null, { boi: 'nguoi' })));
});

r.post('/don/:id/trang-thai', (req, res) => {
  const b = req.body || {};
  const d = don.layDon(req.params.id);
  if (b.den === 'da_gui' && (b.ma_van_don || maGiaNeuTap(d.id))) don.datMaVanDon(d.id, b.ma_van_don || maGiaNeuTap(d.id));
  const x = bao(don.doiTrangThai(d.id, String(b.den || ''), { nguon: 'nguoi', ghiChu: b.ghi_chu || null }));
  // F-98: người xác nhận (ví dụ sau cuộc gọi xác nhận #73) → báo khách bằng tin do máy soạn (0 AI).
  if (b.den === 'da_xac_nhan' && d.trang_thai === 'cho_xac_nhan') {
    const { hienTien } = require('../nghiep-vu/chung');
    let layKetNoi = null;
    try { layKetNoi = require('../dich-vu').dichVu().layKetNoi; } catch { /* test không mở dịch vụ */ }
    if (layKetNoi) {
      require('../gui-the-don').guiTrangThai({ d: x, loai: 'da_xac_nhan', layKetNoi, chu: require('../nghiep-vu/cau-mau-khach').cau('tt_da_xac_nhan', { ma: x.ma, tong: hienTien(x.tong_tien) }) })
        .catch((e) => console.error('  [đơn] báo đã xác nhận lỗi: ' + e.message));
    }
  }
  res.json(x);
});

// F-92: danh sách chờ khi hết hàng — xem, người hủy tay.
r.get('/cho-hang', (req, res) => {
  const dienTap = req.query.dien_tap === '1' ? true : req.query.dien_tap === 'tat_ca' ? null : false;
  res.json(require('../nghiep-vu/cho-hang').danhSach({ dienTap }));
});
r.delete('/cho-hang/:id', (req, res) => { res.json(require('../nghiep-vu/cho-hang').huy(req.params.id)); bao(null); });

r.post('/don/:id/hoan-tac', (req, res) => res.json(bao(don.hoanTac(req.params.id))));
r.post('/don/:id/nhan-tien', async (req, res) => {
  const truoc = don.layDon(req.params.id);
  const d = bao(don.nhanTien(truoc.id));
  // F-89: chuyển khoản — lần đầu đánh dấu thì báo khách bằng câu mẫu (trong 24 giờ; AI không bao giờ nói câu này).
  let bao_khach = null;
  if (!truoc.da_nhan_tien_luc && d.thanh_toan === 'chuyen_khoan') {
    try { bao_khach = await require('../chuyen-khoan').baoDaNhanTien({ d, layKetNoi: require('../dich-vu').dichVu().layKetNoi }); } catch (e) { bao_khach = { da_gui: false, ly_do: e.message }; }
  }
  res.json({ ...d, bao_khach });
});
r.post('/don/:id/nhan-hoan', (req, res) => res.json(bao(don.nhanHoan(req.params.id))));

/** Đánh dấu "Đã gửi" nhiều đơn một lần (F-57), kèm mã vận đơn từng đơn nếu có. */
r.post('/don/gui', (req, res) => {
  const ds = (Array.isArray(req.body?.ds) ? req.body.ds : []).map((x) => ({ ...x, ma_van_don: x.ma_van_don || maGiaNeuTap(x.id) }));
  const kq = don.guiNhieu(ds, { nguon: 'nguoi' });
  bao(null);
  res.json({ ket_qua: kq, ok: kq.filter((x) => x.ok).length, loi: kq.filter((x) => !x.ok).length });
});

module.exports = r;
