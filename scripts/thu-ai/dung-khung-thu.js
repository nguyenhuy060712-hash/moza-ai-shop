'use strict';

/**
 * Dựng khung thử cho "MOZA nhìn" (SPEC.md F-107, phép thử bước A) — 0 đồng. Dùng ffmpeg có sẵn trên máy (chỉ để tạo dữ liệu thử,
 * KHÔNG phải thư viện của phần mềm). Nguồn: ảnh đầu của các món Đang bán trong data/xem-thu.
 *  - bang-mau.jpg: ảnh ghép các món, số to trên mỗi ô (giống bảng trình duyệt ghép lúc bật nút).
 *  - khung-XX.jpg (1280×720): mỗi món ~7 khung trên nhiều nền, lệch cỡ, lệch góc; thêm 10 khung không có món, không có người.
 *  - dap-an.json: đáp án từng khung (so = 0: không có món).
 * Chạy: "C:\Program Files\nodejs\node.exe" scripts/thu-ai/dung-khung-thu.js
 */

process.chdir(require('node:path').join(__dirname, '..', '..'));
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const RA = path.resolve('data/tam-test/khung-thu');
fs.rmSync(RA, { recursive: true, force: true });
fs.mkdirSync(RA, { recursive: true });
const FONT = 'C\\:/Windows/Fonts/arialbd.ttf';
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

const db = new DatabaseSync('data/xem-thu/moza.db', { readOnly: true });
const mon = db.prepare("SELECT id, so, ten, anh FROM san_pham WHERE trang_thai = 'dang_ban' ORDER BY so").all()
  .map((r) => ({ ...r, tep: (JSON.parse(r.anh || '[]')[0] || {}).tep })).filter((r) => r.tep && fs.existsSync(path.resolve('data/xem-thu/anh', r.id, r.tep)))
  .slice(0, 10);
if (!mon.length) { console.log('Không có món Đang bán có ảnh trong data/xem-thu.'); process.exit(1); }

// Bảng mẫu: mỗi ô 240×300, số to góc trên trái.
const o = mon.map((m, i) => {
  const f = path.join(RA, `o-${i}.jpg`);
  ff(['-i', path.resolve('data/xem-thu/anh', m.id, m.tep), '-vf',
    `scale=240:240:force_original_aspect_ratio=decrease,pad=240:300:(ow-iw)/2:60:white,drawbox=x=6:y=6:w=90:h=50:color=0xe8505b:t=fill,drawtext=fontfile='${FONT}':text='${m.so}':x=14:y=12:fontsize=40:fontcolor=white`, f]);
  return f;
});
const cot = Math.min(5, o.length);
const vi = o.map((_, i) => `${(i % cot) * 240}_${Math.floor(i / cot) * 300}`).join('|');
ff([...o.flatMap((f) => ['-i', f]), '-filter_complex', o.length > 1 ? `xstack=inputs=${o.length}:layout=${vi}:fill=white` : 'null', path.join(RA, 'bang-mau.jpg')]);

const NEN = ['0x2b2b2b', '0xd9cfc4', '0x3d5a80', '0xf2efe9', '0x6b4f3a', '0x9aa39a', '0x1f3b2f'];
const dapAn = [];
let k = 0;
for (const m of mon) {
  for (let j = 0; j < 7; j++) {
    const co = [380, 460, 540, 620, 420, 500, 580][j];
    const goc = [0, 4, -5, 8, -3, 0, 6][j];
    const x = [200, 440, 700, 300, 820, 560, 100][j];
    const ten = `khung-${String(++k).padStart(2, '0')}.jpg`;
    ff(['-f', 'lavfi', '-i', `color=c=${NEN[j]}:s=1280x720`, '-i', path.resolve('data/xem-thu/anh', m.id, m.tep), '-filter_complex',
      `[1]scale=-1:${co},rotate=${goc}*PI/180:c=none:ow=rotw(${goc}*PI/180):oh=roth(${goc}*PI/180)[a];[0][a]overlay=${x}:(H-h)/2:shortest=1`, '-frames:v', '1', path.join(RA, ten)]);
    dapAn.push({ tep: ten, so: m.so });
  }
}
for (let j = 0; j < 10; j++) {
  const ten = `khung-${String(++k).padStart(2, '0')}.jpg`;
  const src = j % 2 ? `color=c=${NEN[j % NEN.length]}:s=1280x720` : `gradients=s=1280x720:c0=${NEN[j % NEN.length]}:c1=0xffffff:seed=${j}`;
  ff(['-f', 'lavfi', '-i', src, '-frames:v', '1', path.join(RA, ten)]);
  dapAn.push({ tep: ten, so: 0 });
}
for (const f of o) fs.rmSync(f);
fs.writeFileSync(path.join(RA, 'dap-an.json'), JSON.stringify({ mon: mon.map((m) => ({ so: m.so, ten: m.ten })), khung: dapAn }, null, 1));
console.log(`Đã dựng ${dapAn.length} khung + bảng mẫu (${mon.length} món) ở ${RA}`);
