'use strict';

/**
 * Bản xem thử cho Claude Code (cấu hình `moza` trong .claude/launch.json): cổng 5190, webhook 5191,
 * dữ liệu riêng ở data/xem-thu/.
 *
 * Vì sao không chạy thẳng `server/index.js`: bản xem thử do ứng dụng Claude bật lên chạy ngầm, không có
 * cửa sổ đen. Nếu nó giữ cổng 5173 thì bấm đúp CHAY PHAN MEM.bat không chạy được bản mới, trình duyệt lại
 * mở đúng bản cũ và băng vàng "Phần mềm vừa được cập nhật" không bao giờ tắt (gặp thật ngày 24/9/2026).
 *
 * Khóa AI lấy từ .env thật để thử được AI; mã Facebook thì bỏ: bản xem thử mà mở đường hầm và đăng ký
 * webhook với Meta sẽ giành tin nhắn thật của bản chính. Khóa nhập trong Cài đặt của bản này ghi vào
 * data/xem-thu/.env, không đụng .env thật.
 *
 * Cờ `--ai-gia` (bản 3.4, #93): bỏ luôn khóa AI và dùng AI giả "đáp án mẫu" — mọi lượt Claude Code tự lái bản xem thử
 * tốn 0 đồng (máy đọc giả đọc im lặng — BH10; miệng Live, chép lời báo "chưa có khóa", Tư vấn viên trả câu mẫu). Chạy: node scripts/xem-thu.js --ai-gia
 */

const fs = require('node:fs');
const path = require('node:path');

const GOC = path.join(__dirname, '..');
const THU_MUC = path.join(GOC, 'data', 'xem-thu');

fs.mkdirSync(THU_MUC, { recursive: true });
process.env.MOZA_FILE_ENV = path.join(THU_MUC, '.env');
process.env.MOZA_CONG_WEBHOOK = '5191';
try {
  process.loadEnvFile(path.join(GOC, '.env'));
} catch {
  // Chưa có .env thì chạy với khóa trống.
}
// Khóa người dùng dán ở Cài đặt → Khóa AI của bản xem thử được ghi vào data/xem-thu/.env: đọc lại lúc khởi động (đè lên .env
// thật), để khóa đã dán không "mất" sau mỗi lần mở lại (8/10/2026).
try {
  const rieng = require('node:util').parseEnv(fs.readFileSync(path.join(THU_MUC, '.env'), 'utf8'));
  for (const [k, v] of Object.entries(rieng)) if (String(v).trim()) process.env[k] = v;
} catch {
  // Chưa dán khóa nào ở bản xem thử.
}
for (const ten of Object.keys(process.env)) if (ten.startsWith('FB_')) delete process.env[ten];
const AI_GIA = process.argv.includes('--ai-gia') || process.env.MOZA_AI_GIA === '1';
if (AI_GIA) {
  process.env.MOZA_AI_GIA = '1';
  for (const ten of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY']) delete process.env[ten];
}

require('../server/index.js').khoiDong({ thuMucDuLieu: THU_MUC, cong: 5190 })
  .then((pm) => console.log(`MOZA xem thử: http://127.0.0.1:${pm.cong} (dữ liệu ${THU_MUC})${AI_GIA ? ' · AI GIẢ — 0 đồng' : ''}`));
