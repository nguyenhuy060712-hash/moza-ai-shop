// Trợ lý AI (trong Cài đặt; SPEC.md mục 8; F-07 → F-14): vận hành, Skill, lời dặn vai trò, Hook, Luật quyền,
// chờ duyệt, nhật ký "Vì sao". Model từng Agent vẫn đổi ở Cài đặt.
// Skill và lời dặn có phiên bản: "Lưu nháp" không đổi gì AI đang dùng; "Kích hoạt" mới đổi.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam, duongCon, goiY } from '../ui.js';
import { chipTrangThai } from '../trang-thai.js';
import { usdVnd as usd } from '../dinh-dang.js';

const GOC_DUONG = 'cai-dat/tro-ly-ai';
const tuyChon = () => duongCon(GOC_DUONG);

// Tab kỹ thuật chỉ hiện khi bật "Nâng cao" (nhớ trong localStorage).
const KHOA_NANG_CAO = 'moza.nang_cao';
export function dangNangCao() { try { return localStorage.getItem(KHOA_NANG_CAO) === '1'; } catch { return false; } }
function datNangCao(b) { try { localStorage.setItem(KHOA_NANG_CAO, b ? '1' : '0'); } catch { /* bỏ qua */ } }

const TAB = [
  { id: 'van-hanh', ten: 'Vận hành' },
  { id: 'skill', ten: 'Skill' },
  { id: 'vai-tro', ten: 'Lời dặn vai trò', nangCao: true },
  { id: 'hook', ten: 'Hook', nangCao: true },
  { id: 'luat-quyen', ten: 'Luật quyền', nangCao: true },
  { id: 'cho-duyet', ten: 'Chờ duyệt' },
  { id: 'nhat-ky', ten: 'Nhật ký' },
  { id: 'bai-hoc', ten: 'Bài học' },
  { id: 'thu-nghiem', ten: 'Agent thử nghiệm', nangCao: true },
];

const TEN_AGENT = { director: 'Director', cohost: 'Co-host', tu_van: 'Tư vấn viên AI', mieng: 'Miệng của Mai', nguoi_dong_vai: 'Người đóng vai', chep_loi: 'Chép lời người dẫn', soat_tin: 'Soát tin', bai_hoc: 'Đề xuất bài học' };
const TEN_MUC = { cho_phep: 'Cho phép', hoi: 'Hỏi', cam: 'Cấm' };
const TEN_QUYET_DINH = { cho_qua: 'Cho qua', chan: 'Chặn', giu: 'Giữ', sua: 'Sửa' };
// replaceChildren in cả chữ 'false' nếu đưa vào giá trị false: bỏ các con rỗng trước.
const dat = (el, ...con) => el.replaceChildren(...con.flat().filter((x) => x != null && x !== false));

let nghe = null;
let banSua = null; // trình soạn Skill / lời dặn đang mở, để hỏi trước khi rời khi sửa dở

export function roi() {
  if (nghe) window.removeEventListener('moza:ws', nghe);
  nghe = null;
}

export function coThayDoi() {
  return !!banSua && JSON.stringify(banSua.form) !== JSON.stringify(banSua.goc);
}

function ngheWs(fn) {
  roi();
  nghe = (e) => fn(e.detail);
  window.addEventListener('moza:ws', nghe);
}

export async function ve(khung) {
  banSua = null;
  const tab = tuyChon()[0] || 'van-hanh';
  const noiDung = h('div', { class: 'view' });
  const soCho = h('span', { class: 'chip warn', hidden: true });
  dat(khung,
    h('div', { class: 'viewbar' },
      h('nav', { class: 'chon', 'aria-label': 'Phần của Trợ lý AI' }, TAB.filter((t) => !t.nangCao || dangNangCao() || t.id === tab).map((t) => h('a', {
        href: `#/cai-dat/tro-ly-ai/${t.id}`, class: 'tab-link', 'aria-current': t.id === tab ? 'page' : null,
      }, t.ten, t.id === 'cho-duyet' && soCho))),
      h('label', { class: 'chon-o' }, h('input', { type: 'checkbox', checked: dangNangCao(), onchange: (e) => { datNangCao(e.target.checked); ve(khung); } }), ' Nâng cao',
        goiY('Hiện thêm các phần kỹ thuật: Lời dặn vai trò, Hook, Luật quyền, Agent thử nghiệm. Người dùng thường không cần mở.'))),
    noiDung,
  );
  const demCho = async () => {
    const { cho_duyet: n } = await api.get('/trang-thai');
    soCho.textContent = n;
    soCho.hidden = !n;
  };
  demCho();
  const VE = { 'van-hanh': veVanHanh, skill: veSkill, 'vai-tro': veVaiTro, hook: veHook, 'luat-quyen': veLuatQuyen, 'cho-duyet': veChoDuyet, 'nhat-ky': veNhatKy,
    'bai-hoc': veBaiHoc, 'thu-nghiem': veThuNghiem };
  const veTab = VE[tab] || veVanHanh;
  ngheWs((m) => {
    if (m.type === 'cho_duyet') { demCho(); if (tab === 'cho-duyet') veTab(noiDung); }
    if (m.type === 'agent.run' && (tab === 'nhat-ky' || tab === 'van-hanh')) veTab(noiDung);
    if (m.type === 'khan_cap' && (tab === 'van-hanh' || tab === 'luat-quyen')) veTab(noiDung);
    if (m.type === 'bai_hoc' && tab === 'bai-hoc') veTab(noiDung);
  });
  await veTab(noiDung);
}

