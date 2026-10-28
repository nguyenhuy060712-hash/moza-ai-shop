'use strict';

/**
 * Phòng diễn tập (SPEC.md F-15): điều khiển Facebook giả — live giả, bình luận giả, kịch bản soạn sẵn,
 * Người đóng vai, giả "người dẫn đang nói".
 */

const express = require('express');
const { dichVu } = require('../dich-vu');
const { LoiNghiepVu } = require('../nghiep-vu/chung');
const { phat } = require('../ws');

const r = express.Router();

r.get('/dien-tap/trang-thai', (req, res) => {
  res.json(dichVu().dienTap.trangThai());
});

r.post('/dien-tap/live', (req, res) => {
  const { bat, tieu_de: tieuDe } = req.body || {};
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt live giả.');
  const { fbGia, dienTap } = dichVu();
  if (bat) fbGia.batDauLive(tieuDe);
  else {
    dienTap.dung();
    dichVu().nguoiDongVai.tat();
    dichVu().khachGia.tat();
    fbGia.ketThucLive();
  }
  res.json(dienTap.trangThai());
});

// Thử "Page có 2 live cùng lúc" (F-19).
r.post('/dien-tap/live-thu-hai', (req, res) => {
  const { fbGia, dienTap } = dichVu();
  fbGia.batDauLiveThuHai();
  res.json(dienTap.trangThai());
});

// Thử luồng bình luận trực tiếp bị hỏng (F-20): phòng live phải tự chuyển sang hỏi mỗi 3 giây.
r.post('/dien-tap/hong-luong', (req, res) => {
  const { bat } = req.body || {};
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  const { fbGia, dienTap } = dichVu();
  fbGia.datLuongHong(bat);
  res.json(dienTap.trangThai());
});

r.post('/dien-tap/binh-luan', (req, res) => {
  const { ten, noi_dung: noiDung } = req.body || {};
  res.status(201).json({ binh_luan: dichVu().fbGia.themBinhLuan({ ten, noi_dung: noiDung }) });
});

// F-94: người xem giả bình luận trên video xem lại của live giả đã kết thúc (bán sau live).
r.post('/dien-tap/binh-luan-xem-lai', (req, res) => {
  const { ten, noi_dung: noiDung, lui_gio: luiGio = 0 } = req.body || {};
  res.status(201).json({ binh_luan: dichVu().fbGia.themBinhLuanXemLai({ ten, noi_dung: noiDung, lui_gio: luiGio }) });
});

// F-107: Camera giả — "Người dẫn đang cầm: [món]" (null = không cầm gì). Chỉ có trong buổi tập (MOZA nhìn dùng khi phiên là buổi tập).
r.post('/dien-tap/camera', (req, res) => {
  const so = (req.body || {}).so;
  dichVu().nhinMon.cameraGia.so = so == null || so === '' ? null : Number(so);
  res.json({ dang_cam: dichVu().nhinMon.cameraGia.so });
});

