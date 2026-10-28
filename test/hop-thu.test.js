'use strict';

/**
 * Hộp thư bán hàng (F-24 → F-32, #34, #35, #37, #65): khách nhắn Messenger / bình luận qua Facebook giả, Tư vấn viên giả
 * (nhà cung cấp giả gọi công cụ — không gọi mạng, không tốn tiền) trả lời có trích dẫn; luật cứng của Hộp thư.
 * Đơn hàng trong Hộp thư (cap_nhat_don, xem_don, nhắn chủ động về đơn, gửi ảnh, tìm mẫu theo ảnh) ở hop-thu-don.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, moPhanMem, taoSanPhamMau } = require('./ho-tro');

/** Nhà cung cấp giả: mỗi lần gọi chạy hàm `buoc(o, lan)` để quyết trả gì. */
function nhaGia(buoc) {
  const yeuCau = [];
  return {
    yeuCau,
    async goi(o) {
      yeuCau.push({ model: o.model, heThong: o.heThong, lichSu: JSON.parse(JSON.stringify(o.lichSu)) });
      const r = await buoc(o, yeuCau.length);
      return { goiCongCu: [], chu: '', goc: null, tokenVao: 500, tokenRa: 100, ...r };
    },
  };
}
const goiCC = (ten, thamSo) => ({ goiCongCu: [{ id: `g_${ten}_${Math.random()}`, ten, thamSo }], goc: {} });
const phieu = (tomTat = 'ok') => ({ chu: JSON.stringify({ xong: true, tom_tat: tomTat }) });
const soBuocTrongLuot = (o) => o.lichSu.filter((x) => x.vai === 'ai').length;

const GIA = { nguon: '12', doan: 'Giá: 289.000đ' };

