'use strict';

/**
 * Công cụ đọc sản phẩm của AI (SPEC.md A.6; #79, #80). Theo hướng dẫn thiết kế công cụ mới nhất (mục 14): tham số bằng lời
 * dễ hiểu (số sản phẩm như khách gõ), kết quả gọn, lỗi luôn kèm cách sửa.
 *  - `muc_luc_san_pham`: sản phẩm Đang bán (số, tên, giá, tổng còn bán được).
 *  - `lay_san_pham(so)`: thẻ sản phẩm đầy đủ — trong buổi live là đúng bản sửa lúc bắt đầu phiên.
 *  - `tim_trong_san_pham(so, cau_hoi)`: vài dòng thẻ khớp câu hỏi, để trích nguyên văn.
 *  - `xem_san_pham(so)` · `xem_con_hang(so)`: cho miệng Live (#80) và "Nói với Mai" — thẻ rút gọn / còn bán được lúc gọi.
 *  - `tim_san_pham(cau)`: "Nói với Mai" tìm theo tên, số, màu.
 * AI chỉ thấy sản phẩm Đang bán (Nháp, Ngừng bán → `SP_KHONG_BAN_DUOC`), trừ agent Quản lý (quản lý cả hàng Nháp).
 */

const sp = require('../../nghiep-vu/san-pham');
const kho = require('../../nghiep-vu/kho');
const live = require('../../nghiep-vu/live');
const { LoiNghiepVu, boDau, hienTien } = require('../../nghiep-vu/chung');

const SO = { type: 'integer', description: 'Số sản phẩm, ví dụ 12 (khách gõ "chốt 12", "áo số 12")' };
const vat = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });

/**
 * Sản phẩm theo số, kiểm được dùng không. Trong buổi live trả đúng bản sửa lúc bắt đầu phiên (để câu trên sóng khớp bản
 * Bộ kiểm tra dùng). `ctx.soDuocGiao` (Co-host) chỉ cho đúng số được giao.
 */
