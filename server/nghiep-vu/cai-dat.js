'use strict';

/**
 * Cài đặt (SPEC.md F-03) và cấu hình Agent.
 *
 * Bảng `cai_dat` giữ khóa → JSON. Không bao giờ giữ khóa API: khóa chỉ nằm trong .env (khoa.js).
 * Các lựa chọn hợp lệ (model, miệng, mức suy nghĩ) lấy từ server/cau-hinh/mac-dinh.json,
 * để thêm model mới không phải sửa mã.
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, gio, kiemChu } = require('./chung');
const MAC_DINH = require('../cau-hinh/mac-dinh.json');
const giong = require('../giong');

function doc(khoa, macDinh = null) {
  const r = csdl().prepare('SELECT gia_tri FROM cai_dat WHERE khoa = ?').get(khoa);
  return r ? JSON.parse(r.gia_tri) : macDinh;
}

function ghi(khoa, giaTri) {
  csdl().prepare('INSERT INTO cai_dat (khoa, gia_tri) VALUES (?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri')
    .run(khoa, JSON.stringify(giaTri));
  return giaTri;
}

/** Lần chạy đầu: ghi giá trị mặc định cho những khóa còn thiếu. */
function gieoMacDinh() {
  giaoDich(() => {
    if (doc('tao_luc') === null) ghi('tao_luc', gio());
    if (doc('ten_ai') === null) ghi('ten_ai', MAC_DINH.ten_ai);
    if (doc('khan_cap') === null) ghi('khan_cap', false);
    if (doc('mieng') === null) ghi('mieng', MAC_DINH.mieng_mac_dinh);
  });
}

/* ---------------- tên AI ---------------- */

function tenAi() {
  return doc('ten_ai', MAC_DINH.ten_ai);
}

function datTenAi(s) {
  return ghi('ten_ai', kiemChu(s, { ten: 'Tên AI', batBuoc: true, toiDa: 60, motDong: true }));
}

/* ---------------- bán hàng (F-03, #59, #63, #64, #73) ---------------- */
// Tên shop, số điện thoại và địa chỉ gửi hàng (phiếu gửi hàng F-57), phí ship đồng giá, miễn phí từ, giờ giữ hàng,
// ngưỡng "sắp hết", ngưỡng khách từng hoàn. Phí ship là số ở đây, không ghi ở Sổ tay (tránh hai nguồn khác nhau).
// Phí ship chưa đặt (null) thì AI nói chưa có thông tin, không tự đoán.

// Bản 3.4: gio_giu_ngan (F-68, #98: giữ ngắn tới hết live + N giờ cho người chưa bấm), phu_trach + xung_ho (F-75, #103: nhãn AI,
// cách xưng hô trong câu mẫu), ten_chu_tk (F-74, #105: câu chống giả shop), ngan_hang (BIN) + so_tk (F-89, #112: mã QR chuyển khoản).
const XUNG_HO = ['minh_ban', 'shop_chi', 'em_anh_chi', 'shop_ban'];
const BAN_HANG_MAC_DINH = { ten_shop: '', sdt_shop: '', dia_chi_shop: '', phi_ship: null, mien_phi_tu: null, gio_giu: 24, nguong_sap_het: 3, nguong_hoan: 2,
  gio_giu_ngan: 2, phu_trach: '', xung_ho: 'minh_ban', ten_chu_tk: '', ngan_hang: '', so_tk: '', hoi_so_do: false, gia_live_bat: false, dung_anh_khach: false,
  gio_nghe_may: '', doi_tra_ngan: '', da_dat: [], nguong_don_lon: 500000, so_ngay_hoi_mac: 4, hang_van_chuyen: 'chung',
  khi_noi_nham_gia: 'ban_theo_gia_noi' }; // F-106

function banHang() {
  return { ...BAN_HANG_MAC_DINH, ...(doc('ban_hang', {}) || {}) };
}

