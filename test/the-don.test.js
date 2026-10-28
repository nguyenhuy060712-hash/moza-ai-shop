'use strict';

// Thẻ đơn hàng có nút trong Messenger (SPEC.md #89, cách A): đơn đủ thông tin giao → MOZA tự gửi thẻ (món, ship, tổng tiền,
// người nhận) kèm "✅ Xác nhận đơn" / "✏️ Sửa đơn"; khách bấm Xác nhận → đơn Đã xác nhận ngay (bằng mã, không gọi AI) và chat hiện
// tin xác nhận + cảm ơn. Thẻ cũ (đơn đã đổi) không xác nhận nhầm. Mẫu tin Utility "đơn đã gửi" khi quá 24 giờ.
// Facebook giả, AI giả — không tốn tiền.

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const goiCC = (ten, thamSo) => ({ goiCongCu: [{ id: `g_${ten}_${Math.random()}`, ten, thamSo }], goc: {} });
const phieu = () => ({ chu: JSON.stringify({ xong: true, tom_tat: 'ok' }) });
const cho = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('thẻ đơn hàng — nghiệp vụ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const theDon = require('../server/nghiep-vu/the-don');
  const kh = require('../server/nghiep-vu/khach');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  caiDat.datBanHang({ ten_shop: 'Moza Shop', phi_ship: 30000 });
  const s = taoSanPhamMau({ so: 12 });
  const ev = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'p', psid: 'lan', mid: 'm1', noi_dung: 'lấy áo 12 đen M' });
  const h = ev.hoiThoai;
  const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'tin_nhan', hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id });

  await t.test('chưa đủ thông tin thì không gửi thẻ; đủ thì chữ thẻ có món, ship, tổng tiền, số che bớt, ≤ 640 ký tự', () => {
    assert.equal(theDon.nenGui(d).gui, false);
    const d2 = don.datThongTinGiao(d.id, { ten: 'Nguyễn Lan', sdt: '0912345678', diaChi: '12 Lý Thái Tổ, Bắc Ninh' }, { boi: 'ai' });
    assert.equal(theDon.nenGui(d2).gui, true);
    const chu = theDon.noiDung(d2);
    assert.ok(chu.length <= 640);
    assert.match(chu, /Đơn DH-0001 — Moza Shop/);
    assert.match(chu, /Số 12 Sơ mi linen tay ngắn · Đen\/M x1: 289\.000đ/);
    assert.match(chu, /Tổng tiền: 319\.000đ · thanh toán khi nhận hàng \(COD\)/);
    assert.match(chu, /0912\*\*\*678/);
    assert.doesNotMatch(chu, /0912345678/);
    const [xn, sua] = theDon.nut(d2);
    assert.equal(xn.tieu_de, theDon.NUT_XAC_NHAN);
    assert.ok(xn.tieu_de.length <= 20 && sua.tieu_de.length <= 20, 'tiêu đề nút ≤ 20 ký tự (giới hạn Messenger)');
    assert.deepEqual(theDon.docPayload(xn.payload), { loai: 'xac_nhan', donId: d.id, khoa: theDon.khoaPhienBan(d2) });
    assert.deepEqual(theDon.docPayload(sua.payload), { loai: 'sua', donId: d.id });
    theDon.daGuiThe(d2);
    assert.equal(theDon.nenGui(don.layDon(d.id)).gui, false, 'đã gửi thẻ phiên bản này');
  });

  await t.test('bấm Xác nhận trên thẻ cũ (đơn đã đổi) → không xác nhận; thẻ mới → Đã xác nhận, lịch sử ghi "khách tự báo"', () => {
    const cu = theDon.khoaPhienBan(don.layDon(d.id));
    don.themMon(d.id, s.pl('Trắng', 'L').id, 1);
    const kq = theDon.xacNhanBangNut(h, cu, ev.tinNhanId);
    assert.equal(kq.ket_qua, 'don_da_doi');
    assert.equal(don.layDon(d.id).trang_thai, 'cho_xac_nhan');
    assert.match(theDon.tinTraLoi(kq), /thẻ này đã cũ/);
    const moi = theDon.khoaPhienBan(don.layDon(d.id));
    const khac = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'p', psid: 'nguoi_khac', mid: 'm2', noi_dung: 'hi' });
    assert.equal(theDon.xacNhanBangNut(khac.hoiThoai, moi, khac.tinNhanId).ket_qua, 'khong_xac_nhan_duoc', 'người khác bấm không được');
    const ok = theDon.xacNhanBangNut(h, moi, ev.tinNhanId);
    assert.equal(ok.ket_qua, 'da_xac_nhan');
    assert.equal(don.layDon(d.id).trang_thai, 'da_xac_nhan');
    const ls = don.lichSu(d.id).at(-1);
    assert.deepEqual([ls.den, ls.nguon], ['da_xac_nhan', 'khach_tu_bao']);
    const tin = theDon.tinTraLoi(ok);
    assert.match(tin, /✅ Đơn DH-0001 đã được xác nhận/);
    assert.match(tin, /Cảm ơn mình đã ủng hộ Moza Shop/);
    assert.equal(theDon.xacNhanBangNut(h, moi, ev.tinNhanId).ket_qua, 'da_xac_nhan_truoc', 'bấm lần nữa');
  });

  await t.test('khách từng hoàn nhiều đơn: bấm Xác nhận → chưa xác nhận, có việc "Gọi xác nhận đơn"', () => {
    const k = kh.taoKhach({ ten: 'Hay Hoàn', sdt: '0901111222', taoBoi: 'nguoi' }).khach;
    for (let i = 0; i < 2; i++) {
      const z = don.taoDon({ mon: [{ phan_loai_id: s.pl('Trắng', 'M').id }], nguon: 'nguoi', khachId: k.id, tenNhan: 'H', sdtNhan: '+84901111222', diaChiNhan: 'X' });
      for (const tt of ['da_xac_nhan', 'da_gui', 'hoan']) don.doiTrangThai(z.id, tt);
    }
    const e2 = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'p', psid: 'hay_hoan', mid: 'm3', noi_dung: 'lấy' });
    const m = don.taoDon({ mon: [{ phan_loai_id: s.pl('Trắng', 'M').id }], nguon: 'tin_nhan', khachId: k.id, hoiThoaiId: e2.hoiThoai.id, nguoiFbId: e2.hoiThoai.nguoi_fb_id, tenNhan: 'H', sdtNhan: '+84901111222', diaChiNhan: 'X' });
    const kq = theDon.xacNhanBangNut(e2.hoiThoai, theDon.khoaPhienBan(m), e2.tinNhanId);
    assert.equal(kq.ket_qua, 'can_goi');
    assert.equal(don.layDon(m.id).trang_thai, 'cho_xac_nhan');
    assert.ok(kh.danhSachViec({ choAi: 'nguoi' }).some((v) => v.loai === 'goi_xac_nhan_don' && v.don_id === m.id));
  });
});

