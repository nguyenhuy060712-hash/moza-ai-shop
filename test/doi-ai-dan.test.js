'use strict';

/**
 * Đội AI dẫn trên sóng (SPEC.md bản 2.9, F-46, F-48): MOZA cầm nhịp — đọc đoạn làm sẵn, sang đoạn, chen trả lời
 * người xem, câu đệm và trả lời người dẫn, đố vui, người dẫn nói xen (tạm ngừng, bỏ tiếng vọng), DỪNG AI, chào kết,
 * vòng mới. Phòng thu và loa đều giả: không gọi mạng, không tốn tiền.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const tts = require('../server/agent/nha-cung-cap/tts');
// Các bài này thử máy đọc Google (còn làm được khi chọn "gemini" ở mac-dinh.json doc_giong); máy OpenAI thử ở doc-giong-openai.test.js.
tts.datNhaDoc('gemini');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const pcm = (giay) => Buffer.alloc(Math.round(24000 * giay) * 2, 1);

/** Phòng thu giả: mỗi đoạn một (hoặc hai) phần tiếng `giayDoan` giây; câu chen phát dần một mẩu. */
function taoPhongThuGia({ giayDoan = 0.1 } = {}) {
  const tep = new Map();
  const chen = [];
  let dem = 0;
  const luuTep = (giay) => {
    dem += 1;
    const id = String(dem).padStart(20, '0');
    tep.set(id, tts.bocWav(pcm(giay)));
    return id;
  };
  const doiAi = require('../server/nghiep-vu/doi-ai');
  return {
    MODEL_CHEN: 'gemini-3.8-flash-lite-tts',
    chen,
    docTep: (id) => tep.get(id) || null,
    async lamTiengDoan({ doan }) {
      const t = doiAi.tachThoai(doan.loi_nhac);
      if (!t.luot.length) return { phan: [], bo: [], cho: null, dapAn: [], luot: [], luotTruoc: [], luotSau: [] };
      const [truoc, sau] = doiAi.chiaHaiPhan(t);
      const phan = [{ id: luuTep(giayDoan), giay: giayDoan }];
      if (sau.length) phan.push({ id: luuTep(giayDoan), giay: giayDoan });
      return {
        phan, bo: [], cho: t.cho && sau.length ? { giay: 0.15 } : null, dapAn: t.dapAn, luot: t.luot, luotTruoc: truoc, luotSau: sau, usd: 0,
        baiHat: t.baiHat ? { coTruoc: truoc.length > 0, coSau: sau.length > 0 } : null,
      };
    },
    async lamTiengLuot({ luot, khiAm }) {
      chen.push(luot.map((l) => `${l.ai}: ${l.loi}`).join(' | '));
      khiAm(pcm(0.05));
      return { id: 'x', wav: tts.bocWav(pcm(0.05)), giay: 0.05, tuKho: false, usd: 0.0001, canhBao: null };
    },
  };
}

