'use strict';

/**
 * F-118 (BH10): nhãn "từng hoàn" cho người của shop — khách có ≥ 1 đơn Hoàn → nhãn đỏ ở danh sách đơn, hồ sơ khách và dòng "Vừa chốt".
 * Không câu mẫu / thẻ gửi khách nào chứa nhãn này; ngưỡng chặn AI tự xác nhận (nguong_hoan: 2) giữ nguyên. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('khách 1 đơn hoàn → tomTatMua.so_hoan, nhãn ở đơn mới; khách chưa hoàn → không nhãn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const don = require('../server/nghiep-vu/don');
  const kh = require('../server/nghiep-vu/khach');
  const a = taoSanPhamMau();
  const lan = kh.taoKhach({ ten: 'Lan', sdt: '0912345678', diaChi: '12 Lý Thái Tổ, Bắc Ninh' }).khach;
  const hoa = kh.taoKhach({ ten: 'Hoa', sdt: '0987654321', diaChi: '3 Trần Phú, Bắc Ninh' }).khach;
  const giao = { ten: 'Lan', sdt: '0912 345 678', diaChi: '12 Lý Thái Tổ, Bắc Ninh' };
  const d1 = don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'M').id }], nguon: 'nguoi', khachId: lan.id });
  don.datThongTinGiao(d1.id, giao, { boi: 'nguoi' });
  don.doiTrangThai(d1.id, 'da_xac_nhan');
  don.doiTrangThai(d1.id, 'da_gui');
  don.doiTrangThai(d1.id, 'hoan');

  const tt = kh.tomTatMua(lan.id);
  assert.equal(tt.so_hoan, 1);
  assert.equal(tt.nhan_hoan, 'Từng hoàn 1 đơn — nên gọi xác nhận / chuyển khoản trước');
  assert.equal(kh.nhanHoan(lan.id), tt.nhan_hoan);
  assert.equal(kh.tomTatMua(hoa.id).so_hoan, 0);
  assert.equal(kh.nhanHoan(hoa.id), null);

  const d2 = don.taoDon({ mon: [{ phan_loai_id: a.pl('Trắng', 'M').id }], nguon: 'nguoi', khachId: lan.id });
  const d3 = don.taoDon({ mon: [{ phan_loai_id: a.pl('Trắng', 'L').id }], nguon: 'nguoi', khachId: hoa.id });
  const ds = don.danhSach();
  assert.equal(ds.find((x) => x.id === d2.id).so_hoan_khach, 1);
  assert.equal(ds.find((x) => x.id === d3.id).so_hoan_khach, 0);
  // Ngưỡng chặn AI tự xác nhận vẫn là 2.
  assert.equal(require('../server/nghiep-vu/cai-dat').banHang().nguong_hoan, 2);
});

test('nhãn "từng hoàn" không có trong câu mẫu gửi khách, thẻ, lời dặn AI', () => {
  const khach = require('../server/nghiep-vu/cau-mau-khach').tatCa();
  assert.ok(!khach.some((x) => /từng hoàn/i.test(x.cau)));
  const doi = JSON.stringify(require('../server/cau-hinh/doi-ai-cau-mau.json'));
  assert.ok(!/từng hoàn/i.test(doi));
});
