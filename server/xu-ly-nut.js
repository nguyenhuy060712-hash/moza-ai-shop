'use strict';

/**
 * Xử lý nút khách bấm trong Messenger — ở MỘT nơi (SPEC.md F-65, #95). Bảng loại nút → hàm (nghiep-vu/nut-bam.js đọc payload).
 * Mọi câu trả lời sau khi bấm do mã soạn (cau-mau-khach.json): nhanh, 0 đồng, vẫn chạy khi "Dừng AI". Tư vấn viên chỉ vào cuộc
 * khi khách gõ chữ (hoặc bấm "Sửa đơn"). Mọi nút mang đơn đều kiểm "đơn có phải của người bấm" — nút giả mạo không đổi được đơn.
 * Trả lời nhanh (quick reply) đi cùng đường này.
 */

const hopThu = require('./nghiep-vu/hop-thu');
const don = require('./nghiep-vu/don');
const theDon = require('./nghiep-vu/the-don');
const nutBam = require('./nghiep-vu/nut-bam');
const guiThe = require('./gui-the-don');
const cauMau = require('./nghiep-vu/cau-mau-khach');

/** Đơn thuộc người bấm không (cùng hội thoại, hoặc cùng người Facebook). */
function donCuaNguoi(donId, h) {
  let d;
  try { d = don.layDon(donId); } catch { return null; }
  if (d.hoi_thoai_id !== h.id && (!d.nguoi_fb_id || d.nguoi_fb_id !== h.nguoi_fb_id)) return null;
  return d;
}

/** Bảng loại nút → hàm xử lý. Mốc sau đăng ký thêm bằng `dangKy`. */
const XU_LY = new Map();

function dangKy(ma, fn) {
  XU_LY.set(ma, fn);
}

/**
 * @param {object} o
 * @param {object} o.h        hội thoại Messenger nơi khách bấm
 * @param {string} o.payload
 * @param {string} o.tinId    tin postback (bằng chứng trong lịch sử đơn)
 * @param {object} o.ht       Hộp thư tự động (layKetNoi, xuLy, canNguoi, phat)
 * @returns {Promise<boolean>}  true nếu đây là nút của MOZA (đã xử lý)
 */
async function xuLyNut({ h, payload, tinId, ht }) {
  const nut = nutBam.docPayload(payload);
  if (!nut) return false;
  const fn = XU_LY.get(nut.ma);
  if (!fn) return false;
  // Khách bấm nút là khách đang tương tác: đơn của người này chuyển sang giữ dài (F-68, #98).
  await fn({ h, nut, tinId, ht, gui: (noiDung, o = {}) => guiThe.guiTinHeThong({ h, noiDung, khoa: `nut:${tinId}${o.them || ''}`, layKetNoi: ht.layKetNoi, ...o }) });
  ht.phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
  return true;
}

/* ---------------- thẻ đơn (#89) ---------------- */

dangKy('XAC_NHAN_DON', async ({ h, nut, tinId, ht, gui }) => {
  const kq = theDon.xacNhanBangNut(h, nut.khoa, tinId);
  await gui(theDon.tinTraLoi(kq));
  // F-97 (chỗ mời c): sau tin cảm ơn, mời nhận 1 tin khi buổi live kế lên sóng (chỉ khi buổi trong 23 giờ tới).
  if (kq.ket_qua === 'da_xac_nhan' && ht.moiBaoLive) await ht.moiBaoLive({ h }).catch(() => false);
  if (kq.ket_qua === 'don_da_doi') await guiThe.guiTheDon({ d: kq.don, layKetNoi: ht.layKetNoi });
  if (kq.ket_qua === 'khong_xac_nhan_duoc') await ht.canNguoi(h.id, `Khách bấm "Xác nhận đơn" nhưng chưa xác nhận được: ${kq.ly_do || ''}`);
  else hopThu.datTrangThai(h.id, 'xong');
  ht.phat('don.cap_nhat', { don_id: kq.don?.id || null });
});

/* ---------------- chuyển khoản (F-89, #112) ---------------- */

// [💳 Chuyển khoản]: xác nhận đơn (thanh toán chuyển khoản) rồi gửi ảnh VietQR + tin chữ. Khách từng hoàn nhiều → không gửi QR.
dangKy('CK_DON', async ({ h, nut, tinId, ht, gui }) => {
  const kq = theDon.xacNhanBangNut(h, nut.khoa, tinId, { thanhToan: 'chuyen_khoan' });
  if (kq.ket_qua === 'da_xac_nhan') {
    await require('./chuyen-khoan').guiMaChuyenKhoan({ h, d: kq.don, layKetNoi: ht.layKetNoi, khoa: `nut:${tinId}` });
    hopThu.datTrangThai(h.id, 'xong');
  } else if (kq.ket_qua === 'can_goi') {
    await gui(cauMau.cau('ck_can_goi', { ma: kq.don.ma }));
  } else {
    await gui(theDon.tinTraLoi(kq));
    if (kq.ket_qua === 'don_da_doi') await guiThe.guiTheDon({ d: kq.don, layKetNoi: ht.layKetNoi });
    if (kq.ket_qua === 'khong_xac_nhan_duoc') await ht.canNguoi(h.id, `Khách bấm "Chuyển khoản" nhưng chưa xác nhận được: ${kq.ly_do || ''}`);
  }
  ht.phat('don.cap_nhat', { don_id: kq.don?.id || null });
});

