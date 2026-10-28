'use strict';

/**
 * Chốt đơn từ bình luận live (SPEC.md F-53, F-68, #64/#98, #65/#97, #72, #77; Luồng 3 bản 3.4).
 *
 *  1. Bình luận mới (đã qua cửa `khi_tin_den`) → mã nhận ra chốt (nhan-chot.js). Câu có chữ báo mua mà mã không chắc → model rẻ
 *     đọc hộ (#77) — trừ khi "Dừng AI". Không phải chốt → Director như thường.
 *  2. GIỮ LƯỢT nhắn riêng của bình luận (F-65, luot_nhan_rieng) trước mọi đường khác.
 *  3. Đủ thông tin và còn hàng → giữ hàng, tạo / gộp đơn "Chờ xác nhận" của người đó trong buổi (một giao dịch — don.js).
 *     Giữ hai mức (#98): chưa bấm, chưa nhắn → tới hết live + N giờ; bấm / nhắn → đủ giờ giữ.
 *  4. Lên sóng (#72): tên gọi + món — tối đa 3 tên mỗi 30 giây. Không đọc tên người bình luận ẩn danh, xin "ẩn tên" hay xin dừng.
 *  5. Tin riêng đầu = THẺ GIỮ HÀNG DO MÃ SOẠN (F-68, #97) qua gui_the_moza: 0 lượt AI, 1–2 giây. Thiếu màu / size, hết hàng,
 *     ngừng bán, số không có → thẻ hỏi lại / báo hết kèm lựa chọn còn hàng — cũng do mã soạn.
 *  6. Không nhắn riêng được (can_reply_privately false, khách chặn Page) → gom tên vào MỘT bình luận công khai mỗi 2 phút, có
 *     link m.me của buổi (#65, #100). Page bị Meta khóa nhắn tin → câu gom riêng + danh sách Nhắn bù (F-73). Facebook giới hạn
 *     lượt gọi → hàng gửi lại tự động trong 7 ngày (F-67).
 *  Bình luận chốt có số điện thoại vẫn bị ẩn (#19), vẫn ghi nhận chốt; số không tự điền vào đơn.
 */

const live = require('./nghiep-vu/live');
const sp = require('./nghiep-vu/san-pham');
const kho = require('./nghiep-vu/kho');
const don = require('./nghiep-vu/don');
const hopThu = require('./nghiep-vu/hop-thu');
const caiDat = require('./nghiep-vu/cai-dat');
const luot = require('./nghiep-vu/luot-nhan-rieng');
const lienHe = require('./nghiep-vu/lien-he');
const nhanBu = require('./nghiep-vu/nhan-bu');
const fbPage = require('./nghiep-vu/fb-page');
const theGiu = require('./nghiep-vu/the-giu-hang');
const cm = require('./nghiep-vu/cau-mau-khach');
const guiThe = require('./gui-the-don');
const { docChot } = require('./nhan-chot');
const { LoiNghiepVu, hienTien } = require('./nghiep-vu/chung');

const DOC_MOI_MS = 30 * 1000;
const TEN_MOI_LAN = 3;
const GOM_CONG_KHAI_MS = 2 * 60 * 1000;
const GUI_LAI_MS = 30 * 1000; // thẻ gặp giới hạn gọi: thử lại sau chừng này
const TEN_AN_DANH = 'Một bạn';
const MO_TIN_SAU_MS = 4 * 60 * 1000; // F-70: thẻ đã tới mà khách im chừng này → nhắc trên sóng mở Tin nhắn chờ
const NHAC_MO_TIN_MS = 60 * 1000; // hai lượt nhắc mở tin cách nhau ít nhất chừng này
const CACH_CHOT_MS = 5 * 60 * 1000; // hai lần nhắc cách chốt cách nhau ít nhất 5 phút
const IB_CACH_MS = 5 * 60 * 1000; // "ib": mỗi người một thẻ mỗi 5 phút
const NHAN_BU_CACH_MS = 20 * 1000; // F-73: nhắn bù rải 3 tin mỗi phút

/** Tên gọi trên sóng (#72): chữ cuối của tên Facebook ("Nguyễn Thị Lan" → "Lan"). */
function tenGoi(ten) {
  const ds = String(ten || '').trim().split(/\s+/).filter(Boolean);
  return ds.at(-1) || 'bạn';
}

/** "áo số 12 màu Đen size M" — cách đọc món trên sóng. */
function tenMon(s, pl) {
  const goi = sp.tenGoi(s);
  const phan = [`${goi}`];
  if (pl.gt1 && pl.gt1 !== 'Mặc định') phan.push(`${String(s.nhom?.t1 || 'màu').toLowerCase()} ${pl.gt1}`);
  if (pl.gt2) phan.push(`${String(s.nhom?.t2 || 'size').toLowerCase() === 'cỡ' ? 'size' : String(s.nhom?.t2).toLowerCase()} ${pl.gt2}`);
  return phan.join(' ');
}

/** Lỗi gửi mà nhắn riêng hẳn không được → gom công khai. */
const KHONG_NHAN_RIENG = new Set(['FB_KHONG_NHAN_RIENG_DUOC', 'FB_NGUOI_KHONG_NHAN_DUOC', 'DA_NHAN_RIENG', 'QUA_7_NGAY', 'FB_CHUA_DUYET']);

class ChotDon {
  /**
   * @param {object} o
   * @param {Function} o.phat
   * @param {() => object} [o.layHopThu]  dịch vụ Hộp thư tự động (không còn dùng cho tin đầu — thẻ do mã soạn)
   * @param {object} [o.phongAi]       để đọc tên lên sóng qua miệng / Đội AI
   * @param {Function} [o.layKetNoi]
   * @param {object} [o.nhaCungCap]    AI giả (test)
   */
  constructor({ phat, layHopThu = null, phongAi = null, layKetNoi = null, nhaCungCap = null, docMoiMs = DOC_MOI_MS, gomMs = GOM_CONG_KHAI_MS, guiLaiMs = GUI_LAI_MS,
    moTinSauMs = MO_TIN_SAU_MS, nhacMoTinMs = NHAC_MO_TIN_MS, cachChotMs = CACH_CHOT_MS, ibCachMs = IB_CACH_MS }) {
    Object.assign(this, { phat, layHopThu, phongAi, layKetNoi, nhaCungCap, docMoiMs, gomMs, guiLaiMs, moTinSauMs, nhacMoTinMs, cachChotMs, ibCachMs });
    this.nhacMoTinCuoi = new Map(); // phienId → lúc nhắc mở tin gần nhất
    this.cachChotCuoi = new Map(); // phienId → lúc nhắc cách chốt gần nhất
    this.nguoiXem = new Map(); // phienId → [{ luc, n }] (live_views hỏi mỗi phút)
    this.nhanBuDang = null; // { tong, da_gui, bo, loi, dung_vi } lượt nhắn bù người bấm đang chạy
    this.choDoc = []; // { phienId, ten, mon }
    this.docCuoi = 0;
    this.gom = new Map(); // phienId → [{ hoiThoaiId, ten, luc, kieu }]
    this.hen = null;
    this.dangGui = new Set(); // lời gửi thẻ đang chạy (test chờ xong)
  }

