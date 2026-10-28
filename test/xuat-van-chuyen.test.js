'use strict';

/**
 * Xuất file đơn Cần gửi theo mẫu hãng vận chuyển (SPEC.md F-101, 6.4 cách B): "Chung" y hệt file cũ, thu hộ đúng, tách tỉnh / xã
 * theo 34 tỉnh, không có ghi chú nội bộ; hãng chưa có file mẫu thì báo rõ.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

/** Bản CSV trước BH8 (chép nguyên để so byte). */
function csvCu(ds) {
  const kh = require('../server/nghiep-vu/khach');
  const o = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const dong = [['Mã đơn', 'Ngày tạo', 'Trạng thái', 'Người nhận', 'Số điện thoại', 'Địa chỉ', 'Món', 'Tổng hàng', 'Phí ship', 'Tổng tiền',
    'Thanh toán', 'Đã nhận tiền', 'Mã vận đơn', 'Ghi chú'].map(o).join(',')];
  for (const d of ds) {
    dong.push([d.ma, new Date(d.tao_luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), d.ten_trang_thai, d.ten_nhan,
      kh.hienSdt(d.sdt_nhan), d.dia_chi_nhan, d.dong.map((x) => `${x.ten_chup} x${x.so_luong}`).join('; '), d.tong_hang, d.phi_ship,
      d.tong_tien, d.thanh_toan === 'cod' ? 'COD' : 'Chuyển khoản', d.da_nhan_tien_luc ? 'Có' : 'Chưa', d.ma_van_don, d.ghi_chu].map(o).join(','));
  }
  return `﻿${dong.join('\r\n')}`;
}

test('"Chung" y hệt file cũ; "Nhập hàng loạt": thu hộ = tổng (COD) / 0 (đã nhận chuyển khoản), khối lượng 300 g có cờ, không ghi chú nội bộ; hãng chưa có mẫu → CAN_FILE_MAU', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ phi_ship: '20k' });
  const don = require('../server/nghiep-vu/don');
  const xvc = require('../server/nghiep-vu/xuat-van-chuyen');
  const mau = taoSanPhamMau({ gia: '159k', ton: 20 });
  const tao = (dc, gc = '') => don.taoDon({ mon: [{ phan_loai_id: mau.pl('Đen', 'M').id, so_luong: 2 }], nguon: 'nguoi', tenNhan: 'Lan', sdtNhan: '+84912345678', diaChiNhan: dc, ghiChu: gc });
  const a = tao('12 Lý Thái Tổ, P. Suối Hoa, Bắc Ninh', 'KHÁCH KHÓ TÍNH — gọi trước');
  const b = tao('nhà bác Hai gần chợ');
  don.datThongTinGiao(b.id, { thanhToan: 'chuyen_khoan' });
  don.nhanTien(b.id);
  const ds = [don.layDon(a.id), don.layDon(b.id)];
  assert.equal(xvc.xuat(ds, 'chung').noi_dung, csvCu(ds), 'so byte với file cũ');
  const kq = xvc.xuat(ds, 'nhap_hang_loat');
  const dongs = kq.noi_dung.replace(/^﻿/, '').split('\r\n');
  assert.equal(dongs[0], '"Mã đơn khách","Tên người nhận","Số điện thoại","Địa chỉ chi tiết","Phường / Xã","Tỉnh / Thành phố","Tên hàng","Số lượng","Khối lượng (g)","Tiền thu hộ (COD)","Giá trị hàng","Cần sửa địa chỉ"');
  assert.match(dongs[1], new RegExp(`^"${a.ma}","Lan","0912 345 678","12 Lý Thái Tổ","Suối Hoa","Bắc Ninh",".*","2","600","338000","318000",""$`));
  assert.match(dongs[2], /"0","318000","X"$/, 'đã nhận chuyển khoản → thu hộ 0; địa chỉ không rõ → Cần sửa');
  assert.doesNotMatch(kq.noi_dung, /KHÁCH KHÓ TÍNH/, 'không ghi chú nội bộ');
  assert.deepEqual(kq.can_sua.map((x) => x.ma), [b.ma]);
  assert.deepEqual(kq.khoi_luong_mac_dinh, [a.ma, b.ma], 'thiếu cân nặng → 300 g có cờ');
  assert.throws(() => xvc.xuat(ds, 'ghtk'), (e) => e.ma === 'CAN_FILE_MAU' && /Tải file mẫu/i.test(e.message));
});

