'use strict';
// F-104: mẫu "Khách mặc thật" ở test/anh-khach.test.js (cả gỡ ảnh lúc đang chiếu).

/**
 * Màn hình sản phẩm và chuyển cảnh OBS (SPEC.md #90): nối OBS (obs-websocket v5, máy chủ giả), dựng nội dung từ dữ liệu
 * thật, hiểu lệnh người dẫn, hai chế độ chuyển cảnh (gợi ý / tự chuyển), ô man_hinh của Director, tải video. Không gọi mạng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { WebSocketServer } = require('ws');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');
const { KetNoiObs, CANH, NGUON, chuoiXacThuc } = require('../server/obs');

/** OBS giả: Hello có xác thực, ghi lại mọi lệnh, trả lời như obs-websocket v5. */
function obsGia(matKhau = 'bi-mat') {
  const wss = new WebSocketServer({ port: 0 });
  const lenh = [];
  const canh = new Map(); // tên cảnh → [{sourceName, sceneItemId}]
  let id = 1;
  const salt = 'muoi';
  const challenge = 'thach-thuc';
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ op: 0, d: { obsWebSocketVersion: '5.6.0', obsStudioVersion: '32.2.0', rpcVersion: 1, authentication: { salt, challenge } } }));
    ws.on('message', (du) => {
      const m = JSON.parse(String(du));
      if (m.op === 1) {
        if (m.d.authentication !== chuoiXacThuc(matKhau, salt, challenge)) { ws.close(4009, 'sai'); return; }
        ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
        return;
      }
      if (m.op !== 6) return;
      const { requestType: t, requestId, requestData: d } = m.d;
      lenh.push({ t, d });
      const tra = (ok, du2 = {}, code = 100) => ws.send(JSON.stringify({ op: 7, d: { requestType: t, requestId, requestStatus: { result: ok, code }, responseData: du2 } }));
      if (t === 'CreateScene') { if (canh.has(d.sceneName)) return tra(false, {}, 601); canh.set(d.sceneName, []); return tra(true); }
      if (t === 'CreateInput' || t === 'CreateSceneItem') {
        const ten = d.inputName || d.sourceName;
        if (t === 'CreateInput' && [...canh.values()].flat().some((x) => x.sourceName === ten)) return tra(false, {}, 601);
        const x = { sourceName: ten, sceneItemId: id++ };
        canh.get(d.sceneName).push(x);
        return tra(true, { sceneItemId: x.sceneItemId });
      }
      if (t === 'GetSceneItemList') return tra(true, { sceneItems: canh.get(d.sceneName) || [] });
      if (t === 'GetCurrentProgramScene') return tra(true, { sceneName: 'Cảnh 1' });
      return tra(true);
    });
  });
  const cong = () => wss.address().port;
  const phatSuKien = (sceneName) => { for (const c of wss.clients) c.send(JSON.stringify({ op: 5, d: { eventType: 'CurrentProgramSceneChanged', eventData: { sceneName } } })); };
  return { wss, lenh, canh, cong, phatSuKien, dong: () => new Promise((r) => { for (const c of wss.clients) c.terminate(); wss.close(r); }) };
}

