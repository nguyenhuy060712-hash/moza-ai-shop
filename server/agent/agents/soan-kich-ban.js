'use strict';

/**
 * Soạn kịch bản live bán hàng bằng AI (SPEC.md F-37, F-45, F-49 bản bán hàng).
 *
 * Từ các sản phẩm Đang bán, AI viết đoạn mở đầu, mỗi sản phẩm một đoạn, đoạn kết thúc. Lời nhắc mỗi đoạn lưu dạng
 *   Người dẫn:
 *   - ý 1
 *   - ý 2
 *   Mai: câu Mai nói
 * để Màn hình người dẫn hiện tách hai phần và miệng của Mai nói phần "Mai:" khi người dẫn chuyển tới đoạn đó (F-22).
 * Trên sóng gọi món bằng "số + tên" (#60: "áo số 12, sơ mi linen"); cuối mỗi đoạn có lời mời chốt đúng cú pháp.
 * Thiếu sản phẩm, số lạ, đoạn sản phẩm thiếu lời mời chốt, có ghi số lượng còn, có câu kể đã mặc thử → phiếu bị trả lại
 * làm một lần nữa (A.8). Con số không thấy trong thẻ thì không chặn nhưng ghi thêm dòng "Kiểm lại" cho người dẫn.
 * Giọng có lên có xuống (#48): mỗi đoạn AI ghi gợi ý cách Mai nói, MOZA đặt trong ngoặc ở đầu câu "Mai:".
 * Kiểu "Đội AI dẫn" (#49, F-45): thoại của cả đội nhân vật AI như talk show, lời nhắc dạng "Tên: (cách nói) lời".
 * Kiểu "Radio {ten_shop}" (#74, F-49): cùng dạng thoại, tiết mục kiểu đài phát thanh (Điểm tin hàng mới, bản tin sản phẩm
 * kèm mẹo, Alo {ten_shop}, góc phối đồ, Lời nhắn gửi có "[Bài hát]").
 */

const { chayAgent } = require('../runtime');
const sp = require('../../nghiep-vu/san-pham');
const soTay = require('../../nghiep-vu/so-tay');
const kichBan = require('../../nghiep-vu/kich-ban');
const { tenAi, tenShop } = require('../../nghiep-vu/cai-dat');
const { boDau } = require('../../nghiep-vu/chung');
const { dongCaiDat } = require('../kiem-tra/kiem-tra');

const PHAN = {
  nguoi_dan: { type: 'array', items: { type: 'string' }, description: '3–5 câu người dẫn nói, câu nói tự nhiên có từ nối' },
  mai: { type: 'string', description: '1–2 câu Mai nói khi người dẫn chuyển sang đoạn này' },
  cach_noi: { type: 'string', description: 'Gợi ý cách Mai nói ở đoạn này, 2–6 chữ, ví dụ "hào hứng, nhanh", "chậm lại, rõ ràng", "vui, gần gũi"' },
};
const SO = { type: 'integer', description: 'Số sản phẩm của đoạn; 0 cho đoạn giao lưu' };
const DOAN_CHUNG = { type: 'object', properties: PHAN, required: ['nguoi_dan', 'mai', 'cach_noi'], additionalProperties: false };
const LUOC_DO = {
  type: 'object',
  properties: {
    ten: { type: 'string', description: 'Tên ngắn cho kịch bản' },
    mo_dau: DOAN_CHUNG,
    doan: {
      type: 'array',
      items: { type: 'object', properties: { so: SO, ...PHAN }, required: ['so', 'nguoi_dan', 'mai', 'cach_noi'], additionalProperties: false },
    },
    ket_thuc: DOAN_CHUNG,
  },
  required: ['ten', 'mo_dau', 'doan', 'ket_thuc'],
  additionalProperties: false,
};

// "Ít nhé thôi" (chủ dự án, 24/9/2026): cả kịch bản tối đa chừng này chữ "nhé".
const NHE_TOI_DA = 3;

/** Các con số trong một đoạn chữ, bỏ dấu chấm, phẩy ngăn cách ("289.000" → "289000"). */
const cacSo = (s) => (String(s).match(/\d[\d.,]*\d|\d/g) || []).map((x) => x.replace(/[.,]/g, ''));

/** Tên AI đặt cho kịch bản, gọn một dòng: AI có lúc nhét ghi chú ("| Kiểm lại: …") vào tên (chạy thật 24/9/2026). */
const tenGon = (s) => String(s || '').split(/[|\n]|Kiểm lại/iu)[0].replace(/\s+/g, ' ').trim().slice(0, 60);

/** Ngày hôm nay theo giờ Việt Nam, dạng "thứ Năm, 24/09/2026". */
function homNay(luc = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(luc);
}

/** Số chữ "nhé" trong mọi lời nói của kịch bản. */
function demNhe(phieu) {
  const cacDoan = [phieu.mo_dau, ...(phieu.doan || []), phieu.ket_thuc].filter(Boolean);
  const chu = cacDoan.map((d) => [...(d.nguoi_dan || []), d.mai || ''].join(' ')).join(' ').normalize('NFC');
  return (chu.match(/(?<!\p{L})nhé(?!\p{L})/giu) || []).length;
}

// F-45: kịch bản không ghi số lượng còn (đổi liên tục); không kể đã mặc thử như người thật (#52, #71).
const CON_SO = /(?<![a-z])(chi |con dung |con lai )?con\s+\d+\s*(chiec|cai|bo|mau|san pham|size)?(?![\d.,])/;
const MAC_THU = /(em|minh|toi|chi|anh|tui)\s+(da |tung |vua )?(mac thu|mac roi|mac di|mac len thay|mac no|thu roi)/;

