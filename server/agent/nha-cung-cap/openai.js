'use strict';

/**
 * OpenAI (chữ + ảnh + công cụ + mức suy nghĩ + Structured Outputs) qua Responses API của thư viện `openai`.
 * Ảnh (bản 3.1): lượt người có `anh` → phần `input_image` dạng data URL.
 * Mức suy nghĩ: `reasoning.effort` (#23). Không lưu hội thoại phía OpenAI (`store: false`); phần suy luận
 * được gửi lại dạng mã hóa (`reasoning.encrypted_content`) để các bước sau vẫn nối tiếp được.
 */

const OpenAISdk = require('openai');
const khoa = require('../../khoa');
const { LoiAi, keLai, bocLoi } = require('./chung');

const OpenAI = OpenAISdk.default || OpenAISdk;
const TEN = 'openai';
const MUC = { tat: 'none', thap: 'low', vua: 'medium', cao: 'high' };

function chuyenYeuCau({ model, mucSuyNghi, heThong, lichSu, congCu = [], luocDo = null, toiDaToken = 8192, luuDem = null }) {
  const input = [];
  for (const m of lichSu) {
    if (m.vai === 'nguoi' && m.anh?.length) {
      // F-107: ảnh có thể kèm `detail` ('low' cho MOZA nhìn — tài liệu Responses API tra 28/9/2026).
      input.push({ role: 'user', content: [...m.anh.map((a) => ({ type: 'input_image', image_url: `data:${a.mime};base64,${a.base64}`, ...(a.detail ? { detail: a.detail } : {}) })), { type: 'input_text', text: m.chu }] });
    } else if (m.vai === 'nguoi') input.push({ role: 'user', content: m.chu });
    else if (m.vai === 'ai' && m.nha === TEN) input.push(...m.goc);
    else if (m.vai === 'cong_cu' && m.nha === TEN) {
      for (const k of m.ketQua) input.push({ type: 'function_call_output', call_id: k.id, output: k.noiDung });
    } else input.push({ role: m.vai === 'ai' ? 'assistant' : 'user', content: keLai(m) });
  }
  return {
    model,
    instructions: heThong,
    input,
    ...(congCu.length ? {
      tools: congCu.map((c) => ({ type: 'function', name: c.ten, description: c.moTa, parameters: c.thamSo, strict: true })),
    } : {}),
    ...(luocDo ? { text: { format: { type: 'json_schema', name: 'phieu', schema: luocDo, strict: true } } } : {}),
    reasoning: { effort: MUC[mucSuyNghi] || MUC.thap },
    store: false,
    include: ['reasoning.encrypted_content'],
    max_output_tokens: toiDaToken,
    // BH11 (F-115, T8): lời dặn + thẻ món gọi nhiều lần trong buổi — giữ lưu đệm 12 giờ (ghi đệm 2,5 × giá vào, đọc 0,1 ×).
    ...(luuDem ? { prompt_cache_options: { ttl: luuDem } } : {}),
  };
}

function docTraLoi(res) {
  const out = res?.output || [];
  const goiCongCu = out.filter((o) => o.type === 'function_call').map((o) => {
    let thamSo = {};
    try { thamSo = JSON.parse(o.arguments || '{}'); } catch { /* tham số hỏng: runtime báo lỗi lược đồ cho model sửa */ }
    return { id: o.call_id, ten: o.name, thamSo };
  });
  const chu = res?.output_text ?? out.filter((o) => o.type === 'message')
    .flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  const u = res?.usage || {};
  return { goiCongCu, chu, goc: out, tokenVao: u.input_tokens || 0, tokenRa: u.output_tokens || 0, dungVi: res?.status || null };
}

async function goi(o) {
  const k = khoa.lay(TEN);
  if (!k) throw new LoiAi('Chưa có khóa OpenAI. Dán khóa trong Cài đặt → Khóa và kết nối.', { nha: TEN, ma: 'CHUA_CO_KHOA' });
  const client = new OpenAI({ apiKey: k, maxRetries: 0 });
  try {
    return docTraLoi(await client.responses.create(chuyenYeuCau(o), { signal: o.tinHieu }));
  } catch (e) {
    throw bocLoi(e, TEN);
  }
}

