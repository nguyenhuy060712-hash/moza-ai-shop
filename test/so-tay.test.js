'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');
const soTay = require('../server/nghiep-vu/so-tay');

test('Sổ tay shop (F-05)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);

  await t.test('có sẵn 6 mục mồi của shop bán hàng, nội dung trống', () => {
    const ds = soTay.danhSachMuc();
    assert.deepEqual(ds.map((m) => m.tieu_de), ['Giới thiệu shop', 'Cách chọn size', 'Giao hàng', 'Thanh toán', 'Đổi trả', 'Câu hỏi thường gặp']);
    assert.ok(ds.every((m) => m.noi_dung === '' && m.phien_ban === 1));
    assert.equal(soTay.demMucTrong(), ds.length);
  });

  await t.test('gieo lần nữa không nhân đôi mục', () => {
    const truoc = soTay.danhSachMuc().length;
    soTay.gieoMucMoi();
    assert.equal(soTay.danhSachMuc().length, truoc);
  });

  await t.test('sửa tạo bản sửa mới, bản cũ đọc lại được; lưu không đổi gì thì không tạo bản', () => {
    const m = soTay.danhSachMuc().find((x) => x.tieu_de === 'Đổi trả');
    soTay.suaMuc(m.id, { noi_dung: 'Đổi size trong 3 ngày, còn nguyên tem mác.' });
    const cuoi = soTay.suaMuc(m.id, { noi_dung: 'Đổi size trong 7 ngày, còn nguyên tem mác. Hàng lỗi shop chịu phí ship.' });
    assert.equal(cuoi.phien_ban, 3);
    assert.deepEqual(soTay.banSuaMuc(m.id).map((b) => b.noi_dung),
      ['Đổi size trong 7 ngày, còn nguyên tem mác. Hàng lỗi shop chịu phí ship.', 'Đổi size trong 3 ngày, còn nguyên tem mác.', '']);
    assert.equal(soTay.suaMuc(m.id, { noi_dung: cuoi.noi_dung }).phien_ban, 3);
    assert.equal(soTay.demMucTrong(), soTay.danhSachMuc().length - 1);
  });

  await t.test('thêm mục mới đứng cuối danh sách; kiểm dữ liệu vào', () => {
    const moi = soTay.taoMuc({ tieu_de: 'Giờ mở cửa', noi_dung: 'Shop trả lời tin nhắn từ 8h đến 22h.' });
    const ds = soTay.danhSachMuc();
    assert.equal(ds[ds.length - 1].id, moi.id);
    assert.throws(() => soTay.taoMuc({ noi_dung: 'thiếu tiêu đề' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => soTay.taoMuc({ tieu_de: 'Hai\ndòng' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => soTay.layMuc('st_khongco'), (e) => e.http === 404);
  });

  await t.test('bản sửa Sổ tay chỉ được thêm, không xóa', () => {
    const { csdl } = require('../server/db/ket-noi');
    const m = soTay.danhSachMuc()[0];
    assert.throws(() => csdl().prepare('DELETE FROM so_tay_ban_sua WHERE so_tay_id = ?').run(m.id), /chỉ được thêm/);
  });
});
