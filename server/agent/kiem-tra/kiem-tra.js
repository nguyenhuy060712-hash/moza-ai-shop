'use strict';

/**
 * Bộ kiểm tra (SPEC.md A.4 bản bán hàng, F-10): luật cứng cho mọi câu AI đưa ra ngoài — câu Co-host (trước khi hiện lên
 * màn hình người dẫn hoặc vào miệng), tin Messenger, trả lời bình luận, nhắn riêng. Chạy trong hook bắt buộc ở cửa
 * `truoc_cong_cu`. Đọc lại cơ sở dữ liệu ngay lúc kiểm: sản phẩm vừa Ngừng bán 1 giây trước cũng bị chặn, số còn so với
 * còn bán được đúng lúc kiểm.
 *
 * Nguồn trích (K2): thẻ sản phẩm (đúng bản sửa của phiên live, trừ ô "AI đoán" chưa xác nhận) + còn bán được lúc kiểm,
 * mục Sổ tay, dòng Cài đặt → Bán hàng (phí ship), khối đơn "DH-xxxx" (đọc lại đơn lúc kiểm — K10). Bộ nhớ khách không
 * bao giờ là nguồn cho giá, số còn, tổng tiền.
 *
 * K11 (F-79): từ cấm — thương hiệu khác, từ tuyệt đối, so sánh luôn chặn; xuất xứ, công dụng chặn trừ khi trích đúng dòng thẻ
 * sản phẩm / Sổ tay có cụm đó (server/cau-hinh/tu-cam.json).
 *
 * Trả về { dat, giu, loi: [{ ma: 'K1'…'K11', thong_diep }] }. `giu` (K7) = chờ, không phải sai.
 */

const sp = require('../../nghiep-vu/san-pham');
const kho = require('../../nghiep-vu/kho');
const soTay = require('../../nghiep-vu/so-tay');
const live = require('../../nghiep-vu/live');
const caiDat = require('../../nghiep-vu/cai-dat');
const { coThongTinCaNhan } = require('../../nghiep-vu/nhan-binh-luan');
const { chuan, boDau, hienTien } = require('../../nghiep-vu/chung');
const { soKhongCoTrongNguon, laySo } = require('./quy-doi-so');

// song = câu trên sóng (gợi ý cho người dẫn hoặc miệng nói); binh_luan = trả lời công khai.
const KENH = {
  song: { congKhai: true, trenSong: true, toiDaKyTu: 300, toiDaCau: 3 },
  binh_luan: { congKhai: true, toiDaKyTu: 1000 },
  nhan_rieng: { toiDaKyTu: 1000 },
  messenger: { toiDaKyTu: 1000 },
};

// So trích dẫn sau NFC và gộp khoảng trắng (A.4 K2).
function gon(s) {
  return chuan(s).replace(/\s+/g, ' ').trim();
}

/** Dòng dữ liệu MOZA tự sinh từ Cài đặt → Bán hàng (nguồn "cai_dat"): phí ship đồng giá, miễn phí từ (#63). */
function dongCaiDat() {
  const b = caiDat.banHang();
  const ds = [];
  if (b.phi_ship != null) ds.push(`Phí ship: ${hienTien(b.phi_ship)}`);
  if (b.mien_phi_tu != null) ds.push(`Miễn phí ship cho đơn từ ${hienTien(b.mien_phi_tu)}`);
  if (b.gio_giu) ds.push(`Giữ hàng tối đa ${b.gio_giu} giờ cho đơn chờ xác nhận`);
  if (b.gio_nghe_may) ds.push(`Giờ nghe máy: ${b.gio_nghe_may.replace('-', ' – ')}`); // F-95
  const lich = require('../../nghiep-vu/lich-live').dongLich(); // F-96: "Lịch live: 20:00 thứ Ba, thứ Năm hằng tuần; buổi kế …"
  if (lich) ds.push(lich);
  if (b.doi_tra_ngan) ds.push(`Đổi trả: ${b.doi_tra_ngan}`);
  // F-89: chỉ nêu có nhận chuyển khoản và tên chủ TK — số tài khoản không vào nguồn, nên AI tự gõ số tài khoản thì K2 chặn;
  // số tài khoản và mã QR chỉ đi bằng công cụ gui_ma_chuyen_khoan.
  const tk = caiDat.taiKhoanNhanTien();
  if (tk) ds.push(`Tài khoản nhận tiền: ${tk.ten_ngan}, tên ${tk.ten_tk} — số tài khoản và mã QR chỉ gửi bằng công cụ gui_ma_chuyen_khoan`);
  return ds;
}

