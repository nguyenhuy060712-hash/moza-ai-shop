'use strict';

/**
 * Hook — 8 cửa (F-09, A.3). Hook là luật cứng viết trong mã, chạy ở một cửa, có quyền chặn.
 * Hook trả về một trong: `cho_qua` · `chan` (kèm lý do) · `giu` (chờ) · `sua` (đổi tham số).
 * Hook bắt buộc không tắt được; hook bắt buộc mà lỗi thì coi như chặn (an toàn trước).
 * Mọi lần chặn / giữ / sửa đều ghi `nhat_ky_hook`.
 */

const nhatKy = require('../../nghiep-vu/nhat-ky');
const luatQuyen = require('../../nghiep-vu/luat-quyen');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');

const CUA = [
  { id: 'khi_tin_den', ten: 'Khi tin đến', khi: 'Có bình luận hoặc tin nhắn mới' },
  { id: 'khi_mo_viec', ten: 'Khi mở việc', khi: 'Agent bắt đầu một việc' },
  { id: 'truoc_cong_cu', ten: 'Trước công cụ', khi: 'Trước mọi lần AI gọi công cụ' },
  { id: 'truoc_phat', ten: 'Trước khi phát', khi: 'Miệng nói xong một câu (chữ chép lại)',
    ghi_chu: 'Kiểm lời Mai sau khi nói (chữ về sau tiếng) — sai chắc thì đính chính; so từng câu TRƯỚC khi phát (A.5) vẫn để dành.' },
  { id: 'sau_cong_cu', ten: 'Sau công cụ', khi: 'Công cụ chạy xong' },
  { id: 'khi_agent_xong', ten: 'Khi Agent xong', khi: 'Agent nộp phiếu kết quả' },
  { id: 'truoc_nen', ten: 'Trước khi nén', khi: 'Ngữ cảnh hội thoại vượt ngưỡng' },
  { id: 'khi_can_nguoi', ten: 'Khi cần người', khi: 'Hội thoại chuyển Cần người' },
];

// Thứ tự trong mảng là thứ tự chạy trong cùng một cửa.
const HOOK = [
  require('./dong-khung'),
  require('./an-gia-shop'), // F-74: trước ẩn số điện thoại — bình luận giả shop không sang Tư vấn viên
  require('./an-thong-tin-ca-nhan'),
  require('./phan-loai-tin'),
  require('./nap-muc-luc'),
  require('./khan-cap'),
  require('./luat-quyen'),
  require('./hop-thu-gui'),
  require('./gioi-han-lien-he'),
  require('./gioi-thieu'), // sửa câu trước khi Bộ kiểm tra đo độ dài
  require('./kiem-tra'),
  require('./ghi-nhat-ky'),
  require('./kiem-phieu'),
  require('./giu-khi-nen'),
  require('./bao-can-nguoi'),
  require('./kiem-loi-noi'), // F-105, cửa truoc_phat
];

function dangBat(h) {
  return h.batBuoc || luatQuyen.hookDangBat(h.id, h.macDinhBat ?? true);
}

/**
 * Chạy mọi hook đang bật của một cửa, theo thứ tự. Dừng ở hook đầu tiên chặn hoặc giữ.
 * @param {string} cua
 * @param {object} ctx  dữ liệu của cửa; `ctx.runId` để gắn nhật ký với lần chạy AI (có thể trống)
 */
async function chayCua(cua, ctx) {
  for (const h of HOOK) {
    if (h.cua !== cua || !dangBat(h)) continue;
    let kq;
    try {
      kq = (await h.chay(ctx)) || { quyet_dinh: 'cho_qua' };
    } catch (e) {
      kq = h.batBuoc
        ? { quyet_dinh: 'chan', ma: 'LOI_HOOK', ly_do: `Hook "${h.ten}" lỗi nên chặn cho an toàn: ${e.message}` }
        : { quyet_dinh: 'cho_qua', ghi: true, ly_do: `Hook "${h.ten}" lỗi, bỏ qua: ${e.message}` };
    }
    if (kq.quyet_dinh !== 'cho_qua' || kq.ghi) {
      nhatKy.ghiHook({ runId: ctx.runId ?? null, cua, hook: h.id, quyetDinh: kq.quyet_dinh, lyDo: kq.ly_do ?? null });
    }
    if (kq.quyet_dinh === 'chan' || kq.quyet_dinh === 'giu') return { ...kq, hook: h.id };
    if (kq.quyet_dinh === 'sua' && kq.thamSo) ctx.thamSo = kq.thamSo;
  }
  return { quyet_dinh: 'cho_qua' };
}

/** Cho màn hình Agent & Skill: 8 cửa, mỗi cửa các hook của nó. */
function danhSachHook() {
  return CUA.map((c) => ({
    ...c,
    hook: HOOK.filter((h) => h.cua === c.id).map((h) => ({ id: h.id, ten: h.ten, mo_ta: h.moTa, bat_buoc: !!h.batBuoc, bat: dangBat(h) })),
  }));
}

function datBat(id, bat) {
  const h = HOOK.find((x) => x.id === id);
  if (!h) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có hook này.', 404);
  if (h.batBuoc) throw new LoiNghiepVu('HOOK_BAT_BUOC', `"${h.ten}" là hook bắt buộc, không tắt được.`, 409);
  luatQuyen.datHookBat(id, bat);
  return danhSachHook();
}

module.exports = { CUA, chayCua, danhSachHook, datBat };
