'use strict';

// Diễn tập chạy trọn quy trình bán hàng (SPEC.md #87, cách 1): khách giả trả lời tin nhắn theo tính cách, người xem giả nhắn
// Page / gửi ảnh, tua thời gian (quá giờ giữ tự hủy, nhắc thông tin giao), giả lập vận chuyển, báo cáo buổi tập, và kết thúc
// buổi tập thì trả toàn bộ hàng về kho — kho thật về đúng như trước, lịch sử kho vẫn khớp. AI giả, Facebook giả.

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');

function nhaGia(kichBan) {
  let i = 0;
  // tiep: câu trả lời dùng một lần cho lượt kế (ưu tiên hơn kịch bản).
  const kq = { yeuCau: [], tiep: null };
  const goi = async (o) => {
    kq.yeuCau.push(o);
    let b = kq.tiep;
    if (b) kq.tiep = null;
    else { b = kichBan[Math.min(i, kichBan.length - 1)]; i += 1; }
    const r = typeof b === 'function' ? await b(o) : b;
    return { goiCongCu: [], chu: '', goc: null, tokenVao: 100, tokenRa: 20, ...r };
  };
  kq.nha = { openai: { goi }, gemini: { goi }, anthropic: { goi } };
  return kq;
}
const phieu = (o) => ({ chu: JSON.stringify(o) });
const cho = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('diễn tập bán hàng — nghiệp vụ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  const dt = require('../server/nghiep-vu/dien-tap-ban-hang');
  const bc = require('../server/nghiep-vu/bao-cao');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const s = taoSanPhamMau({ so: 12, ton: 10 });
  const ton = (gt1, gt2) => kho.conHang(s.san_pham.id).find((p) => p.gt1 === gt1 && p.gt2 === gt2);
  const tonDau = kho.conHang(s.san_pham.id).map((p) => [p.sku, p.ton]);
  const giao = { tenNhan: 'Lan', sdtNhan: '+84912345678', diaChiNhan: 'Bắc Ninh' };

  await t.test('tua 2 giờ: đơn sắp hết giờ giữ vào danh sách nhắc; tua 24 giờ: quá giờ giữ tự hủy, hàng về kho', () => {
    const ev = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_gia_1', psid: 'psid_a', mid: 'm1', noi_dung: 'chốt' }, { dienTap: true });
    const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'tin_nhan', dienTap: true, hoiThoaiId: ev.hoiThoai.id });
    const that = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'nguoi' }); // đơn thật: tua không đụng tới
    assert.equal(ton('Đen', 'M').con_ban_duoc, 8);
    const kq = dt.tuaThoiGian(23);
    assert.deepEqual(kq.huy_qua_gio, []);
    assert.ok(don.canNhanChuDong().nhac.some((x) => x.id === d.id), 'còn ≤ 2 giờ giữ → cần nhắc');
    const h = hopThu.layHoiThoai(ev.hoiThoai.id);
    assert.ok(Date.now() - new Date(h.tin_khach_cuoi_luc).getTime() > 22 * 3600e3, 'tin khách cũng lùi theo');
    const kq2 = dt.tuaThoiGian(2);
    assert.deepEqual(kq2.huy_qua_gio, [d.ma]);
    assert.equal(don.layDon(d.id).trang_thai, 'da_huy');
    assert.equal(don.layDon(that.id).trang_thai, 'cho_xac_nhan', 'đơn thật không bị tua');
    assert.equal(ton('Đen', 'M').con_ban_duoc, 9);
    assert.throws(() => dt.tuaThoiGian(0));
    assert.throws(() => dt.tuaThoiGian(169), /168/, 'BH8: tối đa 168 giờ');
    don.doiTrangThai(that.id, 'da_huy');
  });

  await t.test('gửi → giả lập vận chuyển → nhận hàng hoàn; báo cáo buổi tập chỉ tính dữ liệu tập', () => {
    const ds = [0, 1, 2, 3].map(() => {
      const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Trắng', 'L').id, so_luong: 1 }], nguon: 'binh_luan_live', dienTap: true, ...giao });
      don.doiTrangThai(d.id, 'da_xac_nhan');
      return d;
    });
    don.guiNhieu(ds.map((d) => ({ id: d.id, ma_van_don: dt.maVanDonGia(d) })));
    assert.equal(ton('Trắng', 'L').ton, 6, 'Đã gửi trừ tồn thật');
    let k = 0;
    const kq = dt.vanChuyen({ ngau: () => [0.9, 0.05, 0.9, 0.9][k++] });
    assert.equal(kq.giao.length, 3);
    assert.equal(kq.hoan.length, 1);
    const dHoan = don.layDon(kq.hoan[0]);
    don.nhanHoan(dHoan.id);
    assert.equal(ton('Trắng', 'L').ton, 7, 'nhận hàng hoàn cộng lại');
    const tap = bc.baoCao({ dienTap: true });
    assert.equal(tap.dien_tap, true);
    assert.equal(tap.tong.da_giao, 3);
    assert.equal(tap.tong.hoan, 1);
    assert.equal(bc.baoCao({}).tong.da_giao, 0, 'báo cáo thật không tính diễn tập');
  });

  await t.test('kết thúc buổi tập: trả toàn bộ hàng về kho, kho về đúng như trước; chạy lại không trả thêm; đơn khóa', () => {
    const giu = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'L').id, so_luong: 2 }], nguon: 'binh_luan_live', dienTap: true });
    const xn = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'binh_luan_live', dienTap: true, ...giao });
    don.doiTrangThai(xn.id, 'da_xac_nhan');
    const gui = don.taoDon({ mon: [{ phan_loai_id: s.pl('Trắng', 'M').id, so_luong: 3 }], nguon: 'tin_nhan', dienTap: true, ...giao });
    don.doiTrangThai(gui.id, 'da_xac_nhan');
    don.doiTrangThai(gui.id, 'da_gui');
    const hoanChuaNhan = don.taoDon({ mon: [{ phan_loai_id: s.pl('Trắng', 'M').id }], nguon: 'tin_nhan', dienTap: true, ...giao });
    don.doiTrangThai(hoanChuaNhan.id, 'da_xac_nhan'); don.doiTrangThai(hoanChuaNhan.id, 'da_gui'); don.doiTrangThai(hoanChuaNhan.id, 'hoan');
    const that = don.taoDon({ mon: [{ phan_loai_id: s.pl('Trắng', 'M').id }], nguon: 'nguoi', ...giao }); // đơn thật giữ nguyên
    const kq = dt.traKho();
    assert.equal(kq.huy, 2, 'đơn đang giữ và đã xác nhận bị hủy');
    assert.ok(kq.tra_chiec >= 3 + 1);
    assert.deepEqual(kho.conHang(s.san_pham.id).map((p) => [p.sku, p.ton]), tonDau, 'tồn về đúng như trước buổi tập');
    assert.equal(ton('Trắng', 'M').con_ban_duoc, 9, 'chỉ còn đơn thật đang giữ 1');
    assert.deepEqual(kho.doiChieu(), [], 'lịch sử kho khớp');
    assert.equal(dt.traKho().don, 0, 'chạy lại không trả thêm');
    assert.throws(() => don.doiTrangThai(gui.id, 'da_giao'), (e) => e.ma === 'DA_TRA_KHO');
    assert.throws(() => don.nhanHoan(hoanChuaNhan.id), (e) => e.ma === 'DA_TRA_KHO');
    assert.equal(don.layDon(that.id).trang_thai, 'cho_xac_nhan');
    assert.deepEqual(dt.tomTat(), {});
    assert.match(kho.lichSu({ sanPhamId: s.san_pham.id })[0].ghi_chu, /Trả kho sau buổi tập/);
  });
});

