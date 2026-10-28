'use strict';

/**
 * Nhận ra bình luận chốt đơn bằng mã (SPEC.md F-53, không gọi AI — nhanh, rẻ): "chốt 12 đen M", "chot 12 den m",
 * "c12 đen M x2", "lấy áo 12 màu đen size M", "12 trắng L 2 cái", nhiều món một bình luận ("chốt 12 đen M, 7 be S").
 *
 *  - Có chữ báo mua ("chốt", "lấy", "đặt", "mua", "ck", "c" dính số đứng đầu) hoặc đúng dạng "số + phân loại".
 *  - Tìm số sản phẩm, giá trị phân loại (so không dấu, không phân biệt hoa thường, bảng tên gọi khác ở
 *    `cau-hinh/ten-goi-khac.json`), số lượng ("x2", "2 cái", "2c"; rau củ bán theo kg: "2kg", "2 cân" = 2 gói 1 kg). Thiếu số sản phẩm → món của đoạn đang nói.
 *    Sản phẩm chỉ một phân loại → "chốt 12" là đủ.
 *  - Câu hỏi về việc chốt ("chốt rồi chưa shop?", "chốt sao ạ") không phải chốt.
 * Trả phiếu từng món: đủ phân loại hay còn thiếu gì. `chac_chan` = là chốt và mọi món đã rõ phân loại.
 * Câu có chữ báo mua mà không khớp rõ → nơi gọi đưa model rẻ đọc hộ (#77) hoặc nhắn hỏi lại khách.
 */

const { boDau } = require('./nghiep-vu/chung');
const TEN_GOI = require('./cau-hinh/ten-goi-khac.json');

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const coTu = (s, tu) => new RegExp(`(?<![a-z0-9])${esc(tu)}(?![a-z0-9])`).test(s);

// Chữ báo mua. "c12", "c 12" chỉ tính khi đứng đầu bình luận.
const BAO_MUA = /(?<![a-z0-9])(chot|chôt|lay|dat hang|dat|mua|order|ck)(?![a-z0-9])/;
const C_DAU = /^\s*c\s*(\d{1,5})(?!\d)/;
// Câu hỏi về việc chốt / hỏi giá chứ không phải chốt.
const HOI = /(roi chua|chua shop|chua a\b|duoc chua|duoc khong|duoc ko|dc ko|dc khong|chot sao|chot the nao|chot nhu nao|lam sao|bao nhieu|bn\b|khi nao|nhu nao|the nao|co khong|con khong|con ko|khong a|ko a|hay khong|sao a|con may|may cai|may chiec)/;

/** Chuẩn hóa: bỏ dấu, chữ thường, tách "x2", "2c", "12den" ra thành từ riêng. */
function chuanHoa(noiDung) {
  return ` ${boDau(noiDung)
    .replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2')
    // Giữ dấu ngăn món (",", ";", "+", xuống dòng) thành một từ "," riêng để tachMon còn tách được.
    .replace(/[,;+\n]+/g, ' , ')
    .replace(/[^a-z0-9?,]+/g, ' ')
    .replace(/\s+/g, ' ').trim()} `;
}

