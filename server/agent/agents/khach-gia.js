'use strict';

/**
 * Khách giả (SPEC.md F-15 mở rộng, #87): AI đóng vai khách trả lời tin nhắn của shop trong Phòng diễn tập, theo một tính
 * cách được giao (dễ tính, hỏi ship, đổi size, thêm món, hủy…), với tên / số / địa chỉ bịa sẵn — để buổi tập đi trọn:
 * chốt → nhắn riêng → gửi thông tin giao → đọc lại đơn → xác nhận. Chỉ dùng với Facebook giả. Model rẻ nhất (gpt-6-luna).
 */

const { chayAgent } = require('../runtime');
const sp = require('../../nghiep-vu/san-pham');
const kho = require('../../nghiep-vu/kho');

// Tính cách khách giả và tỷ trọng (dễ tính nhiều nhất, như khách thật).
const TINH_CACH = [
  { id: 'de_tinh', ten: 'Dễ tính', trong: 4, mo_ta: 'trả lời nhanh, gửi đủ tên, số điện thoại, địa chỉ trong MỘT tin khi shop xin; shop đọc lại đơn thì đồng ý ngay' },
  { id: 'hoi_ship', ten: 'Hỏi ship trước', trong: 2, mo_ta: 'trước khi gửi thông tin thì hỏi phí ship, bao lâu nhận, có được kiểm hàng không; shop trả lời xong mới gửi thông tin rồi đồng ý' },
  { id: 'tung_phan', ten: 'Gửi từng phần', trong: 1, mo_ta: 'gửi thông tin từng phần qua nhiều tin: tên trước, rồi số điện thoại, rồi địa chỉ; cuối cùng đồng ý' },
  { id: 'doi_size', ten: 'Đổi size', trong: 1, mo_ta: 'ngay sau khi shop báo đã giữ hàng thì xin đổi sang size khác của cùng mẫu (lớn hơn một size), rồi gửi thông tin và đồng ý' },
  { id: 'them_mon', ten: 'Mua thêm', trong: 1, mo_ta: 'xin lấy thêm MỘT món khác trong danh sách sản phẩm (ghi rõ số, màu, size), rồi gửi thông tin và đồng ý' },
  { id: 'chuyen_khoan', ten: 'Chuyển khoản', trong: 1, mo_ta: 'muốn chuyển khoản thay vì trả tiền khi nhận hàng; gửi thông tin rồi đồng ý' },
  { id: 'nghi_ngo', ten: 'Hay hỏi', trong: 1, mo_ta: 'hỏi vài câu trước (vải có nóng không, màu có giống ảnh không, có phải người thật trả lời không), rồi mới gửi thông tin và đồng ý' },
  { id: 'huy', ten: 'Đổi ý hủy', trong: 1, mo_ta: 'sau một hai tin thì đổi ý, xin hủy đơn lịch sự (ví dụ "thôi shop hủy giúp mình nha, mình mua rồi")' },
  { id: 'im_lang', ten: 'Im lặng', trong: 1, mo_ta: 'không trả lời gì cả (đơn sẽ tự hủy khi quá giờ giữ)' },
];
// Khách tự nhắn Page hỏi mua (không qua live): hỏi trước rồi mua.
const HOI_MUA = { id: 'hoi_mua', ten: 'Tự nhắn hỏi mua', mo_ta: 'đang hỏi về một sản phẩm; shop trả lời rõ thì quyết định lấy một món (ghi số, màu, size), gửi thông tin khi shop xin, đồng ý khi shop đọc lại đơn' };

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const DIA_CHI = [
  'số 12 ngõ 45 Trần Duy Hưng, Trung Hòa, Cầu Giấy, Hà Nội',
  '78 Nguyễn Văn Cừ, Ninh Xá, TP Bắc Ninh, Bắc Ninh',
  'phòng 1203 tòa B, chung cư Mỹ Đình Plaza, Nam Từ Liêm, Hà Nội',
  'thôn Đông, xã Tam Sơn, TP Từ Sơn, Bắc Ninh',
  '25 Lê Lợi, phường Trần Hưng Đạo, TP Thái Bình',
  'số 6 ngách 12/3 Kim Mã, Ba Đình, Hà Nội',
  '112 Quang Trung, TP Hải Dương, Hải Dương',
  'xóm 3, xã Việt Hùng, huyện Đông Anh, Hà Nội',
];