  batDau() {
    this.hen = setInterval(() => {
      this.docTrenSong();
      try { this.nhacMoTin(); this.nhacCachChot(); } catch (e) { console.error('  [chốt đơn] nhắc trên sóng lỗi: ' + e.message); }
      this.nhipSoLieu = (this.nhipSoLieu || 0) + 1;
      if (this.nhipSoLieu % 2 === 0) { try { this.baoSoLieu(); } catch { /* chưa có phiên */ } }
      this.guiGomCongKhai().catch(() => {});
      this.guiLaiGioiHan().catch(() => {});
    }, 5000);
    this.hen.unref?.();
  }

  dung() {
    clearInterval(this.hen);
    this.choDoc = [];
    this.gom.clear();
  }

  /** Chờ mọi thẻ đang gửi xong (test). */
  async choXong(toiDaMs = 5000) {
    const het = Date.now() + toiDaMs;
    while (this.dangGui.size && Date.now() < het) await new Promise((r) => setTimeout(r, 5));
  }

  /** Sản phẩm để so bình luận: mọi sản phẩm (để báo "đã ngừng bán"), kèm phân loại. */
  dsSanPham() {
    return sp.danhSach().map((x) => {
      const s = sp.laySanPham(x.id);
      return { ...s, phan_loai: sp.phanLoaiCua(x.id) };
    });
  }

  /** Được đọc tên người này lên sóng / hiện tên trên hình không (ẩn danh, xin ẩn tên, xin dừng — F-66). */
  duocDocTen(bl, nguoiFbId) {
    if (bl.nhan?.includes('an_danh') || bl.nhan?.includes('an_ten')) return false;
    return !lienHe.daAnTen(nguoiFbId) && !lienHe.daNgung(nguoiFbId);
  }

  /**
   * Xử lý một bình luận live. Trả true nếu đó là bình luận chốt (đã xử lý ở đây, không cần Director).
   * @param {object} bl  dòng binh_luan_live
   * @param {object} p   phiên live
   */
  async xuLy(bl, p, { xemLai = false } = {}) {
    if (p.che_do_ai === 'tat' && !xemLai) return false;
    const ds = this.dsSanPham();
    const soDangNoi = bl.so_doan ?? null;
    let r = docChot(bl.noi_dung, { dsSanPham: ds, soDangNoi });
    if (!r.la_chot) {
      // F-71: câu hỏi có ý mua ("12 đen M còn ko") → thẻ mời giữ một chạm; bình luận vẫn tới Director (trả lời trên sóng).
      if (r.la_hoi_mua && !xemLai) await this.guiTheMoi(bl, p, r.mon[0]).catch((e) => console.error('  [chốt đơn] thẻ mời lỗi: ' + e.message));
      return false;
    }
    if (!r.chac_chan && r.mon.length === 1 && !r.mon[0].thieu.includes('so_khong_co')) r = await this.docHo(bl, p, ds, soDangNoi, r);
    if (!r.la_chot) return false;

    live.ganChot(bl.id, { xuLy: 'da_tu_van' });
    // Hội thoại riêng với người chốt (kênh bình luận live); thẻ nhắn riêng từ đây — MỘT bình luận MỘT tin (Meta).
    const { hoiThoai: h } = hopThu.tuBinhLuanLive(bl, p);
    const lg = luot.giu({ fbCommentId: bl.fb_id, pageId: h.page_id, boi: 'the_giu_hang', binhLuanId: bl.id, hoiThoaiId: h.id });
    const ketQua = [];
    let donHien = don.donMoTrongPhien(h.nguoi_fb_id, p.id);
    for (const m of r.mon) {
      if (!m.phan_loai) { ketQua.push({ m, loi: { ma: m.thieu.includes('so_khong_co') ? 'KHONG_TIM_THAY' : 'THIEU_PHAN_LOAI', thong_diep: m.ly_do } }); continue; }
      try {
        // F-93: giá bán lúc bình luận (giá live chỉ khi công tắc bật, món có giá live, bình luận trong giờ live + độ trễ phát).
        const g = require('./nghiep-vu/gia-ban').giaBanLucNay(m.san_pham, m.phan_loai, { phienId: p.id, luc: bl.luc_fb });
        const gia = g.la_gia_live ? { donGia: g.gia, giaThuong: g.gia_thuong } : {};
        if (donHien) donHien = don.themMon(donHien.id, m.phan_loai.id, m.so_luong, gia);
        else {
          donHien = don.taoDon({
            mon: [{ phan_loai_id: m.phan_loai.id, so_luong: m.so_luong, don_gia: gia.donGia, gia_thuong: gia.giaThuong }], nguon: 'binh_luan_live', pageId: h.page_id, nguoiFbId: h.nguoi_fb_id,
            khachId: h.khach_id, hoiThoaiId: h.id, phienLiveId: p.id, binhLuanId: bl.id, dienTap: p.dien_tap,
          });
        }
        ketQua.push({ m, ok: true });
      } catch (e) {
        if (!(e instanceof LoiNghiepVu)) throw e;
        ketQua.push({ m, loi: { ma: e.ma, thong_diep: e.message } });
      }
    }
    const daGiu = ketQua.filter((x) => x.ok);
    // F-106: khoảng Mai nói nhầm giá đang mở → áp giá Mai nói ngay sau khi giữ hàng, trước khi nhắn riêng (tin đầu đúng giá).
    if (donHien && daGiu.length && !xemLai) {
      try { if (require('./nghiep-vu/gia-noi-nham').apChoDonMoi(donHien.id, { phienId: p.id }).length) donHien = don.layDon(donHien.id); } catch (e) { console.error(`  [chốt đơn] giá nói nhầm: ${e.message}`); }
    }
    const docTen = this.duocDocTen(bl, h.nguoi_fb_id);
    // F-88: số khách lỡ ghi ở bình luận chốt (đã ẩn — #19) → chỉ lưu làm gợi ý [Dùng số 0912***678], không tự điền.
    if (donHien && daGiu.length) { const so = require('./nghiep-vu/nhan-binh-luan').laySdt(bl.noi_dung); if (so) don.datSdtGoiY(donHien.id, so); }
    if (daGiu.length && xemLai) {
      // F-94: chốt trên video xem lại — không đọc tên trên sóng, không "Vừa chốt", không báo tồn trên sóng.
      live.ganChot(bl.id, { donId: donHien.id, xuLy: 'da_chot' });
      this.phat('don.cap_nhat', { don_id: donHien.id });
    } else if (daGiu.length) {
      live.ganChot(bl.id, { donId: donHien.id, xuLy: 'da_chot' });
      const mon = daGiu.map((x) => `${tenMon(x.m.san_pham, x.m.phan_loai)}${x.m.so_luong > 1 ? ` x${x.m.so_luong}` : ''}`).join(', ');
      // F-91: nhãn "khách quen · hay mặc M" chỉ cho Màn hình người dẫn (không Thanh chữ, không miệng, không Đội AI).
      this.phat('live.chot', { phien_id: p.id, ten: docTen ? tenGoi(bl.ten) : TEN_AN_DANH, mon, don: { id: donHien.id, ma: donHien.ma }, luc: new Date().toISOString(),
        nhan_khach: h.khach_id ? require('./nghiep-vu/khach').nhanKhach(h.khach_id) : null,
        nhan_hoan: h.khach_id ? require('./nghiep-vu/khach').nhanHoan(h.khach_id) : null }); // F-118: chỉ người dẫn thấy
      this.phat('don.cap_nhat', { don_id: donHien.id });
      // Lên sóng đọc tên món, không đọc "x2" (tiếng đọc máy đọc lạ). Không đọc tên người xin ẩn tên / ẩn danh (F-66, L9).
      if (docTen) this.choDoc.push({ phienId: p.id, ten: tenGoi(bl.ten), mon: daGiu.map((x) => tenMon(x.m.san_pham, x.m.phan_loai)).join(', ') });
      this.baoTon(p, daGiu.map((x) => x.m));
      this.docMocChot(p, daGiu.map((x) => x.m.san_pham));
    }
    this.phat('kho.cap_nhat', {});
    this.phat('live.binh_luan_cap_nhat', { phien_id: p.id, binh_luan: live.layBinhLuan(bl.id) });
    // F-94: buổi có giá live cho món → thẻ ghi rõ giá live đã kết thúc (đơn tính giá hiện tại).
    const ghiChuGia = xemLai ? this.ghiChuGiaLiveHet(p, daGiu.map((x) => x.m.san_pham)) : null;
    if (lg.thang) {
      const viec = this.guiTheChot({ h, p, bl, d: donHien, ketQua, ghiChuGia }).catch((e) => console.error('  [chốt đơn] gửi thẻ lỗi: ' + e.message));
      this.dangGui.add(viec);
      viec.finally(() => this.dangGui.delete(viec));
    }
    return true;
  }

