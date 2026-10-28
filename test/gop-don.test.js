'use strict';

/**
 * Miễn ship, món phối, gộp / tách đơn giữa hai buổi; đơn Đã xác nhận bị sửa món → về Chờ xác nhận (SPEC.md F-90, #113). Facebook giả, AI giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

async function dung(t, { cheDo = 'goi_y' } = {}) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { csdl } = require('../server/db/ket-noi');
  const { FacebookGia } = require('../server/facebook/gia');
  const { PhongLive } = require('../server/phong-live');
  const { ChotDon } = require('../server/chot-don');
  const { HopThuTuDong } = require('../server/hop-thu');
  const fb = new FacebookGia({ tinhHuong: 'than_trong' });
  let goiAi = 0;
  const nha = { async goi() { goiAi += 1; return { goiCongCu: [], chu: '{"xong":true,"tom_tat":""}', goc: null, tokenVao: 1, tokenRa: 1 }; } };
  const nhaCungCap = { gemini: nha, openai: nha, anthropic: nha };
  const layKetNoi = () => fb;
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi, nhaCungCap, gomMs: 10, chuKyMs: 3600000, phat });
  const chen = [];
  const noi = [];
  const phongAi = {
    doiAi: { chenBanHang: (phienId, khoa, bien) => { chen.push({ khoa, ...bien }); return true; } },
    miengSanSang: () => true,
    mieng: { nhacMoTin: (ten) => noi.push({ loai: 'mo_tin', ten }), nhacCachChot: (vd) => noi.push({ loai: 'cach_chot', vd }), capNhatTon() {}, baoVuaChot() {} },
    bao() {},
  };
  const chot = new ChotDon({ phat, layKetNoi, nhaCungCap, gomMs: 0, nhacMoTinMs: 0, phongAi });
  const director = [];
  const phong = new PhongLive({ layKetNoi, phat, ai: { nhanBinhLuan: (bl) => director.push(bl), ketThuc() {} } });
  phong.chotDon = chot;
  ht.batDau();
  t.after(() => { ht.dung(); chot.dung(); phong.dongLuong(); });
  require('../server/nghiep-vu/cai-dat').datBanHang({ sdt_shop: '0987 654 321' });
  const mau = taoSanPhamMau({ gia: '159k' }); // áo 12, Đen/Trắng × M/L, mỗi ô 5
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: cheDo === 'doi' ? 'goi_y' : cheDo });
  if (cheDo === 'doi') csdl().prepare('UPDATE phien_live SET doi_ai = 1 WHERE id = ?').run(p.id);
  fb.batDauLive();
  await phong.quet();
  const binhLuan = async (ten, noiDung, o = {}) => {
    const truoc = live.demBinhLuan(p.id).tong;
    fb.themBinhLuan({ ten, noi_dung: noiDung, ...o });
    for (let i = 0; i < 200 && live.demBinhLuan(p.id).tong === truoc; i++) await cho(2);
    await cho(5);
    await chot.choXong();
    await ht.choXong();
    return live.binhLuanGanDay(p.id, 1)[0];
  };
  const tinCua = (ten) => fb.luongChat('page_gia', fb.psidCua('page_gia', ten)).filter((x) => x.tu === 'page');
  const bam = async (ten, tieuDe) => {
    const the = [...fb.luongChat('page_gia', fb.psidCua('page_gia', ten))].reverse().find((x) => x.tu === 'page' && x.nut?.some((n) => n.tieu_de === tieuDe));
    const n = the.nut.find((x) => x.tieu_de === tieuDe);
    fb.khachBam({ psid: fb.psidCua('page_gia', ten), payload: n.payload, tieu_de: n.tieu_de });
    await cho(10);
    await ht.choXong();
  };
  // Thẻ gửi "4 phút trước" (lùi giờ trong cơ sở dữ liệu thay vì chờ thật).
  const lui = (phut) => csdl().prepare('UPDATE luot_nhan_rieng SET luc = ?').run(new Date(Date.now() - phut * 60e3).toISOString());
  return { fb, live, p, mau, chot, ht, phong, binhLuan, tinCua, bam, suKien, chen, noi, director, lui, csdl, goiAi: () => goiAi };
}

const chat = (x, ten) => x.fb.luongChat('page_gia', x.fb.psidCua('page_gia', ten)).filter((y) => y.tu === 'page');
const psid = (x, ten) => x.fb.psidCua('page_gia', ten);

/** Hội thoại Messenger của người xem. */
function hoiThoai(x, ten) {
  const hopThu = require('../server/nghiep-vu/hop-thu');
  return hopThu.layHoiThoai(hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === psid(x, ten)).id);
}

