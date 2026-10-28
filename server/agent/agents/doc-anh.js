'use strict';

/**
 * "Tạo từ ảnh" (SPEC.md F-51, #75): AI nhìn 1–9 ảnh sản phẩm, điền trước tên gợi ý, danh mục, thông số theo danh mục,
 * màu thấy trong từng ảnh, mô tả, điểm nổi bật, tên gọi khác; gợi ý bảng Màu × Cỡ. Người gõ giá, tồn, sửa chỗ sai.
 *
 *  - AI **không** điền giá, tồn, giá vốn, xuất xứ; thương hiệu chỉ khi đọc được trên nhãn trong ảnh; chất liệu chỉ khi
 *    đọc được trên nhãn hoặc nhìn rõ — không chắc thì để trống và ghi vào "cần xác nhận" (mục 9).
 *  - Phiếu theo lược đồ; thông số là danh sách {khoa, gia_tri} rồi MOZA kiểm lại theo thong-so.json (lựa chọn lạ bị bỏ).
 *  - Kết quả là phiếu chưa lưu: ô AI điền mang nhãn "AI đoán" (ai_doan) tới khi người xác nhận.
 * Model theo mục 6: gemini-3.8-flash suy nghĩ thấp, dự phòng gpt-6-sol (agent `doc_anh`).
 */

const fs = require('node:fs');
const { chayAgent } = require('../runtime');
const sp = require('../../nghiep-vu/san-pham');
const skill = require('../../nghiep-vu/skill');
const { LoiNghiepVu, boDau } = require('../../nghiep-vu/chung');

const chuoi = (d) => ({ type: 'string', description: d });
const mang = (d) => ({ type: 'array', items: { type: 'string' }, description: d });

function luocDo() {
  const { danh_muc: dm } = sp.cauHinh();
  return {
    type: 'object',
    properties: {
      ten: chuoi('Tên gợi ý ngắn, kiểu người bán đặt: loại + điểm nhận ra (ví dụ "Sơ mi linen tay ngắn")'),
      danh_muc: { type: 'string', enum: dm.map((d) => d.khoa) },
      thong_so: {
        type: 'array',
        description: 'Thông số nhìn thấy được. khoa lấy từ danh sách thông số; gia_tri là khóa lựa chọn (kiểu chọn) hoặc chữ (kiểu chữ)',
        items: {
          type: 'object',
          properties: { khoa: chuoi('Khóa thông số'), gia_tri: mang('Một giá trị (chọn một, chữ) hoặc nhiều (chọn nhiều)') },
          required: ['khoa', 'gia_tri'],
          additionalProperties: false,
        },
      },
      mau: mang('Các màu của sản phẩm thấy trong ảnh, tên màu tiếng Việt ngắn viết hoa chữ đầu (Đen, Trắng, Be, Xanh navy…)'),
      anh_mau: { type: 'array', items: { type: 'string' }, description: 'Màu của từng ảnh theo thứ tự ảnh; ảnh nhiều màu hoặc không rõ thì ""' },
      co: mang('Các cỡ nếu đọc được trên nhãn / bảng trong ảnh; không đọc được thì []'),
      thuong_hieu: chuoi('Chỉ khi đọc được chữ thương hiệu trên nhãn trong ảnh; không thì ""'),
      mo_ta: chuoi('Đoạn giới thiệu cho khách, 2–4 câu, chỉ điều nhìn thấy (kiểu dáng, chi tiết, dịp mặc hợp); không bịa chất liệu, xuất xứ, công dụng'),
      diem_noi_bat: mang('3–5 ý ngắn, là nguồn chính cho lời dẫn live; chỉ điều nhìn thấy'),
      ten_goi_khac: mang('Cách khách hay gọi kiểu áo này (ví dụ "áo babydoll", "sơ mi đũi"), tối đa 5'),
      can_xac_nhan: mang('Những điều người bán cần xác nhận vì không nhìn chắc được (ví dụ "chất liệu", "độ co giãn")'),
    },
    required: ['ten', 'danh_muc', 'thong_so', 'mau', 'anh_mau', 'co', 'thuong_hieu', 'mo_ta', 'diem_noi_bat', 'ten_goi_khac', 'can_xac_nhan'],
    additionalProperties: false,
  };
}

/** Danh sách thông số kèm lựa chọn, cho AI chọn đúng khóa. */
function moTaThongSo() {
  const { thong_so: ts, danh_muc: dm } = sp.cauHinh();
  const dong = ['## Danh mục (chọn đúng khóa)', ...dm.map((d) => `- ${d.khoa}: ${d.ten}`), '', '## Thông số (khoa: tên — kiểu — lựa chọn khóa=tên)'];
  for (const [k, t] of Object.entries(ts)) {
    if (k === 'xuat_xu') continue; // AI không đoán xuất xứ (#75)
    const lc = t.lua_chon ? Object.entries(t.lua_chon).map(([a, b]) => `${a}=${b}`).join(', ') : '(chữ)';
    dong.push(`- ${k}: ${t.ten} — ${t.kieu === 'mot' ? 'chọn một' : t.kieu === 'nhieu' ? 'chọn nhiều' : 'chữ'} — ${lc}${t.co_ghi ? ` (có thể thêm khoa "${k}_ghi" dạng chữ)` : ''}`);
  }
  return dong.join('\n');
}