// [🔁 Trả khi nhận hàng]: đổi về COD, trạng thái đơn giữ nguyên. Shop đã đánh dấu nhận tiền thì không đổi.
dangKy('DOI_COD', async ({ h, nut, ht, gui }) => {
  const d = donCuaNguoi(nut.don, h);
  if (!d) return khongPhaiCuaBan(gui);
  if (!['cho_xac_nhan', 'da_xac_nhan'].includes(d.trang_thai)) { await gui(cauMau.cau('nut_khong_con_don')); return; }
  if (d.da_nhan_tien_luc) { await gui(cauMau.cau('doi_cod_da_nhan', { ma: d.ma })); return; }
  const x = d.thanh_toan === 'cod' ? d : don.datThongTinGiao(d.id, { thanhToan: 'cod' }, { boi: 'ai' });
  const { hienTien } = require('./nghiep-vu/chung');
  await gui(cauMau.cau('doi_cod_xong', { ma: x.ma, tong: hienTien(x.tong_tien) }));
  ht.phat('don.cap_nhat', { don_id: x.id });
});

dangKy('SUA_DON', async ({ h, nut, ht }) => {
  const d = donCuaNguoi(nut.don, h);
  await ht.xuLy(h.id, {
    kichHoat: 'Khách bấm "Sửa đơn"',
    viec: `Khách vừa bấm "Sửa đơn" trên thẻ đơn ${d?.ma || ''}. Hỏi ngắn khách muốn sửa gì (món, màu, size, số lượng, người nhận, địa chỉ, thanh toán) rồi sửa bằng cap_nhat_don (bằng chứng là tin khách nói muốn sửa). Sửa xong MOZA tự gửi lại thẻ đơn mới.`,
  });
});

// Nút trong mẫu Utility "đơn đang chờ xác nhận" (payload cố định): đơn chờ xác nhận mới nhất của người bấm.
function donChoCuaNguoi(h) {
  const d = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
  return d && d.trang_thai === 'cho_xac_nhan' ? d : null;
}

dangKy('MAU_XAC_NHAN', async ({ h, tinId, ht, gui }) => {
  const d = donChoCuaNguoi(h);
  if (!d) { await gui(cauMau.cau('nut_khong_con_don')); return; }
  const kq = theDon.xacNhanBangNut(h, theDon.khoaPhienBan(d), tinId);
  await gui(theDon.tinTraLoi(kq));
  if (kq.ket_qua === 'khong_xac_nhan_duoc') await ht.canNguoi(h.id, `Khách bấm xác nhận trên mẫu tin nhưng chưa xác nhận được: ${kq.ly_do || ''}`);
  ht.phat('don.cap_nhat', { don_id: d.id });
});

dangKy('MAU_SUA', async ({ h, ht }) => {
  const d = donChoCuaNguoi(h);
  await ht.xuLy(h.id, { kichHoat: 'Khách bấm "Sửa đơn" trên mẫu tin', viec: `Khách bấm "Sửa đơn"${d ? ` cho đơn ${d.ma}` : ''}. Hỏi ngắn khách muốn sửa gì rồi sửa bằng cap_nhat_don.` });
});

/* ---------------- thẻ giữ hàng (F-68), thẻ mời (F-71) ---------------- */

const sp = require('./nghiep-vu/san-pham');
const kho = require('./nghiep-vu/kho');
const live = require('./nghiep-vu/live');
const theGiu = require('./nghiep-vu/the-giu-hang');
const { LoiNghiepVu } = require('./nghiep-vu/chung');

const baoDon = (ht, d) => { ht.phat('don.cap_nhat', { don_id: d?.id || null }); ht.phat('kho.cap_nhat', {}); };
const monCua = (d, plId) => {
  const x = d.dong.find((y) => y.phan_loai_id === plId) || d.dong[0];
  const s = sp.laySanPham(x.san_pham_id);
  const pl = kho.conHang(s.id).find((y) => y.id === x.phan_loai_id) || sp.phanLoaiCua(s.id).find((y) => y.id === x.phan_loai_id);
  return { s, pl, x };
};

/**
 * F-90: lần tương tác đầu của khách với đơn mới mà người này còn đơn mở chưa gửi ở buổi khác / từ tin nhắn → hỏi MỘT lần
 * [🔗 Gộp] [Tách riêng] (không bấm = tách). Gửi trước tin xin thông tin / thẻ đơn của đơn mới.
 */
async function hoiGop({ d, gui }) {
  if (d.hoi_gop_luc || d.trang_thai !== 'cho_xac_nhan') return;
  const cu = don.donMoKhac(d);
  if (!cu) return;
  don.ghiHoiGop(d.id);
  const monCu = cu.dong.map((x) => x.ten_chup.replace(/^Số (\d+) · .*? · /, 'số $1 ')).join(', ').slice(0, 120);
  await gui(null, { them: ':gop', the: { kieu: 'nut', chu: cauMau.cau('hoi_gop', { ma_cu: cu.ma, mon_cu: monCu }), nut: [
    { tieu_de: cauMau.cau('nut_gop'), payload: nutBam.taoPayload('GOP_DON', { tu: d.id, vao: cu.id }) },
    { tieu_de: cauMau.cau('nut_tach'), payload: nutBam.taoPayload('TACH_DON', { tu: d.id }) },
  ] } });
}

/** Đã giữ: đủ tên / số / địa chỉ thì gửi thẻ đơn (#89); còn thiếu thì xin bằng câu mẫu. */
async function xinThongTinHoacThe({ h, d, gui, ht, monChu }) {
  await hoiGop({ d, gui });
  const thieu = don.viecConThieu(d);
  if (!thieu.length) {
    await gui(cauMau.cau('da_du_thong_tin'));
    await guiThe.guiTheDon({ d, layKetNoi: ht.layKetNoi });
    return;
  }
  // F-88: tin xin thông tin một chạm (nút Gọi shop, trả lời nhanh số Messenger / Như đơn trước / Dùng số) — do mã soạn.
  const the = require('./nghiep-vu/the-xin-thong-tin').theXinThongTin(d, { monChu, giuDen: theGiu.gioChu(d.giu_den) });
  await gui(null, { the });
  hopThu.datTrangThai(h.id, 'cho_phan_hoi');
}

