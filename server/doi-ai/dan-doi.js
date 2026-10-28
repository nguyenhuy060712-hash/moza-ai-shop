'use strict';

/**
 * Đội AI dẫn trên sóng (SPEC.md bản 2.9, #49, F-46; đố vui và câu mẫu F-48; nhạc F-47).
 *
 *  - Không mở miệng Live (#49): phiên lưu `che_do_ai = goi_y` + `doi_ai = 1`. Chép lời người dẫn, Director, Co-host
 *    chạy như "Chỉ gợi ý"; câu Co-host đã qua Bộ kiểm tra được đội đọc lên.
 *  - MOZA cầm nhịp: đọc đoạn đã làm sẵn ở phòng thu (làm sẵn trước 2 đoạn kế), hết đoạn nghỉ ngắn rồi sang đoạn sau,
 *    hết kịch bản thì vòng mới. Chen vào chỗ nghỉ: câu đệm + trả lời "Mai ơi" của người dẫn, trả lời người xem, chào
 *    tên người vừa bình luận, nhắc "đội trợ lý AI" đầu vòng mới.
 *  - Tiếng đi cùng đường loa của miệng (PCM 24 kHz tới Màn hình người dẫn), đẩy trước tối đa 1,5 giây: bộ phát trình
 *    duyệt không cạn mà vẫn dừng được ngay.
 *  - Người dẫn nói xen: chép lời không trùng lời đội đang đọc → tạm ngừng (bỏ tiếng đang chờ ở trình duyệt, lùi
 *    0,5 giây), người dẫn thôi nói 1,5 giây thì đọc tiếp. Chữ chép lời trùng lời đội (tiếng loa lọt vào micro) bị bỏ:
 *    không đưa Director, không tính "Mai ơi" (nhân vật khác nói "Mai ơi" trong thoại).
 *  - Radio {ten_shop} (bản 2.10, #54, #74, F-49, F-50): kịch bản Radio thì dùng nhạc hiệu Radio, báo giờ sau nhạc hiệu
 *    (thay câu nhắc đầu vòng) và sau mỗi bài hát; đoạn Lời nhắn gửi: phần mời → lời chúc người xem + giới thiệu bài →
 *    bài hát → báo giờ → phần quay lại.
 */

const fs = require('node:fs');
const path = require('node:path');
const live = require('../nghiep-vu/live');
const sp = require('../nghiep-vu/san-pham');

/** Sản phẩm của đoạn còn Đang bán không (đọc lại lúc hỏi); đoạn không có sản phẩm → null. */
function dangBanDoan(d) {
  if (!d?.san_pham_id) return null;
  try { return sp.laySanPham(d.san_pham_id).trang_thai === 'dang_ban'; } catch { return false; }
}
const caiDat = require('../nghiep-vu/cai-dat');
const doiAi = require('../nghiep-vu/doi-ai');
const tts = require('../agent/nha-cung-cap/tts');
const { LoiNghiepVu, boDau } = require('../nghiep-vu/chung');
const { coThongTinCaNhan } = require('../nghiep-vu/nhan-binh-luan');
const { tenGoi, CHAO_KET } = require('../agent/mieng/mieng');
const phongThuMacDinh = require('./phong-thu');
const nhacDoi = require('./nhac');

/** Nhạc đã làm (F-47): PCM 24 kHz và lời hát (nhận ra tiếng loa lọt vào micro), hoặc null khi chưa tạo loại này. */
function nhacMacDinh(loai) {
  const wav = nhacDoi.docNhac(loai);
  return wav ? { pcm: tts.tachWav(wav).pcm, loi: doiAi.nhac()[loai]?.loi_bai || '' } : null;
}

/** Kho bài hát Radio (F-50): danh sách { id, ten } và đọc một bài → { pcm, loi } hoặc null. */
const khoBaiMacDinh = {
  ds: () => doiAi.baiHat().map((b) => ({ id: b.id, ten: b.ten })),
  doc: (id) => {
    const wav = nhacDoi.docBaiHat(id);
    return wav ? { pcm: tts.tachWav(wav).pcm, loi: doiAi.baiHat().find((b) => b.id === id)?.loi_bai || '' } : null;
  },
};

/** Giờ Việt Nam để đọc lên sóng: "20 giờ 15 phút", "8 giờ đúng". */
function gioNoi(luc = Date.now()) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .format(new Date(luc)).split(':').map(Number);
  return m ? `${h} giờ ${m} phút` : `${h} giờ đúng`;
}

/**
 * Lời chúc của người xem, sạch để đọc lên sóng (F-50), hoặc null khi không nên đọc: số điện thoại, CCCD, đường link, tài
 * khoản mạng xã hội, chuỗi từ 4 chữ số. Bỏ biểu tượng cảm xúc và các dấu máy đọc hiểu thành lệnh (<…>, |…|, {…}).
 */
function lamSachLoiChuc(noiDung) {
  let s = String(noiDung ?? '').normalize('NFC');
  if (coThongTinCaNhan(s)) return null;
  if (/https?:|www\.|\.(com|vn|net|me)\b|zalo|tele|@\w/iu.test(s)) return null;
  if (/\d{4,}/.test(s.replace(/(\d)[\s.\-]+(?=\d)/g, '$1'))) return null;
  s = s.replace(/<[^>]{0,40}>/g, ' ').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ').replace(/[<>|{}[\]#*_~^\\]/g, ' ')
    .replace(/(\p{L})\1{2,}/gu, '$1$1').replace(/\s+/g, ' ').trim();
  if (s.replace(/[^\p{L}]/gu, '').length < 4) return null;
  if (s.length > 200) {
    const cat = s.slice(0, 200);
    const cuoiCau = Math.max(cat.lastIndexOf('.'), cat.lastIndexOf('!'), cat.lastIndexOf('?'));
    s = cuoiCau >= 60 ? cat.slice(0, cuoiCau + 1) : `${cat.slice(0, cat.lastIndexOf(' '))}…`;
  }
  return s;
}

/**
 * Chỗ ngắt câu gần nhất phía trước `viTri` (byte) trong PCM 16-bit 24 kHz: cuối một quãng lặng ≥ 160 ms (8 khung 20 ms
 * có biên độ trung bình < 300), tìm lùi tối đa `toiDaS` giây; không thấy thì giữ nguyên.
 */
function diemNgatTruoc(pcm, viTri, toiDaS = 4) {
  const khung = 960; // 20 ms
  const dau = Math.max(0, viTri - Math.round(toiDaS * 48000));
  let lang = 0;
  let cuoiLang = viTri;
  for (let o = (viTri & ~1) - khung; o >= dau; o -= khung) {
    let tong = 0;
    for (let i = o; i < o + khung; i += 2) tong += Math.abs(pcm.readInt16LE(i));
    if (tong / (khung / 2) < 300) {
      if (!lang) cuoiLang = o + khung;
      lang += 1;
      if (lang >= 8) return Math.max(0, cuoiLang - 2 * khung); // giữ 40 ms lặng trước câu
    } else lang = 0;
  }
  return viTri;
}

/** Bản sao PCM có đoạn cuối nhỏ dần (cắt nhạc đố vui cho vừa thời gian chờ). */
function raEmPcm(buf, giay) {
  const b = Buffer.from(buf);
  const n = b.length >> 1;
  const m = Math.min(n, Math.round(giay * 24000));
  for (let i = 0; i < m; i += 1) {
    const k = (n - m + i) * 2;
    b.writeInt16LE(Math.round(b.readInt16LE(k) * (1 - (i + 1) / m)), k);
  }
  return b;
}

