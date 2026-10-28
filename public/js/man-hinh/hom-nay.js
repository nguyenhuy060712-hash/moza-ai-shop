// Hôm nay (GD1, F-120; trước là Tổng quan F-33): thẻ buổi live kế tiếp + Bắt đầu live / Tập trước, 4 con số, việc cần làm theo mức
// (Gấp · Cần chú ý · Nên làm), Đội AI như nhân viên, chỉ số AI 7 ngày bằng lời thường. Số 0 thay bằng câu chỉ việc.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam, trangTrong } from '../ui.js';
import { tien } from '../dinh-dang.js';
import { chipMau } from '../trang-thai.js';
import { veTheLive, veDoiHinh, veChiSo } from './hom-nay-phu.js';

// Số 0 không đứng trơ: thay bằng câu chỉ việc (khongCo).
function oSo(nhan, so, phu, lienKet, mau = '', khongCo = null) {
  const rong = khongCo && (so === 0 || so === '0' || so === '0đ');
  return h('a', { class: `tile ${mau} ${rong ? 'so0' : ''}`, href: lienKet },
    h('span', { class: 'k' }, nhan),
    h('span', { class: 'v num' }, rong ? khongCo : so),
    h('span', { class: 's' }, rong ? '' : phu));
}

function hangViec(nhan, mau, chu, hanhDong) {
  return h('div', { class: 'viec-hang', 'data-mau': mau }, chipMau(mau, nhan), h('span', { class: 'grow' }, chu), hanhDong);
}

const MUC_VIEC = [['bad', 'Gấp'], ['warn', 'Cần chú ý'], ['info', 'Nên làm']];

const lienKet = (duong, chu) => h('a', { class: 'btn small', href: duong }, chu);
const TEN_VIEC = { goi_xac_nhan_don: ['Gọi xác nhận đơn', 'warn'], goi_khach: ['Gọi khách', 'warn'], bo_sung_thong_tin: ['Bổ sung thông tin', 'info'],
  xoa_du_lieu: ['Xóa dữ liệu', 'warn'], doi_size: ['Đổi size', 'warn'] };

