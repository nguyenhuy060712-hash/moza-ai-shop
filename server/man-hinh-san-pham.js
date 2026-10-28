'use strict';

/**
 * Màn hình sản phẩm và chuyển cảnh lên sóng (SPEC.md #90, chủ dự án duyệt 26/9/2026 — cách A).
 *
 * Màn hình sản phẩm là trang /man-hinh-san-pham.html (OBS lấy làm nguồn trình duyệt — không cần camera quay màn hình).
 * Dịch vụ này giữ "đang chiếu gì" và đẩy dữ liệu dựng sẵn qua /ws (`mhsp.hien`). Nội dung chỉ lấy từ dữ liệu thật của
 * MOZA (sản phẩm Đang bán, ảnh, video, giá, bảng size, còn bán được lúc chiếu) — không bịa, không khan hiếm giả.
 *
 * Mẫu trình bày: gioi_thieu · anh (ảnh đúng màu) · bang_size (tô dòng hợp chiều cao / cân nặng) · chi_tiet · phoi_do ·
 * danh_sach · video · trinh_chieu (ảnh lướt, phóng chậm) · cho (màn chờ).
 *
 * Ai quyết:
 *  - Đổi đoạn kịch bản → tự chiếu thẻ giới thiệu sản phẩm của đoạn (trừ khi người dẫn vừa chọn tay trong 20 giây).
 *  - Director chọn nội dung theo bình luận (ô `man_hinh` trong phiếu); Mai trên sóng gọi công cụ `chieu_man_hinh`.
 *  - Người dẫn bấm ô trên Màn hình người dẫn hoặc nói "Mai ơi, chiếu bảng size…" — luôn thắng.
 *
 * Chuyển cảnh OBS (Phòng live / Sản phẩm / Cả hai) — hai chế độ (chủ dự án: "hai chế độ"):
 *  - người dẫn đang dẫn (Chỉ gợi ý, Mai nói): AI chiếu gì → GỢI Ý "Chiếu lên sóng?", người dẫn bấm một chạm;
 *  - Mai dẫn chính / Đội AI dẫn: AI TỰ chuyển sang Sản phẩm, 15 giây sau (video: 35 giây) tự về Cả hai.
 *  Người dẫn bấm nút / phím 1-2-3 / nói "quay lại camera" lúc nào cũng được. OBS chưa nối → chỉ mô phỏng (vẫn tập được).
 */

const sp = require('./nghiep-vu/san-pham');
const kho = require('./nghiep-vu/kho');
const bangSize = require('./nghiep-vu/bang-size');
const live = require('./nghiep-vu/live');
const caiDat = require('./nghiep-vu/cai-dat');
const { LoiNghiepVu, boDau, hienTien } = require('./nghiep-vu/chung');
const { KetNoiObs, CANH } = require('./obs');

const MAU = ['gioi_thieu', 'anh', 'bang_size', 'chi_tiet', 'phoi_do', 'danh_sach', 'video', 'trinh_chieu', 'khach_mac', 'cho'];
const TEN_MAU = {
  gioi_thieu: 'Giới thiệu', anh: 'Ảnh màu', bang_size: 'Bảng size', chi_tiet: 'Chi tiết, chất liệu', phoi_do: 'Phối đồ',
  danh_sach: 'Danh sách sản phẩm', video: 'Video', trinh_chieu: 'Trình chiếu ảnh', khach_mac: 'Khách mặc thật', cho: 'Màn chờ',
};
const TEN_CANH = { phong: 'Phòng live', san_pham: 'Sản phẩm', ca_hai: 'Cả hai' };
const GIU_TAY_MS = 20 * 1000;
const VE_CA_HAI_MS = 15 * 1000;
const VE_CA_HAI_VIDEO_MS = 35 * 1000;
const GOI_Y_HET_MS = 30 * 1000;

const urlAnh = (s, tep) => `/api/anh/${s.id}/${tep}`;
const urlVideo = (s, tep) => `/api/video/${s.id}/${tep}`;

/** "153–160" → [153, 160]; "M" → null. */
function khoang(chu) {
  const so = String(chu ?? '').match(/\d+(?:[.,]\d+)?/g)?.map((x) => Number(x.replace(',', '.')));
  if (!so?.length) return null;
  return [Math.min(...so), Math.max(...so)];
}

