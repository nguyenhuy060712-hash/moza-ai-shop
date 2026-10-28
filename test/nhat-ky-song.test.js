'use strict';

/**
 * Nhật ký buổi live — chỉ chữ (SPEC.md F-80, #108): ghi và đọc gộp (nhật ký + câu Co-host + bình luận chốt), tìm chữ, dọn
 * 90 ngày, soát câu Mai bằng mã (số tiền lạ, từ cấm); luật "Mai không tự nói con số" (Câu giá, lời dặn mới, nâng mẫu).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('nhật ký: ghi đủ loại, đọc gộp đúng thứ tự giờ, tìm "150k", soát câu Mai, dọn 90 ngày', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const nk = require('../server/nghiep-vu/nhat-ky-song');
  const don = require('../server/nghiep-vu/don');
  const { csdl } = require('../server/db/ket-noi');
  const { MiengCuaMai } = require('../server/agent/mieng/mieng');
  const s = taoSanPhamMau({ gia: '159k' });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  const luc = (giay) => new Date(Date.now() - 600e3 + giay * 1000).toISOString();

  nk.ghi({ phienId: p.id, loai: 'nguoi_dan', noiDung: 'Chào cả nhà, hôm nay shop lên áo 12', luc: luc(1) });
  nk.ghi({ phienId: p.id, loai: 'man_hinh', noiDung: 'Chiếu giới thiệu áo số 12 · 159.000đ (AI)', luc: luc(2) });
  nk.ghi({ phienId: p.id, loai: 'doi_ai', noiDung: 'Hằng: Áo 12 mát lắm cả nhà', luc: luc(3) });
  nk.ghi({ phienId: p.id, loai: 'su_kien', noiDung: 'Bình chọn: Be hay Đen', luc: luc(4) });
  // Mai giả nói sai giá (150 nghìn khi giá 159.000đ), rồi nói đúng giá, rồi dùng từ cấm.
  const ghiMai = (chu) => MiengCuaMai.prototype.ghiCauMai.call({}, { phienId: p.id, chuMai: chu, chuMaiDaGhi: false });
  ghiMai('Áo 12 giá 150 nghìn thôi nha cả nhà');
  ghiMai('Áo 12 giá một trăm năm mươi chín nghìn');
  ghiMai('Hàng xuất khẩu xịn luôn');
  live.themCauTrenSong({ phienId: p.id, cauHoi: 'áo 12 size gì', so: 12, noiDung: 'Theo bảng size thì lấy M nha' });
  const bl = live.themBinhLuan(p.id, { fb_id: 'c1', nguoi_fb_id: 'u1', ten: 'Trần Hoa', noi_dung: 'chốt 12 đen M', luc_fb: luc(5) });
  const d = don.taoDon({ mon: [{ phan_loai_id: s.pl('Đen', 'M').id }], nguon: 'binh_luan_live', phienLiveId: p.id, binhLuanId: bl.id, dienTap: true });
  live.ganChot(bl.id, { donId: d.id });

  const ds = nk.doc(p.id);
  const loai = new Set(ds.map((x) => x.loai));
  for (const k of ['nguoi_dan', 'man_hinh', 'doi_ai', 'su_kien', 'mai', 'cohost', 'chot']) assert.ok(loai.has(k), k);
  const luc2 = ds.map((x) => x.luc);
  assert.deepEqual(luc2, [...luc2].sort(), 'đúng thứ tự giờ');
  assert.match(ds.find((x) => x.loai === 'chot').noi_dung, new RegExp(`Trần Hoa: chốt 12 đen M → ${d.ma}`));
  const mai = ds.filter((x) => x.loai === 'mai');
  assert.deepEqual(mai.map((x) => x.canh_bao), ['so', null, 'tu_cam'], 'sai giá → ⚠ số; đúng giá → không; từ cấm → ⚠');

  const tim = nk.doc(p.id, { q: '150k' });
  assert.equal(tim.length, 0, '"150k" không khớp "150 nghìn" theo chữ');
  csdl().prepare("UPDATE nhat_ky_song SET noi_dung = 'Áo 12 giá 150k thôi' WHERE noi_dung LIKE '%150 nghìn%'").run();
  assert.deepEqual(nk.doc(p.id, { q: '150k' }).map((x) => x.noi_dung), ['Áo 12 giá 150k thôi']);

  // Dọn: dòng cũ hơn 90 ngày bị xóa; bình luận không gắn đơn cùng hạn chỉ xóa chữ, giữ dòng để đếm.
  const cu = new Date(Date.now() - 91 * 86400e3).toISOString();
  nk.ghi({ phienId: p.id, loai: 'nguoi_dan', noiDung: 'câu cũ', luc: cu });
  const bl2 = live.themBinhLuan(p.id, { fb_id: 'c2', nguoi_fb_id: 'u2', ten: 'Lê Minh', noi_dung: 'đẹp quá', luc_fb: cu });
  csdl().prepare('UPDATE binh_luan_live SET luc_nhan = ? WHERE id = ?').run(cu, bl2.id);
  const kq = nk.don();
  assert.equal(kq.nhat_ky, 1);
  assert.equal(kq.binh_luan, 1);
  assert.ok(!nk.doc(p.id).some((x) => x.noi_dung === 'câu cũ'));
  const b2 = live.layBinhLuan(bl2.id);
  assert.equal(b2.noi_dung, '');
  assert.equal(b2.ten, '');
  assert.equal(live.layBinhLuan(bl.id).noi_dung, 'chốt 12 đen M', 'bình luận gắn đơn giữ nguyên');
});

test('luật con số: giao đoạn có "Câu giá" đúng giá thẻ, ≤ 1200 ký tự; lời dặn mới có luật; mẫu cũ chưa sửa tay được nâng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { loiGiaoDoan } = require('../server/agent/mieng/mieng');
  taoSanPhamMau({ gia: '159k' });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'noi', dien_tap: true });
  const cau = loiGiaoDoan(p, 1, { mo: 'mo_man', tenMoi: ['Hoa', 'Trâm', 'Lan'] });
  assert.match(cau, /Câu giá \(đọc đúng nguyên văn\): "Áo số 12 giá 159\.000đ"\./);
  assert.ok(cau.length <= 1200);

  const vaiTro = require('../server/nghiep-vu/vai-tro');
  const mau = require('../server/cau-hinh/loi-dan-mau.json');
  const mauCu = require('../server/cau-hinh/loi-dan-mau-cu.json');
  for (const id of ['mieng', 'mieng_dan']) {
    assert.match(mau[id], /NGUYÊN VĂN "Câu giá"/);
    assert.ok(mauCu[id]?.length, `${id}: có bản cũ để nâng`);
  }
  // Dữ liệu đang chạy còn bản mẫu cũ (chưa sửa tay) → khởi động lại thì được nâng.
  const { csdl } = require('../server/db/ket-noi');
  csdl().prepare("UPDATE vai_tro_ban_sua SET noi_dung = ? WHERE agent_id = 'mieng'").run(mauCu.mieng.at(-1));
  vaiTro.gieoVaiTro();
  assert.match(vaiTro.loiDan('mieng').noi_dung, /NGUYÊN VĂN "Câu giá"/);
});