export async function ve(khung) {
  const t = await api.get('/bao-cao/tong-quan');
  const viec = [];
  const veLai = () => ve(khung);

  // F-77: một dòng tóm tắt bảng Sẵn sàng lên sóng.
  try {
    const ss = await api.get('/live/san-sang');
    if (ss.do.length || ss.vang.length) viec.push(hangViec('Sẵn sàng lên sóng', ss.do.length ? 'bad' : 'warn', `${ss.do.length ? `${ss.do.length} việc đỏ` : ''}${ss.do.length && ss.vang.length ? ', ' : ''}${ss.vang.length ? `${ss.vang.length} việc vàng` : ''}: ${(ss.do[0] || ss.vang[0]).chu}`, lienKet('#/live', 'Xem bảng')));
  } catch { /* bỏ qua */ }
  if (t.facebook?.muc === 'do') viec.push(hangViec('Facebook', 'bad', t.facebook.chu, lienKet('#/cai-dat', 'Lấy mã mới')));
  else if (t.facebook?.muc === 'vang') viec.push(hangViec('Facebook', 'warn', t.facebook.chu, lienKet('#/cai-dat', 'Xem kết nối')));
  if (t.can_nguoi) viec.push(hangViec('Cần người', 'bad', `${t.can_nguoi} hội thoại đang chờ người xử lý.`, lienKet('#/tin-nhan?loc=can_nguoi', 'Mở Tin nhắn')));
  if (t.don?.cho_xac_nhan) viec.push(hangViec('Đơn chờ xác nhận', 'warn', `${t.don.cho_xac_nhan} đơn đang giữ hàng, chờ khách cho thông tin hoặc đồng ý.`, lienKet('#/don?loc=cho_xac_nhan', 'Mở Đơn hàng')));
  if (t.anh_khach_cho_duyet) viec.push(hangViec('Ảnh khách', 'warn', `Ảnh khách mặc thật chờ duyệt: ${t.anh_khach_cho_duyet}. Che mặt, chọn món rồi mới lên Màn hình sản phẩm.`, lienKet('#/anh-khach', 'Mở màn duyệt')));
  if (t.ck_cho_doi_chieu) viec.push(hangViec('Chuyển khoản', 'warn', `Chuyển khoản chờ đối chiếu: ${t.ck_cho_doi_chieu} đơn. Xem sao kê ngân hàng rồi bấm "Đã nhận tiền" ở từng đơn.`, lienKet('#/don?loc=chua_nhan_tien', 'Mở Đơn hàng')));
  if (t.don?.da_xac_nhan) viec.push(hangViec('Cần gửi', 'info', `${t.don.da_xac_nhan} đơn đã xác nhận, chờ gửi hàng.`, lienKet('#/don?loc=da_xac_nhan', 'In phiếu, gửi hàng')));
  for (const v of t.viec_den_han) {
    const nut = h('button', { class: 'btn small', type: 'button' }, 'Xong');
    nut.addEventListener('click', async () => {
      try { await dangLam(nut, '…', () => api.put(`/viec/${v.id}`, { trang_thai: 'xong' })); veLai(); } catch (e) { toast(e.message, true); }
    });
    const [ten, mauGoc] = TEN_VIEC[v.loai] || ['Việc', 'info'];
    // F-97: yêu cầu xóa dữ liệu có hạn 72 giờ — đỏ khi còn dưới 12 giờ.
    const mau = v.loai === 'xoa_du_lieu' && v.han_luc && new Date(v.han_luc) - Date.now() < 12 * 3600e3 ? 'bad' : mauGoc;
    viec.push(hangViec(ten, mau, `${v.noi_dung}${v.han_luc ? ` (hạn ${gioPhut(v.han_luc)})` : ''}`,
      h('span', { class: 'nutbam' }, v.khach_id && lienKet(`#/khach?id=${v.khach_id}`, 'Khách'), v.don_id && lienKet(`#/don?id=${v.don_id}`, 'Đơn'), nut)));
  }
  for (const x of t.het_hang || []) viec.push(hangViec('Hết hàng', 'bad', `${x.ten}: mọi màu, cỡ đã hết.`, lienKet('#/kho', 'Nhập hàng')));
  if (t.sap_het?.length) viec.push(hangViec('Sắp hết', 'warn', `${t.sap_het.length} sản phẩm có màu, cỡ sắp hết: ${t.sap_het.slice(0, 4).map((x) => x.ten).join('; ')}${t.sap_het.length > 4 ? '…' : ''}`, lienKet('#/kho', 'Mở Tồn kho')));
  if (t.sao_luu.canNhac) {
    const nut = h('button', { class: 'btn small primary', type: 'button' }, 'Sao lưu ngay');
    nut.addEventListener('click', async () => {
      try {
        await dangLam(nut, 'Đang sao lưu…', () => api.post('/sao-luu'));
        toast('Đã sao lưu');
        await veLai();
      } catch (loi) { toast(loi.message, true); }
    });
    const lan = t.sao_luu.cuoi ? `Đã ${t.sao_luu.soNgay} ngày chưa sao lưu (lần gần nhất ${gioPhut(t.sao_luu.cuoi.luc, true)}).` : 'Chưa sao lưu lần nào.';
    viec.push(hangViec('Sao lưu', 'warn', lan, nut));
  }
  if (!t.ai.du) viec.push(hangViec('Khóa AI', 'warn', `Còn thiếu khóa: ${t.ai.thieu.join(', ')}.`, lienKet('#/cai-dat', 'Nhập khóa')));
  if (!t.san_pham.dang_ban) viec.push(hangViec('Sản phẩm', 'info', 'Chưa có sản phẩm nào Đang bán. AI chỉ được nói về sản phẩm Đang bán.', lienKet('#/san-pham', 'Mở Sản phẩm')));
  // F-95: thông tin shop còn thiếu (8 mục) — đủ thì ẩn. "Điền bằng lời" mở ô Nói với Mai với câu gợi ý.
  if (t.thong_tin_shop?.length) {
    const nutLoi = h('button', { class: 'btn small primary', type: 'button' }, 'Điền bằng lời');
    nutLoi.addEventListener('click', () => window.dispatchEvent(new CustomEvent('moza:goi-y-noi', { detail: { cau: t.thong_tin_shop[0].goi_y } })));
    viec.push(hangViec('Thông tin shop', 'warn', `Còn thiếu ${t.thong_tin_shop.length}/8: ${t.thong_tin_shop.map((x) => x.ten).join(' · ')}.`,
      h('span', { class: 'nutbam' }, nutLoi, lienKet('#/cai-dat', 'Mở Cài đặt'))));
  }
  if (t.so_tay_trong) viec.push(hangViec('Sổ tay', 'info', `${t.so_tay_trong} mục Sổ tay shop còn trống (giao hàng, thanh toán, đổi trả…). AI chỉ trả lời chuyện chung bằng những gì có trong Sổ tay.`, lienKet('#/so-tay', 'Mở Sổ tay')));
  if (t.cho_duyet) viec.push(hangViec('Chờ duyệt', 'warn', `${t.cho_duyet} hành động của AI đang chờ bạn duyệt.`, lienKet('#/cai-dat/tro-ly-ai/cho-duyet', 'Xem')));

  const [theLive, doiHinh, chiSo] = await Promise.all([veTheLive(), veDoiHinh(), veChiSo()]);
  const nhomViec = MUC_VIEC.map(([mau, ten]) => [ten, viec.filter((e) => e.dataset.mau === mau)]).filter(([, ds]) => ds.length);
  khung.replaceChildren(...[
    h('div', { class: 'viewbar' }, h('h1', {}, 'Hôm nay')),
    theLive,
    h('div', { class: 'tiles' },
      oSo('Chờ xác nhận', t.don?.cho_xac_nhan ?? 0, 'đơn đang giữ hàng', '#/don?nhom=can_lam', t.don?.cho_xac_nhan ? 'warn' : '', 'Không có đơn nào chờ'),
      oSo('Cần gửi', t.don?.da_xac_nhan ?? 0, 'đơn đã xác nhận', '#/don?nhom=can_lam', '', 'Chưa có đơn cần gửi'),
      oSo('Doanh số hôm nay', tien(t.doanh_so_hom_nay ?? 0), 'đơn đã xác nhận trở lên', '#/bao-cao', '', 'Chưa có đơn hôm nay'),
      oSo('Khách cần bạn', t.can_nguoi, 'cuộc trò chuyện chờ bạn', '#/tin-nhan?loc=can_nguoi', t.can_nguoi ? 'bad' : '', 'Không ai đang chờ bạn')),
    h('section', { class: 'panel' },
      h('header', {}, h('h2', {}, 'Việc cần làm')),
      nhomViec.length
        ? h('div', { class: 'body' }, nhomViec.map(([ten, ds]) => h('div', { class: 'viec-muc' }, h('h3', {}, ten), h('div', { class: 'viec' }, ds))))
        : trangTrong('Không có việc nào cần làm ngay. Bạn có thể chuẩn bị buổi live kế tiếp.', { href: '#/live', chu: 'Chuẩn bị live' })),
    doiHinh,
    chiSo,
  ].filter(Boolean));
}
