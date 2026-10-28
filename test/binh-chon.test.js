'use strict';

/**
 * Bình chọn bằng bình luận, không quà (SPEC.md F-86, #111). Facebook giả, AI giả — 0 đồng.
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
  const { TheNhac } = require('../server/the-nhac');
  const theNhac = new TheNhac({ phat, phongAi, tatMs: 60000 });
  const chieu = [];
  const { BinhChon } = require('../server/binh-chon');
  phong.binhChon = new BinhChon({ phat, phongAi, layManHinh: () => ({ chieu: (l) => chieu.push(l) }), layTheNhac: () => theNhac, giayMs: 60000 });
  t.after(() => { phong.binhChon.dung(); theNhac.datLai(null); });
  ht.batDau();
  t.after(() => { ht.dung(); chot.dung(); phong.dongLuong(); });
  const mau = taoSanPhamMau({ gia: '159k', mau: ['Be', 'Đen'] }); // áo 12, Be/Đen × M/L
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
  return { fb, live, p, mau, chot, ht, phong, binhLuan, tinCua, bam, suKien, chen, noi, director, lui, csdl, theNhac, chieu, goiAi: () => goiAi };
}


test('bình chọn: phiếu A / b / chọn a / A be / tên màu, phiếu sau cùng; "chốt 12 đen M" thành đơn, không là phiếu; phiếu không tới Director; kết quả → thẻ ưu tiên, chiếu ảnh, câu kết không số', async (t) => {
  const x = await dung(t, { cheDo: 'doi' });
  x.live.doiDoan(x.p.id, 1);
  const bc = x.phong.binhChon;
  bc.mo({ mau: ['be', 'Đen'] });
  assert.equal(x.chen.at(-1).khoa, 'binh_chon_mo');
  const soDir = x.director.length;
  const phieu = [['Nguyễn Lan', 'A'], ['Trần Hoa', 'b'], ['Lê Trâm', 'chọn a'], ['Phạm Vy', 'A be'], ['Đỗ Quỳnh', 'đen'], ['Bùi Khánh', 'a nha'],
    ['Hồ Ngọc', 'B nhé'], ['Vũ Thư', 'be'], ['Tạ Linh', 'em chọn b'], ['Hà My', 'A'], ['Hà My', 'b']];
  for (const [ten, nd] of phieu) await x.binhLuan(ten, nd);
  const bl = await x.binhLuan('Lý Hân', 'chốt 12 đen M');
  assert.ok(bl.nhan.includes('chot'), 'chốt vẫn thành đơn');
  const tt = bc.trangThai();
  assert.deepEqual(tt.lua_chon.map((y) => [y.chu, y.mau, y.phieu]), [['A', 'Be', 5], ['B', 'Đen', 5]], 'Hà My đổi phiếu → tính phiếu sau');
  assert.equal(x.director.length, soDir, 'phiếu không tới Director');
  assert.ok(x.live.binhLuanGanDay(x.p.id, 30).filter((y) => y.nhan.includes('binh_chon')).every((y) => y.xu_ly === 'bo_qua'));
  await x.binhLuan('Đặng An', 'chọn a');
  const kq = bc.ket();
  assert.equal(kq.thang, 'Be');
  assert.equal(x.theNhac.trangThai().hien.chu, 'Be thắng — mặc Be cho cả nhà xem ngay');
  assert.deepEqual(x.chieu.at(-1), { mau: 'anh', so: 12, mau_sac: 'Be' });
  const ket = x.chen.at(-1);
  assert.equal(ket.khoa, 'binh_chon_ket');
  const mauCau = require('../server/cau-hinh/doi-ai-cau-mau.json');
  for (const k of ['binh_chon_mo', 'binh_chon_ket', 'binh_chon_hoa']) for (const l of mauCau[k]) for (const [, loi] of l) {
    assert.doesNotMatch(loi, /\{so\}|phiếu|quà|chia sẻ/i, k);
  }
  assert.ok(x.suKien.some((e) => e.type === 'mhsp.binh_chon' && e.ket_qua?.thang === 'Be'));
});

test('bình chọn: hòa → thẻ "người dẫn chọn"; mở lần thứ 3 trong buổi → từ chối', async (t) => {
  const x = await dung(t);
  x.live.doiDoan(x.p.id, 1);
  const bc = x.phong.binhChon;
  bc.mo({ mau: ['Be', 'Đen'] });
  await x.binhLuan('Nguyễn Lan', 'A');
  await x.binhLuan('Trần Hoa', 'B');
  assert.equal(bc.ket().hoa, true);
  assert.match(x.theNhac.trangThai().hien.chu, /hòa — người dẫn chọn/);
  bc.mo({ mau: ['Be', 'Đen'] });
  bc.ket();
  assert.throws(() => bc.mo({ mau: ['Be', 'Đen'] }), /đã đủ 2 lần/);
  assert.throws(() => { bc.soLan.clear(); bc.mo({ mau: ['Be'] }); }, /Chọn 2–3 màu/);
});
