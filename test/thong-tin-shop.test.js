'use strict';

/**
 * Điền nốt thông tin shop bằng lời; Tổng quan kiểm 8 mục (SPEC.md F-95, #119). "Nói với Mai" ghi Cài đặt → Bán hàng và Sổ tay CHỈ qua
 * bảng xem trước + "Làm"; con số phải có trong câu người nói. AI giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');

function nhaGia(kichBan) {
  let i = 0;
  const goi = async () => {
    const b = kichBan[Math.min(i, kichBan.length - 1)];
    i += 1;
    return { goiCongCu: [], chu: '', goc: null, tokenVao: 500, tokenRa: 100, ...b };
  };
  return { openai: { goi }, gemini: { goi }, anthropic: { goi } };
}
const goiCC = (ten, thamSo) => ({ goiCongCu: [{ id: `g_${ten}_${Math.random()}`, ten, thamSo }], goc: { gia: true } });
const phieu = (o) => ({ chu: JSON.stringify(o) });

test('Tổng quan 8 mục: dữ liệu trống thiếu 8/8; điền phí ship còn 7; đủ 8 thì ẩn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const soTay = require('../server/nghiep-vu/so-tay');
  assert.equal(caiDat.thongTinShopConThieu().length, 8);
  caiDat.datBanHang({ phi_ship: '10k' });
  assert.equal(caiDat.thongTinShopConThieu().length, 7);
  assert.ok(!caiDat.thongTinShopConThieu().some((x) => x.ma === 'phi_ship'));
  // "Không miễn ship" = để trống nhưng đã đặt; giờ giữ 24 người đã thấy và lưu → tính là đã đặt.
  caiDat.datBanHang({ mien_phi_tu: '', gio_giu: 24, gio_nghe_may: '8:00-21:30', xung_ho: 'shop_chi', ten_shop: 'Moza Shop', sdt_shop: '0987654321', dia_chi_shop: 'Bắc Ninh' });
  assert.deepEqual(caiDat.thongTinShopConThieu().map((x) => x.ma), ['doi_tra', 'tai_khoan']);
  assert.equal(caiDat.banHang().gio_nghe_may, '08:00-21:30');
  assert.throws(() => caiDat.datBanHang({ gio_nghe_may: '21:00-08:00' }), /chọn từ danh sách/);
  const doiTra = soTay.danhSachMuc().find((m) => m.tieu_de === 'Đổi trả');
  soTay.suaMuc(doiTra.id, { noi_dung: 'Đổi size trong 3 ngày nếu chưa giặt.' });
  caiDat.datBanHang({ ngan_hang: '970436', so_tk: '0011001234567', ten_chu_tk: 'Nguyễn Thị Hoa' });
  assert.deepEqual(caiDat.thongTinShopConThieu(), []);
});

test('Nói với Mai: "phí ship 10 nghìn, trên 200 nghìn miễn ship" → xem trước 2 dòng, chỉ ghi sau Làm; Bỏ → không ghi', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { noiVoiMai } = require('../server/agent/agents/quan-ly');
  const { xuLyChoDuyet } = require('../server/agent/thuc-hien');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const agent = caiDat.danhSachAgent().find((a) => a.id === 'quan_ly');
  assert.ok(agent.cong_cu.includes('dat_ban_hang') && agent.cong_cu.includes('ghi_so_tay'), 'quan_ly có 2 công cụ (021)');
  const cau = 'phí ship 10 nghìn, trên 200 nghìn miễn ship';
  const kq = await noiVoiMai(cau, { nhaCungCap: nhaGia([
    goiCC('dat_ban_hang', { dong: [{ o: 'phi_ship', gia_tri: '10000' }, { o: 'mien_phi_tu', gia_tri: '200000' }] }),
    phieu({ tra_loi: 'Mai chuẩn bị: phí ship 10.000đ, miễn ship từ 200.000đ.', man_hinh: '' }),
  ]) });
  assert.equal(kq.viec.length, 1);
  assert.deepEqual(kq.viec[0].xem_truoc, ['Phí ship: (trống) → 10.000đ', 'Miễn phí ship từ: (trống) → 200.000đ']);
  assert.equal(caiDat.banHang().phi_ship, null, 'chưa bấm Làm thì chưa ghi');
  await xuLyChoDuyet(kq.viec[0].id, true);
  assert.equal(caiDat.banHang().phi_ship, 10000);
  assert.equal(caiDat.banHang().mien_phi_tu, 200000);

  const kq2 = await noiVoiMai('shop nghe máy 8 giờ sáng tới 9 giờ tối', { nhaCungCap: nhaGia([
    goiCC('dat_ban_hang', { dong: [{ o: 'gio_nghe_may', gia_tri: '08:00-21:00' }] }), phieu({ tra_loi: 'Nghe máy 8:00–21:00.', man_hinh: '' }),
  ]) });
  assert.deepEqual(kq2.viec[0].xem_truoc, ['Giờ nghe máy: (trống) → 08:00-21:00']);
  await xuLyChoDuyet(kq2.viec[0].id, false);
  assert.equal(caiDat.banHang().gio_nghe_may, '', 'Bỏ → không ghi');
});

test('AI tự thêm số không có trong câu ("giờ giữ 12") → lỗi, không có việc chờ duyệt; ô lạ bị từ chối', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { noiVoiMai } = require('../server/agent/agents/quan-ly');
  const choDuyet = require('../server/nghiep-vu/cho-duyet');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const truoc = choDuyet.danhSach({ trangThai: 'cho' }).length;
  const kq = await noiVoiMai('phí ship 10 nghìn', { nhaCungCap: nhaGia([
    goiCC('dat_ban_hang', { dong: [{ o: 'phi_ship', gia_tri: '10000' }, { o: 'gio_giu', gia_tri: '12' }] }),
    phieu({ tra_loi: 'Mai hỏi lại giờ giữ.', man_hinh: '' }),
  ]) });
  assert.equal(kq.viec.length, 0);
  assert.equal(choDuyet.danhSach({ trangThai: 'cho' }).length, truoc);
  const cc = require('../server/agent/cong-cu/quan-ly').find((c) => c.ten === 'dat_ban_hang');
  assert.throws(() => cc.xemTruoc({ dong: [{ o: 'gio_giu', gia_tri: '12' }] }, { cauNguoiDung: 'phí ship 10 nghìn' }), (e) => e.ma === 'SO_KHONG_CO_TRONG_CAU');
  assert.throws(() => cc.xemTruoc({ dong: [{ o: 'gia', gia_tri: '1' }] }, { cauNguoiDung: 'giá 1' }), (e) => e.ma === 'O_KHONG_CO');
  assert.match(cc.xemTruoc({ dong: [{ o: 'mien_phi_tu', gia_tri: 'khong' }] }, { cauNguoiDung: 'không miễn ship' }).xem_truoc[0], /→ không miễn ship/);
  assert.equal(caiDat.banHang().phi_ship, null);
});

test('ghi_so_tay: "đổi size trong 3 ngày nếu chưa giặt" → thêm vào mục Đổi trả sau Làm (bản sửa mới); Tư vấn viên trích được (K2 đạt); không xóa mục', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { noiVoiMai } = require('../server/agent/agents/quan-ly');
  const { xuLyChoDuyet } = require('../server/agent/thuc-hien');
  const soTay = require('../server/nghiep-vu/so-tay');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  caiDat.datKhanCap(true); // chạy cả khi "Dừng mọi thứ" (như F-62) — việc ghi vẫn chờ "Làm"
  const cau = 'shop cho đổi size trong 3 ngày nếu chưa giặt';
  const kq = await noiVoiMai(cau, { nhaCungCap: nhaGia([
    goiCC('ghi_so_tay', { muc: 'Đổi trả', cach: 'them', noi_dung: 'Shop cho đổi size trong 3 ngày nếu chưa giặt.' }),
    phieu({ tra_loi: 'Mai ghi vào Sổ tay mục Đổi trả: đổi size trong 3 ngày nếu chưa giặt.', man_hinh: '' }),
  ]) });
  assert.equal(kq.viec.length, 1);
  assert.match(kq.viec[0].xem_truoc[0], /^Sổ tay → Đổi trả \(thêm vào cuối\): Shop cho đổi size trong 3 ngày/);
  const m0 = soTay.danhSachMuc().find((m) => m.tieu_de === 'Đổi trả');
  assert.equal(m0.noi_dung, '');
  caiDat.datKhanCap(false);
  await xuLyChoDuyet(kq.viec[0].id, true);
  const m1 = soTay.layMuc(m0.id);
  assert.equal(m1.noi_dung, 'Shop cho đổi size trong 3 ngày nếu chưa giặt.');
  assert.equal(m1.phien_ban, m0.phien_ban + 1);
  assert.ok(soTay.banSuaMuc(m0.id).length >= 1);
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  assert.ok(kiemTraCau({ cau: 'Dạ shop cho đổi size trong 3 ngày nếu chưa giặt ạ', trich_dan: [{ nguon: 'so_tay', doan: 'đổi size trong 3 ngày nếu chưa giặt' }], kenh: 'messenger' }).dat);
  const cc = require('../server/agent/cong-cu/quan-ly').find((c) => c.ten === 'ghi_so_tay');
  assert.throws(() => cc.xemTruoc({ muc: 'Không có', cach: 'them', noi_dung: 'x' }, {}), (e) => e.ma === 'MUC_KHONG_CO');
  assert.throws(() => cc.xemTruoc({ muc: 'Đổi trả', cach: 'thay', noi_dung: 'Đổi trong 7 ngày.' }, { cauNguoiDung: cau }), (e) => e.ma === 'SO_KHONG_CO_TRONG_CAU');
});

test('dòng đổi trả ngắn: trên Thanh chữ / Màn hình sản phẩm, cuối thẻ đơn khi còn chỗ; nguồn cho AI có giờ nghe máy', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { taoSanPhamMau } = require('./ho-tro');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const mau = taoSanPhamMau({ gia: '159k' });
  caiDat.datBanHang({ doi_tra_ngan: 'Đổi size trong 3 ngày', gio_nghe_may: '08:00-21:00' });
  const don = require('../server/nghiep-vu/don');
  const d = don.taoDon({ mon: [{ phan_loai_id: mau.pl('Đen', 'M').id }], nguon: 'nguoi', tenNhan: 'Lan', sdtNhan: '+84912345678', diaChiNhan: 'BN' });
  assert.match(require('../server/nghiep-vu/the-don').noiDung(d), /\nĐổi size trong 3 ngày$/);
  assert.equal(require('../server/man-hinh-san-pham').theSanPham(require('../server/nghiep-vu/san-pham').laySanPham(mau.san_pham.id)).doi_tra, 'Đổi size trong 3 ngày');
  const nguon = require('../server/agent/kiem-tra/kiem-tra').dongCaiDat().join('\n');
  assert.match(nguon, /Giờ nghe máy: 08:00 – 21:00/);
  assert.match(nguon, /Đổi trả: Đổi size trong 3 ngày/);
});