test('tách địa chỉ: 30 địa chỉ mẫu — tỉnh đúng ≥ 90%, tên tỉnh cũ đổi sang tên mới và gắn cờ, không rõ thì "Cần sửa"', async () => {
  const { tachDiaChi } = require('../server/nghiep-vu/xuat-van-chuyen');
  const mau = [
    ['12 Lý Thái Tổ, P. Suối Hoa, Bắc Ninh', 'Bắc Ninh'], ['số 5 ngõ 10 Láng Hạ, Phường Láng, Hà Nội', 'Hà Nội'], ['123 Nguyễn Huệ, Phường Sài Gòn, TP.HCM', 'Hồ Chí Minh'],
    ['45 Trần Phú, xã Tân Phú, Đồng Nai', 'Đồng Nai'], ['7 Hùng Vương, phường Hải Châu, Đà Nẵng', 'Đà Nẵng'], ['88 Lê Lợi, phường Thuận Hóa, Huế', 'Huế'],
    ['thôn 3, xã Yên Lạc, Vĩnh Phúc', 'Phú Thọ'], ['số 9, phường Kinh Bắc, bac ninh', 'Bắc Ninh'], ['21 Trần Hưng Đạo, phường Hồng Bàng, Hải Phòng', 'Hải Phòng'],
    ['tổ 5, phường Phan Thiết, Lâm Đồng', 'Lâm Đồng'], ['36 Quang Trung, phường Quy Nhơn, Gia Lai', 'Gia Lai'], ['ấp 2, xã Tân An, Tây Ninh', 'Tây Ninh'],
    ['12 Hai Bà Trưng, phường Ninh Kiều, Cần Thơ', 'Cần Thơ'], ['số 3, xã Chợ Lách, Vĩnh Long', 'Vĩnh Long'], ['khóm 4, phường Mỹ Tho, Đồng Tháp', 'Đồng Tháp'],
    ['số 10, phường Bạc Liêu, Cà Mau', 'Cà Mau'], ['15 Nguyễn Trung Trực, phường Rạch Giá, An Giang', 'An Giang'], ['2 Lê Duẩn, phường Buôn Ma Thuột, Đắk Lắk', 'Đắk Lắk'],
    ['5 Trần Phú, phường Nha Trang, Khánh Hòa', 'Khánh Hòa'], ['10 Phan Bội Châu, phường Vinh Phú, Nghệ An', 'Nghệ An'], ['3 Lê Lai, phường Hạc Thành, Thanh Hóa', 'Thanh Hóa'],
    ['tổ 12, phường Phan Đình Phùng, Thái Nguyên', 'Thái Nguyên'], ['số 1, phường Hạ Long, Quảng Ninh', 'Quảng Ninh'], ['8 Lê Lợi, phường Đông Hà, Quảng Trị', 'Quảng Trị'],
    ['6 Hùng Vương, phường Cẩm Thành, Quảng Ngãi', 'Quảng Ngãi'], ['số 4, xã Bình Giang, Hải Dương', 'Hải Phòng'], ['12 Nguyễn Du, phường Hoa Lư, Ninh Bình', 'Ninh Bình'],
    ['xóm 2, xã Tiên Lữ, Hưng Yên', 'Hưng Yên'], ['số 7, phường Đông Kinh, Lạng Sơn', 'Lạng Sơn'], ['nhà bác Hai gần chợ', ''],
  ];
  assert.equal(mau.length, 30);
  const dung = mau.filter(([dc, tinh]) => tachDiaChi(dc).tinh === tinh).length;
  assert.ok(dung / mau.length >= 0.9, `${dung}/30`);
  const cu = tachDiaChi('thôn 3, xã Yên Lạc, Vĩnh Phúc');
  assert.deepEqual([cu.tinh, cu.ten_cu, cu.chac], ['Phú Thọ', true, false], 'tên tỉnh cũ → tên mới + cờ Cần sửa');
  assert.equal(tachDiaChi('nhà bác Hai gần chợ').chac, false);
});
