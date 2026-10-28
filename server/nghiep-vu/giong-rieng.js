'use strict';

/**
 * Giọng riêng của Mai trên sóng (SPEC.md F-114, #149; docs/11 mục 6.7) — TẮT mặc định, chờ chủ dự án nghe thử tiếng Việt rồi bật.
 * Tạo giọng bằng mô tả (`POST /v1/audio/voices {type: 'prompt'}` — miễn phí, ≤ 100 giọng / tài khoản), chỉ dùng được với GPT-Live
 * (docs/11 T7): khi mở miệng gửi `audio.output.voice: {id}` và LẶP LẠI mô tả trong lời dặn (theo tài liệu). Máy đọc Realtime của Đội AI
 * không dùng được giọng này — giọng "Mai" của Đội AI vẫn là giọng có sẵn. Giữ giọng đang dùng + 3 giọng gần nhất; giọng cũ hơn xóa ở
 * OpenAI. Nghe thử = một phiên GPT-Live ngắn đọc một câu (tốn ~0,01 USD, giao diện hỏi trước).
 */

const caiDat = require('./cai-dat');
const { LoiNghiepVu, chuan, gio } = require('./chung');

const KHOA = 'giong_rieng';
const MO_TA_TOI_DA = 2000;
const GIU_GAN_NHAT = 3;
const CAU_NGHE = 'Dạ em chào cả nhà, em là Mai, trợ lý AI của shop. Hôm nay bên em có áo sơ mi linen số 12, mặc mát lắm, cả nhà ưng màu nào thì bình luận chốt kèm màu và size nha.';
const NGHE_TOI_DA_MS = 20000;

// Kết nối OpenAI thay được trong test: { taoGiong({name, prompt}), xoaGiong(id), ngheThu({id, moTa, chu}) → {pcm, giay} }.
let ketNoi = null;
function datKetNoi(k) { ketNoi = k; }

function client() {
  const k = require('../khoa').lay('openai');
  if (!k) throw new LoiNghiepVu('CHUA_CO_KHOA', 'Chưa có khóa OpenAI. Dán khóa trong Cài đặt → Khóa AI.', 409);
  const OpenAISdk = require('openai');
  return new (OpenAISdk.default || OpenAISdk)({ apiKey: k, maxRetries: 0 });
}

const KET_NOI_THAT = {
  async taoGiong({ name, prompt }) { return client().audio.voices.create({ type: 'prompt', name, prompt }); },
  async xoaGiong(id) { return client().audio.voices.delete(id); },
  /** Phiên GPT-Live ngắn: đọc một câu bằng giọng riêng, gom tiếng PCM 24 kHz. */
  async ngheThu({ id, moTa, chu }) {
    const { LiveWS } = require('openai/resources/live/ws');
    const rt = new LiveWS(client());
    const am = [];
    const loi = [];
    let giay = 0;
    let bom = null;
    rt.on('error', (e) => loi.push(String(e?.error?.error?.message || e?.error?.message || e?.message || e).slice(0, 200)));
    await new Promise((ok) => {
      let im = null;
      const xong = () => { clearTimeout(henToi); clearTimeout(im); clearInterval(bom); try { rt.send({ type: 'session.close' }); } catch { /* đã đóng */ } setTimeout(() => { try { rt.close(); } catch { /* */ } ok(); }, 1500); };
      const henToi = setTimeout(xong, NGHE_TOI_DA_MS);
      rt.on('session.started', () => {
        // GPT-Live cần tiếng vào chảy liên tục kể cả lúc im (như miệng thật — gpt-live.js bơm khoảng lặng).
        const imLang = Buffer.alloc(4800).toString('base64'); // 100 ms, 24 kHz
        bom = setInterval(() => { try { rt.send({ type: 'session.input_audio.append', audio: imLang }); } catch { /* đã đóng */ } }, 100);
        rt.send({ type: 'session.commentary.append', delegation_id: null, content: `Nói đúng nguyên văn bằng tiếng Việt: "${chu}"` });
      });
      rt.on('session.output_audio.delta', (m) => { if (m.delta) am.push(Buffer.from(m.delta, 'base64')); clearTimeout(im); im = setTimeout(xong, 1500); });
      rt.on('session.usage.updated', (m) => { giay = Math.max(giay, m.usage?.seconds || 0); });
      rt.on('session.closed', (m) => { giay = Math.max(giay, m.usage?.seconds || 0); });
      rt.on('close', ok);
      rt.send({ type: 'session.start', session: { model: 'gpt-live-1', instructions: `Bạn là Mai, trợ lý AI dẫn livestream bán hàng. Giọng nói: ${moTa}`, audio: { output: { voice: { id } } }, delegation: { type: 'client' } } });
    });
    clearInterval(bom);
    return { pcm: Buffer.concat(am), giay, loi };
  },
};
const kn = () => ketNoi || KET_NOI_THAT;

