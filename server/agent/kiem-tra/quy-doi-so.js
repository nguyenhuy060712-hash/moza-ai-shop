'use strict';

/**
 * Quy đổi số tiếng Việt cho Bộ kiểm tra (SPEC.md A.4, luật K3): đọc mọi con số trong câu,
 * dù viết bằng chữ số hay bằng chữ, để "5.100.000đ", "5tr1", "năm triệu một trăm nghìn" là một.
 * Gốc từ bản thử ở M0 (scripts/thu-m0/so-tieng-viet.js), thêm: bỏ mã tin, khoảng có bậc ("7-9tr"),
 * số đầu của khoảng mượn bậc của số sau ("5 đến 7 triệu").
 */

const CHU_SO = {
  'không': 0, 'linh': null, 'lẻ': null,
  'một': 1, 'mốt': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'tư': 4, 'năm': 5, 'lăm': 5, 'nhăm': 5,
  'sáu': 6, 'bảy': 7, 'bẩy': 7, 'tám': 8, 'chín': 9,
};
const BAC = { 'mươi': 10, 'mười': 10, 'trăm': 100, 'nghìn': 1000, 'ngàn': 1000, 'triệu': 1e6, 'tỷ': 1e9, 'tỉ': 1e9 };
// Bậc viết sau chữ số: "5 triệu", "5tr", "300k".
const BAC_SAU_SO = { 'triệu': 1e6, 'tr': 1e6, 'tỷ': 1e9, 'tỉ': 1e9, 'nghìn': 1000, 'ngàn': 1000, 'k': 1000 };

// "9 triệu một tháng" là 9 triệu MỖI tháng, không phải 9,1 triệu: chữ số đứng sau bậc
// mà ngay sau nó là một danh từ đếm được thì thuộc về danh từ đó, không phải phần lẻ của bậc.
// Bán hàng: "199k một cái", "289k 1 chiếc" là giá MỖI cái, không phải 199.100.
const DANH_TU = new Set(['tháng', 'ngày', 'tuần', 'lần', 'ca', 'người', 'buổi', 'tiếng', 'giờ', 'phút', 'suất', 'bạn', 'chỗ',
  'chiếc', 'cái', 'bộ', 'món', 'đôi', 'set', 'sản', 'mẫu', 'áo', 'quần', 'váy', 'đầm', 'đơn', 'size', 'màu']);

// Từ nối hai đầu của một khoảng: "18 đến 35", "5 - 7 triệu".
const NOI_KHOANG = new Set(['-', '–', 'đến', 'tới', 'tơi', '->']);

