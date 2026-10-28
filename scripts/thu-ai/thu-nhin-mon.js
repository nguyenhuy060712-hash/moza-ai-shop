'use strict';

/**
 * Thử AI thật "MOZA nhìn" bước A (SPEC.md F-107): agent nhin_mon (gpt-6-luna) trên khung thử dựng sẵn (dung-khung-thu.js).
 * Chỉ chạy sau khi chủ dự án đồng ý chi phí. Trần 0,08 USD — vượt là dừng. Hai lượt: detail low, rồi detail high (nếu còn tiền).
 * Chấm bằng mã theo dap-an.json: tỷ lệ đúng, "chắc mà sai", độ trễ, chi phí mỗi lần. Đạt khi đúng ≥ 80% và chắc-mà-sai ≤ 1/20;
 * không đạt thì "MOZA nhìn" vẫn tắt mặc định (ghi kết quả vào SPEC mục 12).
 * Cơ sở dữ liệu TẠM (bản chép data/xem-thu) ở data/tam-test/thu-ai-bh9 — không đụng dữ liệu thật.
 * Chạy: "C:\Program Files\nodejs\node.exe" scripts/thu-ai/thu-nhin-mon.js   (MOZA_AI_GIA=1: chạy khô bằng AI giả, 0 đồng)
 */

process.chdir(require('node:path').join(__dirname, '..', '..'));
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const KHUNG = path.resolve('data/tam-test/khung-thu');
const TAM = path.resolve('data/tam-test/thu-ai-bh9');
const QD = process.argv.includes('--decisions');
const TRAN_USD = QD ? 0.01 : 0.08;
const CACH = QD ? 'decisions' : 'responses';
const GIA = process.env.MOZA_AI_GIA === '1';
// Khóa: .env thật, rồi khóa dán ở Cài đặt của bản xem thử (data/xem-thu/.env) — như thu-ai-bh10-may-doc.js. Chỉ đọc, KHÔNG in.
process.env.MOZA_FILE_ENV = path.join(TAM, '.env');
try { process.loadEnvFile('.env'); } catch { /* chưa có .env */ }
try {
  const rieng = require('node:util').parseEnv(fs.readFileSync('data/xem-thu/.env', 'utf8'));
  for (const [k, v] of Object.entries(rieng)) if (String(v).trim()) process.env[k] = v;
} catch { /* chưa có khóa riêng của bản xem thử */ }

