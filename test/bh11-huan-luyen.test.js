'use strict';

/**
 * Bảng huấn luyện người dẫn (SPEC.md F-116): số liệu theo phút (024), 4 cảnh báo theo thứ tự ưu tiên, ≤ 1 cảnh báo / 2 phút, Đội AI
 * dẫn → chỉ số; kịch bản diễn tập "người xem tụt", "3 câu size chưa trả lời". Bằng mã, 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

async function dung(t, { phutTruoc = 10.5, doiAi = false } = {}) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const { csdl } = require('../server/db/ket-noi');
  taoSanPhamMau({ ton: 50 });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh(); // [mở đầu, áo 12, quần 15, kết thúc]
  const bayGio = Date.now();
  const p0 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ?, doi_ai = ? WHERE id = ?").run(new Date(bayGio - phutTruoc * 60e3).toISOString(), doiAi ? 1 : 0, p0.id);
  let i = 0;
  const binhLuan = (noiDung, giayTruoc = 0, ten = 'Khách') => {
    i += 1;
    const bl = live.themBinhLuan(p0.id, { fb_id: `b${i}`, nguoi_fb_id: `u${i}`, ten, noi_dung: noiDung, luc_fb: new Date().toISOString() });
    csdl().prepare('UPDATE binh_luan_live SET luc_nhan = ? WHERE id = ?').run(new Date(bayGio - giayTruoc * 1000).toISOString(), bl.id);
    return bl;
  };
  const loi = (loai, chu, giayTruoc = 0) => csdl().prepare('INSERT INTO nhat_ky_song (id, phien_id, luc, loai, noi_dung) VALUES (?, ?, ?, ?, ?)')
    .run(`nk${(i += 1)}`, p0.id, new Date(bayGio - giayTruoc * 1000).toISOString(), loai, chu);
  const { HuanLuyen } = require('../server/huan-luyen');
  const phat = [];
  const hl = new HuanLuyen({ phat: (ten, d) => phat.push({ ten, d }) });
  return { live, csdl, p: live.layPhien(p0.id), bayGio, binhLuan, loi, hl, phat, soLieu: require('../server/nghiep-vu/so-lieu-phut') };
}

test('so_lieu_phut: ghi theo phút, ghi lại cùng phút không cộng dồn, giữ số người xem cũ khi không có số mới', async (t) => {
  const x = await dung(t);
  x.binhLuan('đẹp quá', 5);
  x.binhLuan('giá bao nhiêu?', 3);
  const d = x.soLieu.ghiPhut(x.p.id, { nguoiXem: 120, bayGio: x.bayGio });
  assert.equal(d.phut, 10);
  assert.deepEqual([d.nguoi_xem, d.binh_luan, d.cau_hoi, d.chot], [120, 2, 1, 0]);
  const d2 = x.soLieu.ghiPhut(x.p.id, { bayGio: x.bayGio + 1000 });
  assert.deepEqual([d2.nguoi_xem, d2.binh_luan, d2.cau_hoi], [120, 2, 1]);
  assert.equal(x.soLieu.docPhien(x.p.id).length, 1);
});

test('kịch bản "3 câu size chưa trả lời" → cảnh báo câu hỏi kèm bình luận đầu; đã trả lời / Mai nhắc số món thì thôi đếm', async (t) => {
  const x = await dung(t);
  x.loi('mai', 'Áo số 12 giá 289 nghìn, chốt bằng cách bình luận số, màu, size', 200);
  const a = x.binhLuan('áo này form rộng hay ôm vậy shop?', 90, 'Quỳnh Anh');
  const b = x.binhLuan('size M còn không ạ?', 80, 'Bảo Ngọc');
  x.binhLuan('vải có co giãn không ạ', 70, 'Diệu Linh');
  x.binhLuan('mới hỏi xong?', 20, 'Mới hỏi'); // chưa đủ 60 giây
  const g = x.hl.xem(x.bayGio);
  assert.equal(g.canh_bao.loai, 'cau_hoi');
  assert.equal(g.canh_bao.so, 3);
  assert.equal(g.canh_bao.binh_luan_id, a.id);
  assert.match(g.canh_bao.cau, /^3 câu hỏi chưa ai trả lời — Quỳnh Anh/);
  assert.equal(x.phat.at(-1).ten, 'live.huan_luyen');
  x.soLieu.danhDauDaTraLoi(x.p.id, a.id);
  assert.equal(x.soLieu.cauHoiChuaTraLoi(x.p.id, { bayGio: x.bayGio })[0].id, b.id);
  // Bình luận gắn món đang nói, Mai nhắc đúng số món sau câu hỏi → coi là đã trả lời.
  const doan = x.p.kich_ban.doan.findIndex((d) => d.san_pham_id);
  x.live.doiDoan(x.p.id, doan);
  const c = x.binhLuan('áo 12 có màu be không?', 75);
  x.csdl().prepare('UPDATE binh_luan_live SET san_pham_doan = ? WHERE id = ?').run(x.p.kich_ban.doan[doan].san_pham_id, c.id);
  assert.ok(x.soLieu.cauHoiChuaTraLoi(x.p.id, { bayGio: x.bayGio }).some((y) => y.id === c.id));
  x.loi('mai', 'Dạ áo số 12 có hai màu đen và trắng nha', 30);
  assert.ok(!x.soLieu.cauHoiChuaTraLoi(x.p.id, { bayGio: x.bayGio }).some((y) => y.id === c.id));
});

test('tối đa 1 cảnh báo / 2 phút; số liệu vẫn phát mỗi lần', async (t) => {
  const x = await dung(t);
  x.binhLuan('size gì vừa ạ?', 90);
  assert.ok(x.hl.xem(x.bayGio).canh_bao);
  assert.equal(x.hl.xem(x.bayGio + 60e3).canh_bao, null);
  assert.equal(x.phat.length, 2);
  assert.ok(x.hl.xem(x.bayGio + 121e3).canh_bao);
});

test('kịch bản "người xem tụt" 60 → 30 trong 3 phút → cảnh báo; nhắc chốt sau 5 phút im; ưu tiên câu hỏi trước', async (t) => {
  const x = await dung(t);
  x.loi('nguoi_dan', 'chốt áo số 12 bình luận số màu size nhé', 60);
  for (const [phut, n] of [[7, 60], [8, 45], [9, 50], [10, 30]]) {
    x.soLieu.ghiPhut(x.p.id, { nguoiXem: n, bayGio: new Date(x.p.bat_dau).getTime() + phut * 60e3 + 1000 });
  }
  const g = x.hl.xetCanhBao(x.p, x.bayGio);
  assert.equal(g.loai, 'nguoi_xem_tut');
  assert.match(g.cau, /Người xem giảm 50% trong 3 phút \(60 → 30\)/);
  x.binhLuan('ship về Huế bao lâu?', 70);
  assert.equal(x.hl.xetCanhBao(x.p, x.bayGio).loai, 'cau_hoi');
  // Không câu hỏi, không tụt, 6 phút chưa nhắc chốt / giá.
  const y = await dung(t);
  y.loi('mai', 'Chào cả nhà, hôm nay mình có nhiều mẫu đẹp', 30);
  y.loi('nguoi_dan', 'giá áo này 289k nha', 6 * 60);
  assert.equal(y.hl.xetCanhBao(y.p, y.bayGio).loai, 'nhac_chot');
  y.loi('mai', 'Cả nhà chốt bằng cách ghi số món', 10);
  assert.equal(y.hl.xetCanhBao(y.p, y.bayGio), null);
});

test('Đội AI dẫn → chỉ số liệu, không cảnh báo', async (t) => {
  const x = await dung(t, { doiAi: true });
  x.binhLuan('size gì vừa ạ?', 90);
  const g = x.hl.xem(x.bayGio);
  assert.equal(g.canh_bao, null);
  assert.equal(g.so_lieu_phut.length, 1);
});
