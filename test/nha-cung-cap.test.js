'use strict';

/** Bộ nối 3 nhà cung cấp AI (F-07): dựng đúng yêu cầu, đọc đúng trả lời. Không gọi mạng. */

const test = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('../server/agent/nha-cung-cap/gemini');
const openai = require('../server/agent/nha-cung-cap/openai');
const anthropic = require('../server/agent/nha-cung-cap/anthropic');
const { docPhieu } = require('../server/agent/nha-cung-cap/chung');

const CONG_CU = [{ ten: 'lay_san_pham', moTa: 'Đọc thẻ sản phẩm', thamSo: { type: 'object', properties: { so: { type: 'integer' } }, required: ['so'], additionalProperties: false } }];
const LUOC_DO = { type: 'object', properties: { cau: { type: 'string' } }, required: ['cau'], additionalProperties: false };

// Một lần chạy đã đi 1 bước bằng `nha`: gọi lay_san_pham, có kết quả.
function lichSu(nha, goc) {
  return [
    { vai: 'nguoi', chu: 'áo 12 giá bao nhiêu?' },
    { vai: 'ai', nha, goc, goiCongCu: [{ id: 'call_1', ten: 'lay_san_pham', thamSo: { so: 12 } }], chu: '' },
    { vai: 'cong_cu', nha, ketQua: [{ id: 'call_1', ten: 'lay_san_pham', noiDung: '{"the":"Giá: 289.000đ"}', loi: false }] },
  ];
}

test('mức suy nghĩ gửi đúng tham số cho từng nhà (#23)', () => {
  const o = (muc) => ({ model: 'm', mucSuyNghi: muc, heThong: 'h', lichSu: [{ vai: 'nguoi', chu: 'x' }] });
  assert.equal(gemini.chuyenYeuCau(o('thap')).config.thinkingConfig.thinkingLevel, 'LOW');
  assert.equal(gemini.chuyenYeuCau(o('vua')).config.thinkingConfig.thinkingLevel, 'MEDIUM');
  assert.equal(gemini.chuyenYeuCau(o('cao')).config.thinkingConfig.thinkingLevel, 'HIGH');
  assert.deepEqual(openai.chuyenYeuCau(o('thap')).reasoning, { effort: 'low' });
  assert.deepEqual(openai.chuyenYeuCau(o('vua')).reasoning, { effort: 'medium' });
  const c = anthropic.chuyenYeuCau(o('vua'));
  assert.deepEqual(c.thinking, { type: 'adaptive' });
  assert.equal(c.output_config.effort, 'medium');
  assert.ok(!('budget_tokens' in c.thinking), 'Claude 5 từ chối budget_tokens');
  assert.deepEqual(anthropic.chuyenYeuCau(o('tat')).thinking, { type: 'disabled' });
});

test('đầu ra theo lược đồ và công cụ strict theo cách của từng nhà', () => {
  const o = { model: 'm', mucSuyNghi: 'thap', heThong: 'h', lichSu: [{ vai: 'nguoi', chu: 'x' }], congCu: CONG_CU, luocDo: LUOC_DO };
  const g = gemini.chuyenYeuCau(o).config;
  assert.equal(g.responseMimeType, 'application/json');
  assert.deepEqual(g.responseJsonSchema, LUOC_DO);
  assert.deepEqual(g.tools[0].functionDeclarations[0], { name: 'lay_san_pham', description: 'Đọc thẻ sản phẩm', parametersJsonSchema: CONG_CU[0].thamSo });
  const p = openai.chuyenYeuCau(o);
  assert.deepEqual(p.text.format, { type: 'json_schema', name: 'phieu', schema: LUOC_DO, strict: true });
  assert.equal(p.tools[0].strict, true);
  assert.equal(p.store, false);
  const a = anthropic.chuyenYeuCau(o);
  assert.deepEqual(a.output_config.format, { type: 'json_schema', schema: LUOC_DO });
  assert.equal(a.tools[0].strict, true);
  assert.deepEqual(a.tools[0].input_schema, CONG_CU[0].thamSo);
  assert.deepEqual(a.system[0].cache_control, { type: 'ephemeral' }, 'lời dặn dùng bộ nhớ đệm');
});

