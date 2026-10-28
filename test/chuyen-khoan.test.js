'use strict';

/**
 * Thẻ đơn chọn cách trả + mã QR chuyển khoản (SPEC.md F-89, #112). Facebook giả, AI giả, VietQR giả (PNG nhỏ) — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

async function dung(t, { cheDo = 'goi_y' } = {}) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { csdl } = require('../server/db/ket-noi');
  const { FacebookGia } = require('../server/facebook/gia');
  const { PhongLive } = require('../server/phong-live');
  const { ChotDon } = require('../server/chot-don');
  const { HopThuTuDong } = require('../server/hop-thu');
  const fb = new FacebookGia({ tinhHuong: 'than_trong' });
  let goiAi = 0;
  const nha = { async goi() { goiAi += 1; return { goiCongCu: [], chu: '{"xong":true,"tom_tat":""}', goc: null, tokenVao: 1, tokenRa: 1 }; } };
  const nhaCungCap = { gemini: nha, openai: nha, anthropic: nha };
  const layKetNoi = () => fb;
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi, nhaCungCap, gomMs: 10, chuKyMs: 3600000, phat });
  const chen = [];
  const noi = [];
  const phongAi = {
    doiAi: { chenBanHang: (phienId, khoa, bien) => { chen.push({ khoa, ...bien }); return true; } },
    miengSanSang: () => true,
    mieng: { nhacMoTin: (ten) => noi.push({ loai: 'mo_tin', ten }), nhacCachChot: (vd) => noi.push({ loai: 'cach_chot', vd }), capNhatTon() {}, baoVuaChot() {} },
    bao() {},
  };
  const chot = new ChotDon({ phat, layKetNoi, nhaCungCap, gomMs: 0, nhacMoTinMs: 0, phongAi });
  const director = [];
  const phong = new PhongLive({ layKetNoi, phat, ai: { nhanBinhLuan: (bl) => director.push(bl), ketThuc() {} } });
  phong.chotDon = chot;
  ht.batDau();
  t.after(() => { ht.dung(); chot.dung(); phong.dongLuong(); });
  require('../server/nghiep-vu/cai-dat').datBanHang({ sdt_shop: '0987 654 321' });
  const mau = taoSanPhamMau({ gia: '159k' }); // áo 12, Đen/Trắng × M/L, mỗi ô 5
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: cheDo === 'doi' ? 'goi_y' : cheDo });
  if (cheDo === 'doi') csdl().prepare('UPDATE phien_live SET doi_ai = 1 WHERE id = ?').run(p.id);
  fb.batDauLive();
  await phong.quet();
  const binhLuan = async (ten, noiDung, o = {}) => {
    const truoc = live.demBinhLuan(p.id).tong;
    fb.themBinhLuan({ ten, noi_dung: noiDung, ...o });
    for (let i = 0; i < 200 && live.demBinhLuan(p.id).tong === truoc; i++) await cho(2);
    await cho(5);
    await chot.choXong();
    await ht.choXong();
    return live.binhLuanGanDay(p.id, 1)[0];
  };
  const tinCua = (ten) => fb.luongChat('page_gia', fb.psidCua('page_gia', ten)).filter((x) => x.tu === 'page');
  const bam = async (ten, tieuDe) => {
    const the = [...fb.luongChat('page_gia', fb.psidCua('page_gia', ten))].reverse().find((x) => x.tu === 'page' && x.nut?.some((n) => n.tieu_de === tieuDe));
    const n = the.nut.find((x) => x.tieu_de === tieuDe);
    fb.khachBam({ psid: fb.psidCua('page_gia', ten), payload: n.payload, tieu_de: n.tieu_de });
    await cho(10);
    await ht.choXong();
  };
  // Thẻ gửi "4 phút trước" (lùi giờ trong cơ sở dữ liệu thay vì chờ thật).
  const lui = (phut) => csdl().prepare('UPDATE luot_nhan_rieng SET luc = ?').run(new Date(Date.now() - phut * 60e3).toISOString());
  return { fb, live, p, mau, chot, ht, phong, binhLuan, tinCua, bam, suKien, chen, noi, director, lui, csdl, goiAi: () => goiAi };
}

const chat = (x, ten) => x.fb.luongChat('page_gia', x.fb.psidCua('page_gia', ten)).filter((y) => y.tu === 'page');
const TK = { ngan_hang: '970436', so_tk: '0011 0012 34567', ten_chu_tk: 'Nguyễn Văn A' };

/** Fetch giả của VietQR: ghi lại địa chỉ; kieu 'ok' (PNG) · 'loi' (ném lỗi) · 'treo' (không bao giờ trả, chỉ dừng khi bị hủy). */
function fetchGia(kieu = 'ok') {
  const goi = [];
  const { ANH_GIA } = require('./ho-tro');
  require('../server/vietqr').datFetch((url, o) => {
    goi.push(url);
    if (kieu === 'loi') return Promise.reject(new Error('mất mạng'));
    if (kieu === 'treo') return new Promise((_, loi) => o?.signal?.addEventListener('abort', () => loi(new Error('huy'))));
    return Promise.resolve({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => ANH_GIA });
  });
  return goi;
}

