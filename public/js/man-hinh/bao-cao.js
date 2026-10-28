// Báo cáo bán hàng (SPEC.md F-58): theo buổi live, theo ngày, theo sản phẩm — bình luận → chốt → đơn chờ xác nhận →
// đã xác nhận → đã gửi → đã giao / hoàn / hủy; doanh số; lãi gộp theo giá vốn chụp trên dòng đơn; tỷ lệ hoàn; chi phí AI.
// Dữ liệu Phòng diễn tập không được tính — trừ khi chọn "Buổi tập" (#87): khi đó chỉ xem dữ liệu diễn tập.

import { api } from '../api.js';
import { h, gioPhut, toast, dangLam, trangTrong } from '../ui.js';
import { tien, usdVnd as usd, docNgay, ngayTuIso } from '../dinh-dang.js';
import { chipTrangThai } from '../trang-thai.js';

const TEN_AGENT = {
  director: 'Director', cohost: 'Co-host', tu_van: 'Tư vấn viên AI', soat_san_pham: 'Soát sản phẩm', bai_hoc: 'Đề xuất bài học',
  nguoi_dong_vai: 'Người đóng vai', soan_kich_ban: 'Soạn kịch bản', doc_anh: 'Đọc ảnh (Tạo từ ảnh)', quan_ly: 'Nói với Mai',
  doc_chot: 'Đọc bình luận chốt', tim_mau: 'Tìm mẫu theo ảnh', khach_gia: 'Khách giả (diễn tập)', soan_bai: 'Soạn bài báo trước live',
  tong_ket: 'Tổng kết sau live',
};
const phanTram = (x) => (x == null ? '—' : `${x}%`);

const COT_DON = [
  ['don', 'Đơn'], ['cho_xac_nhan', 'Chờ XN'], ['da_xac_nhan', 'Đã XN'], ['da_gui', 'Đã gửi'], ['da_giao', 'Đã giao'], ['hoan', 'Hoàn'], ['da_huy', 'Hủy'],
];

function bang(dong, dau, cot) {
  return h('div', { style: 'overflow:auto' }, h('table', { class: 'bang-bc' },
    h('thead', {}, h('tr', {}, dau.map((x) => h('th', {}, x)), cot.map(([, ten]) => h('th', { class: 'num' }, ten)))),
    h('tbody', {}, dong.map((d) => h('tr', {}, d.dau.map((x) => h('td', {}, x)), cot.map(([k, , dinhDang]) => h('td', { class: 'num' }, dinhDang ? dinhDang(d[k]) : String(d[k] ?? 0))))))));
}

const CANH_BAO = { so: '⚠ số cần xem lại', tu_cam: '⚠ từ cấm' };

/**
 * Nhật ký buổi live (F-80): chữ lên sóng theo giờ — lời Mai, Đội AI, người dẫn, màn hình, sự kiện, câu Co-host, bình luận chốt.
 * Câu Mai có số tiền lạ / từ cấm được MOZA đánh dấu (soát bằng mã). Ô tìm chữ ("150k").
 */
function veNhatKy(vung, p) {
  const oTim = h('input', { type: 'search', placeholder: 'Tìm chữ trong nhật ký, ví dụ 150k', 'aria-label': 'Tìm trong nhật ký' });
  const ds = h('div', { class: 'nhat-ky' });
  const tai = async () => {
    let d;
    try { d = await api.get(`/live/phien/${p.id}/nhat-ky?q=${encodeURIComponent(oTim.value)}`); } catch (e) { toast(e.message, true); return; }
    ds.replaceChildren(...(d.dong.length ? d.dong.map((x) => h('div', { class: 'nk-dong' },
      h('span', { class: 'muted' }, gioPhut(x.luc)), chipTrangThai('nhat_ky', x.loai, x.ten_loai),
      h('span', { class: 'grow' }, x.noi_dung),
      ...(x.canh_bao ? x.canh_bao.split(',').map((c) => h('span', { class: 'chip bad' }, CANH_BAO[c] || c)) : [])))
      : [h('div', { class: 'empty' }, oTim.value ? 'Không có dòng nào khớp.' : 'Buổi này chưa có dòng nhật ký nào.')]));
    tomTat.textContent = `${d.dong.length} dòng · giữ ${d.giu_ngay} ngày rồi tự xóa · ${d.dong.filter((x) => x.canh_bao).length} dòng cần xem lại`;
  };
  const tomTat = h('p', { class: 'hint' });
  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(tai, 250); });
  vung.replaceChildren(h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, `Nhật ký · ${p.ten}`), h('span', { class: 'grow' }), h('button', { class: 'btn small', type: 'button', onclick: () => vung.replaceChildren() }, 'Đóng')),
    h('div', { class: 'body' }, oTim, tomTat, ds)));
  tai();
  vung.scrollIntoView({ behavior: 'smooth' });
}

