'use strict';

/**
 * Nhạc của Đội AI dẫn (SPEC.md bản 2.9, #51, F-47): nhạc hiệu (có lời), nhạc chuyển cảnh, nhạc đố vui, tiếng chúc mừng.
 *
 * Lyria 3.5 trả một bài MP3 dài 1–3 phút, 44,1 kHz stereo (xin 15 giây vẫn ra 60 giây; chưa trả được WAV — thử
 * 24/9/2026) → giải mã bằng mpg123-decoder (thư viện nhỏ, WebAssembly, không cần cài gì vào Windows) → MOZA cắt phần
 * dùng: nhạc hiệu theo mốc giờ lời hát Lyria trả kèm, nhạc không lời từ chỗ nhạc bắt đầu to. Rồi đưa về 24 kHz một kênh
 * (cùng đường tiếng với giọng đội), chỉnh độ to thấp hơn giọng nói một chút, vào ra êm. Lưu data/doi-ai/nhac/<loai>.wav,
 * thông tin ở cai_dat.doi_ai.nhac.
 * Bản 2.10 (#54, F-49, F-50): nhạc hiệu Radio; bài hát Radio 1–2 phút (tên bài + kiểu nhạc → Lyria viết lời và hát),
 * lưu data/doi-ai/bai-hat/<id>.wav, thông tin ở cai_dat.doi_ai.bai_hat.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tts = require('../agent/nha-cung-cap/tts');
const doiAi = require('../nghiep-vu/doi-ai');
const caiDat = require('../nghiep-vu/cai-dat');
const chiPhi = require('../nghiep-vu/chi-phi');
const nhatKy = require('../nghiep-vu/nhat-ky');
const { LoiNghiepVu, gio } = require('../nghiep-vu/chung');
const { thuMuc } = require('./phong-thu');

const TAN_SO = 24000;
const GIA_MOT_BAI_USD = 0.08; // bảng giá Google cho lyria-3.5, tra 24/9/2026
const DO_TO = 0.1; // giọng đội đo được khoảng 0,14 (buổi tập 24/9/2026): nhạc nhỏ hơn chừng 3 dB
const DINH = 0.89;
const VAO_EM_S = 0.2;

const KHONG_LOI = 'Instrumental only, no vocals. Không lời, không giọng hát.';

/**
 * Các loại nhạc: tên, khi nào phát, dài bao nhiêu giây, ra êm bao lâu, lời tả mặc định gửi Lyria (sửa được ở Cài đặt).
 * Nhạc hiệu cắt theo lời hát (tối đa `toiDa` giây); loại khác lấy `giay` giây từ chỗ nhạc bắt đầu to.
 */
