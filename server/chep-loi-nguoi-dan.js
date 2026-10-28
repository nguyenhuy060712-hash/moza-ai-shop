'use strict';

/**
 * Chép lời người dẫn ở chế độ "Chỉ gợi ý" (SPEC.md F-21, #33).
 *
 *  - Màn hình người dẫn bật micro → gửi tiếng PCM 16 kHz qua /ws → dịch vụ chép lời trực tiếp
 *    (Gemini 3.5 Transcribe Live; lỗi thì GPT Live Transcribe).
 *  - "Người dẫn đang nói" do trình duyệt tính từ âm lượng micro, báo lên đây → phòng live AI
 *    (không giao Co-host khi người dẫn đang nói).
 *  - Câu chốt có "Mai ơi, …" → câu hỏi đi thẳng tới Mai như ô Hỏi Mai. Câu chốt khác → Director biết
 *    người dẫn vừa nói gì. Lời người dẫn KHÔNG lưu vào cơ sở dữ liệu.
 *  - Phiên chép lời tối đa 10 phút: tự nối phiên mới trước mốc đó. Lỗi → nhà dự phòng; hỏng hết → báo nhỏ,
 *    live vẫn chạy, 30 giây sau thử lại.
 *  - Chi phí tính theo số giây tiếng đã gửi, ghi vào nhật ký như một lần chạy AI và tính vào mức trần.
 *  - Chế độ "Co-host được nói" (M4, F-22): miệng của Mai nghe thẳng micro và tự chép lời người dẫn, nên khi miệng mở
 *    thì dịch vụ chép lời nghỉ, tiếng micro chuyển cho miệng (nhuong); miệng đóng thì chép lời chạy lại (layLai).
 *  - Đội AI dẫn (bản 2.9, F-46): chữ chép lời trùng lời đội AI đang đọc (tiếng loa lọt vào micro) bị bỏ — không hiện,
 *    không đưa Director, không tính "Mai ơi". Chữ của người dẫn thật báo đội tạm ngừng (nói xen).
 */

const live = require('./nghiep-vu/live');
const sp = require('./nghiep-vu/san-pham');
const caiDat = require('./nghiep-vu/cai-dat');
const chiPhi = require('./nghiep-vu/chi-phi');
const nhatKy = require('./nghiep-vu/nhat-ky');
const { boDau, LoiNghiepVu } = require('./nghiep-vu/chung');
const { NHA_CHEP_LOI } = require('./agent/nha-cung-cap/chep-loi');
const { anKhoa } = require('./khoa');

const XOAY_MS = 9.5 * 60 * 1000; // nối phiên mới trước giới hạn 10 phút của Gemini
const THU_LAI_MS = 30 * 1000;
const CHO_CAU_HOI_MS = 8000; // nói "Mai ơi" rồi ngừng: câu chốt kế tiếp trong 8 giây là câu hỏi
const BO_VONG_GOI_MS = 4000; // Đội AI dẫn: "Mai ơi." vừa bị tưởng tiếng vọng, câu người dẫn tới trong 4 giây là câu hỏi
const MAU_100MS = 3200; // 100 ms tiếng PCM 16 kHz 16-bit — cỡ mẩu micro thật gửi lên (F-21)

const ngu = (ms) => new Promise((ok) => setTimeout(ok, ms));

// "Mai ơi", "Mai à", "này Mai ơi"… trên chữ bỏ dấu. Không bắt "ngày mai à", "sáng mai ơi".
const GOI_MAI = /(?<!(?:ngay|sang|chieu|toi|trua|dem|hom|mot|mo)\s)(?<!\p{L})mai\s*(?:oi+|a)(?!\p{L})/u;

/**
 * Tách câu hỏi sau lời gọi "Mai ơi". Trả { goi: false } nếu không gọi Mai.
 * boDau giữ nguyên độ dài chữ đã chuẩn NFC (chữ Việt đều là một ký tự), nên vị trí dùng lại được trên câu gốc.
 */
function tachLoiGoiMai(chu) {
  const goc = String(chu ?? '').normalize('NFC');
  const m = GOI_MAI.exec(boDau(goc));
  if (!m) return { goi: false };
  const cauHoi = goc.slice(m.index + m[0].length).replace(/^[\s,.!?:;…-]+/u, '').trim();
  return { goi: true, cauHoi };
}

