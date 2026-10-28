'use strict';

/**
 * Đơn chốt lúc Mai nói nhầm giá: giữ giá có lợi cho khách (SPEC.md F-106) — chỉ hạ, chỉ dòng món bị nói sai, chỉ trong khoảng nói nhầm, đơn đã gửi không đổi, bất biến tổng tiền, hai chế độ, Giữ giá đúng, phí ship. Facebook giả, AI giả — 0 đồng.
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

/** Lỗi "chắc" Mai nói giá thấp: khoảng từ `tu` tới `den` (ms so với bây giờ). */
function loiGia(phienId, spId, { noi = 150000, dung = 159000, tu = -60e3, den = 120e3, loai = 'gia' } = {}) {
  const { csdl } = require('../server/db/ket-noi');
  const l = require('../server/nghiep-vu/loi-noi').ghi({ phienId, cau: 'Áo số 12 giá 150k', loi: { loai, muc: 'chac', san_pham_id: spId, noi, dung },
    dinhChinhLuc: new Date(Date.now() + tu + 2000).toISOString(), hetKhoangLuc: new Date(Date.now() + den).toISOString() });
  csdl().prepare('UPDATE loi_noi_song SET luc = ? WHERE id = ?').run(new Date(Date.now() + tu).toISOString(), l.id);
  return require('../server/nghiep-vu/loi-noi').lay(l.id);
}

const bangTong = (d) => d.dong.reduce((a, x) => a + x.so_luong * x.don_gia, 0) + d.phi_ship;

test('chỉ đơn trong khoảng, chỉ dòng món bị nói sai, chỉ hạ; tổng luôn = Σ(sl × đơn giá) + ship; đơn đã gửi không đổi; lịch sử + việc; "Giữ giá đúng" đưa về như cũ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ phi_ship: '20k', mien_phi_tu: '1000k' });
  const don = require('../server/nghiep-vu/don');
  const gnn = require('../server/nghiep-vu/gia-noi-nham');
  const { csdl } = require('../server/db/ket-noi');
  const ao = taoSanPhamMau({ gia: '159k', ton: 30 });
  const quan = taoSanPhamMau({ so: 15, ten: 'Quần jean', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'], ton: 30 });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = require('../server/nghiep-vu/live').taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  const tao = (lechMs) => {
    const d = don.taoDon({ mon: [{ phan_loai_id: ao.pl('Đen', 'M').id, so_luong: 2 }, { phan_loai_id: quan.pl('Xanh', 'M').id }], nguon: 'binh_luan_live', phienLiveId: p.id, nguoiFbId: `u${lechMs}` });
    const luc = new Date(Date.now() + lechMs).toISOString();
    csdl().prepare('UPDATE don SET tao_luc = ?, mon_sua_luc = ? WHERE id = ?').run(luc, luc, d.id);
    return d;
  };
  const truoc = tao(-5 * 60e3);
  const trong = tao(-30e3);
  const sau = tao(10 * 60e3);
  const daGui = tao(-20e3);
  don.datThongTinGiao(daGui.id, { ten: 'Lan', sdt: '0912345678', diaChi: '12 Lý Thái Tổ, Bắc Ninh' }, { boi: 'nguoi' });
  don.doiTrangThai(daGui.id, 'da_xac_nhan');
  don.doiTrangThai(daGui.id, 'da_gui');
  const l = loiGia(p.id, ao.san_pham.id);
  const ra = gnn.quetKhoang(l);
  assert.deepEqual(ra.map((x) => x.don_id), [trong.id], 'chỉ đơn trong khoảng, chưa gửi');
  const d = don.layDon(trong.id);
  assert.deepEqual(d.dong.map((x) => x.don_gia), [150000, 359000], 'chỉ dòng áo 12 hạ, quần giữ');
  assert.equal(d.tong_tien, bangTong(d));
  assert.equal(d.tong_tien, 2 * 150000 + 359000 + 20000);
  for (const x of [truoc, sau, daGui]) { const y = don.layDon(x.id); assert.equal(y.dong[0].don_gia, 159000); assert.equal(y.tong_tien, bangTong(y)); }
  assert.ok(don.lichSu(trong.id).some((h) => /Mai nói áo số 12 giá 150\.000đ.*bán theo giá Mai nói/.test(h.ghi_chu || '')));
  assert.ok(require('../server/nghiep-vu/khach').danhSachViec({}).some((v) => v.don_id === trong.id && /Giữ giá đúng/.test(v.noi_dung)));
  assert.match(don.khoiChoAi(d), /giữ theo lời Mai trên live/);
  assert.equal(gnn.quetKhoang(l).length, 0, 'quét lại: không hạ thêm');
  // Mai nói giá CAO hơn → không đổi.
  assert.equal(gnn.apChoDon(truoc.id, { ...l, id: 'ln_x', gia_tri_noi: 199000 }), null);
  // Giữ giá đúng.
  const dd = gnn.cuaDon(trong.id)[0];
  const kq = gnn.xuLy(dd.id, 'giu_gia_dung');
  assert.equal(kq.doi_tong, true);
  assert.deepEqual(kq.don.dong.map((x) => x.don_gia), [159000, 359000]);
  assert.equal(kq.don.tong_tien, bangTong(kq.don));
  assert.ok(don.lichSu(trong.id).some((h) => /Giữ giá đúng/.test(h.ghi_chu || '')));
  assert.equal(gnn.apChoDonMoi(trong.id, { phienId: p.id }).length, 0, 'đã giữ giá đúng: không hạ lại');
  assert.throws(() => gnn.xuLy(dd.id, 'da_xem'), /đã xử lý/);
});

