'use strict';

/**
 * Miệng của Mai (SPEC.md F-22, #30): điều phối phiên GPT Live 1 / Gemini 3.8 Live trong buổi live.
 *
 *  - Tự mở khi phiên đang live ở chế độ "Co-host được nói", tự đóng khi đổi chế độ, hết live hoặc "Dừng mọi thứ"
 *    bật; đổi miệng giữa phiên thì đóng miệng cũ, mở miệng mới. Mỗi giây so trạng thái phiên với miệng đang mở,
 *    nên khởi động lại phần mềm giữa buổi live cũng tự mở lại.
 *  - Dữ liệu đưa thẳng (#30): lời dặn vai trò "mieng" + thẻ các sản phẩm Đang bán trong phiên (giá, còn bán được lúc mở)
 *    + Sổ tay shop + phí ship nằm trong lời dặn của phiên miệng; đổi đoạn thì gửi lại thẻ của sản phẩm đó (còn bán được mới).
 *  - Tiếng micro của người dẫn đi vào miệng (chép lời người dẫn nhường micro); tiếng Mai gửi tới Màn hình người dẫn
 *    (`loa.bat`) để phát ra loa. Chữ chép lời người dẫn đến lúc Mai đang phát bị bỏ (có thể là tiếng Mai lọt vào micro).
 *  - DỪNG AI: báo trình duyệt bỏ tiếng đang chờ, báo miệng im, và giữ Mai im (bỏ mọi tiếng miệng còn nói tiếp) tới khi có
 *    câu hỏi mới hoặc người dẫn nói với Mai; khi đó chỉ phát từ câu nói mới (sau một khoảng lặng). Chạy thật 23/9/2026:
 *    GPT Live 1 nói nốt câu dở khoảng 6 giây; Gemini có lúc tự nói lại cả đoạn vài giây sau.
 *  - Mở không được / rớt không nối lại được → hạ về "Chỉ gợi ý" và báo người dẫn.
 *  - Chi phí ghi nhật ký (agent "mieng") mỗi 5 phút và khi đóng; tính vào mức trần.
 *  - Mai dẫn chính (bản 2.7, #47, F-43): GPT Live 1 và Gemini Live không tự nói liên tục (nói xong một lượt là chờ), nên
 *    MOZA cầm nhịp: đưa Mai từng đoạn; tiếng Mai lặng thì chuyển đoạn và đưa đoạn sau; người dẫn nói xen thì chờ Mai đáp
 *    rồi dẫn tiếp; câu hỏi người xem xếp hàng tới chỗ nghỉ; hết kịch bản thì quay vòng điểm lại cho người mới vào.
 *  - Giọng có lên có xuống (bản 2.8, #48): GPT Live 1 không có tham số tốc độ, cao độ, cảm xúc — chỉ lời dặn. Lượt đưa
 *    Mai có dòng "Cách nói lượt này: …" lấy từ gợi ý trong ngoặc ở câu "Mai:" của kịch bản; không có gợi ý thì mặc định
 *    cho mở màn, đoạn chốt, điểm lại; đoạn có sản phẩm mà không có gợi ý thì để lời dặn chung lo.
 */

const live = require('../../nghiep-vu/live');
const sp = require('../../nghiep-vu/san-pham');
const { dongCaiDat } = require('../kiem-tra/kiem-tra');
const soTay = require('../../nghiep-vu/so-tay');
const caiDat = require('../../nghiep-vu/cai-dat');
const vaiTro = require('../../nghiep-vu/vai-tro');
const chiPhi = require('../../nghiep-vu/chi-phi');
const nhatKy = require('../../nghiep-vu/nhat-ky');
const kichBan = require('../../nghiep-vu/kich-ban');
const { LoiNghiepVu, boDau, hienTien } = require('../../nghiep-vu/chung');
const { anKhoa } = require('../../khoa');
const { MiengGptLive } = require('./gpt-live');
const { MiengGemini } = require('./gemini-live');
const { MiengGia } = require('./mieng-gia');
const tongGiong = require('../../nghiep-vu/tong-giong');
// F-112: cờ + ngưỡng tin cậy của Decisions trong lúc Mai nói (đọc lại mỗi lần: sửa tệp có tác dụng ngay lần mở miệng sau).
const QD = () => ({ bat: false, nguong: 0.8, lien_tiep: 2, nguong_size: 0.85, size_cach_giay: 30, ...(require('../../cau-hinh/mac-dinh.json').mai_quyet_dinh || {}) });
const { KiemLoiNoiSong } = require('./kiem-loi-noi');

// F-105: "gia" = miệng giả, chỉ cho buổi tập (0 đồng, tập Mai nói nhầm số).
const NHA_MIENG = { openai: MiengGptLive, gemini: MiengGemini, gia: MiengGia };
// 26/10/2026: tab trình duyệt không nhận kịp tiếng Mai (treo, mạng nội bộ chậm) thì bỏ mẩu cho tab đó, không dồn bộ nhớ.
const LOA_U_TOI_DA = 2 * 1024 * 1024;
const CHU_KY_MS = 1000;
const TINH_TIEN_MS = 5 * 60 * 1000;
const HET_CAU_MS = 800; // không nhận tiếng Mai chừng này là hết câu (GPT Live không báo hết tiếng)
const CHOT_LOI_DAN_MS = 1200; // chép lời người dẫn: ngừng chừng này là hết câu
const DOAN_MAI_MOI_MS = 2000; // chữ Mai: nghỉ chừng này là câu nói mới
const BO_SAU_PHAT_MS = 300;
const MO_TOI_DA_MS = 30 * 1000;
const MO_LAI_TOI_DA = 2; // miệng rớt: tự mở lại tối đa 2 lần trong 2 phút, quá thì hạ về "Chỉ gợi ý"
const CUA_SO_MO_LAI_MS = 2 * 60 * 1000;

// Mai dẫn chính (bản 2.7, #47). Số thời gian là mặc định, test rút ngắn được.
const NHIP_DAN = {
  nhipMs: 250, // mỗi 0,25 giây xem đã tới lúc đưa Mai phần tiếp chưa
  nghiMs: 1200, // tiếng Mai phát xong trên loa, lặng chừng này là xong lượt → đưa phần tiếp ("có đoạn nghỉ, nhưng ngắn thôi")
  choDapMs: 3000, // người dẫn thôi nói mà Mai không đáp: chờ chừng này rồi dẫn tiếp
  choMaiNoiMs: 8000, // đưa lượt mà Mai chưa lên tiếng: nhắc lại
};
const NHAC_TOI_DA = 2;
const DOAN_DU_MS = 8000; // bị ngắt khi Mai mới nói đoạn đó chưa tới chừng này (tiếng nói) → nói tiếp đoạn đó
const CHU_VAO_CON_NOI_MS = 1500; // chữ chép lời người dẫn vừa tới trong chừng này: coi như người dẫn còn đang nói
const MO_MAN_TRONG_MS = 60 * 1000; // live mới bắt đầu chưa quá chừng này, đang ở đoạn đầu → Mai mở màn
const CHAO_MOI_MS = 2 * 60 * 1000; // chào tên người vừa bình luận tối đa mỗi 2 phút
const CAU_HOI_CHO_TOI_DA = 5;
const CAU_HOI_HET_MS = 3 * 60 * 1000;
const CAU_HOI_MOI_LUOT = 2;
const LUOT_TOI_DA_KY_TU = 1200; // GPT-Live nhận tối đa 500 token mỗi lần đưa (tài liệu 24/9/2026)
const CHU_SAU_TEN_TOI_THIEU = 150; // Mai nhắc món của đoạn sau rồi còn nói chừng này chữ nữa → Mai đã tự dẫn đoạn đó
const DAU_VE_TOI_DA = 25; // tên món phải nằm gần đầu một câu / vế câu ("Sang áo số 7 nè…"), không phải câu so sánh giữa chừng
// Người dẫn bảo Mai chào kết (so trên chữ bỏ dấu): Mai đáp rồi thôi dẫn, không tự dẫn tiếp sau lời chào.
const CHAO_KET = /tam biet|ket thuc (buoi )?(live|livestream|song|chuong trinh)|chao ket|nghi dan|dung dan/;
// Bình luận không đưa tên cho Mai chào: đã bị Director gắn nhãn xấu hoặc lộ thông tin cá nhân.
const NHAN_KHONG_CHAO = ['spam', 'xuc_pham', 'lua_ai', 'thong_tin_ca_nhan', 'gia_shop'];
// Giọng có lên có xuống (bản 2.8, #48): cách nói MOZA tự ghi khi câu "Mai:" của kịch bản không có gợi ý trong ngoặc.
const CACH_NOI = {
  mo_man: 'hào hứng, rộn ràng, chào đón',
  diem_lai: 'tươi, gọn, nhanh hơn một chút',
  chot: 'ấm, chậm lại, chân thành',
  tra_loi: 'thân tình, rõ ràng',
};

/** Dòng chỉ đạo cách nói của một lượt; gửi riêng, không nằm trong lời Mai đọc. */
const dongCachNoi = (cachNoi) => (cachNoi ? `Cách nói lượt này: ${cachNoi} (làm theo, không đọc ra).` : '');

/**
 * Gói tiếng có tiếng nói không. GPT Live 1 gửi tiếng theo thời gian thực, kể cả khoảng lặng (ghi nhận ở M0), nên
 * "Mai đang nói" và "hết câu" phải tính theo độ to, không theo việc có gói tiếng tới.
 */
function coTiengNoi(pcm, nguong = 300) {
  const m = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  if (!m.length) return false;
  let t = 0;
  for (let i = 0; i < m.length; i++) t += m[i] * m[i];
  return Math.sqrt(t / m.length) > nguong;
}

const tenMieng = (model) => caiDat.MAC_DINH.mieng.find((m) => m.model === model)?.ten || model;

/**
 * Thẻ một sản phẩm, dạng đưa cho miệng (#60: Mai gọi "áo số 12, Sơ mi linen"). Còn bán được tính lúc gửi; đổi giữa buổi thì
 * MOZA gửi cập nhật bối cảnh (#81). Ô "(chưa xác nhận)" Mai không nói như sự thật.
 */