async function khongPhaiCuaBan(gui) {
  await gui(cauMau.cau('nut_khong_phai_cua_ban'));
}

dangKy('GIU_LEN_DON', async ({ h, nut, ht, gui }) => {
  const d0 = donCuaNguoi(nut.don, h);
  if (!d0) return khongPhaiCuaBan(gui);
  if (d0.trang_thai !== 'cho_xac_nhan') { await gui(cauMau.cau('nut_khong_con_don')); return; }
  const d = don.batDauGiuDai(d0.id);
  require('./nghiep-vu/cho-hang').daNhan(d.id); // F-92: bấm Giữ trên thẻ mời của danh sách chờ
  const { s, pl, x } = monCua(d);
  await xinThongTinHoacThe({ h, d, gui, ht, monChu: d.dong.length > 1 ? `${d.dong.length} món` : `${theGiu.tenMonNgan(s, pl)}${x.so_luong > 1 ? ` x${x.so_luong}` : ''}` });
  baoDon(ht, d);
});

/* ---------------- hỏi lại trước khi gửi (F-99), hỏi thăm sau gửi (F-100) ---------------- */

/** Đơn của người bấm cho nút mẫu Utility (payload cố định): đơn mới nhất thỏa điều kiện. */
function donMauCuaNguoi(h, dk) {
  return don.donCuaNguoi({ khachId: h.khach_id, nguoiFbId: h.nguoi_fb_id }).find(dk) || null;
}

async function traLoiHoiLai({ h, d, tinId, gui }, dongY) {
  if (!d) return khongPhaiCuaBan(gui);
  if (d.trang_thai !== 'da_xac_nhan') { await gui(cauMau.cau('nut_khong_con_don')); return; }
  don.ghiHoiLai(d.id, dongY ? 'dong_y' : 'hen_ngay', { nguon: 'khach_tu_bao', ghiChu: dongY ? 'Khách bấm "Gửi đi" (hỏi lại trước khi gửi)' : 'Khách bấm "Hẹn ngày khác"' });
  if (!dongY) {
    require('./nghiep-vu/khach').taoViec({ loai: 'hen_ngay_gui', noiDung: `Khách muốn hẹn ngày khác để nhận đơn ${d.ma}: xem tin khách nhắn ngày nào rồi ghi vào đơn.`,
      khachId: d.khach_id, hoiThoaiId: h.id, donId: d.id, taoBoi: 'ai', dienTap: d.dien_tap });
  }
  await gui(cauMau.cau(dongY ? 'hoi_lai_dong_y' : 'hoi_lai_hen_ngay', { ma: d.ma }));
}

dangKy('GUI_DI', ({ h, nut, tinId, gui }) => traLoiHoiLai({ h, d: donCuaNguoi(nut.don, h), tinId, gui }, true));
dangKy('HEN_NGAY', ({ h, nut, tinId, gui }) => traLoiHoiLai({ h, d: donCuaNguoi(nut.don, h), tinId, gui }, false));
dangKy('MAU_GUI_DI', ({ h, tinId, gui }) => traLoiHoiLai({ h, d: donMauCuaNguoi(h, (x) => x.hoi_lai === 'da_hoi'), tinId, gui }, true));
dangKy('MAU_HEN_NGAY', ({ h, tinId, gui }) => traLoiHoiLai({ h, d: donMauCuaNguoi(h, (x) => x.hoi_lai === 'da_hoi'), tinId, gui }, false));

/** Trích mục Sổ tay "Đổi trả" (≤ 400 ký tự, cắt ở dấu chấm) cho câu trả lời "Hơi chật / Hơi rộng". */
function trichDoiTra() {
  const m = require('./nghiep-vu/so-tay').danhSachMuc().find((x) => /đổi trả/i.test(x.tieu_de) && x.noi_dung.trim());
  if (!m) return '';
  let t = m.noi_dung.trim().replace(/\s+/g, ' ');
  if (t.length > 400) { const cat = t.slice(0, 400).lastIndexOf('.'); t = cat > 50 ? t.slice(0, cat + 1) : `${t.slice(0, 397)}…`; }
  return `${t} `;
}

async function traLoiHoiMac({ h, d, kieu, gui }) {
  if (!d) return khongPhaiCuaBan(gui);
  don.ghiPhanHoiMac(d.id, kieu);
  if (kieu === 'vua') { await gui(cauMau.cau('mac_vua')); return; }
  require('./nghiep-vu/khach').taoViec({ loai: 'doi_size', noiDung: `Khách báo đơn ${d.ma} mặc ${kieu === 'chat' ? 'hơi chật' : 'hơi rộng'}: nhắn khách đổi size theo chính sách đổi trả.`,
    hanLuc: new Date(Date.now() + 24 * 3600e3).toISOString(), khachId: d.khach_id, hoiThoaiId: h.id, donId: d.id, taoBoi: 'ai', dienTap: d.dien_tap });
  await gui(cauMau.cau('mac_doi', { doi_tra: trichDoiTra() }));
}

dangKy('HOI_MAC', ({ h, nut, gui }) => traLoiHoiMac({ h, d: donCuaNguoi(nut.don, h), kieu: ['vua', 'chat', 'rong'].includes(nut.kieu) ? nut.kieu : 'vua', gui }));
for (const [ma, kieu] of [['MAU_VUA', 'vua'], ['MAU_CHAT', 'chat'], ['MAU_RONG', 'rong']]) {
  dangKy(ma, ({ h, gui }) => traLoiHoiMac({ h, d: donMauCuaNguoi(h, (x) => x.hoi_mac_luc && !x.phan_hoi_mac), kieu, gui }));
}

