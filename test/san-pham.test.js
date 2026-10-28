'use strict';

/**
 * Sản phẩm (F-51), bảng size, tồn kho (F-52), đọc tiền, thẻ sản phẩm cho AI (mục 5, A.4 K2) và API tương ứng.
 * Không gọi mạng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau, ANH_GIA } = require('./ho-tro');
const { docTien, hienTien } = require('../server/nghiep-vu/chung');

const loiMa = (ma, http) => (e) => e.ma === ma && (http === undefined || e.http === http);

test('đọc tiền người dùng gõ và hiện tiền (docTien, hienTien)', () => {
  const bang = [
    ['289k', 289000], ['289K', 289000], ['289.000', 289000], ['289.000đ', 289000], ['289,000', 289000], ['289000', 289000],
    ['289 000', 289000], ['289.000 VND', 289000], ['289.000 đồng', 289000], ['1tr2', 1200000], ['1,2tr', 1200000], ['1.2tr', 1200000],
    ['1 triệu 2', 1200000], ['1 trieu 2', 1200000], ['1tr', 1000000], ['1tr250', 1250000], ['1,25tr', 1250000], ['1,5k', 1500],
    [289000, 289000], [0, 0],
  ];
  for (const [vao, mong] of bang) assert.equal(docTien(vao), mong, JSON.stringify(vao));
  assert.equal(docTien(''), null, 'ô trống là chưa nhập');
  assert.equal(docTien(null), null);
  assert.throws(() => docTien('', { ten: 'Giá bán', batBuoc: true }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE' && /giá bán/.test(e.message));
  for (const sai of ['abc', '289kk', '1tr2tr', -5, 1.5]) {
    assert.throws(() => docTien(sai, { ten: 'Giá bán' }), loiMa('DU_LIEU_KHONG_HOP_LE'), JSON.stringify(sai));
  }
  assert.equal(hienTien(289000), '289.000đ');
  assert.equal(hienTien(1200000), '1.200.000đ');
  assert.equal(hienTien(30000), '30.000đ');
  assert.equal(hienTien(0), '0đ');
  assert.equal(hienTien(null), '');
});

test('sản phẩm, phân loại, bảng size, kho (F-51, F-52)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const bangSize = require('../server/nghiep-vu/bang-size');
  const kho = require('../server/nghiep-vu/kho');
  const { csdl } = require('../server/db/ket-noi');

  let mau; // áo số 12 của taoSanPhamMau

  await t.test('tạo sản phẩm mẫu: id sp_…, bản 1, Đang bán, phân loại màu × cỡ, mã phân loại <số>-<MÀU>-<CỠ>', () => {
    mau = taoSanPhamMau();
    const s = mau.san_pham;
    assert.match(s.id, /^sp_[0-9a-z]{12}$/);
    assert.equal(s.so, 12);
    assert.equal(s.gia, 289000, 'giá "289k" lưu thành số nguyên VND');
    assert.equal(s.gia_von, 150000);
    assert.equal(s.trang_thai, 'dang_ban');
    assert.equal(s.phien_ban, 1);
    assert.equal(s.ten_goi, 'áo số 12');
    assert.equal(s.ten_day_du, 'Áo số 12 · Sơ mi linen tay ngắn');
    assert.deepEqual(mau.phan_loai.map((p) => p.sku), ['12-DEN-M', '12-DEN-L', '12-TRANG-M', '12-TRANG-L']);
    assert.ok(mau.phan_loai.every((p) => p.ton === 5 && p.con_ban_duoc === 5 && p.gia === null));
    assert.deepEqual(mau.canh_bao, []);
    assert.equal(sp.banSua(s.id).length, 1);
    assert.equal(s.anh.length, 1);
    assert.equal(s.anh[0].mau, 'Đen', 'ảnh gắn đúng màu');
    assert.ok(sp.duongAnh(s.id, s.anh[0].tep), 'ảnh đã chép từ khu tạm vào thư mục sản phẩm');
  });

  await t.test('tồn ban đầu ghi qua kho: có lịch sử "nhập hàng", không tạo bản sửa', () => {
    const ls = kho.lichSu({ sanPhamId: mau.san_pham.id });
    assert.equal(ls.length, 4);
    assert.ok(ls.every((x) => x.ly_do === 'nhap_hang' && x.thay_doi === 5 && x.ton_sau === 5));
    assert.deepEqual(kho.doiChieu(), []);
  });

  await t.test('số sản phẩm trùng → SP_TRUNG_SO (409), gợi ý số kế tiếp; bỏ trống số thì tự lấy số kế tiếp', () => {
    assert.throws(() => sp.taoSanPham({ so: 12, ten: 'Áo khác', danh_muc: 'ao_thun', gia: '199k', phan_loai: [{ gt1: 'Đen', gt2: 'M' }] }),
      (e) => e.ma === 'SP_TRUNG_SO' && e.http === 409 && /gợi ý 13/.test(e.message));
    const q = sp.taoSanPham({ ten: 'Quần jean ống rộng', danh_muc: 'quan_jean', gia: '1tr2', phan_loai: [{ gt1: 'Xanh', gt2: '28' }, { gt1: 'Xanh', gt2: '29' }] });
    assert.equal(q.san_pham.so, 13);
    assert.equal(q.san_pham.gia, 1200000);
    assert.equal(q.san_pham.trang_thai, 'nhap', 'mặc định là Nháp');
    assert.equal(q.san_pham.ten_goi, 'quần số 13');
    assert.deepEqual(q.phan_loai.map((p) => [p.sku, p.ton]), [['13-XANH-28', 0], ['13-XANH-29', 0]]);
    assert.throws(() => sp.suaSanPham(q.san_pham.id, { so: 12 }), loiMa('SP_TRUNG_SO', 409));
  });

  await t.test('Đang bán cần ít nhất 1 ảnh; Nháp lưu được khi chưa có ảnh', () => {
    assert.throws(() => sp.taoSanPham({ so: 20, ten: 'Áo thun trơn', danh_muc: 'ao_thun', gia: '99k', trang_thai: 'dang_ban', phan_loai: [{ gt1: 'Đen', gt2: 'M' }] }),
      (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE' && /ít nhất 1 ảnh/.test(e.message));
    assert.equal(sp.layTheoSo(20), null, 'lỗi thì không ghi gì');
    const x = sp.taoSanPham({ so: 20, ten: 'Áo thun trơn', danh_muc: 'ao_thun', gia: '99k', phan_loai: [{ gt1: 'Đen', gt2: 'M' }] });
    assert.throws(() => sp.doiTrangThai(x.san_pham.id, 'dang_ban'), /ít nhất 1 ảnh/);
    const tep = sp.luuAnhTam(ANH_GIA);
    const y = sp.suaSanPham(x.san_pham.id, { anh: [{ tep, mau: 'đen' }] });
    assert.equal(y.san_pham.anh[0].mau, 'Đen', 'màu của ảnh khớp phân loại dù gõ khác hoa thường');
    assert.equal(sp.doiTrangThai(x.san_pham.id, 'dang_ban').san_pham.trang_thai, 'dang_ban');
    assert.equal(sp.doiTrangThai(x.san_pham.id, 'ngung_ban').san_pham.trang_thai, 'ngung_ban');
    assert.throws(() => sp.doiTrangThai(x.san_pham.id, 'xoa'), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.luuAnhTam(Buffer.from('không phải ảnh')), loiMa('ANH_KHONG_HOP_LE'));
  });

  await t.test('sửa giá 3 lần → 4 bản sửa, bản nào cũng dựng lại được thẻ; lưu không đổi gì thì không tạo bản mới', () => {
    const id = mau.san_pham.id;
    sp.suaSanPham(id, { gia: '299k' });
    sp.suaSanPham(id, { gia: '309.000đ' });
    const cuoi = sp.suaSanPham(id, { gia: 319000 });
    assert.equal(cuoi.san_pham.phien_ban, 4);
    const ds = sp.banSua(id);
    assert.deepEqual(ds.map((b) => b.gia), [319000, 309000, 299000, 289000]);
    assert.deepEqual(ds.map((b) => b.phien_ban), [4, 3, 2, 1]);
    assert.ok(ds.every((b) => Array.isArray(b.phan_loai) && b.phan_loai.length === 4), 'bản sửa chụp cả phân loại');
    assert.match(sp.theChoAi(sp.layBanSua(id, 1)), /^Giá: 289\.000đ$/m, 'thẻ bản cũ vẫn đúng giá cũ');
    assert.match(sp.theChoAi(sp.laySanPham(id)), /^Giá: 319\.000đ$/m);
    const giu = sp.suaSanPham(id, { gia: '319k', ten: 'Sơ mi linen tay ngắn' });
    assert.equal(giu.san_pham.phien_ban, 4, 'không đổi gì');
    kho.nhap([{ phan_loai_id: mau.pl('Đen', 'M').id, so: 1 }]);
    assert.equal(sp.laySanPham(id).phien_ban, 4, 'tồn kho đổi không tạo bản sửa');
    kho.dieuChinh([{ phan_loai_id: mau.pl('Đen', 'M').id, ton: 5 }]);
    sp.suaSanPham(id, { gia: '289k' });
  });

  await t.test('phân loại: giá riêng, mã tự đặt, trùng mã / trùng tổ hợp bị từ chối, bỏ ô thì không xóa dòng', () => {
    const id = mau.san_pham.id;
    const ds = [
      { gt1: 'Đen', gt2: 'M' }, { gt1: 'Đen', gt2: 'L' }, { gt1: 'Trắng', gt2: 'M' }, { gt1: 'Trắng', gt2: 'L' },
      { gt1: 'Đen', gt2: 'XXL', gia: '319k', ton: 2 },
    ];
    const kq = sp.suaSanPham(id, { phan_loai: ds });
    const xxl = kq.phan_loai.find((p) => p.gt2 === 'XXL');
    assert.deepEqual([xxl.sku, xxl.gia, xxl.ton], ['12-DEN-XXL', 319000, 2]);
    assert.equal(kq.phan_loai.find((p) => p.sku === '12-DEN-M').ton, 5, 'ô cũ giữ nguyên tồn');
    const the = sp.theChoAi(kq.san_pham);
    assert.match(the, /^Giá: 289\.000đ$/m);
    assert.match(the, /^Giá Đen\/XXL: 319\.000đ$/m, 'giá riêng phân loại hiện đúng');
    assert.doesNotMatch(the, /Giá Đen\/M:/, 'phân loại theo giá mẫu không có dòng giá riêng');
    assert.match(the, /^Phân loại: Màu \(Đen, Trắng\) × Cỡ \(M, L, XXL\)$/m);

    assert.throws(() => sp.suaSanPham(id, { phan_loai: [...ds, { gt1: 'đen', gt2: 'm' }] }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE' && /bị trùng/.test(e.message));
    assert.throws(() => sp.suaSanPham(id, { phan_loai: [{ gt1: 'Đen', gt2: 'M', sku: 'AO-1' }, { gt1: 'Đen', gt2: 'L', sku: 'ao-1' }] }), loiMa('SKU_TRUNG', 409));
    assert.throws(() => sp.taoSanPham({ so: 30, ten: 'Áo khác', danh_muc: 'ao_thun', gia: '99k', phan_loai: [{ gt1: 'Đen', gt2: 'M', sku: '12-den-m' }] }),
      loiMa('SKU_TRUNG', 409), 'mã phân loại đã có ở sản phẩm khác');
    assert.throws(() => sp.suaSanPham(id, { phan_loai: [] }), loiMa('DU_LIEU_KHONG_HOP_LE'));

    // Bỏ Đen/XXL: dòng vẫn còn (đơn cũ có thể trỏ tới) nhưng không bán, không vào thẻ.
    const bo = sp.suaSanPham(id, { phan_loai: ds.slice(0, 4) });
    assert.equal(bo.phan_loai.length, 5);
    assert.equal(bo.phan_loai.find((p) => p.gt2 === 'XXL').bo, true);
    assert.ok(!kho.conHang(id).some((p) => p.gt2 === 'XXL'));
    assert.doesNotMatch(sp.theChoAi(bo.san_pham), /XXL/);
    assert.match(sp.theChoAi(sp.layBanSua(id, bo.san_pham.phien_ban - 1)), /Giá Đen\/XXL: 319\.000đ/, 'bản sửa trước vẫn có giá riêng');

    // Hàng một cỡ: nhóm 2 để trống → mã <số>-<MÀU>.
    const pk = sp.taoSanPham({ so: 31, ten: 'Túi tote vải', danh_muc: 'phu_kien', gia: '120k', nhom: { t1: 'Màu', t2: null },
      phan_loai: [{ gt1: 'Kem' }, { gt1: 'Nâu đất' }] });
    assert.deepEqual(pk.phan_loai.map((p) => [p.sku, p.gt2]), [['31-KEM', null], ['31-NAUDAT', null]]);
    assert.equal(sp.skuTuSinh(12, 'Xanh rêu', 'XL'), '12-XANHREU-XL');
  });

  await t.test('thông số theo danh mục: khóa lạ bị bỏ và báo THONG_SO_LA, lựa chọn lạ bị bỏ, đổi danh mục giữ ô trùng tên', () => {
    const x = sp.taoSanPham({ so: 40, ten: 'Áo kiểu cổ nơ', danh_muc: 'ao_kieu', gia: '259k', phan_loai: [{ gt1: 'Hồng', gt2: 'S' }],
      thong_so: { doi_tuong: 'nu', chat_lieu: ['voan', 'vang_bac'], chat_lieu_ghi: 'Voan hai lớp', kieu_dang: 'suong', mau_la: 'x', doi_tuong_ghi: 'y' } });
    assert.deepEqual(x.san_pham.thong_so, { doi_tuong: 'nu', chat_lieu: ['voan'], chat_lieu_ghi: 'Voan hai lớp', kieu_dang: 'suong' });
    assert.equal(x.canh_bao.length, 1);
    assert.match(x.canh_bao[0], /THONG_SO_LA/);
    assert.match(x.canh_bao[0], /mau_la/);
    assert.match(x.canh_bao[0], /doi_tuong_ghi/, 'ô ghi thêm chỉ có ở thông số cho phép');
    assert.match(sp.theChoAi(x.san_pham), /^- Chất liệu: Voan — Voan hai lớp$/m);

    const doi = sp.suaSanPham(x.san_pham.id, { danh_muc: 'phu_kien' });
    assert.deepEqual(doi.san_pham.thong_so, { doi_tuong: 'nu', chat_lieu: ['voan'], chat_lieu_ghi: 'Voan hai lớp' }, 'kiểu dáng không có ở phụ kiện');
    assert.match(doi.canh_bao[0], /THONG_SO_LA.*kieu_dang/);
    assert.throws(() => sp.suaSanPham(x.san_pham.id, { danh_muc: 'khong_co' }), loiMa('DU_LIEU_KHONG_HOP_LE'));
  });

  await t.test('thẻ cho AI: không có giá vốn và ghi chú nội bộ; ô AI đoán ghi "(chưa xác nhận)" và không nằm trong nguồn kiểm tra', () => {
    const id = mau.san_pham.id;
    const s = sp.suaSanPham(id, { ai_doan: ['mo_ta', 'thong_so.kieu_dang', 'gia', 'ghi_chu_noi_bo'], ten_goi_khac: ['sơ mi đũi'] }).san_pham;
    assert.deepEqual(s.ai_doan, ['mo_ta', 'thong_so.kieu_dang'], 'chỉ ô được phép đoán mới mang nhãn');
    const the = sp.theChoAi(s);
    for (const bi of ['150.000', '150000', 'nhập xưởng A', 'Giá vốn', 'Ghi chú nội bộ']) assert.ok(!the.includes(bi), `thẻ lộ "${bi}"`);
    assert.match(the, /^Mô tả: \(chưa xác nhận\)$/m);
    assert.match(the, /^- Kiểu dáng \/ form: Suông \(chưa xác nhận\)$/m);
    assert.match(the, /^- Còn bán được Đen\/M: 5$/m);
    assert.match(the, /^- Size M: chiều cao 155–162 cm, cân nặng 48–55 kg$/m);
    assert.match(the, /^Khách hay gọi: sơ mi đũi$/m);

    const nguon = sp.nguonKiemTra(s);
    for (const bi of ['150.000', 'nhập xưởng A', 'Sơ mi linen mặc đi làm', 'Suông', 'chưa xác nhận']) assert.ok(!nguon.includes(bi), `nguồn kiểm tra có "${bi}"`);
    for (const co of ['Giá: 289.000đ', 'Còn bán được Đen/M: 5', 'Size M: chiều cao 155–162 cm, cân nặng 48–55 kg', '- vải linen mát, thấm hút']) {
      assert.ok(nguon.includes(co), `nguồn kiểm tra thiếu "${co}"`);
    }
    const doDu = sp.doDayDu(s);
    assert.ok(doDu.thieu.includes('kiểu dáng (AI đoán, chưa xác nhận)'));

    // Người xác nhận (lưu với ai_doan rỗng) → mô tả thành nguồn trích được.
    const xn = sp.suaSanPham(id, { ai_doan: [] }).san_pham;
    assert.ok(sp.nguonKiemTra(xn).includes('Sơ mi linen mặc đi làm, đi chơi đều hợp.'));
    assert.doesNotMatch(sp.theChoAi(xn), /chưa xác nhận/);

    // Còn bán được đọc lúc gọi: đơn đang giữ trừ đi (đơn giả chèn thẳng, nghiệp vụ đơn có test riêng).
    const db = csdl();
    const luc = new Date().toISOString();
    db.prepare(`INSERT INTO don (id, ma, nguon, trang_thai, tao_luc, sua_luc) VALUES ('dh_thugiu000001', 'DH-9001', 'nguoi', 'cho_xac_nhan', ?, ?)`).run(luc, luc);
    db.prepare(`INSERT INTO don_dong (id, don_id, phan_loai_id, san_pham_id, san_pham_phien_ban, so_luong, don_gia, ten_chup)
                VALUES ('dd_thugiu000001', 'dh_thugiu000001', ?, ?, ?, 2, 289000, 'Áo 12 · Đen / M')`).run(mau.pl('Đen', 'M').id, id, xn.phien_ban);
    assert.match(sp.theChoAi(xn), /^- Còn bán được Đen\/M: 3$/m);
    assert.throws(() => kho.dieuChinh([{ phan_loai_id: mau.pl('Đen', 'M').id, ton: 1 }]), /đang giữ 2/, 'tồn không thể nhỏ hơn số đang giữ');
    db.prepare("UPDATE don SET trang_thai = 'da_huy' WHERE id = 'dh_thugiu000001'").run();
    assert.match(sp.theChoAi(xn), /^- Còn bán được Đen\/M: 5$/m, 'đơn hủy thì trả hàng');
  });

  await t.test('bảng size: tạo, dòng cho AI, sửa có bản sửa, mọi sản phẩm dùng chung thấy số mới', () => {
    assert.throws(() => bangSize.taoBang({ ten: 'Thiếu cột', cot: [], hang: [{ co: 'M' }] }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => bangSize.taoBang({ ten: 'Cột lạ', cot: ['vong_tay_la'], hang: [{ co: 'M' }] }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => bangSize.taoBang({ ten: 'Trùng cỡ', cot: ['can_nang'], hang: [{ co: 'M' }, { co: 'm' }] }), /có hai hàng/);
    const b = bangSize.taoBang({ ten: 'Quần nữ', cot: ['can_nang', 'vong_eo'], hang: [{ co: '27', can_nang: '45 - 49', vong_eo: '64-66' }, { co: '28', can_nang: '50-54' }] });
    assert.equal(b.phien_ban, 1);
    assert.equal(b.hang[0].can_nang, '45–49', 'gạch nối viết thống nhất');
    assert.deepEqual(bangSize.dongChoAi(b), ['Size 27: cân nặng 45–49 kg, vòng eo 64–66 cm', 'Size 28: cân nặng 50–54 kg']);
    assert.deepEqual(bangSize.dongChoAi(null), []);

    const bs = mau.san_pham.bang_size_id;
    const cu = bangSize.layBang(bs);
    const moi = bangSize.suaBang(bs, { hang: cu.hang.map((h) => (h.co === 'M' ? { ...h, can_nang: '47-55' } : h)) });
    assert.equal(moi.phien_ban, 2);
    assert.equal(bangSize.suaBang(bs, { hang: moi.hang }).phien_ban, 2, 'không đổi thì không tạo bản');
    assert.equal(bangSize.banSuaBang(bs).length, 2);
    assert.match(bangSize.layBanSua(bs, 1).hang.find((h) => h.co === 'M').can_nang, /48–55/);
    assert.match(sp.theChoAi(sp.laySanPham(mau.san_pham.id)), /^- Size M: chiều cao 155–162 cm, cân nặng 47–55 kg$/m);
    assert.ok(bangSize.danhSachBang().some((x) => x.id === bs && x.so_san_pham >= 1));
  });

  await t.test('tìm theo số, tên, tên gọi khác (không dấu cũng được); lọc trạng thái, danh mục', () => {
    const so = (o) => sp.danhSach(o).map((x) => x.so);
    assert.deepEqual(so({ q: 'so mi linen' }), [12]);
    assert.deepEqual(so({ q: 'SO MI DUI' }), [12], 'tên gọi khác');
    assert.deepEqual(so({ q: '13' }), [13]);
    assert.deepEqual(so({ q: 'quan so 13' }), [13], 'chữ gọi trên live');
    assert.deepEqual(so({ danh_muc: 'quan_jean' }), [13]);
    assert.ok(sp.danhSach({ trang_thai: 'nhap' }).every((x) => x.trang_thai === 'nhap'));
    assert.deepEqual(so({ trang_thai: 'ngung_ban' }), [20]);
    assert.throws(() => sp.danhSach({ trang_thai: 'la' }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.deepEqual(sp.mucLucDangBan().map((x) => x.so), [12], 'mục lục cho AI chỉ có Đang bán');
    const d = sp.demTheoTrangThai();
    assert.deepEqual([d.dang_ban, d.ngung_ban], [1, 1]);
    assert.ok(d.nhap >= 3);
    assert.equal(sp.layTheoSo('số 12').id, mau.san_pham.id);
    assert.equal(sp.layTheoSo('#12').id, mau.san_pham.id);
    assert.equal(sp.layTheoSo('abc'), null);
    assert.equal(sp.layTheoSo(999), null);
  });

  await t.test('sanPhamDuocNhac: theo số ("áo 12", "sp 12", "#12"), theo tên (không dấu); số gọi rõ mà không có → soLa', () => {
    const ds = sp.danhSach().map((x) => sp.laySanPham(x.id));
    const nhac = (cau) => {
      const r = sp.sanPhamDuocNhac(cau, ds);
      return { so: r.theoSo.map((x) => x.so), ten: r.theoTen.map((x) => x.so), la: r.soLa };
    };
    assert.deepEqual(nhac('chốt áo 12 đen M'), { so: [12], ten: [], la: [] });
    assert.deepEqual(nhac('sp 12 còn ko shop'), { so: [12], ten: [], la: [] });
    assert.deepEqual(nhac('#13'), { so: [13], ten: [], la: [] });
    assert.deepEqual(nhac('quần 13 giá sao'), { so: [13], ten: [], la: [] });
    assert.deepEqual(nhac('Sơ mi linen tay ngắn còn size L không'), { so: [], ten: [12], la: [] });
    assert.deepEqual(nhac('so mi dui co mau trang ko'), { so: [], ten: [12], la: [] }, 'tên gọi khác, gõ không dấu');
    assert.deepEqual(nhac('số 99 còn không'), { so: [], ten: [], la: [99] });
    assert.deepEqual(nhac('áo 2 dây có không'), { so: [], ten: [], la: [] }, '"áo 2 dây" không phải áo số 2');
    assert.deepEqual(nhac('chị cao 1m58 nặng 50kg'), { so: [], ten: [], la: [] });
  });

  await t.test('nhân bản: bản Nháp số kế tiếp, cùng ô và giá riêng, tồn 0, mã phân loại sinh lại, chép ảnh', () => {
    const goc = sp.laySanPham(mau.san_pham.id);
    const nb = sp.nhanBan(goc.id);
    const so = nb.san_pham.so;
    assert.equal(so, sp.soKeTiep() - 1);
    assert.equal(nb.san_pham.trang_thai, 'nhap');
    assert.equal(nb.san_pham.ten, 'Sơ mi linen tay ngắn (bản sao)');
    assert.equal(nb.san_pham.gia, goc.gia);
    assert.deepEqual(nb.san_pham.thong_so, goc.thong_so);
    assert.equal(nb.san_pham.phien_ban, 1);
    assert.ok(nb.phan_loai.every((p) => p.ton === 0 && p.sku.startsWith(`${so}-`)));
    assert.equal(nb.phan_loai.find((p) => p.gt2 === 'XXL').gia, 319000, 'giá riêng giữ nguyên');
    assert.equal(nb.san_pham.anh.length, goc.anh.length);
    assert.notEqual(nb.san_pham.anh[0].tep, goc.anh[0].tep);
    assert.ok(sp.duongAnh(nb.san_pham.id, nb.san_pham.anh[0].tep));
  });

  await t.test('kiểm dữ liệu vào; chữ chuẩn hóa NFC', () => {
    const co = { ten: 'Áo X', danh_muc: 'ao_thun', gia: '99k', phan_loai: [{ gt1: 'Đen', gt2: 'M' }] };
    assert.throws(() => sp.taoSanPham({ ...co, ten: '' }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.taoSanPham({ ...co, danh_muc: '' }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.taoSanPham({ ...co, gia: '' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE' && /giá bán/i.test(e.message));
    assert.throws(() => sp.taoSanPham({ ...co, gia: 'rẻ lắm' }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.taoSanPham({ ...co, trang_thai: 'xoa' }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.taoSanPham({ ...co, so: -1 }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.taoSanPham({ ...co, ten: 'Áo\nhai dòng' }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.taoSanPham({ ...co, phan_loai: [{ gt1: 'Đen', gt2: 'M', ton: -2 }] }), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => sp.taoSanPham({ ...co, phan_loai: [{ gt1: 'Đen', gt2: 'M', bo: true }] }), /ít nhất một ô phân loại được bán/);
    assert.throws(() => sp.laySanPham('sp_khongco'), (e) => e.http === 404);
    const nfd = 'Áo lụa tơ tằm'.normalize('NFD');
    const x = sp.taoSanPham({ ...co, ten: nfd });
    assert.equal(x.san_pham.ten, 'Áo lụa tơ tằm'.normalize('NFC'));
    assert.notEqual(x.san_pham.ten, nfd);
  });

  await t.test('kho: nhập, điều chỉnh, lịch sử; sau chuỗi thao tác ngẫu nhiên tồn luôn = tổng lịch sử (doiChieu rỗng)', () => {
    const dsPl = csdl().prepare('SELECT id FROM phan_loai WHERE bo = 0').all().map((r) => r.id);
    assert.throws(() => kho.nhap([{ phan_loai_id: dsPl[0], so: 0 }]), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => kho.nhap([]), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => kho.dieuChinh([{ phan_loai_id: dsPl[0], ton: -1 }]), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.throws(() => kho.nhap([{ phan_loai_id: 'pl_khongco', so: 1 }]), (e) => e.http === 404);

    const truoc = csdl().prepare('SELECT ton FROM phan_loai WHERE id = ?').get(dsPl[0]).ton;
    assert.throws(() => kho.nhap([{ phan_loai_id: dsPl[0], so: 3 }, { phan_loai_id: dsPl[1], so: -3 }]), loiMa('DU_LIEU_KHONG_HOP_LE'));
    assert.equal(csdl().prepare('SELECT ton FROM phan_loai WHERE id = ?').get(dsPl[0]).ton, truoc, 'một dòng lỗi thì cả lần nhập không ghi');

    const nhap = kho.nhap([{ phan_loai_id: dsPl[0], so: 10 }], { ghiChu: 'qua Mai' });
    assert.equal(nhap[0].ton, truoc + 10);
    const ls = kho.lichSu({ phanLoaiId: dsPl[0] })[0];
    assert.deepEqual([ls.ly_do, ls.thay_doi, ls.ton_sau, ls.ghi_chu, ls.boi], ['nhap_hang', 10, truoc + 10, 'qua Mai', 'nguoi']);
    const dc = kho.dieuChinh([{ phan_loai_id: dsPl[0], ton: 4 }]);
    assert.deepEqual([dc[0].thay_doi, dc[0].ton], [4 - truoc - 10, 4]);
    const soDong = kho.lichSu({ phanLoaiId: dsPl[0] }).length;
    assert.equal(kho.dieuChinh([{ phan_loai_id: dsPl[0], ton: 4 }])[0].thay_doi, 0);
    assert.equal(kho.lichSu({ phanLoaiId: dsPl[0] }).length, soDong, 'đếm đúng bằng tồn thì không ghi dòng thừa');

    // Chuỗi thao tác ngẫu nhiên có hạt cố định (chạy lại ra đúng chuỗi cũ).
    let hat = 20260926;
    const ngauNhien = (n) => { hat = (hat * 1103515245 + 12345) % 2147483648; return hat % n; };
    let loi = 0;
    for (let i = 0; i < 300; i++) {
      const pl = dsPl[ngauNhien(dsPl.length)];
      try {
        if (ngauNhien(2)) kho.nhap([{ phan_loai_id: pl, so: 1 + ngauNhien(20) }]);
        else kho.dieuChinh([{ phan_loai_id: pl, ton: ngauNhien(30) - 3 }]);
      } catch (e) {
        assert.equal(e.ma, 'DU_LIEU_KHONG_HOP_LE');
        loi += 1;
      }
    }
    assert.ok(loi > 0, 'chuỗi có cả thao tác bị từ chối (tồn âm)');
    assert.deepEqual(kho.doiChieu(), []);
    for (const id of dsPl) {
      const ton = csdl().prepare('SELECT ton FROM phan_loai WHERE id = ?').get(id).ton;
      assert.ok(ton >= 0);
      const moiNhat = kho.lichSu({ phanLoaiId: id, gioiHan: 1 })[0];
      if (moiNhat) assert.equal(moiNhat.ton_sau, ton);
    }
  });
});

test('API sản phẩm, ảnh tạm, kho', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const guiAnh = async (than) => {
    const r = await fetch(`${pm.goc}/api/anh-tam`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: than });
    return { ma: r.status, than: await r.json() };
  };
  let id;
  let pl;

  await t.test('tải ảnh tạm: JPEG nhận, tệp lạ báo ANH_KHONG_HOP_LE', async () => {
    const ok = await guiAnh(ANH_GIA);
    assert.equal(ok.ma, 201);
    assert.match(ok.than.tep, /^[a-z0-9]+\.jpg$/);
    const sai = await guiAnh(Buffer.from('GIF89a không phải ảnh'));
    assert.equal(sai.ma, 400);
    assert.equal(sai.than.loi.ma, 'ANH_KHONG_HOP_LE');
    t.tep = ok.than.tep;
  });

  await t.test('tạo, trùng số, sửa, bản sửa, thẻ AI, tìm, nhân bản qua API', async () => {
    const ts = await pm.goi('GET', '/api/bang-size');
    assert.equal(ts.ma, 200);
    const bs = await pm.goi('POST', '/api/bang-size', { ten: 'Áo nữ form chuẩn', cot: ['chieu_cao', 'can_nang'], hang: [{ co: 'M', chieu_cao: '155-162', can_nang: '48-55' }] });
    assert.equal(bs.ma, 201);
    const than = { so: 12, ten: 'Sơ mi linen tay ngắn', danh_muc: 'ao_so_mi', gia: '289k', gia_von: '150k', ghi_chu_noi_bo: 'nhập xưởng A',
      trang_thai: 'dang_ban', bang_size_id: bs.than.bang_size.id, anh: [{ tep: t.tep, mau: 'Đen' }],
      phan_loai: [{ gt1: 'Đen', gt2: 'M', ton: 5 }, { gt1: 'Đen', gt2: 'L', ton: 2 }] };
    const tao = await pm.goi('POST', '/api/san-pham', than);
    assert.equal(tao.ma, 201);
    id = tao.than.san_pham.id;
    pl = tao.than.phan_loai;
    assert.equal(tao.than.san_pham.gia, 289000);
    const trung = await pm.goi('POST', '/api/san-pham', { ...than, anh: [] });
    assert.equal(trung.ma, 409);
    assert.equal(trung.than.loi.ma, 'SP_TRUNG_SO');
    const sua = await pm.goi('PUT', `/api/san-pham/${id}`, { gia: '299k' });
    assert.equal(sua.than.san_pham.phien_ban, 2);
    assert.equal((await pm.goi('GET', `/api/san-pham/${id}/ban-sua`)).than.ban_sua.length, 2);
    const ct = await pm.goi('GET', `/api/san-pham/${id}`);
    assert.equal(ct.than.phan_loai.length, 2);
    assert.equal(ct.than.bang_size.id, bs.than.bang_size.id);
    const the = await pm.goi('GET', `/api/san-pham/${id}/the-ai`);
    assert.match(the.than.the, /Giá: 299\.000đ/);
    assert.ok(!the.chu.includes('150.000') && !the.chu.includes('nhập xưởng A'), 'thẻ AI qua API không lộ giá vốn, ghi chú nội bộ');
    const tim = await pm.goi('GET', '/api/san-pham?q=so%20mi&trang_thai=dang_ban');
    assert.deepEqual(tim.than.san_pham.map((x) => x.so), [12]);
    assert.equal(tim.than.dem.dang_ban, 1);
    const nb = await pm.goi('POST', `/api/san-pham/${id}/nhan-ban`);
    assert.equal(nb.ma, 201);
    assert.equal(nb.than.san_pham.so, 13);
    assert.equal((await pm.goi('GET', '/api/san-pham/sp_khongco')).ma, 404);
    const dm = await pm.goi('GET', '/api/cau-hinh/danh-muc');
    assert.ok(dm.than.danh_muc.some((d) => d.khoa === 'ao_so_mi' && d.thong_so.includes('chat_lieu')));
    assert.equal(dm.than.so_ke_tiep, 14);
  });

  await t.test('kho qua API: lưới tồn, nhập, điều chỉnh, lịch sử', async () => {
    const luoi = await pm.goi('GET', '/api/kho');
    assert.equal(luoi.ma, 200);
    assert.equal(luoi.than.nguong_sap_het, 3);
    assert.ok(luoi.than.san_pham.some((x) => x.id === id && x.phan_loai.length === 2));
    const nhap = await pm.goi('POST', '/api/kho/nhap', { dong: [{ phan_loai_id: pl[0].id, so: 10 }], ghi_chu: 'hàng về' });
    assert.equal(nhap.than.ket_qua[0].ton, 15);
    const dc = await pm.goi('POST', '/api/kho/dieu-chinh', { dong: [{ phan_loai_id: pl[1].id, ton: 1 }] });
    assert.equal(dc.than.ket_qua[0].thay_doi, -1);
    const am = await pm.goi('POST', '/api/kho/dieu-chinh', { dong: [{ phan_loai_id: pl[1].id, ton: -4 }] });
    assert.equal(am.ma, 400);
    assert.equal(am.than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
    const mot = await pm.goi('GET', `/api/kho?san_pham_id=${id}`);
    assert.deepEqual(mot.than.phan_loai.map((p) => [p.sku, p.ton, p.con_ban_duoc]), [['12-DEN-M', 15, 15], ['12-DEN-L', 1, 1]]);
    const ls = await pm.goi('GET', `/api/kho/lich-su?san_pham_id=${id}`);
    assert.equal(ls.than.lich_su[0].ly_do, 'dieu_chinh');
    assert.equal(ls.than.lich_su[0].ghi_chu, 'kiểm kê');
    assert.equal(ls.than.lich_su.length, 4);
    const sapHet = await pm.goi('GET', '/api/san-pham?kho=sap_het');
    assert.deepEqual(sapHet.than.san_pham.map((x) => x.so), [12], 'Đen/L còn 1 ≤ ngưỡng 3');
  });
});
