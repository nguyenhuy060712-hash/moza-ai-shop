'use strict';

/**
 * MOZA nhìn qua OBS, gợi ý chuyển món (SPEC.md F-107): OBS giả (ảnh BMP nhỏ tạo bằng mã, JPEG từ ảnh mẫu), AI giả, đồng hồ giả.
 * Hình không đổi → không gọi AI; đổi rồi đứng yên → gọi; 5 điều kiện + 2 lần liền mới gợi ý; không bao giờ tự chuyển; bỏ qua 60 giây;
 * giới hạn lần / giờ; nguồn không bao giờ là cảnh / Thanh chữ / Màn hình sản phẩm; không lưu ảnh, nhật ký không có base64. 0 đồng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { moCSDLTam, taoSanPhamMau, ANH_GIA } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

/** BMP 24 bit, mọi điểm cùng độ sáng v. */
function bmp(r, c, v) {
  const hang = Math.ceil((r * 3) / 4) * 4;
  const b = Buffer.alloc(54 + hang * c);
  b.write('BM', 0); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14);
  b.writeInt32LE(r, 18); b.writeInt32LE(c, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
  for (let y = 0; y < c; y++) for (let x = 0; x < r; x++) b.fill(v, 54 + y * hang + x * 3, 54 + y * hang + x * 3 + 3);
  return b;
}

async function dung(t, { cauHinh = {}, traLoi = () => ({ co_mon: false, so: 0, chac: 'thap' }) } = {}) {
  const { dong, thuMuc } = await moCSDLTam();
  t.after(dong);
  taoSanPhamMau();
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'] });
  const live = require('../server/nghiep-vu/live');
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh(); // [chung, áo 12, quần 15, chung]
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  live.ganLive(p.id, 'livegia_x', 'page_1');
  const obs = { hinh: 100, xin: [], trangThai: () => ({ ket_noi: true }),
    async yeuCau(type, d = {}) {
      obs.xin.push({ type, ...d });
      if (type === 'GetVersion') return { supportedImageFormats: ['bmp', 'jpg', 'png'] };
      if (type === 'GetSceneItemList') {
        return { sceneItems: [{ sourceName: 'Moza · Thanh chữ', inputKind: 'browser_source' }, { sourceName: 'Máy quay điện thoại', inputKind: 'dshow_input' },
          { sourceName: 'Moza · Màn hình sản phẩm', inputKind: 'browser_source' }] };
      }
      if (type === 'GetSourceScreenshot') {
        const b = d.imageFormat === 'bmp' ? bmp(d.imageWidth, d.imageHeight, obs.hinh) : ANH_GIA;
        return { imageData: `data:image/${d.imageFormat};base64,${b.toString('base64')}` };
      }
      return {};
    } };
  const goi = [];
  // BH11 F-113: MOZA nhìn hỏi bằng Decisions — phiếu cũ {co_mon, so, chac} đổi sang lựa chọn `so_N` / `khong_ro` + độ tin cậy.
  const nha = {
    async goi(o) { goi.push(o); return { goiCongCu: [], chu: JSON.stringify(traLoi(goi.length)), goc: null, tokenVao: 10, tokenRa: 5 }; },
    async quyetDinh(o) {
      goi.push(o);
      const ph = traLoi(goi.length);
      return { traLoi: { mon: { loai: 'choice', chon: ph.co_mon && ph.so ? `so_${ph.so}` : 'khong_ro', tinCay: { cao: 0.9, vua: 0.6, thap: 0.3 }[ph.chac] ?? 0.3 } }, model: 'gpt-6-luna', tokenVao: 10, tokenRa: 0 };
    },
  };
  let dongHo = Date.now();
  const suKien = [];
  const { NhinMon } = require('../server/nhin-mon');
  const nm = new NhinMon({ phat: (type, d) => suKien.push({ type, ...d }), layObs: () => obs, nhaCungCap: { openai: nha, gemini: nha, anthropic: nha },
    cauHinh: { an_goi_y_giay: 0.05, ...cauHinh }, bayGio: () => dongHo });
  t.after(() => nm.dung());
  nm.datBangMau(p.id, { anh: ANH_GIA.toString('base64'), so: [12, 15] });
  await nm.bat(p.id, true);
  const tick = async (giay = 2.5) => { dongHo += giay * 1000; return nm.buoc(); };
  const doiHinh = (v) => { obs.hinh = v; };
  const goiY = () => suKien.filter((e) => e.type === 'live.nhin_goi_y' && e.so);
  await tick(); // ảnh đầu tiên chỉ làm mốc so
  return { live, p, nm, obs, goi, suKien, tick, doiHinh, goiY, thuMuc };
}

