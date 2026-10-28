'use strict';

/**
 * AI của phòng live (F-16, F-17, F-18): nối bình luận live với Director và Co-host.
 *
 *  - Bình luận mới (đã qua hook `khi_tin_den`, không bị ẩn) → gom vài giây → Director đọc một lượt.
 *    Director đang chạy thì bình luận mới chờ lượt sau; mỗi bình luận chỉ đưa cho Director một lần.
 *  - Làm theo phiếu của Director bằng đúng công cụ của Director (luật quyền, hook, nhật ký).
 *  - Giao Co-host → phiếu {cau, trich_dan} → `de_xuat_cau_song` (Bộ kiểm tra) → Màn hình người dẫn.
 *    Bị chặn thì Co-host soạn lại một lần; vẫn bị chặn thì thôi, không hiện gì.
 *  - Không giao Co-host khi người dẫn đang nói; không giao lại câu đã trả lời trong phiên,
 *    trừ khi đã quá 10 phút và có từ 3 người hỏi lại (A.7).
 *  - DỪNG AI: hủy mọi việc AI đang làm, xóa gợi ý đang hiện; Mai đang nói thì tắt tiếng.
 *  - Chế độ "Co-host được nói" (F-22, #30): câu hỏi Director giao và câu người dẫn gõ ô Hỏi Mai đi thẳng tới miệng
 *    của Mai (agent/mieng/mieng.js), Mai tự trả lời bằng dữ liệu sản phẩm đã đưa thẳng. Miệng chưa sẵn sàng thì Co-host
 *    soạn câu hiện chữ như chế độ gợi ý. Mai dẫn chính (bản 2.7, #47): câu hỏi Director giao xếp hàng tới chỗ nghỉ.
 *  - Đội AI dẫn (bản 2.9, #49): chạy như "Chỉ gợi ý"; câu Co-host đã qua Bộ kiểm tra thì đội AI đọc lên
 *    (server/doi-ai/dan-doi.js). Âm lượng micro lúc đội đang đọc là tiếng loa, không tính là người dẫn nói.
 * Chế độ "Tắt AI" thì không chạy gì.
 */

const live = require('./nghiep-vu/live');
const caiDat = require('./nghiep-vu/cai-dat');
const { LoiNghiepVu, boDau } = require('./nghiep-vu/chung');
const { chayDirector } = require('./agent/agents/director');
const { chayCohost } = require('./agent/agents/cohost');
const { thucHienCongCu } = require('./agent/thuc-hien');
const sp = require('./nghiep-vu/san-pham');

const GOM_MS = 2500; // chờ thêm bình luận trước khi gọi Director: 20 người hỏi size là một lượt, không phải 20
const TOI_DA_BINH_LUAN = 30;
const TRA_LOI_LAI_SAU_MS = 10 * 60 * 1000;
const HOI_LAI_TOI_THIEU = 3;

// Chủ đề hay gặp của câu hỏi mua hàng (so trên chữ bỏ dấu). Director diễn đạt lại câu hỏi mỗi lượt
// ("giá bao nhiêu" rồi "áo này bao tiền"): so theo chủ đề mới biết là một câu.
const CHU_DE = {
  gia: /gia|bao nhieu tien|bao tien|nhieu tien|bn tien|\d+ ?k\b|giam gia|sale/,
  size: /size|sz|co nao|mac vua|mac size|can nang|chieu cao|\d+ ?kg|\dm\d|vong/,
  chat_lieu: /chat lieu|vai gi|vai|chat|co day|mong|day khong|co gian|nong khong|mat khong/,
  mau: /mau|mau gi|con mau|den|trang|be|xanh|do\b|hong|vang|nau|ghi|tim/,
  con_hang: /con hang|con khong|het chua|con size|con mau|con ko|het hang/,
  ship: /ship|giao hang|van chuyen|phi ship|bao lau|may ngay|tinh nao/,
  doi_tra: /doi tra|doi size|doi hang|tra hang|bao hanh|loi/,
  thanh_toan: /thanh toan|chuyen khoan|\bck\b|cod|tien mat|stk|so tai khoan/,
  kieu_dang: /form|dang ao|kieu dang|dang suong|dang om|om|rong|suong|dai khong|ngan khong|kieu/,
  phoi: /phoi|mac voi|mac cung|di voi|set/,
  chot: /chot|lay|dat hang|mua|order/,
};
// So nguyên từ, không so chữ con: "không" có "hong" nhưng không phải màu hồng, "giãn" có "gia" nhưng không hỏi giá.
const CHU_DE_TU = Object.entries(CHU_DE).map(([k, re]) => [k, new RegExp(`(?<![a-z0-9])(?:${re.source})(?![a-z0-9])`)]);

function chuDe(s) {
  const t = boDau(s);
  return new Set(CHU_DE_TU.filter(([, re]) => re.test(t)).map(([k]) => k));
}

function tuCua(s) {
  return new Set(boDau(s).split(/[^a-z0-9]+/).filter((x) => x.length > 1));
}

/** Hai câu hỏi (cùng một sản phẩm) có phải cùng một ý không: chung chủ đề; không nhận ra chủ đề thì so từ trùng. */
function giong(a, b) {
  const ca = chuDe(a);
  const cb = chuDe(b);
  if (ca.size && cb.size) return [...ca].some((x) => cb.has(x));
  const x = tuCua(a);
  const y = tuCua(b);
  if (!x.size || !y.size) return false;
  let chung = 0;
  for (const t of x) if (y.has(t)) chung += 1;
  return chung / (x.size + y.size - chung) >= 0.5;
}

/**
 * Câu Director giao Co-host không nằm trong 3 nhóm nổi bật: tìm bình luận hỏi đúng câu đó để biết tên người hỏi
 * (Đội AI gọi tên) và đánh dấu đã trả lời. Chọn bình luận có nhiều chữ trùng nhất, ít nhất nửa số chữ của bình luận.
 * @returns {string[]} [id] hoặc []
 */
