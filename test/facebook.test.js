'use strict';

// Facebook thật (M5 phần 1): cổng webhook, sự kiện, nhịp gọi, Graph API, đường hầm, kết nối — không gọi mạng thật.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { moCSDLTam, moPhanMem } = require('./ho-tro');

const BI_MAT = 'bi-mat-ung-dung-thu-1234';

function ky(than) {
  return 'sha256=' + crypto.createHmac('sha256', BI_MAT).update(than).digest('hex');
}

/** fetch giả: ghi lại các lần gọi, trả theo bảng `tra(url, init)`. */
function fetchGia(tra) {
  const goi = [];
  const f = async (url, init = {}) => {
    const u = new URL(String(url));
    goi.push({ url: u, init, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body ?? null });
    const kq = await tra(u, init);
    const trangThai = kq?.status ?? 200;
    const dau = new Map(Object.entries(kq?.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      ok: trangThai < 400,
      status: trangThai,
      headers: { get: (k) => dau.get(k.toLowerCase()) ?? null },
      json: async () => kq?.json ?? {},
      body: kq?.body ?? null,
    };
  };
  f.goi = goi;
  return f;
}

test('cổng webhook (F-24, mục 9)', async (t) => {
  const { moCongWebhook, chuKyDung } = require('../server/facebook/webhook');
  const nhan = [];
  const cong = await moCongWebhook({ cong: 0, layBiMat: () => BI_MAT, layVerifyToken: () => 'ma-xac-minh', khiCoTin: (b) => nhan.push(b) });
  const goc = `http://127.0.0.1:${cong.cong}`;
  t.after(() => cong.dong());

  await t.test('chỉ nghe ở 127.0.0.1', () => {
    assert.equal(cong.server.address().address, '127.0.0.1');
  });

  await t.test('GET xác minh: đúng mã mới trả challenge', async () => {
    const dung = await fetch(`${goc}/webhook?hub.mode=subscribe&hub.verify_token=ma-xac-minh&hub.challenge=12345`);
    assert.equal(dung.status, 200);
    assert.equal(await dung.text(), '12345');
    const sai = await fetch(`${goc}/webhook?hub.mode=subscribe&hub.verify_token=sai&hub.challenge=12345`);
    assert.equal(sai.status, 403);
    assert.equal(await sai.text(), '');
  });

  await t.test('POST: thiếu / sai chữ ký bị từ chối, không tạo dữ liệu', async () => {
    const than = JSON.stringify({ object: 'page', entry: [] });
    const thieu = await fetch(`${goc}/webhook`, { method: 'POST', body: than });
    assert.equal(thieu.status, 403);
    const sai = await fetch(`${goc}/webhook`, { method: 'POST', body: than, headers: { 'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64) } });
    assert.equal(sai.status, 403);
    const khacKhoa = 'sha256=' + crypto.createHmac('sha256', 'khoa-khac').update(than).digest('hex');
    assert.equal((await fetch(`${goc}/webhook`, { method: 'POST', body: than, headers: { 'X-Hub-Signature-256': khacKhoa } })).status, 403);
    await new Promise((r) => setImmediate(r));
    assert.equal(nhan.length, 0);
  });

  await t.test('POST: đúng chữ ký → 200 ngay, xử lý sau', async () => {
    const than = JSON.stringify({ object: 'page', entry: [{ id: '1', messaging: [] }], chu: 'Tiếng Việt có dấu' });
    const r = await fetch(`${goc}/webhook`, { method: 'POST', body: than, headers: { 'X-Hub-Signature-256': ky(than) } });
    assert.equal(r.status, 200);
    await new Promise((x) => setTimeout(x, 20));
    assert.equal(nhan.length, 1);
    assert.equal(nhan[0].chu, 'Tiếng Việt có dấu');
  });

  await t.test('POST quá 1 MB bị từ chối', async () => {
    const than = 'x'.repeat(1024 * 1024 + 10);
    const r = await fetch(`${goc}/webhook`, { method: 'POST', body: than, headers: { 'X-Hub-Signature-256': ky(than) } }).catch(() => ({ status: 413 }));
    assert.equal(r.status, 413);
  });

  await t.test('đường khác → 404', async () => {
    assert.equal((await fetch(`${goc}/api/san-pham`)).status, 404);
  });

  await t.test('chữ ký so trên đúng các byte nhận được', () => {
    const b = Buffer.from('{"a":"\\u00e1"}');
    assert.ok(chuKyDung(b, ky(b), BI_MAT));
    assert.ok(!chuKyDung(Buffer.from('{"a":"á"}'), ky(b), BI_MAT));
  });
});

test('đổi webhook thành sự kiện MOZA', () => {
  const { tuWebhook } = require('../server/facebook/su-kien');
  const ds = tuWebhook({
    object: 'page',
    entry: [{
      id: 'P1',
      messaging: [
        { sender: { id: 'U1' }, recipient: { id: 'P1' }, timestamp: 1790000000000, message: { mid: 'm1', text: 'Áo 12 còn size M không?' } },
        { sender: { id: 'P1' }, recipient: { id: 'U1' }, timestamp: 1790000001000, message: { mid: 'm2', text: 'Dạ còn', is_echo: true, app_id: 263902037430900 } },
        { sender: { id: 'U1' }, recipient: { id: 'P1' }, timestamp: 1790000002000, message: { mid: 'm3', attachments: [{ type: 'image' }] } },
        { sender: { id: 'U1' }, recipient: { id: 'P1' }, timestamp: 1790000003000, read: { watermark: 1 } },
        // Khách gửi ảnh mẫu muốn mua (F-63): sự kiện mang theo đường dẫn ảnh để tìm mẫu theo ảnh.
        { sender: { id: 'U3' }, recipient: { id: 'P1' }, timestamp: 1790000003500,
          message: { mid: 'm4', text: 'shop có mẫu này không', attachments: [{ type: 'image', payload: { url: 'https://cdn.fb.test/anh-mau.jpg' } }] } },
      ],
      changes: [
        { field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'C1', post_id: 'P1_9', parent_id: 'P1_9', from: { id: 'U2', name: 'Lan' }, message: 'giá bao nhiêu?', created_time: 1790000004 } },
        { field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'C2', post_id: 'P1_9', from: { id: 'P1', name: 'Page' }, message: 'trả lời' } },
        { field: 'feed', value: { item: 'reaction', verb: 'add' } },
        { field: 'live_videos', value: { id: 'L1', status: 'live' } },
      ],
    }],
  }, 'P1');
  assert.deepEqual(ds.map((e) => e.loai), ['tin_nhan', 'tin_vong', 'tin_nhan', 'tin_nhan', 'binh_luan_bai', 'live_doi']);
  assert.equal(ds[0].psid, 'U1');
  assert.equal(ds[0].anh_url, undefined, 'tin chữ không có ảnh');
  assert.equal(ds[1].psid, 'U1');
  assert.equal(ds[1].app_id, '263902037430900');
  assert.equal(ds[2].noi_dung, '[hình ảnh]');
  assert.equal(ds[2].anh_url, undefined, 'ảnh không có đường dẫn thì không có anh_url');
  assert.equal(ds[3].psid, 'U3');
  assert.equal(ds[3].noi_dung, 'shop có mẫu này không');
  assert.equal(ds[3].anh_url, 'https://cdn.fb.test/anh-mau.jpg');
  assert.equal(ds[4].parent_id, null);
  assert.equal(ds[4].ten, 'Lan');
  assert.equal(ds[5].live_id, 'L1');
});

test('Facebook giả: gửi ảnh ghi vào luồng chat; khách giả gửi ảnh có anh_url (F-56, F-63)', async () => {
  const { FacebookGia } = require('../server/facebook/gia');
  const fb = new FacebookGia();
  const doiChat = [];
  fb.on('chat', (e) => doiChat.push(e));
  const ev = fb.khachNhan({ page_id: 'page_gia', ten: 'Lan', noi_dung: '', anh: 'abc123.jpg' });
  assert.equal(ev.noi_dung, '[hình ảnh]');
  assert.equal(ev.anh_url, 'tam:abc123.jpg');
  const anh = Buffer.alloc(321, 7);
  const kq = await fb.guiAnh({ page_id: 'page_gia', psid: ev.psid, anh, ten: 'ao-12-den.jpg' });
  assert.match(kq.mid, /^midgia/);
  const cuoi = fb.luongChat('page_gia', ev.psid).at(-1);
  assert.equal(cuoi.tu, 'page');
  assert.equal(cuoi.anh, 'ao-12-den.jpg');
  assert.equal(cuoi.co, 321);
  assert.equal(cuoi.mid, kq.mid);
  assert.equal(doiChat.length, 2, 'màn hình chat giả được báo cả tin khách lẫn ảnh shop gửi');
  fb.hongGui = true;
  await assert.rejects(fb.guiAnh({ page_id: 'page_gia', psid: ev.psid, anh, ten: 'x.jpg' }), (e) => e.ma === 'FB_MAT_MANG');
});

test('nhịp gọi theo header giới hạn (F-06)', async (t) => {
  const { NhipGoi, docHeader } = require('../server/facebook/nhip-goi');
  let bay = 1000000;
  const ngu = [];
  const n = new NhipGoi({ bayGio: () => bay, ngu: async (ms) => { ngu.push(ms); bay += ms; } });

  await t.test('đọc mức dùng cao nhất', () => {
    const h = { 'x-app-usage': '{"call_count":12,"total_time":30,"total_cputime":5}',
      'x-business-use-case-usage': '{"123":[{"type":"pages","call_count":64,"total_time":2,"total_cputime":1,"estimated_time_to_regain_access":0}]}' };
    assert.deepEqual(docHeader((k) => h[k] ?? null), { muc: 64, choPhut: 0 });
  });

  await t.test('> 50% thì giãn nhịp', async () => {
    n.sauKhiGoi((k) => (k === 'x-app-usage' ? '{"call_count":60}' : null));
    await n.truocKhiGoi();
    await n.truocKhiGoi();
    assert.ok(ngu.at(-1) >= 1900);
  });

  await t.test('bị giới hạn → ngừng đúng số phút Meta báo; chờ quá lâu thì báo lỗi ngay', async () => {
    const la = n.khiLoi(80001, (k) => (k === 'x-business-use-case-usage' ? '{"1":[{"estimated_time_to_regain_access":3}]}' : null));
    assert.equal(la, true);
    assert.ok(n.trangThai().dang_gioi_han);
    assert.ok(n.trangThai().con_giay >= 179);
    await assert.rejects(n.truocKhiGoi({ toiDaChoMs: 5000 }), /giới hạn/);
  });

  await t.test('không có số phút → lùi 5 s, 10 s, …', () => {
    const m = new NhipGoi({ bayGio: () => 0 });
    m.khiLoi(4);
    assert.equal(m.canCho(), 5000);
    m.khiLoi(4);
    assert.equal(m.canCho(), 10000);
    assert.equal(m.khiLoi(100), false);
  });
});

test('gọi Graph API: lỗi đổi thành mã MOZA, không lộ mã truy cập', async (t) => {
  const { taoGraph, doiLoi } = require('../server/facebook/graph');
  const { NhipGoi } = require('../server/facebook/nhip-goi');

  await t.test('bảng đổi lỗi', () => {
    assert.equal(doiLoi({ code: 190 }).ma, 'FB_MA_HET_HAN');
    assert.equal(doiLoi({ code: 613 }).ma, 'FB_GIOI_HAN_GOI');
    assert.equal(doiLoi({ code: 80006 }).ma, 'FB_GIOI_HAN_GOI');
    assert.equal(doiLoi({ code: 10, error_subcode: 2018278 }).ma, 'NGOAI_CUA_SO_24H');
    assert.equal(doiLoi({ code: 200, error_subcode: 2018028 }).ma, 'FB_CHUA_DUYET');
    assert.equal(doiLoi({ code: 10 }).ma, 'FB_THIEU_QUYEN');
  });

  await t.test('kèm appsecret_proof; lỗi 190 báo ra ngoài; thông báo lỗi không chứa mã', async () => {
    const baoLoi = [];
    const f = fetchGia(() => ({ status: 400, json: { error: { code: 190, message: 'Error validating access token' } } }));
    const g = taoGraph({ layMa: () => 'MA_PAGE_BI_MAT_123456', layBiMat: () => BI_MAT, nhip: new NhipGoi(), fetch: f, khiLoi: (e) => baoLoi.push(e.ma) });
    const e = await g.goi('/123/messages', { method: 'POST', body: { a: 1 } }).catch((x) => x);
    assert.equal(e.ma, 'FB_MA_HET_HAN');
    assert.ok(!e.message.includes('MA_PAGE_BI_MAT_123456'));
    assert.deepEqual(baoLoi, ['FB_MA_HET_HAN']);
    const u = f.goi[0].url;
    assert.equal(u.pathname, '/v26.0/123/messages');
    assert.equal(u.searchParams.get('appsecret_proof'), crypto.createHmac('sha256', BI_MAT).update('MA_PAGE_BI_MAT_123456').digest('hex'));
  });

  await t.test('chưa có mã → FB_CHUA_KET_NOI, không gọi mạng', async () => {
    const f = fetchGia(() => ({}));
    const g = taoGraph({ layMa: () => '', nhip: new NhipGoi(), fetch: f });
    await assert.rejects(g.goi('/me'), (e) => e.ma === 'FB_CHUA_KET_NOI');
    assert.equal(f.goi.length, 0);
  });

  await t.test('mất mạng → FB_MAT_MANG (nơi gửi coi là "không rõ", không tự gửi lại)', async () => {
    const g = taoGraph({ layMa: () => 'x', nhip: new NhipGoi(), fetch: async () => { throw new TypeError('fetch failed'); } });
    await assert.rejects(g.goi('/me'), (e) => e.ma === 'FB_MAT_MANG');
  });
});

test('Facebook thật theo hợp đồng chung (F-19, F-20, F-25, #37)', async (t) => {
  const { FacebookPage, FacebookThat } = require('../server/facebook/that');
  const { taoGraph } = require('../server/facebook/graph');
  const { NhipGoi } = require('../server/facebook/nhip-goi');
  const tao = (tra, pageId = 'P1') => {
    const f = fetchGia(tra);
    const graph = taoGraph({ layMa: () => '', nhip: new NhipGoi(), fetch: f });
    return { fb: new FacebookPage({ graph, pageId, layMa: () => 'MA', fetch: f }), f };
  };

  await t.test('nhiều Page: live tìm trên mọi Page, bình luận và gửi tin dùng đúng mã của Page', async () => {
    const f = fetchGia((u) => {
      if (u.pathname.endsWith('/live_videos')) {
        const page = u.pathname.split('/')[2];
        return { json: { data: page === 'P2' ? [{ id: 'L2', title: 'Live P2', status: 'LIVE' }] : [] } };
      }
      if (u.pathname.endsWith('/messages')) return { json: { message_id: 'mid.x' } };
      return { json: { success: true } };
    });
    const graph = taoGraph({ layMa: () => '', nhip: new NhipGoi(), fetch: f });
    const p1 = new FacebookPage({ graph, pageId: 'P1', layMa: () => 'MA_P1', ten: 'Linen House', fetch: f });
    const p2 = new FacebookPage({ graph, pageId: 'P2', layMa: () => 'MA_P2', ten: 'Linen House Hà Đông', fetch: f });
    const fb = new FacebookThat({ layPages: () => [p1, p2] });
    const live = await fb.timLiveDangPhat();
    assert.deepEqual(live.map((l) => [l.id, l.page_id, l.tieu_de]), [['L2', 'P2', 'Linen House Hà Đông · Live P2']]);
    fb.nhoBinhLuan('L2_c9', 'P2');
    await fb.anBinhLuan('L2_c9');
    assert.equal(f.goi.at(-1).url.searchParams.get('access_token'), 'MA_P2');
    await fb.guiTinNhan({ page_id: 'P1', psid: 'U1', noi_dung: 'Chào' });
    assert.equal(f.goi.at(-1).url.pathname, '/v26.0/P1/messages');
    assert.equal(f.goi.at(-1).url.searchParams.get('access_token'), 'MA_P1');
    await assert.rejects(fb.guiTinNhan({ page_id: 'P3', psid: 'U1', noi_dung: 'x' }), (e) => e.ma === 'FB_CHUA_KET_NOI');
  });

  await t.test('tìm live đang phát', async () => {
    const { fb, f } = tao(() => ({ json: { data: [{ id: 'L1', title: 'Xả hàng hè', creation_time: '2026-09-24T01:00:00+0000', status: 'LIVE' }] } }));
    const ds = await fb.timLiveDangPhat();
    assert.deepEqual(ds.map((l) => l.id), ['L1']);
    assert.equal(f.goi[0].url.searchParams.get('broadcast_status'), '["LIVE"]');
  });

  await t.test('luồng bình luận trực tiếp: đọc server-sent events, bỏ ping', async () => {
    const khoi = [
      ': ping\n\n',
      'data: {"id":"c1","message":"Giá bao nhiêu","from":{"id":"u1","name":"Hoa"},"created_time":"2026-09-24T01:00:05+0000"}\n\n',
      'data: {"id":"c2","message":"ok",',
      '"from":{"id":"u2","name":"Nam"}}\n\n',
    ];
    const { fb } = tao(() => ({ body: (async function* () { for (const k of khoi) yield Buffer.from(k); })() }));
    const nhan = [];
    const hong = await new Promise((ok) => fb.moLuongBinhLuan('L1', (bl) => nhan.push(bl), ok));
    assert.deepEqual(nhan.map((b) => [b.id, b.ten, b.noi_dung]), [['c1', 'Hoa', 'Giá bao nhiêu'], ['c2', 'Nam', 'ok']]);
    assert.match(hong.message, /đóng/); // luồng hết → báo hỏng một lần để phòng live chuyển sang hỏi định kỳ
  });

  await t.test('hỏi định kỳ: không để Meta lọc bớt bình luận', async () => {
    const { fb, f } = tao(() => ({ json: { data: [{ id: 'c2', message: 'b', created_time: '2026-09-24T01:00:02+0000' }, { id: 'c1', message: 'a', created_time: '2026-09-24T01:00:01+0000' }] } }));
    const ds = await fb.docBinhLuan('L1', '2026-09-24T01:00:00.000Z');
    assert.deepEqual(ds.map((b) => b.id), ['c1', 'c2']);
    const q = f.goi[0].url.searchParams;
    assert.equal(q.get('live_filter'), 'no_filter');
    assert.equal(q.get('filter'), 'stream');
    assert.ok(Number(q.get('since')) > 0);
  });

  await t.test('gửi Messenger, trả lời, nhắn riêng, ẩn bình luận', async () => {
    const { fb, f } = tao((u) => {
      if (u.pathname.endsWith('/messages')) return { json: { recipient_id: 'U9', message_id: 'mid.1' } };
      if (u.pathname.endsWith('/comments')) return { json: { id: 'C_R' } };
      return { json: { success: true } };
    });
    assert.deepEqual(await fb.guiTinNhan('U1', 'Chào'), { mid: 'mid.1' });
    assert.equal(f.goi[0].body.messaging_type, 'RESPONSE');
    assert.deepEqual(await fb.traLoiBinhLuan('C1', 'Nhắn tin cho Page nhé'), { id: 'C_R' });
    assert.deepEqual(await fb.nhanRieng('C1', 'Chào bạn'), { mid: 'mid.1', psid: 'U9' });
    assert.deepEqual(f.goi[2].body.recipient, { comment_id: 'C1' });
    assert.equal(await fb.anBinhLuan('C1'), true);
    assert.equal(f.goi[3].body.is_hidden, true);
  });

  await t.test('gửi ảnh Messenger: FormData nhiều phần tới /{page}/messages, tệp ở ô filedata (F-56)', async () => {
    const { fb, f } = tao((u) => (u.pathname.endsWith('/messages') ? { json: { recipient_id: 'U1', message_id: 'mid.anh' } } : { json: {} }));
    const anh = Buffer.alloc(500, 9);
    assert.deepEqual(await fb.guiAnh('U1', anh, 'ao-12-den.png'), { mid: 'mid.anh' });
    const g = f.goi.at(-1);
    assert.equal(g.url.pathname, '/v26.0/P1/messages');
    assert.equal(g.url.searchParams.get('access_token'), 'MA');
    assert.equal(g.init.method, 'POST');
    assert.ok(g.init.body instanceof FormData, 'gửi dạng multipart, không phải JSON');
    assert.equal(g.init.headers?.['Content-Type'], undefined, 'để fetch tự đặt kiểu multipart kèm ranh giới');
    assert.deepEqual(JSON.parse(g.init.body.get('recipient')), { id: 'U1' });
    assert.equal(g.init.body.get('messaging_type'), 'RESPONSE');
    assert.deepEqual(JSON.parse(g.init.body.get('message')), { attachment: { type: 'image', payload: { is_reusable: false } } });
    const tep = g.init.body.get('filedata');
    assert.equal(tep.name, 'ao-12-den.png');
    assert.equal(tep.type, 'image/png');
    assert.equal(tep.size, 500);
    assert.deepEqual(Buffer.from(await tep.arrayBuffer()), anh);
    await fb.guiAnh('U1', anh);
    assert.equal(f.goi.at(-1).init.body.get('filedata').type, 'image/jpeg', 'mặc định ảnh JPEG');
  });

  await t.test('lưới an toàn: tin khách, tin Page gửi, bình luận bài đăng', async () => {
    const { fb } = tao((u) => {
      if (u.pathname.endsWith('/conversations')) {
        return { json: { data: [{ updated_time: '2026-09-24T02:00:00+0000', messages: { data: [
          { id: 'm2', message: 'Dạ', from: { id: 'P1' }, to: { data: [{ id: 'U1' }] }, created_time: '2026-09-24T02:00:00+0000' },
          { id: 'm1', message: 'Hỏi áo 12', from: { id: 'U1', name: 'Lan' }, created_time: '2026-09-24T01:59:00+0000' },
          { id: 'm0', message: 'cũ', from: { id: 'U1' }, created_time: '2026-09-20T01:00:00+0000' },
        ] } }] } };
      }
      return { json: { data: [{ id: 'P1_9', comments: { data: [{ id: 'C1', message: 'giá bao nhiêu?', from: { id: 'U2', name: 'Nam' }, created_time: '2026-09-24T01:58:00+0000' }] } }] } };
    });
    const ds = await fb.docTinMoi('2026-09-24T00:00:00.000Z');
    assert.deepEqual(ds.map((e) => [e.loai, e.mid || e.comment_id]), [['binh_luan_bai', 'C1'], ['tin_nhan', 'm1'], ['tin_vong', 'm2']]);
    assert.equal(ds[2].psid, 'U1');
  });
});

test('đường hầm Cloudflare (F-24)', async (t) => {
  const { DuongHam } = require('../server/facebook/duong-ham');

  function tienGia() {
    const p = new EventEmitter();
    p.stderr = new EventEmitter();
    p.kill = () => p.emit('exit', 0);
    return p;
  }

  await t.test('chưa cài cloudflared → báo cách cài, không chạy gì', async () => {
    const d = new DuongHam({ congDich: 5174, tim: () => null });
    assert.equal(await d.mo(), null);
    assert.equal(d.trangThai().trang_thai, 'chua_cai');
    assert.match(d.trangThai().loi, /winget install/);
  });

  await t.test('đọc địa chỉ từ /quicktunnel, chờ /ready; rớt thì tự mở lại', async () => {
    const tien = [];
    let lanMo = 0;
    const f = async (url) => {
      const u = String(url);
      if (u.endsWith('/quicktunnel')) return { ok: true, json: async () => ({ hostname: `thu-${lanMo}.trycloudflare.com` }) };
      return { ok: true };
    };
    const d = new DuongHam({
      congDich: 5174, tim: () => 'cloudflared.exe', fetch: f, luiMs: [10],
      spawn: (exe, args) => { lanMo += 1; const p = tienGia(); p.args = args; tien.push(p); return p; },
    });
    const sanSang = [];
    d.on('san_sang', (u) => sanSang.push(u));
    assert.equal(await d.mo(), 'https://thu-1.trycloudflare.com');
    assert.ok(tien[0].args.includes('--metrics'));
    assert.ok(tien[0].args.includes('http://127.0.0.1:5174'));
    tien[0].emit('exit', 1);
    assert.equal(d.trangThai().trang_thai, 'rot');
    await new Promise((r) => setTimeout(r, 900));
    assert.deepEqual(sanSang, ['https://thu-1.trycloudflare.com', 'https://thu-2.trycloudflare.com']);
    d.dong();
    assert.equal(d.trangThai().trang_thai, 'tat');
  });
});

test('kết nối Facebook: đăng ký webhook, đổi mã Page, lọc tin trước mốc', async (t) => {
  const db = await moCSDLTam();
  t.after(() => db.dong());
  const khoa = require('../server/khoa');
  const { KetNoiFacebook, TRUONG } = require('../server/facebook/ket-noi');

  await t.test('chưa đủ mã → không mở cổng, trạng thái xám', async () => {
    const k = new KetNoiFacebook({ congWebhook: 0 });
    await k.batDau();
    assert.equal(k.webhook, null);
    assert.equal(k.trangThaiGon().muc, 'xam');
    assert.equal(k.guiDuoc(), false);
  });

  await t.test('đổi mã người dùng ngắn hạn → chọn nhiều Page → mã Page không hết hạn, ghi .env', async () => {
    khoa.datFb('app_id', '1234567890');
    khoa.datFb('app_secret', BI_MAT);
    const f = fetchGia((u) => {
      if (u.pathname.endsWith('/oauth/access_token')) return { json: { access_token: 'MA_DAI_HAN' } };
      if (u.pathname.endsWith('/me/accounts')) {
        return { json: { data: [
          { id: '100200300400', name: 'Linen House', access_token: 'MA_PAGE_VINH_VIEN_1' },
          { id: '500600700800', name: 'Linen House Hà Đông', access_token: 'MA_PAGE_VINH_VIEN_2' },
          { id: '900900900900', name: 'Page khác', access_token: 'X' },
        ] } };
      }
      return { json: { success: true } };
    });
    const k = new KetNoiFacebook({ congWebhook: 0, fetch: f, taoDuongHam: () => Object.assign(new EventEmitter(), { mo: async () => null, dong() {}, trangThai: () => ({}) }) });
    const lan1 = await k.doiMaPage({ maNguoiDung: 'MA_NGAN_HAN' });
    assert.equal(lan1.can_chon, true);
    assert.deepEqual(lan1.pages.map((p) => p.ten), ['Linen House', 'Linen House Hà Đông', 'Page khác']);
    assert.ok(!JSON.stringify(lan1).includes('MA_PAGE_VINH_VIEN'));
    const lan2 = await k.doiMaPage({ pageIds: ['100200300400', '500600700800'] });
    assert.equal(lan2.ok, true);
    assert.deepEqual(khoa.dsPage(), ['100200300400', '500600700800']);
    assert.equal(khoa.layMaPage('500600700800'), 'MA_PAGE_VINH_VIEN_2');
    const doi = f.goi.find((g) => g.url.pathname.endsWith('/oauth/access_token')).url.searchParams;
    assert.equal(doi.get('grant_type'), 'fb_exchange_token');
    assert.equal(doi.get('fb_exchange_token'), 'MA_NGAN_HAN');
    assert.ok(khoa.layFb('verify_token').length > 20);
    assert.equal(k.trangThaiGon().muc, 'vang');
    assert.match(k.trangThaiGon().chu, /2 Page/);
    const tt = JSON.stringify(k.trangThai());
    for (const bm of [BI_MAT, 'MA_PAGE_VINH_VIEN_1', 'MA_PAGE_VINH_VIEN_2', khoa.layFb('verify_token')]) assert.ok(!tt.includes(bm));
    assert.deepEqual(k.trangThai().pages.map((p) => p.ten), ['Linen House', 'Linen House Hà Đông']);
    await k.dung();
  });

  await t.test('địa chỉ đường hầm mới → đăng ký ứng dụng một lần, subscribed_apps cho từng Page', async () => {
    const f = fetchGia(() => ({ json: { success: true } }));
    const k = new KetNoiFacebook({ congWebhook: 0, fetch: f });
    assert.equal(await k.dangKy('https://abc.trycloudflare.com'), true);
    const [a, b, c] = f.goi;
    assert.equal(a.url.pathname, '/v26.0/1234567890/subscriptions');
    assert.equal(a.url.searchParams.get('access_token'), `1234567890|${BI_MAT}`);
    assert.equal(a.body.callback_url, 'https://abc.trycloudflare.com/webhook');
    assert.equal(a.body.fields, TRUONG.join(','));
    assert.ok(TRUONG.includes('message_echoes') && TRUONG.includes('live_videos'));
    assert.equal(a.body.verify_token, khoa.layFb('verify_token'));
    assert.equal(b.url.pathname, '/v26.0/100200300400/subscribed_apps');
    assert.equal(b.url.searchParams.get('access_token'), 'MA_PAGE_VINH_VIEN_1');
    assert.equal(c.url.pathname, '/v26.0/500600700800/subscribed_apps');
    assert.equal(c.url.searchParams.get('access_token'), 'MA_PAGE_VINH_VIEN_2');
    assert.equal(k.trangThaiGon().muc, 'xanh');
  });

  await t.test('Page tắt trong MOZA: không đọc, không gửi, bỏ sự kiện của Page đó', async () => {
    const fbPage = require('../server/nghiep-vu/fb-page');
    const k = new KetNoiFacebook({ congWebhook: 0 });
    fbPage.datBat('500600700800', false);
    assert.deepEqual(k.pagesDangChay().map((p) => p.pageId), ['100200300400']);
    assert.equal(k.guiDuoc('500600700800'), false);
    const nhan = [];
    k.on('su_kien', (e) => nhan.push(e.page_id));
    k.phatSuKien([{ loai: 'live_doi', page_id: '500600700800' }, { loai: 'live_doi', page_id: '100200300400' }], 'webhook');
    assert.deepEqual(nhan, ['100200300400']);
    fbPage.datBat('500600700800', true);
  });

  await t.test('mã một Page hết hạn (190) → Page đó đỏ, dừng gửi từ Page đó; Page kia vẫn chạy', async () => {
    const f = fetchGia(() => ({ status: 400, json: { error: { code: 190, message: 'expired' } } }));
    const baoTt = [];
    const k = new KetNoiFacebook({ congWebhook: 0, fetch: f, phat: (type, d) => baoTt.push([type, d.muc]) });
    await k.fb.guiTinNhan({ page_id: '500600700800', psid: 'U1', noi_dung: 'x' }).catch(() => {});
    assert.equal(k.guiDuoc('500600700800'), false);
    assert.equal(k.guiDuoc('100200300400'), true);
    assert.equal(k.trangThaiGon().ma, 'FB_MA_HET_HAN');
    assert.match(k.trangThaiGon().chu, /Linen House Hà Đông/);
    assert.deepEqual(baoTt.at(-1), ['ket_noi.trang_thai', 'do']);
  });

  await t.test('sự kiện trước mốc kết nối đầu không được nhập (#5)', () => {
    const k = new KetNoiFacebook({ congWebhook: 0 });
    const moc = require('../server/nghiep-vu/moc-facebook');
    moc.dat('ket_noi_dau', '2026-09-24T00:00:00.000Z');
    const nhan = [];
    k.on('su_kien', (e) => nhan.push(e.mid || e.live_id));
    k.phatSuKien([
      { loai: 'tin_nhan', mid: 'cu', luc: '2026-09-23T23:59:00.000Z' },
      { loai: 'tin_nhan', mid: 'moi', luc: '2026-09-24T00:00:01.000Z' },
      { loai: 'live_doi', live_id: 'L1' },
    ], 'webhook');
    assert.deepEqual(nhan, ['moi', 'L1']);
  });
});

test('API kết nối Facebook không lộ mã', async (t) => {
  for (const k of ['FB_APP_ID', 'FB_APP_SECRET', 'FB_PAGE_ID', 'FB_PAGE_TOKEN', 'FB_PAGES']) process.env[k] = ''; // test trước đã đặt
  const pm = await moPhanMem();
  t.after(() => pm.dong());
  const r = await pm.goi('POST', '/api/ket-noi/ma', { app_id: '99887766', app_secret: 'SECRET_KHONG_DUOC_LO_1234' }, { Origin: pm.goc });
  assert.equal(r.ma, 200);
  assert.equal(r.than.cau_hinh.app_id.gia_tri, '99887766');
  assert.equal(r.than.cau_hinh.app_secret.duoi, '1234');
  assert.ok(!r.chu.includes('SECRET_KHONG_DUOC_LO'));
  const sai = await pm.goi('POST', '/api/ket-noi/ma', { app_id: 'abc' }, { Origin: pm.goc });
  assert.equal(sai.than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
  const tt = await pm.goi('GET', '/api/trang-thai');
  assert.equal(tt.than.facebook.muc, 'xam'); // chưa có mã Page
  const phien = await pm.goi('POST', '/api/live/phien', { dien_tap: false }, { Origin: pm.goc });
  assert.equal(phien.than.loi.ma, 'FB_CHUA_KET_NOI');
});
