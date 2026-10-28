'use strict';

/**
 * Đội AI dẫn (SPEC.md bản 2.9, #49 → #53, F-44, F-45): dàn nhân vật và cách đọc lời nhắc dạng thoại.
 *
 *  - Nhân vật: tên, giọng, nét riêng (một dòng). Nên dùng giọng Bắc tả bằng lời (`voice_…`): Bước 0 ngày 24/9/2026,
 *    giọng kho tiếng Việt (`vi-vn-…`) nghe ra giọng miền Nam kể cả khi dặn "giọng Bắc" (#50). Giọng kho vẫn chọn được
 *    (đọc hội thoại 2 giọng một lần gọi, chen lời tự nhiên hơn). Nhân vật đầu là trợ lý AI chính, tên lấy từ ô Tên AI
 *    của Cài đặt. Vai (ai hỏi, ai đáp) không đặt ở đây — do kịch bản quyết (#49).
 *  - Lời nhắc của một đoạn (vẫn một ô chữ, #31): "Tên: (cách nói) lời" cho mỗi lượt nói; "[Tiết mục]" (không đọc);
 *    "[Chờ bình luận N giây]" và "Đáp án: a; b" cho đố vui (F-48); "- Kiểm lại: …" và "Người dẫn: …" không đọc.
 *  - Radio {ten_shop} (#54, #74, F-49, F-50): dòng "[Bài hát]" là chỗ phát bài hát trong đoạn "Lời nhắn
 *    gửi"; bài hát (Lyria) lưu thông tin ở đây, tệp nằm ở data/doi-ai/bai-hat/.
 */

const caiDat = require('./cai-dat');
const { LoiNghiepVu, boDau, chuan } = require('./chung');
const { tachCachNoi } = require('./kich-ban');

const KHOA = 'doi_ai';
const TOI_THIEU = 2;
const TOI_DA = 6;
// Mặc định chọn ở Bước 0 (24/9/2026): cả ba giọng Bắc — Gemini nghe phân loại, đo cao độ (SPEC.md mục 6).
const MAC_DINH = [
  { ten: null, giong: 'vi-vn-advisor-6', gioi: 'nu', net: 'MC chính, tươi tắn, nói số liệu chuẩn' },
  { ten: 'Tùng', giong: 'vi-vn-advisor-5', gioi: 'nam', net: 'vui tính, hay trêu, hỏi thay người đi làm' },
  { ten: 'Hạnh', giong: 'vi-vn-csagent-6', gioi: 'nu', net: 'chững chạc, ấm áp, hay giải đáp nỗi lo' },
];
// Chữ đầu dòng đã có nghĩa khác trong lời nhắc: không được làm tên nhân vật.
const TEN_CAM = ['nguoi dan', 'kiem lai', 'dap an'];

/** Tên trợ lý AI chính: phần trước dấu " - " của Tên AI trong Cài đặt ("Mai - Trợ lý bán hàng" → "Mai"). */
function tenChinh() {
  return (caiDat.tenAi().split(' - ')[0] || 'Mai').trim() || 'Mai';
}

/** Dàn nhân vật đang dùng (nhân vật đầu mang tên AI chính). */
function nhanVat() {
  const luu = caiDat.doc(KHOA, null)?.nhan_vat;
  const ds = Array.isArray(luu) && luu.length >= TOI_THIEU ? luu : MAC_DINH;
  return ds.map((n, i) => ({ ten: i === 0 ? tenChinh() : n.ten, giong: n.giong, gioi: n.gioi || null, net: n.net || '', giong_eleven: n.giong_eleven || null }));
}

function tenNhanVat() {
  return nhanVat().map((n) => n.ten);
}

const khoaTen = (s) => boDau(String(s ?? '')).replace(/\s+/g, ' ').trim();

/**
 * Lưu dàn nhân vật (F-44). Nhân vật đầu: bỏ qua tên gửi lên (lấy Tên AI).
 * @param {{ten:string, giong:string, gioi?:string, net?:string}[]} ds
 */