  /** Mã không chắc (#77): model rẻ đọc hộ với danh sách phân loại; lỗi AI thì giữ kết quả của mã (thẻ hỏi lại). */
  async docHo(bl, p, ds, soDangNoi, r) {
    // F-72: "Dừng AI" → không gọi model đọc hộ; câu mơ hồ thì thẻ hỏi lại bằng mã.
    if (caiDat.dungAi().bat || caiDat.khanCap()) return r;
    try {
      const { docChotAi } = require('./agent/agents/doc-chot');
      const trongPhien = new Set(live.sanPhamTrongPhien(p.id));
      const dsPhien = ds.filter((x) => trongPhien.has(x.id) && x.trang_thai === 'dang_ban');
      const ph = await docChotAi(bl.noi_dung, dsPhien.length ? dsPhien : ds.filter((x) => x.trang_thai === 'dang_ban'),
        { phienLiveId: p.id, dienTap: p.dien_tap, soDangNoi, ten: bl.ten, nhaCungCap: this.nhaCungCap });
      if (!ph) return r;
      if (!ph.la_chot) return { la_chot: false, chac_chan: false, mon: [], ly_do: 'Model đọc hộ: không phải chốt.' };
      const s = ds.find((x) => x.so === (ph.so || soDangNoi));
      const pl = s?.phan_loai.find((x) => !x.bo && x.gt1 === ph.gt1 && (x.gt2 || '') === (ph.gt2 || ''));
      if (!ph.chac_chan || !s || !pl) return r;
      return { la_chot: true, chac_chan: true, mon: [{ so: s.so, san_pham: s, phan_loai: pl, gt1: pl.gt1, gt2: pl.gt2, so_luong: Math.max(1, ph.so_luong || 1), thieu: [], ly_do: 'Model đọc hộ.' }], ly_do: 'Model đọc hộ.' };
    } catch {
      return r;
    }
  }

  /**
   * F-83 (#111): số người chốt một món vượt mốc 5 / 10 / 20 / 50 → Đội AI câu dem_chot, Mai đọc nguyên văn (mỗi mốc một lần mỗi
   * món). Chỉ gợi ý: chỉ Thanh chữ. Không bao giờ nói "đã bán".
   */
  docMocChot(p, dsSp) {
    const moc = require('./cau-hinh/mac-dinh.json').tren_song?.moc_doc || [5, 10, 20, 50];
    this.mocDaDoc = this.mocDaDoc || new Map();
    for (const s of [...new Map(dsSp.filter(Boolean).map((x) => [x.id, x])).values()]) {
      const n = require('./nghiep-vu/bao-cao').demNguoiChot(p.id, s.id);
      const k = `${p.id}|${s.id}`;
      const daDoc = this.mocDaDoc.get(k) || 0;
      const vuot = moc.filter((m) => n >= m && m > daDoc).at(-1);
      if (!vuot) continue;
      this.mocDaDoc.set(k, vuot);
      const mon = sp.tenGoi(s);
      this.phat('live.dem_chot', { phien_id: p.id, so: s.so, nguoi_chot: n, moc: vuot });
      this.noiTrenSong(p, 'dem_chot', { mon, so: n }, (m) => m.noiNguyenVan?.(`${n} người đã chốt ${mon} buổi này.`));
    }
  }

  /** Sau khi giữ: phân loại vừa hết → báo và câu "vừa hết"; còn ≤ ngưỡng → câu "còn ít"; miệng nhận cập nhật tồn (#81). */
  baoTon(p, cacMon) {
    const nguong = caiDat.banHang().nguong_sap_het;
    const dong = [];
    for (const m of cacMon) {
      const con = kho.conHang(m.san_pham.id).find((x) => x.id === m.phan_loai.id)?.con_ban_duoc ?? 0;
      const ten = tenMon(m.san_pham, m.phan_loai);
      if (con <= 0) {
        dong.push(`${sp.tenGoi(m.san_pham)} ${sp.nhanPl(m.phan_loai)} vừa hết.`);
        if (p.doi_ai) this.phongAi?.doiAi?.chenBanHang(p.id, 'vua_het', { mon: ten });
      } else if (con <= nguong) {
        dong.push(`${sp.tenGoi(m.san_pham)} ${sp.nhanPl(m.phan_loai)} còn ${con}.`);
        if (p.doi_ai) this.phongAi?.doiAi?.chenBanHang(p.id, 'con_it', { mon: ten, so: con });
      }
    }
    if (dong.length) {
      this.phongAi?.mieng?.capNhatTon(dong.join(' '));
      try { this.phongAi?.bao(`Tồn vừa đổi: ${dong.join(' ')}`); } catch { /* không có live */ }
    }
  }

