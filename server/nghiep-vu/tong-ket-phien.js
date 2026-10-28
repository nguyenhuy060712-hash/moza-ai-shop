'use strict';

/**
 * Tổng kết sau live (SPEC.md F-102, P32) và mốc từng món trong video (F-103, P08). Mọi con số do MÁY đếm, luôn tính lại theo dữ liệu
 * mới nhất; AI (agent tong_ket) chỉ viết tối đa 3 gợi ý từ số liệu gộp — không tên, không số điện thoại, không nguyên văn bình luận.
 * Buổi tập và buổi thật không bao giờ lẫn (so sánh chỉ với 5 buổi thật trước).
 */

const { csdl } = require('../db/ket-noi');
const { hienTien } = require('./chung');

const NGUONG_GOI_Y = 5; // từ 5 người chốt mới viết gợi ý
const HOI_NHIEU = 5; // "hỏi nhiều ít chốt": từ 5 câu hỏi…
const TY_LE_IT_CHOT = 0.2; // …và chốt / hỏi dưới 20 %
const SO_BUOI_SO_SANH = 5;
const VUNG_TEN_MS = 40e3; // 30 giây chờ đọc tên (chot-don) + ~6 giây Thanh chữ hiện tên, làm tròn lên
const DOAN_CLIP_MS = 45e3;
const VIDEO_TU_XOA_NGAY = 30;

/** Phễu của một buổi. */
function pheu(phienId, db = csdl()) {
  const q = (sql) => db.prepare(sql).get(phienId).n || 0;
  const donBuoi = "FROM don d WHERE d.phien_live_id = ? AND (d.gop_vao IS NULL)";
  return {
    nguoi_chot: q("SELECT COUNT(DISTINCT d.nguoi_fb_id) AS n FROM don d WHERE d.phien_live_id = ? AND d.nguon = 'binh_luan_live' AND d.nguoi_fb_id IS NOT NULL AND d.gop_vao IS NULL"),
    don: q(`SELECT COUNT(*) AS n ${donBuoi}`),
    tra_loi: q(`SELECT COUNT(*) AS n ${donBuoi} AND EXISTS (SELECT 1 FROM tin_nhan t JOIN hoi_thoai h ON h.id = t.hoi_thoai_id
               WHERE h.kenh = 'messenger' AND h.nguoi_fb_id = d.nguoi_fb_id AND t.gui_boi = 'khach' AND t.luc >= d.tao_luc)`),
    xac_nhan: q(`SELECT COUNT(*) AS n ${donBuoi} AND EXISTS (SELECT 1 FROM don_lich_su l WHERE l.don_id = d.id AND l.den = 'da_xac_nhan' AND l.da_hoan_tac = 0)`),
    da_gui: q(`SELECT COUNT(*) AS n ${donBuoi} AND EXISTS (SELECT 1 FROM don_lich_su l WHERE l.don_id = d.id AND l.den = 'da_gui' AND l.da_hoan_tac = 0)`),
    da_giao: q(`SELECT COUNT(*) AS n ${donBuoi} AND d.trang_thai = 'da_giao'`),
    hoan: q(`SELECT COUNT(*) AS n ${donBuoi} AND d.trang_thai = 'hoan'`),
    huy_qua_gio: q(`SELECT COUNT(*) AS n ${donBuoi} AND d.trang_thai = 'da_huy' AND d.ly_do_huy = 'quá giờ giữ hàng'`),
    huy_khach: q(`SELECT COUNT(*) AS n ${donBuoi} AND d.trang_thai = 'da_huy' AND d.ly_do_huy = 'khách hủy'`),
    // Shop hủy / trả kho buổi tập / gộp đơn… (không phải khách, không phải quá giờ).
    huy_shop: q(`SELECT COUNT(*) AS n ${donBuoi} AND d.trang_thai = 'da_huy' AND COALESCE(d.ly_do_huy, '') NOT IN ('quá giờ giữ hàng', 'khách hủy')`),
  };
}