/** Đoạn sản phẩm phải có lời mời chốt đúng số (F-45): "chốt 12". */
const coMoiChot = (chu, so) => new RegExp(`chot\\s*(so\\s*)?${so}(?!\\d)`).test(boDau(chu));

/** Lỗi chung của một đoạn sản phẩm (cả kiểu Mai lẫn đội): mời chốt, không ghi số còn, không kể mặc thử. */
function loiNoiDung(chu, ten, so) {
  const loi = [];
  const s = boDau(chu);
  if (so && !coMoiChot(chu, so)) loi.push(`${ten}: cuối đoạn cần lời mời chốt đúng cú pháp, ví dụ "chốt ${so} kèm màu, size".`);
  if (CON_SO.test(s)) loi.push(`${ten}: không ghi số lượng còn trong kịch bản (số còn đổi liên tục, chỉ nói trên sóng từ dữ liệu lúc đó).`);
  if (MAC_THU.test(s)) loi.push(`${ten}: không kể đã mặc thử, đã dùng như người thật — trợ lý AI chỉ nói theo thẻ sản phẩm.`);
  return loi;
}

/**
 * Lỗi buộc làm lại: số lạ, trùng, thiếu sản phẩm, đoạn trống, thiếu lời mời chốt, ghi số còn, kể mặc thử, quá nhiều đoạn
 * giao lưu. `kiemNhe`: thêm lỗi khi dùng "nhé" quá nhiều — chỉ bật ở lần kiểm đầu.
 */
function tichSai(phieu, spTheoSo, { kiemNhe = false } = {}) {
  const loi = [];
  const daCo = new Set();
  let giaoLuu = 0;
  for (const d of phieu.doan || []) {
    const so = Number(d.so) || 0;
    const chu = [...(d.nguoi_dan || []), d.mai || ''].join(' ');
    const coLoi = (d.nguoi_dan || []).some((y) => String(y).trim());
    if (!so) {
      giaoLuu += 1;
      if (!coLoi) loi.push('Đoạn giao lưu: chưa có lời cho người dẫn.');
      loi.push(...loiNoiDung(chu, 'Đoạn giao lưu', 0));
      continue;
    }
    if (!spTheoSo[so]) { loi.push(`Số ${d.so} không nằm trong danh sách sản phẩm được giao.`); continue; }
    if (daCo.has(so)) loi.push(`Sản phẩm số ${so} có hai đoạn; mỗi sản phẩm đúng một đoạn.`);
    daCo.add(so);
    if (!coLoi) loi.push(`Đoạn số ${so}: chưa có lời dẫn cho người dẫn.`);
    loi.push(...loiNoiDung(chu, `Đoạn số ${so}`, so));
  }
  for (const so of Object.keys(spTheoSo)) if (!daCo.has(Number(so))) loi.push(`Thiếu đoạn cho sản phẩm số ${so}.`);
  const toiDaGiaoLuu = Math.max(1, Math.ceil(Object.keys(spTheoSo).length / 3));
  if (giaoLuu > toiDaGiaoLuu) loi.push(`Có ${giaoLuu} đoạn giao lưu; tối đa ${toiDaGiaoLuu} — nghỉ ngắn thôi.`);
  if (kiemNhe) {
    const n = demNhe(phieu);
    if (n > NHE_TOI_DA) {
      loi.push(`Dùng chữ "nhé" ${n} lần; cả kịch bản tối đa ${NHE_TOI_DA} lần. Đổi cách kết câu cho giống người thật: câu mời thẳng, câu hỏi gợi mở, "đó", "luôn", "nè", hoặc không cần từ đệm.`);
    }
  }
  return loi;
}

/** Chữ thẻ sản phẩm dùng soát số (không kèm tồn kho — kịch bản không ghi số còn). */
const theKhongTon = (s) => sp.theChoAi(s, { tonKho: false });

/** Con số trong đoạn không thấy trong thẻ — ghi "Kiểm lại" cho người dẫn, không chặn. */
function soLa(d, s) {
  const nguon = cacSo(`${theKhongTon(s)} ${dongCaiDat().join(' ')}`);
  return [...new Set(cacSo([...(d.nguoi_dan || []), d.mai || ''].join(' ')).filter((x) => !nguon.includes(x)))];
}

/** Gợi ý cách nói gọn một dòng, bỏ ngoặc và dấu câu cuối (#48). */
function gonCachNoi(s) {
  return String(s ?? '').replace(/[()[\]\n]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.;:!?,]+$/u, '').slice(0, 60).trim();
}

function loiNhac(d, canhBao = []) {
  // AI lỡ viết gợi ý vào đầu câu nói thì gộp với ô cach_noi, không để Mai đọc thành lời.
  const { cachNoi: trongCau, loi } = kichBan.tachCachNoi(String(d.mai || '').trim());
  const cach = [...new Set([gonCachNoi(d.cach_noi), gonCachNoi(trongCau)].join(',').split(',').map((x) => x.trim()).filter(Boolean))].join(', ');
  const dong = [
    'Người dẫn:',
    ...(d.nguoi_dan || []).map((y) => String(y).trim()).filter(Boolean).map((y) => `- ${y.replace(/^[-•·]\s*/, '')}`),
    ...(canhBao.length ? [`- Kiểm lại trước khi nói: số ${canhBao.join(', ')} không thấy trong thẻ sản phẩm.`] : []),
    `Mai: ${cach ? `(${cach}) ` : ''}${loi}`.trimEnd(),
  ];
  return dong.join('\n').slice(0, 2000);
}

