'use strict';

/**
 * Kho giọng nói và chức năng nghe thử (giữ từ bản cũ, nâng cấp cho MOZA Live OS).
 *
 * NGHE THỬ LÀ NGHE THẬT: bấm nghe thử là phần mềm gọi lên chính nhà cung cấp,
 * bảo nó đọc một câu tiếng Việt bằng đúng giọng đó. Nghe xong lưu vào data/giong/,
 * lần sau bấm lại là phát ngay, không tốn thêm lượt gọi.
 *
 * - Gemini Live dùng chung bộ 30 giọng với TTS của Google, nên nghe thử bằng TTS là đúng giọng live.
 * - GPT Live 1 có 22 giọng. 10 giọng trùng tên với TTS của OpenAI thì nghe thử được bằng TTS;
 *   12 giọng chỉ có trong GPT Live thì chưa nghe thử được ở đây (phải mở phiên Live, tốn theo phút).
 *
 * VỀ GIỚI TÍNH GIỌNG: hai hãng KHÔNG công bố giọng nào nam, giọng nào nữ. Cột giới tính là ghi nhận
 * khi nghe, không phải tài liệu chính thức — vì vậy màn hình có nút nghe thử để tự kiểm.
 *
 * Nguồn (tra 22–23/9/2026):
 *   Giọng Gemini + TTS : https://ai.google.dev/gemini-api/docs/speech-generation
 *   Giọng GPT Live 1   : https://developers.openai.com/api/reference/resources/live/primary-websocket
 *   TTS OpenAI         : https://developers.openai.com/api/docs/guides/text-to-speech
 */

const fs = require('fs');
const path = require('path');
const khoa = require('./khoa');
const { bocWav } = require('./agent/nha-cung-cap/tts');

const THU_MUC = path.join(__dirname, '..', 'data', 'giong');

// Câu đọc thử theo đúng giọng livestream bán hàng để nghe ra chất thật.
const CAU_THU = 'Cả nhà ơi, hôm nay bên em về mẫu sơ mi linen mới, vải mát, có ba màu, '
  + 'ai ưng thì bình luận chốt kèm màu và size nha';

/* ==================== GEMINI ====================
 * 30 giọng, phần "nét giọng" lấy theo bảng của Google.
 */
const GEMINI = [
  { ten: 'Zephyr', net: 'Trong trẻo', gioi: 'nu' },
  { ten: 'Puck', net: 'Hoạt bát', gioi: 'nam' },
  { ten: 'Charon', net: 'Rành mạch', gioi: 'nam' },
  { ten: 'Kore', net: 'Chắc chắn', gioi: 'nu' },
  { ten: 'Fenrir', net: 'Sôi nổi', gioi: 'nam' },
  { ten: 'Leda', net: 'Trẻ trung', gioi: 'nu' },
  { ten: 'Orus', net: 'Chắc chắn', gioi: 'nam' },
  { ten: 'Aoede', net: 'Nhẹ nhõm', gioi: 'nu' },
  { ten: 'Callirrhoe', net: 'Dễ chịu', gioi: 'nu' },
  { ten: 'Autonoe', net: 'Trong trẻo', gioi: 'nu' },
  { ten: 'Enceladus', net: 'Thều thào', gioi: 'nam' },
  { ten: 'Iapetus', net: 'Rõ ràng', gioi: 'nam' },
  { ten: 'Umbriel', net: 'Dễ chịu', gioi: 'nam' },
  { ten: 'Algieba', net: 'Mượt mà', gioi: 'nam' },
  { ten: 'Despina', net: 'Mượt mà', gioi: 'nu' },
  { ten: 'Erinome', net: 'Rõ ràng', gioi: 'nu' },
  { ten: 'Algenib', net: 'Khàn trầm', gioi: 'nam' },
  { ten: 'Rasalgethi', net: 'Rành mạch', gioi: 'nam' },
  { ten: 'Laomedeia', net: 'Hoạt bát', gioi: 'nu' },
  { ten: 'Achernar', net: 'Dịu', gioi: 'nu' },
  { ten: 'Alnilam', net: 'Chắc chắn', gioi: 'nam' },
  { ten: 'Schedar', net: 'Đều đặn', gioi: 'nam' },
  { ten: 'Gacrux', net: 'Từng trải', gioi: 'nu' },
  { ten: 'Pulcherrima', net: 'Tới thẳng', gioi: 'nu' },
  { ten: 'Achird', net: 'Thân thiện', gioi: 'nam' },
  { ten: 'Zubenelgenubi', net: 'Xuề xoà', gioi: 'nam' },
  { ten: 'Vindemiatrix', net: 'Nhẹ nhàng', gioi: 'nu' },
  { ten: 'Sadachbia', net: 'Lanh lợi', gioi: 'nu' },
  { ten: 'Sadaltager', net: 'Hiểu biết', gioi: 'nam' },
  { ten: 'Sulafat', net: 'Ấm', gioi: 'nu' },
];

/* ==================== OPENAI (GPT Live 1) ====================
 * 22 giọng của GPT Live 1; mặc định của hãng là marin. `tts: true` = trùng tên với giọng của máy đọc
 * gpt-realtime-2.1-mini (BH10) nên nghe thử được. Nét giọng là ghi nhận khi nghe, không phải tài liệu gốc.
 */
