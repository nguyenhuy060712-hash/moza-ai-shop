'use strict';

/**
 * Nhắc trên sóng (SPEC.md F-70, #100): mở Tin nhắn chờ (≤ 3 tên, mỗi đơn một lần, câu trung tính), nhắc cách chốt theo tình
 * huống, bình luận "ib / check ib / giá sao", vào từ link m.me?ref=phien_<id>. Facebook giả mới, AI giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

test('câu mẫu trung tính: không câu nào nói khách "chưa trả lời / chưa mở / chưa xác nhận"', () => {
  const cam = /chưa trả lời|chưa mở|chưa xác nhận/i;
  const khach = require('../server/nghiep-vu/cau-mau-khach').tatCa();
  assert.ok(khach.length > 30);
  for (const x of khach) assert.doesNotMatch(x.cau, cam, x.khoa);
  const doi = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'cau-hinh', 'doi-ai-cau-mau.json'), 'utf8'));
  for (const khoa of ['mo_tin_nhan', 'vua_chot', 'nhac_cach_chot']) {
    assert.ok(doi[khoa].length >= 2, khoa);
    for (const luot of doi[khoa]) for (const [, loi] of luot) assert.doesNotMatch(loi, cam, khoa);
  }
  assert.ok(doi.mo_tin_nhan.every((l) => l.some(([, loi]) => /Tin nhắn chờ/.test(loi))));
});

test('mở Tin nhắn chờ: thẻ đã tới ≥ 4 phút mà chưa bấm → ≤ 3 tên mỗi lượt, mỗi đơn một lần; bỏ người ẩn tên, ẩn danh, đã bấm', async (t) => {
  const x = await dung(t, { cheDo: 'doi' });
  for (const ten of ['Trần Thị Hoa', 'Lê Trâm', 'Ngô Vy', 'Phạm Yến', 'Đỗ Quỳnh']) await x.binhLuan(ten, 'chốt 12 đen M');
  await x.binhLuan('Bùi Khánh', 'chốt 12 trắng M ẩn tên giúp em');
  await x.binhLuan('Ai Đó', 'chốt 12 trắng L', { an_danh: true });
  await x.bam('Đỗ Quỳnh', 'Giữ, lên đơn');
  assert.equal(x.chot.nhacMoTin(), null, 'chưa đủ 4 phút');
  x.lui(5);
  const lan1 = x.chot.nhacMoTin();
  assert.deepEqual(lan1, ['Hoa', 'Trâm', 'Vy']);
  const ev = x.suKien.filter((e) => e.type === 'live.nhac_mo_tin');
  assert.deepEqual(ev.at(-1).ten, ['Hoa', 'Trâm', 'Vy']);
  assert.deepEqual(x.chen.at(-1), { khoa: 'mo_tin_nhan', ten: 'Hoa, Trâm, Vy' }, 'Đội AI: câu mẫu mo_tin_nhan');
  assert.deepEqual(x.chot.nhacMoTin(), ['Yến'], 'lượt sau: người còn lại; không lặp người cũ');
  assert.equal(x.chot.nhacMoTin(), null, 'mỗi đơn một lần; Quỳnh đã bấm, Khánh xin ẩn tên, người ẩn danh không đọc');
  assert.equal(x.goiAi(), 0, '0 lượt AI');
});

test('Mai nói (chế độ AI nói): nhắc mở tin qua miệng, câu không lấy lại "vừa chốt"', async (t) => {
  const x = await dung(t, { cheDo: 'noi' });
  await x.binhLuan('Nguyễn Lan', 'chốt 12 đen M');
  x.lui(5);
  assert.deepEqual(x.chot.nhacMoTin(), ['Lan']);
  assert.deepEqual(x.noi.at(-1), { loai: 'mo_tin', ten: 'Lan' });
  assert.equal(x.chen.length, 0);
});

test('nhắc cách chốt: ≥ 3 người mới trong 3 phút → 1 câu, không có câu thứ hai trong 5 phút; món bị hỏi nhiều mà chưa ai chốt; người xem tăng 20%', async (t) => {
  const x = await dung(t, { cheDo: 'doi' });
  x.live.doiDoan(x.p.id, 1); // đang nói áo 12
  await x.binhLuan('Hà', 'hello shop');
  await x.binhLuan('Minh', 'chào cả nhà');
  assert.equal(x.chot.nhacCachChot(), null, 'mới 2 người');
  await x.binhLuan('Tú', 'đẹp quá');
  assert.equal(x.chot.nhacCachChot(), 'nguoi_moi');
  assert.match(x.chen.at(-1).vi_du, /^chốt 12 (đen|trắng) (M|L)$/);
  assert.equal(x.suKien.filter((e) => e.type === 'live.nhac_cach_chot').length, 1);
  await x.binhLuan('Nam', 'hi');
  await x.binhLuan('Long', 'hi');
  await x.binhLuan('Quân', 'hi');
  assert.equal(x.chot.nhacCachChot(), null, 'cách nhau ít nhất 5 phút');
  assert.equal(x.chot.nhacCachChot(Date.now() + 6 * 60e3), null, 'sau 5 phút mà không có tình huống mới → thôi');

  // Món đang nói bị hỏi ≥ 3 lần trong 2 phút, chưa ai chốt (không có người mới).
  x.chot.cachChotCuoi.clear();
  x.csdl().prepare('UPDATE binh_luan_live SET luc_nhan = ?').run(new Date(Date.now() - 10 * 60e3).toISOString());
  await x.binhLuan('Hà', 'áo 12 có size L không ạ');
  await x.binhLuan('Minh', 'áo 12 chất gì vậy?');
  assert.equal(x.chot.nhacCachChot(), null, '2 câu hỏi');
  await x.binhLuan('Hà', 'áo 12 dài bao nhiêu?');
  assert.equal(x.chot.nhacCachChot(), 'hoi_nhieu_chua_chot');

  // Người xem tăng ≥ 20% trong 3 phút.
  x.chot.cachChotCuoi.clear();
  x.csdl().prepare('UPDATE binh_luan_live SET luc_nhan = ?').run(new Date(Date.now() - 10 * 60e3).toISOString());
  x.chot.nguoiXem.clear();
  x.chot.ghiNguoiXem(x.p.id, 100, Date.now() - 4 * 60e3);
  x.chot.ghiNguoiXem(x.p.id, 110);
  assert.equal(x.chot.nhacCachChot(), null, '+10%');
  x.chot.ghiNguoiXem(x.p.id, 125);
  assert.equal(x.chot.nhacCachChot(), 'nguoi_xem_tang');
});

test('"ib": có đơn → thẻ giữ hàng qua bình luận mới, Director không nhận; chưa có đơn → thẻ chọn phân loại món đang nói; 5 phút; "giá sao" vẫn tới Director', async (t) => {
  const x = await dung(t);
  const luot = require('../server/nghiep-vu/luot-nhan-rieng');
  x.live.doiDoan(x.p.id, 1);
  await x.binhLuan('Trần Hoa', 'chốt 12 đen M');
  assert.equal(x.tinCua('Trần Hoa').length, 1);
  const soDir = x.director.length;
  const bl = await x.binhLuan('Trần Hoa', 'check ib shop ơi');
  assert.equal(x.tinCua('Trần Hoa').length, 2, 'thẻ mới qua chính bình luận "check ib"');
  assert.match(x.tinCua('Trần Hoa').at(-1).noi_dung, /Áo 12 Đen\/M · 159\.000đ/);
  assert.equal(luot.lay(bl.fb_id).boi, 'the_ib');
  assert.equal(x.director.length, soDir, 'Director không nhận "ib"');
  await x.binhLuan('Trần Hoa', 'ib');
  assert.equal(x.tinCua('Trần Hoa').length, 2, 'mỗi người một thẻ mỗi 5 phút');

  await x.binhLuan('Lê Minh', 'inbox mình nha');
  const the = x.tinCua('Lê Minh').at(-1);
  assert.ok(the, 'người chưa có đơn nhận thẻ');
  assert.ok(JSON.stringify(the).includes('CHON_PL|'), 'thẻ chọn màu / size của áo 12');
  const kho = require('../server/nghiep-vu/kho');
  assert.equal(kho.conHang(x.mau.san_pham.id).find((y) => y.id === x.mau.pl('Đen', 'M').id).con_ban_duoc, 4, 'ib không tự giữ hàng');

  const soDir2 = x.director.length;
  await x.binhLuan('Phạm Yến', 'giá sao shop');
  assert.equal(x.tinCua('Phạm Yến').length, 1, '"giá sao" cũng nhận thẻ');
  assert.equal(x.director.length, soDir2 + 1, '"giá sao" vẫn tới Director để trả lời trên sóng');
  assert.equal(x.goiAi(), 0);
});

test('link m.me?ref=phien_<id>: người mới (nút Bắt đầu kèm ref) và người cũ (sự kiện giới thiệu) → hỏi Đúng / Không phải; Đúng → đơn gắn đúng người', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  x.fb.meta.th.nhanRiengLive = false; // Facebook không cho nhắn riêng bình luận live → khách vào bằng link m.me
  await x.binhLuan('Nguyễn Thu Hà', 'chốt 12 đen M');
  assert.equal(x.tinCua('Nguyễn Thu Hà').length, 0);
  const d = don.danhSach({ trangThai: 'cho_xac_nhan' })[0];
  const ref = `phien_${x.p.id}`;

  // Người mới: bấm Bắt đầu, ref đi kèm postback.
  const vao = x.fb.khachVaoTuLink({ ten: 'Nguyễn Thu Hà', ref });
  assert.equal(vao.nguoiMoi, true);
  await cho(20);
  await x.ht.choXong();
  const hoi = x.tinCua('Nguyễn Thu Hà').at(-1);
  assert.match(hoi.noi_dung, /có phải là Nguyễn Thu Hà vừa chốt .* trên live không/);
  assert.deepEqual(hoi.nut.map((n) => n.tieu_de), ['Đúng, là mình', 'Không phải']);
  await x.bam('Nguyễn Thu Hà', 'Đúng, là mình');
  const d2 = don.layDon(d.id);
  const h = hopThu.danhSach({}).find((y) => y.kenh === 'messenger' && y.fb_thread_id === vao.psid);
  assert.equal(d2.hoi_thoai_id, h.id, 'đơn gắn vào hội thoại Messenger của người bấm');
  assert.equal(h.nguoi_fb_id, d2.nguoi_fb_id, 'gộp người bình luận với người Messenger');
  assert.ok(d2.khach_bam_luc, 'bấm → giữ dài');
  assert.match(x.tinCua('Nguyễn Thu Hà').at(-1).noi_dung, /tên, số điện thoại/);

  // Người cũ (đã từng nhắn Page) chốt trên live rồi mở link: sự kiện giới thiệu.
  x.fb.khachNhan({ ten: 'Lê Văn Bình', noi_dung: 'shop ơi' });
  await cho(20);
  await x.ht.choXong();
  const aiTruoc = x.goiAi(); // câu 'shop ơi' là tin thường: Tư vấn viên trả lời
  await x.binhLuan('Lê Văn Bình', 'chốt 12 trắng L');
  const truoc = x.tinCua('Lê Văn Bình').length;
  const vao2 = x.fb.khachVaoTuLink({ ten: 'Lê Văn Bình', ref });
  assert.equal(vao2.nguoiMoi, false);
  await cho(20);
  await x.ht.choXong();
  const moi = x.tinCua('Lê Văn Bình').slice(truoc);
  assert.equal(moi.length, 1);
  assert.deepEqual(moi[0].nut.map((n) => n.tieu_de), ['Đúng, là mình', 'Không phải']);
  await x.bam('Lê Văn Bình', 'Không phải');
  assert.match(x.tinCua('Lê Văn Bình').at(-1).noi_dung, /ghi nhận rồi/);
  assert.equal(don.danhSach({ trangThai: 'cho_xac_nhan' }).find((y) => y.ma !== d.ma).hoi_thoai_id === h.id, false);

  // Người mới không khớp ai, hoặc máy làm mất ref → câu chào của nút Bắt đầu (do mã soạn).
  x.fb.khachVaoTuLink({ ten: 'Khách Lạ', ref, mat_ref: true });
  await cho(20);
  await x.ht.choXong();
  assert.match(x.tinCua('Khách Lạ').at(-1).noi_dung, /muốn xem món nào cứ nhắn/);
  assert.equal(x.goiAi(), aiTruoc, 'cả luồng m.me không gọi AI');
});

test('nút giả mạo [Đúng, là mình] (hội thoại chưa từng nhận nút đó) → không gắn đơn của người khác', async (t) => {
  const x = await dung(t);
  const don = require('../server/nghiep-vu/don');
  const nutBam = require('../server/nghiep-vu/nut-bam');
  x.fb.meta.th.nhanRiengLive = false;
  await x.binhLuan('Nguyễn Thu Hà', 'chốt 12 đen M');
  const d = don.danhSach({ trangThai: 'cho_xac_nhan' })[0];
  x.fb.khachNhan({ ten: 'Kẻ Gian', noi_dung: 'hi' });
  await cho(20);
  await x.ht.choXong();
  x.fb.khachBam({ psid: x.fb.psidCua('page_gia', 'Kẻ Gian'), payload: nutBam.taoPayload('DUNG_NGUOI', { phien: x.p.id, don: d.id }), tieu_de: 'Đúng, là mình' });
  await cho(20);
  await x.ht.choXong();
  const d2 = don.layDon(d.id);
  assert.equal(d2.nguoi_fb_id, d.nguoi_fb_id);
  assert.equal(d2.hoi_thoai_id, d.hoi_thoai_id);
});
