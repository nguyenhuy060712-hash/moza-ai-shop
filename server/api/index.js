'use strict';

/**
 * API HTTP `/api` (SPEC.md mục 8). Chỉ gọi vào khối Nghiệp vụ, không viết SQL ở đây.
 * Lỗi luôn trả dạng { loi: { ma, thong_diep } } để màn hình hiện đúng câu cho người dùng.
 */

const express = require('express');
const { LoiNghiepVu } = require('../nghiep-vu/chung');

// Đường không tồn tại gần như luôn do file đã cập nhật mà chương trình đang chạy vẫn là bản cũ.
const BAN_CU = 'Chương trình đang chạy là bản cũ. Tắt cửa sổ đen rồi bấm đúp CHAY PHAN MEM.bat lại.';

function taoApi() {
  const r = express.Router();
  // Nhân bản giọng gửi lên hai đoạn ghi âm WAV (khoảng 30 + 10 giây, 24 kHz) dạng base64: cần giới hạn lớn hơn.
  // Gắn trước bộ đọc chung; bộ đọc chung thấy thân đã đọc thì bỏ qua.
  r.use('/giong-mai/nhan-ban', express.json({ limit: '12mb' }));
  r.use(/^\/nhin\/[^/]+\/bang-mau$/, express.json({ limit: '6mb' })); // F-107: bảng mẫu ảnh ghép
  r.use(express.json({ limit: '1mb' }));
  r.use(require('./san-pham'));
  r.use(require('./don'));
  r.use(require('./so-tay'));
  r.use(require('./cai-dat'));
  r.use(require('./giong-mai'));
  r.use(require('./doi-ai'));
  r.use(require('./ket-noi'));
  r.use(require('./hop-thu'));
  r.use(require('./bao-cao'));
  r.use(require('./kich-ban'));
  r.use(require('./live'));
  r.use(require('./truoc-live')); // F-96
  r.use(require('./anh-khach')); // F-104
  r.use(require('./nhin')); // F-107
  r.use(require('./dien-tap'));
  r.use(require('./man-hinh'));
  r.use(require('./agent'));

  r.use((req, res) => res.status(404).json({ loi: { ma: 'KHONG_CO_DUONG', thong_diep: BAN_CU } }));

  // eslint-disable-next-line no-unused-vars
  r.use((e, req, res, next) => {
    if (e instanceof LoiNghiepVu) return res.status(e.http).json({ loi: { ma: e.ma, thong_diep: e.message } });
    // Google hết lượt đọc giọng trong ngày (25/9/2026): báo đúng lời, không gắn "lỗi trong phần mềm".
    if (e.ma === 'HET_LUOT_NGAY') return res.status(429).json({ loi: { ma: e.ma, thong_diep: e.message } });
    if (e.type === 'entity.parse.failed') {
      return res.status(400).json({ loi: { ma: 'DU_LIEU_KHONG_HOP_LE', thong_diep: 'Dữ liệu gửi lên không đọc được.' } });
    }
    if (e.type === 'entity.too.large') {
      return res.status(413).json({ loi: { ma: 'DU_LIEU_KHONG_HOP_LE', thong_diep: 'Dữ liệu gửi lên quá lớn.' } });
    }
    // Chỉ ghi thông điệp lỗi, không ghi nội dung yêu cầu: có thể chứa khóa người dùng vừa dán.
    console.error(`  [lỗi] ${req.method} ${req.path}: ${e.message}`);
    res.status(500).json({ loi: { ma: 'LOI_MAY', thong_diep: 'Có lỗi xảy ra trong phần mềm: ' + e.message } });
  });
  return r;
}

module.exports = { taoApi };
