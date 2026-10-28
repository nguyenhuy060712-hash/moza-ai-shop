// Cài đặt → Facebook (SPEC.md F-03, F-06, F-24): App ID, App Secret, lấy mã Page, kiểm quyền,
// trạng thái đường hầm / webhook / lưới an toàn / giới hạn gọi, và hướng dẫn từng bước cho người dùng.
// App Secret và mã Page chỉ nằm trong .env; trình duyệt chỉ thấy 4 ký tự cuối.

import { api } from '../api.js';
import { h, toast, gioPhut, dangLam } from '../ui.js';

const TEN_QUYEN = {
  pages_messaging: 'Nhắn tin Messenger',
  pages_read_engagement: 'Đọc bình luận, bài đăng',
  pages_manage_engagement: 'Trả lời, ẩn bình luận',
  pages_read_user_content: 'Đọc nội dung người dùng đăng trên Page',
  pages_manage_metadata: 'Nhận webhook của Page',
  pages_show_list: 'Thấy danh sách Page',
};

const TEN_WEBHOOK = {
  tat: 'Chưa chạy', chua_ket_noi: 'Chưa đủ mã', chua_cai: 'Máy chưa cài cloudflared', dang_ky: 'Đang đăng ký với Meta',
  hoat_dong: 'Đang nhận tin tức thì', ngat: 'Đường hầm ngắt — đang hỏi định kỳ', loi: 'Lỗi',
};

function huongDan() {
  const b = (...x) => h('li', {}, ...x);
  const lk = (url, chu) => h('a', { href: url, target: '_blank', rel: 'noopener' }, chu || url);
  return h('details', { class: 'huong-dan' },
    h('summary', {}, 'Hướng dẫn từng bước (làm một lần, khoảng 30–45 phút)'),
    h('ol', {},
      b(h('b', {}, 'Đăng ký tài khoản nhà phát triển Meta: '), lk('https://developers.facebook.com/async/registration'),
        ' — bấm Next, nhập mã gửi về điện thoại và email, chọn nghề nghiệp.'),
      b(h('b', {}, 'Tạo ứng dụng: '), lk('https://developers.facebook.com/apps/creation/'),
        ' — đặt tên (ví dụ "Moza AI Shop"), email → Next. Ở "Use cases" tích "Engage with customers on Messenger from Meta" và, nếu cho chọn cùng, '
        + '"Manage everything on your Page" → Next. Ở "Business" chọn "I don\'t want to connect a business portfolio yet" → Next → "Go to dashboard".'),
      b(h('b', {}, 'Thêm quyền: '), 'trong Dashboard bấm "Customize" ở use case Messenger → bấm "Add" cạnh pages_read_engagement. '
        + 'Ở use case "Manage everything on your Page" bấm "Add" cạnh pages_read_user_content (pages_manage_engagement có sẵn).'),
      b(h('b', {}, 'Nối Page: '), 'trong "Messenger API Setup" → "Generate access tokens" → "Connect" → chọn các Page cần nối → Continue → Save.'),
      b(h('b', {}, 'Publish ứng dụng '), '(Meta chỉ gửi webhook khi ứng dụng đã Publish — không phải App Review): cần ảnh biểu tượng 512–1024 px, '
        + 'địa chỉ trang Chính sách quyền riêng tư và trang Hướng dẫn xóa dữ liệu (Claude đã soạn sẵn nội dung trong docs/chinh-sach-rieng-tu-ban-hang.md). '
        + 'Bấm "Publish" ở menu trái.'),
      b(h('b', {}, 'App ID và App Secret: '), 'App ID ở thanh trên cùng của Dashboard. App Secret ở "App settings" → "Basic" → "Show" (nhập lại mật khẩu Facebook). '
        + 'Dán cả hai vào hai ô bên dưới rồi bấm Lưu. Không dán vào tin nhắn hay gửi cho ai.'),
      b(h('b', {}, 'Lấy mã: '), lk('https://developers.facebook.com/tools/explorer', 'Graph API Explorer'),
        ' → chọn ứng dụng ở "Meta App" → "User or Page" chọn "Get User Access Token" → ở "Permissions" thêm đủ 6 quyền trong bảng dưới → "Generate Access Token" → '
        + 'đồng ý, tích mọi Page muốn nối (được nhiều Page). Chép mã dài hiện ra, dán vào ô "Mã từ Graph API Explorer" rồi bấm "Lấy mã Page". MOZA tự đổi sang mã Page không hết hạn.'),
      b(h('b', {}, 'Cài cloudflared '), '(đường hầm để Facebook báo tin mới về máy này): mở PowerShell, gõ ',
        h('code', {}, 'winget install --id Cloudflare.cloudflared -e'), ', đồng ý khi Windows hỏi quyền quản trị, rồi tắt và mở lại MOZA.'),
      b(h('b', {}, 'Tài khoản thử: '), 'trong ứng dụng Meta → "App Roles" → "Roles" → mời một tài khoản Facebook thứ hai làm "Tester". '
        + 'Người đó đăng ký nhà phát triển (bước 1) rồi chấp nhận lời mời ở ', lk('https://developers.facebook.com/requests/'), '. '
        + 'Trước khi Meta duyệt ứng dụng (App Review), chỉ tài khoản có vai trò mới nhắn được với Mai.'),
      b(h('b', {}, 'Kiểm tra Page: '), 'không đặt "ứng dụng mặc định" trong Conversation Routing của Page; tắt trả lời tự động của hộp thư Page và '
        + 'Meta Business Agent nếu đang bật, để không có hai bên cùng trả lời khách.')));
}

