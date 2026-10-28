'use strict';

/**
 * Agent & Skill (SPEC.md mục 8 nhóm "Agent", "Nhật ký"; F-07 → F-14):
 * trang vận hành, Skill, lời dặn vai trò, Hook, Luật quyền, chờ duyệt, nhật ký "Vì sao", mức trần chi phí.
 * Đổi model của Agent vẫn ở PUT /agent/:id (api/cai-dat.js).
 */

const express = require('express');
const caiDat = require('../nghiep-vu/cai-dat');
const skill = require('../nghiep-vu/skill');
const vaiTro = require('../nghiep-vu/vai-tro');
const luatQuyen = require('../nghiep-vu/luat-quyen');
const nhatKy = require('../nghiep-vu/nhat-ky');
const chiPhi = require('../nghiep-vu/chi-phi');
const choDuyet = require('../nghiep-vu/cho-duyet');
const hook = require('../agent/hook/cua');
const { danhSachCongCu, TEN_NHOM } = require('../agent/cong-cu/danh-sach');
const { xuLyChoDuyet } = require('../agent/thuc-hien');
const { LoiNghiepVu } = require('../nghiep-vu/chung');
const { phat } = require('../ws');

const r = express.Router();

const phienBan = (b) => (b.phien_ban === undefined || b.phien_ban === null ? null : Number(b.phien_ban));

/* ---------------- vận hành ---------------- */

r.get('/agent', (req, res) => {
  res.json({
    agents: caiDat.danhSachAgent().map((a) => ({ ...a, loi_gan_nhat: nhatKy.loiGanNhat(a.id) })),
    chi_phi: chiPhi.tongQuan(),
    khan_cap: caiDat.khanCap(),
    khan_cap_ly_do: caiDat.lyDoKhanCap(),
    dung_ai: caiDat.dungAi(),
    muc_chi_phi: require('../nghiep-vu/chi-phi').mucDo(),
    cho_duyet: choDuyet.demCho(),
  });
});

// GD1 (F-120): "Đội AI như nhân viên" và "Chỉ số AI 7 ngày" của trang Hôm nay.
r.get('/agent/doi-hinh', (req, res) => {
  res.json({ doi_hinh: require('../nghiep-vu/ai-kenh').doiHinh() });
});

r.get('/agent/chi-so', (req, res) => {
  res.json(require('../nghiep-vu/ai-kenh').chiSo(req.query.ngay));
});

r.put('/muc-tran', (req, res) => {
  const moi = chiPhi.datMucTran(req.body || {});
  res.json({ muc_tran: moi, chi_phi: chiPhi.tongQuan() });
});

/* ---------------- Skill ---------------- */

r.get('/skill', (req, res) => {
  res.json({ skill: skill.danhSach() });
});

r.get('/skill/:id', (req, res) => {
  res.json(skill.xem(req.params.id));
});

// Sửa mục lục (tên, "dùng khi", Agent được dùng) và/hoặc lưu bản nháp nội dung.
r.put('/skill/:id', (req, res) => {
  const b = req.body || {};
  if (b.ten !== undefined || b.dung_khi !== undefined || b.agent_ids !== undefined) skill.suaMucLuc(req.params.id, b);
  if (b.cach_lam !== undefined) skill.luuNhap(req.params.id, b);
  res.json(skill.xem(req.params.id));
});

r.post('/skill/:id/kich-hoat', (req, res) => {
  res.json(skill.kichHoat(req.params.id, phienBan(req.body || {})));
});

r.post('/skill/:id/quay-lai', (req, res) => {
  res.json(skill.quayLai(req.params.id));
});

r.post('/skill/:id/bo-nhap', (req, res) => {
  res.json(skill.boNhap(req.params.id));
});

// "Chạy bài thi" dời tới khi phần mềm xong (#32).
r.post('/skill/:id/thi', () => {
  throw new LoiNghiepVu('CHUA_CO', '"Chạy bài thi" để dành tới khi phần mềm xong. Kích hoạt Skill mới không cần bài thi ở bản đầu.');
});

/* ---------------- lời dặn vai trò ---------------- */

r.get('/vai-tro', (req, res) => {
  res.json({ vai_tro: vaiTro.danhSach() });
});

r.get('/vai-tro/:agentId', (req, res) => {
  res.json(vaiTro.xem(req.params.agentId));
});

r.put('/vai-tro/:agentId', (req, res) => {
  res.json(vaiTro.luuNhap(req.params.agentId, (req.body || {}).noi_dung));
});

r.post('/vai-tro/:agentId/kich-hoat', (req, res) => {
  res.json(vaiTro.kichHoat(req.params.agentId, phienBan(req.body || {})));
});

r.post('/vai-tro/:agentId/quay-lai', (req, res) => {
  res.json(vaiTro.quayLai(req.params.agentId));
});

r.post('/vai-tro/:agentId/bo-nhap', (req, res) => {
  res.json(vaiTro.boNhap(req.params.agentId));
});

/* ---------------- Hook ---------------- */

r.get('/hook', (req, res) => {
  res.json({ cua: hook.danhSachHook() });
});

r.put('/hook/:id', (req, res) => {
  res.json({ cua: hook.datBat(req.params.id, (req.body || {}).bat) });
});

/* ---------------- Luật quyền ---------------- */