class ChepLoiNguoiDan {
  /**
   * @param {object} o
   * @param {Function} o.phat
   * @param {object} o.phongAi   phong-ai.js: nhận "người dẫn đang nói", lời người dẫn, câu hỏi Mai
   * @param {object} [o.nhaChepLoi]  thay dịch vụ chép lời (test)
   * @param {number} [o.xoayMs]
   * @param {number} [o.thuLaiMs]
   * @param {string[]} [o.thuTuNha] nhà thử trước → sau. 8/10/2026: chủ dự án chuyển hết sang OpenAI (khóa Gemini bị Google chặn).
   */
  constructor({ phat, phongAi, nhaChepLoi = NHA_CHEP_LOI, xoayMs = XOAY_MS, thuLaiMs = THU_LAI_MS, thuTuNha = ['openai', 'gemini'] }) {
    Object.assign(this, { phat, phongAi, nhaChepLoi, xoayMs, thuLaiMs, thuTuNha });
    this.ws = null;
    this.phienId = null;
    this.phien = null; // phiên chép lời đang dùng
    this.choCauHoiTu = 0;
    this.nhuongCho = null; // miệng đang mở: tiếng micro đi vào đây thay cho dịch vụ chép lời
    this.doiAi = null; // Đội AI dẫn (bản 2.9, dich-vu.js gắn vào)
  }

  /**
   * Ở phiên Đội AI dẫn: chữ chép lời là tiếng loa của đội lọt vào micro ('vong') hay người dẫn nói thật ('nguoi').
   * Chữ còn ngắn quá chưa rõ thì coi là tiếng vọng chỉ khi loa đang kêu thật (đội đã ngừng vì người dẫn nói xen thì
   * không phải).
   */
  phanLoaiDoi(chu) {
    const d = this.doiAi;
    if (!d || d.s?.phienId !== this.phienId) return 'nguoi';
    const k = d.phanLoaiLoiNguoiDan(chu);
    if (k !== 'chua_ro') return k;
    return (d.loaDangKeu ? d.loaDangKeu(this.phienId) : d.dangPhat(this.phienId)) ? 'vong' : 'nguoi';
  }

  khiTam(chu) {
    const k = this.phanLoaiDoi(chu);
    if (k === 'vong') return;
    this.doiAi?.nguoiDanNoi();
    this.phat('live.loi_nguoi_dan', { phien_id: this.phienId, chu, tam: true });
  }

  /* ---------------- tin trình duyệt gửi lên ---------------- */

  nhan(ws, duLieu, laNhiPhan) {
    if (laNhiPhan) {
      if (ws !== this.ws) return;
      // Người dẫn giả đang nói (Phòng diễn tập): tạm bỏ tiếng micro thật cho khỏi lẫn hai nguồn.
      if (this.dangPhatGia) return;
      if (this.nhuongCho) this.nhuongCho(Buffer.from(duLieu));
      else this.phien?.guiAm(Buffer.from(duLieu));
      return;
    }
    let m;
    try { m = JSON.parse(duLieu.toString()); } catch { return; }
    if (m.type === 'mic.bat') this.bat(ws, m.phien_id);
    else if (m.type === 'mic.tat' && ws === this.ws) this.tat('Người dẫn tắt micro');
    else if (m.type === 'nguoi_dan_noi' && ws === this.ws) this.nguoiDanNoi(!!m.bat);
  }

  dong(ws) {
    if (ws === this.ws) this.tat('Màn hình người dẫn đã đóng');
  }

  baoTrangThai(trangThai, them = {}) {
    this.phat('live.chep_loi', { phien_id: this.phienId, trang_thai: trangThai, nha: this.phien?.nha ?? null, ...them });
  }

  /* ---------------- bật / tắt ---------------- */