/** Sản phẩm Đang bán kèm thẻ (không số còn) cho AI soạn. */
function dsSanPham() {
  return sp.mucLucDangBan().map((x) => sp.laySanPham(x.id));
}

const KHONG_CO_SP = { ok: false, loi: { ma: 'SP_KHONG_BAN_DUOC', thong_diep: 'Chưa có sản phẩm nào Đang bán. Chuyển ít nhất một sản phẩm sang Đang bán trước.' } };

/**
 * AI soạn kịch bản từ các sản phẩm Đang bán rồi lưu thành kịch bản mới.
 * @param {object} [o]
 * @param {'mai'|'doi'|'radio'} [o.kieu]   'doi' = Đội AI dẫn (F-45); 'radio' = Radio {ten_shop} (F-49) — cũng do đội AI đọc
 * @param {object} [o.nhaCungCap]  nhà cung cấp giả (test)
 * @returns {Promise<{ok:boolean, kichBan?:object, loi?:object, runId?:string, model?:string}>}
 */
async function soanKichBan({ kieu = 'mai', nhaCungCap } = {}) {
  if (kieu === 'doi' || kieu === 'radio') return soanKichBanDoi({ nhaCungCap, radio: kieu === 'radio' });
  const ds = dsSanPham();
  if (!ds.length) return KHONG_CO_SP;
  const spTheoSo = Object.fromEntries(ds.map((s) => [s.so, s]));
  const gioiThieu = soTay.danhSachMuc().filter((m) => m.noi_dung.trim()).slice(0, 4);
  const ai = tenAi().split(' - ')[0] || 'Mai';
  const shop = tenShop();
  const tinDau = [
    `## Các sản phẩm Đang bán (${ds.length}) — thẻ sản phẩm`,
    ...ds.map((s) => `### ${theKhongTon(s)}`),
    dongCaiDat().length ? `## Bán hàng\n${dongCaiDat().join('\n')}` : '',
    gioiThieu.length ? `## Sổ tay ${shop}` : '',
    ...gioiThieu.map((m) => `### ${m.tieu_de}\n${m.noi_dung.trim()}`),
    '',
    '## Việc của bạn',
    `Soạn kịch bản cho một buổi livestream bán quần áo khoảng 30–45 phút của ${shop}. Người dẫn cầm điện thoại live, giới thiệu hàng; ${ai} là trợ lý AI cùng dẫn, nói ra loa. Hai người như một cặp MC bán hàng ăn ý: nói qua lại, nối tiếp nhau, không ai đọc danh sách.`,
    'Gọi sản phẩm bằng số kèm tên, ví dụ "áo số 12, sơ mi linen" — khách chốt bằng số. Cách chốt: bình luận "chốt" + số + màu + size (ví dụ "chốt 12 đen M").',
    'Làm cho buổi live cuốn hút và liền mạch:',
    '- Mở đầu có "móc câu": món hot nhất hôm nay (điểm hút nhất theo thẻ) để người xem ở lại; nhắc cách chốt.',
    '- Mỗi đoạn một món: câu đầu nối từ đoạn trước, rồi điểm hút (chất liệu, form, dịp mặc — lấy từ Điểm nổi bật, Thông số), rồi giá, màu, size; cuối đoạn **luôn có lời mời chốt đúng số**, ví dụ "ưng thì chốt 12 kèm màu, size nha".',
    '- Có thể gợi ý phối với món trong mục "Phối cùng" của thẻ.',
    '- Lời người dẫn là câu nói tự nhiên có từ nối (mà, thêm nữa, đặc biệt, còn nếu…), không phải gạch đầu dòng khô.',
    `- Câu của ${ai} nói ĐẦU đoạn, ngay khi người dẫn chuyển sang: dẫn vào món của chính đoạn đó — một điểm hút nhất, có khi hỏi người dẫn một câu; không nói về món kế tiếp; không lặp y lời người dẫn.`,
    `- Nghỉ ngắn: sau mỗi 3–4 món chèn một đoạn giao lưu rất ngắn (so = 0, 2–3 câu): chào người mới, nhắc cách chốt, trả lời câu hay hỏi về size, ship (chỉ theo Sổ tay, Bán hàng); ${ai} tóm nhanh các món vừa nói.`,
    `- Câu ngắn xen câu dài, có cảm xúc — câu cảm thán, câu hỏi gợi mở. Cả kịch bản dùng chữ "nhé" tối đa ${NHE_TOI_DA} lần; không câu nào cũng "ạ" hay "nha".`,
    `- mo_dau: móc câu, chào, giới thiệu ${shop}, hôm nay có ${ds.length} mẫu, cách chốt; ${ai} tự giới thiệu là trợ lý AI của shop.`,
    `- doan: mỗi sản phẩm đúng một đoạn, đủ ${ds.length} món; ô so ghi đúng số sản phẩm. Xếp món hấp dẫn trước; chèn đoạn giao lưu (so = 0) như trên.`,
    '  nguoi_dan: 3–5 câu: điểm hút, chất liệu, form, dịp mặc, giá, màu, size, lời mời chốt.',
    `  mai: 1–2 câu ${ai} nói khi vào đoạn.`,
    `- ket_thuc: tóm vài món nổi bật, nhắc ai đã chốt mở tin nhắn của shop để xác nhận đơn, cảm ơn; ${ai} chào tạm biệt.`,
    `- cach_noi (mọi đoạn): gợi ý ngắn cách ${ai} nói ở đoạn đó, 2–6 chữ, đổi theo nội dung (hào hứng ở điểm hút, chậm lại rõ ràng ở giá, vui ở giao lưu, ấm ở kết). Hai đoạn liền nhau không dùng cùng một cách nói.`,
    'Luật (quảng cáo, Luật Trí tuệ nhân tạo): giá chép đúng thẻ (giá riêng từng màu × cỡ nếu có); chỉ nói "giảm từ …" khi thẻ có Giá gốc; **không ghi số lượng còn** (số còn đổi liên tục — chỉ nói trên sóng từ dữ liệu lúc đó); không nói "sắp hết", "cuối cùng"; không hứa giảm giá, quà, miễn ship ngoài Bán hàng; không bịa chất liệu, xuất xứ, công dụng ngoài thẻ; dòng "(chưa xác nhận)" không nói như sự thật; không kể đã mặc thử, đã dùng như người thật; không chê hàng nơi khác.',
    `Hôm nay là ${homNay()}.`,
  ].filter((x) => x !== '').join('\n');

  let lanKiem = 0;
  const kq = await chayAgent({
    agentId: 'soan_kich_ban',
    kichHoat: `Soạn kịch bản live từ ${ds.length} sản phẩm Đang bán`,
    tinDau,
    luocDo: LUOC_DO,
    // Quá nhiều "nhé" chỉ bắt viết lại một lần; lần sau chỉ kiểm cấu trúc.
    kiemPhieuThem: (p) => { lanKiem += 1; return tichSai(p, spTheoSo, { kiemNhe: lanKiem === 1 }); },
    nguonDaDua: { san_pham: Object.fromEntries(ds.map((s) => [s.id, s.phien_ban])) },
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  if (!kq.ok) return kq;

  const p = kq.ketQua;
  const doan = [
    { san_pham_id: null, loi_nhac: loiNhac(p.mo_dau) },
    ...p.doan.map((d) => {
      const s = spTheoSo[Number(d.so)];
      if (!s) return { san_pham_id: null, loi_nhac: loiNhac(d) }; // đoạn giao lưu ngắn
      return { san_pham_id: s.id, loi_nhac: loiNhac(d, soLa(d, s)) };
    }),
    { san_pham_id: null, loi_nhac: loiNhac(p.ket_thuc) },
  ];
  const gioPhut = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date());
  const ten = `Kịch bản AI · ${tenGon(p.ten) || 'Live bán hàng'} · ${gioPhut}`.slice(0, 100);
  return { ok: true, kichBan: kichBan.taoKichBan({ ten, doan }), runId: kq.runId, nha: kq.nha, model: kq.model };
}

/* ==================== Kiểu "Đội AI dẫn" (#49, F-45) ==================== */

// Tiết mục của talk show bán hàng (F-45). Tên hiện trong lời nhắc là dòng "[…]", không đọc lên sóng.
const TIET_MUC = {
  ban_tin: 'Bản tin hàng mới',
  hoi_dap: 'Hỏi nhanh – đáp gọn',
  so_ke: 'So kè hai mẫu',
  phoi_do: 'Gợi ý phối đồ',
  gioi_thieu: 'Giới thiệu sản phẩm',
  giai_dap: 'Giải đáp size, ship',
  do_vui: 'Đố vui',
  chot_vong: 'Chốt vòng',
};

// Tiết mục của Radio {ten_shop} (#74, F-49). "Điểm tin hàng mới", "Alo …", "Lời nhắn gửi" là dấu nhận ra kịch bản Radio
// (nghiep-vu/doi-ai.js laKichBanRadio) — đổi tên thì đổi cả ở đó.
function tietMucRadio() {
  return {
    diem_tin: 'Điểm tin hàng mới',
    ban_tin: 'Bản tin sản phẩm',
    alo: `Alo ${tenShop()}`,
    phoi_do: 'Góc phối đồ',
    do_vui: 'Đố vui',
    loi_nhan: 'Lời nhắn gửi',
    diem_lai: 'Điểm lại',
  };
}
// Khóa tiết mục Radio (lược đồ phiếu). Tên hiện thật lấy từ tietMucRadio() lúc soạn (có tên shop).
const TIET_MUC_RADIO = { diem_tin: '', ban_tin: '', alo: '', phoi_do: '', do_vui: '', loi_nhan: '', diem_lai: '' };

function luocDoDoi(tenAiDs, { radio = false } = {}) {
  const doan = {
    tiet_muc: { type: 'string', enum: Object.keys(radio ? TIET_MUC_RADIO : TIET_MUC) },
    thoai: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ai: { type: 'string', enum: tenAiDs, description: 'Nhân vật nói lượt này' },
          cach_noi: { type: 'string', description: 'Cách nói lượt này, 2–6 chữ, ví dụ "hào hứng, nhanh", "trêu, cười", "chậm lại, rõ ràng"' },
          loi: { type: 'string', description: 'Đúng câu nhân vật nói (được dùng <laugh>, <chuckle>, |ừ|, |thật á?|)' },
        },
        required: ['ai', 'cach_noi', 'loi'],
        additionalProperties: false,
      },
    },
    cho_sau_luot: { type: 'integer', description: 'Đố vui: số lượt nói trước khi dừng chờ người xem bình luận đáp án; không phải đố vui thì 0' },
    cho_giay: { type: 'integer', description: 'Đố vui: số giây chờ (10–30); không phải đố vui thì 0' },
    dap_an: { type: 'array', items: { type: 'string' }, description: 'Đố vui: các cách viết đáp án đúng (ví dụ "12", "số 12"); không phải đố vui thì []' },
    ...(radio ? { bai_hat_sau_luot: { type: 'integer', description: 'Lời nhắn gửi: số lượt nói trước khi phát bài hát; tiết mục khác thì 0' } } : {}),
  };
  const req = ['tiet_muc', 'thoai', 'cho_sau_luot', 'cho_giay', 'dap_an', ...(radio ? ['bai_hat_sau_luot'] : [])];
  const chung = { type: 'object', properties: doan, required: req, additionalProperties: false };
  return {
    type: 'object',
    properties: {
      ten: { type: 'string', description: 'Tên ngắn cho kịch bản' },
      mo_dau: chung,
      doan: {
        type: 'array',
        items: { type: 'object', properties: { so: SO, ...doan }, required: ['so', ...req], additionalProperties: false },
      },
      ket_thuc: chung,
    },
    required: ['ten', 'mo_dau', 'doan', 'ket_thuc'],
    additionalProperties: false,
  };
}