/** Giá trị chuẩn của một phân loại để so: bỏ dấu, gộp khoảng trắng. */
const khoa = (s) => boDau(s ?? '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Tìm các giá trị (của một nhóm phân loại) được nhắc trong đoạn chữ, kể cả qua bảng tên gọi khác.
 * Trả danh sách giá trị gốc (đúng chữ của sản phẩm), dài trước ngắn sau, không chồng nhau.
 */
function timGiaTri(s, cacGiaTri, bang) {
  const thay = new Map(); // cách gõ → giá trị gốc
  for (const g of cacGiaTri) thay.set(khoa(g), g);
  for (const [goTat, chuanK] of Object.entries(bang || {})) {
    const g = cacGiaTri.find((x) => khoa(x) === chuanK);
    if (g && !thay.has(goTat)) thay.set(goTat, g);
  }
  const ds = [];
  let conLai = s;
  for (const k of [...thay.keys()].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![a-z0-9])${esc(k)}(?![a-z0-9])`);
    if (re.test(conLai)) {
      ds.push(thay.get(k));
      conLai = conLai.replace(re, ' ');
    }
  }
  return { ds: [...new Set(ds)], conLai };
}

/** Số lượng trong một đoạn: "x2", "2 cai", "2 c", "2 chiec", "sl 2". Mặc định 1. */
function soLuong(s, boSo = []) {
  let m = /(?<![a-z0-9])x\s?(\d{1,2})(?!\d)/.exec(s) || /(?<![a-z0-9])(?:sl|so luong)\s?(\d{1,2})(?!\d)/.exec(s)
    || /(?<![a-z0-9])(\d{1,2})\s?(?:cai|c|chiec|bo|sp|san pham|mon|kg|can|ky|ki|kilo|ki lo)(?![a-z0-9])/.exec(s);
  if (m && !boSo.includes(Number(m[1]))) return Number(m[1]);
  // "chốt 2 áo 12 trắng M": số đứng trước tên loại hàng là số lượng (số sản phẩm đã bỏ khỏi đoạn trước khi gọi).
  m = /(?<![a-z0-9])(\d{1,2})\s(?:ao|quan|vay|dam|set|doi)(?![a-z0-9])/.exec(s);
  if (m && !boSo.includes(Number(m[1]))) return Number(m[1]);
  m = /(?<![a-z0-9])(?:lay|chot)\s(\d{1,2})\s(?:cai|chiec|bo)(?![a-z0-9])/.exec(s);
  return m ? Number(m[1]) : 1;
}

/**
 * Tách bình luận thành đoạn từng món: dấu phẩy, chấm phẩy, "+", "và", xuống dòng; hoặc gặp một số sản phẩm mới.
 * @param {string} s  chữ đã chuẩn hóa
 * @param {Set<number>} soCo  các số sản phẩm có thật
 */
function tachMon(sGoc, soCo) {
  const phan = sGoc.split(/ (?:va|voi|them|\+) |[,;\n]/).map((x) => ` ${x.trim()} `).filter((x) => x.trim());
  const ra = [];
  for (const p of phan) {
    // "12 đen M 7 be S": tách ở mỗi số sản phẩm có thật đứng sau một phân loại.
    const tu = p.trim().split(' ');
    let hien = [];
    for (let i = 0; i < tu.length; i++) {
      const n = /^\d{1,5}$/.test(tu[i]) ? Number(tu[i]) : null;
      const laSoSp = n != null && soCo.has(n) && !/^(x|sl)$/.test(tu[i - 1] || '') && !/^(cai|c|chiec|bo|sp)$/.test(tu[i + 1] || '')
        && !(/^(ao|quan|vay|dam|set|doi)$/.test(tu[i + 1] || '') && /^\d/.test(tu[i + 2] === 'so' ? tu[i + 3] || '' : tu[i + 2] || ''));
      // Chỉ tách khi đoạn đang gom đã có một số sản phẩm ("12 đen M 7 be S"); chữ đệm trước số ("shop ơi chốt 12…",
      // "order 12…", "chốt M đen 12") không đẻ thêm món.
      const daCoSp = hien.some((x) => /^\d{1,5}$/.test(x) && soCo.has(Number(x)));
      if (laSoSp && daCoSp && hien.some((x) => !/^\d+$/.test(x) && !/^(chot|lay|dat|mua|ck|c|ao|quan|so|mau|sp|vay|dam|cai|chiec|bo|x|sl|them)$/.test(x))) {
        ra.push(` ${hien.join(' ')} `);
        hien = [];
      }
      hien.push(tu[i]);
    }
    if (hien.length) ra.push(` ${hien.join(' ')} `);
  }
  return ra;
}

/**
 * Tìm món (số, màu, size, số lượng) trong câu đã chuẩn hóa — phần dùng chung của docChot và câu hỏi có ý mua (F-71).
 * @returns {object[]} mon
 */
function timMon(s, { dsSanPham, soDangNoi = null, coBaoMua = false, cDau = null }) {
  const soCo = new Set(dsSanPham.map((x) => x.so));
  const mon = [];
  let soTruoc = null; // "chốt 12 đen M, trắng L": đoạn sau không ghi số thì cùng món với đoạn trước
  const chuCua = new WeakMap(); // món → chữ của đoạn (để ghép đoạn nối tiếp)
  const cacDoan = tachMon(cDau ? s.replace(/^\s*c\s*(\d)/, ' chot $1') : s, soCo);
  for (const doan of cacDoan) {
    // Số sản phẩm: số có thật đầu tiên không phải số lượng.
    const cacSo = [...doan.matchAll(/(?<![a-z0-9])(\d{1,5})(?!\d)/g)].map((m) => ({ n: Number(m[1]), i: m.index }));
    const laSoLuong = (x) => /(?:x|sl)\s?$/.test(doan.slice(0, x.i)) || /^\s?(cai|c|chiec|bo|sp|kg|can|ky|ki|kilo)(?![a-z0-9])/.test(doan.slice(x.i + String(x.n).length))
      || /^\s(ao|quan|vay|dam|set|doi)\s(so\s)?\d/.test(doan.slice(x.i + String(x.n).length)); // "2 áo 12"
    const soSp = cacSo.find((x) => soCo.has(x.n) && !laSoLuong(x))?.n ?? null;
    // Số gọi rõ mà không có sản phẩm nào ("chốt 99 đen M") thì không đoán sang món đang nói — trừ khi đó là số cỡ của món
    // đang nói (quần size 30).
    const dangNoi = dsSanPham.find((x) => x.so === soDangNoi);
    const cacCo = new Set((dangNoi?.phan_loai || []).map((p) => khoa(p.gt2)).concat((dangNoi?.phan_loai || []).map((p) => khoa(p.gt1))));
    const soLa = soSp == null ? cacSo.find((x) => !laSoLuong(x) && !cacCo.has(String(x.n)))?.n : null;
    if (soLa != null) {
      mon.push({ so: soLa, san_pham: null, phan_loai: null, so_luong: soLuong(doan), thieu: ['so_khong_co'], ly_do: `Không có sản phẩm số ${soLa}.` });
      continue;
    }
    const sp = dsSanPham.find((x) => x.so === (soSp ?? soTruoc ?? soDangNoi)) || null;
    if (!sp) {
      if (soSp == null && !coBaoMua) continue;
      mon.push({ so: soSp, san_pham: null, phan_loai: null, so_luong: soLuong(doan), thieu: ['so'], ly_do: 'Không rõ sản phẩm số mấy.' });
      continue;
    }
    // Chữ của đoạn bỏ số sản phẩm, số lượng — để số cỡ (38, 39…) không lẫn với số sản phẩm.
    let chu = doan;
    if (soSp != null) chu = chu.replace(new RegExp(`(?<![a-z0-9])${soSp}(?!\\d)`), ' ');
    // "chốt 12 trắng, size L": đoạn không số nối tiếp món trước còn thiếu phân loại → ghép lại thành một món.
    const truoc = mon.at(-1);
    if (soSp == null && truoc?.san_pham?.so === sp.so && truoc.thieu.some((k) => k === 'gt1' || k === 'gt2')) {
      chu = `${chuCua.get(truoc)} ${chu}`;
      mon.pop();
    }
    const pl = sp.phan_loai.filter((p) => !p.bo);
    const g1 = [...new Set(pl.map((p) => p.gt1))];
    const g2 = [...new Set(pl.map((p) => p.gt2).filter(Boolean))];
    const t1 = timGiaTri(chu, g1, TEN_GOI.mau);
    const t2 = timGiaTri(t1.conLai, g2, TEN_GOI.co);
    // Cỡ gõ kiểu "size m" đã có trong bảng; thêm trường hợp khách gõ cỡ trước màu ("M đen").
    const chon = pl.filter((p) => (!t1.ds.length || t1.ds.includes(p.gt1)) && (!t2.ds.length || t2.ds.includes(p.gt2)));
    // Đoạn chỉ có chữ đệm ("…, nha shop") sau một món: không phải món mới.
    if (soSp == null && mon.length && !t1.ds.length && !t2.ds.length) continue;
    soTruoc = sp.so;
    const thieu = [];
    if (g1.length > 1 && !t1.ds.length) thieu.push('gt1');
    if (sp.nhom.t2 && g2.length > 1 && !t2.ds.length) thieu.push('gt2');
    const x = { so: sp.so, san_pham: sp, so_luong: soLuong(chu, [sp.so]), gt1: t1.ds[0] || null, gt2: t2.ds[0] || null, thieu };
    if (!thieu.length && chon.length === 1) {
      x.phan_loai = chon[0];
      x.ly_do = 'Đủ thông tin.';
    } else if (!thieu.length && !chon.length) {
      x.phan_loai = null;
      x.thieu = ['khong_co'];
      x.ly_do = 'Phân loại khách chọn không có ở sản phẩm này.';
    } else {
      x.phan_loai = null;
      x.ly_do = `Thiếu ${thieu.map((k) => (k === 'gt1' ? sp.nhom.t1 : sp.nhom.t2)).join(', ') || 'phân loại rõ ràng'}.`;
    }
    // Có chữ "lạ" trông như màu mà không khớp (ví dụ "tím than" khi không có) → không chắc.
    chuCua.set(x, chu);
    mon.push(x);
  }

  return mon;
}

/**
 * @param {string} noiDung  bình luận
 * @param {object} o
 * @param {{id:string, so:number, ten:string, nhom:{t1:string,t2:string|null}, phan_loai:{id:string, gt1:string, gt2:string|null, bo:boolean}[]}[]} o.dsSanPham
 *        sản phẩm để so (thường: mọi sản phẩm, kể cả Nháp / Ngừng bán — để báo "đã ngừng bán")
 * @param {number|null} [o.soDangNoi]  số sản phẩm của đoạn đang nói (lùi theo độ trễ phát)
 * @returns {{la_chot:boolean, chac_chan:boolean, mon:object[], ly_do:string}}
 */
function docChot(noiDung, { dsSanPham, soDangNoi = null }) {
  const s = chuanHoa(noiDung);
  const soCo = new Set(dsSanPham.map((x) => x.so));
  const coBaoMua = BAO_MUA.test(s) || C_DAU.test(s);
  // "áo 12 còn đen M không", "12 đen M còn ko": câu kết bằng chữ hỏi mà không có chữ mua rõ là câu hỏi.
  const muaRo = /(?<![a-z0-9])(chot|lay|dat|mua|order)(?![a-z0-9])/.test(s) || C_DAU.test(s);
  const cuoiHoi = /(?<![a-z0-9])(khong|ko|k|hong|hok|khum|chua|nhi|ha)( (a|shop|s|vay|nhe|nha|ban|chi|em))?\s*$/.test(s);
  const laHoi = s.includes('?') || HOI.test(s) || (cuoiHoi && !muaRo);
  const cDau = C_DAU.exec(s);
  const coSo = [...s.matchAll(/(?<![a-z0-9])(\d{1,5})(?!\d)/g)].some((m) => soCo.has(Number(m[1])));

  if (laHoi && !(coBaoMua && coSo && !s.includes('?'))) {
    // F-71: "12 đen M còn ko shop" — câu hỏi mà ghi đủ số, màu, size (một món) → câu hỏi có ý mua (thẻ mời, không tự giữ).
    const m = coSo ? timMon(s, { dsSanPham, soDangNoi: null, coBaoMua: false, cDau: null }) : [];
    if (m.length === 1 && m[0].phan_loai && m[0].san_pham && (m[0].gt1 || m[0].gt2)) {
      return { la_chot: false, chac_chan: false, la_hoi_mua: true, mon: m, ly_do: 'Câu hỏi có ý mua, ghi đủ số và phân loại.' };
    }
    return { la_chot: false, chac_chan: false, mon: [], ly_do: 'Câu hỏi, không phải chốt.' };
  }

  const mon = timMon(s, { dsSanPham, soDangNoi, coBaoMua, cDau });

  // Không có chữ báo mua: chỉ tính là chốt khi đúng dạng "số + phân loại đủ" (ví dụ "12 đen M").
  const laChot = coBaoMua ? mon.length > 0 : mon.length > 0 && mon.every((x) => x.phan_loai && (x.gt1 || x.gt2));
  if (!laChot) return { la_chot: false, chac_chan: false, mon: [], ly_do: 'Không thấy dấu hiệu chốt.' };
  const chacChan = mon.every((x) => x.phan_loai);
  return { la_chot: true, chac_chan: chacChan, mon, ly_do: chacChan ? 'Chốt rõ ràng.' : mon.map((x) => x.ly_do).join(' ') };
}

/**
 * Tin của khách có phải lời xin sửa đơn thật không (#79: AI chỉ sửa món theo lời khách, không theo câu hỏi).
 * viec 'tao' | 'them' → khách xin mua / thêm / đồng ý; 'bot' | 'doi_phan_loai' → khách xin bớt / bỏ / đổi / đồng ý.
 * Câu hỏi ("còn size M không?", "giá bao nhiêu") không tính, trừ khi có chữ mua rõ ("lấy luôn", "chốt").
 */
function laLoiXinSua(noiDung, viec) {
  const s = chuanHoa(noiDung);
  const mua = BAO_MUA.test(s) || C_DAU.test(s) || /(?<![a-z0-9])(them|order|oder|lay luon|cho (em|minh|chi|toi|to|anh) (1|2|3|mot|hai|ba|them|lay|xin))(?![a-z0-9])/.test(s);
  const dongY = /(?<![a-z0-9])(ok|oke|okie|okela|dong y|duoc|dc|vang|uh|u|um|chuan|dung roi|chot luon|yes)(?![a-z0-9])/.test(s);
  const sua = /(?<![a-z0-9])(doi|bot|bo|thoi|khong lay|ko lay|k lay|huy|giam|sua|thay)(?![a-z0-9])/.test(s);
  const hoi = s.includes('?') || HOI.test(s);
  if (viec === 'bot' || viec === 'doi_phan_loai') return sua || dongY;
  return (mua && !(hoi && !/(?<![a-z0-9])(chot|lay luon|them|mua)(?![a-z0-9])/.test(s))) || (dongY && !hoi);
}

module.exports = { docChot, timMon, chuanHoa, laLoiXinSua };