test('thẻ đơn hàng — trọn luồng trên Facebook giả: AI lên đơn → thẻ tự gửi → khách bấm → xác nhận + cảm ơn trong chat', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const don = require('../server/nghiep-vu/don');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const fbPage = require('../server/nghiep-vu/fb-page');
  const { FacebookGia } = require('../server/facebook/gia');
  const { HopThuTuDong } = require('../server/hop-thu');
  const { thucHienCongCu } = require('../server/agent/thuc-hien');
  caiDat.datBanHang({ ten_shop: 'Moza Shop', phi_ship: 30000 });
  const s = taoSanPhamMau({ so: 12 });
  const fb = new FacebookGia({ tinhHuong: 'de' });
  for (const p of fb.pages) fbPage.luu(p.id, p.ten);
  const yeuCau = [];
  let buoc = () => phieu();
  const goi = async (o) => { yeuCau.push(o); return { goiCongCu: [], chu: '', goc: null, tokenVao: 10, tokenRa: 5, ...(await buoc(o)) }; };
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi: () => fb, nhaCungCap: { gemini: { goi }, openai: { goi }, anthropic: { goi } }, gomMs: 20, chuKyMs: 3600000 });
  fb.on('su_kien', ht.ngheGia);
  t.after(() => ht.dung());
  const chat = () => fb.luongChat('page_gia', fb.psidCua('page_gia', 'Lan'));
  const congCu = (ten, thamSo, hoiThoaiId) => thucHienCongCu({ ten, thamSo, agent: caiDat.layAgent('tu_van'), nguCanh: { hoiThoaiId, layKetNoi: () => fb } });
  const capNhat = (hoiThoaiId, o) => congCu('cap_nhat_don', { viec: '', mon: '', mon_moi: '', ten: '', so_dien_thoai: '', dia_chi: '', thanh_toan: '', bang_chung_tin_nhan_id: '', ...o }, hoiThoaiId);

  // Khách nhắn Messenger; công cụ chạy trực tiếp như AI gọi.
  const e1 = fb.khachNhan({ ten: 'Lan', noi_dung: 'lấy cho mình áo 12 đen M nha' });
  await ht.choXong();
  const h = hopThu.danhSach({ dienTap: true }).find((x) => x.fb_thread_id === e1.psid);
  const t1 = hopThu.tinCuaHoiThoai(h.id).find((x) => x.gui_boi === 'khach');
  let kq = await capNhat(h.id, { viec: 'tao', mon: 'áo 12 đen M', bang_chung_tin_nhan_id: t1.id });
  assert.ok(!kq.loi, JSON.stringify(kq.loi));
  assert.equal(kq.ketQua.the_don, undefined, 'chưa đủ thông tin: chưa có thẻ');
  kq = await capNhat(h.id, { viec: 'thong_tin_giao', ten: 'Nguyễn Lan', so_dien_thoai: '0912 345 678', dia_chi: '12 Lý Thái Tổ, Bắc Ninh', thanh_toan: 'cod' });
  assert.ok(!kq.loi, JSON.stringify(kq.loi));
  assert.match(kq.ketQua.the_don, /vừa gửi khách thẻ đơn/, 'AI được báo đã có thẻ, không phải đọc lại bằng chữ');
  const the = chat().at(-1);
  assert.equal(the.tu, 'page');
  assert.equal(the.nut.length, 2);
  assert.match(the.noi_dung, /Tổng tiền: 319\.000đ/);
  // Gọi lại cập nhật không đổi món: không gửi trùng thẻ.
  await capNhat(h.id, { viec: 'thong_tin_giao', thanh_toan: 'cod' });
  assert.equal(chat().filter((x) => x.nut).length, 1, 'không gửi trùng thẻ cùng phiên bản');

  // Khách bấm "Xác nhận đơn" → xác nhận bằng mã, tin cảm ơn hiện ngay trong chat, không gọi AI.
  const soAi = yeuCau.length;
  fb.khachBam({ psid: e1.psid, payload: the.nut[0].payload, tieu_de: the.nut[0].tieu_de });
  await cho(50);
  await ht.choXong();
  const d = don.danhSach({ dienTap: true })[0];
  assert.equal(d.trang_thai, 'da_xac_nhan');
  const cuoi = chat().at(-1);
  assert.equal(cuoi.tu, 'page');
  assert.match(cuoi.noi_dung, /✅ Đơn DH-0001 đã được xác nhận/);
  assert.match(cuoi.noi_dung, /Cảm ơn/);
  assert.equal(yeuCau.length, soAi, 'bấm Xác nhận không tốn lượt AI');
  assert.equal(hopThu.layHoiThoai(h.id).trang_thai, 'xong');

  // Khách bấm "Sửa đơn" trên một đơn khác → Tư vấn viên được gọi với việc hỏi khách muốn sửa gì.
  const e2 = fb.khachNhan({ ten: 'Hoa', noi_dung: 'lấy áo 12 trắng L' });
  await ht.choXong();
  const h2 = hopThu.danhSach({ dienTap: true }).find((x) => x.fb_thread_id === e2.psid);
  const t2 = hopThu.tinCuaHoiThoai(h2.id).find((x) => x.gui_boi === 'khach');
  await capNhat(h2.id, { viec: 'tao', mon: 'áo 12 trắng L', bang_chung_tin_nhan_id: t2.id });
  await capNhat(h2.id, { viec: 'thong_tin_giao', ten: 'Trần Hoa', so_dien_thoai: '0987654321', dia_chi: 'Từ Sơn', thanh_toan: 'cod' });
  const the2 = fb.luongChat('page_gia', e2.psid).at(-1);
  let viec = '';
  buoc = (o) => { viec = o.lichSu[0].chu; return phieu(); };
  fb.khachBam({ psid: e2.psid, payload: the2.nut[1].payload, tieu_de: the2.nut[1].tieu_de });
  await cho(50);
  await ht.choXong();
  assert.match(viec, /bấm "Sửa đơn"/);
  assert.equal(don.danhSach({ dienTap: true }).find((x) => x.ma === 'DH-0002').trang_thai, 'cho_xac_nhan');
  buoc = () => phieu();
});

