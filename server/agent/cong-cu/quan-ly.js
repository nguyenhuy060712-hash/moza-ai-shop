'use strict';

/**
 * Công cụ ghi của "Nói với Mai" (SPEC.md F-62, #76; agent `quan_ly`): nhập kho, điều chỉnh tồn, đổi trạng thái sản phẩm.
 * Mặc định "Hỏi": AI gọi công cụ → MOZA đọc hiểu lệnh ngay (`xemTruoc`: tìm đúng ô phân loại, báo lỗi kèm cách sửa nếu
 * mơ hồ; tham số giữ nguyên) → bảng xem trước + nút "Làm" / "Bỏ". Chỉ khi người bấm "Làm" mới ghi (mục chờ duyệt, thuc-hien.js).
 * Không có công cụ xóa, sửa giá, sửa đơn đã gửi (F-62).
 */

const sp = require('../../nghiep-vu/san-pham');
const kho = require('../../nghiep-vu/kho');
const { LoiNghiepVu, boDau } = require('../../nghiep-vu/chung');

const khoa = (s) => boDau(s ?? '').replace(/\s+/g, ' ').replace(/^size /, '').trim();

const DONG = (tenSo, moTaSo) => ({
  type: 'array',
  description: 'Mỗi dòng một ô phân loại',
  items: {
    type: 'object',
    properties: {
      so: { type: 'integer', description: 'Số sản phẩm, ví dụ 12' },
      phan_loai_1: { type: 'string', description: 'Giá trị nhóm 1 (thường là màu), ví dụ "Đen"; sản phẩm chỉ một phân loại thì để ""' },
      phan_loai_2: { type: 'string', description: 'Giá trị nhóm 2 (thường là cỡ), ví dụ "M"; sản phẩm không có nhóm 2 thì để ""' },
      [tenSo]: { type: 'integer', description: moTaSo },
    },
    required: ['so', 'phan_loai_1', 'phan_loai_2', tenSo],
    additionalProperties: false,
  },
});

/**
 * Tìm đúng một ô phân loại từ lời người dùng: so không dấu, không phân biệt hoa thường, bỏ chữ "size".
 * Không rõ → lỗi kèm danh sách phân loại để AI hỏi lại người dùng (F-62 "câu mơ hồ thì hỏi lại, không ghi gì").
 */
