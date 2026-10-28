'use strict';

/**
 * Tư vấn size bằng mã, gọi đúng tên người hỏi + số đo người mẫu nói bằng lời (SPEC.md F-82, #110). Bộ câu số đo do Claude Code
 * soạn 28/9/2026. Bảng size mẫu: S 148–155/40–47 · M 155–162/48–55 · L 160–167/55–62 · XL 165–172/62–70.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

// [câu, chiều cao, cân nặng]
const SO_DO = [
  ['1m58 50kg', 158, 50], ['cao 1m6 nặng 55 ký', 160, 55], ['158cm', 158, null], ['nặng 48 cao 1m55', 155, 48], ['m58 50', 158, 50],
  ['1m58 50 mặc size gì', 158, 50], ['em 1m6 52kg', 160, 52], ['1.62m 55kg', 162, 55], ['cao 160 nặng 50', 160, 50], ['1 mét 58', 158, null],
  ['1m7 60 ki', 170, 60], ['50kg mặc gì', null, 50], ['1m50', 150, null], ['m6 45 kí shop', 160, 45], ['1m55 47kg áo 12 size nào', 155, 47],
  ['e cao 1m62 nặng 53 kg', 162, 53], ['1m65/58kg', 165, 58], ['1m6 50 ki mặc size j', 160, 50], ['cao 1.58 nặng 49', 158, 49], ['cao1m6 nang52', 160, 52],
  ['1m52 45 cân', 152, 45], ['nặng 60kg cao 1m68', 168, 60], ['mình 1m7 65kg', 170, 65], ['1m60 55kg', 160, 55], ['1m 6 50kg', 160, 50],
  ['165 cm 58 kg', 165, 58], ['1m58, 50kg', 158, 50], ['1M58 50KG', 158, 50], ['cao 1m5 nặng 40', 150, 40], ['1m59 51kilo', 159, 51],
  ['52 ký thì size gì', null, 52], ['nặng 48 thì sao', null, 48], ['1m63 thì size gì', 163, null], ['em m55 45', 155, 45], ['1m72 70kg nam mặc được k', 172, 70],
  ['1m58 50kg mặc áo 12 size gì', 158, 50], ['mẹ em 1m55 58kg', 155, 58], ['1m60 nặng 50 ký rưỡi', 160, 50], ['cao 158cm nặng 50kg', 158, 50], ['1m64 56', 164, 56],
  // Không phải số đo.
  ['chốt 12 đen M x2', null, null], ['giá 150k', null, null], ['áo 12 size M', null, null], ['0912345678', null, null], ['chốt 12 den m', null, null],
  ['159k có ship không', null, null], ['2 cái 12 trắng L', null, null], ['DH-0042', null, null], ['áo 15 còn không', null, null], ['số 12 màu đen', null, null],
];

test(`≥ 50 câu số đo (${SO_DO.length}) đọc đúng; không nhầm chốt, giá, số điện thoại`, () => {
  const { docSoDo } = require('../server/nghiep-vu/so-do');
  assert.ok(SO_DO.length >= 50);
  for (const [c, cao, nang] of SO_DO) {
    const r = docSoDo(c);
    assert.deepEqual(r ? [r.chieu_cao, r.can_nang] : [null, null], [cao, nang], c);
  }
});

test('bảng size: 1 dòng khớp, 2 dòng liền nhau, không khớp; mọi dòng khớp đều được tô', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { dongHop } = require('../server/man-hinh-san-pham');
  taoSanPhamMau();
  const b = require('../server/nghiep-vu/bang-size').danhSachBang().find((x) => x.ten === 'Áo test');
  assert.deepEqual(dongHop(b, { chieuCao: 158, canNang: 50 }), ['M']);
  assert.deepEqual(dongHop(b, { chieuCao: 161, canNang: 55 }), ['M', 'L']);
  assert.deepEqual(dongHop(b, { chieuCao: 190, canNang: 50 }), []);
  assert.deepEqual(dongHop(b, { chieuCao: 158, canNang: 70 }), [], 'không lùi về "chỉ so cân nặng"');
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
  const goiY = [];
  phongAi.hienGoiY = (o) => { goiY.push(o); return { da_hien: true }; };
  const chieu = [];
  const chot = new ChotDon({ phat, layKetNoi, nhaCungCap, gomMs: 0, nhacMoTinMs: 0, phongAi });
  const director = [];
  const phong = new PhongLive({ layKetNoi, phat, ai: { nhanBinhLuan: (bl) => director.push(bl), ketThuc() {} } });
  phong.chotDon = chot;
  const { TuVanSize } = require('../server/tu-van-size');
  phong.tuVanSize = new TuVanSize({ phat, phongAi, layManHinh: () => ({ chieu: (l) => chieu.push(l) }), gomMs: 400 });
  t.after(() => phong.tuVanSize.dung());
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
  return { fb, live, p, mau, chot, ht, phong, binhLuan, tinCua, bam, suKien, chen, noi, director, lui, csdl, goiY, chieu, phat, goiAi: () => goiAi };
}

test('Chỉ gợi ý: "1m58 50kg mặc áo 12 size gì" → ô gợi ý "Lan ơi, theo bảng size của shop thì lấy M" (không số đo khách), Director không nhận; nằm giữa hai size; món chưa có bảng size → Director', async (t) => {
  const x = await dung(t);
  const soDir = x.director.length;
  const bl = await x.binhLuan('Nguyễn Thị Lan', '1m58 50kg mặc áo 12 size gì');
  assert.equal(x.goiY.length, 1);
  assert.equal(x.goiY[0].cau, 'Lan ơi, theo bảng size của shop thì lấy M.');
  assert.doesNotMatch(x.goiY[0].cau, /158|1m58|50/);
  assert.equal(x.goiY[0].loai, 'cohost');
  assert.match(x.goiY[0].trichDan[0].doan, /^Size M: /);
  assert.equal(x.live.layBinhLuan(bl.id).xu_ly, 'da_goi_y');
  assert.equal(x.director.length, soDir, 'Director không nhận');
  assert.deepEqual(x.chieu.at(-1), { mau: 'bang_size', so: 12, chieu_cao: 158, can_nang: 50 }, 'chiếu bảng size tô đúng dòng');

  await cho(450); // qua cửa gom
  await x.binhLuan('Trần Hoa', '1m61 55kg áo 12');
  assert.equal(x.goiY.at(-1).cau, 'Hoa nằm giữa M và L theo bảng size của shop: thích mặc ôm thì M, thích thoải mái thì L.');

  // Món chưa có bảng size → không có câu máy, Director nhận.
  taoSanPhamMau({ so: 30, ten: 'Túi da', danhMuc: 'phu_kien', co: [], them: { bang_size_id: null, thong_so: {} } });
  const n = x.goiY.length;
  const d0 = x.director.length;
  await x.binhLuan('Lê Vy', '1m58 50kg túi 30 đeo được không');
  assert.equal(x.goiY.length, n);
  assert.equal(x.director.length, d0 + 1);
});

test('người mẫu nói bằng lời: "Mai ơi mẫu cao 1m60 mặc S" → Thanh chữ "Mẫu: 1m60 · mặc S", câu tư vấn kèm mẫu (qua Bộ kiểm tra), khôi phục sau khởi động lại; chưa có mẫu thì nguồn nguoi_mau bị chặn', async (t) => {
  const x = await dung(t);
  const nm = require('../server/nguoi-mau');
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  const ktMau = () => kiemTraCau({ cau: 'Bạn mẫu 1m60 đang mặc S', trich_dan: [{ nguon: 'nguoi_mau', doan: 'Người mẫu: cao 160 cm (1m60), đang mặc size S của áo số 12' }], kenh: 'song', phienLiveId: x.p.id });
  assert.ok(ktMau().loi.some((l) => l.ma === 'K2'), 'chưa có người mẫu → nguồn không hợp lệ');
  x.live.doiDoan(x.p.id, 1);
  const p = x.live.layPhien(x.p.id);
  const tt = nm.xuLy(p, 'Mai ơi mẫu cao 1m60 mặc S', x.phat);
  assert.equal(tt.chu, 'Mẫu: 1m60 · mặc S');
  assert.ok(ktMau().dat, JSON.stringify(ktMau().loi));
  const { dung: dungMh } = require('../server/man-hinh-san-pham');
  assert.equal(dungMh({ mau: 'gioi_thieu', so: 12 }).san_pham.mau_nguoi, 'Mẫu: 1m60 · mặc S', 'Thanh chữ nhận dòng Mẫu');
  nm.xuLy(p, 'mẫu nặng 48', x.phat);
  assert.equal(nm.trangThai(p).chu, 'Mẫu: 1m60 · 48kg · mặc S', 'cân nặng hiện khi người dẫn nói');
  nm.xuLy(p, 'Mai ơi bỏ cân nặng mẫu', x.phat);
  assert.equal(nm.trangThai(p).chu, 'Mẫu: 1m60 · mặc S');

  await x.binhLuan('Nguyễn Thị Lan', '1m58 50kg mặc size gì');
  assert.equal(x.goiY.at(-1).cau, 'Lan ơi, theo bảng size của shop thì lấy M, bạn mẫu 1m60 đang mặc S.');
  assert.ok(x.goiY.at(-1).trichDan.some((d) => d.nguon === 'nguoi_mau'));

  nm.quenBoNho(); // giả khởi động lại giữa buổi
  assert.equal(nm.trangThai(p).dang_mac, 'S', 'size mẫu đang mặc khôi phục từ nhật ký');
  assert.equal(nm.docLenh('mẫu số 12 đẹp quá'), null, 'không nhầm "mẫu số 12"');
});

test('Đội AI: 3 người hỏi cùng món trong 20 giây → 1 câu mẫu có 3 tên', async (t) => {
  const x = await dung(t, { cheDo: 'doi' });
  x.live.doiDoan(x.p.id, 1);
  await x.binhLuan('Nguyễn Thị Lan', '1m58 50kg mặc size gì');
  await x.binhLuan('Trần Hoa', '1m50 45kg size nào');
  await x.binhLuan('Lê Vy', '1m61 55kg thì sao');
  assert.equal(x.chen.filter((c) => /^tu_van_size/.test(c.khoa)).length, 0, 'đang gom');
  await cho(500);
  const c = x.chen.filter((y) => /^tu_van_size/.test(y.khoa));
  assert.equal(c.length, 1);
  assert.equal(c[0].khoa, 'tu_van_size_gom');
  assert.equal(c[0].cau, 'Theo bảng size của shop: Lan lấy M, Hoa lấy S, Vy M hoặc L.');
  assert.equal(x.goiAi(), 0);
});
