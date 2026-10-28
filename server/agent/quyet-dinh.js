'use strict';

/**
 * Một lần gọi Decisions (BH11, docs/11 mục 3.3) — chọn trong danh sách đóng (MOZA nhìn F-113, Mai chọn món F-112). Khác `chayAgent`:
 * không công cụ, không nhiều bước, không lưu ảnh. Giữ hai công tắc như mọi AI tốn tiền ("Dừng mọi thứ", "Dừng AI" — F-72), ghi một
 * dòng `agent_run` (chi phí chỉ token vào: đầu ra Decisions miễn phí) để mức trần tính đủ.
 * Bản xem thử `--ai-gia` (MOZA_AI_GIA=1) và test dùng Decisions giả (`gia-mau.quyetDinh`) — 0 đồng.
 */

const caiDat = require('../nghiep-vu/cai-dat');
const chiPhi = require('../nghiep-vu/chi-phi');
const nhatKy = require('../nghiep-vu/nhat-ky');
const { anKhoa } = require('../khoa');

const MODEL = 'gpt-6-luna';

/**
 * @param {{agentId:string, kichHoat:string, noiDung:Array, cauHoi:Array, heThong?:string, phienLiveId?:string, dienTap?:boolean,
 *   tinHieu?:AbortSignal, nhaCungCap?:object, _dapAn?:object}} o — `nhaCungCap` thay bộ nối (test); `_dapAn` chỉ Decisions giả đọc.
 * @returns {Promise<{ok:boolean, traLoi?:object, chiPhi?:number, runId?:string, boQua?:boolean, loi?:{ma, thong_diep}}>}
 */
async function quyetDinh({ agentId, kichHoat, noiDung, cauHoi, heThong = null, phienLiveId = null, dienTap = false, tinHieu = null, nhaCungCap = null, _dapAn }) {
  if (tinHieu?.aborted) return { ok: false, boQua: true, loi: { ma: 'BI_DUNG', thong_diep: 'Đã dừng trước khi chạy.' } };
  // Agent bị tắt ở Cài đặt → Trợ lý AI thì không chạy (như chayAgent). Agent không có trong bảng (việc nội bộ) thì bỏ qua bước này.
  let agent = null;
  try { agent = caiDat.layAgent(agentId); } catch { agent = null; }
  if (agent && !agent.bat) return { ok: false, boQua: true, loi: { ma: 'AGENT_TAT', thong_diep: `${agent.ten} đang tắt.` } };
  if (caiDat.khanCap()) return { ok: false, boQua: true, loi: { ma: 'KHAN_CAP_DANG_BAT', thong_diep: '"Dừng mọi thứ" đang bật: AI không chạy.' } };
  if (caiDat.dungAi().bat) return { ok: false, boQua: true, loi: { ma: 'DUNG_AI', thong_diep: 'AI tạm dừng vì chạm trần chi phí.' } };
  const nha = nhaCungCap || require('./nha-cung-cap').openai;
  const runId = nhatKy.taoRun({ agentId, kichHoat, phienLiveId, dienTap });
  const batDau = Date.now();
  try {
    const r = await nha.quyetDinh({ model: MODEL, heThong, noiDung, cauHoi, tinHieu, _dapAn });
    const tien = chiPhi.tinhChiPhi(r.model || MODEL, r.tokenVao, 0);
    nhatKy.xongRun(runId, { nha: 'openai', model: r.model || MODEL, tokenVao: r.tokenVao, tokenRa: 0, chiPhi: tien, soBuoc: 1, ketQua: { tra_loi: r.traLoi, ms: Date.now() - batDau } });
    chiPhi.baoVuotTran(require('../ws').phat, chiPhi.kiemMucTran());
    return { ok: true, traLoi: r.traLoi, chiPhi: tien, runId, ms: Date.now() - batDau };
  } catch (e) {
    const loi = { ma: e.ma || 'AI_LOI', thong_diep: anKhoa(e.message) };
    nhatKy.xongRun(runId, { nha: 'openai', model: MODEL, loi });
    return { ok: false, loi, runId };
  }
}

module.exports = { quyetDinh, MODEL };