test('lượt của chính nhà đó gửi lại nguyên gốc; lượt của nhà khác kể lại bằng chữ', () => {
  const gocGemini = { role: 'model', parts: [{ functionCall: { id: 'call_1', name: 'lay_san_pham', args: { so: 12 } }, thoughtSignature: 'sig' }] };
  const g = gemini.chuyenYeuCau({ model: 'm', mucSuyNghi: 'thap', heThong: 'h', lichSu: lichSu('gemini', gocGemini) });
  assert.deepEqual(g.contents[1], gocGemini, 'giữ chữ ký suy nghĩ của Gemini');
  assert.deepEqual(g.contents[2].parts[0].functionResponse, { id: 'call_1', name: 'lay_san_pham', response: { output: { the: 'Giá: 289.000đ' } } });

  const gocOpenai = [{ type: 'reasoning', encrypted_content: 'enc' }, { type: 'function_call', call_id: 'call_1', name: 'lay_san_pham', arguments: '{"so":12}' }];
  const p = openai.chuyenYeuCau({ model: 'm', mucSuyNghi: 'thap', heThong: 'h', lichSu: lichSu('openai', gocOpenai) });
  assert.deepEqual(p.input.slice(1, 3), gocOpenai);
  assert.deepEqual(p.input[3], { type: 'function_call_output', call_id: 'call_1', output: '{"the":"Giá: 289.000đ"}' });

  const gocClaude = [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 'call_1', name: 'lay_san_pham', input: { so: 12 } }];
  const a = anthropic.chuyenYeuCau({ model: 'm', mucSuyNghi: 'vua', heThong: 'h', lichSu: lichSu('anthropic', gocClaude) });
  assert.deepEqual(a.messages[1], { role: 'assistant', content: gocClaude });
  assert.deepEqual(a.messages[2].content[0], { type: 'tool_result', tool_use_id: 'call_1', content: '{"the":"Giá: 289.000đ"}' });

  // Đổi nhà giữa chừng (Gemini lỗi → Claude): Claude đọc bước trước bằng chữ.
  const doi = anthropic.chuyenYeuCau({ model: 'm', mucSuyNghi: 'vua', heThong: 'h', lichSu: lichSu('gemini', gocGemini) });
  assert.deepEqual(doi.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.match(doi.messages[1].content[0].text, /Đã gọi công cụ: lay_san_pham\({"so":12}\)/);
  assert.match(doi.messages[2].content[0].text, /Giá: 289\.000đ/);
});

test('ảnh gửi kèm (Tạo từ ảnh #75, tìm mẫu theo ảnh #78): mỗi nhà nhận ảnh đúng dạng, ảnh đứng trước chữ', () => {
  const anh = [{ mime: 'image/jpeg', base64: '/9j/AAA' }, { mime: 'image/png', base64: 'iVBORw0K' }];
  const o = { model: 'm', mucSuyNghi: 'thap', heThong: 'h', lichSu: [{ vai: 'nguoi', chu: 'Shop có mẫu này không?', anh }] };
  const g = gemini.chuyenYeuCau(o);
  assert.deepEqual(g.contents[0], { role: 'user', parts: [
    { inlineData: { mimeType: 'image/jpeg', data: '/9j/AAA' } }, { inlineData: { mimeType: 'image/png', data: 'iVBORw0K' } }, { text: 'Shop có mẫu này không?' }] });
  const p = openai.chuyenYeuCau(o);
  assert.deepEqual(p.input.find((x) => x.role === 'user').content, [
    { type: 'input_image', image_url: 'data:image/jpeg;base64,/9j/AAA' }, { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0K' },
    { type: 'input_text', text: 'Shop có mẫu này không?' }]);
  const a = anthropic.chuyenYeuCau(o);
  assert.deepEqual(a.messages[0], { role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/AAA' } },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0K' } },
    { type: 'text', text: 'Shop có mẫu này không?' }] });
  // Không có ảnh thì lượt người vẫn chỉ là chữ.
  assert.deepEqual(gemini.chuyenYeuCau({ ...o, lichSu: [{ vai: 'nguoi', chu: 'x' }] }).contents[0], { role: 'user', parts: [{ text: 'x' }] });
});

/** Gemini giả qua bộ SDK thay thế: ghi lại yêu cầu, trả một phiếu. */
async function voiGeminiGia(t) {
  const { moCSDLTam } = require('./ho-tro');
  const { dong } = await moCSDLTam();
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu';
  const yeuCau = [];
  gemini.datSdk(class {
    constructor() {
      this.models = { generateContent: async (req) => { yeuCau.push(req); return { candidates: [{ content: { parts: [{ text: '{"cau":"Dạ"}' }] } }] }; } };
    }
  });
  t.after(() => {
    gemini.datSdk(null);
    if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu;
    dong();
  });
  return yeuCau;
}

test('chayAgent({anh}) đưa ảnh tới nhà cung cấp đúng dạng (Đọc ảnh sản phẩm — Tạo từ ảnh)', async (t) => {
  const yeuCau = await voiGeminiGia(t);
  const { chayAgent } = require('../server/agent/runtime');
  const kq = await chayAgent({ agentId: 'doc_anh', kichHoat: 'thử', tinDau: 'Điền ô từ ảnh', luocDo: LUOC_DO,
    anh: [{ mime: 'image/jpeg', base64: '/9j/AAA' }], nhaCungCap: { gemini } });
  assert.equal(kq.ok, true, JSON.stringify(kq.loi));
  assert.deepEqual(yeuCau[0].contents[0].parts, [{ inlineData: { mimeType: 'image/jpeg', data: '/9j/AAA' } }, { text: 'Điền ô từ ảnh' }]);
  assert.equal(yeuCau[0].model, 'gemini-3.8-flash');
});