function binhLuanKhop(cauHoi, ds) {
  const q = tuCua(cauHoi);
  let tot = null;
  let diem = 0.5;
  for (const b of ds) {
    const w = tuCua(b.noi_dung);
    if (!w.size) continue;
    let chung = 0;
    for (const t of w) if (q.has(t)) chung += 1;
    if (chung / w.size >= diem) {
      diem = chung / w.size;
      tot = b;
    }
  }
  return tot ? [tot.id] : [];
}

// Câu trả lời của Co-host vừa hiện thì lời nhắc của Director không đè lên (người dẫn đang đọc): chuyển xuống dòng báo.
const GIU_CAU_TRA_LOI_MS = 30 * 1000;

class PhongAi {
  /**
   * @param {object} o
   * @param {(type:string, duLieu?:object) => void} o.phat
   * @param {object} [o.nhaCungCap]  thay nhà cung cấp AI (test)
   * @param {number} [o.gomMs]
   * @param {{director?:object, cohost?:object}} [o.gioiHan]  đè giới hạn thời gian (test)
   */
  constructor({ phat, nhaCungCap, gomMs = GOM_MS, gioiHan = {} }) {
    this.phat = phat;
    this.nhaCungCap = nhaCungCap;
    this.gomMs = gomMs;
    this.gioiHan = gioiHan;
    this.dieuKhien = new AbortController();
    this.mieng = null; // miệng của Mai (dich-vu.js gắn vào)
    this.doiAi = null; // Đội AI dẫn (bản 2.9, dich-vu.js gắn vào)
    this.datLai(null);
  }

  /** Người dẫn đang nói — ở phiên Đội AI dẫn, lúc đội đang đọc thì âm lượng micro là tiếng loa, không tính. */
  nguoiDanDangNoi(p) {
    return this.st.nguoiDanNoi && !(p?.doi_ai && this.doiAi?.dangPhat(p.id));
  }

  /** Miệng của Mai đang sẵn sàng nói trong phiên này (chế độ "Co-host được nói"). */
  miengSanSang(p) {
    return p.che_do_ai === 'noi' && !!this.mieng?.sanSang(p.id);
  }

  datLai(phienId) {
    this.dieuKhien.abort();
    this.dieuKhien = new AbortController();
    clearTimeout(this.hen);
    this.hen = null;
    this.dangDirector = false;
    this.dangCohost = false;
    this.soCohost = 0;
    this.st = { phienId, daXem: new Set(), noiBat: [], daTraLoi: [], goiY: null, bao: null, nguoiDanNoi: false, dang: null, soNhom: 0, loiNguoiDan: [] };
  }

  /** Phiên đang live mà AI được làm việc, hoặc null. */
  phienDangLam() {
    if (!this.st.phienId) return null;
    const p = live.layPhien(this.st.phienId);
    return p.trang_thai === 'dang_live' && p.che_do_ai !== 'tat' ? p : null;
  }

  datDang(dang) {
    this.st.dang = dang;
    this.phat('live.ai_dang', { phien_id: this.st.phienId, dang });
  }

  /* ---------------- bình luận đến ---------------- */

  nhanBinhLuan(bl) {
    if (this.st.phienId !== bl.phien_id) this.datLai(bl.phien_id);
    if (bl.da_an || !this.phienDangLam()) return;
    this.henDirector();
  }

  henDirector(ms = this.gomMs) {
    if (this.hen) return;
    this.hen = setTimeout(() => {
      this.hen = null;
      this.chayDirector().catch((e) => console.error('  [AI phòng live] Director lỗi: ' + e.message));
    }, ms);
  }

  async chayDirector() {
    if (this.dangDirector) return;
    const p = this.phienDangLam();
    if (!p) return;
    const moi = live.binhLuanGanDay(p.id, 100)
      .filter((b) => !this.st.daXem.has(b.id) && !b.da_an && b.xu_ly === 'moi')
      .reverse()
      .slice(0, TOI_DA_BINH_LUAN);
    if (!moi.length) return;
    for (const b of moi) this.st.daXem.add(b.id);
    // Director đọc số sản phẩm đoán cho từng bình luận (id sản phẩm → số, #60).
    const soCua = new Map(p.kich_ban.doan.filter((d) => d.san_pham).map((d) => [d.san_pham.id, d.san_pham.so]));
    for (const b of moi) b.so_doan = b.san_pham_doan ? soCua.get(b.san_pham_doan) ?? sp.laySanPham(b.san_pham_doan)?.so ?? null : null;

    const tinHieu = this.dieuKhien.signal;
    this.dangDirector = true;
    this.datDang('director');
    try {
      const kq = await chayDirector({
        phien: p, binhLuanMoi: moi, noiBat: this.st.noiBat, daTraLoi: this.st.daTraLoi, nguoiDanNoi: this.nguoiDanDangNoi(p),
        loiNguoiDan: this.st.loiNguoiDan.filter((x) => Date.now() - x.luc < 90 * 1000).map((x) => x.chu),
        luongLu: this.luongLu().tomTat(),
        phongAi: this, tinHieu, nhaCungCap: this.nhaCungCap, gioiHan: this.gioiHan.director,
      });
      // Director chậm quá giới hạn hoặc lỗi → bỏ lượt, không có gì hiện ra (F-17).
      if (kq.ok && !tinHieu.aborted && this.st.phienId === p.id) await this.lamTheoPhieu(p, kq, moi);
    } finally {
      this.dangDirector = false;
      if (this.st.dang === 'director') this.datDang(this.dangCohost ? 'cohost' : null);
    }
    // Bình luận đến trong lúc Director chạy: lượt sau.
    if (!tinHieu.aborted) this.henDirector();
  }

