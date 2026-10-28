// Giọng riêng của Mai (SPEC.md bản 2.5, F-38): giọng đang dùng và model đọc, Mai đọc thử, các giọng đã lưu,
// và ba cách có giọng: tả bằng lựa chọn, nhân bản giọng người thật, chọn trong kho giọng tiếng Việt của Google.
// Tiếng do Google (Gemini 3.8 TTS) đọc; mỗi lần tạo giọng hay đọc tốn một ít tiền, ghi vào chi phí như AI khác.

import { api } from '../api.js';
import { h, toast, dangLam } from '../ui.js';
import { layTyGia, ngay as ngayChung } from '../dinh-dang.js';
import { GhiAm, sangBase64 } from '../ghi-am.js';
import { veTongGiong } from './tong-giong.js';
import { veGiongRieng } from './giong-rieng.js';

const TEN_LOAI = { ta: 'Tả bằng lựa chọn', nhan_ban: 'Nhân bản', kho: 'Kho Google' };
const CAU_THU = 'Dạ em chào cả nhà, em là Mai, trợ lý bán hàng của shop. Hôm nay bên em có mẫu sơ mi linen mới về, mặc mát lắm ạ.';

function chon(giaTri, luaChon, thuocTinh = {}) {
  const s = h('select', thuocTinh, luaChon.map(([gt, chu]) => h('option', { value: gt, selected: gt === giaTri }, chu)));
  s.value = giaTri ?? '';
  return s;
}

function tien(usd) {
  const d = Math.round((usd || 0) * layTyGia());
  return d < 10 ? 'dưới 10 đồng' : `khoảng ${d.toLocaleString('vi-VN')} đồng`;
}

const ngay = ngayChung;

/* ---------------- phát tiếng ---------------- */

let dangPhat = null;

// Tải trước rồi mới phát, để còn hiện lỗi dễ hiểu (thẻ <audio> không cho biết vì sao lỗi).
async function taiTieng(duongDan, tuyChon) {
  let r;
  try {
    r = await fetch('/api' + duongDan, tuyChon);
  } catch {
    throw new Error('Phần mềm đã tắt nên trang này không gọi được.');
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.loi?.thong_diep || `Không nghe được (mã ${r.status}).`);
  }
  return r.blob();
}

function phatBlob(blob) {
  if (dangPhat) dangPhat.pause();
  dangPhat = new Audio(URL.createObjectURL(blob));
  return dangPhat.play();
}

async function phat(nut, duongDan, tuyChon) {
  await dangLam(nut, 'Đang đọc…', async () => phatBlob(await taiTieng(duongDan, tuyChon))).catch((e) => toast(e.message, true));
}

const docThu = (nut, chu, id = null) => phat(nut, '/giong-mai/doc', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chu, id }),
});
const ngheGiong = (nut, id) => phat(nut, `/giong-mai/${encodeURIComponent(id)}/nghe`);

/* ---------------- màn hình ---------------- */

