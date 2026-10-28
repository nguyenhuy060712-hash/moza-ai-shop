'use strict';

/**
 * Đề xuất bài học (SPEC.md F-36, A.7): người dùng chấm 👎 kèm lý do một lần chạy AI → Agent "Đề xuất bài học" đọc lần chạy
 * đó (việc kích hoạt, công cụ đã gọi, câu đã gửi / đã nói), mục lục Skill và Sổ tay, rồi đề xuất **một** bài học và nơi ghi.
 * Kết quả chỉ vào hàng "Bài học" chờ duyệt — không ảnh hưởng lần chạy nào cho tới khi người duyệt.
 * Số điện thoại trong ngữ cảnh được che trước khi gửi (bài học không bao giờ chứa số của khách).
 */

const { chayAgent } = require('../runtime');
const nhatKy = require('../../nghiep-vu/nhat-ky');
const skill = require('../../nghiep-vu/skill');
const soTay = require('../../nghiep-vu/so-tay');
const baiHoc = require('../../nghiep-vu/bai-hoc');

const PHIEU = {
  type: 'object',
  properties: {
    bai_hoc: { type: 'string', description: '1–3 câu, viết như một quy tắc làm việc' },
    dich: { type: 'string', enum: ['skill', 'so_tay'] },
    dich_id: { type: 'string', description: 'id Skill hoặc id mục Sổ tay nơi ghi bài học' },
    vi_sao: { type: 'string', description: 'Vì sao bài học này sửa được lỗi, một câu' },
  },
  required: ['bai_hoc', 'dich', 'dich_id', 'vi_sao'],
  additionalProperties: false,
};

/** Che số điện thoại và số CCCD (mục 9: bài học / câu thi không chứa thông tin cá nhân). */
function cheSo(s) {
  return String(s ?? '').replace(/(?:\+?84|0)[\s.-]*[35789](?:[\s.-]*\d){8}/g, '[số điện thoại]').replace(/(?<!\d)\d{12}(?!\d)/g, '[số CCCD]');
}

/**
 * @param {string} runId   lần chạy bị 👎
 * @param {string} lyDo    lý do người dùng ghi
 * @param {object} [o]     { nhaCungCap, danhGiaId }
 */
async function deXuatBaiHoc(runId, lyDo, { nhaCungCap, danhGiaId = null } = {}) {
  const d = nhatKy.xemRun(runId);
  const r = d.run;
  const congCu = d.cong_cu.map((c) => `- ${c.cong_cu}${c.bi_tu_choi ? ' (bị từ chối)' : ''}: ${cheSo(JSON.stringify(c.tham_so)).slice(0, 600)}${c.ly_do ? ` — ${cheSo(c.ly_do).slice(0, 200)}` : ''}`);
  // Chỉ Skill của đúng Agent bị chấm (Agent không dùng Skill, ví dụ Soát tin, thì mọi Skill).
  const skillCuaAgent = skill.danhSach().filter((s) => s.agent_ids.includes(r.agent_id));
  const skillChon = skillCuaAgent.length ? skillCuaAgent : skill.danhSach();
  const dsSkill = skillChon.map((s) => `- ${s.id}: ${s.ten} — dùng khi: ${s.dung_khi}`);
  const dsSoTay = soTay.danhSachMuc().map((m) => `- ${m.id}: ${m.tieu_de}`);
  const tinDau = [
    `Lần chạy của Agent "${r.agent_id}" bị người dùng chấm 👎.`,
    `Lý do người dùng ghi: ${cheSo(lyDo || '(không ghi lý do)')}`,
    `Việc kích hoạt: ${cheSo(r.kich_hoat)}`,
    '## Các công cụ AI đã gọi (gồm câu đã gửi / đã hiện)',
    congCu.join('\n') || '(không gọi công cụ nào)',
    `## Kết quả cuối\n${cheSo(JSON.stringify(r.ket_qua)).slice(0, 1500)}`,
    '## Skill đang có', dsSkill.join('\n'),
    '## Mục Sổ tay đang có', dsSoTay.join('\n'),
    'Đề xuất đúng một bài học và nơi ghi (dich = skill hoặc so_tay, dich_id = id trong danh sách trên). Trả phiếu JSON.',
  ].join('\n');
  const kq = await chayAgent({
    agentId: 'bai_hoc', kichHoat: `👎 lần chạy ${runId}`, tinDau, luocDo: PHIEU, nhaCungCap,
    kiemPhieuThem: (p) => {
      const ok = p.dich === 'skill' ? skillChon.some((s) => s.id === p.dich_id) : soTay.danhSachMuc().some((m) => m.id === p.dich_id);
      return ok ? [] : [`dich_id "${p.dich_id}" không có trong danh sách ${p.dich === 'skill' ? 'Skill' : 'mục Sổ tay'}.`];
    },
  });
  if (!kq.ok) return { ok: false, loi: kq.loi, runId: kq.runId };
  const bh = baiHoc.tao({
    noiDung: cheSo(kq.ketQua.bai_hoc), dich: kq.ketQua.dich, dichId: kq.ketQua.dich_id, runIds: [runId, kq.runId],
    lyDo: `${cheSo(lyDo || '')}${kq.ketQua.vi_sao ? ` · AI: ${cheSo(kq.ketQua.vi_sao)}` : ''}`.slice(0, 1000), danhGiaId,
  });
  return { ok: true, bai_hoc: bh };
}

module.exports = { deXuatBaiHoc, cheSo, PHIEU };
