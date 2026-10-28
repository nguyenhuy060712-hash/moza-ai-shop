'use strict';

/**
 * Phép thử F-114 (BH11, docs/11 mục 6.7): tạo 1 giọng bằng mô tả (miễn phí) → GPT-Live đọc 3 câu bán hàng tiếng Việt → lưu tệp nghe
 * docs/nghe-bh11/giong-rieng.wav (không vào git) cho chủ dự án nghe → xóa giọng ở OpenAI. Trần ~0,03 USD (≤ 25 giây phiên).
 * Khóa đọc từ .env / Cài đặt bản xem thử (chỉ đọc, KHÔNG in).
 * Chạy: "C:\Program Files\nodejs\node.exe" scripts/thu-ai/thu-giong-rieng.js
 */

process.chdir(require('node:path').join(__dirname, '..', '..'));
const path = require('node:path');
const fs = require('node:fs');

process.env.MOZA_FILE_ENV = path.resolve('data/tam-test/thu-f114.env');
try { process.loadEnvFile('.env'); } catch { /* chưa có .env */ }
try {
  const rieng = require('node:util').parseEnv(fs.readFileSync('data/xem-thu/.env', 'utf8'));
  for (const [k, v] of Object.entries(rieng)) if (String(v).trim()) process.env[k] = v;
} catch { /* chưa có khóa riêng */ }

const MO_TA = 'Giọng nữ miền Bắc Việt Nam, khoảng 25 tuổi, ấm và tươi, nói nhanh vừa như MC bán hàng livestream, rõ chữ khi đọc giá và size.';
const CAU = 'Dạ em chào cả nhà, em là Mai, trợ lý AI của shop. Áo sơ mi linen số 12 hôm nay giá hai trăm tám mươi chín nghìn, có bốn màu đen, trắng, be, xanh navy. Cả nhà ưng màu nào thì bình luận chốt số 12 kèm màu và size, shop giữ hàng liền nha.';

(async () => {
  if (!require('../../server/khoa').lay('openai')) { console.log('Chưa có khóa OpenAI: không chạy, 0 đồng.'); process.exit(3); }
  const { KET_NOI_THAT: kn } = require('../../server/nghiep-vu/giong-rieng');
  const v = await kn.taoGiong({ name: 'Mai thử BH11', prompt: MO_TA });
  console.log(`Đã tạo giọng (${v.type}).`);
  let kq;
  try {
    kq = await kn.ngheThu({ id: v.id, moTa: MO_TA, chu: CAU });
  } finally {
    await kn.xoaGiong(v.id).then(() => console.log('Đã xóa giọng thử ở OpenAI.')).catch((e) => console.log('Không xóa được giọng thử:', String(e.message).slice(0, 120)));
  }
  fs.mkdirSync('docs/nghe-bh11', { recursive: true });
  const wav = require('../../server/agent/nha-cung-cap/tts').bocWav(kq.pcm, 24000);
  fs.writeFileSync('docs/nghe-bh11/giong-rieng.wav', wav);
  const usd = +(kq.giay / 60 * (require('../../server/cau-hinh/gia-model.json').mieng['gpt-live-1']?.usd_moi_phut ?? 0.05)).toFixed(5);
  fs.writeFileSync('data/tam-test/thu-f114.json', JSON.stringify({ mo_ta: MO_TA, cau: CAU, giay_phien: kq.giay, giay_tieng: +(kq.pcm.length / 48000).toFixed(1), usd }, null, 1));
  if (kq.loi?.length) console.log('Lỗi:', kq.loi.slice(0, 3).join(' | '));
  console.log(`Tệp nghe: docs/nghe-bh11/giong-rieng.wav · ${(kq.pcm.length / 48000).toFixed(1)} giây tiếng · phiên ${kq.giay} giây · ${usd} USD`);
  process.exit(0);
})().catch((e) => { console.error(String(e?.message || e).slice(0, 300)); process.exit(1); });
