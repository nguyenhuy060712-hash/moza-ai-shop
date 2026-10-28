'use strict';

/**
 * Kịch bản live bán hàng do AI soạn (SPEC.md F-37, F-45, F-49): mỗi đoạn "Người dẫn: …" + "Mai: …"; thiếu sản phẩm,
 * số lạ, thiếu lời mời chốt, ghi số còn, kể mặc thử thì làm lại; số không có trong thẻ thì thêm dòng "Kiểm lại";
 * miệng của Mai nói phần "Mai:" khi người dẫn chuyển đoạn. Nhà cung cấp AI và miệng đều giả: không gọi mạng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

function nhaGia(kichBan) {
  const yeuCau = [];
  let i = 0;
  return {
    yeuCau,
    async goi(o) {
      yeuCau.push({ model: o.model, lichSu: JSON.parse(JSON.stringify(o.lichSu)) });
      const r = kichBan[Math.min(i, kichBan.length - 1)];
      i += 1;
      return { goiCongCu: [], chu: JSON.stringify(r), goc: null, tokenVao: 3000, tokenRa: 800 };
    },
  };
}

/** Hai sản phẩm Đang bán (áo 12, quần 15), một Nháp (số 99). */
function taoHaiSanPham() {
  const a12 = taoSanPhamMau();
  const q15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '350k', mau: ['Xanh', 'Đen'], co: ['S', 'M'] });
  const n99 = taoSanPhamMau({ so: 99, ten: 'Áo nháp', trangThai: 'nhap' });
  return { a12, q15, n99 };
}

test('tách lời nhắc: phần người dẫn và phần Mai', () => {
  const { tachLoiNhac } = require('../server/nghiep-vu/kich-ban');
  assert.deepEqual(tachLoiNhac('Người dẫn:\n- Áo 12 giá 289k\n- Vải linen mát\nMai: Ưng thì chốt 12 kèm màu, size nha!'),
    { nguoiDan: '- Áo 12 giá 289k\n- Vải linen mát', mai: 'Ưng thì chốt 12 kèm màu, size nha!', cachNoi: '' });
  assert.deepEqual(tachLoiNhac('Mở đầu: chào mọi người.'), { nguoiDan: 'Mở đầu: chào mọi người.', mai: '', cachNoi: '' }, 'không nhãn: toàn bộ cho người dẫn');
  assert.deepEqual(tachLoiNhac('MAI: Dạ em chào\ncả nhà ạ\nNgười dẫn: Cảm ơn Mai'), { nguoiDan: 'Cảm ơn Mai', mai: 'Dạ em chào cả nhà ạ', cachNoi: '' });
  assert.deepEqual(tachLoiNhac(null), { nguoiDan: '', mai: '', cachNoi: '' });
});

test('tách gợi ý cách nói ở đầu câu "Mai:" (#48)', () => {
  const { tachLoiNhac } = require('../server/nghiep-vu/kich-ban');
  assert.deepEqual(tachLoiNhac('Người dẫn:\n- Áo 12 giá 289k\nMai: (hào hứng, nhanh) Tới áo số 12 rồi cả nhà ơi!'),
    { nguoiDan: '- Áo 12 giá 289k', mai: 'Tới áo số 12 rồi cả nhà ơi!', cachNoi: 'hào hứng, nhanh' });
  assert.equal(tachLoiNhac('Mai: (vui) (cười nhẹ) Chào cả nhà!').cachNoi, 'vui, cười nhẹ', 'nhiều ngoặc liền nhau thì gộp');
  assert.deepEqual(tachLoiNhac('Mai: (vui)'), { nguoiDan: '', mai: '', cachNoi: 'vui' }, 'chỉ có gợi ý: Mai không có câu để nói');
  assert.deepEqual(tachLoiNhac('Mai: Giá (chưa gồm ship) 289 nghìn.'), { nguoiDan: '', mai: 'Giá (chưa gồm ship) 289 nghìn.', cachNoi: '' },
    'ngoặc giữa câu là lời, không phải gợi ý');
  assert.equal(tachLoiNhac('Người dẫn: (hào hứng) Chào cả nhà').cachNoi, '', 'chỉ câu của Mai mới có gợi ý');
});

