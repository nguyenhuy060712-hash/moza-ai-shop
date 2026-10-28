'use strict';

/**
 * Messenger một chạm, menu cố định, xóa dữ liệu (SPEC.md F-88, #118). Facebook giả, AI giả — 0 đồng.
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
const cham = async (x, ten, payload, tieuDe) => {
  x.fb.khachChamNhanh({ psid: x.fb.psidCua('page_gia', ten), payload, tieu_de: tieuDe || payload });
  await cho(20);
  await x.ht.choXong();
};

test('bấm Giữ → tin xin thông tin một chạm (nút Gọi shop + trả lời nhanh số Messenger), 0 AI; chọn số → đơn có số, hỏi phần còn thiếu', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  await x.binhLuan('Nguyễn Lan', 'chốt 12 đen M');
  await x.bam('Nguyễn Lan', 'Giữ, lên đơn');
  const tin = chat(x, 'Nguyễn Lan').at(-1);
  assert.match(tin.noi_dung, /giữ Áo 12 Đen\/M cho bạn .*số này chỉ dùng để giao đơn/);
  assert.ok(tin.the.nut.some((n) => n.kieu === 'goi' && n.so === '+84987654321' && /Gọi shop/.test(n.tieu_de)), 'có nút Gọi shop');
  assert.match(JSON.stringify(tin), /Số điện thoại|so_dien_thoai|user_phone/i, 'có trả lời nhanh số Messenger');
  await cham(x, 'Nguyễn Lan', '+84912345678', '0912345678');
  const d = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null })[0];
  assert.equal(d.sdt_nhan, '+84912345678');
  assert.ok(d.khach_id, 'hồ sơ khách tạo theo số');
  assert.match(chat(x, 'Nguyễn Lan').at(-1).noi_dung, /còn thiếu tên người nhận, địa chỉ giao/);
  assert.equal(x.goiAi(), 0, '0 lượt AI');
});

test('[Như đơn trước] chỉ khi có đơn Đã gửi / Đã giao (không đơn Hoàn); bấm → đơn đủ thông tin, thẻ đơn; payload đơn người khác → không ghi', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const nutBam = require('../server/nghiep-vu/nut-bam');
  await x.binhLuan('Trần Hoa', 'chốt 12 đen M');
  const d1 = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null })[0];
  const h = hopThu.danhSach({ dienTap: null }).find((y) => y.nguoi_fb_id === d1.nguoi_fb_id);
  require('../server/nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: d1, ten: 'Trần Thị Hoa', sdt: '0912000111', diaChi: '12 Lý Thái Tổ, Bắc Ninh' });
  don.doiTrangThai(d1.id, 'da_xac_nhan', { nguon: 'nguoi' });
  don.guiNhieu([{ id: d1.id }]);
  don.doiTrangThai(d1.id, 'da_giao', { nguon: 'nguoi' });
  await x.binhLuan('Trần Hoa', 'chốt 12 trắng L');
  await x.bam('Trần Hoa', 'Giữ, lên đơn');
  const tin = chat(x, 'Trần Hoa').at(-1);
  const nut = tin.nut.find((n) => n.tieu_de === 'Như đơn trước');
  assert.ok(nut, 'có Như đơn trước');
  const d2 = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null })[0];
  // Người khác bấm payload đơn của Hoa → không ghi.
  await x.binhLuan('Kẻ Gian', 'hi');
  x.fb.khachNhan({ ten: 'Kẻ Gian', noi_dung: 'shop ơi' });
  await cho(20); await x.ht.choXong();
  x.fb.khachBam({ psid: x.fb.psidCua('page_gia', 'Kẻ Gian'), payload: nutBam.taoPayload('NHU_DON_TRUOC', { don: d2.id }), tieu_de: 'Như đơn trước' });
  await cho(20); await x.ht.choXong();
  assert.equal(don.layDon(d2.id).sdt_nhan, null, 'payload của người khác không ghi gì');
  await cham(x, 'Trần Hoa', nut.payload, 'Như đơn trước');
  const d3 = don.layDon(d2.id);
  assert.equal(d3.dia_chi_nhan, '12 Lý Thái Tổ, Bắc Ninh');
  assert.equal(d3.sdt_nhan, '+84912000111');
  assert.match(chat(x, 'Trần Hoa').at(-1).noi_dung, /Tổng tiền/, 'thẻ đơn được gửi');
});

test('bình luận "chốt 12 đen M 0912345678" → ẩn, đơn có số gợi ý (không tự điền), nút Dùng số 0912***678; hủy → xóa số gợi ý', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const bl = await x.binhLuan('Lê Trâm', 'chốt 12 đen M 0912345678');
  assert.equal(x.live.layBinhLuan(bl.id).da_an, true, 'bình luận lộ số bị ẩn (#19)');
  const d = don.danhSach({ trangThai: 'cho_xac_nhan', dienTap: null })[0];
  assert.equal(d.sdt_goi_y, '+84912345678');
  assert.equal(d.sdt_nhan, null, 'không tự điền');
  await x.bam('Lê Trâm', 'Giữ, lên đơn');
  const nut = chat(x, 'Lê Trâm').at(-1).nut.find((n) => /^Dùng số 0912\*\*\*678$/.test(n.tieu_de));
  assert.ok(nut, 'nút Dùng số 0912***678');
  don.doiTrangThai(d.id, 'da_huy', { nguon: 'nguoi' });
  assert.equal(don.layDon(d.id).sdt_goi_y, null);
});

test('menu cố định: hồ sơ Messenger có 3 mục; Đơn của tôi (số che), Gặp người thật → Cần người, Xóa dữ liệu → xác nhận → việc hạn 72 giờ, chưa tự xóa', async (t) => {
  const x = await dung(t);
  const { hoSoMessenger } = require('../server/nghiep-vu/fb-page');
  const hs = hoSoMessenger();
  assert.deepEqual(hs.persistent_menu[0].call_to_actions.map((c) => [c.type, c.title]), [['postback', 'Đơn của tôi'], ['postback', 'Gặp người thật'], ['postback', 'Xóa dữ liệu của tôi']]);
  await x.fb.datHoSoMessenger({ page_id: 'page_gia', ho_so: hs });
  const nutBam = require('../server/nghiep-vu/nut-bam');
  await x.binhLuan('Phạm Vy', 'chốt 12 đen M');
  x.fb.khachNhan({ ten: 'Phạm Vy', noi_dung: 'shop ơi' });
  await cho(20); await x.ht.choXong();
  const bamMenu = async (ma) => { x.fb.khachBam({ psid: x.fb.psidCua('page_gia', 'Phạm Vy'), payload: nutBam.taoPayload(ma, {}), tieu_de: ma }); await cho(20); await x.ht.choXong(); };
  await bamMenu('MENU_DON');
  assert.match(chat(x, 'Phạm Vy').at(-1).noi_dung, /DH-\d{4} · Chờ xác nhận · 159\.000đ/);
  assert.doesNotMatch(chat(x, 'Phạm Vy').at(-1).noi_dung, /\d{9,}/, 'không số đầy đủ');
  await bamMenu('MENU_NGUOI');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const h = hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === x.fb.psidCua('page_gia', 'Phạm Vy'));
  assert.equal(hopThu.layHoiThoai(h.id).trang_thai, 'can_nguoi');
  await bamMenu('MENU_XOA');
  assert.deepEqual(chat(x, 'Phạm Vy').at(-1).nut.map((n) => n.tieu_de), ['Xác nhận xóa', 'Thôi']);
  await bamMenu('XAC_NHAN_XOA');
  assert.match(chat(x, 'Phạm Vy').at(-1).noi_dung, /xử lý trong 72 giờ/);
  const viec = x.csdl().prepare("SELECT * FROM viec WHERE loai = 'xoa_du_lieu'").all();
  assert.equal(viec.length, 1);
  assert.ok(Math.abs(new Date(viec[0].han_luc) - (Date.now() + 72 * 3600e3)) < 60e3, 'hạn 72 giờ');
  assert.match(viec[0].noi_dung, /Còn 1 đơn chưa xong/);
  assert.ok(require('../server/nghiep-vu/don').danhSach({ dienTap: null }).length >= 1, 'dữ liệu chưa bị xóa tự động');
  assert.equal(x.goiAi() > 0, true, 'chỉ tin "shop ơi" gọi AI');
});
