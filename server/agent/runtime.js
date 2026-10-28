'use strict';

/**
 * Runtime Agent (F-07): vòng lặp AI + công cụ cho Director, Co-host, Tư vấn viên.
 *  - Đọc cấu hình Agent mỗi lần chạy: đổi model trong Cài đặt có tác dụng ngay lần kế tiếp.
 *  - Mỗi lần chạy một ngữ cảnh riêng, dựng mới từ đầu: không có gì dùng chung giữa các lần chạy,
 *    nên hội thoại A không bao giờ lẫn vào hội thoại B.
 *  - Giới hạn số bước và thời gian (A.7). Vượt → dừng, nơi gọi quyết Cần người (Hộp thư) hay bỏ lượt (live).
 *  - Nhà chính lỗi → thử ngay nhà dự phòng trong cùng lần chạy; lỗi 3 lần liên tiếp → 5 phút sau đó
 *    đi thẳng nhà dự phòng, rồi thử lại nhà chính.
 *  - Luật nâng lên Claude (A.7) cho Agent có cấu hình nâng cấp (Tư vấn viên).
 *  - Phiếu kết quả theo lược đồ JSON; sai thì làm lại 1 lần (A.8).
 *  - Ghi nhật ký, đếm chi phí, kiểm mức trần sau mỗi lần chạy (A.9, F-14).
 */

const NHA_MAC_DINH = require('./nha-cung-cap');
const { docPhieu, LoiAi } = require('./nha-cung-cap/chung');
const { layCongCu } = require('./cong-cu/danh-sach');
const { chayCua } = require('./hook/cua');
const { thucHienCongCu } = require('./thuc-hien');
const caiDat = require('../nghiep-vu/cai-dat');
const vaiTro = require('../nghiep-vu/vai-tro');
const nhatKy = require('../nghiep-vu/nhat-ky');
const chiPhi = require('../nghiep-vu/chi-phi');
const { anKhoa } = require('../khoa');
const { phat } = require('../ws');

const NGUONG_LOI = 3; // nhà chính lỗi liên tiếp bấy nhiêu lần thì đi thẳng nhà dự phòng
const NGHI_NHA_CHINH_MS = 5 * 60 * 1000;
const NANG_KHI_LOI = 2; // A.7 luật 4: model chính lỗi 2 lần liên tiếp → nâng lên Claude — chỉ khi Agent KHÔNG có dự phòng (#88)

// Trạng thái lỗi của nhà chính theo từng Agent (chỉ trong bộ nhớ; khởi động lại thì thử lại từ đầu).
const loiNhaChinh = new Map();

function datLaiTrangThaiNha() {
  loiNhaChinh.clear();
}

function ghiLoiNha(agentId) {
  const s = loiNhaChinh.get(agentId) || { lan: 0, tu: 0 };
  s.lan += 1;
  // Mốc lần lỗi gần nhất: đi nhà dự phòng / nâng model chỉ trong NGHI_NHA_CHINH_MS kể từ mốc này, rồi thử lại nhà chính.
  // (Lỗi 26/9/2026: mốc chỉ đặt từ lần lỗi thứ 3 nên "nâng khi lỗi 2 lần" không bao giờ hết hạn — Gemini quá tải vài giây
  // làm Tư vấn viên chạy GPT-6 Sol mãi, tốn gấp nhiều lần.)
  s.tu = Date.now();
  loiNhaChinh.set(agentId, s);
}

/**
 * Chờ nhà cung cấp trả lời, nhưng dừng ngay khi hết giờ hoặc người dùng bấm dừng — không phụ thuộc
 * vào việc thư viện của nhà cung cấp có nghe lệnh hủy hay không (Director quá 5 giây là bỏ lượt, F-17).
 */
function choHoacHuy(viec, tinHieu, nha) {
  if (tinHieu.aborted) return Promise.reject(new LoiAi('Đã hết giờ hoặc đã dừng.', { nha, ma: 'QUA_THOI_GIAN' }));
  let huy;
  const p = new Promise((_, loi) => {
    huy = () => loi(new LoiAi('Đã hết giờ hoặc đã dừng.', { nha, ma: 'QUA_THOI_GIAN' }));
    tinHieu.addEventListener('abort', huy, { once: true });
  });
  return Promise.race([viec, p]).finally(() => tinHieu.removeEventListener('abort', huy));
}