test('tạo nhanh kịch bản (F-37): Mở đầu + mỗi sản phẩm Đang bán một đoạn + Kết thúc', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  assert.throws(() => kichBan.taoNhanh(), (e) => e.ma === 'SP_KHONG_BAN_DUOC', 'chưa có sản phẩm Đang bán thì báo');

  caiDat.datBanHang({ ten_shop: 'Nhà Mơ' });
  const { a12, q15, n99 } = taoHaiSanPham();
  const kb = kichBan.taoNhanh();
  assert.match(kb.ten, /^Live ngày \d\d\/\d\d$/);
  assert.equal(kb.doan.length, 4);
  assert.deepEqual(kb.doan.map((d) => d.san_pham_id), [null, a12.san_pham.id, q15.san_pham.id, null], 'xếp theo số; sản phẩm Nháp không vào');
  assert.ok(!kb.doan.some((d) => d.san_pham_id === n99.san_pham.id));
  assert.match(kb.doan[0].loi_nhac, /Nhà Mơ/);
  assert.match(kb.doan[0].loi_nhac, /"chốt" \+ số áo \+ màu \+ size/);
  assert.equal(kb.doan[1].loi_nhac, '', 'đoạn sản phẩm để trống lời nhắc cho người dẫn tự điền');
  assert.match(kb.doan[3].loi_nhac, /tin nhắn của shop/);
  assert.equal(kb.doan[1].san_pham.ten_goi, 'áo số 12', 'đoạn kèm tên gọi trên sóng (#60)');
  assert.equal(kb.doan[2].san_pham.ten_goi, 'quần số 15');
});

