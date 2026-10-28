'use strict';

/**
 * Khởi động MOZA Live OS (SPEC.md mục 5, 12).
 *
 * - Giao diện và API chỉ nghe ở 127.0.0.1 (#1: một người dùng, không đăng nhập).
 *   Thêm lớp kiểm tên máy (Host) và nguồn (Origin): trang web lạ mở trong cùng trình duyệt
 *   không đọc được dữ liệu kể cả khi dùng mẹo trỏ tên miền về 127.0.0.1.
 * - Khóa đọc từ .env bằng `process.loadEnvFile` có sẵn của Node (bỏ dotenv, mục 6).
 * - Mở cơ sở dữ liệu, nâng cấu trúc, chuyển giọng từ bản bán hàng cũ (lần đầu), gieo dữ liệu mồi.
 *
 * Mã thoát: 3 = lỗi người dùng phải xử lý (ví dụ cổng đang bị giữ) → start.bat không tự chạy lại;
 * mã khác → start.bat tự chạy lại sau 3 giây.
 */

const path = require('node:path');
const http = require('node:http');
const express = require('express');

const GOC = path.join(__dirname, '..');

function napEnv() {
  try {
    process.loadEnvFile(process.env.MOZA_FILE_ENV || path.join(GOC, '.env'));
  } catch {
    // Chưa có .env thì chạy với khóa trống; màn hình Cài đặt sẽ báo thiếu khóa.
  }
}

/** Địa chỉ ngoài được phép (MOZA_DIA_CHI_NGOAI, chỉ https) → { host, origin }; không đặt hay sai thì null. */
function diaChiNgoai(giaTri = process.env.MOZA_DIA_CHI_NGOAI) {
  if (!giaTri) return null;
  try {
    const u = new URL(String(giaTri).trim());
    if (u.protocol !== 'https:') return null;
    return { host: u.host, origin: u.origin };
  } catch {
    return null;
  }
}

/** Lỗi undici khi luồng HTTP/2 rảnh bị đóng ("socket idle timeout") — vô hại với phần mềm, không đáng làm sập. */
function laLoiKetNoiRanh(e) {
  return !!e && (e.name === 'InformationalError' || e.code === 'UND_ERR_INFO') && /idle timeout/i.test(String(e.message));
}

/**
 * Dựng và mở phần mềm. Test gọi hàm này với thư mục dữ liệu tạm và cổng 0.
 * @returns {Promise<{server: http.Server, cong: number, chuyenBanCu: object|null, dong: () => Promise<void>}>}
 */
async function khoiDong({ thuMucDuLieu = path.join(GOC, 'data'), cong = 5173 } = {}) {
  const { moCSDL, dongCSDL } = require('./db/ket-noi');
  const { chuyenBanCu } = require('./nghiep-vu/chuyen-ban-cu');
  const caiDat = require('./nghiep-vu/cai-dat');
  const soTay = require('./nghiep-vu/so-tay');
  const vaiTro = require('./nghiep-vu/vai-tro');
  const skill = require('./nghiep-vu/skill');
  const { taoApi } = require('./api');
  const { moWs, dongWs } = require('./ws');
  const { moDichVu, dongDichVu } = require('./dich-vu');

  // Lưới an toàn (26/10/2026): một lỗi lạc (ví dụ thư viện của hãng AI đóng kết nối hỏng) chỉ ghi nhật ký, không làm sập cả
  // phần mềm giữa buổi live. Khi chạy test thì không gắn, để lỗi lạc vẫn lộ ra.
  if (!process.env.NODE_TEST_CONTEXT && !process.listenerCount('unhandledRejection')) {
    process.on('unhandledRejection', (e) => console.error(`  [lỗi lạc] ${require('./khoa').anKhoa(String(e?.message || e)).split('\n')[0]}`));
  }
  // 28/10/2026: luồng HTTP/2 của fetch (undici) có thân bỏ dở, hết giờ rảnh thì phát 'error' "socket idle timeout" không ai
  // nghe → sập cả phần mềm. Chỉ nuốt đúng loại lỗi kết nối rảnh này (ghi nhật ký); lỗi khác vẫn sập như cũ để lộ ra.
  if (!process.env.NODE_TEST_CONTEXT && !process.listenerCount('uncaughtException')) {
    process.on('uncaughtException', (e) => {
      if (laLoiKetNoiRanh(e)) {
        console.error(`  [lỗi lạc] kết nối mạng rảnh bị đóng (${e.message}) — bỏ qua, phần mềm chạy tiếp`);
        return;
      }
      console.error(e);
      process.exit(1);
    });
  }
  await moCSDL(thuMucDuLieu);
  caiDat.gieoMacDinh();
  const daChuyen = chuyenBanCu(thuMucDuLieu);
  soTay.gieoMucMoi();
  vaiTro.gieoVaiTro();
  skill.gieoSkill();

  const app = express();
  app.disable('x-powered-by');
  const server = http.createServer(app);
  const congThat = () => server.address()?.port;
  // Chạy trên VPS sau Caddy / Nginx có đăng nhập (docs/TRIEN-KHAI-VPS.md): MOZA_DIA_CHI_NGOAI = địa chỉ https của shop
  // (ví dụ https://shop.ten-mien.vn) — chỉ thêm đúng tên miền đó vào danh sách được nhận, vẫn chặn mọi nơi khác.
  const ngoai = diaChiNgoai();
  const tenHopLe = () => [`127.0.0.1:${congThat()}`, `localhost:${congThat()}`, ...(ngoai ? [ngoai.host] : [])];
  const nguonHopLe = () => [`http://127.0.0.1:${congThat()}`, `http://localhost:${congThat()}`, ...(ngoai ? [ngoai.origin] : [])];

  app.use((req, res, next) => {
    if (!tenHopLe().includes(req.headers.host)) return res.status(403).send('Chỉ mở MOZA bằng địa chỉ 127.0.0.1');
    // Yêu cầu ghi từ trang của nơi khác (có Origin lạ) thì chặn.
    if (req.method !== 'GET' && req.headers.origin && !nguonHopLe().includes(req.headers.origin)) {
      return res.status(403).json({ loi: { ma: 'NGUON_LA', thong_diep: 'Yêu cầu không đến từ giao diện MOZA.' } });
    }
    next();
  });
  app.use('/api', taoApi());
  // Không cho trình duyệt giữ bản cũ của giao diện: sau khi cập nhật phần mềm, trình duyệt từng dùng
  // bản cũ các file .js (module) dù máy chủ đã có bản mới. Chạy trên cùng máy nên tải lại không tốn gì.
  app.use(express.static(path.join(GOC, 'public'), {
    index: 'index.html',
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
  }));

  await new Promise((ok, loi) => {
    server.once('error', loi);
    server.listen(cong, '127.0.0.1', () => {
      server.off('error', loi);
      ok();
    });
  });
  // Mở WebSocket SAU khi đã chiếm được cổng: thư viện ws phát lại lỗi của máy chủ HTTP
  // (ví dụ cổng đang bị giữ) thành lỗi không ai bắt, làm tiến trình văng thay vì báo lỗi dễ hiểu.
  moWs(server, nguonHopLe);
  moDichVu({ congMoza: congThat() });

  return {
    server,
    cong: congThat(),
    chuyenBanCu: daChuyen,
    async dong() {
      dongDichVu();
      dongWs();
      await new Promise((r) => server.close(r));
      dongCSDL();
    },
  };
}