function doc() {
  const x = caiDat.doc(KHOA, null) || {};
  return { bat: !!x.bat, dang_dung: x.dang_dung || null, ds: Array.isArray(x.ds) ? x.ds : [] };
}
const ghi = (x) => caiDat.ghi(KHOA, x);

function trangThai() {
  return { ...doc(), mo_ta_toi_da: MO_TA_TOI_DA };
}

/** Tạo giọng từ mô tả (miễn phí), thành giọng đang dùng; giọng cũ ngoài 3 gần nhất xóa ở OpenAI. */
async function tao({ mo_ta: moTa, ten = '' } = {}) {
  const mt = chuan(String(moTa || '')).trim();
  if (!mt) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Mô tả giọng (ví dụ: giọng nữ miền Bắc, ấm, nói nhanh vừa).');
  if (mt.length > MO_TA_TOI_DA) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Mô tả tối đa ${MO_TA_TOI_DA} ký tự.`);
  const tenGiong = chuan(String(ten || '')).trim().slice(0, 60) || `Mai ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  let v;
  try { v = await kn().taoGiong({ name: tenGiong, prompt: mt }); } catch (e) {
    throw new LoiNghiepVu('GIONG_LOI', `OpenAI không tạo được giọng: ${require('../khoa').anKhoa(e.message)}`, 409);
  }
  const st = doc();
  const ds = [{ id: v.id, ten: v.name || tenGiong, mo_ta: mt, luc: gio() }, ...st.ds.filter((g) => g.id !== v.id)];
  const giu = ds.slice(0, GIU_GAN_NHAT + 1);
  for (const g of ds.slice(GIU_GAN_NHAT + 1)) await kn().xoaGiong(g.id).catch(() => {}); // giới hạn 100 giọng / tài khoản
  ghi({ ...st, ds: giu, dang_dung: v.id });
  return trangThai();
}

function chon(id) {
  const st = doc();
  if (!st.ds.some((g) => g.id === id)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có giọng này.', 404);
  ghi({ ...st, dang_dung: id });
  return trangThai();
}

async function xoa(id) {
  const st = doc();
  if (!st.ds.some((g) => g.id === id)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có giọng này.', 404);
  await kn().xoaGiong(id).catch((e) => { if (!/404/.test(String(e?.status || e?.message))) throw new LoiNghiepVu('GIONG_LOI', `OpenAI không xóa được giọng: ${require('../khoa').anKhoa(e.message)}`, 409); });
  const ds = st.ds.filter((g) => g.id !== id);
  ghi({ ...st, ds, dang_dung: st.dang_dung === id ? (ds[0]?.id || null) : st.dang_dung, bat: st.dang_dung === id && !ds.length ? false : st.bat });
  return trangThai();
}

/** Công tắc: chỉ bật được khi đã có giọng đang dùng. */
function datBat(bat) {
  const st = doc();
  if (bat && !st.dang_dung) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Tạo một giọng trước rồi mới bật.');
  ghi({ ...st, bat: !!bat });
  return trangThai();
}

/** Giọng cho miệng GPT-Live lúc mở: {id, moTa} khi công tắc bật và có giọng; không thì null (dùng giọng có sẵn). */
function giongChoMieng() {
  const st = doc();
  if (!st.bat || !st.dang_dung) return null;
  const g = st.ds.find((x) => x.id === st.dang_dung);
  return g ? { id: g.id, moTa: g.mo_ta } : null;
}

/** Nghe thử (tốn phí nhỏ — người bấm đã đồng ý ở giao diện): WAV + chi phí ghi như mọi lần dùng miệng. */
async function ngheThu(id = null) {
  const st = doc();
  const g = st.ds.find((x) => x.id === (id || st.dang_dung));
  if (!g) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Chưa có giọng để nghe thử.', 404);
  const { pcm, giay } = await kn().ngheThu({ id: g.id, moTa: g.mo_ta, chu: CAU_NGHE });
  if (!pcm?.length) throw new LoiNghiepVu('GIONG_LOI', 'GPT-Live không trả tiếng cho giọng này.', 409);
  const chiPhi = require('./chi-phi');
  const nhatKy = require('./nhat-ky');
  const usd = chiPhi.tinhChiPhiMieng('gpt-live-1', { giay });
  const runId = nhatKy.taoRun({ agentId: 'giong_mai', kichHoat: `Nghe thử giọng riêng "${g.ten}"` });
  nhatKy.xongRun(runId, { nha: 'openai', model: 'gpt-live-1', chiPhi: usd, ketQua: { giay } });
  return { wav: require('../agent/nha-cung-cap/tts').bocWav(pcm, 24000), chi_phi_usd: usd, canh_bao: chiPhi.kiemMucTran() };
}

module.exports = { trangThai, tao, chon, xoa, datBat, giongChoMieng, ngheThu, datKetNoi, MO_TA_TOI_DA, CAU_NGHE, KET_NOI_THAT };
