'use strict';

/**
 * Tìm mẫu theo ảnh khách gửi (SPEC.md F-63, #78). Khách gửi ảnh "shop có mẫu này không?":
 *   1. MOZA lấy ảnh (địa chỉ ảnh Facebook trong webhook; diễn tập: tệp khu tạm);
 *   2. nhiều hơn 12 mẫu Đang bán → một lượt model đọc danh mục, màu của ảnh khách để lọc trước;
 *   3. model đọc ảnh so ảnh khách với ảnh đại diện của tối đa 12 mẫu, trả phiếu: có liên quan không, mẫu gần giống.
 * Chỉ nói "gần giống", không bao giờ "giống hệt". Ảnh không phải sản phẩm → hỏi lại khách cần tìm mẫu gì.
 * Model theo agent `tim_mau` (gemini-3.8-flash suy nghĩ thấp, dự phòng gpt-6-sol).
 */

const fs = require('node:fs');
const { chayAgent } = require('../runtime');
const sp = require('../../nghiep-vu/san-pham');
const kho = require('../../nghiep-vu/kho');
const { LoiNghiepVu, boDau } = require('../../nghiep-vu/chung');

const TOI_DA = 12;
// Chỉ tải ảnh từ máy chủ ảnh của Facebook — không đi theo địa chỉ lạ trong dữ liệu khách (mục 9).
const MAY_ANH = /(^|\.)(fbcdn\.net|fbsbx\.com|facebook\.com)$/i;

const mimeCua = (buf) => (buf[0] === 0x89 ? 'image/png' : buf[0] === 0x52 && buf[8] === 0x57 ? 'image/webp' : 'image/jpeg');
const thanhAnh = (buf) => ({ mime: mimeCua(buf), base64: buf.toString('base64') });