function luuNhanVat(ds) {
  if (!Array.isArray(ds) || ds.length < TOI_THIEU || ds.length > TOI_DA) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Đội AI cần từ ${TOI_THIEU} tới ${TOI_DA} nhân vật.`);
  }
  const daCo = new Set();
  const sach = ds.map((n, i) => {
    const ten = i === 0 ? tenChinh() : chuan(String(n?.ten ?? '')).replace(/\s+/g, ' ').trim();
    if (i > 0) {
      if (!/^[\p{L}]+(?: [\p{L}]+)?$/u.test(ten) || ten.length > 20) {
        throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Tên nhân vật "${ten || '(trống)'}" chỉ gồm chữ cái, một hoặc hai chữ.`);
      }
      if (TEN_CAM.some((x) => khoaTen(ten) === x || khoaTen(ten).startsWith(`${x} `))) {
        throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không đặt tên nhân vật là "${ten}" — chữ này đã dùng trong lời nhắc.`);
      }
    }
    if (daCo.has(khoaTen(ten))) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Có hai nhân vật cùng tên "${ten}".`);
    daCo.add(khoaTen(ten));
    const giong = String(n?.giong ?? '').trim();
    if (!giong) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Chưa chọn giọng cho ${ten}.`);
    if (!/^(voice(key)?_[\w-]{3,}|vi-vn-[\w-]+|[A-Z][a-z]+)$/.test(giong)) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Giọng "${giong}" của ${ten} không đúng dạng giọng của Google.`);
    }
    const gioi = ['nam', 'nu'].includes(n?.gioi) ? n.gioi : null;
    const net = chuan(String(n?.net ?? '')).replace(/\s+/g, ' ').trim().slice(0, 120);
    const ge = String(n?.giong_eleven ?? '').trim();
    return { ten: i === 0 ? null : ten, giong, gioi, net, giong_eleven: LA_GIONG_ELEVEN.test(ge) ? ge : null };
  });
  caiDat.ghi(KHOA, { ...(caiDat.doc(KHOA, {}) || {}), nhan_vat: sach });
  return nhanVat();
}

/* ---------------- giọng ElevenLabs (BH10, F-108) ---------------- */

const LA_GIONG_ELEVEN = /^[A-Za-z0-9]{10,40}$/;

