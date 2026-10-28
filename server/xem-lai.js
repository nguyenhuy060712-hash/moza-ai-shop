'use strict';

/**
 * Bán sau live (SPEC.md F-94, #116): bình luận chốt trên VIDEO XEM LẠI của live đã xong, tới 7 ngày.
 *  - Hai đường: webhook feed (Hộp thư chuyển sang đây khi bài là live đã xong) và tự hỏi GET /{video}/comments lúc khởi động +
 *    10 phút một lần (con trỏ phien_live.xem_lai_con_tro). Trùng fb_id → bỏ (binh_luan_live.fb_id UNIQUE): 1 đơn, 1 tin.
 *  - Không đoán món theo giờ (bình luận xem lại không có mốc trong video): chỉ nhận chốt có số món; thiếu số → thẻ hỏi món.
 *  - Chốt đơn chế độ xem lại: không đọc tên trên sóng, không hiện "Vừa chốt"; giá hiện tại (giá live đã hết — thẻ ghi rõ); gộp vào
 *    đơn mở của buổi đó. Không phải chốt → Hộp thư như bình luận bài đăng (Tư vấn viên). Quá 7 ngày: bỏ (Meta cấm nhắn riêng).
 *  - Bình luận mục lục: 2 phút sau khi live xong, Page bình luận "📌 Mục lục: 02:15 Áo 12 · … Chốt: …" (phút theo giờ bắt đầu do
 *    Facebook trả — không có thì không đăng); không giá, không tên khách; đăng một lần; "Dừng mọi thứ" chặn; công tắc tắt thì thôi.
 */

const { csdl } = require('./db/ket-noi');
const live = require('./nghiep-vu/live');
const caiDat = require('./nghiep-vu/cai-dat');
const { chayCua } = require('./agent/hook/cua');

const HAN_MS = 7 * 86400e3;
const CHU_KY_MS = 10 * 60e3;
const MUC_LUC_SAU_MS = 2 * 60e3;

/** Công tắc "Tự đăng mục lục sau live" (Cài đặt → Facebook, mặc định bật). */
function tuDangMucLuc() {
  return caiDat.doc('fb_tu_dang_muc_luc', true) !== false;
}

class XemLai {
  /**
   * @param {object} o
   * @param {Function} o.layKetNoi   ({dien_tap}) → kết nối Facebook
   * @param {Function} o.layChotDon  () → ChotDon
   * @param {Function} o.layHopThu   () → HopThuTuDong
   * @param {Function} [o.phat]
   */
  constructor({ layKetNoi, layChotDon, layHopThu, phat = () => {} }) {
    this.layKetNoi = layKetNoi;
    this.layChotDon = layChotDon;
    this.layHopThu = layHopThu;
    this.phat = phat;
    this.hen = null;
    this.henMuc = new Map();
    this.boQua = new Set(); // phiên có video không còn trên Facebook
  }

  batDau() {
    this.hen = setInterval(() => this.quet().catch((e) => console.error(`  [xem lại] ${e.message}`)), CHU_KY_MS);
    this.hen.unref?.();
    setTimeout(() => this.quet().catch(() => {}), 5000).unref?.();
  }

  dung() {
    clearInterval(this.hen);
    for (const t of this.henMuc.values()) clearTimeout(t);
    this.henMuc.clear();
  }

  /**
   * Phiên đã xong trong 7 ngày còn nhận bình luận xem lại: phiên thật, và phiên tập chưa trả kho (#87).
   * @returns {object[]}
   */
  phienXemLai(bayGio = Date.now(), chiId = null) {
    const tu = new Date(bayGio - HAN_MS).toISOString();
    return csdl().prepare(`SELECT id FROM phien_live p WHERE trang_thai = 'xong' AND ket_thuc >= ? AND fb_video_id IS NOT NULL ${chiId ? 'AND id = ?' : ''}
        AND (dien_tap = 0 OR ket_thuc > ?)`)
      .all(...[tu, ...(chiId ? [chiId] : []), caiDat.doc('dien_tap_tra_kho_luc', '') || '']).map((r) => live.layPhien(r.id));
  }

  /** Phiên (đã xong, trong 7 ngày) của một bài đăng — webhook feed của video xem lại. */
  phienCuaBai(postId) {
    const id = String(postId || '');
    if (!id) return null;
    const r = csdl().prepare(`SELECT id FROM phien_live WHERE (fb_video_id IS NOT NULL AND (fb_video_id = ? OR substr(?, -length(fb_video_id) - 1) = '_' || fb_video_id))
                              OR (fb_live_video_id IS NOT NULL AND (fb_live_video_id = ? OR substr(?, -length(fb_live_video_id) - 1) = '_' || fb_live_video_id))
                              ORDER BY tao_luc DESC LIMIT 1`).get(id, id, id, id);
    return r ? live.layPhien(r.id) : null;
  }