async function taiAnhKhach(url, { fetch: goi = fetch } = {}) {
  if (!url) throw new LoiNghiepVu('KHONG_CO_ANH', 'Tin này không có ảnh. Hỏi khách gửi ảnh mẫu cần tìm.');
  if (url.startsWith('tam:')) {
    const f = sp.duongAnh('tam', url.slice(4));
    if (!f) throw new LoiNghiepVu('KHONG_CO_ANH', 'Không còn ảnh khách gửi.');
    return fs.readFileSync(f);
  }
  let u;
  try { u = new URL(url); } catch { throw new LoiNghiepVu('KHONG_CO_ANH', 'Địa chỉ ảnh không hợp lệ.'); }
  if (u.protocol !== 'https:' || !MAY_ANH.test(u.hostname)) throw new LoiNghiepVu('KHONG_CO_ANH', 'Ảnh không đến từ Facebook: không tải.');
  const r = await goi(u, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new LoiNghiepVu('KHONG_CO_ANH', 'Không tải được ảnh khách gửi (có thể đã hết hạn). Hỏi khách gửi lại.');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new LoiNghiepVu('KHONG_CO_ANH', 'Ảnh quá lớn.');
  return buf;
}

/** Mẫu Đang bán có ảnh, kèm ảnh đại diện. */
function mauDangBan() {
  return sp.danhSach({ trang_thai: 'dang_ban' }).map((x) => sp.laySanPham(x.id)).filter((s) => s.anh?.length)
    .map((s) => ({ s, f: sp.duongAnh(s.id, s.anh[0].tep) })).filter((x) => x.f);
}

const LUOC_DO_LOC = {
  type: 'object',
  properties: {
    la_san_pham: { type: 'boolean', description: 'true nếu ảnh có một món thời trang / phụ kiện khách muốn tìm' },
    danh_muc: { type: 'string', description: 'Khóa danh mục gần nhất, "" nếu không phải sản phẩm' },
    mau: { type: 'string', description: 'Màu chính của món trong ảnh, tiếng Việt ngắn; "" nếu không rõ' },
  },
  required: ['la_san_pham', 'danh_muc', 'mau'],
  additionalProperties: false,
};

const LUOC_DO = {
  type: 'object',
  properties: {
    la_san_pham: { type: 'boolean', description: 'true nếu ảnh khách (ảnh ĐẦU TIÊN) có một món thời trang / phụ kiện' },
    mo_ta_anh_khach: { type: 'string', description: 'Tả ngắn món trong ảnh khách: loại, màu, kiểu' },
    giong: {
      type: 'array',
      description: 'Tối đa 3 mẫu của shop gần giống nhất, giống nhiều trước; không mẫu nào giống thì []',
      items: {
        type: 'object',
        properties: {
          so: { type: 'integer', description: 'Số sản phẩm ghi trên ảnh mẫu' },
          muc: { type: 'string', enum: ['gan_giong', 'hoi_giong'] },
          ly_do: { type: 'string', description: 'Giống ở điểm nào, khác ở điểm nào (ngắn)' },
        },
        required: ['so', 'muc', 'ly_do'],
        additionalProperties: false,
      },
    },
  },
  required: ['la_san_pham', 'mo_ta_anh_khach', 'giong'],
  additionalProperties: false,
};

/**
 * @param {object} tin  tin nhắn khách có `anh_url`
 * @param {object} [o]  dienTap, hoiThoaiId, nhaCungCap (test), fetch (test)
 */
async function timMauTheoAnh(tin, { dienTap = false, hoiThoaiId = null, nhaCungCap, fetch: goi } = {}) {
  // F-104: ảnh khách gửi để shop dùng (đang xin phép / đã đồng ý) không bao giờ đi tới AI.
  if (tin.id && require('../../nghiep-vu/anh-khach').laAnhKhach(tin.id)) throw new LoiNghiepVu('ANH_KHACH', 'Ảnh khách mặc thật không gửi cho AI. Hỏi khách cần tìm mẫu nào bằng lời.');
  const anhKhach = thanhAnh(await taiAnhKhach(tin.anh_url, { fetch: goi }));
  let ds = mauDangBan();
  if (!ds.length) return { tim_thay: false, ghi_chu: 'Shop chưa có mẫu Đang bán nào có ảnh để so. Báo khách shop sẽ kiểm tra và nhắn lại, tạo việc cho người.' };
  const chung = { lienKet: { hoiThoaiId, dienTap }, boQuaKhanCap: false, ...(nhaCungCap ? { nhaCungCap } : {}) };

  if (ds.length > TOI_DA) {
    const { danh_muc: dm } = sp.cauHinh();
    const loc = await chayAgent({
      agentId: 'tim_mau', kichHoat: 'Tìm mẫu theo ảnh — lọc trước',
      tinDau: `Ảnh khách gửi hỏi shop có mẫu này không. Món trong ảnh thuộc danh mục nào (${dm.map((d) => `${d.khoa}=${d.ten}`).join(', ')}), màu chính là gì? Trả phiếu JSON.`,
      anh: [anhKhach], luocDo: LUOC_DO_LOC, gioiHan: { so_buoc: 1 }, ...chung,
    });
    if (!loc.ok) return { tim_thay: false, loi: 'Chưa đọc được ảnh. Nói khách chờ chút, người của shop xem ảnh rồi trả lời.' };
    if (!loc.ketQua.la_san_pham) return { tim_thay: false, khong_phai_san_pham: true, ghi_chu: 'Ảnh không có món đồ nào. Hỏi lại khách đang cần tìm mẫu gì.' };
    const mau = boDau(loc.ketQua.mau || '');
    const diem = (x) => (x.s.danh_muc === loc.ketQua.danh_muc ? 2 : 0) + (mau && sp.phanLoaiCua(x.s.id).some((p) => !p.bo && boDau(p.gt1).includes(mau)) ? 1 : 0);
    ds = ds.map((x) => ({ ...x, d: diem(x) })).sort((a, b) => b.d - a.d).slice(0, TOI_DA);
  }

  const kq = await chayAgent({
    agentId: 'tim_mau', kichHoat: 'Tìm mẫu theo ảnh khách gửi',
    tinDau: [
      `Ảnh ĐẦU TIÊN là ảnh khách gửi, hỏi shop có mẫu này không. ${ds.length} ảnh sau là ảnh đại diện các mẫu shop đang bán, theo thứ tự:`,
      ...ds.map((x, i) => `- Ảnh ${i + 2}: số ${x.s.so} · ${x.s.ten}`),
      '',
      'So kiểu dáng, màu, họa tiết, chi tiết. "gan_giong" chỉ khi cùng loại và kiểu gần như nhau; khác màu nhưng cùng kiểu là "hoi_giong". Không mẫu nào cùng loại thì giong = []. Trả phiếu JSON.',
    ].join('\n'),
    anh: [anhKhach, ...ds.map((x) => thanhAnh(fs.readFileSync(x.f)))],
    luocDo: LUOC_DO, gioiHan: { so_buoc: 1 }, ...chung,
  });
  if (!kq.ok) return { tim_thay: false, loi: 'Chưa so được ảnh. Nói khách chờ chút, người của shop xem ảnh rồi trả lời.' };
  const p = kq.ketQua;
  if (!p.la_san_pham) return { tim_thay: false, khong_phai_san_pham: true, ghi_chu: 'Ảnh không có món đồ nào. Hỏi lại khách đang cần tìm mẫu gì.' };
  const theoSo = new Map(ds.map((x) => [x.s.so, x.s]));
  const giong = (p.giong || []).filter((g) => theoSo.has(g.so)).slice(0, 3).map((g) => {
    const s = theoSo.get(g.so);
    const con = kho.conHang(s.id).reduce((a, x) => a + Math.max(0, x.con_ban_duoc), 0);
    return `${sp.tenDayDu(s)} — ${g.muc === 'gan_giong' ? 'gần giống' : 'hơi giống'} (${g.ly_do})${con === 0 ? ' — đang hết hàng' : ''}`;
  });
  return {
    tim_thay: giong.length > 0,
    anh_khach: p.mo_ta_anh_khach,
    mau_gan_giong: giong,
    ghi_chu: giong.length
      ? 'Chỉ nói "gần giống", không nói "giống hệt". Có thể gửi ảnh mẫu (gui_anh_san_pham) và mời khách xem.'
      : 'Shop chưa có mẫu này: nói thật, gợi ý mẫu cùng loại nếu có (muc_luc_san_pham).',
  };
}

module.exports = { timMauTheoAnh, taiAnhKhach };