/**
 * MỌI dòng bảng size khớp đủ các số đo khách nói (F-82, #110) — theo thứ tự bảng. Không lùi về "chỉ so cân nặng" nữa: khuyên
 * size phải khớp mọi số đo, không khớp thì để người / AI tư vấn. Không có số đo nào so được → [].
 * @returns {string[]}
 */
function dongHop(bang, { chieuCao, canNang }) {
  const trong = (h, cot, v) => { const k = khoang(h[cot]); return k && v >= k[0] && v <= k[1]; };
  const dk = [['chieu_cao', chieuCao], ['can_nang', canNang]].filter(([c, v]) => v && bang.cot.includes(c));
  if (!dk.length) return [];
  return bang.hang.filter((h) => dk.every(([c, v]) => trong(h, c, v))).map((h) => h.co);
}

/** Sản phẩm trong buổi live (theo thứ tự kịch bản), không có phiên thì mọi sản phẩm Đang bán. */
function sanPhamTrongBuoi() {
  const p = live.phienDangMo();
  const ids = p ? [...new Set(p.kich_ban.doan.map((d) => d.san_pham_id).filter(Boolean))] : sp.mucLucDangBan().map((t) => t.id);
  const ds = ids.map((id) => { try { return sp.laySanPham(id); } catch { return null; } }).filter(Boolean);
  return ds.filter((s) => s.trang_thai === 'dang_ban');
}

function theSanPham(s) {
  const con = kho.conHang(s.id);
  // F-93: buổi có giá live → "Giá live 259.000đ · tới hết buổi"; giá thường gạch chỉ khi có bằng chứng đã bán ở giá đó (F-76).
  const pLive = (() => { try { return live.phienDangMo(); } catch { return null; } })();
  const g = require('./nghiep-vu/gia-ban').giaBanLucNay(s, null, { phienId: pLive?.id || null });
  if (g.la_gia_live) {
    const gach = sp.bangChungGiaGoc({ ...s, gia: g.gia, gia_goc: g.gia_thuong }) ? hienTien(g.gia_thuong) : null;
    return { ...theSanPhamGoc(s, con), gia: sp.hienGia(s, g.gia), gia_goc: gach, nhan_gia: 'Giá live · tới hết buổi' };
  }
  return theSanPhamGoc(s, con);
}

function theSanPhamGoc(s, con) {
  return {
    so: s.so, ten: s.ten, ten_goi: sp.tenGoi(s), gia: sp.hienGia(s), gia_goc: sp.bangChungGiaGoc(s) ? hienTien(s.gia_goc) : null, // F-76: giá gạch chỉ khi có bằng chứng
    anh: (s.anh || []).map((a) => ({ url: urlAnh(s, a.tep), mau: a.mau })),
    // F-82: "Mẫu: 1m60 · mặc S" khi người dẫn đã nói mẫu đang mặc món này (cân nặng chỉ khi người dẫn nói).
    mau_nguoi: (() => { try { const p = live.phienDangMo(); return p ? require('./nguoi-mau').chuThanhChu(p.id, s) : null; } catch { return null; } })(),
    // F-83: cờ sắp hết theo ngưỡng trong Cài đặt (trang không tự đặt số 5).
    con_hang: con.map((p) => ({ nhan: sp.nhanPl(p), con: p.con_ban_duoc, sap_het: p.con_ban_duoc > 0 && p.con_ban_duoc <= caiDat.banHang().nguong_sap_het })),
    // F-83 (#111): "14 người chốt buổi này" — người khác nhau, trừ đơn hủy, từ ngưỡng (mặc định 5). Không bao giờ viết "đã bán".
    nguoi_chot: (() => {
      try {
        const p = live.phienDangMo();
        if (!p) return null;
        const n = require('./nghiep-vu/bao-cao').demNguoiChot(p.id, s.id);
        return n >= (require('./cau-hinh/mac-dinh.json').tren_song?.nguong_nguoi_chot || 5) ? n : null;
      } catch { return null; }
    })(),
    het: con.every((p) => p.con_ban_duoc <= 0),
    cu_phap: sp.cuPhapChot(s), // rau củ: "chốt 50 + số kg"
    doi_tra: caiDat.banHang().doi_tra_ngan || null, // F-95: một dòng cố định "Đổi size trong 3 ngày"
    vua_size: require('./nghiep-vu/bao-cao').phanHoiMac(s.id).chu, // F-100: "X/Y khách nói vừa" (từ 10 phản hồi thật)
    diem_noi_bat: (s.ai_doan || []).includes('diem_noi_bat') ? [] : (s.diem_noi_bat || []).slice(0, 5),
  };
}