/* ================= Vận hành ================= */

async function veVanHanh(khung) {
  const d = await api.get('/agent');
  const cp = d.chi_phi;
  const homNay = Object.fromEntries(cp.theo_agent.map((x) => [x.agent_id, x]));

  const oGio = h('input', { type: 'number', min: '0.01', step: '0.01', value: cp.muc_tran.gio });
  const oNgay = h('input', { type: 'number', min: '0.01', step: '0.01', value: cp.muc_tran.ngay });
  const oNgayLive = h('input', { type: 'number', min: '0.01', step: '0.01', value: cp.muc_tran.ngay_co_live ?? 20 });
  const loi = h('p', { class: 'loi', role: 'alert' });
  const nutLuu = h('button', { class: 'btn primary', type: 'submit' }, 'Lưu mức trần');
  const form = h('form', { class: 'hang' },
    h('label', { class: 'field' }, h('span', {}, 'Mức trần theo giờ (USD)'), oGio),
    h('label', { class: 'field' }, h('span', {}, 'Mức trần theo ngày (USD)'), oNgay),
    h('label', { class: 'field' }, h('span', {}, 'Trần ngày có live (USD)'), oNgayLive),
    nutLuu);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    loi.textContent = '';
    try {
      await dangLam(nutLuu, 'Đang lưu…', () => api.put('/muc-tran', { gio: Number(oGio.value), ngay: Number(oNgay.value), ngay_co_live: Number(oNgayLive.value) }));
      toast('Đã lưu mức trần chi phí');
      veVanHanh(khung);
    } catch (x) { loi.textContent = x.message; }
  });

  dat(khung,
    d.khan_cap && h('div', { class: 'panel' }, h('div', { class: 'body' },
      h('p', {}, h('span', { class: 'chip bad' }, 'Đang dừng mọi thứ'), ' ',
        d.khan_cap_ly_do?.thong_diep || 'Người dùng bật công tắc. AI không chạy, hành động có ảnh hưởng thật nằm chờ duyệt.'))),
    h('section', { class: 'panel' },
      h('header', {}, h('h2', {}, 'Ba Agent'), h('p', {}, 'Đổi model, mức suy nghĩ, nhà dự phòng ở Cài đặt → Model từng Agent.')),
      h('div', { class: 'body' }, d.agents.map((a) => {
        const n = homNay[a.id];
        return h('div', { class: 'agent-vh' },
          h('div', { class: 'ten' }, h('b', {}, a.ten), h('span', {}, a.muc_tieu)),
          h('div', {}, h('span', { class: 'muted' }, 'Model'), h('b', {}, `${a.model}`),
            a.model_du_phong && h('span', { class: 'muted' }, `dự phòng ${a.model_du_phong}`)),
          h('div', {}, h('span', { class: 'muted' }, 'Hôm nay'), h('b', {}, `${n?.so_lan || 0} lần chạy`), h('span', { class: 'muted' }, usd(n?.usd))),
          h('div', {}, h('span', { class: 'muted' }, 'Lỗi gần nhất'),
            a.loi_gan_nhat
              ? h('a', { href: `#/cai-dat/tro-ly-ai/nhat-ky/${a.loi_gan_nhat.run_id}` }, `${gioPhut(a.loi_gan_nhat.luc)} · ${a.loi_gan_nhat.loi?.ma || ''}`)
              : h('b', {}, 'Không có')),
          h('span', { class: `chip ${a.bat ? 'ok' : 'mute'}` }, a.bat ? 'Đang bật' : 'Đang tắt'));
      }))),
    h('section', { class: 'panel' },
      h('header', {}, h('h2', {}, 'Chi phí AI'),
        h('p', {}, 'Tính theo token nhà cung cấp trả về × bảng giá trong server/cau-hinh/gia-model.json. Từ 80% trần có dải vàng; vượt trần → tự bật "Dừng AI": AI tạm dừng, chốt đơn bằng mã vẫn chạy. Ngày có buổi live (thật hoặc tập) dùng trần ngày có live.')),
      h('div', { class: 'body' },
        h('div', { class: 'tiles' },
          h('div', { class: 'tile' }, h('span', { class: 'k' }, '1 giờ qua'), h('span', { class: 'v' }, usd(cp.gio)), h('span', { class: 's' }, `trần ${cp.muc_tran.gio} USD`)),
          h('div', { class: 'tile' }, h('span', { class: 'k' }, 'Hôm nay'), h('span', { class: 'v' }, usd(cp.ngay)), h('span', { class: 's' }, `trần ${cp.tran_ngay_ap_dung ?? cp.muc_tran.ngay} USD${cp.co_live_hom_nay ? ' (ngày có live)' : ''}`))),
        d.dung_ai?.bat && h('p', {}, h('span', { class: 'chip bad' }, 'Dừng AI đang bật'), ' ', d.dung_ai.ly_do?.thong_diep || ''),
        form, loi)),
  );
}

/* ================= Trình soạn có phiên bản (Skill, lời dặn) ================= */