test('đọc BMP 24 bit, khác biệt ảnh nhỏ', () => {
  const { docBmp, khacBiet } = require('../server/nhin-mon');
  const a = docBmp(bmp(32, 18, 100));
  assert.equal(a.length, 32 * 18);
  assert.equal(a[0], 100);
  assert.ok(khacBiet(a, docBmp(bmp(32, 18, 104))) < 0.12);
  assert.ok(khacBiet(a, docBmp(bmp(32, 18, 200))) > 0.12);
});

test('hình không đổi → không gọi AI; đổi rồi đứng yên → đúng 1 lần (kết quả không đủ điều kiện thì thôi); 1 lần / 5 giây; giới hạn lần / giờ', async (t) => {
  const x = await dung(t, { cauHinh: { toi_da_lan_gio: 2 } });
  for (let i = 0; i < 6; i++) await x.tick();
  assert.equal(x.goi.length, 0, 'hình không đổi');
  x.doiHinh(220);
  await x.tick(); // đang đổi
  await x.tick(); // đứng yên → hỏi
  for (let i = 0; i < 5; i++) await x.tick();
  assert.equal(x.goi.length, 1);
  x.doiHinh(30); await x.tick(); await x.tick();
  assert.equal(x.goi.length, 2);
  x.doiHinh(160); await x.tick(); await x.tick(); await x.tick();
  assert.equal(x.goi.length, 2, 'chạm 2 lần / giờ');
  // Nguồn: chỉ camera, không bao giờ cảnh hay nguồn của MOZA; ảnh gửi detail low, bảng mẫu trước khung hình.
  const chup = x.obs.xin.filter((y) => y.type === 'GetSourceScreenshot').map((y) => y.sourceName);
  assert.ok(chup.length > 0 && chup.every((n) => n === 'Máy quay điện thoại'));
  // F-113: Decisions — bảng mẫu (ảnh + input_json) TRƯỚC khung hình, detail low; một câu choice ≤ 10 món + khong_ro.
  const anh = x.goi[0].noiDung.filter((y) => y.anh).map((y) => y.anh);
  assert.equal(anh.length, 2);
  assert.equal(anh[0].base64, ANH_GIA.toString('base64'));
  assert.ok(anh.every((a) => a.detail === 'low'));
  const yeu = require('../server/agent/nha-cung-cap/openai').chuyenQuyetDinh(x.goi[0]);
  assert.equal(yeu.model, 'gpt-6-luna');
  assert.deepEqual(yeu.input[1].content.map((c) => c.type), ['input_text', 'input_image', 'input_json', 'input_text', 'input_image']);
  assert.ok(yeu.input[1].content.filter((c) => c.type === 'input_image').every((c) => c.detail === 'low'));
  assert.deepEqual(yeu.questions[0].choices.map((c) => c.value), ['so_12', 'so_15', 'khong_ro']);
});

test('5 điều kiện + 2 lần liền → gợi ý (đúng đoạn); không ai bấm thì KHÔNG BAO GIỜ tự chuyển; bỏ qua → 60 giây không gợi ý món đó; món đang nói → không gợi ý', async (t) => {
  const x = await dung(t, { traLoi: () => ({ co_mon: true, so: 15, chac: 'cao' }) });
  const doan0 = x.live.layPhien(x.p.id).doan_hien_tai;
  for (let vong = 0; vong < 5; vong++) {
    x.doiHinh(vong % 2 ? 60 : 220);
    await x.tick(); await x.tick(); await x.tick(5);
  }
  assert.ok(x.goi.length >= 10, 'mỗi lần đổi hình: hỏi + xác nhận');
  assert.equal(x.goiY().length, 5);
  assert.deepEqual([x.goiY()[0].so, x.goiY()[0].doan, x.goiY()[0].ten], [15, 2, 'quần số 15']);
  assert.equal(x.live.layPhien(x.p.id).doan_hien_tai, doan0, 'không bao giờ tự chuyển');
  await cho(80);
  assert.ok(x.suKien.some((e) => e.type === 'live.nhin_goi_y' && e.so === null), 'tự ẩn');
  x.nm.boQua(15);
  x.doiHinh(90); await x.tick(); await x.tick(); await x.tick(5);
  assert.equal(x.goiY().length, 5, 'bỏ qua 60 giây');
  x.live.doiDoan(x.p.id, 2); // đang nói quần 15
  x.doiHinh(200); await x.tick(70); await x.tick(); await x.tick(5);
  assert.equal(x.goiY().length, 5, 'món đang nói: không gợi ý');
});