/* ---------------- báo live cho người đã đồng ý (F-97) ---------------- */

async function traLoiMoiLive({ h, nut, tinId, gui }, traLoi) {
  const dongY = require('./nghiep-vu/dong-y');
  let d;
  try { d = dongY.traLoi(nut.dy, h.nguoi_fb_id, traLoi, tinId); } catch { return khongPhaiCuaBan(gui); }
  const ke = require('./nghiep-vu/lich-live').khopBuoi(d.buoi) || require('./nghiep-vu/lich-live').buoiKe();
  await gui(cauMau.cau(traLoi === 'dong_y' ? 'da_dong_y_bao_live' : 'thoi_bao_live', { lich: ke?.chu || 'giờ live' }));
}

dangKy('BAO_LIVE', (o) => traLoiMoiLive(o, 'dong_y'));
dangKy('THOI_BAO_LIVE', (o) => traLoiMoiLive(o, 'thoi'));

/* ---------------- danh sách chờ khi hết hàng (F-92) ---------------- */

dangKy('VAN_CHO', async ({ h, nut, ht, gui }) => {
  const choHang = require('./nghiep-vu/cho-hang');
  const pl = kho.phanLoai(nut.pl);
  if (!pl) { await gui(cauMau.cau('nut_het_han')); return; }
  const s = sp.laySanPham(pl.san_pham_id);
  const mon = theGiu.tenMonNgan(s, pl);
  try {
    const kq = choHang.them({ plId: pl.id, sl: Math.max(1, Math.min(100, Number(nut.sl) || 1)), nguoiFbId: h.nguoi_fb_id, hoiThoaiId: h.id, phienId: nut.phien || null, blId: nut.bl || null, dienTap: h.dien_tap });
    // Còn hàng ngay lúc bấm → đã có lời mời (thẻ mời gửi ngay sau), không cần báo số thứ tự.
    if (kq.cho.trang_thai === 'cho') await gui(cauMau.cau('cho_so', { n: kq.so, mon }));
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    await gui(cauMau.cau(e.ma === 'CHO_DAY' ? 'cho_day' : 'nut_het_han', { mon }));
  }
  ht.phat('kho.cap_nhat', {});
});

dangKy('DOI_MON', async ({ h, nut, ht, gui }) => {
  const d0 = donCuaNguoi(nut.don, h);
  if (!d0) return khongPhaiCuaBan(gui);
  if (!['cho_xac_nhan', 'da_xac_nhan'].includes(d0.trang_thai)) { await gui(cauMau.cau('nut_khong_con_don')); return; }
  const d = don.batDauGiuDai(d0.id);
  const { s, pl } = monCua(d, nut.pl);
  const nhanh = kho.conHang(s.id).filter((y) => y.con_ban_duoc > 0 && y.id !== pl.id).slice(0, theGiu.TOI_DA_NHANH)
    .map((y) => ({ tieu_de: (y.gt2 ? `${y.gt1}/${y.gt2}` : y.gt1).slice(0, 20), payload: nutBam.taoPayload('DOI_PL', { don: d.id, tu: pl.id, den: y.id }) }));
  if (!nhanh.length) { await gui(cauMau.cau('doi_het_loai', { sp: theGiu.goiNgan(s) })); return; }
  await gui(null, { the: { kieu: 'chu', chu: cauMau.cau('doi_chon', { mon: theGiu.tenMonNgan(s, pl) }), tra_loi_nhanh: nhanh } });
});

dangKy('DOI_PL', async ({ h, nut, ht, gui }) => {
  const d0 = donCuaNguoi(nut.don, h);
  if (!d0) return khongPhaiCuaBan(gui);
  try {
    const d = don.doiPhanLoai(d0.id, nut.tu, nut.den);
    const { s, pl } = monCua(d, nut.den);
    await gui(cauMau.cau('da_doi', { mon: theGiu.tenMonNgan(s, pl), giu_den: theGiu.gioChu(d.giu_den) }));
    if (!don.viecConThieu(d).length) await guiThe.guiTheDon({ d, layKetNoi: ht.layKetNoi });
    baoDon(ht, d);
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    const { s, pl } = monCua(d0, nut.tu);
    const moi = kho.conHang(s.id).find((y) => y.id === nut.den);
    const nhanh = kho.conHang(s.id).filter((y) => y.con_ban_duoc > 0 && y.id !== pl.id && y.id !== nut.den).slice(0, theGiu.TOI_DA_NHANH)
      .map((y) => ({ tieu_de: (y.gt2 ? `${y.gt1}/${y.gt2}` : y.gt1).slice(0, 20), payload: nutBam.taoPayload('DOI_PL', { don: d0.id, tu: pl.id, den: y.id }) }));
    const chu = e.ma === 'HET_HANG' && moi ? cauMau.cau('het_hang', { mon: theGiu.tenMonNgan(s, moi), sp: theGiu.goiNgan(s) }) : cauMau.cau('nut_het_han');
    await gui(null, { the: nhanh.length ? { kieu: 'chu', chu, tra_loi_nhanh: nhanh } : { kieu: 'chu', chu } });
  }
});