/** Quần 15 phối cùng áo 12. */
function coQuanPhoi(x, { gia = '89k' } = {}) {
  const sp = require('../server/nghiep-vu/san-pham');
  const q = taoSanPhamMau({ so: 15, ten: 'Quần short đũi', danhMuc: 'quan_short', gia, mau: ['Be'], co: ['S', 'M'] });
  sp.suaSanPham(x.mau.san_pham.id, { phoi_cung: [q.san_pham.id] });
  return q;
}

async function giuVaDuThongTin(x, ten, sdt) {
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan(ten, 'chốt 12 đen M');
  await x.bam(ten, 'Giữ, lên đơn');
  const h = hoiThoai(x, ten);
  const d0 = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
  require('../server/nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: d0, ten, sdt, diaChi: '12 Lý Thái Tổ, Bắc Ninh' });
  const g = await require('../server/gui-the-don').guiTheDon({ d: don.layDon(d0.id), layKetNoi: () => x.fb });
  assert.ok(g.da_gui, g.ly_do);
  return { d: don.layDon(d0.id), h: hoiThoai(x, ten) };
}

test('bảng số "Thêm X nữa là miễn ship": 159.000đ + ship 10.000đ, miễn từ 200.000đ → "Thêm 41.000đ"; đạt mức / không có mức / ship 0 → không dòng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const don = require('../server/nghiep-vu/don');
  const theDon = require('../server/nghiep-vu/the-don');
  const mau = taoSanPhamMau({ gia: '159k', ton: 20 });
  const tao = (sl) => don.taoDon({ mon: [{ phan_loai_id: mau.pl('Đen', 'M').id, so_luong: sl }], nguon: 'tin_nhan', tenNhan: 'Lan', sdtNhan: '+84912345678', diaChiNhan: 'Bắc Ninh' });
  const bang = [
    { ship: 10000, mien: 200000, sl: 1, mong: 41000 },
    { ship: 10000, mien: 200000, sl: 2, mong: null }, // 318.000đ ≥ mức
    { ship: 10000, mien: null, sl: 1, mong: null },
    { ship: 0, mien: 200000, sl: 1, mong: null },
    { ship: 30000, mien: 500000, sl: 3, mong: 23000 }, // 477.000đ
  ];
  for (const b of bang) {
    caiDat.datBanHang({ phi_ship: b.ship, mien_phi_tu: b.mien });
    const d = tao(b.sl);
    assert.equal(don.tienConThieuMienShip(d), b.mong, JSON.stringify(b));
    const chu = theDon.noiDung(d);
    if (b.mong) assert.match(chu, new RegExp(`Thêm ${(b.mong / 1000).toFixed(0)}\\.000đ nữa là miễn ship`));
    else assert.doesNotMatch(chu, /nữa là miễn ship/);
    assert.ok(chu.length <= 640);
  }
});