// Chuẩn hóa NFC trước mọi so sánh (SPEC.md mục 7): cùng chữ "ư" có thể có hai cách mã hóa.
function chuan(s) {
  return String(s ?? '').normalize('NFC').toLowerCase();
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mã tin kiểu "BN-012" là mã, không phải con số (K1, K4 so mã tin riêng). Chỉ bỏ dạng CHỮ HOA-số,
// để "5tr - 7tr" không bị nhầm thành mã.
const MA_CHUNG = /(?<![\p{L}\d])\p{Lu}{1,6}\s?-\s?\d{1,6}(?!\d)/gu;

function boMaTin(cau, maBiet = []) {
  let s = String(cau ?? '').normalize('NFC');
  for (const ma of maBiet) if (ma) s = s.replace(new RegExp(`(?<![\\p{L}\\d])${escRe(ma.normalize('NFC'))}(?![\\p{L}\\d])`, 'giu'), ' ');
  return s.replace(MA_CHUNG, ' ');
}

// Tách câu thành các "từ" — giữ dấu . , : – bên trong số để còn đọc được 5.100.000, 7,5, 8:00, 18–35.
// Dấu câu đứng cuối từ thành một từ "," riêng, để "thứ hai, tư, sáu" không bị đọc liền thành một số.
function tach(cau) {
  return chuan(cau)
    // "phần trăm" viết thành % trước, để chữ "trăm" không bị đọc thành 100.
    .replace(/phần\s+trăm/gu, ' % ')
    // Chiều cao "1m58", "1m6" → 158 cm, 160 cm.
    .replace(/(?<![\p{L}\d])(\d)m(\d{1,2})(?![\p{L}\d])/gu, (_, a, b) => ` ${Number(a) * 100 + Number(b.padEnd(2, '0'))} cm `)
    .replace(/(\d)\s*(tr|k|h|đ|km|%|cm|kg)(?![\p{L}])/gu, '$1 $2 ')
    .replace(/[.,;:!?…]+(?=\s|$)/gu, ' , ')
    .split(/[\s"“”()/]+/u)
    .filter(Boolean);
}

// Một cụm chữ số viết tay: "5.100.000" → 5100000; "7,5" → 7.5; "5,100,000" → 5100000.
function docChuSo(t) {
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
  if (/^\d+[.,]\d+$/.test(t)) return Number(t.replace(',', '.'));
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

/**
 * Đọc một dãy từ số bằng chữ ("năm triệu một trăm nghìn", "hai mươi lăm", "hai lăm").
 * Trả về { giaTri, dung } với dung = số từ đã dùng, hoặc null nếu từ đầu không phải số.
 */
function docChu(tu, i) {
  let tong = 0; // phần đã chốt theo bậc nghìn/triệu/tỷ
  let nhom = 0; // phần dưới 1000 đang đọc
  let donVi = null; // chữ số vừa đọc, chờ xem có "mươi"/"trăm" theo sau không
  let j = i;
  let jDonVi = -1;
  let coSo = false;
  for (; j < tu.length; j++) {
    const t = tu[j];
    if (t in CHU_SO) {
      const v = CHU_SO[t];
      if (v === null) continue; // "linh", "lẻ": một trăm linh năm
      jDonVi = j;
      if (donVi !== null) {
        // "hai lăm" = 25: hai chữ số liền nhau sau "mươi" bị lược.
        if (nhom % 100 === 0 && donVi < 10 && !(t === 'không')) {
          nhom += donVi * 10 + v;
          donVi = null;
          coSo = true;
          continue;
        }
        break;
      }
      donVi = v;
      coSo = true;
    } else if (t === 'mươi' || t === 'mười') {
      if (t === 'mười') nhom += 10;
      else nhom += (donVi ?? 1) * 10;
      donVi = null;
      coSo = true;
    } else if (t === 'trăm') {
      nhom += (donVi ?? 1) * 100;
      donVi = null;
      coSo = true;
    } else if (t === 'nghìn' || t === 'ngàn' || t === 'triệu' || t === 'tỷ' || t === 'tỉ') {
      if (!coSo) break;
      nhom += donVi ?? 0;
      donVi = null;
      tong += (nhom || 1) * BAC[t];
      nhom = 0;
    } else if (t === 'rưỡi' && coSo) {
      // "bảy triệu rưỡi" = 7.500.000.
      nhom += donVi ?? 0;
      donVi = null;
      const bac = tong >= 1e9 ? 1e9 : tong >= 1e6 ? 1e6 : tong >= 1000 ? 1000 : 1;
      tong += nhom + bac / 2;
      nhom = 0;
      j++;
      break;
    } else break;
  }
  if (!coSo) return null;
  // "một triệu mốt" = 1.100.000, "5 triệu 1" = 5.100.000: chữ số lẻ sau bậc là phần mười của bậc đó.
  if (donVi !== null && nhom === 0 && tong >= 1000) {
    if (tu[jDonVi] !== 'mốt' && DANH_TU.has(tu[j])) return { giaTri: tong, dung: jDonVi - i };
    const bac = tong >= 1e9 ? 1e9 : tong >= 1e6 ? 1e6 : 1000;
    tong += donVi * (bac / 10);
    donVi = null;
  }
  return { giaTri: tong + nhom + (donVi ?? 0), dung: j - i };
}

const DON_VI = [
  [/^(đ|đồng|vnđ|vnd)$/, 'tien'],
  [/^(tuổi)$/, 'tuoi'],
  [/^(h|giờ|g)$/, 'gio'],
  [/^(km|cây|ki-lô-mét)$/, 'km'],
  [/^(%|phần)$/, 'phan_tram'],
  [/^(ngày)$/, 'ngay'],
  [/^(tháng)$/, 'thang'],
  [/^(ca)$/, 'ca'],
  [/^(người|công|bạn|thợ|chị|anh|lao)$/, 'nguoi'],
  [/^(tiếng)$/, 'tieng'],
  [/^(tuần)$/, 'tuan'],
  // Bán hàng (A.4 K3): số lượng hàng, số đo.
  [/^(chiếc|cái|bộ|món|đôi|set|sản|mẫu)$/, 'chiec'],
  [/^(cm|centimet|phân)$/, 'cm'],
  [/^(kg|kí|ký|ki|cân|kilo|kilogam)$/, 'kg'],
];

function loaiDonVi(t) {
  if (!t) return null;
  for (const [re, ten] of DON_VI) if (re.test(t)) return ten;
  return null;
}

/**
 * Lấy mọi con số trong câu. Mỗi số: { giaTri, donVi, chu }.
 * Khoảng "18–35 tuổi" cho hai số, cả hai mang đơn vị "tuoi".
 * @param {{boMa?: string[]}} o  các mã tin đã biết, bỏ đi trước khi đọc số.
 */
function laySo(cau, { boMa = [] } = {}) {
  const tu = tach(boMaTin(cau, boMa));
  const ra = [];
  const them = (giaTri, donVi, iDau, iCuoi, bac = null) => ra.push({ giaTri, donVi, chu: tu.slice(iDau, iCuoi + 1).join(' '), iDau, iCuoi, bac });
  for (let i = 0; i < tu.length; i++) {
    const t = tu[i];
    let giaTri = null;
    let dung = 1;
    let bacDung = null;
    // "18–35", "7-9" (kèm bậc: "7-9tr"): khoảng.
    const khoang = t.match(/^(\d+(?:[.,]\d+)?)[–-](\d+(?:[.,]\d+)?)$/);
    if (khoang) {
      const a = docChuSo(khoang[1]);
      const b = docChuSo(khoang[2]);
      const bac = BAC_SAU_SO[tu[i + 1]];
      if (bac) {
        them(a * bac, 'tien', i, i + 1, bac);
        them(b * bac, 'tien', i, i + 1, bac);
        i += 1;
      } else {
        const dv = loaiDonVi(tu[i + 1]);
        them(a, dv, i, i);
        them(b, dv, i, i);
      }
      continue;
    }
    const gio = t.match(/^(\d{1,2}):(\d{2})$/);
    if (gio) {
      them(Number(gio[1]) + Number(gio[2]) / 60, 'gio', i, i);
      continue;
    }
    const cs = docChuSo(t);
    if (cs !== null) {
      giaTri = cs;
      // "5 triệu 1", "7tr5", "5,1 triệu", "300k"
      const sau = tu[i + 1];
      const bac = BAC_SAU_SO[sau];
      if (bac) {
        bacDung = bac;
        giaTri = cs * bac;
        dung = 2;
        const le = tu[i + 2];
        const leSo = le !== undefined ? docChuSo(le) : null;
        if (leSo !== null && Number.isInteger(leSo) && !DANH_TU.has(tu[i + 3])) {
          // "7 triệu 500" = 7.500.000; "5 triệu 1" = 5.100.000; "7tr5" = 7.500.000
          const doDai = String(leSo).length;
          giaTri += leSo * (bac / 10 ** Math.max(doDai, 1));
          dung = 3;
        } else if (le === 'rưỡi') {
          giaTri += bac / 2;
          dung = 3;
        } else if (le !== undefined && (le in CHU_SO || le === 'trăm')) {
          const c = docChu(tu, i + 2);
          const sauLe = c ? tu[i + 2 + c.dung] : undefined;
          if (c && !(le !== 'mốt' && c.dung === 1 && DANH_TU.has(sauLe))) {
            const bacNho = bac / 1000;
            giaTri += c.giaTri >= 100 || tu[i + 3] === 'trăm' || tu[i + 3] === 'nghìn'
              ? c.giaTri * (tu.slice(i + 2, i + 2 + c.dung).includes('nghìn') ? 1 : bacNho)
              : c.giaTri * (bac / 10);
            dung = 2 + c.dung;
          }
        }
      }
    } else if ((t in CHU_SO && t !== 'không') || t === 'mười' || t === 'mươi' || t === 'trăm') {
      // "không" đứng đầu hầu như luôn là "không/chưa", không phải số 0.
      const c = docChu(tu, i);
      if (c) {
        giaTri = c.giaTri;
        dung = c.dung;
        const cacTu = tu.slice(i, i + dung);
        if (cacTu.includes('tỷ') || cacTu.includes('tỉ')) bacDung = 1e9;
        else if (cacTu.includes('triệu')) bacDung = 1e6;
        else if (cacTu.includes('nghìn') || cacTu.includes('ngàn')) bacDung = 1000;
      }
    }
    if (giaTri === null) continue;
    let dv = loaiDonVi(tu[i + dung]);
    if (giaTri >= 1000 && dv === null) dv = 'tien';
    them(giaTri, dv, i, i + dung - 1, bacDung);
    i += dung - 1;
  }
  // "18 đến 35 tuổi", "mười tám tới ba mươi lăm tuổi": số đầu mượn đơn vị của số sau;
  // "5 - 7 triệu": số đầu mượn cả bậc (là 5 triệu, không phải 5).
  for (let k = 0; k < ra.length - 1; k++) {
    const a = ra[k];
    const b = ra[k + 1];
    const giua = tu.slice(a.iCuoi + 1, b.iDau);
    if (a.donVi !== null || b.donVi === null || giua.length !== 1 || !NOI_KHOANG.has(giua[0])) continue;
    if (b.bac && a.giaTri < b.bac) a.giaTri *= b.bac;
    a.donVi = b.donVi;
  }
  return ra.map(({ giaTri, donVi, chu }) => ({ giaTri, donVi, chu }));
}

/**
 * Số được miễn K3: số không đơn vị từ 0 đến 10 ("2 bước", "thứ 2, 4, 6"), và "một tháng/ngày/tuần"
 * trong "5 triệu một tháng" (nghĩa là "mỗi tháng").
 */
function mienK3(s) {
  // "199k một cái" = mỗi cái: "một cái" cũng được miễn như "một tháng".
  return (s.donVi === null && s.giaTri >= 0 && s.giaTri <= 10) || (s.giaTri === 1 && ['thang', 'ngay', 'tuan', 'chiec'].includes(s.donVi));
}

/**
 * K3: các con số trong câu không có trong nguồn (sau quy đổi). Rỗng = đạt.
 * Số phải có đúng trong nguồn, không suy ra từ khoảng: "tuổi 20" với nguồn "18–35 tuổi" là sai (A.4).
 */
function soKhongCoTrongNguon(cau, nguon, { boMa = [] } = {}) {
  const coSan = nguon.flatMap((n) => laySo(n, { boMa }).map((s) => s.giaTri));
  return laySo(cau, { boMa }).filter((s) => !mienK3(s) && !coSan.some((v) => Math.abs(v - s.giaTri) < 1e-6));
}

module.exports = { laySo, soKhongCoTrongNguon, mienK3, boMaTin, chuan };