dangKy('KHONG_LAY', async ({ h, nut, tinId, ht, gui }) => {
  const d = donCuaNguoi(nut.don, h);
  if (!d) return khongPhaiCuaBan(gui);
  if (!['cho_xac_nhan', 'da_xac_nhan'].includes(d.trang_thai)) { await gui(cauMau.cau('nut_khong_con_don')); return; }
  const lienHe = require('./nghiep-vu/lien-he');
  lienHe.ghi({ nguoiFbId: h.nguoi_fb_id, donId: d.id, phienLiveId: d.phien_live_id, loai: 'khong_lay' });
  const conMon = d.dong.filter((x) => x.phan_loai_id !== nut.pl);
  const coMon = d.dong.some((x) => x.phan_loai_id === nut.pl);
  // Thẻ cũ (khách đã đổi phân loại sau đó): đơn một món thì vẫn hiểu là không lấy cả đơn; nhiều món thì hỏi lại.
  if (nut.pl && !coMon && d.dong.length > 1) { await gui(cauMau.cau('nut_het_han')); return; }
  if (!nut.pl || !conMon.length || !coMon) {
    // Còn mỗi món đó: hủy đơn (nguồn khách tự báo, bằng chứng là tin bấm nút) — hàng về còn bán được ngay, hết nhắc đơn.
    const x = don.doiTrangThai(d.id, 'da_huy', { nguon: 'khach_tu_bao', bangChung: tinId, ghiChu: 'Khách bấm "Không lấy"' });
    await gui(cauMau.cau('khong_lay_huy', { ma: x.ma }));
    baoDon(ht, x);
    return;
  }
  const { s, pl } = monCua(d, nut.pl);
  const x = don.botMon(d.id, nut.pl);
  await gui(cauMau.cau('khong_lay_bo_mon', { mon: theGiu.tenMonNgan(s, pl) }));
  if (!don.viecConThieu(x).length) await guiThe.guiTheDon({ d: x, layKetNoi: ht.layKetNoi });
  baoDon(ht, x);
});

/** Khách chọn phân loại (chốt thiếu màu / size, hết hàng → chọn loại khác) hoặc bấm [Giữ cho mình] trên thẻ mời: giữ ngay. */
async function giuTheoChon({ h, phienId, plId, sl, blId, ht, gui }) {
  let p = null;
  try { p = phienId ? live.layPhien(phienId) : null; } catch { p = null; }
  const pl = kho.phanLoai(plId);
  let d = p ? don.donMoTrongPhien(h.nguoi_fb_id, p.id) : don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
  try {
    if (d && ['cho_xac_nhan', 'da_xac_nhan'].includes(d.trang_thai)) d = don.themMon(d.id, plId, sl);
    else {
      d = don.taoDon({ mon: [{ phan_loai_id: plId, so_luong: sl }], nguon: p ? 'binh_luan_live' : 'tin_nhan', pageId: h.page_id, nguoiFbId: h.nguoi_fb_id,
        khachId: h.khach_id, hoiThoaiId: h.id, phienLiveId: p?.id || null, binhLuanId: blId || null, dienTap: h.dien_tap });
    }
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    // Vừa hết lúc bấm: báo hết + lựa chọn còn hàng (không lỗi).
    const plX = pl;
    const s = plX ? sp.laySanPham(plX.san_pham_id) : null;
    if (s) await gui(null, { the: theGiu.theHetHang({ s, pl: plX, p, bl: blId, sl, con: e.ma === 'KHONG_DU_HANG' ? (kho.conHang(s.id).find((y) => y.id === plId)?.con_ban_duoc ?? 0) : 0, choDuoc: !!p }) });
    else await gui(cauMau.cau('nut_het_han'));
    return;
  }
  d = don.batDauGiuDai(d.id);
  const x = d.dong.find((y) => y.phan_loai_id === plId);
  const s = sp.laySanPham(x.san_pham_id);
  const plMoi = kho.conHang(s.id).find((y) => y.id === plId);
  if (blId) { try { live.ganChot(blId, { donId: d.id, xuLy: 'da_chot' }); } catch { /* bình luận không còn */ } }
  await xinThongTinHoacThe({ h, d, gui, ht, monChu: `${theGiu.tenMonNgan(s, plMoi)}${x.so_luong > 1 ? ` x${x.so_luong}` : ''}` });
  baoDon(ht, d);
}

dangKy('CHON_PL', ({ h, nut, ht, gui }) => giuTheoChon({ h, phienId: nut.phien, plId: nut.pl, sl: Math.max(1, Math.min(100, Number(nut.sl) || 1)), blId: nut.bl, ht, gui }));

dangKy('GIU_MOI', ({ h, nut, ht, gui }) => giuTheoChon({ h, phienId: nut.phien, plId: nut.pl, sl: 1, blId: null, ht, gui }));

dangKy('XEM_MAU_KHAC', async ({ h, nut, gui }) => {
  let s;
  try { s = sp.laySanPham(nut.sp); } catch { await gui(cauMau.cau('nut_het_han')); return; }
  let p = null;
  try { p = nut.phien ? live.layPhien(nut.phien) : null; } catch { p = null; }
  // Hội thoại đã tự nhận trợ lý AI → được dùng hàng thẻ ảnh theo màu.
  await gui(null, { the: theGiu.theChonPhanLoai({ s, p, dienTap: h.dien_tap, choLuoi: true }) });
});

/* ---------------- nút Bắt đầu của Messenger (F-70) ---------------- */

dangKy('BAT_DAU', async ({ h, gui }) => {
  await gui(cauMau.cau('bat_dau'));
  hopThu.datTrangThai(h.id, 'cho_phan_hoi');
});

/* ---------------- vào từ link m.me của buổi (F-70) ---------------- */

