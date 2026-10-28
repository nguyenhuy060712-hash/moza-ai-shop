'use strict';

/**
 * Giọng riêng của Mai (SPEC.md bản 2.5, #41, F-38): các giọng đã lưu, giọng đang dùng, tạo giọng theo lựa chọn,
 * nhân bản giọng người thật, lấy giọng từ kho của Google, đọc thử.
 *
 * Gọi Google qua agent/nha-cung-cap/tts.js. Mỗi lần gọi có tính tiền (tạo giọng, đọc) ghi một lần chạy vào nhật ký
 * để tính vào mức trần — tiền trả cho Google là tiền thật.
 * Bản nghe thử lưu thành tệp data/giong/mai-<id>.wav (bản tạo giọng Google trả kèm; giọng kho thì đọc câu mẫu một lần).
 */

const fs = require('node:fs');
const path = require('node:path');
const { csdl, thuMucDuLieu } = require('../db/ket-noi');
const { LoiNghiepVu, gio } = require('./chung');
const caiDat = require('./cai-dat');
const chiPhi = require('./chi-phi');
const nhatKy = require('./nhat-ky');
const tts = require('../agent/nha-cung-cap/tts');

const FILE_LUA_CHON = path.join(__dirname, '..', 'cau-hinh', 'lua-chon-giong.json');

// Câu đồng ý Google bắt chính người được nhân bản đọc nguyên văn (bản tiếng Việt, tài liệu Voice replication 24/9/2026).
const CAU_DONG_Y = 'Tôi là chủ sở hữu giọng nói này và tôi đồng ý cho Google sử dụng giọng nói này để tạo mô hình giọng nói tổng hợp.';

// Đoạn đọc mẫu để nhân bản: Google cần 10–30 giây tiếng nói tự nhiên; đọc thong thả đoạn này khoảng 20–25 giây.
const DOAN_MAU = 'Chào cả nhà, em là nhân viên bán hàng của shop. Hôm nay bên em về mẫu sơ mi linen tay ngắn, vải mát, '
  + 'thấm hút tốt, form suông dễ mặc, có ba màu đen, trắng và be, đủ size từ S tới XL. Giá hai trăm tám mươi chín nghìn đồng. '
  + 'Cả nhà ưng mẫu nào thì bình luận chốt kèm màu và size, em nhắn tin xác nhận đơn liền nha.';

// Câu đọc thử theo đúng kiểu nói livestream bán hàng.
const CAU_THU = 'Dạ em chào cả nhà, em là Mai, trợ lý bán hàng của shop. Áo số mười hai hôm nay có ba màu đen, trắng, be, '
  + 'ai ưng thì bình luận chốt mười hai kèm màu và size nha.';

const MODEL_LUA_CHON = [
  { model: 'gemini-3.8-flash-lite-tts', ten: 'Flash-Lite — nhanh, rẻ' },
  { model: 'gemini-3.8-flash-tts', ten: 'Flash — hay nhất' },
];

// Google cần đoạn mẫu 10–30 giây; câu đồng ý đọc chậm cũng chỉ khoảng 10 giây.
const GIAY_MAU = [10, 31];
const GIAY_DONG_Y = [3, 25];

/* ---------------- lựa chọn, câu tả ---------------- */

// Đọc lại file mỗi lần: người dùng sửa danh sách lựa chọn thì có tác dụng ngay, không cần khởi động lại.
function docLuaChon() {
  return JSON.parse(fs.readFileSync(FILE_LUA_CHON, 'utf8'));
}

function luaChon() {
  const L = docLuaChon();
  return {
    gioi_tinh: L.gioi_tinh.map(({ id, ten }) => ({ id, ten })),
    tuoi: L.tuoi.map(({ id, ten }) => ({ id, ten })),
    vung: L.vung.map(({ id, ten }) => ({ id, ten })),
    chat_giong: L.chat_giong.map(({ id, ten }) => ({ id, ten })),
    mac_dinh: L.mac_dinh,
    model: MODEL_LUA_CHON,
    cau_dong_y: CAU_DONG_Y,
    doan_mau: DOAN_MAU,
    giay_mau: GIAY_MAU,
  };
}

