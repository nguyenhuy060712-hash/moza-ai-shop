'use strict';

/**
 * Đồ dùng chung cho test: mọi test chạy trên thư mục dữ liệu tạm và file .env tạm,
 * không bao giờ đụng data/ hay .env thật của người dùng.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

// Xóa thư mục tạm khi test xong, để chạy test nhiều lần không đầy ổ đĩa. Windows có lúc còn giữ tệp cơ sở dữ liệu
// vừa đóng một nhịp: thử lại vài lần (24/9/2026 tìm thấy 85 thư mục test sót lại trên ổ C đã đầy).
function xoa(thuMuc) {
  try { fs.rmSync(thuMuc, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* vẫn bị giữ thì thôi */ }
}

function thuMucTam() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'moza-test-'));
  process.env.MOZA_FILE_ENV = path.join(d, '.env');
  return d;
}

/** Mở cơ sở dữ liệu tạm, gieo dữ liệu mặc định như lúc khởi động. */
async function moCSDLTam() {
  const thuMuc = thuMucTam();
  const { moCSDL, dongCSDL } = require('../server/db/ket-noi');
  await moCSDL(thuMuc);
  require('../server/nghiep-vu/cai-dat').gieoMacDinh();
  require('../server/nghiep-vu/so-tay').gieoMucMoi();
  require('../server/nghiep-vu/vai-tro').gieoVaiTro();
  require('../server/nghiep-vu/skill').gieoSkill();
  return { thuMuc, dong: () => { dongCSDL(); xoa(thuMuc); } };
}

/** Chạy cả phần mềm trên cổng ngẫu nhiên. */
async function moPhanMem() {
  const thuMuc = thuMucTam();
  const { khoiDong } = require('../server/index');
  const pm = await khoiDong({ thuMucDuLieu: thuMuc, cong: 0 });
  const goc = `http://127.0.0.1:${pm.cong}`;

  /** Gọi API; trả { ma, than } với than đã đọc JSON (nếu được). */
  async function goi(phuongThuc, duongDan, than, dau = {}) {
    const r = await fetch(goc + duongDan, {
      method: phuongThuc,
      headers: { ...(than !== undefined ? { 'Content-Type': 'application/json' } : {}), ...dau },
      body: than === undefined ? undefined : typeof than === 'string' ? than : JSON.stringify(than),
    });
    const chu = await r.text();
    let j = null;
    try { j = JSON.parse(chu); } catch { /* không phải JSON */ }
    return { ma: r.status, than: j, chu };
  }

  /** Gửi yêu cầu với tên máy (Host) tùy chọn — fetch của Node không cho đổi Host. */
  function goiVoiHost(host, duongDan) {
    return new Promise((ok, loi) => {
      const q = http.request({ host: '127.0.0.1', port: pm.cong, path: duongDan, headers: { Host: host } }, (res) => {
        res.resume();
        res.on('end', () => ok(res.statusCode));
      });
      q.on('error', loi);
      q.end();
    });
  }

  return { thuMuc, cong: pm.cong, goc, goi, goiVoiHost, dong: async () => { await pm.dong(); xoa(thuMuc); } };
}

/** Ảnh JPEG giả (đủ đầu tệp để MOZA nhận là ảnh). */
const ANH_GIA = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);

/**
 * Tạo sản phẩm mẫu cho test (cần cơ sở dữ liệu đã mở): mặc định áo sơ mi số 12, 289.000đ, màu Đen/Trắng × cỡ M/L,
 * mỗi ô tồn 5, Đang bán, một ảnh giả, có bảng size.
 * @returns {{ san_pham: object, phan_loai: object[], pl: (gt1:string, gt2?:string) => object }}
 */
function taoSanPhamMau({ so = 12, ten = 'Sơ mi linen tay ngắn', danhMuc = 'ao_so_mi', gia = '289k', giaVon = '150k', mau = ['Đen', 'Trắng'],
  co = ['M', 'L'], ton = 5, trangThai = 'dang_ban', them = {} } = {}) {
  const sp = require('../server/nghiep-vu/san-pham');
  const bangSize = require('../server/nghiep-vu/bang-size');
  const bang = bangSize.danhSachBang().find((b) => b.ten === 'Áo test') || bangSize.taoBang({ ten: 'Áo test', cot: ['chieu_cao', 'can_nang'], hang: [
    { co: 'S', chieu_cao: '148-155', can_nang: '40-47' }, { co: 'M', chieu_cao: '155-162', can_nang: '48-55' },
    { co: 'L', chieu_cao: '160-167', can_nang: '55-62' }, { co: 'XL', chieu_cao: '165-172', can_nang: '62-70' }] });
  const tep = sp.luuAnhTam(ANH_GIA);
  const phanLoai = [];
  for (const m of mau) for (const c of co.length ? co : [null]) phanLoai.push({ gt1: m, gt2: c, ton });
  const kq = sp.taoSanPham({
    so, ten, danh_muc: danhMuc, trang_thai: trangThai, gia, gia_von: giaVon, ghi_chu_noi_bo: 'nhập xưởng A',
    thong_so: { doi_tuong: 'nu', chat_lieu: ['linen'], kieu_dang: 'suong' }, bang_size_id: bang.id,
    nhom: { t1: 'Màu', t2: co.length ? 'Cỡ' : null }, phan_loai: phanLoai, anh: [{ tep, mau: mau[0] }],
    diem_noi_bat: ['vải linen mát, thấm hút', 'form suông che bụng'], mo_ta: 'Sơ mi linen mặc đi làm, đi chơi đều hợp.', ...them,
  });
  const pl = (gt1, gt2 = null) => kq.phan_loai.find((p) => p.gt1 === gt1 && (p.gt2 || null) === gt2);
  return { ...kq, pl };
}

module.exports = { thuMucTam, moCSDLTam, moPhanMem, taoSanPhamMau, ANH_GIA };
