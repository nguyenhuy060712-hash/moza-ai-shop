'use strict';

/**
 * Khách mặc thật (SPEC.md F-104, tắt mặc định): xin phép bằng nút, tải ảnh khi đồng ý, che mặt + người duyệt, tối đa 4 ảnh lên Màn hình sản phẩm, "gỡ ảnh" gỡ ngay. Không lời gọi AI nào có ảnh khách. Facebook giả, AI giả — 0 đồng.
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
const fs = require('node:fs');
const path = require('node:path');
const { ANH_GIA } = require('./ho-tro');

/** Khách nhắn Page, có đơn Đã gửi (lùi `ngay` ngày). */
async function khachCoDon(x, ten, { ngay = 2 } = {}) {
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  x.fb.khachNhan({ ten, noi_dung: 'shop ơi' });
  await cho(20); await x.ht.choXong();
  const h = hopThu.layHoiThoai(hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === x.fb.psidCua('page_gia', ten)).id);
  const d = don.taoDon({ mon: [{ phan_loai_id: x.mau.pl('Đen', 'M').id }], nguon: 'tin_nhan', nguoiFbId: h.nguoi_fb_id, hoiThoaiId: h.id, tenNhan: ten, sdtNhan: '+84912345678', diaChiNhan: '12 Lý Thái Tổ, Bắc Ninh', dienTap: true });
  don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'nguoi' });
  don.doiTrangThai(d.id, 'da_gui', { nguon: 'nguoi' });
  x.csdl().prepare("UPDATE don_lich_su SET luc = ? WHERE don_id = ? AND den = 'da_gui'").run(new Date(Date.now() - ngay * 86400e3).toISOString(), d.id);
  return { h, d };
}

async function guiAnh(x, ten, chu = '') {
  const tep = require('../server/nghiep-vu/san-pham').luuAnhTam(ANH_GIA);
  x.fb.khachNhan({ ten, noi_dung: chu, anh: tep });
  await cho(20); await x.ht.choXong();
  return tep;
}
const tuThuMuc = () => { const d = path.join(require('../server/db/ket-noi').thuMucDuLieu(), 'anh-khach'); return fs.existsSync(d) ? fs.readdirSync(d) : []; };
const XIN = /Shop xin phép dùng ảnh này/;

test('công tắc TẮT (mặc định): khách gửi ảnh → không xin phép, không lưu dòng, không lưu tệp; màn hình "Khách mặc thật" báo đang tắt', async (t) => {
  const x = await dung(t);
  const ak = require('../server/nghiep-vu/anh-khach');
  await khachCoDon(x, 'Lan');
  await guiAnh(x, 'Lan');
  assert.ok(!chat(x, 'Lan').some((y) => XIN.test(y.noi_dung)));
  assert.equal(x.csdl().prepare('SELECT COUNT(*) AS n FROM anh_khach').get().n, 0);
  assert.deepEqual(tuThuMuc(), []);
  assert.equal(ak.choDuyet().length, 0);
  assert.throws(() => require('../server/man-hinh-san-pham').dung({ mau: 'khach_mac', so: 12 }), (e) => e.ma === 'TINH_NANG_TAT');
});

test('BẬT: 2 ảnh trong 2 phút → 1 lần xin phép (0 AI); Đồng ý → lưu tệp, chờ duyệt, chưa lên màn hình; duyệt ảnh đã che → ghi đè gốc, "Khách thật · mặc size M"; AI không bao giờ nhận ảnh', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ dung_anh_khach: true });
  const ak = require('../server/nghiep-vu/anh-khach');
  const mh = require('../server/man-hinh-san-pham');
  await khachCoDon(x, 'Lan');
  const ai0 = x.goiAi();
  await guiAnh(x, 'Lan');
  await guiAnh(x, 'Lan');
  assert.equal(x.goiAi(), ai0, 'tin chỉ có ảnh: không gọi AI');
  const xin = chat(x, 'Lan').filter((y) => XIN.test(y.noi_dung));
  assert.equal(xin.length, 1, 'gom 2 ảnh vào 1 lần hỏi');
  assert.deepEqual(xin[0].nut.map((n) => n.tieu_de), ['Đồng ý', 'Không']);
  const dong = x.csdl().prepare('SELECT * FROM anh_khach').all();
  assert.equal(dong.length, 2);
  assert.ok(dong.every((a) => a.cau_xin_phep === xin[0].noi_dung.replace(/\s*\[Nút:.*$/s, '') || XIN.test(a.cau_xin_phep)), 'lưu nguyên văn câu xin phép');
  assert.deepEqual(tuThuMuc(), [], 'chưa đồng ý: chưa tải ảnh');
  // Tìm mẫu theo ảnh không được lấy ảnh này.
  const tin = require('../server/nghiep-vu/hop-thu').layTin(dong[0].tin_nhan_id);
  await assert.rejects(require('../server/agent/agents/tim-mau').timMauTheoAnh(tin, { dienTap: true }), (e) => e.ma === 'ANH_KHACH');
  await x.bam('Lan', 'Đồng ý');
  assert.match(chat(x, 'Lan').at(-1).noi_dung, /Cảm ơn bạn nhiều! Shop che mặt/);
  const cho1 = ak.choDuyet();
  assert.equal(cho1.length, 2);
  assert.ok(x.csdl().prepare('SELECT * FROM anh_khach').all().every((a) => a.dong_y_luc && a.tin_dong_y_id));
  assert.equal(tuThuMuc().length, 2);
  assert.equal(cho1[0].san_pham_id, x.mau.san_pham.id, 'đơn một món → gợi ý đúng món');
  assert.equal(cho1[0].co, 'M');
  assert.throws(() => mh.dung({ mau: 'khach_mac', so: 12 }), (e) => e.ma === 'KHONG_CO_ANH', 'ảnh chưa duyệt không lên màn hình');
  const daChe = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 9)]);
  ak.duyet(cho1[0].id, { anh: daChe, cheMat: 40, sanPhamId: x.mau.san_pham.id, co: 'M' });
  assert.ok(fs.readFileSync(ak.tepCua(cho1[0].id)).equals(daChe), 'ảnh đã che ghi đè tệp gốc');
  const hien = mh.dung({ mau: 'khach_mac', so: 12 });
  assert.equal(hien.anh_khach.length, 1);
  assert.equal(hien.anh_khach[0].chu, 'Khách thật · mặc size M');
  // Chỉ xét chữ hiện ra (mã ảnh trong url là ngẫu nhiên, có lúc chứa "cm" / "kg" → test hỏng ngẫu nhiên).
  assert.doesNotMatch(JSON.stringify(hien.anh_khach.map((a) => a.chu)), /Lan|\d\s*cm|\d\s*kg/, 'không tên, không số đo');
  assert.deepEqual(mh.docLenh('Mai ơi chiếu ảnh khách mặc áo 12'), { chieu: { mau: 'khach_mac', so: 12, mau_sac: null }, canh: 'san_pham' });
  assert.throws(() => ak.duyet(cho1[1].id, { anh: daChe, cheMat: 80, sanPhamId: x.mau.san_pham.id }), /0 đến 60/);
});