/**
 * BH11 (docs/11 mục 3.3): Decisions API (`client.decisions.create`, chỉ `gpt-6-luna`) — chọn trong danh sách đóng, trả `choice` +
 * `confidence`; đầu ra miễn phí nên chi phí chỉ tính token vào. Dùng cho MOZA nhìn (F-113) và việc chọn của Mai (F-112).
 * `noiDung`: mảng phần {chu} | {anh:{mime, base64, detail}} | {json} (thứ tự giữ nguyên — phần giống nhau mọi lần đặt trước để được
 * lưu đệm); `cauHoi`: [{ten, loai:'choice'|'predicate'|'score', chiDan, luaChon:[{gt, moTa}], muc:[{nhan, moTa}]}].
 */
/** Câu hỏi Decisions (dùng cho `decisions.create` và `session.triggers` của GPT-Live — F-112). */
function doiCauHoi(cauHoi = []) {
  return cauHoi.map((q) => {
    const goc = { type: q.loai || 'choice', name: q.ten, instructions: q.chiDan };
    if (goc.type === 'choice') goc.choices = (q.luaChon || []).map((c) => ({ value: c.gt, ...(c.moTa ? { description: c.moTa } : {}) }));
    if (goc.type === 'score') goc.levels = (q.muc || []).map((m) => ({ label: m.nhan, ...(m.moTa ? { description: m.moTa } : {}) }));
    return goc;
  });
}

function chuyenQuyetDinh({ model = 'gpt-6-luna', heThong = null, noiDung = [], cauHoi = [] }) {
  const phan = noiDung.map((p) => {
    if (p.anh) return { type: 'input_image', image_url: `data:${p.anh.mime || 'image/jpeg'};base64,${p.anh.base64}`, ...(p.anh.detail ? { detail: p.anh.detail } : {}) };
    if (p.json !== undefined) return { type: 'input_json', data: p.json };
    return { type: 'input_text', text: String(p.chu ?? '') };
  });
  return { model, questions: doiCauHoi(cauHoi), input: [...(heThong ? [{ role: 'developer', content: heThong }] : []), { role: 'user', content: phan }] };
}

/** Kết quả Decisions → {traLoi: {tênCâuHỏi: {loai, chon, tinCay, xacSuat?, tuChoi?}}, model, tokenVao, tokenRa: 0, tokenDem}. */
function docQuyetDinh(res) {
  const traLoi = {};
  for (const [i, a] of (res?.answers || []).entries()) {
    const ten = a.name ?? `cau_${i + 1}`;
    if (a.type === 'refusal') traLoi[ten] = { loai: 'refusal', chon: null, tinCay: 0, tuChoi: true };
    else if (a.type === 'predicate') traLoi[ten] = { loai: 'predicate', chon: a.probability >= 0.5, tinCay: Math.max(a.probability, 1 - a.probability), xacSuat: a.probability };
    else if (a.type === 'score') traLoi[ten] = { loai: 'score', chon: a.score, tinCay: a.confidence };
    else traLoi[ten] = { loai: 'choice', chon: a.choice, tinCay: a.confidence };
  }
  const u = res?.usage || {};
  return { traLoi, model: res?.model || null, tokenVao: u.input_tokens || 0, tokenRa: 0, tokenDem: u.input_tokens_details?.cached_tokens || 0 };
}

async function quyetDinh(o) {
  const k = khoa.lay(TEN);
  if (!k) throw new LoiAi('Chưa có khóa OpenAI. Dán khóa trong Cài đặt → Khóa và kết nối.', { nha: TEN, ma: 'CHUA_CO_KHOA' });
  const client = new OpenAI({ apiKey: k, maxRetries: 0 });
  try {
    return docQuyetDinh(await client.decisions.create(chuyenQuyetDinh(o), { signal: o.tinHieu }));
  } catch (e) {
    throw bocLoi(e, TEN);
  }
}

module.exports = { ten: TEN, MUC, chuyenYeuCau, docTraLoi, goi, chuyenQuyetDinh, docQuyetDinh, quyetDinh, doiCauHoi };