function timO(d) {
  const s = sp.layTheoSo(d.so);
  if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${d.so}. Hỏi lại người dùng số sản phẩm (tim_san_pham để tra).`);
  const ds = sp.phanLoaiCua(s.id).filter((p) => !p.bo);
  const cacO = ds.map((p) => sp.nhanPl(p)).join(', ');
  const k1 = khoa(d.phan_loai_1);
  const k2 = khoa(d.phan_loai_2);
  let khop = ds.filter((p) => (!k1 || khoa(p.gt1) === k1) && (!k2 || khoa(p.gt2) === k2));
  // Người dùng nói ngược thứ tự ("M đen") hoặc cho cả hai vào một ô.
  if (!khop.length && k1 && k2) khop = ds.filter((p) => khoa(p.gt1) === k2 && khoa(p.gt2) === k1);
  if (khop.length !== 1) {
    throw new LoiNghiepVu(khop.length ? 'CHUA_RO_PHAN_LOAI' : 'PHAN_LOAI_KHONG_CO',
      `${sp.tenDayDu(s)}: ${khop.length ? 'chưa rõ ô nào' : `không có phân loại "${[d.phan_loai_1, d.phan_loai_2].filter(Boolean).join(' / ')}"`}. `
      + `Các ô đang có: ${cacO}. Hỏi lại người dùng, không tự chọn.`);
  }
  return { s, p: khop[0] };
}

function lamXemTruoc(ts, { tenSo, dong }) {
  if (!ts.dong?.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa có dòng nào. Hỏi lại người dùng muốn làm gì.');
  return { xem_truoc: ts.dong.map((d) => { const { s, p } = timO(d); return dong(s, p, d[tenSo]); }) };
}

const nhapKho = {
  ten: 'nhap_kho',
  moTa: 'Nhập thêm hàng vào kho (cộng thêm vào tồn) cho một hoặc nhiều ô màu × cỡ. Ví dụ "nhập thêm 10 áo 12 đen M, 5 trắng L" → 2 dòng. Người dùng sẽ xem bảng và bấm "Làm".',
  nhom: 'co_anh_huong',
  macDinh: 'hoi',
  thamSo: { type: 'object', properties: { dong: DONG('so_luong', 'Số chiếc nhập thêm (≥ 1)') }, required: ['dong'], additionalProperties: false },
  xemTruoc(ts) {
    for (const d of ts.dong || []) {
      if (!(d.so_luong >= 1)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Số nhập thêm phải từ 1 trở lên. Hỏi lại người dùng.');
    }
    return lamXemTruoc(ts, { tenSo: 'so_luong', dong: (s, p, n) => `Nhập: ${p.sku} (${sp.tenGoi(s)} ${sp.nhanPl(p)}) +${n} → tồn ${p.ton + n}` });
  },
  chay(ts) {
    const kq = kho.nhap(ts.dong.map((d) => ({ phan_loai_id: timO(d).p.id, so: d.so_luong })), { ghiChu: 'qua Mai' });
    return { da_lam: kq.map((x) => `${x.sku} +${x.thay_doi} → tồn ${x.ton}`) };
  },
};

const dieuChinhKho = {
  ten: 'dieu_chinh_kho',
  moTa: 'Điều chỉnh tồn (kiểm kê): đặt tồn trong kho của ô màu × cỡ về đúng số đếm được. Người dùng sẽ xem bảng và bấm "Làm".',
  nhom: 'co_anh_huong',
  macDinh: 'hoi',
  thamSo: { type: 'object', properties: { dong: DONG('ton_moi', 'Số tồn đếm được (≥ 0)') }, required: ['dong'], additionalProperties: false },
  xemTruoc(ts) {
    for (const d of ts.dong || []) {
      if (!(d.ton_moi >= 0)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Tồn mới phải từ 0 trở lên. Hỏi lại người dùng.');
    }
    return lamXemTruoc(ts, { tenSo: 'ton_moi', dong: (s, p, n) => `Điều chỉnh: ${p.sku} (${sp.tenGoi(s)} ${sp.nhanPl(p)}) ${p.ton} → ${n}` });
  },
  chay(ts) {
    const kq = kho.dieuChinh(ts.dong.map((d) => ({ phan_loai_id: timO(d).p.id, ton: d.ton_moi })), { ghiChu: 'qua Mai' });
    return { da_lam: kq.map((x) => `${x.sku} → tồn ${x.ton}`) };
  },
};

const TRANG_THAI = { dang_ban: 'Đang bán', ngung_ban: 'Ngừng bán', nhap: 'Nháp' };

const doiTrangThai = {
  ten: 'doi_trang_thai_san_pham',
  moTa: 'Đổi trạng thái một sản phẩm: dang_ban (Đang bán), ngung_ban (Ngừng bán), nhap (Nháp). Ví dụ "ngừng bán áo 7". Người dùng sẽ xem và bấm "Làm".',
  nhom: 'co_anh_huong',
  macDinh: 'hoi',
  thamSo: {
    type: 'object',
    properties: { so: { type: 'integer', description: 'Số sản phẩm' }, trang_thai: { type: 'string', enum: Object.keys(TRANG_THAI) } },
    required: ['so', 'trang_thai'],
    additionalProperties: false,
  },
  xemTruoc(ts) {
    const s = sp.layTheoSo(ts.so);
    if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${ts.so}. Hỏi lại người dùng.`);
    return { xem_truoc: [`Đổi trạng thái: ${sp.tenDayDu(s)} ${TRANG_THAI[s.trang_thai]} → ${TRANG_THAI[ts.trang_thai]}`] };
  },
  chay(ts) {
    const s = sp.layTheoSo(ts.so);
    if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${ts.so}.`);
    const kq = sp.doiTrangThai(s.id, ts.trang_thai);
    return { da_lam: [`${sp.tenDayDu(kq.san_pham)} → ${TRANG_THAI[kq.san_pham.trang_thai]}`] };
  },
};

/* ---------------- giá live (F-93, tắt mặc định) ---------------- */

/** Buổi đang chờ live (giá live chỉ đặt được trước khi live bắt đầu). */
function phienChoLive() {
  const p = require('../../nghiep-vu/live').phienDangMo();
  if (!p || p.trang_thai !== 'cho_live') throw new LoiNghiepVu('GIA_LIVE_DA_KHOA', 'Giá live chỉ đặt khi có buổi đang Chờ live (live bắt đầu là khóa). Báo người dùng.');
  return p;
}

const datGiaLive = {
  ten: 'dat_gia_live',
  moTa: 'Đặt giá live (tới hết buổi) cho một món của buổi đang chờ live, ví dụ "đặt giá live áo 12 259k" → so 12, gia 259000; "giảm 10% áo 12" → muc 10; gia 0 = bỏ giá live. Chỉ khi công tắc Giá live bật. Người dùng sẽ xem và bấm "Làm".',
  nhom: 'co_anh_huong',
  macDinh: 'hoi',
  thamSo: {
    type: 'object',
    properties: {
      so: { type: 'integer', description: 'Số sản phẩm' },
      gia: { type: 'integer', description: 'Giá live (đồng), 0 nếu dùng mức % hoặc bỏ giá live' },
      muc: { type: 'integer', enum: [0, 5, 10, 15], description: 'Mức giảm % (5, 10, 15); 0 nếu gõ giá' },
    },
    required: ['so', 'gia', 'muc'],
    additionalProperties: false,
  },
  xemTruoc(ts) {
    const gb = require('../../nghiep-vu/gia-ban');
    const { hienTien } = require('../../nghiep-vu/chung');
    if (!require('../../nghiep-vu/cai-dat').banHang().gia_live_bat) throw new LoiNghiepVu('GIA_LIVE_TAT', 'Công tắc "Giá live" đang tắt (Cài đặt → Bán hàng): báo người dùng bật sau khi luật sư xem.');
    const p = phienChoLive();
    const s = sp.layTheoSo(ts.so);
    if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${ts.so}. Hỏi lại người dùng.`);
    const moi = ts.muc ? gb.goiY(s.gia).find((x) => x.muc === ts.muc)?.gia : ts.gia || null;
    if (moi != null && !(moi > 0 && moi < s.gia)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Giá live phải nhỏ hơn giá bán ${hienTien(s.gia)}. Hỏi lại người dùng.`);
    const cu = gb.giaLiveCuaPhien(p.id).find((x) => x.san_pham_id === s.id);
    if (!cu) throw new LoiNghiepVu('KHONG_TIM_THAY', `${sp.tenDayDu(s)} không có trong kịch bản buổi "${p.ten}".`);
    return { xem_truoc: [`Giá live buổi "${p.ten}": ${sp.tenDayDu(s)} ${cu.gia_live != null ? hienTien(cu.gia_live) : 'không có'} → ${moi != null ? `${hienTien(moi)} (giá thường ${hienTien(s.gia)})` : 'bỏ giá live'}`] };
  },
  chay(ts) {
    const gb = require('../../nghiep-vu/gia-ban');
    const p = phienChoLive();
    const s = sp.layTheoSo(ts.so);
    if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', `Không có sản phẩm số ${ts.so}.`);
    const kq = ts.muc ? gb.datGiaLive(p.id, s.id, { muc: ts.muc }) : gb.datGiaLive(p.id, s.id, { gia: ts.gia || null });
    return { da_lam: [`${sp.tenDayDu(s)}: giá live ${kq.gia_live != null ? require('../../nghiep-vu/chung').hienTien(kq.gia_live) : 'đã bỏ'}`] };
  },
};

/* ---------------- điền thông tin shop bằng lời (F-95, #119) ---------------- */

/**
 * Luật cứng: mọi con số trong giá trị AI định ghi phải có trong câu người dùng vừa nói (nghe nhầm / AI tự thêm số thì không ghi).
 * `ctx.cauNguoiDung` chỉ có lúc AI gọi; lúc vẽ lại bảng xem trước (không có câu) thì bỏ qua kiểm này.
 */
function kiemSoTrongCau(chu, ctx) {
  if (ctx?.cauNguoiDung == null) return;
  const { soKhongCoTrongNguon } = require('../kiem-tra/quy-doi-so');
  const thua = soKhongCoTrongNguon(String(chu), [String(ctx.cauNguoiDung)]);
  if (thua.length) {
    throw new LoiNghiepVu('SO_KHONG_CO_TRONG_CAU', `Con số ${[...new Set(thua.map((x) => x.chu))].join(', ')} không có trong câu người dùng nói: không ghi. Hỏi lại người dùng con số đúng.`);
  }
}

const O_BAN_HANG = {
  phi_ship: { ten: 'Phí ship', tien: true },
  mien_phi_tu: { ten: 'Miễn phí ship từ', tien: true },
  gio_giu: { ten: 'Giờ giữ hàng', don_vi: 'giờ' },
  gio_giu_ngan: { ten: 'Giữ ngắn cho người chưa bấm (giờ sau khi hết live)', don_vi: 'giờ' },
  gio_nghe_may: { ten: 'Giờ nghe máy' },
  xung_ho: { ten: 'Cách xưng hô' },
  ten_shop: { ten: 'Tên shop' },
  sdt_shop: { ten: 'Số điện thoại shop' },
  dia_chi_shop: { ten: 'Địa chỉ gửi hàng' },
  phu_trach: { ten: 'Người phụ trách buổi live' },
  doi_tra_ngan: { ten: 'Đổi trả (một dòng trên Thanh chữ, thẻ đơn)' },
};
const TEN_XUNG_HO = { minh_ban: 'mình – bạn', shop_chi: 'shop – chị', em_anh_chi: 'em – anh/chị', shop_ban: 'shop – bạn' };

function hienO(k, v) {
  const { hienTien } = require('../../nghiep-vu/chung');
  if (v == null || v === '') return '(trống)';
  if (O_BAN_HANG[k]?.tien) return hienTien(v);
  if (k === 'xung_ho') return TEN_XUNG_HO[v] || v;
  if (O_BAN_HANG[k]?.don_vi) return `${v} ${O_BAN_HANG[k].don_vi}`;
  return String(v);
}

/** Đọc từng dòng của dat_ban_hang thành giá trị lưu (dùng lại kiểm của Cài đặt), không ghi. */
function docDongBanHang(ts, ctx) {
  if (!ts.dong?.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa có dòng nào. Hỏi lại người dùng muốn đặt gì.');
  const caiDat = require('../../nghiep-vu/cai-dat');
  const cu = caiDat.banHang();
  return ts.dong.map((d) => {
    if (!O_BAN_HANG[d.o]) throw new LoiNghiepVu('O_KHONG_CO', `Ô "${d.o}" không có. Chỉ đặt: ${Object.keys(O_BAN_HANG).join(', ')}. Giá, tài khoản ngân hàng sửa ở màn hình.`);
    let v = String(d.gia_tri ?? '').trim();
    if (d.o === 'mien_phi_tu' && /^(khong|không|0?khong_mien)$/i.test(v)) v = '';
    if (d.o === 'xung_ho' && !TEN_XUNG_HO[v]) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Cách xưng hô chọn một trong: ${Object.entries(TEN_XUNG_HO).map(([k, t]) => `${k} (${t})`).join(', ')}.`);
    // Kiểm bằng chính hàm của Cài đặt trên một bản nháp (không ghi).
    const thu = { ...cu, [d.o]: v };
    const moi = (() => {
      if (O_BAN_HANG[d.o].tien) return v === '' ? null : require('../../nghiep-vu/chung').docTien(v, { ten: O_BAN_HANG[d.o].ten });
      if (d.o === 'gio_giu' || d.o === 'gio_giu_ngan') {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > (d.o === 'gio_giu' ? 168 : 24)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `${O_BAN_HANG[d.o].ten} là số giờ nguyên.`);
        return n;
      }
      return thu[d.o];
    })();
    kiemSoTrongCau(hienO(d.o, moi), ctx);
    return { o: d.o, cu: cu[d.o], moi };
  });
}

