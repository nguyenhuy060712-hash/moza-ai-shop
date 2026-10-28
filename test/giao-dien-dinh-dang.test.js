// GD1 (F-119, docs/11 mục 3.4): hàm định dạng chung và bảng trạng thái chung của giao diện.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const nap = (tep) => import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', tep)).href);

test('tiền: 10.000đ, âm, rỗng', async () => {
  const d = await nap('dinh-dang.js');
  assert.equal(d.tien(10000), '10.000đ');
  assert.equal(d.tien(1234567), '1.234.567đ');
  assert.equal(d.tien(0), '0đ');
  assert.equal(d.tien(null, true), '');
  assert.equal(d.tien(-5000), '-5.000đ');
});

test('đọc tiền gõ tay: 289k, 1tr2, 289.000', async () => {
  const d = await nap('dinh-dang.js');
  assert.equal(d.docTien('289k'), 289000);
  assert.equal(d.docTien('1tr2'), 1200000);
  assert.equal(d.docTien('289.000'), 289000);
  assert.equal(d.docTien(''), null);
  assert.ok(Number.isNaN(d.docTien('abc')));
});

test('USD kèm tiền Việt theo tỷ giá cài đặt', async () => {
  const d = await nap('dinh-dang.js');
  assert.equal(d.vnd(0.05), '≈ 1.300đ');
  d.datTyGia(25000);
  assert.equal(d.vnd(0.05), '≈ 1.250đ');
  d.datTyGia(26000);
  assert.equal(d.layTyGia(), 26000);
});

test('ngày dd/mm/yyyy giờ Việt Nam và đọc ngày gõ tay', async () => {
  const d = await nap('dinh-dang.js');
  assert.equal(d.ngay('2026-09-27T18:00:00Z'), '28/09/2026'); // 01:00 sáng giờ VN
  assert.equal(d.gioPhut('2026-09-27T10:05:00Z'), '27/09 17:05');
  assert.equal(d.gioPhut('2026-09-27T10:05:00Z', true), '27/09/2026 17:05');
  assert.equal(d.docNgay('27/9/2026'), '2026-09-27');
  assert.equal(d.docNgay('31/02/2026'), null);
  assert.equal(d.docNgay('hôm nay'), null);
  assert.equal(d.ngayTuIso('2026-09-27'), '27/09/2026');
});

test('bảng trạng thái: đơn, sản phẩm, kho, lạ → xám', async () => {
  const t = await nap('trang-thai.js');
  assert.deepEqual(t.thongTin('don', 'da_xac_nhan'), { ten: 'Cần gửi', mau: 'info' });
  assert.equal(t.thongTin('san_pham', 'ngung_ban').mau, 'bad');
  assert.equal(t.thongTin('kho', 'it').mau, 'warn');
  assert.deepEqual(t.thongTin('don', 'la_hoac'), { ten: 'la_hoac', mau: 'mute' });
  for (const [loai, bang] of Object.entries(t.BANG)) {
    for (const [ma, v] of Object.entries(bang)) assert.ok(t.BIEU_TUONG[v.mau], `${loai}.${ma} có màu hợp lệ`);
  }
});

test('đường dẫn cũ đổi sang đường mới, giữ đuôi và tham số', async () => {
  const { doiDuongCu } = await nap('duong-cu.js');
  assert.equal(doiDuongCu('#/tong-quan'), '#/hom-nay');
  assert.equal(doiDuongCu('#/hop-thu?loc=can_nguoi'), '#/tin-nhan?loc=can_nguoi');
  assert.equal(doiDuongCu('#/agent'), '#/cai-dat/tro-ly-ai');
  assert.equal(doiDuongCu('#/agent/nhat-ky/abc'), '#/cai-dat/tro-ly-ai/nhat-ky/abc');
  assert.equal(doiDuongCu('#/don?loc=x'), null);
  assert.equal(doiDuongCu('#/hom-nay'), null);
});
