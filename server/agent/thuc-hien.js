'use strict';

/**
 * Thực hiện một lần gọi công cụ (F-08): mọi hành động của AI — và của hook — đi qua đây.
 *   1. Công cụ có trong danh sách của Agent không (không có → từ chối, ghi lý do).
 *   2. Tham số đúng lược đồ không.
 *   3. Cửa `truoc_cong_cu`: công tắc khẩn cấp → luật quyền → Bộ kiểm tra. "Hỏi" thành mục chờ duyệt.
 *   4. Chạy công cụ, có giới hạn thời gian.
 *   5. Cửa `sau_cong_cu`: ghi nhật ký.
 * Lỗi luôn trả về kèm cách sửa, để AI tự sửa ở bước sau thay vì dừng (A.6).
 */

const { layCongCu } = require('./cong-cu/danh-sach');
const { chayCua } = require('./hook/cua');
const { kiemLuocDo } = require('./luoc-do');
const nhatKy = require('../nghiep-vu/nhat-ky');
const choDuyet = require('../nghiep-vu/cho-duyet');
const { LoiNghiepVu } = require('../nghiep-vu/chung');
const { phat } = require('../ws');

// Công cụ cần Facebook mà nơi gọi không đưa kết nối (ví dụ duyệt mục chờ): lấy kết nối đang chạy.
function ketNoiMacDinh(x) {
  try {
    return require('../dich-vu').dichVu().layKetNoi(x);
  } catch {
    return null;
  }
}

function tuChoi({ runId, ten, thamSo, ma, thongDiep }) {
  nhatKy.ghiCongCu({ runId, congCu: ten, thamSo, biTuChoi: true, lyDo: `${ma}: ${thongDiep}` });
  return { loi: { ma, thong_diep: thongDiep } };
}

function hetGio(giay, ten) {
  let hen;
  const p = new Promise((_, loi) => {
    hen = setTimeout(() => loi(new LoiNghiepVu('QUA_THOI_GIAN', `Công cụ ${ten} chạy quá ${giay} giây. Thử lại hoặc bỏ qua bước này.`)), giay * 1000);
  });
  return { p, huy: () => clearTimeout(hen) };
}

/**
 * @param {object} o
 * @param {string} o.ten
 * @param {object} o.thamSo
 * @param {string|null} [o.runId]
 * @param {{id:string, cong_cu:string[]}|null} [o.agent]  null = hook hoặc người duyệt gọi
 * @param {object} [o.nguCanh]  dữ liệu cho công cụ: phienLiveId, soDuocGiao, layKetNoi, ghiNguon…
 * @param {boolean} [o.daDuyet]  người dùng đã duyệt mục chờ: bỏ qua khẩn cấp và luật quyền, vẫn qua Bộ kiểm tra
 * @returns {Promise<{ketQua?:any, loi?:{ma:string, thong_diep:string}, choDuyet?:object, kiemTra?:object}>}
 */