  async bat(ws, phienId) {
    let p;
    try { p = live.layPhien(phienId); } catch { p = null; }
    const tuChoi = !p || p.trang_thai !== 'dang_live' ? 'Chưa có buổi live đang chạy.'
      : p.che_do_ai === 'tat' ? 'Phiên này chọn "Tắt AI": không chép lời.'
        : caiDat.khanCap() ? '"Dừng mọi thứ" đang bật: không chép lời.'
          : caiDat.dungAi().bat ? 'AI tạm dừng vì chạm trần chi phí: không chép lời.' : null;
    if (tuChoi) {
      ws.send(JSON.stringify({ type: 'live.chep_loi', phien_id: phienId, trang_thai: 'tu_choi', ly_do: tuChoi }));
      return;
    }
    // Một người dẫn một lúc: màn hình mới bật micro thì màn hình cũ thôi.
    if (this.ws && this.ws !== ws) this.tat('Micro đã bật ở màn hình khác');
    this.ws = ws;
    this.phienId = phienId;
    this.tuRieng = this.tuRiengCua(p);
    if (this.nhuongCho) {
      this.baoTrangThai('dang_nghe', { nha: 'mieng' });
      return;
    }
    await this.moPhien();
  }

  /** Miệng của Mai vừa mở: micro chuyển cho miệng, dịch vụ chép lời nghỉ (tính tiền phần đã dùng). */
  nhuong(guiAm) {
    this.nhuongCho = guiAm;
    clearTimeout(this.henXoay);
    clearTimeout(this.henThuLai);
    const phien = this.phien;
    this.phien = null;
    if (phien) this.dongVaTinhTien(phien);
    if (this.ws) this.baoTrangThai('dang_nghe', { nha: 'mieng' });
  }

  /** Miệng đóng: micro về lại dịch vụ chép lời (nếu người dẫn đang bật micro). */
  layLai() {
    if (!this.nhuongCho) return;
    this.nhuongCho = null;
    if (this.ws) {
      this.baoTrangThai('dang_mo');
      this.moPhien();
    }
  }

  /** Từ riêng giúp máy nghe đúng: tên AI, tên shop, tên và tên gọi khác của các món trong kịch bản. */
  /** F-87: ≤ 100 từ riêng theo ưu tiên (nghiep-vu/tu-rieng.js). */
  tuRiengCua(p) {
    return require('./nghiep-vu/tu-rieng').tuRiengCua(p);
  }

  /** Mở phiên chép lời: thử nhà chính rồi nhà dự phòng. Hỏng hết thì báo và hẹn thử lại. */
  async moPhien(truTu = null) {
    clearTimeout(this.henThuLai);
    if (this.nhuongCho) return;
    const thuTu = this.thuTuNha.filter((n) => n !== truTu).concat(truTu ? [truTu] : []);
    for (const nha of thuTu) {
      if (!this.ws) return;
      const phien = this.taoPhien(nha);
      try {
        await phien.mo();
      } catch (e) {
        console.error(`  [chép lời] ${nha} không mở được: ${anKhoa(e.message)}`);
        continue;
      }
      if (!this.ws || this.nhuongCho) { phien.dong(); return; }
      this.doiPhien(phien);
      return;
    }
    this.baoTrangThai('loi', { ly_do: 'Chép lời đang lỗi; live vẫn chạy, chỉ chưa gọi Mai bằng giọng được. MOZA tự thử lại sau 30 giây.' });
    this.henThuLai = setTimeout(() => this.moPhien(), this.thuLaiMs);
  }

  taoPhien(nha) {
    const phien = new this.nhaChepLoi[nha]({
      tuRieng: this.tuRieng,
      khiTam: (chu) => { if (phien === this.phien) this.khiTam(chu); },
      khiXong: (chu) => { if (phien === this.phien) this.khiXong(chu); },
      khiLoi: (e) => this.phienHong(phien, e),
      khiDong: () => this.phienHong(phien, null),
    });
    phien.batDau = Date.now();
    return phien;
  }

  /** Đổi sang phiên mới (lúc mở, lúc nối phiên trước mốc 10 phút): mở xong phiên mới mới đóng phiên cũ. */
  doiPhien(moi) {
    const cu = this.phien;
    this.phien = moi;
    if (cu) this.dongVaTinhTien(cu);
    clearTimeout(this.henXoay);
    this.henXoay = setTimeout(() => this.xoay(), this.xoayMs);
    this.baoTrangThai('dang_nghe');
  }

