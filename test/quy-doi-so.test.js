'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { laySo, soKhongCoTrongNguon } = require('../server/agent/kiem-tra/quy-doi-so');

const gan = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
const giaTri = (cau, o) => laySo(cau, o).map((s) => s.giaTri);
const donVi = (cau) => laySo(cau).map((s) => s.donVi);

test('bảng quy đổi số ở SPEC.md A.4: mọi cách viết cho cùng một giá trị', () => {
  const bang = [
    [['5.100.000đ', '5,100,000 VNĐ', '5 triệu 1', '5tr1', 'năm triệu một trăm nghìn', '5,1 triệu'], 5100000],
    [['7,5tr', '7tr5', 'bảy triệu rưỡi', '7.5 triệu', '7 triệu 500', '7 triệu năm trăm nghìn'], 7500000],
    [['289k', '289.000đ', '289 nghìn', '289 ngàn', 'hai trăm tám mươi chín nghìn'], 289000],
    [['300k', '300 nghìn', '300 ngàn', 'ba trăm nghìn'], 300000],
    [['1tr2', '1 triệu 2', '1,2 triệu', 'một triệu hai'], 1200000],
    [['1 triệu mốt', 'một triệu mốt'], 1100000],
    [['8h', '8 giờ', 'tám giờ', '8:00'], 8],
    [['hai mươi lăm', 'hai lăm', '25'], 25],
  ];
  for (const [cachViet, mong] of bang) {
    for (const c of cachViet) assert.ok(gan(giaTri(`giá ${c} nha`), [mong]), `"${c}" → ${JSON.stringify(laySo(c))}`);
  }
  for (const c of ['48–55 kg', '48 đến 55 kg', 'bốn mươi tám tới năm mươi lăm ký']) {
    const s = laySo(c);
    assert.ok(gan(s.map((x) => x.giaTri), [48, 55]) && s.every((x) => x.donVi === 'kg'), c);
  }
});

test('các cách viết hay gặp khi bán hàng: giá, phí ship, số còn, số đo, phần trăm, ngày đổi trả', () => {
  const mau = [
    ['giá 199k', [199000]], ['giá 1tr250', [1250000]], ['2 triệu 350', [2350000]], ['phí ship 30.000đ', [30000]],
    ['ship 30k', [30000]], ['ship ba mươi nghìn', [30000]], ['miễn phí ship từ 500k', [500000]], ['1,5 triệu', [1.5e6]],
    ['từ 250k đến 300k', [250000, 300000]], ['250-300k', [250000, 300000]], ['đơn DH-0042 tổng 319.000đ', [319000]],
    ['còn 5 chiếc', [5]], ['còn năm cái', [5]], ['chỉ còn 3 bộ', [3]], ['mua 12 chiếc', [12]], ['còn đúng 1 chiếc cuối cùng', [1]],
    ['cao 158cm', [158]], ['cao 158 cm', [158]], ['một trăm năm mươi tám phân', [158]], ['nặng 50kg', [50]], ['nặng 50 ký', [50]],
    ['năm mươi cân', [50]], ['vòng eo 64 phân', [64]], ['dài áo 65cm', [65]], ['155–162 cm', [155, 162]], ['từ 48 đến 55 kg', [48, 55]],
    ['Size M: chiều cao 155–162 cm, cân nặng 48–55 kg', [155, 162, 48, 55]], ['giảm 10%', [10]], ['mười phần trăm', [10]],
    ['đổi trả trong 7 ngày', [7]], ['giao 2-3 ngày', [2, 3]], ['từ 2 đến 3 ngày', [2, 3]], ['289k/cái', [289000]],
    ['289k mỗi cái', [289000]], ['không có số nào', []], ['mã DH-0042 nhé', []], ['dh-0042 nhé', []],
  ];
  for (const [cau, mong] of mau) assert.ok(gan(giaTri(cau), mong), `"${cau}" → ${JSON.stringify(giaTri(cau))}, mong ${JSON.stringify(mong)}`);
  assert.deepEqual(donVi('còn 5 chiếc'), ['chiec']);
  assert.deepEqual(donVi('nặng 50 ký'), ['kg']);
  assert.deepEqual(donVi('cao 158 cm'), ['cm']);
  assert.deepEqual(donVi('ship 30k'), ['tien']);
  // "9 triệu một tháng" là 9 triệu mỗi tháng, không phải 9,1 triệu.
  assert.ok(gan(giaTri('9 triệu một tháng'), [9e6, 1]));
  // Mã đã biết bỏ đi trước khi đọc số.
  assert.ok(gan(giaTri('SP-12 giá 289k', { boMa: ['SP-12'] }), [289000]));
});

test('"289k một cái" là 289.000đ mỗi cái, không phải 289.100đ', () => {
  // "một cái" đọc là 1 chiếc (được miễn K3 như "một tháng"), giá vẫn đúng 199.000.
  assert.ok(gan(giaTri('giá 199k một cái'), [199000, 1]));
  assert.ok(gan(giaTri('289k 1 chiếc'), [289000, 1]));
  assert.ok(gan(giaTri('199k hai cái'), [199000, 2]));
  assert.ok(gan(giaTri('1 triệu một bộ'), [1e6, 1]));
  assert.ok(gan(giaTri('ship 30k một đơn'), [30000, 1]));
  assert.deepEqual(soKhongCoTrongNguon('Dạ áo này giá 199k một cái ạ', ['Giá: 199.000đ']), [], 'câu đúng không bị chặn');
});

test('chiều cao viết "1m58" đọc được thành 158 cm', () => {
  assert.ok(gan(giaTri('chị cao 1m58'), [158]));
  assert.deepEqual(donVi('chị cao 1m58'), ['cm']);
});

test('K3: số trong câu phải có trong nguồn sau quy đổi; không suy ra từ khoảng', () => {
  const thua = (cau, nguon) => soKhongCoTrongNguon(cau, nguon).map((s) => s.giaTri);
  const THE = ['Giá: 289.000đ', 'Giá Đen/XXL: 319.000đ', 'Còn bán được Đen/M: 3', 'Size M: chiều cao 155–162 cm, cân nặng 48–55 kg'];
  assert.deepEqual(thua('Dạ áo giá 250k thôi chị', THE), [250000], 'sai giá → chặn');
  assert.deepEqual(thua('Dạ áo giá hai trăm tám mươi chín nghìn ạ', THE), []);
  assert.deepEqual(thua('Màu đen size XXL giá 319k chị nha', THE), []);
  assert.deepEqual(thua('Đen M còn 5 chiếc ạ', THE), [5], 'sai số còn → chặn');
  assert.deepEqual(thua('Đen M còn 3 chiếc ạ', THE), []);
  assert.deepEqual(thua('Chị nặng 52kg thì mặc M ạ', THE), [52], 'số không có trong bảng size → phải có trong trích dẫn');
  assert.deepEqual(thua('Size M hợp người cao 155 đến 162 cm ạ', THE), []);
  assert.deepEqual(thua('Người cao 160cm mặc M vừa', THE), [160], 'không suy ra từ khoảng 155–162');
  assert.deepEqual(thua('Phí ship 30k nha chị', ['Phí ship: 30.000đ']), []);
  assert.deepEqual(thua('Tổng đơn DH-0042 là 319.000đ ạ', ['Tổng tiền đơn DH-0042: 319.000đ']), []);
  assert.deepEqual(thua('Shop giảm 20% cho chị', THE), [20], 'hứa giảm giá không có nguồn → chặn');
  assert.deepEqual(thua('Làm 2 bước là xong', []), [], 'số không đơn vị từ 0 đến 10 được miễn');
});
