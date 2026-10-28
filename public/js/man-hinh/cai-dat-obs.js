// Cài đặt → OBS (SPEC.md #90): nối OBS Studio trên máy này để MOZA chuyển cảnh Phòng live / Sản phẩm / Cả hai
// và đưa Màn hình sản phẩm lên sóng. Mật khẩu WebSocket của OBS chỉ nằm trong .env.

import { api } from '../api.js';
import { h, toast, dangLam } from '../ui.js';

function huongDan() {
  const b = (...x) => h('li', {}, ...x);
  const lk = (url, chu) => h('a', { href: url, target: '_blank', rel: 'noopener' }, chu || url);
  return h('details', { class: 'huong-dan' },
    h('summary', {}, 'Hướng dẫn từng bước (làm một lần, khoảng 20–30 phút)'),
    h('ol', {},
      b(h('b', {}, 'Cài OBS Studio '), '(miễn phí, bản 32 trở lên): ', lk('https://obsproject.com/download'), ' → bản Windows → cài như phần mềm thường.'),
      b(h('b', {}, 'Bật WebSocket: '), 'mở OBS → menu Công cụ (Tools) → Cài đặt máy chủ WebSocket (WebSocket Server Settings) → tích "Bật máy chủ WebSocket" → '
        + 'bấm "Hiện thông tin kết nối" để xem mật khẩu → dán mật khẩu vào ô bên dưới, bấm Lưu. Cổng để 4455.'),
      b(h('b', {}, 'Bấm "Kiểm tra kết nối", rồi "Tạo cảnh Moza". '), 'OBS sẽ có 3 cảnh: Moza · Phòng live, Moza · Sản phẩm, Moza · Cả hai. '
        + 'Màn hình sản phẩm và thanh chữ đã được MOZA đặt sẵn.'),
      b(h('b', {}, 'Nối camera điện thoại vào máy tính:')),
      h('ul', {},
        b(h('b', {}, 'Điện thoại Android: '), 'trên máy tính mở Cài đặt Windows → Bluetooth & thiết bị → Thiết bị di động → "Quản lý thiết bị" → bật cho phép dùng điện thoại làm camera; '
          + 'trên điện thoại cài "Liên kết với Windows" (Link to Windows), cần Android 10 trở lên. Hoặc cắm cáp USB, chọn chế độ "Webcam" nếu máy có.'),
        b(h('b', {}, 'iPhone: '), 'cài DroidCam trên iPhone (App Store) và plugin DroidCam cho OBS trên máy tính: ', lk('https://droidcam.app/obs'),
          ' — hai máy chung Wi-Fi. Bản miễn phí có hình chuẩn, muốn HD không logo thì mua bản Pro. Có thể dùng Camo thay thế.')),
      b(h('b', {}, 'Thêm camera vào cảnh: '), 'trong OBS chọn cảnh "Moza · Phòng live" → nút + ở khung Nguồn (Sources) → Thiết bị quay video (Video Capture Device) '
        + '(iPhone với DroidCam: chọn nguồn DroidCam) → chọn điện thoại → OK. Kéo cho đầy khung. Cảnh "Cả hai" tự dùng lại camera này.'),
      b(h('b', {}, 'Thêm lại một lần "Tạo cảnh Moza" '), 'để thanh chữ nằm trên camera.'),
      b(h('b', {}, 'Tiếng: '), 'micro của người dẫn: nút + → Thu âm thanh đầu vào (Audio Input Capture). Tiếng Mai phát ở Màn hình người dẫn đi vào '
        + '"Âm thanh máy tính" (Desktop Audio) của OBS — để bật. Người dẫn nên đeo tai nghe để micro không thu lại tiếng loa.'),
      b(h('b', {}, 'Phát lên Facebook: '), 'vào Facebook Live Producer của Page bán hàng → chọn "Phần mềm phát trực tiếp" (Streaming software) → chép Khóa luồng (Stream key). '
        + 'Trong OBS: Cài đặt → Phát trực tiếp (Stream) → Dịch vụ Facebook Live → dán khóa. Không gửi khóa luồng cho ai. '
        + 'Bấm "Bắt đầu phát" trong OBS; MOZA tự thấy buổi live qua kết nối Page.'),
      b(h('b', {}, 'Khi live: '), 'Màn hình người dẫn có khối "Lên sóng": phím 1 / 2 / 3 đổi cảnh, Enter nhận gợi ý chiếu của Mai. '
        + 'Mai dẫn chính hoặc Đội AI dẫn thì Mai tự chuyển cảnh — bấm nút là giành lại.')));
}