  /** Cập nhật câu hỏi nổi bật: nhập câu mới vào câu cũ giống nó, giữ 3 câu nhiều người hỏi nhất. */
  capNhatNoiBat(p, dsMoi, idsMoi) {
    for (const c of dsMoi) {
      const ids = c.binh_luan_ids.filter((id) => idsMoi.has(id));
      const cu = this.st.noiBat.find((x) => (x.so || 0) === (c.so || 0) && giong(x.cau_hoi, c.cau_hoi));
      if (cu) cu.binh_luan_ids = [...new Set([...cu.binh_luan_ids, ...ids])];
      else if (ids.length) {
        this.st.soNhom += 1;
        this.st.noiBat.push({ id: `ch${this.st.soNhom}`, cau_hoi: c.cau_hoi, so: c.so || null, binh_luan_ids: ids, da_goi_y: false });
      }
    }
    this.st.noiBat.sort((a, b) => Number(a.da_goi_y) - Number(b.da_goi_y) || b.binh_luan_ids.length - a.binh_luan_ids.length);
    this.st.noiBat = this.st.noiBat.slice(0, 3);
    for (const c of this.st.noiBat) live.ganNhomCauHoi(p.id, c.binh_luan_ids, c.id);
    this.phat('live.cau_hoi', { phien_id: p.id, cau_hoi: this.st.noiBat });
  }

  async lamTheoPhieu(p, kq, moi) {
    const ph = kq.ketQua;
    const idsMoi = new Set(moi.map((b) => b.id));
    this.capNhatNoiBat(p, ph.cau_hoi_noi_bat, idsMoi);

    const director = caiDat.layAgent('director');
    const doan = p.kich_ban.doan[p.doan_hien_tai];
    const nguCanh = { phongAi: this, phienLiveId: p.id, tenNguoi: moi.map((b) => b.ten) };
    const lam = (ten, thamSo, them = {}) => thucHienCongCu({ ten, thamSo, runId: kq.runId, agent: director, nguCanh: { ...nguCanh, ...them } });

    // Nhãn cần hiểu nghĩa (F-20): spam, xúc phạm, cố lừa AI. Màn hình người dẫn hiện mờ các bình luận này.
    for (const g of ph.gan_nhan || []) {
      if (!idsMoi.has(g.binh_luan_id)) continue;
      const bl = live.themNhan(p.id, g.binh_luan_id, g.nhan);
      if (bl) this.phat('live.binh_luan_cap_nhat', { phien_id: p.id, binh_luan: bl });
    }

    // F-84: lưỡng lự — gắn nhãn, đếm theo (món, kiểu).
    const ll = this.luongLu();
    for (const x of ph.luong_lu || []) {
      if (!idsMoi.has(x.binh_luan_id)) continue;
      const b = moi.find((y) => y.id === x.binh_luan_id);
      const so = b?.so_doan ?? doan?.san_pham?.so ?? null;
      if (!so) continue;
      ll.them({ so, kieu: x.kieu, nguoi: b.nguoi_fb_id || b.ten });
      const bl = live.themNhan(p.id, x.binh_luan_id, 'luong_lu');
      if (bl) this.phat('live.binh_luan_cap_nhat', { phien_id: p.id, binh_luan: bl });
    }
    let chanGiao = false;
    if (ph.quyet_dinh === 'giao_cohost' && ph.giao_cohost.skill_ids.includes('go-luong-lu')) chanGiao = !this.choGoLuongLu(p, ph.giao_cohost);
    else this.nhacLuongLu(p);

    // Bình luận hỏi riêng luôn được chuyển Tư vấn viên, dù quyết định chính của lượt là gì — để không sót ai.
    // F-65: bình luận đã có đường khác giữ lượt nhắn riêng (thẻ giữ hàng, thẻ 'ib'…) thì không chuyển Tư vấn viên — không nhắn riêng lần hai.
    const luot = require('./nghiep-vu/luot-nhan-rieng');
    const riengIds = ph.chuyen_tu_van_ids.filter((id) => idsMoi.has(id) && !luot.daCoLuot(moi.find((b) => b.id === id)?.fb_id || ''));
    if (riengIds.length) await lam('chuyen_tu_van', { binh_luan_ids: riengIds });

    if (ph.quyet_dinh === 'goi_y_nguoi_dan') {
      await lam('goi_y_nguoi_dan', { cau: ph.goi_y }, { soDuocGiao: ph.cau_hoi_noi_bat[0]?.so || doan?.san_pham?.so || null });
    } else if (ph.quyet_dinh === 'bao_nguoi_dan') {
      await lam('bao_nguoi_dan', { noi_dung: ph.bao });
    } else if (ph.quyet_dinh === 'giao_cohost' && !chanGiao) {
      const g = ph.giao_cohost;
      // Cùng sản phẩm mới là cùng nhóm: "size áo 7" không phải nhóm "size" của áo 12.
      const nhom = this.st.noiBat.find((c) => (c.so || 0) === (g.so || 0) && giong(c.cau_hoi, g.cau_hoi));
      const ids = nhom?.binh_luan_ids || binhLuanKhop(g.cau_hoi, live.binhLuanGanDay(p.id, TOI_DA_BINH_LUAN)
        .filter((b) => b.xu_ly === 'moi' && !b.da_an && b.nhan.includes('cau_hoi')));
      await lam('giao_cohost', { cau_hoi: g.cau_hoi, so: g.so, skill_ids: g.skill_ids }, { binhLuanIds: ids });
    }

    // #90: Director chọn hình cho Màn hình sản phẩm (gợi ý hoặc tự chuyển cảnh theo chế độ — man-hinh-san-pham.js).
    const mh = ph.man_hinh;
    if (mh?.mau && this.manHinh) {
      try {
        this.manHinh.chieu({ mau: mh.mau, so: mh.so || null, mau_sac: mh.mau_sac || null, chieu_cao: mh.chieu_cao || null, can_nang: mh.can_nang || null },
          { boi: 'ai', lyDo: ph.ly_do });
      } catch { /* sản phẩm không chiếu được: bỏ qua, không làm phiền người dẫn */ }
    }
  }

  /* ---------------- lưỡng lự (F-84) ---------------- */

  luongLu() {
    const { TheoDoiLuongLu } = require('./go-luong-lu');
    if (!this.st.luongLu) this.st.luongLu = new TheoDoiLuongLu();
    return this.st.luongLu;
  }

