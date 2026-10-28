'use strict';

/**
 * Soát sản phẩm — nút "Xem thử AI hiểu gì" (SPEC.md F-23 bản bán hàng). Gọi AI một lần với Skill "Soát sản phẩm":
 * đọc thẻ sản phẩm (đúng thứ mọi AI khác đọc) như khách hàng đọc, trả tóm tắt, chỗ mơ hồ / còn thiếu, chỗ mâu thuẫn;
 * mỗi ý kèm đoạn chép nguyên văn từ thẻ. Đoạn trích không có trong thẻ thì phiếu bị trả lại để làm lại một lần (A.8).
 * Kết quả chỉ để người dùng xem: không lưu thành ô nào của sản phẩm.
 */

const { chayAgent } = require('../runtime');
const sp = require('../../nghiep-vu/san-pham');
const skill = require('../../nghiep-vu/skill');
const { boDau } = require('../../nghiep-vu/chung');

const SKILL_ID = 'soat-san-pham';
const Y = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      y: { type: 'string', description: 'Một ý, viết ngắn' },
      trich_dan: { type: 'array', items: { type: 'string' }, description: 'Các đoạn chép nguyên văn từ thẻ sản phẩm' },
    },
    required: ['y', 'trich_dan'],
    additionalProperties: false,
  },
};
const LUOC_DO = {
  type: 'object',
  properties: { tom_tat: Y, mo_ho: Y, mau_thuan: Y },
  required: ['tom_tat', 'mo_ho', 'mau_thuan'],
  additionalProperties: false,
};

// So trích dẫn với thẻ: bỏ dấu, bỏ khác biệt khoảng trắng và dấu câu ở hai đầu.
const chuan = (s) => boDau(String(s)).replace(/\s+/g, ' ').trim();

// Số đoạn trích tối thiểu mỗi ý: mâu thuẫn phải trích đủ hai bên; ý "thẻ chưa ghi …" có thể không có gì để trích.
const TOI_THIEU = { tom_tat: 1, mo_ho: 0, mau_thuan: 2 };

/** Đoạn trích nào không có nguyên văn trong thẻ, ý nào thiếu trích dẫn. */
function tichSai(phieu, the) {
  const goc = chuan(the);
  const loi = [];
  for (const nhom of ['tom_tat', 'mo_ho', 'mau_thuan']) {
    for (const x of phieu[nhom]) {
      if (x.trich_dan.length < TOI_THIEU[nhom]) loi.push(`${nhom}: ý "${x.y.slice(0, 60)}" cần ít nhất ${TOI_THIEU[nhom]} đoạn trích`);
      for (const d of x.trich_dan) {
        const c = chuan(d).replace(/^[\s"“”'.,;:…#-]+|[\s"“”'.,;:…-]+$/g, '');
        if (c && !goc.includes(c)) loi.push(`${nhom}: đoạn "${d.slice(0, 80)}" không có nguyên văn trong thẻ sản phẩm`);
      }
    }
  }
  return loi;
}

/**
 * @param {string} sanPhamId
 * @param {object} [o]  nhaCungCap (test)
 */
async function soatSanPham(sanPhamId, { nhaCungCap } = {}) {
  const s = sp.laySanPham(sanPhamId);
  const the = sp.theChoAi(s);
  const k = skill.moSkill(SKILL_ID, null);
  const tinDau = [
    '## Thẻ sản phẩm (đúng thứ mọi AI bán hàng đọc)',
    the,
    '',
    '## Việc của bạn',
    'Đọc thẻ trên như một khách hàng đang cân nhắc mua. Trả một phiếu JSON:',
    '- tom_tat: những gì hiểu được (giá, chất liệu, form, dịp mặc, màu, size còn, bảng size…), mỗi ý một dòng.',
    '- mo_ho: câu dễ hiểu nhầm, ô ghi "(chưa xác nhận)", hoặc điều khách hay hỏi mà thẻ chưa có (chất liệu, co giãn, dày mỏng, số đo, cách giặt, đổi trả).',
    '- mau_thuan: chỗ thẻ ghi hai điều khác nhau (ví dụ mô tả nói cotton, thông số ghi linen; bảng size thiếu cỡ đang bán); trích đủ các đoạn.',
    'Mỗi ý kèm trich_dan chép nguyên văn từ thẻ (ý "thẻ chưa ghi" thì trích đoạn gần nhất liên quan, hoặc để mảng rỗng).',
  ].join('\n');
  const kq = await chayAgent({
    agentId: 'soat_san_pham',
    kichHoat: `Xem thử AI hiểu gì · ${sp.tenGoi(s)}`,
    tinDau,
    phan: [`## Skill: ${k.ten}\nCách làm:\n${k.cach_lam}${k.vi_du_dung ? `\nVí dụ đúng: ${k.vi_du_dung}` : ''}${k.vi_du_sai ? `\nVí dụ sai: ${k.vi_du_sai}` : ''}`],
    luocDo: LUOC_DO,
    kiemPhieuThem: (p) => tichSai(p, the),
    lienKet: { sanPhamId: s.id, sanPhamPhienBan: s.phien_ban },
    nguonDaDua: { san_pham: { [s.id]: s.phien_ban }, skill: { [k.id]: k.phien_ban } },
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  return { ...kq, san_pham: { id: s.id, so: s.so, phien_ban: s.phien_ban } };
}

module.exports = { soatSanPham, LUOC_DO, tichSai };
