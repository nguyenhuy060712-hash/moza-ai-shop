'use strict';

/**
 * AI trong phòng live (F-17 Director, F-18 Co-host, F-16 DỪNG AI, F-15 Người đóng vai).
 * Nhà cung cấp AI giả: không gọi mạng, không tốn tiền. Giả phân biệt Director / Co-host theo lời dặn vai trò.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
async function choDen(dk, toiDa = 3000) {
  const bd = Date.now();
  for (;;) {
    const kq = await dk();
    if (kq) return kq;
    if (Date.now() - bd > toiDa) throw new Error('Quá thời gian chờ');
    await cho(20);
  }
}

const idsTrong = (o) => [...o.lichSu[0].chu.matchAll(/id (bl_[a-z0-9]+)/g)].map((m) => m[1]);
const phieuDirector = (o) => ({
  quyet_dinh: 'de_nguoi_dan', cau_hoi_noi_bat: [], giao_cohost: { cau_hoi: '', so: 0, skill_ids: [] },
  goi_y: '', bao: '', chuyen_tu_van_ids: [], gan_nhan: [], luong_lu: [], man_hinh: { mau: '', so: 0, mau_sac: '', chieu_cao: 0, can_nang: 0 }, ly_do: 'thử', ...o,
});

test('AI trong phòng live', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const nhatKy = require('../server/nghiep-vu/nhat-ky');
  const { FacebookGia } = require('../server/facebook/gia');
  const { PhongLive } = require('../server/phong-live');
  const { PhongAi } = require('../server/phong-ai');
  const { datLaiTrangThaiNha } = require('../server/agent/runtime');

  const sp12 = taoSanPhamMau().san_pham; // áo số 12 · Sơ mi linen tay ngắn, 289.000đ
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'],
    them: { mo_ta: 'Jean mặc đi chơi, tôn dáng.', diem_noi_bat: ['vải jean co giãn nhẹ', 'ống suông che bắp chân'] } });
  const kb = kichBan.taoNhanh(); // [mở đầu, áo 12, quần 15, kết thúc]

  // Nhà cung cấp giả: mỗi bài đặt hàm trả lời cho Director và cho Co-host.
  const goi = { director: [], cohost: [] };
  let traLoi = { director: () => phieuDirector({}), cohost: () => ({ cau: 'Dạ.', trich_dan: [] }) };
  const nha = {
    async goi(o) {
      const ai = o.heThong.includes('điều phối') ? 'director' : 'cohost';
      goi[ai].push(JSON.parse(JSON.stringify({ heThong: o.heThong, lichSu: o.lichSu })));
      const r = await traLoi[ai](o, goi[ai].length);
      return { goiCongCu: [], chu: JSON.stringify(r), goc: null, tokenVao: 500, tokenRa: 50 };
    },
  };

  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const ai = new PhongAi({ phat, nhaCungCap: { gemini: nha }, gomMs: 30, gioiHan: { director: { giay: 2 }, cohost: { giay: 2 } } });
  const fb = new FacebookGia();
  const phong = new PhongLive({ layKetNoi: () => fb, phat, ai });
  const phien = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  fb.batDauLive();
  await phong.quet();
  live.doiDoan(phien.id, 1); // đang nói áo số 12
  t.after(() => { ai.datLai(null); phong.dongLuong(); });
  t.beforeEach(() => { datLaiTrangThaiNha(); goi.director.length = 0; goi.cohost.length = 0; suKien.length = 0; });

  const binhLuan = (ten, noiDung) => fb.themBinhLuan({ ten, noi_dung: noiDung });
  const choAiRanh = () => choDen(() => !ai.dangDirector && !ai.dangCohost && !ai.hen);
  const ngCanhCohost = (i = 0) => goi.cohost[i].heThong + JSON.stringify(goi.cohost[i].lichSu);

  await t.test('"20 người hỏi giá" → 1 câu hỏi nổi bật; Co-host trả lời đúng một lần; câu hiện trên Màn hình người dẫn', async () => {
    const CAU = 'Áo 12 giá bao nhiêu?';
    traLoi = {
      director: (o) => phieuDirector({
        quyet_dinh: 'giao_cohost',
        cau_hoi_noi_bat: [{ cau_hoi: CAU, so: 12, binh_luan_ids: idsTrong(o) }],
        giao_cohost: { cau_hoi: CAU, so: 12, skill_ids: ['gia-ship-thanh-toan', 'phan-loai-hoi-thoai'] },
      }),
      cohost: () => ({ cau: 'Dạ áo số 12 giá 289.000đ ạ, vải linen mát lắm.', trich_dan: [{ nguon: '12', doan: 'Giá: 289.000đ' }] }),
    };
    for (let i = 0; i < 10; i++) binhLuan(`Người ${i}`, 'giá bao nhiêu vậy shop');
    await choDen(() => goi.director.length >= 1);
    await choAiRanh();
    for (let i = 10; i < 20; i++) binhLuan(`Người ${i}`, 'áo này bn ạ');
    await choDen(() => goi.director.length >= 2);
    await choAiRanh();

    assert.match(goi.director[0].lichSu[0].chu, /món đoán .*: số 12/, 'Director thấy số sản phẩm đoán cho bình luận');
    assert.equal(goi.cohost.length, 1, 'giao Co-host đúng một lần trong phiên');
    const noiBat = ai.trangThai(phien.id).cau_hoi;
    assert.equal(noiBat.length, 1);
    assert.equal(noiBat[0].so, 12);
    assert.equal(noiBat[0].binh_luan_ids.length, 20, 'hai lượt gom vào cùng một câu hỏi');
    assert.equal(noiBat[0].da_goi_y, true);
    const goiY = suKien.filter((e) => e.type === 'live.goi_y' && e.goi_y);
    assert.equal(goiY.length, 1);
    assert.match(goiY[0].goi_y.noi_dung, /289\.000đ/);
    assert.equal(goiY[0].goi_y.san_pham_id, sp12.id);
    assert.deepEqual(goiY[0].goi_y.trich_dan, [{ nguon: '12', doan: 'Giá: 289.000đ' }]);
    // Skill không cấp cho Co-host (phan-loai-hoi-thoai) bị bỏ; Skill được cấp nằm trong ngữ cảnh Co-host.
    assert.match(goi.cohost[0].heThong, /Skill: Giá, phí ship, thanh toán/);
    assert.doesNotMatch(goi.cohost[0].heThong, /Phân loại và xếp ưu tiên hội thoại/);
    const daGoiY = live.binhLuanGanDay(phien.id, 50).filter((b) => b.xu_ly === 'da_goi_y').length;
    assert.ok(daGoiY >= 10);
    const cau = live.cauTrenSong(phien.id)[0];
    assert.equal(cau.trang_thai, 'da_hien');
    const vs = nhatKy.xemRun(cau.run_id);
    assert.ok(vs.hook.some((h) => h.hook === 'kiem_tra' && h.quyet_dinh === 'cho_qua'), 'câu đã qua Bộ kiểm tra');
  });

  await t.test('người dẫn hỏi Mai: Co-host trả lời bằng món nhắc trong câu hỏi; ngữ cảnh Co-host chỉ có thẻ của món đó', async () => {
    traLoi.cohost = () => ({ cau: 'Dạ quần số 15 giá 359.000đ ạ.', trich_dan: [{ nguon: '15', doan: 'Giá: 359.000đ' }] });
    assert.deepEqual(ai.hoiMai(phien.id, 'Mai ơi quần 15 giá bao nhiêu?'), { da_giao: true });
    await choAiRanh();
    const ngCanh = ngCanhCohost();
    assert.match(ngCanh, /Sản phẩm được giao: Quần số 15 · Quần jean ống suông/);
    assert.match(ngCanh, /Giá: 359\.000đ/);
    assert.match(ngCanh, /vải jean co giãn nhẹ/);
    assert.doesNotMatch(ngCanh, /Sơ mi linen tay ngắn|289\.000đ/, 'không có thẻ của món khác');
    assert.doesNotMatch(ngCanh, /Sản phẩm Đang bán \(số · tên/, 'Co-host không nhận mục lục sản phẩm');
    assert.ok(suKien.some((e) => e.type === 'live.goi_y' && /359\.000đ/.test(e.goi_y?.noi_dung || '')));
  });

  await t.test('người dẫn hỏi Mai bằng tên sản phẩm (gõ không dấu), không cần số', async () => {
    traLoi.cohost = () => ({ cau: 'Dạ quần jean ống suông co giãn nhẹ ạ.', trich_dan: [{ nguon: '15', doan: 'vải jean co giãn nhẹ' }] });
    assert.deepEqual(ai.hoiMai(phien.id, 'Mai oi, quan jean ong suong co gian khong?'), { da_giao: true });
    await choAiRanh();
    assert.match(ngCanhCohost(), /Sản phẩm được giao: Quần số 15/, 'không lấy món đang nói (áo 12)');
  });

  await t.test('câu có số không có trong nguồn bị chặn → Co-host soạn lại một lần; câu không có thông tin thì hiện', async () => {
    traLoi.cohost = (o, lan) => (lan === 1
      ? { cau: 'Dạ áo số 12 đang giảm 20% cho cả nhà ạ.', trich_dan: [{ nguon: '12', doan: 'Giá: 289.000đ' }] }
      : { cau: 'Dạ chương trình giảm giá của áo số 12 Mai chưa có thông tin, bạn nhắn tin cho Page nhé.', trich_dan: [] });
    ai.hoiMai(phien.id, 'Mai ơi áo 12 có giảm giá không?');
    await choAiRanh();
    assert.equal(goi.cohost.length, 2);
    assert.match(goi.cohost[1].lichSu[0].chu, /bị Bộ kiểm tra chặn: .*K3/);
    const [moiNhat, biChan] = live.cauTrenSong(phien.id, 2);
    assert.equal(biChan.trang_thai, 'bi_chan');
    assert.match(biChan.noi_dung, /20%/);
    assert.equal(moiNhat.trang_thai, 'da_hien');
    assert.doesNotMatch(moiNhat.noi_dung.replace('số 12', ''), /\d/, 'câu hiện ra không có con số nào (F-18)');
  });

  await t.test('Đội AI dẫn (bản 2.9): hỏi bằng giọng → đội nói câu đệm; Co-host không soạn được → đội hẹn kiểm lại; hỏi bằng chữ → không câu đệm', async () => {
    const goiDoi = [];
    ai.doiAi = {
      coNguoiDanHoi: (id, o) => goiDoi.push(['hoi', o.tuGiong]),
      huyCho: () => goiDoi.push(['huy']),
      traLoi: (o) => { goiDoi.push(['tra_loi', o.tuNguoiDan]); return true; },
      khongTraLoiDuoc: () => goiDoi.push(['khong_duoc']),
      dangPhat: () => false,
      dungAi() {},
    };
    live.datCheDo(phien.id, { che_do_ai: 'doi' });
    traLoi.cohost = () => { throw new Error('Gemini quá tải, OpenAI hết tiền'); };
    assert.deepEqual(ai.hoiMai(phien.id, 'Mai ơi quần 15 giá bao nhiêu?', { tuGiong: true }), { da_giao: true });
    await choAiRanh();
    assert.deepEqual(goiDoi, [['hoi', true], ['khong_duoc']]);
    goiDoi.length = 0;
    traLoi.cohost = () => ({ cau: 'Dạ quần số 15 giá 359.000đ ạ.', trich_dan: [{ nguon: '15', doan: 'Giá: 359.000đ' }] });
    ai.hoiMai(phien.id, 'quần 15 giá bao nhiêu?');
    await choAiRanh();
    assert.deepEqual(goiDoi, [['hoi', false], ['tra_loi', true]]);
    live.datCheDo(phien.id, { che_do_ai: 'goi_y' });
    ai.doiAi = null;
  });

  await t.test('câu hỏi không rõ món, đoạn đang nói không có sản phẩm → không giao Co-host, báo người dẫn nói số', async () => {
    live.doiDoan(phien.id, 0);
    const kq = ai.hoiMai(phien.id, 'Mai ơi cái này mặc đi biển được không?');
    assert.equal(kq.bo_qua, true);
    assert.match(ai.trangThai(phien.id).bao.noi_dung, /nói số sản phẩm/);
    assert.equal(goi.cohost.length, 0);
    live.doiDoan(phien.id, 1);
  });

  await t.test('người dẫn đang nói → Director không giao Co-host', async () => {
    ai.datNguoiDanNoi(phien.id, true);
    traLoi.director = (o) => phieuDirector({
      quyet_dinh: 'giao_cohost',
      cau_hoi_noi_bat: [{ cau_hoi: 'Áo 12 vải có nhăn không?', so: 12, binh_luan_ids: idsTrong(o) }],
      giao_cohost: { cau_hoi: 'Áo 12 vải có nhăn không?', so: 12, skill_ids: [] },
    });
    binhLuan('Hà', 'vải có nhăn không ạ');
    await choDen(() => goi.director.length >= 1);
    await choAiRanh();
    assert.match(goi.director[0].lichSu[0].chu, /Người dẫn: ĐANG NÓI/);
    assert.equal(goi.cohost.length, 0);
    ai.datNguoiDanNoi(phien.id, false);
  });

  await t.test('câu hỏi riêng → chuyển "Chờ Tư vấn viên"; báo người dẫn', async () => {
    traLoi.director = (o) => phieuDirector({ quyet_dinh: 'bao_nguoi_dan', bao: 'Có bạn hỏi đơn riêng, đã chuyển Tư vấn viên.', chuyen_tu_van_ids: idsTrong(o) });
    binhLuan('Tùng', 'đơn hôm qua của em giao chưa ạ');
    await choDen(() => goi.director.length >= 1);
    await choAiRanh();
    const ds = live.danhSachChoTuVan().map((b) => b.ten);
    assert.ok(ds.includes('Tùng'));
    assert.ok(suKien.some((e) => e.type === 'live.bao' && /đơn riêng/.test(e.bao.noi_dung)));
  });

  await t.test('#90: Director chọn hình cho Màn hình sản phẩm; người dẫn nói lệnh màn hình qua Hỏi Mai → làm ngay, không hỏi AI', async () => {
    const chieu = [];
    const lenh = [];
    ai.manHinh = { chieu: (l, o) => chieu.push({ l, o }), lamLenh: async (x) => { lenh.push(x); return { ok: true }; } };
    traLoi.director = () => phieuDirector({ man_hinh: { mau: 'bang_size', so: 12, mau_sac: '', chieu_cao: 158, can_nang: 0 }, ly_do: 'Nhiều bạn hỏi size' });
    binhLuan('Hà', 'áo 12 mình cao 1m58 mặc size gì');
    await choDen(() => chieu.length >= 1);
    assert.deepEqual(chieu[0].l, { mau: 'bang_size', so: 12, mau_sac: null, chieu_cao: 158, can_nang: null });
    assert.equal(chieu[0].o.boi, 'ai');
    await choAiRanh();
    const truoc = goi.cohost.length;
    assert.deepEqual(await ai.hoiMai(phien.id, 'Mai ơi chiếu bảng size áo 12'), { man_hinh: { ok: true } });
    assert.deepEqual(await ai.hoiMai(phien.id, 'quay lại camera'), { man_hinh: { ok: true } });
    assert.deepEqual(lenh.map((x) => x.canh), ['san_pham', 'phong']);
    assert.equal(goi.cohost.length, truoc, 'lệnh màn hình không tốn lượt AI');
    delete ai.manHinh;
  });

  await t.test('Director trả lời chậm quá giới hạn → bỏ lượt, không có gì hiện ra', async () => {
    ai.gioiHan.director = { giay: 0.2 };
    traLoi.director = (o) => new Promise((ok) => setTimeout(() => ok(phieuDirector({ quyet_dinh: 'goi_y_nguoi_dan', goi_y: 'Nhắc cách chốt nhé.' })), 600));
    binhLuan('Lâm', 'ship mấy ngày ạ');
    await choDen(() => goi.director.length >= 1);
    await cho(700);
    await choAiRanh();
    assert.ok(!suKien.some((e) => e.type === 'live.goi_y' && e.goi_y), 'không có gợi ý nào');
    ai.gioiHan.director = { giay: 2 };
  });

  await t.test('DỪNG AI giữa lúc Co-host đang soạn → không hiện gì, câu đang hiện bị xóa', async () => {
    traLoi.cohost = () => new Promise((ok) => setTimeout(() => ok({ cau: 'Dạ áo số 12 còn Đen/M 5 chiếc ạ.', trich_dan: [{ nguon: '12', doan: 'Còn bán được Đen/M: 5' }] }), 300));
    ai.hoiMai(phien.id, 'Mai ơi áo 12 còn màu đen size M không?');
    await choDen(() => goi.cohost.length === 1);
    ai.dungAi(phien.id);
    await cho(400);
    await choAiRanh();
    assert.ok(!suKien.some((e) => e.type === 'live.goi_y' && e.goi_y), 'không hiện câu nào sau khi dừng');
    assert.ok(suKien.some((e) => e.type === 'live.goi_y' && e.goi_y === null), 'màn hình được báo xóa câu đang hiện');
    assert.equal(ai.trangThai(phien.id).goi_y, null);
  });

  await t.test('chế độ "Tắt AI" → không gọi Director', async () => {
    fb.ketThucLive();
    await phong.quet();
    const p2 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'tat' });
    fb.batDauLive();
    await phong.quet();
    binhLuan('An', 'giá bao nhiêu ạ');
    await cho(150);
    assert.equal(goi.director.length, 0);
    fb.ketThucLive();
    await phong.quet();
    assert.equal(live.layPhien(p2.id).trang_thai, 'xong');
  });
});

test('hai câu hỏi diễn đạt khác nhau nhưng cùng chủ đề là một câu (không giao Co-host lần hai)', () => {
  const { giong } = require('../server/phong-ai');
  assert.ok(giong('Áo 12 giá bao nhiêu?', 'áo 12 bao tiền 1 cái vậy'));
  assert.ok(giong('giá bn ạ', 'có sale không shop'));
  assert.ok(giong('size nào vừa 50kg', 'cao 1m58 mặc sz gì'));
  assert.ok(!giong('giá bao nhiêu', 'ship mấy ngày'));
  assert.ok(giong('đổi size được không', 'đổi hàng được không shop'));
});

// Chủ đề so bằng chữ con không có ranh giới từ: "khong" chứa "hong" (màu hồng), "gian" chứa "gia" → mọi câu hỏi có
// "không" bị coi là cùng một câu, Co-host không trả lời câu thứ hai về cùng món trong 10 phút.
test('câu hỏi khác chủ đề mà cùng có chữ "không" không bị coi là một câu', () => {
  const { giong, chuDe } = require('../server/phong-ai');
  assert.deepEqual([...chuDe('có cod không')], ['thanh_toan']);
  assert.deepEqual([...chuDe('vải có co giãn không')], ['chat_lieu']);
  assert.ok(!giong('vải có co giãn không', 'có cod không'));
  assert.ok(!giong('vải có nhăn không', 'ship có nhanh không'));
});

test('Người đóng vai (F-15)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const nhatKy = require('../server/nghiep-vu/nhat-ky');
  const { FacebookGia } = require('../server/facebook/gia');
  const { NguoiDongVai } = require('../server/agent/agents/nguoi-dong-vai');

  const fb = new FacebookGia();
  let soLanAi = 0;
  const nha = {
    async goi(o) {
      soLanAi += 1;
      assert.match(o.lichSu[0].chu, /Người cố lừa AI/);
      const vai = ['hoi_gia', 'lua_ai', 'buc_xuc'];
      const binhLuan = Array.from({ length: 6 }, (_, i) => ({ vai: vai[i % 3], ten: `Khán giả ${soLanAi}-${i}`, noi_dung: `bình luận ${vai[i % 3]} số ${i}` }));
      return { goiCongCu: [], chu: JSON.stringify({ binh_luan: binhLuan }), goc: null, tokenVao: 300, tokenRa: 100 };
    },
  };
  const ndv = new NguoiDongVai({ fbGia: fb, phat: () => {}, nhaCungCap: { gemini: nha }, chuKyMs: 300 });
  t.after(() => ndv.tat());

  await t.test('chưa có live giả thì không bật được', () => {
    assert.throws(() => ndv.bat({ vai: ['hoi_gia'] }), (e) => e.ma === 'KHONG_CO_LIVE_GIA');
    fb.batDauLive();
    assert.throws(() => ndv.bat({ vai: ['khong_co'] }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('bật 3 vai → bình luận đổ về đúng vai, rải theo nhịp; tắt → dừng ngay', async () => {
    const binhLuan = [];
    fb.moLuongBinhLuan(fb.live.id, (bl) => binhLuan.push(bl));
    ndv.bat({ vai: ['hoi_gia', 'lua_ai', 'buc_xuc'], nhip: 'vua' });
    await choDen(() => binhLuan.length >= 6, 2000);
    assert.ok(binhLuan.some((b) => /lua_ai/.test(b.noi_dung)));
    assert.ok(binhLuan.every((b) => /hoi_gia|lua_ai|buc_xuc/.test(b.noi_dung)));
    ndv.tat();
    const daCo = binhLuan.length;
    await cho(700);
    assert.equal(binhLuan.length, daCo, 'tắt rồi thì không còn bình luận nào');
    const run = nhatKy.danhSachRun({ agentId: 'nguoi_dong_vai' });
    assert.ok(run.length >= 1);
    assert.ok(run.every((r) => r.dien_tap === true), 'chi phí ghi với dien_tap = 1');
  });
});
