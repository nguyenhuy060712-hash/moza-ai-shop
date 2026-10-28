'use strict';

/**
 * Chốt đơn từ bình luận live (SPEC.md Luồng 3, F-53, F-52, #64, #65, #72, #77): bình luận "chốt 12 đen M" → giữ hàng,
 * đơn Chờ xác nhận gộp theo người trong buổi live, nhắn riêng, đọc tên trên sóng; hết hàng / thiếu cỡ / số lạ → không đơn,
 * nhắn riêng hỏi lại; hai người chốt ô cuối cùng → chỉ một người được; quá giờ giữ → tự hủy, trả hàng.
 * Facebook giả, AI giả (không gọi mạng), Hộp thư tự động giả (ghi lại việc giao cho Tư vấn viên).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('chốt đơn từ bình luận live (Luồng 3)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  const { FacebookGia } = require('../server/facebook/gia');
  const { PhongLive } = require('../server/phong-live');
  const { ChotDon, tenGoi, tenMon } = require('../server/chot-don');

  const mau12 = taoSanPhamMau(); // áo số 12, 289.000đ, Đen/Trắng × M/L, mỗi ô 5
  const mau15 = taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'], ton: 1 });
  const mau20 = taoSanPhamMau({ so: 20, ten: 'Chân váy xếp ly', danhMuc: 'chan_vay', gia: '199k', mau: ['Be'], co: ['M'], ton: 1 });
  const kb = kichBan.taoNhanh(); // [mở đầu, áo 12, quần 15, váy 20, kết thúc]
  const conBan = (mau, gt1, gt2) => kho.conHang(mau.san_pham.id).find((x) => x.id === mau.pl(gt1, gt2).id).con_ban_duoc;

  // AI giả cho "model rẻ đọc hộ" (#77): mỗi bài đặt phiếu trả về.
  const goiAi = [];
  let phieuAi = null;
  const nha = {
    async goi(o) {
      goiAi.push(o.lichSu[0].chu);
      if (!phieuAi) throw new Error('AI giả: không có phiếu');
      return { goiCongCu: [], chu: JSON.stringify(phieuAi), goc: null, tokenVao: 50, tokenRa: 20 };
    },
  };
  // Hộp thư tự động giả: ghi lại việc MOZA giao Tư vấn viên nhắn riêng.
  const viec = [];
  const hopThu = { xuLy: async (hoiThoaiId, o) => { viec.push({ hoiThoaiId, ...o }); } };
  const tonMieng = [];
  const baoNguoiDan = [];
  const phongAi = { mieng: { capNhatTon: (c) => tonMieng.push(c) }, bao: (c) => baoNguoiDan.push(c) };
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const chot = new ChotDon({ phat, layHopThu: () => hopThu, phongAi, layKetNoi: () => fb, nhaCungCap: { gemini: nha, openai: nha, anthropic: nha } });
  const choDirector = [];
  const fb = new FacebookGia();
  const phong = new PhongLive({ layKetNoi: () => fb, phat, ai: { nhanBinhLuan: (bl) => choDirector.push(bl.noi_dung), ketThuc() {} } });
  phong.chotDon = chot;
  t.after(() => { chot.dung(); phong.dongLuong(); });

  const phien = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  fb.batDauLive();
  await phong.quet();
  live.doiDoan(phien.id, 1); // đang nói áo số 12

  /** Người xem bình luận trên live giả, chờ phòng live xử lý xong (lưu, hook, chốt đơn). */
  // Chờ đúng lúc phòng live xử lý xong bình luận (lưu, hook, chốt đơn) — không chờ cố định (máy bận thì 30 ms không đủ).
  const xong = new Set();
  const nhanGoc = phong.nhanBinhLuan.bind(phong);
  phong.nhanBinhLuan = async (pid, b) => { try { return await nhanGoc(pid, b); } finally { xong.add(b.id); } };
  const binhLuan = async (ten, noiDung) => {
    const b = fb.themBinhLuan({ ten, noi_dung: noiDung });
    for (let i = 0; i < 2000 && !xong.has(b.id); i++) await new Promise((r) => setTimeout(r, 5));
    await chot.choXong(); // thẻ giữ hàng do mã soạn (F-68)
    return live.binhLuanGanDay(phien.id, 1)[0];
  };
  /** Tin riêng cuối shop gửi cho người này (thẻ giữ hàng / thẻ hỏi lại — F-68). */
  const theCua = (ten) => fb.luongChat('page_gia', fb.psidCua('page_gia', ten)).filter((x) => x.tu === 'page').at(-1);
  const chotCua = (ten) => suKien.filter((e) => e.type === 'live.chot' && e.ten === ten);

  let donLan;
  await t.test('"chốt 12 đen M" → đơn Chờ xác nhận DH-0001 giữ hàng, bình luận gắn da_chot, sự kiện live.chot, nhắn riêng', async () => {
    const bl = await binhLuan('Nguyễn Thị Lan', 'chốt 12 đen M');
    donLan = don.danhSach()[0];
    assert.equal(donLan.ma, 'DH-0001');
    assert.equal(donLan.trang_thai, 'cho_xac_nhan');
    assert.equal(donLan.nguon, 'binh_luan_live');
    assert.equal(donLan.phien_live_id, phien.id);
    assert.equal(donLan.binh_luan_id, bl.id);
    assert.equal(donLan.dien_tap, true, 'phiên diễn tập → đơn diễn tập (không vào báo cáo)');
    assert.deepEqual(donLan.dong.map((x) => [x.phan_loai_id, x.so_luong, x.don_gia]), [[mau12.pl('Đen', 'M').id, 1, 289000]]);
    assert.equal(donLan.tong_hang, 289000);
    const gioGiu = (new Date(donLan.giu_den) - Date.now()) / 3600e3;
    assert.ok(gioGiu > 11.9 && gioGiu <= 12, 'đang live, khách chưa bấm: tạm giữ 12 giờ, hết live rút về hết live + 2 giờ (#98)');
    assert.equal(conBan(mau12, 'Đen', 'M'), 4, 'còn bán được giảm 1 (tồn chưa trừ tới khi gửi)');
    assert.equal(kho.conHang(mau12.san_pham.id).find((x) => x.gt1 === 'Đen' && x.gt2 === 'M').ton, 5);
    assert.ok(bl.nhan.includes('chot'));
    assert.equal(bl.xu_ly, 'da_chot');
    assert.equal(bl.don_id, donLan.id);
    const e = chotCua('Lan');
    assert.equal(e.length, 1);
    assert.equal(e[0].mon, 'áo số 12 màu Đen size M');
    assert.deepEqual(e[0].don, { id: donLan.id, ma: 'DH-0001' });
    assert.ok(suKien.some((x) => x.type === 'kho.cap_nhat'));
    assert.equal(choDirector.length, 0, 'bình luận chốt không đưa cho Director');
    assert.equal(viec.length, 0, 'tin đầu do mã soạn — không giao Tư vấn viên (0 lượt AI)');
    const the = theCua('Nguyễn Thị Lan');
    assert.equal(the.the.kieu, 'anh');
    assert.equal(the.the.tieu_de, 'Áo 12 Đen/M · 289.000đ');
    assert.match(the.the.phu_de, /^Giữ tới hết live \+ 2 giờ · Tin tự động từ trợ lý AI của shop$/);
    assert.deepEqual(the.nut.map((n) => n.tieu_de), ['Giữ, lên đơn', 'Đổi', 'Không lấy']);
    assert.ok(the.nhan_rieng, 'gửi bằng nhắn riêng bình luận');
    // Soát chữ khách đọc được — mã ngẫu nhiên trong payload / địa chỉ ảnh đôi khi có dãy 9 chữ số (test chập chờn trước đây).
    assert.doesNotMatch([the.the.tieu_de, the.the.phu_de, ...the.nut.map((n) => n.tieu_de)].join(' '), /\d{9,}/, 'không số điện thoại');
    assert.deepEqual(chot.choDoc.map((x) => [x.ten, x.mon]), [['Lan', 'áo số 12 màu Đen size M']], 'chờ đọc tên trên sóng (#72)');
  });

  await t.test('cùng người chốt thêm món → gộp vào CÙNG đơn; còn ≤ ngưỡng thì báo miệng và người dẫn số còn (#81)', async () => {
    const bl = await binhLuan('Nguyễn Thị Lan', 'chốt 12 trắng L x2');
    const d = don.layDon(donLan.id);
    assert.equal(don.danhSach().length, 1, 'không tạo đơn mới');
    assert.equal(bl.don_id, donLan.id);
    assert.deepEqual(d.dong.map((x) => [x.ten_chup, x.so_luong]), [['Số 12 · Sơ mi linen tay ngắn · Đen/M', 1], ['Số 12 · Sơ mi linen tay ngắn · Trắng/L', 2]]);
    assert.equal(d.tong_hang, 3 * 289000);
    assert.equal(conBan(mau12, 'Trắng', 'L'), 3);
    assert.match(tonMieng.at(-1), /áo số 12 Trắng\/L còn 3\./);
    assert.match(baoNguoiDan.at(-1), /Tồn vừa đổi: .*Trắng\/L còn 3/);
  });

  await t.test('chốt món vừa hết → không tạo đơn, nhắn riêng báo hết kèm gợi ý; không đọc tên trên sóng', async () => {
    await binhLuan('Trần Văn Hùng', 'chốt 15 xanh S');
    assert.equal(conBan(mau15, 'Xanh', 'S'), 0);
    assert.match(tonMieng.at(-1), /quần số 15 Xanh\/S vừa hết\./);
    const soDon = don.danhSach().length;
    const soViec = viec.length;
    const bl = await binhLuan('Lê Thị Mai', 'chốt 15 xanh S');
    assert.equal(don.danhSach().length, soDon, 'hết hàng thì không có đơn');
    assert.equal(conBan(mau15, 'Xanh', 'S'), 0, 'không bán âm');
    assert.equal(bl.xu_ly, 'da_tu_van');
    assert.ok(bl.nhan.includes('chot'));
    assert.equal(bl.don_id, null);
    assert.equal(chotCua('Mai').length, 0);
    assert.equal(viec.length, soViec, 'không giao Tư vấn viên');
    const the = theCua('Lê Thị Mai');
    assert.match(the.the.chu, /Quần 15 Xanh\/S vừa hết mất rồi/);
    assert.deepEqual(the.the.tra_loi_nhanh.map((q) => q.tieu_de), ['🙋 Vẫn chờ', 'Xanh/M'], 'nút Vẫn chờ (F-92) + gợi ý phân loại còn hàng của cùng mẫu');
  });

  await t.test('chốt thiếu cỡ → không đoán, không giữ hàng; nhắn riêng hỏi lại màu, size kèm phân loại còn hàng', async () => {
    phieuAi = { la_chot: true, so: 12, gt1: 'Đen', gt2: '', so_luong: 1, chac_chan: false };
    const soDon = don.danhSach().length;
    const bl = await binhLuan('Phạm Thu', 'chốt 12 đen');
    assert.equal(don.danhSach().length, soDon);
    assert.equal(bl.xu_ly, 'da_tu_van');
    assert.equal(conBan(mau12, 'Đen', 'M'), 4);
    assert.equal(conBan(mau12, 'Đen', 'L'), 5, 'không đoán cỡ L');
    const the = theCua('Phạm Thu');
    assert.match(the.the.chu, /chọn giúp mình size của Áo 12/);
    assert.deepEqual(the.the.tra_loi_nhanh.map((q) => q.tieu_de), ['Đen/M', 'Đen/L'], 'chỉ các size còn hàng của màu Đen');
    assert.match(the.the.chu, /Tin tự động từ trợ lý AI/);
  });

  // agent doc_chot có trong bảng agent (012-ban-hang.sql) nhưng không có lời dặn vai trò (server/nghiep-vu/vai-tro.js, loi-dan-mau.json)
  // → chayAgent ném "Không có Agent này", chot-don.js docHo nuốt lỗi: model đọc hộ không bao giờ chạy.
  await t.test('mã không hiểu cách viết lạ → model rẻ đọc hộ chắc chắn thì giữ hàng như thường (#77)',
    async () => {
    const goiTruoc = goiAi.length;
    phieuAi = { la_chot: true, so: 12, gt1: 'Trắng', gt2: 'M', so_luong: 1, chac_chan: true };
    const bl = await binhLuan('Đỗ Hà', 'chốt 12 màu kem sữa size m');
    assert.equal(goiAi.length, goiTruoc + 1, 'mã không chắc → model rẻ đọc hộ một lần');
    assert.equal(bl.xu_ly, 'da_chot');
    assert.equal(don.layDon(bl.don_id).dong[0].phan_loai_id, mau12.pl('Trắng', 'M').id);
    assert.match(goiAi.at(-1), /Số 12 · Sơ mi linen tay ngắn: Màu \(Đen, Trắng\); Cỡ \(M, L\) ← đang nói/);
    phieuAi = null;
  });

  await t.test('chốt số không có sản phẩm → không đơn, nhắn riêng mời xem mẫu đang bán; câu hỏi về việc chốt thì đưa Director', async () => {
    const soDon = don.danhSach().length;
    const bl = await binhLuan('Vũ Nam', 'chốt 77 đen M');
    assert.equal(don.danhSach().length, soDon);
    assert.equal(bl.xu_ly, 'da_tu_van');
    assert.match(theCua('Vũ Nam').the.chu, /Shop chưa có sản phẩm số 77/);
    const hoi = await binhLuan('Vũ Nam', 'chốt rồi chưa shop?');
    assert.equal(hoi.xu_ly, 'moi');
    assert.ok(!hoi.nhan.includes('chot'));
    assert.deepEqual(choDirector, ['chốt rồi chưa shop?']);
  });

  await t.test('hai người chốt ô cuối cùng cùng lúc → chỉ một người được, không bán âm', async () => {
    const bl1 = live.themBinhLuan(phien.id, { fb_id: 'song_1', nguoi_fb_id: 'nguoi_song_1', ten: 'Ngô An', noi_dung: 'chốt 20 be M' });
    const bl2 = live.themBinhLuan(phien.id, { fb_id: 'song_2', nguoi_fb_id: 'nguoi_song_2', ten: 'Hồ Bình', noi_dung: 'chốt 20 be M' });
    const p = live.layPhien(phien.id);
    const kq = await Promise.all([chot.xuLy(bl1, p), chot.xuLy(bl2, p)]);
    assert.deepEqual(kq, [true, true], 'cả hai đều là bình luận chốt');
    const donVay = don.danhSach().filter((d) => d.dong.some((x) => x.san_pham_id === mau20.san_pham.id));
    assert.equal(donVay.length, 1, 'chỉ một đơn giữ được ô cuối');
    assert.equal(conBan(mau20, 'Be', 'M'), 0);
    assert.deepEqual([live.layBinhLuan(bl1.id).xu_ly, live.layBinhLuan(bl2.id).xu_ly], ['da_chot', 'da_tu_van']);
    assert.equal(chotCua('An').length + chotCua('Bình').length, 1);
    // Giữ hàng là một giao dịch: gọi thẳng cũng không vượt tồn.
    assert.throws(() => don.taoDon({ mon: [{ phan_loai_id: mau20.pl('Be', 'M').id, so_luong: 1 }], nguon: 'nguoi' }), (e) => e.ma === 'HET_HANG');
  });

  await t.test('đọc tên người vừa chốt lên sóng (#72): chế độ "Co-host được nói" → Mai đọc tối đa 3 tên mỗi 30 giây', () => {
    const doc = [];
    chot.phongAi = { ...phongAi, miengSanSang: () => true, mieng: { ...phongAi.mieng, baoVuaChot: (c) => doc.push(c) } };
    live.datCheDo(phien.id, { che_do_ai: 'noi' });
    chot.choDoc = ['Lan', 'Hà', 'An', 'Thu'].map((ten) => ({ phienId: phien.id, ten, mon: 'áo số 12 màu Đen size M' }));
    chot.docCuoi = 0;
    const bd = Date.now();
    chot.docTrenSong(bd);
    assert.deepEqual(doc, ['Lan vừa chốt áo số 12 màu Đen size M; Hà vừa chốt áo số 12 màu Đen size M; An vừa chốt áo số 12 màu Đen size M']);
    chot.docTrenSong(bd + 10000);
    assert.equal(doc.length, 1, 'chưa đủ 30 giây thì chưa đọc tiếp');
    chot.docTrenSong(bd + 31000);
    assert.deepEqual(doc.at(-1), 'Thu vừa chốt áo số 12 màu Đen size M');
    assert.equal(chot.choDoc.length, 0);
    live.datCheDo(phien.id, { che_do_ai: 'goi_y' });
    chot.phongAi = phongAi;
  });

  await t.test('đơn quá giờ giữ → tự hủy, hàng trả về còn bán được', () => {
    const truoc = conBan(mau12, 'Đen', 'M');
    const cho = don.danhSach({ trangThai: 'cho_xac_nhan' });
    assert.ok(cho.length >= 3);
    assert.equal(don.huyQuaGio(new Date(Date.now() + 11 * 3600e3)).length, 0, 'đang live: chưa quá 12 giờ thì giữ');
    const huy = don.huyQuaGio(new Date(Date.now() + 13 * 3600e3));
    assert.equal(huy.length, cho.length);
    const d = don.layDon('DH-0001');
    assert.equal(d.trang_thai, 'da_huy');
    assert.equal(d.ly_do_huy, 'quá giờ giữ hàng');
    assert.equal(don.lichSu(d.id).at(-1).nguon, 'he_thong');
    assert.equal(conBan(mau12, 'Đen', 'M'), truoc + 1);
    assert.equal(conBan(mau12, 'Trắng', 'L'), 5);
    assert.equal(conBan(mau20, 'Be', 'M'), 1);
  });

  await t.test('phiên "Tắt AI" → không tự chốt (người dẫn tự làm)', async () => {
    const bl = live.themBinhLuan(phien.id, { fb_id: 'tat_1', ten: 'Lan', noi_dung: 'chốt 12 đen M' });
    assert.equal(await chot.xuLy(bl, { ...live.layPhien(phien.id), che_do_ai: 'tat' }), false);
    assert.equal(live.layBinhLuan(bl.id).xu_ly, 'moi');
  });

  await t.test('tên gọi trên sóng và cách đọc món', () => {
    assert.equal(tenGoi('Nguyễn Thị Lan'), 'Lan');
    assert.equal(tenGoi(''), 'bạn');
    const sp = require('../server/nghiep-vu/san-pham');
    assert.equal(tenMon(sp.laySanPham(mau15.san_pham.id), mau15.pl('Xanh', 'M')), 'quần số 15 màu Xanh size M');
  });
});
