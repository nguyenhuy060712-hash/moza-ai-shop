'use strict';

// Giá gạch chỉ khi có bằng chứng (SPEC.md F-76, #104).

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('giá gạch: chưa có đơn giao → ẩn ở màn hình và thẻ AI; đơn giao 10 ngày trước → hiện; 40 ngày → ẩn; đơn diễn tập không tính', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const don = require('../server/nghiep-vu/don');
  const db = require('../server/db/ket-noi').csdl();
  const { dung } = require('../server/man-hinh-san-pham');
  const s = taoSanPhamMau({ gia: '350k' });
  const giaoDon = ({ dienTap = false, ngayTruoc = 10 } = {}) => {
    const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'nguoi', tenNhan: 'A', sdtNhan: '+84912000111', diaChiNhan: 'X', dienTap });
    don.doiTrangThai(d.id, 'da_xac_nhan');
    don.doiTrangThai(d.id, 'da_gui');
    don.doiTrangThai(d.id, 'da_giao');
    db.prepare("UPDATE don_lich_su SET luc = ? WHERE don_id = ? AND den = 'da_giao'").run(new Date(Date.now() - ngayTruoc * 86400e3).toISOString(), d.id);
    return d;
  };
  const d40 = giaoDon({ ngayTruoc: 40 });
  giaoDon({ dienTap: true, ngayTruoc: 5 });
  const kq = sp.suaSanPham(s.san_pham.id, { gia: '289k', gia_goc: '350k' });
  assert.ok(kq.canh_bao.some((c) => /Chưa có đơn đã giao ở giá gốc/.test(c)), 'lưu có cảnh báo giải thích');
  const the = () => sp.theChoAi(sp.laySanPham(s.san_pham.id));
  const giaGach = () => dung({ mau: 'gioi_thieu', so: 12 })?.san_pham?.gia_goc ?? dung({ mau: 'gioi_thieu', so: 12 })?.sp?.gia_goc ?? null;
  assert.equal(sp.bangChungGiaGoc(sp.laySanPham(s.san_pham.id)), false, 'đơn giao 40 ngày trước và đơn diễn tập không tính');
  assert.doesNotMatch(JSON.stringify(the()), /Giá gốc/);
  assert.equal(giaGach(), null);
  assert.equal(sp.chiTiet(s.san_pham.id).san_pham.gia_goc_co_bang_chung, false);
  // Đơn giao 10 ngày trước ở đúng giá gốc (đơn tạo khi giá bán còn là 350k).
  db.prepare("UPDATE don_lich_su SET luc = ? WHERE don_id = ? AND den = 'da_giao'").run(new Date(Date.now() - 10 * 86400e3).toISOString(), d40.id);
  assert.equal(sp.bangChungGiaGoc(sp.laySanPham(s.san_pham.id)), true);
  assert.match(JSON.stringify(the()), /Giá gốc \(trước giảm\): 350\.000đ/);
  assert.equal(giaGach(), '350.000đ');
});
