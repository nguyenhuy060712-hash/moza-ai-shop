'use strict';

/**
 * Thẻ đơn hàng trong Messenger (SPEC.md #89, cách A): khi đơn Chờ xác nhận đủ thông tin giao, shop gửi một thẻ (button template
 * của Messenger, chữ ≤ 640 ký tự) tóm tắt món, phí ship, tổng tiền, người nhận, kèm 2 nút "✅ Xác nhận đơn" và "✏️ Sửa đơn".
 * Khách bấm Xác nhận → Facebook báo postback → MOZA xác nhận đơn BẰNG MÃ (không tốn AI) và nhắn cảm ơn ngay trong chat.
 * Nút mang khóa phiên bản đơn (tổng tiền + mốc sửa món): bấm trên thẻ cũ sau khi đơn đã đổi thì không xác nhận nhầm.
 * Khối này không gọi Facebook — nơi gửi (Hộp thư, công cụ) lo phần đó.
 * F-89 (#112): shop đã điền đủ ngân hàng, số tài khoản, tên chủ TK → 3 nút [✅ Nhận hàng trả tiền] [💳 Chuyển khoản] [✏️ Sửa đơn]
 * (Messenger cho tối đa 3 nút). Không ép khách chuyển khoản.
 */

const don = require('./don');
const caiDat = require('./cai-dat');
const kh = require('./khach');
const nutBam = require('./nut-bam');
const { LoiNghiepVu, hienTien } = require('./chung');

const cm = () => require('./cau-mau-khach');

const NUT_XAC_NHAN = '✅ Xác nhận đơn';
const NUT_SUA = '✏️ Sửa đơn';
const NUT_COD = '✅ Nhận hàng trả tiền';
const NUT_CK = '💳 Chuyển khoản';

/** Thẻ có nút Chuyển khoản không (đủ 3 ô tài khoản ở Cài đặt → Bán hàng). */
const coChuyenKhoan = () => !!caiDat.taiKhoanNhanTien();

/** Khóa phiên bản đơn: đổi món / tổng tiền là đổi khóa. */
const khoaPhienBan = (d) => `${d.id}|${d.tong_tien}|${d.mon_sua_luc || d.tao_luc}`;

function nut(d) {
  const khoa = { don: d.id, tong: d.tong_tien, moc: d.mon_sua_luc || d.tao_luc };
  if (coChuyenKhoan()) {
    return [
      { tieu_de: NUT_COD, payload: nutBam.taoPayload('XAC_NHAN_DON', khoa) },
      { tieu_de: NUT_CK, payload: nutBam.taoPayload('CK_DON', khoa) },
      { tieu_de: NUT_SUA, payload: nutBam.taoPayload('SUA_DON', { don: d.id }) },
    ];
  }
  return [
    { tieu_de: NUT_XAC_NHAN, payload: nutBam.taoPayload('XAC_NHAN_DON', khoa) },
    { tieu_de: NUT_SUA, payload: nutBam.taoPayload('SUA_DON', { don: d.id }) },
  ];
}

const cheSo = (s) => (s ? `0${s.slice(3, 6)}***${s.slice(-3)}` : '');

/** Chữ của thẻ (≤ 640 ký tự — giới hạn button template của Messenger). */
function noiDung(d) {
  const shop = caiDat.tenShop();
  const ck = coChuyenKhoan();
  const tt = d.thanh_toan === 'cod' ? 'thanh toán khi nhận hàng (COD)' : 'chuyển khoản';
  const mon = d.dong.map((x) => `• ${x.ten_chup.replace(/^Số (\d+) · /, 'Số $1 ')} x${x.so_luong}: ${hienTien(x.don_gia * x.so_luong)}${x.gia_thuong != null ? ' (giá live)' : ''}`);
  const dong = [
    `🧾 Đơn ${d.ma} — ${shop}`,
    ...mon,
    `Phí ship: ${hienTien(d.phi_ship)}`,
    ...(() => { const t = don.tienConThieuMienShip(d); return t ? [cm().cau('them_mien_ship', { tien: hienTien(t) })] : []; })(), // F-90
    ck ? `Tổng tiền: ${hienTien(d.tong_tien)}` : `Tổng tiền: ${hienTien(d.tong_tien)} · ${tt}`,
    `Người nhận: ${d.ten_nhan} · ${cheSo(d.sdt_nhan)}`,
    `Địa chỉ: ${d.dia_chi_nhan}`,
    ck ? 'Chọn cách trả tiền để shop gửi hàng, cần đổi gì thì bấm "Sửa đơn".' : 'Bấm "Xác nhận đơn" để shop gửi hàng, cần đổi gì thì bấm "Sửa đơn".',
    require('./gia-shop').dongTaiKhoan(), // F-74
    ...(caiDat.banHang().doi_tra_ngan ? [caiDat.banHang().doi_tra_ngan] : []), // F-95: bỏ trước tiên khi quá 640 ký tự
  ];
  let chu = dong.join('\n');
  if (chu.length > 640 && caiDat.banHang().doi_tra_ngan) { dong.pop(); chu = dong.join('\n'); }
  // Quá dài (nhiều món): gộp phần món cho vừa 640 ký tự.
  if (chu.length > 640) {
    const tomTat = `• ${d.dong.length} món, tổng hàng ${hienTien(d.tong_hang)}`;
    chu = [dong[0], tomTat, ...dong.slice(1 + mon.length)].join('\n');
  }
  return chu.slice(0, 640);
}

