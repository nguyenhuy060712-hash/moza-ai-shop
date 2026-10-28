'use strict';

/**
 * Tổng kết sau live (SPEC.md F-102) và mốc từng món trong video (F-103): phễu do máy đếm, gợi ý AI có kiểm (số phải có trong số
 * liệu, cấm vùng miền / giới tính / khan hiếm giả, tối đa 3), AI không thấy tên khách; mốc đúng tới giây, đoạn cắt tránh lúc đọc tên,
 * chú thích không có giá. AI giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

function nhaGia(goiY) {
  const goi = [];
  const nha = { async goi(o) { goi.push(o); return { goiCongCu: [], chu: JSON.stringify({ goi_y: goiY }), goc: null, tokenVao: 1, tokenRa: 1 }; } };
  return { goi, nhaCungCap: { openai: nha, gemini: nha, anthropic: nha } };
}

function dung() {
  const live = require('../server/nghiep-vu/live');
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const s = taoSanPhamMau({ gia: '159k', ton: 50 });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  let i = 0;
  const chot = (p, ten, mau = 'Đen', luc = new Date(Date.now() + i).toISOString()) => {
    i += 1;
    const bl = live.themBinhLuan(p.id, { fb_id: `c${i}`, nguoi_fb_id: `u_${ten}`, ten, noi_dung: `chốt 12 ${mau} M`, luc_fb: luc });
    const n = hopThu.nguoiCuaBinhLuan(bl, p);
    const d = don.taoDon({ mon: [{ phan_loai_id: s.pl(mau, 'M').id }], nguon: 'binh_luan_live', phienLiveId: p.id, binhLuanId: bl.id, nguoiFbId: n.id, dienTap: p.dien_tap });
    live.ganChot(bl.id, { donId: d.id });
    return { d, n };
  };
  // Buổi thật đã lên sóng trên Page (giả): có page_id và giờ bắt đầu.
  const moi = (dienTap = false) => {
    const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: dienTap });
    require('../server/db/ket-noi').csdl().prepare("UPDATE phien_live SET page_id = 'page_1', bat_dau = ? WHERE id = ?").run(new Date().toISOString(), p.id);
    return live.layPhien(p.id);
  };
  return { live, don, hopThu, s, kb, chot, moi };
}

test('phễu khớp đếm thật (người chốt, trả lời, xác nhận, đã gửi, hủy quá giờ / khách hủy); AI chỉ thấy số, không tên; gợi ý sai số / vùng miền / khan hiếm bị bỏ, giữ ≤ 3; lưu lại, không gọi lại', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { live, don, hopThu, chot, moi } = dung();
  const tk = require('../server/nghiep-vu/tong-ket-phien');
  const { vietGoiY } = require('../server/agent/agents/tong-ket');
  const p = moi(false);
  const ten = ['Nguyễn Lan', 'Trần Hoa', 'Lê Trâm', 'Phạm Vy', 'Đỗ Quỳnh', 'Bùi Khánh'];
  const ds = ten.map((x) => chot(p, x));
  chot(p, 'Nguyễn Lan', 'Trắng'); // cùng người, đơn thứ 2
  // 2 khách trả lời tin, 2 đơn xác nhận, 1 đã gửi, 1 hủy quá giờ, 1 khách hủy.
  for (const [k, { n }] of ds.slice(0, 2).entries()) {
    hopThu.ganPsid(n.id, `psid_${k}`);
    hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: n.page_id, psid: `psid_${k}`, mid: `m${k}`, noi_dung: 'địa chỉ em đây' });
  }
  for (const { d } of ds.slice(0, 2)) {
    don.datThongTinGiao(d.id, { ten: 'Lan', sdt: '0912345678', diaChi: '12 Lý Thái Tổ, Bắc Ninh' }, { boi: 'nguoi' });
    don.doiTrangThai(d.id, 'da_xac_nhan');
  }
  don.doiTrangThai(ds[0].d.id, 'da_gui');
  don.doiTrangThai(ds[2].d.id, 'da_huy', { nguon: 'he_thong', ghiChu: 'quá giờ giữ hàng' });
  don.doiTrangThai(ds[3].d.id, 'da_huy', { nguon: 'khach_tu_bao' });
  live.ketThucPhien(p.id, 'xong');

  const t1 = tk.tongKetPhien(p.id);
  assert.deepEqual(t1.pheu, { nguoi_chot: 6, don: 7, tra_loi: 3, xac_nhan: 2, da_gui: 1, da_giao: 0, hoan: 0, huy_qua_gio: 1, huy_khach: 1, huy_shop: 0 });
  assert.equal(t1.du_goi_y, true);
  assert.equal(t1.so_sanh, null, 'chưa đủ 5 buổi thật trước để so');
  assert.equal(t1.ban_chay[0].so_chiec, 5, 'đơn hủy không tính bán chạy');

  const { goi, nhaCungCap } = nhaGia([
    { viec: 'Nhắn nhắc thông tin giao sớm hơn', vi_sao: '7 đơn nhưng chỉ 3 đơn có khách trả lời tin' },
    { viec: 'Tăng giờ giữ hàng', vi_sao: '37% đơn hủy vì quá giờ' },
    { viec: 'Trả lời câu hỏi nhanh hơn', vi_sao: '9 người hỏi mà không chốt' }, // số nhỏ bịa ra cũng bị bỏ
    { viec: 'Ưu tiên khách miền Bắc', vi_sao: '6 người chốt' },
    { viec: 'Nói "chỉ còn 2 chiếc" để giục', vi_sao: '2 đơn xác nhận' },
    { viec: 'Đọc lại cách chốt ở giữa buổi', vi_sao: '6 người chốt' },
    { viec: 'Gọi xác nhận các đơn còn chờ', vi_sao: '2 đơn xác nhận trên 7 đơn' },
    { viec: 'Giới thiệu áo 12 đầu buổi', vi_sao: 'bán chạy 5 chiếc' },
  ]);
  const kq = await vietGoiY(p.id, { nhaCungCap });
  assert.equal(goi.length, 1);
  const guiAi = JSON.stringify(goi[0].lichSu);
  for (const x of ten) assert.ok(!guiAi.includes(x), `AI không thấy tên ${x}`);
  assert.doesNotMatch(guiAi, /0912|psid_|u_/, 'không số điện thoại, không mã người');
  assert.equal(kq.goi_y.length, 3, 'tối đa 3');
  assert.deepEqual(kq.goi_y.map((g) => g.viec), ['Nhắn nhắc thông tin giao sớm hơn', 'Đọc lại cách chốt ở giữa buổi', 'Gọi xác nhận các đơn còn chờ']);
  assert.equal(kq.bo, 5);
  assert.deepEqual(tk.tongKetPhien(p.id).goi_y.goi_y, kq.goi_y, 'đã lưu');
});

test('buổi dưới 5 người chốt → không gọi AI; buổi tập không lẫn vào so sánh; đủ 5 buổi thật trước thì có trung bình', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { live, chot, moi } = dung();
  const tk = require('../server/nghiep-vu/tong-ket-phien');
  const { vietGoiY } = require('../server/agent/agents/tong-ket');
  const { csdl } = require('../server/db/ket-noi');
  const lui = (p, ngay) => csdl().prepare('UPDATE phien_live SET bat_dau = ? WHERE id = ?').run(new Date(Date.now() - ngay * 86400e3).toISOString(), p.id);
  for (let k = 0; k < 5; k++) {
    const p = moi(false);
    for (let j = 0; j <= k; j++) chot(p, `K${k}-${j}`);
    live.ketThucPhien(p.id, 'xong');
    lui(p, 10 - k);
  }
  const tap = moi(true);
  for (let j = 0; j < 30; j++) chot(tap, `T${j}`);
  live.ketThucPhien(tap.id, 'xong');
  lui(tap, 2);
  const p = moi(false);
  for (const x of ['A', 'B', 'C']) chot(p, x);
  live.ketThucPhien(p.id, 'xong');
  const t1 = tk.tongKetPhien(p.id);
  assert.equal(t1.du_goi_y, false);
  assert.equal(t1.so_sanh.nguoi_chot, 3, 'trung bình 1..5 = 3, buổi tập 30 người không tính');
  const { goi, nhaCungCap } = nhaGia([{ viec: 'x', vi_sao: 'y' }]);
  const kq = await vietGoiY(p.id, { nhaCungCap });
  assert.equal(kq.it_du_lieu, true);
  assert.equal(goi.length, 0, 'không gọi AI');
});

test('mốc từng món: đúng tới giây theo giờ Facebook, người chốt trong đoạn, đoạn 45 giây tránh 40 giây sau mỗi lần chốt, chú thích không giá, nhãn giọng AI khi Mai nói', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { live, chot, s, moi } = dung();
  const tk = require('../server/nghiep-vu/tong-ket-phien');
  const { csdl } = require('../server/db/ket-noi');
  const s2 = taoSanPhamMau({ so: 13, gia: '249k', ton: 10 });
  const p = moi(false);
  const goc = Date.now() - 3 * 3600e3;
  const at = (giay) => new Date(goc + giay * 1000).toISOString();
  const db = csdl();
  db.prepare('DELETE FROM dong_thoi_gian_san_pham WHERE phien_id = ?').run(p.id);
  // Món 1 từ 00:02:00 đến 00:05:30, món 2 từ 00:05:30 tới hết (00:07:00).
  db.prepare('INSERT INTO dong_thoi_gian_san_pham (phien_id, doan, san_pham_id, tu_luc) VALUES (?, 0, NULL, ?), (?, 1, ?, ?), (?, 2, ?, ?)')
    .run(p.id, at(0), p.id, s.san_pham.id, at(120), p.id, s2.san_pham.id, at(330));
  chot(p, 'Lan', 'Đen', at(125)); // vùng tên 125–165 → đoạn cắt đầu tiên từ 165
  chot(p, 'Hoa', 'Đen', at(150)); // vùng 150–190 → đẩy tới 190
  chot(p, 'Lan', 'Trắng', at(200)); // cùng người → vẫn tính 1; vùng 200–240 → đoạn 190–235 chạm → 240
  live.ketThucPhien(p.id, 'xong');
  db.prepare('UPDATE phien_live SET bat_dau = ?, bat_dau_fb = ?, ket_thuc = ? WHERE id = ?').run(new Date(goc + 5000).toISOString(), at(0), at(420), p.id);
  const m = tk.mocTungMon(p.id);
  assert.equal(m.xap_xi, false);
  assert.equal(m.moc.length, 2);
  const [a, b] = m.moc;
  assert.deepEqual([a.tu, a.den, a.tu_giay, a.den_giay, a.nguoi_chot], ['00:02:00', '00:05:30', 120, 330, 2]);
  assert.deepEqual(a.clip, { tu: '00:04:00', den: '00:04:45' }, 'tránh mọi lúc đọc tên');
  assert.deepEqual([b.tu, b.den, b.nguoi_chot], ['00:05:30', '00:07:00', 0]);
  assert.deepEqual(b.clip, { tu: '00:05:30', den: '00:06:15' });
  for (const x of m.moc) {
    assert.match(x.chu_thich, new RegExp(`số ${x.so}`));
    assert.doesNotMatch(x.chu_thich, /159|249|\d+ ?k\b|đ\b|giá/i, 'không có giá');
    assert.doesNotMatch(x.chu_thich, /giọng trợ lý AI/, 'buổi chỉ gợi ý: không nhãn giọng AI');
  }
  assert.equal(m.nhac.con_ngay_video, 30);
  db.prepare("UPDATE phien_live SET che_do_ai = 'noi', bat_dau_fb = NULL WHERE id = ?").run(p.id);
  const m2 = tk.mocTungMon(p.id);
  assert.equal(m2.xap_xi, true, 'thiếu giờ Facebook → ghi xấp xỉ');
  assert.equal(m2.moc[0].tu_giay, 115, 'tính từ giờ MOZA thấy live');
  assert.match(m2.moc[0].chu_thich, /Có giọng trợ lý AI/);
});