  /** Lượt quét: đọc bình luận mới trên video xem lại của từng phiên (theo con trỏ). */
  async quet() {
    let so = 0;
    for (const p of this.phienXemLai().filter((x) => !this.boQua.has(x.id))) {
      const fb = this.layKetNoi({ dien_tap: p.dien_tap });
      if (!fb?.docBinhLuanVideo) continue;
      let ds;
      try {
        ds = await fb.docBinhLuanVideo({ page_id: p.page_id || (p.dien_tap ? 'page_gia' : null), video_id: p.fb_video_id, sau_luc: p.xem_lai_con_tro || p.ket_thuc });
      } catch (e) {
        // Video không còn (đã xóa; Facebook giả sau khi khởi động lại) → báo một lần, bỏ qua video đó tới lần mở máy sau.
        if (/does not exist|không tồn tại/i.test(e.message)) {
          if (!this.boQua.has(p.id)) console.error(`  [xem lại] video xem lại của "${p.ten}" không còn trên Facebook: thôi quét buổi này.`);
          this.boQua.add(p.id);
        } else console.error(`  [xem lại] đọc bình luận ${p.ten} lỗi: ${e.message}`);
        continue;
      }
      let moc = p.xem_lai_con_tro || p.ket_thuc;
      for (const bl of ds) {
        const kq = await this.nhan(p, bl).catch((e) => { console.error(`  [xem lại] ${e.message}`); return null; });
        if (kq?.moi) so += 1;
        if (bl.luc > moc) moc = bl.luc;
      }
      csdl().prepare('UPDATE phien_live SET xem_lai_con_tro = ? WHERE id = ?').run(moc, p.id);
    }
    return so;
  }

  /**
   * Một bình luận xem lại (từ quét hoặc webhook — cùng dạng { id, nguoi_id, ten, noi_dung, luc, la_page?, an_danh? }).
   * @returns {Promise<{moi?:boolean, trung?:boolean, bo?:string, la_chot?:boolean}>}
   */
  async nhan(p, bl, bayGio = Date.now()) {
    if (!p || p.trang_thai !== 'xong') return { bo: 'chua_xong' };
    if (bayGio - new Date(bl.luc).getTime() > HAN_MS) return { bo: 'qua_7_ngay' };
    // Quá 7 ngày sau live, hoặc buổi tập đã trả kho (#87) → không nhận nữa.
    if (!this.phienXemLai(bayGio, p.id).length) return { bo: 'het_nhan' };
    const pageId = p.page_id || (p.dien_tap ? 'page_gia' : '');
    const laPage = !!bl.la_page || (!!bl.nguoi_id && bl.nguoi_id === pageId);
    if (laPage) return { bo: 'cua_page' };
    const r = live.themBinhLuan(p.id, { fb_id: bl.id, nguoi_fb_id: bl.nguoi_id, ten: bl.ten, noi_dung: bl.noi_dung, luc_fb: bl.luc, an_danh: !!bl.an_danh, xem_lai: true });
    if (!r) return { trung: true };
    // Cửa khi_tin_den như bình luận live: ẩn bình luận lộ số (#19), giả shop (F-74)…
    const ctx = { binhLuan: r, layKetNoi: () => this.layKetNoi({ dien_tap: p.dien_tap }) };
    try { await chayCua('khi_tin_den', ctx); } catch (e) { console.error(`  [xem lại] hook lỗi: ${e.message}`); }
    if (r.nhan.includes('gia_shop')) return { moi: true, bo: 'gia_shop' };
    const chot = this.layChotDon?.();
    let laChot = false;
    try { laChot = chot ? await chot.xuLy({ ...ctx.binhLuan, so_doan: null }, p, { xemLai: true }) : false; } catch (e) { console.error(`  [xem lại] chốt đơn lỗi: ${e.message}`); }
    if (!laChot && !ctx.binhLuan.da_an) {
      // Không phải chốt → Hộp thư như bình luận bài đăng (Tư vấn viên trả lời / nhắn riêng theo luật có sẵn).
      await this.layHopThu?.()?.nhan({ loai: 'binh_luan_bai', page_id: pageId, comment_id: bl.id, nguoi_id: bl.nguoi_id, ten: bl.ten, noi_dung: bl.noi_dung,
        post_id: `${pageId}_${p.fb_video_id}`, luc: bl.luc }, p.dien_tap, { tuXemLai: true }).catch((e) => console.error(`  [xem lại] hộp thư lỗi: ${e.message}`));
    }
    return { moi: true, la_chot: laChot };
  }

  /* ---------------- bình luận mục lục ---------------- */