/**
 * Đơn có gửi thẻ được không: Chờ xác nhận, đủ tên / số / địa chỉ, và phiên bản này chưa gửi.
 * @returns {{gui:boolean, ly_do?:string}}
 */
function nenGui(d) {
  if (d.trang_thai !== 'cho_xac_nhan') return { gui: false, ly_do: `Đơn ${d.ma} đang ${d.ten_trang_thai}.` };
  const thieu = don.viecConThieu(d);
  if (thieu.length) return { gui: false, ly_do: `Chưa gửi thẻ đơn được: ${thieu.join(', ')}.` };
  if (d.the_gui === khoaPhienBan(d)) return { gui: false, ly_do: 'Thẻ của đơn này (đúng món, đúng tổng tiền) đã gửi rồi.', da_gui: true };
  return { gui: true };
}

/**
 * Trả lời nhanh gắn thẻ đơn (F-90): một món phối [➕ Thêm quần 15] — mỗi người tối đa 1 lần / 24 giờ. Không có thì null.
 * @returns {{nhanh:object[], phoi:object}|null}
 */
function nhanhPhoi(d) {
  if (don.daGoiYPhoi(d)) return null;
  const s = don.monPhoiGoiY(d);
  if (!s) return null;
  const { goiNgan } = require('./the-giu-hang');
  return { phoi: s, nhanh: [{ tieu_de: `➕ Thêm ${goiNgan(s).toLowerCase()}`.slice(0, 20), payload: nutBam.taoPayload('THEM_PHOI', { don: d.id, sp: s.id }) }] };
}

/** Ghi nhận đã gửi thẻ cho phiên bản hiện tại. */
function daGuiThe(d) {
  require('../db/ket-noi').csdl().prepare('UPDATE don SET the_gui = ? WHERE id = ?').run(khoaPhienBan(d), d.id);
}

/** Đọc payload nút thẻ đơn (qua bộ đọc nút chung nut-bam.js; vẫn đọc được hai nút cũ của #89). */
function docPayload(p) {
  const x = nutBam.docPayload(p);
  if (x?.ma === 'XAC_NHAN_DON') return { loai: 'xac_nhan', donId: x.don, khoa: x.khoa };
  if (x?.ma === 'SUA_DON') return { loai: 'sua', donId: x.don };
  return null;
}

/**
 * Khách bấm "Xác nhận đơn" trên thẻ.
 * @param {object} h   hội thoại nơi khách bấm
 * @param {string} khoa  khóa phiên bản trong nút
 * @param {string} tinId  tin postback (bằng chứng trong lịch sử đơn)
 * @returns {{ket_qua:'da_xac_nhan'|'da_xac_nhan_truoc'|'don_da_doi'|'can_goi'|'khong_xac_nhan_duoc', don?:object, ly_do?:string}}
 */