/** Khách chốt → bấm Giữ → MOZA ghi đủ tên / số / địa chỉ → thẻ đơn. */
async function coTheDon(x, ten = 'Nguyễn Lan', sdt = '0912345678') {
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  await x.binhLuan(ten, 'chốt 12 đen M');
  await x.bam(ten, 'Giữ, lên đơn');
  const psid = x.fb.psidCua('page_gia', ten);
  const h = hopThu.layHoiThoai(hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === psid).id);
  const d0 = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
  require('../server/nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: d0, ten, sdt, diaChi: '12 Lý Thái Tổ, Bắc Ninh' });
  const g = await require('../server/gui-the-don').guiTheDon({ d: don.layDon(d0.id), layKetNoi: () => x.fb });
  assert.ok(g.da_gui, g.ly_do);
  return { d: don.layDon(d0.id), h: hopThu.layHoiThoai(h.id) };
}

test('Cài đặt: ngân hàng chọn từ danh sách, STK chỉ chữ số; đủ 3 ô mới có tài khoản; URL QR chỉ có dữ liệu shop, tên bỏ dấu', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const vietqr = require('../server/vietqr');
  const { dongCaiDat } = require('../server/agent/kiem-tra/kiem-tra');
  assert.equal(caiDat.taiKhoanNhanTien(), null);
  assert.ok(caiDat.danhSachNganHang().length >= 30 && caiDat.danhSachNganHang().some((x) => x.bin === '970436' && x.ten_ngan === 'Vietcombank'));
  assert.throws(() => caiDat.datBanHang({ ngan_hang: '123' }), /chọn từ danh sách/);
  assert.throws(() => caiDat.datBanHang({ so_tk: '0011-abc' }), /chữ số/);
  assert.throws(() => caiDat.datBanHang({ so_tk: '12345' }), /6–19/);
  caiDat.datBanHang({ ngan_hang: '970436', so_tk: '0011 0012 34567' });
  assert.equal(caiDat.banHang().so_tk, '0011001234567');
  assert.equal(caiDat.taiKhoanNhanTien(), null, 'thiếu tên chủ TK');
  caiDat.datBanHang({ ten_chu_tk: 'Nguyễn Văn A' });
  assert.deepEqual(caiDat.taiKhoanNhanTien(), { bin: '970436', ten_ngan: 'Vietcombank', so_tk: '0011001234567', ten_tk: 'NGUYỄN VĂN A' });
  const url = vietqr.urlQr(caiDat.taiKhoanNhanTien(), { soTien: 159000, ma: 'DH-0042' });
  assert.equal(url, 'https://img.vietqr.io/image/970436-0011001234567-compact2.png?amount=159000&addInfo=DH0042&accountName=NGUYEN%20VAN%20A');
  assert.match(dongCaiDat().join('\n'), /Tài khoản nhận tiền: Vietcombank, tên NGUYỄN VĂN A — số tài khoản và mã QR chỉ gửi bằng công cụ gui_ma_chuyen_khoan/);
  assert.doesNotMatch(dongCaiDat().join('\n'), /0011001234567/, 'số tài khoản không vào nguồn của AI');
});

