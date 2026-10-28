'use strict';

/**
 * Thử AI thật BH8 (SPEC.md mục 12, docs/08 "Thử AI thật" của F-95, F-96, F-102): ba agent trên gpt-6-luna, tắt dự phòng Gemini
 * (Google 0 đồng). Trần 0,08 USD — vượt là dừng. Cơ sở dữ liệu TẠM ở data/tam-test/thu-ai-bh8 (không đụng data/moza.db);
 * khóa đọc từ .env / Cài đặt (chỉ đọc).
 *   1. "Nói với Mai": "phí ship 10 nghìn, trên 200 nghìn miễn ship, giờ nghe máy 8 giờ sáng tới 9 giờ tối" → bảng xem trước đúng số.
 *   2. Soạn bài báo trước live (soan_bai) cho 3 món → không lỗi kiểm, không số lạ.
 *   3. Tổng kết buổi 8 người chốt (tong_ket) → ≤ 3 gợi ý, mọi số có trong số liệu.
 * Chạy: "C:\Program Files\nodejs\node.exe" scripts/thu-ai-bh8.js   (MOZA_AI_GIA=1: chạy khô bằng AI giả, 0 đồng)
 * Kết quả: màn hình + data/tam-test/thu-ai-bh8/ket-qua.json. Ước 0,02–0,04 USD.
 */

process.chdir(require('node:path').join(__dirname, '..'));
const path = require('node:path');
const fs = require('node:fs');

const TAM = path.resolve('data/tam-test/thu-ai-bh8');
fs.rmSync(TAM, { recursive: true, force: true });
fs.mkdirSync(TAM, { recursive: true });
const TRAN_USD = 0.08;
const GIA = process.env.MOZA_AI_GIA === '1';

