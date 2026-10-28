'use strict';

/**
 * Thử AI thật BH7 (SPEC.md 3.4 mục 12, docs/08 "Thử AI thật" của Chuyển khoản + Khách quen): Tư vấn viên gpt-6-luna trên Messenger
 * giả, Claude Code gõ vai khách. Trần 0,10 USD — vượt là dừng. Không dùng Google (tắt dự phòng Gemini). Không gọi VietQR (ảnh giả).
 * Cơ sở dữ liệu TẠM ở data/tam-test/thu-ai-bh7 (không đụng data/moza.db); khóa đọc từ .env (chỉ đọc).
 * Chạy: "C:\Program Files\nodejs\node.exe" scripts/thu-ai-bh7.js   (cần OPENAI_API_KEY trong .env hoặc Cài đặt → Khóa AI)
 * Kết quả: in ra màn hình + data/tam-test/thu-ai-bh7/ket-qua.json. Ước 0,03–0,05 USD.
 */

process.chdir(require('node:path').join(__dirname, '..'));
const path = require('node:path');
const fs = require('node:fs');

const TAM = path.resolve('data/tam-test/thu-ai-bh7');
fs.rmSync(TAM, { recursive: true, force: true });
fs.mkdirSync(TAM, { recursive: true });
const TRAN_USD = 0.10;
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (process.env.MOZA_AI_GIA !== '1' && !require('../server/khoa').trangThai().openai.co) { console.log('Chưa có khóa OpenAI (.env hoặc Cài đặt → Khóa AI): không chạy, 0 đồng.'); process.exit(3); }
  const { moCSDL, csdl } = require('../server/db/ket-noi');
  await moCSDL(TAM);
  const caiDat = require('../server/nghiep-vu/cai-dat');
  caiDat.gieoMacDinh();
  require('../server/nghiep-vu/so-tay').gieoMucMoi();
  require('../server/nghiep-vu/vai-tro').gieoVaiTro();
  require('../server/nghiep-vu/skill').gieoSkill();
  // Chỉ OpenAI gpt-6-luna (không dự phòng Gemini — Google 0 đồng).
  caiDat.modelDienTap = () => ({ nha: 'openai', model: 'gpt-6-luna', muc_suy_nghi: 'thap', nha_du_phong: null, model_du_phong: null });
  caiDat.datBanHang({ ten_shop: 'Moza Shop', sdt_shop: '0987654321', phi_ship: '20k', mien_phi_tu: '500k', ten_chu_tk: 'Nguyễn Thị Hoa', ngan_hang: '970436', so_tk: '0011001234567' });
  const lienHe = require('../server/nghiep-vu/lien-he');
  lienHe.MAC.gio_tu = 0;
  lienHe.MAC.gio_den = 24;
  const { taoSanPhamMau, ANH_GIA } = require('../test/ho-tro');
  const mau = taoSanPhamMau({ gia: '289k', co: ['S', 'M', 'L'], mau: ['Trắng', 'Be'], ton: 10 });
  require('../server/vietqr').datFetch(async () => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => ANH_GIA }));
  const { FacebookGia } = require('../server/facebook/gia');
  const { HopThuTuDong } = require('../server/hop-thu');
  const fb = new FacebookGia({ tinhHuong: 'than_trong' });
  const ht = new HopThuTuDong({ fbGia: fb, layKetNoi: () => fb, gomMs: 300, chuKyMs: 3600000, phat() {} });
  ht.batDau();
  const tin = (ten) => fb.luongChat('page_gia', fb.psidCua('page_gia', ten));
  const tongUsd = () => csdl().prepare('SELECT COALESCE(SUM(chi_phi_usd), 0) AS n FROM agent_run').get().n;
  const nhatKy = [];
  async function noi(ten, chu) {
    const truoc = tin(ten).length;
    fb.khachNhan({ ten, noi_dung: chu });
    await cho(600);
    await ht.choXong(120000);
    const moi = tin(ten).slice(truoc).filter((t) => t.tu === 'page');
    nhatKy.push({ ten, khach: chu, shop: moi.map((t) => t.noi_dung) });
    console.log(`\n👤 ${ten}: ${chu}`);
    for (const t of moi) console.log(`🏪 ${t.noi_dung.replace(/\n/g, ' ⏎ ')}`);
    console.log(`   [chi phí lũy kế ${tongUsd().toFixed(4)} USD]`);
    if (tongUsd() > TRAN_USD) { console.log('DỪNG: chạm trần 0,10 USD'); process.exit(2); }
    return moi;
  }
  const bam = async (ten, tieuDe) => {
    const t = [...tin(ten)].reverse().find((x) => x.tu === 'page' && x.nut?.some((n) => n.tieu_de === tieuDe));
    if (!t) { console.log(`(không thấy nút ${tieuDe})`); return; }
    fb.khachBam({ psid: fb.psidCua('page_gia', ten), payload: t.nut.find((n) => n.tieu_de === tieuDe).payload, tieu_de: tieuDe });
    await cho(400); await ht.choXong(60000);
    console.log(`\n👆 ${ten} bấm "${tieuDe}"`);
    for (const x of tin(ten).slice(-2).filter((y) => y.tu === 'page')) console.log(`🏪 ${x.noi_dung.replace(/\n/g, ' ⏎ ')}`);
  };

  // Tình huống 1–3: chuyển khoản được không · xin số tài khoản · "mình ck rồi nha"
  await noi('Lan', 'shop ơi áo 12 trắng size M còn không, mình lấy 1 cái');
  await noi('Lan', 'Nguyễn Thị Lan, 0912345678, 12 Lý Thái Tổ, Suối Hoa, Bắc Ninh');
  await noi('Lan', 'chuyển khoản được không shop?');
  await noi('Lan', 'cho mình xin số tài khoản của shop với');
  await noi('Lan', 'mình ck rồi nha shop');

  // Tình huống 4: khách có số đo đã lưu hỏi size
  await noi('Hoa', 'chào shop');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const kh = require('../server/nghiep-vu/khach');
  const h = hopThu.danhSach({ dienTap: null }).find((y) => y.kenh === 'messenger' && y.fb_thread_id === fb.psidCua('page_gia', 'Hoa'));
  const k = kh.taoKhach({ ten: 'Trần Thị Hoa', sdt: '0912000111', dongY: true, dienTap: true }).khach;
  hopThu.lienKetKhach(h.id, k.id);
  kh.luuSoDo(k.id, { chieuCao: 158, canNang: 50 });
  await noi('Hoa', 'shop lưu số đo của mình rồi đó, áo 12 mình nên mặc size nào?');

  // Chấm bằng mã
  const chuAi = nhatKy.flatMap((x) => x.shop).filter((c) => !/^✅ Đơn DH-\d+ đã xác nhận, trả bằng chuyển khoản/.test(c) && !/^🧾 Đơn/.test(c));
  const goTk = chuAi.filter((c) => /0011001234567|0011 0012 34567/.test(c));
  const daNhan = chuAi.filter((c) => /(đã|vừa)\s+nhận\s+(được\s+)?(tiền|chuyển khoản|ck)|chuyển khoản thành công/i.test(c));
  const ck = tin('Lan').filter((t) => t.tu === 'page' && t.the?.kieu === 'media').length;
  console.log('\n===== CHẤM =====');
  console.log(JSON.stringify({ ai_tu_go_so_tk: goTk.length, ai_noi_da_nhan_tien: daNhan.length, anh_qr_gui: ck, chi_phi_usd: Number(tongUsd().toFixed(4)),
    luot_ai: csdl().prepare('SELECT COUNT(*) AS n FROM agent_run').get().n,
    theo_model: csdl().prepare('SELECT model, COUNT(*) AS n, SUM(chi_phi_usd) AS usd, SUM(token_vao) AS vao, SUM(token_ra) AS ra FROM agent_run GROUP BY model').all() }, null, 1));
  fs.writeFileSync(path.join(TAM, 'ket-qua.json'), JSON.stringify({ nhatKy, goTk, daNhan }, null, 1));
  ht.dung();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
