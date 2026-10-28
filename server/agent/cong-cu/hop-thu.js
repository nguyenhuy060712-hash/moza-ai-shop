'use strict';

/**
 * Công cụ của Tư vấn viên AI (A.6, F-25 → F-32). Mỗi công cụ chỉ làm việc trên **hội thoại đang xử lý**
 * (`ctx.hoiThoaiId`) — AI không đọc được hội thoại hay hồ sơ khách của người khác (F-07: ngữ cảnh tách biệt).
 * Câu gửi ra ngoài (`cauRaNgoai`) luôn qua cửa `truoc_cong_cu`: khẩn cấp, luật quyền, luật Hộp thư (24 giờ, nhắn riêng
 * 1 lần / 7 ngày, tần suất, AI tạm dừng), tự thêm câu giới thiệu, Bộ kiểm tra (A.4).
 */

const crypto = require('node:crypto');
const hopThu = require('../../nghiep-vu/hop-thu');
const kh = require('../../nghiep-vu/khach');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');
const { soTrongLoiKhach } = require('../kiem-tra/kiem-tra');

const chuoi = (moTa) => ({ type: 'string', description: moTa });
const vat = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const TRICH_DAN = {
  type: 'array',
  description: 'Mỗi đoạn chép nguyên văn từ nguồn. nguon = số sản phẩm (ví dụ "12"), "so_tay", hoặc "cai_dat" (phí ship). Câu không có con số hay điều kiện thì để [].',
  items: vat({ nguon: chuoi('Số sản phẩm, "so_tay" hoặc "cai_dat"'), doan: chuoi('Đoạn chép nguyên văn') }),
};

function canHoiThoai(ctx) {
  if (!ctx.hoiThoaiId) throw new LoiNghiepVu('KHONG_CO_HOI_THOAI', 'Công cụ này chỉ dùng khi đang xử lý một hội thoại Hộp thư.');
  return hopThu.layHoiThoai(ctx.hoiThoaiId);
}

function canKhach(ctx) {
  const h = canHoiThoai(ctx);
  if (!h.khach_id) {
    throw new LoiNghiepVu('CHUA_CO_HO_SO', 'Người này chưa có hồ sơ khách hàng (hồ sơ tạo khi khách cho số điện thoại lúc lên đơn). Ghi điều cần nhớ vào tom_tat của phiếu.');
  }
  return kh.layKhach(h.khach_id);
}

/** Bình luận gốc mới nhất của khách trong hội thoại bình luận (để trả lời / nhắn riêng). */
function binhLuanMoiNhat(h) {
  const t = hopThu.tinCuaHoiThoai(h.id).filter((x) => x.gui_boi === 'khach' && x.fb_comment_id).at(-1);
  if (!t) throw new LoiNghiepVu('KHONG_CO_BINH_LUAN', 'Hội thoại này không có bình luận nào để trả lời. Đây là Messenger: dùng gui_messenger.');
  return t;
}

const bam = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

/**
 * Gửi một câu ra Facebook đúng một lần (F-25). Khóa chống trùng theo lần chạy + nội dung: AI gọi lại cùng câu trong
 * cùng lần chạy thì không gửi hai lần. Mất mạng giữa chừng → "không rõ", Cần người, không tự gửi lại (mục 9).
 */