const OPENAI = [
  { ten: 'marin', net: 'Tự nhiên, hãng khuyên dùng', gioi: 'nu', khuyen: true, tts: true },
  { ten: 'cedar', net: 'Tự nhiên, hãng khuyên dùng', gioi: 'nam', khuyen: true, tts: true },
  { ten: 'coral', net: 'Tươi, vui', gioi: 'nu', tts: true },
  { ten: 'sage', net: 'Điềm đạm', gioi: 'nu', tts: true },
  { ten: 'shimmer', net: 'Sáng, nhẹ', gioi: 'nu', tts: true },
  { ten: 'alloy', net: 'Trung tính', gioi: 'trung', tts: true },
  { ten: 'ash', net: 'Trầm, chắc', gioi: 'nam', tts: true },
  { ten: 'ballad', net: 'Chậm, tình cảm', gioi: 'nam', tts: true },
  { ten: 'verse', net: 'Linh hoạt', gioi: 'nam', tts: true },
  { ten: 'echo', net: 'Gọn, dứt khoát', gioi: 'nam', tts: true },
  ...['beacon', 'bossa', 'cinder', 'delta', 'gleam', 'meridian', 'quartz', 'ripple', 'stone', 'tempo', 'vesper', 'willow']
    .map((ten) => ({ ten, net: 'Giọng mới của GPT Live (giọng Anh hoặc Bồ Đào Nha)', gioi: '', tts: false })),
];

const KHO = { gemini: GEMINI, openai: OPENAI };

function coGiong(nha, ten) {
  return !!(KHO[nha] || []).some((g) => g.ten === ten);
}

function danhSach() {
  return { gemini: GEMINI, openai: OPENAI, cauThu: CAU_THU, daLuu: daLuu() };
}

/* ---------------- lưu lại để lần sau khỏi tốn ---------------- */

function duongDan(nha, giong) {
  return path.join(THU_MUC, `${nha === 'openai' ? 'openai-realtime' : nha}-${String(giong).replace(/[^\w-]/g, '')}.wav`);
}

function daLuu() {
  try {
    return fs.readdirSync(THU_MUC)
      .filter((f) => f.endsWith('.wav'))
      .map((f) => f.replace(/\.wav$/, ''));
  } catch {
    return [];
  }
}

/* ---------------- gọi nhà cung cấp ---------------- */

async function thuGemini(giong, chu) {
  const k = khoa.lay('gemini');
  if (!k) return { loi: 'Chưa có khoá Gemini. Nhập khoá ở phần Khoá AI bên trên.' };

  let res;
  try {
    res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent',
      {
        method: 'POST',
        headers: { 'x-goog-api-key': k, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: chu }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: giong } } },
          },
        }),
        // M0 đo được có câu treo rất lâu với bản xem trước này, nên đặt giới hạn chờ.
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch (e) {
    return { loi: 'Không gọi được Gemini: ' + e.message };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 429) return { loi: 'Gemini đang giới hạn lượt gọi (khoá gói miễn phí chỉ 10 lượt/phút). Đợi một phút rồi thử lại.' };
    return { loi: `Gemini trả về lỗi ${res.status}. ${t.slice(0, 160)}` };
  }
  const d = await res.json();
  const phan = d?.candidates?.[0]?.content?.parts || [];
  const am = phan.find((p) => p.inlineData?.data);
  if (!am) return { loi: 'Gemini không trả về tiếng cho giọng này.' };
  return { wav: bocWav(Buffer.from(am.inlineData.data, 'base64')) };
}

/** Nghe thử giọng OpenAI bằng máy đọc Realtime (BH10, F-108) — qua tts.docChu như mọi chỗ đọc khác, có ghi chi phí. */
async function thuOpenAI(giong, chu) {
  if (!khoa.lay('openai')) return { loi: 'Chưa có khoá OpenAI. Nhập khoá ở phần Khoá AI bên trên.' };
  const tts = require('./agent/nha-cung-cap/tts');
  let kq;
  try {
    kq = await tts.docChu({ chu, giong, model: tts.MODEL_OPENAI, phongCach: 'thân thiện, không trịnh trọng' });
  } catch (e) {
    return { loi: e.message };
  }
  try {
    const chiPhi = require('./nghiep-vu/chi-phi');
    const nhatKy = require('./nghiep-vu/nhat-ky');
    const runId = nhatKy.taoRun({ agentId: 'giong_mai', kichHoat: `Nghe thử giọng ${giong}` });
    nhatKy.xongRun(runId, { nha: 'openai', model: kq.model, tokenVao: kq.token?.vao || 0, tokenRa: kq.token?.ra || 0, chiPhi: chiPhi.tinhChiPhiDoc(kq.model, kq.token) });
  } catch { /* không ghi được nhật ký thì vẫn cho nghe */ }
  return { wav: kq.wav };
}

/** Nghe thử một giọng. Có sẵn trong máy thì lấy ra luôn, chưa có thì gọi nhà cung cấp. */
async function ngheThu(nha, giong) {
  const g = (KHO[nha] || []).find((x) => x.ten === giong);
  if (!g) return { loi: `Không có giọng "${giong}" của ${nha}` };
  if (nha === 'openai' && !g.tts) return { loi: `Giọng "${giong}" chỉ có trong GPT Live, chưa nghe thử được ở đây.` };

  const f = duongDan(nha, giong);
  try {
    const cu = fs.readFileSync(f);
    if (cu && cu.length > 1000) return { wav: cu, sanCo: true };
  } catch { /* chưa có thì thôi */ }

  const kq = nha === 'gemini' ? await thuGemini(giong, CAU_THU) : await thuOpenAI(giong, CAU_THU);
  if (kq.loi) return kq;

  try {
    fs.mkdirSync(THU_MUC, { recursive: true });
    fs.writeFileSync(f, kq.wav);
  } catch { /* không lưu được thì vẫn nghe được, chỉ là lần sau gọi lại */ }
  return kq;
}

module.exports = { danhSach, ngheThu, coGiong, KHO, CAU_THU };
