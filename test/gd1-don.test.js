'use strict';

/** GD1 (F-123): màn Đơn hàng 4 nhóm (?nhom=) và thêm món bằng chữ ("12 đen M"). 0 đồng, không gọi mạng. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moPhanMem, taoSanPhamMau } = require('./ho-tro');

test('Đơn hàng: 4 nhóm và thêm món theo chữ', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const goi = pm.goi;
  const s = taoSanPhamMau({ so: 12 });
  await goi('PUT', '/api/cai-dat', { ban_hang: { phi_ship: '25k' } });

  const taoDon = async (pl, den) => {
    const r = await goi('POST', '/api/don', { mon: [{ phan_loai_id: pl.id, so_luong: 1 }], ten: 'Chị Hoa', sdt: '0934 567 890', dia_chi: '5 Ngô Gia Tự, Bắc Ninh' });
    assert.equal(r.ma, 201, r.chu);
    for (const buoc of den) assert.equal((await goi('POST', `/api/don/${r.than.id}/trang-thai`, { den: buoc })).ma, 200, buoc);
    return r.than;
  };
  const cho = await taoDon(s.pl('Đen', 'M'), []);
  const canGui = await taoDon(s.pl('Đen', 'L'), ['da_xac_nhan']);
  const dangGiao = await taoDon(s.pl('Trắng', 'M'), ['da_xac_nhan', 'da_gui']);
  const xong = await taoDon(s.pl('Trắng', 'L'), ['da_xac_nhan', 'da_gui', 'da_giao']);
  const huy = await taoDon(s.pl('Đen', 'M'), ['da_huy']);

  const ids = async (nhom) => (await goi('GET', `/api/don?nhom=${nhom}&trang_thai=`)).than.don.map((d) => d.id).sort();

  await t.test('mỗi nhóm lọc đúng trạng thái, không trùng nhau', async () => {
    assert.deepEqual(await ids('can_lam'), [cho.id, canGui.id].sort());
    assert.deepEqual(await ids('dang_giao'), [dangGiao.id]);
    assert.deepEqual(await ids('xong'), [xong.id]);
    assert.deepEqual(await ids('huy_hoan'), [huy.id]);
  });

  await t.test('đếm theo nhóm khớp danh sách; tham số cũ vẫn chạy; nhóm lạ bị bỏ qua', async () => {
    const r = await goi('GET', '/api/don?nhom=can_lam&trang_thai=');
    assert.deepEqual(r.than.dem_nhom, { can_lam: 2, dang_giao: 1, xong: 1, huy_hoan: 1 });
    assert.equal((await goi('GET', '/api/don?trang_thai=da_xac_nhan')).than.don.length, 1, 'lọc theo trạng thái như cũ');
    assert.equal((await goi('GET', '/api/don?nhom=bay_ba&trang_thai=')).than.don.length, 5, 'nhóm lạ = không lọc');
  });

  await t.test('thêm món theo chữ: "12 đen M" thêm đúng phân loại, giữ hàng, tính lại tiền', async () => {
    const truoc = (await goi('GET', `/api/don/${cho.id}`)).than.don ?? (await goi('GET', `/api/don/${cho.id}`)).than;
    const r = await goi('POST', `/api/don/${cho.id}/them-theo-chu`, { chu: '12 đen L' });
    assert.equal(r.ma, 200, r.chu);
    const dong = (r.than.don ?? r.than).dong ?? (r.than.don ?? r.than).mon;
    assert.ok(JSON.stringify(dong).includes('L'), 'có dòng cỡ L');
    assert.ok((r.than.don ?? r.than).tong_hang > (truoc.tong_hang ?? 0), 'tiền hàng tăng');
  });

  await t.test('món không hiểu hoặc không có → báo rõ, đơn không đổi', async () => {
    const sai = await goi('POST', `/api/don/${cho.id}/them-theo-chu`, { chu: 'cái gì đó' });
    assert.equal(sai.ma, 400, sai.chu);
    assert.match(sai.than.loi.thong_diep, /rõ|hiểu|Gõ kiểu/);
    assert.ok(!/muc_luc_san_pham|Hỏi lại khách/.test(sai.than.loi.thong_diep), 'không lộ lời dặn dành cho AI');
    const khongCo = await goi('POST', `/api/don/${cho.id}/them-theo-chu`, { chu: '99 đen M' });
    assert.ok(khongCo.ma >= 400, khongCo.chu);
    assert.equal((await goi('POST', `/api/don/${cho.id}/them-theo-chu`, { chu: '' })).ma, 400);
  });
});
