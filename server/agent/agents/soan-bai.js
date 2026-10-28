'use strict';

/**
 * Bộ bài báo trước buổi live (SPEC.md F-96, #117): agent `soan_bai` (gpt-6-luna) viết mô tả Sự kiện live, bài nhá hàng (mời
 * "bình luận món muốn xem kèm size") và 3 câu Reels. MOZA KHÔNG đăng — người chép (6.5 cách A).
 *  - Ngày giờ, số món, cú pháp chốt: AI để chỗ trống {lich} {so_mon} {cu_phap}, MOZA tự điền.
 *  - Nguồn chỉ là dòng ĐÃ XÁC NHẬN của thẻ sản phẩm (ô "AI đoán" không đưa); không số còn.
 *  - Từng phần qua kiểm: từ cấm K11, con số phải có trong nguồn, cấm "chỉ hôm nay", "giảm", "sale", "freeship" (khi Cài đặt không
 *    có miễn ship), số lượng còn, kể đã mặc thử, dùng chữ của ô "AI đoán". Sai → làm lại 1 lần; vẫn sai → bỏ phần đó, ghi "Kiểm lại".
 */

const { chayAgent } = require('../runtime');
const sp = require('../../nghiep-vu/san-pham');
const caiDat = require('../../nghiep-vu/cai-dat');
const { boDau, LoiNghiepVu } = require('../../nghiep-vu/chung');

const TOI_DA_MON = 8;
const LUOC_DO = {
  type: 'object',
  properties: {
    su_kien: {
      type: 'object',
      properties: { tieu_de: { type: 'string', description: 'Tên Sự kiện live, ≤ 60 ký tự' }, mo_ta: { type: 'string', description: 'Mô tả sự kiện 2–4 câu, có {lich}' } },
      required: ['tieu_de', 'mo_ta'],
      additionalProperties: false,
    },
    bai_nha_hang: { type: 'string', description: 'Bài nhá hàng 3–6 câu, có {lich}, {so_mon}, cú pháp {cu_phap} và câu mời bình luận món muốn xem kèm size' },
    reels: { type: 'array', items: { type: 'string', description: 'Một câu chữ trên Reels, ≤ 150 ký tự' }, description: 'Đúng 3 câu' },
  },
  required: ['su_kien', 'bai_nha_hang', 'reels'],
  additionalProperties: false,
};

const CAM = [
  [/chi hom nay|duy nhat hom nay|lan cuoi|gio vang/, 'không hối thúc ("chỉ hôm nay", "lần cuối", "giờ vàng")'],
  [/(?<![a-z])(giam|sale|flash sale|xa kho|dong gia|khuyen mai|uu dai|tang kem|qua tang)(?![a-z])/, 'không hứa giảm giá, khuyến mại, quà (shop chưa cài)'],
  [/(?<![a-z])(chi |con dung |con lai )?con\s+\d+\s*(chiec|cai|bo|mau|san pham|size)?(?![\d.,])/, 'không ghi số lượng còn (đổi liên tục)'],
  [/(em|minh|toi|chi|anh|tui)\s+(da |tung |vua )?(mac thu|mac roi|mac di|mac len thay|thu roi)/, 'không kể đã mặc thử như người thật'],
];

/** Món của buổi: các món trong kịch bản (mới nhất nếu không chọn), không có thì tối đa 8 món Đang bán mới nhất. */
function monCuaBuoi(kichBanId = null) {
  const kichBan = require('../../nghiep-vu/kich-ban');
  let kb = null;
  try { kb = kichBanId ? kichBan.layKichBan(kichBanId) : kichBan.danhSachKichBan()[0] || null; } catch { kb = null; }
  let ids = kb ? [...new Set(kb.doan.map((d) => d.san_pham_id).filter(Boolean))] : [];
  if (!ids.length) ids = sp.danhSach().filter((x) => x.trang_thai === 'dang_ban').sort((a, b) => String(b.sua_luc).localeCompare(String(a.sua_luc))).map((x) => x.id);
  return ids.map((id) => { try { return sp.laySanPham(id); } catch { return null; } }).filter((s) => s && s.trang_thai === 'dang_ban').slice(0, TOI_DA_MON);
}

