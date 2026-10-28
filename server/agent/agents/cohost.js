'use strict';

/**
 * Co-host (F-18, A.1): nhận Kế hoạch nói từ Director (hoặc câu người dẫn hỏi Mai), soạn 1–3 câu kèm trích dẫn nguyên văn
 * từ **một** sản phẩm và Sổ tay shop. Ngữ cảnh chỉ chứa thẻ của đúng sản phẩm đó (bản sửa lúc bắt đầu phiên, còn bán được
 * lúc soạn) — Co-host không tự chọn sản phẩm, không tự mở Skill.
 * Phiếu `{cau, trich_dan}` rồi phòng live đưa qua công cụ `de_xuat_cau_song` (Bộ kiểm tra).
 */

const { chayAgent } = require('../runtime');
const sp = require('../../nghiep-vu/san-pham');
const live = require('../../nghiep-vu/live');
const soTay = require('../../nghiep-vu/so-tay');
const skill = require('../../nghiep-vu/skill');
const { tenAi, tenShop } = require('../../nghiep-vu/cai-dat');
const { dongCaiDat } = require('../kiem-tra/kiem-tra');
const { laySo, mienK3 } = require('../kiem-tra/quy-doi-so');

const LUOC_DO = {
  type: 'object',
  properties: {
    cau: { type: 'string' },
    trich_dan: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nguon: { type: 'string' }, doan: { type: 'string' } },
        required: ['nguon', 'doan'],
        additionalProperties: false,
      },
    },
  },
  required: ['cau', 'trich_dan'],
  additionalProperties: false,
};

// Câu có con số (không tính "áo số 12", không tính số nhỏ không đơn vị) thì phải có trích dẫn.
const kiemPhieu = (so) => (p) => {
  const loi = [];
  if (!p.cau.trim()) loi.push('cau đang trống');
  const coSo = laySo(p.cau.replace(new RegExp(`(?<![\\p{L}\\d])(?:số\\s*)?${so}(?!\\d)`, 'gu'), ' ')).some((s) => !mienK3(s));
  if (coSo && !p.trich_dan.length) loi.push('câu có con số thì phải có trich_dan chứa con số đó');
  return loi;
};

/** Sản phẩm được giao, đúng bản sửa lúc bắt đầu phiên. Không Đang bán thì null. */
function banSanPham(phien, so) {
  const s = sp.layTheoSo(so);
  if (!s || s.trang_thai !== 'dang_ban') return null;
  const pb = live.phienBanSanPhamTrongPhien(phien.id, s.id);
  return { goc: s, ban: (pb && pb !== s.phien_ban && sp.layBanSua(s.id, pb)) || s };
}

/**
 * @param {object} o  phien, cauHoi, so, skillIds, tenNguoi, phanHoiTruoc (lý do câu trước bị chặn), tinHieu, nhaCungCap, gioiHan
 */