  /** Đọc tên người vừa chốt lên sóng (#72): tối đa 3 tên mỗi 30 giây. */
  docTrenSong(bayGio = Date.now()) {
    if (!this.choDoc.length || bayGio - this.docCuoi < this.docMoiMs) return;
    const phienId = this.choDoc[0].phienId;
    const lan = this.choDoc.filter((x) => x.phienId === phienId).slice(0, TEN_MOI_LAN);
    this.choDoc = this.choDoc.filter((x) => !lan.includes(x));
    let p;
    try { p = live.layPhien(phienId); } catch { return; }
    if (p.trang_thai !== 'dang_live') return;
    this.docCuoi = bayGio;
    const ten = lan.map((x) => x.ten).join(', ');
    const mon = [...new Set(lan.map((x) => x.mon))].join('; ');
    if (p.doi_ai) {
      this.phongAi?.doiAi?.chenBanHang(phienId, 'vua_chot', { ten, mon });
    } else if (p.che_do_ai === 'noi' && this.phongAi?.miengSanSang?.(p)) {
      this.phongAi.mieng.baoVuaChot?.(lan.map((x) => `${x.ten} vừa chốt ${x.mon}`).join('; '));
    }
    // Chế độ "Chỉ gợi ý": Màn hình người dẫn đã hiện dòng "Vừa chốt" từ sự kiện live.chot — người dẫn tự đọc.
  }

  /** Phiên live đang phát mà AI được nói (nhắc trên sóng). */
  phienDangPhat() {
    const p = live.phienDangMo();
    return p && p.trang_thai === 'dang_live' && p.che_do_ai !== 'tat' ? p : null;
  }

  /** Nói một câu bán hàng lên sóng theo chế độ: Đội AI (câu mẫu), Mai (miệng), Chỉ gợi ý (Màn hình người dẫn tự hiện). */
  noiTrenSong(p, khoa, bien, mieng) {
    if (p.doi_ai) return this.phongAi?.doiAi?.chenBanHang(p.id, khoa, bien) ?? false;
    if (p.che_do_ai === 'noi' && this.phongAi?.miengSanSang?.(p)) { mieng(this.phongAi.mieng); return true; }
    return false;
  }

  /**
   * F-70: người đã nhận thẻ riêng ≥ 4 phút mà chưa bấm hay nhắn → mỗi lượt gọi tối đa 3 tên, câu trung tính ("shop đã nhắn riêng
   * rồi nè, xem giúp shop mục Tin nhắn chờ"). Mỗi đơn một lần (Hook giới hạn liên hệ: goi_ten), bỏ người ẩn danh / xin ẩn tên /
   * xin dừng. Chế độ Chỉ gợi ý: Màn hình người dẫn hiện dòng chữ to (sự kiện live.nhac_mo_tin).
   * @returns {string[]|null} tên đã nhắc
   */
  nhacMoTin(bayGio = Date.now()) {
    const p = this.phienDangPhat();
    if (!p || bayGio - (this.nhacMoTinCuoi.get(p.id) || 0) < this.nhacMoTinMs) return null;
    const lan = [];
    for (const x of luot.choPhanHoi(p.id, new Date(bayGio - this.moTinSauMs).toISOString())) {
      if (x.nhan.includes('an_danh') || x.nhan.includes('an_ten') || !lienHe.duocGoiTen({ nguoiFbId: x.nguoi_fb_id, donId: x.don_id })) continue;
      const ten = tenGoi(x.ten);
      if (!lan.some((y) => y.ten === ten)) lan.push({ ...x, ten });
      if (lan.length >= TEN_MOI_LAN) break;
    }
    if (!lan.length) return null;
    this.nhacMoTinCuoi.set(p.id, bayGio);
    for (const x of lan) lienHe.ghi({ nguoiFbId: x.nguoi_fb_id, donId: x.don_id, phienLiveId: p.id, loai: 'goi_ten' });
    const ten = lan.map((x) => x.ten);
    this.phat('live.nhac_mo_tin', { phien_id: p.id, ten, luc: new Date(bayGio).toISOString() });
    this.noiTrenSong(p, 'mo_tin_nhan', { ten: ten.join(', ') }, (m) => m.nhacMoTin?.(ten.join(', ')));
    return ten;
  }

  /** F-85: "23 người chốt · 17 đã trả lời tin · 9 đã xác nhận · 140 người xem" — 10 giây một lần. */
  soLieu(p) {
    const x = require('./nghiep-vu/bao-cao').soLieuPhien(p.id);
    const xem = (this.nguoiXem.get(p.id) || []).at(-1)?.n ?? null;
    return { phien_id: p.id, ...x, nguoi_xem: xem };
  }

  baoSoLieu() {
    const p = this.phienDangPhat();
    if (p) this.phat('live.so_lieu', this.soLieu(p));
  }

  /** live_views mới nhất của phiên (phòng live hỏi Facebook mỗi phút) — để nhắc cách chốt khi người xem tăng. */
  ghiNguoiXem(phienId, n, bayGio = Date.now()) {
    if (n == null || !Number.isFinite(Number(n))) return;
    const ds = (this.nguoiXem.get(phienId) || []).filter((x) => bayGio - x.luc < 10 * 60e3);
    ds.push({ luc: bayGio, n: Number(n) });
    this.nguoiXem.set(phienId, ds);
  }

