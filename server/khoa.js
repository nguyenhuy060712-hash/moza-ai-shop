'use strict';

/**
 * Kho khoá API.
 *
 * Khoá chỉ nằm trong file .env trên máy này. Trình duyệt không bao giờ
 * nhận được khoá thật — chỉ nhận trạng thái "đã có / chưa có" và bốn ký tự
 * cuối để người dùng nhận ra mình đang dùng khoá nào.
 *
 * Lưu khoá mới có tác dụng ngay, không cần khởi động lại chương trình.
 */

const fs = require('fs');
const path = require('path');
const AnthropicSdk = require('@anthropic-ai/sdk');

const Anthropic = AnthropicSdk.default || AnthropicSdk;

const GOC = path.join(__dirname, '..');

// Test đặt MOZA_FILE_ENV sang một file tạm để không bao giờ ghi vào .env thật của người dùng.
function fileEnv() {
  return process.env.MOZA_FILE_ENV || path.join(GOC, '.env');
}

const TEN = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY', // máy đọc ElevenLabs (BH10, F-108)
};

const NHAN = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Anthropic (Claude)', elevenlabs: 'ElevenLabs' };

/**
 * Mã Facebook (SPEC.md A.11, F-06). Cũng chỉ nằm trong .env. App ID và Page ID không bí mật nhưng vẫn
 * để chung chỗ cho người dùng dễ tìm. Mã xác minh webhook do MOZA tự sinh, người dùng không phải biết.
 */
const TEN_FB = {
  app_id: 'FB_APP_ID',
  app_secret: 'FB_APP_SECRET',
  page_id: 'FB_PAGE_ID',
  page_token: 'FB_PAGE_TOKEN',
  verify_token: 'FB_WEBHOOK_VERIFY_TOKEN',
};
const BI_MAT_FB = ['app_secret', 'page_token', 'verify_token'];

/* ---------------- đọc ghi file .env ---------------- */

function docEnv() {
  try {
    return fs.readFileSync(fileEnv(), 'utf8');
  } catch {
    return '';
  }
}

// Thay đúng một dòng KEY=..., giữ nguyên chú thích và các dòng khác.
// Không có dòng đó thì thêm vào cuối.
function ghiEnv(bien, giaTri) {
  const cu = docEnv();
  const xuong = cu.includes('\r\n') ? '\r\n' : '\n';
  const dong = cu ? cu.split(/\r?\n/) : [];
  const re = new RegExp('^\\s*' + bien + '\\s*=');

  let thay = false;
  for (let i = 0; i < dong.length; i += 1) {
    if (re.test(dong[i])) {
      dong[i] = `${bien}=${giaTri}`;
      thay = true;
      break;
    }
  }
  if (!thay) {
    while (dong.length && dong[dong.length - 1].trim() === '') dong.pop();
    dong.push(`${bien}=${giaTri}`);
  }

  let noiDung = dong.join(xuong);
  if (!noiDung.endsWith(xuong)) noiDung += xuong;

  const tam = fileEnv() + '.tmp';
  fs.writeFileSync(tam, noiDung, 'utf8');
  fs.renameSync(tam, fileEnv());
}

/* ---------------- đọc ---------------- */

function lay(nha) {
  const bien = TEN[nha];
  if (!bien) return '';
  return String(process.env[bien] || '').trim();
}

function duoi(k) {
  const s = String(k || '').trim();
  if (s.length < 4) return '';
  return s.slice(-4);
}

function trangThai() {
  const kq = {};
  for (const nha of Object.keys(TEN)) {
    const k = lay(nha);
    kq[nha] = { co: !!k, duoi: duoi(k) };
  }
  return kq;
}

/* ---------------- ghi ---------------- */

