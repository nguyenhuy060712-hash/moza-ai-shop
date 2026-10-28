'use strict';

/**
 * Kịch bản live (SPEC.md F-37, #31).
 *
 * Cố ý đơn giản: tên + danh sách đoạn; mỗi đoạn chỉ có sản phẩm (không bắt buộc, đoạn chung để trống) và lời nhắc.
 * Không thêm ô nào khác — chủ dự án dặn thiết kế ít trường.
 */

const { csdl, giaoDich } = require('../db/ket-noi');
const { LoiNghiepVu, taoId, gio, kiemChu } = require('./chung');
const sp = require('./san-pham');

const TOI_DA_DOAN = 50;

function kiemDoan(doan, db) {
  if (!Array.isArray(doan) || doan.length === 0) {
    throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', 'Kịch bản cần ít nhất một đoạn.');
  }
  if (doan.length > TOI_DA_DOAN) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Kịch bản tối đa ${TOI_DA_DOAN} đoạn.`);
  return doan.map((d, i) => {
    const sanPhamId = d?.san_pham_id || null;
    if (sanPhamId && !db.prepare('SELECT 1 FROM san_pham WHERE id = ?').get(sanPhamId)) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Đoạn ${i + 1}: không tìm thấy sản phẩm đã chọn.`);
    }
    const loiNhac = kiemChu(d?.loi_nhac ?? '', { ten: `Lời nhắc đoạn ${i + 1}`, toiDa: 4000 }); // bản 2.9: thoại của đội AI dài hơn
    if (!sanPhamId && !loiNhac) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Đoạn ${i + 1} trống: chọn sản phẩm hoặc ghi lời nhắc.`);
    return { san_pham_id: sanPhamId, loi_nhac: loiNhac };
  });
}

function doc(r) {
  return { ...r, doan: JSON.parse(r.doan) };
}

/**
 * Gợi ý cách Mai nói (bản 2.8, #48): ngoặc tròn ở đầu câu "Mai:" — "(hào hứng, nhanh) Tới áo số 12 rồi…". Tách ra để
 * miệng làm theo mà không đọc thành lời. Nhiều ngoặc liền nhau ở đầu câu thì gộp lại.
 */
function tachCachNoi(cau = '') {
  let loi = String(cau ?? '').trim();
  const goiY = [];
  for (let m = /^\(([^()\n]{1,80})\)\s*/u.exec(loi); m; m = /^\(([^()\n]{1,80})\)\s*/u.exec(loi)) {
    if (m[1].trim()) goiY.push(m[1].trim());
    loi = loi.slice(m[0].length);
  }
  return { cachNoi: [...new Set(goiY)].join(', '), loi };
}

/**
 * Tách lời nhắc thành phần người dẫn nói và phần Mai nói (bản 2.5): dòng bắt đầu bằng "Mai:" là câu Mai nói,
 * các dòng sau nó cũng của Mai cho tới dòng "Người dẫn:". Phần còn lại cho người dẫn (bỏ nhãn "Người dẫn:").
 * Lời nhắc không có nhãn thì toàn bộ là của người dẫn — kịch bản cũ vẫn hiện như trước.
 * Bản 2.8: gợi ý cách nói ở đầu phần "Mai:" trả riêng (`cachNoi`), `mai` chỉ còn lời.
 */
function tachLoiNhac(loiNhac = '') {
  const phan = { nguoi_dan: [], mai: [] };
  let dang = 'nguoi_dan';
  for (const dong of String(loiNhac ?? '').split('\n')) {
    const m = /^\s*(người dẫn|nguoi dan|mai)\s*:\s*(.*)$/iu.exec(dong);
    if (m) {
      dang = /^mai$/iu.test(m[1].trim()) ? 'mai' : 'nguoi_dan';
      if (m[2].trim()) phan[dang].push(m[2].trim());
    } else if (dong.trim()) phan[dang].push(dong.trim());
  }
  const { cachNoi, loi } = tachCachNoi(phan.mai.join(' '));
  return { nguoiDan: phan.nguoi_dan.join('\n'), mai: loi, cachNoi };
}

/**
 * Gắn số, tên, giá, trạng thái, ảnh đại diện của sản phẩm vào từng đoạn để màn hình hiện được. Tên gọi trên sóng theo #60:
 * "áo số 12, Sơ mi linen".
 */
function kemSanPham(kb) {
  const ganSp = (id) => {
    const r = csdl().prepare('SELECT id FROM san_pham WHERE id = ?').get(id);
    if (!r) return null;
    const s = sp.laySanPham(id);
    return {
      id: s.id, so: s.so, ten: s.ten, trang_thai: s.trang_thai, phien_ban: s.phien_ban, gia: s.gia, danh_muc: s.danh_muc,
      ten_goi: sp.tenGoi(s), ten_day_du: sp.tenDayDu(s), anh_dai_dien: s.anh[0]?.tep || null, ten_goi_khac: s.ten_goi_khac,
    };
  };
  return {
    ...kb,
    doan: kb.doan.map((d) => ({ ...d, san_pham: d.san_pham_id ? ganSp(d.san_pham_id) : null })),
  };
}

function taoKichBan(duLieu = {}) {
  return giaoDich((db) => {
    const ten = kiemChu(duLieu.ten, { ten: 'Tên kịch bản', batBuoc: true, toiDa: 100, motDong: true });
    const doan = kiemDoan(duLieu.doan, db);
    const luc = gio();
    const kb = { id: taoId('kb'), ten, doan, tao_luc: luc, sua_luc: luc };
    db.prepare('INSERT INTO kich_ban (id, ten, doan, tao_luc, sua_luc) VALUES (?, ?, ?, ?, ?)')
      .run(kb.id, kb.ten, JSON.stringify(kb.doan), luc, luc);
    return kemSanPham(kb);
  });
}

function layKichBan(id) {
  const r = csdl().prepare('SELECT * FROM kich_ban WHERE id = ?').get(id);
  if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY', 'Không tìm thấy kịch bản này.', 404);
  return kemSanPham(doc(r));
}

function suaKichBan(id, duLieu = {}) {
  return giaoDich((db) => {
    const cu = layKichBan(id);
    const ten = kiemChu(duLieu.ten ?? cu.ten, { ten: 'Tên kịch bản', batBuoc: true, toiDa: 100, motDong: true });
    const doan = kiemDoan(duLieu.doan ?? cu.doan, db);
    const luc = gio();
    db.prepare('UPDATE kich_ban SET ten = ?, doan = ?, sua_luc = ? WHERE id = ?').run(ten, JSON.stringify(doan), luc, id);
    return kemSanPham({ ...cu, ten, doan, sua_luc: luc });
  });
}

function danhSachKichBan() {
  return csdl().prepare('SELECT * FROM kich_ban ORDER BY sua_luc DESC').all().map((r) => kemSanPham(doc(r)));
}

/** Tạo nhanh (F-37): Mở đầu + mỗi sản phẩm Đang bán một đoạn + Kết thúc. */
function taoNhanh() {
  const dsSp = csdl().prepare("SELECT id FROM san_pham WHERE trang_thai = 'dang_ban' ORDER BY so").all();
  if (!dsSp.length) {
    throw new LoiNghiepVu('SP_KHONG_BAN_DUOC', 'Chưa có sản phẩm nào Đang bán. Chuyển ít nhất một sản phẩm sang Đang bán trước.');
  }
  const tenShop = require('./cai-dat').tenShop();
  const phan = Object.fromEntries(new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return taoKichBan({
    ten: `Live ngày ${phan.day}/${phan.month}`,
    doan: [
      { san_pham_id: null, loi_nhac: `Mở đầu: chào cả nhà, giới thiệu ${tenShop} và các mẫu hôm nay. Nhắc cách chốt: bình luận "chốt" + số áo + màu + size.` },
      ...dsSp.map((t) => ({ san_pham_id: t.id, loi_nhac: '' })),
      { san_pham_id: null, loi_nhac: 'Kết thúc: nhắc ai đã chốt mở tin nhắn của shop để xác nhận đơn; ai cần tư vấn size thì nhắn tin cho Page.' },
    ],
  });
}

module.exports = { taoKichBan, layKichBan, suaKichBan, danhSachKichBan, taoNhanh, kemSanPham, tachLoiNhac, tachCachNoi };