test('AI soạn kịch bản từ các sản phẩm Đang bán', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const { soanKichBan, soLa } = require('../server/agent/agents/soan-kich-ban');
  const { csdl } = require('../server/db/ket-noi');

  await t.test('chưa có sản phẩm Đang bán → báo, không gọi AI', async () => {
    const g = nhaGia([{}]);
    const kq = await soanKichBan({ nhaCungCap: { openai: g, gemini: g } });
    assert.equal(kq.ok, false);
    assert.equal(kq.loi.ma, 'SP_KHONG_BAN_DUOC');
    assert.equal(g.yeuCau.length, 0);
  });

  const { a12, q15 } = taoHaiSanPham();

  const PHIEU = {
    ten: 'Hàng mới tuần này',
    mo_dau: { nguoi_dan: ['Chào cả nhà, hôm nay shop có 2 mẫu', 'Ưng mẫu nào thì bình luận chốt kèm số, màu, size'], mai: 'Dạ em chào cả nhà ạ!', cach_noi: 'hào hứng, rộn ràng' },
    doan: [
      { so: 15, nguoi_dan: ['Quần jean số 15 giá 350.000đ', 'Ưng thì chốt 15 kèm màu, size nha'], mai: 'Quần này tôn dáng lắm nè.', cach_noi: 'vui, gần gũi' },
      { so: 12, nguoi_dan: ['Sơ mi linen số 12 giá 289.000đ', 'Giá gốc tận 390.000đ', 'Chốt 12 kèm màu, size'], mai: 'Vải linen mát lắm ạ.', cach_noi: 'chậm lại, rõ ràng' },
    ],
    ket_thuc: { nguoi_dan: ['Ai đã chốt thì mở tin nhắn của shop để xác nhận đơn'], mai: 'Cảm ơn cả nhà!', cach_noi: 'ấm, chậm lại' },
  };

  await t.test('thiếu sản phẩm → phiếu bị trả lại làm một lần nữa; đủ thì lưu kịch bản 4 đoạn gắn sản phẩm', async () => {
    const thieu = { ...PHIEU, doan: [PHIEU.doan[1]] };
    const g = nhaGia([thieu, PHIEU]);
    const kq = await soanKichBan({ nhaCungCap: { openai: g, gemini: g } });
    assert.equal(kq.ok, true, JSON.stringify(kq.loi));
    assert.equal(g.yeuCau.length, 2, 'làm lại một lần');
    assert.match(JSON.stringify(g.yeuCau[1].lichSu), /Thiếu đoạn cho sản phẩm số 15/);
    assert.equal(g.yeuCau[0].model, 'gpt-6-sol');
    const kb = kq.kichBan;
    assert.match(kb.ten, /^Kịch bản AI · Hàng mới tuần này · /);
    assert.deepEqual(kb.doan.map((d) => d.san_pham?.so ?? null), [null, 15, 12, null], 'thứ tự do AI xếp');
    assert.equal(kb.doan[1].san_pham_id, q15.san_pham.id);
    assert.equal(kb.doan[2].san_pham_id, a12.san_pham.id);
    assert.equal(kb.doan[1].loi_nhac, 'Người dẫn:\n- Quần jean số 15 giá 350.000đ\n- Ưng thì chốt 15 kèm màu, size nha\nMai: (vui, gần gũi) Quần này tôn dáng lắm nè.');
    assert.equal(kb.doan[0].loi_nhac, 'Người dẫn:\n- Chào cả nhà, hôm nay shop có 2 mẫu\n- Ưng mẫu nào thì bình luận chốt kèm số, màu, size\nMai: (hào hứng, rộn ràng) Dạ em chào cả nhà ạ!');
    const hoi = JSON.stringify(g.yeuCau[0].lichSu);
    assert.match(hoi, /### Áo số 12 · Sơ mi linen tay ngắn/);
    assert.match(hoi, /### Quần số 15 · Quần jean ống suông/);
    assert.match(hoi, /Giá: 289\.000đ/);
    assert.match(hoi, /chốt 12 đen M/, 'dặn cú pháp chốt');
    assert.doesNotMatch(hoi, /Còn bán được/, 'thẻ đưa AI soạn không kèm số còn');
    assert.doesNotMatch(hoi, /nhập xưởng A|150\.000/, 'không lộ ghi chú nội bộ, giá vốn');
    assert.doesNotMatch(hoi, /Áo nháp/, 'sản phẩm Nháp không đưa AI');
    assert.match(hoi, /cach_noi \(mọi đoạn\)/, 'AI được dặn ghi gợi ý cách nói cho từng đoạn');
    assert.match(hoi, /Hai đoạn liền nhau không dùng cùng một cách nói/);
    const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'soan_kich_ban' ORDER BY bat_dau DESC").get();
    assert.ok(run.chi_phi_usd > 0);
  });

  await t.test('số không có trong thẻ → thêm dòng "Kiểm lại" cho người dẫn, không chặn', async () => {
    assert.deepEqual(soLa(PHIEU.doan[1], sp.laySanPham(a12.san_pham.id)), ['390000']);
    assert.deepEqual(soLa(PHIEU.doan[0], sp.laySanPham(q15.san_pham.id)), []);
    const g = nhaGia([PHIEU]);
    const kq = await soanKichBan({ nhaCungCap: { openai: g, gemini: g } });
    const d = kq.kichBan.doan.find((x) => x.san_pham?.so === 12);
    assert.match(d.loi_nhac, /- Kiểm lại trước khi nói: số 390000 không thấy trong thẻ sản phẩm\.\nMai: /);
  });

  await t.test('luật nội dung (A.8): mời chốt đúng số, không ghi số còn, không kể mặc thử, không số lạ, không trùng', async () => {
    const { tichSai } = require('../server/agent/agents/soan-kich-ban');
    const haiSp = { 12: {}, 15: {} };
    const voi = (d12) => ({ ...PHIEU, doan: [PHIEU.doan[0], { ...PHIEU.doan[1], ...d12 }] });
    assert.deepEqual(tichSai(PHIEU, haiSp), []);
    assert.match(tichSai(voi({ nguoi_dan: ['Sơ mi linen giá 289.000đ'] }), haiSp).join(' '), /Đoạn số 12: cuối đoạn cần lời mời chốt/);
    assert.match(tichSai(voi({ nguoi_dan: ['Mời chốt 15 nha'] }), haiSp).join(' '), /Đoạn số 12: cuối đoạn cần lời mời chốt/, 'mời chốt nhầm số khác');
    assert.deepEqual(tichSai(voi({ nguoi_dan: ['Ai ưng thì chốt số 12 nha'] }), haiSp), [], '"chốt số 12" cũng được');
    assert.match(tichSai(voi({ mai: 'Màu đen chỉ còn 2 cái thôi, chốt 12 lẹ!' }), haiSp).join(' '), /không ghi số lượng còn/);
    assert.match(tichSai(voi({ mai: 'Em mặc thử rồi, mát lắm luôn!' }), haiSp).join(' '), /không kể đã mặc thử/);
    assert.match(tichSai({ ...PHIEU, doan: [...PHIEU.doan, { ...PHIEU.doan[1], so: 77 }] }, haiSp).join(' '), /Số 77 không nằm trong danh sách/);
    assert.match(tichSai({ ...PHIEU, doan: [...PHIEU.doan, PHIEU.doan[1]] }, haiSp).join(' '), /Sản phẩm số 12 có hai đoạn/);

    // Qua cả vòng soạn: phiếu ghi số còn bị trả lại, lời trả lại nói rõ lý do.
    const g = nhaGia([voi({ mai: 'Chỉ còn 2 cái thôi!' }), PHIEU]);
    const kq = await soanKichBan({ nhaCungCap: { openai: g, gemini: g } });
    assert.equal(kq.ok, true, JSON.stringify(kq.loi));
    assert.equal(g.yeuCau.length, 2);
    assert.match(JSON.stringify(g.yeuCau[1].lichSu), /không ghi số lượng còn/);
  });

  await t.test('đoạn giao lưu ngắn (so = 0) giữ đúng chỗ; quá nhiều "nhé" thì viết lại một lần, lần sau vẫn nhận', async () => {
    const { demNhe, tichSai } = require('../server/agent/agents/soan-kich-ban');
    const nhieuNhe = {
      ...PHIEU,
      doan: [PHIEU.doan[0], { so: 0, nguoi_dan: ['Chào các bạn mới vào live nhé'], mai: 'Em tóm lại nhé: quần 15 giá 350 nghìn nhé.', cach_noi: 'vui' }, PHIEU.doan[1]],
      ket_thuc: { nguoi_dan: ['Mở tin nhắn của shop nhé'], mai: 'Cảm ơn cả nhà nhé!', cach_noi: 'ấm' },
    };
    assert.equal(demNhe(nhieuNhe), 5);
    const g = nhaGia([nhieuNhe, nhieuNhe]);
    const kq = await soanKichBan({ nhaCungCap: { openai: g, gemini: g } });
    assert.equal(kq.ok, true, JSON.stringify(kq.loi));
    assert.equal(g.yeuCau.length, 2, 'viết lại một lần vì quá nhiều "nhé"; lần sau không bắt nữa');
    assert.ok(g.yeuCau[1].lichSu.at(-1).chu.includes('Dùng chữ "nhé" 5 lần; cả kịch bản tối đa 3 lần'));
    assert.deepEqual(kq.kichBan.doan.map((x) => x.san_pham?.so ?? null), [null, 15, null, 12, null]);
    assert.match(kq.kichBan.doan[2].loi_nhac, /^Người dẫn:\n- Chào các bạn mới vào live nhé\nMai: \(vui\) Em tóm lại/);

    const haiSp = { 12: {}, 15: {} };
    const giaoLuu = (chu) => ({ so: 0, nguoi_dan: [chu], mai: '', cach_noi: '' });
    assert.match(tichSai({ ...PHIEU, doan: [...PHIEU.doan, giaoLuu('a'), giaoLuu('b')] }, haiSp).join(' '), /Có 2 đoạn giao lưu; tối đa 1/);
    assert.deepEqual(tichSai({ ...PHIEU, doan: [...PHIEU.doan, giaoLuu('a')] }, haiSp), []);
  });

  await t.test('gợi ý cách nói (#48): thiếu ô thì làm lại; AI lỡ viết gợi ý vào câu thì gộp, không để thành lời', async () => {
    const { tachLoiNhac } = require('../server/nghiep-vu/kich-ban');
    const thieuCach = { ...PHIEU, mo_dau: { nguoi_dan: PHIEU.mo_dau.nguoi_dan, mai: PHIEU.mo_dau.mai } };
    const lapCach = {
      ...PHIEU,
      doan: [{ ...PHIEU.doan[0], cach_noi: '(vui, gần gũi).', mai: '(vui, gần gũi) (cười nhẹ) Quần này tôn dáng lắm nè.' }, PHIEU.doan[1]],
    };
    const g = nhaGia([thieuCach, lapCach]);
    const kq = await soanKichBan({ nhaCungCap: { openai: g, gemini: g } });
    assert.equal(kq.ok, true, JSON.stringify(kq.loi));
    assert.equal(g.yeuCau.length, 2, 'thiếu ô cach_noi → phiếu bị trả lại làm một lần nữa');
    assert.match(JSON.stringify(g.yeuCau[1].lichSu), /cach_noi/);
    const d = kq.kichBan.doan.find((x) => x.san_pham?.so === 15);
    assert.match(d.loi_nhac, /\nMai: \(vui, gần gũi, cười nhẹ\) Quần này tôn dáng lắm nè\.$/, 'gộp, bỏ trùng, bỏ dấu câu thừa');
    assert.deepEqual(tachLoiNhac(d.loi_nhac), {
      nguoiDan: '- Quần jean số 15 giá 350.000đ\n- Ưng thì chốt 15 kèm màu, size nha', mai: 'Quần này tôn dáng lắm nè.', cachNoi: 'vui, gần gũi, cười nhẹ',
    });
  });
});

test('miệng của Mai nói phần "Mai:" của kịch bản khi người dẫn chuyển đoạn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { PhongAi } = require('../server/phong-ai');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');

  const a12 = taoSanPhamMau();
  const kb = kichBan.taoKichBan({ ten: 'Kịch bản AI thử', doan: [
    { san_pham_id: null, loi_nhac: 'Người dẫn:\n- Chào cả nhà\nMai: Dạ em chào cả nhà ạ!' },
    { san_pham_id: a12.san_pham.id, loi_nhac: 'Người dẫn:\n- Áo 12 giá 289k\nMai: (hào hứng, nhanh) Ưng thì chốt 12 kèm màu, size nha.' },
    { san_pham_id: null, loi_nhac: 'Cảm ơn mọi người' },
  ] });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'noi' });
  live.ganLive(p.id, 'livegia_y');

  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const phongAi = new PhongAi({ phat });
  const chepLoi = { nhuong() {}, layLai() {} };
  const tatCa = [];
  class Gia {
    constructor(o) { Object.assign(this, o); this.goi = []; this.giay = 0; this.token = { vao: {}, ra: {} }; tatCa.push(this); }
    async mo() {}
    guiAm() {}
    duaNguCanh(c) { this.goi.push(['nguCanh', c]); }
    hoi(c) { this.goi.push(['hoi', c]); }
    async dong() {}
  }
  class OpenAI extends Gia { constructor(o) { super(o); this.nha = 'openai'; } }
  const mieng = new MiengCuaMai({ phat, chepLoi, phongAi, nhaMieng: { openai: OpenAI, gemini: OpenAI } });
  t.after(() => mieng.dung?.());

  await mieng.dongBo(); // mở miệng
  await mieng.dongBo(); // đoạn 1
  const m = tatCa[0];
  const hoi = () => m.goi.filter((x) => x[0] === 'hoi').map((x) => x[1]);
  assert.match(m.goi.filter((x) => x[0] === 'nguCanh').at(-1)[1], /Phần người dẫn tự nói ở đoạn này \(Mai không đọc lại; người dẫn im lâu thì Mai chỉ nói ngắn cho liền mạch\):\n- Chào cả nhà/);
  assert.equal(hoi().length, 1);
  assert.match(hoi()[0], /^Tới đoạn 1 của kịch bản\. Mai chỉ nói câu dẫn vào đoạn này rồi dừng, nhường lời cho người dẫn.*"Dạ em chào cả nhà ạ!"/, 'câu không có gợi ý: không có dòng "Cách nói"');
  assert.ok(suKien.some((e) => e.type === 'live.mai_kich_ban' && e.cau === 'Dạ em chào cả nhà ạ!' && e.cach_noi === null));

  live.doiDoan(p.id, 1);
  await mieng.dongBo();
  assert.match(hoi().at(-1), /chốt 12 kèm màu, size/);
  // #48: gợi ý trong ngoặc thành dòng chỉ đạo riêng, câu Mai đọc không còn chữ gợi ý.
  assert.match(hoi().at(-1), /^Cách nói lượt này: hào hứng, nhanh \(làm theo, không đọc ra\)\.\nTới đoạn 2 của kịch bản\..*: "Ưng thì chốt 12 kèm màu, size nha\."$/s);
  assert.ok(suKien.some((e) => e.type === 'live.mai_kich_ban' && e.cau === 'Ưng thì chốt 12 kèm màu, size nha.' && e.cach_noi === 'hào hứng, nhanh'));
  assert.match(m.goi.filter((x) => x[0] === 'nguCanh').at(-1)[1],
    /Người dẫn đang nói đoạn 2\/3 — Áo số 12 · Sơ mi linen tay ngắn\. Thẻ sản phẩm.*Giá: 289\.000đ.*\n\nPhần người dẫn tự nói ở đoạn này \(Mai không đọc lại; người dẫn im lâu thì Mai chỉ nói ngắn cho liền mạch\):\n- Áo 12 giá 289k/s);

  live.doiDoan(p.id, 2);
  await mieng.dongBo();
  assert.equal(hoi().length, 2, 'đoạn không có phần "Mai:" thì Mai không tự nói');
});

