'use strict';

/**
 * Báo live cho người đã đồng ý — xin từng buổi, trong 24 giờ; Thôi 7 ngày; DỪNG rút đồng ý; rải tin (SPEC.md F-97, #117). Facebook giả, AI giả — 0 đồng.
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

/** Lịch: một buổi sau khoảng `gio` giờ (làm tròn xuống 30 phút, giờ VN). */
function coBuoiSau(gio) {
  const t = new Date(Date.now() + gio * 3600e3 + 7 * 3600e3);
  const p = t.getUTCHours() * 60 + (t.getUTCMinutes() >= 30 ? 30 : 0);
  const hh = Math.max(360, Math.min(1410, p));
  const g = `${String(Math.floor(hh / 60)).padStart(2, '0')}:${String(hh % 60).padStart(2, '0')}`;
  require('../server/nghiep-vu/lich-live').datLich({ buoi: [{ thu: t.getUTCDay(), gio: g }] });
  return require('../server/nghiep-vu/lich-live').buoiKe();
}
const moKhung = () => { const lh = require('../server/nghiep-vu/lien-he'); lh.MAC.gio_tu = 0; lh.MAC.gio_den = 24; };
const binhLuanBai = async (x, ten, noiDung) => { x.fb.meta.binhLuanBai({ pageId: 'page_gia', ten, noiDung }); await cho(40); await x.ht.choXong(); };

test('bình luận "hóng quá" dưới bài đăng (buổi sau 5 giờ) → nhắn riêng thẻ 2 nút, 0 AI; "áo 12 còn M không" → Tư vấn viên, không thẻ mời; bình luận của live → không bao giờ mời', async (t) => {
  const x = await dung(t);
  moKhung();
  const ke = coBuoiSau(5);
  assert.ok(ke && new Date(ke.luc) - Date.now() < 23 * 3600e3, 'buổi trong 23 giờ tới');
  const ai0 = x.goiAi();
  await binhLuanBai(x, 'Nguyễn Lan', 'hóng quá shop ơi');
  const moi = chat(x, 'Nguyễn Lan').at(-1);
  assert.ok(moi?.nhan_rieng, 'nhắn riêng bình luận');
  assert.match(moi.noi_dung, /live \d+ mẫu mới\. Shop gửi bạn 1 tin Messenger lúc lên sóng được không\? Tin tự động từ trợ lý AI/);
  assert.deepEqual(moi.nut.map((n) => n.tieu_de), ['Báo em buổi này', 'Thôi']);
  assert.equal(x.goiAi(), ai0, '0 lượt AI');
  await binhLuanBai(x, 'Trần Hoa', 'áo 12 còn M không');
  assert.ok(!chat(x, 'Trần Hoa').some((y) => /lúc lên sóng/.test(y.noi_dung)), 'câu hỏi → không thẻ mời');
  assert.ok(x.goiAi() > ai0, 'câu hỏi đi Tư vấn viên');
  // Bình luận thuộc live (post_id = {page}_{video}) → Hộp thư bỏ qua (phòng live đã nhận).
  const p = require('../server/nghiep-vu/live').layPhien(x.p.id);
  const r = await x.ht.nhan({ loai: 'binh_luan_bai', page_id: 'page_gia', comment_id: 'cmt_live_1', nguoi_id: 'u_live', ten: 'Người Xem Live', noi_dung: 'hóng quá', post_id: `page_gia_${p.fb_video_id}`, luc: new Date().toISOString() }, true);
  assert.equal(r, null);
  assert.equal(x.csdl().prepare("SELECT COUNT(*) AS n FROM dong_y_nhan_tin").get().n, 1, 'chỉ 1 lời mời (Lan)');
});

