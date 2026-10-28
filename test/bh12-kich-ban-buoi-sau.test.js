'use strict';

/**
 * Kịch bản buổi sau (SPEC.md F-117, BH12): bảng từng đoạn do máy đếm khớp số liệu dựng tay (người xem đầu / cuối, người chốt, câu hỏi,
 * ra đơn, người xem bỏ đi); dưới 10 phút số liệu thì không dựng; AI giả nêu số lạ / trái luật / món lạ → bỏ phần đó, món bị quên xếp cuối;
 * dữ liệu gửi AI không có tên, số điện thoại, nguyên văn bình luận; lưu nháp thành kịch bản. AI giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');

const PHUT = 60e3;

function nhaGia(phieu) {
  const goi = [];
  const nha = { async goi(o) { goi.push(o); return { goiCongCu: [], chu: JSON.stringify(phieu), goc: null, tokenVao: 1, tokenRa: 1 }; } };
  return { goi, nhaCungCap: { openai: nha, gemini: nha, anthropic: nha } };
}

/**
 * Buổi thật 30 phút: món 12 (phút 0–11), món 15 (12–19), món 21 (20–29).
 * Người xem: 12: 40 → 38; 15: 38 → 20 (tụt 47 %); 21: 25 → 30. Người chốt: 4 / 1 / 1 (trung bình 2). Câu hỏi: 2 / 3 / 0.
 */
function dung(soPhut = 30) {
  const { csdl } = require('../server/db/ket-noi');
  const live = require('../server/nghiep-vu/live');
  taoSanPhamMau({ so: 12, ten: 'Sơ mi linen tay ngắn' });
  taoSanPhamMau({ so: 15, ten: 'Áo thun cotton form rộng' });
  taoSanPhamMau({ so: 21, ten: 'Quần jean ống suông' });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  const t0 = Date.now() - 60 * PHUT;
  const iso = (ph) => new Date(t0 + ph * PHUT).toISOString();
  const db = csdl();
  db.prepare("UPDATE phien_live SET trang_thai = 'xong', bat_dau = ?, ket_thuc = ? WHERE id = ?").run(iso(0), iso(30), p.id);
  db.prepare('DELETE FROM dong_thoi_gian_san_pham WHERE phien_id = ?').run(p.id);
  const sp = (so) => db.prepare('SELECT id FROM san_pham WHERE so = ?').get(so).id;
  [[12, 0], [15, 12], [21, 20]].forEach(([so, ph], i) => db.prepare('INSERT INTO dong_thoi_gian_san_pham (phien_id, doan, san_pham_id, tu_luc) VALUES (?, ?, ?, ?)').run(p.id, i + 1, sp(so), iso(ph)));
  const xem = (ph) => (ph < 12 ? Math.round(40 - 2 * (ph / 11)) : ph < 20 ? Math.round(38 - 18 * ((ph - 12) / 7)) : Math.round(25 + 5 * ((ph - 20) / 9)));
  for (let ph = 0; ph < soPhut; ph += 1) db.prepare('INSERT INTO so_lieu_phut (phien_id, phut, nguoi_xem) VALUES (?, ?, ?)').run(p.id, ph, xem(ph));
  let i = 0;
  const binhLuan = (ph, noiDung, { chot = false, ten = 'Khách', nguoi } = {}) => {
    i += 1;
    const bl = live.themBinhLuan(p.id, { fb_id: `d${i}`, nguoi_fb_id: nguoi || `u${i}`, ten, noi_dung: noiDung, luc_fb: iso(ph) });
    db.prepare('UPDATE binh_luan_live SET luc_nhan = ?, luc_fb = ?, nhan = ?, xu_ly = ? WHERE id = ?').run(iso(ph), iso(ph), chot ? '[]' : '["cau_hoi"]', chot ? 'da_chot' : 'moi', bl.id);
  };
  for (const ph of [1, 3, 5, 7]) binhLuan(ph, 'chốt 12 đen M', { chot: true, ten: 'Nguyễn Văn Hùng', nguoi: `c${ph}` });
  binhLuan(14, 'chốt 15 trắng L, số em 0912345678', { chot: true, ten: 'Trần Thị Mai Lan' });
  binhLuan(22, 'chốt 21 xanh M', { chot: true });
  binhLuan(2, 'giá bao nhiêu vậy shop?'); binhLuan(4, 'size nào vừa 1m60?');
  binhLuan(13, 'chất vải thế nào?'); binhLuan(15, 'còn màu khác không?'); binhLuan(17, 'ship mấy ngày?');
  return { p, db, sp };
}

