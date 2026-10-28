'use strict';

/**
 * Gỡ lưỡng lự bằng bằng chứng thật (SPEC.md F-84, P12) — không có SQL, không gọi AI.
 * Director gắn ô luong_lu cho bình luận lưỡng lự (không vừa · chất liệu · khác ảnh · giá · ship · để suy nghĩ). MOZA đếm theo
 * (món, kiểu): ≥ 2 người khác nhau trong 5 phút, chưa gỡ trong 10 phút → cho phép giao Co-host Skill go-luong-lu — CHỈ KHI có nguồn
 * thật cho kiểu đó; không có nguồn thì im, chỉ nhắc người dẫn. Nguồn:
 *  - khong_vua: bảng size, mục Sổ tay có "đổi size" / "đổi trả", số đo người mẫu → chiếu bảng size;
 *  - chat_lieu: thông số chất liệu / độ dày đã xác nhận, video quay thật → chiếu video quay thật, không có thì phần chi tiết;
 *  - khac_anh: video quay thật hoặc từ 2 ảnh → chiếu video / ảnh;
 *  - gia: điểm nổi bật đã xác nhận, món phối cùng rẻ hơn trong buổi (KHÔNG giảm giá);
 *  - ship: phí ship / miễn ship trong Cài đặt, Sổ tay mục giao hàng;
 *  - suy_nghi: giờ giữ hàng trong Cài đặt.
 */

const sp = require('./nghiep-vu/san-pham');
const soTay = require('./nghiep-vu/so-tay');
const caiDat = require('./nghiep-vu/cai-dat');
const bangSize = require('./nghiep-vu/bang-size');
const { boDau, hienTien } = require('./nghiep-vu/chung');

const KIEU = ['khong_vua', 'chat_lieu', 'khac_anh', 'gia', 'ship', 'suy_nghi'];
const TEN_KIEU = { khong_vua: 'lo không vừa', chat_lieu: 'lo về chất liệu', khac_anh: 'sợ khác ảnh', gia: 'thấy giá cao', ship: 'lo phí ship', suy_nghi: 'để suy nghĩ thêm' };
const MAC = () => ({ toi_thieu_nguoi: 2, cua_so_phut: 5, go_lai_sau_phut: 10, ...(require('./cau-hinh/mac-dinh.json').luong_lu || {}) });

const coChu = (s, re) => re.test(boDau(String(s || '')).toLowerCase());
// Mục Sổ tay có nội dung (mục trống sẵn tiêu đề không phải nguồn).
const mucSoTay = (re) => soTay.danhSachMuc().filter((m) => String(m.noi_dung || '').trim() && coChu(`${m.tieu_de} ${m.noi_dung}`, re)).map((m) => ({ nguon: 'so_tay', doan: String(m.noi_dung).split('\n')[0].slice(0, 200) }));

/**
 * Nguồn thật để gỡ một kiểu lưỡng lự của một món.
 * @returns {{co:boolean, nguon:{nguon:string, doan:string}[], man_hinh:object|null, goi_y:string}}
 */
