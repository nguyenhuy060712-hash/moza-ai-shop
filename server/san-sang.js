'use strict';

/**
 * Bảng "Sẵn sàng lên sóng" (SPEC.md F-77, #106): gom trạng thái máy tự kiểm được trước buổi live — không có SQL, chỉ đọc khối
 * Nghiệp vụ và dịch vụ. Chỉ hiện dòng đỏ / vàng khi có lỗi (kèm cách sửa); không còn dòng nào → "Sẵn sàng". Thêm 3 ô người tự tích
 * theo buổi, phép thử "chốt test", câu ghim và câu mô tả buổi live có nút Chép. KHÔNG khóa nút Bắt đầu.
 */

const caiDat = require('./nghiep-vu/cai-dat');
const chiPhi = require('./nghiep-vu/chi-phi');
const fbPage = require('./nghiep-vu/fb-page');
const live = require('./nghiep-vu/live');
const sp = require('./nghiep-vu/san-pham');
const kho = require('./nghiep-vu/kho');
const cm = require('./nghiep-vu/cau-mau-khach');
const { dongTaiKhoan } = require('./nghiep-vu/gia-shop');

const TICH = [
  { k: 'thao_luan', chu: 'Đã tắt chế độ "Thảo luận" (Discussion) của buổi live — để bình luận không bị Facebook gom, MOZA đọc đủ.' },
  { k: 'binh_luan_tin_nhan', chu: 'Đã tắt "Bình luận → tin nhắn" tự động trong Meta Business Suite — để khách không nhận hai tin, MOZA không bị chiếm lượt nhắn riêng.' },
  // F-110 (BH10): tách riêng, nhớ 7 ngày (không theo buổi) — Meta không có API đọc "Business AI đang bật" (docs/11 T10).
  { k: 'business_ai', lau: true, chu: 'Đã tắt trợ lý AI của Facebook (Business AI) trong Meta Business Suite → Hộp thư → Cài đặt → Định tuyến hội thoại: MOZA là bên trả lời chính.' },
  { k: 'cau_ghim', chu: 'Đã dán và ghim câu ghim dưới đây lên buổi live.' },
];
const NHO_TICH_LAU_MS = 7 * 86400e3;
const CO_BUSINESS_AI_MS = 24 * 3600e3;

/** Ô tích và kết quả "chốt test" — lưu theo phiên (cài đặt `san_sang_tich`); ô "lâu" lưu ở `san_sang_tich_lau` {ma: lúc}, nhớ 7 ngày. */
function docTich(phienId, bayGio = new Date()) {
  const x = caiDat.doc('san_sang_tich', {}) || {};
  const t = x.phien_id === phienId ? x : { phien_id: phienId };
  const lau = caiDat.doc('san_sang_tich_lau', {}) || {};
  for (const k of TICH.filter((y) => y.lau).map((y) => y.k)) t[k] = !!lau[k] && new Date(bayGio).getTime() - new Date(lau[k]).getTime() < NHO_TICH_LAU_MS;
  return t;
}

function datTich(phienId, k, bat, bayGio = new Date()) {
  const o = TICH.find((t) => t.k === k);
  if (!o) throw new Error(`Ô tích lạ: ${k}`);
  if (o.lau) {
    const lau = { ...(caiDat.doc('san_sang_tich_lau', {}) || {}) };
    if (bat) lau[k] = new Date(bayGio).toISOString();
    else delete lau[k];
    caiDat.ghi('san_sang_tich_lau', lau);
    return docTich(phienId, bayGio);
  }
  const x = caiDat.doc('san_sang_tich', {}) || {};
  const t = x.phien_id === phienId ? x : { phien_id: phienId };
  t[k] = !!bat;
  caiDat.ghi('san_sang_tich', t);
  return docTich(phienId, bayGio);
}

/**
 * F-110: dấu hiệu gián tiếp có ứng dụng khác (thường là trợ lý AI của Facebook) đang trả lời khách — tin về kênh "standby" hoặc gửi tin
 * lỗi 10/2018300 (Conversation Routing). Ghi cờ kèm lúc; bảng Sẵn sàng báo đỏ trong 24 giờ.
 */