test('khách giả trả lời tin nhắn của shop theo tính cách', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  taoSanPhamMau({ so: 12 });
  const { FacebookGia } = require('../server/facebook/gia');
  const { KhachGia } = require('../server/khach-gia');
  const { danhTinh, chonTinhCach, TINH_CACH } = require('../server/agent/agents/khach-gia');
  const fb = new FacebookGia({ tinhHuong: 'de' });
  const ai = nhaGia([phieu({ tra_loi: 'Nguyễn Lan, 0912345678, 12 Lý Thái Tổ Bắc Ninh', bam_nut: '', ket_thuc: false }), phieu({ tra_loi: 'ok shop, cảm ơn', bam_nut: '', ket_thuc: true })]);
  const kg = new KhachGia({ fbGia: fb, nhaCungCap: ai.nha, cho: [5, 10], cheDo: 'ai' });
  const suKien = [];
  fb.on('su_kien', (ev) => suKien.push(ev));
  const pageId = fb.pages[0].id;
  const psid = fb.psidCua(pageId, 'Lan');
  fb.tenNguoi.set(psid, 'Lan');

  await t.test('danh tính bịa cố định theo người; tính cách chọn theo tỷ trọng', () => {
    assert.deepEqual(danhTinh('Lan', psid), danhTinh('Lan', psid));
    assert.match(danhTinh('Lan', psid).sdt, /^0\d{9}$/);
    assert.match(danhTinh('Lan', psid).ten_day_du, /^\S+ Lan$/);
    assert.equal(chonTinhCach(() => 0).id, 'de_tinh');
    assert.equal(chonTinhCach(() => 0.9999).id, TINH_CACH.at(-1).id);
  });

  await t.test('đang tắt thì không trả lời', async () => {
    await fb.guiTinNhan({ page_id: pageId, psid, noi_dung: 'Chào chị' });
    await cho(40);
    assert.equal(suKien.length, 0);
  });

  await t.test('bật: shop nhắn → khách giả trả lời bằng tin Messenger giả (vào Hộp thư như khách thật); kết thúc thì thôi', async () => {
    kg.bat();
    kg.layKhach(pageId, psid).tinhCach = TINH_CACH[0];
    await fb.guiTinNhan({ page_id: pageId, psid, noi_dung: 'Em đã giữ áo 12 đen M cho chị, chị cho em xin tên, số, địa chỉ nha' });
    await cho(60);
    assert.equal(suKien.length, 1);
    assert.equal(suKien[0].loai, 'tin_nhan');
    assert.equal(suKien[0].psid, psid, 'cùng người, cùng hội thoại');
    assert.match(suKien[0].noi_dung, /0912345678/);
    const hoi = JSON.stringify(ai.yeuCau[0].lichSu);
    assert.match(hoi, /Shop: Em đã giữ áo 12/);
    assert.match(hoi, /Số 12/, 'khách giả biết sản phẩm shop đang bán');
    await fb.guiTinNhan({ page_id: pageId, psid, noi_dung: 'Em đọc lại đơn: áo 12 đen M, tổng 299.000đ, chị đồng ý nha' });
    await cho(60);
    assert.equal(suKien.length, 2);
    assert.equal(kg.trangThai().khach[0].xong, true);
    await fb.guiTinNhan({ page_id: pageId, psid, noi_dung: 'Cảm ơn chị' });
    await cho(40);
    assert.equal(suKien.length, 2, 'đã xong thì không nhắn nữa');
  });

  await t.test('shop gửi thẻ đơn có nút → khách giả bấm nút (postback như Facebook thật)', async () => {
    const psid4 = fb.psidCua(pageId, 'Nga');
    fb.tenNguoi.set(psid4, 'Nga');
    kg.layKhach(pageId, psid4).tinhCach = TINH_CACH[0];
    ai.tiep = phieu({ tra_loi: '', bam_nut: '✅ Xác nhận đơn', ket_thuc: false });
    await fb.guiThe({ page_id: pageId, psid: psid4, noi_dung: 'Đơn DH-0009, tổng 289.000đ', nut: [{ tieu_de: '✅ Xác nhận đơn', payload: 'XAC_NHAN_DON|dh_x|289000|t' }, { tieu_de: '✏️ Sửa đơn', payload: 'SUA_DON|dh_x' }] });
    await cho(60);
    const pb = suKien.find((e) => e.psid === psid4);
    assert.equal(pb?.loai, 'postback');
    assert.equal(pb.payload, 'XAC_NHAN_DON|dh_x|289000|t');
    assert.match(JSON.stringify(ai.yeuCau.at(-1).lichSu), /thẻ có nút: ✅ Xác nhận đơn/);
  });

  await t.test('tính cách "Im lặng" không bao giờ trả lời; tắt thì hủy hẹn', async () => {
    const psid2 = fb.psidCua(pageId, 'Hoa');
    fb.tenNguoi.set(psid2, 'Hoa');
    kg.layKhach(pageId, psid2).tinhCach = TINH_CACH.find((x) => x.id === 'im_lang');
    await fb.guiTinNhan({ page_id: pageId, psid: psid2, noi_dung: 'Chị ơi cho em xin địa chỉ' });
    await cho(40);
    assert.equal(suKien.filter((e) => e.psid === psid2).length, 0);
    const psid3 = fb.psidCua(pageId, 'Mai');
    fb.tenNguoi.set(psid3, 'Mai');
    kg.layKhach(pageId, psid3).tinhCach = TINH_CACH[0];
    await fb.guiTinNhan({ page_id: pageId, psid: psid3, noi_dung: 'Chào chị' });
    kg.tat();
    await cho(40);
    assert.equal(suKien.filter((e) => e.psid === psid3).length, 0);
  });
});

