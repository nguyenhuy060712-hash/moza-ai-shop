'use strict';

// Nhãn "Trợ lý AI · Phụ trách", cách xưng hô (SPEC.md F-75, #103).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

test('nhãn AI: hiện khi có phiên mà AI không tắt, đổi theo người phụ trách qua /ws, không có công tắc tắt', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const live = require('../server/nghiep-vu/live');
  const { nhanAi, ManHinhSanPham } = require('../server/man-hinh-san-pham');
  taoSanPhamMau();
  assert.equal(nhanAi().hien, false, 'chưa có phiên thì không hiện');
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y' });
  assert.deepEqual(nhanAi(), { hien: true, chu: 'Trợ lý AI của shop' });
  caiDat.datBanHang({ ten_shop: 'Nắng Shop' });
  assert.equal(nhanAi().chu, 'Trợ lý AI của Nắng Shop');
  // Đổi người phụ trách → sự kiện mhsp.nhan_ai ngay (không chờ).
  const { EventEmitter } = require('node:events');
  const bus = new EventEmitter();
  const phat = [];
  const mh = new ManHinhSanPham({ phat: (type, d) => phat.push({ type, ...d }), bus, obs: Object.assign(new EventEmitter(), { trangThai: () => ({ ket_noi: false }), dong() {} }) });
  t.after(() => mh.dong());
  caiDat.datBanHang({ phu_trach: 'Nguyễn Lan' });
  bus.emit('su_kien', 'cai_dat.ban_hang', {});
  await new Promise((r) => setTimeout(r, 5));
  const e = phat.find((x) => x.type === 'mhsp.nhan_ai');
  assert.deepEqual([e.hien, e.chu], [true, 'Trợ lý AI · Phụ trách: Nguyễn Lan']);
  assert.equal(mh.trangThai().nhan_ai.chu, 'Trợ lý AI · Phụ trách: Nguyễn Lan', '/api/man-hinh có nhãn');
  live.ketThucPhien(p.id);
  const p2 = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'tat' });
  assert.equal(nhanAi().hien, false, 'phiên "Tắt AI" thì không có AI nào lên hình');
  live.ketThucPhien(p2.id);
  // Không API, không ô cài đặt nào tắt được nhãn.
  const goc = path.join(__dirname, '..');
  const tim = (thu) => fs.readdirSync(thu, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? tim(path.join(thu, x.name)) : [path.join(thu, x.name)]));
  for (const f of [...tim(path.join(goc, 'server/api')), ...tim(path.join(goc, 'public/js'))]) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /an_nhan_ai|tat_nhan_ai|nhan_ai\s*[:=]\s*(false|0)/, `${f} không được có công tắc tắt nhãn AI`);
  }
  for (const f of ['public/thanh-chu.html', 'public/man-hinh-san-pham.html']) assert.match(fs.readFileSync(path.join(goc, f), 'utf8'), /id="nhan-ai"/);
});

test('cách xưng hô: câu mẫu tin cho khách điền đúng; không câu nào nói khách "chưa trả lời / chưa mở / chưa xác nhận"', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const cm = require('../server/nghiep-vu/cau-mau-khach');
  assert.match(cm.cau('ngung_lien_he'), /^Dạ mình ghi nhận rồi, từ giờ mình không nhắn chủ động cho bạn nữa\. Cần gì bạn cứ nhắn/);
  caiDat.datBanHang({ xung_ho: 'em_anh_chi', ten_shop: 'Nắng' });
  assert.match(cm.cau('ngung_lien_he'), /^Dạ em ghi nhận rồi, từ giờ em không nhắn chủ động cho anh\/chị nữa/);
  assert.match(cm.cau('chot_test', { gio: '20:01' }), /Tin tự động từ trợ lý AI của Nắng\.$/);
  assert.throws(() => caiDat.datBanHang({ xung_ho: 'may_tao' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
  for (const { khoa, cau } of cm.tatCa()) {
    assert.doesNotMatch(require('../server/nghiep-vu/chung').boDau(cau), /chua (tra loi|mo|xac nhan)/, `${khoa}: câu trung tính (F-70)`);
    assert.ok((cau.match(/nhé/g) || []).length <= 1, `${khoa}: rất ít chữ "nhé"`);
  }
});