function veQuyen(ds) {
  return h('table', { class: 'bang-quyen' },
    h('tbody', {}, ds.map((q) => h('tr', {},
      h('td', {}, h('code', {}, q.quyen)), h('td', {}, TEN_QUYEN[q.quyen] || ''),
      h('td', {}, q.co == null ? h('span', { class: 'chip mute' }, 'Chưa kiểm') : q.co ? h('span', { class: 'chip ok' }, 'Có') : h('span', { class: 'chip bad' }, 'Thiếu'))))));
}

function veTrangThai(tt) {
  const dh = tt.duong_ham;
  const dong = (nhan, ...gt) => h('div', { class: 'dong-tt' }, h('span', { class: 'muted' }, nhan), h('span', {}, ...gt));
  return h('div', { class: 'tt-facebook' },
    dong('Kết nối', h('span', { class: `chip ${{ xanh: 'ok', vang: 'warn', do: 'bad' }[tt.muc] || 'mute'}` }, tt.chu)),
    dong('Webhook', TEN_WEBHOOK[tt.webhook] || tt.webhook, tt.dang_ky_luc ? ` · đăng ký lúc ${gioPhut(tt.dang_ky_luc)}` : ''),
    dh && dong('Đường hầm', dh.dia_chi || '—', dh.lan_rot ? ` · đã rớt ${dh.lan_rot} lần` : ''),
    dh?.loi && h('p', { class: 'loi' }, dh.loi),
    tt.loi && h('p', { class: 'loi' }, tt.loi),
    dong('Hỏi định kỳ (lưới an toàn)', tt.luoi_an_toan?.lan_cuoi ? `lần cuối ${gioPhut(tt.luoi_an_toan.lan_cuoi)}` : 'chưa chạy',
      tt.luoi_an_toan?.loi ? ` · lỗi: ${tt.luoi_an_toan.loi}` : ''),
    dong('Giới hạn gọi Facebook', `đang dùng ${tt.nhip_goi.muc_dung}%`, tt.nhip_goi.dang_gioi_han ? ` · đang bị giới hạn, còn ${tt.nhip_goi.con_giay} giây` : ''),
    tt.su_kien_gan_day?.length > 0 && dong('Tin về gần nhất', `${gioPhut(tt.su_kien_gan_day[0].luc)} (${tt.su_kien_gan_day[0].nguon === 'webhook' ? 'webhook' : 'hỏi định kỳ'})`));
}