async function guiRa(loai, ts, ctx) {
  const h = canHoiThoai(ctx);
  const noiDung = ts.noi_dung;
  const bl = loai === 'tin' ? null : binhLuanMoiNhat(h);
  const khoa = ctx.khoaChongTrung || `${ctx.chuDong ? 'chu_dong:' : ''}${ctx.runId || 'khong_run'}:${loai}:${bam(noiDung)}`;
  const { tin, daCo } = hopThu.ghiTinRa({
    hoiThoaiId: h.id, guiBoi: ctx.agentId ? 'ai' : (ctx.guiBoi || 'ai'), loai, noiDung, khoa, runId: ctx.runId ?? null,
    trichDan: ts.trich_dan || [], fbCommentId: bl?.fb_comment_id ?? null,
  });
  if (daCo) return { tin_nhan_id: tin.id, trang_thai: tin.trang_thai_gui, ghi_chu: 'Câu này đã gửi ở bước trước; không gửi lại.' };
  const fb = ctx.layKetNoi({ dien_tap: h.dien_tap });
  if (!h.dien_tap && fb.ten !== 'that') {
    hopThu.capNhatGui(tin.id, { trangThai: 'loi', loi: 'Facebook thật chưa kết nối.' });
    throw new LoiNghiepVu('FB_CHUA_KET_NOI', 'Facebook thật chưa kết nối: không gửi được. Gọi chuyen_can_nguoi.');
  }
  const nguoi = hopThu.layNguoi(h.nguoi_fb_id);
  try {
    let fbId = null;
    if (loai === 'tin') fbId = (await fb.guiTinNhan({ page_id: h.page_id, psid: nguoi.psid, noi_dung: noiDung })).mid;
    else if (loai === 'tra_loi') fbId = (await fb.traLoiBinhLuan({ page_id: h.page_id, comment_id: bl.fb_comment_id, noi_dung: noiDung })).id;
    else {
      // F-65: giữ lượt nhắn riêng của bình luận trước khi gửi — đường khác đã giữ thì không gửi (không lỗi DA_NHAN_RIENG).
      const luot = require('../../nghiep-vu/luot-nhan-rieng');
      const g = luot.giu({ fbCommentId: bl.fb_comment_id, pageId: h.page_id, boi: 'tu_van', hoiThoaiId: h.id });
      if (!g.thang && g.luot.boi !== 'tu_van') {
        hopThu.capNhatGui(tin.id, { trangThai: 'loi', loi: 'Bình luận đã được MOZA nhắn riêng bằng thẻ.' });
        throw new LoiNghiepVu('DA_NHAN_RIENG', 'MOZA đã nhắn riêng bình luận này (thẻ tự động). Chờ khách trả lời trong Messenger.');
      }
      try {
        const kq = await fb.nhanRieng({ page_id: h.page_id, comment_id: bl.fb_comment_id, noi_dung: noiDung });
        fbId = kq.mid;
        if (kq.psid) hopThu.ganPsid(h.nguoi_fb_id, kq.psid);
        luot.daGui(bl.fb_comment_id, { hoiThoaiId: h.id });
      } catch (e) {
        if (e.ma !== 'FB_MAT_MANG') luot.loi(bl.fb_comment_id);
        throw e;
      }
    }
    hopThu.capNhatGui(tin.id, { trangThai: 'da_gui', fbId });
    return { tin_nhan_id: tin.id, trang_thai: 'da_gui' };
  } catch (e) {
    const khongRo = e.ma === 'FB_MAT_MANG';
    hopThu.capNhatGui(tin.id, { trangThai: khongRo ? 'khong_ro' : 'loi', loi: e.message });
    if (khongRo) hopThu.datCanNguoi(h.id, 'Tin vừa gửi không rõ đã tới chưa (mất mạng). Kiểm tra trên Facebook trước khi gửi lại.');
    throw new LoiNghiepVu(e.ma || 'FB_LOI', `${e.message}${khongRo ? ' Không gửi lại; đã chuyển Cần người.' : ''}`);
  }
}

function cauRaNgoai(kenh) {
  return (ts, ctx) => {
    let ten = [];
    let soKhachNoi = [];
    let donCuaKhach = [];
    try {
      const h = hopThu.layHoiThoai(ctx.hoiThoaiId);
      ten = [hopThu.layNguoi(h.nguoi_fb_id)?.ten_hien_thi].filter(Boolean);
      // K3 ngoại lệ (A.4): chiều cao, cân nặng, số đo khách tự nói được nhắc lại.
      donCuaKhach = require('../../nghiep-vu/don').danhSach({ gioiHan: 100 })
        .filter((d) => d.hoi_thoai_id === h.id || (h.nguoi_fb_id && d.nguoi_fb_id === h.nguoi_fb_id) || (h.khach_id && d.khach_id === h.khach_id)).map((d) => d.id);
      soKhachNoi = soTrongLoiKhach(hopThu.tinCuaHoiThoai(h.id, { gioiHan: 30 }).filter((t) => t.gui_boi === 'khach').map((t) => t.noi_dung));
      // F-91: số đo khách đã cho lưu cũng được nhắc lại (trong Messenger).
      const sd = kenh === 'messenger' ? require('../../nghiep-vu/khach').soDo(h.khach_id) : null;
      if (sd) soKhachNoi.push(sd.chieu_cao, sd.chieu_cao / 100, sd.can_nang);
    } catch { /* không có hội thoại: công cụ sẽ tự báo lỗi */ }
    return { cau: ts.noi_dung, trich_dan: ts.trich_dan || [], kenh, tenNguoi: kenh === 'binh_luan' ? ten : [], soKhachNoi, donCuaKhach };
  };
}