test('thẻ đơn: đủ tài khoản → 3 nút ≤ 20 ký tự (Nhận hàng trả tiền / Chuyển khoản / Sửa đơn); thiếu → 2 nút như #89', async (t) => {
  const x = await dung(t);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  await coTheDon(x, 'Trần Hoa', '0912000111');
  assert.deepEqual(chat(x, 'Trần Hoa').at(-1).the.nut.map((n) => n.tieu_de), ['✅ Xác nhận đơn', '✏️ Sửa đơn']);
  caiDat.datBanHang(TK);
  await coTheDon(x, 'Lê Mai', '0912000222');
  const the = chat(x, 'Lê Mai').at(-1).the;
  assert.deepEqual(the.nut.map((n) => n.tieu_de), ['✅ Nhận hàng trả tiền', '💳 Chuyển khoản', '✏️ Sửa đơn']);
  assert.ok(the.nut.every((n) => n.tieu_de.length <= 20), 'độ dài UTF-16 ≤ 20');
  assert.match(the.chu, /Chọn cách trả tiền để shop gửi hàng/);
  assert.doesNotMatch(the.chu, /nhé/);
});

test('bấm Chuyển khoản: Đã xác nhận + chuyển khoản; 1 ảnh QR (URL đúng tổng, mã đơn, không dữ liệu khách) + 1 tin chữ có nút đổi COD; bấm đổi → COD, trạng thái giữ', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang(TK);
  const goi = fetchGia('ok');
  t.after(() => require('../server/vietqr').datFetch(null));
  const don = require('../server/nghiep-vu/don');
  const { d } = await coTheDon(x);
  await x.bam('Nguyễn Lan', '💳 Chuyển khoản');
  const d2 = don.layDon(d.id);
  assert.equal(d2.trang_thai, 'da_xac_nhan');
  assert.equal(d2.thanh_toan, 'chuyen_khoan');
  assert.equal(goi.length, 1);
  const ma = d.ma.replace('-', '');
  assert.match(goi[0], new RegExp(`^https://img\\.vietqr\\.io/image/970436-0011001234567-compact2\\.png\\?amount=${d2.tong_tien}&addInfo=${ma}&accountName=NGUYEN%20VAN%20A$`));
  assert.doesNotMatch(goi[0], /0912345678|84912345678|Lan|L%C3%BD/i, 'không số, tên, địa chỉ khách');
  const [anh, chu] = chat(x, 'Nguyễn Lan').slice(-2);
  assert.equal(anh.the.kieu, 'media');
  assert.match(anh.the.anh.url, /^data:image\/png;base64,/, 'khung chat giả hiện được ảnh');
  assert.match(chu.noi_dung, new RegExp(`Số tài khoản: 0011001234567[\\s\\S]*Nội dung: ${ma}`));
  assert.match(chu.noi_dung, /Quét mã QR ở trên/);
  assert.match(chu.noi_dung, /Shop chỉ nhận tiền vào TK tên NGUYỄN VĂN A/);
  assert.deepEqual(chu.the.nut.map((n) => n.tieu_de), ['🔁 Trả khi nhận hàng', '📞 Gọi shop']);
  await x.bam('Nguyễn Lan', '🔁 Trả khi nhận hàng');
  const d3 = don.layDon(d.id);
  assert.equal(d3.thanh_toan, 'cod');
  assert.equal(d3.trang_thai, 'da_xac_nhan', 'trạng thái đơn không đổi');
  assert.match(chat(x, 'Nguyễn Lan').at(-1).noi_dung, /đổi đơn DH-\d{4} sang trả tiền khi nhận hàng/);
});