test('"gỡ ảnh": gỡ khỏi màn hình ngay, xóa tệp, câu mẫu, 0 AI; Không → không lưu; ảnh hết hạn → báo lỗi, không vào chờ duyệt; không có đơn gửi trong 30 ngày → không hỏi; xóa dữ liệu người → xóa ảnh', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang({ dung_anh_khach: true });
  const ak = require('../server/nghiep-vu/anh-khach');
  const mh = require('../server/man-hinh-san-pham');
  const { h, d: lanDon } = await khachCoDon(x, 'Lan');
  await guiAnh(x, 'Lan');
  await x.bam('Lan', 'Đồng ý');
  const a = ak.choDuyet()[0];
  ak.duyet(a.id, { anh: ANH_GIA, cheMat: 35, sanPhamId: x.mau.san_pham.id, co: 'M' });
  assert.equal(mh.dung({ mau: 'khach_mac', so: 12 }).anh_khach.length, 1);
  // Màn hình đang chiếu ảnh này lúc khách xin gỡ → đổi ngay sang giới thiệu món.
  const { EventEmitter } = require('node:events');
  const bus = new EventEmitter();
  const moi = [];
  const man = new mh.ManHinhSanPham({ phat: (type, d) => moi.push({ type, ...d }), bus, obs: Object.assign(new EventEmitter(), { trangThai: () => ({ ket_noi: true }), noi: async () => ({}), dong() {}, async chuyenCanh() { return ''; } }) });
  t.after(() => man.dong());
  man.chieu({ mau: 'khach_mac', so: 12 });
  assert.equal(man.hien.mau, 'khach_mac');
  const ai0 = x.goiAi();
  x.fb.khachNhan({ ten: 'Lan', noi_dung: 'shop gỡ ảnh của em đi nha' });
  await cho(20); await x.ht.choXong();
  assert.equal(x.goiAi(), ai0, '0 AI');
  assert.match(chat(x, 'Lan').at(-1).noi_dung, /shop gỡ ảnh của bạn rồi/);
  assert.equal(ak.tepCua(a.id), null);
  assert.deepEqual(tuThuMuc(), [], 'tệp đã xóa');
  assert.throws(() => mh.dung({ mau: 'khach_mac', so: 12 }), (e) => e.ma === 'KHONG_CO_ANH');
  bus.emit('su_kien', 'anh_khach.cap_nhat', {});
  await cho(20);
  assert.equal(man.hien.mau, 'gioi_thieu', 'đang chiếu → gỡ khỏi màn hình ngay');
  // Không → không lưu.
  await khachCoDon(x, 'Hoa');
  await guiAnh(x, 'Hoa');
  await x.bam('Hoa', 'Không');
  assert.match(chat(x, 'Hoa').at(-1).noi_dung, /shop không dùng ảnh của bạn/);
  assert.deepEqual(tuThuMuc(), []);
  // Ảnh hết hạn trước khi bấm Đồng ý.
  await khachCoDon(x, 'Trâm');
  const tep = await guiAnh(x, 'Trâm');
  fs.unlinkSync(require('../server/nghiep-vu/san-pham').duongAnh('tam', tep));
  await x.bam('Trâm', 'Đồng ý');
  assert.match(chat(x, 'Trâm').at(-1).noi_dung, /chưa tải được ảnh/);
  assert.equal(ak.choDuyet().length, 0, 'không chờ duyệt ảnh hỏng');
  // Đơn gửi quá 30 ngày → không hỏi.
  await khachCoDon(x, 'Vy', { ngay: 31 });
  await guiAnh(x, 'Vy');
  assert.ok(!chat(x, 'Vy').some((y) => XIN.test(y.noi_dung)));
  // Xóa dữ liệu người → xóa luôn ảnh.
  await guiAnh(x, 'Lan');
  await x.bam('Lan', 'Đồng ý');
  assert.equal(tuThuMuc().length, 1);
  require('../server/nghiep-vu/don').doiTrangThai(lanDon.id, 'da_giao', { nguon: 'nguoi' });
  require('../server/nghiep-vu/khach').xoaDuLieuNguoi(h.nguoi_fb_id);
  assert.deepEqual(tuThuMuc(), []);
  assert.equal(x.csdl().prepare('SELECT COUNT(*) AS n FROM anh_khach WHERE nguoi_fb_id = ?').get(h.nguoi_fb_id).n, 0);
});