/**
 * Tổng kết một buổi: phễu, món bán chạy, món hỏi nhiều ít chốt, câu hỏi chưa trả lời, chi phí AI, so sánh 5 buổi thật trước.
 */
function tongKetPhien(phienId) {
  const db = csdl();
  const p = db.prepare('SELECT id, ten, dien_tap, bat_dau, ket_thuc, tong_ket FROM phien_live WHERE id = ?').get(phienId);
  if (!p) throw new (require('./chung').LoiNghiepVu)('KHONG_TIM_THAY', 'Không tìm thấy buổi live.', 404);
  const ph = pheu(p.id, db);
  const banChay = db.prepare(`SELECT s.so, s.ten, SUM(x.so_luong) AS so_chiec, SUM(x.so_luong * x.don_gia) AS tien FROM don_dong x JOIN don d ON d.id = x.don_id
      JOIN san_pham s ON s.id = x.san_pham_id WHERE d.phien_live_id = ? AND d.trang_thai NOT IN ('da_huy') GROUP BY s.id ORDER BY so_chiec DESC, tien DESC LIMIT 5`).all(p.id).map((r) => ({ ...r }));
  const hoiNhieu = db.prepare(`SELECT s.id, s.so, s.ten, COUNT(*) AS hoi FROM binh_luan_live b JOIN san_pham s ON s.id = b.san_pham_doan
      WHERE b.phien_id = ? AND b.nhan LIKE '%"cau_hoi"%' GROUP BY s.id HAVING hoi >= ?`).all(p.id, HOI_NHIEU)
    .map((r) => ({ ...r, chot: db.prepare(`SELECT COUNT(DISTINCT d.id) AS n FROM don d JOIN don_dong x ON x.don_id = d.id WHERE d.phien_live_id = ? AND x.san_pham_id = ?`).get(p.id, r.id).n }))
    .filter((r) => r.chot / r.hoi < TY_LE_IT_CHOT).map(({ id, ...r }) => r);
  const chuaTraLoi = db.prepare(`SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ? AND nhan LIKE '%"cau_hoi"%' AND xu_ly = 'moi'`).get(p.id).n;
  const chiPhi = db.prepare('SELECT COALESCE(SUM(chi_phi_usd), 0) AS n FROM agent_run WHERE phien_live_id = ?').get(p.id).n;
  let soSanh = null;
  if (!p.dien_tap && p.bat_dau) {
    const truoc = db.prepare("SELECT id FROM phien_live WHERE dien_tap = 0 AND trang_thai = 'xong' AND bat_dau < ? ORDER BY bat_dau DESC LIMIT ?").all(p.bat_dau, SO_BUOI_SO_SANH);
    if (truoc.length >= SO_BUOI_SO_SANH) {
      const cac = truoc.map((x) => pheu(x.id, db));
      soSanh = Object.fromEntries(Object.keys(ph).map((k) => [k, Math.round((cac.reduce((a, c) => a + c[k], 0) / cac.length) * 10) / 10]));
    }
  }
  return { phien: { id: p.id, ten: p.ten, dien_tap: !!p.dien_tap, bat_dau: p.bat_dau, ket_thuc: p.ket_thuc }, pheu: ph, ban_chay: banChay, hoi_nhieu_it_chot: hoiNhieu,
    cau_hoi_chua_tra_loi: chuaTraLoi, chi_phi_ai_usd: chiPhi, so_sanh: soSanh, goi_y: p.tong_ket ? JSON.parse(p.tong_ket) : null, du_goi_y: ph.nguoi_chot >= NGUONG_GOI_Y };
}

