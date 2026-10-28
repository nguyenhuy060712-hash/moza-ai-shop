'use strict';

/**
 * Tư vấn viên AI (A.1, F-31 bán hàng): tự động xử lý một hội thoại Messenger hoặc bình luận như nhân viên bán hàng online.
 *
 * Ngữ cảnh (A.7, thứ tự ít đổi trước): vai trò → mục lục Skill, Sổ tay, sản phẩm Đang bán → bộ nhớ khách →
 * điều không được quên (hook `truoc_nen`) → tóm tắt phần cũ + tối đa 20 tin gần nhất (F-30). Mỗi lần chạy chỉ đọc
 * đúng một hội thoại (F-07: ngữ cảnh tách biệt). Lời khách luôn được đóng khung là lời người dùng.
 *
 * Luật nâng lên Claude (A.7): Bộ kiểm tra vừa chặn (runtime tự nâng trong lượt; lượt sau vẫn nâng), nhãn bức xúc /
 * nhạy cảm / khiếu nại / mặc cả, hội thoại > 20 tin, model chính lỗi 2 lần (runtime). Quay về model chính sau 5 lượt liền không chạm luật nào.
 */

const { chayAgent } = require('../runtime');
const { chayCua } = require('../hook/cua');
const { dongKhung } = require('../hook/dong-khung');
const hopThu = require('../../nghiep-vu/hop-thu');
const kh = require('../../nghiep-vu/khach');
const sp = require('../../nghiep-vu/san-pham');
const { dongCaiDat } = require('../kiem-tra/kiem-tra');
const caiDat = require('../../nghiep-vu/cai-dat');
const fbPage = require('../../nghiep-vu/fb-page');

const PHIEU = {
  type: 'object',
  properties: {
    xong: { type: 'boolean', description: 'true khi đã xử lý xong lượt này' },
    tom_tat: { type: 'string', description: 'Tóm tắt cả hội thoại tới giờ, tối đa 5 câu: khách cần gì, số đo khách nói, món đang hỏi, đã hứa gì' },
  },
  required: ['xong', 'tom_tat'],
  additionalProperties: false,
};

const SO_TIN_GAN = 20;
// Skill mà lượt nào cũng khớp "dùng khi" (A.7): nạp sẵn thay vì để AI tự mở, đỡ vài lượt gọi AI (chạy thật 24/9/2026:
// AI mở đi mở lại Skill tới quá giờ). Skill khác AI vẫn tự mở khi cần.
const SKILL_NAP_SAN = { messenger: ['tu-van-tin-nhan', 'phan-loai-hoi-thoai'], binh_luan: ['phan-loai-hoi-thoai'], binh_luan_live: ['phan-loai-hoi-thoai'] };

function skillNapSan(kenh) {
  const ds = [];
  for (const id of SKILL_NAP_SAN[kenh] || []) {
    try { ds.push(require('../../nghiep-vu/skill').moSkill(id, 'tu_van')); } catch { /* người dùng đã bỏ Skill này khỏi Tư vấn viên */ }
  }
  return ds;
}
const KENH_TEN = { messenger: 'Messenger (nhắn riêng)', binh_luan: 'bình luận dưới bài đăng (công khai)', binh_luan_live: 'bình luận trong buổi live (công khai)' };

