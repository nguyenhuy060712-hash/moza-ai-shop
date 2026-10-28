'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam } = require('./ho-tro');

test('Skill (F-11) và lời dặn vai trò (F-12)', async (t) => {
  const { dong } = await moCSDLTam();
  t.after(dong);
  const skill = require('../server/nghiep-vu/skill');
  const vaiTro = require('../server/nghiep-vu/vai-tro');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const luatQuyen = require('../server/nghiep-vu/luat-quyen');
  const SKILL_MAU = require('../server/cau-hinh/skill-mau.json').skill;
  const LOI_DAN_MAU = require('../server/cau-hinh/loi-dan-mau.json');

  await t.test('có sẵn 22 Skill mẫu bán hàng và 17 lời dặn mẫu, gieo lần nữa không nhân đôi', () => {
    skill.gieoSkill();
    vaiTro.gieoVaiTro();
    assert.equal(SKILL_MAU.length, 22);
    assert.deepEqual(skill.danhSach().map((s) => s.id), SKILL_MAU.map((s) => s.id));
    assert.ok(skill.danhSach().every((s) => s.phien_ban === 1 && !s.co_nhap));
    assert.deepEqual(vaiTro.danhSach().map((v) => [v.agent_id, v.phien_ban]), [['director', 1], ['cohost', 1], ['tu_van', 1], ['mieng', 1],
      ['mieng_dan', 1], ['nguoi_dong_vai', 1], ['soat_san_pham', 1], ['bai_hoc', 1], ['soan_kich_ban', 1], ['doc_anh', 1], ['quan_ly', 1], ['doc_chot', 1], ['tim_mau', 1], ['khach_gia', 1], ['soan_bai', 1], ['tong_ket', 1], ['nhin_mon', 1]]);
    for (const id of Object.keys(vaiTro.AI)) assert.equal(typeof LOI_DAN_MAU[id], 'string', `thiếu lời dặn mẫu ${id}`);
    for (const id of ['soat-san-pham', 'doc-anh-san-pham', 'len-don', 'tu-van-size', 'quan-ly-kho']) assert.ok(skill.laySkill(id), id);
  });

  await t.test('lời dặn thay {ten_ai}, {ten_shop}; không còn chỗ trống chưa thay', () => {
    assert.match(vaiTro.loiDan('cohost').noi_dung, /Bạn soạn câu cho Mai - Trợ lý bán hàng/, '{ten_ai} được thay');
    assert.match(vaiTro.loiDan('director').noi_dung, /phòng livestream bán hàng của shop/, 'chưa đặt tên shop → "shop"');
    caiDat.datBanHang({ ten_shop: 'Moza Shop' });
    assert.match(vaiTro.loiDan('director').noi_dung, /phòng livestream bán hàng của Moza Shop/);
    assert.match(vaiTro.loiDan('mieng_dan').noi_dung, /người dẫn chính của buổi livestream/, 'lời dặn riêng khi Mai dẫn chính');
    for (const id of Object.keys(vaiTro.AI)) assert.doesNotMatch(vaiTro.loiDan(id).noi_dung, /\{[a-z_]+\}/, id);
    caiDat.datBanHang({ ten_shop: '' });
  });

  await t.test('mục lục Skill theo Agent: Co-host chỉ thấy Skill được cấp, không kèm nội dung', () => {
    assert.deepEqual(skill.mucLuc('cohost').map((s) => s.id),
      ['gioi-thieu-san-pham', 'tu-van-size', 'phoi-do', 'gia-ship-thanh-toan', 'doi-tra-bao-quan', 'hoi-lai-khi-thieu', 'go-luong-lu']);
    assert.ok(skill.mucLuc('cohost').every((s) => !('cach_lam' in s)), 'mục lục không kèm nội dung');
    assert.deepEqual(skill.mucLuc('quan_ly').map((s) => s.id), ['quan-ly-kho', 'tra-don-bao-cao', 'dien-thong-tin-shop']);
    assert.ok(skill.mucLuc('tu_van').some((s) => s.id === 'len-don'));
    assert.throws(() => skill.moSkill('len-don', 'cohost'), (e) => e.ma === 'SKILL_KHONG_DUOC_CAP');
    assert.throws(() => skill.moSkill('soat-san-pham', 'tu_van'), (e) => e.ma === 'SKILL_KHONG_DUOC_CAP', 'Skill của agent soát không cấp cho ai');
    assert.equal(skill.moSkill('soat-san-pham', null).ten, 'Soát sản phẩm', 'agent soát mở thẳng theo id');
  });

  await t.test('sửa Skill: lưu nháp không đổi bản đang dùng; kích hoạt → bản mới; quay lại → bản trước', () => {
    const id = 'tu-van-size';
    skill.luuNhap(id, { cach_lam: 'Cách làm mới', vi_du_dung: 'đúng', vi_du_sai: 'sai' });
    assert.equal(skill.moSkill(id, 'cohost').phien_ban, 1, 'nháp chưa được dùng');
    skill.luuNhap(id, { cach_lam: 'Cách làm mới hơn' });
    assert.equal(skill.xem(id).lich_su.length, 2, 'lưu nháp lần nữa ghi đè nháp, không tạo bản thứ ba');
    skill.kichHoat(id);
    const moi = skill.moSkill(id, 'cohost');
    assert.equal(moi.phien_ban, 2);
    assert.equal(moi.cach_lam, 'Cách làm mới hơn');
    skill.quayLai(id);
    assert.equal(skill.moSkill(id, 'cohost').phien_ban, 1, '"Quay lại bản trước" có tác dụng ngay lần mở kế tiếp');
    assert.throws(() => skill.quayLai(id), (e) => e.ma === 'KHONG_TIM_THAY');
    assert.throws(() => skill.kichHoat(id), (e) => e.ma === 'KHONG_TIM_THAY', 'không còn nháp');
    skill.kichHoat(id, 2);
    assert.equal(skill.moSkill(id, 'cohost').phien_ban, 2);
  });

  await t.test('sửa mục lục Skill: tên, "dùng khi", Agent được dùng; kiểm dữ liệu vào', () => {
    skill.suaMucLuc('soat-san-pham', { agent_ids: ['director'] });
    assert.ok(skill.mucLuc('director').some((s) => s.id === 'soat-san-pham'));
    skill.suaMucLuc('xu-ly-het-hang', { agent_ids: ['tu_van', 'quan_ly'] });
    assert.ok(skill.mucLuc('quan_ly').some((s) => s.id === 'xu-ly-het-hang'), 'Nói với Mai được cấp Skill');
    assert.throws(() => skill.suaMucLuc('soat-san-pham', { agent_ids: ['mieng'] }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => skill.suaMucLuc('soat-san-pham', { ten: '' }), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => skill.xem('khong-co'), (e) => e.ma === 'KHONG_TIM_THAY');
  });

  await t.test('sửa lời dặn vai trò không đổi danh sách công cụ hay luật quyền của Agent', () => {
    luatQuyen.datMuc('lay_san_pham', 'hoi');
    const truoc = { agent: caiDat.layAgent('director'), luat: luatQuyen.danhSachLuat() };
    vaiTro.luuNhap('director', 'Bạn là người điều phối. Bản thử của {ten_ai}.');
    vaiTro.kichHoat('director');
    assert.equal(vaiTro.loiDan('director').phien_ban, 2);
    assert.equal(vaiTro.loiDan('director').noi_dung, 'Bạn là người điều phối. Bản thử của Mai - Trợ lý bán hàng.');
    assert.deepEqual(caiDat.layAgent('director'), truoc.agent);
    assert.deepEqual(luatQuyen.danhSachLuat(), truoc.luat);
    vaiTro.quayLai('director');
    assert.equal(vaiTro.loiDan('director').phien_ban, 1);
    assert.equal(vaiTro.layBan('director', 2).noi_dung, 'Bạn là người điều phối. Bản thử của {ten_ai}.', 'bản cũ vẫn đọc lại được');
    assert.throws(() => vaiTro.luuNhap('director', '  '), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    assert.throws(() => vaiTro.xem('ai_la'), (e) => e.ma === 'KHONG_TIM_THAY');
    assert.throws(() => vaiTro.xem('soat_tin'), (e) => e.ma === 'KHONG_TIM_THAY', 'agent soát cũ đã đổi tên');
    luatQuyen.datMuc('lay_san_pham', null);
  });

  await t.test('khởi động lại (gieo lần nữa): lời dặn đã sửa tay và bản nháp giữ nguyên, không tạo thêm bản', () => {
    vaiTro.luuNhap('mieng', 'Lời dặn chủ shop tự viết cho {ten_ai}.');
    vaiTro.kichHoat('mieng');
    vaiTro.luuNhap('cohost', 'Bản nháp đang soạn');
    const soBan = vaiTro.xem('mieng').lich_su.length;
    const soBanSkill = skill.xem('tu-van-size').lich_su.length;
    vaiTro.gieoVaiTro();
    skill.gieoSkill();
    assert.equal(vaiTro.xem('mieng').dang_dung.noi_dung, 'Lời dặn chủ shop tự viết cho {ten_ai}.');
    assert.equal(vaiTro.xem('mieng').lich_su.length, soBan);
    assert.equal(vaiTro.xem('cohost').nhap.noi_dung, 'Bản nháp đang soạn', 'bản nháp không bị đụng');
    assert.equal(skill.xem('tu-van-size').lich_su.length, soBanSkill);
    assert.equal(skill.moSkill('tu-van-size', 'cohost').cach_lam, 'Cách làm mới hơn');
    vaiTro.quayLai('mieng');
    assert.equal(vaiTro.xem('mieng').dang_dung.noi_dung, LOI_DAN_MAU.mieng, '"Quay lại bản trước" về bản mẫu');
  });
});
