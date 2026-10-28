'use strict';

/**
 * Phòng thu của Đội AI dẫn (SPEC.md bản 2.9, F-45): làm tiếng cho các lượt thoại.
 *
 *  1. Soát số (#52): lượt có con số không thấy trong nguồn (thẻ sản phẩm của đoạn, thẻ các món được nhắc trong đoạn,
 *     Sổ tay, phí ship) thì không đọc — tiếng làm sẵn soát được trước khi ra loa.
 *  2. Chia lượt thành khúc liền nhau tối đa 2 nhân vật: TTS hội thoại của Gemini chỉ đọc 2 giọng mỗi lần gọi (#50).
 *     Mỗi khúc một lần gọi; cách nói trong ngoặc (bản 2.8) thành `style` của lượt. Khúc có giọng tự tạo (`voice_…`,
 *     giọng Bắc tả bằng lời — giọng kho tiếng Việt nghe ra giọng Nam, Bước 0 ngày 24/9/2026) thì Google không đọc hội
 *     thoại được: đọc từng lượt rồi nối, tiếng chen lời "|ừ|" thành một lượt ngắn của người đang nghe.
 *  3. Nối các khúc (nghỉ 0,3 giây) thành WAV 24 kHz trong data/doi-ai/tieng/, tên tệp là dấu vân của
 *     model + giọng + chữ: chữ và giọng không đổi thì dùng lại, không gọi Google, không tốn thêm.
 *  Có `khiAm` thì đọc kiểu phát dần: từng mẩu PCM đưa ra ngay (câu chen trực tiếp, F-46).
 *  Bản 2.10 (#55): máy đọc hết lượt trong ngày thì sang máy khác (3.8 còn lại, rồi dự phòng gemini-3.1-flash-tts-preview
 *  với giọng có sẵn); mỗi máy tối đa 8 lượt gọi mỗi phút.
 *  8/10/2026 → BH10: nhà đọc OpenAI (mac-dinh.json "doc_giong", mặc định) → chỉ một máy gpt-realtime-2.1-mini; mỗi nhân vật một giọng
 *  OpenAI theo nam / nữ (Mai = marin, đúng giọng Mai dẫn bằng GPT Live); thẻ tiếng và chen lời "|ừ|" xử lý như máy dự phòng.
 *  BH10 (F-108): nhà ElevenLabs → giọng ElevenLabs riêng của từng nhân vật (giong_eleven); máy đọc giả cho --ai-gia.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tts = require('../agent/nha-cung-cap/tts');
const { thuMucDuLieu } = require('../db/ket-noi');
const doiAi = require('../nghiep-vu/doi-ai');
const sp = require('../nghiep-vu/san-pham');
const { dongCaiDat } = require('../agent/kiem-tra/kiem-tra');
const soTay = require('../nghiep-vu/so-tay');
const caiDat = require('../nghiep-vu/cai-dat');
const chiPhi = require('../nghiep-vu/chi-phi');
const nhatKy = require('../nghiep-vu/nhat-ky');
const { LoiNghiepVu, boDau } = require('../nghiep-vu/chung');

const MODEL_TIET_MUC = 'gemini-3.8-flash-tts'; // tiết mục làm sẵn: diễn hay nhất, chen lời tốt nhất (#50)
const MODEL_CHEN = 'gemini-3.8-flash-lite-tts'; // câu chen trực tiếp: nhanh, rẻ, phát dần
const NGHI_GIUA_KHUC_S = 0.3;
const KHUC_TOI_DA_KY_TU = 1500;
const TAN_SO = 24000;

/** Các con số trong một đoạn chữ, bỏ dấu chấm, phẩy ngăn cách (giống soan-kich-ban.js). */
const cacSo = (s) => (String(s).match(/\d[\d.,]*\d|\d/g) || []).map((x) => x.replace(/[.,]/g, ''));

