'use strict';

/**
 * Xuất file đơn Cần gửi đúng mẫu nhập hàng loạt của hãng vận chuyển (SPEC.md F-101, 6.4 cách B). Mẫu cột ở
 * server/cau-hinh/mau-xuat-van-chuyen.json; danh mục 34 tỉnh ở server/cau-hinh/tinh-thanh.json.
 *  - Thu hộ = tổng tiền nếu COD chưa nhận tiền, 0 nếu đã nhận (chuyển khoản đã đối chiếu). Giá trị khai = tổng hàng.
 *  - Khối lượng = Σ số lượng × cân nặng của phân loại (hoặc của sản phẩm), thiếu thì 300 g — có cờ.
 *  - Tách tỉnh / xã từ ô địa chỉ tự do: không chắc → cột "Cần sửa địa chỉ" = X (người soát trước khi tải lên). Không tự sửa địa chỉ.
 *  - Không đưa ghi chú đơn (có thể là ghi chú nội bộ) hay lịch sử khách vào file.
 */

const { csdl } = require('../db/ket-noi');
const { boDau } = require('./chung');

const MAU = () => require('../cau-hinh/mau-xuat-van-chuyen.json');
const TINH = () => require('../cau-hinh/tinh-thanh.json').tinh;
const KHOI_LUONG_MAC_DINH_G = 300;

