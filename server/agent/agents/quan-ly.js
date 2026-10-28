'use strict';

/**
 * "Nói với Mai" — quản lý shop bằng lời (SPEC.md F-62, #76). Agent `quan_ly` chạy trên runtime sẵn có với công cụ của
 * MOZA: đọc thì trả lời ngay; việc có ảnh hưởng (nhập kho, điều chỉnh, đổi trạng thái) thành mục chờ duyệt có bảng
 * xem trước — chỉ ghi khi người bấm "Làm" (luật "Hỏi"). Câu mơ hồ thì công cụ trả lỗi kèm danh sách, Mai hỏi lại.
 * Việc người dùng tự gõ nên chạy cả khi "Dừng mọi thứ" đang bật (việc ghi vẫn chờ "Làm"). Không bao giờ chặn đường live:
 * mỗi câu một lần chạy riêng.
 */

const { chayAgent } = require('../runtime');
const choDuyet = require('../../nghiep-vu/cho-duyet');
const { layCongCu } = require('../cong-cu/danh-sach');
const { kiemChu, LoiNghiepVu } = require('../../nghiep-vu/chung');

const PHIEU = {
  type: 'object',
  properties: {
    tra_loi: { type: 'string', description: 'Câu trả lời ngắn cho người dùng (tiếng Việt, lời thường). Có việc chờ bấm "Làm" thì nói rõ đã chuẩn bị gì.' },
    man_hinh: { type: 'string', enum: ['', 'san_pham', 'kho', 'don', 'khach', 'bao_cao'], description: 'Màn hình liên quan để mở, "" nếu không' },
  },
  required: ['tra_loi', 'man_hinh'],
  additionalProperties: false,
};

/** Bảng xem trước của một mục chờ duyệt (đọc lại lúc hiện, nên đúng tồn hiện tại). */
function xemTruocMuc(muc) {
  const cc = layCongCu(muc.hanh_dong);
  try {
    return cc?.xemTruoc ? cc.xemTruoc(muc.tham_so).xem_truoc : [`${muc.hanh_dong}: ${JSON.stringify(muc.tham_so)}`];
  } catch (e) {
    return [`Không còn làm được: ${e.message}`];
  }
}

/**
 * Chạy một câu của người dùng.
 * @param {string} cau
 * @param {object} [o]  nhaCungCap (test)
 * @returns {Promise<{tra_loi:string, man_hinh:string, viec:{id:string, hanh_dong:string, xem_truoc:string[]}[], run_id:string}>}
 */
async function noiVoiMai(cau, { nhaCungCap } = {}) {
  const c = kiemChu(cau, { ten: 'Câu nói với Mai', batBuoc: true, toiDa: 1000 });
  const kq = await chayAgent({
    agentId: 'quan_ly',
    kichHoat: `Nói với Mai: "${c.slice(0, 80)}"`,
    tinDau: [
      `Người dùng (chủ shop) nói: "${c}"`,
      '',
      'Làm đúng việc được nhờ bằng công cụ. Tìm sản phẩm bằng tim_san_pham khi chưa rõ số. Việc ghi (nhập kho, điều chỉnh, đổi trạng thái, điền thông tin shop dat_ban_hang, ghi Sổ tay ghi_so_tay): gọi công cụ đúng một lần với đủ các dòng — MOZA sẽ hiện bảng xem trước và chờ người bấm "Làm"; đừng gọi lại.',
      'Chỉ dùng con số có trong câu người dùng; trong câu trả lời đọc lại các con số sẽ ghi để người dùng soát (phòng nghe nhầm).',
      ...(() => { const t = require('../../nghiep-vu/cai-dat').thongTinShopConThieu(); return t.length ? [`Thông tin shop còn thiếu: ${t.map((x) => x.ten).join('; ')}.`] : []; })(),
      'Câu mơ hồ (không rõ số sản phẩm, màu, cỡ) thì hỏi lại, không đoán. Không có công cụ xóa, sửa giá, sửa đơn đã gửi: việc đó hướng dẫn người dùng làm ở màn hình.',
      'Trả đúng một phiếu JSON {tra_loi, man_hinh}.',
    ].join('\n'),
    mucLuc: { skill: true },
    luocDo: PHIEU,
    boQuaKhanCap: true,
    nguCanhCongCu: { cauNguoiDung: c }, // F-95: số trong việc ghi phải có trong câu này
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  if (!kq.ok && !kq.runId) throw new LoiNghiepVu(kq.loi?.ma || 'AI_LOI', kq.loi?.thong_diep || 'Mai chưa trả lời được. Thử lại.', 502);
  const viec = choDuyet.danhSach({ trangThai: 'cho' }).filter((m) => m.run_id === kq.runId)
    .map((m) => ({ id: m.id, hanh_dong: m.hanh_dong, xem_truoc: xemTruocMuc(m) }));
  const traLoi = kq.ok ? kq.ketQua.tra_loi : (viec.length ? 'Mai đã chuẩn bị việc, anh/chị xem bảng rồi bấm "Làm".' : `Mai chưa làm được: ${kq.loi?.thong_diep || 'lỗi'}`);
  return { tra_loi: traLoi, man_hinh: kq.ok ? kq.ketQua.man_hinh : '', viec, run_id: kq.runId };
}

module.exports = { noiVoiMai, xemTruocMuc, PHIEU };