function xacNhanBangNut(h, khoa, tinId, { thanhToan = null } = {}) {
  const id = String(khoa).split('|')[0];
  let d;
  try { d = don.layDon(id); } catch { return { ket_qua: 'khong_xac_nhan_duoc', ly_do: 'Không tìm thấy đơn.' }; }
  if (d.hoi_thoai_id !== h.id && d.nguoi_fb_id !== h.nguoi_fb_id) return { ket_qua: 'khong_xac_nhan_duoc', ly_do: 'Đơn không phải của người này.' };
  if (d.trang_thai === 'da_xac_nhan' || ['da_gui', 'da_giao'].includes(d.trang_thai)) return { ket_qua: 'da_xac_nhan_truoc', don: d };
  if (d.trang_thai !== 'cho_xac_nhan') return { ket_qua: 'khong_xac_nhan_duoc', don: d, ly_do: `Đơn đang ${d.ten_trang_thai}.` };
  if (khoaPhienBan(d) !== khoa) return { ket_qua: 'don_da_doi', don: d };
  // #73: khách từng hoàn nhiều đơn → người gọi xác nhận, không xác nhận tự động (kể cả bấm nút).
  const soHoan = d.khach_id ? don.danhSach({ trangThai: 'hoan' }).filter((x) => x.khach_id === d.khach_id).length : 0;
  if (soHoan >= caiDat.banHang().nguong_hoan) {
    // F-89: khách chọn chuyển khoản mà từng hoàn nhiều → không gửi mã QR (không nhận tiền trước khi người gọi xác nhận).
    const ghi = thanhToan === 'chuyen_khoan' ? ' Khách chọn chuyển khoản: gọi xong mới gửi mã QR (Hộp thư → nhờ Tư vấn viên gửi mã chuyển khoản).' : '';
    kh.taoViec({ loai: 'goi_xac_nhan_don', noiDung: `Gọi xác nhận đơn ${d.ma} — khách bấm xác nhận nhưng từng hoàn ${soHoan} đơn.${ghi}`, khachId: d.khach_id, hoiThoaiId: h.id, donId: d.id, taoBoi: 'ai' });
    return { ket_qua: 'can_goi', don: d };
  }
  try {
    if (thanhToan && thanhToan !== d.thanh_toan) don.datThongTinGiao(d.id, { thanhToan }, { boi: 'ai' });
    const cach = thanhToan === 'chuyen_khoan' ? '"Chuyển khoản"' : thanhToan === 'cod' ? '"Nhận hàng trả tiền"' : '"Xác nhận đơn"';
    const x = don.doiTrangThai(d.id, 'da_xac_nhan', { nguon: 'khach_tu_bao', bangChung: tinId, ghiChu: `Khách bấm ${cach} trên thẻ đơn` });
    return { ket_qua: 'da_xac_nhan', don: x };
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) throw e;
    return { ket_qua: 'khong_xac_nhan_duoc', don: d, ly_do: e.message };
  }
}

/** Tin nhắn trả lời ngay sau khi khách bấm nút (MOZA soạn từ dữ liệu, không qua AI). */
function tinTraLoi(kq) {
  const d = kq.don;
  const shop = caiDat.tenShop();
  if (kq.ket_qua === 'da_xac_nhan') {
    return `✅ Đơn ${d.ma} đã được xác nhận!\n${d.dong.map((x) => `• ${x.ten_chup.replace(/^Số (\d+) · /, 'Số $1 ')} x${x.so_luong}`).join('\n')}\n`
      + `Tổng tiền: ${hienTien(d.tong_tien)} (${d.thanh_toan === 'cod' ? 'thanh toán khi nhận hàng' : 'chuyển khoản'})\n`
      + `Giao đến: ${d.ten_nhan}, ${d.dia_chi_nhan}\n`
      + `Shop sẽ đóng gói gửi đi sớm và nhắn mã vận đơn cho mình. Cảm ơn mình đã ủng hộ ${shop} 💕`;
  }
  if (kq.ket_qua === 'da_xac_nhan_truoc') return `Đơn ${d.ma} đã được xác nhận rồi ạ. Cảm ơn mình đã ủng hộ ${shop} 💕`;
  if (kq.ket_qua === 'don_da_doi') return `Đơn ${d.ma} vừa có thay đổi nên thẻ này đã cũ ạ — shop gửi lại thẻ đơn mới, mình kiểm tra rồi bấm xác nhận giúp shop.`;
  if (kq.ket_qua === 'can_goi') return `Shop đã nhận xác nhận của mình cho đơn ${d.ma} ạ. Nhân viên shop sẽ gọi điện xác nhận nhanh trước khi gửi hàng. Cảm ơn mình nhiều!`;
  return 'Shop chưa xác nhận được đơn này ạ, nhân viên shop sẽ kiểm tra và nhắn lại mình ngay.';
}

module.exports = { NUT_XAC_NHAN, NUT_SUA, NUT_COD, NUT_CK, coChuyenKhoan, khoaPhienBan, nhanhPhoi, nut, noiDung, nenGui, daGuiThe, docPayload, xacNhanBangNut, tinTraLoi };