/** Số liệu gộp gửi AI — chỉ số và "số + tên món", KHÔNG tên người, số điện thoại, nguyên văn bình luận. */
function soLieuChoAi(tk) {
  const p = tk.pheu;
  const dong = [
    `Người chốt: ${p.nguoi_chot}; đơn: ${p.don}; khách trả lời tin: ${p.tra_loi}; đã xác nhận: ${p.xac_nhan}; đã gửi: ${p.da_gui}; đã giao: ${p.da_giao}; hoàn: ${p.hoan}; hủy vì quá giờ giữ: ${p.huy_qua_gio}; khách hủy: ${p.huy_khach}; shop hủy: ${p.huy_shop}.`,
    `Câu hỏi chưa ai trả lời: ${tk.cau_hoi_chua_tra_loi}.`,
    ...tk.ban_chay.map((x) => `Bán chạy — số ${x.so} ${x.ten}: ${x.so_chiec} chiếc, ${hienTien(x.tien)}.`),
    ...tk.hoi_nhieu_it_chot.map((x) => `Hỏi nhiều ít chốt — số ${x.so} ${x.ten}: ${x.hoi} câu hỏi, ${x.chot} đơn.`),
    ...(tk.so_sanh ? [`Trung bình 5 buổi trước: người chốt ${tk.so_sanh.nguoi_chot}, trả lời tin ${tk.so_sanh.tra_loi}, xác nhận ${tk.so_sanh.xac_nhan}, hủy quá giờ ${tk.so_sanh.huy_qua_gio}.`] : []),
  ];
  return dong.join('\n');
}

function luuGoiY(phienId, goiY) {
  csdl().prepare('UPDATE phien_live SET tong_ket = ? WHERE id = ?').run(JSON.stringify(goiY), phienId);
}

/* ---------------- mốc từng món trong video (F-103) ---------------- */

const giay = (ms) => Math.max(0, Math.round(ms / 1000));
const hms = (s) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');

/**
 * Mốc từng món: giây bắt đầu / kết thúc trong video (theo giờ bắt đầu do Facebook trả; thiếu thì giờ MOZA thấy live, ghi "±30 giây"),
 * số người chốt trong đoạn, đoạn 45 giây gợi ý cắt không có tên khách (tránh 40 giây sau mỗi lần chốt), chú thích máy điền (không giá).
 */
