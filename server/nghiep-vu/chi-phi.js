'use strict';

/**
 * Chi phí và mức trần (F-14, A.11). Chi phí = token nhà cung cấp trả về × bảng giá trong
 * server/cau-hinh/gia-model.json. Vượt mức trần theo giờ hoặc theo ngày → tự bật "Dừng mọi thứ".
 * Tính cả lần chạy diễn tập: tiền trả cho nhà cung cấp là tiền thật.
 */

const fs = require('node:fs');
const path = require('node:path');
const { csdl } = require('../db/ket-noi');
const { LoiNghiepVu } = require('./chung');
const caiDat = require('./cai-dat');

const FILE_GIA = path.join(__dirname, '..', 'cau-hinh', 'gia-model.json');

/**
 * Bảng giá tại một ngày (F-67): giá gốc đè bằng các khối `tu_ngay` đã tới ngày — hãng đổi giá (hết khuyến mãi 1/1/2027) thì mức
 * trần không tính thiếu mà không cần ai nhớ sửa. Đọc lại file mỗi lần: người dùng sửa bảng giá thì có tác dụng ngay.
 */
function bangGia(bayGio = new Date()) {
  const b = JSON.parse(fs.readFileSync(FILE_GIA, 'utf8'));
  const ngay = new Date(bayGio).toISOString().slice(0, 10);
  for (const k of (b.tu_ngay || []).filter((x) => x.tu <= ngay).sort((x, y) => (x.tu < y.tu ? -1 : 1))) {
    for (const nhom of ['model', 'tts', 'tts_ky_tu', 'chep_loi']) Object.assign(b[nhom] || (b[nhom] = {}), k[nhom] || {});
    for (const [m, g] of Object.entries(k.mieng || {})) b.mieng[m] = { ...b.mieng[m], ...g, vao: { ...b.mieng[m]?.vao, ...g.vao }, ra: { ...b.mieng[m]?.ra, ...g.ra } };
  }
  return b;
}

/** USD cho một lần gọi. Model lạ tính theo giá cao nhất để mức trần không bị hụt. */
function tinhChiPhi(model, tokenVao, tokenRa, bayGio = new Date()) {
  const b = bangGia(bayGio);
  const g = b.model[model] || b.mac_dinh;
  return ((tokenVao || 0) * g.vao + (tokenRa || 0) * g.ra) / 1e6;
}

/** USD cho một phiên chép lời người dẫn: theo phút tiếng (OpenAI) hoặc theo token (Gemini; không có số token thì ước theo giây). */
function tinhChiPhiChepLoi(model, giayAm, tokenVao = 0, tokenRa = 0, bayGio = new Date()) {
  const g = (bangGia(bayGio).chep_loi || {})[model];
  if (!g || (!g.usd_moi_phut && g.vao == null)) return tinhChiPhi(model, Math.round(giayAm * 32), tokenRa);
  if (g.usd_moi_phut) return (giayAm / 60) * g.usd_moi_phut;
  const vao = tokenVao || Math.round(giayAm * (g.token_moi_giay || 32));
  return (vao * g.vao + (tokenRa || 0) * g.ra) / 1e6;
}

/**
 * USD cho một đoạn dùng miệng của Mai (F-22): theo phút phiên (GPT Live 1) hoặc theo token từng loại (Gemini Live).
 * @param {{giay?:number, token?:{vao:object, ra:object}}} dung
 */
function tinhChiPhiMieng(model, { giay = 0, token = null } = {}, bayGio = new Date()) {
  const g = (bangGia(bayGio).mieng || {})[model];
  if (!g) return (giay / 60) * 0.05;
  if (g.usd_moi_phut) return (giay / 60) * g.usd_moi_phut;
  let usd = 0;
  for (const chieu of ['vao', 'ra']) {
    for (const [loai, so] of Object.entries(token?.[chieu] || {})) usd += (so / 1e6) * (g[chieu][loai] ?? g[chieu].AUDIO);
  }
  return usd;
}

