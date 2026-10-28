'use strict';

/**
 * Kiểm một giá trị theo lược đồ JSON (phần nhỏ mà MOZA dùng: object, string, integer, number, boolean,
 * array, null, enum, required, additionalProperties: false). Dùng cho:
 *  - tham số AI gửi khi gọi công cụ (nhà cung cấp đã ép lược đồ, đây là lớp kiểm thứ hai);
 *  - phiếu kết quả của Agent ở hook `khi_agent_xong` (A.8).
 * Trả về danh sách lỗi bằng lời thường; rỗng = hợp lệ.
 */

function kieu(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function khopKieu(v, t) {
  const k = kieu(v);
  if (t === 'number') return k === 'number' || k === 'integer';
  return k === t;
}

function kiemLuocDo(v, ld, duong = 'phiếu') {
  const loi = [];
  if (!ld || typeof ld !== 'object') return loi;
  const cacKieu = [].concat(ld.type || []);
  if (cacKieu.length && !cacKieu.some((t) => khopKieu(v, t))) {
    loi.push(`${duong}: cần kiểu ${cacKieu.join(' hoặc ')}, nhận ${kieu(v)}`);
    return loi;
  }
  if (ld.enum && !ld.enum.includes(v)) loi.push(`${duong}: phải là một trong ${ld.enum.map((x) => JSON.stringify(x)).join(', ')}`);
  if (kieu(v) === 'object' && (ld.properties || ld.required)) {
    for (const k of ld.required || []) if (!Object.hasOwn(v, k)) loi.push(`${duong}: thiếu ô "${k}"`);
    for (const [k, x] of Object.entries(v)) {
      if (ld.properties?.[k]) loi.push(...kiemLuocDo(x, ld.properties[k], `${duong}.${k}`));
      else if (ld.additionalProperties === false) loi.push(`${duong}: ô lạ "${k}"`);
    }
  }
  if (kieu(v) === 'array' && ld.items) v.forEach((x, i) => loi.push(...kiemLuocDo(x, ld.items, `${duong}[${i}]`)));
  return loi;
}

module.exports = { kiemLuocDo };
