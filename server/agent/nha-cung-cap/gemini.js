'use strict';

/**
 * Gemini (chữ + ảnh + công cụ + mức suy nghĩ + đầu ra theo lược đồ JSON) qua `@google/genai`.
 * Ảnh (bản 3.1, #75, #78): lượt người có `anh: [{mime, base64}]` → phần `inlineData` (ảnh ≤ 3 MB, gửi thẳng không cần tải lên).
 * Mức suy nghĩ: `thinkingConfig.thinkingLevel` (#23). Phiếu kết quả: `responseMimeType` JSON + `responseJsonSchema`.
 */

const { GoogleGenAI } = require('@google/genai');
const khoa = require('../../khoa');
const { LoiAi, keLai, bocLoi } = require('./chung');

const TEN = 'gemini';
// Gemini 3 không tắt hẳn suy nghĩ được; "Tắt" dùng mức thấp nhất.
const MUC = { tat: 'MINIMAL', thap: 'LOW', vua: 'MEDIUM', cao: 'HIGH' };
// Mã gọi công cụ do MOZA tự đặt khi Gemini không gửi mã: không gửi lại cho Gemini.
const MA_TU_DAT = 'moza_';
// Có model Gemini 3 không nhận mức MINIMAL (24/9/2026 gemini-3.8-flash báo 400 "Thinking level MINIMAL is not supported"):
// gặp lỗi đó thì hỏi lại ở mức LOW và nhớ model đó cho các lần sau.
const KHONG_NHAN_MINIMAL = new Set();
// Chỗ thay bộ SDK khi test (không gọi mạng).
let TaoAi = GoogleGenAI;
function datSdk(x) { TaoAi = x || GoogleGenAI; }

function chuyenYeuCau({ model, mucSuyNghi, heThong, lichSu, congCu = [], luocDo = null, toiDaToken = 8192 }) {
  const contents = [];
  const themChu = (role, text) => {
    const cuoi = contents.at(-1);
    if (cuoi?.role === role && cuoi.parts.every((p) => typeof p.text === 'string')) cuoi.parts.push({ text });
    else contents.push({ role, parts: [{ text }] });
  };
  for (const m of lichSu) {
    if (m.vai === 'nguoi' && m.anh?.length) {
      contents.push({ role: 'user', parts: [...m.anh.map((a) => ({ inlineData: { mimeType: a.mime, data: a.base64 } })), { text: m.chu }] });
    } else if (m.vai === 'nguoi') themChu('user', m.chu);
    else if (m.vai === 'ai' && m.nha === TEN) contents.push(m.goc);
    else if (m.vai === 'cong_cu' && m.nha === TEN) {
      contents.push({
        role: 'user',
        parts: m.ketQua.map((k) => ({
          functionResponse: {
            ...(k.id.startsWith(MA_TU_DAT) ? {} : { id: k.id }),
            name: k.ten,
            response: k.loi ? { error: JSON.parse(k.noiDung) } : { output: JSON.parse(k.noiDung) },
          },
        })),
      });
    } else themChu(m.vai === 'ai' ? 'model' : 'user', keLai(m));
  }
  return {
    model,
    contents,
    config: {
      systemInstruction: heThong,
      ...(congCu.length ? {
        tools: [{ functionDeclarations: congCu.map((c) => ({ name: c.ten, description: c.moTa, parametersJsonSchema: c.thamSo })) }],
      } : {}),
      ...(luocDo ? { responseMimeType: 'application/json', responseJsonSchema: luocDo } : {}),
      thinkingConfig: { thinkingLevel: MUC[mucSuyNghi] || MUC.thap },
      maxOutputTokens: toiDaToken,
    },
  };
}

function docTraLoi(res) {
  const cand = res?.candidates?.[0];
  const parts = cand?.content?.parts || [];
  const goiCongCu = parts.filter((p) => p.functionCall).map((p, i) => ({
    id: p.functionCall.id || `${MA_TU_DAT}${Date.now().toString(36)}_${i}`,
    ten: p.functionCall.name,
    thamSo: p.functionCall.args || {},
  }));
  const u = res?.usageMetadata || {};
  return {
    goiCongCu,
    chu: parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join(''),
    goc: { role: 'model', parts },
    tokenVao: (u.promptTokenCount || 0) + (u.toolUsePromptTokenCount || 0),
    tokenRa: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
    dungVi: cand?.finishReason || null,
  };
}

async function goi(o) {
  const k = khoa.lay(TEN);
  if (!k) throw new LoiAi('Chưa có khóa Gemini. Dán khóa trong Cài đặt → Khóa và kết nối.', { nha: TEN, ma: 'CHUA_CO_KHOA' });
  const ai = new TaoAi({ apiKey: k });
  const req = chuyenYeuCau(o);
  const muc = req.config.thinkingConfig;
  if (muc.thinkingLevel === MUC.tat && KHONG_NHAN_MINIMAL.has(req.model)) muc.thinkingLevel = MUC.thap;
  req.config.abortSignal = o.tinHieu;
  try {
    return docTraLoi(await ai.models.generateContent(req));
  } catch (e) {
    if (muc.thinkingLevel !== MUC.tat || !/thinking level minimal is not supported/i.test(String(e?.message))) throw bocLoi(e, TEN);
    KHONG_NHAN_MINIMAL.add(req.model);
    muc.thinkingLevel = MUC.thap;
    try {
      return docTraLoi(await ai.models.generateContent(req));
    } catch (e2) {
      throw bocLoi(e2, TEN);
    }
  }
}

module.exports = { ten: TEN, MUC, chuyenYeuCau, docTraLoi, goi, datSdk };
