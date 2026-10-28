'use strict';

/**
 * Thẻ mời giữ một chạm (SPEC.md F-71, P02; dùng lại ở nhắn bù F-73): khách HỎI mua một món ghi đủ số, màu, size ("12 đen M còn
 * ko") → thẻ ảnh đúng màu "Áo 12 Đen/M · 159.000đ · còn hàng" + [Giữ cho mình] [Xem màu khác]. KHÔNG tự giữ hàng — chỉ giữ khi
 * khách bấm. Chỉ ghi "còn N" khi N ≤ ngưỡng sắp hết (không tạo sức ép giả — K9).
 */

const caiDat = require('./cai-dat');
const kho = require('./kho');
const nutBam = require('./nut-bam');
const cm = require('./cau-mau-khach');
const theGiu = require('./the-giu-hang');
const { hienTien } = require('./chung');

function chuCon(s, pl) {
  const con = kho.conHang(s.id).find((x) => x.id === pl.id)?.con_ban_duoc ?? 0;
  return con <= caiDat.banHang().nguong_sap_het ? `còn ${con}` : 'còn hàng';
}

/** @param {{s:object, pl:object, p?:object|null, dienTap:boolean}} o */
function theMoi({ s, pl, p = null, dienTap }) {
  const gia = pl.gia ?? s.gia;
  const con = chuCon(s, pl);
  const tieuDe = `${theGiu.tenMonNgan(s, pl)} · ${hienTien(gia)} · ${con}`.slice(0, 80);
  const phuDe = cm.cau('the_moi_phu_de', { con }).slice(0, 80);
  const nut = [
    { tieu_de: cm.cau('nut_giu_moi'), payload: nutBam.taoPayload('GIU_MOI', { phien: p?.id || '', pl: pl.id }) },
    { tieu_de: cm.cau('nut_xem_mau_khac'), payload: nutBam.taoPayload('XEM_MAU_KHAC', { phien: p?.id || '', sp: s.id }) },
  ];
  const anh = theGiu.urlAnh(s, theGiu.anhCua(s, pl.gt1), dienTap);
  if (anh) return { kieu: 'anh', tieu_de: tieuDe, phu_de: phuDe, anh: { url: anh }, nut };
  return theGiu.theChuCoNut({ tieu_de: tieuDe, phu_de: phuDe, nut });
}

module.exports = { theMoi, chuCon };
