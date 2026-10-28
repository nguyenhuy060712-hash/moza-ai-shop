'use strict';

/**
 * Claude (chữ + công cụ `strict` + suy nghĩ thích ứng + đầu ra theo lược đồ) qua `@anthropic-ai/sdk`.
 * Mức suy nghĩ: `thinking: {type: "adaptive"}` + `output_config.effort` (#23); Claude 5 từ chối kiểu
 * `budget_tokens`. Phiếu kết quả: `output_config.format` (json_schema). Lời dặn đánh dấu bộ nhớ đệm.
 */

const AnthropicSdk = require('@anthropic-ai/sdk');
const khoa = require('../../khoa');
const { LoiAi, keLai, bocLoi } = require('./chung');

const Anthropic = AnthropicSdk.default || AnthropicSdk;
const TEN = 'anthropic';
const MUC = { tat: 'low', thap: 'low', vua: 'medium', cao: 'high' };

function chuyenYeuCau({ model, mucSuyNghi, heThong, lichSu, congCu = [], luocDo = null, toiDaToken = 8192 }) {
  const messages = [];
  const day = (role, content) => {
    const cuoi = messages.at(-1);
    if (cuoi?.role === role && Array.isArray(cuoi.content)) cuoi.content.push(...content);
    else messages.push({ role, content: [...content] });
  };
  for (const m of lichSu) {
    if (m.vai === 'nguoi') {
      day('user', [...(m.anh || []).map((a) => ({ type: 'image', source: { type: 'base64', media_type: a.mime, data: a.base64 } })), { type: 'text', text: m.chu }]);
    }
    else if (m.vai === 'ai' && m.nha === TEN) messages.push({ role: 'assistant', content: m.goc });
    else if (m.vai === 'cong_cu' && m.nha === TEN) {
      day('user', m.ketQua.map((k) => ({ type: 'tool_result', tool_use_id: k.id, content: k.noiDung, ...(k.loi ? { is_error: true } : {}) })));
    } else day(m.vai === 'ai' ? 'assistant' : 'user', [{ type: 'text', text: keLai(m) }]);
  }
  return {
    model,
    max_tokens: toiDaToken,
    system: [{ type: 'text', text: heThong, cache_control: { type: 'ephemeral' } }],
    messages,
    ...(congCu.length ? {
      tools: congCu.map((c) => ({ name: c.ten, description: c.moTa, input_schema: c.thamSo, strict: true })),
    } : {}),
    thinking: mucSuyNghi === 'tat' ? { type: 'disabled' } : { type: 'adaptive' },
    output_config: {
      effort: MUC[mucSuyNghi] || MUC.thap,
      ...(luocDo ? { format: { type: 'json_schema', schema: luocDo } } : {}),
    },
  };
}

function docTraLoi(res) {
  const content = res?.content || [];
  const u = res?.usage || {};
  return {
    goiCongCu: content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, ten: b.name, thamSo: b.input || {} })),
    chu: content.filter((b) => b.type === 'text').map((b) => b.text).join(''),
    goc: content,
    tokenVao: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    tokenRa: u.output_tokens || 0,
    dungVi: res?.stop_reason || null,
  };
}

async function goi(o) {
  const k = khoa.lay(TEN);
  if (!k) throw new LoiAi('Chưa có khóa Anthropic (Claude). Dán khóa trong Cài đặt → Khóa và kết nối.', { nha: TEN, ma: 'CHUA_CO_KHOA' });
  const client = new Anthropic({ apiKey: k, maxRetries: 0 });
  try {
    return docTraLoi(await client.messages.create(chuyenYeuCau(o), { signal: o.tinHieu }));
  } catch (e) {
    throw bocLoi(e, TEN);
  }
}

module.exports = { ten: TEN, MUC, chuyenYeuCau, docTraLoi, goi };
