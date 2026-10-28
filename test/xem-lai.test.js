'use strict';

/**
 * Bán sau live: bình luận chốt trên video xem lại tới 7 ngày (webhook + quét), bình luận mục lục (SPEC.md F-94, #116). Facebook giả, AI giả — 0 đồng.
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
const NGAY = 86400e3;

/** Kết thúc live giả; lùi giờ bắt đầu / kết thúc của phiên `ngay` ngày; gắn bộ nhận xem lại vào Hộp thư. */
async function xongLive(x, { ngay = 2 } = {}) {
  const live = require('../server/nghiep-vu/live');
  x.fb.ketThucLive();
  await x.phong.quet();
  const p0 = live.layPhien(x.p.id);
  assert.equal(p0.trang_thai, 'xong', 'phiên đã kết thúc');
  assert.ok(p0.fb_video_id, 'có id video xem lại');
  const bd = new Date(Date.now() - ngay * NGAY - 3600e3).toISOString();
  x.csdl().prepare('UPDATE phien_live SET bat_dau = ?, bat_dau_fb = ?, ket_thuc = ? WHERE id = ?').run(bd, bd, new Date(Date.now() - ngay * NGAY).toISOString(), x.p.id);
  const { XemLai } = require('../server/xem-lai');
  const xl = new XemLai({ layKetNoi: () => x.fb, layChotDon: () => x.chot, layHopThu: () => x.ht, phat: (type, d) => x.suKien.push({ type, ...d }) });
  x.ht.xemLai = xl;
  return { xl, p: live.layPhien(x.p.id) };
}

const binhLuanXemLai = async (x, ten, noiDung, luiGio = 0) => {
  const b = x.fb.themBinhLuanXemLai({ ten, noi_dung: noiDung, lui_gio: luiGio });
  await cho(30); await x.chot.choXong(); await x.ht.choXong();
  return b;
};

test('bình luận "chốt 12 đen M" 2 ngày sau live: 1 đơn giá thường của buổi đó, đúng 1 thẻ, không đọc tên / không "Vừa chốt"; về cả webhook lẫn lượt quét → vẫn 1 đơn, 1 tin', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const { xl, p } = await xongLive(x);
  const chotTruoc = x.suKien.filter((e) => e.type === 'live.chot').length;
  const docTruoc = x.chot.choDoc.length;
  await binhLuanXemLai(x, 'Nguyễn Lan', 'chốt 12 đen M'); // đường webhook
  await xl.quet(); // đường quét: cùng bình luận
  await cho(30); await x.chot.choXong(); await x.ht.choXong();
  const ds = don.danhSach({ dienTap: null });
  assert.equal(ds.length, 1, 'một đơn');
  assert.equal(ds[0].phien_live_id, p.id);
  assert.equal(ds[0].dong[0].don_gia, 159000, 'giá thường');
  assert.equal(chat(x, 'Nguyễn Lan').length, 1, 'đúng 1 thẻ');
  assert.match(chat(x, 'Nguyễn Lan')[0].noi_dung, /Áo 12 Đen\/M · 159\.000đ/);
  assert.equal(x.suKien.filter((e) => e.type === 'live.chot').length, chotTruoc, 'không hiện "Vừa chốt"');
  assert.equal(x.chot.choDoc.length, docTruoc, 'không đọc tên trên sóng');
  assert.ok(new Date(ds[0].giu_den) > Date.now() + 60 * 60e3, 'giữ tính từ lúc này, không phải từ lúc live xong');
  assert.equal(require('../server/nghiep-vu/bao-cao').baoCao({ dienTap: true }).theo_phien.find((y) => y.id === p.id).chot_sau_live, 1, 'Báo cáo: Chốt sau live');
});

test('"chốt đen M" không số → thẻ hỏi món, không giữ hàng; người đã có đơn mở của buổi → món gộp vào đơn đó', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan('Trần Hoa', 'chốt 12 trắng L'); // chốt trong lúc live
  await xongLive(x);
  await binhLuanXemLai(x, 'Lê Mai', 'chốt đen M');
  assert.equal(don.danhSach({ dienTap: null }).filter((d) => d.dong.some((y) => y.phan_loai_id === x.mau.pl('Đen', 'M').id)).length, 0, 'không giữ hàng');
  const hoi = chat(x, 'Lê Mai').at(-1);
  assert.ok(hoi, 'có thẻ hỏi');
  assert.ok(hoi.nut.some((n) => n.loai === 'nhanh' && /^Số 12$/.test(n.tieu_de)), 'trả lời nhanh các món của buổi');
  await binhLuanXemLai(x, 'Trần Hoa', 'chốt 12 đen M');
  const cua = don.danhSach({ dienTap: null }).filter((d) => d.dong.some((y) => y.phan_loai_id === x.mau.pl('Trắng', 'L').id));
  assert.equal(cua.length, 1);
  assert.equal(cua[0].dong.length, 2, 'gộp vào đơn mở của buổi');
});

