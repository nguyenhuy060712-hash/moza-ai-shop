'use strict';

/**
 * Danh sách chờ khi hết hàng: bấm [🙋 Vẫn chờ], nhường suất trong cùng giao dịch trả hàng, giữ lời mời 30 phút (SPEC.md F-92). Facebook giả, AI giả — 0 đồng.
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
const conBanDuoc = (x, pl) => require('../server/nghiep-vu/kho').conHang(x.mau.san_pham.id).find((y) => y.id === pl).con_ban_duoc;
const donMo = (x, ten) => {
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const psid = x.fb.psidCua('page_gia', ten);
  return require('../server/nghiep-vu/don').danhSach({ trangThai: 'cho_xac_nhan', dienTap: null }).filter((d) => d.nguoi_fb_id && hopThu.psidCuaNguoi(d.nguoi_fb_id) === psid);
};

/** Đen/M chỉ còn 1: A giữ; những người sau chốt thấy thẻ hết hàng có [🙋 Vẫn chờ]. */
async function chayHetSize(x, dsCho) {
  const kho = require('../server/nghiep-vu/kho');
  const pl = x.mau.pl('Đen', 'M').id;
  kho.dieuChinh([{ phan_loai_id: pl, ton: 1 }]);
  await x.binhLuan('An', 'chốt 12 đen M');
  for (const ten of dsCho) await x.binhLuan(ten, 'chốt 12 đen M');
  return pl;
}

test('còn 1: A giữ; B rồi C bấm Vẫn chờ → số 1, số 2; D không bấm → không vào danh sách; A Không lấy → cùng giao dịch B có đơn 1 chiếc + thẻ mời', async (t) => {
  const x = await dung(t);
  const choHang = require('../server/nghiep-vu/cho-hang');
  const pl = await chayHetSize(x, ['Bình', 'Chi', 'Dũng']);
  const theB = chat(x, 'Bình').at(-1);
  assert.equal(theB.nut.filter((n) => n.loai === 'nhanh')[0].tieu_de, '🙋 Vẫn chờ', 'nút Vẫn chờ đứng đầu');
  await x.bam('Bình', '🙋 Vẫn chờ');
  assert.match(chat(x, 'Bình').at(-1).noi_dung, /đứng số 1 trong danh sách chờ Áo 12 Đen\/M.*trong 24 giờ.*Không lấy hoặc hết giờ giữ/s);
  await x.bam('Chi', '🙋 Vẫn chờ');
  assert.match(chat(x, 'Chi').at(-1).noi_dung, /đứng số 2/);
  await x.bam('Chi', '🙋 Vẫn chờ');
  assert.match(chat(x, 'Chi').at(-1).noi_dung, /đứng số 2/, 'bấm lại vẫn số 2, không thêm lần nữa');
  assert.equal(choHang.danhSach().tom_tat[0].so_nguoi, 2);
  const soTinDung = chat(x, 'Dũng').length;
  // A bấm Không lấy.
  await x.bam('An', 'Không lấy');
  const dB = donMo(x, 'Bình');
  assert.equal(dB.length, 1, 'B có đơn');
  assert.equal(dB[0].dong[0].phan_loai_id, pl);
  assert.equal(dB[0].dong[0].so_luong, 1);
  assert.ok(Math.abs(new Date(dB[0].giu_den) - Date.now() - 30 * 60e3) < 60e3, 'giữ 30 phút');
  assert.equal(conBanDuoc(x, pl), 0, 'suất đã giữ cho B — bình luận chốt mới không lấy được');
  const moi = chat(x, 'Bình').at(-1);
  assert.match(moi.noi_dung, /có suất Áo 12 Đen\/M cho bạn rồi, mình giữ tới \d{2}:\d{2}/);
  assert.deepEqual(moi.nut.map((n) => n.tieu_de), ['Giữ, lên đơn', 'Không lấy']);
  assert.equal(chat(x, 'Dũng').length, soTinDung, 'D không bấm → không nhận tin');
  assert.deepEqual(require('../server/nghiep-vu/kho').doiChieu(), []);
});

test('B không bấm quá 30 phút → đơn B tự hủy, C được mời; B bấm Giữ thì lời mời đã nhận', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const choHang = require('../server/nghiep-vu/cho-hang');
  await chayHetSize(x, ['Bình', 'Chi']);
  await x.bam('Bình', '🙋 Vẫn chờ');
  await x.bam('Chi', '🙋 Vẫn chờ');
  await x.bam('An', 'Không lấy');
  await x.ht.choXong();
  const dB = donMo(x, 'Bình')[0];
  // Đồng hồ giả: hết 30 phút.
  don.huyQuaGio(new Date(Date.now() + 31 * 60e3));
  await cho(20); await x.ht.choXong();
  assert.equal(don.layDon(dB.id).trang_thai, 'da_huy');
  const rowB = choHang.danhSach({ dienTap: null }).ds.find((y) => y.don_id === dB.id);
  assert.equal(rowB, undefined, 'lời mời của B không còn');
  assert.equal(x.csdl().prepare('SELECT trang_thai FROM cho_hang WHERE don_id = ?').get(dB.id).trang_thai, 'het_han');
  const dC = donMo(x, 'Chi');
  assert.equal(dC.length, 1, 'C có đơn');
  assert.match(chat(x, 'Chi').at(-1).noi_dung, /có suất Áo 12 Đen\/M/);
  await x.bam('Chi', 'Giữ, lên đơn');
  assert.equal(x.csdl().prepare('SELECT trang_thai FROM cho_hang WHERE don_id = ?').get(dC[0].id).trang_thai, 'da_nhan');
  assert.ok(new Date(don.layDon(dC[0].id).giu_den) > Date.now() + 23 * 3600e3, 'bấm Giữ → giữ đủ giờ');
  assert.deepEqual(require('../server/nghiep-vu/kho').doiChieu(), []);
});