function bam(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** Danh tính bịa cố định theo người (cùng người luôn cùng số, cùng địa chỉ). */
function danhTinh(ten, psid) {
  const h = bam(psid);
  const dauSo = ['091', '093', '097', '098', '086', '035', '088', '070'][h % 8];
  const sdt = `${dauSo}${String(1000000 + (h % 9000000)).slice(-7)}`;
  const coHo = /\s/.test(String(ten).trim());
  return { ten_day_du: coHo ? ten : `${HO[h % HO.length]} ${ten}`, sdt, dia_chi: DIA_CHI[h % DIA_CHI.length] };
}

function chonTinhCach(ngau = Math.random) {
  const tong = TINH_CACH.reduce((s, t) => s + t.trong, 0);
  let x = ngau() * tong;
  for (const t of TINH_CACH) { x -= t.trong; if (x < 0) return t; }
  return TINH_CACH[0];
}

const LUOC_DO = {
  type: 'object',
  properties: {
    tra_loi: { type: 'string', description: 'MỘT tin nhắn tiếp theo của khách; "" nếu khách không nhắn gì thêm hoặc chỉ bấm nút' },
    bam_nut: { type: 'string', description: 'Tên nút khách bấm trên thẻ đơn của shop (chép đúng tên nút), "" nếu không bấm' },
    ket_thuc: { type: 'boolean', description: 'true khi cuộc trò chuyện đã xong (đơn đã xác nhận / đã hủy và đã cảm ơn)' },
  },
  required: ['tra_loi', 'bam_nut', 'ket_thuc'],
  additionalProperties: false,
};

/** Danh sách món ngắn gọn cho khách giả (để đổi size, thêm món đúng thứ shop có). */
function monCuaShop() {
  return sp.mucLucDangBan().slice(0, 15).map((t) => {
    const s = sp.laySanPham(t.id);
    const pl = kho.conHang(s.id).filter((p) => p.con_ban_duoc > 0).map((p) => sp.nhanPl(p));
    return `- Số ${s.so} · ${s.ten} · ${pl.join(', ') || 'hết hàng'}`;
  }).join('\n');
}

/**
 * @param {object} o
 * @param {{tu:'page'|'khach', noi_dung:string}[]} o.tin   luồng chat (cũ → mới)
 * @param {{id:string, mo_ta:string}} o.tinhCach
 * @param {{ten_day_du:string, sdt:string, dia_chi:string}} o.nguoi
 * @returns {Promise<{tra_loi:string, ket_thuc:boolean}|null>}
 */
async function traLoiKhachGia({ tin, tinhCach, nguoi, nhaCungCap, tinHieu }) {
  const lich = tin.slice(-16).map((t) => (t.tu === 'page'
    ? `Shop: ${t.noi_dung}${t.nut?.length ? ` [thẻ có nút: ${t.nut.map((n) => n.tieu_de).join(' | ')}]` : ''}`
    : `Bạn: ${t.postback ? `(bấm nút) ${t.noi_dung}` : t.noi_dung}`)).join('\n');
  const kq = await chayAgent({
    agentId: 'khach_gia',
    kichHoat: `Khách giả trả lời (${tinhCach.id})`,
    tinDau: [
      `Tính cách của bạn: ${tinhCach.mo_ta}.`,
      `Thông tin của bạn (chỉ gửi khi shop xin hoặc khi bạn quyết định mua): tên ${nguoi.ten_day_du}, số điện thoại ${nguoi.sdt}, địa chỉ ${nguoi.dia_chi}.`,
      '',
      'Sản phẩm shop đang bán (màu/size còn hàng):',
      monCuaShop(),
      '',
      'Cuộc trò chuyện tới giờ:',
      lich,
      '',
      'Shop gửi thẻ đơn có nút: đơn đúng ý thì bấm nút xác nhận (bam_nut = tên nút đó, tra_loi = ""); muốn đổi món / size / địa chỉ thì bấm nút sửa rồi nói rõ muốn đổi gì ở lượt sau. Tính cách "Đổi ý hủy" thì nhắn xin hủy thay vì bấm.',
      'Viết lượt tiếp theo của bạn. Trả phiếu JSON {tra_loi, bam_nut, ket_thuc}.',
    ].join('\n'),
    luocDo: LUOC_DO,
    lienKet: { dienTap: true },
    gioiHan: { so_buoc: 1 },
    tinHieu,
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  return kq.ok ? kq.ketQua : null;
}

module.exports = { traLoiKhachGia, danhTinh, chonTinhCach, TINH_CACH, HOI_MUA, LUOC_DO };
