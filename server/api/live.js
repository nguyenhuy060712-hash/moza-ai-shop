'use strict';

/**
 * Phiên live (SPEC.md mục 8 nhóm "Live"). Trình duyệt ra lệnh bằng HTTP; máy chủ đẩy thay đổi qua /ws.
 */

const express = require('express');
const live = require('../nghiep-vu/live');
const { dichVu } = require('../dich-vu');
const { phat } = require('../ws');
const { LoiNghiepVu } = require('../nghiep-vu/chung');

const r = express.Router();

function chiTiet(p) {
  if (!p) return { phien: null };
  const { phongLive, phongAi, chepLoi, mieng, doiAi } = dichVu();
  return {
    phien: p,
    binh_luan: live.binhLuanGanDay(p.id, 50).map((b) => ({ ...b, khach_cu: require('../nghiep-vu/so-lieu-phut').laKhachCu(p.id, b.nguoi_fb_id) })),
    dem: live.demBinhLuan(p.id),
    ai: phongAi.trangThai(p.id),
    cach_doc: phongLive.cachDoc(p.id),
    chep_loi: chepLoi.trangThai(p.id),
    mieng: mieng.trangThai(p.id),
    doi_ai: doiAi.trangThai(p.id), // bản 2.9, F-46
    lua_chon_mieng: require('../nghiep-vu/cai-dat').MAC_DINH.mieng.filter((x) => !x.chi_dien_tap || p.dien_tap), // F-105: miệng giả chỉ buổi tập
    nhieu_live: phongLive.nhieuLive?.phienId === p.id ? phongLive.nhieuLive.live : [],
  };
}

r.get('/live/phien', (req, res) => {
  res.json({ phien: live.danhSachPhien(20) });
});

r.post('/live/phien', (req, res) => {
  // Phiên thật chỉ khi người dùng chọn và Facebook thật đã kết nối; còn lại là diễn tập trên Facebook giả.
  const muonThat = (req.body || {}).dien_tap === false;
  if (muonThat && !dichVu().ketNoiFb.guiDuoc()) {
    throw new LoiNghiepVu('FB_CHUA_KET_NOI', 'Facebook thật chưa kết nối (hoặc mã hết hạn). Vào Cài đặt → Facebook, hoặc chọn Diễn tập.');
  }
  const p = live.taoPhien({ ...req.body, dien_tap: !muonThat });
  phat('live.trang_thai', { phien_id: p.id });
  res.status(201).json(chiTiet(p));
});

r.get('/live/phien/hien-tai', (req, res) => {
  res.json(chiTiet(live.phienDangMo()));
});

r.get('/live/phien/:id', (req, res) => {
  res.json(chiTiet(live.layPhien(req.params.id)));
});

r.post('/live/phien/:id/doan', (req, res) => {
  const p = live.doiDoan(req.params.id, (req.body || {}).doan);
  phat('live.doan', { phien_id: p.id, doan: p.doan_hien_tai });
  res.json({ phien: p });
});

// Đổi chế độ AI và miệng giữa phiên (F-22): miệng tự mở / đóng / đổi trong vòng 1 giây.
// Bản 2.7 (#47): che_do_ai "dan" = Mai dẫn chính; người dẫn vừa chọn thì Mai dẫn luôn (bỏ tạm dừng cũ của phiên).
r.put('/live/phien/:id/che-do', async (req, res) => {
  const p = live.datCheDo(req.params.id, req.body || {});
  phat('live.che_do', { phien_id: p.id, che_do_ai: p.che_do_ai, mieng: p.mieng, mai_dan: p.mai_dan, doi_ai: p.doi_ai });
  if (p.mai_dan) dichVu().mieng.chonDanChinh(p.id);
  await dichVu().mieng.dongBo();
  dichVu().doiAi.dongBo(); // bản 2.9: Đội AI dẫn bật / tắt ngay
  res.json({ phien: p });
});

