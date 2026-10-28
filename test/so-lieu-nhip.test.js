'use strict';

/**
 * Dòng số liệu cho người dẫn, "Tiếp theo" trên Thanh chữ, một gợi ý nhịp bán (SPEC.md F-85, P16). Không gọi AI.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

async function dung(t) {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const { csdl } = require('../server/db/ket-noi');
  const s12 = taoSanPhamMau({ ton: 50 });
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'], ton: 20 });
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh(); // [mở đầu, áo 12, quần 15, kết thúc]
  let i = 0;
  const chot = (p, ten) => {
    i += 1;
    const bl = live.themBinhLuan(p.id, { fb_id: `c${i}`, nguoi_fb_id: `u_${ten}`, ten, noi_dung: 'chốt 12 đen M', luc_fb: new Date().toISOString() });
    const n = hopThu.nguoiCuaBinhLuan(bl, p);
    const d = don.taoDon({ mon: [{ phan_loai_id: s12.pl('Đen', 'M').id }], nguon: 'binh_luan_live', phienLiveId: p.id, binhLuanId: bl.id, nguoiFbId: n.id, dienTap: p.dien_tap });
    live.ganChot(bl.id, { donId: d.id });
    return { d, n, bl };
  };
  const moLive = (p) => { csdl().prepare("UPDATE phien_live SET trang_thai = 'dang_live', bat_dau = ? WHERE id = ?").run(new Date().toISOString(), p.id); return live.layPhien(p.id); };
  return { live, don, hopThu, csdl, kb, chot, moLive, s12 };
}

test('soLieuPhien: 5 người chốt, 3 đã trả lời tin (nhắn Messenger / bấm nút), 2 đã xác nhận; đơn hủy không tính; buổi tập không lẫn', async (t) => {
  const x = await dung(t);
  const { soLieuPhien } = require('../server/nghiep-vu/bao-cao');
  const pTap = x.live.taoPhien({ kich_ban_id: x.kb.id, che_do_ai: 'goi_y', dien_tap: true });
  x.chot(pTap, 'Tập Một');
  x.chot(pTap, 'Tập Hai');
  x.live.ketThucPhien(pTap.id, 'xong');
  const p = x.live.taoPhien({ kich_ban_id: x.kb.id, che_do_ai: 'goi_y', dien_tap: false });
  const ds = ['Nguyễn Lan', 'Trần Hoa', 'Lê Trâm', 'Phạm Vy', 'Đỗ Quỳnh', 'Bùi Khánh'].map((ten) => x.chot(p, ten));
  x.don.doiTrangThai(ds[5].d.id, 'da_huy', { nguon: 'nguoi' });
  // Trả lời: Lan nhắn Messenger (người Messenger được gắn với người bình luận), Hoa và Trâm bấm nút.
  const ev = x.hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_x', psid: 'ps_lan', mid: 'm1', noi_dung: 'Lan nè', luc: new Date(Date.now() + 1000).toISOString() }, { dienTap: false });
  x.hopThu.ganPsid(ds[0].n.id, 'ps_lan');
  x.csdl().prepare('UPDATE hoi_thoai SET nguoi_fb_id = ? WHERE id = ?').run(ds[0].n.id, ev.hoiThoai.id);
  x.csdl().prepare('UPDATE don SET khach_bam_luc = ? WHERE id IN (?, ?)').run(new Date().toISOString(), ds[1].d.id, ds[2].d.id);
  x.csdl().prepare("UPDATE don SET trang_thai = 'da_xac_nhan' WHERE id IN (?, ?)").run(ds[1].d.id, ds[2].d.id);
  assert.deepEqual(soLieuPhien(p.id), { chot: 5, tra_loi: 3, xac_nhan: 2 });
  assert.deepEqual(soLieuPhien(pTap.id), { chot: 2, tra_loi: 0, xac_nhan: 0 });
  // Số người xem (ChotDon giữ live_views phòng live hỏi mỗi phút).
  const { ChotDon } = require('../server/chot-don');
  const cd = new ChotDon({ phat: () => {} });
  cd.ghiNguoiXem(p.id, 140);
  assert.equal(cd.soLieu(p).nguoi_xem, 140);
});

test('nhịp bán: món nguội 4 phút → 1 gợi ý "sang món tiếp", 3 phút sau không thêm; món nóng 3 người / 2 phút → "nói thêm một vòng", không "sắp hết"; Đội AI dẫn → không gợi ý', async (t) => {
  const x = await dung(t);
  const { NhipBan } = require('../server/nhip-ban');
  const goiY = [];
  const phongAi = { hienGoiY: (o) => goiY.push(o) };
  let p = x.moLive(x.live.taoPhien({ kich_ban_id: x.kb.id, che_do_ai: 'goi_y', dien_tap: true }));
  x.live.doiDoan(p.id, 1); // đang nói áo 12
  const nb = new NhipBan({ phongAi });
  const bayGio = Date.now();
  assert.equal(nb.xem(bayGio), null, 'mới vào món');
  assert.equal(nb.xem(bayGio + 5 * 60e3), 'Chưa ai hỏi áo số 12: sang món tiếp (quần số 15)?');
  assert.equal(nb.xem(bayGio + 7 * 60e3), null, 'tối đa 1 gợi ý / 3 phút');
  assert.equal(goiY[0].loai, 'director');

  const nb2 = new NhipBan({ phongAi });
  for (const ten of ['Nguyễn Lan', 'Trần Hoa', 'Lê Trâm']) x.chot(p, ten);
  const cau = nb2.xem(Date.now());
  assert.equal(cau, 'Áo số 12 đang có nhiều người chốt: nói thêm một vòng màu, size còn hàng?');
  assert.doesNotMatch(cau, /sắp hết/);

  x.csdl().prepare('UPDATE phien_live SET doi_ai = 1 WHERE id = ?').run(p.id);
  assert.equal(new NhipBan({ phongAi }).xem(Date.now() + 10 * 60e3), null, 'Đội AI dẫn → không gợi ý');
});

test('"Tiếp theo": sau 60 giây ở đoạn áo 12 → Thanh chữ "Tiếp theo: quần số 15"; đoạn kế là đoạn chung → không hiện', async (t) => {
  const x = await dung(t);
  const md = require('../server/cau-hinh/mac-dinh.json');
  const cu = md.tiep_theo_sau_giay;
  md.tiep_theo_sau_giay = 0.15; // đồng hồ rút gọn cho test
  t.after(() => { md.tiep_theo_sau_giay = cu; });
  const { EventEmitter } = require('node:events');
  const { ManHinhSanPham } = require('../server/man-hinh-san-pham');
  const suKien = [];
  const obs = Object.assign(new EventEmitter(), { trangThai: () => ({ ket_noi: false }), noi: async () => ({}), dong() {}, async chuyenCanh() {} });
  const bus = new EventEmitter();
  const mh = new ManHinhSanPham({ phat: (type, d) => suKien.push({ type, ...d }), bus, obs });
  t.after(() => mh.dong());
  const p = x.moLive(x.live.taoPhien({ kich_ban_id: x.kb.id, che_do_ai: 'goi_y', dien_tap: true }));
  x.live.doiDoan(p.id, 1);
  bus.emit('su_kien', 'live.doan', { phien_id: p.id });
  await new Promise((r) => setTimeout(r, 300));
  const tiep = suKien.filter((e) => e.type === 'mhsp.tiep_theo' && e.chu);
  assert.equal(tiep.at(-1)?.chu, 'Tiếp theo: quần số 15');
  x.live.doiDoan(p.id, 2); // quần 15 → đoạn kế là đoạn chung
  bus.emit('su_kien', 'live.doan', { phien_id: p.id });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(suKien.filter((e) => e.type === 'mhsp.tiep_theo').at(-1).chu, null, 'đoạn chung → không hiện');
  assert.equal(mh.trangThai().tiep_theo, null);
});