test('chắc vừa / số ngoài buổi / một lần lẻ → không gợi ý; "Dừng mọi thứ" / hết live → tắt; không lưu ảnh, nhật ký không có base64', async (t) => {
  const tra = [{ co_mon: true, so: 15, chac: 'vua' }, { co_mon: true, so: 15, chac: 'vua' }, { co_mon: true, so: 99, chac: 'cao' }, { co_mon: true, so: 99, chac: 'cao' },
    { co_mon: true, so: 12, chac: 'cao' }, { co_mon: true, so: 15, chac: 'cao' }];
  const x = await dung(t, { traLoi: (n) => tra[n - 1] || { co_mon: false, so: 0, chac: 'thap' } });
  const truoc = fs.readdirSync(x.thuMuc, { recursive: true }).length;
  for (let vong = 0; vong < 3; vong++) { x.doiHinh(vong % 2 ? 60 : 220); await x.tick(); await x.tick(); await x.tick(5); }
  assert.equal(x.goiY().length, 0);
  assert.equal(fs.readdirSync(x.thuMuc, { recursive: true }).filter((f) => !/moza\.db/.test(String(f))).length <= truoc, true, 'không có tệp ảnh mới');
  const { csdl } = require('../server/db/ket-noi');
  const run = JSON.stringify(csdl().prepare("SELECT * FROM agent_run WHERE agent_id = 'nhin_mon'").all());
  assert.ok(run.length > 10);
  assert.doesNotMatch(run, /data:image|base64|\/9j\/|[A-Za-z0-9+/]{200,}/);
  require('../server/nghiep-vu/cai-dat').datKhanCap(true, 'thử');
  await x.tick();
  assert.equal(x.nm.trangThai(x.p.id).bat, false);
  assert.ok(x.suKien.some((e) => e.type === 'live.nhin' && e.bat === false));
  require('../server/nghiep-vu/cai-dat').datKhanCap(false);
  await x.nm.bat(x.p.id, true);
  x.live.ketThucPhien(x.p.id, 'xong');
  await x.tick();
  assert.equal(x.nm.trangThai(x.p.id).bat, false, 'hết live → tắt');
});

test('Camera giả chỉ ở buổi tập: "đang cầm" món → ảnh của món; buổi thật chưa nối OBS → lỗi rõ', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  taoSanPhamMau();
  const live = require('../server/nghiep-vu/live');
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const { NhinMon } = require('../server/nhin-mon');
  const nm = new NhinMon({ phat() {}, layObs: () => ({ trangThai: () => ({ ket_noi: false }) }) });
  const that = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  live.ganLive(that.id, 'lv1', 'page_1');
  await assert.rejects(nm.bat(that.id, true), (e) => e.ma === 'OBS_CHUA_NOI');
  assert.equal(nm.trangThai(that.id).co_nguon, false);
  live.ketThucPhien(that.id, 'xong');
  const tap = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  live.ganLive(tap.id, 'lv2', 'page_gia');
  await nm.bat(tap.id, true);
  assert.equal(nm.trangThai(tap.id).camera_gia, true);
  const a = await nm.cameraGia.chupNho([32, 18]);
  nm.cameraGia.so = 12;
  const b = await nm.cameraGia.chupNho([32, 18]);
  assert.ok(require('../server/nhin-mon').khacBiet(a, b) > 0.12, 'cầm món → hình đổi');
  assert.ok((await nm.cameraGia.chupLon()).base64.length > 10);
  nm.dung();
});