(async () => {
  if (!fs.existsSync(path.join(KHUNG, 'dap-an.json'))) { console.log('Chưa có khung thử: chạy scripts/thu-ai/dung-khung-thu.js trước.'); process.exit(4); }
  if (!GIA && !require('../../server/khoa').trangThai().openai.co) { console.log('Chưa có khóa OpenAI (.env hoặc Cài đặt → Khóa AI): không chạy, 0 đồng.'); process.exit(3); }
  fs.rmSync(TAM, { recursive: true, force: true });
  fs.mkdirSync(TAM, { recursive: true });
  new DatabaseSync('data/xem-thu/moza.db', { readOnly: true }).exec(`VACUUM INTO '${path.join(TAM, 'moza.db').replace(/\\/g, '/')}'`);
  fs.cpSync('data/xem-thu/anh', path.join(TAM, 'anh'), { recursive: true });
  const { moCSDL, csdl } = require('../../server/db/ket-noi');
  await moCSDL(TAM);
  const caiDat = require('../../server/nghiep-vu/cai-dat');
  require('../../server/nghiep-vu/vai-tro').gieoVaiTro(); // vai trò mới (nhin_mon) như lúc phần mềm khởi động
  const goc = caiDat.layAgent;
  caiDat.layAgent = (id) => ({ ...goc(id), nha: 'openai', model: 'gpt-6-luna', nha_du_phong: null, model_du_phong: null, nang_cap: {} });
  if (caiDat.khanCap()) caiDat.datKhanCap(false);
  const live = require('../../server/nghiep-vu/live');
  // Bản chép có thể còn phiên đang mở (bản xem thử chưa kết thúc buổi tập): đóng trong bản chép rồi mới tạo phiên thử.
  const moSan = live.phienDangMo();
  if (moSan) live.ketThucPhien(moSan.id, 'Phép thử MOZA nhìn');
  const kb = require('../../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: true });
  const dapAn = JSON.parse(fs.readFileSync(path.join(KHUNG, 'dap-an.json'), 'utf8'));
  const jpg = (f) => ({ mime: 'image/jpeg', base64: fs.readFileSync(path.join(KHUNG, f)).toString('base64') });
  const bangMau = jpg('bang-mau.jpg');
  const soBang = dapAn.mon.map((m) => m.so);
  const nhaGia = { async goi() { return { goiCongCu: [], chu: JSON.stringify({ co_mon: true, so: soBang[0], chac: 'vua' }), goc: null, tokenVao: 1, tokenRa: 1 }; },
    async quyetDinh() { return { traLoi: { mon: { loai: 'choice', chon: `so_${soBang[0]}`, tinCay: 0.6 } }, model: 'gpt-6-luna', tokenVao: 1, tokenRa: 0 }; } };
  const { nhinMon } = require('../../server/agent/agents/nhin-mon');
  const tongUsd = () => csdl().prepare("SELECT COALESCE(SUM(chi_phi_usd), 0) AS n FROM agent_run WHERE agent_id = 'nhin_mon'").get().n;
  const ketQua = {};
  for (const detail of QD ? ['low'] : ['low', 'high']) {
    const dong = [];
    for (const k of dapAn.khung) {
      if (tongUsd() > TRAN_USD) { console.log(`DỪNG: chạm trần ${TRAN_USD} USD`); break; }
      const t0 = Date.now();
      const r = await nhinMon({ bangMau, khung: jpg(k.tep), soBang, phien: p, detail, cach: CACH, ...(GIA ? { nhaCungCap: { openai: nhaGia, gemini: nhaGia, anthropic: nhaGia } } : {}) });
      const ph = r.phieu || { co_mon: false, so: 0, chac: 'thap' };
      const so = ph.co_mon ? ph.so : 0;
      dong.push({ tep: k.tep, dap_an: k.so, so, chac: ph.chac, dung: so === k.so, chac_ma_sai: ph.chac === 'cao' && so !== k.so, ms: Date.now() - t0, usd: r.chiPhi, loi: r.loi?.ma || null });
      process.stdout.write(dong.at(-1).dung ? '.' : 'x');
    }
    const n = dong.length || 1;
    ketQua[detail] = { so_khung: dong.length, dung: dong.filter((x) => x.dung).length, ty_le_dung: +(dong.filter((x) => x.dung).length / n).toFixed(3),
      chac_ma_sai: dong.filter((x) => x.chac_ma_sai).length, ty_le_chac_ma_sai: +(dong.filter((x) => x.chac_ma_sai).length / n).toFixed(3),
      tre_tb_ms: Math.round(dong.reduce((a, x) => a + x.ms, 0) / n), usd_moi_lan: +(dong.reduce((a, x) => a + (x.usd || 0), 0) / n).toFixed(6), chi_tiet: dong };
    ketQua[detail].dat = ketQua[detail].ty_le_dung >= 0.8 && ketQua[detail].ty_le_chac_ma_sai <= 0.05;
    console.log(`\n${CACH} · ${detail}: đúng ${ketQua[detail].dung}/${dong.length} · chắc-mà-sai ${ketQua[detail].chac_ma_sai} · trễ ${ketQua[detail].tre_tb_ms} ms · ${ketQua[detail].usd_moi_lan} USD/lần · ${ketQua[detail].dat ? 'ĐẠT' : 'CHƯA ĐẠT'}`);
    if (tongUsd() > TRAN_USD) break;
  }
  console.log(`Tổng chi phí: ${tongUsd().toFixed(4)} USD`);
  fs.writeFileSync(path.join(TAM, QD ? 'ket-qua-decisions.json' : 'ket-qua.json'), JSON.stringify({ cach: CACH, ketQua, tong_usd: tongUsd() }, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
