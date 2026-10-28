'use strict';

/**
 * Gợi ý sau live (SPEC.md F-102, P32): agent `tong_ket` (gpt-6-luna, không công cụ) đọc SỐ LIỆU GỘP do máy đếm — không tên,
 * không số điện thoại, không nguyên văn bình luận — viết tối đa 3 gợi ý {viec, vi_sao}. Kiểm bằng mã: mọi con số phải có trong
 * số liệu đầu vào; cấm gợi ý đối xử theo vùng miền, giới tính; cấm khan hiếm giả, giảm giá giả; không sắp lại kịch bản.
 * Chỉ khi buổi có từ 5 người chốt.
 */

const { chayAgent } = require('../runtime');
const { boDau, LoiNghiepVu } = require('../../nghiep-vu/chung');
const tk = require('../../nghiep-vu/tong-ket-phien');

const TOI_DA = 3;
const LUOC_DO = {
  type: 'object',
  properties: {
    goi_y: {
      type: 'array',
      items: { type: 'object', properties: { viec: { type: 'string', description: 'Việc nên làm buổi sau, 1 câu' }, vi_sao: { type: 'string', description: 'Vì sao, kèm đúng con số trong số liệu' } }, required: ['viec', 'vi_sao'], additionalProperties: false },
      description: 'Tối đa 3 gợi ý',
    },
  },
  required: ['goi_y'],
  additionalProperties: false,
};

const CAM = [
  /mien (bac|nam|trung|tay)|nguoi (bac|nam|trung)|tinh (nay|kia)|vung (mien|que)/,
  /(nam|nu) gioi|dan ong|phu nu|dan ba|khach (nam|nu)(?![a-z])/,
  /sap het|chi con|khan hiem|het hang (gia|ao)|so luong co han|dem nguoc/,
  /giam gia|sale|flash|gia gach|khuyen mai|tang gia roi giam|dong gia/,
  /(sap|doi|dao) (lai )?kich ban|thu tu doan/,
];

/** Lỗi của một gợi ý (rỗng = giữ). */
function loiGoiY(g, nguon) {
  const chu = `${g.viec || ''} ${g.vi_sao || ''}`;
  const s = boDau(chu);
  const loi = [];
  if (!String(g.viec || '').trim()) loi.push('trống');
  for (const re of CAM) if (re.test(s)) loi.push(`vi phạm luật: ${re.source.slice(0, 30)}`);
  loi.push(...loiSo(chu, nguon));
  return loi;
}

/** Con số trong `chu` mà số liệu `nguon` không có (rỗng = đạt). Dùng chung với agent đề xuất kịch bản (BH12). */
function loiSo(chu, nguon) {
  const loi = [];
  const { soKhongCoTrongNguon } = require('../kiem-tra/quy-doi-so');
  const thua = soKhongCoTrongNguon(chu, [nguon]);
  if (thua.length) loi.push(`số không có trong số liệu: ${thua.map((x) => x.chu).join(', ')}`);
  // Chặt hơn K3: số nhỏ 0–10 cũng phải có trong số liệu (phễu shop nhỏ gần như toàn số nhỏ), "37%" tự tính cũng bị bỏ.
  const soNguon = new Set((nguon.match(/\d[\d.]*/g) || []).map((x) => x.replace(/\./g, '')));
  const la = (chu.match(/\d[\d.]*/g) || []).map((x) => x.replace(/\.$/, '').replace(/\./g, '')).filter((x) => !soNguon.has(x));
  if (la.length) loi.push(`số không có trong số liệu: ${la.join(', ')}`);
  return loi;
}

/**
 * Viết (lại) gợi ý cho một buổi. @returns {Promise<{it_du_lieu?:boolean, goi_y:object[], bo:number, luc?:string, run_id?:string}>}
 */
async function vietGoiY(phienId, { nhaCungCap = null } = {}) {
  const t = tk.tongKetPhien(phienId);
  if (!t.du_goi_y) return { it_du_lieu: true, goi_y: [], bo: 0 };
  const soLieu = tk.soLieuChoAi(t);
  const kq = await chayAgent({
    agentId: 'tong_ket', kichHoat: `Tổng kết buổi ${t.phien.ten}`, boQuaKhanCap: true, luocDo: LUOC_DO,
    tinDau: ['Số liệu buổi live bán hàng (máy đếm):', soLieu, '', 'Viết tối đa 3 gợi ý cho buổi sau. Mỗi gợi ý có "vì sao" kèm đúng con số trong số liệu. Không kết luận khi số quá ít. Không gợi ý đối xử khác theo vùng miền, giới tính; không tạo khan hiếm giả, giảm giá giả; không sắp lại kịch bản.'].join('\n'),
    lienKet: { phienLiveId: t.phien.dien_tap ? null : phienId, dienTap: t.phien.dien_tap },
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  if (!kq.ok) throw new LoiNghiepVu(kq.loi?.ma || 'AI_LOI', kq.loi?.thong_diep || 'AI chưa viết được gợi ý.', 502);
  const tatCa = kq.ketQua.goi_y || [];
  const giu = tatCa.filter((g) => !loiGoiY(g, soLieu).length).slice(0, TOI_DA).map((g) => ({ viec: String(g.viec).trim(), vi_sao: String(g.vi_sao || '').trim() }));
  const ra = { luc: new Date().toISOString(), goi_y: giu, bo: tatCa.length - giu.length, run_id: kq.runId };
  tk.luuGoiY(phienId, ra);
  return ra;
}

module.exports = { vietGoiY, loiGoiY, loiSo, CAM, LUOC_DO };