// Hộp thư giả (M5): khách giả nhắn Page giả / bình luận bài đăng giả (#37: chọn Page giả).
r.post('/dien-tap/nhan-tin', (req, res) => {
  const { ten, noi_dung: noiDung, page_id: pageId, anh = null } = req.body || {};
  // F-63 / F-104: khách giả gửi kèm ảnh đã tải vào khu tạm (/api/anh-tam) — chỉ nhận tên tệp khu tạm có thật.
  if (anh && !require('../nghiep-vu/san-pham').duongAnh('tam', anh)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không có ảnh này trong khu tạm.');
  res.status(201).json({ su_kien: dichVu().fbGia.khachNhan({ ten, noi_dung: noiDung, page_id: pageId || undefined, anh: anh || null }) });
});

r.post('/dien-tap/binh-luan-bai', (req, res) => {
  const { ten, noi_dung: noiDung, page_id: pageId } = req.body || {};
  res.status(201).json({ su_kien: dichVu().fbGia.khachBinhLuanBai({ ten, noi_dung: noiDung, page_id: pageId || undefined }) });
});

// Người dùng bấm thay khách một nút trên thẻ đơn trong khung Messenger giả (#89).
r.post('/dien-tap/bam-nut', (req, res) => {
  const { page_id: pageId, psid, payload, tieu_de: tieuDe } = req.body || {};
  res.status(201).json({ su_kien: dichVu().fbGia.khachBam({ page_id: pageId || undefined, psid, payload, tieu_de: tieuDe }) });
});

r.get('/dien-tap/chat', (req, res) => {
  const { fbGia } = dichVu();
  const { TINH_HUONG } = require('../facebook/meta-gia');
  res.json({ pages: fbGia.pages, chat: fbGia.dsChat(), tra_loi: fbGia.traLoi.slice(-30), hong_gui: fbGia.hongGui,
    tinh_huong: { hien: fbGia.meta.tinhHuongTen, ds: Object.entries(TINH_HUONG).filter(([k]) => k !== 'de').map(([id, t]) => ({ id, ten: t.ten })) },
    hanh_vi: require('../facebook/hanh-vi-meta.json').hanh_vi.filter((x) => x.trang_thai === 'chua_kiem_chung' || x.trang_thai === 'mau_thuan').map((x) => ({ id: x.id, ten: x.ten, trang_thai: x.trang_thai })) });
});

// Tình huống Facebook của Phòng diễn tập (#92, docs/07 mục 4.2): Thận trọng · Xấu nhất · Page bị hạn chế · Ứng dụng chưa duyệt · Hỗn loạn nhẹ.
r.post('/dien-tap/tinh-huong', (req, res) => {
  const { fbGia } = dichVu();
  const kq = fbGia.datTinhHuong(String((req.body || {}).id || ''));
  // Page bị hạn chế: MOZA biết ngay như khi Page Integrity báo (F-73).
  require('../nghiep-vu/fb-page').datBiCam('page_gia', !!fbGia.meta.th.camNhan, fbGia.meta.th.camNhan ? 'Facebook giả: tình huống "Page bị hạn chế"' : null);
  phat('ket_noi.trang_thai', {});
  res.json(kq);
});

// Khách giả mở mục Tin nhắn chờ (H07) — thấy tin của shop từ lúc này.
r.post('/dien-tap/mo-tin-cho', (req, res) => {
  const { page_id: pageId, psid } = req.body || {};
  dichVu().fbGia.khachMoTinCho({ page_id: pageId || undefined, psid });
  res.json({ ok: true });
});

// Người dùng chạm thay khách một nút trả lời nhanh (H05).
r.post('/dien-tap/cham-nhanh', (req, res) => {
  const { page_id: pageId, psid, payload, tieu_de: tieuDe } = req.body || {};
  res.status(201).json({ su_kien: dichVu().fbGia.khachChamNhanh({ page_id: pageId || undefined, psid, payload, tieu_de: tieuDe }) });
});

// Khách giả vào từ link m.me?ref= (H19, F-70).
r.post('/dien-tap/vao-tu-link', (req, res) => {
  const { page_id: pageId, ten, ref, mat_ref: matRef } = req.body || {};
  res.status(201).json(dichVu().fbGia.khachVaoTuLink({ page_id: pageId || undefined, ten, ref, mat_ref: !!matRef }));
});

// Giả mất mạng giữa lúc gửi (F-25): tin gửi ra thành "không rõ", không tự gửi lại.
r.post('/dien-tap/hong-gui', (req, res) => {
  dichVu().fbGia.hongGui = !!(req.body || {}).bat;
  res.json({ hong_gui: dichVu().fbGia.hongGui });
});

r.get('/dien-tap/kich-ban', (req, res) => {
  res.json({ kich_ban: dichVu().dienTap.danhSach() });
});

r.post('/dien-tap/chay', (req, res) => {
  res.json(dichVu().dienTap.chay(String((req.body || {}).id || '')));
});

r.post('/dien-tap/dung', (req, res) => {
  res.json(dichVu().dienTap.dung());
});

// Người đóng vai (F-15): { bat, vai: [...], nhip: 'thua' | 'vua' | 'day' }
r.post('/dien-tap/nguoi-dong-vai', (req, res) => {
  const { bat, vai, nhip } = req.body || {};
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt Người đóng vai.');
  const { nguoiDongVai, dienTap } = dichVu();
  if (bat) nguoiDongVai.bat({ vai, nhip });
  else nguoiDongVai.tat();
  res.json(dienTap.trangThai());
});

/**
 * Tập nhanh một chạm (bản 2.5, F-15, F-39): người dùng không phải đi qua Kịch bản → Phiên live → Phòng diễn tập.
 *  - Đã có phiên diễn tập đang mở thì dùng luôn; phiên thật đang mở thì từ chối.
 *  - Chưa có: dùng kịch bản sửa gần nhất nếu có đủ mọi sản phẩm Đang bán; không thì AI soạn, lỗi thì tạo nhanh.
 *  - Bật live giả nếu chưa phát; phòng live gắn phiên vào live giả ngay (quét luôn, không chờ lượt 1 giây).
 * Chưa có sản phẩm Đang bán nào → lỗi SP_KHONG_BAN_DUOC kèm cách làm: Mai cần sản phẩm để có thông tin trả lời.
 */
r.post('/dien-tap/bat-dau-nhanh', async (req, res) => {
  const body = req.body || {};
  // "dan" = Mai dẫn chính (bản 2.7, #47): trang Phòng diễn tập đặt sẵn lựa chọn này. "doi" = Đội AI dẫn (bản 2.9, #49).
  const cheDo = ['goi_y', 'dan', 'doi'].includes(body.che_do_ai) ? body.che_do_ai : 'noi';
  const doi = cheDo === 'doi';
  const live = require('../nghiep-vu/live');
  const kichBan = require('../nghiep-vu/kich-ban');
  const sp = require('../nghiep-vu/san-pham');
  const doiAi = require('../nghiep-vu/doi-ai');
  const { fbGia, dienTap, phongLive, nguoiDongVai } = dichVu();
  let p = live.phienDangMo();
  let canhBao = null;
  if (p && !p.dien_tap) throw new LoiNghiepVu('PHIEN_DANG_MO', `Phiên live thật "${p.ten}" đang mở. Kết thúc phiên đó trước khi tập.`, 409);
  if (!p) {
    // Dùng lại kịch bản gần nhất nếu có đủ mọi sản phẩm Đang bán và đoạn nào cũng có lời nhắc; không thì AI soạn mới
    // (người dẫn biết nói gì, Mai biết phần của mình). AI lỗi thì vẫn tập được bằng kịch bản nhanh.
    // Đội AI dẫn cần kịch bản thoại của đội; các chế độ khác không lấy kịch bản đội.
    const dangBan = sp.mucLucDangBan().map((t) => t.id);
    // Người tập chọn sẵn một kịch bản đã lưu → dùng đúng kịch bản đó, không tự chọn, không nhờ AI soạn.
    const kbChon = body.kich_ban_id ? kichBan.layKichBan(String(body.kich_ban_id)) : null;
    if (kbChon && doi && !doiAi.laKichBanDoi(kbChon)) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `"${kbChon.ten}" không phải kịch bản Đội AI dẫn: chọn kịch bản của đội, hoặc chọn chế độ khác.`);
    }
    let kb = kbChon || kichBan.danhSachKichBan().find((k) => {
      const coSp = new Set(k.doan.filter((d) => d.san_pham).map((d) => d.san_pham.id));
      return dangBan.length && dangBan.every((id) => coSp.has(id)) && doiAi.laKichBanDoi(k) === doi
        && k.doan.every((d) => d.loi_nhac.trim() && (!d.san_pham || d.san_pham.trang_thai === 'dang_ban'));
    });
    if (!kb) {
      if (!dangBan.length) kichBan.taoNhanh(); // báo đúng lỗi "chưa có sản phẩm Đang bán"
      const { soanKichBan } = require('../agent/agents/soan-kich-ban');
      const kq = await soanKichBan({ kieu: doi ? 'doi' : 'mai' });
      if (kq.ok) kb = kq.kichBan;
      else if (doi) {
        // Không có thoại thì đội AI không có gì để đọc: báo lỗi thay vì tập với kịch bản trống.
        throw new LoiNghiepVu('AI_LOI', `AI chưa soạn được kịch bản Đội AI dẫn (${kq.loi?.thong_diep || 'lỗi'}). Bấm thử lại.`, 502);
      } else {
        canhBao = `AI chưa soạn được kịch bản (${kq.loi?.thong_diep || 'lỗi'}); đang dùng kịch bản nhanh, lời nhắc để trống.`;
        kb = kichBan.taoNhanh();
      }
    }
    p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: cheDo, dien_tap: true });
    dichVu().khachGia.xoa(); // buổi tập mới: khách giả mới
    phat('live.trang_thai', { phien_id: p.id });
  }
  if (!fbGia.trangThai().dang_phat) fbGia.batDauLive();
  // #87: khách giả trả lời tin nhắn riêng của Tư vấn viên (gửi thông tin giao, đổi size, hủy…) để buổi tập đi trọn.
  if (body.khach_gia !== false) dichVu().khachGia.bat();
  await phongLive.quet().catch(() => {});
  // Người xem giả bình luận cho buổi tập giống live thật (mặc định bật).
  if (body.nguoi_xem_gia !== false && !nguoiDongVai.trangThai().bat) {
    try { nguoiDongVai.bat({ vai: ['hoi_gia', 'hoi_size', 'chot_don', 'chot_sai', 'hoi_ship', 'nhan_page', 'gui_anh_mau'], nhip: 'vua' }); } catch { /* không bật được thì vẫn tập */ }
  }
  res.status(201).json({ phien: live.layPhien(p.id), dien_tap: dienTap.trangThai(), canh_bao: canhBao });
});