const xemHoiThoai = {
  ten: 'xem_hoi_thoai',
  moTa: 'Xem các tin gần nhất của hội thoại đang xử lý (kèm id từng tin, để làm bằng chứng khi đổi trạng thái hoặc ghi bộ nhớ).',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({}),
  chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    return {
      kenh: h.kenh,
      tin: hopThu.tinCuaHoiThoai(h.id, { gioiHan: 20 }).filter((t) => t.chieu !== 'noi_bo')
        .map((t) => ({ id: t.id, tu: t.gui_boi, noi_dung: t.noi_dung, luc: t.luc })),
    };
  },
};

const xemKhach = {
  ten: 'xem_khach',
  moTa: 'Xem hồ sơ khách đang nhắn: tên, có số điện thoại chưa (số được che bớt), địa chỉ giao đã có (để hỏi "giao về … như lần trước?"), các đơn, bộ nhớ.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({}),
  chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    if (!h.khach_id) return { co_ho_so: false };
    const ct = kh.chiTiet(h.khach_id);
    const so = ct.khach.sdt_hien;
    return {
      co_ho_so: true,
      ten: ct.khach.ten,
      so_dien_thoai: so ? `${so.slice(0, 4)} *** ${so.slice(-3)}` : '',
      dia_chi: ct.khach.dia_chi,
      don: ct.don.map((d) => ({ ma: d.ma, trang_thai: d.trang_thai })),
      bo_nho: ct.bo_nho.map((x) => ({ loai: x.loai, noi_dung: x.noi_dung })),
    };
  },
};

const ganNhan = {
  ten: 'gan_nhan',
  moTa: 'Gắn nhãn cho hội thoại (ví dụ hoi_gia, hoi_size, muon_mua, mac_ca, khieu_nai, buc_xuc, nhay_cam, spam), mức ưu tiên 0–3 và số sản phẩm đang được hỏi (0 nếu chưa rõ).',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ nhan: { type: 'array', items: { type: 'string' }, description: 'Nhãn ngắn, chữ thường không dấu' }, uu_tien: { type: 'integer', description: '0–3' }, so: { type: 'integer', description: 'Số sản phẩm, 0 nếu chưa rõ' } }),
  chay(ts, ctx) {
    canHoiThoai(ctx);
    const { boDau } = require('../../nghiep-vu/chung');
    // "Hỏi giá" → "hoi_gia": nhãn luôn chữ thường không dấu như mô tả công cụ.
    const nhan = ts.nhan.map((x) => boDau(String(x)).trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)).filter(Boolean).slice(0, 5);
    const h = hopThu.ganNhan(ctx.hoiThoaiId, { nhan, uuTien: Math.max(0, Math.min(3, ts.uu_tien | 0)), sanPhamId: (ts.so && require('../../nghiep-vu/san-pham').layTheoSo(ts.so)?.id) || null });
    if (nhan.includes('spam')) hopThu.datTrangThai(h.id, 'spam');
    return { nhan: h.nhan };
  },
};

const ghiBoNho = {
  ten: 'ghi_bo_nho',
  moTa: 'Ghi một điều cần nhớ về người này: nguoi_do_noi (người đó kể), da_xac_nhan (đã xác nhận rõ), da_hua (điều mình đã hứa). Cần có hồ sơ.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ loai: { type: 'string', enum: ['nguoi_do_noi', 'da_xac_nhan', 'da_hua'] }, noi_dung: chuoi('Một ý ngắn'), tin_nhan_id: chuoi('id tin nhắn làm nguồn, hoặc ""') }),
  chay(ts, ctx) {
    const u = canKhach(ctx);
    const bn = kh.ghiBoNho(u.id, { loai: ts.loai, noiDung: ts.noi_dung, nguonTinNhanId: ts.tin_nhan_id || null });
    return { bo_nho_id: bn.id };
  },
};

const taoViec = {
  ten: 'tao_viec',
  moTa: 'Tạo việc cho người dùng (ví dụ "Bổ sung thông tin áo số 12: chưa có bảng size"). loai: bo_sung_thong_tin (sản phẩm thiếu thông tin), goi_khach, khac. han_luc dạng ISO hoặc "".',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ loai: { type: 'string', enum: ['bo_sung_thong_tin', 'goi_khach', 'khac'] }, noi_dung: chuoi('Việc cần làm, một dòng'), han_luc: chuoi('Thời điểm nhắc ISO, hoặc ""') }),
  chay(ts, ctx) {
    const h = ctx.hoiThoaiId ? hopThu.layHoiThoai(ctx.hoiThoaiId) : null;
    const v = kh.taoViec({ loai: ts.loai, noiDung: ts.noi_dung, hanLuc: ts.han_luc || null, khachId: h?.khach_id ?? null,
      hoiThoaiId: h?.id ?? null, choAi: 'nguoi', taoBoi: 'ai' });
    return { viec_id: v.id };
  },
};

