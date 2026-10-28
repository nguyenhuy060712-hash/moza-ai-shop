'use strict';

/**
 * Gỡ lưỡng lự bằng bằng chứng thật (SPEC.md F-84, P12). Director giả, Co-host giả — 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
async function choDen(dk, toiDa = 3000) {
  const bd = Date.now();
  for (;;) {
    const kq = await dk();
    if (kq) return kq;
    if (Date.now() - bd > toiDa) throw new Error('Quá thời gian chờ');
    await cho(20);
  }
}
const idsTrong = (o) => [...o.lichSu[0].chu.matchAll(/id (bl_[a-z0-9]+)/g)].map((m) => m[1]);
const phieuDirector = (o) => ({
  quyet_dinh: 'de_nguoi_dan', cau_hoi_noi_bat: [], giao_cohost: { cau_hoi: '', so: 0, skill_ids: [] },
  goi_y: '', bao: '', chuyen_tu_van_ids: [], gan_nhan: [], luong_lu: [], man_hinh: { mau: '', so: 0, mau_sac: '', chieu_cao: 0, can_nang: 0 }, ly_do: 'thử', ...o,
});

test('nguồn theo kiểu: bảng size + Sổ tay đổi size → có; Sổ tay trống, món chưa có bảng size → không; ngưỡng 2 người; không gỡ lại trong 10 phút', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { nguonGoLuongLu, TheoDoiLuongLu } = require('../server/go-luong-lu');
  const soTay = require('../server/nghiep-vu/so-tay');
  const s = taoSanPhamMau().san_pham;
  const tui = taoSanPhamMau({ so: 30, ten: 'Túi da', danhMuc: 'phu_kien', co: [], them: { bang_size_id: null, thong_so: {}, diem_noi_bat: [] } }).san_pham;
  assert.equal(nguonGoLuongLu('khong_vua', tui).co, false, 'Sổ tay trống, chưa có bảng size → không có nguồn');
  let n = nguonGoLuongLu('khong_vua', s);
  assert.equal(n.co, true);
  assert.deepEqual(n.man_hinh, { mau: 'bang_size', so: 12 });
  soTay.taoMuc({ tieu_de: 'Chính sách đổi size', noi_dung: 'Đổi size trong 3 ngày nếu chưa giặt.' });
  n = nguonGoLuongLu('khong_vua', s);
  assert.ok(n.nguon.some((x) => x.nguon === 'so_tay' && x.doan === 'Đổi size trong 3 ngày nếu chưa giặt.'));
  assert.equal(nguonGoLuongLu('gia', tui).co, false, 'không có điểm nổi bật → không bàn giá');
  assert.equal(nguonGoLuongLu('suy_nghi', s).co, true, 'giờ giữ hàng trong Cài đặt');

  const ll = new TheoDoiLuongLu();
  ll.them({ so: 12, kieu: 'khong_vua', nguoi: 'a' });
  ll.them({ so: 12, kieu: 'khong_vua', nguoi: 'a' });
  assert.equal(ll.duocGo(12, 'khong_vua'), false, '1 người (dù 2 bình luận) → không gỡ');
  ll.them({ so: 12, kieu: 'khong_vua', nguoi: 'b' });
  assert.equal(ll.duocGo(12, 'khong_vua'), true);
  assert.deepEqual(ll.tomTat(), ['lo không vừa · số 12 · 2 người']);
  ll.daGoLuc(12, 'khong_vua');
  assert.equal(ll.duocGo(12, 'khong_vua'), false, 'đã gỡ trong 10 phút');
  assert.deepEqual(ll.tomTat(), []);
});

test('Director gắn luong_lu cho 2 người "sợ không vừa" → giao Co-host go-luong-lu kèm nguồn Sổ tay, chiếu bảng size; 1 người → không giao; câu giảm giá bị chặn; Skill go-luong-lu vào dữ liệu đang chạy', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const live = require('../server/nghiep-vu/live');
  const soTay = require('../server/nghiep-vu/so-tay');
  const skill = require('../server/nghiep-vu/skill');
  const { FacebookGia } = require('../server/facebook/gia');
  const { PhongLive } = require('../server/phong-live');
  const { PhongAi } = require('../server/phong-ai');
  const { datLaiTrangThaiNha } = require('../server/agent/runtime');
  taoSanPhamMau();
  soTay.taoMuc({ tieu_de: 'Chính sách đổi size', noi_dung: 'Đổi size trong 3 ngày nếu chưa giặt.' });
  assert.ok(skill.danhSach().some((x) => x.id === 'go-luong-lu'), 'Skill mẫu mới có trong dữ liệu');
  const kb = kichBan.taoNhanh();
  const goi = { director: [], cohost: [] };
  let traLoi = { director: () => phieuDirector({}), cohost: () => ({ cau: 'Dạ.', trich_dan: [] }) };
  const nha = {
    async goi(o) {
      const ai = o.heThong.includes('điều phối') ? 'director' : 'cohost';
      goi[ai].push(JSON.parse(JSON.stringify({ heThong: o.heThong, lichSu: o.lichSu })));
      const r = await traLoi[ai](o, goi[ai].length);
      return { goiCongCu: [], chu: JSON.stringify(r), goc: null, tokenVao: 500, tokenRa: 50 };
    },
  };
  const suKien = [];
  const phat = (type, d) => suKien.push({ type, ...d });
  const ai = new PhongAi({ phat, nhaCungCap: { gemini: nha }, gomMs: 30, gioiHan: { director: { giay: 2 }, cohost: { giay: 2 } } });
  const chieu = [];
  ai.manHinh = { chieu: (l) => chieu.push(l) };
  const fb = new FacebookGia();
  const phong = new PhongLive({ layKetNoi: () => fb, phat, ai });
  const phien = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  fb.batDauLive();
  await phong.quet();
  live.doiDoan(phien.id, 1);
  t.after(() => { ai.datLai(null); phong.dongLuong(); });
  datLaiTrangThaiNha();
  const choAiRanh = () => choDen(() => !ai.dangDirector && !ai.dangCohost && !ai.hen);
  const giao = (o) => phieuDirector({
    quyet_dinh: 'giao_cohost', luong_lu: idsTrong(o).map((id) => ({ binh_luan_id: id, kieu: 'khong_vua' })),
    giao_cohost: { cau_hoi: 'gỡ lưỡng lự: không vừa về số 12', so: 12, skill_ids: ['go-luong-lu'] },
  });

  // 1 người: Director muốn giao nhưng MOZA chặn (chưa đủ 2 người).
  traLoi.director = giao;
  fb.themBinhLuan({ ten: 'Nguyễn Lan', noi_dung: 'sợ mặc không vừa quá' });
  await choDen(() => goi.director.length >= 1);
  await choAiRanh();
  assert.equal(goi.cohost.length, 0, '1 người → không giao');
  const bl1 = live.binhLuanGanDay(phien.id, 5).find((b) => b.ten === 'Nguyễn Lan');
  assert.ok(bl1.nhan.includes('luong_lu'), 'nhãn luong_lu');

  // Người thứ hai → giao Co-host với nguồn Sổ tay; Co-host giả trích Sổ tay.
  traLoi.cohost = () => ({ cau: 'Ai lo áo số 12 không vừa thì yên tâm, shop đổi size trong 3 ngày nếu chưa giặt.', trich_dan: [{ nguon: 'so_tay', doan: 'Đổi size trong 3 ngày nếu chưa giặt.' }] });
  fb.themBinhLuan({ ten: 'Trần Hoa', noi_dung: 'không biết mặc có vừa không nữa' });
  await choDen(() => goi.cohost.length >= 1);
  await choAiRanh();
  const tin = JSON.stringify(goi.cohost[0].lichSu);
  assert.match(tin, /2 người lo không vừa/);
  assert.match(tin, /\[so_tay\] \\"Đổi size trong 3 ngày nếu chưa giặt\.\\"/);
  assert.match(goi.cohost[0].heThong + tin, /go-luong-lu|Gỡ lưỡng lự/);
  assert.ok(chieu.some((l) => l.mau === 'bang_size' && l.so === 12), 'chiếu bảng size');
  const goiY = suKien.filter((e) => e.type === 'live.goi_y' && e.goi_y).at(-1);
  assert.match(goiY.goi_y.noi_dung, /đổi size trong 3 ngày/);

  // Câu gỡ có giảm giá / so sánh → bị chặn (K3 / K11).
  const { kiemTraCau } = require('../server/agent/kiem-tra/kiem-tra');
  assert.ok(kiemTraCau({ cau: 'Áo số 12 bớt 20k cho cả nhà luôn', kenh: 'song', phienLiveId: phien.id }).loi.some((l) => l.ma === 'K3'));
  assert.ok(kiemTraCau({ cau: 'Áo số 12 rẻ hơn shop khác nhiều', kenh: 'song', phienLiveId: phien.id }).loi.some((l) => l.ma === 'K11'));
});
