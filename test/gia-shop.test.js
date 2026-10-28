'use strict';

/**
 * Chống kẻ gian giả làm shop (SPEC.md F-74, #105): bình luận của người không phải Page có số tài khoản / ví hoặc link lạ → ẩn,
 * không chuyển Tư vấn viên, không trả lời công khai, báo người dẫn. Thẻ đơn có dòng "Shop chỉ nhận tiền vào TK tên …".
 * Bộ mẫu do Claude Code soạn 28/9/2026. Facebook giả, AI giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const { laGiaShop } = require('../server/nghiep-vu/gia-shop');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

const GIA_SHOP = [
  'STK 1903 6688 2233 Techcombank Nguyen Van A', 'stk 0011004455667 vcb', 'Shop ơi ck vào stk 123456789 MB nha', 'chuyển khoản 19036688223344 techcom',
  'ck 88886666 ACB chủ tk TRAN THI B', 'số tk: 1234 5678 9012', 'số tài khoản 0123456789 BIDV', 'tài khoản 9704 2291 1234 5678', 'tk 0987654321 vietinbank',
  'momo 0912345678', 'Momo: 0912 345 678 chị Hoa', 'zalopay 0987654321', 'viettelpay 0335556666', 'vpbank 123456789', 'tpbank 0123 4567 890',
  'sacombank 060012345678', 'agribank 1500205123456', 'ck trước 50% nha 88886666', 'ck giúp em vào 7788990011 nhé', 'chuyển tiền cọc 123456 nha',
  'Nh vcb 0071000123456', 'ngân hàng mb 0901234567 chủ tk Le Van C', 'shopeepay 0977123456', 'cake 0123456789', 'timo 9021 1234 5678',
  'ai mua ib shop.vn/sale giá sốc', 'xem hàng tại bit.ly/abc123', 'vào https://sale-sieu-re.xyz nhận quà', 'www.shopxinh-giare.com giảm 50%',
  'link đặt hàng: tinyurl.com/hangdep', 'nhắn m.me/shopgia để được giá sỉ', 'đăng ký tại zalo-sale.top', 'hàng y hệt bên muasam.online rẻ hơn',
  'shop chính hãng: http://aothun.store', 'mua qua cutt.ly/xyz nhé', 'inbox trang hangthanhly.site', 'click shorturl.at/abc12', 't.co/abcd1234 xem ngay',
  'đặt ở goo.gl/xyz nha mọi người', 'mã giảm giá tại voucher.click/123',
];
const KHONG = [
  'chốt 12 đen M', 'chot 12 den m ck', '159k', 'DH-0042', 'số em 0912345678 tư vấn với', 'số em 0912345678 không ck đâu', '0912 345 678 ship COD',
  'CCCD 001199012345', 'giá bao nhiêu', 'ck được không shop', 'em ck nha shop', 'chuyển khoản hay COD vậy', 'tk em hết tiền rồi', 'áo 12 dài 68cm',
  'mình cao 158 nặng 50kg', 'www.facebook.com/abc', 'm.me/page_gia?ref=phien_1', 'dep qua co size L ko', 'chốt 2 cái 12 trắng L', 'lấy 1 đen M ship Bắc Ninh',
];

test(`≥ 40 mẫu giả shop (${GIA_SHOP.length}) + câu thường (${KHONG.length}): nhận đúng bằng mã`, () => {
  assert.ok(GIA_SHOP.length >= 40);
  for (const c of GIA_SHOP) assert.ok(laGiaShop(c, { pageIds: ['page_gia'] }), c);
  for (const c of KHONG) assert.equal(laGiaShop(c, { pageIds: ['page_gia'] }), null, c);
});

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

test('bình luận live có số tài khoản → ẩn, không chốt, không Director, không nhắn riêng, báo người dẫn', async (t) => {
  const x = await dung(t);
  const soDir = x.director.length;
  const bl = await x.binhLuan('Shop Xinh Official', 'Chị em ck vào STK 1903 6688 2233 Techcombank để giữ hàng nha');
  await cho(20);
  const b = x.live.layBinhLuan(bl.id);
  assert.ok(b.nhan.includes('gia_shop'));
  assert.equal(b.da_an, true, 'đã ẩn trên Facebook');
  assert.equal(b.xu_ly, 'bo_qua', 'không sang Chờ Tư vấn viên');
  assert.ok(x.fb.daAn.has(bl.fb_id) || [...x.fb.daAn].some((id) => String(id).includes(bl.fb_id)), 'Facebook giả ghi ẩn');
  assert.equal(x.director.length, soDir, 'Director không nhận');
  assert.equal(x.tinCua('Shop Xinh Official').length, 0, 'không nhắn riêng');
  assert.equal(x.fb.traLoi.length, 0, 'không trả lời công khai');
  const cb = x.suKien.find((e) => e.type === 'live.canh_bao');
  assert.match(cb.chu, /Shop Xinh Official .* số tài khoản hoặc link lạ/);
});

test('thẻ đơn: dòng "Shop chỉ nhận tiền vào TK tên …" (chưa điền tên → câu chung); 5 món vẫn ≤ 640 ký tự; không chữ "nhé"', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const don = require('../server/nghiep-vu/don');
  const theDon = require('../server/nghiep-vu/the-don');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const s = taoSanPhamMau({ ton: 20 });
  const mon = [['Đen', 'M'], ['Đen', 'L'], ['Trắng', 'M'], ['Trắng', 'L'], ['Đen', 'M']].map(([m, c]) => ({ phan_loai_id: s.pl(m, c).id, so_luong: 1 }));
  const d = don.taoDon({ mon: mon.slice(0, 4), nguon: 'tin_nhan', tenNhan: 'Nguyễn Thị Hoa Hồng Nhung', sdtNhan: '+84912345678',
    diaChiNhan: 'Số 123 ngõ 45 đường Lý Thái Tổ, phường Suối Hoa, thành phố Bắc Ninh, tỉnh Bắc Ninh', dienTap: true });
  don.themMon(d.id, s.pl('Đen', 'M').id, 2);
  let chu = theDon.noiDung(don.layDon(d.id));
  assert.match(chu, /Shop không bao giờ xin chuyển khoản qua bình luận./);
  caiDat.datBanHang({ ten_chu_tk: 'nguyen thi hoa' });
  chu = theDon.noiDung(don.layDon(d.id));
  assert.match(chu, /Shop chỉ nhận tiền vào TK tên NGUYEN THI HOA và chỉ gửi mã QR trong Messenger của Page./);
  assert.ok(chu.length <= 640, String(chu.length));
  assert.doesNotMatch(chu, /nhé/);
});
