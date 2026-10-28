'use strict';

/**
 * Miệng của Mai (F-22, #30): mở / đóng theo chế độ, dữ liệu đưa thẳng (thẻ sản phẩm), đổi đoạn, câu hỏi đi thẳng tới Mai,
 * tiếng tới loa, DỪNG AI, bỏ chữ trùng lúc Mai phát, đổi miệng giữa phiên, rớt → mở lại / hạ về "Chỉ gợi ý",
 * "Dừng mọi thứ", chi phí; #72 đọc tên người vừa chốt, #80 công cụ tra cứu, #81 cập nhật tồn và Gemini không cắt lời.
 * Miệng giả: không gọi mạng, không tốn tiền.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
/** Gói tiếng có tiếng nói (to), n byte PCM 16-bit. Buffer.alloc(n) là khoảng lặng. */
const tieng = (n) => { const b = Buffer.alloc(n); for (let i = 0; i + 1 < n; i += 2) b.writeInt16LE(i % 4 ? 3000 : -3000, i); return b; };

/** Miệng giả, điều khiển được từ bài test. */
function taoMiengGia() {
  const tatCa = [];
  const dk = { loiMo: null };
  class Gia {
    constructor(o) {
      Object.assign(this, o);
      this.goi = [];
      this.giay = 0;
      this.token = { vao: {}, ra: {} };
      tatCa.push(this);
    }
    async mo() {
      if (dk.loiMo) throw new Error(dk.loiMo);
      this.daMo = true;
    }
    guiAm(b) { this.goi.push(['am', b.length]); }
    duaNguCanh(c) { this.goi.push(['nguCanh', c]); }
    hoi(c) { this.goi.push(['hoi', c]); }
    async dong() { this.daDong = true; }
    cuoi(loai) { return this.goi.filter((x) => x[0] === loai).at(-1)?.[1]; }
  }
  class OpenAI extends Gia { constructor(o) { super(o); this.nha = 'openai'; } }
  class Gemini extends Gia { constructor(o) { super(o); this.nha = 'gemini'; } }
  return { nha: { openai: OpenAI, gemini: Gemini }, tatCa, dk };
}

/** Quần số 15 mẫu (một màu, hai cỡ), mô tả riêng để không lẫn với thẻ áo 12. */
const QUAN_15 = { so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'],
  them: { mo_ta: 'Jean mặc đi chơi, tôn dáng.', diem_noi_bat: ['vải jean co giãn nhẹ', 'ống suông che bắp chân'] } };

test('chia ngữ cảnh dài cho GPT Live 1 (mỗi lần dưới 500 token)', () => {
  const { chiaNho } = require('../server/agent/mieng/gpt-live');
  const dai = Array.from({ length: 40 }, (_, i) => `Dòng ${i}: Còn bán được Đen/M: 5, giá 289.000đ, vải linen mát, form suông.`).join('\n');
  const manh = chiaNho(dai, 300);
  assert.ok(manh.length > 5);
  assert.ok(manh.every((m) => m.length <= 300));
  assert.equal(manh.join('\n'), dai, 'không mất chữ nào');
  assert.deepEqual(chiaNho('ngắn'), ['ngắn']);
});

