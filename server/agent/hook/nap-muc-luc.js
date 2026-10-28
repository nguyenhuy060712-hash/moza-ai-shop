'use strict';

/**
 * Nạp mục lục khi Agent mở việc (A.3 cửa `khi_mo_viec`, A.7): mục lục Skill, mục lục Sổ tay shop,
 * mục lục sản phẩm Đang bán — chỉ tên, số, giá, không nội dung. Nội dung AI tự mở bằng công cụ khi cần.
 * Mục lục đặt ngay sau lời dặn vai trò: phần ít đổi đứng đầu để nhà cung cấp dùng bộ nhớ đệm.
 */

const skill = require('../../nghiep-vu/skill');
const soTay = require('../../nghiep-vu/so-tay');
const sp = require('../../nghiep-vu/san-pham');
const { hienTien } = require('../../nghiep-vu/chung');

function mucLucSkill(agentId) {
  const ds = skill.mucLuc(agentId);
  if (!ds.length) return null;
  return ['## Mục lục Skill (mở nội dung bằng công cụ mo_skill khi việc khớp dòng "dùng khi")',
    ...ds.map((s) => `- ${s.id}: ${s.ten} — dùng khi: ${s.dung_khi}`)].join('\n');
}

function mucLucSoTay() {
  const ds = soTay.danhSachMuc();
  if (!ds.length) return null;
  const ten = require('../../nghiep-vu/cai-dat').tenShop();
  return [`## Mục lục Sổ tay ${ten} (mở bằng công cụ mo_so_tay)`, ...ds.map((m) => `- ${m.id}: ${m.tieu_de}${m.noi_dung.trim() ? '' : ' (chưa có nội dung)'}`)].join('\n');
}

/** Mục lục sản phẩm Đang bán: số · tên · giá. Giá ở đây để định hướng; câu nói ra phải trích từ thẻ (lay_san_pham). */
function mucLucSanPham() {
  const ds = sp.mucLucDangBan();
  return ['## Sản phẩm Đang bán (số · tên · giá · còn bán được). Khách gọi bằng số ("chốt 12", "áo 12"). Đọc thẻ đầy đủ bằng lay_san_pham trước khi nói giá, size, còn hàng.',
    ...(ds.length ? ds.map((x) => `- ${x.ten_day_du} · ${hienTien(x.gia)} · còn ${x.con_ban_duoc}`) : ['(chưa có sản phẩm nào Đang bán)'])].join('\n');
}

module.exports = {
  id: 'nap_muc_luc',
  cua: 'khi_mo_viec',
  ten: 'Nạp mục lục',
  moTa: 'Đưa cho Agent mục lục Skill, Sổ tay, sản phẩm Đang bán (chỉ tên) khi bắt đầu việc.',
  batBuoc: false,
  macDinhBat: true,
  mucLucSkill,
  mucLucSoTay,
  mucLucSanPham,
  chay(ctx) {
    const m = ctx.mucLuc || {};
    if (m.skill) ctx.phanMucLuc.push(mucLucSkill(ctx.agentId));
    if (m.soTay) ctx.phanMucLuc.push(mucLucSoTay());
    if (m.sanPham) ctx.phanMucLuc.push(mucLucSanPham());
    return { quyet_dinh: 'cho_qua' };
  },
};