function khoiSanPham(s) {
  return `### ${sp.theChoAi(s)}`;
}

/** Sản phẩm của đoạn (bản mới nhất, đọc lại lúc gửi), hoặc null. */
function spDoan(d) {
  return d?.san_pham_id ? (() => { try { return sp.laySanPham(d.san_pham_id); } catch { return null; } })() : null;
}

/**
 * Ý của một đoạn kịch bản: cả phần "Người dẫn:" lẫn "Mai:" (Mai dẫn chính nói hết). Ý bắt đầu bằng "Kiểm lại" là
 * ghi chú riêng (số chưa chắc…), không đọc lên sóng — tách ra làm lưu ý. Gợi ý cách nói của câu "Mai:" (bản 2.8)
 * trả riêng, không nằm trong ý.
 */
function yDoan(d) {
  const { nguoiDan, mai, cachNoi } = kichBan.tachLoiNhac(d?.loi_nhac);
  const yNoi = [];
  const luuY = [];
  for (const dong of [...nguoiDan.split('\n'), mai]) {
    const s = dong.trim();
    if (s) (/^-?\s*Kiểm lại/iu.test(s) ? luuY : yNoi).push(s);
  }
  return { yNoi, luuY, cachNoi };
}

/** Tên ngắn của một đoạn để nói "đoạn sau là…" và làm dàn ý: "áo số 12 · Sơ mi linen", không thì ý đầu của lời nhắc. */
function tenDoan(p, i) {
  const d = p.kich_ban.doan[i];
  if (!d) return '';
  if (d.san_pham) return d.san_pham.ten_day_du;
  return (yDoan(d).yNoi[0] || 'đoạn chung').replace(/^-\s*/, '').slice(0, 80);
}

/** Dàn ý kịch bản cho lời dặn "Mai dẫn chính": Mai biết cả chương trình để mở màn và nối đoạn. */
function danYKichBan(p) {
  return ['Dàn ý kịch bản (MOZA đưa từng đoạn theo thứ tự này):',
    ...p.kich_ban.doan.map((_, i) => `${i + 1}. ${tenDoan(p, i)}`)].join('\n');
}

/** Cách chốt theo loại hàng trong buổi: quần áo "chốt 12 đen M"; rau củ bán theo kg "chốt 50" (1 kg), "chốt 50 2kg". */
function cachChot(cacSp) {
  const kg = cacSp.find((s) => sp.donVi(s));
  const thuong = cacSp.find((s) => !sp.donVi(s));
  const ds = [];
  if (thuong || !kg) ds.push('bình luận "chốt" + số + màu + size, ví dụ "chốt 12 đen M"');
  if (kg) { const dv = sp.donVi(kg); ds.push(`hàng bán theo ${dv} (rau củ): "chốt ${kg.so}" là 1 ${dv}, "chốt ${kg.so} 2${dv}" là 2 ${dv}; giá nói theo ${dv}, ví dụ "${hienTien(kg.gia)} một ${dv}"`); }
  return ds.join('; ');
}

/** Lời dặn của phiên miệng: lời dặn vai trò + dữ liệu buổi live (sản phẩm Đang bán trong phiên, Sổ tay, phí ship). */
function taoLoiDan(p) {
  const idTrongPhien = [...new Set(p.kich_ban.doan.filter((d) => d.san_pham_id).map((d) => d.san_pham_id))];
  const cacSp = idTrongPhien.map((id) => spDoan({ san_pham_id: id })).filter((x) => x && x.trang_thai === 'dang_ban');
  const cacMuc = soTay.danhSachMuc().filter((m) => m.noi_dung.trim());
  const caiDatBh = dongCaiDat();
  return [
    // Mai dẫn chính (bản 2.7): lời dặn riêng, kèm dàn ý kịch bản.
    vaiTro.loiDan(p.mai_dan ? 'mieng_dan' : 'mieng').noi_dung,
    'DỮ LIỆU MOZA GỬI CHO BUỔI LIVE NÀY',
    p.mai_dan ? danYKichBan(p) : '',
    `Các sản phẩm trong buổi live (${cacSp.length}). Cách chốt của khách: ${cachChot(cacSp)}. Số "còn bán được" đổi liên tục: chỉ nói khi MOZA vừa đưa, hoặc gọi công cụ xem_con_hang.`,
    'Màn hình sản phẩm (người xem thấy trên sóng): khi nói về màu, size, chất liệu, cách phối hay có khách hỏi, gọi chieu_man_hinh để chiếu đúng hình — rồi nói tiếp tự nhiên ("cả nhà nhìn màn hình nè"), không đọc kết quả công cụ.',
    ...cacSp.map(khoiSanPham),
    caiDatBh.length ? `Bán hàng:\n${caiDatBh.join('\n')}` : '',
    cacMuc.length ? `Sổ tay ${caiDat.tenShop()}:` : '',
    ...cacMuc.map((m) => `### ${m.tieu_de}\n${m.noi_dung.trim()}`),
    // F-127: tông giọng shop chọn — cuối lời dặn để model nhớ rõ nhất.
    tongGiong.doanLoiDan(),
  ].filter(Boolean).join('\n\n');
}

/** Tin nhắn báo miệng người dẫn vừa chuyển đoạn, kèm thẻ sản phẩm của đoạn đó và lời dẫn của kịch bản (bản 2.5). */
function tinDoan(p) {
  const d = p.kich_ban.doan[p.doan_hien_tai];
  const so = `đoạn ${p.doan_hien_tai + 1}/${p.kich_ban.doan.length}`;
  const t = spDoan(d);
  const loiDan = kichBan.tachLoiNhac(d?.loi_nhac).nguoiDan;
  // Chạy thật 24/9/2026: không dặn rõ thì Mai đọc luôn phần của người dẫn (xưng "mình", đọc dài từng con số).
  const kemLoiDan = loiDan ? `\n\nPhần người dẫn tự nói ở đoạn này (Mai không đọc lại; người dẫn im lâu thì Mai chỉ nói ngắn cho liền mạch):\n${loiDan}` : '';
  if (!t) return `Người dẫn đang nói ${so}: đoạn chung, không thuộc sản phẩm nào.${kemLoiDan}`;
  if (t.trang_thai !== 'dang_ban') return `Người dẫn đang nói ${so}: ${sp.tenDayDu(t)} không còn Đang bán, không nói về món này.`;
  return `Người dẫn đang nói ${so} — ${sp.tenDayDu(t)}. Thẻ sản phẩm (còn bán được lúc này):\n\n${khoiSanPham(t)}${kemLoiDan}`;
}

/**
 * Câu Mai nói theo kịch bản khi người dẫn chuyển tới đoạn này (bản 2.5, F-37): phần "Mai:" của lời nhắc, kèm gợi ý
 * cách nói trong ngoặc nếu có (bản 2.8). Sản phẩm của đoạn thôi Đang bán thì không nói.
 * @returns {{cau:string, cachNoi:string}}
 */
function cauMaiTheoKichBan(p) {
  const d = p.kich_ban.doan[p.doan_hien_tai];
  if (d?.san_pham_id && spDoan(d)?.trang_thai !== 'dang_ban') return { cau: '', cachNoi: '' };
  const { mai, cachNoi } = kichBan.tachLoiNhac(d?.loi_nhac);
  return { cau: mai, cachNoi };
}

/** Mai dẫn chính: bối cảnh của đoạn i (không đọc to) — thẻ sản phẩm và các ý "Kiểm lại" của kịch bản. */
function boiCanhDan(p, i) {
  const d = p.kich_ban.doan[i];
  const so = `đoạn ${i + 1}/${p.kich_ban.doan.length}`;
  const t = spDoan(d);
  const { luuY } = yDoan(d);
  const kemLuuY = luuY.length ? `\n\nLưu ý của kịch bản (không đọc lên sóng):\n${luuY.join('\n')}` : '';
  if (!t) return `Mai đang dẫn ${so}: đoạn chung, không thuộc sản phẩm nào.${kemLuuY}`;
  return `Mai đang dẫn ${so} — ${sp.tenDayDu(t)}. Thẻ sản phẩm (còn bán được lúc này):\n\n${khoiSanPham(t)}${kemLuuY}`;
}

/**
 * Công cụ tra cứu của miệng (#80): `xem_san_pham`, `xem_con_hang` — dùng đúng công cụ của AI (cùng luật: chỉ sản phẩm
 * Đang bán), nhưng gọi thẳng vì miệng không đi qua runtime. Chỉ sản phẩm trong phiên.
 */
function traCuuMieng(phienId, ten, thamSo) {
  if (ten === 'chieu_man_hinh') return chieuManHinhMieng(phienId, thamSo);
  if (!['xem_san_pham', 'xem_con_hang'].includes(ten)) return { loi: `Không có công cụ ${ten}.` };
  const s = sp.layTheoSo(thamSo?.so);
  if (!s || !live.sanPhamTrongPhien(phienId).includes(s.id)) return { loi: `Sản phẩm số ${thamSo?.so} không có trong buổi live này.` };
  const cc = require('../cong-cu/san-pham').find((c) => c.ten === ten);
  try {
    return cc.chay({ so: s.so }, { phienLiveId: phienId });
  } catch (e) {
    return { loi: e.message };
  }
}

/**
 * F-112 (tắt mặc định — mac-dinh.json `mai_quyet_dinh.bat`): câu hỏi Decisions chạy trên chữ Mai nói ra (GPT-Live `session.triggers`):
 * "Mai đang giới thiệu món nào?" (các món trong kịch bản + khong_doi) và "Mai vừa mời khách xem bảng size / chất liệu?".
 */
function cauHoiQuyetDinh(p) {
  const mon = [...new Map(p.kich_ban.doan.filter((d) => d.san_pham).map((d) => [d.san_pham.id, d.san_pham])).values()].slice(0, 250);
  if (!mon.length) return [];
  return [
    { ten: 'mon_dang_noi', loai: 'choice', chiDan: 'Theo câu Mai (trợ lý dẫn livestream bán hàng) vừa nói, Mai đang giới thiệu món nào? Chỉ nhắc lướt, so sánh, hoặc chưa đổi món thì chọn khong_doi.',
      luaChon: [...mon.map((x) => ({ gt: `so_${x.so}`, moTa: `Số ${x.so}: ${x.ten}` })), { gt: 'khong_doi', moTa: 'Chưa đổi món / không rõ' }] },
    { ten: 'moi_xem_size', loai: 'predicate', chiDan: 'Mai vừa mời khách nhìn bảng size hoặc chất liệu trên màn hình?' },
  ];
}