const chep = async (chu) => { try { await navigator.clipboard.writeText(chu); toast('Đã chép'); } catch { prompt('Chép:', chu); } };

const BUOC_PHEU = [['nguoi_chot', 'Người chốt'], ['don', 'Đơn'], ['tra_loi', 'Khách trả lời tin'], ['xac_nhan', 'Đã xác nhận'], ['da_gui', 'Đã gửi'], ['da_giao', 'Đã giao']];
const BUOC_ROI = [['hoan', 'Hoàn'], ['huy_qua_gio', 'Hủy vì quá giờ giữ'], ['huy_khach', 'Khách hủy'], ['huy_shop', 'Shop hủy / trả kho']];

/**
 * Bảng từng đoạn của buổi + "Mai đề xuất kịch bản buổi sau" (F-117, BH12): bảng do máy đếm (từ 10 phút số liệu); nút nhờ Mai soạn NHÁP
 * (thứ tự món, số phút, chỗ đổi lời mở) — người sửa rồi bấm "Lưu thành kịch bản", buổi sau chọn ở ô kịch bản của Phòng diễn tập / Bắt đầu live.
 */
function veBangDoan(b, p) {
  if (!b?.du_so_lieu) {
    return h('p', { class: 'hint' }, `Cần từ 10 phút số liệu theo phút để chia đoạn (buổi này có ${b?.so_phut || 0} phút). Buổi live thật dài hơn 10 phút sẽ có bảng này.`);
  }
  const vungNhap = h('div', {});
  const dau = ['Món', 'Trong video', 'Số phút', 'Người xem đầu → cuối', 'Người chốt', 'Câu hỏi', 'Đánh dấu'];
  const bang = h('div', { style: 'overflow:auto' }, h('table', { class: 'bang-bc' },
    h('thead', {}, h('tr', {}, dau.map((x) => h('th', {}, x)))),
    h('tbody', {}, b.doan.map((x) => h('tr', {}, h('td', {}, `Số ${x.so} · ${x.ten}`), h('td', { class: 'num' }, `${x.tu} – ${x.den}`), h('td', { class: 'num' }, String(x.so_phut)),
      h('td', { class: 'num' }, x.nguoi_xem_dau == null ? '—' : `${x.nguoi_xem_dau} → ${x.nguoi_xem_cuoi}`), h('td', { class: 'num' }, String(x.nguoi_chot)), h('td', { class: 'num' }, String(x.cau_hoi)),
      h('td', {}, x.ra_don ? h('span', { class: 'chip ok' }, 'Ra đơn') : '', x.bo_di ? h('span', { class: 'chip bad' }, 'Người xem bỏ đi') : ''))))));
  const veNhap = (n) => {
    const ds = n.thu_tu.map((x) => ({ ...x }));
    const oTen = h('input', { type: 'text', maxlength: 60, value: /^Buổi sau/i.test(n.ten) ? n.ten : `Buổi sau · ${n.ten}`, 'aria-label': 'Tên kịch bản' });
    const oLoiMo = h('input', { type: 'text', value: n.loi_mo ? n.loi_mo.viec : '', placeholder: 'Chỗ đổi ở lời mở đầu (có thể để trống)', 'aria-label': 'Chỗ đổi lời mở' });
    const bangNhap = h('div', {});
    const ve = () => bangNhap.replaceChildren(h('table', { class: 'bang-bc' },
      h('thead', {}, h('tr', {}, ['Thứ tự', 'Món', 'Số phút', 'Vì sao', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, ds.map((x, i) => h('tr', {}, h('td', { class: 'num' }, String(i + 1)), h('td', {}, `Số ${x.so} · ${x.ten}`),
        h('td', {}, h('input', { type: 'number', min: 1, max: 60, style: 'width:70px', value: x.so_phut ?? '', 'aria-label': `Số phút món ${x.so}`, oninput: (e) => { x.so_phut = e.target.value ? Number(e.target.value) : null; } })),
        h('td', { style: 'white-space:normal' }, x.ly_do || h('span', { class: 'muted' }, '—')),
        h('td', {}, h('button', { class: 'btn small', type: 'button', title: 'Lên', disabled: i === 0, onclick: () => { [ds[i - 1], ds[i]] = [ds[i], ds[i - 1]]; ve(); } }, '↑'),
          h('button', { class: 'btn small', type: 'button', title: 'Xuống', disabled: i === ds.length - 1, onclick: () => { [ds[i + 1], ds[i]] = [ds[i], ds[i + 1]]; ve(); } }, '↓')))))));
    ve();
    const luu = async (e) => {
      const doan = [
        { san_pham_id: null, loi_nhac: `- ${oLoiMo.value.trim() || 'Chào cả nhà, giới thiệu shop, nhắc cách chốt.'}` },
        ...ds.map((x) => ({ san_pham_id: x.san_pham_id, loi_nhac: x.so_phut ? `- Khoảng ${x.so_phut} phút.${x.ly_do ? `
- ${x.ly_do}` : ''}` : (x.ly_do ? `- ${x.ly_do}` : '') })),
        { san_pham_id: null, loi_nhac: '- Tóm vài món nổi bật, nhắc ai đã chốt mở tin nhắn của shop để xác nhận đơn, cảm ơn.' },
      ];
      try {
        const kq = await dangLam(e.target, 'Đang lưu…', () => api.post('/kich-ban', { ten: oTen.value.trim() || 'Kịch bản buổi sau', doan }));
        toast(`Đã lưu kịch bản "${kq.kich_ban.ten}". Buổi sau chọn nó ở ô kịch bản khi bắt đầu tập hoặc lên live.`);
      } catch (er) { toast(er.message, true); }
    };
    vungNhap.replaceChildren(
      h('p', { class: 'hint' }, `Mai soạn nháp lúc ${gioPhut(n.luc)} từ bảng đoạn ở trên (không tên khách, không số điện thoại).${n.bo ? ` Bỏ ${n.bo} phần sai số hoặc trái luật.` : ''} Bạn sửa thứ tự, số phút rồi lưu.`),
      n.loi_mo ? h('p', {}, h('b', {}, 'Lời mở đầu: '), n.loi_mo.viec, n.loi_mo.vi_sao ? h('span', { class: 'muted' }, ` — ${n.loi_mo.vi_sao}`) : '') : '',
      bangNhap, h('label', { class: 'field' }, h('span', {}, 'Chỗ đổi ở lời mở đầu'), oLoiMo), h('label', { class: 'field' }, h('span', {}, 'Tên kịch bản'), oTen),
      h('button', { class: 'btn primary', type: 'button', onclick: luu }, 'Lưu thành kịch bản'));
  };
  const nut = h('button', { class: 'btn', type: 'button', onclick: async (e) => {
    try {
      const n = await dangLam(e.target, 'Mai đang soạn…', () => api.post(`/live/phien/${p.id}/de-xuat-kich-ban`, {}));
      if (n.it_du_lieu) vungNhap.replaceChildren(h('p', { class: 'hint' }, 'Chưa đủ số liệu để đề xuất.'));
      else veNhap(n);
    } catch (er) { toast(er.message, true); }
  } }, '✨ Mai đề xuất kịch bản buổi sau');
  return h('div', {}, bang,
    h('p', { class: 'hint' }, 'Ra đơn = số người chốt từ mức trung bình các đoạn trở lên. Người xem bỏ đi = người xem tụt từ 20% trong đoạn. Máy đếm, không phải AI.'),
    nut, vungNhap);
}

/**
 * Tổng kết buổi (F-102): phễu do máy đếm (so trung bình 5 buổi thật trước khi đủ), món bán chạy, món hỏi nhiều ít chốt, tối đa 3 gợi ý
 * AI (tự viết sau 6 giờ khi đủ 5 người chốt). Mốc từng món (F-103): giờ trong video, đoạn 45 giây gợi ý cắt Reels không có tên khách,
 * chú thích máy điền (không giá) để chép.
 */
function veTongKet(vung, p) {
  const than = h('div', { class: 'body' }, h('div', { class: 'empty' }, 'Đang đếm…'));
  vung.replaceChildren(h('section', { class: 'panel' },
    h('header', {}, h('h2', {}, `Tổng kết · ${p.ten}`), h('span', { class: 'grow' }), h('button', { class: 'btn small', type: 'button', onclick: () => vung.replaceChildren() }, 'Đóng')),
    than));
  const tai = async () => {
    let d;
    try { d = await api.get(`/bao-cao/phien/${p.id}/tong-ket`); } catch (e) { toast(e.message, true); return; }
    const ss = d.so_sanh;
    const o = ([k, ten]) => h('div', { class: 'tile' }, h('span', { class: 'k' }, ten), h('span', { class: 'v num' }, String(d.pheu[k])),
      h('span', { class: 's' }, ss ? `TB 5 buổi trước: ${ss[k]}` : ' '));
    const vungGoiY = h('div', {});
    const veGoiY = (g) => {
      if (g?.goi_y?.length) {
        vungGoiY.replaceChildren(h('ol', { class: 'goi-y-tk' }, g.goi_y.map((x) => h('li', {}, h('b', {}, x.viec), h('div', { class: 'muted' }, x.vi_sao)))),
          h('p', { class: 'hint' }, `AI viết lúc ${gioPhut(g.luc)} từ số liệu gộp (không tên khách).${g.bo ? ` Bỏ ${g.bo} gợi ý sai số hoặc trái luật.` : ''}`));
      } else if (g && !g.it_du_lieu) {
        vungGoiY.replaceChildren(h('p', { class: 'hint' }, 'AI chưa có gợi ý nào qua được bước kiểm số. Xem phễu ở trên.'));
      } else if (d.du_goi_y) {
        vungGoiY.replaceChildren(h('p', { class: 'hint' }, 'Gợi ý tự viết sau 6 giờ kể từ lúc live xong (đợi khách trả lời, xác nhận).'),
          h('button', { class: 'btn small', type: 'button', onclick: async (e) => {
            try { veGoiY(await dangLam(e.target, 'Đang viết…', () => api.post(`/bao-cao/phien/${p.id}/goi-y`))); } catch (er) { toast(er.message, true); }
          } }, 'Viết gợi ý ngay'));
      } else {
        vungGoiY.replaceChildren(h('p', { class: 'hint' }, 'Buổi dưới 5 người chốt: số còn ít, AI không kết luận. Xem phễu ở trên.'));
      }
    };
    veGoiY(d.goi_y);
    const m = d.moc;
    const vungDoan = veBangDoan(d.bang_doan, p);
    than.replaceChildren(
      d.phien.dien_tap ? h('p', { class: 'hint' }, 'Buổi tập — số liệu không lẫn với buổi thật.') : '',
      h('div', { class: 'tiles' }, ...BUOC_PHEU.map(o)),
      h('div', { class: 'tiles' }, ...BUOC_ROI.map(o),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, 'Câu hỏi chưa ai trả lời'), h('span', { class: 'v num' }, String(d.cau_hoi_chua_tra_loi)), h('span', { class: 's' }, ' ')),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, 'Chi phí AI'), h('span', { class: 'v num' }, usd(d.chi_phi_ai_usd)), h('span', { class: 's' }, ' '))),
      ss ? '' : h('p', { class: 'hint' }, 'Đủ 5 buổi thật trước đó thì hiện thêm số trung bình để so.'),
      h('h3', {}, 'Bán chạy'),
      d.ban_chay.length ? h('ul', {}, d.ban_chay.map((x) => h('li', {}, `Số ${x.so} · ${x.ten}: ${x.so_chiec} chiếc · ${tien(x.tien)}`))) : h('p', { class: 'hint' }, 'Chưa bán được món nào.'),
      d.hoi_nhieu_it_chot.length ? h('h3', {}, 'Hỏi nhiều, ít chốt') : '',
      d.hoi_nhieu_it_chot.length ? h('ul', {}, d.hoi_nhieu_it_chot.map((x) => h('li', {}, `Số ${x.so} · ${x.ten}: ${x.hoi} câu hỏi, ${x.chot} đơn`))) : '',
      h('h3', {}, 'Gợi ý cho buổi sau'), vungGoiY,
      h('h3', {}, 'Từng đoạn của buổi'), vungDoan,
      h('h3', {}, 'Mốc từng món trong video'),
      m.moc.length ? h('div', { style: 'overflow:auto' }, h('table', { class: 'bang-bc' },
        h('thead', {}, h('tr', {}, ['Món', 'Trong video', 'Người chốt', 'Đoạn nên cắt (45 giây)', 'Chú thích', ''].map((x) => h('th', {}, x)))),
        h('tbody', {}, m.moc.map((x) => h('tr', {}, h('td', {}, `Số ${x.so} · ${x.ten}`), h('td', { class: 'num' }, `${x.tu} – ${x.den}`),
          h('td', { class: 'num' }, String(x.nguoi_chot)), h('td', {}, x.clip ? `${x.clip.tu} – ${x.clip.den}` : h('span', { class: 'muted' }, x.clip_ghi_chu)),
          h('td', {}, x.chu_thich), h('td', {}, h('button', { class: 'btn small', type: 'button', onclick: () => chep(x.chu_thich) }, 'Chép')))))))
        : h('p', { class: 'hint' }, 'Buổi này chưa có dòng thời gian món (chưa lên sóng hoặc chưa chuyển món nào).'),
      m.moc.length ? h('p', { class: 'hint' }, [
        m.xap_xi ? 'Giờ tính theo lúc MOZA thấy live (lệch khoảng ±30 giây).' : 'Giờ tính theo giờ bắt đầu Facebook trả về.',
        'Đoạn nên cắt tránh 40 giây sau mỗi lần chốt (lúc đọc tên khách trên sóng / Thanh chữ).',
        `Facebook tự xóa video live sau 30 ngày (còn ${m.nhac.con_ngay_video} ngày): tải về hoặc bấm "Hoãn xóa 6 tháng" trên Facebook.`,
        'Đoạn có người mẫu: hỏi họ đồng ý trước khi đăng Reels.',
        m.co_giong_ai ? 'Buổi có giọng trợ lý AI: bật nhãn nội dung AI khi đăng.' : '',
      ].filter(Boolean).join(' ')) : '');
  };
  tai();
  vung.scrollIntoView({ behavior: 'smooth' });
}