test('mẫu tin Utility "đơn đã gửi" khi đã quá 24 giờ (Facebook giả)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const don = require('../server/nghiep-vu/don');
  const { FacebookGia } = require('../server/facebook/gia');
  const { HopThuTuDong } = require('../server/hop-thu');
  const s = taoSanPhamMau({ so: 12 });
  const fb = new FacebookGia({ tinhHuong: 'de' });
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi: () => fb, nhaCungCap: {}, gomMs: 20, chuKyMs: 3600000 });
  t.after(() => ht.dung());
  const psid = fb.psidCua('page_gia', 'Mai');
  const cu = new Date(Date.now() - 30 * 3600e3).toISOString();
  const ev = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_gia', psid, mid: 'mx', noi_dung: 'ok', luc: cu }, { dienTap: true });
  const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'tin_nhan', hoiThoaiId: ev.hoiThoai.id, nguoiFbId: ev.hoiThoai.nguoi_fb_id, dienTap: true, tenNhan: 'Mai', sdtNhan: '+84912000333', diaChiNhan: 'Y' });
  don.doiTrangThai(d.id, 'da_xac_nhan');
  don.guiNhieu([{ id: d.id, ma_van_don: 'GHN777' }]);
  await ht.nhacDon();
  const tin = fb.luongChat('page_gia', psid).at(-1);
  assert.equal(tin.utility, 'moza_don_da_gui');
  assert.match(tin.noi_dung, /Chào Mai, đơn DH-0001 .* mã vận đơn GHN777/);
  assert.ok(hopThu.tinCuaHoiThoai(ev.hoiThoai.id).some((x) => /Mẫu tin "Đơn đã gửi"/.test(x.noi_dung)), 'Hộp thư ghi lại tin đã gửi');
});