const BYTE_GIAY = 48000; // PCM 16-bit 24 kHz một kênh
const NHIP = {
  chuKyMs: 1000, // so trạng thái phiên (bật / tắt chế độ, người dẫn bấm ← →)
  nhipMs: 200, // mỗi 0,2 giây: đẩy tiếng, xem tới lúc đọc phần tiếp chưa
  truocMs: 1500, // đẩy tiếng trước tối đa chừng này
  manhMs: 200,
  nghiMs: 800, // hết một phần, nghỉ chừng này ("có đoạn nghỉ, nhưng ngắn thôi")
  choNguoiDanMs: 1500, // người dẫn thôi nói chừng này thì đọc tiếp
  luiMs: 500, // bị ngắt thì lùi chừng này khi đọc tiếp
  vongMs: 800, // tiếng loa còn vọng chừng này sau khi dứt: âm lượng micro chưa tính là người dẫn
  choTraLoiMs: 25000, // câu trả lời người dẫn hỏi chưa tới sau chừng này thì thôi chờ
  choDoanMs: 8000, // đoạn làm sẵn chưa xong sau chừng này thì đọc kiểu phát dần (Google quá tải hay treo)
  lamSanToiDaMs: 120000, // làm sẵn cả kịch bản ở nền: một đoạn treo quá chừng này thì làm tiếp đoạn sau
  choLamTiengMs: 60000, // đoạn làm tiếng quá lâu thì bỏ qua
  chaoMoiMs: 2 * 60 * 1000, // chào tên người vừa bình luận tối đa mỗi 2 phút
};
const HANG_TOI_DA = 5;
// Giữa hai đoạn chen tối đa chừng này câu (trả lời người xem, chào tên…; câu người dẫn hỏi không tính): nhiều người hỏi
// thì đội vẫn giới thiệu việc mới, câu còn lại trả lời ở chỗ nghỉ sau (buổi tập 24/9/2026: 3 câu liền, 43 giây).
const CHEN_LIEN_TIEP = 2;
const CAU_HOI_HET_MS = 3 * 60 * 1000;
const NHAN_BAN_HANG = { vua_chot: 'vừa chốt', vua_het: 'vừa hết', con_it: 'còn ít', nhac_cach_chot: 'nhắc cách chốt', mo_tin_nhan: 'mở tin nhắn', da_nghe_yeu_cau: 'đã nghe yêu cầu', tu_van_size: 'tư vấn size', tu_van_size_giua: 'tư vấn size', tu_van_size_gom: 'tư vấn size', dem_chot: 'đếm chốt', cam_on_cuoi: 'cảm ơn', sap_toi: 'món sau', tu_nhan_ai: 'tự nhận AI', binh_chon_mo: 'bình chọn', binh_chon_ket: 'bình chọn', binh_chon_hoa: 'bình chọn' };
const NHAN_KHONG_CHAO = ['spam', 'xuc_pham', 'lua_ai', 'thong_tin_ca_nhan', 'gia_shop'];

function docCauMau() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cau-hinh', 'doi-ai-cau-mau.json'), 'utf8'));
  } catch {
    return {};
  }
}

