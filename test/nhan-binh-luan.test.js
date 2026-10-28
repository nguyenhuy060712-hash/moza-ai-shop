'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { nhanBinhLuan, coThongTinCaNhan, laCauHoi } = require('../server/nghiep-vu/nhan-binh-luan');

test('nhận ra số điện thoại, CCCD lộ công khai (#19)', () => {
  for (const s of ['chốt 12 đen M sđt 0912 345 678', 'số em 0987.654.321', '+84 903 111 222 zalo em', 'gọi 84903111222',
    'cccd em 001234567890', 'SĐT: 0356-789-123']) {
    assert.ok(coThongTinCaNhan(s), s);
  }
  for (const s of ['giá 289.000đ một chiếc', 'áo 12 còn 5 cái đen size M', 'chốt 12 đen M x2', 'cao 1m58 nặng 50kg',
    'mã đơn DH-0001', 'năm 2026', '09123']) {
    assert.ok(!coThongTinCaNhan(s), s);
  }
});

test('nhận ra câu hỏi của người xem live', () => {
  for (const s of ['giá bao nhiêu vậy shop', 'giá sao ạ?', 'có màu đen không', 'shop ở đâu vậy', 'cho em hỏi size',
    'có cod ko', 'size M còn không ạ', 'ship mấy ngày', 'Giá sao shop', 'áo 12 bn ạ', 'áo này nhiêu vậy', 'đổi size được không']) {
    assert.ok(laCauHoi(s), s);
  }
  for (const s of ['chốt 12 đen M', 'đẹp quá', 'chào shop', 'ok']) assert.ok(!laCauHoi(s), s);
});

test('gắn nhiều nhãn cùng lúc', () => {
  assert.deepEqual(nhanBinhLuan('số em 0912345678 tư vấn size giúp em được không?'), ['cau_hoi', 'thong_tin_ca_nhan']);
  assert.deepEqual(nhanBinhLuan('đẹp quá'), []);
});