  /**
   * Director muốn giao Co-host gỡ lưỡng lự: chỉ cho khi ≥ 2 người cùng kiểu, cùng món, chưa gỡ trong 10 phút, và CÓ nguồn thật.
   * Cho phép → gắn nguồn vào câu giao, chiếu hình theo kiểu, ghi đã gỡ. Không → nhắc người dẫn (hoặc im). @returns {boolean}
   */
  choGoLuongLu(p, g) {
    const { nguonGoLuongLu, TEN_KIEU } = require('./go-luong-lu');
    const ll = this.luongLu();
    const nhom = ll.nhom().filter((x) => x.so === g.so && !x.da_go_gan).sort((a, b) => b.so_nguoi - a.so_nguoi)[0];
    if (!nhom || !ll.duocGo(nhom.so, nhom.kieu)) return false; // 1 người, hoặc đã gỡ gần đây: im
    let s;
    try { s = sp.layTheoSo(g.so); } catch { s = null; }
    if (!s) return false;
    const n = nguonGoLuongLu(nhom.kieu, s, { phienId: p.id, dienTap: p.dien_tap });
    ll.daGoLuc(nhom.so, nhom.kieu);
    if (!n.co) {
      try { this.bao(`${nhom.so_nguoi} người ${TEN_KIEU[nhom.kieu]} (số ${nhom.so}) — chưa có nguồn thật để gỡ (điền Sổ tay / bảng size / video quay thật). Người dẫn tự trả lời.`); } catch { /* hết live */ }
      return false;
    }
    g.cau_hoi = `${g.cau_hoi} — ${nhom.so_nguoi} người ${TEN_KIEU[nhom.kieu]}. Gỡ bằng nguồn thật: ${n.nguon.map((x) => `[${x.nguon}] "${x.doan}"`).join('; ') || 'hình trên màn hình'}`.slice(0, 600);
    if (n.man_hinh && this.manHinh) { try { this.manHinh.chieu(n.man_hinh, { boi: 'ai', lyDo: `Khách ${TEN_KIEU[nhom.kieu]}` }); } catch { /* không chiếu được */ } }
    return true;
  }

  /** Nhóm lưỡng lự đủ người mà Director chưa gỡ → một dòng nhắc người dẫn (mỗi nhóm một lần mỗi 10 phút). */
  nhacLuongLu(p) {
    const { nguonGoLuongLu, TEN_KIEU } = require('./go-luong-lu');
    const ll = this.luongLu();
    for (const x of ll.nhom().filter((y) => ll.duocGo(y.so, y.kieu))) {
      let s;
      try { s = sp.layTheoSo(x.so); } catch { s = null; }
      if (!s) continue;
      const n = nguonGoLuongLu(x.kieu, s, { phienId: p.id, dienTap: p.dien_tap });
      ll.daGoLuc(x.so, x.kieu);
      try { this.bao(`${x.so_nguoi} người ${TEN_KIEU[x.kieu]} (số ${x.so}) — ${n.co ? n.goi_y : 'chưa có nguồn thật để gỡ (điền Sổ tay / bảng size / video quay thật)'}.`); } catch { /* hết live */ }
      if (n.co && n.man_hinh && this.manHinh) { try { this.manHinh.chieu(n.man_hinh, { boi: 'ai', lyDo: `Khách ${TEN_KIEU[x.kieu]}` }); } catch { /* bỏ qua */ } }
      break; // mỗi lượt một dòng
    }
  }

  /* ---------------- việc các công cụ gọi vào ---------------- */

  tinhHinh() {
    const p = this.phienDangLam();
    if (!p) return { dang_live: false };
    const d = p.kich_ban.doan[p.doan_hien_tai];
    return {
      dang_live: true,
      phien: p.ten,
      che_do_ai: p.che_do_ai,
      mai_dan: !!p.mai_dan,
      doi_ai: !!p.doi_ai,
      doan: { so: p.doan_hien_tai + 1, tong: p.kich_ban.doan.length, san_pham: d?.san_pham?.ten_day_du ?? null, so: d?.san_pham?.so ?? null, loi_nhac: d?.loi_nhac ?? '' },
      nguoi_dan_dang_noi: this.nguoiDanDangNoi(p),
      mai_dang_noi: !!this.mieng?.maiDangNoi() || !!this.doiAi?.dangPhat(p.id),
      cau_hoi_noi_bat: this.st.noiBat,
      da_tra_loi: this.st.daTraLoi,
    };
  }

  cauHoiMoi() {
    const p = this.phienDangLam();
    if (!p) return [];
    return live.binhLuanGanDay(p.id, 50).filter((b) => !this.st.daXem.has(b.id) && !b.da_an && b.xu_ly === 'moi')
      .map((b) => ({ id: b.id, ten: b.ten, noi_dung: b.noi_dung, so_doan: b.san_pham_doan ? sp.laySanPham(b.san_pham_doan).so : null, nhan: b.nhan }));
  }

  /** Hiện một câu trên Màn hình người dẫn (câu Co-host hoặc lời nhắc của Director). Câu mới thay câu cũ. */
  hienGoiY({ loai, cau, trichDan = [], cauHoi = null, so = null, runId = null, binhLuanId = null, phien = null }) {
    // F-115: `phien` — chạm để trả lời hỏi size chạy cả khi AI tắt (câu bằng mã); `binhLuanId` đi kèm thẻ để nút "Trả lời bình luận".
    const p = phien || this.phienDangLam();
    if (!p) throw new LoiNghiepVu('KHONG_CO_LIVE', 'Buổi live đã kết thúc hoặc AI đang tắt.');
    const g = this.st.goiY;
    if (loai === 'director' && g?.loai === 'cohost' && Date.now() - new Date(g.luc).getTime() < GIU_CAU_TRA_LOI_MS) {
      this.bao(cau);
      return { da_hien: false, da_bao: true, ly_do: 'Người dẫn đang đọc câu trả lời vừa hiện: lời nhắc chuyển xuống dòng báo.' };
    }
    if (this.st.goiY) live.datTrangThaiCau(this.st.goiY.id, 'het_han');
    const c = { ...live.themCauTrenSong({ phienId: p.id, runId, loai, cauHoi, so, noiDung: cau, trichDan }), ...(binhLuanId ? { binh_luan_id: binhLuanId } : {}) };
    this.st.goiY = c;
    this.phat('live.goi_y', { phien_id: p.id, goi_y: c });
    return { da_hien: true, id: c.id };
  }

