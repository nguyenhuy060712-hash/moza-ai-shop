'use strict';

/**
 * MOZA nhìn qua OBS, gợi ý chuyển món (SPEC.md F-107, P38 — thay F-64 / #82). Tắt mặc định, bật theo từng buổi trên Màn hình
 * người dẫn. Không có SQL, không lưu ảnh (khung hình chỉ nằm trong bộ nhớ, bỏ ngay sau khi hỏi), không nhận diện mặt.
 *  - Nguồn hình: CHỈ nguồn camera trong cảnh "Moza · Phòng live" (không lấy cảnh đang phát, không Thanh chữ / Màn hình sản phẩm —
 *    chúng có tên khách). Buổi tập: Camera giả ("Người dẫn đang cầm: [món]").
 *  - Mỗi 2,5 giây lấy ảnh rất nhỏ 32×18 (BMP) và so khác biệt bằng mã (0 đồng). Hình đổi rồi đứng yên mới lấy ảnh 512 px JPEG hỏi
 *    agent `nhin_mon` (gpt-6-luna, detail low) kèm bảng mẫu ≤ 10 món (trình duyệt ghép, máy chỉ giữ trong bộ nhớ). Tối đa 1 lần / 5 giây,
 *    600 lần / giờ; mỗi lần đổi hình hỏi tối đa 2 lần (lần 2 để xác nhận).
 *  - Chỉ gợi ý khi đủ: có món · số thuộc buổi · khác món đang nói · chắc = cao · 2 lần hỏi liền nhau cùng một số. Ô gợi ý tự ẩn sau
 *    20 giây; "Bỏ qua" → 60 giây không gợi ý lại món đó. MÁY KHÔNG BAO GIỜ TỰ ĐỔI MÓN: người bấm "Chuyển" mới đổi đoạn.
 *  - Dừng khi tắt nút, hết live, "Dừng mọi thứ" / "Dừng AI", vượt mức trần (chi phí đi qua runtime).
 */

const live = require('./nghiep-vu/live');
const caiDat = require('./nghiep-vu/cai-dat');
const { LoiNghiepVu } = require('./nghiep-vu/chung');
const { CANH } = require('./obs');

const MAC_DINH = { chu_ky_giay: 2.5, cach_toi_thieu_giay: 5, toi_da_lan_gio: 600, canh_anh: 512, anh_so: [32, 18], nguong_doi_hinh: 0.12,
  can_lien_tiep: 2, an_goi_y_giay: 20, bo_qua_giay: 60, toi_da_mon: 10 };
const NGUON_MOZA = ['Moza · Màn hình sản phẩm', 'Moza · Thanh chữ'];

/** BMP (24 / 32 bit, không nén) → mảng độ sáng 0–255, hàng trên trước. */
function docBmp(buf) {
  if (buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4d) throw new Error('Ảnh nhỏ không phải BMP');
  const dau = buf.readUInt32LE(10);
  const rong = buf.readInt32LE(18);
  const caoGoc = buf.readInt32LE(22);
  const bit = buf.readUInt16LE(28);
  const cao = Math.abs(caoGoc);
  const bpp = bit / 8;
  if (bpp !== 3 && bpp !== 4) throw new Error(`BMP ${bit} bit chưa hỗ trợ`);
  const hang = Math.ceil((rong * bpp) / 4) * 4;
  const ra = new Uint8Array(rong * cao);
  for (let y = 0; y < cao; y++) {
    const yNguon = caoGoc > 0 ? cao - 1 - y : y;
    for (let x = 0; x < rong; x++) {
      const i = dau + yNguon * hang + x * bpp;
      ra[y * rong + x] = Math.round(0.114 * buf[i] + 0.587 * buf[i + 1] + 0.299 * buf[i + 2]);
    }
  }
  return ra;
}

/** Khác biệt trung bình 0–1 giữa hai ảnh nhỏ cùng cỡ. */
function khacBiet(a, b) {
  if (!a || !b || a.length !== b.length) return 1;
  let t = 0;
  for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]);
  return t / a.length / 255;
}

/** Nguồn camera qua OBS thật. */
class NguonObs {
  constructor(obs) { this.obs = obs; this.ten = null; this.dinhDang = null; }

