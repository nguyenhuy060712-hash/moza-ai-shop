'use strict';

/**
 * Giới hạn liên hệ chủ động (SPEC.md F-66, #96) — khách không thấy phiền, Page không bị báo spam.
 * Mỗi lần gửi mang một mục đích: tra_loi (trả lời tin khách — không giới hạn) · the_dau (tin riêng đầu, đã giới hạn bằng lượt
 * nhắn riêng) · bao_don (tin giao dịch: xác nhận, đã gửi) · nhac · bao_huy · cham_soc · moi_chao. Gọi tên trên sóng cũng ghi
 * vào đây (loại goi_ten).
 * Luật (hằng số trong mac-dinh.json → lien_he):
 *   - mỗi đơn tối đa 1 lần gọi tên kiểu nhắc, 2 tin nhắc, 1 tin báo hủy;
 *   - chăm sóc và mời chào mỗi người 1 tin mỗi ngày (giờ Việt Nam);
 *   - nhắc, báo hủy, chăm sóc, mời chào chỉ 7h–22h giờ Việt Nam; ngoài khung thì DỜI tới 7h (không bỏ — không mất đơn);
 *   - khách xin dừng → không tin chủ động, không gọi tên (vẫn trả lời khi khách tự nhắn; tin trạng thái đơn → việc gọi cho người);
 *   - Page bị Meta hạn chế nhắn tin → chặn mọi tin chủ động và nhắn riêng mới.
 */

const { csdl } = require('../db/ket-noi');
const { taoId, gio } = require('./chung');
const MAC = require('../cau-hinh/mac-dinh.json').lien_he;

const CHU_DONG = ['nhac', 'bao_huy', 'cham_soc', 'moi_chao'];
const MOI_NGAY = { cham_soc: 'cham_soc_moi_ngay', moi_chao: 'moi_chao_moi_ngay' };
const MOI_DON = { nhac: 'nhac_moi_don', bao_huy: 'bao_huy_moi_don', goi_ten: 'goi_ten_moi_don' };

function ghi({ nguoiFbId = null, donId = null, phienLiveId = null, loai, luc = gio() }) {
  csdl().prepare('INSERT INTO lien_he (id, nguoi_fb_id, don_id, phien_live_id, loai, luc) VALUES (?, ?, ?, ?, ?, ?)')
    .run(taoId('lh'), nguoiFbId, donId, phienLiveId, loai, luc);
}

function demTheoDon(donId, loai) {
  return donId ? csdl().prepare('SELECT COUNT(*) AS n FROM lien_he WHERE don_id = ? AND loai = ?').get(donId, loai).n : 0;
}

function demTheoNguoi(nguoiFbId, loai, tuLuc) {
  return nguoiFbId ? csdl().prepare('SELECT COUNT(*) AS n FROM lien_he WHERE nguoi_fb_id = ? AND loai = ? AND luc >= ?').get(nguoiFbId, loai, tuLuc).n : 0;
}

/** Giờ Việt Nam (UTC+7, không đổi giờ theo mùa). */
function gioVN(bayGio = new Date()) {
  return new Date(new Date(bayGio).getTime() + 7 * 3600e3).getUTCHours();
}

/** 7h sáng giờ Việt Nam kế tiếp (hôm nay nếu đang trước 7h). */
function lucMoKhung(bayGio = new Date()) {
  const vn = new Date(new Date(bayGio).getTime() + 7 * 3600e3);
  const mo = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), MAC.gio_tu) - 7 * 3600e3);
  if (vn.getUTCHours() >= MAC.gio_tu) mo.setUTCDate(mo.getUTCDate() + 1);
  return mo.toISOString();
}

function trongKhung(bayGio = new Date()) {
  const g = gioVN(bayGio);
  return g >= MAC.gio_tu && g < MAC.gio_den;
}

function dauNgayVN(bayGio = new Date()) {
  return require('./chi-phi').dauNgayVN(new Date(bayGio));
}

/* ---------------- ngừng liên hệ ---------------- */

function daNgung(nguoiFbId) {
  if (!nguoiFbId) return false;
  return !!csdl().prepare('SELECT ngung_lien_he_luc FROM nguoi_fb WHERE id = ?').get(nguoiFbId)?.ngung_lien_he_luc;
}

function datNgung(nguoiFbId, ngung = true) {
  csdl().prepare('UPDATE nguoi_fb SET ngung_lien_he_luc = ? WHERE id = ?').run(ngung ? gio() : null, nguoiFbId);
}

