'use strict';

/**
 * Cổng Facebook thật (SPEC.md mục 12, đầu M5): chạy cùng MOZA đang mở (http://127.0.0.1:5173), dẫn từng bước
 * cho người dùng làm trên điện thoại / tài khoản thử, tự đo và ghi kết quả vào scripts/thu-facebook/ket-qua/.
 * Không đưa vào phần mềm chính. Không in mã truy cập nào ra màn hình.
 *
 * Chạy:  node scripts/thu-facebook/cong.js           (MOZA phải đang chạy)
 *        node scripts/thu-facebook/cong.js --cong 5190
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');

const i = process.argv.indexOf('--cong');
const GOC = `http://127.0.0.1:${i > 0 ? process.argv[i + 1] : 5173}`;
const KET_QUA = path.join(__dirname, 'ket-qua');
const ketQua = { bat_dau: new Date().toISOString(), phep: [] };

async function goi(phuongThuc, duong, than) {
  const r = await fetch(GOC + '/api' + duong, {
    method: phuongThuc,
    headers: { 'Content-Type': 'application/json', Origin: GOC },
    body: than ? JSON.stringify(than) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.loi?.thong_diep || `HTTP ${r.status}`);
  return j;
}

const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

function ghi(ten, dat, chiTiet) {
  ketQua.phep.push({ ten, dat, chi_tiet: chiTiet, luc: new Date().toISOString() });
  console.log(`   ${dat === true ? '✔ ĐẠT' : dat === false ? '✖ CHƯA ĐẠT' : '• GHI NHẬN'} — ${ten}: ${chiTiet}`);
}

/** Chờ tới khi `dieuKien()` trả giá trị khác null, tối đa `giay` giây. Trả { gt, giay } hoặc null. */
async function cho(dieuKien, giay = 120) {
  const t0 = Date.now();
  while (Date.now() - t0 < giay * 1000) {
    const gt = await dieuKien();
    if (gt) return { gt, giay: (Date.now() - t0) / 1000 };
    await ngu(1000);
  }
  return null;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hoi = async (cau) => (await rl.question(`\n>> ${cau}\n   (làm xong bấm Enter, gõ "bo" để bỏ qua bước này) `)).trim().toLowerCase() !== 'bo';

  console.log('\nCỔNG FACEBOOK THẬT — MOZA M5');
  console.log(`MOZA: ${GOC}`);

  // 1. Mã và quyền
  const kt = await goi('POST', '/ket-noi/kiem-tra');
  for (const p of kt.kiem_tra.pages || []) {
    const thieu = p.quyen.filter((q) => q.co === false).map((q) => q.quyen);
    ghi(`Mã và quyền — ${p.ten}`, p.ok, p.loi || (thieu.length ? `thiếu ${thieu.join(', ')}` : `đủ 6 quyền, mã ${p.het_han}`));
  }
  if (!kt.kiem_tra.pages?.length) ghi('Mã và quyền', false, kt.kiem_tra.loi || 'Chưa nối Page nào');

  // 2. Webhook qua Quick Tunnel
  const kn = await cho(async () => { const t = await goi('GET', '/ket-noi'); return t.webhook === 'hoat_dong' ? t : null; }, 90);
  ghi('Webhook tự đăng ký qua Cloudflare Quick Tunnel', !!kn, kn ? `sẵn sàng sau ${kn.giay.toFixed(0)} giây · ${kn.gt.dia_chi}` : 'chưa hoạt động sau 90 giây (xem Cài đặt → Facebook)');

  const suKienMoi = async (loai, sau) => {
    const t = await goi('GET', '/ket-noi');
    return (t.su_kien_gan_day || []).find((e) => e.loai === loai && e.luc > sau) || null;
  };

  // 3. Nhận tin Messenger
  if (await hoi('Từ TÀI KHOẢN THỬ (có vai trò Tester), nhắn cho Page: "thu 1". Bấm Enter NGAY SAU KHI bấm gửi.')) {
    const moc = new Date().toISOString();
    const kq = await cho(() => suKienMoi('tin_nhan', moc), 90);
    ghi('Tin Messenger về MOZA', !!kq, kq ? `sau ${kq.giay.toFixed(1)} giây qua ${kq.gt.nguon === 'webhook' ? 'webhook' : 'hỏi định kỳ'}` : 'không thấy sau 90 giây');
    if (kq) {
      const tl = await cho(async () => {
        const { hoi_thoai: ds } = await goi('GET', '/hoi-thoai?dien_tap=0');
        const h = ds.find((x) => x.kenh === 'messenger');
        if (!h) return null;
        const ct = await goi('GET', `/hoi-thoai/${h.id}`);
        return ct.tin_nhan.find((t) => t.gui_boi === 'ai' && t.trang_thai_gui === 'da_gui') || null;
      }, 90);
      ghi('Tư vấn viên AI trả lời tin thật', !!tl, tl ? `sau ${tl.giay.toFixed(1)} giây: "${tl.gt.noi_dung.slice(0, 80)}…"` : 'chưa trả lời sau 90 giây (xem Hộp thư, Agent & Skill → Nhật ký)');
    }
  }

  // 4. Người trả lời từ hộp thư Page → AI tạm dừng (#34)
  if (await hoi('Mở hộp thư Page (Meta Business Suite trên điện thoại), trả lời tài khoản thử một câu bất kỳ.')) {
    const kq = await cho(async () => {
      const { hoi_thoai: ds } = await goi('GET', '/hoi-thoai?dien_tap=0');
      return ds.find((x) => x.kenh === 'messenger' && x.ai_tam_dung) || null;
    }, 90);
    ghi('Trả lời từ hộp thư Page → AI tạm dừng (#34)', !!kq, kq ? `sau ${kq.giay.toFixed(1)} giây` : 'không thấy tin vọng lại có app_id khác MOZA');
  }

  // 5. Bình luận bài đăng
  if (await hoi('Từ tài khoản thử, bình luận dưới một bài đăng của Page: "BN-012 còn tuyển không?"')) {
    const moc = new Date().toISOString();
    const kq = await cho(() => suKienMoi('binh_luan_bai', moc), 120);
    ghi('Bình luận bài đăng về MOZA', !!kq, kq ? `sau ${kq.giay.toFixed(1)} giây qua ${kq.gt.nguon}` : 'không thấy sau 120 giây');
    await hoi('Xem trên Facebook: AI đã trả lời công khai và/hoặc nhắn riêng chưa? (MOZA ghi lại để bạn đối chiếu)');
  }

  // 6. Khách lạ (không có vai trò)
  if (await hoi('Nếu có tài khoản KHÔNG có vai trò trong ứng dụng: nhắn Page "thu 2" từ tài khoản đó.')) {
    const moc = new Date().toISOString();
    const kq = await cho(() => suKienMoi('tin_nhan', moc), 60);
    ghi('Tài khoản không có vai trò nhắn được (trước App Review)', kq ? true : null, kq ? 'tin có về MOZA' : 'không về — đúng như tài liệu Meta: cần App Review');
  }

  // 7. Live từ điện thoại
  if (await hoi('Trong MOZA: Livestream → tạo phiên "Live thật trên Page", chế độ Chỉ gợi ý. Rồi mở ứng dụng Facebook trên điện thoại, phát live dưới tên Page. Bấm Enter khi live đã lên.')) {
    const kq = await cho(async () => {
      const { phien } = await goi('GET', '/live/phien/hien-tai');
      return phien && phien.trang_thai === 'dang_live' && !phien.dien_tap ? phien : null;
    }, 120);
    ghi('MOZA tự nhận ra live phát từ điện thoại', !!kq, kq ? `sau ${kq.giay.toFixed(0)} giây` : 'không thấy sau 120 giây (live_videos không liệt kê? xem mục 13)');
    if (kq && await hoi('Từ tài khoản thử, bình luận vào live: "lương bao nhiêu". Bấm Enter ngay sau khi gửi.')) {
      const moc = Date.now();
      const bl = await cho(async () => {
        const ct = await goi('GET', '/live/phien/hien-tai');
        return (ct.binh_luan || []).find((b) => new Date(b.luc_fb).getTime() > moc - 30000) || null;
      }, 60);
      const ct = await goi('GET', '/live/phien/hien-tai');
      ghi('Bình luận live về MOZA', !!bl, bl ? `sau ${bl.giay.toFixed(1)} giây · cách đọc: ${ct.cach_doc}` : 'không thấy sau 60 giây');
      if (bl) ghi('Đọc được tên người bình luận (from)', bl.gt.ten && bl.gt.ten !== 'Người xem' ? true : null, `tên: "${bl.gt.ten}"`);
    }
    await hoi('Đổi chế độ trên Màn hình người dẫn sang "Mai nói · GPT Live 1", hỏi "Mai ơi, lương bao nhiêu?". Rồi kết thúc live trên điện thoại.');
    const het = await cho(async () => { const { phien } = await goi('GET', '/live/phien/hien-tai'); return !phien ? true : null; }, 180);
    ghi('Kết thúc live → MOZA tự kết thúc phiên', !!het, het ? `sau ${het.giay.toFixed(0)} giây` : 'phiên vẫn mở sau 3 phút');
  }

  // 8. Mức dùng giới hạn gọi
  const tt = await goi('GET', '/ket-noi');
  ghi('Mức dùng giới hạn gọi Facebook', tt.nhip_goi.muc_dung <= 50, `${tt.nhip_goi.muc_dung}%`);

  rl.close();
  ketQua.xong = new Date().toISOString();
  fs.mkdirSync(KET_QUA, { recursive: true });
  const file = path.join(KET_QUA, `cong-${ketQua.bat_dau.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(ketQua, null, 2));
  console.log(`\nĐã ghi kết quả: ${file}\n`);
}

main().catch((e) => {
  console.error('\n[!] ' + e.message);
  console.error('    MOZA có đang chạy không? Mở CHAY PHAN MEM.bat rồi chạy lại script.');
  process.exit(1);
});
