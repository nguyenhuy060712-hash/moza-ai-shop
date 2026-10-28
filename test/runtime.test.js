'use strict';

/**
 * Runtime Agent (F-07), công cụ và luật quyền (F-08), hook (F-09), nhật ký (F-13), chi phí (F-14).
 * Dùng nhà cung cấp AI giả: không gọi mạng, không tốn tiền.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

const PHIEU = {
  type: 'object',
  properties: { cau: { type: 'string' }, trich_dan: { type: 'array', items: { type: 'object', properties: { nguon: { type: 'string' }, doan: { type: 'string' } }, required: ['nguon', 'doan'], additionalProperties: false } } },
  required: ['cau', 'trich_dan'],
  additionalProperties: false,
};

/** Nhà cung cấp giả: trả lần lượt theo kịch bản; ghi lại mọi yêu cầu nhận được. */
function nhaGia(kichBan) {
  const yeuCau = [];
  let i = 0;
  return {
    yeuCau,
    async goi(o) {
      yeuCau.push({ model: o.model, mucSuyNghi: o.mucSuyNghi, heThong: o.heThong, lichSu: JSON.parse(JSON.stringify(o.lichSu)), congCu: o.congCu.map((c) => c.ten) });
      const b = kichBan[Math.min(i, kichBan.length - 1)];
      i += 1;
      const r = typeof b === 'function' ? await b(o) : b;
      if (r instanceof Error) throw r;
      return { goiCongCu: [], chu: '', goc: null, tokenVao: 1000, tokenRa: 200, ...r };
    },
  };
}

const goiCC = (ten, thamSo, id = `g_${ten}`) => ({ goiCongCu: [{ id, ten, thamSo }], goc: { gia: true } });
const phieu = (o) => ({ chu: JSON.stringify(o) });

