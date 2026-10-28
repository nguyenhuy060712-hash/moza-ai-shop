'use strict';

/**
 * K11 — từ cấm (SPEC.md F-79, #107): thương hiệu khác, từ tuyệt đối, so sánh luôn chặn; xuất xứ, công dụng chặn trừ khi trích
 * đúng dòng thẻ sản phẩm / Sổ tay có cụm đó. Cách gọi món "áo số 1" không bị chặn. Bộ câu do Claude Code soạn 28/9/2026.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

// [câu, trích dẫn (hoặc null), chặn?]
const CA = [
  ['Áo số 1 màu đen còn size M nha', null, false],
  ['Số 1 màu đen đẹp lắm cả nhà', null, false],
  ['Hàng số 1 thị trường luôn đó', null, true],
  ['Áo này số một luôn cả nhà', null, true],
  ['Dáng Zara mà giá mềm lắm', null, true],
  ['Mẫu này y chang Uniqlo', null, true],
  ['Hàng auth 100% nha', null, true],
  ['Hàng hiệu mà giá rẻ', null, true],
  ['Rep 1:1 luôn cả nhà', null, true],
  ['Túi này super fake đó', null, true],
  ['Kiểu H&M đang hot', null, true],
  ['Chất vải đẹp nhất shop', null, true],
  ['Giá rẻ nhất thị trường', null, true],
  ['Mẫu duy nhất còn lại', null, true],
  ['Hàng đầu về chất lượng', null, true],
  ['Rẻ hơn chợ khác nhiều', null, true],
  ['Shop khác bán đắt hơn', null, true],
  ['Ngoài chợ không có mẫu này', null, true],
  ['Bên kia bán 300k lận', null, true],
  ['Không đâu rẻ hơn shop nha', null, true],
  ['Hàng xuất khẩu xịn', null, true],
  ['Hàng VNXK dư xịn', null, true],
  ['Quảng Châu loại 1 nha cả nhà', null, true],
  ['Hàng Thái chính gốc', null, true],
  ['Made in Korea đó', null, true],
  ['Vải kháng khuẩn cả nhà ơi', null, true],
  ['Áo chống nắng tốt', null, true],
  ['Vải chống tia UV', null, true],
  ['Mặc giảm mỡ bụng', null, true],
  // Có nguồn: thẻ sản phẩm ghi, câu trích đúng dòng đó.
  ['Vải kháng khuẩn cả nhà ơi', [{ nguon: '12', doan: 'vải kháng khuẩn' }], false],
  ['Áo chống nắng, thoáng', [{ nguon: '12', doan: 'áo chống nắng' }], false],
  // Nguồn không có cụm → vẫn chặn.
  ['Vải kháng khuẩn cả nhà ơi', [{ nguon: '12', doan: 'vải linen mát, thấm hút' }], true],
  // Câu thường, dễ chặn nhầm.
  ['Vải linen mát, thấm hút', [{ nguon: '12', doan: 'vải linen mát, thấm hút' }], false],
  ['Mát nhờ vải linen, mặc đi làm hợp', null, false],
  ['Cả nhà muốn lấy thì bình luận chốt nha', null, false],
  ['Áo form suông che bụng', null, false],
  ['Mẫu số 1 và số 2 đều còn', null, false],
  ['Hàng về nhiều màu lắm', null, false],
  ['Giá trị đơn trên 500k được miễn ship', null, false],
  ['Nhất định phải thử màu be', null, false],
  ['Hàng của shop tự thiết kế', null, false],
  ['Áo số 12 màu trắng cực xinh', null, false],
  ['Mặc lên sang lắm cả nhà', null, false],
];

test(`K11: ${CA.length} câu mẫu chặn / đạt đúng 100%`, async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  taoSanPhamMau({ so: 12, them: { diem_noi_bat: ['vải linen mát, thấm hút', 'vải kháng khuẩn', 'áo chống nắng'] } });
  taoSanPhamMau({ so: 1, ten: 'Áo thun trơn' });
  taoSanPhamMau({ so: 2, ten: 'Áo thun cổ tròn' });
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  assert.ok(CA.length >= 40);
  assert.ok(CA.filter((x) => x[2]).length >= 25 && CA.filter((x) => !x[2]).length >= 15);
  for (const [cau, td, chan] of CA) {
    const kq = kiemTraCau({ cau, trich_dan: td || [], kenh: 'messenger' });
    const k11 = kq.loi.filter((l) => l.ma === 'K11');
    assert.equal(k11.length > 0, chan, `"${cau}" → ${JSON.stringify(kq.loi)}`);
    if (chan) assert.match(k11[0].thong_diep, /^Bỏ cụm ".+" \(.+\): .+\.$/, 'lỗi kèm cách sửa');
  }
});

test('K11 quét: mọi câu mẫu Đội AI, câu mẫu tin khách, Skill mẫu (ví dụ đúng) và lời dặn mẫu không có từ cấm', () => {
  const { timTuCam } = require('../server/nghiep-vu/tu-cam');
  const doi = require('../server/cau-hinh/doi-ai-cau-mau.json');
  const cauDoi = Object.entries(doi).filter(([k]) => !k.startsWith('_')).flatMap(([k, v]) => v.flatMap((luot) => luot.map(([, loi]) => [k, loi])));
  const khach = require('../server/nghiep-vu/cau-mau-khach').tatCa().map((x) => [x.khoa, x.cau]);
  const skill = require('../server/cau-hinh/skill-mau.json').skill.flatMap((s) => [].concat(s.vi_du_dung || []).map((v) => [s.id, typeof v === 'string' ? v : JSON.stringify(v)]));
  const loiDan = Object.entries(require('../server/cau-hinh/loi-dan-mau.json')).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
  assert.ok(cauDoi.length > 20 && khach.length > 30 && skill.length > 5 && loiDan.length > 5);
  for (const [k, c] of [...cauDoi, ...khach, ...skill]) assert.deepEqual(timTuCam(c), [], `${k}: ${c}`);
  // Lời dặn được NHẮC tới từ cấm để dặn AI tránh ("không nói 'số 1'") — chỉ kiểm lời dặn không khuyên dùng chúng: bỏ qua dòng có "không".
  for (const [k, c] of loiDan) {
    const dong = c.split(/\\n|\n|(?<=[.!?])\s/).filter((x) => !/không|đừng|cấm|tránh|bỏ/i.test(x));
    assert.deepEqual(timTuCam(dong.join('\n')), [], k);
  }
});

test('Đội AI bỏ lượt có từ cấm (trừ cụm có trong thẻ); lưu sản phẩm có từ cấm → cảnh báo vàng, vẫn lưu', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const s = taoSanPhamMau({ so: 12, them: { diem_noi_bat: ['vải chống nắng'] } });
  const pt = require('../server/doi-ai/phong-thu');
  const nguon = pt.nguonSo({ sanPhamId: s.san_pham.id, chu: 'áo 12' });
  const kq = pt.soatSo([
    { ai: 'Mai', loi: 'Áo 12 hàng Quảng Châu loại 1 nha' },
    { ai: 'Hằng', loi: 'Vải chống nắng mặc đi biển hợp lắm' },
    { ai: 'Mai', loi: 'Rẻ nhất thị trường luôn' },
    { ai: 'Hằng', loi: 'Vải linen mát lắm' },
  ], nguon);
  assert.deepEqual(kq.giu.map((l) => l.loi), ['Vải chống nắng mặc đi biển hợp lắm', 'Vải linen mát lắm']);
  assert.deepEqual(kq.bo.map((b) => b.tu_cam[0]), ['quang chau loai 1', 're nhat']);

  const sp = require('../server/nghiep-vu/san-pham');
  const r = sp.suaSanPham(s.san_pham.id, { mo_ta: 'Hàng VNXK dư xịn, mặc mát.' });
  assert.equal(r.san_pham?.mo_ta ?? sp.laySanPham(s.san_pham.id).mo_ta, 'Hàng VNXK dư xịn, mặc mát.', 'vẫn lưu');
  assert.ok(r.canh_bao.some((c) => /"vnxk" \(xuất xứ\)/.test(c)), JSON.stringify(r.canh_bao));
});
