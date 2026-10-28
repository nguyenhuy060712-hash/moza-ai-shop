'use strict';

/**
 * "Tự chạy khi mở máy" (SPEC.md F-01): gọi scripts/tu-chay.ps1 để bật, tắt hoặc xem.
 * Chỉ chạy khi người dùng bấm trong Cài đặt. Việc tự chạy lại khi bị tắt do scripts/start.bat lo
 * (vòng lặp chạy lại sau 3 giây), không cần Task Scheduler.
 */

const path = require('node:path');
const { execFile } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'tu-chay.ps1');

function chay(lenh) {
  return new Promise((ok, loi) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Lenh', lenh],
      { timeout: 30000, windowsHide: true },
      (e, ra, raLoi) => {
        if (e) return loi(new Error(String(raLoi || e.message).trim().slice(0, 300)));
        ok(String(ra).trim());
      },
    );
  });
}

function docKetQua(s) {
  const [trangThai, cach = ''] = s.split(':');
  return { bat: trangThai === 'dang-bat' || trangThai === 'da-bat', cach };
}

async function xem() {
  if (process.platform !== 'win32') return { bat: false, cach: '', hoTro: false };
  return { ...docKetQua(await chay('xem')), hoTro: true };
}

async function dat(bat) {
  if (process.platform !== 'win32') throw new Error('Tự chạy khi mở máy chỉ có trên Windows.');
  return { ...docKetQua(await chay(bat ? 'bat' : 'tat')), hoTro: true };
}

module.exports = { xem, dat };
