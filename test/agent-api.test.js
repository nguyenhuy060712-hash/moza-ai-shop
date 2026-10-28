'use strict';

/** API màn hình Agent & Skill (SPEC.md mục 8): Skill, lời dặn, Hook, Luật quyền, chờ duyệt, nhật ký, mức trần. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moPhanMem, taoSanPhamMau } = require('./ho-tro');

test('API Agent & Skill', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const { goi } = pm;

  await t.test('trang vận hành: 3 Agent + Người đóng vai + Soát sản phẩm + Đề xuất bài học + Soạn kịch bản + Đọc ảnh + Nói với Mai + Đọc bình luận chốt + Tìm mẫu theo ảnh, chi phí, mức trần mặc định 8 USD/giờ, 15 USD/ngày, 20 USD ngày có live', async () => {
    const { than } = await goi('GET', '/api/agent');
    assert.deepEqual(than.agents.map((a) => a.id), ['director', 'cohost', 'tu_van', 'nguoi_dong_vai', 'soat_san_pham', 'bai_hoc', 'soan_kich_ban', 'doc_anh', 'quan_ly', 'doc_chot', 'tim_mau', 'khach_gia', 'soan_bai', 'tong_ket', 'nhin_mon']);
    assert.deepEqual(than.chi_phi.muc_tran, { gio: 8, ngay: 15, ngay_co_live: 20 });
    assert.equal(than.cho_duyet, 0);
    const moi = await goi('PUT', '/api/muc-tran', { gio: 5, ngay: 12.5 });
    assert.deepEqual(moi.than.muc_tran, { gio: 5, ngay: 12.5, ngay_co_live: 20 });
    assert.equal((await goi('PUT', '/api/muc-tran', { gio: -1 })).than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
  });

  await t.test('Skill: danh sách, lưu nháp, kích hoạt, quay lại; bài thi chưa có (#32)', async () => {
    assert.equal((await goi('GET', '/api/skill')).than.skill.length, 22);
    const nhap = await goi('PUT', '/api/skill/nhuong-loi', { cach_lam: 'Cách mới', vi_du_dung: '', vi_du_sai: '' });
    assert.equal(nhap.than.nhap.phien_ban, 2);
    assert.equal(nhap.than.dang_dung.phien_ban, 1);
    assert.equal((await goi('POST', '/api/skill/nhuong-loi/kich-hoat', {})).than.dang_dung.phien_ban, 2);
    assert.equal((await goi('POST', '/api/skill/nhuong-loi/quay-lai', {})).than.dang_dung.phien_ban, 1);
    assert.equal((await goi('POST', '/api/skill/nhuong-loi/thi', {})).than.loi.ma, 'CHUA_CO');
    assert.equal((await goi('GET', '/api/skill/khong-co')).ma, 404);
  });

  await t.test('lời dặn vai trò: 13 bản mồi bán hàng (thêm Đọc ảnh, Nói với Mai, Đọc bình luận chốt, Tìm mẫu theo ảnh), sửa và kích hoạt', async () => {
    assert.equal((await goi('GET', '/api/vai-tro')).than.vai_tro.length, 17);
    await goi('PUT', '/api/vai-tro/mieng', { noi_dung: 'Bạn là {ten_ai}. Nói ngắn.' });
    const kq = await goi('POST', '/api/vai-tro/mieng/kich-hoat', {});
    assert.equal(kq.than.dang_dung.noi_dung, 'Bạn là {ten_ai}. Nói ngắn.');
  });

  await t.test('Hook: 8 cửa; tắt hook không bắt buộc được, hook bắt buộc thì không', async () => {
    const { than } = await goi('GET', '/api/hook');
    assert.equal(than.cua.length, 8);
    assert.ok(than.cua.find((c) => c.id === 'truoc_cong_cu').hook.every((h) => h.bat_buoc));
    const tat = await goi('PUT', '/api/hook/an_thong_tin_ca_nhan', { bat: false });
    assert.equal(tat.than.cua.find((c) => c.id === 'khi_tin_den').hook.find((h) => h.id === 'an_thong_tin_ca_nhan').bat, false);
    assert.equal((await goi('PUT', '/api/hook/kiem_tra', { bat: false })).than.loi.ma, 'HOOK_BAT_BUOC');
    await goi('PUT', '/api/hook/an_thong_tin_ca_nhan', { bat: true });
  });

  await t.test('Luật quyền: đặt Hỏi / Cấm / về mặc định', async () => {
    const { than } = await goi('GET', '/api/luat-quyen');
    const laySp = than.cong_cu.find((c) => c.ten === 'lay_san_pham');
    assert.equal(laySp.muc, 'cho_phep');
    assert.deepEqual(laySp.ai_dung, ['Director', 'Co-host', 'Tư vấn viên AI']);
    // Việc ghi của "Nói với Mai" mặc định chờ người bấm "Làm" (F-62); lên đơn của Tư vấn viên chạy thẳng (#79).
    for (const ten of ['nhap_kho', 'dieu_chinh_kho', 'doi_trang_thai_san_pham']) assert.equal(than.cong_cu.find((c) => c.ten === ten).muc, 'hoi', ten);
    assert.equal(than.cong_cu.find((c) => c.ten === 'cap_nhat_don').muc, 'cho_phep');
    assert.ok(!than.cong_cu.some((c) => ['lay_tin', 'dat_lich', 'cap_nhat_ung_tuyen'].includes(c.ten)), 'không còn công cụ của bản cũ');
    const doi = await goi('PUT', '/api/luat-quyen', { hanh_dong: 'an_binh_luan', muc: 'hoi' });
    assert.equal(doi.than.cong_cu.find((c) => c.ten === 'an_binh_luan').muc, 'hoi');
    const ve = await goi('PUT', '/api/luat-quyen', { hanh_dong: 'an_binh_luan', muc: null });
    assert.equal(ve.than.cong_cu.find((c) => c.ten === 'an_binh_luan').muc, 'cho_phep');
    assert.equal((await goi('PUT', '/api/luat-quyen', { hanh_dong: 'xoa_het', muc: 'cho_phep' })).ma, 404);
  });

  await t.test('bình luận lộ số khi đang "Dừng mọi thứ" → mục chờ duyệt → duyệt qua API thì ẩn', async () => {
    taoSanPhamMau();
    const kb = (await goi('POST', '/api/kich-ban/tao-nhanh')).than.kich_ban;
    await goi('POST', '/api/live/phien', { kich_ban_id: kb.id, che_do_ai: 'goi_y' });
    await goi('POST', '/api/dien-tap/live', { bat: true });
    for (let i = 0; i < 40 && (await goi('GET', '/api/live/phien/hien-tai')).than.phien?.trang_thai !== 'dang_live'; i++) {
      await new Promise((r) => setTimeout(r, 150));
    }
    await goi('POST', '/api/khan-cap', { bat: true });
    await goi('POST', '/api/dien-tap/binh-luan', { ten: 'Lan', noi_dung: 'sđt em 0912345678' });
    let ds = [];
    for (let i = 0; i < 40 && !ds.length; i++) {
      await new Promise((r) => setTimeout(r, 100));
      ds = (await goi('GET', '/api/cho-duyet')).than.cho_duyet;
    }
    assert.equal(ds.length, 1);
    assert.equal(ds[0].hanh_dong, 'an_binh_luan');
    assert.equal((await goi('GET', '/api/trang-thai')).than.cho_duyet, 1);
    const kq = await goi('POST', `/api/cho-duyet/${ds[0].id}`, { duyet: true });
    assert.equal(kq.than.muc.trang_thai, 'duyet');
    assert.equal(kq.than.muc.ket_qua.ok, true);
    const bl = (await goi('GET', '/api/live/phien/hien-tai')).than.binh_luan[0];
    assert.equal(bl.da_an, true);
    assert.equal((await goi('POST', `/api/cho-duyet/${ds[0].id}`, { duyet: false })).ma, 409);
    await goi('POST', '/api/khan-cap', { bat: false });
    await goi('POST', '/api/dien-tap/live', { bat: false });
  });

  await t.test('nhật ký: danh sách lần chạy, việc ngoài lần chạy (hook), xem một lần chạy không có → 404', async () => {
    const { than } = await goi('GET', '/api/run');
    assert.ok(Array.isArray(than.run));
    assert.ok(than.cong_cu_ngoai_run.some((c) => c.cong_cu === 'an_binh_luan'));
    assert.equal((await goi('GET', '/api/run/run_khongco')).ma, 404);
  });
});