// Người dẫn giả nói có tiếng (bản 2.5, F-39): tiếng đi vào đường micro của MOZA, không ra Facebook.
// Trả ngay khi tiếng đã làm xong; phát vào micro chạy tiếp phía sau (xếp hàng sau đoạn đang nói).
r.post('/dien-tap/noi', async (req, res) => {
  const { chu, giong } = req.body || {};
  const { dienTap, tiengGia } = dichVu();
  res.status(201).json(await tiengGia.noi({ chu: dienTap.dienMau(String(chu ?? '')), giong: giong || undefined }));
});

r.post('/dien-tap/hoi-thoai', async (req, res) => {
  const { luot, giong } = req.body || {};
  const { dienTap, tiengGia } = dichVu();
  const ds = (Array.isArray(luot) ? luot : []).map((l) => ({ vai: l?.vai === 'khach' ? 'khach' : 'nguoi_dan', chu: dienTap.dienMau(String(l?.chu ?? '')) }));
  res.status(201).json(await tiengGia.hoiThoai({ luot: ds, giong: giong || {} }));
});

r.get('/dien-tap/tieng/:id', (req, res) => {
  const wav = dichVu().tiengGia.layTep(req.params.id);
  if (!wav) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Tệp tiếng này đã hết hạn.', 404);
  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'no-store');
  res.send(wav);
});