/** USD cho một lần đọc chữ thành giọng hoặc tạo giọng (Gemini 3.8 TTS, bản 2.5). Model lạ tính theo giá Flash TTS. */
function tinhChiPhiTts(model, tokenVao = 0, tokenRa = 0, bayGio = new Date()) {
  const b = bangGia(bayGio).tts || {};
  const g = b[model] || b['gemini-3.8-flash-tts'] || { vao: 1, ra: 18 };
  return ((tokenVao || 0) * g.vao + (tokenRa || 0) * g.ra) / 1e6;
}

/** USD cho một lần đọc theo số ký tự (ElevenLabs, F-108): bảng tts_ky_tu là USD / 1.000 ký tự; model lạ tính theo giá cao nhất. */
function tinhChiPhiTtsKyTu(model, soKyTu = 0, bayGio = new Date()) {
  const b = bangGia(bayGio).tts_ky_tu || {};
  const gia = typeof b[model] === 'number' ? b[model] : Math.max(0, ...Object.values(b).filter((x) => typeof x === 'number'));
  return ((soKyTu || 0) / 1000) * gia;
}

/**
 * USD cho kết quả của máy đọc (tts.js trả `token`): theo ký tự (ElevenLabs: `ky_tu`), hoặc theo token — máy đọc Realtime có thêm
 * token chữ ra (`ra_chu`, chữ chép lại) giá riêng.
 */
function tinhChiPhiDoc(model, token = {}, bayGio = new Date()) {
  if (token?.ky_tu) return tinhChiPhiTtsKyTu(model, token.ky_tu, bayGio);
  const g = (bangGia(bayGio).tts || {})[model];
  const raChu = token?.ra_chu ? (token.ra_chu * (g?.ra_chu ?? g?.ra ?? 18)) / 1e6 : 0;
  return tinhChiPhiTts(model, token?.vao, token?.ra, bayGio) + raChu;
}

/**
 * Model sắp tắt hoặc đã tắt (F-111): mọi model đang dùng (Agent, miệng của Mai, máy đọc, chép lời) có ô `tat_ngay` trong bảng giá
 * mà còn ≤ 30 ngày (≤ 0 là đã tắt). `dangDung` để test truyền danh sách tự chọn.
 * @returns {{model:string, noi_dung:string, tat_ngay:string, con_ngay:number}[]}
 */
function modelSapTat(bayGio = new Date(), dangDung = null) {
  const b = bangGia(bayGio);
  const tat = {};
  for (const nhom of ['model', 'tts', 'chep_loi', 'mieng']) {
    for (const [m, g] of Object.entries(b[nhom] || {})) if (g?.tat_ngay) tat[m] = g.tat_ngay;
  }
  const ra = [];
  const daCo = new Set();
  for (const { model, noi_dung: noiDung } of dangDung || modelDangDung()) {
    const k = `${model}|${noiDung}`;
    if (!model || !tat[model] || daCo.has(k)) continue;
    daCo.add(k);
    const conNgay = Math.ceil((new Date(`${tat[model]}T00:00:00+07:00`).getTime() - new Date(bayGio).getTime()) / 86400e3);
    if (conNgay <= 30) ra.push({ model, noi_dung: noiDung, tat_ngay: tat[model], con_ngay: conNgay });
  }
  return ra;
}

/** Các model MOZA đang dùng: Agent đang bật (chính, dự phòng), miệng của Mai, máy đọc giọng, chép lời người dẫn. */
function modelDangDung() {
  const ds = [];
  try {
    for (const a of caiDat.danhSachAgent().filter((x) => x.bat)) {
      ds.push({ model: a.model, noi_dung: `Agent "${a.ten || a.id}"` });
      if (a.model_du_phong) ds.push({ model: a.model_du_phong, noi_dung: `Agent "${a.ten || a.id}" (dự phòng)` });
    }
  } catch { /* chưa mở cơ sở dữ liệu */ }
  try { ds.push({ model: caiDat.mieng().model, noi_dung: 'Miệng của Mai' }); } catch { /* chưa mở cơ sở dữ liệu */ }
  const tts = require('../agent/nha-cung-cap/tts');
  ds.push({ model: tts.modelMacDinh(), noi_dung: 'Máy đọc giọng (Đội AI, người dẫn giả)' });
  ds.push({ model: 'gpt-live-transcribe', noi_dung: 'Chép lời người dẫn' }, { model: 'gemini-3.5-transcribe-live', noi_dung: 'Chép lời người dẫn (dự phòng)' });
  return ds;
}

