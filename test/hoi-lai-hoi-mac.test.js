'use strict';

/**
 * Hỏi lại đơn trước khi gửi (máy đánh dấu, người quyết) và hỏi thăm sau khi gửi (SPEC.md F-99, F-100, #120). Facebook giả, AI giả — 0 đồng.
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
const moKhung = () => { const lh = require('../server/nghiep-vu/lien-he'); lh.MAC.gio_tu = 0; lh.MAC.gio_den = 24; };
/** Lần tới 11:00 giờ VN, cách bây giờ ít nhất `sauGio` giờ. */
function luc11(sauGio = 2.5) {
  const vn = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  let t = new Date(`${vn}T11:00:00+07:00`).getTime();
  while (t < Date.now() + sauGio * 3600e3) t += 86400e3;
  return t;
}

async function donCuaKhach(x, ten, sdt, { sl = 1, loai = 'đen M' } = {}) {
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  await x.binhLuan(ten, `chốt 12 ${loai}${sl > 1 ? ` x${sl}` : ''}`);
  await x.bam(ten, 'Giữ, lên đơn');
  const h = hopThu.layHoiThoai(hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === x.fb.psidCua('page_gia', ten)).id);
  const d0 = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id });
  require('../server/nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: d0, ten, sdt, diaChi: 'Bắc Ninh' });
  return don.layDon(d0.id);
}

test('"Nên hỏi lại" chỉ từ lịch sử đơn: khách mới COD ≥ ngưỡng → có; khách từng giao → không; từng hoàn 1 → có, hoàn 2 (ngưỡng #73) → không', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const don = require('../server/nghiep-vu/don');
  const kh = require('../server/nghiep-vu/khach');
  const { csdl } = require('../server/db/ket-noi');
  const mau = taoSanPhamMau({ gia: '325k', ton: 30 });
  const k = kh.taoKhach({ ten: 'Lan', sdt: '0912345678', dongY: true }).khach;
  const tao = (khachId, sl = 2) => don.taoDon({ mon: [{ phan_loai_id: mau.pl('Đen', 'M').id, so_luong: sl }], nguon: 'nguoi', khachId, tenNhan: 'A', sdtNhan: '+84912345678', diaChiNhan: 'BN' });
  const d = tao(k.id); // 650.000đ, COD
  assert.deepEqual(don.mucHoiLai(d), { nen: true, ly_do: 'khách mới · COD · 650.000đ' });
  assert.equal(don.mucHoiLai(tao(k.id, 1)).nen, false, '325.000đ dưới ngưỡng 500.000đ');
  const giao = tao(k.id); csdl().prepare("UPDATE don SET trang_thai = 'da_giao' WHERE id = ?").run(giao.id);
  assert.equal(don.mucHoiLai(d).nen, false, 'khách đã có đơn Đã giao');
  const k2 = kh.taoKhach({ ten: 'Hoa', sdt: '0912000111', dongY: true }).khach;
  const d2 = tao(k2.id, 1);
  const h1 = tao(k2.id, 1); csdl().prepare("UPDATE don SET trang_thai = 'hoan' WHERE id = ?").run(h1.id);
  assert.deepEqual(don.mucHoiLai(d2), { nen: true, ly_do: 'từng hoàn 1 đơn' });
  const h2 = tao(k2.id, 1); csdl().prepare("UPDATE don SET trang_thai = 'hoan' WHERE id = ?").run(h2.id);
  assert.equal(don.mucHoiLai(d2).nen, false, 'từ ngưỡng #73 đã có việc Gọi xác nhận');
  const ck = tao(kh.taoKhach({ ten: 'Mai', sdt: '0912000222', dongY: true }).khach.id);
  don.datThongTinGiao(ck.id, { thanhToan: 'chuyen_khoan' });
  assert.equal(don.mucHoiLai(don.layDon(ck.id)).nen, false, 'chuyển khoản không đánh dấu');
});

