'use strict';

/**
 * Công cụ đơn hàng của AI (SPEC.md A.6, #79 — gộp 6 công cụ nhỏ thành 2): `xem_don` và `cap_nhat_don` cho Tư vấn viên;
 * `tim_don`, `xem_bao_cao` cho "Nói với Mai". Kèm `gui_anh_san_pham` (F-56) và `tim_mau_theo_anh` (F-63).
 * Theo hướng dẫn thiết kế công cụ mới nhất: tham số bằng lời ("áo 12 đen M x1"), MOZA tự tìm phân loại; kết quả là một
 * khối chữ dễ hiểu có dòng dữ liệu để trích (tổng tiền, phí ship — K2, K10); lỗi luôn kèm cách sửa. Luật chặn nằm trong
 * code (don.js): AI chỉ xác nhận khi đủ thông tin + khách đồng ý, chỉ hủy khi khách tự nói, không gửi / giao / hoàn.
 */

const fs = require('node:fs');
const hopThu = require('../../nghiep-vu/hop-thu');
const don = require('../../nghiep-vu/don');
const kh = require('../../nghiep-vu/khach');
const sp = require('../../nghiep-vu/san-pham');
const kho = require('../../nghiep-vu/kho');
const { LoiNghiepVu, hienTien } = require('../../nghiep-vu/chung');
const { docChot } = require('../../nhan-chot');

const chuoi = (moTa) => ({ type: 'string', description: moTa });
const vat = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

function canHoiThoai(ctx) {
  if (!ctx.hoiThoaiId) throw new LoiNghiepVu('KHONG_CO_HOI_THOAI', 'Công cụ này chỉ dùng khi đang xử lý một hội thoại Hộp thư.');
  return hopThu.layHoiThoai(ctx.hoiThoaiId);
}

/** Đơn đang mở của khách trong hội thoại này (theo hội thoại, người Facebook, hồ sơ khách). */
function donCuaKhach(h) {
  const d = don.donMoCuaNguoi({ hoiThoaiId: h.id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id });
  if (d && d.hoi_thoai_id !== h.id) don.ganHoiThoai(d.id, h.id); // khách chốt ở bình luận, trao đổi tiếp trong Messenger
  return d ? don.layDon(d.id) : null;
}

/** Đơn gần nhất của khách (kể cả đã gửi) — trả lời "đơn của em đâu". */
function donGanNhat(h) {
  const ds = don.danhSach({ q: '' }).filter((d) => d.hoi_thoai_id === h.id || (h.nguoi_fb_id && d.nguoi_fb_id === h.nguoi_fb_id) || (h.khach_id && d.khach_id === h.khach_id));
  return ds[0] || null;
}

/**
 * Món khách nói bằng lời ("áo 12 đen M x1", "12 trắng L", "đen M" — không số thì món đang hỏi) → phân loại cụ thể.
 * Không rõ → lỗi kèm danh sách phân loại còn hàng để AI hỏi lại khách.
 */
function timMon(chu, h) {
  const ds = sp.danhSach({ trang_thai: 'dang_ban' }).map((x) => ({ ...sp.laySanPham(x.id), phan_loai: sp.phanLoaiCua(x.id) }));
  const goiY = h.san_pham_goi_y ? sp.laySanPham(h.san_pham_goi_y)?.so : null;
  const r = docChot(`chốt ${chu}`, { dsSanPham: ds, soDangNoi: goiY });
  const m = r.mon[0];
  if (!m || r.mon.length !== 1) throw new LoiNghiepVu('PHAN_LOAI_KHONG_CO', `Chưa hiểu món "${chu}". Ghi rõ một món: số sản phẩm + màu + cỡ + số lượng, ví dụ "áo 12 đen M x1".`);
  if (!m.san_pham) throw new LoiNghiepVu('KHONG_TIM_THAY', `${m.ly_do} Gọi muc_luc_san_pham để xem số đang bán, hoặc hỏi lại khách.`);
  if (!m.phan_loai) {
    const con = kho.conHang(m.san_pham.id).filter((p) => p.con_ban_duoc > 0).map((p) => `${sp.nhanPl(p)} (còn ${p.con_ban_duoc})`);
    throw new LoiNghiepVu('PHAN_LOAI_KHONG_CO', `${sp.tenDayDu(m.san_pham)}: ${m.ly_do} Còn hàng: ${con.join(', ') || 'hết mọi phân loại'}. Hỏi lại khách.`);
  }
  return m;
}