  /**
   * F-70: nhắc cách chốt đúng lúc — (a) ≥ 3 người bình luận lần đầu trong 3 phút, hoặc người xem tăng ≥ 20% trong 3 phút;
   * (b) món đang nói có ≥ 3 câu hỏi trong 2 phút mà 0 người chốt. Hai lần cách nhau ≥ 5 phút; Đội AI tính vào trần câu chen.
   * @returns {string|null} lý do đã nhắc
   */
  nhacCachChot(bayGio = Date.now()) {
    const p = this.phienDangPhat();
    if (!p || bayGio - (this.cachChotCuoi.get(p.id) || 0) < this.cachChotMs) return null;
    const sl = live.soLieuGanDay(p.id, { tuNguoiMoi: new Date(bayGio - 3 * 60e3).toISOString(), tuCauHoi: new Date(bayGio - 2 * 60e3).toISOString() });
    const xem = this.nguoiXem.get(p.id) || [];
    const cu = xem.filter((x) => bayGio - x.luc >= 3 * 60e3).at(-1);
    const moi = xem.at(-1);
    const monHoi = sl.mon.find((m) => m.hoi >= 3 && m.chot === 0);
    let lyDo = null;
    if (sl.nguoi_moi >= 3) lyDo = 'nguoi_moi';
    else if (cu && moi && cu.n > 0 && moi.n >= cu.n * 1.2) lyDo = 'nguoi_xem_tang';
    else if (monHoi) lyDo = 'hoi_nhieu_chua_chot';
    if (!lyDo) return null;
    // Ví dụ: món bị hỏi nhiều → món của đoạn đang nói → món đầu kịch bản.
    const doan = p.kich_ban?.doan || [];
    const spId = monHoi?.san_pham_id || doan[p.doan_hien_tai]?.san_pham_id || doan.find((d) => d.san_pham_id)?.san_pham_id || null;
    const vd = viDuChot(spId);
    if (!vd) return null;
    this.cachChotCuoi.set(p.id, bayGio);
    this.phat('live.nhac_cach_chot', { phien_id: p.id, ly_do: lyDo, vi_du: vd.chu, luc: new Date(bayGio).toISOString() });
    this.noiTrenSong(p, 'nhac_cach_chot', { vi_du: vd.chu, so_mau: vd.so }, (m) => m.nhacCachChot?.(vd.chu));
    return lyDo;
  }

  /**
   * F-70: bình luận "ib / check ib / inbox / nt / chưa thấy tin / giá sao" — nhắn riêng lại qua CHÍNH bình luận mới (mỗi bình luận
   * một lượt, lượt the_ib): có đơn trong buổi → thẻ giữ hàng hiện tại; chưa có → thẻ chọn màu, size của món đang nói; không có
   * món đang nói → chữ + các món trong buổi. Mỗi người một thẻ mỗi 5 phút. "ib" không cần Director; "giá sao" thì nơi gọi vẫn đưa
   * Director để trả lời trên sóng.
   * @returns {Promise<boolean>} đã xử lý
   */
  async xuLyIb(bl, p) {
    if (p.che_do_ai === 'tat') return false;
    const { hoiThoai: h } = hopThu.tuBinhLuanLive(bl, p);
    if (lienHe.demTheoNguoi(h.nguoi_fb_id, 'ib', new Date(Date.now() - this.ibCachMs).toISOString()) > 0) return true;
    const d = don.donMoTrongPhien(h.nguoi_fb_id, p.id);
    let the;
    if (d && d.trang_thai === 'cho_xac_nhan') {
      const dong = d.dong.at(-1);
      const s = sp.laySanPham(dong.san_pham_id);
      const pl = kho.conHang(s.id).find((y) => y.id === dong.phan_loai_id) || sp.phanLoaiCua(s.id).find((y) => y.id === dong.phan_loai_id);
      the = theGiu.theGiuHang(d, { p, pl, s, dienTap: p.dien_tap });
    } else if (d) {
      the = { kieu: 'chu', chu: cm.cau('ib_co_don') };
    } else {
      const id = bl.so_doan != null ? sp.danhSach().find((x) => x.so === bl.so_doan)?.id : null;
      let s = null;
      try { s = id ? sp.laySanPham(id) : null; } catch { s = null; }
      if (s && s.trang_thai === 'dang_ban' && kho.conHang(s.id).some((x) => x.con_ban_duoc > 0)) the = theGiu.theChonPhanLoai({ s, p, bl: bl.id, dienTap: p.dien_tap });
      else {
        const nhanh = theGiu.nhanhMonTrongPhien(p);
        the = { kieu: 'chu', chu: cm.cau('ib_chua_mon'), ...(nhanh.length ? { tra_loi_nhanh: nhanh } : {}) };
      }
    }
    const lg = luot.giu({ fbCommentId: bl.fb_id, pageId: h.page_id, boi: 'the_ib', binhLuanId: bl.id, hoiThoaiId: h.id });
    if (!lg.thang) return true;
    lienHe.ghi({ nguoiFbId: h.nguoi_fb_id, donId: d?.id || null, phienLiveId: p.id, loai: 'ib' });
    // 'ib' trơn: xong ở đây. 'giá sao': để nguyên cho Director trả lời trên sóng.
    if (!bl.nhan?.includes('ib_gia')) live.datXuLy(p.id, [bl.id], 'da_tu_van');
    this.phat('live.binh_luan_cap_nhat', { phien_id: p.id, binh_luan: live.layBinhLuan(bl.id) });
    const viec = this.guiTheRieng({ h, p, bl, the, donId: d?.id || null, boi: 'the_ib', khoaTien: 'the_ib', gomKhiLoi: !!d })
      .catch((e) => console.error('  [chốt đơn] thẻ ib lỗi: ' + e.message));
    this.dangGui.add(viec);
    viec.finally(() => this.dangGui.delete(viec));
    return true;
  }

  /**
   * F-71: câu hỏi có ý mua → thẻ mời "Áo 12 Đen/M · 159.000đ · còn hàng" [Giữ cho mình] [Xem màu khác] qua nhắn riêng bình luận đó
   * (lượt the_moi). KHÔNG tự giữ hàng. Chỉ gửi khi: còn hàng; người đó chưa có đơn mở chứa phân loại này; chưa được mời món này
   * trong buổi; không có tin riêng nào tới người đó trong 5 phút; còn lượt nhắn riêng của bình luận.
   * @returns {Promise<boolean>} đã gửi (hoặc đang gửi)
   */
  async guiTheMoi(bl, p, m) {
    if (p.che_do_ai === 'tat' || !m?.phan_loai || !m.san_pham) return false;
    const s = sp.laySanPham(m.san_pham.id);
    if (s.trang_thai !== 'dang_ban') return false;
    const pl = kho.conHang(s.id).find((y) => y.id === m.phan_loai.id);
    if (!pl || pl.con_ban_duoc <= 0) return false;
    const { hoiThoai: h } = hopThu.tuBinhLuanLive(bl, p);
    if (don.donMoTrongPhien(h.nguoi_fb_id, p.id)?.dong.some((x) => x.phan_loai_id === pl.id)) return false;
    if (luot.daMoi({ phienId: p.id, nguoiFbId: h.nguoi_fb_id, sanPhamId: s.id })) return false;
    const ids = [h.id, ...hopThu.hoiThoaiMessengerCua({ nguoiFbId: h.nguoi_fb_id })];
    if (luot.ganDayCuaHoiThoai(ids, new Date(Date.now() - 5 * 60e3).toISOString()).some((x) => x.fb_comment_id !== bl.fb_id)) return false;
    const lg = luot.giu({ fbCommentId: bl.fb_id, pageId: h.page_id, boi: 'the_moi', binhLuanId: bl.id, hoiThoaiId: h.id, chiTiet: { san_pham_id: s.id, phan_loai_id: pl.id } });
    if (!lg.thang) return false;
    const the = require('./nghiep-vu/the-moi').theMoi({ s, pl, p, dienTap: p.dien_tap });
    const viec = this.guiTheRieng({ h, p, bl, the, boi: 'the_moi', khoaTien: 'the_moi', gomKhiLoi: false })
      .catch((e) => console.error('  [chốt đơn] thẻ mời lỗi: ' + e.message));
    this.dangGui.add(viec);
    viec.finally(() => this.dangGui.delete(viec));
    return true;
  }