/** Phiếu AI → bản nháp sản phẩm (chưa lưu) + danh sách ô AI đoán. */
function thanhNhap(ph, tepAnh) {
  const vao = {};
  for (const x of ph.thong_so || []) {
    const k = String(x.khoa || '');
    const ts = sp.cauHinh().thong_so[k.replace(/_ghi$/, '')];
    if (!ts || k === 'xuat_xu') continue;
    vao[k] = ts.kieu === 'nhieu' && !k.endsWith('_ghi') ? x.gia_tri : x.gia_tri?.[0] ?? '';
  }
  const danhMuc = sp.danhMuc(ph.danh_muc) ? ph.danh_muc : 'ao_thun';
  const { thongSo } = sp.kiemThongSo(danhMuc, vao);
  const mau = [...new Set((ph.mau || []).map((m) => String(m).trim()).filter(Boolean))].slice(0, 12);
  const khoaMau = (m) => boDau(m).trim();
  const anh = tepAnh.map((tep, i) => {
    const m = String(ph.anh_mau?.[i] || '').trim();
    return { tep, mau: mau.find((x) => khoaMau(x) === khoaMau(m)) || null };
  });
  const aiDoan = [
    ...Object.keys(thongSo).filter((k) => !k.endsWith('_ghi')).map((k) => `thong_so.${k}`),
    ...(ph.mo_ta ? ['mo_ta'] : []), ...(ph.diem_noi_bat?.length ? ['diem_noi_bat'] : []), ...(ph.ten_goi_khac?.length ? ['ten_goi_khac'] : []),
  ];
  return {
    ten: String(ph.ten || '').trim().slice(0, 120),
    danh_muc: danhMuc,
    thuong_hieu: String(ph.thuong_hieu || '').trim().slice(0, 80),
    thong_so: thongSo,
    nhom: { t1: 'Màu', t2: sp.danhMuc(danhMuc)?.bo === 'phu_kien' ? null : 'Cỡ' },
    gia_tri_1: mau.length ? mau : ['Mặc định'],
    gia_tri_2: (ph.co || []).map((c) => String(c).trim()).filter(Boolean).slice(0, 10),
    anh,
    mo_ta: String(ph.mo_ta || '').trim().slice(0, 5000),
    diem_noi_bat: (ph.diem_noi_bat || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 8),
    ten_goi_khac: (ph.ten_goi_khac || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 5),
    ai_doan: aiDoan,
    can_xac_nhan: (ph.can_xac_nhan || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 8),
  };
}

/**
 * @param {string[]} tepAnh  tên tệp ảnh đã tải vào khu tạm (`POST /api/anh-tam`)
 * @param {object} [o]  nhaCungCap (test)
 */
async function docAnh(tepAnh, { nhaCungCap } = {}) {
  const ds = [...new Set((tepAnh || []).map(String))].slice(0, 9);
  if (!ds.length) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', 'Chưa có ảnh nào. Kéo 1–9 ảnh sản phẩm vào.');
  const anh = ds.map((tep) => {
    const f = sp.duongAnh('tam', tep);
    if (!f) throw new LoiNghiepVu('ANH_KHONG_HOP_LE', 'Không tìm thấy ảnh đã tải. Tải ảnh lại.');
    const buf = fs.readFileSync(f);
    return { mime: buf[0] === 0x89 ? 'image/png' : 'image/jpeg', base64: buf.toString('base64') };
  });
  let k = null;
  try { k = skill.moSkill('doc-anh-san-pham', null); } catch { /* chưa có Skill: dùng lời dặn */ }
  const tinDau = [
    `Đây là ${ds.length} ảnh của MỘT sản phẩm (có thể nhiều màu). Điền phiếu JSON theo lược đồ.`,
    moTaThongSo(),
    '',
    'Quy tắc:',
    '- Chỉ điền điều nhìn thấy trong ảnh. Không đoán giá, không đoán xuất xứ. Thương hiệu, chất liệu chỉ khi đọc được trên nhãn (hoặc chất liệu nhìn rõ như jean, len đan); không chắc thì để trống và ghi vào can_xac_nhan.',
    '- mau: mọi màu của sản phẩm thấy trong các ảnh; anh_mau: màu của từng ảnh theo đúng thứ tự ảnh.',
    '- ten: ngắn gọn như người bán đặt. mo_ta 2–4 câu, diem_noi_bat 3–5 ý ngắn — viết cho khách, không khoa trương.',
  ].join('\n');
  const kq = await chayAgent({
    agentId: 'doc_anh',
    kichHoat: `Tạo từ ảnh (${ds.length} ảnh)`,
    tinDau,
    anh,
    phan: k ? [`## Skill: ${k.ten}\nCách làm:\n${k.cach_lam}${k.vi_du_dung ? `\nVí dụ đúng: ${k.vi_du_dung}` : ''}${k.vi_du_sai ? `\nVí dụ sai: ${k.vi_du_sai}` : ''}`] : [],
    luocDo: luocDo(),
    nguonDaDua: k ? { skill: { [k.id]: k.phien_ban } } : {},
    boQuaKhanCap: true,
    ...(nhaCungCap ? { nhaCungCap } : {}),
  });
  if (!kq.ok) return kq;
  return { ...kq, nhap: thanhNhap(kq.ketQua, ds) };
}

module.exports = { docAnh, thanhNhap, luocDo };
