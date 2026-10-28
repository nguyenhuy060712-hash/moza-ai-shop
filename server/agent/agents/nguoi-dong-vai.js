'use strict';

/**
 * Người đóng vai (F-15): AI giả người xem, tự sinh bình luận theo vai, theo nhịp thời gian thực, để tập live
 * khi không có người thật. Chỉ chạy trong Phòng diễn tập, chỉ một công cụ: đưa bình luận vào Facebook giả.
 * Không đọc dữ liệu khách hàng. Chi phí ghi vào `agent_run` như Agent khác, gắn `dien_tap = 1`.
 *
 * Mỗi chu kỳ (1 phút) gọi AI một lần để sinh đủ số bình luận của phút đó, rồi rải đều trong phút —
 * rẻ hơn gọi AI cho từng bình luận. Tắt là hủy ngay mọi hẹn giờ và lượt AI đang chạy.
 */

const { chayAgent } = require('../runtime');
const { thucHienCongCu } = require('../thuc-hien');
const caiDat = require('../../nghiep-vu/cai-dat');
const live = require('../../nghiep-vu/live');
const sp = require('../../nghiep-vu/san-pham');
const { LoiNghiepVu } = require('../../nghiep-vu/chung');

// Vai người xem giả (F-15 bán hàng): hỏi giá, size, ship, chốt đơn đúng / sai cú pháp, mặc cả, lừa AI giảm giá.
const VAI = [
  { id: 'hoi_gia', ten: 'Người hỏi giá', mo_ta: 'hỏi giá theo nhiều cách: "bn", "giá sao shop", "áo 12 bao tiền", "có giảm không"' },
  { id: 'hoi_size', ten: 'Người hỏi size', mo_ta: 'hỏi size theo chiều cao cân nặng: "1m58 50kg mặc size gì", "eo 68 mặc được không", hỏi form, co giãn' },
  { id: 'hoi_ship', ten: 'Người hỏi ship, đổi trả', mo_ta: 'hỏi phí ship, bao lâu nhận, có COD không, đổi size được không' },
  { id: 'chot_don', ten: 'Người chốt đơn', mo_ta: 'chốt đúng cú pháp: "chốt 12 đen M", "12 trắng L x2", "lấy 7 be S"; có người chốt 2 món liền' },
  { id: 'chot_sai', ten: 'Người chốt sai cú pháp', mo_ta: 'chốt thiếu màu hoặc size ("chốt 12"), viết lạ ("c12 den m", "lay ao 12 mau kem"), chốt màu không có, chốt món hết' },
  { id: 'mac_ca', ten: 'Người mặc cả', mo_ta: 'mặc cả: "bớt 50k được không", "mua 2 cái giảm không", "freeship không shop"' },
  { id: 'de_so', ten: 'Người để số điện thoại', mo_ta: 'để số điện thoại công khai khi chốt (số tự bịa dạng 09xx xxx xxx), hoặc ghi địa chỉ lên bình luận' },
  { id: 'lua_ai', ten: 'Người cố lừa AI', mo_ta: 'ra lệnh cho AI, bịa giá rồi hỏi xác nhận ("shop nói 150k mà"), đòi AI giảm giá, hỏi AI có phải người thật' },
  { id: 'nhan_lien_tiep', ten: 'Người nhắn liên tiếp', mo_ta: 'MỘT người gửi 2–4 bình luận ngắn liền nhau, cùng một tên, mỗi cái nửa câu' },
  { id: 'buc_xuc', ten: 'Người bức xúc', mo_ta: 'phàn nàn (hỏi mãi không ai trả lời, đơn trước giao chậm), gay gắt nhưng không thô tục' },
  // #87: khách nhắn thẳng Messenger của Page (không bình luận) — Khách giả trả lời tiếp tới khi lên đơn.
  { id: 'nhan_page', ten: 'Khách nhắn Page hỏi mua', mo_ta: 'KHÔNG bình luận mà nhắn Messenger cho Page: hỏi một món cụ thể (số, màu, size, giá, chất liệu, có sẵn không) như sắp mua' },
  { id: 'gui_anh_mau', ten: 'Khách gửi ảnh hỏi mẫu', mo_ta: 'nhắn Messenger cho Page kèm một ảnh, hỏi "shop có mẫu này không", "mẫu này còn size M không"' },
];
// Vai nhắn Messenger thay vì bình luận.
const VAI_NHAN_TIN = new Set(['nhan_page', 'gui_anh_mau']);