test('AI soạn kịch bản kiểu Đội AI dẫn (F-45): thoại nhiều nhân vật, tiết mục, đố vui, tự giới thiệu là AI', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Nhà Mơ' });
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const { soanKichBan, TIET_MUC } = require('../server/agent/agents/soan-kich-ban');
  taoHaiSanPham();

  const L = (ai, loi, cachNoi = '') => ({ ai, cach_noi: cachNoi, loi });
  const khong = { cho_sau_luot: 0, cho_giay: 0, dap_an: [] };
  const PHIEU = {
    ten: 'Talk show hàng mới',
    mo_dau: { tiet_muc: 'ban_tin', thoai: [L('Mai', 'Chào cả nhà, Mai đây, trợ lý AI của Nhà Mơ!', 'hào hứng'), L('Tùng', 'Tùng đây, cũng là trợ lý AI nè! <laugh>', 'vui'), L('Hạnh', 'Hạnh, trợ lý AI, chào cả nhà.', 'ấm')], ...khong },
    doan: [
      { so: 15, tiet_muc: 'hoi_dap', thoai: [L('Tùng', 'Mai ơi, quần số 15 giá bao nhiêu?', 'tò mò'), L('Mai', '350.000đ nè anh, ưng thì chốt 15 kèm màu, size!', 'rõ ràng')], ...khong },
      { so: 0, tiet_muc: 'do_vui', thoai: [L('Tùng', 'Đố cả nhà quần jean vừa rồi là số mấy?'), L('Mai', 'Bình luận đáp án đi nè!', 'tinh nghịch'), L('Hạnh', 'Đáp án là số 15!')], cho_sau_luot: 2, cho_giay: 20, dap_an: ['15', 'số 15'] },
      { so: 12, tiet_muc: 'so_ke', thoai: [L('Hạnh', 'Sơ mi số 12 giá 289.000đ, vải linen mát.'), L('Tùng', 'Giá gốc tận 390.000đ luôn! Chốt 12 kèm màu, size nha!', 'trêu')], ...khong },
    ],
    ket_thuc: { tiet_muc: 'chot_vong', thoai: [L('Mai', 'Cả nhà chốt kèm số, màu, size nha!'), L('Tùng', 'Rồi mở tin nhắn của shop để xác nhận đơn!')], ...khong },
  };
  const moDauMotNguoi = { ...PHIEU, mo_dau: { ...PHIEU.mo_dau, thoai: [PHIEU.mo_dau.thoai[0], PHIEU.mo_dau.thoai[0]] } };
  const g = nhaGia([moDauMotNguoi, PHIEU]);
  const kq = await soanKichBan({ kieu: 'doi', nhaCungCap: { openai: g, gemini: g } });
  assert.equal(kq.ok, true, JSON.stringify(kq.loi));
  assert.equal(g.yeuCau.length, 2, 'mở đầu chỉ một nhân vật lên tiếng → làm lại');
  assert.match(JSON.stringify(g.yeuCau[1].lichSu), /mỗi nhân vật phải lên tiếng tự giới thiệu là trợ lý AI/);
  const hoi = JSON.stringify(g.yeuCau[0].lichSu);
  assert.match(hoi, /Kiểu kịch bản lần này: \*\*Đội AI dẫn\*\*/);
  assert.match(hoi, /- Tùng \(nam\): vui tính/);
  assert.match(hoi, /tự giới thiệu mình là trợ lý AI của Nhà Mơ/);
  assert.match(hoi, /Không nhân vật nào kể đã mặc thử/);
  assert.match(hoi, /không ghi số lượng còn/);

  const kb = kq.kichBan;
  assert.match(kb.ten, /^Đội AI · Talk show hàng mới · /);
  assert.deepEqual(kb.doan.map((d) => d.san_pham?.so ?? null), [null, 15, null, 12, null]);
  assert.equal(kb.doan[0].loi_nhac, `[${TIET_MUC.ban_tin}]\nMai: (hào hứng) Chào cả nhà, Mai đây, trợ lý AI của Nhà Mơ!\nTùng: (vui) Tùng đây, cũng là trợ lý AI nè! <laugh>\nHạnh: (ấm) Hạnh, trợ lý AI, chào cả nhà.`);
  assert.equal(TIET_MUC.ban_tin, 'Bản tin hàng mới');
  assert.equal(kb.doan[1].loi_nhac, '[Hỏi nhanh – đáp gọn]\nTùng: (tò mò) Mai ơi, quần số 15 giá bao nhiêu?\nMai: (rõ ràng) 350.000đ nè anh, ưng thì chốt 15 kèm màu, size!');
  assert.equal(kb.doan[2].loi_nhac, '[Đố vui]\nTùng: Đố cả nhà quần jean vừa rồi là số mấy?\nMai: (tinh nghịch) Bình luận đáp án đi nè!\n[Chờ bình luận 20 giây]\nHạnh: Đáp án là số 15!\nĐáp án: 15; số 15');
  assert.match(kb.doan[3].loi_nhac, /^\[So kè hai mẫu\]\n/);
  assert.match(kb.doan[3].loi_nhac, /\n- Kiểm lại trước khi lên sóng: số 390000 không thấy trong thẻ sản phẩm/);
  assert.ok(doiAi.laKichBanDoi(kb));
  assert.equal(doiAi.laKichBanRadio(kb), false, 'talk show không phải Radio');
  const dv = doiAi.tachThoai(kb.doan[2].loi_nhac);
  assert.deepEqual([dv.tietMuc, dv.cho, dv.dapAn, dv.luot.length], ['Đố vui', { sau: 2, giay: 20 }, ['15', 'số 15'], 3]);

  // Luật riêng của đội: có ít nhất một đoạn so kè / phối đồ; đoạn sản phẩm vẫn phải mời chốt, không kể mặc thử.
  const { tichSaiDoi } = require('../server/agent/agents/soan-kich-ban');
  const ten = ['Mai', 'Tùng', 'Hạnh'];
  const haiSp = { 12: {}, 15: {} };
  assert.deepEqual(tichSaiDoi(PHIEU, haiSp, ten), []);
  const khongSoKe = { ...PHIEU, doan: PHIEU.doan.map((d) => (d.tiet_muc === 'so_ke' ? { ...d, tiet_muc: 'gioi_thieu' } : d)) };
  assert.ok(tichSaiDoi(khongSoKe, haiSp, ten).some((x) => /so_ke.*phoi_do/.test(x)));
  const macThu = { ...PHIEU, doan: [PHIEU.doan[0], PHIEU.doan[1], { ...PHIEU.doan[2], thoai: [L('Hạnh', 'Em mặc rồi mát lắm!'), L('Tùng', 'Chốt 12 nha!')] }] };
  assert.ok(tichSaiDoi(macThu, haiSp, ten).some((x) => /không kể đã mặc thử/.test(x)));
  const khongChot = { ...PHIEU, doan: [PHIEU.doan[0], PHIEU.doan[1], { ...PHIEU.doan[2], thoai: [L('Hạnh', 'Sơ mi đẹp lắm.'), L('Tùng', 'Mát nữa!')] }] };
  assert.ok(tichSaiDoi(khongChot, haiSp, ten).some((x) => /Đoạn số 12: cuối đoạn cần lời mời chốt/.test(x)));
});