const COT_TIEN = [['doanh_so', 'Doanh số', tien], ['lai_gop', 'Lãi gộp', tien], ['chua_tinh_von', 'Chưa tính vốn', tien], ['ty_le_hoan', 'Tỷ lệ hoàn', phanTram]];

export async function ve(khung) {
  const homNay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const truoc30 = new Date(Date.now() + 7 * 3600000 - 30 * 86400000).toISOString().slice(0, 10);
  // Ô ngày kiểu dd/mm/yyyy (ô chọn ngày của trình duyệt hiện kiểu Mỹ): gõ tay hoặc bấm nút nhanh; .value luôn là yyyy-mm-dd hợp lệ.
  const oNgay = (iso) => {
    const o = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'dd/mm/yyyy', maxlength: 10, class: 'o-ngay', value: ngayTuIso(iso) });
    let tot = iso;
    Object.defineProperty(o, 'iso', { get: () => tot, set: (v) => { tot = v; o.value = ngayTuIso(v); } });
    o.addEventListener('input', () => { const x = docNgay(o.value); o.classList.toggle('sai', !!o.value && !x); if (x) { tot = x; o.dispatchEvent(new Event('ngay-doi')); } });
    o.addEventListener('blur', () => { o.value = ngayTuIso(tot); o.classList.remove('sai'); });
    return o;
  };
  const oTu = oNgay(truoc30);
  const oDen = oNgay(homNay);
  const lui = (n) => new Date(Date.now() + 7 * 3600000 - n * 86400000).toISOString().slice(0, 10);
  const dauThang = homNay.slice(0, 8) + '01';
  const nutNhanh = (chu, tu) => h('button', { class: 'btn small', type: 'button', onclick: () => { oTu.iso = tu; oDen.iso = homNay; tai(); } }, chu);
  const noiDung = h('div', { class: 'view' });
  const vungNhatKy = h('div', {});
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const st = { dienTap: qs.get('dien_tap') === '1' };
  const chon = h('div', { class: 'chon', role: 'group', 'aria-label': 'Loại dữ liệu' });
  const veChon = () => chon.replaceChildren(
    h('button', { type: 'button', 'aria-pressed': String(!st.dienTap), onclick: () => { st.dienTap = false; veChon(); tai(); } }, 'Bán thật'),
    h('button', { type: 'button', 'aria-pressed': String(st.dienTap), onclick: () => { st.dienTap = true; veChon(); tai(); } }, 'Buổi tập'));
  khung.replaceChildren(
    h('div', { class: 'viewbar' }, h('h1', {}, 'Báo cáo bán hàng'), chon, h('span', { class: 'grow' }),
      h('div', { class: 'ngay-nhanh' }, nutNhanh('Hôm nay', homNay), nutNhanh('7 ngày', lui(6)), nutNhanh('30 ngày', lui(30)), nutNhanh('Tháng này', dauThang)),
      h('label', { class: 'field', style: 'flex:0 0 auto' }, h('span', {}, 'Từ ngày'), oTu),
      h('label', { class: 'field', style: 'flex:0 0 auto' }, h('span', {}, 'Đến ngày'), oDen)),
    noiDung);
  const tai = async () => {
    let d;
    try { d = await api.get(`/bao-cao/ban-hang?tu=${oTu.iso}&den=${oDen.iso}${st.dienTap ? '&dien_tap=1' : ''}`); } catch (e) { toast(e.message, true); return; }
    const t = d.tong;
    noiDung.replaceChildren(
      st.dienTap ? h('p', { class: 'hint' }, `Chỉ dữ liệu Phòng diễn tập (đơn, buổi tập). Chi phí AI của diễn tập trong khoảng này: ${usd(d.chi_phi_ai_usd)}.`) : '',
      h('p', { class: 'hint' }, (st.dienTap ? '' : 'Không tính dữ liệu Phòng diễn tập. ') + 'Doanh số = tổng tiền đơn đã xác nhận trở lên (trừ hủy). Lãi gộp = tiền hàng − giá vốn chụp lúc lên đơn; sản phẩm chưa có giá vốn ghi ở cột "Chưa tính vốn".'),
      h('div', { class: 'tiles' },
        h('div', { class: 'tile' }, h('span', { class: 'k' }, 'Doanh số'), h('span', { class: 'v num' }, tien(t.doanh_so)), h('span', { class: 's' }, `${t.da_xac_nhan + t.da_gui + t.da_giao + t.hoan} đơn`)),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, 'Lãi gộp'), h('span', { class: 'v num' }, tien(t.lai_gop)), h('span', { class: 's' }, t.chua_tinh_von ? `${tien(t.chua_tinh_von)} hàng chưa có giá vốn` : 'đủ giá vốn')),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, 'Tỷ lệ hoàn'), h('span', { class: 'v num' }, phanTram(t.ty_le_hoan)), h('span', { class: 's' }, `${t.hoan} đơn hoàn`)),
        h('div', { class: 'tile' }, h('span', { class: 'k' }, 'Đơn hủy'), h('span', { class: 'v num' }, t.da_huy), h('span', { class: 's' }, 'kể cả quá giờ giữ hàng'))),
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Theo buổi live')),
        d.theo_phien.length ? bang(d.theo_phien.map((p) => ({ ...p, dau: [`${p.ten} · ${gioPhut(p.bat_dau)}`,
          h('button', { class: 'btn small', type: 'button', onclick: () => veNhatKy(vungNhatKy, p) }, 'Nhật ký'),
          p.ket_thuc ? h('button', { class: 'btn small', type: 'button', onclick: () => veTongKet(vungNhatKy, p) }, 'Tổng kết') : null,
          // F-94: bình luận mục lục trên video xem lại — đăng lại khi cần.
          p.ket_thuc ? h('button', { class: 'btn small', type: 'button', title: p.muc_luc_luc ? `Đã đăng mục lục lúc ${gioPhut(p.muc_luc_luc)}` : 'Chưa đăng mục lục',
            onclick: async (e) => { try { const r = await dangLam(e.target, '…', () => api.post(`/live/phien/${p.id}/muc-luc`)); toast(r.da_dang ? 'Đã đăng mục lục lên video' : r.ly_do, !r.da_dang); } catch (er) { toast(er.message, true); } } },
          p.muc_luc_luc ? 'Đăng lại mục lục' : 'Đăng mục lục') : null] })), ['Buổi live', ''],
          [['binh_luan', 'Bình luận'], ['binh_luan_chot', 'Chốt'], ['chot_sau_live', 'Chốt sau live'], ...COT_DON, ...COT_TIEN, ['chi_phi_ai_usd', 'Chi phí AI', usd]])
          : trangTrong(st.dienTap ? 'Chưa có buổi tập nào trong khoảng này.' : 'Chưa có buổi live thật nào trong khoảng này.', { href: st.dienTap ? '#/live/dien-tap' : '#/live', chu: st.dienTap ? 'Vào Phòng diễn tập' : 'Bắt đầu live' })),
      vungNhatKy,
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Theo ngày')),
        d.theo_ngay.length ? bang(d.theo_ngay.map((x) => ({ ...x, dau: [x.ngay.split('-').reverse().join('/')] })), ['Ngày'], [...COT_DON, ...COT_TIEN])
          : trangTrong('Chưa có đơn nào trong khoảng này.', { href: '#/live', chu: 'Bắt đầu live' })),
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Sản phẩm bán chạy')),
        d.theo_san_pham.length ? bang(d.theo_san_pham.map((x) => ({ ...x, dau: [`Số ${x.so} · ${x.ten}`] })), ['Sản phẩm'],
          [['so_chiec', 'Số chiếc'], ['tien_hang', 'Tiền hàng', tien], ['lai_gop', 'Lãi gộp', (v) => (v == null ? '—' : tien(v))], ['so_chiec_hoan', 'Chiếc hoàn']])
          : h('div', { class: 'empty' }, 'Chưa bán được món nào trong khoảng này.')),
      h('section', { class: 'panel' }, h('header', {}, h('h2', {}, 'Hiệu quả Agent'), h('p', {}, `Chi phí AI hôm nay ${usd(d.chi_phi.ngay)} · 1 giờ qua ${usd(d.chi_phi.gio)}`)),
        d.agent.length ? h('div', { style: 'overflow:auto' }, h('table', { class: 'bang-bc' },
          h('thead', {}, h('tr', {}, ['Agent', 'Lần chạy', 'Lỗi', 'Nâng lên Claude', '👍', '👎', 'Chi phí'].map((x, i) => h('th', { class: i ? 'num' : '' }, x)))),
          h('tbody', {}, d.agent.map((a) => h('tr', {}, h('td', {}, TEN_AGENT[a.agent_id] || a.agent_id),
            [a.so_lan, a.so_loi, a.so_lan_nang, a.tot, a.xau].map((x) => h('td', { class: 'num' }, String(x))), h('td', { class: 'num' }, usd(a.usd)))))))
          : h('div', { class: 'empty' }, 'Chưa có lần chạy AI nào (không tính diễn tập).')));
  };
  veChon();
  oTu.addEventListener('ngay-doi', tai);
  oDen.addEventListener('ngay-doi', tai);
  await tai();
}