/** Dòng đã xác nhận (nguồn được dùng) và chữ của ô "AI đoán" (cấm dùng) của một món. */
function nguonMon(s) {
  const dong = sp.dongThe(s, { tonKho: false });
  const xacNhan = dong.filter((d) => d.xacNhan).map((d) => d.chu).join('\n');
  // Chỉ ô AI đoán thật (dòng có "(chưa xác nhận)"); "Linen (lanh)" → "Linen", "lanh".
  const doan = dong.filter((d) => !d.xacNhan && d.chu.includes('(chưa xác nhận)'))
    .map((d) => d.chu.replace(/^- /, '').replace(/\s*\(chưa xác nhận\)\s*$/, '').split(':').slice(1).join(':').trim())
    .flatMap((v) => v.split(/[,;()]/)).map((v) => v.trim()).filter((v) => v.length >= 3);
  return { xacNhan, doan };
}

/** Lỗi của một phần bài (chữ đã điền chỗ trống). */
function loiPhan(chu, ten, { nguon, doan }) {
  const loi = [];
  const s = boDau(chu);
  for (const [re, ly] of CAM) if (re.test(s)) loi.push(`${ten}: ${ly}.`);
  if (/freeship|free ship|mien phi (van chuyen|ship)|mien ship/.test(s) && caiDat.banHang().mien_phi_tu == null) loi.push(`${ten}: shop chưa có miễn ship — không ghi "freeship".`);
  for (const x of require('../../nghiep-vu/tu-cam').timTuCam(chu, { nguon: [nguon], congKhai: true })) loi.push(`${ten}: ${require('../../nghiep-vu/tu-cam').thongDiep(x)}`);
  const { soKhongCoTrongNguon } = require('../kiem-tra/quy-doi-so');
  const thua = soKhongCoTrongNguon(chu, [nguon]);
  if (thua.length) loi.push(`${ten}: con số ${[...new Set(thua.map((x) => x.chu))].join(', ')} không có trong thẻ sản phẩm / Cài đặt.`);
  const nguonKd = boDau(nguon);
  for (const v of doan) {
    const k = boDau(v);
    if (k && s.includes(k) && !nguonKd.includes(k)) loi.push(`${ten}: "${v}" là ô AI đoán chưa xác nhận — không dùng.`);
  }
  return [...new Set(loi)];
}

/**
 * @param {object} [o]
 * @param {string|null} [o.kichBanId]
 * @param {object} [o.nhaCungCap]  test
 * @returns {Promise<{su_kien:object|null, bai_nha_hang:string|null, reels:string[], kiem_lai:string[], mon:object[], lich:string|null, run_id:string}>}
 */
