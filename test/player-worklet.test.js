'use strict';

/**
 * Bộ phát tiếng Mai (public/player-worklet.js) chạy trong Node bằng vm với AudioWorklet giả.
 * Chủ dự án nghe Mai "nói vấp, lộp bộp" (24/9/2026): GPT Live 1 gửi tiếng không đều. Bài này phát lại đúng nhịp
 * tiếng thật đã ghi từ OpenAI trên máy dự án (test/du-lieu/goi-gpt-live-*.json: [ms tới, số byte, độ to]) và một
 * dòng giả mạng rất kém, rồi đếm số lần bộ phát phải chèn im lặng giữa câu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TAN_SO = 24000;
const KHOI = 128;
const GOI = 2400; // 100 ms
const DU_LIEU = path.join(__dirname, 'du-lieu');

function napBoPhat(maNguon) {
  const ctx = { currentTime: 0, Math, Float32Array, Int16Array };
  ctx.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage: () => {} }; } };
  ctx.registerProcessor = (_ten, lop) => { ctx.Lop = lop; };
  vm.createContext(ctx);
  vm.runInContext(maNguon, ctx);
  return { ctx, bp: new ctx.Lop() };
}

/** Gói 100 ms: có tiếng (sóng sin, xen chỗ ngắt 20 ms giữa các âm như phụ âm tắc — không phải chỗ nghỉ) hoặc lặng. */
function taoGoi(coTieng, so) {
  const m = new Int16Array(GOI);
  if (coTieng) {
    for (let i = 0; i < GOI; i++) {
      const trongAm = (i % 1200) < 720;
      m[i] = trongAm ? Math.round(9000 * Math.sin((2 * Math.PI * 220 * (so * GOI + i)) / TAN_SO)) : 0;
    }
  }
  return m.buffer;
}

/** Dòng tiếng từ số đo thật: gói tới đúng lúc đã ghi; có tiếng khi độ to > 300 như máy chủ tính. */
function dongThat(tep) {
  const ds = JSON.parse(fs.readFileSync(path.join(DU_LIEU, tep), 'utf8'));
  return ds.map(([ms, _byte, doTo], i) => ({ luc: 0.05 + ms / 1000, coTieng: doTo > 300, pcm: taoGoi(doTo > 300, i) }));
}

/** Dòng giả mạng rất kém: nói từng cụm 1,2 giây ngừng 0,2 giây; chậm hơn nhịp nói 5%; cứ 2,8 giây một gói trễ 0,6 giây. */
function dongMangKem() {
  const loai = [];
  const them = (n, coTieng) => { for (let i = 0; i < n; i++) loai.push(coTieng); };
  const noi = (soCum) => { for (let c = 0; c < soCum; c++) { them(12, true); if (c < soCum - 1) them(2, false); } };
  them(10, false); noi(6); them(15, false); noi(6); them(15, false); noi(6); them(20, false);
  const tre = [0, 0, 0, 0, 350, 0, 0, 0, 0, 0, 0, 250, 0, 0, 0, 0, 0, 600, 0, 0, 0, 0, 0, 0, 0, 300, 0, 0];
  let t = 0.05;
  let no = 0;
  return loai.map((coTieng, i) => {
    const treThem = tre[i % tre.length] / 1000;
    no += treThem;
    let buoc = 0.105;
    if (!treThem && no > 0) { const bot = Math.min(no, 0.09); buoc -= bot; no -= bot; }
    t += buoc + treThem;
    return { luc: t, coTieng, pcm: taoGoi(coTieng, i) };
  });
}

/**
 * Chạy bộ phát theo khối 128 mẫu. "Hụt giữa câu" = một lần bộ phát bắt đầu chèn im lặng (phát ít hơn 128 mẫu thật)
 * trong khi chỗ đang phát nằm giữa hai gói có tiếng liền nhau. "Nghỉ thêm" = im lặng chèn ở chỗ nghỉ thật.
 */