/** Chữ bỏ dấu, gọn khoảng trắng, bỏ dấu câu (so tên tỉnh). */
const gon = (s) => ` ${boDau(s).replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * Tách tỉnh / xã từ địa chỉ tự do ("12 Lý Thái Tổ, P. Suối Hoa, Bắc Ninh").
 * @returns {{tinh:string, xa:string, con_lai:string, chac:boolean, ten_cu:boolean}}
 */
function tachDiaChi(diaChi) {
  const goc = String(diaChi || '').trim();
  const phan = goc.split(/\s*[,;\n]\s*/).filter(Boolean);
  if (!phan.length) return { tinh: '', xa: '', con_lai: '', chac: false, ten_cu: false };
  // Tìm tỉnh từ phần cuối lên (tên mới trước, tên cũ sau).
  for (let i = phan.length - 1; i >= 0; i--) {
    const p = gon(phan[i].replace(/^(tỉnh|tinh|thành phố|thanh pho|tp\.?)\s*/i, ''));
    for (const t of TINH()) {
      const moi = [t.ten, ...t.goi_khac].some((x) => p === gon(x));
      const cu = !moi && t.cu.some((x) => p === gon(x));
      if (!moi && !cu) continue;
      const xa = i > 0 ? phan[i - 1].replace(/^(phường|phuong|p\.|xã|xa|x\.|đặc khu|dac khu|thị trấn|tt\.?)\s*/i, '').trim() : '';
      const conLai = phan.slice(0, Math.max(0, i - 1)).join(', ');
      return { tinh: t.ten, xa, con_lai: conLai, chac: !!xa && !!conLai && !cu, ten_cu: cu };
    }
  }
  return { tinh: '', xa: '', con_lai: goc, chac: false, ten_cu: false };
}

/** Khối lượng đơn (g); `mac_dinh` = có món thiếu cân nặng (dùng 300 g). */
function khoiLuong(d) {
  const db = csdl();
  let g = 0;
  let macDinh = false;
  for (const x of d.dong) {
    const pl = db.prepare('SELECT can_nang_g FROM phan_loai WHERE id = ?').get(x.phan_loai_id);
    const sp = db.prepare('SELECT can_nang_g FROM san_pham WHERE id = ?').get(x.san_pham_id);
    const moi = pl?.can_nang_g || sp?.can_nang_g;
    if (!moi) macDinh = true;
    g += x.so_luong * (moi || KHOI_LUONG_MAC_DINH_G);
  }
  return { g, mac_dinh: macDinh };
}

/** Các trường của một đơn cho file xuất. */
function truongCua(d) {
  const kh = require('./khach');
  const dc = tachDiaChi(d.dia_chi_nhan);
  const kl = khoiLuong(d);
  return {
    ma_don: d.ma, ngay_tao: new Date(d.tao_luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), trang_thai: d.ten_trang_thai,
    ten_nhan: d.ten_nhan, sdt: kh.hienSdt(d.sdt_nhan), dia_chi: d.dia_chi_nhan, dia_chi_con_lai: dc.con_lai || d.dia_chi_nhan, tinh: dc.tinh, xa: dc.xa,
    ten_hang: d.dong.map((x) => `${x.ten_chup} x${x.so_luong}`).join('; '), so_luong: d.dong.reduce((n, x) => n + x.so_luong, 0),
    khoi_luong_g: kl.g, khoi_luong_mac_dinh: kl.mac_dinh,
    thu_ho: d.da_nhan_tien_luc ? 0 : d.tong_tien, gia_tri_khai: d.tong_hang, tong_hang: d.tong_hang, phi_ship: d.phi_ship, tong_tien: d.tong_tien,
    thanh_toan: d.thanh_toan === 'cod' ? 'COD' : 'Chuyển khoản', da_nhan_tien: d.da_nhan_tien_luc ? 'Có' : 'Chưa', ma_van_don: d.ma_van_don,
    can_sua_dia_chi: dc.chac ? '' : 'X', dia_chi_chac: dc.chac, dia_chi_ten_cu: dc.ten_cu,
  };
}

const o = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** File "Chung" — y hệt file CSV trước BH8 (so byte trong test). Cột Ghi chú giữ như cũ để không đổi thói quen. */
function csvChung(ds) {
  const dong = [['Mã đơn', 'Ngày tạo', 'Trạng thái', 'Người nhận', 'Số điện thoại', 'Địa chỉ', 'Món', 'Tổng hàng', 'Phí ship', 'Tổng tiền',
    'Thanh toán', 'Đã nhận tiền', 'Mã vận đơn', 'Ghi chú'].map(o).join(',')];
  const kh = require('./khach');
  for (const d of ds) {
    dong.push([d.ma, new Date(d.tao_luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), d.ten_trang_thai, d.ten_nhan,
      kh.hienSdt(d.sdt_nhan), d.dia_chi_nhan, d.dong.map((x) => `${x.ten_chup} x${x.so_luong}`).join('; '), d.tong_hang, d.phi_ship,
      d.tong_tien, d.thanh_toan === 'cod' ? 'COD' : 'Chuyển khoản', d.da_nhan_tien_luc ? 'Có' : 'Chưa', d.ma_van_don, d.ghi_chu].map(o).join(','));
  }
  return `﻿${dong.join('\r\n')}`;
}

/** Danh sách mẫu (Cài đặt → ô chọn hãng; màn Đơn hàng). */
function danhSachMau() {
  return Object.entries(MAU().hang).map(([ma, m]) => ({ ma, ten: m.ten, trang_thai: m.trang_thai, nguon: m.nguon || null }));
}

/**
 * Xuất file theo hãng. @returns {{ten_tep:string, noi_dung:string, can_sua:{ma:string, dia_chi:string}[], khoi_luong_mac_dinh:string[]}}
 */
function xuat(ds, hang = 'chung') {
  const m = MAU().hang[hang];
  const { LoiNghiepVu } = require('./chung');
  if (!m) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không có mẫu hãng vận chuyển này.', 404);
  if (m.trang_thai !== 'dung_duoc') throw new LoiNghiepVu('CAN_FILE_MAU', `Chưa có mẫu cột của ${m.ten}: tải file mẫu ở ${m.nguon} rồi đưa Claude Code điền. Tạm dùng "Nhập hàng loạt".`, 409);
  const ngay = new Date().toISOString().slice(0, 10);
  const truong = ds.map(truongCua);
  const canSua = truong.filter((x) => x.can_sua_dia_chi).map((x) => ({ ma: x.ma_don, dia_chi: x.dia_chi }));
  const klMacDinh = truong.filter((x) => x.khoi_luong_mac_dinh).map((x) => x.ma_don);
  if (m.cot === '__file_hien_tai__') return { ten_tep: `don-hang-${ngay}.csv`, noi_dung: csvChung(ds), can_sua: [], khoi_luong_mac_dinh: [] };
  const lay = (x, k) => (String(k).startsWith('co_dinh:') ? k.slice(8) : x[k]);
  const dong = [m.cot.map((c) => o(c.tieu_de)).join(','), ...truong.map((x) => m.cot.map((c) => o(lay(x, c.lay))).join(','))];
  return { ten_tep: `don-${hang}-${ngay}.csv`, noi_dung: `﻿${dong.join('\r\n')}`, can_sua: canSua, khoi_luong_mac_dinh: klMacDinh };
}

module.exports = { tachDiaChi, khoiLuong, truongCua, xuat, csvChung, danhSachMau, KHOI_LUONG_MAC_DINH_G };