  /** @param {'thuong'|'do'} muc  'do' = việc gấp (sản phẩm vừa Ngừng bán…), màn hình tô đỏ. */
  bao(noiDung, muc = 'thuong') {
    const p = this.phienDangLam();
    if (!p) throw new LoiNghiepVu('KHONG_CO_LIVE', 'Buổi live đã kết thúc hoặc AI đang tắt.');
    this.st.bao = { noi_dung: String(noiDung).slice(0, 300), muc, luc: new Date().toISOString() };
    this.phat('live.bao', { phien_id: p.id, bao: this.st.bao });
    return { da_bao: true };
  }

  chuyenTuVan(ids) {
    const p = this.phienDangLam();
    if (!p) throw new LoiNghiepVu('KHONG_CO_LIVE', 'Buổi live đã kết thúc hoặc AI đang tắt.');
    const n = live.datXuLy(p.id, ids, 'cho_tu_van');
    this.phat('live.cho_tu_van', { phien_id: p.id, dem: live.demBinhLuan(p.id) });
    return { da_chuyen: n };
  }

  /**
   * Giao Co-host. Chạy nền: Director không phải chờ Co-host soạn xong.
   * @param {{cauHoi:string, so:number, skillIds?:string[], binhLuanIds?:string[], tuNguoiDan?:boolean}} o
   */
  giaoCohost({ cauHoi, so, skillIds = [], binhLuanIds = [], tuNguoiDan = false }) {
    const p = this.phienDangLam();
    if (!p) throw new LoiNghiepVu('KHONG_CO_LIVE', 'Buổi live đã kết thúc hoặc AI đang tắt.');
    if (!tuNguoiDan) {
      // Đội AI dẫn: câu trả lời đọc ở chỗ nghỉ kế tiếp, người dẫn đang nói cũng soạn trước được.
      if (this.st.nguoiDanNoi && !p.doi_ai) return { bo_qua: true, ly_do: 'Người dẫn đang nói: không giao Co-host.' };
      const cu = this.st.daTraLoi.find((x) => x.so === so && giong(x.cau_hoi, cauHoi));
      if (cu && (Date.now() - cu.luc < TRA_LOI_LAI_SAU_MS || binhLuanIds.length < HOI_LAI_TOI_THIEU)) {
        return { bo_qua: true, ly_do: `Câu này đã được trả lời trong phiên: "${cu.cau_hoi}".` };
      }
    }
    if (this.miengSanSang(p)) return this.giaoMai(p, { cauHoi, so, binhLuanIds, tuNguoiDan });
    // Đội AI dẫn (bản 2.9): câu người dẫn hỏi soạn ngay, song song với câu người xem đang soạn — đội đã nói câu đệm.
    if (this.dangCohost && !(tuNguoiDan && p.doi_ai)) return { bo_qua: true, ly_do: 'Co-host đang soạn câu khác.' };
    const ghi = { cau_hoi: cauHoi, so, luc: Date.now() };
    this.st.daTraLoi.push(ghi);
    this.soCohost = (this.soCohost || 0) + 1;
    this.dangCohost = true;
    this.datDang('cohost');
    const tinHieu = this.dieuKhien.signal;
    // Đội AI dẫn: câu người dẫn hỏi mà Co-host không soạn được (AI lỗi, hết tiền, bị chặn) — đội đã nói câu đệm, phải có
    // câu kết thay vì im (buổi tập 24/9/2026: Gemini quá tải, OpenAI dự phòng hết tiền).
    const khongDuoc = () => { if (tuNguoiDan && p.doi_ai && !tinHieu.aborted) this.doiAi?.khongTraLoiDuoc(p.id); };
    this.chayCohostNen(p, { cauHoi, so, skillIds, binhLuanIds, tinHieu, tuNguoiDan })
      .then((thanh) => {
        if (thanh) return;
        this.st.daTraLoi = this.st.daTraLoi.filter((x) => x !== ghi);
        khongDuoc();
      })
      .catch((e) => {
        this.st.daTraLoi = this.st.daTraLoi.filter((x) => x !== ghi);
        console.error('  [AI phòng live] Co-host lỗi: ' + e.message);
        khongDuoc();
      })
      .finally(() => {
        this.soCohost = Math.max(0, this.soCohost - 1);
        this.dangCohost = this.soCohost > 0;
        if (!this.dangCohost && this.st.dang === 'cohost') this.datDang(this.dangDirector ? 'director' : null);
      });
    return { da_giao: true };
  }

  /**
   * Chế độ "Co-host được nói": gửi thẳng câu hỏi cho Mai trả lời trên sóng (F-22).
   * Mai dẫn chính (bản 2.7, #47): Mai nói gần như suốt buổi, nên câu hỏi người xem xếp hàng thay vì bị bỏ — Mai trả lời
   * ở chỗ nghỉ giữa hai đoạn. Câu người dẫn hỏi vẫn đi thẳng (người dẫn nói xen).
   */
  giaoMai(p, { cauHoi, so = null, binhLuanIds = [], tuNguoiDan = false }) {
    const xepHang = !tuNguoiDan && p.mai_dan;
    if (!tuNguoiDan && !xepHang && this.mieng.maiDangNoi()) return { bo_qua: true, ly_do: 'Mai đang nói: chờ Mai nói xong.' };
    if (xepHang) {
      // Mai gọi tên người hỏi khi trả lời (tên gọi của người hỏi đầu tiên trong nhóm).
      const ten = binhLuanIds.map((id) => { try { return live.layBinhLuan(id).ten; } catch { return null; } }).find(Boolean) || null;
      this.mieng.xepCauHoi({ cauHoi, so, ten });
    } else this.mieng.hoi({ cauHoi, so, tuNguoiDan });
    if (!tuNguoiDan) {
      this.st.daTraLoi.push({ cau_hoi: cauHoi, so, luc: Date.now() });
      live.datXuLy(p.id, binhLuanIds, 'da_goi_y');
      for (const c of this.st.noiBat) if (c.so === so && giong(c.cau_hoi, cauHoi)) c.da_goi_y = true;
      this.phat('live.cau_hoi', { phien_id: p.id, cau_hoi: this.st.noiBat });
    }
    return { da_giao: true, mai_noi: true, ...(xepHang ? { xep_hang: true } : {}) };
  }