async function thucHienCongCu({ ten, thamSo = {}, runId = null, agent = null, nguCanh = {}, daDuyet = false }) {
  const def = layCongCu(ten);
  if (!def || (agent && !agent.cong_cu.includes(ten))) {
    const coThe = agent ? agent.cong_cu.filter((c) => layCongCu(c)).join(', ') : '';
    return tuChoi({ runId, ten, thamSo, ma: 'CONG_CU_KHONG_DUOC_CAP',
      thongDiep: `Công cụ "${ten}" không có trong danh sách của bạn.${coThe ? ` Chỉ dùng: ${coThe}.` : ''}` });
  }
  const loiThamSo = kiemLuocDo(thamSo, def.thamSo, 'tham số');
  if (loiThamSo.length) {
    return tuChoi({ runId, ten, thamSo, ma: 'THAM_SO_SAI', thongDiep: `Tham số chưa đúng: ${loiThamSo.join('; ')}. Gọi lại với đủ và đúng tham số.` });
  }
  const ctx = {
    ...nguCanh,
    agentId: agent?.id ?? nguCanh.agentId ?? null,
    runId,
    layKetNoi: nguCanh.layKetNoi || ketNoiMacDinh,
  };

  // Công cụ có bảng xem trước ("Nói với Mai", F-62): đọc hiểu lệnh ngay, kể cả khi sẽ phải chờ người bấm "Làm" —
  // lệnh mơ hồ thì trả lỗi kèm cách sửa để AI hỏi lại, không tạo mục chờ duyệt.
  let xemTruoc = null;
  if (def.xemTruoc && !daDuyet) {
    try {
      xemTruoc = def.xemTruoc(thamSo, ctx)?.xem_truoc || null;
    } catch (e) {
      const loi = e instanceof LoiNghiepVu ? e : new LoiNghiepVu('LOI_MAY', e.message);
      return tuChoi({ runId, ten, thamSo, ma: loi.ma, thongDiep: loi.message });
    }
  }
  const cua = { runId, agentId: ctx.agentId, congCu: def, thamSo, nguCanh: ctx, daDuyet };
  const truoc = await chayCua('truoc_cong_cu', cua);
  if (truoc.quyet_dinh !== 'cho_qua') {
    let muc = null;
    if (truoc.taoChoDuyet) {
      muc = choDuyet.taoMuc({ runId, hanhDong: ten, thamSo, lyDo: truoc.ly_do, hetHanGio: truoc.hetHanGio });
      phat('cho_duyet', { so: choDuyet.demCho() });
    }
    const huongDan = truoc.ma === 'KIEM_TRA_CHAN'
      ? ' Sửa câu cho đúng nguồn rồi gọi lại, hoặc bỏ qua nếu nguồn không có thông tin.'
      : truoc.taoChoDuyet ? ' Hành động đã vào hàng chờ duyệt; không gọi lại.' : '';
    const kq = tuChoi({ runId, ten, thamSo: cua.thamSo, ma: truoc.ma || 'HOOK_CHAN', thongDiep: `${truoc.ly_do}${huongDan}` });
    return { ...kq, ...(muc ? { choDuyet: muc } : {}), ...(xemTruoc ? { xemTruoc } : {}), ...(cua.ketQuaKiemTra ? { kiemTra: cua.ketQuaKiemTra } : {}) };
  }

  let ketQua = null;
  let loi = null;
  const gioiHan = hetGio(def.giay || 10, ten);
  try {
    ketQua = await Promise.race([Promise.resolve().then(() => def.chay(cua.thamSo, ctx)), gioiHan.p]);
  } catch (e) {
    loi = e instanceof LoiNghiepVu ? { ma: e.ma, thong_diep: e.message } : { ma: 'LOI_MAY', thong_diep: `Công cụ ${ten} lỗi: ${e.message}` };
  } finally {
    gioiHan.huy();
  }
  await chayCua('sau_cong_cu', { runId, congCu: def, thamSo: cua.thamSo, ketQua, loi, nguCanh: ctx });
  return loi ? { loi } : { ketQua, ...(cua.ketQuaKiemTra ? { kiemTra: cua.ketQuaKiemTra } : {}) };
}

/** Người dùng bấm Duyệt / Từ chối một mục chờ (F-08). Duyệt thì làm đúng tham số đã lưu, vẫn qua Bộ kiểm tra. */
async function xuLyChoDuyet(id, duyet, nguCanh = {}) {
  const muc = choDuyet.chot(id, duyet ? 'duyet' : 'tu_choi');
  if (!duyet) {
    phat('cho_duyet', { so: choDuyet.demCho() });
    return muc;
  }
  const run = muc.run_id ? nhatKy.xemRun(muc.run_id).run : null;
  const kq = await thucHienCongCu({
    ten: muc.hanh_dong,
    thamSo: muc.tham_so,
    runId: muc.run_id,
    nguCanh: { agentId: run?.agent_id ?? null, phienLiveId: run?.phien_live_id ?? muc.tham_so?.phien_id ?? null,
      hoiThoaiId: run?.hoi_thoai_id ?? muc.tham_so?.hoi_thoai_id ?? null, ...nguCanh },
    daDuyet: true,
  });
  phat('cho_duyet', { so: choDuyet.demCho() });
  return choDuyet.ghiKetQua(id, kq.loi ? { loi: kq.loi } : { ok: true, ket_qua: kq.ketQua });
}

module.exports = { thucHienCongCu, xuLyChoDuyet };