test('món phối: [➕ Thêm quần 15] trên thẻ đơn; bấm → phân loại còn hàng; chọn → đơn thêm dòng, ship tính lại về 0đ, thẻ mới; bấm thẻ cũ không xác nhận nhầm; lần 2 trong 24 giờ không gợi ý', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ phi_ship: 10000, mien_phi_tu: 200000 });
  const don = require('../server/nghiep-vu/don');
  coQuanPhoi(x);
  const { d } = await giuVaDuThongTin(x, 'Nguyễn Lan', '0912345678');
  const theCu = chat(x, 'Nguyễn Lan').at(-1);
  assert.match(theCu.noi_dung, /Thêm 41\.000đ nữa là miễn ship/);
  const nhanh = theCu.nut.filter((n) => n.loai === 'nhanh');
  assert.deepEqual(nhanh.map((n) => n.tieu_de), ['➕ Thêm quần 15']);
  await x.bam('Nguyễn Lan', '➕ Thêm quần 15');
  const hoi = chat(x, 'Nguyễn Lan').at(-1);
  assert.deepEqual(hoi.nut.filter((n) => n.loai === 'nhanh').map((n) => n.tieu_de), ['Be/S', 'Be/M']);
  await x.bam('Nguyễn Lan', 'Be/M');
  const d2 = don.layDon(d.id);
  assert.equal(d2.dong.length, 2);
  assert.equal(d2.tong_hang, 248000);
  assert.equal(d2.phi_ship, 0, 'đạt mức miễn ship');
  const theMoi = chat(x, 'Nguyễn Lan').at(-1);
  assert.match(theMoi.noi_dung, /Tổng tiền: 248\.000đ/);
  assert.ok(!theMoi.nut.some((n) => n.loai === 'nhanh'), 'không gợi ý phối lần 2');
  // Bấm Xác nhận trên thẻ CŨ (tổng 169.000đ) → không xác nhận nhầm, gửi thẻ mới.
  x.fb.khachBam({ psid: psid(x, 'Nguyễn Lan'), payload: theCu.nut.find((n) => n.tieu_de === '✅ Xác nhận đơn').payload, tieu_de: '✅ Xác nhận đơn' });
  await cho(20); await x.ht.choXong();
  assert.equal(don.layDon(d.id).trang_thai, 'cho_xac_nhan');
  assert.ok(chat(x, 'Nguyễn Lan').some((y) => /thẻ này đã cũ/.test(y.noi_dung)));
});

test('món phối hết hàng hoặc Ngừng bán → không gợi ý', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ phi_ship: 10000, mien_phi_tu: 200000 });
  const q = coQuanPhoi(x);
  const kho = require('../server/nghiep-vu/kho');
  kho.dieuChinh(q.phan_loai.map((p) => ({ phan_loai_id: p.id, ton: 0 })));
  await giuVaDuThongTin(x, 'Trần Hoa', '0912000111');
  assert.ok(!chat(x, 'Trần Hoa').at(-1).nut.some((n) => n.loai === 'nhanh'), 'hết hàng');
  kho.dieuChinh(q.phan_loai.map((p) => ({ phan_loai_id: p.id, ton: 5 })));
  require('../server/nghiep-vu/san-pham').doiTrangThai(q.san_pham.id, 'ngung_ban');
  await giuVaDuThongTin(x, 'Lê Mai', '0912000222');
  assert.ok(!chat(x, 'Lê Mai').at(-1).nut.some((n) => n.loai === 'nhanh'), 'ngừng bán');
});

test('đơn Đã xác nhận bị sửa món qua AI / nút → về Chờ xác nhận + thẻ mới; người sửa tay giữ Đã xác nhận', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const { d } = await giuVaDuThongTin(x, 'Phan Thu', '0912000333');
  await x.bam('Phan Thu', '✅ Xác nhận đơn');
  assert.equal(don.layDon(d.id).trang_thai, 'da_xac_nhan');
  // Người sửa tay (màn hình Đơn hàng)
  don.themMon(d.id, x.mau.pl('Trắng', 'L').id, 1, { boi: 'nguoi' });
  assert.equal(don.layDon(d.id).trang_thai, 'da_xac_nhan', 'người sửa tay giữ trạng thái');
  // AI thêm món (cap_nhat_don 'them')
  const d2 = don.themMon(d.id, x.mau.pl('Trắng', 'M').id, 1, { boi: 'ai' });
  assert.equal(d2.trang_thai, 'cho_xac_nhan');
  assert.ok(d2.giu_den && new Date(d2.giu_den) > Date.now() + 23 * 3600e3, 'giữ lại đủ giờ');
  const ls = don.lichSu(d.id).at(-1);
  assert.deepEqual([ls.tu, ls.den, ls.nguon, ls.ghi_chu], ['da_xac_nhan', 'cho_xac_nhan', 'ai', 'sửa món sau xác nhận']);
  // Khách xác nhận lại thẻ mới, rồi bấm [Không lấy] một món trên thẻ giữ hàng cũ → về Chờ xác nhận, có thẻ mới.
  await require('../server/gui-the-don').guiTheDon({ d: don.layDon(d.id), layKetNoi: () => x.fb });
  await x.bam('Phan Thu', '✅ Xác nhận đơn');
  assert.equal(don.layDon(d.id).trang_thai, 'da_xac_nhan');
  await x.bam('Phan Thu', 'Không lấy');
  const d3 = don.layDon(d.id);
  assert.equal(d3.trang_thai, 'cho_xac_nhan');
  assert.equal(d3.dong.length, 2);
  assert.match(chat(x, 'Phan Thu').at(-1).noi_dung, /🧾 Đơn DH-\d{4}[\s\S]*Tổng tiền/);
});