test('Đội AI dẫn (bản 2.9, F-46): MOZA cầm nhịp cả đội', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { DoiAiDan } = require('../server/doi-ai/dan-doi');
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Nhà Mơ' });

  const a12 = taoSanPhamMau();
  const q15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '350k' });
  const kb = kichBan.taoKichBan({
    ten: 'Đội AI thử',
    doan: [
      { san_pham_id: null, loi_nhac: '[Bản tin hàng mới]\nMai: (hào hứng) Chào cả nhà, Mai là trợ lý AI!\nTùng: Tùng đây, cũng là trợ lý AI!' },
      { san_pham_id: a12.san_pham.id, loi_nhac: '[Hỏi nhanh – đáp gọn]\nTùng: Áo số 12 giá bao nhiêu hả Mai?\nMai: 289.000đ một chiếc nè, chốt 12 kèm màu, size nha!' },
      { san_pham_id: null, loi_nhac: '[Đố vui]\nTùng: Đố cả nhà, áo số 12 giá bao nhiêu?\n[Chờ bình luận 15 giây]\nHạnh: 289 nghìn một chiếc nha!\nĐáp án: 289 nghìn; 289k' },
      { san_pham_id: q15.san_pham.id, loi_nhac: '[So kè hai mẫu]\nHạnh: Quần jean số 15 giá 350.000đ.\nMai: Chọn theo dáng người nha, chốt 15 kèm màu, size!' },
    ],
  });

  await t.test('chế độ "doi" lưu thành Chỉ gợi ý + doi_ai; đổi chế độ khác thì bỏ doi_ai', () => {
    const p0 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
    assert.equal(p0.che_do_ai, 'goi_y');
    assert.equal(p0.doi_ai, true);
    assert.equal(live.datCheDo(p0.id, { che_do_ai: 'dan' }).doi_ai, false);
    assert.equal(live.datCheDo(p0.id, { che_do_ai: 'doi' }).doi_ai, true);
    assert.equal(live.datCheDo(p0.id, { che_do_ai: 'goi_y' }).doi_ai, false);
    live.ketThucPhien(p0.id);
  });

  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_doi');
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const gui = [];
  const loa = { readyState: 1, send: (b) => gui.push(b.length) };
  const mieng = { loa: new Set() };
  const phongThu = taoPhongThuGia();
  const st = { phienId: p.id, nguoiDanNoi: false };
  const phongAi = { st, datLai() {}, bao: (x) => suKien.push({ type: 'bao', x }) };
  const doi = new DoiAiDan({
    phat, mieng, phongAi, phongThu,
    nhip: { truocMs: 300, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, choTraLoiMs: 400, chaoMoiMs: 40 },
  });
  const cuoi = (type) => suKien.filter((e) => e.type === type).at(-1);
  const chay = async (ms) => { const het = Date.now() + ms; while (Date.now() < het) { doi.nhipDan(); await cho(5); } };
  const doiNoi = () => suKien.filter((e) => e.type === 'live.doi_noi' && e.luot.length).map((e) => e.luot.map((l) => `${l.ai}: ${l.loi}`).join(' | '));

  await t.test('chưa mở Màn hình người dẫn (chưa có loa) → chưa đọc; có loa → đội mở màn, đọc lần lượt, tự sang đoạn', async () => {
    doi.dongBo();
    assert.equal(doi.trangThai(p.id).trang_thai, 'dang_dan');
    await chay(60);
    assert.equal(gui.length, 0, 'không có loa thì chưa phát');
    mieng.loa.add(loa);
    await chay(250);
    assert.ok(gui.length > 0);
    assert.equal(doiNoi()[0], 'Mai: Chào cả nhà, Mai là trợ lý AI! | Tùng: Tùng đây, cũng là trợ lý AI!', 'khung "đang đọc" hiện lời, không hiện gợi ý trong ngoặc');
    assert.ok(suKien.some((e) => e.type === 'live.doan' && e.doan === 1), 'Màn hình người dẫn chạy theo đoạn đội đang đọc');
    assert.ok(doiNoi().some((x) => x.startsWith('Tùng: Áo số 12 giá bao nhiêu')));
  });

  await t.test('đố vui: đọc câu hỏi, chờ bình luận, đọc đáp án rồi chúc mừng người trả lời đúng', async () => {
    const tu = Date.now();
    while (!doi.s.doVui && Date.now() - tu < 1500) { doi.nhipDan(); await cho(5); }
    assert.ok(doi.s.doVui, 'đang chờ người xem bình luận đáp án');
    assert.match(cuoi('live.doi_dan').ly_do, /Chờ bình luận đáp án/);
    live.themBinhLuan(p.id, { fb_id: 'dv1', ten: 'Nguyễn Thị Lan', noi_dung: '289k ạ' });
    live.themBinhLuan(p.id, { fb_id: 'dv2', ten: 'Trần Văn Nam', noi_dung: '1289k' });
    live.themBinhLuan(p.id, { fb_id: 'dv3', ten: 'Vũ Thị Hoa', noi_dung: 'ko phải 289k đâu' });
    live.themBinhLuan(p.id, { fb_id: 'dv4', ten: 'Đỗ Mạnh Hùng', noi_dung: 'Áo 12 giá 289 NGHÌN' });
    await chay(400);
    assert.ok(doiNoi().includes('Hạnh: 289 nghìn một chiếc nha!'), 'phần đáp đọc sau khi chờ');
    const chuc = phongThu.chen.find((x) => /Chúc mừng|trúng phóc/.test(x));
    assert.match(chuc, /bạn Lan, bạn Hùng/, 'chúc mừng người trả lời đúng');
    assert.doesNotMatch(chuc, /Nam|Hoa/, '"1289k" và "ko phải 289k" không tính là đúng');
  });

  await t.test('người xem hỏi → Co-host soạn → đội đọc ở chỗ nghỉ kế tiếp: một người đọc câu hỏi kèm tên, Mai trả lời', async () => {
    assert.equal(doi.traLoi({ phienId: p.id, cauHoi: 'Áo 12 có size L không', cau: 'Áo số 12 có size L, màu Đen và Trắng.', ten: 'Lê Văn Tuấn' }), true);
    await chay(300);
    const x = phongThu.chen.find((c) => /Tuấn/.test(c));
    assert.match(x, /^(Tùng|Hạnh): Bạn Tuấn hỏi: Áo 12 có size L không\? Mai ơi! \| Mai: Áo số 12 có size L, màu Đen và Trắng\.$/);
  });

  await t.test('người dẫn gọi "Mai ơi" → câu đệm ngay, chờ câu trả lời, rồi Mai trả lời; chưa trả lời thì chưa sang đoạn', async () => {
    const truoc = suKien.length;
    doi.coNguoiDanHoi(p.id);
    await chay(150);
    assert.ok(phongThu.chen.some((c) => /Câu này hay nè, Mai trả lời liền đi!|Hỏi trúng chỗ|Để Mai xem/.test(c)), 'câu đệm của nhân vật khác');
    doi.traLoi({ phienId: p.id, cauHoi: 'Áo 12 giá bao nhiêu', cau: 'Áo số 12 giá 289 nghìn một chiếc ạ.', tuNguoiDan: true });
    await chay(150);
    assert.ok(phongThu.chen.some((c) => c === 'Mai: Áo số 12 giá 289 nghìn một chiếc ạ.'));
    // Đang chờ câu trả lời thì chưa đọc đoạn mới: sau câu đệm, lần đọc kế tiếp là câu trả lời.
    const doc = suKien.slice(truoc).filter((e) => e.type === 'live.doi_noi' && e.luot.length).map((e) => e.luot[0].loi);
    const dem = doc.findIndex((x) => /Câu này hay nè|Hỏi trúng chỗ|Để Mai xem/.test(x));
    assert.ok(dem >= 0);
    assert.equal(doc[dem + 1], 'Áo số 12 giá 289 nghìn một chiếc ạ.', `sau câu đệm: ${doc.join(' → ')}`);
    // Không có câu trả lời (Co-host bận) → bỏ chỗ chờ, đội đọc tiếp.
    doi.coNguoiDanHoi(p.id);
    doi.huyCho(p.id);
    assert.ok(!doi.s.hang.some((x) => x.cho));
  });

  await t.test('tiếng vọng: chữ trùng lời đội đang đọc là tiếng loa; chữ khác là người dẫn nói xen → tạm ngừng rồi đọc tiếp', async () => {
    // Chờ tới lúc đội đang đọc một đoạn.
    const tu = Date.now();
    while (!doi.s.dang && Date.now() - tu < 1000) { doi.nhipDan(); await cho(2); }
    assert.ok(doi.s.dang);
    doi.nhipDan(); // đẩy tiếng: loa đang kêu
    const chuDoc = doi.s.dang.c.chu;
    assert.equal(doi.phanLoaiLoiNguoiDan(chuDoc), 'vong');
    assert.equal(doi.phanLoaiLoiNguoiDan('ừ'), 'chua_ro');
    assert.equal(doi.phanLoaiLoiNguoiDan('các bạn ở xa cứ yên tâm bên mình ship toàn quốc luôn'), 'nguoi');
    const n = gui.length;
    doi.nguoiDanNoi();
    assert.equal(cuoi('live.mai_ngat').ly_do, 'Người dẫn nói xen');
    for (let i = 0; i < 3; i += 1) doi.nhipDan();
    assert.equal(gui.length, n, 'người dẫn đang nói: không đẩy tiếng');
    await chay(150);
    assert.ok(gui.length > n, 'người dẫn thôi nói thì đọc tiếp');
  });

  await t.test('âm lượng micro lúc loa đang kêu không tính là người dẫn; loa im rồi mới tính', () => {
    const s = doi.s;
    const luu = { dang: s.dang, lucHet: s.lucHet, lucNguoiDan: s.lucNguoiDan };
    const bayGio = Date.now();
    st.nguoiDanNoi = true;
    s.lucNguoiDan = 0;
    s.dang = { phatDen: bayGio + 500 };
    assert.equal(doi.nguoiDanDangNoi(bayGio), false, 'loa đang kêu');
    s.dang = null;
    s.lucHet = bayGio - 10;
    assert.equal(doi.nguoiDanDangNoi(bayGio), false, 'loa vừa dứt, còn vọng');
    s.lucHet = bayGio - 1000;
    assert.equal(doi.nguoiDanDangNoi(bayGio), true, 'loa đã im: micro có tiếng là người dẫn');
    st.nguoiDanNoi = false;
    Object.assign(s, luu);
  });

  await t.test('chào tên người vừa bình luận (không chào bình luận ẩn, spam, lộ số điện thoại)', async () => {
    live.themBinhLuan(p.id, { fb_id: 'ct1', ten: 'Phạm Minh Đức', noi_dung: 'chào ad' });
    const an = live.themBinhLuan(p.id, { fb_id: 'ct2', ten: 'Shop Giá Rẻ', noi_dung: 'mua hàng' });
    live.themNhan(p.id, an.id, 'spam');
    doi.s.lucChao = 0;
    // Đã chen đủ 2 câu giữa hai đoạn thì chào tên chờ tới sau đoạn kế: chờ tới khi có câu chào.
    const tu = Date.now();
    while (!phongThu.chen.some((c) => /Đức/.test(c)) && Date.now() - tu < 2000) { doi.nhipDan(); await cho(5); }
    const x = phongThu.chen.find((c) => /Đức/.test(c));
    assert.ok(x, 'có câu chào tên');
    assert.doesNotMatch(x, /Rẻ/);
  });

  await t.test('DỪNG AI → tắt tiếng, đội thôi dẫn; "▶ Dẫn tiếp" → đọc tiếp', async () => {
    doi.dungAi(p.id);
    assert.equal(doi.trangThai(p.id).trang_thai, 'tam_dung');
    assert.equal(cuoi('live.mai_ngat').ly_do, 'DỪNG AI');
    const n = gui.length;
    await chay(80);
    assert.equal(gui.length, n);
    doi.danTiep(p.id);
    await chay(200);
    assert.ok(gui.length > n);
    assert.throws(() => doi.danTiep('phien_khac'), (e) => e.ma === 'KHONG_CO_LIVE');
  });

  await t.test('hết kịch bản → vòng mới từ đoạn có sản phẩm đầu tiên, nhắc "đội trợ lý AI của {ten_shop}" cho người mới vào', async () => {
    const tu = Date.now();
    while (doi.s.vong < 2 && Date.now() - tu < 3000) { doi.nhipDan(); await cho(5); }
    const dau = suKien.find((e) => e.type === 'live.doi_dan' && e.vong === 2);
    assert.ok(dau, 'đã sang vòng 2');
    assert.equal(dau.doan, 1, 'vòng mới bỏ đoạn mở đầu, về đoạn có sản phẩm đầu tiên');
    assert.ok(phongThu.chen.some((c) => /trợ lý AI của Nhà Mơ/.test(c)), 'câu mẫu điền tên shop');
    assert.ok(!phongThu.chen.some((c) => /\{\w+\}/.test(c)), 'không còn chỗ trống {…} chưa điền');
  });

  await t.test('người dẫn bấm ← → → đội đọc luôn đoạn được chọn', async () => {
    const truoc = suKien.length;
    const chon = doi.s.i === 3 ? 1 : 3;
    live.doiDoan(p.id, chon);
    doi.dongBo();
    assert.equal(doi.s.i, chon);
    await chay(300);
    // Đoạn đầu tiên đọc sau khi chuyển là đoạn được chọn (câu chen đang chờ có thể đọc trước).
    const dau = suKien.slice(truoc).find((e) => e.type === 'live.doi_noi' && e.luot.length && /^(Quần jean số 15|Áo số 12 giá|Chào cả nhà|Đố cả nhà)/.test(e.luot[0].loi));
    assert.ok(dau?.luot[0].loi.startsWith(chon === 3 ? 'Quần jean số 15' : 'Áo số 12 giá'), 'đọc luôn đoạn được chọn');
  });

  await t.test('câu chen bán hàng (F-46): vừa chốt, vừa hết, còn ít, nhắc cách chốt — câu mẫu điền dữ liệu, xếp trước câu thường', async () => {
    assert.equal(doi.chenBanHang('phien_khac', 'vua_chot', { ten: 'Lan', mon: 'áo số 12' }), false, 'phiên khác thì bỏ');
    assert.equal(doi.chenBanHang(p.id, 'khoa_khong_co', {}), false, 'khóa câu mẫu không có thì bỏ');
    const soChen = phongThu.chen.length;
    // Câu thường (trả lời người xem) vào hàng trước; câu bán hàng vẫn đứng trước nó.
    doi.traLoi({ phienId: p.id, cauHoi: 'Áo có size L không', cau: 'Áo số 12 có size L nha.', ten: 'Phan Thu Trang' });
    assert.equal(doi.chenBanHang(p.id, 'vua_chot', { ten: 'Lan', mon: 'áo số 12 màu Đen size M' }), true);
    assert.equal(doi.chenBanHang(p.id, 'vua_chot', { ten: 'Lan, Hùng', mon: 'áo số 12 màu Đen size M' }), true);
    const loai = doi.s.hang.map((x) => x.loai);
    assert.equal(loai.filter((x) => x === 'vừa chốt').length, 1, 'câu vừa chốt cùng loại thay câu cũ (gom tên)');
    assert.ok(loai.indexOf('vừa chốt') < loai.indexOf('trả lời người xem'), loai.join(', '));
    doi.chenBanHang(p.id, 'vua_het', { mon: 'áo số 12 màu Trắng size L' });
    doi.chenBanHang(p.id, 'con_it', { mon: 'áo số 12 màu Đen size M', so: 2 });
    doi.chenBanHang(p.id, 'nhac_cach_chot', { so_mau: 12, vi_du: 'chốt 12 đen M' });
    const moi = () => phongThu.chen.slice(soChen);
    const tu = Date.now();
    while (moi().length < 6 && Date.now() - tu < 3000) { doi.nhipDan(); await cho(5); }
    const chu = moi().join(' / ');
    assert.match(chu, /Lan, Hùng (vừa chốt|đã chốt) áo số 12 màu Đen size M/, chu);
    assert.match(chu, /áo số 12 màu Trắng size L vừa hết/);
    assert.match(chu, /áo số 12 màu Đen size M (chỉ )?còn (đúng )?2 chiếc/);
    assert.match(chu, /chốt,? (số áo|12)/i);
    assert.doesNotMatch(chu, /\{\w+\}/, 'mọi chỗ trống đã điền');
  });

  await t.test('người dẫn chào kết → đội chào tạm biệt rồi thôi dẫn', async () => {
    doi.nguoiDanNoiXong('Thôi mình chào tạm biệt cả nhà nha');
    await chay(250);
    assert.ok(phongThu.chen.some((c) => /Cảm ơn cả nhà đã xem live hôm nay/.test(c)));
    assert.equal(doi.trangThai(p.id).trang_thai, 'tam_dung');
    assert.equal(cuoi('live.doi_dan').ly_do, 'Người dẫn chào kết');
  });

  await t.test('đổi chế độ khác hoặc hết live → đội thôi', () => {
    live.datCheDo(p.id, { che_do_ai: 'goi_y' });
    doi.dongBo();
    assert.equal(doi.trangThai(p.id).trang_thai, 'tat');
    assert.equal(cuoi('live.doi_dan').trang_thai, 'tat');
  });
});

