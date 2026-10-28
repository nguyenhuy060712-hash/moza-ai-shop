'use strict';

/**
 * Tư vấn size bằng mã, gọi đúng tên người hỏi (SPEC.md F-82, #110) — không gọi AI, không có SQL.
 * Bình luận có số đo ("1m58 50kg mặc size gì") + món (số trong bình luận, không có thì món đang nói) có bảng size:
 *  - khớp đúng 1 dòng → "{ten} ơi, theo bảng size của shop thì lấy M" (+ ", bạn mẫu 1m60 đang mặc S" nếu có);
 *  - 2 dòng liền nhau → "{ten} nằm giữa M và L theo bảng size của shop: thích mặc ôm thì M, thích thoải mái thì L";
 *  - 0 dòng, > 2 dòng, món chưa có bảng size → không tự khuyên (Director / Co-host như cũ).
 * Câu KHÔNG BAO GIỜ có số đo của khách; luôn có "theo bảng size của shop". Gom người hỏi cùng món trong 20 giây: người đầu được
 * trả lời ngay, người sau gom thành một câu (≤ 3 tên). Bình luận đã trả lời → 'da_goi_y' (Director không giao Co-host lần nữa).
 * Lên sóng: Chỉ gợi ý → ô gợi ý (qua Bộ kiểm tra); Đội AI → câu mẫu; Mai → đọc đúng nguyên văn. Chiếu bảng size tô dòng khớp.
 */

const sp = require('./nghiep-vu/san-pham');
const live = require('./nghiep-vu/live');
const bangSize = require('./nghiep-vu/bang-size');
const lienHe = require('./nghiep-vu/lien-he');
const { docSoDo } = require('./nghiep-vu/so-do');
const { dongHop } = require('./man-hinh-san-pham');
const nguoiMau = require('./nguoi-mau');

const MAC = () => ({ gom_giay: 20, toi_da_ten: 3, ...(require('./cau-hinh/mac-dinh.json').tu_van_size || {}) });

function tenGoi(ten) {
  return String(ten || '').trim().split(/\s+/).filter(Boolean).at(-1) || '';
}

class TuVanSize {
  constructor({ phat, phongAi = null, layManHinh = null, gomMs = null }) {
    const m = MAC();
    Object.assign(this, { phat, phongAi, layManHinh, gomMs: gomMs ?? m.gom_giay * 1000, toiDaTen: m.toi_da_ten });
    this.cua = new Map(); // sanPhamId → { mo: lúc mở cửa gom, cho: [{ten, co, bl}], hen }
  }

  dung() {
    for (const x of this.cua.values()) clearTimeout(x.hen);
    this.cua.clear();
  }

  /** Món được hỏi: số nhắc trong bình luận (trong buổi), không có thì món đang nói. */
  monCua(bl, p) {
    const ds = [...new Map(p.kich_ban.doan.filter((d) => d.san_pham_id).map((d) => { try { const s = sp.laySanPham(d.san_pham_id); return [s.id, s]; } catch { return [d.san_pham_id, null]; } })).values()].filter(Boolean);
    const { theoSo, theoTen } = sp.sanPhamDuocNhac(bl.noi_dung, ds);
    const x = theoSo[0] || theoTen[0];
    if (x) return sp.laySanPham(x.id);
    if (bl.so_doan != null) return sp.layTheoSo(bl.so_doan);
    const d = p.kich_ban.doan[p.doan_hien_tai];
    return d?.san_pham_id ? sp.laySanPham(d.san_pham_id) : null;
  }