/** Nửa đêm giờ Việt Nam (UTC+7, không đổi giờ theo mùa), viết theo giờ UTC. */
function dauNgayVN(bayGio = new Date()) {
  const vn = new Date(bayGio.getTime() + 7 * 3600e3);
  vn.setUTCHours(0, 0, 0, 0);
  return new Date(vn.getTime() - 7 * 3600e3).toISOString();
}

function tongTu(tuLuc) {
  return csdl().prepare('SELECT COALESCE(SUM(chi_phi_usd), 0) AS usd FROM agent_run WHERE bat_dau >= ?').get(tuLuc).usd;
}

function mucTran() {
  return { ...bangGia().muc_tran_mac_dinh, ...(caiDat.doc('muc_tran') || {}) };
}

function datMucTran(duLieu = {}) {
  const moi = { ...mucTran() };
  for (const k of ['gio', 'ngay', 'ngay_co_live']) {
    if (duLieu[k] === undefined) continue;
    const v = Number(duLieu[k]);
    if (!Number.isFinite(v) || v <= 0 || v > 10000) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Mức trần ${k === 'gio' ? 'theo giờ' : k === 'ngay' ? 'theo ngày' : 'ngày có live'} phải là số USD lớn hơn 0.`);
    }
    moi[k] = Math.round(v * 100) / 100;
  }
  caiDat.ghi('muc_tran', moi);
  return moi;
}

/** Hôm nay (giờ Việt Nam) có buổi live — thật hoặc tập — không: trần ngày dùng mức "ngày có live" (#101). */
function coLiveHomNay(bayGio = new Date()) {
  return !!csdl().prepare("SELECT 1 FROM phien_live WHERE trang_thai = 'dang_live' OR (bat_dau IS NOT NULL AND bat_dau >= ?) LIMIT 1").get(dauNgayVN(bayGio));
}

function tongQuan(bayGio = new Date()) {
  const motGioTruoc = new Date(bayGio.getTime() - 3600e3).toISOString();
  const homNay = dauNgayVN(bayGio);
  const theoAgent = csdl().prepare(`SELECT agent_id, COUNT(*) AS so_lan, COALESCE(SUM(chi_phi_usd), 0) AS usd,
                                      COALESCE(SUM(token_vao), 0) AS token_vao, COALESCE(SUM(token_ra), 0) AS token_ra
                                    FROM agent_run WHERE bat_dau >= ? GROUP BY agent_id`).all(homNay);
  const muc = mucTran();
  const coLive = coLiveHomNay(bayGio);
  return { gio: tongTu(motGioTruoc), ngay: tongTu(homNay), muc_tran: muc, co_live_hom_nay: coLive,
    tran_ngay_ap_dung: coLive ? Math.max(muc.ngay, muc.ngay_co_live ?? muc.ngay) : muc.ngay, theo_agent: theoAgent };
}

/**
 * Mức chi phí cho dải báo (F-72): xanh · vàng (từ 80% trần giờ hoặc trần ngày) · đỏ ("Dừng AI" đang bật).
 * @returns {{muc:'xanh'|'vang'|'do', ty_le:number, gio:number, ngay:number, tran_gio:number, tran_ngay:number, dung_ai:object}}
 */
function mucDo(bayGio = new Date()) {
  const t = tongQuan(bayGio);
  const tyLe = Math.max(t.gio / t.muc_tran.gio, t.ngay / t.tran_ngay_ap_dung);
  const dung = caiDat.dungAi();
  return { muc: dung.bat ? 'do' : tyLe >= 0.8 ? 'vang' : 'xanh', ty_le: Math.round(tyLe * 100) / 100, gio: t.gio, ngay: t.ngay,
    tran_gio: t.muc_tran.gio, tran_ngay: t.tran_ngay_ap_dung, co_live_hom_nay: t.co_live_hom_nay, dung_ai: dung };
}

/**
 * Gọi sau mỗi lần AI chạy. Vượt mức trần → bật "Dừng AI" (không phải "Dừng mọi thứ" — F-72, #101): AI tạm dừng, chốt đơn bằng
 * mã vẫn chạy. Trả về thông điệp để nơi gọi báo lên giao diện. Đang bật rồi thì thôi.
 */
function kiemMucTran(bayGio = new Date()) {
  const t = tongQuan(bayGio);
  const vuot = t.gio > t.muc_tran.gio ? ['giờ', t.gio, t.muc_tran.gio] : t.ngay > t.tran_ngay_ap_dung ? ['ngày', t.ngay, t.tran_ngay_ap_dung] : null;
  if (!vuot || caiDat.dungAi().bat) return null;
  const thongDiep = `Chi phí AI trong ${vuot[0] === 'giờ' ? '1 giờ qua' : 'hôm nay'} là ${vuot[1].toFixed(2)} USD, vượt mức trần `
    + `${vuot[2]} USD/${vuot[0]}. AI tạm dừng vì chạm trần — chốt đơn vẫn chạy (giữ hàng, thẻ giữ hàng, nút bấm). `
    + 'Nâng mức trần rồi bấm "Chạy AI tiếp" để AI chạy lại.';
  caiDat.datDungAi(true, { ma: 'VUOT_MUC_TRAN', thong_diep: thongDiep, loai: vuot[0] });
  return thongDiep;
}

let mucCuoi = null;

/** Báo lên giao diện: vượt trần → 'dung_ai'; mức đổi (xanh / vàng / đỏ) → 'chi_phi.muc'. Một hàm cho mọi nơi gọi AI tốn tiền. */
function baoVuotTran(phat, canhBao = null) {
  if (canhBao) phat('dung_ai', { bat: true, ly_do: { ma: 'VUOT_MUC_TRAN', thong_diep: canhBao } });
  try {
    const m = mucDo();
    if (m.muc !== mucCuoi) { mucCuoi = m.muc; phat('chi_phi.muc', m); }
  } catch { /* cơ sở dữ liệu đã đóng */ }
}

/**
 * Tự tắt "Dừng AI" (F-72): khi hết lý do (sang ngày mới với trần ngày; chi phí 60 phút qua dưới 80% trần giờ) VÀ không có buổi
 * live đang chạy — giữa live không tự bật lại giọng cho người dẫn khỏi bất ngờ. Chỉ tắt lần bật do vượt trần.
 * @returns {boolean} đã tắt
 */
function tuTatDungAi(bayGio = new Date()) {
  const d = caiDat.dungAi();
  if (!d.bat || d.ly_do?.ma !== 'VUOT_MUC_TRAN') return false;
  if (csdl().prepare("SELECT 1 FROM phien_live WHERE trang_thai = 'dang_live' LIMIT 1").get()) return false;
  const t = tongQuan(bayGio);
  if (t.gio >= t.muc_tran.gio * 0.8 || t.ngay > t.tran_ngay_ap_dung) return false;
  caiDat.datDungAi(false);
  return true;
}

module.exports = { bangGia, tinhChiPhi, tinhChiPhiChepLoi, tinhChiPhiMieng, tinhChiPhiTts, tinhChiPhiTtsKyTu, tinhChiPhiDoc, modelSapTat, modelDangDung, dauNgayVN, tongQuan, mucTran, datMucTran, kiemMucTran,
  mucDo, baoVuotTran, tuTatDungAi, coLiveHomNay };
