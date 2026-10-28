'use strict';

/**
 * Bình chọn bằng bình luận, không quà (SPEC.md F-86, #111) — không có SQL, không gọi AI.
 *  - Mở: nút "🗳 Bình chọn" (chọn 2–3 màu của món đang nói) hoặc "Mai ơi bình chọn be hay đen". 60 giây; tối đa 2 lần mỗi buổi.
 *  - Phiếu: "A", "a nha", "chọn A", "A be" hoặc đúng tên màu ("be"); mỗi người 1 phiếu, tính phiếu sau cùng. Phiếu không vào
 *    Director, không bị đọc thành chốt (chốt đơn xét trước).
 *  - Thanh chữ: "Bình chọn: A · Be 12 | B · Đen 9 · còn 34 giây"; hết giờ "Be thắng!" 20 giây. Kết quả → thẻ nhắc ưu tiên cao nhất
 *    "Be thắng — mặc Be cho cả nhà xem ngay", chiếu ảnh màu thắng, Đội AI / Mai đọc câu kết (không đọc số phiếu). Hòa → người dẫn chọn.
 *  - Không quà, không "chia sẻ để bình chọn" (khuyến mại phải đăng ký — NĐ 81/2018 sửa đổi).
 */

const live = require('./nghiep-vu/live');
const sp = require('./nghiep-vu/san-pham');
const nk = require('./nghiep-vu/nhat-ky-song');
const tk = require('./nghiep-vu/tu-khoa');
const { LoiNghiepVu } = require('./nghiep-vu/chung');

const MAC = () => ({ giay: 60, toi_da_moi_buoi: 2, toi_da_lua_chon: 3, ket_giay: 20, ...(require('./cau-hinh/mac-dinh.json').binh_chon || {}) });
const CHU = ['A', 'B', 'C'];
const DEM = new Set(['chon', 'binh', 'mau', 'thich', 'em', 'minh', 'nha', 'nhe', 'shop', 'oi', 'a', 'ne', 'voi', 'nhen', 'di', 'c', 'e', 'ban', 'cai']);

class BinhChon {
  constructor({ phat, phongAi = null, layManHinh = null, layTheNhac = null, giayMs = null }) {
    Object.assign(this, { phat, phongAi, layManHinh, layTheNhac, giayMs });
    this.dang = null; // { phienId, so, lua_chon:[{chu, mau}], phieu: Map(nguoi → i), het, hen, nhip }
    this.soLan = new Map(); // phienId → số lần đã mở
    this.ketQua = null;
  }

  dung() {
    if (this.dang) { clearTimeout(this.dang.hen); clearInterval(this.dang.nhip); }
    this.dang = null;
  }