  /**
   * Xem một bình luận. @returns {boolean} true nếu MOZA đã (hoặc sẽ, trong câu gom) trả lời bằng mã — Director bỏ qua bình luận này.
   */
  /** Bình luận có số đo + món có bảng size khớp 1 dòng / 2 dòng liền nhau → {s, b, co, soDo}; không thì null. */
  khop(bl, p) {
    const soDo = docSoDo(bl.noi_dung);
    if (!soDo) return null;
    let s;
    try { s = this.monCua(bl, p); } catch { s = null; }
    if (!s || s.trang_thai !== 'dang_ban' || !s.bang_size_id) return null;
    let b;
    try { b = bangSize.layBang(s.bang_size_id); } catch { return null; }
    const khop = dongHop(b, { chieuCao: soDo.chieu_cao, canNang: soDo.can_nang });
    let co = null;
    if (khop.length === 1) co = [khop[0]];
    else if (khop.length === 2) {
      const i = b.hang.findIndex((h) => h.co === khop[0]);
      if (b.hang[i + 1]?.co === khop[1]) co = khop;
    }
    return co ? { s, b, co, soDo } : null;
  }

  /**
   * F-115 chạm để trả lời: soạn câu tư vấn size cho MỘT bình luận (bằng mã, không gom, không đưa lên sóng — thẻ gợi ý để người dẫn
   * chọn Mai nói / Tự đọc). Chạy cả khi "Dừng AI". @returns {{cau, trichDan, so}|null}
   */
  soanCau(bl, p) {
    const k = this.khop(bl, p);
    if (!k) return null;
    const ds = [{ ten: this.tenCua(bl), co: k.co }];
    const cau = this.cau(k.s, ds, p.id);
    return { cau, trichDan: this.trichDan(p, k.s, k.b, ds, cau), so: k.s.so, soDo: k.soDo };
  }

  nhan(bl, p) {
    if (!p || p.che_do_ai === 'tat' || bl.da_an) return false;
    const k = this.khop(bl, p);
    if (!k) return false;
    const { s, b, co, soDo } = k;
    const ten = this.tenCua(bl);
    live.datXuLy(p.id, [bl.id], 'da_goi_y');
    const cua = this.cua.get(s.id);
    const bayGio = Date.now();
    if (!cua || bayGio - cua.mo >= this.gomMs) {
      // Người đầu: trả lời ngay (Đội AI thì gom đủ 20 giây rồi đọc MỘT câu có tới 3 tên), mở cửa gom.
      const c = { mo: bayGio, cho: p.doi_ai ? [{ ten, co }] : [], hen: null };
      this.cua.set(s.id, c);
      if (!p.doi_ai) this.noi(p, s, b, [{ ten, co }], soDo);
      c.hen = setTimeout(() => this.xa(p.id, s.id), this.gomMs);
      c.hen.unref?.();
    } else {
      cua.cho.push({ ten, co });
    }
    return true;
  }

  /** Hết 20 giây: người hỏi trong lúc đó gom thành một câu (≤ 3 tên). */
  xa(phienId, sanPhamId) {
    const c = this.cua.get(sanPhamId);
    this.cua.delete(sanPhamId);
    if (!c?.cho.length) return;
    let p;
    let s;
    let b;
    try { p = live.layPhien(phienId); s = sp.laySanPham(sanPhamId); b = bangSize.layBang(s.bang_size_id); } catch { return; }
    if (p.trang_thai !== 'dang_live') return;
    this.noi(p, s, b, c.cho.slice(0, this.toiDaTen), null);
  }

  tenCua(bl) {
    if (bl.nhan?.includes('an_danh') || bl.nhan?.includes('an_ten')) return '';
    try {
      const n = require('./nghiep-vu/hop-thu').nguoiCuaBinhLuan(bl, live.layPhien(bl.phien_id));
      if (lienHe.daAnTen(n.id)) return '';
    } catch { /* dùng tên bình luận */ }
    return tenGoi(bl.ten);
  }