  async xoay() {
    if (!this.ws || !this.phien || this.nhuongCho) return;
    if (caiDat.khanCap()) return this.tat('"Dừng mọi thứ" đang bật');
    if (caiDat.dungAi().bat) return this.tat('AI tạm dừng vì chạm trần chi phí');
    try { const p = live.layPhien(this.phienId); this.tuRieng = this.tuRiengCua(p); } catch { /* giữ danh sách cũ */ }
    const moi = this.taoPhien(this.phien.nha);
    try {
      await moi.mo();
    } catch {
      return this.moPhien();
    }
    if (!this.ws || this.nhuongCho) { moi.dong(); return; }
    this.doiPhien(moi);
  }

  phienHong(phien, e) {
    if (phien !== this.phien || phien.daDong) return;
    if (e) console.error(`  [chép lời] ${phien.nha} lỗi: ${anKhoa(e.message)}`);
    this.phien = null;
    this.dongVaTinhTien(phien);
    if (this.ws) this.moPhien(phien.nha);
  }

  dongVaTinhTien(phien) {
    if (phien.daDong) return;
    phien.daDong = true;
    phien.dong();
    if (!phien.giayAm) return;
    const tien = chiPhi.tinhChiPhiChepLoi(phien.model, phien.giayAm, phien.tokenVao, phien.tokenRa);
    let p = null;
    try { p = live.layPhien(this.phienId); } catch { /* phiên đã mất */ }
    const runId = nhatKy.taoRun({
      agentId: 'chep_loi', kichHoat: `Chép lời người dẫn · ${Math.round(phien.giayAm)} giây tiếng`,
      phienLiveId: this.phienId, dienTap: !!p?.dien_tap,
    });
    nhatKy.xongRun(runId, {
      nha: phien.nha, model: phien.model, tokenVao: phien.tokenVao, tokenRa: phien.tokenRa, chiPhi: tien,
      ketQua: { giay_am: Math.round(phien.giayAm) },
    });
    const canhBao = chiPhi.kiemMucTran();
    if (canhBao) {
      chiPhi.baoVuotTran(this.phat, canhBao);
      this.tat('Vượt mức trần chi phí');
    }
  }

  /** Tắt chép lời. Đang bật thì tính tiền phần đã dùng. */
  tat(lyDo = null) {
    clearTimeout(this.henXoay);
    clearTimeout(this.henThuLai);
    const phien = this.phien;
    this.phien = null;
    this.ws = null;
    if (phien) this.dongVaTinhTien(phien);
    if (this.phienId) {
      try { this.phongAi.datNguoiDanNoi(this.phienId, false); } catch { /* phiên đã xong */ }
      this.baoTrangThai('tat', { ly_do: lyDo });
    }
  }

  /**
   * Phòng diễn tập (bản 2.5, F-39): phát một đoạn tiếng giả vào đường micro như người dẫn đang nói.
   *  - Micro thật đang bật thì chen vào; tiếng micro thật tạm bỏ trong lúc phát.
   *  - Chưa bật thì mở "micro ảo" (không có trình duyệt nào phía sau), phát xong chờ câu chốt rồi tự tắt.
   *  - Tiếng đi đúng nhịp thời gian thực (100 ms một mẩu) như micro thật, để dịch vụ chép lời và miệng của Mai nhận như thật.
   * @param {string} phienId
   * @param {Buffer} pcm16k   PCM 16 kHz một kênh 16-bit
   * @param {{nhipMs?:number, choChotMs?:number}} [o]   test rút ngắn thời gian. Chờ câu chốt 8 giây: dịch vụ chép lời
   *   quá tải thì câu chốt tới trễ, micro ảo tắt sớm là mất câu (buổi tập Đội AI dẫn 24/9/2026).
   */
  async phatTiengGia(phienId, pcm16k, { nhipMs = 100, choChotMs = 8000 } = {}) {
    let ao = null;
    if (!this.ws) {
      ao = { ao: true, lyDo: null, send(s) { try { this.lyDo = JSON.parse(s).ly_do || this.lyDo; } catch { /* bỏ */ } } };
      await this.bat(ao, phienId);
      if (this.ws !== ao) throw new LoiNghiepVu('KHONG_CO_LIVE', ao.lyDo || 'Không mở được micro ảo của Phòng diễn tập.', 409);
    } else if (this.phienId !== phienId) {
      throw new LoiNghiepVu('KHONG_CO_LIVE', 'Micro đang bật cho một phiên live khác.', 409);
    }
    const gui = (manh) => {
      if (this.nhuongCho) this.nhuongCho(manh);
      else this.phien?.guiAm(manh);
    };
    this.dangPhatGia = true;
    this.nguoiDanNoi(true);
    try {
      for (let i = 0; i < pcm16k.length && this.ws; i += MAU_100MS) {
        gui(pcm16k.subarray(i, i + MAU_100MS));
        await ngu(nhipMs);
      }
      // Nửa giây im lặng để dịch vụ chép lời biết người dẫn đã thôi nói và chốt câu.
      const im = Buffer.alloc(MAU_100MS);
      for (let i = 0; i < 8 && this.ws; i += 1) {
        gui(im);
        await ngu(nhipMs);
      }
    } finally {
      this.dangPhatGia = false;
      if (this.ws) this.nguoiDanNoi(false);
    }
    if (ao) {
      await ngu(choChotMs);
      if (this.ws === ao) this.tat('Người dẫn giả nói xong');
    }
  }