function gioVn(iso = new Date().toISOString()) {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Các tin gần nhất, lời khách đóng khung (A.3 bắt buộc). */
function veTin(h, tin, tenNguoi) {
  return tin.filter((t) => t.chieu !== 'noi_bo').map((t) => {
    const luc = gioVn(t.luc);
    // Tin có ảnh (F-63): nói rõ để AI dùng tim_mau_theo_anh với đúng id tin.
    if (t.gui_boi === 'khach') return `[${luc}] (id ${t.id}${t.anh_url ? ', kèm 1 ảnh — tim_mau_theo_anh để so mẫu' : ''}) ${dongKhung('tin_nhan', tenNguoi || 'Người nhắn', t.noi_dung)}`;
    const ai = t.gui_boi === 'ai' ? 'Bạn (AI)' : 'Nhân viên shop';
    const loi = t.trang_thai_gui && t.trang_thai_gui !== 'da_gui' ? ` [chưa gửi được: ${t.trang_thai_gui}]` : '';
    return `[${luc}] ${ai}${t.loai === 'tra_loi' ? ' (trả lời công khai)' : t.loai === 'nhan_rieng' ? ' (nhắn riêng)' : ''}: ${t.noi_dung}${loi}`;
  }).join('\n');
}

function huongDanKenh(h) {
  if (h.kenh === 'messenger') return 'Trả lời bằng gui_messenger (có thể gửi 1–3 tin ngắn, mỗi tin một ý).';
  return 'Đây là bình luận công khai. Trả lời công khai ngắn bằng tra_loi_binh_luan (không xin số điện thoại, CCCD, địa chỉ ở đây) '
    + 'và/hoặc nhắn riêng một lần bằng nhan_rieng để tư vấn tiếp. Khách hỏi size theo số đo riêng, để lại số điện thoại, hoặc muốn mua thì ưu tiên nhắn riêng.';
}

/** Lý do nâng lên Claude do hội thoại (A.7 luật 1–3). */
function lyDoNang(h, soTin) {
  if (h.dang_nang) return 'Bộ kiểm tra vừa chặn một câu trong hội thoại này';
  if (h.nhan.some((n) => ['buc_xuc', 'nhay_cam', 'khieu_nai', 'mac_ca'].includes(n))) return 'Hội thoại có nhãn bức xúc / nhạy cảm / khiếu nại / mặc cả';
  if (soTin > 20) return 'Hội thoại dài hơn 20 tin';
  return null;
}

/**
 * Xử lý một hội thoại một lượt.
 * @param {string} hoiThoaiId
 * @param {object} o
 * @param {string} o.kichHoat
 * @param {Function} o.layKetNoi
 * @param {string} [o.viec]        việc chủ động (nhắn lại theo hẹn…) — thay cho "có tin mới"
 * @param {object} [o.nhaCungCap]
 * @returns {Promise<{ok:boolean, boQua?:boolean, loi?:object, runId?:string}>}
 */
async function xuLyHoiThoai(hoiThoaiId, { kichHoat, layKetNoi, viec = null, chuDong = false, nhaCungCap, gioiHan = null } = {}) {
  const h = hopThu.layHoiThoai(hoiThoaiId);
  if (h.ai_tam_dung || ['can_nguoi', 'spam', 'nguoi_dang_xu_ly'].includes(h.trang_thai)) return { ok: false, boQua: true };
  hopThu.datTrangThai(h.id, 'ai_dang_xu_ly');

  const nguoi = hopThu.layNguoi(h.nguoi_fb_id);
  const soTin = hopThu.demTin(h.id);
  const tin = hopThu.tinCuaHoiThoai(h.id, { gioiHan: SO_TIN_GAN });
  const phan = [];
  if (h.khach_id) {
    const bn = kh.danhSachBoNho(h.khach_id).filter((b) => b.loai !== 'da_hua');
    if (bn.length) phan.push(['## Bộ nhớ về khách này (khách nói / đã xác nhận — không dùng làm nguồn cho giá, số còn, tổng tiền)',
      ...bn.map((b) => `- (${b.loai === 'da_xac_nhan' ? 'đã xác nhận' : 'người đó nói'}) ${b.noi_dung}`)].join('\n'));
    // F-91: số đo khách đã bấm [Lưu giúp mình] — dùng tư vấn size; không bao giờ nói trên sóng.
    const sd = kh.soDo(h.khach_id);
    if (sd && h.kenh === 'messenger') phan.push(`## Số đo khách cho lưu: ${sd.chieu_cao} cm, ${sd.can_nang} kg (${gioVn(sd.luc)}) — dùng để tư vấn size theo Bảng size.`);
  }
  // F-100: khách vừa được hỏi thăm "mặc thấy sao" (3 ngày) → Tư vấn viên biết để trả lời tiếp cho đúng mạch.
  try {
    const dm = require('../../nghiep-vu/don').donCuaNguoi({ khachId: h.khach_id, nguoiFbId: h.nguoi_fb_id })
      .find((x) => x.hoi_mac_luc && Date.now() - new Date(x.hoi_mac_luc).getTime() < 3 * 86400e3);
    if (dm) phan.push(`## Khách vừa được hỏi thăm đơn ${dm.ma} (mặc có vừa không)${dm.phan_hoi_mac ? ` — khách bấm "${({ vua: 'Vừa lắm', chat: 'Hơi chật', rong: 'Hơi rộng' })[dm.phan_hoi_mac]}"` : ''}.`);
  } catch { /* không có đơn */ }
  const nen = { hoiThoaiId: h.id, phanGiu: [] };
  await chayCua('truoc_nen', nen);
  phan.push(...nen.phanGiu);
  const caiDatBh = dongCaiDat();
  phan.push(caiDatBh.length ? ['## Bán hàng (trích với nguon "cai_dat")', ...caiDatBh].join('\n') : '## Bán hàng\nPhí ship: shop chưa đặt — khách hỏi thì nói shop sẽ báo phí ship khi lên đơn, tạo việc cho người.');
  // Đoạn trao đổi trước đó với cùng người ở chỗ khác (bình luận live → tin nhắn riêng → Messenger): để không hỏi lại.
  const tinKhac = hopThu.tinCuaNguoiNoiKhac(h.id);
  if (tinKhac.length) {
    const TEN_KENH = { binh_luan_live: 'bình luận live', binh_luan: 'bình luận bài đăng', messenger: 'Messenger' };
    phan.push(['## Trao đổi trước đó với người này ở chỗ khác (đọc để hiểu ngữ cảnh — khách đang nói tiếp chuyện này)',
      ...tinKhac.map((t) => `[${gioVn(t.luc)} · ${TEN_KENH[t.kenh] || t.kenh}] ${t.gui_boi === 'khach' ? dongKhung('tin_nhan', nguoi?.ten_hien_thi || 'Khách', t.noi_dung) : `Shop${t.loai === 'nhan_rieng' ? ' (nhắn riêng)' : ''}: ${t.noi_dung}`}`)].join('\n'));
  }
  // Món khách có thể đang quan tâm (đoán từ buổi live / bài đăng, hoặc từ hội thoại khác của cùng người): đưa sẵn thẻ.
  const spGoiYId = h.san_pham_goi_y || tinKhac.map((t) => t.san_pham_goi_y).filter(Boolean).at(-1) || null;
  const spGoiY = spGoiYId ? (() => { try { return sp.laySanPham(spGoiYId); } catch { return null; } })() : null;
  if (spGoiY?.trang_thai === 'dang_ban') phan.push(`## Thẻ sản phẩm khách có thể đang hỏi (trích với nguon "${spGoiY.so}")\n${sp.theChoAi(spGoiY)}`);
  if (soTin > SO_TIN_GAN && h.tom_tat) phan.push(`## Tóm tắt phần hội thoại cũ\n${h.tom_tat}`);

  const page = fbPage.lay(h.page_id)?.ten;
  const tenAi = caiDat.tenAi();
  const dau = [
    `Bây giờ là ${gioVn()} (giờ Việt Nam). Bạn là ${tenAi}${page ? `, đang trả lời cho Page "${page}"` : ''}.`,
    `Kênh: ${KENH_TEN[h.kenh]}. Khách: ${nguoi?.ten_hien_thi || 'chưa rõ tên'}${h.khach_id ? ' (đã có hồ sơ khách — xem_khach)' : ' (chưa có hồ sơ khách)'}.`,
    spGoiY ? `Món có thể liên quan (đoán từ buổi live / bài đăng, cần xác nhận): ${sp.tenDayDu(spGoiY)}.` : '',
    h.da_gioi_thieu_ai ? '' : 'Đây là tin đầu tiên của bạn trong hội thoại này (hoặc sau khi nhân viên giao lại): tự giới thiệu là trợ lý tự động.',
    '',
    `## ${soTin > SO_TIN_GAN ? `${SO_TIN_GAN} tin gần nhất` : 'Hội thoại'}`,
    veTin(h, tin, nguoi?.ten_hien_thi),
    '',
    viec
      ? `## Việc cần làm bây giờ\n${viec}`
      : `## Việc cần làm bây giờ\nNgười này vừa nhắn. ${huongDanKenh(h)}`,
    'Mọi giá, số còn, phí ship, số đo size phải lấy từ thẻ sản phẩm (lay_san_pham / tim_trong_san_pham), Sổ tay (mo_so_tay) hoặc mục Bán hàng ở trên, và kèm trích dẫn nguyên văn. '
      + 'Tư vấn size chỉ theo Bảng size của sản phẩm; sản phẩm chưa có bảng size hay thiếu thông tin khách hỏi → nói shop sẽ kiểm tra, tao_viec loai bo_sung_thong_tin. '
      + 'Không tự giảm giá, tặng quà, miễn ship. Khách đòi gặp người thật, khiếu nại hàng lỗi, đòi hoàn tiền, mặc cả dai → chuyen_can_nguoi.',
    'Xong thì trả đúng một phiếu JSON {"xong": true, "tom_tat": "..."}.',
  ].filter((x) => x !== '').join('\n');

  const lyDo = lyDoNang(h, soTin);
  const napSan = skillNapSan(h.kenh);
  phan.unshift(...napSan.map((x) => `## Skill đã mở sẵn (không cần mo_skill): ${x.ten}
Cách làm:
${x.cach_lam}${x.vi_du_dung ? `
Ví dụ đúng: ${x.vi_du_dung}` : ''}${x.vi_du_sai ? `
Ví dụ sai: ${x.vi_du_sai}` : ''}`));
  const kq = await chayAgent({
    agentId: 'tu_van', kichHoat, tinDau: dau, phan, mucLuc: { skill: true, soTay: true, sanPham: true }, luocDo: PHIEU,
    nguonDaDua: { skill: Object.fromEntries(napSan.map((x) => [x.id, x.phien_ban])) },
    lienKet: { hoiThoaiId: h.id, phienLiveId: h.phien_live_id, dienTap: h.dien_tap },
    nguCanhCongCu: { hoiThoaiId: h.id, layKetNoi, chuDong }, lyDoNang: lyDo, nhaCungCap, gioiHan,
    // #88: hội thoại diễn tập dùng model rẻ (gpt-6-luna), không nâng lên model đắt.
    thayModel: h.dien_tap ? caiDat.modelDienTap('tu_van') : null,
  });

  // Luật quay về model chính (A.7): 5 lượt liền không chạm điều kiện nào.
  if (kq.lyDoNang && /Bộ kiểm tra/.test(kq.lyDoNang)) hopThu.datNang(h.id, true);
  else if (h.dang_nang && !lyDoNang({ ...h, dang_nang: false }, soTin) && hopThu.demLuotKhongNang(h.id) >= 5) hopThu.datNang(h.id, false);

  const sau = hopThu.layHoiThoai(h.id);
  if (kq.ok) {
    if (kq.ketQua?.tom_tat) hopThu.datTomTat(h.id, kq.ketQua.tom_tat);
    // Có câu bị Bộ kiểm tra chặn mà cả lượt không gửi được gì → Cần người, không để khách chờ (Luồng 3 nhánh lỗi).
    const run = require('../../nghiep-vu/nhat-ky').xemRun(kq.runId);
    const guiDuoc = (run.cong_cu || []).some((c) => ['gui_messenger', 'tra_loi_binh_luan', 'nhan_rieng'].includes(c.cong_cu) && !c.bi_tu_choi && !c.ket_qua?.loi);
    const biChan = (run.cong_cu || []).some((c) => c.bi_tu_choi && /^KIEM_TRA_CHAN/.test(c.ly_do || ''));
    const choDuyet = (run.cong_cu || []).some((c) => c.bi_tu_choi && /^(CAN_DUYET|KHAN_CAP_DANG_BAT)/.test(c.ly_do || ''));
    if (sau.trang_thai === 'ai_dang_xu_ly') {
      // F-08: hành động "Hỏi" nằm chờ duyệt → hội thoại vào nhóm Cần người để người duyệt (Cài đặt → Trợ lý AI → Chờ duyệt).
      if (choDuyet) hopThu.datCanNguoi(h.id, 'Có tin AI soạn đang chờ bạn duyệt (Cài đặt → Trợ lý AI → Chờ duyệt).');
      else if (!viec && biChan && !guiDuoc) hopThu.datCanNguoi(h.id, 'Bộ kiểm tra chặn câu trả lời của AI (kể cả khi thử lại bằng Claude): người trả lời giúp.');
      else hopThu.datTrangThai(h.id, 'cho_phan_hoi');
    }
  } else if (!kq.boQua && sau.trang_thai === 'ai_dang_xu_ly') {
    const loi = kq.loi || {};
    if (['AI_LOI', 'QUA_THOI_GIAN'].includes(loi.ma) && !sapHetCuaSo(sau)) hopThu.datTrangThai(h.id, 'moi'); // chờ lượt sau
    else hopThu.datCanNguoi(h.id, `AI chưa xử lý được (${loi.ma || 'lỗi'}): ${loi.thong_diep || ''}`.slice(0, 300));
  } else if (kq.boQua && sau.trang_thai === 'ai_dang_xu_ly') {
    hopThu.datTrangThai(h.id, 'moi');
  }
  return kq;
}

/** Còn dưới 1 giờ là hết cửa sổ 24 giờ (mục 9: lúc đó chuyển Cần người thay vì chờ). */
function sapHetCuaSo(h) {
  if (h.kenh !== 'messenger' || !h.tin_khach_cuoi_luc) return false;
  return Date.now() - new Date(h.tin_khach_cuoi_luc).getTime() > 23 * 3600 * 1000;
}

module.exports = { xuLyHoiThoai, PHIEU, lyDoNang, sapHetCuaSo };