test('bấm "Báo em buổi này" → lưu nguyên văn câu hỏi + giờ bấm; live bắt đầu đúng giờ → 1 tin có link + "Gõ DỪNG"; bấm lúc T, live lúc T + 25 giờ → không gửi, ghi lý do', async (t) => {
  const x = await dung(t);
  moKhung();
  const ke = coBuoiSau(5);
  await binhLuanBai(x, 'Nguyễn Lan', 'hóng');
  const moi = chat(x, 'Nguyễn Lan').at(-1);
  await x.bam('Nguyễn Lan', 'Báo em buổi này');
  assert.match(chat(x, 'Nguyễn Lan').at(-1).noi_dung, /lúc lên sóng mình nhắn bạn 1 tin có link\. Không muốn nhận thì gõ DỪNG/);
  const d = x.csdl().prepare('SELECT * FROM dong_y_nhan_tin').get();
  assert.equal(d.cau_hoi, moi.the.chu, 'nguyên văn câu hỏi');
  assert.equal(d.tra_loi, 'dong_y');
  assert.ok(d.tra_loi_luc && d.tin_tra_loi_id, 'giờ bấm, tin bấm');
  assert.equal(d.buoi, ke.luc);
  const pGia = { id: x.p.id, dien_tap: true, bat_dau_fb: new Date(new Date(ke.luc).getTime() + 3 * 60e3).toISOString(), fb_link: 'https://facebook.com/live-gia/123' };
  const kq = await x.ht.nhacLive(pGia, { cachMs: 0, ngu: async () => {} });
  assert.equal(kq.gui, 1);
  assert.match(chat(x, 'Nguyễn Lan').at(-1).noi_dung, /^Lan ơi, .* lên sóng rồi: https:\/\/facebook\.com\/live-gia\/123\. Gõ DỪNG để không nhận tin nhắc\.$/);
  assert.equal((await x.ht.nhacLive(pGia, { cachMs: 0, ngu: async () => {} })).gui, 0, 'không nhắn lần hai');
  // Người thứ hai bấm, nhưng live bắt đầu 25 giờ sau lúc bấm → không gửi.
  await binhLuanBai(x, 'Trần Hoa', 'hóng hàng');
  await x.bam('Trần Hoa', 'Báo em buổi này');
  x.csdl().prepare("UPDATE dong_y_nhan_tin SET tra_loi_luc = ?, nhac_luc = NULL WHERE nguoi_fb_id != ?").run(new Date(Date.now() - 25 * 3600e3).toISOString(), d.nguoi_fb_id);
  const truoc = chat(x, 'Trần Hoa').length;
  const kq2 = await x.ht.nhacLive(pGia, { cachMs: 0, ngu: async () => {} });
  assert.equal(kq2.qua_24, 1);
  assert.equal(chat(x, 'Trần Hoa').length, truoc);
  assert.equal(x.csdl().prepare('SELECT nhac_ly_do FROM dong_y_nhan_tin WHERE nguoi_fb_id != ?').get(d.nguoi_fb_id).nhac_ly_do, 'quá 24 giờ kể từ lúc bấm');
  // Live lệch lịch quá 60 phút → không khớp buổi, không gửi.
  assert.equal((await x.ht.nhacLive({ ...pGia, bat_dau_fb: new Date(new Date(ke.luc).getTime() + 90 * 60e3).toISOString() })).gui, 0);
});

test('bấm "Thôi" → không nhận tin, 7 ngày không mời lại; gõ DỪNG → rút đồng ý; khách hỏi "tối nay mấy giờ live" → câu mẫu + mời, 0 AI; mời sau khi xác nhận đơn', async (t) => {
  const x = await dung(t);
  moKhung();
  const ke = coBuoiSau(4);
  const dongY = require('../server/nghiep-vu/dong-y');
  await binhLuanBai(x, 'Lê Mai', 'hóng');
  await x.bam('Lê Mai', 'Thôi');
  assert.match(chat(x, 'Lê Mai').at(-1).noi_dung, /không nhắn/);
  const nguoiMai = x.csdl().prepare("SELECT nguoi_fb_id FROM dong_y_nhan_tin WHERE tra_loi = 'thoi'").get().nguoi_fb_id;
  assert.equal(dongY.coTheMoi(nguoiMai, new Date(Date.now() + 3 * 86400e3).toISOString(), Date.now() + 3 * 86400e3 - 3600e3).duoc, false, 'trong 7 ngày không mời lại');
  // Messenger hỏi lịch → câu mẫu (0 AI) + thẻ mời.
  x.fb.khachNhan({ ten: 'Phan Thu', noi_dung: 'tối nay mấy giờ live vậy shop' });
  await cho(40); await x.ht.choXong();
  const ds = chat(x, 'Phan Thu');
  assert.ok(ds.some((y) => /^Dạ Shop live .* hằng tuần; buổi kế /.test(y.noi_dung)), JSON.stringify(ds.map((y) => y.noi_dung)));
  assert.ok(ds.some((y) => y.nut.some((n) => n.tieu_de === 'Báo em buổi này')));
  assert.equal(x.goiAi(), 0, 'hỏi lịch không gọi AI');
  await x.bam('Phan Thu', 'Báo em buổi này');
  x.fb.khachNhan({ ten: 'Phan Thu', noi_dung: 'DỪNG' });
  await cho(40); await x.ht.choXong();
  const dThu = x.csdl().prepare("SELECT * FROM dong_y_nhan_tin WHERE tra_loi = 'dong_y'").get();
  assert.ok(dThu.rut_luc, 'DỪNG rút đồng ý');
  assert.equal(dongY.canNhac(ke.luc).nhan.length, 0);
  // Chỗ mời c: sau khi khách bấm Xác nhận đơn.
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan('Vũ An', 'chốt 12 đen M');
  await x.bam('Vũ An', 'Giữ, lên đơn');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const h = hopThu.layHoiThoai(hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === x.fb.psidCua('page_gia', 'Vũ An')).id);
  const d0 = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id });
  require('../server/nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: d0, ten: 'Vũ An', sdt: '0912000555', diaChi: 'Bắc Ninh' });
  await require('../server/gui-the-don').guiTheDon({ d: don.layDon(d0.id), layKetNoi: () => x.fb });
  await x.bam('Vũ An', '✅ Xác nhận đơn');
  assert.ok(chat(x, 'Vũ An').at(-1).nut.some((n) => n.tieu_de === 'Báo em buổi này'), 'mời sau tin cảm ơn');
});