const loiCuaDoan = (d) => (d?.thoai || []).map((l) => l.loi || '').join(' ');

function demNheDoi(phieu) {
  const chu = [phieu.mo_dau, ...(phieu.doan || []), phieu.ket_thuc].filter(Boolean).map(loiCuaDoan).join(' ').normalize('NFC');
  return (chu.match(/(?<!\p{L})nhé(?!\p{L})/giu) || []).length;
}

/**
 * Lỗi buộc làm lại của kịch bản đội: như kiểu Mai, thêm thoại phải có đủ lượt, mở đầu phải có hai nhân vật, có ít nhất
 * một đoạn so kè hoặc phối đồ (F-45). `radio`: đoạn Lời nhắn gửi có chỗ bài hát; ít nhất một, tối đa một cho mỗi 4 món.
 */
function tichSaiDoi(phieu, spTheoSo, tenAiDs, { kiemNhe = false, radio = false } = {}) {
  const loi = [];
  const daCo = new Set();
  let giaoLuu = 0;
  let loiNhan = 0;
  const kiemThoai = (d, ten, so = 0) => {
    const ds = (d?.thoai || []).filter((l) => String(l.loi || '').trim());
    if (ds.length < 2) loi.push(`${ten}: cần ít nhất 2 lượt nói.`);
    if (d?.tiet_muc === 'do_vui' && (!d.dap_an?.length || !(d.cho_sau_luot > 0 && d.cho_sau_luot < ds.length))) {
      loi.push(`${ten}: đố vui cần "dap_an" và "cho_sau_luot" nằm giữa câu hỏi và câu đáp.`);
    }
    if (radio && d?.tiet_muc === 'loi_nhan' && !(d.bai_hat_sau_luot > 0 && d.bai_hat_sau_luot < ds.length)) {
      loi.push(`${ten}: Lời nhắn gửi cần "bai_hat_sau_luot" nằm giữa lời mời nghe bài hát và lời quay lại với hàng.`);
    }
    loi.push(...loiNoiDung(loiCuaDoan(d), ten, so));
  };
  const nvMoDau = new Set((phieu.mo_dau?.thoai || []).map((l) => l.ai));
  if (nvMoDau.size < Math.min(2, tenAiDs.length)) loi.push('Mở đầu: mỗi nhân vật phải lên tiếng tự giới thiệu là trợ lý AI.');
  kiemThoai(phieu.mo_dau, 'Mở đầu');
  for (const d of phieu.doan || []) {
    const so = Number(d.so) || 0;
    if (!so) {
      if (radio && d.tiet_muc === 'loi_nhan') loiNhan += 1;
      else giaoLuu += 1;
      kiemThoai(d, radio && d.tiet_muc === 'loi_nhan' ? 'Đoạn Lời nhắn gửi' : 'Đoạn giao lưu');
      continue;
    }
    if (!spTheoSo[so]) { loi.push(`Số ${d.so} không nằm trong danh sách sản phẩm được giao.`); continue; }
    if (daCo.has(so)) loi.push(`Sản phẩm số ${so} có hai đoạn; mỗi sản phẩm đúng một đoạn.`);
    daCo.add(so);
    if (radio && d.tiet_muc === 'loi_nhan') loi.push(`Đoạn số ${so}: Lời nhắn gửi là đoạn riêng, so = 0.`);
    kiemThoai(d, `Đoạn số ${so}`, so);
  }
  for (const so of Object.keys(spTheoSo)) if (!daCo.has(Number(so))) loi.push(`Thiếu đoạn cho sản phẩm số ${so}.`);
  const soSp = Object.keys(spTheoSo).length;
  if (!radio && soSp >= 2 && !(phieu.doan || []).some((d) => ['so_ke', 'phoi_do'].includes(d.tiet_muc))) {
    loi.push('Cần ít nhất một đoạn "so_ke" (so kè hai mẫu) hoặc "phoi_do" (gợi ý phối đồ).');
  }
  const toiDaGiaoLuu = Math.max(1, Math.ceil(soSp / 3));
  if (giaoLuu > toiDaGiaoLuu) loi.push(`Có ${giaoLuu} đoạn giao lưu; tối đa ${toiDaGiaoLuu}.`);
  if (radio) {
    const toiDa = Math.max(1, Math.ceil(soSp / 4));
    if (!loiNhan) loi.push('Chưa có đoạn Lời nhắn gửi (tiet_muc loi_nhan, so = 0) nào.');
    if (loiNhan > toiDa) loi.push(`Có ${loiNhan} đoạn Lời nhắn gửi; tối đa ${toiDa} — mỗi 4–5 món một đoạn.`);
  }
  if (kiemNhe) {
    const n = demNheDoi(phieu);
    if (n > NHE_TOI_DA) loi.push(`Dùng chữ "nhé" ${n} lần; cả kịch bản tối đa ${NHE_TOI_DA} lần. Đổi cách kết câu cho giống người thật.`);
  }
  return loi;
}