test('Đội AI dẫn có nhạc (bản 2.9, F-47): nhạc hiệu mở màn và đầu vòng mới, chuyển cảnh trước mỗi đoạn, nhạc đố vui, tiếng chúc mừng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { DoiAiDan } = require('../server/doi-ai/dan-doi');

  const a12 = taoSanPhamMau();
  const q15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '350k' });
  const kb = kichBan.taoKichBan({
    ten: 'Đội AI có nhạc',
    doan: [
      { san_pham_id: null, loi_nhac: '[Bản tin hàng mới]\nMai: Chào cả nhà!\nTùng: Tùng đây!' },
      { san_pham_id: a12.san_pham.id, loi_nhac: '[Hỏi nhanh – đáp gọn]\nTùng: Áo số 12 giá bao nhiêu?\nMai: 289.000đ nè!' },
      { san_pham_id: null, loi_nhac: '[Đố vui]\nTùng: Đố cả nhà áo số 12 giá bao nhiêu?\n[Chờ bình luận 15 giây]\nHạnh: 289 nghìn nha!\nĐáp án: 289 nghìn; 289k' },
      { san_pham_id: q15.san_pham.id, loi_nhac: '[So kè hai mẫu]\nHạnh: Quần jean số 15 giá 350.000đ.\nMai: Chọn theo dáng người nha!' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_nhac');
  const suKien = [];
  const loa = { readyState: 1, send() {} };
  const doi = new DoiAiDan({
    phat: (type, d) => suKien.push({ type, ...d }),
    mieng: { loa: new Set([loa]) },
    phongAi: { st: { phienId: p.id, nguoiDanNoi: false }, datLai() {}, bao() {} },
    phongThu: taoPhongThuGia(),
    nhac: (loai) => ({ pcm: pcm(0.05), loi: loai === 'hieu' ? 'Nhà Mơ ơi, đồ xinh mỗi ngày' : '' }),
    nhip: { truocMs: 300, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, choTraLoiMs: 400 },
  });
  doi.dongBo();
  const tu = Date.now();
  let daTraLoi = false;
  while (Date.now() - tu < 4000) {
    doi.nhipDan();
    if (doi.s.doVui && !daTraLoi) {
      daTraLoi = true;
      live.themBinhLuan(p.id, { fb_id: 'n1', ten: 'Nguyễn Thị Lan', noi_dung: '289k' });
      // Đang chờ đáp án thì nhạc đố vui đang phát, lời hát nhạc hiệu không dính vào đây.
      assert.equal(doi.s.dang?.c.nhac, 'do_vui');
    }
    const daQuaVong2 = suKien.some((e) => e.type === 'live.doi_noi' && e.luot?.[0]?.loi.startsWith('Áo số 12 giá') && doi.s.vong === 2);
    if (daQuaVong2 && suKien.filter((e) => e.type === 'live.doi_noi' && e.luot?.[0]?.loi.startsWith('Áo số 12 giá')).length >= 2) break;
    await cho(5);
  }
  const chuoi = suKien.filter((e) => e.type === 'live.doi_noi' && (e.luot.length || e.nhac))
    .map((e) => (e.nhac ? `♪${e.nhac}` : `${e.luot[0].ai}: ${e.luot[0].loi}`.slice(0, 40)));
  const vt = (x, tu0 = 0) => chuoi.findIndex((c, i) => i >= tu0 && c.startsWith(x));
  assert.equal(chuoi[0], '♪hieu', `mở màn bằng nhạc hiệu: ${chuoi.join(' → ')}`);
  assert.equal(chuoi[1], 'Mai: Chào cả nhà!', 'nhạc hiệu xong là đoạn mở đầu, không thêm nhạc chuyển cảnh');
  const ao12 = vt('Tùng: Áo số 12 giá');
  assert.equal(chuoi[ao12 - 1], '♪chuyen', 'nhạc chuyển cảnh trước đoạn áo số 12');
  const hoi = vt('Tùng: Đố cả nhà');
  assert.equal(chuoi[hoi - 1], '♪chuyen', 'nhạc chuyển cảnh trước đố vui');
  assert.equal(chuoi[hoi + 1], '♪do_vui', 'nhạc đố vui lúc chờ');
  assert.equal(chuoi[hoi + 2], 'Hạnh: 289 nghìn nha!');
  assert.equal(chuoi[hoi + 3], '♪dung', 'tiếng chúc mừng ngay sau đáp án');
  assert.match(chuoi[hoi + 4], /Chúc mừng bạn Lan|Giỏi quá, bạn Lan/);
  assert.equal(chuoi[hoi + 5], '♪chuyen');
  assert.match(chuoi[hoi + 6], /^Hạnh: Quần jean số 15/);
  const vong2 = vt('♪hieu', hoi);
  assert.ok(vong2 > hoi, 'đầu vòng mới có nhạc hiệu');
  assert.match(chuoi[vong2 + 1], /Cả nhà mới vào|trợ lý AI/, 'rồi câu nhắc "đội trợ lý AI"');
  assert.match(chuoi[vong2 + 2], /^Tùng: Áo số 12 giá bao/, 'rồi đọc luôn, không thêm nhạc chuyển cảnh');
  doi.dung();
});

test('Đội AI dẫn: người dẫn nói "Mai ơi" giữa đoạn → ngừng ngay, câu đệm, trả lời, đọc tiếp đoạn dở; gõ câu hỏi → không ngừng; AI không trả lời được → hẹn kiểm lại', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { DoiAiDan } = require('../server/doi-ai/dan-doi');

  const a12 = taoSanPhamMau();
  const q15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '350k' });
  const kb = kichBan.taoKichBan({
    ten: 'Đội AI hỏi đáp',
    doan: [
      { san_pham_id: a12.san_pham.id, loi_nhac: '[Hỏi nhanh – đáp gọn]\nTùng: Áo số 12 giá bao nhiêu?\nMai: 289.000đ nè!' },
      { san_pham_id: q15.san_pham.id, loi_nhac: '[Giới thiệu sản phẩm]\nHạnh: Quần jean số 15 giá 350.000đ.\nMai: Chọn theo dáng người nha!' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_hoi');
  const suKien = [];
  const phongThu = taoPhongThuGia({ giayDoan: 0.6 });
  const doi = new DoiAiDan({
    phat: (type, d) => suKien.push({ type, ...d }),
    mieng: { loa: new Set([{ readyState: 1, send() {} }]) },
    phongAi: { st: { phienId: p.id, nguoiDanNoi: false }, datLai() {}, bao() {} },
    phongThu,
    nhac: () => null,
    nhip: { truocMs: 150, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, choTraLoiMs: 3000 },
  });
  t.after(() => doi.dung());
  doi.dongBo();
  const chay = async (ms) => { const het = Date.now() + ms; while (Date.now() < het) { doi.nhipDan(); await cho(5); } };
  const choDoan = async () => {
    const tu = Date.now();
    while (!(doi.s.dang?.c.loai === 'đoạn' && doi.s.dang.viTri > 0) && Date.now() - tu < 3000) { doi.nhipDan(); await cho(5); }
    return doi.s.dang;
  };
  const docSau = (truoc) => suKien.slice(truoc).filter((e) => e.type === 'live.doi_noi' && e.luot.length).map((e) => e.luot[0].loi);

  // Nói bằng giọng giữa đoạn.
  const dang = await choDoan();
  assert.ok(dang, 'đang đọc một đoạn');
  let truoc = suKien.length;
  doi.coNguoiDanHoi(p.id, { tuGiong: true });
  assert.equal(doi.s.dang, null, 'ngừng ngay');
  assert.equal(doi.s.hoan, dang, 'giữ đoạn dở để đọc tiếp');
  assert.equal(suKien.filter((e) => e.type === 'live.mai_ngat').at(-1).ly_do, 'Người dẫn gọi Mai');
  await chay(150);
  doi.traLoi({ phienId: p.id, cauHoi: 'Quần 15 giá bao nhiêu', cau: 'Quần jean số 15 giá 350.000đ ạ.', tuNguoiDan: true });
  await chay(400);
  let doc = docSau(truoc);
  const iDem = doc.findIndex((x) => /Câu này hay nè|Hỏi trúng chỗ|Để Mai xem/.test(x));
  assert.ok(iDem >= 0, `có câu đệm: ${doc.join(' → ')}`);
  assert.equal(doc[iDem + 1], 'Quần jean số 15 giá 350.000đ ạ.', 'rồi câu trả lời');
  assert.equal(doc[iDem + 2], dang.c.luot[0].loi, 'rồi đọc tiếp đoạn dở');

  // Gõ câu hỏi: không ngừng đoạn, không câu đệm; câu trả lời đọc ở chỗ nghỉ kế tiếp.
  const dang2 = await choDoan();
  truoc = suKien.length;
  doi.coNguoiDanHoi(p.id, { tuGiong: false });
  assert.equal(doi.s.dang, dang2, 'không ngừng');
  assert.ok(!doi.s.hang.some((x) => x.cho || x.loai === 'câu đệm'));
  doi.traLoi({ phienId: p.id, cauHoi: 'Áo 12 giá bao nhiêu', cau: 'Áo số 12 giá 289.000đ ạ.', tuNguoiDan: true });
  await chay(900);
  doc = docSau(truoc);
  assert.ok(doc.includes('Áo số 12 giá 289.000đ ạ.'));
  assert.ok(!suKien.slice(truoc).some((e) => e.type === 'live.mai_ngat'), 'không ngắt đoạn đang đọc');

  // Co-host không soạn được (AI lỗi, hết tiền): Mai hẹn kiểm lại, không im.
  await choDoan();
  doi.coNguoiDanHoi(p.id, { tuGiong: true });
  await chay(100);
  doi.khongTraLoiDuoc(p.id);
  assert.ok(!doi.s.hang.some((x) => x.cho));
  await chay(300);
  assert.ok(phongThu.chen.some((c) => /^Mai: (Câu này Mai xin kiểm lại|Để Mai xem kỹ lại)/.test(c)), phongThu.chen.join(' / '));
});

test('sản phẩm chuyển Ngừng bán giữa buổi → đội bỏ qua đoạn đó, không giới thiệu món không bán nữa', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const sp = require('../server/nghiep-vu/san-pham');
  const { DoiAiDan } = require('../server/doi-ai/dan-doi');
  const a12 = taoSanPhamMau();
  const q15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '350k' });
  const a18 = taoSanPhamMau({ so: 18, ten: 'Áo kiểu tay phồng' });
  const kb = kichBan.taoKichBan({
    ten: 'Đội AI ngừng bán',
    doan: [
      { san_pham_id: a12.san_pham.id, loi_nhac: '[Giới thiệu sản phẩm]\nTùng: Áo số 12 đây cả nhà.\nMai: Chốt 12 kèm màu, size nha!' },
      { san_pham_id: q15.san_pham.id, loi_nhac: '[Giới thiệu sản phẩm]\nHạnh: Quần jean số 15 đây.\nMai: Chốt 15 kèm màu, size nha!' },
      { san_pham_id: a18.san_pham.id, loi_nhac: '[Giới thiệu sản phẩm]\nTùng: Áo số 18 đây.\nMai: Chốt 18 kèm màu, size nha!' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_ngung');
  sp.doiTrangThai(q15.san_pham.id, 'ngung_ban');
  const suKien = [];
  const doi = new DoiAiDan({
    phat: (type, d) => suKien.push({ type, ...d }),
    mieng: { loa: new Set([{ readyState: 1, send() {} }]) },
    phongAi: { st: { phienId: p.id, nguoiDanNoi: false }, datLai() {}, bao() {} },
    phongThu: taoPhongThuGia(),
    nhac: () => null,
    nhip: { truocMs: 150, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, chaoMoiMs: 60 * 60 * 1000 },
  });
  t.after(() => doi.dung());
  doi.dongBo();
  const docRa = () => suKien.filter((e) => e.type === 'live.doi_noi' && e.luot.length).map((e) => e.luot[0].loi);
  const het = Date.now() + 2000;
  while (Date.now() < het && docRa().filter((x) => x.startsWith('Áo số 12')).length < 2) { doi.nhipDan(); await cho(5); }
  const ds = docRa();
  assert.ok(ds.some((x) => x.startsWith('Áo số 18')), ds.join(' → '));
  assert.ok(!ds.some((x) => x.startsWith('Quần jean số 15')), 'không đọc đoạn của món đã Ngừng bán');
});

test('tiếng vọng so theo cặp chữ; đọc tiếp từ chỗ ngắt câu gần nhất (buổi tập 24/9/2026)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { DoiAiDan, diemNgatTruoc } = require('../server/doi-ai/dan-doi');
  const doi = new DoiAiDan({ phat() {}, mieng: { loa: new Set() }, nhac: () => null });
  const loi = 'Mai ơi, sơ mi linen số 12 có gì khiến cả nhà muốn dừng lướt? Vải linen mát, form suông che bụng. Giá chỉ 289.000đ một chiếc.';
  doi.s = { dang: { c: { chu: loi } }, lucHet: 0, chuVua: loi };
  assert.equal(doi.phanLoaiLoiNguoiDan('sơ mi linen số 12 có gì khiến cả nhà'), 'vong', 'tiếng loa lọt vào micro');
  assert.equal(doi.phanLoaiLoiNguoiDan('Mai ơi quần jean số 15 giá một chiếc bao nhiêu em'), 'nguoi',
    'chữ lẻ trùng ("Mai ơi", "số", "một chiếc") nhưng là người dẫn hỏi');
  assert.equal(doi.phanLoaiLoiNguoiDan('Mai ơi'), 'chua_ro');

  // PCM: 1 giây có tiếng, 0,3 giây lặng, 1 giây có tiếng. Đang ở giây 2,0 → lùi về đầu câu thứ hai (1,3 giây − 40 ms).
  const pcm = Buffer.alloc(Math.round(2.3 * 48000));
  for (let i = 0; i < pcm.length; i += 2) {
    const giay = i / 48000;
    if (giay < 1 || giay >= 1.3) pcm.writeInt16LE(Math.round(5000 * Math.sin(i / 3)), i);
  }
  assert.equal(diemNgatTruoc(pcm, 2 * 48000), Math.round(1.26 * 48000));
  assert.equal(diemNgatTruoc(pcm, 0.9 * 48000), 0.9 * 48000, 'không có chỗ ngắt phía trước thì giữ nguyên');
  assert.equal(diemNgatTruoc(pcm, 2 * 48000, 0.5), 2 * 48000, 'chỗ ngắt xa quá thì giữ nguyên');
});

test('Google treo lúc làm tiếng đoạn mở đầu: đội đọc phát dần sau choDoanMs thay vì im; làm sẵn cả kịch bản ở nền (buổi live 24/9/2026)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { DoiAiDan } = require('../server/doi-ai/dan-doi');

  const tao = (so, ten) => taoSanPhamMau({ so, ten });
  const [a12, a15, a18] = [tao(12, 'Sơ mi linen'), tao(15, 'Áo thun cổ tròn'), tao(18, 'Áo kiểu tay phồng')];
  const kb = kichBan.taoKichBan({
    ten: 'Đội AI Google treo',
    doan: [
      { san_pham_id: null, loi_nhac: '[Bản tin hàng mới]\nMai: Chào cả nhà, Mai là trợ lý AI!\nTùng: Tùng đây, cũng là trợ lý AI!' },
      { san_pham_id: a12.san_pham.id, loi_nhac: '[Hỏi nhanh – đáp gọn]\nTùng: Áo số 12 giá bao nhiêu?\nMai: 289.000đ nè!' },
      { san_pham_id: a15.san_pham.id, loi_nhac: '[Giới thiệu sản phẩm]\nHạnh: Áo số 15 giá 289.000đ.' },
      { san_pham_id: a18.san_pham.id, loi_nhac: '[So kè hai mẫu]\nMai: Áo số 18 giá 289.000đ.' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_treo');
  const goc = taoPhongThuGia();
  const goiDoan = [];
  const phongThu = {
    ...goc,
    soatSo: (luot) => ({ giu: luot, bo: [] }),
    nguonSo: () => '',
    lamTiengDoan(o) {
      goiDoan.push(o.doan.loi_nhac.split('\n')[0]);
      if (o.doan.loi_nhac.startsWith('[Bản tin')) return new Promise(() => {}); // Google treo mãi
      return goc.lamTiengDoan(o);
    },
  };
  const suKien = [];
  const doi = new DoiAiDan({
    phat: (type, d) => suKien.push({ type, ...d }),
    mieng: { loa: new Set([{ readyState: 1, send() {} }]) },
    phongAi: { st: { phienId: p.id, nguoiDanNoi: false }, datLai() {}, bao() {} },
    phongThu,
    nhac: () => null,
    nhip: { truocMs: 150, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, choDoanMs: 60, lamSanToiDaMs: 80 },
  });
  t.after(() => doi.dung());
  doi.dongBo();
  const het = Date.now() + 700;
  while (Date.now() < het) { doi.nhipDan(); await cho(5); }
  const doc = suKien.filter((e) => e.type === 'live.doi_noi' && e.luot.length).map((e) => e.luot[0].loi);
  assert.equal(doc[0], 'Chào cả nhà, Mai là trợ lý AI!', 'đoạn mở đầu đọc kiểu phát dần, vẫn tự giới thiệu là AI');
  assert.equal(doc[1], 'Áo số 12 giá bao nhiêu?', 'rồi sang đoạn sau (tiếng làm sẵn)');
  assert.ok(goc.chen.some((c) => c.startsWith('Mai: Chào cả nhà, Mai là trợ lý AI! | Tùng:')), 'phát dần đủ lượt');
  assert.ok(goiDoan.includes('[So kè hai mẫu]'), 'làm sẵn ở nền tới cả đoạn thứ tư dù đoạn đầu treo');
});

test('Radio {ten_shop} (F-49, F-50): nhạc hiệu Radio, báo giờ, lời chúc, bài hát, "Mai ơi" lúc đang hát', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  require('../server/nghiep-vu/cai-dat').datBanHang({ ten_shop: 'Nhà Mơ' });
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { DoiAiDan, gioNoi, lamSachLoiChuc } = require('../server/doi-ai/dan-doi');

  // Giờ Việt Nam đọc lên sóng; lời chúc sạch để đọc.
  assert.equal(gioNoi(Date.UTC(2026, 8, 24, 13, 15)), '20 giờ 15 phút');
  assert.equal(gioNoi(Date.UTC(2026, 8, 24, 1, 0)), '8 giờ đúng');
  assert.equal(lamSachLoiChuc('Chúc mẹ khỏe nhaaaa 😍 <laugh> |ừ| {chinh}'), 'Chúc mẹ khỏe nhaa ừ chinh');
  for (const x of ['gọi 0912 345 678 nha', 'vào zalo nhóm mình', 'xem www.abc.vn', 'mã 12345 nè', '😍😍', 'ok']) {
    assert.equal(lamSachLoiChuc(x), null, x);
  }
  assert.ok(lamSachLoiChuc('Chúc cả nhà ca làm vui vẻ. '.repeat(12)).length <= 200);

  const a12 = taoSanPhamMau();
  const q15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '350k' });
  const kb = kichBan.taoKichBan({
    ten: 'Radio thử',
    doan: [
      { san_pham_id: null, loi_nhac: '[Điểm tin hàng mới]\nMai: Radio Nhà Mơ xin chào, Mai là trợ lý AI!\nTùng: Tùng, trợ lý AI đây!' },
      { san_pham_id: a12.san_pham.id, loi_nhac: '[Bản tin sản phẩm]\nTùng: Áo số 12 giá 289.000đ.\nMai: Mẹo nhỏ: giặt tay nước lạnh cho bền màu nha!' },
      { san_pham_id: null, loi_nhac: '[Lời nhắn gửi]\nHạnh: Cảm ơn quý vị đã gửi lời nhắn, mình cùng nghe một bài hát.\n[Bài hát]\nTùng: Quay lại với hàng mới nè cả nhà!' },
      { san_pham_id: q15.san_pham.id, loi_nhac: '[Bản tin sản phẩm]\nHạnh: Quần jean số 15 giá 350.000đ.\nMai: Chọn theo dáng người nha!' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_radio');
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const loa = { readyState: 1, send: () => {} };
  const mieng = { loa: new Set([loa]) };
  const phongThu = taoPhongThuGia();
  const nhacGoi = [];
  const nhac = (loai) => { nhacGoi.push(loai); return ['hieu', 'hieu_radio', 'chuyen'].includes(loai) ? { pcm: pcm(0.05), loi: '' } : null; };
  const khoBai = {
    ds: () => [{ id: 'b1', ten: 'Chiều phố mùa thu' }, { id: 'b2', ten: 'Nắng sớm' }],
    doc: () => ({ pcm: pcm(0.6), loi: 'Chiều phố mùa thu, gió nhẹ bay qua' }),
  };
  const doi = new DoiAiDan({
    phat, mieng, phongThu, nhac, khoBai,
    nhip: { truocMs: 300, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, choTraLoiMs: 400, chaoMoiMs: 60 * 60 * 1000 },
  });
  t.after(() => doi.dung());
  const chay = async (ms, dung = () => false) => { const het = Date.now() + ms; while (Date.now() < het && !dung()) { doi.nhipDan(); await cho(5); } };
  const docRa = () => suKien.filter((e) => e.type === 'live.doi_noi' && (e.luot.length || e.nhac))
    .map((e) => (e.nhac ? `♪${e.nhac}${e.bai ? `:${e.bai}` : ''}` : e.luot.map((l) => `${l.ai}: ${l.loi}`).join(' | ')));

  // Lời chúc: chỉ đọc bình luận Director gắn "loi_chuc", qua lọc quy tắc; bình luận chưa gắn nhãn không đọc.
  const them = (fb, ten, nd, nhan = 'loi_chuc') => {
    const b = live.themBinhLuan(p.id, { fb_id: fb, ten, noi_dung: nd });
    if (nhan) live.themNhan(p.id, b.id, nhan);
    return b;
  };
  them('c1', 'Nguyễn Thị Lan', 'Chúc mẹ ở Thanh Hóa mạnh khỏe, con nhớ mẹ nhiều ❤️');
  them('c2', 'Trần Văn Hùng', 'Gửi chị em văn phòng, mặc đẹp đi làm nha!');
  them('c3', 'Shop Giá Rẻ', 'Chúc mọi người vui, ib 0912345678 mua hàng');
  them('c4', 'Lê Minh', 'Chúc cả nhà một ngày vui', null);

  await t.test('mở màn: nhạc hiệu Radio → báo giờ (có câu trợ lý AI) → Điểm tin', async () => {
    doi.dongBo();
    assert.equal(doi.s.radio, true);
    await chay(400, () => docRa().some((x) => x.startsWith('Mai: Radio Nhà Mơ')));
    const ds = docRa();
    assert.equal(ds[0], '♪hieu_radio');
    assert.equal(nhacGoi[0], 'hieu_radio');
    assert.match(ds[1], /giờ.*Radio Nhà Mơ/);
    assert.match(ds[1], /trợ lý AI của Nhà Mơ/);
    assert.match(ds[2], /^Mai: Radio Nhà Mơ xin chào/);
  });

  await t.test('Lời nhắn gửi: mời → đọc lời chúc (đúng người, đã lọc) + giới thiệu bài → bài hát → báo giờ → quay lại', async () => {
    await chay(3000, () => docRa().some((x) => x.startsWith('Tùng: Quay lại')));
    const ds = docRa();
    const i = ds.findIndex((x) => x.startsWith('Hạnh: Cảm ơn quý vị'));
    assert.ok(i > 0, ds.join(' → '));
    const loiNhan = ds[i + 1];
    assert.match(loiNhan, /Bạn Lan nhắn: Chúc mẹ ở Thanh Hóa mạnh khỏe, con nhớ mẹ nhiều/);
    assert.match(loiNhan, /Hùng.*Gửi chị em văn phòng, mặc đẹp đi làm nha!/);
    assert.doesNotMatch(loiNhan, /0912|Shop|Minh/, 'không đọc lời có số điện thoại, không đọc bình luận chưa gắn nhãn');
    assert.match(loiNhan, /Mai: .*"(Chiều phố mùa thu|Nắng sớm)".*bạn Lan, bạn Hùng/);
    assert.match(ds[i + 2], /^♪bai_hat:(Chiều phố mùa thu|Nắng sớm)$/);
    assert.match(ds[i + 3], /giờ/, 'báo giờ sau bài hát');
    assert.equal(ds[i + 4], 'Tùng: Quay lại với hàng mới nè cả nhà!');
  });

  await t.test('vòng mới: nhạc hiệu Radio và báo giờ, không đọc câu nhắc đầu vòng của talk show', async () => {
    const truoc = docRa().length;
    await chay(3000, () => doi.s.vong >= 2 && docRa().slice(truoc).some((x) => x.startsWith('Tùng: Áo số 12')));
    const moi = docRa().slice(truoc);
    const j = moi.indexOf('♪hieu_radio');
    assert.ok(j >= 0, moi.join(' → '));
    assert.match(moi[j + 1], /giờ.*Radio Nhà Mơ/);
    assert.ok(!phongThu.chen.some((c) => /Cả nhà mới vào ơi|tụi em là trợ lý AI/.test(c)), 'không có câu nhắc đầu vòng kiểu talk show');
  });

  await t.test('lời chúc đã đọc không đọc lại; không có lời chúc mới thì mời nghe bài kế tiếp (xoay vòng)', async () => {
    await chay(3000, () => !!doi.s.dang?.c.bai);
    const ds = docRa();
    const moi = ds.at(-2);
    assert.doesNotMatch(moi, /Lan|Hùng/);
    assert.match(moi, /bài hát "(Chiều phố mùa thu|Nắng sớm)"/);
    const bai = ds.filter((x) => x.startsWith('♪bai_hat')).map((x) => x.split(':')[1]);
    assert.equal(bai.length, 2);
    assert.notEqual(bai[0], bai[1], 'xoay vòng: bài sau khác bài trước');
  });

  await t.test('"Mai ơi" lúc đang phát bài hát → bài ngừng hẳn, câu đệm, trả lời, rồi báo giờ và phần quay lại', async () => {
    assert.ok(doi.s.dang?.c.bai, 'đang phát bài hát');
    const truoc = docRa().length;
    doi.coNguoiDanHoi(p.id);
    assert.equal(doi.s.dang, null, 'bài hát ngừng ngay');
    doi.traLoi({ phienId: p.id, cauHoi: 'Áo 12 giá bao nhiêu', cau: 'Áo số 12 giá 289 nghìn một chiếc.', tuNguoiDan: true });
    await chay(1500, () => docRa().slice(truoc).some((x) => x.startsWith('Tùng: Quay lại')));
    const moi = docRa().slice(truoc);
    const k = moi.indexOf('Mai: Áo số 12 giá 289 nghìn một chiếc.');
    assert.ok(k >= 1, moi.join(' → '));
    assert.match(moi[k - 1], /Câu này hay nè|Hỏi trúng chỗ|Để Mai xem/);
    assert.match(moi[k + 1], /giờ/, 'báo giờ sau khi trả lời');
    assert.equal(moi[k + 2], 'Tùng: Quay lại với hàng mới nè cả nhà!');
    assert.ok(!moi.some((x) => x.startsWith('♪bai_hat')), 'không phát lại bài hát');
  });

  await t.test('chưa có bài hát nào: vẫn đọc lời chúc (không nhắc bài hát) rồi đi tiếp', async () => {
    doi.khoBai = { ds: () => [], doc: () => null };
    them('c5', 'Vũ Thị Hoa', 'Chúc bố mẹ ở quê luôn vui khỏe');
    const truoc = docRa().length;
    live.doiDoan(p.id, 2);
    doi.dongBo();
    await chay(1500, () => docRa().slice(truoc).some((x) => x.startsWith('Tùng: Quay lại')));
    const moi = docRa().slice(truoc);
    const x = moi.find((y) => /Hoa/.test(y));
    assert.match(x, /bạn Hoa .*Chúc bố mẹ ở quê luôn vui khỏe.*Mai: Cảm ơn bạn Hoa đã gửi lời nhắn/i);
    assert.doesNotMatch(x, /bài hát/);
    assert.ok(!moi.some((y) => y.startsWith('♪bai_hat')));
  });
});

test('Google hết lượt làm sẵn tiếng (429, buổi thử 24/9/2026): đội đọc bằng máy đọc nhanh, không bỏ đoạn; Lời nhắn gửi vẫn có bài hát', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { DoiAiDan } = require('../server/doi-ai/dan-doi');
  const kb = kichBan.taoKichBan({
    ten: 'Radio hết lượt',
    doan: [
      { san_pham_id: null, loi_nhac: '[Điểm tin hàng mới]\nMai: Radio Nhà Mơ xin chào!\nTùng: Tùng, trợ lý AI đây!' },
      { san_pham_id: null, loi_nhac: '[Lời nhắn gửi]\nHạnh: Mời cả nhà nghe một bài hát.\n[Bài hát]\nTùng: Quay lại với hàng mới nè!' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_het_luot');
  const suKien = [];
  const phongThu = taoPhongThuGia();
  phongThu.lamTiengDoan = async () => { throw new Error('Google đang giới hạn lượt gọi.'); };
  Object.assign(phongThu, { nguonSo: () => '', soatSo: (luot) => ({ giu: luot, bo: [] }) });
  const docNgay = phongThu.lamTiengLuot;
  phongThu.lamTiengLuot = async (o) => { await cho(40); return docNgay(o); }; // máy đọc thật: có tiếng sau 1–2 giây
  const doi = new DoiAiDan({
    phat: (type, d) => suKien.push({ type, ...d }), mieng: { loa: new Set([{ readyState: 1, send: () => {} }]) }, phongThu,
    phongAi: { st: { phienId: p.id }, datLai() {}, bao: (x) => suKien.push({ type: 'bao', x }) },
    nhac: () => null, khoBai: { ds: () => [{ id: 'b1', ten: 'Nắng sớm' }], doc: () => ({ pcm: pcm(0.2), loi: '' }) },
    nhip: { truocMs: 300, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, choTraLoiMs: 400, chaoMoiMs: 60 * 60 * 1000 },
  });
  t.after(() => doi.dung());
  doi.dongBo();
  const docRa = () => suKien.filter((e) => e.type === 'live.doi_noi' && (e.luot.length || e.nhac))
    .map((e) => (e.nhac ? `♪${e.nhac}` : e.luot.map((l) => `${l.ai}: ${l.loi}`).join(' | ')));
  const het = Date.now() + 2000;
  while (Date.now() < het && !docRa().includes('Tùng: Quay lại với hàng mới nè!')) { doi.nhipDan(); await cho(5); }
  const ds = docRa();
  assert.ok(ds.includes('Mai: Radio Nhà Mơ xin chào! | Tùng: Tùng, trợ lý AI đây!'), ds.join(' → '));
  const i = ds.indexOf('Hạnh: Mời cả nhà nghe một bài hát.');
  assert.ok(i > 0, ds.join(' → '));
  assert.match(ds[i + 1], /bài hát "Nắng sớm"/);
  assert.equal(ds[i + 2], '♪bai_hat');
  assert.match(ds[i + 3], /giờ/);
  assert.equal(ds[i + 4], 'Tùng: Quay lại với hàng mới nè!');
  assert.ok(suKien.some((e) => e.type === 'bao' && /đọc bằng máy đọc nhanh/.test(e.x)), 'báo nhỏ cho người dẫn');
  assert.ok(!suKien.some((e) => e.type === 'bao' && /bỏ qua đoạn/.test(e.x)), 'không bỏ đoạn nào');
});

test('Google hết lượt đọc giọng trong ngày (25/9/2026: 100 lượt/ngày mỗi model): báo đúng, không gọi lại, đội tạm dừng thay vì lướt đoạn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const tts = require('../server/agent/nha-cung-cap/tts');
  const phongThuThat = require('../server/doi-ai/phong-thu');

  // Hai kiểu Google báo hết lượt (gặp thật): 429 của flash-tts, 500 "Rate limit exceeded" của flash-lite-tts.
  const a = tts.loiGoogle(429, 'You exceeded your current quota. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_requests_per_model_per_day, limit: 100, model: gemini-3.8-flash-tts\nPlease retry in 8h37m40.3s.');
  assert.equal(a.ma, 'HET_LUOT_NGAY');
  assert.match(a.message, /hết lượt đọc giọng hôm nay \(tối đa 100 lượt\/ngày cho gemini-3\.8-flash-tts\); mở lại sau khoảng 8 giờ 37 phút/);
  assert.ok(Math.abs(a.choMs - (8 * 60 + 37) * 60000 - 40300) < 1000);
  const b = tts.loiGoogle(500, 'Rate limit exceeded for model gemini-3.8-flash-lite-tts (limit: 100 requests per day on Tier 1). Please retry in 21h24m3.5s.');
  assert.equal(b.ma, 'HET_LUOT_NGAY');
  assert.match(b.message, /gemini-3\.8-flash-lite-tts\); mở lại sau khoảng 21 giờ 24 phút/);
  const c = tts.loiGoogle(429, 'Resource exhausted. Please retry in 20s.');
  assert.notEqual(c.ma, 'HET_LUOT_NGAY', 'quá tải trong một phút vẫn là lỗi tạm thời');
  assert.doesNotMatch(c.message, /miễn phí/, 'không đoán sai là gói miễn phí');

  // Phòng thu: gặp hết lượt thì không thử lại, lần sau báo ngay không gọi Google.
  let soLanGoi = 0;
  const mayGoi = [];
  tts.datFetch(async (url, o) => {
    soLanGoi += 1;
    mayGoi.push(JSON.parse(o.body).model);
    return new Response(JSON.stringify({ error: { code: 429, message: 'Quota exceeded for metric: generate_requests_per_model_per_day, limit: 100, model: gemini-3.8-flash-lite-tts. Please retry in 2h0m0s.' } }), { status: 429 });
  });
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu-9876';
  t.after(() => { tts.datFetch(null); phongThuThat.quenHetLuot(); if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu; });
  const luot = [{ ai: 'Mai', cachNoi: '', loi: 'Chào cả nhà.' }];
  await assert.rejects(phongThuThat.lamTiengLuot({ luot, model: phongThuThat.MODEL_CHEN, viec: 'thử' }), (e) => e.ma === 'HET_LUOT_NGAY');
  // Bản 2.10 (#55): mỗi máy đọc gọi đúng một lần (không thử lại), theo thứ tự máy được giao → 3.8 còn lại → dự phòng 3.1.
  assert.deepEqual(mayGoi, ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview']);
  await assert.rejects(phongThuThat.lamTiengLuot({ luot: [{ ai: 'Mai', cachNoi: '', loi: 'Câu khác.' }], model: phongThuThat.MODEL_CHEN, viec: 'thử' }),
    (e) => e.ma === 'HET_LUOT_NGAY' && /2 giờ/.test(e.message));
  assert.equal(soLanGoi, 3, 'đã biết cả ba máy hết lượt: không gọi Google nữa');

  // Trên sóng: đoạn chưa làm sẵn, đọc phát dần cũng hết lượt → đội tạm dừng, báo đỏ; không lướt qua các đoạn sau.
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const { DoiAiDan } = require('../server/doi-ai/dan-doi');
  const kb = kichBan.taoKichBan({
    ten: 'Hết lượt',
    doan: [
      { san_pham_id: null, loi_nhac: '[Điểm tin hàng mới]\nMai: Xin chào!\nTùng: Chào cả nhà!' },
      { san_pham_id: null, loi_nhac: '[Alo shop]\nHạnh: Nhiều bạn hay hỏi shop có đổi size không.\nMai: Shop báo trong tin nhắn nha!' },
      { san_pham_id: null, loi_nhac: '[Điểm lại]\nTùng: Cảm ơn cả nhà.\nMai: Chốt kèm số, màu, size nha!' },
    ],
  });
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'doi' });
  live.ganLive(p.id, 'livegia_het_luot_ngay');
  const suKien = [];
  const phongThu = taoPhongThuGia();
  const hl = () => { const e = new Error('Google đã hết lượt đọc giọng hôm nay (tối đa 100 lượt/ngày).'); e.ma = 'HET_LUOT_NGAY'; return e; };
  phongThu.lamTiengDoan = async () => { throw hl(); };
  phongThu.lamTiengLuot = async () => { await cho(10); throw hl(); };
  Object.assign(phongThu, { nguonSo: () => '', soatSo: (l) => ({ giu: l, bo: [] }) });
  const doi = new DoiAiDan({
    phat: (type, d) => suKien.push({ type, ...d }), mieng: { loa: new Set([{ readyState: 1, send: () => {} }]) }, phongThu,
    phongAi: { st: { phienId: p.id }, datLai() {}, bao: (x, muc) => suKien.push({ type: 'bao', x, muc }) },
    nhac: () => null, khoBai: { ds: () => [], doc: () => null },
    nhip: { truocMs: 300, manhMs: 50, nghiMs: 10, choNguoiDanMs: 60, luiMs: 20, vongMs: 20, choTraLoiMs: 400, chaoMoiMs: 60 * 60 * 1000 },
  });
  t.after(() => doi.dung());
  doi.dongBo();
  const het = Date.now() + 800;
  while (Date.now() < het) { doi.nhipDan(); await cho(5); }
  assert.equal(doi.trangThai(p.id).trang_thai, 'tam_dung', 'đội tạm dừng');
  assert.equal(doi.s.i, 0, 'không lướt sang các đoạn sau');
  const do_ = suKien.filter((e) => e.type === 'bao' && e.muc === 'do');
  assert.equal(do_.length, 1, 'báo đỏ một lần');
  assert.match(do_[0].x, /hết lượt đọc giọng hôm nay.*chỉ đọc được phần đã làm sẵn/);
  assert.match(suKien.filter((e) => e.type === 'live.doi_dan').at(-1).ly_do, /Google hết lượt đọc giọng hôm nay — đội AI tạm dừng/);
});