async function chayCohost({ phien, cauHoi, so, skillIds = [], tenNguoi = [], phanHoiTruoc = null, tinHieu = null, nhaCungCap, gioiHan = null, chamTraLoi = false }) {
  const b = banSanPham(phien, so);
  if (!b) return { ok: false, loi: { ma: 'SP_KHONG_BAN_DUOC', thong_diep: `Sản phẩm số ${so} không Đang bán.` } };
  const { goc, ban } = b;
  const tenNgan = tenAi().split(' - ')[0].trim() || 'Mai';
  const shop = tenShop();

  // Phần ít đổi (A.7 cột Co-host): tính cách và giọng → Sổ tay → 1–2 Skill Director chọn. Kế hoạch nói luôn ở cuối.
  const mucSoTay = soTay.danhSachMuc().filter((m) => m.noi_dung.trim());
  const cacSkill = skillIds.slice(0, 2).map((id) => skill.moSkill(id, 'cohost'));
  const caiDatBh = dongCaiDat();
  const phan = [
    `## Tính cách và giọng\nTự xưng "${tenNgan}", gọi người xem là "cả nhà" hoặc "bạn". Thân thiện, nhanh nhẹn như nhân viên bán hàng livestream; câu ngắn, dễ đọc to.`,
    mucSoTay.length && [`## Sổ tay ${shop} (trích với nguon "so_tay")`, ...mucSoTay.map((m) => `### ${m.tieu_de}\n${m.noi_dung}`)].join('\n'),
    caiDatBh.length && ['## Cài đặt bán hàng (trích với nguon "cai_dat")', ...caiDatBh].join('\n'),
    ...cacSkill.map((s) => `## Skill: ${s.ten}\nCách làm:\n${s.cach_lam}${s.vi_du_dung ? `\nVí dụ đúng: ${s.vi_du_dung}` : ''}${s.vi_du_sai ? `\nVí dụ sai: ${s.vi_du_sai}` : ''}`),
  ].filter(Boolean);

  const tinDau = [
    '## Kế hoạch nói',
    `Câu hỏi của người xem: "${cauHoi}"`,
    `Sản phẩm được giao: ${sp.tenDayDu(goc)}`,
    `### Thẻ sản phẩm (trích với nguon "${goc.so}")`,
    sp.theChoAi({ ...ban, id: goc.id }),
    '',
    '## Việc của bạn',
    `Soạn ${chamTraLoi ? '1–2 câu thật ngắn (người dẫn vừa chạm bình luận này để đọc ngay)' : '1–3 câu ngắn'} để đọc trên sóng, trả lời đúng câu hỏi, chỉ dùng thông tin ở trên. Gọi sản phẩm là "${sp.tenGoi(goc)}". Không nhắc sản phẩm khác (trừ món trong mục "Phối cùng").`,
    'trich_dan: chép nguyên văn từng dòng đã dùng (bỏ dấu gạch đầu dòng cũng được). Câu có con số (giá, số còn, số đo) thì đoạn trích phải chứa đúng con số đó.',
    'Dòng ghi "(chưa xác nhận)" là AI đoán: không nói như sự thật. Số còn chỉ nói khi thẻ có; không nói "sắp hết", "cuối cùng" nếu số còn không ít thật.',
    'Nguồn không có thông tin thì nói shop sẽ kiểm tra lại và mời người xem nhắn tin cho Page; khi đó trich_dan để trống. Cuối câu có thể mời chốt đúng cú pháp: "chốt ' + goc.so + ' + màu + size".',
    phanHoiTruoc && `\nCâu trước của bạn bị Bộ kiểm tra chặn: ${phanHoiTruoc}\nSoạn lại cho đúng nguồn.`,
    'Trả đúng một phiếu JSON {cau, trich_dan}.',
  ].filter(Boolean).join('\n');

  return chayAgent({
    agentId: 'cohost',
    kichHoat: `Trả lời "${cauHoi}" (${sp.tenGoi(goc)})`,
    tinDau,
    phan,
    luocDo: LUOC_DO,
    kiemPhieuThem: kiemPhieu(goc.so),
    lienKet: { phienLiveId: phien.id, sanPhamId: goc.id, sanPhamPhienBan: ban.phien_ban, dienTap: phien.dien_tap },
    nguCanhCongCu: { soDuocGiao: goc.so, tenNguoi },
    anCongCu: ['de_xuat_cau_song'],
    nguonDaDua: {
      san_pham: { [goc.id]: ban.phien_ban },
      so_tay: Object.fromEntries(mucSoTay.map((m) => [m.id, m.phien_ban])),
      skill: Object.fromEntries(cacSkill.map((s) => [s.id, s.phien_ban])),
    },
    tinHieu,
    gioiHan,
    // F-115 (T8): chạm để trả lời gọi nhiều lần trong buổi với cùng lời dặn + thẻ món — giữ lưu đệm 12 giờ.
    ...(chamTraLoi ? { luuDem: '12h' } : {}),
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
}

module.exports = { chayCohost, LUOC_DO };
