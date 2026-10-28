'use strict';

/**
 * Page bị Meta tạm khóa nhắn tin + Nhắn bù (SPEC.md F-73, #102): lỗi 10/1893063 → không gọi là "thiếu quyền", ghi Page bị khóa,
 * gom công khai bằng câu riêng (không mời nhắn Page), bình luận vào danh sách Nhắn bù; Page Integrity gỡ khóa; người bấm nhắn bù →
 * 3 tin mỗi phút, gặp lại khóa thì dừng, quá 7 ngày không gửi. Facebook giả, AI giả — 0 đồng.
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

test('lỗi 10/1893063: chữ đúng (không "Thiếu quyền"), Page ghi bị khóa, câu gom riêng không mời nhắn Page, vào Nhắn bù', async (t) => {
  const { doiLoi } = require('../server/facebook/graph');
  const e = doiLoi({ code: 10, error_subcode: 1893063, message: 'x' });
  assert.equal(e.ma, 'FB_PAGE_BI_CAM_NHAN');
  assert.doesNotMatch(e.message, /thiếu quyền/i);
  assert.match(e.message, /Chất lượng Page/);

  const x = await dung(t);
  const fbPage = require('../server/nghiep-vu/fb-page');
  const nhanBu = require('../server/nghiep-vu/nhan-bu');
  x.fb.meta.datCamNhan('page_gia', true);
  await x.binhLuan('Trần Hoa', 'chốt 12 đen M');
  assert.equal(x.tinCua('Trần Hoa').length, 0);
  assert.ok(fbPage.biCam('page_gia'), 'Page ghi bị khóa');
  await x.binhLuan('Lê Minh', 'chốt 12 trắng L');
  assert.equal(nhanBu.dem({ dienTap: null }), 2, 'hai người vào Nhắn bù');
  await x.chot.guiGomCongKhai(Date.now() + 1);
  const gom = x.fb.traLoi.at(-1).noi_dung;
  assert.match(gom, /Hoa, Minh ơi/);
  assert.doesNotMatch(gom, /nhắn tin cho Page|m.me/i, 'không mời nhắn Page khi Page đang bị khóa');
  const don = require('../server/nghiep-vu/don');
  assert.equal(don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null }).length, 2, 'đơn vẫn giữ hàng');
});

test('Page Integrity gỡ khóa; Nhắn bù tất cả → cách nhau ≥ 20 giây; gặp lại khóa thì dừng; quá 7 ngày không gửi', async (t) => {
  const x = await dung(t);
  const fbPage = require('../server/nghiep-vu/fb-page');
  const nhanBu = require('../server/nghiep-vu/nhan-bu');
  const { kiemPages, dsPage } = require('../server/kiem-page');
  x.fb.meta.datCamNhan('page_gia', true);
  for (const ten of ['Trần Hoa', 'Lê Minh', 'Ngô Vy', 'Phạm Yến']) await x.binhLuan(ten, 'chốt 12 đen M');
  const ds = nhanBu.danhSach({ lyDo: 'page_bi_cam', dienTap: null });
  assert.equal(ds.length, 4);
  // Yến bình luận 8 ngày trước (giả): quá hạn nhắn riêng của Meta.
  x.csdl().prepare('UPDATE nhan_bu SET han_luc = ? WHERE id = ?').run(new Date(Date.now() - 86400e3).toISOString(), ds[3].id);

  let kq = await kiemPages(dsPage({ fbGia: x.fb }));
  assert.equal(kq[0].bi_han_che, true);
  assert.ok(fbPage.biCam('page_gia'), 'Meta vẫn khóa');
  x.fb.meta.datCamNhan('page_gia', false);
  kq = await kiemPages(dsPage({ fbGia: x.fb }));
  assert.equal(kq[0].doi, true);
  assert.equal(fbPage.biCam('page_gia'), false, 'hết khóa → gỡ');

  const cho20 = [];
  const ids = nhanBu.danhSach({ lyDo: 'page_bi_cam', dienTap: null }).map((y) => y.id);
  assert.equal(ids.length, 3, 'quá 7 ngày → het_han, không còn trong danh sách');
  // Gửi người thứ nhất xong thì Meta khóa lại → dừng, người thứ ba không gửi.
  const st = await x.chot.nhanBuNhieu(ids, { ngu: async (ms) => { cho20.push(ms); if (cho20.length === 1) x.fb.meta.datCamNhan('page_gia', true); } });
  assert.deepEqual(cho20, [20000, 20000].slice(0, cho20.length));
  assert.ok(cho20.every((ms) => ms >= 20000), 'cách nhau ≥ 20 giây');
  assert.equal(st.da_gui, 1);
  assert.match(st.dung_vi, /vẫn khóa/);
  assert.equal(x.tinCua('Trần Hoa').length, 1, 'người đầu nhận thẻ giữ hàng');
  assert.equal(x.tinCua('Ngô Vy').length, 0, 'dừng trước người thứ ba');
  assert.equal(x.tinCua('Phạm Yến').length, 0, 'quá 7 ngày: không gửi');
});