function nguonGoLuongLu(kieu, s, { phienId = null, dienTap = true } = {}) {
  const nguon = [];
  let manHinh = null;
  const the = sp.nguonKiemTra(s);
  const dongThe = (re) => the.split('\n').map((x) => x.replace(/^-\s*/, '').trim()).filter((x) => x && coChu(x, re)).slice(0, 2).map((doan) => ({ nguon: String(s.so), doan }));
  const doan = new Set(s.ai_doan || []);
  const videoThat = (s.video || []).filter((v) => dienTap || !v.dung_thu).filter((v) => !v.dung_thu);
  if (kieu === 'khong_vua') {
    if (s.bang_size_id) {
      try { const b = bangSize.layBang(s.bang_size_id); nguon.push(...bangSize.dongChoAi(b).slice(0, 2).map((d) => ({ nguon: String(s.so), doan: d }))); manHinh = { mau: 'bang_size', so: s.so }; } catch { /* bảng đã xóa */ }
    }
    nguon.push(...mucSoTay(/doi size|doi tra|doi hang|doi co/));
    const nm = require('./nguoi-mau').dongNguon(phienId).filter((d) => d.includes(sp.tenGoi(s)));
    nguon.push(...nm.map((d) => ({ nguon: 'nguoi_mau', doan: d })));
  } else if (kieu === 'chat_lieu') {
    if (!doan.has('thong_so.chat_lieu')) nguon.push(...dongThe(/^chat lieu/));
    if (!doan.has('thong_so.do_day')) nguon.push(...dongThe(/^do day/));
    manHinh = videoThat.length ? { mau: 'video', so: s.so } : { mau: 'chi_tiet', so: s.so };
    if (videoThat.length) nguon.push({ nguon: 'video', doan: 'video quay thật' });
  } else if (kieu === 'khac_anh') {
    if (videoThat.length) { manHinh = { mau: 'video', so: s.so }; nguon.push({ nguon: 'video', doan: 'video quay thật' }); } else if ((s.anh || []).length >= 2) { manHinh = { mau: 'trinh_chieu', so: s.so }; nguon.push({ nguon: 'anh', doan: `${s.anh.length} ảnh thật` }); }
  } else if (kieu === 'gia') {
    if (!doan.has('diem_noi_bat')) nguon.push(...(s.diem_noi_bat || []).slice(0, 2).map((d) => ({ nguon: String(s.so), doan: d })));
  } else if (kieu === 'ship') {
    const b = caiDat.banHang();
    if (b.phi_ship != null) nguon.push({ nguon: 'cai_dat', doan: `Phí ship: ${hienTien(b.phi_ship)}` });
    if (b.mien_phi_tu != null) nguon.push({ nguon: 'cai_dat', doan: `Miễn phí ship cho đơn từ ${hienTien(b.mien_phi_tu)}` });
    nguon.push(...mucSoTay(/giao hang|ship|van chuyen/));
  } else if (kieu === 'suy_nghi') {
    const b = caiDat.banHang();
    if (b.gio_giu) nguon.push({ nguon: 'cai_dat', doan: `Giữ hàng tối đa ${b.gio_giu} giờ cho đơn chờ xác nhận` });
  }
  const that = nguon.filter((x) => !['video', 'anh'].includes(x.nguon));
  const co = nguon.length > 0;
  const goiY = {
    khong_vua: 'chiếu bảng size, nói chính sách đổi size (nếu Sổ tay có)',
    chat_lieu: videoThat.length ? 'chiếu video quay thật cận vải, nói chất liệu trên thẻ' : 'cho xem cận vải, nói chất liệu trên thẻ',
    khac_anh: 'chiếu video quay thật / ảnh thật, cầm hàng lên cho xem',
    gia: 'nói điểm nổi bật có thật của món (không giảm giá)',
    ship: 'nói phí ship, mức miễn ship',
    suy_nghi: 'nhắc shop giữ hàng cho người đã chốt, không ép',
  }[kieu];
  return { co, nguon: that, man_hinh: manHinh, goi_y: goiY };
}

/** Theo dõi lưỡng lự trong phiên: (món, kiểu) → người khác nhau trong cửa sổ 5 phút; lần gỡ gần nhất. */
class TheoDoiLuongLu {
  constructor() {
    this.ds = []; // { so, kieu, nguoi, luc }
    this.daGo = new Map(); // `${so}|${kieu}` → lúc gỡ
  }

  them({ so, kieu, nguoi, luc = Date.now() }) {
    if (!KIEU.includes(kieu)) return;
    this.ds.push({ so, kieu, nguoi, luc });
  }

  /** Nhóm lưỡng lự đang có trong 5 phút: [{so, kieu, so_nguoi, da_go_gan}] */
  nhom(bayGio = Date.now()) {
    const m = MAC();
    const cua = m.cua_so_phut * 60e3;
    this.ds = this.ds.filter((x) => bayGio - x.luc < cua);
    const g = new Map();
    for (const x of this.ds) {
      const k = `${x.so}|${x.kieu}`;
      if (!g.has(k)) g.set(k, { so: x.so, kieu: x.kieu, nguoi: new Set() });
      g.get(k).nguoi.add(x.nguoi);
    }
    return [...g.values()].map((x) => ({ so: x.so, kieu: x.kieu, so_nguoi: x.nguoi.size,
      da_go_gan: bayGio - (this.daGo.get(`${x.so}|${x.kieu}`) || 0) < m.go_lai_sau_phut * 60e3 }));
  }

  /** Dòng cho Director: "Lưỡng lự chưa gỡ: lo không vừa · áo 12 · 2 người". */
  tomTat(bayGio = Date.now()) {
    return this.nhom(bayGio).filter((x) => !x.da_go_gan).map((x) => `${TEN_KIEU[x.kieu]} · số ${x.so} · ${x.so_nguoi} người`);
  }

  /** Được gỡ không (đủ người, chưa gỡ gần đây). */
  duocGo(so, kieu, bayGio = Date.now()) {
    const x = this.nhom(bayGio).find((y) => y.so === so && y.kieu === kieu);
    return !!x && x.so_nguoi >= MAC().toi_thieu_nguoi && !x.da_go_gan;
  }

  daGoLuc(so, kieu, luc = Date.now()) {
    this.daGo.set(`${so}|${kieu}`, luc);
  }
}

module.exports = { nguonGoLuongLu, TheoDoiLuongLu, KIEU, TEN_KIEU };