test('miệng của Mai trong buổi live', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const soTay = require('../server/nghiep-vu/so-tay');
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const don = require('../server/nghiep-vu/don');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const { PhongAi } = require('../server/phong-ai');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');

  const mau12 = taoSanPhamMau();
  const sp12 = mau12.san_pham;
  taoSanPhamMau(QUAN_15);
  taoSanPhamMau({ so: 99, ten: 'Váy hoa cũ', trangThai: 'ngung_ban' });
  const muc = soTay.danhSachMuc()[0];
  soTay.suaMuc(muc.id, { tieu_de: muc.tieu_de, noi_dung: 'Shop đổi size miễn phí trong 7 ngày.' });
  const kb = kichBan.taoNhanh(); // [chung, áo 12, quần 15, chung]
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  live.ganLive(p.id, 'livegia_x');

  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const phongAi = new PhongAi({ phat });
  const chepLoi = {
    fn: null,
    layLaiLan: 0,
    nhuong(fn) { this.fn = fn; },
    layLai() { this.fn = null; this.layLaiLan += 1; },
  };
  const gia = taoMiengGia();
  const mieng = new MiengCuaMai({ phat, chepLoi, phongAi, nhaMieng: gia.nha });
  phongAi.mieng = mieng;
  const nhanLoa = [];
  const loa = { readyState: 1, send: (b) => nhanLoa.push(b) };
  mieng.datLoa(loa);
  const suKienCuoi = (type) => suKien.filter((e) => e.type === type).at(-1);

  await t.test('chế độ "Chỉ gợi ý" → không mở miệng, không phát tiếng', async () => {
    await mieng.dongBo();
    assert.equal(gia.tatCa.length, 0);
    assert.equal(mieng.trangThai(p.id).trang_thai, 'tat');
  });

  let m1;
  await t.test('"Co-host được nói" → mở miệng mặc định với thẻ sản phẩm và Sổ tay trong lời dặn; micro chuyển cho miệng', async () => {
    live.datCheDo(p.id, { che_do_ai: 'noi' });
    await mieng.dongBo();
    assert.equal(gia.tatCa.length, 1);
    m1 = gia.tatCa[0];
    assert.equal(m1.model, 'gpt-live-1');
    assert.equal(m1.giong, 'marin');
    assert.match(m1.loiDan, /giọng nói của trợ lý AI cùng dẫn livestream bán hàng/);
    assert.match(m1.loiDan, /Cách chốt của khách: bình luận "chốt" \+ số \+ màu \+ size/);
    assert.match(m1.loiDan, /### Áo số 12 · Sơ mi linen tay ngắn\nDanh mục: Áo sơ mi\nGiá: 289\.000đ/);
    assert.match(m1.loiDan, /Còn bán được Đen\/M: 5/);
    assert.match(m1.loiDan, /### Quần số 15 · Quần jean ống suông/);
    assert.doesNotMatch(m1.loiDan, /Váy hoa cũ/, 'sản phẩm không trong phiên, không Đang bán thì không đưa');
    assert.match(m1.loiDan, /đổi size miễn phí trong 7 ngày/);
    assert.equal(typeof m1.traCuu, 'function', 'miệng có công cụ tra cứu (#80)');
    assert.equal(mieng.trangThai(p.id).trang_thai, 'san_sang');
    assert.equal(suKienCuoi('live.mieng').trang_thai, 'san_sang');
    assert.equal(typeof chepLoi.fn, 'function');
    chepLoi.fn(Buffer.alloc(3200));
    assert.deepEqual(m1.cuoi('am'), 3200, 'tiếng micro đi vào miệng');
  });

  await t.test('lần đồng bộ sau: báo đoạn đang nói; đổi đoạn → gửi lại thẻ của sản phẩm đó', async () => {
    await mieng.dongBo();
    assert.match(m1.cuoi('nguCanh'), /đoạn 1\/4: đoạn chung/);
    live.doiDoan(p.id, 1);
    await mieng.dongBo();
    assert.match(m1.cuoi('nguCanh'), /đoạn 2\/4 — Áo số 12 · Sơ mi linen tay ngắn\. Thẻ sản phẩm \(còn bán được lúc này\):\n\n### Áo số 12 · Sơ mi linen tay ngắn\nDanh mục/);
    const truoc = m1.goi.length;
    await mieng.dongBo();
    assert.equal(m1.goi.length, truoc, 'không đổi đoạn thì không gửi lại');
  });

  await t.test('ô Hỏi Mai → câu hỏi đi thẳng tới miệng (không cần Co-host, không cần đoán số)', () => {
    const kq = phongAi.hoiMai(p.id, 'Áo này có mấy màu vậy em?');
    assert.deepEqual(kq, { da_giao: true, mai_noi: true });
    assert.equal(m1.cuoi('hoi'), 'Người dẫn hỏi Mai: "Áo này có mấy màu vậy em?"');
    assert.equal(suKienCuoi('live.goi_mai').cau_hoi, 'Áo này có mấy màu vậy em?');
  });

  await t.test('Director giao câu hỏi → Mai trả lời người xem; câu đó tính là đã trả lời', () => {
    phongAi.st.noiBat = [{ id: 'ch1', cau_hoi: 'Giá bao nhiêu?', so: 12, binh_luan_ids: [], da_goi_y: false }];
    const kq = phongAi.giaoCohost({ cauHoi: 'Áo 12 giá bao nhiêu?', so: 12 });
    assert.equal(kq.mai_noi, true);
    assert.equal(m1.cuoi('hoi'), 'Người xem hỏi về Áo số 12 · Sơ mi linen tay ngắn: "Áo 12 giá bao nhiêu?". Mai trả lời người xem.\nCâu giá (đọc đúng nguyên văn): "Áo số 12 giá 289.000đ".', 'F-80: kèm câu giá đọc đúng nguyên văn');
    assert.equal(phongAi.st.noiBat[0].da_goi_y, true);
    assert.equal(phongAi.giaoCohost({ cauHoi: 'áo này bao tiền vậy', so: 12 }).bo_qua, true, 'không giao lại câu đã trả lời');
  });

  await t.test('#80: Mai tự tra còn hàng đúng lúc hỏi — số còn bán được đã trừ hàng đang giữ; chỉ sản phẩm trong phiên', () => {
    let kq = m1.traCuu('xem_con_hang', { so: 12 });
    assert.equal(kq.so, 12);
    assert.equal(kq.tong, 20);
    assert.ok(kq.dong.includes('Còn bán được Đen/M: 5'));
    don.taoDon({ mon: [{ phan_loai_id: mau12.pl('Đen', 'M').id, so_luong: 4 }], nguon: 'nguoi', phienLiveId: p.id });
    kq = m1.traCuu('xem_con_hang', { so: 12 });
    assert.equal(kq.tong, 16);
    assert.ok(kq.dong.includes('Còn bán được Đen/M: 1'));
    assert.deepEqual(kq.sap_het, ['Đen/M'], 'còn ≤ ngưỡng thì báo sắp hết');
    assert.match(m1.traCuu('xem_san_pham', { so: 15 }).the, /Quần số 15 · Quần jean ống suông/);
    assert.match(m1.traCuu('xem_con_hang', { so: 99 }).loi, /không có trong buổi live này/);
    assert.match(m1.traCuu('cap_nhat_don', { so: 12 }).loi, /Không có công cụ/, 'miệng chỉ được tra cứu');
  });

  await t.test('tiếng Mai tới loa; Mai đang nói thì Director không giao thêm; chữ người dẫn trùng lúc Mai phát bị bỏ', () => {
    m1.khiAm(Buffer.alloc(24000)); // GPT Live gửi cả khoảng lặng: khoảng lặng không tính là Mai đang nói
    assert.equal(nhanLoa.length, 1);
    assert.equal(mieng.maiDangNoi(), false);
    m1.khiAm(tieng(24000)); // 0,5 giây tiếng nói
    assert.equal(nhanLoa.length, 2);
    assert.equal(mieng.maiDangNoi(), true);
    const kq = phongAi.giaoCohost({ cauHoi: 'Quần 15 ship mấy ngày?', so: 15 });
    assert.equal(kq.bo_qua, true);
    assert.match(kq.ly_do, /Mai đang nói/);
    m1.khiChuVao('Dạ áo số 12 giá'); // tiếng Mai lọt vào micro
    assert.equal(mieng.m.loiDan || '', '');
    m1.khiChuRa('Dạ, áo số 12 giá ');
    m1.khiChuRa('289.000đ ạ.');
    assert.equal(suKienCuoi('live.mai_noi').chu, 'Dạ, áo số 12 giá 289.000đ ạ.');
  });

  await t.test('DỪNG AI → bỏ tiếng đang chờ, báo miệng im, Mai im hẳn tới khi có câu hỏi mới', () => {
    const truoc = nhanLoa.length;
    phongAi.dungAi(p.id);
    assert.ok(suKien.some((e) => e.type === 'live.mai_ngat' && e.ly_do === 'DỪNG AI'));
    assert.match(m1.cuoi('nguCanh'), /DỪNG/);
    assert.equal(mieng.maiDangNoi(), false);
    m1.khiAm(tieng(4800));
    m1.khiAm(Buffer.alloc(4800));
    m1.khiAm(tieng(4800));
    assert.equal(nhanLoa.length, truoc, 'phần còn lại của câu (cả khoảng lặng giữa câu) không ra loa');
    mieng.m.amCuoi = Date.now() - 1000;
    m1.khiAm(tieng(4800));
    assert.equal(nhanLoa.length, truoc, 'miệng tự nói lại sau một lúc (Gemini, chạy thật) cũng không ra loa');
    phongAi.hoiMai(p.id, 'Ship mấy ngày em?');
    m1.khiAm(tieng(4800));
    assert.equal(nhanLoa.length, truoc, 'câu đang dở lúc có câu hỏi mới vẫn bỏ');
    mieng.m.amCuoi = Date.now() - 1000; // một khoảng lặng: câu trả lời mới bắt đầu
    m1.khiAm(tieng(4800));
    assert.equal(nhanLoa.length, truoc + 1, 'câu trả lời mới phát bình thường');
    mieng.m.phatDen = 0;
  });

  await t.test('sau DỪNG AI, người dẫn nói tiếp với Mai → Mai được nói lại', () => {
    phongAi.dungAi(p.id);
    const truoc = nhanLoa.length;
    m1.khiChuVao('Mai ơi cho chị hỏi');
    mieng.m.amCuoi = Date.now() - 1000;
    m1.khiAm(tieng(4800));
    assert.equal(nhanLoa.length, truoc + 1);
    mieng.m.phatDen = 0;
    mieng.m.loiDan = '';
    clearTimeout(mieng.m.henLoiDan);
  });

  await t.test('chép lời người dẫn từ miệng → màn hình và Director (không lưu)', async () => {
    m1.khiChuVao('Các bạn ơi ');
    m1.khiChuVao('hôm nay bên mình xả hàng linen.');
    assert.equal(suKienCuoi('live.loi_nguoi_dan').tam, true);
    await cho(1300);
    const e = suKienCuoi('live.loi_nguoi_dan');
    assert.equal(e.tam, false);
    assert.equal(e.chu, 'Các bạn ơi hôm nay bên mình xả hàng linen.');
    assert.equal(phongAi.st.loiNguoiDan.at(-1).chu, 'Các bạn ơi hôm nay bên mình xả hàng linen.');
  });

  await t.test('#72 có người vừa chốt → Mai đọc một câu ngắn; #81 tồn vừa đổi → cập nhật bối cảnh, không cắt lời', () => {
    mieng.baoVuaChot('Lan vừa chốt áo số 12 màu Đen size M');
    assert.match(m1.cuoi('hoi'), /^MOZA báo có người vừa chốt đơn — nói ngay một câu ngắn, vui, rồi dẫn tiếp: "Lan vừa chốt áo số 12 màu Đen size M"\.$/);
    const soHoi = m1.goi.filter((x) => x[0] === 'hoi').length;
    mieng.capNhatTon('áo số 12 Đen/M còn 1.');
    assert.equal(m1.cuoi('nguCanh'), 'Cập nhật còn hàng (MOZA): áo số 12 Đen/M còn 1. Chỉ nói số còn theo cập nhật mới nhất này.');
    assert.equal(m1.goi.filter((x) => x[0] === 'hoi').length, soHoi, 'cập nhật tồn không phải lượt nói mới');
  });

  await t.test('sản phẩm Ngừng bán giữa buổi → báo miệng, báo đỏ người dẫn', () => {
    sp.doiTrangThai(sp12.id, 'ngung_ban');
    phongAi.sanPhamNgungBan(12);
    assert.match(m1.cuoi('nguCanh'), /Sản phẩm số 12 vừa ngừng bán: không nói về món này nữa/);
    assert.equal(phongAi.st.bao.muc, 'do');
    sp.doiTrangThai(sp12.id, 'dang_ban');
  });

  let m2;
  await t.test('đổi miệng giữa phiên → đóng miệng cũ (ghi chi phí), mở miệng mới với dữ liệu', async () => {
    m1.giay = 90;
    live.datCheDo(p.id, { che_do_ai: 'noi', mieng: 'gemini-3.8-live' });
    await mieng.dongBo();
    assert.equal(m1.daDong, true);
    m2 = gia.tatCa.at(-1);
    assert.equal(m2.nha, 'gemini');
    assert.equal(m2.model, 'gemini-3.8-live');
    assert.equal(m2.giong, 'Zephyr');
    assert.match(m2.loiDan, /### Áo số 12 · Sơ mi linen tay ngắn/);
    const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'mieng' ORDER BY bat_dau DESC").get();
    assert.equal(run.model, 'gpt-live-1');
    assert.ok(Math.abs(run.chi_phi_usd - 0.075) < 1e-9, '90 giây × 0,05 USD/phút');
    await mieng.dongBo();
    assert.match(m2.cuoi('nguCanh'), /đoạn 2\/4 — Áo số 12 · Sơ mi linen tay ngắn/, 'miệng mới cũng nhận đoạn đang nói');
  });

  await t.test('Gemini: bị ngắt lời → bỏ tiếng đang chờ; chi phí theo token', async () => {
    const dem = suKien.filter((e) => e.type === 'live.mai_ngat').length;
    m2.khiNgat();
    assert.equal(suKien.filter((e) => e.type === 'live.mai_ngat').length, dem + 1);
    m2.token = { vao: { AUDIO: 100000, TEXT: 20000 }, ra: { AUDIO: 50000 } };
    mieng.tinhTien();
    const run = csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'mieng' ORDER BY bat_dau DESC, rowid DESC").get();
    assert.equal(run.model, 'gemini-3.8-live');
    assert.ok(Math.abs(run.chi_phi_usd - (0.1 * 3 + 0.02 * 0.75 + 0.05 * 12)) < 1e-9);
    mieng.tinhTien();
    assert.equal(csdl().prepare("SELECT COUNT(*) AS n FROM agent_run WHERE agent_id = 'mieng'").get().n, 2, 'không dùng thêm thì không ghi');
  });

  await t.test('miệng rớt → mở phiên mới và đưa lại dữ liệu; rớt liên tục → hạ về "Chỉ gợi ý", báo đỏ', async () => {
    const lan = chepLoi.layLaiLan;
    m2.khiDong({ lyDo: 'kết nối đóng (1011)' });
    await cho(0);
    assert.equal(m2.daDong, true);
    assert.equal(chepLoi.layLaiLan, lan, 'đang mở lại thì micro chưa trả về chép lời');
    assert.equal(suKienCuoi('live.mieng').trang_thai, 'noi_lai');
    await mieng.dongBo();
    const m3 = gia.tatCa.at(-1);
    assert.notEqual(m3, m2);
    assert.match(m3.loiDan, /### Áo số 12 · Sơ mi linen tay ngắn/);
    m3.khiDong({ lyDo: 'rớt lần 2' });
    await cho(0);
    await mieng.dongBo();
    const m4 = gia.tatCa.at(-1);
    m4.khiDong({ lyDo: 'rớt lần 3' });
    await cho(0);
    assert.equal(live.layPhien(p.id).che_do_ai, 'goi_y');
    assert.equal(suKienCuoi('live.che_do').che_do_ai, 'goi_y');
    assert.equal(suKienCuoi('live.mieng').trang_thai, 'loi');
    assert.match(phongAi.st.bao.noi_dung, /Mai chưa nói được \(rớt lần 3\)/);
    assert.equal(phongAi.st.bao.muc, 'do');
    assert.equal(chepLoi.fn, null, 'micro trả về chép lời');
  });

  await t.test('mở không được → hạ về "Chỉ gợi ý" và báo', async () => {
    mieng.lanMoLai = [];
    gia.dk.loiMo = 'Chưa có khóa OpenAI.';
    live.datCheDo(p.id, { che_do_ai: 'noi', mieng: 'gpt-live-1' });
    await mieng.dongBo();
    assert.equal(live.layPhien(p.id).che_do_ai, 'goi_y');
    assert.match(phongAi.st.bao.noi_dung, /Chưa có khóa OpenAI/);
    gia.dk.loiMo = null;
  });

  await t.test('kết nối của hãng treo (chạy thật: Extended Thinking thiếu mức suy nghĩ) → quá hạn thì bỏ, về "Chỉ gợi ý"', async () => {
    const mieng2 = new MiengCuaMai({ phat, chepLoi, phongAi, nhaMieng: { openai: class { mo() { return new Promise(() => {}); } dong() {} } }, moToiDaMs: 50 });
    live.datCheDo(p.id, { che_do_ai: 'noi', mieng: 'gpt-live-1' });
    await mieng2.dongBo();
    assert.equal(live.layPhien(p.id).che_do_ai, 'goi_y');
    assert.match(phongAi.st.bao.noi_dung, /mở phiên quá 0 giây/);
    assert.equal(mieng2.dangDongBo, false, 'vòng đồng bộ không bị kẹt');
  });

  await t.test('"Dừng mọi thứ" bật → miệng đóng; tắt → mở lại', async () => {
    live.datCheDo(p.id, { che_do_ai: 'noi' });
    await mieng.dongBo();
    const m5 = gia.tatCa.at(-1);
    assert.equal(mieng.trangThai(p.id).trang_thai, 'san_sang');
    caiDat.datKhanCap(true);
    await mieng.dongBo();
    assert.equal(m5.daDong, true);
    assert.match(suKienCuoi('live.mieng').ly_do, /Dừng mọi thứ/);
    caiDat.datKhanCap(false);
    await mieng.dongBo();
    assert.equal(mieng.trangThai(p.id).trang_thai, 'san_sang');
  });

  await t.test('về "Chỉ gợi ý" → miệng đóng, micro về chép lời; Hỏi Mai lại do Co-host soạn', async () => {
    const lan = chepLoi.layLaiLan;
    live.datCheDo(p.id, { che_do_ai: 'goi_y' });
    await mieng.dongBo();
    assert.equal(mieng.trangThai(p.id).trang_thai, 'tat');
    assert.equal(chepLoi.layLaiLan, lan + 1);
    assert.equal(phongAi.miengSanSang(live.layPhien(p.id)), false);
  });

  await t.test('live kết thúc → miệng đóng', async () => {
    live.datCheDo(p.id, { che_do_ai: 'noi' });
    await mieng.dongBo();
    const cuoi = gia.tatCa.at(-1);
    live.ketThucPhien(p.id);
    await mieng.dongBo();
    assert.equal(cuoi.daDong, true);
    assert.equal(mieng.trangThai(p.id).trang_thai, 'tat');
  });
});

test('Gemini Live (#80, #81): công cụ tra cứu qua toolCall → sendToolResponse; Mai đang nói thì câu hỏi mới xếp hàng, không gửi turnComplete', () => {
  const { MiengGemini } = require('../server/agent/mieng/gemini-live');
  const traCuu = [];
  const ngat = [];
  const g = new MiengGemini({
    loiDan: 'lời dặn', khiAm: () => {}, khiChuRa: () => {}, khiChuVao: () => {}, khiDong: () => {}, khiNgat: () => ngat.push(1),
    traCuu: (ten, thamSo) => {
      traCuu.push([ten, thamSo]);
      if (thamSo.so === 99) throw new Error('Sản phẩm số 99 không có trong buổi live này.');
      return { so: thamSo.so, dong: ['Còn bán được Đen/M: 1'], tong: 16 };
    },
  });
  const gui = [];
  // Phiên Gemini giả: chỉ ghi lại những gì MOZA gửi đi.
  g.phien = {
    sendClientContent: (o) => gui.push(['chu', o.turns[0].parts[0].text, o.turnComplete]),
    sendToolResponse: (o) => gui.push(['cong_cu', o]),
    sendRealtimeInput() {},
    close() {},
  };
  const maiNoi = () => g.nhan({ serverContent: { modelTurn: { parts: [{ inlineData: { data: tieng(480).toString('base64') } }] } } });
  const xong = () => g.nhan({ serverContent: { turnComplete: true } });

  const ch = g.cauHinh();
  assert.deepEqual(ch.tools[0].functionDeclarations.map((f) => f.name), ['xem_san_pham', 'xem_con_hang', 'chieu_man_hinh']);
  assert.equal(new MiengGemini({ loiDan: 'x' }).cauHinh().tools, undefined, 'không có tra cứu thì không khai báo công cụ');

  g.hoi('Câu 1');
  assert.deepEqual(gui.at(-1), ['chu', 'Câu 1', true], 'Mai đang im: gửi ngay, kết thúc lượt');
  maiNoi();
  assert.equal(g.dangNoi, true);
  g.hoi('Câu 2');
  g.hoi('Câu 3');
  assert.equal(gui.length, 1, 'Mai đang nói: không gửi turnComplete (3.8 Live coi là cắt lời)');
  g.duaNguCanh('Cập nhật còn hàng (MOZA): Đen/M còn 1.');
  assert.deepEqual(gui.at(-1), ['chu', 'Cập nhật còn hàng (MOZA): Đen/M còn 1.', false], 'bối cảnh gửi ngay, không kết thúc lượt');

  // Mai gọi công cụ giữa lúc nói (3.8 Live chạy nền): MOZA trả lời ngay, không đụng hàng chờ.
  g.nhan({ toolCall: { functionCalls: [{ id: 'f1', name: 'xem_con_hang', args: { so: 12 } }, { id: 'f2', name: 'xem_con_hang', args: { so: 99 } }] } });
  assert.deepEqual(traCuu, [['xem_con_hang', { so: 12 }], ['xem_con_hang', { so: 99 }]]);
  const tl = gui.at(-1);
  assert.equal(tl[0], 'cong_cu');
  assert.deepEqual(tl[1].functionResponses[0], { id: 'f1', name: 'xem_con_hang', response: { so: 12, dong: ['Còn bán được Đen/M: 1'], tong: 16 } });
  assert.deepEqual(tl[1].functionResponses[1], { id: 'f2', name: 'xem_con_hang', response: { loi: 'Sản phẩm số 99 không có trong buổi live này.' } });
  assert.equal(g.dangNoi, true);

  xong();
  assert.deepEqual(gui.at(-1), ['chu', 'Câu 2', true], 'Mai nói xong lượt: gửi câu hỏi đầu hàng chờ');
  assert.deepEqual(g.choHoi, ['Câu 3'], 'mỗi lần một câu');
  maiNoi();
  xong();
  assert.deepEqual(gui.at(-1), ['chu', 'Câu 3', true]);

  // Bị ngắt lời cũng là hết lượt.
  maiNoi();
  g.hoi('Câu 4');
  g.nhan({ serverContent: { interrupted: true } });
  assert.equal(ngat.length, 1);
  assert.deepEqual(gui.at(-1), ['chu', 'Câu 4', true]);

  // Không thấy báo nói xong quá lâu: coi như đã xong, không giữ câu hỏi mãi.
  maiNoi();
  g.lucNoi = Date.now() - 21000;
  g.hoi('Câu 5');
  assert.deepEqual(gui.at(-1), ['chu', 'Câu 5', true]);
});

test('GPT Live 1 (#80): model xin thông tin → MOZA tra số sản phẩm trong câu và trả lời ngay', () => {
  const { MiengGptLive } = require('../server/agent/mieng/gpt-live');
  const traCuu = [];
  const g = new MiengGptLive({ loiDan: 'x', khiAm() {}, khiChuRa() {}, khiChuVao() {}, khiDong() {},
    traCuu: (ten, ts) => { traCuu.push([ten, ts]); return { so: ts.so, tong: 16 }; } });
  const rt = new EventEmitter();
  const gui = [];
  rt.send = (x) => gui.push(x);
  g.rt = rt;
  g.gan(rt);
  rt.emit('session.delegation.created', { delegation: { id: 'd1', query: 'áo số 12 còn size M màu đen không' } });
  assert.deepEqual(traCuu, [['xem_con_hang', { so: 12 }]]);
  assert.deepEqual(gui.at(-1), { type: 'session.thinking.append', delegation_id: 'd1', content: JSON.stringify({ so: 12, tong: 16 }) });
  rt.emit('session.delegation.created', { delegation: { id: 'd2', query: 'chất liệu quần 15' } });
  assert.deepEqual(traCuu.at(-1), ['xem_san_pham', { so: 15 }]);
  rt.emit('session.delegation.created', { delegation: { id: 'd3', query: 'shop mở cửa mấy giờ' } });
  assert.equal(gui.at(-1).delegation_id, 'd3');
  assert.match(gui.at(-1).content, /không có thêm thông tin/, 'không tra được thì trả câu mặc định, model không đứng chờ');
  g.dangDong = true; // không gửi session.close khi dọn
});

test('chép lời người dẫn nhường micro cho miệng rồi lấy lại', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { ChepLoiNguoiDan } = require('../server/chep-loi-nguoi-dan');

  taoSanPhamMau();
  const p = live.taoPhien({ kich_ban_id: kichBan.taoNhanh().id });
  live.ganLive(p.id, 'livegia_y');

  const cacPhien = [];
  class Gia {
    constructor(o) { Object.assign(this, o); this.nha = 'gemini'; this.model = 'gemini-3.5-transcribe-live'; this.am = 0; this.giayAm = 0; cacPhien.push(this); }
    async mo() {}
    guiAm() { this.am += 1; this.giayAm += 0.1; }
    chot() {}
    dong() { this.daDong = true; }
  }
  const suKien = [];
  const phongAi = { datNguoiDanNoi() {}, themLoiNguoiDan() {}, hoiMai() {} };
  const cl = new ChepLoiNguoiDan({ phat: (type, d) => suKien.push({ type, ...d }), phongAi, nhaChepLoi: { gemini: Gia, openai: Gia } });
  const ws = { send: (s) => suKien.push(JSON.parse(s)) };

  await cl.bat(ws, p.id);
  assert.equal(cacPhien.length, 1);
  const vaoMieng = [];
  cl.nhuong((b) => vaoMieng.push(b.length));
  assert.equal(cacPhien[0].daDong, true, 'dịch vụ chép lời nghỉ');
  assert.deepEqual(cl.trangThai(p.id), { dang_nghe: true, nha: 'mieng' });
  cl.nhan(ws, Buffer.alloc(3200), true);
  assert.deepEqual(vaoMieng, [3200]);
  assert.equal(cacPhien[0].am, 0);
  cl.layLai();
  await new Promise((r) => setImmediate(r));
  assert.equal(cacPhien.length, 2, 'miệng đóng → chép lời mở lại');
  cl.nhan(ws, Buffer.alloc(3200), true);
  assert.equal(cacPhien[1].am, 1);
  cl.tat();
});

test('tên gọi để Mai chào và câu người dẫn bảo chào kết (bản 2.7)', () => {
  const { tenGoi, CHAO_KET } = require('../server/agent/mieng/mieng');
  const { boDau } = require('../server/nghiep-vu/chung');
  assert.equal(tenGoi('Nguyễn Thị Lan'), 'Lan');
  assert.equal(tenGoi('Hùng 😀'), 'Hùng');
  assert.equal(tenGoi('Người xem'), '');
  assert.equal(tenGoi(''), '');
  assert.ok(CHAO_KET.test(boDau('Mai ơi, mình chào tạm biệt mọi người thôi')));
  assert.ok(CHAO_KET.test(boDau('Thôi mình kết thúc buổi live ở đây')));
  assert.ok(!CHAO_KET.test(boDau('Chương trình giảm giá kết thúc ngày 30')));
});

test('Mai dẫn chính (bản 2.7, #47): MOZA cầm nhịp — mở màn, tự sang đoạn, nói xen, câu hỏi xếp hàng, quay vòng, dừng và dẫn tiếp', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp = require('../server/nghiep-vu/san-pham');
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { PhongAi } = require('../server/phong-ai');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');

  const sp12 = taoSanPhamMau().san_pham;
  const sp15 = taoSanPhamMau(QUAN_15).san_pham;
  const kb = kichBan.taoKichBan({
    ten: 'Live thử Mai dẫn',
    doan: [
      { san_pham_id: null, loi_nhac: 'Người dẫn: Chào cả nhà, hôm nay có 2 mẫu mới về.\nMai: Mai chào cả nhà!' },
      { san_pham_id: sp12.id, loi_nhac: 'Người dẫn: - Vải linen mát, form suông\n- Kiểm lại: chưa chắc còn màu trắng\nMai: (chậm lại, rõ ràng) Ai lấy áo 12 thì bình luận chốt 12 kèm màu và size.' },
      { san_pham_id: sp15.id, loi_nhac: '' },
      { san_pham_id: null, loi_nhac: 'Kết thúc: nhắc mọi người chốt đơn hoặc nhắn tin cho Page.' },
    ],
  });

  await t.test('chế độ "dan" lưu thành Co-host được nói + mai_dan; đổi chế độ khác thì bỏ mai_dan', () => {
    const p0 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'dan' });
    assert.equal(p0.che_do_ai, 'noi');
    assert.equal(p0.mai_dan, true);
    assert.equal(live.datCheDo(p0.id, { che_do_ai: 'goi_y' }).mai_dan, false);
    assert.equal(live.datCheDo(p0.id, { che_do_ai: 'noi', mai_dan: true }).mai_dan, true);
    assert.equal(live.datCheDo(p0.id, { che_do_ai: 'noi' }).mai_dan, false);
    assert.throws(() => live.datCheDo(p0.id, { che_do_ai: 'xyz' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    live.ketThucPhien(p0.id);
  });

  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'dan' });
  live.ganLive(p.id, 'livegia_dan');
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const phongAi = new PhongAi({ phat });
  const chepLoi = { fn: null, nhuong(fn) { this.fn = fn; }, layLai() { this.fn = null; } };
  const gia = taoMiengGia();
  // Vòng nhịp tự chạy rất thưa: bài test gọi nhipDan() từng bước và giả thời gian trôi bằng luiGio().
  const mieng = new MiengCuaMai({ phat, chepLoi, phongAi, nhaMieng: gia.nha, nhipDan: { nhipMs: 60 * 60 * 1000, nghiMs: 50, choDapMs: 100, choMaiNoiMs: 100 } });
  phongAi.mieng = mieng;
  phongAi.datLai(p.id);
  t.after(() => mieng.dung());
  const loa = { readyState: 1, send() {} };
  const suKienCuoi = (type) => suKien.filter((e) => e.type === type).at(-1);
  const m = () => gia.tatCa.at(-1);
  const soHoi = () => m().goi.filter((x) => x[0] === 'hoi').length;
  const luiGio = (ms) => {
    const d = mieng.dan;
    for (const k of ['lucGiao', 'lucNguoiDan']) if (d[k]) d[k] -= ms;
    for (const k of ['amCuoi', 'phatDen', 'chuVaoLuc']) if (mieng.m[k]) mieng.m[k] -= ms;
  };
  /**
   * Mai nói nửa giây. Lùi mốc một chút trước: ngoài đời Mai luôn lên tiếng sau khi nhận lượt ít nhất cả giây, còn trong
   * bài test hai việc có thể rơi vào cùng một mili giây.
   */
  const maiNoi = () => {
    luiGio(10);
    m().khiAm(tieng(24000));
  };
  /** Mai nói nửa giây rồi im: tiếng phát xong từ lâu. */
  const maiNoiXong = () => {
    maiNoi();
    luiGio(2000);
  };

  await t.test('mở miệng bằng lời dặn "Mai dẫn chính" kèm dàn ý kịch bản', async () => {
    await mieng.dongBo();
    assert.match(m().loiDan, /người dẫn chính của buổi livestream bán hàng/);
    assert.match(m().loiDan, /Dàn ý kịch bản \(MOZA đưa từng đoạn theo thứ tự này\):\n1\. Chào cả nhà, hôm nay có 2 mẫu mới về\.\n2\. Áo số 12 · Sơ mi linen tay ngắn\n3\. Quần số 15 · Quần jean ống suông\n4\. Kết thúc/);
    assert.match(m().loiDan, /### Áo số 12 · Sơ mi linen tay ngắn/);
    await mieng.dongBo();
    assert.equal(soHoi(), 0, 'không gửi câu "Mai:" kiểu cùng dẫn; đoạn đầu do nhịp dẫn đưa');
  });

  await t.test('chưa mở Màn hình người dẫn (chưa có loa) → Mai chưa nói; có loa → Mai mở màn ngay, không chờ người dẫn', () => {
    mieng.nhipDan();
    assert.equal(soHoi(), 0);
    mieng.datLoa(loa);
    mieng.nhipDan();
    const cau = m().cuoi('hoi');
    assert.match(cau, /Mai mở màn ngay/);
    assert.match(cau, /\nCách nói lượt này: hào hứng, rộn ràng, chào đón \(làm theo, không đọc ra\)\.\nĐoạn 1\/4 — đoạn chung\./, 'kịch bản không ghi gợi ý: mở màn dùng cách nói mặc định (bản 2.8)');
    assert.match(cau, /Ý của đoạn: Chào cả nhà, hôm nay có 2 mẫu mới về\. Mai chào cả nhà!/);
    assert.match(cau, /Đoạn sau: Áo số 12 · Sơ mi linen tay ngắn\./);
    assert.ok(cau.length <= 1200, 'dưới giới hạn mỗi lần đưa của GPT-Live');
    assert.match(m().cuoi('nguCanh'), /Mai đang dẫn đoạn 1\/4: đoạn chung/);
    assert.equal(suKienCuoi('live.mai_dan').trang_thai, 'dang_dan');
    assert.equal(mieng.trangThai(p.id).dan.trang_thai, 'dang_dan');
    mieng.nhipDan();
    assert.equal(soHoi(), 1, 'Mai chưa nói gì thì chưa đưa thêm');
  });

  await t.test('Mai nói xong đoạn → tự sang đoạn sau; bối cảnh có thẻ sản phẩm; ý "Kiểm lại" không nằm trong lời nói; chào tên người vừa bình luận', () => {
    live.themBinhLuan(p.id, { fb_id: 'c1', ten: 'Nguyễn Thị Lan', noi_dung: 'Chào Mai' });
    const spam = live.themBinhLuan(p.id, { fb_id: 'c2', ten: 'Shop Giá Rẻ', noi_dung: 'Mua hàng inbox' });
    live.themNhan(p.id, spam.id, 'spam');
    live.themBinhLuan(p.id, { fb_id: 'c3', ten: 'Lê Văn Tuấn', noi_dung: 'chốt 12 đen M, số em 0912345678' });
    maiNoi();
    mieng.nhipDan();
    assert.equal(soHoi(), 1, 'Mai đang nói thì chưa sang đoạn');
    luiGio(2000);
    mieng.nhipDan();
    assert.equal(live.layPhien(p.id).doan_hien_tai, 1);
    assert.equal(suKienCuoi('live.doan').doan, 1, 'Màn hình người dẫn chạy theo');
    const nc = m().cuoi('nguCanh');
    assert.match(nc, /Mai đang dẫn đoạn 2\/4 — Áo số 12 · Sơ mi linen tay ngắn\. Thẻ sản phẩm \(còn bán được lúc này\):\n\n### Áo số 12 · Sơ mi linen tay ngắn\nDanh mục/);
    assert.match(nc, /Lưu ý của kịch bản \(không đọc lên sóng\):\n- Kiểm lại: chưa chắc còn màu trắng/);
    const cau = m().cuoi('hoi');
    assert.match(cau, /Đoạn 2\/4 — Áo số 12 · Sơ mi linen tay ngắn\./);
    assert.match(cau, /Ý của đoạn: - Vải linen mát, form suông Ai lấy áo 12 thì bình luận chốt 12 kèm màu và size\./);
    assert.doesNotMatch(cau, /Kiểm lại|mở màn/);
    assert.match(cau, /^Mở đầu bằng một câu chào nhanh bạn Lan \(vừa bình luận\), rồi dẫn đoạn\.\nCách nói lượt này: chậm lại, rõ ràng \(làm theo, không đọc ra\)\.\nĐoạn 2\/4/,
      'câu chào đứng đầu lượt; gợi ý cách nói của kịch bản đứng trước ý của đoạn (bản 2.8)');
    assert.doesNotMatch(cau.split('Ý của đoạn:')[1], /chậm lại|\(/, 'gợi ý không nằm trong lời Mai nói');
    assert.doesNotMatch(cau, /Rẻ|Tuấn/, 'không chào bình luận spam hay lộ số điện thoại');
  });

  await t.test('người xem hỏi lúc Mai đang nói → xếp hàng; xong đoạn thì một lượt riêng trả lời (gọi tên người hỏi), rồi mới sang đoạn sau', () => {
    maiNoi();
    const bl = live.themBinhLuan(p.id, { fb_id: 'c4', ten: 'Trần Thị Thảo', noi_dung: 'quan 15 co size S k a' });
    const kq = phongAi.giaoCohost({ cauHoi: 'Quần 15 còn size S không?', so: 15, binhLuanIds: [bl.id] });
    assert.deepEqual(kq, { da_giao: true, mai_noi: true, xep_hang: true });
    assert.equal(soHoi(), 2, 'không chen ngang Mai');
    assert.equal(suKienCuoi('live.goi_mai').ly_do, 'chờ Mai nói xong đoạn này');
    luiGio(2000);
    mieng.nhipDan();
    const traLoi = m().cuoi('hoi');
    assert.match(traLoi, /^Người xem đang hỏi — Mai trả lời ngay từng câu, gọi tên người hỏi, giọng thân tình, rõ ràng,/);
    assert.match(traLoi, /\n1\) Bạn Thảo hỏi: "Quần 15 còn size S không\?" \(về quần số 15\)\n/);
    assert.match(traLoi, /chưa sang món khác/);
    assert.equal(live.layPhien(p.id).doan_hien_tai, 1, 'lượt trả lời không chuyển đoạn');
    assert.equal(mieng.dan.cho.length, 0);
    maiNoiXong();
    mieng.nhipDan();
    const cau = m().cuoi('hoi');
    assert.match(cau, /Đoạn 3\/4 — Quần số 15 · Quần jean ống suông\./);
    assert.match(cau, /Ý của đoạn: giới thiệu món này từ thẻ sản phẩm/, 'đoạn không có lời nhắc: Mai giới thiệu từ thẻ sản phẩm');
    assert.doesNotMatch(cau, /Cách nói/, 'đoạn có sản phẩm, không có gợi ý, vòng 1: lời dặn chung lo, không ghi thêm');
    assert.equal(live.layPhien(p.id).doan_hien_tai, 2);
  });

  await t.test('tiếng Mai lọt vào micro không làm Mai chờ; người dẫn nói xen → chờ; Mai đáp xong thì nói tiếp đoạn đang dở', () => {
    maiNoi(); // Mai đang phát
    phongAi.datNguoiDanNoi(p.id, true); // micro nghe thấy tiếng — lúc này là tiếng Mai lọt vào
    const truoc = mieng.dan.lucNguoiDan;
    mieng.nhipDan();
    assert.equal(mieng.dan.lucNguoiDan, truoc, 'lúc Mai đang phát, âm lượng micro không tính là người dẫn nói');
    mieng.m.phatDen = Date.now() - 10; // người dẫn nói thật: miệng ngừng, loa hết tiếng
    mieng.nhipDan();
    assert.ok(mieng.dan.lucNguoiDan > truoc);
    const n = soHoi();
    luiGio(5000);
    mieng.nhipDan();
    assert.equal(soHoi(), n, 'người dẫn còn nói thì không đưa gì');
    phongAi.datNguoiDanNoi(p.id, false);
    mieng.nhipDan();
    assert.equal(soHoi(), n, 'người dẫn vừa thôi nói: chờ Mai đáp');
    maiNoi(); // Mai đáp người dẫn
    luiGio(2000);
    mieng.nhipDan();
    const cau = m().cuoi('hoi');
    assert.match(cau, /Mai nói tiếp phần còn lại của đoạn đang dẫn/);
    assert.match(cau, /Đoạn 3\/4/);
    assert.equal(live.layPhien(p.id).doan_hien_tai, 2, 'Mai mới nói đoạn này một chút: chưa sang đoạn sau');
  });

  await t.test('người dẫn nói với người xem mà Mai không đáp → hết thời gian chờ thì Mai dẫn tiếp, nối từ câu người dẫn vừa nói', async () => {
    mieng.dan.giayNoi = 9000; // đoạn này Mai đã nói đủ
    luiGio(50); // lượt vừa đưa đã qua một lúc (không trùng mili giây với câu người dẫn)
    m().khiChuVao('Các bạn ở xa yên tâm, shop ship toàn quốc.');
    await cho(1300); // chốt câu
    assert.equal(mieng.dan.loiNguoiDanMoi, 'Các bạn ở xa yên tâm, shop ship toàn quốc.');
    luiGio(3000);
    mieng.nhipDan();
    const cau = m().cuoi('hoi');
    assert.match(cau, /Người dẫn phụ vừa nói: "Các bạn ở xa yên tâm, shop ship toàn quốc\."/);
    assert.match(cau, /Đoạn 4\/4 — đoạn chung\./);
    assert.match(cau, /đoạn chốt của vòng này nhưng buổi live vẫn tiếp tục: không chào tạm biệt/);
    assert.match(cau, /\nCách nói lượt này: ấm, chậm lại, chân thành \(làm theo, không đọc ra\)\.\nĐoạn 4\/4/, 'đoạn chốt: cách nói mặc định');
    assert.match(cau, /Đoạn sau: điểm lại từ đầu cho người mới vào — Áo số 12 · Sơ mi linen tay ngắn\./);
    assert.equal(live.layPhien(p.id).doan_hien_tai, 3);
  });

  await t.test('hết kịch bản → quay về sản phẩm đầu tiên (bỏ Mở đầu), vòng 2 điểm lại cho người mới vào; sản phẩm Ngừng bán thì bỏ qua', () => {
    maiNoiXong();
    mieng.nhipDan();
    assert.equal(live.layPhien(p.id).doan_hien_tai, 1);
    assert.match(m().cuoi('hoi'), /Đoạn 2\/4 — Áo số 12 · Sơ mi linen tay ngắn · vòng 2: điểm lại cho người mới vào, nói ngắn hơn và dùng lời khác lần trước\./);
    assert.equal(suKienCuoi('live.mai_dan').vong, 2);
    sp.doiTrangThai(sp15.id, 'ngung_ban');
    maiNoiXong();
    mieng.nhipDan();
    assert.equal(live.layPhien(p.id).doan_hien_tai, 3, 'bỏ qua quần 15 đã ngừng bán');
    sp.doiTrangThai(sp15.id, 'dang_ban');
  });

  await t.test('người dẫn bấm ← → → Mai dẫn luôn đoạn được chọn', async () => {
    live.doiDoan(p.id, 2);
    await mieng.dongBo();
    const cau = m().cuoi('hoi');
    assert.match(cau, /Người dẫn vừa chuyển sang đoạn này: Mai dẫn luôn\./);
    assert.match(cau, /Đoạn 3\/4 — Quần số 15 · Quần jean ống suông/);
    assert.match(cau, /Cách nói lượt này: tươi, gọn, nhanh hơn một chút/, 'vòng 2, đoạn không có gợi ý: cách nói điểm lại');
  });

  await t.test('DỪNG AI → Mai thôi dẫn; "▶ Mai dẫn tiếp" → dẫn lại đoạn đang dở', () => {
    phongAi.dungAi(p.id);
    assert.equal(suKienCuoi('live.mai_dan').trang_thai, 'tam_dung');
    assert.equal(mieng.trangThai(p.id).dan.trang_thai, 'tam_dung');
    const n = soHoi();
    maiNoiXong();
    luiGio(60 * 1000);
    mieng.nhipDan();
    assert.equal(soHoi(), n, 'đang tạm dừng thì không đưa gì');
    mieng.danTiep(p.id);
    assert.match(m().cuoi('hoi'), /Người dẫn bảo Mai dẫn tiếp: nối lời tự nhiên rồi dẫn đoạn này\.\n[^]*Đoạn 3\/4/);
    assert.equal(mieng.m.chan, 'cho_cau_moi', 'phần câu dở trước DỪNG AI vẫn bị bỏ; câu mới phát sau một khoảng lặng');
    assert.equal(suKienCuoi('live.mai_dan').trang_thai, 'dang_dan');
  });

  await t.test('người dẫn bảo Mai chào tạm biệt → Mai đáp rồi thôi dẫn', () => {
    phongAi.hoiMai(p.id, 'Mai ơi, mình chào tạm biệt mọi người thôi');
    assert.equal(m().cuoi('hoi'), 'Người dẫn hỏi Mai: "Mai ơi, mình chào tạm biệt mọi người thôi"');
    assert.equal(suKienCuoi('live.mai_dan').trang_thai, 'tam_dung');
    assert.equal(suKienCuoi('live.mai_dan').ly_do, 'Người dẫn chào kết');
    const n = soHoi();
    luiGio(60 * 1000);
    mieng.nhipDan();
    assert.equal(soHoi(), n);
  });

  await t.test('đưa lượt mà Mai im → nhắc lại tối đa 2 lần, vẫn im thì thôi dẫn và báo đỏ', () => {
    mieng.danTiep(p.id);
    const cau = m().cuoi('hoi');
    const n = soHoi();
    luiGio(200);
    mieng.nhipDan();
    assert.equal(soHoi(), n + 1);
    assert.equal(m().cuoi('hoi'), cau, 'nhắc lại đúng lượt vừa đưa');
    luiGio(200);
    mieng.nhipDan();
    luiGio(200);
    mieng.nhipDan();
    assert.equal(soHoi(), n + 2);
    assert.equal(suKienCuoi('live.mai_dan').trang_thai, 'tam_dung');
    assert.match(phongAi.st.bao.noi_dung, /Mai tạm dừng dẫn: Mai không lên tiếng sau 2 lần nhắc/);
    assert.equal(phongAi.st.bao.muc, 'do');
  });

  await t.test('đổi sang "Mai nói" (cùng dẫn) → lời dặn cũ, nhịp dẫn thôi, câu hỏi lại đi thẳng; đổi lại "Mai dẫn chính" → dẫn tiếp, không mở màn lại', async () => {
    const cu = m();
    live.datCheDo(p.id, { che_do_ai: 'noi' });
    await mieng.dongBo();
    assert.equal(cu.daDong, true);
    assert.match(m().loiDan, /giọng nói của trợ lý AI cùng dẫn livestream/);
    assert.doesNotMatch(m().loiDan, /Dàn ý kịch bản/);
    assert.equal(mieng.henDan, null);
    assert.equal(mieng.trangThai(p.id).dan, null);
    const kq = phongAi.giaoCohost({ cauHoi: 'Áo 12 giặt máy được không?', so: 12 });
    assert.equal(kq.xep_hang, undefined);
    assert.match(m().cuoi('hoi'), /Người xem hỏi về Áo số 12 · Sơ mi linen tay ngắn: "Áo 12 giặt máy được không\?"/);
    live.datCheDo(p.id, { che_do_ai: 'dan' });
    mieng.chonDanChinh(p.id);
    await mieng.dongBo();
    assert.match(m().loiDan, /người dẫn chính của buổi livestream/);
    mieng.nhipDan();
    assert.match(m().cuoi('hoi'), /Từ giờ Mai là người dẫn chính/);
    assert.doesNotMatch(m().cuoi('hoi'), /mở màn/);
  });

  await t.test('live kết thúc → miệng đóng, nhịp dẫn thôi', async () => {
    const cuoi = m();
    live.ketThucPhien(p.id);
    await mieng.dongBo();
    assert.equal(cuoi.daDong, true);
    assert.equal(mieng.henDan, null);
  });
});

test('Mai dẫn chính: Mai tự nói sang sản phẩm sau → MOZA theo kịp, không đưa lại đoạn đó; câu gợi hay câu so sánh thì không tính', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { PhongAi } = require('../server/phong-ai');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');

  const sp12 = taoSanPhamMau().san_pham;
  const sp15 = taoSanPhamMau(QUAN_15).san_pham;
  const kb = kichBan.taoKichBan({
    ten: 'Theo kịp Mai',
    doan: [
      { san_pham_id: null, loi_nhac: 'Mở đầu: chào cả nhà.' },
      { san_pham_id: sp12.id, loi_nhac: '' },
      { san_pham_id: null, loi_nhac: 'Giao lưu: chào người mới vào.' },
      { san_pham_id: sp15.id, loi_nhac: '' },
      { san_pham_id: null, loi_nhac: 'Kết thúc: mời chốt đơn.' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'dan' });
  live.ganLive(p.id, 'livegia_theo');
  const suKien = [];
  const phongAi = new PhongAi({ phat: (type, d) => suKien.push({ type, ...d }) });
  const gia = taoMiengGia();
  const mieng = new MiengCuaMai({
    phat: (type, d) => suKien.push({ type, ...d }), chepLoi: { nhuong() {}, layLai() {} }, phongAi, nhaMieng: gia.nha,
    nhipDan: { nhipMs: 60 * 60 * 1000, nghiMs: 50, choDapMs: 100, choMaiNoiMs: 100 },
  });
  phongAi.mieng = mieng;
  phongAi.datLai(p.id);
  t.after(() => mieng.dung());
  mieng.datLoa({ readyState: 1, send() {} });
  const m = () => gia.tatCa.at(-1);
  /** Mai nói câu `chu` (chép lời đầu ra) rồi im: tiếng phát xong từ lâu. */
  const maiNoi = (chu) => {
    mieng.dan.lucGiao -= 10; // Mai lên tiếng sau khi nhận lượt (không trùng mili giây)
    m().khiChuRa(chu);
    m().khiAm(tieng(24000));
    const d = mieng.dan;
    d.lucGiao -= 2000;
    mieng.m.amCuoi -= 2000;
    mieng.m.phatDen -= 2000;
  };

  await mieng.dongBo();
  mieng.nhipDan(); // mở màn
  maiNoi('Chào cả nhà, hôm nay có hai mẫu mới về.');
  mieng.nhipDan();
  assert.equal(live.layPhien(p.id).doan_hien_tai, 1);

  // Câu so sánh giữa câu và câu gợi cuối đoạn nhắc quần 15: không phải Mai đã dẫn quần 15.
  maiNoi('Áo số 12 vải linen mát, dáng suông rộng rãi nên phối với Quần jean ống suông mà nhiều bạn hỏi cũng rất hợp, '
    + 'giặt máy không nhăn, mặc đi làm đi chơi đều được, có màu đen và màu trắng, đủ size M và L, cả nhà thích thì bình luận chốt ngay. '
    + 'Ai thích quần thì nghe tiếp phần sau nha, có Quần jean ống suông.');
  mieng.nhipDan();
  assert.equal(live.layPhien(p.id).doan_hien_tai, 2, 'sang đoạn giao lưu như thường');
  assert.match(m().cuoi('hoi'), /Đoạn 3\/5 — đoạn chung\./);

  // Đoạn giao lưu: Mai chào rồi tự dẫn luôn quần 15 (như chạy thật sau khi người dẫn nói xen).
  maiNoi('Chào cả nhà mới vào live. Đúng rồi, shop có ship toàn quốc. Em nối tiếp luôn, sang Quần jean ống suông nè: '
    + 'jean co giãn nhẹ, ống suông che bắp chân, màu xanh có size S và size M, mặc đi chơi hay đi làm đều hợp, '
    + 'phối áo sơ mi hay áo thun đều xinh, cả nhà thích thì bình luận chốt kèm size để shop giữ hàng nha.');
  mieng.nhipDan();
  const doan = suKien.filter((e) => e.type === 'live.doan').map((e) => e.doan);
  assert.deepEqual(doan.slice(-2), [3, 4], 'màn hình theo tới quần 15 rồi sang đoạn sau');
  assert.equal(live.layPhien(p.id).doan_hien_tai, 4);
  assert.match(m().cuoi('hoi'), /Đoạn 5\/5 — đoạn chung\./, 'không đưa lại quần 15');
});

test('lời dặn miệng bán hàng (#48): có "bản đồ cảm xúc"; bản mẫu cũ chưa sửa tay tự nâng khi khởi động, bản đã sửa tay giữ nguyên', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { csdl } = require('../server/db/ket-noi');
  const vaiTro = require('../server/nghiep-vu/vai-tro');
  const MAU = require('../server/cau-hinh/loi-dan-mau.json');
  const MAU_CU = require('../server/cau-hinh/loi-dan-mau-cu.json');
  const db = csdl();
  for (const id of ['mieng', 'mieng_dan']) {
    assert.match(MAU[id], /bán hàng/);
    assert.match(MAU[id], /giọng có lên có xuống/);
    assert.match(MAU[id], /ngừng nửa nhịp (ngay )?trước giá/);
    assert.match(MAU[id], /[Kk]hông lúc nào cũng hào hứng/);
    assert.match(MAU[id], /Lượt nào MOZA ghi "Cách nói lượt này: …" thì nói theo cách đó, không đọc chữ đó ra\./);
    assert.doesNotMatch(MAU[id], /nhịp vừa phải/, 'bỏ "nhịp vừa phải" — dễ kéo về giọng đều');
  }
  // Giả một bản mẫu cũ (bản bán hàng 3.1 chưa có bản cũ nào): "mieng" đang dùng đúng chữ bản cũ, "mieng_dan" đã sửa tay.
  const datDangDung = (id, noiDung) => {
    db.prepare("UPDATE vai_tro_ban_sua SET trang_thai = 'cu' WHERE agent_id = ? AND trang_thai = 'dang_dung'").run(id);
    const { so } = db.prepare('SELECT MAX(phien_ban) + 1 AS so FROM vai_tro_ban_sua WHERE agent_id = ?').get(id);
    db.prepare("INSERT INTO vai_tro_ban_sua (agent_id, phien_ban, noi_dung, trang_thai, luc) VALUES (?, ?, ?, 'dang_dung', ?)")
      .run(id, so, noiDung, new Date().toISOString());
  };
  MAU_CU.mieng = ['Bạn là {ten_ai}, trợ lý cùng dẫn livestream bán hàng — bản mẫu cũ, nhịp vừa phải.'];
  MAU_CU.mieng_dan = ['Bạn là {ten_ai}, người dẫn chính — bản mẫu cũ.'];
  t.after(() => { delete MAU_CU.mieng; delete MAU_CU.mieng_dan; });
  datDangDung('mieng', MAU_CU.mieng[0]);
  datDangDung('mieng_dan', 'Lời dặn chủ shop tự sửa.');
  vaiTro.gieoVaiTro();
  assert.equal(vaiTro.xem('mieng').dang_dung.noi_dung, MAU.mieng, 'bản mẫu cũ → bản mẫu mới');
  assert.equal(vaiTro.xem('mieng_dan').dang_dung.noi_dung, 'Lời dặn chủ shop tự sửa.', 'đã sửa tay thì giữ nguyên');
});

test('GPT Live, mạng gửi lên yếu (26/10/2026): dữ liệu ứ thì thôi bơm khoảng lặng, ứ nặng thì bỏ tiếng micro và báo — không dồn bộ nhớ', () => {
  const { MiengGptLive } = require('../server/agent/mieng/gpt-live');
  const bao = [];
  const m = new MiengGptLive({ loiDan: 'thử', khiAm() {}, khiChuRa() {}, khiChuVao() {}, khiDong() {}, khiMangYeu: (x) => bao.push(x) });
  const gui = [];
  const ws = { bufferedAmount: 0 };
  m.rt = { socket: { platformSocket: ws }, send: (e) => gui.push(e) };
  const pcm = Buffer.alloc(3200); // 100 ms tiếng 16 kHz
  m.guiAm(pcm);
  assert.equal(gui.length, 1, 'mạng thông: gửi bình thường');
  ws.bufferedAmount = 300 * 1024;
  m.guiAm(pcm);
  m.guiAm(pcm);
  assert.equal(gui.length, 1, 'ứ quá 256 KB: bỏ tiếng micro');
  assert.equal(m.boAm, 2);
  assert.equal(bao.length, 1, 'báo một lần (tối đa 1 lần / phút)');
  assert.equal(bao[0].dangU, 300 * 1024);
  ws.bufferedAmount = 0;
  m.guiAm(pcm);
  assert.equal(gui.length, 2, 'mạng thông lại: gửi tiếp');
  assert.equal(m.dangU(), 0);
});