  /**
   * Phép thử "chốt test" (F-77): chủ shop bình luận "chốt test" bằng tài khoản cá nhân sau khi live gắn vào phiên → KHÔNG tạo đơn,
   * không đụng kho; nhắn riêng một tin thử (lượt chot_test) để kiểm đường chốt, nhắn riêng và hộp nhận tin. Bảng Sẵn sàng báo kết quả.
   */
  async xuLyChotTest(bl, p) {
    const { hoiThoai: h } = hopThu.tuBinhLuanLive(bl, p);
    live.datXuLy(p.id, [bl.id], 'bo_qua');
    const lg = luot.giu({ fbCommentId: bl.fb_id, pageId: h.page_id, boi: 'chot_test', binhLuanId: bl.id, hoiThoaiId: h.id });
    const gio = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    let kq = { da_gui: false, ma: 'DA_NHAN_RIENG', ly_do: 'Bình luận này đã được nhắn riêng.' };
    if (lg.thang) {
      kq = await guiThe.guiMoza({ h, dich: 'nhan_rieng', the: { kieu: 'chu', chu: cm.cau('chot_test', { gio }) }, mucDich: 'the_dau',
        khoa: `chot_test:${bl.fb_id}`, binhLuanFbId: bl.fb_id, layKetNoi: this.layKetNoi || (() => null) });
    }
    const ketQua = kq.da_gui ? 'da_gui' : kq.cho_duyet ? 'cho_duyet' : 'loi';
    require('./san-sang').ghiChotTest(p.id, { ten: bl.ten, ket_qua: ketQua, ly_do: ketQua === 'loi' ? (kq.ly_do || kq.ma || null) : null });
    this.phat('live.san_sang', { phien_id: p.id });
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
    return true;
  }

  /** Thẻ cho kết quả của một bình luận chốt (đủ món → thẻ giữ hàng; không thì thẻ hỏi lại / báo hết). */
  theCho({ p, bl, d, ketQua, khachId = null }) {
    const dienTap = p.dien_tap;
    const ok = ketQua.filter((x) => x.ok);
    if (ok.length && d) {
      const m = ok.at(-1).m;
      return theGiu.theGiuHang(don.layDon(d.id), { p, pl: m.phan_loai, s: m.san_pham, dienTap });
    }
    const x = ketQua[0];
    const s = x?.m?.san_pham;
    const sl = x?.m?.so_luong || 1;
    if (x?.loi?.ma === 'THIEU_PHAN_LOAI' && s) {
      const sizeQuen = khachId ? require('./nghiep-vu/khach').sizeQuen(khachId, s.danh_muc) : null; // F-91
      return theGiu.theChonPhanLoai({ s, gt1: x.m.gt1 || null, p, sl, bl: bl.id, dienTap, sizeQuen });
    }
    if ((x?.loi?.ma === 'HET_HANG' || x?.loi?.ma === 'KHONG_DU_HANG') && s) {
      const con = kho.conHang(s.id).find((y) => y.id === x.m.phan_loai.id)?.con_ban_duoc ?? 0;
      return theGiu.theHetHang({ s, pl: x.m.phan_loai, p, sl, bl: bl.id, con: x.loi.ma === 'KHONG_DU_HANG' ? con : 0, choDuoc: true });
    }
    if (x?.loi?.ma === 'SP_KHONG_BAN_DUOC' && s) return theGiu.theKhongBan({ s, p });
    return theGiu.theKhongBan({ so: x?.m?.so ?? null, p });
  }

  /**
   * Gửi thẻ giữ hàng (hoặc thẻ hỏi lại) làm tin riêng duy nhất của bình luận (F-68). Lỗi thì lùi: ảnh hỏng → thẻ chữ có nút;
   * không nhắn riêng được → gom công khai; Page bị khóa → nhắn bù (người quyết); giới hạn gọi → gửi lại tự động.
   */
  /** "Giá live đã kết thúc lúc 21:30 ngày 26/9" nếu buổi có giá live cho một món vừa chốt (F-94). */
  ghiChuGiaLiveHet(p, dsSp) {
    const gb = require('./nghiep-vu/gia-ban');
    if (!p.ket_thuc || !dsSp.some((s) => gb.giaLiveCua(p.id, s.id) != null)) return null;
    const t = new Date(new Date(p.ket_thuc).getTime() + 7 * 3600e3);
    const hai = (n) => String(n).padStart(2, '0');
    return require('./nghiep-vu/cau-mau-khach').cau('gia_live_da_het', { luc: `${hai(t.getUTCHours())}:${hai(t.getUTCMinutes())} ngày ${t.getUTCDate()}/${t.getUTCMonth() + 1}` });
  }

  async guiTheChot({ h, p, bl, d, ketQua, ghiChuGia = null }) {
    let the = this.theCho({ p, bl, d, ketQua, khachId: h.khach_id });
    if (ghiChuGia && the) {
      // Thẻ ảnh: phụ đề ≤ 80 ký tự; dài quá thì thành thẻ chữ có nút (vẫn đủ nút).
      if (the.kieu === 'anh') {
        const pd = `${ghiChuGia} · ${the.phu_de}`;
        the = pd.length <= 80 ? { ...the, phu_de: pd } : theGiu.theChuCoNut({ tieu_de: the.tieu_de, phu_de: `${ghiChuGia}\n${the.phu_de}`, nut: the.nut });
      } else if (the.kieu === 'nut' || the.kieu === 'chu') the = { ...the, chu: `${the.chu}\n${ghiChuGia}`.slice(0, the.kieu === 'nut' ? 640 : 2000) };
    }
    return this.guiTheRieng({ h, p, bl, the, donId: d?.id || null, boi: 'the_giu_hang' });
  }

