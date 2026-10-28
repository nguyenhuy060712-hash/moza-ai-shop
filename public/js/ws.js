// Kết nối /ws dùng chung: app.js mở và nối lại khi rớt; màn hình nào cần gửi lên máy chủ
// (Màn hình người dẫn gửi tiếng micro) thì gọi gui(). Máy chủ gửi xuống thì app.js phát thành sự kiện 'moza:ws'.

let ketNoi = null;

export function datKetNoi(ws) {
  ketNoi = ws;
}

export function dangMo() {
  return ketNoi?.readyState === WebSocket.OPEN;
}

/** Gửi lên máy chủ: đối tượng thì gửi dạng JSON, ArrayBuffer thì gửi nguyên (tiếng micro). Mất kết nối thì bỏ. */
export function gui(duLieu) {
  if (!dangMo()) return false;
  ketNoi.send(duLieu instanceof ArrayBuffer ? duLieu : JSON.stringify(duLieu));
  return true;
}

/** Nghe sự kiện máy chủ gửi xuống; trả hàm để thôi nghe (gọi khi rời màn hình). */
export function ngheWs(fn) {
  const nghe = (e) => fn(e.detail);
  window.addEventListener('moza:ws', nghe);
  return () => window.removeEventListener('moza:ws', nghe);
}