async function soanBai({ kichBanId = null, nhaCungCap = null } = {}) {
  const mon = monCuaBuoi(kichBanId);
  if (!mon.length) throw new LoiNghiepVu('CHUA_CO_MON', 'Chưa có sản phẩm Đang bán để soạn bài.', 409);
  const lichLive = require('../../nghiep-vu/lich-live');
  const ke = lichLive.buoiKe();
  const shop = caiDat.tenShop();
  const ds = mon.map((s) => ({ s, ...nguonMon(s) }));
  const { dongCaiDat } = require('../kiem-tra/kiem-tra');
  const nguon = [...ds.map((x) => x.xacNhan), ...dongCaiDat(), ke ? ke.chu : '', `${mon.length} món`].join('\n');
  const doan = ds.flatMap((x) => x.doan);
  const cuPhap = sp.cuPhapChot(mon[0]);
  const dien = (t) => String(t || '').replaceAll('{lich}', ke ? ke.chu : 'buổi live tới').replaceAll('{so_mon}', String(mon.length)).replaceAll('{cu_phap}', cuPhap).replaceAll('{ten_shop}', shop).trim();
  const tinDau = (loiTruoc = []) => [
    `Shop: ${shop}. Soạn bộ bài báo trước buổi live bán hàng trên Facebook: tên + mô tả Sự kiện live, bài nhá hàng, 3 câu chữ Reels.`,
    'Chỗ trống MOZA tự điền — viết đúng nguyên dạng: {lich} (ngày giờ buổi live), {so_mon} (số món), {cu_phap} (cú pháp chốt, ví dụ "chốt 12 + màu + size").',
    'Chỉ dùng thông tin trong các thẻ dưới đây. Giá đúng dòng "Giá:". Không ghi số lượng còn, không hứa giảm giá / quà / freeship, không "chỉ hôm nay", không kể đã mặc thử. Gọi món bằng số + tên. Bài nhá hàng có câu mời "bình luận món muốn xem kèm size". Viết tự nhiên như người bán thật, rất ít chữ "nhé".',
    ...(loiTruoc.length ? ['', `Bản trước bị trả lại vì: ${loiTruoc.join(' ')} Viết lại, sửa đúng các chỗ đó.`] : []),
    '',
    ...ds.map((x) => `### Thẻ ${sp.tenDayDu(x.s)}\n${x.xacNhan}`),
    '',
    'Trả đúng một phiếu JSON theo lược đồ.',
  ].join('\n');
  const chay = async (loiTruoc) => chayAgent({ agentId: 'soan_bai', kichHoat: `Soạn bài báo trước live (${mon.length} món)`, tinDau: tinDau(loiTruoc), luocDo: LUOC_DO,
    boQuaKhanCap: true, nguonDaDua: { san_pham: Object.fromEntries(mon.map((s) => [s.id, s.phien_ban])) }, ...(nhaCungCap ? { nhaCungCap } : {}) });
  const kiem = (p) => {
    const phan = {
      ten_su_kien: dien(p?.su_kien?.tieu_de).slice(0, 80),
      mo_ta_su_kien: dien(p?.su_kien?.mo_ta),
      bai_nha_hang: dien(p?.bai_nha_hang),
      ...Object.fromEntries((p?.reels || []).slice(0, 3).map((r, i) => [`reels_${i + 1}`, dien(r).slice(0, 150)])),
    };
    const loi = Object.fromEntries(Object.entries(phan).map(([k, v]) => [k, v ? loiPhan(v, k.replace(/_/g, ' '), { nguon, doan }) : [`${k}: trống.`]]));
    return { phan, loi };
  };
  let kq = await chay([]);
  if (!kq.ok) throw new LoiNghiepVu(kq.loi?.ma || 'AI_LOI', kq.loi?.thong_diep || 'AI chưa soạn được bài. Thử lại.', 502);
  let k = kiem(kq.ketQua);
  const loiLan1 = Object.values(k.loi).flat();
  if (loiLan1.length) {
    const kq2 = await chay(loiLan1);
    if (kq2.ok) { kq = kq2; k = kiem(kq2.ketQua); }
  }
  const giu = (ten) => (k.loi[ten]?.length ? null : k.phan[ten]);
  const kiemLai = Object.entries(k.loi).filter(([, l]) => l.length).map(([ten, l]) => `${ten.replace(/_/g, ' ')} đã bỏ — ${l[0]}`);
  const coAi = require('../../nghiep-vu/cau-mau-khach').cau('co_tro_ly_ai');
  return {
    su_kien: giu('ten_su_kien') && giu('mo_ta_su_kien') ? { tieu_de: giu('ten_su_kien'), mo_ta: `${giu('mo_ta_su_kien')}\n${coAi}` } : null,
    bai_nha_hang: giu('bai_nha_hang'),
    reels: ['reels_1', 'reels_2', 'reels_3'].map(giu).filter(Boolean),
    kiem_lai: kiemLai,
    mon: mon.map((s) => ({ so: s.so, ten: s.ten, anh: s.anh?.[0]?.tep ? `/api/anh/${s.id}/${s.anh[0].tep}` : null })),
    lich: ke ? ke.chu : null,
    run_id: kq.runId,
  };
}

module.exports = { soanBai, loiPhan, nguonMon, monCuaBuoi, LUOC_DO };
