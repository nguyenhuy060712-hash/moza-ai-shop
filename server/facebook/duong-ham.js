'use strict';

/**
 * Đường hầm Cloudflare Quick Tunnel (F-24, #7): cho Meta gửi webhook tới cổng 127.0.0.1:5174 trên laptop.
 *  - MOZA tự chạy `cloudflared tunnel --url http://127.0.0.1:5174 --metrics 127.0.0.1:<cổng đo>` làm tiến trình con.
 *  - Địa chỉ `https://….trycloudflare.com` đọc từ cổng đo của cloudflared (`GET /quicktunnel` → {"hostname"}),
 *    chờ `GET /ready` = 200 (đã nối tới Cloudflare) rồi mới báo sẵn sàng.
 *  - Tiến trình chết → báo "rớt", tự mở lại sau 5 s → 10 s → 30 s → 60 s. Mỗi lần mở lại có địa chỉ mới,
 *    nơi dùng (ket-noi.js) phải đăng ký lại với Meta.
 * Quick Tunnel miễn phí, không cần tài khoản, không cam kết thời gian hoạt động (mục 13).
 */

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn: spawnGoc, execFileSync } = require('node:child_process');
const { EventEmitter } = require('node:events');

const LUI_MS = [5000, 10000, 30000, 60000];

/** Tìm cloudflared.exe: PATH → nơi bộ cài winget (MSI) đặt → bản portable của winget. */
function timCloudflared() {
  if (process.env.MOZA_CLOUDFLARED) return process.env.MOZA_CLOUDFLARED;
  try {
    const ra = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['cloudflared'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (ra[0]) return ra[0];
  } catch { /* không có trong PATH */ }
  const ung = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe'),
  ].filter(Boolean);
  return ung.find((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } }) || null;
}

function congTrong() {
  return new Promise((ok, loi) => {
    const s = net.createServer();
    s.once('error', loi);
    s.listen(0, '127.0.0.1', () => { const c = s.address().port; s.close(() => ok(c)); });
  });
}

class DuongHam extends EventEmitter {
  /**
   * @param {object} o
   * @param {number} o.congDich          cổng webhook trên máy (5174)
   * @param {()=>string|null} [o.tim]    tìm cloudflared (test thay)
   * @param {Function} [o.spawn]
   * @param {typeof fetch} [o.fetch]
   * @param {number} [o.choToiDaMs]      chờ cloudflared báo địa chỉ tối đa bao lâu
   */
  constructor({ congDich, tim = timCloudflared, spawn = spawnGoc, fetch: goi = fetch, choToiDaMs = 60000, luiMs = LUI_MS } = {}) {
    super();
    this.congDich = congDich;
    this.tim = tim;
    this.spawn = spawn;
    this.fetch = goi;
    this.choToiDaMs = choToiDaMs;
    this.luiMs = luiMs;
    this.tt = { trang_thai: 'tat', dia_chi: null, loi: null, lan_mo: 0, lan_rot: 0 };
    this.tien = null;
    this.dangDung = false;
    this.hen = null;
    this.lanLui = 0;
  }

  trangThai() {
    return { ...this.tt };
  }

  datTt(thayDoi) {
    Object.assign(this.tt, thayDoi);
    this.emit('thay_doi', this.trangThai());
  }

  async mo() {
    this.dangDung = false;
    clearTimeout(this.hen);
    const exe = this.tim();
    if (!exe) {
      this.datTt({ trang_thai: 'chua_cai', dia_chi: null,
        loi: 'Máy chưa có cloudflared. Mở PowerShell, gõ: winget install --id Cloudflare.cloudflared -e, rồi khởi động lại MOZA.' });
      return null;
    }
    const congDo = await congTrong();
    this.datTt({ trang_thai: 'dang_mo', dia_chi: null, loi: null, lan_mo: this.tt.lan_mo + 1 });
    const args = ['tunnel', '--no-autoupdate', '--metrics', `127.0.0.1:${congDo}`, '--url', `http://127.0.0.1:${this.congDich}`];
    let tien;
    try {
      tien = this.spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      this.datTt({ trang_thai: 'rot', loi: `Không chạy được cloudflared: ${e.message}` });
      this.henMoLai();
      return null;
    }
    this.tien = tien;
    let cuoiLog = '';
    tien.stderr?.on('data', (d) => { cuoiLog = (cuoiLog + d.toString()).slice(-2000); });
    tien.on('error', (e) => { cuoiLog += e.message; });
    tien.on('exit', () => {
      if (this.tien !== tien) return;
      this.tien = null;
      if (this.dangDung) return;
      // Quick Tunnel không chạy khi có file cấu hình tunnel có tên (.cloudflared/config.yaml).
      const loi = /config\.ya?ml/i.test(cuoiLog)
        ? 'cloudflared không mở Quick Tunnel vì máy có file .cloudflared\\config.yaml. Đổi tên file đó rồi khởi động lại MOZA.'
        : 'Đường hầm Cloudflare bị ngắt, đang mở lại.';
      this.datTt({ trang_thai: 'rot', dia_chi: null, loi, lan_rot: this.tt.lan_rot + 1 });
      this.emit('rot');
      this.henMoLai();
    });

    const diaChi = await this.choDiaChi(congDo, tien);
    if (!diaChi) {
      if (this.tien === tien) {
        this.datTt({ trang_thai: 'rot', loi: 'cloudflared không báo địa chỉ đường hầm. Kiểm tra mạng.' });
        this.dong({ giuTrangThai: true });
        this.henMoLai();
      }
      return null;
    }
    this.lanLui = 0;
    this.datTt({ trang_thai: 'san_sang', dia_chi: diaChi, loi: null });
    this.emit('san_sang', diaChi);
    return diaChi;
  }

  async choDiaChi(congDo, tien) {
    const het = Date.now() + this.choToiDaMs;
    let host = null;
    while (Date.now() < het && this.tien === tien && !this.dangDung) {
      try {
        if (!host) {
          const r = await this.fetch(`http://127.0.0.1:${congDo}/quicktunnel`, { signal: AbortSignal.timeout(2000) });
          if (r.ok) host = String((await r.json()).hostname || '').trim() || null;
        }
        if (host) {
          const s = await this.fetch(`http://127.0.0.1:${congDo}/ready`, { signal: AbortSignal.timeout(2000) });
          if (s.ok) return `https://${host.replace(/^https?:\/\//, '')}`;
        }
      } catch { /* cloudflared chưa mở cổng đo */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  }

  henMoLai() {
    if (this.dangDung) return;
    const ms = this.luiMs[Math.min(this.lanLui, this.luiMs.length - 1)];
    this.lanLui += 1;
    clearTimeout(this.hen);
    this.hen = setTimeout(() => { this.mo().catch((e) => console.error('  [đường hầm] ' + e.message)); }, ms);
  }

  dong({ giuTrangThai = false } = {}) {
    if (!giuTrangThai) this.dangDung = true;
    clearTimeout(this.hen);
    const t = this.tien;
    this.tien = null;
    if (t) { try { t.kill(); } catch { /* đã tắt */ } }
    if (!giuTrangThai) this.datTt({ trang_thai: 'tat', dia_chi: null });
  }
}

module.exports = { DuongHam, timCloudflared };
