'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { moPhanMem } = require('./ho-tro');

// Khóa giả, dài và lạ để tìm chuỗi không bị trùng nhầm.
const KHOA_GIA = {
  GEMINI_API_KEY: 'AIzaTHU-gemini-bi-mat-9f8e7d6c5b4a',
  OPENAI_API_KEY: 'sk-THU-openai-bi-mat-1a2b3c4d5e6f',
  ANTHROPIC_API_KEY: 'sk-ant-THU-anthropic-bi-mat-0z9y8x',
};

test('API và bảo mật (mục 8, 9)', async (t) => {
  Object.assign(process.env, KHOA_GIA);
  const pm = await moPhanMem();
  t.after(pm.dong);
  const traVe = [];
  const goi = async (...a) => {
    const r = await pm.goi(...a);
    traVe.push(r.chu);
    return r;
  };

  await t.test('tạo, sửa, xem bản sửa của sản phẩm qua API; lỗi đúng dạng { loi: { ma, thong_diep } }', async () => {
    const than = { so: 12, ten: 'Sơ mi linen tay ngắn', danh_muc: 'ao_so_mi', gia: '289k', phan_loai: [{ gt1: 'Đen', gt2: 'M', ton: 5 }] };
    const tao = await goi('POST', '/api/san-pham', than);
    assert.equal(tao.ma, 201);
    const trung = await goi('POST', '/api/san-pham', than);
    assert.equal(trung.ma, 409);
    assert.deepEqual(trung.than, { loi: { ma: 'SP_TRUNG_SO', thong_diep: 'Số 12 đã có sản phẩm khác. Chọn số khác (gợi ý 13).' } });
    const sua = await goi('PUT', `/api/san-pham/${tao.than.san_pham.id}`, { gia: '299k' });
    assert.equal(sua.than.san_pham.phien_ban, 2);
    assert.equal(sua.than.san_pham.gia, 299000);
    const ban = await goi('GET', `/api/san-pham/${tao.than.san_pham.id}/ban-sua`);
    assert.equal(ban.than.ban_sua.length, 2);
    const tim = await goi('GET', '/api/san-pham?q=so%20mi%20linen&trang_thai=nhap');
    assert.equal(tim.than.san_pham.length, 1);
    assert.equal(tim.than.dem.nhap, 1);
  });

  await t.test('Sổ tay, Cài đặt, Tổng quan, thanh trạng thái', async () => {
    const st = await goi('GET', '/api/so-tay');
    assert.ok(st.than.so_tay.length >= 6);
    const cd = await goi('GET', '/api/cai-dat');
    assert.equal(cd.than.mieng.model, 'gpt-live-1');
    assert.equal(cd.than.lua_chon.mieng.length, 3);
    const tq = await goi('GET', '/api/bao-cao/tong-quan');
    assert.equal(tq.than.san_pham.nhap, 1);
    assert.equal(tq.than.so_tay_trong, st.than.so_tay.length, 'Sổ tay mồi còn trống');
    const tt = await goi('GET', '/api/trang-thai');
    assert.equal(tt.than.ai.du, true, 'đã có đủ khóa giả');
  });

  await t.test('công tắc Dừng mọi thứ có hiệu lực ngay', async () => {
    assert.equal((await goi('POST', '/api/khan-cap', { bat: true })).than.khan_cap, true);
    assert.equal((await goi('GET', '/api/trang-thai')).than.khan_cap, true);
    await goi('POST', '/api/khan-cap', { bat: false });
    assert.equal((await goi('POST', '/api/khan-cap', {})).ma, 400);
  });

  await t.test('sao lưu qua API', async () => {
    const r = await goi('POST', '/api/sao-luu', {});
    assert.equal(r.ma, 200);
    assert.ok(fs.existsSync(r.than.sao_luu.file));
    assert.equal(r.than.trang_thai.canNhac, false);
  });

  await t.test('dữ liệu hỏng, đường không có', async () => {
    const hong = await goi('POST', '/api/san-pham', '{"ten": ');
    assert.equal(hong.ma, 400);
    assert.equal(hong.than.loi.ma, 'DU_LIEU_KHONG_HOP_LE');
    const khong = await goi('GET', '/api/khong-co-duong-nay');
    assert.equal(khong.ma, 404);
    assert.equal(khong.than.loi.ma, 'KHONG_CO_DUONG');
  });

  await t.test('chỉ nhận tên máy 127.0.0.1/localhost; chặn yêu cầu ghi từ trang lạ', async () => {
    assert.equal(await pm.goiVoiHost(`127.0.0.1:${pm.cong}`, '/api/trang-thai'), 200);
    assert.equal(await pm.goiVoiHost(`localhost:${pm.cong}`, '/api/trang-thai'), 200);
    assert.equal(await pm.goiVoiHost('trang-la.com', '/api/trang-thai'), 403);
    assert.equal(await pm.goiVoiHost(`trang-la.com:${pm.cong}`, '/'), 403);
    const la = await goi('POST', '/api/khan-cap', { bat: true }, { Origin: 'https://trang-la.com' });
    assert.equal(la.ma, 403);
    assert.equal((await goi('GET', '/api/trang-thai')).than.khan_cap, false);
    const dung = await goi('POST', '/api/khan-cap', { bat: false }, { Origin: pm.goc });
    assert.equal(dung.ma, 200);
  });

  await t.test('WebSocket /ws chỉ nhận kết nối từ giao diện MOZA', async () => {
    const mo = (origin) => new Promise((ok) => {
      const ws = new WebSocket(`ws://127.0.0.1:${pm.cong}/ws`, { origin });
      ws.on('message', (d) => { ws.close(); ok(JSON.parse(d).type); });
      ws.on('error', () => ok('bi-tu-choi'));
    });
    assert.equal(await mo(pm.goc), 'xin_chao');
    assert.equal(await mo('https://trang-la.com'), 'bi-tu-choi');
  });

  await t.test('khóa: trình duyệt chỉ nhận 4 ký tự cuối; lưu khóa ghi vào .env tạm', async () => {
    const k = await goi('GET', '/api/keys');
    assert.deepEqual(k.than.gemini, { co: true, duoi: KHOA_GIA.GEMINI_API_KEY.slice(-4) });
    const moi = 'sk-ant-THU-khoa-moi-dan-vao-7q6w5e';
    const luu = await goi('POST', '/api/keys', { nha: 'anthropic', khoa: `"${moi}"` });
    assert.equal(luu.than.trangThai.anthropic.duoi, moi.slice(-4));
    assert.match(fs.readFileSync(process.env.MOZA_FILE_ENV, 'utf8'), new RegExp(`ANTHROPIC_API_KEY=${moi}`));
    KHOA_GIA.KHOA_MOI = moi;
    assert.equal((await goi('POST', '/api/keys', { nha: 'la', khoa: 'x' })).ma, 400);
  });

  await t.test('không nơi nào lộ khóa: mọi phản hồi /api, cơ sở dữ liệu, bản sao lưu', async () => {
    const khoa = Object.values(KHOA_GIA);
    for (const chu of traVe) for (const k of khoa) assert.ok(!chu.includes(k), 'phản hồi API chứa khóa');
    const files = [];
    const quet = (d) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) quet(p);
        else if (!p.endsWith('.env') && !p.endsWith('.env.tmp')) files.push(p);
      }
    };
    quet(pm.thuMuc);
    assert.ok(files.some((f) => f.endsWith('moza.db')));
    for (const f of files) {
      const noiDung = fs.readFileSync(f).toString('latin1');
      for (const k of khoa) assert.ok(!noiDung.includes(k), `${path.basename(f)} chứa khóa`);
    }
  });
});
