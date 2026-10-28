'use strict';

/**
 * Luật cứng khi gửi ra Facebook từ Hộp thư (A.3 cửa `truoc_cong_cu`, bắt buộc; F-25, F-26, F-32; #34):
 *  - hội thoại đang do người giữ (AI tạm dừng) → AI không gửi;
 *  - Facebook thật chưa kết nối / mã Page hết hạn → không gửi;
 *  - Messenger: quá 24 giờ kể từ tin cuối của khách → `NGOAI_CUA_SO_24H`;
 *  - nhắn riêng: đúng 1 lần mỗi bình luận (`DA_NHAN_RIENG`), trong 7 ngày (`QUA_7_NGAY`);
 *  - trả lời công khai: cách nhau ≥ 20 giây trên cùng bài, ≤ 60 lần/giờ mỗi Page, không lặp y hệt trong 1 giờ;
 *  - hơn 5 tin AI cho một người trong 1 giờ → "Hỏi" (mục chờ duyệt, A.6).
 */

const hopThu = require('../../nghiep-vu/hop-thu');

const NGAY_MS = 24 * 3600 * 1000;

function ketNoiFb() {
  try {
    return require('../../dich-vu').dichVu().ketNoiFb;
  } catch {
    return null;
  }
}

module.exports = {
  id: 'hop_thu_gui',
  cua: 'truoc_cong_cu',
  ten: 'Luật gửi Hộp thư',
  moTa: 'Không gửi khi người đang giữ hội thoại, ngoài 24 giờ, nhắn riêng lần thứ hai hay quá 7 ngày, trả lời công khai quá dày; hơn 5 tin một giờ cho một người thì hỏi người duyệt.',
  batBuoc: true,
  chay(ctx) {
    let kenh = ctx.congCu.kenhGui;
    if (!kenh) return { quyet_dinh: 'cho_qua' };
    // gui_the_moza (F-65): tin do mã soạn — cùng luật, theo đích gửi (Messenger / nhắn riêng bình luận / mẫu Utility).
    const theMoza = kenh === 'the_moza';
    if (theMoza) kenh = { messenger: 'messenger', nhan_rieng: 'nhan_rieng', utility: 'utility' }[ctx.thamSo?.dich];
    const id = ctx.nguCanh?.hoiThoaiId || (theMoza ? ctx.thamSo?.hoi_thoai_id : null);
    if (!id) return { quyet_dinh: 'chan', ma: 'KHONG_CO_HOI_THOAI', ly_do: 'Không có hội thoại đang xử lý.' };
    const h = hopThu.layHoiThoai(id);
    const chan = (ma, lyDo) => ({ quyet_dinh: 'chan', ma, ly_do: lyDo });

    if (ctx.agentId && !ctx.daDuyet && (h.ai_tam_dung || h.trang_thai === 'can_nguoi')) {
      return chan('AI_TAM_DUNG', 'Người dùng đang giữ hội thoại này (hoặc đã chuyển Cần người): AI không gửi.');
    }
    // Tin máy soạn tới hội thoại người đang tự nhắn (AI tạm dừng): chỉ tin trả lời nút bấm và tin giao dịch; nhắc, báo hủy,
    // chăm sóc, mời chào thì không (người đang giữ hội thoại quyết).
    if (theMoza && !ctx.daDuyet && h.ai_tam_dung && ['nhac', 'bao_huy', 'cham_soc', 'moi_chao'].includes(ctx.thamSo?.muc_dich)) {
      return chan('AI_TAM_DUNG', 'Người đang giữ hội thoại này: MOZA không tự nhắc khách.');
    }
    if (theMoza && kenh === 'nhan_rieng') {
      const bl = ctx.thamSo?.binh_luan_fb_id;
      if (!bl) return chan('KHONG_CO_BINH_LUAN', 'Thiếu bình luận để nhắn riêng.');
      const l = require('../../nghiep-vu/luot-nhan-rieng').lay(bl);
      if (!l || l.trang_thai === 'da_gui') return chan('DA_NHAN_RIENG', 'Bình luận này đã dùng lượt nhắn riêng (hoặc chưa giữ lượt).');
      const t = hopThu.tinCuaHoiThoai(h.id).find((x) => x.gui_boi === 'khach' && x.fb_comment_id === bl);
      if (t && Date.now() - new Date(t.luc).getTime() > 7 * NGAY_MS) return chan('QUA_7_NGAY', 'Bình luận đã quá 7 ngày: không nhắn riêng được.');
    }
    if (!kenh) return chan('THAM_SO_SAI', 'Đích gửi không hợp lệ.');
    if (!h.dien_tap) {
      const k = ketNoiFb();
      if (!k || !k.guiDuoc(h.page_id)) return chan('FB_CHUA_KET_NOI', 'Facebook thật của Page này chưa kết nối hoặc mã đã hết hạn: dừng gửi.');
    }
    // Hội thoại bình luận thì công cụ tự báo SAI_KENH (rõ hơn "quá 24 giờ").
    if (kenh === 'messenger' && h.kenh === 'messenger') {
      const cuoi = h.tin_khach_cuoi_luc ? new Date(h.tin_khach_cuoi_luc).getTime() : 0;
      if (!cuoi || Date.now() - cuoi > NGAY_MS) {
        return chan('NGOAI_CUA_SO_24H', 'Đã quá 24 giờ kể từ tin cuối của người này: Facebook không cho nhắn. Chuyển việc gọi điện nếu cần.');
      }
    }
    if (!theMoza && (kenh === 'nhan_rieng' || kenh === 'tra_loi')) {
      const bl = hopThu.tinCuaHoiThoai(h.id).filter((t) => t.gui_boi === 'khach' && t.fb_comment_id).at(-1);
      if (!bl) return chan('KHONG_CO_BINH_LUAN', 'Hội thoại không có bình luận để trả lời.');
      if (kenh === 'nhan_rieng') {
        if (hopThu.daNhanRieng(bl.fb_comment_id)) return chan('DA_NHAN_RIENG', 'Bình luận này đã được nhắn riêng một lần.');
        // F-65: đường khác (thẻ giữ hàng, thẻ "ib"…) đã giữ lượt nhắn riêng của bình luận này → Tư vấn viên không nhắn riêng.
        const l = require('../../nghiep-vu/luot-nhan-rieng').lay(bl.fb_comment_id);
        if (l && l.boi !== 'tu_van' && l.trang_thai !== 'loi') return chan('DA_NHAN_RIENG', 'MOZA đã nhắn riêng bình luận này (thẻ tự động). Chờ khách trả lời trong Messenger.');
        if (Date.now() - new Date(bl.luc).getTime() > 7 * NGAY_MS) return chan('QUA_7_NGAY', 'Bình luận đã quá 7 ngày: không nhắn riêng được.');
      } else {
        const ganDay = hopThu.traLoiCongKhaiGanDay(h.page_id, 60);
        const cungBai = ganDay.filter((t) => t.fb_post_id && t.fb_post_id === h.fb_post_id)
          .some((t) => Date.now() - new Date(t.luc).getTime() < 20000);
        if (cungBai) return { quyet_dinh: 'giu', ma: 'TAN_SUAT', ly_do: 'Vừa trả lời công khai trên bài này chưa đủ 20 giây: giữ lại.' };
        if (ganDay.length >= 60) return chan('TAN_SUAT', 'Page đã trả lời công khai 60 lần trong 1 giờ: tạm dừng để không bị Facebook hạn chế.');
        const noiDung = String(ctx.thamSo?.noi_dung || '').trim();
        if (ganDay.some((t) => t.noi_dung.trim() === noiDung)) return chan('TAN_SUAT', 'Câu này vừa được dùng y hệt trong 1 giờ qua: viết khác đi.');
      }
    }
    if (ctx.agentId && !ctx.daDuyet && hopThu.demTinAiGanDay(h.id, 60) >= 5) {
      return { quyet_dinh: 'chan', ma: 'CAN_DUYET', taoChoDuyet: true, hetHanGio: 24, ly_do: 'Đã gửi 5 tin cho người này trong 1 giờ: tin tiếp theo cần người duyệt.' };
    }
    return { quyet_dinh: 'cho_qua' };
  },
};