const datBanHangCC = {
  ten: 'dat_ban_hang',
  moTa: 'Điền / sửa thông tin bán hàng của shop theo lời chủ shop, ví dụ "phí ship 10 nghìn, trên 200 nghìn miễn ship" → 2 dòng {o:"phi_ship", gia_tri:"10000"}, {o:"mien_phi_tu", gia_tri:"200000"}; "không miễn ship" → {o:"mien_phi_tu", gia_tri:"khong"}; giờ nghe máy dạng "08:00-21:00"; xưng hô: minh_ban · shop_chi · em_anh_chi · shop_ban. Chỉ dùng con số người dùng nói, không tự thêm. Người dùng sẽ xem bảng và bấm "Làm".',
  nhom: 'co_anh_huong',
  macDinh: 'hoi',
  thamSo: {
    type: 'object',
    properties: {
      dong: {
        type: 'array',
        items: {
          type: 'object',
          properties: { o: { type: 'string', enum: Object.keys(O_BAN_HANG) }, gia_tri: { type: 'string', description: 'Giá trị mới, đúng như người dùng nói (tiền ghi số đồng)' } },
          required: ['o', 'gia_tri'],
          additionalProperties: false,
        },
      },
    },
    required: ['dong'],
    additionalProperties: false,
  },
  xemTruoc(ts, ctx) {
    return { xem_truoc: docDongBanHang(ts, ctx).map((x) => `${O_BAN_HANG[x.o].ten}: ${hienO(x.o, x.cu)} → ${x.o === 'mien_phi_tu' && x.moi == null ? 'không miễn ship' : hienO(x.o, x.moi)}`) };
  },
  chay(ts) {
    const ds = docDongBanHang(ts, null);
    const kq = require('../../nghiep-vu/cai-dat').datBanHang(Object.fromEntries(ds.map((x) => [x.o, x.moi ?? ''])));
    return { da_lam: ds.map((x) => `${O_BAN_HANG[x.o].ten}: ${x.o === 'mien_phi_tu' && kq[x.o] == null ? 'không miễn ship' : hienO(x.o, kq[x.o])}`) };
  },
};