function baoLoiKhoiDong(e, cong) {
  console.log('');
  if (e.code === 'EADDRINUSE') {
    console.log(`  [!] Cổng ${cong} đang bị giữ — MOZA có thể đang chạy ở một cửa sổ khác.`);
    console.log('');
    console.log(`      Cách 1: mở trình duyệt vào http://127.0.0.1:${cong} là dùng được ngay.`);
    console.log('      Cách 2: muốn khởi động lại thì đóng cửa sổ đen cũ, đợi 5 giây,');
    console.log('              rồi bấm đúp CHAY PHAN MEM.bat lần nữa.');
    console.log('');
    console.log('      Không thấy cửa sổ đen nào? Mở Task Manager (Ctrl+Shift+Esc),');
    console.log('      tìm "Node.js JavaScript Runtime", bấm End task, rồi chạy lại.');
    return 3;
  }
  if (e.code === 'EACCES') {
    console.log(`  [!] Không được phép mở cổng ${cong}.`);
    console.log('      Mở file .env, đổi dòng PORT sang số khác, ví dụ PORT=5180.');
    return 3;
  }
  console.log('  [!] Không khởi động được: ' + e.message);
  return 1;
}

async function main() {
  napEnv();
  const cong = Number(process.env.PORT || 5173);
  let phanMem;
  try {
    phanMem = await khoiDong({ cong });
  } catch (e) {
    process.exit(baoLoiKhoiDong(e, cong));
  }

  const khoa = require('./khoa');
  const caiDat = require('./nghiep-vu/cai-dat');
  const thieu = caiDat.nhaDangDung().filter((n) => !khoa.lay(n)).map((n) => khoa.NHAN[n]);
  console.log('');
  console.log('  MOZA Live OS');
  console.log(`  Mở trình duyệt: http://127.0.0.1:${phanMem.cong}`);
  console.log(`  Dữ liệu: ${path.join(GOC, 'data', 'moza.db')}`);
  if (phanMem.chuyenBanCu) {
    console.log(`  Đã cất dữ liệu bản bán hàng cũ thành data/${phanMem.chuyenBanCu.file} và chuyển giọng đã chọn sang.`);
  }
  if (thieu.length) console.log(`  Chưa có khóa: ${thieu.join(', ')} — vào Cài đặt để nhập.`);
  console.log('  Dừng hẳn: đóng cửa sổ này.');
  console.log('');

  const tat = async () => {
    await phanMem.dong();
    process.exit(0);
  };
  process.on('SIGINT', tat);
  process.on('SIGTERM', tat);
}

if (require.main === module) main();

module.exports = { khoiDong, laLoiKetNoiRanh, diaChiNgoai };