const LOAI = {
  hieu: {
    ten: 'Nhạc hiệu', khi: 'Mở màn và đầu mỗi vòng mới', toiDa: 16, ra: 2,
    // {ten_shop} được thay bằng tên shop trong Cài đặt khi làm nhạc (#74).
    moTa: 'Nhạc hiệu (jingle) cho buổi livestream bán quần áo của shop "{ten_shop}": pop sôi động, vui tươi, 124 BPM, trống điện tử, '
      + 'synth sáng, tiếng vỗ tay. Một giọng ca nữ trẻ hát tiếng Việt thật rõ lời. Mở đầu chỉ 2 giây rồi vào hát ngay. '
      + 'Lời: "{ten_shop} ơi, đồ xinh mỗi ngày! Mặc đẹp tự tin, vào live ngay!"',
  },
  chuyen: {
    ten: 'Nhạc chuyển cảnh', khi: 'Trước mỗi đoạn mới (sang sản phẩm khác, sang giao lưu)', giay: 3.5, ra: 1.0,
    moTa: `Nhạc chuyển cảnh cho livestream bán hàng: tiếng "whoosh" lướt nhanh rồi hợp âm synth sáng, dứt khoát, năng lượng cao, 128 BPM. ${KHONG_LOI}`,
  },
  do_vui: {
    ten: 'Nhạc đố vui', khi: 'Lúc chờ người xem bình luận đáp án', giay: 30, ra: 1.5,
    moTa: `Nhạc chờ đố vui kiểu gameshow truyền hình: tiếng đồng hồ tích tắc, pizzicato dây vui nhộn, bass nhẹ, hồi hộp mà vui, 110 BPM, đều nhịp suốt bài. ${KHONG_LOI}`,
  },
  dung: {
    ten: 'Tiếng chúc mừng', khi: 'Trước câu chúc mừng người trả lời đúng', giay: 2.5, ra: 0.8,
    // Lời tả đầu tiên ("chuông ting ting, kèn fanfare") ra còi tàu và trống trap (thử 24/9/2026): nói rõ mở đầu ngay bằng kèn.
    moTa: 'Nhạc chúc mừng chiến thắng kiểu gameshow truyền hình. Mở đầu ngay giây đầu tiên bằng tiếng kèn đồng (trumpet) thổi '
      + 'fanfare "ta-da" rực rỡ, chuông glockenspiel lấp lánh, tiếng vỗ tay và reo hò vui mừng. Tươi sáng, hân hoan. '
      + `Không trống trap, không còi. ${KHONG_LOI}`,
  },
  // Radio {ten_shop} (#74, F-49): kịch bản Radio dùng nhạc hiệu này; chưa có thì dùng nhạc hiệu thường.
  hieu_radio: {
    ten: 'Nhạc hiệu Radio', khi: 'Mở màn và đầu mỗi vòng mới của kịch bản Radio {ten_shop}', toiDa: 16, ra: 2,
    // Lời tả đầu (nhóm hát hòa giọng) ra đoạn 4 giây, AI nghe lại thành "Radio Nguyễn Lập Ngân" (thử 24/9/2026):
    // một giọng ca, hát chậm, rõ từng chữ, không câu đệm.
    moTa: 'Nhạc hiệu (station ID jingle) của một đài phát thanh Việt Nam tên "Radio {ten_shop}": pop tươi sáng, ấm áp, '
      + '110 BPM, guitar điện sạch, piano, bass tròn, trống nhẹ. Một giọng ca nữ trẻ hát tiếng Việt chậm, rõ từng chữ, không hát đệm, '
      + 'không câu phụ. Mở đầu chỉ 2 giây rồi vào hát ngay. Lời: "Radio {ten_shop}! Mặc đẹp mỗi ngày, sống vui mỗi ngày!"',
  },
};

/* ---------------- bài hát Radio (bản 2.10, #54, F-50) ---------------- */

// Kiểu nhạc: người dùng chọn từ danh sách (#31: chọn thay vì gõ); phần tả gửi Lyria.
const KIEU_BAI = {
  pop: { ten: 'Pop sôi động', ta: 'nhạc pop Việt sôi động, tươi sáng, 120 BPM, trống điện tử, synth, guitar điện, giọng ca nữ trẻ trong trẻo' },
  ballad: { ten: 'Ballad nhẹ nhàng', ta: 'ballad Việt nhẹ nhàng, sâu lắng, 72 BPM, piano, dàn dây, giọng ca nam trẻ ấm áp' },
  acoustic: { ten: 'Acoustic mộc mạc', ta: 'acoustic mộc mạc, gần gũi, 96 BPM, guitar thùng, cajon, tiếng huýt sáo nhẹ, giọng ca nữ trẻ mộc' },
  tru_tinh: { ten: 'Trữ tình quê hương', ta: 'nhạc trữ tình quê hương Việt Nam, 80 BPM, đàn bầu, sáo trúc, guitar, giọng ca nam trầm ấm' },
};
// Bài gợi ý (#74, F-50): về thời trang và cuộc sống, không tên thương hiệu, không quảng cáo.
const GOI_Y_BAI = [
  { ten: 'Cuối tuần dạo phố', kieu: 'pop' },
  { ten: 'Ngày mới rạng rỡ', kieu: 'acoustic' },
  { ten: 'Gửi mẹ chiếc áo mới', kieu: 'ballad' },
  { ten: 'Tự tin là chính mình', kieu: 'pop' },
  { ten: 'Mùa thu áo mới', kieu: 'tru_tinh' },
];
const BAI_TOI_DA_S = 120; // chủ dự án 24/9/2026: "mỗi bài 1–2 phút"
const BAI_KET_SOM_S = 80; // bài dài quá 2 phút: kết ở chỗ sang đoạn nhạc mới từ giây này
const BAI_RA_S = 5;
const DO_TO_BAI = 0.11; // bài hát là tiết mục chính của góc Lời nhắn gửi: to hơn nhạc chen một chút, vẫn nhỏ hơn giọng đội