/** Sản phẩm của một đoạn trích: "12", "số 12", "áo 12", "#12". */
function soCuaNguon(n) {
  const m = /^(?:[\p{L}\s#]*?)(\d{1,5})$/u.exec(String(n ?? '').trim());
  return m ? Number(m[1]) : null;
}

/** Chữ nguồn của một trích dẫn, hoặc null nếu nguồn không hợp lệ. Trên sóng dùng bản sửa lúc bắt đầu phiên. */
function chuNguon(nguon, { phienLiveId }) {
  const n = boDau(nguon).replace(/[\s_-]/g, '');
  const ma = /^dh(\d{1,6})$/.exec(n);
  if (ma) {
    // Đơn: đọc lại đơn ngay lúc kiểm — tổng tiền, phí ship trích phải bằng số của đơn lúc này (K10).
    const don = require('../../nghiep-vu/don');
    let d = null;
    try { d = don.layDon(`DH-${ma[1].padStart(4, '0')}`); } catch { return null; }
    return d ? { loai: 'don', don: d, cacDoan: [don.khoiChoAi(d)] } : null;
  }
  if (n.startsWith('sotay')) return { loai: 'so_tay', cacDoan: soTay.danhSachMuc().map((m) => `${m.tieu_de}\n${m.noi_dung}`) };
  if (n.startsWith('caidat')) return { loai: 'cai_dat', cacDoan: [dongCaiDat().join('\n')] };
  // F-82: số đo người mẫu người dẫn nói trong buổi ("Người mẫu: cao 160 cm (1m60), đang mặc size S của áo số 12"). Chưa có → không hợp lệ.
  if (n.startsWith('nguoimau')) {
    const ds = require('../../nguoi-mau').dongNguon(phienLiveId);
    return ds.length ? { loai: 'nguoi_mau', cacDoan: ds } : null;
  }
  const so = soCuaNguon(nguon);
  const s = so != null ? sp.layTheoSo(so) : null;
  if (!s) return null;
  const pb = phienLiveId ? live.phienBanSanPhamTrongPhien(phienLiveId, s.id) : null;
  const ban = (pb && pb !== s.phien_ban && sp.layBanSua(s.id, pb)) || s;
  // F-93: trên sóng (có phiên) thêm dòng "Giá live buổi này: …" để trích được; Messenger không có dòng này.
  const gl = phienLiveId ? require('../../nghiep-vu/gia-ban').dongGiaLive(phienLiveId, s.id) : null;
  return { loai: 'san_pham', sanPham: s, cacDoan: [[sp.nguonKiemTra({ ...ban, id: s.id }), gl].filter(Boolean).join('\n')] };
}

// K5: xin số điện thoại, địa chỉ ở nơi công khai. So trên chữ bỏ dấu để bắt cả cách gõ không dấu.
const XIN_THONG_TIN = [
  /(xin|cho (em|minh|chi|anh|toi|mai|shop)|de lai|gui|nhan|ghi|comment|cmt|binh luan|inbox|ib|dien|cung cap)[^.?!\n]{0,30}(so dien thoai|sdt|so dt|so zalo|zalo|cccd|can cuoc|cmnd|dia chi)/,
  /(so dien thoai|sdt|so dt|cccd|can cuoc|dia chi)[^.?!\n]{0,20}(cua (ban|em|chi|anh|minh)|la gi|la bao nhieu|bao nhieu|o dau)/,
];

// K9: lời tạo khan hiếm chỉ được nói khi còn bán được thật sự ≤ ngưỡng sắp hết (#71: không tạo khan hiếm giả).
// K12: báo đã nhận tiền (chữ đã bỏ dấu). "Khi / nếu / sau khi đã nhận tiền" là nói trước — không tính.
const DA_NHAN_TIEN = [
  /(?<!(?:khi|neu|luc|de)\s)(?:da|vua)\s+nhan\s+(?:duoc\s+)?(?:tien|ck|chuyen khoan|thanh toan|khoan)/,
  /(?:chuyen khoan|ck|thanh toan)\s+(?:da\s+|den\s+)?thanh cong/,
  /tien\s+(?:da\s+)?ve\s+(?:roi|tai khoan)/,
  /nhan\s+(?:duoc\s+)?(?:tien|ck)\s+(?:cua\s+\S+\s+)?roi/,
];
const KHAN_HIEM = /(sap het|chi con|cuoi cung|con it|con rat it|het nhanh|chay hang|chay size|chay mau)/;
// "còn 3 chiếc", "chỉ còn 2 cái", "còn đúng 1": số còn phải bằng còn bán được lúc kiểm.
const CON_SO = /(?<![a-z])con(?: dung| lai)?\s+(\d{1,4})(?![\d.,])(?!\s*(?:k|nghin|ngan|trieu|tr|d|dong|%|cm|kg)\b)/g;

// Cụm gọi sản phẩm ("số 12", "áo 12", "#12") là tên gọi, không phải con số cần có trong nguồn (K3).
function boGoiSo(cau) {
  const goi = [...new Set(sp.cauHinh().danh_muc.map((d) => d.goi))].map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return String(cau)
    .replace(new RegExp(`(?<![\\p{L}\\d])(?:${goi.join('|')})\\s+(?:số\\s+)?\\d{1,5}(?![\\p{L}\\d])`, 'giu'), ' ')
    .replace(/(?<![\p{L}\d])(?:số|mẫu|mã|sp|so|mau)\s*\d{1,5}(?![\p{L}\d])/giu, ' ')
    .replace(/#\d{1,5}/g, ' ');
}

/**
 * @param {object} o
 * @param {string} o.cau                   câu định đưa ra
 * @param {{nguon:string, doan:string}[]} [o.trich_dan]  nguon = số sản phẩm, "so_tay" hoặc "cai_dat"; doan = chép nguyên văn
 * @param {'song'|'binh_luan'|'nhan_rieng'|'messenger'} [o.kenh]
 * @param {number|null} [o.soDuocGiao]      trên sóng: số sản phẩm Director đã giao
 * @param {string|null} [o.phienLiveId]     để lấy đúng bản sửa sản phẩm lúc bắt đầu phiên
 * @param {string[]} [o.tenNguoi]           tên người bình luận / nhắn tin (K6)
 * @param {number[]} [o.soKhachNoi]         con số khách tự nói trong hội thoại (chiều cao, cân nặng — K3 ngoại lệ, trừ số tiền)
 * @param {boolean} [o.phat]                câu sẽ được miệng nói ra (K7)
 * @param {boolean} [o.duocNoi]             AI đang được phép nói (chế độ, không tạm im, người dẫn không nói)
 */
function kiemTraCau({ cau, trich_dan: trichDan = [], kenh = 'song', soDuocGiao = null, phienLiveId = null,
  tenNguoi = [], soKhachNoi = [], phat = false, duocNoi = true, donCuaKhach = null }) {
  const k = KENH[kenh];
  if (!k) throw new Error(`Kênh lạ: ${kenh}`);
  const s = chuan(cau).trim();
  const loi = [];
  const them = (ma, thongDiep) => loi.push({ ma, thong_diep: thongDiep });
  const dsSp = sp.danhSach().map((x) => ({ ...x, ten_goi_khac: sp.laySanPham(x.id).ten_goi_khac }));

  if (!s) them('K8', 'Câu rỗng.');

  // K1 — mọi sản phẩm được nhắc (theo số hoặc theo tên) phải đang Đang bán, đọc lại cơ sở dữ liệu ngay lúc kiểm.
  const { theoSo, theoTen, soLa } = sp.sanPhamDuocNhac(s, dsSp);
  const duocNhac = [...theoSo, ...theoTen];
  for (const x of duocNhac) {
    if (x.trang_thai !== 'dang_ban') them('K1', `${x.ten_day_du} đang ${sp.TEN_TRANG_THAI[x.trang_thai]}, không được nhắc.`);
  }
  for (const n of soLa) them('K1', `Không có sản phẩm số ${n}.`);

  // K2 — mỗi đoạn trích có nguyên văn trong đúng nguồn đã dẫn.
  const hopLe = Array.isArray(trichDan) ? trichDan : [];
  const spDaTrich = [];
  const donDaTrich = [];
  const doanCoNguon = []; // K11: đoạn trích hợp lệ từ thẻ sản phẩm / Sổ tay
  for (const td of hopLe) {
    const doan = gon(td?.doan);
    if (!doan) { them('K2', 'Có đoạn trích rỗng.'); continue; }
    const n = chuNguon(td.nguon, { phienLiveId });
    if (!n) { them('K2', `Nguồn "${td.nguon}" không phải số sản phẩm, mã đơn, "so_tay", "cai_dat" hay "nguoi_mau" (người dẫn đã nói số đo mẫu).`); continue; }
    if (n.don) {
      donDaTrich.push(n.don);
      // K10: chỉ trích đơn của chính khách đang nhắn; nơi công khai không đọc đơn.
      if (k.congKhai) them('K10', 'Không nói thông tin đơn hàng ở nơi công khai; mời khách nhắn tin cho Page.');
      else if (donCuaKhach && !donCuaKhach.includes(n.don.id)) them('K10', `Đơn ${n.don.ma} không phải đơn của khách này.`);
    }
    if (n.sanPham) {
      spDaTrich.push(n.sanPham);
      if (n.sanPham.trang_thai !== 'dang_ban' && !duocNhac.some((x) => x.id === n.sanPham.id)) {
        them('K1', `Đoạn trích lấy từ ${sp.tenDayDu(n.sanPham)} đang ${sp.TEN_TRANG_THAI[n.sanPham.trang_thai]}.`);
      }
    }
    if (n.cacDoan.some((c) => gon(c).includes(doan)) && (n.loai === 'san_pham' || n.loai === 'so_tay')) doanCoNguon.push(doan);
    if (!n.cacDoan.some((c) => gon(c).includes(doan))) {
      const ten = { so_tay: 'Sổ tay', cai_dat: 'Cài đặt bán hàng' }[n.loai]
        || (n.don ? `đơn ${n.don.ma} lúc này (đơn có thể vừa đổi — xem_don lại)` : `thẻ ${sp.tenDayDu(n.sanPham)}`);
      them('K2', `Đoạn trích "${doan.slice(0, 80)}" không có nguyên văn trong ${ten} (ô "AI đoán" chưa xác nhận và số còn đã cũ không được trích).`);
    }
  }

  // K11 — từ cấm (F-79): luôn chặn thương hiệu / tuyệt đối / so sánh; xuất xứ, công dụng chỉ khi trích đúng nguồn có cụm đó.
  for (const x of require('../../nghiep-vu/tu-cam').timTuCam(s, { nguon: doanCoNguon, congKhai: !!k.congKhai })) them('K11', require('../../nghiep-vu/tu-cam').thongDiep(x));

  // K3 — con số trong câu phải có trong các đoạn trích, sau quy đổi. Số khách tự nói (không phải tiền) được nhắc lại.
  const thua = soKhongCoTrongNguon(boGoiSo(s), hopLe.map((td) => boGoiSo(String(td?.doan ?? ''))))
    .filter((x) => !(x.donVi !== 'tien' && soKhachNoi.some((v) => Math.abs(v - x.giaTri) < 1e-6)));
  if (thua.length) them('K3', `Con số không có trong đoạn trích: ${[...new Set(thua.map((x) => x.chu))].join(', ')}.`);

  // K10 — nói tổng tiền (có số tiền) thì phải trích từ đơn: tổng do MOZA tính, AI không tự cộng.
  if (/\btong\b/.test(boDau(s)) && laySo(s).some((x) => x.donVi === 'tien') && !donDaTrich.length) {
    them('K10', 'Tổng tiền phải trích nguyên văn từ đơn (nguon là mã đơn, ví dụ "DH-0042") — xem_don để lấy.');
  }

  // K12 (F-89, #62) — AI không bao giờ báo "đã nhận tiền": người đối chiếu sao kê, bấm "Đã nhận tiền", MOZA báo bằng câu mẫu.
  if (DA_NHAN_TIEN.some((re) => re.test(boDau(s)))) {
    them('K12', 'Không nói shop đã nhận tiền / chuyển khoản thành công: người của shop đối chiếu rồi MOZA tự báo khách. Nói "shop kiểm tra rồi báo lại".');
  }

  // K4 — trên sóng chỉ nói về sản phẩm được giao (và món phối cùng của nó) hoặc sản phẩm trong phiên.
  if (k.trenSong) {
    const trongPhien = phienLiveId ? new Set(live.sanPhamTrongPhien(phienLiveId)) : null;
    let choPhep = trongPhien;
    if (soDuocGiao != null) {
      const giao = sp.layTheoSo(soDuocGiao);
      choPhep = new Set(giao ? [giao.id, ...giao.phoi_cung.filter((id) => !trongPhien || trongPhien.has(id))] : []);
    }
    if (choPhep) {
      const khac = [...duocNhac, ...spDaTrich].filter((x) => !choPhep.has(x.id)).map((x) => x.ten_day_du || sp.tenDayDu(x));
      if (khac.length) them('K4', `Trên sóng chỉ được nói về ${soDuocGiao != null ? `sản phẩm số ${soDuocGiao}` : 'sản phẩm trong buổi live'}; câu có nhắc: ${[...new Set(khac)].join(', ')}.`);
    }
  }

  // K9 — số còn và lời khan hiếm so với còn bán được lúc kiểm.
  const lienQuan = [...new Map([...duocNhac, ...spDaTrich, ...(soDuocGiao != null ? [sp.layTheoSo(soDuocGiao)].filter(Boolean) : [])]
    .map((x) => [x.id, x])).values()];
  const khongDau = boDau(s);
  // Câu nhắc màu / cỡ cụ thể ("áo 12 đen M còn 5") thì chỉ so với đúng các ô đó, không so với mọi ô của mẫu.
  const coTu = (v) => v && new RegExp(`(?<![a-z0-9])${boDau(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(khongDau);
  const conHang = lienQuan.flatMap((x) => {
    const ds = kho.conHang(x.id);
    const theo1 = ds.filter((p) => coTu(p.gt1));
    const buoc1 = theo1.length ? theo1 : ds;
    const theo2 = buoc1.filter((p) => coTu(p.gt2));
    return (theo2.length ? theo2 : buoc1).map((p) => p.con_ban_duoc);
  });
  for (const m of khongDau.matchAll(CON_SO)) {
    const n = Number(m[1]);
    if (!conHang.includes(n)) them('K9', `Câu nói "còn ${n}" nhưng lúc này không phân loại nào còn bán được đúng ${n}.`);
  }
  if (KHAN_HIEM.test(khongDau)) {
    const nguong = caiDat.banHang().nguong_sap_het;
    if (!conHang.some((n) => n > 0 && n <= nguong)) them('K9', `Câu tạo khan hiếm ("sắp hết", "chỉ còn"…) nhưng không phân loại nào còn ≤ ${nguong}.`);
  }

  if (k.congKhai) {
    // K5 — không xin thông tin cá nhân ở nơi công khai.
    if (XIN_THONG_TIN.some((re) => re.test(khongDau))) {
      them('K5', 'Không được xin số điện thoại hay địa chỉ ở nơi công khai; mời nhắn tin cho Page.');
    }
    // K6 — không lộ số điện thoại hay họ tên đầy đủ của người khác.
    if (coThongTinCaNhan(s)) them('K6', 'Câu công khai có số điện thoại hoặc số giấy tờ.');
    const thuong = gon(s).toLowerCase();
    for (const ten of tenNguoi) {
      const tg = gon(ten).toLowerCase();
      if (tg.split(' ').length >= 2 && thuong.includes(tg)) them('K6', `Câu công khai có họ tên đầy đủ "${ten}".`);
    }
  }

  // K8 — độ dài.
  if (s.length > k.toiDaKyTu) them('K8', `Câu dài ${s.length} ký tự, tối đa ${k.toiDaKyTu}.`);
  if (k.toiDaCau) {
    const soCau = s.split(/[.!?…]+(?=\s|$)/u).filter((x) => x.trim()).length;
    if (soCau > k.toiDaCau) them('K8', `Có ${soCau} câu, trên sóng tối đa ${k.toiDaCau} câu.`);
  }

  // K7 — trên sóng, miệng chỉ nói khi AI đang được phép nói. Không phải lỗi: giữ lại chờ.
  const giu = !!(k.trenSong && phat && !duocNoi);
  return { dat: loi.length === 0 && !giu, giu: loi.length === 0 && giu, loi };
}

/** Các con số khách tự nói trong những tin gần đây (K3 ngoại lệ): "cao 1m58 nặng 50 kí" → 1.58/158, 50. */
function soTrongLoiKhach(cacTin) {
  const ds = [];
  for (const t of cacTin) {
    const chu = String(t ?? '').replace(/(\d)m(\d{2})\b/gi, (_, a, b) => `${a}m${b} ${a}${b} cm`);
    for (const x of laySo(chu)) ds.push(x.giaTri);
  }
  return ds;
}

module.exports = { kiemTraCau, KENH, dongCaiDat, soTrongLoiKhach, chuNguon, boGoiSo, KHAN_HIEM, CON_SO };