/** #90: Mai chiếu hình lên Màn hình sản phẩm (chỉ sản phẩm trong phiên). Trả lời ngắn để Mai nói tiếp, không đọc kết quả. */
function chieuManHinhMieng(phienId, t = {}) {
  let mh;
  try { mh = require('../../dich-vu').dichVu().manHinh; } catch { mh = null; }
  if (!mh) return { loi: 'Màn hình sản phẩm chưa mở.' };
  if (t.mau !== 'danh_sach') {
    const s = sp.layTheoSo(t.so);
    if (!s || !live.sanPhamTrongPhien(phienId).includes(s.id)) return { loi: `Sản phẩm số ${t.so} không có trong buổi live này.` };
  }
  try {
    const kq = mh.chieu({ mau: t.mau, so: t.so || null, mau_sac: t.mau_sac || null, chieu_cao: t.chieu_cao || null, can_nang: t.can_nang || null }, { boi: 'ai', lyDo: 'Mai đang nói về món này' });
    return { da_chieu: kq.hien?.ten_mau || t.mau, dong_hop: kq.hien?.dong_hop?.length ? kq.hien.dong_hop : undefined };
  } catch (e) {
    return { loi: e.message };
  }
}

const MO_LUOT = {
  mo_man: 'Buổi live vừa bắt đầu — Mai mở màn ngay: chào cả nhà, nói mình là trợ lý AI của shop, món hot nhất hôm nay, và cách chốt đơn.',
  tiep_tuc: 'Từ giờ Mai là người dẫn chính: nối lời tự nhiên rồi dẫn đoạn này.',
  noi_tiep: 'Mai nói tiếp phần còn lại của đoạn đang dẫn, không lặp lại phần đã nói.',
  tay: 'Người dẫn vừa chuyển sang đoạn này: Mai dẫn luôn.',
  dan_tiep: 'Người dẫn bảo Mai dẫn tiếp: nối lời tự nhiên rồi dẫn đoạn này.',
};

/**
 * Lượt MOZA đưa Mai khi Mai dẫn chính (#47): việc cần nói ngay — tên người vừa bình luận, ý của đoạn, đoạn sau là gì.
 * Câu hỏi người xem đi lượt riêng (loiTraLoi). Gọn dưới LUOT_TOI_DA_KY_TU (GPT-Live: tối đa 500 token mỗi lần); ý của
 * đoạn co lại trước tiên.
 */
function loiGiaoDoan(p, i, { mo = null, vong = 1, ke = null, tenMoi = [], loiNguoiDan = null } = {}) {
  const ds = p.kich_ban.doan;
  const t = spDoan(ds[i]);
  const chot = !t && i === ds.length - 1;
  const { yNoi, cachNoi } = yDoan(ds[i]);
  // Cách nói (bản 2.8, #48): gợi ý của câu "Mai:" trong kịch bản; không có thì mặc định theo kiểu lượt.
  const cach = cachNoi || (mo === 'mo_man' ? CACH_NOI.mo_man : chot ? CACH_NOI.chot : vong > 1 ? CACH_NOI.diem_lai : '');
  const dau = [
    MO_LUOT[mo] || '',
    loiNguoiDan ? `Người dẫn phụ vừa nói: "${loiNguoiDan.slice(0, 160)}". Mai nối lời tự nhiên từ câu đó.` : '',
    // Chạy thật 24/9/2026: ý phụ đứng giữa lượt thì Mai bỏ qua — nói rõ là mở đầu lượt bằng câu chào. Có "bạn" trước tên
    // để tên như "Anh" không bị đọc thành đại từ ("Anh đang hỏi…").
    tenMoi.length ? `Mở đầu bằng một câu chào nhanh ${tenMoi.length > 1 ? 'các bạn' : 'bạn'} ${tenMoi.join(', ')} (vừa bình luận), rồi dẫn đoạn.` : '',
    // Sau câu chào (câu chào phải đứng đầu lượt), trước ý của đoạn.
    dongCachNoi(cach),
    `Đoạn ${i + 1}/${ds.length} — ${t ? sp.tenDayDu(t) : 'đoạn chung'}${vong > 1 ? ` · vòng ${vong}: điểm lại cho người mới vào, nói ngắn hơn và dùng lời khác lần trước` : ''}.`,
    // F-80 (#108): Mai không tự nói con số — giá đọc đúng câu MOZA đưa.
    t ? cauGia(t) : '',
  ].filter(Boolean);
  const cuoi = [
    chot ? 'Đây là đoạn chốt của vòng này nhưng buổi live vẫn tiếp tục: không chào tạm biệt; nhắc cách chốt đơn và mời ai đã chốt mở tin nhắn của shop.' : '',
    ke ? `Đoạn sau: ${ke}. Cuối lượt mời người xem ở lại xem món sau.` : '',
    'Nói trọn đoạn này bằng lời của Mai, khoảng 20–40 giây, rồi dừng chờ MOZA đưa đoạn sau.',
  ].filter(Boolean);
  const y = yNoi.length ? yNoi.join(' ')
    : t ? 'giới thiệu món này từ thẻ sản phẩm — điểm hút nhất trước (chất liệu, form, dịp mặc), rồi giá, màu, size còn hàng, cuối cùng mời chốt đúng cú pháp.'
      : 'giao lưu ngắn với người xem: chào người mới, nhắc cách chốt, trả lời câu hay hỏi về size, ship.';
  const conLai = LUOT_TOI_DA_KY_TU - [...dau, ...cuoi].join('\n').length - 20;
  return [...dau, `Ý của đoạn: ${y.slice(0, Math.max(250, conLai))}`, ...cuoi].join('\n').slice(0, LUOT_TOI_DA_KY_TU);
}

/** "Câu giá (đọc đúng nguyên văn): …" của một món (F-80): giá mẫu và giá riêng từng phân loại nếu khác. */
function cauGia(t) {
  const khac = sp.phanLoaiCua(t.id).filter((p) => !p.bo && p.gia != null && p.gia !== t.gia).slice(0, 3)
    .map((p) => `${sp.nhanPl(p)} giá ${hienTien(p.gia)}`);
  const goi = sp.tenGoi(t);
  // F-93: giá bán lúc này — buổi có giá live (công tắc bật) thì câu giá là giá live "tới hết buổi".
  const p = (() => { try { return require('../../nghiep-vu/live').phienDangMo(); } catch { return null; } })();
  const g = require('../../nghiep-vu/gia-ban').giaBanLucNay(t, null, { phienId: p?.id || null });
  const gia = g.la_gia_live ? `giá live ${hienTien(g.gia)} tới hết buổi` : `giá ${hienTien(t.gia)}`;
  return `Câu giá (đọc đúng nguyên văn): "${goi.charAt(0).toUpperCase()}${goi.slice(1)} ${gia}${khac.length ? `; ${khac.join('; ')}` : ''}".`;
}

/**
 * Lượt riêng trả lời người xem, giữa hai đoạn. Chạy thật 24/9/2026: câu hỏi đưa kèm ý của đoạn thì Mai chỉ nói đoạn,
 * bỏ qua câu hỏi — nên câu hỏi thành một lượt riêng, gọi tên người hỏi.
 * @param {string[]} cauHoi  dạng `Bạn Thảo hỏi: "…" (về áo số 12)`
 */
function loiTraLoi(cauHoi) {
  return [
    `Người xem đang hỏi — Mai trả lời ngay từng câu, gọi tên người hỏi, giọng ${CACH_NOI.tra_loi}, ngắn gọn, chỉ dùng dữ liệu đã có (không có thì nói shop sẽ kiểm tra và mời nhắn tin cho Page):`,
    ...cauHoi.map((c, k) => `${k + 1}) ${c}`),
    'Trả lời xong thì dừng, chưa sang món khác — MOZA sẽ đưa đoạn tiếp.',
  ].join('\n').slice(0, LUOT_TOI_DA_KY_TU);
}

const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Các cách gọi một món trên sóng, đã bỏ dấu: "ao so 12", "so 12", "ao 12", tên sản phẩm, tên gọi khác. */
function cachGoiSanPham(x) {
  const goi = boDau(sp.tenGoi(x));
  const ds = [goi, `so ${x.so}`, goi.replace(/ so /, ' '), boDau(x.ten), ...(x.ten_goi_khac || []).map(boDau)];
  return [...new Set(ds.map((k) => k.replace(/\s+/g, ' ').trim()).filter((k) => k.length >= 4))];
}

/**
 * Vị trí Mai nhắc món (chữ đã bỏ dấu) ở gần đầu một câu hoặc vế câu — kiểu chuyển đoạn "Sang áo số 7 nè…".
 * Tên nằm sâu trong câu (so sánh "giống áo số 7") không tính. Không có thì -1.
 */
function viTriChuyenSang(chu, sanPham) {
  let vt = -1;
  for (const k of cachGoiSanPham(sanPham)) {
    for (const x of chu.matchAll(new RegExp(`(?<![\\p{L}\\d])${escRe(k)}(?![\\p{L}\\d])`, 'gu'))) {
      const dauVe = Math.max(...['.', '!', '?', ',', ';', ':'].map((c) => chu.lastIndexOf(c, x.index)));
      if (x.index - (dauVe + 1) <= DAU_VE_TOI_DA && (vt < 0 || x.index < vt)) vt = x.index;
    }
  }
  return vt;
}

/**
 * Tên gọi để Mai chào người vừa bình luận: chữ cuối của tên Facebook (tên gọi của người Việt), chỉ chữ cái — bỏ
 * biểu tượng, số. "Người xem" (không rõ tên) thì không chào.
 */
function tenGoi(ten) {
  const chu = String(ten || '').normalize('NFC').split(/\s+/).map((x) => x.replace(/[^\p{L}]/gu, '')).filter((x) => x.length >= 2);
  const s = (chu.at(-1) || '').slice(0, 15);
  return /^(xem|người)$/iu.test(s) ? '' : s;
}

