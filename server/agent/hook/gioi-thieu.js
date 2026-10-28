'use strict';

/**
 * Tự thêm câu giới thiệu trợ lý tự động (A.3 cửa `truoc_cong_cu`, bắt buộc; F-31; quy định Meta: bot phải tự giới thiệu).
 * Tin AI đầu tiên của mỗi hội thoại, và tin đầu tiên sau khi người dùng giao lại cho AI, phải nói mình là trợ lý tự động.
 * AI quên thì hook thêm vào đầu câu (quyết định `sua`). Chạy trước Bộ kiểm tra để độ dài được kiểm cả câu giới thiệu.
 */

const hopThu = require('../../nghiep-vu/hop-thu');
const caiDat = require('../../nghiep-vu/cai-dat');
const { boDau } = require('../../nghiep-vu/chung');

function daTuGioiThieu(cau) {
  return /tro ly (tu dong|ai)(?![a-z])/.test(boDau(cau));
}

module.exports = {
  id: 'gioi_thieu',
  cua: 'truoc_cong_cu',
  ten: 'Tự giới thiệu là trợ lý tự động',
  moTa: 'Tin AI đầu tiên của mỗi hội thoại luôn có câu "Mình là … (trợ lý tự động) của <tên shop>"; AI quên thì tự thêm.',
  batBuoc: true,
  daTuGioiThieu,
  chay(ctx) {
    const kenh = ctx.congCu.kenhGui;
    // Tin do mã soạn (gui_the_moza, F-65): tin đầu của hội thoại cũng phải tự nhận trợ lý AI (Luật AI Điều 11, #103).
    if (kenh === 'the_moza') return this.chayTheMoza(ctx);
    if (!kenh || kenh === 'tra_loi' || !ctx.agentId) return { quyet_dinh: 'cho_qua' };
    const h = hopThu.layHoiThoai(ctx.nguCanh.hoiThoaiId);
    const cau = String(ctx.thamSo?.noi_dung || '');
    // Nhắn riêng mở một hội thoại Messenger mới với người bình luận: luôn tự giới thiệu, dù đã trả lời công khai trước đó.
    if ((h.da_gioi_thieu_ai && kenh !== 'nhan_rieng') || daTuGioiThieu(cau)) return { quyet_dinh: 'cho_qua' };
    const tenAi = caiDat.tenAi().split(' - ')[0].trim() || 'Mai';
    const moi = `Mình là ${tenAi} (trợ lý tự động) của ${caiDat.tenShop()}. ${cau}`.trim();
    return { quyet_dinh: 'sua', thamSo: { ...ctx.thamSo, noi_dung: moi }, ly_do: 'Tin đầu tiên chưa tự giới thiệu là trợ lý tự động: đã thêm.' };
  },
  chayTheMoza(ctx) {
    const ts = ctx.thamSo || {};
    if (ts.dich === 'utility') return { quyet_dinh: 'cho_qua' };
    const h = hopThu.layHoiThoai(ts.hoi_thoai_id);
    const the = ts.the || {};
    const chu = [the.chu, the.tieu_de, the.phu_de].filter(Boolean).join(' ');
    // Cùng người đã nhận tin tự nhận trợ lý AI (thẻ giữ hàng nhắn riêng rồi mới nhắn Messenger — cùng một luồng chat) → thôi.
    const daGioiThieu = h.da_gioi_thieu_ai || hopThu.daGioiThieuNguoi(h.nguoi_fb_id);
    if ((daGioiThieu && ts.dich !== 'nhan_rieng') || daTuGioiThieu(chu)) return { quyet_dinh: 'cho_qua' };
    const cau = `Tin tự động từ trợ lý AI của ${caiDat.tenShop()}.`;
    const moi = { ...the };
    if (the.kieu === 'anh' && `${the.phu_de || ''} · ${cau}`.length <= 80) moi.phu_de = the.phu_de ? `${the.phu_de} · ${cau}` : cau;
    else if (['chu', 'nut'].includes(the.kieu)) moi.chu = `${the.chu}\n${cau}`;
    else return { quyet_dinh: 'chan', ma: 'THIEU_GIOI_THIEU', ly_do: 'Tin đầu tiên do MOZA soạn phải có câu tự nhận trợ lý AI.' };
    return { quyet_dinh: 'sua', thamSo: { ...ts, the: moi }, ly_do: 'Tin đầu tiên do MOZA soạn chưa tự nhận trợ lý AI: đã thêm.' };
  },
};