test('bảng đoạn: số liệu từng đoạn khớp đếm tay; ra đơn và người xem bỏ đi đánh dấu đúng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { p } = dung();
  const tk = require('../server/nghiep-vu/tong-ket-phien');
  const b = tk.bangDoan(p.id);
  assert.equal(b.du_so_lieu, true);
  assert.equal(b.so_phut, 30);
  assert.deepEqual(b.doan.map((d) => d.so), [12, 15, 21]);
  assert.deepEqual(b.doan.map((d) => d.so_phut), [12, 8, 10]);
  assert.deepEqual(b.doan.map((d) => [d.tu_giay, d.den_giay]), [[0, 720], [720, 1200], [1200, 1800]]);
  assert.deepEqual(b.doan.map((d) => [d.nguoi_xem_dau, d.nguoi_xem_cuoi]), [[40, 38], [38, 20], [25, 30]]);
  assert.deepEqual(b.doan.map((d) => d.nguoi_chot), [4, 1, 1]);
  assert.deepEqual(b.doan.map((d) => d.cau_hoi), [2, 3, 0]);
  assert.deepEqual(b.doan.map((d) => d.ra_don), [true, false, false]);
  assert.deepEqual(b.doan.map((d) => d.bo_di), [false, true, false]); // 38 → 20 tụt 47 %; 40 → 38 chỉ 5 %
  const chu = tk.soLieuDoanChoAi(b);
  assert.match(chu, /Đoạn 2 — số 15 Áo thun cotton form rộng: 8 phút; người xem 38 → 20; 1 người chốt; 3 câu hỏi\. NGƯỜI XEM BỎ ĐI\./);
  assert.match(chu, /các số phút: 8, 10, 12\./);
});

test('bảng đoạn: dưới 10 phút số liệu thì không dựng, không gọi AI', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { p } = dung(9);
  const tk = require('../server/nghiep-vu/tong-ket-phien');
  assert.deepEqual(tk.bangDoan(p.id), { du_so_lieu: false, so_phut: 9, doan: [] });
  const { goi, nhaCungCap } = nhaGia({ ten: 'x', thu_tu: [], loi_mo: { viec: '', vi_sao: '' } });
  const kq = await require('../server/agent/agents/de-xuat-kich-ban').deXuat(p.id, { nhaCungCap });
  assert.equal(kq.it_du_lieu, true);
  assert.equal(goi.length, 0);
});

test('đề xuất: số lạ / trái luật / món lạ bị bỏ, món bị quên xếp cuối; AI không thấy tên, số điện thoại, bình luận', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { p } = dung();
  const { goi, nhaCungCap } = nhaGia({
    ten: 'Buổi sau | Kiểm lại: gì đó',
    thu_tu: [
      { so: 15, so_phut: 8, ly_do: 'Đoạn 2 có 38 → 20 người xem nên rút ngắn' }, // đạt
      { so: 12, so_phut: 7, ly_do: 'Ra đơn nhiều, giữ ở đầu' }, // 7 phút không có trong số liệu → bỏ số phút
      { so: 99, so_phut: 8, ly_do: 'món không có' }, // món lạ → bỏ cả dòng
      { so: 12, so_phut: 12, ly_do: 'lặp' }, // lặp → bỏ
    ],
    loi_mo: { viec: 'Mở đầu bằng món số 12', vi_sao: 'Chốt tăng 37% so với buổi trước' }, // 37 không có trong số liệu → bỏ
  });
  const { deXuat } = require('../server/agent/agents/de-xuat-kich-ban');
  const kq = await deXuat(p.id, { nhaCungCap });
  assert.equal(kq.ten, 'Buổi sau');
  assert.deepEqual(kq.thu_tu.map((x) => x.so), [15, 12, 21]); // 21 bị quên → xếp cuối
  assert.equal(kq.thu_tu[0].so_phut, 8);
  assert.match(kq.thu_tu[0].ly_do, /38 → 20/);
  assert.equal(kq.thu_tu[1].so_phut, null);
  assert.equal(kq.thu_tu[1].ly_do, 'Ra đơn nhiều, giữ ở đầu');
  assert.deepEqual([kq.thu_tu[2].so_phut, kq.thu_tu[2].ly_do], [null, '']);
  assert.equal(kq.loi_mo, null);
  assert.equal(kq.bo, 4); // số 99, số 12 lặp, 7 phút, lời mở có 37%
  // Dữ liệu gửi AI: không tên người, số điện thoại, nguyên văn bình luận.
  assert.equal(goi.length, 1);
  const gui = JSON.stringify(goi[0]);
  for (const cam of ['Nguyễn Văn Hùng', 'Trần Thị Mai Lan', '0912345678', 'giá bao nhiêu', 'chốt 12 đen', 'ship mấy ngày']) assert.ok(!gui.includes(cam), `AI không được thấy "${cam}"`);
  assert.ok(gui.includes('NGƯỜI XEM BỎ ĐI') && gui.includes('Món sẽ bán buổi sau: số 12 Sơ mi linen tay ngắn; số 15'));
});