/**
 * Ghép câu tả gửi Google từ các lựa chọn (Google khuyên 1–2 câu, chỉ nét cố định của giọng).
 * Lựa chọn lạ hoặc thiếu thì lấy giá trị mặc định trong file cấu hình.
 */
function taoCauTa(chon = {}, moTaThem = '') {
  const L = docLuaChon();
  const lay = (nhom) => L[nhom].find((x) => x.id === chon[nhom]) || L[nhom].find((x) => x.id === L.mac_dinh?.[nhom]) || L[nhom][0];
  const g = lay('gioi_tinh');
  const t = lay('tuoi');
  const v = lay('vung');
  const c = lay('chat_giong');
  const them = String(moTaThem ?? '').replace(/\s+/g, ' ').trim().slice(0, 300).replace(/[.\s]+$/, '');
  const cau = `${g.ta} ${t.ta}, ${v.ta}, chất giọng ${c.ta}.`;
  return {
    cau: them ? `${cau} ${them}.` : cau,
    gioi: g.gioi,
    gioiNgan: g.id === 'nam' ? 'nam' : 'nu',
    ten: [g.ten, t.ten, v.ten, c.ten].join(' · '),
    chon: { gioi_tinh: g.id, tuoi: t.id, vung: v.id, chat_giong: c.id },
  };
}

/* ---------------- lưu trữ ---------------- */

function dong(r) {
  if (!r) return null;
  return { ...r, lua_chon: JSON.parse(r.lua_chon || '{}'), co_mau: fs.existsSync(tepMau(r.id)) };
}

function layMot(id) {
  return dong(csdl().prepare('SELECT * FROM giong_mai WHERE id = ?').get(String(id)));
}

function canMot(id) {
  const g = layMot(id);
  if (!g) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có giọng này trong danh sách giọng của Mai.', 404);
  return g;
}

function them({ id, ten, loai, moTa = '', luaChon: chon = {}, gioi = null, hetHan = null }) {
  csdl().prepare(`INSERT INTO giong_mai (id, ten, loai, mo_ta, lua_chon, gioi, tao_luc, het_han) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET ten = excluded.ten, mo_ta = excluded.mo_ta, gioi = excluded.gioi`)
    .run(String(id), String(ten).slice(0, 120), loai, String(moTa).slice(0, 1000), JSON.stringify(chon), gioi, gio(), hetHan);
}

/** Giọng Mai đang dùng và model đọc (Cài đặt). Chưa chọn giọng thì id = null. */
function dangDung() {
  const g = caiDat.doc('giong_mai', {}) || {};
  return { id: g.id || null, model: tts.MODEL_DOC.includes(g.model) ? g.model : tts.MAC_DINH };
}