test('gộp giữa hai buổi: hỏi một lần; bấm Gộp → 1 đơn đủ dòng, còn bán được không đổi, đối chiếu kho rỗng, đơn mới Đã hủy lý do gộp; Tách → 2 đơn; payload đơn người khác bị từ chối', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  const live = require('../server/nghiep-vu/live');
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  // Buổi cũ đã xong (tạm đổi trạng thái buổi đang mở để tạo được buổi thứ hai).
  const tt = x.csdl().prepare('SELECT trang_thai FROM phien_live WHERE id = ?').get(x.p.id).trang_thai;
  x.csdl().prepare("UPDATE phien_live SET trang_thai = 'xong' WHERE id = ?").run(x.p.id);
  const pCu = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  x.csdl().prepare("UPDATE phien_live SET trang_thai = 'xong' WHERE id = ?").run(pCu.id);
  x.csdl().prepare('UPDATE phien_live SET trang_thai = ? WHERE id = ?').run(tt, x.p.id);
  // Buổi 2 (đang live): Vũ An chốt → đơn mới giữ hàng ngay.
  await x.binhLuan('Vũ An', 'chốt 12 đen M');
  const moi = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null })[0];
  const nguoi = moi.nguoi_fb_id;
  // Buổi 1 (đã qua): Vũ An còn đơn Trắng/L đủ thông tin, Đã xác nhận, chưa gửi.
  const cu = don.taoDon({ mon: [{ phan_loai_id: x.mau.pl('Trắng', 'L').id, so_luong: 1 }], nguon: 'binh_luan_live', nguoiFbId: nguoi, phienLiveId: pCu.id, dienTap: true,
    tenNhan: 'Vũ An', sdtNhan: '+84912000555', diaChiNhan: '5 Ngô Gia Tự, Bắc Ninh' });
  x.csdl().prepare("UPDATE don SET trang_thai = 'da_xac_nhan', giu_den = NULL, tao_luc = ? WHERE id = ?").run(new Date(Date.now() - 86400e3).toISOString(), cu.id);
  // Bấm Giữ → hỏi gộp (một lần) trước tin xin thông tin.
  const truoc = kho.conHang(x.mau.san_pham.id).map((y) => [y.id, y.con_ban_duoc]);
  await x.bam('Vũ An', 'Giữ, lên đơn');
  const ds = chat(x, 'Vũ An');
  const hoi = ds.find((y) => /còn đơn DH-\d{4} chưa gửi \(số 12 Trắng\/L\)\. Gộp chung/.test(y.noi_dung));
  assert.ok(hoi, 'hỏi gộp');
  assert.ok(ds.indexOf(hoi) < ds.length - 1 && /Để giao hàng/.test(ds.at(-1).noi_dung), 'hỏi gộp trước tin xin thông tin');
  // Payload gộp mà đơn không phải của người bấm → từ chối.
  await x.binhLuan('Kẻ Gian', 'hi');
  x.fb.khachNhan({ ten: 'Kẻ Gian', noi_dung: 'shop ơi' });
  await cho(20); await x.ht.choXong();
  x.fb.khachBam({ psid: psid(x, 'Kẻ Gian'), payload: require('../server/nghiep-vu/nut-bam').taoPayload('GOP_DON', { tu: moi.id, vao: cu.id }), tieu_de: '🔗 Gộp' });
  await cho(20); await x.ht.choXong();
  assert.equal(don.layDon(moi.id).trang_thai, 'cho_xac_nhan', 'payload của người khác không gộp');
  await x.bam('Vũ An', '🔗 Gộp');
  const gop = don.layDon(cu.id);
  assert.equal(gop.dong.length, 2);
  assert.equal(gop.trang_thai, 'cho_xac_nhan', 'đơn đã xác nhận nhận thêm món → Chờ xác nhận');
  const huy = don.layDon(moi.id);
  assert.equal(huy.trang_thai, 'da_huy');
  assert.equal(huy.ly_do_huy, `đã gộp vào ${cu.ma}`);
  assert.equal(huy.gop_vao, cu.id);
  assert.deepEqual(kho.conHang(x.mau.san_pham.id).map((y) => [y.id, y.con_ban_duoc]), truoc, 'còn bán được không đổi');
  assert.deepEqual(kho.doiChieu(), []);
  assert.match(chat(x, 'Vũ An').at(-1).noi_dung, new RegExp(`🧾 Đơn ${cu.ma}`), 'thẻ đơn mới của đơn gộp');
  assert.deepEqual(don.donGopVao(cu.id).map((y) => y.ma), [moi.ma]);
  // Chốt thêm: đơn mới khác → hỏi gộp một lần nữa (mỗi đơn hỏi một lần); bấm lại Gộp cũ trên tin trước → không gộp gì thêm.
  const soHoi = chat(x, 'Vũ An').filter((y) => /Gộp chung/.test(y.noi_dung)).length;
  await x.binhLuan('Vũ An', 'chốt 12 trắng M');
  await x.bam('Vũ An', 'Giữ, lên đơn');
  assert.equal(chat(x, 'Vũ An').filter((y) => /Gộp chung/.test(y.noi_dung)).length, soHoi + 1);
  const d3 = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null }).find((y) => y.nguoi_fb_id === nguoi && y.id !== cu.id);
  assert.ok(d3.hoi_gop_luc, 'đã ghi lúc hỏi');
  await x.bam('Vũ An', 'Giữ, lên đơn');
  assert.equal(chat(x, 'Vũ An').filter((y) => /Gộp chung/.test(y.noi_dung)).length, soHoi + 1, 'bấm lại không hỏi lần hai');
  assert.deepEqual(kho.doiChieu(), []);
});