function ghiBusinessAi(lyDo, bayGio = new Date()) {
  try { caiDat.ghi('business_ai_nghi', { luc: new Date(bayGio).toISOString(), ly_do: lyDo }); } catch { /* chưa mở cơ sở dữ liệu */ }
}

function ghiChotTest(phienId, kq) {
  const goc = caiDat.doc('san_sang_tich', {}) || {};
  const x = goc.phien_id === phienId ? goc : { phien_id: phienId };
  x.chot_test = { ...kq, luc: new Date().toISOString() };
  caiDat.ghi('san_sang_tich', x);
  return docTich(phienId);
}

/** Phiên để kiểm: phiên đang mở (chờ live / đang live), không có thì null (chỉ kiểm phần chung). */
function phienKiem(phienId = null) {
  if (phienId) { try { return live.layPhien(phienId); } catch { return null; } }
  return live.phienDangMo();
}

/** Các món trong kịch bản của phiên (theo thứ tự đoạn). */
function monCuaPhien(p) {
  if (!p) return [];
  const ids = [...new Set((p.kich_ban?.doan || []).map((d) => d.san_pham_id).filter(Boolean))];
  return ids.map((id) => { try { return sp.laySanPham(id); } catch { return null; } }).filter(Boolean);
}

/** Câu ghim (F-77): cú pháp chốt với ví dụ món đầu, "xem cả Tin nhắn chờ", dòng tài khoản (F-74), link m.me của buổi (F-70). */
function cauGhim(p) {
  const { viDuChot } = require('./chot-don');
  const vd = viDuChot(monCuaPhien(p)[0]?.id)?.chu || 'chốt 12 đen M';
  const pageId = p?.page_id || (p?.dien_tap ? 'page_gia' : fbPage.danhSach()[0]?.id);
  const link = pageId ? fbPage.linkMme(pageId, p?.id || null) : null;
  const cau = cm.cau('cau_ghim', { cach_chot: sp.cachChotChung(monCuaPhien(p)), vi_du: vd, dong_tk: dongTaiKhoan(), link: link || '' }).replace(/\s*Chưa thấy tin: \.?$/, '');
  // F-93: buổi có giá live → nói rõ luật áp giá (tránh tranh cãi chốt phút chót).
  const coGiaLive = p?.id && require('./nghiep-vu/gia-ban').giaLiveCuaPhien(p.id).some((x) => x.gia_live != null);
  return coGiaLive ? `${cau} ${cm.cau('ghim_gia_live')}` : cau;
}

/** Câu mô tả buổi live (F-75): nói rõ buổi live có trợ lý AI và người phụ trách. */
function cauMoTa() {
  const bh = caiDat.banHang();
  return cm.cau(bh.phu_trach ? 'cau_mo_ta' : 'cau_mo_ta_chua_phu_trach', { phu_trach: bh.phu_trach || '' });
}

/**
 * @param {object} o
 * @param {string|null} [o.phienId]
 * @param {object|null} [o.dv]  dịch vụ (ketNoiFb) — không có (test nghiệp vụ) thì bỏ phần Facebook thật
 * @param {Date} [o.bayGio]  test tua ngày (model sắp tắt)
 * @returns {{do:object[], vang:object[], tich:object[], chot_test:object|null, cau_ghim:string, cau_mo_ta:string, san_sang:boolean, phien_id:string|null}}
 */