test('nối OBS: xác thực v5, chuyển cảnh, nghe đổi cảnh, tạo 3 cảnh Moza chạy lại được, sai mật khẩu báo rõ', async (t) => {
  const g = obsGia();
  t.after(() => g.dong());
  // Chuỗi xác thực theo tài liệu obs-websocket v5.
  const crypto = require('node:crypto');
  const b = (s) => crypto.createHash('sha256').update(s).digest('base64');
  assert.equal(chuoiXacThuc('mk', 'a', 'b'), b(b('mka') + 'b'));

  const obs = new KetNoiObs({ layCauHinh: () => ({ cong: g.cong(), mat_khau: 'bi-mat' }) });
  t.after(() => obs.dong());
  const st = await obs.noi();
  assert.equal(st.ket_noi, true);
  assert.equal(st.phien_ban, '32.2.0');

  await obs.chuyenCanh('san_pham');
  assert.deepEqual(g.lenh.at(-1), { t: 'SetCurrentProgramScene', d: { sceneName: CANH.san_pham } });

  const doi = new Promise((ok) => obs.once('doi_canh', ok));
  g.phatSuKien(CANH.phong);
  assert.equal(await doi, CANH.phong, 'người dùng tự đổi cảnh trong OBS → MOZA biết');

  await obs.taoCanhMoza(5173);
  assert.deepEqual([...g.canh.keys()], Object.values(CANH));
  const nguon = g.lenh.filter((x) => x.t === 'CreateInput');
  assert.equal(nguon.find((x) => x.d.inputName === NGUON.man_hinh).d.inputSettings.url, 'http://127.0.0.1:5173/man-hinh-san-pham.html');
  assert.equal(nguon.find((x) => x.d.inputName === NGUON.thanh_chu).d.sceneName, CANH.phong);
  assert.ok(g.canh.get(CANH.ca_hai).some((x) => x.sourceName === CANH.phong), 'cảnh Cả hai lồng cảnh Phòng live');
  // Khung dọc mặc định: OBS 1080×1920, nguồn trình duyệt 1080×1920.
  assert.deepEqual(g.lenh.find((x) => x.t === 'SetVideoSettings').d, { baseWidth: 1080, baseHeight: 1920, outputWidth: 1080, outputHeight: 1920 });
  assert.equal(nguon.find((x) => x.d.inputName === NGUON.man_hinh).d.inputSettings.width, 1080);
  const soMuc = [...g.canh.values()].reduce((n, x) => n + x.length, 0);
  const kq = await obs.taoCanhMoza(5173, 'ngang'); // lần hai: không hỏng, không nhân đôi; đổi sang khung ngang
  assert.equal([...g.canh.values()].reduce((n, x) => n + x.length, 0), soMuc);
  assert.deepEqual(kq.khung, { ten: 'ngang', rong: 1920, cao: 1080 });
  assert.deepEqual(g.lenh.filter((x) => x.t === 'SetVideoSettings').at(-1).d, { baseWidth: 1920, baseHeight: 1080, outputWidth: 1920, outputHeight: 1080 });
  assert.ok(g.lenh.some((x) => x.t === 'SetInputSettings' && x.d.inputName === NGUON.thanh_chu && x.d.inputSettings.width === 1920), 'nguồn cũ đổi cỡ theo khung');

  const sai = new KetNoiObs({ layCauHinh: () => ({ cong: g.cong(), mat_khau: 'nham' }) });
  await assert.rejects(sai.noi(), (e) => e.ma === 'OBS_SAI_MAT_KHAU');
  const tat = new KetNoiObs({ layCauHinh: () => ({ cong: 1, mat_khau: '' }) });
  await assert.rejects(tat.noi({ toiDaMs: 2000 }), (e) => ['OBS_KHONG_NOI_DUOC', 'OBS_KHONG_TRA_LOI'].includes(e.ma));
});