  /** Nguồn video trong cảnh Phòng live, bỏ nguồn trình duyệt của MOZA. */
  async danhSach() {
    const ds = (await this.obs.yeuCau('GetSceneItemList', { sceneName: CANH.phong })).sceneItems || [];
    return ds.filter((x) => !NGUON_MOZA.includes(x.sourceName) && x.inputKind !== 'browser_source' && !/^text_|image_source|color_source/.test(x.inputKind || ''))
      .map((x) => ({ ten: x.sourceName, loai: x.inputKind || null }));
  }

  async chuanBi() {
    const ds = await this.danhSach();
    const chon = caiDat.doc('obs', {})?.nguon_camera;
    this.ten = (ds.find((x) => x.ten === chon) || ds[0])?.ten || null;
    if (!this.ten) throw new LoiNghiepVu('KHONG_CO_CAMERA', 'Cảnh "Moza · Phòng live" chưa có nguồn camera: thêm camera vào cảnh đó trong OBS.', 409);
    if (NGUON_MOZA.includes(this.ten) || Object.values(CANH).includes(this.ten)) throw new LoiNghiepVu('KHONG_CO_CAMERA', 'Nguồn đã chọn không phải camera.', 409);
    const v = await this.obs.yeuCau('GetVersion');
    const dd = v.supportedImageFormats || [];
    if (!dd.includes('bmp')) throw new LoiNghiepVu('OBS_KHONG_HO_TRO', 'OBS này không chụp được ảnh BMP.', 409);
    this.dinhDang = dd.includes('jpg') ? 'jpg' : dd.includes('jpeg') ? 'jpeg' : 'png';
  }

  async chup(dinhDang, rong, cao, chatLuong = -1) {
    const r = await this.obs.yeuCau('GetSourceScreenshot', { sourceName: this.ten, imageFormat: dinhDang, imageWidth: rong, imageHeight: cao, imageCompressionQuality: chatLuong });
    return Buffer.from(String(r.imageData || '').replace(/^data:[^,]*,/, ''), 'base64');
  }

  async chupNho([r, c]) { return docBmp(await this.chup('bmp', r, c)); }

  async chupLon(canh) {
    const b = await this.chup(this.dinhDang, canh, canh, 70);
    return { mime: this.dinhDang === 'png' ? 'image/png' : 'image/jpeg', base64: b.toString('base64') };
  }
}

/** Camera giả của Phòng diễn tập: người dẫn "đang cầm" món số `so` → ảnh nhỏ theo số, ảnh lớn là ảnh đầu của món. */
class NguonGia {
  constructor() { this.so = null; }

  async chuanBi() {}

  async chupNho([r, c]) {
    const v = this.so == null ? 20 : 40 + ((this.so * 53) % 200);
    return new Uint8Array(r * c).fill(v);
  }

  async chupLon() {
    if (this.so == null) return null;
    const sp = require('./nghiep-vu/san-pham');
    const s = sp.layTheoSo(this.so);
    const f = s?.anh?.[0] ? sp.duongAnh(s.id, s.anh[0].tep) : null;
    if (!f) return null;
    // `_so_gia`: đáp án cho AI giả của bản xem thử (nha-cung-cap/gia-mau.js) — AI thật chỉ nhận mime + base64 (+ detail).
    return { mime: 'image/jpeg', base64: require('node:fs').readFileSync(f).toString('base64'), _so_gia: this.so };
  }
}

class NhinMon {
  /**
   * @param {object} o
   * @param {Function} o.phat
   * @param {() => object|null} o.layObs     KetNoiObs của Màn hình sản phẩm
   * @param {object} [o.nhaCungCap]          AI giả (test)
   * @param {object} [o.cauHinh]
   * @param {() => number} [o.bayGio]        đồng hồ (test)
   */
  constructor({ phat, layObs, nhaCungCap = null, cauHinh = {}, bayGio = () => Date.now() }) {
    Object.assign(this, { phat, layObs, nhaCungCap, bayGio });
    this.ch = { ...MAC_DINH, ...(require('./cau-hinh/mac-dinh.json').nhin_mon || {}), ...cauHinh };
    this.st = null;
    this.cameraGia = new NguonGia();
    this.hen = null;
  }

  batDau() {
    const lap = async () => {
      await this.buoc().catch((e) => { console.error(`  [MOZA nhìn] ${e.message}`); });
      this.hen = setTimeout(lap, this.ch.chu_ky_giay * 1000);
      this.hen.unref?.();
    };
    this.hen = setTimeout(lap, this.ch.chu_ky_giay * 1000);
    this.hen.unref?.();
  }