/** Thứ tự nhà sẽ thử cho lần chạy này. */
function thuTuNha(agent, lyDoNang) {
  const chinh = { vai: 'chinh', nha: agent.nha, model: agent.model, muc: agent.muc_suy_nghi };
  const duPhong = agent.nha_du_phong && agent.model_du_phong
    ? { vai: 'du_phong', nha: agent.nha_du_phong, model: agent.model_du_phong, muc: agent.muc_suy_nghi } : null;
  const nc = agent.nang_cap || {};
  if (lyDoNang && nc.nha && nc.model) {
    // Chưa có khóa của nhà nâng cấp (thường là Anthropic) → dùng model thay thế đã cấu hình (bản 2.4: gpt-6-sol).
    const thay = nc.thay_khi_thieu_khoa;
    if (thay?.nha && thay?.model && !require('../khoa').lay(nc.nha)) {
      return [{ vai: 'nang', nha: thay.nha, model: thay.model, muc: nc.muc_suy_nghi || 'vua' }, chinh, duPhong].filter(Boolean);
    }
    const nang = { vai: 'nang', nha: nc.nha, model: nc.model, muc: nc.muc_suy_nghi || 'vua' };
    const nangDuPhong = nc.model_du_phong ? { ...nang, vai: 'nang_du_phong', model: nc.model_du_phong } : null;
    return [nang, nangDuPhong, chinh, duPhong].filter(Boolean);
  }
  const s = loiNhaChinh.get(agent.id);
  const dangNghi = s && s.lan >= NGUONG_LOI && Date.now() - s.tu < NGHI_NHA_CHINH_MS;
  return (dangNghi && duPhong ? [duPhong, chinh] : [chinh, duPhong]).filter(Boolean);
}

/** Lý do nâng lên Claude do chính runtime nhận ra (A.7 luật 4). Các luật khác do nơi gọi truyền vào. */
function lyDoNangTuDong(agent) {
  // #88 (26/9/2026): có dự phòng thì lỗi của nhà chính đi sang dự phòng (rẻ), không nâng lên model đắt — nâng chỉ dành cho
  // chất lượng (Bộ kiểm tra chặn, khiếu nại…), do nơi gọi truyền vào.
  if (!agent.nang_cap?.model || (agent.nha_du_phong && agent.model_du_phong)) return null;
  const s = loiNhaChinh.get(agent.id);
  return s && s.lan >= NANG_KHI_LOI && Date.now() - s.tu < NGHI_NHA_CHINH_MS ? `Model chính lỗi ${s.lan} lần liên tiếp` : null;
}