dangKy('DUNG_NGUOI', async ({ h, nut, ht, gui }) => {
  // Chỉ nhận nút MOZA đã gửi vào đúng hội thoại này (payload giả không gắn được đơn của người khác).
  if (!hopThu.daGuiNut(h.id, nutBam.taoPayload('DUNG_NGUOI', { phien: nut.phien, don: nut.don }))) return khongPhaiCuaBan(gui);
  let d;
  try { d = don.layDon(nut.don); } catch { await gui(cauMau.cau('nut_het_han')); return; }
  if (d.phien_live_id !== nut.phien || d.trang_thai !== 'cho_xac_nhan') { await gui(cauMau.cau('nut_khong_con_don')); return; }
  const psid = hopThu.psidCuaNguoi(d.nguoi_fb_id);
  if (psid && psid !== h.fb_thread_id) return khongPhaiCuaBan(gui);
  // Gộp người: người bình luận (đơn) ← người Messenger này; hội thoại, đơn cũ của người Messenger đi theo.
  hopThu.ganPsid(d.nguoi_fb_id, h.fb_thread_id);
  don.ganHoiThoai(d.id, h.id);
  const d2 = don.batDauGiuDai(d.id);
  const h2 = hopThu.layHoiThoai(h.id);
  const { s, pl, x } = monCua(d2);
  await xinThongTinHoacThe({ h: h2, d: d2, gui, ht, monChu: d2.dong.length > 1 ? `${d2.dong.length} món` : `${theGiu.tenMonNgan(s, pl)}${x.so_luong > 1 ? ` x${x.so_luong}` : ''}` });
  baoDon(ht, d2);
});

dangKy('KHONG_PHAI', async ({ h, gui }) => {
  await gui(cauMau.cau('mme_khong_phai'));
  hopThu.ghiChu(h.id, 'Khách bấm "Không phải" khi được hỏi có phải người vừa chốt trên live: không gắn đơn.');
});

/* ---------------- món phối, gộp / tách đơn (F-90) ---------------- */

dangKy('THEM_PHOI', async ({ h, nut, gui }) => {
  const d = donCuaNguoi(nut.don, h);
  if (!d) return khongPhaiCuaBan(gui);
  if (!['cho_xac_nhan', 'da_xac_nhan'].includes(d.trang_thai)) { await gui(cauMau.cau('nut_khong_con_don')); return; }
  let s;
  try { s = sp.laySanPham(nut.sp); } catch { await gui(cauMau.cau('nut_het_han')); return; }
  const ds = kho.conHang(s.id).filter((y) => y.con_ban_duoc > 0);
  if (s.trang_thai !== 'dang_ban' || !ds.length) { await gui(cauMau.cau('doi_het_loai', { sp: theGiu.goiNgan(s) })); return; }
  // Size quen của khách (F-91) đứng đầu; tối đa 12 phân loại.
  const quen = require('./nghiep-vu/khach').sizeQuen?.(d.khach_id, s.danh_muc) || null;
  ds.sort((a, b) => (b.gt2 === quen) - (a.gt2 === quen));
  const nhanh = ds.slice(0, theGiu.TOI_DA_NHANH).map((y) => ({ tieu_de: (y.gt2 ? `${y.gt1}/${y.gt2}` : y.gt1).slice(0, 20), payload: nutBam.taoPayload('CHON_PHOI', { don: d.id, pl: y.id }) }));
  await gui(null, { the: { kieu: 'chu', chu: cauMau.cau('phoi_chon', { sp: theGiu.goiNgan(s) }), tra_loi_nhanh: nhanh } });
});

dangKy('CHON_PHOI', async ({ h, nut, ht, gui }) => {
  const d0 = donCuaNguoi(nut.don, h);
  if (!d0) return khongPhaiCuaBan(gui);
  if (!['cho_xac_nhan', 'da_xac_nhan'].includes(d0.trang_thai)) { await gui(cauMau.cau('nut_khong_con_don')); return; }
  try {
    const d = don.themMon(d0.id, nut.pl, 1, { boi: 'khach' });
    const { s, pl } = monCua(d, nut.pl);
    await gui(cauMau.cau('phoi_da_them', { mon: theGiu.tenMonNgan(s, pl), ma: d.ma }));
    if (!don.viecConThieu(d).length) await guiThe.guiTheDon({ d, layKetNoi: ht.layKetNoi });
    baoDon(ht, d);
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    await gui(cauMau.cau('nut_het_han'));
  }
});

dangKy('GOP_DON', async ({ h, nut, ht, gui }) => {
  const tu = donCuaNguoi(nut.tu, h);
  const vao = donCuaNguoi(nut.vao, h);
  if (!tu || !vao) return khongPhaiCuaBan(gui);
  try {
    const d = don.gopDon(tu.id, vao.id, { boi: 'khach' });
    await gui(cauMau.cau('gop_xong', { ma: d.ma, ma_moi: tu.ma }));
    if (!don.viecConThieu(d).length) await guiThe.guiTheDon({ d, layKetNoi: ht.layKetNoi });
    else {
      const the = require('./nghiep-vu/the-xin-thong-tin').theXinThongTin(d, { monChu: `${d.dong.length} món`, giuDen: theGiu.gioChu(d.giu_den) });
      await gui(null, { the, them: ':thieu' });
    }
    baoDon(ht, d);
    ht.phat('don.cap_nhat', { don_id: tu.id });
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    await gui(cauMau.cau('nut_khong_con_don'));
  }
});

dangKy('TACH_DON', async ({ h, nut, gui }) => {
  const d = donCuaNguoi(nut.tu, h);
  if (!d) return khongPhaiCuaBan(gui);
  await gui(cauMau.cau('tach_xong', { ma: d.ma }));
});

/* ---------------- số đo khách cho lưu (F-91) ---------------- */

