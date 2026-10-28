'use strict';

/**
 * Thẻ giữ hàng do MÃ soạn (SPEC.md F-68, #97, Luồng 3 bước 4'): tin riêng đầu cho MỌI bình luận chốt — 0 lượt AI, 1–2 giây,
 * vẫn chạy khi "Dừng AI". Giá, tên món do mã điền từ đơn; không số điện thoại, không địa chỉ; luôn có câu tự nhận trợ lý AI.
 *   - Đủ món: thẻ ảnh đúng màu · "Áo 12 Đen/M · 159.000đ" · "Giữ tới … · Tin tự động từ trợ lý AI của …" · [Giữ, lên đơn] [Đổi] [Không lấy].
 *   - Thiếu màu / size: hàng thẻ ảnh 2–6 màu còn hàng, hoặc chữ + trả lời nhanh các phân loại còn hàng — CHƯA giữ hàng.
 *   - Hết / không đủ hàng: chữ + phân loại còn hàng của cùng mẫu (chừa 1 chỗ cho nút [Vẫn chờ] của BH7).
 *   - Ngừng bán, số không có: chữ + các món đang live.
 * Ảnh: image_url qua đường ảnh công khai hẹp (#97); không có ảnh / không có đường hầm → thẻ chữ có nút (vẫn đủ nút, vẫn tự nhận AI).
 * Khối này không gọi Facebook (gửi qua gui_the_moza).
 */

const sp = require('./san-pham');
const kho = require('./kho');
const caiDat = require('./cai-dat');
const nutBam = require('./nut-bam');
const cm = require('./cau-mau-khach');
const { hienTien } = require('./chung');

const TOI_DA_NHANH = 12; // 13 của Meta − 1 chỗ cho [Vẫn chờ] (BH7)

