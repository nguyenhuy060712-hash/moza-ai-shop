'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { moCSDLTam, moPhanMem } = require('./ho-tro');
const caiDat = require('../server/nghiep-vu/cai-dat');
const { chuyenBanCu } = require('../server/nghiep-vu/chuyen-ban-cu');

test('cài đặt (F-03) và chuyển dữ liệu bản cũ (F-02)', async (t) => {
  const { thuMuc, dong } = await moCSDLTam();
  t.after(dong);

  await t.test('giá trị mặc định', () => {
    assert.equal(caiDat.tenAi(), 'Mai - Trợ lý bán hàng');
    assert.equal(caiDat.khanCap(), false);
    assert.deepEqual(caiDat.mieng(), { model: 'gpt-live-1', giong: { openai: 'marin', gemini: 'Zephyr' } });
  });

  await t.test('Cài đặt → Bán hàng: mặc định; phí ship chưa đặt là null (AI không tự đoán)', () => {
    assert.deepEqual(caiDat.banHang(), {
      ten_shop: '', sdt_shop: '', dia_chi_shop: '', phi_ship: null, mien_phi_tu: null, gio_giu: 24, nguong_sap_het: 3, nguong_hoan: 2,
      gio_giu_ngan: 2, phu_trach: '', xung_ho: 'minh_ban', ten_chu_tk: '', ngan_hang: '', so_tk: '', hoi_so_do: false, gia_live_bat: false, dung_anh_khach: false, gio_nghe_may: '', doi_tra_ngan: '', da_dat: [], nguong_don_lon: 500000, so_ngay_hoi_mac: 4, hang_van_chuyen: 'chung', khi_noi_nham_gia: 'ban_theo_gia_noi',
    });
    assert.equal(caiDat.tenShop(), 'shop', 'chưa đặt tên thì gọi chung là shop');
  });

  await t.test('datBanHang: đọc tiền kiểu "30k", "500.000đ"; ô không gửi giữ nguyên; kiểm giới hạn', () => {
    const kq = caiDat.datBanHang({ ten_shop: '  Moza Shop  ', sdt_shop: '0912 345 678', phi_ship: '30k', mien_phi_tu: '500.000đ' });
    assert.equal(kq.ten_shop, 'Moza Shop');
    assert.equal(kq.phi_ship, 30000);
    assert.equal(kq.mien_phi_tu, 500000);
    assert.equal(kq.gio_giu, 24);
    assert.equal(caiDat.tenShop(), 'Moza Shop');
    const lan2 = caiDat.datBanHang({ gio_giu: 48, nguong_sap_het: 5 });
    assert.deepEqual([lan2.ten_shop, lan2.phi_ship, lan2.gio_giu, lan2.nguong_sap_het], ['Moza Shop', 30000, 48, 5]);
    assert.equal(caiDat.datBanHang({ phi_ship: '' }).phi_ship, null, 'xóa phí ship → về chưa đặt');
    caiDat.datBanHang({ phi_ship: 30000 });
    for (const sai of [{ phi_ship: 'ba chục' }, { gio_giu: 0 }, { gio_giu: 200 }, { nguong_sap_het: -1 }, { nguong_hoan: 0 },
      { ten_shop: 'Hai\ndòng' }, { gio_giu: 1.5 }]) {
      assert.throws(() => caiDat.datBanHang(sai), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE', JSON.stringify(sai));
    }
    assert.equal(caiDat.banHang().gio_giu, 48, 'lỗi thì không ghi gì');
  });

  await t.test('công tắc Dừng mọi thứ', () => {
    caiDat.datKhanCap(true);
    assert.equal(caiDat.khanCap(), true);
    caiDat.datKhanCap(false);
    assert.equal(caiDat.khanCap(), false);
    assert.throws(() => caiDat.datKhanCap('co'), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('miệng: 3 lựa chọn gồm Extended Thinking; giọng phải có thật', () => {
    caiDat.datMieng({ model: 'gemini-3.8-live-extended-thinking' });
    assert.equal(caiDat.mieng().model, 'gemini-3.8-live-extended-thinking');
    caiDat.datMieng({ giong: { gemini: 'Kore' } });
    assert.deepEqual(caiDat.mieng().giong, { openai: 'marin', gemini: 'Kore' });
    assert.throws(() => caiDat.datMieng({ model: 'gpt-realtime-2.1' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => caiDat.datMieng({ giong: { openai: 'khong-co' } }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('sửa Agent: chỉ model có trong danh sách; bỏ được dự phòng', () => {
    const a = caiDat.suaAgent('director', { nha: 'openai', model: 'gpt-6-luna', muc_suy_nghi: 'vua', nha_du_phong: null, model_du_phong: null });
    assert.equal(a.model, 'gpt-6-luna');
    assert.equal(a.nha_du_phong, null);
    assert.equal(caiDat.suaAgent('quan_ly', { nha: 'openai', model: 'gpt-6-astra' }).model, 'gpt-6-astra', 'model mạnh nhất chọn được trong Cài đặt');
    assert.equal(caiDat.suaAgent('soat_san_pham', { nha: 'anthropic', model: 'claude-fable-5-1' }).model, 'claude-fable-5-1');
    assert.throws(() => caiDat.suaAgent('director', { nha: 'openai', model: 'gpt-5.4' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => caiDat.suaAgent('director', { muc_suy_nghi: 'rat_cao' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => caiDat.suaAgent('khong_co', {}), (e) => e.http === 404);
    assert.throws(() => caiDat.suaAgent('soat_tin', {}), (e) => e.http === 404, 'agent soát cũ đã đổi tên');
    assert.ok(caiDat.nhaDangDung().includes('anthropic'), 'Soát sản phẩm dùng Claude nên cần khóa Anthropic');
  });

  await t.test('nhắc sao lưu sau 7 ngày', () => {
    const bayGio = new Date();
    assert.equal(caiDat.trangThaiSaoLuu(bayGio).canNhac, false);
    assert.equal(caiDat.trangThaiSaoLuu(new Date(bayGio.getTime() + 8 * 86400000)).canNhac, true);
    caiDat.ghiSaoLuu('x.db');
    assert.equal(caiDat.trangThaiSaoLuu(new Date(Date.now() + 6 * 86400000)).canNhac, false);
  });

  await t.test('lần đầu có db.json bán hàng cũ: đổi tên giữ lại, chỉ chuyển giọng đã chọn', () => {
    const cu = path.join(thuMuc, 'db.json');
    fs.writeFileSync(cu, JSON.stringify({
      products: { p_1: { name: 'Áo khoác' } },
      settings: { providers: { openai: { model: 'gpt-live-1', voice: 'cedar' }, gemini: { model: 'gemini-3.8-live', voice: 'khong-co-giong-nay' } } },
    }));
    const kq = chuyenBanCu(thuMuc);
    assert.equal(kq.file, 'db.json.ban-hang-cu');
    assert.ok(!fs.existsSync(cu));
    assert.ok(fs.existsSync(path.join(thuMuc, 'db.json.ban-hang-cu')));
    assert.equal(caiDat.mieng().giong.openai, 'cedar');
    assert.equal(caiDat.mieng().giong.gemini, 'Kore', 'giọng không có thật thì bỏ qua, giữ giọng đang đặt');
    assert.equal(chuyenBanCu(thuMuc), null, 'lần sau không làm lại');
  });
});

test('API Cài đặt → Bán hàng', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);

  const dau = await pm.goi('GET', '/api/cai-dat/ban-hang');
  assert.equal(dau.ma, 200);
  assert.equal(dau.than.ban_hang.phi_ship, null);
  assert.equal(dau.than.ban_hang.gio_giu, 24);

  const luu = await pm.goi('PUT', '/api/cai-dat', { ban_hang: { ten_shop: 'Moza Shop', phi_ship: '30k', mien_phi_tu: '1tr' } });
  assert.equal(luu.ma, 200);
  assert.equal(luu.than.ban_hang.phi_ship, 30000);
  assert.equal(luu.than.ban_hang.mien_phi_tu, 1000000);
  assert.equal(luu.than.ten_ai, 'Mai - Trợ lý bán hàng');

  const sau = await pm.goi('GET', '/api/cai-dat/ban-hang');
  assert.deepEqual([sau.than.ban_hang.ten_shop, sau.than.ban_hang.phi_ship], ['Moza Shop', 30000]);

  const sai = await pm.goi('PUT', '/api/cai-dat', { ban_hang: { gio_giu: 0 } });
  assert.equal(sai.ma, 400);
  assert.equal(sai.than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
  assert.equal((await pm.goi('GET', '/api/cai-dat/ban-hang')).than.ban_hang.gio_giu, 24);

  const tq = await pm.goi('GET', '/api/bao-cao/tong-quan');
  assert.equal(tq.than.ban_hang.ten_shop, 'Moza Shop', 'Tổng quan đọc cùng một nguồn cài đặt');
});