const gon = (s) => boDau(s).replace(/[^a-z0-9]/g, '');
const tuCua = (s) => boDau(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
const PHU_DINH = new Set(['khong', 'ko', 'k', 'kh', 'khg', 'hong', 'hok', 'chua']);

/**
 * Bình luận có đáp án đố vui: vài chữ liền nhau ghép lại đúng bằng một đáp án (bỏ dấu, bỏ khoảng trắng: "6 tr" = "6tr"),
 * ngay trước đó không có "không", "chưa", "không phải". So theo cả chữ: "16 triệu" không khớp "6 triệu".
 */
function coDapAn(noiDung, dapAn) {
  const w = boDau(noiDung).split(/[^a-z0-9]+/).filter(Boolean);
  for (let k = 0; k < w.length; k += 1) {
    if (PHU_DINH.has(w[k - 1] === 'phai' ? w[k - 2] : w[k - 1])) continue;
    let ghep = '';
    for (let m = k; m < w.length && ghep.length < 40; m += 1) {
      ghep += w[m];
      if (dapAn.includes(ghep)) return true;
    }
  }
  return false;
}

class DoiAiDan {
  /**
   * @param {object} o
   * @param {Function} o.phat         sự kiện tới mọi màn hình
   * @param {object} o.mieng          agent/mieng/mieng.js: dùng chung các Màn hình người dẫn đã báo `loa.bat`
   * @param {object} [o.phongAi]      phong-ai.js: âm lượng micro người dẫn, báo lên Màn hình người dẫn
   * @param {object} [o.phongThu]     thay phòng thu (test)
   * @param {Function} [o.nhac]       thay kho nhạc (test): loai → { pcm, loi } | null
   * @param {object} [o.khoBai]       thay kho bài hát Radio (test): { ds: () => [{id, ten}], doc: id → {pcm, loi} | null }
   * @param {object} [o.nhip]         đè thời gian (test)
   */
  constructor({ phat, mieng, phongAi = null, phongThu = phongThuMacDinh, nhac = nhacMacDinh, khoBai = khoBaiMacDinh, nhip = {} }) {
    Object.assign(this, { phat, mieng, phongAi, phongThu, nhac, khoBai });
    this.nhip = { ...NHIP, ...nhip };
    this.byteManh = Math.round((this.nhip.manhMs / 1000) * BYTE_GIAY) & ~1;
    this.cauMau = docCauMau();
    this.s = null;
  }

  /* ---------------- chạy nền ---------------- */

  batDau() {
    this.henDongBo = setInterval(() => { try { this.dongBo(); } catch (e) { console.error('  [đội AI] ' + e.message); } }, this.nhip.chuKyMs);
    this.henNhip = setInterval(() => { try { this.nhipDan(); } catch (e) { console.error('  [đội AI] ' + e.message); } }, this.nhip.nhipMs);
  }

  dung() {
    clearInterval(this.henDongBo);
    clearInterval(this.henNhip);
    this.thoi(null);
  }

  /** So trạng thái phiên: bật khi đang live ở chế độ Đội AI dẫn và "Dừng mọi thứ" tắt. */
  dongBo() {
    const p = live.phienDangMo();
    const bat = !!p && p.trang_thai === 'dang_live' && !!p.doi_ai && !caiDat.khanCap() && !caiDat.dungAi().bat;
    if (!bat) {
      if (this.s) this.thoi(!p || p.trang_thai !== 'dang_live' ? 'Buổi live đã xong' : caiDat.khanCap() ? '"Dừng mọi thứ" đang bật' : caiDat.dungAi().bat ? 'AI tạm dừng vì chạm trần chi phí' : 'Đổi chế độ khác');
      return;
    }
    if (!this.s || this.s.phienId !== p.id) this.moi(p);
    // Người dẫn bấm ← → (đoạn đổi mà không phải do đội chuyển).
    if (p.doan_hien_tai !== this.s.doanDaBiet) this.nguoiDanChuyenDoan(p.doan_hien_tai);
  }

  moi(p) {
    this.s = {
      phienId: p.id, p, dienTap: !!p.dien_tap, i: p.doan_hien_tai, doanDaBiet: p.doan_hien_tai, vong: 1,
      dang: null, hang: [], tamDung: false, lyDo: null, lucHet: 0, lucNguoiDan: 0, chuVua: '',
      lamSan: new Map(), lucChao: Date.now(), daChao: new Set(live.binhLuanGanDay(p.id, 100).map((b) => b.id)),
      doVui: null, xoay: {}, daMoMan: false, dangKet: false, chenLienTiep: 0,
      canHieu: true, vuaNhac: false, // nhạc hiệu lúc mở màn; vừa có nhạc thì đoạn kế không cần nhạc chuyển cảnh (F-47)
      hoan: null, // đoạn đang đọc dở, giữ lại khi người dẫn gọi "Mai ơi" giữa chừng; trả lời xong đọc tiếp
      // Radio (bản 2.10): báo giờ, nhạc hiệu Radio, bài hát. tiepSau: việc tiếp theo của bài hát bị ngừng vì "Mai ơi".
      radio: doiAi.laKichBanRadio(p.kich_ban), daDocChuc: new Set(), tiepSau: null,
      // Trần câu chen (F-67): khởi động lại giữa buổi thì đếm lại từ nhật ký chi phí của phiên.
      soChen: require('../nghiep-vu/nhat-ky').demCauChen(p.id), daBaoTran: false,
    };
    this.lamTruoc(this.s.i);
    this.lamCaKichBan().catch((e) => console.error(`  [đội AI] làm sẵn cả kịch bản: ${e.message}`));
    this.baoDan();
  }

  /** Thôi dẫn: dừng tiếng đang phát, bỏ mọi việc đang chờ. */
  thoi(lyDo) {
    const s = this.s;
    if (!s) return;
    this.s = null;
    if (s.dang) this.phat('live.mai_ngat', { phien_id: s.phienId, ly_do: lyDo });
    this.phat('live.doi_noi', { phien_id: s.phienId, luot: [] });
    this.phat('live.doi_dan', { phien_id: s.phienId, trang_thai: 'tat', ly_do: lyDo });
  }

  coLoa() {
    for (const ws of this.mieng?.loa || []) if (ws.readyState === 1) return true;
    return false;
  }

  guiLoa(buf) {
    for (const ws of this.mieng?.loa || []) if (ws.readyState === 1) ws.send(buf);
  }

  baoDan(lyDo = null) {
    const s = this.s;
    if (!s) return;
    this.phat('live.doi_dan', { phien_id: s.phienId, trang_thai: s.tamDung ? 'tam_dung' : 'dang_dan', doan: s.i, vong: s.vong, ly_do: lyDo });
  }

  bao(noiDung, muc = 'thuong') {
    try {
      if (this.phongAi && this.phongAi.st.phienId !== this.s?.phienId) this.phongAi.datLai(this.s?.phienId);
      this.phongAi?.bao(noiDung, muc);
    } catch { /* phiên đã xong */ }
  }

  baoMucTran(canhBao) {
    require('../nghiep-vu/chi-phi').baoVuotTran(this.phat, canhBao);
  }

  /* ---------------- tiếng: phần làm sẵn và câu chen ---------------- */

  /** Làm tiếng đoạn i (một lần; lần sau lấy lại kết quả). */
  lamSan(i) {
    const s = this.s;
    let x = s.lamSan.get(i);
    if (x) return x;
    const d = s.p.kich_ban.doan[i];
    x = { trangThai: 'dang', tu: Date.now(), kq: null, loi: null, phatDan: null };
    s.lamSan.set(i, x);
    x.hua = this.phongThu.lamTiengDoan({
      doan: d, viec: `Đội AI · đoạn ${i + 1}/${s.p.kich_ban.doan.length}${d?.san_pham ? ` (${d.san_pham.ten_goi})` : ''}`, dienTap: s.dienTap, phienLiveId: s.phienId,
    }).then((kq) => {
      x.kq = kq;
      x.trangThai = 'xong';
      this.baoMucTran(kq.canhBao);
      if (kq.bo?.length) {
        const ly = kq.bo.map((b) => [b.so?.length ? `số ${b.so.join(', ')} không thấy trong thẻ sản phẩm` : '', b.tu_cam?.length ? `từ cấm "${b.tu_cam.join('", "')}"` : ''].filter(Boolean).join(', '));
        this.bao(`Đội AI bỏ ${kq.bo.length} câu ở đoạn ${i + 1}: ${ly.join('; ')}.`);
      }
    }).catch((e) => {
      x.loi = e.message;
      x.trangThai = 'loi';
    });
    return x;
  }

  /** Làm sẵn đoạn i và 2 đoạn kế. */
  lamTruoc(i) {
    let j = i;
    for (let k = 0; k < 3 && this.s; k += 1) {
      this.lamSan(j);
      const sau = this.doanKe(j);
      if (sau.i === j) break;
      j = sau.i;
    }
  }

  /**
   * Làm sẵn tiếng cả kịch bản ở nền, lần lượt từng đoạn (không dồn một lúc kẻo Google giới hạn lượt gọi), bắt đầu từ
   * đoạn đang đọc: buổi live đi tới đâu cũng đã có tiếng. Tiếng đã làm dùng lại cho buổi sau, không tốn thêm.
   */
  async lamCaKichBan() {
    const s = this.s;
    const ds = s.p.kich_ban.doan;
    for (let k = 0; k < ds.length; k += 1) {
      if (this.s !== s) return;
      const j = (s.i + k) % ds.length;
      if (ds[j].san_pham_id && dangBanDoan(ds[j]) === false) continue;
      await Promise.race([this.lamSan(j).hua, new Promise((r) => { setTimeout(r, this.nhip.lamSanToiDaMs).unref?.(); })]);
    }
  }

  /**
   * Đoạn chưa làm xong tiếng (Google quá tải hay treo — buổi live 24/9/2026 im gần một phút ở đoạn mở đầu): đọc các lượt
   * kiểu phát dần (Flash-Lite, có tiếng sau 1–2 giây), soát số như phòng thu. Đố vui cần chờ ở giữa nên không đọc kiểu
   * này. Lời nhắn gửi (Radio, F-50): hai phần mời và quay lại đọc phát dần, bài hát ở giữa như thường.
   * Cũng dùng khi làm sẵn bị lỗi — Google hết lượt trong ngày (429: 100 lượt/ngày cho gemini-3.8-flash-tts, buổi thử
   * 24/9/2026) thì trước đây đội bỏ qua mọi đoạn, sóng im.
   */
  phatDanDoan(d) {
    const t = doiAi.tachThoai(d.loi_nhac);
    if (!t.luot.length || t.cho) return null;
    const nguon = this.phongThu.nguonSo({ sanPhamId: d.san_pham_id || null, chu: t.luot.map((l) => l.loi).join(' ') });
    if (t.baiHat) {
      const [a, b] = doiAi.chiaHaiPhan(t).map((ds) => this.phongThu.soatSo(ds, nguon).giu);
      return {
        loiNhan: true, sanSang: true,
        moi: a.length ? this.taoChen('đoạn (phát dần)', a) : null, quayLai: b.length ? this.taoChen('đoạn (phát dần)', b) : null,
      };
    }
    const { giu } = this.phongThu.soatSo(t.luot, nguon);
    return giu.length ? this.taoChen('đoạn (phát dần)', giu) : null;
  }

  /**
   * Một câu chen (câu đệm, trả lời, chào tên…): Flash-Lite đọc kiểu phát dần, tiếng tới đâu phát tới đó.
   * @param {{ai:string, cachNoi?:string, loi:string}[]} luot
   */
  taoChen(loai, luot, { uuTien = false } = {}) {
    const s = this.s;
    const c = { loai, luot, chu: luot.map((l) => l.loi).join(' '), manh: [], pcm: Buffer.alloc(0), do: 0, sanSang: false, xong: false, loi: null, uuTien, tao: Date.now() };
    // Trần câu chen mỗi buổi (F-67): từ 80% chỉ còn câu ưu tiên (trả lời người dẫn, vừa chốt, vừa hết); chạm trần chỉ còn trả
    // lời người dẫn — câu còn lại hiện chữ cho người dẫn đọc, không tốn lượt giọng. Đoạn đọc phát dần là kịch bản, không tính.
    if (loai !== 'đoạn (phát dần)' && luot.length) {
      const tran = this.tranChen();
      const ban = uuTien || ['vừa chốt', 'vừa hết'].includes(loai);
      if ((s.soChen >= tran && !uuTien) || (s.soChen >= Math.floor(tran * 0.8) && !ban)) {
        if (!s.daBaoTran) {
          s.daBaoTran = true;
          this.bao(`Đội AI đã dùng ${s.soChen}/${tran} câu chen của buổi này: từ giờ câu chen không quan trọng hiện chữ để bạn đọc.`, 'vang');
        }
        this.bao(`Câu chen (${loai}), bạn đọc giúp: ${c.chu}`);
        return { ...c, luot: [], boQua: true, sanSang: true, xong: true };
      }
      s.soChen += 1;
    }
    this.phongThu.lamTiengLuot({
      luot, model: this.phongThu.MODEL_CHEN, viec: `Đội AI · ${loai}`, dienTap: s.dienTap, phienLiveId: s.phienId,
      khiAm: (b) => { c.manh.push(b); c.do += b.length; c.sanSang = true; },
    }).then((kq) => {
      c.xong = true;
      c.sanSang = true;
      this.baoMucTran(kq.canhBao);
    }).catch((e) => {
      // Máy đọc đọc lệch câu gốc (F-108): bỏ tiếng, hiện chữ cho người dẫn đọc như khi chạm trần câu chen.
      if (e.ma === 'DOC_LECH') this.bao(`Máy đọc đọc lệch câu chen (${loai}), bạn đọc giúp: ${c.chu}`, 'vang');
      else c.loi = e.message;
      c.hetLuot = e.ma === 'HET_LUOT_NGAY';
      c.xong = true;
      c.sanSang = true;
      console.error(`  [đội AI] ${loai}: ${e.message}`);
    });
    return c;
  }

  /** F-109: lúc đội nói câu có "trợ lý AI" gần nhất của phiên (null nếu chưa). */
  lucTuNhan(phienId) {
    return this.s?.phienId === phienId ? this.s.lucTuNhan || null : null;
  }

  /** F-109: đội đang dẫn phiên này (đã có loa, chưa thôi). */
  dangDan(phienId) {
    return this.s?.phienId === phienId && !this.s.dangKet;
  }

  tranChen() {
    return Number(require('../cau-hinh/mac-dinh.json').doi_ai?.tran_cau_chen_moi_buoi) || 60;
  }

  /**
   * Google hết lượt đọc giọng trong ngày (25/9/2026: 100 lượt/ngày mỗi model): báo đỏ cho người dẫn, tối đa mỗi 5 phút.
   * Phần đã làm sẵn tiếng vẫn phát; câu trả lời người xem vẫn hiện chữ trên Màn hình người dẫn.
   */
  baoHetLuot(thongDiep) {
    const s = this.s;
    if (!s || Date.now() - (s.lucBaoHetLuot || 0) < 5 * 60 * 1000) return;
    s.lucBaoHetLuot = Date.now();
    this.bao(`${thongDiep} Đội AI chỉ đọc được phần đã làm sẵn tiếng; câu trả lời người xem vẫn hiện chữ để bạn đọc.`, 'do');
  }

  /** Đoạn phải đọc phát dần mà Google hết lượt: đội tạm dừng (không lướt qua các đoạn trong im lặng), người dẫn dẫn tiếp. */
  dungViHetLuot(c) {
    this.baoHetLuot(c.loi);
    this.tamDung('Google hết lượt đọc giọng hôm nay — đội AI tạm dừng, bạn dẫn tiếp');
  }

  /**
   * Nhạc (F-47) thành một lần phát; chưa tạo loại này thì null (bỏ qua). `giay`: cắt cho vừa (nhạc đố vui theo thời
   * gian chờ). Chữ của lần phát là lời hát: lời nhạc hiệu lọt vào micro được nhận là tiếng loa.
   */
  nhacSan(loai, { giay = null } = {}) {
    let x = null;
    try { x = this.nhac?.(loai); } catch { x = null; }
    if (!x?.pcm?.length) return null;
    let pcm = x.pcm;
    if (giay && pcm.length > giay * BYTE_GIAY) pcm = raEmPcm(pcm.subarray(0, Math.round(giay * BYTE_GIAY) & ~1), 1);
    return { loai: `nhạc ${loai}`, nhac: loai, luot: [], chu: x.loi || '', manh: [pcm], pcm, do: pcm.length, sanSang: true, xong: true, loi: null, tao: Date.now() };
  }

  /** Phần đã làm sẵn (WAV trong kho) thành một lần phát. */
  phanSan(loai, id, luot) {
    const wav = this.phongThu.docTep(id);
    const pcm = wav ? tts.tachWav(wav).pcm : Buffer.alloc(0);
    return { loai, luot, chu: luot.map((l) => l.loi).join(' '), manh: [pcm], pcm, do: pcm.length, sanSang: true, xong: true, loi: wav ? null : 'Tệp tiếng đã mất' };
  }

  /**
   * Câu mẫu (F-48): chọn luân phiên, thay {chinh}, {ai}, {ten}, {ten_shop}; bán hàng thêm {mon}, {so}, {so_mau}; Radio thêm {gio}, {bai}, {loi}. Thay một lượt:
   * chữ người xem viết (lời chúc) có "{…}" cũng không bị thay tiếp.
   */
  cauMauLuot(khoa, them = {}) {
    const s = this.s;
    const ds = this.cauMau[khoa];
    if (!Array.isArray(ds) || !ds.length) return [];
    s.xoay[khoa] = ((s.xoay[khoa] ?? -1) + 1) % ds.length;
    const nv = doiAi.nhanVat();
    const chinh = nv[0].ten;
    const khac = nv.slice(1);
    s.xoay.ai = ((s.xoay.ai ?? -1) + 1) % Math.max(1, khac.length);
    const ai = (khac[s.xoay.ai] || nv[0]).ten;
    const bien = { ten: '', ten_shop: require('../nghiep-vu/cai-dat').tenShop(), ...them, chinh, ai };
    const thay = (x) => String(x).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(bien, k) ? String(bien[k]) : m));
    return ds[s.xoay[khoa]].map(([nguoi, loi]) => ({ ai: thay(nguoi), cachNoi: '', loi: thay(loi) }));
  }

  /* ---------------- Radio {ten_shop} (#74, F-49, F-50) ---------------- */

  /** Câu báo giờ (phát dần). `luc`: giờ lúc câu được đọc (sau bài hát: lúc bài hát xong). */
  taoBaoGio(khoa, { luc = Date.now(), uuTien = false } = {}) {
    const luot = this.cauMauLuot(khoa, { gio: gioNoi(luc) });
    return luot.length ? this.taoChen('báo giờ', luot, { uuTien }) : null;
  }

  /** Bài hát kế tiếp (xoay vòng, bắt đầu từ bài ngẫu nhiên): { id, ten, pcm, loi } hoặc null khi chưa có bài nào. */
  chonBai() {
    const s = this.s;
    let ds = [];
    try { ds = this.khoBai?.ds() || []; } catch { ds = []; }
    for (let lan = 0; lan < ds.length; lan += 1) {
      s.xoay.bai = s.xoay.bai === undefined ? Math.floor(Math.random() * ds.length) : (s.xoay.bai + 1) % ds.length;
      const b = ds[s.xoay.bai];
      let x = null;
      try { x = this.khoBai.doc(b.id); } catch { x = null; }
      if (x?.pcm?.length) return { ...b, ...x };
    }
    return null;
  }

  /** Bài hát thành một lần phát (như nhạc: DỪNG AI tắt được, lời hát lọt vào micro nhận là tiếng loa). */
  phanBai(b) {
    return { loai: 'bài hát', nhac: 'bai_hat', bai: b.ten, luot: [], chu: b.loi || '', manh: [b.pcm], pcm: b.pcm, do: b.pcm.length, sanSang: true, xong: true, loi: null, tao: Date.now() };
  }

  /**
   * Tối đa 3 lời chúc cũ nhất chưa đọc (F-50): Director gắn nhãn `loi_chuc`, không ẩn, không nhãn xấu, qua lọc quy tắc.
   * @returns {{ten:string, loi:string}[]}
   */
  layLoiChuc() {
    const s = this.s;
    const ds = [];
    for (const b of live.binhLuanGanDay(s.phienId, 200).reverse()) {
      if (s.daDocChuc.has(b.id) || !b.nhan.includes('loi_chuc')) continue;
      s.daDocChuc.add(b.id);
      s.daChao.add(b.id); // vừa được đọc lời chúc thì không chào "vừa vào live" nữa (buổi tập 24/9/2026)
      if (b.da_an || b.nhan.some((n) => NHAN_KHONG_CHAO.includes(n))) continue;
      const loi = lamSachLoiChuc(b.noi_dung);
      const ten = tenGoi(b.ten);
      if (!loi || !ten) continue;
      ds.push({ ten, loi });
      if (ds.length >= 3) break;
    }
    return ds;
  }

  /** Câu đọc lời chúc và giới thiệu bài (phát dần), hoặc null khi không có lời chúc và không có bài hát. */
  taoLoiNhanGui(bai) {
    const chuc = this.layLoiChuc();
    const luot = chuc.flatMap((c) => this.cauMauLuot('doc_loi_chuc', { ten: c.ten, loi: c.loi }));
    const ten = chuc.map((c) => `bạn ${c.ten}`).join(', ');
    if (bai) luot.push(...this.cauMauLuot(chuc.length ? 'gioi_thieu_bai' : 'moi_bai_hat', { ten, bai: bai.ten }));
    else if (chuc.length) luot.push(...this.cauMauLuot('cam_on_loi_chuc', { ten }));
    return luot.length ? this.taoChen('lời nhắn gửi', luot) : null;
  }

  /** Phát lần lượt các phần (bỏ phần null; phần là hàm thì gọi lúc tới lượt), hết thì gọi `khiHet`. */
  phatChuoi(ds, khiHet) {
    const s = this.s;
    const [dau, ...con] = ds;
    if (!s) return;
    if (dau === undefined) {
      khiHet();
      return;
    }
    const c = typeof dau === 'function' ? dau() : dau;
    if (!c) {
      this.phatChuoi(con, khiHet);
      return;
    }
    this.batDauPhat(c, () => { if (this.s === s) this.phatChuoi(con, khiHet); });
  }

  /**
   * Đoạn Lời nhắn gửi (F-50): phần mời → lời chúc + giới thiệu bài → bài hát → báo giờ → phần quay lại → đoạn sau.
   * Lời chúc chọn và làm tiếng ngay lúc bắt đầu phần mời, để tới lượt là có tiếng.
   * `san`: hai phần đọc phát dần ({ moi, quayLai }) khi chưa có tiếng làm sẵn (phatDanDoan).
   */
  phatLoiNhanGui(kq, san = null) {
    const s = this.s;
    s.vuaNhac = false;
    s.daMoMan = true;
    s.chenLienTiep = 0;
    const bai = this.chonBai();
    let moi = san?.moi || null;
    let quayLai = san?.quayLai || null;
    if (!san) {
      const { coTruoc, coSau } = kq.baiHat;
      moi = coTruoc ? this.phanSan('đoạn', kq.phan[0].id, kq.luotTruoc) : null;
      quayLai = coSau ? this.phanSan('đoạn', kq.phan[coTruoc ? 1 : 0].id, kq.luotSau) : null;
    }
    const loiNhan = this.taoLoiNhanGui(bai);
    // Câu báo giờ làm tiếng ngay khi bài hát bắt đầu, với giờ lúc bài hát xong — hết bài là đọc liền, không im chờ
    // Google. Bài bị ngừng sớm ("Mai ơi"), tạm dừng lâu thì giờ đã lệch: làm câu mới lúc tới lượt.
    let baoGio = null;
    this.phatChuoi([
      moi,
      loiNhan,
      bai && (() => {
        const xong = Date.now() + (bai.pcm.length / BYTE_GIAY) * 1000;
        baoGio = { c: this.taoBaoGio('bao_gio_ngan', { luc: xong }), xong };
        return this.phanBai(bai);
      }),
      bai && (() => (baoGio && Math.abs(Date.now() - baoGio.xong) < 30000 ? baoGio.c : this.taoBaoGio('bao_gio_ngan'))),
      quayLai,
    ], () => {
      // Hai phần đọc phát dần mà Google hết lượt: bài hát vẫn phát, xong thì đội tạm dừng thay vì lướt các đoạn sau.
      const hong = [moi, quayLai].find((x) => x?.hetLuot && !x.do);
      if (hong) this.dungViHetLuot(hong);
      else this.sangDoan();
    });
  }

  /* ---------------- phát ---------------- */

  batDauPhat(c, khiXong = null) {
    const s = this.s;
    s.dang = { c, viTri: 0, phatDen: Date.now(), khiXong };
    // F-80 (#108): lời Đội AI vào nhật ký buổi live.
    const nk = require('../nghiep-vu/nhat-ky-song');
    for (const l of c.luot || []) if (l.loi) nk.ghi({ phienId: s.phienId, loai: 'doi_ai', noiDung: `${l.ai}: ${l.loi}` });
    // F-109: đội vừa đọc câu có "trợ lý AI" (mở màn, người mới vào, báo giờ, câu tự nhận) → bộ hẹn giờ tự nhận tính từ lúc này.
    if ((c.luot || []).some((l) => /trợ lý AI/i.test(l.loi || ''))) s.lucTuNhan = Date.now();
    if (c.bai?.ten) nk.ghi({ phienId: s.phienId, loai: 'su_kien', noiDung: `Phát bài hát: ${c.bai.ten}` });
    s.chuVua = c.chu;
    this.phat('live.doi_noi', {
      phien_id: s.phienId, luot: c.luot.map((l) => ({ ai: l.ai, loi: l.loi })), ...(c.nhac ? { nhac: c.nhac } : {}), ...(c.bai ? { bai: c.bai } : {}),
    });
  }

  /** Đẩy tiếng tới loa, giữ trước tối đa truocMs. Hết tiếng và loa đã phát xong thì xong phần này. */
  bomTieng(bayGio) {
    const d = this.s.dang;
    const c = d.c;
    if (c.pcm.length < c.do) c.pcm = Buffer.concat(c.manh);
    while (d.phatDen - bayGio < this.nhip.truocMs && d.viTri < c.pcm.length) {
      let n = Math.min(this.byteManh, c.pcm.length - d.viTri);
      n -= n % 2;
      if (n <= 0) break;
      this.guiLoa(c.pcm.subarray(d.viTri, d.viTri + n));
      d.viTri += n;
      d.phatDen = Math.max(d.phatDen, bayGio) + (n / BYTE_GIAY) * 1000;
    }
    if (c.xong && d.viTri >= c.do && bayGio >= d.phatDen) this.xongPhat(bayGio);
  }

  xongPhat(bayGio) {
    const s = this.s;
    const d = s.dang;
    s.dang = null;
    s.lucHet = bayGio;
    this.phat('live.doi_noi', { phien_id: s.phienId, luot: [] });
    if (d.c.loi && !d.c.do) {
      if (d.c.hetLuot) this.baoHetLuot(d.c.loi);
      else this.bao(`Đội AI chưa đọc được (${d.c.loi}).`);
    }
    d.khiXong?.();
  }

  /** Người dẫn đang nói: chép lời vừa tới, hoặc âm lượng micro lúc loa đã im (tiếng loa không tính). */
  nguoiDanDangNoi(bayGio) {
    const s = this.s;
    if (bayGio - s.lucNguoiDan < this.nhip.choNguoiDanMs) return true;
    const loaKeu = s.dang ? bayGio < s.dang.phatDen + this.nhip.vongMs : bayGio < s.lucHet + this.nhip.vongMs;
    const st = this.phongAi?.st;
    return !loaKeu && !!st && st.phienId === s.phienId && !!st.nguoiDanNoi;
  }

  /** Mỗi nhịp: đẩy tiếng, hoặc chọn phần tiếp theo ở chỗ nghỉ. */
  nhipDan() {
    const s = this.s;
    if (!s || s.tamDung || !this.coLoa()) return;
    const bayGio = Date.now();
    if (this.nguoiDanDangNoi(bayGio)) return;
    if (s.dang) {
      this.bomTieng(bayGio);
      return;
    }
    if (bayGio < s.lucHet + this.nhip.nghiMs) return;
    this.donHang(bayGio);
    // Chen vào chỗ nghỉ: câu đã có tiếng, theo thứ tự ưu tiên (người dẫn hỏi trước; câu khác tối đa CHEN_LIEN_TIEP).
    const duocChen = s.chenLienTiep < CHEN_LIEN_TIEP;
    const uuTien = s.hang.find((x) => x.uuTien && x.sanSang);
    // Nhạc hiệu (F-47): mở màn — phủ lúc đoạn đầu đang làm tiếng — và đầu vòng mới, trước câu nhắc "đội trợ lý AI".
    if (!uuTien && s.canHieu && !s.hoan && !s.tiepSau && !s.hang.some((x) => x.uuTien) && !s.dangKet) {
      s.canHieu = false;
      // Radio (F-49): nhạc hiệu Radio (chưa có thì nhạc hiệu thường), rồi báo giờ — câu báo giờ làm tiếng ngay từ lúc
      // nhạc hiệu bắt đầu, đứng đầu hàng; chưa có nhạc hiệu nào thì báo giờ luôn.
      if (s.radio) {
        const bg = this.taoBaoGio('bao_gio', { uuTien: true });
        if (bg) s.hang.unshift(bg);
      }
      const n = (s.radio && this.nhacSan('hieu_radio')) || this.nhacSan('hieu');
      if (n) {
        s.vuaNhac = true;
        this.batDauPhat(n);
        return;
      }
    }
    // Đang giữ một đoạn đọc dở (người dẫn gọi "Mai ơi" giữa chừng) thì chỉ chen câu ưu tiên, rồi đọc tiếp đoạn đó.
    const chen = uuTien || (!s.hoan && !s.hang.some((x) => x.uuTien) && duocChen && s.hang.find((x) => x.sanSang));
    if (chen) {
      s.hang = s.hang.filter((x) => x !== chen);
      if (!chen.uuTien) s.chenLienTiep += 1;
      this.batDauPhat(chen, chen.khiXong || null);
      return;
    }
    if (s.hang.some((x) => x.uuTien) || s.dangKet) return; // chờ câu trả lời người dẫn hỏi (câu đệm đã đọc)
    // Bài hát bị ngừng vì người dẫn gọi "Mai ơi" (F-50): trả lời xong thì đi tiếp phần sau bài hát (báo giờ, quay lại).
    if (s.tiepSau) {
      const f = s.tiepSau;
      s.tiepSau = null;
      f();
      return;
    }
    if (s.hoan) {
      const d = s.hoan;
      s.hoan = null;
      d.phatDen = bayGio;
      s.dang = d;
      s.chuVua = d.c.chu;
      this.phat('live.doi_noi', { phien_id: s.phienId, luot: d.c.luot.map((l) => ({ ai: l.ai, loi: l.loi })) });
      return;
    }
    if (s.doVui) {
      if (bayGio < s.doVui.den) return;
      this.dapAnDoVui(bayGio);
      return;
    }
    const ten = duocChen ? this.layTenMoi() : [];
    if (ten.length) {
      const c = this.taoChen('chào tên', this.cauMauLuot('chao_ten', { ten: ten.map((x) => `bạn ${x}`).join(', ') }));
      if (c.luot.length) s.hang.push(c);
      return;
    }
    this.phatDoan(bayGio);
  }

  /** Bỏ câu chen đã quá cũ (trả lời người xem sau 3 phút, câu người dẫn hỏi không có trả lời). */
  donHang(bayGio) {
    const s = this.s;
    s.hang = s.hang.filter((x) => (x.uuTien && !x.sanSang ? bayGio - x.tao < this.nhip.choTraLoiMs : bayGio - x.tao < CAU_HOI_HET_MS));
  }

  phatDoan(bayGio) {
    const s = this.s;
    const ds = s.p.kich_ban.doan;
    const i = s.i;
    const d = ds[i];
    if (!d || (d.san_pham_id && dangBanDoan(d) === false)) return this.sangDoan();
    const x = this.lamSan(i);
    if (x.trangThai === 'dang' || x.trangThai === 'loi') {
      const hong = x.trangThai === 'loi';
      const doi = bayGio - x.tu;
      if ((hong || doi > this.nhip.choDoanMs) && !x.phatDan) x.phatDan = this.phatDanDoan(d) || 'khong';
      if (x.phatDan && x.phatDan !== 'khong' && x.phatDan.sanSang) {
        const c = x.phatDan;
        x.phatDan = null; // quay lại đoạn này mà tiếng làm sẵn vẫn chưa xong thì lại đọc phát dần
        if (hong) {
          this.bao(`Đội AI chưa làm sẵn được tiếng đoạn ${i + 1} (${x.loi}); đọc bằng máy đọc nhanh.`);
          s.lamSan.delete(i); // vòng sau thử làm sẵn lại
        }
        if (c.loiNhan) return this.phatLoiNhanGui(null, c);
        s.vuaNhac = false;
        s.daMoMan = true;
        s.chenLienTiep = 0;
        this.batDauPhat(c, () => (c.hetLuot && !c.do ? this.dungViHetLuot(c) : this.sangDoan()));
        return;
      }
      // Làm sẵn hỏng: chờ câu đọc phát dần có tiếng (1–2 giây); chỉ bỏ đoạn khi không đọc phát dần được (buổi tập
      // 24/9/2026: bỏ luôn đoạn Yuzhan vì câu phát dần chưa kịp có tiếng).
      if (hong && x.phatDan === 'khong') {
        this.bao(`Đội AI bỏ qua đoạn ${i + 1}: ${x.loi}`);
        s.lamSan.delete(i); // vòng sau thử làm lại
        return this.sangDoan();
      }
      if (hong) return; // câu phát dần luôn xong (có tiếng hoặc lỗi) → lần sau phát hoặc đi tiếp
      // Không đọc phát dần được (đố vui): đợi thêm một chút rồi sang đoạn sau, không để sóng im lâu.
      if (doi > (x.phatDan === 'khong' ? 2 * this.nhip.choDoanMs : this.nhip.choLamTiengMs)) {
        this.bao(`Đội AI làm tiếng đoạn ${i + 1} quá lâu, sang đoạn sau.`);
        this.sangDoan();
      }
      return;
    }
    const kq = x.kq;
    if (!kq.phan.length) return this.sangDoan(); // đoạn không có thoại của đội
    // Nhạc chuyển cảnh (F-47) trước mỗi đoạn mới, trừ khi vừa có nhạc (nhạc hiệu mở màn, đầu vòng mới); hết nhạc đọc luôn.
    if (!s.vuaNhac) {
      const n = this.nhacSan('chuyen');
      if (n) {
        s.vuaNhac = true;
        this.batDauPhat(n, () => { if (this.s === s && s.i === i && !s.tamDung) this.phatDoan(Date.now()); });
        return;
      }
    }
    if (kq.baiHat) return this.phatLoiNhanGui(kq); // Radio: đoạn Lời nhắn gửi (F-50)
    s.vuaNhac = false;
    s.daMoMan = true;
    s.chenLienTiep = 0;
    this.batDauPhat(this.phanSan('đoạn', kq.phan[0].id, kq.luotTruoc || kq.luot), () => {
      if (kq.cho && kq.phan[1]) {
        // Đố vui (F-48): chờ người xem bình luận đáp án rồi mới đọc phần đáp; có nhạc đố vui thì phát trong lúc chờ.
        this.s.doVui = { den: Date.now() + kq.cho.giay * 1000, tu: new Date().toISOString(), kq, i };
        this.baoDan(`Chờ bình luận đáp án ${kq.cho.giay} giây`);
        const n = this.nhacSan('do_vui', { giay: kq.cho.giay });
        if (n) this.batDauPhat(n);
      } else this.sangDoan();
    });
  }

  /**
   * Hết giờ chờ đố vui: đọc đáp án, rồi chúc mừng người trả lời đúng ngay sau đó (câu chúc mừng làm tiếng trong lúc
   * đọc đáp án, đứng đầu hàng như câu người dẫn hỏi — buổi tập 24/9/2026 bị đọc sau cả đoạn kế).
   */
  dapAnDoVui() {
    const s = this.s;
    const dv = s.doVui;
    s.doVui = null;
    const dung = this.nguoiTraLoiDung(dv);
    const c = dung.length
      ? this.taoChen('chúc mừng đố vui', this.cauMauLuot('do_vui_dung', { ten: dung.map((x) => `bạn ${x}`).join(', ') }), { uuTien: true })
      : this.taoChen('đố vui chưa ai đúng', this.cauMauLuot('do_vui_chua_ai'), { uuTien: true });
    const luotSau = dv.kq.luotSau || [];
    this.batDauPhat(this.phanSan('đoạn', dv.kq.phan[1].id, luotSau), () => {
      if (c.luot.length && this.s) {
        c.tao = Date.now();
        this.s.hang.unshift(c);
        // Tiếng chúc mừng (F-47) ngay trước lời chúc người trả lời đúng.
        const ting = dung.length ? this.nhacSan('dung') : null;
        if (ting) this.s.hang.unshift({ ...ting, uuTien: true });
      }
      this.sangDoan();
    });
  }

  /** Tên gọi của tối đa 3 người bình luận đúng một đáp án trong lúc chờ (xem coDapAn). */
  nguoiTraLoiDung(dv) {
    const dapAn = (dv.kq.dapAn || []).map(gon).filter(Boolean);
    if (!dapAn.length) return [];
    const ten = [];
    for (const b of live.binhLuanGanDay(this.s.phienId, 200).reverse()) {
      if (b.luc_nhan < dv.tu || b.da_an || b.nhan.some((n) => NHAN_KHONG_CHAO.includes(n))) continue;
      if (!coDapAn(b.noi_dung, dapAn)) continue;
      const g = tenGoi(b.ten);
      if (g && !ten.includes(g)) ten.push(g);
      if (ten.length >= 3) break;
    }
    return ten;
  }

  /** Đoạn sau đoạn `tu`: bỏ đoạn có sản phẩm thôi Đang bán; hết kịch bản thì về đoạn có sản phẩm đầu tiên (vòng mới). */
  doanKe(tu) {
    const ds = this.s.p.kich_ban.doan;
    const dau = Math.max(0, ds.findIndex((x) => x.san_pham_id));
    const conDung = (x) => !x.san_pham_id || dangBanDoan(x) !== false;
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

  /** Sang đoạn sau: ghi dòng thời gian sản phẩm, Màn hình người dẫn chạy theo; đầu vòng mới nhắc "đội trợ lý AI". */
  sangDoan() {
    const s = this.s;
    if (!s) return;
    const k = this.doanKe(s.i);
    if (k.vongMoi) {
      s.vong += 1;
      s.canHieu = true; // nhạc hiệu đầu vòng mới (F-47)
      // Radio (F-49): câu báo giờ sau nhạc hiệu đã có câu "đội trợ lý AI" — không nhắc thêm.
      const c = s.radio ? null : this.taoChen('nhắc đầu vòng', this.cauMauLuot('vong_moi'));
      if (c?.luot.length) s.hang.push(c);
    }
    this.chuyenToi(k.i);
  }

  chuyenToi(i) {
    const s = this.s;
    s.i = i;
    s.doanDaBiet = i;
    try {
      const p = live.doiDoan(s.phienId, i);
      this.phat('live.doan', { phien_id: p.id, doan: i });
    } catch { /* phiên đã xong */ }
    this.lamTruoc(i);
    this.baoDan();
  }

  /** Tên gọi của tối đa 3 người vừa bình luận (tối đa mỗi 2 phút); bỏ bình luận ẩn, spam, lộ thông tin cá nhân. */
  layTenMoi() {
    const s = this.s;
    const bayGio = Date.now();
    if (bayGio - s.lucChao < this.nhip.chaoMoiMs) return [];
    const ten = [];
    for (const b of live.binhLuanGanDay(s.phienId, 30)) {
      if (s.daChao.has(b.id)) continue;
      s.daChao.add(b.id);
      if (b.da_an || b.nhan.some((n) => NHAN_KHONG_CHAO.includes(n))) continue;
      if (s.radio && b.nhan.includes('loi_chuc')) continue; // sẽ được gọi tên khi đọc lời chúc (buổi tập 25/9/2026)
      const g = tenGoi(b.ten);
      if (g && !ten.includes(g) && ten.length < 3) ten.push(g);
    }
    if (ten.length) s.lucChao = bayGio;
    return ten;
  }

  /* ---------------- người dẫn ---------------- */

  /**
   * Chữ chép lời người dẫn là tiếng loa lọt vào micro (trùng lời đội đang đọc) hay người dẫn nói thật. So theo cặp chữ
   * liền nhau: "Mai ơi, Getac lương…" có chữ lẻ trùng lời đội ("Mai ơi", "lương") nhưng cặp chữ thì không — so từng chữ
   * lẻ thì tưởng tiếng vọng, đội đọc chồng lên người dẫn 4–5 giây (buổi tập 24/9/2026).
   * @returns {'vong'|'nguoi'|'chua_ro'}
   */
  phanLoaiLoiNguoiDan(chu) {
    const s = this.s;
    if (!s) return 'nguoi';
    const bayGio = Date.now();
    const vuaDoc = s.dang ? s.dang.c.chu : bayGio - s.lucHet < 2500 ? s.chuVua : '';
    if (!vuaDoc) return 'nguoi';
    const w = tuCua(chu);
    if (w.length < 3) return 'chua_ro';
    const v = tuCua(vuaDoc);
    const cap = new Set();
    for (let i = 1; i < v.length; i += 1) cap.add(`${v[i - 1]} ${v[i]}`);
    let trung = 0;
    for (let i = 1; i < w.length; i += 1) if (cap.has(`${w[i - 1]} ${w[i]}`)) trung += 1;
    return trung / (w.length - 1) >= 0.6 ? 'vong' : 'nguoi';
  }

  /**
   * Lùi chỗ đọc về chỗ người nghe đã nghe tới (bỏ tiếng đang chờ ở trình duyệt) thêm luiMs, rồi về chỗ ngắt câu gần nhất
   * phía trước (lặng ≥ 160 ms, tối đa 4 giây) — đọc tiếp từ đầu câu, không bắt đầu giữa câu nghe "gãy khúc" (buổi tập
   * 24/9/2026). `luon`: lùi cả khi trình duyệt đã phát hết (DỪNG AI).
   */
  luiLai(d, bayGio, { luon = false } = {}) {
    if (d.phatDen <= bayGio && !luon) return false;
    let lui = Math.round(((Math.max(0, d.phatDen - bayGio) + this.nhip.luiMs) / 1000) * BYTE_GIAY);
    lui -= lui % 2;
    d.viTri = Math.max(0, d.viTri - lui);
    if (!d.c.nhac) d.viTri = diemNgatTruoc(d.c.pcm, d.viTri);
    d.phatDen = bayGio;
    return true;
  }

  /** Người dẫn vừa nói (chép lời không phải tiếng vọng): đang đọc thì tạm ngừng, bỏ tiếng đang chờ, lùi lại. */
  nguoiDanNoi() {
    const s = this.s;
    if (!s) return;
    const bayGio = Date.now();
    s.lucNguoiDan = bayGio;
    if (s.dang && this.luiLai(s.dang, bayGio)) this.phat('live.mai_ngat', { phien_id: s.phienId, ly_do: 'Người dẫn nói xen' });
  }

  /** Câu người dẫn vừa nói (đã chốt): chào kết → đội chào rồi thôi dẫn. */
  nguoiDanNoiXong(chu) {
    const s = this.s;
    if (!s) return;
    s.lucNguoiDan = Date.now();
    if (CHAO_KET.test(boDau(chu))) this.chaoKet();
  }

  /**
   * Người dẫn gọi "Mai ơi…". Hỏi bằng giọng (chép lời — người xem đã nghe câu hỏi): đang đọc dở một đoạn thì ngừng ngay
   * (giữ lại để đọc tiếp), nhân vật khác nói câu đệm, chỗ chờ câu trả lời. Hỏi bằng chữ (ô Hỏi Mai): không ngừng, không
   * câu đệm — câu trả lời đọc ở chỗ nghỉ kế tiếp (traLoi).
   */
  coNguoiDanHoi(phienId, { tuGiong = true } = {}) {
    const s = this.s;
    if (!s || s.phienId !== phienId || !tuGiong) return;
    const bayGio = Date.now();
    s.lucNguoiDan = Math.max(s.lucNguoiDan, bayGio - this.nhip.choNguoiDanMs); // hỏi xong là đệm được ngay
    const d = s.dang;
    if (d && !d.c.nhac) {
      this.luiLai(d, bayGio);
      s.hoan = d;
      s.dang = null;
      this.phat('live.mai_ngat', { phien_id: s.phienId, ly_do: 'Người dẫn gọi Mai' });
    } else if (d && d.c.bai) {
      // Đang phát bài hát (F-50): ngừng bài (không phát lại), trả lời xong thì báo giờ và đọc phần quay lại.
      s.dang = null;
      s.tiepSau = d.khiXong || (() => {});
      this.phat('live.mai_ngat', { phien_id: s.phienId, ly_do: 'Người dẫn gọi Mai' });
    }
    const dem = this.taoChen('câu đệm', this.cauMauLuot('cau_dem'), { uuTien: true });
    const cho = { loai: 'trả lời người dẫn', luot: [], chu: '', uuTien: true, sanSang: false, tao: bayGio, cho: true };
    s.hang = [dem, cho, ...s.hang.filter((x) => !x.uuTien)];
  }

  /** Co-host không soạn được câu người dẫn hỏi bằng giọng: bỏ chỗ chờ, nhân vật chính hẹn kiểm lại thay vì im. */
  khongTraLoiDuoc(phienId) {
    const s = this.s;
    if (!s || s.phienId !== phienId || !s.hang.some((x) => x.cho)) return;
    s.hang = s.hang.filter((x) => !x.cho);
    const c = this.taoChen('chưa trả lời được', this.cauMauLuot('chua_tra_loi'), { uuTien: true });
    if (c.luot.length) s.hang.unshift(c);
  }

  /** Câu người dẫn hỏi không giao được Co-host (không rõ món, Co-host đang bận): bỏ chỗ chờ câu trả lời. */
  huyCho(phienId) {
    const s = this.s;
    if (s && s.phienId === phienId) s.hang = s.hang.filter((x) => !x.cho);
  }

  /**
   * Câu trả lời Co-host soạn (đã qua Bộ kiểm tra). Người dẫn hỏi → nhân vật chính đọc (thay chỗ chờ);
   * người xem hỏi → một nhân vật khác đọc câu hỏi kèm tên người hỏi, nhân vật chính trả lời.
   * @param {{phienId:string, cauHoi:string, cau:string, ten?:string|null, tuNguoiDan?:boolean}} o
   */
  traLoi({ phienId, cauHoi, cau, ten = null, tuNguoiDan = false }) {
    const s = this.s;
    if (!s || s.phienId !== phienId || s.dangKet) return false;
    const nv = doiAi.nhanVat();
    const chinh = nv[0].ten;
    if (tuNguoiDan) {
      const c = this.taoChen('trả lời người dẫn', [{ ai: chinh, cachNoi: 'thân tình, rõ ràng', loi: cau }], { uuTien: true });
      const i = s.hang.findIndex((x) => x.cho);
      if (i >= 0) s.hang[i] = c;
      else s.hang.unshift(c);
      return true;
    }
    s.xoay.hoi = ((s.xoay.hoi ?? -1) + 1) % Math.max(1, nv.length - 1);
    const nguoiHoi = (nv.slice(1)[s.xoay.hoi] || nv[0]).ten;
    const g = ten ? tenGoi(ten) : '';
    const cauHoiGon = String(cauHoi || '').trim().replace(/[?？]*$/, '?');
    const c = this.taoChen('trả lời người xem', [
      { ai: nguoiHoi, cachNoi: 'vui, gần gũi', loi: `${g ? `Bạn ${g} hỏi` : 'Có bạn hỏi'}: ${cauHoiGon} ${chinh} ơi!` },
      { ai: chinh, cachNoi: 'thân tình, rõ ràng', loi: cau },
    ]);
    if (c.boQua) return false;
    s.hang = [...s.hang.filter((x) => x.uuTien), ...s.hang.filter((x) => !x.uuTien), c].slice(-HANG_TOI_DA);
    return true;
  }

  /**
   * Câu chen bán hàng (F-46): `vua_chot` ({ten}, {mon}), `vua_het` ({mon}), `con_it` ({mon}, {so} — số lấy từ tồn lúc đọc),
   * `nhac_cach_chot` ({vi_du}, {so_mau}), `mo_tin_nhan` ({ten} — F-70). Câu mẫu do máy điền từ dữ liệu, không qua AI (mục 5). Ưu tiên sau câu trả lời "Mai ơi" và
   * chúc mừng đố vui, trước trả lời người xem và chào tên; câu vừa chốt gom tên (tối đa 3), tính một câu.
   * @returns {boolean} đã xếp vào hàng
   */
  chenBanHang(phienId, khoa, bien = {}) {
    const s = this.s;
    if (!s || s.phienId !== phienId || s.dangKet) return false;
    const luot = this.cauMauLuot(khoa, bien);
    if (!luot.length) return false;
    // Mỗi khóa một nhãn riêng (F-67): trước đây khóa lạ bị gán nhãn 'nhắc cách chốt' rồi đè mất câu nhắc cách chốt.
    const c = this.taoChen(NHAN_BAN_HANG[khoa] || khoa, luot);
    if (c.boQua) return false;
    c.banHang = true;
    // Đứng sau các câu ưu tiên (trả lời người dẫn, chúc mừng), trước câu thường; một câu bán hàng cùng loại thì thay câu cũ.
    const cu = s.hang.findIndex((x) => x.banHang && x.loai === c.loai && !x.dangPhat);
    if (cu >= 0) s.hang.splice(cu, 1);
    const i = s.hang.findIndex((x) => !x.uuTien);
    if (i < 0) s.hang.push(c);
    else s.hang.splice(i, 0, c);
    s.hang = s.hang.slice(0, HANG_TOI_DA);
    return true;
  }

  /** Người dẫn chào kết: dừng phần đang đọc, đội chào tạm biệt rồi thôi dẫn. */
  chaoKet() {
    const s = this.s;
    if (!s || s.dangKet) return;
    // F-83: dòng cảm ơn người chốt trên Thanh chữ + câu cảm ơn (≤ 5 tên) trước câu chào kết.
    let camOn = null;
    try { camOn = require('../dich-vu').dichVu().manHinh?.camOn(s.phienId); } catch { camOn = null; }
    s.dangKet = true;
    s.hang = [];
    s.doVui = null;
    s.hoan = null;
    s.tiepSau = null;
    if (s.dang) {
      s.dang = null;
      this.phat('live.mai_ngat', { phien_id: s.phienId, ly_do: 'Người dẫn chào kết' });
    }
    const c = this.taoChen('chào kết', this.cauMauLuot('chao_ket'), { uuTien: true });
    c.khiXong = () => this.tamDung('Người dẫn chào kết');
    s.hang = [c];
    if (camOn?.ten?.length) {
      const luot = this.cauMauLuot('cam_on_cuoi', { ten: camOn.ten.slice(0, 5).join(', ') });
      if (luot.length) s.hang.unshift(this.taoChen('cảm ơn', luot, { uuTien: true }));
    }
  }

  /** Người dẫn bấm ← →: dừng phần đang đọc, đội đọc luôn đoạn được chọn. */
  nguoiDanChuyenDoan(i) {
    const s = this.s;
    s.doanDaBiet = i;
    s.i = i;
    s.doVui = null;
    s.hoan = null;
    s.tiepSau = null;
    if (s.dang) {
      s.dang = null;
      this.phat('live.mai_ngat', { phien_id: s.phienId, ly_do: 'Người dẫn chuyển đoạn' });
      this.phat('live.doi_noi', { phien_id: s.phienId, luot: [] });
    }
    this.lamTruoc(i);
    this.baoDan();
  }

  /** DỪNG AI: tắt tiếng ngay, đội thôi dẫn; "▶ Dẫn tiếp" đọc tiếp từ chỗ dừng. */
  dungAi(phienId) {
    const s = this.s;
    if (!s || s.phienId !== phienId) return;
    if (s.dang) this.luiLai(s.dang, Date.now(), { luon: true });
    this.phat('live.mai_ngat', { phien_id: phienId, ly_do: 'DỪNG AI' });
    this.tamDung('Người dẫn bấm DỪNG AI');
  }

  tamDung(lyDo) {
    const s = this.s;
    if (!s) return;
    s.tamDung = true;
    s.dangKet = false;
    // Bỏ chỗ chờ và câu đệm đang chờ đọc ("… trả lời liền đi!" mà không còn câu trả lời thì vô duyên).
    s.hang = s.hang.filter((x) => !x.cho && x.loai !== 'câu đệm');
    this.baoDan(lyDo);
  }

  /** "▶ Dẫn tiếp" (POST /live/phien/:id/mai-dan-tiep ở phiên Đội AI dẫn). */
  danTiep(phienId) {
    const s = this.s;
    if (!s || s.phienId !== phienId) {
      throw new LoiNghiepVu('KHONG_CO_LIVE', 'Đội AI chưa dẫn phiên này (chưa bắt đầu live, hoặc chưa chọn "Đội AI dẫn").', 409);
    }
    s.tamDung = false;
    s.lucNguoiDan = 0;
    this.baoDan();
  }

  dangPhat(phienId) {
    return !!this.s && this.s.phienId === phienId && !!this.s.dang;
  }

  /**
   * Loa đang kêu thật (hoặc vừa dứt chưa quá vongMs): đội đang đọc mà bị người dẫn nói xen thì đã ngừng, tiếng người
   * dẫn lúc đó không thể là tiếng loa vọng lại — câu ngắn như "Mai ơi." phải tính là người dẫn.
   */
  loaDangKeu(phienId) {
    const s = this.s;
    if (!s || s.phienId !== phienId) return false;
    const bayGio = Date.now();
    return s.dang ? bayGio < s.dang.phatDen + this.nhip.vongMs : bayGio < s.lucHet + this.nhip.vongMs;
  }

  trangThai(phienId) {
    const s = this.s;
    if (!s || s.phienId !== phienId) return { trang_thai: 'tat' };
    return {
      trang_thai: s.tamDung ? 'tam_dung' : 'dang_dan', vong: s.vong, doan: s.i, dang_doc: !!s.dang,
      dang_noi: s.dang ? s.dang.c.luot.map((l) => ({ ai: l.ai, loi: l.loi })) : [], // Màn hình người dẫn mở giữa chừng
      dang_nhac: s.dang?.c.nhac || null,
      dang_bai: s.dang?.c.bai || null, // tên bài hát Radio đang phát (F-50)
      radio: s.radio,
    };
  }
}

module.exports = { DoiAiDan, NHIP, diemNgatTruoc, gioNoi, lamSachLoiChuc };
