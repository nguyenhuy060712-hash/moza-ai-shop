'use strict';

/**
 * Bộ kiểm tra K1–K10 (SPEC.md A.4 bản bán hàng, F-10): mỗi ca là một câu đúng hoặc sai có chủ đích.
 * Dữ liệu: áo số 12 (289.000đ, Đen/Trắng × M/L, còn 5 mỗi ô), quần số 15 (350.000đ, Xanh × M/L, còn 2 — dưới ngưỡng
 * "sắp hết" 3), mẫu số 7 Ngừng bán, mẫu số 8 Nháp, áo số 20 có ô "AI đoán" chưa xác nhận.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const ma = (kq) => [...new Set(kq.loi.map((l) => l.ma))].sort();

test('Bộ kiểm tra K1–K10 (F-10, A.4)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const soTay = require('../server/nghiep-vu/so-tay');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const don = require('../server/nghiep-vu/don');
  const live = require('../server/nghiep-vu/live');
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const { kiemTraCau, dongCaiDat, soTrongLoiKhach } = require('../server/agent/kiem-tra/kiem-tra');

  const a12 = taoSanPhamMau();
  const q15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '350k', mau: ['Xanh'], ton: 2 });
  taoSanPhamMau({ so: 7, ten: 'Váy hoa nhí', danhMuc: 'dam_vay_lien', trangThai: 'ngung_ban' });
  taoSanPhamMau({ so: 8, ten: 'Chân váy xếp ly', danhMuc: 'chan_vay', trangThai: 'nhap' });
  const a20 = taoSanPhamMau({ so: 20, ten: 'Áo thun cotton basic', danhMuc: 'ao_thun', them: { ai_doan: ['thong_so.chat_lieu', 'mo_ta'] } });
  const doiTra = soTay.danhSachMuc().find((m) => m.tieu_de === 'Đổi trả');
  soTay.suaMuc(doiTra.id, { noi_dung: 'Đổi size miễn phí trong 15 ngày nếu còn tem mác.' });

  const GIA12 = { nguon: '12', doan: 'Giá: 289.000đ' };
  // Mặc định: câu trên sóng, Director giao áo số 12.
  const kiem = (o) => kiemTraCau({ kenh: 'song', soDuocGiao: 12, ...o });
  const tin = (o) => kiemTraCau({ kenh: 'messenger', ...o });

  /** Chạy một bảng ca: [tên, kết quả kiểm, mã lỗi mong đợi ([] = đạt)]. */
  async function chayCa(ds) {
    for (const [ten, chay, kyVong] of ds) {
      await t.test(ten, () => {
        const kq = chay();
        assert.deepEqual(ma(kq), [...kyVong].sort(), JSON.stringify(kq.loi));
        assert.equal(kq.dat, kyVong.length === 0);
      });
    }
  }

  await chayCa([
    ['đạt: đúng giá, đúng nguồn, đúng sản phẩm được giao', () => kiem({ cau: 'Dạ áo số 12 giá 289k ạ.', trich_dan: [GIA12] }), []],
    ['đạt: giá đọc bằng chữ được quy đổi', () => kiem({ cau: 'Áo 12 hai trăm tám mươi chín nghìn thôi ạ.', trich_dan: [GIA12] }), []],
    ['đạt: nguồn ghi "áo 12", "số 12", "#12" đều là sản phẩm 12', () => tin({ cau: 'Giá 289k ạ.', trich_dan: [{ nguon: 'áo 12', doan: 'Giá: 289.000đ' }, { nguon: 'số 12', doan: 'Giá: 289.000đ' }, { nguon: '#12', doan: 'Giá: 289.000đ' }] }), []],
    ['đạt: so trích dẫn sau NFC và gộp khoảng trắng', () => kiem({ cau: 'Giá 289.000đ ạ.', trich_dan: [{ nguon: '12', doan: 'Giá:   289.000đ'.normalize('NFD') }] }), []],
    ['đạt: trích từ Sổ tay', () => tin({ cau: 'Shop đổi size miễn phí trong 15 ngày ạ.', trich_dan: [{ nguon: 'so_tay', doan: 'Đổi size miễn phí trong 15 ngày' }] }), []],
    ['K3: Sổ tay nói 15 ngày mà câu nói 30 ngày', () => tin({ cau: 'Shop đổi size trong 30 ngày ạ.', trich_dan: [{ nguon: 'so_tay', doan: 'Đổi size miễn phí trong 15 ngày' }] }), ['K3']],
    ['đạt: trích "Còn bán được" đúng lúc kiểm', () => tin({ cau: 'Áo 12 màu đen size M còn 5 chiếc ạ.', trich_dan: [{ nguon: '12', doan: 'Còn bán được Đen/M: 5' }] }), []],
    ['đạt: số gọi sản phẩm ("áo số 12", "#12") không phải con số cần nguồn', () => tin({ cau: 'Dạ áo số 12 và mẫu #12 là một ạ.' }), []],
    ['đạt: "áo 2 dây" không phải sản phẩm số 2', () => tin({ cau: 'Áo 2 dây mặc mát lắm ạ.' }), []],
    ['đạt: chưa có thông tin, không con số', () => kiem({ cau: 'Dạ phần này áo 12 Mai chưa có thông tin, chị nhắn tin cho Page nha.' }), []],
    ['đạt: dấu chấm trong số không tính là hết câu', () => kiem({ cau: 'Áo 12 giá 289.000đ ạ. Vải linen mát. Form suông.', trich_dan: [GIA12] }), []],

    ['K2: đoạn trích không có trong thẻ', () => tin({ cau: 'Giá 250k ạ.', trich_dan: [{ nguon: '12', doan: 'Giá: 250.000đ' }] }), ['K2']],
    ['K2: nguồn lạ', () => tin({ cau: 'Dạ có ạ.', trich_dan: [{ nguon: 'XYZ', doan: 'bất kỳ' }] }), ['K2']],
    ['K2: số sản phẩm không tồn tại làm nguồn', () => tin({ cau: 'Dạ có ạ.', trich_dan: [{ nguon: '99', doan: 'Giá: 289.000đ' }] }), ['K2']],
    ['K2: đoạn trích rỗng', () => tin({ cau: 'Dạ có ạ.', trich_dan: [{ nguon: '12', doan: '   ' }] }), ['K2']],
    ['K2: trích sai nguồn (dòng của quần 15 ghi nguồn áo 12)', () => tin({ cau: 'Dạ có màu xanh ạ.', trich_dan: [{ nguon: '12', doan: 'Phân loại: Màu (Xanh) × Cỡ (M, L)' }] }), ['K2']],
    ['K2: ô "AI đoán" chưa xác nhận (chất liệu) không trích được', () => tin({ cau: 'Áo 20 vải linen ạ.', trich_dan: [{ nguon: '20', doan: 'Chất liệu: Linen (lanh)' }] }), ['K2']],
    ['K2: mô tả "AI đoán" chưa xác nhận không trích được', () => tin({ cau: 'Áo 20 mặc đi làm hợp lắm ạ.', trich_dan: [{ nguon: '20', doan: 'mặc đi làm, đi chơi đều hợp' }] }), ['K2']],
    ['K2: giá vốn, ghi chú nội bộ không có trong nguồn', () => tin({ cau: 'Dạ ạ.', trich_dan: [{ nguon: '12', doan: 'nhập xưởng A' }] }), ['K2']],

    ['K1: nhắc sản phẩm Ngừng bán theo số', () => tin({ cau: 'Mẫu số 7 đẹp lắm ạ.' }), ['K1']],
    ['K1: nhắc sản phẩm Ngừng bán theo tên', () => tin({ cau: 'Váy hoa nhí đang có ạ.' }), ['K1']],
    ['K1: nhắc sản phẩm Nháp', () => tin({ cau: 'Mẫu số 8 sắp về ạ.' }), ['K1']],
    ['K1: số sản phẩm không có', () => tin({ cau: 'Mẫu số 99 đẹp lắm ạ.' }), ['K1']],
    ['K1: trích từ thẻ sản phẩm Ngừng bán', () => tin({ cau: 'Giá 289k ạ.', trich_dan: [{ nguon: '7', doan: 'Giá: 289.000đ' }] }), ['K1']],

    ['K3: giá khác nguồn', () => kiem({ cau: 'Áo 12 giá 299k ạ.', trich_dan: [GIA12] }), ['K3']],
    ['K3: bịa thông số', () => kiem({ cau: 'Áo 12 vải dày 200 gsm ạ.' }), ['K3']],
    ['K3: nhắc cân nặng khách nói mà không được báo là số khách nói', () => tin({ cau: 'Chị cao 1m58 nặng 50 kí thì mặc size M vừa ạ.', trich_dan: [{ nguon: '12', doan: 'Size M: chiều cao 155–162 cm, cân nặng 48–55 kg' }] }), ['K3']],
    ['đạt: nhắc lại chiều cao, cân nặng khách tự nói (K3 ngoại lệ)', () => tin({ cau: 'Chị cao 158 cm nặng 50 kí thì mặc size M vừa ạ.', trich_dan: [{ nguon: '12', doan: 'Size M: chiều cao 155–162 cm, cân nặng 48–55 kg' }], soKhachNoi: soTrongLoiKhach(['em cao 1m58 nặng 50 kí']) }), []],
    ['K3: số tiền khách tự nói vẫn không được nhắc lại như giá', () => tin({ cau: 'Dạ áo 12 để chị 250k nha.', soKhachNoi: soTrongLoiKhach(['250k được không shop']) }), ['K3']],

    ['K4: trên sóng nói sản phẩm khác sản phẩm được giao (theo số)', () => kiem({ cau: 'Quần số 15 cũng đẹp ạ.' }), ['K4']],
    ['K4: trên sóng nói sản phẩm khác (theo tên)', () => kiem({ cau: 'Quần jean ống suông cũng có ạ.' }), ['K4']],
    ['K4: trên sóng trích thẻ sản phẩm khác', () => kiem({ cau: 'Dạ có màu xanh ạ.', trich_dan: [{ nguon: '15', doan: 'Phân loại: Màu (Xanh) × Cỡ (M, L)' }] }), ['K4']],
    ['đạt: tin nhắn riêng được nhắc nhiều sản phẩm', () => tin({ cau: 'Áo 12 và quần 15 đều đang bán ạ.' }), []],
    ['đạt: trên sóng chưa giao sản phẩm, không phiên thì không xét K4', () => kiemTraCau({ kenh: 'song', cau: 'Quần số 15 đẹp ạ.' }), []],

    ['K5: xin số điện thoại dưới bình luận', () => kiemTraCau({ kenh: 'binh_luan', cau: 'Chị để lại số điện thoại dưới bình luận nhé.' }), ['K5']],
    ['K5: xin sđt trên sóng', () => kiem({ cau: 'Cho em xin sdt để chốt đơn nha.' }), ['K5']],
    ['K5: xin ghi địa chỉ ở bình luận', () => kiemTraCau({ kenh: 'binh_luan', cau: 'Chị ghi địa chỉ vào đây để shop gửi hàng nha.' }), ['K5']],
    ['K5: hỏi địa chỉ ở bình luận', () => kiemTraCau({ kenh: 'binh_luan', cau: 'Địa chỉ của chị ở đâu ạ?' }), ['K5']],
    ['đạt: Messenger được xin số điện thoại, địa chỉ để lên đơn', () => tin({ cau: 'Chị cho em xin số điện thoại và địa chỉ để lên đơn ạ.' }), []],
    ['đạt: nhắn riêng được xin số điện thoại', () => kiemTraCau({ kenh: 'nhan_rieng', cau: 'Chị cho em xin số điện thoại để lên đơn ạ.' }), []],
    ['đạt: bình luận mời nhắn tin cho Page', () => kiemTraCau({ kenh: 'binh_luan', cau: 'Chị nhắn tin cho Page để shop tư vấn size nha.' }), []],

    ['K6: bình luận có họ tên đầy đủ người khác', () => kiemTraCau({ kenh: 'binh_luan', cau: 'Chị Nguyễn Thị Lan chốt áo 12 rồi ạ.', tenNguoi: ['Nguyễn Thị Lan'] }), ['K6']],
    ['đạt: gọi tên ngắn', () => kiemTraCau({ kenh: 'binh_luan', cau: 'Chị Lan chốt áo 12 rồi ạ.', tenNguoi: ['Nguyễn Thị Lan'] }), []],

    ['K8: trên sóng quá 3 câu', () => kiem({ cau: 'Dạ. Vâng. Có ạ. Nhé.' }), ['K8']],
    ['K8: trên sóng quá 300 ký tự', () => kiem({ cau: 'Dạ '.repeat(120) }), ['K8']],
    ['K8: Messenger quá 1.000 ký tự', () => tin({ cau: 'a'.repeat(1001) }), ['K8']],
    ['K8: câu rỗng', () => tin({ cau: '   ' }), ['K8']],

    ['K9: "còn 3" khi không ô nào còn đúng 3', () => tin({ cau: 'Áo 12 còn 3 thôi ạ.' }), ['K9']],
    ['K9: "sắp hết" khi mọi ô còn 5 (> ngưỡng 3)', () => tin({ cau: 'Áo 12 sắp hết rồi ạ.' }), ['K9']],
    ['K9: "chỉ còn ít" khi còn nhiều', () => kiem({ cau: 'Áo 12 chỉ còn ít thôi ạ.' }), ['K9']],
    ['đạt: "sắp hết" khi còn 2 (≤ ngưỡng)', () => tin({ cau: 'Quần 15 sắp hết rồi ạ.' }), []],
    ['đạt: "chỉ còn 2" đúng số còn bán được', () => tin({ cau: 'Quần 15 chỉ còn 2 thôi ạ.' }), []],
    ['đạt: "còn 289k" là giá, không phải số còn', () => tin({ cau: 'Áo 12 còn 289k thôi ạ.', trich_dan: [GIA12] }), []],
    ['K3 + K9: "còn 5 cái" không gắn với sản phẩm nào, không nguồn', () => tin({ cau: 'Dạ còn 5 cái ạ.' }), ['K3', 'K9']],
    ['đạt: "còn 5 cái" có trích dòng còn bán được', () => tin({ cau: 'Dạ còn 5 cái ạ.', trich_dan: [{ nguon: '12', doan: 'Còn bán được Trắng/L: 5' }] }), []],
  ]);

  await t.test('K6: câu công khai có số điện thoại', () => {
    assert.ok(ma(kiem({ cau: 'Chị gọi 0912 345 678 nhé.' })).includes('K6'));
  });

  await t.test('K7: miệng sắp nói mà AI không được phép nói → giữ, không phải lỗi', () => {
    assert.deepEqual(kiem({ cau: 'Dạ áo số 12 đang có ạ.', phat: true, duocNoi: false }), { dat: false, giu: true, loi: [] });
    assert.equal(kiem({ cau: 'Dạ áo số 12 đang có ạ.', phat: false, duocNoi: false }).dat, true, 'chỉ hiện chữ cho người dẫn thì không cần');
  });

  await t.test('K1: sản phẩm vừa Ngừng bán một giây trước bị chặn ngay (đọc lại cơ sở dữ liệu lúc kiểm)', () => {
    const cau = { cau: 'Quần 15 giá 350k ạ.', trich_dan: [{ nguon: '15', doan: 'Giá: 350.000đ' }] };
    assert.equal(tin(cau).dat, true);
    sp.doiTrangThai(q15.san_pham.id, 'ngung_ban');
    assert.deepEqual(ma(tin(cau)), ['K1']);
    sp.doiTrangThai(q15.san_pham.id, 'dang_ban');
    assert.equal(tin(cau).dat, true);
  });

  await t.test('K2: ô "AI đoán" sau khi người xác nhận thì trích được', () => {
    sp.suaSanPham(a20.san_pham.id, { ai_doan: [] });
    assert.equal(tin({ cau: 'Áo 20 vải linen ạ.', trich_dan: [{ nguon: '20', doan: 'Chất liệu: Linen (lanh)' }] }).dat, true);
    assert.equal(tin({ cau: 'Áo 20 mặc đi làm hợp lắm ạ.', trich_dan: [{ nguon: '20', doan: 'mặc đi làm, đi chơi đều hợp' }] }).dat, true);
  });

  await t.test('K9: ngưỡng "sắp hết" đọc từ Cài đặt lúc kiểm', () => {
    caiDat.datBanHang({ nguong_sap_het: 1 });
    assert.deepEqual(ma(tin({ cau: 'Quần 15 sắp hết rồi ạ.' })), ['K9']);
    caiDat.datBanHang({ nguong_sap_het: 3 });
    assert.equal(tin({ cau: 'Quần 15 sắp hết rồi ạ.' }).dat, true);
  });

  await t.test('K4: món "Phối cùng" của sản phẩm được giao được nhắc trên sóng', () => {
    assert.deepEqual(ma(kiem({ cau: 'Phối cùng quần số 15 rất hợp ạ.' })), ['K4']);
    sp.suaSanPham(a12.san_pham.id, { phoi_cung: [q15.san_pham.id] });
    assert.equal(kiem({ cau: 'Phối cùng quần số 15 rất hợp ạ.' }).dat, true);
    assert.deepEqual(ma(kiem({ cau: 'Mẫu số 20 cũng đẹp ạ.' })), ['K4'], 'món không phải phối cùng vẫn bị chặn');
  });

  await t.test('phí ship (nguồn "cai_dat"): chưa đặt thì không trích được; đặt rồi trích đúng dòng MOZA sinh', () => {
    assert.deepEqual(dongCaiDat().filter((d) => /Phí ship/.test(d)), []);
    assert.deepEqual(ma(tin({ cau: 'Phí ship 30k ạ.', trich_dan: [{ nguon: 'cai_dat', doan: 'Phí ship: 30.000đ' }] })), ['K2']);
    caiDat.datBanHang({ phi_ship: 30000 });
    assert.ok(dongCaiDat().includes('Phí ship: 30.000đ'));
    assert.equal(tin({ cau: 'Phí ship đồng giá 30k ạ.', trich_dan: [{ nguon: 'cai_dat', doan: 'Phí ship: 30.000đ' }] }).dat, true);
    assert.equal(tin({ cau: 'Phí ship 30k ạ.', trich_dan: [{ nguon: 'Cài đặt', doan: 'Phí ship: 30.000đ' }] }).dat, true, 'nguồn gõ có dấu vẫn nhận');
    assert.deepEqual(ma(tin({ cau: 'Phí ship 25k ạ.', trich_dan: [{ nguon: 'cai_dat', doan: 'Phí ship: 25.000đ' }] })), ['K2']);
    assert.deepEqual(ma(tin({ cau: 'Phí ship 30k ạ.' })), ['K3'], 'không trích thì số 30k không có nguồn');
    assert.deepEqual(ma(tin({ cau: 'Phí ship 30k ạ.', trich_dan: [{ nguon: '12', doan: 'Phí ship: 30.000đ' }] })), ['K2'], 'phí ship không nằm trong thẻ sản phẩm');
    assert.equal(tin({ cau: 'Shop giữ hàng 24 giờ ạ.', trich_dan: [{ nguon: 'cai_dat', doan: 'Giữ hàng tối đa 24 giờ' }] }).dat, true);
  });

  // Đơn DH-0001: áo 12 Đen/M x2 → Đen/M còn bán được 3; tổng 578.000đ + ship 30.000đ = 608.000đ.
  const d = don.taoDon({ mon: [{ phan_loai_id: a12.pl('Đen', 'M').id, so_luong: 2 }], nguon: 'tin_nhan' });
  const TONG = { nguon: 'DH-0001', doan: 'Tổng tiền đơn DH-0001: 608.000đ' };

  await chayCa([
    ['đạt: tổng tiền trích từ khối đơn của chính khách', () => tin({ cau: 'Tổng tiền đơn của chị là 608.000đ ạ.', trich_dan: [TONG], donCuaKhach: [d.id] }), []],
    ['đạt: mã đơn viết "dh1", "DH 0001"', () => tin({ cau: 'Tổng tiền 608k ạ.', trich_dan: [{ ...TONG, nguon: 'dh1' }, { ...TONG, nguon: 'DH 0001' }], donCuaKhach: [d.id] }), []],
    ['đạt: phí ship trích từ đơn', () => tin({ cau: 'Phí ship đơn này 30k ạ.', trich_dan: [{ nguon: 'DH-0001', doan: 'Phí ship đơn DH-0001: 30.000đ' }], donCuaKhach: [d.id] }), []],
    ['K3 + K10: nói tổng tiền không trích', () => tin({ cau: 'Tổng tiền đơn của chị là 608.000đ ạ.' }), ['K3', 'K10']],
    ['K10: tổng tiền trích từ thẻ sản phẩm, không phải từ đơn', () => tin({ cau: 'Tổng cộng 289k ạ.', trich_dan: [GIA12] }), ['K10']],
    ['K10: đơn của khách khác', () => tin({ cau: 'Tổng tiền 608k ạ.', trich_dan: [TONG], donCuaKhach: ['dh_khac'] }), ['K10']],
    ['K10: không nói đơn ở bình luận công khai', () => kiemTraCau({ kenh: 'binh_luan', cau: 'Tổng tiền 608k ạ.', trich_dan: [TONG] }), ['K10']],
    ['K10: không nói đơn trên sóng', () => kiemTraCau({ kenh: 'song', cau: 'Tổng tiền 608k ạ.', trich_dan: [TONG] }), ['K10']],
    ['K2: mã đơn không có', () => tin({ cau: 'Dạ ạ.', trich_dan: [{ nguon: 'DH-0999', doan: 'Tổng tiền' }] }), ['K2']],
    ['K9: sau khi đơn giữ 2, không ô nào còn đúng 4', () => tin({ cau: 'Áo 12 đen M còn 4 ạ.' }), ['K9']],
    // K9 so với còn bán được của mọi ô trong sản phẩm (chưa tách theo màu × cỡ): Đen/L vẫn còn 5 nên câu này qua.
    ['đạt (K9 so theo sản phẩm): "còn 5" vì ô khác của áo 12 còn 5', () => tin({ cau: 'Áo 12 còn 5 ạ.' }), []],
    ['đạt: sau khi đơn giữ 2, "còn 3, sắp hết" đúng', () => tin({ cau: 'Áo 12 đen M còn 3 thôi ạ, sắp hết rồi.' }), []],
    ['K2: số còn đã cũ không trích được', () => tin({ cau: 'Dạ còn ạ.', trich_dan: [{ nguon: '12', doan: 'Còn bán được Đen/M: 5' }] }), ['K2']],
    ['đạt: số còn mới trích được', () => tin({ cau: 'Dạ còn ạ.', trich_dan: [{ nguon: '12', doan: 'Còn bán được Đen/M: 3' }] }), []],
  ]);

  await t.test('K10: đơn vừa thêm món → tổng cũ không trích được nữa, tổng mới thì được', () => {
    don.themMon(d.id, a12.pl('Trắng', 'M').id, 1);
    assert.deepEqual(ma(tin({ cau: 'Tổng tiền 608k ạ.', trich_dan: [TONG], donCuaKhach: [d.id] })), ['K2']);
    assert.equal(tin({ cau: 'Tổng tiền 897k ạ.', trich_dan: [{ nguon: 'DH-0001', doan: 'Tổng tiền đơn DH-0001: 897.000đ' }], donCuaKhach: [d.id] }).dat, true);
  });

  await t.test('buổi live: trên sóng trích đúng bản sửa lúc bắt đầu phiên; chỉ nói sản phẩm trong phiên', () => {
    const kb = kichBan.taoKichBan({ ten: 'Live thử', doan: [{ san_pham_id: a12.san_pham.id, loi_nhac: '' }] });
    const p = live.taoPhien({ kich_ban_id: kb.id, dien_tap: true });
    sp.suaSanPham(a12.san_pham.id, { gia: '299k' });
    const song = (o) => kiemTraCau({ kenh: 'song', phienLiveId: p.id, ...o });
    assert.equal(song({ soDuocGiao: 12, cau: 'Áo 12 giá 289k ạ.', trich_dan: [GIA12] }).dat, true, 'bản sửa của phiên');
    assert.deepEqual(ma(song({ soDuocGiao: 12, cau: 'Áo 12 giá 299k ạ.', trich_dan: [{ nguon: '12', doan: 'Giá: 299.000đ' }] })), ['K2']);
    assert.equal(tin({ cau: 'Áo 12 giá 299k ạ.', trich_dan: [{ nguon: '12', doan: 'Giá: 299.000đ' }] }).dat, true, 'ngoài live dùng bản mới nhất');
    assert.deepEqual(ma(tin({ cau: 'Áo 12 giá 289k ạ.', trich_dan: [GIA12] })), ['K2']);
    assert.deepEqual(ma(song({ cau: 'Quần số 15 đẹp ạ.' })), ['K4'], 'không có trong phiên');
    assert.deepEqual(ma(song({ soDuocGiao: 12, cau: 'Phối cùng quần số 15 rất hợp ạ.' })), ['K4'], 'món phối cùng phải có trong phiên');
    live.ketThucPhien(p.id);
  });
});
