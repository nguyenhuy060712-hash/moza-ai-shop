'use strict';

/**
 * Câu hỏi có ý mua → thẻ mời giữ một chạm (SPEC.md F-71, P02): "12 đen M còn ko shop" → thẻ ảnh đúng màu, "còn hàng", [Giữ cho mình]
 * [Xem màu khác]; KHÔNG tự giữ hàng; Director vẫn nhận bình luận; mỗi món một thẻ mỗi buổi; bấm Giữ → đơn giữ 24 giờ; hết hàng lúc
 * bấm → báo hết + lựa chọn còn hàng. Facebook giả, AI giả — 0 đồng.
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

test('hỏi mua "12 đen M còn ko shop" → thẻ mời, không tự giữ; Director vẫn nhận; hỏi lại cùng món → không thẻ thứ hai', async (t) => {
  const x = await dung(t);
  const kho = require('../server/nghiep-vu/kho');
  const con = () => kho.conHang(x.mau.san_pham.id).find((y) => y.id === x.mau.pl('Đen', 'M').id).con_ban_duoc;
  const soDir = x.director.length;
  await x.binhLuan('Trần Hoa', '12 đen M còn ko shop');
  const the = x.tinCua('Trần Hoa');
  assert.equal(the.length, 1);
  assert.equal(the[0].the.kieu, 'anh');
  assert.match(the[0].the.tieu_de, /^Áo 12 Đen\/M · 159\.000đ · còn hàng$/);
  assert.match(the[0].the.phu_de, /Tin tự động từ trợ lý AI/);
  assert.deepEqual(the[0].nut.map((n) => n.tieu_de), ['Giữ cho mình', 'Xem màu khác']);
  assert.equal(con(), 5, 'không tự giữ hàng');
  assert.equal(x.director.length, soDir + 1, 'Director vẫn nhận câu hỏi');
  await x.binhLuan('Trần Hoa', '12 trắng L còn không ạ');
  assert.equal(x.tinCua('Trần Hoa').length, 1, 'mỗi món một thẻ mời mỗi buổi (và cách 5 phút sau tin riêng)');
  assert.equal(x.goiAi(), 0);
});

test('bấm [Giữ cho mình] → đơn Chờ xác nhận giữ 24 giờ + xin thông tin; hết hàng lúc bấm → báo hết + lựa chọn còn hàng', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan('Lê Minh', 'áo 12 còn trắng M không?');
  await x.bam('Lê Minh', 'Giữ cho mình');
  const d = don.danhSach({ trangThai: 'cho_xac_nhan' })[0];
  assert.ok(d, 'có đơn');
  assert.deepEqual(d.dong.map((y) => y.phan_loai_id), [x.mau.pl('Trắng', 'M').id]);
  assert.ok(Math.abs(new Date(d.giu_den).getTime() - (Date.now() + 24 * 3600e3)) < 10000, 'giữ 24 giờ');
  assert.match(x.tinCua('Lê Minh').at(-1).noi_dung, /tên( người nhận)?, số điện thoại/);

  await x.binhLuan('Phạm Yến', '12 đen L còn hông');
  x.csdl().prepare('UPDATE phan_loai SET ton = 0 WHERE id = ?').run(x.mau.pl('Đen', 'L').id);
  await x.bam('Phạm Yến', 'Giữ cho mình');
  const cuoi = x.tinCua('Phạm Yến').at(-1);
  assert.match(cuoi.noi_dung, /hết/);
  assert.ok(cuoi.nut?.length, 'có lựa chọn còn hàng');
  assert.equal(don.danhSach({ trangThai: 'cho_xac_nhan' }).length, 1, 'không tạo đơn khi hết');
});

test('không gửi thẻ mời: người đã có đơn chứa đúng phân loại; hết hàng; thiếu size', async (t) => {
  const x = await dung(t);
  await x.binhLuan('Ngô Vy', 'chốt 12 đen M');
  const n = x.tinCua('Ngô Vy').length;
  x.csdl().prepare('UPDATE luot_nhan_rieng SET luc = ?').run(new Date(Date.now() - 10 * 60e3).toISOString());
  await x.binhLuan('Ngô Vy', '12 đen M còn không');
  assert.equal(x.tinCua('Ngô Vy').length, n, 'đã có đơn chứa Đen/M');
  x.csdl().prepare('UPDATE phan_loai SET ton = 0 WHERE id = ?').run(x.mau.pl('Trắng', 'L').id);
  await x.binhLuan('Đỗ Quỳnh', '12 trắng L còn không');
  assert.equal(x.tinCua('Đỗ Quỳnh').length, 0, 'hết hàng: không mời');
  await x.binhLuan('Bùi Khánh', '12 đen còn không');
  assert.equal(x.tinCua('Bùi Khánh').length, 0, 'thiếu size: không mời');
});