function chay(maNguon, dong, { xoaLuc = null } = {}) {
  const { ctx, bp } = napBoPhat(maNguon);
  let k = 0;
  let daGhi = 0;
  let hutGiuaCau = 0;
  const lucVap = [];
  let nghiThemS = 0;
  let dangChen = false;
  let batDauNoi = null;
  let toSauXoa = 0;
  let daXoa = false;
  const daPhat = () => daGhi - ((bp.ghi - bp.doc + bp.dem.length) % bp.dem.length);
  const het = dong.at(-1).luc + 3;
  for (let khoi = 0; ctx.currentTime < het; khoi++) {
    ctx.currentTime = (khoi * KHOI) / TAN_SO;
    if (xoaLuc != null && !daXoa && ctx.currentTime >= xoaLuc) {
      bp.port.onmessage({ data: { xoa: true } });
      daXoa = true;
      daGhi = 0;
      k = dong.length; // như trang và máy chủ: sau DỪNG AI không còn gói nào của câu cũ tới
    }
    while (k < dong.length && dong[k].luc <= ctx.currentTime) {
      bp.port.onmessage({ data: { pcm: dong[k].pcm.slice(0) } });
      daGhi += GOI;
      k += 1;
    }
    const truoc = daPhat();
    const ra = new Float32Array(KHOI);
    bp.process([], [[ra]]);
    const sau = daPhat();
    const to = ra.reduce((s, x) => Math.max(s, Math.abs(x)), 0);
    // Khối đầu sau khi xóa: tiếng tắt dần vài phần nghìn giây cho khỏi kêu "bụp"; từ khối sau phải im hẳn.
    if (daXoa) { if (ctx.currentTime >= xoaLuc + (2 * KHOI) / TAN_SO) toSauXoa = Math.max(toSauXoa, to); continue; }
    if (to > 0.05 && batDauNoi == null) batDauNoi = ctx.currentTime;
    const chen = sau - truoc < KHOI; // phát thiếu mẫu thật: phần còn lại của khối là im lặng chèn vào
    // Mẫu vừa phát và mẫu sắp phát đều thuộc gói có tiếng (kể cả đúng ranh giới hai gói) → đang giữa câu.
    const goiVua = Math.floor(Math.max(0, sau - 1) / GOI);
    const goiSap = Math.floor(sau / GOI);
    const giuaCau = sau > 0 && dong[goiVua]?.coTieng && dong[goiSap]?.coTieng;
    if (chen && giuaCau && !dangChen) { hutGiuaCau += 1; lucVap.push(ctx.currentTime); }
    if (chen && !giuaCau && sau > 0 && dong.slice(goiSap).some((g) => g.coTieng)) nghiThemS += (KHOI - (sau - truoc)) / TAN_SO;
    dangChen = chen && giuaCau;
  }
  const tiengDau = dong.find((g) => g.coTieng).luc;
  return { hutGiuaCau, lucVap, nghiThemS, treBatDauNoi: batDauNoi - tiengDau, toSauXoa };
}

const MA_MOI = fs.readFileSync(path.join(__dirname, '..', 'public', 'player-worklet.js'), 'utf8');

test('phát lại nhịp tiếng thật của GPT Live 1: không vấp giữa câu, Mai lên tiếng chậm thêm dưới 0,6 giây', () => {
  for (const tep of fs.readdirSync(DU_LIEU).filter((x) => x.startsWith('goi-gpt-live-'))) {
    const dong = dongThat(tep);
    const kq = chay(MA_MOI, dong);
    const khung = dong.filter((g, i) => i > 0 && g.luc - dong[i - 1].luc > 1).length; // mạng khựng trên 1 giây: không đệm nào che hết
    assert.ok(kq.hutGiuaCau <= khung, `${tep}: hụt giữa câu ${kq.hutGiuaCau} lần (khựng trên 1 giây: ${khung})`);
    assert.ok(kq.treBatDauNoi < 0.6, `${tep}: Mai lên tiếng chậm ${kq.treBatDauNoi.toFixed(2)} giây`);
  }
});

test('mạng rất kém: đệm tự tăng — vài lần vấp đầu rồi êm hẳn; chỗ nghỉ chỉ dài thêm chút ít', () => {
  const dong = dongMangKem();
  const moi = chay(MA_MOI, dong);
  // Bộ phát cũ (trước 24/9/2026): phát ngay khi nhận, không đệm — viết lại gọn để so.
  const CU = `class P extends AudioWorkletProcessor { constructor(){ super(); this.dem=new Float32Array(720000); this.doc=0; this.ghi=0;
    this.port.onmessage=(e)=>{ if(e.data.xoa){this.doc=this.ghi=0;return;} const m=new Int16Array(e.data.pcm);
    for(let i=0;i<m.length;i++){ this.dem[this.ghi]=m[i]/32768; this.ghi=(this.ghi+1)%720000; } }; }
    process(_v, ra){ const k=ra[0][0]; for(let i=0;i<k.length;i++){ if(this.doc===this.ghi){k[i]=0;continue;} k[i]=this.dem[this.doc]; this.doc=(this.doc+1)%720000; } return true; } }
    registerProcessor('p', P);`;
  const cu = chay(CU, dong);
  const nuaSau = dong.at(-1).luc / 2;
  assert.ok(moi.hutGiuaCau < cu.hutGiuaCau, `vấp: bộ mới ${moi.hutGiuaCau}, bộ cũ ${cu.hutGiuaCau}`);
  assert.deepEqual(moi.lucVap.filter((t) => t > nuaSau), [], 'nửa sau (đệm đã tự tăng) không vấp lần nào');
  assert.ok(cu.lucVap.some((t) => t > nuaSau), 'bộ phát cũ nửa sau vẫn vấp');
  assert.ok(moi.nghiThemS < 3, `chỗ nghỉ dài thêm tổng ${moi.nghiThemS.toFixed(2)} giây`);
});

test('DỪNG AI: bỏ sạch tiếng đang chờ, im ngay', () => {
  const kq = chay(MA_MOI, dongMangKem(), { xoaLuc: 4 });
  assert.ok(kq.toSauXoa < 0.05, `sau khi xóa vẫn còn tiếng (${kq.toSauXoa.toFixed(3)})`);
});
