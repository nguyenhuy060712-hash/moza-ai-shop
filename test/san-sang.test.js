'use strict';

/**
 * Bảng "Sẵn sàng lên sóng" (SPEC.md F-77, #106): dòng đỏ / vàng theo trạng thái, 3 ô tích theo buổi, "chốt test" không tạo đơn
 * mà nhắn riêng một tin thử, câu ghim có ví dụ đúng món đầu + dòng TK + link m.me. Facebook giả, AI giả — 0 đồng.
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

test('dòng đỏ / vàng theo trạng thái; hết lỗi → "Sẵn sàng"; ô tích lưu theo buổi', async (t) => {
  const x = await dung(t);
  const ss = require('../server/san-sang');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const fbPage = require('../server/nghiep-vu/fb-page');
  const ma = (d) => [...d.do.map((y) => y.ma), ...d.vang.map((y) => y.ma)];
  let d = ss.kiem();
  assert.equal(d.phien_id, x.p.id);
  assert.ok(ma(d).includes('phi_ship'), 'phí ship trống');
  assert.ok(ma(d).includes('phu_trach'), 'chưa điền người phụ trách');
  assert.ok(ma(d).includes('business_ai_chua_tich'), 'chưa xác nhận tắt trợ lý AI của Facebook (F-110)');

  caiDat.datKhanCap(true);
  d = ss.kiem();
  const kc = d.do.find((y) => y.ma === 'khan_cap');
  assert.ok(kc, 'Dừng mọi thứ → dòng đỏ');
  assert.equal(kc.nut.hanh_dong, 'tat_khan_cap');
  caiDat.datKhanCap(false);
  assert.ok(!ss.kiem().do.some((y) => y.ma === 'khan_cap'), 'tắt xong dòng biến mất');

  fbPage.datBiCam('page_gia', true, 'thử');
  assert.ok(ss.kiem().do.some((y) => y.ma === 'page_bi_cam'));
  fbPage.datBiCam('page_gia', false);

  x.csdl().prepare('UPDATE phan_loai SET ton = 0 WHERE san_pham_id = ?').run(x.mau.san_pham.id);
  const het = ss.kiem().vang.find((y) => y.ma === 'het_hang');
  assert.match(het.chu, /^1 món trong kịch bản đã hết hàng \(số 12\)/);
  x.csdl().prepare('UPDATE phan_loai SET ton = 5 WHERE san_pham_id = ?').run(x.mau.san_pham.id);

  caiDat.datBanHang({ phi_ship: '30k', phu_trach: 'Chị Hoa' });
  ss.datTich(x.p.id, 'business_ai', true);
  x.csdl().prepare("UPDATE san_pham SET anh = '[\"a.jpg\"]' WHERE id = ?").run(x.mau.san_pham.id);
  d = ss.kiem();
  assert.deepEqual(d.do, []);
  assert.deepEqual(d.vang, []);
  assert.equal(d.san_sang, true);
  assert.equal(d.tich.length, 4); // F-110 thêm ô "Đã tắt trợ lý AI của Facebook" (nhớ 7 ngày)
  ss.datTich(x.p.id, 'cau_ghim', true);
  assert.equal(ss.kiem().tich.find((y) => y.k === 'cau_ghim').bat, true);
  assert.match(ss.kiem().cau_mo_ta, /trợ lý AI .* Người phụ trách buổi live: Chị Hoa/);
});

test('câu ghim: ví dụ đúng món đầu, "Tin nhắn chờ", dòng TK, link m.me của buổi', async (t) => {
  const x = await dung(t);
  const ss = require('../server/san-sang');
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_chu_tk: 'Tran Thi B' });
  const c = ss.kiem().cau_ghim;
  assert.match(c, /ví dụ chốt 12 đen M/);
  assert.match(c, /Tin nhắn chờ/);
  assert.match(c, /Shop chỉ nhận tiền vào TK tên TRAN THI B/);
  assert.ok(c.endsWith(`Chưa thấy tin: https://m.me/page_gia?ref=phien_${x.p.id}`), c);
});

test('"chốt test": không tạo đơn, kho không đổi, khung chat giả có tin thử, bảng báo đã nhận; Director không nhận', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  const truocKho = JSON.stringify(kho.conHang(x.mau.san_pham.id).map((y) => y.con_ban_duoc));
  const soDir = x.director.length;
  await x.binhLuan('Chủ Shop Hoa', 'Chốt test');
  await cho(20);
  assert.equal(don.danhSach({ dienTap: null }).length, 0, 'không tạo đơn');
  assert.equal(JSON.stringify(kho.conHang(x.mau.san_pham.id).map((y) => y.con_ban_duoc)), truocKho, 'kho không đổi');
  assert.match(x.tinCua('Chủ Shop Hoa').at(-1).noi_dung, /MOZA đã nhận 'chốt test' lúc \d\d:\d\d/);
  const ct = require('../server/san-sang').kiem().chot_test;
  assert.equal(ct.ket_qua, 'da_gui');
  assert.equal(ct.ten, 'Chủ Shop Hoa');
  assert.ok(x.suKien.some((e) => e.type === 'live.san_sang'));
  assert.equal(x.director.length, soDir);
  assert.equal(x.goiAi(), 0);
});