function bangLuat() {
  const agents = caiDat.danhSachAgent();
  const luat = luatQuyen.danhSachLuat();
  return danhSachCongCu().map((c) => {
    const chung = luat.find((l) => l.hanh_dong === c.ten && !Object.keys(l.dieu_kien).length);
    return {
      ten: c.ten,
      mo_ta: c.moTa,
      nhom: c.nhom,
      ten_nhom: TEN_NHOM[c.nhom],
      mac_dinh: c.macDinh,
      muc: chung ? chung.muc : c.macDinh,
      luat_rieng: luat.filter((l) => l.hanh_dong === c.ten && Object.keys(l.dieu_kien).length),
      ai_dung: agents.filter((a) => a.cong_cu.includes(c.ten)).map((a) => a.ten),
    };
  });
}

r.get('/luat-quyen', (req, res) => {
  res.json({ cong_cu: bangLuat(), khan_cap: caiDat.khanCap() });
});

// { hanh_dong, muc }: muc = cho_phep | hoi | cam; null = về mặc định của công cụ.
r.put('/luat-quyen', (req, res) => {
  const { hanh_dong: hanhDong, muc } = req.body || {};
  if (!danhSachCongCu().some((c) => c.ten === hanhDong)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có công cụ này.', 404);
  luatQuyen.datMuc(hanhDong, muc ?? null);
  res.json({ cong_cu: bangLuat(), khan_cap: caiDat.khanCap() });
});

/* ---------------- chờ duyệt ---------------- */

r.get('/cho-duyet', (req, res) => {
  const trangThai = ['cho', 'het_han', 'duyet', 'tu_choi'].includes(req.query.trang_thai) ? req.query.trang_thai : 'cho';
  res.json({ cho_duyet: choDuyet.danhSach({ trangThai }), da_het_han: choDuyet.demHetHan() });
});

// { duyet: true | false }
r.post('/cho-duyet/:id', async (req, res) => {
  const { duyet } = req.body || {};
  if (typeof duyet !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn Duyệt hoặc Từ chối.');
  const muc = await xuLyChoDuyet(req.params.id, duyet);
  phat('trang_thai');
  res.json({ muc });
});

/* ---------------- nhật ký "Vì sao" ---------------- */

r.get('/run', (req, res) => {
  res.json({
    run: nhatKy.danhSachRun({ agentId: req.query.agent || null, gioiHan: req.query.so }),
    hook_ngoai_run: nhatKy.hookGanDay(20),
    cong_cu_ngoai_run: nhatKy.congCuGanDay(20),
  });
});

r.get('/run/:id', (req, res) => {
  res.json(nhatKy.xemRun(req.params.id));
});

r.post('/run/:id/danh-gia', (req, res) => {
  const b = req.body || {};
  const kq = nhatKy.danhGia(req.params.id, b);
  // F-36: 👎 kèm lý do → AI đề xuất bài học (chạy nền; kết quả vào Agent & Skill → Bài học, chờ người duyệt).
  if (b.diem === 'xau' && String(b.ly_do || '').trim()) {
    require('../agent/agents/bai-hoc').deXuatBaiHoc(req.params.id, b.ly_do)
      .then((x) => { if (x.ok) require('../ws').phat('bai_hoc', { id: x.bai_hoc.id }); })
      .catch((e) => console.error('  [bài học] ' + e.message));
  }
  res.json(kq);
});

/* ---------------- bài học (F-36) ---------------- */

r.get('/bai-hoc', (req, res) => {
  const baiHoc = require('../nghiep-vu/bai-hoc');
  res.json({ bai_hoc: baiHoc.danhSach(), cho: baiHoc.demCho() });
});

r.post('/bai-hoc/:id', (req, res) => {
  const baiHoc = require('../nghiep-vu/bai-hoc');
  const b = req.body || {};
  if (b.hanh_dong === 'duyet') return res.json({ bai_hoc: baiHoc.duyet(req.params.id, b) });
  if (b.hanh_dong === 'bo') return res.json({ bai_hoc: baiHoc.bo(req.params.id) });
  throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn Duyệt hoặc Bỏ.');
});

/* ---------------- Agent thử nghiệm (F-34) ---------------- */

r.get('/agent-thu-nghiem', (req, res) => {
  const { danhSachCongCu } = require('../agent/cong-cu/danh-sach');
  res.json({
    agents: require('../nghiep-vu/agent-thu-nghiem').danhSach(),
    cong_cu_doc: danhSachCongCu().filter((c) => c.nhom === 'doc').map((c) => ({ ten: c.ten, mo_ta: c.moTa })),
    lua_chon: caiDat.MAC_DINH.nha,
  });
});

r.post('/agent-thu-nghiem', (req, res) => {
  const { layCongCu } = require('../agent/cong-cu/danh-sach');
  const a = require('../nghiep-vu/agent-thu-nghiem').taoAgent(req.body || {}, (ten) => layCongCu(ten)?.nhom ?? null);
  res.status(201).json({ agent: a });
});

r.put('/agent-thu-nghiem/:id', (req, res) => {
  const bat = (req.body || {}).bat;
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  res.json({ agent: require('../nghiep-vu/agent-thu-nghiem').datBat(req.params.id, bat) });
});

r.post('/agent-thu-nghiem/:id/chay', async (req, res) => {
  res.json(await require('../agent/agents/thu-nghiem').chayThuNghiem(req.params.id, (req.body || {}).cau_hoi));
});

module.exports = r;