test('người chờ quá 24 giờ → hết hạn, không có tin; nhập thêm 2 chiếc → 2 người chờ đầu được mời', async (t) => {
  const x = await dung(t);
  const kho = require('../server/nghiep-vu/kho');
  const pl = await chayHetSize(x, ['Cũ', 'Bình', 'Chi', 'Dung']);
  for (const ten of ['Cũ', 'Bình', 'Chi', 'Dung']) await x.bam(ten, '🙋 Vẫn chờ');
  x.csdl().prepare("UPDATE cho_hang SET bam_luc = ? WHERE nguoi_fb_id IN (SELECT nguoi_fb_id FROM don WHERE 0) OR rowid = (SELECT MIN(rowid) FROM cho_hang)").run(new Date(Date.now() - 25 * 3600e3).toISOString());
  const soTinCu = chat(x, 'Cũ').length;
  kho.nhap([{ phan_loai_id: pl, so: 2 }]);
  await cho(20); await x.ht.choXong();
  assert.equal(chat(x, 'Cũ').length, soTinCu, 'quá 24 giờ → không nhắn');
  assert.equal(x.csdl().prepare('SELECT trang_thai FROM cho_hang WHERE rowid = (SELECT MIN(rowid) FROM cho_hang)').get().trang_thai, 'het_han');
  assert.equal(donMo(x, 'Bình').length, 1);
  assert.equal(donMo(x, 'Chi').length, 1);
  assert.equal(donMo(x, 'Dung').length, 0, 'chỉ 2 chiếc → 2 người');
  assert.match(chat(x, 'Bình').at(-1).noi_dung, /có suất/);
  assert.match(chat(x, 'Chi').at(-1).noi_dung, /có suất/);
  assert.equal(conBanDuoc(x, pl), 0);
  assert.deepEqual(kho.doiChieu(), []);
});

test('nhường suất cùng lúc với bình luận chốt mới → chỉ một bên giữ được, không bán quá, đối chiếu kho rỗng', async (t) => {
  const x = await dung(t);
  const kho = require('../server/nghiep-vu/kho');
  const pl = await chayHetSize(x, ['Bình']);
  await x.bam('Bình', '🙋 Vẫn chờ');
  await Promise.all([x.bam('An', 'Không lấy'), x.binhLuan('Êm', 'chốt 12 đen M'), x.binhLuan('Giang', 'chốt 12 đen M')]);
  await cho(30); await x.ht.choXong();
  const giu = x.csdl().prepare(`SELECT COALESCE(SUM(x.so_luong), 0) AS n FROM don_dong x JOIN don d ON d.id = x.don_id
                               WHERE x.phan_loai_id = ? AND d.trang_thai IN ('cho_xac_nhan', 'da_xac_nhan')`).get(pl).n;
  assert.equal(giu, 1, 'đúng 1 chiếc được giữ');
  assert.equal(conBanDuoc(x, pl), 0);
  assert.deepEqual(kho.doiChieu(), []);
});

test('trả kho buổi tập → danh sách chờ diễn tập trống; người hủy tay ở màn hình Đơn hàng', async (t) => {
  const x = await dung(t);
  const choHang = require('../server/nghiep-vu/cho-hang');
  await chayHetSize(x, ['Bình', 'Chi']);
  await x.bam('Bình', '🙋 Vẫn chờ');
  await x.bam('Chi', '🙋 Vẫn chờ');
  const idChi = choHang.danhSach({ dienTap: null }).ds.at(-1).id;
  choHang.huy(idChi);
  assert.equal(choHang.danhSach({ dienTap: null }).tom_tat[0].so_nguoi, 1);
  assert.throws(() => choHang.huy(idChi), /không còn trong danh sách chờ/);
  x.csdl().prepare("UPDATE phien_live SET trang_thai = 'xong' WHERE id = ?").run(x.p.id);
  require('../server/nghiep-vu/dien-tap-ban-hang').traKho();
  await cho(20); await x.ht.choXong();
  assert.equal(choHang.danhSach({ dienTap: null }).ds.length, 0);
  assert.equal(donMo(x, 'Bình').length, 0, 'không mời người tập bằng hàng vừa trả');
  assert.deepEqual(require('../server/nghiep-vu/kho').doiChieu(), []);
});
