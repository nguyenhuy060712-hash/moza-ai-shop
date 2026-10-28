'use strict';

// Đơn hàng (SPEC.md F-52, F-55, F-57, F-58, mục 7): giữ hàng một giao dịch, bảng chuyển trạng thái (người / AI), trừ kho
// khi gửi, hoàn hàng, tự hủy quá giờ giữ, hoàn tác lần đổi của AI, chuỗi thao tác ngẫu nhiên không lệch kho, báo cáo khớp
// đếm trực tiếp, API màn hình Đơn hàng (in phiếu, xuất CSV, gửi nhiều đơn).

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');

function taoTinKhach(hopThu, { psid = 'psid_lan', noiDung = 'ok em, chốt đơn nha' } = {}) {
  const kq = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid, mid: `mid_${Math.random()}`, noi_dung: noiDung });
  return kq;
}

test('đơn hàng — nghiệp vụ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  const kh = require('../server/nghiep-vu/khach');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const sp = require('../server/nghiep-vu/san-pham');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const { csdl } = require('../server/db/ket-noi');

  caiDat.datBanHang({ phi_ship: 30000, mien_phi_tu: 600000 });
  const a = taoSanPhamMau({ so: 12, them: {} });
  const b = taoSanPhamMau({ so: 20, ten: 'Chân váy xếp ly', danhMuc: 'chan_vay', gia: '199k', mau: ['Be'], co: ['S', 'M'], ton: 1 });
  const con = (pl) => kho.conHang(pl.san_pham_id).find((x) => x.id === pl.id).con_ban_duoc;
  const ton = (pl) => kho.conHang(pl.san_pham_id).find((x) => x.id === pl.id).ton;

  await t.test('tạo đơn giữ hàng: còn bán được giảm, tồn không đổi; tiền = hàng + ship theo Cài đặt', () => {
    const d = don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'M').id, so_luong: 2 }], nguon: 'tin_nhan' });
    assert.equal(d.ma, 'DH-0001');
    assert.equal(d.trang_thai, 'cho_xac_nhan');
    assert.equal(d.tong_hang, 578000);
    assert.equal(d.phi_ship, 30000);
    assert.equal(d.tong_tien, 608000);
    assert.ok(d.giu_den > new Date().toISOString());
    assert.equal(con(a.pl('Đen', 'M')), 3);
    assert.equal(ton(a.pl('Đen', 'M')), 5);
    assert.match(d.dong[0].ten_chup, /Số 12 · Sơ mi linen tay ngắn · Đen\/M/);
    assert.equal(d.dong[0].gia_von_chup, 150000);
    // Thêm món vượt "miễn phí từ" → phí ship 0.
    const d2 = don.themMon(d.id, a.pl('Trắng', 'L').id, 1);
    assert.equal(d2.tong_hang, 867000);
    assert.equal(d2.phi_ship, 0);
    assert.equal(d2.tong_tien, 867000);
    // Bớt lại → ship quay về.
    const d3 = don.botMon(d.id, a.pl('Trắng', 'L').id);
    assert.equal(d3.phi_ship, 30000);
    assert.equal(d3.dong.length, 1);
    don.doiTrangThai(d.id, 'da_huy', { nguon: 'nguoi' });
    assert.equal(con(a.pl('Đen', 'M')), 5, 'hủy trả hàng về');
  });

  await t.test('giá riêng từng phân loại được chụp vào dòng đơn', () => {
    sp.suaSanPham(a.san_pham.id, { phan_loai: a.phan_loai.map((p) => ({ gt1: p.gt1, gt2: p.gt2, ton: p.ton, gia: p.gt2 === 'L' ? '319k' : '' })) });
    const pl = sp.phanLoaiCua(a.san_pham.id).find((p) => p.gt1 === 'Trắng' && p.gt2 === 'L');
    const d = don.taoDon({ mon: [{ phan_loai_id: pl.id, so_luong: 1 }], nguon: 'nguoi' });
    assert.equal(d.dong[0].don_gia, 319000);
    sp.suaSanPham(a.san_pham.id, { gia: '299k' }); // đổi giá sau khi đặt: đơn cũ giữ giá lúc đặt
    assert.equal(don.layDon(d.id).dong[0].don_gia, 319000);
    don.doiTrangThai(d.id, 'da_huy');
  });

  await t.test('món hết / không đủ / ngừng bán → cả đơn không tạo, không giữ món nào', () => {
    const truoc = con(a.pl('Đen', 'L'));
    const soDon = csdl().prepare('SELECT COUNT(*) n FROM don').get().n;
    assert.throws(() => don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'L').id, so_luong: 1 }, { phan_loai_id: b.pl('Be', 'S').id, so_luong: 2 }], nguon: 'tin_nhan' }),
      (e) => e.ma === 'KHONG_DU_HANG' && /chỉ còn bán được 1/.test(e.message));
    assert.equal(con(a.pl('Đen', 'L')), truoc);
    assert.equal(csdl().prepare('SELECT COUNT(*) n FROM don').get().n, soDon);
    const giu = don.taoDon({ mon: [{ phan_loai_id: b.pl('Be', 'S').id, so_luong: 1 }], nguon: 'tin_nhan' });
    assert.throws(() => don.taoDon({ mon: [{ phan_loai_id: b.pl('Be', 'S').id, so_luong: 1 }], nguon: 'tin_nhan' }),
      (e) => e.ma === 'HET_HANG' && /Be\/M \(còn 1\)/.test(e.message));
    don.doiTrangThai(giu.id, 'da_huy');
    sp.doiTrangThai(b.san_pham.id, 'ngung_ban');
    assert.throws(() => don.taoDon({ mon: [{ phan_loai_id: b.pl('Be', 'S').id }], nguon: 'tin_nhan' }), (e) => e.ma === 'SP_KHONG_BAN_DUOC');
    sp.doiTrangThai(b.san_pham.id, 'dang_ban');
  });

  await t.test('nhiều người giữ ô cuối cùng cùng lúc: chỉ một người được, không bán âm', async () => {
    const pl = b.pl('Be', 'M');
    assert.equal(con(pl), 1);
    const kq = await Promise.allSettled(Array.from({ length: 8 }, () => Promise.resolve().then(() => don.taoDon({ mon: [{ phan_loai_id: pl.id }], nguon: 'binh_luan_live' }))));
    assert.equal(kq.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(con(pl), 0);
    for (const x of kq.filter((y) => y.status === 'fulfilled')) don.doiTrangThai(x.value.id, 'da_huy');
  });

  await t.test('bảng chuyển trạng thái của người: xác nhận cần đủ thông tin giao; gửi trừ tồn; hoàn + nhận hoàn cộng lại', () => {
    const pl = a.pl('Trắng', 'M');
    const d = don.taoDon({ mon: [{ phan_loai_id: pl.id, so_luong: 2 }], nguon: 'nguoi' });
    assert.throws(() => don.doiTrangThai(d.id, 'da_xac_nhan'), (e) => e.ma === 'THIEU_THONG_TIN_GIAO');
    assert.throws(() => don.datThongTinGiao(d.id, { sdt: '12345' }, { boi: 'nguoi' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    don.datThongTinGiao(d.id, { ten: 'Lan', sdt: '0912 345 678', diaChi: '12 Lý Thái Tổ, Bắc Ninh' }, { boi: 'nguoi' });
    assert.throws(() => don.doiTrangThai(d.id, 'da_gui'), (e) => e.ma === 'CHUYEN_KHONG_HOP_LE', 'chưa xác nhận không gửi được');
    let x = don.doiTrangThai(d.id, 'da_xac_nhan');
    assert.equal(x.giu_den, null);
    x = don.doiTrangThai(d.id, 'cho_xac_nhan'); // người đưa về: giữ lại từ bây giờ
    assert.ok(x.giu_den);
    don.doiTrangThai(d.id, 'da_xac_nhan');
    assert.equal(ton(pl), 5);
    don.doiTrangThai(d.id, 'da_gui');
    assert.equal(ton(pl), 3, 'gửi trừ tồn');
    assert.equal(con(pl), 3, 'còn bán được không đổi khi gửi');
    assert.throws(() => don.doiTrangThai(d.id, 'da_huy'), (e) => e.ma === 'CHUYEN_KHONG_HOP_LE', 'đã gửi không hủy được');
    don.doiTrangThai(d.id, 'hoan');
    assert.equal(ton(pl), 3, 'hoàn chưa nhận hàng: chưa cộng');
    don.nhanHoan(d.id);
    don.nhanHoan(d.id); // bấm hai lần không cộng hai lần
    assert.equal(ton(pl), 5);
    assert.deepEqual(kho.doiChieu(), []);
    const ls = don.lichSu(d.id).map((r) => `${r.tu || ''}>${r.den}`);
    assert.deepEqual(ls.slice(0, 3), ['>cho_xac_nhan', 'cho_xac_nhan>da_xac_nhan', 'da_xac_nhan>cho_xac_nhan']);
  });

  await t.test('AI: chỉ xác nhận / hủy, luôn cần tin khách làm bằng chứng; khách từng hoàn nhiều → phải gọi', () => {
    const h0 = taoTinKhach(hopThu, { psid: 'psid_mai_anh', noiDung: 'lấy 1 áo 12 đen M nha' });
    const hKhac = taoTinKhach(hopThu, { psid: 'psid_nguoi_khac' });
    const d = don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'M').id }], nguon: 'tin_nhan', hoiThoaiId: h0.hoiThoai.id, nguoiFbId: h0.hoiThoai.nguoi_fb_id });
    don.datThongTinGiao(d.id, { ten: 'Mai Anh', sdt: '0987654321', diaChi: 'Từ Sơn' }, { boi: 'ai' });
    assert.throws(() => don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'ai' }), (e) => e.ma === 'THIEU_BANG_CHUNG');
    assert.throws(() => don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'ai', bangChung: hKhac.tinNhanId }), (e) => e.ma === 'THIEU_BANG_CHUNG', 'tin của người khác');
    // Khách nói "đồng ý" khi shop CHƯA đọc lại đơn với tổng tiền hiện tại → chưa xác nhận được.
    assert.throws(() => don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'ai', bangChung: h0.tinNhanId }), (e) => e.ma === 'CHUA_DOC_LAI');
    const sau = (giay) => new Date(Date.now() + giay * 1000).toISOString();
    hopThu.ghiTinRa({ hoiThoaiId: h0.hoiThoai.id, guiBoi: 'ai', noiDung: `Em đọc lại đơn: áo 12 Đen/M, tổng tiền ${don.layDon(d.id).tong_tien.toLocaleString('vi-VN')}đ, chị đồng ý nha`, khoa: 'doc_lai_1' });
    const h1 = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid: 'psid_mai_anh', mid: 'mid_dong_y_1', noi_dung: 'ok em', luc: sau(2) });
    const x = don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'ai', bangChung: h1.tinNhanId });
    assert.equal(x.trang_thai, 'da_xac_nhan');
    assert.throws(() => don.doiTrangThai(d.id, 'da_gui', { nguon: 'ai', bangChung: h1.tinNhanId }), (e) => e.ma === 'CAM');
    // Người hoàn tác lần xác nhận của AI.
    const y = don.hoanTac(d.id);
    assert.equal(y.trang_thai, 'cho_xac_nhan');
    assert.ok(y.giu_den);
    assert.throws(() => don.hoanTac(d.id), (e) => e.ma === 'KHONG_HOAN_TAC_DUOC', 'lần đổi cuối là của người');
    don.doiTrangThai(d.id, 'da_huy', { nguon: 'ai', bangChung: h1.tinNhanId });
    assert.equal(don.layDon(d.id).ly_do_huy, 'khách hủy');

    // #73: khách từng hoàn 2 đơn → AI không tự xác nhận.
    const k = kh.taoKhach({ ten: 'Hay Hoàn', sdt: '0901111222', taoBoi: 'nguoi' }).khach;
    for (let i = 0; i < 2; i += 1) {
      const z = don.taoDon({ mon: [{ phan_loai_id: a.pl('Trắng', 'L').id }], nguon: 'nguoi', khachId: k.id });
      don.datThongTinGiao(z.id, { ten: 'Hay Hoàn', sdt: '0901111222', diaChi: 'Quế Võ' }, { boi: 'nguoi' });
      don.doiTrangThai(z.id, 'da_xac_nhan'); don.doiTrangThai(z.id, 'da_gui'); don.doiTrangThai(z.id, 'hoan'); don.nhanHoan(z.id);
    }
    const h2 = taoTinKhach(hopThu, { psid: 'psid_hay_hoan' });
    const m = don.taoDon({ mon: [{ phan_loai_id: a.pl('Trắng', 'L').id }], nguon: 'tin_nhan', khachId: k.id, hoiThoaiId: h2.hoiThoai.id, nguoiFbId: h2.hoiThoai.nguoi_fb_id });
    don.datThongTinGiao(m.id, { ten: 'Hay Hoàn', sdt: '0901111222', diaChi: 'Quế Võ' }, { boi: 'ai' });
    hopThu.ghiTinRa({ hoiThoaiId: h2.hoiThoai.id, guiBoi: 'ai', noiDung: `Tổng tiền đơn ${m.ma}: ${don.layDon(m.id).tong_tien}đ`, khoa: 'doc_lai_2' });
    assert.throws(() => don.doiTrangThai(m.id, 'da_xac_nhan', { nguon: 'ai', bangChung: h2.tinNhanId }), (e) => e.ma === 'CAN_GOI_XAC_NHAN');
    assert.equal(don.doiTrangThai(m.id, 'da_xac_nhan', { nguon: 'nguoi' }).trang_thai, 'da_xac_nhan', 'người gọi rồi xác nhận được');
    don.doiTrangThai(m.id, 'da_huy');
  });

  await t.test('khách chốt thêm món SAU lần đọc lại → lời đồng ý cũ không đủ; phải đọc lại tổng mới rồi khách đồng ý', () => {
    const sau = (giay) => new Date(Date.now() + giay * 1000).toISOString();
    const h = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid: 'psid_them_mon', mid: 'mid_tm_0', noi_dung: 'lấy áo 12 đen M' });
    const d = don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'M').id }], nguon: 'binh_luan_live', hoiThoaiId: h.hoiThoai.id, nguoiFbId: h.hoiThoai.nguoi_fb_id, ...{ tenNhan: 'Thu', sdtNhan: '+84912000222', diaChiNhan: 'Y' } });
    hopThu.ghiTinRa({ hoiThoaiId: h.hoiThoai.id, guiBoi: 'ai', noiDung: `Tổng tiền ${don.layDon(d.id).tong_tien.toLocaleString('vi-VN')}đ, chị xác nhận nha`, khoa: 'tm_1' });
    const d2 = don.themMon(d.id, a.pl('Trắng', 'L').id, 1); // bình luận chốt thêm món
    const dongY = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid: 'psid_them_mon', mid: 'mid_tm_1', noi_dung: 'ok xác nhận', luc: sau(2) });
    assert.throws(() => don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'ai', bangChung: dongY.tinNhanId }), (e) => e.ma === 'CHUA_DOC_LAI' && /tổng tiền hiện tại/.test(e.message));
    hopThu.ghiTinRa({ hoiThoaiId: h.hoiThoai.id, guiBoi: 'ai', noiDung: `Đơn giờ 2 món, tổng tiền ${d2.tong_tien.toLocaleString('vi-VN')}đ ạ`, khoa: 'tm_2' });
    // Đọc lại tổng mới rồi khách đồng ý lần nữa → được.
    const dongY2 = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_1', psid: 'psid_them_mon', mid: 'mid_tm_2', noi_dung: 'ok 2 món', luc: sau(4) });
    assert.equal(don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'ai', bangChung: dongY2.tinNhanId }).trang_thai, 'da_xac_nhan');
    don.doiTrangThai(d.id, 'da_huy');
  });

  await t.test('quá giờ giữ hàng → tự hủy, trả hàng; đơn đã xác nhận không bị hủy', () => {
    const pl = a.pl('Đen', 'L');
    const truoc = con(pl);
    const d1 = don.taoDon({ mon: [{ phan_loai_id: pl.id }], nguon: 'binh_luan_live' });
    const d2 = don.taoDon({ mon: [{ phan_loai_id: pl.id }], nguon: 'nguoi', tenNhan: 'A', sdtNhan: '+84912000111', diaChiNhan: 'X' });
    don.doiTrangThai(d2.id, 'da_xac_nhan');
    assert.equal(con(pl), truoc - 2);
    const huy = don.huyQuaGio(new Date(Date.now() + 25 * 3600e3));
    assert.deepEqual(huy.map((x) => x.id), [d1.id]);
    assert.equal(don.layDon(d1.id).ly_do_huy, 'quá giờ giữ hàng');
    assert.equal(don.layDon(d2.id).trang_thai, 'da_xac_nhan');
    assert.equal(con(pl), truoc - 1);
    don.doiTrangThai(d2.id, 'da_huy');
  });

  await t.test('nhắn chủ động: đơn còn ≤ 2 giờ giữ mà thiếu thông tin giao; đơn vừa gửi chưa báo', () => {
    const d = don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'M').id }], nguon: 'tin_nhan' });
    assert.ok(!don.canNhanChuDong(new Date()).nhac.some((x) => x.id === d.id), 'còn lâu mới hết giờ');
    const gan = new Date(new Date(d.giu_den).getTime() - 90 * 60e3);
    assert.ok(don.canNhanChuDong(gan).nhac.some((x) => x.id === d.id));
    don.danhDauNhan(d.id, 'nhac_giao_luc');
    assert.ok(!don.canNhanChuDong(gan).nhac.some((x) => x.id === d.id), 'chỉ nhắc một lần');
    don.datThongTinGiao(d.id, { ten: 'B', sdt: '0912999888', diaChi: 'Y' }, { boi: 'nguoi' });
    don.doiTrangThai(d.id, 'da_xac_nhan');
    don.guiNhieu([{ id: d.id, ma_van_don: 'GHN123' }]);
    const bao = don.canNhanChuDong(new Date()).bao.find((x) => x.id === d.id);
    assert.equal(bao.ma_van_don, 'GHN123');
    assert.throws(() => don.danhDauNhan(d.id, 'trang_thai'));
  });

  await t.test('chuỗi 300 thao tác ngẫu nhiên (có gộp đơn, sửa món sau xác nhận — F-90): không bán âm, tồn luôn khớp lịch sử kho', () => {
    let hat = 7;
    const ngau = (n) => { hat = (hat * 1103515245 + 12345) % 2147483648; return hat % n; };
    const cacPl = [...a.phan_loai, ...b.phan_loai].map((p) => p.id);
    const moi = [];
    for (let i = 0; i < 300; i += 1) {
      const viec = ngau(10);
      try {
        if (viec <= 2) moi.push(don.taoDon({ mon: [{ phan_loai_id: cacPl[ngau(cacPl.length)], so_luong: 1 + ngau(3) }], nguon: 'nguoi', tenNhan: 'N', sdtNhan: '+84912345000', diaChiNhan: 'Z' }).id);
        else if (viec === 3 && moi.length) don.doiTrangThai(moi[ngau(moi.length)], 'da_xac_nhan');
        else if (viec === 4 && moi.length) don.doiTrangThai(moi[ngau(moi.length)], ['da_gui', 'da_huy'][ngau(2)]);
        else if (viec === 5 && moi.length) { const id = moi[ngau(moi.length)]; don.doiTrangThai(id, 'hoan'); don.nhanHoan(id); }
        else if (viec === 8 && moi.length > 1) don.gopDon(moi[ngau(moi.length)], moi[ngau(moi.length)]);
        else if (viec === 9 && moi.length) don.themMon(moi[ngau(moi.length)], cacPl[ngau(cacPl.length)], 1, { boi: ['ai', 'nguoi', 'khach'][ngau(3)] });
        else if (viec === 6) kho.nhap([{ phan_loai_id: cacPl[ngau(cacPl.length)], so: 1 + ngau(4) }]);
        else kho.dieuChinh([{ phan_loai_id: cacPl[ngau(cacPl.length)], ton: 3 + ngau(6) }]);
      } catch (e) {
        assert.ok(['HET_HANG', 'KHONG_DU_HANG', 'CHUYEN_KHONG_HOP_LE', 'THIEU_THONG_TIN_GIAO', 'DON_KHONG_SUA_DUOC', 'DU_LIEU_KHONG_HOP_LE', 'SP_KHONG_BAN_DUOC'].includes(e.ma), `lỗi lạ: ${e.ma} ${e.message}`);
      }
      assert.deepEqual(kho.doiChieu(), [], `lệch kho ở bước ${i}`);
    }
    for (const id of cacPl) {
      const p = csdl().prepare('SELECT * FROM phan_loai WHERE id = ?').get(id);
      assert.ok(p.ton >= 0, 'tồn không âm');
    }
  });

  await t.test('báo cáo khớp đếm trực tiếp, không tính diễn tập; lãi gộp theo giá vốn chụp', () => {
    const bc = require('../server/nghiep-vu/bao-cao');
    kho.nhap([{ phan_loai_id: a.pl('Đen', 'M').id, so: 20 }]);
    don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'M').id }], nguon: 'nguoi', dienTap: true });
    const r = bc.baoCao({});
    const db = csdl();
    const dem = db.prepare('SELECT COUNT(*) n FROM don WHERE dien_tap = 0').get().n;
    assert.equal(r.tong.don, dem);
    const ds = db.prepare("SELECT COALESCE(SUM(tong_tien),0) n FROM don WHERE dien_tap = 0 AND trang_thai IN ('da_xac_nhan','da_gui','da_giao','hoan')").get().n;
    assert.equal(r.tong.doanh_so, ds);
    const lai = db.prepare(`SELECT COALESCE(SUM(x.so_luong*(x.don_gia-x.gia_von_chup)),0) n FROM don_dong x JOIN don d ON d.id=x.don_id
                            WHERE d.dien_tap=0 AND d.trang_thai IN ('da_xac_nhan','da_gui','da_giao','hoan') AND x.gia_von_chup IS NOT NULL`).get().n;
    assert.equal(r.tong.lai_gop, lai);
    const theoSp = r.theo_san_pham.reduce((s, x) => s + x.tien_hang, 0);
    assert.equal(theoSp, r.tong.tien_hang);
  });

  await t.test('khối đơn cho AI che số điện thoại, có dòng tổng tiền để trích', () => {
    const d = don.taoDon({ mon: [{ phan_loai_id: a.pl('Đen', 'M').id }], nguon: 'tin_nhan', tenNhan: 'Lan', sdtNhan: '+84912345678', diaChiNhan: 'Bắc Ninh' });
    const k = don.khoiChoAi(don.layDon(d.id));
    assert.match(k, new RegExp(`Tổng tiền đơn ${d.ma}: `));
    assert.match(k, /0912\*\*\*678/);
    assert.doesNotMatch(k, /0912345678|150\.000/, 'không lộ số đầy đủ, không có giá vốn');
    don.doiTrangThai(d.id, 'da_huy');
  });
});