const chuyenCanNguoi = {
  ten: 'chuyen_can_nguoi',
  moTa: 'Chuyển cho người xử lý (Cần người) kèm lý do ngắn; AI ngừng gửi ở hội thoại này. Dùng khi khách đòi gặp người thật, khiếu nại hàng lỗi, đòi hoàn tiền, mặc cả dai, bức xúc, hoặc nguồn không có câu trả lời.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ ly_do: chuoi('Lý do ngắn') }),
  chay(ts, ctx) {
    if (ctx.hoiThoaiId) {
      hopThu.datCanNguoi(ctx.hoiThoaiId, ts.ly_do);
      ctx.daChuyenNguoi = true;
      return { ok: true };
    }
    if (ctx.phongAi) return ctx.phongAi.bao(`Cần người: ${ts.ly_do}`);
    throw new LoiNghiepVu('KHONG_CO_HOI_THOAI', 'Không có hội thoại nào đang xử lý.');
  },
};

const guiMessenger = {
  ten: 'gui_messenger',
  moTa: 'Gửi một tin Messenger cho khách đang nhắn (mỗi tin một ý, ngắn). Kèm trích dẫn nguyên văn cho mọi con số: giá, còn bao nhiêu, phí ship, size.',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  kenhGui: 'messenger',
  thamSo: vat({ noi_dung: chuoi('Nội dung tin, tối đa 1000 ký tự'), trich_dan: TRICH_DAN }),
  cauRaNgoai: cauRaNgoai('messenger'),
  giay: 25,
  chay: (ts, ctx) => {
    const h = canHoiThoai(ctx);
    if (h.kenh !== 'messenger') throw new LoiNghiepVu('SAI_KENH', 'Đây là hội thoại bình luận: dùng nhan_rieng (mời nhắn tin) hoặc tra_loi_binh_luan.');
    return guiRa('tin', ts, ctx);
  },
};

const traLoiBinhLuan = {
  ten: 'tra_loi_binh_luan',
  moTa: 'Trả lời công khai bình luận mới nhất của người này. Không xin số điện thoại, địa chỉ ở đây; mời nhắn tin riêng.',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  kenhGui: 'tra_loi',
  thamSo: vat({ noi_dung: chuoi('Câu trả lời công khai, ngắn'), trich_dan: TRICH_DAN }),
  cauRaNgoai: cauRaNgoai('binh_luan'),
  giay: 25,
  chay: (ts, ctx) => guiRa('tra_loi', ts, ctx),
};

const nhanRieng = {
  ten: 'nhan_rieng',
  moTa: 'Nhắn riêng (Messenger) cho người vừa bình luận — chỉ được 1 lần mỗi bình luận, trong 7 ngày. Hội thoại chỉ tiếp tục khi họ trả lời.',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  kenhGui: 'nhan_rieng',
  thamSo: vat({ noi_dung: chuoi('Tin nhắn riêng, tối đa 1000 ký tự'), trich_dan: TRICH_DAN }),
  cauRaNgoai: cauRaNgoai('nhan_rieng'),
  giay: 25,
  chay: (ts, ctx) => guiRa('nhan_rieng', ts, ctx),
};

const datNhac = {
  ten: 'dat_nhac',
  moTa: 'Hẹn MOZA nhắn lại khách vào một lúc sau (ví dụ khách hẹn "tối shop nhắn lại"). Ngoài 24 giờ kể từ tin cuối của khách thì không nhắn được.',
  nhom: 'noi_bo',
  macDinh: 'cho_phep',
  thamSo: vat({ luc: chuoi('Thời điểm ISO có +07:00'), noi_dung: chuoi('Hỏi thăm về việc gì (ghi chú cho lần sau)') }),
  chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    const v = kh.taoViec({ loai: 'hoi_tham', noiDung: ts.noi_dung, hanLuc: ts.luc, khachId: h.khach_id, hoiThoaiId: h.id, choAi: 'ai', taoBoi: 'ai' });
    return { viec_id: v.id };
  },
};

module.exports = [xemHoiThoai, xemKhach, ganNhan, ghiBoNho, taoViec, chuyenCanNguoi, guiMessenger, traLoiBinhLuan, nhanRieng, datNhac];
module.exports.guiRa = guiRa;