function thuMuc(con = 'tieng') {
  const d = path.join(thuMucDuLieu() || path.join(__dirname, '..', '..', 'data'), 'doi-ai', con);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const tepTieng = (id) => path.join(thuMuc(), `${String(id).replace(/[^a-f0-9]/g, '')}.wav`);

/** Tệp tiếng đã làm (Buffer WAV) hoặc null. */
function docTep(id) {
  if (!/^[a-f0-9]{20}$/.test(String(id))) return null;
  const f = tepTieng(id);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}

/** Nhãn người nói gửi Google: chữ không dấu, không cách (giống F-39 "NguoiDan"). */
function nhanNguoi(ai) {
  const s = boDau(ai).replace(/[^a-z0-9]/g, '');
  return s ? s[0].toUpperCase() + s.slice(1) : 'Nguoi';
}

/** Giọng của từng nhân vật theo tên (so không phân biệt hoa thường). */
function bangGiong(nhanVat = doiAi.nhanVat()) {
  return new Map(nhanVat.map((n) => [boDau(n.ten), n.giong]));
}

/**
 * Chia lượt thành khúc liền nhau, mỗi khúc tối đa 2 nhân vật và không quá dài.
 * @param {{ai:string}[]} luot
 */
function chiaKhuc(luot) {
  const khuc = [];
  for (const l of luot) {
    const k = khuc.at(-1);
    const ai = k ? new Set(k.map((x) => boDau(x.ai))) : null;
    const dai = k ? k.reduce((s, x) => s + x.loi.length, 0) : 0;
    if (k && (ai.has(boDau(l.ai)) || ai.size < 2) && dai + l.loi.length <= KHUC_TOI_DA_KY_TU) k.push(l);
    else khuc.push([l]);
  }
  return khuc;
}

/**
 * Nguồn để soát số của một đoạn: thẻ sản phẩm của đoạn (không kèm số còn — số còn chỉ đọc bằng câu mẫu, F-46), thẻ các
 * món được nhắc trong lời (số hoặc tên), Sổ tay, phí ship.
 * @param {{sanPhamId?:string|null, chu:string}} o
 */
function nguonSo({ sanPhamId = null, chu = '' }) {
  const ds = sp.mucLucDangBan().map((x) => sp.laySanPham(x.id));
  const cua = new Map();
  if (sanPhamId) {
    try { const x = sp.laySanPham(sanPhamId); cua.set(x.id, x); } catch { /* sản phẩm đã không còn */ }
  }
  const { theoSo, theoTen } = sp.sanPhamDuocNhac(chu, ds);
  for (const x of [...theoSo, ...theoTen]) cua.set(x.id, x);
  const phan = [...cua.values()].map((x) => sp.theChoAi(x, { tonKho: false }));
  for (const m of soTay.danhSachMuc()) phan.push(`${m.tieu_de} ${m.noi_dung}`);
  phan.push(...dongCaiDat());
  // so: các con số có trong nguồn (soát số #52); chu: chữ nguồn (K11 — cụm xuất xứ / công dụng chỉ được nói khi nguồn ghi).
  return { so: cacSo(phan.join(' ')).join(' '), chu: phan.join('\n') };
}

/**
 * Soát số (#52) và từ cấm K11 (F-79): lượt có con số không có trong nguồn, hoặc có từ cấm, thì bỏ.
 * @param {object[]} luot
 * @param {{so:string, chu:string}|string} nguon  kết quả nguonSo (chuỗi số cũ vẫn nhận)
 * @returns {{giu:object[], bo:{ai:string, loi:string, so:string[], tu_cam:string[]}[]}}
 */
function soatSo(luot, nguon) {
  const so = typeof nguon === 'string' ? nguon : nguon?.so || '';
  const chu = typeof nguon === 'string' ? [] : [nguon?.chu || ''];
  const { timTuCam } = require('../nghiep-vu/tu-cam');
  const giu = [];
  const bo = [];
  for (const l of luot) {
    const la = [...new Set(cacSo(l.loi).filter((x) => !so.includes(x)))];
    const cam = timTuCam(l.loi, { nguon: chu }).map((x) => x.cum);
    if (la.length || cam.length) bo.push({ ai: l.ai, loi: l.loi, so: la, tu_cam: cam });
    else giu.push(l);
  }
  return { giu, bo };
}

// F-127: lượt không ghi cách nói thì dùng tông giọng shop chọn (Cài đặt → Giọng Mai) làm cách nói mặc định.
function cachNoiCua(l) {
  if (l.cachNoi) return l.cachNoi;
  try { return require('../nghiep-vu/tong-giong').cachNoiDoi() || ''; } catch { return ''; } // chưa mở cơ sở dữ liệu (test)
}

// Dấu vân theo chữ máy đọc: đổi cách đọc (docRo) thì làm tiếng lại, câu không đổi thì vẫn dùng lại tiếng cũ.
function dauVan(model, luot, giong) {
  const x = JSON.stringify([model, luot.map((l) => [giong.get(boDau(l.ai)) || '', cachNoiCua(l), docRo(l.loi)])]);
  return crypto.createHash('sha1').update(x).digest('hex').slice(0, 20);
}

const NGHI_GIUA_LUOT_S = 0.2; // đọc từng lượt: nghỉ ngắn giữa hai người như khi nói chuyện
const laGiongTuTao = (g) => /^voice(key)?_/i.test(String(g || ''));

/**
 * Đọc từng lượt (giọng tự tạo): tiếng chen lời "|ừ|" trong lượt của A thành một lượt ngắn của người đang nghe
 * (người nói ngay trước hoặc ngay sau A); không có ai khác thì bỏ.
 */
function tachChenLoi(luot) {
  const kq = [];
  luot.forEach((l, i) => {
    if (!/\|[^|\n]{1,30}\|/.test(l.loi)) {
      kq.push(l);
      return;
    }
    const nghe = [...luot.slice(0, i)].reverse().find((x) => boDau(x.ai) !== boDau(l.ai))?.ai
      || luot.slice(i + 1).find((x) => boDau(x.ai) !== boDau(l.ai))?.ai || null;
    for (const [j, phan] of l.loi.split(/\|([^|\n]{1,30})\|/).entries()) {
      const s = phan.trim();
      if (!s) continue;
      if (j % 2 === 0) kq.push({ ...l, loi: s });
      else if (nghe) kq.push({ ai: nghe, cachNoi: 'đáp nhanh, tự nhiên', loi: s });
    }
  });
  return kq;
}

const ngu = (ms) => new Promise((ok) => setTimeout(ok, ms));
let thuLaiMs = 1500; // test rút ngắn bằng datThuLaiMs
const datThuLaiMs = (ms) => { thuLaiMs = ms; };

/**
 * Chữ đưa máy đọc (chữ trên màn hình và phần soát số giữ nguyên): tiền viết tắt kiểu người đi làm hay dùng đọc ra lời rõ
 * ràng. Buổi tập 24/9/2026: "400k" bị đọc "bốn trăm ca" (dễ hiểu nhầm 400 ca làm), "16,2 triệu" đọc vấp.
 */
function docRo(chu) {
  return String(chu)
    // Chữ viết tắt hay gặp khi bán hàng: "COD", "ship" đọc rõ; buổi tập 25/9/2026 (bản tuyển dụng): "KCN", "CCCD" đọc từng chữ cái.
    .replace(/(?<![\p{L}\d])COD(?![\p{L}])/gu, 'thanh toán khi nhận hàng')
    .replace(/(?<![\p{L}\d])KCN(?![\p{L}])/gu, 'khu công nghiệp')
    .replace(/(?<![\p{L}\d])CCCD(?![\p{L}])/gu, 'căn cước công dân')
    .replace(/(?<![\p{L}\d])CMND(?![\p{L}])/gu, 'chứng minh nhân dân')
    .replace(/(?<![\p{L}\d])BHXH(?![\p{L}])/gu, 'bảo hiểm xã hội')
    .replace(/(\d)\s?(?:VNĐ|VND)(?![\p{L}])/giu, '$1 đồng')
    .replace(/(\d+(?:[.,]\d+)?)\s?k(?![\p{L}\d])/giu, '$1 nghìn')
    .replace(/(\d+)\s?tr(\d{1,3})?(?![\p{L}\d])/giu, (_, a, b) => `${a} triệu${b ? ` ${b}` : ''}`)
    .replace(/(\d+),(\d)\s?triệu/gu, '$1 triệu $2')
    .replace(/\s?\/\s?(\d+)\s?(?:h|giờ)(?![\p{L}\d])/giu, ' cho $1 giờ')
    .replace(/\s?\/\s?(tháng|ngày|tuần|năm|ca|giờ|công|người)(?![\p{L}])/giu, ' một $1');
}

// Model TTS đã hết lượt trong ngày → lúc mở lại (ms). Khóa gói trả phí mức 1 chỉ 100 lượt/ngày mỗi model (25/9/2026):
// biết hết rồi thì báo ngay, không gọi Google nữa (gọi thêm vừa chậm vừa có thể bị tính vào lượt).
const hetLuot = new Map();

function kiemHetLuot(model) {
  const den = hetLuot.get(model);
  if (!den) return;
  if (Date.now() >= den.luc) {
    hetLuot.delete(model);
    return;
  }
  const e = new LoiNghiepVu('HET_LUOT_NGAY', den.thongDiep, 429);
  e.model = model;
  throw e;
}

/** Test: xóa ghi nhớ hết lượt và lịch gọi. */
const quenHetLuot = () => { hetLuot.clear(); lichGoi.clear(); };

// Giãn nhịp (#55): Google cho mỗi máy đọc 10 lượt/phút (AI Studio → Rate Limit, 25/9/2026); MOZA tự giữ dưới 8 để làm
// sẵn tiếng ở nền và câu chen trực tiếp không bị từ chối cùng lúc.
let nhipGoi = { toiDa: 8, cuaSoMs: 60000 };
const lichGoi = new Map(); // model → các lúc đã gọi trong cửa sổ
const datNhipGoi = (o) => { nhipGoi = { ...nhipGoi, ...o }; };

/** Chờ tới lượt được gọi máy đọc `model` (không quá nhipGoi.toiDa lần trong nhipGoi.cuaSoMs). */
async function choLuotGoi(model) {
  for (;;) {
    const bayGio = Date.now();
    const ds = (lichGoi.get(model) || []).filter((t) => bayGio - t < nhipGoi.cuaSoMs);
    if (ds.length < nhipGoi.toiDa) {
      ds.push(bayGio);
      lichGoi.set(model, ds);
      return;
    }
    lichGoi.set(model, ds);
    await ngu(ds[0] + nhipGoi.cuaSoMs - bayGio + 5);
  }
}

/**
 * Một khúc hội thoại, tự thử lại tối đa 2 lần khi Google quá tải (503, gặp thường ngày 23–24/9/2026) — chỉ khi chưa
 * phát ra mẩu tiếng nào, để người nghe không nghe lặp. Hết lượt trong ngày thì không thử lại (ghi nhớ, báo ngay).
 */
async function docKhuc(thamSo) {
  kiemHetLuot(thamSo.model);
  for (let lan = 0; ; lan += 1) {
    let daPhat = false;
    await choLuotGoi(thamSo.model);
    try {
      return await tts.docHoiThoai({
        ...thamSo,
        khiAm: thamSo.khiAm ? (b) => { daPhat = true; thamSo.khiAm(b); } : null,
      });
    } catch (e) {
      if (e.ma === 'HET_LUOT_NGAY') {
        hetLuot.set(thamSo.model, { luc: Date.now() + (e.choMs || 60 * 60 * 1000), thongDiep: e.message });
        throw e;
      }
      const tamThoi = [429, 500, 503].includes(e.http) || e.ma === 'QUA_THOI_GIAN';
      if (!tamThoi || daPhat || lan >= 2 || thamSo.tinHieu?.aborted) throw e;
      await ngu(thuLaiMs * (lan + 1));
    }
  }
}

function ghiChiPhi({ viec, model, token, phienLiveId = null, dienTap = false }) {
  const usd = chiPhi.tinhChiPhiDoc(model, token);
  const runId = nhatKy.taoRun({ agentId: 'doi_ai', kichHoat: viec, phienLiveId, dienTap });
  nhatKy.xongRun(runId, { nha: tts.nhaCuaModel(model), model, tokenVao: token.vao, tokenRa: token.ra, chiPhi: usd });
  return { usd, canhBao: chiPhi.kiemMucTran() };
}

/**
 * Làm tiếng các lượt (đã soát số). Có sẵn trong kho thì dùng lại.
 * @param {object} o
 * @param {{ai:string, cachNoi?:string, loi:string}[]} o.luot
 * @param {string} [o.model]
 * @param {string} o.viec          ghi nhật ký chi phí, ví dụ "Đội AI · đoạn 3/17"
 * @param {(pcm:Buffer) => void} [o.khiAm]   phát dần: nhận PCM 24 kHz ngay khi tới
 * @param {AbortSignal} [o.tinHieu]
 * @returns {Promise<{id:string, wav:Buffer, giay:number, tuKho:boolean, usd:number, canhBao:string|null}>}
 */
async function lamTiengLuot({ luot, model = MODEL_TIET_MUC, viec, khiAm = null, tinHieu = null, phienLiveId = null, dienTap = false, nhanVat = null }) {
  const ds = (luot || []).filter((l) => String(l?.loi ?? '').trim());
  if (!ds.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Đoạn này chưa có lượt nói nào của đội AI.');
  const nv = nhanVat || doiAi.nhanVat();
  const thuTu = cacLuaChon(model, nv);
  const giongChinh = thuTu[0].giong;
  const thieu = [...new Set(ds.filter((l) => !giongChinh.has(boDau(l.ai))).map((l) => l.ai))];
  if (thieu.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Chưa có nhân vật ${thieu.join(', ')} trong đội AI (Cài đặt → Đội AI dẫn).`);
  // Đã có tiếng của máy nào (ưu tiên máy được giao) thì dùng lại, không gọi Google.
  for (const lc of thuTu) {
    const id = dauVan(lc.model, ds, lc.giong);
    const co = docTep(id);
    if (co) {
      if (khiAm) khiAm(tts.tachWav(co).pcm);
      return { id, wav: co, giay: tts.soGiay(co), tuKho: true, usd: 0, canhBao: null, model: lc.model };
    }
  }
  if (caiDat.khanCap()) throw new LoiNghiepVu('KHAN_CAP_DANG_BAT', '"Dừng mọi thứ" đang bật: đội AI không làm tiếng mới.', 409);
  // Máy nào hết lượt trong ngày thì sang máy sau (#55) — trừ khi đã phát ra một phần tiếng (người nghe sẽ nghe lặp).
  let loiCuoi = null;
  for (const lc of thuTu) {
    let daPhat = false;
    try {
      return await lamTiengMay({
        ds, model: lc.model, giong: lc.giong, viec, tinHieu, phienLiveId, dienTap,
        khiAm: khiAm ? (b) => { daPhat = true; khiAm(b); } : null,
      });
    } catch (e) {
      if (e.ma !== 'HET_LUOT_NGAY' || daPhat) throw e;
      loiCuoi = e;
    }
  }
  throw loiCuoi;
}

// Giọng có sẵn cho máy dự phòng 3.1 (không nhận giọng kho vi-vn-… — thử 25/9/2026), gán theo nam nữ, không trùng.
const GIONG_DU_PHONG = { nu: ['Zephyr', 'Sulafat', 'Leda', 'Aoede'], nam: ['Puck', 'Charon', 'Fenrir'] };

/** Giọng dự phòng của từng nhân vật (theo thứ tự trong đội): nữ Zephyr, Sulafat…; nam Puck, Charon… */
function bangGiongDuPhong(nhanVat = doiAi.nhanVat()) {
  const dem = { nu: 0, nam: 0 };
  return new Map(nhanVat.map((n, i) => {
    const gioi = n.gioi === 'nam' || n.gioi === 'nu' ? n.gioi : i % 2 ? 'nam' : 'nu';
    const ds = GIONG_DU_PHONG[gioi];
    const g = ds[dem[gioi] % ds.length];
    dem[gioi] += 1;
    return [boDau(n.ten), g];
  }));
}

// Giọng OpenAI cho Đội AI, gán theo nam nữ, không trùng; nhân vật đầu (Mai) nữ → marin. BH10 (F-108): chỉ giọng của máy đọc
// Realtime gpt-realtime-2.1-mini (bỏ nova, fable, onyx).
const GIONG_OPENAI = { nu: ['marin', 'coral', 'shimmer', 'sage', 'alloy'], nam: ['cedar', 'ash', 'verse', 'ballad', 'echo'] };

/** Giọng ElevenLabs của từng nhân vật (Cài đặt → Đội AI dẫn → Giọng ElevenLabs); chưa chọn thì null → báo chưa chọn giọng. */
function bangGiongEleven(nhanVat = doiAi.nhanVat()) {
  return new Map(nhanVat.map((n) => [boDau(n.ten), n.giong_eleven || null]));
}

function bangGiongOpenAi(nhanVat = doiAi.nhanVat()) {
  const dem = { nu: 0, nam: 0 };
  return new Map(nhanVat.map((n, i) => {
    const gioi = n.gioi === 'nam' || n.gioi === 'nu' ? n.gioi : i % 2 ? 'nam' : 'nu';
    const ds = GIONG_OPENAI[gioi];
    const g = ds[dem[gioi] % ds.length];
    dem[gioi] += 1;
    return [boDau(n.ten), g];
  }));
}

/**
 * Các máy đọc theo thứ tự thử (#55): máy được giao → máy 3.8 còn lại → máy dự phòng 3.1 (giọng có sẵn).
 * Máy một giọng (OpenAI, máy đọc giả): chỉ một máy, giọng OpenAI theo nam nữ.
 * @returns {{model:string, giong:Map}[]}
 */
function cacLuaChon(model, nhanVat) {
  if (tts.nhaDoc() === 'elevenlabs') return [{ model: tts.MODEL_ELEVEN, giong: bangGiongEleven(nhanVat) }];
  if (tts.nhaDoc() !== 'gemini') return [{ model: tts.modelMacDinh(), giong: bangGiongOpenAi(nhanVat) }];
  const giong = bangGiong(nhanVat);
  const ds = [model, ...[MODEL_TIET_MUC, MODEL_CHEN].filter((m) => m !== model)].filter((m) => m !== tts.MODEL_DU_PHONG)
    .map((m) => ({ model: m, giong }));
  ds.push({ model: tts.MODEL_DU_PHONG, giong: bangGiongDuPhong(nhanVat) });
  return ds;
}

/** Máy dự phòng không hiểu thẻ tiếng <laugh> và chen lời |ừ| kiểu Gemini 3.8: bỏ thẻ; chen lời thành lượt riêng (tachChenLoi). */
const boThe = (s) => String(s).replace(/<[^>]{1,20}>/g, ' ').replace(/\s+/g, ' ').trim();

/** Cộng token của một lần đọc (vao, ra, và ra_chu / ky_tu của máy đọc mới — BH10). */
function congToken(tong, t) {
  for (const [k, v] of Object.entries(t || {})) tong[k] = (tong[k] || 0) + (v || 0);
}

/** Làm tiếng các lượt bằng một máy đọc cụ thể, lưu tệp, ghi chi phí. */
async function lamTiengMay({ ds: dsGoc, model, giong, viec, khiAm, tinHieu, phienLiveId, dienTap }) {
  const id = dauVan(model, dsGoc, giong);
  const duPhong = model === tts.MODEL_DU_PHONG || tts.laMotGiong(model);
  const ds = duPhong ? tachChenLoi(dsGoc).map((l) => ({ ...l, loi: boThe(l.loi) })).filter((l) => l.loi) : dsGoc;
  const nghi = Buffer.alloc(Math.round(TAN_SO * NGHI_GIUA_KHUC_S) * 2);
  const phan = [];
  const token = { vao: 0, ra: 0 };
  // Có giọng tự tạo thì đọc từng lượt (mỗi lượt một khúc một giọng), giữa hai lượt nghỉ ngắn.
  const tuTao = ds.some((l) => laGiongTuTao(giong.get(boDau(l.ai))));
  const khuc = tuTao ? tachChenLoi(ds).map((l) => [l]) : chiaKhuc(ds);
  const nghiLuot = Buffer.alloc(Math.round(TAN_SO * NGHI_GIUA_LUOT_S) * 2);
  // Làm sẵn (không phát dần): đọc tối đa 3 lượt cùng lúc cho nhanh; phát dần thì đọc lần lượt để tiếng ra đúng thứ tự.
  const truoc = !khiAm && tuTao ? new Map() : null;
  const docMot = (k) => {
    const nhan = new Map(k.map((l) => [boDau(l.ai), nhanNguoi(l.ai)]));
    // Hai nhân vật khác tên nhưng cùng nhãn không dấu (hiếm): thêm số cho khỏi trùng.
    if (new Set(nhan.values()).size < nhan.size) [...nhan.keys()].forEach((k2, j) => nhan.set(k2, `${nhan.get(k2)}${j + 1}`));
    return docKhuc({
      luot: k.map((l) => ({ nguoi: nhan.get(boDau(l.ai)), chu: docRo(l.loi), phongCach: cachNoiCua(l) || null })),
      giong: Object.fromEntries([...nhan.entries()].map(([ten, n]) => [n, giong.get(ten)])),
      model,
      khiAm,
      tinHieu,
    });
  };
  if (truoc) {
    for (let i = 0; i < khuc.length; i += 3) {
      const nhom = khuc.slice(i, i + 3);
      const kqs = await Promise.all(nhom.map(docMot));
      kqs.forEach((kq, j) => truoc.set(i + j, kq));
    }
  }
  for (const [i, k] of khuc.entries()) {
    if (i) {
      const cach = tuTao ? nghiLuot : nghi;
      phan.push(cach);
      if (khiAm) khiAm(cach);
    }
    if (truoc) {
      const kq = truoc.get(i);
      phan.push(kq.pcm);
      congToken(token, kq.token);
      continue;
    }
    const kq = await docMot(k);
    phan.push(kq.pcm);
    congToken(token, kq.token);
  }
  const wav = tts.bocWav(Buffer.concat(phan));
  if (!tinHieu?.aborted) fs.writeFileSync(tepTieng(id), wav);
  const { usd, canhBao } = ghiChiPhi({ viec, model, token, phienLiveId, dienTap });
  return { id, wav, giay: tts.soGiay(wav), tuKho: false, usd, canhBao, model };
}

/**
 * Làm tiếng một đoạn kịch bản (F-45): soát số rồi làm tiếng. Đoạn đố vui có "[Chờ bình luận]" thành hai phần
 * (hỏi, đáp) để lúc live chờ người xem trả lời ở giữa (F-48); đoạn Radio có "[Bài hát]" cũng vậy (mời nghe, quay lại — F-50).
 * @param {object} o
 * @param {{san_pham_id?:string|null, loi_nhac:string}} o.doan
 * @returns {Promise<{phan:{id:string, giay:number, tuKho:boolean}[], bo:object[], cho:object|null, dapAn:string[],
 *   tietMuc:string, luot:object[], usd:number, canhBao:string|null}>}
 */
async function lamTiengDoan({ doan, viec, model = MODEL_TIET_MUC, dienTap = false, phienLiveId = null }) {
  const nv = doiAi.nhanVat();
  const t = doiAi.tachThoai(doan?.loi_nhac, nv.map((n) => n.ten));
  const nguon = nguonSo({ sanPhamId: doan?.san_pham_id || doan?.san_pham?.id || null, chu: t.luot.map((l) => l.loi).join(' ') });
  const [truoc, sau] = doiAi.chiaHaiPhan(t);
  const a = soatSo(truoc, nguon);
  const b = soatSo(sau, nguon);
  const phan = [];
  let usd = 0;
  let canhBao = null;
  for (const [j, luot] of [a.giu, b.giu].entries()) {
    if (!luot.length) continue;
    const kq = await lamTiengLuot({ luot, model, viec: j ? `${viec} (phần đáp)` : viec, dienTap, phienLiveId, nhanVat: nv });
    phan.push({ id: kq.id, giay: kq.giay, tuKho: kq.tuKho });
    usd += kq.usd;
    canhBao = canhBao || kq.canhBao;
  }
  return {
    phan, bo: [...a.bo, ...b.bo], cho: t.cho && b.giu.length ? { giay: t.cho.giay } : null, dapAn: t.dapAn, tietMuc: t.tietMuc,
    // Radio (F-50): bài hát phát sau phần trước; phần sau là lời quay lại. Phần trước bị soát bỏ hết thì phan[0] là phần sau.
    baiHat: t.baiHat ? { coTruoc: a.giu.length > 0, coSau: b.giu.length > 0 } : null,
    luot: [...a.giu, ...b.giu], luotTruoc: a.giu, luotSau: b.giu, usd, canhBao,
  };
}

/** Đoạn nào đã có tiếng sẵn (không gọi Google): để màn hình Kịch bản hiện "đã có tiếng". */
function coSan(doan, model = MODEL_TIET_MUC) {
  const nv = doiAi.nhanVat();
  const t = doiAi.tachThoai(doan?.loi_nhac, nv.map((n) => n.ten));
  if (!t.luot.length) return false;
  const thuTu = cacLuaChon(model, nv);
  const nguon = nguonSo({ sanPhamId: doan?.san_pham_id || doan?.san_pham?.id || null, chu: t.luot.map((l) => l.loi).join(' ') });
  return doiAi.chiaHaiPhan(t).map((ds) => soatSo(ds, nguon).giu).filter((ds) => ds.length)
    .every((ds) => thuTu.some((lc) => !!docTep(dauVan(lc.model, ds, lc.giong))));
}

module.exports = {
  cachNoiCua,
  lamTiengLuot, lamTiengDoan, coSan, docTep, chiaKhuc, soatSo, nguonSo, nhanNguoi, dauVan, bangGiong, thuMuc, cacSo,
  MODEL_TIET_MUC, MODEL_CHEN, datThuLaiMs, tachChenLoi, laGiongTuTao, docRo, quenHetLuot, datNhipGoi, cacLuaChon,
  bangGiongDuPhong, GIONG_DU_PHONG, bangGiongOpenAi, GIONG_OPENAI, bangGiongEleven,
};