test('hỏi lại: sau 2 giờ, 8h–21h → thẻ [Gửi đi] [Hẹn ngày khác]; Gửi đi → dong_y + lịch sử; Hẹn ngày → việc; im lặng 24 giờ → việc gọi, đơn giữ nguyên; không chữ "rủi ro"', async (t) => {
  const x = await dung(t);
  moKhung();
  const don = require('../server/nghiep-vu/don');
  const d = await donCuaKhach(x, 'Nguyễn Lan', '0912345678', { sl: 5 }); // 795.000đ
  don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'nguoi' });
  await x.ht.hoiLaiDon(Date.now() + 30 * 60e3);
  assert.ok(!chat(x, 'Nguyễn Lan').some((y) => /chuẩn bị gửi/.test(y.noi_dung)), 'chưa đủ 2 giờ');
  const t11 = luc11();
  await x.ht.hoiLaiDon(t11);
  const the = chat(x, 'Nguyễn Lan').at(-1);
  assert.match(the.noi_dung, /shop chuẩn bị gửi đơn DH-\d{4} \(\d{1,3}(\.\d{3})*đ\) cho bạn\. Bạn nhận hàng trong tuần này được không\?/);
  assert.deepEqual(the.nut.map((n) => n.tieu_de), ['Gửi đi', 'Hẹn ngày khác']);
  await x.ht.hoiLaiDon(t11 + 60e3);
  assert.equal(chat(x, 'Nguyễn Lan').filter((y) => /chuẩn bị gửi/.test(y.noi_dung)).length, 1, 'chỉ hỏi một lần');
  await x.bam('Nguyễn Lan', 'Gửi đi');
  assert.equal(don.layDon(d.id).hoi_lai, 'dong_y');
  assert.ok(don.lichSu(d.id).some((l) => /Gửi đi/.test(l.ghi_chu || '')));
  // Người thứ hai: Hẹn ngày khác. Người thứ ba: im lặng 24 giờ.
  const d2 = await donCuaKhach(x, 'Trần Hoa', '0912000111', { sl: 5, loai: 'trắng M' });
  don.doiTrangThai(d2.id, 'da_xac_nhan', { nguon: 'nguoi' });
  const d3 = await donCuaKhach(x, 'Lê Mai', '0912000222', { sl: 5, loai: 'đen L' });
  don.doiTrangThai(d3.id, 'da_xac_nhan', { nguon: 'nguoi' });
  x.csdl().prepare("DELETE FROM lien_he WHERE loai = 'cham_soc'").run();
  await x.ht.hoiLaiDon(t11 + 3 * 3600e3);
  await x.bam('Trần Hoa', 'Hẹn ngày khác');
  assert.equal(don.layDon(d2.id).hoi_lai, 'hen_ngay');
  assert.equal(x.csdl().prepare("SELECT COUNT(*) AS n FROM viec WHERE loai = 'hen_ngay_gui' AND don_id = ?").get(d2.id).n, 1);
  x.csdl().prepare('UPDATE don SET hoi_lai_luc = ? WHERE id = ?').run(new Date(Date.now() - 25 * 3600e3).toISOString(), d3.id);
  await x.ht.hoiLaiDon(Date.now());
  assert.equal(don.layDon(d3.id).hoi_lai, 'khong_tra_loi');
  assert.equal(don.layDon(d3.id).trang_thai, 'da_xac_nhan', 'không tự hủy');
  assert.match(x.csdl().prepare("SELECT noi_dung FROM viec WHERE loai = 'goi_xac_nhan_don' AND don_id = ?").get(d3.id).noi_dung, /chưa trả lời tin hỏi lại/);
  // Không chữ "rủi ro" / "bom hàng" ở mọi câu mẫu gửi khách.
  const cm = require('../server/nghiep-vu/cau-mau-khach');
  assert.ok(cm.tatCa().every((x2) => !/rủi ro|bom hàng/i.test(x2.cau)));
});

