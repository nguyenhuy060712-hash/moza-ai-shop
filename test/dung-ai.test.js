'use strict';

// Tách "Dừng AI" (tự bật khi vượt trần) và "Dừng mọi thứ" (chỉ khi người bấm) — SPEC.md F-72, #101.

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

function ghiChiPhi(usd, luc = new Date()) {
  const nhatKy = require('../server/nghiep-vu/nhat-ky');
  const id = nhatKy.taoRun({ agentId: 'director', kichHoat: 'thử chi phí' });
  nhatKy.xongRun(id, { nha: 'gemini', model: 'gemini-3.8-flash', tokenVao: 1, tokenRa: 1, chiPhi: usd });
  require('../server/db/ket-noi').csdl().prepare('UPDATE agent_run SET bat_dau = ? WHERE id = ?').run(luc.toISOString(), id);
}

test('Dừng AI: 80% → dải vàng; vượt trần → Dừng AI bật, Dừng mọi thứ tắt; ngày có live dùng trần 20 USD; tự tắt khi hết lý do và không có live', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const chiPhi = require('../server/nghiep-vu/chi-phi');
  const live = require('../server/nghiep-vu/live');
  assert.equal(chiPhi.mucDo().muc, 'xanh');
  ghiChiPhi(6.5); // 81% trần giờ 8 USD
  assert.equal(chiPhi.mucDo().muc, 'vang');
  const phat = [];
  chiPhi.baoVuotTran((type, d) => phat.push({ type, ...d }));
  assert.equal(phat.at(-1).type, 'chi_phi.muc');
  ghiChiPhi(2); // 8,5 > 8
  const cb = chiPhi.kiemMucTran();
  assert.match(cb, /AI tạm dừng vì chạm trần — chốt đơn vẫn chạy/);
  assert.equal(caiDat.dungAi().bat, true);
  assert.equal(caiDat.khanCap(), false, '"Dừng mọi thứ" không tự bật');
  assert.equal(chiPhi.mucDo().muc, 'do');
  // Đang có live → không tự tắt dù đã hết lý do.
  taoSanPhamMau();
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id });
  live.ganLive(p.id, 'L1');
  require('../server/db/ket-noi').csdl().prepare('UPDATE agent_run SET bat_dau = ?').run(new Date(Date.now() - 2 * 3600e3).toISOString());
  assert.equal(chiPhi.tuTatDungAi(), false, 'giữa live không tự bật lại AI');
  live.ketThucPhien(p.id);
  assert.equal(chiPhi.tuTatDungAi(), true, 'hết lý do, không có live → tự tắt');
  assert.equal(caiDat.dungAi().bat, false);
  // Trần ngày: 15 USD ngày thường, 20 USD ngày có live (#101).
  // Trần giờ cao để chỉ thử trần ngày; mọi chi phí ghi ở "bây giờ" để chắc là hôm nay (giờ Việt Nam).
  chiPhi.datMucTran({ gio: 1000 });
  require('../server/db/ket-noi').csdl().prepare('DELETE FROM agent_run').run();
  ghiChiPhi(16.5);
  const tq = chiPhi.tongQuan();
  assert.equal(tq.co_live_hom_nay, true, 'hôm nay đã có buổi live');
  assert.equal(tq.tran_ngay_ap_dung, 20);
  assert.ok(tq.ngay > 15 && tq.ngay < 20);
  assert.equal(chiPhi.kiemMucTran(), null, '16,5 USD chưa vượt trần ngày có live 20 USD');
  ghiChiPhi(4);
  assert.match(chiPhi.kiemMucTran(), /USD\/ngày/);
  assert.equal(caiDat.dungAi().ly_do.loai, 'ngày');
});

test('Dừng AI chặn AI tốn tiền; việc người tự bấm vẫn chạy; "Dừng mọi thứ" người bấm thì tin vào chờ duyệt', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { chayAgent } = require('../server/agent/runtime');
  caiDat.datDungAi(true, { ma: 'VUOT_MUC_TRAN', thong_diep: 'thử' });
  let goi = 0;
  const nha = { async goi() { goi += 1; return { goiCongCu: [], chu: '{"quyet_dinh":"de_nguoi_dan"}', goc: null, tokenVao: 1, tokenRa: 1 }; } };
  const kq = await chayAgent({ agentId: 'director', kichHoat: 'x', tinDau: 'x', nhaCungCap: { gemini: nha } });
  assert.equal(kq.loi.ma, 'DUNG_AI');
  assert.equal(goi, 0);
  const tuBam = await chayAgent({ agentId: 'director', kichHoat: 'x', tinDau: 'x', nhaCungCap: { gemini: nha }, boQuaKhanCap: true });
  assert.notEqual(tuBam.loi?.ma, 'DUNG_AI', 'việc người tự bấm (Nói với Mai, Tạo từ ảnh) vẫn chạy');
  caiDat.datDungAi(false);
});