function soNguyen(v, ten, toiThieu, toiDa) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < toiThieu || n > toiDa) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${ten} là số nguyên từ ${toiThieu} đến ${toiDa}.`);
  return n;
}

function kiemXungHo(v) {
  if (!XUNG_HO.includes(v)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cách xưng hô chọn từ danh sách.');
  return v;
}

function datBanHang(duLieu = {}) {
  const cu = banHang();
  const { docTien } = require('./chung');
  const co = (k) => Object.hasOwn(duLieu, k);
  const moi = {
    ten_shop: co('ten_shop') ? kiemChu(duLieu.ten_shop, { ten: 'Tên shop', toiDa: 80, motDong: true }) : cu.ten_shop,
    sdt_shop: co('sdt_shop') ? kiemChu(duLieu.sdt_shop, { ten: 'Số điện thoại shop', toiDa: 20, motDong: true }) : cu.sdt_shop,
    dia_chi_shop: co('dia_chi_shop') ? kiemChu(duLieu.dia_chi_shop, { ten: 'Địa chỉ gửi hàng', toiDa: 300, motDong: true }) : cu.dia_chi_shop,
    phi_ship: co('phi_ship') ? docTien(duLieu.phi_ship, { ten: 'Phí ship' }) : cu.phi_ship,
    mien_phi_tu: co('mien_phi_tu') ? docTien(duLieu.mien_phi_tu, { ten: 'Miễn phí ship từ' }) : cu.mien_phi_tu,
    gio_giu: co('gio_giu') ? soNguyen(duLieu.gio_giu, 'Giờ giữ hàng', 1, 168) : cu.gio_giu,
    nguong_sap_het: co('nguong_sap_het') ? soNguyen(duLieu.nguong_sap_het, 'Ngưỡng sắp hết', 0, 1000) : cu.nguong_sap_het,
    nguong_hoan: co('nguong_hoan') ? soNguyen(duLieu.nguong_hoan, 'Ngưỡng khách từng hoàn', 1, 100) : cu.nguong_hoan,
    gio_giu_ngan: co('gio_giu_ngan') ? soNguyen(duLieu.gio_giu_ngan, 'Giữ ngắn cho người chưa bấm (giờ sau khi hết live)', 1, 24) : cu.gio_giu_ngan,
    phu_trach: co('phu_trach') ? kiemChu(duLieu.phu_trach, { ten: 'Người phụ trách buổi live', toiDa: 60, motDong: true }) : cu.phu_trach,
    xung_ho: co('xung_ho') ? kiemXungHo(duLieu.xung_ho) : cu.xung_ho,
    ten_chu_tk: co('ten_chu_tk') ? kiemChu(duLieu.ten_chu_tk, { ten: 'Tên chủ tài khoản nhận tiền', toiDa: 60, motDong: true }).toUpperCase() : cu.ten_chu_tk,
    ngan_hang: co('ngan_hang') ? kiemNganHang(duLieu.ngan_hang) : cu.ngan_hang,
    so_tk: co('so_tk') ? kiemSoTk(duLieu.so_tk) : cu.so_tk,
    // F-91: "Hỏi khách lưu chiều cao, cân nặng" — TẮT mặc định, chỉ bật sau khi luật sư trả lời (#127).
    hoi_so_do: co('hoi_so_do') ? duLieu.hoi_so_do === true || duLieu.hoi_so_do === 'true' : cu.hoi_so_do,
    dung_anh_khach: co('dung_anh_khach') ? duLieu.dung_anh_khach === true || duLieu.dung_anh_khach === 'true' : cu.dung_anh_khach, // F-104
    // F-93: "Giá live" — TẮT mặc định, chỉ bật sau khi luật sư xem (#127).
    gia_live_bat: co('gia_live_bat') ? duLieu.gia_live_bat === true || duLieu.gia_live_bat === 'true' : cu.gia_live_bat,
    // F-95: giờ nghe máy (chọn từ danh sách, 6:00–23:00, bước 30 phút), một dòng đổi trả ngắn cho Thanh chữ / thẻ đơn.
    gio_nghe_may: co('gio_nghe_may') ? kiemGioNgheMay(duLieu.gio_nghe_may) : cu.gio_nghe_may,
    doi_tra_ngan: co('doi_tra_ngan') ? kiemChu(duLieu.doi_tra_ngan, { ten: 'Đổi trả (một dòng)', toiDa: 40, motDong: true }) : cu.doi_tra_ngan,
    // F-99: đơn COD của khách mới từ mức này thì máy đánh dấu "Nên hỏi lại"; F-100: hỏi thăm sau khi gửi N ngày (2–7).
    nguong_don_lon: co('nguong_don_lon') ? (docTien(duLieu.nguong_don_lon, { ten: 'Đơn từ bao nhiêu thì hỏi lại khách mới' }) ?? 500000) : cu.nguong_don_lon,
    so_ngay_hoi_mac: co('so_ngay_hoi_mac') ? soNguyen(duLieu.so_ngay_hoi_mac, 'Hỏi thăm sau khi gửi (ngày)', 2, 7) : cu.so_ngay_hoi_mac,
    // F-101: hãng vận chuyển đang dùng (mẫu file xuất) — chọn từ danh sách.
    khi_noi_nham_gia: co('khi_noi_nham_gia') ? (['ban_theo_gia_noi', 'chu_shop_quyet'].includes(duLieu.khi_noi_nham_gia) ? duLieu.khi_noi_nham_gia : (() => { throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn cách xử lý khi Mai nói nhầm giá từ danh sách.'); })()) : cu.khi_noi_nham_gia,
    hang_van_chuyen: co('hang_van_chuyen') ? (Object.hasOwn(require('../cau-hinh/mau-xuat-van-chuyen.json').hang, duLieu.hang_van_chuyen) ? duLieu.hang_van_chuyen : (() => { throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Hãng vận chuyển chọn từ danh sách.'); })()) : cu.hang_van_chuyen,
    // Khóa người đã tự đặt (kể cả để trống) — phân biệt mặc định với giá trị người chọn (Tổng quan 8 mục).
    da_dat: [...new Set([...(cu.da_dat || []), ...Object.keys(duLieu).filter((k) => k !== 'da_dat' && Object.hasOwn(BAN_HANG_MAC_DINH, k))])],
  };
  return ghi('ban_hang', moi);
}

/** Giờ nghe máy "08:00-21:00" (từ < đến, 6:00–23:00, bước 30 phút) hoặc "" (chưa chọn). */
function kiemGioNgheMay(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const m = /^(\d{1,2}):(00|30)\s*[-–]\s*(\d{1,2}):(00|30)$/.exec(s);
  const phut = m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
  if (!phut || phut[0] < 360 || phut[1] > 1380 || phut[0] >= phut[1]) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Giờ nghe máy chọn từ danh sách (6:00–23:00), giờ bắt đầu trước giờ kết thúc.');
  const hh = (p) => `${String(Math.floor(p / 60)).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`;
  return `${hh(phut[0])}-${hh(phut[1])}`;
}

/**
 * Tổng quan "Thông tin shop" (F-95, #119): chỉ các mục CÒN THIẾU trong 8 mục, kèm câu gợi ý để điền bằng lời. Đủ 8 → [].
 * @returns {{ma:string, ten:string, goi_y:string}[]}
 */
function thongTinShopConThieu() {
  const b = banHang();
  const dat = new Set(b.da_dat || []);
  const soTay = (ten) => require('./so-tay').danhSachMuc().some((m) => m.tieu_de.toLowerCase().includes(ten) && m.noi_dung.trim());
  const ds = [];
  const them = (ma, ten, goiY) => ds.push({ ma, ten, goi_y: goiY });
  if (b.phi_ship == null) them('phi_ship', 'Phí ship', 'phí ship 30 nghìn mọi đơn');
  if (b.mien_phi_tu == null && !dat.has('mien_phi_tu')) them('mien_phi_tu', 'Mức miễn ship (hoặc "không miễn ship")', 'đơn từ 500 nghìn thì miễn ship');
  if (!dat.has('gio_giu')) them('gio_giu', 'Giờ giữ hàng', 'giữ hàng cho khách 24 tiếng');
  if (!soTay('đổi trả') && !b.doi_tra_ngan) them('doi_tra', 'Chính sách đổi size', 'cho đổi size trong 3 ngày nếu chưa giặt, khách trả ship');
  if (!taiKhoanNhanTien() && !soTay('thanh toán')) them('tai_khoan', 'Tài khoản nhận tiền', 'Chọn ngân hàng và số tài khoản ở Cài đặt → Bán hàng');
  if (!b.gio_nghe_may) them('gio_nghe_may', 'Giờ nghe máy', 'shop nghe máy từ 8 giờ sáng tới 9 giờ tối');
  if (!dat.has('xung_ho')) them('xung_ho', 'Cách xưng hô', 'xưng shop, gọi khách là chị');
  if (!b.ten_shop || !b.sdt_shop || !b.dia_chi_shop) them('nguoi_ban', 'Thông tin người bán (tên shop, số điện thoại, địa chỉ gửi hàng)', 'tên shop là Moza Shop, số shop 0987 654 321');
  return ds;
}

/** Danh sách ngân hàng nhận chuyển khoản VietQR (server/cau-hinh/ngan-hang.json, F-89). */
function danhSachNganHang() {
  return require('../cau-hinh/ngan-hang.json').ngan_hang;
}

function kiemNganHang(v) {
  const bin = String(v ?? '').trim();
  if (!bin) return '';
  if (!danhSachNganHang().some((x) => x.bin === bin)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Ngân hàng chọn từ danh sách.');
  return bin;
}

function kiemSoTk(v) {
  const so = String(v ?? '').replace(/[\s.-]/g, '');
  if (!so) return '';
  if (!/^\d{6,19}$/.test(so)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Số tài khoản chỉ gồm 6–19 chữ số.');
  return so;
}

/**
 * Tài khoản nhận chuyển khoản của shop — chỉ khi đủ 3 ô (ngân hàng, số tài khoản, tên chủ TK); thiếu thì null (thẻ đơn giữ 2 nút).
 * @returns {{bin:string, ten_ngan:string, so_tk:string, ten_tk:string}|null}
 */
function taiKhoanNhanTien() {
  const b = banHang();
  const nh = danhSachNganHang().find((x) => x.bin === b.ngan_hang);
  if (!nh || !b.so_tk || !b.ten_chu_tk) return null;
  return { bin: nh.bin, ten_ngan: nh.ten_ngan, so_tk: b.so_tk, ten_tk: b.ten_chu_tk };
}

/** Tên shop để thay {ten_shop} trong lời dặn, câu mẫu. Chưa đặt thì gọi chung là "shop". */
function tenShop() {
  return banHang().ten_shop || 'shop';
}

/* ---------------- công tắc "Dừng mọi thứ" ---------------- */
// Bật thì mọi hành động "Cho phép" thành "Hỏi", không tin nào được gửi ra (F-03).
// Luật quyền ở M2 đọc cờ này trước mọi hành động có ảnh hưởng thật.

function khanCap() {
  return doc('khan_cap', false) === true;
}

/** @param {{ma:string, thong_diep:string}|null} lyDo  vì sao tự bật (ví dụ vượt mức trần); người bấm tay thì trống. */
function datKhanCap(bat, lyDo = null) {
  if (typeof bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Thiếu trạng thái bật/tắt.');
  ghi('khan_cap', bat);
  ghi('khan_cap_luc', gio());
  ghi('khan_cap_ly_do', bat ? lyDo : null);
  return bat;
}

/*
 * "Dừng AI" (F-72, #101) — KHÁC "Dừng mọi thứ": tự bật khi chi phí vượt mức trần. Chặn mọi lần gọi AI tốn tiền (Agent, miệng,
 * Đội AI, chép lời, đọc hộ bình luận chốt), nhưng phần chốt đơn bằng mã vẫn chạy: giữ hàng, thẻ giữ hàng, nút bấm, gom công
 * khai, ẩn bình luận. "Dừng mọi thứ" (khan_cap) chỉ bật khi NGƯỜI bấm.
 */
function dungAi() {
  const x = doc('dung_ai', null);
  return x?.bat ? x : { bat: false };
}

function datDungAi(bat, lyDo = null) {
  return ghi('dung_ai', bat ? { bat: true, ly_do: lyDo, luc: gio() } : { bat: false, luc: gio() });
}

function lyDoKhanCap() {
  return khanCap() ? doc('khan_cap_ly_do', null) : null;
}

/* ---------------- độ trễ phát (F-20) ---------------- */
// Người xem thấy hình trễ hơn máy phát nên bình luận "lương bao nhiêu" có khi hỏi về tin đã nói 15 giây trước.

function doTrePhat() {
  return doc('do_tre_phat', MAC_DINH.do_tre_phat_giay);
}

function datDoTrePhat(giay) {
  const n = Number(giay);
  if (!Number.isInteger(n) || n < 0 || n > 120) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Độ trễ phát là số giây từ 0 đến 120.');
  return ghi('do_tre_phat', n);
}

/* ---------------- giao diện và tỷ giá (GD1: F-119, F-121) ---------------- */

/** Các phần giao diện người dùng được ẩn (chỉ ẩn mục menu / khối giao diện — chức năng máy chủ vẫn chạy). */
const PHAN_AN_DUOC = ['doi_ai_radio', 'lich_live', 'anh_khach', 'khach_hang', 'so_tay', 'bao_cao'];

function giaoDien() {
  const x = doc('giao_dien', {}) || {};
  return { an: Array.isArray(x.an) ? x.an.filter((k) => PHAN_AN_DUOC.includes(k)) : [] };
}

function datGiaoDien(duLieu) {
  const an = Array.isArray(duLieu?.an) ? duLieu.an : null;
  if (!an || an.some((k) => !PHAN_AN_DUOC.includes(k))) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn phần cần ẩn từ danh sách.');
  return ghi('giao_dien', { an: [...new Set(an)] });
}

/** Tỷ giá USD → đồng, chỉ để hiện số tiền Việt bên cạnh chi phí AI (mặc định 26.000). */
function tyGiaVnd() {
  const n = Number(doc('ty_gia_vnd', null));
  return Number.isFinite(n) && n > 0 ? n : 26000;
}

function datTyGiaVnd(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 10000 || n > 100000) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Tỷ giá là số đồng cho 1 USD, từ 10.000 đến 100.000.');
  return ghi('ty_gia_vnd', Math.round(n));
}

/* ---------------- miệng của Mai ---------------- */

function mieng() {
  const m = doc('mieng', MAC_DINH.mieng_mac_dinh);
  return { ...MAC_DINH.mieng_mac_dinh, ...m, giong: { ...MAC_DINH.mieng_mac_dinh.giong, ...m.giong } };
}

function kiemGiong(nha, ten) {
  if (!giong.coGiong(nha, ten)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có giọng "${ten}" của ${nha}.`);
  return ten;
}