  async chayCohostNen(p, { cauHoi, so, skillIds, binhLuanIds, tinHieu, tuNguoiDan = false }) {
    const cohost = caiDat.layAgent('cohost');
    const tenNguoi = binhLuanIds.map((id) => { try { return live.layBinhLuan(id).ten; } catch { return null; } }).filter(Boolean);
    let phanHoi = null;
    for (let lan = 0; lan < 2; lan += 1) {
      const kq = await chayCohost({
        phien: p, cauHoi, so, skillIds, tenNguoi, phanHoiTruoc: phanHoi, tinHieu, nhaCungCap: this.nhaCungCap, gioiHan: this.gioiHan.cohost,
      });
      if (!kq.ok || tinHieu.aborted || this.st.phienId !== p.id) return false;
      const r = await thucHienCongCu({
        ten: 'de_xuat_cau_song',
        thamSo: { cau: kq.ketQua.cau, trich_dan: kq.ketQua.trich_dan },
        runId: kq.runId,
        agent: cohost,
        nguCanh: { phongAi: this, phienLiveId: p.id, soDuocGiao: so, tenNguoi, cauHoi },
      });
      if (!r.loi) {
        // Đội AI dẫn (bản 2.9, F-46): câu đã qua Bộ kiểm tra — đội đọc lên ở chỗ nghỉ kế tiếp.
        if (live.layPhien(p.id).doi_ai) {
          this.doiAi?.traLoi({ phienId: p.id, cauHoi, cau: kq.ketQua.cau, ten: tenNguoi[0] || null, tuNguoiDan });
        }
        live.datXuLy(p.id, binhLuanIds, 'da_goi_y');
        for (const c of this.st.noiBat) if (c.so === so && giong(c.cau_hoi, cauHoi)) c.da_goi_y = true;
        this.phat('live.cau_hoi', { phien_id: p.id, cau_hoi: this.st.noiBat });
        return true;
      }
      if (r.loi.ma !== 'KIEM_TRA_CHAN') return false;
      // Giữ lại câu bị chặn để xem "Vì sao"; không bao giờ hiện lên màn hình.
      live.themCauTrenSong({ phienId: p.id, runId: kq.runId, cauHoi, so, noiDung: kq.ketQua.cau, trichDan: kq.ketQua.trich_dan, trangThai: 'bi_chan' });
      phanHoi = r.loi.thong_diep;
    }
    return false;
  }

  /**
   * F-115 chạm để trả lời: người dẫn chạm một bình luận → MỘT câu trên thẻ gợi ý (kèm `binh_luan_id`), không tự nói lên sóng.
   * Hỏi size có số đo → tư vấn size bằng mã (chạy cả khi "Dừng AI"); còn lại giao Co-host đúng bình luận đó (1–2 câu, lưu đệm 12 giờ)
   * → Bộ kiểm tra → hienGoiY. Bị chặn hai lần → "Mai chưa chắc" + dữ liệu liên quan để người dẫn tự kiểm.
   * @returns {Promise<{goi_y?:object, chua_chac?:boolean, cau?:string, du_lieu?:string[], tu_van_size?:boolean}>}
   */
  async traLoiBinhLuan(phienId, binhLuanId, { tuVanSize = null } = {}) {
    const p = live.layPhien(phienId);
    if (p.trang_thai !== 'dang_live') throw new LoiNghiepVu('KHONG_CO_LIVE', 'Buổi live chưa chạy hoặc đã kết thúc.', 409);
    const bl = live.layBinhLuan(binhLuanId);
    if (bl.phien_id !== p.id) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Bình luận không thuộc buổi live này.', 404);
    let soDoan = null;
    try { soDoan = bl.san_pham_doan ? sp.laySanPham(bl.san_pham_doan).so : null; } catch { soDoan = null; }
    const blMon = { ...bl, so_doan: soDoan };
    const size = tuVanSize?.soanCau(blMon, p);
    if (size) {
      const { kiemTraCau } = require('./agent/kiem-tra/kiem-tra');
      const kt = kiemTraCau({ cau: size.cau, trich_dan: size.trichDan, kenh: 'song', soDuocGiao: size.so, phienLiveId: p.id });
      if (!kt.dat) return this.chuaChac(p, bl, size.trichDan.map((x) => x.doan));
      live.datXuLy(p.id, [bl.id], 'da_goi_y');
      const r = this.hienGoiY({ loai: 'cohost', cau: size.cau, trichDan: size.trichDan, cauHoi: bl.noi_dung, so: size.so, binhLuanId: bl.id, phien: p });
      return { goi_y: this.st.goiY && r.id === this.st.goiY.id ? this.st.goiY : null, tu_van_size: true };
    }
    if (p.che_do_ai === 'tat' || caiDat.khanCap() || caiDat.dungAi().bat) {
      throw new LoiNghiepVu('DUNG_AI', 'AI đang dừng: chạm để trả lời chỉ còn tư vấn size có số đo (bằng mã).', 409);
    }
    let mon = null;
    try { mon = tuVanSize?.monCua(blMon, p) || null; } catch { mon = null; }
    if (!mon && soDoan != null) mon = { so: soDoan };
    if (!mon) {
      const d = p.kich_ban.doan[p.doan_hien_tai];
      try { mon = d?.san_pham_id ? sp.laySanPham(d.san_pham_id) : null; } catch { mon = null; }
    }
    if (!mon) throw new LoiNghiepVu('KHONG_RO_MON', 'Không rõ bình luận hỏi món nào: chuyển đoạn tới món đó rồi chạm lại.', 409);
    const cohost = caiDat.layAgent('cohost');
    const tinHieu = this.dieuKhien.signal;
    const tenNguoi = [bl.ten].filter(Boolean);
    let phanHoi = null;
    let duLieu = [];
    for (let lan = 0; lan < 2; lan += 1) {
      const kq = await chayCohost({ phien: p, cauHoi: bl.noi_dung, so: mon.so, tenNguoi, phanHoiTruoc: phanHoi, tinHieu, nhaCungCap: this.nhaCungCap, gioiHan: this.gioiHan.cohost, chamTraLoi: true });
      // Phiếu sai (câu có số mà không trích nguồn…) tính như bị Bộ kiểm tra chặn: soạn lại một lần, rồi "Mai chưa chắc".
      if (!kq.ok && kq.loi?.ma === 'PHIEU_SAI') { phanHoi = kq.loi.thong_diep; continue; }
      if (!kq.ok) throw new LoiNghiepVu(kq.loi?.ma || 'AI_LOI', kq.loi?.thong_diep || 'Mai chưa soạn được câu.', 409);
      if (tinHieu.aborted) throw new LoiNghiepVu('BI_DUNG', 'Người dẫn vừa bấm Dừng AI.', 409);
      const r = await thucHienCongCu({
        ten: 'de_xuat_cau_song',
        thamSo: { cau: kq.ketQua.cau, trich_dan: kq.ketQua.trich_dan },
        runId: kq.runId,
        agent: cohost,
        nguCanh: { phongAi: this, phienLiveId: p.id, soDuocGiao: mon.so, tenNguoi, cauHoi: bl.noi_dung, binhLuanId: bl.id },
      });
      if (!r.loi) {
        live.datXuLy(p.id, [bl.id], 'da_goi_y');
        return { goi_y: this.st.goiY };
      }
      if (r.loi.ma !== 'KIEM_TRA_CHAN') throw new LoiNghiepVu(r.loi.ma, r.loi.thong_diep, 409);
      live.themCauTrenSong({ phienId: p.id, runId: kq.runId, cauHoi: bl.noi_dung, so: mon.so, noiDung: kq.ketQua.cau, trichDan: kq.ketQua.trich_dan, trangThai: 'bi_chan' });
      phanHoi = r.loi.thong_diep;
      duLieu = (kq.ketQua.trich_dan || []).map((x) => x.doan);
    }
    if (!duLieu.length) {
      try { const s0 = sp.layTheoSo(mon.so); duLieu = [sp.tenDayDu(s0)]; } catch { duLieu = []; }
    }
    return this.chuaChac(p, bl, duLieu);
  }