/** Danh sách Page đã nối (#37): bật / tắt, bỏ hẳn; kèm kết quả kiểm quyền của từng Page nếu vừa kiểm. */
function vePages(tt, kiemTra, ve) {
  if (!tt.pages.length) return h('p', { class: 'muted' }, 'Chưa nối Page nào.');
  const kq = new Map((kiemTra?.pages || []).map((p) => [p.id, p]));
  return h('div', { class: 'ds-page' }, tt.pages.map((p) => {
    const k = kq.get(p.id);
    const bat = h('input', { type: 'checkbox', role: 'switch', checked: p.bat });
    bat.addEventListener('change', async () => {
      try {
        ve(await api.put(`/ket-noi/page/${p.id}`, { bat: bat.checked }));
        toast(bat.checked ? `Đã bật ${p.ten || p.id}` : `Đã tắt ${p.ten || p.id}`);
      } catch (e) { bat.checked = !bat.checked; toast(e.message, true); }
    });
    const bo = h('button', { class: 'btn small', type: 'button' }, 'Bỏ Page');
    bo.addEventListener('click', async () => {
      if (!confirm(`Bỏ Page "${p.ten || p.id}" khỏi MOZA? Mã của Page này sẽ bị xóa khỏi máy. Hội thoại cũ vẫn giữ.`)) return;
      try { ve(await dangLam(bo, 'Đang bỏ…', () => api.del(`/ket-noi/page/${p.id}`))); } catch (e) { toast(e.message, true); }
    });
    return h('div', { class: 'the-page' },
      h('div', { class: 'hang' },
        h('b', {}, p.ten || `Page ${p.id}`),
        p.het_han ? h('span', { class: 'chip bad' }, 'Mã hết hạn') : k ? h('span', { class: `chip ${k.ok ? 'ok' : 'warn'}` }, k.ok ? 'Đủ quyền' : 'Thiếu quyền / lỗi') : null,
        h('label', { class: 'khancap xanh' }, bat, h('span', {}, p.bat ? 'Đang bật' : 'Đang tắt')),
        bo),
      k?.loi && h('p', { class: 'loi' }, k.loi),
      k?.het_han && h('p', { class: 'hint' }, `Mã Page: ${k.het_han}.`),
      k && veQuyen(k.quyen));
  }));
}