/**
 * @param {object} o
 * @param {HTMLElement} o.khung
 * @param {{dang_dung:object, nhap:object|null, lich_su:object[]}} o.du
 * @param {{khoa:string, ten:string, lon?:boolean, goiY?:string}[]} o.truong
 * @param {string} o.duong  đường API gốc, ví dụ /skill/gom-cau-hoi
 * @param {() => void} o.veLai
 */
function veTrinhSoan({ khung, du, truong, duong, veLai, dauTrang = [] }) {
  const nguon = du.nhap || du.dang_dung;
  const goc = Object.fromEntries(truong.map((t) => [t.khoa, nguon[t.khoa] ?? '']));
  banSua = { goc, form: { ...goc } };
  const loi = h('p', { class: 'loi', role: 'alert' });

  const cacO = truong.map((t) => {
    const o = h('textarea', { class: t.lon ? 'lon' : '', maxlength: 8000, placeholder: t.goiY || '' });
    o.value = goc[t.khoa];
    o.addEventListener('input', () => { banSua.form[t.khoa] = o.value; });
    return h('label', { class: 'field' }, h('span', {}, t.ten), o);
  });

  const lam = (nut, chu, viec, thongBao) => async () => {
    loi.textContent = '';
    try {
      await dangLam(nut, chu, viec);
      banSua = null;
      toast(thongBao);
      veLai();
    } catch (x) { loi.textContent = x.message; }
  };
  const nutLuu = h('button', { class: 'btn primary', type: 'button' }, 'Lưu nháp');
  nutLuu.addEventListener('click', lam(nutLuu, 'Đang lưu…', () => api.put(duong, banSua.form), 'Đã lưu bản nháp — AI chưa dùng cho tới khi Kích hoạt'));
  const nutKichHoat = h('button', { class: 'btn', type: 'button', disabled: !du.nhap }, 'Kích hoạt bản nháp');
  nutKichHoat.addEventListener('click', () => {
    if (coThayDoi()) { loi.textContent = 'Bạn đang sửa dở. Bấm "Lưu nháp" trước rồi mới Kích hoạt.'; return; }
    lam(nutKichHoat, 'Đang kích hoạt…', () => api.post(`${duong}/kich-hoat`, {}), 'Đã kích hoạt — AI dùng bản mới từ lần chạy kế tiếp')();
  });
  const nutBo = h('button', { class: 'btn', type: 'button', disabled: !du.nhap }, 'Bỏ bản nháp');
  nutBo.addEventListener('click', () => {
    if (confirm('Bỏ bản nháp này? Bản đang dùng không đổi.')) lam(nutBo, 'Đang bỏ…', () => api.post(`${duong}/bo-nhap`, {}), 'Đã bỏ bản nháp')();
  });
  const coBanTruoc = du.lich_su.some((b) => b.trang_thai === 'cu' && b.phien_ban < du.dang_dung.phien_ban);
  const nutQuayLai = h('button', { class: 'btn', type: 'button', disabled: !coBanTruoc }, 'Quay lại bản trước');
  nutQuayLai.addEventListener('click', () => {
    if (confirm('Dùng lại bản trước? AI đổi theo từ lần chạy kế tiếp.')) {
      lam(nutQuayLai, 'Đang đổi…', () => api.post(`${duong}/quay-lai`, {}), 'Đã quay lại bản trước')();
    }
  });

  dat(khung,
    ...dauTrang,
    h('div', { class: 'body' },
      h('p', { class: 'muted' }, `AI đang dùng bản ${du.dang_dung.phien_ban}.`,
        du.nhap ? ` Bạn đang sửa bản nháp ${du.nhap.phien_ban} (AI chưa dùng).` : ' Sửa rồi bấm "Lưu nháp"; bấm "Kích hoạt" thì AI mới dùng.'),
      ...cacO, loi,
      h('div', { class: 'nutbam' }, nutLuu, nutKichHoat, nutBo, nutQuayLai)),
    h('div', { class: 'body' },
      h('h2', {}, `Các bản (${du.lich_su.length})`),
      h('div', { class: 'lichsu' }, du.lich_su.map((b) => h('details', {},
        h('summary', {}, h('b', {}, `Bản ${b.phien_ban}`), chipTrangThai('ban', b.trang_thai),
          h('span', {}, gioPhut(b.luc, true))),
        h('pre', {}, truong.map((t) => `${t.ten}:\n${b[t.khoa] || '(trống)'}`).join('\n\n')))))),
  );
}

/* ================= Skill ================= */

