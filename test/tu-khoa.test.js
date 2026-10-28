'use strict';

// Nhận "xin dừng", "ẩn tên" bằng mã (SPEC.md F-66): câu đúng và câu dễ nhầm.

const test = require('node:test');
const assert = require('node:assert/strict');

const XIN_DUNG = ['dừng', 'DỪNG', 'Dừng lại', 'stop', 'STOP!', 'đừng nhắn nữa', 'Đừng nhắn tin nữa nha shop', 'không nhận tin nữa', 'ko nhận tin nữa ạ', 'thôi',
  'thôi shop', 'Thôi ạ', 'thôi shop ơi', 'thôi đừng nhắn nữa', 'khỏi nhắn', 'khỏi nhắn tin nha', 'hủy nhận tin', 'ngừng gửi tin', 'đừng gửi tin nữa', 'không lấy nữa',
  'ko cần nữa shop ơi', 'không lấy', 'dừng giúp em', 'shop ơi dừng nhắn giúp em', 'unsubscribe', 'k nhận nữa', 'thôi khỏi', 'không mua nữa ạ', 'đừng liên hệ',
  'không muốn nhận tin nữa', 'dung nhan nua', 'thoi shop', 'khong nhan tin nua a', 'Stop message', 'khong can nua', 'đừng nhắn', 'ngừng nhắn tin', 'ko lấy nữa',
  'k lấy nữa nha', 'dừng ạ', 'DUNG', 'thôi nha shop'];
const KHONG_PHAI_DUNG = ['thôi shop ơi em lấy size L', 'chốt 12 đen M', 'dừng lại ở màu đen đẹp quá', 'thôi lấy màu trắng', 'em không lấy màu đen, lấy trắng',
  'khong lay size M lay L', 'áo này dừng sản xuất chưa', 'dừng xe ở đâu', 'stop 12 den', 'thôi em chốt 12', 'không nhận được tin shop ơi', 'sao không nhắn cho em',
  'chưa thấy tin nhắn', 'ib em', 'đừng hết hàng nha', 'shop nhắn em đi', 'khong nhan duoc', 'thoi xong roi em chuyen khoan', 'dung roi a', 'đúng rồi ạ', 'đúng',
  'dung', 'em đồng ý', 'ok shop', 'dạ', 'thôi được rồi em lấy', '0912345678 thôi nha', 'không lấy size S nhé', 'không mua được à'];
const AN_TEN = ['ẩn tên giúp em', 'shop ơi đừng đọc tên em nha', 'đừng gọi tên mình', 'không đọc tên em đâu', 'ẩn tên', 'ko đọc tên em nha', 'đừng nêu tên em',
  'đừng nhắc tên em trên live', 'giấu tên giúp em', 'k gọi tên nhé', 'An ten dum em', 'đừng xướng tên em', 'không gọi tên em nha shop', 'đừng đọc tên nha', 'ẩn tên em với',
  'chốt 12 đen M ẩn tên giúp em'];
const KHONG_AN_TEN = ['tên áo này là gì', 'chốt 12 đen M', 'em tên Lan', 'ten mau nay la gi', 'shop gọi em đi', 'đọc tên em đi shop', 'tên em là Hoa'];

test('xin dừng nhận tin: ≥ 40 câu đúng, câu dễ nhầm không bị bắt ("thôi shop ơi em lấy size L", "đúng rồi")', () => {
  const { laXinDung } = require('../server/nghiep-vu/tu-khoa');
  assert.ok(XIN_DUNG.length >= 40);
  for (const c of XIN_DUNG) assert.equal(laXinDung(c), true, `phải là xin dừng: "${c}"`);
  for (const c of KHONG_PHAI_DUNG) assert.equal(laXinDung(c), false, `KHÔNG phải xin dừng: "${c}"`);
});

test('ẩn tên: ≥ 15 câu đúng, câu nhắc "tên" thường không bị bắt', () => {
  const { laAnTen } = require('../server/nghiep-vu/tu-khoa');
  assert.ok(AN_TEN.length >= 15);
  for (const c of AN_TEN) assert.equal(laAnTen(c), true, `phải là ẩn tên: "${c}"`);
  for (const c of KHONG_AN_TEN) assert.equal(laAnTen(c), false, `KHÔNG phải ẩn tên: "${c}"`);
});

module.exports = { XIN_DUNG, KHONG_PHAI_DUNG, AN_TEN };