test('hỏi thăm: đơn Đã gửi 96 giờ, 11h → thẻ 3 nút; 72 giờ → chưa; Hơi chật → trích Sổ tay "Đổi trả" + việc Đổi size, 0 AI; Hoàn / DỪNG → không hỏi; không từ bán thêm', async (t) => {
  const x = await dung(t);
  moKhung();
  const don = require('../server/nghiep-vu/don');
  const soTay = require('../server/nghiep-vu/so-tay');
  const doiTra = soTay.danhSachMuc().find((m) => m.tieu_de === 'Đổi trả');
  soTay.suaMuc(doiTra.id, { noi_dung: 'Shop cho đổi size trong 3 ngày nếu chưa giặt. Khách trả phí ship hai chiều.' });
  const gui = async (ten, sdt, loai) => { const d = await donCuaKhach(x, ten, sdt, { loai }); don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'nguoi' }); don.guiNhieu([{ id: d.id }]); return don.layDon(d.id); };
  const d = await gui('Nguyễn Lan', '0912345678');
  const luiGui = (id, gio) => x.csdl().prepare("UPDATE don_lich_su SET luc = ? WHERE don_id = ? AND den = 'da_gui'").run(new Date(Date.now() - gio * 3600e3).toISOString(), id);
  luiGui(d.id, 72);
  const t11 = luc11(0);
  await x.ht.hoiMac(t11 < Date.now() ? t11 + 86400e3 : t11);
  const truoc = chat(x, 'Nguyễn Lan').filter((y) => /mặc thấy sao/.test(y.noi_dung)).length;
  luiGui(d.id, 96 + 24);
  await x.ht.hoiMac(t11);
  const ds = chat(x, 'Nguyễn Lan').filter((y) => /mặc thấy sao/.test(y.noi_dung));
  assert.equal(ds.length, truoc + 1);
  assert.deepEqual(ds.at(-1).nut.map((n) => n.tieu_de), ['Vừa lắm', 'Hơi chật', 'Hơi rộng']);
  const ai0 = x.goiAi();
  await x.bam('Nguyễn Lan', 'Hơi chật');
  const tl = chat(x, 'Nguyễn Lan').at(-1).noi_dung;
  assert.match(tl, /Shop cho đổi size trong 3 ngày nếu chưa giặt\./);
  assert.match(tl, /Nhân viên shop nhắn bạn ngay/);
  assert.equal(don.layDon(d.id).phan_hoi_mac, 'chat');
  assert.equal(x.csdl().prepare("SELECT COUNT(*) AS n FROM viec WHERE loai = 'doi_size' AND don_id = ?").get(d.id).n, 1);
  assert.equal(x.goiAi(), ai0, '0 lượt AI');
  // Hoàn, DỪNG → không hỏi.
  const e = await gui('Trần Hoa', '0912000111', 'trắng M');
  don.doiTrangThai(e.id, 'hoan', { nguon: 'nguoi' });
  const f = await gui('Lê Mai', '0912000222', 'đen L');
  require('../server/nghiep-vu/lien-he').datNgung(f.nguoi_fb_id);
  luiGui(e.id, 120); luiGui(f.id, 120);
  await x.ht.hoiMac(t11);
  assert.ok(!chat(x, 'Trần Hoa').some((y) => /mặc thấy sao/.test(y.noi_dung)), 'đơn Hoàn');
  assert.ok(!chat(x, 'Lê Mai').some((y) => /mặc thấy sao/.test(y.noi_dung)), 'khách DỪNG');
  const cm = require('../server/nghiep-vu/cau-mau-khach');
  for (const k of ['hoi_mac', 'mac_vua', 'mac_doi']) assert.doesNotMatch(cm.cau(k, { ma: 'DH-0001', doi_tra: '' }), /mua thêm|ưu đãi|giảm|(?<![\p{L}])mã(?![\p{L}])|quà/iu, k);
});

test('"X/Y khách nói vừa": chỉ từ 10 phản hồi thật (không diễn tập), có cả số không vừa', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const don = require('../server/nghiep-vu/don');
  const bc = require('../server/nghiep-vu/bao-cao');
  const mau = taoSanPhamMau({ ton: 50 });
  const tao = (kieu, dienTap = false) => { const d = don.taoDon({ mon: [{ phan_loai_id: mau.pl('Đen', 'M').id }], nguon: 'nguoi', dienTap }); don.ghiPhanHoiMac(d.id, kieu); };
  for (let i = 0; i < 7; i++) tao('vua');
  tao('chat'); tao('rong');
  for (let i = 0; i < 5; i++) tao('vua', true);
  assert.deepEqual(bc.phanHoiMac(mau.san_pham.id), { vua: 7, tong: 9, chu: null }, 'chưa đủ 10, diễn tập không tính');
  tao('chat');
  assert.equal(bc.phanHoiMac(mau.san_pham.id).chu, '7/10 khách nói vừa');
  assert.equal(require('../server/man-hinh-san-pham').theSanPham(require('../server/nghiep-vu/san-pham').laySanPham(mau.san_pham.id)).vua_size, '7/10 khách nói vừa');
});