test('đơn hàng — API màn hình Đơn hàng', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const { goi } = pm;
  const s = taoSanPhamMau({ so: 7 });
  const cd = await goi('PUT', '/api/cai-dat', { ban_hang: { ten_shop: 'Shop Lan Anh', sdt_shop: '0912 000 111', phi_ship: '25k' } });
  assert.equal(cd.ma, 200, cd.chu);

  const tao = await goi('POST', '/api/don', { mon: [{ phan_loai_id: s.pl('Đen', 'M').id, so_luong: 1 }], ten: 'Chị Hoa', sdt: '0934 567 890', dia_chi: '5 Ngô Gia Tự, Bắc Ninh' });
  assert.equal(tao.ma, 201, tao.chu);
  const d = tao.than;
  assert.equal(d.tong_tien, 289000 + 25000);
  assert.ok(d.khach_id, 'tạo đơn có số điện thoại thì có hồ sơ khách');

  let r = await goi('GET', '/api/don?trang_thai=cho_xac_nhan');
  assert.equal(r.than.don.length, 1);
  assert.equal(r.than.dem.cho_xac_nhan, 1);
  r = await goi('GET', `/api/don?q=${encodeURIComponent('0934567890')}&trang_thai=`);
  assert.equal(r.than.don.length, 1, 'tìm theo số điện thoại');

  r = await goi('PUT', `/api/don/${d.id}`, { phi_ship: '0', ghi_chu: 'giao giờ hành chính' });
  assert.equal(r.than.tong_tien, 289000);
  r = await goi('POST', `/api/don/${d.id}/mon`, { phan_loai_id: s.pl('Trắng', 'L').id, so_luong: 1 });
  assert.equal(r.than.tong_tien, 578000, 'phí ship người sửa tay được giữ');

  r = await goi('POST', `/api/don/${d.id}/trang-thai`, { den: 'da_xac_nhan' });
  assert.equal(r.than.trang_thai, 'da_xac_nhan');
  r = await goi('POST', '/api/don/gui', { ds: [{ id: d.id, ma_van_don: 'SPX999' }, { id: 'khong_co', ma_van_don: null }] });
  assert.equal(r.than.ok, 1);
  assert.equal(r.than.loi, 1);
  r = await goi('GET', `/api/don/${d.id}`);
  assert.equal(r.than.don.trang_thai, 'da_gui');
  assert.equal(r.than.don.ma_van_don, 'SPX999');
  assert.ok(r.than.lich_su.length >= 3);

  r = await goi('GET', `/api/don/phieu?ids=${d.id}&kho=a4`);
  assert.equal(r.ma, 200);
  assert.match(r.chu, /Shop Lan Anh/);
  assert.match(r.chu, new RegExp(d.ma));
  assert.match(r.chu, /Thu hộ \(COD\): 578\.000đ/);
  assert.match(r.chu, /size: A4/);
  r = await goi('GET', '/api/don/phieu?ids=<script>');
  assert.equal(r.ma, 404, 'mã lạ không in');

  const csv = await fetch(`${pm.goc}/api/don/xuat.csv?trang_thai=`);
  const chu = Buffer.from(await csv.arrayBuffer());
  assert.deepEqual([...chu.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'CSV có BOM cho Excel');
  assert.match(chu.toString('utf8'), /"Mã đơn",.*"Tổng tiền"/);
  assert.match(chu.toString('utf8'), /SPX999/);

  r = await goi('POST', `/api/don/${d.id}/trang-thai`, { den: 'da_xac_nhan' });
  assert.equal(r.ma, 409);
  r = await goi('POST', `/api/don/${d.id}/hoan-tac`);
  assert.equal(r.ma, 409, 'lần đổi cuối là của người');
});