  /**
   * Chữ mục lục: "📌 Mục lục: 02:15 Áo 12 · Sơ mi linen | 08:40 … Chốt: bình luận "chốt 12 đen M", …". Phút tính từ giờ bắt đầu do
   * Facebook trả (bat_dau_fb). Không giá, không tên khách. @returns {string|null} null nếu thiếu giờ Facebook / không có món
   */
  chuMucLuc(p) {
    if (!p?.bat_dau_fb) return null;
    const sp = require('./nghiep-vu/san-pham');
    const goc = new Date(p.bat_dau_fb).getTime();
    const ds = csdl().prepare('SELECT san_pham_id, MIN(tu_luc) AS tu FROM dong_thoi_gian_san_pham WHERE phien_id = ? AND san_pham_id IS NOT NULL GROUP BY san_pham_id ORDER BY tu')
      .all(p.id);
    const muc = [];
    for (const r of ds) {
      let s;
      try { s = sp.laySanPham(r.san_pham_id); } catch { continue; }
      const giay = Math.max(0, Math.round((new Date(r.tu).getTime() - goc) / 1000));
      const hh = Math.floor(giay / 3600);
      const mm = String(Math.floor((giay % 3600) / 60)).padStart(2, '0');
      const ss = String(giay % 60).padStart(2, '0');
      muc.push(`${hh ? `${hh}:${mm}` : mm}:${ss} ${require('./nghiep-vu/the-giu-hang').goiNgan(s)} · ${s.ten}`);
    }
    if (!muc.length) return null;
    const { viDuChot } = require('./chot-don');
    const vd = viDuChot(ds[0]?.san_pham_id)?.chu || 'chốt 12 đen M';
    return require('./nghiep-vu/cau-mau-khach').cau('muc_luc', { muc: muc.join(' | '), vi_du: vd }).slice(0, 8000);
  }

  /** Hẹn đăng mục lục 2 phút sau khi live xong. */
  henMucLuc(phienId, ms = MUC_LUC_SAU_MS) {
    clearTimeout(this.henMuc.get(phienId));
    const t = setTimeout(() => { this.henMuc.delete(phienId); this.dangMucLuc(phienId).catch((e) => console.error(`  [mục lục] ${e.message}`)); }, ms);
    t.unref?.();
    this.henMuc.set(phienId, t);
  }

  /**
   * Đăng mục lục (một lần; `lai` = người bấm "Đăng lại" ở Báo cáo).
   * @returns {Promise<{da_dang:boolean, ly_do?:string, id?:string, chu?:string}>}
   */
  async dangMucLuc(phienId, { lai = false } = {}) {
    const p = live.layPhien(phienId);
    if (p.trang_thai !== 'xong') return { da_dang: false, ly_do: 'Buổi live chưa kết thúc.' };
    if (!lai && !tuDangMucLuc()) return { da_dang: false, ly_do: 'Công tắc "Tự đăng mục lục sau live" đang tắt.' };
    if (caiDat.khanCap()) return { da_dang: false, ly_do: '"Dừng mọi thứ" đang bật: không đăng mục lục.' };
    if (p.muc_luc_luc && !lai) return { da_dang: false, ly_do: 'Mục lục đã đăng rồi.', id: p.muc_luc_fb_id };
    if (!p.fb_video_id) return { da_dang: false, ly_do: 'Chưa có video xem lại của buổi này.' };
    const chu = this.chuMucLuc(p);
    if (!chu) {
      const lyDo = !p.bat_dau_fb ? 'Thiếu giờ bắt đầu do Facebook trả về: không đăng mục lục (phút sẽ sai).'
        : 'Buổi live chưa đi qua món nào: không có gì để ghi mục lục.';
      this.phat('live.canh_bao', { phien_id: p.id, loai: 'muc_luc', chu: `Chưa đăng mục lục. ${lyDo}` });
      return { da_dang: false, ly_do: lyDo };
    }
    const fb = this.layKetNoi({ dien_tap: p.dien_tap });
    const kq = await fb.dangBinhLuan({ page_id: p.page_id || (p.dien_tap ? 'page_gia' : null), video_id: p.fb_video_id, noi_dung: chu });
    csdl().prepare('UPDATE phien_live SET muc_luc_luc = ?, muc_luc_fb_id = ? WHERE id = ?').run(new Date().toISOString(), kq?.id || null, p.id);
    require('./nghiep-vu/nhat-ky-song').ghi({ phienId: p.id, loai: 'su_kien', noiDung: 'Page đã bình luận mục lục lên video xem lại.' });
    return { da_dang: true, id: kq?.id || null, chu };
  }
}

module.exports = { XemLai, HAN_MS, CHU_KY_MS, MUC_LUC_SAU_MS };
