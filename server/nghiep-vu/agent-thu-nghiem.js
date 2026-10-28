'use strict';

/**
 * Agent thử nghiệm (SPEC.md F-34, Agent Registry): thêm Agent mới bằng cấu hình, không sửa mã.
 *  - Chỉ được gán công cụ nhóm "Đọc" (không bao giờ nhóm "Có ảnh hưởng thật"); danh sách nhóm do nơi gọi đưa vào.
 *  - Chạy bằng nút; tắt thì không chạy. Ba Agent chính không đổi gì.
 */

const { csdl } = require('../db/ket-noi');
const { LoiNghiepVu, kiemChu, boDau } = require('./chung');
const caiDat = require('./cai-dat');
const vaiTro = require('./vai-tro');

/**
 * @param {object} o
 * @param {string} o.ten
 * @param {string} o.muc_tieu
 * @param {string} o.loi_dan
 * @param {string} [o.nha]
 * @param {string} [o.model]
 * @param {string[]} [o.cong_cu]
 * @param {(ten:string)=>string|null} nhomCongCu   nhóm của một công cụ ('doc' | 'noi_bo' | 'co_anh_huong'), null nếu không có
 */
function taoAgent(o, nhomCongCu) {
  const ten = kiemChu(o.ten, { ten: 'Tên Agent', batBuoc: true, toiDa: 80, motDong: true });
  const mucTieu = kiemChu(o.muc_tieu, { ten: 'Mục tiêu', batBuoc: true, toiDa: 300 });
  const nha = o.nha || 'openai';
  const model = o.model || 'gpt-6-luna';
  const md = caiDat.MAC_DINH.nha[nha];
  if (!md || !md.model.includes(model)) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có model "${model}" của nhà "${nha}".`);
  const congCu = [...new Set(o.cong_cu || [])];
  for (const c of congCu) {
    const nhom = nhomCongCu(c);
    if (!nhom) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', `Không có công cụ "${c}".`);
    if (nhom !== 'doc') throw new LoiNghiepVu('CONG_CU_KHONG_DUOC_CAP', `Agent thử nghiệm chỉ được dùng công cụ nhóm Đọc; "${c}" không phải.`);
  }
  let id = `tn_${boDau(ten).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'agent'}`;
  for (let i = 2; csdl().prepare('SELECT 1 FROM agent WHERE id = ?').get(id); i++) id = `${id.replace(/_\d+$/, '')}_${i}`;
  csdl().prepare(`INSERT INTO agent (id, ten, muc_tieu, nha, model, muc_suy_nghi, nha_du_phong, model_du_phong, cong_cu, gioi_han, thu_nghiem, bat)
                  VALUES (?, ?, ?, ?, ?, 'thap', NULL, NULL, ?, '{"so_buoc":4,"giay":60}', 1, 1)`)
    .run(id, ten, mucTieu, nha, model, JSON.stringify(congCu));
  vaiTro.gieoChoAgent(id, o.loi_dan);
  return caiDat.layAgent(id);
}

/** Bật / tắt một Agent thử nghiệm. Ba Agent chính bật tắt ở chỗ khác nên không cho đụng ở đây. */
function datBat(id, bat) {
  const a = caiDat.layAgent(id);
  if (!a.thu_nghiem) throw new LoiNghiepVu('KHONG_PHAI_THU_NGHIEM', 'Chỉ bật / tắt Agent thử nghiệm ở đây.', 409);
  csdl().prepare('UPDATE agent SET bat = ? WHERE id = ?').run(bat ? 1 : 0, id);
  return caiDat.layAgent(id);
}

function danhSach() {
  return caiDat.danhSachAgent().filter((a) => a.thu_nghiem);
}

module.exports = { taoAgent, datBat, danhSach };
