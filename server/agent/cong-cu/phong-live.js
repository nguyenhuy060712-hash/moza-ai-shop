'use strict';

/**
 * Công cụ phòng live (A.6): của Director (xem tình hình, gợi ý người dẫn, giao Co-host, chuyển Tư vấn viên,
 * báo người dẫn), của Co-host (đề xuất câu trên sóng) và của Người đóng vai (đưa bình luận vào Facebook giả).
 * Công cụ không tự giữ trạng thái phòng live: làm qua `ctx.phongAi` (server/phong-ai.js).
 */

const sp = require('../../nghiep-vu/san-pham');
const skill = require('../../nghiep-vu/skill');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');

const chuoi = (moTa) => ({ type: 'string', description: moTa });
const mang = (moTa) => ({ type: 'array', items: { type: 'string' }, description: moTa });
const vat = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const TRICH_DAN = {
  type: 'array',
  description: 'Mỗi đoạn chép nguyên văn từ nguồn. nguon = số sản phẩm (ví dụ "12") hoặc "so_tay".',
  items: vat({ nguon: chuoi('Số sản phẩm hoặc "so_tay"'), doan: chuoi('Đoạn chép nguyên văn') }),
};

function canPhong(ctx) {
  if (!ctx.phongAi) throw new LoiNghiepVu('KHONG_CO_LIVE', 'Không có buổi live nào đang chạy.');
  return ctx.phongAi;
}

const xemTinhHinhPhien = {
  ten: 'xem_tinh_hinh_phien',
  moTa: 'Xem tình hình buổi live: đoạn đang nói, sản phẩm đang nói, người dẫn có đang nói không, câu hỏi nổi bật, câu đã trả lời.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({}),
  chay: (ts, ctx) => canPhong(ctx).tinhHinh(),
};

const xemCauHoiMoi = {
  ten: 'xem_cau_hoi_moi',
  moTa: 'Xem các bình luận mới chưa được xử lý trong buổi live.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({}),
  chay: (ts, ctx) => ({ binh_luan: canPhong(ctx).cauHoiMoi() }),
};

const goiYNguoiDan = {
  ten: 'goi_y_nguoi_dan',
  moTa: 'Hiện một câu nhắc ngắn cho người dẫn trên Màn hình người dẫn (ví dụ: nhiều người hỏi size, nên nói phần bảng size). Không chứa con số.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ cau: chuoi('Câu nhắc cho người dẫn, tối đa 3 câu') }),
  // Người dẫn có thể đọc to câu này, nên nó cũng qua Bộ kiểm tra như câu trên sóng: không số bịa, không nhắc sản phẩm khác.
  cauRaNgoai: (ts, ctx) => ({ cau: ts.cau, trich_dan: [], kenh: 'song', soDuocGiao: ctx.soDuocGiao ?? null, phienLiveId: ctx.phienLiveId, tenNguoi: ctx.tenNguoi || [] }),
  chay: (ts, ctx) => canPhong(ctx).hienGoiY({ loai: 'director', cau: ts.cau, so: ctx.soDuocGiao ?? null, runId: ctx.runId }),
};

const giaoCohost = {
  ten: 'giao_cohost',
  moTa: 'Giao Co-host soạn câu trả lời trên sóng cho một câu hỏi rõ ràng về một sản phẩm Đang bán, kèm tối đa 2 Skill cho Co-host.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ cau_hoi: chuoi('Câu hỏi đã gom, viết rõ'), so: { type: 'integer', description: 'Số sản phẩm, ví dụ 12' }, skill_ids: mang('Tối đa 2 id Skill cho Co-host') }),
  async chay(ts, ctx) {
    const t = sp.layTheoSo(ts.so);
    if (!t) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${ts.so}.`);
    if (t.trang_thai !== 'dang_ban') throw new LoiNghiepVu('SP_KHONG_BAN_DUOC', `Sản phẩm số ${t.so} không Đang bán: không giao Co-host.`);
    // Skill lạ hoặc không cấp cho Co-host thì bỏ, không làm hỏng lượt giao.
    const duocCap = new Set(skill.mucLuc('cohost').map((s) => s.id));
    const skillIds = [...new Set(ts.skill_ids)].filter((id) => duocCap.has(id)).slice(0, 2);
    return canPhong(ctx).giaoCohost({ cauHoi: ts.cau_hoi, so: t.so, skillIds, binhLuanIds: ctx.binhLuanIds || [], directorRunId: ctx.runId });
  },
};

const chuyenTuVan = {
  ten: 'chuyen_tu_van',
  moTa: 'Chuyển các bình luận mang tính cá nhân sang danh sách "Chờ Tư vấn viên" để nhắn riêng sau.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ binh_luan_ids: mang('id các bình luận') }),
  chay: (ts, ctx) => canPhong(ctx).chuyenTuVan(ts.binh_luan_ids),
};

const baoNguoiDan = {
  ten: 'bao_nguoi_dan',
  moTa: 'Báo người dẫn một việc cần biết ngay (người xem bức xúc, không rõ hỏi món nào…). Chỉ hiện trên Màn hình người dẫn.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ noi_dung: chuoi('Lời báo ngắn') }),
  chay: (ts, ctx) => canPhong(ctx).bao(ts.noi_dung),
};

const deXuatCauSong = {
  ten: 'de_xuat_cau_song',
  moTa: 'Đưa câu trả lời 1–3 câu kèm trích dẫn nguyên văn lên sóng (chế độ gợi ý: hiện chữ to cho người dẫn đọc).',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ cau: chuoi('Câu trả lời, tối đa 3 câu'), trich_dan: TRICH_DAN }),
  cauRaNgoai: (ts, ctx) => ({
    cau: ts.cau, trich_dan: ts.trich_dan, kenh: 'song', soDuocGiao: ctx.soDuocGiao, phienLiveId: ctx.phienLiveId, tenNguoi: ctx.tenNguoi || [],
  }),
  chay: (ts, ctx) => canPhong(ctx).hienGoiY({
    loai: 'cohost', cau: ts.cau, trichDan: ts.trich_dan, cauHoi: ctx.cauHoi ?? null, so: ctx.soDuocGiao ?? null, runId: ctx.runId,
    binhLuanId: ctx.binhLuanId ?? null,
  }),
};

const duaBinhLuanGia = {
  ten: 'dua_binh_luan_gia',
  moTa: 'Đưa một bình luận giả vào live giả của Phòng diễn tập.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ ten: chuoi('Tên người xem giả'), noi_dung: chuoi('Nội dung bình luận') }),
  // Chỉ Facebook giả: dòng diễn tập không bao giờ đi qua bộ Kết nối Facebook thật (mục 7).
  chay(ts, ctx) {
    if (!ctx.dienTap || !ctx.fbGia) throw new LoiNghiepVu('CHI_DIEN_TAP', 'Chỉ dùng được trong Phòng diễn tập.');
    return { binh_luan: ctx.fbGia.themBinhLuan({ ten: ts.ten, noi_dung: ts.noi_dung }) };
  },
};

module.exports = [xemTinhHinhPhien, xemCauHoiMoi, goiYNguoiDan, giaoCohost, chuyenTuVan, baoNguoiDan, deXuatCauSong, duaBinhLuanGia];