function canSanPham(so, ctx = {}, { choNhap = false } = {}) {
  if (ctx.soDuocGiao != null && Number(so) !== Number(ctx.soDuocGiao)) {
    throw new LoiNghiepVu('CHI_SAN_PHAM_DUOC_GIAO', `Bạn chỉ được dùng sản phẩm số ${ctx.soDuocGiao} đã được giao. Gọi lại với so = ${ctx.soDuocGiao}.`);
  }
  const s = sp.layTheoSo(so);
  if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${so}. Gọi muc_luc_san_pham (hoặc tim_san_pham) để xem các số đang có.`);
  if (s.trang_thai !== 'dang_ban' && !choNhap) {
    throw new LoiNghiepVu('SP_KHONG_BAN_DUOC',
      `Sản phẩm số ${s.so} đang ${sp.TEN_TRANG_THAI[s.trang_thai]}: không tư vấn, không bán. Báo khách lịch sự và gợi ý mẫu khác (muc_luc_san_pham).`);
  }
  const pb = ctx.phienLiveId ? live.phienBanSanPhamTrongPhien(ctx.phienLiveId, s.id) : null;
  const ban = (pb && pb !== s.phien_ban && sp.layBanSua(s.id, pb)) || s;
  ctx.ghiNguon?.('san_pham', s.id, ban.phien_ban);
  return { goc: s, ban };
}

const mucLuc = {
  ten: 'muc_luc_san_pham',
  moTa: 'Danh sách sản phẩm Đang bán: số, tên, giá, tổng còn bán được. Dùng để biết shop có những mẫu nào trước khi đọc thẻ một mẫu bằng lay_san_pham.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({}),
  chay() {
    return {
      san_pham: sp.mucLucDangBan().map((x) => ({ so: x.so, ten: x.ten_day_du, gia: hienTien(x.gia), con_ban_duoc: x.con_ban_duoc })),
    };
  },
};

const laySanPham = {
  ten: 'lay_san_pham',
  moTa: 'Đọc thẻ đầy đủ của một sản phẩm Đang bán theo số: giá (cả giá riêng từng phân loại), thông số, bảng size, còn bán được từng màu × cỡ, điểm nổi bật, mô tả, hỏi đáp, món phối cùng. Trích nguyên văn dòng trong thẻ với nguon = số sản phẩm (ví dụ "12").',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ so: SO }),
  chay({ so }, ctx = {}) {
    const { goc, ban } = canSanPham(so, ctx);
    return { so: goc.so, phien_ban: ban.phien_ban, the: sp.theChoAi({ ...ban, id: goc.id }) };
  },
};

// Từ quá phổ biến, không giúp tìm dòng trả lời.
const BO_QUA = new Set(['bao', 'nhieu', 'khong', 'co', 'la', 'gi', 'the', 'nao', 'ad', 'oi', 'cho', 'em', 'minh', 'hoi', 'vay', 'shop',
  'ko', 'nhe', 'nha', 'duoc', 'va', 'cua', 'ao', 'quan', 'mau', 'so', 'sp', 'chi', 'anh', 'ban', 'a', 'voi']);

const timTrong = {
  ten: 'tim_trong_san_pham',
  moTa: 'Tìm trong thẻ của MỘT sản phẩm các dòng liên quan tới câu hỏi (ví dụ "chất liệu", "size M", "còn màu đen", "giặt"). Trả tối đa 6 dòng nguyên văn để trích dẫn.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ so: SO, cau_hoi: { type: 'string', description: 'Câu hỏi hoặc từ khóa cần tìm' } }),
  chay({ so, cau_hoi: cauHoi }, ctx = {}) {
    const { goc, ban } = canSanPham(so, ctx);
    const tu = boDau(cauHoi).split(/[^a-z0-9]+/).filter((x) => x && !BO_QUA.has(x));
    const diem = sp.dongThe({ ...ban, id: goc.id }).map((d) => d.chu)
      .map((d) => ({ d, n: tu.filter((x) => boDau(d).split(/[^a-z0-9]+/).includes(x)).length }))
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    return {
      so: goc.so,
      phien_ban: ban.phien_ban,
      dong: diem.slice(0, 6).map((x) => x.d),
      ...(diem.length ? {} : { ghi_chu: 'Không thấy dòng nào khớp: thẻ có thể chưa có thông tin này. Gọi lay_san_pham để đọc cả thẻ.' }),
    };
  },
};

/** Còn bán được từng ô, dạng dòng dữ liệu để trích (K2, K9). */
function dongConHang(goc) {
  const ds = kho.conHang(goc.id);
  return ds.map((p) => `Còn bán được ${sp.nhanPl(p)}: ${p.con_ban_duoc}`);
}

const xemSanPham = {
  ten: 'xem_san_pham',
  moTa: 'Xem nhanh một sản phẩm theo số: tên, giá, phân loại, điểm nổi bật, bảng size. Dùng khi cần nhắc lại thông tin một mẫu.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ so: SO }),
  chay({ so }, ctx = {}) {
    const { goc, ban } = canSanPham(so, ctx, { choNhap: ctx.agentId === 'quan_ly' });
    const the = sp.dongThe({ ...ban, id: goc.id }, { tonKho: false }).map((d) => d.chu);
    return { so: goc.so, trang_thai: sp.TEN_TRANG_THAI[goc.trang_thai], the: the.join('\n') };
  },
};

const xemConHang = {
  ten: 'xem_con_hang',
  moTa: 'Xem còn bán được bao nhiêu của từng màu × cỡ của một sản phẩm, đúng lúc gọi (đã trừ hàng đang giữ cho đơn chưa gửi).',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ so: SO }),
  chay({ so }, ctx = {}) {
    const { goc } = canSanPham(so, ctx, { choNhap: ctx.agentId === 'quan_ly' });
    const nguong = require('../../nghiep-vu/cai-dat').banHang().nguong_sap_het;
    const ds = kho.conHang(goc.id);
    return {
      so: goc.so, ten: sp.tenDayDu(goc),
      dong: dongConHang(goc),
      tong: ds.reduce((a, p) => a + p.con_ban_duoc, 0),
      het: ds.filter((p) => p.con_ban_duoc <= 0).map((p) => sp.nhanPl(p)),
      sap_het: ds.filter((p) => p.con_ban_duoc > 0 && p.con_ban_duoc <= nguong).map((p) => sp.nhanPl(p)),
    };
  },
};

const timSanPham = {
  ten: 'tim_san_pham',
  moTa: 'Tìm sản phẩm theo số, tên, tên gọi khác hoặc màu (ví dụ "áo đen", "sơ mi linen", "12"). Trả số, tên, trạng thái, giá, còn bán được, các phân loại.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ cau: { type: 'string', description: 'Điều cần tìm' } }),
  chay({ cau }) {
    const tu = boDau(cau).split(/[^a-z0-9]+/).filter((x) => x && !BO_QUA.has(x));
    const so = (String(cau).match(/\d+/) || [])[0];
    const ds = sp.danhSach().map((x) => {
      const pl = sp.phanLoaiCua(x.id).filter((p) => !p.bo);
      const chu = boDau(`${x.ten} ${x.ten_goi} ${pl.map((p) => `${p.gt1} ${p.gt2 || ''}`).join(' ')} ${sp.laySanPham(x.id).ten_goi_khac.join(' ')}`);
      const n = tu.filter((t) => chu.split(/[^a-z0-9]+/).includes(t)).length + (so && Number(so) === x.so ? 5 : 0);
      return { x, pl, n };
    }).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 8);
    return {
      san_pham: ds.map(({ x, pl }) => ({
        so: x.so, ten: x.ten_day_du, trang_thai: sp.TEN_TRANG_THAI[x.trang_thai], gia: hienTien(x.gia), con_ban_duoc: x.con_ban_duoc,
        phan_loai: [...new Set(pl.map((p) => sp.nhanPl(p)))].join(', '),
      })),
      ...(ds.length ? {} : { ghi_chu: 'Không tìm thấy. Hỏi lại người dùng số sản phẩm hoặc tên khác.' }),
    };
  },
};

module.exports = [mucLuc, laySanPham, timTrong, xemSanPham, xemConHang, timSanPham];
module.exports.canSanPham = canSanPham;