/** Lời nhắc của một đoạn đội AI: "[Tiết mục]", "Tên: (cách nói) lời", chỗ chờ, đáp án, "[Bài hát]" (Radio), "Kiểm lại". */
function loiNhacDoi(d, canhBao = [], { radio = false } = {}) {
  const ten = radio ? tietMucRadio() : TIET_MUC;
  const dong = [`[${ten[d.tiet_muc] || (radio ? ten.ban_tin : TIET_MUC.gioi_thieu)}]`];
  const thoai = (d.thoai || []).filter((l) => String(l.loi || '').trim());
  const cho = d.tiet_muc === 'do_vui' && d.cho_sau_luot > 0 && d.cho_sau_luot < thoai.length ? d.cho_sau_luot : 0;
  const baiHat = radio && d.tiet_muc === 'loi_nhan' && d.bai_hat_sau_luot > 0 && d.bai_hat_sau_luot <= thoai.length ? d.bai_hat_sau_luot : 0;
  thoai.forEach((l, i) => {
    if (cho && i === cho) dong.push(`[Chờ bình luận ${Math.min(60, Math.max(10, Number(d.cho_giay) || 20))} giây]`);
    if (baiHat && i === baiHat) dong.push('[Bài hát]');
    const { cachNoi: trongCau, loi } = kichBan.tachCachNoi(String(l.loi).trim());
    const cach = [...new Set([gonCachNoi(l.cach_noi), gonCachNoi(trongCau)].join(',').split(',').map((x) => x.trim()).filter(Boolean))].join(', ');
    dong.push(`${l.ai}: ${cach ? `(${cach}) ` : ''}${loi}`.trimEnd());
  });
  if (baiHat === thoai.length) dong.push('[Bài hát]');
  if (cho && d.dap_an?.length) dong.push(`Đáp án: ${d.dap_an.map((x) => String(x).replace(/[;\n]/g, ' ').trim()).filter(Boolean).join('; ')}`);
  if (canhBao.length) dong.push(`- Kiểm lại trước khi lên sóng: số ${canhBao.join(', ')} không thấy trong thẻ sản phẩm — đội AI sẽ không đọc câu có số này.`);
  return dong.join('\n').slice(0, 4000);
}