/**
 * Dựng dữ liệu cho một lệnh chiếu. Lỗi (sản phẩm không Đang bán, không có ảnh màu đó…) ném LoiNghiepVu có cách sửa.
 * @param {{mau:string, so?:number, mau_sac?:string, chieu_cao?:number, can_nang?:number, so_phoi?:number}} l
 */
function dung(l) {
  const mau = MAU.includes(l.mau) ? l.mau : null;
  if (!mau) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Mẫu màn hình lạ. Chọn: ${MAU.join(', ')}.`);
  const shop = caiDat.tenShop();
  const co = { mau, ten_mau: TEN_MAU[mau], shop, luc: new Date().toISOString() };
  if (mau === 'cho') return co;
  if (mau === 'danh_sach') {
    return { ...co, san_pham_ds: sanPhamTrongBuoi().slice(0, 12).map((s) => { const t = theSanPham(s); return { so: t.so, ten: t.ten, gia: t.gia, anh: t.anh[0]?.url || null, het: t.het }; }) };
  }
  const s = l.so ? sp.layTheoSo(l.so) : null;
  if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY', l.so ? `Không có sản phẩm số ${l.so}.` : 'Cần số sản phẩm để chiếu.');
  if (s.trang_thai !== 'dang_ban') throw new LoiNghiepVu('SP_KHONG_BAN_DUOC', `${sp.tenDayDu(s)} không Đang bán: không chiếu.`);
  const the = theSanPham(s);
  const kq = { ...co, san_pham: the };
  if (mau === 'gioi_thieu' || mau === 'trinh_chieu') return kq;
  if (mau === 'khach_mac') {
    // F-104: chỉ ảnh ĐÃ DUYỆT (đã che mặt), tối đa 4; công tắc tắt thì không chiếu. Không kèm tên, không số đo.
    if (!caiDat.banHang().dung_anh_khach) throw new LoiNghiepVu('TINH_NANG_TAT', 'Ảnh khách mặc thật đang tắt (Cài đặt → Bán hàng).');
    let pk = null;
    try { pk = live.phienDangMo(); } catch { pk = null; }
    const anh = require('./nghiep-vu/anh-khach').anhCuaMon(s.id, { chiThat: !!pk && !pk.dien_tap });
    if (!anh.length) throw new LoiNghiepVu('KHONG_CO_ANH', `${sp.tenGoi(s)} chưa có ảnh khách mặc thật đã duyệt.`);
    return { ...kq, anh_khach: anh.map((a) => ({ url: a.url, chu: a.co ? `Khách thật · mặc size ${a.co}` : 'Khách thật' })) };
  }
  if (mau === 'anh') {
    const khop = l.mau_sac ? the.anh.filter((a) => a.mau && boDau(a.mau) === boDau(l.mau_sac)) : [];
    if (l.mau_sac && !khop.length) {
      const coMau = [...new Set(the.anh.map((a) => a.mau).filter(Boolean))];
      throw new LoiNghiepVu('KHONG_CO_ANH', `${sp.tenGoi(s)} chưa có ảnh màu ${l.mau_sac}${coMau.length ? ` (có ảnh: ${coMau.join(', ')})` : ''}.`);
    }
    return { ...kq, anh_chon: khop.length ? khop : the.anh.slice(0, 1), mau_sac: khop[0]?.mau || null };
  }
  if (mau === 'bang_size') {
    const b = s.bang_size_id ? bangSize.layBang(s.bang_size_id) : null;
    if (!b) throw new LoiNghiepVu('KHONG_CO_BANG_SIZE', `${sp.tenGoi(s)} chưa có bảng size.`);
    return { ...kq, bang_size: { ten: b.ten, cot: b.cot, ten_cot: b.cot.map((c) => bangSize.COT[c]?.ten || c), hang: b.hang },
      // F-82: tô mọi dòng khớp; KHÔNG gửi số đo khách lên màn hình (màn hình này lên sóng).
      dong_hop: dongHop(b, { chieuCao: l.chieu_cao, canNang: l.can_nang }) };
  }
  if (mau === 'chi_tiet') {
    const tenTs = sp.cauHinh().thong_so;
    const ts = sp.boThongSo(s.danh_muc).filter((k) => !(s.ai_doan || []).includes(`thong_so.${k}`))
      .map((k) => ({ ten: tenTs[k]?.ten || k, gia_tri: sp.chuThongSo(k, s.thong_so || {}) })).filter((x) => x.gia_tri);
    const moTa = (s.ai_doan || []).includes('mo_ta') ? [] : String(s.mo_ta || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(1, 7);
    return { ...kq, thong_so: ts.slice(0, 6), mo_ta: moTa };
  }
  if (mau === 'phoi_do') {
    const s2 = (l.so_phoi ? sp.layTheoSo(l.so_phoi) : null) || (s.phoi_cung || []).map((id) => { try { return sp.laySanPham(id); } catch { return null; } }).find((x) => x?.trang_thai === 'dang_ban');
    if (!s2 || s2.trang_thai !== 'dang_ban') throw new LoiNghiepVu('KHONG_CO_PHOI', `${sp.tenGoi(s)} chưa có món phối cùng Đang bán.`);
    return { ...kq, san_pham_2: theSanPham(s2) };
  }
  if (mau === 'video') {
    // F-81 (#109): video dựng thử (AI dựng từ ảnh) không chiếu ở buổi live thật; buổi tập vẫn chiếu, góc có nhãn.
    let p = null;
    try { p = live.phienDangMo(); } catch { p = null; }
    const that = !!p && !p.dien_tap;
    const ds = (s.video || []).filter((x) => !that || !x.dung_thu);
    const v = (l.mau_sac && ds.find((x) => x.mau && boDau(x.mau) === boDau(l.mau_sac))) || ds[0];
    if (!v) {
      const chiDungThu = that && (s.video || []).length > 0;
      return { ...kq, mau: 'trinh_chieu', ten_mau: TEN_MAU.trinh_chieu, ghi_chu: chiDungThu ? 'Chỉ có video dựng thử: buổi live thật không chiếu — trình chiếu ảnh.' : 'Chưa có video: trình chiếu ảnh.' };
    }
    return { ...kq, video: { url: urlVideo(s, v.tep), mau: v.mau, dung_thu: !!v.dung_thu } };
  }
  return kq;
}

/**
 * Hiểu lệnh người dẫn nói / gõ ("Mai ơi, chiếu bảng size áo 12", "quay lại camera"). Không phải lệnh → null.
 * @returns {{canh?:string, chieu?:object}|null}
 */
function docLenh(cau, { soDangNoi = null } = {}) {
  const s = ` ${boDau(cau).replace(/^\s*mai\s*(oi)?[\s,]*/, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  // F-83: "Mai ơi cảm ơn cả nhà" → dòng cảm ơn người chốt trên Thanh chữ.
  if (/^ cam on (ca nha|moi nguoi|cac ban|tat ca)/.test(s)) return { cam_on: true };
  // F-86: "Mai ơi bình chọn be hay đen" → bình chọn màu của món đang nói (màu so với phân loại).
  const bc = /^ (?:binh chon|cho binh chon|mo binh chon) (?:mau )?(.+)$/.exec(s);
  if (bc) {
    const s1 = soDangNoi ? sp.layTheoSo(soDangNoi) : null;
    const g = s1 ? [...new Set(sp.phanLoaiCua(s1.id).map((p) => p.gt1))].sort((a, b) => b.length - a.length) : [];
    const mau = [];
    let con = ` ${bc[1]} `;
    for (const x of g) { const k = ` ${boDau(x)} `; if (con.includes(k)) { mau.push(x); con = con.replace(k, ' '); } }
    return { binh_chon: { mau } };
  }
  const dongTu = /^ (chieu|cho xem|hien|mo|bat|quay lai|ve|chuyen|len song) /;
  if (!dongTu.test(s)) return null;
  if (/ (camera|phong live|nguoi dan) /.test(s) && !/ ca hai /.test(s)) return { canh: 'phong' };
  if (/ (ca hai|chia doi|hai khung) /.test(s)) return { canh: 'ca_hai' };
  const so = Number((s.match(/ (?:ao|quan|vay|dam|chan vay|tui|so|mau|sp) (\d{1,4}) /) || s.match(/ (\d{1,4}) /) || [])[1]) || soDangNoi;
  let mau = null;
  if (/ (anh khach|khach mac|anh that|hinh that|hinh khach|feedback) /.test(s)) mau = 'khach_mac'; // F-104
  else if (/ (bang size|bang co|size nao|chon size) /.test(s)) mau = 'bang_size';
  else if (/ video /.test(s)) mau = 'video';
  else if (/ (phoi|mac voi|mac cung) /.test(s)) mau = 'phoi_do';
  else if (/ (danh sach|tat ca san pham|cac mau|tat ca mau) /.test(s)) mau = 'danh_sach';
  else if (/ (chi tiet|chat lieu|vai) /.test(s)) mau = 'chi_tiet';
  else if (/ (trinh chieu|anh luot) /.test(s)) mau = 'trinh_chieu';
  // Màu: chữ sau "màu", so với đúng tên màu của sản phẩm ("màu xanh navy số 12" → "Xanh navy"); không rõ thì lấy một chữ.
  let mauSac = null;
  const sau = s.match(/ mau ([a-z][a-z ]*)/)?.[1]?.trim();
  if (sau) {
    const s1 = so ? sp.layTheoSo(so) : null;
    const g = s1 ? [...new Set(sp.phanLoaiCua(s1.id).map((p) => p.gt1))].sort((a, b) => b.length - a.length) : [];
    mauSac = g.find((x) => `${sau} `.startsWith(`${boDau(x)} `)) || sau.split(' ')[0];
    mau = mau || 'anh';
  }
  if (!mau && (/ (san pham|man hinh) /.test(s) || so)) mau = 'gioi_thieu';
  if (!mau) return null;
  return { chieu: { mau, so: mau === 'danh_sach' ? null : so, mau_sac: mauSac }, canh: 'san_pham' };
}

class ManHinhSanPham {
  /**
   * @param {object} o
   * @param {Function} o.phat
   * @param {object} [o.bus]   kênh sự kiện nội bộ (ws.js)
   * @param {number} [o.congMoza]
   * @param {object} [o.obs]   KetNoiObs (test thay bộ giả)
   */
  constructor({ phat, bus = null, congMoza = 5173, obs = null }) {
    Object.assign(this, { phat, congMoza });
    this.hien = { mau: 'cho', ten_mau: TEN_MAU.cho, shop: caiDat.tenShop(), luc: new Date().toISOString() };
    this.tayLuc = -Infinity; // lúc người dẫn chọn tay gần nhất
    this.canh = { hien: 'ca_hai', goi_y: null, mo_phong: true };
    this.henVe = null;
    this.henGoiY = null;
    this.obs = obs || new KetNoiObs({ layCauHinh: () => ({ cong: caiDat.doc('obs', {})?.cong || 4455, mat_khau: require('./khoa').layObs() }) });
    this.obs.on('doi_canh', (ten) => {
      const khoa = Object.entries(CANH).find(([, v]) => v === ten)?.[0];
      if (khoa) { this.canh.hien = khoa; this.baoCanh(); }
    });
    this.obs.on('thay_doi', () => this.baoCanh());
    this.nghe = (type, d) => { this.khiCoSuKien(type, d).catch(() => {}); };
    bus?.on('su_kien', this.nghe);
    this.bus = bus;
    this.henNoi = setInterval(() => { if (caiDat.doc('obs', {})?.bat && !this.obs.trangThai().ket_noi) this.obs.noi().catch(() => {}); }, 15000);
    this.henNoi.unref?.();
  }

  dong() {
    this.bus?.off('su_kien', this.nghe);
    clearInterval(this.henNoi);
    clearTimeout(this.henVe);
    clearTimeout(this.henGoiY);
    clearTimeout(this.henTiep);
    this.obs.dong();
  }

  cheDo() {
    const p = live.phienDangMo();
    return p && (p.doi_ai || (p.che_do_ai === 'noi' && p.mai_dan)) ? 'tu_chuyen' : 'goi_y';
  }

  trangThai() {
    return { hien: this.hien, nhan_ai: nhanAi(), tiep_theo: this.tiepTheo || null, canh: { ...this.canh, ten: TEN_CANH[this.canh.hien], che_do: this.cheDo(), obs: this.obs.trangThai() }, mau: MAU.map((m) => ({ id: m, ten: TEN_MAU[m] })) };
  }

  baoHien() { this.phat('mhsp.hien', this.hien); }
  baoCanh() { this.phat('canh.cap_nhat', this.trangThai().canh); }

  /**
   * Chiếu một nội dung. boi: 'nguoi' (thắng, giữ 20 giây) | 'ai' | 'tu_dong' (theo đoạn).
   * AI chiếu → gợi ý hoặc tự chuyển cảnh theo chế độ.
   */
  chieu(lenh, { boi = 'ai', lyDo = '' } = {}) {
    if (boi === 'tu_dong' && Date.now() - this.tayLuc < GIU_TAY_MS) return { bo_qua: true, ly_do: 'Người dẫn vừa chọn tay.' };
    const hien = dung(lenh);
    this.hien = { ...hien, boi };
    this.soDoHien = { chieu_cao: lenh.chieu_cao || null, can_nang: lenh.can_nang || null }; // để dựng lại đúng dòng tô (không gửi đi)
    if (boi === 'nguoi') this.tayLuc = Date.now();
    this.ghiNhatKy(`Chiếu ${String(hien.ten_mau || '').toLowerCase()}${hien.san_pham ? ` ${hien.san_pham.ten_goi} · ${hien.san_pham.gia}` : ''} (${({ nguoi: 'người dẫn', ai: 'AI', tu_dong: 'theo đoạn' })[boi] || boi})`, hien.san_pham?.so ? sp.layTheoSo(hien.san_pham.so)?.id : null);
    this.baoHien();
    // 8/10/2026: AI dẫn (tự chuyển cảnh) thì chiếu theo đoạn cũng lên cảnh Sản phẩm rồi tự về Cả hai — live có cả phòng live và màn hình sản phẩm.
    if (boi === 'ai' || (boi === 'tu_dong' && this.cheDo() === 'tu_chuyen')) this.saukhiAiChieu(hien, lyDo);
    return { hien: this.hien };
  }

  saukhiAiChieu(hien, lyDo) {
    if (this.canh.hien === 'san_pham') return;
    if (this.cheDo() === 'tu_chuyen') {
      this.chuyenCanh('san_pham', { boi: 'ai' }).catch(() => {});
      clearTimeout(this.henVe);
      this.henVe = setTimeout(() => { if (this.canh.hien === 'san_pham') this.chuyenCanh('ca_hai', { boi: 'ai' }).catch(() => {}); }, hien.mau === 'video' ? VE_CA_HAI_VIDEO_MS : VE_CA_HAI_MS);
    } else {
      this.goiY('san_pham', lyDo || `Mai vừa chiếu ${hien.ten_mau.toLowerCase()}${hien.san_pham ? ` số ${hien.san_pham.so}` : ''}`);
    }
  }

  /** F-80 (#108): màn hình / cảnh vào nhật ký của phiên đang mở. */
  ghiNhatKy(chu, sanPhamId = null) {
    let p = null;
    try { p = live.phienDangMo(); } catch { p = null; }
    if (p) require('./nghiep-vu/nhat-ky-song').ghi({ phienId: p.id, loai: 'man_hinh', noiDung: chu, sanPhamId });
  }

  /**
   * Dòng cảm ơn cuối buổi (F-83): "Cảm ơn Lan, Hoa, Trâm… đã chốt đơn buổi này" chạy ngang đáy Thanh chữ 45 giây. Chỉ tên gọi,
   * không món, không tiền; tối đa 40 tên; bỏ người ẩn danh / xin ẩn tên / xin dừng. Bật: nút 🙏, "Mai ơi cảm ơn cả nhà",
   * Đội AI chào kết, Mai dẫn chính nghe câu chào kết.
   * @returns {{ten:string[], giay:number}}
   */
  camOn(phienId = null) {
    let p = null;
    try { p = phienId ? live.layPhien(phienId) : live.phienDangMo(); } catch { p = null; }
    const cfg = { giay: 45, toi_da_ten: 40, ...(require('./cau-hinh/mac-dinh.json').tren_song?.cam_on || {}) };
    const lienHe = require('./nghiep-vu/lien-he');
    const ten = [];
    if (p) {
      for (const x of require('./nghiep-vu/bao-cao').nguoiChotTrongBuoi(p.id)) {
        if (x.nhan.includes('an_danh') || x.nhan.includes('an_ten')) continue;
        const an = lienHe.daAnTen(x.nguoi_fb_id) || lienHe.daNgung(x.nguoi_fb_id);
        const g = String(x.ten || '').trim().split(/\s+/).at(-1);
        if (!an && g && !ten.includes(g)) ten.push(g);
        if (ten.length >= cfg.toi_da_ten) break;
      }
    }
    const kq = { ten, giay: cfg.giay, phien_id: p?.id || null, luc: new Date().toISOString() };
    this.phat('mhsp.cam_on', kq);
    if (p) this.ghiNhatKy(`Cảm ơn người chốt: ${ten.length ? ten.join(', ') : '(chưa ai chốt)'}`);
    return kq;
  }

  goiY(canh, lyDo) {
    this.canh.goi_y = { canh, ten: TEN_CANH[canh], ly_do: lyDo, luc: new Date().toISOString() };
    clearTimeout(this.henGoiY);
    this.henGoiY = setTimeout(() => { this.canh.goi_y = null; this.baoCanh(); }, GOI_Y_HET_MS);
    this.baoCanh();
  }

  /** Chuyển cảnh lên sóng. OBS chưa nối → chỉ đổi trạng thái (mô phỏng), vẫn báo lên Màn hình người dẫn. */
  async chuyenCanh(canh, { boi = 'nguoi' } = {}) {
    if (!CANH[canh]) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Cảnh là Phòng live, Sản phẩm hoặc Cả hai.');
    this.canh.goi_y = null;
    clearTimeout(this.henGoiY);
    if (boi === 'nguoi') clearTimeout(this.henVe);
    let moPhong = true;
    let loi = null;
    if (caiDat.doc('obs', {})?.bat || this.obs.trangThai().ket_noi) {
      try { await this.obs.chuyenCanh(canh); moPhong = false; } catch (e) { loi = e.message; }
    }
    this.canh.hien = canh;
    this.canh.mo_phong = moPhong;
    this.ghiNhatKy(`Cảnh: ${TEN_CANH[canh]} (${boi === 'nguoi' ? 'người dẫn' : 'AI'})`);
    this.canh.loi = loi;
    this.baoCanh();
    // Người dẫn bấm "Sản phẩm" theo gợi ý: 20 giây sau gợi ý quay về Cả hai (người dẫn vẫn tự quyết).
    if (canh === 'san_pham' && boi === 'nguoi' && this.cheDo() === 'goi_y') {
      clearTimeout(this.henVe);
      this.henVe = setTimeout(() => { if (this.canh.hien === 'san_pham') this.goiY('ca_hai', 'Quay lại Cả hai?'); }, 20000);
    }
    return { canh, mo_phong: moPhong, loi };
  }

  /** Lệnh bằng lời của người dẫn (đã hiểu bằng docLenh). */
  async lamLenh(lenh) {
    const kq = {};
    if (lenh.chieu) kq.chieu = this.chieu(lenh.chieu, { boi: 'nguoi' });
    if (lenh.canh) kq.canh = await this.chuyenCanh(lenh.canh, { boi: 'nguoi' });
    if (lenh.cam_on) kq.cam_on = this.camOn();
    if (lenh.binh_chon) kq.binh_chon = require('./dich-vu').dichVu().binhChon.mo({ mau: lenh.binh_chon.mau });
    return kq;
  }

  /**
   * F-85: đoạn đang nói đã chạy 60 giây và đoạn kế có món Đang bán → Thanh chữ "Tiếp theo: váy số 15"; Đội AI đọc câu sap_toi
   * một lần mỗi đoạn. Người dẫn đổi đoạn thì tính lại.
   */
  henTiepTheo() {
    clearTimeout(this.henTiep);
    this.tiepTheo = null;
    this.phat('mhsp.tiep_theo', { chu: null });
    const p = live.phienDangMo();
    if (!p || p.trang_thai !== 'dang_live') return;
    const doanId = `${p.id}|${p.doan_hien_tai}`;
    const ms = (Number(require('./cau-hinh/mac-dinh.json').tiep_theo_sau_giay) || 60) * 1000;
    this.henTiep = setTimeout(() => {
      const q = live.phienDangMo();
      if (!q || `${q.id}|${q.doan_hien_tai}` !== doanId) return;
      const ke = q.kich_ban.doan[q.doan_hien_tai + 1];
      let s = null;
      try { s = ke?.san_pham_id ? sp.laySanPham(ke.san_pham_id) : null; } catch { s = null; }
      if (!s || s.trang_thai !== 'dang_ban') return;
      this.tiepTheo = { chu: `Tiếp theo: ${sp.tenGoi(s)}`, so: s.so };
      this.phat('mhsp.tiep_theo', this.tiepTheo);
      if (q.doi_ai) { try { require('./dich-vu').dichVu().doiAi?.chenBanHang(q.id, 'sap_toi', { mon_sau: sp.tenGoi(s) }); } catch { /* không có Đội AI */ } }
    }, ms);
    this.henTiep.unref?.();
  }

  async khiCoSuKien(type, d) {
    if (type === 'live.doan' || type === 'live.bat_dau') this.henTiepTheo();
    if (type === 'live.ket_thuc') { clearTimeout(this.henTiep); this.tiepTheo = null; this.phat('mhsp.tiep_theo', { chu: null }); }
    if (type === 'live.doan' || type === 'live.bat_dau') {
      const p = live.phienDangMo();
      const doan = p?.kich_ban.doan[p.doan_hien_tai];
      if (doan?.san_pham_id) { try { this.chieu({ mau: 'gioi_thieu', so: sp.laySanPham(doan.san_pham_id).so }, { boi: 'tu_dong', lyDo: 'Đoạn mới giới thiệu món' }); } catch { /* không chiếu được: giữ */ } }
      // Đoạn không gắn món (mở đầu, dạo quanh quầy, chào kết): AI dẫn thì camera kín khung — người xem nhìn thẳng vào quầy hàng.
      else if (doan && this.cheDo() === 'tu_chuyen' && Date.now() - this.tayLuc >= GIU_TAY_MS) { clearTimeout(this.henVe); this.chuyenCanh('phong', { boi: 'ai' }).catch(() => {}); }
    } else if (type === 'live.ket_thuc') {
      this.hien = dung({ mau: 'cho' });
      this.baoHien();
    } else if ((type === 'kho.cap_nhat' || type === 'live.chot' || type === 'live.nguoi_mau' || type === 'don.cap_nhat') && this.hien.san_pham) {
      // Còn bán được đổi: dựng lại đúng mẫu đang chiếu (gom 1 giây).
      clearTimeout(this.henLai);
      this.henLai = setTimeout(() => {
        try {
          const cu = this.hien;
          this.hien = { ...dung({ mau: cu.mau, so: cu.san_pham.so, mau_sac: cu.mau_sac, chieu_cao: this.soDoHien?.chieu_cao, can_nang: this.soDoHien?.can_nang, so_phoi: cu.san_pham_2?.so }), boi: cu.boi };
          this.baoHien();
        } catch { /* sản phẩm vừa ngừng bán: về màn chờ */ this.hien = dung({ mau: 'cho' }); this.baoHien(); }
      }, 1000);
      this.henLai.unref?.();
    }
    // F-104: ảnh khách bị gỡ / công tắc tắt trong lúc đang chiếu "Khách mặc thật" → dựng lại NGAY (không chờ); hết ảnh → giới thiệu món.
    if ((type === 'anh_khach.cap_nhat' || type === 'cai_dat.ban_hang') && this.hien.mau === 'khach_mac') {
      const so = this.hien.san_pham?.so;
      try { this.hien = { ...dung({ mau: 'khach_mac', so }), boi: this.hien.boi }; } catch {
        try { this.hien = dung({ mau: 'gioi_thieu', so }); } catch { this.hien = dung({ mau: 'cho' }); }
      }
      this.baoHien();
    }
    if (type === 'live.chot') this.phat('mhsp.chot', { ten: d.ten, mon: d.mon, luc: d.luc });
    // Nhãn AI đổi ngay khi phiên mở / đóng, đổi chế độ, đổi người phụ trách (F-75: ≤ 2 giây).
    if (['live.bat_dau', 'live.ket_thuc', 'live.trang_thai', 'live.che_do', 'cai_dat.ban_hang'].includes(type)) this.phat('mhsp.nhan_ai', nhanAi());
  }
}

/**
 * Nhãn AI trên hình (F-75, #103; Luật AI 134/2025 Điều 11): "Trợ lý AI · Phụ trách: …" (chưa điền người phụ trách: "Trợ lý AI của
 * {ten_shop}") hiện suốt khi có phiên đang mở (chờ live hoặc đang live) mà AI không "Tắt". CỐ Ý không có công tắc hay API nào
 * tắt nhãn này.
 */
function nhanAi() {
  const p = live.phienDangMo();
  const b = caiDat.banHang();
  return { hien: !!p && p.che_do_ai !== 'tat', chu: b.phu_trach ? `Trợ lý AI · Phụ trách: ${b.phu_trach}` : `Trợ lý AI của ${caiDat.tenShop()}` };
}

module.exports = { nhanAi, ManHinhSanPham, dung, docLenh, dongHop, theSanPham, MAU, TEN_MAU, TEN_CANH };