  async guiTheRieng({ h, p, bl, the, donId = null, boi = 'the_giu_hang', khoaTien = 'the_giu', gomKhiLoi = true }) {
    const layKetNoi = this.layKetNoi || (() => null);
    if (fbPage.biCam(h.page_id)) return this.khiPageBiCam({ h, p, bl, donId });
    const gui = (t, k) => guiThe.guiMoza({ h, dich: 'nhan_rieng', the: t, mucDich: 'the_dau', khoa: k, binhLuanFbId: bl.fb_id, donId, layKetNoi });
    let kq = await gui(the, `${khoaTien}:${bl.fb_id}`);
    if (!kq.da_gui && !kq.cho_duyet && the.kieu === 'anh' && kq.ma && !KHONG_NHAN_RIENG.has(kq.ma) && !['FB_PAGE_BI_CAM_NHAN', 'PAGE_BI_HAN_CHE', 'FB_GIOI_HAN_GOI', 'FB_MAT_MANG'].includes(kq.ma)) {
      // Ảnh không tới được Meta (đường hầm đổi, ảnh lỗi) → thẻ chữ có nút: vẫn đủ nút, vẫn tự nhận AI.
      luot.giu({ fbCommentId: bl.fb_id, pageId: h.page_id, boi, binhLuanId: bl.id, hoiThoaiId: h.id });
      kq = await gui(theGiu.theChuCoNut(the), `${khoaTien}_chu:${bl.fb_id}`);
    }
    this.phat('hop_thu.cap_nhat', { hoi_thoai_id: h.id });
    if (kq.da_gui || kq.cho_duyet || kq.trung) {
      this.phat('live.the', { phien_id: p.id, binh_luan_id: bl.id, ket_qua: kq.da_gui ? 'da_gui' : kq.cho_duyet ? 'cho_duyet' : 'trung' });
      return kq;
    }
    if (kq.ma === 'FB_PAGE_BI_CAM_NHAN' || kq.ma === 'PAGE_BI_HAN_CHE') {
      if (fbPage.datBiCam(h.page_id, true, 'Meta báo Page bị tạm khóa nhắn tin (10/1893063)')) this.phat('ket_noi.trang_thai', {});
      return this.khiPageBiCam({ h, p, bl, donId });
    }
    // Ứng dụng Meta chưa duyệt quyền nhắn tin (chỉ người có vai trò nhận được): bảng Sẵn sàng hiện dòng đỏ 7 ngày (F-77).
    if (kq.ma === 'FB_CHUA_DUYET') caiDat.ghi('fb_chua_duyet', { luc: new Date().toISOString() });
    if (kq.ma === 'FB_GIOI_HAN_GOI') {
      // Đông người chốt, Facebook giới hạn lượt gọi: hàng gửi lại (không rơi thẳng về gom công khai — L13).
      luot.loi(bl.fb_id);
      nhanBu.them({ fbCommentId: bl.fb_id, binhLuanId: bl.id, donId, pageId: h.page_id, ten: bl.ten, lyDo: 'gioi_han_goi', binhLuanLuc: bl.luc_fb, dienTap: p.dien_tap });
      this.phat('live.the', { phien_id: p.id, binh_luan_id: bl.id, ket_qua: 'cho_gui_lai' });
      return kq;
    }
    // Không nhắn riêng được (khách chặn, Facebook không cho, ứng dụng chưa duyệt…) → gom tên công khai có link m.me (#65).
    // Thẻ "ib" của người chưa có đơn thì thôi (câu gom nói "đã giữ hàng" — không đúng với họ).
    if (!gomKhiLoi) { luot.loi(bl.fb_id); return kq; }
    this.themGom(p, h, bl, 'thuong');
    this.phat('live.the', { phien_id: p.id, binh_luan_id: bl.id, ket_qua: 'gom_cong_khai', ly_do: kq.ly_do });
    return kq;
  }

  /** Page bị Meta khóa nhắn tin (F-73): không thử nhắn riêng; tên vào câu gom riêng; bình luận vào danh sách Nhắn bù. */
  khiPageBiCam({ h, p, bl, donId }) {
    luot.loi(bl.fb_id);
    nhanBu.them({ fbCommentId: bl.fb_id, binhLuanId: bl.id, donId, pageId: h.page_id, ten: bl.ten, lyDo: 'page_bi_cam', binhLuanLuc: bl.luc_fb, dienTap: p.dien_tap });
    this.themGom(p, h, bl, 'page_bi_khoa');
    this.phat('live.the', { phien_id: p.id, binh_luan_id: bl.id, ket_qua: 'nhan_bu' });
    this.phat('don.nhan_bu', {});
    return { da_gui: false, ma: 'PAGE_BI_HAN_CHE' };
  }

  themGom(p, h, bl, kieu) {
    const ds = this.gom.get(p.id) || [];
    ds.push({ hoiThoaiId: h.id, ten: this.duocDocTen(bl, h.nguoi_fb_id) ? tenGoi(bl.ten) : null, luc: Date.now(), kieu, pageId: h.page_id });
    this.gom.set(p.id, ds);
  }

  /**
   * Gom tên người chốt mà nhắn riêng không được vào MỘT bình luận công khai mỗi 2 phút (#65). Không số, không địa chỉ, không
   * tiền. Câu thường có link m.me của buổi (#100); Page bị khóa nhắn tin thì câu riêng, không mời nhắn Page (F-73).
   */
  async guiGomCongKhai(bayGio = Date.now()) {
    for (const [phienId, ds] of this.gom) {
      if (!ds.length || bayGio - ds[0].luc < this.gomMs) continue;
      this.gom.set(phienId, []);
      for (const kieu of ['page_bi_khoa', 'thuong']) {
        const nhom = ds.filter((x) => x.kieu === kieu);
        if (!nhom.length) continue;
        const coTen = [...new Set(nhom.map((x) => x.ten).filter(Boolean))].slice(0, 10);
        const ten = coTen.length ? `${coTen.join(', ')}${nhom.some((x) => !x.ten) ? ' và các bạn' : ''}` : 'Các bạn vừa chốt';
        const link = fbPage.linkMme(nhom[0].pageId, phienId);
        const noiDung = kieu === 'page_bi_khoa' ? cm.cau('gom_page_bi_khoa', { ten }) : cm.cau('gom_cong_khai', { ten, link });
        const { thucHienCongCu } = require('./agent/thuc-hien');
        await thucHienCongCu({
          ten: 'tra_loi_binh_luan',
          thamSo: { noi_dung: noiDung, trich_dan: [] },
          nguCanh: { hoiThoaiId: nhom.at(-1).hoiThoaiId, layKetNoi: this.layKetNoi, guiBoi: 'he_thong', khoaChongTrung: `gom:${phienId}:${kieu}:${bayGio}` },
        }).catch(() => {});
      }
    }
  }