class MiengCuaMai {
  /**
   * @param {object} o
   * @param {Function} o.phat                sự kiện tới mọi màn hình
   * @param {object} o.chepLoi               chep-loi-nguoi-dan.js: nhường micro cho miệng khi miệng mở
   * @param {object} [o.phongAi]             phong-ai.js: lời người dẫn cho Director, báo người dẫn
   * @param {object} [o.nhaMieng]            thay kết nối từng hãng (test)
   * @param {number} [o.chuKyMs]
   * @param {number} [o.tinhTienMs]
   * @param {number} [o.moToiDaMs]
   * @param {object} [o.nhipDan]             đè thời gian của nhịp dẫn (test): nhipMs, nghiMs, choDapMs, choMaiNoiMs
   */
  constructor({ phat, chepLoi, phongAi = null, nhaMieng = NHA_MIENG, chuKyMs = CHU_KY_MS, tinhTienMs = TINH_TIEN_MS, moToiDaMs = MO_TOI_DA_MS, nhipDan = {},
    kiemLoiNoi = {}, khiNoiNham = null, quyetDinhMai = null }) {
    Object.assign(this, { phat, chepLoi, phongAi, nhaMieng, chuKyMs, tinhTienMs, moToiDaMs });
    this.quyetDinhMai = quyetDinhMai; // F-112: đè cờ / ngưỡng (test)
    this.ngheChu = new Set(); // F-109: chờ lời Mai có một cụm chữ (choChu)
    // F-105: kiểm lời Mai trên sóng, tự đính chính (hook kiem-loi-noi, cửa truoc_phat). khiNoiNham: F-106 giữ giá có lợi cho khách.
    this.kiemLoi = new KiemLoiNoiSong({ mieng: this, cauHinh: kiemLoiNoi, khiNoiNham });
    this.nhip = { ...NHIP_DAN, ...nhipDan };
    this.loa = new Set();
    this.m = null; // { phienId, model, maiDan, ket (kết nối), sanSang, doan, daTinh, ... }
    this.dangDongBo = false;
    this.lanMoLai = [];
    // Nhịp dẫn khi Mai dẫn chính (#47): giữ qua các lần mở lại miệng của cùng phiên (nối lại, đổi miệng) để không mở màn
    // lại, không mất vòng và câu hỏi đang chờ.
    this.dan = null;
    this.henDan = null;
  }

  /* ---------------- chạy nền ---------------- */

  batDau() {
    const lap = async () => {
      await this.dongBo().catch((e) => console.error('  [miệng] ' + anKhoa(e.message)));
      this.hen = setTimeout(lap, this.chuKyMs);
    };
    this.hen = setTimeout(lap, 0);
  }

  async dung() {
    clearTimeout(this.hen);
    this.hen = null;
    await this.dong('Phần mềm đang tắt');
  }

  /** So trạng thái phiên với miệng đang mở: mở, đóng, đổi miệng, gửi đoạn mới. */
  async dongBo() {
    if (this.dangDongBo) return;
    this.dangDongBo = true;
    try {
      const p = live.phienDangMo();
      const lyDoTat = !p || p.trang_thai !== 'dang_live' ? 'Không có buổi live đang chạy'
        : p.che_do_ai !== 'noi' ? 'Chế độ "Chỉ gợi ý"'
          : caiDat.khanCap() ? '"Dừng mọi thứ" đang bật: Mai tạm im'
            : caiDat.dungAi().bat ? 'AI tạm dừng vì chạm trần chi phí: Mai tạm im' : null;
      if (lyDoTat) {
        if (this.m) await this.dong(lyDoTat);
        return;
      }
      const model = p.mieng || caiDat.mieng().model;
      if (this.m && (this.m.phienId !== p.id || this.m.model !== model)) await this.dong(`Đổi sang ${tenMieng(model)}`);
      // Đổi giữa "Mai nói" (cùng dẫn) và "Mai dẫn chính": lời dặn khác nhau nên mở lại miệng (chừng 1 giây).
      if (this.m && this.m.maiDan !== !!p.mai_dan) await this.dong(p.mai_dan ? 'Đổi sang Mai dẫn chính' : 'Đổi sang Mai cùng dẫn');
      if (!this.m) {
        await this.mo(p, model);
        return;
      }
      // F-127: đổi tông giữa buổi — GPT-Live thêm lời dặn (không đổi được lời dặn đã gửi), Gemini / miệng khác mở lại miệng.
      if (this.m.sanSang && this.m.tong !== tongGiong.khoa()) {
        this.m.tong = tongGiong.khoa();
        if (this.m.ket.themLoiDan) this.m.ket.themLoiDan(tongGiong.doanDoiGiua());
        else { await this.dong('Đổi tông giọng: mở lại miệng'); return; }
      }
      if (this.m.sanSang && this.m.doan !== p.doan_hien_tai && this.m.maiDan) {
        // Mai dẫn chính: đoạn đầu sau khi mở miệng do nhịp dẫn đưa; về sau đoạn đổi ở đây là người dẫn bấm ← →.
        const cu = this.m.doan;
        this.m.doan = p.doan_hien_tai;
        if (cu !== -1) this.nguoiDanChuyenDoan(p);
      } else if (this.m.sanSang && this.m.doan !== p.doan_hien_tai) {
        this.m.doan = p.doan_hien_tai;
        this.m.ket.duaNguCanh(tinDoan(p));
        // Kịch bản có phần "Mai:" cho đoạn này: Mai nói phần của mình ngay khi người dẫn chuyển tới (bản 2.5, F-37).
        // Gợi ý cách nói trong ngoặc (bản 2.8, #48) đi thành dòng chỉ đạo riêng, không nằm trong câu Mai đọc.
        const { cau: cauMai, cachNoi } = cauMaiTheoKichBan(p);
        if (cauMai) {
          if (this.m.chan === 'dung') this.m.chan = 'cho_cau_moi';
          this.m.ket.hoi([
            dongCachNoi(cachNoi),
            `Tới đoạn ${p.doan_hien_tai + 1} của kịch bản. Mai chỉ nói câu dẫn vào đoạn này rồi dừng, nhường lời cho người dẫn — nói liền mạch, tự nhiên như MC, giữ đúng con số và số sản phẩm: "${cauMai.slice(0, 600)}"`,
          ].filter(Boolean).join('\n'));
          this.phat('live.mai_kich_ban', { phien_id: p.id, doan: p.doan_hien_tai, cau: cauMai, cach_noi: cachNoi || null });
        }
      }
      if (Date.now() - this.m.tinhTu >= this.tinhTienMs) this.tinhTien();
    } finally {
      this.dangDongBo = false;
    }
  }

  baoTrangThai(trangThai, them = {}) {
    this.phat('live.mieng', { phien_id: this.m?.phienId ?? them.phien_id ?? null, trang_thai: trangThai, model: this.m?.model ?? null, ...them });
  }

  /* ---------------- mở / đóng ---------------- */

  async mo(p, model) {
    const loai = caiDat.MAC_DINH.mieng.find((x) => x.model === model);
    const LopMieng = this.nhaMieng[loai?.nha];
    const m = {
      phienId: p.id, model, maiDan: !!p.mai_dan, nha: loai?.nha, sanSang: false, doan: -1, tinhTu: Date.now(), daTinh: { giay: 0, token: { vao: {}, ra: {} } },
      tong: tongGiong.khoa(),
    };
    this.m = m;
    this.baoTrangThai('dang_mo');
    if (!LopMieng) return this.haVeGoiY(p.id, `không có miệng "${model}"`);
    if (loai.chi_dien_tap && !p.dien_tap) return this.haVeGoiY(p.id, `${loai.ten} chỉ dùng trong buổi tập`);
    const cua = (fn) => (...x) => { if (this.m === m) fn(...x); };
    // F-114 (tắt mặc định): giọng riêng tạo bằng mô tả — chỉ GPT-Live; gửi {id} và lặp lại mô tả trong lời dặn (theo tài liệu OpenAI).
    const rieng = ['openai', 'gia'].includes(loai.nha) ? require('../../nghiep-vu/giong-rieng').giongChoMieng() : null;
    m.ket = new LopMieng({
      model,
      giong: rieng ? { id: rieng.id } : caiDat.mieng().giong[loai.nha],
      loiDan: rieng ? `${taoLoiDan(p)}\n\nGIỌNG NÓI CỦA MAI (giữ suốt buổi): ${rieng.moTa}` : taoLoiDan(p),
      khiAm: cua((b) => this.nhanAm(b)),
      khiChuRa: cua((c) => this.nhanChuMai(c)),
      khiChuVao: cua((c) => this.nhanChuNguoiDan(c)),
      khiNgat: cua(() => this.boTiengCho('Người dẫn nói chen')),
      khiNoiLai: cua((dang) => this.baoTrangThai(dang ? 'noi_lai' : 'san_sang')),
      khiLoi: (e) => console.error(`  [miệng] ${tenMieng(model)}: ${anKhoa(e.message)}`),
      khiDong: cua(({ lyDo }) => this.matMieng(p.id, lyDo)),
      // 26/10/2026: mạng gửi lên không kịp tiếng (Mai nghe trễ, AI khác chậm) — báo người dẫn, tối đa 1 lần / phút.
      khiMangYeu: cua(({ dangU }) => {
        console.error(`  [miệng] mạng gửi lên yếu: ${Math.round(dangU / 1024)} KB chưa gửi được, đang bỏ bớt tiếng micro`);
        try { this.phongAi?.bao('Mạng gửi lên đang yếu: Mai nghe micro bị trễ, AI trả lời chậm. Tắt bớt ứng dụng dùng mạng (tải file, xem video, OBS phát thử), hoặc cắm dây mạng.', 'do'); } catch { /* chưa có phiên */ }
      }),
      // #80: Mai tự tra sản phẩm, còn hàng đúng lúc hỏi (chỉ sản phẩm trong phiên).
      traCuu: (ten, thamSo) => traCuuMieng(p.id, ten, thamSo),
      // F-87: từ riêng cho phần nghe người dẫn (Gemini 3.8 Live nhận; GPT Live 1 không có chỗ nạp — bỏ qua).
      tuRieng: require('../../nghiep-vu/tu-rieng').tuRiengCua(p),
      // F-112: Decisions trong lúc Mai nói — chỉ khi bật và miệng có hỗ trợ (GPT-Live; miệng giả mô phỏng).
      ...({ ...QD(), ...this.quyetDinhMai }.bat && ['openai', 'gia'].includes(loai.nha) ? { cauHoiQuyetDinh: cauHoiQuyetDinh(p), khiQuyetDinh: cua((qd) => this.nhanQuyetDinh(p.id, qd)) } : {}),
    });
    let hen;
    try {
      // Lưới an toàn: kết nối của hãng treo thì vẫn không chặn vòng đồng bộ (đổi chế độ, đổi đoạn, đóng miệng).
      await Promise.race([m.ket.mo(), new Promise((_, loi) => {
        hen = setTimeout(() => loi(new Error(`${tenMieng(model)} mở phiên quá ${Math.round(this.moToiDaMs / 1000)} giây`)), this.moToiDaMs);
      })]);
    } catch (e) {
      Promise.resolve(m.ket.dong()).catch(() => {});
      if (this.m !== m) return;
      return this.haVeGoiY(p.id, anKhoa(e.message));
    } finally {
      clearTimeout(hen);
    }
    if (this.m !== m) { // bị đóng trong lúc đang mở
      m.ket.dong();
      return;
    }
    m.sanSang = true;
    this.chepLoi?.nhuong((pcm) => this.guiAm(pcm));
    this.baoTrangThai('san_sang');
    if (m.maiDan) this.batDauDan(p);
  }