/** Gán giọng ElevenLabs cho nhân vật thứ `i` (0 = Mai: lưu cả vào giọng của Mai `mieng.giong.elevenlabs`). */
function datGiongEleven(i, voiceId) {
  const ds = nhanVat();
  if (!Number.isInteger(i) || i < 0 || i >= ds.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Không có nhân vật này trong đội AI.');
  if (!LA_GIONG_ELEVEN.test(String(voiceId || ''))) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Mã giọng ElevenLabs không đúng dạng.');
  ds[i].giong_eleven = voiceId;
  const kq = luuNhanVat(ds);
  if (i === 0) caiDat.datGiongElevenMai(voiceId);
  return kq;
}

/* ---------------- giọng Bắc tả bằng lời (#50) ---------------- */

const laGiongTuTao = (g) => /^voice(key)?_/i.test(String(g || ''));

/** Nhân vật nào còn dùng giọng kho (Bước 0 ngày 24/9/2026: giọng kho tiếng Việt nghe ra giọng miền Nam). */
function canGiongBac() {
  return nhanVat().filter((n) => !laGiongTuTao(n.giong)).map((n) => n.ten);
}

/**
 * Câu tả giọng gửi Google (1–2 câu, chỉ nét cố định của giọng — Google khuyên vậy). Nói rõ trầm / trong cho nam nữ
 * nghe khác hẳn nhau: giọng nam tả chung chung ra 151 Hz, máy nghe lại tưởng giọng nữ (thử 24/9/2026).
 */
function cauTaGiong(n, i) {
  const nam = n.gioi === 'nam';
  const tuoi = i === 0 ? 25 : nam ? 30 : 38;
  const net = n.net || (i === 0 ? 'tươi tắn, sôi nổi, rõ ràng' : 'vui vẻ, rõ ràng');
  return `${nam ? 'Một người đàn ông' : 'Một người phụ nữ'} khoảng ${tuoi} tuổi, ${nam ? 'giọng nam trầm, ấm' : 'giọng nữ trong, sáng'}, `
    + `giọng miền Bắc chuẩn Hà Nội, ${net}, nói rõ ràng, có hồn như MC dẫn livestream.`;
}

/**
 * Tạo giọng Bắc cho các nhân vật còn dùng giọng kho (#50): Google tạo giọng theo câu tả (khoảng 30 giây, cùng lúc).
 * Nhân vật chính dùng luôn giọng riêng của Mai (F-38) nếu đã có. Giọng tạo ra lưu vào danh sách giọng của Mai
 * (Cài đặt → Giọng riêng của Mai) để xem, nghe, xóa như giọng khác; Google giữ 1 năm.
 * Nhân vật nào tạo xong thì lưu ngay dù nhân vật khác lỗi (bấm lại chỉ tạo phần còn thiếu, không tạo trùng).
 * @returns {Promise<{nhanVat:object[], taoMoi:number, usd:number, canhBao:string|null}>}
 */
async function taoGiongBac() {
  const giongMai = require('./giong-mai');
  const tts = require('../agent/nha-cung-cap/tts');
  const chiPhi = require('./chi-phi');
  const nhatKy = require('./nhat-ky');
  if (caiDat.khanCap()) throw new LoiNghiepVu('KHAN_CAP_DANG_BAT', '"Dừng mọi thứ" đang bật: chưa tạo giọng được.', 409);
  const ds = nhanVat();
  let usd = 0;
  let canhBao = null;
  let taoMoi = 0;
  const loi = [];
  const giongMaiDangDung = giongMai.dangDung().id;
  await Promise.all(ds.map(async (n, i) => {
    if (laGiongTuTao(n.giong)) return;
    if (i === 0 && laGiongTuTao(giongMaiDangDung)) {
      n.giong = giongMaiDangDung;
      return;
    }
    const moTa = cauTaGiong(n, i);
    const ten = `Đội AI · ${n.ten} · giọng Bắc`;
    let kq;
    try {
      kq = await tts.taoGiongTa({ ten, gioi: n.gioi === 'nam' ? 'male' : 'female', moTa });
    } catch (e) {
      loi.push(`${n.ten} (${e.message})`);
      return;
    }
    const tien = chiPhi.tinhChiPhiTts(kq.model, kq.token.vao, kq.token.ra);
    const runId = nhatKy.taoRun({ agentId: 'doi_ai', kichHoat: `Tạo giọng Bắc cho ${n.ten}` });
    nhatKy.xongRun(runId, { nha: 'gemini', model: kq.model, tokenVao: kq.token.vao, tokenRa: kq.token.ra, chiPhi: tien });
    usd += tien;
    canhBao = canhBao || chiPhi.kiemMucTran();
    giongMai.them({ id: kq.id, ten, loai: 'ta', moTa, gioi: n.gioi, hetHan: kq.hetHan });
    n.giong = kq.id;
    taoMoi += 1;
  }));
  const daLuu = luuNhanVat(ds);
  if (loi.length) throw new LoiNghiepVu('AI_LOI', `Google chưa tạo được giọng cho ${loi.join('; ')}. Các nhân vật khác đã lưu; bấm lại để thử tiếp.`, 502);
  return { nhanVat: daLuu, taoMoi, usd, canhBao };
}

/* ---------------- nhạc (F-47): chỉ giữ thông tin, tệp nằm ở data/doi-ai/nhac/ ---------------- */

function nhac() {
  return caiDat.doc(KHOA, {})?.nhac || {};
}

function luuNhac(loai, thongTin) {
  const cu = caiDat.doc(KHOA, {}) || {};
  const moi = { ...(cu.nhac || {}) };
  if (thongTin) moi[loai] = thongTin;
  else delete moi[loai];
  caiDat.ghi(KHOA, { ...cu, nhac: moi });
  return moi;
}

/* ---------------- bài hát Radio (F-50): chỉ giữ thông tin, tệp nằm ở data/doi-ai/bai-hat/ ---------------- */

const BAI_HAT_TOI_DA = 8;

/** Các bài hát đã làm: [{ id, ten, kieu, giay, loi_bai, luc }]. */
function baiHat() {
  const ds = caiDat.doc(KHOA, {})?.bai_hat;
  return Array.isArray(ds) ? ds : [];
}

/** Thêm hoặc thay (cùng id) một bài; `null` để xóa bài có id đó. */
function luuBaiHat(id, thongTin) {
  const cu = caiDat.doc(KHOA, {}) || {};
  const ds = baiHat().filter((b) => b.id !== id);
  if (thongTin) {
    const i = baiHat().findIndex((b) => b.id === id);
    ds.splice(i < 0 ? ds.length : i, 0, { id, ...thongTin });
  }
  caiDat.ghi(KHOA, { ...cu, bai_hat: ds });
  return ds;
}

/* ---------------- lời nhắc dạng thoại ---------------- */

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Đọc lời nhắc của một đoạn thành các lượt nói.
 * @param {string} loiNhac
 * @param {string[]} ten   tên các nhân vật (so không phân biệt hoa thường)
 * @returns {{tietMuc:string, luot:{ai:string, cachNoi:string, loi:string}[], nguoiDan:string[], luuY:string[],
 *   dapAn:string[], cho:{sau:number, giay:number}|null, baiHat:{sau:number}|null}}
 */
function tachThoai(loiNhac = '', ten = tenNhanVat()) {
  const kq = { tietMuc: '', luot: [], nguoiDan: [], luuY: [], dapAn: [], cho: null, baiHat: null };
  const ds = [...ten].filter(Boolean).sort((a, b) => b.length - a.length); // tên dài trước: "Mai Anh" trước "Mai"
  const reTen = ds.length ? new RegExp(`^(${ds.map((t) => esc(chuan(t))).join('|')})\\s*:\\s*(.*)$`, 'iu') : null;
  let dang = null;
  for (const goc of chuan(String(loiNhac ?? '')).split('\n')) {
    const dong = goc.trim();
    if (!dong) continue;
    let m = /^\[\s*chờ\s+bình\s+luận\s*(\d{1,3})?\s*(?:giây|s)?\s*\]$/iu.exec(dong);
    if (m) {
      kq.cho = { sau: kq.luot.length, giay: Math.min(60, Math.max(5, Number(m[1] || 20))) };
      dang = null;
      continue;
    }
    // Radio (F-50): chỗ phát bài hát; đố vui đã có chỗ chờ thì không có bài hát trong cùng đoạn.
    if (/^\[\s*bài\s+hát\s*\]$/iu.test(dong)) {
      if (!kq.cho && !kq.baiHat) kq.baiHat = { sau: kq.luot.length };
      dang = null;
      continue;
    }
    m = /^\[([^\]]{1,60})\]$/u.exec(dong);
    if (m) {
      if (!kq.tietMuc) kq.tietMuc = m[1].trim();
      dang = null;
      continue;
    }
    m = /^đáp\s*án\s*:\s*(.+)$/iu.exec(dong);
    if (m) {
      kq.dapAn.push(...m[1].split(/[;|]/).map((x) => x.trim()).filter(Boolean));
      dang = null;
      continue;
    }
    if (/^-?\s*kiểm\s*lại/iu.test(dong)) {
      kq.luuY.push(dong.replace(/^-\s*/, ''));
      dang = null;
      continue;
    }
    m = /^(?:người dẫn|nguoi dan)\s*:\s*(.*)$/iu.exec(dong);
    if (m) {
      if (m[1].trim()) kq.nguoiDan.push(m[1].trim());
      dang = 'nguoi_dan';
      continue;
    }
    m = reTen?.exec(dong);
    if (m) {
      const ai = ds.find((t) => chuan(t).toLowerCase() === m[1].toLowerCase()) || m[1];
      const { cachNoi, loi } = tachCachNoi(m[2]);
      kq.luot.push({ ai, cachNoi, loi });
      dang = 'luot';
      continue;
    }
    // Dòng tiếp theo không có nhãn: nối vào lượt đang nói, hoặc là ý của người dẫn.
    if (dang === 'luot') kq.luot.at(-1).loi = `${kq.luot.at(-1).loi} ${dong}`.trim();
    else kq.nguoiDan.push(dong.replace(/^-\s*/, ''));
  }
  // Lượt chỉ có gợi ý, không có lời thì không đọc; "chờ" giữ đúng vị trí sau khi bỏ lượt trống.
  const coLoi = kq.luot.map((l) => !!l.loi);
  if (kq.cho) kq.cho.sau = coLoi.slice(0, kq.cho.sau).filter(Boolean).length;
  if (kq.baiHat) kq.baiHat.sau = coLoi.slice(0, kq.baiHat.sau).filter(Boolean).length;
  kq.luot = kq.luot.filter((l) => l.loi);
  return kq;
}