function kiem({ phienId = null, dv = null, bayGio = new Date() } = {}) {
  const p = phienKiem(phienId);
  const that = p ? !p.dien_tap : true;
  const doDs = [];
  const vang = [];
  // Đỏ
  if (caiDat.khanCap()) doDs.push({ ma: 'khan_cap', chu: 'Đang "Dừng mọi thứ": AI không nói, MOZA không gửi gì ra Facebook.', nut: { chu: 'Tắt', hanh_dong: 'tat_khan_cap' } });
  for (const [id, x] of Object.entries(fbPage.dsBiCam())) {
    doDs.push({ ma: 'page_bi_cam', chu: `Meta đang tạm khóa nhắn tin của Page ${fbPage.lay(id)?.ten || id}: không nhắn riêng được. Xem Meta Business Suite → Chất lượng Page.`, chi_tiet: x?.ly_do || null });
  }
  if (that && dv?.ketNoiFb) {
    const fb = dv.ketNoiFb.trangThaiGon();
    if (fb.muc === 'do') doDs.push({ ma: 'fb_ma', chu: `${fb.chu}. Vào Cài đặt → Facebook lấy mã mới.` });
    else if (fb.muc === 'vang' && fb.ket_noi) vang.push({ ma: 'webhook', chu: `${fb.chu}: tin vẫn về nhưng chậm hơn. Xem Cài đặt → Facebook (đường hầm).` });
    else if (!fb.ket_noi && p && !p.dien_tap) doDs.push({ ma: 'fb_chua_noi', chu: 'Facebook thật chưa kết nối: buổi live thật không đọc được bình luận. Vào Cài đặt → Facebook.' });
    const cd = caiDat.doc('fb_chua_duyet', null);
    if (cd?.luc && Date.now() - new Date(cd.luc).getTime() < 7 * 86400e3) doDs.push({ ma: 'fb_chua_duyet', chu: 'Ứng dụng Meta chưa được duyệt quyền nhắn tin: chỉ người có vai trò trong ứng dụng nhận được tin. Xem danh sách việc của chủ shop.' });
  }
  // Model sắp tắt (F-111): đã tắt → đỏ; còn ≤ 30 ngày → vàng. Nút "Đổi model" mở Agent & Skill (Agent) hoặc Cài đặt.
  for (const x of chiPhi.modelSapTat(bayGio)) {
    const ngay = x.tat_ngay.split('-').reverse().join('/');
    const nut = { chu: 'Đổi model', hanh_dong: 'doi_model', den: x.noi_dung.startsWith('Agent') ? '#/cai-dat/tro-ly-ai/van-hanh' : '#/cai-dat' };
    if (x.con_ngay <= 0) doDs.push({ ma: 'model_da_tat', chu: `${x.noi_dung} đang dùng ${x.model} — hãng đã tắt model này ngày ${ngay}. Đổi sang model khác.`, nut });
    else vang.push({ ma: 'model_sap_tat', chu: `${x.noi_dung} đang dùng ${x.model} — hãng tắt ngày ${ngay} (còn ${x.con_ngay} ngày). Đổi model trước ngày đó.`, nut });
  }
  // F-110: trợ lý AI của Facebook — cờ gián tiếp trong 24 giờ (và chưa tích "Đã tắt" sau lúc đó) → đỏ; chưa tích trong 7 ngày → vàng.
  const coBai = caiDat.doc('business_ai_nghi', null);
  const tichBai = (caiDat.doc('san_sang_tich_lau', {}) || {}).business_ai;
  const lucBai = coBai?.luc ? new Date(coBai.luc).getTime() : 0;
  if (lucBai && new Date(bayGio).getTime() - lucBai < CO_BUSINESS_AI_MS && !(tichBai && new Date(tichBai).getTime() > lucBai)) {
    doDs.push({ ma: 'business_ai', chu: 'Có ứng dụng khác (có thể là trợ lý AI của Facebook) đang trả lời khách của Page'
      + `${coBai.ly_do === 'loi_2018300' ? ' — MOZA gửi tin bị Facebook chặn (lỗi 10/2018300)' : ' — tin của khách về kênh chờ (standby)'}. `
      + 'Tắt trong Meta Business Suite → Hộp thư → Cài đặt → Định tuyến hội thoại (chọn MOZA là ứng dụng trả lời chính), rồi tích ô "Đã tắt trợ lý AI của Facebook".' });
  } else if (!docTich(p?.id || null, bayGio).business_ai) {
    vang.push({ ma: 'business_ai_chua_tich', chu: 'Chưa xác nhận đã tắt trợ lý AI của Facebook (Business AI): nếu còn bật, Facebook có thể trả lời khách thay MOZA. Kiểm trong Meta Business Suite rồi tích ô bên dưới (nhớ 7 ngày).' });
  }
  // Vàng
  const dung = caiDat.dungAi();
  const cp = chiPhi.mucDo();
  if (dung?.bat) vang.push({ ma: 'dung_ai', chu: 'AI đang tạm dừng (chạm trần chi phí) — chốt đơn bằng mã vẫn chạy. Bấm "Chạy AI tiếp" ở dải đỏ trên cùng.' });
  else if (cp?.muc === 'vang') vang.push({ ma: 'chi_phi', chu: `Chi phí AI đã tới ${Math.round(cp.ty_le * 100)}% mức trần: chạm trần thì AI tạm dừng. Nâng trần ở Cài đặt → Trợ lý AI → Vận hành nếu cần.` });
  const bh = caiDat.banHang();
  if (require('./nghiep-vu/don').phiShipTheoCaiDat(0).chua_dat) vang.push({ ma: 'phi_ship', chu: 'Chưa đặt phí ship: AI sẽ nói "shop báo phí ship sau". Điền ở Cài đặt → Bán hàng.' });
  if (!bh.phu_trach) vang.push({ ma: 'phu_trach', chu: 'Chưa điền "Người phụ trách buổi live": nhãn trên Thanh chữ chỉ ghi "Trợ lý AI của shop". Điền ở Cài đặt → Bán hàng.' });
  const mon = monCuaPhien(p);
  const nhom = { het: [], anh: [], ngung: [], size: [] };
  for (const s of mon) {
    if (s.trang_thai !== 'dang_ban') { nhom.ngung.push(s.so); continue; }
    if (!kho.conHang(s.id).some((x) => x.con_ban_duoc > 0)) nhom.het.push(s.so);
    if (!(s.anh || []).length) nhom.anh.push(s.so);
    if (sp.doDayDu(s).thieu.includes('bảng size')) nhom.size.push(s.so);
  }
  const ds = (a) => a.map((n) => `số ${n}`).join(', ');
  if (nhom.het.length) vang.push({ ma: 'het_hang', chu: `${nhom.het.length} món trong kịch bản đã hết hàng (${ds(nhom.het)}): khách chốt sẽ nhận câu "vừa hết". Nhập thêm kho hoặc bỏ khỏi kịch bản.` });
  if (nhom.ngung.length) vang.push({ ma: 'ngung_ban', chu: `${nhom.ngung.length} món trong kịch bản không Đang bán (${ds(nhom.ngung)}): khách không chốt được.` });
  if (nhom.anh.length) vang.push({ ma: 'thieu_anh', chu: `${nhom.anh.length} món chưa có ảnh (${ds(nhom.anh)}): thẻ giữ hàng thành thẻ chữ, Màn hình sản phẩm trống.` });
  if (nhom.size.length) vang.push({ ma: 'bang_size', chu: `${nhom.size.length} món quần áo chưa có bảng size (${ds(nhom.size)}): AI không tư vấn size được.` });
  if (p?.doi_ai) {
    const tran = Number(require('./cau-hinh/mac-dinh.json').doi_ai?.tran_cau_chen_moi_buoi) || 60;
    const da = require('./nghiep-vu/nhat-ky').demCauChen(p.id);
    if (da >= tran * 0.8) vang.push({ ma: 'cau_chen', chu: `Đội AI đã dùng ${da}/${tran} câu chen của buổi: còn ít, chỉ câu quan trọng (vừa chốt, vừa hết) được chen.` });
  }
  const t = docTich(p?.id || null, bayGio);
  return {
    phien_id: p?.id || null,
    do: doDs,
    vang,
    tich: TICH.map((x) => ({ ...x, bat: !!t[x.k] })),
    chot_test: t.chot_test || null,
    cau_ghim: cauGhim(p),
    cau_mo_ta: cauMoTa(),
    san_sang: !doDs.length && !vang.length,
  };
}

module.exports = { kiem, datTich, ghiChotTest, docTich, cauGhim, cauMoTa, ghiBusinessAi, TICH };
