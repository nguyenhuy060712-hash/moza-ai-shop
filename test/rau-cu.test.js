'use strict';

/**
 * Rau củ bán theo kg: danh mục "Rau lá" / "Củ quả" (don_vi kg trong danh-muc.json). Giá hiện "25.000đ/kg", mỗi món một gói "1 kg",
 * khách chốt "chốt 50" (1 kg) hoặc "chốt 50 2kg" / "2 cân" / "2 ký"; cú pháp chốt "chốt 50 + số kg"; quần áo giữ nguyên.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau, ANH_GIA } = require('./ho-tro');

function taoRau(so, ten, gia, danhMuc = 'rau_la') {
  const sp = require('../server/nghiep-vu/san-pham');
  return sp.taoSanPham({
    so, ten, danh_muc: danhMuc, trang_thai: 'dang_ban', gia, nhom: { t1: 'Khối lượng', t2: null },
    phan_loai: [{ gt1: '1 kg', ton: 20 }], anh: [{ tep: sp.luuAnhTam(ANH_GIA), mau: null }],
    thong_so: { xuat_xu: 'Đà Lạt', cach_trong: 'an_toan' }, diem_noi_bat: ['Hái sáng nay'],
  });
}

test('rau củ: giá theo kg trên thẻ AI và màn hình, cú pháp chốt; quần áo không đổi', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const ao = taoSanPhamMau();
  const r = taoRau(50, 'Cải ngọt', '30k');
  const s = sp.laySanPham(r.san_pham.id);
  assert.equal(sp.donVi(s), 'kg');
  assert.equal(sp.hienGia(s), '30.000đ/kg');
  assert.equal(sp.tenGoi(s), 'rau số 50');
  assert.equal(sp.cuPhapChot(s), 'chốt 50 + số kg');
  const the = sp.theChoAi(s);
  assert.match(the, /Giá: 30\.000đ\/kg/);
  assert.match(the, /Phân loại: Khối lượng \(1 kg\)/);
  assert.match(the, /Cách trồng: Rau an toàn/);
  assert.doesNotMatch(the, /Bảng size/);
  assert.deepEqual(sp.doDayDu(s).thieu, [], 'rau không cần bảng size');
  // Quần áo giữ nguyên.
  const sAo = sp.laySanPham(ao.san_pham.id);
  assert.equal(sp.hienGia(sAo), '289.000đ');
  assert.equal(sp.cuPhapChot(sAo), 'chốt 12 + màu + size');
  const mh = require('../server/man-hinh-san-pham').dung({ mau: 'gioi_thieu', so: 50 });
  assert.equal(mh.san_pham.gia, '30.000đ/kg');
  assert.equal(mh.san_pham.cu_phap, 'chốt 50 + số kg');
  const k = require('../server/agent/kiem-tra/kiem-so-noi').kiemSoNoi('rau số 50 giá 30 nghìn một ký thôi cả nhà', { phienId: null });
  assert.deepEqual(k, [], 'Mai nói đúng giá theo kg: không báo sai');
});

test('đọc bình luận chốt rau: "chốt 50" = 1 kg, "2kg" / "3 cân" / "2 ký" = số kg, nhiều món; không lẫn với số sản phẩm', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  taoSanPhamMau();
  taoRau(50, 'Cải ngọt', '30k');
  taoRau(2, 'Su su', '25k', 'cu_qua');
  const ds = sp.danhSach({}).map((x) => sp.laySanPham(x.id)).map((s) => ({ ...s, phan_loai: sp.phanLoaiCua(s.id) }));
  const { docChot } = require('../server/nhan-chot');
  const mot = (c) => { const r = docChot(c, { dsSanPham: ds }); return r.mon.map((m) => [m.so, m.phan_loai?.gt1 || null, m.so_luong]); };
  assert.deepEqual(mot('chốt 50'), [[50, '1 kg', 1]]);
  assert.deepEqual(mot('chốt 50 2kg'), [[50, '1 kg', 2]]);
  assert.deepEqual(mot('chot 50 3 can'), [[50, '1 kg', 3]]);
  assert.deepEqual(mot('c50 2 ký'), [[50, '1 kg', 2]]);
  assert.deepEqual(mot('chốt 50 1kg'), [[50, '1 kg', 1]]);
  assert.deepEqual(mot('chốt 50 2kg, 2 1kg'), [[50, '1 kg', 2], [2, '1 kg', 1]], 'su su số 2: "2" là số món, không phải số lượng');
  assert.deepEqual(mot('chốt 2 3kg'), [[2, '1 kg', 3]]);
  assert.deepEqual(mot('chốt 12 đen M x2'), [[12, 'Đen', 2]], 'quần áo như cũ');
});

test('câu ghim buổi rau: "Chốt: số món + số cân"; buổi quần áo giữ "số + màu + size"', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const ao = taoSanPhamMau();
  const r = taoRau(50, 'Cải ngọt', '30k');
  const live = require('../server/nghiep-vu/live');
  const kb = require('../server/nghiep-vu/kich-ban').taoKichBan({ ten: 'Live rau', doan: [{ san_pham_id: r.san_pham.id, loi_nhac: 'Rau số 50' }] });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  const { cauGhim } = require('../server/san-sang');
  assert.match(cauGhim(live.layPhien(p.id)), /^Chốt: số món \+ số cân, ví dụ chốt 50/);
  assert.equal(sp.cachChotChung([sp.laySanPham(ao.san_pham.id)]), 'số + màu + size');
  assert.equal(sp.cachChotChung([sp.laySanPham(ao.san_pham.id), sp.laySanPham(r.san_pham.id)]), 'số + màu + size (rau củ: số món + số cân)');
});

test('khách xin xem rau: "cho chị xem gần" → thẻ "muốn xem gần", nút chiếu ảnh món; Mai dẫn chính được báo đúng món', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { csdl } = require('../server/db/ket-noi');
  const { TheNhac } = require('../server/the-nhac');
  const r = taoRau(50, 'Cải ngọt', '30k');
  const kb = require('../server/nghiep-vu/kich-ban').taoKichBan({ ten: 'Live rau', doan: [{ san_pham_id: r.san_pham.id, loi_nhac: 'Rau số 50' }] });
  const p0 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'noi', dien_tap: true });
  csdl().prepare('UPDATE phien_live SET mai_dan = 1 WHERE id = ?').run(p0.id);
  const p = live.layPhien(p0.id);
  const bao = [];
  const chieu = [];
  const tn = new TheNhac({ phat: () => {}, gomMs: 60000, tatMs: 60000,
    phongAi: { miengSanSang: () => true, mieng: { baoYeuCau: (c) => bao.push(c) } },
    layManHinh: () => ({ chieu: (lenh) => chieu.push(lenh) }) });
  t.after(() => tn.datLai(null));
  const bl = live.themBinhLuan(p.id, { fb_id: 'c1', nguoi_fb_id: 'u1', ten: 'Nguyễn Thị Lan', noi_dung: 'cho chị xem gần cải ngọt với', luc_fb: new Date().toISOString() });
  const the = tn.nhan({ ...bl, so_doan: 50 }, p);
  assert.equal(the.chu, 'Lan muốn xem gần (số 50)');
  assert.deepEqual(the.nut, [{ chu: 'Chiếu ảnh món', lenh: { mau: 'gioi_thieu', so: 50 } }]);
  assert.deepEqual(bao, ['Lan muốn xem gần món số 50']);
  assert.deepEqual(chieu, [{ mau: 'gioi_thieu', so: 50 }]);
  // Câu dễ nhầm: "mấy giờ lên live" không phải xin xem.
  assert.equal(require('../server/nghiep-vu/tu-khoa').loaiMuonXem('mai mấy giờ lên live vậy shop'), null);
});