/** Luật chung cho kịch bản đội và Radio (#52, #71). */
function luatChung(shop) {
  return [
    'Luật bắt buộc (Luật Trí tuệ nhân tạo, quảng cáo, bảo vệ người tiêu dùng):',
    `- mo_dau: mỗi nhân vật tự giới thiệu mình là trợ lý AI của ${shop} (một câu ngắn).`,
    '- Không nhân vật nào kể đã mặc thử, đã dùng như người thật ("em mặc rồi mát lắm" là sai); không đóng vai chủ shop hay khách mua.',
    '- Giá chép đúng thẻ; chỉ nói "giảm từ …" khi thẻ có Giá gốc; **không ghi số lượng còn** (số còn đổi liên tục; MOZA tự chen câu "vừa chốt", "vừa hết", "còn ít" bằng dữ liệu thật); không nói "sắp hết", "cuối cùng".',
    '- Không hứa giảm giá, quà, miễn ship ngoài mục Bán hàng; không bịa chất liệu, xuất xứ, công dụng ngoài thẻ; dòng "(chưa xác nhận)" không nói như sự thật; không chê hàng nơi khác. Đố vui chỉ chúc mừng, không treo thưởng.',
    `- Hôm nay là ${homNay()}.`,
    'Gọi món bằng số kèm tên ("áo số 12, sơ mi linen"). Cuối mỗi đoạn sản phẩm có lời mời chốt đúng số: "chốt 12 kèm màu, size".',
  ];
}