test('đề xuất: chữ vi phạm luật (khan hiếm giả, giảm giá giả) bị bỏ; chọn món sẽ bán thì chỉ xếp các món đó', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { p } = dung();
  const { nhaCungCap } = nhaGia({
    ten: 'B',
    thu_tu: [{ so: 21, so_phut: 10, ly_do: 'Nói sắp hết hàng để khách chốt nhanh' }, { so: 15, so_phut: 8, ly_do: 'Giảm giá sốc để giữ người xem' }],
    loi_mo: { viec: 'Giữ lời mở', vi_sao: 'Người xem 40 ở đầu buổi' },
  });
  const kq = await require('../server/agent/agents/de-xuat-kich-ban').deXuat(p.id, { monSeBan: [21, 15], nhaCungCap });
  assert.deepEqual(kq.thu_tu.map((x) => [x.so, x.ly_do]), [[21, ''], [15, '']]);
  assert.deepEqual(kq.loi_mo, { viec: 'Giữ lời mở', vi_sao: 'Người xem 40 ở đầu buổi' });
  assert.equal(kq.bo, 2);
});

test('API: đề xuất → lưu thành kịch bản → kịch bản có trong danh sách; thiếu số liệu thì báo ít dữ liệu', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const { p } = dung(9);
  const r = await pm.goi('POST', `/api/live/phien/${p.id}/de-xuat-kich-ban`, {});
  assert.equal(r.ma, 200);
  assert.equal(r.than.it_du_lieu, true);
  const sai = await pm.goi('POST', `/api/live/phien/${p.id}/de-xuat-kich-ban`, { mon_se_ban: ['a'] });
  assert.equal(sai.ma, 400);
  const tkr = await pm.goi('GET', `/api/bao-cao/phien/${p.id}/tong-ket`);
  assert.equal(tkr.than.bang_doan.du_so_lieu, false);
  const luu = await pm.goi('POST', '/api/kich-ban', { ten: 'Kịch bản buổi sau', doan: [{ san_pham_id: null, loi_nhac: '- Mở đầu' }] });
  assert.equal(luu.ma, 201);
  const ds = await pm.goi('GET', '/api/kich-ban');
  assert.ok(ds.than.kich_ban.some((k) => k.ten === 'Kịch bản buổi sau'));
});

test('AI giả (bản xem thử --ai-gia) trả nháp mẫu đủ món, số phút lấy trong số liệu, qua được bước kiểm', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { p } = dung();
  const giaMau = require('../server/agent/nha-cung-cap/gia-mau');
  const nha = { goi: giaMau.goi };
  const kq = await require('../server/agent/agents/de-xuat-kich-ban').deXuat(p.id, { nhaCungCap: { openai: nha, gemini: nha, anthropic: nha } });
  assert.deepEqual(kq.thu_tu.map((x) => x.so), [12, 15, 21]);
  assert.ok(kq.thu_tu.every((x) => x.so_phut === 8 && x.ly_do));
  assert.ok(kq.loi_mo?.viec);
  assert.equal(kq.bo, 0);
});