  dung() { clearTimeout(this.hen); this.hen = null; this.st = null; }

  /** Có nguồn để nhìn không (nút chỉ hiện khi có): buổi tập → Camera giả; buổi thật → OBS đã nối. */
  coNguon(p) {
    if (p?.dien_tap) return true;
    return !!this.layObs?.()?.trangThai?.().ket_noi;
  }

  async bat(phienId, bat) {
    const p = live.layPhien(phienId);
    if (!bat) { this.tat('Người dẫn tắt'); return this.trangThai(phienId); }
    if (p.trang_thai !== 'dang_live') throw new LoiNghiepVu('CHUA_LIVE', 'Bật "MOZA nhìn" khi buổi live đang chạy.', 409);
    if (!this.coNguon(p)) throw new LoiNghiepVu('OBS_CHUA_NOI', 'Chưa nối OBS: vào Cài đặt → OBS bấm "Kiểm tra kết nối".', 409);
    const nguon = p.dien_tap ? this.cameraGia : new NguonObs(this.layObs());
    await nguon.chuanBi();
    this.st = { phienId, nguon, bangMau: this.st?.phienId === phienId ? this.st.bangMau : null, soBang: this.st?.phienId === phienId ? this.st.soBang : [],
      anhCu: null, doiLuc: null, hoiSauDoi: 0, lanHoi: [], hoiCuoi: 0, truoc: null, lienTiep: 0, goiY: null, boQua: new Map(), chiPhi: 0, dangHoi: false };
    this.phat('live.nhin', { phien_id: phienId, ...this.trangThai(phienId) });
    return this.trangThai(phienId);
  }

  tat(lyDo = null) {
    if (!this.st) return;
    const phienId = this.st.phienId;
    this.anGoiY();
    this.st = null;
    this.phat('live.nhin', { phien_id: phienId, bat: false, ly_do: lyDo });
  }

  /** Bảng mẫu (JPEG base64 do trình duyệt ghép) — chỉ giữ trong bộ nhớ. */
  datBangMau(phienId, { anh, so = [] }) {
    const base64 = String(anh || '').replace(/^data:[^,]*,/, '');
    if (!base64 || base64.length > 4 * 1024 * 1024) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Bảng mẫu trống hoặc quá lớn.');
    const ds = (Array.isArray(so) ? so : []).map(Number).filter(Number.isInteger).slice(0, this.ch.toi_da_mon);
    if (!this.st || this.st.phienId !== phienId) this.st = { phienId, bat: false, bangMau: null, soBang: [] };
    this.st.bangMau = { mime: 'image/jpeg', base64 };
    this.st.soBang = ds;
    return { so: ds };
  }

  soDangNoi(p) {
    const d = p.kich_ban.doan[p.doan_hien_tai];
    if (!d?.san_pham_id) return null;
    try { return require('./nghiep-vu/san-pham').laySanPham(d.san_pham_id).so; } catch { return null; }
  }

  /** Một nhịp: so ảnh nhỏ, hỏi AI khi cần. Trả số lần đã hỏi AI ở nhịp này (test). */
  async buoc() {
    const st = this.st;
    if (!st?.nguon || st.dangHoi) return 0;
    let p;
    try { p = live.layPhien(st.phienId); } catch { this.tat('Không còn phiên'); return 0; }
    if (p.trang_thai !== 'dang_live') { this.tat('Hết live'); return 0; }
    if (caiDat.khanCap() || caiDat.dungAi().bat) { this.tat(caiDat.khanCap() ? '"Dừng mọi thứ" đang bật' : 'AI đang tạm dừng'); return 0; }
    const nho = await st.nguon.chupNho(this.ch.anh_so);
    const kb = khacBiet(st.anhCu, nho);
    const coCu = !!st.anhCu;
    st.anhCu = nho;
    const bayGio = this.bayGio();
    if (coCu && kb > this.ch.nguong_doi_hinh) { st.doiLuc = bayGio; st.hoiSauDoi = 0; st.truoc = null; st.lienTiep = 0; return 0; }
    if (!st.doiLuc) return 0; // hình không đổi → không hỏi
    // Đứng yên sau khi đổi: hỏi lần 1; lần 2 chỉ để xác nhận (kết quả lần 1 đủ điều kiện).
    if (st.hoiSauDoi >= this.ch.can_lien_tiep || (st.hoiSauDoi >= 1 && st.truoc == null)) return 0;
    if (bayGio - st.hoiCuoi < this.ch.cach_toi_thieu_giay * 1000) return 0;
    st.lanHoi = st.lanHoi.filter((t) => bayGio - t < 3600e3);
    if (st.lanHoi.length >= this.ch.toi_da_lan_gio) return 0;
    if (!st.bangMau) return 0;
    st.dangHoi = true;
    try {
      let khung = await st.nguon.chupLon(this.ch.canh_anh);
      if (!khung) { st.hoiSauDoi = this.ch.can_lien_tiep; return 0; }
      st.hoiCuoi = bayGio;
      st.lanHoi.push(bayGio);
      st.hoiSauDoi += 1;
      const { nhinMon } = require('./agent/agents/nhin-mon');
      const kq = await nhinMon({ bangMau: st.bangMau, khung, soBang: st.soBang, phien: p, nhaCungCap: this.nhaCungCap });
      khung = null; // không giữ khung hình
      if (this.st !== st) return 1;
      st.chiPhi += kq.chiPhi || 0;
      this.xet(kq.phieu, p);
      return 1;
    } finally {
      st.dangHoi = false;
    }
  }

