'use strict';

/** GD1 (F-120, F-121): bảng "AI & kênh", "Cần xử lý", Đội hình AI, Chỉ số AI 7 ngày qua API. 0 đồng, không gọi mạng. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moPhanMem } = require('./ho-tro');
const { csdl } = require('../server/db/ket-noi');

test('AI & kênh, Cần xử lý, Đội hình AI, Chỉ số AI', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);

  await t.test('bảng AI & kênh: mỗi việc AI một dòng, tên dễ hiểu, không có agent thử nghiệm', async () => {
    const r = await pm.goi('GET', '/api/cai-dat/ai-kenh');
    assert.equal(r.ma, 200);
    const tuVan = r.than.dong.find((x) => x.id === 'tu_van');
    assert.equal(tuVan.ten, 'Mai tư vấn Messenger');
    assert.equal(tuVan.bat, true);
    assert.equal(tuVan.so_lan, 0);
    assert.ok(r.than.dong.every((x) => !/_/.test(x.ten)), 'tên không chứa mã kỹ thuật');
    assert.equal(typeof r.than.tran_ngay_usd, 'number');
  });

  await t.test('Bật / Tắt ở bảng = cờ agent có sẵn (cùng chỗ runtime đọc)', async () => {
    const tat = await pm.goi('PUT', '/api/agent/tu_van', { bat: false });
    assert.equal(tat.ma, 200);
    assert.equal(tat.than.agent.bat, false);
    assert.equal((await pm.goi('GET', '/api/cai-dat/ai-kenh')).than.dong.find((x) => x.id === 'tu_van').bat, false);
    assert.equal((await pm.goi('GET', '/api/agent')).than.agents.find((a) => a.id === 'tu_van').bat, false, 'màn Trợ lý AI → Vận hành thấy cùng trạng thái');
    assert.equal((await pm.goi('PUT', '/api/agent/tu_van', { bat: 'khong' })).ma, 400);
    assert.equal((await pm.goi('PUT', '/api/agent/tu_van', { bat: true })).than.agent.bat, true);
  });

  await t.test('Cần xử lý: thiếu khóa và chưa có tài khoản nhận tiền hiện ra, mỗi dòng có nút', async () => {
    const r = await pm.goi('GET', '/api/cai-dat/can-xu-ly');
    assert.equal(r.ma, 200);
    const ma = r.than.can_xu_ly.map((x) => x.ma);
    assert.ok(ma.includes('tai_khoan'), 'chưa có tài khoản nhận tiền');
    assert.ok(r.than.can_xu_ly.every((x) => x.nut?.chu && (x.nut.muc_cai_dat || x.nut.den)), 'mỗi dòng có nút tới đúng chỗ');
    const muc = r.than.can_xu_ly.map((x) => x.muc);
    assert.deepEqual(muc, [...muc].sort((a, b) => (a === b ? 0 : a === 'do' ? -1 : 1)), 'đỏ lên trước');
  });

  await t.test('Đội hình AI: Chờ việc / Tắt / Dừng vì trần', async () => {
    let d = (await pm.goi('GET', '/api/agent/doi-hinh')).than.doi_hinh;
    assert.equal(d.find((x) => x.id === 'cohost').trang_thai, 'cho_viec');
    await pm.goi('PUT', '/api/agent/cohost', { bat: false });
    d = (await pm.goi('GET', '/api/agent/doi-hinh')).than.doi_hinh;
    assert.equal(d.find((x) => x.id === 'cohost').trang_thai, 'tat');
    await pm.goi('PUT', '/api/agent/cohost', { bat: true });
    await pm.goi('POST', '/api/dung-ai', { bat: true });
    d = (await pm.goi('GET', '/api/agent/doi-hinh')).than.doi_hinh;
    assert.equal(d.find((x) => x.id === 'cohost').trang_thai, 'dung_tran');
    await pm.goi('POST', '/api/dung-ai', { bat: false });
  });

  await t.test('Chỉ số AI 7 ngày: số khớp đếm trực tiếp từ nhật ký chạy', async () => {
    const db = csdl();
    const bay = new Date().toISOString();
    const them = (id, loi, usd, dienTap = 0) => db.prepare("INSERT INTO agent_run (id, agent_id, kich_hoat, bat_dau, ket_thuc, loi, chi_phi_usd, dien_tap) VALUES (?, 'tu_van', 'test', ?, ?, ?, ?, ?)")
      .run(id, bay, bay, loi, usd, dienTap);
    them('r1', null, 0.01); them('r2', null, 0.02); them('r3', JSON.stringify({ ma: 'X' }), 0.005); them('r4', null, 5, 1); // r4: diễn tập, không tính
    db.prepare("INSERT INTO nhat_ky_hook (id, cua, hook, quyet_dinh, ly_do, luc) VALUES ('h1', 'truoc_cong_cu', 'kiem_tra', 'chan', 'so', ?)").run(bay);
    db.prepare("INSERT INTO nhat_ky_hook (id, cua, hook, quyet_dinh, ly_do, luc) VALUES ('h2', 'truoc_cong_cu', 'luat_quyen', 'chan', 'quyen', ?)").run(bay);
    const r = (await pm.goi('GET', '/api/agent/chi-so?ngay=7')).than;
    assert.equal(r.xong, 2);
    assert.equal(r.loi, 1);
    assert.equal(r.luot_chay, 3);
    assert.equal(r.ty_le_loi, 33.3);
    assert.ok(Math.abs(r.chi_phi_usd - 0.035) < 1e-9, 'diễn tập không tính');
    assert.deepEqual(r.cau_bi_chan, { tong: 2, so_khong_co_trong_nguon: 1, luat_an_toan: 1, khac: 0 });
  });
});