/**
 * Chạy một Agent một lần.
 * @param {object} o
 * @param {string} o.agentId
 * @param {string} o.kichHoat           vì sao chạy (ghi nhật ký), ví dụ "3 bình luận mới"
 * @param {string} o.tinDau             việc cần làm lần này (phần hay đổi — đặt sau lời dặn)
 * @param {string[]} [o.phan]           phần ngữ cảnh ít đổi thêm sau mục lục (A.7)
 * @param {{skill?:boolean, soTay?:boolean, sanPham?:boolean}} [o.mucLuc]  mục lục nạp ở cửa khi_mo_viec
 * @param {object} [o.luocDo]           lược đồ phiếu kết quả
 * @param {(phieu:object)=>string[]} [o.kiemPhieuThem]  điều kiện riêng của phiếu
 * @param {object} [o.lienKet]          { hoiThoaiId, phienLiveId, sanPhamId, sanPhamPhienBan, dienTap }
 * @param {object} [o.nguCanhCongCu]    dữ liệu cho công cụ: soDuocGiao, layKetNoi…
 * @param {string|null} [o.lyDoNang]    lý do nâng lên Claude (A.7), nơi gọi quyết
 * @param {{so_buoc?:number, giay?:number}} [o.gioiHan]  đè giới hạn của Agent (test)
 * @param {string[]} [o.anCongCu]       công cụ của Agent mà model không được gọi trực tiếp (nơi gọi tự làm theo phiếu)
 * @param {{san_pham?:object, so_tay?:object, skill?:object}} [o.nguonDaDua]  bản sửa của nguồn đã đưa sẵn vào ngữ cảnh (A.9)
 * @param {{mime:string, base64:string}[]} [o.anh]  ảnh kèm việc (Tạo từ ảnh #75, tìm mẫu theo ảnh #78)
 * @param {boolean} [o.boQuaKhanCap]  việc người dùng tự bấm (Nói với Mai, Tạo từ ảnh): chạy cả khi "Dừng mọi thứ" bật —
 *   việc có ảnh hưởng vẫn chờ người bấm "Làm"
 * @param {AbortSignal} [o.tinHieu]     dừng từ bên ngoài, ví dụ người dẫn bấm DỪNG AI
 * @param {object} [o.nhaCungCap]       thay bộ nối nhà cung cấp (test)
 * @param {object} [o.thayModel]        { nha, model, muc_suy_nghi, nha_du_phong, model_du_phong } dùng thay cấu hình Agent cho lần chạy
 *   này (Phòng diễn tập dùng model rẻ, #88); khi có thì không nâng lên model đắt
 * @param {string} [o.luuDem]           BH11 (F-115, T8): giữ lưu đệm phần đầu yêu cầu lâu hơn ('12h' — chỉ OpenAI Responses dùng)
 */