test('người xem giả nhắn Page và gửi ảnh mẫu (Luồng 4) → khách giả nhận là "tự nhắn hỏi mua"', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  taoSanPhamMau({ so: 12 });
  const { FacebookGia } = require('../server/facebook/gia');
  const { KhachGia } = require('../server/khach-gia');
  const { NguoiDongVai } = require('../server/agent/agents/nguoi-dong-vai');
  const fb = new FacebookGia({ tinhHuong: 'de' });
  fb.batDauLive();
  const kg = new KhachGia({ fbGia: fb, nhaCungCap: nhaGia([phieu({ tra_loi: '', bam_nut: '', ket_thuc: false })]).nha, cho: [5, 10], cheDo: 'ai' });
  const ai = nhaGia([phieu({ binh_luan: [
    { vai: 'nhan_page', ten: 'Trần Thu Hà', noi_dung: 'shop ơi áo 12 màu đen còn size M không ạ' },
    { vai: 'gui_anh_mau', ten: 'Lê Minh Anh', noi_dung: 'shop có mẫu này không ạ' },
  ] })]);
  const ndv = new NguoiDongVai({ fbGia: fb, phat: () => {}, nhaCungCap: ai.nha, chuKyMs: 60, khachGia: kg });
  const suKien = [];
  fb.on('su_kien', (ev) => suKien.push(ev));
  ndv.bat({ vai: ['nhan_page', 'gui_anh_mau'], nhip: 'thua' });
  await cho(200);
  ndv.tat();
  const tin = suKien.filter((e) => e.loai === 'tin_nhan');
  assert.ok(tin.some((e) => /áo 12 màu đen/.test(e.noi_dung) && !e.anh_url));
  const coAnh = tin.find((e) => e.anh_url);
  assert.ok(coAnh, 'có tin kèm ảnh');
  assert.match(coAnh.anh_url, /^tam:/);
  assert.ok(kg.trangThai().khach.every((k) => k.tinh_cach === 'Tự nhắn hỏi mua'));
  assert.equal(kg.trangThai().khach.length, 2);
});