test('bình luận 8 ngày tuổi / buổi xong quá 7 ngày → không xử lý; buổi tập đã trả kho → không tạo đơn', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const { xl } = await xongLive(x, { ngay: 2 });
  await binhLuanXemLai(x, 'Cũ Quá', 'chốt 12 đen M', 8 * 24);
  assert.equal(don.danhSach({ dienTap: null }).length, 0, 'bình luận 8 ngày tuổi');
  x.csdl().prepare('UPDATE phien_live SET ket_thuc = ? WHERE id = ?').run(new Date(Date.now() - 8 * NGAY).toISOString(), x.p.id);
  await binhLuanXemLai(x, 'Muộn', 'chốt 12 đen M');
  await xl.quet();
  assert.equal(don.danhSach({ dienTap: null }).length, 0, 'buổi xong quá 7 ngày');
  x.csdl().prepare('UPDATE phien_live SET ket_thuc = ? WHERE id = ?').run(new Date(Date.now() - 2 * NGAY).toISOString(), x.p.id);
  require('../server/nghiep-vu/dien-tap-ban-hang').traKho();
  x.csdl().prepare('UPDATE don SET tra_kho_luc = ?').run(new Date().toISOString());
  const d0 = don.danhSach({ dienTap: null }).length;
  await binhLuanXemLai(x, 'Sau Trả Kho', 'chốt 12 trắng M');
  await xl.quet();
  assert.equal(don.danhSach({ dienTap: null }).length, d0, 'đã trả kho → không tạo đơn');
});

test('buổi có giá live cho món → thẻ ghi "Giá live đã kết thúc lúc …", đơn tính giá thường', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ gia_live_bat: true });
  x.csdl().prepare('UPDATE phien_live_san_pham SET gia_live = 139000 WHERE phien_id = ?').run(x.p.id);
  await xongLive(x);
  await binhLuanXemLai(x, 'Phan Thu', 'chốt 12 đen M');
  const d = require('../server/nghiep-vu/don').danhSach({ dienTap: null })[0];
  assert.equal(d.dong[0].don_gia, 159000);
  assert.equal(d.dong[0].gia_thuong, null);
  assert.match(chat(x, 'Phan Thu').at(-1).noi_dung, /Giá live đã kết thúc lúc \d{2}:\d{2} ngày \d{1,2}\/\d{1,2}/);
});

test('bình luận TRONG lúc live về webhook với post_id {page}_{video} → Hộp thư bỏ qua (phòng live đã nhận)', async (t) => {
  const x = await dung(t);
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const p = require('../server/nghiep-vu/live').layPhien(x.p.id);
  const truoc = hopThu.danhSach({ dienTap: null }).length;
  const kq = await x.ht.nhan({ loai: 'binh_luan_bai', page_id: 'page_gia', comment_id: 'cmt_lech_1', nguoi_id: 'u1', ten: 'Ai Đó', noi_dung: 'đẹp quá', post_id: `page_gia_${p.fb_video_id}`, luc: new Date().toISOString() }, true);
  assert.equal(kq, null);
  assert.equal(hopThu.danhSach({ dienTap: null }).length, truoc);
});

test('mục lục: đúng phút theo dòng thời gian, không giá, không tên khách; đăng 1 lần; công tắc tắt / "Dừng mọi thứ" → không đăng; thiếu giờ Facebook → không đăng', async (t) => {
  const x = await dung(t);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  taoSanPhamMau({ so: 15, ten: 'Quần short đũi', danhMuc: 'quan_short', gia: '189k', mau: ['Be'], co: ['S'] });
  await x.binhLuan('Nguyễn Lan', 'chốt 12 đen M');
  const { xl, p } = await xongLive(x);
  const bd = new Date(p.bat_dau_fb).getTime();
  const sp15 = require('../server/nghiep-vu/san-pham').layTheoSo(15);
  x.csdl().prepare('DELETE FROM dong_thoi_gian_san_pham WHERE phien_id = ?').run(p.id);
  const dong = x.csdl().prepare('INSERT INTO dong_thoi_gian_san_pham (phien_id, doan, san_pham_id, tu_luc) VALUES (?, ?, ?, ?)');
  dong.run(p.id, 0, x.mau.san_pham.id, new Date(bd + 135e3).toISOString());
  dong.run(p.id, 1, sp15.id, new Date(bd + 520e3).toISOString());
  dong.run(p.id, 2, x.mau.san_pham.id, new Date(bd + 900e3).toISOString()); // quay lại món cũ: mục lục giữ lần đầu
  caiDat.datKhanCap(true);
  assert.equal((await xl.dangMucLuc(p.id)).da_dang, false, '"Dừng mọi thứ" chặn');
  caiDat.datKhanCap(false);
  caiDat.ghi('fb_tu_dang_muc_luc', false);
  assert.equal((await xl.dangMucLuc(p.id)).da_dang, false, 'công tắc tắt');
  caiDat.ghi('fb_tu_dang_muc_luc', true);
  const kq = await xl.dangMucLuc(p.id);
  assert.ok(kq.da_dang, kq.ly_do);
  const bl = x.fb.meta.binhLuanPage;
  assert.equal(bl.length, 1);
  assert.match(bl[0].noi_dung, /^📌 Mục lục: 02:15 Áo 12 · Sơ mi linen tay ngắn \| 08:40 Quần 15 · Quần short đũi\. Chốt: bình luận "chốt 12 /);
  assert.doesNotMatch(bl[0].noi_dung, /\d+\.\d{3}đ|\d+k\b|Nguyễn Lan|Lan/, 'không giá, không tên khách');
  assert.equal((await xl.dangMucLuc(p.id)).da_dang, false, 'đăng một lần');
  assert.equal(x.fb.meta.binhLuanPage.length, 1);
  // Bình luận của chính Page (mục lục) không bị coi là chốt khi quét lại.
  await xl.quet();
  assert.equal(require('../server/nghiep-vu/don').danhSach({ dienTap: null }).length, 1);
  x.csdl().prepare('UPDATE phien_live SET bat_dau_fb = NULL, muc_luc_luc = NULL WHERE id = ?').run(p.id);
  assert.match((await xl.dangMucLuc(p.id)).ly_do, /Thiếu giờ bắt đầu do Facebook/);
});