async function veSkill(khung, chon = null) {
  const { skill: ds } = await api.get('/skill');
  const idChon = chon || tuyChon()[1] || ds[0]?.id;
  const trai = h('div', { class: 'ds' }, ds.map((s) => h('button', {
    type: 'button', 'aria-current': String(s.id === idChon),
    onclick: () => {
      if (coThayDoi() && !confirm('Skill đang sửa dở chưa lưu. Bỏ phần đang sửa?')) return;
      history.replaceState(null, '', `#/cai-dat/tro-ly-ai/skill/${s.id}`);
      veSkill(khung, s.id);
    },
  },
  h('span', { class: 'dong1' }, h('b', {}, s.ten), s.co_nhap && h('span', { class: 'chip warn' }, 'Có nháp')),
  h('span', { class: 'dong2' }, `Dùng khi: ${s.dung_khi}`),
  h('span', { class: 'dong3' }, `Bản ${s.phien_ban} · ${s.agent_ids.map((a) => TEN_AGENT[a]).join(', ') || 'chưa cấp cho Agent nào'}`))));
  const phai = h('section', { class: 'panel' });
  dat(khung,
    h('p', { class: 'hint' }, 'Skill là "tay nghề" của AI. Mục lục (tên + "dùng khi") luôn được nạp cho Agent được cấp; nội dung chỉ mở khi cần. '
      + '"Chạy bài thi" so bản cũ với bản mới để dành tới khi phần mềm xong.'),
    h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, trai), phai),
  );
  if (!idChon) return;
  const du = await api.get(`/skill/${idChon}`);
  const s = du.skill;

  // Mục lục: sửa và lưu ngay (không có phiên bản — SPEC.md mục 7).
  const oTen = h('input', { type: 'text', value: s.ten, maxlength: 120 });
  const oKhi = h('input', { type: 'text', value: s.dung_khi, maxlength: 300 });
  const hop = ['director', 'cohost', 'tu_van'].map((a) => h('label', { class: 'chon-o' },
    h('input', { type: 'checkbox', value: a, checked: s.agent_ids.includes(a) }), ` ${TEN_AGENT[a]}`));
  const loiML = h('p', { class: 'loi', role: 'alert' });
  const nutML = h('button', { class: 'btn small', type: 'button' }, 'Lưu mục lục');
  nutML.addEventListener('click', async () => {
    loiML.textContent = '';
    try {
      await dangLam(nutML, 'Đang lưu…', () => api.put(`/skill/${s.id}`, {
        ten: oTen.value, dung_khi: oKhi.value, agent_ids: hop.map((x) => x.firstChild).filter((x) => x.checked).map((x) => x.value),
      }));
      toast('Đã lưu mục lục Skill');
      veSkill(khung, s.id);
    } catch (x) { loiML.textContent = x.message; }
  });

  veTrinhSoan({
    khung: phai,
    du,
    duong: `/skill/${s.id}`,
    veLai: () => veSkill(khung, s.id),
    truong: [
      { khoa: 'cach_lam', ten: 'Cách làm', lon: true, goiY: 'Từng bước, như dặn một nhân viên mới' },
      { khoa: 'vi_du_dung', ten: 'Ví dụ đúng' },
      { khoa: 'vi_du_sai', ten: 'Ví dụ sai' },
    ],
    dauTrang: [
      h('header', {}, h('h2', {}, s.ten), h('p', {}, `id: ${s.id}`)),
      h('div', { class: 'body' },
        h('h2', {}, 'Mục lục'),
        h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Tên'), oTen), h('label', { class: 'field' }, h('span', {}, 'Dùng khi'), oKhi)),
        h('div', { class: 'hang' }, h('span', { class: 'muted' }, 'Agent được dùng:'), hop, nutML), loiML,
        h('h2', {}, 'Nội dung')),
    ],
  });
}

/* ================= Lời dặn vai trò ================= */

async function veVaiTro(khung, chon = null) {
  const { vai_tro: ds } = await api.get('/vai-tro');
  const idChon = chon || tuyChon()[1] || 'director';
  const trai = h('div', { class: 'ds' }, ds.map((v) => h('button', {
    type: 'button', 'aria-current': String(v.agent_id === idChon),
    onclick: () => {
      if (coThayDoi() && !confirm('Lời dặn đang sửa dở chưa lưu. Bỏ phần đang sửa?')) return;
      history.replaceState(null, '', `#/cai-dat/tro-ly-ai/vai-tro/${v.agent_id}`);
      veVaiTro(khung, v.agent_id);
    },
  }, h('span', { class: 'dong1' }, h('b', {}, v.ten), v.co_nhap && h('span', { class: 'chip warn' }, 'Có nháp')),
  h('span', { class: 'dong3' }, `Đang dùng bản ${v.phien_ban}`))));
  const phai = h('section', { class: 'panel' });
  dat(khung,
    h('p', { class: 'hint' }, 'Lời dặn vai trò là "bản mô tả công việc" gửi cho AI mỗi lần chạy. Viết {ten_ai} để chèn tên AI trong Cài đặt. '
      + 'Sửa lời dặn không đổi công cụ hay luật quyền của Agent.'),
    h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, trai), phai),
  );
  const du = await api.get(`/vai-tro/${idChon}`);
  veTrinhSoan({
    khung: phai,
    du,
    duong: `/vai-tro/${idChon}`,
    veLai: () => veVaiTro(khung, idChon),
    truong: [{ khoa: 'noi_dung', ten: 'Lời dặn', lon: true }],
    dauTrang: [h('header', {}, h('h2', {}, du.ten))],
  });
}

/* ================= Hook ================= */