test('API diễn tập bán hàng: tua, vận chuyển, trả kho, báo cáo buổi tập, mã vận đơn giả', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const { goi } = pm;
  const s = taoSanPhamMau({ so: 12 });
  const don = require('../server/nghiep-vu/don');
  const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id, so_luong: 2 }], nguon: 'binh_luan_live', dienTap: true, tenNhan: 'A', sdtNhan: '+84912000111', diaChiNhan: 'X' });
  don.doiTrangThai(d.id, 'da_xac_nhan');
  let r = await goi('POST', '/api/don/gui', { ds: [{ id: d.id }] });
  assert.equal(r.than.ok, 1);
  assert.match(don.layDon(d.id).ma_van_don, /^TAP/, 'đơn diễn tập gửi không gõ mã → mã giả');
  r = await goi('GET', '/api/dien-tap/ban-hang');
  assert.deepEqual(r.than.don, { da_gui: 1 });
  r = await goi('POST', '/api/dien-tap/van-chuyen');
  assert.equal(r.than.giao.length + r.than.hoan.length, 1);
  r = await goi('GET', '/api/bao-cao/ban-hang?dien_tap=1');
  assert.equal(r.than.dien_tap, true);
  assert.equal(r.than.tong.don, 1);
  r = await goi('POST', '/api/dien-tap/tua', { gio: 24 });
  assert.equal(r.ma, 200, r.chu);
  r = await goi('POST', '/api/dien-tap/tra-kho');
  assert.equal(r.than.don, 1);
  assert.equal(r.than.tra_chiec, 2);
  r = await goi('POST', '/api/dien-tap/khach-gia', { bat: true });
  assert.equal(r.than.bat, true);
  r = await goi('POST', '/api/dien-tap/khach-gia', {});
  assert.equal(r.ma, 400);
});

