'use strict';

/**
 * Dồn tải (SPEC.md mục 11 bản 3.4, docs/07 H21, L13): 50 người chốt trong 1 phút, chạy qua CHÍNH lớp Facebook thật
 * (that.js + graph.js + nhip-goi.js, fetch giả vào Meta giả). Mức dùng 60%: nhịp gọi giãn 2 giây, đủ 50 kết cục. Mức dùng 85%:
 * giãn 10 giây — thẻ đứng hàng quá 20 giây vào hàng gửi lại (không rơi về gom công khai), gửi lại sau đó; 0 người bị sót,
 * 0 bán quá, không ai nhận 2 thẻ. Đồng hồ nhịp gọi giả (không chờ thật).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const { thatTrenMetaGia } = require('./ho-tro-fb');

async function chay(t, mucDung) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const kho = require('../server/nghiep-vu/kho');
  const nhanBu = require('../server/nghiep-vu/nhan-bu');
  const { FacebookGia } = require('../server/facebook/gia');
  const { NhipGoi } = require('../server/facebook/nhip-goi');
  const { PhongLive } = require('../server/phong-live');
  const { ChotDon } = require('../server/chot-don');
  const gia = new FacebookGia();
  let dongHo = Date.now();
  const nhip = new NhipGoi({ bayGio: () => dongHo, ngu: async (ms) => { dongHo += ms; } });
  const { that } = thatTrenMetaGia(gia, { nhip });
  const layKetNoi = () => that;
  const chot = new ChotDon({ phat: () => {}, layKetNoi, gomMs: 0, guiLaiMs: 0 });
  const phong = new PhongLive({ layKetNoi, phat: () => {}, ai: { nhanBinhLuan: () => {}, ketThuc() {} } });
  phong.chotDon = chot;
  t.after(() => { chot.dung(); phong.dongLuong(); });
  const mau = taoSanPhamMau({ ton: 20 }); // 4 ô × 20 = 80 chiếc ≥ 50 người
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  gia.batDauLive();
  await phong.quet();
  await new Promise((r) => setTimeout(r, 30)); // luồng SSE mở
  gia.meta.mucDung = mucDung;
  const ten = Array.from({ length: 50 }, (_, i) => `Người Chốt ${i + 1}`);
  const cachChot = ['đen M', 'đen L', 'trắng M', 'trắng L'];
  for (const [i, n] of ten.entries()) gia.themBinhLuan({ ten: n, noi_dung: `chốt 12 ${cachChot[i % 4]}` });
  for (let i = 0; i < 500 && live.demBinhLuan(p.id).tong < 50; i++) await new Promise((r) => setTimeout(r, 5));
  await new Promise((r) => setTimeout(r, 50));
  await chot.choXong(20000);
  const soThe = (n) => gia.luongChat('page_gia', gia.psidCua('page_gia', n)).filter((x) => x.tu === 'page').length;
  return { gia, nhip, chot, ten, soThe, nhanBu, kho, mau, live, p };
}

/** Mỗi người đúng một kết cục; hạ mức dùng rồi gửi lại hết hàng chờ → mỗi người đúng một thẻ. */
async function kiemDu(x) {
  for (const n of x.ten) assert.ok(x.soThe(n) <= 1, `${n}: không bao giờ 2 thẻ`);
  const coThe = x.ten.filter((n) => x.soThe(n) === 1);
  const cho = x.nhanBu.danhSach({ lyDo: 'gioi_han_goi' });
  assert.equal(coThe.length + cho.length, 50, 'mỗi người đúng một kết cục: thẻ đã gửi, hoặc đang trong hàng gửi lại');
  x.gia.meta.mucDung = 10;
  x.nhip.muc = 10;
  for (let i = 0; i < 10 && x.nhanBu.danhSach({ lyDo: 'gioi_han_goi' }).length; i++) await x.chot.guiLaiGioiHan(Date.now() + 60000);
  for (const n of x.ten) assert.equal(x.soThe(n), 1, `${n}: đúng một thẻ sau khi gửi lại`);
  assert.equal(x.nhanBu.danhSach({ lyDo: 'gioi_han_goi' }).length, 0);
  const con = x.kho.conHang(x.mau.san_pham.id);
  for (const pl of con) assert.ok(pl.con_ban_duoc >= 0, 'không bán âm');
  assert.equal(con.reduce((t, pl) => t + pl.con_ban_duoc, 0), 80 - 50, 'giữ đúng 50 chiếc');
  return { coThe: coThe.length, cho: cho.length };
}

test('dồn tải 60%: nhịp giãn 2 giây theo hàng; ai quá hàng chờ vào hàng gửi lại; cuối cùng 50 thẻ, mỗi người 1 thẻ, 0 bán quá', async (t) => {
  const x = await chay(t, 60);
  assert.equal(x.live.demBinhLuan(x.p.id).tong, 50, 'luồng bình luận qua SSE giả nhận đủ');
  const kq = await kiemDu(x);
  assert.ok(kq.coThe >= 5, 'phần đầu hàng gửi ngay');
});

test('dồn tải 85%: nhịp giãn 10 giây; nhiều thẻ vào hàng gửi lại (không rơi về gom công khai); gửi lại xong 0 người bị sót', async (t) => {
  const x = await chay(t, 85);
  const kq = await kiemDu(x);
  assert.ok(kq.cho > 0, 'có người phải chờ gửi lại');
  assert.equal(x.gia.traLoi.length, 0, 'không ai rơi về gom công khai');
});
