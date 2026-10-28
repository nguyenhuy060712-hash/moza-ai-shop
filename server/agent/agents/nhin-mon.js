'use strict';

/**
 * Agent `nhin_mon` (SPEC.md F-107): gpt-6-luna, suy nghĩ tắt, không dự phòng, không nâng model. Ảnh 1 = bảng mẫu (đặt TRƯỚC khung
 * hình để phần đầu yêu cầu giống nhau mọi lần — được tính giá lưu đệm), ảnh 2 = khung camera; cả hai `detail: 'low'`.
 * Phiếu {co_mon, so, chac}. Ảnh không ghi vào nhật ký (runtime chỉ lưu phiếu).
 *
 * BH11 (F-113, docs/11 mục 6.5): mặc định hỏi bằng **Decisions** (`agent/quyet-dinh.js`) — bảng mẫu (ảnh + `input_json` tên, màu) rồi
 * khung camera; một câu `choice` tên `mon`: ≤ 10 món của buổi (`so_12`, mô tả = tên + màu) + `khong_ro`. "Chắc" = confidence ≥ 0,8
 * và không phải `khong_ro`. Kết quả đổi về cùng phiếu {co_mon, so, chac} nên luật 2 lần liền, chỉ gợi ý (nhin-mon.js xet) giữ nguyên.
 * Cách cũ (Responses + lược đồ) giữ sau cấu hình `nhin_mon.cach = "responses"` để so sánh trong phép thử.
 */

const { chayAgent } = require('../runtime');

const NGUONG_CHAC = 0.8;

const PHIEU = {
  type: 'object',
  properties: {
    co_mon: { type: 'boolean', description: 'Có thấy một món trong bảng mẫu đang được cầm / mặc giới thiệu' },
    so: { type: 'integer', description: 'Số của món khớp nhất; không chắc thì 0' },
    chac: { type: 'string', enum: ['cao', 'vua', 'thap'] },
  },
  required: ['co_mon', 'so', 'chac'],
  additionalProperties: false,
};

/** Món trong bảng mẫu: {so, ten, mau[]}. */
function monBang(soBang) {
  const sp = require('../../nghiep-vu/san-pham');
  return soBang.slice(0, 10).map((so) => {
    const s = sp.layTheoSo(so);
    return s ? { so, ten: s.ten, mau: [...new Set(sp.phanLoaiCua(s.id).map((p) => p.gt1))] } : null;
  }).filter(Boolean);
}

/** Kết quả Decisions → phiếu cũ {co_mon, so, chac}. */
function phieuTuQuyetDinh(tl) {
  const m = tl?.mon;
  const so = /^so_(\d+)$/.exec(String(m?.chon ?? ''))?.[1];
  if (!m || m.tuChoi || !so) return { co_mon: false, so: 0, chac: 'thap' };
  return { co_mon: true, so: Number(so), chac: m.tinCay >= NGUONG_CHAC ? 'cao' : m.tinCay >= 0.5 ? 'vua' : 'thap' };
}

async function nhinMonQuyetDinh({ bangMau, khung, soBang, phien, nhaCungCap, detail }) {
  const mon = monBang(soBang);
  const kq = await require('../quyet-dinh').quyetDinh({
    agentId: 'nhin_mon',
    kichHoat: 'MOZA nhìn (Decisions): hình camera vừa đổi',
    heThong: 'Bạn nhìn khung hình camera của một buổi livestream bán quần áo và chọn món người dẫn đang cầm hoặc mặc để giới thiệu.',
    noiDung: [
      { chu: 'Ảnh 1: bảng mẫu các món của buổi live (số to trên mỗi ô). Dữ liệu: số món, tên, màu.' },
      { anh: { mime: bangMau.mime, base64: bangMau.base64, detail } },
      { json: { mon } },
      { chu: 'Ảnh 2: khung hình camera lúc này.' },
      { anh: { mime: khung.mime, base64: khung.base64, detail } },
    ],
    cauHoi: [{
      ten: 'mon', loai: 'choice',
      chiDan: 'Người dẫn đang cầm / mặc món nào trong bảng mẫu? Không thấy rõ món nào, hoặc món không có trong bảng, thì chọn khong_ro.',
      luaChon: [...mon.map((x) => ({ gt: `so_${x.so}`, moTa: `Số ${x.so}: ${x.ten} — màu ${x.mau.join(', ')}` })), { gt: 'khong_ro', moTa: 'Không rõ / không có trong bảng' }],
    }],
    phienLiveId: phien.id,
    dienTap: !!phien.dien_tap,
    // Camera giả (bản xem thử) biết đáp án — chỉ Decisions giả đọc ô này.
    _dapAn: khung._so_gia != null ? { mon: `so_${khung._so_gia}` } : {},
    ...(nhaCungCap?.openai ? { nhaCungCap: nhaCungCap.openai } : {}),
  });
  return { phieu: kq.ok ? phieuTuQuyetDinh(kq.traLoi) : null, chiPhi: kq.chiPhi || 0, loi: kq.ok ? null : kq.loi, ms: kq.ms ?? null };
}

async function nhinMon({ bangMau, khung, soBang = [], phien, nhaCungCap = null, detail = 'low', cach = null }) {
  const c = cach || require('../../cau-hinh/mac-dinh.json').nhin_mon?.cach || 'decisions';
  if (c === 'decisions') return nhinMonQuyetDinh({ bangMau, khung, soBang, phien, nhaCungCap, detail });
  const dong = monBang(soBang).map((x) => `Số ${x.so}: ${x.ten} — màu: ${x.mau.join(', ')}`);
  const kq = await chayAgent({
    agentId: 'nhin_mon',
    kichHoat: 'MOZA nhìn: hình camera vừa đổi',
    tinDau: ['Ảnh 1: bảng mẫu các món của buổi live (số to trên mỗi ô). Ảnh 2: khung hình camera lúc này.', ...dong,
      'Người dẫn đang cầm / mặc món nào trong bảng? Trả phiếu JSON {co_mon, so, chac}. Không chắc thì so = 0, chac = thap.'].join('\n'),
    anh: [{ ...bangMau, detail }, { ...khung, detail }],
    luocDo: PHIEU,
    lienKet: { phienLiveId: phien.id, dienTap: !!phien.dien_tap },
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  return { phieu: kq.ok ? kq.ketQua : null, chiPhi: kq.chiPhi || 0, loi: kq.ok ? null : kq.loi };
}

module.exports = { nhinMon, PHIEU, phieuTuQuyetDinh, NGUONG_CHAC };