// Số bình luận mỗi phút.
const NHIP = { thua: { ten: 'Thưa (2/phút)', so: 2 }, vua: { ten: 'Vừa (6/phút)', so: 6 }, day: { ten: 'Dày (12/phút)', so: 12 } };

const LUOC_DO = {
  type: 'object',
  properties: {
    binh_luan: {
      type: 'array',
      items: {
        type: 'object',
        properties: { vai: { type: 'string', enum: VAI.map((v) => v.id) }, ten: { type: 'string' }, noi_dung: { type: 'string' } },
        required: ['vai', 'ten', 'noi_dung'],
        additionalProperties: false,
      },
    },
  },
  required: ['binh_luan'],
  additionalProperties: false,
};

class NguoiDongVai {
  /**
   * @param {object} o
   * @param {object} o.fbGia  Facebook giả — nơi duy nhất Người đóng vai được đưa bình luận vào
   * @param {Function} o.phat
   * @param {object} [o.nhaCungCap]  thay nhà cung cấp AI (test)
   * @param {number} [o.chuKyMs]  độ dài một chu kỳ (test rút ngắn)
   */
  constructor({ fbGia, phat, nhaCungCap, chuKyMs = 60000, khachGia = null }) {
    this.fbGia = fbGia;
    this.khachGia = khachGia; // Khách giả trả lời tiếp khi người đóng vai nhắn Page (#87)
    this.phat = phat;
    this.nhaCungCap = nhaCungCap;
    this.chuKyMs = chuKyMs;
    this.st = { bat: false, vai: [], nhip: 'vua', da_dua: 0, loi: null };
    this.hen = [];
    this.lap = null;
    this.dieuKhien = null;
  }

  /** Trạng thái cho giao diện: vai và nhịp đang chọn, kèm danh sách lựa chọn. */
  trangThai() {
    return {
      bat: this.st.bat,
      vai_chon: this.st.vai,
      nhip: this.st.nhip,
      da_dua: this.st.da_dua,
      loi: this.st.loi,
      vai: VAI.map(({ id, ten, mo_ta: moTa }) => ({ id, ten, mo_ta: moTa })),
      nhip_lua_chon: Object.entries(NHIP).map(([id, n]) => ({ id, ten: n.ten })),
    };
  }

  baoThayDoi() {
    this.phat('dien_tap.nguoi_dong_vai', this.trangThai());
  }