function dat(nha, khoa) {
  const bien = TEN[nha];
  if (!bien) return { loi: `Không biết nhà cung cấp "${nha}"` };

  const sach = String(khoa == null ? '' : khoa).trim();

  // Người dùng hay dán kèm dấu nháy hoặc "Bearer " ở đầu.
  const gon = sach.replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();

  if (gon && /\s/.test(gon)) return { loi: 'Khoá không được chứa dấu cách' };

  try {
    ghiEnv(bien, gon);
  } catch (e) {
    return { loi: 'Không ghi được file .env: ' + e.message };
  }

  process.env[bien] = gon;
  return { ok: true, co: !!gon, duoi: duoi(gon) };
}

/* ---------------- mã Facebook ---------------- */

function layFb(ten) {
  const bien = TEN_FB[ten];
  return bien ? String(process.env[bien] || '').trim() : '';
}

/** Lưu một mã Facebook vào .env. ID phải là dãy số; mã không được có dấu cách. */
function datFb(ten, giaTri) {
  const bien = TEN_FB[ten];
  if (!bien) return { loi: `Không biết mã Facebook "${ten}"` };
  const gon = String(giaTri == null ? '' : giaTri).trim().replace(/^["']|["']$/g, '').trim();
  if (gon && /\s/.test(gon)) return { loi: 'Mã không được chứa dấu cách' };
  if (gon && (ten === 'app_id' || ten === 'page_id') && !/^\d{5,30}$/.test(gon)) {
    return { loi: ten === 'app_id' ? 'App ID là một dãy số (xem ở trang Cài đặt cơ bản của ứng dụng Meta).' : 'Page ID là một dãy số.' };
  }
  try {
    ghiEnv(bien, gon);
  } catch (e) {
    return { loi: 'Không ghi được file .env: ' + e.message };
  }
  process.env[bien] = gon;
  return { ok: true };
}

/* ---------------- nhiều Page (bản 2.4, #37) ----------------
 * Danh sách Page trong `FB_PAGES=id1,id2`; mã từng Page trong `FB_PAGE_TOKEN_<id>`.
 * Bản cũ một Page (`FB_PAGE_ID`, `FB_PAGE_TOKEN`) vẫn đọc được như một Page trong danh sách.
 */

/** Mật khẩu WebSocket của OBS (#90): cũng chỉ nằm trong .env, trình duyệt chỉ thấy 4 ký tự cuối. */
function layObs() {
  return String(process.env.OBS_MAT_KHAU || '').trim();
}

function datObs(matKhau) {
  const gon = String(matKhau == null ? '' : matKhau).trim().replace(/^["']|["']$/g, '').trim();
  try { ghiEnv('OBS_MAT_KHAU', gon); } catch (e) { return { loi: 'Không ghi được file .env: ' + e.message }; }
  process.env.OBS_MAT_KHAU = gon;
  return { ok: true, duoi: duoi(gon) };
}

function dsPage() {
  const ds = String(process.env.FB_PAGES || '').split(',').map((x) => x.trim()).filter((x) => /^\d{5,30}$/.test(x));
  const cu = layFb('page_id');
  if (cu && layFb('page_token') && !ds.includes(cu)) ds.unshift(cu);
  return ds;
}

function layMaPage(pageId) {
  const id = String(pageId || '');
  const k = String(process.env[`FB_PAGE_TOKEN_${id}`] || '').trim();
  if (k) return k;
  return id && id === layFb('page_id') ? layFb('page_token') : '';
}

/** Thêm hoặc thay mã một Page. */
function datPage(pageId, ma) {
  const id = String(pageId || '').trim();
  if (!/^\d{5,30}$/.test(id)) return { loi: 'Page ID là một dãy số.' };
  const gon = String(ma || '').trim();
  if (!gon || /\s/.test(gon)) return { loi: 'Mã Page không hợp lệ.' };
  try {
    ghiEnv(`FB_PAGE_TOKEN_${id}`, gon);
    process.env[`FB_PAGE_TOKEN_${id}`] = gon;
    const ds = dsPage().filter((x) => x !== id);
    ds.push(id);
    ghiEnv('FB_PAGES', ds.join(','));
    process.env.FB_PAGES = ds.join(',');
  } catch (e) {
    return { loi: 'Không ghi được file .env: ' + e.message };
  }
  return { ok: true };
}

/** Bỏ một Page khỏi MOZA: xóa mã khỏi .env. */
function boPage(pageId) {
  const id = String(pageId || '');
  if (layFb('page_id') === id) { datFb('page_id', ''); datFb('page_token', ''); }
  const ds = dsPage().filter((x) => x !== id);
  ghiEnv('FB_PAGES', ds.join(','));
  process.env.FB_PAGES = ds.join(',');
  ghiEnv(`FB_PAGE_TOKEN_${id}`, '');
  process.env[`FB_PAGE_TOKEN_${id}`] = '';
  return { ok: true };
}

/** Trình duyệt chỉ nhận "đã có / chưa có" và 4 ký tự cuối; ID không bí mật nên hiện đủ. */
function trangThaiFb() {
  const kq = {};
  for (const ten of Object.keys(TEN_FB)) {
    if (ten === 'verify_token' || ten === 'page_id' || ten === 'page_token') continue;
    const k = layFb(ten);
    kq[ten] = BI_MAT_FB.includes(ten) ? { co: !!k, duoi: duoi(k) } : { co: !!k, gia_tri: k };
  }
  kq.pages = dsPage().map((id) => ({ id, co: !!layMaPage(id), duoi: duoi(layMaPage(id)) }));
  return kq;
}

/** Mã xác minh webhook: MOZA tự sinh một lần, ghi vào .env (Meta hỏi lại mã này khi đăng ký địa chỉ). */
function damBaoVerifyToken() {
  let k = layFb('verify_token');
  if (!k) {
    k = require('node:crypto').randomBytes(24).toString('base64url');
    const kq = datFb('verify_token', k);
    if (kq.loi) process.env[TEN_FB.verify_token] = k; // không ghi được file thì vẫn dùng trong lần chạy này
  }
  return k;
}

/* ---------------- kiểm tra khoá có dùng được không ---------------- */

// Anthropic dùng thư viện chính thức: lỗi có lớp riêng (sai khoá, bị giới hạn, mất mạng),
// không phải đoán theo mã HTTP.
async function kiemTraAnthropic(k, modelMongDoi) {
  const client = new Anthropic({ apiKey: k, timeout: 15000, maxRetries: 0 });
  const ten = [];
  try {
    for await (const m of client.models.list()) ten.push(m.id);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, loi: 'Anthropic từ chối khoá này. Xem lại khoá đã dán đúng chưa.' };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, loi: 'Khoá Anthropic không có quyền dùng API.' };
    if (e instanceof Anthropic.RateLimitError) return { ok: true, canh: 'Khoá dùng được nhưng Anthropic đang giới hạn lượt gọi.' };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, loi: 'Không kết nối được tới Anthropic. Kiểm tra mạng.' };
    if (e instanceof Anthropic.APIError) return { ok: false, loi: `Anthropic trả về lỗi ${e.status}.` };
    return { ok: false, loi: 'Lỗi khi kiểm tra khoá Anthropic: ' + e.message };
  }
  return soModel(ten, modelMongDoi);
}

// Khoá chạy được. Xem các model đang đặt có trong danh sách của tài khoản không.
function soModel(ten, modelMongDoi) {
  const mm = [].concat(modelMongDoi || []).map((x) => String(x).trim()).filter(Boolean);
  const thieu = ten.length ? mm.filter((x) => !ten.includes(x)) : [];
  if (thieu.length) {
    return { ok: true, canh: `Khoá dùng được, nhưng tài khoản này không thấy model: ${thieu.join(', ')}.` };
  }
  return { ok: true };
}

// Gọi thật lên nhà cung cấp. Dùng endpoint liệt kê model vì nó nhẹ,
// không tốn token, và cho biết luôn các model đang đặt có tồn tại hay không.
async function kiemTra(nha, modelMongDoi) {
  const k = lay(nha);
  if (!k) return { ok: false, loi: `Chưa có khoá ${NHAN[nha] || nha}` };
  if (nha === 'anthropic') return kiemTraAnthropic(k, modelMongDoi);

  let url;
  let dau = {};
  if (nha === 'gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(k);
  } else if (nha === 'openai') {
    url = 'https://api.openai.com/v1/models';
    dau = { Authorization: `Bearer ${k}` };
  } else if (nha === 'elevenlabs') {
    // GET /v1/models miễn phí; cho biết eleven_v4 có trong tài khoản không (docs/11 T9).
    url = 'https://api.elevenlabs.io/v1/models';
    dau = { 'xi-api-key': k };
    modelMongDoi = [].concat(modelMongDoi || [], 'eleven_v4');
  } else {
    return { ok: false, loi: `Không biết nhà cung cấp "${nha}"` };
  }

  let res;
  try {
    res = await fetch(url, { headers: dau, signal: AbortSignal.timeout(15000) });
  } catch (e) {
    const het = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return {
      ok: false,
      loi: het
        ? `Gọi tới ${NHAN[nha]} quá lâu không trả lời. Kiểm tra mạng.`
        : `Không kết nối được tới ${NHAN[nha]}: ${e.message}`,
    };
  }

  // Lỗi thì không cần thân trả về, nhưng vẫn phải đọc bỏ: thân bỏ dở giữ luồng HTTP/2 mở, hết giờ rảnh thì undici báo
  // "socket idle timeout" trên luồng không ai nghe → sập cả phần mềm (gặp thật 28/10/2026 08:19, bản xem thử của chủ dự án).
  if (!res.ok && res.status !== 429) await res.body?.cancel().catch(() => {});
  if (res.status === 401 || res.status === 403) {
    return { ok: false, loi: `${NHAN[nha]} từ chối khoá này. Xem lại khoá đã dán đúng chưa.` };
  }
  if (res.status === 400) {
    return { ok: false, loi: `${NHAN[nha]} báo khoá không hợp lệ.` };
  }
  if (res.status === 429) {
    await res.body?.cancel().catch(() => {});
    return { ok: true, canh: `Khoá dùng được nhưng ${NHAN[nha]} đang giới hạn lượt gọi.` };
  }
  if (!res.ok) {
    return { ok: false, loi: `${NHAN[nha]} trả về lỗi ${res.status}.` };
  }

  let ten = [];
  try {
    const d = await res.json();
    if (nha === 'gemini') ten = (d.models || []).map((m) => String(m.name || '').replace(/^models\//, ''));
    else if (nha === 'elevenlabs') ten = (Array.isArray(d) ? d : []).map((m) => String(m.model_id || ''));
    else ten = (d.data || []).map((m) => String(m.id || ''));
  } catch {
    return { ok: true };
  }
  return soModel(ten, modelMongDoi);
}

/**
 * Che mọi khóa đang có trong một đoạn chữ trước khi ghi nhật ký hay trả về giao diện (F-13).
 * Lỗi của nhà cung cấp đôi khi lặp lại cả địa chỉ gọi, mà địa chỉ Gemini có `key=...`.
 */
function anKhoa(s) {
  if (s == null) return s;
  let kq = String(s);
  const ds = [...Object.keys(TEN).map(lay), ...BI_MAT_FB.map(layFb), ...dsPage().map(layMaPage)];
  for (const k of ds) {
    if (k.length >= 8) kq = kq.split(k).join('***');
  }
  return kq.replace(/([?&](?:key|access_token|appsecret_proof|client_secret|fb_exchange_token)=)[^&\s"']+/gi, '$1***');
}

module.exports = { layObs, datObs, lay, dat, trangThai, kiemTra, anKhoa, TEN, NHAN, fileEnv, layFb, datFb, trangThaiFb, damBaoVerifyToken, TEN_FB, dsPage, layMaPage, datPage, boPage };
