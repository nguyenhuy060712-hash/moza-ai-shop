'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');
const kichBan = require('../server/nghiep-vu/kich-ban');
const live = require('../server/nghiep-vu/live');
const { FacebookGia } = require('../server/facebook/gia');
const { PhongLive } = require('../server/phong-live');
const { DienTap } = require('../server/dien-tap');

test('kịch bản live (F-37) và phiên live trên Facebook giả (F-15, F-19, F-20)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const sp12 = taoSanPhamMau().san_pham;
  const sp15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'] }).san_pham;
  const sp99 = taoSanPhamMau({ so: 99, ten: 'Váy hoa cũ', trangThai: 'ngung_ban' }).san_pham;

  let kb;
  await t.test('kịch bản: tên + đoạn, mỗi đoạn chỉ sản phẩm và lời nhắc', () => {
    kb = kichBan.taoKichBan({
      ten: 'Live sáng thứ 2',
      doan: [
        { san_pham_id: null, loi_nhac: 'Chào cả nhà' },
        { san_pham_id: sp12.id, loi_nhac: 'Nhấn mạnh vải linen mát' },
        { san_pham_id: sp15.id },
      ],
    });
    assert.equal(kb.doan.length, 3);
    assert.deepEqual(Object.keys(kb.doan[0]).sort(), ['loi_nhac', 'san_pham', 'san_pham_id']);
    assert.equal(kb.doan[1].san_pham.so, 12);
    assert.equal(kb.doan[1].san_pham.ten_day_du, 'Áo số 12 · Sơ mi linen tay ngắn');
    assert.throws(() => kichBan.taoKichBan({ ten: 'x', doan: [] }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => kichBan.taoKichBan({ ten: 'x', doan: [{ san_pham_id: null, loi_nhac: '  ' }] }), /trống/);
    assert.throws(() => kichBan.taoKichBan({ ten: 'x', doan: [{ san_pham_id: 'sp_khongco' }] }), /không tìm thấy sản phẩm/);
    assert.throws(() => kichBan.taoKichBan({ doan: [{ loi_nhac: 'a' }] }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('tạo nhanh: Mở đầu + mỗi sản phẩm Đang bán (theo số) + Kết thúc', () => {
    const nhanh = kichBan.taoNhanh();
    assert.deepEqual(nhanh.doan.map((d) => d.san_pham?.so ?? null), [null, 12, 15, null]);
    assert.match(nhanh.doan[0].loi_nhac, /chốt/);
  });

  await t.test('không cho bắt đầu phiên với sản phẩm không "Đang bán"', () => {
    const coSpNgung = kichBan.taoKichBan({ ten: 'Có món ngừng bán', doan: [{ san_pham_id: sp99.id }] });
    assert.throws(() => live.taoPhien({ kich_ban_id: coSpNgung.id }), (e) => e.ma === 'SP_KHONG_BAN_DUOC' && /số 99/.test(e.message));
  });

  const suKien = [];
  const fb = new FacebookGia();
  const phong = new PhongLive({ layKetNoi: () => fb, phat: (type, d) => suKien.push({ type, ...d }) });
  let phien;

  await t.test('tạo phiên → chờ live; bật live giả → tự gắn; chỉ một phiên mở một lúc; phiên gắn đúng bản sản phẩm', async () => {
    phien = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
    assert.equal(phien.trang_thai, 'cho_live');
    assert.equal(phien.do_tre_giay, 0, 'diễn tập không có độ trễ phát');
    assert.deepEqual(live.sanPhamTrongPhien(phien.id).sort(), [sp12.id, sp15.id].sort());
    assert.equal(live.phienBanSanPhamTrongPhien(phien.id, sp12.id), sp12.phien_ban);
    await phong.quet();
    assert.equal(live.layPhien(phien.id).trang_thai, 'cho_live', 'chưa có live thì vẫn chờ');
    fb.batDauLive();
    await phong.quet();
    const p = live.layPhien(phien.id);
    assert.equal(p.trang_thai, 'dang_live');
    assert.equal(p.fb_live_video_id, fb.live.id);
    assert.ok(suKien.some((e) => e.type === 'live.bat_dau'));
    assert.throws(() => live.taoPhien({ kich_ban_id: kb.id }), (e) => e.ma === 'PHIEN_DANG_MO');
  });

  await t.test('đổi chế độ và miệng giữa phiên (F-22)', () => {
    assert.equal(live.layPhien(phien.id).mieng, 'gpt-live-1', 'miệng mặc định lấy từ Cài đặt');
    let p = live.datCheDo(phien.id, { che_do_ai: 'noi', mieng: 'gemini-3.8-live' });
    assert.equal(p.che_do_ai, 'noi');
    assert.equal(p.mieng, 'gemini-3.8-live');
    p = live.datCheDo(phien.id, { che_do_ai: 'goi_y' });
    assert.equal(p.mieng, 'gemini-3.8-live', 'về Chỉ gợi ý vẫn nhớ miệng đã chọn');
    assert.throws(() => live.datCheDo(phien.id, { che_do_ai: 'tat' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => live.datCheDo(phien.id, { che_do_ai: 'noi', mieng: 'gpt-4o-realtime' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('bình luận về được lưu, gắn nhãn, đoán số sản phẩm (số nhắc trong bình luận, không thì đoạn đang nói); trùng thì bỏ', async () => {
    fb.themBinhLuan({ ten: 'Lan', noi_dung: 'chào shop' });
    live.doiDoan(phien.id, 1);
    await new Promise((r) => setTimeout(r, 5));
    fb.themBinhLuan({ ten: 'Hùng', noi_dung: 'giá bao nhiêu vậy?' });
    await new Promise((r) => setTimeout(r, 5));
    fb.themBinhLuan({ ten: 'Hà', noi_dung: 'áo 15 còn size S không ạ' });
    live.doiDoan(phien.id, 2);
    await new Promise((r) => setTimeout(r, 5));
    fb.themBinhLuan({ ten: 'Mai', noi_dung: 'số em 0912345678 tư vấn với' });
    const ds = live.binhLuanGanDay(phien.id).reverse();
    assert.deepEqual(ds.map((b) => b.so_doan), [null, 12, 15, 15], 'Hà nói "áo 15" lúc đang ở áo 12 → số 15');
    assert.deepEqual(ds[1].nhan, ['cau_hoi', 'ib_gia']);
    assert.ok(ds[3].nhan.includes('thong_tin_ca_nhan'));
    assert.equal(live.themBinhLuan(phien.id, { fb_id: ds[0].fb_id, ten: 'Lan', noi_dung: 'chào shop' }), null);
    assert.equal(live.demBinhLuan(phien.id).tong, 4);
    assert.equal(suKien.filter((e) => e.type === 'live.binh_luan').length, 4);
  });

  await t.test('dòng thời gian sản phẩm ghi từng đoạn đã qua; câu trên sóng gắn sản phẩm theo số', () => {
    const { csdl } = require('../server/db/ket-noi');
    const dong = csdl().prepare('SELECT doan, san_pham_id FROM dong_thoi_gian_san_pham WHERE phien_id = ? ORDER BY rowid').all(phien.id);
    assert.deepEqual(dong.map((d) => [d.doan, d.san_pham_id]), [[0, null], [1, sp12.id], [2, sp15.id]]);
    const c = live.themCauTrenSong({ phienId: phien.id, so: 12, noiDung: 'Dạ áo số 12 giá 289.000đ ạ.', trichDan: [{ nguon: '12', doan: 'Giá: 289.000đ' }] });
    assert.equal(c.san_pham_id, sp12.id);
    assert.deepEqual(c.trich_dan, [{ nguon: '12', doan: 'Giá: 289.000đ' }]);
    assert.equal(live.themCauTrenSong({ phienId: phien.id, so: 777, noiDung: 'x' }).san_pham_id, null, 'số không có thì không gắn');
    assert.equal(live.themCauTrenSong({ phienId: phien.id, noiDung: 'y' }).san_pham_id, null);
  });

  await t.test('bình luận chốt: gắn nhãn "chot", xử lý da_chot kèm đơn; Director không cần đọc lại', () => {
    const bl = live.binhLuanGanDay(phien.id).at(-1);
    let r = live.ganChot(bl.id, { xuLy: 'da_tu_van' });
    assert.ok(r.nhan.includes('chot'));
    assert.equal(r.xu_ly, 'da_tu_van');
    r = live.ganChot(bl.id, { donId: 'dh_thu', xuLy: 'da_chot' });
    assert.equal(r.nhan.filter((n) => n === 'chot').length, 1, 'không gắn nhãn hai lần');
    assert.equal(r.xu_ly, 'da_chot');
    assert.equal(r.don_id, 'dh_thu');
    assert.equal(live.ganChot(bl.id, { xuLy: 'da_chot' }).don_id, 'dh_thu', 'không truyền đơn thì giữ đơn cũ');
    assert.equal(live.ganChot('bl_khongco'), null);
    assert.throws(() => live.datXuLy(phien.id, [bl.id], 'la'), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('phiên giữ bản chụp kịch bản; sửa kịch bản không đổi phiên đang chạy', () => {
    kichBan.suaKichBan(kb.id, { doan: [{ san_pham_id: null, loi_nhac: 'đã sửa' }] });
    assert.equal(live.layPhien(phien.id).kich_ban.doan.length, 3);
    assert.throws(() => live.doiDoan(phien.id, 7), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('live giả tắt → phiên tự kết thúc, có tóm tắt; luồng bình luận đóng', async () => {
    fb.ketThucLive();
    await phong.quet();
    const p = live.layPhien(phien.id);
    assert.equal(p.trang_thai, 'xong');
    assert.match(p.tom_tat, /Live đã kết thúc trên Page\. Live \d+ phút, 4 bình luận \(3 câu hỏi\), đi qua 3\/3 đoạn\./);
    assert.equal(phong.luong, null);
    assert.equal(live.phienDangMo(), null);
    assert.ok(suKien.some((e) => e.type === 'live.ket_thuc'));
  });

  await t.test('kịch bản diễn tập: bình luận soạn sẵn vào đúng nhịp, gọi món bằng số, màu và cỡ còn hàng', async (tt) => {
    const dt = new DienTap({ fb, phat: () => {} });
    assert.throws(() => dt.chay('chot-don'), (e) => e.ma === 'KHONG_CO_LIVE_GIA');
    assert.ok(dt.danhSach().length >= 5);
    tt.mock.timers.enable({ apis: ['setTimeout'] });
    const nhan = [];
    fb.on('binh_luan', (b) => nhan.push(b.noi_dung));
    fb.batDauLive();
    dt.chay('chot-don');
    tt.mock.timers.tick(10000);
    assert.equal(nhan.length, 3, 'sau 10 giây mới có 3 bình luận');
    tt.mock.timers.tick(10000);
    assert.equal(nhan.length, 5);
    tt.mock.timers.tick(20000);
    assert.equal(nhan.length, 9);
    assert.equal(dt.trangThai().kich_ban_dang_chay, null);
    assert.equal(nhan[0], 'chốt 12 Đen M', 'không có phiên mở: lấy sản phẩm Đang bán đầu tiên');
    assert.ok(!nhan.some((n) => /\{\w+\}/.test(n)), 'đã điền hết chỗ trống');
    dt.chay('hoi-size');
    tt.mock.timers.tick(7000);
    dt.dung();
    tt.mock.timers.tick(60000);
    assert.equal(nhan.length, 9 + 2, 'dừng thì không gửi thêm');
    fb.ketThucLive();
  });
});