test('AI soạn kịch bản Radio {ten_shop} (F-49): Điểm tin hàng mới, Bản tin sản phẩm, Alo {shop}, Lời nhắn gửi có [Bài hát]', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Nhà Mơ' });
  const doiAi = require('../server/nghiep-vu/doi-ai');
  const { soanKichBan, tietMucRadio, TIET_MUC_RADIO } = require('../server/agent/agents/soan-kich-ban');
  taoHaiSanPham();

  assert.deepEqual(Object.keys(tietMucRadio()), Object.keys(TIET_MUC_RADIO), 'khóa lược đồ khớp tên hiện');
  assert.equal(tietMucRadio().alo, 'Alo Nhà Mơ');

  const L = (ai, loi, cachNoi = '') => ({ ai, cach_noi: cachNoi, loi });
  const khong = { cho_sau_luot: 0, cho_giay: 0, dap_an: [], bai_hat_sau_luot: 0 };
  const PHIEU = {
    ten: 'Sóng hàng mới tối nay',
    // AI ghi nhầm tiết mục mở đầu: MOZA vẫn đặt là Điểm tin hàng mới (dấu nhận ra kịch bản Radio).
    mo_dau: { tiet_muc: 'ban_tin', thoai: [L('Mai', 'Radio Nhà Mơ xin chào, Mai là trợ lý AI!', 'ấm'), L('Tùng', 'Tùng đây, cũng là trợ lý AI!'), L('Hạnh', 'Hạnh, trợ lý AI, chào quý vị.')], ...khong },
    doan: [
      { so: 15, tiet_muc: 'ban_tin', thoai: [L('Tùng', 'Quần jean số 15 giá 350.000đ.'), L('Mai', 'Mẹo nhỏ: lộn trái khi giặt cho bền màu. Chốt 15 kèm màu, size nha!', 'thân tình')], ...khong },
      { so: 0, tiet_muc: 'loi_nhan', thoai: [L('Hạnh', 'Cảm ơn quý vị đã gửi lời nhắn, mình cùng nghe một bài hát nha.', 'ấm'), L('Tùng', 'Quay lại với hàng mới nè cả nhà!', 'tươi')], ...khong, bai_hat_sau_luot: 1 },
      { so: 12, tiet_muc: 'ban_tin', thoai: [L('Hạnh', 'Sơ mi linen số 12 giá 289.000đ.'), L('Mai', 'Mặc đi làm hợp lắm, chốt 12 kèm màu, size nha!')], ...khong },
      { so: 0, tiet_muc: 'alo', thoai: [L('Tùng', 'Nhiều bạn hay hỏi: shop có đổi size không?'), L('Hạnh', 'Shop sẽ báo trong tin nhắn nha.')], ...khong },
    ],
    ket_thuc: { tiet_muc: 'alo', thoai: [L('Mai', 'Quý vị chốt kèm số, màu, size nha!'), L('Tùng', 'Nhớ gửi lời chúc cho tụi mình!')], ...khong },
  };
  // Lần đầu thiếu chỗ bài hát trong đoạn Lời nhắn gửi → làm lại.
  const thieuBai = { ...PHIEU, doan: PHIEU.doan.map((d) => (d.tiet_muc === 'loi_nhan' ? { ...d, bai_hat_sau_luot: 0 } : d)) };
  const g = nhaGia([thieuBai, PHIEU]);
  const kq = await soanKichBan({ kieu: 'radio', nhaCungCap: { openai: g, gemini: g } });
  assert.equal(kq.ok, true, JSON.stringify(kq.loi));
  assert.equal(g.yeuCau.length, 2);
  assert.match(JSON.stringify(g.yeuCau[1].lichSu), /Lời nhắn gửi cần \\"bai_hat_sau_luot\\"/);
  const hoi = JSON.stringify(g.yeuCau[0].lichSu);
  assert.match(hoi, /\*\*Radio Nhà Mơ\*\*/);
  assert.match(hoi, /Alo Nhà Mơ/);
  assert.match(hoi, /không đóng vai chủ shop hay khách mua/);
  assert.match(hoi, /Không nói giờ hiện tại/);
  assert.match(hoi, /một mẹo hữu ích/);

  const kb = kq.kichBan;
  assert.match(kb.ten, /^Radio · Sóng hàng mới tối nay · /);
  assert.deepEqual(kb.doan.map((d) => d.san_pham?.so ?? null), [null, 15, null, 12, null, null]);
  assert.match(kb.doan[0].loi_nhac, /^\[Điểm tin hàng mới\]\n/);
  assert.match(kb.doan[1].loi_nhac, /^\[Bản tin sản phẩm\]\n/);
  assert.equal(kb.doan[2].loi_nhac, '[Lời nhắn gửi]\nHạnh: (ấm) Cảm ơn quý vị đã gửi lời nhắn, mình cùng nghe một bài hát nha.\n[Bài hát]\nTùng: (tươi) Quay lại với hàng mới nè cả nhà!');
  assert.match(kb.doan[4].loi_nhac, /^\[Alo Nhà Mơ\]\n/);
  assert.match(kb.doan[5].loi_nhac, /^\[Điểm lại\]\n/, 'kết luôn là Điểm lại dù AI ghi khác');
  assert.ok(doiAi.laKichBanDoi(kb));
  assert.ok(doiAi.laKichBanRadio(kb));
  const t2 = doiAi.tachThoai(kb.doan[2].loi_nhac);
  assert.deepEqual([t2.tietMuc, t2.baiHat, t2.cho, t2.luot.length], ['Lời nhắn gửi', { sau: 1 }, null, 2]);
  assert.deepEqual(doiAi.chiaHaiPhan(t2).map((x) => x.map((l) => l.ai)), [['Hạnh'], ['Tùng']]);

  // Nhận ra kịch bản Radio qua từng dấu: Điểm tin hàng mới, Alo {shop}, [Bài hát]; talk show thì không.
  assert.ok(doiAi.laKichBanRadio({ doan: [{ loi_nhac: '[Alo Nhà Mơ]\nMai: Chào!\nTùng: Chào!' }] }));
  assert.ok(doiAi.laKichBanRadio({ doan: [{ loi_nhac: '[Điểm tin hàng mới]\nMai: Chào!\nTùng: Chào!' }] }));
  assert.equal(doiAi.laKichBanRadio({ doan: [{ loi_nhac: '[Bản tin hàng mới]\nMai: Chào!\nTùng: Chào!' }] }), false);

  // Thiếu đoạn Lời nhắn gửi thì AI phải làm lại; kiểu talk show không bắt.
  const { tichSaiDoi } = require('../server/agent/agents/soan-kich-ban');
  const haiSp = { 12: {}, 15: {} };
  const khongLoiNhan = { ...PHIEU, doan: PHIEU.doan.filter((d) => d.tiet_muc !== 'loi_nhan') };
  assert.ok(tichSaiDoi(khongLoiNhan, haiSp, ['Mai', 'Tùng', 'Hạnh'], { radio: true }).some((x) => /Chưa có đoạn Lời nhắn gửi/.test(x)));
  const khongLoiNhanCoSoKe = { ...khongLoiNhan, doan: khongLoiNhan.doan.map((d) => (d.so === 12 ? { ...d, tiet_muc: 'so_ke' } : d)) };
  assert.deepEqual(tichSaiDoi(khongLoiNhanCoSoKe, haiSp, ['Mai', 'Tùng', 'Hạnh']), [], 'kiểu talk show không bắt Lời nhắn gửi');
});