function mocTungMon(phienId) {
  const db = csdl();
  const p = db.prepare('SELECT * FROM phien_live WHERE id = ?').get(phienId);
  if (!p?.bat_dau) return { moc: [], xap_xi: true, nhac: null };
  const goc = new Date(p.bat_dau_fb || p.bat_dau).getTime();
  const het = new Date(p.ket_thuc || Date.now()).getTime();
  const dong = db.prepare('SELECT san_pham_id, tu_luc FROM dong_thoi_gian_san_pham WHERE phien_id = ? ORDER BY tu_luc, rowid').all(phienId);
  const chot = db.prepare("SELECT luc_fb, nguoi_fb_id FROM binh_luan_live WHERE phien_id = ? AND xu_ly = 'da_chot' ORDER BY luc_fb").all(phienId)
    .map((b) => ({ t: new Date(b.luc_fb).getTime(), nguoi: b.nguoi_fb_id }));
  const coGiongAi = p.che_do_ai === 'noi' || !!p.mai_dan || !!p.doi_ai;
  const ke = require('./lich-live').buoiKe();
  const cm = require('./cau-mau-khach');
  const sp = require('./san-pham');
  const moc = [];
  dong.forEach((x, i) => {
    if (!x.san_pham_id) return;
    const bd = new Date(x.tu_luc).getTime();
    const kt = i + 1 < dong.length ? new Date(dong[i + 1].tu_luc).getTime() : het;
    if (kt <= bd) return;
    let s;
    try { s = sp.laySanPham(x.san_pham_id); } catch { return; }
    const trong = chot.filter((c) => c.t >= bd && c.t < kt);
    const vung = chot.map((c) => [c.t, c.t + VUNG_TEN_MS]);
    let clip = null;
    for (const batDau of [bd, ...vung.map((v) => v[1])].sort((a, b) => a - b)) {
      if (batDau < bd || batDau + DOAN_CLIP_MS > kt) continue;
      if (vung.some(([a, b]) => a < batDau + DOAN_CLIP_MS && b > batDau)) continue;
      clip = [batDau, batDau + DOAN_CLIP_MS];
      break;
    }
    const cuPhap = sp.cuPhapChot(s);
    const chu = [cm.cau('chu_thich_clip', { ten_sp: s.ten, so: s.so, cu_phap: cuPhap }), ke ? cm.cau('chu_thich_lich', { lich_ke: ke.chu }) : null,
      coGiongAi ? cm.cau('chu_thich_giong_ai') : null].filter(Boolean).join(' · ');
    moc.push({
      so: s.so, ten: s.ten, tu: hms(giay(bd - goc)), den: hms(giay(kt - goc)), tu_giay: giay(bd - goc), den_giay: giay(kt - goc),
      nguoi_chot: new Set(trong.map((c) => c.nguoi).filter(Boolean)).size,
      clip: clip ? { tu: hms(giay(clip[0] - goc)), den: hms(giay(clip[1] - goc)) } : null,
      clip_ghi_chu: clip ? null : 'Không có 45 giây liền không có tên khách: cắt khung chỉ lấy camera hoặc Màn hình sản phẩm, bỏ tiếng đoạn đọc tên.',
      chu_thich: chu,
    });
  });
  const ngay = p.ket_thuc ? Math.floor((Date.now() - new Date(p.ket_thuc).getTime()) / 86400e3) : 0;
  return { moc, xap_xi: !p.bat_dau_fb, co_giong_ai: coGiongAi, nhac: { con_ngay_video: Math.max(0, VIDEO_TU_XOA_NGAY - ngay) } };
}

/* ---------------- bảng từng đoạn của buổi (F-117, BH12) ---------------- */

const SO_PHUT_TOI_THIEU = 10; // từ 10 phút số liệu mới dựng bảng đoạn
const TY_LE_BO_DI = 0.2; // người xem tụt từ 20 % trong đoạn = "người xem bỏ đi"

/**
 * Bảng từng đoạn (món) của một buổi: giờ bắt đầu – kết thúc (cùng gốc giờ với mốc F-103), người xem đầu / cuối đoạn (từ `so_lieu_phut`),
 * người chốt, câu hỏi; đánh dấu `ra_don` (người chốt ≥ trung bình các đoạn món và > 0) và `bo_di` (người xem tụt ≥ 20 %). Chỉ khi buổi
 * có từ 10 phút số liệu. Mọi con số do máy đếm; không tên người, không nguyên văn bình luận.
 */
