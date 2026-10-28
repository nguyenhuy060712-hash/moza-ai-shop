'use strict';

/**
 * WebSocket `/ws` (SPEC.md mục 8): máy chủ đẩy sự kiện thời gian thực lên mọi màn hình đang mở,
 * ví dụ công tắc "Dừng mọi thứ" vừa bật thì mọi tab đều thấy ngay. Chiều ngược lại chỉ có tiếng micro
 * của Màn hình người dẫn (chép lời người dẫn, F-21); mọi lệnh khác đi bằng HTTP.
 *
 * Chỉ nhận kết nối từ chính giao diện MOZA (kiểm Origin): trình duyệt cho mọi trang web mở
 * WebSocket tới 127.0.0.1, nên một trang lạ đang mở trong trình duyệt cũng có thể thử kết nối.
 */

const { EventEmitter } = require('node:events');
const { WebSocketServer } = require('ws');

// Kênh nội bộ: dịch vụ trong máy chủ nghe cùng sự kiện đẩy lên màn hình (màn hình sản phẩm theo đoạn, người chốt, kho — #90).
const bus = new EventEmitter();
bus.setMaxListeners(50);

let wss = null;
// Nơi xử lý tin trình duyệt gửi lên (tiếng micro của Màn hình người dẫn — F-21). Chưa đặt thì bỏ qua.
let xuLy = null;

/** @param {{ nhan(ws, duLieu, laNhiPhan): void, dong(ws): void }} x */
function datXuLy(x) {
  xuLy = x;
}

function moWs(server, nguonHopLe) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 1024,
    verifyClient: ({ origin }) => nguonHopLe().includes(origin),
  });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'xin_chao' }));
    ws.on('message', (duLieu, laNhiPhan) => {
      try {
        xuLy?.nhan(ws, duLieu, laNhiPhan);
      } catch (e) {
        console.error('  [ws] xử lý tin gửi lên lỗi: ' + e.message);
      }
    });
    ws.on('close', () => xuLy?.dong(ws));
  });
}

/** Gửi một sự kiện tới mọi màn hình đang mở. */
function phat(type, duLieu = {}) {
  try { bus.emit('su_kien', type, duLieu); } catch (e) { console.error(`  [ws] nghe nội bộ lỗi: ${e.message}`); }
  if (!wss) return;
  const tin = JSON.stringify({ type, ...duLieu });
  for (const c of wss.clients) if (c.readyState === 1) c.send(tin);
}

function dongWs() {
  if (!wss) return;
  for (const c of wss.clients) c.terminate();
  wss.close();
  wss = null;
}

module.exports = { moWs, phat, dongWs, datXuLy, bus };