(async () => {
  if (!GIA && !require('../server/khoa').trangThai().openai.co) { console.log('Chưa có khóa OpenAI (.env hoặc Cài đặt → Khóa AI): không chạy, 0 đồng.'); process.exit(3); }
  const { moCSDL, csdl } = require('../server/db/ket-noi');
  await moCSDL(TAM);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  caiDat.gieoMacDinh();
  require('../server/nghiep-vu/so-tay').gieoMucMoi();
  require('../server/nghiep-vu/vai-tro').gieoVaiTro();
  require('../server/nghiep-vu/skill').gieoSkill();
  // Chỉ OpenAI gpt-6-luna, không dự phòng (Google 0 đồng).
  const goc = caiDat.layAgent;
  caiDat.layAgent = (id) => ({ ...goc(id), nha: 'openai', model: 'gpt-6-luna', nha_du_phong: null, model_du_phong: null, nang_cap: {} });
  caiDat.datBanHang({ ten_shop: 'Moza Shop', sdt_shop: '0987654321', ten_chu_tk: 'Nguyễn Thị Hoa' });
  const tongUsd = () => csdl().prepare('SELECT COALESCE(SUM(chi_phi_usd), 0) AS n FROM agent_run').get().n;
  const kiemTran = () => { if (tongUsd() > TRAN_USD) { console.log(`DỪNG: chạm trần ${TRAN_USD} USD`); process.exit(2); } };
  // AI giả cho lần chạy khô (MOZA_AI_GIA=1): trả phiếu tối thiểu hợp lược đồ.
  const nhaGia = { async goi({ luocDo }) {
    const p = luocDo?.properties?.goi_y ? { goi_y: [{ viec: 'Nhắn nhắc thông tin giao sớm hơn', vi_sao: '8 người chốt, 3 đơn có khách trả lời tin' }] }
      : luocDo?.properties?.bai_nha_hang ? { su_kien: { tieu_de: 'Live {lich}', mo_ta: 'Moza Shop live {so_mon} món, bình luận {cu_phap}.' }, bai_nha_hang: 'Tối nay {so_mon} món mới, bình luận món muốn xem kèm size.', reels: ['a', 'b', 'c'] }
        : { tra_loi: 'Mai ghi phí ship 10.000đ, miễn ship từ 200.000đ.', man_hinh: '' };
    return { goiCongCu: [], chu: JSON.stringify(p), goc: null, tokenVao: 1, tokenRa: 1 };
  } };
  const nhaCungCap = GIA ? { openai: nhaGia, gemini: nhaGia, anthropic: nhaGia } : null;
  const ketQua = {};
  const { taoSanPhamMau } = require('../test/ho-tro');
  const a = taoSanPhamMau({ gia: '289k', co: ['S', 'M', 'L'], mau: ['Trắng', 'Be'], ton: 20 });
  taoSanPhamMau({ so: 15, ten: 'Quần jean ống suông', danhMuc: 'quan_jean', gia: '359k', mau: ['Xanh'], co: ['S', 'M'], ton: 10 });
  taoSanPhamMau({ so: 25, ten: 'Chân váy chữ A xếp ly', danhMuc: 'chan_vay', gia: '199k', mau: ['Be'], co: ['M'], ton: 10 });

  // 1. Nói với Mai điền thông tin shop
  const { noiVoiMai } = require('../server/agent/agents/quan-ly');
  const cau = 'phí ship 10 nghìn, trên 200 nghìn miễn ship, giờ nghe máy 8 giờ sáng tới 9 giờ tối';
  const m = await noiVoiMai(cau, { ...(nhaCungCap ? { nhaCungCap } : {}) });
  ketQua.noi_voi_mai = { cau, tra_loi: m.tra_loi, viec: m.viec.map((v) => v.xem_truoc) };
  console.log('\n1) Nói với Mai:', cau, '\n   →', m.tra_loi, '\n   bảng:', JSON.stringify(ketQua.noi_voi_mai.viec));
  console.log(`   [chi phí lũy kế ${tongUsd().toFixed(4)} USD]`);
  kiemTran();

  // 2. Soạn bài báo trước live
  require('../server/nghiep-vu/lich-live').datLich({ buoi: [{ thu: 2, gio: '20:00' }, { thu: 4, gio: '20:00' }] });
  const { soanBai } = require('../server/agent/agents/soan-bai');
  const b = await soanBai({ ...(nhaCungCap ? { nhaCungCap } : {}) });
  ketQua.soan_bai = b;
  console.log('\n2) Soạn bài:', JSON.stringify({ su_kien: b.su_kien, bai_nha_hang: b.bai_nha_hang, reels: b.reels, kiem_lai: b.kiem_lai }, null, 1));
  console.log(`   [chi phí lũy kế ${tongUsd().toFixed(4)} USD]`);
  kiemTran();

  // 3. Tổng kết buổi 8 người chốt
  const live = require('../server/nghiep-vu/live');
  const don = require('../server/nghiep-vu/don');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const kb = require('../server/nghiep-vu/kich-ban').taoNhanh();
  const p = live.taoPhien({ kich_ban_id: kb.id, che_do_ai: 'goi_y', dien_tap: false });
  csdl().prepare("UPDATE phien_live SET page_id = 'page_1', bat_dau = ? WHERE id = ?").run(new Date(Date.now() - 2 * 3600e3).toISOString(), p.id);
  const p1 = live.layPhien(p.id);
  const ten = ['Lan', 'Hoa', 'Trâm', 'Vy', 'Quỳnh', 'Khánh', 'Mai', 'Linh'];
  const ds = ten.map((t, i) => {
    const bl = live.themBinhLuan(p.id, { fb_id: `c${i}`, nguoi_fb_id: `u${i}`, ten: t, noi_dung: 'chốt 12 trắng M', luc_fb: new Date().toISOString() });
    const n = hopThu.nguoiCuaBinhLuan(bl, p1);
    const d = don.taoDon({ mon: [{ phan_loai_id: a.pl('Trắng', 'M').id }], nguon: 'binh_luan_live', phienLiveId: p.id, binhLuanId: bl.id, nguoiFbId: n.id });
    live.ganChot(bl.id, { donId: d.id });
    return d;
  });
  for (const d of ds.slice(0, 3)) {
    don.datThongTinGiao(d.id, { ten: 'Khách', sdt: '0912345678', diaChi: '12 Lý Thái Tổ, Bắc Ninh' }, { boi: 'nguoi' });
    don.doiTrangThai(d.id, 'da_xac_nhan');
  }
  for (const d of ds.slice(3, 6)) don.doiTrangThai(d.id, 'da_huy', { nguon: 'he_thong', ghiChu: 'quá giờ giữ hàng' });
  live.ketThucPhien(p.id, 'xong');
  const tk = require('../server/nghiep-vu/tong-ket-phien');
  const soLieu = tk.soLieuChoAi(tk.tongKetPhien(p.id));
  const g = await require('../server/agent/agents/tong-ket').vietGoiY(p.id, { ...(nhaCungCap ? { nhaCungCap } : {}) });
  ketQua.tong_ket = { so_lieu: soLieu, goi_y: g.goi_y, bo: g.bo };
  console.log('\n3) Số liệu gửi AI:\n' + soLieu, '\n   Gợi ý giữ:', JSON.stringify(g.goi_y, null, 1), `\n   Bỏ: ${g.bo}`);

  // Chấm bằng mã
  const cham = {
    noi_voi_mai_co_bang: ketQua.noi_voi_mai.viec.length > 0,
    soan_bai_kiem_lai: b.kiem_lai.length,
    tong_ket_so_goi_y: g.goi_y.length,
    tong_ket_ten_trong_so_lieu: ten.filter((x) => soLieu.includes(x)).length,
    chi_phi_usd: Number(tongUsd().toFixed(4)),
    theo_agent: csdl().prepare('SELECT agent_id, model, COUNT(*) AS n, SUM(chi_phi_usd) AS usd, SUM(token_vao) AS vao, SUM(token_ra) AS ra FROM agent_run GROUP BY agent_id, model').all(),
  };
  console.log('\n===== CHẤM =====\n' + JSON.stringify(cham, null, 1));
  fs.writeFileSync(path.join(TAM, 'ket-qua.json'), JSON.stringify({ ketQua, cham }, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
