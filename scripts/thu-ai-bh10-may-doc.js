'use strict';

/**
 * Phép thử thật máy đọc OpenAI BH10 (F-108, docs/11 mục 9, #145): `gpt-realtime-2.1-mini` qua Realtime đọc 20 câu bán hàng có giá, cỡ,
 * tên món; so chữ chép lại với câu gốc (kiemDocDung); lưu 5 tệp WAV để chủ dự án nghe. Trần 0,10 USD — vượt là dừng. Ước 0,03–0,05 USD.
 * Khóa đọc từ .env / Cài đặt của bản xem thử (chỉ đọc, KHÔNG in). Cơ sở dữ liệu tạm ở data/tam-test/thu-ai-bh10 (không đụng data/moza.db).
 * Chạy: "C:\Program Files\nodejs\node.exe" scripts/thu-ai-bh10-may-doc.js
 * Kết quả: màn hình + data/tam-test/thu-ai-bh10/ket-qua.json + 5 tệp WAV ở docs/nghe-bh10/.
 */

process.chdir(require('node:path').join(__dirname, '..'));
const path = require('node:path');
const fs = require('node:fs');

const TAM = path.resolve('data/tam-test/thu-ai-bh10');
const NGHE = path.resolve('docs/nghe-bh10');
const TRAN_USD = 0.1;
fs.rmSync(TAM, { recursive: true, force: true });
fs.mkdirSync(TAM, { recursive: true });
fs.mkdirSync(NGHE, { recursive: true });
// Khóa: .env thật, rồi khóa dán ở Cài đặt của bản xem thử (data/xem-thu/.env) — như scripts/xem-thu.js.
process.env.MOZA_FILE_ENV = path.join(TAM, '.env');
try { process.loadEnvFile('.env'); } catch { /* chưa có .env */ }
try {
  const rieng = require('node:util').parseEnv(fs.readFileSync('data/xem-thu/.env', 'utf8'));
  for (const [k, v] of Object.entries(rieng)) if (String(v).trim()) process.env[k] = v;
} catch { /* chưa dán khóa ở bản xem thử */ }

const CAU = [
  ['marin', 'Áo số 12 sơ mi linen giá 289.000 đồng, có size M và L nha cả nhà.'],
  ['marin', 'Quần jean số 15 giá 349 nghìn, còn 3 chiếc size 28.'],
  ['cedar', 'Váy hoa số 7 hôm nay chỉ 199k, mua 2 cái tính 380.000 đồng.'],
  ['marin', 'Chân váy chữ A số 21, giá 259.000 đồng, màu be và đen.'],
  ['coral', 'Phí ship 30 nghìn, đơn từ 500 nghìn được miễn phí ship.'],
  ['marin', 'Bạn nào cao 1m58 nặng 50 ký thì mặc size M là vừa.'],
  ['cedar', 'Áo thun số 3 giá 129.000 đồng, còn đúng 5 cái màu trắng.'],
  ['marin', 'Set đồ bộ số 18 giá 450 nghìn, chất cotton mát lắm.'],
  ['marin', 'Cả nhà chốt bằng cách gõ chốt 12 đen M nha.'],
  ['coral', 'Túi xách số 9 giá 1.250.000 đồng, da thật, bảo hành 6 tháng.'],
  ['marin', 'Đầm dự tiệc số 25 giá 690.000 đồng, size S, M, L.'],
  ['cedar', 'Giày sneaker số 30 giá 520 nghìn, size 37 tới 40.'],
  ['marin', 'Áo khoác gió số 11 giá 315.000 đồng, chống nước nhẹ.'],
  ['marin', 'Mai giữ hàng cho bạn tới 9 giờ tối, nhắn shop tên và số điện thoại nha.'],
  ['coral', 'Quần short số 4 giá 99 nghìn, mua 3 cái chỉ 270 nghìn.'],
  ['marin', 'Áo len số 16 giá 375.000 đồng, còn 2 chiếc màu xám.'],
  ['cedar', 'Sơ mi nam số 22 giá 299k, size L và XL.'],
  ['marin', 'Khăn lụa số 8 giá 150.000 đồng, mua kèm áo giảm 20 nghìn.'],
  ['marin', 'Váy maxi số 27 giá 480 nghìn, dài 120 phân.'],
  ['coral', 'Cảm ơn chị Lan đã chốt áo số 12, shop nhắn riêng cho chị liền.'],
];

(async () => {
  const khoa = require('../server/khoa');
  if (!khoa.trangThai().openai.co) { console.log('Chưa có khóa OpenAI (.env hoặc Cài đặt → Khóa AI): không chạy, 0 đồng.'); process.exit(3); }
  const { moCSDL } = require('../server/db/ket-noi');
  await moCSDL(TAM);
  require('../server/nghiep-vu/cai-dat').gieoMacDinh();
  const tts = require('../server/agent/nha-cung-cap/tts');
  const chiPhi = require('../server/nghiep-vu/chi-phi');
  tts.datNhaDoc('openai');
  let usd = 0;
  const ra = [];
  for (const [i, [giong, chu]] of CAU.entries()) {
    if (usd > TRAN_USD) { console.log(`DỪNG: chạm trần ${TRAN_USD} USD`); break; }
    const bd = Date.now();
    let dauTieng = null;
    let kq = null;
    let loi = null;
    try {
      kq = await tts.docChu({ chu, giong, khiAm: () => { if (dauTieng === null) dauTieng = Date.now() - bd; } });
    } catch (e) { loi = `${e.ma || ''} ${e.message}`.trim(); }
    const tien = kq ? chiPhi.tinhChiPhiDoc(kq.model, kq.token) : 0;
    usd += tien;
    const dong = { stt: i + 1, giong, chu, giay: kq ? Math.round(kq.giay * 10) / 10 : 0, cho_tieng_dau_ms: dauTieng, tong_ms: Date.now() - bd,
      token: kq?.token || null, usd: Math.round(tien * 1e6) / 1e6, loi };
    ra.push(dong);
    if (kq && i < 5) fs.writeFileSync(path.join(NGHE, `${String(i + 1).padStart(2, '0')}-${giong}.wav`), kq.wav);
    console.log(`${dong.stt}. ${loi ? `LỖI ${loi}` : 'đạt'} · ${dong.giay}s · tiếng đầu ${dauTieng ?? '-'} ms · ${dong.usd} USD · ${chu}`);
  }
  require('../server/agent/nha-cung-cap/doc-realtime').dongHet();
  const dat = ra.filter((x) => !x.loi).length;
  const tom = { ngay: new Date().toISOString(), model: tts.MODEL_OPENAI, so_cau: ra.length, dat, lech: ra.filter((x) => /DOC_LECH/.test(x.loi || '')).length,
    tong_usd: Math.round(usd * 1e5) / 1e5, ket_qua: ra };
  fs.writeFileSync(path.join(TAM, 'ket-qua.json'), JSON.stringify(tom, null, 2));
  console.log(`\nĐạt ${dat}/${ra.length} câu (đọc lệch ${tom.lech}). Tổng ${tom.tong_usd} USD. 5 tệp nghe: docs/nghe-bh10/`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