/** Lời tả gửi Lyria cho một bài (tài liệu Lyria 3.5 tra 24/9/2026: độ dài và bố cục dặn bằng lời, dùng [Verse], [Chorus]…). */
function moTaBai(ten, kieu) {
  const k = KIEU_BAI[kieu] || KIEU_BAI.pop;
  return `Một bài hát tiếng Việt hoàn chỉnh tên "${ten}", ${k.ta}. Dài khoảng 1 phút 45 giây, có kết bài rõ ràng. `
    + 'Bố cục: [Intro] ngắn 5 giây, [Verse], [Chorus], [Verse], [Chorus], [Outro]. '
    + `Lời hát tiếng Việt tự viết, hát thật rõ lời, theo tên bài "${ten}": thời trang và cuộc sống thường ngày — mặc đẹp đi chơi, `
    + 'tự tin là chính mình, quà tặng người thân, niềm vui cuối tuần. Lời trong sáng, tích cực, ấm áp. '
    + 'Không nhắc tên shop, nhãn hàng, không quảng cáo, không hứa hẹn giảm giá hay quà tặng.';
}

const tepBai = (id) => path.join(thuMuc('bai-hat'), `${String(id).replace(/[^a-z0-9]/g, '')}.wav`);

const tepNhac = (loai) => path.join(thuMuc('nhac'), `${loai}.wav`);