test('Hộp thư bán hàng tự động', async (t) => {
  const db = await moCSDLTam();
  t.after(() => db.dong());
  for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];
  // Các ca dưới đây kiểm luật nâng model của BÁN THẬT nhưng chạy trên hội thoại diễn tập (Facebook giả): tạm tắt "model rẻ
  // khi tập" (#88) trong file này; ca model rẻ khi tập ở test/dien-tap-ban-hang.test.js.
  const macDinh = require('../server/nghiep-vu/cai-dat').MAC_DINH;
  const modelTap = macDinh.dien_tap_model;
  macDinh.dien_tap_model = {};
  t.after(() => { macDinh.dien_tap_model = modelTap; });
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const kh = require('../server/nghiep-vu/khach');
  const don = require('../server/nghiep-vu/don');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const { csdl } = require('../server/db/ket-noi');
  const { FacebookGia } = require('../server/facebook/gia');
  const { HopThuTuDong } = require('../server/hop-thu');
  const { thucHienCongCu } = require('../server/agent/thuc-hien');
  const fbPage = require('../server/nghiep-vu/fb-page');

  const a12 = taoSanPhamMau();
  caiDat.datBanHang({ ten_shop: 'Shop Hoa', phi_ship: 30000 });
  const fb = new FacebookGia({ tinhHuong: 'de' });
  for (const p of fb.pages) fbPage.luu(p.id, p.ten);
  let buoc = () => phieu();
  const ai = nhaGia((o, lan) => buoc(o, lan));
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi: () => fb, nhaCungCap: { gemini: ai, openai: ai, anthropic: ai }, gomMs: 30, chuKyMs: 3600000 });
  // Chỉ nghe Facebook giả, không bật nhịp 30 giây (nhịp tự chạy sẽ chen vào giữa test).
  fb.on('su_kien', ht.ngheGia);
  t.after(() => ht.dung());
  const chatCua = (ten, pageId = 'page_gia') => fb.chat.get(`${pageId}|${fb.psidCua(pageId, ten)}`) || [];
  const htCua = (ten, pageId = 'page_gia') => hopThu.danhSach({ dienTap: true }).find((h) => h.fb_thread_id === fb.psidCua(pageId, ten));
  const tuVan = () => caiDat.layAgent('tu_van');
  const congCu = (ten, thamSo, hoiThoaiId) => thucHienCongCu({ ten, thamSo, agent: tuVan(), nguCanh: { hoiThoaiId, layKetNoi: () => fb } });

  await t.test('hỏi giá → trả lời đúng thẻ sản phẩm, có trích dẫn, tự giới thiệu là trợ lý tự động của shop', async () => {
    buoc = (o) => (soBuocTrongLuot(o) === 0
      ? goiCC('gui_messenger', { noi_dung: 'Dạ áo số 12 giá 289.000đ ạ.', trich_dan: [GIA] })
      : phieu('Lan hỏi giá áo 12, đã báo giá.'));
    fb.khachNhan({ ten: 'Lan Nguyễn', noi_dung: 'Chào shop, áo 12 giá bao nhiêu ạ?' });
    await ht.choXong();
    const chat = chatCua('Lan Nguyễn');
    assert.equal(chat.length, 2);
    assert.match(chat[1].noi_dung, /^Mình là Mai \(trợ lý tự động\) của Shop Hoa\. Dạ áo số 12 giá 289\.000đ ạ\.$/);
    const h = htCua('Lan Nguyễn');
    assert.equal(h.trang_thai, 'cho_phan_hoi');
    assert.equal(h.da_gioi_thieu_ai, true);
    assert.equal(h.tom_tat, 'Lan hỏi giá áo 12, đã báo giá.');
    const ra = hopThu.tinCuaHoiThoai(h.id).filter((x) => x.chieu === 'ra');
    assert.equal(ra[0].gui_boi, 'ai');
    assert.ok(ra[0].agent_run_id, 'tin AI gửi luôn có agent_run_id (mục 7)');
    assert.deepEqual(ra[0].trich_dan, [GIA]);
    // Ngữ cảnh: mục lục sản phẩm, phí ship từ Cài đặt, lời khách được đóng khung.
    const yc = ai.yeuCau.at(-2);
    assert.match(yc.heThong, /Áo số 12 · Sơ mi linen tay ngắn · 289\.000đ · còn 20/);
    assert.match(yc.heThong, /## Bán hàng \(trích với nguon "cai_dat"\)\nPhí ship: 30\.000đ/);
    assert.match(yc.lichSu[0].chu, /<loi_nguoi_nhan ten="Lan Nguyễn">Chào shop, áo 12 giá bao nhiêu ạ\?/);
  });

  await t.test('Bộ kiểm tra chặn câu sai giá; thử lại bằng model nâng vẫn sai → không gửi gì, Cần người', async () => {
    buoc = (o) => (soBuocTrongLuot(o) < 2
      ? goiCC('gui_messenger', { noi_dung: 'Dạ áo 12 chỉ 250.000đ thôi ạ.', trich_dan: [GIA] })
      : phieu());
    fb.khachNhan({ ten: 'Minh Khang', noi_dung: 'Áo 12 bớt được không shop?' });
    await ht.choXong();
    const h = hopThu.layHoiThoai(htCua('Minh Khang').id);
    assert.equal(chatCua('Minh Khang').filter((x) => x.tu === 'page').length, 0, 'câu sai giá không ra Facebook');
    assert.equal(h.trang_thai, 'can_nguoi');
    assert.match(h.ly_do_can_nguoi, /Bộ kiểm tra/);
    assert.equal(h.dang_nang, true, 'lượt sau vẫn dùng model nâng');
    assert.equal(ai.yeuCau.at(-1).model, 'gpt-6-sol', 'chưa có khóa Anthropic → lượt nâng dùng gpt-6-sol');
    assert.match(ai.yeuCau.at(-1).lichSu.at(-1).ketQua[0].noiDung, /KIEM_TRA_CHAN.*K3/);
  });

  await t.test('công cụ xem_khach, gan_nhan (số sản phẩm), tao_viec chỉ làm trên hội thoại đang xử lý', async () => {
    const h = htCua('Lan Nguyễn');
    assert.deepEqual((await congCu('xem_khach', {}, h.id)).ketQua, { co_ho_so: false });
    const nhan = await congCu('gan_nhan', { nhan: ['Hoi gia', 'muon_mua'], uu_tien: 2, so: 12 }, h.id);
    assert.deepEqual(nhan.ketQua.nhan, ['hoi_gia', 'muon_mua']);
    const sau = hopThu.layHoiThoai(h.id);
    assert.equal(sau.uu_tien, 2);
    assert.equal(sau.san_pham_goi_y, a12.san_pham.id, 'gan_nhan so = 12 → món khách đang hỏi');
    const v = await congCu('tao_viec', { loai: 'bo_sung_thong_tin', noi_dung: 'Bổ sung thông tin áo số 12: độ dày vải', han_luc: '' }, h.id);
    const viec = kh.layViec(v.ketQua.viec_id);
    assert.equal(viec.hoi_thoai_id, h.id);
    assert.equal(viec.cho_ai, 'nguoi');
    assert.equal(viec.tao_boi, 'ai');
    // Có hồ sơ (khách đã cho số lúc lên đơn): xem được tên, số che bớt, địa chỉ để hỏi "giao về … như lần trước?".
    kh.taoKhach({ ten: 'Lan', sdt: '0912 345 678', diaChi: '12 Trần Phú, Hà Đông', hoiThoaiId: h.id, taoBoi: 'nguoi', dienTap: true });
    const xem = (await congCu('xem_khach', {}, h.id)).ketQua;
    assert.equal(xem.co_ho_so, true);
    assert.equal(xem.so_dien_thoai, '0912 *** 678');
    assert.equal(xem.dia_chi, '12 Trần Phú, Hà Đông');
    assert.deepEqual(xem.don, []);
    const khongHt = await thucHienCongCu({ ten: 'xem_khach', thamSo: {}, agent: tuVan(), nguCanh: {} });
    assert.equal(khongHt.loi.ma, 'KHONG_CO_HOI_THOAI');
    const spam = await congCu('gan_nhan', { nhan: ['spam'], uu_tien: 0, so: 0 }, htCua('Minh Khang').id);
    assert.ok(!spam.loi);
    assert.equal(hopThu.layHoiThoai(htCua('Minh Khang').id).trang_thai, 'spam');
  });

  await t.test('người nhắn 5 tin liên tiếp → AI chờ gom rồi trả lời một lần (F-31)', async () => {
    const truoc = ai.yeuCau.length;
    buoc = (o) => (soBuocTrongLuot(o) === 0 ? goiCC('gui_messenger', { noi_dung: 'Dạ Mai trả lời gộp các câu của chị nhé.', trich_dan: [] }) : phieu());
    ht.gomMs = 200;
    for (const c of ['shop ơi', 'cho em hỏi', 'áo 12 có màu đen không', 'chất vải gì', 'giá sao ạ']) {
      fb.khachNhan({ ten: 'Thu Hà', noi_dung: c });
      await new Promise((r) => setTimeout(r, 20));
    }
    await ht.choXong();
    ht.gomMs = 30;
    assert.equal(ai.yeuCau.length - truoc, 2, 'một lượt: một bước gửi + một bước phiếu');
    assert.match(ai.yeuCau.at(-2).lichSu[0].chu, /giá sao ạ/);
    assert.equal(chatCua('Thu Hà').filter((x) => x.tu === 'page').length, 1);
  });

  await t.test('"cho tôi gặp người thật" → Cần người, AI không chạy (F-31)', async () => {
    const truoc = ai.yeuCau.length;
    fb.khachNhan({ ten: 'Hùng Trần', noi_dung: 'Thôi cho tôi gặp người thật đi' });
    await ht.choXong();
    assert.equal(htCua('Hùng Trần').trang_thai, 'can_nguoi');
    assert.equal(ai.yeuCau.length, truoc);
  });

  await t.test('"xóa dữ liệu của tôi" → Cần người (F-54, mục 9)', async () => {
    const truoc = ai.yeuCau.length;
    fb.khachNhan({ ten: 'Người Xóa', noi_dung: 'Shop ơi xóa dữ liệu của tôi đi nhé' });
    await ht.choXong();
    const h = htCua('Người Xóa');
    assert.equal(h.trang_thai, 'can_nguoi');
    assert.match(h.ly_do_can_nguoi, /xóa dữ liệu/);
    assert.equal(ai.yeuCau.length, truoc);
  });

  await t.test('spam → chỉ gắn nhãn, không gọi AI (F-31)', async () => {
    const truoc = ai.yeuCau.length;
    fb.khachNhan({ ten: 'Quảng cáo', noi_dung: 'Vay tiền nhanh giải ngân trong ngày, inbox zalo' });
    await ht.choXong();
    assert.equal(htCua('Quảng cáo').trang_thai, 'spam');
    assert.equal(ai.yeuCau.length, truoc);
  });

  await t.test('người trả lời trên hộp thư Page (tin vọng, app khác) → AI tạm dừng ở hội thoại đó (#34)', async () => {
    const h = htCua('Thu Hà');
    fb.emit('su_kien', { loai: 'tin_vong', page_id: 'page_gia', psid: h.fb_thread_id, mid: 'mid_nguoi_1', noi_dung: 'Chị Hà ơi, em gọi chị nhé', luc: new Date().toISOString(), app_id: '263902037430900' });
    await new Promise((r) => setTimeout(r, 20));
    const sau = hopThu.layHoiThoai(h.id);
    assert.equal(sau.ai_tam_dung, true);
    assert.equal(sau.trang_thai, 'nguoi_dang_xu_ly');
    assert.equal(hopThu.tinCuaHoiThoai(h.id).at(-1).gui_boi, 'nguoi');
    const truoc = ai.yeuCau.length;
    fb.khachNhan({ ten: 'Thu Hà', noi_dung: 'Vâng ạ' });
    await ht.choXong();
    assert.equal(ai.yeuCau.length, truoc, 'AI không trả lời khi người đang giữ');
    // Giao lại cho AI → AI chạy, tin đầu tiên tự giới thiệu lại.
    buoc = (o) => (soBuocTrongLuot(o) === 0 ? goiCC('gui_messenger', { noi_dung: 'Dạ Mai đây ạ.', trich_dan: [] }) : phieu());
    ht.giaoLaiAi(h.id);
    await ht.choXong();
    assert.match(chatCua('Thu Hà').at(-1).noi_dung, /^Mình là Mai \(trợ lý tự động\) của Shop Hoa\./);
  });

  await t.test('người gửi từ MOZA → AI tạm dừng; câu của người không qua Bộ kiểm tra (F-26)', async () => {
    const h = htCua('Lan Nguyễn');
    const kq = await ht.nguoiGui(h.id, 'Chị ơi áo 12 shop bớt cho chị 20k nha');
    assert.ok(!kq.loi, 'người tự gõ số không có nguồn vẫn gửi được');
    const sau = hopThu.layHoiThoai(h.id);
    assert.equal(sau.ai_tam_dung, true);
    assert.equal(hopThu.tinCuaHoiThoai(h.id).filter((x) => x.chieu === 'ra').at(-1).gui_boi, 'nguoi');
    const aiGui = await congCu('gui_messenger', { noi_dung: 'Dạ.', trich_dan: [] }, h.id);
    assert.equal(aiGui.loi.ma, 'AI_TAM_DUNG');
    ht.giaoLaiAi(h.id);
    await ht.choXong();
  });

  await t.test('Messenger ngoài 24 giờ → NGOAI_CUA_SO_24H, không gửi (F-25)', async () => {
    const h = htCua('Lan Nguyễn');
    csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE id = ?').run(new Date(Date.now() - 25 * 3600000).toISOString(), h.id);
    const truoc = chatCua('Lan Nguyễn').length;
    const kq = await congCu('gui_messenger', { noi_dung: 'Dạ.', trich_dan: [] }, h.id);
    assert.equal(kq.loi.ma, 'NGOAI_CUA_SO_24H');
    assert.equal(chatCua('Lan Nguyễn').length, truoc);
    csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE id = ?').run(new Date().toISOString(), h.id);
  });

  await t.test('mất mạng giữa lúc gửi → "không rõ", Cần người, không tự gửi lại; "Thử lại" gửi đúng một lần (F-25, mục 9)', async () => {
    fb.hongGui = true;
    buoc = (o) => (soBuocTrongLuot(o) === 0 ? goiCC('gui_messenger', { noi_dung: 'Dạ chị chờ Mai xíu nhé.', trich_dan: [] }) : phieu());
    fb.khachNhan({ ten: 'Nam Phạm', noi_dung: 'Có ai không ạ' });
    await ht.choXong();
    fb.hongGui = false;
    const h = htCua('Nam Phạm');
    assert.equal(h.trang_thai, 'can_nguoi');
    const loi = hopThu.tinCuaHoiThoai(h.id).find((x) => x.trang_thai_gui === 'khong_ro');
    assert.ok(loi);
    assert.equal(chatCua('Nam Phạm').filter((x) => x.tu === 'page').length, 0);
    await ht.thuLai(loi.id);
    assert.equal(chatCua('Nam Phạm').filter((x) => x.tu === 'page').length, 1);
    await assert.rejects(ht.thuLai(loi.id), (e) => e.ma === 'KHONG_THU_LAI_DUOC');
  });

  await t.test('bình luận bài lộ số → ẩn; trả lời công khai xin số bị chặn (K5); nhắn riêng 1 lần, ghi PSID; lần 2 và quá 7 ngày bị chặn', async () => {
    buoc = (o) => {
      const n = soBuocTrongLuot(o);
      if (n === 0) return goiCC('tra_loi_binh_luan', { noi_dung: 'Chị để lại số điện thoại ở đây nha.', trich_dan: [] });
      if (n === 1) return goiCC('nhan_rieng', { noi_dung: 'Chào chị, Mai nhắn riêng để tư vấn áo 12 nhé.', trich_dan: [] });
      return phieu();
    };
    const ev = fb.khachBinhLuanBai({ ten: 'Hoa Lê', page_id: 'page_gia_2', noi_dung: 'Áo 12 còn không, sđt em 0987 654 321' });
    await ht.choXong();
    assert.ok(fb.daAn.has(ev.comment_id), 'bình luận lộ số đã bị ẩn');
    assert.equal(fb.traLoi.length, 0, 'câu công khai xin số điện thoại không ra Facebook');
    const h = hopThu.danhSach({ dienTap: true }).find((x) => x.kenh === 'binh_luan' && x.page_id === 'page_gia_2');
    assert.ok(h, 'hội thoại thuộc đúng Page thứ hai (#37)');
    const rieng = fb.dsChat().filter((c) => c.page_id === 'page_gia_2');
    assert.equal(rieng.length, 1, 'nhắn riêng bằng Page thứ hai');
    assert.match(rieng[0].tin[0].noi_dung, /^Mình là Mai \(trợ lý tự động\)/, 'nhắn riêng mở hội thoại mới: luôn tự giới thiệu');
    assert.equal(hopThu.layNguoi(h.nguoi_fb_id).psid, fb.psidCua("page_gia_2", "Hoa Lê"), 'PSID Facebook trả về được gắn vào người bình luận (#65)');
    const lan2 = await congCu('nhan_rieng', { noi_dung: 'Lần nữa', trich_dan: [] }, h.id);
    assert.equal(lan2.loi.ma, 'DA_NHAN_RIENG');
    const ev2 = fb.khachBinhLuanBai({ ten: 'Cũ', noi_dung: 'mẫu này còn không' });
    await ht.choXong();
    const h2 = hopThu.danhSach({ dienTap: true }).find((x) => x.kenh === 'binh_luan' && x.ten === 'Cũ');
    csdl().prepare('UPDATE tin_nhan SET luc = ? WHERE fb_comment_id = ?').run(new Date(Date.now() - 8 * 86400000).toISOString(), ev2.comment_id);
    const cu = await congCu('nhan_rieng', { noi_dung: 'Chào', trich_dan: [] }, h2.id);
    assert.ok(['QUA_7_NGAY', 'DA_NHAN_RIENG'].includes(cu.loi.ma));
    const sai = await congCu('gui_messenger', { noi_dung: 'Dạ.', trich_dan: [] }, h2.id);
    assert.ok(['SAI_KENH', 'NGOAI_CUA_SO_24H'].includes(sai.loi.ma), 'hội thoại bình luận không gửi Messenger thẳng được');
  });

  await t.test('ngữ cảnh tách biệt: hai hội thoại xử lý song song không lẫn tin (F-07)', async () => {
    buoc = async (o) => {
      await new Promise((r) => setTimeout(r, 30));
      return soBuocTrongLuot(o) === 0 ? goiCC('gui_messenger', { noi_dung: 'Dạ.', trich_dan: [] }) : phieu();
    };
    const truoc = ai.yeuCau.length;
    fb.khachNhan({ ten: 'Người A', noi_dung: 'BÍ MẬT CỦA A' });
    fb.khachNhan({ ten: 'Người B', noi_dung: 'BÍ MẬT CỦA B' });
    await ht.choXong();
    const moi = ai.yeuCau.slice(truoc);
    assert.ok(moi.length >= 4);
    for (const y of moi) {
      const s = JSON.stringify(y.lichSu) + y.heThong;
      assert.ok(!(s.includes('BÍ MẬT CỦA A') && s.includes('BÍ MẬT CỦA B')));
    }
  });

  await t.test('hội thoại dài: ngữ cảnh = tóm tắt + 20 tin gần nhất, vẫn giữ tên, số điện thoại, địa chỉ khách (F-30)', async () => {
    const h = htCua('Lan Nguyễn');
    for (let i = 0; i < 100; i++) {
      csdl().prepare("INSERT INTO tin_nhan (id, hoi_thoai_id, chieu, gui_boi, loai, noi_dung, luc) VALUES (?, ?, 'vao', 'khach', 'tin', ?, ?)")
        .run(`tn_dai_${i}`, h.id, `tin cũ số ${i}`, new Date(Date.now() - (200 - i) * 60000).toISOString());
    }
    hopThu.datTomTat(h.id, 'Lan cao 1m58, hỏi áo 12 màu đen.');
    let nguCanhAi = null;
    buoc = (o) => { nguCanhAi = o; return phieu('tóm tắt mới'); };
    fb.khachNhan({ ten: 'Lan Nguyễn', noi_dung: 'Em hỏi lại chút ạ' });
    await ht.choXong();
    const chu = nguCanhAi.heThong + nguCanhAi.lichSu[0].chu;
    assert.match(chu, /Tóm tắt phần hội thoại cũ\nLan cao 1m58, hỏi áo 12 màu đen\./);
    assert.match(chu, /## Điều không được quên[^]*Tên: Lan · Số điện thoại: 0912 345 678 · Địa chỉ giao: 12 Trần Phú, Hà Đông/);
    assert.ok(!chu.includes('tin cũ số 70'), 'tin cũ không đưa lại');
    assert.ok((nguCanhAi.lichSu[0].chu.match(/\[.*?\] (\(id|Bạn|Nhân viên)/g) || []).length <= 20);
    assert.equal(ai.yeuCau.at(-1).model, 'gpt-6-sol', 'hội thoại > 20 tin → nâng (chưa có khóa Anthropic thì gpt-6-sol)');
  });

  await t.test('bình luận live "Chờ Tư vấn viên" → hội thoại gắn món khách hỏi, Tư vấn viên nhắn riêng, ghi PSID (F-17, #65)', async () => {
    const live = require('../server/nghiep-vu/live');
    const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
    const p = live.taoPhien({ kich_ban_id: kb.id, dien_tap: true });
    fb.batDauLive();
    live.ganLive(p.id, fb.live.id);
    const bl = live.themBinhLuan(p.id, { fb_id: 'blf_1', ten: 'Tuấn', noi_dung: 'Áo 12 còn size L không ạ, nhắn riêng em với', luc_fb: new Date().toISOString(), nguoi_fb_id: 'ng_1' });
    live.datXuLy(p.id, [bl.id], 'cho_tu_van');
    let heThong = '';
    buoc = (o) => {
      heThong = o.heThong;
      return soBuocTrongLuot(o) === 0 ? goiCC('nhan_rieng', { noi_dung: 'Chào Tuấn, Mai nhắn riêng để tư vấn size áo 12 nhé.', trich_dan: [] }) : phieu();
    };
    ht.nhanChoTuVan();
    await ht.choXong();
    const h = hopThu.danhSach({ dienTap: true }).find((x) => x.kenh === 'binh_luan_live');
    assert.ok(h);
    assert.equal(h.phien_live_id, p.id);
    assert.equal(h.san_pham_goi_y, a12.san_pham.id, 'bình luận nhắc "áo 12" → hội thoại gắn áo 12');
    assert.match(heThong, /## Thẻ sản phẩm khách có thể đang hỏi \(trích với nguon "12"\)\nÁo số 12 · Sơ mi linen tay ngắn/);
    assert.equal(live.layBinhLuan(bl.id).xu_ly, 'da_tu_van');
    assert.ok(hopThu.daNhanRieng('blf_1'));
    assert.equal(hopThu.layNguoi(h.nguoi_fb_id).psid, 'psidgia_page_gia_bl_blf_1');
    fb.ketThucLive();
    live.ketThucPhien(p.id);
  });

  await t.test('gộp hồ sơ giữ dữ liệu cả hai; xóa dữ liệu thay nội dung, giữ con số đếm; khách còn đơn chưa xong thì chưa xóa (F-54)', () => {
    const a = kh.taoKhach({ ten: 'Bình', sdt: '0901111222', taoBoi: 'nguoi' }).khach;
    const b = kh.taoKhach({ ten: 'Bình', taoBoi: 'nguoi' });
    assert.ok(b.nghi_trung?.length, 'cùng tên khác số → báo nghi trùng');
    kh.ghiBoNho(b.khach.id, { loai: 'nguoi_do_noi', noiDung: 'Mặc size L' });
    const giu = kh.gopKhach(a.id, b.khach.id);
    assert.equal(kh.chiTiet(giu.id).bo_nho.length, 1, 'bộ nhớ của hồ sơ bị gộp chuyển sang');
    assert.equal(kh.layKhach(b.khach.id).gop_vao, a.id);
    assert.equal(kh.taoKhach({ ten: 'Bình N', sdt: '+84901111222', taoBoi: 'nguoi' }).ket_qua, 'da_lien_ket', 'chống trùng theo số điện thoại');

    // Khách còn đơn chưa xong → không xóa được; hủy đơn rồi xóa, đơn vẫn đếm trong báo cáo (ẩn danh).
    const d = don.taoDon({ mon: [{ phan_loai_id: a12.pl('Trắng', 'M').id, so_luong: 1 }], nguon: 'nguoi', khachId: a.id, tenNhan: 'Bình', sdtNhan: '+84901111222' });
    assert.throws(() => kh.xoaDuLieu(a.id), (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE');
    don.doiTrangThai(d.id, 'da_huy', { nguon: 'nguoi' });
    const soDon = csdl().prepare('SELECT COUNT(*) AS n FROM don').get().n;
    kh.xoaDuLieu(a.id);
    assert.equal(don.layDon(d.id).ten_nhan, '');
    assert.equal(don.layDon(d.id).sdt_nhan, null);
    assert.equal(csdl().prepare('SELECT COUNT(*) AS n FROM don').get().n, soDon, 'báo cáo vẫn giữ con số đếm');

    const lan = htCua('Lan Nguyễn');
    kh.xoaDuLieu(lan.khach_id);
    const u = kh.layKhach(lan.khach_id);
    assert.equal(u.sdt, null);
    assert.equal(u.ten, '');
    assert.equal(u.dia_chi, '');
    assert.ok(hopThu.tinCuaHoiThoai(lan.id).every((x) => x.noi_dung === hopThu.DA_XOA));
    assert.equal(kh.danhSachBoNho(lan.khach_id).length, 0);
  });

  await t.test('tự xóa sau 12 tháng không liên lạc; khách còn đơn chưa xong thì giữ (#35)', () => {
    const cu = new Date(Date.now() - 400 * 86400000).toISOString();
    const x = kh.taoKhach({ ten: 'Cũ Một', sdt: '0933000111', taoBoi: 'nguoi' }).khach;
    const y = kh.taoKhach({ ten: 'Cũ Hai', sdt: '0933000222', taoBoi: 'nguoi' }).khach;
    csdl().prepare('UPDATE khach SET tao_luc = ? WHERE id IN (?, ?)').run(cu, x.id, y.id);
    don.taoDon({ mon: [{ phan_loai_id: a12.pl('Trắng', 'L').id, so_luong: 1 }], nguon: 'nguoi', khachId: y.id });
    const kq = kh.tuXoaQuaHan();
    assert.ok(kq.khach >= 1);
    assert.ok(kh.layKhach(x.id).xoa_luc);
    assert.equal(kh.layKhach(y.id).xoa_luc, null);
  });
});

test('tin diễn tập không bao giờ đi ra Facebook thật (F-15, mục 7)', async (t) => {
  const pm = await moPhanMem();
  t.after(() => pm.dong());
  const { dichVu } = require('../server/dich-vu');
  const { layKetNoi } = dichVu();
  assert.equal(layKetNoi({ dien_tap: true }).ten, 'gia');
  assert.equal(layKetNoi(null).ten, 'gia');
  assert.equal(layKetNoi({ dien_tap: false }).ten, 'that');
  // API Hộp thư chạy được, không lộ lỗi.
  const r = await pm.goi('GET', '/api/hoi-thoai?loc=can_nguoi');
  assert.equal(r.ma, 200);
  assert.ok(Array.isArray(r.than.hoi_thoai));
  const s = await pm.goi('POST', '/api/dien-tap/nhan-tin', { ten: 'Thử', noi_dung: 'xin chào' }, { Origin: pm.goc });
  assert.equal(s.ma, 201);
});