export function veObs() {
  const eTT = h('p', { class: 'hint' }, 'Đang đọc…');
  const oMk = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Mật khẩu WebSocket của OBS' });
  const oCong = h('input', { type: 'number', min: 1, max: 65535, value: 4455, style: 'max-width:120px' });
  // Khung hình buổi live: dọc 9:16 (xem bằng điện thoại — mặc định) hoặc ngang 16:9 (xem bằng máy tính).
  const oKhung = h('select', {}, h('option', { value: 'doc' }, 'Dọc 9:16 (1080 × 1920) — khách xem bằng điện thoại'),
    h('option', { value: 'ngang' }, 'Ngang 16:9 (1920 × 1080) — khách xem bằng máy tính'));
  const loi = h('p', { class: 'loi', role: 'alert' });
  const ve = (kq) => {
    const o = kq.obs_cai_dat || kq;
    const k = kq.canh?.obs;
    oCong.value = o.cong || 4455;
    oKhung.value = o.khung || 'doc';
    // replaceChildren của trình duyệt in cả null thành chữ "null": bỏ phần trống trước.
    eTT.replaceChildren(...[
      h('span', { class: `chip ${k?.ket_noi ? 'ok' : 'mute'}` }, k?.ket_noi ? `Đã nối OBS${k.phien_ban ? ` ${k.phien_ban}` : ''}` : 'Chưa nối OBS'), ' ',
      h('span', { class: `chip ${o.co_mat_khau ? 'ok' : 'warn'}` }, o.co_mat_khau ? 'Đã có mật khẩu' : 'Chưa có mật khẩu'),
      k?.loi ? h('span', { class: 'muted' }, ` · ${k.loi}`) : null].filter(Boolean));
  };
  const tai = () => api.get('/man-hinh').then(ve).catch((e) => { eTT.textContent = e.message; });
  const nutLuu = h('button', { class: 'btn primary small', type: 'button' }, 'Lưu');
  nutLuu.addEventListener('click', async () => {
    loi.textContent = '';
    try {
      await dangLam(nutLuu, 'Đang lưu…', () => api.put('/obs', { cong: Number(oCong.value), khung: oKhung.value, ...(oMk.value ? { mat_khau: oMk.value } : {}) }));
      oMk.value = '';
      toast('Đã lưu cài đặt OBS');
      tai();
    } catch (e) { loi.textContent = e.message; }
  });
  const nutKiem = h('button', { class: 'btn small', type: 'button' }, 'Kiểm tra kết nối');
  nutKiem.addEventListener('click', async () => {
    loi.textContent = '';
    try { await dangLam(nutKiem, 'Đang nối…', () => api.post('/obs/kiem-tra')); toast('Đã nối OBS'); } catch (e) { loi.textContent = e.message; }
    tai();
  });
  const nutTao = h('button', { class: 'btn small', type: 'button' }, 'Tạo cảnh Moza');
  nutTao.addEventListener('click', async () => {
    loi.textContent = '';
    try { await dangLam(nutTao, 'Đang tạo…', () => api.post('/obs/tao-canh')); toast('Đã tạo 3 cảnh Moza trong OBS'); } catch (e) { loi.textContent = e.message; }
    tai();
  });
  tai();
  return [
    eTT,
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', {}, 'Mật khẩu WebSocket'), oMk),
      h('label', { class: 'field' }, h('span', {}, 'Cổng'), oCong),
      h('label', { class: 'field' }, h('span', {}, 'Khung hình buổi live'), oKhung,
        h('p', { class: 'hint' }, 'Live bán hàng trên Facebook phần lớn là khung dọc. Đổi khung rồi bấm Lưu: Màn hình sản phẩm, Thanh chữ đổi bố cục ngay; bấm lại "Tạo cảnh Moza" để OBS đổi theo (dừng phát trước khi đổi).'))),
    loi,
    h('div', { class: 'nutbam' }, nutLuu, nutKiem, nutTao,
      h('a', { class: 'btn small', href: '/man-hinh-san-pham.html', target: '_blank', rel: 'noopener' }, 'Mở Màn hình sản phẩm')),
    huongDan(),
  ];
}
