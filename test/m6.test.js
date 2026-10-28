'use strict';

// M6: báo cáo bán hàng (F-58), Agent thử nghiệm (F-34), vòng cải tiến (F-36). AI giả, không gọi mạng.

const test = require('node:test');
const assert = require('node:assert/strict');
const { moCSDLTam, taoSanPhamMau } = require('./ho-tro');

function nhaGia(buoc) {
  const yeuCau = [];
  return {
    yeuCau,
    async goi(o) {
      yeuCau.push({ model: o.model, heThong: o.heThong, lichSu: JSON.parse(JSON.stringify(o.lichSu)), congCu: o.congCu.map((c) => c.ten) });
      return { goiCongCu: [], chu: '', goc: null, tokenVao: 100, tokenRa: 50, ...(await buoc(o, yeuCau.length)) };
    },
  };
}

test('M6', async (t) => {
  const db = await moCSDLTam();
  t.after(() => db.dong());
  const { csdl } = require('../server/db/ket-noi');
  const live = require('../server/nghiep-vu/live');
  const hopThu = require('../server/nghiep-vu/hop-thu');
  const khach = require('../server/nghiep-vu/khach');
  const don = require('../server/nghiep-vu/don');
  const nhatKy = require('../server/nghiep-vu/nhat-ky');
  const bc = require('../server/nghiep-vu/bao-cao');
  const kichBan = require('../server/nghiep-vu/kich-ban');

  const mau = taoSanPhamMau(); // áo số 12: 289.000đ, giá vốn 150.000đ, Đen/Trắng × M/L, mỗi ô 5
  taoSanPhamMau({ so: 20, ten: 'Chân váy xếp ly', danhMuc: 'chan_vay', gia: '199k', mau: ['Be'], co: ['S', 'M'] });
  // Đường đi của một đơn: người xác nhận, gửi, rồi tới trạng thái cuối.
  const DUONG = { cho_xac_nhan: [], da_xac_nhan: ['da_xac_nhan'], da_giao: ['da_xac_nhan', 'da_gui', 'da_giao'],
    hoan: ['da_xac_nhan', 'da_gui', 'hoan'], da_huy: ['da_huy'] };
  let soDt = 10000000;

  /**
   * Một phiên live (thật hoặc diễn tập) với n bình luận thường và các bình luận chốt → đơn đi tới trạng thái cho trước.
   * @param {{pl:[string,string], sl:number, den:string}[]} cacDon
   */
  function taoPhien(dienTap, soBinhLuan, cacDon) {
    const kb = kichBan.taoNhanh();
    const p = live.taoPhien({ kich_ban_id: kb.id, dien_tap: dienTap });
    const pageId = dienTap ? null : '100200300400';
    live.ganLive(p.id, `live_${Math.random()}`, pageId);
    for (let i = 0; i < soBinhLuan; i++) {
      live.themBinhLuan(p.id, { fb_id: `bl_${p.id}_${i}`, ten: `Người ${i}`, noi_dung: 'giá bao nhiêu?', luc_fb: new Date().toISOString(), nguoi_fb_id: `ng_${i}` });
    }
    cacDon.forEach((x, i) => {
      const bl = live.themBinhLuan(p.id, { fb_id: `blc_${p.id}_${i}`, nguoi_fb_id: `ngc_${p.id}_${i}`, ten: `Khách ${i}`,
        noi_dung: `chốt 12 ${x.pl.join(' ')} x${x.sl}`, luc_fb: new Date().toISOString() });
      const { hoiThoai: h } = hopThu.tuBinhLuanLive(bl, live.layPhien(p.id));
      soDt += 1;
      const k = khach.taoKhach({ ten: `Khách ${p.id} ${i}`, sdt: `09${soDt}`, hoiThoaiId: h.id, phienLiveId: p.id, dienTap }).khach;
      let d = don.taoDon({ mon: [{ phan_loai_id: mau.pl(...x.pl).id, so_luong: x.sl }], nguon: 'binh_luan_live', pageId: h.page_id,
        nguoiFbId: h.nguoi_fb_id, khachId: k.id, hoiThoaiId: h.id, phienLiveId: p.id, binhLuanId: bl.id, dienTap });
      live.ganChot(bl.id, { donId: d.id });
      d = don.datThongTinGiao(d.id, { ten: k.ten, sdt: k.sdt, diaChi: 'số 5 Lý Thái Tổ' }, { boi: 'nguoi' });
      for (const den of DUONG[x.den]) don.doiTrangThai(d.id, den, { nguon: 'nguoi' });
    });
    const run = nhatKy.taoRun({ agentId: 'director', kichHoat: 'thử', phienLiveId: p.id, dienTap });
    nhatKy.xongRun(run, { nha: 'gemini', model: 'x', tokenVao: 1, tokenRa: 1, chiPhi: 0.25, ketQua: {} });
    live.ketThucPhien(p.id);
    return p;
  }

  await t.test('báo cáo bán hàng theo buổi live khớp đếm trực tiếp; dữ liệu diễn tập không được tính (F-58)', () => {
    const that = taoPhien(false, 7, [
      { pl: ['Đen', 'M'], sl: 1, den: 'cho_xac_nhan' }, { pl: ['Đen', 'L'], sl: 2, den: 'da_giao' },
      { pl: ['Trắng', 'M'], sl: 1, den: 'hoan' }, { pl: ['Trắng', 'L'], sl: 1, den: 'da_huy' },
    ]);
    taoPhien(true, 20, [{ pl: ['Đen', 'M'], sl: 1, den: 'da_giao' }, { pl: ['Đen', 'M'], sl: 1, den: 'da_xac_nhan' }]);
    const ds = bc.theoPhien();
    assert.equal(ds.length, 1, 'phiên diễn tập không có trong báo cáo');
    const r = ds[0];
    assert.equal(r.id, that.id);
    assert.equal(r.binh_luan, csdl().prepare('SELECT COUNT(*) AS n FROM binh_luan_live WHERE phien_id = ?').get(that.id).n);
    assert.equal(r.binh_luan, 11);
    assert.equal(r.binh_luan_chot, 4);
    assert.deepEqual([r.don, r.cho_xac_nhan, r.da_xac_nhan, r.da_gui, r.da_giao, r.hoan, r.da_huy], [4, 1, 0, 0, 1, 1, 1]);
    assert.equal(r.doanh_so, 3 * 289000, 'doanh số: đơn đã xác nhận trở lên, trừ hủy (hoàn vẫn tính, báo tỷ lệ riêng)');
    assert.equal(r.lai_gop, 3 * (289000 - 150000));
    assert.equal(r.chua_tinh_von, 0);
    assert.equal(r.ty_le_hoan, 50);
    assert.ok(Math.abs(r.chi_phi_ai_usd - 0.25) < 1e-9, 'chi phí AI chỉ của buổi này');
    const theoSp = bc.theoSanPham();
    assert.deepEqual(theoSp.map((x) => x.so), [12], 'sản phẩm không bán được thì không có dòng');
    assert.deepEqual([theoSp[0].so_chiec, theoSp[0].so_chiec_hoan, theoSp[0].tien_hang], [3, 1, 867000], 'không tính đơn diễn tập');
    const tong = bc.baoCao().tong;
    assert.equal(tong.don, 4);
    assert.equal(tong.doanh_so, 867000);
  });

  await t.test('xóa dữ liệu một khách không làm đổi con số báo cáo (F-54)', () => {
    const truoc = bc.theoPhien()[0];
    const k = csdl().prepare("SELECT khach_id FROM don WHERE dien_tap = 0 AND trang_thai = 'da_giao' LIMIT 1").get();
    assert.throws(() => khach.xoaDuLieu(csdl().prepare("SELECT khach_id FROM don WHERE trang_thai = 'cho_xac_nhan' LIMIT 1").get().khach_id),
      (e) => e.ma === 'DU_LIEU_KHONG_HOP_LE', 'khách còn đơn chưa xong thì chưa xóa được');
    khach.xoaDuLieu(k.khach_id);
    assert.equal(csdl().prepare('SELECT sdt_nhan FROM don WHERE khach_id = ?').get(k.khach_id).sdt_nhan, null, 'đơn giữ lại dạng ẩn danh');
    const sau = bc.theoPhien()[0];
    assert.deepEqual([sau.don, sau.da_giao, sau.doanh_so, sau.lai_gop, sau.binh_luan_chot],
      [truoc.don, truoc.da_giao, truoc.doanh_so, truoc.lai_gop, truoc.binh_luan_chot]);
  });

  await t.test('Agent thử nghiệm: chỉ công cụ nhóm Đọc; chạy bằng nút; tắt không ảnh hưởng 3 Agent chính (F-34)', async () => {
    const atn = require('../server/nghiep-vu/agent-thu-nghiem');
    const { layCongCu } = require('../server/agent/cong-cu/danh-sach');
    const nhom = (ten) => layCongCu(ten)?.nhom ?? null;
    assert.throws(() => atn.taoAgent({ ten: 'Gửi bậy', muc_tieu: 'x', loi_dan: 'x', cong_cu: ['gui_messenger'] }, nhom), (e) => e.ma === 'CONG_CU_KHONG_DUOC_CAP');
    const a = atn.taoAgent({ ten: 'Tóm tắt sản phẩm', muc_tieu: 'Tóm tắt một sản phẩm', loi_dan: 'Bạn tóm tắt sản phẩm thật ngắn.', cong_cu: ['lay_san_pham', 'muc_luc_san_pham'] }, nhom);
    assert.equal(a.thu_nghiem, true);
    assert.match(a.id, /^tn_/);
    const { chayThuNghiem } = require('../server/agent/agents/thu-nghiem');
    const ai = nhaGia((o, lan) => (lan === 1 ? { goiCongCu: [{ id: 'g1', ten: 'lay_san_pham', thamSo: { so: 12 } }] } : { chu: 'Áo số 12: sơ mi linen, giá 289.000đ.' }));
    const kq = await chayThuNghiem(a.id, 'Tóm tắt áo 12', { nhaCungCap: { openai: ai } });
    assert.equal(kq.ok, true);
    assert.match(kq.tra_loi, /289\.000đ/);
    assert.deepEqual(ai.yeuCau[0].congCu.sort(), ['lay_san_pham', 'muc_luc_san_pham']);
    assert.match(ai.yeuCau[0].heThong, /Bạn tóm tắt sản phẩm thật ngắn\./);
    atn.datBat(a.id, false);
    const tat = await chayThuNghiem(a.id, 'x', { nhaCungCap: { openai: ai } });
    assert.equal(tat.loi.ma, 'AGENT_TAT');
    const caiDat = require('../server/nghiep-vu/cai-dat');
    for (const id of ['director', 'cohost', 'tu_van']) assert.equal(caiDat.layAgent(id).bat, true);
    assert.throws(() => atn.datBat('tu_van', false), (e) => e.ma === 'KHONG_PHAI_THU_NGHIEM');
    assert.ok(require('../server/nghiep-vu/vai-tro').danhSach().some((v) => v.agent_id === a.id), 'lời dặn của Agent thử nghiệm sửa được như Agent khác');
  });

  await t.test('👎 kèm lý do → bài học chờ duyệt, đã che số; chưa duyệt không đổi Skill; duyệt → Skill có bản mới (F-36)', async () => {
    const nhatKy = require('../server/nghiep-vu/nhat-ky');
    const skill = require('../server/nghiep-vu/skill');
    const baiHoc = require('../server/nghiep-vu/bai-hoc');
    const { deXuatBaiHoc } = require('../server/agent/agents/bai-hoc');
    const runId = nhatKy.taoRun({ agentId: 'tu_van', kichHoat: 'Tin mới của chị Lan 0912 345 678' });
    nhatKy.ghiCongCu({ runId, congCu: 'gui_messenger', thamSo: { noi_dung: 'Áo này rẻ lắm chị ơi, gọi 0912345678 nhé' } });
    nhatKy.xongRun(runId, { ketQua: { xong: true }, soBuoc: 1 });
    nhatKy.danhGia(runId, { diem: 'xau', ly_do: 'Nói "rẻ lắm" mà không đưa giá trong thẻ sản phẩm' });
    const skillId = skill.danhSach().find((s) => s.agent_ids.includes('tu_van')).id;
    const truoc = skill.xem(skillId).dang_dung;
    const ai = nhaGia(() => ({ chu: JSON.stringify({ bai_hoc: 'Khi nói về giá, luôn đưa đúng giá trong thẻ sản phẩm kèm trích dẫn; không nói chung chung "rẻ lắm". Khách 0912 345 678.', dich: 'skill', dich_id: skillId, vi_sao: 'Tránh câu mơ hồ' }) }));
    const kq = await deXuatBaiHoc(runId, 'Nói "rẻ lắm" mà không đưa giá trong thẻ sản phẩm', { nhaCungCap: { anthropic: ai, openai: ai } });
    assert.equal(kq.ok, true);
    assert.ok(!JSON.stringify(ai.yeuCau).includes('0912 345 678') && !JSON.stringify(ai.yeuCau).includes('0912345678'), 'không gửi số điện thoại cho AI');
    const bh = kq.bai_hoc;
    assert.equal(bh.trang_thai, 'cho_duyet');
    assert.ok(!bh.noi_dung.includes('0912'), 'bài học không chứa số điện thoại');
    assert.equal(skill.xem(skillId).dang_dung.phien_ban, truoc.phien_ban, 'chưa duyệt thì Skill không đổi');
    baiHoc.duyet(bh.id);
    const sau = skill.xem(skillId).dang_dung;
    assert.equal(sau.phien_ban, truoc.phien_ban + 1);
    assert.match(sau.cach_lam, /Bài học \(.+\): Khi nói về giá/);
    assert.throws(() => baiHoc.duyet(bh.id), (e) => e.ma === 'DA_XU_LY');
  });

  await t.test('bài học ghi vào Sổ tay; bài học bị bỏ không đổi gì', () => {
    const baiHoc = require('../server/nghiep-vu/bai-hoc');
    const soTay = require('../server/nghiep-vu/so-tay');
    const muc = soTay.danhSachMuc()[0];
    const a = baiHoc.tao({ noiDung: 'Shop không thu phí đổi size lần đầu.', dich: 'so_tay', dichId: muc.id });
    baiHoc.duyet(a.id);
    assert.match(soTay.layMuc(muc.id).noi_dung, /không thu phí đổi size lần đầu/);
    const b = baiHoc.tao({ noiDung: 'Điều sai', dich: 'so_tay', dichId: muc.id });
    const pb = soTay.layMuc(muc.id).phien_ban;
    baiHoc.bo(b.id);
    assert.equal(soTay.layMuc(muc.id).phien_ban, pb);
  });
});
