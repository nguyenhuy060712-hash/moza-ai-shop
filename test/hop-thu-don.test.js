'use strict';

/**
 * Đơn hàng trong Hộp thư (F-53 → F-56, F-63, #64, #73, #78, #79): công cụ `cap_nhat_don`, `xem_don`, `gui_anh_san_pham`,
 * `tim_mau_theo_anh` của Tư vấn viên; nhắn chủ động về đơn (`nhacDon`, F-32). Facebook giả, nhà cung cấp AI giả —
 * không gọi mạng, không tốn tiền.
 *
 * Dữ liệu: áo số 12 (289.000đ, Đen/Trắng × M/L, tồn 5 mỗi ô), phí ship 30.000đ, ngưỡng khách từng hoàn = 2.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau, ANH_GIA } = require('./ho-tro');

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
const ketQuaCuoi = (o) => {
  const c = [...o.lichSu].reverse().find((x) => x.vai === 'cong_cu');
  return c ? JSON.parse(c.ketQua[0].noiDung) : null;
};
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

test('Đơn hàng trong Hộp thư', async (t) => {
  const db = await moCSDLTam();
  t.after(() => db.dong());
  for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const kh = require('../server/nghiep-vu/khach');
  const don = require('../server/nghiep-vu/don');
  const kho = require('../server/nghiep-vu/kho');
  const sp = require('../server/nghiep-vu/san-pham');
  const caiDat = require('../server/nghiep-vu/cai-dat');
  const live = require('../server/nghiep-vu/live');
  const { csdl } = require('../server/db/ket-noi');
  const { gio } = require('../server/nghiep-vu/chung');
  const { FacebookGia } = require('../server/facebook/gia');
  const { HopThuTuDong } = require('../server/hop-thu');
  const { thucHienCongCu } = require('../server/agent/thuc-hien');
  const fbPage = require('../server/nghiep-vu/fb-page');

  const a12 = taoSanPhamMau();
  const pl = (m, c) => a12.pl(m, c).id;
  const con = (m, c) => kho.conHang(a12.san_pham.id).find((p) => p.id === pl(m, c)).con_ban_duoc;
  caiDat.datBanHang({ ten_shop: 'Shop Hoa', phi_ship: 30000 });
  const fb = new FacebookGia({ tinhHuong: 'de' });
  for (const p of fb.pages) fbPage.luu(p.id, p.ten);
  let buoc = () => phieu();
  const ai = nhaGia((o, lan) => buoc(o, lan));
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi: () => fb, nhaCungCap: { gemini: ai, openai: ai, anthropic: ai }, gomMs: 30, chuKyMs: 3600000 });
  fb.on('su_kien', ht.ngheGia); // không bật nhịp 30 giây: nhacDon do test gọi
  t.after(() => ht.dung());

  const chatCua = (ten) => (fb.chat.get(`page_gia|${fb.psidCua('page_gia', ten)}`) || []).filter((x) => x.tu === 'page');
  const tuVan = () => caiDat.layAgent('tu_van');
  const congCu = (ten, thamSo, hoiThoaiId) => thucHienCongCu({ ten, thamSo, agent: tuVan(), nguCanh: { hoiThoaiId, layKetNoi: () => fb } });
  const capNhat = (hoiThoaiId, o) => congCu('cap_nhat_don', {
    viec: '', mon: '', mon_moi: '', ten: '', so_dien_thoai: '', dia_chi: '', thanh_toan: '', bang_chung_tin_nhan_id: '', ...o }, hoiThoaiId);
  /** Khách nhắn Messenger (ghi thẳng vào Hộp thư, không gọi AI). Chờ vài mili giây để tin mới hơn lần sửa món trước. */
  async function khachNoi(ten, noiDung) {
    await cho(5);
    const kq = hopThu.nhanSuKien({ loai: 'tin_nhan', page_id: 'page_gia', psid: fb.psidCua('page_gia', ten), mid: `mid_${Math.random()}`,
      noi_dung: noiDung, luc: gio(), ten }, { dienTap: true });
    return { h: kq.hoiThoai, tinId: kq.tinNhanId };
  }
  const dongDon = (d) => don.layDon(d).dong.map((x) => [x.phan_loai_id, x.so_luong]);

  let ha;
  let donHa;
  let nguoiLa;

  await t.test('tạo đơn: cần id tin của chính khách làm bằng chứng; giữ hàng; khối đơn có dòng tổng tiền để trích', async () => {
    ha = await khachNoi('Hà Phương', 'Chị lấy áo 12 đen M nha');
    nguoiLa = await khachNoi('Người Lạ', 'Shop ơi');
    assert.equal((await capNhat(ha.h.id, { viec: 'tao', mon: 'áo 12 đen M' })).loi.ma, 'THIEU_BANG_CHUNG');
    assert.equal((await capNhat(ha.h.id, { viec: 'tao', mon: 'áo 12 đen M', bang_chung_tin_nhan_id: nguoiLa.tinId })).loi.ma, 'THIEU_BANG_CHUNG',
      'tin của người khác không làm bằng chứng được');
    const kq = await capNhat(ha.h.id, { viec: 'tao', mon: 'áo 12 đen M', bang_chung_tin_nhan_id: ha.tinId });
    assert.ok(!kq.loi, JSON.stringify(kq.loi));
    assert.equal(kq.ketQua.ma_don, 'DH-0001');
    assert.equal(kq.ketQua.trang_thai, 'Chờ xác nhận');
    assert.match(kq.ketQua.don, /Tổng tiền đơn DH-0001: 319\.000đ/);
    assert.match(kq.ketQua.don, /Phí ship đơn DH-0001: 30\.000đ/);
    donHa = don.layDon('DH-0001');
    assert.equal(donHa.hoi_thoai_id, ha.h.id);
    assert.equal(donHa.nguon, 'tin_nhan');
    assert.equal(donHa.dien_tap, true);
    assert.equal(don.lichSu(donHa.id)[0].nguon, 'ai');
    assert.equal(con('Đen', 'M'), 4, 'giữ hàng ngay khi tạo đơn');
    // Dùng lại đúng tin đó lần nữa (AI gọi lại) → không thêm món lần hai.
    assert.equal((await capNhat(ha.h.id, { viec: 'them', mon: 'áo 12 đen M', bang_chung_tin_nhan_id: ha.tinId })).loi.ma, 'DA_CAP_NHAT');
    assert.deepEqual(dongDon(donHa.id), [[pl('Đen', 'M'), 1]]);
  });

  await t.test('sửa món theo tin mới của khách: đổi phân loại, thêm, bớt; món lạ, không đủ hàng → lỗi kèm cách sửa', async () => {
    let tn = await khachNoi('Hà Phương', 'Đổi giúp chị sang size L');
    let kq = await capNhat(ha.h.id, { viec: 'doi_phan_loai', mon: 'áo 12 đen M', mon_moi: 'áo 12 đen L', bang_chung_tin_nhan_id: tn.tinId });
    assert.ok(!kq.loi, JSON.stringify(kq.loi));
    assert.deepEqual(dongDon(donHa.id), [[pl('Đen', 'L'), 1]]);
    assert.equal(con('Đen', 'M'), 5, 'món cũ trả lại kho ngay');
    assert.equal(con('Đen', 'L'), 4);
    tn = await khachNoi('Hà Phương', 'Lấy thêm 2 áo trắng M');
    kq = await capNhat(ha.h.id, { viec: 'them', mon: 'áo 12 trắng M x2', bang_chung_tin_nhan_id: tn.tinId });
    assert.match(kq.ketQua.don, /Tổng tiền đơn DH-0001: 897\.000đ/);
    tn = await khachNoi('Hà Phương', 'Bớt 1 áo trắng M thôi');
    kq = await capNhat(ha.h.id, { viec: 'bot', mon: 'áo 12 trắng M x1', bang_chung_tin_nhan_id: tn.tinId });
    assert.match(kq.ketQua.don, /Trắng\/M x1/);
    assert.match(kq.ketQua.don, /Tổng tiền đơn DH-0001: 608\.000đ/);
    // Khách chỉ hỏi, chưa xin mua → AI không được thêm món (CHUA_XIN_MUA), đơn không đổi.
    tn = await khachNoi('Hà Phương', 'Áo 12 đen còn size M không, giá bao nhiêu?');
    kq = await capNhat(ha.h.id, { viec: 'them', mon: 'áo 12 đen M', bang_chung_tin_nhan_id: tn.tinId });
    assert.equal(kq.loi.ma, 'CHUA_XIN_MUA');
    assert.deepEqual(dongDon(donHa.id), [[pl('Đen', 'L'), 1], [pl('Trắng', 'M'), 1]]);
    tn = await khachNoi('Hà Phương', 'Lấy thêm áo 99 đen M với áo 12 xanh M nha');
    kq = await capNhat(ha.h.id, { viec: 'them', mon: 'áo 99 đen M', bang_chung_tin_nhan_id: tn.tinId });
    assert.equal(kq.loi.ma, 'KHONG_TIM_THAY');
    assert.match(kq.loi.thong_diep, /muc_luc_san_pham/);
    kq = await capNhat(ha.h.id, { viec: 'them', mon: 'áo 12 xanh M', bang_chung_tin_nhan_id: tn.tinId });
    assert.equal(kq.loi.ma, 'PHAN_LOAI_KHONG_CO');
    assert.match(kq.loi.thong_diep, /Còn hàng: .*Đen\/M \(còn 5\)/);
    kq = await capNhat(ha.h.id, { viec: 'them', mon: 'áo 12 đen M x9', bang_chung_tin_nhan_id: tn.tinId });
    assert.equal(kq.loi.ma, 'KHONG_DU_HANG');
    assert.deepEqual(dongDon(donHa.id), [[pl('Đen', 'L'), 1], [pl('Trắng', 'M'), 1]], 'lỗi thì đơn giữ nguyên');
  });

  await t.test('xem_don: chỉ đơn của chính khách đang nhắn; khách chưa có đơn → co_don false', async () => {
    const kq = (await congCu('xem_don', { ma_don: '' }, ha.h.id)).ketQua;
    assert.equal(kq.co_don, true);
    assert.equal(kq.ma_don, 'DH-0001');
    assert.match(kq.don, /Tổng tiền đơn DH-0001: 608\.000đ/);
    assert.match(kq.don, /Việc còn thiếu: chưa có tên người nhận; chưa có số điện thoại; chưa có địa chỉ giao/);
    assert.equal((await congCu('xem_don', { ma_don: 'DH-0099' }, ha.h.id)).loi.ma, 'KHONG_TIM_THAY');
    assert.equal((await congCu('xem_don', { ma_don: '' }, nguoiLa.h.id)).ketQua.co_don, false);
    assert.equal((await congCu('xem_don', { ma_don: 'DH-0001' }, nguoiLa.h.id)).ketQua.co_don, false, 'người khác không xem được đơn của Hà');
  });

  await t.test('thông tin giao tạo hồ sơ khách theo số điện thoại; xác nhận cần đủ thông tin + tin khách đồng ý', async () => {
    const dongY = await khachNoi('Hà Phương', 'Ok chị đồng ý');
    assert.equal((await capNhat(ha.h.id, { viec: 'xac_nhan', bang_chung_tin_nhan_id: dongY.tinId })).loi.ma, 'THIEU_THONG_TIN_GIAO');
    assert.equal((await capNhat(ha.h.id, { viec: 'thong_tin_giao', ten: 'Hà Phương', so_dien_thoai: '12345' })).loi.ma, 'DU_LIEU_KHONG_HOP_LE');
    const kq = await capNhat(ha.h.id, { viec: 'thong_tin_giao', ten: 'Hà Phương', so_dien_thoai: '0912 345 678', dia_chi: '5 Lê Lợi, Hà Nội', thanh_toan: 'cod' });
    assert.ok(!kq.loi, JSON.stringify(kq.loi));
    const d = don.layDon(donHa.id);
    assert.equal(d.sdt_nhan, '+84912345678');
    assert.equal(d.dia_chi_nhan, '5 Lê Lợi, Hà Nội');
    const k = kh.layKhach(d.khach_id);
    assert.equal(k.sdt, '+84912345678');
    assert.equal(k.tao_boi, 'ai');
    assert.ok(k.dong_y_luc);
    assert.equal(hopThu.layHoiThoai(ha.h.id).khach_id, k.id, 'hội thoại gắn hồ sơ khách');
    assert.match(kq.ketQua.don, /Người nhận: Hà Phương · 0912\*\*\*678 · 5 Lê Lợi, Hà Nội/);
    assert.doesNotMatch(kq.ketQua.don, /345 678|912345678/, 'khối đơn cho AI che bớt số điện thoại');
    // Xác nhận: không bằng chứng / bằng chứng của người khác → chặn; tin khách đồng ý → Đã xác nhận.
    assert.equal((await capNhat(ha.h.id, { viec: 'xac_nhan' })).loi.ma, 'THIEU_BANG_CHUNG');
    assert.equal((await capNhat(ha.h.id, { viec: 'xac_nhan', bang_chung_tin_nhan_id: nguoiLa.tinId })).loi.ma, 'THIEU_BANG_CHUNG');
    // Lời đồng ý có từ trước khi shop đọc lại đơn với tổng tiền hiện tại → chưa xác nhận được (CHUA_DOC_LAI).
    assert.equal((await capNhat(ha.h.id, { viec: 'xac_nhan', bang_chung_tin_nhan_id: dongY.tinId })).loi.ma, 'CHUA_DOC_LAI');
    await cho(5);
    hopThu.ghiTinRa({ hoiThoaiId: ha.h.id, guiBoi: 'ai', noiDung: `Em đọc lại đơn, tổng tiền ${don.layDon(donHa.id).tong_tien.toLocaleString('vi-VN')}đ, chị đồng ý nha`, khoa: 'doc_lai_ha' });
    const dongY2 = await khachNoi('Hà Phương', 'Ok chị đồng ý');
    const xn = await capNhat(ha.h.id, { viec: 'xac_nhan', bang_chung_tin_nhan_id: dongY2.tinId });
    assert.equal(xn.ketQua?.trang_thai, 'Đã xác nhận', JSON.stringify(xn.loi));
    const sau = don.layDon(donHa.id);
    assert.equal(sau.giu_den, null);
    const ls = don.lichSu(donHa.id).at(-1);
    assert.deepEqual([ls.tu, ls.den, ls.nguon, ls.bang_chung_tin_nhan_id], ['cho_xac_nhan', 'da_xac_nhan', 'ai', dongY2.tinId]);
  });

  await t.test('liên kết hồ sơ có sẵn theo số; khách từng hoàn ≥ ngưỡng → AI không tự xác nhận (CAN_GOI_XAC_NHAN) + việc "Gọi xác nhận đơn"; hủy cần tin khách nói hủy', async () => {
    const tu = kh.taoKhach({ ten: 'Tú Anh', sdt: '0987111222', taoBoi: 'nguoi', dienTap: true }).khach;
    for (let i = 0; i < 2; i++) {
      const d = don.taoDon({ mon: [{ phan_loai_id: pl('Trắng', 'L'), so_luong: 1 }], nguon: 'nguoi', khachId: tu.id, tenNhan: 'Tú Anh', sdtNhan: '+84987111222', diaChiNhan: '1 Hàng Bài' });
      for (const tt of ['da_xac_nhan', 'da_gui', 'hoan']) don.doiTrangThai(d.id, tt, { nguon: 'nguoi' });
    }
    const m = await khachNoi('Tú Anh', 'Em lấy áo 12 trắng M');
    assert.ok(!(await capNhat(m.h.id, { viec: 'tao', mon: 'áo 12 trắng M', bang_chung_tin_nhan_id: m.tinId })).loi);
    const giao = await capNhat(m.h.id, { viec: 'thong_tin_giao', ten: 'Tú Anh', so_dien_thoai: '0987 111 222', dia_chi: '1 Hàng Bài, Hà Nội', thanh_toan: 'cod' });
    assert.ok(!giao.loi, JSON.stringify(giao.loi));
    assert.equal(hopThu.layHoiThoai(m.h.id).khach_id, tu.id, 'số đã có hồ sơ → liên kết, không tạo hồ sơ mới');
    assert.equal(kh.layKhach(tu.id).dia_chi, '1 Hàng Bài, Hà Nội', 'hồ sơ chưa có địa chỉ thì AI điền');
    const d = don.layDon(giao.ketQua.ma_don);
    assert.equal(d.khach_id, tu.id);
    const dongY = await khachNoi('Tú Anh', 'Ok em đồng ý');
    const xn = await capNhat(m.h.id, { viec: 'xac_nhan', bang_chung_tin_nhan_id: dongY.tinId });
    assert.equal(xn.loi.ma, 'CAN_GOI_XAC_NHAN');
    assert.equal(don.layDon(d.id).trang_thai, 'cho_xac_nhan');
    const viec = csdl().prepare("SELECT * FROM viec WHERE don_id = ? AND loai = 'goi_xac_nhan_don'").all(d.id);
    assert.equal(viec.length, 1);
    assert.equal(viec[0].cho_ai, 'nguoi');
    // Hủy: không bằng chứng → chặn; tin khách nói hủy → Đã hủy, hàng trả lại.
    assert.equal((await capNhat(m.h.id, { viec: 'huy' })).loi.ma, 'THIEU_BANG_CHUNG');
    const truoc = con('Trắng', 'M');
    const huy = await khachNoi('Tú Anh', 'Thôi em hủy nhé');
    assert.equal((await capNhat(m.h.id, { viec: 'huy', bang_chung_tin_nhan_id: huy.tinId })).ketQua.trang_thai, 'Đã hủy');
    assert.equal(con('Trắng', 'M'), truoc + 1);
    assert.equal(don.layDon(d.id).ly_do_huy, 'khách hủy');
  });

  await t.test('đơn chốt từ bình luận live (MOZA giữ x2): AI thêm lại bằng bình luận cũ → DA_CAP_NHAT; tin mới "thêm 1 áo trắng L" thêm được; dùng lại tin đó → DA_CAP_NHAT', async () => {
    const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
    const p = live.taoPhien({ kich_ban_id: kb.id, dien_tap: true });
    fb.batDauLive();
    live.ganLive(p.id, fb.live.id);
    t.after(() => { try { fb.ketThucLive(); live.ketThucPhien(p.id); } catch { /* đã kết thúc */ } });
    const bl = live.themBinhLuan(p.id, { fb_id: 'blchot_1', nguoi_fb_id: 'ng_thao', ten: 'Thảo', noi_dung: 'chốt áo 12 đen L x2',
      luc_fb: new Date(Date.now() - 60000).toISOString() });
    const { hoiThoai: hBl } = hopThu.tuBinhLuanLive(bl, live.layPhien(p.id));
    const d = don.taoDon({ mon: [{ phan_loai_id: pl('Đen', 'L'), so_luong: 2 }], nguon: 'binh_luan_live', pageId: hBl.page_id, nguoiFbId: hBl.nguoi_fb_id,
      hoiThoaiId: hBl.id, phienLiveId: p.id, binhLuanId: bl.id, dienTap: true });
    live.ganChot(bl.id, { donId: d.id });
    hopThu.ganPsid(hBl.nguoi_fb_id, fb.psidCua('page_gia', 'Thảo')); // như sau khi MOZA nhắn riêng (#65)
    const tinBl = hopThu.tinCuaHoiThoai(hBl.id).find((x) => x.gui_boi === 'khach');

    const ketQua = [];
    let heThong = '';
    buoc = (o) => {
      const n = soBuocTrongLuot(o);
      if (n > 0) ketQua.push(ketQuaCuoi(o));
      heThong = o.heThong;
      const idMoi = [...o.lichSu[0].chu.matchAll(/\(id (tn_[a-z0-9]+)\) <loi_nguoi_nhan[^>]*>thêm 1 áo trắng L/g)].at(-1)?.[1];
      if (n === 0) return goiCC('cap_nhat_don', { viec: 'them', mon: 'áo 12 đen L x2', mon_moi: '', ten: '', so_dien_thoai: '', dia_chi: '', thanh_toan: '', bang_chung_tin_nhan_id: tinBl.id });
      if (n === 1 || n === 2) return goiCC('cap_nhat_don', { viec: 'them', mon: 'áo 12 trắng L x1', mon_moi: '', ten: '', so_dien_thoai: '', dia_chi: '', thanh_toan: '', bang_chung_tin_nhan_id: idMoi || '' });
      return phieu('Thảo chốt áo 12 đen L x2 trên live, thêm 1 trắng L.');
    };
    await cho(5);
    fb.khachNhan({ ten: 'Thảo', noi_dung: 'thêm 1 áo trắng L nha shop' });
    await ht.choXong();
    buoc = () => phieu();
    assert.equal(ketQua.length, 3);
    assert.equal(ketQua[0].loi.ma, 'DA_CAP_NHAT', 'món chốt từ bình luận MOZA đã giữ: AI không thêm lại');
    assert.ok(!ketQua[1].loi, JSON.stringify(ketQua[1]));
    assert.equal(ketQua[2].loi.ma, 'DA_CAP_NHAT', 'một tin khách chỉ dùng được một lần');
    assert.deepEqual(dongDon(d.id), [[pl('Đen', 'L'), 2], [pl('Trắng', 'L'), 1]]);
    assert.match(heThong, /## Đơn đang mở của khách \(trích tổng tiền, phí ship với nguon "DH-0005"/, 'Tư vấn viên thấy sẵn đơn chốt từ live');
    const hMs = hopThu.danhSach({ dienTap: true }).find((x) => x.kenh === 'messenger' && x.fb_thread_id === fb.psidCua('page_gia', 'Thảo'));
    assert.equal(don.layDon(d.id).hoi_thoai_id, hMs.id, 'đơn đi theo hội thoại Messenger đang trao đổi');
  });

  await t.test('nhắc đơn lần 1 (F-69): 20 phút sau tin cuối của shop, khách chưa làm bước tiếp → tin do mã soạn, 0 lượt AI, một lần', async () => {
    // Test chạy mọi giờ: mở khung nhắn chủ động cả ngày (khung 7h–22h đã có test riêng — gioi-han-lien-he.test.js).
    const MAC = require('../server/nghiep-vu/lien-he').MAC;
    Object.assign(MAC, { gio_tu: 0, gio_den: 24 });
    t.after(() => Object.assign(MAC, { gio_tu: 7, gio_den: 22 }));
    const n = await khachNoi('Ngọc', 'Lấy em áo 12 trắng M');
    const tao = await capNhat(n.h.id, { viec: 'tao', mon: 'áo 12 trắng M', bang_chung_tin_nhan_id: n.tinId });
    const d = don.layDon(tao.ketQua.ma_don);
    const r = hopThu.ghiTinRa({ hoiThoaiId: n.h.id, guiBoi: 'ai', noiDung: 'Dạ chị gửi giúp shop tên, số, địa chỉ nha.', khoa: `xin:${d.id}` });
    hopThu.capNhatGui(r.tin.id, { trangThai: 'da_gui' });
    csdl().prepare('UPDATE tin_nhan SET luc = ? WHERE id = ?').run(new Date(Date.now() - 25 * 60e3).toISOString(), r.tin.id);
    csdl().prepare('UPDATE tin_nhan SET luc = ? WHERE id = ?').run(new Date(Date.now() - 30 * 60e3).toISOString(), n.tinId);
    const truoc = ai.yeuCau.length;
    const truocChat = chatCua('Ngọc').length;
    await ht.nhacDon();
    assert.equal(ai.yeuCau.length, truoc, 'nhắc do mã soạn: không gọi AI');
    const moi = chatCua('Ngọc').slice(truocChat);
    assert.equal(moi.length, 1);
    assert.match(moi[0].noi_dung, new RegExp(`Đơn ${d.ma} · .* còn thiếu tên người nhận, số điện thoại, địa chỉ giao`));
    assert.ok(JSON.stringify(moi[0]).includes('Không lấy'), 'kèm trả lời nhanh Không lấy');
    assert.equal(don.layDon(d.id).nhac_lan, 1);
    await ht.nhacDon();
    assert.equal(chatCua('Ngọc').length, truocChat + 1, 'lần 2 chưa tới giờ');
  });

  await t.test('nhắc đơn ngoài 24 giờ, khách chưa để số → không gửi, không tạo việc gọi; Đơn hàng hiện "Chưa liên lạc được"', async () => {
    const q = await khachNoi('Quân', 'Em lấy áo 12 đen M');
    const tao = await capNhat(q.h.id, { viec: 'tao', mon: 'áo 12 đen M', bang_chung_tin_nhan_id: q.tinId });
    const d = don.layDon(tao.ketQua.ma_don);
    csdl().prepare('UPDATE hoi_thoai SET tin_khach_cuoi_luc = ? WHERE id = ?').run(new Date(Date.now() - 25 * 3600e3).toISOString(), q.h.id);
    const truoc = ai.yeuCau.length;
    await ht.nhacDon();
    assert.equal(ai.yeuCau.length, truoc, 'không gọi AI');
    assert.equal(chatCua('Quân').length, 0, 'không gửi gì ra Facebook');
    assert.equal(csdl().prepare('SELECT COUNT(*) AS n FROM viec WHERE don_id = ?').get(d.id).n, 0, 'không tạo việc "Gọi khách"');
    assert.equal(don.chuaLienLacDuoc(don.layDon(d.id)), true);
    don.doiTrangThai(d.id, 'da_huy', { nguon: 'nguoi' });
  });

  await t.test('đơn Đã gửi → báo khách một lần bằng câu mẫu kèm mã vận đơn, 0 lượt AI (F-98)', async () => {
    don.datMaVanDon(donHa.id, 'GHN123');
    don.doiTrangThai(donHa.id, 'da_gui', { nguon: 'nguoi' });
    const truoc = chatCua('Hà Phương').length;
    const truocAi = ai.yeuCau.length;
    await ht.nhacDon();
    assert.equal(chatCua('Hà Phương').length, truoc + 1);
    assert.match(chatCua('Hà Phương').at(-1).noi_dung, /đơn DH-0001 của .* đã gửi đi rồi, mã vận đơn GHN123/);
    assert.ok(don.layDon(donHa.id).bao_gui_luc);
    await ht.nhacDon();
    assert.equal(chatCua('Hà Phương').length, truoc + 1, 'chỉ báo một lần');
    assert.equal(ai.yeuCau.length, truocAi, 'không gọi AI');
  });

  await t.test('gui_anh_san_pham: gửi ảnh đúng màu qua Facebook giả; không có ảnh màu đó → ảnh đại diện; sai kênh, sai số → lỗi', async () => {
    const k = await khachNoi('Hà Phương', 'Cho chị xem ảnh áo đen');
    const kq = await congCu('gui_anh_san_pham', { so: 12, mau: 'đen' }, k.h.id);
    assert.ok(!kq.loi, JSON.stringify(kq.loi));
    assert.equal(kq.ketQua.da_gui, 1);
    assert.equal(kq.ketQua.ghi_chu, '');
    const anh = chatCua('Hà Phương').at(-1);
    assert.equal(anh.anh, a12.san_pham.anh[0].tep);
    assert.equal(anh.co, ANH_GIA.length, 'gửi đúng tệp ảnh của sản phẩm');
    assert.match(hopThu.tinCuaHoiThoai(k.h.id).at(-1).noi_dung, /Đã gửi 1 ảnh áo số 12 màu đen/);
    const trang = await congCu('gui_anh_san_pham', { so: 12, mau: 'Trắng' }, k.h.id);
    assert.equal(trang.ketQua.da_gui, 1);
    assert.match(trang.ketQua.ghi_chu, /Không có ảnh gắn màu Trắng: đã gửi ảnh đại diện/);
    assert.equal((await congCu('gui_anh_san_pham', { so: 99, mau: '' }, k.h.id)).loi.ma, 'SP_KHONG_BAN_DUOC');
    const bl = hopThu.danhSach({ dienTap: true }).find((x) => x.kenh === 'binh_luan_live');
    assert.equal((await congCu('gui_anh_san_pham', { so: 12, mau: '' }, bl.id)).loi.ma, 'SAI_KENH');
  });

  await t.test('gui_anh_san_pham theo luật Hộp thư: ngoài 24 giờ hoặc người đang giữ hội thoại thì không gửi',
    async () => {
      const q = hopThu.danhSach({ dienTap: true }).find((x) => x.fb_thread_id === fb.psidCua('page_gia', 'Quân'));
      const kq = await congCu('gui_anh_san_pham', { so: 12, mau: '' }, q.id);
      assert.equal(kq.loi?.ma, 'NGOAI_CUA_SO_24H');
      assert.equal(chatCua('Quân').length, 0);
      const k = await khachNoi('Hà Phương', 'ok');
      hopThu.tamDungAi(k.h.id);
      assert.equal((await congCu('gui_anh_san_pham', { so: 12, mau: '' }, k.h.id)).loi?.ma, 'AI_TAM_DUNG');
      hopThu.giaoLaiAi(k.h.id);
    });

  await t.test('tim_mau_theo_anh: khách giả gửi ảnh → tin có anh_url khu tạm; chỉ tải ảnh từ khu tạm hoặc máy chủ ảnh Facebook', async () => {
    const { taiAnhKhach } = require('../server/agent/agents/tim-mau');
    const tep = sp.luuAnhTam(ANH_GIA);
    fb.khachNhan({ ten: 'Linh', noi_dung: 'Shop có mẫu này không?', anh: tep });
    await ht.choXong();
    const h = hopThu.danhSach({ dienTap: true }).find((x) => x.fb_thread_id === fb.psidCua('page_gia', 'Linh'));
    const tin = hopThu.tinCuaHoiThoai(h.id).find((x) => x.anh_url);
    assert.equal(tin.anh_url, `tam:${tep}`);
    assert.ok((await taiAnhKhach(tin.anh_url)).equals(ANH_GIA));
    await assert.rejects(taiAnhKhach('https://trang-la.example/anh.jpg'), (e) => e.ma === 'KHONG_CO_ANH');
    await assert.rejects(taiAnhKhach('http://scontent.xx.fbcdn.net/anh.jpg'), (e) => e.ma === 'KHONG_CO_ANH', 'chỉ https');
    await assert.rejects(taiAnhKhach('tam:../../.env'), (e) => e.ma === 'KHONG_CO_ANH', 'không đi ra ngoài khu tạm');
    let goiToi = null;
    const buf = await taiAnhKhach('https://scontent.xx.fbcdn.net/v/anh.jpg', { fetch: async (u) => { goiToi = String(u); return { ok: true, arrayBuffer: async () => ANH_GIA }; } });
    assert.equal(goiToi, 'https://scontent.xx.fbcdn.net/v/anh.jpg');
    assert.ok(Buffer.from(buf).equals(ANH_GIA));
    // Công cụ: tin của hội thoại khác → từ chối; tin không có ảnh → hỏi khách gửi ảnh.
    assert.equal((await congCu('tim_mau_theo_anh', { tin_nhan_id: tin.id }, ha.h.id)).loi.ma, 'KHONG_TIM_THAY');
    const chu = await khachNoi('Linh', 'mẫu áo sơ mi ấy');
    assert.equal((await congCu('tim_mau_theo_anh', { tin_nhan_id: chu.tinId }, h.id)).loi.ma, 'KHONG_CO_ANH');
  });

  await t.test('tim_mau_theo_anh: so ảnh khách với ảnh mẫu Đang bán, chỉ nói "gần giống"; ảnh không phải sản phẩm → hỏi lại',
    async () => {
      const { timMauTheoAnh } = require('../server/agent/agents/tim-mau');
      const h = hopThu.danhSach({ dienTap: true }).find((x) => x.fb_thread_id === fb.psidCua('page_gia', 'Linh'));
      const tin = hopThu.tinCuaHoiThoai(h.id).find((x) => x.anh_url);
      const yeuCau = [];
      const gia = (tra) => ({ async goi(o) { yeuCau.push(o); return { goiCongCu: [], chu: JSON.stringify(tra), goc: null, tokenVao: 1, tokenRa: 1 }; } });
      const kq = await timMauTheoAnh(tin, { hoiThoaiId: h.id, dienTap: true, nhaCungCap: { gemini: gia({ la_san_pham: true, mo_ta_anh_khach: 'sơ mi đen', giong: [{ so: 12, muc: 'gan_giong', ly_do: 'cùng form suông' }, { so: 99, muc: 'hoi_giong', ly_do: 'x' }] }) } });
      assert.equal(kq.tim_thay, true);
      assert.deepEqual(kq.mau_gan_giong, ['Áo số 12 · Sơ mi linen tay ngắn — gần giống (cùng form suông)'], 'số không có trong danh sách bị bỏ');
      assert.equal(yeuCau[0].lichSu[0].anh.length, 2, 'ảnh khách + ảnh đại diện của mẫu');
      assert.equal(yeuCau[0].model, 'gemini-3.8-flash');
      const khong = await timMauTheoAnh(tin, { hoiThoaiId: h.id, dienTap: true, nhaCungCap: { gemini: gia({ la_san_pham: false, mo_ta_anh_khach: 'con mèo', giong: [] }) } });
      assert.equal(khong.khong_phai_san_pham, true);
    });
});