test('"Chủ shop quyết": giá không đổi, có đánh dấu + việc, bấm "Bán theo giá Mai nói" mới hạ; lỗi phí ship và mức miễn ship theo lời Mai', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  caiDat.datBanHang({ phi_ship: '20k', mien_phi_tu: '500k', khi_noi_nham_gia: 'chu_shop_quyet' });
  const don = require('../server/nghiep-vu/don');
  const gnn = require('../server/nghiep-vu/gia-noi-nham');
  const ao = taoSanPhamMau({ gia: '159k', ton: 30 });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = require('../server/nghiep-vu/live').taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  const tao = (sl) => don.taoDon({ mon: [{ phan_loai_id: ao.pl('Đen', 'M').id, so_luong: sl }], nguon: 'binh_luan_live', phienLiveId: p.id, nguoiFbId: `u${sl}${Math.random()}` });
  const a = tao(1);
  const l = loiGia(p.id, ao.san_pham.id);
  assert.equal(gnn.quetKhoang(l).length, 1);
  assert.equal(don.layDon(a.id).tong_tien, 159000 + 20000, 'chưa đổi giá');
  const dd = gnn.cuaDon(a.id)[0];
  assert.equal(dd.chi_tiet.che_do, 'chu_shop_quyet');
  const kq = gnn.xuLy(dd.id, 'ban_theo_gia_noi');
  assert.equal(kq.don.tong_tien, 150000 + 20000);
  assert.match(don.khoiChoAi(kq.don), /giữ theo lời Mai/);
  caiDat.datBanHang({ khi_noi_nham_gia: 'ban_theo_gia_noi' });
  // Phí ship: Mai nói 10k.
  const b = tao(1);
  const ls = loiGia(p.id, null, { loai: 'ship', noi: 10000, dung: 20000 });
  gnn.quetKhoang(ls);
  assert.equal(don.layDon(b.id).phi_ship, 10000);
  assert.equal(don.layDon(b.id).tong_tien, 159000 + 10000);
  // Miễn ship: Mai nói "từ 300k" (thật 500k) — đơn 2 áo 318k được miễn, đơn 1 áo không.
  const c2 = tao(2);
  const c1 = tao(1);
  const lm = loiGia(p.id, null, { loai: 'ship', noi: 300000, dung: 500000 });
  gnn.quetKhoang(lm);
  assert.equal(don.layDon(c2.id).phi_ship, 0);
  assert.equal(don.layDon(c1.id).phi_ship, 20000, 'đơn 1 áo (159k < 300k): không miễn');
  for (const x of [a, b, c1, c2]) { const y = don.layDon(x.id); assert.equal(y.tong_tien, bangTong(y)); }
});

test('chốt trong lúc khoảng đang mở → đơn có giá Mai nói ngay trước tin nhắn riêng đầu tiên (Facebook giả nhận đúng tổng)', async (t) => {
  const x = await dung(t);
  loiGia(x.p.id, x.mau.san_pham.id, { tu: -5e3, den: 120e3 });
  await x.binhLuan('Hoa', 'chốt 12 đen M');
  const d = require('../server/nghiep-vu/don').danhSach({ phienLiveId: x.p.id, dienTap: null })[0];
  assert.equal(d.dong[0].don_gia, 150000);
  const the = chat(x, 'Hoa').map((y) => y.noi_dung).join('\n');
  assert.match(the, /150\.000đ/);
  assert.doesNotMatch(the, /159\.000đ/, 'tin đầu không mang giá cũ');
});