test('VietQR lỗi hoặc treo → chỉ tin chữ (chờ ảnh tối đa 5 giây), đơn vẫn Đã xác nhận', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang(TK);
  t.after(() => require('../server/vietqr').datFetch(null));
  const don = require('../server/nghiep-vu/don');
  fetchGia('loi');
  const a = await coTheDon(x, 'Phan Thu', '0912000333');
  await x.bam('Phan Thu', '💳 Chuyển khoản');
  assert.equal(don.layDon(a.d.id).trang_thai, 'da_xac_nhan');
  const cuoiA = chat(x, 'Phan Thu').slice(-2);
  assert.notEqual(cuoiA[0].the?.kieu, 'media');
  assert.match(cuoiA[1].noi_dung, /chuyển theo thông tin trên/);

  fetchGia('treo');
  const b = await coTheDon(x, 'Đỗ Hằng', '0912000444');
  const psid = x.fb.psidCua('page_gia', 'Đỗ Hằng');
  const tin = [...x.fb.luongChat('page_gia', psid)].reverse().find((y) => y.tu === 'page' && y.nut?.some((n) => n.tieu_de === '💳 Chuyển khoản'));
  const bat = Date.now();
  x.fb.khachBam({ psid, payload: tin.nut.find((n) => n.tieu_de === '💳 Chuyển khoản').payload, tieu_de: '💳 Chuyển khoản' });
  for (let i = 0; i < 800 && !/chuyển theo thông tin trên/.test(chat(x, 'Đỗ Hằng').at(-1).noi_dung); i++) await cho(10);
  const ms = Date.now() - bat;
  assert.ok(ms >= 4900 && ms < 7000, `chờ ảnh tối đa 5 giây (${ms} ms)`);
  assert.equal(don.layDon(b.d.id).trang_thai, 'da_xac_nhan');
  assert.ok(!chat(x, 'Đỗ Hằng').some((y) => y.the?.kieu === 'media'));
});

test('Đã nhận tiền: trong 24 giờ MOZA báo bằng câu mẫu, ngoài 24 giờ không gửi; câu AI "shop đã nhận tiền" bị K12 chặn; đếm chờ đối chiếu', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang(TK);
  fetchGia('ok');
  t.after(() => require('../server/vietqr').datFetch(null));
  const don = require('../server/nghiep-vu/don');
  const ck = require('../server/chuyen-khoan');
  const a = await coTheDon(x, 'Vũ An', '0912000555');
  await x.bam('Vũ An', '💳 Chuyển khoản');
  const b = await coTheDon(x, 'Hà Vy', '0912000666');
  await x.bam('Hà Vy', '💳 Chuyển khoản');
  const dem = () => don.danhSach({ chuaNhanTien: true, thanhToan: 'chuyen_khoan', dienTap: null }).filter((y) => ['da_xac_nhan', 'da_gui', 'da_giao'].includes(y.trang_thai)).length;
  assert.equal(dem(), 2);
  const r1 = await ck.baoDaNhanTien({ d: don.nhanTien(a.d.id), layKetNoi: () => x.fb });
  assert.ok(r1.da_gui, r1.ly_do);
  assert.match(chat(x, 'Vũ An').at(-1).noi_dung, /^Dạ shop đã nhận \d{1,3}(\.\d{3})*đ cho đơn DH-\d{4}/);
  x.csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE id = ?').run(new Date(Date.now() - 25 * 3600e3).toISOString(), b.h.id);
  const truoc = chat(x, 'Hà Vy').length;
  const r2 = await ck.baoDaNhanTien({ d: don.nhanTien(b.d.id), layKetNoi: () => x.fb });
  assert.equal(r2.da_gui, false);
  assert.equal(chat(x, 'Hà Vy').length, truoc, 'ngoài 24 giờ không gửi gì');
  assert.equal(dem(), 0);
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  const k12 = (cau) => kiemTraCau({ cau, kenh: 'messenger' }).loi.some((l) => l.ma === 'K12');
  for (const cau of ['Dạ shop đã nhận tiền của bạn rồi nha', 'Mình vừa nhận được chuyển khoản ạ', 'Chuyển khoản thành công rồi bạn', 'Tiền đã về tài khoản shop rồi', 'Shop nhận được tiền rồi nha']) {
    assert.ok(k12(cau), cau);
  }
  for (const cau of ['Khi đã nhận tiền shop sẽ báo lại bạn', 'Bạn chuyển xong shop kiểm tra rồi báo lại nha']) assert.ok(!k12(cau), cau);
});

