'use strict';

/**
 * GD1 (F-119): chữ người dùng nhìn thấy không lộ mã kỹ thuật "(#số)" / "(F-số)"; mọi chip trạng thái đi qua `trang-thai.js`;
 * phông nằm trong máy. Chú thích trong mã được phép nhắc số đặc tả.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GOC = path.join(__dirname, '..');

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

/** Bỏ chú thích nhưng giữ số dòng. */
function boChuThich(chu, duoi) {
  const xoa = (m) => m.replace(/[^\n]/g, ' ');
  let s = chu.replace(/\/\*[\s\S]*?\*\//g, xoa);
  if (duoi === '.html') s = s.replace(/<!--[\s\S]*?-->/g, xoa);
  if (duoi === '.js' || duoi === '.html') s = s.replace(/(^|[^:\\'"`])\/\/[^\n]*/g, (m, dau) => dau + xoa(m.slice(dau.length)));
  return s;
}

// "(… #103)", "(F-75)" trong ngoặc, hoặc "F-105" đứng riêng. Màu "#000" không dính vì không nằm trong ngoặc cùng chữ.
const MA_KY_THUAT = /\((?:[^()]*[ ,(])?(?:#\d+|F-\d+)\b[^()]*\)|\bF-\d{2,3}\b/;

function quet(thuMuc, duoi, tepBo = () => false) {
  return cacTep(path.join(GOC, thuMuc), duoi).filter((p) => !tepBo(p)).flatMap((p) => boChuThich(fs.readFileSync(p, 'utf8'), path.extname(p))
    .split('\n')
    .map((dong, i) => (!/^\s*"_/.test(dong) && MA_KY_THUAT.test(dong)
      ? `${path.relative(GOC, p).split(path.sep).join('/')}:${i + 1}: ${dong.trim().slice(0, 110)}` : null))
    .filter(Boolean));
}

test('giao diện (public/) không lộ mã kỹ thuật (#số) / (F-số) trong chữ người dùng thấy', () => {
  const loi = quet('public', ['.js', '.html']);
  assert.deepEqual(loi, [], `Còn mã kỹ thuật trong giao diện:\n${loi.join('\n')}`);
});

test('câu máy chủ báo người dùng và kịch bản diễn tập không lộ mã kỹ thuật', () => {
  const loi = [
    ...quet('server/api', ['.js']),
    ...quet('server/agent/hook', ['.js']),
    ...quet('server/cau-hinh', ['.json'], (p) => p.endsWith('-cu.json')),
  ];
  assert.deepEqual(loi, [], `Còn mã kỹ thuật trong câu máy chủ:\n${loi.join('\n')}`);
});

test('bảng màu trạng thái chỉ còn một chỗ: không còn bảng MAU_* / TEN_TT riêng trong các màn hình', () => {
  const loi = cacTep(path.join(GOC, 'public', 'js'), ['.js']).flatMap((p) => {
    if (p.endsWith('trang-thai.js')) return [];
    return boChuThich(fs.readFileSync(p, 'utf8'), '.js').split('\n')
      .map((d, i) => (/\b(MAU_[A-Z_]+|TEN_TT[A-Z_]*|TRANG_THAI_SP)\s*=\s*\{/.test(d) ? `${path.relative(GOC, p)}:${i + 1}: ${d.trim().slice(0, 100)}` : null))
      .filter(Boolean);
  });
  assert.deepEqual(loi, [], `Còn bảng màu riêng:\n${loi.join('\n')}`);
});

test('phông chữ nằm trong máy, không tải từ Google; có biểu tượng tab', () => {
  const html = fs.readFileSync(path.join(GOC, 'public', 'index.html'), 'utf8');
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html), 'index.html không gọi Google Fonts');
  for (const f of ['BeVietnamPro-400-latin.woff2', 'BeVietnamPro-700-vietnamese.woff2', 'Lora-600-latin.woff2', 'OFL.txt']) {
    assert.ok(fs.existsSync(path.join(GOC, 'public', 'font', f)), `thiếu public/font/${f}`);
  }
  assert.ok(fs.existsSync(path.join(GOC, 'public', 'favicon.svg')), 'có favicon.svg');
});