// Mai dẫn chính (bản 2.7, F-43): "▶ Mai dẫn tiếp" sau DỪNG AI hoặc sau khi Mai chào kết.
// Bản 2.9 (F-46): phiên Đội AI dẫn thì đội dẫn tiếp từ chỗ dừng.
r.post('/live/phien/:id/mai-dan-tiep', (req, res) => {
  const p = live.layPhien(req.params.id);
  if (p.doi_ai) {
    dichVu().doiAi.danTiep(p.id);
    return res.json({ doi_ai: dichVu().doiAi.trangThai(p.id) });
  }
  dichVu().mieng.danTiep(p.id);
  res.json({ mieng: dichVu().mieng.trangThai(p.id) });
});

// Page có từ 2 live: người dùng chọn live gắn vào phiên (F-19).
r.post('/live/phien/:id/chon-live', async (req, res) => {
  const id = String((req.body || {}).fb_live_video_id || '');
  if (!id) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa chọn live.');
  res.json({ phien: await dichVu().phongLive.chonLive(req.params.id, id) });
});

// Nút "Kiểm tra" trước khi live (F-19): AI dùng nhà nào, nhà nào đang lỗi; Facebook đang là bản nào.
// Micro và loa kiểm ngay trên trình duyệt. Kiểm khóa từng nhà có sẵn ở POST /keys/test.
/** Bảng "Sẵn sàng lên sóng" (F-77): dòng đỏ / vàng máy tự kiểm, 3 ô tích theo buổi, chốt test, câu ghim, câu mô tả. */
// F-93: giá live từng món của buổi (Chuẩn bị) — công tắc tắt thì bat = false, không có ô.
r.get('/live/phien/:id/gia-live', (req, res) => {
  const gb = require('../nghiep-vu/gia-ban');
  res.json({ bat: !!require('../nghiep-vu/cai-dat').banHang().gia_live_bat, ds: gb.giaLiveCuaPhien(req.params.id) });
});
r.put('/live/phien/:id/gia-live', (req, res) => {
  const b = req.body || {};
  res.json(require('../nghiep-vu/gia-ban').datGiaLive(req.params.id, String(b.san_pham_id || ''), { gia: b.gia ?? null, muc: b.muc ?? null }));
});

// F-94: người bấm "Đăng mục lục" / "Đăng lại mục lục" ở Báo cáo.
r.post('/live/phien/:id/muc-luc', async (req, res) => {
  res.json(await require('../dich-vu').dichVu().xemLai.dangMucLuc(req.params.id, { lai: true }));
});

r.get('/live/san-sang', (req, res) => {
  let dv = null;
  try { dv = dichVu(); } catch { /* chưa mở dịch vụ */ }
  res.json(require('../san-sang').kiem({ phienId: req.query.phien_id ? String(req.query.phien_id) : null, dv }));
});

