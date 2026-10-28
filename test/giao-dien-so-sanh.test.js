// GD1 (F-125): so sánh bản cũ / bản mới theo dòng (dãy con chung dài nhất tự viết).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const nap = () => import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', 'so-sanh.js')).href);

test('giống hệt → toàn dòng giữ nguyên, không có đổi', async () => {
  const { soSanhDong, demDoi } = await nap();
  const ops = soSanhDong('a\nb\nc', 'a\nb\nc');
  assert.deepEqual(ops.map((o) => o.loai), ['giu', 'giu', 'giu']);
  assert.deepEqual(demDoi(ops), { them: 0, sua: 0, bo: 0 });
});

test('thêm dòng, bỏ dòng, sửa dòng', async () => {
  const { soSanhDong, demDoi } = await nap();
  assert.deepEqual(demDoi(soSanhDong('a\nc', 'a\nb\nc')), { them: 1, sua: 0, bo: 0 }, 'thêm b');
  assert.deepEqual(demDoi(soSanhDong('a\nb\nc', 'a\nc')), { them: 0, sua: 0, bo: 1 }, 'bỏ b');
  const ops = soSanhDong('giá 100k\nship 30k', 'giá 120k\nship 30k');
  assert.deepEqual(ops, [{ loai: 'sua', cu: 'giá 100k', moi: 'giá 120k' }, { loai: 'giu', chu: 'ship 30k' }]);
});

test('khối đổi nhiều dòng: ghép cặp thành Sửa, phần dư là Thêm / Bỏ', async () => {
  const { soSanhDong, demDoi } = await nap();
  assert.deepEqual(demDoi(soSanhDong('x\ny\nz', 'x\nY\nZ\nW')), { them: 1, sua: 2, bo: 0 });
  assert.deepEqual(demDoi(soSanhDong('x\ny\nz\nw', 'x\nY')), { them: 0, sua: 1, bo: 2 });
});

test('so với trống: toàn bộ là dòng thêm; hai bên trống không báo đổi', async () => {
  const { soSanhDong, demDoi } = await nap();
  assert.deepEqual(demDoi(soSanhDong('', 'một\nhai')), { them: 1, sua: 1, bo: 0 }, 'dòng trống cũ được sửa thành "một"');
  assert.deepEqual(demDoi(soSanhDong('', '')), { them: 0, sua: 0, bo: 0 });
});

test('văn bản dài: đúng so với cách đếm trực tiếp (LCS)', async () => {
  const { soSanhDong } = await nap();
  const cu = Array.from({ length: 200 }, (_, i) => `dòng ${i}`);
  const moi = cu.filter((_, i) => i % 7 !== 0).concat(['dòng mới']);
  const ops = soSanhDong(cu.join('\n'), moi.join('\n'));
  const giu = ops.filter((o) => o.loai === 'giu').length;
  assert.equal(giu, cu.filter((_, i) => i % 7 !== 0).length, 'mọi dòng còn lại đều được giữ');
  // dựng lại bản mới từ kết quả so sánh phải ra đúng bản mới
  const dung = ops.flatMap((o) => (o.loai === 'giu' || o.loai === 'them' ? [o.chu] : o.loai === 'sua' ? [o.moi] : []));
  assert.deepEqual(dung, moi);
});

test('bảng hai cột cho việc "cũ → mới" của Nói với Mai', async () => {
  const { tachCuMoi } = await nap();
  assert.deepEqual(tachCuMoi('Điều chỉnh: 12-DEN-M (Áo 12 Đen / M) 5 → 8'), { truoc: 'Điều chỉnh: 12-DEN-M (Áo 12 Đen / M) 5', sau: '8' });
  assert.equal(tachCuMoi('Nhập thêm 10 áo 12'), null);
});
