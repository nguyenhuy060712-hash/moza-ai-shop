'use strict';

/**
 * Kịch bản buổi sau dựng từ số liệu buổi trước (SPEC.md F-117, BH12). Agent `soan_kich_ban` (gpt-6-luna, không công cụ) đọc BẢNG ĐOẠN do
 * máy đếm (tong-ket-phien.bangDoan) — chỉ số và "số, tên món", không tên người, không số điện thoại, không nguyên văn bình luận — cùng
 * danh sách món sẽ bán, đề xuất NHÁP: thứ tự món, số phút mỗi đoạn, một chỗ đổi lời mở. Kiểm bằng mã (luật như `tong_ket`): mọi con số
 * phải có trong số liệu đầu vào (số phút chỉ được chọn trong các số phút của buổi trước); mục có số lạ hoặc trái luật bị bỏ phần đó; món
 * AI quên được xếp cuối — không món nào mất. Nháp không tự lưu: người sửa rồi bấm "Lưu thành kịch bản".
 */

const { chayAgent } = require('../runtime');
const { LoiNghiepVu, boDau } = require('../../nghiep-vu/chung');
const tk = require('../../nghiep-vu/tong-ket-phien');
const sp = require('../../nghiep-vu/san-pham');
const { loiSo, CAM } = require('./tong-ket');

const LUOC_DO = {
  type: 'object',
  properties: {
    ten: { type: 'string', description: 'Tên ngắn cho kịch bản buổi sau' },
    thu_tu: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          so: { type: 'integer', description: 'Số sản phẩm' },
          so_phut: { type: 'integer', description: 'Số phút dành cho đoạn này, chọn trong các số phút của buổi trước' },
          ly_do: { type: 'string', description: 'Vì sao xếp ở đây, kèm đúng con số trong số liệu' },
        },
        required: ['so', 'so_phut', 'ly_do'],
        additionalProperties: false,
      },
      description: 'Thứ tự các món buổi sau, mỗi món một dòng',
    },
    loi_mo: {
      type: 'object',
      properties: { viec: { type: 'string', description: 'Chỗ nên đổi ở lời mở đầu, 1 câu' }, vi_sao: { type: 'string', description: 'Vì sao, kèm đúng con số trong số liệu' } },
      required: ['viec', 'vi_sao'],
      additionalProperties: false,
    },
  },
  required: ['ten', 'thu_tu', 'loi_mo'],
  additionalProperties: false,
};

// Luật của gợi ý sau live, trừ "sắp lại kịch bản" (đây chính là việc của BH12).
const CAM_BH12 = CAM.slice(0, 4);
const loiLuat = (chu) => { const s = boDau(chu); return CAM_BH12.some((re) => re.test(s)); };

/** Chữ hợp lệ (đạt luật + số có trong nguồn) hay không; trống thì coi là đạt. */
const chuTot = (chu, nguon) => !chu || (!loiSo(chu, nguon).length && !loiLuat(chu));

const tenGon = (s) => String(s || '').split(/[|\n]/)[0].replace(/\s+/g, ' ').trim().slice(0, 60);

/**
 * Đề xuất nháp kịch bản buổi sau. @param {string} phienId buổi vừa xong  @param {object} [o]
 * @param {number[]} [o.monSeBan] số các món sẽ bán buổi sau (mặc định: các món buổi này đã bán, còn Đang bán)
 * @returns {Promise<{it_du_lieu?:boolean, so_phut?:number, ten?:string, thu_tu?:object[], loi_mo?:object|null, bo?:number, luc?:string, run_id?:string}>}
 */