function canLoai(loai) {
  if (!Object.hasOwn(LOAI, loai)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có loại nhạc "${loai}".`);
}

/* ---------------- xử lý tiếng ---------------- */

/** Đọc WAV (PCM 8/16/24/32-bit hoặc số thực 32-bit, mấy kênh cũng được) → một kênh số thực -1..1. */
function docWav(buf) {
  if (buf.subarray(0, 4).toString('latin1') !== 'RIFF' || buf.subarray(8, 12).toString('latin1') !== 'WAVE') {
    throw new Error('Không phải tệp WAV.');
  }
  let fmt = null;
  let data = null;
  for (let o = 12; o + 8 <= buf.length;) {
    const id = buf.subarray(o, o + 4).toString('latin1');
    let n = buf.readUInt32LE(o + 4);
    if (id === 'fmt ') {
      fmt = { dang: buf.readUInt16LE(o + 8), kenh: buf.readUInt16LE(o + 10), tanSo: buf.readUInt32LE(o + 12), bit: buf.readUInt16LE(o + 22) };
      if (fmt.dang === 0xfffe && n >= 40) fmt.dang = buf.readUInt16LE(o + 8 + 24); // WAVE_FORMAT_EXTENSIBLE: kiểu thật ở phần mở rộng
    }
    if (id === 'data') {
      if (!n || o + 8 + n > buf.length) n = buf.length - o - 8; // tệp không ghi đúng độ dài
      data = buf.subarray(o + 8, o + 8 + n);
      break;
    }
    o += 8 + n + (n % 2);
  }
  if (!fmt || !data) throw new Error('Tệp WAV thiếu phần định dạng hoặc dữ liệu.');
  const { kenh, bit } = fmt;
  const b = bit / 8;
  if (![1, 3].includes(fmt.dang) || !kenh || ![8, 16, 24, 32].includes(bit) || (fmt.dang === 3 && bit !== 32)) {
    throw new Error(`Tệp WAV kiểu lạ (định dạng ${fmt.dang}, ${bit} bit).`);
  }
  const doc = fmt.dang === 3 ? (o) => data.readFloatLE(o)
    : bit === 16 ? (o) => data.readInt16LE(o) / 32768
      : bit === 24 ? (o) => data.readIntLE(o, 3) / 8388608
        : bit === 32 ? (o) => data.readInt32LE(o) / 2147483648
          : (o) => (data[o] - 128) / 128;
  const n = Math.floor(data.length / (b * kenh));
  const mau = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    let s = 0;
    for (let k = 0; k < kenh; k += 1) s += doc((i * kenh + k) * b);
    mau[i] = s / kenh;
  }
  return { mau, tanSo: fmt.tanSo };
}

/**
 * Giải mã tệp nhạc Google trả: WAV đọc thẳng, MP3 giải mã bằng mpg123-decoder → một kênh số thực -1..1.
 * @returns {Promise<{mau:Float32Array, tanSo:number}>}
 */
async function giaiMa(tep) {
  if (tep.subarray(0, 4).toString('latin1') === 'RIFF') return docWav(tep);
  const { MPEGDecoder } = require('mpg123-decoder');
  const d = new MPEGDecoder();
  await d.ready;
  try {
    const { channelData, samplesDecoded, sampleRate } = d.decode(new Uint8Array(tep.buffer, tep.byteOffset, tep.length));
    if (!samplesDecoded || !channelData.length) throw new Error('Không giải mã được tệp nhạc (không phải MP3 hay WAV).');
    const mau = new Float32Array(samplesDecoded);
    for (const k of channelData) for (let i = 0; i < samplesDecoded; i += 1) mau[i] += k[i] / channelData.length;
    return { mau, tanSo: sampleRate };
  } finally {
    d.free();
  }
}

// Bộ lọc nội suy sinc có cửa sổ Hann, 2R hệ số; tính sẵn cho PHA vị trí lẻ giữa hai mẫu (sai lệch 1/1024 mẫu, không nghe
// ra) — nhanh hơn chừng 10 lần so với tính hàm sin từng mẫu.
const R_LOC = 16;
const PHA = 1024;
const bangLoc = new Map();
function heSoLoc(cat) {
  let b = bangLoc.get(cat);
  if (b) return b;
  const w = 2 * R_LOC;
  b = new Float32Array((PHA + 1) * w);
  for (let p = 0; p <= PHA; p += 1) {
    let tong = 0;
    for (let j = 0; j < w; j += 1) {
      const d = p / PHA + (R_LOC - 1) - j; // khoảng cách từ điểm cần tính tới mẫu thứ j trong cửa sổ
      const h = (d === 0 ? 1 : Math.sin(Math.PI * d * cat) / (Math.PI * d * cat)) * (0.5 + 0.5 * Math.cos((Math.PI * d) / R_LOC));
      b[p * w + j] = h;
      tong += h;
    }
    for (let j = 0; j < w; j += 1) b[p * w + j] /= tong;
  }
  bangLoc.set(cat, b);
  return b;
}

/** Đổi tần số lấy mẫu bằng nội suy sinc có cửa sổ (lọc bớt tiếng cao trước, khỏi rè). */
function doiTanSo(x, tu, den = TAN_SO) {
  if (tu === den) return Float32Array.from(x);
  const tiLe = den / tu;
  const n = Math.floor(x.length * tiLe);
  const ra = new Float32Array(n);
  const b = heSoLoc(Math.min(1, tiLe) * 0.95);
  const w = 2 * R_LOC;
  for (let i = 0; i < n; i += 1) {
    const t = i / tiLe;
    const g = Math.floor(t);
    const o = Math.round((t - g) * PHA) * w;
    const k0 = g - R_LOC + 1;
    let s = 0;
    for (let j = 0; j < w; j += 1) {
      const k = k0 + j;
      if (k >= 0 && k < x.length) s += x[k] * b[o + j];
    }
    ra[i] = s;
  }
  return ra;
}

/** Độ to từng khung 50 ms. */
function doToKhung(x, tanSo) {
  const f = Math.max(1, Math.round(tanSo * 0.05));
  const ds = [];
  for (let i = 0; i + f <= x.length; i += f) {
    let e = 0;
    for (let j = 0; j < f; j += 1) e += x[i + j] * x[i + j];
    ds.push(Math.sqrt(e / f));
  }
  return ds;
}

/** Chỗ nhạc bắt đầu to (khung đầu tiên to hơn 60% độ to cả bài), tính bằng giây. */
function lucTo(x, tanSo) {
  const r = doToKhung(x, tanSo);
  const tb = Math.sqrt(r.reduce((s, v) => s + v * v, 0) / (r.length || 1));
  const i = r.findIndex((v) => v > 0.6 * tb);
  return i < 0 ? 0 : Math.max(0, i * 0.05 - 0.1);
}

/**
 * Các câu hát trong lời Lyria trả kèm, theo thứ tự: "[12.0:] Bắc Ninh Work ơi…" có mốc giờ; có lần Lyria trả "[:] …"
 * không có mốc (thử 24/9/2026) thì luc = null. Dòng [[A0]] là tên đoạn, bỏ.
 */
function cacCauHat(loiBai = '') {
  const ds = [];
  let doan = 0;
  for (const dong of String(loiBai).split('\n')) {
    if (/^\s*\[\[[^\]]*\]\]\s*$/.test(dong)) doan += 1; // [[A0]], [[B1]]…: sang đoạn mới của bài
    const m = /^\s*\[(\d+(?:\.\d+)?)?\s*:\s*(?:\d+(?:\.\d+)?)?\]\s*(.+)$/.exec(dong);
    if (m) ds.push({ luc: m[1] === undefined ? null : Number(m[1]), chu: m[2].trim(), doan });
  }
  return ds;
}

let choNgheMs = 3000; // Gemini quá tải: chờ rồi nghe lại (test đặt ngắn)
function datChoNgheMs(ms) {
  choNgheMs = ms;
}

/**
 * Lời hát không có mốc giờ: cho Gemini nghe 25 giây đầu (16 kHz) xem ca sĩ bắt đầu hát và hát xong câu đầu ở giây nào.
 * Đo 24/9/2026: hai lần nghe cùng một bài ra 10,7 và 10,9 giây.
 * @returns {Promise<{batDau:number, het:number, model:string, token:object, usd:number}>}
 */
async function timCauDau(mau, tanSo, cauDau) {
  const x = doiTanSo(mau.subarray(0, Math.min(mau.length, 25 * tanSo)), tanSo, 16000);
  const wav = tts.bocWav(sangPcm16(x), 16000);
  const { ketQua, model, token } = await tts.ngheTieng({
    choMs: choNgheMs,
    wav,
    cau: `Đây là 25 giây đầu một bài nhạc hiệu tiếng Việt.${cauDau ? ` Lời hát đầu tiên: "${cauDau}".` : ''} Nghe kỹ rồi trả JSON `
      + `{"bat_dau_hat": số giây ca sĩ bắt đầu hát, "het_cau_dau": số giây ca sĩ hát xong ${cauDau ? 'hết lời hát đầu tiên đó' : 'câu hát đầu tiên'} `
      + '(hết chữ cuối cùng)}. Tính từ đầu đoạn, có phần lẻ.',
  });
  const batDau = Number(ketQua?.bat_dau_hat);
  const het = Number(ketQua?.het_cau_dau);
  if (!(batDau >= 0 && het > batDau + 2 && het <= 25)) throw new Error('Gemini trả mốc giờ không hợp lý.');
  return { batDau, het, model, token, usd: chiPhi.tinhChiPhi(model, token.vao, token.ra) };
}

/**
 * Phần dùng của bài. Nhạc hiệu: từ trước câu hát đầu tới hết câu hát đầu (lời có mốc giờ thì theo mốc, tới hết câu thứ
 * hai; không có mốc thì Gemini nghe; Gemini lỗi thì 16 giây đầu). Loại khác: từ chỗ nhạc bắt đầu to.
 * @returns {Promise<{tu:number, den:number, loi:string[], nghe:object|null}>}
 */
async function chonDoan(loai, x, tanSo, loiBai) {
  const tong = x.length / tanSo;
  const L = LOAI[loai];
  if (loai !== 'hieu' && loai !== 'hieu_radio') {
    const tu = lucTo(x, tanSo);
    return { tu, den: Math.min(tong, tu + L.giay), loi: [], nghe: null };
  }
  const cau = cacCauHat(loiBai);
  // Nhạc hiệu Radio: mốc giờ Lyria trả lệch với tiếng hát (thử 24/9/2026: cắt theo mốc thì cụt giữa "sống vui…") → luôn
  // cho Gemini nghe tìm chỗ hát xong.
  if (loai === 'hieu' && cau.length && cau.slice(0, 3).every((c) => c.luc !== null)) {
    const tu = Math.max(0, cau[0].luc - 3);
    const het = cau[2] ? cau[2].luc : cau[1] ? cau[1].luc + 4 : cau[0].luc + 8;
    // Tối thiểu 9 giây: Lyria có lần trả câu đệm "(Dậy đi thôi…)" làm câu đầu, mốc sát nhau → đoạn 4 giây cụt (thử 24/9/2026).
    const den = Math.min(tong, Math.max(het + 0.3, tu + 9), tu + L.toiDa);
    return { tu, den, loi: cau.filter((c) => c.luc >= tu && c.luc < den - 1).map((c) => c.chu), nghe: null };
  }
  // Câu móc là đoạn lời đầu tiên (Lyria có lần viết một dòng, có lần chia hai dòng): lấy tối đa 2 dòng của đoạn đó.
  const loi = cau.length ? cau.filter((c) => c.doan === cau[0].doan).slice(0, 2).map((c) => c.chu) : [];
  try {
    // Hát xong câu đầu thì nhạc ngân thêm 2,5 giây (2 giây cuối nhỏ dần) cho khỏi cụt.
    const nghe = await timCauDau(x, tanSo, loi.join(' '));
    const tu = Math.max(0, nghe.batDau - 2.5);
    return { tu, den: Math.min(tong, nghe.het + 2.5, tu + L.toiDa), loi, nghe };
  } catch {
    return { tu: 0, den: Math.min(tong, L.toiDa), loi, nghe: null };
  }
}

/**
 * Phần dùng của một bài hát (F-50): từ chỗ nhạc bắt đầu to; bài dài quá 2 phút thì kết ở chỗ sang đoạn nhạc mới cuối cùng
 * (theo mốc lời hát: dòng đầu của đoạn [[…]] mới) trong khoảng 1 phút 20 – 2 phút, không có mốc thì ở 2 phút.
 * @returns {{tu:number, den:number, catSom:boolean}}
 */
function chonDoanBai(x, tanSo, loiBai = '') {
  const tong = x.length / tanSo;
  const tu = lucTo(x, tanSo);
  if (tong - tu <= BAI_TOI_DA_S + 5) return { tu, den: tong, catSom: false };
  const cau = cacCauHat(loiBai);
  const dauDoan = cau.filter((c, i) => c.luc !== null && i > 0 && c.doan !== cau[i - 1].doan).map((c) => c.luc);
  const moc = dauDoan.filter((l) => l - tu >= BAI_KET_SOM_S && l - tu <= BAI_TOI_DA_S).at(-1);
  // Kết ở chỗ sang đoạn: giữ thêm 1 giây ngân rồi nhỏ dần.
  return { tu, den: moc !== undefined ? Math.min(tong, moc + 1) : tu + BAI_TOI_DA_S, catSom: true };
}

/**
 * Bài Lyria trả → phần dùng: PCM 16-bit 24 kHz một kênh, dài tối đa 2 phút.
 * @returns {Promise<{pcm:Buffer, giay:number, tu:number}>}
 */
async function xuLyBai(tep, loiBai = '') {
  const { mau, tanSo } = await giaiMa(tep);
  const { tu, den, catSom } = chonDoanBai(mau, tanSo, loiBai);
  const x = doiTanSo(mau.subarray(Math.floor(tu * tanSo), Math.floor(den * tanSo)), tanSo);
  vaoRaEm(chinhDoTo(x, DO_TO_BAI), VAO_EM_S, catSom ? BAI_RA_S : 1.5);
  return { pcm: sangPcm16(x), giay: x.length / TAN_SO, tu };
}

/** Chỉnh độ to (tính trên khung có tiếng) về `muc` (mặc định DO_TO), không để vượt đỉnh. */
function chinhDoTo(x, muc = DO_TO) {
  const r = doToKhung(x, TAN_SO).filter((v) => v > 0.005);
  const tb = r.length ? Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length) : 0;
  let dinh = 0;
  for (const v of x) dinh = Math.max(dinh, Math.abs(v));
  if (!tb || !dinh) return x;
  const k = Math.min(muc / tb, DINH / dinh);
  for (let i = 0; i < x.length; i += 1) x[i] *= k;
  return x;
}

function vaoRaEm(x, vao, ra) {
  const nv = Math.min(x.length, Math.round(vao * TAN_SO));
  const nr = Math.min(x.length, Math.round(ra * TAN_SO));
  for (let i = 0; i < nv; i += 1) x[i] *= i / nv;
  for (let i = 0; i < nr; i += 1) x[x.length - 1 - i] *= (0.5 - 0.5 * Math.cos((Math.PI * i) / nr));
  return x;
}

function sangPcm16(x) {
  const b = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i += 1) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), i * 2);
  return b;
}

/**
 * Bài Lyria trả (MP3 hoặc WAV) → phần dùng: PCM 16-bit 24 kHz một kênh.
 * @returns {Promise<{pcm:Buffer, giay:number, loi:string[], tu:number, nghe:object|null}>}
 */
async function xuLy(loai, tep, loiBai = '') {
  canLoai(loai);
  const { mau, tanSo } = await giaiMa(tep);
  const { tu, den, loi, nghe } = await chonDoan(loai, mau, tanSo, loiBai);
  const x = doiTanSo(mau.subarray(Math.floor(tu * tanSo), Math.floor(den * tanSo)), tanSo);
  vaoRaEm(chinhDoTo(x), VAO_EM_S, LOAI[loai].ra);
  return { pcm: sangPcm16(x), giay: x.length / TAN_SO, loi, tu, nghe };
}

/* ---------------- làm, đọc, xóa ---------------- */

/**
 * Làm một loại nhạc: gọi Lyria (khoảng 1 phút), cắt, lưu, ghi chi phí 0,08 USD (agent doi_ai).
 * @returns {Promise<{loai:string, giay:number, mo_ta:string, loi_bai:string, luc:string, usd:number, canhBao:string|null}>}
 */
async function lamNhac({ loai, moTa }) {
  canLoai(loai);
  const L = LOAI[loai];
  const mt = (String(moTa ?? '').trim() || L.moTa).replaceAll('{ten_shop}', require('../nghiep-vu/cai-dat').tenShop());
  if (mt.length > 1500) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Lời tả nhạc dài quá (tối đa 1.500 chữ).');
  if (caiDat.khanCap()) throw new LoiNghiepVu('KHAN_CAP_DANG_BAT', '"Dừng mọi thứ" đang bật: chưa làm nhạc được.', 409);
  let kq;
  try {
    kq = await tts.taoNhac({ moTa: mt });
  } catch (e) {
    throw new LoiNghiepVu('AI_LOI', `Google chưa làm được ${L.ten.toLowerCase()}: ${e.message}`, 502);
  }
  const runId = nhatKy.taoRun({ agentId: 'doi_ai', kichHoat: `Làm ${L.ten.toLowerCase()} (Lyria 3.5)` });
  nhatKy.xongRun(runId, { nha: 'gemini', model: kq.model, tokenVao: 0, tokenRa: 0, chiPhi: GIA_MOT_BAI_USD });
  const canhBao = chiPhi.kiemMucTran();
  let x;
  try {
    x = await xuLy(loai, kq.tep, kq.loiBai);
  } catch (e) {
    throw new LoiNghiepVu('AI_LOI', `Nhạc Google trả không dùng được (${e.message}). Bấm tạo lại.`, 502);
  }
  let usd = GIA_MOT_BAI_USD;
  if (x.nghe) {
    // Gemini nghe tìm chỗ hết câu hát đầu của nhạc hiệu: ghi chi phí riêng (vài chục đồng).
    const r = nhatKy.taoRun({ agentId: 'doi_ai', kichHoat: `Nghe ${L.ten.toLowerCase()} tìm chỗ cắt` });
    nhatKy.xongRun(r, { nha: 'gemini', model: x.nghe.model, tokenVao: x.nghe.token.vao, tokenRa: x.nghe.token.ra, chiPhi: x.nghe.usd });
    usd += x.nghe.usd;
  }
  fs.writeFileSync(tepNhac(loai), tts.bocWav(x.pcm));
  const thongTin = { giay: Math.round(x.giay * 10) / 10, mo_ta: mt, loi_bai: x.loi.join('\n'), luc: gio() };
  doiAi.luuNhac(loai, thongTin);
  return { loai, ...thongTin, usd, canhBao: canhBao || chiPhi.kiemMucTran() };
}

/** Tệp nhạc đã làm (WAV 24 kHz một kênh) hoặc null. */
function docNhac(loai) {
  if (!Object.hasOwn(LOAI, loai)) return null;
  // Chỉ phát nhạc có thông tin đã lưu: lần nâng 012 (bán hàng, #66) bỏ thông tin nhạc hiệu có lời nói về việc làm,
  // tệp cũ còn nằm trên đĩa nhưng không được phát nữa.
  if (!doiAi.nhac()[loai]) return null;
  const f = tepNhac(loai);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}

function xoaNhac(loai) {
  canLoai(loai);
  fs.rmSync(tepNhac(loai), { force: true });
  return doiAi.luuNhac(loai, null);
}

/** Cho màn hình Cài đặt: các loại, khi nào phát, lời tả mặc định. */
function dsLoai() {
  const shop = require('../nghiep-vu/cai-dat').tenShop();
  return Object.entries(LOAI).map(([id, L]) => ({ id, ten: L.ten.replaceAll('{ten_shop}', shop), khi: L.khi.replaceAll('{ten_shop}', shop), mo_ta_mac_dinh: L.moTa.replaceAll('{ten_shop}', shop) }));
}

/* ---------------- bài hát: làm, đọc, xóa (F-50) ---------------- */

/**
 * Làm (hoặc làm lại, khi có `id`) một bài hát Radio: Lyria viết lời và hát theo tên bài và kiểu nhạc (khoảng 1–2 phút),
 * MOZA cắt tối đa 2 phút, lưu, ghi chi phí 0,08 USD (agent doi_ai).
 * @returns {Promise<{baiHat:object, danhSach:object[], usd:number, canhBao:string|null}>}
 */
async function lamBaiHat({ id = null, ten, kieu }) {
  const t = String(ten ?? '').normalize('NFC').replace(/["“”\n]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 60) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Tên bài hát cần từ 1 tới 60 chữ.');
  if (!Object.hasOwn(KIEU_BAI, kieu)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có kiểu nhạc "${kieu}".`);
  const ds = doiAi.baiHat();
  if (id && !ds.some((b) => b.id === id)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có bài hát này.', 404);
  if (!id && ds.length >= doiAi.BAI_HAT_TOI_DA) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Tối đa ${doiAi.BAI_HAT_TOI_DA} bài hát. Xóa bớt bài chưa ưng rồi tạo bài mới.`);
  }
  if (caiDat.khanCap()) throw new LoiNghiepVu('KHAN_CAP_DANG_BAT', '"Dừng mọi thứ" đang bật: chưa làm bài hát được.', 409);
  let kq;
  try {
    kq = await tts.taoNhac({ moTa: moTaBai(t, kieu) });
  } catch (e) {
    throw new LoiNghiepVu('AI_LOI', `Google chưa làm được bài "${t}": ${e.message}`, 502);
  }
  const runId = nhatKy.taoRun({ agentId: 'doi_ai', kichHoat: `Làm bài hát "${t}" (Lyria 3.5)` });
  nhatKy.xongRun(runId, { nha: 'gemini', model: kq.model, tokenVao: 0, tokenRa: 0, chiPhi: GIA_MOT_BAI_USD });
  const canhBao = chiPhi.kiemMucTran();
  let x;
  try {
    x = await xuLyBai(kq.tep, kq.loiBai);
  } catch (e) {
    throw new LoiNghiepVu('AI_LOI', `Bài hát Google trả không dùng được (${e.message}). Bấm tạo lại.`, 502);
  }
  const ma = id || `bh${crypto.randomBytes(5).toString('hex')}`;
  fs.writeFileSync(tepBai(ma), tts.bocWav(x.pcm));
  const loi = cacCauHat(kq.loiBai).map((c) => c.chu);
  const thongTin = { ten: t, kieu, giay: Math.round(x.giay), loi_bai: loi.join('\n').slice(0, 3000), luc: gio() };
  const danhSach = doiAi.luuBaiHat(ma, thongTin);
  return { baiHat: { id: ma, ...thongTin }, danhSach, usd: GIA_MOT_BAI_USD, canhBao: canhBao || chiPhi.kiemMucTran() };
}

/** Tệp bài hát (WAV 24 kHz một kênh) hoặc null. */
function docBaiHat(id) {
  if (!/^bh[a-f0-9]{10}$/.test(String(id)) || !doiAi.baiHat().some((b) => b.id === id)) return null;
  const f = tepBai(id);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}

function xoaBaiHat(id) {
  if (!doiAi.baiHat().some((b) => b.id === id)) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có bài hát này.', 404);
  fs.rmSync(tepBai(id), { force: true });
  return doiAi.luuBaiHat(id, null);
}

/** Cho màn hình Cài đặt: kiểu nhạc và tên gợi ý. */
function dsKieuBai() {
  return Object.entries(KIEU_BAI).map(([id, k]) => ({ id, ten: k.ten }));
}

module.exports = {
  LOAI, GIA_MOT_BAI_USD, lamNhac, docNhac, xoaNhac, dsLoai, xuLy, giaiMa, docWav, doiTanSo, cacCauHat, chonDoan, datChoNgheMs,
  KIEU_BAI, GOI_Y_BAI, moTaBai, chonDoanBai, xuLyBai, lamBaiHat, docBaiHat, xoaBaiHat, dsKieuBai, BAI_TOI_DA_S,
};