export function veGiongMai() {
  const khung = h('div', { class: 'giong-mai' }, h('p', { class: 'muted' }, 'Đang tải…'));
  const tren = h('div', {});
  const ds = h('div', { class: 'ds' });
  let d = null;

  async function taiLai() {
    d = await api.get('/giong-mai');
    veTren();
    veDs();
  }

  function veTren() {
    const dd = d.dang_dung;
    const g = d.giong.find((x) => x.id === dd.id);
    const oModel = chon(dd.model, d.lua_chon.model.map((m) => [m.model, m.ten]), { 'aria-label': 'Model đọc giọng Mai' });
    oModel.addEventListener('change', async () => {
      try {
        d.dang_dung = (await api.put('/giong-mai/dang-dung', { model: oModel.value })).dang_dung;
        toast('Đã đổi model đọc');
      } catch (e) { toast(e.message, true); }
    });
    const nutNghe = h('button', { class: 'btn small', type: 'button', disabled: !g }, '▶ Nghe');
    nutNghe.addEventListener('click', () => ngheGiong(nutNghe, g.id));
    const oChu = h('input', { type: 'text', maxlength: 2000, value: CAU_THU, 'aria-label': 'Câu cho Mai đọc thử' });
    const nutDoc = h('button', { class: 'btn small primary', type: 'button', disabled: !g }, '▶ Mai đọc');
    nutDoc.addEventListener('click', () => docThu(nutDoc, oChu.value));
    tren.replaceChildren(
      h('div', { class: 'hang' },
        h('div', { class: 'field' }, h('span', {}, 'Giọng Mai đang dùng'),
          h('b', {}, g ? g.ten : 'Chưa chọn — tạo hoặc chọn một giọng ở dưới')),
        nutNghe,
        h('label', { class: 'field', style: 'flex:0 1 240px' }, h('span', {}, 'Model đọc'), oModel)),
      h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Mai đọc thử câu bất kỳ'), oChu), nutDoc),
    );
  }

  function veDs() {
    if (!d.giong.length) {
      ds.replaceChildren(h('div', { class: 'empty' }, 'Chưa có giọng nào. Tạo theo lựa chọn, nhân bản, hoặc chọn trong kho ở dưới.'));
      return;
    }
    ds.replaceChildren(...d.giong.map((g) => {
      const dangDung = g.id === d.dang_dung.id;
      const nutNghe = h('button', { class: 'btn small', type: 'button' }, '▶ Nghe');
      nutNghe.addEventListener('click', () => ngheGiong(nutNghe, g.id));
      const nutDung = h('button', { class: 'btn small', type: 'button' }, 'Dùng cho Mai');
      nutDung.addEventListener('click', async () => {
        try {
          await dangLam(nutDung, 'Đang đổi…', () => api.put('/giong-mai/dang-dung', { id: g.id }));
          toast(`Mai dùng giọng "${g.ten}"`);
          await taiLai();
        } catch (e) { toast(e.message, true); }
      });
      const nutXoa = h('button', { class: 'btn small', type: 'button' }, 'Xóa');
      nutXoa.addEventListener('click', async () => {
        const canhBao = g.loai === 'kho' ? '' : ' Giọng tự tạo sẽ bị xóa cả ở Google, không lấy lại được.';
        if (!confirm(`Xóa giọng "${g.ten}"?${canhBao}`)) return;
        try {
          await dangLam(nutXoa, 'Đang xóa…', () => api.del(`/giong-mai/${encodeURIComponent(g.id)}`));
          toast('Đã xóa giọng');
          await taiLai();
        } catch (e) { toast(e.message, true); }
      });
      return h('div', { class: 'ds-hang' },
        h('span', { class: 'dong1' }, h('b', { class: 'grow' }, g.ten),
          h('span', { class: 'chip mute' }, TEN_LOAI[g.loai] || g.loai),
          dangDung && h('span', { class: 'chip ok' }, 'Đang dùng')),
        g.mo_ta && h('span', { class: 'dong2 xuong-dong' }, g.mo_ta),
        h('span', { class: 'dong3' }, g.het_han ? `Google giữ giọng này tới ${ngay(g.het_han)}` : 'Giọng có sẵn của Google, không hết hạn'),
        h('div', { class: 'nutbam' }, nutNghe, !dangDung && nutDung, nutXoa));
    }));
  }

  /* -------- tả bằng lựa chọn -------- */
  function veTa() {
    const L = d.lua_chon;
    const o = Object.fromEntries(['gioi_tinh', 'tuoi', 'vung', 'chat_giong'].map((k) => [k,
      chon(L.mac_dinh[k], L[k].map((x) => [x.id, x.ten]))]));
    const oThem = h('input', { type: 'text', maxlength: 300, placeholder: 'Ví dụ: giọng Bắc Ninh, hay cười, nói hơi nhanh' });
    const oTen = h('input', { type: 'text', maxlength: 80, placeholder: 'Để trống thì MOZA tự đặt tên' });
    const nut = h('button', { class: 'btn primary', type: 'button' }, 'Tạo giọng');
    nut.addEventListener('click', async () => {
      try {
        const kq = await dangLam(nut, 'Google đang tạo giọng (khoảng nửa phút)…', () => api.post('/giong-mai/ta', {
          lua_chon: Object.fromEntries(Object.entries(o).map(([k, s]) => [k, s.value])),
          mo_ta_them: oThem.value, ten: oTen.value,
        }));
        toast(`Đã tạo giọng "${kq.giong.ten}" (${tien(kq.chi_phi_usd)}). Đang phát bản nghe thử…`);
        await taiLai();
        phatBlob(await taiTieng(`/giong-mai/${encodeURIComponent(kq.giong.id)}/nghe`)).catch(() => {});
      } catch (e) { toast(e.message, true); }
    });
    const truong = (nhan, el) => h('label', { class: 'field', style: 'flex:1 1 180px' }, h('span', {}, nhan), el);
    return h('details', {},
      h('summary', {}, h('b', {}, 'Tạo giọng theo lựa chọn')),
      h('div', { class: 'hang' }, truong('Giới tính', o.gioi_tinh), truong('Tuổi', o.tuoi), truong('Giọng vùng', o.vung), truong('Chất giọng', o.chat_giong)),
      h('div', { class: 'hang' }, truong('Mô tả thêm (không bắt buộc)', oThem), truong('Tên giọng (không bắt buộc)', oTen)),
      h('div', { class: 'nutbam' }, nut),
      h('p', { class: 'hint' }, 'Google tạo giọng mất khoảng nửa phút và gửi kèm một bản nghe thử. Mỗi lần tạo tốn khoảng 500 đồng. '
        + 'Không ưng thì tạo lại với lựa chọn khác rồi xóa giọng cũ. Danh sách lựa chọn sửa được trong file server\\cau-hinh\\lua-chon-giong.json.'));
  }

  /* -------- nhân bản giọng người thật -------- */
  function buocGhi(so, tieuDe, chuDoc, [itNhat, nhieuNhat]) {
    let wav = null;
    let ghi = null;
    const vach = h('div', { class: 'vach-am' }, h('span', {}));
    const giay = h('span', { class: 'hint' }, 'Chưa ghi');
    const nutGhi = h('button', { class: 'btn small', type: 'button' }, '● Ghi âm');
    const nutNghe = h('button', { class: 'btn small', type: 'button', disabled: true }, '▶ Nghe lại');
    nutGhi.addEventListener('click', async () => {
      if (!ghi) {
        ghi = new GhiAm({
          khiMuc: (rms) => { vach.firstChild.style.width = `${Math.min(100, rms * 400)}%`; },
          khiGiay: (s) => { giay.textContent = `Đang ghi: ${s.toFixed(1)} giây`; },
        });
        try {
          await ghi.bat();
        } catch (e) {
          ghi = null;
          toast(`Không mở được micro: ${e.message}. Cho phép trình duyệt dùng micro rồi thử lại.`, true);
          return;
        }
        nutGhi.textContent = '■ Dừng';
        nutGhi.className = 'btn small danger';
        nutNghe.disabled = true;
        return;
      }
      const kq = await ghi.dung();
      ghi = null;
      wav = kq.wav;
      vach.firstChild.style.width = '0';
      nutGhi.textContent = '● Ghi lại';
      nutGhi.className = 'btn small';
      nutNghe.disabled = false;
      const nhanXet = kq.giay < itNhat ? ` — ngắn quá, cần ít nhất ${itNhat} giây` : kq.giay > nhieuNhat ? ` — dài quá, tối đa ${nhieuNhat} giây` : ' — được';
      giay.textContent = `Đã ghi ${kq.giay.toFixed(1)} giây${nhanXet}`;
    });
    nutNghe.addEventListener('click', () => phatBlob(new Blob([wav], { type: 'audio/wav' })).catch((e) => toast(e.message, true)));
    return {
      el: h('div', { class: 'buoc-ghi' },
        h('b', {}, `Bước ${so}. ${tieuDe}`),
        h('blockquote', { class: 'doan-doc' }, chuDoc),
        h('div', { class: 'hang' }, nutGhi, nutNghe, giay),
        vach),
      layWav: () => (wav ? sangBase64(wav) : null),
    };
  }

  function veNhanBan() {
    const L = d.lua_chon;
    const oTen = h('input', { type: 'text', maxlength: 80, placeholder: 'Ví dụ: Chị Hoa' });
    const b1 = buocGhi(1, 'Người đó đọc thong thả đoạn mẫu này (10–30 giây)', L.doan_mau, [10, 30]);
    const b2 = buocGhi(2, 'Chính người đó đọc nguyên văn câu đồng ý', `“${L.cau_dong_y}”`, [3, 24]);
    const nut = h('button', { class: 'btn primary', type: 'button' }, 'Nhân bản giọng');
    nut.addEventListener('click', async () => {
      if (!oTen.value.trim()) return toast('Ghi tên người được nhân bản giọng.', true);
      const amMau = b1.layWav();
      const amDongY = b2.layWav();
      if (!amMau || !amDongY) return toast('Ghi âm đủ cả hai bước trước đã.', true);
      try {
        const kq = await dangLam(nut, 'Google đang nhân bản giọng…', () => api.post('/giong-mai/nhan-ban', { ten: oTen.value, am_mau: amMau, am_dong_y: amDongY }));
        toast(`Đã nhân bản giọng (${tien(kq.chi_phi_usd)}).`);
        await taiLai();
      } catch (e) { toast(e.message, true); }
    });
    return h('details', {},
      h('summary', {}, h('b', {}, 'Nhân bản giọng người thật')),
      h('label', { class: 'field', style: 'max-width:360px' }, h('span', {}, 'Tên người được nhân bản'), oTen),
      b1.el, b2.el,
      h('div', { class: 'nutbam' }, nut),
      h('p', { class: 'hint' }, 'Ghi ở chỗ yên tĩnh, cùng một micro cho cả hai bước. Google so khớp người đọc hai đoạn — khác người là bị từ chối. '
        + 'Hai đoạn ghi âm chỉ gửi cho Google để tạo giọng, MOZA không lưu lại.'),
      h('p', { class: 'hint' }, 'Giọng nói là dữ liệu cá nhân: nên có thêm giấy đồng ý ký tay của người được nhân bản, '
        + 'và nhờ người có chuyên môn pháp lý xem trước khi dùng giọng này với khách thật.'));
  }

  /* -------- kho giọng tiếng Việt của Google -------- */
  function veKho() {
    const oGioi = chon('', [['', 'Tất cả'], ['nu', 'Nữ'], ['nam', 'Nam']], { 'aria-label': 'Giới tính' });
    const oTim = h('input', { type: 'text', maxlength: 80, placeholder: 'Tìm theo chữ, ví dụ: warm, narrator' });
    const nutTim = h('button', { class: 'btn small', type: 'button' }, 'Tìm');
    const dsKho = h('div', { class: 'ds' }, h('p', { class: 'muted' }, 'Mở mục này là tải danh sách.'));
    const nutThem = h('button', { class: 'btn small', type: 'button', hidden: true }, 'Xem thêm');
    let trangSau = null;
    let daTai = false;

    const hangKho = (g) => {
      const nutNghe = h('button', { class: 'btn small', type: 'button' }, '▶ Nghe thử');
      nutNghe.addEventListener('click', () => docThu(nutNghe, CAU_THU, g.id));
      const nutLuu = h('button', { class: 'btn small', type: 'button', disabled: g.da_luu }, g.da_luu ? 'Đã lưu' : 'Lưu vào giọng của Mai');
      nutLuu.addEventListener('click', async () => {
        try {
          await dangLam(nutLuu, 'Đang lưu…', () => api.post('/giong-mai/kho', {
            id: g.id, ten: g.ten, mo_ta: [g.phong_cach, g.mo_ta].filter(Boolean).join(' — '), gioi: g.gioi,
          }));
          nutLuu.textContent = 'Đã lưu';
          nutLuu.disabled = true;
          await taiLai();
        } catch (e) { toast(e.message, true); }
      });
      return h('div', { class: 'ds-hang' },
        h('span', { class: 'dong1' }, h('b', { class: 'grow' }, g.ten),
          g.gioi && h('span', { class: 'chip mute' }, g.gioi === 'nu' ? 'Nữ' : 'Nam'), h('span', { class: 'dong3' }, g.id)),
        (g.phong_cach || g.mo_ta) && h('span', { class: 'dong2 xuong-dong' }, [g.phong_cach, g.mo_ta].filter(Boolean).join(' — ')),
        h('div', { class: 'nutbam' }, nutNghe, nutLuu));
    };

    async function tai(noiTiep = false) {
      const q = new URLSearchParams({ gioi: oGioi.value, tim: oTim.value.trim() });
      if (noiTiep && trangSau) q.set('trang', trangSau);
      try {
        const kq = await dangLam(noiTiep ? nutThem : nutTim, 'Đang tải…', () => api.get(`/giong-mai/kho?${q}`));
        trangSau = kq.trang_sau;
        nutThem.hidden = !trangSau;
        const hang = kq.giong.map(hangKho);
        if (noiTiep) dsKho.append(...hang);
        else dsKho.replaceChildren(...(hang.length ? hang : [h('div', { class: 'empty' }, 'Không có giọng nào khớp.')]));
      } catch (e) { toast(e.message, true); }
    }
    nutTim.addEventListener('click', () => tai(false));
    oTim.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tai(false); } });
    oGioi.addEventListener('change', () => tai(false));
    nutThem.addEventListener('click', () => tai(true));
    const hop = h('details', {},
      h('summary', {}, h('b', {}, 'Chọn trong kho giọng tiếng Việt của Google')),
      h('div', { class: 'hang' }, h('label', { class: 'field', style: 'flex:0 1 160px' }, h('span', {}, 'Giới tính'), oGioi),
        h('label', { class: 'field' }, h('span', {}, 'Tìm'), oTim), nutTim),
      h('p', { class: 'hint' }, 'Mô tả giọng là của Google (tiếng Anh). Nghe thử mỗi giọng tốn dưới 50 đồng.'),
      dsKho, h('div', { class: 'nutbam' }, nutThem));
    hop.addEventListener('toggle', () => { if (hop.open && !daTai) { daTai = true; tai(false); } });
    return hop;
  }

  taiLai().then(() => {
    khung.replaceChildren(
      tren,
      veTongGiong(),
      veGiongRieng(),
      h('b', {}, 'Giọng đã lưu'),
      ds,
      veTa(),
      veNhanBan(),
      veKho(),
    );
  }).catch((e) => khung.replaceChildren(h('p', { class: 'loi' }, e.message)));
  return khung;
}