function datMieng(duLieu = {}) {
  const cu = mieng();
  const moi = { model: duLieu.model ?? cu.model, giong: { ...cu.giong, ...(duLieu.giong || {}) } };
  if (!MAC_DINH.mieng.some((x) => x.model === moi.model && !x.chi_dien_tap)) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có lựa chọn miệng "${moi.model}".`);
  }
  for (const [nha, ten] of Object.entries(moi.giong)) if (nha !== 'elevenlabs') kiemGiong(nha, ten);
  return ghi('mieng', moi);
}

/** Giọng ElevenLabs của Mai (BH10, F-108): mã giọng trong tài khoản ElevenLabs, chọn ở Cài đặt → Đội AI dẫn. */
function datGiongElevenMai(voiceId) {
  const cu = mieng();
  return ghi('mieng', { model: cu.model, giong: { ...cu.giong, elevenlabs: voiceId } });
}

/* ---------------- Agent ---------------- */

function docAgent(r) {
  return {
    ...r,
    nang_cap: JSON.parse(r.nang_cap),
    cong_cu: JSON.parse(r.cong_cu),
    skill: JSON.parse(r.skill),
    gioi_han: JSON.parse(r.gioi_han),
    bat: r.bat === 1,
    thu_nghiem: r.thu_nghiem === 1,
  };
}

function danhSachAgent() {
  return csdl().prepare('SELECT * FROM agent ORDER BY thu_nghiem, rowid').all().map(docAgent);
}

/** Đọc cấu hình mới nhất mỗi lần chạy: đổi model trong Cài đặt có tác dụng ngay lần chạy kế tiếp (F-07). */
function layAgent(id) {
  const r = csdl().prepare('SELECT * FROM agent WHERE id = ?').get(id);
  if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy Agent này.', 404);
  return docAgent(r);
}

function kiemModel(nha, model, tenO) {
  const n = MAC_DINH.nha[nha];
  if (!n) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${tenO}: không biết nhà cung cấp "${nha}".`);
  if (!n.model.includes(model)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${tenO}: ${n.ten} không có model "${model}".`);
}

/** Sửa nhà cung cấp, model, mức suy nghĩ, nhà dự phòng của một Agent. Không đụng tới công cụ hay luật quyền. */
function suaAgent(id, duLieu = {}) {
  return giaoDich((db) => {
    const r = db.prepare('SELECT * FROM agent WHERE id = ?').get(id);
    if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy Agent này.', 404);
    const moi = {
      nha: duLieu.nha ?? r.nha,
      model: duLieu.model ?? r.model,
      muc_suy_nghi: duLieu.muc_suy_nghi ?? r.muc_suy_nghi,
      nha_du_phong: duLieu.nha_du_phong !== undefined ? duLieu.nha_du_phong : r.nha_du_phong,
      model_du_phong: duLieu.model_du_phong !== undefined ? duLieu.model_du_phong : r.model_du_phong,
    };
    kiemModel(moi.nha, moi.model, 'Model chính');
    if (!Object.hasOwn(MAC_DINH.muc_suy_nghi, moi.muc_suy_nghi)) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Mức suy nghĩ phải là Tắt, Thấp, Vừa hoặc Cao.');
    }
    if (moi.nha_du_phong || moi.model_du_phong) kiemModel(moi.nha_du_phong, moi.model_du_phong, 'Model dự phòng');
    db.prepare('UPDATE agent SET nha = ?, model = ?, muc_suy_nghi = ?, nha_du_phong = ?, model_du_phong = ? WHERE id = ?')
      .run(moi.nha, moi.model, moi.muc_suy_nghi, moi.nha_du_phong || null, moi.model_du_phong || null, id);
    // GD1 (F-121): Bật / Tắt một việc AI ở bảng "AI & kênh" — cùng cờ `bat` mà runtime đã đọc (AGENT_TAT).
    if (duLieu.bat !== undefined) {
      if (typeof duLieu.bat !== 'boolean') throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Bật hay tắt: chọn một.');
      db.prepare('UPDATE agent SET bat = ? WHERE id = ?').run(duLieu.bat ? 1 : 0, id);
    }
    return docAgent(db.prepare('SELECT * FROM agent WHERE id = ?').get(id));
  });
}

/** Các nhà cung cấp đang được dùng (Agent, dự phòng, miệng) — để biết còn thiếu khóa nào. */
function nhaDangDung() {
  const s = new Set();
  for (const a of danhSachAgent()) {
    s.add(a.nha);
    if (a.nha_du_phong) s.add(a.nha_du_phong);
    if (a.nang_cap?.nha) s.add(a.nang_cap.nha);
  }
  s.add(MAC_DINH.mieng.find((x) => x.model === mieng().model).nha);
  return [...s];
}

/* ---------------- sao lưu ---------------- */

function ghiSaoLuu(file) {
  return ghi('sao_luu_cuoi', { luc: gio(), file });
}

/** Nhắc khi quá N ngày chưa sao lưu (F-02). Chưa sao lưu lần nào thì tính từ lúc tạo dữ liệu. */
function trangThaiSaoLuu(bayGio = new Date()) {
  const cuoi = doc('sao_luu_cuoi');
  const moc = new Date(cuoi?.luc || doc('tao_luc') || bayGio);
  const soNgay = Math.floor((bayGio - moc) / 86400000);
  return { cuoi, soNgay, canNhac: soNgay >= MAC_DINH.nhac_sao_luu_sau_ngay, sauNgay: MAC_DINH.nhac_sao_luu_sau_ngay };
}

/** Model rẻ dùng riêng trong Phòng diễn tập cho một Agent (#88), hoặc null nếu Agent đó dùng model thường. */
function modelDienTap(agentId) {
  const m = MAC_DINH.dien_tap_model?.[agentId];
  return m ? { nha: m.nha, model: m.model, muc_suy_nghi: m.muc_suy_nghi, nha_du_phong: m.nha_du_phong || null, model_du_phong: m.model_du_phong || null } : null;
}

module.exports = {
  modelDienTap,
  MAC_DINH, doc, ghi, gieoMacDinh,
  tenAi, datTenAi, banHang, datBanHang, tenShop, danhSachNganHang, taiKhoanNhanTien, thongTinShopConThieu, BAN_HANG_MAC_DINH, XUNG_HO, khanCap, datKhanCap, lyDoKhanCap, dungAi, datDungAi, mieng, datMieng, datGiongElevenMai, doTrePhat, datDoTrePhat,
  giaoDien, datGiaoDien, PHAN_AN_DUOC, tyGiaVnd, datTyGiaVnd,
  danhSachAgent, layAgent, suaAgent, nhaDangDung, ghiSaoLuu, trangThaiSaoLuu,
};