test('30 người đồng ý → rải tin: chờ 3 giây giữa hai tin (≤ 20 tin / phút)', async (t) => {
  const x = await dung(t);
  moKhung();
  const ke = coBuoiSau(3);
  const dongY = require('../server/nghiep-vu/dong-y');
  for (let i = 0; i < 30; i++) {
    const d = dongY.taoLoiMoi({ nguoiFbId: `nfb_test_${i}`, buoi: ke.luc, cauHoi: 'x', dienTap: true });
    dongY.traLoi(d.id, `nfb_test_${i}`, 'dong_y', null);
  }
  const cho3 = [];
  await x.ht.nhacLive({ id: x.p.id, dien_tap: true, bat_dau_fb: ke.luc, fb_link: 'https://x' }, { ngu: async (ms) => { cho3.push(ms); } });
  assert.equal(cho3.length, 29);
  assert.ok(cho3.every((ms) => ms === 3000));
  assert.ok(60000 / 3000 <= 20);
});

test('xóa dữ liệu người chưa có hồ sơ khách: nội dung tin, tên hiển thị, đồng ý đều xóa; báo cáo vẫn đúng số đơn; còn đơn mở → phải hủy trước', async (t) => {
  const x = await dung(t);
  moKhung();
  coBuoiSau(5);
  const kh = require('../server/nghiep-vu/khach');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  x.fb.khachNhan({ ten: 'Người Lạ', noi_dung: 'shop ơi áo đẹp quá' });
  await cho(40); await x.ht.choXong();
  const h = hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === x.fb.psidCua('page_gia', 'Người Lạ'));
  require('../server/nghiep-vu/dong-y').taoLoiMoi({ nguoiFbId: h.nguoi_fb_id, buoi: new Date(Date.now() + 3600e3).toISOString(), cauHoi: 'x', dienTap: true });
  const soDon = require('../server/nghiep-vu/don').danhSach({ dienTap: null }).length;
  kh.xoaDuLieuNguoi(h.nguoi_fb_id);
  assert.ok(hopThu.tinCuaHoiThoai(h.id).every((y) => !/áo đẹp quá/.test(y.noi_dung)), 'nội dung tin đã xóa');
  assert.equal(hopThu.layNguoi(h.nguoi_fb_id).ten_hien_thi, '');
  assert.equal(x.csdl().prepare('SELECT COUNT(*) AS n FROM dong_y_nhan_tin WHERE nguoi_fb_id = ?').get(h.nguoi_fb_id).n, 0);
  assert.equal(require('../server/nghiep-vu/don').danhSach({ dienTap: null }).length, soDon);
  await x.binhLuan('Có Đơn', 'chốt 12 đen M');
  const d = require('../server/nghiep-vu/don').danhSach({ trangThai: 'cho_xac_nhan', dienTap: null })[0];
  assert.throws(() => kh.xoaDuLieuNguoi(d.nguoi_fb_id), /còn đơn chưa xong/);
});