  /** 5 điều kiện gợi ý. */
  xet(ph, p) {
    const st = this.st;
    const so = Number(ph?.so) || 0;
    const trongBuoi = new Set(p.kich_ban.doan.filter((d) => d.san_pham_id).map((d) => { try { return require('./nghiep-vu/san-pham').laySanPham(d.san_pham_id).so; } catch { return null; } }));
    const bayGio = this.bayGio();
    const du = ph?.co_mon && so > 0 && trongBuoi.has(so) && so !== this.soDangNoi(p) && ph.chac === 'cao' && !((st.boQua.get(so) || 0) > bayGio);
    if (!du) { st.truoc = null; st.lienTiep = 0; return; }
    st.lienTiep = st.truoc === so ? st.lienTiep + 1 : 1;
    st.truoc = so;
    if (st.lienTiep >= this.ch.can_lien_tiep) this.goiY(so, p);
  }

  goiY(so, p) {
    const sp = require('./nghiep-vu/san-pham');
    const s = sp.layTheoSo(so);
    const ds = p.kich_ban.doan;
    const lay = (i) => { try { return ds[i]?.san_pham_id && sp.laySanPham(ds[i].san_pham_id).so === so; } catch { return false; } };
    let doan = -1;
    for (let i = p.doan_hien_tai + 1; i < ds.length && doan < 0; i++) if (lay(i)) doan = i;
    for (let i = 0; i < ds.length && doan < 0; i++) if (lay(i)) doan = i;
    if (doan < 0) return;
    this.anGoiY();
    this.st.goiY = { so, doan, ten: s ? sp.tenGoi(s) : `số ${so}` };
    this.phat('live.nhin_goi_y', { phien_id: p.id, ...this.st.goiY, giay: this.ch.an_goi_y_giay });
    this.st.henAn = setTimeout(() => this.anGoiY(), this.ch.an_goi_y_giay * 1000);
    this.st.henAn.unref?.();
  }

  anGoiY() {
    const st = this.st;
    if (!st?.goiY) return;
    clearTimeout(st.henAn);
    st.goiY = null;
    this.phat('live.nhin_goi_y', { phien_id: st.phienId, so: null });
  }

  /** "Bỏ qua": 60 giây không gợi ý lại món đó. */
  boQua(so) {
    if (!this.st) return;
    this.st.boQua.set(Number(so), this.bayGio() + this.ch.bo_qua_giay * 1000);
    this.st.truoc = null;
    this.st.lienTiep = 0;
    this.anGoiY();
  }

  trangThai(phienId) {
    const st = this.st?.phienId === phienId ? this.st : null;
    let p = null;
    try { p = live.layPhien(phienId); } catch { /* không có */ }
    return { bat: !!st?.nguon, co_nguon: this.coNguon(p), camera_gia: !!p?.dien_tap, chi_phi_usd: st?.chiPhi || 0, lan_hoi: st?.lanHoi?.length || 0,
      goi_y: st?.goiY || null, co_bang_mau: !!st?.bangMau, dang_cam: p?.dien_tap ? this.cameraGia.so : undefined };
  }
}

module.exports = { NhinMon, NguonObs, NguonGia, docBmp, khacBiet, MAC_DINH };