  /** Đóng miệng đang mở (tính tiền phần đã dùng), trả micro cho chép lời. */
  async dong(lyDo = null, { giuMicro = false } = {}) {
    const m = this.m;
    if (!m) return;
    this.m = null;
    clearInterval(this.henDan);
    this.henDan = null;
    this.boTiengCho(null);
    clearTimeout(m.henLoiDan);
    this.kiemLoi.dong(m);
    if (!giuMicro) this.chepLoi?.layLai();
    if (m.ket) {
      try { await m.ket.dong(); } catch { /* đã đóng */ }
      this.tinhTien(m);
    }
    this.phat('live.mieng', { phien_id: m.phienId, trang_thai: 'tat', model: m.model, ly_do: lyDo });
  }

  /**
   * Miệng rớt giữa chừng (GPT Live 1 hết hạn phiên, Gemini nối lại không được): đóng; lần đồng bộ kế tiếp tự mở phiên mới
   * và đưa lại dữ liệu. Rớt liên tục thì hạ về "Chỉ gợi ý".
   */
  async matMieng(phienId, lyDo) {
    const bayGio = Date.now();
    this.lanMoLai = [...this.lanMoLai.filter((t) => bayGio - t < CUA_SO_MO_LAI_MS), bayGio];
    if (this.lanMoLai.length > MO_LAI_TOI_DA) return this.haVeGoiY(phienId, lyDo);
    console.error(`  [miệng] ${anKhoa(lyDo)} — mở lại phiên mới`);
    await this.dong(lyDo, { giuMicro: true });
    this.phat('live.mieng', { phien_id: phienId, trang_thai: 'noi_lai', ly_do: lyDo });
  }

  /** Miệng hỏng: hạ phiên về "Chỉ gợi ý", báo người dẫn. Live vẫn chạy (Luồng 2, nhánh lỗi). */
  async haVeGoiY(phienId, lyDo) {
    const thongDiep = `Mai chưa nói được (${String(lyDo).slice(0, 160)}). Đã chuyển về "Chỉ gợi ý"; chọn lại "Mai nói" khi muốn thử lại.`;
    console.error('  [miệng] ' + thongDiep);
    await this.dong(lyDo);
    this.chepLoi?.layLai();
    try {
      const p = live.datCheDo(phienId, { che_do_ai: 'goi_y' });
      this.phat('live.che_do', { phien_id: p.id, che_do_ai: p.che_do_ai, mieng: p.mieng, mai_dan: p.mai_dan });
      // Phòng AI chưa làm việc gì trong phiên này (chưa có bình luận) thì nhận phiên trước khi báo.
      if (this.phongAi && this.phongAi.st.phienId !== p.id) this.phongAi.datLai(p.id);
      this.phongAi?.bao(thongDiep, 'do');
    } catch { /* phiên đã xong */ }
    this.phat('live.mieng', { phien_id: phienId, trang_thai: 'loi', ly_do: thongDiep });
  }

  /* ---------------- tiếng ---------------- */

  guiAm(pcm16k) {
    if (this.m?.sanSang) this.m.ket.guiAm(pcm16k);
  }

  datLoa(ws) {
    this.loa.add(ws);
  }

  boLoa(ws) {
    this.loa.delete(ws);
  }

  nhanAm(b) {
    const m = this.m;
    const bayGio = Date.now();
    const noi = coTiengNoi(b);
    if (noi) {
      // Sau DỪNG AI ('dung'): bỏ hết. Đã có câu hỏi mới ('cho_cau_moi'): phát từ câu nói mới, sau một khoảng lặng.
      if (m.chan === 'cho_cau_moi' && bayGio - (m.amCuoi || 0) >= HET_CAU_MS) {
        m.chan = false;
        m.chuMai = ''; // chữ của câu đã bỏ không dính vào câu mới
      }
      m.amCuoi = bayGio;
    }
    if (m.chan) return;
    const dai = (b.length / 2 / 24000) * 1000;
    if (noi) {
      m.phatDen = Math.max(m.phatDen || 0, bayGio) + dai;
      if (m.maiDan && this.dan) this.dan.giayNoi += dai; // Mai dẫn chính: đoạn này Mai đã nói được bao lâu
    }
    for (const ws of this.loa) if (ws.readyState === 1 && (ws.bufferedAmount || 0) < LOA_U_TOI_DA) ws.send(b);
  }

  /** Mai đang phát tiếng ra loa (ước tính trên máy chủ). */
  maiDangNoi() {
    return !!this.m && Date.now() < (this.m.phatDen || 0);
  }

  /** Bỏ tiếng đang chờ phát ở trình duyệt (bị ngắt lời, DỪNG AI, đóng miệng). */
  boTiengCho(lyDo) {
    if (this.m) this.m.phatDen = 0;
    this.phat('live.mai_ngat', { phien_id: this.m?.phienId ?? null, ly_do: lyDo });
  }

  /* ---------------- chữ ---------------- */