  /** Buổi live kết thúc thì thôi chép lời. */
  ketThuc(phienId) {
    if (phienId === this.phienId) this.tat('Buổi live đã kết thúc');
  }

  /* ---------------- lời người dẫn ---------------- */

  nguoiDanNoi(dangNoi) {
    try { this.phongAi.datNguoiDanNoi(this.phienId, dangNoi); } catch { /* phiên đã xong */ }
    // OpenAI không tự nhận biết lượt nói: người dẫn thôi nói thì chốt đoạn.
    if (!dangNoi) this.phien?.chot();
  }

  khiXong(chu) {
    const cau = String(chu).trim();
    if (!cau) return;
    if (this.phanLoaiDoi(cau) === 'vong') {
      // Tiếng đội AI lọt vào micro (bản 2.9). Nhớ lại câu vừa bỏ: "Mai ơi." ngắn lúc loa còn kêu có khi là người dẫn.
      this.boVong = { chu: cau, luc: Date.now() };
      return;
    }
    if (this.doiAi) {
      this.doiAi.nguoiDanNoi();
      this.doiAi.nguoiDanNoiXong(cau);
    }
    this.phat('live.loi_nguoi_dan', { phien_id: this.phienId, chu: cau, tam: false });
    const g = tachLoiGoiMai(cau);
    // "Mai ơi." bị tưởng tiếng vọng mà liền sau đó người dẫn nói tiếp (không gọi Mai lần nữa): câu này là câu hỏi.
    const bo = this.boVong;
    this.boVong = null;
    if (!g.goi && bo && Date.now() - bo.luc < BO_VONG_GOI_MS) {
      const gb = tachLoiGoiMai(bo.chu);
      if (gb.goi && gb.cauHoi.length < 4) this.choCauHoiTu = Date.now();
    }
    let cauHoi = null;
    if (g.goi && g.cauHoi.length >= 4) cauHoi = g.cauHoi;
    else if (g.goi) {
      this.choCauHoiTu = Date.now(); // "Mai ơi…" rồi ngừng: chờ câu kế
      return;
    } else if (this.choCauHoiTu && Date.now() - this.choCauHoiTu < CHO_CAU_HOI_MS) cauHoi = cau;
    if (!cauHoi) {
      this.phongAi.themLoiNguoiDan(this.phienId, cau);
      return;
    }
    this.choCauHoiTu = 0;
    this.phat('live.goi_mai', { phien_id: this.phienId, cau_hoi: cauHoi });
    try {
      const kq = this.phongAi.hoiMai(this.phienId, cauHoi, { tuGiong: true });
      if (kq?.bo_qua) this.phat('live.goi_mai', { phien_id: this.phienId, cau_hoi: cauHoi, ly_do: kq.ly_do });
    } catch (e) {
      this.phat('live.goi_mai', { phien_id: this.phienId, cau_hoi: cauHoi, ly_do: e.message });
    }
  }

  trangThai(phienId) {
    if (phienId !== this.phienId || !this.ws) return { dang_nghe: false, nha: null };
    return this.nhuongCho ? { dang_nghe: true, nha: 'mieng' } : { dang_nghe: !!this.phien, nha: this.phien?.nha ?? null };
  }
}

module.exports = { ChepLoiNguoiDan, tachLoiGoiMai };
