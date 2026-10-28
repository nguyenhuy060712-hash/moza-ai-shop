'use strict';

/**
 * Thẻ giữ hàng do mã soạn + giữ hai mức (SPEC.md F-68, #97, #98) trên Facebook giả mới (Meta giả, tình huống "Thận trọng"):
 * 0 lượt AI cho tin đầu; 40 người chốt liền → mỗi người đúng một kết cục, không bán quá; nút Giữ / Đổi / Không lấy; ảnh hỏng →
 * thẻ chữ có nút; không nhắn riêng được → gom công khai có link m.me; hết live rút hạn giữ; bấm → giữ đủ 24 giờ.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

async function dung(t, { tinhHuong = 'than_trong' } = {}) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { FacebookGia } = require('../server/facebook/gia');
  const { PhongLive } = require('../server/phong-live');
  const { ChotDon } = require('../server/chot-don');
  const { HopThuTuDong } = require('../server/hop-thu');
  const fb = new FacebookGia({ tinhHuong });
  let goiAi = 0;
  const nha = { async goi() { goiAi += 1; return { goiCongCu: [], chu: '{"xong":true,"tom_tat":""}', goc: null, tokenVao: 1, tokenRa: 1 }; } };
  const nhaCungCap = { gemini: nha, openai: nha, anthropic: nha };
  const layKetNoi = () => fb;
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi, nhaCungCap, gomMs: 10, chuKyMs: 3600000, phat });
  const chot = new ChotDon({ phat, layKetNoi, nhaCungCap, gomMs: 0 });
  const phong = new PhongLive({ layKetNoi, phat, ai: { nhanBinhLuan: () => {}, ketThuc() {} } });
  phong.chotDon = chot;
  ht.batDau();
  t.after(() => { ht.dung(); chot.dung(); phong.dongLuong(); });
  const mau = taoSanPhamMau({ gia: '159k' }); // áo 12, Đen/Trắng × M/L, mỗi ô 5
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  fb.batDauLive();
  await phong.quet();
  const binhLuan = async (ten, noiDung, o = {}) => {
    const truoc = live.demBinhLuan(p.id).tong;
    fb.themBinhLuan({ ten, noi_dung: noiDung, ...o });
    for (let i = 0; i < 200 && live.demBinhLuan(p.id).tong === truoc; i++) await new Promise((r) => setTimeout(r, 2));
    await new Promise((r) => setTimeout(r, 5));
    await chot.choXong();
    return live.binhLuanGanDay(p.id, 1)[0];
  };
  const tinCua = (ten) => fb.luongChat('page_gia', fb.psidCua('page_gia', ten));
  const theCua = (ten) => tinCua(ten).filter((x) => x.tu === 'page').at(-1);
  const bam = async (ten, tieuDe) => {
    const the = [...tinCua(ten)].reverse().find((x) => x.tu === 'page' && x.nut?.some((n) => n.tieu_de === tieuDe));
    const n = the.nut.find((x) => x.tieu_de === tieuDe);
    fb.khachBam({ psid: fb.psidCua('page_gia', ten), payload: n.payload, tieu_de: n.tieu_de });
    await new Promise((r) => setTimeout(r, 5));
    await ht.choXong();
  };
  return { fb, live, p, mau, chot, ht, phong, binhLuan, tinCua, theCua, bam, suKien, goiAi: () => goiAi };
}

test('thẻ giữ hàng: "chốt 12 đen M" → thẻ ảnh đúng màu, đúng giá, 3 nút, câu tự nhận AI, ≤ 2 giây, 0 lượt AI; bình luận đó Director không chuyển Tư vấn viên được nữa', async (t) => {
  const x = await dung(t);
  const bd = Date.now();
  await x.binhLuan('Nguyễn Lan', 'chốt 12 đen M');
  const the = x.theCua('Nguyễn Lan');
  assert.ok(Date.now() - bd < 2000);
  assert.equal(the.the.kieu, 'anh');
  assert.equal(the.the.tieu_de, 'Áo 12 Đen/M · 159.000đ');
  assert.match(the.the.anh.url, /^\/api\/anh\/sp_/);
  assert.match(the.the.phu_de, /Tin tự động từ trợ lý AI của shop/);
  assert.deepEqual(the.nut.map((n) => n.tieu_de), ['Giữ, lên đơn', 'Đổi', 'Không lấy']);
  assert.equal(x.goiAi(), 0, '0 lượt AI cho tin đầu');
  assert.equal(require('../server/db/ket-noi').csdl().prepare('SELECT COUNT(*) AS n FROM agent_run').get().n, 0);
  // Director đưa chính bình luận đó sang Tư vấn viên → không có tin thứ hai, không lỗi DA_NHAN_RIENG.
  const bl = x.live.binhLuanGanDay(x.p.id, 1)[0];
  x.live.datXuLy(x.p.id, [bl.id], 'cho_tu_van');
  x.ht.nhanChoTuVan();
  await x.ht.choXong();
  assert.equal(x.tinCua('Nguyễn Lan').filter((y) => y.tu === 'page').length, 1, 'đúng 1 tin cho bình luận đó');
  assert.equal(require('../server/nghiep-vu/luot-nhan-rieng').lay(bl.fb_id).boi, 'the_giu_hang');
});

test('40 người chốt liền → mỗi người đúng một kết cục (thẻ giữ hàng hoặc báo hết), 0 bán quá, mỗi thẻ ≤ 3 giây', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  const ten = Array.from({ length: 40 }, (_, i) => `Khách Số${i + 1}`);
  const mau = ['đen M', 'đen L', 'trắng M', 'trắng L'];
  const bd = Date.now();
  // 20 tổ hợp còn 5 chiếc mỗi ô = 20 chiếc: 40 người chốt → 20 giữ được, 20 báo hết.
  await Promise.all(ten.map(async (n, i) => { x.fb.themBinhLuan({ ten: n, noi_dung: `chốt 12 ${mau[i % 4]}` }); }));
  for (let i = 0; i < 400 && x.live.demBinhLuan(x.p.id).tong < 40; i++) await new Promise((r) => setTimeout(r, 5));
  await new Promise((r) => setTimeout(r, 20));
  await x.chot.choXong(10000);
  const tg = Date.now() - bd;
  assert.ok(tg < 40 * 3000, `40 thẻ trong ${tg} ms`);
  let giu = 0;
  let het = 0;
  for (const n of ten) {
    const tin = x.tinCua(n).filter((y) => y.tu === 'page');
    assert.equal(tin.length, 1, `${n}: đúng một tin`);
    if (tin[0].the.kieu === 'anh') giu += 1;
    else { assert.match(tin[0].the.chu, /vừa hết mất rồi|hết mọi màu/); het += 1; }
  }
  assert.deepEqual([giu, het], [20, 20]);
  const s = x.mau.san_pham.id;
  for (const pl of kho.conHang(s)) assert.ok(pl.con_ban_duoc >= 0, 'không bán âm');
  assert.equal(don.danhSach({ trangThai: 'cho_xac_nhan' }).length, 20);
  assert.equal(x.goiAi(), 0);
});

test('nút trên thẻ: [Giữ, lên đơn] → giữ đủ 24 giờ, xin thông tin; [Đổi] → chọn phân loại còn hàng; [Không lấy] → hàng về kho, đơn hủy', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  await x.binhLuan('Lan', 'chốt 12 đen M');
  const d0 = don.danhSach()[0];
  await x.bam('Lan', 'Giữ, lên đơn');
  const d1 = don.layDon(d0.id);
  assert.ok(d1.khach_bam_luc);
  const gioGiu = (new Date(d1.giu_den) - Date.now()) / 3600e3;
  assert.ok(gioGiu > 23.9 && gioGiu <= 24, 'bấm → giữ đủ 24 giờ');
  assert.match(x.theCua('Lan').noi_dung, /giữ Áo 12 Đen\/M cho bạn .*tên.*số điện thoại.*địa chỉ/);
  assert.doesNotMatch(x.theCua('Lan').noi_dung, /trợ lý AI/, 'cùng luồng chat đã tự nhận AI ở thẻ đầu: không nhắc lại');
  // Đổi.
  await x.bam('Lan', 'Đổi');
  const nhanh = x.theCua('Lan');
  assert.deepEqual(nhanh.nut.map((n) => n.tieu_de), ['Đen/L', 'Trắng/M', 'Trắng/L']);
  x.fb.khachChamNhanh({ psid: x.fb.psidCua('page_gia', 'Lan'), payload: nhanh.nut[2].payload, tieu_de: 'Trắng/L' });
  await new Promise((r) => setTimeout(r, 5));
  await x.ht.choXong();
  assert.equal(don.layDon(d0.id).dong[0].phan_loai_id, x.mau.pl('Trắng', 'L').id, 'chạm trả lời nhanh = bấm nút (F-65)');
  assert.match(x.theCua('Lan').noi_dung, /đổi sang Áo 12 Trắng\/L rồi/);
  // Không lấy (dùng lại thẻ cũ: nút mang id đơn, không mang phân loại cũ → vẫn đúng đơn).
  const conTruoc = kho.conHang(x.mau.san_pham.id).find((p) => p.gt1 === 'Trắng' && p.gt2 === 'L').con_ban_duoc;
  await x.bam('Lan', 'Không lấy');
  assert.equal(don.layDon(d0.id).trang_thai, 'da_huy');
  assert.equal(don.lichSu(d0.id).at(-1).nguon, 'khach_tu_bao');
  assert.equal(kho.conHang(x.mau.san_pham.id).find((p) => p.gt1 === 'Trắng' && p.gt2 === 'L').con_ban_duoc, conTruoc + 1, 'hàng về còn bán được ngay');
  assert.match(x.theCua('Lan').noi_dung, /hủy đơn DH-0001 rồi/);
  assert.equal(x.goiAi(), 0, 'mọi câu sau khi bấm nút do mã soạn');
  // Nút mang đơn của người khác → đơn không đổi, câu lịch sự.
  await x.binhLuan('Hoa', 'chốt 12 đen L');
  const dHoa = don.danhSach({ trangThai: 'cho_xac_nhan' })[0];
  const nutHoa = x.theCua('Hoa').nut.find((n) => n.tieu_de === 'Không lấy');
  x.fb.khachNhan({ ten: 'Tú', noi_dung: 'hi' });
  x.fb.khachBam({ psid: x.fb.psidCua('page_gia', 'Tú'), payload: nutHoa.payload, tieu_de: 'Không lấy' });
  await new Promise((r) => setTimeout(r, 5));
  await x.ht.choXong();
  assert.equal(don.layDon(dHoa.id).trang_thai, 'cho_xac_nhan', 'nút giả mạo không đổi được đơn');
  assert.match(x.theCua('Tú').noi_dung, /không thuộc đơn của bạn/);
});

test('ảnh hỏng → thẻ chữ có nút (≤ 640, vẫn tự nhận AI); không nhắn riêng được → gom công khai có link m.me', async (t) => {
  const x = await dung(t);
  x.fb.meta.th.anhUrlChet = true;
  await x.binhLuan('Minh', 'chốt 12 trắng M');
  const the = x.theCua('Minh');
  assert.equal(the.the.kieu, 'nut');
  assert.ok(the.the.chu.length <= 640);
  assert.match(the.the.chu, /Áo 12 Trắng\/M · 159\.000đ\nGiữ tới hết live \+ 2 giờ · Tin tự động từ trợ lý AI/);
  assert.equal(the.nut.length, 3);
  x.fb.meta.th.anhUrlChet = false;
  x.fb.meta.th.nhanRiengLive = false;
  await x.binhLuan('Nguyễn Văn Hùng', 'chốt 12 đen L');
  assert.equal(x.tinCua('Nguyễn Văn Hùng').length, 0, 'không nhắn riêng được');
  await x.chot.guiGomCongKhai(Date.now() + 1);
  const gom = x.fb.traLoi.at(-1);
  assert.match(gom.noi_dung, /^Hùng ơi, (shop đã giữ hàng|hàng đã giữ)/);
  assert.match(gom.noi_dung, new RegExp(`m\\.me/page_gia\\?ref=phien_${x.p.id}`));
});

test('giữ hai mức: đang live chưa bấm → 12 giờ; hết live → hết live + 2 giờ; bấm sau đó → 24 giờ từ lúc bấm (#98)', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan('Vy', 'chốt 12 đen M');
  await x.binhLuan('Yến', 'chốt 12 trắng M');
  const [dYen, dVy] = don.danhSach({ trangThai: 'cho_xac_nhan' });
  const ket = x.live.ketThucPhien(x.p.id);
  const han = (d) => new Date(don.layDon(d.id).giu_den).getTime();
  assert.equal(han(dVy), new Date(ket.ket_thuc).getTime() + 2 * 3600e3, 'hết live + 2 giờ');
  await x.bam('Yến', 'Giữ, lên đơn');
  assert.ok(Math.abs(han(dYen) - (Date.now() + 24 * 3600e3)) < 5000, 'bấm → 24 giờ từ lúc bấm');
  assert.equal(don.huyQuaGio(new Date(Date.now() + 2.1 * 3600e3)).map((d) => d.id).join(), dVy.id, 'quá hết live + 2 giờ: chỉ đơn chưa bấm tự hủy');
});
