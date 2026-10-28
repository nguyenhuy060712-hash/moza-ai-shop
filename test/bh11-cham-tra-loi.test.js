'use strict';

/**
 * Chạm để trả lời (SPEC.md F-115): chạm một bình luận → một câu trên thẻ gợi ý kèm binh_luan_id (AI giả ≤ 2 giây); câu có số lạ →
 * Bộ kiểm tra chặn → "Mai chưa chắc"; hỏi size có số đo → tư vấn size bằng mã, chạy cả khi Dừng AI; Dừng AI → câu khác bị từ chối;
 * Co-host dùng lưu đệm 12 giờ; [Mai nói] ở Chỉ gợi ý báo tự đọc; đăng trả lời dưới bình luận qua công cụ tra_loi_binh_luan. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

async function dung(t) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const { PhongAi } = require('../server/phong-ai');
  const { TuVanSize } = require('../server/tu-van-size');
  taoSanPhamMau(); // áo 12 · Sơ mi linen tay ngắn 289.000đ, bảng size "Áo test" (M 155–162/48–55)
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh(); // [mở đầu, áo 12, quần 15, kết thúc]
  const goi = [];
  let cau = () => ({ cau: 'Dạ áo này vải linen mát, mặc đi làm rất hợp.', trich_dan: [] });
  const nha = { async goi(o) { goi.push(o); return { goiCongCu: [], chu: JSON.stringify(cau(o)), goc: null, tokenVao: 500, tokenRa: 40 }; } };
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const ai = new PhongAi({ phat, nhaCungCap: { gemini: nha, openai: nha, anthropic: nha }, gioiHan: { cohost: { giay: 2 } } });
  const p0 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ? WHERE id = ?").run(new Date().toISOString(), p0.id);
  live.doiDoan(p0.id, 1); // đang nói áo 12
  ai.datLai(p0.id);
  t.after(() => ai.datLai(null));
  const tvs = new TuVanSize({ phat, phongAi: ai });
  let i = 0;
  const binhLuan = (noiDung, ten = 'Nguyễn Lan') => {
    i += 1;
    return live.themBinhLuan(p0.id, { fb_id: `fb_${i}`, nguoi_fb_id: `u_${i}`, ten, noi_dung: noiDung, luc_fb: new Date().toISOString() });
  };
  return { live, caiDat, csdl, ai, tvs, p: live.layPhien(p0.id), binhLuan, goi, suKien, datCau: (f) => { cau = f; } };
}

test('chạm → một câu trên thẻ kèm binh_luan_id, ≤ 2 giây; Co-host lưu đệm 12 giờ, câu 1–2 câu ngắn; Director không giao lại bình luận này', async (t) => {
  const x = await dung(t);
  const bl = x.binhLuan('áo này mặc đi làm được không shop?');
  const bd = Date.now();
  const kq = await x.ai.traLoiBinhLuan(x.p.id, bl.id, { tuVanSize: x.tvs });
  assert.ok(Date.now() - bd < 2000);
  assert.equal(kq.goi_y.noi_dung, 'Dạ áo này vải linen mát, mặc đi làm rất hợp.');
  assert.equal(kq.goi_y.binh_luan_id, bl.id);
  const ws = x.suKien.find((e) => e.type === 'live.goi_y');
  assert.equal(ws.goi_y.binh_luan_id, bl.id);
  assert.equal(x.goi[0].luuDem, '12h');
  assert.match(JSON.stringify(x.goi[0].lichSu), /1–2 câu thật ngắn/);
  assert.match(JSON.stringify(x.goi[0].lichSu), /mặc đi làm được không shop/);
  assert.equal(x.live.layBinhLuan(bl.id).xu_ly, 'da_goi_y');
});

test('câu có số lạ → Bộ kiểm tra chặn (2 lần) → "Mai chưa chắc" + dữ liệu liên quan, không hiện thẻ', async (t) => {
  const x = await dung(t);
  x.datCau(() => ({ cau: 'Áo này giá 199 nghìn thôi cả nhà.', trich_dan: [] }));
  const bl = x.binhLuan('áo bao nhiêu tiền vậy?');
  const kq = await x.ai.traLoiBinhLuan(x.p.id, bl.id, { tuVanSize: x.tvs });
  assert.equal(kq.chua_chac, true);
  assert.equal(kq.cau, 'Mai chưa chắc, anh/chị kiểm lại.');
  assert.ok(kq.du_lieu.length >= 1);
  assert.ok(x.goi.length >= 2, 'soạn lại trước khi bỏ');
  assert.ok(!x.suKien.some((e) => e.type === 'live.goi_y'));
  assert.ok(x.suKien.some((e) => e.type === 'live.goi_y_chua_chac'));
});

test('hỏi size có số đo → câu bằng mã (không gọi AI), chạy cả khi Dừng AI; câu khác khi Dừng AI → từ chối', async (t) => {
  const x = await dung(t);
  x.caiDat.datDungAi(true, { ma: 'VUOT_MUC_TRAN', thong_diep: 'thử' });
  const bl = x.binhLuan('1m58 50kg mặc size gì shop', 'Trần Thu Trang');
  const kq = await x.ai.traLoiBinhLuan(x.p.id, bl.id, { tuVanSize: x.tvs });
  assert.equal(kq.tu_van_size, true);
  assert.match(kq.goi_y.noi_dung, /^Trang ơi, theo bảng size của shop thì lấy M/);
  assert.ok(!/158|50kg/.test(kq.goi_y.noi_dung), 'không đọc số đo của khách');
  assert.equal(kq.goi_y.binh_luan_id, bl.id);
  assert.equal(x.goi.length, 0);
  const khac = x.binhLuan('vải có nhăn không?');
  await assert.rejects(x.ai.traLoiBinhLuan(x.p.id, khac.id, { tuVanSize: x.tvs }), /AI đang dừng/);
});

test('[Mai nói] ở Chỉ gợi ý → báo tự đọc; Mai nói cùng có miệng → nói đúng nguyên văn', async (t) => {
  const x = await dung(t);
  const bl = x.binhLuan('form rộng không ạ?');
  const kq = await x.ai.traLoiBinhLuan(x.p.id, bl.id, { tuVanSize: x.tvs });
  assert.throws(() => x.ai.noiGoiY(x.p.id, kq.goi_y.id), /tự đọc/);
  const noi = [];
  x.ai.mieng = { sanSang: () => true, noiNguyenVan: (c) => noi.push(c) };
  x.csdl().prepare("UPDATE phien_live SET che_do_ai = 'noi' WHERE id = ?").run(x.p.id);
  assert.deepEqual(x.ai.noiGoiY(x.p.id, kq.goi_y.id), { da_noi: true });
  assert.deepEqual(noi, [kq.goi_y.noi_dung]);
  assert.throws(() => x.ai.noiGoiY(x.p.id, 'cts_khac'), /đã thay/);
});
