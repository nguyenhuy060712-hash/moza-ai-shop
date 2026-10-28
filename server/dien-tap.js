'use strict';

/**
 * Chạy kịch bản bình luận soạn sẵn của Phòng diễn tập (SPEC.md F-15).
 * Bình luận được đưa vào Facebook giả đúng nhịp thời gian, như người xem thật đang gõ.
 * {so}, {ten_sp}, {goi}, {mau}, {mau2}, {co}, {co2}, {mau_la} được thay theo sản phẩm của đoạn đang nói lúc bình luận được gửi.
 * Bản 2.5 (F-39): bước `noi` (người dẫn giả nói một câu) và `hoi_thoai` (người dẫn và khách mời nói) có tiếng thật,
 * đi vào đường micro của MOZA. Gemini TTS đọc mất vài giây nên tiếng được làm sẵn ngay lúc kịch bản bắt đầu.
 */

const DANH_SACH = require('./cau-hinh/kich-ban-dien-tap.json').kich_ban;
const live = require('./nghiep-vu/live');
const { LoiNghiepVu } = require('./nghiep-vu/chung');

class DienTap {
  /**
   * @param {object} o
   * @param {object} o.fb  Facebook giả
   * @param {(cau:string) => void} [o.hoiMai]  bước "người dẫn hỏi Mai" của kịch bản
   * @param {object} [o.nguoiDongVai]  để báo trạng thái chung của Phòng diễn tập
   * @param {object} [o.tiengGia]  tieng-gia.js: người dẫn giả nói có tiếng (bản 2.5)
   */
  constructor({ fb, phat, hoiMai = null, nguoiDongVai = null, tiengGia = null }) {
    this.fb = fb;
    this.phat = phat;
    this.hoiMai = hoiMai;
    this.nguoiDongVai = nguoiDongVai;
    this.tiengGia = tiengGia;
    this.dangChay = null; // { id, ten, hen: [], con }
  }

  danhSach() {
    return DANH_SACH.map((k) => ({ id: k.id, ten: k.ten, mo_ta: k.mo_ta, loai: k.loai || 'live', so_binh_luan: k.binh_luan.length,
      co_tieng: k.binh_luan.some((b) => b.noi || b.hoi_thoai),
      giay: Math.max(...k.binh_luan.map((b) => b.sau_giay)) }));
  }

  /** Làm sẵn tiếng cho các bước nói của kịch bản (không phát). Lỗi thì báo lên Phòng diễn tập, kịch bản vẫn chạy. */
  lamTiengSan(kb) {
    const san = new Map();
    for (const b of kb.binh_luan) {
      let viec = null;
      if (b.noi) viec = this.tiengGia?.lam({ chu: this.dienMau(b.noi) });
      else if (b.hoi_thoai) {
        viec = this.tiengGia?.lamHoiThoai({ luot: b.hoi_thoai.map((l) => ({ vai: l.vai, chu: this.dienMau(l.chu) })) });
      }
      if (!viec) continue;
      viec.catch((e) => this.phat('dien_tap.tieng_gia', { loi: e.message }));
      san.set(b, viec);
    }
    return san;
  }

  trangThai() {
    return {
      ...this.fb.trangThai(),
      kich_ban_dang_chay: this.dangChay ? { id: this.dangChay.id, ten: this.dangChay.ten, con: this.dangChay.con } : null,
      nguoi_dong_vai: this.nguoiDongVai?.trangThai() ?? null,
    };
  }

  // Sản phẩm của đoạn đang nói trong phiên đang mở (hoặc món đầu kịch bản, hoặc món Đang bán đầu tiên), để câu giả nhắc đúng món.
  sanPhamDangNoi() {
    const sp = require('./nghiep-vu/san-pham');
    const p = live.phienDangMo();
    const d = p?.kich_ban.doan[p.doan_hien_tai];
    const id = d?.san_pham_id || p?.kich_ban.doan.find((x) => x.san_pham_id)?.san_pham_id || sp.mucLucDangBan()[0]?.id;
    try { return id ? sp.laySanPham(id) : null; } catch { return null; }
  }