const hoaDau = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** "Áo 12" — cách gọi ngắn trên thẻ (khách chốt bằng số — #60). */
const goiNgan = (s) => `${hoaDau(sp.danhMuc(s.danh_muc)?.goi || 'mẫu')} ${s.so}`;
const nhanPl = (pl) => (pl.gt2 ? `${pl.gt1}/${pl.gt2}` : pl.gt1);

/** Gốc địa chỉ ảnh: diễn tập dùng đường ảnh của MOZA (Messenger giả vẽ từ máy này); thật thì qua đường hầm (#97). */
function urlAnh(s, tep, dienTap) {
  if (!tep) return null;
  if (dienTap) return `/api/anh/${s.id}/${tep}`;
  const goc = require('./moc-facebook').lay('duong_ham')?.con_tro || null;
  return require('./anh-cong-khai').url(s, tep, goc);
}

/** Ảnh đúng màu của phân loại (không có thì ảnh đại diện). */
function anhCua(s, gt1) {
  const ds = s.anh || [];
  return (ds.find((a) => a.mau && gt1 && a.mau.toLowerCase() === String(gt1).toLowerCase()) || ds[0])?.tep || null;
}

/** "21:15" / "21:15 28/9" (khác ngày) — giờ Việt Nam. */
function gioChu(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const f = (o) => d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', ...o });
  const cungNgay = f({ day: '2-digit', month: '2-digit' }) === new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' });
  return cungNgay ? f({ hour: '2-digit', minute: '2-digit' }) : `${f({ hour: '2-digit', minute: '2-digit' })} ${f({ day: '2-digit', month: '2-digit' })}`;
}

/** Hạn giữ nói cho khách (#98): chưa bấm, đang live → "hết live + 2 giờ"; còn lại là giờ cụ thể. */
function hanGiuChu(d, p = null) {
  if (d.nguon === 'binh_luan_live' && !d.khach_bam_luc && p?.trang_thai === 'dang_live') return `hết live + ${caiDat.banHang().gio_giu_ngan} giờ`;
  return gioChu(d.giu_den);
}

function tieuDe(d) {
  if (d.dong.length === 1) {
    const x = d.dong[0];
    const s = sp.laySanPham(x.san_pham_id);
    const pl = kho.conHang(s.id).find((p) => p.id === x.phan_loai_id) || { gt1: x.ten_chup.split(' · ').at(-1), gt2: null };
    return `${goiNgan(s)} ${nhanPl(pl)}${x.so_luong > 1 ? ` x${x.so_luong}` : ''} · ${hienTien(x.don_gia * x.so_luong)}`;
  }
  return `${d.dong.reduce((n, x) => n + x.so_luong, 0)} món · ${hienTien(d.tong_hang)}`;
}

/** Món vừa chốt ("Áo 12 Đen/M") để nói trong câu. */
function tenMonNgan(s, pl) {
  return `${goiNgan(s)} ${nhanPl(pl)}`;
}

/** Nút của thẻ giữ hàng (#97): [Giữ, lên đơn] [Đổi] [Không lấy]. */
function nutGiu(d, pl) {
  return [
    { tieu_de: cm.cau('nut_giu'), payload: nutBam.taoPayload('GIU_LEN_DON', { don: d.id }) },
    { tieu_de: cm.cau('nut_doi'), payload: nutBam.taoPayload('DOI_MON', { don: d.id, pl: pl.id }) },
    { tieu_de: cm.cau('nut_khong_lay'), payload: nutBam.taoPayload('KHONG_LAY', { don: d.id, pl: pl.id }) },
  ];
}

/**
 * Thẻ giữ hàng cho một đơn vừa giữ (món mới nhất của bình luận này là `pl`).
 * @param {object} d  đơn
 * @param {{p?:object, pl:object, s:object, dienTap:boolean}} o
 */
function theGiuHang(d, { p = null, pl, s, dienTap }) {
  const tieu = tieuDe(d);
  const phuDe = cm.cau('the_giu_phu_de', { giu_den: hanGiuChu(d, p) });
  const nut = nutGiu(d, pl);
  const anh = urlAnh(s, anhCua(s, pl.gt1), dienTap);
  if (anh && phuDe.length <= 80 && tieu.length <= 80) return { kieu: 'anh', tieu_de: tieu, phu_de: phuDe, anh: { url: anh }, nut };
  return theChuCoNut({ tieu_de: tieu, phu_de: phuDe, nut });
}

/** Thẻ ảnh không gửi được (ảnh lỗi, không đường hầm) → thẻ chữ có nút: đủ nút, vẫn tự nhận AI. */
function theChuCoNut(the) {
  return { kieu: 'nut', chu: [the.tieu_de, the.phu_de].filter(Boolean).join('\n').slice(0, 640), nut: the.nut };
}

/** Trả lời nhanh các phân loại còn hàng (payload CHON_PL). `tru` = phân loại vừa hết. */
function nhanhPhanLoai(s, { p, sl = 1, bl = '', loc = null, tru = null } = {}) {
  return kho.conHang(s.id).filter((x) => x.con_ban_duoc > 0 && x.id !== tru && (!loc || loc(x))).slice(0, TOI_DA_NHANH)
    .map((x) => ({ tieu_de: nhanPl(x).slice(0, 20), payload: nutBam.taoPayload('CHON_PL', { phien: p?.id || '', pl: x.id, sl, bl }) }));
}

/** Trả lời nhanh các món đang live (payload XEM_MAU_KHAC) — khi món khách chốt không bán được. */
function nhanhMonTrongPhien(p) {
  const ids = p ? [...new Set(p.kich_ban.doan.map((x) => x.san_pham_id).filter(Boolean))] : sp.mucLucDangBan().map((x) => x.id);
  return ids.map((id) => { try { return sp.laySanPham(id); } catch { return null; } })
    .filter((s) => s && s.trang_thai === 'dang_ban' && kho.conHang(s.id).some((x) => x.con_ban_duoc > 0)).slice(0, TOI_DA_NHANH)
    .map((s) => ({ tieu_de: `Số ${s.so}`, payload: nutBam.taoPayload('XEM_MAU_KHAC', { phien: p?.id || '', sp: s.id }) }));
}

/**
 * Chốt thiếu màu / size (F-68): hàng thẻ ảnh theo màu còn hàng (thiếu màu, 2–6 màu có ảnh riêng) hoặc chữ + trả lời nhanh.
 * @param {{s:object, gt1?:string|null, p?:object, sl?:number, bl?:string, dienTap:boolean}} o
 */
function theChonPhanLoai({ s, gt1 = null, p = null, sl = 1, bl = '', dienTap, choLuoi = false, sizeQuen = null }) {
  const con = kho.conHang(s.id).filter((x) => x.con_ban_duoc > 0);
  if (!con.length) return theHetSach({ s, p });
  const thieu = gt1 ? (s.nhom?.t2 ? String(s.nhom.t2).toLowerCase().replace('cỡ', 'size') : 'loại') : [s.nhom?.t1, s.nhom?.t2].filter(Boolean).map((x) => String(x).toLowerCase().replace('cỡ', 'size')).join(', ');
  const loc = gt1 ? (x) => x.gt1.toLowerCase() === String(gt1).toLowerCase() : null;
  const conLoc = loc ? con.filter(loc) : con;
  // Thiếu màu mà mỗi màu có ảnh riêng: hàng thẻ ảnh (mỗi ô là màu đó). Hàng thẻ không có chỗ cho chữ nên chỉ dùng khi hội
  // thoại đã tự nhận trợ lý AI (choLuoi) — tin riêng đầu tiên luôn là chữ có câu tự nhận AI (#103).
  if (choLuoi && !gt1 && s.nhom?.t1) {
    const mau = [...new Set(con.map((x) => x.gt1))];
    const oAnh = mau.map((m) => ({ m, tep: (s.anh || []).find((a) => a.mau?.toLowerCase() === m.toLowerCase())?.tep })).filter((x) => x.tep);
    const khongCo2 = con.every((x) => !x.gt2);
    if (khongCo2 && oAnh.length === mau.length && mau.length >= 2 && mau.length <= 6) {
      const o = oAnh.map((x) => ({ tieu_de: `${goiNgan(s)} ${x.m}`.slice(0, 45), anh: { url: urlAnh(s, x.tep, dienTap) },
        payload: nutBam.taoPayload('CHON_PL', { phien: p?.id || '', pl: con.find((c) => c.gt1 === x.m).id, sl, bl }) })).filter((x) => x.anh.url);
      if (o.length >= 2) return { kieu: 'luoi', o };
    }
  }
  const chu = cm.cau('chon_phan_loai', { thieu, sp: goiNgan(s) });
  let nhanh = nhanhPhanLoai(s, { p, sl, bl, loc: loc && conLoc.length ? loc : null });
  // F-91: thiếu size, khách từng mua cùng danh mục size X và X còn hàng → nút đầu [Lấy X như lần trước] (khách bấm mới giữ).
  const quen = gt1 && sizeQuen ? conLoc.find((x) => x.gt2 && x.gt2.toLowerCase() === String(sizeQuen).toLowerCase()) : null;
  if (quen) {
    nhanh = [{ tieu_de: `Lấy ${quen.gt2} như lần trước`.slice(0, 20), payload: nutBam.taoPayload('CHON_PL', { phien: p?.id || '', pl: quen.id, sl, bl }) },
      ...nhanh.filter((x) => !x.payload.includes(`|${quen.id}|`))].slice(0, TOI_DA_NHANH);
  }
  return { kieu: 'chu', chu, tra_loi_nhanh: nhanh };
}

/** Hết / không đủ hàng: chữ + phân loại còn hàng của cùng mẫu. */
function theHetHang({ s, pl, p = null, sl = 1, bl = '', con = 0, choDuoc = false }) {
  // F-92: [🙋 Vẫn chờ] đứng đầu — bấm mới vào danh sách chờ (chỗ thứ 13 của trả lời nhanh để dành cho nút này).
  const van = choDuoc && p ? [{ tieu_de: cm.cau('nut_van_cho'), payload: nutBam.taoPayload('VAN_CHO', { phien: p.id, pl: pl.id, sl, bl }) }] : [];
  const nhanh = [...van, ...nhanhPhanLoai(s, { p, sl, bl, tru: pl.id })];
  if (con > 0) {
    const lay = { tieu_de: `Lấy ${con} chiếc`, payload: nutBam.taoPayload('CHON_PL', { phien: p?.id || '', pl: pl.id, sl: con, bl }) };
    return { kieu: 'chu', chu: cm.cau('khong_du_hang', { mon: tenMonNgan(s, pl), con }), tra_loi_nhanh: [lay, ...nhanh].slice(0, TOI_DA_NHANH + 1) };
  }
  if (nhanh.length === van.length) {
    const het = theHetSach({ s, p });
    return van.length ? { ...het, tra_loi_nhanh: [...van, ...(het.tra_loi_nhanh || [])].slice(0, TOI_DA_NHANH + 1) } : het;
  }
  return { kieu: 'chu', chu: cm.cau('het_hang', { mon: tenMonNgan(s, pl), sp: goiNgan(s) }), tra_loi_nhanh: nhanh };
}

function theHetSach({ s, p = null }) {
  const nhanh = nhanhMonTrongPhien(p).filter((x) => !x.payload.endsWith(`|${s.id}`));
  return { kieu: 'chu', chu: cm.cau('het_sach', { sp: goiNgan(s) }), ...(nhanh.length ? { tra_loi_nhanh: nhanh } : {}) };
}

/** Ngừng bán / số không có: chữ + các món đang live. */
function theKhongBan({ s = null, so = null, p = null }) {
  const nhanh = nhanhMonTrongPhien(p);
  const chu = s ? cm.cau('ngung_ban', { sp: goiNgan(s) }) : cm.cau('khong_co_so', { so: so ?? '' });
  return { kieu: 'chu', chu, ...(nhanh.length ? { tra_loi_nhanh: nhanh } : {}) };
}

module.exports = { theGiuHang, theChuCoNut, theChonPhanLoai, theHetHang, theHetSach, theKhongBan, nhanhPhanLoai, nhanhMonTrongPhien,
  tieuDe, hanGiuChu, gioChu, goiNgan, tenMonNgan, anhCua, urlAnh, nutGiu, TOI_DA_NHANH };