  /** Câu máy soạn (không số đo khách). */
  cau(s, ds, phienId) {
    const mau = (() => {
      const co = nguoiMau.dangMac(phienId, s.id);
      const n = nguoiMau.nguoiMau();
      return co && n?.chieu_cao && !n.an ? `, bạn mẫu ${nguoiMau.caoChu(n.chieu_cao)} đang mặc ${co}` : '';
    })();
    const rong = /rong|oversize/i.test(require('./nghiep-vu/chung').boDau(String(s.thong_so?.kieu_dang || ''))) ? ' (form vốn rộng)' : '';
    if (ds.length === 1) {
      const { ten, co } = ds[0];
      if (co.length === 1) return `${ten ? `${ten} ơi, theo` : 'Theo'} bảng size của shop thì lấy ${co[0]}${mau}.`;
      return `${ten || 'Bạn'} nằm giữa ${co[0]} và ${co[1]} theo bảng size của shop: thích mặc ôm thì ${co[0]}, thích thoải mái thì ${co[1]}${rong}${mau}.`;
    }
    const phan = ds.map(({ ten, co }) => (co.length === 1 ? `${ten || 'một bạn'} lấy ${co[0]}` : `${ten || 'một bạn'} ${co[0]} hoặc ${co[1]}`));
    return `Theo bảng size của shop: ${phan.join(', ')}${mau}.`;
  }

  /** Trích dẫn cho Bộ kiểm tra: dòng bảng size của các cỡ khuyên (+ dòng người mẫu khi câu có "bạn mẫu"). */
  trichDan(p, s, b, ds, cau) {
    const coDung = [...new Set(ds.flatMap((x) => x.co))];
    const dongBang = bangSize.dongChoAi(b).filter((d) => coDung.some((co) => d.startsWith(`Size ${co}:`)));
    return [...dongBang.map((d) => ({ nguon: String(s.so), doan: d })),
      ...(/bạn mẫu/.test(cau) ? nguoiMau.dongNguon(p.id).filter((d) => d.includes(sp.tenGoi(s))).slice(0, 1).map((d) => ({ nguon: 'nguoi_mau', doan: d })) : [])];
  }

  /** Đưa câu lên sóng theo chế độ + chiếu bảng size tô đúng dòng. */
  noi(p, s, b, ds, soDo) {
    const cau = this.cau(s, ds, p.id);
    const trichDan = this.trichDan(p, s, b, ds, cau);
    let da = false;
    if (p.doi_ai) {
      const khoa = ds.length > 1 ? 'tu_van_size_gom' : ds[0].co.length === 1 ? 'tu_van_size' : 'tu_van_size_giua';
      const bien = { ten: ds.map((x) => x.ten).filter(Boolean).join(', ') || 'Bạn', co: ds[0].co[0], co1: ds[0].co[0], co2: ds[0].co[1] || ds[0].co[0], cau };
      da = !!this.phongAi?.doiAi?.chenBanHang(p.id, khoa, bien);
    } else if (p.che_do_ai === 'noi' && this.phongAi?.miengSanSang?.(p)) {
      this.phongAi.mieng?.noiNguyenVan?.(cau);
      da = true;
    } else {
      // Chỉ gợi ý: qua Bộ kiểm tra như câu Co-host, rồi hiện ở ô gợi ý.
      const { kiemTraCau } = require('./agent/kiem-tra/kiem-tra');
      const kt = kiemTraCau({ cau, trich_dan: trichDan, kenh: 'song', soDuocGiao: s.so, phienLiveId: p.id });
      if (kt.dat) {
        try { this.phongAi?.hienGoiY({ loai: 'cohost', cau, trichDan, cauHoi: 'Tư vấn size (MOZA tính theo bảng size)', so: s.so }); da = true; } catch { /* hết live */ }
      } else {
        this.phat('live.tu_van_size_loi', { phien_id: p.id, cau, loi: kt.loi });
      }
    }
    try { this.layManHinh?.()?.chieu({ mau: 'bang_size', so: s.so, chieu_cao: soDo?.chieu_cao || null, can_nang: soDo?.can_nang || null }, { boi: 'ai', lyDo: 'Tư vấn size' }); } catch { /* không chiếu được */ }
    this.phat('live.tu_van_size', { phien_id: p.id, so: s.so, cau, da_noi: da });
    return cau;
  }
}

module.exports = { TuVanSize };
