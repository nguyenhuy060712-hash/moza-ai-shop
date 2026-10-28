'use strict';

/**
 * Bộ mẫu Utility trạng thái đơn và tin trạng thái do máy soạn (SPEC.md F-98, #120). Facebook giả, AI giả — 0 đồng.
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

async function donCoThongTin(x, ten, sdt) {
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  await x.binhLuan(ten, 'chốt 12 đen M');
  await x.bam(ten, 'Giữ, lên đơn');
  const h = hopThu.layHoiThoai(hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === x.fb.psidCua('page_gia', ten)).id);
  const d0 = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id });
  require('../server/nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: d0, ten, sdt, diaChi: 'Bắc Ninh' });
  return { d: don.layDon(d0.id), h };
}

test('bộ mẫu Utility có 6 mẫu (thêm đã xác nhận, chuẩn bị gửi có 2 nút, hỏi mặc có 3 nút); Facebook giả duyệt; mẫu bị xếp Tiếp thị → không gửi', async (t) => {
  const x = await dung(t);
  const mu = require('../server/nghiep-vu/mau-utility');
  assert.deepEqual(mu.LOAI, ['da_gui', 'cho_xac_nhan', 'da_huy', 'da_xac_nhan', 'chuan_bi_gui', 'hoi_mac']);
  assert.deepEqual(mu.BO.chuan_bi_gui.nut.map((n) => n.payload), ['MAU_GUI_DI', 'MAU_HEN_NGAY']);
  assert.deepEqual(mu.BO.hoi_mac.nut.map((n) => n.tieu_de), ['Vừa lắm', 'Hơi chật', 'Hơi rộng']);
  for (const k of mu.LOAI) assert.doesNotMatch(mu.BO[k].noi_dung, /giảm|khuyến mại|ưu đãi|mua thêm|sale/i, `mẫu ${k} không tiếp thị`);
  x.fb.ketQuaMau = { moza_hoi_mac: 'MARKETING' };
  for (const k of mu.LOAI) await x.fb.taoMauUtility({ page_id: 'page_gia', ten: mu.BO[k].ten, noi_dung: mu.BO[k].noi_dung, nut: mu.BO[k].nut });
  x.fb.meta.bayGio = ((g) => () => g() + 60e3)(x.fb.meta.bayGio.bind(x.fb.meta)); // Meta duyệt sau vài giây
  const tt = {};
  for (const k of mu.LOAI) tt[k] = await x.fb.trangThaiMau({ page_id: 'page_gia', ten: mu.BO[k].ten });
  assert.equal(tt.da_xac_nhan.trang_thai, 'APPROVED');
  assert.equal(tt.chuan_bi_gui.loai, 'UTILITY');
  assert.equal(tt.hoi_mac.loai, 'MARKETING', 'giả Meta xếp tiếp thị');
  // Đơn ngoài 24 giờ: mẫu hỏi mặc bị xếp tiếp thị → không gửi.
  const { d, h } = await donCoThongTin(x, 'Nguyễn Lan', '0912345678');
  x.csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE id = ?').run(new Date(Date.now() - 30 * 3600e3).toISOString(), h.id);
  const kq = await require('../server/gui-the-don').guiTrangThai({ d, loai: 'hoi_mac', layKetNoi: () => x.fb });
  assert.equal(kq.da_gui, false);
  assert.equal(kq.ma, 'MAU_CHUA_DUNG_DUOC');
});

test('báo đã gửi: trong 24 giờ câu mẫu có mã vận đơn (0 AI); ngoài 24 giờ mẫu Utility; người xác nhận trên Đơn hàng → khách nhận "đã xác nhận"; khách DỪNG → không gửi, có việc cho người', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const guiThe = require('../server/gui-the-don');
  const a = await donCoThongTin(x, 'Trần Hoa', '0912000111');
  don.doiTrangThai(a.d.id, 'da_xac_nhan', { nguon: 'nguoi' });
  don.datMaVanDon(a.d.id, 'GHN777');
  don.doiTrangThai(a.d.id, 'da_gui', { nguon: 'nguoi' });
  const ai0 = x.goiAi();
  await x.ht.nhacDon();
  assert.match(chat(x, 'Trần Hoa').at(-1).noi_dung, /đơn DH-\d{4} của bạn đã gửi đi rồi, mã vận đơn GHN777/);
  assert.equal(x.goiAi(), ai0, '0 lượt AI');
  // Ngoài 24 giờ → Utility.
  const b = await donCoThongTin(x, 'Lê Mai', '0912000222');
  don.doiTrangThai(b.d.id, 'da_xac_nhan', { nguon: 'nguoi' });
  don.doiTrangThai(b.d.id, 'da_gui', { nguon: 'nguoi' });
  x.csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE nguoi_fb_id = ?').run(new Date(Date.now() - 30 * 3600e3).toISOString(), b.d.nguoi_fb_id);
  await x.ht.nhacDon();
  assert.ok(chat(x, 'Lê Mai').at(-1).utility, 'mẫu Utility');
  // Người xác nhận (sau cuộc gọi) → "đã xác nhận" bằng câu mẫu.
  const c = await donCoThongTin(x, 'Phan Thu', '0912000333');
  const kq = await guiThe.guiTrangThai({ d: don.doiTrangThai(c.d.id, 'da_xac_nhan', { nguon: 'nguoi' }), loai: 'da_xac_nhan', layKetNoi: () => x.fb,
    chu: require('../server/nghiep-vu/cau-mau-khach').cau('tt_da_xac_nhan', { ma: c.d.ma, tong: '159.000đ' }) });
  assert.equal(kq.cach, 'cau_mau');
  assert.match(chat(x, 'Phan Thu').at(-1).noi_dung, /đã được xác nhận, tổng 159\.000đ/);
  // DỪNG → không gửi, việc cho người.
  const e = await donCoThongTin(x, 'Vũ An', '0912000444');
  require('../server/nghiep-vu/lien-he').datNgung(e.d.nguoi_fb_id);
  const truoc = chat(x, 'Vũ An').length;
  const kq2 = await guiThe.guiTrangThai({ d: e.d, loai: 'da_gui', layKetNoi: () => x.fb, chu: 'x' });
  assert.equal(kq2.da_gui, false);
  assert.ok(kq2.viec);
  assert.equal(chat(x, 'Vũ An').length, truoc);
  assert.equal(x.csdl().prepare("SELECT COUNT(*) AS n FROM viec WHERE loai = 'goi_khach' AND don_id = ?").get(e.d.id).n, 1);
});