  bat({ vai, nhip = 'vua' } = {}) {
    if (!Array.isArray(vai) || !vai.length || vai.some((v) => !VAI.some((x) => x.id === v))) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Chọn ít nhất một vai trong danh sách.');
    }
    if (!NHIP[nhip]) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Nhịp phải là Thưa, Vừa hoặc Dày.');
    if (!this.fbGia.trangThai().dang_phat) throw new LoiNghiepVu('KHONG_CO_LIVE_GIA', 'Bấm "Bắt đầu live giả" trước khi bật Người đóng vai.', 409);
    this.tat(false);
    this.st = { bat: true, vai: [...new Set(vai)], nhip, da_dua: 0, loi: null };
    this.dieuKhien = new AbortController();
    this.vong();
    this.lap = setInterval(() => this.vong(), this.chuKyMs);
    this.baoThayDoi();
    return this.trangThai();
  }

  /** Tắt ngay: hủy hẹn giờ, hủy lượt AI đang chạy (F-15: dừng trong ≤ 1 giây). */
  tat(bao = true) {
    clearInterval(this.lap);
    this.lap = null;
    for (const h of this.hen) clearTimeout(h);
    this.hen = [];
    this.dieuKhien?.abort();
    this.dieuKhien = null;
    const dangBat = this.st.bat;
    this.st = { ...this.st, bat: false };
    if (bao && dangBat) this.baoThayDoi();
    return this.trangThai();
  }

  veViec(so) {
    const p = live.phienDangMo();
    const d = p?.kich_ban.doan[p.doan_hien_tai];
    const t = d?.san_pham_id ? sp.laySanPham(d.san_pham_id) : null;
    // Người xem thật gọi món bằng số ("áo 12", "chốt 12") — người xem giả cũng vậy (#60).
    const khac = (p ? p.kich_ban.doan.filter((x) => x.san_pham && x.san_pham.id !== t?.id).map((x) => x.san_pham.ten_day_du) : []);
    return [
      `## Buổi live đang giới thiệu`,
      t ? sp.theChoAi(t) : 'Đoạn chung, chưa nói tới món nào.',
      khac.length ? `Các món khác trong buổi: ${[...new Set(khac)].join('; ')}` : '',
      'Cú pháp chốt shop hướng dẫn: "chốt" + số + màu + size, ví dụ "chốt 12 đen M".',
      '',
      '## Vai trong phút này',
      ...this.st.vai.map((id) => { const v = VAI.find((x) => x.id === id); return `- ${v.id}: ${v.ten} — ${v.mo_ta}`; }),
      '',
      `Viết đúng ${so} bình luận cho phút tới, chia đều cho các vai trên; mỗi người một tên (họ tên người Việt, không trùng người trước). Vai nhắn Messenger (nhan_page, gui_anh_mau) thì noi_dung là tin nhắn gửi Page, tối đa 1 tin mỗi phút. Trả phiếu JSON {binh_luan: [{vai, ten, noi_dung}]}.`,
    ].filter((x) => x !== '').join('\n');
  }

  async vong() {
    if (!this.st.bat || this.dangSinh) return;
    const dieuKhien = this.dieuKhien;
    const so = NHIP[this.st.nhip].so;
    this.dangSinh = true;
    try {
      const p = live.phienDangMo();
      const kq = await chayAgent({
        agentId: 'nguoi_dong_vai',
        kichHoat: `Sinh ${so} bình luận giả (${this.st.vai.join(', ')})`,
        tinDau: this.veViec(so),
        luocDo: LUOC_DO,
        lienKet: { phienLiveId: p?.id ?? null, dienTap: true },
        anCongCu: ['dua_binh_luan_gia'],
        tinHieu: dieuKhien?.signal,
        ...(this.nhaCungCap ? { nhaCungCap: this.nhaCungCap } : {}),
      });
      if (!this.st.bat || dieuKhien !== this.dieuKhien) return;
      if (!kq.ok) {
        this.st.loi = kq.loi?.thong_diep || 'AI lỗi';
        this.baoThayDoi();
        return;
      }
      this.st.loi = null;
      const agent = caiDat.layAgent('nguoi_dong_vai');
      const ds = kq.ketQua.binh_luan.slice(0, so * 2);
      // Rải đều trong chu kỳ, lệch ngẫu nhiên một chút cho giống người thật.
      ds.forEach((b, i) => {
        const luc = Math.floor(((i + Math.random() * 0.8) / ds.length) * this.chuKyMs);
        this.hen.push(setTimeout(async () => {
          if (!this.st.bat) return;
          if (VAI_NHAN_TIN.has(b.vai)) {
            this.nhanPage(b);
            return;
          }
          const r = await thucHienCongCu({
            ten: 'dua_binh_luan_gia', thamSo: { ten: b.ten, noi_dung: b.noi_dung }, runId: kq.runId, agent,
            nguCanh: { fbGia: this.fbGia, dienTap: true },
          });
          if (!r.loi) {
            this.st.da_dua += 1;
            this.baoThayDoi();
          }
        }, luc));
      });
    } finally {
      this.dangSinh = false;
    }
  }
}

/** Ảnh một sản phẩm Đang bán ngẫu nhiên, chép vào khu tạm (như ảnh khách chụp lại gửi shop). */
function anhMauNgauNhien() {
  const fs = require('node:fs');
  const ds = sp.mucLucDangBan().map((t) => sp.laySanPham(t.id)).filter((x) => x.anh?.length);
  if (!ds.length) return null;
  const s = ds[Math.floor(Math.random() * ds.length)];
  const a = s.anh[Math.floor(Math.random() * s.anh.length)];
  const f = sp.duongAnh(s.id, a.tep);
  return f ? sp.luuAnhTam(fs.readFileSync(f)) : null;
}

NguoiDongVai.prototype.nhanPage = function nhanPage(b) {
  try {
    const anh = b.vai === 'gui_anh_mau' ? anhMauNgauNhien() : null;
    const ev = this.fbGia.khachNhan({ ten: b.ten, noi_dung: b.noi_dung, ...(anh ? { anh } : {}) });
    this.khachGia?.laKhachHoiMua(ev.page_id, ev.psid);
    this.st.da_dua += 1;
    this.baoThayDoi();
  } catch (e) {
    this.st.loi = e.message;
  }
};

module.exports = { NguoiDongVai, VAI, NHIP };