test('Tách riêng hoặc không bấm → giữ 2 đơn', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan('Hà Vy', 'chốt 12 đen M');
  const nguoi = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null })[0].nguoi_fb_id;
  const cu = don.taoDon({ mon: [{ phan_loai_id: x.mau.pl('Trắng', 'L').id, so_luong: 1 }], nguon: 'tin_nhan', nguoiFbId: nguoi, dienTap: true });
  await x.bam('Hà Vy', 'Giữ, lên đơn');
  await x.bam('Hà Vy', 'Tách riêng');
  const mo = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null }).filter((y) => y.nguoi_fb_id === nguoi);
  assert.equal(mo.length, 2);
  assert.ok(mo.some((y) => y.id === cu.id));
  assert.match(chat(x, 'Hà Vy').at(-1).noi_dung, /để đơn DH-\d{4} riêng/);
});

test('Sổ tay: dòng phí ship tự sinh từ Cài đặt (chỉ đọc) + câu cho phần Giới thiệu Page', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api', require('../server/api/so-tay'));
  const sv = app.listen(0);
  t.after(() => sv.close());
  const goc = `http://127.0.0.1:${sv.address().port}/api`;
  assert.equal((await (await fetch(`${goc}/so-tay`)).json()).tu_sinh, null, 'chưa đặt phí ship');
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Moza Shop', phi_ship: 10000, mien_phi_tu: 200000 });
  const ts = (await (await fetch(`${goc}/so-tay`)).json()).tu_sinh;
  assert.equal(ts.chu, 'Phí ship đồng giá 10.000đ, miễn phí ship cho đơn từ 200.000đ.');
  assert.match(ts.cau_gioi_thieu, /^Moza Shop: Phí ship đồng giá 10\.000đ, miễn phí ship cho đơn từ 200\.000đ\./);
  const muc = require('../server/nghiep-vu/so-tay').danhSachMuc();
  assert.ok(!muc.some((m) => /10\.000đ/.test(m.noi_dung)), 'không tạo nguồn thứ hai trong Sổ tay');
});
