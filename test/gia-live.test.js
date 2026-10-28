'use strict';

/**
 * Giá live tới hết buổi — TẮT mặc định; một hàm "giá bán lúc này" cho giữ hàng, thẻ đơn, Bộ kiểm tra, lời Mai (SPEC.md F-93, #115). Facebook giả, AI giả — 0 đồng.
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
const datGiaLiveSQL = (x, gia) => x.csdl().prepare('UPDATE phien_live_san_pham SET gia_live = ? WHERE phien_id = ? AND san_pham_id = ?').run(gia, x.p.id, x.mau.san_pham.id);
const donCua = (x, ten) => {
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const psid = x.fb.psidCua('page_gia', ten);
  return require('../server/nghiep-vu/don').danhSach({ dienTap: null }).find((d) => d.nguoi_fb_id && hopThu.psidCuaNguoi(d.nguoi_fb_id) === psid);
};

test('công tắc tắt → không đặt được, không có ô, chốt luôn giá thường; gợi ý 3 mức làm tròn xuống 1.000đ; đặt khi đang live → GIA_LIVE_DA_KHOA', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const gb = require('../server/nghiep-vu/gia-ban');
  const live = require('../server/nghiep-vu/live');
  const mau = taoSanPhamMau({ gia: '299k' });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  assert.throws(() => gb.datGiaLive(p.id, mau.san_pham.id, { gia: '259k' }), (e) => e.ma === 'GIA_LIVE_TAT');
  assert.deepEqual(gb.goiY(299000).map((x) => x.gia), [284000, 269000, 254000]);
  assert.deepEqual(gb.goiY(159000).map((x) => x.gia), [151000, 143000, 135000]);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: true });
  assert.equal(gb.datGiaLive(p.id, mau.san_pham.id, { muc: 10 }).gia_live, 269000);
  assert.equal(gb.datGiaLive(p.id, mau.san_pham.id, { gia: '259k' }).gia_live, 259000);
  assert.throws(() => gb.datGiaLive(p.id, mau.san_pham.id, { gia: '299k' }), /nhỏ hơn giá bán/);
  assert.equal(gb.giaLiveCuaPhien(p.id)[0].gia_live, 259000);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: false });
  assert.equal(gb.giaLiveCuaPhien(p.id)[0].gia_live, null, 'tắt → không có ô');
  assert.equal(gb.giaBanLucNay(mau.san_pham, null, { phienId: p.id }).gia, 299000);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: true });
  require('../server/db/ket-noi').csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ? WHERE id = ?").run(new Date().toISOString(), p.id);
  assert.throws(() => gb.datGiaLive(p.id, mau.san_pham.id, { gia: '249k' }), (e) => e.ma === 'GIA_LIVE_DA_KHOA');
});

test('bật: chốt trong buổi → dòng 139.000đ (gia_thuong 159.000đ), thẻ đơn "(giá live)"; bình luận sau kết thúc + 15 giây → giá thường; đơn Messenger → giá thường; tắt công tắc → giá thường', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: true });
  const gb = require('../server/nghiep-vu/gia-ban');
  const don = require('../server/nghiep-vu/don');
  datGiaLiveSQL(x, 139000);
  await x.binhLuan('Nguyễn Lan', 'chốt 12 đen M');
  const d = donCua(x, 'Nguyễn Lan');
  assert.equal(d.dong[0].don_gia, 139000);
  assert.equal(d.dong[0].gia_thuong, 159000);
  assert.equal(d.tong_hang, 139000);
  assert.match(require('../server/nghiep-vu/the-don').noiDung({ ...d, ten_nhan: 'Lan', sdt_nhan: '+84912345678', dia_chi_nhan: 'BN' }), /x1: 139\.000đ \(giá live\)/);
  // Hết live: ân hạn = độ trễ phát, tối thiểu 15 giây.
  const ketThuc = new Date(Date.now() - 60e3).toISOString();
  x.csdl().prepare("UPDATE phien_live SET trang_thai = 'xong', bat_dau = ?, ket_thuc = ? WHERE id = ?").run(new Date(Date.now() - 3600e3).toISOString(), ketThuc, x.p.id);
  const s = x.mau.san_pham;
  assert.equal(gb.giaBanLucNay(s, null, { phienId: x.p.id, luc: new Date(Date.parse(ketThuc) + 10e3).toISOString() }).gia, 139000, 'trong 15 giây ân hạn');
  assert.equal(gb.giaBanLucNay(s, null, { phienId: x.p.id, luc: new Date(Date.parse(ketThuc) + 16e3).toISOString() }).gia, 159000, 'sau kết thúc + 15 giây');
  assert.equal(gb.giaBanLucNay(s, null, { phienId: null }).gia, 159000, 'đơn Messenger / không có buổi');
  const dm = don.taoDon({ mon: [{ phan_loai_id: x.mau.pl('Trắng', 'M').id }], nguon: 'tin_nhan' });
  assert.equal(dm.dong[0].don_gia, 159000);
  assert.equal(dm.dong[0].gia_thuong, null);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: false });
  assert.equal(gb.giaBanLucNay(s, null, { phienId: x.p.id, luc: new Date(Date.parse(ketThuc) + 5e3).toISOString() }).gia, 159000, 'công tắc tắt');
});

test('phân loại giá riêng không giảm; đổi M → L sau live giữ giá live; đơn trộn giá live và giá thường tính đúng tổng', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: true, phi_ship: 20000, mien_phi_tu: null });
  const don = require('../server/nghiep-vu/don');
  datGiaLiveSQL(x, 139000);
  x.csdl().prepare('UPDATE phan_loai SET gia = 179000 WHERE id = ?').run(x.mau.pl('Trắng', 'L').id);
  await x.binhLuan('Trần Hoa', 'chốt 12 trắng L');
  await x.binhLuan('Trần Hoa', 'chốt 12 đen M');
  const d = donCua(x, 'Trần Hoa');
  const dong = Object.fromEntries(d.dong.map((y) => [y.ten_chup.split(' · ').at(-1), [y.don_gia, y.gia_thuong]]));
  assert.deepEqual(dong['Trắng/L'], [179000, null], 'giá riêng giữ nguyên');
  assert.deepEqual(dong['Đen/M'], [139000, 159000]);
  assert.equal(d.tong_hang, 318000);
  assert.equal(d.tong_tien, 338000);
  // Hết live, khách đổi Đen/M → Đen/L: giữ giá live của dòng cũ.
  x.csdl().prepare("UPDATE phien_live SET trang_thai = 'xong', ket_thuc = ? WHERE id = ?").run(new Date(Date.now() - 3600e3).toISOString(), x.p.id);
  const d2 = don.doiPhanLoai(d.id, x.mau.pl('Đen', 'M').id, x.mau.pl('Đen', 'L').id);
  const l = d2.dong.find((y) => y.phan_loai_id === x.mau.pl('Đen', 'L').id);
  assert.deepEqual([l.don_gia, l.gia_thuong], [139000, 159000]);
  // Món thêm sau live: giá thường.
  const d3 = don.themMon(d.id, x.mau.pl('Trắng', 'M').id, 1);
  assert.equal(d3.dong.find((y) => y.phan_loai_id === x.mau.pl('Trắng', 'M').id).don_gia, 159000);
  assert.deepEqual(require('../server/nghiep-vu/kho').doiChieu(), []);
});

test('nguồn AI: trên sóng có dòng "Giá live buổi này" để trích; "chỉ hôm nay" bị chặn; Messenger nói giá live → K2 chặn; câu giá của Mai là giá live; Màn hình sản phẩm "Giá live · tới hết buổi", giá gạch theo bằng chứng', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: true });
  datGiaLiveSQL(x, 139000);
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  const td = [{ nguon: '12', doan: 'Giá live buổi này: 139.000đ (tới hết buổi)' }];
  assert.ok(kiemTraCau({ cau: 'Áo 12 giá live 139.000đ tới hết buổi nha cả nhà', trich_dan: td, kenh: 'song', phienLiveId: x.p.id }).dat);
  const chan = kiemTraCau({ cau: 'Áo 12 giá live 139.000đ chỉ hôm nay thôi', trich_dan: td, kenh: 'song', phienLiveId: x.p.id });
  assert.ok(chan.loi.some((l) => l.ma === 'K11'), JSON.stringify(chan.loi));
  const mess = kiemTraCau({ cau: 'Áo 12 giá live 139.000đ nha', trich_dan: td, kenh: 'messenger' });
  assert.ok(mess.loi.some((l) => l.ma === 'K2'), 'Messenger không có dòng giá live');
  assert.match(require('../server/agent/mieng/mieng').cauGia(x.mau.san_pham), /giá live 139\.000đ tới hết buổi/);
  const mh = require('../server/man-hinh-san-pham');
  const sp = require('../server/nghiep-vu/san-pham');
  const t1 = mh.theSanPham(sp.laySanPham(x.mau.san_pham.id));
  assert.deepEqual([t1.gia, t1.nhan_gia, t1.gia_goc], ['139.000đ', 'Giá live · tới hết buổi', null], 'chưa có đơn giao ở giá thường → không gạch');
  // Có đơn thật Đã giao ở 159.000đ trong 30 ngày → giá thường được gạch.
  const don = require('../server/nghiep-vu/don');
  const d = don.taoDon({ mon: [{ phan_loai_id: x.mau.pl('Trắng', 'M').id }], nguon: 'nguoi', tenNhan: 'A', sdtNhan: '+84912000123', diaChiNhan: 'BN' });
  don.doiTrangThai(d.id, 'da_xac_nhan'); don.guiNhieu([{ id: d.id }]); don.doiTrangThai(d.id, 'da_giao');
  const t2 = mh.theSanPham(sp.laySanPham(x.mau.san_pham.id));
  assert.equal(t2.gia_goc, '159.000đ');
});

test('Nói với Mai: dat_gia_live xem trước rồi mới làm; tắt công tắc / đang live → lỗi kèm cách sửa; quan_ly có công cụ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  taoSanPhamMau({ gia: '299k' });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  const cc = require('../server/agent/cong-cu/quan-ly').find((c) => c.ten === 'dat_gia_live');
  assert.ok(require('../server/nghiep-vu/cai-dat').danhSachAgent().find((a) => a.id === 'quan_ly').cong_cu.includes('dat_gia_live'));
  assert.throws(() => cc.xemTruoc({ so: 12, gia: 259000, muc: 0 }), (e) => e.ma === 'GIA_LIVE_TAT');
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: true });
  assert.match(cc.xemTruoc({ so: 12, gia: 259000, muc: 0 }).xem_truoc[0], /không có → 259\.000đ \(giá thường 299\.000đ\)/);
  assert.equal(require('../server/nghiep-vu/gia-ban').giaLiveCuaPhien(p.id)[0].gia_live, null, 'xem trước chưa ghi');
  cc.chay({ so: 12, gia: 0, muc: 10 });
  assert.equal(require('../server/nghiep-vu/gia-ban').giaLiveCuaPhien(p.id)[0].gia_live, 269000);
  require('../server/db/ket-noi').csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ? WHERE id = ?").run(new Date().toISOString(), p.id);
  assert.throws(() => cc.xemTruoc({ so: 12, gia: 249000, muc: 0 }), (e) => e.ma === 'GIA_LIVE_DA_KHOA');
});