async function veHook(khung) {
  const { cua } = await api.get('/hook');
  dat(khung,
    h('p', { class: 'hint' }, 'Hook là luật cứng chạy ở 8 "cửa" trong đường đi của AI, có quyền chặn. Hook bắt buộc không tắt được.'),
    ...cua.map((c) => h('section', { class: 'panel' },
      h('header', {}, h('h2', {}, c.ten), h('span', { class: 'chip mute' }, c.id), h('p', {}, `Chạy khi: ${c.khi}`)),
      h('div', { class: 'body' },
        c.hook.length ? c.hook.map((x) => {
          const o = h('input', { type: 'checkbox', checked: x.bat, disabled: x.bat_buoc, role: 'switch', 'aria-label': x.ten });
          o.addEventListener('change', async () => {
            try {
              await api.put(`/hook/${x.id}`, { bat: o.checked });
              toast(o.checked ? `Đã bật "${x.ten}"` : `Đã tắt "${x.ten}"`);
            } catch (loi) { o.checked = !o.checked; toast(loi.message, true); }
          });
          return h('div', { class: 'hook-hang' },
            h('label', { class: 'chon-o' }, o, ' ', h('b', {}, x.ten)),
            x.bat_buoc && h('span', { class: 'chip accent' }, 'Bắt buộc'),
            h('span', { class: 'muted' }, x.mo_ta));
        }) : h('p', { class: 'muted' }, c.ghi_chu || 'Chưa có hook.')))),
  );
}

/* ================= Luật quyền ================= */

async function veLuatQuyen(khung) {
  const d = await api.get('/luat-quyen');
  dat(khung,
    h('p', { class: 'hint' }, 'Mỗi hành động của AI có một luật: Cho phép (làm luôn), Hỏi (vào hàng Chờ duyệt, chờ bạn bấm), Cấm (không làm). '
      + 'Không có công cụ nào xóa dữ liệu, sửa tin, sửa Sổ tay hay sửa Skill. Công cụ của phòng live có ở phần 3 của M2; của Tư vấn viên ở M5.'),
    d.khan_cap && h('p', {}, h('span', { class: 'chip bad' }, 'Đang dừng mọi thứ'), ' Mọi hành động "Có ảnh hưởng thật" đang chuyển thành Hỏi.'),
    h('section', { class: 'panel' }, h('div', { class: 'body' }, d.cong_cu.map((c) => {
      const chon = h('select', { 'aria-label': `Luật cho ${c.ten}` },
        Object.entries(TEN_MUC).map(([k, v]) => h('option', { value: k, selected: k === c.muc }, v + (k === c.mac_dinh ? ' (mặc định)' : ''))));
      chon.addEventListener('change', async () => {
        try {
          await api.put('/luat-quyen', { hanh_dong: c.ten, muc: chon.value === c.mac_dinh ? null : chon.value });
          toast(`${c.ten}: ${TEN_MUC[chon.value]}`);
          veLuatQuyen(khung);
        } catch (loi) { toast(loi.message, true); }
      });
      return h('div', { class: 'luat-hang' },
        h('div', {}, h('b', {}, c.ten), ' ', h('span', { class: `chip ${c.nhom === 'co_anh_huong' ? 'warn' : 'mute'}` }, c.ten_nhom),
          h('span', { class: 'muted xuong-dong' }, c.mo_ta),
          h('span', { class: 'muted xuong-dong' }, c.ai_dung.length ? `Ai dùng: ${c.ai_dung.join(', ')}` : 'Hook dùng')),
        chipTrangThai('muc', c.muc),
        chon);
    }))),
  );
}

/* ================= Chờ duyệt ================= */

async function veChoDuyet(khung) {
  const [{ cho_duyet: ds }, { cho_duyet: hetHan }] = await Promise.all([api.get('/cho-duyet'), api.get('/cho-duyet?trang_thai=het_han')]);
  const xuLy = (m, duyet) => async (e) => {
    try {
      const { muc } = await dangLam(e.currentTarget, duyet ? 'Đang làm…' : 'Đang từ chối…', () => api.post(`/cho-duyet/${m.id}`, { duyet }));
      if (duyet && muc.ket_qua?.loi) toast(`Đã duyệt nhưng không làm được: ${muc.ket_qua.loi.thong_diep}`, true);
      else toast(duyet ? 'Đã duyệt và làm xong' : 'Đã từ chối');
      veChoDuyet(khung);
    } catch (loi) { toast(loi.message, true); }
  };
  dat(khung,
    h('p', { class: 'hint' }, 'Hành động bị luật "Hỏi" hoặc công tắc "Dừng mọi thứ" giữ lại. Không làm gì cho tới khi bạn bấm Duyệt. '
      + 'Duyệt thì câu chữ vẫn phải qua Bộ kiểm tra. Việc do "Dừng mọi thứ" hoặc giới hạn tin giữ lại tự hết hạn sau 24 giờ.'),
    h('section', { class: 'panel' }, h('div', { class: 'body' }, ds.length ? ds.map((m) => h('div', { class: 'cho-hang' },
      h('div', {}, h('b', {}, m.hanh_dong), h('span', { class: 'muted' }, ` · ${gioPhut(m.luc)}`),
        h('span', { class: 'xuong-dong' }, m.ly_do || ''),
        h('pre', { class: 'tham-so' }, JSON.stringify(m.tham_so, null, 2)),
        m.run_id && h('a', { href: `#/cai-dat/tro-ly-ai/nhat-ky/${m.run_id}` }, 'Vì sao?')),
      h('div', { class: 'nutbam' },
        h('button', { class: 'btn primary', type: 'button', onclick: xuLy(m, true) }, 'Duyệt'),
        h('button', { class: 'btn', type: 'button', onclick: xuLy(m, false) }, 'Từ chối')))) : h('div', { class: 'empty' }, 'Không có gì chờ duyệt.'))),
    hetHan.length > 0 && h('details', { class: 'panel' },
      h('summary', { class: 'body' }, chipTrangThai('duyet', 'het_han'), ` ${hetHan.length} việc quá 24 giờ, không còn tính vào số "Chờ duyệt"`),
      h('div', { class: 'body' }, hetHan.map((m) => h('div', { class: 'cho-hang' },
        h('div', {}, h('b', {}, m.hanh_dong), h('span', { class: 'muted' }, ` · ${gioPhut(m.luc)} · hết hạn ${gioPhut(m.het_han_luc)}`),
          h('span', { class: 'xuong-dong' }, m.ly_do || '')),
        h('div', { class: 'nutbam' }, h('button', { class: 'btn', type: 'button', onclick: xuLy(m, false) }, 'Bỏ')))))),
  );
}