/** Lời dặn riêng của kiểu Radio {ten_shop} (#74, F-49): hai MC trò chuyện ấm như đài phát thanh. */
function viecRadio(soSp, shop) {
  return [
    `Kiểu kịch bản lần này: **Radio ${shop}** — dẫn như một chương trình phát thanh được yêu thích: hữu ích, gần gũi, cuốn hút. Đội trợ lý AI trên là các MC của đài: trò chuyện ấm áp, nối nhau nhịp nhàng, gọi người xem là "quý vị và các bạn" hoặc "cả nhà". Người dẫn thật chỉ thỉnh thoảng chen vào nên kịch bản không viết lời cho người dẫn. Buổi live khoảng 30–45 phút.`,
    ...luatChung(shop),
    '- Không nói giờ hiện tại: phần mềm tự báo giờ sau nhạc hiệu và sau mỗi bài hát.',
    'Các tiết mục (tiet_muc):',
    `- mo_dau (diem_tin — Điểm tin hàng mới): vào thẳng lời chào của chương trình; mỗi nhân vật tự giới thiệu là trợ lý AI; điểm nhanh 3–4 món nổi bật nhất hôm nay (mỗi món một câu, điểm hút); cách chốt; mời quý vị bình luận lời chúc, lời nhắn gửi người thân để đội đọc lên sóng trước bài hát.`,
    `- doan: mỗi sản phẩm đúng một đoạn (ban_tin — Bản tin sản phẩm), đủ ${soSp} món; ô so ghi đúng số. Hai MC trò chuyện như đọc bản tin: điểm hút trước, rồi chất liệu, form, dịp mặc, giá, màu, size; mỗi bản tin kèm **một mẹo hữu ích** lấy từ thẻ hoặc Sổ tay (cách giặt, cách chọn size, dịp mặc); cuối đoạn mời chốt.`,
    '- Chen các đoạn không có sản phẩm (so = 0):',
    '  - loi_nhan (Lời nhắn gửi): sau mỗi 4–5 món một đoạn, cả kịch bản ít nhất một đoạn. 1–2 lượt mời: cảm ơn quý vị đã gửi lời nhắn, mời cùng nghe một bài hát; bai_hat_sau_luot = số lượt trước bài hát (phần mềm tự đọc lời chúc, giới thiệu tên bài rồi phát); sau đó 1–2 lượt quay lại với hàng. Không nêu tên bài, không bịa lời chúc.',
    `  - alo (Alo ${shop}): hộp thư — một người nêu câu khách hay hỏi (size, ship, đổi trả, thanh toán), người kia trả lời gọn **chỉ theo Sổ tay và mục Bán hàng**; Sổ tay không có thì nói shop sẽ báo trong tin nhắn. Nói "nhiều bạn hay hỏi", không bịa người hỏi.`,
    '  - phoi_do (Góc phối đồ): gợi ý phối giữa các món đang bán (theo mục "Phối cùng" hoặc hợp dịp mặc), nhắc số từng món.',
    '  - do_vui: đố một câu về món vừa giới thiệu (đáp án là số sản phẩm, màu hoặc vài chữ); cho_sau_luot, cho_giay 15–25, dap_an các cách viết.',
    '  alo, phoi_do, do_vui cộng lại tối đa 1 đoạn cho mỗi 3 món.',
    '- ket_thuc (diem_lai — Điểm lại): tóm vài món nổi bật, nhắc cách chốt, nhắc ai đã chốt mở tin nhắn của shop; **không chào tạm biệt** — chương trình còn tiếp.',
    'Giọng phát thanh:',
    '- Mỗi đoạn 30–70 giây, 4–10 lượt; mỗi lượt 1–2 câu ngắn, tối đa 2 con số; cach_noi đổi theo nội dung.',
    `- Có tung có hứng, thỉnh thoảng câu đùa duyên <chuckle>, tiếng chen |ừ|, |đúng rồi|. Cả kịch bản dùng "nhé" tối đa ${NHE_TOI_DA} lần.`,
    '- "loi" chỉ gồm đúng câu nhân vật nói ra loa: không chỉ dẫn sân khấu, không nhắc nhạc, không ghi chú.',
    '- bai_hat_sau_luot: chỉ đoạn loi_nhan có (> 0); đoạn khác ghi 0. cho_sau_luot, cho_giay: chỉ đố vui; đoạn khác ghi 0, dap_an [].',
  ];
}

function viecDoi(soSp, shop) {
  return [
    'Kiểu kịch bản lần này: **Đội AI dẫn** — cả buổi do đội trợ lý AI trên dẫn như một talk show bán hàng vui, cuốn hút: người hỏi, người đáp, tung hứng, trêu nhau. Người dẫn thật chỉ thỉnh thoảng chen vào nên kịch bản không viết lời cho người dẫn. Buổi live khoảng 30–45 phút.',
    ...luatChung(shop),
    'Làm cho talk show cuốn hút:',
    '- Vai do bạn chia và đổi qua các đoạn: có người hỏi đúng câu khách hay thắc mắc (mặc size gì, vải có nóng không, có co giãn không, giặt máy được không, phối với gì), có người đáp gọn đúng thẻ; có người pha trò. Gọi người xem là "cả nhà".',
    '- Mỗi đoạn một tiết mục (tiet_muc), đổi luân phiên: hoi_dap, so_ke (hai người mỗi người "bênh" một mẫu rồi chốt: chọn theo dáng người, dịp mặc), phoi_do (gợi ý phối giữa các món đang bán), gioi_thieu, ban_tin. Hai đoạn liền nhau không cùng tiết mục. Cả kịch bản có ít nhất một đoạn so_ke hoặc phoi_do.',
    '- Sau mỗi 3–4 món chèn một đoạn giao lưu (so = 0): giai_dap (size, ship, đổi trả — chỉ theo Sổ tay và mục Bán hàng) hoặc do_vui (đáp án là số sản phẩm, màu hoặc vài chữ; cho_sau_luot, cho_giay 15–25, dap_an). Tối đa 1 đoạn giao lưu cho mỗi 3 món.',
    '- mo_dau (ban_tin): vào thẳng câu chào; món hot nhất hôm nay; hôm nay có những món nào; cách chốt.',
    '- "loi" chỉ gồm đúng câu nhân vật nói ra loa: không chỉ dẫn sân khấu, không ghi chú; cảm xúc ghi ở "cach_noi".',
    '- ket_thuc (chot_vong): tóm vài món nổi bật, nhắc cách chốt, nhắc mở tin nhắn của shop; **không chào tạm biệt** — buổi live còn tiếp.',
    '- Mỗi đoạn 30–70 giây, 4–10 lượt; mỗi lượt 1–2 câu ngắn, tối đa 2 con số.',
    `- **Đoạn nào cũng có ít nhất một chỗ vui**: trêu nhẹ, câu đùa duyên, kèm <laugh> hoặc <chuckle>, |ừ|, |thật á?|. Cả kịch bản dùng "nhé" tối đa ${NHE_TOI_DA} lần; không câu nào cũng "ạ" hay "nha".`,
    `- doan: mỗi sản phẩm đúng một đoạn, đủ ${soSp} món; ô so ghi đúng số sản phẩm. Xếp món hấp dẫn trước.`,
  ];
}