  nhanChuMai(chu) {
    const m = this.m;
    if (m.chan) return; // câu bị bỏ sau DỪNG AI: không hiện
    for (const n of [...this.ngheChu]) { n.chu = (n.chu + chu).slice(-2000); if (n.kiem.test(n.chu)) n.xong(true); }
    // Mai dẫn chính: giữ chữ Mai nói từ lượt vừa đưa, để biết Mai có tự nói sang đoạn sau không (theoKipMai).
    if (m.maiDan && this.dan?.phienId === m.phienId) this.dan.chuLuot = (this.dan.chuLuot + chu).slice(-4000);
    const bayGio = Date.now();
    const moi = !m.chuMai || bayGio - (m.chuMaiLuc || 0) > DOAN_MAI_MOI_MS;
    if (moi) this.ghiCauMai(m); // câu trước chưa kịp ghi (hẹn giờ chưa chạy) thì ghi ngay
    m.chuMai = (moi ? '' : m.chuMai) + chu;
    m.chuMaiLuc = bayGio;
    m.chuMaiDaGhi = false;
    this.kiemLoi.nhan(m, chu, moi); // F-105: chỉ xét số đã trọn; sai chắc → đính chính
    clearTimeout(m.henNhatKy);
    m.henNhatKy = setTimeout(() => this.ghiCauMai(m), DOAN_MAI_MOI_MS + 300);
    m.henNhatKy.unref?.();
    // Chép lời có thể kèm nhãn tiếng không phải lời ("[gasp]"): màn hình chỉ hiện lời.
    const loi = m.chuMai.replace(/\[[^\]\n]{1,24}\]\s*/g, '').trim();
    if (loi) this.phat('live.mai_noi', { phien_id: m.phienId, chu: loi, moi });
  }

  /** F-80 (#108): một câu Mai vừa nói xong → nhật ký buổi live, kèm dấu "⚠" nếu có số tiền lạ hoặc từ cấm (soát bằng mã). */
  ghiCauMai(m) {
    if (!m || m.chuMaiDaGhi || !m.chuMai) return;
    m.chuMaiDaGhi = true;
    const loi = m.chuMai.replace(/\[[^\]\n]{1,24}\]\s*/g, '').trim();
    if (!loi || !m.phienId) return;
    let canhBao = null;
    try { canhBao = require('../kiem-tra/kiem-so-noi').soatCau(loi, { phienId: m.phienId }); } catch { /* soát lỗi thì vẫn ghi */ }
    require('../../nghiep-vu/nhat-ky-song').ghi({ phienId: m.phienId, loai: 'mai', noiDung: loi, canhBao });
  }

  /** Chép lời người dẫn (đầu vào của miệng) → màn hình và Director. Bỏ phần đến lúc Mai đang phát. */
  nhanChuNguoiDan(chu) {
    const m = this.m;
    if (Date.now() < (m.phatDen || 0) + BO_SAU_PHAT_MS) return;
    if (m.chan === 'dung') m.chan = 'cho_cau_moi'; // người dẫn nói tiếp với Mai sau DỪNG AI
    m.chuVaoLuc = Date.now();
    if (m.maiDan && this.dan) this.dan.lucNguoiDan = m.chuVaoLuc;
    m.loiDan = (m.loiDan || '') + chu;
    this.phat('live.loi_nguoi_dan', { phien_id: m.phienId, chu: m.loiDan.trim(), tam: true });
    clearTimeout(m.henLoiDan);
    m.henLoiDan = setTimeout(() => {
      const cau = (m.loiDan || '').trim();
      m.loiDan = '';
      if (!cau || this.m !== m) return;
      this.phat('live.loi_nguoi_dan', { phien_id: m.phienId, chu: cau, tam: false });
      this.phongAi?.themLoiNguoiDan(m.phienId, cau);
      if (m.maiDan) this.nguoiDanNoiXong(cau);
    }, CHOT_LOI_DAN_MS);
  }

  /* ---------------- việc phòng live giao ---------------- */

  /** Miệng đã sẵn sàng nhận câu hỏi cho phiên này chưa. */
  sanSang(phienId) {
    return !!this.m?.sanSang && this.m.phienId === phienId;
  }

  /**
   * Gửi thẳng câu hỏi cho Mai trả lời trên sóng (#30).
   * @param {{cauHoi:string, so?:number|null, tuNguoiDan?:boolean}} o
   */
  hoi({ cauHoi, so = null, tuNguoiDan = false }) {
    const cau = String(cauHoi).trim().slice(0, 500);
    if (this.m.chan === 'dung') this.m.chan = 'cho_cau_moi';
    // Mai dẫn chính: người dẫn gõ ô Hỏi Mai cũng là nói xen — nhịp dẫn chờ Mai đáp xong rồi mới dẫn tiếp.
    if (tuNguoiDan && this.m.maiDan && this.dan) {
      this.dan.lucNguoiDan = Date.now();
      this.nguoiDanNoiXong(cau);
    }
    const t = so ? sp.layTheoSo(so) : null;
    this.m.ket.hoi(`${tuNguoiDan
      ? `Người dẫn hỏi Mai: "${cau}"`
      : `Người xem hỏi${t ? ` về ${sp.tenDayDu(t)}` : ''}: "${cau}". Mai trả lời người xem.`}${t ? `\n${cauGia(t)}` : ''}`);
    this.phat('live.goi_mai', { phien_id: this.m.phienId, cau_hoi: cau, tu_nguoi_dan: tuNguoiDan });
  }

  /** DỪNG AI (F-22): trình duyệt đã tắt tiếng; bỏ phần còn lại của câu, báo miệng im. */
  dungAi(phienId) {
    if (!this.sanSang(phienId)) return;
    this.m.chan = 'dung';
    this.m.amCuoi = Date.now();
    this.boTiengCho('DỪNG AI');
    this.m.ket.duaNguCanh('Người dẫn vừa bấm DỪNG: Mai ngừng nói ngay và im lặng, chờ người dẫn hỏi tiếp.');
    if (this.m.maiDan) this.tamDungDan('Người dẫn bấm DỪNG AI'); // Mai thôi dẫn tới khi người dẫn bấm "▶ Mai dẫn tiếp"
  }

  /** Có người vừa chốt đơn (#72): Mai đọc một câu ngắn (tên gọi + món), không đọc số điện thoại, địa chỉ, số tiền. */
  baoVuaChot(chu) {
    if (!this.m?.sanSang) return;
    this.m.ket.hoi(`MOZA báo có người vừa chốt đơn — nói ngay một câu ngắn, vui, rồi dẫn tiếp: "${String(chu).slice(0, 200)}".`);
  }

  /**
   * F-70: người chốt đã nhận thẻ riêng ≥ 4 phút mà chưa bấm — nhắc mở mục Tin nhắn chờ. Câu trung tính (không dùng lại
   * baoVuaChot: câu đó cứng "có người vừa chốt đơn").
   */
  nhacMoTin(ten) {
    if (!this.m?.sanSang) return;
    this.m.ket.hoi(`MOZA nhờ nhắc: shop đã nhắn riêng cho ${String(ten).slice(0, 120)}. Nói ngay một câu ngắn, thân thiện: gọi tên, nhờ xem mục Tin nhắn chờ trong Messenger. Không nói "chưa trả lời", "chưa mở", "chưa xác nhận". Rồi dẫn tiếp.`);
  }

  /** F-82: câu MOZA soạn sẵn (tư vấn size) — Mai đọc đúng nguyên văn, không thêm số đo của khách. */
  noiNguyenVan(cau) {
    if (!this.m?.sanSang) return;
    this.m.ket.hoi(`MOZA nhờ nói ngay, đúng nguyên văn, không thêm số đo của khách: "${String(cau).slice(0, 300)}". Rồi dẫn tiếp.`);
  }

  /**
   * F-109: chờ chữ chép lại lời Mai (từ lúc gọi) khớp `kiem` trong `ms` mili giây.
   * @returns {Promise<boolean>}
   */
  choChu(kiem, ms = 20000) {
    return new Promise((ok) => {
      const n = { kiem, chu: '' };
      const hen = setTimeout(() => n.xong(false), ms);
      hen.unref?.();
      n.xong = (kq) => { clearTimeout(hen); this.ngheChu.delete(n); ok(kq); };
      this.ngheChu.add(n);
    });
  }

  /** F-81: Mai dẫn chính — khách vừa xin xem (mặt sau, cận vải…): một câu ghi nhận ngắn, người dẫn cho xem. */
  baoYeuCau(chu) {
    if (!this.m?.sanSang) return;
    // 8/10/2026: có tên người phụ trách (Cài đặt → Bán hàng) thì Mai gọi tên nhờ giơ món lên camera, ví dụ "Chị Ngọc ơi, giơ súp lơ lên cam cho chị Lan xem với".
    const nguoiDan = String(caiDat.banHang().phu_trach || '').trim();
    const nho = nguoiDan ? `gọi tên khách, rồi nhờ ${nguoiDan} giơ món đó lên gần camera cho cả nhà xem` : 'gọi tên khách, nói người dẫn cho xem ngay';
    this.m.ket.hoi(`MOZA báo: ${String(chu).slice(0, 120)}. Nói MỘT câu ngắn ghi nhận (${nho}), rồi dẫn tiếp.`);
  }

  /** F-70: nhắc cách chốt đúng lúc (người mới vào, món bị hỏi nhiều mà chưa ai chốt). */
  nhacCachChot(viDu) {
    if (!this.m?.sanSang) return;
    this.m.ket.hoi(`MOZA nhờ nhắc cách chốt: nói một câu ngắn — muốn lấy thì bình luận chữ chốt, số, màu, size, ví dụ "${String(viDu).slice(0, 60)}"; shop nhắn riêng giữ hàng, nhớ xem cả mục Tin nhắn chờ. Rồi dẫn tiếp.`);
  }

  /** Sản phẩm vừa thôi Đang bán giữa buổi live. */
  sanPhamNgungBan(so) {
    if (!this.m?.sanSang) return;
    this.m.ket.duaNguCanh(`Sản phẩm số ${so} vừa ngừng bán: không nói về món này nữa; ai hỏi thì nói shop đã ngừng bán mẫu này.`);
  }

  /**
   * Còn bán được vừa đổi giữa buổi (#81, F-22): hết một phân loại, hoặc còn ≤ ngưỡng sắp hết. Gửi cập nhật bối cảnh
   * không kết thúc lượt — Mai đang nói không bị cắt; lần sau nói về món này thì dùng số mới.
   * @param {string} chu  ví dụ "Áo số 12 · Sơ mi linen: Đen/M vừa hết; Trắng/L còn 2."
   */
  capNhatTon(chu) {
    if (!this.m?.sanSang) return;
    this.m.ket.duaNguCanh(`Cập nhật còn hàng (MOZA): ${chu} Chỉ nói số còn theo cập nhật mới nhất này.`);
  }

  /* ---------------- Mai dẫn chính (bản 2.7, #47, F-43) ---------------- */

  /** Miệng vừa sẵn sàng ở chế độ Mai dẫn chính: lập (hoặc giữ) nhịp dẫn của phiên, chạy vòng nhịp. */
  batDauDan(p) {
    if (this.dan?.phienId !== p.id) {
      this.dan = { phienId: p.id, vong: 1, cho: [], daChao: new Set(), lucChao: 0, daMoMan: false, tamDung: false };
    }
    // Miệng mới chưa nghe lượt nào: lượt đầu đưa lại đoạn đang nói (mở màn hoặc dẫn tiếp).
    Object.assign(this.dan, {
      lucGiao: 0, giayNoi: 0, lucNguoiDan: 0, loiNguoiDanMoi: null, lanNhac: 0, cauCuoi: null, doanBoiCanh: -1,
      chuLuot: '', doanXong: false, vuaTraLoi: false,
    });
    clearInterval(this.henDan);
    this.henDan = setInterval(() => {
      try { this.nhipDan(); } catch (e) { console.error('  [Mai dẫn] ' + anKhoa(e.message)); }
    }, this.nhip.nhipMs);
    this.baoDan();
  }

  /** Người dẫn vừa chọn "Mai dẫn chính" (ô chọn chế độ): bỏ trạng thái tạm dừng cũ của phiên, Mai dẫn luôn. */
  chonDanChinh(phienId) {
    if (this.dan?.phienId === phienId) this.dan.tamDung = false;
  }

  coLoa() {
    for (const ws of this.loa) if (ws.readyState === 1) return true;
    return false;
  }

  /**
   * Người dẫn đang nói: âm lượng micro (chỉ tính lúc Mai không phát — tiếng Mai lọt vào micro không làm Mai chờ),
   * hoặc chữ chép lời người dẫn vừa tới (đã bỏ phần trùng lúc Mai phát).
   */
  nguoiDanDangNoi() {
    const m = this.m;
    const st = this.phongAi?.st;
    const mic = !!st && st.phienId === m.phienId && st.nguoiDanNoi && !this.maiDangNoi();
    return mic || Date.now() - (m.chuVaoLuc || 0) < CHU_VAO_CON_NOI_MS;
  }

  /**
   * Mỗi nhịp: đã tới lúc đưa Mai phần tiếp chưa. Chưa lượt nào → mở màn (hoặc dẫn tiếp) khi Màn hình người dẫn đã mở.
   * Người dẫn đang nói → chờ. Mai nói xong (lặng nghiMs sau khi tiếng phát xong) → đoạn sau. Người dẫn nói sau câu cuối
   * của Mai → chờ Mai đáp; Mai không đáp sau choDapMs thì dẫn tiếp, kèm câu người dẫn vừa nói. Đưa lượt mà Mai im →
   * nhắc lại, quá số lần thì thôi dẫn và báo.
   */
  nhipDan() {
    const m = this.m;
    const d = this.dan;
    if (!m?.sanSang || !m.maiDan || !d || d.phienId !== m.phienId || d.tamDung) return;
    if (!this.coLoa()) return; // chưa có Màn hình người dẫn phát tiếng: chưa nói, để không mất câu mở màn
    const bayGio = Date.now();
    if (this.nguoiDanDangNoi()) {
      d.lucNguoiDan = bayGio;
      return;
    }
    if (!d.lucGiao) {
      this.giaoLuot({ mo: this.kieuMoDau() });
      return;
    }
    const amCuoi = m.amCuoi || 0;
    if (amCuoi <= d.lucGiao && d.lucNguoiDan <= d.lucGiao) {
      if (bayGio - d.lucGiao < this.nhip.choMaiNoiMs) return;
      if (d.lanNhac >= NHAC_TOI_DA) {
        this.tamDungDan('Mai không lên tiếng sau 2 lần nhắc', { loi: true });
        return;
      }
      const lan = d.lanNhac + 1;
      this.guiLuot(d.cauCuoi);
      d.lanNhac = lan;
      return;
    }
    const nguoiDanSau = d.lucNguoiDan > amCuoi;
    const moc = nguoiDanSau ? d.lucNguoiDan + this.nhip.choDapMs : Math.max(amCuoi, m.phatDen || 0) + this.nhip.nghiMs;
    if (bayGio < moc) return;
    if (!d.doanXong) {
      // Bị người dẫn ngắt khi Mai mới nói đoạn này một chút → nói tiếp đoạn đó; còn lại là xong đoạn.
      d.doanXong = d.lucNguoiDan <= d.lucGiao || d.giayNoi >= DOAN_DU_MS;
      if (!d.doanXong) {
        this.giaoLuot({ mo: 'noi_tiep', kemLoiNguoiDan: nguoiDanSau });
        return;
      }
    }
    // Sau lượt trả lời người xem thì không dò: câu trả lời hay nhắc món khác.
    if (!d.vuaTraLoi) this.theoKipMai();
    // Xong đoạn: có câu hỏi người xem thì một lượt trả lời riêng trước, rồi mới sang đoạn sau.
    if (d.cho.length && !d.vuaTraLoi) this.giaoTraLoi();
    else this.giaoLuot({ sangDoanKe: true, kemLoiNguoiDan: nguoiDanSau });
  }

  /** Lượt đầu của một miệng mới: live vừa bắt đầu và đang ở đoạn đầu → mở màn; còn lại (đổi chế độ, nối lại) → dẫn tiếp. */
  kieuMoDau() {
    const p = live.layPhien(this.m.phienId);
    const moi = !p.bat_dau || Date.now() - new Date(p.bat_dau).getTime() < MO_MAN_TRONG_MS;
    return !this.dan.daMoMan && p.doan_hien_tai === 0 && moi ? 'mo_man' : 'tiep_tuc';
  }

  /**
   * Đoạn sau đoạn `tu`: bỏ đoạn có sản phẩm thôi Đang bán; hết kịch bản thì quay về đoạn có sản phẩm đầu tiên (bỏ Mở đầu) —
   * vòng mới, Mai điểm lại cho người mới vào (chủ dự án chọn 24/9/2026).
   */
  doanKe(p, tu = p.doan_hien_tai) {
    const ds = p.kich_ban.doan;
    const dau = Math.max(0, ds.findIndex((x) => x.san_pham_id));
    const conDung = (x) => !x.san_pham_id || spDoan(x)?.trang_thai === 'dang_ban';
    let j = tu;
    let vongMoi = false;
    for (let lan = 0; lan <= ds.length; lan += 1) {
      j += 1;
      if (j >= ds.length) {
        j = dau;
        vongMoi = true;
      }
      if (conDung(ds[j])) return { i: j, vongMoi };
    }
    return { i: tu, vongMoi: false };
  }

  /**
   * Đưa Mai một lượt dẫn. sangDoanKe: chuyển sang đoạn sau (ghi dòng thời gian sản phẩm, Màn hình người dẫn chạy theo).
   * @param {{sangDoanKe?:boolean, mo?:string|null, kemLoiNguoiDan?:boolean}} o
   */
  giaoLuot({ sangDoanKe = false, mo = null, kemLoiNguoiDan = false } = {}) {
    const m = this.m;
    const d = this.dan;
    let p = live.layPhien(m.phienId);
    let i = p.doan_hien_tai;
    if (sangDoanKe) {
      const k = this.doanKe(p);
      if (k.vongMoi) d.vong += 1;
      i = k.i;
      d.giayNoi = 0;
    }
    if (i !== p.doan_hien_tai) {
      m.doan = i; // vòng đồng bộ không coi lần chuyển này là người dẫn bấm ← →
      p = live.doiDoan(p.id, i);
      this.phat('live.doan', { phien_id: p.id, doan: i });
    }
    if (d.doanBoiCanh !== i) {
      d.doanBoiCanh = i;
      m.ket.duaNguCanh(boiCanhDan(p, i));
    }
    const sau = this.doanKe(p, i);
    const cau = loiGiaoDoan(p, i, {
      mo,
      vong: d.vong,
      ke: sau.i !== i ? `${sau.vongMoi ? 'điểm lại từ đầu cho người mới vào — ' : ''}${tenDoan(p, sau.i)}` : null,
      tenMoi: this.layTenMoi(p),
      loiNguoiDan: kemLoiNguoiDan ? d.loiNguoiDanMoi : null,
    });
    if (mo === 'mo_man') d.daMoMan = true;
    d.loiNguoiDanMoi = null;
    d.doanXong = false;
    d.vuaTraLoi = false;
    this.guiLuot(cau);
  }

  /** Lượt riêng trả lời người xem giữa hai đoạn (tối đa CAU_HOI_MOI_LUOT câu); xong thì nhịp dẫn sang đoạn sau. */
  giaoTraLoi() {
    const cau = this.layCauHoi();
    if (!cau.length) {
      this.giaoLuot({ sangDoanKe: true });
      return;
    }
    this.dan.vuaTraLoi = true;
    this.guiLuot(loiTraLoi(cau));
  }

  /** Gửi một lượt cho Mai và ghi mốc: Mai chưa lên tiếng sau choMaiNoiMs thì nhắc lại đúng lượt này. */
  guiLuot(cau) {
    const d = this.dan;
    d.lanNhac = 0;
    d.cauCuoi = cau;
    d.chuLuot = '';
    d.lucGiao = Date.now();
    if (this.m.chan === 'dung') this.m.chan = 'cho_cau_moi';
    this.m.ket.hoi(cau);
    this.baoDan();
  }

  /**
   * Mai tự nói sang đoạn sau mà không chờ MOZA (chạy thật 24/9/2026: người dẫn nói xen, Mai đáp rồi "nối tiếp" luôn sang
   * món sau; tới lượt món đó Mai nói lại cả đoạn). Chữ Mai nói từ lượt vừa đưa có tên món của đoạn có sản phẩm kế tiếp ở
   * đầu câu và còn nói dài sau đó → coi đoạn ấy đã nói, chuyển chỗ tới đó để lượt sau đi tiếp, không nói lặp.
   * Câu gợi ở cuối đoạn ("nghe tiếp áo số 7 nha") không tính. Hai đoạn cùng một món thì không phân biệt được: bỏ qua.
   */
  theoKipMai() {
    const d = this.dan;
    const chu = boDau(d.chuLuot || '').replace(/\s+/g, ' ');
    if (chu.length < CHU_SAU_TEN_TOI_THIEU) return;
    let p = live.layPhien(d.phienId);
    const ds = p.kich_ban.doan;
    let k = p.doan_hien_tai;
    for (let lan = 0; lan < ds.length; lan += 1) {
      const x = this.doanKe(p, k);
      if (x.vongMoi || x.i === k) return;
      k = x.i;
      if (ds[k].san_pham) break;
    }
    if (!ds[k]?.san_pham || k === p.doan_hien_tai) return;
    const dangNoi = ds[p.doan_hien_tai]?.san_pham;
    if (dangNoi && dangNoi.id === ds[k].san_pham.id) return;
    const vt = viTriChuyenSang(chu, ds[k].san_pham);
    if (vt < 0 || chu.length - vt < CHU_SAU_TEN_TOI_THIEU) return;
    this.m.doan = k;
    p = live.doiDoan(p.id, k);
    this.phat('live.doan', { phien_id: p.id, doan: k });
  }

  /** Người dẫn bấm ← → khi Mai dẫn chính: Mai dẫn luôn đoạn đó (đang tạm dừng thì chỉ đổi chỗ, dẫn tiếp từ đó). */
  nguoiDanChuyenDoan(p) {
    const d = this.dan;
    if (!d || d.phienId !== p.id) return;
    d.giayNoi = 0;
    if (d.lucGiao && !d.tamDung) this.giaoLuot({ mo: 'tay' });
  }

  /** Câu người dẫn vừa nói hoặc gõ (đã chốt): giữ để Mai nối lời; câu chào kết → Mai đáp rồi thôi dẫn. */
  nguoiDanNoiXong(cau) {
    const d = this.dan;
    if (!d || d.phienId !== this.m?.phienId) return;
    d.loiNguoiDanMoi = String(cau).slice(0, 300);
    if (CHAO_KET.test(boDau(cau))) {
      this.tamDungDan('Người dẫn chào kết');
      try { require('../../dich-vu').dichVu().manHinh?.camOn(this.m?.phienId); } catch { /* chưa mở dịch vụ */ }
    }
  }

  /**
   * Câu hỏi người xem Director giao khi Mai dẫn chính: xếp hàng, Mai trả lời ở chỗ nghỉ kế tiếp.
   * @param {{cauHoi:string, so?:number|null, ten?:string|null}} o  ten: tên Facebook của người hỏi (Mai gọi tên gọi)
   */
  xepCauHoi({ cauHoi, so = null, ten = null }) {
    const d = this.dan;
    if (!d) return;
    const cau = String(cauHoi).trim().slice(0, 300);
    d.cho = [...d.cho, { cauHoi: cau, so, ten: tenGoi(ten), luc: Date.now() }].slice(-CAU_HOI_CHO_TOI_DA);
    this.phat('live.goi_mai', { phien_id: d.phienId, cau_hoi: cau, tu_nguoi_dan: false, ly_do: 'chờ Mai nói xong đoạn này' });
  }

  layCauHoi() {
    const d = this.dan;
    const bayGio = Date.now();
    d.cho = d.cho.filter((c) => bayGio - c.luc < CAU_HOI_HET_MS);
    return d.cho.splice(0, CAU_HOI_MOI_LUOT).map((c) => {
      this.phat('live.goi_mai', { phien_id: d.phienId, cau_hoi: c.cauHoi, tu_nguoi_dan: false });
      const t = c.so ? sp.layTheoSo(c.so) : null;
      return `${c.ten ? `Bạn ${c.ten} hỏi` : 'Có bạn hỏi'}: "${c.cauHoi.slice(0, 160)}"${t ? ` (về ${sp.tenGoi(t)})` : ''}`;
    });
  }

  /**
   * Tên gọi của tối đa 3 người vừa bình luận để Mai chào (tối đa mỗi 2 phút). Chỉ đưa tên, không đưa nội dung bình luận
   * thô vào miệng; bỏ bình luận bị ẩn hoặc bị gắn spam, xúc phạm, lừa AI, lộ thông tin cá nhân.
   */
  layTenMoi(p) {
    const d = this.dan;
    const bayGio = Date.now();
    if (bayGio - d.lucChao < CHAO_MOI_MS) return [];
    const ten = [];
    for (const b of live.binhLuanGanDay(p.id, 30)) {
      if (d.daChao.has(b.id)) continue;
      d.daChao.add(b.id);
      if (b.da_an || b.nhan.some((n) => NHAN_KHONG_CHAO.includes(n))) continue;
      const goi = tenGoi(b.ten);
      if (goi && !ten.includes(goi) && ten.length < 3) ten.push(goi);
    }
    if (ten.length) d.lucChao = bayGio;
    return ten;
  }

  /** Mai thôi dẫn (DỪNG AI, chào kết, Mai không lên tiếng): chờ người dẫn bấm "▶ Mai dẫn tiếp". */
  tamDungDan(lyDo, { loi = false } = {}) {
    const d = this.dan;
    if (!d || d.tamDung) return;
    d.tamDung = true;
    this.baoDan(lyDo);
    if (!loi || !this.phongAi) return;
    try {
      if (this.phongAi.st.phienId !== d.phienId) this.phongAi.datLai(d.phienId);
      this.phongAi.bao(`Mai tạm dừng dẫn: ${lyDo}. Bấm "▶ Mai dẫn tiếp" để Mai dẫn lại.`, 'do');
    } catch { /* phiên đã xong */ }
  }

  /** "▶ Mai dẫn tiếp" (POST /live/phien/:id/mai-dan-tiep): dẫn lại từ đoạn đang nói, hoặc đoạn sau nếu đoạn này đã nói đủ. */
  danTiep(phienId) {
    if (!this.sanSang(phienId) || !this.m.maiDan || this.dan?.phienId !== phienId) {
      throw new LoiNghiepVu('KHONG_CO_LIVE', 'Mai chưa ở chế độ "Mai dẫn chính", hoặc Mai chưa sẵn sàng.', 409);
    }
    const d = this.dan;
    d.tamDung = false;
    if (!d.lucGiao) return this.baoDan(); // chưa đưa lượt nào: nhịp dẫn tự mở màn
    this.giaoLuot({ sangDoanKe: d.doanXong || d.giayNoi >= DOAN_DU_MS, mo: 'dan_tiep' });
  }

  baoDan(lyDo = null) {
    const d = this.dan;
    if (!d) return;
    let doan = null;
    try { doan = live.layPhien(d.phienId).doan_hien_tai; } catch { /* phiên đã mất */ }
    this.phat('live.mai_dan', { phien_id: d.phienId, trang_thai: d.tamDung ? 'tam_dung' : 'dang_dan', doan, vong: d.vong, ly_do: lyDo });
  }

  /* ---------------- chi phí ---------------- */

  /** Ghi phần chi phí từ lần ghi trước (agent "mieng"); vượt mức trần thì bật "Dừng mọi thứ". */
  /**
   * F-112: kết quả Decisions trong lúc Mai nói. Chỉ kết quả mới nhất (bỏ kết quả cũ đến muộn — `thuTu` theo chữ Mai nói), chỉ ở Mai dẫn
   * chính / Mai nói cùng (che_do_ai 'noi'), tin cậy ≥ ngưỡng `lien_tiep` lần liền; lựa chọn ngoài danh sách → bỏ. Món mới → đổi đoạn (đoạn kế tiếp có món đó)
   * như người dẫn bấm →; mời xem bảng size → chiếu bảng size của món đang nói. Cách đọc chữ (theoKipMai) vẫn chạy làm dự phòng.
   * @returns {{doan?:number, chieu?:string}|null}
   */
  nhanQuyetDinh(phienId, { traLoi, thuTu = null, tokenVao = 0 } = {}) {
    const m = this.m;
    if (!m || m.phienId !== phienId) return null;
    m.qdToken = (m.qdToken || 0) + (tokenVao || 0);
    if (thuTu != null) {
      if (thuTu <= (m.qdCuoi ?? -Infinity)) return null;
      m.qdCuoi = thuTu;
    }
    let p;
    try { p = live.layPhien(phienId); } catch { return null; }
    if (p.trang_thai !== 'dang_live' || p.che_do_ai !== 'noi') return null;
    const ch = { ...QD(), ...this.quyetDinhMai };
    const kq = {};
    const mon = traLoi?.mon_dang_noi;
    const so = Number(/^so_(\d+)$/.exec(String(mon?.chon ?? ''))?.[1]);
    const ds = p.kich_ban.doan;
    // Phép thử thật 28/10/2026: kết quả theo từng mẩu chữ dao động (0,42 → 0,85 → 0,96) — đổi thẻ khi ≥ ngưỡng `lien_tiep` lần liền.
    const chac = so && (mon.tinCay ?? 0) >= ch.nguong;
    m.qdMon = chac ? { so, lan: m.qdMon?.so === so ? m.qdMon.lan + 1 : 1 } : null;
    if (chac && m.qdMon.lan >= ch.lien_tiep && ds[p.doan_hien_tai]?.san_pham?.so !== so) {
      for (let j = 1; j <= ds.length; j += 1) {
        const i = (p.doan_hien_tai + j) % ds.length;
        if (ds[i].san_pham?.so !== so) continue;
        m.doan = i; // Mai tự đổi: lần đồng bộ sau không đưa lại câu kịch bản của đoạn
        p = live.doiDoan(p.id, i);
        this.phat('live.doan', { phien_id: p.id, doan: i, boi: 'mai_quyet_dinh' });
        kq.doan = i;
        break;
      }
    }
    const size = traLoi?.moi_xem_size;
    const sNay = p.kich_ban.doan[p.doan_hien_tai]?.san_pham;
    // Mời xem bảng size: ngưỡng cao hơn (câu hỏi có/không dao động hơn), mỗi món tối đa 1 lần / `size_cach_giay`.
    const lucSize = m.qdSize?.[sNay?.so] || 0;
    if (size?.chon === true && (size.tinCay ?? 0) >= ch.nguong_size && sNay && Date.now() - lucSize >= ch.size_cach_giay * 1000) {
      const r = chieuManHinhMieng(p.id, { so: sNay.so, mau: 'bang_size' });
      if (!r.loi) { kq.chieu = 'bang_size'; m.qdSize = { ...m.qdSize, [sNay.so]: Date.now() }; }
    }
    return kq;
  }

  tinhTien(m = this.m) {
    if (!m?.ket) return;
    m.tinhTu = Date.now();
    const giay = m.ket.giay || 0;
    const token = { vao: {}, ra: {} };
    for (const chieu of ['vao', 'ra']) {
      for (const [loai, so] of Object.entries(m.ket.token?.[chieu] || {})) token[chieu][loai] = so - (m.daTinh.token[chieu][loai] || 0);
    }
    const them = { giay: giay - m.daTinh.giay, token };
    m.daTinh = { giay, token: JSON.parse(JSON.stringify(m.ket.token || { vao: {}, ra: {} })) };
    const tokenVao = Object.values(token.vao).reduce((a, b) => a + b, 0);
    const tokenRa = Object.values(token.ra).reduce((a, b) => a + b, 0);
    const qdMoi = (m.qdToken || 0) - (m.qdDaTinh || 0);
    m.qdDaTinh = m.qdToken || 0;
    if (them.giay <= 0 && tokenVao + tokenRa <= 0 && qdMoi <= 0) return;
    // F-112: Decisions chạy kèm phiên GPT-Live tính theo token vào của gpt-6-luna (đầu ra miễn phí).
    const tien = chiPhi.tinhChiPhiMieng(m.model, them) + (qdMoi > 0 ? chiPhi.tinhChiPhi('gpt-6-luna', qdMoi, 0) : 0);
    let p = null;
    try { p = live.layPhien(m.phienId); } catch { /* phiên đã mất */ }
    const runId = nhatKy.taoRun({
      agentId: 'mieng', kichHoat: `Miệng ${tenMieng(m.model)}${them.giay ? ` · ${Math.round(them.giay)} giây phiên` : ''}`,
      phienLiveId: m.phienId, dienTap: !!p?.dien_tap,
    });
    nhatKy.xongRun(runId, { nha: m.nha, model: m.model, tokenVao, tokenRa, chiPhi: tien, ketQua: { giay: Math.round(them.giay), token } });
    const canhBao = chiPhi.kiemMucTran();
    require('../../nghiep-vu/chi-phi').baoVuotTran(this.phat, canhBao);
  }

  trangThai(phienId) {
    if (!this.m || this.m.phienId !== phienId) return { trang_thai: 'tat', model: null };
    const d = this.m.maiDan && this.dan?.phienId === phienId ? this.dan : null;
    return {
      trang_thai: this.m.sanSang ? 'san_sang' : 'dang_mo',
      model: this.m.model,
      dan: d ? { trang_thai: d.tamDung ? 'tam_dung' : 'dang_dan', vong: d.vong } : null,
    };
  }
}

module.exports = { MiengCuaMai, taoLoiDan, tinDoan, coTiengNoi, loiGiaoDoan, cauGia, tenGoi, CHAO_KET };