/* ================= Nhật ký "Vì sao" ================= */

/** Chi tiết một lần chạy: đủ các mục ở A.9. Dùng lại được ở màn hình khác. */
export function veViSao(d, { onDanhGia } = {}) {
  const r = d.run;
  const dong = (k, v) => v != null && v !== '' && h('div', { class: 'vs-dong' }, h('span', { class: 'muted' }, k), h('span', {}, v));
  const banMap = (o) => Object.entries(o || {}).map(([k, v]) => `${k} (bản ${v})`).join(', ') || null;
  return h('div', { class: 'body vi-sao' },
    dong('Kích hoạt', r.kich_hoat),
    dong('Agent', `${TEN_AGENT[r.agent_id] || r.agent_id} · lời dặn bản ${r.vai_tro_phien_ban ?? '?'}`),
    dong('Model', r.model && `${r.nha} / ${r.model} · suy nghĩ ${r.muc_suy_nghi}`),
    dong('Nâng lên Claude vì', r.ly_do_nang),
    dong('Tin', r.tin_id && `${r.tin_id} (bản ${r.tin_phien_ban})`),
    dong('Sổ tay đã mở', banMap(r.so_tay_phien_ban)),
    dong('Skill đã mở', banMap(r.skill_phien_ban)),
    dong('Số bước · token · chi phí', `${r.so_buoc} bước · ${r.token_vao} vào / ${r.token_ra} ra · ${usd(r.chi_phi_usd)}`),
    dong('Lúc', `${gioPhut(r.bat_dau, true)}${r.dien_tap ? ' · diễn tập' : ''}`),
    r.loi && h('p', {}, h('span', { class: 'chip bad' }, r.loi.ma), ' ', r.loi.thong_diep),
    h('h2', {}, `Công cụ đã gọi (${d.cong_cu.length})`),
    d.cong_cu.length ? h('div', { class: 'lichsu' }, d.cong_cu.map((c) => h('details', {},
      h('summary', {}, h('b', {}, c.cong_cu), c.bi_tu_choi && h('span', { class: 'chip bad' }, 'Bị từ chối'), h('span', { class: 'muted' }, c.ly_do || '')),
      h('pre', {}, `Tham số: ${JSON.stringify(c.tham_so, null, 2)}\n\nKết quả: ${JSON.stringify(c.ket_qua, null, 2)}`)))) : h('p', { class: 'muted' }, 'Không gọi công cụ nào.'),
    h('h2', {}, `Hook (${d.hook.length})`),
    d.hook.length ? d.hook.map((x) => h('p', {}, h('span', { class: `chip ${x.quyet_dinh === 'cho_qua' ? 'ok' : 'bad'}` }, TEN_QUYET_DINH[x.quyet_dinh]),
      ` ${x.hook} · ${x.cua}: ${x.ly_do || ''}`)) : h('p', { class: 'muted' }, 'Không hook nào chặn.'),
    h('h2', {}, 'Kết quả'),
    h('pre', { class: 'tham-so' }, r.ket_qua ? JSON.stringify(r.ket_qua, null, 2) : '(không có)'),
    onDanhGia && h('div', { class: 'nutbam' },
      h('button', { class: 'btn small', type: 'button', onclick: () => onDanhGia('tot') }, '👍 Tốt'),
      h('button', { class: 'btn small', type: 'button', onclick: () => onDanhGia('xau') }, '👎 Chưa tốt'),
      d.danh_gia.length > 0 && h('span', { class: 'muted' }, `Đã đánh giá: ${d.danh_gia.map((x) => (x.diem === 'tot' ? '👍' : '👎')).join(' ')}`)),
  );
}

