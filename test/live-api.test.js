'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { moPhanMem, taoSanPhamMau } = require('./ho-tro');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

// Hỏi lại tới khi điều kiện đúng (phòng live quét Facebook giả mỗi giây).
async function choDen(dieuKien, toiDaMs = 5000) {
  const bd = Date.now();
  for (;;) {
    const kq = await dieuKien();
    if (kq) return kq;
    if (Date.now() - bd > toiDaMs) throw new Error('Quá thời gian chờ');
    await cho(150);
  }
}

test('chuỗi live diễn tập qua API: kịch bản → phiên → live giả → bình luận → kết thúc', async (t) => {
  const pm = await moPhanMem();
  t.after(pm.dong);

  taoSanPhamMau(); // cùng tiến trình với máy chủ test: tạo thẳng sản phẩm mẫu (Đang bán cần ảnh)
  const { than: { kich_ban: kb } } = await pm.goi('POST', '/api/kich-ban/tao-nhanh');
  assert.equal(kb.doan.length, 3);

  const tao = await pm.goi('POST', '/api/live/phien', { kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  assert.equal(tao.ma, 201);
  const id = tao.than.phien.id;

  assert.equal((await pm.goi('POST', '/api/dien-tap/binh-luan', { ten: 'A', noi_dung: 'x' })).than.loi.ma, 'KHONG_CO_LIVE_GIA');
  assert.equal((await pm.goi('POST', '/api/dien-tap/live', { bat: true })).than.dang_phat, true);
  await choDen(async () => (await pm.goi('GET', '/api/live/phien/hien-tai')).than.phien?.trang_thai === 'dang_live');

  await pm.goi('POST', `/api/live/phien/${id}/doan`, { doan: 1 });
  assert.equal((await pm.goi('POST', '/api/dien-tap/binh-luan', { ten: 'Lan', noi_dung: 'giá bao nhiêu?' })).ma, 201);
  const ht = await choDen(async () => {
    const r = (await pm.goi('GET', '/api/live/phien/hien-tai')).than;
    return r.binh_luan.length ? r : null;
  });
  assert.equal(ht.binh_luan[0].so_doan, 12, 'đoạn 2 đang nói áo số 12');
  assert.deepEqual(ht.binh_luan[0].nhan, ['cau_hoi', 'ib_gia'], 'hỏi giá chung: nhắn thẻ bằng mã và vẫn cho Director (F-70)');
  assert.equal((await pm.goi('POST', '/api/dien-tap/chay', { id: 'khong-co' })).ma, 404);

  // Đổi sang "Co-host được nói" giữa phiên: không có khóa AI nên miệng không mở được → tự về "Chỉ gợi ý" và báo đỏ (F-22).
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const doi = await pm.goi('PUT', `/api/live/phien/${id}/che-do`, { che_do_ai: 'noi', mieng: 'gpt-live-1' });
  assert.equal(doi.ma, 200);
  const sau = (await pm.goi('GET', '/api/live/phien/hien-tai')).than;
  assert.equal(sau.phien.che_do_ai, 'goi_y');
  assert.equal(sau.mieng.trang_thai, 'tat');
  assert.match(sau.ai.bao.noi_dung, /Mai chưa nói được .*khóa OpenAI/);
  assert.equal(sau.ai.bao.muc, 'do');
  assert.equal((await pm.goi('PUT', `/api/live/phien/${id}/che-do`, { che_do_ai: 'tat' })).ma, 400);

  // Mai dẫn chính (bản 2.7, #47): "dan" lưu thành Co-host được nói + mai_dan; không có khóa → cũng về "Chỉ gợi ý", bỏ mai_dan.
  const dan = await pm.goi('PUT', `/api/live/phien/${id}/che-do`, { che_do_ai: 'dan', mieng: 'gpt-live-1' });
  assert.equal(dan.ma, 200);
  assert.equal(dan.than.phien.che_do_ai, 'noi');
  assert.equal(dan.than.phien.mai_dan, true);
  const sauDan = (await pm.goi('GET', '/api/live/phien/hien-tai')).than;
  assert.equal(sauDan.phien.che_do_ai, 'goi_y');
  assert.equal(sauDan.phien.mai_dan, false);
  const tiep = await pm.goi('POST', `/api/live/phien/${id}/mai-dan-tiep`);
  assert.equal(tiep.ma, 409, '"▶ Mai dẫn tiếp" khi Mai không dẫn chính');
  assert.equal(tiep.than.loi.ma, 'KHONG_CO_LIVE');

  // Đội AI dẫn (bản 2.9, #49): "doi" lưu thành Chỉ gợi ý + doi_ai; MOZA cầm nhịp đội ngay; DỪNG AI / "▶ Dẫn tiếp" tới đội.
  const doiAi = await pm.goi('PUT', `/api/live/phien/${id}/che-do`, { che_do_ai: 'doi' });
  assert.equal(doiAi.ma, 200);
  assert.equal(doiAi.than.phien.che_do_ai, 'goi_y');
  assert.equal(doiAi.than.phien.doi_ai, true);
  assert.equal((await pm.goi('GET', '/api/live/phien/hien-tai')).than.doi_ai.trang_thai, 'dang_dan');
  assert.equal((await pm.goi('POST', `/api/live/phien/${id}/dung-ai`)).ma, 200);
  assert.equal((await pm.goi('GET', '/api/live/phien/hien-tai')).than.doi_ai.trang_thai, 'tam_dung');
  const tiepDoi = await pm.goi('POST', `/api/live/phien/${id}/mai-dan-tiep`);
  assert.equal(tiepDoi.ma, 200);
  assert.equal(tiepDoi.than.doi_ai.trang_thai, 'dang_dan');
  assert.equal((await pm.goi('PUT', `/api/live/phien/${id}/che-do`, { che_do_ai: 'goi_y' })).than.phien.doi_ai, false);
  assert.equal((await pm.goi('GET', '/api/live/phien/hien-tai')).than.doi_ai.trang_thai, 'tat');

  await pm.goi('POST', '/api/dien-tap/live', { bat: false });
  await choDen(async () => (await pm.goi('GET', '/api/live/phien/hien-tai')).than.phien === null);
  const ds = (await pm.goi('GET', '/api/live/phien')).than.phien;
  assert.equal(ds[0].trang_thai, 'xong');
  assert.match(ds[0].tom_tat, /1 bình luận/);
});