test('dựng nội dung màn hình từ dữ liệu thật và hiểu lệnh người dẫn', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { dung, docLenh } = require('../server/man-hinh-san-pham');
  taoSanPhamMau(); // áo 12, Đen/Trắng × M/L, ảnh màu Đen, bảng size S–XL
  taoSanPhamMau({ so: 20, ten: 'Chân váy xếp ly', danhMuc: 'chan_vay', gia: '199k', mau: ['Be'], co: ['M'] });
  taoSanPhamMau({ so: 30, ten: 'Áo nháp', trangThai: 'nhap' });

  const gt = dung({ mau: 'gioi_thieu', so: 12 });
  assert.equal(gt.san_pham.gia, '289.000đ');
  assert.equal(gt.san_pham.cu_phap, 'chốt 12 + màu + size');
  assert.equal(gt.san_pham.con_hang.length, 4);
  const bs = dung({ mau: 'bang_size', so: 12, chieu_cao: 158, can_nang: 50 });
  assert.deepEqual(bs.dong_hop, ['M'], '1m58 50kg → dòng M được tô (F-82: dạng mảng)');
  assert.equal(bs.so_do, undefined, 'F-82: không gửi số đo khách lên màn hình');
  assert.deepEqual(dung({ mau: 'bang_size', so: 12, can_nang: 60 }).dong_hop, ['L']);
  assert.equal(dung({ mau: 'anh', so: 12, mau_sac: 'den' }).mau_sac, 'Đen');
  assert.throws(() => dung({ mau: 'anh', so: 12, mau_sac: 'Trắng' }), /chưa có ảnh màu Trắng.*có ảnh: Đen/);
  assert.throws(() => dung({ mau: 'gioi_thieu', so: 30 }), (e) => e.ma === 'SP_KHONG_BAN_DUOC', 'sản phẩm không Đang bán không chiếu');
  assert.equal(dung({ mau: 'video', so: 12 }).mau, 'trinh_chieu', 'chưa có video → trình chiếu ảnh');
  assert.deepEqual(dung({ mau: 'danh_sach' }).san_pham_ds.map((x) => x.so), [12, 20]);
  assert.throws(() => dung({ mau: 'la' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');

  assert.deepEqual(docLenh('Mai ơi, chiếu bảng size áo 12'), { chieu: { mau: 'bang_size', so: 12, mau_sac: null }, canh: 'san_pham' });
  assert.deepEqual(docLenh('chiếu màu trắng', { soDangNoi: 12 }).chieu, { mau: 'anh', so: 12, mau_sac: 'Trắng' });
  assert.deepEqual(docLenh('Mai ơi quay lại camera'), { canh: 'phong' });
  assert.deepEqual(docLenh('cho xem cả hai'), { canh: 'ca_hai' });
  assert.equal(docLenh('chiếu danh sách sản phẩm').chieu.mau, 'danh_sach');
  assert.equal(docLenh('Mai ơi áo 12 còn size M không'), null, 'câu hỏi thường không phải lệnh màn hình');
  assert.equal(docLenh('cả nhà ơi hôm nay trời đẹp'), null);
});

test('hai chế độ chuyển cảnh: người dẫn dẫn → gợi ý; Đội AI dẫn → tự chuyển rồi tự về; người dẫn luôn thắng', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const live = require('../server/nghiep-vu/live');
  const kichBan = require('../server/nghiep-vu/kich-ban');
  const { ManHinhSanPham } = require('../server/man-hinh-san-pham');
  taoSanPhamMau();
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'] });
  taoSanPhamMau({ so: 20, ten: 'Chân váy xếp ly', danhMuc: 'chan_vay', gia: '199k', mau: ['Be'], co: ['M'] });
  const kb = kichBan.taoNhanh();

  // OBS giả trong bộ nhớ: đã nối, ghi cảnh được chuyển.
  const daChuyen = [];
  const obs = Object.assign(new EventEmitter(), {
    trangThai: () => ({ ket_noi: true }), noi: async () => ({}), dong() {},
    async chuyenCanh(k) { daChuyen.push(k); return CANH[k]; },
  });
  const suKien = [];
  const bus = new EventEmitter();
  const mh = new ManHinhSanPham({ phat: (type, d) => suKien.push({ type, ...d }), bus, obs });
  t.after(() => mh.dong());
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

  // Chỉ gợi ý (người dẫn dẫn): AI chiếu → gợi ý, không tự chuyển.
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  assert.equal(mh.cheDo(), 'goi_y');
  live.doiDoan(p.id, 1);
  bus.emit('su_kien', 'live.doan', { phien_id: p.id, doan: 1 });
  await Promise.resolve();
  assert.equal(mh.hien.mau, 'gioi_thieu', 'đổi đoạn → tự chiếu thẻ giới thiệu món của đoạn');
  assert.equal(mh.hien.san_pham.so, 12);
  mh.chieu({ mau: 'bang_size', so: 12, can_nang: 50 }, { boi: 'ai', lyDo: 'Nhiều bạn hỏi size' });
  assert.equal(mh.canh.goi_y.canh, 'san_pham');
  assert.equal(daChuyen.length, 0);
  assert.ok(suKien.some((e) => e.type === 'canh.cap_nhat' && e.goi_y?.ly_do === 'Nhiều bạn hỏi size'));
  await mh.chuyenCanh('san_pham', { boi: 'nguoi' }); // người dẫn bấm "Chiếu lên"
  assert.deepEqual(daChuyen, ['san_pham']);
  assert.equal(mh.canh.goi_y, null);
  t.mock.timers.tick(20000);
  assert.equal(mh.canh.goi_y?.canh, 'ca_hai', '20 giây trên cảnh Sản phẩm → gợi ý quay lại Cả hai');

  // Người dẫn vừa chọn tay: đổi đoạn trong 20 giây không đè lên.
  mh.chieu({ mau: 'chi_tiet', so: 12 }, { boi: 'nguoi' });
  assert.equal(mh.chieu({ mau: 'gioi_thieu', so: 15 }, { boi: 'tu_dong' }).bo_qua, true);
  t.mock.timers.tick(21000);
  assert.equal(mh.chieu({ mau: 'gioi_thieu', so: 15 }, { boi: 'tu_dong' }).hien.san_pham.so, 15);

  // Đội AI dẫn: AI chiếu → tự chuyển sang Sản phẩm, 15 giây sau tự về Cả hai.
  live.datCheDo(p.id, { che_do_ai: 'doi' });
  assert.equal(mh.cheDo(), 'tu_chuyen');
  await mh.chuyenCanh('ca_hai', { boi: 'nguoi' });
  daChuyen.length = 0;
  mh.chieu({ mau: 'anh', so: 12, mau_sac: 'Đen' }, { boi: 'ai' });
  await Promise.resolve();
  assert.deepEqual(daChuyen, ['san_pham']);
  t.mock.timers.tick(15000);
  await Promise.resolve();
  assert.deepEqual(daChuyen, ['san_pham', 'ca_hai']);

  // Người dẫn giành lại: bấm Phòng live → hẹn tự về của AI bị hủy.
  mh.chieu({ mau: 'phoi_do', so: 12, so_phoi: 20 }, { boi: 'ai' });
  await Promise.resolve();
  await mh.chuyenCanh('phong', { boi: 'nguoi' });
  t.mock.timers.tick(40000);
  await Promise.resolve();
  assert.equal(daChuyen.at(-1), 'phong');

  // Kết thúc live → màn chờ; người chốt → thanh chữ báo.
  bus.emit('su_kien', 'live.chot', { ten: 'Lan', mon: 'áo 12 Đen M', luc: 'x' });
  await Promise.resolve();
  assert.ok(suKien.some((e) => e.type === 'mhsp.chot' && e.ten === 'Lan'));
  bus.emit('su_kien', 'live.ket_thuc', {});
  await Promise.resolve();
  assert.equal(mh.hien.mau, 'cho');
});

test('API màn hình, chuyển cảnh mô phỏng khi chưa nối OBS, tải video sản phẩm', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);
  const s = taoSanPhamMau();
  let r = await pm.goi('GET', '/api/man-hinh');
  assert.equal(r.ma, 200);
  assert.equal(r.than.hien.mau, 'cho');
  assert.equal(r.than.obs_cai_dat.co_mat_khau, false);

  r = await pm.goi('POST', '/api/man-hinh/chieu', { mau: 'bang_size', so: 12, chieu_cao: 158 });
  assert.equal(r.ma, 200);
  assert.deepEqual(r.than.hien.dong_hop, ['M']);
  r = await pm.goi('POST', '/api/canh/chuyen', { canh: 'san_pham' });
  assert.equal(r.than.mo_phong, true, 'chưa nối OBS: chỉ mô phỏng, vẫn tập được');
  r = await pm.goi('POST', '/api/canh/chuyen', { canh: 'la' });
  assert.equal(r.ma, 400);

  // Mật khẩu OBS vào .env, trình duyệt chỉ thấy "đã có".
  r = await pm.goi('PUT', '/api/obs', { cong: 4455, mat_khau: '"abc123"' });
  assert.equal(r.than.co_mat_khau, true);
  assert.equal(require('../server/khoa').layObs(), 'abc123');
  assert.equal(JSON.stringify(r.than).includes('abc123'), false);
  r = await pm.goi('PUT', '/api/obs', { cong: 99999 });
  assert.equal(r.ma, 400);

  // Video: MP4 thật (đầu tệp 'ftyp'), tệp khác bị từ chối; lưu vào sản phẩm, phát lại được, có trong thẻ cho AI.
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(300, 1)]);
  const tai = async (buf) => { const x = await fetch(`${pm.goc}/api/video-tam`, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: buf }); return { ma: x.status, than: await x.json() }; };
  const v = await tai(mp4);
  assert.equal(v.ma, 201);
  assert.equal((await tai(Buffer.from('khong phai video'))).ma, 400);
  r = await pm.goi('PUT', `/api/san-pham/${s.san_pham.id}`, { video: [{ tep: v.than.tep, mau: 'trắng' }] });
  assert.equal(r.ma, 200, JSON.stringify(r.than));
  const sp = require('../server/nghiep-vu/san-pham');
  assert.deepEqual(sp.laySanPham(s.san_pham.id).video, [{ tep: v.than.tep, mau: 'Trắng' }]);
  const phat = await fetch(`${pm.goc}/api/video/${s.san_pham.id}/${v.than.tep}`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(phat.status, 206);
  r = await pm.goi('POST', '/api/man-hinh/chieu', { mau: 'video', so: 12, mau_sac: 'Trắng' });
  assert.equal(r.than.hien.video.url, `/api/video/${s.san_pham.id}/${v.than.tep}`);
  assert.equal((await pm.goi('GET', '/api/video/sp_xxxxxxxxxxxx/..%2F..%2F.env')).ma, 404);
});