test('Facebook thật: thẻ có nút (button template), mẫu tin Utility, tạo mẫu — đúng dạng gửi lên Graph API', async () => {
  const { FacebookPage } = require('../server/facebook/that');
  const { taoGraph } = require('../server/facebook/graph');
  const { NhipGoi } = require('../server/facebook/nhip-goi');
  const goi = [];
  const f = async (url, init = {}) => {
    goi.push({ url: new URL(String(url)), body: JSON.parse(init.body) });
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ message_id: 'mid.1', id: 'mau.1', status: 'PENDING' }) };
  };
  const graph = taoGraph({ layMa: () => '', nhip: new NhipGoi(), fetch: f });
  const p = new FacebookPage({ graph, pageId: 'P1', layMa: () => 'MA', fetch: f });
  await p.guiThe('psid1', 'Đơn DH-0001…', [{ tieu_de: '✅ Xác nhận đơn', payload: 'XAC_NHAN_DON|x|1|t' }, { tieu_de: '✏️ Sửa đơn', payload: 'SUA_DON|x' }]);
  assert.equal(goi[0].url.pathname, '/v26.0/P1/messages');
  const tt = goi[0].body.message.attachment.payload;
  assert.deepEqual([goi[0].body.messaging_type, tt.template_type, tt.buttons.length, tt.buttons[0].type, tt.buttons[0].payload], ['RESPONSE', 'button', 2, 'postback', 'XAC_NHAN_DON|x|1|t']);
  await p.guiUtility('psid1', 'moza_don_da_gui', ['Lan', 'DH-0001', 'Moza Shop', 'GHN1'], 'vi');
  assert.equal(goi[1].body.messaging_type, 'UTILITY');
  assert.deepEqual(goi[1].body.message.template.components[0].parameters.map((x) => x.text), ['Lan', 'DH-0001', 'Moza Shop', 'GHN1']);
  const kq = await p.taoMauUtility('moza_don_da_gui', 'Chào {{1}}, đơn {{2}}…', 'vi');
  assert.equal(goi[2].url.pathname, '/v26.0/P1/message_templates');
  assert.equal(goi[2].body.category, 'UTILITY');
  assert.equal(kq.trang_thai, 'PENDING');
});
