'use strict';

/**
 * Phần chung của các bộ nối nhà cung cấp AI (F-07).
 *
 * Lịch sử một lần chạy được giữ ở dạng trung lập để đổi nhà giữa chừng (nhà chính lỗi → nhà dự phòng,
 * hoặc nâng lên Claude) mà không mất các bước đã làm:
 *   { vai: 'nguoi', chu }
 *   { vai: 'ai', nha, goc, goiCongCu: [{ id, ten, thamSo }], chu }   goc = nội dung gốc của nhà đó
 *   { vai: 'cong_cu', nha, ketQua: [{ id, ten, noiDung, loi }] }        noiDung = JSON dạng chữ
 * Lượt của chính nhà đó được gửi lại nguyên gốc (giữ chữ ký suy nghĩ Gemini, khối suy nghĩ Claude,
 * mục suy luận mã hóa OpenAI). Lượt của nhà khác được kể lại bằng chữ.
 */

const { anKhoa } = require('../../khoa');

class LoiAi extends Error {
  /** @param {{nha:string, ma?:string, http?:number}} o  ma = 'AI_LOI' | 'QUA_THOI_GIAN' | 'CHUA_CO_KHOA' */
  constructor(thongDiep, { nha, ma = 'AI_LOI', http = null } = {}) {
    super(anKhoa(thongDiep));
    this.nha = nha;
    this.ma = ma;
    this.http = http;
  }
}

/** Kể lại bằng chữ một lượt của nhà khác. */
function keLai(m) {
  if (m.vai === 'ai') {
    const goi = (m.goiCongCu || []).map((g) => `${g.ten}(${JSON.stringify(g.thamSo)})`).join('; ');
    return [m.chu, goi && `[Đã gọi công cụ: ${goi}]`].filter(Boolean).join('\n') || '(không có nội dung)';
  }
  if (m.vai === 'cong_cu') return `[Kết quả công cụ]\n${m.ketQua.map((k) => `- ${k.ten}: ${k.noiDung}`).join('\n')}`;
  return m.chu;
}

/** Đọc phiếu JSON từ chữ model trả về. Model đôi khi bọc trong ```json … ```. */
function docPhieu(chu) {
  const s = String(chu ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Gói lỗi của thư viện nhà cung cấp thành LoiAi: quá thời gian, sai khóa, bị giới hạn, lỗi máy chủ. */
function bocLoi(e, nha) {
  if (e instanceof LoiAi) return e;
  const tenNha = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude' }[nha] || nha;
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError' || /abort/i.test(e?.message || '')) {
    return new LoiAi(`${tenNha} trả lời quá thời gian cho phép.`, { nha, ma: 'QUA_THOI_GIAN' });
  }
  const http = e?.status ?? e?.code ?? null;
  const vi = http === 401 || http === 403 ? 'từ chối khóa'
    : http === 429 ? 'đang giới hạn lượt gọi'
      : http === 404 ? 'không có model này'
        : http >= 500 ? 'đang lỗi phía máy chủ' : 'báo lỗi';
  return new LoiAi(`${tenNha} ${vi}${http ? ` (${http})` : ''}: ${String(e?.message || e).slice(0, 300)}`, { nha, http: Number(http) || null });
}

module.exports = { LoiAi, keLai, docPhieu, bocLoi };