test('khách từng hoàn ≥ ngưỡng bấm Chuyển khoản → không xác nhận, không QR, việc Gọi xác nhận đơn', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang(TK);
  const goi = fetchGia('ok');
  t.after(() => require('../server/vietqr').datFetch(null));
  const don = require('../server/nghiep-vu/don');
  const { d } = await coTheDon(x, 'Mạc Tú', '0912000777');
  for (let i = 0; i < 2; i++) {
    const cu = don.taoDon({ mon: [{ phan_loai_id: x.mau.pl('Trắng', 'L').id, so_luong: 1 }], nguon: 'tin_nhan', khachId: d.khach_id });
    x.csdl().prepare("UPDATE don SET trang_thai = 'hoan' WHERE id = ?").run(cu.id);
  }
  await x.bam('Mạc Tú', '💳 Chuyển khoản');
  assert.equal(don.layDon(d.id).trang_thai, 'cho_xac_nhan');
  assert.equal(goi.length, 0);
  assert.match(chat(x, 'Mạc Tú').at(-1).noi_dung, /gọi xác nhận nhanh rồi mới gửi thông tin chuyển khoản/);
  const viec = x.csdl().prepare("SELECT * FROM viec WHERE loai = 'goi_xac_nhan_don'").all();
  assert.equal(viec.length, 1);
  assert.match(viec[0].noi_dung, /chọn chuyển khoản/);
});

test('công cụ gui_ma_chuyen_khoan (Tư vấn viên): đơn COD → lỗi kèm cách sửa; đơn chuyển khoản → ảnh + tin; đã cấp cho tu_van', async (t) => {
  const x = await dung(t);
  require('../server/nghiep-vu/cai-dat').datBanHang(TK);
  const goi = fetchGia('ok');
  t.after(() => require('../server/vietqr').datFetch(null));
  const { thucHienCongCu } = require('../server/agent/thuc-hien');
  const agent = require('../server/nghiep-vu/cai-dat').danhSachAgent().find((a) => a.id === 'tu_van');
  assert.ok(agent.cong_cu.includes('gui_ma_chuyen_khoan'), 'tu_van có công cụ');
  const { d, h } = await coTheDon(x, 'Ngô Linh', '0912000888');
  const nguCanh = { hoiThoaiId: h.id, layKetNoi: () => x.fb };
  const kq1 = await thucHienCongCu({ ten: 'gui_ma_chuyen_khoan', thamSo: {}, agent, nguCanh });
  assert.equal(kq1.loi?.ma, 'DON_CHUA_CHON_CK');
  assert.match(kq1.loi.thong_diep, /cap_nhat_don thong_tin_giao thanh_toan chuyen_khoan/);
  require('../server/nghiep-vu/don').datThongTinGiao(d.id, { thanhToan: 'chuyen_khoan' });
  const kq2 = await thucHienCongCu({ ten: 'gui_ma_chuyen_khoan', thamSo: {}, agent, nguCanh });
  assert.ok(kq2.ketQua?.da_gui, JSON.stringify(kq2.loi));
  assert.equal(goi.length, 1);
  const [anh, chu] = chat(x, 'Ngô Linh').slice(-2);
  assert.equal(anh.the.kieu, 'media');
  assert.match(chu.noi_dung, /Số tài khoản: 0011001234567/);
});