  /** F-115: câu bị Bộ kiểm tra chặn — không hiện câu, báo người dẫn tự kiểm kèm dữ liệu liên quan. */
  chuaChac(p, bl, duLieu) {
    const kq = { chua_chac: true, binh_luan_id: bl.id, cau: 'Mai chưa chắc, anh/chị kiểm lại.', du_lieu: duLieu.filter(Boolean).slice(0, 4) };
    this.phat('live.goi_y_chua_chac', { phien_id: p.id, ...kq });
    return kq;
  }

  /**
   * F-115 nút [Mai nói]: câu trên thẻ gợi ý lên sóng đúng nguyên văn — Mai nói cùng / Mai dẫn chính (miệng sẵn sàng) hoặc Đội AI.
   * Chế độ Chỉ gợi ý chưa có tiếng Mai trên sóng (như F-109 BH10) → người dẫn tự đọc.
   */
  noiGoiY(phienId, cauId) {
    const p = live.layPhien(phienId);
    const c = this.st.goiY?.id === cauId ? this.st.goiY : null;
    if (!c) throw new LoiNghiepVu('GOI_Y_HET_HAN', 'Câu gợi ý này đã thay bằng câu khác.', 409);
    if (this.miengSanSang(p)) this.mieng.noiNguyenVan(c.noi_dung);
    else if (p.doi_ai && this.doiAi) this.doiAi.traLoi({ phienId: p.id, cauHoi: c.cau_hoi || '', cau: c.noi_dung, ten: null, tuNguoiDan: true });
    else throw new LoiNghiepVu('CHUA_CO_TIENG', 'Chế độ Chỉ gợi ý: Mai chưa có tiếng trên sóng — anh/chị tự đọc câu này.', 409);
    live.datTrangThaiCau(c.id, 'da_phat');
    return { da_noi: true };
  }

  /**
   * Sản phẩm vừa bị đổi khỏi Đang bán giữa buổi live (Luồng 2, nhánh lỗi): báo đỏ người dẫn, gỡ câu gợi ý và câu hỏi
   * nổi bật của sản phẩm đó. Bộ kiểm tra đã chặn mọi câu mới nhắc sản phẩm này (K1).
   */
  sanPhamNgungBan(so) {
    const p = this.phienDangLam();
    const d = p?.kich_ban.doan.find((x) => x.san_pham?.so === so);
    if (!d) return;
    if (this.st.goiY && this.st.goiY.san_pham_id === d.san_pham.id) {
      live.datTrangThaiCau(this.st.goiY.id, 'het_han');
      this.st.goiY = null;
      this.phat('live.goi_y', { phien_id: p.id, goi_y: null });
    }
    const truoc = this.st.noiBat.length;
    this.st.noiBat = this.st.noiBat.filter((c) => c.so !== so);
    if (this.st.noiBat.length !== truoc) this.phat('live.cau_hoi', { phien_id: p.id, cau_hoi: this.st.noiBat });
    this.mieng?.sanPhamNgungBan(so);
    this.bao(`${d.san_pham.ten_day_du} vừa thôi "Đang bán": đừng nhắc món này nữa. Đã gỡ câu gợi ý và câu hỏi của món này.`, 'do');
  }

  /* ---------------- người dẫn ---------------- */

