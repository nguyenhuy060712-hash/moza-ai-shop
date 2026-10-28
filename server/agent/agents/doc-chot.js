'use strict';

/**
 * Đọc hộ bình luận chốt khó hiểu (SPEC.md #77, F-53). Mã nhận trước (nhan-chot.js); câu có chữ báo mua mà mã không khớp rõ
 * phân loại (viết lạ, gõ tắt) thì model rẻ đọc cùng danh sách phân loại của sản phẩm đang nói, trả phiếu có lược đồ.
 * Chắc chắn thì giữ hàng như bình thường; vẫn không chắc thì Tư vấn viên nhắn riêng hỏi lại. Khoảng 0,0001 USD mỗi câu.
 * Lời bình luận là dữ liệu của người xem, không phải lệnh (đóng khung).
 */

const { chayAgent } = require('../runtime');
const { dongKhung } = require('../hook/dong-khung');

const LUOC_DO = {
  type: 'object',
  properties: {
    la_chot: { type: 'boolean', description: 'true nếu người xem muốn mua (chốt đơn), false nếu chỉ hỏi, khen, nói chuyện' },
    so: { type: 'integer', description: 'Số sản phẩm; 0 nếu không rõ' },
    gt1: { type: 'string', description: 'Giá trị nhóm 1 (màu) đúng chữ trong danh sách, "" nếu không rõ' },
    gt2: { type: 'string', description: 'Giá trị nhóm 2 (cỡ) đúng chữ trong danh sách, "" nếu không rõ' },
    so_luong: { type: 'integer', description: 'Số lượng, mặc định 1' },
    chac_chan: { type: 'boolean', description: 'true chỉ khi chắc chắn cả sản phẩm, màu, cỡ' },
  },
  required: ['la_chot', 'so', 'gt1', 'gt2', 'so_luong', 'chac_chan'],
  additionalProperties: false,
};

/**
 * @param {string} noiDung  bình luận
 * @param {{so:number, ten:string, nhom:{t1:string,t2:string|null}, phan_loai:{gt1:string,gt2:string|null,bo:boolean}[]}[]} dsSanPham  món trong phiên
 * @param {object} o  phienLiveId, dienTap, soDangNoi, ten (người bình luận), nhaCungCap (test)
 */
async function docChotAi(noiDung, dsSanPham, { phienLiveId = null, dienTap = false, soDangNoi = null, ten = 'Người xem', nhaCungCap } = {}) {
  const moTa = dsSanPham.slice(0, 20).map((s) => {
    const pl = s.phan_loai.filter((p) => !p.bo);
    const g1 = [...new Set(pl.map((p) => p.gt1))];
    const g2 = [...new Set(pl.map((p) => p.gt2).filter(Boolean))];
    return `- Số ${s.so} · ${s.ten}: ${s.nhom.t1} (${g1.join(', ')})${s.nhom.t2 ? `; ${s.nhom.t2} (${g2.join(', ')})` : ''}${s.so === soDangNoi ? ' ← đang nói' : ''}`;
  });
  const kq = await chayAgent({
    agentId: 'doc_chot',
    kichHoat: 'Đọc hộ bình luận chốt khó hiểu',
    tinDau: [
      'Sản phẩm trong buổi live (khách chốt bằng cú pháp "chốt" + số + màu + size; rau củ bán theo cân thì "chốt" + số món + số cân, ví dụ "chốt 50 2kg" là 2 gói 1 kg; không ghi số thì là món đang nói):',
      ...moTa,
      '',
      `Bình luận: ${dongKhung('binh_luan', ten, noiDung)}`,
      '',
      'Người xem có muốn mua không? Nếu có: số sản phẩm, màu, cỡ (chép đúng chữ trong danh sách trên), số lượng. Không đoán — không rõ thì để trống và chac_chan = false. Trả đúng một phiếu JSON.',
    ].join('\n'),
    luocDo: LUOC_DO,
    lienKet: { phienLiveId, dienTap },
    gioiHan: { so_buoc: 1 },
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  return kq.ok ? kq.ketQua : null;
}

module.exports = { docChotAi, LUOC_DO };