async function deXuat(phienId, { monSeBan = null, nhaCungCap = null } = {}) {
  const bang = tk.bangDoan(phienId);
  if (!bang.du_so_lieu) return { it_du_lieu: true, so_phut: bang.so_phut, thu_tu: [], loi_mo: null, bo: 0 };
  const phien = tk.tongKetPhien(phienId).phien;
  const soDeXuat = Array.isArray(monSeBan) && monSeBan.length ? monSeBan : bang.doan.map((d) => d.so);
  const mon = [];
  for (const so of soDeXuat) {
    const s = sp.layTheoSo(so);
    if (s && s.trang_thai === 'dang_ban' && !mon.some((m) => m.so === s.so)) mon.push({ so: s.so, ten: s.ten, id: s.id });
  }
  if (!mon.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa có món nào Đang bán để xếp vào kịch bản buổi sau.');
  const nguon = [tk.soLieuDoanChoAi(bang), `Món sẽ bán buổi sau: ${mon.map((m) => `số ${m.so} ${m.ten}`).join('; ')}.`].join('\n');
  const kq = await chayAgent({
    agentId: 'soan_kich_ban', kichHoat: `Kịch bản buổi sau từ ${phien.ten}`, boQuaKhanCap: true, luocDo: LUOC_DO,
    tinDau: ['Số liệu từng đoạn của buổi live bán hàng vừa xong (máy đếm):', nguon, '',
      'Đề xuất NHÁP kịch bản buổi sau: (1) thứ tự các món sẽ bán — món RA ĐƠN xếp sớm hơn, món NGƯỜI XEM BỎ ĐI xếp ngắn hơn hoặc xen giữa món hút hơn; (2) số phút cho mỗi món, chỉ chọn trong các số phút đã cho; (3) một chỗ nên đổi ở lời mở đầu.',
      'Mỗi "vì sao" kèm đúng con số trong số liệu; không bịa con số nào khác. Mỗi món sẽ bán xuất hiện đúng một lần. Không khan hiếm giả, giảm giá giả; không đối xử khác theo vùng miền, giới tính. Ít số liệu thì nói chưa đủ để kết luận.'].join('\n'),
    lienKet: { phienLiveId: phien.dien_tap ? null : phienId, dienTap: phien.dien_tap },
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  if (!kq.ok) throw new LoiNghiepVu(kq.loi?.ma || 'AI_LOI', kq.loi?.thong_diep || 'AI chưa đề xuất được kịch bản.', 502);
  const p = kq.ketQua;
  const phutHopLe = new Set(bang.doan.map((d) => d.so_phut));
  const tenTheoSo = new Map(mon.map((m) => [m.so, m.ten]));
  const idTheoSo = new Map(mon.map((m) => [m.so, m.id]));
  let bo = 0;
  const thuTu = [];
  for (const x of p.thu_tu || []) {
    const so = Number(x.so);
    if (!tenTheoSo.has(so) || thuTu.some((t) => t.so === so)) { bo += 1; continue; } // món lạ hoặc lặp
    const soPhut = Number.isInteger(x.so_phut) && phutHopLe.has(x.so_phut) ? x.so_phut : null;
    if (soPhut == null) bo += 1;
    let lyDo = String(x.ly_do || '').trim();
    if (!chuTot(lyDo, nguon)) { lyDo = ''; bo += 1; }
    thuTu.push({ so, san_pham_id: idTheoSo.get(so), ten: tenTheoSo.get(so), so_phut: soPhut, ly_do: lyDo });
  }
  for (const m of mon) if (!thuTu.some((t) => t.so === m.so)) thuTu.push({ so: m.so, san_pham_id: m.id, ten: m.ten, so_phut: null, ly_do: '' });
  let loiMo = p.loi_mo && String(p.loi_mo.viec || '').trim() ? { viec: String(p.loi_mo.viec).trim(), vi_sao: String(p.loi_mo.vi_sao || '').trim() } : null;
  if (loiMo && !(chuTot(loiMo.viec, nguon) && chuTot(loiMo.vi_sao, nguon))) { loiMo = null; bo += 1; }
  return { luc: new Date().toISOString(), ten: tenGon(p.ten) || 'Buổi sau', so_phut: bang.so_phut, thu_tu: thuTu, loi_mo: loiMo, bo, run_id: kq.runId };
}

module.exports = { deXuat, LUOC_DO };
