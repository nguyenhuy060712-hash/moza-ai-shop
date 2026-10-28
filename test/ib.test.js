'use strict';

/**
 * Nhận bình luận "ib / check ib / inbox / nt / chưa thấy tin / giá sao" bằng mã (SPEC.md F-70). Bộ câu do Claude Code soạn
 * 28/9/2026 theo cách viết của khách Việt (không dấu, viết tắt, từ đệm). Câu chốt, câu hỏi có món, số điện thoại: KHÔNG phải ib.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { laIb } = require('../server/nghiep-vu/tu-khoa');
const { nhanBinhLuan } = require('../server/nghiep-vu/nhan-binh-luan');

const IB = [
  'ib', 'IB', 'ib shop', 'ib shop ơi', 'ib e với', 'ib em nha', 'ib mình', 'ib mk nhé', 'Ib r', 'ib rồi shop', 'đã ib', 'check ib',
  'check ib shop ơi', 'Check inbox', 'chek ib', 'xem ib', 'rep ib', 'rep inbox e', 'inbox', 'inbox mình nha', 'inbox em với ạ', 'ibox',
  'nt', 'nt rồi', 'nt r nha', 'nhắn tin', 'nhắn riêng e', 'inbox riêng', 'chưa thấy tin', 'chưa thấy tin nhắn ạ', 'shop ơi chưa thấy tin nhắn',
  'chưa nhận được tin', 'không thấy tin nhắn', 'ko thấy tin', 'k thấy tin shop ơi', 'sao chưa thấy tin', 'sao chưa thấy ib', 'ib chưa thấy',
  'ib mà chưa thấy', 'ib lại', 'ib lại giúp em', 'ib gấp', 'ib nhanh shop', 'check tin nhắn', 'xem đơn', 'check đơn', 'b ơi ib', 'c ơi ib',
];
const GIA = ['giá sao', 'giá sao shop', 'giá bn', 'giá bn vậy ạ', 'giá bao nhiêu', 'bao nhiêu', 'bn', 'giá', 'ib giá', 'inbox giá', 'nt giá', 'bao nhiêu tiền'];
const KHONG = [
  'chốt 12 đen M', 'chot 12 den m', '12 đen M', '12 den m ib', 'ib size L cho e', 'áo 12 có size L không', 'áo 12 giá bao nhiêu', 'ship bao lâu',
  'số em 0912345678', 'DH-0042', '159k', 'đẹp quá', 'hello shop', 'dung roi', 'đúng rồi', 'thôi shop ơi', 'ẩn tên giúp em', 'lấy 2 cái',
  'mình ở Bắc Ninh', 'shop ơi áo này chất gì', 'cho em xem màu trắng', 'còn size S không', 'ib em áo 15 trắng L với', 'chốt 1 đen L ib em',
  'hôm qua đặt rồi mà chưa thấy giao',
];

test('≥ 50 câu "ib" / "giá sao" / không phải: nhận đúng bằng mã', () => {
  assert.ok(IB.length + GIA.length + KHONG.length >= 80);
  for (const c of IB) assert.deepEqual(laIb(c), { gia: false }, c);
  for (const c of GIA) assert.deepEqual(laIb(c), { gia: true }, c);
  for (const c of KHONG) assert.equal(laIb(c), null, c);
});

test('nhãn bình luận: ib → "ib"; giá sao → "ib_gia" kèm "cau_hoi" (vẫn tới Director)', () => {
  assert.ok(nhanBinhLuan('check ib shop ơi').includes('ib'));
  const n = nhanBinhLuan('giá bao nhiêu?');
  assert.ok(n.includes('ib_gia') && n.includes('cau_hoi'));
  assert.ok(!nhanBinhLuan('chốt 12 đen M').some((x) => x.startsWith('ib')));
});