test('Tư vấn viên thấy đoạn trao đổi trước với cùng người ở hội thoại khác (bình luận → nhắn riêng → Messenger)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const bl = hopThu.nhanSuKien({ loai: 'binh_luan_bai', page_id: 'page_1', comment_id: 'c1', post_id: 'page_1_p', nguoi_id: 'u1', ten: 'Lan', noi_dung: 'chốt 12 kem M' });
  hopThu.ghiTinRa({ hoiThoaiId: bl.hoiThoai.id, guiBoi: 'ai', loai: 'nhan_rieng', noiDung: 'Áo số 12 không có màu kem, chị lấy màu be nha?', khoa: 'nr1' });
  hopThu.ganPsid(bl.hoiThoai.nguoi_fb_id, 'psid_lan');
  const ms = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid: 'psid_lan', mid: 'm1', noi_dung: 'ừ be M nha' });
  assert.notEqual(ms.hoiThoai.id, bl.hoiThoai.id, 'hai hội thoại khác nhau');
  assert.equal(ms.hoiThoai.nguoi_fb_id, bl.hoiThoai.nguoi_fb_id, 'cùng một người');
  const tin = hopThu.tinCuaNguoiNoiKhac(ms.hoiThoai.id);
  assert.deepEqual(tin.map((x) => [x.gui_boi, x.noi_dung]), [['khach', 'chốt 12 kem M'], ['ai', 'Áo số 12 không có màu kem, chị lấy màu be nha?']]);
  assert.deepEqual(hopThu.tinCuaNguoiNoiKhac(bl.hoiThoai.id).map((x) => x.noi_dung), ['ừ be M nha']);
});

test('Tư vấn viên: hội thoại diễn tập chạy gpt-6-luna, hội thoại thật chạy model trong Cài đặt (#88)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const tuVan = require('../server/agent/agents/tu-van');
  const model = [];
  const goi = async (o) => { model.push(o.model); return { goiCongCu: [], chu: JSON.stringify({ tom_tat: 'x', can_nguoi: false, ly_do: '' }), goc: null, tokenVao: 10, tokenRa: 5 }; };
  const nhaCungCap = { gemini: { goi }, openai: { goi }, anthropic: { goi } };
  const tap = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid: 'p_tap', mid: 'm_tap', noi_dung: 'áo 12 còn không' }, { dienTap: true });
  const that = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid: 'p_that', mid: 'm_that', noi_dung: 'áo 12 còn không' });
  await tuVan.xuLyHoiThoai(tap.hoiThoai.id, { kichHoat: 'thử', layKetNoi: () => null, nhaCungCap });
  assert.equal(model[0], 'gpt-6-luna');
  model.length = 0;
  await tuVan.xuLyHoiThoai(that.hoiThoai.id, { kichHoat: 'thử', layKetNoi: () => null, nhaCungCap });
  assert.equal(model[0], 'gemini-3.8-flash');
});