async function soanKichBanDoi({ nhaCungCap, radio = false } = {}) {
  const doiAi = require('../../nghiep-vu/doi-ai');
  const ds = dsSanPham();
  if (!ds.length) return KHONG_CO_SP;
  const shop = tenShop();
  const nv = doiAi.nhanVat();
  const tenNv = nv.map((n) => n.ten);
  const spTheoSo = Object.fromEntries(ds.map((s) => [s.so, s]));
  const soTayDs = soTay.danhSachMuc().filter((m) => m.noi_dung.trim()).slice(0, 8);
  const gioi = (n) => (n.gioi === 'nam' ? 'nam' : n.gioi === 'nu' ? 'nữ' : 'chưa rõ nam hay nữ');
  const tinDau = [
    `## Các sản phẩm Đang bán (${ds.length}) — thẻ sản phẩm`,
    ...ds.map((s) => `### ${theKhongTon(s)}`),
    dongCaiDat().length ? `## Bán hàng\n${dongCaiDat().join('\n')}` : '',
    soTayDs.length ? `## Sổ tay ${shop} (dùng cho tiết mục giải đáp, Alo)` : '',
    ...soTayDs.map((m) => `### ${m.tieu_de}\n${m.noi_dung.trim()}`),
    '',
    '## Đội trợ lý AI dẫn live',
    ...nv.map((n, i) => `- ${n.ten} (${gioi(n)}${i === 0 ? ', trợ lý AI chính' : ''})${n.net ? `: ${n.net}` : ''}`),
    '',
    '## Việc của bạn',
    ...(radio ? viecRadio(ds.length, shop) : viecDoi(ds.length, shop)),
  ].filter((x) => x !== '').join('\n');

  let lanKiem = 0;
  const kq = await chayAgent({
    agentId: 'soan_kich_ban',
    kichHoat: `Soạn kịch bản ${radio ? `Radio ${shop}` : 'Đội AI dẫn'} từ ${ds.length} sản phẩm Đang bán`,
    tinDau,
    luocDo: luocDoDoi(tenNv, { radio }),
    kiemPhieuThem: (p) => { lanKiem += 1; return tichSaiDoi(p, spTheoSo, tenNv, { kiemNhe: lanKiem === 1, radio }); },
    nguonDaDua: { san_pham: Object.fromEntries(ds.map((s) => [s.id, s.phien_ban])) },
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  if (!kq.ok) return kq;

  const p = kq.ketQua;
  const soLaDoi = (d, s) => {
    const nguon = cacSo(`${theKhongTon(s)} ${dongCaiDat().join(' ')}`);
    return [...new Set(cacSo(loiCuaDoan(d)).filter((x) => !nguon.includes(x)))];
  };
  // Radio: mở đầu luôn là Điểm tin, cuối là Điểm lại (dấu nhận ra kịch bản Radio — F-49), dù AI ghi tiết mục khác.
  const moDau = radio ? { ...p.mo_dau, tiet_muc: 'diem_tin' } : p.mo_dau;
  const ketThuc = radio ? { ...p.ket_thuc, tiet_muc: 'diem_lai' } : p.ket_thuc;
  const tuyChon = { radio };
  const doan = [
    { san_pham_id: null, loi_nhac: loiNhacDoi(moDau, [], tuyChon) },
    ...p.doan.map((d) => {
      const s = spTheoSo[Number(d.so)];
      if (!s) return { san_pham_id: null, loi_nhac: loiNhacDoi(d, [], tuyChon) }; // đoạn giao lưu, Lời nhắn gửi
      return { san_pham_id: s.id, loi_nhac: loiNhacDoi(d, soLaDoi(d, s), tuyChon) };
    }),
    { san_pham_id: null, loi_nhac: loiNhacDoi(ketThuc, [], tuyChon) },
  ];
  const gioPhut = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date());
  const ten = `${radio ? 'Radio' : 'Đội AI'} · ${tenGon(p.ten) || 'Live bán hàng'} · ${gioPhut}`.slice(0, 100);
  return { ok: true, kichBan: kichBan.taoKichBan({ ten, doan }), runId: kq.runId, nha: kq.nha, model: kq.model };
}

module.exports = {
  soanKichBan, tichSai, soLa, cacSo, demNhe, LUOC_DO, NHE_TOI_DA, coMoiChot, loiNoiDung,
  soanKichBanDoi, tichSaiDoi, loiNhacDoi, luocDoDoi, demNheDoi, TIET_MUC, TIET_MUC_RADIO, tietMucRadio,
};
