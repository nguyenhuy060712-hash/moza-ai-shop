'use strict';

/**
 * AI giả "đáp án mẫu" cho bản xem thử chạy với cờ `--ai-gia` (SPEC.md #93, #94; docs/07 mục 8): Claude Code tự lái bản xem thử
 * mà không tốn đồng nào. Không gọi mạng. Trả phiếu hợp lệ theo lược đồ của Agent (giá trị mặc định: chữ trống, mảng rỗng,
 * lựa chọn đầu tiên), riêng Tư vấn viên trả lời khách một câu mẫu lịch sự rồi chuyển người thật.
 */

function macDinh(ld) {
  if (!ld || typeof ld !== 'object') return null;
  if (ld.enum) return ld.enum[0];
  const k = [].concat(ld.type || [])[0];
  if (k === 'object') {
    const o = {};
    for (const [ten, x] of Object.entries(ld.properties || {})) o[ten] = macDinh(x);
    return o;
  }
  if (k === 'array') return [];
  if (k === 'string') return '';
  if (k === 'integer' || k === 'number') return 0;
  if (k === 'boolean') return false;
  if (k === 'null') return null;
  return null;
}

const CAU_TU_VAN = 'Dạ shop nhận được tin rồi ạ. (Bản xem thử đang dùng AI giả — nhân viên shop sẽ trả lời mình.)';
const CAU_COHOST = 'Dạ mẫu này mặc thoải mái, cả nhà ưng thì bình luận chốt kèm màu và size nha (câu mẫu của AI giả).';

async function goi({ lichSu = [], congCu = [], luocDo = null }) {
  const ten = new Set(congCu.map((c) => c.ten));
  const daGoi = lichSu.some((x) => x.vai === 'ai' && x.goiCongCu?.length);
  // Tư vấn viên: lượt đầu gửi một câu mẫu rồi chuyển người thật (không đoán giá, không lên đơn).
  if (!daGoi && ten.has('gui_messenger') && ten.has('chuyen_can_nguoi')) {
    return { goiCongCu: [{ id: 'gia1', ten: 'gui_messenger', thamSo: { noi_dung: CAU_TU_VAN, trich_dan: [] } },
      { id: 'gia2', ten: 'chuyen_can_nguoi', thamSo: { ly_do: 'Bản xem thử dùng AI giả: người trả lời giúp.' } }], chu: '', goc: null, tokenVao: 0, tokenRa: 0 };
  }
  // F-107: MOZA nhìn với Camera giả — ảnh kèm đáp án `_so_gia` (chỉ Camera giả có): trả đúng món, chắc cao.
  const soGia = lichSu[0]?.anh?.find((a) => a._so_gia != null)?._so_gia;
  if (luocDo?.properties?.co_mon && soGia != null) return { goiCongCu: [], chu: JSON.stringify({ co_mon: true, so: soGia, chac: 'cao' }), goc: null, tokenVao: 0, tokenRa: 0 };
  // BH11 F-115: Co-host (phiếu {cau, trich_dan}) — một câu mẫu không có số để bản xem thử thấy chạm bình luận ra câu (qua Bộ kiểm tra).
  if (luocDo?.properties?.cau && luocDo.properties.trich_dan && Object.keys(luocDo.properties).length === 2) {
    return { goiCongCu: [], chu: JSON.stringify({ cau: CAU_COHOST, trich_dan: [] }), goc: null, tokenVao: 0, tokenRa: 0 };
  }
  // BH12 F-117: nháp kịch bản buổi sau — xếp các món theo thứ tự đưa vào, số phút đầu tiên trong danh sách cho phép; chữ không có số nào ngoài số liệu.
  if (luocDo?.properties?.thu_tu && luocDo.properties.loi_mo) {
    const chu = String(lichSu[0]?.chu || '');
    const mon = [...(chu.match(/Món sẽ bán buổi sau: (.*)\./)?.[1] || '').matchAll(/số (\d+) /g)].map((m) => Number(m[1]));
    const phut = Number((chu.match(/các số phút: (\d+)/) || [])[1]) || 0;
    const phieu = { ten: 'Buổi sau (AI giả)', thu_tu: mon.map((so) => ({ so, so_phut: phut, ly_do: 'Nháp mẫu của AI giả: giữ thứ tự cũ, bạn tự sửa.' })),
      loi_mo: { viec: 'Mở đầu bằng món bán chạy nhất rồi mới giới thiệu cả buổi.', vi_sao: 'Nháp mẫu của AI giả, chưa dựa trên con số nào.' } };
    return { goiCongCu: [], chu: JSON.stringify(phieu), goc: null, tokenVao: 0, tokenRa: 0 };
  }
  const phieu = macDinh(luocDo) ?? { xong: true };
  if (phieu && typeof phieu === 'object' && Object.hasOwn(phieu, 'xong')) phieu.xong = true;
  return { goiCongCu: [], chu: JSON.stringify(phieu), goc: null, tokenVao: 0, tokenRa: 0 };
}

/**
 * Decisions giả (BH11, docs/11 mục 3.3): trả lựa chọn đặt sẵn. Thứ tự: đáp án đặt bằng `datQuyetDinh` (test) → gợi ý `_dapAn` kèm
 * yêu cầu (Camera giả biết số món, miệng giả biết món Mai vừa nói — bộ thật bỏ qua ô này) → lựa chọn đầu tiên, tin cậy 0,5.
 */
let datSan = null;
function datQuyetDinh(x) { datSan = x; }

async function quyetDinh({ cauHoi = [], _dapAn = {} } = {}) {
  const san = typeof datSan === 'function' ? datSan({ cauHoi, _dapAn }) : datSan;
  const traLoi = {};
  for (const q of cauHoi) {
    const loai = q.loai || 'choice';
    const d = san?.[q.ten] ?? _dapAn[q.ten];
    if (d && typeof d === 'object') traLoi[q.ten] = { loai, ...d };
    else if (d !== undefined) traLoi[q.ten] = { loai, chon: d, tinCay: 0.95 };
    else if (loai === 'predicate') traLoi[q.ten] = { loai, chon: false, tinCay: 0.5, xacSuat: 0.5 };
    else traLoi[q.ten] = { loai, chon: q.luaChon?.[0]?.gt ?? null, tinCay: 0.5 };
  }
  return { traLoi, model: 'gpt-6-luna', tokenVao: 0, tokenRa: 0, tokenDem: 0 };
}

module.exports = { goi, macDinh, CAU_TU_VAN, CAU_COHOST, quyetDinh, datQuyetDinh };
