'use strict';

/**
 * Rà chữ (SPEC.md mục 11): phần mềm bán hàng không còn chữ của bản cũ trong giao diện, cấu hình, lời dặn, Skill mẫu,
 * câu mẫu AI và các câu AI đọc trong mã. Chú thích trong mã được phép nhắc bản cũ (chú thích lịch sử); tệp `*-cu.json`
 * là bản mẫu cũ giữ để nâng cấp, không rà.
 * Không gọi mạng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { moCSDLTam } = require('./ho-tro');

const GOC = path.join(__dirname, '..');
const CHU_CAM = ['tuyển dụng', 'ứng viên', 'nhà máy', 'bắc ninh work', 'phỏng vấn', 'công nhân', 'ứng tuyển', 'tìm việc'];

/** Mọi tệp có đuôi cho trước trong một thư mục (kể cả thư mục con). */
function cacTep(thuMuc, duoi) {
  const ra = [];
  const quet = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) quet(p);
      else if (duoi.includes(path.extname(f.name))) ra.push(p);
    }
  };
  quet(thuMuc);
  return ra;
}

/**
 * Bỏ chú thích nhưng giữ số dòng (thay chữ trong chú thích bằng khoảng trắng). Chỉ đủ dùng cho mã của dự án:
 * "//" đứng sau dấu ":" (địa chỉ https://) không bị coi là chú thích.
 */
function boChuThich(chu, duoi) {
  const xoa = (m) => m.replace(/[^\n]/g, ' ');
  if (duoi === '.html') return chu.replace(/<!--[\s\S]*?-->/g, xoa);
  let s = chu.replace(/\/\*[\s\S]*?\*\//g, xoa);
  if (duoi === '.js') s = s.replace(/(^|[^:\\'"`])\/\/[^\n]*/g, (m, dau) => dau + xoa(m.slice(dau.length)));
  return s;
}

/** Các chỗ còn chữ cấm: "tệp:dòng: …chữ…". */
function timChuCam(chu, ten) {
  const ra = [];
  chu.normalize('NFC').split('\n').forEach((dong, i) => {
    const thuong = dong.toLowerCase();
    for (const tu of CHU_CAM) if (thuong.includes(tu)) ra.push(`${ten}:${i + 1}: "${tu}" — ${dong.trim().slice(0, 120)}`);
  });
  return ra;
}

const tuongDoi = (p) => path.relative(GOC, p).replaceAll('\\', '/');

test('giao diện (public/**/*.js, html, css) không còn chữ của bản cũ', () => {
  const tep = cacTep(path.join(GOC, 'public'), ['.js', '.html', '.css']);
  assert.ok(tep.some((p) => p.endsWith('index.html')), 'tìm thấy giao diện');
  const loi = tep.flatMap((p) => timChuCam(boChuThich(fs.readFileSync(p, 'utf8'), path.extname(p)), tuongDoi(p)));
  assert.deepEqual(loi, [], `Còn chữ của bản cũ trong giao diện:\n${loi.join('\n')}`);
});

test('cấu hình, lời dặn mẫu, Skill mẫu, câu mẫu AI (server/cau-hinh/*.json, trừ *-cu.json) không còn chữ của bản cũ', () => {
  const tep = fs.readdirSync(path.join(GOC, 'server', 'cau-hinh')).filter((f) => f.endsWith('.json') && !f.endsWith('-cu.json'));
  for (const f of ['loi-dan-mau.json', 'skill-mau.json', 'doi-ai-cau-mau.json', 'mac-dinh.json']) assert.ok(tep.includes(f), f);
  const loi = tep.flatMap((f) => timChuCam(fs.readFileSync(path.join(GOC, 'server', 'cau-hinh', f), 'utf8'), `server/cau-hinh/${f}`));
  assert.deepEqual(loi, [], `Còn chữ của bản cũ trong cấu hình:\n${loi.join('\n')}`);
});

test('chữ trong mã máy chủ (câu AI đọc, câu báo người dùng) không còn chữ của bản cũ; chú thích được phép', () => {
  const tep = cacTep(path.join(GOC, 'server'), ['.js']);
  const loi = tep.flatMap((p) => timChuCam(boChuThich(fs.readFileSync(p, 'utf8'), '.js'), tuongDoi(p)));
  assert.deepEqual(loi, [], `Còn chữ của bản cũ trong mã máy chủ:\n${loi.join('\n')}`);
});

test('thứ AI thật sự nhận sau khi gieo dữ liệu: lời dặn, Skill, Sổ tay mồi, tên AI', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const vaiTro = require('../server/nghiep-vu/vai-tro');
  const skill = require('../server/nghiep-vu/skill');
  const soTay = require('../server/nghiep-vu/so-tay');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const loi = [
    ...Object.keys(vaiTro.AI).flatMap((id) => timChuCam(vaiTro.loiDan(id).noi_dung, `lời dặn ${id}`)),
    ...skill.danhSach().flatMap((s) => {
      const k = skill.moSkill(s.id, null);
      return timChuCam([s.ten, s.dung_khi, k.cach_lam, k.vi_du_dung, k.vi_du_sai].join('\n'), `Skill ${s.id}`);
    }),
    ...soTay.danhSachMuc().flatMap((m) => timChuCam(`${m.tieu_de}\n${m.noi_dung}`, `Sổ tay ${m.tieu_de}`)),
    ...timChuCam(caiDat.tenAi(), 'tên AI'),
    ...caiDat.danhSachAgent().flatMap((a) => timChuCam(`${a.ten}\n${a.muc_tieu}`, `agent ${a.id}`)),
  ];
  assert.deepEqual(loi, [], `Còn chữ của bản cũ trong dữ liệu gieo:\n${loi.join('\n')}`);
});

test('bộ rà chữ bắt được chữ cấm (kể cả viết hoa, tổ hợp dấu khác) và bỏ qua chú thích', () => {
  assert.equal(timChuCam('Tuyển Dụng gấp'.normalize('NFD'), 'x').length, 1);
  assert.equal(timChuCam('BẮC NINH WORK', 'x').length, 1);
  assert.equal(timChuCam('áo sơ mi', 'x').length, 0);
  assert.equal(timChuCam(boChuThich('const a = 1; // bản tuyển dụng cũ\nconst u = "https://x";', '.js'), 'x').length, 0);
  assert.equal(timChuCam(boChuThich('/* ứng viên */ const b = "phỏng vấn";', '.js'), 'x').length, 1);
  assert.equal(timChuCam(boChuThich('<!-- nhà máy --><p>Công nhân</p>', '.html'), 'x').length, 1);
});
