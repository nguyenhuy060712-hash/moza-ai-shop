'use strict';

/**
 * Nhắc đơn, gia hạn gọi xác nhận, báo hủy và [Đặt lại] (SPEC.md F-69, #99). Facebook giả, AI giả — 0 đồng.
 * Mọi tin nhắc / báo hủy do mã soạn: không gọi AI.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

test('nhắc đơn 2 lần, Utility ngoài 24 giờ, gia hạn 12 giờ, báo hủy kèm Đặt lại', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const don = require('../server/nghiep-vu/don');
  const { csdl } = require('../server/db/ket-noi');
  const { FacebookGia } = require('../server/facebook/gia');
  const { HopThuTuDong } = require('../server/hop-thu');
  const lienHe = require('../server/nghiep-vu/lien-he');
  // Test chạy mọi giờ: mở khung nhắn chủ động cả ngày (khung 7h–22h có test riêng).
  Object.assign(lienHe.MAC, { gio_tu: 0, gio_den: 24 });
  t.after(() => Object.assign(lienHe.MAC, { gio_tu: 7, gio_den: 22 }));

  const s = taoSanPhamMau({ so: 12 });
  const fb = new FacebookGia({ tinhHuong: 'de' });
  let soAi = 0;
  const goi = async () => { soAi += 1; return { goiCongCu: [], chu: JSON.stringify({ xong: true, tom_tat: 'ok' }), goc: null, tokenVao: 1, tokenRa: 1 }; };
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi: () => fb, nhaCungCap: { gemini: { goi }, openai: { goi }, anthropic: { goi } }, gomMs: 20, chuKyMs: 3600000 });
  fb.on('su_kien', ht.ngheGia);
  t.after(() => ht.dung());

  const luc = (ms) => new Date(Date.now() + ms).toISOString();
  const GIO = 3600e3;
  const chat = (ten) => fb.luongChat('page_gia', fb.psidCua('page_gia', ten)).filter((x) => x.tu === 'page');

  /** Khách nhắn một câu, shop trả lời (25 phút trước), rồi có đơn. */
  async function coDon(ten, { du = false } = {}) {
    const e = fb.khachNhan({ ten, noi_dung: 'lấy áo 12 đen M' });
    await ht.choXong();
    const h = hopThu.danhSach({ dienTap: true }).find((x) => x.fb_thread_id === e.psid);
    const tk = hopThu.tinCuaHoiThoai(h.id).find((x) => x.gui_boi === 'khach');
    csdl().prepare('UPDATE tin_nhan SET luc = ? WHERE id = ?').run(luc(-30 * 60e3), tk.id);
    const r = hopThu.ghiTinRa({ hoiThoaiId: h.id, guiBoi: 'ai', noiDung: 'Dạ shop giữ áo cho mình rồi.', khoa: `tl:${h.id}` });
    hopThu.capNhatGui(r.tin.id, { trangThai: 'da_gui' });
    csdl().prepare('UPDATE tin_nhan SET luc = ? WHERE id = ?').run(luc(-25 * 60e3), r.tin.id);
    const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'tin_nhan', pageId: 'page_gia', hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, dienTap: true,
      ...(du ? { tenNhan: ten, sdtNhan: '+84912000111', diaChiNhan: '12 Lý Thái Tổ, Bắc Ninh' } : {}) });
    return { e, h, d };
  }

  await t.test('đủ thông tin: lần 1 là thẻ đơn có nút + trả lời nhanh Không lấy; lần 2 khi còn 2 giờ giữ; không quá 2 lần; 0 lượt AI', async () => {
    const { d } = await coDon('Lan', { du: true });
    const ai0 = soAi;
    const n0 = chat('Lan').length;
    await ht.nhacDon();
    const t1 = chat('Lan').slice(n0);
    assert.equal(t1.length, 1);
    assert.match(t1[0].noi_dung, new RegExp(`Đơn ${d.ma} · 289\\.000đ đang chờ bạn xác nhận`));
    assert.ok(t1[0].nut.some((x) => x.payload.startsWith('XAC_NHAN_DON|')), 'có nút Xác nhận đơn');
    assert.ok(t1[0].nut.some((x) => x.tieu_de === 'Không lấy'), 'có trả lời nhanh Không lấy');
    assert.equal(don.layDon(d.id).nhac_lan, 1);
    await ht.nhacDon();
    assert.equal(chat('Lan').length, n0 + 1, 'chưa tới lần 2');
    // Còn 1 giờ giữ, lần 1 đã cách 3 giờ → lần 2.
    csdl().prepare('UPDATE don SET giu_den = ?, nhac_cuoi_luc = ? WHERE id = ?').run(luc(GIO), luc(-3 * GIO), d.id);
    await ht.nhacDon();
    assert.equal(chat('Lan').length, n0 + 2);
    assert.equal(don.layDon(d.id).nhac_lan, 2);
    csdl().prepare('UPDATE don SET nhac_cuoi_luc = ? WHERE id = ?').run(luc(-3 * GIO), d.id);
    await ht.nhacDon();
    assert.equal(chat('Lan').length, n0 + 2, 'tối đa 2 lần nhắc');
    assert.equal(soAi, ai0, 'nhắc do mã soạn');
    don.doiTrangThai(d.id, 'da_huy', { nguon: 'nguoi' });
  });

  await t.test('lần 2 ngoài 24 giờ → mẫu Utility "đơn đang chờ xác nhận"; lần 1 ngoài 24 giờ → không gửi', async () => {
    const { h, d } = await coDon('Hoa', { du: true });
    csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE id = ?').run(luc(-25 * GIO), h.id);
    const n0 = chat('Hoa').length;
    await ht.nhacDon();
    assert.equal(chat('Hoa').length, n0, 'lần 1 chỉ trong 24 giờ');
    csdl().prepare('UPDATE don SET nhac_lan = 1, nhac_cuoi_luc = ?, giu_den = ? WHERE id = ?').run(luc(-3 * GIO), luc(GIO), d.id);
    await ht.nhacDon();
    const moi = chat('Hoa').slice(n0);
    assert.equal(moi.length, 1);
    assert.equal(moi[0].utility, 'moza_don_cho_xac_nhan');
    assert.equal(don.layDon(d.id).nhac_lan, 2);
    don.doiTrangThai(d.id, 'da_huy', { nguon: 'nguoi' });
  });

  await t.test('hết giờ giữ, đơn đủ thông tin chưa bấm → gia hạn 12 giờ một lần + việc "Gọi xác nhận đơn"; hết lần nữa thì hủy', async () => {
    const { d } = await coDon('Minh', { du: true });
    csdl().prepare('UPDATE don SET giu_den = ? WHERE id = ?').run(luc(-60e3), d.id);
    const huy = don.huyQuaGio();
    assert.equal(huy.length, 0);
    assert.equal(huy.gia_han.map((x) => x.id).join(), d.id);
    const x = don.layDon(d.id);
    assert.equal(x.trang_thai, 'cho_xac_nhan');
    assert.ok(new Date(x.giu_den).getTime() > Date.now() + 11 * GIO);
    const viec = csdl().prepare('SELECT * FROM viec WHERE don_id = ?').all(d.id);
    assert.deepEqual(viec.map((v) => v.loai), ['goi_xac_nhan_don']);
    assert.match(viec[0].noi_dung, /0912\*\*\*111/, 'số điện thoại che bớt');
    csdl().prepare('UPDATE don SET giu_den = ? WHERE id = ?').run(luc(-60e3), d.id);
    assert.equal(don.huyQuaGio().length, 1);
    assert.equal(don.layDon(d.id).trang_thai, 'da_huy');
  });

  await t.test('đơn thiếu thông tin quá giờ → hủy; báo khách một lần kèm [Đặt lại]; bấm → đơn mới giữ hàng', async () => {
    // Đơn của Minh vừa hủy ở bước trên cũng đang chờ báo: báo luôn một lần.
    const { e, d } = await coDon('Tú');
    csdl().prepare('UPDATE don SET giu_den = ? WHERE id = ?').run(luc(-60e3), d.id);
    assert.equal(don.huyQuaGio().length, 1);
    const ai0 = soAi;
    const n0 = chat('Tú').length;
    await ht.nhacDon();
    const bao = chat('Tú').slice(n0);
    assert.equal(bao.length, 1);
    assert.match(bao[0].noi_dung, new RegExp(`Đơn ${d.ma} đã hủy vì quá giờ giữ`));
    const nut = bao[0].nut.find((x) => x.payload.startsWith('DAT_LAI|'));
    assert.ok(nut, 'có nút Đặt lại');
    assert.ok(don.layDon(d.id).bao_huy_luc);
    await ht.nhacDon();
    assert.equal(chat('Tú').length, n0 + 1, 'báo hủy một lần');
    assert.ok(chat('Minh').some((x) => /đã hủy vì quá giờ giữ/.test(x.noi_dung)), 'đơn đủ thông tin hủy sau gia hạn cũng được báo');

    fb.khachBam({ psid: e.psid, payload: nut.payload, tieu_de: nut.tieu_de });
    await cho(50);
    await ht.choXong();
    const moi = don.danhSach({ dienTap: true }).find((x) => x.ghi_chu === `Đặt lại từ ${d.ma}` || (x.id !== d.id && x.nguoi_fb_id === d.nguoi_fb_id && x.trang_thai === 'cho_xac_nhan'));
    assert.ok(moi, 'có đơn mới');
    assert.equal(moi.trang_thai, 'cho_xac_nhan');
    assert.match(chat('Tú').at(-1).noi_dung, new RegExp(`đặt lại đơn ${moi.ma}`));
    assert.equal(soAi, ai0, 'báo hủy và Đặt lại không gọi AI');

    // Bấm lại nút cũ sau 24 giờ → quá hạn.
    csdl().prepare("UPDATE don_lich_su SET luc = ? WHERE don_id = ? AND den = 'da_huy'").run(luc(-25 * GIO), d.id);
    fb.khachBam({ psid: e.psid, payload: nut.payload, tieu_de: nut.tieu_de });
    await cho(50);
    await ht.choXong();
    assert.match(chat('Tú').at(-1).noi_dung, /Nút Đặt lại đã quá 24 giờ/);
  });

  await t.test('Đặt lại lúc món đã hết → báo hết, gợi ý loại còn hàng', async () => {
    const { e, d } = await coDon('Ngân');
    csdl().prepare('UPDATE don SET giu_den = ? WHERE id = ?').run(luc(-60e3), d.id);
    don.huyQuaGio();
    await ht.nhacDon();
    const nut = chat('Ngân').at(-1).nut.find((x) => x.payload.startsWith('DAT_LAI|'));
    csdl().prepare('UPDATE phan_loai SET ton = 0 WHERE id = ?').run(s.pl('Đen', 'M').id);
    fb.khachBam({ psid: e.psid, payload: nut.payload, tieu_de: nut.tieu_de });
    await cho(50);
    await ht.choXong();
    const cuoi = chat('Ngân').at(-1);
    assert.match(cuoi.noi_dung, /vừa hết mất rồi/);
    assert.ok(cuoi.nut?.length, 'có lựa chọn loại khác');
  });
});