r.post('/live/san-sang/tich', (req, res) => {
  const b = req.body || {};
  const p = b.phien_id ? live.layPhien(String(b.phien_id)) : live.phienDangMo();
  // Ô tích "lâu" (F-110, nhớ 7 ngày) không cần phiên.
  const lau = require('../san-sang').TICH.find((x) => x.k === String(b.k || ''))?.lau;
  if (!p && !lau) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Chưa có phiên live nào đang mở.', 404);
  try { require('../san-sang').datTich(p?.id || null, String(b.k || ''), !!b.bat); } catch (e) { throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', e.message); }
  res.json(require('../san-sang').kiem({ phienId: p?.id || null, dv: dichVu() }));
});

/** Nhật ký buổi live (F-80): chữ lên sóng theo giờ, gộp câu Co-host và bình luận chốt; `q` tìm chữ. */
r.get('/live/phien/:id/nhat-ky', (req, res) => {
  const p = live.layPhien(req.params.id);
  res.json({ phien: { id: p.id, ten: p.ten, dien_tap: p.dien_tap, bat_dau: p.bat_dau, ket_thuc: p.ket_thuc },
    dong: require('../nghiep-vu/nhat-ky-song').doc(p.id, { q: String(req.query.q || '') }), giu_ngay: require('../nghiep-vu/nhat-ky-song').giuNgay() });
});

/** Thẻ nhắc người dẫn (F-81): đang hiện + hàng chờ; người dẫn bấm "Đã làm". */
r.get('/live/the-nhac', (req, res) => res.json(dichVu().theNhac.trangThai()));
r.post('/live/the-nhac/xong', (req, res) => res.json(dichVu().theNhac.xong(String((req.body || {}).id || ''))));

/** Dòng số liệu cho người dẫn (F-85) khi mở lại màn hình giữa buổi. */
r.get('/live/phien/:id/so-lieu', (req, res) => res.json(dichVu().chotDon.soLieu(live.layPhien(req.params.id))));

/** F-116: bảng huấn luyện — số liệu theo phút của cả buổi (biểu đồ) khi mở lại màn hình giữa buổi. */
r.get('/live/phien/:id/huan-luyen', (req, res) => {
  const p = live.layPhien(req.params.id);
  res.json({ phien_id: p.id, so_lieu_phut: require('../nghiep-vu/so-lieu-phut').docPhien(p.id), canh_bao: dichVu().huanLuyen?.canhBaoGanDay(p.id) || null });
});

/**
 * F-117 (BH12): Mai đề xuất NHÁP kịch bản buổi sau từ bảng đoạn của buổi này (cần ≥ 10 phút số liệu). Nháp không tự lưu: trình duyệt cho
 * người sửa rồi lưu bằng POST /kich-ban. `mon_se_ban` (mảng số sản phẩm) không bắt buộc — thiếu thì lấy các món buổi này đã bán.
 */
r.post('/live/phien/:id/de-xuat-kich-ban', async (req, res) => {
  live.layPhien(req.params.id);
  const vao = (req.body || {}).mon_se_ban;
  if (vao != null && (!Array.isArray(vao) || vao.length > 100 || vao.some((x) => !Number.isInteger(x)))) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Món sẽ bán phải là danh sách số sản phẩm.');
  res.json(await require('../agent/agents/de-xuat-kich-ban').deXuat(req.params.id, { monSeBan: vao }));
});

/** F-115 chạm để trả lời: người dẫn chạm một bình luận → Mai soạn một câu trên thẻ gợi ý (ws live.goi_y kèm binh_luan_id). */
r.post('/live/phien/:id/tra-loi-binh-luan', async (req, res) => {
  const p = live.layPhien(req.params.id);
  const { phongAi, phongLive } = dichVu();
  res.json(await phongAi.traLoiBinhLuan(p.id, String((req.body || {}).binh_luan_id || ''), { tuVanSize: phongLive.tuVanSize }));
});

/** F-115 [Mai nói]: câu trên thẻ gợi ý lên sóng đúng nguyên văn (Mai nói cùng / dẫn chính, Đội AI). */
r.post('/live/phien/:id/goi-y/:cauId/mai-noi', (req, res) => {
  const p = live.layPhien(req.params.id);
  res.json(dichVu().phongAi.noiGoiY(p.id, req.params.cauId));
});

/**
 * F-115 [Trả lời bình luận]: đăng câu trên thẻ dưới bình luận đó — qua công cụ tra_loi_binh_luan (đủ hook, giới hạn liên hệ, chống
 * gửi trùng). Câu lấy từ thẻ gợi ý đang hiện (đã qua Bộ kiểm tra), không nhận chữ tự do.
 */
r.post('/live/phien/:id/binh-luan/:blId/dang-tra-loi', async (req, res) => {
  const p = live.layPhien(req.params.id);
  const { phongAi, layKetNoi } = dichVu();
  const g = phongAi.st.goiY;
  if (!g || g.binh_luan_id !== req.params.blId) throw new LoiNghiepVu('GOI_Y_HET_HAN', 'Thẻ gợi ý của bình luận này đã thay bằng câu khác.', 409);
  const bl = live.layBinhLuan(req.params.blId);
  const { hoiThoai } = require('../nghiep-vu/hop-thu').tuBinhLuanLive(bl, p);
  const { thucHienCongCu } = require('../agent/thuc-hien');
  const kq = await thucHienCongCu({
    ten: 'tra_loi_binh_luan',
    thamSo: { noi_dung: g.noi_dung, trich_dan: g.trich_dan || [] },
    nguCanh: { hoiThoaiId: hoiThoai.id, layKetNoi, guiBoi: 'nguoi', khoaChongTrung: `cham:${bl.id}` },
  });
  if (kq.loi) throw new LoiNghiepVu(kq.loi.ma || 'KHONG_GUI_DUOC', kq.loi.thong_diep || 'Không đăng được trả lời.', 409);
  require('../nghiep-vu/so-lieu-phut').danhDauDaTraLoi(p.id, bl.id);
  phat('live.da_tra_loi', { phien_id: p.id, binh_luan_id: bl.id });
  res.json({ ok: true, ket_qua: kq.ketQua ?? null });
});

/** F-115 / F-116: người dẫn đã trả lời một bình luận hỏi (bấm "Đã trả lời" / "Tự đọc") — thôi đếm vào cảnh báo câu hỏi. */
r.post('/live/phien/:id/binh-luan/:blId/da-tra-loi', (req, res) => {
  const p = live.layPhien(req.params.id);
  if (!require('../nghiep-vu/so-lieu-phut').danhDauDaTraLoi(p.id, req.params.blId)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không thấy bình luận này.', 404);
  phat('live.da_tra_loi', { phien_id: p.id, binh_luan_id: req.params.blId });
  res.json({ ok: true });
});

r.get('/live/kiem-tra', (req, res) => {
  const khoa = require('../khoa');
  const { fbGia, ketNoiFb } = dichVu();
  const p = live.phienDangMo();
  const that = p && p.dien_tap === false;
  res.json({
    ai: require('../agent/runtime').trangThaiNha(),
    khoa: khoa.trangThai(),
    facebook: that
      ? { loai: 'that', ten: 'Facebook thật', ...ketNoiFb.trangThaiGon() }
      : { loai: 'gia', ten: 'Facebook giả (Phòng diễn tập)', ...fbGia.trangThai(),
        ghi_chu: ketNoiFb.guiDuoc() ? 'Facebook thật đã kết nối: chọn "Live thật" khi tạo phiên.' : 'Facebook thật chưa kết nối (Cài đặt → Facebook).' },
  });
});

r.post('/live/phien/:id/ket-thuc', (req, res) => {
  const p = live.layPhien(req.params.id);
  if (p.trang_thai === 'xong') throw new LoiNghiepVu('PHIEN_DA_XONG', 'Phiên này đã kết thúc.', 409);
  res.json({ phien: dichVu().phongLive.ketThuc(p.id, 'Người dẫn kết thúc phiên') });
});

// DỪNG AI (F-16, F-22): hủy việc Director, Co-host đang làm, xóa câu gợi ý đang hiện; Mai đang nói thì tắt tiếng.
r.post('/live/phien/:id/dung-ai', (req, res) => {
  const p = live.layPhien(req.params.id);
  dichVu().phongAi.dungAi(p.id);
  phat('live.dung_ai', { phien_id: p.id });
  res.json({ ok: true });
});

// Người dẫn hỏi Mai bằng chữ trên Màn hình người dẫn. Chỉ gợi ý: Co-host trả lời bằng tin đang nói (hiện chữ);
// Co-host được nói: câu hỏi đi thẳng tới miệng của Mai.
r.post('/live/phien/:id/hoi-mai', async (req, res) => {
  const p = live.layPhien(req.params.id);
  res.json(await dichVu().phongAi.hoiMai(p.id, (req.body || {}).cau_hoi));
});

// "Chờ Tư vấn viên" (F-17): bình luận cần nhắn riêng, trong hạn 7 ngày. Tư vấn viên xử lý từ M5.
r.get('/live/cho-tu-van', (req, res) => {
  res.json({ binh_luan: live.danhSachChoTuVan() });
});

module.exports = r;