function datDangDung({ id, model } = {}) {
  const hienTai = dangDung();
  const moi = { id: id === undefined ? hienTai.id : id, model: model === undefined ? hienTai.model : model };
  if (moi.id !== null) canMot(moi.id);
  if (!tts.MODEL_DOC.includes(moi.model)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Model đọc không hợp lệ.');
  caiDat.ghi('giong_mai', moi);
  return dangDung();
}

function danhSach() {
  const ds = csdl().prepare('SELECT * FROM giong_mai ORDER BY tao_luc DESC').all().map(dong);
  return { giong: ds, dang_dung: dangDung() };
}

/* ---------------- tệp nghe thử ---------------- */

function tepMau(id) {
  return path.join(thuMucDuLieu() || path.join(__dirname, '..', '..', 'data'), 'giong', `mai-${String(id).replace(/[^\w.-]/g, '')}.wav`);
}

function luuMau(id, wav) {
  if (!wav?.length) return;
  try {
    fs.mkdirSync(path.dirname(tepMau(id)), { recursive: true });
    fs.writeFileSync(tepMau(id), wav);
  } catch { /* không lưu được thì lần sau đọc lại, chỉ tốn thêm chút tiền */ }
}

/* ---------------- chi phí ---------------- */

function ghiChiPhi({ viec, model, token, dienTap = false }) {
  const usd = chiPhi.tinhChiPhiDoc(model, token);
  const runId = nhatKy.taoRun({ agentId: 'giong_mai', kichHoat: viec, dienTap });
  nhatKy.xongRun(runId, { nha: tts.nhaCuaModel(model), model, tokenVao: token?.vao || 0, tokenRa: token?.ra || 0, chiPhi: usd });
  return { runId, usd, canhBao: chiPhi.kiemMucTran() };
}

/** Lỗi của Google → lỗi nghiệp vụ có mã GIONG_LOI, câu dễ hiểu. */
function loiGiong(e) {
  if (e instanceof LoiNghiepVu) return e;
  return new LoiNghiepVu('GIONG_LOI', e.message || 'Google không làm được việc này.', e.ma === 'CHUA_CO_KHOA' ? 400 : 502);
}

/* ---------------- tạo giọng ---------------- */

/** Tạo giọng theo các lựa chọn (tả bằng lời). Giọng đầu tiên tạo ra thì dùng luôn làm giọng Mai. */
async function taoTheoLuaChon({ luaChon: chon = {}, moTaThem = '', ten = '' } = {}) {
  const ta = taoCauTa(chon, moTaThem);
  const tenGiong = String(ten ?? '').trim().slice(0, 80) || `Mai · ${ta.ten}`;
  let kq;
  try {
    kq = await tts.taoGiongTa({ ten: tenGiong, gioi: ta.gioi, moTa: ta.cau });
  } catch (e) {
    throw loiGiong(e);
  }
  const cp = ghiChiPhi({ viec: `Tạo giọng Mai theo lựa chọn: ${ta.ten}`, model: kq.model, token: kq.token });
  them({ id: kq.id, ten: tenGiong, loai: 'ta', moTa: ta.cau, luaChon: ta.chon, gioi: ta.gioiNgan, hetHan: kq.hetHan });
  luuMau(kq.id, kq.mau);
  if (!dangDung().id) datDangDung({ id: kq.id });
  return { giong: layMot(kq.id), chi_phi_usd: cp.usd, canh_bao: cp.canhBao };
}

/** Đọc tệp WAV trình duyệt gửi lên (base64), kiểm độ dài theo giây. */
function docWavGuiLen(base64, ten, [itNhat, nhieuNhat]) {
  let buf;
  try {
    buf = Buffer.from(String(base64 ?? ''), 'base64');
  } catch {
    buf = Buffer.alloc(0);
  }
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Chưa có ${ten}. Bấm Ghi âm, đọc xong bấm Dừng.`);
  }
  const giay = tts.soGiay(buf);
  if (giay < itNhat) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten[0].toUpperCase()}${ten.slice(1)} ngắn quá (${giay.toFixed(1)} giây). Cần ít nhất ${itNhat} giây.`);
  if (giay > nhieuNhat) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten[0].toUpperCase()}${ten.slice(1)} dài quá (${giay.toFixed(1)} giây). Tối đa ${nhieuNhat - 1} giây.`);
  return buf;
}

/**
 * Nhân bản giọng người thật (#41). Google so khớp người đọc đoạn mẫu với người đọc câu đồng ý rồi mới tạo giọng.
 * Không lưu hai đoạn ghi âm: gửi đi xong là thôi.
 */
async function nhanBan({ ten, amMau, amDongY } = {}) {
  const tenNguoi = String(ten ?? '').trim().slice(0, 80);
  if (!tenNguoi) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Ghi tên người được nhân bản giọng.');
  const mau = docWavGuiLen(amMau, 'đoạn mẫu', GIAY_MAU);
  const dongY = docWavGuiLen(amDongY, 'câu đồng ý', GIAY_DONG_Y);
  let kq;
  try {
    kq = await tts.nhanBanGiong({ ten: `Mai · giọng ${tenNguoi}`, amMau: mau, amDongY: dongY });
  } catch (e) {
    throw loiGiong(e);
  }
  const cp = ghiChiPhi({ viec: `Nhân bản giọng: ${tenNguoi}`, model: kq.model, token: kq.token });
  them({ id: kq.id, ten: `Giọng ${tenNguoi}`, loai: 'nhan_ban', moTa: `Nhân bản từ giọng ${tenNguoi} (có câu đồng ý)`, hetHan: kq.hetHan });
  luuMau(kq.id, kq.mau);
  if (!dangDung().id) datDangDung({ id: kq.id });
  return { giong: layMot(kq.id), chi_phi_usd: cp.usd, canh_bao: cp.canhBao };
}

/* ---------------- kho giọng ---------------- */

async function giongKho(q = {}) {
  try {
    const kq = await tts.dsGiongKho(q);
    const daLuu = new Set(csdl().prepare('SELECT id FROM giong_mai').all().map((r) => r.id));
    return { giong: kq.giong.map((g) => ({ ...g, da_luu: daLuu.has(g.id) })), trang_sau: kq.trangSau };
  } catch (e) {
    throw loiGiong(e);
  }
}

/** Lưu một giọng kho vào danh sách giọng của Mai (không tốn tiền; nghe thử lần đầu mới đọc). */
function luuTuKho({ id, ten = '', mo_ta: moTa = '', gioi = null } = {}) {
  const ma = String(id ?? '').trim();
  if (!/^[\w.-]{2,80}$/.test(ma)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Mã giọng không hợp lệ.');
  them({ id: ma, ten: String(ten || ma), loai: 'kho', moTa, gioi: gioi === 'nu' || gioi === 'nam' ? gioi : null });
  if (!dangDung().id) datDangDung({ id: ma });
  return layMot(ma);
}

/* ---------------- đọc ---------------- */

/**
 * Đọc chữ bằng một giọng (mặc định giọng Mai đang dùng). Dùng cho "Mai đọc thử", và về sau cho tin thoại,
 * miệng giọng riêng (F-40, F-42).
 */
async function doc({ chu, id = null, model = null, phongCach = null, viec = 'Mai đọc thử', dienTap = false } = {}) {
  const c = String(chu ?? '').trim();
  if (!c) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Gõ câu cần đọc.');
  if (c.length > 2000) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Câu dài quá (tối đa 2.000 ký tự).');
  const dd = dangDung();
  const giong = id || dd.id;
  if (!giong) throw new LoiNghiepVu('GIONG_LOI', 'Chưa chọn giọng cho Mai. Tạo hoặc chọn một giọng trước.', 409);
  let kq;
  try {
    kq = await tts.docChu({ chu: c, giong, model: model || dd.model, phongCach });
  } catch (e) {
    throw loiGiong(e);
  }
  const cp = ghiChiPhi({ viec, model: kq.model, token: kq.token, dienTap });
  return { wav: kq.wav, giay: kq.giay, chi_phi_usd: cp.usd, canh_bao: cp.canhBao };
}

/** Bản nghe thử của một giọng đã lưu: có sẵn thì lấy ra, chưa có thì đọc câu mẫu một lần rồi lưu lại. */
async function ngheMau(id) {
  const g = canMot(id);
  try {
    const cu = fs.readFileSync(tepMau(g.id));
    if (cu.length > 1000) return { wav: cu, san_co: true };
  } catch { /* chưa có thì đọc */ }
  const kq = await doc({ chu: CAU_THU, id: g.id, viec: `Nghe thử giọng: ${g.ten}` });
  luuMau(g.id, kq.wav);
  return kq;
}

/* ---------------- xóa ---------------- */

/** Xóa giọng khỏi danh sách; giọng tự tạo (tả, nhân bản) xóa luôn ở Google. */
async function xoa(id) {
  const g = canMot(id);
  if (g.loai !== 'kho') {
    try {
      await tts.xoaGiong(g.id);
    } catch (e) {
      throw loiGiong(e);
    }
  }
  csdl().prepare('DELETE FROM giong_mai WHERE id = ?').run(g.id);
  try { fs.unlinkSync(tepMau(g.id)); } catch { /* không có tệp thì thôi */ }
  if (dangDung().id === g.id) caiDat.ghi('giong_mai', { id: null, model: dangDung().model });
  return danhSach();
}

module.exports = {
  luaChon, taoCauTa, danhSach, dangDung, datDangDung, layMot, them,
  taoTheoLuaChon, nhanBan, giongKho, luuTuKho, doc, ngheMau, xoa, CAU_DONG_Y, DOAN_MAU, CAU_THU,
};
