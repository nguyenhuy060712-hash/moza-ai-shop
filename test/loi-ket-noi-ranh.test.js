'use strict';

// 28/10/2026: bản xem thử sập vì undici phát 'error' "socket idle timeout" trên luồng HTTP/2 không ai nghe.
const test = require('node:test');
const assert = require('node:assert');
const { laLoiKetNoiRanh } = require('../server/index');

test('lỗi kết nối rảnh của undici được nhận ra; lỗi khác thì không', () => {
  const e = new Error('socket idle timeout');
  e.name = 'InformationalError';
  e.code = 'UND_ERR_INFO';
  assert.equal(laLoiKetNoiRanh(e), true);
  assert.equal(laLoiKetNoiRanh(new Error('socket idle timeout')), false, 'lỗi thường cùng chữ không bị nuốt');
  assert.equal(laLoiKetNoiRanh(Object.assign(new Error('kết nối đóng'), { name: 'InformationalError' })), false);
  assert.equal(laLoiKetNoiRanh(null), false);
});

test('MOZA_DIA_CHI_NGOAI: chỉ nhận địa chỉ https, trả đúng host và origin', () => {
  const { diaChiNgoai } = require('../server/index');
  assert.deepEqual(diaChiNgoai('https://shop.vi-du.vn'), { host: 'shop.vi-du.vn', origin: 'https://shop.vi-du.vn' });
  assert.deepEqual(diaChiNgoai(' https://shop.vi-du.vn:8443/ '), { host: 'shop.vi-du.vn:8443', origin: 'https://shop.vi-du.vn:8443' });
  assert.equal(diaChiNgoai('http://shop.vi-du.vn'), null, 'không nhận http thường');
  assert.equal(diaChiNgoai('khong-phai-dia-chi'), null);
  assert.equal(diaChiNgoai(''), null);
});

test('chạy sau VPS: Host / Origin của địa chỉ ngoài được nhận, nơi khác vẫn bị chặn', async () => {
  const path = require('node:path');
  const fs = require('node:fs');
  const os = require('node:os');
  const http = require('node:http');
  const thuMuc = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'moza-ngoai-'));
  process.env.MOZA_DIA_CHI_NGOAI = 'https://shop.vi-du.vn';
  const { khoiDong } = require('../server/index');
  const p = await khoiDong({ thuMucDuLieu: thuMuc, cong: 0 });
  const goi = (host, origin, method = 'GET') => new Promise((ok, loi) => {
    const r = http.request({ host: '127.0.0.1', port: p.cong, path: '/api/trang-thai', method, headers: { Host: host, ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' } }, (res) => { res.resume(); ok(res.statusCode); });
    r.on('error', loi);
    r.end(method === 'GET' ? undefined : '{}');
  });
  try {
    assert.equal(await goi('shop.vi-du.vn'), 200);
    assert.equal(await goi('trang-la.vn'), 403);
    assert.notEqual(await goi('shop.vi-du.vn', 'https://trang-la.vn', 'POST'), 200, 'POST từ trang lạ vẫn bị chặn');
  } finally {
    delete process.env.MOZA_DIA_CHI_NGOAI;
    await p.dong();
  }
});