  // Người xem gọi món bằng số (#60): "chốt 12 đen M". Màu, cỡ lấy từ ô còn hàng của món để câu chốt giả hợp lệ.
  dienMau(chu) {
    const sp = require('./nghiep-vu/san-pham');
    const x = this.sanPhamDangNoi();
    const con = x ? require('./nghiep-vu/kho').conHang(x.id).filter((p) => p.con_ban_duoc > 0) : [];
    const mau = [...new Set(con.map((p) => p.gt1))];
    const co = [...new Set(con.map((p) => p.gt2).filter(Boolean))];
    const bien = {
      so: x?.so ?? 1, ten_sp: x?.ten ?? 'mẫu này', goi: x ? sp.danhMuc(x.danh_muc)?.goi || 'mẫu' : 'áo',
      mau: mau[0] || 'đen', mau2: mau[1] || mau[0] || 'trắng', co: co[0] || 'M', co2: co[1] || co[0] || 'L', mau_la: 'tím than',
      // F-105 "Mai nói nhầm số": giá − 10.000đ (viết kiểu nói "149k"), còn + 3 của ô đầu.
      gia_sai: x ? `${Math.round((x.gia - 10000) / 1000)}k` : '99k', con_sai: String((con[0]?.con_ban_duoc ?? 2) + 3),
    };
    return String(chu).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(bien, k) ? String(bien[k]) : m));
  }

  chay(id) {
    const kb = DANH_SACH.find((k) => k.id === id);
    if (!kb) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có kịch bản diễn tập này.', 404);
    // Kịch bản Messenger không cần live giả: khách giả nhắn thẳng vào Page giả.
    if (kb.loai !== 'messenger' && !this.fb.trangThai().dang_phat) {
      throw new LoiNghiepVu('KHONG_CO_LIVE_GIA', 'Bấm "Bắt đầu live giả" trước khi chạy kịch bản.', 409);
    }
    if (kb.binh_luan.some((b) => b.noi || b.hoi_thoai) && !this.tiengGia) {
      throw new LoiNghiepVu('GIONG_LOI', 'Chưa bật được tiếng người dẫn giả.', 409);
    }
    this.dung();
    const dang = { id: kb.id, ten: kb.ten, hen: [], con: kb.binh_luan.length };
    this.dangChay = dang;
    const tiengSan = this.lamTiengSan(kb);
    for (const b of kb.binh_luan) {
      dang.hen.push(setTimeout(() => {
        try {
          if (tiengSan.has(b)) {
            // Làm tiếng lỗi thì đã báo lúc làm; phát lỗi (live vừa tắt…) thì báo ở đây.
            tiengSan.get(b).then(
              (doan) => this.tiengGia.phatVao(doan).catch((e) => this.phat('dien_tap.tieng_gia', { id: doan.id, loi: e.message })),
              () => {},
            );
          } else if (b.hoi_mai) this.hoiMai?.(this.dienMau(b.hoi_mai));
          else if (b.nguoi_xem != null) this.fb.datNguoiXem(b.nguoi_xem); // F-116: người xem tụt
          else if (b.nhan_tin) this.fb.khachNhan({ page_id: b.page_id, ten: b.ten, noi_dung: this.dienMau(b.nhan_tin) });
          else if (b.binh_luan_bai) this.fb.khachBinhLuanBai({ page_id: b.page_id, ten: b.ten, noi_dung: this.dienMau(b.binh_luan_bai) });
          else this.fb.themBinhLuan({ ten: b.ten, noi_dung: this.dienMau(b.noi_dung), an_danh: !!b.an_danh, la_page: !!b.la_page });
        } catch {
          // Live giả vừa tắt giữa chừng, hoặc AI đang tắt: bỏ bước này.
        }
        dang.con -= 1;
        if (dang.con <= 0 && this.dangChay === dang) this.dangChay = null;
        this.phat('dien_tap.trang_thai', this.trangThai());
      }, b.sau_giay * 1000));
    }
    this.phat('dien_tap.trang_thai', this.trangThai());
    return this.trangThai();
  }

  dung() {
    if (!this.dangChay) return this.trangThai();
    for (const h of this.dangChay.hen) clearTimeout(h);
    this.dangChay = null;
    this.phat('dien_tap.trang_thai', this.trangThai());
    return this.trangThai();
  }
}

module.exports = { DienTap };
