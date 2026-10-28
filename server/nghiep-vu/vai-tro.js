'use strict';

/**
 * Lời dặn vai trò (F-12, A.7): mỗi Agent và miệng có một lời dặn, quản lý phiên bản như Skill.
 * Sửa lời dặn không đụng tới danh sách công cụ hay luật quyền — hai thứ đó nằm ở bảng khác.
 */

const { LoiNghiepVu, kiemChu } = require('./chung');
const { taoBoBanSua } = require('./ban-sua');
const { tenAi, tenShop } = require('./cai-dat');
const MAU = require('../cau-hinh/loi-dan-mau.json');
const MAU_CU = require('../cau-hinh/loi-dan-mau-cu.json');

const AI = {
  director: 'Director',
  cohost: 'Co-host',
  tu_van: 'Tư vấn viên AI',
  mieng: 'Miệng của Mai',
  mieng_dan: 'Mai dẫn chính (miệng)', // bản 2.7, #47: lời dặn riêng khi Mai cầm chương trình
  nguoi_dong_vai: 'Người đóng vai (Phòng diễn tập)',
  soat_san_pham: 'Soát sản phẩm (Xem thử AI hiểu gì)',
  bai_hoc: 'Đề xuất bài học (vòng cải tiến)',
  soan_kich_ban: 'Soạn kịch bản live',
  doc_anh: 'Đọc ảnh sản phẩm (Tạo từ ảnh)',
  quan_ly: 'Nói với Mai (quản lý shop)',
  doc_chot: 'Đọc bình luận chốt (model rẻ)',
  tim_mau: 'Tìm mẫu theo ảnh khách gửi',
  khach_gia: 'Khách giả (Phòng diễn tập)',
  soan_bai: 'Soạn bài báo trước live', // F-96
  tong_ket: 'Tổng kết sau live', // F-102
  nhin_mon: 'MOZA nhìn món', // F-107
};

/** Agent thử nghiệm (F-34) thêm bằng cấu hình: tên lấy từ bảng `agent`. */
function tenAgentThuNghiem(id) {
  return require('../db/ket-noi').csdl().prepare('SELECT ten FROM agent WHERE id = ? AND thu_nghiem = 1').get(id)?.ten ?? null;
}

function tenAgent(id) {
  return AI[id] || tenAgentThuNghiem(id);
}

const bo = taoBoBanSua({ bang: 'vai_tro_ban_sua', cotKhoa: 'agent_id', truong: ['noi_dung'] });

function kiemAgent(id) {
  if (!Object.hasOwn(AI, id) && !tenAgentThuNghiem(id)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có Agent này.', 404);
  return id;
}

/** Gieo lời dặn bản 1 cho một Agent thử nghiệm vừa thêm. */
function gieoChoAgent(id, noiDung) {
  bo.gieo(id, { noi_dung: kiemChu(noiDung, { ten: 'Lời dặn vai trò', batBuoc: true, toiDa: 8000 }) });
}

/**
 * Lần chạy đầu gieo bản 1. Các lần sau: lời dặn còn đúng chữ một bản mẫu cũ (chưa sửa tay) thì nâng lên bản mẫu mới
 * (ví dụ khi phần mềm có lời dặn mới). Đã sửa tay thì giữ nguyên.
 */
function gieoVaiTro() {
  for (const id of Object.keys(AI)) {
    bo.gieo(id, { noi_dung: MAU[id] });
    bo.nangMau(id, (MAU_CU[id] || []).map((noiDung) => ({ noi_dung: noiDung })), { noi_dung: MAU[id] });
  }
}

/** Lời dặn đang dùng, đã thay {ten_ai}, {ten_shop} — thứ gửi cho AI. */
function loiDan(agentId) {
  const b = bo.dangDung(kiemAgent(agentId));
  return { phien_ban: b.phien_ban, noi_dung: b.noi_dung.replaceAll('{ten_ai}', tenAi()).replaceAll('{ten_shop}', tenShop()) };
}

function xem(agentId) {
  kiemAgent(agentId);
  return { agent_id: agentId, ten: tenAgent(agentId), dang_dung: bo.dangDung(agentId), nhap: bo.nhap(agentId), lich_su: bo.danhSach(agentId) };
}

function danhSach() {
  const thuNghiem = require('../db/ket-noi').csdl().prepare('SELECT id, ten FROM agent WHERE thu_nghiem = 1 ORDER BY rowid').all().map((r) => [r.id, r.ten]);
  return [...Object.entries(AI), ...thuNghiem].map(([id, ten]) => {
    const d = bo.dangDung(id);
    return { agent_id: id, ten, phien_ban: d?.phien_ban ?? null, co_nhap: !!bo.nhap(id) };
  });
}

function luuNhap(agentId, noiDung) {
  kiemAgent(agentId);
  bo.luuNhap(agentId, { noi_dung: kiemChu(noiDung, { ten: 'Lời dặn vai trò', batBuoc: true, toiDa: 8000 }) });
  return xem(agentId);
}

function kichHoat(agentId, phienBan = null) {
  bo.kichHoat(kiemAgent(agentId), phienBan);
  return xem(agentId);
}

function quayLai(agentId) {
  bo.quayLai(kiemAgent(agentId));
  return xem(agentId);
}

function boNhap(agentId) {
  bo.boNhap(kiemAgent(agentId));
  return xem(agentId);
}

module.exports = { AI, gieoVaiTro, gieoChoAgent, tenAgent, loiDan, xem, danhSach, luuNhap, kichHoat, quayLai, boNhap, layBan: bo.layBan };