test('Agent "Tìm mẫu theo ảnh" và "Đọc bình luận chốt" chạy được (có lời dặn vai trò)',
  async (t) => {
    const yeuCau = await voiGeminiGia(t);
    const { chayAgent } = require('../server/agent/runtime');
    const kq = await chayAgent({ agentId: 'tim_mau', kichHoat: 'thử', tinDau: 'Shop có mẫu này không?', luocDo: LUOC_DO,
      anh: [{ mime: 'image/jpeg', base64: '/9j/AAA' }], nhaCungCap: { gemini } });
    assert.equal(kq.ok, true, JSON.stringify(kq.loi));
    assert.deepEqual(yeuCau[0].contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: '/9j/AAA' } });
    const kq2 = await chayAgent({ agentId: 'doc_chot', kichHoat: 'thử', tinDau: 'lấy em cái đen M nha', luocDo: LUOC_DO, nhaCungCap: { gemini } });
    assert.equal(kq2.ok, true, JSON.stringify(kq2.loi));
    assert.equal(yeuCau[1].model, 'gemini-3.5-flash-lite');
  });

test('đọc trả lời: lời gọi công cụ, chữ, token (kể cả token suy nghĩ)', () => {
  const g = gemini.docTraLoi({
    candidates: [{ content: { role: 'model', parts: [{ text: 'nghĩ', thought: true }, { text: '{"cau":"Dạ"}' }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 30 },
  });
  assert.equal(g.chu, '{"cau":"Dạ"}', 'không lẫn phần suy nghĩ');
  assert.deepEqual([g.tokenVao, g.tokenRa], [100, 40]);
  const g2 = gemini.docTraLoi({ candidates: [{ content: { parts: [{ functionCall: { name: 'lay_san_pham', args: { so: 12 } } }] } }] });
  assert.equal(g2.goiCongCu[0].ten, 'lay_san_pham');
  assert.match(g2.goiCongCu[0].id, /^moza_/, 'Gemini không gửi mã thì MOZA tự đặt');

  const p = openai.docTraLoi({ output: [{ type: 'function_call', call_id: 'c9', name: 'lay_san_pham', arguments: '{"so":12}' }], output_text: '', usage: { input_tokens: 50, output_tokens: 7 } });
  assert.deepEqual(p.goiCongCu, [{ id: 'c9', ten: 'lay_san_pham', thamSo: { so: 12 } }]);
  assert.deepEqual([p.tokenVao, p.tokenRa], [50, 7]);

  const a = anthropic.docTraLoi({
    content: [{ type: 'text', text: '{"cau":"Dạ"}' }],
    usage: { input_tokens: 10, cache_read_input_tokens: 90, cache_creation_input_tokens: 0, output_tokens: 5 },
    stop_reason: 'end_turn',
  });
  assert.equal(a.chu, '{"cau":"Dạ"}');
  assert.equal(a.tokenVao, 100);
});

test('đọc phiếu JSON, kể cả khi model bọc trong ```json', () => {
  assert.deepEqual(docPhieu('{"cau":"Dạ"}'), { cau: 'Dạ' });
  assert.deepEqual(docPhieu('```json\n{"cau":"Dạ"}\n```'), { cau: 'Dạ' });
  assert.equal(docPhieu('Dạ vâng'), null);
  assert.equal(docPhieu(''), null);
});

test('Gemini: model không nhận mức MINIMAL → hỏi lại ở LOW, các lần sau dùng LOW luôn', async (t) => {
  const cu = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'khoa-thu';
  const muc = [];
  gemini.datSdk(class {
    constructor() {
      this.models = {
        generateContent: async (req) => {
          muc.push(req.config.thinkingConfig.thinkingLevel);
          if (req.config.thinkingConfig.thinkingLevel === 'MINIMAL') {
            throw new Error('{"error":{"code":400,"message":"Thinking level MINIMAL is not supported for this model. Please retry with other thinking level.","status":"INVALID_ARGUMENT"}}');
          }
          return { candidates: [{ content: { parts: [{ text: 'ok' }] } }] };
        },
      };
    }
  });
  t.after(() => {
    gemini.datSdk(null);
    if (cu === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = cu;
  });
  const o = { model: 'gemini-thu-khong-minimal', mucSuyNghi: 'tat', heThong: 'h', lichSu: [{ vai: 'nguoi', chu: 'chào' }] };
  assert.equal((await gemini.goi(o)).chu, 'ok');
  assert.equal((await gemini.goi(o)).chu, 'ok');
  assert.deepEqual(muc, ['MINIMAL', 'LOW', 'LOW']);
  await gemini.goi({ ...o, model: 'model-khac', mucSuyNghi: 'vua' });
  assert.deepEqual(muc, ['MINIMAL', 'LOW', 'LOW', 'MEDIUM'], 'mức khác giữ nguyên');
});
