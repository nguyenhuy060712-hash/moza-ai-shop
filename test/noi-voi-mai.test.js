'use strict';

// "Nói với Mai" (SPEC.md F-62, #76): việc đọc trả lời ngay; việc ghi (nhập kho, điều chỉnh, đổi trạng thái) chỉ thành
// bảng xem trước — kho KHÔNG đổi cho tới khi người bấm "Làm"; "Bỏ" thì không ghi gì; lệnh mơ hồ thì không tạo việc chờ.
// Chạy cả khi "Dừng mọi thứ" đang bật (việc người dùng tự gõ). AI giả, không gọi API thật.

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

function nhaGia(kichBan) {
  let i = 0;
  const goi = async (o) => {
    const b = kichBan[Math.min(i, kichBan.length - 1)];
    i += 1;
    const r = typeof b === 'function' ? await b(o) : b;
    return { goiCongCu: [], chu: '', goc: null, tokenVao: 500, tokenRa: 100, ...r };
  };
  return { openai: { goi }, gemini: { goi }, anthropic: { goi } };
}
const goiCC = (ten, thamSo) => ({ goiCongCu: [{ id: `g_${ten}_${Math.random()}`, ten, thamSo }], goc: { gia: true } });
const phieu = (o) => ({ chu: JSON.stringify(o) });

test('Nói với Mai', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { noiVoiMai } = require('../server/agent/agents/quan-ly');
  const { xuLyChoDuyet } = require('../server/agent/thuc-hien');
  const kho = require('../server/nghiep-vu/kho');
  const sp = require('../server/nghiep-vu/san-pham');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const s = taoSanPhamMau({ so: 12 });
  const ton = (gt1, gt2) => kho.conHang(s.san_pham.id).find((p) => p.gt1 === gt1 && p.gt2 === gt2).ton;

  await t.test('nhập kho: bảng xem trước, kho chưa đổi; bấm "Làm" mới cộng', async () => {
    const kq = await noiVoiMai('nhập thêm 10 áo 12 đen M, 5 trắng L', {
      nhaCungCap: nhaGia([
        goiCC('nhap_kho', { dong: [{ so: 12, phan_loai_1: 'Đen', phan_loai_2: 'M', so_luong: 10 }, { so: 12, phan_loai_1: 'trắng', phan_loai_2: 'l', so_luong: 5 }] }),
        phieu({ tra_loi: 'Mai chuẩn bị nhập 2 dòng, anh/chị bấm Làm nhé.', man_hinh: 'kho' }),
      ]),
    });
    assert.equal(kq.viec.length, 1);
    assert.equal(kq.viec[0].hanh_dong, 'nhap_kho');
    assert.equal(kq.viec[0].xem_truoc.length, 2);
    assert.match(kq.viec[0].xem_truoc[0], /12-DEN-M.*\+10 → tồn 15/);
    assert.equal(kq.man_hinh, 'kho');
    assert.equal(ton('Đen', 'M'), 5, 'chưa bấm Làm thì chưa ghi');
    const muc = await xuLyChoDuyet(kq.viec[0].id, true);
    assert.ok(!muc.ket_qua?.loi, JSON.stringify(muc.ket_qua));
    assert.equal(ton('Đen', 'M'), 15);
    assert.equal(ton('Trắng', 'L'), 10);
    assert.deepEqual(kho.doiChieu(), []);
    assert.equal(kho.lichSu({ sanPhamId: s.san_pham.id })[0].ghi_chu, 'qua Mai');
  });

  await t.test('"Bỏ" thì không ghi gì', async () => {
    const kq = await noiVoiMai('kiểm kho áo 12 đen L còn 2', {
      nhaCungCap: nhaGia([goiCC('dieu_chinh_kho', { dong: [{ so: 12, phan_loai_1: 'Đen', phan_loai_2: 'L', ton_moi: 2 }] }), phieu({ tra_loi: 'Bấm Làm để đặt tồn.', man_hinh: 'kho' })]),
    });
    assert.equal(kq.viec.length, 1);
    await xuLyChoDuyet(kq.viec[0].id, false);
    assert.equal(ton('Đen', 'L'), 5);
  });

  await t.test('lệnh mơ hồ (không rõ cỡ): công cụ trả lỗi kèm danh sách, không có việc chờ', async () => {
    let loiThay = null;
    const kq = await noiVoiMai('nhập 3 áo 12 đen', {
      nhaCungCap: nhaGia([
        goiCC('nhap_kho', { dong: [{ so: 12, phan_loai_1: 'Đen', phan_loai_2: '', so_luong: 3 }] }),
        (o) => { loiThay = JSON.stringify(o.lichSu.at(-1)); return phieu({ tra_loi: 'Anh/chị nhập cỡ nào: M hay L?', man_hinh: '' }); },
      ]),
    });
    assert.equal(kq.viec.length, 0);
    assert.match(loiThay, /Đen\/M|Đen\/L/);
    assert.equal(ton('Đen', 'M'), 15);
  });

  await t.test('đổi trạng thái sản phẩm qua Mai cũng chờ "Làm"; chạy được khi đang Dừng mọi thứ', async () => {
    caiDat.datKhanCap?.(true, { ma: 'TEST', thong_diep: 'test' });
    const kq = await noiVoiMai('ngừng bán áo 12', {
      nhaCungCap: nhaGia([goiCC('doi_trang_thai_san_pham', { so: 12, trang_thai: 'ngung_ban' }), phieu({ tra_loi: 'Bấm Làm để ngừng bán áo 12.', man_hinh: 'san_pham' })]),
    });
    assert.equal(kq.viec.length, 1, JSON.stringify(kq));
    assert.equal(sp.layTheoSo(12).trang_thai, 'dang_ban');
    await xuLyChoDuyet(kq.viec[0].id, true);
    assert.equal(sp.layTheoSo(12).trang_thai, 'ngung_ban');
    caiDat.datKhanCap?.(false);
  });

  await t.test('câu hỏi đọc (tồn kho) trả lời ngay, không có việc chờ', async () => {
    const kq = await noiVoiMai('áo 12 còn bao nhiêu', {
      nhaCungCap: nhaGia([goiCC('xem_con_hang', { so: 12 }), phieu({ tra_loi: 'Áo 12 còn Đen/M 15, Trắng/L 10…', man_hinh: 'kho' })]),
    });
    assert.equal(kq.viec.length, 0);
    assert.match(kq.tra_loi, /Áo 12 còn/);
  });
});