function bangDoan(phienId) {
  const db = csdl();
  const p = db.prepare('SELECT * FROM phien_live WHERE id = ?').get(phienId);
  if (!p?.bat_dau) return { du_so_lieu: false, so_phut: 0, doan: [] };
  const phutSo = db.prepare('SELECT phut, nguoi_xem FROM so_lieu_phut WHERE phien_id = ? ORDER BY phut').all(phienId);
  const soPhut = phutSo.length;
  if (soPhut < SO_PHUT_TOI_THIEU) return { du_so_lieu: false, so_phut: soPhut, doan: [] };
  const batDau = new Date(p.bat_dau).getTime();
  const goc = new Date(p.bat_dau_fb || p.bat_dau).getTime();
  const het = new Date(p.ket_thuc || Date.now()).getTime();
  const dong = db.prepare('SELECT san_pham_id, tu_luc FROM dong_thoi_gian_san_pham WHERE phien_id = ? ORDER BY tu_luc, rowid').all(phienId);
  const chot = db.prepare("SELECT luc_fb, nguoi_fb_id FROM binh_luan_live WHERE phien_id = ? AND xu_ly = 'da_chot'").all(phienId)
    .map((b) => ({ t: new Date(b.luc_fb).getTime(), nguoi: b.nguoi_fb_id }));
  const hoi = db.prepare(`SELECT luc_nhan FROM binh_luan_live WHERE phien_id = ? AND nhan LIKE '%"cau_hoi"%' AND nhan NOT LIKE '%"cua_page"%'`).all(phienId)
    .map((b) => new Date(b.luc_nhan).getTime());
  const sp = require('./san-pham');
  const doan = [];
  dong.forEach((x, i) => {
    if (!x.san_pham_id) return;
    const bd = new Date(x.tu_luc).getTime();
    const kt = i + 1 < dong.length ? new Date(dong[i + 1].tu_luc).getTime() : het;
    if (kt <= bd) return;
    let s;
    try { s = sp.laySanPham(x.san_pham_id); } catch { return; }
    const pa = Math.max(0, Math.floor((bd - batDau) / 60000));
    const pb = Math.max(pa, Math.floor((kt - 1 - batDau) / 60000));
    const xem = phutSo.filter((r) => r.phut >= pa && r.phut <= pb && r.nguoi_xem != null).map((r) => r.nguoi_xem);
    const dau = xem.length >= 2 ? xem[0] : null;
    const cuoi = xem.length >= 2 ? xem[xem.length - 1] : null;
    doan.push({
      so: s.so, ten: s.ten, tu_giay: giay(bd - goc), den_giay: giay(kt - goc), tu: hms(giay(bd - goc)), den: hms(giay(kt - goc)),
      so_phut: Math.max(1, Math.round((kt - bd) / 60000)), nguoi_xem_dau: dau, nguoi_xem_cuoi: cuoi,
      nguoi_chot: new Set(chot.filter((c) => c.t >= bd && c.t < kt).map((c) => c.nguoi).filter(Boolean)).size,
      cau_hoi: hoi.filter((t) => t >= bd && t < kt).length,
    });
  });
  const tb = doan.length ? doan.reduce((a, d) => a + d.nguoi_chot, 0) / doan.length : 0;
  for (const d of doan) {
    d.ra_don = d.nguoi_chot > 0 && d.nguoi_chot >= tb;
    d.bo_di = d.nguoi_xem_dau != null && d.nguoi_xem_dau > 0 && (d.nguoi_xem_dau - d.nguoi_xem_cuoi) / d.nguoi_xem_dau >= TY_LE_BO_DI;
  }
  return { du_so_lieu: true, so_phut: soPhut, doan, xap_xi: !p.bat_dau_fb };
}

/** Số liệu đoạn gửi AI: chỉ số + "số, tên món" — KHÔNG tên người, số điện thoại, nguyên văn bình luận. */
function soLieuDoanChoAi(bang) {
  const dong = bang.doan.map((d, i) => `Đoạn ${i + 1} — số ${d.so} ${d.ten}: ${d.so_phut} phút; ${d.nguoi_xem_dau != null ? `người xem ${d.nguoi_xem_dau} → ${d.nguoi_xem_cuoi}; ` : ''}`
    + `${d.nguoi_chot} người chốt; ${d.cau_hoi} câu hỏi.${d.ra_don ? ' RA ĐƠN.' : ''}${d.bo_di ? ' NGƯỜI XEM BỎ ĐI.' : ''}`);
  const phut = [...new Set(bang.doan.map((d) => d.so_phut))].sort((a, b) => a - b);
  return [`Buổi có ${bang.so_phut} phút số liệu.`, ...dong, `Thời lượng mỗi đoạn chỉ được chọn trong các số phút: ${phut.join(', ')}.`].join('\n');
}

module.exports = { pheu, tongKetPhien, soLieuChoAi, luuGoiY, mocTungMon, bangDoan, soLieuDoanChoAi, SO_PHUT_TOI_THIEU, NGUONG_GOI_Y, VUNG_TEN_MS, DOAN_CLIP_MS };