dangKy('LUU_SO_DO', async ({ h, nut, gui }) => {
  // Chỉ lưu vào hồ sơ của chính người bấm; công tắc tắt giữa chừng thì không lưu.
  if (!h.khach_id || h.khach_id !== nut.khach) return khongPhaiCuaBan(gui);
  if (!require('./nghiep-vu/cai-dat').banHang().hoi_so_do) { await gui(cauMau.cau('nut_het_han')); return; }
  const kh = require('./nghiep-vu/khach');
  try {
    const x = kh.luuSoDo(h.khach_id, { chieuCao: nut.cao, canNang: nut.nang });
    await gui(cauMau.cau('da_luu_so_do', { cao: x.chieu_cao, nang: x.can_nang }));
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    await gui(cauMau.cau('nut_het_han'));
  }
});

dangKy('KHONG_LUU_SO_DO', async ({ gui }) => { await gui(cauMau.cau('khong_luu_so_do')); });

/* ---------------- ảnh khách mặc thật (F-104, tắt mặc định) ---------------- */

dangKy('ANH_DONG_Y', async ({ h, nut, tinId, ht, gui }) => {
  // Công tắc tắt giữa chừng: không tải, không lưu.
  if (!require('./nghiep-vu/cai-dat').banHang().dung_anh_khach) { await gui(cauMau.cau('nut_het_han')); return; }
  const { taiAnhKhach } = require('./agent/agents/tim-mau');
  const kq = await require('./nghiep-vu/anh-khach').dongY({ lanHoi: nut.lan, nguoiFbId: h.nguoi_fb_id, tinId, taiAnh: (url) => taiAnhKhach(url) });
  if (!kq) { await gui(cauMau.cau('nut_het_han')); return; }
  await gui(cauMau.cau(kq.luu ? 'anh_da_dong_y' : 'anh_loi'));
  ht.phat('anh_khach.cap_nhat', {});
});

dangKy('ANH_KHONG', async ({ h, nut, gui }) => {
  const n = require('./nghiep-vu/anh-khach').tuChoi({ lanHoi: nut.lan, nguoiFbId: h.nguoi_fb_id });
  await gui(cauMau.cau(n ? 'anh_khong' : 'nut_het_han'));
});

/* ---------------- Messenger một chạm (F-88) ---------------- */

/** Ghi thông tin giao khách chọn qua nút rồi: đủ → thẻ đơn; thiếu → hỏi đúng phần thiếu (kèm nút còn dùng được). */
async function sauKhiGhi({ h, d, gui, ht }) {
  baoDon(ht, d);
  if (!don.viecConThieu(d).length) { await guiThe.guiTheDon({ d, layKetNoi: ht.layKetNoi }); return; }
  const the = require('./nghiep-vu/the-xin-thong-tin').theXinThongTin(d, { monChu: d.dong.length > 1 ? `${d.dong.length} món` : d.dong[0]?.ten_chup || 'đơn', giuDen: theGiu.gioChu(d.giu_den) });
  await gui(null, { the, them: ':thieu' });
}

dangKy('NHU_DON_TRUOC', async ({ h, nut, ht, gui }) => {
  const d0 = donCuaNguoi(nut.don, h);
  if (!d0) return khongPhaiCuaBan(gui);
  if (d0.trang_thai !== 'cho_xac_nhan') { await gui(cauMau.cau('nut_khong_con_don')); return; }
  const cu = don.donCuDaGiao({ khachId: d0.khach_id, nguoiFbId: d0.nguoi_fb_id, truId: d0.id });
  if (!cu) { await gui(cauMau.cau('nut_het_han')); return; }
  const { ghiThongTinGiao } = require('./nghiep-vu/thong-tin-giao');
  const d = ghiThongTinGiao({ h, d: d0, ten: cu.ten_nhan, sdt: cu.sdt_nhan, diaChi: cu.dia_chi_nhan, boi: 'ai' });
  await gui(cauMau.cau('da_ghi_nhu_don_truoc', { ma_cu: cu.ma }));
  await sauKhiGhi({ h, d: don.layDon(d.id), gui, ht });
});

dangKy('DUNG_SO', async ({ h, nut, ht, gui }) => {
  const d0 = donCuaNguoi(nut.don, h);
  if (!d0) return khongPhaiCuaBan(gui);
  if (d0.trang_thai !== 'cho_xac_nhan' || !d0.sdt_goi_y) { await gui(cauMau.cau('nut_khong_con_don')); return; }
  const { ghiThongTinGiao } = require('./nghiep-vu/thong-tin-giao');
  const d = ghiThongTinGiao({ h, d: d0, sdt: d0.sdt_goi_y, boi: 'ai' });
  await sauKhiGhi({ h, d: don.layDon(d.id), gui, ht });
});

/** Khách chọn số Messenger tự điền (trả lời nhanh user_phone_number): payload là số. @returns {Promise<boolean>} */
async function xuLySdtNhanh({ h, so, ht, tinId }) {
  const d0 = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
  if (!d0 || d0.trang_thai !== 'cho_xac_nhan') return false;
  const { ghiThongTinGiao } = require('./nghiep-vu/thong-tin-giao');
  let d;
  try { d = ghiThongTinGiao({ h, d: d0, sdt: so, boi: 'ai' }); } catch { return false; }
  const gui = (noiDung, o = {}) => guiThe.guiTinHeThong({ h, noiDung, khoa: `nut:${tinId}${o.them || ''}`, layKetNoi: ht.layKetNoi, ...o });
  await sauKhiGhi({ h, d: don.layDon(d.id), gui, ht });
  ht.phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
  return true;
}