  /**
   * Người bấm "Nhắn bù" (F-73): gửi lần lượt, cách nhau ≥ 20 giây (3 tin / phút); gặp lại Page bị khóa thì dừng hẳn. Chạy nền —
   * trạng thái ở `nhanBuDang`, báo qua sự kiện 'don.nhan_bu'.
   * @param {string[]} ids  dòng nhan_bu
   */
  async nhanBuNhieu(ids, { cachMs = NHAN_BU_CACH_MS, ngu = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    if (this.nhanBuDang && !this.nhanBuDang.xong) throw new LoiNghiepVu('DANG_NHAN_BU', 'Đang nhắn bù lượt trước, chờ xong rồi bấm tiếp.', 409);
    const st = { tong: ids.length, da_gui: 0, bo: 0, dung_vi: null, xong: false };
    this.nhanBuDang = st;
    this.phat('don.nhan_bu', st);
    let dau = true;
    for (const id of ids) {
      const x = nhanBu.lay(id);
      if (!x || x.trang_thai !== 'cho') { st.bo += 1; continue; }
      if (!dau) await ngu(cachMs);
      dau = false;
      const kq = await this.nhanBuMot(x).catch((e) => ({ da_gui: false, ma: 'LOI', ly_do: e.message }));
      if (kq.da_gui || kq.cho_duyet) st.da_gui += 1;
      else st.bo += 1;
      this.phat('don.nhan_bu', st);
      if (kq.ma === 'PAGE_BI_HAN_CHE' || kq.ma === 'FB_PAGE_BI_CAM_NHAN') { st.dung_vi = 'Meta vẫn khóa nhắn tin của Page: dừng nhắn bù.'; break; }
    }
    st.xong = true;
    this.phat('don.nhan_bu', st);
    this.phat('don.cap_nhat', {});
    return st;
  }

  /** Thẻ gặp giới hạn gọi (F-67): gửi lại tự động, hạn 7 ngày tính từ lúc bình luận. */
  async guiLaiGioiHan(bayGio = Date.now()) {
    for (const x of nhanBu.danhSach({ lyDo: 'gioi_han_goi' })) {
      if (bayGio - new Date(x.tao_luc).getTime() < this.guiLaiMs) continue;
      await this.nhanBuMot(x);
    }
  }

  /**
   * Nhắn bù một người (F-73 người bấm, hoặc gửi lại sau giới hạn gọi): đơn còn chờ → thẻ giữ hàng; đơn đã hủy → thẻ mời giữ
   * nếu còn hàng; chưa có đơn → thẻ chọn phân loại. Gặp lại Page bị khóa thì dừng (trả mã).
   * @returns {Promise<{da_gui:boolean, ma?:string, ly_do?:string}>}
   */
  async nhanBuMot(x) {
    let bl;
    let p;
    try { bl = live.layBinhLuan(x.binh_luan_id); p = live.layPhien(bl.phien_id); } catch { nhanBu.dat(x.id, 'bo', 'Không còn bình luận gốc.'); return { da_gui: false, ma: 'KHONG_TIM_THAY' }; }
    if (new Date(x.han_luc).getTime() <= Date.now()) { nhanBu.dat(x.id, 'het_han'); return { da_gui: false, ma: 'QUA_7_NGAY' }; }
    const { hoiThoai: h } = hopThu.tuBinhLuanLive(bl, p);
    const lg = luot.giu({ fbCommentId: bl.fb_id, pageId: h.page_id, boi: 'nhan_bu', binhLuanId: bl.id, hoiThoaiId: h.id });
    if (!lg.thang) { nhanBu.dat(x.id, 'bo', 'Bình luận đã được nhắn riêng.'); return { da_gui: false, ma: 'DA_NHAN_RIENG' }; }
    let the;
    const d = x.don_id ? (() => { try { return don.layDon(x.don_id); } catch { return null; } })() : null;
    if (d && d.trang_thai === 'cho_xac_nhan') {
      const dong = d.dong.at(-1);
      const s = sp.laySanPham(dong.san_pham_id);
      the = theGiu.theGiuHang(d, { p, pl: kho.conHang(s.id).find((y) => y.id === dong.phan_loai_id), s, dienTap: p.dien_tap });
    } else if (d) {
      // Đơn đã hủy (quá giờ) → thẻ mời giữ lại nếu còn hàng (F-71).
      const dong = d.dong[0];
      const s = sp.laySanPham(dong.san_pham_id);
      const pl = kho.conHang(s.id).find((y) => y.id === dong.phan_loai_id);
      if (!pl || pl.con_ban_duoc < dong.so_luong) { luot.loi(bl.fb_id); nhanBu.dat(x.id, 'bo', 'Món đã hết hàng.'); return { da_gui: false, ma: 'HET_HANG' }; }
      the = require('./nghiep-vu/the-moi').theMoi({ s, pl, p, dienTap: p.dien_tap });
    } else {
      const r = docChot(bl.noi_dung, { dsSanPham: this.dsSanPham(), soDangNoi: bl.so_doan ?? null });
      const m = r.mon[0];
      the = m?.san_pham ? theGiu.theChonPhanLoai({ s: m.san_pham, gt1: m.gt1 || null, p, bl: bl.id, dienTap: p.dien_tap }) : theGiu.theKhongBan({ p });
    }
    const kq = await this.guiTheRieng({ h, p, bl, the, donId: d?.id || null, boi: 'nhan_bu', khoaTien: `nhan_bu:${x.id}` });
    if (kq.da_gui || kq.cho_duyet) nhanBu.dat(x.id, 'da_gui');
    else if (kq.ma !== 'FB_GIOI_HAN_GOI' && kq.ma !== 'PAGE_BI_HAN_CHE') nhanBu.dat(x.id, 'bo', kq.ly_do || kq.ma);
    return kq;
  }
}

/**
 * Câu chốt mẫu của một món (F-70 nhắc cách chốt, F-77 câu ghim): "chốt 12 đen M" với phân loại còn hàng đầu tiên.
 * @returns {{chu:string, so:number}|null}
 */
function viDuChot(sanPhamId) {
  if (!sanPhamId) return null;
  let s;
  try { s = sp.laySanPham(sanPhamId); } catch { return null; }
  const pl = kho.conHang(s.id).find((x) => x.con_ban_duoc > 0) || sp.phanLoaiCua(s.id)[0];
  const phan = [`chốt ${s.so}`];
  if (pl?.gt1 && pl.gt1 !== 'Mặc định') phan.push(String(pl.gt1).toLowerCase());
  if (pl?.gt2) phan.push(pl.gt2);
  return { chu: phan.join(' '), so: s.so };
}

module.exports = { ChotDon, tenGoi, tenMon, hienTien, viDuChot, TEN_AN_DANH };