  /**
   * Mở bình chọn cho món đang nói. @param {string[]} mau  2–3 màu (tên phân loại)
   */
  mo({ mau = [] } = {}) {
    const m = MAC();
    const p = live.phienDangMo();
    if (!p || p.trang_thai !== 'dang_live') throw new LoiNghiepVu('KHONG_CO_LIVE', 'Chưa có buổi live đang chạy.', 409);
    if (this.dang) throw new LoiNghiepVu('DANG_BINH_CHON', 'Đang có một bình chọn — chờ hết giờ.', 409);
    if ((this.soLan.get(p.id) || 0) >= m.toi_da_moi_buoi) throw new LoiNghiepVu('DU_LAN_BINH_CHON', `Buổi này đã đủ ${m.toi_da_moi_buoi} lần bình chọn.`, 409);
    const doan = p.kich_ban.doan[p.doan_hien_tai];
    const s = doan?.san_pham_id ? sp.laySanPham(doan.san_pham_id) : null;
    if (!s) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chuyển tới đoạn có món rồi mới bình chọn màu.');
    const coMau = [...new Set(sp.phanLoaiCua(s.id).filter((x) => !x.bo).map((x) => x.gt1))];
    const chon = [...new Set(mau.map((x) => coMau.find((c) => tk.gon(c) === tk.gon(x))).filter(Boolean))];
    if (chon.length < 2 || chon.length > m.toi_da_lua_chon) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Chọn 2–${m.toi_da_lua_chon} màu của ${sp.tenGoi(s)} (có: ${coMau.join(', ')}).`);
    this.soLan.set(p.id, (this.soLan.get(p.id) || 0) + 1);
    const giay = this.giayMs ?? m.giay * 1000;
    this.dang = { phienId: p.id, so: s.so, ten_mon: sp.tenGoi(s), lua_chon: chon.map((c, i) => ({ chu: CHU[i], mau: c })), phieu: new Map(), het: Date.now() + giay };
    this.ketQua = null;
    this.dang.hen = setTimeout(() => this.ket(), giay);
    this.dang.hen.unref?.();
    this.dang.nhip = setInterval(() => this.bao(), 1000);
    this.dang.nhip.unref?.();
    nk.ghi({ phienId: p.id, loai: 'su_kien', noiDung: `Bình chọn: ${this.dang.lua_chon.map((x) => `${x.chu} · ${x.mau}`).join(' | ')} (${sp.tenGoi(s)})`, sanPhamId: s.id });
    const bien = { a: chon[0], b: chon[1], mon: sp.tenGoi(s) };
    if (p.doi_ai) this.phongAi?.doiAi?.chenBanHang(p.id, 'binh_chon_mo', bien);
    else if (this.phongAi?.miengSanSang?.(p)) this.phongAi.mieng?.noiNguyenVan?.(`Cả nhà bình chọn nè: thích ${chon[0]} thì gõ A, thích ${chon[1]} thì gõ B${chon[2] ? `, thích ${chon[2]} thì gõ C` : ''}!`);
    this.bao();
    return this.trangThai();
  }

  /** Bình luận là phiếu? (A / B / C, "chọn a", "A be", tên màu). @returns {number|null} chỉ số lựa chọn */
  docPhieu(noiDung) {
    const d = this.dang;
    if (!d) return null;
    const tu = tk.gon(noiDung).split(' ').filter(Boolean);
    if (!tu.length || tu.length > 6) return null;
    const mau = d.lua_chon.map((x) => tk.gon(x.mau));
    const conLai = [];
    let chi = null;
    for (let i = 0; i < tu.length; i++) {
      const w = tu[i];
      const mMau = mau.findIndex((x) => tu.slice(i, i + x.split(' ').length).join(' ') === x);
      if (mMau >= 0) { if (chi != null && chi !== mMau) return null; chi = mMau; i += mau[mMau].split(' ').length - 1; continue; }
      const iChu = ['a', 'b', 'c'].indexOf(w);
      // "a" vừa là chữ A vừa là "ạ": câu một chữ "a" hoặc "chọn a" là phiếu A.
      if (iChu >= 0 && iChu < d.lua_chon.length && (w !== 'a' || tu.length === 1 || i === 0 || ['chon', 'binh'].includes(tu[i - 1]))) {
        if (chi != null && chi !== iChu) return null;
        chi = iChu;
        continue;
      }
      if (!DEM.has(w)) conLai.push(w);
    }
    return chi != null && !conLai.length ? chi : null;
  }

  /**
   * Bình luận trong lúc bình chọn (sau chốt đơn). Phiếu → gắn nhãn, không vào Director. @returns {boolean} là phiếu
   */
  nhanBinhLuan(bl) {
    const d = this.dang;
    if (!d || bl.phien_id !== d.phienId || Date.now() > d.het) return false;
    const i = this.docPhieu(bl.noi_dung);
    if (i == null) return false;
    d.phieu.set(bl.nguoi_fb_id || `an_${bl.fb_id}`, i); // phiếu sau cùng thay phiếu trước
    live.ganPhieuBinhChon(bl.id);
    return true;
  }

  dem() {
    const d = this.dang || this.daXong;
    const n = d.lua_chon.map(() => 0);
    for (const i of d.phieu.values()) n[i] += 1;
    return n;
  }

  trangThai() {
    const d = this.dang;
    if (!d) return { dang: false, ket_qua: this.ketQua };
    const n = this.dem();
    return { dang: true, so: d.so, ten_mon: d.ten_mon, lua_chon: d.lua_chon.map((x, i) => ({ ...x, phieu: n[i] })), con_giay: Math.max(0, Math.round((d.het - Date.now()) / 1000)) };
  }

  bao() {
    this.phat('mhsp.binh_chon', this.trangThai());
  }

  /** Hết giờ: kết quả, thẻ nhắc ưu tiên cao nhất, chiếu ảnh màu thắng, câu kết (không đọc số phiếu). */
  ket() {
    const d = this.dang;
    if (!d) return null;
    clearTimeout(d.hen);
    clearInterval(d.nhip);
    this.daXong = d;
    const n = this.dem();
    this.dang = null;
    const max = Math.max(...n);
    const thang = n.filter((x) => x === max).length === 1 && max > 0 ? d.lua_chon[n.indexOf(max)].mau : null;
    this.ketQua = { thang, hoa: !thang, so: d.so, luc: new Date().toISOString(), hien_den: new Date(Date.now() + MAC().ket_giay * 1000).toISOString() };
    let p = null;
    try { p = live.layPhien(d.phienId); } catch { p = null; }
    nk.ghi({ phienId: d.phienId, loai: 'su_kien', noiDung: `Kết quả bình chọn: ${thang ? `${thang} thắng` : 'hòa — người dẫn chọn'} (${d.lua_chon.map((x, i) => `${x.mau} ${n[i]}`).join(', ')})` });
    const theNhac = this.layTheNhac?.();
    if (thang) {
      theNhac?.themTheUuTien?.({ phienId: d.phienId, chu: `${thang} thắng — mặc ${thang} cho cả nhà xem ngay`, nut: [{ chu: `Chiếu ảnh ${thang}`, lenh: { mau: 'anh', so: d.so, mau_sac: thang } }] });
      try { this.layManHinh?.()?.chieu({ mau: 'anh', so: d.so, mau_sac: thang }, { boi: 'ai', lyDo: 'Kết quả bình chọn' }); } catch { /* chưa có ảnh màu đó */ }
    } else {
      theNhac?.themTheUuTien?.({ phienId: d.phienId, chu: 'Bình chọn hòa — người dẫn chọn màu để mặc cho cả nhà xem', nut: [] });
    }
    if (p?.doi_ai) this.phongAi?.doiAi?.chenBanHang(p.id, thang ? 'binh_chon_ket' : 'binh_chon_hoa', { mau: thang || '' });
    else if (p && this.phongAi?.miengSanSang?.(p)) this.phongAi.mieng?.noiNguyenVan?.(thang ? `${thang} thắng rồi cả nhà ơi, bạn mẫu mặc ${thang} cho cả nhà xem liền!` : 'Hai màu hòa nhau luôn, để người dẫn chọn giúp cả nhà nha!');
    this.bao();
    return this.ketQua;
  }
}

module.exports = { BinhChon };