function timMucSoTay(muc) {
  const { boDau } = require('../../nghiep-vu/chung');
  const ds = require('../../nghiep-vu/so-tay').danhSachMuc();
  const k = boDau(muc || '').trim();
  const m = ds.find((x) => boDau(x.tieu_de) === k) || ds.find((x) => k && boDau(x.tieu_de).includes(k));
  if (!m) throw new LoiNghiepVu('MUC_KHONG_CO', `Sổ tay không có mục "${muc}". Các mục: ${ds.map((x) => x.tieu_de).join(', ')}.`);
  return m;
}

const ghiSoTay = {
  ten: 'ghi_so_tay',
  moTa: 'Ghi vào một mục Sổ tay shop theo lời chủ shop (chính sách đổi trả, giao hàng, thanh toán…): muc = tiêu đề mục có sẵn; cach "them" (thêm câu vào cuối) hoặc "thay" (thay cả nội dung). Viết lại gọn đúng ý người nói, không thêm con số hay điều kiện người dùng không nói. Không xóa mục. Người dùng sẽ xem và bấm "Làm".',
  nhom: 'co_anh_huong',
  macDinh: 'hoi',
  thamSo: {
    type: 'object',
    properties: {
      muc: { type: 'string', description: 'Tiêu đề mục Sổ tay, ví dụ "Đổi trả"' },
      cach: { type: 'string', enum: ['them', 'thay'] },
      noi_dung: { type: 'string', description: 'Câu ghi vào Sổ tay (≤ 1000 ký tự)' },
    },
    required: ['muc', 'cach', 'noi_dung'],
    additionalProperties: false,
  },
  xemTruoc(ts, ctx) {
    const m = timMucSoTay(ts.muc);
    const nd = String(ts.noi_dung || '').trim();
    if (!nd) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Nội dung trống. Hỏi lại người dùng.');
    if (nd.length > 1000) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Nội dung dài quá 1000 ký tự: tách ý hoặc ghi ở màn hình Sổ tay.');
    kiemSoTrongCau(nd, ctx);
    return { xem_truoc: [`Sổ tay → ${m.tieu_de} (${ts.cach === 'thay' ? 'thay nội dung' : 'thêm vào cuối'}): ${nd}`] };
  },
  chay(ts) {
    const m = timMucSoTay(ts.muc);
    const nd = String(ts.noi_dung || '').trim();
    const moi = ts.cach === 'thay' || !m.noi_dung.trim() ? nd : `${m.noi_dung.trim()}\n${nd}`;
    const kq = require('../../nghiep-vu/so-tay').suaMuc(m.id, { noi_dung: moi });
    return { da_lam: [`Sổ tay → ${kq.tieu_de}: bản ${kq.phien_ban}`] };
  },
};

module.exports = [nhapKho, dieuChinhKho, doiTrangThai, datGiaLive, datBanHangCC, ghiSoTay];
