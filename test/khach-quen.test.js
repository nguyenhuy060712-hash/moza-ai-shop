'use strict';

/**
 * Khách quen, size quen (nhãn chỉ người của shop thấy), số đo khi khách đồng ý — công tắc tắt mặc định (SPEC.md F-91, #114). Facebook giả, AI giả — 0 đồng.
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
const psid = (x, ten) => x.fb.psidCua('page_gia', ten);

function hoiThoai(x, ten) {
  const hopThu = require('../server/nghiep-vu/hop-thu');
  return hopThu.layHoiThoai(hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === psid(x, ten)).id);
}

/** Buổi trước: người xem chốt, bấm Giữ, cho thông tin → có hồ sơ khách; các đơn đưa về Đã giao với size cho trước. */
async function khachDaMua(x, ten, sizes = ['M', 'M']) {
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan(ten, 'chốt 12 đen M');
  await x.bam(ten, 'Giữ, lên đơn');
  const h = hoiThoai(x, ten);
  const d0 = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
  require('../server/nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: d0, ten, sdt: '0912000999', diaChi: '1 Trần Hưng Đạo, Bắc Ninh' });
  const khachId = don.layDon(d0.id).khach_id;
  x.csdl().prepare("UPDATE don SET trang_thai = 'da_giao' WHERE id = ?").run(d0.id);
  for (const s of sizes.slice(1)) {
    const d = don.taoDon({ mon: [{ phan_loai_id: x.mau.pl('Trắng', s).id, so_luong: 1 }], nguon: 'tin_nhan', khachId, dienTap: true });
    x.csdl().prepare("UPDATE don SET trang_thai = 'da_giao' WHERE id = ?").run(d.id);
  }
  return { khachId, h: hoiThoai(x, ten) };
}

test('size quen chỉ từ đơn Đã giao: áo M, M, L giao + 1 Hoàn S → M; chưa mua quần → không có; nhãn "khách quen · hay mặc M" / "đã mua 1 lần"', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kh = require('../server/nghiep-vu/khach');
  const don = require('../server/nghiep-vu/don');
  const { csdl } = require('../server/db/ket-noi');
  const mau = taoSanPhamMau({ co: ['S', 'M', 'L'], ton: 20 });
  const k = kh.taoKhach({ ten: 'Lan', sdt: '0912345678', dongY: true }).khach;
  const mua = (s, tt) => { const d = don.taoDon({ mon: [{ phan_loai_id: mau.pl('Đen', s).id }], nguon: 'nguoi', khachId: k.id }); csdl().prepare('UPDATE don SET trang_thai = ? WHERE id = ?').run(tt, d.id); };
  assert.equal(kh.tomTatMua(k.id).nhan, null);
  mua('L', 'da_giao');
  assert.equal(kh.tomTatMua(k.id).nhan, 'đã mua 1 lần · L');
  mua('M', 'da_giao'); mua('M', 'da_giao'); mua('S', 'hoan'); mua('S', 'da_huy'); mua('S', 'cho_xac_nhan');
  const tt = kh.tomTatMua(k.id);
  assert.equal(tt.so_don, 3);
  assert.deepEqual(tt.size_quen, { ao_so_mi: 'M' });
  assert.equal(tt.nhan, 'khách quen · hay mặc M');
  assert.equal(kh.sizeQuen(k.id, 'ao_so_mi'), 'M');
  assert.equal(kh.sizeQuen(k.id, 'quan_jean'), null, 'chưa mua quần');
  assert.ok(kh.chiTiet(k.id).tom_tat_mua.nhan);
});

test('chốt thiếu size: khách từng mua M, M còn → [Lấy M như lần trước] đứng đầu, bấm → giữ Đen/M; M hết → không nút; người mới → không nhãn, không nút; nhãn chỉ trong live.chot', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  await khachDaMua(x, 'Nguyễn Lan', ['M', 'M']);
  // Người mới (chưa có hồ sơ): không nút size quen.
  await x.binhLuan('Người Mới', 'chốt 12 đen');
  const moi = chat(x, 'Người Mới').at(-1);
  assert.ok(!moi.nut.some((n) => /như lần trước/.test(n.tieu_de)));
  // Khách quen chốt thiếu size.
  await x.binhLuan('Nguyễn Lan', 'chốt 12 đen');
  const the = chat(x, 'Nguyễn Lan').at(-1);
  const nhanh = the.nut.filter((n) => n.loai === 'nhanh').map((n) => n.tieu_de);
  assert.equal(nhanh[0], 'Lấy M như lần trước', JSON.stringify(nhanh));
  assert.equal(nhanh.filter((n) => n === 'Đen/M').length, 0, 'không lặp M');
  await x.bam('Nguyễn Lan', 'Lấy M như lần trước');
  const d = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null }).find((y) => y.dong.some((z) => z.phan_loai_id === x.mau.pl('Đen', 'M').id));
  assert.ok(d, 'giữ Đen/M');
  // Sự kiện live.chot: nhãn cho Màn hình người dẫn; không vào Đội AI / miệng / Director.
  await x.binhLuan('Nguyễn Lan', 'chốt 12 trắng L');
  const chot = x.suKien.filter((e) => e.type === 'live.chot');
  assert.ok(chot.some((e) => e.nhan_khach === 'khách quen · hay mặc M'), JSON.stringify(chot.map((e) => e.nhan_khach)));
  assert.doesNotMatch(JSON.stringify([x.chen, x.noi, x.director]), /khách quen|hay mặc/);
  // M hết → không có nút.
  kho.dieuChinh([{ phan_loai_id: x.mau.pl('Trắng', 'M').id, ton: 0 }]);
  await x.binhLuan('Nguyễn Lan', 'chốt 12 trắng');
  assert.ok(!chat(x, 'Nguyễn Lan').at(-1).nut.some((n) => /như lần trước/.test(n.tieu_de)), 'M hết → không nút');
});

