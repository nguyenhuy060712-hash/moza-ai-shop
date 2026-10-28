'use strict';

/**
 * Chạy một Agent thử nghiệm bằng nút (SPEC.md F-34): lời dặn + mục lục Sổ tay và tin Còn tuyển, chỉ công cụ nhóm Đọc.
 * Tắt thì không chạy (runtime trả AGENT_TAT); ba Agent chính không bị ảnh hưởng.
 */

const { chayAgent } = require('../runtime');
const caiDat = require('../../nghiep-vu/cai-dat');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');

async function chayThuNghiem(agentId, cauHoi, { nhaCungCap } = {}) {
  const a = caiDat.layAgent(agentId);
  if (!a.thu_nghiem) throw new LoiNghiepVu('KHONG_PHAI_THU_NGHIEM', 'Chỉ chạy bằng nút được Agent thử nghiệm.', 409);
  const kq = await chayAgent({
    agentId, kichHoat: 'Chạy thử bằng nút', tinDau: String(cauHoi || '').slice(0, 4000), mucLuc: { soTay: true, tin: true }, nhaCungCap,
  });
  return { ok: kq.ok, run_id: kq.runId, tra_loi: kq.ketQua?.chu ?? null, loi: kq.loi ?? null, model: kq.model, chi_phi_usd: kq.chiPhi };
}

module.exports = { chayThuNghiem };