r.get('/dien-tap/giong', async (req, res) => {
  const { GIONG_NGUOI_DAN, GIONG_KHACH } = require('../tieng-gia');
  res.json({ giong: await dichVu().tiengGia.giongCoSan(), mac_dinh: { nguoi_dan: GIONG_NGUOI_DAN, khach: GIONG_KHACH } });
});

// Giả "người dẫn đang nói" để tập (M3 biết thật qua chép lời người dẫn): đang nói thì Director không giao Co-host.
r.post('/dien-tap/nguoi-dan-noi', (req, res) => {
  const { bat } = req.body || {};
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  const p = require('../nghiep-vu/live').phienDangMo();
  if (!p) throw new LoiNghiepVu('KHONG_CO_LIVE', 'Chưa có phiên live nào đang mở.', 409);
  dichVu().phongAi.datNguoiDanNoi(p.id, bat);
  res.json({ nguoi_dan_noi: bat });
});

/* ---------------- Bán hàng trọn quy trình trong buổi tập (#87, cách 1: dùng kho thật, kết thúc thì trả kho) ---------------- */

const dtBh = () => require('../nghiep-vu/dien-tap-ban-hang');
const baoDon = () => { phat('don.cap_nhat', {}); phat('kho.cap_nhat', {}); phat('hop_thu.cap_nhat', {}); };

r.get('/dien-tap/ban-hang', (req, res) => {
  res.json({ don: dtBh().tomTat(), khach_gia: dichVu().khachGia.trangThai() });
});

// Khách giả trả lời tin nhắn: { bat, che_do: 'soan_san' (0 đồng, mặc định) | 'ai' (tốn tiền) }
r.post('/dien-tap/khach-gia', (req, res) => {
  const { bat, che_do: cheDo } = req.body || {};
  const { khachGia } = dichVu();
  if (cheDo) khachGia.datCheDo(cheDo);
  if (typeof bat !== 'boolean' && !cheDo) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt Khách giả.');
  res.json(bat === undefined ? khachGia.trangThai() : bat ? khachGia.bat() : khachGia.tat());
});

// Tua nhanh thời gian cho dữ liệu diễn tập: { gio } → quá giờ giữ tự hủy, AI nhắc thông tin giao / báo đã gửi (F-32).
r.post('/dien-tap/tua', async (req, res) => {
  const kq = dtBh().tuaThoiGian((req.body || {}).gio);
  // Tua cả đồng hồ Meta giả (L15): 24 giờ, 7 ngày khớp hai phía.
  dichVu().fbGia.tua(Number((req.body || {}).gio));
  await dichVu().hopThu.nhacDon().catch(() => {});
  baoDon();
  res.json(kq);
});

// Giả đơn vị vận chuyển: đơn diễn tập Đã gửi → Đã giao (phần lớn) hoặc Hoàn.
r.post('/dien-tap/van-chuyen', (req, res) => {
  const kq = dtBh().vanChuyen();
  baoDon();
  res.json(kq);
});

// Kết thúc buổi tập: trả toàn bộ hàng của buổi tập về kho (hủy đơn đang giữ, cộng lại hàng đã trừ).
r.post('/dien-tap/tra-kho', (req, res) => {
  const kq = dtBh().traKho();
  dichVu().khachGia.xoa();
  baoDon();
  res.json(kq);
});

module.exports = r;
