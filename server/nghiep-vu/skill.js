'use strict';

/**
 * Skill (F-11, A.7): mục lục (tên + "dùng khi") luôn nạp cho Agent được cấp; nội dung chỉ mở khi cần
 * (Director và Tư vấn viên tự mở bằng công cụ `mo_skill`; Co-host nhận 1–2 Skill do Director chọn).
 * Nội dung có phiên bản (ban-sua.js). "Chạy bài thi" dời tới khi phần mềm xong (#32).
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, kiemChu } = require('./chung');
const { taoBoBanSua } = require('./ban-sua');
const MAU = require('../cau-hinh/skill-mau.json');
const MAU_CU = require('../cau-hinh/skill-mau-cu.json');

const AGENT_DUNG_SKILL = ['director', 'cohost', 'tu_van', 'quan_ly'];

const bo = taoBoBanSua({ bang: 'skill_ban_sua', cotKhoa: 'skill_id', truong: ['cach_lam', 'vi_du_dung', 'vi_du_sai'] });

function docSkill(r) {
  return r ? { ...r, agent_ids: JSON.parse(r.agent_ids) } : null;
}

function laySkill(id) {
  const s = docSkill(csdl().prepare('SELECT * FROM skill WHERE id = ?').get(id));
  if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có Skill "${id}".`, 404);
  return s;
}

/** Lần chạy đầu: tạo các Skill mồi (A.7), mỗi cái bản 1 đang dùng. */
/**
 * Lần chạy đầu gieo mục lục và bản 1 của các Skill mồi. Các lần sau: Skill còn đúng chữ một bản mẫu cũ (chưa sửa tay)
 * thì nâng lên bản mẫu mới (khi phần mềm có Skill mẫu mới). Đã sửa tay thì giữ nguyên.
 */
function gieoSkill() {
  const co = csdl().prepare('SELECT COUNT(*) AS n FROM skill').get().n;
  if (!co) {
    giaoDich((db) => {
      const ghi = db.prepare('INSERT INTO skill (id, ten, dung_khi, agent_ids, thu_tu) VALUES (?, ?, ?, ?, ?)');
      MAU.skill.forEach((s, i) => ghi.run(s.id, s.ten, s.dung_khi, JSON.stringify(s.agent_ids), i));
    });
    for (const s of MAU.skill) bo.gieo(s.id, s);
  }
  // Skill mẫu mới thêm sau lần gieo đầu (BH6 F-84: go-luong-lu…): chèn vào dữ liệu đang chạy.
  const daCo = new Set(csdl().prepare('SELECT id FROM skill').all().map((r) => r.id));
  const thieu = MAU.skill.filter((s) => !daCo.has(s.id));
  if (co && thieu.length) {
    giaoDich((db) => {
      const n = db.prepare('SELECT COALESCE(MAX(thu_tu), 0) AS n FROM skill').get().n;
      const ghi = db.prepare('INSERT INTO skill (id, ten, dung_khi, agent_ids, thu_tu) VALUES (?, ?, ?, ?, ?)');
      thieu.forEach((s, i) => ghi.run(s.id, s.ten, s.dung_khi, JSON.stringify(s.agent_ids), n + 1 + i));
    });
    for (const s of thieu) bo.gieo(s.id, s);
  }
  for (const s of MAU.skill) bo.nangMau(s.id, MAU_CU[s.id] || [], s);
}

function danhSach() {
  return csdl().prepare('SELECT * FROM skill ORDER BY thu_tu, ten').all().map((r) => {
    const s = docSkill(r);
    return { ...s, phien_ban: bo.dangDung(s.id)?.phien_ban ?? null, co_nhap: !!bo.nhap(s.id) };
  });
}

function xem(id) {
  const s = laySkill(id);
  return { skill: s, dang_dung: bo.dangDung(id), nhap: bo.nhap(id), lich_su: bo.danhSach(id) };
}

/** Sửa mục lục: tên, "dùng khi", Agent được dùng. Mục lục không có phiên bản (SPEC.md mục 7). */
function suaMucLuc(id, duLieu = {}) {
  const s = laySkill(id);
  const ten = duLieu.ten !== undefined ? kiemChu(duLieu.ten, { ten: 'Tên Skill', batBuoc: true, toiDa: 120, motDong: true }) : s.ten;
  const dungKhi = duLieu.dung_khi !== undefined
    ? kiemChu(duLieu.dung_khi, { ten: '"Dùng khi"', batBuoc: true, toiDa: 300, motDong: true }) : s.dung_khi;
  let agentIds = s.agent_ids;
  if (duLieu.agent_ids !== undefined) {
    if (!Array.isArray(duLieu.agent_ids) || duLieu.agent_ids.some((a) => !AGENT_DUNG_SKILL.includes(a))) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Agent được dùng Skill chỉ có thể là Director, Co-host, Tư vấn viên.');
    }
    agentIds = [...new Set(duLieu.agent_ids)];
  }
  csdl().prepare('UPDATE skill SET ten = ?, dung_khi = ?, agent_ids = ? WHERE id = ?').run(ten, dungKhi, JSON.stringify(agentIds), id);
  return xem(id);
}

function luuNhap(id, duLieu = {}) {
  laySkill(id);
  bo.luuNhap(id, {
    cach_lam: kiemChu(duLieu.cach_lam, { ten: 'Cách làm', batBuoc: true, toiDa: 8000 }),
    vi_du_dung: kiemChu(duLieu.vi_du_dung, { ten: 'Ví dụ đúng', toiDa: 4000 }),
    vi_du_sai: kiemChu(duLieu.vi_du_sai, { ten: 'Ví dụ sai', toiDa: 4000 }),
  });
  return xem(id);
}

function kichHoat(id, phienBan = null) {
  laySkill(id);
  bo.kichHoat(id, phienBan);
  return xem(id);
}

function quayLai(id) {
  laySkill(id);
  bo.quayLai(id);
  return xem(id);
}

function boNhap(id) {
  laySkill(id);
  bo.boNhap(id);
  return xem(id);
}

/** Mục lục Skill của một Agent — phần luôn nạp vào lời dặn (A.7). Không chứa nội dung Skill. */
function mucLuc(agentId) {
  return danhSach().filter((s) => s.agent_ids.includes(agentId) && s.phien_ban)
    .map((s) => ({ id: s.id, ten: s.ten, dung_khi: s.dung_khi }));
}

/** Mở nội dung Skill đang dùng. Chỉ Agent được cấp mới mở được (A.6 `mo_skill`). */
function moSkill(id, agentId) {
  const s = laySkill(id);
  if (agentId && !s.agent_ids.includes(agentId)) {
    throw new LoiNghiepVu('SKILL_KHONG_DUOC_CAP', `Skill "${id}" không được cấp cho bạn. Chỉ mở Skill có trong mục lục của bạn.`, 403);
  }
  const b = bo.dangDung(id);
  return { id, ten: s.ten, phien_ban: b.phien_ban, cach_lam: b.cach_lam, vi_du_dung: b.vi_du_dung, vi_du_sai: b.vi_du_sai };
}

module.exports = {
  AGENT_DUNG_SKILL, gieoSkill, danhSach, xem, suaMucLuc, luuNhap, kichHoat, quayLai, boNhap, mucLuc, moSkill, laySkill,
};