async function chayAgent({
  agentId, kichHoat, tinDau, phan = [], mucLuc = {}, luocDo = null, kiemPhieuThem = null,
  lienKet = {}, nguCanhCongCu = {}, lyDoNang = null, gioiHan = null, nhaCungCap = NHA_MAC_DINH,
  anCongCu = [], nguonDaDua = {}, tinHieu = null, anh = null, boQuaKhanCap = false, thayModel = null, luuDem = null,
}) {
  if (tinHieu?.aborted) return { ok: false, boQua: true, loi: { ma: 'BI_DUNG', thong_diep: 'Đã dừng trước khi chạy.' } };
  // thayModel (#88): model riêng cho lần chạy này (buổi tập dùng model rẻ) — không nâng lên model đắt.
  const agentGoc = caiDat.layAgent(agentId);
  const agent = thayModel ? { ...agentGoc, ...thayModel, nang_cap: {} } : agentGoc;
  if (!agent.bat) return { ok: false, boQua: true, loi: { ma: 'AGENT_TAT', thong_diep: `${agent.ten} đang tắt.` } };
  if (caiDat.khanCap() && !boQuaKhanCap) {
    return { ok: false, boQua: true, loi: { ma: 'KHAN_CAP_DANG_BAT', thong_diep: '"Dừng mọi thứ" đang bật: AI không chạy.' } };
  }
  // F-72: "Dừng AI" (chạm trần chi phí) — AI tốn tiền không chạy; việc người tự bấm (Nói với Mai, Tạo từ ảnh) vẫn chạy.
  if (caiDat.dungAi().bat && !boQuaKhanCap) {
    return { ok: false, boQua: true, loi: { ma: 'DUNG_AI', thong_diep: 'AI tạm dừng vì chạm trần chi phí (chốt đơn vẫn chạy). Nâng trần rồi bấm "Chạy AI tiếp".' } };
  }

  const gh = { so_buoc: 3, giay: 20, ...agent.gioi_han, ...(gioiHan || {}) };
  const vt = vaiTro.loiDan(agentId);
  const runId = nhatKy.taoRun({
    agentId, kichHoat, hoiThoaiId: lienKet.hoiThoaiId, phienLiveId: lienKet.phienLiveId,
    sanPhamId: lienKet.sanPhamId, sanPhamPhienBan: lienKet.sanPhamPhienBan, vaiTroPhienBan: vt.phien_ban, dienTap: !!lienKet.dienTap,
  });

  // Bản sửa của từng nguồn AI đã mở (A.9) — công cụ ghi vào đây.
  const nguon = { san_pham: { ...nguonDaDua.san_pham }, so_tay: { ...nguonDaDua.so_tay }, skill: { ...nguonDaDua.skill } };
  const ghiNguon = (loai, khoa, phienBan) => { nguon[loai][khoa] = phienBan; };

  const moViec = { runId, agentId, mucLuc, phanMucLuc: [] };
  await chayCua('khi_mo_viec', moViec);
  const heThong = [vt.noi_dung, ...moViec.phanMucLuc, ...phan].filter(Boolean).join('\n\n');

  const congCu = agent.cong_cu.filter((t) => !anCongCu.includes(t)).map(layCongCu).filter(Boolean)
    .map((c) => ({ ten: c.ten, moTa: c.moTa, thamSo: c.thamSo }));
  const lichSu = [{ vai: 'nguoi', chu: tinDau, ...(anh?.length ? { anh } : {}) }];

  let lyDo = lyDoNang || lyDoNangTuDong(agent);
  let thuTu = thuTuNha(agent, lyDo);
  let iNha = 0;
  let soBuoc = 0;
  let lamLaiPhieu = 0;
  let tokenVao = 0;
  let tokenRa = 0;
  let tien = 0;
  let ketQua = null;
  let loi = null;
  let daDung = thuTu[0];

  const hetHan = Date.now() + gh.giay * 1000;
  const dieuKhien = new AbortController();
  const dungNgoai = () => dieuKhien.abort();
  tinHieu?.addEventListener('abort', dungNgoai, { once: true });
  const henGio = setTimeout(() => dieuKhien.abort(), gh.giay * 1000);

  try {
    for (;;) {
      if (soBuoc >= gh.so_buoc) {
        loi = { ma: 'VUOT_SO_BUOC', thong_diep: `Quá ${gh.so_buoc} bước mà chưa xong.` };
        break;
      }
      if (tinHieu?.aborted) {
        loi = { ma: 'BI_DUNG', thong_diep: 'Người dùng đã dừng AI.' };
        break;
      }
      if (Date.now() >= hetHan) {
        loi = { ma: 'QUA_THOI_GIAN', thong_diep: `Quá ${gh.giay} giây mà chưa xong.` };
        break;
      }
      const cfg = thuTu[iNha];
      daDung = cfg;
      let r;
      try {
        r = await choHoacHuy(nhaCungCap[cfg.nha].goi({
          model: cfg.model, mucSuyNghi: cfg.muc, heThong, lichSu, congCu, luocDo, tinHieu: dieuKhien.signal, luuDem,
        }), dieuKhien.signal, cfg.nha);
      } catch (e) {
        // Người dùng bấm dừng: không phải lỗi của nhà cung cấp, không tính vào lỗi liên tiếp.
        if (tinHieu?.aborted) {
          loi = { ma: 'BI_DUNG', thong_diep: 'Người dùng đã dừng AI.' };
          break;
        }
        if (cfg.vai === 'chinh') ghiLoiNha(agentId);
        const hetGio = e.ma === 'QUA_THOI_GIAN' || dieuKhien.signal.aborted;
        console.error(`  [AI] ${agent.ten} · ${cfg.nha}/${cfg.model} lỗi: ${anKhoa(e.message)}`);
        if (!hetGio && iNha + 1 < thuTu.length) {
          iNha += 1;
          continue;
        }
        loi = { ma: hetGio ? 'QUA_THOI_GIAN' : 'AI_LOI', thong_diep: anKhoa(e.message) };
        break;
      }
      if (cfg.vai === 'chinh') loiNhaChinh.delete(agentId);
      soBuoc += 1;
      tokenVao += r.tokenVao;
      tokenRa += r.tokenRa;
      tien += chiPhi.tinhChiPhi(cfg.model, r.tokenVao, r.tokenRa);

      if (r.goiCongCu.length) {
        lichSu.push({ vai: 'ai', nha: cfg.nha, goc: r.goc, goiCongCu: r.goiCongCu, chu: r.chu });
        const ketQuaCongCu = [];
        let biKiemTraChan = false;
        for (const g of r.goiCongCu) {
          const kq = await thucHienCongCu({
            ten: g.ten, thamSo: g.thamSo, runId, agent,
            nguCanh: {
              ...nguCanhCongCu, phienLiveId: lienKet.phienLiveId ?? null, dienTap: !!lienKet.dienTap, ghiNguon,
              // Công cụ gọi Agent con (tìm mẫu theo ảnh) dùng cùng nhà cung cấp — để test với AI giả đi trọn đường.
              ...(nhaCungCap !== NHA_MAC_DINH ? { nhaCungCap } : {}),
            },
          });
          if (kq.loi?.ma === 'KIEM_TRA_CHAN') biKiemTraChan = true;
          ketQuaCongCu.push({ id: g.id, ten: g.ten, noiDung: JSON.stringify(kq.loi ? { loi: kq.loi } : kq.ketQua ?? null), loi: !!kq.loi });
        }
        lichSu.push({ vai: 'cong_cu', nha: cfg.nha, ketQua: ketQuaCongCu });
        // A.7 luật 1: Bộ kiểm tra vừa chặn một câu → bước sau thử lại bằng Claude (Agent có cấu hình nâng).
        if (biKiemTraChan && !lyDo && agent.nang_cap?.model) {
          lyDo = 'Bộ kiểm tra vừa chặn một câu';
          thuTu = thuTuNha(agent, lyDo);
          iNha = 0;
        }
        continue;
      }

      // Không gọi công cụ nữa: đây là phiếu kết quả.
      const phieu = luocDo ? docPhieu(r.chu) : { chu: r.chu };
      const xong = await chayCua('khi_agent_xong', { runId, agentId, phieu, luocDo, kiemThem: kiemPhieuThem });
      if (xong.quyet_dinh === 'cho_qua') {
        ketQua = phieu;
        break;
      }
      if (lamLaiPhieu >= 1) {
        loi = { ma: 'PHIEU_SAI', thong_diep: xong.ly_do };
        break;
      }
      lamLaiPhieu += 1;
      lichSu.push({ vai: 'ai', nha: cfg.nha, goc: r.goc, goiCongCu: [], chu: r.chu });
      lichSu.push({ vai: 'nguoi', chu: `Phiếu kết quả chưa đúng: ${xong.ly_do}. Trả lại đúng một phiếu JSON theo lược đồ.` });
    }
  } finally {
    clearTimeout(henGio);
    tinHieu?.removeEventListener('abort', dungNgoai);
  }

  nhatKy.xongRun(runId, {
    nha: daDung?.nha, model: daDung?.model, mucSuyNghi: daDung?.muc, lyDoNang: lyDo, tokenVao, tokenRa, chiPhi: tien, soBuoc,
    ketQua, loi, soTayPhienBan: nguon.so_tay, skillPhienBan: nguon.skill,
    // Nơi gọi không nói sản phẩm nào thì ghi sản phẩm đầu tiên AI đã mở (A.9: sản phẩm + bản sửa).
    ...(lienKet.sanPhamId ? {} : Object.entries(nguon.san_pham).slice(0, 1).map(([sanPhamId, pb]) => ({ sanPhamId, sanPhamPhienBan: pb }))[0]),
  });
  const canhBao = chiPhi.kiemMucTran();
  chiPhi.baoVuotTran(phat, canhBao);
  phat('agent.run', { run_id: runId, agent_id: agentId, ok: !loi });

  return { ok: !loi, runId, ketQua, loi, nha: daDung?.nha, model: daDung?.model, soBuoc, chiPhi: tien, lyDoNang: lyDo, nguon };
}

/** Tình trạng nhà chính của từng Agent (nút "Kiểm tra" trước khi live): lỗi liên tiếp, đang đi thẳng nhà dự phòng. */
function trangThaiNha() {
  return caiDat.danhSachAgent().map((a) => {
    const s = loiNhaChinh.get(a.id);
    const dangNghi = !!(s && s.lan >= NGUONG_LOI && Date.now() - s.tu < NGHI_NHA_CHINH_MS);
    return { agent_id: a.id, ten: a.ten, nha: a.nha, model: a.model, nha_du_phong: a.nha_du_phong, model_du_phong: a.model_du_phong,
      loi_lien_tiep: s?.lan || 0, dang_dung_du_phong: dangNghi };
  });
}

module.exports = { chayAgent, datLaiTrangThaiNha, thuTuNha, trangThaiNha };