  /**
   * Người dẫn hỏi Mai (gõ trên Màn hình người dẫn; M4 thêm hỏi bằng giọng). Không qua Director.
   * @param {{tuGiong?:boolean}} [o]  hỏi bằng giọng (chép lời "Mai ơi…"): người xem đã nghe câu hỏi (Đội AI dẫn, bản 2.9)
   */
  hoiMai(phienId, cauHoi, { tuGiong = false } = {}) {
    if (this.st.phienId !== phienId) this.datLai(phienId);
    const p = this.phienDangLam();
    if (!p) throw new LoiNghiepVu('KHONG_CO_LIVE', 'Chưa có buổi live đang chạy, hoặc AI đang tắt.');
    const cau = String(cauHoi ?? '').trim().slice(0, 500);
    if (!cau) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chưa gõ câu hỏi.');
    // F-82: số đo người mẫu nói bằng lời — ghi bằng mã, không hỏi AI.
    const nm = require('./nguoi-mau').xuLy(p, cau, this.phat);
    if (nm) {
      this.bao(`Đã ghi người mẫu${nm.nguoi_mau?.chieu_cao ? ` cao ${require('./nguoi-mau').caoChu(nm.nguoi_mau.chieu_cao)}` : ''}${nm.nguoi_mau?.can_nang && !nm.nguoi_mau.an_can_nang ? `, ${nm.nguoi_mau.can_nang}kg` : ''}${nm.dang_mac ? `, đang mặc ${nm.dang_mac} (số ${nm.so})` : ''}.`);
      return { nguoi_mau: nm };
    }
    // #90: lệnh màn hình / chuyển cảnh ("Mai ơi, chiếu bảng size áo 12", "quay lại camera") — làm ngay bằng mã, không hỏi AI.
    if (this.manHinh) {
      const soDoan = p.kich_ban.doan[p.doan_hien_tai]?.san_pham?.so ?? null;
      const lenh = require('./man-hinh-san-pham').docLenh(cau, { soDangNoi: soDoan });
      if (lenh) {
        return this.manHinh.lamLenh(lenh).then((kq) => ({ man_hinh: kq }), (e) => {
          this.bao(`Chưa chiếu được: ${e.message}`);
          return { bo_qua: true, ly_do: e.message };
        });
      }
    }
    // Mai đang nói trên sóng: Mai có dữ liệu mọi sản phẩm trong phiên, không cần đoán món.
    if (this.miengSanSang(p)) return this.giaoMai(p, { cauHoi: cau, tuNguoiDan: true });
    // Món được hỏi: số hoặc tên nhắc trong câu hỏi ("áo 12 còn size M không"), không có thì món của đoạn đang nói (#60).
    const dsPhien = [...new Map(p.kich_ban.doan.filter((d) => d.san_pham).map((d) => [d.san_pham.id, d.san_pham])).values()];
    const { theoSo, theoTen } = sp.sanPhamDuocNhac(cau, dsPhien);
    const so = (theoSo[0] || theoTen[0])?.so ?? p.kich_ban.doan[p.doan_hien_tai]?.san_pham?.so ?? null;
    if (!so) {
      this.bao(`${caiDat.tenAi().split(' - ')[0]} chưa biết anh/chị hỏi món nào — nói số sản phẩm trong câu hỏi (ví dụ "áo 12").`);
      return { bo_qua: true, ly_do: 'Không rõ hỏi món nào.' };
    }
    // Đội AI dẫn (bản 2.9): hỏi bằng giọng → đội ngừng đoạn đang đọc, một nhân vật khác nói câu đệm ngay trong lúc
    // Co-host soạn; hỏi bằng chữ (người xem không nghe câu hỏi) → câu trả lời đọc ở chỗ nghỉ kế tiếp.
    if (p.doi_ai) this.doiAi?.coNguoiDanHoi(p.id, { tuGiong });
    const kq = this.giaoCohost({ cauHoi: cau, so, tuNguoiDan: true });
    if (p.doi_ai && kq?.bo_qua) this.doiAi?.huyCho(p.id);
    return kq;
  }

  /** Câu người dẫn vừa nói (chép lời, #33): chỉ giữ trong bộ nhớ 90 giây gần nhất cho Director, không lưu. */
  themLoiNguoiDan(phienId, chu) {
    // F-80 (#108): lời người dẫn vào nhật ký buổi live (chỉ chữ, giữ 90 ngày — thay "không lưu" của SPEC-TD #33).
    require('./nghiep-vu/nhat-ky-song').ghi({ phienId, loai: 'nguoi_dan', noiDung: chu });
    // F-82: người dẫn nói "Mai ơi mẫu cao 1m60 mặc S" (chế độ Mai nói / Mai dẫn — lời đi qua chép lời, không qua ô Hỏi Mai).
    if (/^\s*mai\s*(ơi|oi)?\b/i.test(String(chu))) {
      try { const p = live.layPhien(phienId); if (p.trang_thai === 'dang_live') require('./nguoi-mau').xuLy(p, chu, this.phat); } catch { /* không phải lệnh */ }
    }
    if (this.st.phienId !== phienId) return;
    const bayGio = Date.now();
    this.st.loiNguoiDan = [...this.st.loiNguoiDan, { chu: String(chu).slice(0, 500), luc: bayGio }]
      .filter((x) => bayGio - x.luc < 90 * 1000).slice(-8);
  }

  datNguoiDanNoi(phienId, bat) {
    if (this.st.phienId !== phienId) this.datLai(phienId);
    this.st.nguoiDanNoi = !!bat;
    this.phat('live.nguoi_dan_noi', { phien_id: phienId, bat: this.st.nguoiDanNoi });
  }

  /** DỪNG AI (F-16): hủy mọi việc AI đang làm, xóa câu đang hiện. Bình luận đã đọc không đưa lại. */
  dungAi(phienId) {
    this.mieng?.dungAi(phienId); // tiếng Mai tắt kể cả khi phòng AI chưa có việc gì trong phiên này
    this.doiAi?.dungAi(phienId);
    if (this.st.phienId !== phienId) return;
    this.dieuKhien.abort();
    this.dieuKhien = new AbortController();
    clearTimeout(this.hen);
    this.hen = null;
    if (this.st.goiY) live.datTrangThaiCau(this.st.goiY.id, 'bi_dung');
    this.st.goiY = null;
    this.st.bao = null;
    this.phat('live.goi_y', { phien_id: phienId, goi_y: null });
  }

  ketThuc(phienId) {
    if (this.st.phienId === phienId) this.datLai(null);
  }

  trangThai(phienId) {
    if (this.st.phienId !== phienId) return { cau_hoi: [], goi_y: null, bao: null, nguoi_dan_noi: false, dang: null };
    return { cau_hoi: this.st.noiBat, goi_y: this.st.goiY, bao: this.st.bao, nguoi_dan_noi: this.st.nguoiDanNoi, dang: this.st.dang };
  }
}

module.exports = { PhongAi, giong, chuDe };
