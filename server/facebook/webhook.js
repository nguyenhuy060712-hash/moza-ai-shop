'use strict';

/**
 * Cổng webhook `127.0.0.1:5174` (F-24, mục 9) — thứ duy nhất đi ra internet, qua đường hầm Cloudflare.
 *  - Chỉ hai đường: `GET /webhook` (Meta xác minh: đúng `hub.verify_token` mới trả `hub.challenge`)
 *    và `POST /webhook` (bắt buộc chữ ký `X-Hub-Signature-256` = HMAC-SHA256 của đúng các byte nhận được,
 *    khóa là App Secret; so sánh thời gian hằng).
 *  - Giới hạn 1 MB mỗi yêu cầu; không trả dữ liệu nào ngoài lời xác nhận.
 *  - Trả 200 ngay (Meta đòi trong 5 giây), xử lý sau.
 * Không dùng Express ở đây: ít đường, ít thứ có thể lộ ra ngoài.
 */

const http = require('node:http');
const crypto = require('node:crypto');

const TOI_DA_BYTE = 1024 * 1024;

function chuKyDung(than, chuKy, biMat) {
  if (!biMat || typeof chuKy !== 'string' || !chuKy.startsWith('sha256=')) return false;
  const mong = Buffer.from('sha256=' + crypto.createHmac('sha256', biMat).update(than).digest('hex'));
  const nhan = Buffer.from(chuKy);
  return mong.length === nhan.length && crypto.timingSafeEqual(mong, nhan);
}

/**
 * @param {object} o
 * @param {number} [o.cong]
 * @param {()=>string} o.layBiMat         App Secret
 * @param {()=>string} o.layVerifyToken
 * @param {(body:object)=>void} o.khiCoTin  gọi sau khi đã trả 200
 * @param {(ly_do:string)=>void} [o.khiTuChoi]
 * @returns {Promise<{server:http.Server, cong:number, dong:()=>Promise<void>, thongKe:()=>object}>}
 */
async function moCongWebhook({ cong = 5174, layBiMat, layVerifyToken, khiCoTin, khiTuChoi = () => {}, layAnh = null }) {
  const tk = { nhan: 0, tu_choi: 0, lan_cuoi: null, anh: 0 };
  const tra = (res, ma, chu = '') => {
    res.writeHead(ma, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(chu);
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    // #97: đường ảnh công khai HẸP cho thẻ giữ hàng — chỉ GET một tên băm của ảnh sản phẩm Đang bán; không liệt kê, không gì khác.
    const anh = /^\/anh-sp\/([a-f0-9]{32}\.(?:jpg|jpeg|png|webp))$/.exec(url.pathname);
    if (anh && layAnh) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return tra(res, 405);
      const x = layAnh(anh[1]);
      if (!x) return tra(res, 404);
      tk.anh += 1;
      res.writeHead(200, { 'Content-Type': x.kieu, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') return res.end();
      return require('node:fs').createReadStream(x.file).on('error', () => res.destroy()).pipe(res);
    }
    if (url.pathname !== '/webhook') return tra(res, 404);
    if (req.method === 'GET') {
      const dung = url.searchParams.get('hub.mode') === 'subscribe'
        && layVerifyToken() && url.searchParams.get('hub.verify_token') === layVerifyToken();
      if (!dung) { tk.tu_choi += 1; khiTuChoi('Xác minh webhook sai mã'); return tra(res, 403); }
      return tra(res, 200, String(url.searchParams.get('hub.challenge') || ''));
    }
    if (req.method !== 'POST') return tra(res, 405);
    const phan = [];
    let dai = 0;
    let quaLon = false;
    req.on('data', (c) => {
      dai += c.length;
      if (dai > TOI_DA_BYTE) { quaLon = true; req.destroy(); return; }
      phan.push(c);
    });
    req.on('close', () => { if (quaLon && !res.headersSent) { tk.tu_choi += 1; tra(res, 413); } });
    req.on('end', () => {
      if (quaLon) return;
      const than = Buffer.concat(phan);
      if (!chuKyDung(than, req.headers['x-hub-signature-256'], layBiMat())) {
        tk.tu_choi += 1;
        khiTuChoi('WEBHOOK_SAI_CHU_KY');
        return tra(res, 403);
      }
      let body;
      try { body = JSON.parse(than.toString('utf8')); } catch { tk.tu_choi += 1; return tra(res, 400); }
      tk.nhan += 1;
      tk.lan_cuoi = new Date().toISOString();
      tra(res, 200, 'EVENT_RECEIVED');
      setImmediate(() => {
        try { khiCoTin(body); } catch (e) { console.error('  [webhook] xử lý lỗi: ' + e.message); }
      });
    });
  });
  server.requestTimeout = 10000;
  await new Promise((ok, loi) => {
    server.once('error', loi);
    server.listen(cong, '127.0.0.1', () => { server.off('error', loi); ok(); });
  });
  return {
    server,
    cong: server.address().port,
    thongKe: () => ({ ...tk }),
    dong: () => new Promise((r) => server.close(() => r())),
  };
}

module.exports = { moCongWebhook, chuKyDung };