/**
 * Được gửi tin mục đích này không.
 * @param {object} o
 * @param {string} o.mucDich
 * @param {string|null} [o.nguoiFbId]
 * @param {string|null} [o.donId]
 * @param {string|null} [o.pageId]
 * @param {Date} [o.bayGio]
 * @returns {{duoc:true}|{duoc:false, ma:string, ly_do:string, doi_den?:string}}
 */
function kiem({ mucDich, nguoiFbId = null, donId = null, pageId = null, bayGio = new Date() }) {
  if (mucDich === 'tra_loi') return { duoc: true };
  if (pageId && require('./fb-page').biCam(pageId) && (CHU_DONG.includes(mucDich) || mucDich === 'the_dau')) {
    return { duoc: false, ma: 'PAGE_BI_HAN_CHE', ly_do: 'Meta đang tạm khóa nhắn tin của Page: dừng mọi tin chủ động và nhắn riêng mới (xem danh sách Nhắn bù).' };
  }
  if (!CHU_DONG.includes(mucDich)) return { duoc: true }; // the_dau, bao_don: tin giao dịch / đã giới hạn bằng lượt nhắn riêng
  if (daNgung(nguoiFbId)) return { duoc: false, ma: 'NGUNG_LIEN_HE', ly_do: 'Khách đã xin thôi nhận tin: MOZA không nhắn chủ động nữa.' };
  const khoaDon = MOI_DON[mucDich];
  if (khoaDon && donId && demTheoDon(donId, mucDich) >= MAC[khoaDon]) {
    return { duoc: false, ma: 'GIOI_HAN_LIEN_HE', ly_do: `Đơn này đã ${mucDich === 'nhac' ? `được nhắc ${MAC.nhac_moi_don}/${MAC.nhac_moi_don} lần` : 'được báo hủy'}: không gửi thêm.` };
  }
  const khoaNgay = MOI_NGAY[mucDich];
  if (khoaNgay && demTheoNguoi(nguoiFbId, mucDich, dauNgayVN(bayGio)) >= MAC[khoaNgay]) {
    return { duoc: false, ma: 'GIOI_HAN_LIEN_HE', ly_do: 'Hôm nay đã gửi tin loại này cho người này rồi (tối đa 1 tin mỗi ngày).' };
  }
  if (!trongKhung(bayGio)) {
    return { duoc: false, ma: 'NGOAI_GIO', ly_do: `Ngoài khung ${MAC.gio_tu}h–${MAC.gio_den}h: dời tới ${MAC.gio_tu}h sáng.`, doi_den: lucMoKhung(bayGio) };
  }
  return { duoc: true };
}

/** Khách xin không đọc tên trên live ("ẩn tên" — bình luận hay tin nhắn): ghi một lần, nhớ mãi (F-66). */
function datAnTen(nguoiFbId) {
  if (nguoiFbId && !daAnTen(nguoiFbId)) ghi({ nguoiFbId, loai: 'an_ten' });
}

function daAnTen(nguoiFbId) {
  return !!nguoiFbId && !!csdl().prepare("SELECT 1 FROM lien_he WHERE nguoi_fb_id = ? AND loai = 'an_ten'").get(nguoiFbId);
}

/** Gọi tên người này trên sóng kiểu nhắc (F-70) được không: 1 lần mỗi đơn, không khi đã xin dừng / xin ẩn tên. */
function duocGoiTen({ nguoiFbId, donId }) {
  if (daNgung(nguoiFbId) || daAnTen(nguoiFbId)) return false;
  return !(donId && demTheoDon(donId, 'goi_ten') >= MAC.goi_ten_moi_don);
}

/** Dòng hiện trên màn Đơn hàng: "đã nhắc 2/2", "khách xin dừng". */
function tomTatDon(d) {
  const ds = [];
  const nhac = demTheoDon(d.id, 'nhac');
  if (nhac) ds.push(`đã nhắc ${nhac}/${MAC.nhac_moi_don}`);
  if (demTheoDon(d.id, 'bao_huy')) ds.push('đã báo hủy');
  if (daNgung(d.nguoi_fb_id)) ds.push('khách xin dừng nhận tin');
  return ds;
}

module.exports = { datAnTen, daAnTen, MAC, CHU_DONG, ghi, demTheoDon, demTheoNguoi, kiem, duocGoiTen, daNgung, datNgung, gioVN, lucMoKhung, trongKhung, tomTatDon };
