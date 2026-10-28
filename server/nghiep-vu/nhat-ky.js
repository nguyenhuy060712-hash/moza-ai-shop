'use strict';

/**
 * Nhật ký chạy AI (F-13, A.9): mỗi lần Agent chạy, mọi lần gọi công cụ (kể cả bị từ chối),
 * mọi quyết định hook. Từ một câu AI đã đưa ra phải lần lại được: vì đâu chạy, dùng bản sửa nào
 * của sản phẩm / Sổ tay / Skill / lời dặn, model nào, đã gọi gì, bị chặn gì.
 *
 * Mọi chữ ghi vào đây đi qua anKhoa: log không bao giờ chứa khóa API.
 */

const { csdl } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio } = require('./chung');
const { anKhoa } = require('../khoa');

const json = (x) => (x === undefined ? null : anKhoa(JSON.stringify(x)));
const docJson = (s, macDinh = null) => (s == null ? macDinh : JSON.parse(s));

function taoRun({ agentId, kichHoat, hoiThoaiId = null, phienLiveId = null, sanPhamId = null, sanPhamPhienBan = null,
  vaiTroPhienBan = null, dienTap = false }) {
  const id = taoId('run');
  csdl().prepare(`INSERT INTO agent_run (id, agent_id, kich_hoat, hoi_thoai_id, phien_live_id, san_pham_id, san_pham_phien_ban,
                    vai_tro_phien_ban, bat_dau, dien_tap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, agentId, anKhoa(kichHoat), hoiThoaiId, phienLiveId, sanPhamId, sanPhamPhienBan, vaiTroPhienBan, gio(), dienTap ? 1 : 0);
  return id;
}

/** Ghi kết quả cuối của một lần chạy. */
function xongRun(id, o) {
  csdl().prepare(`UPDATE agent_run SET nha = ?, model = ?, muc_suy_nghi = ?, ly_do_nang = ?, token_vao = ?, token_ra = ?,
                    chi_phi_usd = ?, so_buoc = ?, ket_qua = ?, loi = ?, so_tay_phien_ban = ?, skill_phien_ban = ?, ket_thuc = ?
                  WHERE id = ?`)
    .run(o.nha ?? null, o.model ?? null, o.mucSuyNghi ?? null, o.lyDoNang ?? null, o.tokenVao || 0, o.tokenRa || 0,
      o.chiPhi || 0, o.soBuoc || 0, json(o.ketQua ?? null), json(o.loi ?? null),
      JSON.stringify(o.soTayPhienBan || {}), JSON.stringify(o.skillPhienBan || {}), gio(), id);
  if (o.sanPhamId) csdl().prepare('UPDATE agent_run SET san_pham_id = ?, san_pham_phien_ban = ? WHERE id = ?').run(o.sanPhamId, o.sanPhamPhienBan ?? null, id);
}

function ghiCongCu({ runId = null, congCu, thamSo, ketQua, biTuChoi = false, lyDo = null }) {
  const id = taoId('gcc');
  csdl().prepare('INSERT INTO goi_cong_cu (id, run_id, cong_cu, tham_so, ket_qua, bi_tu_choi, ly_do, luc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, runId, congCu, json(thamSo ?? {}), json(ketQua ?? null), biTuChoi ? 1 : 0, anKhoa(lyDo), gio());
  return id;
}

function ghiHook({ runId = null, cua, hook, quyetDinh, lyDo = null }) {
  csdl().prepare('INSERT INTO nhat_ky_hook (id, run_id, cua, hook, quyet_dinh, ly_do, luc) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(taoId('nkh'), runId, cua, hook, quyetDinh, anKhoa(lyDo), gio());
}

function docRun(r) {
  return {
    ...r,
    so_tay_phien_ban: docJson(r.so_tay_phien_ban, {}),
    skill_phien_ban: docJson(r.skill_phien_ban, {}),
    ket_qua: docJson(r.ket_qua),
    loi: docJson(r.loi),
    dien_tap: r.dien_tap === 1,
  };
}

/** "Vì sao": một lần chạy cùng mọi lần gọi công cụ, quyết định hook và đánh giá. */
function xemRun(id) {
  const r = csdl().prepare('SELECT * FROM agent_run WHERE id = ?').get(id);
  if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy lần chạy này.', 404);
  const db = csdl();
  return {
    run: docRun(r),
    cong_cu: db.prepare('SELECT * FROM goi_cong_cu WHERE run_id = ? ORDER BY luc, rowid').all(id)
      .map((c) => ({ ...c, tham_so: docJson(c.tham_so, {}), ket_qua: docJson(c.ket_qua), bi_tu_choi: c.bi_tu_choi === 1 })),
    hook: db.prepare('SELECT * FROM nhat_ky_hook WHERE run_id = ? ORDER BY luc, rowid').all(id),
    danh_gia: db.prepare('SELECT * FROM danh_gia WHERE run_id = ? ORDER BY luc').all(id),
  };
}

function danhSachRun({ agentId = null, gioiHan = 50 } = {}) {
  const n = Math.min(Math.max(Number(gioiHan) || 50, 1), 200);
  const rows = agentId
    ? csdl().prepare('SELECT * FROM agent_run WHERE agent_id = ? ORDER BY bat_dau DESC LIMIT ?').all(agentId, n)
    : csdl().prepare('SELECT * FROM agent_run ORDER BY bat_dau DESC LIMIT ?').all(n);
  return rows.map(docRun);
}

/** Hook đã chặn gần đây mà không thuộc lần chạy nào (ví dụ hook khi bình luận đến). */
function hookGanDay(gioiHan = 50) {
  return csdl().prepare("SELECT * FROM nhat_ky_hook WHERE quyet_dinh != 'cho_qua' ORDER BY luc DESC LIMIT ?").all(gioiHan);
}

function congCuGanDay(gioiHan = 50) {
  return csdl().prepare('SELECT * FROM goi_cong_cu WHERE run_id IS NULL ORDER BY luc DESC LIMIT ?').all(gioiHan)
    .map((c) => ({ ...c, tham_so: docJson(c.tham_so, {}), ket_qua: docJson(c.ket_qua), bi_tu_choi: c.bi_tu_choi === 1 }));
}

/** Lỗi gần nhất của một Agent, cho trang vận hành. */
function loiGanNhat(agentId) {
  const r = csdl().prepare('SELECT id, loi, bat_dau FROM agent_run WHERE agent_id = ? AND loi IS NOT NULL ORDER BY bat_dau DESC LIMIT 1').get(agentId);
  return r ? { run_id: r.id, loi: docJson(r.loi), luc: r.bat_dau } : null;
}

function danhGia(runId, { diem, ly_do: lyDo = null } = {}) {
  if (!['tot', 'xau'].includes(diem)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Đánh giá phải là 👍 hoặc 👎.');
  xemRun(runId);
  csdl().prepare('INSERT INTO danh_gia (id, run_id, diem, ly_do, luc) VALUES (?, ?, ?, ?, ?)')
    .run(taoId('dg'), runId, diem, lyDo ? String(lyDo).slice(0, 1000) : null, gio());
  return xemRun(runId);
}

/** Số câu chen Đội AI đã làm tiếng trong một phiên (F-67: trần câu chen mỗi buổi); đoạn đọc phát dần là kịch bản, không tính. */
function demCauChen(phienId) {
  return csdl().prepare("SELECT COUNT(*) AS n FROM agent_run WHERE agent_id = 'doi_ai' AND phien_live_id = ? AND kich_hoat LIKE 'Đội AI · %' AND kich_hoat NOT LIKE 'Đội AI · đoạn%'").get(phienId).n;
}

module.exports = { demCauChen, taoRun, xongRun, ghiCongCu, ghiHook, xemRun, danhSachRun, hookGanDay, congCuGanDay, loiGanNhat, danhGia };