/** Lượt trước và sau chỗ chia đoạn (chờ đáp án đố vui, hay bài hát Radio). */
function chiaHaiPhan(t) {
  const sau = (t.cho || t.baiHat)?.sau;
  return sau === undefined ? [t.luot, []] : [t.luot.slice(0, sau), t.luot.slice(sau)];
}

// Tiết mục chỉ kịch bản Radio có (F-49, #74): kịch bản có một trong các tiết mục này (hoặc "Alo <tên shop>"), hoặc có
// "[Bài hát]", là kịch bản Radio.
const TIET_MUC_RADIO = ['Điểm tin hàng mới', 'Lời nhắn gửi'];

/** Kịch bản Radio {ten_shop} (#74): báo giờ, nhạc hiệu Radio, bài hát. */
function laKichBanRadio(kb, ten = tenNhanVat()) {
  const radio = new Set(TIET_MUC_RADIO.map((x) => boDau(x)));
  return (kb?.doan || []).some((d) => {
    const t = tachThoai(d.loi_nhac, ten);
    return !!t.baiHat || radio.has(boDau(t.tietMuc)) || /^alo /.test(boDau(t.tietMuc));
  });
}

/** Đoạn có thoại của đội AI (ít nhất một lượt của nhân vật không phải nhân vật chính, hoặc hai nhân vật). */
function laThoaiDoi(loiNhac, ten = tenNhanVat()) {
  const { luot } = tachThoai(loiNhac, ten);
  const ai = new Set(luot.map((l) => l.ai));
  return ai.size >= 2 || [...ai].some((x) => x !== ten[0]);
}

/** Kịch bản của Đội AI dẫn: đa số đoạn là thoại của đội. */
function laKichBanDoi(kb, ten = tenNhanVat()) {
  const ds = kb?.doan || [];
  if (!ds.length) return false;
  return ds.filter((d) => laThoaiDoi(d.loi_nhac, ten)).length * 2 >= ds.length;
}

module.exports = {
  nhanVat, tenNhanVat, tenChinh, luuNhanVat, nhac, luuNhac, tachThoai, laThoaiDoi, laKichBanDoi, MAC_DINH, TOI_THIEU, TOI_DA,
  taoGiongBac, canGiongBac, cauTaGiong, laGiongTuTao, chiaHaiPhan, laKichBanRadio, TIET_MUC_RADIO, baiHat, luuBaiHat, BAI_HAT_TOI_DA, datGiongEleven, LA_GIONG_ELEVEN };