test('K11: "khách quen", "quay lại rồi", "lần trước chị mua" bị chặn trên sóng và bình luận; trong Messenger thì không', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  const k11 = (cau, kenh) => kiemTraCau({ cau, kenh }).loi.some((l) => l.ma === 'K11');
  for (const cau of ['Lan là khách quen của shop nè', 'Chị Hoa quay lại rồi kìa', 'Lần trước chị mua áo đen đúng không', 'Chị mua lần thứ ba rồi']) {
    assert.ok(k11(cau, 'song'), `trên sóng: ${cau}`);
    assert.ok(k11(cau, 'binh_luan'), `bình luận: ${cau}`);
  }
  assert.ok(!k11('Lan là khách quen của shop nè', 'messenger'));
});

test('số đo: công tắc tắt → không hỏi; bật → hỏi đúng 1 lần sau lượt AI; Lưu → lưu, Tư vấn viên thấy; "xóa số đo" → xóa + báo (0 AI); Xóa dữ liệu người này xóa cả số đo', async (t) => {
  const x = await dung(t);
  const kh = require('../server/nghiep-vu/khach');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { khachId } = await khachDaMua(x, 'Trần Hoa', ['M']);
  const nhan = async (noiDung) => { x.fb.khachNhan({ ten: 'Trần Hoa', noi_dung: noiDung }); await cho(30); await x.ht.choXong(); };
  await nhan('mình cao 1m58 nặng 50kg thì mặc size gì');
  assert.ok(!chat(x, 'Trần Hoa').some((y) => /lưu chiều cao/.test(y.noi_dung)), 'tắt → không hỏi');
  assert.equal(kh.daHoiSoDo(khachId), false);
  caiDat.datBanHang({ hoi_so_do: true });
  await nhan('áo này có size S không');
  const hoi = chat(x, 'Trần Hoa').filter((y) => /lưu chiều cao 158 cm, cân nặng 50 kg/.test(y.noi_dung));
  assert.equal(hoi.length, 1, 'hỏi 1 lần');
  await nhan('còn màu trắng không');
  assert.equal(chat(x, 'Trần Hoa').filter((y) => /lưu chiều cao/.test(y.noi_dung)).length, 1, 'không hỏi lần 2');
  await x.bam('Trần Hoa', 'Lưu giúp mình');
  assert.deepEqual([kh.soDo(khachId).chieu_cao, kh.soDo(khachId).can_nang], [158, 50]);
  assert.match(chat(x, 'Trần Hoa').at(-1).noi_dung, /lưu rồi: 158 cm, 50 kg/);
  const goi = x.goiAi();
  await nhan('xóa số đo giúp mình');
  assert.equal(kh.soDo(khachId), null);
  assert.match(chat(x, 'Trần Hoa').at(-1).noi_dung, /xóa chiều cao, cân nặng/);
  assert.equal(x.goiAi(), goi, '"xóa số đo" không gọi AI');
  kh.luuSoDo(khachId, { chieuCao: 160, canNang: 52 });
  x.csdl().prepare("UPDATE don SET trang_thai = 'da_huy' WHERE khach_id = ? AND trang_thai IN ('cho_xac_nhan', 'da_xac_nhan')").run(khachId);
  kh.xoaDuLieu(khachId);
  assert.equal(kh.soDo(khachId), null, 'xóa dữ liệu xóa cả số đo');
});

test('Tư vấn viên thấy dòng số đo đã lưu; câu nhắc lại số đo đã lưu không bị K3 chặn trong Messenger', async (t) => {
  const x = await dung(t);
  const kh = require('../server/nghiep-vu/khach');
  const { khachId, h } = await khachDaMua(x, 'Lê Mai', ['M']);
  kh.luuSoDo(khachId, { chieuCao: 158, canNang: 50 });
  let ngu = '';
  const nha = { async goi(o) { ngu = JSON.stringify(o); return { goiCongCu: [], chu: '{"xong":true,"tom_tat":""}', goc: null, tokenVao: 1, tokenRa: 1 }; } };
  await require('../server/agent/agents/tu-van').xuLyHoiThoai(h.id, { kichHoat: 'test', layKetNoi: () => x.fb, nhaCungCap: { gemini: nha, openai: nha, anthropic: nha } });
  assert.match(ngu, /Số đo khách cho lưu: 158 cm, 50 kg/);
  const guiMess = require('../server/agent/cong-cu/hop-thu').find((c) => c.ten === 'gui_messenger');
  const o = guiMess.cauRaNgoai({ noi_dung: 'Mai cao 158 cm nặng 50 kg thì lấy M nha', trich_dan: [] }, { hoiThoaiId: h.id });
  assert.ok(o.soKhachNoi.includes(158) && o.soKhachNoi.includes(50), JSON.stringify(o.soKhachNoi));
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  assert.ok(!kiemTraCau(o).loi.some((l) => l.ma === 'K3'), JSON.stringify(kiemTraCau(o).loi));
});
