'use strict';

// Sửa nền Facebook, bảng giá, trần câu chen (SPEC.md F-67; docs/07 L8–L14, H09–H13, H22).

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');

test('phòng live: giờ bắt đầu theo Facebook, id video, bài live không vào Hộp thư lần hai; bình luận của Page và bình luận ẩn danh', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const { FacebookGia } = require('../server/facebook/gia');
  const { PhongLive } = require('../server/phong-live');
  require('./ho-tro').taoSanPhamMau();
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const fb = new FacebookGia();
  const choDirector = [];
  const choChot = [];
  const phong = new PhongLive({ layKetNoi: () => fb, phat: () => {}, ai: { nhanBinhLuan: (bl) => choDirector.push(bl.noi_dung), ketThuc() {} } });
  phong.chotDon = { xuLy: async (bl) => { choChot.push(bl.noi_dung); return false; } };
  t.after(() => phong.dongLuong());
  const p = live.taoPhien({ kich_ban_id: kb.id });
  const l = fb.batDauLive();
  await phong.quet();
  const pl = live.layPhien(p.id);
  assert.equal(pl.trang_thai, 'dang_live');
  assert.equal(pl.bat_dau, pl.bat_dau_fb, 'bat_dau = giờ Facebook (L14)');
  assert.ok(Date.now() - new Date(pl.bat_dau).getTime() >= 10000, 'giờ Facebook sớm hơn lúc MOZA thấy');
  assert.equal(pl.fb_video_id, l.video_id);
  assert.ok(pl.fb_link.includes(l.video_id));
  const dtg = require('../server/db/ket-noi').csdl().prepare('SELECT tu_luc FROM dong_thoi_gian_san_pham WHERE phien_id = ?').get(p.id);
  assert.equal(dtg.tu_luc, pl.bat_dau, 'đoạn đầu của dòng thời gian cũng theo giờ Facebook');
  assert.equal(hopThu.laBaiLive(`page_gia_${l.video_id}`), true, 'bình luận bài đăng của video live → phòng live đã nhận (H09)');
  assert.equal(hopThu.laBaiLive(`page_gia_${l.id}`), true);
  assert.equal(hopThu.laBaiLive('page_gia_baikhac'), false);

  const cho = () => new Promise((r) => setTimeout(r, 40));
  fb.themBinhLuan({ ten: 'Shop', noi_dung: 'Chốt: số + màu + size, ví dụ chốt 12 đen M. SĐT shop 0912345678', la_page: true });
  await cho();
  const blPage = live.binhLuanGanDay(p.id, 1)[0];
  assert.deepEqual(blPage.nhan, ['cua_page'], 'bình luận của chính Page chỉ lưu để hiện (L8)');
  assert.equal(choChot.length + choDirector.length, 0, 'không vào chốt đơn, không vào Director');
  assert.equal(blPage.da_an, false, 'không ẩn bình luận của Page dù có số');
  fb.themBinhLuan({ ten: 'x', noi_dung: 'áo này còn không', an_danh: true });
  await cho();
  const blAn = live.binhLuanGanDay(p.id, 1)[0];
  assert.equal(blAn.ten, 'Một bạn', 'không có người gửi: không đọc tên (L9)');
  assert.ok(blAn.nhan.includes('an_danh'));
  assert.ok(blAn.nguoi_fb_id.startsWith('an_'));
  assert.deepEqual(choDirector, ['áo này còn không']);
});