// Menu cố định (Messenger Profile): Đơn của tôi · Gặp người thật · Xóa dữ liệu của tôi — bằng mã, 0 AI.
dangKy('MENU_DON', async ({ h, gui }) => {
  const ds = don.donCuaNguoi({ khachId: h.khach_id, nguoiFbId: h.nguoi_fb_id });
  if (!ds.length) { await gui(cauMau.cau('menu_chua_co_don')); return; }
  const { hienTien } = require('./nghiep-vu/chung');
  const dong = ds.map((x) => `• ${x.ma} · ${don.TEN_TRANG_THAI[x.trang_thai]} · ${hienTien(x.tong_tien)}${x.ma_van_don ? ` · mã vận đơn ${x.ma_van_don}` : ''}`);
  await gui(`${cauMau.cau('menu_don_cua_ban')}\n${dong.join('\n')}`.slice(0, 640));
});

dangKy('MENU_NGUOI', async ({ h, ht, gui }) => {
  await ht.canNguoi(h.id, 'Khách bấm "Gặp người thật" trong menu Messenger.');
  const goi = require('./nghiep-vu/the-xin-thong-tin').nutGoiShop();
  await gui(null, { the: goi ? { kieu: 'nut', chu: cauMau.cau('menu_da_bao_nguoi'), nut: [goi] } : { kieu: 'chu', chu: cauMau.cau('menu_da_bao_nguoi') } });
});

dangKy('MENU_XOA', async ({ gui }) => {
  await gui(null, { the: { kieu: 'nut', chu: cauMau.cau('menu_xoa_hoi'), nut: [
    { tieu_de: cauMau.cau('nut_xac_nhan_xoa'), payload: nutBam.taoPayload('XAC_NHAN_XOA', {}) },
    { tieu_de: cauMau.cau('nut_thoi'), payload: nutBam.taoPayload('THOI_XOA', {}) },
  ] } });
});

dangKy('XAC_NHAN_XOA', async ({ h, ht, gui }) => {
  await taoViecXoaDuLieu({ h, ht });
  await gui(cauMau.cau('menu_xoa_da_nhan'));
});

dangKy('THOI_XOA', async ({ gui }) => { await gui(cauMau.cau('menu_xoa_thoi')); });

/**
 * Yêu cầu xóa dữ liệu (menu hoặc khách tự gõ): việc "Xóa dữ liệu" hạn 72 giờ cho người + Cần người. Không tự xóa — còn đơn chưa
 * xong thì phải xong hoặc hủy trước (F-54).
 */
async function taoViecXoaDuLieu({ h, ht }) {
  const kh = require('./nghiep-vu/khach');
  kh.xoaSoDo(h.khach_id); // F-91: số đo xóa ngay; phần còn lại người xử lý
  const mo = don.donCuaNguoi({ khachId: h.khach_id, nguoiFbId: h.nguoi_fb_id }).filter((x) => ['cho_xac_nhan', 'da_xac_nhan', 'da_gui'].includes(x.trang_thai));
  kh.taoViec({ loai: 'xoa_du_lieu', noiDung: `Khách yêu cầu xóa dữ liệu — xử lý trong 72 giờ: mở hồ sơ, bấm "Xóa dữ liệu người này", rồi nhắn báo đã xóa.${mo.length ? ` Còn ${mo.length} đơn chưa xong (${mo.map((x) => x.ma).join(', ')}): xong hoặc hủy trước.` : ''}`,
    hanLuc: new Date(Date.now() + 72 * 3600e3).toISOString(), khachId: h.khach_id, hoiThoaiId: h.id, taoBoi: 'ai' });
  await ht.canNguoi(h.id, 'Người này yêu cầu xóa dữ liệu (hạn 72 giờ): mở hồ sơ, bấm "Xóa dữ liệu người này", rồi nhắn báo đã xóa.');
}

/* ---------------- đặt lại đơn đã hủy vì quá giờ (F-69) ---------------- */

dangKy('DAT_LAI', async ({ h, nut, ht, gui }) => {
  const cu = donCuaNguoi(nut.don, h);
  if (!cu) return khongPhaiCuaBan(gui);
  try {
    const d = don.datLai(cu.id, { hoiThoaiId: h.id });
    await gui(cauMau.cau('dat_lai_xong', { ma: d.ma, giu_den: theGiu.gioChu(d.giu_den) }));
    if (!don.viecConThieu(d).length) await guiThe.guiTheDon({ d, layKetNoi: ht.layKetNoi });
    baoDon(ht, d);
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    if (e.ma === 'QUA_HAN') { await gui(cauMau.cau('dat_lai_qua_han')); return; }
    if (e.ma === 'HET_HANG' || e.ma === 'KHONG_DU_HANG') {
      const conDu = (y) => (kho.conHang(y.san_pham_id).find((z) => z.id === y.phan_loai_id)?.con_ban_duoc ?? 0) >= y.so_luong;
      const x = cu.dong.find((y) => !conDu(y)) || cu.dong[0];
      const s = sp.laySanPham(x.san_pham_id);
      const plX = kho.phanLoai(x.phan_loai_id);
      const nhanh = theGiu.nhanhPhanLoai(s, { p: null, sl: x.so_luong, bl: '', tru: plX.id });
      await gui(null, { the: { kieu: 'chu', chu: cauMau.cau('dat_lai_het', { mon: theGiu.tenMonNgan(s, plX) }), ...(nhanh.length ? { tra_loi_nhanh: nhanh } : {}) } });
      return;
    }
    await gui(cauMau.cau('nut_khong_con_don'));
  }
});

module.exports = { xuLySdtNhanh, taoViecXoaDuLieu, xuLyNut, dangKy, donCuaNguoi, donChoCuaNguoi, XU_LY, giuTheoChon };