const xemDon = {
  ten: 'xem_don',
  moTa: 'Xem đơn của khách đang nhắn (đơn đang mở, không có thì đơn gần nhất): món, đơn giá, phí ship, tổng tiền, người nhận, hạn giữ hàng, mã vận đơn, việc còn thiếu. Trích nguyên văn dòng tổng tiền, phí ship với nguon = mã đơn (ví dụ "DH-0042").',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ ma_don: chuoi('Mã đơn, ví dụ DH-0042; "" = đơn của khách đang nhắn') }),
  chay(ts, ctx) {
    if (ctx.agentId === 'quan_ly') {
      if (!ts.ma_don) throw new LoiNghiepVu('THIEU_MA_DON', 'Cho mã đơn (tim_don để tìm).');
      const d = don.layDon(ts.ma_don);
      return { don: don.khoiChoAi(d), trang_thai: d.ten_trang_thai };
    }
    const h = canHoiThoai(ctx);
    const d = donCuaKhach(h) || donGanNhat(h);
    if (!d) return { co_don: false, ghi_chu: 'Khách này chưa có đơn. Khách muốn mua thì cap_nhat_don viec "tao".' };
    if (ts.ma_don && d.ma !== ts.ma_don.toUpperCase()) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Chỉ xem được đơn của chính khách đang nhắn.');
    return { co_don: true, ma_don: d.ma, trang_thai: d.ten_trang_thai, don: don.khoiChoAi(d) };
  },
};

const VIEC = ['tao', 'them', 'bot', 'doi_phan_loai', 'thong_tin_giao', 'xac_nhan', 'huy'];