async function veNhatKy(khung, chon = null) {
  const d = await api.get('/run?so=100');
  const idChon = chon || tuyChon()[1] || null;
  const trai = h('div', { class: 'ds' }, d.run.length ? d.run.map((r) => h('button', {
    type: 'button', 'aria-current': String(r.id === idChon),
    onclick: () => { history.replaceState(null, '', `#/cai-dat/tro-ly-ai/nhat-ky/${r.id}`); veNhatKy(khung, r.id); },
  },
  h('span', { class: 'dong1' }, h('b', {}, TEN_AGENT[r.agent_id] || r.agent_id),
    r.loi ? h('span', { class: 'chip bad' }, r.loi.ma) : r.ket_thuc ? h('span', { class: 'chip ok' }, 'Xong') : h('span', { class: 'chip warn' }, 'Đang chạy'),
    r.dien_tap && h('span', { class: 'chip mute' }, 'Diễn tập')),
  h('span', { class: 'dong2' }, r.kich_hoat),
  h('span', { class: 'dong3' }, `${gioPhut(r.bat_dau)} · ${r.model || ''} · ${usd(r.chi_phi_usd)}`))) : h('div', { class: 'empty' }, 'Chưa có lần chạy AI nào.'));
  const phai = h('section', { class: 'panel' });
  dat(khung,
    h('p', { class: 'hint' }, 'Mỗi lần AI chạy được ghi lại: vì đâu chạy, dùng bản nào của tin / Sổ tay / Skill / lời dặn, model nào, đã gọi gì, bị chặn gì.'),
    h('div', { class: 'hai-cot' }, h('section', { class: 'panel' }, trai), phai),
    (d.hook_ngoai_run.length > 0) && h('section', { class: 'panel' },
      h('header', {}, h('h2', {}, 'Hook đã chặn ngoài lần chạy AI'), h('p', {}, 'Ví dụ: bình luận lộ số điện thoại bị ẩn khi vừa đến.')),
      h('div', { class: 'body' }, d.hook_ngoai_run.map((x) => h('p', {}, h('span', { class: 'muted' }, gioPhut(x.luc)), ` ${x.hook}: ${x.ly_do || ''}`)))),
  );
  if (!idChon) {
    dat(phai, h('div', { class: 'empty' }, 'Chọn một lần chạy bên trái để xem "Vì sao".'));
    return;
  }
  const veChiTiet = async () => {
    const ct = await api.get(`/run/${idChon}`);
    dat(phai, h('header', {}, h('h2', {}, 'Vì sao'), h('p', {}, ct.run.id)),
      veViSao(ct, { onDanhGia: async (diem) => {
        const lyDo = diem === 'xau' ? prompt('Câu này chưa tốt ở đâu? (AI sẽ đề xuất bài học từ lý do này, bạn duyệt ở thẻ Bài học)') : null;
        if (diem === 'xau' && lyDo === null) return;
        await api.post(`/run/${idChon}/danh-gia`, { diem, ly_do: lyDo || null });
        toast(diem === 'xau' && lyDo ? 'Đã ghi 👎 — AI đang đề xuất bài học' : 'Đã ghi đánh giá');
        veChiTiet();
      } }));
  };
  await veChiTiet();
}

/* ================= Bài học (F-36) ================= */

async function veBaiHoc(khung) {
  const [{ bai_hoc: ds }, { skill: dsSkill }, soTay] = await Promise.all([api.get('/bai-hoc'), api.get('/skill'), api.get('/so-tay')]);
  const dsSoTay = soTay.muc || soTay.so_tay || [];
  dat(khung,
    h('p', { class: 'hint' }, 'Chấm 👎 kèm lý do một câu AI (ở Hộp thư hoặc Nhật ký) → AI đề xuất một bài học ở đây. Bài học chưa duyệt không ảnh hưởng gì. '
      + 'Duyệt thì bài học được thêm vào Skill (thành bản mới, kích hoạt ngay) hoặc vào mục Sổ tay (bản sửa mới) — đều quay lại bản trước được.'),
    ds.length ? ds.map((b) => {
      const oNoiDung = h('textarea', { rows: 3 });
      oNoiDung.value = b.noi_dung;
      const oDich = h('select', {}, h('option', { value: 'skill', selected: b.dich === 'skill' }, 'Ghi vào Skill'), h('option', { value: 'so_tay', selected: b.dich === 'so_tay' }, 'Ghi vào Sổ tay'));
      const oId = h('select', {});
      const veId = () => oId.replaceChildren(...(oDich.value === 'skill' ? dsSkill.map((x) => h('option', { value: x.id, selected: x.id === b.dich_id }, x.ten))
        : dsSoTay.map((x) => h('option', { value: x.id, selected: x.id === b.dich_id }, x.tieu_de))));
      oDich.addEventListener('change', veId);
      veId();
      const xuLy = (hanhDong) => async (e) => {
        try {
          await dangLam(e.target, '…', () => api.post(`/bai-hoc/${b.id}`, { hanh_dong: hanhDong, noi_dung: oNoiDung.value, dich: oDich.value, dich_id: oId.value }));
          toast(hanhDong === 'duyet' ? 'Đã ghi bài học' : 'Đã bỏ');
          veBaiHoc(khung);
        } catch (x) { toast(x.message, true); }
      };
      return h('section', { class: 'panel' }, h('div', { class: 'body' },
        h('div', { class: 'hang' }, chipTrangThai('duyet', b.trang_thai), h('span', { class: 'muted' }, gioPhut(b.luc)),
          b.nguon_run_ids[0] && h('a', { href: `#/cai-dat/tro-ly-ai/nhat-ky/${b.nguon_run_ids[0]}` }, 'Câu bị 👎')),
        b.ly_do && h('p', { class: 'hint' }, `Lý do: ${b.ly_do}`),
        b.trang_thai === 'cho_duyet' ? [oNoiDung, h('div', { class: 'hang' }, oDich, oId,
          h('button', { class: 'btn primary small', type: 'button', onclick: xuLy('duyet') }, 'Duyệt'),
          h('button', { class: 'btn small', type: 'button', onclick: xuLy('bo') }, 'Bỏ'))] : h('p', { class: 'xuong-dong' }, b.noi_dung)));
    }) : h('section', { class: 'panel' }, h('div', { class: 'empty' }, 'Chưa có bài học nào. Chấm 👎 kèm lý do một câu AI để bắt đầu.')));
}