export function veFacebook(ttBanDau) {
  const vung = h('div', {});
  const ve = (tt, kiemTra = null) => {
    const ch = tt.cau_hinh;
    const oId = h('input', { type: 'text', inputmode: 'numeric', value: ch.app_id.gia_tri || '', placeholder: 'Dãy số', 'aria-label': 'App ID' });
    const oBm = h('input', { type: 'password', autocomplete: 'off', placeholder: ch.app_secret.co ? `Đã có ••••${ch.app_secret.duoi} — dán mã mới để đổi` : 'Dán App Secret', 'aria-label': 'App Secret' });
    const nutLuu = h('button', { class: 'btn small', type: 'button' }, 'Lưu');
    nutLuu.addEventListener('click', async () => {
      const than = {};
      if (oId.value.trim() !== (ch.app_id.gia_tri || '')) than.app_id = oId.value;
      if (oBm.value.trim()) than.app_secret = oBm.value;
      if (!Object.keys(than).length) return toast('Chưa có gì mới để lưu.', true);
      try {
        ve(await dangLam(nutLuu, 'Đang lưu…', () => api.post('/ket-noi/ma', than)));
        toast('Đã lưu vào .env trên máy này');
      } catch (e) { toast(e.message, true); }
    });

    const oMa = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Dán mã dài lấy ở Graph API Explorer', 'aria-label': 'Mã từ Graph API Explorer' });
    const nutMa = h('button', { class: 'btn small primary', type: 'button' }, 'Lấy mã Page');
    const chonPage = h('div', {});
    const xong = async (kq) => {
      toast(`Đã nối ${kq.pages.map((p) => p.ten).join(', ')}`);
      const t = await api.post('/ket-noi/kiem-tra');
      ve(t.trang_thai, t.kiem_tra);
    };
    const layMa = async (pageIds = null) => {
      try {
        const kq = await dangLam(nutMa, 'Đang lấy…', () => api.post('/ket-noi/ma-page', pageIds ? { page_ids: pageIds } : { ma_nguoi_dung: oMa.value }));
        oMa.value = '';
        if (!kq.can_chon) return xong(kq);
        // Tài khoản quản lý nhiều Page: tích chọn các Page muốn MOZA làm việc cùng (#37).
        const o = kq.pages.map((p) => ({ p, cb: h('input', { type: 'checkbox', checked: p.da_noi }) }));
        const nutChon = h('button', { class: 'btn small primary', type: 'button' }, 'Nối các Page đã chọn');
        nutChon.addEventListener('click', () => {
          const ids = o.filter((x) => x.cb.checked).map((x) => x.p.id);
          if (!ids.length) return toast('Tích chọn ít nhất một Page.', true);
          layMa(ids);
        });
        chonPage.replaceChildren(h('p', {}, 'Tài khoản này quản lý nhiều Page. Tích các Page muốn nối với MOZA:'),
          h('div', { class: 'chon-page' }, o.map((x) => h('label', {}, x.cb, ' ', x.p.ten, x.p.da_noi ? ' (đang nối)' : ''))),
          h('div', { class: 'nutbam' }, nutChon));
      } catch (e) { toast(e.message, true); }
    };
    nutMa.addEventListener('click', () => (oMa.value.trim() ? layMa() : toast('Dán mã vào ô trước đã.', true)));

    const nutKiem = h('button', { class: 'btn small', type: 'button' }, 'Kiểm tra kết nối');
    nutKiem.addEventListener('click', async () => {
      try {
        const t = await dangLam(nutKiem, 'Đang kiểm…', () => api.post('/ket-noi/kiem-tra'));
        ve(t.trang_thai, t.kiem_tra);
        if (t.kiem_tra.loi) toast(t.kiem_tra.loi, true);
      } catch (e) { toast(e.message, true); }
    });
    const nutDk = h('button', { class: 'btn small', type: 'button' }, 'Mở lại đường hầm và đăng ký lại');
    nutDk.addEventListener('click', async () => {
      try { ve(await dangLam(nutDk, 'Đang mở…', () => api.post('/ket-noi/dang-ky-lai'))); } catch (e) { toast(e.message, true); }
    });

    // Bộ mẫu tin Utility (#89, F-67, F-69): báo đơn đã gửi, nhắc đơn chờ xác nhận, báo đơn hủy — cả khi quá 24 giờ.
    const TEN_MAU = { da_gui: 'Đơn đã gửi', cho_xac_nhan: 'Đơn đang chờ xác nhận', da_huy: 'Đơn đã hủy', da_xac_nhan: 'Đơn đã xác nhận', chuan_bi_gui: 'Chuẩn bị gửi (hỏi lại)', hoi_mac: 'Hỏi mặc có vừa' }; // F-98
    const TT_MAU = { APPROVED: 'đã duyệt', PENDING: 'đang chờ duyệt', REJECTED: 'bị từ chối' };
    const nutMau = h('button', { class: 'btn small', type: 'button' }, 'Tạo bộ mẫu tin');
    const ttMau = h('ul', { class: 'lich-su' });
    const veMau = (m) => ttMau.replaceChildren(...Object.keys(TEN_MAU).map((k) => {
      const t = (m.trang_thai || []).filter((x) => x.loai === k);
      const chu = !m.bo?.[k] ? 'chưa tạo'
        : t.length ? t.map((x) => (x.loi ? `lỗi: ${x.loi}` : `${TT_MAU[x.trang_thai] || x.trang_thai || '?'}${x.loai_mau === 'MARKETING' ? ' (Meta xếp tiếp thị — không gửi được)' : ''}`)).join(' · ')
          : `đã gửi Meta duyệt lúc ${new Date(m.bo[k].tao_luc).toLocaleString('vi-VN')}`;
      return h('li', {}, h('b', {}, `${TEN_MAU[k]}: `), chu, h('div', { class: 'hint' }, `"${m.mau?.[k] || ''}"`));
    }));
    api.get('/ket-noi/mau-utility').then(veMau).catch(() => {});
    nutMau.addEventListener('click', async () => {
      try {
        const kq = await dangLam(nutMau, 'Đang gửi Meta…', () => api.post('/ket-noi/mau-utility'));
        const loi = kq.ket_qua.filter((x) => x.loi);
        toast(loi.length ? `Có mẫu lỗi: ${loi.map((x) => `${x.ten} · ${TEN_MAU[x.loai]}: ${x.loi}`).join('; ')}` : 'Đã gửi Meta duyệt bộ mẫu tin (thường vài giây tới vài phút). Duyệt xong MOZA tự dùng.', loi.length > 0);
        veMau(await api.get('/ket-noi/mau-utility'));
      } catch (e) { toast(e.message, true); }
    });

    // F-70: nút Bắt đầu + lời chào (người mới vào từ link m.me của buổi live mang theo mã buổi qua nút Bắt đầu).
    const nutHoSo = h('button', { class: 'btn small', type: 'button' }, 'Cài Messenger cho Page');
    nutHoSo.addEventListener('click', async () => {
      try {
        const kq = await dangLam(nutHoSo, 'Đang cài…', () => api.post('/ket-noi/ho-so-messenger'));
        const loi = kq.ket_qua.filter((x) => x.loi);
        toast(loi.length ? `Có Page lỗi: ${loi.map((x) => `${x.ten}: ${x.loi}`).join('; ')}` : 'Đã cài nút Bắt đầu và lời chào cho Messenger của Page.', loi.length > 0);
      } catch (e) { toast(e.message, true); }
    });

    vung.replaceChildren(
      huongDan(),
      h('div', { class: 'hang' },
        h('label', { class: 'field' }, h('span', {}, 'App ID'), oId),
        h('label', { class: 'field' }, h('span', {}, 'App Secret'), oBm), nutLuu),
      h('div', { class: 'hang' },
        h('label', { class: 'field' }, h('span', {}, 'Mã từ Graph API Explorer (thêm Page: lấy mã mới, tích thêm Page)'), oMa), nutMa),
      chonPage,
      h('h3', {}, `Các Page đã nối (${tt.pages.length})`),
      vePages(tt, kiemTra, ve),
      veTrangThai(tt),
      h('div', { class: 'nutbam' }, nutKiem, nutDk),
      h('h3', {}, 'Bộ mẫu tin báo đơn (Utility)'),
      h('p', { class: 'hint' }, 'Messenger chỉ cho nhắn khách trong 24 giờ kể từ tin cuối của họ. Mẫu tin Utility (Meta duyệt trước, thường vài giây tới vài phút) cho phép báo đơn đã gửi, nhắc đơn chờ xác nhận, báo đơn hủy cả sau 24 giờ. Chỉ chữ thông tin đơn, không mời chào. Bấm một lần sau khi nối Page (đổi cài đặt Page nên bạn tự bấm).'),
      h('div', { class: 'nutbam' }, nutMau), ttMau,
      h('h3', {}, 'Messenger của Page'),
      h('p', { class: 'hint' }, 'Cài nút "Bắt đầu" và lời chào có câu tự nhận trợ lý AI. Người mới bấm link m.me của buổi live (trong câu ghim, câu gom) sẽ được MOZA nhận ra họ vừa chốt món gì. Bấm một lần sau khi nối Page.'),
      h('div', { class: 'nutbam' }, nutHoSo),
      // F-94: bình luận mục lục trên video xem lại, 2 phút sau khi live xong (không giá, không tên khách).
      h('h3', {}, 'Sau buổi live'),
      (() => {
        const o = h('input', { type: 'checkbox', role: 'switch', checked: tt.tu_dang_muc_luc !== false });
        o.addEventListener('change', async () => { try { await api.put('/cai-dat', { fb_tu_dang_muc_luc: o.checked }); toast(o.checked ? 'Sẽ tự đăng mục lục sau live' : 'Không tự đăng mục lục'); } catch (e) { o.checked = !o.checked; toast(e.message, true); } });
        return h('label', { class: 'khancap xanh' }, o, h('span', {}, 'Tự đăng mục lục sau live — Page bình luận "📌 Mục lục: 02:15 Áo 12 …" lên video xem lại để người xem sau chốt được (nhận tới 7 ngày)'));
      })(),
      h('p', { class: 'hint' }, 'MOZA nhận tin và bình luận của mọi Page đang bật, trả lời bằng đúng Page nhận tin. Cổng webhook chỉ nghe ở 127.0.0.1:5174 '
        + 'và chỉ nhận tin có chữ ký của Meta. Giao diện MOZA không bao giờ ra internet.'));
  };
  ve(ttBanDau);
  return [vung];
}