const capNhatDon = {
  ten: 'cap_nhat_don',
  moTa: 'Làm việc với đơn của khách đang nhắn. viec: tao (giữ hàng, tạo đơn — mon), them (thêm món — mon), bot (bớt món — mon), '
    + 'doi_phan_loai (đổi món cũ "mon" sang "mon_moi", ví dụ đổi cỡ), thong_tin_giao (ten, so_dien_thoai, dia_chi, thanh_toan), '
    + 'tao / them / bot / doi_phan_loai cần bang_chung_tin_nhan_id = id tin khách xin món đó, mới hơn lần sửa món gần nhất (món khách chốt ở bình luận MOZA đã tự giữ — đừng thêm lại), '
    + 'xac_nhan (chỉ sau khi đã đọc lại đơn và tổng tiền, khách nói đồng ý — bang_chung_tin_nhan_id là id tin khách đồng ý), '
    + 'huy (chỉ khi khách tự nói hủy — bang_chung_tin_nhan_id là id tin đó). Ô không dùng để "". Trả khối chữ đơn mới.',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  thamSo: vat({
    viec: { type: 'string', enum: VIEC },
    mon: chuoi('Món bằng lời: số + màu + cỡ + số lượng, ví dụ "áo 12 đen M x1"; hoặc ""'),
    mon_moi: chuoi('Món mới khi doi_phan_loai, ví dụ "áo 12 đen L"; hoặc ""'),
    ten: chuoi('Tên người nhận hoặc ""'),
    so_dien_thoai: chuoi('Số điện thoại khách gửi hoặc ""'),
    dia_chi: chuoi('Địa chỉ giao đầy đủ hoặc ""'),
    thanh_toan: { type: 'string', enum: ['', 'cod', 'chuyen_khoan'] },
    bang_chung_tin_nhan_id: chuoi('id tin nhắn của khách làm bằng chứng (tao, them, bot, doi_phan_loai, xac_nhan, huy) hoặc ""'),
  }),
  giay: 20,
  async chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    let d = donCuaKhach(h);
    // Sửa món chỉ theo lời khách (#79, mục 7): tin của chính khách, mới hơn lần sửa món gần nhất — một tin chỉ dùng
    // được một lần, và món MOZA đã giữ từ bình luận chốt không bị AI thêm lại.
    if (['tao', 'them', 'bot', 'doi_phan_loai'].includes(ts.viec)) {
      let t = null;
      try { t = ts.bang_chung_tin_nhan_id ? hopThu.layTin(ts.bang_chung_tin_nhan_id) : null; } catch { /* id lạ */ }
      const cuaKhach = t && t.gui_boi === 'khach' && (t.hoi_thoai_id === h.id || hopThu.layHoiThoai(t.hoi_thoai_id).nguoi_fb_id === h.nguoi_fb_id);
      if (!cuaKhach) throw new LoiNghiepVu('THIEU_BANG_CHUNG', 'Cần id tin nhắn của chính khách xin món này (xem_hoi_thoai để lấy id).');
      if (!require('../../nhan-chot').laLoiXinSua(t.noi_dung, ts.viec)) {
        throw new LoiNghiepVu('CHUA_XIN_MUA', `Tin "${t.noi_dung.slice(0, 80)}" chưa phải lời khách xin ${ts.viec === 'bot' || ts.viec === 'doi_phan_loai' ? 'bớt / đổi món' : 'mua / thêm món'}: trả lời câu hỏi rồi hỏi khách có muốn lấy không, chờ khách đồng ý.`);
      }
      const moc = d?.mon_sua_luc || null;
      if (moc && t.luc <= moc) {
        throw new LoiNghiepVu('DA_CAP_NHAT', `Món trong tin này đã có trong đơn ${d.ma} (đơn đã sửa sau tin đó). Không sửa món nữa; xem_don để đọc đơn hiện tại.`);
      }
    }
    const canDon = () => { if (!d) throw new LoiNghiepVu('CHUA_CO_DON', 'Khách chưa có đơn đang mở. Khách muốn mua thì viec "tao" với món.'); return d; };
    switch (ts.viec) {
      case 'tao':
      case 'them': {
        const m = timMon(ts.mon, h);
        if (d) d = don.themMon(d.id, m.phan_loai.id, m.so_luong, { boi: 'ai' });
        else {
          d = don.taoDon({
            mon: [{ phan_loai_id: m.phan_loai.id, so_luong: m.so_luong }], nguon: h.kenh === 'binh_luan_live' ? 'binh_luan_live' : 'tin_nhan',
            pageId: h.page_id, nguoiFbId: h.nguoi_fb_id, khachId: h.khach_id, hoiThoaiId: h.id, phienLiveId: h.phien_live_id,
            dienTap: h.dien_tap, boi: 'ai', runId: ctx.runId,
          });
        }
        break;
      }
      case 'bot': {
        const m = timMon(ts.mon, h);
        d = don.botMon(canDon().id, m.phan_loai.id, ts.mon.match(/x\s?(\d+)/)?.[1] ?? null, { boi: 'ai' });
        break;
      }
      case 'doi_phan_loai': {
        const cu = timMon(ts.mon, h);
        const moi = timMon(ts.mon_moi, h);
        d = don.doiPhanLoai(canDon().id, cu.phan_loai.id, moi.phan_loai.id, null, { boi: 'ai' });
        break;
      }
      case 'thong_tin_giao': {
        d = require('../../nghiep-vu/thong-tin-giao').ghiThongTinGiao({ h, d: canDon(), ten: ts.ten, sdt: ts.so_dien_thoai, diaChi: ts.dia_chi, thanhToan: ts.thanh_toan });
        break;
      }
      case 'xac_nhan': {
        try {
          d = don.doiTrangThai(canDon().id, 'da_xac_nhan', { nguon: 'ai', bangChung: ts.bang_chung_tin_nhan_id || null, runId: ctx.runId });
        } catch (e) {
          if (e.ma === 'CAN_GOI_XAC_NHAN') {
            // #73: khách từng hoàn nhiều đơn → việc "Gọi xác nhận đơn" cho người.
            kh.taoViec({ loai: 'goi_xac_nhan_don', noiDung: `Gọi xác nhận đơn ${d.ma} — khách từng hoàn đơn.`, khachId: d.khach_id, hoiThoaiId: h.id, donId: d.id, taoBoi: 'ai' });
          }
          throw e;
        }
        break;
      }
      case 'huy':
        d = don.doiTrangThai(canDon().id, 'da_huy', { nguon: 'ai', bangChung: ts.bang_chung_tin_nhan_id || null, runId: ctx.runId, ghiChu: 'khách hủy' });
        break;
      default:
        throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Việc lạ: ${ts.viec}.`);
    }
    try { require('../../ws').phat('don.cap_nhat', { don_id: d.id }); require('../../ws').phat('kho.cap_nhat', {}); } catch { /* chưa có ws */ }
    // #89: đơn Chờ xác nhận đã đủ thông tin giao → MOZA tự gửi thẻ đơn có nút "Xác nhận đơn" (không cần AI đọc lại bằng chữ).
    let theDon = null;
    if (d.trang_thai === 'cho_xac_nhan' && !don.viecConThieu(d).length) {
      const g = await require('../../gui-the-don').guiTheDon({ d: don.layDon(d.id), layKetNoi: ctx.layKetNoi });
      theDon = g.da_gui
        ? 'MOZA vừa gửi khách thẻ đơn có nút "✅ Xác nhận đơn" (đủ món, tổng tiền, người nhận). Chỉ cần nhắn một câu ngắn mời khách kiểm tra thẻ và bấm Xác nhận — không đọc lại đơn bằng chữ nữa. Khách trả lời chữ "đồng ý" thì cap_nhat_don xac_nhan như thường.'
        : `Chưa gửi thẻ đơn: ${g.ly_do}${g.da_gui_truoc ? ' Khách đã có thẻ của đơn này — mời khách bấm Xác nhận trên thẻ.' : ' Đọc lại đơn và tổng tiền bằng chữ, chờ khách đồng ý.'}`;
    }
    return { ma_don: d.ma, trang_thai: d.ten_trang_thai, don: don.khoiChoAi(d), ...(theDon ? { the_don: theDon } : {}) };
  },
};

const timDon = {
  ten: 'tim_don',
  moTa: 'Tìm đơn theo tên, số điện thoại, mã đơn, trạng thái (cho_xac_nhan, da_xac_nhan = cần gửi, da_gui, da_giao, hoan, da_huy), và/hoặc "chờ xác nhận quá N giờ".',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({
    tim: chuoi('Tên, số điện thoại hoặc mã đơn; "" nếu không lọc'),
    trang_thai: { type: 'string', enum: ['', ...don.TRANG_THAI] },
    qua_gio: { type: 'integer', description: 'Chỉ đơn tạo trước đây quá số giờ này; 0 = không lọc' },
  }),
  chay(ts) {
    let ds = don.danhSach({ q: ts.tim, trangThai: ts.trang_thai, dienTap: false, gioiHan: 200 });
    if (ts.qua_gio > 0) ds = ds.filter((d) => Date.now() - new Date(d.tao_luc).getTime() > ts.qua_gio * 3600e3);
    return {
      so_don: ds.length,
      don: ds.slice(0, 15).map((d) => `${d.ma} · ${d.ten_trang_thai} · ${d.ten_nhan || d.ten_fb || 'chưa có tên'} · ${hienTien(d.tong_tien)} · ${d.dong.map((x) => `${x.ten_chup} x${x.so_luong}`).join('; ')}`),
    };
  },
};

const xemBaoCao = {
  ten: 'xem_bao_cao',
  moTa: 'Doanh số, số đơn, món bán chạy trong một khoảng ngày (giờ Việt Nam). Không tính diễn tập.',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ tu_ngay: chuoi('YYYY-MM-DD'), den_ngay: chuoi('YYYY-MM-DD (tính cả ngày này)') }),
  chay(ts) {
    const bc = require('../../nghiep-vu/bao-cao');
    const tu = /^\d{4}-\d{2}-\d{2}$/.test(ts.tu_ngay) ? new Date(`${ts.tu_ngay}T00:00:00+07:00`).toISOString() : null;
    const den = /^\d{4}-\d{2}-\d{2}$/.test(ts.den_ngay) ? new Date(new Date(`${ts.den_ngay}T00:00:00+07:00`).getTime() + 86400e3).toISOString() : null;
    const r = bc.baoCao({ tu, den });
    return {
      so_don: r.tong.don, doanh_so: hienTien(r.tong.doanh_so), lai_gop: hienTien(r.tong.lai_gop), don_hoan: r.tong.hoan, don_huy: r.tong.da_huy,
      ban_chay: r.theo_san_pham.slice(0, 3).map((x) => `Số ${x.so} · ${x.ten}: ${x.so_chiec} chiếc, ${hienTien(x.tien_hang)}`),
    };
  },
};

/* ---------------- gửi ảnh (F-56) ---------------- */

const guiAnh = {
  ten: 'gui_anh_san_pham',
  moTa: 'Gửi ảnh sản phẩm qua Messenger cho khách đang nhắn (tối đa 3 ảnh): ảnh gắn đúng màu khách hỏi, không có thì ảnh đại diện.',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  thamSo: vat({ so: { type: 'integer', description: 'Số sản phẩm' }, mau: chuoi('Màu khách hỏi hoặc ""') }),
  kenhGui: 'messenger', // qua luật Hộp thư: 24 giờ, AI tạm dừng, tần suất (hook hop_thu_gui)
  giay: 40,
  async chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    if (h.kenh !== 'messenger') throw new LoiNghiepVu('SAI_KENH', 'Chỉ gửi ảnh trong Messenger. Ở bình luận thì nhắn riêng trước.');
    const s = sp.layTheoSo(ts.so);
    if (!s || s.trang_thai !== 'dang_ban') throw new LoiNghiepVu('SP_KHONG_BAN_DUOC', `Sản phẩm số ${ts.so} không Đang bán.`);
    const { boDau } = require('../../nghiep-vu/chung');
    const theoMau = ts.mau ? s.anh.filter((a) => a.mau && boDau(a.mau) === boDau(ts.mau)) : [];
    const ds = (theoMau.length ? theoMau : s.anh.slice(0, 1)).slice(0, 3);
    if (!ds.length) throw new LoiNghiepVu('KHONG_CO_ANH', `Sản phẩm số ${ts.so} chưa có ảnh. Báo khách shop sẽ gửi ảnh sau, tạo việc bổ sung.`);
    const nguoi = hopThu.layNguoi(h.nguoi_fb_id);
    const fb = ctx.layKetNoi({ dien_tap: h.dien_tap });
    if (!fb.guiAnh) throw new LoiNghiepVu('FB_CHUA_HO_TRO', 'Kết nối Facebook này chưa gửi được ảnh.');
    let da = 0;
    for (const a of ds) {
      const f = sp.duongAnh(s.id, a.tep);
      if (!f) continue;
      await fb.guiAnh({ page_id: h.page_id, psid: nguoi.psid, anh: fs.readFileSync(f), ten: a.tep });
      da += 1;
    }
    hopThu.ghiChu(h.id, `Đã gửi ${da} ảnh ${sp.tenGoi(s)}${theoMau.length ? ` màu ${ts.mau}` : ''} cho khách.`);
    return { da_gui: da, ghi_chu: theoMau.length || !ts.mau ? '' : `Không có ảnh gắn màu ${ts.mau}: đã gửi ảnh đại diện.` };
  },
};

/* ---------------- tìm mẫu theo ảnh (F-63) ---------------- */

const timMau = {
  ten: 'tim_mau_theo_anh',
  moTa: 'Khách gửi ảnh hỏi "shop có mẫu này không": so ảnh khách với ảnh các sản phẩm Đang bán, trả tối đa 3 mẫu gần giống kèm mức giống. Chỉ nói "gần giống", không nói "giống hệt".',
  nhom: 'doc',
  macDinh: 'cho_phep',
  thamSo: vat({ tin_nhan_id: chuoi('id tin nhắn có ảnh của khách') }),
  giay: 70,
  async chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    const t = hopThu.layTin(ts.tin_nhan_id);
    if (t.hoi_thoai_id !== h.id) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Tin nhắn này không thuộc hội thoại đang xử lý.');
    const { timMauTheoAnh } = require('../agents/tim-mau');
    return timMauTheoAnh(t, { dienTap: h.dien_tap, hoiThoaiId: h.id, ...(ctx.nhaCungCap ? { nhaCungCap: ctx.nhaCungCap } : {}) });
  },
};

/* ---------------- thẻ đơn (#89) ---------------- */

const guiTheDonCC = {
  ten: 'gui_the_don',
  moTa: 'Gửi (lại) cho khách thẻ đơn hàng trong Messenger: món, phí ship, tổng tiền, người nhận, kèm nút "✅ Xác nhận đơn" / "✏️ Sửa đơn". Dùng khi đơn đã đủ tên, số điện thoại, địa chỉ mà khách chưa có thẻ mới nhất (cap_nhat_don đã tự gửi khi đủ thông tin). Khách bấm Xác nhận thì MOZA tự xác nhận và cảm ơn.',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  thamSo: vat({}),
  giay: 25,
  async chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    const d = donCuaKhach(h);
    if (!d) throw new LoiNghiepVu('CHUA_CO_DON', 'Khách chưa có đơn đang mở.');
    const g = await require('../../gui-the-don').guiTheDon({ d, layKetNoi: ctx.layKetNoi });
    if (!g.da_gui) throw new LoiNghiepVu('CHUA_GUI_THE', `${g.ly_do}`);
    return { da_gui: true, ghi_chu: 'Đã gửi thẻ đơn. Nhắn một câu ngắn mời khách kiểm tra và bấm "Xác nhận đơn".' };
  },
};

/* ---------------- mã QR chuyển khoản (F-89, #112) ---------------- */

const guiMaCk = {
  ten: 'gui_ma_chuyen_khoan',
  moTa: 'Gửi cho khách thông tin chuyển khoản của shop: ảnh mã QR (VietQR đúng tổng đơn, nội dung là mã đơn), ngân hàng, số tài khoản, tên chủ tài khoản, kèm câu chống giả shop và nút đổi về trả khi nhận hàng. Chỉ dùng khi đơn đang mở của khách đã chọn chuyển khoản. Không bao giờ tự gõ số tài khoản; không bao giờ nói "đã nhận tiền" — người của shop tự đối chiếu rồi MOZA báo khách.',
  nhom: 'co_anh_huong',
  macDinh: 'cho_phep',
  thamSo: vat({}),
  giay: 30,
  async chay(ts, ctx) {
    const h = canHoiThoai(ctx);
    if (h.kenh !== 'messenger') throw new LoiNghiepVu('SAI_KENH', 'Chỉ gửi mã chuyển khoản trong Messenger. Ở bình luận thì nhắn riêng trước.');
    const d = donCuaKhach(h);
    if (!d) throw new LoiNghiepVu('CHUA_CO_DON', 'Khách chưa có đơn đang mở: lên đơn trước (cap_nhat_don).');
    if (!require('../../nghiep-vu/cai-dat').taiKhoanNhanTien()) {
      throw new LoiNghiepVu('CHUA_CO_TAI_KHOAN', 'Shop chưa điền tài khoản nhận tiền. Nói khách shop sẽ gửi thông tin chuyển khoản sau, hoặc mời trả khi nhận hàng (COD); tạo việc cho người.');
    }
    if (d.thanh_toan !== 'chuyen_khoan') {
      throw new LoiNghiepVu('DON_CHUA_CHON_CK', `Đơn ${d.ma} đang trả khi nhận hàng (COD). Khách muốn chuyển khoản thì gọi cap_nhat_don thong_tin_giao thanh_toan chuyen_khoan trước, rồi gọi lại công cụ này.`);
    }
    if (!['cho_xac_nhan', 'da_xac_nhan'].includes(d.trang_thai)) throw new LoiNghiepVu('DON_KHONG_SUA_DUOC', `Đơn ${d.ma} đang ${d.ten_trang_thai}: không gửi mã chuyển khoản.`);
    if (d.da_nhan_tien_luc) throw new LoiNghiepVu('DA_NHAN_TIEN', `Shop đã đánh dấu nhận tiền đơn ${d.ma}: không gửi mã nữa. Chuyển người nếu khách hỏi thêm.`);
    // #73: khách từng hoàn nhiều → không nhận tiền trước khi người gọi xác nhận.
    const soHoan = d.khach_id ? don.danhSach({ trangThai: 'hoan' }).filter((x) => x.khach_id === d.khach_id).length : 0;
    if (d.trang_thai === 'cho_xac_nhan' && soHoan >= require('../../nghiep-vu/cai-dat').banHang().nguong_hoan) {
      throw new LoiNghiepVu('CAN_GOI_XAC_NHAN', 'Khách từng hoàn nhiều đơn: người của shop gọi xác nhận trước rồi mới gửi mã chuyển khoản. Báo khách nhân viên sẽ gọi, tạo việc gọi xác nhận.');
    }
    // Một khóa mỗi 10 phút: khách xin lại sau đó thì gửi lại được, gọi trùng trong một lượt thì không gửi hai lần.
    const kq = await require('../../chuyen-khoan').guiMaChuyenKhoan({ h, d, layKetNoi: ctx.layKetNoi, khoa: `ck:${d.id}:${d.tong_tien}:${Math.floor(Date.now() / 600000)}` });
    if (!kq.da_gui) throw new LoiNghiepVu('CHUA_GUI_DUOC', kq.ly_do || 'Chưa gửi được mã chuyển khoản.');
    if (kq.trung) return { da_gui: true, ghi_chu: 'Thông tin chuyển khoản vừa gửi ở tin phía trên (không gửi lại): mời khách kéo lên xem mã QR. Không nhắc lại số tài khoản.' };
    hopThu.ghiChu(h.id, `Đã gửi thông tin chuyển khoản đơn ${d.ma}${kq.co_anh ? ' (có mã QR)' : ' (chỉ chữ — ảnh QR chưa tải được)'}.`);
    return { da_gui: true, co_anh: kq.co_anh, ghi_chu: 'Đã gửi thông tin chuyển khoản. Không nhắc lại số tài khoản; không nói đã nhận tiền — shop báo khi đối chiếu xong.' };
  },
};

module.exports = [xemDon, capNhatDon, timDon, xemBaoCao, guiAnh, timMau, guiTheDonCC, guiMaCk];
// GD1: màn Đơn hàng dùng chung bộ đọc món bằng chữ với AI.
module.exports.timMon = timMon;