test('runtime Agent', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const { csdl } = require('../server/db/ket-noi');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const luatQuyen = require('../server/nghiep-vu/luat-quyen');
  const nhatKy = require('../server/nghiep-vu/nhat-ky');
  const choDuyet = require('../server/nghiep-vu/cho-duyet');
  const chiPhi = require('../server/nghiep-vu/chi-phi');
  const { LoiAi } = require('../server/agent/nha-cung-cap/chung');
  const { dangKy, danhSachCongCu } = require('../server/agent/cong-cu/danh-sach');
  const { chayAgent, datLaiTrangThaiNha } = require('../server/agent/runtime');
  const { xuLyChoDuyet, thucHienCongCu } = require('../server/agent/thuc-hien');
  const hook = require('../server/agent/hook/cua');

  taoSanPhamMau();
  const GIA = { nguon: '12', doan: 'Giá: 289.000đ' };

  // Công cụ thử có ảnh hưởng thật, đưa câu ra ngoài qua Bộ kiểm tra — đứng thay cho gui_messenger của M5.
  let daGui = 0;
  dangKy({
    ten: 'thu_gui', moTa: 'Gửi một câu (công cụ thử).', nhom: 'co_anh_huong', macDinh: 'cho_phep',
    thamSo: { type: 'object', properties: { cau: { type: 'string' }, trich_dan: PHIEU.properties.trich_dan }, required: ['cau', 'trich_dan'], additionalProperties: false },
    cauRaNgoai: (ts) => ({ cau: ts.cau, trich_dan: ts.trich_dan, kenh: 'messenger' }),
    chay() { daGui += 1; return { da_gui: true }; },
  });
  const datCongCu = (id, ds) => csdl().prepare('UPDATE agent SET cong_cu = ? WHERE id = ?').run(JSON.stringify(ds), id);
  datCongCu('tu_van', ['lay_san_pham', 'thu_gui']);

  const chay = (o) => chayAgent({ agentId: 'cohost', kichHoat: 'thử', tinDau: 'Câu hỏi: áo 12 giá bao nhiêu?', luocDo: PHIEU, ...o });
  t.beforeEach(() => { datLaiTrangThaiNha(); caiDat.datKhanCap(false); });

  await t.test('vòng AI → công cụ → phiếu; nhật ký đủ: bản lời dặn, sản phẩm + bản sửa, token, chi phí', async () => {
    const g = nhaGia([goiCC('lay_san_pham', { so: 12 }), phieu({ cau: 'Áo 12 giá 289.000đ ạ.', trich_dan: [GIA] })]);
    const kq = await chay({ nhaCungCap: { gemini: g } });
    assert.equal(kq.ok, true, JSON.stringify(kq.loi));
    assert.equal(kq.ketQua.cau, 'Áo 12 giá 289.000đ ạ.');
    assert.equal(kq.soBuoc, 2);
    assert.equal(g.yeuCau[0].model, 'gemini-3.8-flash');
    assert.equal(g.yeuCau[0].mucSuyNghi, 'thap');
    assert.deepEqual(g.yeuCau[0].congCu, ['lay_san_pham', 'tim_trong_san_pham', 'mo_so_tay', 'de_xuat_cau_song'], 'đúng danh sách công cụ của Co-host');
    assert.match(g.yeuCau[1].lichSu.at(-1).ketQua[0].noiDung, /Giá: 289\.000đ/);
    const { run, cong_cu: cc } = nhatKy.xemRun(kq.runId);
    assert.equal(run.vai_tro_phien_ban, 1);
    assert.equal(run.san_pham_phien_ban, 1);
    assert.ok(run.san_pham_id);
    assert.equal(run.token_vao, 2000);
    assert.equal(run.token_ra, 400);
    assert.ok(Math.abs(run.chi_phi_usd - chiPhi.tinhChiPhi('gemini-3.8-flash', 2000, 400)) < 1e-12);
    assert.equal(cc.length, 1);
    assert.equal(cc[0].cong_cu, 'lay_san_pham');
  });

  await t.test('gọi công cụ ngoài danh sách → bị từ chối, có ghi lý do; AI nhận lỗi kèm cách sửa', async () => {
    const g = nhaGia([goiCC('muc_luc_san_pham', {}), phieu({ cau: 'Dạ.', trich_dan: [] })]);
    const kq = await chay({ nhaCungCap: { gemini: g } });
    assert.equal(kq.ok, true);
    const cc = nhatKy.xemRun(kq.runId).cong_cu[0];
    assert.equal(cc.bi_tu_choi, true);
    assert.match(cc.ly_do, /CONG_CU_KHONG_DUOC_CAP/);
    assert.match(g.yeuCau[1].lichSu.at(-1).ketQua[0].noiDung, /Chỉ dùng: lay_san_pham/);
  });

  await t.test('luật "Hỏi" → tạo mục chờ duyệt, không làm; duyệt thì mới làm', async () => {
    luatQuyen.datMuc('thu_gui', 'hoi');
    const g = nhaGia([goiCC('thu_gui', { cau: 'Chào bạn.', trich_dan: [] }), phieu({ cau: 'xong', trich_dan: [] })]);
    const kq = await chayAgent({ agentId: 'tu_van', kichHoat: 'thử', tinDau: 'gửi', luocDo: PHIEU, nhaCungCap: { gemini: g } });
    assert.equal(kq.ok, true);
    assert.equal(daGui, 0);
    const [muc] = choDuyet.danhSach();
    assert.equal(muc.hanh_dong, 'thu_gui');
    assert.equal(muc.run_id, kq.runId);
    const xong = await xuLyChoDuyet(muc.id, true);
    assert.equal(xong.trang_thai, 'duyet');
    assert.equal(daGui, 1);
    await assert.rejects(xuLyChoDuyet(muc.id, true), (e) => e.ma === 'DA_XU_LY', 'bấm hai lần không làm hai lần');
    luatQuyen.datMuc('thu_gui', 'cam');
    const cam = await thucHienCongCu({ ten: 'thu_gui', thamSo: { cau: 'a', trich_dan: [] } });
    assert.equal(cam.loi.ma, 'CAM');
    luatQuyen.datMuc('thu_gui', null);
  });

  await t.test('"Dừng mọi thứ" bật → Agent không chạy; hành động có ảnh hưởng thành chờ duyệt', async () => {
    caiDat.datKhanCap(true);
    const g = nhaGia([phieu({ cau: 'x', trich_dan: [] })]);
    const kq = await chay({ nhaCungCap: { gemini: g } });
    assert.equal(kq.loi.ma, 'KHAN_CAP_DANG_BAT');
    assert.equal(g.yeuCau.length, 0);
    const truoc = choDuyet.demCho();
    const r = await thucHienCongCu({ ten: 'thu_gui', thamSo: { cau: 'Chào bạn.', trich_dan: [] } });
    assert.equal(r.loi.ma, 'KHAN_CAP_DANG_BAT');
    assert.equal(choDuyet.demCho(), truoc + 1);
    assert.equal(daGui, 1, 'không gửi');
    const doc = await thucHienCongCu({ ten: 'lay_san_pham', thamSo: { so: 12 } });
    assert.ok(doc.ketQua, 'công cụ đọc vẫn chạy');
  });

  await t.test('việc người dùng tự bấm (Nói với Mai, Tạo từ ảnh) vẫn chạy khi "Dừng mọi thứ" bật; ảnh kèm đi vào lượt đầu', async () => {
    caiDat.datKhanCap(true);
    const anh = [{ mime: 'image/jpeg', base64: '/9j/AAAA' }];
    const g = nhaGia([phieu({ cau: 'Dạ.', trich_dan: [] })]);
    const kq = await chay({ nhaCungCap: { gemini: g }, boQuaKhanCap: true, anh });
    assert.equal(kq.ok, true);
    assert.deepEqual(g.yeuCau[0].lichSu[0].anh, anh);
    caiDat.datKhanCap(false);
  });

  await t.test('Bộ kiểm tra chặn câu sai số trước khi gửi; lỗi kèm cách sửa về cho AI', async () => {
    const r = await thucHienCongCu({ ten: 'thu_gui', thamSo: { cau: 'Áo 12 giá 350.000đ ạ.', trich_dan: [GIA] } });
    assert.equal(r.loi.ma, 'KIEM_TRA_CHAN');
    assert.match(r.loi.thong_diep, /K3/);
    assert.equal(daGui, 1);
  });

  await t.test('vượt số bước → dừng với VUOT_SO_BUOC', async () => {
    const g = nhaGia([goiCC('lay_san_pham', { so: 12 })]);
    const kq = await chay({ nhaCungCap: { gemini: g } });
    assert.equal(kq.loi.ma, 'VUOT_SO_BUOC');
    assert.equal(kq.soBuoc, 2, 'Co-host tối đa 2 bước (A.7)');
  });

  await t.test('quá thời gian → dừng, không có kết quả', async () => {
    const treo = (o) => new Promise((_, loi) => o.tinHieu.addEventListener('abort', () => loi(new LoiAi('quá giờ', { nha: 'gemini', ma: 'QUA_THOI_GIAN' }))));
    const kq = await chay({ nhaCungCap: { gemini: nhaGia([treo]) }, gioiHan: { giay: 0.2 } });
    assert.equal(kq.loi.ma, 'QUA_THOI_GIAN');
    assert.equal(kq.ketQua, null);
  });

  await t.test('nhà chính lỗi → dùng ngay nhà dự phòng; lỗi 3 lần liên tiếp → đi thẳng nhà dự phòng', async () => {
    const hong = nhaGia([new LoiAi('Gemini đang lỗi (503)', { nha: 'gemini' })]);
    const tot = nhaGia([phieu({ cau: 'Dạ.', trich_dan: [] })]);
    for (let i = 0; i < 3; i++) {
      const kq = await chay({ nhaCungCap: { gemini: hong, openai: tot } });
      assert.equal(kq.ok, true);
      assert.equal(kq.nha, 'openai');
      assert.equal(kq.model, 'gpt-6-luna');
    }
    assert.equal(hong.yeuCau.length, 3);
    await chay({ nhaCungCap: { gemini: hong, openai: tot } });
    assert.equal(hong.yeuCau.length, 3, 'lần thứ 4 không gọi nhà chính nữa');
  });

  await t.test('phiếu sai lược đồ → làm lại 1 lần; vẫn sai → PHIEU_SAI', async () => {
    const g1 = nhaGia([{ chu: 'không phải JSON' }, phieu({ cau: 'Dạ.', trich_dan: [] })]);
    const kq1 = await chay({ nhaCungCap: { gemini: g1 } });
    assert.equal(kq1.ok, true);
    assert.match(g1.yeuCau[1].lichSu.at(-1).chu, /Phiếu kết quả chưa đúng/);
    const kq2 = await chay({ nhaCungCap: { gemini: nhaGia([phieu({ cau: 'Dạ.' })]) } });
    assert.equal(kq2.loi.ma, 'PHIEU_SAI');
    assert.match(kq2.loi.thong_diep, /thiếu ô "trich_dan"/);
    assert.ok(nhatKy.xemRun(kq2.runId).hook.some((h) => h.hook === 'kiem_phieu' && h.quyet_dinh === 'chan'));
  });

  await t.test('đổi model trong Cài đặt → lần chạy kế tiếp dùng model mới, không khởi động lại', async () => {
    caiDat.suaAgent('cohost', { nha: 'openai', model: 'gpt-6-sol', muc_suy_nghi: 'vua' });
    const g = nhaGia([phieu({ cau: 'Dạ.', trich_dan: [] })]);
    await chay({ nhaCungCap: { openai: g } });
    assert.equal(g.yeuCau[0].model, 'gpt-6-sol');
    assert.equal(g.yeuCau[0].mucSuyNghi, 'vua');
    caiDat.suaAgent('cohost', { nha: 'gemini', model: 'gemini-3.8-flash', muc_suy_nghi: 'thap' });
  });

  await t.test('luật nâng lên Claude: Bộ kiểm tra chặn một câu của Tư vấn viên → bước sau dùng claude-sonnet-5', async () => {
    const gem = nhaGia([goiCC('thu_gui', { cau: 'Áo 12 giá 399k ạ.', trich_dan: [GIA] })]);
    const cla = nhaGia([phieu({ cau: 'xong', trich_dan: [] })]);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-khoa-thu-123456';
    try {
      const kq = await chayAgent({ agentId: 'tu_van', kichHoat: 'thử', tinDau: 'hỏi giá', luocDo: PHIEU, nhaCungCap: { gemini: gem, anthropic: cla } });
      assert.equal(kq.ok, true);
      assert.equal(cla.yeuCau[0].model, 'claude-sonnet-5');
      assert.equal(cla.yeuCau[0].mucSuyNghi, 'vua');
      assert.match(cla.yeuCau[0].lichSu.at(-1).ketQua[0].noiDung, /KIEM_TRA_CHAN/, 'Claude thấy lý do bị chặn');
      assert.equal(nhatKy.xemRun(kq.runId).run.ly_do_nang, 'Bộ kiểm tra vừa chặn một câu');
    } finally {
      process.env.ANTHROPIC_API_KEY = '';
    }
  });

  await t.test('chưa có khóa Anthropic → lượt nâng dùng gpt-6-sol (bản 2.4)', async () => {
    const gem = nhaGia([goiCC('thu_gui', { cau: 'Áo 12 giá 399k ạ.', trich_dan: [GIA] })]);
    const oai = nhaGia([phieu({ cau: 'xong', trich_dan: [] })]);
    const kq = await chayAgent({ agentId: 'tu_van', kichHoat: 'thử', tinDau: 'hỏi giá', luocDo: PHIEU, nhaCungCap: { gemini: gem, openai: oai } });
    assert.equal(kq.ok, true);
    assert.equal(oai.yeuCau[0].model, 'gpt-6-sol');
  });

  await t.test('mỗi lần chạy một ngữ cảnh riêng: hai việc chạy cùng lúc không lẫn vào nhau', async () => {
    const cham = (o) => new Promise((ok) => setTimeout(() => ok({ chu: JSON.stringify({ cau: o.lichSu[0].chu, trich_dan: [] }) }), 20));
    const g = nhaGia([cham]);
    const [a, b] = await Promise.all([
      chay({ tinDau: 'Hội thoại A: chị Lan hỏi size áo 12', nhaCungCap: { gemini: g } }),
      chay({ tinDau: 'Hội thoại B: anh Hùng hỏi phí ship', nhaCungCap: { gemini: g } }),
    ]);
    assert.equal(a.ketQua.cau, 'Hội thoại A: chị Lan hỏi size áo 12');
    assert.equal(b.ketQua.cau, 'Hội thoại B: anh Hùng hỏi phí ship');
    for (const y of g.yeuCau) {
      const chu = JSON.stringify(y.lichSu);
      assert.ok(!(chu.includes('Hội thoại A') && chu.includes('Hội thoại B')));
    }
  });

  await t.test('lời dặn chỉ chứa mục lục Skill, không chứa nội dung Skill; tắt hook không bắt buộc thì không nạp', async () => {
    const g = nhaGia([phieu({ quyet_dinh: 'x' })]);
    await chayAgent({ agentId: 'director', kichHoat: 'thử', tinDau: 'x', mucLuc: { skill: true, sanPham: true }, nhaCungCap: { gemini: g } });
    const ht = g.yeuCau[0].heThong;
    assert.match(ht, /Bạn là người điều phối/);
    assert.match(ht, /gom-cau-hoi: Gom và hiểu câu hỏi từ bình luận — dùng khi: Có loạt bình luận mới/);
    assert.match(ht, /Áo số 12 · Sơ mi linen tay ngắn · 289.000đ · còn 20/);
    assert.doesNotMatch(ht, /Đọc các bình luận mới cùng lúc/, 'nội dung Skill chưa mở thì không có');
    assert.doesNotMatch(ht, /len-don: Lên đơn/, 'Skill không cấp cho Director thì không có');
    hook.datBat('nap_muc_luc', false);
    const g2 = nhaGia([phieu({ quyet_dinh: 'x' })]);
    await chayAgent({ agentId: 'director', kichHoat: 'thử', tinDau: 'x', mucLuc: { skill: true }, nhaCungCap: { gemini: g2 } });
    assert.doesNotMatch(g2.yeuCau[0].heThong, /Mục lục Skill/);
    hook.datBat('nap_muc_luc', true);
    assert.throws(() => hook.datBat('kiem_tra', false), (e) => e.ma === 'HOOK_BAT_BUOC');
  });

  await t.test('mở Skill qua công cụ: ghi bản Skill đã dùng; Skill không được cấp thì bị từ chối', async () => {
    const g = nhaGia([goiCC('mo_skill', { id: 'gom-cau-hoi' }), goiCC('mo_skill', { id: 'len-don' }), phieu({ quyet_dinh: 'x' })]);
    const kq = await chayAgent({ agentId: 'director', kichHoat: 'thử', tinDau: 'x', nhaCungCap: { gemini: g } });
    assert.deepEqual(kq.nguon.skill, { 'gom-cau-hoi': 1 });
    assert.deepEqual(nhatKy.xemRun(kq.runId).run.skill_phien_ban, { 'gom-cau-hoi': 1 });
    assert.match(g.yeuCau[2].lichSu.at(-1).ketQua[0].noiDung, /SKILL_KHONG_DUOC_CAP/);
  });

  await t.test('vượt mức trần chi phí → tự bật "Dừng AI" (không phải "Dừng mọi thứ"), có lý do; lượt AI sau bị bỏ; Chạy AI tiếp', async () => {
    chiPhi.datMucTran({ gio: 0.0001 });
    const kq = await chay({ nhaCungCap: { gemini: nhaGia([phieu({ cau: 'Dạ.', trich_dan: [] })]) } });
    assert.equal(kq.ok, true);
    assert.equal(caiDat.khanCap(), false, 'F-72: "Dừng mọi thứ" chỉ khi người bấm');
    assert.equal(caiDat.dungAi().bat, true);
    assert.equal(caiDat.dungAi().ly_do.ma, 'VUOT_MUC_TRAN');
    assert.match(caiDat.dungAi().ly_do.thong_diep, /vượt mức trần.*chốt đơn vẫn chạy/);
    const sau = await chay({ nhaCungCap: { gemini: nhaGia([phieu({ cau: 'Dạ.', trich_dan: [] })]) } });
    assert.equal(sau.loi.ma, 'DUNG_AI', 'AI tốn tiền không chạy khi Dừng AI');
    chiPhi.datMucTran({ gio: 8 });
    caiDat.datDungAi(false);
  });

  await t.test('nhật ký không bao giờ chứa khóa API', async () => {
    const khoa = 'AIzaSyTHU-KHOA-BI-MAT-1234567890';
    process.env.GEMINI_API_KEY = khoa;
    const loi = new LoiAi(`lỗi gọi https://x/models?key=${khoa} với khóa ${khoa}`, { nha: 'gemini' });
    const kq = await chay({ nhaCungCap: { gemini: nhaGia([loi]) } });
    assert.equal(kq.loi.ma, 'AI_LOI');
    delete process.env.GEMINI_API_KEY;
    const db = csdl();
    for (const bang of ['agent_run', 'goi_cong_cu', 'nhat_ky_hook', 'cho_duyet']) {
      const chu = JSON.stringify(db.prepare(`SELECT * FROM ${bang}`).all());
      assert.ok(!chu.includes(khoa), `bảng ${bang} lộ khóa`);
    }
  });

  await t.test('không có công cụ nào xóa dữ liệu, sửa sản phẩm, sửa giá, sửa Sổ tay hay sửa Skill', () => {
    for (const c of danhSachCongCu()) {
      assert.doesNotMatch(c.ten, /xoa|delete|sua_san_pham|sua_gia|sua_so_tay|sua_skill|sua_luat|sua_don_gia/, c.ten);
      assert.ok(['doc', 'noi_bo', 'co_anh_huong'].includes(c.nhom));
    }
  });
});