test('đổi lỗi Graph, quyền cần có, trường webhook (F-67, L10, L11)', () => {
  const { doiLoi } = require('../server/facebook/graph');
  assert.equal(doiLoi({ code: 10, error_subcode: 1893063, message: 'restricted' }).ma, 'FB_PAGE_BI_CAM_NHAN', 'trước nhánh mã 10');
  assert.equal(doiLoi({ code: 10, message: 'x' }).ma, 'FB_THIEU_QUYEN');
  assert.equal(doiLoi({ code: 100, error_subcode: 2534025 }).ma, 'FB_KHONG_NHAN_RIENG_DUOC');
  assert.equal(doiLoi({ code: 551 }).ma, 'FB_NGUOI_KHONG_NHAN_DUOC');
  const { QUYEN_CAN, TRUONG } = require('../server/facebook/ket-noi');
  assert.ok(QUYEN_CAN.includes('page_utility_messaging'));
  assert.ok(TRUONG.includes('messaging_referrals'));
  const fs = require('node:fs');
  for (const f of ['server/facebook/that.js', 'server/api/ket-noi.js', 'public/js/man-hinh/cai-dat-facebook.js']) {
    assert.doesNotMatch(fs.readFileSync(require('node:path').join(__dirname, '..', f), 'utf8'), /duyệt khoảng 24 giờ/, `${f} còn chữ cũ`);
  }
});

test('bảng giá theo ngày gọi: 3.8 Flash và TTS gấp đôi từ 1/1/2027, 3.8 Live giữ giá, phần hình có giá riêng (F-67)', () => {
  const cp = require('../server/nghiep-vu/chi-phi');
  const truoc = new Date('2026-12-31T12:00:00Z');
  const sau = new Date('2027-01-01T12:00:00Z');
  assert.equal(cp.tinhChiPhi('gemini-3.8-flash', 1e6, 1e6, truoc), 0.75 + 3.75);
  assert.equal(cp.tinhChiPhi('gemini-3.8-flash', 1e6, 1e6, sau), 1.5 + 7.5);
  assert.equal(cp.tinhChiPhiTts('gemini-3.8-flash-tts', 1e6, 1e6, sau), 2 * cp.tinhChiPhiTts('gemini-3.8-flash-tts', 1e6, 1e6, truoc));
  const live = (ngay) => cp.tinhChiPhiMieng('gemini-3.8-live', { token: { vao: { AUDIO: 1e6 }, ra: { AUDIO: 1e6 } } }, ngay);
  assert.equal(live(sau), live(truoc), 'Gemini 3.8 Live không đổi giá (trang giá Google tra 27/9/2026)');
  assert.equal(cp.tinhChiPhiMieng('gemini-3.8-live', { token: { vao: { VIDEO: 1e6 } } }, truoc), 1, 'phần hình 1 USD / 1 triệu token');
  assert.equal(cp.tinhChiPhi('gpt-6-luna', 1e6, 1e6, sau), 0.6);
});

test('nhịp gọi xếp hàng thật: nhiều lời gọi cùng lúc lần lượt, không cùng gọi một lượt (L13)', async () => {
  const { NhipGoi } = require('../server/facebook/nhip-goi');
  let bay = 1_000_000;
  const doi = [];
  const n = new NhipGoi({ bayGio: () => bay, ngu: async (ms) => { doi.push(ms); bay += ms; } });
  n.muc = 60; // > 50% → cách nhau 2 giây
  await Promise.all([1, 2, 3, 4].map(() => n.truocKhiGoi({ toiDaChoMs: 20000 })));
  assert.deepEqual(doi, [2000, 2000, 2000], 'lời đầu gọi ngay, mỗi lời sau chờ đúng 2 giây sau lời trước');
  n.muc = 85; // > 80% → 10 giây
  const kq = await Promise.allSettled([1, 2, 3, 4].map(() => n.truocKhiGoi({ toiDaChoMs: 20000 })));
  assert.deepEqual(kq.map((x) => x.status), ['fulfilled', 'fulfilled', 'rejected', 'rejected'], 'lời 1 chờ 10 giây, lời 2 đứng hàng + chờ đúng 20 giây; lời 3, 4 quá 20 giây thì báo lỗi để vào hàng gửi lại');
  assert.equal(kq[2].reason.ma, 'FB_GIOI_HAN_GOI');
});