/* ================= Agent thử nghiệm (F-34) ================= */

async function veThuNghiem(khung) {
  const d = await api.get('/agent-thu-nghiem');
  const oTen = h('input', { type: 'text', maxlength: 80, placeholder: 'VD: Tóm tắt tin' });
  const oMuc = h('input', { type: 'text', maxlength: 300, placeholder: 'Agent này làm gì' });
  const oLoiDan = h('textarea', { rows: 4, placeholder: 'Lời dặn vai trò: bạn là…, làm…, không được…' });
  const oNha = h('select', {}, Object.entries(d.lua_chon).map(([k, v]) => h('option', { value: k, selected: k === 'openai' }, v.ten)));
  const oModel = h('select', {});
  const veModel = () => oModel.replaceChildren(...d.lua_chon[oNha.value].model.map((m) => h('option', { value: m }, m)));
  oNha.addEventListener('change', veModel);
  veModel();
  const hop = d.cong_cu_doc.map((c) => h('label', { class: 'chon-o', title: c.mo_ta }, h('input', { type: 'checkbox', value: c.ten }), ` ${c.ten}`));
  const nutTao = h('button', { class: 'btn primary', type: 'button' }, 'Thêm Agent thử nghiệm');
  nutTao.addEventListener('click', async () => {
    try {
      await dangLam(nutTao, 'Đang thêm…', () => api.post('/agent-thu-nghiem', {
        ten: oTen.value, muc_tieu: oMuc.value, loi_dan: oLoiDan.value, nha: oNha.value, model: oModel.value,
        cong_cu: hop.map((l) => l.firstChild).filter((o) => o.checked).map((o) => o.value),
      }));
      toast('Đã thêm');
      veThuNghiem(khung);
    } catch (e) { toast(e.message, true); }
  });
  dat(khung,
    h('p', { class: 'hint' }, 'Thêm Agent mới bằng cấu hình, không sửa mã. Agent thử nghiệm chỉ được dùng công cụ nhóm Đọc (không bao giờ gửi tin, sửa dữ liệu), '
      + 'chỉ chạy khi bạn bấm nút; tắt nó thì ba Agent chính không bị ảnh hưởng. Sửa lời dặn ở thẻ Lời dặn vai trò, đổi model ở Cài đặt.'),
    d.agents.map((a) => {
      const oHoi = h('input', { type: 'text', placeholder: 'Gõ yêu cầu cho Agent này' });
      const kq = h('pre', { class: 'tham-so', hidden: true });
      const nutChay = h('button', { class: 'btn small primary', type: 'button', disabled: !a.bat }, 'Chạy');
      nutChay.addEventListener('click', async () => {
        try {
          const r = await dangLam(nutChay, 'Đang chạy…', () => api.post(`/agent-thu-nghiem/${a.id}/chay`, { cau_hoi: oHoi.value }));
          kq.hidden = false;
          kq.textContent = r.ok ? `${r.tra_loi}\n\n(${r.model} · ${usd(r.chi_phi_usd)})` : `Lỗi: ${r.loi?.thong_diep}`;
        } catch (e) { toast(e.message, true); }
      });
      const oBat = h('input', { type: 'checkbox', role: 'switch', checked: a.bat });
      oBat.addEventListener('change', async () => {
        try { await api.put(`/agent-thu-nghiem/${a.id}`, { bat: oBat.checked }); veThuNghiem(khung); } catch (e) { oBat.checked = !oBat.checked; toast(e.message, true); }
      });
      return h('section', { class: 'panel' }, h('header', {}, h('h2', {}, a.ten), h('p', {}, `${a.muc_tieu} · ${a.model} · công cụ: ${a.cong_cu.join(', ') || 'không'}`)),
        h('div', { class: 'body' }, h('label', { class: 'khancap xanh' }, oBat, h('span', {}, a.bat ? 'Đang bật' : 'Đang tắt')),
          h('div', { class: 'hang' }, oHoi, nutChay), kq,
          h('p', {}, h('a', { href: `#/cai-dat/tro-ly-ai/vai-tro/${a.id}` }, 'Sửa lời dặn'), ' · ', h('a', { href: '#/cai-dat/tro-ly-ai/nhat-ky' }, 'Xem nhật ký'))));
    }),
    h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Thêm Agent thử nghiệm')), h('div', { class: 'body' },
      h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Tên'), oTen), h('label', { class: 'field' }, h('span', {}, 'Mục tiêu'), oMuc)),
      h('label', { class: 'field' }, h('span', {}, 'Lời dặn vai trò'), oLoiDan),
      h('div', { class: 'hang' }, h('label', { class: 'field' }, h('span', {}, 'Nhà cung cấp'), oNha), h('label', { class: 'field' }, h('span', {}, 'Model'), oModel)),
      h('div', { class: 'field' }, h('span', {}, 'Công cụ (chỉ nhóm Đọc)'), h('div', { class: 'hang' }, hop)),
      h('div', { class: 'nutbam' }, nutTao))),
  );
}
